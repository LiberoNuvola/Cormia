import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeLocalProjectOperation,
  deriveLocalProjectTaskAuthority
} from "./local-autonomous-project-authority.mjs";

const now = "2026-11-02T17:00:00.000Z";
const issuerId = "local-host:operator-1";
const projectRef = "project-cormia";
const repositoryRef = "LiberoNuvola/Cormia";
const workspaceRef = "worktree-cormia-task-1";
const workerId = "worker-cormia-local";
const runtimeId = "runtime-cormia-autonomous";
const mandateId = "11111111-1111-4111-8111-111111111111";
const taskId = "TASK-20261102-AUTONOMOUS-001";
const manifestDigest = "sha256:" + "a".repeat(64);
const mandateDigest = "sha256:" + "b".repeat(64);

const operations = [
  "workspace.list",
  "workspace.read",
  "workspace.diff",
  "workspace.verify",
  "workspace.create",
  "workspace.replace",
  "workspace.patch",
  "workspace.test",
  "workspace.build",
  "git.branch.create",
  "git.commit.local",
  "git.push.feature-branch",
  "github.pull-request.create",
  "github.pull-request.update"
];

function mandateClaims(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    mandateId,
    issuerId,
    operatorPrincipalId: "os-principal:operator-1",
    subject: { workerId, runtimeId },
    project: { projectRef, repositoryRef, baseRef: "main" },
    workspace: {
      workspaceRef,
      scopeMode: "isolated-project-worktree",
      recursive: true,
      excludedPaths: [".secrets", "wallet", "credentials"],
      taskWorktreeRequired: true
    },
    allowedOperations: [...operations],
    executionProfileIds: ["node22-project-tests", "node22-build"],
    gitPolicy: {
      branchPrefix: "agent/",
      defaultBranchWrite: "deny",
      protectedBranchMerge: "separate-authority",
      releaseTag: "separate-authority",
      autoPushFeatureBranch: true,
      autoCreatePullRequest: true
    },
    networkPolicy: {
      mode: "https-allowlist",
      allowedHttpsHosts: ["api.github.com"]
    },
    resourceBudget: {
      maxConcurrentTasks: 2,
      maxAttemptsPerTask: 5,
      maxRuntimeMinutes: 240,
      maxCpuHeavyMinutes: 90,
      maxMemoryMiB: 8192
    },
    autonomyPolicy: {
      acceptInScopeTasksAutomatically: true,
      allowAgentCreatedSubtasks: true,
      humanApprovalPerOperation: false,
      continueIndependentTasksOnBlock: true,
      stopOnTrustFailure: true
    },
    protectedActions: [
      "merge-protected-branch",
      "release",
      "production-deploy",
      "read-secret-material",
      "wallet-signing",
      "fund-transfer",
      "cardano-settlement",
      "change-trust-anchor",
      "widen-mandate"
    ],
    issuedAt: "2026-11-02T16:30:00.000Z",
    notBefore: "2026-11-02T16:30:00.000Z",
    expiresAt: "2026-11-03T16:30:00.000Z",
    delegable: false,
    operatorConsentDigest: "sha256:" + "c".repeat(64),
    ...overrides
  };
}

function trustedMandate(overrides = {}) {
  return {
    claims: mandateClaims(),
    mandateDigest,
    issuerId,
    signatureVerified: true,
    consentVerified: true,
    revocationState: "healthy",
    ...overrides
  };
}

function hostContext(overrides = {}) {
  return {
    issuerId,
    projectRef,
    repositoryRef,
    workspaceRef,
    workerId,
    runtimeId,
    ...overrides
  };
}

function hostPolicy(overrides = {}) {
  return {
    issuerId,
    projectRef,
    repositoryRef,
    workspaceRef,
    workerId,
    runtimeId,
    allowedOperations: [...operations],
    excludedPaths: [".secrets", "wallet", "credentials"],
    allowedExecutionProfiles: ["node22-project-tests", "node22-build"],
    allowedHttpsHosts: ["api.github.com"],
    ...overrides
  };
}

