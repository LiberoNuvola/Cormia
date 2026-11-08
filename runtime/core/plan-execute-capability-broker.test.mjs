import test from "node:test";
import assert from "node:assert/strict";

import { createTrustedProjectResolver } from "./trusted-project-context-resolver.mjs";
import {
  createPlanExecuteCapabilityBroker,
  PLAN_PROPOSAL_CONTRACT_VERSION
} from "./plan-execute-capability-broker.mjs";

const NOW = "2026-11-08T05:00:00.000Z";
const PROJECT_REF = "project:cormia-broker-test";
const REPOSITORY_REF = "LiberoNuvola/Cormia";
const WORKSPACE_REF = "workspace:cormia-broker-test";
const ISSUER_ID = "local-host:broker-test";
const WORKER_ID = "worker:cormia-broker-test";
const RUNTIME_ID = "runtime:cormia-core-test";
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

function mandateClaims() {
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
    protectedActions: ["merge-protected-branch", "release", "production-deploy", "wallet-signing"],
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
    executionProfileIds: ["node22-project-tests", "node22-build"],
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
    issuedAt: "2026-11-08T04:00:00.000Z",
    notBefore: "2026-11-08T04:00:00.000Z",
    expiresAt: "2026-11-09T04:00:00.000Z",
    delegable: false,
    operatorConsentDigest: CONSENT_DIGEST
  };
}

function descriptor() {
  return {
    schemaVersion: "0.1.0",
    recordType: "cormia.core.project-descriptor",
    projectRef: PROJECT_REF,
    displayName: "Cormia Broker Test",
    leadershipMode: "agent_led",
    stewardRef: "principal:steward-1",
    accountabilityRef: "accountability:board-1",
    mandateRef: {
      mandateId: MANDATE_ID,
      claimsSchemaId: "urn:immortal-aep:schema:local-autonomous-project-mandate:0.1.0",
      claimsDigest: MANDATE_DIGEST
    },
    createdAt: "2026-11-08T03:00:00.000Z",
    updatedAt: "2026-11-08T04:30:00.000Z",
    revision: 1
  };
}

function consentClaims() {
  return {
    schemaVersion: "0.1.0",
    consentId: CONSENT_ID,
    issuerId: ISSUER_ID,
    operatorPrincipalId: "os-principal:operator-1",
    consentBrokerId: "local-consent-broker:test",
    mandateId: MANDATE_ID,
    mandateDigest: MANDATE_DIGEST,
    projectRef: PROJECT_REF,
    workspaceRef: WORKSPACE_REF,
    decision: "approve",
    interactionMode: "local-interactive-project-mandate",
    interactionId: INTERACTION_ID,
    displayedChallenge: MANDATE_DIGEST.slice(-8),
    confirmedChallenge: MANDATE_DIGEST.slice(-8),
    issuedAt: "2026-11-08T04:45:00.000Z",
    expiresAt: "2026-11-08T05:15:00.000Z",
    nonce: NONCE,
    sequence: 1
  };
}

