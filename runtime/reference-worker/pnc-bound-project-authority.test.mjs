import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { computePncContractDigest } from "./pnc-contract-identity.mjs";
import {
  computeProjectMandateClaimsDigest,
  computeProjectMandateConsentIntentDigest,
  computeProjectMandateConsentReceiptDigest
} from "./project-mandate-consent-identity.mjs";
import { authorizePncBoundProjectOperation, derivePncBoundProjectTaskAuthority } from "./pnc-bound-project-authority.mjs";

const source = JSON.parse(readFileSync(new URL("../../examples/project-normative-contracts/immortal-protocol-v0.1.json", import.meta.url), "utf8"));
const activePnc = { ...source, status: "active" }; // synthetic test value; repository fixture remains draft
const pncIdentity = computePncContractDigest(activePnc);
const binding = {
  contractId: activePnc.contractId,
  schemaVersion: activePnc.schemaVersion,
  identityProfile: pncIdentity.profile,
  digest: pncIdentity.digest
};
const now = "2026-11-02T17:00:00.000Z";
const issuerId = "local-host:operator-1";
const projectRef = activePnc.project.projectRef;
const repositoryRef = activePnc.project.repository.fullName;
const workspaceRef = "worktree-immortal-task-1";
const workerId = "worker-cormia-local";
const runtimeId = "runtime-cormia-autonomous";
const taskId = "TASK-20261102-PNC-BOUND-001";
const manifestDigest = "sha256:" + "a".repeat(64);
const ops = ["workspace.read", "workspace.diff", "workspace.test"];

function receiptClaimsFor(mandateClaims) {
  const intentDigest = computeProjectMandateConsentIntentDigest(mandateClaims);
  return {
    schemaVersion: "0.2.0",
    consentId: "22222222-2222-4222-8222-222222222222",
    issuerId,
    operatorPrincipalId: mandateClaims.operatorPrincipalId,
    consentBrokerId: "os-consent-broker:1",
    mandateId: mandateClaims.mandateId,
    consentIntentDigest: intentDigest,
    projectRef: mandateClaims.project.projectRef,
    workspaceRef: mandateClaims.workspace.workspaceRef,
    decision: "approve",
    interactionMode: "local-interactive-project-mandate",
    interactionId: "33333333-3333-4333-8333-333333333333",
    displayedChallenge: intentDigest.slice(-8),
    confirmedChallenge: intentDigest.slice(-8),
    issuedAt: "2026-11-02T16:30:00.000Z",
    expiresAt: "2026-11-02T17:30:00.000Z",
    nonce: "44444444-4444-4444-8444-444444444444",
    sequence: 1,
    normativeContractBinding: { ...mandateClaims.normativeContractBinding }
  };
}

