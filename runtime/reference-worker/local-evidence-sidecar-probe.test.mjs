import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectReferencedAttemptEvidence } from "./local-evidence-sidecar-probe.mjs";

const taskId = "TASK-20261102134028-a1b2c3d4";
const now = "2026-11-02T13:40:28.038Z";

function task(overrides = {}) {
  return {
    id: taskId,
    attempts: 1,
    evidencePath: "data/evidence/" + taskId + "-attempt-1.json",
    ...overrides
  };
}

function sidecar(overrides = {}) {
  return {
    version: 1,
    taskId,
    attempt: 1,
    updatedAt: now,
    evidence: [{
      observedAt: now,
      tool: "get_branch_head",
      arguments: {},
      isError: false,
      rawResultText: JSON.stringify({ privatePayload: "must-never-be-returned" })
    }],
    ...overrides
  };
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "cormia-evidence-probe-"));
  await mkdir(path.join(root, "data", "evidence"), { recursive: true });
  t.after(async () => rm(root, { recursive: true, force: true }));
  return root;
}

test("validates only a referenced sidecar and returns aggregate metadata, never payload", async t => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "data", "evidence", taskId + "-attempt-1.json"),
    JSON.stringify(sidecar())
  );

  const result = await inspectReferencedAttemptEvidence({ agentRoot: root, tasks: [task()] });
  assert.equal(result.result, "PASS");
  assert.equal(result.valid, true);
  assert.equal(result.referencedCount, 1);
  assert.equal(result.validCount, 1);
  assert.equal(result.evidenceItemCount, 1);
  assert.equal(result.errorItemCount, 0);
  assert.equal(JSON.stringify(result).includes("must-never-be-returned"), false);
  assert.equal(JSON.stringify(result).includes(taskId), false);
});

test("accepts an incremental sidecar without createdAt and with an empty evidence array", async t => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "data", "evidence", taskId + "-attempt-1.json"),
    JSON.stringify(sidecar({ evidence: [] }))
  );

  const result = await inspectReferencedAttemptEvidence({ agentRoot: root, tasks: [task()] });
  assert.equal(result.valid, true);
  assert.equal(result.emptySidecarCount, 1);
  assert.equal(result.evidenceItemCount, 0);
});

test("reports a missing referenced sidecar without scanning or creating files", async t => {
  const root = await fixture(t);
  const result = await inspectReferencedAttemptEvidence({ agentRoot: root, tasks: [task()] });
  assert.equal(result.result, "PARTIAL_OR_FAIL");
  assert.equal(result.missingCount, 1);
  assert.equal(result.validCount, 0);
});

test("rejects a path that is not the exact task-bound evidence filename", async t => {
  const root = await fixture(t);
  const result = await inspectReferencedAttemptEvidence({
    agentRoot: root,
    tasks: [task({ evidencePath: "../outside.json" })]
  });
  assert.equal(result.unsafeCount, 1);
  assert.equal(result.bytesRead, 0);
});

test("rejects a sidecar whose embedded task ID or attempt does not match its filename", async t => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "data", "evidence", taskId + "-attempt-1.json"),
    JSON.stringify(sidecar({ attempt: 2 }))
  );

  const result = await inspectReferencedAttemptEvidence({ agentRoot: root, tasks: [task()] });
  assert.equal(result.invalidSchemaCount, 1);
  assert.equal(result.valid, false);
});

test("rejects malformed JSON without exposing parser details or payload", async t => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "data", "evidence", taskId + "-attempt-1.json"),
    "{ \"privatePayload\": \"never-print\" "
  );

  const result = await inspectReferencedAttemptEvidence({ agentRoot: root, tasks: [task()] });
  assert.equal(result.invalidJsonCount, 1);
  assert.equal(JSON.stringify(result).includes("privatePayload"), false);
  assert.equal(JSON.stringify(result).includes("never-print"), false);
});

test("skips files above the bounded probe size", async t => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "data", "evidence", taskId + "-attempt-1.json"),
    JSON.stringify(sidecar())
  );

  const result = await inspectReferencedAttemptEvidence({
    agentRoot: root,
    tasks: [task()],
    maxFileBytes: 10
  });
  assert.equal(result.tooLargeCount, 1);
  assert.equal(result.bytesRead, 0);
});

test("does not follow an evidence directory symlink", async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "cormia-evidence-symlink-"));
  const root = path.join(parent, "agent");
  const outside = path.join(parent, "outside");
  await mkdir(path.join(root, "data"), { recursive: true });
  await mkdir(outside);
  await symlink(outside, path.join(root, "data", "evidence"), "dir");
  t.after(async () => rm(parent, { recursive: true, force: true }));

  const result = await inspectReferencedAttemptEvidence({ agentRoot: root, tasks: [task()] });
  assert.equal(result.unsafeCount, 1);
  assert.equal(result.bytesRead, 0);
});

test("does not read any sidecar while a task is marked running", async t => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "data", "evidence", taskId + "-attempt-1.json"),
    JSON.stringify(sidecar())
  );

  const result = await inspectReferencedAttemptEvidence({
    agentRoot: root,
    tasks: [task({ status: "running" })]
  });
  assert.equal(result.result, "PARTIAL_OR_FAIL");
  assert.equal(result.runningTaskCount, 1);
  assert.equal(result.bytesRead, 0);
  assert.equal(result.validCount, 0);
});

test("reports when no tasks reference an evidence sidecar", async t => {
  const root = await fixture(t);
  const result = await inspectReferencedAttemptEvidence({
    agentRoot: root,
    tasks: [task({ evidencePath: null })]
  });
  assert.equal(result.result, "not-present");
  assert.equal(result.valid, null);
  assert.equal(result.referencedCount, 0);
  assert.equal(result.withoutEvidencePathCount, 1);
});
