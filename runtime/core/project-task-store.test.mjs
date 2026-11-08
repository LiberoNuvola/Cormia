import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, appendFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createProjectTaskStore,
  ProjectTaskStoreError
} from "./project-task-store.mjs";

const PROJECT_A = "project:immortal";
const PROJECT_B = "project:other";
const TASK_A = "task:immortal-a";
const TASK_B = "task:immortal-b";
const MANIFEST_A = "sha256:" + "a".repeat(64);
const MANIFEST_B = "sha256:" + "b".repeat(64);
const NOW = "2026-11-08T05:45:00.000Z";

async function fixture(projectRef = PROJECT_A) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cormia-task-store-"));
  const journalPath = path.join(directory, "tasks.ndjson");
  const store = createProjectTaskStore({
    journalPath,
    projectRef,
    clock: () => new Date(NOW)
  });
  return {
    directory,
    journalPath,
    store,
    reopen(nextProjectRef = projectRef) {
      return createProjectTaskStore({
        journalPath,
        projectRef: nextProjectRef,
        clock: () => new Date(NOW)
      });
    },
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    }
  };
}

function commandBase(expectedRevision, overrides = {}) {
  return {
    expectedRevision,
    actorRef: "host:cormia-supervisor",
    reasonCode: "test_operation",
    ...overrides
  };
}

async function enqueue(store, taskRef = TASK_A, expectedRevision = 0, options = {}) {
  return store.enqueue(commandBase(expectedRevision, {
    taskRef,
    manifestDigest: options.manifestDigest ?? MANIFEST_A,
    goal: options.goal ?? "Implement the bounded task objective.",
    sourceRef: options.sourceRef ?? "source:operator-request",
    maxAttempts: options.maxAttempts ?? 3,
    ...(options.dependsOn ? { dependsOn: options.dependsOn } : {}),
    ...(options.evidenceRefs ? { evidenceRefs: options.evidenceRefs } : {}),
    ...(options.eventId ? { eventId: options.eventId } : {})
  }));
}

async function claim(store, taskRef, expectedRevision, workerRef = "worker:cormia-local") {
  return store.claim(commandBase(expectedRevision, { taskRef, workerRef }));
}

test("task queue is durable, project-bound and replayable by a fresh store instance", async () => {
  const f = await fixture();
  try {
    const created = await enqueue(f.store);
    assert.equal(created.task.state, "queued");
    assert.equal(created.snapshot.revision, 1);

    const reopened = f.reopen();
    const loaded = await reopened.read();
    assert.equal(loaded.projectRef, PROJECT_A);
    assert.equal(loaded.tasks.length, 1);
    assert.equal(loaded.tasks[0].taskRef, TASK_A);
    assert.equal(loaded.tasks[0].manifestDigest, MANIFEST_A);
    assert.equal(loaded.tasks[0].state, "queued");

    const wrongProjectStore = f.reopen(PROJECT_B);
    await assert.rejects(
      wrongProjectStore.read(),
      error => error.code === "PROJECT_TASK_JOURNAL_CORRUPT"
    );
  } finally {
    await f.cleanup();
  }
});

test("claim, checkpoint and completion persist attempt and evidence state", async () => {
  const f = await fixture();
  try {
    await enqueue(f.store);
    const claimed = await claim(f.store, TASK_A, 1);
    assert.equal(claimed.task.state, "running");
    assert.equal(claimed.task.attempt, 1);
    assert.equal(claimed.task.workerRef, "worker:cormia-local");

    const checkpointed = await f.store.checkpoint(commandBase(2, {
      taskRef: TASK_A,
      workerRef: "worker:cormia-local",
      attempt: 1,
      checkpointRef: "checkpoint:task-a:step-1",
      effectBoundary: "no_external_effects",
      evidenceRefs: ["evidence:checkpoint-1"]
    }));
    assert.equal(checkpointed.task.state, "running");
    assert.equal(checkpointed.task.lastCheckpointRef, "checkpoint:task-a:step-1");
    assert.equal(checkpointed.task.lastEffectBoundary, "no_external_effects");

    const completed = await f.store.complete(commandBase(3, {
      taskRef: TASK_A,
      workerRef: "worker:cormia-local",
      attempt: 1,
      evidenceRefs: ["evidence:test-pass", "evidence:result-digest"]
    }));
    assert.equal(completed.task.state, "completed");
    assert.deepEqual(completed.task.evidenceRefs, [
      "evidence:checkpoint-1", "evidence:test-pass", "evidence:result-digest"
    ]);

    const reopened = await f.reopen().read();
    assert.equal(reopened.tasks[0].state, "completed");
    assert.equal(reopened.tasks[0].attempt, 1);
    assert.equal(reopened.revision, 4);
  } finally {
    await f.cleanup();
  }
});