function taskProjection(overrides = {}) {
  return {
    taskId: "task:broker-test-1",
    manifestDigest: MANIFEST_DIGEST,
    requestedOperations: ["workspace.read", "workspace.create", "workspace.test"],
    expiresAt: "2026-11-08T06:00:00.000Z",
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

function proposal(steps) {
  return {
    contractVersion: PLAN_PROPOSAL_CONTRACT_VERSION,
    steps
  };
}

function readStep(overrides = {}) {
  return {
    operation: "workspace.read",
    relativePath: "src/index.mjs",
    input: { view: "text" },
    ...overrides
  };
}

function makeTrustedResolver(state) {
  const claims = mandateClaims();
  return createTrustedProjectResolver({
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
        assert.equal(projectRef, PROJECT_REF);
        return descriptor();
      }
    },
    identityProvider: {
      async resolveSteward(ref) {
        assert.equal(ref, "principal:steward-1");
        return {
          status: "verified",
          principalStatus: "active",
          principalRef: ref,
          principalType: "human"
        };
      },
      async resolveAccountability(ref) {
        assert.equal(ref, "accountability:board-1");
        return {
          status: "verified",
          arrangementStatus: "active",
          arrangementRef: ref,
          accountablePrincipalRefs: ["principal:steward-1"]
        };
      },
      async authorizeMandateOperator(input) {
        assert.equal(input.accountabilityRef, "accountability:board-1");
        return {
          status: "authorized",
          operatorIdentityStatus: "authenticated",
          operatorPrincipalId: "os-principal:operator-1",
          accountabilityRef: "accountability:board-1"
        };
      }
    },
    mandateAuthority: {
      async verifyAndLoad() {
        return {
          verificationStatus: "verified",
          keyStatus: "active",
          mandateStatus: "active",
          issuerId: ISSUER_ID,
          claimsDigest: MANDATE_DIGEST,
          claims
        };
      }
    },
    consentAuthority: {
      async verifyActiveReceipt() {
        return {
          verificationStatus: "verified",
          receiptStatus: "active",
          replayStatus: "valid",
          receiptDigest: CONSENT_DIGEST,
          claims: consentClaims()
        };
      }
    },
    revocationAuthority: {
      async reconcileMandate() {
        return {
          status: state.revocationStatus,
          issuerId: ISSUER_ID,
          mandateId: MANDATE_ID,
          mandateDigest: MANDATE_DIGEST,
          mandateState: state.mandateState,
          anchorProviderId: "host-monotonic-anchor-test",
          sequence: state.anchorSequence,
          headEventDigest: null
        };
      }
    },
    hostPolicyProvider: {
      async readPolicy() {
        return state.policy;
      }
    },
    projectLifecycleJournal: {
      async read() {
        return state.lifecycle;
      }
    },
    clock: () => state.now
  });
}

function fixture({
  task = taskProjection(),
  requirement = { required: false },
  resourceProvider,
  adapterOverrides = {},
  idFactory = (() => {
    let counter = 0;
    return () => "plan:broker-test:" + (++counter);
  })()
} = {}) {
  const state = {
    now: NOW,
    revocationStatus: "HEALTHY",
    mandateState: "active",
    anchorSequence: 1,
    lifecycle: { projectRef: PROJECT_REF, state: "active", revision: 4 },
    policy: hostPolicy(),
    requirement,
    loadedTaskRefs: [],
    dispatches: [],
    inputValidations: []
  };

  const resolver = makeTrustedResolver(state);
  const taskAuthorityProvider = {
    async loadVerifiedTask(taskRef) {
      state.loadedTaskRefs.push(taskRef);
      return task;
    }
  };
  const resourceAdmissionProvider = {
    async resolveRequirement(input) {
      assert.equal(input.taskRef, task.taskId);
      return state.requirement;
    }
  };
  const defaultAdapter = {
    validateInput(input, context) {
      state.inputValidations.push({ input, context });
      return input;
    },
    async execute(context) {
      state.dispatches.push(context);
      return { ok: true, operation: context.operation };
    }
  };
  const operationAdapters = {
    "workspace.read": defaultAdapter,
    "workspace.create": defaultAdapter,
    "workspace.test": defaultAdapter,
    "workspace.patch": defaultAdapter,
    "wallet.sign": defaultAdapter,
    ...adapterOverrides
  };

  const broker = createPlanExecuteCapabilityBroker({
    trustedProjectResolver: resolver,
    taskAuthorityProvider,
    resourceAdmissionProvider,
    resourceProvider,
    operationAdapters,
    clock: () => state.now,
    idFactory
  });

  return { broker, state };
}

