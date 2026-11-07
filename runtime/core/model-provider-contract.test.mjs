import test from "node:test";
import assert from "node:assert/strict";

import {
  MODEL_PROVIDER_CONTRACT_VERSION,
  ModelProviderContractError,
  assertModelProviderPort,
  isCompletedModelGenerationResponse,
  validateModelCancelResult,
  validateModelGenerationRequest,
  validateModelGenerationResponse,
  validateModelProviderDescriptor,
  validateModelProviderHealth
} from "./model-provider-contract.mjs";
import { createDeterministicModelProvider } from "./deterministic-model-provider.mjs";

const NOW = new Date("2026-11-07T10:00:00.000Z");

const descriptor = Object.freeze({
  contractVersion: MODEL_PROVIDER_CONTRACT_VERSION,
  providerAdapterId: "test.synthetic",
  adapterVersion: "0.1.0",
  providerInstanceRef: "provider:test:one",
  locality: "local",
  endpointClass: "host_process",
  observedModelId: "deterministic-test-model",
  observedModelRevision: "rev-1",
  inferenceRuntime: { name: "node-test-double", version: process.version },
  featureHints: ["structured_json", "best_effort_cancel"]
});

function request(overrides = {}) {
  return {
    contractVersion: MODEL_PROVIDER_CONTRACT_VERSION,
    requestRef: "request:1",
    taskRef: "task:1",
    attemptRef: "attempt:1",
    purpose: "reason",
    input: [
      { kind: "instruction", text: "Summarize the supplied fixture." },
      { kind: "artifact", artifactRef: "artifact:fixture:1", artifactDigest: "sha256:abc123" }
    ],
    outputContract: { format: "text" },
    generationProfileRef: "profile:local-safe",
    ...overrides
  };
}

function response(req = request(), overrides = {}) {
  return {
    contractVersion: MODEL_PROVIDER_CONTRACT_VERSION,
    requestRef: req.requestRef,
    providerRequestRef: "provider-request:1",
    observedProvider: {
      providerAdapterId: descriptor.providerAdapterId,
      providerInstanceRef: descriptor.providerInstanceRef,
      observedModelId: descriptor.observedModelId,
      observedModelRevision: descriptor.observedModelRevision
    },
    output: { format: req.outputContract.format, content: "candidate output" },
    finishReason: "completed",
    usage: { inputTokens: 4, outputTokens: 3, totalTokens: 7, source: "provider_reported" },
    ...overrides
  };
}

function expectCode(fn, code) {
  assert.throws(fn, error => {
    assert.ok(error instanceof ModelProviderContractError);
    assert.equal(error.code, code);
    return true;
  });
}

test("validates and clones the provider descriptor without granting authority", () => {
  const input = structuredClone(descriptor);
  const result = validateModelProviderDescriptor(input);
  assert.deepEqual(result, input);
  assert.notEqual(result, input);
  assert.equal(result.providerInstanceRef, descriptor.providerInstanceRef);
});

test("rejects unknown descriptor features, duplicate hints and unsupported versions", () => {
  expectCode(() => validateModelProviderDescriptor({
    ...descriptor, featureHints: ["tool_execution"]
  }), "MODEL_PROVIDER_ENUM_INVALID");
  expectCode(() => validateModelProviderDescriptor({
    ...descriptor, featureHints: ["streaming", "streaming"]
  }), "MODEL_PROVIDER_FIELD_INVALID");
  expectCode(() => validateModelProviderDescriptor({
    ...descriptor, contractVersion: "cormia.model-provider/99"
  }), "MODEL_PROVIDER_VERSION_UNSUPPORTED");
});

test("validates health and binds it to the configured provider instance", () => {
  const result = validateModelProviderHealth({
    providerInstanceRef: descriptor.providerInstanceRef,
    observedAt: NOW.toISOString(),
    status: "ready",
    observedLimits: { maxContextTokens: 8192, concurrencyHint: 1 }
  }, { expectedProviderInstanceRef: descriptor.providerInstanceRef });
  assert.equal(result.status, "ready");
  expectCode(() => validateModelProviderHealth({
    providerInstanceRef: "provider:attacker",
    observedAt: NOW.toISOString(),
    status: "ready"
  }, { expectedProviderInstanceRef: descriptor.providerInstanceRef }), "MODEL_PROVIDER_IDENTITY_MISMATCH");
});

