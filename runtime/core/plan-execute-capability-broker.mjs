/**
 * Core-owned Plan–Execute and Capability Broker boundary.
 *
 * A provider/model may submit a bounded inert plan proposal. This module
 * binds it to a host-verified task, obtains a task session from the trusted
 * project resolver, validates every operation during PLAN, and revalidates
 * authority immediately before each host adapter dispatch during EXECUTE.
 *
 * All authority, resource-admission and operation-adapter ports are captured
 * from trusted host composition. None can be supplied by a plan/model.
 *
 * This module is an isolated Core enforcement slice. Production identity,
 * mandate, consent, revocation, Task Manifest and concrete operation adapters
 * must still be supplied by trusted host integrations.
 */

import { createHash, randomUUID } from "node:crypto";

export const PLAN_PROPOSAL_CONTRACT_VERSION = "cormia.plan-proposal/0.1";
export const PLAN_EXECUTE_BROKER_VERSION = "cormia.plan-execute-broker/0.1";

const DEFAULT_MAX_STEPS = 32;
const DEFAULT_MAX_PLAN_BYTES = 262_144;
const DEFAULT_MAX_RESULT_BYTES = 1_048_576;
const MAX_DEPTH = 12;
const MAX_NODES = 20_000;
const MAX_STRING_LENGTH = 262_144;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

const AUTHORIZATION_FIELDS = Object.freeze([
  "relativePath",
  "executionProfileId",
  "branchName",
  "remoteHost"
]);

const STEP_KEYS = Object.freeze([
  "operation",
  "input",
  ...AUTHORIZATION_FIELDS
]);

export class PlanExecuteBrokerError extends Error {
  constructor(code) {
    super(code);
    this.name = "PlanExecuteBrokerError";
    this.code = code;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactDataObject(value, requiredKeys, optionalKeys = []) {
  if (!isPlainObject(value)) return false;
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== "string" || !allowed.has(key))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some(key => {
    const descriptor = descriptors[key];
    return !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value");
  })) return false;
  return requiredKeys.every(key => Object.hasOwn(value, key));
}

function requireText(value, max = 256) {
  if (typeof value !== "string" || value.trim().length === 0 ||
      value.length > max ||
      (typeof value.isWellFormed === "function" && !value.isWellFormed())) {
    throw new PlanExecuteBrokerError("INVALID_TEXT_FIELD");
  }
  return value;
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function resolveClock(clock) {
  const value = clock();
  const milliseconds = value instanceof Date ? value.getTime() :
    typeof value === "string" ? Date.parse(value) :
    typeof value === "number" ? value : NaN;
  if (!Number.isFinite(milliseconds)) {
    throw new PlanExecuteBrokerError("HOST_CLOCK_INVALID");
  }
  return new Date(milliseconds);
}

function copyJsonData(value, {
  maxBytes,
  maxDepth = MAX_DEPTH,
  maxNodes = MAX_NODES
} = {}) {
  const active = new WeakSet();
  let nodes = 0;

  function visit(current, depth) {
    nodes += 1;
    if (nodes > maxNodes || depth > maxDepth) {
      throw new PlanExecuteBrokerError("JSON_DATA_LIMIT_EXCEEDED");
    }

    if (current === null || typeof current === "boolean") return current;
    if (typeof current === "string") {
      if (current.length > MAX_STRING_LENGTH ||
          (typeof current.isWellFormed === "function" && !current.isWellFormed())) {
        throw new PlanExecuteBrokerError("JSON_STRING_INVALID");
      }
      return current;
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw new PlanExecuteBrokerError("JSON_NUMBER_INVALID");
      return current;
    }
    if (typeof current !== "object") {
      throw new PlanExecuteBrokerError("JSON_VALUE_UNSUPPORTED");
    }
    if (active.has(current)) throw new PlanExecuteBrokerError("JSON_CYCLE_UNSUPPORTED");
    active.add(current);

    let result;
    if (Array.isArray(current)) {
      const keys = Reflect.ownKeys(current);
      if (keys.some(key => key !== "length" &&
          (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key)))) {
        throw new PlanExecuteBrokerError("JSON_ARRAY_PROPERTIES_UNSUPPORTED");
      }
      result = [];
      for (let index = 0; index < current.length; index += 1) {
        if (!Object.hasOwn(current, index)) throw new PlanExecuteBrokerError("JSON_ARRAY_HOLE_UNSUPPORTED");
        const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
          throw new PlanExecuteBrokerError("JSON_ACCESSOR_UNSUPPORTED");
        }
        result.push(visit(descriptor.value, depth + 1));
      }
    } else {
      if (!isPlainObject(current)) throw new PlanExecuteBrokerError("JSON_OBJECT_PROTOTYPE_UNSUPPORTED");
      const keys = Reflect.ownKeys(current);
      if (keys.some(key => typeof key !== "string" ||
          key === "__proto__" || key === "prototype" || key === "constructor")) {
        throw new PlanExecuteBrokerError("JSON_OBJECT_KEY_UNSUPPORTED");
      }
      const descriptors = Object.getOwnPropertyDescriptors(current);
      result = Object.create(null);
      for (const key of keys.sort()) {
        const descriptor = descriptors[key];
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
          throw new PlanExecuteBrokerError("JSON_ACCESSOR_UNSUPPORTED");
        }
        result[key] = visit(descriptor.value, depth + 1);
      }
    }

    active.delete(current);
    return result;
  }

  const copy = visit(value, 0);
  const encoded = JSON.stringify(copy);
  if (maxBytes !== undefined && Buffer.byteLength(encoded, "utf8") > maxBytes) {
    throw new PlanExecuteBrokerError("JSON_BYTE_LIMIT_EXCEEDED");
  }
  return copy;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  if (value !== null && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ":" + stableStringify(value[key])
    ).join(",") + "}";
  }
  return JSON.stringify(value);
}

