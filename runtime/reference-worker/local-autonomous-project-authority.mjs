import { createHash } from "node:crypto";
import { canonicalizeLocalClaims } from "./local-runtime-capability-grants.mjs";

const OPERATION_SET = new Set([
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
]);

const WORKSPACE_PATH_OPERATIONS = new Set([
  "workspace.list",
  "workspace.read",
  "workspace.diff",
  "workspace.verify",
  "workspace.create",
  "workspace.replace",
  "workspace.patch"
]);

const REMOTE_OPERATIONS = new Set([
  "git.push.feature-branch",
  "github.pull-request.create",
  "github.pull-request.update"
]);

const PROTECTED_OPERATIONS = new Set([
  "git.push.protected-branch",
  "git.merge.protected-branch",
  "git.release",
  "production.deploy",
  "wallet.sign",
  "fund.transfer",
  "cardano.settle",
  "trust-anchor.change"
]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Reflect.ownKeys(value);
  if (actual.some(key => typeof key !== "string")) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (actual.some(key => {
    const descriptor = descriptors[key];
    return !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value");
  })) return false;
  const sorted = actual.sort();
  const required = [...expected].sort();
  return sorted.length === required.length &&
    sorted.every((key, index) => key === required[index]);
}

function isCanonicalRelativePath(value, { allowRoot = false } = {}) {
  if (typeof value !== "string" || value.length < 1 || value.length > 512) return false;
  if (typeof value.isWellFormed === "function" && !value.isWellFormed()) return false;
  if (allowRoot && value === ".") return true;
  if (value === "." || value.includes("\\") || value.startsWith("/") ||
      /^[A-Za-z]:/.test(value) || /[<>:"|?*\u0000-\u001f]/.test(value)) return false;
  return value.split("/").every(segment =>
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.endsWith(" ") &&
    !segment.endsWith(".") &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment)
  );
}

function isWithinExcludedPath(relativePath, excludedPath) {
  return relativePath === excludedPath || relativePath.startsWith(excludedPath + "/");
}

function parseTime(value) {
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : NaN;
}

function validateMandateClaims(claims) {
  if (!isPlainObject(claims) ||
      claims.schemaVersion !== "0.1.0" ||
      typeof claims.mandateId !== "string" ||
      typeof claims.issuerId !== "string" ||
      typeof claims.operatorPrincipalId !== "string" ||
      !exactKeys(claims.subject, ["workerId", "runtimeId"]) ||
      !exactKeys(claims.project, ["projectRef", "repositoryRef", "baseRef"]) ||
      !exactKeys(claims.workspace, [
        "workspaceRef", "scopeMode", "recursive", "excludedPaths", "taskWorktreeRequired"
      ]) ||
      !Array.isArray(claims.allowedOperations) ||
      !Array.isArray(claims.protectedActions) ||
      !exactKeys(claims.gitPolicy, [
        "branchPrefix", "defaultBranchWrite", "protectedBranchMerge",
        "releaseTag", "autoPushFeatureBranch", "autoCreatePullRequest"
      ]) ||
      !exactKeys(claims.networkPolicy, ["mode", "allowedHttpsHosts"]) ||
      !exactKeys(claims.resourceBudget, [
        "maxConcurrentTasks", "maxAttemptsPerTask", "maxRuntimeMinutes",
        "maxCpuHeavyMinutes", "maxMemoryMiB"
      ]) ||
      !exactKeys(claims.autonomyPolicy, [
        "acceptInScopeTasksAutomatically", "allowAgentCreatedSubtasks",
        "humanApprovalPerOperation", "continueIndependentTasksOnBlock", "stopOnTrustFailure"
      ]) ||
      typeof claims.delegable !== "boolean" ||
      typeof claims.operatorConsentDigest !== "string") {
    return { valid: false, reason: "invalid-mandate-shape" };
  }

  if (claims.workspace.scopeMode !== "isolated-project-worktree" ||
      claims.workspace.recursive !== true ||
      claims.workspace.taskWorktreeRequired !== true ||
      claims.delegable !== false) {
    return { valid: false, reason: "unsupported-mandate-workspace-or-delegation-mode" };
  }

  if (claims.autonomyPolicy.acceptInScopeTasksAutomatically !== true ||
      claims.autonomyPolicy.allowAgentCreatedSubtasks !== true ||
      claims.autonomyPolicy.humanApprovalPerOperation !== false ||
      claims.autonomyPolicy.stopOnTrustFailure !== true) {
    return { valid: false, reason: "mandate-is-not-autonomous-or-fails-open" };
  }

  if (!claims.allowedOperations.every(operation => OPERATION_SET.has(operation)) ||
      new Set(claims.allowedOperations).size !== claims.allowedOperations.length) {
    return { valid: false, reason: "invalid-or-duplicate-mandate-operation" };
  }

  if (!Array.isArray(claims.workspace.excludedPaths) ||
      !claims.workspace.excludedPaths.every(path => isCanonicalRelativePath(path)) ||
      new Set(claims.workspace.excludedPaths).size !== claims.workspace.excludedPaths.length) {
    return { valid: false, reason: "invalid-mandate-excluded-paths" };
  }

  if (!claims.gitPolicy.branchPrefix ||
      claims.gitPolicy.defaultBranchWrite !== "deny" ||
      claims.gitPolicy.protectedBranchMerge !== "separate-authority" ||
      claims.gitPolicy.releaseTag !== "separate-authority") {
    return { valid: false, reason: "invalid-git-protection-policy" };
  }

  if (!["offline", "https-allowlist"].includes(claims.networkPolicy.mode) ||
      !Array.isArray(claims.networkPolicy.allowedHttpsHosts)) {
    return { valid: false, reason: "invalid-network-policy" };
  }
  if (!Number.isSafeInteger(claims.resourceBudget.maxAttemptsPerTask) ||
      claims.resourceBudget.maxAttemptsPerTask < 1 ||
      !Number.isSafeInteger(claims.resourceBudget.maxRuntimeMinutes) ||
      claims.resourceBudget.maxRuntimeMinutes < 1 ||
      !Number.isSafeInteger(claims.resourceBudget.maxConcurrentTasks) ||
      claims.resourceBudget.maxConcurrentTasks < 1) {
    return { valid: false, reason: "invalid-resource-budget" };
  }

  const issuedAt = parseTime(claims.issuedAt);
  const notBefore = parseTime(claims.notBefore);
  const expiresAt = parseTime(claims.expiresAt);
  if (![issuedAt, notBefore, expiresAt].every(Number.isFinite) ||
      issuedAt > notBefore || notBefore >= expiresAt) {
    return { valid: false, reason: "invalid-mandate-time-order" };
  }
  return { valid: true };
}

/**
 * Create an internal, non-bearer child authority for one task. The caller MUST
 * supply this object from the trusted host mandate store after verifying the
 * mandate signature, operator consent receipt, key status and revocation/
 * anchor state. This function does not accept model-supplied trust assertions.
 *
 * No UI callback, operator token, API token or private key is accepted here.
 */
export function deriveLocalProjectTaskAuthority({
  trustedMandate,
  expectedHost,
  task,
  now = new Date()
} = {}) {
  try {
    if (!exactKeys(trustedMandate, [
      "claims", "mandateDigest", "issuerId", "signatureVerified",
      "consentVerified", "revocationState"
    ]) || trustedMandate.signatureVerified !== true ||
        trustedMandate.consentVerified !== true ||
        trustedMandate.revocationState !== "healthy" ||
        typeof trustedMandate.mandateDigest !== "string" ||
        !/^sha256:[a-f0-9]{64}$/.test(trustedMandate.mandateDigest)) {
      return { authorized: false, reason: "mandate-not-trusted" };
    }

    const verdict = validateMandateClaims(trustedMandate.claims);
    if (!verdict.valid) return { authorized: false, reason: verdict.reason };
    const mandate = trustedMandate.claims;

    if (!expectedHost || mandate.issuerId !== trustedMandate.issuerId ||
        expectedHost.issuerId !== mandate.issuerId ||
        expectedHost.projectRef !== mandate.project.projectRef ||
        expectedHost.repositoryRef !== mandate.project.repositoryRef ||
        expectedHost.workspaceRef !== mandate.workspace.workspaceRef ||
        expectedHost.workerId !== mandate.subject.workerId ||
        expectedHost.runtimeId !== mandate.subject.runtimeId) {
      return { authorized: false, reason: "mandate-host-binding-mismatch" };
    }

    const nowMs = now instanceof Date ? now.getTime() :
      typeof now === "string" ? Date.parse(now) :
      typeof now === "number" ? now : NaN;
    if (!Number.isFinite(nowMs)) return { authorized: false, reason: "invalid-runtime-clock" };
    if (parseTime(mandate.notBefore) > nowMs) return { authorized: false, reason: "mandate-not-yet-valid" };
    if (parseTime(mandate.expiresAt) <= nowMs) return { authorized: false, reason: "mandate-expired" };

    if (!exactKeys(task, [
      "taskId", "manifestDigest", "requestedOperations", "expiresAt"
    ]) ||
        typeof task.taskId !== "string" || task.taskId.length < 1 ||
        !/^sha256:[a-f0-9]{64}$/.test(task.manifestDigest) ||
        !Array.isArray(task.requestedOperations) ||
        task.requestedOperations.length < 1 ||
        !task.requestedOperations.every(operation => mandate.allowedOperations.includes(operation)) ||
        new Set(task.requestedOperations).size !== task.requestedOperations.length) {
      return { authorized: false, reason: "task-request-exceeds-project-mandate" };
    }

    const taskExpiry = task.expiresAt === null ? parseTime(mandate.expiresAt) : parseTime(task.expiresAt);
    const expiresAt = Math.min(taskExpiry, parseTime(mandate.expiresAt));
    if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
      return { authorized: false, reason: "invalid-task-authority-expiry" };
    }

    const payload = {
      schemaVersion: "0.1.0",
      mandateId: mandate.mandateId,
      mandateDigest: trustedMandate.mandateDigest,
      taskId: task.taskId,
      manifestDigest: task.manifestDigest,
      issuerId: mandate.issuerId,
      workerId: mandate.subject.workerId,
      runtimeId: mandate.subject.runtimeId,
      projectRef: mandate.project.projectRef,
      repositoryRef: mandate.project.repositoryRef,
      workspaceRef: mandate.workspace.workspaceRef,
      operations: [...task.requestedOperations].sort(),
      expiresAt: new Date(expiresAt).toISOString()
    };
    const childDigest = "sha256:" + createHash("sha256")
      .update("IMMORTAL-AEP|LOCAL-PROJECT-TASK-AUTHORITY|v0.1|" + canonicalizeLocalClaims(payload))
      .digest("hex");

    return {
      authorized: true,
      kind: "internal-local-project-task-authority",
      childDigest,
      authority: Object.freeze(payload)
    };
  } catch {
    return { authorized: false, reason: "task-authority-derivation-failed" };
  }
}

