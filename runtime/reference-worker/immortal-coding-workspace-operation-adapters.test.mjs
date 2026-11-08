import test from "node:test";
import assert from "node:assert/strict";

import {
  createReadOnlyCodingWorkspaceAdapter,
  CODING_READ_ONLY_OPERATIONS
} from "./immortal-coding-workspace-readonly-adapter.mjs";
import {
  createReadOnlyCodingWorkspaceOperationAdapters
} from "./immortal-coding-workspace-operation-adapters.mjs";

function fixture() {
  const calls = [];
  const workspace = {
    isTool(operation) {
      return CODING_READ_ONLY_OPERATIONS.includes(operation);
    },
    requiresApproval(operation) {
      return false;
    },
    async callTool(operation, args) {
      calls.push({ operation, args });
      return { operation, args, ok: true };
    }
  };
  const readOnlyWorkspace = createReadOnlyCodingWorkspaceAdapter({
    codingWorkspace: workspace,
    readableFiles: ["src/main.mjs", "src/other.mjs"],
    listableDirectories: [".", "src"]
  });
  return {
    calls,
    adapters: createReadOnlyCodingWorkspaceOperationAdapters({ readOnlyWorkspace })
  };
}

test("fixed protocol adapter exposes only list/read/diff/verify mappings", () => {
  const { adapters } = fixture();
  assert.deepEqual(Object.keys(adapters).sort(), [
    "workspace.diff",
    "workspace.list",
    "workspace.read",
    "workspace.verify"
  ]);
});

test("workspace.list binds relativePath to the exact host-allowlisted directory", async () => {
  const { adapters, calls } = fixture();
  const adapter = adapters["workspace.list"];
  const input = adapter.validateInput(
    { path: "src" },
    { phase: "PLAN", taskRef: "task:test", operation: "workspace.list", relativePath: "src" }
  );
  assert.deepEqual(input, { path: "src" });
  const result = await adapter.execute({ operation: "workspace.list", input });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{ operation: "workspace_list", args: { path: "src" } }]);
});

test("workspace.read rejects a mismatch between authorized relativePath and input.path", () => {
  const { adapters } = fixture();
  assert.throws(() => adapters["workspace.read"].validateInput(
    { path: "src/other.mjs" },
    { phase: "PLAN", taskRef: "task:test", operation: "workspace.read", relativePath: "src/main.mjs" }
  ), /relativePath must exactly match/);
});

test("workspace.read rejects any path outside the trusted host allowlist", () => {
  const { adapters } = fixture();
  assert.throws(() => adapters["workspace.read"].validateInput(
    { path: "src/private.mjs" },
    { phase: "PLAN", taskRef: "task:test", operation: "workspace.read", relativePath: "src/private.mjs" }
  ), /allowlist/);
});

test("workspace.verify permits one exact file per capability step", async () => {
  const { adapters, calls } = fixture();
  const input = adapters["workspace.verify"].validateInput(
    { paths: ["src/main.mjs"] },
    { phase: "PLAN", taskRef: "task:test", operation: "workspace.verify", relativePath: "src/main.mjs" }
  );
  const result = await adapters["workspace.verify"].execute({
    operation: "workspace.verify",
    input
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{
    operation: "workspace_verify",
    args: { paths: ["src/main.mjs"] }
  }]);
});

test("workspace.verify refuses multiple paths so each file is authorized independently", () => {
  const { adapters } = fixture();
  assert.throws(() => adapters["workspace.verify"].validateInput(
    { paths: ["src/main.mjs", "src/other.mjs"] },
    { phase: "PLAN", taskRef: "task:test", operation: "workspace.verify", relativePath: "src/main.mjs" }
  ), /exactly one scoped path/);
});

test("no write, patch, test, shell or Git operation can be inferred from this adapter", () => {
  const { adapters } = fixture();
  assert.equal(Object.hasOwn(adapters, "workspace.create"), false);
  assert.equal(Object.hasOwn(adapters, "workspace.replace"), false);
  assert.equal(Object.hasOwn(adapters, "workspace.test"), false);
  assert.equal(Object.hasOwn(adapters, "shell.exec"), false);
  assert.equal(Object.hasOwn(adapters, "git.commit.local"), false);
});
