import path from "node:path";

export const EVOLUTION_SOURCE_FILES = Object.freeze([
  "resource-manager.mjs",
  "evolution-manager.mjs"
]);
export const EVOLUTION_BASELINE_TESTS = Object.freeze([
  "resource-manager.test.mjs",
  "evolution-manager.test.mjs"
]);
export const EVOLUTION_TOOL_LIMITS = Object.freeze({
  maxReadLines: 120,
  maxCandidateTestBytes: 64 * 1024,
  maxPatchAnchorChars: 12000,
  maxPatchCount: 20
});

const RUN_ID_PATTERN = /^EVOL-[0-9]{14}-[0-9a-f]{8}$/;
const CANDIDATE_TEST_PATTERN = /^candidate-[a-z0-9-]{1,50}\.test\.mjs$/i;
const SOURCE_SET = new Set(EVOLUTION_SOURCE_FILES);
const BASELINE_SET = new Set(EVOLUTION_BASELINE_TESTS);
const READABLE_BASELINE_SET = new Set([
  ...EVOLUTION_SOURCE_FILES,
  ...EVOLUTION_BASELINE_TESTS
]);

const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9_]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /ntn_[A-Za-z0-9]{30,}/,
  /secret_[A-Za-z0-9]{30,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._-]{24,}/i
];

function requireManager(manager) {
  const methods = [
    "list", "readCandidate", "writeCandidate", "patchCandidate",
    "evaluate", "promotionPacket", "promote"
  ];
  if (!manager || methods.some(name => typeof manager[name] !== "function")) {
    throw new TypeError("SelfImprovementManager interface is incomplete.");
  }
  if (typeof manager.workspaceRoot !== "string" || !path.isAbsolute(manager.workspaceRoot)) {
    throw new Error("SelfImprovementManager workspaceRoot must be absolute.");
  }
  if (!manager.sourceFiles || typeof manager.sourceFiles !== "object" || Array.isArray(manager.sourceFiles)) {
    throw new Error("SelfImprovementManager sourceFiles must be an explicit map.");
  }
}

function assertFixedSourceMap(manager) {
  const root = path.join(path.resolve(manager.workspaceRoot), "self-improvement");
  const expected = {
    "resource-manager.mjs": path.join(root, "resource-manager.mjs"),
    "evolution-manager.mjs": path.join(root, "evolution-manager.mjs"),
    "resource-manager.test.mjs": path.join(root, "self-improvement.test.mjs"),
    "evolution-manager.test.mjs": path.join(root, "self-improvement.test.mjs")
  };
  const names = Object.keys(manager.sourceFiles).sort();
  const expectedNames = Object.keys(expected).sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error("Evolution source map does not match the fixed two-module/two-baseline profile.");
  }
  for (const name of expectedNames) {
    if (path.resolve(manager.sourceFiles[name]) !== path.resolve(expected[name])) {
      throw new Error("Evolution source path is outside the fixed self-improvement allowlist: " + name);
    }
  }
}

function assertGoal(goal) {
  if (typeof goal !== "string" || goal.trim().length < 8 || goal.length > 2000) {
    throw new Error("Evolution goal must contain 8-2000 characters.");
  }
}

function assertNoCandidateSecrets(content) {
  if (SECRET_PATTERNS.some(pattern => pattern.test(content))) {
    throw new Error("Candidate rejected: content matches a credential/private-key pattern.");
  }
}

function assertRunId(runId) {
  if (typeof runId !== "string" || !RUN_ID_PATTERN.test(runId)) {
    throw new Error("Invalid evolution run ID.");
  }
}

function sanitizeSummary(item) {
  if (!item || typeof item !== "object") return { status: "integrity_error" };
  return {
    id: typeof item.id === "string" ? item.id : null,
    status: typeof item.status === "string" ? item.status : "unknown",
    goal: typeof item.goal === "string" ? item.goal : null,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : null,
    sourceCount: Number.isInteger(item.sourceCount) ? item.sourceCount : null,
    candidateFileCount: Number.isInteger(item.candidateFileCount) ? item.candidateFileCount : null,
    eligibleForHumanReview: item.eligibleForHumanReview === true
  };
}

