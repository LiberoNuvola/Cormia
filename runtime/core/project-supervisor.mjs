/**
 * Local host Project Supervisor v0.1.
 *
 * Composes one durable task store per project with the host Project Runtime
 * Registry. It schedules fairly across projects and delegates execution only
 * to a fixed host-owned taskExecutor port.
 *
 * This is an explicit in-process run loop; it is not a daemon/service manager.
 * A host-resolved lock file prevents two cooperating local Supervisor
 * instances from recovering/claiming the same journals concurrently.
 */

import { randomUUID } from "node:crypto";
import { open, lstat, mkdir, unlink } from "node:fs/promises";
import path from "node:path";

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const DEFAULT_CAS_RETRIES = 4;
const MAX_PROJECTS = 256;
const MAX_CONCURRENCY = 64;
const TASK_REF_MAX = 256;
const PROJECT_REF_MAX = 512;

export class ProjectSupervisorError extends Error {
  constructor(message, code = "PROJECT_SUPERVISOR_ERROR") {
    super(message);
    this.name = "ProjectSupervisorError";
    this.code = code;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyDataKeys(value, required, optional = []) {
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

function isText(value, max = 512) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value.length <= max &&
    (typeof value.isWellFormed !== "function" || value.isWellFormed());
}

function validConcurrency(value, label) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CONCURRENCY) {
    throw new TypeError(label + " must be an integer from 1 to " + MAX_CONCURRENCY + ".");
  }
  return value;
}

function normalizeErrorCode(error, fallback) {
  return typeof error?.code === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(error.code)
    ? error.code
    : fallback;
}

function validateRoute(route, task) {
  return hasOnlyDataKeys(route, [
    "schemaVersion", "status", "taskRef", "projectRef", "manifestDigest", "routeDigest"
  ]) &&
    route.schemaVersion === "0.1.0" &&
    route.status === "verified" &&
    route.taskRef === task.taskRef &&
    route.projectRef === task.projectRef &&
    route.manifestDigest === task.manifestDigest &&
    DIGEST_PATTERN.test(route.manifestDigest) &&
    typeof route.routeDigest === "string" &&
    DIGEST_PATTERN.test(route.routeDigest);
}

function validateExecutorOutcome(value) {
  if (!isPlainObject(value) || !["completed", "failed", "blocked"].includes(value.state) ||
      !Array.isArray(value.evidenceRefs) ||
      value.evidenceRefs.length > 256 ||
      value.evidenceRefs.some(item => !isText(item, 512)) ||
      new Set(value.evidenceRefs).size !== value.evidenceRefs.length) {
    throw new ProjectSupervisorError("Host task executor returned an invalid outcome.", "TASK_EXECUTOR_OUTCOME_INVALID");
  }
  const expectedKeys = value.state === "completed"
    ? ["state", "evidenceRefs"]
    : ["state", "reasonCode", "evidenceRefs"];
  if (!hasOnlyDataKeys(value, expectedKeys)) {
    throw new ProjectSupervisorError("Host task executor returned undeclared outcome fields.", "TASK_EXECUTOR_OUTCOME_INVALID");
  }
  if (value.state === "completed" && value.evidenceRefs.length < 1) {
    throw new ProjectSupervisorError("Completed tasks require evidence references.", "TASK_EXECUTOR_EVIDENCE_REQUIRED");
  }
  if (value.state !== "completed" && !isText(value.reasonCode, 128)) {
    throw new ProjectSupervisorError("Failed/blocked outcomes require a stable reason code.", "TASK_EXECUTOR_REASON_REQUIRED");
  }
  if (value.state === "failed" && value.evidenceRefs.length < 1) {
    throw new ProjectSupervisorError("Failed tasks require evidence that the host runner reconciled their side effects.", "TASK_EXECUTOR_EVIDENCE_REQUIRED");
  }
  return value;
}

async function acquireSupervisorLock(lockPath) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new ProjectSupervisorError(
        "Another Supervisor owns this local lock, or a stale lock requires host inspection.",
        "PROJECT_SUPERVISOR_LOCKED"
      );
    }
    throw error;
  }

  const owner = Object.freeze({
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    ownerToken: randomUUID()
  });
  try {
    await handle.writeFile(JSON.stringify(owner) + "\n", "utf8");
    await handle.sync();
    const stat = await handle.stat();
    return Object.freeze({
      owner,
      dev: stat.dev,
      ino: stat.ino,
      async release() {
        const current = await lstat(lockPath);
        if (current.isSymbolicLink() || current.dev !== stat.dev || current.ino !== stat.ino) {
          throw new ProjectSupervisorError(
            "Supervisor lock ownership changed; refusing to remove the lock.",
            "PROJECT_SUPERVISOR_LOCK_OWNERSHIP_CHANGED"
          );
        }
        await handle.close();
        await unlink(lockPath);
      }
    });
  } catch (error) {
    await handle.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
    throw error;
  }
}

