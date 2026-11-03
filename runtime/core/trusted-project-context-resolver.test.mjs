import test from "node:test";
import assert from "node:assert/strict";

import {
  createTrustedProjectResolver
} from "./trusted-project-context-resolver.mjs";

const NOW = "2026-11-03T12:00:00.000Z";
const PROJECT_REF = "project:cormia-demo";
const REPOSITORY_REF = "LiberoNuvola/Cormia";
const WORKSPACE_REF = "workspace:cormia-demo";
const ISSUER_ID = "local-host:operator-1";
const WORKER_ID = "worker:cormia-local";
const RUNTIME_ID = "runtime:cormia-core";
const MANDATE_ID = "11111111-1111-4111-8111-111111111111";
const CONSENT_ID = "22222222-2222-4222-8222-222222222222";
const INTERACTION_ID = "33333333-3333-4333-8333-333333333333";
const NONCE = "44444444-4444-4444-8444-444444444444";
const MANDATE_DIGEST = "sha256:" + "b".repeat(64);
const CONSENT_DIGEST = "sha256:" + "c".repeat(64);
const MANIFEST_DIGEST = "sha256:" + "a".repeat(64);

const OPERATIONS = [
  "workspace.list", "workspace.read", "workspace.diff", "workspace.verify",
  "workspace.create", "workspace.replace", "workspace.patch", "workspace.test",
  "workspace.build", "git.branch.create", "git.commit.local",
  "git.push.feature-branch", "github.pull-request.create", "github.pull-request.update"
];

function mandateClaims(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    mandateId: MANDATE_ID,
    issuerId: ISSUER_ID,
    operatorPrincipalId: "os-principal:operator-1",
    subject: { workerId: WORKER_ID, runtimeId: RUNTIME_ID },
    project: { projectRef: PROJECT_REF, repositoryRef: REPOSITORY_REF, baseRef: "main" },
    workspace: {
      workspaceRef: WORKSPACE_REF,
      scopeMode: "isolated-project-worktree",
      recursive: true,
      excludedPaths: [".secrets", "wallet", "credentials"],
      taskWorktreeRequired: true
    },
    allowedOperations: [...OPERATIONS],
    executionProfileIds: ["node22-project-tests", "node22-build"],
    gitPolicy: {
      branchPrefix: "agent/",
      defaultBranchWrite: "deny",
      protectedBranchMerge: "separate-authority",
      releaseTag: "separate-authority",
      autoPushFeatureBranch: true,
      autoCreatePullRequest: true
    },
    networkPolicy: {
      mode: "https-allowlist",
      allowedHttpsHosts: ["api.github.com"]
    },
    resourceBudget: {
      maxConcurrentTasks: 2,
      maxAttemptsPerTask: 5,
      maxRuntimeMinutes: 240,
      maxCpuHeavyMinutes: 90,
      maxMemoryMiB: 8192
    },
    autonomyPolicy: {
      acceptInScopeTasksAutomatically: true,
      allowAgentCreatedSubtasks: true,
      humanApprovalPerOperation: false,
      continueIndependentTasksOnBlock: true,
      stopOnTrustFailure: true
    },
    protectedActions: [
      "merge-protected-branch", "release", "production-deploy",
      "read-secret-material", "wallet-signing", "fund-transfer",
      "cardano-settlement", "change-trust-anchor", "widen-mandate"
    ],
    issuedAt: "2026-11-03T11:00:00.000Z",
    notBefore: "2026-11-03T11:00:00.000Z",
    expiresAt: "2026-11-04T11:00:00.000Z",
    delegable: false,
    operatorConsentDigest: CONSENT_DIGEST,
    ...overrides
  };
}

function descriptor(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    recordType: "cormia.core.project-descriptor",
    projectRef: PROJECT_REF,
    displayName: "Cormia Demo",
    leadershipMode: "agent_led",
    stewardRef: "principal:steward-1",
    accountabilityRef: "accountability:project-board-1",
    mandateRef: {
      mandateId: MANDATE_ID,
      claimsSchemaId: "urn:immortal-aep:schema:local-autonomous-project-mandate:0.1.0",
      claimsDigest: MANDATE_DIGEST
    },
    createdAt: "2026-11-03T10:00:00.000Z",
    updatedAt: "2026-11-03T11:30:00.000Z",
    revision: 1,
    ...overrides
  };
}