function digest(value) {
  return "sha256:" + createHash("sha256")
    .update(stableStringify(value), "utf8")
    .digest("hex");
}

function validateTaskProjection(value, expectedTaskRef) {
  if (!exactDataObject(value, [
    "taskId", "manifestDigest", "requestedOperations", "expiresAt"
  ]) ||
      typeof value.taskId !== "string" ||
      value.taskId !== expectedTaskRef ||
      typeof value.manifestDigest !== "string" ||
      !DIGEST_PATTERN.test(value.manifestDigest) ||
      !Array.isArray(value.requestedOperations) ||
      value.requestedOperations.length < 1 ||
      value.requestedOperations.length > 128 ||
      !value.requestedOperations.every(item =>
        typeof item === "string" && item.length > 0 && item.length <= 128
      ) ||
      new Set(value.requestedOperations).size !== value.requestedOperations.length ||
      !(value.expiresAt === null ||
        (typeof value.expiresAt === "string" && Number.isFinite(parseTimestamp(value.expiresAt))))) {
    throw new PlanExecuteBrokerError("VERIFIED_TASK_PROJECTION_INVALID");
  }

  return deepFreeze(copyJsonData(value, { maxBytes: 16_384 }));
}

function validateProposal(value, { maxSteps, maxPlanBytes }) {
  if (!exactDataObject(value, ["contractVersion", "steps"]) ||
      value.contractVersion !== PLAN_PROPOSAL_CONTRACT_VERSION ||
      !Array.isArray(value.steps) ||
      value.steps.length < 1 ||
      value.steps.length > maxSteps) {
    throw new PlanExecuteBrokerError("PLAN_PROPOSAL_INVALID");
  }

  const copied = copyJsonData(value, { maxBytes: maxPlanBytes });
  const steps = [];

  for (const sourceStep of copied.steps) {
    if (!exactDataObject(sourceStep, ["operation", "input"], AUTHORIZATION_FIELDS)) {
      throw new PlanExecuteBrokerError("PLAN_STEP_SHAPE_INVALID");
    }
    requireText(sourceStep.operation, 128);
    if (!isPlainObject(sourceStep.input)) {
      throw new PlanExecuteBrokerError("PLAN_STEP_INPUT_INVALID");
    }
    const step = Object.create(null);
    step.operation = sourceStep.operation;
    step.input = sourceStep.input;
    for (const field of AUTHORIZATION_FIELDS) {
      if (Object.hasOwn(sourceStep, field)) {
        requireText(sourceStep[field], field === "relativePath" ? 512 : 256);
        step[field] = sourceStep[field];
      }
    }
    steps.push(deepFreeze(step));
  }

  return steps;
}

