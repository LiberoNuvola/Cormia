/**
 * Task-worktree-scoped create/replace adapters for the proposed AEP workspace
 * capability IDs. These adapters do not perform their own authorization:
 * they are safe only when registered behind a trusted Project Runtime
 * Capability Broker and an active project mandate/task child authority.
 *
 * No legacy CodingWorkspace.callTool() method is invoked. In particular, this
 * does not bypass the old Agent /code + APPROVO path.
 */

import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  unlink
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024;

export class TaskWorkspaceOperationError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "TaskWorkspaceOperationError";
    this.code = code;
  }
}

function isText(value, max = 512) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    value.length <= max &&
    (typeof value.isWellFormed !== "function" || value.isWellFormed());
}

function exactDataObject(value, required, optional = []) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== "string" || !allowed.has(key))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some(key => {
    const descriptor = descriptors[key];
    return !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value");
  })) return false;
  return required.every(key => Object.hasOwn(value, key));
}

function normalizeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 ||
      (typeof value.isWellFormed === "function" && !value.isWellFormed()) ||
      value.includes("\0")) {
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PATH_INVALID");
  }
  const portable = value.replace(/\\/g, "/");
  if (portable.startsWith("/") || portable.startsWith("//") ||
      /^[A-Za-z]:/.test(portable)) {
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_ABSOLUTE_PATH_DENIED");
  }
  const segments = portable.split("/");
  if (segments.some(segment =>
    segment === "" || segment === "." || segment === ".." ||
    /[<>:"|?*\x00-\x1f]/.test(segment) ||
    segment.endsWith(".") || segment.endsWith(" ")
  )) {
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PATH_NON_CANONICAL");
  }
  return segments.join("/");
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative);
}

async function assertRealDirectory(directoryPath, rootPath, code) {
  let stat;
  try {
    stat = await lstat(directoryPath);
  } catch {
    throw new TaskWorkspaceOperationError(code);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new TaskWorkspaceOperationError(code);
  }
  const canonical = await realpath(directoryPath);
  if (!isWithin(rootPath, canonical) && canonical !== rootPath) {
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PATH_ESCAPE");
  }
  return canonical;
}

async function resolveParentDirectory(rootPath, segments, { createParents }) {
  let current = rootPath;
  for (const segment of segments) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = await lstat(current);
    } catch (error) {
      if (error?.code !== "ENOENT" || !createParents) {
        throw new TaskWorkspaceOperationError(
          error?.code === "ENOENT" ? "TASK_WORKSPACE_PARENT_MISSING" : "TASK_WORKSPACE_PARENT_UNAVAILABLE"
        );
      }
      try {
        await mkdir(current, { mode: 0o700 });
      } catch (mkdirError) {
        if (mkdirError?.code !== "EEXIST") {
          throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PARENT_CREATE_FAILED");
        }
      }
      try {
        stat = await lstat(current);
      } catch {
        throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PARENT_UNAVAILABLE");
      }
    }

    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PARENT_NOT_REAL_DIRECTORY");
    }
    const canonical = await realpath(current);
    if (!isWithin(rootPath, canonical)) {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PATH_ESCAPE");
    }
    current = canonical;
  }
  return current;
}