function consentClaims(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    consentId: CONSENT_ID,
    issuerId: ISSUER_ID,
    operatorPrincipalId: "os-principal:operator-1",
    consentBrokerId: "local-consent-broker:windows",
    mandateId: MANDATE_ID,
    mandateDigest: MANDATE_DIGEST,
    projectRef: PROJECT_REF,
    workspaceRef: WORKSPACE_REF,
    decision: "approve",
    interactionMode: "local-interactive-project-mandate",
    interactionId: INTERACTION_ID,
    displayedChallenge: MANDATE_DIGEST.slice(-8),
    confirmedChallenge: MANDATE_DIGEST.slice(-8),
    issuedAt: "2026-11-03T11:55:00.000Z",
    expiresAt: "2026-11-03T12:05:00.000Z",
    nonce: NONCE,
    sequence: 1,
    ...overrides
  };
}

function projectTask(overrides = {}) {
  return {
    taskId: "TASK-CORMIA-001",
    manifestDigest: MANIFEST_DIGEST,
    requestedOperations: ["workspace.read", "workspace.create", "workspace.test"],
    expiresAt: "2026-11-03T13:00:00.000Z",
    ...overrides
  };
}

function hostPolicy(overrides = {}) {
  return {
    issuerId: ISSUER_ID,
    projectRef: PROJECT_REF,
    repositoryRef: REPOSITORY_REF,
    workspaceRef: WORKSPACE_REF,
    workerId: WORKER_ID,
    runtimeId: RUNTIME_ID,
    allowedOperations: [...OPERATIONS],
    excludedPaths: [".secrets", "wallet", "credentials"],
    allowedExecutionProfiles: ["node22-project-tests", "node22-build"],
    allowedHttpsHosts: ["api.github.com"],
    ...overrides
  };
}

function harness(overrides = {}) {
  const state = {
    descriptor: descriptor(),
    claims: mandateClaims(),
    claimsDigest: MANDATE_DIGEST,
    steward: { status: "verified", principalRef: "principal:steward-1", principalType: "human" },
    accountability: {
      status: "verified",
      arrangementRef: "accountability:project-board-1",
      accountablePrincipalRefs: ["principal:steward-1"]
    },
    operator: {
      status: "authorized",
      operatorPrincipalId: "os-principal:operator-1",
      accountabilityRef: "accountability:project-board-1"
    },
    mandateVerificationStatus: "verified",
    keyStatus: "active",
    mandateStatus: "active",
    consentVerificationStatus: "verified",
    consentReceiptStatus: "active",
    consentReplayStatus: "valid",
    receiptDigest: CONSENT_DIGEST,
    consent: consentClaims(),
    revocationStatus: "HEALTHY",
    mandateRevocationState: "active",
    anchorProviderId: "host-monotonic-anchor-v0",
    anchorSequence: 2,
    anchorDigest: "sha256:" + "d".repeat(64),
    lifecycle: { projectRef: PROJECT_REF, state: "active", revision: 3 },
    policy: hostPolicy(),
    now: NOW,
    calls: []
  };
  Object.assign(state, overrides);

  const resolver = createTrustedProjectResolver({
    hostContext: {
      issuerId: ISSUER_ID,
      projectRef: PROJECT_REF,
      repositoryRef: REPOSITORY_REF,
      workspaceRef: WORKSPACE_REF,
      workerId: WORKER_ID,
      runtimeId: RUNTIME_ID
    },
    projectStore: {
      async readProjectDescriptor(projectRef) {
        state.calls.push(["descriptor", projectRef]);
        return state.descriptor;
      }
    },
    identityProvider: {
      async resolveSteward(ref) {
        state.calls.push(["steward", ref]);
        return state.steward;
      },
      async resolveAccountability(ref) {
        state.calls.push(["accountability", ref]);
        return state.accountability;
      },
      async authorizeMandateOperator(input) {
        state.calls.push(["operator", input.operatorPrincipalId]);
        return state.operator;
      }
    },
    mandateAuthority: {
      async verifyAndLoad(input) {
        state.calls.push(["mandate", input.mandateId]);
        return {
          verificationStatus: state.mandateVerificationStatus,
          keyStatus: state.keyStatus,
          mandateStatus: state.mandateStatus,
          issuerId: ISSUER_ID,
          claimsDigest: state.claimsDigest,
          claims: state.claims
        };
      }
    },
    consentAuthority: {
      async verifyActiveReceipt(input) {
        state.calls.push(["consent", input.consentDigest]);
        return {
          verificationStatus: state.consentVerificationStatus,
          receiptStatus: state.consentReceiptStatus,
          replayStatus: state.consentReplayStatus,
          receiptDigest: state.receiptDigest,
          claims: state.consent
        };
      }
    },
    revocationAuthority: {
      async reconcileMandate(input) {
        state.calls.push(["revocation", input.mandateId]);
        return {
          status: state.revocationStatus,
          mandateState: state.mandateRevocationState,
          anchorProviderId: state.anchorProviderId,
          sequence: state.anchorSequence,
          headEventDigest: state.anchorDigest
        };
      }
    },
    hostPolicyProvider: {
      async readPolicy() {
        state.calls.push(["host-policy"]);
        return state.policy;
      }
    },
    projectLifecycleJournal: {
      async read() {
        state.calls.push(["lifecycle"]);
        return state.lifecycle;
      }
    },
    clock: () => state.now
  });

  return { resolver, state };
}

