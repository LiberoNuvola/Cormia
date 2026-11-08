import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createTrustedProjectResolver } from "./trusted-project-context-resolver.mjs";
import { createProjectRuntime, createProjectRuntimeRegistry } from "./project-runtime-registry.mjs";
import { createProjectTaskStore } from "./project-task-store.mjs";
import { createProjectSupervisor } from "./project-supervisor.mjs";
import { createDeterministicModelProvider } from "./deterministic-model-provider.mjs";
import { createModelTaskPlanner, createModelBackedTaskExecutor } from "./model-task-planner.mjs";
import { PLAN_PROPOSAL_CONTRACT_VERSION } from "./plan-execute-capability-broker.mjs";
import { createReadOnlyCodingWorkspaceAdapter } from "../reference-worker/immortal-coding-workspace-readonly-adapter.mjs";
import { createReadOnlyCodingWorkspaceOperationAdapters } from "../reference-worker/immortal-coding-workspace-operation-adapters.mjs";

const NOW = "2026-11-08T05:00:00.000Z";
const PROJECT_REF = "project:immortal-e2e";
const TASK_REF = "task:immortal-e2e-read";
const REPOSITORY_REF = "LiberoNuvola/Immortal-Protocol";
const WORKSPACE_REF = "workspace:immortal-e2e";
const ISSUER_ID = "local-host:synthetic-e2e";
const WORKER_ID = "worker:cormia-e2e";
const RUNTIME_ID = "runtime:cormia-e2e";
const MANDATE_ID = "11111111-1111-4111-8111-111111111111";
const CONSENT_ID = "22222222-2222-4222-8222-222222222222";
const INTERACTION_ID = "33333333-3333-4333-8333-333333333333";
const NONCE = "44444444-4444-4444-8444-444444444444";
const MANIFEST_DIGEST = "sha256:" + "a".repeat(64);
const MANDATE_DIGEST = "sha256:" + "b".repeat(64);
const CONSENT_DIGEST = "sha256:" + "c".repeat(64);
const ROUTE_DIGEST = "sha256:" + "d".repeat(64);
const TARGET_PATH = "src/main.mjs";

function makeMandateClaims() {
  return {
    schemaVersion: "0.1.0",
    mandateId: MANDATE_ID,
    issuerId: ISSUER_ID,
    operatorPrincipalId: "os-principal:operator-e2e",
    subject: { workerId: WORKER_ID, runtimeId: RUNTIME_ID },
    project: { projectRef: PROJECT_REF, repositoryRef: REPOSITORY_REF, baseRef: "main" },
    workspace: {
      workspaceRef: WORKSPACE_REF,
      scopeMode: "isolated-project-worktree",
      recursive: true,
      excludedPaths: [".secrets", "wallet", "credentials"],
      taskWorktreeRequired: true
    },
    allowedOperations: [
      "workspace.list", "workspace.read", "workspace.diff", "workspace.verify",
      "workspace.create", "workspace.replace", "workspace.patch", "workspace.test",
      "workspace.build", "git.branch.create", "git.commit.local",
      "git.push.feature-branch", "github.pull-request.create", "github.pull-request.update"
    ],
    protectedActions: ["merge-protected-branch", "release", "production-deploy", "wallet-signing"],
    gitPolicy: {
      branchPrefix: "agent/",
      defaultBranchWrite: "deny",
      protectedBranchMerge: "separate-authority",
      releaseTag: "separate-authority",
      autoPushFeatureBranch: true,
      autoCreatePullRequest: true
    },
    networkPolicy: { mode: "https-allowlist", allowedHttpsHosts: ["api.github.com"] },
    executionProfileIds: ["node22-project-tests", "node22-build"],
    resourceBudget: {
      maxConcurrentTasks: 1,
      maxAttemptsPerTask: 3,
      maxRuntimeMinutes: 30,
      maxCpuHeavyMinutes: 10,
      maxMemoryMiB: 2048
    },
    autonomyPolicy: {
      acceptInScopeTasksAutomatically: true,
      allowAgentCreatedSubtasks: false,
      humanApprovalPerOperation: false,
      continueIndependentTasksOnBlock: true,
      stopOnTrustFailure: true
    },
    issuedAt: "2026-11-08T04:00:00.000Z",
    notBefore: "2026-11-08T04:00:00.000Z",
    expiresAt: "2026-11-08T06:00:00.000Z",
    delegable: false,
    operatorConsentDigest: CONSENT_DIGEST
  };
}