function makeId(factory, label) {
  const value = factory();
  if (!isText(value, 512)) {
    throw new ProjectSupervisorError(label + " factory returned an invalid reference.", "PROJECT_SUPERVISOR_ID_INVALID");
  }
  return value;
}

export function createProjectSupervisor({
  projectStores,
  runtimeRegistry,
  taskRoutingProvider,
  taskExecutor,
  supervisorLockPath,
  actorRef = "actor:cormia-supervisor",
  workerRefFactory = () => "worker:cormia-supervisor:" + randomUUID(),
  eventIdFactory = randomUUID,
  maxGlobalConcurrency = 2,
  casRetries = DEFAULT_CAS_RETRIES,
  clock = () => new Date()
} = {}) {
  if (!Array.isArray(projectStores) || projectStores.length < 1 || projectStores.length > MAX_PROJECTS) {
    throw new TypeError("projectStores must contain between 1 and " + MAX_PROJECTS + " project registrations.");
  }
  if (!runtimeRegistry ||
      typeof runtimeRegistry.prepareTaskPlan !== "function" ||
      typeof runtimeRegistry.executeTaskPlan !== "function" ||
      typeof runtimeRegistry.listRegisteredProjects !== "function") {
    throw new TypeError("A host Project Runtime Registry is required.");
  }
  if (!taskRoutingProvider || typeof taskRoutingProvider.resolveVerifiedTaskRoute !== "function") {
    throw new TypeError("A host-verified taskRoutingProvider is required.");
  }
  if (!taskExecutor || typeof taskExecutor.executeTask !== "function") {
    throw new TypeError("A fixed host-owned taskExecutor.executeTask port is required.");
  }
  if (typeof supervisorLockPath !== "string" || !path.isAbsolute(supervisorLockPath)) {
    throw new TypeError("supervisorLockPath must be an absolute host-resolved local path.");
  }
  if (!isText(actorRef, 512) ||
      typeof workerRefFactory !== "function" ||
      typeof eventIdFactory !== "function" ||
      typeof clock !== "function") {
    throw new TypeError("Host actor, worker/event ID factories and clock are required.");
  }
  validConcurrency(maxGlobalConcurrency, "maxGlobalConcurrency");
  if (!Number.isSafeInteger(casRetries) || casRetries < 1 || casRetries > 16) {
    throw new TypeError("casRetries must be between 1 and 16.");
  }

  const registrations = [];
  const byProject = new Map();
  const journalPaths = new Set();
  for (const entry of projectStores) {
    if (!hasOnlyDataKeys(entry, ["projectRef", "taskStore"], ["maxConcurrency"]) ||
        !isText(entry.projectRef, PROJECT_REF_MAX) ||
        !entry.taskStore ||
        entry.taskStore.projectRef !== entry.projectRef ||
        !isText(entry.taskStore.journalPath, 8_192) ||
        typeof entry.taskStore.read !== "function" ||
        typeof entry.taskStore.listRunnable !== "function" ||
        typeof entry.taskStore.enqueue !== "function" ||
        typeof entry.taskStore.claim !== "function" ||
        typeof entry.taskStore.checkpoint !== "function" ||
        typeof entry.taskStore.complete !== "function" ||
        typeof entry.taskStore.fail !== "function" ||
        typeof entry.taskStore.block !== "function" ||
        typeof entry.taskStore.interrupt !== "function" ||
        typeof entry.taskStore.recoverInterruptedTasks !== "function") {
      throw new TypeError("Each registration must bind a projectRef to its own durable Project Task Store.");
    }
    if (byProject.has(entry.projectRef)) {
      throw new TypeError("Duplicate task store registration for " + entry.projectRef + ".");
    }
    const journalPath = path.resolve(entry.taskStore.journalPath);
    if (journalPaths.has(journalPath)) {
      throw new TypeError("Two projects cannot share one task journal path.");
    }
    journalPaths.add(journalPath);
    const registration = Object.freeze({
      projectRef: entry.projectRef,
      taskStore: entry.taskStore,
      maxConcurrency: validConcurrency(entry.maxConcurrency ?? 1, "project maxConcurrency")
    });
    registrations.push(registration);
    byProject.set(entry.projectRef, registration);
  }

  const registered = runtimeRegistry.listRegisteredProjects();
  if (!Array.isArray(registered) ||
      registered.length !== byProject.size ||
      [...registered].sort().some((projectRef, index) =>
        projectRef !== [...byProject.keys()].sort()[index]
      )) {
    throw new TypeError("Project Task Stores and Project Runtime Registry must register the same projects.");
  }

  const absoluteLockPath = path.resolve(supervisorLockPath);
  const running = new Map();
  const activePerProject = new Map(registrations.map(item => [item.projectRef, 0]));
  let cursor = 0;
  let lock = null;
  let started = false;
  let stopped = false;
  let startPromise = null;
  let cyclePromise = null;

  function nowIso() {
    const value = clock();
    const ms = value instanceof Date ? value.getTime() :
      typeof value === "string" ? Date.parse(value) :
      typeof value === "number" ? value : NaN;
    if (!Number.isFinite(ms)) {
      throw new ProjectSupervisorError("Host clock returned an invalid time.", "PROJECT_SUPERVISOR_CLOCK_INVALID");
    }
    return new Date(ms).toISOString();
  }

  async function mutateWithRevision(registration, method, fields) {
    const store = registration.taskStore;
    const eventId = makeId(eventIdFactory, "eventId");
    for (let attempt = 0; attempt < casRetries; attempt += 1) {
      const snapshot = await store.read();
      try {
        return await store[method]({
          ...fields,
          expectedRevision: snapshot.revision,
          actorRef,
          eventId
        });
      } catch (error) {
        if (error?.code !== "PROJECT_TASK_REVISION_CONFLICT" || attempt + 1 >= casRetries) {
          throw error;
        }
      }
    }
    throw new ProjectSupervisorError("Task journal compare-and-set retries were exhausted.", "PROJECT_SUPERVISOR_CAS_EXHAUSTED");
  }

  async function verifyTaskRoute(registration, task) {
    let route;
    try {
      route = await taskRoutingProvider.resolveVerifiedTaskRoute({ taskRef: task.taskRef });
    } catch {
      return { ok: false, reason: "TASK_ROUTE_PROVIDER_FAILED" };
    }
    if (!validateRoute(route, { ...task, projectRef: registration.projectRef })) {
      return { ok: false, reason: "TASK_ROUTE_UNVERIFIED_OR_MISMATCHED" };
    }
    return { ok: true, route };
  }

  async function runClaimedTask(registration, task, workerRef) {
    const store = registration.taskStore;
    const runnerContext = Object.freeze({
      projectRef: registration.projectRef,
      task: Object.freeze({ ...task }),
      workerRef,
      attempt: task.attempt,
      preparePlan: proposal => runtimeRegistry.prepareTaskPlan({
        taskRef: task.taskRef,
        proposal
      }),
      executePlan: (planRef, expectedPlanDigest) => runtimeRegistry.executeTaskPlan({
        taskRef: task.taskRef,
        planRef,
        expectedPlanDigest
      }),
      checkpoint: async ({ checkpointRef, effectBoundary, evidenceRefs = [], reasonCode = "task_checkpointed" }) =>
        mutateWithRevision(registration, "checkpoint", {
          taskRef: task.taskRef,
          workerRef,
          attempt: task.attempt,
          checkpointRef,
          effectBoundary,
          evidenceRefs,
          reasonCode
        })
    });

    let outcome;
    try {
      outcome = validateExecutorOutcome(await taskExecutor.executeTask(runnerContext));
    } catch (error) {
      let interruption = null;
      try {
        interruption = await mutateWithRevision(registration, "interrupt", {
          taskRef: task.taskRef,
          workerRef,
          attempt: task.attempt,
          reasonCode: normalizeErrorCode(error, "TASK_EXECUTOR_INTERRUPTED"),
          evidenceRefs: []
        });
      } catch (interruptError) {
        return Object.freeze({
          taskRef: task.taskRef,
          projectRef: registration.projectRef,
          state: "running",
          reason: normalizeErrorCode(interruptError, "TASK_INTERRUPT_RECORD_FAILED"),
          recoveryRequiredOnNextStartup: true
        });
      }
      return Object.freeze({
        taskRef: task.taskRef,
        projectRef: registration.projectRef,
        state: "recovery_required",
        reason: normalizeErrorCode(error, "TASK_EXECUTOR_INTERRUPTED"),
        revision: interruption.snapshot.revision
      });
    }

    try {
      let result;
      if (outcome.state === "completed") {
        result = await mutateWithRevision(registration, "complete", {
          taskRef: task.taskRef,
          workerRef,
          attempt: task.attempt,
          reasonCode: "TASK_COMPLETED_WITH_EVIDENCE",
          evidenceRefs: outcome.evidenceRefs
        });
      } else if (outcome.state === "failed") {
        result = await mutateWithRevision(registration, "fail", {
          taskRef: task.taskRef,
          workerRef,
          attempt: task.attempt,
          reasonCode: outcome.reasonCode,
          evidenceRefs: outcome.evidenceRefs
        });
      } else {
        result = await mutateWithRevision(registration, "block", {
          taskRef: task.taskRef,
          workerRef,
          attempt: task.attempt,
          reasonCode: outcome.reasonCode,
          evidenceRefs: outcome.evidenceRefs
        });
      }
      return Object.freeze({
        taskRef: task.taskRef,
        projectRef: registration.projectRef,
        state: result.task.state,
        revision: result.snapshot.revision,
        evidenceRefs: result.task.evidenceRefs
      });
    } catch (error) {
      try {
        const interrupted = await mutateWithRevision(registration, "interrupt", {
          taskRef: task.taskRef,
          workerRef,
          attempt: task.attempt,
          reasonCode: normalizeErrorCode(error, "TASK_OUTCOME_PERSISTENCE_FAILED"),
          evidenceRefs: outcome.evidenceRefs
        });
        return Object.freeze({
          taskRef: task.taskRef,
          projectRef: registration.projectRef,
          state: "recovery_required",
          reason: normalizeErrorCode(error, "TASK_OUTCOME_PERSISTENCE_FAILED"),
          revision: interrupted.snapshot.revision
        });
      } catch (interruptError) {
        return Object.freeze({
          taskRef: task.taskRef,
          projectRef: registration.projectRef,
          state: "running",
          reason: normalizeErrorCode(interruptError, "TASK_INTERRUPT_RECORD_FAILED"),
          recoveryRequiredOnNextStartup: true
        });
      }
    }
  }

  async function pickAndClaim(registration, task) {
    const route = await verifyTaskRoute(registration, task);
    if (!route.ok) return { claimed: false, reason: route.reason };

    try {
      const claim = await mutateWithRevision(registration, "claim", {
        taskRef: task.taskRef,
        workerRef: makeId(workerRefFactory, "workerRef"),
        reasonCode: "SUPERVISOR_FAIR_SCHEDULE_CLAIMED"
      });
      return { claimed: true, task: claim.task, workerRef: claim.task.workerRef };
    } catch (error) {
      if (error?.code === "PROJECT_TASK_REVISION_CONFLICT" ||
          error?.code === "PROJECT_TASK_NOT_QUEUED" ||
          error?.code === "PROJECT_TASK_DEPENDENCIES_NOT_READY") {
        return { claimed: false, reason: normalizeErrorCode(error, "TASK_CLAIM_NOT_AVAILABLE") };
      }
      return { claimed: false, reason: normalizeErrorCode(error, "TASK_CLAIM_FAILED") };
    }
  }

  async function start() {
    if (stopped) throw new ProjectSupervisorError("Supervisor has been stopped.", "PROJECT_SUPERVISOR_STOPPED");
    if (started) return Object.freeze({ started: true, recovered: Object.freeze([]) });
    if (startPromise) return startPromise;

    startPromise = (async () => {
      lock = await acquireSupervisorLock(absoluteLockPath);
      const recovered = [];
      try {
        for (const registration of registrations) {
          const snapshot = await registration.taskStore.read();
          const result = await registration.taskStore.recoverInterruptedTasks({
            expectedRevision: snapshot.revision,
            actorRef,
            reasonCode: "SUPERVISOR_STARTUP_RECOVERY",
            eventId: makeId(eventIdFactory, "recoveryEventId")
          });
          recovered.push(Object.freeze({
            projectRef: registration.projectRef,
            taskRefs: result.recovered
          }));
        }
        started = true;
        return Object.freeze({ started: true, recovered: Object.freeze(recovered) });
      } catch (error) {
        await lock.release().catch(() => {});
        lock = null;
        throw new ProjectSupervisorError(
          "Supervisor startup recovery failed closed: " + normalizeErrorCode(error, "TASK_RECOVERY_FAILED"),
          "PROJECT_SUPERVISOR_STARTUP_RECOVERY_FAILED"
        );
      }
    })();
    try {
      return await startPromise;
    } finally {
      startPromise = null;
    }
  }

  async function runCycleInternal() {
    if (!started || stopped || !lock) {
      throw new ProjectSupervisorError("Call start() before scheduling tasks.", "PROJECT_SUPERVISOR_NOT_STARTED");
    }

    const queues = new Map();
    for (const registration of registrations) {
      try {
        queues.set(registration.projectRef, [...await registration.taskStore.listRunnable()]);
      } catch (error) {
        queues.set(registration.projectRef, []);
      }
    }

    const launched = [];
    const skipped = [];
    let inspectedWithoutProgress = 0;

    while (launched.length < maxGlobalConcurrency &&
        inspectedWithoutProgress < registrations.length) {
      const index = cursor;
      cursor = (cursor + 1) % registrations.length;
      const registration = registrations[index];
      const queue = queues.get(registration.projectRef) ?? [];
      const activeCount = activePerProject.get(registration.projectRef) ?? 0;

      if (activeCount >= registration.maxConcurrency || queue.length === 0) {
        inspectedWithoutProgress += 1;
        continue;
      }

      const task = queue.shift();
      const route = await verifyTaskRoute(registration, task);
      if (!route.ok) {
        skipped.push(Object.freeze({
          projectRef: registration.projectRef,
          taskRef: task.taskRef,
          reason: route.reason
        }));
        inspectedWithoutProgress = 0;
        continue;
      }

      const claim = await pickAndClaim(registration, task);
      if (!claim.claimed) {
        skipped.push(Object.freeze({
          projectRef: registration.projectRef,
          taskRef: task.taskRef,
          reason: claim.reason
        }));
        inspectedWithoutProgress = 0;
        continue;
      }

      activePerProject.set(registration.projectRef, activeCount + 1);
      const promise = (async () => {
        const result = await runClaimedTask(registration, claim.task, claim.workerRef);
        return result;
      })().finally(() => {
        activePerProject.set(
          registration.projectRef,
          Math.max(0, (activePerProject.get(registration.projectRef) ?? 1) - 1)
        );
        running.delete(claim.task.taskRef);
      });
      running.set(claim.task.taskRef, promise);
      launched.push(promise);
      inspectedWithoutProgress = 0;
    }

    const results = await Promise.all(launched);
    return Object.freeze({
      scheduledCount: launched.length,
      results: Object.freeze(results),
      skipped: Object.freeze(skipped),
      remainingRunnableCount: [...queues.values()].reduce((total, queue) => total + queue.length, 0),
      activeCount: running.size
    });
  }

  async function runCycle() {
    if (cyclePromise) {
      throw new ProjectSupervisorError("A scheduling cycle is already in progress.", "PROJECT_SUPERVISOR_CYCLE_BUSY");
    }
    cyclePromise = runCycleInternal();
    try {
      return await cyclePromise;
    } finally {
      cyclePromise = null;
    }
  }

  async function runUntilIdle({ maxCycles = 32 } = {}) {
    if (!Number.isSafeInteger(maxCycles) || maxCycles < 1 || maxCycles > 10_000) {
      throw new TypeError("maxCycles must be an integer between 1 and 10000.");
    }
    const cycles = [];
    for (let index = 0; index < maxCycles; index += 1) {
      const cycle = await runCycle();
      cycles.push(cycle);
      if (cycle.scheduledCount === 0) {
        return Object.freeze({
          idle: cycle.skipped.length === 0,
          blocked: cycle.skipped.length > 0,
          limitReached: false,
          cycles: Object.freeze(cycles)
        });
      }
    }
    return Object.freeze({
      idle: false,
      blocked: false,
      limitReached: true,
      cycles: Object.freeze(cycles)
    });
  }

  async function stop() {
    if (cyclePromise || running.size > 0 || startPromise) {
      throw new ProjectSupervisorError(
        "Supervisor cannot release its lock while a scheduling/startup cycle is active.",
        "PROJECT_SUPERVISOR_BUSY"
      );
    }
    if (stopped) return Object.freeze({ stopped: true });
    if (lock) {
      await lock.release();
      lock = null;
    }
    stopped = true;
    started = false;
    return Object.freeze({ stopped: true });
  }

  function getStatus() {
    return Object.freeze({
      started,
      stopped,
      projectCount: registrations.length,
      globalConcurrency: maxGlobalConcurrency,
      activeCount: running.size,
      activeByProject: Object.freeze(Object.fromEntries(activePerProject)),
      cursor
    });
  }

  return Object.freeze({
    contractVersion: "cormia.project-supervisor/0.1",
    start,
    runCycle,
    runUntilIdle,
    stop,
    getStatus
  });
}