test("PLAN validates an inert proposal without dispatch; EXECUTE dispatches only through the host adapter", async () => {
  const { broker, state } = fixture();
  const prepared = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([readStep()])
  });

  assert.equal(prepared.accepted, true);
  assert.equal(prepared.state, "READY");
  assert.equal(prepared.stepCount, 1);
  assert.equal(state.dispatches.length, 0);
  assert.equal(broker.getPlanStatus(prepared.planRef).state, "READY");

  const executed = await broker.executePlan({
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest
  });
  assert.equal(executed.executed, true);
  assert.equal(executed.state, "COMPLETED");
  assert.equal(executed.completedStepCount, 1);
  assert.equal(state.dispatches.length, 1);
  assert.equal(state.dispatches[0].operation, "workspace.read");
  assert.equal(state.dispatches[0].authorization.allowed, true);
  assert.equal(state.dispatches[0].taskRef, "task:broker-test-1");
  assert.equal(broker.getPlanStatus(prepared.planRef).state, "COMPLETED");
});

test("model proposal for a protected operation is denied with zero dispatches", async () => {
  const { broker, state } = fixture();
  const result = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([{
      operation: "wallet.sign",
      input: { wallet: "default" }
    }])
  });
  assert.equal(result.accepted, false);
  assert.equal(result.state, "BLOCKED");
  assert.equal(result.reason, "operation-not-in-derived-authority");
  assert.equal(state.dispatches.length, 0);
});

test("task-request intersection denies an operation outside the verified task scope", async () => {
  const { broker, state } = fixture();
  const result = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([{
      operation: "workspace.patch",
      relativePath: "src/index.mjs",
      input: { patch: "untrusted patch data" }
    }])
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "operation-not-in-derived-authority");
  assert.equal(state.dispatches.length, 0);
});

test("path traversal is denied before a plan can become READY", async () => {
  const { broker, state } = fixture();
  const result = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([readStep({ relativePath: "../../.secrets" })])
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "invalid-workspace-relative-path");
  assert.equal(state.dispatches.length, 0);
});

test("mandate revocation and lifecycle are rechecked after PLAN and before dispatch", async () => {
  for (const change of [
    state => { state.revocationStatus = "ANCHOR_UNAVAILABLE"; },
    state => { state.lifecycle = { projectRef: PROJECT_REF, state: "paused", revision: 5 }; },
    state => { state.mandateState = "revoked"; }
  ]) {
    const { broker, state } = fixture();
    const prepared = await broker.preparePlan({
      taskRef: "task:broker-test-1",
      proposal: proposal([readStep()])
    });
    assert.equal(prepared.accepted, true);
    change(state);

    const executed = await broker.executePlan({
      planRef: prepared.planRef,
      expectedPlanDigest: prepared.planDigest
    });
    assert.equal(executed.executed, false);
    assert.equal(executed.state, "FAILED");
    assert.equal(state.dispatches.length, 0);
  }
});

test("host policy changes between PLAN and EXECUTE block dispatch", async () => {
  const { broker, state } = fixture();
  const prepared = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([readStep()])
  });
  assert.equal(prepared.accepted, true);
  state.policy = hostPolicy({ allowedOperations: [] });

  const executed = await broker.executePlan({
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest
  });
  assert.equal(executed.executed, false);
  assert.equal(executed.state, "FAILED");
  assert.equal(executed.reason, "operation-not-allowed-by-host-policy");
  assert.equal(state.dispatches.length, 0);
});

test("a required Resource Lease must be admitted before the operation adapter is called", async () => {
  const { broker, state } = fixture({
    requirement: {
      required: true,
      offerId: "offer:test",
      capabilityProfileRef: "profile:tests",
      requestedCapacity: { quantity: 1, unit: "concurrent-operation" }
    },
    resourceProvider: {
      async withLease() {
        return { allowed: false, reason: "host-resource-denied" };
      }
    }
  });
  const prepared = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([readStep()])
  });
  const executed = await broker.executePlan({
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest
  });
  assert.equal(executed.executed, false);
  assert.equal(executed.reason, "RESOURCE_ADMISSION_DENIED");
  assert.equal(state.dispatches.length, 0);
});

