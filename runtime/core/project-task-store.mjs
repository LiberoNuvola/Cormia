/**
 * Durable, project-scoped task journal and queue.
 *
 * This store is owned by Cormia and is deliberately separate from the
 * IMMORTAL Local Agent Task Store v1. It records queue/attempt/checkpoint
 * state; it does not verify Task Manifest signatures or grant capabilities.
 *
 * A task left running after restart is classified recovery_required. It is
 * never made runnable automatically: a trusted host must reconcile uncertain
 * side effects with evidence before choosing safe_to_retry/completed/blocked.
 */

import { createHash, randomUUID } from "node:crypto";
import { open, lstat, mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

const SCHEMA_VERSION = "0.1.0";
const RECORD_TYPE = "cormia.core.project-task-event";
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const TASK_STATES = new Set([
  "queued", "running", "blocked", "recovery_required", "completed", "failed"
]);
const EFFECT_BOUNDARIES = new Set([
  "no_external_effects",
  "idempotent_or_reconciled",
  "unknown"
]);
const RECOVERY_DECISIONS = new Set([
  "safe_to_retry", "confirmed_complete", "blocked"
]);
const DEFAULT_LOCK_TIMEOUT_MS = 2500;
const LOCK_RETRY_MS = 20;
const MAX_JOURNAL_EVENTS = 250_000;

export class ProjectTaskStoreError extends Error {
  constructor(message, code = "PROJECT_TASK_STORE_ERROR", details = undefined) {
    super(message);
    this.name = "ProjectTaskStoreError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class ProjectTaskStoreCorruptionError extends ProjectTaskStoreError {
  constructor(message, details) {
    super(message, "PROJECT_TASK_JOURNAL_CORRUPT", details);
    this.name = "ProjectTaskStoreCorruptionError";
  }
}

export class ProjectTaskStoreLockError extends ProjectTaskStoreError {
  constructor(message) {
    super(message, "PROJECT_TASK_JOURNAL_LOCKED");
    this.name = "ProjectTaskStoreLockError";
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

function isText(value, maxLength = 512) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value.length <= maxLength &&
    (typeof value.isWellFormed !== "function" || value.isWellFormed());
}

function isDateTime(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = stableValue(value[key]);
    return output;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function digestRecord(record) {
  const { recordDigest: _ignored, ...unsigned } = record;
  return "sha256:" + createHash("sha256")
    .update(stableStringify(unsigned), "utf8")
    .digest("hex");
}

function validateReferences(value, label, { min = 0, max = 256 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max ||
      value.some(item => !isText(item, 512)) ||
      new Set(value).size !== value.length) {
    throw new TypeError(label + " must be an array of unique non-empty references.");
  }
}

function validateTaskPayload(task) {
  if (!hasOnlyDataKeys(task, [
    "manifestDigest", "goal", "sourceRef", "maxAttempts", "dependsOn"
  ]) ||
      typeof task.manifestDigest !== "string" ||
      !DIGEST_PATTERN.test(task.manifestDigest) ||
      !isText(task.goal, 8_192) ||
      !isText(task.sourceRef, 512) ||
      !Number.isSafeInteger(task.maxAttempts) ||
      task.maxAttempts < 1 || task.maxAttempts > 20 ||
      !Array.isArray(task.dependsOn) ||
      task.dependsOn.length > 128 ||
      task.dependsOn.some(ref => !isText(ref, 256)) ||
      new Set(task.dependsOn).size !== task.dependsOn.length) {
    throw new ProjectTaskStoreCorruptionError("Task creation payload is malformed.");
  }
  return task;
}

function taskSnapshot(task) {
  return Object.freeze({
    projectRef: task.projectRef,
    taskRef: task.taskRef,
    manifestDigest: task.manifestDigest,
    goal: task.goal,
    sourceRef: task.sourceRef,
    dependsOn: Object.freeze([...task.dependsOn]),
    maxAttempts: task.maxAttempts,
    state: task.state,
    attempt: task.attempt,
    workerRef: task.workerRef,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    createdSequence: task.createdSequence,
    lastCheckpointRef: task.lastCheckpointRef,
    lastEffectBoundary: task.lastEffectBoundary,
    checkpointRefs: Object.freeze([...task.checkpointRefs]),
    evidenceRefs: Object.freeze([...task.evidenceRefs]),
    reasonCode: task.reasonCode
  });
}

function cloneTask(task) {
  return {
    ...task,
    dependsOn: [...task.dependsOn],
    checkpointRefs: [...task.checkpointRefs],
    evidenceRefs: [...task.evidenceRefs]
  };
}

function validateEventShape(event, expectedProjectRef, expectedSequence, previousDigest) {
  const required = [
    "schemaVersion", "recordType", "eventId", "projectRef", "sequence",
    "taskRef", "eventType", "fromState", "toState", "attempt",
    "occurredAt", "actorRef", "reasonCode", "evidenceRefs",
    "previousEventDigest", "recordDigest"
  ];
  const optional = [
    "workerRef", "task", "checkpointRef", "effectBoundary", "recoveryDecision"
  ];
  if (!hasOnlyDataKeys(event, required, optional)) {
    throw new ProjectTaskStoreCorruptionError("Task event has an invalid shape or undeclared field.");
  }
  if (event.schemaVersion !== SCHEMA_VERSION || event.recordType !== RECORD_TYPE ||
      event.projectRef !== expectedProjectRef) {
    throw new ProjectTaskStoreCorruptionError("Task event schema or project binding is invalid.");
  }
  if (!isText(event.eventId, 512) || !isText(event.taskRef, 256) ||
      event.sequence !== expectedSequence ||
      !isText(event.eventType, 64) ||
      !(event.fromState === null || TASK_STATES.has(event.fromState)) ||
      !TASK_STATES.has(event.toState) ||
      !Number.isSafeInteger(event.attempt) || event.attempt < 0 ||
      !isDateTime(event.occurredAt) ||
      !isText(event.actorRef, 512) ||
      !isText(event.reasonCode, 128)) {
    throw new ProjectTaskStoreCorruptionError("Task event contains invalid identity, transition or timestamp data.");
  }
  validateReferences(event.evidenceRefs, "evidenceRefs");
  if (event.previousEventDigest !== previousDigest ||
      !(event.recordDigest === digestRecord(event)) ||
      !DIGEST_PATTERN.test(event.recordDigest)) {
    throw new ProjectTaskStoreCorruptionError("Task event digest chain is invalid.");
  }
  if (Object.hasOwn(event, "workerRef") && !isText(event.workerRef, 256)) {
    throw new ProjectTaskStoreCorruptionError("Task event workerRef is invalid.");
  }
  if (Object.hasOwn(event, "checkpointRef") && !isText(event.checkpointRef, 512)) {
    throw new ProjectTaskStoreCorruptionError("Task event checkpointRef is invalid.");
  }
  if (Object.hasOwn(event, "effectBoundary") && !EFFECT_BOUNDARIES.has(event.effectBoundary)) {
    throw new ProjectTaskStoreCorruptionError("Task event effectBoundary is invalid.");
  }
  if (Object.hasOwn(event, "recoveryDecision") && !RECOVERY_DECISIONS.has(event.recoveryDecision)) {
    throw new ProjectTaskStoreCorruptionError("Task event recoveryDecision is invalid.");
  }
  if (event.eventType === "task_created") {
    if (!Object.hasOwn(event, "task")) {
      throw new ProjectTaskStoreCorruptionError("task_created event is missing its task payload.");
    }
    validateTaskPayload(event.task);
  } else if (Object.hasOwn(event, "task")) {
    throw new ProjectTaskStoreCorruptionError("Only task_created may contain a task payload.");
  }
  return event;
}

function applyTaskEvent(tasks, event, projectRef) {
  const current = tasks.get(event.taskRef) ?? null;
  const fail = message => {
    throw new ProjectTaskStoreCorruptionError(message, {
      taskRef: event.taskRef, eventType: event.eventType, sequence: event.sequence
    });
  };

  if (event.eventType === "task_created") {
    if (current !== null || event.fromState !== null || event.toState !== "queued" ||
        event.attempt !== 0 || Object.hasOwn(event, "workerRef") ||
        Object.hasOwn(event, "checkpointRef") || Object.hasOwn(event, "effectBoundary") ||
        Object.hasOwn(event, "recoveryDecision")) {
      fail("Task creation transition is invalid.");
    }
    const taskPayload = validateTaskPayload(event.task);
    if (taskPayload.dependsOn.includes(event.taskRef) ||
        taskPayload.dependsOn.some(ref => !tasks.has(ref))) {
      fail("Task dependencies must refer to already-created tasks in this project and cannot be self-referential.");
    }
    tasks.set(event.taskRef, {
      projectRef,
      taskRef: event.taskRef,
      manifestDigest: taskPayload.manifestDigest,
      goal: taskPayload.goal,
      sourceRef: taskPayload.sourceRef,
      dependsOn: [...taskPayload.dependsOn],
      maxAttempts: taskPayload.maxAttempts,
      state: "queued",
      attempt: 0,
      workerRef: null,
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
      createdSequence: event.sequence,
      lastCheckpointRef: null,
      lastEffectBoundary: null,
      checkpointRefs: [],
      evidenceRefs: [...event.evidenceRefs],
      reasonCode: event.reasonCode
    });
    return;
  }

  if (!current) fail("Task event references a task that was never created.");
  if (event.fromState !== current.state ||
      (event.eventType !== "task_claimed" && event.attempt !== current.attempt)) {
    fail("Task event fromState or attempt does not match the prior projection.");
  }

  if (event.eventType === "task_claimed") {
    const dependenciesComplete = current.dependsOn.every(ref => tasks.get(ref)?.state === "completed");
    if (current.state !== "queued" || event.toState !== "running" ||
        event.attempt !== current.attempt + 1 || event.attempt > current.maxAttempts ||
        !Object.hasOwn(event, "workerRef") || !dependenciesComplete ||
        Object.hasOwn(event, "checkpointRef") || Object.hasOwn(event, "effectBoundary") ||
        Object.hasOwn(event, "recoveryDecision")) {
      fail("Task claim is invalid, over limit or has incomplete dependencies.");
    }
    current.state = "running";
    current.attempt = event.attempt;
    current.workerRef = event.workerRef;
  } else if (event.eventType === "task_checkpointed") {
    if (current.state !== "running" || event.toState !== "running" ||
        event.attempt !== current.attempt || event.workerRef !== current.workerRef ||
        !Object.hasOwn(event, "checkpointRef") || !Object.hasOwn(event, "effectBoundary") ||
        Object.hasOwn(event, "recoveryDecision")) {
      fail("Task checkpoint does not belong to the active attempt.");
    }
    current.lastCheckpointRef = event.checkpointRef;
    current.lastEffectBoundary = event.effectBoundary;
    current.checkpointRefs.push(event.checkpointRef);
  } else if (event.eventType === "task_completed") {
    if (current.state !== "running" || event.toState !== "completed" ||
        event.attempt !== current.attempt || event.workerRef !== current.workerRef ||
        event.evidenceRefs.length < 1 ||
        Object.hasOwn(event, "checkpointRef") || Object.hasOwn(event, "effectBoundary") ||
        Object.hasOwn(event, "recoveryDecision")) {
      fail("Task completion must belong to the active attempt and carry evidence.");
    }
    current.state = "completed";
    current.evidenceRefs.push(...event.evidenceRefs);
  } else if (event.eventType === "task_failed") {
    if (current.state !== "running" || event.toState !== "failed" ||
        event.attempt !== current.attempt || event.workerRef !== current.workerRef ||
        Object.hasOwn(event, "checkpointRef") || Object.hasOwn(event, "effectBoundary") ||
        Object.hasOwn(event, "recoveryDecision")) {
      fail("Task failure event does not belong to the active attempt.");
    }
    current.state = "failed";
    current.evidenceRefs.push(...event.evidenceRefs);
  } else if (event.eventType === "task_blocked") {
    if (!["queued", "running"].includes(current.state) || event.toState !== "blocked" ||
        (current.state === "running" && event.workerRef !== current.workerRef) ||
        (current.state === "queued" && Object.hasOwn(event, "workerRef")) ||
        Object.hasOwn(event, "checkpointRef") || Object.hasOwn(event, "effectBoundary") ||
        Object.hasOwn(event, "recoveryDecision")) {
      fail("Task blocking transition is invalid.");
    }
    current.state = "blocked";
    current.evidenceRefs.push(...event.evidenceRefs);
  } else if (event.eventType === "task_interrupted") {
    if (current.state !== "running" || event.toState !== "recovery_required" ||
        event.attempt !== current.attempt || event.workerRef !== current.workerRef ||
        Object.hasOwn(event, "checkpointRef") || Object.hasOwn(event, "effectBoundary") ||
        Object.hasOwn(event, "recoveryDecision")) {
      fail("Task interruption event does not belong to the active attempt.");
    }
    current.state = "recovery_required";
  } else if (event.eventType === "task_recovery_reconciled") {
    const expectedState = {
      safe_to_retry: "queued",
      confirmed_complete: "completed",
      blocked: "blocked"
    }[event.recoveryDecision];
    if (current.state !== "recovery_required" || event.toState !== expectedState ||
        event.evidenceRefs.length < 1 ||
        Object.hasOwn(event, "workerRef") ||
        Object.hasOwn(event, "checkpointRef") || Object.hasOwn(event, "effectBoundary")) {
      fail("Recovery reconciliation is invalid or lacks evidence.");
    }
    if (event.recoveryDecision === "safe_to_retry" && current.attempt >= current.maxAttempts) {
      fail("Task exhausted maxAttempts and cannot be automatically requeued.");
    }
    current.state = expectedState;
    current.workerRef = null;
    current.evidenceRefs.push(...event.evidenceRefs);
  } else if (event.eventType === "task_unblocked") {
    if (current.state !== "blocked" || event.toState !== "queued" ||
        event.evidenceRefs.length < 1 ||
        Object.hasOwn(event, "workerRef") ||
        Object.hasOwn(event, "checkpointRef") || Object.hasOwn(event, "effectBoundary") ||
        Object.hasOwn(event, "recoveryDecision")) {
      fail("Task unblock requires a blocked task and evidence.");
    }
    current.state = "queued";
    current.evidenceRefs.push(...event.evidenceRefs);
  } else {
    fail("Unsupported task event type.");
  }

  current.updatedAt = event.occurredAt;
  current.reasonCode = event.reasonCode;
}

async function syncDirectoryBestEffort(directoryPath) {
  let handle;
  try {
    handle = await open(directoryPath, "r");
    await handle.sync();
  } catch (error) {
    if (!["EINVAL", "EPERM", "EISDIR", "ENOTSUP", "EACCES"].includes(error?.code)) throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function ensureJournalDirectory(journalPath) {
  await mkdir(path.dirname(journalPath), { recursive: true });
}

async function assertSafeJournalFile(journalPath) {
  try {
    const info = await lstat(journalPath);
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new ProjectTaskStoreError(
        "Task journal must be a regular file and cannot be a symbolic link.",
        "PROJECT_TASK_JOURNAL_UNSAFE_PATH"
      );
    }
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  return true;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function acquireLock(journalPath, timeoutMs) {
  const lockPath = journalPath + ".lock";
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify({
          pid: process.pid,
          acquiredAt: new Date().toISOString()
        }) + "\n", "utf8");
        await handle.sync();
      } catch (error) {
        await handle.close().catch(() => {});
        await unlink(lockPath).catch(() => {});
        throw error;
      }
      return async () => {
        await handle.close();
        await unlink(lockPath);
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) {
        throw new ProjectTaskStoreLockError(
          "Task journal lock is already held. A possible stale lock must be inspected and removed by the trusted host."
        );
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
}

function replayEvents(events, projectRef) {
  const tasks = new Map();
  const eventIds = new Set();
  let previousDigest = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    validateEventShape(event, projectRef, index + 1, previousDigest);
    if (eventIds.has(event.eventId)) {
      throw new ProjectTaskStoreCorruptionError("Task journal contains a duplicate eventId.");
    }
    applyTaskEvent(tasks, event, projectRef);
    eventIds.add(event.eventId);
    previousDigest = event.recordDigest;
  }
  return { tasks, lastEventDigest: previousDigest, revision: events.length };
}

async function readEventsUnlocked(journalPath, projectRef) {
  const exists = await assertSafeJournalFile(journalPath);
  if (!exists) return [];
  const bytes = await readFile(journalPath);
  if (bytes.length === 0) return [];
  let decoded;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ProjectTaskStoreCorruptionError("Task journal is not valid UTF-8.");
  }
  if (!decoded.endsWith("\n")) {
    throw new ProjectTaskStoreError(
      "Task journal has an incomplete final line. Use explicit recover({ repairTornTail: true }).",
      "PROJECT_TASK_JOURNAL_TORN_TAIL"
    );
  }
  const lines = decoded.slice(0, -1).split("\n");
  if (lines.length > MAX_JOURNAL_EVENTS) {
    throw new ProjectTaskStoreCorruptionError("Task journal exceeds the supported event count.");
  }
  return lines.map((line, index) => {
    if (!line) throw new ProjectTaskStoreCorruptionError("Task journal contains an empty line.", { line: index + 1 });
    try {
      return JSON.parse(line);
    } catch {
      throw new ProjectTaskStoreCorruptionError("Task journal contains malformed JSON.", { line: index + 1 });
    }
  });
}

function summarize(projectRef, loaded, events) {
  return {
    projectRef,
    revision: loaded.revision,
    lastEventDigest: loaded.lastEventDigest,
    tasks: [...loaded.tasks.values()]
      .sort((a, b) => a.createdSequence - b.createdSequence)
      .map(taskSnapshot),
    events
  };
}

function validateBaseCommand(command, required, optional = []) {
  if (!hasOnlyDataKeys(command, required, optional)) {
    throw new TypeError("Task command has an invalid shape or undeclared property.");
  }
  if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0) {
    throw new TypeError("expectedRevision must be a non-negative safe integer.");
  }
  if (!isText(command.actorRef, 512) || !isText(command.reasonCode, 128)) {
    throw new TypeError("actorRef and reasonCode must be non-empty trusted host references.");
  }
  if (Object.hasOwn(command, "eventId") && !isText(command.eventId, 512)) {
    throw new TypeError("eventId must be a non-empty string.");
  }
  if (Object.hasOwn(command, "occurredAt") && !isDateTime(command.occurredAt)) {
    throw new TypeError("occurredAt must be an ISO date-time.");
  }
  if (Object.hasOwn(command, "evidenceRefs")) {
    validateReferences(command.evidenceRefs, "evidenceRefs");
  }
}

function intentOf(command, eventType, taskRef, specific = {}) {
  return {
    eventType,
    taskRef,
    actorRef: command.actorRef,
    reasonCode: command.reasonCode,
    evidenceRefs: command.evidenceRefs ?? [],
    ...specific
  };
}

function sameIntent(prior, intent) {
  return stableStringify({
    eventType: prior.eventType,
    taskRef: prior.taskRef,
    actorRef: prior.actorRef,
    reasonCode: prior.reasonCode,
    evidenceRefs: prior.evidenceRefs,
    workerRef: prior.workerRef ?? null,
    task: prior.task ?? null,
    checkpointRef: prior.checkpointRef ?? null,
    effectBoundary: prior.effectBoundary ?? null,
    recoveryDecision: prior.recoveryDecision ?? null
  }) === stableStringify({
    workerRef: null, task: null, checkpointRef: null, effectBoundary: null, recoveryDecision: null,
    ...intent
  });
}

export function createProjectTaskStore({
  journalPath,
  projectRef,
  lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
  clock = () => new Date(),
  idFactory = randomUUID
} = {}) {
  if (typeof journalPath !== "string" || !path.isAbsolute(journalPath)) {
    throw new TypeError("journalPath must be an absolute host-resolved path.");
  }
  if (!isText(projectRef, 512)) {
    throw new TypeError("projectRef must be a non-empty host-resolved project reference.");
  }
  if (!Number.isSafeInteger(lockTimeoutMs) || lockTimeoutMs < 1 || lockTimeoutMs > 60_000) {
    throw new TypeError("lockTimeoutMs must be an integer between 1 and 60000.");
  }
  if (typeof clock !== "function" || typeof idFactory !== "function") {
    throw new TypeError("clock and idFactory must be trusted host functions.");
  }
  const absolutePath = path.resolve(journalPath);

  function nowIso() {
    const value = clock();
    const ms = value instanceof Date ? value.getTime() :
      typeof value === "string" ? Date.parse(value) :
      typeof value === "number" ? value : NaN;
    if (!Number.isFinite(ms)) throw new ProjectTaskStoreError("Host clock is invalid.", "PROJECT_TASK_CLOCK_INVALID");
    return new Date(ms).toISOString();
  }

  async function withLock(run) {
    await ensureJournalDirectory(absolutePath);
    const release = await acquireLock(absolutePath, lockTimeoutMs);
    try {
      return await run();
    } finally {
      await release();
    }
  }

  async function loadUnlocked() {
    const events = await readEventsUnlocked(absolutePath, projectRef);
    const replayed = replayEvents(events, projectRef);
    return { events, replayed };
  }

  async function append(command, eventType, buildSpecific) {
    const eventId = command.eventId ?? idFactory();
    if (!isText(eventId, 512)) throw new TypeError("idFactory must return a non-empty event reference.");
    const occurredAt = command.occurredAt ?? nowIso();
    if (!isDateTime(occurredAt)) throw new TypeError("occurredAt must be an ISO date-time.");

    return withLock(async () => {
      const loaded = await loadUnlocked();
      const prior = loaded.events.find(event => event.eventId === eventId);
      const specificIntent = buildSpecific.intent(command);
      const intent = intentOf(command, eventType, command.taskRef, specificIntent);
      if (prior) {
        if (!sameIntent(prior, intent)) {
          throw new ProjectTaskStoreError(
            "eventId was already used for a different task command.",
            "PROJECT_TASK_IDEMPOTENCY_CONFLICT"
          );
        }
        return {
          appended: false,
          duplicate: true,
          event: prior,
          snapshot: summarize(projectRef, loaded.replayed, loaded.events)
        };
      }
      if (command.expectedRevision !== loaded.replayed.revision) {
        throw new ProjectTaskStoreError(
          "Task journal revision changed; reload before retrying.",
          "PROJECT_TASK_REVISION_CONFLICT",
          { expected: command.expectedRevision, actual: loaded.replayed.revision }
        );
      }
      if (loaded.events.length >= MAX_JOURNAL_EVENTS) {
        throw new ProjectTaskStoreError("Task journal reached its event cap.", "PROJECT_TASK_JOURNAL_CAPACITY_REACHED");
      }

      const taskState = loaded.replayed.tasks.get(command.taskRef) ?? null;
      const specific = buildSpecific.create(taskState, command, loaded.replayed.tasks);
      const unsigned = {
        schemaVersion: SCHEMA_VERSION,
        recordType: RECORD_TYPE,
        eventId,
        projectRef,
        sequence: loaded.replayed.revision + 1,
        taskRef: command.taskRef,
        eventType,
        fromState: specific.fromState,
        toState: specific.toState,
        attempt: specific.attempt,
        ...(specific.workerRef ? { workerRef: specific.workerRef } : {}),
        ...(specific.task ? { task: specific.task } : {}),
        ...(specific.checkpointRef ? { checkpointRef: specific.checkpointRef } : {}),
        ...(specific.effectBoundary ? { effectBoundary: specific.effectBoundary } : {}),
        ...(specific.recoveryDecision ? { recoveryDecision: specific.recoveryDecision } : {}),
        occurredAt,
        actorRef: command.actorRef,
        reasonCode: command.reasonCode,
        evidenceRefs: command.evidenceRefs ?? [],
        previousEventDigest: loaded.replayed.lastEventDigest
      };
      const event = { ...unsigned, recordDigest: digestRecord(unsigned) };
      const nextTasks = new Map([...loaded.replayed.tasks.entries()].map(([key, value]) => [key, cloneTask(value)]));
      applyTaskEvent(nextTasks, event, projectRef);

      const exists = await assertSafeJournalFile(absolutePath);
      const handle = await open(absolutePath, "a", 0o600);
      try {
        await handle.writeFile(JSON.stringify(event) + "\n", "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      if (!exists) await syncDirectoryBestEffort(path.dirname(absolutePath));

      const nextLoaded = {
        events: [...loaded.events, event],
        replayed: {
          tasks: nextTasks,
          revision: event.sequence,
          lastEventDigest: event.recordDigest
        }
      };
      return {
        appended: true,
        duplicate: false,
        event,
        task: taskSnapshot(nextTasks.get(command.taskRef)),
        snapshot: summarize(projectRef, nextLoaded.replayed, nextLoaded.events)
      };
    });
  }

  function taskRequired(task) {
    if (!task) throw new ProjectTaskStoreError("Task does not exist in this project journal.", "PROJECT_TASK_NOT_FOUND");
    return task;
  }

  function validateTaskRef(taskRef) {
    if (!isText(taskRef, 256)) throw new TypeError("taskRef must be a non-empty reference.");
  }

  return Object.freeze({
    projectRef,
    journalPath: absolutePath,

    async read() {
      return withLock(async () => {
        const loaded = await loadUnlocked();
        return summarize(projectRef, loaded.replayed, loaded.events);
      });
    },

    async listRunnable() {
      const snapshot = await this.read();
      const byRef = new Map(snapshot.tasks.map(task => [task.taskRef, task]));
      return Object.freeze(snapshot.tasks.filter(task =>
        task.state === "queued" &&
        task.attempt < task.maxAttempts &&
        task.dependsOn.every(ref => byRef.get(ref)?.state === "completed")
      ));
    },

    async enqueue(command) {
      validateBaseCommand(command, [
        "taskRef", "manifestDigest", "goal", "sourceRef", "maxAttempts",
        "expectedRevision", "actorRef", "reasonCode"
      ], ["dependsOn", "eventId", "occurredAt", "evidenceRefs"]);
      validateTaskRef(command.taskRef);
      const payload = {
        manifestDigest: command.manifestDigest,
        goal: command.goal,
        sourceRef: command.sourceRef,
        maxAttempts: command.maxAttempts,
        dependsOn: command.dependsOn ?? []
      };
      validateTaskPayload(payload);
      return append(command, "task_created", {
        intent: () => ({ task: payload }),
        create(current, cmd, tasks) {
          if (current !== null) {
            throw new ProjectTaskStoreError("taskRef already exists in this project.", "PROJECT_TASK_DUPLICATE");
          }
          if (payload.dependsOn.includes(cmd.taskRef) ||
              payload.dependsOn.some(ref => !tasks.has(ref))) {
            throw new ProjectTaskStoreError(
              "Task dependencies must refer to previously created tasks in this project.",
              "PROJECT_TASK_DEPENDENCY_INVALID"
            );
          }
          return { fromState: null, toState: "queued", attempt: 0, task: payload };
        }
      });
    },

    async claim(command) {
      validateBaseCommand(command, [
        "taskRef", "workerRef", "expectedRevision", "actorRef", "reasonCode"
      ], ["eventId", "occurredAt", "evidenceRefs"]);
      validateTaskRef(command.taskRef);
      if (!isText(command.workerRef, 256)) throw new TypeError("workerRef must be a non-empty trusted host reference.");
      return append(command, "task_claimed", {
        intent: cmd => ({ workerRef: cmd.workerRef }),
        create(current, cmd, tasks) {
          taskRequired(current);
          if (current.state !== "queued") {
            throw new ProjectTaskStoreError("Only queued tasks may be claimed.", "PROJECT_TASK_NOT_QUEUED");
          }
          if (current.attempt >= current.maxAttempts) {
            throw new ProjectTaskStoreError("Task has exhausted maxAttempts.", "PROJECT_TASK_ATTEMPTS_EXHAUSTED");
          }
          if (!current.dependsOn.every(ref => tasks.get(ref)?.state === "completed")) {
            throw new ProjectTaskStoreError(
              "Task dependencies have not all completed.",
              "PROJECT_TASK_DEPENDENCIES_NOT_READY"
            );
          }
          return {
            fromState: current.state,
            toState: "running",
            attempt: current.attempt + 1,
            workerRef: cmd.workerRef
          };
        }
      });
    },

    async checkpoint(command) {
      validateBaseCommand(command, [
        "taskRef", "workerRef", "attempt", "checkpointRef", "effectBoundary",
        "expectedRevision", "actorRef", "reasonCode"
      ], ["eventId", "occurredAt", "evidenceRefs"]);
      validateTaskRef(command.taskRef);
      if (!isText(command.workerRef, 256) ||
          !Number.isSafeInteger(command.attempt) || command.attempt < 1 ||
          !isText(command.checkpointRef, 512) ||
          !EFFECT_BOUNDARIES.has(command.effectBoundary)) {
        throw new TypeError("Checkpoint identity, attempt or effectBoundary is invalid.");
      }
      return append(command, "task_checkpointed", {
        intent: () => ({
          workerRef: cmd.workerRef,
          checkpointRef: cmd.checkpointRef,
          effectBoundary: cmd.effectBoundary
        }),
        create(current, source) {
          taskRequired(current);
          if (current.state !== "running" || current.workerRef !== source.workerRef ||
              current.attempt !== source.attempt) {
            throw new ProjectTaskStoreError("Checkpoint does not belong to the active task attempt.", "PROJECT_TASK_ATTEMPT_MISMATCH");
          }
          return {
            fromState: current.state, toState: "running", attempt: current.attempt,
            workerRef: current.workerRef, checkpointRef: source.checkpointRef,
            effectBoundary: source.effectBoundary
          };
        }
      });
    },

    async complete(command) {
      validateBaseCommand(command, [
        "taskRef", "workerRef", "attempt", "expectedRevision", "actorRef", "reasonCode"
      ], ["eventId", "occurredAt", "evidenceRefs"]);
      validateTaskRef(command.taskRef);
      if (!isText(command.workerRef, 256) ||
          !Number.isSafeInteger(command.attempt) || command.attempt < 1) {
        throw new TypeError("Completion must identify the active worker and attempt.");
      }
      validateReferences(command.evidenceRefs, "evidenceRefs", { min: 1 });
      return append(command, "task_completed", {
        intent: () => ({ workerRef: cmd.workerRef }),
        create(current, source) {
          taskRequired(current);
          if (current.state !== "running" || current.workerRef !== source.workerRef ||
              current.attempt !== source.attempt) {
            throw new ProjectTaskStoreError("Completion does not belong to the active task attempt.", "PROJECT_TASK_ATTEMPT_MISMATCH");
          }
          return {
            fromState: current.state, toState: "completed", attempt: current.attempt,
            workerRef: current.workerRef
          };
        }
      });
    },

    async fail(command) {
      validateBaseCommand(command, [
        "taskRef", "workerRef", "attempt", "expectedRevision", "actorRef", "reasonCode"
      ], ["eventId", "occurredAt", "evidenceRefs"]);
      validateTaskRef(command.taskRef);
      if (!isText(command.workerRef, 256) ||
          !Number.isSafeInteger(command.attempt) || command.attempt < 1) {
        throw new TypeError("Failure must identify the active worker and attempt.");
      }
      return append(command, "task_failed", {
        intent: () => ({ workerRef: cmd.workerRef }),
        create(current, source) {
          taskRequired(current);
          if (current.state !== "running" || current.workerRef !== source.workerRef ||
              current.attempt !== source.attempt) {
            throw new ProjectTaskStoreError("Failure does not belong to the active task attempt.", "PROJECT_TASK_ATTEMPT_MISMATCH");
          }
          return {
            fromState: current.state, toState: "failed", attempt: current.attempt,
            workerRef: current.workerRef
          };
        }
      });
    },

    async block(command) {
      validateBaseCommand(command, [
        "taskRef", "expectedRevision", "actorRef", "reasonCode"
      ], ["workerRef", "attempt", "eventId", "occurredAt", "evidenceRefs"]);
      validateTaskRef(command.taskRef);
      return append(command, "task_blocked", {
        intent: () => ({
          workerRef: cmd.workerRef ?? null,
          attempt: cmd.attempt ?? null
        }),
        create(current, source) {
          taskRequired(current);
          if (!["queued", "running"].includes(current.state)) {
            throw new ProjectTaskStoreError("Only queued or running tasks can be blocked.", "PROJECT_TASK_STATE_INVALID");
          }
          if (current.state === "running" &&
              (source.workerRef !== current.workerRef || source.attempt !== current.attempt)) {
            throw new ProjectTaskStoreError("Blocking must identify the active worker and attempt.", "PROJECT_TASK_ATTEMPT_MISMATCH");
          }
          if (current.state === "queued" &&
              (source.workerRef !== undefined || source.attempt !== undefined)) {
            throw new ProjectTaskStoreError("Queued-task blocking cannot include a worker or attempt.", "PROJECT_TASK_COMMAND_INVALID");
          }
          return {
            fromState: current.state, toState: "blocked", attempt: current.attempt,
            ...(current.state === "running" ? { workerRef: current.workerRef } : {})
          };
        }
      });
    },

    async unblock(command) {
      validateBaseCommand(command, [
        "taskRef", "expectedRevision", "actorRef", "reasonCode", "evidenceRefs"
      ], ["eventId", "occurredAt"]);
      validateTaskRef(command.taskRef);
      validateReferences(command.evidenceRefs, "evidenceRefs", { min: 1 });
      return append(command, "task_unblocked", {
        intent: () => ({}),
        create(current) {
          taskRequired(current);
          if (current.state !== "blocked") {
            throw new ProjectTaskStoreError("Only blocked tasks may be unblocked.", "PROJECT_TASK_STATE_INVALID");
          }
          return { fromState: current.state, toState: "queued", attempt: current.attempt };
        }
      });
    },

    async recoverInterruptedTasks(command) {
      validateBaseCommand(command, [
        "actorRef", "reasonCode", "expectedRevision"
      ], ["eventId", "occurredAt"]);
      const initial = await this.read();
      if (initial.revision !== command.expectedRevision) {
        throw new ProjectTaskStoreError("Task journal revision changed before startup recovery.", "PROJECT_TASK_REVISION_CONFLICT");
      }
      let revision = initial.revision;
      const recovered = [];
      for (const task of initial.tasks.filter(item => item.state === "running")) {
        const result = await append({
          taskRef: task.taskRef,
          expectedRevision: revision,
          actorRef: command.actorRef,
          reasonCode: command.reasonCode,
          ...(command.eventId ? { eventId: command.eventId + ":" + task.taskRef } : {})
        }, "task_interrupted", {
          intent: () => ({ workerRef: task.workerRef }),
          create(current) {
            taskRequired(current);
            if (current.state !== "running" || current.attempt !== task.attempt ||
                current.workerRef !== task.workerRef) {
              throw new ProjectTaskStoreError("Task changed during startup recovery.", "PROJECT_TASK_REVISION_CONFLICT");
            }
            return {
              fromState: current.state, toState: "recovery_required",
              attempt: current.attempt, workerRef: current.workerRef
            };
          }
        });
        revision = result.snapshot.revision;
        recovered.push(task.taskRef);
      }
      return Object.freeze({ recovered: Object.freeze(recovered), snapshot: await this.read() });
    },

    async reconcileInterrupted(command) {
      validateBaseCommand(command, [
        "taskRef", "decision", "expectedRevision", "actorRef", "reasonCode", "evidenceRefs"
      ], ["eventId", "occurredAt"]);
      validateTaskRef(command.taskRef);
      if (!RECOVERY_DECISIONS.has(command.decision)) {
        throw new TypeError("decision must be safe_to_retry, confirmed_complete or blocked.");
      }
      validateReferences(command.evidenceRefs, "evidenceRefs", { min: 1 });
      return append(command, "task_recovery_reconciled", {
        intent: () => ({ recoveryDecision: cmd.decision }),
        create(current, source) {
          taskRequired(current);
          if (current.state !== "recovery_required") {
            throw new ProjectTaskStoreError("Only recovery_required tasks can be reconciled.", "PROJECT_TASK_STATE_INVALID");
          }
          if (source.decision === "safe_to_retry" && current.attempt >= current.maxAttempts) {
            throw new ProjectTaskStoreError("Task exhausted maxAttempts and cannot be requeued.", "PROJECT_TASK_ATTEMPTS_EXHAUSTED");
          }
          const toState = {
            safe_to_retry: "queued",
            confirmed_complete: "completed",
            blocked: "blocked"
          }[source.decision];
          return {
            fromState: current.state, toState, attempt: current.attempt,
            recoveryDecision: source.decision
          };
        }
      });
    },

    async recover({ repairTornTail = false } = {}) {
      if (typeof repairTornTail !== "boolean") {
        throw new TypeError("repairTornTail must be boolean.");
      }
      return withLock(async () => {
        const exists = await assertSafeJournalFile(absolutePath);
        if (!exists) {
          const loaded = await loadUnlocked();
          return { repaired: false, truncatedBytes: 0, ...summarize(projectRef, loaded.replayed, loaded.events) };
        }
        const bytes = await readFile(absolutePath);
        let truncatedBytes = 0;
        if (bytes.length > 0 && bytes[bytes.length - 1] !== 0x0a) {
          if (!repairTornTail) {
            throw new ProjectTaskStoreError(
              "Task journal has an incomplete final line. Explicit repair is required.",
              "PROJECT_TASK_JOURNAL_TORN_TAIL"
            );
          }
          const lastNewline = bytes.lastIndexOf(0x0a);
          const safeLength = lastNewline < 0 ? 0 : lastNewline + 1;
          truncatedBytes = bytes.length - safeLength;
          const handle = await open(absolutePath, "r+");
          try {
            await handle.truncate(safeLength);
            await handle.sync();
          } finally {
            await handle.close();
          }
        }
        const loaded = await loadUnlocked();
        return {
          repaired: truncatedBytes > 0,
          truncatedBytes,
          ...summarize(projectRef, loaded.replayed, loaded.events)
        };
      });
    }
  });
}
