import { createHash } from "node:crypto";
import { canonicalizeLocalClaims } from "./local-runtime-capability-grants.mjs";
import { computePncContractDigest, PNC_IDENTITY_PROFILE } from "./pnc-contract-identity.mjs";
import { authorizeLocalProjectOperation, deriveLocalProjectTaskAuthority } from "./local-autonomous-project-authority.mjs";

const BINDING_KEYS = ["contractId", "schemaVersion", "identityProfile", "digest"];
const TRUSTED_PNC_KEYS = ["contract", "schemaValidationVerified", "sourceIntegrityVerified", "ownerAuthorized"];
const MANDATE_KEYS = ["claims", "mandateDigest", "issuerId", "signatureVerified", "consentVerified", "revocationState", "schemaValidationVerified"];
const TRUSTED_CONSENT_KEYS = ["claims", "schemaValidationVerified", "signatureVerified", "brokerAuthenticated"];
const CHILD_KEYS = ["schemaVersion", "mandateId", "mandateDigest", "taskId", "manifestDigest", "issuerId", "workerId", "runtimeId", "projectRef", "repositoryRef", "workspaceRef", "operations", "expiresAt"];
const OUTER_KEYS = ["authorized", "kind", "childDigest", "baseChildDigest", "authority"];
const CHILD_KIND = "internal-pnc-bound-local-project-task-authority";
const PNC_DOMAIN = "CORMIA\0PNC-BOUND-PROJECT-TASK-AUTHORITY\0v0.2\0";
const BASE_DOMAIN = "IMMORTAL-AEP|LOCAL-PROJECT-TASK-AUTHORITY|v0.1|";

function plain(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function exactKeys(value, expected) {
  if (!plain(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== "string")) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some(key => {
    const d = descriptors[key];
    return !d || !d.enumerable || !Object.hasOwn(d, "value");
  })) return false;
  const actual = keys.sort(), wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, i) => key === wanted[i]);
}

function sameBinding(a, b) {
  return exactKeys(a, BINDING_KEYS) && exactKeys(b, BINDING_KEYS) &&
    BINDING_KEYS.every(key => a[key] === b[key]);
}

function digest(domain, value) {
  return "sha256:" + createHash("sha256")
    .update(domain + canonicalizeLocalClaims(value), "utf8")
    .digest("hex");
}

function verifyPncStoreRecord(record, binding, project) {
  if (!exactKeys(record, TRUSTED_PNC_KEYS) ||
      record.schemaValidationVerified !== true ||
      record.sourceIntegrityVerified !== true ||
      record.ownerAuthorized !== true) {
    return { valid: false, reason: "pnc-not-trusted-by-host-store" };
  }
  const pnc = record.contract;
  if (!plain(pnc)) return { valid: false, reason: "pnc-contract-invalid" };
  if (pnc.status !== "active") return { valid: false, reason: "pnc-not-active" };
  if (!exactKeys(binding, BINDING_KEYS) ||
      typeof binding.contractId !== "string" ||
      binding.schemaVersion !== "0.1.0" ||
      binding.identityProfile !== PNC_IDENTITY_PROFILE ||
      typeof binding.digest !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(binding.digest)) {
    return { valid: false, reason: "pnc-binding-invalid" };
  }
  if (pnc.contractId !== binding.contractId || pnc.schemaVersion !== binding.schemaVersion) {
    return { valid: false, reason: "pnc-contract-identity-mismatch" };
  }
  if (!plain(pnc.project) || !plain(pnc.project.repository) ||
      pnc.project.projectRef !== project.projectRef ||
      pnc.project.repository.fullName !== project.repositoryRef) {
    return { valid: false, reason: "pnc-project-repository-mismatch" };
  }
  try {
    const identity = computePncContractDigest(pnc);
    if (identity.profile !== binding.identityProfile || identity.digest !== binding.digest) {
      return { valid: false, reason: "pnc-digest-mismatch" };
    }
  } catch {
    return { valid: false, reason: "pnc-identity-computation-failed" };
  }
  return { valid: true };
}


