import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp, mkdir, rm, writeFile, readFile, symlink
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import { createTaskWorktreeManager } from "./git-task-worktree-manager.mjs";
import {
  createTaskWorktreeWorkspaceOperationAdapters,
  TaskWorkspaceOperationError
} from "./task-worktree-workspace-operation-adapters.mjs";

const execFile = promisify(execFileCallback);
const PROJECT_REF = "project:workspace-adapter-tests";
const TASK_REF = "task:adapter-one";
const OTHER_TASK_REF = "task:adapter-two";
const MANIFEST_DIGEST = "sha256:" + "a".repeat(64);

async function git(args, cwd) {
  return execFile("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
}

async function fixture({ maxFileBytes = 256 * 1024 } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cormia-task-workspace-adapter-"));
  const repositoryPath = path.join(directory, "repository");
  const worktreeBasePath = path.join(directory, "worktrees");
  await mkdir(repositoryPath);
  await git(["init", "--initial-branch=main"], repositoryPath);
  await git(["config", "core.autocrlf", "false"], repositoryPath);
  await git(["config", "user.name", "Cormia Test"], repositoryPath);
  await git(["config", "user.email", "cormia-test@example.invalid"], repositoryPath);
  await mkdir(path.join(repositoryPath, "src"));
  await writeFile(path.join(repositoryPath, "src", "main.mjs"), "export const version = 1;\n", "utf8");
  await git(["add", "src/main.mjs"], repositoryPath);
  await git(["commit", "-m", "fixture baseline"], repositoryPath);

  const manager = createTaskWorktreeManager({
    repositoryPath,
    worktreeBasePath,
    projectRef: PROJECT_REF,
    repositoryRef: "example/adapter-repo",
    baseRef: "main",
    commandTimeoutMs: 10_000
  });
  const workspace = await manager.createTaskWorkspace({ taskRef: TASK_REF });
  const otherWorkspace = await manager.createTaskWorkspace({ taskRef: OTHER_TASK_REF });
  const adapters = createTaskWorktreeWorkspaceOperationAdapters({
    worktreeManager: manager,
    maxFileBytes
  });

  return {
    directory,
    manager,
    workspace,
    otherWorkspace,
    adapters,
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    }
  };
}

function planContext(operation, relativePath, taskRef = TASK_REF) {
  return {
    phase: "PLAN",
    taskRef,
    operation,
    relativePath
  };
}

function executeContext(operation, input, overrides = {}) {
  return {
    taskRef: TASK_REF,
    manifestDigest: MANIFEST_DIGEST,
    operation,
    input,
    authorization: {
      allowed: true,
      reason: "authorized-by-synthetic-test-mandate",
      operation
    },
    ...overrides
  };
}

