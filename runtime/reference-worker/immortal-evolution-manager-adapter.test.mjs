import test from "node:test";
import assert from "node:assert/strict";
import {
  bindEvolutionRun,
  listEvolutionRuns,
  startEvolutionRun
} from "./immortal-evolution-manager-adapter.mjs";

const runId = "EVOL-20261102143000-a1b2c3d4";
const root = "/workspace";
const sourceFiles = {
  "resource-manager.mjs": "/workspace/self-improvement/resource-manager.mjs",
  "evolution-manager.mjs": "/workspace/self-improvement/evolution-manager.mjs",
  "resource-manager.test.mjs": "/workspace/self-improvement/self-improvement.test.mjs",
  "evolution-manager.test.mjs": "/workspace/self-improvement/self-improvement.test.mjs"
};
const source = {
  "resource-manager.mjs": "export const a = 1;\n",
  "evolution-manager.mjs": "export const b = 2;\n",
  "resource-manager.test.mjs": "test baseline one;\n",
  "evolution-manager.test.mjs": "test baseline two;\n"
};
const sha = value => {
  return import("node:crypto").then(({ createHash }) => createHash("sha256").update(value).digest("hex"));
};
function fakeManager({ status = "candidate_open", patchResult = null } = {}) {
  const state = { status, files: { ...source }, written: [], patched: [], evaluated: [], promoted: false };
  const manager = {
    workspaceRoot: root,
    sourceFiles: { ...sourceFiles },
    state,
    async start(goal) {
      state.goal = goal;
      return { id: runId, status: "candidate_open", goal, sourceCount: 4 };
    },
    async list() {
      return [{ id: runId, status: state.status, goal: "Improve reliability", sourceCount: 4, candidateFileCount: 4, eligibleForHumanReview: false }];
    },
    async readCandidate(id, file) {
      assert.equal(id, runId);
      const content = state.files[file];
      if (content === undefined) throw new Error("missing file");
      return { runId: id, path: file, content, bytes: Buffer.byteLength(content), sha256: await sha(content), status: state.status };
    },
    async writeCandidate(id, file, content) {
      assert.equal(id, runId);
      if (state.files[file] !== undefined) throw new Error("file exists");
      state.files[file] = content;
      state.written.push(file);
      return { ok: true, path: file, sha256: await sha(content), bytes: Buffer.byteLength(content) };
    },
    async patchCandidate(id, file, expectedSha256, content) {
      assert.equal(id, runId);
      const current = await this.readCandidate(id, file);
      if (current.sha256 !== expectedSha256) throw new Error("stale sha");
      state.files[file] = content;
      state.patched.push(file);
      return { ok: true, path: file, sha256: await sha(content) };
    },
    async evaluate(id, evidence) { state.evaluated.push({ id, evidence }); return { eligibleForHumanReview: true }; },
    async promotionPacket(id) { return { runId: id, status: "eligible_for_human_review", files: [] }; },
    async promote() { state.promoted = true; }
  };
  return manager;
}
function hostEvidence() {
  return {
    workspaceVerify: {
      tool: "workspace_verify", ok: true,
      files: [
        { path: "resource-manager.mjs", ok: true, sha256: "a".repeat(64) },
        { path: "evolution-manager.mjs", ok: true, sha256: "b".repeat(64) }
      ]
    },
    workspaceTest: {
      tool: "workspace_test", ok: true, exitCode: 0, timedOut: false,
      image: "node:22-alpine", network: "none", workspaceMount: "candidate-only-read-only"
    }
  };
}

test("starts only from the fixed four-file source map", async () => {
  const manager = fakeManager();
  const result = await startEvolutionRun(manager, "Improve local resource lease reliability");
  assert.equal(result.id, runId);
  assert.equal(result.sourceCount, 4);
});

test("rejects source map expansion and redirected source paths", async () => {
  const expanded = fakeManager();
  expanded.sourceFiles["agent.mjs"] = "/workspace/agent.mjs";
  await assert.rejects(() => startEvolutionRun(expanded, "Improve local resource lease reliability"), /fixed two-module/);

  const redirected = fakeManager();
  redirected.sourceFiles["resource-manager.mjs"] = "/workspace/elsewhere/resource-manager.mjs";
  await assert.rejects(() => startEvolutionRun(redirected, "Improve local resource lease reliability"), /outside the fixed/);
});