function makeDescriptor() {
  return {
    schemaVersion: "0.1.0",
    recordType: "cormia.core.project-descriptor",
    projectRef: PROJECT_REF,
    displayName: "IMMORTAL E2E synthetic fixture",
    leadershipMode: "agent_led",
    stewardRef: "principal:steward-e2e",
    accountabilityRef: "accountability:e2e",
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

function makeConsentClaims() {
  return {
    schemaVersion: "0.1.0",
    consentId: CONSENT_ID,
    issuerId: ISSUER_ID,
    operatorPrincipalId: "os-principal:operator-e2e",
    consentBrokerId: "local-consent-broker:e2e",
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

function makeHostPolicy() {
  const operations = [
    "workspace.list", "workspace.read", "workspace.diff", "workspace.verify",
    "workspace.create", "workspace.replace", "workspace.patch", "workspace.test",
    "workspace.build", "git.branch.create", "git.commit.local",
    "git.push.feature-branch", "github.pull-request.create", "github.pull-request.update"
  ];
  return {
    issuerId: ISSUER_ID,
    projectRef: PROJECT_REF,
    repositoryRef: REPOSITORY_REF,
    workspaceRef: WORKSPACE_REF,
    workerId: WORKER_ID,
    runtimeId: RUNTIME_ID,
    allowedOperations: operations,
    excludedPaths: [".secrets", "wallet", "credentials"],
    allowedExecutionProfiles: ["node22-project-tests", "node22-build"],
    allowedHttpsHosts: ["api.github.com"]
  };
}

function buildResolver(state) {
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
        return makeDescriptor();
      }
    },
    identityProvider: {
      async resolveSteward(ref) {
        assert.equal(ref, "principal:steward-e2e");
        return {
          status: "verified",
          principalStatus: "active",
          principalRef: ref,
          principalType: "human"
        };
      },
      async resolveAccountability(ref) {
        assert.equal(ref, "accountability:e2e");
        return {
          status: "verified",
          arrangementStatus: "active",
          arrangementRef: ref,
          accountablePrincipalRefs: ["principal:steward-e2e"]
        };
      },
      async authorizeMandateOperator(input) {
        return {
          status: "authorized",
          operatorIdentityStatus: "authenticated",
          operatorPrincipalId: "os-principal:operator-e2e",
          accountabilityRef: input.accountabilityRef
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
          claims: makeMandateClaims()
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
          claims: makeConsentClaims()
        };
      }
    },
    revocationAuthority: {
      async reconcileMandate() {
        return {
          status: "HEALTHY",
          issuerId: ISSUER_ID,
          mandateId: MANDATE_ID,
          mandateDigest: MANDATE_DIGEST,
          mandateState: "active",
          anchorProviderId: "synthetic-monotonic-anchor",
          sequence: 1,
          headEventDigest: null
        };
      }
    },
    hostPolicyProvider: { async readPolicy() { return makeHostPolicy(); } },
    projectLifecycleJournal: {
      async read() {
        return { projectRef: PROJECT_REF, state: "active", revision: 1 };
      }
    },
    clock: () => state.now
  });
}

