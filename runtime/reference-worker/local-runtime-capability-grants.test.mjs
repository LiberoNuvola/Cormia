import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import {
  authorizeLocalWorkspaceOperation,
  canonicalizeLocalClaims,
  signLocalCapabilityGrant,
  signLocalCapabilityRevocation,
  validateLocalCapabilityGrantClaims,
  verifyLocalCapabilityGrant
} from "./local-runtime-capability-grants.mjs";

const now = "2026-11-02T15:30:00.000Z";
const issuerId = "local-host:operator-1";
const keyId = "local-host-key-v1";
const taskId = "TASK-20261102153000-abcdef12";
const manifestDigest = "sha256:" + "a".repeat(64);
const workerId = "worker-local-1";
const runtimeId = "runtime-cormia-v1";
const workspaceRef = "workspace-coding-main";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const resolveKey = kid => kid === keyId
  ? { publicKey, issuerId, role: "local-host-authority", status: "active" }
  : null;

function claims(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    grantId: "11111111-1111-4111-8111-111111111111",
    taskId,
    manifestDigest,
    issuerId,
    subject: { workerId, runtimeId },
    capability: "workspace.read",
    scope: { workspaceRef, files: ["src/module.mjs"] },
    issuedAt: "2026-11-02T15:00:00.000Z",
    notBefore: "2026-11-02T15:00:00.000Z",
    expiresAt: "2026-11-02T16:00:00.000Z",
    delegable: false,
    ...overrides
  };
}

function signGrant(overrides = {}) {
  return signLocalCapabilityGrant(claims(overrides), { privateKey, keyId });
}

function context(overrides = {}) {
  return {
    grantToken: signGrant(),
    revocationTokens: [],
    resolveKey,
    expected: {
      taskId,
      manifestDigest,
      workerId,
      runtimeId,
      workspaceRef,
      capability: "workspace.read",
      path: "src/module.mjs"
    },
    hostPolicy: {
      issuerId,
      workspaceRef,
      allowedCapabilities: ["workspace.list", "workspace.read", "workspace.diff", "workspace.verify"],
      allowedFiles: ["src/module.mjs", "src/other.mjs"],
      allowedDirectories: [".", "src"],
      maxGrantLifetimeSeconds: 7200
    },
    now,
    ...overrides
  };
}

test("canonicalizes the restricted JCS claim subset deterministically", () => {
  assert.equal(
    canonicalizeLocalClaims({ z: 1, nested: { y: true, a: "x" }, a: 2 }),
    '{"a":2,"nested":{"a":"x","y":true},"z":1}'
  );
  assert.throws(() => canonicalizeLocalClaims({ fractional: 1.5 }), /safe integer/);
  assert.throws(() => canonicalizeLocalClaims({ tooLarge: Number.MAX_SAFE_INTEGER + 1 }), /safe integer/);
  assert.throws(() => canonicalizeLocalClaims(new Array(1)), /Arrays with holes/);
  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() { return "not-json-data"; }
  });
  assert.throws(() => canonicalizeLocalClaims(accessor), /Accessors/);
});

test("signs and verifies a compact JWS Ed25519 grant", () => {
  const token = signGrant();
  const result = verifyLocalCapabilityGrant(token, { resolveKey });
  assert.equal(result.valid, true, result.reason ?? "grant verification returned false");
  assert.equal(result.claims.capability, "workspace.read");
  assert.match(result.grantDigest, /^sha256:[a-f0-9]{64}$/);
});

test("authorizes one exact path only when task, manifest, subject, host and time all match", () => {
  const result = authorizeLocalWorkspaceOperation(context());
  assert.equal(result.allowed, true, result.reason ?? "local operation authorization denied");
  assert.equal(result.reason, "authorized-read-only-operation");
});

test("rejects a tampered signature and an unknown signing key", () => {
  const token = signGrant();
  const tokenParts = token.split(".");
  const signatureBytes = Buffer.from(tokenParts[2], "base64url");
  signatureBytes[0] ^= 1;
  tokenParts[2] = signatureBytes.toString("base64url");
  const tampered = tokenParts.join(".");
  assert.equal(verifyLocalCapabilityGrant(tampered, { resolveKey }).reason, "invalid-signature");
  assert.equal(verifyLocalCapabilityGrant(token, { resolveKey: () => null }).reason, "untrusted-signing-key");
});

