import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createProjectLifecycleJournal,
  ProjectLifecycleJournalError,
  ProjectLifecycleJournalCorruptionError
} from "./project-lifecycle-journal.mjs";
import {
  applyProjectLifecycleEvent,
  reduceProjectLifecycle
} from "./project-lifecycle-reducer.mjs";

const PROJECT_REF = "project:cormia-core-journal-test";
const ACTOR_REF = "runtime:test-host";
const FIXED_TIME = "2026-11-03T12:00:00.000Z";

async function makeHarness(options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cormia-project-journal-"));
  const journalPath = path.join(directory, "journal", "project.ndjson");
  const journal = createProjectLifecycleJournal({
    journalPath,
    projectRef: PROJECT_REF,
    ...options
  });
  return {
    directory,
    journal,
    journalPath,
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    }
  };
}

function command(eventType, expectedRevision, extra = {}) {
  return {
    eventType,
    expectedRevision,
    actorRef: ACTOR_REF,
    reasonCode: "test_contract",
    occurredAt: FIXED_TIME,
    ...extra
  };
}

async function createActiveProject(journal) {
  await journal.append(command("project_created", 0, { eventId: "event-create" }));
  await journal.append(command("project_configured", 1, { eventId: "event-configure" }));
  await journal.append(command("project_activated", 2, { eventId: "event-activate" }));
}

test("reducer applies only the declared project lifecycle transitions", () => {
  const events = [
    { recordType: "cormia.core.project-lifecycle-event", projectRef: PROJECT_REF, eventType: "project_created", fromState: null, toState: "draft" },
    { recordType: "cormia.core.project-lifecycle-event", projectRef: PROJECT_REF, eventType: "project_configured", fromState: "draft", toState: "configured" },
    { recordType: "cormia.core.project-lifecycle-event", projectRef: PROJECT_REF, eventType: "project_activated", fromState: "configured", toState: "active" },
    { recordType: "cormia.core.project-lifecycle-event", projectRef: PROJECT_REF, eventType: "project_paused", fromState: "active", toState: "paused" },
    { recordType: "cormia.core.project-lifecycle-event", projectRef: PROJECT_REF, eventType: "project_resumed", fromState: "paused", toState: "active" }
  ];
  let state = null;
  for (const event of events) state = applyProjectLifecycleEvent(state, event);
  assert.equal(state, "active");
  assert.equal(reduceProjectLifecycle(events, { projectRef: PROJECT_REF }).revision, 5);
});

test("reducer rejects task/authority state substitutions and invalid transitions", () => {
  assert.throws(
    () => applyProjectLifecycleEvent("active", {
      recordType: "cormia.core.project-lifecycle-event",
      eventType: "project_archived",
      fromState: "active",
      toState: "archived"
    }),
    error => error.code === "PROJECT_LIFECYCLE_TRANSITION_INVALID"
  );
  assert.throws(
    () => applyProjectLifecycleEvent("active", {
      recordType: "cormia.core.project-lifecycle-event",
      eventType: "project_paused",
      fromState: "revoked",
      toState: "paused"
    }),
    /fromState/
  );
});