function task(overrides = {}) {
  return {
    taskId,
    manifestDigest,
    requestedOperations: [
      "workspace.read",
      "workspace.create",
      "workspace.replace",
      "workspace.patch",
      "workspace.test",
      "workspace.build"
    ],
    expiresAt: "2026-11-02T20:00:00.000Z",
    ...overrides
  };
}

function derive(overrides = {}) {
  return deriveLocalProjectTaskAuthority({
    trustedMandate: trustedMandate(),
    expectedHost: hostContext(),
    task: task(),
    now,
    ...overrides
  });
}

function authorize(childAuthority, overrides = {}) {
  return authorizeLocalProjectOperation({
    childAuthority,
    trustedMandate: trustedMandate(),
    hostPolicy: hostPolicy(),
    expectedTaskId: taskId,
    expectedManifestDigest: manifestDigest,
    operation: "workspace.read",
    relativePath: "src/index.mjs",
    now,
    ...overrides
  });
}

test("derives one internal task authority from a trusted project mandate without a user token", () => {
  const result = derive();
  assert.equal(result.authorized, true);
  assert.equal(result.kind, "internal-local-project-task-authority");
  assert.match(result.childDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.authority.taskId, taskId);
  assert.equal(result.authority.operations.includes("workspace.create"), true);
  assert.equal(Object.hasOwn(result, "token"), false);
  assert.equal(Object.hasOwn(result.authority, "apiKey"), false);
  assert.equal(Object.hasOwn(result.authority, "bearerToken"), false);
});

test("a single child authority authorizes repeated in-scope edits and tests without approval callbacks", () => {
  const child = derive();
  assert.equal(child.authorized, true);

  const create = authorize(child, {
    operation: "workspace.create",
    relativePath: "src/new-module.mjs"
  });
  const replace = authorize(child, {
    operation: "workspace.replace",
    relativePath: "src/index.mjs"
  });
  const patch = authorize(child, {
    operation: "workspace.patch",
    relativePath: "src/index.mjs"
  });
  const test = authorize(child, {
    operation: "workspace.test",
    executionProfileId: "node22-project-tests"
  });
  const build = authorize(child, {
    operation: "workspace.build",
    executionProfileId: "node22-build"
  });

  for (const result of [create, replace, patch, test, build]) {
    assert.equal(result.allowed, true, result.reason);
    assert.equal(result.reason, "authorized-by-standing-project-mandate");
  }
});

test("in-scope project tasks and their subtask capabilities are derived automatically", () => {
  const childA = derive({ task: task({ taskId: "TASK-A" }) });
  const childB = derive({ task: task({
    taskId: "TASK-B",
    requestedOperations: ["workspace.read", "workspace.test"]
  }) });
  assert.equal(childA.authorized, true);
  assert.equal(childB.authorized, true);
  assert.notEqual(childA.childDigest, childB.childDigest);
});

test("denies an unverified, unconsented, revoked or wrong-issuer mandate", () => {
  assert.equal(derive({ trustedMandate: trustedMandate({ signatureVerified: false }) }).reason, "mandate-not-trusted");
  assert.equal(derive({ trustedMandate: trustedMandate({ consentVerified: false }) }).reason, "mandate-not-trusted");
  assert.equal(derive({ trustedMandate: trustedMandate({ revocationState: "revoked" }) }).reason, "mandate-not-trusted");
  assert.equal(derive({ trustedMandate: trustedMandate({ issuerId: "other-issuer" }) }).reason, "mandate-not-trusted");
});

test("denies task capabilities that exceed the project mandate", () => {
  const result = derive({
    task: task({ requestedOperations: ["workspace.read", "production.deploy"] })
  });
  assert.equal(result.authorized, false);
  assert.equal(result.reason, "task-request-exceeds-project-mandate");
});

