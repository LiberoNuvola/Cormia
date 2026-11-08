import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createProjectTaskStore } from "./project-task-store.mjs";
import { createProjectSupervisor } from "./project-supervisor.mjs";

const PROJECT_A = "project:alpha";
const PROJECT_B = "project:beta";
const TASK_A1 = "task:alpha-1";
const TASK_A2 = "task:alpha-2";
const TASK_B1 = "task:beta-1";
const MANIFEST_A = "sha256:" + "a".repeat(64);
const MANIFEST_B = "sha256:" + "b".repeat(64);
const ROUTE_A1 = "sha256:" + "1".repeat(64);
const ROUTE_A2 = "sha256:" + "2".repeat(64);
const ROUTE_B1 = "sha256:" + "3".repeat(64);
const NOW = "2026-11-08T06:00:00.000Z";

async function makeEnvironment() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cormia-supervisor-"));
  const stores = new Map([
    [PROJECT_A, createProjectTaskStore({
      journalPath: path.join(directory, "alpha", "tasks.ndjson"),
      projectRef: PROJECT_A,
      clock: () => new Date(NOW)
    })],
    [PROJECT_B, createProjectTaskStore({
      journalPath: path.join(directory, "beta", "tasks.ndjson"),
      projectRef: PROJECT_B,
      clock: () => new Date(NOW)
    })]
  ]);
  const routeMap = new Map();
  const routeByTask = new Map([
    [TASK_A1, { projectRef: PROJECT_A, manifestDigest: MANIFEST_A, routeDigest: ROUTE_A1 }],
    [TASK_A2, { projectRef: PROJECT_A, manifestDigest: MANIFEST_A, routeDigest: ROUTE_A2 }],
    [TASK_B1, { projectRef: PROJECT_B, manifestDigest: MANIFEST_B, routeDigest: ROUTE_B1 }]
  ]);
  for (const [taskRef, fields] of routeByTask) {
    routeMap.set(taskRef, {
      schemaVersion: "0.1.0",
      status: "verified",
      taskRef,
      ...fields
    });
  }

  const registryCalls = [];
  const runtimeRegistry = {
    listRegisteredProjects() { return [PROJECT_B, PROJECT_A]; },
    async prepareTaskPlan(command) {
      registryCalls.push({ method: "prepare", command });
      return {
        accepted: true,
        state: "READY",
        taskRef: command.taskRef,
        planRef: "plan:" + command.taskRef,
        planDigest: "sha256:" + "9".repeat(64),
        stepCount: 1
      };
    },
    async executeTaskPlan(command) {
      registryCalls.push({ method: "execute", command });
      return { executed: true, state: "COMPLETED", completedStepCount: 1 };
    }
  };

  return {
    directory,
    stores,
    routeMap,
    registryCalls,
    runtimeRegistry,
    supervisorLockPath: path.join(directory, "supervisor.lock"),
    async cleanup() { await rm(directory, { recursive: true, force: true }); }
  };
}

function routeProvider(env, override) {
  return {
    async resolveVerifiedTaskRoute({ taskRef }) {
      if (override) return override(taskRef);
      return env.routeMap.get(taskRef) ?? null;
    }
  };
}

function makeSupervisor(env, {
  taskExecutor,
  maxGlobalConcurrency = 2,
  perProjectConcurrency = { [PROJECT_A]: 1, [PROJECT_B]: 1 },
  routeOverride,
  lockPath = env.supervisorLockPath
} = {}) {
  return createProjectSupervisor({
    projectStores: [
      {
        projectRef: PROJECT_A,
        taskStore: env.stores.get(PROJECT_A),
        maxConcurrency: perProjectConcurrency[PROJECT_A] ?? 1
      },
      {
        projectRef: PROJECT_B,
        taskStore: env.stores.get(PROJECT_B),
        maxConcurrency: perProjectConcurrency[PROJECT_B] ?? 1
      }
    ],
    runtimeRegistry: env.runtimeRegistry,
    taskRoutingProvider: routeProvider(env, routeOverride),
    taskExecutor: taskExecutor ?? {
      async executeTask() {
        return { state: "completed", evidenceRefs: ["evidence:task-complete"] };
      }
    },
    supervisorLockPath: lockPath,
    maxGlobalConcurrency,
    clock: () => new Date(NOW),
    workerRefFactory: (() => {
      let index = 0;
      return () => "worker:supervisor:" + (++index);
    })(),
    eventIdFactory: (() => {
      let index = 0;
      return () => "event:supervisor:" + (++index);
    })()
  });
}

