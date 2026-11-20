/**
 * Read-only telemetry snapshot plus one immediately released cpu-heavy
 * admission probe against the existing local IMMORTAL ResourceManager.
 *
 * No workspace, task, Docker, model or protocol state is touched.
 * The probe prints a bounded aggregate snapshot and never prints host details.
 */

import { pathToFileURL } from "node:url";
import path from "node:path";
import { lstat } from "node:fs/promises";

const CODING_ROOT = process.env.CORMIA_CODING_ROOT;

function boundedText(value, max = 160) {
  if (typeof value !== "string") return null;
  return value.replace(/[\r\n\t]+/g, " ").slice(0, max);
}

function safePolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return null;
  const result = {};
  for (const [key, value] of Object.entries(policy)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) continue;
    if (/(path|secret|token|credential|endpoint|address|key|host)/i.test(key)) continue;
    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      result[key] = value;
    } else if (typeof value === "string" && value.length <= 120) {
      result[key] = boundedText(value, 120);
    }
  }
  return result;
}

function snapshotSummary(snapshot) {
  const recommendation = snapshot?.recommendation ?? {};
  return {
    capturedAt: boundedText(snapshot?.capturedAt, 64),
    mode: boundedText(recommendation.mode, 64),
    reason: boundedText(recommendation.reason, 160),
    availableMemoryGB:
      typeof recommendation.availableMemoryGB === "number" &&
      Number.isFinite(recommendation.availableMemoryGB)
        ? recommendation.availableMemoryGB : null,
    cpuUtilizationPct:
      typeof recommendation.cpuUtilizationPct === "number" &&
      Number.isFinite(recommendation.cpuUtilizationPct)
        ? recommendation.cpuUtilizationPct : null,
    gpuFreeMemoryGB:
      typeof recommendation.gpuFreeMemoryGB === "number" &&
      Number.isFinite(recommendation.gpuFreeMemoryGB)
        ? recommendation.gpuFreeMemoryGB : null,
    policy: safePolicy(recommendation.policy)
  };
}

async function main() {
  if (typeof CODING_ROOT !== "string" || CODING_ROOT.trim() === "") {
    throw new Error("Set CORMIA_CODING_ROOT to the existing IMMORTAL Coding Workspace root.");
  }

  const codingRoot = path.resolve(CODING_ROOT);
  const managerPath = path.join(codingRoot, "self-improvement", "resource-manager.mjs");
  const managerStat = await lstat(managerPath);
  if (!managerStat.isFile() || managerStat.isSymbolicLink()) {
    throw new Error("ResourceManager must be a regular non-symlink file.");
  }

  const module = await import(pathToFileURL(managerPath).href);
  if (typeof module.ResourceManager !== "function") {
    throw new Error("ResourceManager export is unavailable.");
  }

  const manager = new module.ResourceManager();
  const snapshot = await manager.snapshot();
  const output = {
    schema: "cormia.local-resource-manager-diagnostic.v1",
    operation: "workspace-test",
    resourceClass: "cpu-heavy",
    snapshot: snapshotSummary(snapshot),
    admission: {
      attempted: true,
      allowed: false,
      reason: null,
      leaseIdPresent: false,
      releaseCallbackPresent: false,
      released: false
    }
  };

  let lease;
  try {
    lease = manager.acquire("cpu-heavy", snapshot);
    output.admission.allowed = lease?.allowed === true;
    output.admission.reason = boundedText(lease?.reason, 160);
    output.admission.leaseIdPresent =
      typeof lease?.leaseId === "string" && lease.leaseId.length > 0;
    output.admission.releaseCallbackPresent = typeof lease?.release === "function";
  } catch (error) {
    output.admission.reason = boundedText(error?.code ?? error?.message ?? "resource-acquisition-failed");
  }

  if (output.admission.allowed) {
    if (!output.admission.releaseCallbackPresent) {
      output.admission.allowed = false;
      output.admission.reason = "lease-release-unavailable";
    } else {
      try {
        await lease.release();
        output.admission.released = true;
      } catch (error) {
        output.admission.reason = boundedText(error?.code ?? error?.message ?? "resource-release-failed");
        output.admission.released = false;
      }
    }
  }

  output.result =
    output.admission.allowed && output.admission.released
      ? "ADMITTED_AND_RELEASED"
      : "DENIED_OR_RELEASE_UNVERIFIED";

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  if (!output.admission.allowed || !output.admission.released) process.exitCode = 2;
}

main().catch(error => {
  process.stderr.write(
    "[Cormia ResourceManager diagnostic] FAILED: " +
    String(error?.code ?? error?.message ?? "diagnostic-failed").slice(0, 200) + "\n"
  );
  process.exitCode = 1;
});
