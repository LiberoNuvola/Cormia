/**
 * Real local integration smoke:
 * Project Runtime Broker -> Cormia Resource Provider -> actual IMMORTAL
 * ResourceManager -> actual Docker CLI -> task-specific Git worktree.
 *
 * Authority providers and the Task Manifest are intentionally synthetic.
 * This script validates the host integration seam, not production mandate
 * signatures, consent, revocation anchors or Agent task-loop activation.
 *
 * No image is pulled. Docker is invoked with --pull=never by the fixed runner.
 */

import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp, mkdir, rm, writeFile, lstat
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";

import { createProjectRuntime } from "../runtime/core/project-runtime-registry.mjs";
import { PLAN_PROPOSAL_CONTRACT_VERSION } from "../runtime/core/plan-execute-capability-broker.mjs";
import { createTaskWorktreeManager } from "../runtime/reference-worker/git-task-worktree-manager.mjs";
import { createTaskWorktreeTestOperationAdapter } from "../runtime/reference-worker/task-worktree-test-operation-adapter.mjs";
import { createDockerTaskWorktreeTestRunner } from "../runtime/reference-worker/task-worktree-test-operation-adapter.mjs";
import { createImmortalResourceProvider } from "../runtime/reference-worker/immortal-resource-provider-composition.mjs";

const execFile = promisify(execFileCallback);
const IMAGE_DIGEST = /^[A-Za-z0-9._/-]+@sha256:[a-f0-9]{64}$/;
const IMAGE = process.env.CORMIA_DOCKER_TEST_IMAGE;
const CODING_ROOT = process.env.CORMIA_CODING_ROOT;

const TEST_FILE = "smoke.test.mjs";
const RESOURCE_OFFER_ID = "offer:real-resource-manager-docker-smoke";
const RESOURCE_PROFILE_REF = "profile:real-resource-manager-docker-smoke-v1";
const EXECUTION_PROFILE_ID = "node22-alpine-broker-docker-smoke-v1";

const TEST_SOURCE = `import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

test("host-pinned image runs Node 22", () => {
  assert.equal(process.versions.node.split(".")[0], "22");
});

test("container runs as non-root UID 1000", () => {
  assert.equal(typeof process.getuid, "function");
  assert.equal(process.getuid(), 1000);
});

test("task worktree bind mount is writable", () => {
  const target = path.join(process.cwd(), ".broker-resource-smoke-write");
  writeFileSync(target, "broker-resource-write-ok", "utf8");
  assert.equal(readFileSync(target, "utf8"), "broker-resource-write-ok");
  unlinkSync(target);
});

test("bounded tmpfs is writable", () => {
  const target = path.join("/tmp", ".broker-resource-smoke-" + process.pid);
  writeFileSync(target, "tmpfs-ok", "utf8");
  assert.equal(readFileSync(target, "utf8"), "tmpfs-ok");
  unlinkSync(target);
});

test("container root filesystem is read-only", () => {
  const target = "/.broker-resource-smoke-" + process.pid;
  assert.throws(
    () => writeFileSync(target, "must-not-write", "utf8"),
    error => ["EROFS", "EACCES"].includes(error.code)
  );
});
`;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function git(args, cwd) {
  return execFile("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
}

async function requireDirectory(directory, label) {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(label + " must be an existing non-symlink directory.");
  }
}