test("rejects signature algorithm and token type confusion", () => {
  const grant = signGrant();
  const revocation = signLocalCapabilityRevocation({
    schemaVersion: "0.1.0",
    revocationId: randomUUID(),
    grantId: claims().grantId,
    grantDigest: "sha256:" + "b".repeat(64),
    taskId,
    issuerId,
    revokedAt: now,
    sequence: 1,
    reasonCode: "operator-request"
  }, { privateKey, keyId });
  assert.equal(verifyLocalCapabilityGrant(revocation, { resolveKey }).reason, "wrong-token-type");
  const parts = grant.split(".");
  const protectedHeader = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  protectedHeader.alg = "EdDSA";
  parts[0] = Buffer.from(JSON.stringify(protectedHeader)).toString("base64url");
  assert.equal(verifyLocalCapabilityGrant(parts.join("."), { resolveKey }).reason, "unsupported-signature-algorithm");
});

test("binds grants to the exact task and manifest digest", () => {
  assert.equal(authorizeLocalWorkspaceOperation(context({
    expected: { ...context().expected, taskId: "another-task" }
  })).reason, "task-mismatch");
  assert.equal(authorizeLocalWorkspaceOperation(context({
    expected: { ...context().expected, manifestDigest: "sha256:" + "b".repeat(64) }
  })).reason, "manifest-mismatch");
});

test("requires the grant issuer to match the local host policy", () => {
  const result = authorizeLocalWorkspaceOperation(context({
    hostPolicy: { ...context().hostPolicy, issuerId: "other-local-host" }
  }));
  assert.equal(result.reason, "issuer-not-authorized-by-host-policy");
});

test("denies a grant if the trusted key is marked inactive", () => {
  const result = authorizeLocalWorkspaceOperation(context({
    resolveKey: kid => kid === keyId
      ? { publicKey, issuerId, role: "local-host-authority", status: "revoked" }
      : null
  }));
  assert.equal(result.reason, "untrusted-signing-key");
});

test("authorizes an exact root directory listing under its directory grant", () => {
  const token = signGrant({
    capability: "workspace.list",
    scope: { workspaceRef, directories: ["."] }
  });
  const result = authorizeLocalWorkspaceOperation(context({
    grantToken: token,
    expected: { ...context().expected, capability: "workspace.list", path: "." }
  }));
  assert.equal(result.allowed, true, result.reason);
});

test("binds grants to the exact worker, runtime and workspace", () => {
  assert.equal(authorizeLocalWorkspaceOperation(context({
    expected: { ...context().expected, workerId: "other-worker" }
  })).reason, "worker-mismatch");
  assert.equal(authorizeLocalWorkspaceOperation(context({
    expected: { ...context().expected, runtimeId: "other-runtime" }
  })).reason, "runtime-mismatch");
  assert.equal(authorizeLocalWorkspaceOperation(context({
    expected: { ...context().expected, workspaceRef: "other-workspace" }
  })).reason, "workspace-mismatch");
});

test("rejects expired, not-yet-valid and overlong grants", () => {
  assert.equal(authorizeLocalWorkspaceOperation(context({ now: "2026-11-02T16:00:00.000Z" })).reason, "grant-expired");
  assert.equal(authorizeLocalWorkspaceOperation(context({ now: "2026-11-02T14:59:59.000Z" })).reason, "grant-not-yet-valid");
  assert.equal(authorizeLocalWorkspaceOperation(context({
    hostPolicy: { ...context().hostPolicy, maxGrantLifetimeSeconds: 60 }
  })).reason, "grant-lifetime-exceeds-host-policy");
});

test("grant paths must be contained by the host allowlist and exact invocation scope", () => {
  assert.equal(authorizeLocalWorkspaceOperation(context({
    grantToken: signGrant({ scope: { workspaceRef, files: ["src/other.mjs", "src/escape.mjs"] } })
  })).reason, "grant-exceeds-host-path-policy");
  assert.equal(authorizeLocalWorkspaceOperation(context({
    expected: { ...context().expected, path: "src/other.mjs" }
  })).reason, "path-not-granted");
});

test("rejects unsupported mutating and test capabilities even when correctly signed", () => {
  const writeToken = signGrant({
    capability: "workspace.create",
    scope: { workspaceRef, files: ["src/new.mjs"] }
  });
  const result = authorizeLocalWorkspaceOperation(context({
    grantToken: writeToken,
    expected: { ...context().expected, capability: "workspace.create", path: "src/new.mjs" },
    hostPolicy: {
      ...context().hostPolicy,
      allowedCapabilities: [...context().hostPolicy.allowedCapabilities, "workspace.create"],
      allowedFiles: [...context().hostPolicy.allowedFiles, "src/new.mjs"]
    }
  }));
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "capability-not-supported-by-read-only-adapter");
});

