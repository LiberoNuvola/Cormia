import test from "node:test";
import assert from "node:assert/strict";
import {
  ColibriAdapterError,
  createColibriInferenceAdapter
} from "./colibri-inference-adapter.mjs";

const tool = {
  type: "function",
  function: {
    name: "read_project_status",
    description: "Read a bounded project status.",
    parameters: { type: "object", properties: {}, additionalProperties: false }
  }
};

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("accepts only explicit loopback /v1 endpoints", () => {
  assert.doesNotThrow(() => createColibriInferenceAdapter({ modelId: "glm-5.2-colibri" }));
  assert.doesNotThrow(() => createColibriInferenceAdapter({ baseUrl: "http://localhost:8000/v1/", modelId: "qwen36" }));
  assert.doesNotThrow(() => createColibriInferenceAdapter({ baseUrl: "http://[::1]:8000/v1", modelId: "qwen36" }));
  for (const baseUrl of [
    "https://example.com/v1",
    "http://192.168.1.20:8000/v1",
    "http://127.0.0.1:8000/",
    "http://user:secret@127.0.0.1:8000/v1",
    "http://127.0.0.1:8000/v1?redirect=https://example.com"
  ]) {
    assert.throws(() => createColibriInferenceAdapter({ baseUrl, modelId: "glm-5.2-colibri" }), TypeError);
  }
});

test("lists model IDs through the fixed OpenAI-compatible endpoint", async () => {
  let captured;
  const adapter = createColibriInferenceAdapter({
    modelId: "glm-5.2-colibri",
    apiKey: "host-held-secret",
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response({ object: "list", data: [{ id: "glm-5.2-colibri" }, { id: "other" }] });
    }
  });
  assert.deepEqual(await adapter.listModels(), ["glm-5.2-colibri", "other"]);
  assert.equal(captured.url, "http://127.0.0.1:8000/v1/models");
  assert.equal(captured.options.method, "GET");
  assert.equal(captured.options.headers.authorization, "Bearer host-held-secret");
  assert.equal(captured.options.redirect, "error");
});

test("sends non-streaming chat and strict GLM tool-call requests without executing tools", async () => {
  let captured;
  let executed = 0;
  const adapter = createColibriInferenceAdapter({
    modelId: "glm-5.2-colibri",
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return response({
        id: "chatcmpl-local-1",
        model: "glm-5.2-colibri",
        choices: [{
          index: 0,
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{ id: "call_1", type: "function", function: { name: "read_project_status", arguments: "{}" } }]
          }
        }],
        usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 }
      });
    }
  });

  const result = await adapter.chatCompletion({
    messages: [{ role: "user", content: "Read project status." }],
    tools: [tool],
    toolChoice: "required",
    strictToolCalls: true,
    maxTokens: 256,
    temperature: 0
  });

  assert.equal(captured.url, "http://127.0.0.1:8000/v1/chat/completions");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.body.model, "glm-5.2-colibri");
  assert.equal(captured.body.stream, false);
  assert.equal(captured.body.strict_tool_calls, true);
  assert.equal(captured.body.tool_choice, "required");
  assert.equal(captured.body.max_tokens, 256);
  assert.equal(captured.body.temperature, 0);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.complete, true);
  assert.deepEqual(result.usage, { promptTokens: 12, completionTokens: 3, totalTokens: 15 });
  assert.equal(executed, 0, "adapter must not execute model-proposed tools");
});

test("marks length-truncated generations incomplete", async () => {
  const adapter = createColibriInferenceAdapter({
    modelId: "glm-5.2-colibri",
    fetchImpl: async () => response({
      choices: [{ finish_reason: "length", message: { role: "assistant", content: "partial" } }]
    })
  });
  const result = await adapter.chatCompletion({ messages: [{ role: "user", content: "hello" }] });
  assert.equal(result.complete, false);
  assert.equal(result.finishReason, "length");
});

test("does not leak upstream error bodies into Cormia errors", async () => {
  const adapter = createColibriInferenceAdapter({
    modelId: "glm-5.2-colibri",
    fetchImpl: async () => response({ error: { code: "invalid_model_tool_call", message: "PRIVATE PROMPT ECHO" } }, 502)
  });
  await assert.rejects(
    () => adapter.chatCompletion({ messages: [{ role: "user", content: "hello" }] }),
    error => error instanceof ColibriAdapterError &&
      error.code === "invalid_model_tool_call" &&
      error.status === 502 &&
      !error.message.includes("PRIVATE PROMPT ECHO")
  );
});

test("rejects malformed API responses", async () => {
  const adapter = createColibriInferenceAdapter({
    modelId: "glm-5.2-colibri",
    fetchImpl: async () => response({ choices: [] })
  });
  await assert.rejects(
    () => adapter.chatCompletion({ messages: [{ role: "user", content: "hello" }] }),
    error => error instanceof ColibriAdapterError && error.code === "invalid-completion"
  );
});

test("validates request shape and strict tool-call preconditions before network access", async () => {
  let calls = 0;
  const adapter = createColibriInferenceAdapter({ modelId: "glm-5.2-colibri", fetchImpl: async () => { calls++; } });
  await assert.rejects(() => adapter.chatCompletion({ messages: [] }), TypeError);
  await assert.rejects(() => adapter.chatCompletion({ messages: [{ role: "user", content: "hi" }], strictToolCalls: true }), /requires at least one declared/);
  await assert.rejects(() => adapter.chatCompletion({ messages: [{ role: "user", content: "hi" }], temperature: 3 }), /temperature/);
  assert.equal(calls, 0);
});

test("maps transport timeout/failure to bounded adapter errors", async () => {
  const adapter = createColibriInferenceAdapter({
    modelId: "glm-5.2-colibri",
    fetchImpl: async () => { throw Object.assign(new Error("timed out"), { name: "TimeoutError" }); }
  });
  await assert.rejects(
    () => adapter.listModels(),
    error => error instanceof ColibriAdapterError && error.code === "request-timeout"
  );
});

test("enforces the configured timeout even when the caller supplies an AbortSignal", async () => {
  const adapter = createColibriInferenceAdapter({
    modelId: "glm-5.2-colibri",
    requestTimeoutMs: 10,
    fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    })
  });
  const caller = new AbortController();
  await assert.rejects(
    () => adapter.listModels({ signal: caller.signal }),
    error => error instanceof ColibriAdapterError && error.code === "request-timeout"
  );
});

test("reports caller cancellation separately from an adapter timeout", async () => {
  const caller = new AbortController();
  const adapter = createColibriInferenceAdapter({
    modelId: "glm-5.2-colibri",
    requestTimeoutMs: 1000,
    fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    })
  });
  const pending = adapter.listModels({ signal: caller.signal });
  caller.abort(new Error("cancelled by caller"));
  await assert.rejects(
    () => pending,
    error => error instanceof ColibriAdapterError && error.code === "request-aborted"
  );
});
