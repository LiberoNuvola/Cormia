#!/usr/bin/env node
/**
 * Read-only local compatibility probe for Cormia's IMMORTAL adapters.
 *
 * Reads the local Agent tasks.json in memory but prints only aggregate status
 * counts. It never prints goals, task results, evidence content, secrets or
 * candidate source. It does not write to the Agent or candidate trees.
 *
 * Existing data, self-improvement and runs directories are required. The
 * probe refuses to create them, so a missing path is reported as a blocker.
 */
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { inspectTaskStoreV1 } from "../runtime/reference-worker/immortal-agent-task-store-v1-adapter.mjs";
import { inspectReferencedAttemptEvidence } from "../runtime/reference-worker/local-evidence-sidecar-probe.mjs";
import { withLocalResourceLease } from "../runtime/reference-worker/immortal-resource-manager-adapter.mjs";
import { bindEvolutionRun, listEvolutionRuns } from "../runtime/reference-worker/immortal-evolution-manager-adapter.mjs";
import { createReadOnlyCodingWorkspaceAdapter } from "../runtime/reference-worker/immortal-coding-workspace-readonly-adapter.mjs";

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag !== "--agent-root" && flag !== "--coding-root") {
      throw new Error("Usage: node scripts/verify-local-runtime-adapters.mjs --agent-root <path> --coding-root <path>");
    }
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new Error("Missing value for " + flag);
    result[flag === "--agent-root" ? "agentRoot" : "codingRoot"] = path.resolve(value);
  }
  if (!result.agentRoot || !result.codingRoot) {
    throw new Error("Both --agent-root and --coding-root are required.");
  }
  return result;
}

async function requireRegularFile(filePath, label) {
  const stat = await lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(label + " must be a regular, non-symlink file.");
  }
}

async function requireDirectory(directoryPath, label) {
  const stat = await lstat(directoryPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(label + " must be an existing, non-symlink directory.");
  }
}