function buildInputs({ pnc = activePnc, project = {}, mandateChanges = {} } = {}) {
  const pncDigest = computePncContractDigest(pnc).digest;
  const pncBinding = { ...binding, digest: pncDigest };
  const mandateClaims = {
    schemaVersion: "0.2.0",
    mandateId: "11111111-1111-4111-8111-111111111111",
    issuerId,
    operatorPrincipalId: "os-principal:operator-1",
    subject: { workerId, runtimeId },
    project: { projectRef, repositoryRef, baseRef: "main", ...project },
    workspace: {
      workspaceRef, scopeMode: "isolated-project-worktree", recursive: true,
      excludedPaths: [".secrets", "wallet", "credentials"], taskWorktreeRequired: true
    },
    allowedOperations: [...ops],
    executionProfileIds: ["node22-project-tests"],
    gitPolicy: {
      branchPrefix: "agent/", defaultBranchWrite: "deny",
      protectedBranchMerge: "separate-authority", releaseTag: "separate-authority",
      autoPushFeatureBranch: false, autoCreatePullRequest: false
    },
    networkPolicy: { mode: "offline", allowedHttpsHosts: [] },
    resourceBudget: {
      maxConcurrentTasks: 2, maxAttemptsPerTask: 5, maxRuntimeMinutes: 120,
      maxCpuHeavyMinutes: 60, maxMemoryMiB: 4096
    },
    autonomyPolicy: {
      acceptInScopeTasksAutomatically: true, allowAgentCreatedSubtasks: true,
      humanApprovalPerOperation: false, continueIndependentTasksOnBlock: true,
      stopOnTrustFailure: true
    },
    protectedActions: [
      "merge-protected-branch", "release", "production-deploy", "read-secret-material",
      "wallet-signing", "fund-transfer", "cardano-settlement", "change-trust-anchor", "widen-mandate"
    ],
    issuedAt: "2026-11-02T16:30:00.000Z",
    notBefore: "2026-11-02T16:30:00.000Z",
    expiresAt: "2026-11-03T16:30:00.000Z",
    delegable: false,
    operatorConsentDigest: "sha256:" + "0".repeat(64),
    consentIntentDigest: "sha256:" + "0".repeat(64),
    normativeContractBinding: pncBinding,
    ...mandateChanges
  };
  mandateClaims.consentIntentDigest = computeProjectMandateConsentIntentDigest(mandateClaims);
  const receiptClaims = receiptClaimsFor(mandateClaims);
  mandateClaims.operatorConsentDigest = computeProjectMandateConsentReceiptDigest(receiptClaims);
  const mandateDigest = computeProjectMandateClaimsDigest(mandateClaims);
  return {
    claims: mandateClaims,
    mandateDigest,
    issuerId,
    signatureVerified: true,
    consentVerified: true,
    revocationState: "healthy",
    schemaValidationVerified: true,
    trustedConsent: {
      claims: receiptClaims,
      schemaValidationVerified: true,
      signatureVerified: true,
      brokerAuthenticated: true
    },
    trustedNormativeContract: {
      contract: pnc,
      schemaValidationVerified: true,
      sourceIntegrityVerified: true,
      ownerAuthorized: true
    }
  };
}
function host(input) {
  return {
    issuerId, projectRef: input.claims.project.projectRef,
    repositoryRef: input.claims.project.repositoryRef,
    workspaceRef: input.claims.workspace.workspaceRef,
    workerId, runtimeId
  };
}
function policy(input) {
  return {
    ...host(input), allowedOperations: [...ops],
    excludedPaths: [".secrets", "wallet", "credentials"],
    allowedExecutionProfiles: ["node22-project-tests"], allowedHttpsHosts: []
  };
}
function task() {
  return {
    taskId, manifestDigest, requestedOperations: ["workspace.read", "workspace.diff"],
    expiresAt: "2026-11-02T20:00:00.000Z"
  };
}
function derive(input = buildInputs()) {
  return derivePncBoundProjectTaskAuthority({
    trustedMandate: input,
    trustedConsent: input.trustedConsent,
    trustedNormativeContract: input.trustedNormativeContract,
    expectedHost: host(input),
    task: task(),
    now
  });
}
function authorize(child, input = buildInputs(), overrides = {}) {
  return authorizePncBoundProjectOperation({
    childAuthority: child,
    trustedMandate: input,
    trustedConsent: input.trustedConsent,
    trustedNormativeContract: input.trustedNormativeContract,
    hostPolicy: policy(input),
    expectedTaskId: taskId,
    expectedManifestDigest: manifestDigest,
    operation: "workspace.read",
    relativePath: "src/index.mjs",
    now,
    ...overrides
  });
}

test("v0.2 mandate binds active verified PNC to child authority", () => {
  const input = buildInputs();
  const child = derive(input);
  assert.equal(child.authorized, true);
  assert.equal(child.authority.normativeContractBinding.digest, binding.digest);
  const result = authorize(child, input);
  assert.equal(result.allowed, true);
  assert.equal(result.normativeContractDigest, binding.digest);
});

test("intent, receipt and final mandate digests form a non-circular sequence", () => {
  const input = buildInputs();
  assert.equal(computeProjectMandateConsentIntentDigest(input.claims), input.claims.consentIntentDigest);
  assert.equal(computeProjectMandateConsentReceiptDigest(input.trustedConsent.claims), input.claims.operatorConsentDigest);
  assert.equal(computeProjectMandateClaimsDigest(input.claims), input.mandateDigest);
});

test("same child authorizes repeated in-scope operations without per-operation approval", () => {
  const input = buildInputs();
  const child = derive(input);
  for (const operation of ["workspace.read", "workspace.diff"]) {
    const result = authorizePncBoundProjectOperation({
      childAuthority: child, trustedMandate: input, trustedConsent: input.trustedConsent,
      trustedNormativeContract: input.trustedNormativeContract, hostPolicy: policy(input),
      expectedTaskId: taskId, expectedManifestDigest: manifestDigest,
      operation, relativePath: "src/index.mjs", now
    });
    assert.equal(result.allowed, true);
  }
});

test("draft PNC is rejected even when the intent and receipt digest are correct", () => {
  const input = buildInputs({ pnc: source });
  assert.equal(derive(input).reason, "pnc-not-active");
});