async function enqueue(store, taskRef, manifestDigest, expectedRevision) {
  return store.enqueue({
    taskRef,
    manifestDigest,
    goal: "Complete " + taskRef + " within the registered project's mandate.",
    sourceRef: "source:operator",
    maxAttempts: 3,
    dependsOn: [],
    expectedRevision,
    actorRef: "actor:operator",
    reasonCode: "operator_requested"
  });
}

test("Supervisor composes one durable store per project and runs tasks to evidenced completion", async () => {
  const env = await makeEnvironment();
  try {
    await enqueue(env.stores.get(PROJECT_A), TASK_A1, MANIFEST_A, 0);
    const supervisor = makeSupervisor(env, {
      taskExecutor: {
        async executeTask(context) {
          assert.equal(context.projectRef, PROJECT_A);
          const plan = await context.preparePlan({
            contractVersion: "cormia.plan-proposal/0.1",
            steps: [{ operation: "workspace.list", input: {} }]
          });
          assert.equal(plan.accepted, true);
          assert.equal(Object.hasOwn(plan, "projectRef"), false);
          const executed = await context.executePlan(plan.planRef, plan.planDigest);
          assert.equal(executed.executed, true);
          return { state: "completed", evidenceRefs: ["evidence:" + context.task.taskRef] };
        }
      }
    });

    const started = await supervisor.start();
    assert.equal(started.started, true);
    const cycle = await supervisor.runCycle();
    assert.equal(cycle.scheduledCount, 1);
    assert.equal(cycle.results[0].state, "completed");
    assert.equal((await env.stores.get(PROJECT_A).read()).tasks[0].state, "completed");
    assert.equal((await env.stores.get(PROJECT_B).read()).tasks.length, 0);
    assert.deepEqual(env.registryCalls.map(call => ({
      method: call.method,
      keys: Object.keys(call.command).sort()
    })), [
      { method: "prepare", keys: ["proposal", "taskRef"] },
      { method: "execute", keys: ["expectedPlanDigest", "planRef", "taskRef"] }
    ]);
    await supervisor.stop();
  } finally {
    await env.cleanup();
  }
});

test("round-robin scheduling interleaves projects while respecting global and per-project caps", async () => {
  const env = await makeEnvironment();
  try {
    await enqueue(env.stores.get(PROJECT_A), TASK_A1, MANIFEST_A, 0);
    await enqueue(env.stores.get(PROJECT_A), TASK_A2, MANIFEST_A, 1);
    await enqueue(env.stores.get(PROJECT_B), TASK_B1, MANIFEST_B, 0);

    const startOrder = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let allStarted;
    const started = new Promise(resolve => { allStarted = resolve; });

    const supervisor = makeSupervisor(env, {
      maxGlobalConcurrency: 3,
      perProjectConcurrency: { [PROJECT_A]: 2, [PROJECT_B]: 1 },
      taskExecutor: {
        async executeTask(context) {
          startOrder.push(context.projectRef + "/" + context.task.taskRef);
          if (startOrder.length === 3) allStarted();
          await gate;
          return { state: "completed", evidenceRefs: ["evidence:" + context.task.taskRef] };
        }
      }
    });
    await supervisor.start();
    const cyclePromise = supervisor.runCycle();
    await started;
    release();
    const cycle = await cyclePromise;

    assert.deepEqual(startOrder, [
      PROJECT_A + "/" + TASK_A1,
      PROJECT_B + "/" + TASK_B1,
      PROJECT_A + "/" + TASK_A2
    ]);
    assert.equal(cycle.scheduledCount, 3);
    assert.equal(cycle.results.every(item => item.state === "completed"), true);
    await supervisor.stop();
  } finally {
    await env.cleanup();
  }
});

