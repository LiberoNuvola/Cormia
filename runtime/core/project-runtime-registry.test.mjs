import test from "node:test";
import assert from "node:assert/strict";

import {
  createProjectRuntime,
  createProjectRuntimeRegistry
} from "./project-runtime-registry.mjs";

const CONTRACT_VERSION = "cormia.plan-proposal/0.1";
const NOW = "2026-11-08T05:30:00.000Z";
const TASK_A = "task:immortal-a";
const TASK_B = "task:project-b";
const PROJECT_A = "project:immortal";
const PROJECT_B = "project:independent-b";
const DIGEST_A = "sha256:" + "a".repeat(64);
const DIGEST_B = "sha256:" + "b".repeat(64);
const ROUTE_A = "sha256:" + "c".repeat(64);
const ROUTE_B = "sha256:" + "d".repeat(64);

function route(taskRef, projectRef, manifestDigest, routeDigest) {
  return {
    schemaVersion: "0.1.0",
    status: "verified",
    taskRef,
    projectRef,
    manifestDigest,
    routeDigest
  };
}

function proposal() {
  return {
    contractVersion: CONTRACT_VERSION,
    steps: [{
      operation: "workspace.list",
      input: {}
    }]
  };
}

function makeRuntime({
  projectRef,
  taskRef,
  manifestDigest,
  planRef,
  dispatches,
  rejectOtherTasks = true
}) {
  const task = Object.freeze({
    taskId: taskRef,
    manifestDigest,
    requestedOperations: ["workspace.list"],
    expiresAt: null
  });

  const taskAuthorityProvider = {
    async loadVerifiedTask(requestedTaskRef) {
      if (requestedTaskRef !== taskRef && rejectOtherTasks) {
        throw new Error("task not bound to this project runtime");
      }
      if (requestedTaskRef !== taskRef) {
        return Object.freeze({
          taskId: requestedTaskRef,
          manifestDigest,
          requestedOperations: ["workspace.list"],
          expiresAt: null
        });
      }
      return task;
    },
    async revalidateVerifiedTask({ taskRef: requestedTaskRef }) {
      if (requestedTaskRef !== taskRef && rejectOtherTasks) {
        throw new Error("task not bound to this project runtime");
      }
      if (requestedTaskRef !== taskRef) {
        return Object.freeze({
          taskId: requestedTaskRef,
          manifestDigest,
          requestedOperations: ["workspace.list"],
          expiresAt: null
        });
      }
      return task;
    }
  };

  const trustedProjectResolver = {
    async createTaskSession(verifiedTask) {
      if (verifiedTask.taskId !== taskRef ||
          verifiedTask.manifestDigest !== manifestDigest) {
        return { authorized: false, reason: "TASK_PROJECT_BINDING_MISMATCH" };
      }
      return Object.freeze({
        authorized: true,
        taskId: taskRef,
        manifestDigest,
        async authorizeOperation(request) {
          return request.operation === "workspace.list"
            ? { allowed: true, reason: "TEST_HOST_AUTHORIZED", operation: request.operation }
            : { allowed: false, reason: "OPERATION_NOT_IN_TEST_PROFILE" };
        }
      });
    }
  };

  return createProjectRuntime({
    projectRef,
    trustedProjectResolver,
    taskAuthorityProvider,
    resourceAdmissionProvider: {
      async resolveRequirement() { return { required: false }; }
    },
    operationAdapters: {
      "workspace.list": {
        validateInput(input) { return input; },
        async execute(context) {
          dispatches.push({
            projectRef,
            taskRef: context.taskRef,
            operation: context.operation
          });
          return { executedByProject: projectRef };
        }
      }
    },
    clock: () => new Date(NOW),
    idFactory: () => planRef
  });
}

function makeRegistry({ routeMap, runtimes, resolveRouteOverride } = {}) {
  return createProjectRuntimeRegistry({
    projectRuntimes: runtimes,
    taskRoutingProvider: {
      async resolveVerifiedTaskRoute({ taskRef }) {
        if (resolveRouteOverride) return resolveRouteOverride(taskRef);
        return routeMap.get(taskRef) ?? null;
      }
    }
  });
}

