import { createHash } from "node:crypto";
import { canonicalizeLocalClaims } from "./local-runtime-capability-grants.mjs";

const EVENT_DOMAIN = "IMMORTAL-AEP|LOCAL-REVOCATION-EVENT|v0.1|";
const MAX_JOURNAL_EVENTS = 100000;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length &&
    actual.every((key, index) => key === required[index]);
}

function validAnchor(anchor) {
  if (!exactKeys(anchor, ["providerId", "sequence", "headEventDigest"])) return false;
  if (typeof anchor.providerId !== "string" || anchor.providerId.length < 1) return false;
  if (!Number.isSafeInteger(anchor.sequence) || anchor.sequence < 0) return false;
  if (anchor.sequence === 0) return anchor.headEventDigest === null;
  return typeof anchor.headEventDigest === "string" &&
    SHA256_PATTERN.test(anchor.headEventDigest);
}

export function computeLocalRevocationEventDigest(event) {
  if (!exactKeys(event, [
    "schemaVersion", "sequence", "previousEventDigest", "revocationToken"
  ])) {
    throw new TypeError("invalid-journal-event-shape");
  }
  if (event.schemaVersion !== "0.1.0" ||
      !Number.isSafeInteger(event.sequence) ||
      event.sequence < 1 ||
      !(event.previousEventDigest === null ||
        (typeof event.previousEventDigest === "string" &&
          SHA256_PATTERN.test(event.previousEventDigest))) ||
      typeof event.revocationToken !== "string" ||
      event.revocationToken.length < 1 ||
      event.revocationToken.length > 131072) {
    throw new TypeError("invalid-journal-event");
  }

  const digestInput = EVENT_DOMAIN + canonicalizeLocalClaims(event);
  return "sha256:" + createHash("sha256").update(digestInput, "utf8").digest("hex");
}

export function createLocalRevocationJournalEvent({
  sequence,
  previousEventDigest,
  revocationToken
}) {
  const event = {
    schemaVersion: "0.1.0",
    sequence,
    previousEventDigest,
    revocationToken
  };
  // Validate and canonicalize before returning a new immutable envelope.
  computeLocalRevocationEventDigest(event);
  return Object.freeze(event);
}

/**
 * Verify a complete signed revocation chain and reconcile it with a separate
 * monotonic anchor. All persistence and cryptographic verification primitives
 * are injected by trusted host code. No filesystem or real provider is used.
 *
 * verifyRevocationToken(token) -> { valid, issuerId, claims }
 * verifyCheckpointToken(token) -> { valid, issuerId, claims }
 * readAnchor() -> { providerId, sequence, headEventDigest }
 * advanceAnchor(expectedAnchor, nextAnchor) -> true only after atomic CAS commit
 */