test("journal appends, fsyncs and reconstructs the same projection after a fresh instance", async t => {
  const h = await makeHarness();
  t.after(h.cleanup);
  await createActiveProject(h.journal);

  const reopened = createProjectLifecycleJournal({
    journalPath: h.journalPath,
    projectRef: PROJECT_REF
  });
  const result = await reopened.read();
  assert.equal(result.state, "active");
  assert.equal(result.revision, 3);
  assert.equal(result.events.length, 3);
  assert.equal(result.events[0].previousEventDigest, null);
  assert.equal(result.events[1].previousEventDigest, result.events[0].recordDigest);
  assert.equal(result.events[2].previousEventDigest, result.events[1].recordDigest);
  assert.match(result.lastEventDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal("authorityState" in result, false);
  assert.equal("taskState" in result, false);
});

test("same eventId and same intent is idempotent even when the caller retries", async t => {
  const h = await makeHarness();
  t.after(h.cleanup);
  const create = command("project_created", 0, { eventId: "stable-event-id" });
  const first = await h.journal.append(create);
  const retry = await h.journal.append(create);
  const result = await h.journal.read();

  assert.equal(first.appended, true);
  assert.equal(retry.appended, false);
  assert.equal(retry.duplicate, true);
  assert.equal(result.revision, 1);
});

test("reusing eventId for a different command fails closed", async t => {
  const h = await makeHarness();
  t.after(h.cleanup);
  await h.journal.append(command("project_created", 0, { eventId: "same-id" }));
  await assert.rejects(
    () => h.journal.append(command("project_configured", 1, {
      eventId: "same-id",
      reasonCode: "different_intent"
    })),
    error => error.code === "PROJECT_JOURNAL_IDEMPOTENCY_CONFLICT"
  );
  assert.equal((await h.journal.read()).revision, 1);
});

test("expectedRevision prevents stale and concurrent lifecycle writes", async t => {
  const h = await makeHarness();
  t.after(h.cleanup);
  const outcomes = await Promise.allSettled([
    h.journal.append(command("project_created", 0, { eventId: "create-a" })),
    h.journal.append(command("project_created", 0, { eventId: "create-b" }))
  ]);
  assert.equal(outcomes.filter(item => item.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(item =>
    item.status === "rejected" && item.reason.code === "PROJECT_JOURNAL_REVISION_CONFLICT"
  ).length, 1);
  assert.equal((await h.journal.read()).revision, 1);
});

test("invalid lifecycle commands are not appended", async t => {
  const h = await makeHarness();
  t.after(h.cleanup);
  await assert.rejects(
    () => h.journal.append(command("project_activated", 0)),
    error => error.code === "PROJECT_JOURNAL_TRANSITION_DENIED"
  );
  assert.equal((await h.journal.read()).revision, 0);
});

test("metadata updates must reference the resulting metadata artifact", async t => {
  const h = await makeHarness();
  t.after(h.cleanup);
  await h.journal.append(command("project_created", 0));
  await assert.rejects(
    () => h.journal.append(command("project_metadata_updated", 1)),
    error => error.code === "PROJECT_JOURNAL_METADATA_EVIDENCE_REQUIRED"
  );
  await h.journal.append(command("project_metadata_updated", 1, {
    evidenceRefs: ["artifact:project-metadata:sha256:abc"]
  }));
  const result = await h.journal.read();
  assert.equal(result.state, "draft");
  assert.equal(result.revision, 2);
});

test("complete record tampering is detected through the digest chain", async t => {
  const h = await makeHarness();
  t.after(h.cleanup);
  await h.journal.append(command("project_created", 0));
  const lines = (await readFile(h.journalPath, "utf8")).trimEnd().split("\n");
  const event = JSON.parse(lines[0]);
  event.actorRef = "runtime:tampered";
  await writeFile(h.journalPath, JSON.stringify(event) + "\n", "utf8");

  await assert.rejects(
    () => h.journal.read(),
    error => error instanceof ProjectLifecycleJournalCorruptionError &&
      error.code === "PROJECT_JOURNAL_CORRUPT"
  );
});

test("an incomplete final line blocks reads and is removed only by explicit recovery", async t => {
  const h = await makeHarness();
  t.after(h.cleanup);
  await h.journal.append(command("project_created", 0));
  const validBytes = (await readFile(h.journalPath)).length;
  await writeFile(h.journalPath, '{"partial":', { flag: "a" });

  await assert.rejects(
    () => h.journal.read(),
    error => error.code === "PROJECT_JOURNAL_TORN_TAIL"
  );
  await assert.rejects(
    () => h.journal.recover(),
    error => error.code === "PROJECT_JOURNAL_TORN_TAIL"
  );
  const recovery = await h.journal.recover({ repairTornTail: true });
  assert.equal(recovery.repaired, true);
  assert.equal(recovery.truncatedBytes, 11);
  assert.equal((await readFile(h.journalPath)).length, validBytes);
  assert.equal((await h.journal.read()).state, "draft");
});

test("a complete malformed line is never discarded by torn-tail recovery", async t => {
  const h = await makeHarness();
  t.after(h.cleanup);
  await writeFile(h.journalPath, "{not-json}\n", "utf8");
  await assert.rejects(
    () => h.journal.recover({ repairTornTail: true }),
    error => error.code === "PROJECT_JOURNAL_CORRUPT"
  );
  assert.equal(await readFile(h.journalPath, "utf8"), "{not-json}\n");
});

test("a pre-existing lock is not automatically stolen or deleted", async t => {
  const h = await makeHarness({ lockTimeoutMs: 40 });
  t.after(h.cleanup);
  await mkdir(path.dirname(h.journalPath), { recursive: true });
  await writeFile(h.journalPath + ".lock", "operator-inspection-required\n", "utf8");
  await assert.rejects(
    () => h.journal.append(command("project_created", 0)),
    error => error instanceof ProjectLifecycleJournalError && error.code === "PROJECT_JOURNAL_LOCKED"
  );
  assert.equal(await readFile(h.journalPath + ".lock", "utf8"), "operator-inspection-required\n");
});

test("journal refuses relative and symbolic-link paths", async t => {
  const h = await makeHarness();
  t.after(h.cleanup);
  assert.throws(
    () => createProjectLifecycleJournal({ journalPath: "relative/journal.ndjson", projectRef: PROJECT_REF }),
    /absolute host-resolved path/
  );
  const realFile = path.join(h.directory, "real.ndjson");
  const linkFile = path.join(h.directory, "link.ndjson");
  await writeFile(realFile, "");
  try {
    await symlink(realFile, linkFile);
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
      t.skip("Symbolic links are unavailable on this host.");
      return;
    }
    throw error;
  }
  const linked = createProjectLifecycleJournal({ journalPath: linkFile, projectRef: PROJECT_REF });
  await assert.rejects(
    () => linked.read(),
    error => error.code === "PROJECT_JOURNAL_UNSAFE_PATH"
  );
});