async function inspectTarget(targetPath, rootPath) {
  let stat;
  try {
    stat = await lstat(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_TARGET_UNAVAILABLE");
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_TARGET_NOT_REGULAR_FILE");
  }
  const canonical = await realpath(targetPath);
  if (!isWithin(rootPath, canonical)) {
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PATH_ESCAPE");
  }
  return stat;
}

async function readCurrentFile(targetPath, rootPath) {
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
  let handle;
  try {
    handle = await open(targetPath, flags);
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_TARGET_NOT_REGULAR_FILE");
    }
    const current = await handle.readFile();
    const canonical = await realpath(targetPath);
    if (!isWithin(rootPath, canonical)) {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PATH_ESCAPE");
    }
    return current;
  } catch (error) {
    if (error instanceof TaskWorkspaceOperationError) throw error;
    if (error?.code === "ELOOP") {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_SYMLINK_DENIED");
    }
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_READ_FAILED");
  } finally {
    await handle?.close().catch(() => {});
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function validateContent(content, maxFileBytes) {
  if (typeof content !== "string" ||
      (typeof content.isWellFormed === "function" && !content.isWellFormed()) ||
      content.includes("\0")) {
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_CONTENT_INVALID");
  }
  const buffer = Buffer.from(content, "utf8");
  if (buffer.byteLength > maxFileBytes) {
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_CONTENT_TOO_LARGE");
  }
  return buffer;
}

async function writeNewFile(targetPath, contentBuffer) {
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
    (constants.O_NOFOLLOW ?? 0);
  let handle;
  try {
    handle = await open(targetPath, flags, 0o600);
    await handle.writeFile(contentBuffer);
    await handle.sync();
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(targetPath).catch(() => {});
    if (error?.code === "EEXIST") {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_FILE_EXISTS");
    }
    if (error?.code === "ELOOP") {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_SYMLINK_DENIED");
    }
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_CREATE_FAILED");
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function atomicReplaceFile(targetPath, contentBuffer, rootPath, expectedSha256) {
  const before = await readCurrentFile(targetPath, rootPath);
  const previousSha256 = sha256(before);
  if (previousSha256 !== expectedSha256) {
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_EXPECTED_SHA_MISMATCH");
  }

  const temporaryPath = path.join(
    path.dirname(targetPath),
    ".cormia-tmp-" + randomUUID()
  );
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
    (constants.O_NOFOLLOW ?? 0);
  let handle;
  try {
    handle = await open(temporaryPath, flags, 0o600);
    await handle.writeFile(contentBuffer);
    await handle.sync();
    await handle.close();
    handle = null;

    // Re-read the original after staging the replacement so a concurrent
    // edit cannot be silently overwritten by a stale expected SHA.
    const latest = await readCurrentFile(targetPath, rootPath);
    if (sha256(latest) !== expectedSha256) {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_EXPECTED_SHA_MISMATCH");
    }
    await inspectTarget(targetPath, rootPath);
    await rename(temporaryPath, targetPath);
    const finalPath = await realpath(targetPath);
    if (!isWithin(rootPath, finalPath)) {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PATH_ESCAPE");
    }
  } catch (error) {
    if (error instanceof TaskWorkspaceOperationError) throw error;
    if (error?.code === "ELOOP") {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_SYMLINK_DENIED");
    }
    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_REPLACE_FAILED");
  } finally {
    await handle?.close().catch(() => {});
    await unlink(temporaryPath).catch(() => {});
  }

  return previousSha256;
}

export function createTaskWorktreeWorkspaceOperationAdapters({
  worktreeManager,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  idFactory = randomUUID
} = {}) {
  if (!worktreeManager ||
      !isText(worktreeManager.projectRef, 512) ||
      typeof worktreeManager.resolveTaskWorkspace !== "function" ||
      typeof worktreeManager.withTaskPathLock !== "function") {
    throw new TypeError("A host-owned Task Worktree Manager with path locks is required.");
  }
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1 ||
      maxFileBytes > DEFAULT_MAX_FILE_BYTES ||
      typeof idFactory !== "function") {
    throw new TypeError("Workspace operation limits and ID factory are invalid.");
  }

  function validate(operation, input, context) {
    if (!isText(context?.taskRef, 256) ||
        context?.phase !== "PLAN" ||
        context?.operation !== operation ||
        !isText(context?.relativePath, 512) ||
        !exactDataObject(input, ["path", "content"], []) &&
        operation === "workspace.create") {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PLAN_INPUT_INVALID");
    }

    const relativePath = normalizeRelativePath(input.path);
    const authorizedPath = normalizeRelativePath(context.relativePath);
    if (relativePath !== authorizedPath) {
      throw new TaskWorkspaceOperationError("TASK_WORKSPACE_AUTHORIZED_PATH_MISMATCH");
    }

    if (operation === "workspace.create") {
      const content = validateContent(input.content, maxFileBytes);
      return Object.freeze({
        path: relativePath,
        content: content.toString("utf8")
      });
    }

    if (operation === "workspace.replace") {
      if (!exactDataObject(input, ["path", "expectedSha256", "content"]) ||
          typeof input.expectedSha256 !== "string" ||
          !DIGEST_PATTERN.test(input.expectedSha256)) {
        throw new TaskWorkspaceOperationError("TASK_WORKSPACE_REPLACE_INPUT_INVALID");
      }
      const content = validateContent(input.content, maxFileBytes);
      return Object.freeze({
        path: relativePath,
        expectedSha256: input.expectedSha256,
        content: content.toString("utf8")
      });
    }

    throw new TaskWorkspaceOperationError("TASK_WORKSPACE_OPERATION_UNSUPPORTED");
  }

  function makeAdapter(operation) {
    return Object.freeze({
      validateInput(input, context) {
        return validate(operation, input, context);
      },

      async execute(context) {
        if (!exactDataObject(context, [
          "taskRef", "manifestDigest", "operation", "input", "authorization"
        ], [
          "planRef", "planDigest", "stepRef", "resourceLease", "assertResourceActive"
        ]) ||
            context.operation !== operation ||
            context.authorization?.allowed !== true ||
            context.authorization?.operation !== operation ||
            !DIGEST_PATTERN.test(context.manifestDigest)) {
          throw new TaskWorkspaceOperationError("TASK_WORKSPACE_EXECUTE_CONTEXT_INVALID");
        }

        const workspace = await worktreeManager.resolveTaskWorkspace({
          taskRef: context.taskRef
        });
        if (workspace.projectRef !== worktreeManager.projectRef ||
            workspace.taskRef !== context.taskRef ||
            workspace.state !== "ready") {
          throw new TaskWorkspaceOperationError("TASK_WORKSPACE_RUNTIME_BINDING_MISMATCH");
        }

        const relativePath = normalizeRelativePath(context.input.path);
        const segments = relativePath.split("/");
        const parentPath = await resolveParentDirectory(
          workspace.rootPath,
          segments.slice(0, -1),
          { createParents: operation === "workspace.create" }
        );
        const targetPath = path.join(parentPath, segments.at(-1));
        if (!isWithin(workspace.rootPath, targetPath)) {
          throw new TaskWorkspaceOperationError("TASK_WORKSPACE_PATH_ESCAPE");
        }

        const contentBuffer = validateContent(context.input.content, maxFileBytes);
        return worktreeManager.withTaskPathLock({
          taskRef: context.taskRef,
          relativePath,
          run: async lockedWorkspace => {
            if (lockedWorkspace.rootPath !== workspace.rootPath) {
              throw new TaskWorkspaceOperationError("TASK_WORKSPACE_ROOT_CHANGED");
            }
            if (operation === "workspace.create") {
              const existing = await inspectTarget(targetPath, workspace.rootPath);
              if (existing) {
                throw new TaskWorkspaceOperationError("TASK_WORKSPACE_FILE_EXISTS");
              }
              await writeNewFile(targetPath, contentBuffer);
              return Object.freeze({
                operation,
                taskRef: context.taskRef,
                manifestDigest: context.manifestDigest,
                relativePath,
                byteLength: contentBuffer.byteLength,
                sha256: sha256(contentBuffer),
                created: true
              });
            }

            const expectedSha256 = context.input.expectedSha256;
            if (!DIGEST_PATTERN.test(expectedSha256)) {
              throw new TaskWorkspaceOperationError("TASK_WORKSPACE_REPLACE_INPUT_INVALID");
            }
            const previousSha256 = await atomicReplaceFile(
              targetPath,
              contentBuffer,
              workspace.rootPath,
              expectedSha256
            );
            return Object.freeze({
              operation,
              taskRef: context.taskRef,
              manifestDigest: context.manifestDigest,
              relativePath,
              previousSha256,
              byteLength: contentBuffer.byteLength,
              sha256: sha256(contentBuffer),
              replaced: true
            });
          }
        });
      }
    });
  }

  return Object.freeze({
    "workspace.create": makeAdapter("workspace.create"),
    "workspace.replace": makeAdapter("workspace.replace")
  });
}