async function main() {
  if (!IMAGE || !IMAGE_DIGEST.test(IMAGE)) {
    throw new Error("CORMIA_DOCKER_TEST_IMAGE must be an exact repository@sha256:<64-hex> reference.");
  }
  if (!CODING_ROOT) {
    throw new Error("CORMIA_CODING_ROOT must point to the existing IMMORTAL Coding Workspace root.");
  }
  await requireDirectory(CODING_ROOT, "Coding Workspace root");

  const resourceManagerPath = path.join(
    path.resolve(CODING_ROOT),
    "self-improvement",
    "resource-manager.mjs"
  );
  const resourceManagerStat = await lstat(resourceManagerPath);
  if (!resourceManagerStat.isFile() || resourceManagerStat.isSymbolicLink()) {
    throw new Error("The existing ResourceManager module must be a regular non-symlink file.");
  }

  const imported = await import(pathToFileURL(resourceManagerPath).href);
  if (typeof imported.ResourceManager !== "function") {
    throw new Error("The existing module does not export ResourceManager.");
  }

  const resourceManager = new imported.ResourceManager();
  const nonce = randomUUID().replaceAll("-", "");
  const projectRef = "project:real-docker-smoke-" + nonce;
  const taskRef = "task:real-docker-smoke-" + nonce;
  const manifestDigest = "sha256:" + sha256("cormia-real-docker-smoke:" + nonce);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
  const startedAt = now.toISOString();

  const tempRoot = await mkdtemp(path.join(process.cwd(), ".cormia-broker-docker-smoke-"));
  const sourcePath = path.join(tempRoot, "source");
  const worktreeBasePath = path.join(tempRoot, "worktrees");
  let runtime;
  let prepared;
  let executed;

  try {
    await mkdir(sourcePath, { recursive: true });
    await git(["init", "--initial-branch=main"], sourcePath);
    await git(["config", "core.autocrlf", "false"], sourcePath);
    await git(["config", "user.name", "Cormia Docker Smoke"], sourcePath);
    await git(["config", "user.email", "cormia-docker-smoke@example.invalid"], sourcePath);
    await writeFile(path.join(sourcePath, TEST_FILE), TEST_SOURCE, "utf8");
    await git(["add", TEST_FILE], sourcePath);
    await git(["commit", "-m", "synthetic Docker smoke baseline"], sourcePath);

    const worktreeManager = createTaskWorktreeManager({
      repositoryPath: sourcePath,
      worktreeBasePath,
      projectRef,
      repositoryRef: "cormia/synthetic-docker-smoke",
      baseRef: "main",
      commandTimeoutMs: 15_000
    });
    const workspace = await worktreeManager.createTaskWorkspace({ taskRef });

    const profile = Object.freeze({
      executionProfileId: EXECUTION_PROFILE_ID,
      runner: "node-test",
      imageDigest: IMAGE,
      testFiles: [TEST_FILE],
      maxRuntimeMs: 30_000,
      memoryMiB: 512,
      cpus: 1,
      pidsLimit: 64,
      tmpfsMiB: 64,
      maxOutputBytes: 65_536
    });

    const operationAdapter = createTaskWorktreeTestOperationAdapter({
      worktreeManager,
      executionProfiles: [profile],
      testRunner: createDockerTaskWorktreeTestRunner()
    });

    const providerRef = "provider:existing-immortal-resource-manager";
    const resourceProvider = createImmortalResourceProvider({
      providerRef,
      offers: [{
        schemaVersion: "0.1.0",
        recordType: "cormia.core.resource-offer",
        offerId: RESOURCE_OFFER_ID,
        providerRef,
        resourceType: "compute.local-cpu",
        capabilityProfileRef: RESOURCE_PROFILE_REF,
        capacity: { quantity: 1, unit: "task" },
        availability: {
          notBefore: startedAt,
          expiresAt
        },
        privacyProfileRef: "privacy:local-only",
        offerState: "available",
        ownerAccepted: true,
        ownerAcceptanceRef: "operator:local-real-resource-smoke",
        validated: true,
        validationEvidenceRefs: ["evidence:local-smoke-host-profile"],
        createdAt: startedAt,
        updatedAt: startedAt,
        operation: "workspace-test"
      }],
      resourceManager,
      leaseTtlMs: 60_000
    });

    const task = Object.freeze({
      taskId: taskRef,
      manifestDigest,
      requestedOperations: ["workspace.test"],
      expiresAt
    });

    runtime = createProjectRuntime({
      projectRef,
      trustedProjectResolver: {
        async createTaskSession(verifiedTask) {
          if (verifiedTask.taskId !== taskRef ||
              verifiedTask.manifestDigest !== manifestDigest) {
            return { authorized: false, reason: "SYNTHETIC_TASK_BINDING_MISMATCH" };
          }
          return Object.freeze({
            authorized: true,
            taskId: taskRef,
            manifestDigest,
            async authorizeOperation(request) {
              const allowed =
                request.operation === "workspace.test" &&
                request.executionProfileId === EXECUTION_PROFILE_ID;
              return {
                allowed,
                reason: allowed ? "SYNTHETIC_SMOKE_MANDATE_ALLOWED" : "SYNTHETIC_SMOKE_MANDATE_DENIED",
                operation: request.operation
              };
            }
          });
        }
      },
      taskAuthorityProvider: {
        async loadVerifiedTask(requestedTaskRef) {
          if (requestedTaskRef !== taskRef) throw new Error("unknown synthetic task");
          return task;
        },
        async revalidateVerifiedTask({ taskRef: requestedTaskRef }) {
          if (requestedTaskRef !== taskRef) throw new Error("synthetic task binding changed");
          return task;
        }
      },
      resourceAdmissionProvider: {
        async resolveRequirement({ operation }) {
          if (operation !== "workspace.test") return { required: false };
          return {
            required: true,
            offerId: RESOURCE_OFFER_ID,
            capabilityProfileRef: RESOURCE_PROFILE_REF,
            requestedCapacity: { quantity: 1, unit: "task" }
          };
        }
      },
      resourceProvider,
      operationAdapters: { "workspace.test": operationAdapter },
      idFactory: () => "plan:real-docker-smoke:" + nonce
    });

    console.log("[Cormia Broker→ResourceManager→Docker smoke] image:", IMAGE);
    console.log("[Cormia Broker→ResourceManager→Docker smoke] ResourceManager:", resourceManagerPath);
    console.log("[Cormia Broker→ResourceManager→Docker smoke] disposable worktree:", workspace.rootPath);

    prepared = await runtime.preparePlan({
      taskRef,
      proposal: {
        contractVersion: PLAN_PROPOSAL_CONTRACT_VERSION,
        steps: [{
          operation: "workspace.test",
          executionProfileId: EXECUTION_PROFILE_ID,
          input: { executionProfileId: EXECUTION_PROFILE_ID }
        }]
      }
    });
    if (prepared?.accepted !== true) {
      throw new Error("Broker rejected the synthetic smoke plan: " + JSON.stringify({
        accepted: prepared?.accepted,
        reason: prepared?.reason,
        error: prepared?.error
      }));
    }

    executed = await runtime.executePlan({
      taskRef,
      planRef: prepared.planRef,
      expectedPlanDigest: prepared.planDigest
    });

    const stepResult = executed?.steps?.[0]?.result;
    const passed =
      executed?.executed === true &&
      executed?.state === "COMPLETED" &&
      stepResult?.passed === true &&
      stepResult?.exitCode === 0;

    console.log("[Cormia Broker→ResourceManager→Docker smoke] broker:", JSON.stringify({
      acceptedPlan: prepared.accepted,
      executed: executed?.executed,
      state: executed?.state,
      testPassed: stepResult?.passed ?? false,
      exitCode: stepResult?.exitCode ?? null,
      durationMs: stepResult?.durationMs ?? null,
      runner: stepResult?.runner ?? null,
      imageDigest: stepResult?.imageDigest ?? null,
      testFiles: stepResult?.testFiles ?? null
    }));

    if (!passed) {
      const stepError = executed?.steps?.[0]?.error;
      throw new Error("End-to-end smoke did not complete successfully: " +
        JSON.stringify({
          executed: executed?.executed,
          state: executed?.state,
          error: stepError?.code ?? stepError?.message ?? null,
          reason: executed?.reason ?? null
        }));
    }

    console.log("[Cormia Broker→ResourceManager→Docker smoke] PASS");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(
    "[Cormia Broker→ResourceManager→Docker smoke] BLOCKED/FAILED:",
    error.code ?? error.name,
    error.message
  );
  process.exitCode = 1;
});