function countByStatus(items) {
  const counts = {};
  for (const item of items) {
    const status = typeof item.status === "string" ? item.status : "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  const { agentRoot, codingRoot } = parseArgs(process.argv.slice(2));

  const summary = {
    schema: "cormia.local-runtime-adapter-probe.v1",
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    collectionMode: "local-read-only-probe",
    agentRootPresent: false,
    codingRootPresent: false,
    taskStore: { present: false, valid: null, taskCount: 0, statusCounts: {}, errorCount: 0, warningCount: 0 },
    evidenceSidecars: { checked: false, result: "not-run", valid: null, referencedCount: 0, validCount: 0, missingCount: 0, unsafeCount: 0, tooLargeCount: 0, invalidJsonCount: 0, invalidSchemaCount: 0, readErrorCount: 0, evidenceItemCount: 0, errorItemCount: 0, emptySidecarCount: 0, bytesRead: 0, withoutEvidencePathCount: 0, maxFileBytes: 8388608 },
    resourceManager: { importOk: false, leaseProbe: "not-run", reason: null, operation: "agent-inference" },
    codingWorkspace: { importOk: false, readOnlyListProbe: "not-run", totalEntries: null, truncated: null, reason: null },
    evolutionManager: { importOk: false, runCount: 0, statusCounts: {}, openCandidateRead: "not-run", readSha256Prefix: null },
    limitations: [
      "No Agent process or Granite model was started.",
      "No task-store file was changed; only aggregate fields are printed.",
      "Only task-referenced evidence sidecars are read in memory under an 8 MiB per-file bound; raw payload content and identifiers are never printed.",
      "No candidate was created, patched, evaluated or promoted.",
      "No Docker container or workspace test was run.",
      "No source, prompt, result, task goal, evidence body, credential or wallet material is printed."
    ]
  };

  const taskStorePath = path.join(agentRoot, "data", "tasks.json");
  const codingWorkspaceModulePath = path.join(agentRoot, "coding-workspace.mjs");
  const resourceModulePath = path.join(codingRoot, "self-improvement", "resource-manager.mjs");
  const evolutionModulePath = path.join(codingRoot, "self-improvement", "evolution-manager.mjs");
  const selfImprovementTestPath = path.join(codingRoot, "self-improvement", "self-improvement.test.mjs");

  let taskStoreFound = false;
  try {
    await requireDirectory(agentRoot, "Agent root");
    summary.agentRootPresent = true;
    await requireRegularFile(taskStorePath, "Agent task store");
    taskStoreFound = true;
    const store = JSON.parse(await readFile(taskStorePath, "utf8"));
    const inspected = inspectTaskStoreV1(store);
    summary.taskStore = {
      present: true,
      valid: inspected.valid,
      taskCount: inspected.taskCount,
      statusCounts: countByStatus(inspected.tasks),
      errorCount: inspected.errors.length,
      warningCount: inspected.warnings.length
    };
    if (!inspected.valid) {
      summary.taskStore.errors = inspected.errors;
    } else {
      try {
        summary.evidenceSidecars = await inspectReferencedAttemptEvidence({
          agentRoot,
          tasks: inspected.tasks
        });
      } catch {
        summary.evidenceSidecars = {
          ...summary.evidenceSidecars,
          checked: true,
          result: "PARTIAL_OR_FAIL",
          valid: false,
          readErrorCount: 1,
          reason: "sidecar-probe-exception"
        };
      }
    }
  } catch (error) {
    summary.taskStore = {
      present: taskStoreFound,
      valid: false,
      taskCount: 0,
      statusCounts: {},
      errorCount: 1,
      warningCount: 0,
      reason: String(error?.message ?? error)
    };
  }

  try {
    await requireDirectory(agentRoot, "Agent root");
    await requireDirectory(codingRoot, "Coding Workspace root");
    await requireRegularFile(codingWorkspaceModulePath, "Coding Workspace module");
    const { CodingWorkspace } = await import(pathToFileURL(codingWorkspaceModulePath).href);
    summary.codingWorkspace.importOk = typeof CodingWorkspace === "function";
    if (summary.codingWorkspace.importOk) {
      const codingWorkspace = new CodingWorkspace({
        root: codingRoot,
        protectedRoots: [
          agentRoot,
          "E:\\AI\\Immortal-Control-Room",
          "E:\\AI\\Immortal-MCP"
        ]
      });
      await codingWorkspace.initialize();
      const adapter = createReadOnlyCodingWorkspaceAdapter({
        codingWorkspace,
        readableFiles: [],
        listableDirectories: ["."]
      });
      const listing = await adapter.list();
      summary.codingWorkspace.readOnlyListProbe = listing?.ok === true ? "passed" : "blocked";
      summary.codingWorkspace.totalEntries = Number.isInteger(listing?.totalEntries) ? listing.totalEntries : null;
      summary.codingWorkspace.truncated = listing?.truncated === true;
    }
  } catch (error) {
    summary.codingWorkspace.readOnlyListProbe = "error";
    summary.codingWorkspace.reason = String(error?.message ?? error);
  }

  try {
    await requireDirectory(codingRoot, "Coding Workspace root");
    summary.codingRootPresent = true;
    await requireRegularFile(resourceModulePath, "Resource Manager module");
    const { ResourceManager } = await import(pathToFileURL(resourceModulePath).href);
    summary.resourceManager.importOk = typeof ResourceManager === "function";
    if (summary.resourceManager.importOk) {
      const resourceManager = new ResourceManager();
      const result = await withLocalResourceLease({
        resourceManager,
        operation: "agent-inference",
        run: async () => "adapter-probe-ok"
      });
      summary.resourceManager.leaseProbe = result.allowed ? "passed" : "blocked";
      summary.resourceManager.reason = result.allowed ? null : result.reason;
      summary.resourceManager.resourceMode = result.resource?.mode ?? null;
    }
  } catch (error) {
    summary.resourceManager.leaseProbe = "error";
    summary.resourceManager.reason = String(error?.message ?? error);
  }

  try {
    await requireRegularFile(evolutionModulePath, "Evolution Manager module");
    await requireRegularFile(selfImprovementTestPath, "Self-improvement baseline test source");
    const { SelfImprovementManager } = await import(pathToFileURL(evolutionModulePath).href);
    summary.evolutionManager.importOk = typeof SelfImprovementManager === "function";
    if (summary.evolutionManager.importOk) {
      const evolutionRoot = path.join(codingRoot, "self-improvement");
      await requireDirectory(evolutionRoot, "Self-improvement directory");
      await requireDirectory(path.join(evolutionRoot, "runs"), "Evolution runs directory");
      const manager = new SelfImprovementManager({
        workspaceRoot: codingRoot,
        sourceFiles: {
          "resource-manager.mjs": path.join(evolutionRoot, "resource-manager.mjs"),
          "evolution-manager.mjs": path.join(evolutionRoot, "evolution-manager.mjs"),
          "resource-manager.test.mjs": selfImprovementTestPath,
          "evolution-manager.test.mjs": selfImprovementTestPath
        }
      });
      await manager.initialize();
      const runs = await listEvolutionRuns(manager, { limit: 100 });
      summary.evolutionManager.runCount = runs.length;
      summary.evolutionManager.statusCounts = countByStatus(runs);
      const openRun = runs.find(item => item.status === "candidate_open");
      if (!openRun) {
        summary.evolutionManager.openCandidateRead = "skipped-no-open-run";
      } else {
        const adapter = await bindEvolutionRun(manager, openRun.id);
        const candidate = await adapter.readCandidate({
          runId: openRun.id,
          path: "resource-manager.mjs",
          startLine: 1,
          endLine: 1
        });
        summary.evolutionManager.openCandidateRead = "passed";
        summary.evolutionManager.readSha256Prefix = candidate.sha256.slice(0, 12);
      }
    }
  } catch (error) {
    summary.evolutionManager.openCandidateRead = "error";
    summary.evolutionManager.reason = String(error?.message ?? error);
  }


  const fatal = [];
  if (!summary.taskStore.present || summary.taskStore.valid !== true) fatal.push("task-store");
  if (summary.evidenceSidecars.result === "PARTIAL_OR_FAIL") fatal.push("evidence-sidecars");
  if (!summary.codingWorkspace.importOk) fatal.push("coding-workspace-import");
  if (summary.codingWorkspace.readOnlyListProbe !== "passed") fatal.push("coding-workspace-read-only-list");
  if (!summary.resourceManager.importOk) fatal.push("resource-manager-import");
  if (summary.resourceManager.leaseProbe === "error") fatal.push("resource-manager-runtime");
  if (!summary.evolutionManager.importOk) fatal.push("evolution-manager-import");
  if (summary.evolutionManager.openCandidateRead === "error") fatal.push("evolution-candidate-read");
  if ((summary.evolutionManager.statusCounts.integrity_error ?? 0) > 0) fatal.push("evolution-integrity");

  summary.result = fatal.length === 0 ? "PASS" : "PARTIAL_OR_FAIL";
  summary.blockers = fatal;
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  if (fatal.length) process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write("Local Runtime adapter probe failed: " + String(error?.message ?? error) + "\n");
  process.exitCode = 1;
});