async function makeHarness(directory) {
  const state = { now: NOW };
  const dispatches = [];
  const underlyingCodingWorkspace = {
    isTool(operation) {
      return ["workspace_list", "workspace_read", "workspace_diff", "workspace_verify"].includes(operation);
    },
    requiresApproval() { return false; },
    async callTool(operation, args) {
      dispatches.push({ operation, args });
      if (operation === "workspace_read") {
        return { ok: true, path: args.path, content: "export const protocol = true;\n" };
      }
      return { ok: true, operation, args };
    }
  };
  const readOnlyWorkspace = createReadOnlyCodingWorkspaceAdapter({
    codingWorkspace: underlyingCodingWorkspace,
    readableFiles: [TARGET_PATH],
    listableDirectories: ["."]
  });
  const operationAdapters = createReadOnlyCodingWorkspaceOperationAdapters({ readOnlyWorkspace });

  const taskAuthority = {
    async loadVerifiedTask(taskRef) {
      if (taskRef !== TASK_REF) throw new Error("unknown task");
      return {
        taskId: TASK_REF,
        manifestDigest: MANIFEST_DIGEST,
        requestedOperations: ["workspace.read"],
        expiresAt: "2026-11-08T06:00:00.000Z"
      };
    },
    async revalidateVerifiedTask({ taskRef }) {
      if (taskRef !== TASK_REF) throw new Error("unknown task");
      return {
        taskId: TASK_REF,
        manifestDigest: MANIFEST_DIGEST,
        requestedOperations: ["workspace.read"],
        expiresAt: "2026-11-08T06:00:00.000Z"
      };
    }
  };

  const runtime = createProjectRuntime({
    projectRef: PROJECT_REF,
    trustedProjectResolver: buildResolver(state),
    taskAuthorityProvider: taskAuthority,
    resourceAdmissionProvider: {
      async resolveRequirement({ taskRef }) {
        assert.equal(taskRef, TASK_REF);
        return { required: false };
      }
    },
    operationAdapters,
    clock: () => new Date(NOW),
    idFactory: (() => {
      let sequence = 0;
      return () => "plan:e2e:" + (++sequence);
    })()
  });

  const registry = createProjectRuntimeRegistry({
    projectRuntimes: [{ projectRef: PROJECT_REF, runtime }],
    taskRoutingProvider: {
      async resolveVerifiedTaskRoute({ taskRef }) {
        if (taskRef !== TASK_REF) return null;
        return {
          schemaVersion: "0.1.0",
          status: "verified",
          taskRef: TASK_REF,
          projectRef: PROJECT_REF,
          manifestDigest: MANIFEST_DIGEST,
          routeDigest: ROUTE_DIGEST
        };
      }
    }
  });

  const proposal = {
    contractVersion: PLAN_PROPOSAL_CONTRACT_VERSION,
    steps: [{
      operation: "workspace.read",
      relativePath: TARGET_PATH,
      input: { path: TARGET_PATH }
    }]
  };
  const modelProvider = createDeterministicModelProvider({
    clock: () => new Date(NOW),
    responseFactory: async request => ({
      contractVersion: "cormia.model-provider/0.1",
      requestRef: request.requestRef,
      providerRequestRef: "synthetic:e2e:" + request.requestRef,
      observedProvider: {
        providerAdapterId: "cormia.synthetic",
        providerInstanceRef: "provider:synthetic:test",
        observedModelId: "synthetic-deterministic-v1"
      },
      output: { format: "json", content: JSON.stringify(proposal) },
      finishReason: "completed",
      warnings: [],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, source: "unknown" }
    })
  });

  const planner = createModelTaskPlanner({
    modelProvider,
    taskContextProvider: {
      async resolveVerifiedPlanningContext({ taskRef, projectRef }) {
        return {
          taskRef,
          projectRef,
          manifestDigest: MANIFEST_DIGEST,
          requestedOperations: ["workspace.read"]
        };
      }
    },
    generationProfileRef: "profile:synthetic-e2e",
    clock: () => new Date(NOW),
    idFactory: () => "model-request:e2e"
  });

  const resultVerifier = {
    async verifyTaskResult({ projectRef, task, attempt, plan, execution }) {
      assert.equal(projectRef, PROJECT_REF);
      assert.equal(task.taskRef, TASK_REF);
      assert.equal(attempt, 1);
      assert.equal(plan.stepCount, 1);
      assert.equal(execution.state, "COMPLETED");
      assert.equal(dispatches.length, 1);
      assert.deepEqual(dispatches[0], {
        operation: "workspace_read",
        args: { path: TARGET_PATH }
      });
      // Synthetic verifier fixture: real production verifier/evidence writer is not wired.
      return { verified: true, evidenceRefs: ["evidence:synthetic-e2e:" + TASK_REF] };
    }
  };
  const taskExecutor = createModelBackedTaskExecutor({ planner, resultVerifier });

  const taskStore = createProjectTaskStore({
    journalPath: path.join(directory, "immortal", "tasks.ndjson"),
    projectRef: PROJECT_REF,
    clock: () => new Date(NOW),
    idFactory: (() => {
      let sequence = 0;
      return () => "event:e2e:" + (++sequence);
    })()
  });

  const supervisor = createProjectSupervisor({
    projectStores: [{ projectRef: PROJECT_REF, taskStore, maxConcurrency: 1 }],
    runtimeRegistry: registry,
    taskRoutingProvider: {
      async resolveVerifiedTaskRoute({ taskRef }) {
        if (taskRef !== TASK_REF) return null;
        return {
          schemaVersion: "0.1.0",
          status: "verified",
          taskRef: TASK_REF,
          projectRef: PROJECT_REF,
          manifestDigest: MANIFEST_DIGEST,
          routeDigest: ROUTE_DIGEST
        };
      }
    },
    taskExecutor,
    supervisorLockPath: path.join(directory, "supervisor.lock"),
    actorRef: "actor:synthetic-e2e",
    clock: () => new Date(NOW),
    workerRefFactory: () => "worker:e2e",
    eventIdFactory: (() => {
      let sequence = 0;
      return () => "supervisor-event:e2e:" + (++sequence);
    })(),
    maxGlobalConcurrency: 1
  });

  return { supervisor, taskStore, dispatches, modelProvider };
}

