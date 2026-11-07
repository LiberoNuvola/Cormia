import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { MODEL_PROVIDER_CONTRACT_VERSION, validateModelGenerationResponse } from "./model-provider-contract.mjs";
import { createLlamaCppModelProvider, LlamaCppAdapterError } from "./llama-cpp-model-provider.mjs";

const NOW = new Date("2026-11-07T09:00:00.000Z");
const MODEL_ID = "granite-test-alias";
const PROFILE = "profile:local-safe";

const descriptor = Object.freeze({
  contractVersion: MODEL_PROVIDER_CONTRACT_VERSION,
  providerAdapterId: "cormia.llama-cpp",
  adapterVersion: "0.1.0",
  providerInstanceRef: "provider:llama-cpp:test",
  locality: "local",
  endpointClass: "host_service",
  observedModelId: MODEL_ID,
  observedModelRevision: "test-revision",
  inferenceRuntime: { name: "llama.cpp", version: "test-build" },
  featureHints: ["structured_json"]
});

function request(overrides = {}) {
  return {
    contractVersion: MODEL_PROVIDER_CONTRACT_VERSION,
    requestRef: "request:test:1",
    taskRef: "task:test:1",
    attemptRef: "attempt:test:1",
    purpose: "reason",
    input: [
      { kind: "instruction", text: "Use only the supplied content." },
      { kind: "text", text: "Explain the test fixture." }
    ],
    outputContract: { format: "text" },
    generationProfileRef: PROFILE,
    ...overrides
  };
}

function chatResponse(overrides = {}) {
  return {
    id: "chatcmpl-test-1",
    object: "chat.completion",
    model: MODEL_ID,
    choices: [{
      index: 0,
      message: { role: "assistant", content: "A synthetic local response." },
      finish_reason: "stop"
    }],
    usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
    ...overrides
  };
}