test("restart marks running tasks recovery_required and never requeues them automatically", async () => {
  const f = await fixture();
  try {
    await enqueue(f.store);
    await claim(f.store, TASK_A, 1);

    const reopened = f.reopen();
    const recovery = await reopened.recoverInterruptedTasks(commandBase(2, {
      reasonCode: "process_restart"
    }));
    assert.deepEqual(recovery.recovered, [TASK_A]);
    assert.equal(recovery.snapshot.tasks[0].state, "recovery_required");
    assert.deepEqual(await reopened.listRunnable(), []);

    await assert.rejects(
      reopened.reconcileInterrupted(commandBase(3, {
        taskRef: TASK_A,
        decision: "safe_to_retry"
      })),
      TypeError
    );

    const reconciled = await reopened.reconcileInterrupted(commandBase(3, {
      taskRef: TASK_A,
      decision: "safe_to_retry",
      reasonCode: "side_effects_reconciled",
      evidenceRefs: ["evidence:external-state-checked"]
    }));
    assert.equal(reconciled.task.state, "queued");
    assert.equal((await reopened.listRunnable()).length, 1);

    const reclaimed = await claim(reopened, TASK_A, 4);
    assert.equal(reclaimed.task.attempt, 2);
    assert.equal(reclaimed.task.state, "running");
  } finally {
    await f.cleanup();
  }
});

test("an active task can be interrupted immediately into recovery_required", async () => {
  const f = await fixture();
  try {
    await enqueue(f.store);
    await claim(f.store, TASK_A, 1);
    const interrupted = await f.store.interrupt(commandBase(2, {
      taskRef: TASK_A,
      workerRef: "worker:cormia-local",
      attempt: 1,
      evidenceRefs: ["evidence:executor-interrupted"]
    }));
    assert.equal(interrupted.task.state, "recovery_required");
    assert.equal(interrupted.task.workerRef, "worker:cormia-local");
    assert.deepEqual(await f.store.listRunnable(), []);

    const reconciled = await f.store.reconcileInterrupted(commandBase(3, {
      taskRef: TASK_A,
      decision: "blocked",
      evidenceRefs: ["evidence:side-effect-state-unknown"]
    }));
    assert.equal(reconciled.task.state, "blocked");
  } finally {
    await f.cleanup();
  }
});

test("recovery safe_to_retry is denied after maxAttempts is exhausted", async () => {
  const f = await fixture();
  try {
    await enqueue(f.store, TASK_A, 0, { maxAttempts: 1 });
    await claim(f.store, TASK_A, 1);
    const store = f.reopen();
    await store.recoverInterruptedTasks(commandBase(2, { reasonCode: "process_restart" }));

    await assert.rejects(
      store.reconcileInterrupted(commandBase(3, {
        taskRef: TASK_A,
        decision: "safe_to_retry",
        evidenceRefs: ["evidence:reconciliation"]
      })),
      error => error.code === "PROJECT_TASK_ATTEMPTS_EXHAUSTED"
    );

    const blocked = await store.reconcileInterrupted(commandBase(3, {
      taskRef: TASK_A,
      decision: "blocked",
      evidenceRefs: ["evidence:manual-reconciliation-required"]
    }));
    assert.equal(blocked.task.state, "blocked");
  } finally {
    await f.cleanup();
  }
});