test("per-project concurrency cap leaves excess tasks queued for the next cycle", async () => {
  const env = await makeEnvironment();
  try {
    await enqueue(env.stores.get(PROJECT_A), TASK_A1, MANIFEST_A, 0);
    await enqueue(env.stores.get(PROJECT_A), TASK_A2, MANIFEST_A, 1);
    await enqueue(env.stores.get(PROJECT_B), TASK_B1, MANIFEST_B, 0);

    const supervisor = makeSupervisor(env, {
      maxGlobalConcurrency: 2,
      perProjectConcurrency: { [PROJECT_A]: 1, [PROJECT_B]: 1 }
    });
    await supervisor.start();

    const first = await supervisor.runCycle();
    assert.equal(first.scheduledCount, 2);
    assert.equal(first.remainingRunnableCount, 1);
    const aStates = (await env.stores.get(PROJECT_A).read()).tasks;
    assert.deepEqual(aStates.map(task => task.state), ["completed", "queued"]);

    const second = await supervisor.runCycle();
    assert.equal(second.scheduledCount, 1);
    assert.equal((await env.stores.get(PROJECT_A).read()).tasks.every(task => task.state === "completed"), true);
    await supervisor.stop();
  } finally {
    await env.cleanup();
  }
});

test("Supervisor startup recovers interrupted attempts and never auto-replays them", async () => {
  const env = await makeEnvironment();
  try {
    const store = env.stores.get(PROJECT_A);
    await enqueue(store, TASK_A1, MANIFEST_A, 0);
    await store.claim({
      taskRef: TASK_A1,
      workerRef: "worker:crashed",
      expectedRevision: 1,
      actorRef: "actor:old-supervisor",
      reasonCode: "claim_before_crash"
    });

    let executions = 0;
    const supervisor = makeSupervisor(env, {
      taskExecutor: {
        async executeTask() {
          executions += 1;
          return { state: "completed", evidenceRefs: ["evidence:must-not-run"] };
        }
      }
    });
    const started = await supervisor.start();
    assert.deepEqual(started.recovered[0].taskRefs, [TASK_A1]);
    assert.equal((await store.read()).tasks[0].state, "recovery_required");
    assert.equal((await supervisor.runCycle()).scheduledCount, 0);
    assert.equal(executions, 0);
    await supervisor.stop();
  } finally {
    await env.cleanup();
  }
});

test("proven pre-dispatch resource denial persists blocked, not recovery_required", async () => {
  const env = await makeEnvironment();
  try {
    await enqueue(env.stores.get(PROJECT_A), TASK_A1, MANIFEST_A, 0);
    const supervisor = makeSupervisor(env, {
      taskExecutor: {
        async executeTask(context) {
          await context.checkpoint({
            checkpointRef: "checkpoint:resource-denied:plan",
            effectBoundary: "no_external_effects",
            evidenceRefs: [],
            reasonCode: "resource_admission_denied_before_dispatch"
          });
          return {
            state: "blocked",
            reasonCode: "RESOURCE_ADMISSION_DENIED",
            evidenceRefs: []
          };
        }
      }
    });
    await supervisor.start();
    const cycle = await supervisor.runCycle();
    const stored = (await env.stores.get(PROJECT_A).read()).tasks[0];

    assert.equal(cycle.results[0].state, "blocked");
    assert.equal(stored.state, "blocked");
    assert.equal(stored.lastEffectBoundary, "no_external_effects");
    assert.equal(stored.reasonCode, "RESOURCE_ADMISSION_DENIED");
    assert.equal((await env.stores.get(PROJECT_A).listRunnable()).length, 0);
    await supervisor.stop();
  } finally {
    await env.cleanup();
  }
});

test("executor exception immediately persists recovery_required instead of requeueing", async () => {
  const env = await makeEnvironment();
  try {
    await enqueue(env.stores.get(PROJECT_A), TASK_A1, MANIFEST_A, 0);
    const supervisor = makeSupervisor(env, {
      taskExecutor: {
        async executeTask() {
          throw new Error("untrusted details are not persisted");
        }
      }
    });
    await supervisor.start();
    const cycle = await supervisor.runCycle();
    assert.equal(cycle.results[0].state, "recovery_required");
    assert.equal((await env.stores.get(PROJECT_A).read()).tasks[0].state, "recovery_required");
    assert.equal((await env.stores.get(PROJECT_A).listRunnable()).length, 0);
    await supervisor.stop();
  } finally {
    await env.cleanup();
  }
});

