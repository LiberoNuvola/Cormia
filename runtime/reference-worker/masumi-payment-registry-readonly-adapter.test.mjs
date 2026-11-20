import test from "node:test";
import assert from "node:assert/strict";
import {
  createMasumiPaymentRegistryReadonlyAdapter,
  validateMasumiPaymentRegistryQuery
} from "./masumi-payment-registry-readonly-adapter.mjs";

const identifier = "a".repeat(56) + "b".repeat(64);
const record = {
  id: "registry-row-01",
  name: "Synthetic registered V2 agent",
  agentIdentifier: identifier,
  state: "RegistrationConfirmed",
  paymentSourceType: "Web3CardanoV2",
  SmartContractWallet: {
    walletVkey: "c".repeat(56),
    walletAddress: "addr_test1synthetic-selling-wallet"
  },
  CurrentTransaction: {
    txHash: "d".repeat(64),
    status: "Confirmed",
    confirmations: 18,
    blockHeight: 123456,
    blockTime: 1790000000
  },
  futureField: { retained: true }
};

function response(payload, status = 200) {
  const bytes = new TextEncoder().encode(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      }
    })
  };
}

function adapter(fetchImpl, overrides = {}) {
  return createMasumiPaymentRegistryReadonlyAdapter({
    baseUrl: "https://preprod-node.example/api/v1",
    apiKey: "synthetic-read-only-token",
    fetchImpl,
    now: () => "2026-11-20T05:00:00.000Z",
    ...overrides
  });
}

test("builds the fixed Preprod V2 Registered query and caps page size", () => {
  assert.deepEqual(validateMasumiPaymentRegistryQuery({}), {
    network: "Preprod",
    limit: 10,
    filterPaymentSourceType: "Web3CardanoV2",
    filterStatus: "Registered"
  });
  assert.deepEqual(validateMasumiPaymentRegistryQuery({
    limit: 20,
    cursorId: "cursor-1",
    agentIdentifier: identifier
  }), {
    network: "Preprod",
    limit: 20,
    filterPaymentSourceType: "Web3CardanoV2",
    filterStatus: "Registered",
    cursorId: "cursor-1",
    filterAgentIdentifier: identifier
  });
  assert.throws(() => validateMasumiPaymentRegistryQuery({ limit: 21 }), /1 to 20/);
  assert.throws(() => validateMasumiPaymentRegistryQuery({ network: "Mainnet" }), /Unsupported/);
  assert.throws(() => validateMasumiPaymentRegistryQuery({ filterStatus: "Pending" }), /Unsupported/);
  assert.throws(() => validateMasumiPaymentRegistryQuery({ agentIdentifier: "short" }), /57-250/);
});

test("calls only GET /api/v1/registry/ with token auth and fixed Preprod V2 Registered filters", async () => {
  let captured;
  const result = await adapter(async (url, options) => {
    captured = { url: new URL(url), options };
    return response(JSON.stringify({ status: "success", data: { Assets: [record] } }));
  }).queryRegistry({ limit: 5 });

  assert.equal(captured.url.origin, "https://preprod-node.example");
  assert.equal(captured.url.pathname, "/api/v1/registry/");
  assert.equal(captured.url.searchParams.get("network"), "Preprod");
  assert.equal(captured.url.searchParams.get("limit"), "5");
  assert.equal(captured.url.searchParams.get("filterPaymentSourceType"), "Web3CardanoV2");
  assert.equal(captured.url.searchParams.get("filterStatus"), "Registered");
  assert.equal(captured.options.method, "GET");
  assert.equal(captured.options.redirect, "error");
  assert.equal(captured.options.headers.token, "synthetic-read-only-token");
  assert.equal(captured.options.headers.Authorization, undefined);
  assert.equal(captured.options.body, undefined);
  assert.equal(result.records[0].agentIdentifier, identifier);
  assert.equal(result.observedAt, "2026-11-20T05:00:00.000Z");
  assert.equal(result.network, "Preprod");
});

test("supports exact V2 identifier filtering and preserves cursor pagination", async () => {
  let capturedUrl;
  const result = await adapter(async (url) => {
    capturedUrl = new URL(url);
    return response(JSON.stringify({ status: "success", data: { Assets: [record] } }));
  }).queryRegistry({ agentIdentifier: identifier, cursorId: "cursor-row", limit: 4 });

  assert.equal(capturedUrl.searchParams.get("filterAgentIdentifier"), identifier);
  assert.equal(capturedUrl.searchParams.get("filterPaymentSourceType"), "Web3CardanoV2");
  assert.equal(capturedUrl.searchParams.get("filterStatus"), "Registered");
  assert.equal(capturedUrl.searchParams.get("cursorId"), "cursor-row");
  assert.equal(result.records.length, 1);
});

test("allows loopback HTTP for an explicitly self-hosted local Payment Service", () => {
  assert.doesNotThrow(() => createMasumiPaymentRegistryReadonlyAdapter({
    baseUrl: "http://localhost:3001/api/v1",
    apiKey: "local-read-token",
    fetchImpl: async () => response(JSON.stringify({ status: "success", data: { Assets: [] } }))
  }));
  assert.doesNotThrow(() => createMasumiPaymentRegistryReadonlyAdapter({
    baseUrl: "http://127.0.0.1:3001/api/v1",
    apiKey: "local-read-token",
    fetchImpl: async () => response(JSON.stringify({ status: "success", data: { Assets: [] } }))
  }));
});