test("resolver composes host identity, ADR-0010 mandate, consent, revocation and project lifecycle", async () => {
  const { resolver, state } = harness();
  const result = await resolver.resolve();
  assert.equal(result.resolved, true);
  assert.equal(result.status, "TRUSTED_PROJECT_CONTEXT_RESOLVED");
  assert.equal(result.project.lifecycleState, "active");
  assert.equal(result.project.executionReady, true);
  assert.equal(result.authority.mandateId, MANDATE_ID);
  assert.equal(result.identity.stewardPrincipalType, "human");
  assert.equal(result.revocation.status, "HEALTHY");
  assert.equal("trustedMandate" in result, false);
  assert.equal("claims" in result, false);
  assert.deepEqual(state.calls.map(call => call[0]), [
    "descriptor", "steward", "accountability", "mandate",
    "operator", "consent", "revocation", "lifecycle"
  ]);
});

test("task session derives existing ADR-0010 child authority with no human approval callback", async () => {
  const { resolver } = harness();
  const session = await resolver.createTaskSession(projectTask());
  assert.equal(session.authorized, true);
  assert.match(session.childDigest, /^sha256:[a-f0-9]{64}$/);

  const read = await session.authorizeOperation({
    operation: "workspace.read",
    relativePath: "src/index.mjs"
  });
  const create = await session.authorizeOperation({
    operation: "workspace.create",
    relativePath: "src/new-module.mjs"
  });
  const testRun = await session.authorizeOperation({
    operation: "workspace.test",
    executionProfileId: "node22-project-tests"
  });
  for (const result of [read, create, testRun]) {
    assert.equal(result.allowed, true, result.reason);
    assert.equal(result.reason, "authorized-by-standing-project-mandate");
  }
});

