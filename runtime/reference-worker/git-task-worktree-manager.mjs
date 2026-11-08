/**
 * Host-owned task-isolated Git worktree manager.
 *
 * Worktrees are created detached at a host-selected base commit. The model
 * never supplies a repository path, base ref, worktree path or Git argument.
 * Each (projectRef, taskRef) maps deterministically to one private directory.
 *
 * This module uses fixed Git subcommands via execFile (never a shell). It
 * does not create branches, commit, push, merge, deploy or delete dirty work.
 */

import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, open, lstat, realpath, unlink } from "node:fs/promises";
import path from "node:path";

const execFile = promisify(execFileCallback);
const MAX_REF_LENGTH = 512;
const DEFAULT_TIMEOUT_MS = 20_000;

export class TaskWorktreeManagerError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "TaskWorktreeManagerError";
    this.code = code;
  }
}

function isText(value, max = MAX_REF_LENGTH) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value.length <= max &&
    (typeof value.isWellFormed !== "function" || value.isWellFormed());
}

function token(value) {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 32);
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative);
}

function normalizeGitPath(value, cwd) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(cwd, value);
}

async function assertRealDirectory(directoryPath, code) {
  let info;
  try {
    info = await lstat(directoryPath);
  } catch {
    throw new TaskWorktreeManagerError(code, "Expected host directory does not exist.");
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new TaskWorktreeManagerError(code, "Host directory must be a real directory, not a symlink or junction.");
  }
  const canonical = await realpath(directoryPath);
  return canonical;
}

