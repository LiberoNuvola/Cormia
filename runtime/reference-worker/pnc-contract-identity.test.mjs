import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizePncContract,
  computePncContractDigest,
  PNC_IDENTITY_PROFILE,
  verifyPncContractDigest
} from "./pnc-contract-identity.mjs";

test("canonical PNC JSON follows RFC 8785 property ordering", () => {
  const value = { schemaVersion: "0.1.0", status: "draft", contractId: "pnc-test" };
  assert.equal(
    canonicalizePncContract(value),
    '{"contractId":"pnc-test","schemaVersion":"0.1.0","status":"draft"}'
  );
});

test("PNC digest has a stable domain-separated golden vector", () => {
  const value = { contractId: "pnc-test", schemaVersion: "0.1.0", status: "draft" };
  const identity = computePncContractDigest(value);
  assert.equal(PNC_IDENTITY_PROFILE, "RFC8785-JCS-SHA256-DOMAIN-SEPARATED-v0.1");
  assert.equal(identity.digest,
    "sha256:51d81feb0bc9893607f68bbbc5f6727311fcbc86aa9b6931437ca345502ca963");
  assert.equal(identity.canonicalJson,
    '{"contractId":"pnc-test","schemaVersion":"0.1.0","status":"draft"}');
});

test("object key insertion order does not affect parsed-object identity", () => {
  const first = { schemaVersion: "0.1.0", status: "draft", contractId: "pnc-test" };
  const second = { contractId: "pnc-test", schemaVersion: "0.1.0", status: "draft" };
  assert.equal(computePncContractDigest(first).digest, computePncContractDigest(second).digest);
});

test("array ordering remains significant", () => {
  const first = { schemaVersion: "0.1.0", items: ["a", "b"] };
  const second = { schemaVersion: "0.1.0", items: ["b", "a"] };
  assert.notEqual(computePncContractDigest(first).digest, computePncContractDigest(second).digest);
});

test("status and all contract fields are covered by the identity", () => {
  const draft = { schemaVersion: "0.1.0", contractId: "pnc-test", status: "draft" };
  const active = { ...draft, status: "active" };
  assert.notEqual(computePncContractDigest(draft).digest, computePncContractDigest(active).digest);
});

test("digest verifier accepts exact value and rejects mismatch or malformed input", () => {
  const value = { schemaVersion: "0.1.0", contractId: "pnc-test", status: "draft" };
  const digest = computePncContractDigest(value).digest;
  assert.equal(verifyPncContractDigest(value, digest), true);
  assert.equal(verifyPncContractDigest(value, "sha256:" + "0".repeat(64)), false);
  assert.equal(verifyPncContractDigest(value, "not-a-digest"), false);
});

test("unknown schema versions are rejected", () => {
  assert.throws(() => computePncContractDigest({ schemaVersion: "0.2.0" }), /Unsupported PNC schema version/);
});

test("unsafe numbers and non-JSON JavaScript objects are rejected", () => {
  assert.throws(
    () => canonicalizePncContract({ schemaVersion: "0.1.0", value: Number.MAX_SAFE_INTEGER + 1 }),
    /safe integer/
  );
  assert.throws(
    () => canonicalizePncContract({ schemaVersion: "0.1.0", value: new Date() }),
    /Unsupported value/
  );
});

test("accessor properties are rejected before serialization", () => {
  const value = { schemaVersion: "0.1.0" };
  Object.defineProperty(value, "status", {
    enumerable: true,
    get() { throw new Error("getter executed"); }
  });
  assert.throws(() => canonicalizePncContract(value), /Accessors/);
});