test("unverified or cross-project task route leaves task queued and dispatches nothing", async () => {
  const env = await makeEnvironment();
  try {
    await enqueue(env.stores.get(PROJECT_A), TASK_A1, MANIFEST_A, 0);
    let executions = 0;
    const supervisor = makeSupervisor(env, {
      routeOverride: async () => ({
        schemaVersion: "0.1.0",
        status: "verified",
        taskRef: TASK_A1,
        projectRef: PROJECT_B,
        manifestDigest: MANIFEST_A,
        routeDigest: ROUTE_A1
      }),
      taskExecutor: {
        async executeTask() {
          executions += 1;
          return { state: "completed", evidenceRefs: ["evidence:should-not-run"] };
        }
      }
    });
    await supervisor.start();
    const cycle = await supervisor.runCycle();
    assert.equal(cycle.scheduledCount, 0);
    assert.equal(cycle.skipped[0].reason, "TASK_ROUTE_UNVERIFIED_OR_MISMATCHED");
    assert.equal((await env.stores.get(PROJECT_A).read()).tasks[0].state, "queued");
    assert.equal(executions, 0);
    assert.equal((await supervisor.runUntilIdle()).idle, false);
    await supervisor.stop();
  } finally {
    await env.cleanup();
  }
});

test("only one local Supervisor can hold the configured process lock", async () => {
  const env = await makeEnvironment();
  try {
    const first = makeSupervisor(env);
    const second = makeSupervisor(env);
    await first.start();
    await assert.rejects(
      second.start(),
      error => error.code === "PROJECT_SUPERVISOR_LOCKED"
    );
    await first.stop();
    const restarted = await second.start();
    assert.equal(restarted.started, true);
    await second.stop();
  } finally {
    await env.cleanup();
  }
});

test("Supervisor validates store/runtime project registry equality and unique journal paths", async () => {
  const env = await makeEnvironment();
  try {
    const storeA = env.stores.get(PROJECT_A);
    assert.throws(() => createProjectSupervisor({
      projectStores: [{ projectRef: PROJECT_A, taskStore: storeA }],
      runtimeRegistry: env.runtimeRegistry,
      taskRoutingProvider: routeProvider(env),
      taskExecutor: { async executeTask() { return { state: "completed", evidenceRefs: ["evidence:x"] }; } },
      supervisorLockPath: env.supervisorLockPath
    }), /must register the same projects/);

    assert.throws(() => createProjectSupervisor({
      projectStores: [
        { projectRef: PROJECT_A, taskStore: storeA },
        { projectRef: PROJECT_B, taskStore: { ...storeA, projectRef: PROJECT_B } }
      ],
      runtimeRegistry: env.runtimeRegistry,
      taskRoutingProvider: routeProvider(env),
      taskExecutor: { async executeTask() { return { state: "completed", evidenceRefs: ["evidence:x"] }; } },
      supervisorLockPath: env.supervisorLockPath
    }), /own durable Project Task Store|share one task journal/);
  } finally {
    await env.cleanup();
  }
});

test("invalid runner outcomes cannot falsely complete tasks", async () => {
  const env = await makeEnvironment();
  try {
    await enqueue(env.stores.get(PROJECT_A), TASK_A1, MANIFEST_A, 0);
    const supervisor = makeSupervisor(env, {
      taskExecutor: {
        async executeTask() {
          return { state: "completed", evidenceRefs: [] };
        }
      }
    });
    await supervisor.start();
    const cycle = await supervisor.runCycle();
    assert.equal(cycle.results[0].state, "recovery_required");
    assert.equal((await env.stores.get(PROJECT_A).read()).tasks[0].state, "recovery_required");
    await supervisor.stop();
  } finally {
    await env.cleanup();
  }
});