function validateBaseRef(value) {
  if (!isText(value, 256) ||
      value.startsWith("-") ||
      value.includes("..") ||
      value.includes("@{") ||
      value.includes("\\") ||
      value.includes("\0") ||
      /[\s~^:?*\[]/.test(value)) {
    throw new TypeError("baseRef must be a fixed, host-selected Git branch/ref or commit identifier.");
  }
  return value;
}

export function createTaskWorktreeManager({
  repositoryPath,
  worktreeBasePath,
  projectRef,
  repositoryRef,
  baseRef,
  gitExecutable = "git",
  commandTimeoutMs = DEFAULT_TIMEOUT_MS,
  maxCommandOutputBytes = 1_048_576
} = {}) {
  if (typeof repositoryPath !== "string" || !path.isAbsolute(repositoryPath) ||
      typeof worktreeBasePath !== "string" || !path.isAbsolute(worktreeBasePath)) {
    throw new TypeError("repositoryPath and worktreeBasePath must be absolute host-configured paths.");
  }
  if (!isText(projectRef) || !isText(repositoryRef) ||
      !isText(gitExecutable, 2_048)) {
    throw new TypeError("projectRef, repositoryRef and gitExecutable must be host-configured values.");
  }
  const fixedBaseRef = validateBaseRef(baseRef);
  if (!Number.isSafeInteger(commandTimeoutMs) || commandTimeoutMs < 1_000 ||
      commandTimeoutMs > 120_000 ||
      !Number.isSafeInteger(maxCommandOutputBytes) || maxCommandOutputBytes < 16_384 ||
      maxCommandOutputBytes > 16 * 1024 * 1024) {
    throw new TypeError("Git command resource limits are invalid.");
  }

  const configuredRepositoryPath = path.resolve(repositoryPath);
  const configuredWorktreeBasePath = path.resolve(worktreeBasePath);
  let initialized = null;
  let initializationPromise = null;

  async function runGit(args, cwd) {
    try {
      const result = await execFile(gitExecutable, args, {
        cwd,
        encoding: "utf8",
        timeout: commandTimeoutMs,
        maxBuffer: maxCommandOutputBytes,
        windowsHide: true,
        shell: false
      });
      return typeof result.stdout === "string" ? result.stdout.trim() : "";
    } catch (error) {
      const code = error?.killed ? "GIT_COMMAND_TIMEOUT" :
        error?.code === "ENOENT" ? "GIT_EXECUTABLE_UNAVAILABLE" :
        "GIT_COMMAND_FAILED";
      throw new TaskWorktreeManagerError(code, "A fixed host Git operation failed.");
    }
  }

  async function initialize() {
    if (initialized) return initialized;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      const repositoryRealPath = await assertRealDirectory(
        configuredRepositoryPath,
        "TASK_WORKTREE_REPOSITORY_INVALID"
      );

      try {
        await mkdir(configuredWorktreeBasePath, { recursive: true, mode: 0o700 });
      } catch {
        throw new TaskWorktreeManagerError("TASK_WORKTREE_BASE_UNAVAILABLE");
      }
      const worktreeBaseRealPath = await assertRealDirectory(
        configuredWorktreeBasePath,
        "TASK_WORKTREE_BASE_INVALID"
      );

      if (repositoryRealPath === worktreeBaseRealPath ||
          isWithin(repositoryRealPath, worktreeBaseRealPath) ||
          isWithin(worktreeBaseRealPath, repositoryRealPath)) {
        throw new TaskWorktreeManagerError(
          "TASK_WORKTREE_BASE_OVERLAP",
          "Worktree base and source repository must be disjoint host directories."
        );
      }

      const top = await runGit(["rev-parse", "--show-toplevel"], repositoryRealPath);
      const canonicalTop = await realpath(normalizeGitPath(top, repositoryRealPath));
      if (canonicalTop !== repositoryRealPath) {
        throw new TaskWorktreeManagerError(
          "TASK_WORKTREE_REPOSITORY_ROOT_MISMATCH",
          "Configured repositoryPath must be the canonical Git worktree root."
        );
      }

      const commonDirValue = await runGit(["rev-parse", "--git-common-dir"], repositoryRealPath);
      const repositoryCommonDir = await realpath(
        normalizeGitPath(commonDirValue, repositoryRealPath)
      );

      const baseCommit = await runGit([
        "rev-parse", "--verify", "--end-of-options", fixedBaseRef + "^{commit}"
      ], repositoryRealPath);
      if (!/^[a-f0-9]{40,64}$/i.test(baseCommit)) {
        throw new TaskWorktreeManagerError("TASK_WORKTREE_BASE_COMMIT_INVALID");
      }

      const bare = await runGit(["rev-parse", "--is-bare-repository"], repositoryRealPath);
      if (bare !== "false") {
        throw new TaskWorktreeManagerError("TASK_WORKTREE_REPOSITORY_NOT_WORKTREE");
      }

      initialized = Object.freeze({
        repositoryRealPath,
        worktreeBaseRealPath,
        repositoryCommonDir,
        baseCommit: baseCommit.toLowerCase()
      });
      return initialized;
    })();

    try {
      return await initializationPromise;
    } finally {
      initializationPromise = null;
    }
  }

  function taskDirectory(paths, taskRef) {
    const projectToken = token(projectRef);
    const taskToken = token(projectRef + "\0" + taskRef);
    return path.join(paths.worktreeBaseRealPath, "project-" + projectToken, "task-" + taskToken);
  }

  async function inspectWorktree(worktreePath, paths, taskRef) {
    let exists = false;
    try {
      const stat = await lstat(worktreePath);
      exists = true;
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new TaskWorktreeManagerError(
          "TASK_WORKTREE_PATH_UNSAFE",
          "Existing task worktree path is not a real directory."
        );
      }
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
    if (!exists) return null;

    const canonical = await realpath(worktreePath);
    if (!isWithin(paths.worktreeBaseRealPath, canonical) ||
        canonical !== worktreePath) {
      throw new TaskWorktreeManagerError("TASK_WORKTREE_PATH_ESCAPE");
    }

    const top = await runGit(["rev-parse", "--show-toplevel"], canonical);
    const canonicalTop = await realpath(normalizeGitPath(top, canonical));
    if (canonicalTop !== canonical) {
      throw new TaskWorktreeManagerError("TASK_WORKTREE_PATH_COLLISION");
    }

    const commonValue = await runGit(["rev-parse", "--git-common-dir"], canonical);
    const commonDir = await realpath(normalizeGitPath(commonValue, canonical));
    if (commonDir !== paths.repositoryCommonDir) {
      throw new TaskWorktreeManagerError("TASK_WORKTREE_REPOSITORY_MISMATCH");
    }

    const head = (await runGit(["rev-parse", "--verify", "HEAD^{commit}"], canonical)).toLowerCase();
    if (head !== paths.baseCommit) {
      throw new TaskWorktreeManagerError(
        "TASK_WORKTREE_BASE_CHANGED",
        "Existing task worktree no longer points at its host-pinned base commit."
      );
    }

    return Object.freeze({
      projectRef,
      repositoryRef,
      taskRef,
      workspaceRef: "workspace:" + token(projectRef + "\0" + taskRef),
      rootPath: canonical,
      repositoryPath: paths.repositoryRealPath,
      baseCommit: paths.baseCommit,
      state: "ready"
    });
  }

  async function createTaskWorkspace({ taskRef } = {}) {
    if (!isText(taskRef, 256)) throw new TypeError("taskRef must be a host-verified reference.");
    const paths = await initialize();
    const directory = taskDirectory(paths, taskRef);
    const projectDirectory = path.dirname(directory);
    try {
      await mkdir(projectDirectory, { recursive: true, mode: 0o700 });
    } catch {
      throw new TaskWorktreeManagerError("TASK_WORKTREE_PROJECT_DIRECTORY_UNAVAILABLE");
    }
    const projectDirectoryReal = await assertRealDirectory(
      projectDirectory,
      "TASK_WORKTREE_PROJECT_DIRECTORY_UNSAFE"
    );
    if (projectDirectoryReal !== projectDirectory ||
        !isWithin(paths.worktreeBaseRealPath, projectDirectoryReal)) {
      throw new TaskWorktreeManagerError("TASK_WORKTREE_PROJECT_DIRECTORY_ESCAPE");
    }

    const existing = await inspectWorktree(directory, paths, taskRef);
    if (existing) return existing;

    try {
      await runGit([
        "worktree", "add", "--detach", directory, paths.baseCommit
      ], paths.repositoryRealPath);
    } catch (error) {
      // Two host requests may race to create the same task worktree. Reuse it
      // only if the exact deterministic path passes all repository checks.
      const afterRace = await inspectWorktree(directory, paths, taskRef).catch(() => null);
      if (afterRace) return afterRace;
      throw error;
    }

    const created = await inspectWorktree(directory, paths, taskRef);
    if (!created) throw new TaskWorktreeManagerError("TASK_WORKTREE_CREATE_NOT_FOUND");
    return created;
  }

  async function resolveTaskWorkspace({ taskRef } = {}) {
    if (!isText(taskRef, 256)) throw new TypeError("taskRef must be a host-verified reference.");
    const paths = await initialize();
    const directory = taskDirectory(paths, taskRef);
    const workspace = await inspectWorktree(directory, paths, taskRef);
    if (!workspace) {
      throw new TaskWorktreeManagerError(
        "TASK_WORKTREE_NOT_CREATED",
        "Task worktree must be created by the trusted host before operation dispatch."
      );
    }
    return workspace;
  }

  async function withTaskPathLock({ taskRef, relativePath, run } = {}) {
    if (!isText(taskRef, 256) || !isText(relativePath, 512) ||
        typeof run !== "function") {
      throw new TypeError("taskRef, relativePath and a trusted host callback are required.");
    }
    const paths = await initialize();
    const lockDirectory = path.join(
      paths.worktreeBaseRealPath,
      ".cormia-task-locks",
      "project-" + token(projectRef)
    );
    await mkdir(lockDirectory, { recursive: true, mode: 0o700 });
    const canonicalLockDirectory = await assertRealDirectory(
      lockDirectory,
      "TASK_WORKTREE_LOCK_DIRECTORY_UNSAFE"
    );
    if (canonicalLockDirectory !== lockDirectory ||
        !isWithin(paths.worktreeBaseRealPath, canonicalLockDirectory)) {
      throw new TaskWorktreeManagerError("TASK_WORKTREE_LOCK_DIRECTORY_ESCAPE");
    }

    const lockPath = path.join(
      canonicalLockDirectory,
      token(projectRef + "\0" + taskRef + "\0" + relativePath) + ".lock"
    );
    let handle;
    try {
      handle = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new TaskWorktreeManagerError(
          "TASK_WORKTREE_PATH_LOCKED",
          "Task path is already locked, or a stale lock requires host inspection."
        );
      }
      throw new TaskWorktreeManagerError("TASK_WORKTREE_LOCK_UNAVAILABLE");
    }

    const stat = await handle.stat();
    try {
      await handle.writeFile(JSON.stringify({
        projectRef,
        taskRef,
        relativePathToken: token(relativePath),
        acquiredAt: new Date().toISOString()
      }) + "\n", "utf8");
      await handle.sync();
      return await run(await resolveTaskWorkspace({ taskRef }));
    } finally {
      const current = await lstat(lockPath).catch(() => null);
      if (!current || current.isSymbolicLink() ||
          current.dev !== stat.dev || current.ino !== stat.ino) {
        await handle.close().catch(() => {});
        throw new TaskWorktreeManagerError(
          "TASK_WORKTREE_LOCK_OWNERSHIP_CHANGED",
          "Task path lock ownership changed; refusing to remove it."
        );
      }
      await handle.close();
      await unlink(lockPath);
    }
  }

  async function removeTaskWorkspace({ taskRef } = {}) {
    if (!isText(taskRef, 256)) throw new TypeError("taskRef must be a host-verified reference.");
    const paths = await initialize();
    const workspace = await resolveTaskWorkspace({ taskRef });
    const status = await runGit([
      "status", "--porcelain=v1", "--untracked-files=all"
    ], workspace.rootPath);
    if (status.length > 0) {
      throw new TaskWorktreeManagerError(
        "TASK_WORKTREE_DIRTY",
        "Task worktree contains uncommitted or untracked data and will not be removed."
      );
    }

    await runGit(["worktree", "remove", workspace.rootPath], paths.repositoryRealPath);
    await runGit(["worktree", "prune", "--expire", "now"], paths.repositoryRealPath);
    return Object.freeze({
      removed: true,
      projectRef,
      repositoryRef,
      taskRef,
      workspaceRef: workspace.workspaceRef
    });
  }

  return Object.freeze({
    projectRef,
    repositoryRef,
    baseRef: fixedBaseRef,
    initialize,
    createTaskWorkspace,
    resolveTaskWorkspace,
    withTaskPathLock,
    removeTaskWorkspace
  });
}