test("accepts a well-formed request containing only scoped content references", () => {
  assert.deepEqual(validateModelGenerationRequest(request()), request());
});

test("rejects authority, endpoint, credential and host-handle fields before inference", () => {
  for (const forbidden of [
    "apiKey", "authorization", "endpointUrl", "filesystemPath",
    "shell", "tools", "capabilityBroker", "hostPolicy", "taskStore"
  ]) {
    expectCode(() => validateModelGenerationRequest({
      ...request(), [forbidden]: "must-not-cross-provider-boundary"
    }), "MODEL_PROVIDER_FIELD_UNSUPPORTED");
  }
});

test("rejects artifact input with inline payload and text input with artifact handles", () => {
  expectCode(() => validateModelGenerationRequest(request({
    input: [{ kind: "artifact", artifactRef: "artifact:1", text: "unexpected payload" }]
  })), "MODEL_PROVIDER_INPUT_INVALID");
  expectCode(() => validateModelGenerationRequest(request({
    input: [{ kind: "text", text: "ok", artifactRef: "path:C:\\\\secret" }]
  })), "MODEL_PROVIDER_INPUT_INVALID");
});

test("rejects missing core correlation references and malformed deadlines", () => {
  expectCode(() => validateModelGenerationRequest(request({ attemptRef: "" })), "MODEL_PROVIDER_FIELD_INVALID");
  expectCode(() => validateModelGenerationRequest(request({ deadlineAt: "tomorrow" })), "MODEL_PROVIDER_TIMESTAMP_INVALID");
});

test("validates and binds the response to request and selected provider", () => {
  const req = request();
  const result = validateModelGenerationResponse(response(req), { request: req, descriptor });
  assert.equal(result.requestRef, req.requestRef);
  expectCode(() => validateModelGenerationResponse(response(req, {
    requestRef: "request:someone-else"
  }), { request: req, descriptor }), "MODEL_PROVIDER_REQUEST_MISMATCH");
  expectCode(() => validateModelGenerationResponse(response(req, {
    observedProvider: { ...response(req).observedProvider, providerInstanceRef: "provider:other" }
  }), { request: req, descriptor }), "MODEL_PROVIDER_IDENTITY_MISMATCH");
});

test("rejects output format mismatch, malformed usage and sensitive provider metadata", () => {
  const req = request();
  expectCode(() => validateModelGenerationResponse(response(req, {
    output: { format: "json", content: "{}" }
  }), { request: req, descriptor }), "MODEL_PROVIDER_OUTPUT_INVALID");
  expectCode(() => validateModelGenerationResponse(response(req, {
    usage: { inputTokens: -1, source: "provider_reported" }
  }), { request: req, descriptor }), "MODEL_PROVIDER_NUMBER_INVALID");
  expectCode(() => validateModelGenerationResponse(response(req, {
    providerMetadata: { apiKey: "secret-value" }
  }), { request: req, descriptor }), "MODEL_PROVIDER_METADATA_SENSITIVE");
});

test("preserves non-completed finish reasons without misclassifying them as success", () => {
  const req = request();
  const truncated = validateModelGenerationResponse(response(req, {
    finishReason: "length"
  }), { request: req, descriptor });
  assert.equal(truncated.finishReason, "length");
  assert.equal(isCompletedModelGenerationResponse(truncated), false);
  assert.equal(isCompletedModelGenerationResponse(response(req)), true);
});

test("rejects oversized metadata and unexpected nested fields", () => {
  const wrongRequest = request({ requestRef: "request:different" });
  expectCode(() => validateModelGenerationResponse(response(request()), {
    request: wrongRequest,
    descriptor
  }), "MODEL_PROVIDER_REQUEST_MISMATCH");
  expectCode(() => validateModelGenerationResponse(response(request(), {
    providerMetadata: { harmless: "x".repeat(2049) }
  }), { request: request(), descriptor }), "MODEL_PROVIDER_METADATA_INVALID");
  expectCode(() => validateModelGenerationResponse(response(), {
    request: request(),
    descriptor: { ...descriptor, inferenceRuntime: { ...descriptor.inferenceRuntime, secret: "x" } }
  }), "MODEL_PROVIDER_FIELD_UNSUPPORTED");
});