export async function verifyAndReconcileLocalRevocationJournal({
  events,
  checkpointToken,
  expectedIssuerId,
  verifyRevocationToken,
  verifyCheckpointToken,
  readAnchor,
  advanceAnchor
} = {}) {
  try {
    if (!Array.isArray(events) || events.length > MAX_JOURNAL_EVENTS) {
      return { allowed: false, status: "JOURNAL_INVALID", reason: "invalid-journal-size" };
    }
    if (typeof expectedIssuerId !== "string" || expectedIssuerId.length === 0 ||
        typeof verifyRevocationToken !== "function" ||
        typeof verifyCheckpointToken !== "function" ||
        typeof readAnchor !== "function") {
      return { allowed: false, status: "CONFIGURATION_INVALID", reason: "missing-trusted-verifier-or-anchor" };
    }

    const verifiedDigests = [];
    let previousEventDigest = null;

    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      const expectedSequence = index + 1;

      if (!exactKeys(event, [
        "schemaVersion", "sequence", "previousEventDigest", "revocationToken"
      ]) || event.schemaVersion !== "0.1.0" ||
          event.sequence !== expectedSequence ||
          event.previousEventDigest !== previousEventDigest) {
        return {
          allowed: false,
          status: "JOURNAL_INVALID",
          reason: "event-sequence-or-link-mismatch",
          failedSequence: expectedSequence
        };
      }

      const verified = await verifyRevocationToken(event.revocationToken);
      if (!verified || verified.valid !== true ||
          verified.issuerId !== expectedIssuerId ||
          !verified.claims ||
          verified.claims.sequence !== expectedSequence ||
          verified.claims.issuerId !== expectedIssuerId) {
        return {
          allowed: false,
          status: "JOURNAL_INVALID",
          reason: "invalid-revocation-signature-or-binding",
          failedSequence: expectedSequence
        };
      }

      const digest = computeLocalRevocationEventDigest(event);
      verifiedDigests.push(digest);
      previousEventDigest = digest;
    }

    const journalHead = {
      sequence: events.length,
      headEventDigest: previousEventDigest
    };

    const checkpoint = await verifyCheckpointToken(checkpointToken);
    if (!checkpoint || checkpoint.valid !== true ||
        checkpoint.issuerId !== expectedIssuerId ||
        !checkpoint.claims ||
        checkpoint.claims.issuerId !== expectedIssuerId ||
        checkpoint.claims.sequence !== journalHead.sequence ||
        checkpoint.claims.headEventDigest !== journalHead.headEventDigest) {
      return {
        allowed: false,
        status: "CHECKPOINT_INVALID",
        reason: "checkpoint-does-not-match-verified-journal-head"
      };
    }

    const anchor = await readAnchor();
    if (!validAnchor(anchor)) {
      return { allowed: false, status: "ANCHOR_INVALID", reason: "invalid-monotonic-anchor-state" };
    }
    if (checkpoint.claims.anchorProviderId !== anchor.providerId) {
      return { allowed: false, status: "ANCHOR_MISMATCH", reason: "checkpoint-provider-mismatch" };
    }

    if (journalHead.sequence < anchor.sequence) {
      return { allowed: false, status: "ROLLBACK", reason: "journal-behind-monotonic-anchor" };
    }

    if (journalHead.sequence === anchor.sequence) {
      if (journalHead.headEventDigest !== anchor.headEventDigest) {
        return { allowed: false, status: "FORK_OR_TAMPER", reason: "anchor-head-digest-mismatch" };
      }
      return {
        allowed: true,
        status: "HEALTHY",
        reason: "journal-matches-monotonic-anchor",
        head: journalHead
      };
    }

    const anchoredPrefixDigest = anchor.sequence === 0
      ? null
      : verifiedDigests[anchor.sequence - 1];

    if (anchoredPrefixDigest !== anchor.headEventDigest) {
      return {
        allowed: false,
        status: "FORK_OR_TAMPER",
        reason: "journal-does-not-contain-anchored-prefix"
      };
    }

    if (typeof advanceAnchor !== "function") {
      return {
        allowed: false,
        status: "ANCHOR_ADVANCE_REQUIRED",
        reason: "anchor-advance-provider-unavailable"
      };
    }

    const nextAnchor = {
      providerId: anchor.providerId,
      sequence: journalHead.sequence,
      headEventDigest: journalHead.headEventDigest
    };
    const committed = await advanceAnchor(anchor, nextAnchor);
    if (committed !== true) {
      return {
        allowed: false,
        status: "ANCHOR_ADVANCE_FAILED",
        reason: "anchor-compare-and-set-not-committed"
      };
    }

    return {
      allowed: true,
      status: "RECOVERED_AHEAD",
      reason: "verified-journal-advanced-monotonic-anchor",
      previousAnchor: {
        sequence: anchor.sequence,
        headEventDigest: anchor.headEventDigest
      },
      head: journalHead
    };
  } catch {
    return {
      allowed: false,
      status: "ANCHOR_UNAVAILABLE",
      reason: "anchor-or-verifier-operation-failed"
    };
  }
}