test("PNC must be schema-validated, source-verified and owner-authorized by host store", () => {
  const input = buildInputs();
  for (const key of ["schemaValidationVerified", "sourceIntegrityVerified", "ownerAuthorized"]) {
    const bad = { ...input, trustedNormativeContract: { ...input.trustedNormativeContract, [key]: false } };
    assert.equal(derive(bad).reason, "pnc-not-trusted-by-host-store");
  }
});

test("PNC digest mismatch is rejected", () => {
  const input = buildInputs();
  const changed = { ...activePnc, description: activePnc.description + " changed" };
  const bad = { ...input, trustedNormativeContract: { ...input.trustedNormativeContract, contract: changed } };
  assert.equal(derive(bad).reason, "pnc-digest-mismatch");
});

test("PNC project/repository must match the mandate", () => {
  const other = { ...activePnc, project: { ...activePnc.project, projectRef: "other-project" } };
  const input = buildInputs({ pnc: other });
  assert.equal(derive(input).reason, "pnc-project-repository-mismatch");
});

test("PNC baseline cannot change between derivation and operation", () => {
  const input = buildInputs();
  const child = derive(input);
  const changed = { ...activePnc, description: activePnc.description + " changed" };
  const bad = { ...input, trustedNormativeContract: { ...input.trustedNormativeContract, contract: changed } };
  const result = authorize(child, bad);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "pnc-digest-mismatch");
});

test("child PNC binding cannot be substituted", () => {
  const input = buildInputs();
  const child = derive(input);
  const altered = {
    ...child,
    authority: {
      ...child.authority,
      normativeContractBinding: { ...child.authority.normativeContractBinding, digest: "sha256:" + "0".repeat(64) }
    }
  };
  assert.equal(authorize(altered, input).reason, "child-pnc-binding-mismatch");
});

test("v0.1 mandate is not admitted to the v0.2 PNC-bound path", () => {
  const input = buildInputs();
  const legacy = { ...input, claims: { ...input.claims, schemaVersion: "0.1.0" } };
  assert.equal(derive(legacy).reason, "invalid-pnc-bound-mandate-v0.2");
});

test("host mandate digest must cover all final claims", () => {
  const input = buildInputs();
  const tampered = { ...input, claims: { ...input.claims, allowedOperations: ["workspace.read"] } };
  assert.equal(derive(tampered).reason, "invalid-pnc-bound-mandate-v0.2");
});

test("existing operation and workspace policy remains enforced", () => {
  const input = buildInputs();
  const child = derive(input);
  assert.equal(authorize(child, input, { relativePath: "../outside" }).allowed, false);
  const blocked = { ...policy(input), allowedOperations: ["workspace.diff"] };
  assert.equal(authorize(child, input, { hostPolicy: blocked }).reason, "operation-not-allowed-by-host-policy");
});

test("consent receipt must bind the same PNC tuple and canonical intent", () => {
  const input = buildInputs();
  const child = derive(input);
  const badClaims = {
    ...input.trustedConsent.claims,
    normativeContractBinding: { ...binding, digest: "sha256:" + "9".repeat(64) }
  };
  const bad = { ...input, trustedConsent: { ...input.trustedConsent, claims: badClaims } };
  assert.equal(authorize(child, bad).reason, "project-mandate-consent-binding-mismatch");
});

test("missing, unverified or expired consent cannot authorize an operation", () => {
  const input = buildInputs();
  const child = derive(input);
  assert.equal(authorize(child, { ...input, trustedConsent: null }).reason, "project-mandate-consent-not-trusted");
  assert.equal(authorize(child, {
    ...input,
    trustedConsent: { ...input.trustedConsent, signatureVerified: false }
  }).reason, "project-mandate-consent-not-trusted");
  const expired = {
    ...input.trustedConsent,
    claims: { ...input.trustedConsent.claims, expiresAt: "2026-11-02T16:59:59.000Z" }
  };
  assert.equal(authorize(child, { ...input, trustedConsent: expired }).reason,
    "project-mandate-consent-expired-or-not-yet-valid");
});

test("mismatched displayed challenge is rejected", () => {
  const input = buildInputs();
  const child = derive(input);
  const altered = {
    ...input.trustedConsent,
    claims: { ...input.trustedConsent.claims, confirmedChallenge: "00000000" }
  };
  assert.equal(authorize(child, { ...input, trustedConsent: altered }).reason,
    "project-mandate-consent-binding-mismatch");
});
