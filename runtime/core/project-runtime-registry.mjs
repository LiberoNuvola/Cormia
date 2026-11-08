/**
 * Host-only composition of project-scoped Plan–Execute runtimes.
 *
 * A Project Runtime captures one project's trusted resolver, Task Authority,
 * resource admission/provider ports and fixed operation adapters. The
 * registry selects a Runtime only from a host-verified task route; callers
 * never provide a projectRef.
 *
 * This is an in-process composition slice, not yet the durable Supervisor,
 * Task Engine, Project Descriptor registry or production Task Router.
 */

import {
  createPlanExecuteCapabilityBroker
} from "./plan-execute-capability-broker.mjs";

export const PROJECT_RUNTIME_CONTRACT_VERSION = "cormia.project-runtime/0.1";
export const PROJECT_RUNTIME_REGISTRY_VERSION = "cormia.project-runtime-registry/0.1";
export const TASK_ROUTE_SCHEMA_VERSION = "0.1.0";

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const MAX_PROJECT_REF_LENGTH = 512;
const MAX_TASK_REF_LENGTH = 256;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactDataKeys(value, required, optional = []) {
  if (!isPlainObject(value)) return false;
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== "string" || !allowed.has(key))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some(key => {
    const descriptor = descriptors[key];
    return !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value");
  })) return false;
  return required.every(key => Object.hasOwn(value, key));
}

function isText(value, maxLength) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value.length <= maxLength &&
    (typeof value.isWellFormed !== "function" || value.isWellFormed());
}

function blocked(reason, extra = {}) {
  return Object.freeze({ accepted: false, executed: false, state: "BLOCKED", reason, ...extra });
}

function validateTaskRoute(value, expectedTaskRef) {
  if (!hasExactDataKeys(value, [
    "schemaVersion", "status", "taskRef", "projectRef", "manifestDigest", "routeDigest"
  ]) ||
      value.schemaVersion !== TASK_ROUTE_SCHEMA_VERSION ||
      value.status !== "verified" ||
      value.taskRef !== expectedTaskRef ||
      !isText(value.projectRef, MAX_PROJECT_REF_LENGTH) ||
      typeof value.manifestDigest !== "string" ||
      !DIGEST_PATTERN.test(value.manifestDigest) ||
      typeof value.routeDigest !== "string" ||
      !DIGEST_PATTERN.test(value.routeDigest)) {
    return null;
  }
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    status: value.status,
    taskRef: value.taskRef,
    projectRef: value.projectRef,
    manifestDigest: value.manifestDigest,
    routeDigest: value.routeDigest
  });
}

function sameRoute(left, right) {
  return left.taskRef === right.taskRef &&
    left.projectRef === right.projectRef &&
    left.manifestDigest === right.manifestDigest &&
    left.routeDigest === right.routeDigest;
}

function requireFunction(value, method, label) {
  if (!value || typeof value[method] !== "function") {
    throw new TypeError(label + "." + method + " is required.");
  }
}

/**
 * Compose the existing broker with the trusted ports for exactly one project.
 * Every project gets a separate instance and therefore separate broker plan
 * state, resolver binding, Task Authority Provider and adapter registry.
 */