test("admitted Resource Lease is bound to task and rechecked at dispatch boundary", async () => {
  let activeChecks = 0;
  const resourceProvider = {
    async withLease(input) {
      assert.equal(input.consumerTaskRef, "task:broker-test-1");
      assert.equal(input.offerId, "offer:test");
      const result = await input.run({
        lease: { leaseId: "lease:test", leaseState: "active" },
        assertActive() { activeChecks += 1; return true; }
      });
      return {
        allowed: true,
        result,
        lease: { leaseId: "lease:test", leaseState: "released" }
      };
    }
  };
  const { broker, state } = fixture({
    requirement: {
      required: true,
      offerId: "offer:test",
      capabilityProfileRef: "profile:tests",
      requestedCapacity: { quantity: 1, unit: "concurrent-operation" }
    },
    resourceProvider
  });
  const prepared = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([readStep()])
  });
  const executed = await broker.executePlan({
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest
  });
  assert.equal(executed.executed, true);
  assert.equal(state.dispatches.length, 1);
  assert.ok(activeChecks >= 2);
  assert.equal(state.dispatches[0].resourceLease.leaseId, "lease:test");
});

test("model cannot inject tool registry, dispatch target, policy or extra executable fields into proposal", async () => {
  const { broker, state } = fixture();
  const malicious = {
    ...proposal([readStep()]),
    tools: [{ name: "wallet.sign" }],
    dispatch: "wallet.sign"
  };
  const result = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: malicious
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "PLAN_PROPOSAL_INVALID");
  assert.equal(state.dispatches.length, 0);
});

test("input validators run during PLAN and invalid adapter inputs never become executable plans", async () => {
  const { broker, state } = fixture({
    adapterOverrides: {
      "workspace.read": {
        validateInput() { throw new Error("invalid input"); },
        async execute(context) {
          state.dispatches.push(context);
          return { ok: true };
        }
      }
    }
  });
  const result = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([readStep()])
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "OPERATION_INPUT_REJECTED");
  assert.equal(state.dispatches.length, 0);
});

test("plan digest is bound at EXECUTE and a READY plan is one-shot", async () => {
  const { broker, state } = fixture();
  const prepared = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([readStep()])
  });
  const tampered = await broker.executePlan({
    planRef: prepared.planRef,
    expectedPlanDigest: "sha256:" + "f".repeat(64)
  });
  assert.equal(tampered.executed, false);
  assert.equal(tampered.reason, "PLAN_DIGEST_MISMATCH");
  assert.equal(broker.getPlanStatus(prepared.planRef).state, "READY");

  const first = await broker.executePlan({
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest
  });
  const second = await broker.executePlan({
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest
  });
  assert.equal(first.executed, true);
  assert.equal(second.executed, false);
  assert.equal(second.reason, "PLAN_NOT_EXECUTABLE");
  assert.equal(state.dispatches.length, 1);
});

test("concurrent EXECUTE requests cannot dispatch the same step twice", async () => {
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const calls = [];
  const { broker } = fixture({
    adapterOverrides: {
      "workspace.read": {
        validateInput(input) { return input; },
        async execute(context) {
          calls.push(context.operation);
          await barrier;
          return { ok: true };
        }
      }
    }
  });
  const prepared = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([readStep()])
  });

  const firstPromise = broker.executePlan({
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest
  });
  const second = await broker.executePlan({
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest
  });
  assert.equal(second.executed, false);
  assert.equal(second.reason, "PLAN_NOT_EXECUTABLE");
  assert.deepEqual(calls, ["workspace.read"]);

  release();
  const first = await firstPromise;
  assert.equal(first.executed, true);
  assert.deepEqual(calls, ["workspace.read"]);
});

test("task manifest expiry is enforced before PLAN", async () => {
  const { broker, state } = fixture({
    task: taskProjection({ expiresAt: "2026-11-08T04:59:59.000Z" })
  });
  const result = await broker.preparePlan({
    taskRef: "task:broker-test-1",
    proposal: proposal([readStep()])
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "TASK_AUTHORITY_EXPIRED");
  assert.equal(state.dispatches.length, 0);
});

test("broker requires trusted task, resource-admission and resolver ports at construction", () => {
  assert.throws(() => createPlanExecuteCapabilityBroker({}), /trustedProjectResolver/);
});
