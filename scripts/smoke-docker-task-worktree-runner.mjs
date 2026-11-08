/**
 * Real-Docker smoke test for Cormia's fixed workspace.test runner.
 *
 * Run from the repository root with CORMIA_DOCKER_TEST_IMAGE set to an
 * already-present, digest-qualified Node image (no pull is ever requested).
 * This exercises the real Docker CLI path, not the fake process port in tests.
 * The temporary worktree is created under the repository so Docker Desktop
 * must prove the same Windows bind-mount path used by local project worktrees.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  createDockerTaskWorktreeTestRunner
} from "../runtime/reference-worker/task-worktree-test-operation-adapter.mjs";

const IMAGE_DIGEST = /^[A-Za-z0-9._/-]+@sha256:[a-f0-9]{64}$/;

const smokeTestSource = `import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

test("host-pinned image provides Node 22", () => {
  assert.equal(process.versions.node.split(".")[0], "22");
});

test("container runs as the configured non-root UID", () => {
  assert.equal(typeof process.getuid, "function");
  assert.equal(process.getuid(), 1000);
});

test("task worktree bind mount is readable and writable", () => {
  const target = path.join(process.cwd(), ".cormia-smoke-write-check");
  writeFileSync(target, "workspace-write-ok", "utf8");
  assert.equal(readFileSync(target, "utf8"), "workspace-write-ok");
  unlinkSync(target);
});

test("bounded tmpfs is writable", () => {
  const target = path.join("/tmp", ".cormia-smoke-tmpfs-" + process.pid);
  writeFileSync(target, "tmpfs-write-ok", "utf8");
  assert.equal(readFileSync(target, "utf8"), "tmpfs-write-ok");
  unlinkSync(target);
});

test("container root filesystem is read-only", () => {
  const target = "/.cormia-smoke-root-write-" + process.pid;
  assert.throws(
    () => writeFileSync(target, "must-not-be-written", "utf8"),
    error => ["EROFS", "EACCES"].includes(error.code)
  );
});
`;

async function main() {
  const root = process.cwd();
  if (!existsSync(path.join(root, "runtime", "reference-worker", "task-worktree-test-operation-adapter.mjs"))) {
    throw new Error("Run this script from the Cormia repository root.");
  }

  const imageDigest = process.env.CORMIA_DOCKER_TEST_IMAGE;
  if (typeof imageDigest !== "string" || !IMAGE_DIGEST.test(imageDigest)) {
    throw new Error("CORMIA_DOCKER_TEST_IMAGE must be an exact repository@sha256:<64-hex> reference.");
  }

  const workspaceRoot = await mkdtemp(path.join(root, ".cormia-docker-runner-smoke-"));
  try {
    await writeFile(path.join(workspaceRoot, "docker-runner-smoke.test.mjs"), smokeTestSource, "utf8");

    const profile = Object.freeze({
      executionProfileId: "node22-alpine-docker-smoke-v1",
      runner: "node-test",
      imageDigest,
      testFiles: ["docker-runner-smoke.test.mjs"],
      maxRuntimeMs: 30_000,
      memoryMiB: 512,
      cpus: 1,
      pidsLimit: 64,
      tmpfsMiB: 64,
      maxOutputBytes: 65_536
    });

    console.log("[Cormia Docker smoke] image:", imageDigest);
    console.log("[Cormia Docker smoke] workspace:", workspaceRoot);
    const runner = createDockerTaskWorktreeTestRunner();
    const result = await runner.run({
      profile,
      workspace: { rootPath: workspaceRoot },
      // This smoke test exercises the real runner boundary only. It does not
      // claim a production Broker or ResourceManager lease.
      assertResourceActive() { return true; }
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    console.log("[Cormia Docker smoke] result:", JSON.stringify({
      passed: result.passed,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      imageDigest: result.imageDigest,
      testFiles: result.testFiles
    }));
    if (!result.passed || result.exitCode !== 0) {
      throw new Error("The real Docker test runner returned a non-zero test result.");
    }
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error("[Cormia Docker smoke] FAILED:", error.code ?? error.name, error.message);
  process.exitCode = 1;
});
