import test from "node:test";
import assert from "node:assert/strict";
import { createLocalResourceProvider } from "./local-resource-provider.mjs";

const BASE = Date.parse("2026-11-03T10:00:00.000Z");
const ISO = value => new Date(value).toISOString();

function makeOffer(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    recordType: "cormia.core.resource-offer",
    offerId: "offer:cpu-1",
    providerRef: "provider:host-a",
    resourceType: "compute.local.cpu",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    capacity: { quantity: 1, unit: "concurrent-operation" },
    availability: {
      notBefore: ISO(BASE - 1_000),
      expiresAt: ISO(BASE + 60_000)
    },
    privacyProfileRef: "privacy:local-only",
    offerState: "available",
    ownerAccepted: true,
    ownerAcceptanceRef: "evidence:owner-acceptance-1",
    validated: true,
    validationEvidenceRefs: ["evidence:local-resource-validation-1"],
    createdAt: ISO(BASE - 2_000),
    updatedAt: ISO(BASE - 1_000),
    // Host-only mapping. It is removed from the public Resource Offer record.
    operation: "workspace-test",
    ...overrides
  };
}

function makeExecutor({ calls = [], allowed = true, beforeRun, onRelease } = {}) {
  return async ({ operation, run }) => {
    calls.push(operation);
    if (beforeRun) await beforeRun();
    let released = false;
    try {
      if (!allowed) return { allowed: false, reason: "host-resource-denied" };
      const result = await run({
        leaseId: "host-lease:1",
        resourceKind: "cpu-heavy",
        resource: { mode: "balanced", availableMemoryGB: 8 }
      });
      return {
        allowed: true,
        leaseId: "host-lease:1",
        resource: { mode: "balanced", availableMemoryGB: 8 },
        result
      };
    } finally {
      released = true;
      onRelease?.(released);
    }
  };
}

function makeProvider({
  offer = makeOffer(),
  executeWithLocalLease = makeExecutor(),
  leaseTtlMs = 30_000,
  clock = () => new Date(BASE),
  idFactory = () => "lease:cormia-1"
} = {}) {
  return createLocalResourceProvider({
    providerRef: "provider:host-a",
    offers: [offer],
    executeWithLocalLease,
    leaseTtlMs,
    clock,
    idFactory
  });
}

test("discovers only eligible local offers and never exposes the host operation mapping", () => {
  const provider = makeProvider();
  const offers = provider.discover();
  assert.equal(offers.length, 1);
  assert.equal(offers[0].offerId, "offer:cpu-1");
  assert.equal(offers[0].offerState, "available");
  assert.equal("operation" in offers[0], false);
  assert.equal("host" in offers[0], false);
  assert.equal(provider.discover({ resourceType: "compute.local.gpu" }).length, 0);
  assert.equal(
    provider.discover({ capabilityProfileRef: "profile:other" }).length,
    0
  );
});

test("inspection returns a sanitized versioned offer", () => {
  const provider = makeProvider();
  const offer = provider.inspect("offer:cpu-1");
  assert.equal(offer.recordType, "cormia.core.resource-offer");
  assert.equal(offer.providerRef, "provider:host-a");
  assert.equal(offer.ownerAccepted, true);
  assert.equal(offer.validated, true);
  assert.deepEqual(offer.validationEvidenceRefs, ["evidence:local-resource-validation-1"]);
  assert.equal("operation" in offer, false);
  assert.equal(provider.inspect("offer:missing"), null);
});

test("issues a task-bound callback-scoped lease and returns a released receipt", async () => {
  const calls = [];
  const provider = makeProvider({ executeWithLocalLease: makeExecutor({ calls }) });
  let taskResult = null;
  const result = await provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:build-17",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    run: async ({ lease, resource, resourceKind, assertActive }) => {
      assert.equal(lease.leaseState, "active");
      assert.equal(lease.consumerTaskRef, "task:build-17");
      assert.equal(lease.capabilityProfileRef, "profile:workspace-test-v0.1");
      assert.equal(resourceKind, "cpu-heavy");
      assert.equal(resource.mode, "balanced");
      assert.equal(assertActive(), true);
      taskResult = "tests-passed";
      return taskResult;
    }
  });

  assert.deepEqual(calls, ["workspace-test"]);
  assert.equal(result.allowed, true);
  assert.equal(result.result, "tests-passed");
  assert.equal(result.lease.leaseState, "released");
  assert.equal(result.lease.leaseId, "lease:cormia-1");
  assert.equal(result.lease.offerId, "offer:cpu-1");
  assert.equal(result.lease.consumerTaskRef, "task:build-17");
  assert.equal(result.lease.releasedAt, ISO(BASE));
  assert.equal("operation" in result.lease, false);
  assert.equal(taskResult, "tests-passed");
});