function validateTrustedConsent(trustedConsent, trustedMandate, now) {
  if (!exactKeys(trustedConsent, TRUSTED_CONSENT_KEYS) ||
      trustedConsent.schemaValidationVerified !== true ||
      trustedConsent.signatureVerified !== true ||
      trustedConsent.brokerAuthenticated !== true ||
      !plain(trustedConsent.claims)) {
    return { valid: false, reason: "project-mandate-consent-not-trusted" };
  }
  const c = trustedConsent.claims;
  const m = trustedMandate.claims;
  try {
    canonicalizeLocalClaims(c);
  } catch {
    return { valid: false, reason: "project-mandate-consent-invalid-claims" };
  }
  if (c.schemaVersion !== "0.2.0" ||
      c.decision !== "approve" ||
      c.interactionMode !== "local-interactive-project-mandate" ||
      c.mandateId !== m.mandateId ||
      c.mandateDigest !== trustedMandate.mandateDigest ||
      c.issuerId !== m.issuerId ||
      c.operatorPrincipalId !== m.operatorPrincipalId ||
      c.displayedChallenge !== c.confirmedChallenge ||
      !/^[a-f0-9]{8}$/.test(c.displayedChallenge) ||
      !Number.isSafeInteger(c.sequence) || c.sequence < 1 ||
      c.projectRef !== m.project.projectRef ||
      c.workspaceRef !== m.workspace.workspaceRef ||
      !sameBinding(c.normativeContractBinding, m.normativeContractBinding)) {
    return { valid: false, reason: "project-mandate-consent-binding-mismatch" };
  }
  const nowMs = now instanceof Date ? now.getTime() :
    typeof now === "string" ? Date.parse(now) :
    typeof now === "number" ? now : NaN;
  const issuedAt = Date.parse(c.issuedAt);
  const expiresAt = Date.parse(c.expiresAt);
  if (![nowMs, issuedAt, expiresAt].every(Number.isFinite) ||
      issuedAt > nowMs || expiresAt <= nowMs || issuedAt >= expiresAt) {
    return { valid: false, reason: "project-mandate-consent-expired-or-not-yet-valid" };
  }
  return { valid: true };
}

function normalizeMandateV2(trustedMandate) {
  if (!exactKeys(trustedMandate, MANDATE_KEYS) ||
      trustedMandate.schemaValidationVerified !== true ||
      typeof trustedMandate.mandateDigest !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(trustedMandate.mandateDigest) ||
      trustedMandate.signatureVerified !== true ||
      trustedMandate.consentVerified !== true ||
      trustedMandate.revocationState !== "healthy" ||
      !plain(trustedMandate.claims) ||
      trustedMandate.claims.schemaVersion !== "0.2.0" ||
      !exactKeys(trustedMandate.claims.normativeContractBinding, BINDING_KEYS)) return null;
  try {
    canonicalizeLocalClaims(trustedMandate.claims);
  } catch {
    return null;
  }
  const claims = { ...trustedMandate.claims };
  delete claims.normativeContractBinding;
  claims.schemaVersion = "0.1.0";
  return {
    claims,
    mandateDigest: trustedMandate.mandateDigest,
    issuerId: trustedMandate.issuerId,
    signatureVerified: trustedMandate.signatureVerified,
    consentVerified: trustedMandate.consentVerified,
    revocationState: trustedMandate.revocationState
  };
}

function baseChildDigest(authority) {
  return digest(BASE_DOMAIN, authority);
}

function pncChildDigest(baseDigest, authority) {
  return digest(PNC_DOMAIN, { baseChildDigest: baseDigest, authority });
}

