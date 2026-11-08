import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createProjectRuntime, createProjectRuntimeRegistry } from "./project-runtime-registry.mjs";
import { createProjectTaskStore } from "./project-task-store.mjs";
import { createProjectSupervisor } from "./project-supervisor.mjs";
import { createDeterministicModelProvider } from "./deterministic-model-provider.mjs";
import { createModelTaskPlanner, createModelBackedTaskExecutor } from "./model-task-planner.mjs";
import { PLAN_PROPOSAL_CONTRACT_VERSION } from "./plan-execute-capability-broker.mjs";
import { createReadOnlyCodingWorkspaceAdapter } from "../reference-worker/immortal-coding-workspace-readonly-adapter.mjs";
import { createReadOnlyCodingWorkspaceOperationAdapters } from "../reference-worker/immortal-coding-workspace-operation-adapters.mjs";

const NOW = "2026-11-08T06:15:00.000Z";
const CONFIGS = [
  {
    projectRef: "project:immortal-two",
    taskRef: "task:immortal-two-read",
    manifestDigest: "sha256:" + "a".repeat(64),
    routeDigest: "sha256:" + "1".repeat(64),
    targetPath: "src/immortal.mjs",
    journal: "immortal"
  },
  {
    projectRef: "project:other-two",
    taskRef: "task:other-two-read",
    manifestDigest: "sha256:" + "b".repeat(64),
    routeDigest: "sha256:" + "2".repeat(64),
    targetPath: "src/other.mjs",
    journal: "other"
  }
];

function buildProjectRuntime(config, calls, idFactory) {
  const codingWorkspace = {
    isTool(operation) {
      return ["workspace_list", "workspace_read", "workspace_diff", "workspace_verify"].includes(operation);
    },
    requiresApproval() { return false; },
    async callTool(operation, args) {
      calls.push({ projectRef: config.projectRef, operation, args });
      return {
        ok: true,
        projectRef: config.projectRef,
        path: args.path,
        content: "export const project = " + JSON.stringify(config.projectRef) + ";\n"
      };
    }
  };
  const workspace = createReadOnlyCodingWorkspaceAdapter({
    codingWorkspace,
    readableFiles: [config.targetPath],
    listableDirectories: ["src"]
  });
  const operationAdapters = createReadOnlyCodingWorkspaceOperationAdapters({
    readOnlyWorkspace: workspace
  });

  const verifiedTask = Object.freeze({
    taskId: config.taskRef,
    manifestDigest: config.manifestDigest,
    requestedOperations: ["workspace.read"],
    expiresAt: "2026-11-08T07:00:00.000Z"
  });

  const taskAuthorityProvider = {
    async loadVerifiedTask(taskRef) {
      if (taskRef !== config.taskRef) throw new Error("task belongs to another Runtime");
      return verifiedTask;
    },
    async revalidateVerifiedTask({ taskRef }) {
      if (taskRef !== config.taskRef) throw new Error("task belongs to another Runtime");
      return verifiedTask;
    }
  };

  const trustedProjectResolver = {
    async createTaskSession(task) {
      if (task.taskId !== config.taskRef ||
          task.manifestDigest !== config.manifestDigest) {
        return { authorized: false, reason: "TASK_RUNTIME_BINDING_MISMATCH" };
      }
      return Object.freeze({
        authorized: true,
        taskId: config.taskRef,
        manifestDigest: config.manifestDigest,
        async authorizeOperation(request) {
          const allowed = request.operation === "workspace.read" &&
            request.relativePath === config.targetPath;
          return {
            allowed,
            reason: allowed ? "SYNTHETIC_PROJECT_POLICY_ALLOWED" : "SYNTHETIC_PROJECT_POLICY_DENIED",
            operation: request.operation,
            ...(allowed ? { relativePath: config.targetPath } : {})
          };
        }
      });
    }
  };

  return createProjectRuntime({
    projectRef: config.projectRef,
    trustedProjectResolver,
    taskAuthorityProvider,
    resourceAdmissionProvider: {
      async resolveRequirement() { return { required: false }; }
    },
    operationAdapters,
    clock: () => new Date(NOW),
    idFactory
  });
}