test("task dependencies must exist in the same project and complete before claim", async () => {
  const f = await fixture();
  try {
    await enqueue(f.store, TASK_A, 0);
    await enqueue(f.store, TASK_B, 1, {
      manifestDigest: MANIFEST_B,
      dependsOn: [TASK_A]
    });

    assert.deepEqual((await f.store.listRunnable()).map(task => task.taskRef), [TASK_A]);
    await assert.rejects(
      claim(f.store, TASK_B, 2),
      error => error.code === "PROJECT_TASK_DEPENDENCIES_NOT_READY"
    );

    await claim(f.store, TASK_A, 2);
    await f.store.complete(commandBase(3, {
      taskRef: TASK_A,
      workerRef: "worker:cormia-local",
      attempt: 1,
      evidenceRefs: ["evidence:task-a-complete"]
    }));
    assert.deepEqual((await f.store.listRunnable()).map(task => task.taskRef), [TASK_B]);
    const claimedB = await claim(f.store, TASK_B, 4);
    assert.equal(claimedB.task.state, "running");
  } finally {
    await f.cleanup();
  }
});

test("concurrent claims with the same expected revision produce one winner", async () => {
  const f = await fixture();
  try {
    await enqueue(f.store);
    const otherHandle = f.reopen();
    const results = await Promise.allSettled([
      claim(f.store, TASK_A, 1, "worker:one"),
      claim(otherHandle, TASK_A, 1, "worker:two")
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected").length, 1);
    const rejection = results.find(result => result.status === "rejected");
    assert.equal(rejection.reason.code, "PROJECT_TASK_REVISION_CONFLICT");
    const final = await f.store.read();
    assert.equal(final.tasks[0].state, "running");
    assert.equal(final.tasks[0].attempt, 1);
  } finally {
    await f.cleanup();
  }
});

test("task event idempotency rejects reuse for a different task goal", async () => {
  const f = await fixture();
  try {
    await enqueue(f.store, TASK_A, 0, { eventId: "event:stable-create" });
    const duplicate = await enqueue(f.store, TASK_A, 0, { eventId: "event:stable-create" });
    assert.equal(duplicate.appended, false);
    assert.equal(duplicate.duplicate, true);

    await assert.rejects(
      enqueue(f.store, TASK_A, 0, {
        eventId: "event:stable-create",
        goal: "A different task goal."
      }),
      error => error.code === "PROJECT_TASK_IDEMPOTENCY_CONFLICT"
    );
  } finally {
    await f.cleanup();
  }
});

test("torn-tail repair is explicit and preserves all complete task events", async () => {
  const f = await fixture();
  try {
    await enqueue(f.store);
    await appendFile(f.journalPath, '{"partial":', "utf8");

    await assert.rejects(
      f.store.read(),
      error => error.code === "PROJECT_TASK_JOURNAL_TORN_TAIL"
    );
    await assert.rejects(
      f.store.recover(),
      error => error.code === "PROJECT_TASK_JOURNAL_TORN_TAIL"
    );

    const repaired = await f.store.recover({ repairTornTail: true });
    assert.equal(repaired.repaired, true);
    assert.equal(repaired.tasks.length, 1);
    assert.equal(repaired.tasks[0].state, "queued");
    assert.equal((await f.store.read()).revision, 1);
  } finally {
    await f.cleanup();
  }
});

test("complete tasks require evidence and cannot be claimed again", async () => {
  const f = await fixture();
  try {
    await enqueue(f.store);
    await claim(f.store, TASK_A, 1);
    await assert.rejects(
      f.store.complete(commandBase(2, {
        taskRef: TASK_A,
        workerRef: "worker:cormia-local",
        attempt: 1,
        evidenceRefs: []
      })),
      TypeError
    );
    const result = await f.store.complete(commandBase(2, {
      taskRef: TASK_A,
      workerRef: "worker:cormia-local",
      attempt: 1,
      evidenceRefs: ["evidence:verified-result"]
    }));
    assert.equal(result.task.state, "completed");
    await assert.rejects(
      claim(f.store, TASK_A, 3),
      error => error.code === "PROJECT_TASK_NOT_QUEUED"
    );
  } finally {
    await f.cleanup();
  }
});

test("unknown task state transitions and ungrounded dependencies are rejected", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      enqueue(f.store, TASK_A, 0, { dependsOn: ["task:not-created"] }),
      error => error.code === "PROJECT_TASK_DEPENDENCY_INVALID"
    );
    const created = await enqueue(f.store);
    await assert.rejects(
      f.store.unblock(commandBase(created.snapshot.revision, {
        taskRef: TASK_A,
        evidenceRefs: ["evidence:not-blocked"]
      })),
      error => error.code === "PROJECT_TASK_STATE_INVALID"
    );
  } finally {
    await f.cleanup();
  }
});
