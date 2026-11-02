import { createHash } from "node:crypto";
import { canonicalizeLocalClaims } from "./local-runtime-capability-grants.mjs";

export const PROJECT_MANDATE_V2_PROFILE = "RFC8785-JCS-SHA256-DOMAIN-SEPARATED-MANDATE-v0.2";
export const PROJECT_MANDATE_CONSENT_INTENT_PROFILE = "RFC8785-JCS-SHA256-DOMAIN-SEPARATED-CONSENT-INTENT-v0.2";
export const PROJECT_MANDATE_CONSENT_RECEIPT_PROFILE = "RFC8785-JCS-SHA256-DOMAIN-SEPARATED-CONSENT-RECEIPT-v0.2";

const MANDATE_DOMAIN = "CORMIA\0LOCAL-AUTONOMOUS-PROJECT-MANDATE\0v0.2\0";
const CONSENT_INTENT_DOMAIN = "CORMIA\0LOCAL-PROJECT-MANDATE-CONSENT-INTENT\0v0.2\0";
const CONSENT_RECEIPT_DOMAIN = "CORMIA\0LOCAL-PROJECT-MANDATE-CONSENT-RECEIPT\0v0.2\0";

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function digest(domain, canonicalJson) {
  return "sha256:" + createHash("sha256")
    .update(domain, "utf8")
    .update(canonicalJson, "utf8")
    .digest("hex");
}

/**
 * Intent preimage excludes only receipt-dependent fields, preventing a cycle.
 * Every substantive mandate claim, including the PNC identity, is covered.
 */
export function projectMandateConsentIntentClaims(claims) {
  if (!isPlainObject(claims)) throw new TypeError("Project mandate claims must be a plain object.");
  canonicalizeLocalClaims(claims); // reject accessors and unsupported values before copying
  const intent = { ...claims };
  delete intent.consentIntentDigest;
  delete intent.operatorConsentDigest;
  return intent;
}

export function computeProjectMandateConsentIntentDigest(claims) {
  const intent = projectMandateConsentIntentClaims(claims);
  return digest(CONSENT_INTENT_DOMAIN, canonicalizeLocalClaims(intent));
}

/** Digest the complete canonical receipt claims payload; signature verification is a separate host operation. */
export function computeProjectMandateConsentReceiptDigest(consentClaims) {
  return digest(CONSENT_RECEIPT_DOMAIN, canonicalizeLocalClaims(consentClaims));
}

/** Digest the complete final v0.2 mandate claims, including both consent digests. */
export function computeProjectMandateClaimsDigest(mandateClaims) {
  if (!isPlainObject(mandateClaims) || mandateClaims.schemaVersion !== "0.2.0") {
    throw new TypeError("Project mandate v0.2 claims are required.");
  }
  return digest(MANDATE_DOMAIN, canonicalizeLocalClaims(mandateClaims));
}