test("does not let a caller select the ResourceManager operation or resource class", async () => {
  const provider = makeProvider();
  await assert.rejects(() => provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:1",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    operation: "gpu-heavy",
    run: async () => true
  }), /caller-cannot-select-resource-operation/);
  await assert.rejects(() => provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:1",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    resourceKind: "gpu-heavy",
    run: async () => true
  }), /caller-cannot-select-resource-operation/);
});

test("rejects mismatched capability profiles and capacity beyond the offer", async () => {
  const calls = [];
  const provider = makeProvider({ executeWithLocalLease: makeExecutor({ calls }) });
  const wrongProfile = await provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:1",
    capabilityProfileRef: "profile:other",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    run: async () => true
  });
  const tooMuch = await provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:1",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 2, unit: "concurrent-operation" },
    run: async () => true
  });
  assert.equal(wrongProfile.reason, "capability-profile-mismatch");
  assert.equal(tooMuch.reason, "requested-capacity-exceeds-offer");
  assert.deepEqual(calls, []);
});

test("fails closed when host ResourceManager admission denies the lease", async () => {
  let ran = false;
  const provider = makeProvider({
    executeWithLocalLease: makeExecutor({ allowed: false })
  });
  const result = await provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:blocked",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    run: async () => { ran = true; }
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "host-resource-denied");
  assert.equal(ran, false);
});

test("does not dispatch before an offer's notBefore time or after expiry", async () => {
  let time = BASE;
  const future = makeOffer({
    availability: {
      notBefore: ISO(BASE + 10_000),
      expiresAt: ISO(BASE + 60_000)
    }
  });
  const provider = makeProvider({ offer: future, clock: () => new Date(time) });
  assert.equal(provider.inspect("offer:cpu-1").offerState, "accepted");
  assert.equal(provider.discover().length, 0);
  time = BASE + 60_000;
  assert.equal(provider.inspect("offer:cpu-1").offerState, "expired");
});

test("owner revocation prevents new leases", async () => {
  const calls = [];
  const provider = makeProvider({ executeWithLocalLease: makeExecutor({ calls }) });
  const revoked = provider.revokeOffer("offer:cpu-1");
  assert.equal(revoked.revoked, true);
  assert.equal(provider.inspect("offer:cpu-1").offerState, "revoked");
  assert.equal(provider.discover().length, 0);
  const result = await provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:after-revoke",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    run: async () => true
  });
  assert.equal(result.reason, "offer-revoked");
  assert.deepEqual(calls, []);
});

test("the running executor must recheck lease validity at each side-effect boundary", async () => {
  let time = BASE;
  let released = false;
  const executor = makeExecutor({
    onRelease: value => { released = value; }
  });
  const provider = makeProvider({
    executeWithLocalLease: executor,
    leaseTtlMs: 5_000,
    clock: () => new Date(time)
  });
  await assert.rejects(() => provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:expires-mid-run",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    run: async ({ assertActive }) => {
      assert.equal(assertActive(), true);
      time = BASE + 5_000;
      assertActive();
      return "must-not-complete";
    }
  }), /local-resource-lease-expired/);
  assert.equal(released, true);
});

test("revocation during a running task blocks its next protected operation", async () => {
  let provider;
  let released = false;
  provider = makeProvider({
    executeWithLocalLease: makeExecutor({
      onRelease: value => { released = value; }
    })
  });
  await assert.rejects(() => provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:revoked-mid-run",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    run: async ({ assertActive }) => {
      assert.equal(assertActive(), true);
      provider.revokeOffer("offer:cpu-1");
      assertActive();
      return "must-not-complete";
    }
  }), /local-resource-offer-revoked/);
  assert.equal(released, true);
});

