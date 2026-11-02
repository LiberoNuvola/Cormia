import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { computePncContractDigest } from "./pnc-contract-identity.mjs";
import { authorizePncBoundProjectOperation, derivePncBoundProjectTaskAuthority } from "./pnc-bound-project-authority.mjs";

const source = JSON.parse(readFileSync(new URL("../../examples/project-normative-contracts/immortal-protocol-v0.1.json", import.meta.url), "utf8"));
const activePnc = { ...source, status: "active" }; // synthetic test value; the repository fixture remains draft
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
const mandateDigest = "sha256:" + "b".repeat(64);
const taskId = "TASK-20261102-PNC-BOUND-001";
const manifestDigest = "sha256:" + "a".repeat(64);
const ops = ["workspace.read", "workspace.diff", "workspace.test"];

function claims(overrides = {}) {
  return {
    schemaVersion: "0.2.0",
    mandateId: "11111111-1111-4111-8111-111111111111",
    issuerId,
    operatorPrincipalId: "os-principal:operator-1",
    subject: { workerId, runtimeId },
    project: { projectRef, repositoryRef, baseRef: "main" },
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
    operatorConsentDigest: "sha256:" + "c".repeat(64),
    normativeContractBinding: { ...binding },
    ...overrides
  };
}
function mandate(overrides = {}) {
  return {
    claims: claims(), mandateDigest, issuerId, signatureVerified: true,
    consentVerified: true, revocationState: "healthy", schemaValidationVerified: true,
    ...overrides
  };
}
function pnc(overrides = {}) {
  return {
    contract: activePnc, schemaValidationVerified: true,
    sourceIntegrityVerified: true, ownerAuthorized: true, ...overrides
  };
}
function host() {
  return { issuerId, projectRef, repositoryRef, workspaceRef, workerId, runtimeId };
}
function hostPolicy() {
  return {
    ...host(), allowedOperations: [...ops], excludedPaths: [".secrets", "wallet", "credentials"],
    allowedExecutionProfiles: ["node22-project-tests"], allowedHttpsHosts: []
  };
}
function task() {
  return {
    taskId, manifestDigest, requestedOperations: ["workspace.read", "workspace.diff"],
    expiresAt: "2026-11-02T20:00:00.000Z"
  };
}
function derive(overrides = {}) {
  return derivePncBoundProjectTaskAuthority({
    trustedMandate: mandate(), trustedNormativeContract: pnc(),
    expectedHost: host(), task: task(), now, ...overrides
  });
}
function authorize(child, overrides = {}) {
  return authorizePncBoundProjectOperation({
    childAuthority: child, trustedMandate: mandate(), trustedNormativeContract: pnc(),
    hostPolicy: hostPolicy(), expectedTaskId: taskId, expectedManifestDigest: manifestDigest,
    operation: "workspace.read", relativePath: "src/index.mjs", now, ...overrides
  });
}

test("v0.2 mandate binds active verified PNC to child authority", () => {
  const child = derive();
  assert.equal(child.authorized, true);
  assert.equal(child.authority.normativeContractBinding.digest, binding.digest);
  const result = authorize(child);
  assert.equal(result.allowed, true);
  assert.equal(result.normativeContractDigest, binding.digest);
});

test("same child authorizes repeated in-scope operations without per-operation approval", () => {
  const child = derive();
  for (const operation of ["workspace.read", "workspace.diff"]) {
    const result = authorizePncBoundProjectOperation({
      childAuthority: child, trustedMandate: mandate(), trustedNormativeContract: pnc(),
      hostPolicy: hostPolicy(), expectedTaskId: taskId, expectedManifestDigest: manifestDigest,
      operation, relativePath: "src/index.mjs", now
    });
    assert.equal(result.allowed, true);
  }
});

test("draft PNC is rejected even when its identity digest is correct", () => {
  const draftBinding = { ...binding, digest: computePncContractDigest(source).digest };
  const result = derive({
    trustedMandate: mandate({ claims: claims({ normativeContractBinding: draftBinding }) }),
    trustedNormativeContract: pnc({ contract: source })
  });
  assert.equal(result.reason, "pnc-not-active");
});

test("PNC must be schema-validated, source-verified and owner-authorized by host store", () => {
  for (const change of [
    { schemaValidationVerified: false },
    { sourceIntegrityVerified: false },
    { ownerAuthorized: false }
  ]) {
    const result = derive({ trustedNormativeContract: pnc(change) });
    assert.equal(result.authorized, false);
    assert.equal(result.reason, "pnc-not-trusted-by-host-store");
  }
});

test("digest mismatch is rejected", () => {
  const badBinding = { ...binding, digest: "sha256:" + "f".repeat(64) };
  const result = derive({
    trustedMandate: mandate({ claims: claims({ normativeContractBinding: badBinding }) })
  });
  assert.equal(result.reason, "pnc-digest-mismatch");
});

test("PNC project/repository must match the mandate", () => {
  const other = { ...activePnc, project: { ...activePnc.project, projectRef: "other-project" } };
  const otherDigest = computePncContractDigest(other).digest;
  const otherBinding = { ...binding, digest: otherDigest };
  const result = derive({
    trustedMandate: mandate({ claims: claims({ normativeContractBinding: otherBinding }) }),
    trustedNormativeContract: pnc({ contract: other })
  });
  assert.equal(result.reason, "pnc-project-repository-mismatch");
});

test("PNC baseline cannot change between derivation and operation", () => {
  const child = derive();
  const changed = { ...activePnc, description: activePnc.description + " changed" };
  const result = authorize(child, { trustedNormativeContract: pnc({ contract: changed }) });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "pnc-digest-mismatch");
});

test("child PNC binding cannot be substituted", () => {
  const child = derive();
  const altered = {
    ...child,
    authority: {
      ...child.authority,
      normativeContractBinding: { ...child.authority.normativeContractBinding, digest: "sha256:" + "0".repeat(64) }
    }
  };
  assert.equal(authorize(altered).reason, "child-pnc-binding-mismatch");
});

test("v0.1 mandate is not admitted to the v0.2 PNC-bound path", () => {
  const legacy = mandate({ claims: { ...claims(), schemaVersion: "0.1.0" } });
  assert.equal(derive({ trustedMandate: legacy }).reason, "invalid-pnc-bound-mandate-v0.2");
});

test("existing operation and workspace policy remains enforced", () => {
  const child = derive();
  assert.equal(authorize(child, { relativePath: "../outside" }).allowed, false);
  const result = authorize(child, { hostPolicy: { ...hostPolicy(), allowedOperations: ["workspace.diff"] } });
  assert.equal(result.reason, "operation-not-allowed-by-host-policy");
});
