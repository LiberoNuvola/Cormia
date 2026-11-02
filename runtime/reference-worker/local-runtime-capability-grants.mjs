import {
  createHash,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify
} from "node:crypto";

export const LOCAL_CAPABILITY_GRANT_VERSION = "0.1.0";

export const LOCAL_CAPABILITIES = Object.freeze([
  "workspace.list",
  "workspace.read",
  "workspace.diff",
  "workspace.verify",
  "workspace.create",
  "workspace.replace",
  "workspace.test"
]);

export const READ_ONLY_LOCAL_CAPABILITIES = Object.freeze([
  "workspace.list",
  "workspace.read",
  "workspace.diff",
  "workspace.verify"
]);

const READ_ONLY_SET = new Set(READ_ONLY_LOCAL_CAPABILITIES);
const GRANT_TYP = "application/immortal-aep-local-capability-grant+jws";
const REVOCATION_TYP = "application/immortal-aep-local-capability-revocation+jws";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const ISO_UTC_PATTERN = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isWellFormedString(value) {
  return typeof value === "string" &&
    (typeof value.isWellFormed !== "function" || value.isWellFormed());
}

/**
 * JCS-compatible canonicalization for this schema's restricted JSON subset.
 * The grant and revocation claim schemas permit only safe integers, strings,
 * booleans, null, arrays and plain objects; floating-point values are rejected.
 */
export function canonicalizeLocalClaims(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    if (!isWellFormedString(value)) throw new TypeError("Ill-formed Unicode string.");
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("Only safe integer numbers are allowed in local signed claims.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(item => canonicalizeLocalClaims(item)).join(",") + "]";
  }
  if (isPlainObject(value)) {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some(key => typeof key !== "string")) {
      throw new TypeError("Symbol properties are not valid in local signed claims.");
    }
    const keys = ownKeys.sort();
    for (const key of keys) {
      if (!isWellFormedString(key)) throw new TypeError("Ill-formed Unicode property name.");
    }
    return "{" + keys.map(key =>
      JSON.stringify(key) + ":" + canonicalizeLocalClaims(value[key])
    ).join(",") + "}";
  }
  throw new TypeError("Unsupported value in local signed claims.");
}

function decodeBase64Url(segment) {
  if (typeof segment !== "string" || !/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new TypeError("Invalid base64url segment.");
  }
  const bytes = Buffer.from(segment, "base64url");
  if (bytes.toString("base64url") !== segment) {
    throw new TypeError("Non-canonical base64url segment.");
  }
  return bytes;
}