async function startStub(handler) {
  const seen = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    let body = null;
    if (raw) {
      try { body = JSON.parse(raw); } catch { body = raw; }
    }
    seen.push({ method: req.method, url: req.url, headers: req.headers, body });
    await handler({ req, res, body, seen });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    baseUrl: "http://127.0.0.1:" + address.port,
    seen,
    close: async () => {
      server.closeAllConnections?.();
      await new Promise(resolve => server.close(resolve));
    }
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

function makeProvider(baseUrl, overrides = {}) {
  return createLlamaCppModelProvider({
    baseUrl,
    modelId: MODEL_ID,
    generationProfileRef: PROFILE,
    descriptor,
    clock: () => NOW,
    ...overrides
  });
}

function expectAdapterCode(promise, code) {
  return assert.rejects(promise, error => {
    assert.ok(error instanceof LlamaCppAdapterError);
    assert.equal(error.code, code);
    return true;
  });
}

test("pins the local descriptor and reports health from the fixed /health endpoint", async t => {
  const stub = await startStub(({ req, res }) => {
    assert.equal(req.method, "GET");
    assert.equal(req.url, "/health");
    sendJson(res, 200, { status: "ok" });
  });
  t.after(stub.close);
  const provider = makeProvider(stub.baseUrl);
  assert.deepEqual(await provider.describe(), descriptor);
  const health = await provider.health();
  assert.equal(health.status, "ready");
  assert.equal(health.providerInstanceRef, descriptor.providerInstanceRef);
  assert.equal(stub.seen.length, 1);
});

test("reports llama.cpp model loading as unavailable instead of ready", async t => {
  const stub = await startStub(({ res }) => sendJson(res, 503, {
    error: { code: 503, message: "Loading model", type: "unavailable_error" }
  }));
  t.after(stub.close);
  const health = await makeProvider(stub.baseUrl).health();
  assert.equal(health.status, "unavailable");
  assert.equal(health.reasonCode, "model_loading");
});

test("maps scoped Cormia text to fixed OpenAI-compatible chat completions without tool declarations", async t => {
  const stub = await startStub(({ req, res, body }) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/v1/chat/completions");
    assert.equal(body.model, MODEL_ID);
    assert.equal(body.stream, false);
    assert.deepEqual(body.messages, [
      { role: "system", content: "Use only the supplied content." },
      { role: "user", content: "Explain the test fixture." }
    ]);
    assert.equal("tools" in body, false);
    assert.equal("tool_choice" in body, false);
    assert.equal("apiKey" in body, false);
    assert.equal("generationProfileRef" in body, false);
    sendJson(res, 200, chatResponse());
  });
  t.after(stub.close);
  const provider = makeProvider(stub.baseUrl);
  const req = request();
  const result = await provider.generate(req);
  assert.equal(result.requestRef, req.requestRef);
  assert.equal(result.output.content, "A synthetic local response.");
  assert.equal(result.finishReason, "completed");
  assert.equal(result.usage.source, "provider_reported");
  assert.match(result.output.contentDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(validateModelGenerationResponse(result, { request: req, descriptor }).requestRef, req.requestRef);
});

test("JSON output requests JSON mode, but does not claim schema-constrained validation", async t => {
  const stub = await startStub(({ res, body }) => {
    assert.deepEqual(body.response_format, { type: "json_object" });
    sendJson(res, 200, chatResponse({
      choices: [{
        index: 0,
        message: { role: "assistant", content: "{\"answer\":42}" },
        finish_reason: "stop"
      }]
    }));
  });
  t.after(stub.close);
  const req = request({ outputContract: { format: "json", schemaRef: "schema:answer", schemaDigest: "sha256:abc" } });
  const result = await makeProvider(stub.baseUrl).generate(req);
  assert.equal(result.output.format, "json");
  assert.equal(result.output.content, "{\"answer\":42}");
});

test("provider-native tool calls are preserved as inert response data and never dispatched", async t => {
  const stub = await startStub(({ res }) => sendJson(res, 200, chatResponse({
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "call-1",
          type: "function",
          function: { name: "workspace.read", arguments: "{\"path\":\"../../.secrets\"}" }
        }]
      },
      finish_reason: "tool_calls"
    }]
  })));
  t.after(stub.close);
  const result = await makeProvider(stub.baseUrl).generate(request());
  const inert = JSON.parse(result.output.content);
  assert.equal(inert.toolCalls[0].function.name, "workspace.read");
  assert.deepEqual(result.warnings, ["provider_tool_call_data_inert"]);
  assert.equal("dispatch" in (await makeProvider(stub.baseUrl)), false);
});

test("rejects artifact references because artifact resolution belongs to Core", async t => {
  let calls = 0;
  const stub = await startStub(({ res }) => {
    calls += 1;
    sendJson(res, 200, chatResponse());
  });
  t.after(stub.close);
  const req = request({ input: [{ kind: "artifact", artifactRef: "artifact:private", artifactDigest: "sha256:abc" }] });
  await expectAdapterCode(makeProvider(stub.baseUrl).generate(req), "request_unsupported");
  assert.equal(calls, 0);
});

test("rejects a provider response whose reported model differs from the host-pinned model", async t => {
  const stub = await startStub(({ res }) => sendJson(res, 200, chatResponse({ model: "another-model" })));
  t.after(stub.close);
  await expectAdapterCode(makeProvider(stub.baseUrl).generate(request()), "provider_identity_mismatch");
});

test("maps non-success HTTP responses without leaking provider body text", async t => {
  const stub = await startStub(({ res }) => sendJson(res, 503, { error: "private internal details" }));
  t.after(stub.close);
  await assert.rejects(makeProvider(stub.baseUrl).generate(request()), error => {
    assert.equal(error.code, "provider_resource_exhausted");
    assert.equal(error.message.includes("private internal details"), false);
    return true;
  });
});

test("rejects malformed HTTP JSON as an invalid provider response", async t => {
  const stub = await startStub(({ res }) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end("{not-json");
  });
  t.after(stub.close);
  await expectAdapterCode(makeProvider(stub.baseUrl).generate(request()), "invalid_provider_response");
});

