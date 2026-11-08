import test from "node:test";
import assert from "node:assert/strict";

import { createImmortalResourceProvider } from "./immortal-resource-provider-composition.mjs";

const NOW = "2026-11-08T07:15:00.000Z";

function offer(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    recordType: "cormia.core.resource-offer",
    offerId: "offer:workspace-test",
    providerRef: "provider:local-immortal",
    resourceType: "compute.local-cpu",
    capabilityProfileRef: "profile:workspace-test-v1",
    capacity: { quantity: 1, unit: "task" },
    availability: {
      notBefore: NOW,
      expiresAt: "2026-11-08T08:15:00.000Z"
    },
    privacyProfileRef: "privacy:local-only",
    offerState: "available",
    ownerAccepted: true,
    ownerAcceptanceRef: "operator:local-resource-acceptance",
    validated: true,
    validationEvidenceRefs: ["evidence:local-resource-snapshot"],
    createdAt: NOW,
    updatedAt: NOW,
    operation: "workspace-test",
    ...overrides
  };
}

function manager({ allowed = true } = {}) {
  const state = { acquired: [], released: 0 };
  return {
    state,
    resourceManager: {
      async snapshot() {
        return {
          capturedAt: NOW,
          recommendation: {
            mode: "normal",
            reason: "test",
            policy: { allowed: true },
            availableMemoryGB: 4,
            cpuUtilizationPct: 10,
            gpuFreeMemoryGB: null
          }
        };
      },
      acquire(kind) {
        state.acquired.push(kind);
        if (!allowed) return { allowed: false, reason: "cpu-heavy-denied" };
        return {
          allowed: true,
          leaseId: "resource-manager-lease-1",
          release() { state.released += 1; }
        };
      }
    }
  };
}

function provider(resourceManager, overrides = {}) {
  return createImmortalResourceProvider({
    providerRef: "provider:local-immortal",
    offers: [offer()],
    resourceManager,
    leaseTtlMs: 30_000,
    clock: () => new Date(NOW),
    idFactory: () => "cormia-lease-1",
    ...overrides
  });
}

function request(run) {
  return {
    offerId: "offer:workspace-test",
    consumerTaskRef: "task:workspace-test",
    capabilityProfileRef: "profile:workspace-test-v1",
    requestedCapacity: { quantity: 1, unit: "task" },
    run
  };
}

test("Broker-facing provider acquires and releases the fixed cpu-heavy ResourceManager lease", async () => {
  const fixture = manager();
  const localProvider = provider(fixture.resourceManager);
  let callbackContext;

  const result = await localProvider.withLease(request(async context => {
    callbackContext = context;
    assert.equal(context.lease.leaseState, "active");
    assert.equal(context.resourceKind, "cpu-heavy");
    context.assertActive();
    return { testResult: "passed" };
  }));

  assert.equal(result.allowed, true);
  assert.equal(result.lease.leaseState, "released");
  assert.deepEqual(result.result, { testResult: "passed" });
  assert.deepEqual(fixture.state.acquired, ["cpu-heavy"]);
  assert.equal(fixture.state.released, 1);
  assert.equal(callbackContext.lease.consumerTaskRef, "task:workspace-test");
});

test("denied ResourceManager admission never invokes the Broker callback", async () => {
  const fixture = manager({ allowed: false });
  const localProvider = provider(fixture.resourceManager);
  let invoked = false;

  const result = await localProvider.withLease(request(async () => {
    invoked = true;
    return "must-not-run";
  }));

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "cpu-heavy-denied");
  assert.equal(invoked, false);
  assert.equal(fixture.state.released, 0);
});

test("ResourceManager lease is released when task test execution throws", async () => {
  const fixture = manager();
  const localProvider = provider(fixture.resourceManager);

  await assert.rejects(
    localProvider.withLease(request(async () => {
      throw new Error("synthetic-test-runner-failure");
    })),
    /synthetic-test-runner-failure/
  );
  assert.equal(fixture.state.released, 1);
});

test("host offer cannot select an unmapped or arbitrary ResourceManager operation", () => {
  const fixture = manager();
  assert.throws(() => createImmortalResourceProvider({
    providerRef: "provider:local-immortal",
    offers: [offer({ operation: "shell.exec" })],
    resourceManager: fixture.resourceManager,
    leaseTtlMs: 30_000,
    clock: () => new Date(NOW)
  }), error => error.code === "RESOURCE_OPERATION_NOT_ALLOWLISTED");
});
