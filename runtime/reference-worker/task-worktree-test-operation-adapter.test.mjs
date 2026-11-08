import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, chmod, symlink, rm } from "node:fs/promises";
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
  const directory = path.dirname(workspace.rootPath);
  const fakeDocker = path.join(directory, "fake-docker");
  await writeFile(fakeDocker,
    "#!/usr/bin/env node\nconst args = process.argv.slice(2);\nif (args[0] === \"context\") { process.stdout.write(JSON.stringify(\"unix:///var/run/docker.sock\")); }\nelse if (args[0] === \"--context\" && args[2] === \"image\") { process.exit(0); }\nelse if (args[0] === \"--context\" && args[2] === \"run\") { process.stdout.write(JSON.stringify(args)); }\nelse { process.exit(19); }\n",
    "utf8");
  await chmod(fakeDocker, 0o755);

  try {
    const runner = createDockerTaskWorktreeTestRunner({ dockerExecutable: fakeDocker });
    const result = await runner.run({
      profile: PROFILE,
      workspace: { rootPath: workspace.rootPath },
      assertResourceActive() { return true; }
    });
    assert.equal(result.passed, true);
    const args = JSON.parse(result.stdout);
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
  const directory = path.dirname(workspace.rootPath);
  const fakeDocker = path.join(directory, "fake-sleep-docker");
  await writeFile(fakeDocker,
    "#!/usr/bin/env node\nconst args = process.argv.slice(2);\nif (args[0] === \"context\") { process.stdout.write(JSON.stringify(\"unix:///var/run/docker.sock\")); }\nelse if (args[0] === \"--context\" && args[2] === \"image\") { process.exit(0); }\nelse if (args[0] === \"--context\" && args[2] === \"run\") { setTimeout(() => process.exit(0), 5000); }\nelse { process.exit(23); }\n",
    "utf8");
  await chmod(fakeDocker, 0o755);

  let checks = 0;
  try {
    const runner = createDockerTaskWorktreeTestRunner({
      dockerExecutable: fakeDocker,
      stopGraceMs: 100
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
  } finally {
    await rm(workspace.rootPath, { recursive: true, force: true });
  }
});


async function writeDockerPreflightStub(directory, { host, imageAvailable }) {
  const executable = path.join(directory, "fake-docker-preflight");
  const source = [
    "#!/usr/bin/env node",
    "const args = process.argv.slice(2);",
    "if (args[0] === 'context') { process.stdout.write(JSON.stringify(" + JSON.stringify(host) + ")); }",
    "else if (args[0] === '--context' && args[2] === 'image') { process.exit(" + (imageAvailable ? "0" : "1") + "); }",
    "else { process.exit(23); }",
    ""
  ].join("\n");
  await writeFile(executable, source, "utf8");
  await chmod(executable, 0o755);
  return executable;
}

test("Docker runner refuses a remote Docker context", async () => {
  const workspace = await temporaryWorkspace();
  const executable = await writeDockerPreflightStub(path.dirname(workspace.rootPath), {
    host: "tcp://192.0.2.10:2376",
    imageAvailable: true
  });
  try {
    const runner = createDockerTaskWorktreeTestRunner({ dockerExecutable: executable });
    await assert.rejects(runner.run({
      profile: PROFILE,
      workspace: { rootPath: workspace.rootPath },
      assertResourceActive() { return true; }
    }), error => error.code === "DOCKER_CONTEXT_NOT_LOCAL");
  } finally {
    await rm(workspace.rootPath, { recursive: true, force: true });
  }
});

test("Docker runner refuses to pull a missing image", async () => {
  const workspace = await temporaryWorkspace();
  const executable = await writeDockerPreflightStub(path.dirname(workspace.rootPath), {
    host: "unix:///var/run/docker.sock",
    imageAvailable: false
  });
  try {
    const runner = createDockerTaskWorktreeTestRunner({ dockerExecutable: executable });
    await assert.rejects(runner.run({
      profile: PROFILE,
      workspace: { rootPath: workspace.rootPath },
      assertResourceActive() { return true; }
    }), error => error.code === "TEST_IMAGE_NOT_PRELOADED");
  } finally {
    await rm(workspace.rootPath, { recursive: true, force: true });
  }
});