test("validates cancellation receipts and request correlation", () => {
  assert.deepEqual(validateModelCancelResult({
    providerRequestRef: "provider-request:1",
    status: "accepted"
  }, { expectedProviderRequestRef: "provider-request:1" }), {
    providerRequestRef: "provider-request:1",
    status: "accepted"
  });
  expectCode(() => validateModelCancelResult({
    providerRequestRef: "provider-request:other",
    status: "accepted"
  }, { expectedProviderRequestRef: "provider-request:1" }), "MODEL_PROVIDER_REQUEST_MISMATCH");
});

test("requires describe, health and generate on every provider", () => {
  const provider = { describe() {}, health() {}, generate() {} };
  assert.equal(assertModelProviderPort(provider), provider);
  expectCode(() => assertModelProviderPort({ describe() {}, health() {} }), "MODEL_PROVIDER_PORT_INCOMPLETE");
  expectCode(() => assertModelProviderPort({ describe() {}, health() {}, generate() {}, cancel: true }), "MODEL_PROVIDER_PORT_INCOMPLETE");
});

test("deterministic provider returns normalized default content and no host capability surface", async () => {
  const provider = createDeterministicModelProvider({
    descriptor,
    clock: () => NOW
  });
  assert.deepEqual(await provider.describe(), descriptor);
  assert.equal((await provider.health()).status, "ready");
  const result = await provider.generate(request());
  const valid = validateModelGenerationResponse(result, { request: request(), descriptor });
  assert.equal(valid.finishReason, "completed");
  assert.equal(valid.output.content, "Deterministic synthetic response.");
  assert.equal("execute" in provider, false);
  assert.equal("capabilityBroker" in provider, false);
});

test("synthetic provider can return hostile tool-call-shaped content as inert output data", async () => {
  let dispatchCount = 0;
  const hostilePayload = JSON.stringify({
    tool: "workspace.read",
    arguments: { path: "../../.secrets/credentials.json" }
  });
  const provider = createDeterministicModelProvider({
    descriptor,
    responseFactory: async req => ({
      ...response(req),
      output: { format: "text", content: hostilePayload }
    })
  });
  const result = await provider.generate(request());
  assert.equal(result.output.content, hostilePayload);
  assert.equal(dispatchCount, 0);
  // The provider API contains no broker or host execution callback by design.
  assert.equal("execute" in provider, false);
});

test("synthetic provider allows deterministic delayed and adversarial fixtures", async () => {
  const provider = createDeterministicModelProvider({
    descriptor,
    responseFactory: async (req, context) => ({
      ...response(req),
      providerRequestRef: context.providerRequestRef,
      finishReason: "length",
      warnings: ["fixture:deliberate-truncation"]
    })
  });
  const result = await provider.generate(request());
  assert.equal(result.finishReason, "length");
  assert.equal(result.warnings[0], "fixture:deliberate-truncation");
});

test("cancellation is best-effort and cannot be used to claim task rollback", async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const provider = createDeterministicModelProvider({
    descriptor,
    responseFactory: async (req, context) => {
      await pending;
      return { ...response(req), providerRequestRef: context.providerRequestRef };
    }
  });
  const generation = provider.generate(request());
  await new Promise(resolve => setImmediate(resolve));
  const cancel = await provider.cancel("synthetic-request:1");
  assert.equal(cancel.status, "accepted");
  assert.equal(typeof cancel.providerRequestRef, "string");
  release();
  const late = await generation;
  assert.equal(late.finishReason, "completed");
  assert.equal((await provider.cancel("synthetic-request:1")).status, "already_finished");
  assert.equal((await provider.cancel("synthetic-request:unknown")).status, "unknown");
});