function digest(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

test("workspace.create writes only inside the selected task worktree and returns content digest", async () => {
  const f = await fixture();
  try {
    const input = f.adapters["workspace.create"].validateInput(
      { path: "src/new/module.mjs", content: "export const added = true;\n" },
      planContext("workspace.create", "src/new/module.mjs")
    );
    const result = await f.adapters["workspace.create"].execute(
      executeContext("workspace.create", input)
    );

    assert.equal(result.created, true);
    assert.equal(result.relativePath, "src/new/module.mjs");
    assert.equal(result.sha256, digest("export const added = true;\n"));
    assert.equal(
      await readFile(path.join(f.workspace.rootPath, "src", "new", "module.mjs"), "utf8"),
      "export const added = true;\n"
    );
    await assert.rejects(
      readFile(path.join(f.otherWorkspace.rootPath, "src", "new", "module.mjs"), "utf8"),
      error => error.code === "ENOENT"
    );
    assert.equal(result.manifestDigest, MANIFEST_DIGEST);
  } finally {
    await f.cleanup();
  }
});

test("workspace.create is create-only and never overwrites an existing file", async () => {
  const f = await fixture();
  try {
    const input = f.adapters["workspace.create"].validateInput(
      { path: "src/main.mjs", content: "export const version = 2;\n" },
      planContext("workspace.create", "src/main.mjs")
    );
    await assert.rejects(
      f.adapters["workspace.create"].execute(executeContext("workspace.create", input)),
      error => error.code === "TASK_WORKSPACE_FILE_EXISTS"
    );
    assert.equal(
      await readFile(path.join(f.workspace.rootPath, "src", "main.mjs"), "utf8"),
      "export const version = 1;\n"
    );
  } finally {
    await f.cleanup();
  }
});

test("workspace.replace requires the exact expected SHA and returns previous/new hashes", async () => {
  const f = await fixture();
  try {
    const original = "export const version = 1;\n";
    const updated = "export const version = 2;\n";
    const input = f.adapters["workspace.replace"].validateInput(
      {
        path: "src/main.mjs",
        expectedSha256: digest(original),
        content: updated
      },
      planContext("workspace.replace", "src/main.mjs")
    );
    const result = await f.adapters["workspace.replace"].execute(
      executeContext("workspace.replace", input)
    );
    assert.equal(result.replaced, true);
    assert.equal(result.previousSha256, digest(original));
    assert.equal(result.sha256, digest(updated));
    assert.equal(
      await readFile(path.join(f.workspace.rootPath, "src", "main.mjs"), "utf8"),
      updated
    );
    assert.equal(
      await readFile(path.join(f.otherWorkspace.rootPath, "src", "main.mjs"), "utf8"),
      original
    );
  } finally {
    await f.cleanup();
  }
});

test("workspace.replace refuses a stale SHA and preserves the current file bytes", async () => {
  const f = await fixture();
  try {
    const original = "export const version = 1;\n";
    const input = f.adapters["workspace.replace"].validateInput(
      {
        path: "src/main.mjs",
        expectedSha256: "0".repeat(64),
        content: "export const version = 9;\n"
      },
      planContext("workspace.replace", "src/main.mjs")
    );
    await assert.rejects(
      f.adapters["workspace.replace"].execute(executeContext("workspace.replace", input)),
      error => error.code === "TASK_WORKSPACE_EXPECTED_SHA_MISMATCH"
    );
    assert.equal(
      await readFile(path.join(f.workspace.rootPath, "src", "main.mjs"), "utf8"),
      original
    );
  } finally {
    await f.cleanup();
  }
});

test("PLAN binds exact authorized relativePath and rejects traversal or absolute paths", async () => {
  const f = await fixture();
  try {
    assert.throws(
      () => f.adapters["workspace.create"].validateInput(
        { path: "src/other.mjs", content: "x" },
        planContext("workspace.create", "src/main.mjs")
      ),
      error => error.code === "TASK_WORKSPACE_AUTHORIZED_PATH_MISMATCH"
    );
    for (const badPath of ["../outside.txt", "/etc/passwd", "C:\\Windows\\win.ini", "src//file.mjs"]) {
      assert.throws(
        () => f.adapters["workspace.create"].validateInput(
          { path: badPath, content: "x" },
          planContext("workspace.create", badPath)
        ),
        TaskWorkspaceOperationError
      );
    }
  } finally {
    await f.cleanup();
  }
});

test("execute refuses an unapproved or mismatched Broker authorization context", async () => {
  const f = await fixture();
  try {
    const input = f.adapters["workspace.create"].validateInput(
      { path: "src/denied.mjs", content: "x" },
      planContext("workspace.create", "src/denied.mjs")
    );
    await assert.rejects(
      f.adapters["workspace.create"].execute(executeContext(
        "workspace.create",
        input,
        { authorization: { allowed: false, operation: "workspace.create" } }
      )),
      error => error.code === "TASK_WORKSPACE_EXECUTE_CONTEXT_INVALID"
    );
    await assert.rejects(
      f.adapters["workspace.create"].execute(executeContext(
        "workspace.replace",
        input
      )),
      error => error.code === "TASK_WORKSPACE_EXECUTE_CONTEXT_INVALID"
    );
    await assert.rejects(
      readFile(path.join(f.workspace.rootPath, "src", "denied.mjs"), "utf8"),
      error => error.code === "ENOENT"
    );
  } finally {
    await f.cleanup();
  }
});

test("workspace.create and workspace.replace reject symlinked parent and target paths", async () => {
  const f = await fixture();
  const outsideDirectory = path.join(f.directory, "outside");
  try {
    await mkdir(outsideDirectory);
    const linkPath = path.join(f.workspace.rootPath, "escape");
    try {
      await symlink(outsideDirectory, linkPath, "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) return;
      throw error;
    }

    const createInput = f.adapters["workspace.create"].validateInput(
      { path: "escape/pwned.txt", content: "outside" },
      planContext("workspace.create", "escape/pwned.txt")
    );
    await assert.rejects(
      f.adapters["workspace.create"].execute(executeContext("workspace.create", createInput)),
      error => error.code === "TASK_WORKSPACE_PARENT_NOT_REAL_DIRECTORY"
    );
    await assert.rejects(
      readFile(path.join(outsideDirectory, "pwned.txt"), "utf8"),
      error => error.code === "ENOENT"
    );

    const outsideTarget = path.join(outsideDirectory, "target.txt");
    await writeFile(outsideTarget, "outside-content", "utf8");
    const targetLink = path.join(f.workspace.rootPath, "src", "linked.txt");
    await symlink(outsideTarget, targetLink);
    const replaceInput = f.adapters["workspace.replace"].validateInput(
      {
        path: "src/linked.txt",
        expectedSha256: digest("outside-content"),
        content: "would-be-outside"
      },
      planContext("workspace.replace", "src/linked.txt")
    );
    await assert.rejects(
      f.adapters["workspace.replace"].execute(executeContext("workspace.replace", replaceInput)),
      error => ["TASK_WORKSPACE_TARGET_NOT_REGULAR_FILE", "TASK_WORKSPACE_SYMLINK_DENIED"].includes(error.code)
    );
    assert.equal(await readFile(outsideTarget, "utf8"), "outside-content");
  } finally {
    await f.cleanup();
  }
});

test("workspace adapters reject file content above host size limit", async () => {
  const f = await fixture({ maxFileBytes: 32 });
  try {
    assert.throws(
      () => f.adapters["workspace.create"].validateInput(
        { path: "src/too-large.txt", content: "x".repeat(33) },
        planContext("workspace.create", "src/too-large.txt")
      ),
      error => error.code === "TASK_WORKSPACE_CONTENT_TOO_LARGE"
    );
  } finally {
    await f.cleanup();
  }
});

test("unknown task cannot access another task worktree", async () => {
  const f = await fixture();
  try {
    const input = f.adapters["workspace.create"].validateInput(
      { path: "src/isolation.txt", content: "task one" },
      planContext("workspace.create", "src/isolation.txt")
    );
    await assert.rejects(
      f.adapters["workspace.create"].execute(executeContext(
        "workspace.create",
        input,
        { taskRef: "task:not-registered" }
      )),
      error => error.code === "TASK_WORKTREE_NOT_CREATED"
    );
    await assert.rejects(
      readFile(path.join(f.workspace.rootPath, "src", "isolation.txt"), "utf8"),
      error => error.code === "ENOENT"
    );
    await assert.rejects(
      readFile(path.join(f.otherWorkspace.rootPath, "src", "isolation.txt"), "utf8"),
      error => error.code === "ENOENT"
    );
  } finally {
    await f.cleanup();
  }
});