test("one registry routes tasks to isolated project runtimes without caller-selected project identity", async () => {
  const dispatches = [];
  const runtimeA = makeRuntime({
    projectRef: PROJECT_A, taskRef: TASK_A, manifestDigest: DIGEST_A,
    planRef: "plan:immortal-a", dispatches
  });
  const runtimeB = makeRuntime({
    projectRef: PROJECT_B, taskRef: TASK_B, manifestDigest: DIGEST_B,
    planRef: "plan:project-b", dispatches
  });
  const routes = new Map([
    [TASK_A, route(TASK_A, PROJECT_A, DIGEST_A, ROUTE_A)],
    [TASK_B, route(TASK_B, PROJECT_B, DIGEST_B, ROUTE_B)]
  ]);
  const registry = makeRegistry({
    routeMap: routes,
    runtimes: [
      { projectRef: PROJECT_A, runtime: runtimeA },
      { projectRef: PROJECT_B, runtime: runtimeB }
    ]
  });

  assert.deepEqual(registry.listRegisteredProjects(), [PROJECT_A, PROJECT_B]);

  const planA = await registry.prepareTaskPlan({ taskRef: TASK_A, proposal: proposal() });
  const planB = await registry.prepareTaskPlan({ taskRef: TASK_B, proposal: proposal() });

  assert.equal(planA.accepted, true);
  assert.equal(planA.projectRef, PROJECT_A);
  assert.equal(planA.manifestDigest, DIGEST_A);
  assert.equal(planB.accepted, true);
  assert.equal(planB.projectRef, PROJECT_B);
  assert.equal(planB.manifestDigest, DIGEST_B);
  assert.deepEqual(dispatches, []);

  const resultA = await registry.executeTaskPlan({
    taskRef: TASK_A, planRef: planA.planRef, expectedPlanDigest: planA.planDigest
  });
  const resultB = await registry.executeTaskPlan({
    taskRef: TASK_B, planRef: planB.planRef, expectedPlanDigest: planB.planDigest
  });

  assert.equal(resultA.executed, true);
  assert.equal(resultA.projectRef, PROJECT_A);
  assert.equal(resultB.executed, true);
  assert.equal(resultB.projectRef, PROJECT_B);
  assert.deepEqual(dispatches, [
    { projectRef: PROJECT_A, taskRef: TASK_A, operation: "workspace.list" },
    { projectRef: PROJECT_B, taskRef: TASK_B, operation: "workspace.list" }
  ]);
});

test("request cannot nominate a projectRef or add unrecognized routing fields", async () => {
  const dispatches = [];
  const runtimeA = makeRuntime({
    projectRef: PROJECT_A, taskRef: TASK_A, manifestDigest: DIGEST_A,
    planRef: "plan:strict", dispatches
  });
  const registry = makeRegistry({
    routeMap: new Map([[TASK_A, route(TASK_A, PROJECT_A, DIGEST_A, ROUTE_A)]]),
    runtimes: [{ projectRef: PROJECT_A, runtime: runtimeA }]
  });

  const result = await registry.prepareTaskPlan({
    taskRef: TASK_A,
    projectRef: PROJECT_B,
    proposal: proposal()
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "REGISTRY_PLAN_COMMAND_INVALID");
  assert.deepEqual(dispatches, []);
});

test("unregistered projects fail closed without invoking any runtime", async () => {
  const dispatches = [];
  const runtimeA = makeRuntime({
    projectRef: PROJECT_A, taskRef: TASK_A, manifestDigest: DIGEST_A,
    planRef: "plan:unregistered", dispatches
  });
  const registry = makeRegistry({
    routeMap: new Map([[TASK_B, route(TASK_B, "project:not-registered", DIGEST_B, ROUTE_B)]]),
    runtimes: [{ projectRef: PROJECT_A, runtime: runtimeA }]
  });

  const result = await registry.prepareTaskPlan({ taskRef: TASK_B, proposal: proposal() });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "PROJECT_RUNTIME_NOT_REGISTERED");
  assert.deepEqual(dispatches, []);
});

test("a route change after PLAN prevents EXECUTE and causes zero dispatches", async () => {
  const dispatches = [];
  const runtimeA = makeRuntime({
    projectRef: PROJECT_A, taskRef: TASK_A, manifestDigest: DIGEST_A,
    planRef: "plan:route-change", dispatches
  });
  let currentRoute = route(TASK_A, PROJECT_A, DIGEST_A, ROUTE_A);
  const registry = makeRegistry({
    runtimes: [{ projectRef: PROJECT_A, runtime: runtimeA }],
    resolveRouteOverride: async () => currentRoute
  });

  const prepared = await registry.prepareTaskPlan({ taskRef: TASK_A, proposal: proposal() });
  assert.equal(prepared.accepted, true);
  currentRoute = route(TASK_A, PROJECT_B, DIGEST_A, ROUTE_B);

  const result = await registry.executeTaskPlan({
    taskRef: TASK_A, planRef: prepared.planRef, expectedPlanDigest: prepared.planDigest
  });
  assert.equal(result.executed, false);
  assert.equal(result.reason, "TASK_ROUTE_CHANGED_BEFORE_EXECUTION");
  assert.deepEqual(dispatches, []);
});

