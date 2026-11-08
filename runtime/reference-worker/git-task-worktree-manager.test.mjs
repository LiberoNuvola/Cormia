import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp, mkdir, rm, writeFile, symlink, lstat
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  createTaskWorktreeManager,
  TaskWorktreeManagerError
} from "./git-task-worktree-manager.mjs";

const execFile = promisify(execFileCallback);
const PROJECT_REF = "project:worktree-tests";
const REPOSITORY_REF = "example/isolated-repo";

async function git(args, cwd) {
  return execFile("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cormia-task-worktree-"));
  const repositoryPath = path.join(directory, "repository");
  const worktreeBasePath = path.join(directory, "worktrees");
  await mkdir(repositoryPath);
  await git(["init", "--initial-branch=main"], repositoryPath);
  await git(["config", "user.name", "Cormia Test"], repositoryPath);
  await git(["config", "user.email", "cormia-test@example.invalid"], repositoryPath);
  await mkdir(path.join(repositoryPath, "src"));
  await writeFile(path.join(repositoryPath, "src", "main.mjs"), "export const value = 1;\n", "utf8");
  await git(["add", "src/main.mjs"], repositoryPath);
  await git(["commit", "-m", "fixture baseline"], repositoryPath);
  const { stdout } = await git(["rev-parse", "HEAD"], repositoryPath);
  const baseCommit = stdout.trim();

  const manager = createTaskWorktreeManager({
    repositoryPath,
    worktreeBasePath,
    projectRef: PROJECT_REF,
    repositoryRef: REPOSITORY_REF,
    baseRef: "main",
    commandTimeoutMs: 10_000
  });

  return {
    directory,
    repositoryPath,
    worktreeBasePath,
    baseCommit,
    manager,
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    }
  };
}

test("creates deterministic detached worktrees separately for different tasks", async () => {
  const f = await fixture();
  try {
    const first = await f.manager.createTaskWorkspace({ taskRef: "task:one" });
    const second = await f.manager.createTaskWorkspace({ taskRef: "task:two" });
    const firstAgain = await f.manager.createTaskWorkspace({ taskRef: "task:one" });

    assert.notEqual(first.rootPath, f.repositoryPath);
    assert.notEqual(first.rootPath, second.rootPath);
    assert.equal(first.rootPath, firstAgain.rootPath);
    assert.equal(first.baseCommit, f.baseCommit);
    assert.equal(second.baseCommit, f.baseCommit);
    assert.equal(first.projectRef, PROJECT_REF);
    assert.equal(second.projectRef, PROJECT_REF);
    assert.match(first.workspaceRef, /^workspace:/);
    assert.equal(path.relative(f.worktreeBasePath, first.rootPath).startsWith(".."), false);

    const firstTop = (await git(["rev-parse", "--show-toplevel"], first.rootPath)).stdout.trim();
    const secondTop = (await git(["rev-parse", "--show-toplevel"], second.rootPath)).stdout.trim();
    assert.equal(path.resolve(firstTop), first.rootPath);
    assert.equal(path.resolve(secondTop), second.rootPath);
    const firstHead = (await git(["rev-parse", "HEAD"], first.rootPath)).stdout.trim();
    assert.equal(firstHead, f.baseCommit);
  } finally {
    await f.cleanup();
  }
});

test("host hashes task refs into paths; task text cannot influence filesystem layout", async () => {
  const f = await fixture();
  try {
    const workspace = await f.manager.createTaskWorkspace({
      taskRef: "../../outside/drive:C:/wallet"
    });
    assert.equal(path.relative(f.worktreeBasePath, workspace.rootPath).startsWith(".."), false);
    assert.equal(workspace.rootPath.includes("outside"), false);
    assert.equal(workspace.rootPath.includes("wallet"), false);
    assert.ok((await lstat(workspace.rootPath)).isDirectory());
  } finally {
    await f.cleanup();
  }
});

test("rejects a worktree base that overlaps the source repository", async () => {
  const f = await fixture();
  try {
    const invalid = createTaskWorktreeManager({
      repositoryPath: f.repositoryPath,
      worktreeBasePath: path.join(f.repositoryPath, "worktrees"),
      projectRef: PROJECT_REF,
      repositoryRef: REPOSITORY_REF,
      baseRef: "main"
    });
    await assert.rejects(
      invalid.initialize(),
      error => error.code === "TASK_WORKTREE_BASE_OVERLAP"
    );
  } finally {
    await f.cleanup();
  }
});