function isAllowedReadPath(candidatePath) {
  return READABLE_BASELINE_SET.has(candidatePath) || CANDIDATE_TEST_PATTERN.test(candidatePath);
}

function isAllowedPatchPath(candidatePath) {
  return SOURCE_SET.has(candidatePath) || CANDIDATE_TEST_PATTERN.test(candidatePath);
}

/**
 * Start a run only from the fixed trusted source map. The model supplies only
 * the goal; it cannot choose source paths or add files to the source snapshot.
 */
export async function startEvolutionRun(manager, goal) {
  requireManager(manager);
  assertFixedSourceMap(manager);
  assertGoal(goal);
  const started = await manager.start(goal.trim());
  if (!started || !RUN_ID_PATTERN.test(String(started.id ?? "")) ||
      started.status !== "candidate_open" || started.sourceCount !== 4) {
    throw new Error("Evolution manager did not create the expected fixed-profile run.");
  }
  return sanitizeSummary(started);
}

/**
 * List bounded run summaries. Candidate contents, source paths and journal
 * bodies are intentionally not returned.
 */
export async function listEvolutionRuns(manager, { limit = 50 } = {}) {
  requireManager(manager);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Evolution list limit must be between 1 and 100.");
  }
  const runs = await manager.list();
  return (Array.isArray(runs) ? runs : []).slice(0, limit).map(sanitizeSummary);
}

/**
 * Bind all candidate operations to one run ID selected by trusted host code.
 */