test("enforces timeout and aborts the local HTTP request", async t => {
  let connectionClosed = false;
  const stub = await startStub(({ res }) => {
    res.on("close", () => {
      if (!res.writableEnded) connectionClosed = true;
    });
    setTimeout(() => {
      if (!res.destroyed) sendJson(res, 200, chatResponse());
    }, 150);
  });
  t.after(stub.close);
  await expectAdapterCode(makeProvider(stub.baseUrl, { timeoutMs: 20 }).generate(request()), "provider_timeout");
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(connectionClosed, true);
});

test("request generation profile is host-pinned and mismatch prevents HTTP calls", async t => {
  let calls = 0;
  const stub = await startStub(({ res }) => {
    calls += 1;
    sendJson(res, 200, chatResponse());
  });
  t.after(stub.close);
  await expectAdapterCode(makeProvider(stub.baseUrl).generate(request({
    generationProfileRef: "profile:remote-or-untrusted"
  })), "request_unsupported");
  assert.equal(calls, 0);
});

test("request deadline that has already expired prevents all HTTP calls", async t => {
  let calls = 0;
  const stub = await startStub(({ res }) => {
    calls += 1;
    sendJson(res, 200, chatResponse());
  });
  t.after(stub.close);
  await expectAdapterCode(makeProvider(stub.baseUrl).generate(request({
    deadlineAt: "2026-11-07T08:59:59.000Z"
  })), "provider_timeout");
  assert.equal(calls, 0);
});

test("does not follow HTTP redirects to another endpoint", async t => {
  let calls = 0;
  const target = await startStub(({ res }) => {
    calls += 1;
    sendJson(res, 200, chatResponse());
  });
  const redirect = await startStub(({ res }) => {
    res.writeHead(302, { location: target.baseUrl + "/v1/chat/completions" });
    res.end();
  });
  t.after(async () => { await redirect.close(); await target.close(); });
  await assert.rejects(makeProvider(redirect.baseUrl).generate(request()));
  assert.equal(calls, 0);
});

test("requires loopback endpoint, matching model pin and local descriptor", () => {
  assert.throws(() => makeProvider("http://example.com:8080"));
  assert.throws(() => makeProvider("http://user:pass@127.0.0.1:8080"));
  assert.throws(() => makeProvider("https://127.0.0.1:8080"));
  assert.throws(() => createLlamaCppModelProvider({
    baseUrl: "http://127.0.0.1:8080",
    modelId: "other-model",
    generationProfileRef: PROFILE,
    descriptor
  }));
  assert.throws(() => createLlamaCppModelProvider({
    baseUrl: "http://127.0.0.1:8080",
    modelId: MODEL_ID,
    generationProfileRef: PROFILE,
    descriptor: { ...descriptor, locality: "remote" }
  }));
});

test("sends a host-configured API key only as an internal authorization header", async t => {
  const stub = await startStub(({ res, req, body }) => {
    assert.equal(req.headers.authorization, "Bearer host-secret-key");
    assert.equal(JSON.stringify(body).includes("host-secret-key"), false);
    sendJson(res, 200, chatResponse());
  });
  t.after(stub.close);
  await makeProvider(stub.baseUrl, { apiKey: "host-secret-key" }).generate(request());
});

test("cancellation explicitly reports unsupported instead of claiming a server-side cancel", async t => {
  const stub = await startStub(({ res }) => sendJson(res, 200, chatResponse()));
  t.after(stub.close);
  const provider = makeProvider(stub.baseUrl);
  assert.deepEqual(await provider.cancel("chatcmpl-test-1"), {
    providerRequestRef: "chatcmpl-test-1",
    status: "unsupported"
  });
});

test("resource usage and finish reasons are normalized conservatively", async t => {
  const stub = await startStub(({ res }) => sendJson(res, 200, chatResponse({
    choices: [{
      index: 0,
      message: { role: "assistant", content: "Partial answer." },
      finish_reason: "length"
    }]
  })));
  t.after(stub.close);
  await expectAdapterCode(makeProvider(stub.baseUrl).generate(request()), "generation_truncated");
});
