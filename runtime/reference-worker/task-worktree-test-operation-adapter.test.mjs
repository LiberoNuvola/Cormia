import test from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createDockerTaskWorktreeTestRunner,
  createTaskWorktreeTestOperationAdapter
} from "./task-worktree-test-operation-adapter.mjs";

const IMAGE = "ghcr.io/cormia/node-test@sha256:" + "a".repeat(64);
const PROFILE = Object.freeze({
  executionProfileId: "node-core-tests-v1",
  runner: "node-test",
  imageDigest: IMAGE,
  testFiles: ["runtime/core/example.test.mjs"],
  maxRuntimeMs: 10_000,
  memoryMiB: 512,
  cpus: 1,
  pidsLimit: 64,
  tmpfsMiB: 64,
  maxOutputBytes: 16_384
});

async function temporaryWorkspace() {
  const rootPath = await mkdtemp(path.join(os.tmpdir(), "cormia-test-worktree-"));
  const file = path.join(rootPath, "runtime", "core", "example.test.mjs");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "import test from 'node:test'; test('ok', () => {});\n", "utf8");
  return { rootPath, file };
}

function createFakeDockerProcessPort({
  host = process.platform === "win32"
    ? "npipe:////./pipe/docker_engine"
    : "unix:///var/run/docker.sock",
  imageAvailable = true,
  runBehavior = "success"
} = {}) {
  const calls = [];
  const processPort = {
    async execFile(executable, args, options) {
      calls.push({ kind: "execFile", executable, args: [...args], options });
      if (args[0] === "context" && args[1] === "inspect") {
        return { stdout: JSON.stringify(host), stderr: "" };
      }
      if (args[0] === "--context" && args[2] === "image" && args[3] === "inspect") {
        if (!imageAvailable) throw new Error("image is not preloaded");
        return { stdout: "", stderr: "" };
      }
      throw new Error("unexpected fake Docker preflight call");
    },
    spawn(executable, args, options) {
      calls.push({ kind: "spawn", executable, args: [...args], options });
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.closed = false;
      child.kill = signal => {
        if (!child.closed) {
          child.closed = true;
          setImmediate(() => {
            child.stdout.end();
            child.stderr.end();
            child.emit("close", null, signal);
          });
        }
        return true;
      };
      if (runBehavior === "success") {
        setImmediate(() => {
          if (child.closed) return;
          child.stdout.write(JSON.stringify(args));
          child.stdout.end();
          child.stderr.end();
          child.closed = true;
          child.emit("close", 0, null);
        });
      }
      return child;
    }
  };
  return { processPort, calls };
}

test("test adapter accepts only a host-registered execution profile", () => {
  const adapter = createTaskWorktreeTestOperationAdapter({
    worktreeManager: {
      projectRef: "project:test",
      async resolveTaskWorkspace() { throw new Error("not reached"); }
    },
    executionProfiles: [PROFILE],
    testRunner: { async run() { throw new Error("not reached"); } }
  });

  assert.deepEqual(adapter.validateInput(
    { executionProfileId: PROFILE.executionProfileId },
    {
      phase: "PLAN",
      taskRef: "task:test",
      operation: "workspace.test",
      executionProfileId: PROFILE.executionProfileId
    }
  ), { executionProfileId: PROFILE.executionProfileId });

  assert.throws(() => adapter.validateInput(
    { executionProfileId: "model-selected-command" },
    {
      phase: "PLAN",
      taskRef: "task:test",
      operation: "workspace.test",
      executionProfileId: "model-selected-command"
    }
  ), error => error.code === "TEST_PROFILE_NOT_HOST_AUTHORIZED");
});

