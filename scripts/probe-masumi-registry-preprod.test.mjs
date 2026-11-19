import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMasumiRegistryProbe } from "./probe-masumi-registry-preprod.mjs";

test("summarizes only aggregate Preprod evidence and omits raw identities", () => {
  const privateIdentifier = "sensitive-agent-identifier";
  const privatePolicyId = "sensitive-policy-id";
  const summary = summarizeMasumiRegistryProbe({
    network: "Preprod",
    observedAt: "2026-11-19T05:00:00.000Z",
    request: { network: "Preprod", limit: 1 },
    entries: [
      {
        agentIdentifier: privateIdentifier,
        status: "Online",
        RegistrySource: { policyId: privatePolicyId },
        name: "Private name",
        apiBaseUrl: "https://private.example"
      },
      {
        agentIdentifier: "another-id",
        status: "Offline",
        RegistrySource: { policyId: null },
        name: "Another private name"
      }
    ]
  });

  assert.deepEqual(summary, {
    status: "PASS",
    network: "Preprod",
    observedAt: "2026-11-19T05:00:00.000Z",
    requestLimit: 1,
    entryCount: 2,
    entriesWithIdentifier: 2,
    entriesWithPolicyId: 1,
    onlineEntries: 1
  });

  const serialized = JSON.stringify(summary);
  for (const privateValue of [
    privateIdentifier,
    privatePolicyId,
    "Private name",
    "Another private name",
    "private.example"
  ]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});

test("rejects invalid or non-Preprod probe results", () => {
  assert.throws(() => summarizeMasumiRegistryProbe(null), /validated Preprod/);
  assert.throws(() => summarizeMasumiRegistryProbe({
    network: "Mainnet",
    entries: []
  }), /validated Preprod/);
});
