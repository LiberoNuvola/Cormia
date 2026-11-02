/**
 * Trusted-orchestrator adapter for the existing local IMMORTAL ResourceManager.
 *
 * The operation is selected by trusted Runtime code, never by model/tool input.
 * This module does not own the ResourceManager, alter host policy, or claim
 * operating-system enforcement.
 */
export const RESOURCE_OPERATION_KINDS = Object.freeze({
  "agent-inference": "model-inference",
  "workspace-test": "cpu-heavy",
  "evolution-docker-test": "cpu-heavy"
});

function resourceSummary(snapshot) {
  const recommendation = snapshot?.recommendation;
  if (!recommendation || !recommendation.policy) return null;
  return {
    capturedAt: typeof snapshot.capturedAt === "string" ? snapshot.capturedAt : null,
    mode: recommendation.mode ?? null,
    reason: recommendation.reason ?? null,
    availableMemoryGB: recommendation.availableMemoryGB ?? null,
    cpuUtilizationPct: recommendation.cpuUtilizationPct ?? null,
    gpuFreeMemoryGB: recommendation.gpuFreeMemoryGB ?? null
  };
}

function blocked(operation, kind, reason, resource = null) {
  return { allowed: false, operation, resourceKind: kind, reason, resource };
}

/**
 * Run one trusted local operation under a ResourceManager lease.
 * The caller supplies a fixed operation identifier and an action callback.
 * A model must never be allowed to choose this operation identifier.
 */
export async function withLocalResourceLease({ resourceManager, operation, run } = {}) {
  const kind = RESOURCE_OPERATION_KINDS[operation];
  if (!kind) throw new Error("Unsupported local resource operation.");
  if (typeof run !== "function") throw new TypeError("run must be a function.");

  if (!resourceManager || typeof resourceManager.snapshot !== "function" ||
      typeof resourceManager.acquire !== "function") {
    return blocked(operation, kind, "resource-manager-unavailable");
  }

  let snapshot;
  try {
    snapshot = await resourceManager.snapshot();
  } catch {
    return blocked(operation, kind, "resource-snapshot-failed");
  }

  const summary = resourceSummary(snapshot);
  if (!summary) return blocked(operation, kind, "resource-snapshot-invalid");

  let lease;
  try {
    lease = resourceManager.acquire(kind, snapshot);
  } catch {
    return blocked(operation, kind, "resource-acquisition-failed", summary);
  }

  if (lease?.allowed !== true) {
    return blocked(operation, kind, lease?.reason ?? "resource-lease-denied", summary);
  }
  if (typeof lease.release !== "function") {
    return blocked(operation, kind, "lease-release-unavailable", summary);
  }

  try {
    const result = await run({
      operation,
      resourceKind: kind,
      leaseId: lease.leaseId ?? null,
      resource: summary
    });
    return {
      allowed: true,
      operation,
      resourceKind: kind,
      leaseId: lease.leaseId ?? null,
      resource: summary,
      result
    };
  } finally {
    lease.release();
  }
}
