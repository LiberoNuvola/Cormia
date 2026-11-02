import test from "node:test";
import assert from "node:assert/strict";
import {
  CODING_READ_ONLY_OPERATIONS,
  createReadOnlyCodingWorkspaceAdapter
} from "./immortal-coding-workspace-readonly-adapter.mjs";

function fakeWorkspace({ approvals = [] } = {}) {
  const calls = [];
  const approvalSet = new Set(approvals);
  return {
    calls,
    isTool(name) {
      return ["workspace_list", "workspace_read", "workspace_diff", "workspace_verify",
        "workspace_write", "workspace_patch", "workspace_test"].includes(name);
    },
    requiresApproval(name) {
      return approvalSet.has(name) ||
        ["workspace_write", "workspace_patch", "workspace_test"].includes(name);
    },
    async callTool(name, args) {
      calls.push({ name, args });
      return { ok: true, name };
    }
  };
}

function create(workspace = fakeWorkspace()) {
  return {
    workspace,
    adapter: createReadOnlyCodingWorkspaceAdapter({
      codingWorkspace: workspace,
      readableFiles: ["src/agent.mjs", "README.md"],
      listableDirectories: [".", "src"]
    })
  };
}

test("exposes exactly the four non-mutating Coding Workspace operations", () => {
  assert.deepEqual(CODING_READ_ONLY_OPERATIONS, [
    "workspace_list", "workspace_read", "workspace_diff", "workspace_verify"
  ]);
  const { adapter } = create();
  assert.deepEqual(adapter.operations, CODING_READ_ONLY_OPERATIONS);
  assert.equal("write" in adapter, false);
  assert.equal("patch" in adapter, false);
  assert.equal("test" in adapter, false);
});

test("lists only directories explicitly allowlisted by trusted host code", async () => {
  const { adapter, workspace } = create();
  assert.deepEqual(await adapter.list({ path: "src" }), { ok: true, name: "workspace_list" });
  assert.equal(workspace.calls[0].args.path, "src");
  await assert.rejects(() => adapter.list({ path: "secrets" }), /allowlist/);
});

test("reads only exact host-allowlisted files", async () => {
  const { adapter, workspace } = create();
  await adapter.read({ path: "src/agent.mjs" });
  assert.deepEqual(workspace.calls[0], {
    name: "workspace_read",
    args: { path: "src/agent.mjs" }
  });
  await assert.rejects(() => adapter.read({ path: "src/config.json" }), /allowlist/);
});

test("diff is limited to exact host-allowlisted files", async () => {
  const { adapter, workspace } = create();
  await adapter.diff({ path: "README.md" });
  assert.equal(workspace.calls[0].name, "workspace_diff");
  await assert.rejects(() => adapter.diff({ path: "../outside.txt" }), /traversal/);
});

test("verify accepts only 1-100 unique allowlisted relative files", async () => {
  const { adapter, workspace } = create();
  await adapter.verify({ paths: ["src/agent.mjs", "README.md"] });
  assert.deepEqual(workspace.calls[0], {
    name: "workspace_verify",
    args: { paths: ["src/agent.mjs", "README.md"] }
  });
  await assert.rejects(() => adapter.verify({ paths: ["src/agent.mjs", "src/agent.mjs"] }), /Duplicate/);
  await assert.rejects(() => adapter.verify({ paths: ["src/config.json"] }), /allowlist/);
  await assert.rejects(() => adapter.verify({ paths: [] }), /1-100/);
  await assert.rejects(() => adapter.verify({ paths: Array.from({ length: 101 }, () => "README.md") }), /1-100/);
});

test("rejects absolute, drive, UNC and traversal paths", async () => {
  const { adapter } = create();
  for (const value of ["C:\\secret.txt", "\\\\server\\share", "/etc/passwd", "../secret", "src/../../secret"]) {
    await assert.rejects(() => adapter.read({ path: value }));
  }
});

test("rejects all unexpected argument keys", async () => {
  const { adapter } = create();
  await assert.rejects(() => adapter.read({ path: "README.md", shell: "whoami" }), /Unexpected argument/);
  await assert.rejects(() => adapter.list({ path: "src", extra: true }), /Unexpected argument/);
});

test("fails closed if a supposedly read-only operation is marked approval-required by host class", async () => {
  const workspace = fakeWorkspace({ approvals: ["workspace_read"] });
  const adapter = createReadOnlyCodingWorkspaceAdapter({
    codingWorkspace: workspace,
    readableFiles: ["README.md"],
    listableDirectories: ["."]
  });
  await assert.rejects(() => adapter.read({ path: "README.md" }), /requires host approval/);
  assert.equal(workspace.calls.length, 0);
});

test("does not expose or invoke write, patch or test operations", async () => {
  const { adapter, workspace } = create();
  for (const name of ["workspace_write", "workspace_patch", "workspace_test"]) {
    await assert.rejects(() => adapter[name]?.({ path: "README.md", content: "x" }) ?? Promise.reject(new Error("not exposed")));
  }
  assert.equal(workspace.calls.length, 0);
});

test("requires host policy arrays and a complete CodingWorkspace interface", () => {
  assert.throws(() => createReadOnlyCodingWorkspaceAdapter({ codingWorkspace: fakeWorkspace() }), /arrays/);
  assert.throws(() => createReadOnlyCodingWorkspaceAdapter({
    codingWorkspace: { callTool() {}, isTool() {} },
    readableFiles: [],
    listableDirectories: []
  }), /requiresApproval/);
});
