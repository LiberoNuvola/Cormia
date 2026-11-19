import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

test("sends no request and exits NOT_RUN when required credentials are absent", () => {
  const env = { ...process.env };
  delete env.MASUMI_REGISTRY_READONLY_TOKEN;
  env.MASUMI_REGISTRY_ORIGIN = "https://attacker.example";
  const scriptPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "probe-masumi-registry-preprod.mjs"
  );
  const child = spawnSync(process.execPath, [scriptPath], {
    env,
    encoding: "utf8",
    timeout: 5_000
  });

  assert.equal(child.error, undefined);
  assert.equal(child.status, 2);
  assert.equal(child.stderr, "");
  assert.deepEqual(JSON.parse(child.stdout), {
    status: "NOT_RUN",
    missing: [
      "MASUMI_REGISTRY_READONLY_TOKEN",
      "MASUMI_REGISTRY_PUBLIC_TEST_ACK=I_ACKNOWLEDGE_PUBLIC_TEST_ENDPOINT"
    ],
    requestSent: false,
    registryOrigin: "https://registry.masumi.network",
    endpointClass: "public-testing-development"
  });
});

test("does not send a credential until the public-test endpoint is explicitly acknowledged", () => {
  const secret = "synthetic-token-must-not-appear";
  const env = { ...process.env, MASUMI_REGISTRY_READONLY_TOKEN: secret };
  delete env.MASUMI_REGISTRY_PUBLIC_TEST_ACK;
  env.MASUMI_REGISTRY_ORIGIN = "https://attacker.example";
  const scriptPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "probe-masumi-registry-preprod.mjs"
  );
  const child = spawnSync(process.execPath, [scriptPath], {
    env,
    encoding: "utf8",
    timeout: 5_000
  });

  assert.equal(child.error, undefined);
  assert.equal(child.status, 2);
  assert.equal(child.stderr, "");
  const output = JSON.parse(child.stdout);
  assert.equal(output.status, "NOT_RUN");
  assert.equal(output.requestSent, false);
  assert.deepEqual(output.missing, [
    "MASUMI_REGISTRY_PUBLIC_TEST_ACK=I_ACKNOWLEDGE_PUBLIC_TEST_ENDPOINT"
  ]);
  assert.equal(output.registryOrigin, "https://registry.masumi.network");
  assert.equal(child.stdout.includes(secret), false);
});

test("rejects invalid or non-Preprod probe results", () => {
  assert.throws(() => summarizeMasumiRegistryProbe(null), /validated Preprod/);
  assert.throws(() => summarizeMasumiRegistryProbe({
    network: "Mainnet",
    entries: []
  }), /validated Preprod/);
});