test("rejects invalid goal lengths before creating a run", async () => {
  const manager = fakeManager();
  await assert.rejects(() => startEvolutionRun(manager, "short"), /8-2000/);
});

test("binds an open candidate run to its exact run ID", async () => {
  const manager = fakeManager();
  const adapter = await bindEvolutionRun(manager, runId);
  assert.equal(adapter.runId, runId);
  await assert.rejects(() => adapter.readCandidate({ runId: "EVOL-20261102143000-deadbeef", path: "resource-manager.mjs" }), /different run ID/);
});

test("refuses missing, corrupt or closed runs", async () => {
  const manager = fakeManager({ status: "eligible_for_human_review" });
  await assert.rejects(() => bindEvolutionRun(manager, runId), /not open/);
});

test("lists only sanitized summaries", async () => {
  const manager = fakeManager();
  const result = await listEvolutionRuns(manager);
  assert.equal(result.length, 1);
  assert.equal("journal" in result[0], false);
  assert.equal("sourceManifest" in result[0], false);
});

test("reads allowlisted source and baseline files with a 120-line maximum", async () => {
  const manager = fakeManager();
  const adapter = await bindEvolutionRun(manager, runId);
  const result = await adapter.readCandidate({ runId, path: "resource-manager.mjs" });
  assert.equal(result.sha256, await sha(source["resource-manager.mjs"]));
  await assert.rejects(() => adapter.readCandidate({ runId, path: "../secrets.json" }), /allowlist/);
  await assert.rejects(() => adapter.readCandidate({ runId, path: "resource-manager.mjs", startLine: 1, endLine: 121 }), /120 lines/);
});

test("creates only bounded candidate-specific test files and scans credential patterns", async () => {
  const manager = fakeManager();
  const adapter = await bindEvolutionRun(manager, runId);
  await adapter.writeCandidate({ runId, path: "candidate-resource.test.mjs", content: "test('candidate', () => {});" });
  await assert.rejects(() => adapter.writeCandidate({ runId, path: "resource-manager.test.mjs", content: "x" }), /candidate-/);
  await assert.rejects(() => adapter.writeCandidate({ runId, path: "candidate-secret.test.mjs", content: "const key = 'ghp_" + "A".repeat(35) + "';" }), /credential/);
});

test("patches implementation files only with exact SHA and anchor count", async () => {
  const manager = fakeManager();
  const adapter = await bindEvolutionRun(manager, runId);
  const current = await manager.readCandidate(runId, "resource-manager.mjs");
  const result = await adapter.applyPatch({
    runId, path: "resource-manager.mjs", expectedSha256: current.sha256,
    oldText: "export const a = 1;", newText: "export const a = 2;", expectedCount: 1
  });
  assert.equal(result.ok, true);
  await assert.rejects(() => adapter.applyPatch({
    runId, path: "resource-manager.mjs", expectedSha256: current.sha256,
    oldText: "export const a = 2;", newText: "export const a = 3;"
  }), /SHA-256 precondition/);
  await assert.rejects(() => adapter.applyPatch({
    runId, path: "resource-manager.test.mjs", expectedSha256: "a".repeat(64),
    oldText: "test baseline", newText: "weakened baseline"
  }), /implementation modules/);
});

test("accepts only successful host-produced syntax and candidate-only test evidence", async () => {
  const manager = fakeManager();
  const adapter = await bindEvolutionRun(manager, runId);
  const evidence = hostEvidence();
  await adapter.evaluateFromTrustedHost(evidence);
  assert.equal(manager.state.evaluated.length, 1);
  await assert.rejects(() => adapter.evaluateFromTrustedHost({
    ...evidence,
    workspaceTest: { ...evidence.workspaceTest, network: "bridge" }
  }), /host-produced/);
});

test("returns a human review packet but permanently denies runtime promotion", async () => {
  const manager = fakeManager();
  const adapter = await bindEvolutionRun(manager, runId);
  const packet = await adapter.reviewPacket({ runId });
  assert.equal(packet.runId, runId);
  await assert.rejects(() => adapter.promote(), /prohibited/);
  assert.equal(manager.state.promoted, false);
});

test("rejects invalid list limits", async () => {
  await assert.rejects(() => listEvolutionRuns(fakeManager(), { limit: 101 }), /between 1 and 100/);
});