test("denies host/project/worktree/worker/runtime substitution", () => {
  for (const changes of [
    { expectedHost: hostContext({ projectRef: "other-project" }) },
    { expectedHost: hostContext({ repositoryRef: "other/repo" }) },
    { expectedHost: hostContext({ workspaceRef: "other-worktree" }) },
    { expectedHost: hostContext({ workerId: "other-worker" }) },
    { expectedHost: hostContext({ runtimeId: "other-runtime" }) }
  ]) {
    const result = derive(changes);
    assert.equal(result.authorized, false);
    assert.equal(result.reason, "mandate-host-binding-mismatch");
  }
});

test("rechecks mandate not-before time on every tool invocation", () => {
  const futureMandate = trustedMandate({
    claims: mandateClaims({ notBefore: "2026-11-02T17:10:00.000Z" })
  });
  const child = derive({
    trustedMandate: futureMandate,
    now: "2026-11-02T17:15:00.000Z"
  });
  assert.equal(child.authorized, true);
  assert.equal(authorize(child, {
    trustedMandate: futureMandate,
    now: "2026-11-02T17:00:00.000Z"
  }).reason, "mandate-not-yet-valid");
});

test("denies expired, not-yet-valid and invalidly ordered mandates", () => {
  assert.equal(derive({
    now: "2026-11-04T00:00:00.000Z"
  }).reason, "mandate-expired");

  const future = trustedMandate({
    claims: mandateClaims({ notBefore: "2026-11-03T00:00:00.000Z" })
  });
  assert.equal(derive({ trustedMandate: future }).reason, "mandate-not-yet-valid");

  const malformed = trustedMandate({
    claims: mandateClaims({ expiresAt: "2026-11-02T15:00:00.000Z" })
  });
  assert.equal(derive({ trustedMandate: malformed }).reason, "invalid-mandate-time-order");
});

test("denies unsafe paths and every path within mandate or host exclusions", () => {
  const child = derive();
  for (const path of ["../outside.mjs", "/absolute", "C:/outside", "src\\escape.mjs", "src//file.mjs"]) {
    assert.equal(authorize(child, {
      operation: "workspace.read",
      relativePath: path
    }).reason, "invalid-workspace-relative-path");
  }
  assert.equal(authorize(child, {
    operation: "workspace.read",
    relativePath: ".secrets/config.json"
  }).reason, "path-excluded-by-project-mandate");
  assert.equal(authorize(child, {
    operation: "workspace.read",
    relativePath: "wallet/seed.txt"
  }).reason, "path-excluded-by-project-mandate");
  assert.equal(authorize(child, {
    operation: "workspace.read",
    relativePath: "credentials/github.json"
  }).reason, "path-excluded-by-project-mandate");
  assert.equal(authorize(child, {
    operation: "workspace.read",
    relativePath: "src/private/key.txt",
    hostPolicy: hostPolicy({ excludedPaths: ["src/private"] })
  }).reason, "path-excluded-by-host-policy");
});

test("allows only named test/build profiles", () => {
  const child = derive();
  assert.equal(authorize(child, {
    operation: "workspace.test",
    executionProfileId: "node22-project-tests"
  }).allowed, true);
  assert.equal(authorize(child, {
    operation: "workspace.test",
    executionProfileId: "arbitrary-shell"
  }).reason, "execution-profile-not-allowed");
  assert.equal(authorize(child, {
    operation: "workspace.test",
    executionProfileId: "node22-host-only-profile",
    hostPolicy: hostPolicy({
      allowedExecutionProfiles: ["node22-project-tests", "node22-host-only-profile"]
    })
  }).reason, "execution-profile-not-allowed");
});

