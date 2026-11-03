import { randomUUID } from "node:crypto";

function requireText(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value;
}

function requirePositiveFinite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive finite number.`);
  }
  return value;
}

function asDate(value, name) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${name} must be a valid date.`);
  return date;
}

function publicOffer(offer, offerState = offer.offerState) {
  return {
    schemaVersion: offer.schemaVersion,
    recordType: offer.recordType,
    offerId: offer.offerId,
    providerRef: offer.providerRef,
    resourceType: offer.resourceType,
    capabilityProfileRef: offer.capabilityProfileRef,
    capacity: { ...offer.capacity },
    availability: { ...offer.availability },
    privacyProfileRef: offer.privacyProfileRef,
    ...(offer.constraintsRef ? { constraintsRef: offer.constraintsRef } : {}),
    offerState,
    ownerAccepted: offer.ownerAccepted,
    ...(offer.ownerAcceptanceRef ? { ownerAcceptanceRef: offer.ownerAcceptanceRef } : {}),
    validated: offer.validated,
    validationEvidenceRefs: [...offer.validationEvidenceRefs],
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt
  };
}

function validateConfiguredOffer(offer, providerRef) {
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) {
    throw new TypeError("Each local offer must be an object.");
  }

  requireText(offer.offerId, "offerId");
  if (offer.providerRef !== providerRef) throw new Error("offer-provider-mismatch");
  requireText(offer.resourceType, "resourceType");
  if (!/^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/.test(offer.resourceType)) {
    throw new TypeError("resourceType must use the versioned dotted identifier form.");
  }
  requireText(offer.capabilityProfileRef, "capabilityProfileRef");
  requireText(offer.privacyProfileRef, "privacyProfileRef");
  requireText(offer.operation, "host operation mapping");
  requirePositiveFinite(offer.capacity?.quantity, "capacity.quantity");
  requireText(offer.capacity?.unit, "capacity.unit");
  requireText(offer.availability?.notBefore, "availability.notBefore");
  requireText(offer.availability?.expiresAt, "availability.expiresAt");
  requireText(offer.createdAt, "createdAt");
  requireText(offer.updatedAt, "updatedAt");

  const notBefore = asDate(offer.availability.notBefore, "availability.notBefore");
  const expiresAt = asDate(offer.availability.expiresAt, "availability.expiresAt");
  if (expiresAt <= notBefore) throw new Error("offer-expiry-must-follow-start");

  if (offer.schemaVersion !== "0.1.0" || offer.recordType !== "cormia.core.resource-offer") {
    throw new Error("unsupported-resource-offer-version");
  }
  if (offer.offerState !== "available" || offer.ownerAccepted !== true || offer.validated !== true) {
    throw new Error("local-offer-must-be-owner-accepted-and-validated");
  }
  requireText(offer.ownerAcceptanceRef, "ownerAcceptanceRef");
  if (!Array.isArray(offer.validationEvidenceRefs) || offer.validationEvidenceRefs.length === 0 ||
      offer.validationEvidenceRefs.some(ref => typeof ref !== "string" || ref.trim().length === 0)) {
    throw new Error("validated-local-offer-requires-evidence-references");
  }

  return {
    ...publicOffer(offer),
    operation: offer.operation
  };
}

function copyLease(lease) {
  return {
    schemaVersion: "0.1.0",
    recordType: "cormia.core.resource-lease",
    leaseId: lease.leaseId,
    offerId: lease.offerId,
    consumerTaskRef: lease.consumerTaskRef,
    capabilityProfileRef: lease.capabilityProfileRef,
    reservedCapacity: { ...lease.reservedCapacity },
    leaseState: lease.leaseState,
    issuedAt: lease.issuedAt,
    ...(lease.activatedAt ? { activatedAt: lease.activatedAt } : {}),
    expiresAt: lease.expiresAt,
    ...(lease.releasedAt ? { releasedAt: lease.releasedAt } : {})
  };
}

/**
 * Host-side, local-only Resource Provider adapter.
 *
 * The host supplies owner-accepted and validated Resource Offer records and an
 * execution port that acquires/releases the actual local ResourceManager lease.
 * The offer's operation mapping is captured at construction and is never read
 * from task/model input.
 *
 * Leases are callback-scoped and process-local. This module does not persist
 * offers/leases, enforce OS quotas, discover remote providers, or implement
 * lease renewal. A coordinator must persist assignment/lease events separately.
 */