test("full synthetic path: durable task → Supervisor → local ModelProvider → Registry/Broker → read-only workspace → verifier", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cormia-full-e2e-"));
  let supervisor;
  try {
    const harness = await makeHarness(directory);
    supervisor = harness.supervisor;

    const created = await harness.taskStore.enqueue({
      taskRef: TASK_REF,
      manifestDigest: MANIFEST_DIGEST,
      goal: "Read src/main.mjs and record a verified read-only observation.",
      sourceRef: "source:operator-e2e",
      maxAttempts: 2,
      dependsOn: [],
      expectedRevision: 0,
      actorRef: "actor:operator-e2e",
      reasonCode: "operator_requested"
    });
    assert.equal(created.task.state, "queued");

    const started = await supervisor.start();
    assert.equal(started.started, true);

    const cycle = await supervisor.runCycle();
    assert.equal(cycle.scheduledCount, 1);
    assert.equal(
      cycle.results[0].state,
      "completed",
      JSON.stringify({ result: cycle.results[0], task: (await harness.taskStore.read()).tasks[0] })
    );
    assert.equal(cycle.results[0].projectRef, PROJECT_REF);
    assert.deepEqual(harness.dispatches, [{
      operation: "workspace_read",
      args: { path: TARGET_PATH }
    }]);

    const snapshot = await harness.taskStore.read();
    assert.equal(snapshot.tasks[0].state, "completed");
    assert.equal(snapshot.tasks[0].attempt, 1);
    assert.deepEqual(snapshot.tasks[0].checkpointRefs, [
      "checkpoint:plan-ready:plan:e2e:1"
    ]);
    assert.deepEqual(snapshot.tasks[0].evidenceRefs, [
      "evidence:synthetic-e2e:" + TASK_REF
    ]);
    assert.equal(snapshot.revision, 4);
    await supervisor.stop();
  } finally {
    await supervisor?.stop().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
