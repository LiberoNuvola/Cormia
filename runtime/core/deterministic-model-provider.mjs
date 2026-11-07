/**
 * Deterministic in-process ModelProvider test double.
 *
 * It has no Core handles, tool registry, filesystem, network or capability
 * broker. Responses are data only. Use responseFactory to script adversarial,
 * malformed, delayed or failed provider behavior in contract tests.
 */

import {
  MODEL_PROVIDER_CONTRACT_VERSION,
  assertModelProviderPort,
  validateModelGenerationRequest,
  validateModelProviderDescriptor,
  validateModelProviderHealth
} from "./model-provider-contract.mjs";

const DEFAULT_DESCRIPTOR = Object.freeze({
  contractVersion: MODEL_PROVIDER_CONTRACT_VERSION,
  providerAdapterId: "cormia.synthetic",
  adapterVersion: "0.1.0",
  providerInstanceRef: "provider:synthetic:test",
  locality: "local",
  endpointClass: "host_process",
  observedModelId: "synthetic-deterministic-v1",
  inferenceRuntime: { name: "cormia-test-double", version: "0.1.0" },
  featureHints: ["structured_json", "best_effort_cancel"]
});

function copy(value) {
  return structuredClone(value);
}

export function createDeterministicModelProvider({
  descriptor = DEFAULT_DESCRIPTOR,
  responseFactory,
  clock = () => new Date()
} = {}) {
  const normalizedDescriptor = validateModelProviderDescriptor(descriptor);
  if (responseFactory !== undefined && typeof responseFactory !== "function") {
    throw new TypeError("responseFactory must be a function when provided.");
  }
  if (typeof clock !== "function") throw new TypeError("clock must be a function.");

  let sequence = 0;
  const active = new Map();
  const finished = new Set();

  const provider = {
    async describe() {
      return copy(normalizedDescriptor);
    },

    async health() {
      const observedAt = clock();
      if (!(observedAt instanceof Date) || !Number.isFinite(observedAt.getTime())) {
        throw new TypeError("clock must return a valid Date.");
      }
      return validateModelProviderHealth({
        providerInstanceRef: normalizedDescriptor.providerInstanceRef,
        observedAt: observedAt.toISOString(),
        status: "ready",
        observedLimits: { maxContextTokens: 32_768, maxOutputTokens: 4_096, concurrencyHint: 1 }
      }, { expectedProviderInstanceRef: normalizedDescriptor.providerInstanceRef });
    },

    async generate(request) {
      const normalizedRequest = validateModelGenerationRequest(request);
      const providerRequestRef = "synthetic-request:" + (++sequence);
      const state = { cancelled: false };
      active.set(providerRequestRef, state);
      try {
        const response = responseFactory
          ? await responseFactory(copy(normalizedRequest), {
              providerRequestRef,
              sequence,
              isCancelled: () => state.cancelled
            })
          : {
              contractVersion: MODEL_PROVIDER_CONTRACT_VERSION,
              requestRef: normalizedRequest.requestRef,
              providerRequestRef,
              observedProvider: {
                providerAdapterId: normalizedDescriptor.providerAdapterId,
                providerInstanceRef: normalizedDescriptor.providerInstanceRef,
                observedModelId: normalizedDescriptor.observedModelId,
                ...(normalizedDescriptor.observedModelRevision === undefined
                  ? {}
                  : { observedModelRevision: normalizedDescriptor.observedModelRevision })
              },
              output: {
                format: normalizedRequest.outputContract.format,
                content: normalizedRequest.outputContract.format === "json"
                  ? "{}"
                  : "Deterministic synthetic response."
              },
              finishReason: "completed",
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, source: "unknown" }
            };
        return copy(response);
      } finally {
        active.delete(providerRequestRef);
        finished.add(providerRequestRef);
      }
    },

    async cancel(providerRequestRef) {
      if (typeof providerRequestRef !== "string" || providerRequestRef.trim().length === 0) {
        throw new TypeError("providerRequestRef must be a non-empty string.");
      }
      const current = active.get(providerRequestRef);
      if (current) {
        current.cancelled = true;
        return { providerRequestRef, status: "accepted" };
      }
      return {
        providerRequestRef,
        status: finished.has(providerRequestRef) ? "already_finished" : "unknown"
      };
    }
  };

  return Object.freeze(assertModelProviderPort(provider));
}