function validateAdapterRegistry(registry) {
  if (!isPlainObject(registry)) throw new TypeError("operationAdapters must be a host-owned plain object.");
  const keys = Reflect.ownKeys(registry);
  const descriptors = Object.getOwnPropertyDescriptors(registry);
  const result = new Map();

  for (const key of keys) {
    if (typeof key !== "string" || key.trim().length === 0) {
      throw new TypeError("operation adapter keys must be non-empty strings.");
    }
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      throw new TypeError("operation adapter registry must not contain accessors.");
    }
    const adapter = descriptor.value;
    if (!exactDataObject(adapter, ["validateInput", "execute"]) ||
        typeof adapter.validateInput !== "function" ||
        typeof adapter.execute !== "function") {
      throw new TypeError("each operation adapter requires host validateInput and execute functions.");
    }
    result.set(key, Object.freeze({
      validateInput: adapter.validateInput,
      execute: adapter.execute
    }));
  }

  if (result.size === 0) throw new TypeError("at least one host operation adapter is required.");
  return result;
}

function validateResourceRequirement(value) {
  if (exactDataObject(value, ["required"]) && value.required === false) {
    return Object.freeze({ required: false });
  }
  if (exactDataObject(value, [
    "required", "offerId", "capabilityProfileRef", "requestedCapacity"
  ]) && value.required === true &&
      typeof value.offerId === "string" && value.offerId.length > 0 &&
      typeof value.capabilityProfileRef === "string" && value.capabilityProfileRef.length > 0 &&
      exactDataObject(value.requestedCapacity, ["quantity", "unit"]) &&
      typeof value.requestedCapacity.quantity === "number" &&
      Number.isFinite(value.requestedCapacity.quantity) && value.requestedCapacity.quantity > 0 &&
      typeof value.requestedCapacity.unit === "string" &&
      value.requestedCapacity.unit.length > 0) {
    return deepFreeze(copyJsonData(value, { maxBytes: 4_096 }));
  }
  throw new PlanExecuteBrokerError("RESOURCE_REQUIREMENT_INVALID");
}

function adapterInput(adapter, input, context) {
  const normalized = adapter.validateInput(deepFreeze(copyJsonData(input)), Object.freeze(context));
  if (normalized && typeof normalized.then === "function") {
    throw new PlanExecuteBrokerError("ASYNC_INPUT_VALIDATOR_UNSUPPORTED");
  }
  const copied = copyJsonData(normalized, { maxBytes: DEFAULT_MAX_PLAN_BYTES });
  if (!isPlainObject(copied)) throw new PlanExecuteBrokerError("ADAPTER_INPUT_INVALID");
  return deepFreeze(copied);
}

function authorizationRequest(step) {
  const request = { operation: step.operation };
  for (const field of AUTHORIZATION_FIELDS) {
    if (Object.hasOwn(step, field)) request[field] = step[field];
  }
  return request;
}

function errorCode(error, fallback) {
  return typeof error?.code === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(error.code)
    ? error.code
    : fallback;
}

