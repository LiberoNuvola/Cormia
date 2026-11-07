/**
 * Host-configured llama.cpp adapter for the Cormia ModelProvider port.
 *
 * Initial scope is deliberately local-only and non-streaming. The adapter
 * exposes no tools, filesystem handles, Core policy, broker or credentials
 * to model content. The endpoint, model and generation profile are pinned by
 * trusted host configuration and cannot be selected by a generation request.
 */

import { createHash } from "node:crypto";

import {
  MODEL_PROVIDER_CONTRACT_VERSION,
  assertModelProviderPort,
  validateModelGenerationRequest,
  validateModelGenerationResponse,
  validateModelProviderDescriptor,
  validateModelProviderHealth
} from "./model-provider-contract.mjs";

const ERROR_MESSAGES = Object.freeze({
  provider_unavailable: "Configured local model provider is unavailable.",
  provider_timeout: "Configured local model provider exceeded its deadline.",
  provider_resource_exhausted: "Configured local model provider reported resource exhaustion.",
  request_unsupported: "The local adapter does not support this request shape.",
  context_limit_exceeded: "The local model provider rejected the request context size.",
  generation_truncated: "The local model response was truncated.",
  provider_refused: "The local model provider refused the request.",
  invalid_provider_response: "The local model provider returned an invalid response.",
  provider_identity_mismatch: "The local model provider identity did not match host configuration.",
  provider_cancelled: "The local model request was cancelled.",
  provider_internal_error: "The local model provider failed."
});

export class LlamaCppAdapterError extends Error {
  constructor(code, { requestRef = null, retryable = false } = {}) {
    super(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.provider_internal_error);
    this.name = "LlamaCppAdapterError";
    this.code = ERROR_MESSAGES[code] ? code : "provider_internal_error";
    this.requestRef = requestRef;
    this.retryable = Boolean(retryable);
  }
}

function isLocalhost(hostname) {
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new TypeError("baseUrl must be an explicit local HTTP URL.");
  }
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new TypeError("baseUrl must be a valid local HTTP URL.");
  }
  if (
    url.protocol !== "http:" ||
    !isLocalhost(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/", "/v1"].includes(url.pathname.replace(/\/+$/, ""))
  ) {
    throw new TypeError("Only an explicitly configured loopback HTTP endpoint is supported.");
  }
  return url.origin;
}

function requireText(value, name, max = 256) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new TypeError(name + " must be a non-empty bounded string.");
  }
}

function safeInteger(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(name + " must be a bounded safe integer.");
  }
}

function parseClock(clock) {
  const value = clock();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError("clock must return a valid Date.");
  }
  return value;
}

function mapHttpError(status, requestRef) {
  if (status === 408 || status === 504) {
    return new LlamaCppAdapterError("provider_timeout", { requestRef, retryable: true });
  }
  if (status === 413) {
    return new LlamaCppAdapterError("context_limit_exceeded", { requestRef });
  }
  if (status === 429 || status === 503) {
    return new LlamaCppAdapterError("provider_resource_exhausted", { requestRef, retryable: true });
  }
  if (status === 400 || status === 422) {
    return new LlamaCppAdapterError("request_unsupported", { requestRef });
  }
  return new LlamaCppAdapterError("provider_internal_error", { requestRef, retryable: status >= 500 });
}

