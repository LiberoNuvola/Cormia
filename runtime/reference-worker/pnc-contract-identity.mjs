import { createHash } from "node:crypto";
import { canonicalizeLocalClaims } from "./local-runtime-capability-grants.mjs";

export const PNC_SCHEMA_VERSION = "0.1.0";
export const PNC_IDENTITY_PROFILE = "RFC8785-JCS-SHA256-DOMAIN-SEPARATED-v0.1";

const DOMAIN_SEPARATOR = Buffer.from(
  "CORMIA\0PROJECT-NORMATIVE-CONTRACT\0v0.1\0",
  "utf8"
);
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Canonicalize a previously strict-parsed PNC object.
 * The caller validates schema and semantic references first and must reject
 * duplicate JSON member names (the Python PNC loader already does this).
 */
export function canonicalizePncContract(contract) {
  if (!isPlainObject(contract)) {
    throw new TypeError("A PNC contract must be a plain JSON object.");
  }
  if (contract.schemaVersion !== PNC_SCHEMA_VERSION) {
    throw new TypeError("Unsupported PNC schema version: " + String(contract.schemaVersion) + ".");
  }
  // Covers the complete object: no fields are omitted and array order is kept.
  return canonicalizeLocalClaims(contract);
}

/**
 * Compute a content fingerprint only. This does not authenticate, activate,
 * sign, or authorize the contract.
 */
export function computePncContractDigest(contract) {
  const canonicalJson = canonicalizePncContract(contract);
  const digest = createHash("sha256")
    .update(DOMAIN_SEPARATOR)
    .update(Buffer.from(canonicalJson, "utf8"))
    .digest("hex");
  return Object.freeze({
    profile: PNC_IDENTITY_PROFILE,
    schemaVersion: PNC_SCHEMA_VERSION,
    digest: "sha256:" + digest,
    canonicalJson
  });
}

export function verifyPncContractDigest(contract, expectedDigest) {
  if (typeof expectedDigest !== "string" || !DIGEST_PATTERN.test(expectedDigest)) return false;
  return computePncContractDigest(contract).digest === expectedDigest;
}
