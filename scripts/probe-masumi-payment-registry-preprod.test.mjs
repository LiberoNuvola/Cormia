import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeMasumiPaymentRegistryProbe } from "./probe-masumi-payment-registry-preprod.mjs";

test("summarizes only aggregate Preprod registration evidence", () => {
  const secretValues = [
    "private-agent-identifier-" + "a".repeat(64),
    "private-registry-row-id",
    "private-agent-name",
    "private-seller-vkey",
    "addr_test1private-wallet",
    "f".repeat(64),
    "https://private-preprod.example"
  ];
  const summary = summarizeMasumiPaymentRegistryProbe({
    provider: "masumi-payment-service",
    network: "Preprod",
    endpoint: "https://private-preprod.example/api/v1/registry/",
    observedAt: "2026-11-20T05:00:00.000Z",
    request: { network: "Preprod", limit: 20, filterPaymentSourceType: "Web3CardanoV2", filterStatus: "Registered" },
    records: [
      {
        id: secretValues[1],
        name: secretValues[2],
        agentIdentifier: secretValues[0],
        state: "RegistrationConfirmed",
        CurrentTransaction: { txHash: secretValues[5] },
        SmartContractWallet: { walletVkey: secretValues[3], walletAddress: secretValues[4] }
      },
      {
        id: "another-private-row",
        agentIdentifier: "b".repeat(120),
        state: "UpdateConfirmed",
        CurrentTransaction: null,
        SmartContractWallet: { walletVkey: "c".repeat(56), walletAddress: "addr_test1another" }
      }
    ]
  });

  assert.deepEqual(summary, {
    status: "PASS",
    network: "Preprod",
    observedAt: "2026-11-20T05:00:00.000Z",
    requestedLimit: 20,
    exactIdentifierLookup: false,
    recordCount: 2,
    registrationConfirmed: 1,
    updateConfirmed: 1,
    recordsWithTransactionHash: 1,
    recordsWithSellerWallet: 2
  });
  const serialized = JSON.stringify(summary);
  for (const secret of secretValues) assert.equal(serialized.includes(secret), false);
});

test("rejects results not produced by the validated Preprod Payment Service adapter", () => {
  assert.throws(() => summarizeMasumiPaymentRegistryProbe(null), /validated Preprod/);
  assert.throws(() => summarizeMasumiPaymentRegistryProbe({
    provider: "masumi-registry",
    network: "Preprod",
    records: []
  }), /validated Preprod/);
  assert.throws(() => summarizeMasumiPaymentRegistryProbe({
    provider: "masumi-payment-service",
    network: "Mainnet",
    records: []
  }), /validated Preprod/);
});

test("sends no request and exits NOT_RUN when endpoint, token and acknowledgement are absent", () => {
  const env = { ...process.env };
  delete env.MASUMI_PAYMENT_SERVICE_PREPROD_URL;
  delete env.MASUMI_PAYMENT_SERVICE_PREPROD_READ_TOKEN;
  delete env.MASUMI_PAYMENT_SERVICE_PREPROD_ACK;
  delete env.MASUMI_PAYMENT_REGISTRY_AGENT_IDENTIFIER;
  const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), "probe-masumi-payment-registry-preprod.mjs");
  const child = spawnSync(process.execPath, [scriptPath], { env, encoding: "utf8", timeout: 5_000 });

  assert.equal(child.error, undefined);
  assert.equal(child.status, 2);
  assert.equal(child.stderr, "");
  assert.deepEqual(JSON.parse(child.stdout), {
    status: "NOT_RUN",
    missing: [
      "MASUMI_PAYMENT_SERVICE_PREPROD_URL",
      "MASUMI_PAYMENT_SERVICE_PREPROD_READ_TOKEN",
      "MASUMI_PAYMENT_SERVICE_PREPROD_ACK=I_ACKNOWLEDGE_SELF_HOSTED_PREPROD_READ_ONLY"
    ],
    requestSent: false,
    target: "operator-configured-self-hosted-preprod-only"
  });
});

test("does not send a credential until self-hosted Preprod is explicitly acknowledged", () => {
  const env = {
    ...process.env,
    MASUMI_PAYMENT_SERVICE_PREPROD_URL: "https://preprod-node.example/api/v1",
    MASUMI_PAYMENT_SERVICE_PREPROD_READ_TOKEN: "synthetic-secret-that-must-not-leak"
  };
  delete env.MASUMI_PAYMENT_SERVICE_PREPROD_ACK;
  const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), "probe-masumi-payment-registry-preprod.mjs");
  const child = spawnSync(process.execPath, [scriptPath], { env, encoding: "utf8", timeout: 5_000 });

  assert.equal(child.error, undefined);
  assert.equal(child.status, 2);
  assert.equal(child.stderr, "");
  const output = JSON.parse(child.stdout);
  assert.equal(output.status, "NOT_RUN");
  assert.equal(output.requestSent, false);
  assert.deepEqual(output.missing, [
    "MASUMI_PAYMENT_SERVICE_PREPROD_ACK=I_ACKNOWLEDGE_SELF_HOSTED_PREPROD_READ_ONLY"
  ]);
  assert.equal(child.stdout.includes("synthetic-secret-that-must-not-leak"), false);
  assert.equal(child.stdout.includes("preprod-node.example"), false);
});