test("test adapter requires a broker-provided active resource lease", async () => {
  const adapter = createTaskWorktreeTestOperationAdapter({
    worktreeManager: {
      projectRef: "project:test",
      async resolveTaskWorkspace({ taskRef }) {
        return { projectRef: "project:test", taskRef, state: "ready", rootPath: "/tmp/task" };
      }
    },
    executionProfiles: [PROFILE],
    testRunner: { async run() { throw new Error("must not execute"); } }
  });

  await assert.rejects(adapter.execute({
    taskRef: "task:test",
    manifestDigest: "sha256:" + "b".repeat(64),
    operation: "workspace.test",
    input: { executionProfileId: PROFILE.executionProfileId },
    authorization: { allowed: true, operation: "workspace.test" },
    resourceLease: null,
    assertResourceActive: () => true
  }), error => error.code === "TEST_EXECUTE_CONTEXT_INVALID");
});

test("test adapter passes only the host profile and task worktree to its fixed runner", async () => {
  const workspace = {
    projectRef: "project:test",
    taskRef: "task:test",
    state: "ready",
    rootPath: "/tmp/task"
  };
  let invocation;
  const adapter = createTaskWorktreeTestOperationAdapter({
    worktreeManager: {
      projectRef: "project:test",
      async resolveTaskWorkspace({ taskRef }) {
        assert.equal(taskRef, "task:test");
        return workspace;
      }
    },
    executionProfiles: [PROFILE],
    testRunner: {
      async run(input) {
        invocation = input;
        input.assertResourceActive();
        return {
          runner: "docker-node-test",
          imageDigest: PROFILE.imageDigest,
          testFiles: [...PROFILE.testFiles],
          passed: true,
          exitCode: 0,
          signal: null,
          durationMs: 17,
          stdout: "ok",
          stderr: ""
        };
      }
    }
  });

  let leaseChecks = 0;
  const result = await adapter.execute({
    taskRef: "task:test",
    manifestDigest: "sha256:" + "b".repeat(64),
    operation: "workspace.test",
    input: { executionProfileId: PROFILE.executionProfileId },
    authorization: { allowed: true, operation: "workspace.test" },
    resourceLease: { leaseState: "active" },
    assertResourceActive() { leaseChecks += 1; return true; }
  });

  assert.equal(result.passed, true);
  assert.equal(result.executionProfileId, PROFILE.executionProfileId);
  assert.equal(invocation.workspace, workspace);
  assert.deepEqual(invocation.profile, PROFILE);
  assert.ok(leaseChecks >= 2);
});

test("Docker runner uses a fixed no-network sandbox and host-pinned test files", async () => {
  const workspace = await temporaryWorkspace();
  const fake = createFakeDockerProcessPort();
  try {
    const runner = createDockerTaskWorktreeTestRunner({ processPort: fake.processPort });
    const result = await runner.run({
      profile: PROFILE,
      workspace: { rootPath: workspace.rootPath },
      assertResourceActive() { return true; }
    });
    assert.equal(result.passed, true);
    const spawnCall = fake.calls.find(call => call.kind === "spawn");
    assert.ok(spawnCall);
    const args = spawnCall.args;
    assert.deepEqual(args.slice(0, 4), ["--context", "default", "run", "--pull=never"]);
    assert.ok(args.includes("--network"));
    assert.ok(args.includes("none"));
    assert.ok(args.includes("--read-only"));
    assert.ok(args.includes("--cap-drop"));
    assert.ok(args.includes("ALL"));
    assert.ok(args.includes("--security-opt"));
    assert.ok(args.includes("no-new-privileges"));
    assert.ok(args.includes("--memory"));
    assert.ok(args.includes("--memory-swap"));
    assert.ok(args.includes("--user"));
    const userIndex = args.indexOf("--user");
    assert.match(args[userIndex + 1], /^[1-9][0-9]*:[1-9][0-9]*$/);
    assert.ok(args.includes("--cpus"));
    assert.ok(args.includes("--pids-limit"));
    assert.ok(args.includes(IMAGE));
    assert.deepEqual(args.slice(-3), ["node", "--test", PROFILE.testFiles[0]]);
    assert.equal(args.includes("sh"), false);
    assert.equal(args.includes("-c"), false);
  } finally {
    await rm(workspace.rootPath, { recursive: true, force: true });
  }
});