test("rejects unsafe, non-canonical, duplicate and root file paths", () => {
  for (const badPath of ["../secret", "/absolute", "C:/drive", "src//x.mjs", "src/./x.mjs",
    "src/../x.mjs", "src\\x.mjs", "src/NUL", "src/bad:name", "src/trailing.", "src/bad\u0001name"]) {
    assert.throws(() => signGrant({
      scope: { workspaceRef, files: [badPath] }
    }), /invalid-scope/);
  }
  assert.throws(() => signGrant({
    scope: { workspaceRef, files: ["src/module.mjs", "src/module.mjs"] }
  }), /invalid-scope/);
  assert.throws(() => signGrant({
    scope: { workspaceRef, files: ["."] }
  }), /invalid-scope/);
  assert.equal(validateLocalCapabilityGrantClaims(claims()).valid, true);
});

test("rejects delegation in the local v0.1 profile", () => {
  assert.throws(() => signGrant({ delegable: true }), /delegation-disabled/);
});

test("a valid matching signed revocation denies the grant", () => {
  const token = signGrant();
  const grant = verifyLocalCapabilityGrant(token, { resolveKey });
  const revocationToken = signLocalCapabilityRevocation({
    schemaVersion: "0.1.0",
    revocationId: randomUUID(),
    grantId: grant.claims.grantId,
    grantDigest: grant.grantDigest,
    taskId,
    issuerId,
    revokedAt: now,
    sequence: 1,
    reasonCode: "operator-request"
  }, { privateKey, keyId });

  const result = authorizeLocalWorkspaceOperation(context({
    grantToken: token,
    revocationTokens: [revocationToken]
  }));
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "grant-revoked");
});

test("an unrelated signed revocation does not revoke this grant", () => {
  const revocationToken = signLocalCapabilityRevocation({
    schemaVersion: "0.1.0",
    revocationId: randomUUID(),
    grantId: randomUUID(),
    grantDigest: "sha256:" + "c".repeat(64),
    taskId,
    issuerId,
    revokedAt: now,
    sequence: 1,
    reasonCode: "operator-request"
  }, { privateKey, keyId });
  assert.equal(authorizeLocalWorkspaceOperation(context({
    revocationTokens: [revocationToken]
  })).allowed, true);
});

test("fails closed on an invalid revocation feed", () => {
  assert.equal(authorizeLocalWorkspaceOperation(context({
    revocationTokens: ["not.a.valid-token"]
  })).reason, "invalid-revocation-feed");
});

test("rejects a grant whose signer key is not a local host authority", () => {
  const result = authorizeLocalWorkspaceOperation(context({
    resolveKey: kid => kid === keyId
      ? { publicKey, issuerId, role: "worker", status: "active" }
      : null
  }));
  assert.equal(result.reason, "untrusted-signing-key");
});

test("rejects an issuer ID that is not bound to the trusted key", () => {
  const otherPair = generateKeyPairSync("ed25519");
  const token = signLocalCapabilityGrant(claims({ issuerId: "other-host" }), {
    privateKey: otherPair.privateKey,
    keyId: "other-key"
  });
  assert.equal(verifyLocalCapabilityGrant(token, {
    resolveKey: () => ({ publicKey: otherPair.publicKey, issuerId, role: "local-host-authority", status: "active" })
  }).reason, "issuer-key-mismatch");
});

test("rejects a non-monotonic or duplicate revocation sequence", () => {
  const token = signGrant();
  const grant = verifyLocalCapabilityGrant(token, { resolveKey });
  const revocationClaims = sequence => ({
    schemaVersion: "0.1.0",
    revocationId: randomUUID(),
    grantId: randomUUID(),
    grantDigest: "sha256:" + "d".repeat(64),
    taskId,
    issuerId,
    revokedAt: now,
    sequence,
    reasonCode: "operator-request"
  });
  const sequence2 = signLocalCapabilityRevocation(revocationClaims(2), { privateKey, keyId });
  const duplicate2 = signLocalCapabilityRevocation(revocationClaims(2), { privateKey, keyId });
  const duplicateResult = authorizeLocalWorkspaceOperation(context({
    grantToken: token,
    revocationTokens: [sequence2, duplicate2]
  }));
  assert.equal(duplicateResult.reason, "non-monotonic-revocation-sequence");

  const sequence3 = signLocalCapabilityRevocation(revocationClaims(3), { privateKey, keyId });
  const outOfOrderResult = authorizeLocalWorkspaceOperation(context({
    grantToken: token,
    revocationTokens: [sequence3, sequence2]
  }));
  assert.equal(outOfOrderResult.reason, "non-monotonic-revocation-sequence");
  assert.match(grant.grantDigest, /^sha256:/);
});
