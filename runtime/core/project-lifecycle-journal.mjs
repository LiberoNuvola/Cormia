import { createHash, randomUUID } from "node:crypto";
import { open, lstat, mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

import {
  applyProjectLifecycleEvent
} from "./project-lifecycle-reducer.mjs";

const SCHEMA_VERSION = "0.1.0";
const RECORD_TYPE = "cormia.core.project-lifecycle-event";
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const DEFAULT_LOCK_TIMEOUT_MS = 2500;
const LOCK_RETRY_MS = 20;

export class ProjectLifecycleJournalError extends Error {
  constructor(message, code = "PROJECT_JOURNAL_ERROR", details = undefined) {
    super(message);
    this.name = "ProjectLifecycleJournalError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class ProjectLifecycleJournalCorruptionError extends ProjectLifecycleJournalError {
  constructor(message, details) {
    super(message, "PROJECT_JOURNAL_CORRUPT", details);
    this.name = "ProjectLifecycleJournalCorruptionError";
  }
}

export class ProjectLifecycleJournalLockError extends ProjectLifecycleJournalError {
  constructor(message) {
    super(message, "PROJECT_JOURNAL_LOCKED");
    this.name = "ProjectLifecycleJournalLockError";
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
    for (const key of Object.keys(value).sort()) {
      output[key] = stableValue(value[key]);
    }
    return output;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function digestRecord(record) {
  const { recordDigest: _ignored, ...unsigned } = record;
  return "sha256:" + createHash("sha256").update(stableStringify(unsigned), "utf8").digest("hex");
}

function intentOf(value) {
  return {
    eventType: value.eventType,
    actorRef: value.actorRef,
    reasonCode: value.reasonCode,
    evidenceRefs: value.evidenceRefs ?? [],
    causationRef: value.causationRef ?? null,
    correlationRef: value.correlationRef ?? null
  };
}

function sameIntent(left, right) {
  return stableStringify(intentOf(left)) === stableStringify(intentOf(right));
}

async function syncDirectoryBestEffort(directoryPath) {
  let handle;
  try {
    handle = await open(directoryPath, "r");
    await handle.sync();
  } catch (error) {
    // Windows and some filesystems do not allow opening/fsyncing directories.
    if (!["EINVAL", "EPERM", "EISDIR", "ENOTSUP", "EACCES"].includes(error?.code)) {
      throw error;
    }
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
      throw new ProjectLifecycleJournalError(
        "Journal path must be a regular file and cannot be a symbolic link.",
        "PROJECT_JOURNAL_UNSAFE_PATH"
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

/**
 * A lock file serializes readers/writers across local processes. A lock left
 * behind by a crashed process is NOT automatically removed: recovery is manual
 * and fail-closed rather than risking concurrent writers.
 */
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
        throw new ProjectLifecycleJournalLockError(
          "Journal lock is already held. A previous crash may have left a stale lock; it must be inspected and removed by the trusted host."
        );
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
}

function validateEventShape(event, expectedProjectRef, expectedSequence, previousDigest) {
  if (!isPlainObject(event)) throw new ProjectLifecycleJournalCorruptionError("Journal line is not a JSON object.");
  const allowedKeys = new Set([
    "schemaVersion", "recordType", "eventId", "projectRef", "sequence", "eventType",
    "fromState", "toState", "actorRef", "occurredAt", "reasonCode", "evidenceRefs",
    "causationRef", "correlationRef", "previousEventDigest", "recordDigest"
  ]);
  if (Object.keys(event).some(key => !allowedKeys.has(key))) {
    throw new ProjectLifecycleJournalCorruptionError("Journal event contains an undeclared property.");
  }
  if (event.schemaVersion !== SCHEMA_VERSION || event.recordType !== RECORD_TYPE) {
    throw new ProjectLifecycleJournalCorruptionError("Journal event schema or record type is unsupported.");
  }
  if (event.projectRef !== expectedProjectRef) {
    throw new ProjectLifecycleJournalCorruptionError("Journal event is bound to a different project.");
  }
  if (typeof event.eventId !== "string" || event.eventId.length < 1 || event.eventId.length > 512) {
    throw new ProjectLifecycleJournalCorruptionError("Journal eventId is missing or invalid.");
  }
  if (event.sequence !== expectedSequence) {
    throw new ProjectLifecycleJournalCorruptionError("Journal sequence is not contiguous.", {
      expected: expectedSequence, actual: event.sequence
    });
  }
  if (typeof event.eventType !== "string" || typeof event.actorRef !== "string" ||
      !event.actorRef.trim() || event.actorRef.length > 512 ||
      typeof event.reasonCode !== "string" || !event.reasonCode.trim() ||
      event.reasonCode.length > 128 || !isDateTime(event.occurredAt)) {
    throw new ProjectLifecycleJournalCorruptionError("Journal event is missing required identity, reason or timestamp fields.");
  }
  if (!Array.isArray(event.evidenceRefs) || event.evidenceRefs.length > 256 ||
      event.evidenceRefs.some(item => typeof item !== "string" || !item.trim() || item.length > 512) ||
      new Set(event.evidenceRefs).size !== event.evidenceRefs.length) {
    throw new ProjectLifecycleJournalCorruptionError("Journal evidenceRefs must be unique non-empty strings.");
  }
  for (const field of ["causationRef", "correlationRef"]) {
    if (event[field] !== undefined && (typeof event[field] !== "string" || !event[field].trim() || event[field].length > 512)) {
      throw new ProjectLifecycleJournalCorruptionError(field + " must be a non-empty string when present.");
    }
  }
  if (event.previousEventDigest !== previousDigest) {
    throw new ProjectLifecycleJournalCorruptionError("Journal previous-event digest does not match the prior record.");
  }
  if (typeof event.recordDigest !== "string" || !DIGEST_PATTERN.test(event.recordDigest) ||
      digestRecord(event) !== event.recordDigest) {
    throw new ProjectLifecycleJournalCorruptionError("Journal record digest is invalid.");
  }
  return event;
}

async function readEventsUnlocked(journalPath, projectRef) {
  const exists = await assertSafeJournalFile(journalPath);
  if (!exists) return [];
  const bytes = await readFile(journalPath);
  if (bytes.length === 0) return [];

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ProjectLifecycleJournalCorruptionError("Journal is not valid UTF-8.");
  }
  if (!text.endsWith("\n")) {
    throw new ProjectLifecycleJournalError(
      "Journal has an incomplete final line. Run explicit recover({ repairTornTail: true }) to discard only the uncommitted tail.",
      "PROJECT_JOURNAL_TORN_TAIL"
    );
  }

  const lines = text.slice(0, -1).split("\n");
  const events = [];
  const eventIds = new Set();
  let state = null;
  let previousDigest = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) throw new ProjectLifecycleJournalCorruptionError("Journal contains an empty line.", { line: index + 1 });
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      throw new ProjectLifecycleJournalCorruptionError("Journal contains malformed JSON.", { line: index + 1 });
    }

    validateEventShape(event, projectRef, index + 1, previousDigest);
    if (eventIds.has(event.eventId)) {
      throw new ProjectLifecycleJournalCorruptionError("Journal contains a duplicate eventId.", { eventId: event.eventId });
    }
    try {
      state = applyProjectLifecycleEvent(state, event);
    } catch (error) {
      throw new ProjectLifecycleJournalCorruptionError(
        "Journal event cannot be applied by the deterministic project reducer.",
        { line: index + 1, cause: error.message, code: error.code }
      );
    }
    events.push(event);
    eventIds.add(event.eventId);
    previousDigest = event.recordDigest;
  }
  return events;
}

function snapshotFromEvents(projectRef, events) {
  const last = events.at(-1) ?? null;
  return {
    projectRef,
    state: last?.toState ?? null,
    revision: events.length,
    lastEventId: last?.eventId ?? null,
    lastEventDigest: last?.recordDigest ?? null
  };
}

function validateCommand(command) {
  if (!isPlainObject(command)) throw new TypeError("command must be an object.");
  const allowedKeys = new Set([
    "eventId", "expectedRevision", "eventType", "actorRef", "occurredAt",
    "reasonCode", "evidenceRefs", "causationRef", "correlationRef"
  ]);
  if (Object.keys(command).some(key => !allowedKeys.has(key))) {
    throw new TypeError("command contains an undeclared property.");
  }
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) {
    throw new TypeError("expectedRevision must be a non-negative integer.");
  }
  if (typeof command.eventType !== "string" || !command.eventType.trim()) {
    throw new TypeError("eventType must be a non-empty string.");
  }
  if (typeof command.actorRef !== "string" || !command.actorRef.trim() || command.actorRef.length > 512) {
    throw new TypeError("actorRef must be a non-empty trusted actor reference.");
  }
  if (typeof command.reasonCode !== "string" || !command.reasonCode.trim() || command.reasonCode.length > 128) {
    throw new TypeError("reasonCode must be a non-empty stable reason code.");
  }
  if (command.eventId !== undefined &&
      (typeof command.eventId !== "string" || command.eventId.length < 1 || command.eventId.length > 512)) {
    throw new TypeError("eventId must be a non-empty string of at most 512 characters.");
  }
  if (command.occurredAt !== undefined && !isDateTime(command.occurredAt)) {
    throw new TypeError("occurredAt must be an ISO date-time.");
  }
  if (command.evidenceRefs !== undefined &&
      (!Array.isArray(command.evidenceRefs) || command.evidenceRefs.length > 256 ||
       command.evidenceRefs.some(item => typeof item !== "string" || !item.trim() || item.length > 512) ||
       new Set(command.evidenceRefs).size !== command.evidenceRefs.length)) {
    throw new TypeError("evidenceRefs must be an array of unique non-empty references.");
  }
  for (const field of ["causationRef", "correlationRef"]) {
    if (command[field] !== undefined && (typeof command[field] !== "string" || !command[field].trim() || command[field].length > 512)) {
      throw new TypeError(field + " must be a non-empty string when present.");
    }
  }
}

export function createProjectLifecycleJournal({
  journalPath,
  projectRef,
  lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS
} = {}) {
  if (typeof journalPath !== "string" || !path.isAbsolute(journalPath)) {
    throw new TypeError("journalPath must be an absolute host-resolved path.");
  }
  if (typeof projectRef !== "string" || !projectRef.trim() || projectRef.length > 512) {
    throw new TypeError("projectRef must be a non-empty host-resolved project reference of at most 512 characters.");
  }
  if (!Number.isInteger(lockTimeoutMs) || lockTimeoutMs < 1 || lockTimeoutMs > 60000) {
    throw new TypeError("lockTimeoutMs must be an integer between 1 and 60000.");
  }

  const absolutePath = path.resolve(journalPath);

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
    return { events, snapshot: snapshotFromEvents(projectRef, events) };
  }

  return Object.freeze({
    journalPath: absolutePath,
    projectRef,

    async read() {
      return withLock(async () => {
        const loaded = await loadUnlocked();
        return {
          ...loaded.snapshot,
          events: loaded.events
        };
      });
    },

    /**
     * Append one command under an exclusive local-process lock.
     * expectedRevision is a compare-and-set guard. eventId is also the
     * idempotency key; a retry with the same ID and intent returns the
     * originally committed event without appending a second line.
     */
    async append(command) {
      validateCommand(command);
      return withLock(async () => {
        const loaded = await loadUnlocked();
        const eventId = command.eventId ?? randomUUID();
        const prior = loaded.events.find(event => event.eventId === eventId);
        if (prior) {
          if (!sameIntent(prior, command)) {
            throw new ProjectLifecycleJournalError(
              "eventId was already used for a different lifecycle command.",
              "PROJECT_JOURNAL_IDEMPOTENCY_CONFLICT"
            );
          }
          return {
            appended: false,
            duplicate: true,
            event: prior,
            snapshot: loaded.snapshot
          };
        }

        if (command.expectedRevision !== loaded.snapshot.revision) {
          throw new ProjectLifecycleJournalError(
            "Project lifecycle revision changed; reload before retrying.",
            "PROJECT_JOURNAL_REVISION_CONFLICT",
            { expected: command.expectedRevision, actual: loaded.snapshot.revision }
          );
        }

        let toState;
        try {
          // The reducer is used before writing so invalid transitions never
          // reach disk. The journal derives fromState/sequence itself.
          const proposed = {
            recordType: RECORD_TYPE,
            fromState: loaded.snapshot.state,
            toState: null,
            eventType: command.eventType
          };
          const expectedTarget = (() => {
            const targets = {
              project_created: [null, "draft"],
              project_configured: ["draft", "configured"],
              project_activated: ["configured", "active"],
              project_paused: ["active", "paused"],
              project_resumed: ["paused", "active"],
              project_blocked: ["active", "blocked"],
              project_unblocked: ["blocked", "active"],
              project_completed: ["active", "completed"],
              project_archived: ["completed", "archived"],
              project_metadata_updated: [loaded.snapshot.state, loaded.snapshot.state]
            };
            const item = targets[command.eventType];
            if (!item || item[0] !== loaded.snapshot.state) {
              throw new Error("Invalid project lifecycle transition.");
            }
            return item[1];
          })();
          proposed.toState = expectedTarget;
          toState = applyProjectLifecycleEvent(loaded.snapshot.state, proposed);
        } catch (error) {
          throw new ProjectLifecycleJournalError(
            error.message,
            "PROJECT_JOURNAL_TRANSITION_DENIED"
          );
        }

        if (command.eventType === "project_metadata_updated" &&
            (!command.evidenceRefs || command.evidenceRefs.length === 0)) {
          throw new ProjectLifecycleJournalError(
            "Metadata updates must reference the resulting metadata artifact/digest in evidenceRefs.",
            "PROJECT_JOURNAL_METADATA_EVIDENCE_REQUIRED"
          );
        }

        const unsignedEvent = {
          schemaVersion: SCHEMA_VERSION,
          recordType: RECORD_TYPE,
          eventId,
          projectRef,
          sequence: loaded.snapshot.revision + 1,
          eventType: command.eventType,
          fromState: loaded.snapshot.state,
          toState,
          actorRef: command.actorRef,
          occurredAt: command.occurredAt ?? new Date().toISOString(),
          reasonCode: command.reasonCode,
          evidenceRefs: command.evidenceRefs ?? [],
          ...(command.causationRef ? { causationRef: command.causationRef } : {}),
          ...(command.correlationRef ? { correlationRef: command.correlationRef } : {}),
          previousEventDigest: loaded.snapshot.lastEventDigest
        };
        const event = {
          ...unsignedEvent,
          recordDigest: digestRecord(unsignedEvent)
        };
        const line = JSON.stringify(event) + "\n";

        const exists = await assertSafeJournalFile(absolutePath);
        const handle = await open(absolutePath, "a", 0o600);
        try {
          await handle.writeFile(line, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        if (!exists) await syncDirectoryBestEffort(path.dirname(absolutePath));

        const snapshot = {
          projectRef,
          state: toState,
          revision: event.sequence,
          lastEventId: event.eventId,
          lastEventDigest: event.recordDigest
        };
        return { appended: true, duplicate: false, event, snapshot, createdFile: !exists };
      });
    },

    /**
     * Inspect and optionally remove only a non-newline-terminated final tail.
     * No complete/corrupt record is rewritten. Torn-tail repair is explicit.
     */
    async recover({ repairTornTail = false } = {}) {
      if (typeof repairTornTail !== "boolean") {
        throw new TypeError("repairTornTail must be boolean.");
      }
      return withLock(async () => {
        const exists = await assertSafeJournalFile(absolutePath);
        if (!exists) {
          return { repaired: false, truncatedBytes: 0, ...(await loadUnlocked()).snapshot };
        }
        const bytes = await readFile(absolutePath);
        let truncatedBytes = 0;
        if (bytes.length > 0 && bytes[bytes.length - 1] !== 0x0a) {
          if (!repairTornTail) {
            throw new ProjectLifecycleJournalError(
              "Journal has an incomplete final line. Explicit repair is required.",
              "PROJECT_JOURNAL_TORN_TAIL"
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
          ...loaded.snapshot
        };
      });
    }
  });
}
