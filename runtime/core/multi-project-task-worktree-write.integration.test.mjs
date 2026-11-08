import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp, mkdir, rm, writeFile, readFile, stat
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import { createProjectRuntime, createProjectRuntimeRegistry } from "./project-runtime-registry.mjs";
import { createProjectTaskStore } from "./project-task-store.mjs";
import { createProjectSupervisor } from "./project-supervisor.mjs";
import { createDeterministicModelProvider } from "./deterministic-model-provider.mjs";
import { createModelTaskPlanner, createModelBackedTaskExecutor } from "./model-task-planner.mjs";
import { PLAN_PROPOSAL_CONTRACT_VERSION } from "./plan-execute-capability-broker.mjs";
import { createTaskWorktreeManager } from "../reference-worker/git-task-worktree-manager.mjs";
import { createTaskWorktreeWorkspaceOperationAdapters } from "../reference-worker/task-worktree-workspace-operation-adapters.mjs";

const execFile = promisify(execFileCallback);
const NOW = "2026-11-08T06:40:00.000Z";
const MAIN_FILE = "src/main.mjs";
const CREATE_FILE = "src/generated.mjs";
const ORIGINAL_CONTENT = "export const version = 1;\n";
const REPLACED_CONTENT = "export const version = 2;\n";
const CREATED_CONTENT = "export const generated = true;\n";

const PROJECTS = [
  {
    projectRef: "project:immortal-write-e2e",
    taskRef: "task:immortal-write-e2e",
    repositoryRef: "LiberoNuvola/Immortal-Protocol",
    manifestDigest: "sha256:" + "a".repeat(64),
    routeDigest: "sha256:" + "1".repeat(64),
    repositoryDirectory: "immortal-source",
    worktreeDirectory: "immortal-worktrees"
  },
  {
    projectRef: "project:second-write-e2e",
    taskRef: "task:second-write-e2e",
    repositoryRef: "example/second-project",
    manifestDigest: "sha256:" + "b".repeat(64),
    routeDigest: "sha256:" + "2".repeat(64),
    repositoryDirectory: "second-source",
    worktreeDirectory: "second-worktrees"
  }
];

const sha256 = content => createHash("sha256").update(content, "utf8").digest("hex");

async function git(args, cwd) {
  return execFile("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    maxBuffer: 1_048_576
  });
}

async function createSourceRepository(directory) {
  await mkdir(directory, { recursive: true });
  await git(["init", "--initial-branch=main"], directory);
  await git(["config", "user.name", "Cormia Integration Test"], directory);
  await git(["config", "user.email", "cormia-integration@example.invalid"], directory);
  await mkdir(path.join(directory, "src"));
  await writeFile(path.join(directory, MAIN_FILE), ORIGINAL_CONTENT, "utf8");
  await git(["add", MAIN_FILE], directory);
  await git(["commit", "-m", "synthetic immutable baseline"], directory);
  return (await git(["rev-parse", "HEAD"], directory)).stdout.trim();
}