/**
 * Authorize one tool invocation from the Runtime's already-loaded child
 * authority. This is an internal policy check, not a new human approval or
 * bearer-token exchange. Path canonicalization is lexical; the filesystem
 * adapter must additionally enforce realpath/symlink containment at I/O time.
 */
export function authorizeLocalProjectOperation({
  childAuthority,
  trustedMandate,
  hostPolicy,
  operation,
  relativePath,
  executionProfileId,
  branchName,
  remoteHost,
  now = new Date()
} = {}) {
  try {
    if (!childAuthority || childAuthority.authorized !== true ||
        childAuthority.kind !== "internal-local-project-task-authority" ||
        !exactKeys(childAuthority.authority, [
          "schemaVersion", "mandateId", "mandateDigest", "taskId",
          "manifestDigest", "issuerId", "workerId", "runtimeId", "projectRef",
          "repositoryRef", "workspaceRef", "operations", "expiresAt"
        ])) {
      return { allowed: false, reason: "invalid-internal-task-authority" };
    }
    if (!trustedMandate || trustedMandate.signatureVerified !== true ||
        trustedMandate.consentVerified !== true ||
        trustedMandate.revocationState !== "healthy" ||
        !hostPolicy) {
      return { allowed: false, reason: "trusted-mandate-state-unavailable" };
    }
    const mandate = trustedMandate.claims;
    const authority = childAuthority.authority;
    const bindingPairs = [
      [authority.mandateId, mandate.mandateId],
      [authority.mandateDigest, trustedMandate.mandateDigest],
      [authority.issuerId, mandate.issuerId],
      [authority.workerId, mandate.subject.workerId],
      [authority.runtimeId, mandate.subject.runtimeId],
      [authority.projectRef, mandate.project.projectRef],
      [authority.repositoryRef, mandate.project.repositoryRef],
      [authority.workspaceRef, mandate.workspace.workspaceRef]
    ];
    if (bindingPairs.some(([a, b]) => a !== b) ||
        hostPolicy.issuerId !== authority.issuerId ||
        hostPolicy.projectRef !== authority.projectRef ||
        hostPolicy.repositoryRef !== authority.repositoryRef ||
        hostPolicy.workspaceRef !== authority.workspaceRef ||
        hostPolicy.workerId !== authority.workerId ||
        hostPolicy.runtimeId !== authority.runtimeId) {
      return { allowed: false, reason: "runtime-host-binding-mismatch" };
    }

    const nowMs = now instanceof Date ? now.getTime() :
      typeof now === "string" ? Date.parse(now) :
      typeof now === "number" ? now : NaN;
    if (!Number.isFinite(nowMs)) return { allowed: false, reason: "invalid-runtime-clock" };
    if (parseTime(authority.expiresAt) <= nowMs ||
        parseTime(mandate.expiresAt) <= nowMs) {
      return { allowed: false, reason: "project-task-authority-expired" };
    }
    if (typeof operation !== "string" ||
        PROTECTED_OPERATIONS.has(operation) ||
        !authority.operations.includes(operation) ||
        !mandate.allowedOperations.includes(operation)) {
      return { allowed: false, reason: "operation-not-in-derived-authority" };
    }
    if (!Array.isArray(hostPolicy.allowedOperations) ||
        !hostPolicy.allowedOperations.includes(operation)) {
      return { allowed: false, reason: "operation-not-allowed-by-host-policy" };
    }

    if (WORKSPACE_PATH_OPERATIONS.has(operation)) {
      if (!isCanonicalRelativePath(relativePath, { allowRoot: operation === "workspace.list" })) {
        return { allowed: false, reason: "invalid-workspace-relative-path" };
      }
      if (mandate.workspace.excludedPaths.some(excluded => isWithinExcludedPath(relativePath, excluded))) {
        return { allowed: false, reason: "path-excluded-by-project-mandate" };
      }
      if (!Array.isArray(hostPolicy.excludedPaths) ||
          hostPolicy.excludedPaths.some(excluded => isWithinExcludedPath(relativePath, excluded))) {
        return { allowed: false, reason: "path-excluded-by-host-policy" };
      }
    }

    if (operation === "workspace.test" || operation === "workspace.build") {
      if (typeof executionProfileId !== "string" ||
          !Array.isArray(hostPolicy.allowedExecutionProfiles) ||
          !hostPolicy.allowedExecutionProfiles.includes(executionProfileId)) {
        return { allowed: false, reason: "execution-profile-not-allowed" };
      }
    }

    if (operation === "git.branch.create" || operation === "git.commit.local" ||
        operation === "git.push.feature-branch" ||
        operation === "github.pull-request.create" ||
        operation === "github.pull-request.update") {
      if (typeof branchName !== "string" ||
          !branchName.startsWith(mandate.gitPolicy.branchPrefix) ||
          branchName === mandate.project.baseRef) {
        return { allowed: false, reason: "branch-outside-mandate" };
      }
      if (operation === "git.push.feature-branch" && mandate.gitPolicy.autoPushFeatureBranch !== true) {
        return { allowed: false, reason: "feature-branch-push-not-in-mandate" };
      }
      if (operation === "github.pull-request.create" && mandate.gitPolicy.autoCreatePullRequest !== true) {
        return { allowed: false, reason: "pull-request-creation-not-in-mandate" };
      }
      if (REMOTE_OPERATIONS.has(operation)) {
        if (mandate.networkPolicy.mode !== "https-allowlist" ||
            typeof remoteHost !== "string" ||
            !mandate.networkPolicy.allowedHttpsHosts.includes(remoteHost) ||
            !Array.isArray(hostPolicy.allowedHttpsHosts) ||
            !hostPolicy.allowedHttpsHosts.includes(remoteHost)) {
          return { allowed: false, reason: "remote-host-not-allowed" };
        }
      }
    }

    return {
      allowed: true,
      reason: "authorized-by-standing-project-mandate",
      mandateId: authority.mandateId,
      taskId: authority.taskId,
      operation
    };
  } catch {
    return { allowed: false, reason: "project-operation-authorization-failed" };
  }
}