export function derivePncBoundProjectTaskAuthority({
  trustedMandate, trustedConsent, trustedNormativeContract, expectedHost, task, now = new Date()
} = {}) {
  try {
    const normalized = normalizeMandateV2(trustedMandate);
    if (!normalized) return { authorized: false, reason: "invalid-pnc-bound-mandate-v0.2" };
    const consent = validateTrustedConsent(trustedConsent, trustedMandate, now);
    if (!consent.valid) return { authorized: false, reason: consent.reason };
    const binding = trustedMandate.claims.normativeContractBinding;
    const pnc = verifyPncStoreRecord(trustedNormativeContract, binding, trustedMandate.claims.project);
    if (!pnc.valid) return { authorized: false, reason: pnc.reason };

    const base = deriveLocalProjectTaskAuthority({ trustedMandate: normalized, expectedHost, task, now });
    if (!base.authorized) return base;

    const authority = { ...base.authority, normativeContractBinding: { ...binding } };
    const childDigest = pncChildDigest(base.childDigest, authority);
    Object.freeze(authority.normativeContractBinding);
    Object.freeze(authority.operations);
    Object.freeze(authority);
    return Object.freeze({
      authorized: true,
      kind: CHILD_KIND,
      childDigest,
      baseChildDigest: base.childDigest,
      authority
    });
  } catch {
    return { authorized: false, reason: "pnc-bound-task-authority-derivation-failed" };
  }
}

export function authorizePncBoundProjectOperation({
  childAuthority, trustedMandate, trustedConsent, trustedNormativeContract, hostPolicy,
  expectedTaskId, expectedManifestDigest, operation, relativePath,
  executionProfileId, branchName, remoteHost, now = new Date()
} = {}) {
  try {
    if (!exactKeys(childAuthority, OUTER_KEYS) ||
        childAuthority.authorized !== true || childAuthority.kind !== CHILD_KIND ||
        typeof childAuthority.childDigest !== "string" ||
        !/^sha256:[a-f0-9]{64}$/.test(childAuthority.childDigest) ||
        typeof childAuthority.baseChildDigest !== "string" ||
        !/^sha256:[a-f0-9]{64}$/.test(childAuthority.baseChildDigest) ||
        !plain(childAuthority.authority)) {
      return { allowed: false, reason: "invalid-pnc-bound-child-authority" };
    }
    const normalized = normalizeMandateV2(trustedMandate);
    if (!normalized) return { allowed: false, reason: "invalid-pnc-bound-mandate-v0.2" };
    const authority = childAuthority.authority;
    if (!exactKeys(authority, [...CHILD_KEYS, "normativeContractBinding"])) {
      return { allowed: false, reason: "invalid-pnc-bound-child-payload" };
    }

    const consent = validateTrustedConsent(trustedConsent, trustedMandate, now);
    if (!consent.valid) return { allowed: false, reason: consent.reason };
    const binding = trustedMandate.claims.normativeContractBinding;
    if (!sameBinding(authority.normativeContractBinding, binding)) {
      return { allowed: false, reason: "child-pnc-binding-mismatch" };
    }
    const pnc = verifyPncStoreRecord(trustedNormativeContract, binding, trustedMandate.claims.project);
    if (!pnc.valid) return { allowed: false, reason: pnc.reason };

    if (pncChildDigest(childAuthority.baseChildDigest, authority) !== childAuthority.childDigest) {
      return { allowed: false, reason: "pnc-bound-child-integrity-failure" };
    }
    const baseAuthority = { ...authority };
    delete baseAuthority.normativeContractBinding;
    if (baseChildDigest(baseAuthority) !== childAuthority.baseChildDigest) {
      return { allowed: false, reason: "base-child-authority-integrity-failure" };
    }
    const baseChild = {
      authorized: true,
      kind: "internal-local-project-task-authority",
      childDigest: childAuthority.baseChildDigest,
      authority: baseAuthority
    };
    const result = authorizeLocalProjectOperation({
      childAuthority: baseChild,
      trustedMandate: normalized,
      hostPolicy,
      expectedTaskId,
      expectedManifestDigest,
      operation,
      relativePath,
      executionProfileId,
      branchName,
      remoteHost,
      now
    });
    if (!result.allowed) return result;
    return {
      ...result,
      normativeContractDigest: binding.digest,
      normativeContractProfile: binding.identityProfile
    };
  } catch {
    return { allowed: false, reason: "pnc-bound-project-operation-authorization-failed" };
  }
}