export function createProjectRuntime({
  projectRef,
  trustedProjectResolver,
  taskAuthorityProvider,
  resourceAdmissionProvider,
  resourceProvider,
  operationAdapters,
  clock,
  idFactory,
  maxSteps,
  maxPlanBytes,
  maxResultBytes
} = {}) {
  if (!isText(projectRef, MAX_PROJECT_REF_LENGTH)) {
    throw new TypeError("projectRef must be a host-resolved non-empty reference.");
  }
  requireFunction(trustedProjectResolver, "createTaskSession", "trustedProjectResolver");
  requireFunction(taskAuthorityProvider, "loadVerifiedTask", "taskAuthorityProvider");
  requireFunction(taskAuthorityProvider, "revalidateVerifiedTask", "taskAuthorityProvider");
  requireFunction(resourceAdmissionProvider, "resolveRequirement", "resourceAdmissionProvider");

  const broker = createPlanExecuteCapabilityBroker({
    trustedProjectResolver,
    taskAuthorityProvider,
    resourceAdmissionProvider,
    resourceProvider,
    operationAdapters,
    ...(clock === undefined ? {} : { clock }),
    ...(idFactory === undefined ? {} : { idFactory }),
    ...(maxSteps === undefined ? {} : { maxSteps }),
    ...(maxPlanBytes === undefined ? {} : { maxPlanBytes }),
    ...(maxResultBytes === undefined ? {} : { maxResultBytes })
  });

  async function preparePlan(command) {
    if (!hasExactDataKeys(command, ["taskRef", "proposal"]) ||
        !isText(command.taskRef, MAX_TASK_REF_LENGTH)) {
      return blocked("PROJECT_RUNTIME_PLAN_COMMAND_INVALID", { projectRef });
    }
    return broker.preparePlan(command);
  }

  async function executePlan(command) {
    if (!hasExactDataKeys(command, ["taskRef", "planRef", "expectedPlanDigest"]) ||
        !isText(command.taskRef, MAX_TASK_REF_LENGTH) ||
        !isText(command.planRef, MAX_TASK_REF_LENGTH) ||
        typeof command.expectedPlanDigest !== "string" ||
        !DIGEST_PATTERN.test(command.expectedPlanDigest)) {
      return Object.freeze({
        executed: false, state: "BLOCKED", reason: "PROJECT_RUNTIME_EXECUTE_COMMAND_INVALID"
      });
    }

    const status = broker.getPlanStatus(command.planRef);
    if (!status || status.taskRef !== command.taskRef ||
        status.planDigest !== command.expectedPlanDigest) {
      return Object.freeze({
        executed: false, state: "BLOCKED", reason: "PROJECT_RUNTIME_PLAN_BINDING_MISMATCH"
      });
    }
    return broker.executePlan({
      planRef: command.planRef,
      expectedPlanDigest: command.expectedPlanDigest
    });
  }

  function getPlanStatus(command) {
    if (!hasExactDataKeys(command, ["taskRef", "planRef"]) ||
        !isText(command.taskRef, MAX_TASK_REF_LENGTH) ||
        !isText(command.planRef, MAX_TASK_REF_LENGTH)) return null;

    const status = broker.getPlanStatus(command.planRef);
    if (!status || status.taskRef !== command.taskRef) return null;
    return status;
  }

  return Object.freeze({
    contractVersion: PROJECT_RUNTIME_CONTRACT_VERSION,
    projectRef,
    preparePlan,
    executePlan,
    getPlanStatus
  });
}

/**
 * Compose a fixed set of Project Runtimes. Task routing is resolved by a
 * trusted host port from taskRef; neither prepare nor execute accepts a
 * projectRef. The same route is checked before plan preparation, after
 * preparation and again immediately before execution.
 *
 * Runtime registrations are immutable for this instance. Project onboarding,
 * mandate verification and durable registry updates belong to a later
 * host-owned Supervisor/registry layer.
 */