function buildProjectRuntime(config, manager) {
  const workspaceAdapters = createTaskWorktreeWorkspaceOperationAdapters({ worktreeManager: manager });
  const task = Object.freeze({
    taskId: config.taskRef,
    manifestDigest: config.manifestDigest,
    requestedOperations: ["workspace.create", "workspace.replace"],
    expiresAt: "2026-11-08T07:30:00.000Z"
  });

  const taskAuthorityProvider = {
    async loadVerifiedTask(taskRef) {
      if (taskRef !== config.taskRef) throw new Error("task belongs to another project");
      return task;
    },
    async revalidateVerifiedTask({ taskRef }) {
      if (taskRef !== config.taskRef) throw new Error("task belongs to another project");
      return task;
    }
  };

  const trustedProjectResolver = {
    async createTaskSession(verifiedTask) {
      if (verifiedTask.taskId !== config.taskRef ||
          verifiedTask.manifestDigest !== config.manifestDigest) {
        return { authorized: false, reason: "TASK_PROJECT_BINDING_MISMATCH" };
      }
      return Object.freeze({
        authorized: true,
        taskId: config.taskRef,
        manifestDigest: config.manifestDigest,
        async authorizeOperation(request) {
          const allowed =
            (request.operation === "workspace.create" && request.relativePath === CREATE_FILE) ||
            (request.operation === "workspace.replace" && request.relativePath === MAIN_FILE);
          return {
            allowed,
            reason: allowed ? "SYNTHETIC_STANDING_MANDATE_ALLOWED" : "SYNTHETIC_MANDATE_PATH_DENIED",
            operation: request.operation
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
    operationAdapters: workspaceAdapters,
    clock: () => new Date(NOW),
    idFactory: (() => {
      let sequence = 0;
      return () => "plan:" + config.projectRef + ":" + (++sequence);
    })()
  });
}

test("one Supervisor autonomously creates/replaces files in two project-specific task worktrees in parallel", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cormia-two-project-write-e2e-"));
  let supervisor;
  let releaseProvider;
  let cyclePromise;
  try {
    const configs = [];
    const managers = new Map();
    const stores = new Map();
    const baseCommits = new Map();
    const routeMap = new Map();
    const taskConfigMap = new Map();
    const verifiedProjects = new Set();

    for (const config of PROJECTS) {
      const repositoryPath = path.join(directory, config.repositoryDirectory);
      const worktreeBasePath = path.join(directory, config.worktreeDirectory);
      const baseCommit = await createSourceRepository(repositoryPath);
      const manager = createTaskWorktreeManager({
        repositoryPath,
        worktreeBasePath,
        projectRef: config.projectRef,
        repositoryRef: config.repositoryRef,
        baseRef: "main",
        commandTimeoutMs: 10_000
      });
      const workspace = await manager.createTaskWorkspace({ taskRef: config.taskRef });
      const store = createProjectTaskStore({
        journalPath: path.join(directory, config.repositoryDirectory + "-tasks.ndjson"),
        projectRef: config.projectRef,
        clock: () => new Date(NOW),
        idFactory: (() => {
          let sequence = 0;
          return () => "task-event:" + config.projectRef + ":" + (++sequence);
        })()
      });

      configs.push({ ...config, repositoryPath, worktreeBasePath, workspace });
      managers.set(config.projectRef, manager);
      stores.set(config.projectRef, store);
      baseCommits.set(config.projectRef, baseCommit);
      taskConfigMap.set(config.taskRef, config);
      routeMap.set(config.taskRef, {
        schemaVersion: "0.1.0",
        status: "verified",
        taskRef: config.taskRef,
        projectRef: config.projectRef,
        manifestDigest: config.manifestDigest,
        routeDigest: config.routeDigest
      });
    }

    const runtimeRegistry = createProjectRuntimeRegistry({
      projectRuntimes: configs.map(config => ({
        projectRef: config.projectRef,
        runtime: buildProjectRuntime(config, managers.get(config.projectRef))
      })),
      taskRoutingProvider: {
        async resolveVerifiedTaskRoute({ taskRef }) {
          return routeMap.get(taskRef) ?? null;
        }
      }
    });

    const providerArrivals = new Set();
    let notifyBothArrived;
    const bothArrived = new Promise(resolve => { notifyBothArrived = resolve; });
    const providerGate = new Promise(resolve => { releaseProvider = resolve; });

    const modelProvider = createDeterministicModelProvider({
      clock: () => new Date(NOW),
      responseFactory: async request => {
        const taskInput = JSON.parse(request.input.find(item => item.kind === "text").text);
        const config = taskConfigMap.get(taskInput.taskRef);
        if (!config || config.projectRef !== taskInput.projectRef ||
            config.manifestDigest !== taskInput.manifestDigest) {
          throw new Error("shared provider received a cross-project task context");
        }
        providerArrivals.add(config.projectRef);
        if (providerArrivals.size === 2) notifyBothArrived();
        await providerGate;

        const proposal = {
          contractVersion: PLAN_PROPOSAL_CONTRACT_VERSION,
          steps: [
            {
              operation: "workspace.create",
              relativePath: CREATE_FILE,
              input: { path: CREATE_FILE, content: CREATED_CONTENT }
            },
            {
              operation: "workspace.replace",
              relativePath: MAIN_FILE,
              input: {
                path: MAIN_FILE,
                expectedSha256: sha256(ORIGINAL_CONTENT),
                content: REPLACED_CONTENT
              }
            }
          ]
        };
        return {
          contractVersion: "cormia.model-provider/0.1",
          requestRef: request.requestRef,
          providerRequestRef: "synthetic-write:" + config.projectRef,
          observedProvider: {
            providerAdapterId: "cormia.synthetic",
            providerInstanceRef: "provider:synthetic:test",
            observedModelId: "synthetic-deterministic-v1"
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
          const config = taskConfigMap.get(taskRef);
          if (!config || config.projectRef !== projectRef) {
            throw new Error("host task context rejected cross-project routing");
          }
          return {
            taskRef,
            projectRef,
            manifestDigest: config.manifestDigest,
            requestedOperations: ["workspace.create", "workspace.replace"]
          };
        }
      },
      generationProfileRef: "profile:shared-write-e2e",
      clock: () => new Date(NOW),
      idFactory: (() => {
        let sequence = 0;
        return () => "model-request:write-e2e:" + (++sequence);
      })()
    });

    const executor = createModelBackedTaskExecutor({
      planner,
      resultVerifier: {
        async verifyTaskResult({ projectRef, task, attempt, plan, execution }) {
          const config = taskConfigMap.get(task.taskRef);
          assert.ok(config);
          assert.equal(projectRef, config.projectRef);
          assert.equal(attempt, 1);
          assert.equal(plan.stepCount, 2);
          assert.equal(execution.state, "COMPLETED");
          assert.equal(execution.completedStepCount, 2);

          const workspace = await managers.get(projectRef).resolveTaskWorkspace({
            taskRef: task.taskRef
          });
          const created = await readFile(path.join(workspace.rootPath, CREATE_FILE), "utf8");
          const replaced = await readFile(path.join(workspace.rootPath, MAIN_FILE), "utf8");
          assert.equal(created, CREATED_CONTENT);
          assert.equal(replaced, REPLACED_CONTENT);
          const createdStat = await stat(path.join(workspace.rootPath, CREATE_FILE));
          assert.equal(createdStat.isFile(), true);

          assert.equal(
            await readFile(path.join(config.repositoryPath, MAIN_FILE), "utf8"),
            ORIGINAL_CONTENT
          );
          await assert.rejects(
            readFile(path.join(config.repositoryPath, CREATE_FILE), "utf8"),
            error => error.code === "ENOENT"
          );

          verifiedProjects.add(projectRef);
          return {
            verified: true,
            evidenceRefs: ["evidence:workspace-write:" + projectRef + ":" + task.taskRef]
          };
        }
      }
    });

    supervisor = createProjectSupervisor({
      projectStores: configs.map(config => ({
        projectRef: config.projectRef,
        taskStore: stores.get(config.projectRef),
        maxConcurrency: 1
      })),
      runtimeRegistry,
      taskRoutingProvider: {
        async resolveVerifiedTaskRoute({ taskRef }) {
          return routeMap.get(taskRef) ?? null;
        }
      },
      taskExecutor: executor,
      supervisorLockPath: path.join(directory, "supervisor.lock"),
      actorRef: "actor:synthetic-write-e2e",
      workerRefFactory: (() => {
        let sequence = 0;
        return () => "worker:write-e2e:" + (++sequence);
      })(),
      eventIdFactory: (() => {
        let sequence = 0;
        return () => "supervisor-event:write-e2e:" + (++sequence);
      })(),
      clock: () => new Date(NOW),
      maxGlobalConcurrency: 2
    });

    for (const config of configs) {
      await stores.get(config.projectRef).enqueue({
        taskRef: config.taskRef,
        manifestDigest: config.manifestDigest,
        goal: "Create one generated module and replace the main module inside this task worktree only.",
        sourceRef: "source:operator:" + config.projectRef,
        maxAttempts: 2,
        dependsOn: [],
        expectedRevision: 0,
        actorRef: "actor:operator",
        reasonCode: "operator_requested"
      });
    }

    await supervisor.start();
    cyclePromise = supervisor.runCycle();
    const arrivalsResult = await Promise.race([
      bothArrived.then(() => "both-arrived"),
      new Promise(resolve => setTimeout(() => resolve("timeout"), 15_000))
    ]);
    assert.equal(arrivalsResult, "both-arrived", "both projects must reach the shared ModelProvider");
    releaseProvider();
    const cycle = await cyclePromise;

    assert.equal(cycle.scheduledCount, 2);
    assert.equal(
      cycle.results.every(result => result.state === "completed"),
      true,
      JSON.stringify({
        cycle,
        taskStates: await Promise.all(configs.map(async config => ({
          projectRef: config.projectRef,
          tasks: (await stores.get(config.projectRef).read()).tasks
        })))
      })
    );
    assert.deepEqual([...verifiedProjects].sort(), PROJECTS.map(item => item.projectRef).sort());
    assert.deepEqual([...providerArrivals].sort(), PROJECTS.map(item => item.projectRef).sort());

    for (const config of configs) {
      const snapshot = await stores.get(config.projectRef).read();
      assert.equal(snapshot.tasks[0].state, "completed");
      assert.equal(snapshot.tasks[0].checkpointRefs.length, 1);
      assert.deepEqual(snapshot.tasks[0].evidenceRefs, [
        "evidence:workspace-write:" + config.projectRef + ":" + config.taskRef
      ]);
      const sourceHead = (await git(["rev-parse", "HEAD"], config.repositoryPath)).stdout.trim();
      assert.equal(sourceHead, baseCommits.get(config.projectRef));
    }

    await supervisor.stop();
  } finally {
    releaseProvider?.();
    await cyclePromise?.catch(() => {});
    await supervisor?.stop().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