test("plan references remain bound to their original task and cannot be replayed for another task", async () => {
  const dispatches = [];
  const runtimeA = makeRuntime({
    projectRef: PROJECT_A, taskRef: TASK_A, manifestDigest: DIGEST_A,
    planRef: "plan:task-binding", dispatches
  });
  const registry = makeRegistry({
    routeMap: new Map([[TASK_A, route(TASK_A, PROJECT_A, DIGEST_A, ROUTE_A)]]),
    runtimes: [{ projectRef: PROJECT_A, runtime: runtimeA }]
  });

  const prepared = await registry.prepareTaskPlan({ taskRef: TASK_A, proposal: proposal() });
  const result = await registry.executeTaskPlan({
    taskRef: TASK_B, planRef: prepared.planRef, expectedPlanDigest: prepared.planDigest
  });

  assert.equal(result.executed, false);
  assert.equal(result.reason, "REGISTRY_PLAN_BINDING_MISMATCH");
  assert.deepEqual(dispatches, []);
});

test("runtime's project-bound Task Authority rejects a task routed to the wrong project", async () => {
  const dispatches = [];
  const runtimeB = makeRuntime({
    projectRef: PROJECT_B, taskRef: TASK_B, manifestDigest: DIGEST_B,
    planRef: "plan:wrong-runtime", dispatches
  });
  const registry = makeRegistry({
    routeMap: new Map([[TASK_A, route(TASK_A, PROJECT_B, DIGEST_A, ROUTE_B)]]),
    runtimes: [{ projectRef: PROJECT_B, runtime: runtimeB }]
  });

  const result = await registry.prepareTaskPlan({ taskRef: TASK_A, proposal: proposal() });
  assert.equal(result.accepted, false);
  assert.match(result.reason, /TASK_AUTHORITY_LOAD_FAILED|TASK_AUTHORITY/);
  assert.deepEqual(dispatches, []);
});

test("duplicate project registration is rejected", () => {
  const dispatches = [];
  const runtime = makeRuntime({
    projectRef: PROJECT_A, taskRef: TASK_A, manifestDigest: DIGEST_A,
    planRef: "plan:duplicate", dispatches
  });
  assert.throws(() => createProjectRuntimeRegistry({
    projectRuntimes: [
      { projectRef: PROJECT_A, runtime },
      { projectRef: PROJECT_A, runtime }
    ],
    taskRoutingProvider: { async resolveVerifiedTaskRoute() { return null; } }
  }), /Duplicate Project Runtime registration/);
});

test("unverified or unavailable host task route fails closed", async () => {
  const dispatches = [];
  const runtime = makeRuntime({
    projectRef: PROJECT_A, taskRef: TASK_A, manifestDigest: DIGEST_A,
    planRef: "plan:route-denied", dispatches
  });
  const registry = makeRegistry({
    runtimes: [{ projectRef: PROJECT_A, runtime }],
    resolveRouteOverride: async () => {
      throw new Error("private provider details");
    }
  });

  const result = await registry.prepareTaskPlan({ taskRef: TASK_A, proposal: proposal() });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "TASK_ROUTE_PROVIDER_FAILED");
  assert.equal(JSON.stringify(result).includes("private provider details"), false);
  assert.deepEqual(dispatches, []);
});

test("project runtime refuses cross-task and malformed execution commands", async () => {
  const dispatches = [];
  const runtime = makeRuntime({
    projectRef: PROJECT_A, taskRef: TASK_A, manifestDigest: DIGEST_A,
    planRef: "plan:runtime-api", dispatches
  });
  const prepared = await runtime.preparePlan({ taskRef: TASK_A, proposal: proposal() });
  assert.equal(prepared.accepted, true);

  const mismatched = await runtime.executePlan({
    taskRef: TASK_B,
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest
  });
  assert.equal(mismatched.executed, false);
  assert.equal(mismatched.reason, "PROJECT_RUNTIME_PLAN_BINDING_MISMATCH");

  const extraField = await runtime.executePlan({
    taskRef: TASK_A,
    planRef: prepared.planRef,
    expectedPlanDigest: prepared.planDigest,
    projectRef: PROJECT_B
  });
  assert.equal(extraField.executed, false);
  assert.equal(extraField.reason, "PROJECT_RUNTIME_EXECUTE_COMMAND_INVALID");
  assert.deepEqual(dispatches, []);
});