test("does not report success if the lease expires before callback completion", async () => {
  let time = BASE;
  const provider = makeProvider({
    leaseTtlMs: 2_000,
    clock: () => new Date(time)
  });
  await assert.rejects(() => provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:late-completion",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    run: async () => {
      time = BASE + 2_000;
      return "late";
    }
  }), /local-resource-lease-expired/);
});

test("rethrows execution failures so the trusted task journal can record the failed attempt", async () => {
  let released = false;
  const provider = makeProvider({
    executeWithLocalLease: makeExecutor({
      onRelease: value => { released = value; }
    })
  });
  await assert.rejects(() => provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:failed",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    run: async () => { throw new Error("task execution failed"); }
  }), /task execution failed/);
  assert.equal(released, true);
});

test("rejects owner-unaccepted, unvalidated or evidence-free offers", () => {
  assert.throws(() => makeProvider({ offer: makeOffer({ ownerAccepted: false }) }),
    /owner-accepted-and-validated/);
  assert.throws(() => makeProvider({ offer: makeOffer({ validated: false }) }),
    /owner-accepted-and-validated/);
  assert.throws(() => makeProvider({ offer: makeOffer({ validationEvidenceRefs: [] }) }),
    /requires-evidence-references/);
});

test("rejects malformed, mismatched and duplicate provider offers", () => {
  assert.throws(() => makeProvider({ offer: makeOffer({ providerRef: "provider:other" }) }),
    /offer-provider-mismatch/);
  assert.throws(() => makeProvider({ offer: makeOffer({ resourceType: "CPU" }) }),
    /dotted identifier/);
  assert.throws(() => createLocalResourceProvider({
    providerRef: "provider:host-a",
    offers: [makeOffer(), makeOffer()],
    executeWithLocalLease: makeExecutor(),
    leaseTtlMs: 1_000
  }), /duplicate-local-resource-offer-id/);
});

test("requires an explicit host lease duration and trusted execution port", () => {
  assert.throws(() => createLocalResourceProvider({
    providerRef: "provider:host-a",
    offers: [makeOffer()],
    executeWithLocalLease: makeExecutor()
  }), /leaseTtlMs/);
  assert.throws(() => createLocalResourceProvider({
    providerRef: "provider:host-a",
    offers: [makeOffer()],
    leaseTtlMs: 1_000
  }), /executeWithLocalLease/);
});

test("composes with the existing fixed-operation ResourceManager compatibility wrapper", async () => {
  const { withLocalResourceLease } = await import("../reference-worker/immortal-resource-manager-adapter.mjs");
  let released = 0;
  const resourceManager = {
    async snapshot() {
      return {
        capturedAt: ISO(BASE),
        host: { platform: "win32", architecture: "x64", totalMemoryBytes: 32 },
        recommendation: {
          mode: "balanced",
          reason: "test headroom",
          availableMemoryGB: 8,
          cpuUtilizationPct: 20,
          gpuFreeMemoryGB: 5,
          policy: { maxConcurrentHeavyBuilds: 1 }
        }
      };
    },
    acquire(kind) {
      assert.equal(kind, "cpu-heavy");
      return {
        allowed: true,
        leaseId: "resource-manager-lease-1",
        release() { released++; }
      };
    }
  };
  const provider = makeProvider({
    executeWithLocalLease: args => withLocalResourceLease({
      resourceManager,
      operation: args.operation,
      run: args.run
    })
  });
  const result = await provider.withLease({
    offerId: "offer:cpu-1",
    consumerTaskRef: "task:integrated-adapter",
    capabilityProfileRef: "profile:workspace-test-v0.1",
    requestedCapacity: { quantity: 1, unit: "concurrent-operation" },
    run: async ({ lease, resourceKind, assertActive }) => {
      assert.equal(lease.leaseState, "active");
      assert.equal(resourceKind, "cpu-heavy");
      assert.equal(assertActive(), true);
      return "integrated";
    }
  });
  assert.equal(result.allowed, true);
  assert.equal(result.result, "integrated");
  assert.equal(result.lease.leaseState, "released");
  assert.equal(released, 1);
});
