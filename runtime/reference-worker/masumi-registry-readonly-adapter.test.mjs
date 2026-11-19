import test from "node:test";
import assert from "node:assert/strict";
import {
  createMasumiRegistryReadonlyAdapter,
  validateMasumiRegistryQuery
} from "./masumi-registry-readonly-adapter.mjs";

const entry = {
  agentIdentifier: "a".repeat(64),
  status: "Online",
  RegistrySource: { policyId: "b".repeat(56), url: "https://registry.example" },
  name: "Synthetic test agent",
  type: "Standard",
  apiBaseUrl: "https://provider.example"
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
  return createMasumiRegistryReadonlyAdapter({
    baseUrl: "https://registry.example",
    apiKey: "test-read-only-secret",
    authHeaderName: "token",
    fetchImpl,
    now: () => "2026-11-18T12:00:00.000Z",
    ...overrides
  });
}

test("validates a narrow Preprod query and applies the local limit", () => {
  assert.deepEqual(validateMasumiRegistryQuery({
    network: "Preprod",
    filter: { status: ["Online"], capability: { name: "text-processing" } }
  }), {
    network: "Preprod",
    limit: 10,
    filter: { status: ["Online"], capability: { name: "text-processing" } }
  });
  assert.throws(() => validateMasumiRegistryQuery({ network: "Mainnet" }), /Preprod/);
  assert.throws(() => validateMasumiRegistryQuery({ network: "Preprod", limit: 21 }), /1 to 20/);
  assert.throws(() => validateMasumiRegistryQuery({ network: "Preprod", filter: { health: { onlyOnline: true } } }), /Unsupported Registry filter/);
});

test("calls only the fixed Registry query route with the explicitly selected auth header", async () => {
  let captured;
  const result = await adapter(async (url, options) => {
    captured = { url, options };
    return response(JSON.stringify({ entries: [entry] }));
  }).queryRegistry({ network: "Preprod", limit: 5 });
  assert.equal(captured.url, "https://registry.example/api/v1/registry-entry/");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.redirect, "error");
  assert.equal(captured.options.headers.token, "test-read-only-secret");
  assert.equal(captured.options.headers["API-Key"], undefined);
  assert.deepEqual(JSON.parse(captured.options.body), { network: "Preprod", limit: 5 });
  assert.equal(result.entries[0].agentIdentifier, entry.agentIdentifier);
  assert.equal(result.observedAt, "2026-11-18T12:00:00.000Z");
});

test("allows API-Key only when explicitly configured and never probes fallback headers", async () => {
  let headers;
  const result = await adapter(async (_url, options) => {
    headers = options.headers;
    return response(JSON.stringify({ entries: [] }));
  }, { authHeaderName: "API-Key" }).queryRegistry({ network: "Preprod" });
  assert.equal(headers["API-Key"], "test-read-only-secret");
  assert.equal(headers.token, undefined);
  assert.deepEqual(result.entries, []);
});

test("requires an explicit auth header and rejects unknown header names", () => {
  assert.throws(() => createMasumiRegistryReadonlyAdapter({
    baseUrl: "https://registry.example", apiKey: "secret", fetchImpl: async () => response("{}")
  }), /authHeaderName/);
  assert.throws(() => adapter(async () => response("{}"), { authHeaderName: "x-api-key" }), /authHeaderName/);
});

test("rejects non-origin base URLs and non-HTTPS origins", () => {
  assert.throws(() => adapter(async () => response("{}"), { baseUrl: "http://registry.example" }), /HTTPS origin/);
  assert.throws(() => adapter(async () => response("{}"), { baseUrl: "https://registry.example/path" }), /HTTPS origin/);
  assert.throws(() => adapter(async () => response("{}"), { baseUrl: "https://user:pass@registry.example" }), /HTTPS origin/);
});

test("rejects failed HTTP responses without attempting alternate routes", async () => {
  let calls = 0;
  await assert.rejects(
    adapter(async () => { calls++; return response("denied", 401); })
      .queryRegistry({ network: "Preprod" }),
    /HTTP 401/
  );
  assert.equal(calls, 1);
});

test("rejects invalid JSON and malformed registry entries", async () => {
  await assert.rejects(adapter(async () => response("{")).queryRegistry({ network: "Preprod" }), /invalid JSON/);
  await assert.rejects(adapter(async () => response(JSON.stringify({ entries: [{ ...entry, agentIdentifier: "" }] })))
    .queryRegistry({ network: "Preprod" }), /missing required identity/);
});

test("enforces a bounded response size", async () => {
  await assert.rejects(
    adapter(async () => response(JSON.stringify({ entries: [entry] })), { maxResponseBytes: 10 })
      .queryRegistry({ network: "Preprod" }),
    /size limit/
  );
});

test("reassembles fragmented UTF-8 chunks within the exact byte limit", async () => {
  const expectedName = "Caffè ☕";
  const payload = JSON.stringify({ entries: [{ ...entry, name: expectedName }] });
  const encoded = new TextEncoder().encode(payload);
  const fragmentedBody = new ReadableStream({
    start(controller) {
      for (const byte of encoded) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    }
  });
  const result = await adapter(async () => ({
    ok: true,
    status: 200,
    body: fragmentedBody
  }), { maxResponseBytes: encoded.byteLength }).queryRegistry({ network: "Preprod" });
  assert.equal(result.entries[0].name, expectedName);
});

test("cancels a streamed response as soon as the byte limit is crossed", async () => {
  let cancelled = false;
  const oversizedStream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(32));
    },
    cancel() {
      cancelled = true;
    }
  });
  await assert.rejects(
    adapter(async () => ({ ok: true, status: 200, body: oversizedStream }), { maxResponseBytes: 16 })
      .queryRegistry({ network: "Preprod" }),
    /size limit/
  );
  assert.equal(cancelled, true);
});

test("rejects non-object input and unsupported request fields", () => {
  assert.throws(() => validateMasumiRegistryQuery(null), /object/);
  assert.throws(() => validateMasumiRegistryQuery({ network: "Preprod", query: "agent" }), /Unsupported Registry query field/);
  assert.throws(() => validateMasumiRegistryQuery({ network: "Preprod", cursorId: "" }), /cursorId/);
});

test("preserves unknown response fields without granting trust or calling provider endpoints", async () => {
  let calls = 0;
  const payload = { entries: [{ ...entry, futureField: { retained: true } }] };
  const result = await adapter(async () => { calls++; return response(JSON.stringify(payload)); })
    .queryRegistry({ network: "Preprod" });
  assert.deepEqual(result.entries[0].futureField, { retained: true });
  assert.equal(calls, 1);
});