test("one Supervisor and one shared local ModelProvider advance two isolated projects concurrently", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cormia-multi-project-full-e2e-"));
  let supervisor;
  try {
    const calls = [];
    const tasksByRef = new Map(CONFIGS.map(config => [config.taskRef, config]));
    const routeByTask = new Map(CONFIGS.map(config => [config.taskRef, {
      schemaVersion: "0.1.0",
      status: "verified",
      taskRef: config.taskRef,
      projectRef: config.projectRef,
      manifestDigest: config.manifestDigest,
      routeDigest: config.routeDigest
    }]));

    const runtimes = CONFIGS.map((config, index) => ({
      projectRef: config.projectRef,
      runtime: buildProjectRuntime(
        config,
        calls,
        (() => {
          let n = 0;
          return () => "plan:" + index + ":" + (++n);
        })()
      )
    }));
    const runtimeRegistry = createProjectRuntimeRegistry({
      projectRuntimes: runtimes,
      taskRoutingProvider: {
        async resolveVerifiedTaskRoute({ taskRef }) {
          return routeByTask.get(taskRef) ?? null;
        }
      }
    });

    const routeProvider = {
      async resolveVerifiedTaskRoute({ taskRef }) {
        return routeByTask.get(taskRef) ?? null;
      }
    };

    const stores = new Map(CONFIGS.map(config => [config.projectRef, createProjectTaskStore({
      journalPath: path.join(directory, config.journal, "tasks.ndjson"),
      projectRef: config.projectRef,
      clock: () => new Date(NOW),
      idFactory: (() => {
        let n = 0;
        return () => "event:" + config.journal + ":" + (++n);
      })()
    })]));

    const arrivals = new Set();
    let resolveBoth;
    const bothArrived = new Promise(resolve => { resolveBoth = resolve; });
    const modelProvider = createDeterministicModelProvider({
      clock: () => new Date(NOW),
      responseFactory: async request => {
        const taskInput = JSON.parse(request.input.find(item => item.kind === "text").text);
        const config = tasksByRef.get(taskInput.taskRef);
        if (!config || config.projectRef !== taskInput.projectRef) {
          throw new Error("shared provider received an unbound project/task pair");
        }
        arrivals.add(config.projectRef);
        if (arrivals.size === 2) resolveBoth();
        await bothArrived;
        const proposal = {
          contractVersion: PLAN_PROPOSAL_CONTRACT_VERSION,
          steps: [{
            operation: "workspace.read",
            relativePath: config.targetPath,
            input: { path: config.targetPath }
          }]
        };
        return {
          contractVersion: "cormia.model-provider/0.1",
          requestRef: request.requestRef,
          providerRequestRef: "synthetic-multi:" + config.projectRef,
          observedProvider: {
            providerAdapterId: "cormia.synthetic",
            providerInstanceRef: "provider:shared-multi-project",
            observedModelId: "synthetic-deterministic-multi-v1"
          },
          output: { format: "json", content: JSON.stringify(proposal) },
          finishReason: "completed",
          warnings: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, source: "unknown" }
        };
      }
    });

    const planner = createModelTaskPlanner({
      modelProvider,
      taskContextProvider: {
        async resolveVerifiedPlanningContext({ taskRef, projectRef }) {
          const config = tasksByRef.get(taskRef);
          if (!config || config.projectRef !== projectRef) {
            throw new Error("task context provider rejected cross-project lookup");
          }
          return {
            taskRef,
            projectRef,
            manifestDigest: config.manifestDigest,
            requestedOperations: ["workspace.read"]
          };
        }
      },
      generationProfileRef: "profile:shared-local-multi-project",
      clock: () => new Date(NOW),
      idFactory: (() => {
        let n = 0;
        return () => "model-request:multi:" + (++n);
      })()
    });

    const verifiedProjects = new Set();
    const executor = createModelBackedTaskExecutor({
      planner,
      resultVerifier: {
        async verifyTaskResult({ projectRef, task, attempt, plan, execution }) {
          const config = tasksByRef.get(task.taskRef);
          assert.ok(config);
          assert.equal(config.projectRef, projectRef);
          assert.equal(attempt, 1);
          assert.equal(plan.stepCount, 1);
          assert.equal(execution.state, "COMPLETED");
          assert.deepEqual(calls.filter(call => call.projectRef === projectRef), [{
            projectRef,
            operation: "workspace_read",
            args: { path: config.targetPath }
          }]);
          verifiedProjects.add(projectRef);
          return {
            verified: true,
            evidenceRefs: ["evidence:multi:" + projectRef + ":" + task.taskRef]
          };
        }
      }
    });

    supervisor = createProjectSupervisor({
      projectStores: CONFIGS.map(config => ({
        projectRef: config.projectRef,
        taskStore: stores.get(config.projectRef),
        maxConcurrency: 1
      })),
      runtimeRegistry,
      taskRoutingProvider: routeProvider,
      taskExecutor: executor,
      supervisorLockPath: path.join(directory, "supervisor.lock"),
      actorRef: "actor:multi-e2e-supervisor",
      workerRefFactory: (() => {
        let n = 0;
        return () => "worker:multi:" + (++n);
      })(),
      eventIdFactory: (() => {
        let n = 0;
        return () => "supervisor-event:multi:" + (++n);
      })(),
      clock: () => new Date(NOW),
      maxGlobalConcurrency: 2
    });

    for (const config of CONFIGS) {
      await stores.get(config.projectRef).enqueue({
        taskRef: config.taskRef,
        manifestDigest: config.manifestDigest,
        goal: "Read " + config.targetPath + " only inside " + config.projectRef + ".",
        sourceRef: "source:operator:" + config.projectRef,
        maxAttempts: 2,
        dependsOn: [],
        expectedRevision: 0,
        actorRef: "actor:operator",
        reasonCode: "operator_requested"
      });
    }

    await supervisor.start();
    const cycle = await supervisor.runCycle();

    assert.equal(cycle.scheduledCount, 2);
    assert.deepEqual(
      cycle.results.map(result => result.projectRef).sort(),
      CONFIGS.map(config => config.projectRef).sort()
    );
    assert.equal(cycle.results.every(result => result.state === "completed"), true);
    assert.deepEqual([...verifiedProjects].sort(), CONFIGS.map(config => config.projectRef).sort());
    assert.deepEqual([...arrivals].sort(), CONFIGS.map(config => config.projectRef).sort());

    for (const config of CONFIGS) {
      const snapshot = await stores.get(config.projectRef).read();
      assert.equal(snapshot.tasks.length, 1);
      assert.equal(snapshot.tasks[0].state, "completed");
      assert.equal(snapshot.tasks[0].attempt, 1);
      assert.equal(snapshot.tasks[0].checkpointRefs.length, 1);
      assert.deepEqual(snapshot.tasks[0].evidenceRefs, [
        "evidence:multi:" + config.projectRef + ":" + config.taskRef
      ]);
    }

    assert.equal(calls.length, 2);
    assert.notEqual(
      stores.get(CONFIGS[0].projectRef).journalPath,
      stores.get(CONFIGS[1].projectRef).journalPath
    );
    await supervisor.stop();
  } finally {
    await supervisor?.stop().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