test("Docker runner rejects missing files before process launch", async () => {
  const workspace = await temporaryWorkspace();
  await rm(workspace.file);
  try {
    const runner = createDockerTaskWorktreeTestRunner({ dockerExecutable: "must-not-launch" });
    await assert.rejects(runner.run({
      profile: PROFILE,
      workspace: { rootPath: workspace.rootPath },
      assertResourceActive() { return true; }
    }), error => error.code === "TEST_PROFILE_FILE_MISSING");
  } finally {
    await rm(workspace.rootPath, { recursive: true, force: true });
  }
});

test("Docker runner rejects file symlink escapes before process launch", async t => {
  const workspace = await temporaryWorkspace();
  const outside = path.join(path.dirname(workspace.rootPath), "outside.test.mjs");
  await writeFile(outside, "export {};", "utf8");
  await rm(workspace.file);
  try {
    try {
      await symlink(outside, workspace.file);
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        t.skip("Host does not permit file symbolic-link creation");
        return;
      }
      throw error;
    }
    const runner = createDockerTaskWorktreeTestRunner({ dockerExecutable: "must-not-launch" });
    await assert.rejects(runner.run({
      profile: PROFILE,
      workspace: { rootPath: workspace.rootPath },
      assertResourceActive() { return true; }
    }), error => error.code === "TEST_PROFILE_SYMLINK_DENIED");
  } finally {
    await rm(workspace.rootPath, { recursive: true, force: true });
    await rm(outside, { force: true });
  }
});

test("Docker runner terminates when the task resource lease is revoked", async () => {
  const workspace = await temporaryWorkspace();
  const fake = createFakeDockerProcessPort({ runBehavior: "hold" });
  let checks = 0;
  try {
    const runner = createDockerTaskWorktreeTestRunner({
      stopGraceMs: 100,
      processPort: fake.processPort
    });
    await assert.rejects(runner.run({
      profile: { ...PROFILE, maxRuntimeMs: 8_000 },
      workspace: { rootPath: workspace.rootPath },
      assertResourceActive() {
        checks += 1;
        if (checks >= 3) throw new Error("revoked");
        return true;
      }
    }), error => error.code === "TEST_RESOURCE_LEASE_LOST");
    assert.ok(fake.calls.some(call => call.kind === "spawn"));
  } finally {
    await rm(workspace.rootPath, { recursive: true, force: true });
  }
});



test("Docker runner refuses a remote Docker context", async () => {
  const workspace = await temporaryWorkspace();
  const fake = createFakeDockerProcessPort({ host: "tcp://192.0.2.10:2376" });
  try {
    const runner = createDockerTaskWorktreeTestRunner({ processPort: fake.processPort });
    await assert.rejects(runner.run({
      profile: PROFILE,
      workspace: { rootPath: workspace.rootPath },
      assertResourceActive() { return true; }
    }), error => error.code === "DOCKER_CONTEXT_NOT_LOCAL");
    assert.equal(fake.calls.some(call => call.kind === "spawn"), false);
  } finally {
    await rm(workspace.rootPath, { recursive: true, force: true });
  }
});

test("Docker runner refuses to pull a missing image", async () => {
  const workspace = await temporaryWorkspace();
  const fake = createFakeDockerProcessPort({ imageAvailable: false });
  try {
    const runner = createDockerTaskWorktreeTestRunner({ processPort: fake.processPort });
    await assert.rejects(runner.run({
      profile: PROFILE,
      workspace: { rootPath: workspace.rootPath },
      assertResourceActive() { return true; }
    }), error => error.code === "TEST_IMAGE_NOT_PRELOADED");
    assert.equal(fake.calls.some(call => call.kind === "spawn"), false);
  } finally {
    await rm(workspace.rootPath, { recursive: true, force: true });
  }
});