function createBoundedExchange({ fetchImpl, headers, timeoutMs, maxResponseBytes }) {
  return async function exchange(url, init, requestRef, deadlineAt) {
    const controller = new AbortController();
    let effectiveTimeout = timeoutMs;
    if (deadlineAt !== undefined) {
      const remaining = Date.parse(deadlineAt) - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) {
        throw new LlamaCppAdapterError("provider_timeout", { requestRef, retryable: false });
      }
      effectiveTimeout = Math.min(effectiveTimeout, remaining);
    }
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);
    try {
      const response = await fetchImpl(url, {
        ...init,
        headers: { ...headers, ...(init.headers ?? {}) },
        signal: controller.signal,
        redirect: "error"
      });
      const contentLength = response.headers?.get?.("content-length");
      if (contentLength !== null && contentLength !== undefined) {
        const declared = Number(contentLength);
        if (Number.isFinite(declared) && declared > maxResponseBytes) {
          throw new LlamaCppAdapterError("invalid_provider_response", { requestRef });
        }
      }
      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > maxResponseBytes) {
        throw new LlamaCppAdapterError("invalid_provider_response", { requestRef });
      }
      return { response, body };
    } catch (error) {
      if (error instanceof LlamaCppAdapterError) throw error;
      if (controller.signal.aborted) {
        throw new LlamaCppAdapterError("provider_timeout", { requestRef, retryable: true });
      }
      throw new LlamaCppAdapterError("provider_unavailable", { requestRef, retryable: true });
    } finally {
      clearTimeout(timer);
    }
  };
}

function parseJson(body, requestRef) {
  try {
    return JSON.parse(body);
  } catch {
    throw new LlamaCppAdapterError("invalid_provider_response", { requestRef });
  }
}

function buildMessages(request) {
  const messages = [];
  for (const item of request.input) {
    if (item.kind === "artifact") {
      // Artifact retrieval is a Core/host responsibility. This adapter does
      // not resolve references or gain filesystem/storage access.
      throw new LlamaCppAdapterError("request_unsupported", { requestRef: request.requestRef });
    }
    const role = item.kind === "instruction" ? "system" : "user";
    const previous = messages[messages.length - 1];
    if (previous?.role === role) previous.content += "\n\n" + item.text;
    else messages.push({ role, content: item.text });
  }
  if (messages.length === 0) {
    throw new LlamaCppAdapterError("request_unsupported", { requestRef: request.requestRef });
  }
  return messages;
}

function mapFinishReason(reason, requestRef) {
  if (reason === "stop") return "completed";
  if (reason === "length") {
    throw new LlamaCppAdapterError("generation_truncated", { requestRef, retryable: false });
  }
  if (reason === "content_filter") {
    throw new LlamaCppAdapterError("provider_refused", { requestRef, retryable: false });
  }
  if (reason === "tool_calls" || reason === "function_call") return "completed";
  throw new LlamaCppAdapterError("invalid_provider_response", { requestRef });
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  const result = { source: "provider_reported" };
  const mappings = [
    ["prompt_tokens", "inputTokens"],
    ["completion_tokens", "outputTokens"],
    ["total_tokens", "totalTokens"]
  ];
  for (const [source, target] of mappings) {
    if (usage[source] === undefined) continue;
    if (!Number.isSafeInteger(usage[source]) || usage[source] < 0) {
      throw new LlamaCppAdapterError("invalid_provider_response");
    }
    result[target] = usage[source];
  }
  return Object.keys(result).length === 1 ? undefined : result;
}