test("every operation re-resolves mandate, consent, revocation and host policy", async () => {
  const { resolver, state } = harness();
  const session = await resolver.createTaskSession(projectTask());
  assert.equal(session.authorized, true);
  state.revocationStatus = "ANCHOR_UNAVAILABLE";
  const denied = await session.authorizeOperation({
    operation: "workspace.read",
    relativePath: "src/index.mjs"
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "PROJECT_MANDATE_REVOCATION_UNHEALTHY");
  assert.equal(state.calls.filter(call => call[0] === "revocation").length, 2);
});

test("an operation is denied if the project is paused after task-session creation", async () => {
  const { resolver, state } = harness();
  const session = await resolver.createTaskSession(projectTask());
  state.lifecycle = { projectRef: PROJECT_REF, state: "paused", revision: 4 };
  const result = await session.authorizeOperation({
    operation: "workspace.read",
    relativePath: "src/index.mjs"
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "PROJECT_NOT_ACTIVE");
});

test("an operation is denied when mandate expiry passes after task-session creation", async () => {
  const { resolver, state } = harness();
  const session = await resolver.createTaskSession(projectTask());
  state.now = "2026-11-05T12:00:00.000Z";
  const result = await session.authorizeOperation({
    operation: "workspace.read",
    relativePath: "src/index.mjs"
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "PROJECT_MANDATE_EXPIRED");
});

test("blocks an unsigned mandate, inactive key or inactive mandate", async t => {
  for (const change of [
    { mandateVerificationStatus: "invalid" },
    { keyStatus: "revoked" },
    { mandateStatus: "suspended" }
  ]) {
    const { resolver } = harness(change);
    const result = await resolver.resolve();
    assert.equal(result.resolved, false);
    assert.equal(result.status, "BLOCKED");
    assert.equal(result.reason, "PROJECT_MANDATE_UNTRUSTED");
  }
});

test("blocks a descriptor digest mismatch instead of trusting the descriptor", async () => {
  const { resolver } = harness({
    descriptor: descriptor({
      mandateRef: {
        mandateId: MANDATE_ID,
        claimsSchemaId: "urn:immortal-aep:schema:local-autonomous-project-mandate:0.1.0",
        claimsDigest: "sha256:" + "f".repeat(64)
      }
    })
  });
  const result = await resolver.resolve();
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "PROJECT_MANDATE_UNTRUSTED");
});

test("blocks wrong repository, workspace, worker or Runtime bindings", async t => {
  for (const claims of [
    mandateClaims({ project: { projectRef: PROJECT_REF, repositoryRef: "other/repo", baseRef: "main" } }),
    mandateClaims({ workspace: { ...mandateClaims().workspace, workspaceRef: "other-workspace" } }),
    mandateClaims({ subject: { workerId: "other-worker", runtimeId: RUNTIME_ID } }),
    mandateClaims({ subject: { workerId: WORKER_ID, runtimeId: "other-runtime" } })
  ]) {
    const { resolver } = harness({ claims });
    const result = await resolver.resolve();
    assert.equal(result.resolved, false);
    assert.equal(result.reason, "PROJECT_MANDATE_BINDING_MISMATCH");
  }
});

test("steward identity must resolve to a human or organization through the trusted identity port", async () => {
  const { resolver } = harness({
    steward: { status: "unverified", principalRef: "principal:steward-1", principalType: "human" }
  });
  const result = await resolver.resolve();
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "PROJECT_STEWARD_UNRESOLVED");
});

test("community stewardship remains unsupported until its identity semantics are defined", async () => {
  const { resolver } = harness({
    steward: { status: "verified", principalRef: "principal:steward-1", principalType: "community_stewardship_body" }
  });
  const result = await resolver.resolve();
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "PROJECT_STEWARD_UNRESOLVED");
});

test("accountability arrangement must include the declared steward", async () => {
  const { resolver } = harness({
    accountability: {
      status: "verified",
      arrangementRef: "accountability:project-board-1",
      accountablePrincipalRefs: ["principal:another-person"]
    }
  });
  const result = await resolver.resolve();
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "PROJECT_ACCOUNTABILITY_UNRESOLVED");
});

test("mandate operator must be authorized by the resolved accountability arrangement", async () => {
  const { resolver } = harness({
    operator: {
      status: "denied",
      operatorPrincipalId: "os-principal:operator-1",
      accountabilityRef: "accountability:project-board-1"
    }
  });
  const result = await resolver.resolve();
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "PROJECT_MANDATE_OPERATOR_UNAUTHORIZED");
});

test("consent must be signed, active, approved, unexpired, digest-bound and challenge-matched", async t => {
  const variants = [
    { consentVerificationStatus: "invalid" },
    { consentReceiptStatus: "revoked" },
    { consentReplayStatus: "replayed" },
    { consent: consentClaims({ decision: "deny" }) },
    { consent: consentClaims({ confirmedChallenge: "00000000" }) },
    { consent: consentClaims({ mandateDigest: "sha256:" + "f".repeat(64) }) }
  ];
  for (const change of variants) {
    const { resolver } = harness(change);
    const result = await resolver.resolve();
    assert.equal(result.resolved, false);
    assert.ok([
      "PROJECT_CONSENT_UNTRUSTED",
      "PROJECT_CONSENT_BINDING_MISMATCH"
    ].includes(result.reason), result.reason);
  }
});