test("rejects the managed Mainnet host as a Preprod target", () => {
  assert.throws(() => createMasumiPaymentRegistryReadonlyAdapter({
    baseUrl: "https://payment.masumi.network/api/v1",
    apiKey: "token",
    fetchImpl: async () => response("{}")
  }), /Mainnet-only/);
  assert.throws(() => createMasumiPaymentRegistryReadonlyAdapter({
    baseUrl: "https://node.payment.masumi.network/api/v1",
    apiKey: "token",
    fetchImpl: async () => response("{}")
  }), /Mainnet-only/);
});

test("requires HTTPS for non-loopback hosts and an exact /api/v1 base path", () => {
  for (const baseUrl of [
    "http://preprod-node.example/api/v1",
    "https://preprod-node.example/",
    "https://preprod-node.example/api/v1/extra",
    "https://user:pass@preprod-node.example/api/v1",
    "https://preprod-node.example/api/v1?network=Mainnet",
    "https://preprod-node.example/api/v1#fragment"
  ]) {
    assert.throws(() => createMasumiPaymentRegistryReadonlyAdapter({
      baseUrl,
      apiKey: "token",
      fetchImpl: async () => response("{}")
    }));
  }
});

test("requires an operator token and rejects header injection", () => {
  for (const apiKey of [undefined, "", " token", "token ", "bad\r\nheader"]) {
    assert.throws(() => createMasumiPaymentRegistryReadonlyAdapter({
      baseUrl: "https://preprod-node.example/api/v1",
      apiKey,
      fetchImpl: async () => response("{}")
    }), /token/);
  }
});

test("accepts confirmed V2 registration and preserves additional source fields", async () => {
  const result = await adapter(async () =>
    response(JSON.stringify({ status: "success", data: { Assets: [record] } }))
  ).queryRegistry({});
  assert.deepEqual(result.records[0].futureField, { retained: true });
  assert.equal(result.records[0].CurrentTransaction.txHash, "d".repeat(64));
  assert.equal(result.records[0].SmartContractWallet.walletVkey, "c".repeat(56));
});

test("accepts confirmed V2 updates in the Registered bucket", async () => {
  const update = { ...record, state: "UpdateConfirmed" };
  const result = await adapter(async () =>
    response(JSON.stringify({ status: "success", data: { Assets: [update] } }))
  ).queryRegistry({});
  assert.equal(result.records[0].state, "UpdateConfirmed");
});

test("rejects records not in the confirmed V2 registration state/type", async () => {
  for (const invalid of [
    { ...record, state: "RegistrationRequested" },
    { ...record, state: "DeregistrationConfirmed" },
    { ...record, paymentSourceType: "Web3CardanoV1" }
  ]) {
    await assert.rejects(
      adapter(async () => response(JSON.stringify({ status: "success", data: { Assets: [invalid] } })))
        .queryRegistry({}),
      /not a complete confirmed V2 registration/
    );
  }
});

test("rejects an exact-identifier response that contains a different asset", async () => {
  const other = { ...record, agentIdentifier: "e".repeat(120) };
  await assert.rejects(
    adapter(async () => response(JSON.stringify({ status: "success", data: { Assets: [other] } })))
      .queryRegistry({ agentIdentifier: identifier }),
    /outside the requested exact identifier/
  );
});

test("rejects malformed response envelopes and records", async () => {
  for (const payload of [
    { entries: [record] },
    { status: "error", data: { Assets: [] } },
    { status: "success", data: { Assets: [null] } },
    { status: "success", data: { Assets: [{ ...record, SmartContractWallet: { walletVkey: "bad", walletAddress: "x" } }] } },
    { status: "success", data: { Assets: [{ ...record, CurrentTransaction: { txHash: "bad" } }] } }
  ]) {
    await assert.rejects(
      adapter(async () => response(JSON.stringify(payload))).queryRegistry({}),
      /response|record|CurrentTransaction/
    );
  }
});

test("does not retry alternate routes after authentication or server errors", async () => {
  let calls = 0;
  await assert.rejects(
    adapter(async () => { calls++; return response("secret detail", 401); }).queryRegistry({}),
    /HTTP 401/
  );
  assert.equal(calls, 1);
});

test("rejects invalid JSON and oversized response streams", async () => {
  await assert.rejects(
    adapter(async () => response("{")).queryRegistry({}),
    /invalid JSON/
  );
  await assert.rejects(
    adapter(async () => response(JSON.stringify({ status: "success", data: { Assets: [record] } })), {
      maxResponseBytes: 10
    }).queryRegistry({}),
    /size limit/
  );
});

test("returns no raw error body and does not disclose the API token", async () => {
  const secret = "unique-secret-token-value";
  await assert.rejects(
    createMasumiPaymentRegistryReadonlyAdapter({
      baseUrl: "https://preprod-node.example/api/v1",
      apiKey: secret,
      fetchImpl: async () => response(secret + " private server detail", 403)
    }).queryRegistry({}),
    (error) => {
      assert.equal(error.message.includes(secret), false);
      assert.equal(error.message.includes("private server detail"), false);
      return /HTTP 403/.test(error.message);
    }
  );
});
