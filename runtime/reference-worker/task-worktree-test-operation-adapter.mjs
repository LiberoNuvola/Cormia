/**
 * Host-pinned, task-worktree-scoped Node test execution.
 *
 * The model may request only a host-registered executionProfileId. It cannot
 * provide a command, image, argument list, environment variable, mount or path.
 * The Docker runner uses a digest-pinned image, no network, read-only container
 * root, dropped capabilities, bounded resources and one task-worktree mount.
 *
 * This adapter must be registered behind the Project Runtime Capability Broker.
 * workspace.test always requires a live task-bound Resource Lease.
 */

import { execFile as execFileCallback, spawn } from "node:child_process";
import { promisify } from "node:util";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const execFile = promisify(execFileCallback);
const IMAGE_DIGEST = /^[A-Za-z0-9._/-]+@sha256:[a-f0-9]{64}$/;
const MAX_OUTPUT_BYTES = 1_048_576;

export class TaskWorktreeTestError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "TaskWorktreeTestError";
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
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
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
  if (!isText(value, 512) || value.includes("\0") || value.includes("\\")) {
    throw new TaskWorktreeTestError("TEST_PROFILE_PATH_INVALID");
  }
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) {
    throw new TaskWorktreeTestError("TEST_PROFILE_ABSOLUTE_PATH_DENIED");
  }
  const segments = value.split("/");
  if (segments.some(segment =>
    segment === "" || segment === "." || segment === ".." ||
    /[<>:"|?*\x00-\x1f]/.test(segment) ||
    segment.endsWith(".") || segment.endsWith(" ")
  )) {
    throw new TaskWorktreeTestError("TEST_PROFILE_PATH_NON_CANONICAL");
  }
  return segments.join("/");
}

function validateProfile(profile) {
  if (!exactDataObject(profile, [
    "executionProfileId", "runner", "imageDigest", "testFiles",
    "maxRuntimeMs", "memoryMiB", "cpus", "pidsLimit",
    "tmpfsMiB", "maxOutputBytes"
  ]) ||
      !isText(profile.executionProfileId, 128) ||
      profile.runner !== "node-test" ||
      typeof profile.imageDigest !== "string" ||
      !IMAGE_DIGEST.test(profile.imageDigest) ||
      !Array.isArray(profile.testFiles) ||
      profile.testFiles.length < 1 ||
      profile.testFiles.length > 128 ||
      !Number.isSafeInteger(profile.maxRuntimeMs) ||
      profile.maxRuntimeMs < 1_000 || profile.maxRuntimeMs > 600_000 ||
      !Number.isSafeInteger(profile.memoryMiB) ||
      profile.memoryMiB < 256 || profile.memoryMiB > 8_192 ||
      typeof profile.cpus !== "number" ||
      !Number.isFinite(profile.cpus) || profile.cpus < 0.25 || profile.cpus > 8 ||
      !Number.isSafeInteger(profile.pidsLimit) ||
      profile.pidsLimit < 32 || profile.pidsLimit > 512 ||
      !Number.isSafeInteger(profile.tmpfsMiB) ||
      profile.tmpfsMiB < 16 || profile.tmpfsMiB > 1_024 ||
      !Number.isSafeInteger(profile.maxOutputBytes) ||
      profile.maxOutputBytes < 4_096 || profile.maxOutputBytes > MAX_OUTPUT_BYTES) {
    throw new TypeError("Host test execution profile is invalid.");
  }
  const files = profile.testFiles.map(normalizeRelativePath);
  if (new Set(files).size !== files.length) {
    throw new TypeError("Host test profile contains duplicate paths.");
  }
  return Object.freeze({
    ...profile,
    testFiles: Object.freeze(files)
  });
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative);
}

async function verifyTestFiles(workspace, files) {
  if (!workspace || !isText(workspace.rootPath, 4_096) || !path.isAbsolute(workspace.rootPath)) {
    throw new TaskWorktreeTestError("TEST_WORKSPACE_INVALID");
  }
  const root = await realpath(workspace.rootPath);
  for (const relativePath of files) {
    const segments = relativePath.split("/");
    let current = root;
    for (let index = 0; index < segments.length; index += 1) {
      current = path.join(current, segments[index]);
      let stat;
      try {
        stat = await lstat(current);
      } catch {
        throw new TaskWorktreeTestError("TEST_PROFILE_FILE_MISSING");
      }
      if (stat.isSymbolicLink()) {
        throw new TaskWorktreeTestError("TEST_PROFILE_SYMLINK_DENIED");
      }
      if (index < segments.length - 1 && !stat.isDirectory()) {
        throw new TaskWorktreeTestError("TEST_PROFILE_PARENT_NOT_DIRECTORY");
      }
      if (index === segments.length - 1 && !stat.isFile()) {
        throw new TaskWorktreeTestError("TEST_PROFILE_TARGET_NOT_REGULAR_FILE");
      }
    }
    const canonical = await realpath(current);
    if (!isWithin(root, canonical)) {
      throw new TaskWorktreeTestError("TEST_PROFILE_PATH_ESCAPE");
    }
  }
  return root;
}