test("consent receipt digest must equal the mandate's operatorConsentDigest", async () => {
  const { resolver } = harness({ receiptDigest: "sha256:" + "e".repeat(64) });
  const result = await resolver.resolve();
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "PROJECT_CONSENT_UNTRUSTED");
});

test("mandate revocation/anchor failure blocks the whole trusted context", async () => {
  const { resolver } = harness({
    revocationStatus: "ROLLBACK",
    mandateRevocationState: "active"
  });
  const result = await resolver.resolve();
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "PROJECT_MANDATE_REVOCATION_UNHEALTHY");
});

test("project lifecycle is kept separate and must be active before autonomous task execution", async () => {
  const { resolver } = harness({
    lifecycle: { projectRef: PROJECT_REF, state: "configured", revision: 2 }
  });
  const result = await resolver.resolve();
  assert.equal(result.resolved, true);
  assert.equal(result.project.activationEligible, true);
  assert.equal(result.project.executionReady, false);
  const session = await resolver.createTaskSession(projectTask());
  assert.equal(session.authorized, false);
  assert.equal(session.reason, "PROJECT_NOT_ACTIVE");
});

test("host policy remains an upper bound and is re-read before each operation", async () => {
  const { resolver, state } = harness();
  const session = await resolver.createTaskSession(projectTask());
  state.policy = hostPolicy({ allowedOperations: ["workspace.read"] });
  const result = await session.authorizeOperation({
    operation: "workspace.create",
    relativePath: "src/new-module.mjs"
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "operation-not-allowed-by-host-policy");
});

test("malformed host policy and wrong project lifecycle binding block resolution", async t => {
  const wrongPolicy = harness({ policy: hostPolicy({ projectRef: "other-project" }) });
  const session = await wrongPolicy.resolver.createTaskSession(projectTask());
  assert.equal(session.authorized, true);
  const denied = await session.authorizeOperation({
    operation: "workspace.read",
    relativePath: "src/index.mjs"
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "PROJECT_HOST_POLICY_BINDING_MISMATCH");

  const wrongJournal = harness({
    lifecycle: { projectRef: "other-project", state: "active", revision: 3 }
  });
  const result = await wrongJournal.resolver.resolve();
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "PROJECT_LIFECYCLE_PROJECTION_INVALID");
});

test("task outside the mandate is rejected before a task session is created", async () => {
  const { resolver } = harness();
  const session = await resolver.createTaskSession(projectTask({
    requestedOperations: ["workspace.read", "production.deploy"]
  }));
  assert.equal(session.authorized, false);
  assert.equal(session.reason, "task-request-exceeds-project-mandate");
});

test("provider exceptions fail closed without leaking provider exception text", async () => {
  const { resolver } = harness();
  const broken = createTrustedProjectResolver({
    hostContext: {
      issuerId: ISSUER_ID,
      projectRef: PROJECT_REF,
      repositoryRef: REPOSITORY_REF,
      workspaceRef: WORKSPACE_REF,
      workerId: WORKER_ID,
      runtimeId: RUNTIME_ID
    },
    projectStore: { async readProjectDescriptor() { throw new Error("private provider detail"); } },
    identityProvider: {
      async resolveSteward() { return {}; },
      async resolveAccountability() { return {}; },
      async authorizeMandateOperator() { return {}; }
    },
    mandateAuthority: { async verifyAndLoad() { return {}; } },
    consentAuthority: { async verifyActiveReceipt() { return {}; } },
    revocationAuthority: { async reconcileMandate() { return {}; } },
    hostPolicyProvider: { async readPolicy() { return {}; } },
    projectLifecycleJournal: { async read() { return {}; } },
    clock: () => NOW
  });
  const result = await broken.resolve();
  assert.equal(result.resolved, false);
  assert.equal(result.reason, "PROJECT_RESOLUTION_PROVIDER_FAILURE");
  assert.equal(JSON.stringify(result).includes("private provider detail"), false);
  assert.ok(resolver);
});

test("resolver refuses construction without every trusted provider boundary", () => {
  assert.throws(
    () => createTrustedProjectResolver({ hostContext: {} }),
    /hostContext/
  );
});
