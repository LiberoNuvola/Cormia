import test from "node:test";
import assert from "node:assert/strict";

import { createProjectRuntime } from "./project-runtime-registry.mjs";
import { PLAN_PROPOSAL_CONTRACT_VERSION } from "./plan-execute-capability-broker.mjs";
import { createTaskWorktreeTestOperationAdapter } from "../reference-worker/task-worktree-test-operation-adapter.mjs";
import { createImmortalResourceProvider } from "../reference-worker/immortal-resource-provider-composition.mjs";

const NOW = "2026-11-08T07:20:00.000Z";
const PROJECT = "project:broker-resource-test";
const TASK = "task:broker-resource-test";
const MANIFEST = "sha256:" + "c".repeat(64);
const IMAGE = "ghcr.io/cormia/node-test@sha256:" + "d".repeat(64);
const PROFILE = {
  executionProfileId: "node-core-tests-v1",
  runner: "node-test",
  imageDigest: IMAGE,
  testFiles: ["runtime/core/example.test.mjs"],
  maxRuntimeMs: 10_000,
  memoryMiB: 512,
  cpus: 1,
  pidsLimit: 64,
  tmpfsMiB: 64,
  maxOutputBytes: 16_384
};

test("Project Runtime Broker dispatches workspace.test under the existing local ResourceManager lease", async () => {
  const state = { acquired: [], released: 0, runnerInvoked: false };
  const resourceManager = {
    async snapshot() {
      return {
        capturedAt: NOW,
        recommendation: {
          mode: "normal",
          reason: "synthetic-integration",
          policy: { allowed: true },
          availableMemoryGB: 4,
          cpuUtilizationPct: 5,
          gpuFreeMemoryGB: null
        }
      };
    },
    acquire(kind) {
      state.acquired.push(kind);
      return {
        allowed: true,
        leaseId: "resource-manager-lease:integration",
        release() { state.released += 1; }
      };
    }
  };

  const resourceProvider = createImmortalResourceProvider({
    providerRef: "provider:local-resource-manager",
    offers: [{
      schemaVersion: "0.1.0",
      recordType: "cormia.core.resource-offer",
      offerId: "offer:workspace-test",
      providerRef: "provider:local-resource-manager",
      resourceType: "compute.local-cpu",
      capabilityProfileRef: "profile:workspace-test-v1",
      capacity: { quantity: 1, unit: "task" },
      availability: {
        notBefore: NOW,
        expiresAt: "2026-11-08T08:20:00.000Z"
      },
      privacyProfileRef: "privacy:local-only",
      offerState: "available",
      ownerAccepted: true,
      ownerAcceptanceRef: "operator:accepted",
      validated: true,
      validationEvidenceRefs: ["evidence:resource-snapshot"],
      createdAt: NOW,
      updatedAt: NOW,
      operation: "workspace-test"
    }],
    resourceManager,
    leaseTtlMs: 30_000,
    clock: () => new Date(NOW),
    idFactory: () => "cormia-resource-lease:integration"
  });

  const workspace = {
    projectRef: PROJECT,
    taskRef: TASK,
    state: "ready",
    rootPath: "/synthetic/host/worktree"
  };
  const operationAdapter = createTaskWorktreeTestOperationAdapter({
    worktreeManager: {
      projectRef: PROJECT,
      async resolveTaskWorkspace({ taskRef }) {
        assert.equal(taskRef, TASK);
        return workspace;
      }
    },
    executionProfiles: [PROFILE],
    testRunner: {
      async run({ profile, workspace: resolvedWorkspace, assertResourceActive }) {
        state.runnerInvoked = true;
        assert.equal(profile.executionProfileId, PROFILE.executionProfileId);
        assert.equal(resolvedWorkspace, workspace);
        assertResourceActive();
        return {
          runner: "docker-node-test",
          imageDigest: IMAGE,
          testFiles: [...PROFILE.testFiles],
          passed: true,
          exitCode: 0,
          signal: null,
          durationMs: 25,
          stdout: "synthetic tests passed",
          stderr: ""
        };
      }
    }
  });

  const task = Object.freeze({
    taskId: TASK,
    manifestDigest: MANIFEST,
    requestedOperations: ["workspace.test"],
    expiresAt: "2026-11-08T08:00:00.000Z"
  });
  const runtime = createProjectRuntime({
    projectRef: PROJECT,
    trustedProjectResolver: {
      async createTaskSession(verifiedTask) {
        assert.equal(verifiedTask.taskId, TASK);
        assert.equal(verifiedTask.manifestDigest, MANIFEST);
        return Object.freeze({
          authorized: true,
          async authorizeOperation(request) {
            const allowed = request.operation === "workspace.test" &&
              request.executionProfileId === PROFILE.executionProfileId;
            return {
              allowed,
              reason: allowed ? "SYNTHETIC_MANDATE_ALLOWED" : "SYNTHETIC_MANDATE_DENIED",
              operation: request.operation
            };
          }
        });
      }
    },
    taskAuthorityProvider: {
      async loadVerifiedTask(taskRef) {
        assert.equal(taskRef, TASK);
        return task;
      },
      async revalidateVerifiedTask({ taskRef }) {
        assert.equal(taskRef, TASK);
        return task;
      }
    },
    resourceAdmissionProvider: {
      async resolveRequirement({ operation }) {
        if (operation !== "workspace.test") return { required: false };
        return {
          required: true,
          offerId: "offer:workspace-test",
          capabilityProfileRef: "profile:workspace-test-v1",
          requestedCapacity: { quantity: 1, unit: "task" }
        };
      }
    },
    resourceProvider,
    operationAdapters: { "workspace.test": operationAdapter },
    clock: () => new Date(NOW),
    idFactory: () => "plan:broker-resource-test"
  });

  const prepared = await runtime.preparePlan({
    taskRef: TASK,
    proposal: {
      contractVersion: PLAN_PROPOSAL_CONTRACT_VERSION,
      steps: [{
        operation: "workspace.test",
        executionProfileId: PROFILE.executionProfileId,
        input: { executionProfileId: PROFILE.executionProfileId }
      }]
    }
  });
  assert.equal(prepared.accepted, true);

  const executed = await runtime.executePlan({
    taskRef: TASK,
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest
  });

  assert.equal(executed.executed, true);
  assert.equal(executed.state, "COMPLETED");
  assert.equal(executed.steps[0].result.passed, true);
  assert.equal(state.runnerInvoked, true);
  assert.deepEqual(state.acquired, ["cpu-heavy"]);
  assert.equal(state.released, 1);
});