function boundedAppend(current, chunk, maximum) {
  const next = current + chunk.toString("utf8");
  if (Buffer.byteLength(next, "utf8") > maximum) {
    throw new TaskWorktreeTestError("TEST_OUTPUT_LIMIT_EXCEEDED");
  }
  return next;
}

/**
 * Executes one immutable host profile through Docker. The only command sent
 * inside the container is Node's built-in test runner with host-pinned files.
 */
export function createDockerTaskWorktreeTestRunner({
  dockerExecutable = "docker",
  stopGraceMs = 2_000
} = {}) {
  if (!isText(dockerExecutable, 2_048) ||
      !Number.isSafeInteger(stopGraceMs) || stopGraceMs < 100 || stopGraceMs > 10_000) {
    throw new TypeError("Docker runner host configuration is invalid.");
  }

  async function run({ profile, workspace, assertResourceActive } = {}) {
    const validated = validateProfile(profile);
    if (typeof assertResourceActive !== "function") {
      throw new TaskWorktreeTestError("TEST_RESOURCE_LEASE_REQUIRED");
    }
    assertResourceActive();
    const root = await verifyTestFiles(workspace, validated.testFiles);
    let dockerHost;
    try {
      const contextResult = await execFile(dockerExecutable, [
        "context", "inspect", "default", "--format", "{{json .Endpoints.docker.Host}}"
      ], {
        encoding: "utf8",
        timeout: 5_000,
        maxBuffer: 16_384,
        windowsHide: true,
        shell: false
      });
      dockerHost = JSON.parse(contextResult.stdout.trim());
    } catch {
      throw new TaskWorktreeTestError("DOCKER_LOCAL_CONTEXT_UNAVAILABLE");
    }
    const localEndpoint = process.platform === "win32"
      ? typeof dockerHost === "string" && dockerHost.startsWith("npipe://")
      : typeof dockerHost === "string" && dockerHost.startsWith("unix://");
    if (!localEndpoint) {
      throw new TaskWorktreeTestError("DOCKER_CONTEXT_NOT_LOCAL");
    }
    try {
      await execFile(dockerExecutable, [
        "--context", "default", "image", "inspect", validated.imageDigest
      ], {
        encoding: "utf8",
        timeout: 5_000,
        maxBuffer: 65_536,
        windowsHide: true,
        shell: false
      });
    } catch {
      throw new TaskWorktreeTestError("TEST_IMAGE_NOT_PRELOADED");
    }
    if (root.includes(",")) {
      throw new TaskWorktreeTestError("DOCKER_MOUNT_PATH_UNSUPPORTED");
    }

    const args = [
      "--context", "default",
      "run", "--pull=never", "--rm",
      "--network", "none",
      "--read-only",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--pids-limit", String(validated.pidsLimit),
      "--memory", validated.memoryMiB + "m",
      "--memory-swap", validated.memoryMiB + "m",
      "--cpus", String(validated.cpus),
      "--user", "1000:1000",
      "--tmpfs", "/tmp:rw,nosuid,nodev,size=" + validated.tmpfsMiB + "m",
      "--mount", "type=bind,source=" + root + ",target=/workspace",
      "--workdir", "/workspace",
      validated.imageDigest,
      "node", "--test",
      ...validated.testFiles
    ];

    return new Promise((resolve, reject) => {
      const startedAt = performance.now();
      let child;
      let stdout = "";
      let stderr = "";
      let terminalReason = null;
      let closed = false;
      let timeoutHandle;
      let leaseHandle;
      let killHandle;

      const terminate = reason => {
        if (closed || terminalReason) return;
        terminalReason = reason;
        try { child?.kill("SIGTERM"); } catch {}
        killHandle = setTimeout(() => {
          if (!closed) {
            try { child?.kill("SIGKILL"); } catch {}
          }
        }, stopGraceMs);
      };

      try {
        child = spawn(dockerExecutable, args, {
          cwd: root,
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch {
        reject(new TaskWorktreeTestError("DOCKER_RUNNER_START_FAILED"));
        return;
      }

      child.stdout.on("data", chunk => {
        try {
          stdout = boundedAppend(stdout, chunk, validated.maxOutputBytes);
        } catch (error) {
          terminate(error.code);
        }
      });
      child.stderr.on("data", chunk => {
        try {
          stderr = boundedAppend(stderr, chunk, validated.maxOutputBytes);
        } catch (error) {
          terminate(error.code);
        }
      });
      child.on("error", () => terminate("DOCKER_RUNNER_START_FAILED"));

      timeoutHandle = setTimeout(() => terminate("TEST_RUNTIME_LIMIT_EXCEEDED"), validated.maxRuntimeMs);
      leaseHandle = setInterval(() => {
        try {
          assertResourceActive();
        } catch {
          terminate("TEST_RESOURCE_LEASE_LOST");
        }
      }, 200);

      child.on("close", (exitCode, signal) => {
        closed = true;
        clearTimeout(timeoutHandle);
        clearInterval(leaseHandle);
        clearTimeout(killHandle);
        const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
        if (terminalReason) {
          reject(new TaskWorktreeTestError(terminalReason));
          return;
        }
        resolve(Object.freeze({
          runner: "docker-node-test",
          imageDigest: validated.imageDigest,
          testFiles: validated.testFiles,
          passed: exitCode === 0,
          exitCode: Number.isInteger(exitCode) ? exitCode : null,
          signal: signal ?? null,
          durationMs,
          stdout,
          stderr
        }));
      });
    });
  }

  return Object.freeze({ run });
}

export function createTaskWorktreeTestOperationAdapter({
  worktreeManager,
  executionProfiles,
  testRunner
} = {}) {
  if (!worktreeManager ||
      !isText(worktreeManager.projectRef, 512) ||
      typeof worktreeManager.resolveTaskWorkspace !== "function") {
    throw new TypeError("A host-owned Task Worktree Manager is required.");
  }
  if (!Array.isArray(executionProfiles) || executionProfiles.length < 1 ||
      typeof testRunner?.run !== "function") {
    throw new TypeError("Host execution profiles and a fixed test runner are required.");
  }

  const profiles = new Map();
  for (const input of executionProfiles) {
    const profile = validateProfile(input);
    if (profiles.has(profile.executionProfileId)) {
      throw new TypeError("Duplicate host execution profile identifier.");
    }
    profiles.set(profile.executionProfileId, profile);
  }

  function validateInput(input, context) {
    if (!exactDataObject(context, ["phase", "taskRef", "operation", "executionProfileId"]) ||
        context.phase !== "PLAN" ||
        context.operation !== "workspace.test" ||
        !isText(context.taskRef, 256) ||
        !isText(context.executionProfileId, 128) ||
        !exactDataObject(input, ["executionProfileId"]) ||
        input.executionProfileId !== context.executionProfileId ||
        !profiles.has(context.executionProfileId)) {
      throw new TaskWorktreeTestError("TEST_PROFILE_NOT_HOST_AUTHORIZED");
    }
    return Object.freeze({ executionProfileId: context.executionProfileId });
  }

  return Object.freeze({
    validateInput,
    async execute(context) {
      if (!exactDataObject(context, [
        "taskRef", "manifestDigest", "operation", "input", "authorization",
        "resourceLease", "assertResourceActive"
      ], ["planRef", "planDigest", "stepRef"]) ||
          context.operation !== "workspace.test" ||
          context.authorization?.allowed !== true ||
          context.authorization?.operation !== "workspace.test" ||
          !/^sha256:[a-f0-9]{64}$/.test(context.manifestDigest) ||
          !isText(context.taskRef, 256) ||
          !exactDataObject(context.input, ["executionProfileId"]) ||
          !isText(context.input.executionProfileId, 128) ||
          !context.resourceLease ||
          context.resourceLease.leaseState !== "active" ||
          typeof context.assertResourceActive !== "function") {
        throw new TaskWorktreeTestError("TEST_EXECUTE_CONTEXT_INVALID");
      }

      const profile = profiles.get(context.input.executionProfileId);
      if (!profile) throw new TaskWorktreeTestError("TEST_PROFILE_NOT_HOST_AUTHORIZED");
      const workspace = await worktreeManager.resolveTaskWorkspace({ taskRef: context.taskRef });
      if (workspace.projectRef !== worktreeManager.projectRef ||
          workspace.taskRef !== context.taskRef ||
          workspace.state !== "ready") {
        throw new TaskWorktreeTestError("TEST_WORKSPACE_RUNTIME_BINDING_MISMATCH");
      }

      context.assertResourceActive();
      const result = await testRunner.run({
        profile,
        workspace,
        taskRef: context.taskRef,
        manifestDigest: context.manifestDigest,
        assertResourceActive: context.assertResourceActive
      });
      if (!exactDataObject(result, [
        "runner", "imageDigest", "testFiles", "passed", "exitCode",
        "signal", "durationMs", "stdout", "stderr"
      ]) ||
          result.runner !== "docker-node-test" ||
          result.imageDigest !== profile.imageDigest ||
          result.passed !== (result.exitCode === 0) ||
          !Array.isArray(result.testFiles) ||
          result.testFiles.length !== profile.testFiles.length ||
          result.testFiles.some((item, index) => item !== profile.testFiles[index]) ||
          !Number.isSafeInteger(result.durationMs) || result.durationMs < 0 ||
          typeof result.stdout !== "string" || typeof result.stderr !== "string" ||
          Buffer.byteLength(result.stdout + result.stderr, "utf8") >
            profile.maxOutputBytes * 2) {
        throw new TaskWorktreeTestError("TEST_RUNNER_RESULT_INVALID");
      }
      context.assertResourceActive();
      return Object.freeze({
        operation: "workspace.test",
        taskRef: context.taskRef,
        manifestDigest: context.manifestDigest,
        executionProfileId: profile.executionProfileId,
        passed: result.passed,
        exitCode: result.exitCode,
        signal: result.signal,
        durationMs: result.durationMs,
        imageDigest: result.imageDigest,
        testFiles: result.testFiles,
        stdout: result.stdout,
        stderr: result.stderr
      });
    }
  });
}