function parseCanonicalJson(bytes) {
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new TypeError("Invalid UTF-8 payload.");
  }
  const value = JSON.parse(text);
  if (canonicalizeLocalClaims(value) !== text) {
    throw new TypeError("Signed JSON payload is not in canonical form.");
  }
  return value;
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isCanonicalUtc(value) {
  if (typeof value !== "string" || !ISO_UTC_PATTERN.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function isCanonicalRelativePath(value, { allowRoot = false } = {}) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return false;
  if (!isWellFormedString(value)) return false;
  if (allowRoot && value === ".") return true;
  if (value === "." || value.includes("\\") || value.startsWith("/") ||
      /^[A-Za-z]:/.test(value) || /[<>:"|?*\u0000-\u001f]/.test(value)) return false;

  const segments = value.split("/");
  if (segments.some(segment =>
    segment.length === 0 ||
    segment === "." ||
    segment === ".." ||
    segment.endsWith(" ") ||
    segment.endsWith(".") ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment)
  )) return false;

  return true;
}

function validateScope(scope, capability) {
  if (!isPlainObject(scope) || typeof scope.workspaceRef !== "string" ||
      scope.workspaceRef.length < 1 || scope.workspaceRef.length > 256) {
    return false;
  }

  const keys = Object.keys(scope).sort();
  const expectedCommon = ["workspaceRef"];
  if (capability === "workspace.list") {
    if (!hasExactKeys(scope, [...expectedCommon, "directories"])) return false;
    return Array.isArray(scope.directories) &&
      scope.directories.length >= 1 &&
      scope.directories.length <= 128 &&
      new Set(scope.directories).size === scope.directories.length &&
      scope.directories.every(item => isCanonicalRelativePath(item, { allowRoot: true }));
  }
  if (capability === "workspace.test") {
    return hasExactKeys(scope, [...expectedCommon, "executionProfileId"]) &&
      typeof scope.executionProfileId === "string" &&
      scope.executionProfileId.length >= 1 &&
      scope.executionProfileId.length <= 128;
  }
  if ([
    "workspace.read",
    "workspace.diff",
    "workspace.verify",
    "workspace.create",
    "workspace.replace"
  ].includes(capability)) {
    return hasExactKeys(scope, [...expectedCommon, "files"]) &&
      Array.isArray(scope.files) &&
      scope.files.length >= 1 &&
      scope.files.length <= 128 &&
      new Set(scope.files).size === scope.files.length &&
      scope.files.every(item => isCanonicalRelativePath(item));
  }
  void keys;
  return false;
}

export function validateLocalCapabilityGrantClaims(claims) {
  const required = [
    "schemaVersion", "grantId", "taskId", "manifestDigest", "issuerId",
    "subject", "capability", "scope", "issuedAt", "notBefore", "expiresAt",
    "delegable"
  ];
  if (!hasExactKeys(claims, required)) return { valid: false, reason: "invalid-grant-shape" };
  if (claims.schemaVersion !== LOCAL_CAPABILITY_GRANT_VERSION) return { valid: false, reason: "unsupported-grant-version" };
  if (typeof claims.grantId !== "string" || !UUID_PATTERN.test(claims.grantId)) return { valid: false, reason: "invalid-grant-id" };
  if (typeof claims.taskId !== "string" || claims.taskId.length < 1 || claims.taskId.length > 128) return { valid: false, reason: "invalid-task-id" };
  if (typeof claims.manifestDigest !== "string" || !SHA256_PATTERN.test(claims.manifestDigest)) return { valid: false, reason: "invalid-manifest-digest" };
  if (typeof claims.issuerId !== "string" || claims.issuerId.length < 1 || claims.issuerId.length > 256) return { valid: false, reason: "invalid-issuer-id" };
  if (!hasExactKeys(claims.subject, ["workerId", "runtimeId"]) ||
      typeof claims.subject.workerId !== "string" || claims.subject.workerId.length < 1 || claims.subject.workerId.length > 256 ||
      typeof claims.subject.runtimeId !== "string" || claims.subject.runtimeId.length < 1 || claims.subject.runtimeId.length > 256) {
    return { valid: false, reason: "invalid-subject" };
  }
  if (!LOCAL_CAPABILITIES.includes(claims.capability)) return { valid: false, reason: "unsupported-capability-id" };
  if (!validateScope(claims.scope, claims.capability)) return { valid: false, reason: "invalid-scope" };
  if (!isCanonicalUtc(claims.issuedAt) || !isCanonicalUtc(claims.notBefore) || !isCanonicalUtc(claims.expiresAt)) {
    return { valid: false, reason: "invalid-time-claims" };
  }
  const issuedAt = Date.parse(claims.issuedAt);
  const notBefore = Date.parse(claims.notBefore);
  const expiresAt = Date.parse(claims.expiresAt);
  if (issuedAt > notBefore || notBefore >= expiresAt) return { valid: false, reason: "invalid-time-order" };
  if (claims.delegable !== false) return { valid: false, reason: "delegation-disabled" };
  return { valid: true };
}

export function validateLocalCapabilityRevocationClaims(claims) {
  const required = [
    "schemaVersion", "revocationId", "grantId", "grantDigest", "taskId",
    "issuerId", "revokedAt", "sequence", "reasonCode"
  ];
  if (!hasExactKeys(claims, required)) return { valid: false, reason: "invalid-revocation-shape" };
  if (claims.schemaVersion !== LOCAL_CAPABILITY_GRANT_VERSION) return { valid: false, reason: "unsupported-revocation-version" };
  if (typeof claims.revocationId !== "string" || !UUID_PATTERN.test(claims.revocationId)) return { valid: false, reason: "invalid-revocation-id" };
  if (typeof claims.grantId !== "string" || !UUID_PATTERN.test(claims.grantId)) return { valid: false, reason: "invalid-grant-id" };
  if (typeof claims.grantDigest !== "string" || !SHA256_PATTERN.test(claims.grantDigest)) return { valid: false, reason: "invalid-grant-digest" };
  if (typeof claims.taskId !== "string" || claims.taskId.length < 1 || claims.taskId.length > 128) return { valid: false, reason: "invalid-task-id" };
  if (typeof claims.issuerId !== "string" || claims.issuerId.length < 1 || claims.issuerId.length > 256) return { valid: false, reason: "invalid-issuer-id" };
  if (!isCanonicalUtc(claims.revokedAt)) return { valid: false, reason: "invalid-revoked-at" };
  if (!Number.isSafeInteger(claims.sequence) || claims.sequence < 1) return { valid: false, reason: "invalid-revocation-sequence" };
  if (!["operator-request", "task-cancelled", "key-compromised", "policy-change"].includes(claims.reasonCode)) {
    return { valid: false, reason: "invalid-revocation-reason" };
  }
  return { valid: true };
}

function encodeBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function signCompactJws(claims, { privateKey, keyId, typ, validate }) {
  if (!privateKey || privateKey.asymmetricKeyType !== "ed25519") {
    throw new TypeError("An Ed25519 private key is required.");
  }
  if (typeof keyId !== "string" || keyId.length < 1 || keyId.length > 256) {
    throw new TypeError("A non-empty trusted key ID is required.");
  }
  const verdict = validate(claims);
  if (!verdict.valid) throw new TypeError(verdict.reason);

  const protectedHeader = {
    alg: "Ed25519",
    kid: keyId,
    typ
  };
  const protectedSegment = encodeBase64Url(Buffer.from(canonicalizeLocalClaims(protectedHeader), "utf8"));
  const payloadSegment = encodeBase64Url(Buffer.from(canonicalizeLocalClaims(claims), "utf8"));
  const signingInput = Buffer.from(protectedSegment + "." + payloadSegment, "ascii");
  const signature = cryptoSign(null, signingInput, privateKey);
  return protectedSegment + "." + payloadSegment + "." + encodeBase64Url(signature);
}

function verifyCompactJws(token, { resolveKey, typ, validate }) {
  try {
    if (typeof token !== "string" || token.length < 10 || token.length > 131072) {
      return { valid: false, reason: "invalid-token-size" };
    }
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, reason: "invalid-jws-serialization" };

    const protectedBytes = decodeBase64Url(parts[0]);
    const payloadBytes = decodeBase64Url(parts[1]);
    const signature = decodeBase64Url(parts[2]);
    if (signature.length !== 64) return { valid: false, reason: "invalid-signature-size" };

    const protectedHeader = parseCanonicalJson(protectedBytes);
    if (!hasExactKeys(protectedHeader, ["alg", "kid", "typ"])) {
      return { valid: false, reason: "invalid-protected-header" };
    }
    if (protectedHeader.alg !== "Ed25519") return { valid: false, reason: "unsupported-signature-algorithm" };
    if (protectedHeader.typ !== typ) return { valid: false, reason: "wrong-token-type" };
    if (typeof protectedHeader.kid !== "string" || protectedHeader.kid.length < 1 || protectedHeader.kid.length > 256) {
      return { valid: false, reason: "invalid-key-id" };
    }

    if (typeof resolveKey !== "function") return { valid: false, reason: "missing-trusted-key-resolver" };
    const keyInfo = resolveKey(protectedHeader.kid);
    if (!keyInfo || typeof keyInfo !== "object" ||
        typeof keyInfo.issuerId !== "string" ||
        keyInfo.role !== "local-host-authority" ||
        keyInfo.status !== "active" ||
        !keyInfo.publicKey) {
      return { valid: false, reason: "untrusted-signing-key" };
    }
    const publicKey = createPublicKey(keyInfo.publicKey);
    if (publicKey.asymmetricKeyType !== "ed25519") {
      return { valid: false, reason: "wrong-signing-key-type" };
    }

    const signingInput = Buffer.from(parts[0] + "." + parts[1], "ascii");
    if (!cryptoVerify(null, signingInput, publicKey, signature)) {
      return { valid: false, reason: "invalid-signature" };
    }

    const claims = parseCanonicalJson(payloadBytes);
    const claimsVerdict = validate(claims);
    if (!claimsVerdict.valid) return claimsVerdict;
    if (claims.issuerId !== keyInfo.issuerId) {
      return { valid: false, reason: "issuer-key-mismatch" };
    }

    return {
      valid: true,
      claims,
      keyId: protectedHeader.kid,
      issuerId: keyInfo.issuerId
    };
  } catch {
    return { valid: false, reason: "invalid-signed-token" };
  }
}

export function signLocalCapabilityGrant(claims, options) {
  return signCompactJws(claims, {
    ...options,
    typ: GRANT_TYP,
    validate: validateLocalCapabilityGrantClaims
  });
}

export function verifyLocalCapabilityGrant(token, { resolveKey } = {}) {
  const verified = verifyCompactJws(token, {
    resolveKey,
    typ: GRANT_TYP,
    validate: validateLocalCapabilityGrantClaims
  });
  if (!verified.valid) return verified;
  const digestInput = Buffer.concat([
    Buffer.from("IMMORTAL-AEP\\0LOCAL-RUNTIME-CAPABILITY-GRANT\\0v0.1\\0", "utf8"),
    Buffer.from(canonicalizeLocalClaims(verified.claims), "utf8")
  ]);
  return {
    ...verified,
    grantDigest: "sha256:" + createHash("sha256").update(digestInput).digest("hex")
  };
}

export function signLocalCapabilityRevocation(claims, options) {
  return signCompactJws(claims, {
    ...options,
    typ: REVOCATION_TYP,
    validate: validateLocalCapabilityRevocationClaims
  });
}

export function verifyLocalCapabilityRevocation(token, { resolveKey } = {}) {
  return verifyCompactJws(token, {
    resolveKey,
    typ: REVOCATION_TYP,
    validate: validateLocalCapabilityRevocationClaims
  });
}

/**
 * Evaluate one exact local workspace operation. Host policy and expected task
 * bindings must be supplied by trusted Runtime code, never by the model.
 */
export function authorizeLocalWorkspaceOperation({
  grantToken,
  revocationTokens = [],
  resolveKey,
  expected,
  hostPolicy,
  now = new Date()
} = {}) {
  const grant = verifyLocalCapabilityGrant(grantToken, { resolveKey });
  if (!grant.valid) return { allowed: false, reason: grant.reason };

  if (!expected || !hostPolicy) return { allowed: false, reason: "missing-trusted-context" };
  const nowMs = now instanceof Date ? now.getTime() :
    typeof now === "string" ? Date.parse(now) :
    typeof now === "number" ? now : NaN;
  if (!Number.isFinite(nowMs)) return { allowed: false, reason: "invalid-runtime-clock" };

  const claims = grant.claims;
  if (claims.taskId !== expected.taskId) return { allowed: false, reason: "task-mismatch" };
  if (claims.manifestDigest !== expected.manifestDigest) return { allowed: false, reason: "manifest-mismatch" };
  if (claims.subject.workerId !== expected.workerId) return { allowed: false, reason: "worker-mismatch" };
  if (claims.subject.runtimeId !== expected.runtimeId) return { allowed: false, reason: "runtime-mismatch" };
  if (claims.scope.workspaceRef !== expected.workspaceRef) return { allowed: false, reason: "workspace-mismatch" };
  if (claims.capability !== expected.capability) return { allowed: false, reason: "capability-mismatch" };

  if (Date.parse(claims.notBefore) > nowMs) return { allowed: false, reason: "grant-not-yet-valid" };
  if (Date.parse(claims.expiresAt) <= nowMs) return { allowed: false, reason: "grant-expired" };

  if (!Number.isSafeInteger(hostPolicy.maxGrantLifetimeSeconds) ||
      hostPolicy.maxGrantLifetimeSeconds < 1) {
    return { allowed: false, reason: "missing-host-lifetime-policy" };
  }
  const lifetimeMs = Date.parse(claims.expiresAt) - Date.parse(claims.issuedAt);
  if (lifetimeMs > hostPolicy.maxGrantLifetimeSeconds * 1000) {
    return { allowed: false, reason: "grant-lifetime-exceeds-host-policy" };
  }

  if (!READ_ONLY_SET.has(claims.capability)) {
    return { allowed: false, reason: "capability-not-supported-by-read-only-adapter" };
  }
  if (!Array.isArray(hostPolicy.allowedCapabilities) ||
      !hostPolicy.allowedCapabilities.includes(claims.capability)) {
    return { allowed: false, reason: "capability-not-allowed-by-host-policy" };
  }
  if (hostPolicy.workspaceRef !== claims.scope.workspaceRef ||
      !Array.isArray(hostPolicy.allowedFiles) ||
      !Array.isArray(hostPolicy.allowedDirectories)) {
    return { allowed: false, reason: "workspace-not-bound-by-host-policy" };
  }

  const grantedPaths = claims.capability === "workspace.list"
    ? claims.scope.directories
    : claims.scope.files;
  const hostPaths = claims.capability === "workspace.list"
    ? hostPolicy.allowedDirectories
    : hostPolicy.allowedFiles;
  if (grantedPaths.some(item => !hostPaths.includes(item))) {
    return { allowed: false, reason: "grant-exceeds-host-path-policy" };
  }

  if (typeof expected.path !== "string" ||
      !isCanonicalRelativePath(expected.path, { allowRoot: claims.capability === "workspace.list" }) ||
      !grantedPaths.includes(expected.path) ||
      !hostPaths.includes(expected.path)) {
    return { allowed: false, reason: "path-not-granted" };
  }

  if (!Array.isArray(revocationTokens)) return { allowed: false, reason: "invalid-revocation-feed" };
  const revocations = [];
  let previousSequence = 0;
  for (const token of revocationTokens) {
    const revocation = verifyLocalCapabilityRevocation(token, { resolveKey });
    if (!revocation.valid || revocation.issuerId !== grant.issuerId) {
      return { allowed: false, reason: "invalid-revocation-feed" };
    }
    if (revocation.claims.sequence <= previousSequence) {
      return { allowed: false, reason: "non-monotonic-revocation-sequence" };
    }
    previousSequence = revocation.claims.sequence;
    revocations.push(revocation.claims);
  }

  if (revocations.some(item =>
    item.issuerId === grant.issuerId &&
    item.grantId === claims.grantId &&
    item.grantDigest === grant.grantDigest &&
    item.taskId === claims.taskId &&
    Date.parse(item.revokedAt) <= nowMs
  )) {
    return { allowed: false, reason: "grant-revoked" };
  }

  return {
    allowed: true,
    reason: "authorized-read-only-operation",
    grantId: claims.grantId,
    grantDigest: grant.grantDigest
  };
}
