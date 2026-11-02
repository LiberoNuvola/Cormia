import assert from "node:assert/strict";
import test from "node:test";
import {
  computeProjectMandateClaimsDigest,
  computeProjectMandateConsentIntentDigest,
  computeProjectMandateConsentReceiptDigest,
  projectMandateConsentIntentClaims
} from "./project-mandate-consent-identity.mjs";

const intent = {
  schemaVersion: "0.2.0",
  mandateId: "11111111-1111-4111-8111-111111111111",
  project: { projectRef: "project-a", repositoryRef: "owner/repo", baseRef: "main" },
  workspace: { workspaceRef: "worktree-a" },
  normativeContractBinding: {
    contractId: "project-a.pnc.v0.1",
    schemaVersion: "0.1.0",
    identityProfile: "RFC8785-JCS-SHA256-DOMAIN-SEPARATED-v0.1",
    digest: "sha256:" + "a".repeat(64)
  }
};

test("consent intent excludes only the two receipt-dependent fields", () => {
  const complete = {
    ...intent,
    consentIntentDigest: "sha256:" + "b".repeat(64),
    operatorConsentDigest: "sha256:" + "c".repeat(64)
  };
  assert.deepEqual(projectMandateConsentIntentClaims(complete), intent);
});

test("intent digest is invariant to its own digest and receipt-digest fields", () => {
  const first = {
    ...intent,
    consentIntentDigest: "sha256:" + "1".repeat(64),
    operatorConsentDigest: "sha256:" + "2".repeat(64)
  };
  const second = {
    ...intent,
    consentIntentDigest: "sha256:" + "3".repeat(64),
    operatorConsentDigest: "sha256:" + "4".repeat(64)
  };
  assert.equal(computeProjectMandateConsentIntentDigest(first), computeProjectMandateConsentIntentDigest(second));
});

test("intent digest commits to project/workspace and PNC binding", () => {
  const base = computeProjectMandateConsentIntentDigest(intent);
  assert.notEqual(
    base,
    computeProjectMandateConsentIntentDigest({ ...intent, project: { ...intent.project, baseRef: "release" } })
  );
  assert.notEqual(
    base,
    computeProjectMandateConsentIntentDigest({
      ...intent,
      normativeContractBinding: { ...intent.normativeContractBinding, digest: "sha256:" + "f".repeat(64) }
    })
  );
});

test("receipt digest commits to canonical receipt claims", () => {
  const receipt = {
    schemaVersion: "0.2.0",
    consentId: "22222222-2222-4222-8222-222222222222",
    decision: "approve",
    consentIntentDigest: computeProjectMandateConsentIntentDigest(intent)
  };
  assert.notEqual(
    computeProjectMandateConsentReceiptDigest(receipt),
    computeProjectMandateConsentReceiptDigest({ ...receipt, decision: "deny" })
  );
});

test("final mandate digest covers both consent digests", () => {
  const first = {
    ...intent,
    consentIntentDigest: computeProjectMandateConsentIntentDigest(intent),
    operatorConsentDigest: "sha256:" + "d".repeat(64)
  };
  const second = { ...first, operatorConsentDigest: "sha256:" + "e".repeat(64) };
  assert.notEqual(computeProjectMandateClaimsDigest(first), computeProjectMandateClaimsDigest(second));
});

test("intent, receipt and final mandate identities use separate domains", () => {
  const intentDigest = computeProjectMandateConsentIntentDigest(intent);
  const receipt = { schemaVersion: "0.2.0", consentIntentDigest: intentDigest, decision: "approve" };
  const finalMandate = {
    ...intent,
    consentIntentDigest: intentDigest,
    operatorConsentDigest: computeProjectMandateConsentReceiptDigest(receipt)
  };
  assert.notEqual(intentDigest, computeProjectMandateConsentReceiptDigest(receipt));
  assert.notEqual(intentDigest, computeProjectMandateClaimsDigest(finalMandate));
});