export function createPlanExecuteCapabilityBroker({
  trustedProjectResolver,
  taskAuthorityProvider,
  resourceAdmissionProvider,
  resourceProvider,
  operationAdapters,
  clock = () => new Date(),
  idFactory = randomUUID,
  maxSteps = DEFAULT_MAX_STEPS,
  maxPlanBytes = DEFAULT_MAX_PLAN_BYTES,
  maxResultBytes = DEFAULT_MAX_RESULT_BYTES
} = {}) {
  if (!trustedProjectResolver ||
      typeof trustedProjectResolver.createTaskSession !== "function") {
    throw new TypeError("trustedProjectResolver.createTaskSession is required.");
  }
  if (!taskAuthorityProvider ||
      typeof taskAuthorityProvider.loadVerifiedTask !== "function" ||
      typeof taskAuthorityProvider.revalidateVerifiedTask !== "function") {
    throw new TypeError("taskAuthorityProvider.loadVerifiedTask and revalidateVerifiedTask are required.");
  }
  if (!resourceAdmissionProvider ||
      typeof resourceAdmissionProvider.resolveRequirement !== "function") {
    throw new TypeError("resourceAdmissionProvider.resolveRequirement is required.");
  }
  if (resourceProvider !== undefined &&
      typeof resourceProvider.withLease !== "function") {
    throw new TypeError("resourceProvider.withLease must be callable when configured.");
  }
  if (typeof clock !== "function" || typeof idFactory !== "function") {
    throw new TypeError("clock and idFactory must be trusted host functions.");
  }
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 128 ||
      !Number.isSafeInteger(maxPlanBytes) || maxPlanBytes < 1_024 || maxPlanBytes > 2_000_000 ||
      !Number.isSafeInteger(maxResultBytes) || maxResultBytes < 1_024 || maxResultBytes > 4_000_000) {
    throw new TypeError("broker limits are outside the supported bounds.");
  }

  const adapters = validateAdapterRegistry(operationAdapters);
  const plans = new Map();

  function now() {
    return resolveClock(clock);
  }

  function activePlan(planRef) {
    requireText(planRef, 256);
    return plans.get(planRef) ?? null;
  }

  async function revalidateTaskProjection(task) {
    let current;
    try {
      current = validateTaskProjection(
        await taskAuthorityProvider.revalidateVerifiedTask({
          taskRef: task.taskId,
          expectedManifestDigest: task.manifestDigest
        }),
        task.taskId
      );
    } catch {
      throw new PlanExecuteBrokerError("TASK_AUTHORITY_REVALIDATION_FAILED");
    }
    if (stableStringify(current) !== stableStringify(task)) {
      throw new PlanExecuteBrokerError("TASK_AUTHORITY_CHANGED");
    }
    if (current.expiresAt !== null && parseTimestamp(current.expiresAt) <= now().getTime()) {
      throw new PlanExecuteBrokerError("TASK_AUTHORITY_EXPIRED");
    }
    return current;
  }

  async function preparePlan(command) {
    if (!exactDataObject(command, ["taskRef", "proposal"])) {
      return { accepted: false, state: "BLOCKED", reason: "PLAN_COMMAND_INVALID" };
    }

    let taskRef;
    let proposalSteps;
    let task;
    let session;

    try {
      taskRef = requireText(command.taskRef, 256);
      const nowDate = now();
      const verifiedProjection = await taskAuthorityProvider.loadVerifiedTask(taskRef);
      task = validateTaskProjection(verifiedProjection, taskRef);
      if (task.expiresAt !== null && parseTimestamp(task.expiresAt) <= nowDate.getTime()) {
        return { accepted: false, state: "BLOCKED", reason: "TASK_AUTHORITY_EXPIRED" };
      }

      proposalSteps = validateProposal(command.proposal, { maxSteps, maxPlanBytes });
      session = await trustedProjectResolver.createTaskSession(task);
      if (!session || session.authorized !== true ||
          session.taskId !== task.taskId ||
          session.manifestDigest !== task.manifestDigest ||
          typeof session.authorizeOperation !== "function") {
        return {
          accepted: false,
          state: "BLOCKED",
          reason: typeof session?.reason === "string" ? session.reason : "TRUSTED_TASK_SESSION_UNAVAILABLE"
        };
      }

      const preparedSteps = [];
      for (let index = 0; index < proposalSteps.length; index += 1) {
        const proposed = proposalSteps[index];
        const adapter = adapters.get(proposed.operation);
        if (!adapter) {
          return {
            accepted: false,
            state: "BLOCKED",
            reason: "OPERATION_ADAPTER_UNAVAILABLE",
            stepIndex: index
          };
        }

        let input;
        try {
          const adapterValidationContext = {
            phase: "PLAN",
            taskRef,
            operation: proposed.operation
          };
          for (const field of AUTHORIZATION_FIELDS) {
            if (Object.hasOwn(proposed, field)) {
              adapterValidationContext[field] = proposed[field];
            }
          }
          input = adapterInput(adapter, proposed.input, adapterValidationContext);
        } catch {
          return {
            accepted: false,
            state: "BLOCKED",
            reason: "OPERATION_INPUT_REJECTED",
            stepIndex: index
          };
        }

        const auth = await session.authorizeOperation(authorizationRequest(proposed));
        if (auth?.allowed !== true) {
          return {
            accepted: false,
            state: "BLOCKED",
            reason: typeof auth?.reason === "string" ? auth.reason : "OPERATION_NOT_AUTHORIZED",
            stepIndex: index
          };
        }

        preparedSteps.push({
          stepRef: "step:" + (index + 1),
          operation: proposed.operation,
          authorization: authorizationRequest(proposed),
          input,
          adapter
        });
      }

      const planRef = requireText(idFactory(), 256);
      if (plans.has(planRef)) {
        return { accepted: false, state: "BLOCKED", reason: "PLAN_REFERENCE_COLLISION" };
      }
      const createdAt = now().toISOString();
      const digestPayload = {
        contractVersion: PLAN_EXECUTE_BROKER_VERSION,
        planRef,
        taskRef: task.taskId,
        manifestDigest: task.manifestDigest,
        createdAt,
        steps: preparedSteps.map(step => ({
          stepRef: step.stepRef,
          operation: step.operation,
          authorization: step.authorization,
          input: step.input
        }))
      };
      const planDigest = digest(digestPayload);
      const record = {
        planRef,
        planDigest,
        task,
        session,
        preparedSteps,
        createdAt,
        state: "READY"
      };
      plans.set(planRef, record);

      return Object.freeze({
        accepted: true,
        state: "READY",
        planRef,
        planDigest,
        taskRef: task.taskId,
        manifestDigest: task.manifestDigest,
        stepCount: preparedSteps.length,
        createdAt
      });
    } catch (error) {
      return {
        accepted: false,
        state: "BLOCKED",
        reason: errorCode(error, "PLAN_PREPARATION_FAILED")
      };
    }
  }

  async function executePlan(command) {
    if (!exactDataObject(command, ["planRef", "expectedPlanDigest"]) ||
        typeof command.planRef !== "string" ||
        typeof command.expectedPlanDigest !== "string" ||
        !DIGEST_PATTERN.test(command.expectedPlanDigest)) {
      return { executed: false, state: "BLOCKED", reason: "EXECUTE_COMMAND_INVALID" };
    }

    const record = activePlan(command.planRef);
    if (!record) return { executed: false, state: "BLOCKED", reason: "PLAN_NOT_FOUND" };
    if (record.state !== "READY") {
      return { executed: false, state: record.state, reason: "PLAN_NOT_EXECUTABLE" };
    }
    if (record.planDigest !== command.expectedPlanDigest) {
      return { executed: false, state: "BLOCKED", reason: "PLAN_DIGEST_MISMATCH" };
    }

    // This synchronous state change fences concurrent and duplicate requests
    // before the first await or any external side effect.
    record.state = "EXECUTING";
    const completed = [];

    try {
      for (const step of record.preparedSteps) {
        const nowDate = now();
        if (record.task.expiresAt !== null &&
            parseTimestamp(record.task.expiresAt) <= nowDate.getTime()) {
          throw new PlanExecuteBrokerError("TASK_AUTHORITY_EXPIRED");
        }

        await revalidateTaskProjection(record.task);
        const preflight = await record.session.authorizeOperation(step.authorization);
        if (preflight?.allowed !== true) {
          throw new PlanExecuteBrokerError(
            typeof preflight?.reason === "string" ? preflight.reason : "OPERATION_NOT_AUTHORIZED"
          );
        }

        const requirement = validateResourceRequirement(
          await resourceAdmissionProvider.resolveRequirement(Object.freeze({
            taskRef: record.task.taskId,
            manifestDigest: record.task.manifestDigest,
            operation: step.operation,
            input: deepFreeze(copyJsonData(step.input))
          }))
        );

        const dispatch = async leaseContext => {
          if (requirement.required && (!leaseContext ||
              !isPlainObject(leaseContext.lease) ||
              leaseContext.lease.leaseState !== "active" ||
              typeof leaseContext.assertActive !== "function")) {
            throw new PlanExecuteBrokerError("RESOURCE_LEASE_CONTEXT_INVALID");
          }
          if (leaseContext && typeof leaseContext.assertActive === "function") {
            leaseContext.assertActive();
          }

          // Re-resolve mandate, consent, revocation, lifecycle and host policy
          // after resource admission and immediately before the host adapter.
          await revalidateTaskProjection(record.task);
          const finalAuthorization = await record.session.authorizeOperation(step.authorization);
          if (finalAuthorization?.allowed !== true) {
            throw new PlanExecuteBrokerError(
              typeof finalAuthorization?.reason === "string"
                ? finalAuthorization.reason
                : "OPERATION_NOT_AUTHORIZED"
            );
          }
          if (leaseContext && typeof leaseContext.assertActive === "function") {
            leaseContext.assertActive();
          }

          const result = await step.adapter.execute(Object.freeze({
            taskRef: record.task.taskId,
            manifestDigest: record.task.manifestDigest,
            planRef: record.planRef,
            planDigest: record.planDigest,
            stepRef: step.stepRef,
            operation: step.operation,
            input: deepFreeze(copyJsonData(step.input)),
            authorization: Object.freeze({
              allowed: true,
              reason: finalAuthorization.reason,
              operation: finalAuthorization.operation
            }),
            resourceLease: leaseContext?.lease ?? null,
            assertResourceActive: leaseContext &&
              typeof leaseContext.assertActive === "function"
              ? leaseContext.assertActive
              : () => true
          }));
          return deepFreeze(copyJsonData(result, { maxBytes: maxResultBytes }));
        };

        let result;
        if (requirement.required) {
          if (!resourceProvider) {
            throw new PlanExecuteBrokerError("RESOURCE_PROVIDER_UNAVAILABLE");
          }
          const admission = await resourceProvider.withLease({
            offerId: requirement.offerId,
            consumerTaskRef: record.task.taskId,
            capabilityProfileRef: requirement.capabilityProfileRef,
            requestedCapacity: requirement.requestedCapacity,
            run: dispatch
          });
          if (!admission || admission.allowed !== true ||
              admission.lease?.leaseState !== "released") {
            throw new PlanExecuteBrokerError("RESOURCE_ADMISSION_DENIED");
          }
          result = admission.result;
        } else {
          result = await dispatch(null);
        }

        completed.push(Object.freeze({
          stepRef: step.stepRef,
          operation: step.operation,
          result
        }));
      }

      record.state = "COMPLETED";
      return Object.freeze({
        executed: true,
        state: "COMPLETED",
        planRef: record.planRef,
        planDigest: record.planDigest,
        completedStepCount: completed.length,
        steps: Object.freeze(completed)
      });
    } catch (error) {
      record.state = "FAILED";
      return Object.freeze({
        executed: false,
        state: "FAILED",
        planRef: record.planRef,
        planDigest: record.planDigest,
        reason: errorCode(error, "EXECUTION_FAILED"),
        completedStepCount: completed.length
      });
    }
  }

  function getPlanStatus(planRef) {
    const record = activePlan(planRef);
    if (!record) return null;
    return Object.freeze({
      planRef: record.planRef,
      planDigest: record.planDigest,
      taskRef: record.task.taskId,
      state: record.state,
      stepCount: record.preparedSteps.length,
      createdAt: record.createdAt
    });
  }

  return Object.freeze({
    contractVersion: PLAN_EXECUTE_BROKER_VERSION,
    preparePlan,
    executePlan,
    getPlanStatus
  });
}