test("refuses to adopt an existing symlink at the deterministic task directory", async () => {
  const f = await fixture();
  const outside = path.join(f.directory, "outside");
  try {
    await f.manager.initialize();
    const projectToken = createHash("sha256").update(PROJECT_REF, "utf8").digest("hex").slice(0, 32);
    const taskToken = createHash("sha256").update(PROJECT_REF + "\0task:symlink", "utf8").digest("hex").slice(0, 32);
    const projectDirectory = path.join(f.worktreeBasePath, "project-" + projectToken);
    const taskDirectory = path.join(projectDirectory, "task-" + taskToken);
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(outside);
    try {
      await symlink(outside, taskDirectory, "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        return;
      }
      throw error;
    }

    await assert.rejects(
      f.manager.createTaskWorkspace({ taskRef: "task:symlink" }),
      error => error.code === "TASK_WORKTREE_PATH_UNSAFE"
    );
  } finally {
    await f.cleanup();
  }
});

test("never removes a dirty task worktree; removes only an empty clean worktree", async () => {
  const f = await fixture();
  try {
    const dirty = await f.manager.createTaskWorkspace({ taskRef: "task:dirty" });
    await writeFile(path.join(dirty.rootPath, "new-file.txt"), "uncommitted\n", "utf8");
    await assert.rejects(
      f.manager.removeTaskWorkspace({ taskRef: "task:dirty" }),
      error => error.code === "TASK_WORKTREE_DIRTY"
    );

    const clean = await f.manager.createTaskWorkspace({ taskRef: "task:clean" });
    const removed = await f.manager.removeTaskWorkspace({ taskRef: "task:clean" });
    assert.equal(removed.removed, true);
    await assert.rejects(
      f.manager.resolveTaskWorkspace({ taskRef: "task:clean" }),
      error => error.code === "TASK_WORKTREE_NOT_CREATED"
    );
    assert.ok((await lstat(dirty.rootPath)).isDirectory());
    assert.equal(clean.rootPath !== dirty.rootPath, true);
  } finally {
    await f.cleanup();
  }
});

test("path lock serializes operations across manager instances and leaves stale locks closed", async () => {
  const f = await fixture();
  try {
    await f.manager.createTaskWorkspace({ taskRef: "task:lock" });
    const otherManager = createTaskWorktreeManager({
      repositoryPath: f.repositoryPath,
      worktreeBasePath: f.worktreeBasePath,
      projectRef: PROJECT_REF,
      repositoryRef: REPOSITORY_REF,
      baseRef: "main"
    });
    let release;
    let notifyStarted;
    const started = new Promise(resolve => { notifyStarted = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const pending = f.manager.withTaskPathLock({
      taskRef: "task:lock",
      relativePath: "src/main.mjs",
      async run(workspace) {
        assert.equal(workspace.taskRef, "task:lock");
        notifyStarted();
        await gate;
        return "done";
      }
    });
    await started;
    await assert.rejects(
      otherManager.withTaskPathLock({
        taskRef: "task:lock",
        relativePath: "src/main.mjs",
        async run() { return "must-not-run"; }
      }),
      error => error.code === "TASK_WORKTREE_PATH_LOCKED"
    );
    release();
    assert.equal(await pending, "done");
    assert.equal(await otherManager.withTaskPathLock({
      taskRef: "task:lock",
      relativePath: "src/main.mjs",
      async run() { return "released"; }
    }), "released");
  } finally {
    await f.cleanup();
  }
});

test("unknown base ref and malformed references fail without arbitrary Git commands", async () => {
  const f = await fixture();
  try {
    assert.throws(() => createTaskWorktreeManager({
      repositoryPath: f.repositoryPath,
      worktreeBasePath: f.worktreeBasePath,
      projectRef: PROJECT_REF,
      repositoryRef: REPOSITORY_REF,
      baseRef: "-c core.sshCommand=evil"
    }), TypeError);

    const missing = createTaskWorktreeManager({
      repositoryPath: f.repositoryPath,
      worktreeBasePath: f.worktreeBasePath,
      projectRef: PROJECT_REF,
      repositoryRef: REPOSITORY_REF,
      baseRef: "refs/heads/does-not-exist"
    });
    await assert.rejects(
      missing.initialize(),
      error => error instanceof TaskWorktreeManagerError &&
        error.code === "GIT_COMMAND_FAILED"
    );
  } finally {
    await f.cleanup();
  }
});
