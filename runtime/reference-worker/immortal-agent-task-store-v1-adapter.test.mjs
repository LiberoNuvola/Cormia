import test from "node:test";
import assert from "node:assert/strict";
import {
  checkExplicitResumeV1,
  inspectAttemptEvidenceV1,
  inspectTaskStoreV1
} from "./immortal-agent-task-store-v1-adapter.mjs";

const taskId = "TASK-20261102134028-a1b2c3d4";
const now = "2026-11-02T13:40:28.038Z";

function task(overrides = {}) {
  return {
    id: taskId,
    goal: "Read the current branch head and report the observed commit.",
    expectedTools: ["get_branch_head"],
    status: "paused",
    attempts: 1,
    createdAt: now,
    updatedAt: now,
    lastStartedAt: now,
    lastFinishedAt: now,
    toolsUsed: ["get_branch_head"],
    lastResult: "Previously observed result",
    lastError: "Task interrupted",
    evidencePath: "data/evidence/" + taskId + "-attempt-1.json",
    ...overrides
  };
}

test("inspects the existing v1 envelope without mutation", () => {
  const store = { version: 1, updatedAt: now, tasks: [task()] };
  const before = structuredClone(store);
  const result = inspectTaskStoreV1(store);
  assert.equal(result.valid, true);
  assert.equal(result.taskCount, 1);
  assert.equal(result.tasks[0].canExplicitlyResume, true);
  assert.deepEqual(store, before);
});

test("rejects unsupported store versions and malformed envelope", () => {
  assert.equal(inspectTaskStoreV1({ version: 2, tasks: [] }).valid, false);
  assert.equal(inspectTaskStoreV1({ version: 1 }).valid, false);
});

test("flags duplicate task identifiers", () => {
  const record = task();
  const result = inspectTaskStoreV1({ version: 1, tasks: [record, { ...record }] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("duplicated")));
});

test("allows legacy task records without expectedTools but reports a warning", () => {
  const legacy = task();
  delete legacy.expectedTools;
  const result = inspectTaskStoreV1({ version: 1, tasks: [legacy] });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some(warning => warning.includes("expectedTools")));
});

test("mirrors the existing explicit resume state allowlist", () => {
  for (const status of ["pending", "paused", "failed"]) {
    assert.equal(checkExplicitResumeV1(task({ status })).allowed, true, status);
  }
  for (const status of ["running", "completed"]) {
    assert.equal(checkExplicitResumeV1(task({ status })).allowed, false, status);
  }
});

test("does not describe resume as a continuation checkpoint", () => {
  const decision = checkExplicitResumeV1(task({ status: "paused" }));
  assert.equal(decision.allowed, true);
  assert.match(decision.semantics, /rerun-from-original-goal/);
  assert.match(decision.semantics, /previous result is untrusted context/);
});

test("rejects evidence paths outside data/evidence or mismatched attempt files", () => {
  for (const evidencePath of [
    "../../secrets.json",
    "data/audit/tasks.json",
    "C:\\data\\evidence\\x.json",
    "data/evidence/" + taskId + "-attempt-2.json"
  ]) {
    const result = inspectTaskStoreV1({ version: 1, tasks: [task({ evidencePath })] });
    assert.equal(result.valid, false, evidencePath);
  }
});

test("validates an attempt evidence sidecar linked to the exact task and attempt", () => {
  const sidecar = {
    version: 1,
    taskId,
    attempt: 1,
    updatedAt: now,
    evidence: [{
      observedAt: now,
      tool: "get_branch_head",
      arguments: {},
      isError: false,
      rawResultText: JSON.stringify({ branch: "main", commitSha: "a".repeat(40) })
    }]
  };
  assert.equal(inspectAttemptEvidenceV1(sidecar, { taskId, attempt: 1 }).valid, true);
  assert.equal(inspectAttemptEvidenceV1(sidecar, { taskId, attempt: 2 }).valid, false);
});

test("accepts Agent v0.8 sidecars without createdAt after an incremental save", () => {
  const sidecar = {
    version: 1,
    taskId,
    attempt: 1,
    updatedAt: now,
    evidence: []
  };
  assert.equal(inspectAttemptEvidenceV1(sidecar, { taskId, attempt: 1 }).valid, true);
});
