import test from "node:test";
import assert from "node:assert/strict";
import {
  RESOURCE_OPERATION_KINDS,
  withLocalResourceLease
} from "./immortal-resource-manager-adapter.mjs";

function snapshot() {
  return {
    capturedAt: "2026-11-02T14:00:00.000Z",
    host: { platform: "win32", architecture: "x64", totalMemoryBytes: 32 },
    recommendation: {
      mode: "balanced",
      reason: "sufficient headroom",
      availableMemoryGB: 8,
      cpuUtilizationPct: 20,
      gpuFreeMemoryGB: 5,
      policy: { maxConcurrentLocalModels: 1, maxConcurrentHeavyBuilds: 1 }
    }
  };
}

function fakeManager({ allowed = true, throwSnapshot = false } = {}) {
  const calls = { snapshot: 0, acquire: [], released: 0 };
  return {
    calls,
    async snapshot() {
      calls.snapshot++;
      if (throwSnapshot) throw new Error("telemetry unavailable");
      return snapshot();
    },
    acquire(kind, value) {
      calls.acquire.push({ kind, sameSnapshot: value === currentSnapshot });
      return {
        allowed,
        reason: allowed ? "allowed" : "busy",
        leaseId: allowed ? "lease-test-1" : null,
        release: allowed ? () => { calls.released++; return true; } : null
      };
    }
  };
}

let currentSnapshot;
test("maps only trusted local operations to fixed ResourceManager classes", () => {
  assert.deepEqual(RESOURCE_OPERATION_KINDS, {
    "agent-inference": "model-inference",
    "workspace-test": "cpu-heavy",
    "evolution-docker-test": "cpu-heavy"
  });
});

test("acquires model-inference for agent inference and releases after success", async () => {
  const calls = { snapshot: 0, kinds: [], released: 0 };
  const manager = {
    async snapshot() { calls.snapshot++; currentSnapshot = snapshot(); return currentSnapshot; },
    acquire(kind, value) {
      calls.kinds.push(kind);
      assert.equal(value, currentSnapshot);
      return { allowed: true, leaseId: "lease-1", release() { calls.released++; } };
    }
  };
  let ran = false;
  const result = await withLocalResourceLease({
    resourceManager: manager,
    operation: "agent-inference",
    run: async context => { ran = true; assert.equal(context.resourceKind, "model-inference"); return "ok"; }
  });
  assert.equal(result.allowed, true);
  assert.equal(result.result, "ok");
  assert.equal(ran, true);
  assert.deepEqual(calls, { snapshot: 1, kinds: ["model-inference"], released: 1 });
});

test("maps workspace and evolution Docker tests to cpu-heavy", async () => {
  for (const operation of ["workspace-test", "evolution-docker-test"]) {
    let kind = null;
    const manager = {
      async snapshot() { currentSnapshot = snapshot(); return currentSnapshot; },
      acquire(resourceKind) { kind = resourceKind; return { allowed: true, release() {} }; }
    };
    await withLocalResourceLease({ resourceManager: manager, operation, run: async () => true });
    assert.equal(kind, "cpu-heavy");
  }
});

test("does not run the operation when ResourceManager denies the lease", async () => {
  const manager = {
    async snapshot() { currentSnapshot = snapshot(); return currentSnapshot; },
    acquire() { return { allowed: false, reason: "resource busy", leaseId: null, release: null }; }
  };
  let ran = false;
  const result = await withLocalResourceLease({
    resourceManager: manager,
    operation: "workspace-test",
    run: async () => { ran = true; }
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "resource busy");
  assert.equal(ran, false);
});

test("fails closed if ResourceManager is absent or snapshot sampling fails", async () => {
  const missing = await withLocalResourceLease({
    resourceManager: null,
    operation: "agent-inference",
    run: async () => "must not run"
  });
  assert.equal(missing.reason, "resource-manager-unavailable");

  const failedSnapshot = await withLocalResourceLease({
    resourceManager: { async snapshot() { throw new Error("no telemetry"); }, acquire() { throw new Error("must not acquire"); } },
    operation: "agent-inference",
    run: async () => "must not run"
  });
  assert.equal(failedSnapshot.reason, "resource-snapshot-failed");
});

test("releases the lease if the protected action throws", async () => {
  let released = 0;
  const manager = {
    async snapshot() { currentSnapshot = snapshot(); return currentSnapshot; },
    acquire() { return { allowed: true, release() { released++; } }; }
  };
  await assert.rejects(() => withLocalResourceLease({
    resourceManager: manager,
    operation: "workspace-test",
    run: async () => { throw new Error("test failed"); }
  }), /test failed/);
  assert.equal(released, 1);
});

test("rejects unknown operations instead of accepting a caller-provided resource class", async () => {
  await assert.rejects(() => withLocalResourceLease({
    resourceManager: { async snapshot() { return snapshot(); }, acquire() { throw new Error("must not acquire"); } },
    operation: "gpu-heavy",
    kind: "gpu-heavy",
    run: async () => true
  }), /Unsupported local resource operation/);
});

test("returns only a bounded resource summary, not full host telemetry", async () => {
  const manager = {
    async snapshot() { currentSnapshot = snapshot(); return currentSnapshot; },
    acquire() { return { allowed: true, release() {} }; }
  };
  const result = await withLocalResourceLease({ resourceManager: manager, operation: "agent-inference", run: async () => true });
  assert.equal(result.resource.mode, "balanced");
  assert.equal("host" in result.resource, false);
  assert.equal("totalMemoryBytes" in result.resource, false);
});