export async function bindEvolutionRun(manager, runId) {
  requireManager(manager);
  assertFixedSourceMap(manager);
  assertRunId(runId);

  const runs = await manager.list();
  const current = Array.isArray(runs) ? runs.find(item => item?.id === runId) : null;
  if (!current || current.status !== "candidate_open") {
    throw new Error("Evolution run is missing, corrupt, or not open for candidate work.");
  }

  const requireBoundRun = (requestedRunId) => {
    if (requestedRunId !== runId) throw new Error("Evolution adapter is bound to a different run ID.");
  };

  return Object.freeze({
    runId,

    async readCandidate({ runId: requestedRunId, path: candidatePath, startLine = 1, endLine } = {}) {
      requireBoundRun(requestedRunId);
      if (!isAllowedReadPath(candidatePath)) throw new Error("Candidate read path is outside the fixed allowlist.");
      if (!Number.isInteger(startLine) || startLine < 1) throw new Error("startLine must be a positive integer.");
      if (endLine !== undefined && (!Number.isInteger(endLine) || endLine < startLine)) {
        throw new Error("endLine must be an integer not smaller than startLine.");
      }
      const candidate = await manager.readCandidate(runId, candidatePath);
      const lines = candidate.content.split(/\r?\n/);
      const actualEnd = endLine === undefined ? Math.min(lines.length, startLine + EVOLUTION_TOOL_LIMITS.maxReadLines - 1) : endLine;
      if (actualEnd - startLine + 1 > EVOLUTION_TOOL_LIMITS.maxReadLines) {
        throw new Error("Candidate reads are limited to 120 lines.");
      }
      return {
        runId,
        path: candidatePath,
        sha256: candidate.sha256,
        bytes: candidate.bytes,
        totalLines: lines.length,
        startLine,
        endLine: Math.min(actualEnd, lines.length),
        content: startLine > lines.length ? "" : lines.slice(startLine - 1, actualEnd).join("\n")
      };
    },

    async writeCandidate({ runId: requestedRunId, path: candidatePath, content } = {}) {
      requireBoundRun(requestedRunId);
      if (typeof candidatePath !== "string" || !CANDIDATE_TEST_PATTERN.test(candidatePath)) {
        throw new Error("Only candidate-<name>.test.mjs files may be created.");
      }
      if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > EVOLUTION_TOOL_LIMITS.maxCandidateTestBytes) {
        throw new Error("Candidate test must be UTF-8 text up to 64 KiB.");
      }
      assertNoCandidateSecrets(content);
      return manager.writeCandidate(runId, candidatePath, content);
    },

    async applyPatch({
      runId: requestedRunId, path: candidatePath, expectedSha256,
      oldText, newText, expectedCount = 1
    } = {}) {
      requireBoundRun(requestedRunId);
      if (typeof candidatePath !== "string" || !isAllowedPatchPath(candidatePath) || BASELINE_SET.has(candidatePath)) {
        throw new Error("Only the two implementation modules or candidate-specific tests may be patched.");
      }
      if (!/^[a-f0-9]{64}$/.test(String(expectedSha256 ?? ""))) {
        throw new Error("expectedSha256 must be a full lowercase SHA-256 digest.");
      }
      if (typeof oldText !== "string" || oldText.length < 1 ||
          oldText.length > EVOLUTION_TOOL_LIMITS.maxPatchAnchorChars) {
        throw new Error("oldText must contain 1-12000 characters.");
      }
      if (typeof newText !== "string" || newText.length > EVOLUTION_TOOL_LIMITS.maxPatchAnchorChars) {
        throw new Error("newText must contain at most 12000 characters.");
      }
      if (!Number.isInteger(expectedCount) || expectedCount < 1 ||
          expectedCount > EVOLUTION_TOOL_LIMITS.maxPatchCount) {
        throw new Error("expectedCount must be an integer from 1 to 20.");
      }
      assertNoCandidateSecrets(newText);

      const current = await manager.readCandidate(runId, candidatePath);
      if (current.sha256 !== expectedSha256) throw new Error("Candidate SHA-256 precondition failed.");
      const occurrences = current.content.split(oldText).length - 1;
      if (occurrences !== expectedCount) {
        throw new Error("Patch anchor occurrence count mismatch; no change was applied.");
      }
      const updated = current.content.split(oldText).join(newText);
      return manager.patchCandidate(runId, candidatePath, expectedSha256, updated);
    },

    /**
     * Trusted host entry point only. Never expose this method as a model tool.
     * It accepts host-produced syntax/Docker evidence and delegates the
     * integrity/state transition to the existing SelfImprovementManager.
     */
    async evaluateFromTrustedHost({ workspaceVerify, workspaceTest, benchmark = null, capabilityEvidence = null } = {}) {
      const verifyFiles = workspaceVerify?.files;
      const verifyOk = workspaceVerify?.tool === "workspace_verify" &&
        workspaceVerify?.ok === true &&
        Array.isArray(verifyFiles) &&
        verifyFiles.length === 2 &&
        verifyFiles.every(item => item?.ok === true &&
          SOURCE_SET.has(item.path) &&
          /^[a-f0-9]{64}$/.test(String(item.sha256 ?? "")));
      const testOk = workspaceTest?.tool === "workspace_test" &&
        workspaceTest?.ok === true &&
        workspaceTest?.exitCode === 0 &&
        workspaceTest?.timedOut !== true &&
        workspaceTest?.image === "node:22-alpine" &&
        workspaceTest?.network === "none" &&
        workspaceTest?.workspaceMount === "candidate-only-read-only";

      if (!verifyOk || !testOk) {
        throw new Error("Only successful host-produced syntax and candidate-only Docker evidence may be evaluated.");
      }
      return manager.evaluate(runId, { workspaceVerify, workspaceTest, benchmark, capabilityEvidence });
    },

    async reviewPacket({ runId: requestedRunId } = {}) {
      requireBoundRun(requestedRunId);
      return manager.promotionPacket(runId);
    },

    async promote() {
      throw new Error("Automatic runtime promotion is prohibited; external human review is required.");
    }
  });
}