export function createLlamaCppModelProvider({
  baseUrl,
  modelId,
  generationProfileRef,
  descriptor,
  apiKey,
  timeoutMs = 60_000,
  maxResponseBytes = 2_000_000,
  maxInputCharacters = 250_000,
  maxOutputTokens = 2_048,
  temperature = 0.7,
  topP,
  fetchImpl = globalThis.fetch,
  clock = () => new Date()
} = {}) {
  const origin = normalizeBaseUrl(baseUrl);
  requireText(modelId, "modelId", 256);
  requireText(generationProfileRef, "generationProfileRef", 256);
  safeInteger(timeoutMs, "timeoutMs", 1, 300_000);
  safeInteger(maxResponseBytes, "maxResponseBytes", 1_024, 8_000_000);
  safeInteger(maxInputCharacters, "maxInputCharacters", 1, 1_000_000);
  safeInteger(maxOutputTokens, "maxOutputTokens", 1, 32_768);
  if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new TypeError("temperature must be a finite host-configured value between 0 and 2.");
  }
  if (topP !== undefined && (typeof topP !== "number" || !Number.isFinite(topP) || topP <= 0 || topP > 1)) {
    throw new TypeError("topP must be a finite host-configured value in (0, 1].");
  }
  if (apiKey !== undefined) requireText(apiKey, "apiKey", 4_096);
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function.");
  if (typeof clock !== "function") throw new TypeError("clock must be a function.");

  const normalizedDescriptor = validateModelProviderDescriptor(descriptor);
  if (normalizedDescriptor.locality !== "local") {
    throw new TypeError("The initial llama.cpp adapter accepts local descriptors only.");
  }
  if (!["host_process", "host_service"].includes(normalizedDescriptor.endpointClass)) {
    throw new TypeError("The initial llama.cpp adapter accepts host-local endpoint classes only.");
  }
  if (normalizedDescriptor.observedModelId !== modelId) {
    throw new TypeError("modelId must equal the host-pinned descriptor model ID.");
  }
  if (normalizedDescriptor.providerAdapterId !== "cormia.llama-cpp") {
    throw new TypeError("descriptor.providerAdapterId must be cormia.llama-cpp.");
  }

  const headers = { "content-type": "application/json", accept: "application/json" };
  if (apiKey !== undefined) headers.authorization = "Bearer " + apiKey;
  const exchange = createBoundedExchange({
    fetchImpl,
    headers,
    timeoutMs,
    maxResponseBytes
  });

  const provider = {
    async describe() {
      return structuredClone(normalizedDescriptor);
    },

    async health() {
      const observedAt = parseClock(clock).toISOString();
      let result;
      try {
        result = await exchange(origin + "/health", { method: "GET" }, null, undefined);
      } catch {
        return validateModelProviderHealth({
          providerInstanceRef: normalizedDescriptor.providerInstanceRef,
          observedAt,
          status: "unavailable",
          reasonCode: "health_probe_failed"
        }, { expectedProviderInstanceRef: normalizedDescriptor.providerInstanceRef });
      }
      if (result.response.status === 503) {
        return validateModelProviderHealth({
          providerInstanceRef: normalizedDescriptor.providerInstanceRef,
          observedAt,
          status: "unavailable",
          reasonCode: "model_loading"
        }, { expectedProviderInstanceRef: normalizedDescriptor.providerInstanceRef });
      }
      if (!result.response.ok) {
        return validateModelProviderHealth({
          providerInstanceRef: normalizedDescriptor.providerInstanceRef,
          observedAt,
          status: "unknown",
          reasonCode: "health_http_" + result.response.status
        }, { expectedProviderInstanceRef: normalizedDescriptor.providerInstanceRef });
      }
      let payload;
      try {
        payload = parseJson(result.body, null);
      } catch {
        return validateModelProviderHealth({
          providerInstanceRef: normalizedDescriptor.providerInstanceRef,
          observedAt,
          status: "unknown",
          reasonCode: "health_response_invalid"
        }, { expectedProviderInstanceRef: normalizedDescriptor.providerInstanceRef });
      }
      return validateModelProviderHealth({
        providerInstanceRef: normalizedDescriptor.providerInstanceRef,
        observedAt,
        status: payload?.status === "ok" ? "ready" : "degraded",
        ...(payload?.status === "ok" ? {} : { reasonCode: "health_status_unconfirmed" })
      }, { expectedProviderInstanceRef: normalizedDescriptor.providerInstanceRef });
    },

    async generate(inputRequest) {
      const request = validateModelGenerationRequest(inputRequest);
      if (request.generationProfileRef !== generationProfileRef) {
        throw new LlamaCppAdapterError("request_unsupported", { requestRef: request.requestRef });
      }
      const messages = buildMessages(request);
      const inputCharacters = messages.reduce((sum, item) => sum + item.content.length, 0);
      if (inputCharacters > maxInputCharacters) {
        throw new LlamaCppAdapterError("context_limit_exceeded", { requestRef: request.requestRef });
      }

      const body = {
        model: modelId,
        messages,
        stream: false,
        max_tokens: maxOutputTokens,
        temperature,
        ...(topP === undefined ? {} : { top_p: topP }),
        ...(request.outputContract.format === "json"
          ? { response_format: { type: "json_object" } }
          : {})
      };

      let result;
      try {
        result = await exchange(
          origin + "/v1/chat/completions",
          { method: "POST", body: JSON.stringify(body) },
          request.requestRef,
          request.deadlineAt
        );
      } catch (error) {
        if (error instanceof LlamaCppAdapterError) throw error;
        throw new LlamaCppAdapterError("provider_unavailable", { requestRef: request.requestRef, retryable: true });
      }
      if (!result.response.ok) throw mapHttpError(result.response.status, request.requestRef);

      const payload = parseJson(result.body, request.requestRef);
      if (typeof payload?.model === "string" && payload.model.length > 0 && payload.model !== modelId) {
        throw new LlamaCppAdapterError("provider_identity_mismatch", { requestRef: request.requestRef });
      }
      if (!Array.isArray(payload?.choices) || payload.choices.length !== 1) {
        throw new LlamaCppAdapterError("invalid_provider_response", { requestRef: request.requestRef });
      }
      const choice = payload.choices[0];
      const message = choice?.message;
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        throw new LlamaCppAdapterError("invalid_provider_response", { requestRef: request.requestRef });
      }

      const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      let outputContent;
      const warnings = [];
      if (toolCalls.length > 0) {
        // Native function calls are preserved as inert text data. No tool
        // declarations are sent and this adapter has no dispatch path.
        outputContent = JSON.stringify({
          content: typeof message.content === "string" ? message.content : null,
          toolCalls
        });
        warnings.push("provider_tool_call_data_inert");
      } else if (typeof message.content === "string") {
        outputContent = message.content;
      } else if (typeof message.refusal === "string" && message.refusal.length > 0) {
        outputContent = message.refusal;
        warnings.push("provider_refusal_text");
      } else {
        throw new LlamaCppAdapterError("invalid_provider_response", { requestRef: request.requestRef });
      }

      if (Buffer.byteLength(outputContent, "utf8") > 1_000_000) {
        throw new LlamaCppAdapterError("invalid_provider_response", { requestRef: request.requestRef });
      }
      const finishReason = message.refusal
        ? "provider_error"
        : mapFinishReason(choice.finish_reason, request.requestRef);

      const usage = normalizeUsage(payload.usage);
      const providerResponse = {
        contractVersion: MODEL_PROVIDER_CONTRACT_VERSION,
        requestRef: request.requestRef,
        ...(typeof payload.id === "string" && payload.id.length > 0
          ? { providerRequestRef: payload.id.slice(0, 256) }
          : {}),
        observedProvider: {
          providerAdapterId: normalizedDescriptor.providerAdapterId,
          providerInstanceRef: normalizedDescriptor.providerInstanceRef,
          observedModelId: modelId,
          ...(normalizedDescriptor.observedModelRevision === undefined
            ? {}
            : { observedModelRevision: normalizedDescriptor.observedModelRevision })
        },
        output: {
          format: request.outputContract.format,
          content: outputContent,
          contentDigest: "sha256:" + createHash("sha256").update(outputContent, "utf8").digest("hex")
        },
        finishReason,
        ...(usage === undefined ? {} : { usage }),
        ...(warnings.length === 0 ? {} : { warnings })
      };
      return validateModelGenerationResponse(providerResponse, {
        request,
        descriptor: normalizedDescriptor
      });
    },

    async cancel(providerRequestRef) {
      requireText(providerRequestRef, "providerRequestRef", 256);
      // llama.cpp's documented OpenAI-compatible chat endpoint does not expose
      // a portable request-ID cancellation API. Do not pretend cancellation.
      return { providerRequestRef, status: "unsupported" };
    }
  };

  return Object.freeze(assertModelProviderPort(provider));
}