test("feature branches may be pushed only when both mandate and host policy permit", () => {
  const child = derive({
    task: task({ requestedOperations: ["git.branch.create", "git.commit.local", "git.push.feature-branch"] })
  });
  assert.equal(authorize(child, {
    operation: "git.push.feature-branch",
    branchName: "agent/feature-1",
    remoteHost: "api.github.com"
  }).allowed, true);
  assert.equal(authorize(child, {
    operation: "git.push.feature-branch",
    branchName: "main",
    remoteHost: "api.github.com"
  }).reason, "branch-outside-mandate");
  assert.equal(authorize(child, {
    operation: "git.push.feature-branch",
    branchName: "agent/feature-1",
    remoteHost: "evil.example"
  }).reason, "remote-host-not-allowed");
  assert.equal(authorize(child, {
    operation: "git.push.feature-branch",
    branchName: "agent/feature-1",
    remoteHost: "api.github.com",
    hostPolicy: hostPolicy({ allowedOperations: ["workspace.read"] })
  }).reason, "operation-not-allowed-by-host-policy");
});

test("remote operations require a brokered HTTPS allowlist policy", () => {
  const child = derive({
    task: task({ requestedOperations: ["github.pull-request.create"] })
  });
  assert.equal(authorize(child, {
    operation: "github.pull-request.create",
    branchName: "agent/feature-1",
    remoteHost: "api.github.com"
  }).allowed, true);
  const offlineMandate = trustedMandate({
    claims: mandateClaims({ networkPolicy: { mode: "offline", allowedHttpsHosts: [] } })
  });
  const offlineChild = derive({ trustedMandate: offlineMandate, task: task({
    requestedOperations: ["github.pull-request.create"]
  }) });
  assert.equal(authorize(offlineChild, {
    operation: "github.pull-request.create",
    branchName: "agent/feature-1",
    remoteHost: "api.github.com",
    trustedMandate: offlineMandate
  }).reason, "remote-host-not-allowed");
});

test("denies protected external actions regardless of model-requested operation", () => {
  const child = derive({
    task: task({ requestedOperations: ["workspace.read"] })
  });
  for (const operation of [
    "git.push.protected-branch",
    "git.merge.protected-branch",
    "git.release",
    "production.deploy",
    "wallet.sign",
    "fund.transfer",
    "cardano.settle",
    "trust-anchor.change"
  ]) {
    assert.equal(authorize(child, { operation }).reason, "operation-not-in-derived-authority");
  }
});

test("denies a modified mandate, task or internal child authority at invocation", () => {
  const child = derive();
  const alteredMandate = trustedMandate({
    mandateDigest: "sha256:" + "f".repeat(64)
  });
  assert.equal(authorize(child, { trustedMandate: alteredMandate }).reason, "child-mandate-digest-mismatch");
  assert.equal(authorize(child, { expectedTaskId: "another-task" }).reason, "task-context-mismatch");
  assert.equal(authorize(child, {
    expectedManifestDigest: "sha256:" + "f".repeat(64)
  }).reason, "task-context-mismatch");

  const alteredChild = {
    ...child,
    authority: { ...child.authority, workspaceRef: "other-worktree" }
  };
  assert.equal(authorize(alteredChild).reason, "child-authority-integrity-failure");
});

test("host policy is an upper bound over mandate operation sets", () => {
  const child = derive();
  const result = authorize(child, {
    operation: "workspace.patch",
    hostPolicy: hostPolicy({ allowedOperations: ["workspace.read"] })
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "operation-not-allowed-by-host-policy");
});

test("denies a malformed non-autonomous mandate", () => {
  const notAutonomous = trustedMandate({
    claims: mandateClaims({
      autonomyPolicy: {
        acceptInScopeTasksAutomatically: true,
        allowAgentCreatedSubtasks: true,
        humanApprovalPerOperation: true,
        continueIndependentTasksOnBlock: true,
        stopOnTrustFailure: true
      }
    })
  });
  assert.equal(derive({ trustedMandate: notAutonomous }).reason, "mandate-is-not-autonomous-or-fails-open");
});

test("denies any task that tries to derive a child authority past its expiry", () => {
  const result = derive({
    task: task({ expiresAt: "2026-11-02T16:00:00.000Z" })
  });
  assert.equal(result.authorized, false);
  assert.equal(result.reason, "invalid-task-authority-expiry");
});