export function createProjectRuntimeRegistry({
  projectRuntimes,
  taskRoutingProvider,
  maxPlanBindings = 10_000
} = {}) {
  if (!Array.isArray(projectRuntimes) || projectRuntimes.length < 1 ||
      projectRuntimes.length > 256) {
    throw new TypeError("projectRuntimes must contain between 1 and 256 host registrations.");
  }
  requireFunction(taskRoutingProvider, "resolveVerifiedTaskRoute", "taskRoutingProvider");
  if (!Number.isSafeInteger(maxPlanBindings) || maxPlanBindings < 1 || maxPlanBindings > 100_000) {
    throw new TypeError("maxPlanBindings must be an integer between 1 and 100000.");
  }

  const runtimes = new Map();
  for (const registration of projectRuntimes) {
    if (!hasExactDataKeys(registration, ["projectRef", "runtime"]) ||
        !isText(registration.projectRef, MAX_PROJECT_REF_LENGTH) ||
        !registration.runtime ||
        registration.runtime.contractVersion !== PROJECT_RUNTIME_CONTRACT_VERSION ||
        registration.runtime.projectRef !== registration.projectRef ||
        typeof registration.runtime.preparePlan !== "function" ||
        typeof registration.runtime.executePlan !== "function" ||
        typeof registration.runtime.getPlanStatus !== "function") {
      throw new TypeError("Each host registration must bind one valid Project Runtime to its projectRef.");
    }
    if (runtimes.has(registration.projectRef)) {
      throw new TypeError("Duplicate Project Runtime registration: " + registration.projectRef);
    }
    runtimes.set(registration.projectRef, registration.runtime);
  }

  const planBindings = new Map();

  async function resolveRoute(taskRef) {
    let raw;
    try {
      raw = await taskRoutingProvider.resolveVerifiedTaskRoute({ taskRef });
    } catch {
      return { ok: false, reason: "TASK_ROUTE_PROVIDER_FAILED" };
    }
    const route = validateTaskRoute(raw, taskRef);
    if (!route) return { ok: false, reason: "TASK_ROUTE_UNVERIFIED" };
    return { ok: true, route };
  }

  async function prepareTaskPlan(command) {
    if (!hasExactDataKeys(command, ["taskRef", "proposal"]) ||
        !isText(command.taskRef, MAX_TASK_REF_LENGTH)) {
      return blocked("REGISTRY_PLAN_COMMAND_INVALID");
    }

    const initial = await resolveRoute(command.taskRef);
    if (!initial.ok) return blocked(initial.reason);
    const runtime = runtimes.get(initial.route.projectRef);
    if (!runtime) return blocked("PROJECT_RUNTIME_NOT_REGISTERED", {
      projectRef: initial.route.projectRef
    });

    let prepared;
    try {
      prepared = await runtime.preparePlan({
        taskRef: command.taskRef,
        proposal: command.proposal
      });
    } catch {
      return blocked("PROJECT_RUNTIME_PREPARATION_FAILED", {
        projectRef: initial.route.projectRef
      });
    }

    if (!prepared || prepared.accepted !== true) {
      return Object.freeze({
        accepted: false,
        state: "BLOCKED",
        reason: typeof prepared?.reason === "string" ? prepared.reason : "PROJECT_RUNTIME_PLAN_REJECTED",
        projectRef: initial.route.projectRef
      });
    }

    if (!isText(prepared.planRef, MAX_TASK_REF_LENGTH) ||
        typeof prepared.planDigest !== "string" ||
        !DIGEST_PATTERN.test(prepared.planDigest) ||
        prepared.taskRef !== initial.route.taskRef ||
        prepared.manifestDigest !== initial.route.manifestDigest ||
        !Number.isSafeInteger(prepared.stepCount) || prepared.stepCount < 1) {
      return blocked("PROJECT_RUNTIME_PLAN_BINDING_INVALID", {
        projectRef: initial.route.projectRef
      });
    }

    const current = await resolveRoute(command.taskRef);
    if (!current.ok || !sameRoute(initial.route, current.route)) {
      return blocked("TASK_ROUTE_CHANGED_DURING_PREPARATION", {
        projectRef: initial.route.projectRef
      });
    }
    if (planBindings.size >= maxPlanBindings) {
      return blocked("PROJECT_RUNTIME_PLAN_BINDING_CAPACITY_REACHED", {
        projectRef: initial.route.projectRef
      });
    }
    if (planBindings.has(prepared.planRef)) {
      return blocked("PROJECT_RUNTIME_PLAN_REFERENCE_COLLISION", {
        projectRef: initial.route.projectRef
      });
    }

    planBindings.set(prepared.planRef, Object.freeze({
      taskRef: command.taskRef,
      projectRef: initial.route.projectRef,
      manifestDigest: initial.route.manifestDigest,
      routeDigest: initial.route.routeDigest,
      planDigest: prepared.planDigest
    }));

    return Object.freeze({
      accepted: true,
      state: "READY",
      taskRef: command.taskRef,
      projectRef: initial.route.projectRef,
      manifestDigest: initial.route.manifestDigest,
      routeDigest: initial.route.routeDigest,
      planRef: prepared.planRef,
      planDigest: prepared.planDigest,
      stepCount: prepared.stepCount
    });
  }

  async function executeTaskPlan(command) {
    if (!hasExactDataKeys(command, ["taskRef", "planRef", "expectedPlanDigest"]) ||
        !isText(command.taskRef, MAX_TASK_REF_LENGTH) ||
        !isText(command.planRef, MAX_TASK_REF_LENGTH) ||
        typeof command.expectedPlanDigest !== "string" ||
        !DIGEST_PATTERN.test(command.expectedPlanDigest)) {
      return Object.freeze({
        executed: false, state: "BLOCKED", reason: "REGISTRY_EXECUTE_COMMAND_INVALID"
      });
    }

    const binding = planBindings.get(command.planRef);
    if (!binding || binding.taskRef !== command.taskRef ||
        binding.planDigest !== command.expectedPlanDigest) {
      return Object.freeze({
        executed: false, state: "BLOCKED", reason: "REGISTRY_PLAN_BINDING_MISMATCH"
      });
    }

    const current = await resolveRoute(command.taskRef);
    if (!current.ok || current.route.projectRef !== binding.projectRef ||
        current.route.manifestDigest !== binding.manifestDigest ||
        current.route.routeDigest !== binding.routeDigest) {
      return Object.freeze({
        executed: false,
        state: "BLOCKED",
        reason: "TASK_ROUTE_CHANGED_BEFORE_EXECUTION",
        projectRef: binding.projectRef
      });
    }

    const runtime = runtimes.get(binding.projectRef);
    const status = runtime?.getPlanStatus({
      taskRef: command.taskRef,
      planRef: command.planRef
    });
    if (!status || status.taskRef !== command.taskRef ||
        status.planDigest !== command.expectedPlanDigest ||
        status.state !== "READY") {
      return Object.freeze({
        executed: false,
        state: "BLOCKED",
        reason: "REGISTRY_RUNTIME_PLAN_NOT_READY",
        projectRef: binding.projectRef
      });
    }

    let result;
    try {
      result = await runtime.executePlan({
        taskRef: command.taskRef,
        planRef: command.planRef,
        expectedPlanDigest: command.expectedPlanDigest
      });
    } catch {
      return Object.freeze({
        executed: false,
        state: "FAILED",
        reason: "PROJECT_RUNTIME_EXECUTION_FAILED",
        projectRef: binding.projectRef
      });
    }
    return Object.freeze({ ...result, projectRef: binding.projectRef });
  }

  function getTaskPlanStatus(command) {
    if (!hasExactDataKeys(command, ["taskRef", "planRef"]) ||
        !isText(command.taskRef, MAX_TASK_REF_LENGTH) ||
        !isText(command.planRef, MAX_TASK_REF_LENGTH)) return null;
    const binding = planBindings.get(command.planRef);
    if (!binding || binding.taskRef !== command.taskRef) return null;
    const runtime = runtimes.get(binding.projectRef);
    const status = runtime?.getPlanStatus(command);
    if (!status) return null;
    return Object.freeze({
      ...status,
      projectRef: binding.projectRef,
      manifestDigest: binding.manifestDigest,
      routeDigest: binding.routeDigest
    });
  }

  function listRegisteredProjects() {
    return Object.freeze([...runtimes.keys()].sort());
  }

  return Object.freeze({
    contractVersion: PROJECT_RUNTIME_REGISTRY_VERSION,
    prepareTaskPlan,
    executeTaskPlan,
    getTaskPlanStatus,
    listRegisteredProjects
  });
}