export function createLocalResourceProvider({
  providerRef,
  offers,
  executeWithLocalLease,
  leaseTtlMs,
  clock = () => new Date(),
  idFactory = randomUUID
} = {}) {
  requireText(providerRef, "providerRef");
  if (!Array.isArray(offers)) throw new TypeError("offers must be an array.");
  if (typeof executeWithLocalLease !== "function") {
    throw new TypeError("executeWithLocalLease must be a trusted host function.");
  }
  if (!Number.isSafeInteger(leaseTtlMs) || leaseTtlMs <= 0) {
    throw new TypeError("leaseTtlMs must be a positive safe integer supplied by host policy.");
  }
  if (typeof clock !== "function" || typeof idFactory !== "function") {
    throw new TypeError("clock and idFactory must be functions.");
  }

  const records = new Map();
  const revoked = new Set();
  for (const input of offers) {
    const offer = validateConfiguredOffer(input, providerRef);
    if (records.has(offer.offerId)) throw new Error("duplicate-local-resource-offer-id");
    records.set(offer.offerId, Object.freeze(offer));
  }

  function now() {
    return asDate(clock(), "clock result");
  }

  function stateOf(offer) {
    if (revoked.has(offer.offerId)) return "revoked";
    const time = now();
    if (time >= asDate(offer.availability.expiresAt, "availability.expiresAt")) return "expired";
    if (time < asDate(offer.availability.notBefore, "availability.notBefore")) return "accepted";
    return "available";
  }

  function inspect(offerId) {
    requireText(offerId, "offerId");
    const offer = records.get(offerId);
    if (!offer) return null;
    return publicOffer(offer, stateOf(offer));
  }

  function discover({ resourceType, capabilityProfileRef } = {}) {
    const result = [];
    for (const offer of records.values()) {
      if (resourceType !== undefined && offer.resourceType !== resourceType) continue;
      if (capabilityProfileRef !== undefined && offer.capabilityProfileRef !== capabilityProfileRef) continue;
      if (stateOf(offer) === "available") result.push(publicOffer(offer));
    }
    return result;
  }

  function revokeOffer(offerId) {
    requireText(offerId, "offerId");
    if (!records.has(offerId)) return { revoked: false, reason: "unknown-offer" };
    revoked.add(offerId);
    return { revoked: true, offer: inspect(offerId) };
  }

  async function withLease(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new TypeError("lease request must be an object.");
    }
    if (Object.hasOwn(input, "operation") || Object.hasOwn(input, "resourceKind")) {
      throw new Error("caller-cannot-select-resource-operation");
    }

    const offerId = requireText(input.offerId, "offerId");
    const consumerTaskRef = requireText(input.consumerTaskRef, "consumerTaskRef");
    const capabilityProfileRef = requireText(input.capabilityProfileRef, "capabilityProfileRef");
    if (typeof input.run !== "function") throw new TypeError("run must be a function.");

    const offer = records.get(offerId);
    if (!offer) return { allowed: false, reason: "unknown-offer", offerId };
    if (stateOf(offer) !== "available") {
      return { allowed: false, reason: `offer-${stateOf(offer)}`, offerId };
    }
    if (capabilityProfileRef !== offer.capabilityProfileRef) {
      return { allowed: false, reason: "capability-profile-mismatch", offerId };
    }

    const requested = input.requestedCapacity;
    const quantity = requirePositiveFinite(requested?.quantity, "requestedCapacity.quantity");
    const unit = requireText(requested?.unit, "requestedCapacity.unit");
    if (unit !== offer.capacity.unit || quantity > offer.capacity.quantity) {
      return { allowed: false, reason: "requested-capacity-exceeds-offer", offerId };
    }

    const issuedAt = now();
    const offerExpiresAt = asDate(offer.availability.expiresAt, "availability.expiresAt");
    const leaseExpiresAt = new Date(Math.min(issuedAt.getTime() + leaseTtlMs, offerExpiresAt.getTime()));
    if (leaseExpiresAt <= issuedAt) return { allowed: false, reason: "offer-expired", offerId };

    const execution = await executeWithLocalLease({
      operation: offer.operation,
      run: async executionContext => {
        const leaseId = requireText(idFactory(), "leaseId");
        const activatedAt = now();
        const activeLease = {
          leaseId,
          offerId,
          consumerTaskRef,
          capabilityProfileRef,
          reservedCapacity: { quantity, unit },
          leaseState: "active",
          issuedAt: issuedAt.toISOString(),
          activatedAt: activatedAt.toISOString(),
          expiresAt: leaseExpiresAt.toISOString()
        };
        const result = await input.run({
          lease: copyLease(activeLease),
          resource: executionContext?.resource ?? null,
          resourceKind: executionContext?.resourceKind ?? null
        });
        return { taskResult: result, activeLease };
      }
    });

    if (execution?.allowed !== true) {
      return {
        allowed: false,
        reason: execution?.reason ?? "local-resource-lease-denied",
        offerId
      };
    }

    const wrapped = execution.result;
    const activeLease = wrapped?.activeLease;
    if (!activeLease || typeof activeLease.leaseId !== "string") {
      throw new Error("local-resource-execution-did-not-return-lease-context");
    }
    const releasedAt = now();
    const releasedLease = copyLease({
      ...activeLease,
      leaseState: "released",
      releasedAt: releasedAt.toISOString()
    });

    return {
      allowed: true,
      lease: releasedLease,
      result: wrapped.taskResult,
      resource: execution.resource ?? null
    };
  }

  return Object.freeze({
    providerRef,
    discover,
    inspect,
    withLease,
    revokeOffer
  });
}
