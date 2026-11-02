/**
 * Bounded read-only probe for task-referenced Agent v1 evidence sidecars.
 *
 * Reads only exact data/evidence/<task-id>-attempt-<n>.json paths already
 * referenced by a validated Task Store snapshot. Payloads stay in memory and
 * are never returned or printed. No directory scan or file write is performed.
 */
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { inspectAttemptEvidenceV1 } from "./immortal-agent-task-store-v1-adapter.mjs";

export const DEFAULT_MAX_EVIDENCE_SIDECAR_BYTES = 8 * 1024 * 1024;

const TASK_ID_PATTERN = /^TASK-[0-9]{14}-[0-9a-f]{8}$/;

function isWithin(parent, target) {
  const relative = path.relative(parent, target);
  return relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative);
}

function parseReference(task) {
  if (!task || typeof task !== "object" || typeof task.id !== "string" ||
      !TASK_ID_PATTERN.test(task.id) ||
      typeof task.evidencePath !== "string" || task.evidencePath.length === 0) {
    return { valid: false };
  }

  const normalized = task.evidencePath.replace(/\\/g, "/");
  const prefix = "data/evidence/" + task.id + "-attempt-";
  if (!normalized.startsWith(prefix) || !normalized.endsWith(".json")) {
    return { valid: false };
  }

  const attemptText = normalized.slice(prefix.length, -".json".length);
  if (!/^[1-9][0-9]*$/.test(attemptText)) return { valid: false };
  const attempt = Number(attemptText);
  if (!Number.isSafeInteger(attempt)) return { valid: false };
  if (Number.isInteger(task.attempts) && task.attempts > 0 && attempt > task.attempts) {
    return { valid: false };
  }

  return {
    valid: true,
    taskId: task.id,
    attempt,
    fileName: task.id + "-attempt-" + attempt + ".json"
  };
}

async function inspectDirectory(directoryPath) {
  let stat;
  try {
    stat = await lstat(directoryPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { kind: "missing" };
    return { kind: "error" };
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) return { kind: "unsafe" };

  try {
    return { kind: "ok", realPath: await realpath(directoryPath) };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Validate sidecars linked by already-inspected Task Store summaries.
 * The per-file byte cap is a safety bound for this probe, not a schema limit.
 */
export async function inspectReferencedAttemptEvidence({
  agentRoot,
  tasks,
  maxFileBytes = DEFAULT_MAX_EVIDENCE_SIDECAR_BYTES
} = {}) {
  if (typeof agentRoot !== "string" || agentRoot.length === 0) {
    throw new TypeError("agentRoot must be a non-empty path.");
  }
  if (!Array.isArray(tasks)) throw new TypeError("tasks must be an array.");
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1) {
    throw new TypeError("maxFileBytes must be a positive safe integer.");
  }

  const summary = {
    checked: true,
    result: "not-present",
    valid: null,
    referencedCount: 0,
    withoutEvidencePathCount: 0,
    validCount: 0,
    missingCount: 0,
    unsafeCount: 0,
    tooLargeCount: 0,
    invalidJsonCount: 0,
    invalidSchemaCount: 0,
    readErrorCount: 0,
    evidenceItemCount: 0,
    errorItemCount: 0,
    emptySidecarCount: 0,
    bytesRead: 0,
    maxFileBytes
  };

  const references = [];
  for (const task of tasks) {
    if (typeof task?.evidencePath !== "string" || task.evidencePath.length === 0) {
      summary.withoutEvidencePathCount++;
      continue;
    }
    summary.referencedCount++;
    const reference = parseReference(task);
    if (!reference.valid) {
      summary.unsafeCount++;
      continue;
    }
    references.push(reference);
  }

  if (summary.referencedCount === 0) return summary;
  if (references.length === 0) {
    summary.result = "PARTIAL_OR_FAIL";
    summary.valid = false;
    return summary;
  }

  let rootRealPath;
  try {
    const rootStat = await lstat(agentRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      summary.unsafeCount += references.length;
      summary.result = "PARTIAL_OR_FAIL";
      summary.valid = false;
      return summary;
    }
    rootRealPath = await realpath(agentRoot);
  } catch (error) {
    if (error?.code === "ENOENT") summary.missingCount += references.length;
    else summary.readErrorCount += references.length;
    summary.result = "PARTIAL_OR_FAIL";
    summary.valid = false;
    return summary;
  }

  const dataState = await inspectDirectory(path.join(rootRealPath, "data"));
  if (dataState.kind !== "ok") {
    if (dataState.kind === "missing") summary.missingCount += references.length;
    else if (dataState.kind === "unsafe") summary.unsafeCount += references.length;
    else summary.readErrorCount += references.length;
    summary.result = "PARTIAL_OR_FAIL";
    summary.valid = false;
    return summary;
  }
  if (!isWithin(rootRealPath, dataState.realPath)) {
    summary.unsafeCount += references.length;
    summary.result = "PARTIAL_OR_FAIL";
    summary.valid = false;
    return summary;
  }

  const evidenceState = await inspectDirectory(path.join(dataState.realPath, "evidence"));
  if (evidenceState.kind !== "ok") {
    if (evidenceState.kind === "missing") summary.missingCount += references.length;
    else if (evidenceState.kind === "unsafe") summary.unsafeCount += references.length;
    else summary.readErrorCount += references.length;
    summary.result = "PARTIAL_OR_FAIL";
    summary.valid = false;
    return summary;
  }
  if (!isWithin(rootRealPath, evidenceState.realPath)) {
    summary.unsafeCount += references.length;
    summary.result = "PARTIAL_OR_FAIL";
    summary.valid = false;
    return summary;
  }

  for (const reference of references) {
    const filePath = path.join(evidenceState.realPath, reference.fileName);
    let fileStat;
    try {
      fileStat = await lstat(filePath);
    } catch (error) {
      if (error?.code === "ENOENT") summary.missingCount++;
      else summary.readErrorCount++;
      continue;
    }

    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      summary.unsafeCount++;
      continue;
    }
    if (fileStat.size > maxFileBytes) {
      summary.tooLargeCount++;
      continue;
    }

    let realFilePath;
    try {
      realFilePath = await realpath(filePath);
    } catch {
      summary.readErrorCount++;
      continue;
    }
    if (!isWithin(evidenceState.realPath, realFilePath)) {
      summary.unsafeCount++;
      continue;
    }

    let raw;
    try {
      raw = await readFile(realFilePath, "utf8");
    } catch {
      summary.readErrorCount++;
      continue;
    }

    const bytes = Buffer.byteLength(raw, "utf8");
    if (bytes > maxFileBytes) {
      summary.tooLargeCount++;
      continue;
    }
    summary.bytesRead += bytes;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      summary.invalidJsonCount++;
      continue;
    }

    const inspected = inspectAttemptEvidenceV1(parsed, {
      taskId: reference.taskId,
      attempt: reference.attempt
    });
    if (!inspected.valid) {
      summary.invalidSchemaCount++;
      continue;
    }

    summary.validCount++;
    const evidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];
    summary.evidenceItemCount += evidence.length;
    summary.errorItemCount += evidence.filter(item => item.isError === true).length;
    if (evidence.length === 0) summary.emptySidecarCount++;
  }

  const rejectedCount = summary.missingCount + summary.unsafeCount +
    summary.tooLargeCount + summary.invalidJsonCount +
    summary.invalidSchemaCount + summary.readErrorCount;
  summary.valid = rejectedCount === 0 && summary.validCount === summary.referencedCount;
  summary.result = summary.valid ? "PASS" : "PARTIAL_OR_FAIL";
  return summary;
}
