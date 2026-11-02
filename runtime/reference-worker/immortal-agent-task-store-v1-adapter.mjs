/**
 * Read-only compatibility adapter for IMMORTAL Local Agent tasks.json v1.
 *
 * This module does not read/write files, mutate records, execute tasks, or
 * convert these records into canonical AEP Task Manifests.
 */
export const TASK_STORE_V1 = 1;
export const TASK_STATUS_V1 = Object.freeze([
  "pending",
  "running",
  "paused",
  "failed",
  "completed"
]);

const TASK_ID_PATTERN = /^TASK-[0-9]{14}-[0-9a-f]{8}$/;
const INITIAL_EXECUTION_STATUSES = new Set(["pending"]);
const EXPLICIT_RESUME_STATUSES = new Set(["pending", "paused", "failed"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDateTime(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function safeEvidencePath(task, candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  const normalized = candidate.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return false;
  const segments = normalized.split("/");
  if (segments.some(segment => segment === "" || segment === "." || segment === "..")) return false;
  if (segments.length !== 3 || segments[0] !== "data" || segments[1] !== "evidence") return false;
  const match = segments[2].match(/^(.+)-attempt-([1-9][0-9]*)\.json$/);
  if (!match || match[1] !== task.id) return false;
  if (Number.isInteger(task.attempts) && task.attempts > 0 && Number(match[2]) > task.attempts) return false;
  return true;
}

/**
 * Inspect and summarize a v1 task-store snapshot without modifying it.
 * Unknown properties are intentionally preserved by the caller and ignored
 * here for forward/legacy compatibility.
 */
export function inspectTaskStoreV1(store) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(store)) {
    return { valid: false, errors: ["Task store must be a JSON object."], warnings: [], version: null, taskCount: 0, tasks: [] };
  }
  if (store.version !== TASK_STORE_V1) errors.push("Unsupported task-store version; expected version 1.");
  if (!Array.isArray(store.tasks)) errors.push("Task store must contain a tasks array.");
  if (store.updatedAt !== undefined && !isDateTime(store.updatedAt)) {
    errors.push("Task-store updatedAt must be an ISO date-time when present.");
  }

  const seenIds = new Set();
  const summaries = [];

  if (Array.isArray(store.tasks)) {
    store.tasks.forEach((task, index) => {
      const prefix = "tasks[" + index + "]";
      if (!isPlainObject(task)) {
        errors.push(prefix + " must be an object.");
        return;
      }
      if (typeof task.id !== "string" || !TASK_ID_PATTERN.test(task.id)) {
        errors.push(prefix + ".id is not a valid IMMORTAL task ID.");
      } else if (seenIds.has(task.id)) {
        errors.push(prefix + ".id is duplicated.");
      } else {
        seenIds.add(task.id);
      }
      if (typeof task.goal !== "string" || task.goal.trim().length === 0 || task.goal.length > 5000) {
        errors.push(prefix + ".goal must contain 1-5000 characters.");
      }
      if (!TASK_STATUS_V1.includes(task.status)) {
        errors.push(prefix + ".status is unsupported.");
      }
      if (task.attempts !== undefined && (!Number.isInteger(task.attempts) || task.attempts < 0)) {
        errors.push(prefix + ".attempts must be a non-negative integer.");
      }
      for (const field of ["createdAt", "updatedAt", "lastStartedAt", "lastFinishedAt", "interruptedAt"]) {
        if (task[field] !== undefined && !isDateTime(task[field])) {
          errors.push(prefix + "." + field + " must be an ISO date-time when present.");
        }
      }
      if (task.expectedTools !== undefined && !isStringArray(task.expectedTools)) {
        errors.push(prefix + ".expectedTools must be an array of strings when present.");
      }
      if (task.toolsUsed !== undefined && !isStringArray(task.toolsUsed)) {
        errors.push(prefix + ".toolsUsed must be an array of strings when present.");
      }
      if (task.lastResult !== undefined && task.lastResult !== null && typeof task.lastResult !== "string") {
        errors.push(prefix + ".lastResult must be a string or null when present.");
      }
      if (task.lastError !== undefined && task.lastError !== null && typeof task.lastError !== "string") {
        errors.push(prefix + ".lastError must be a string or null when present.");
      }
      if (task.evidencePath !== undefined && !safeEvidencePath(task, task.evidencePath)) {
        errors.push(prefix + ".evidencePath is outside the expected task evidence directory or points to an attempt newer than the task record.");
      }
      if (task.expectedTools === undefined) {
        warnings.push(prefix + " has no expectedTools; the existing Agent derives them during startup migration.");
      }
      if (task.status === "running") {
        warnings.push(prefix + " is running; the existing Agent marks it paused on restart and does not auto-relaunch it.");
      }
      if (task.status === "completed") {
        warnings.push(prefix + " requires the existing Agent's completion-integrity checks before treating it as trusted.");
      }

      const status = TASK_STATUS_V1.includes(task.status) ? task.status : "unsupported";
      summaries.push({
        id: typeof task.id === "string" ? task.id : null,
        status,
        attempts: Number.isInteger(task.attempts) ? task.attempts : 0,
        canStart: INITIAL_EXECUTION_STATUSES.has(status),
        canExplicitlyResume: EXPLICIT_RESUME_STATUSES.has(status),
        resumeSemantics: EXPLICIT_RESUME_STATUSES.has(status)
          ? "new-attempt-from-original-goal; prior result is context only; re-observe current facts"
          : "not-eligible",
        evidencePath: typeof task.evidencePath === "string" && safeEvidencePath(task, task.evidencePath)
          ? task.evidencePath
          : null
      });
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    version: store.version ?? null,
    taskCount: Array.isArray(store.tasks) ? store.tasks.length : 0,
    tasks: summaries
  };
}

/**
 * Exact eligibility mirror of Agent v0.8 executeTask(..., { resume: true }).
 * It only returns a decision; it never runs or mutates a task.
 */
export function checkExplicitResumeV1(task) {
  if (!isPlainObject(task)) return { allowed: false, reason: "task-not-object" };
  if (typeof task.id !== "string" || !TASK_ID_PATTERN.test(task.id)) {
    return { allowed: false, reason: "invalid-task-id" };
  }
  if (!EXPLICIT_RESUME_STATUSES.has(task.status)) {
    return { allowed: false, reason: "status-not-resumable" };
  }
  return {
    allowed: true,
    reason: "explicit-new-attempt-required",
    semantics: "rerun-from-original-goal; previous result is untrusted context; reacquire current evidence"
  };
}

/**
 * Validate one attempt evidence sidecar as written by Agent v0.8.
 * createdAt is optional because the Agent's subsequent save replaces the
 * initial JSON object with an updatedAt object.
 */
export function inspectAttemptEvidenceV1(evidence, expected = {}) {
  const errors = [];
  if (!isPlainObject(evidence)) errors.push("Evidence sidecar must be an object.");
  if (!isPlainObject(evidence)) return { valid: false, errors };
  if (evidence.version !== 1) errors.push("Evidence sidecar version must be 1.");
  if (typeof evidence.taskId !== "string" || !TASK_ID_PATTERN.test(evidence.taskId)) {
    errors.push("Evidence sidecar taskId is invalid.");
  }
  if (expected.taskId && evidence.taskId !== expected.taskId) {
    errors.push("Evidence sidecar taskId does not match the expected task.");
  }
  if (!Number.isInteger(evidence.attempt) || evidence.attempt < 1) {
    errors.push("Evidence sidecar attempt must be a positive integer.");
  }
  if (Number.isInteger(expected.attempt) && evidence.attempt !== expected.attempt) {
    errors.push("Evidence sidecar attempt does not match the expected attempt.");
  }
  if (evidence.createdAt !== undefined && !isDateTime(evidence.createdAt)) {
    errors.push("Evidence sidecar createdAt must be an ISO date-time when present.");
  }
  if (evidence.updatedAt !== undefined && !isDateTime(evidence.updatedAt)) {
    errors.push("Evidence sidecar updatedAt must be an ISO date-time when present.");
  }
  if (!Array.isArray(evidence.evidence)) {
    errors.push("Evidence sidecar must contain an evidence array.");
  } else {
    evidence.evidence.forEach((item, index) => {
      const prefix = "evidence[" + index + "]";
      if (!isPlainObject(item)) {
        errors.push(prefix + " must be an object.");
        return;
      }
      if (!isDateTime(item.observedAt)) errors.push(prefix + ".observedAt must be an ISO date-time.");
      if (typeof item.tool !== "string" || item.tool.length === 0) errors.push(prefix + ".tool must be a non-empty string.");
      if (!isPlainObject(item.arguments)) errors.push(prefix + ".arguments must be an object.");
      if (typeof item.isError !== "boolean") errors.push(prefix + ".isError must be boolean.");
      if (typeof item.rawResultText !== "string") errors.push(prefix + ".rawResultText must be a string.");
    });
  }
  return { valid: errors.length === 0, errors };
}
