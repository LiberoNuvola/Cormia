/**
 * Narrow local adapter for the Colibrì OpenAI-compatible inference API.
 *
 * This module is a client only: it never installs/starts Colibrì, downloads
 * model files, executes returned tool calls, or grants task capabilities.
 * The endpoint is intentionally restricted to loopback for local-first use.
 */

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const ALLOWED_ROLES = new Set(["system", "developer", "user", "assistant", "tool"]);

export class ColibriAdapterError extends Error {
  constructor(code, message, { status = null, cause = undefined } = {}) {
    super(message, { cause });
    this.name = "ColibriAdapterError";
    this.code = code;
    this.status = status;
  }
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("baseUrl must be an absolute loopback URL.");
  }

  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new TypeError("baseUrl must use HTTP or HTTPS.");
  }
  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new TypeError("Colibrì endpoint must resolve to an explicit loopback host.");
  }
  if (url.username || url.password || url.search || url.hash || url.pathname.replace(/\/+$/, "") !== "/v1") {
    throw new TypeError("baseUrl must be a clean loopback /v1 URL without credentials, query, or fragment.");
  }
  return url.toString().replace(/\/$/, "");
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError("messages must be a non-empty array.");
  }
  for (const [index, message] of messages.entries()) {
    if (!message || typeof message !== "object" || Array.isArray(message) ||
        !ALLOWED_ROLES.has(message.role)) {
      throw new TypeError(\`messages[\${index}] has an unsupported role or shape.\`);
    }
    if (!(typeof message.content === "string" || message.content === null || Array.isArray(message.content)) &&
        message.role !== "assistant") {
      throw new TypeError(\`messages[\${index}].content has an unsupported type.\`);
    }
  }
}

function validateTools(tools) {
  if (tools === undefined) return;
  if (!Array.isArray(tools)) throw new TypeError("tools must be an array.");
  for (const [index, tool] of tools.entries()) {
    if (!tool || tool.type !== "function" || !tool.function ||
        typeof tool.function.name !== "string" || !tool.function.name.trim()) {
      throw new TypeError(\`tools[\${index}] must be an OpenAI function tool declaration.\`);
    }
  }
}

function safeErrorCode(payload) {
  const code = payload?.error?.code;
  return typeof code === "string" && /^[a-zA-Z0-9_.-]{1,80}$/.test(code) ? code : null;
}

async function readJson(response, operation) {
  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new ColibriAdapterError("invalid-json", \`Colibrì returned a non-JSON response for \${operation}.\`, {
      status: response.status,
      cause
    });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ColibriAdapterError("invalid-response", \`Colibrì returned an invalid response for \${operation}.\`, {
      status: response.status
    });
  }
  if (!response.ok) {
    const remoteCode = safeErrorCode(payload);
    throw new ColibriAdapterError(
      remoteCode ?? "upstream-error",
      \`Colibrì request failed with HTTP \${response.status}\${remoteCode ? \` (\${remoteCode})\` : ""}.\`,
      { status: response.status }
    );
  }
  return payload;
}

/**
 * Create a host-configured client for one local Colibrì server.
 * apiKey is supplied by trusted host configuration and is never returned.
 */
export function createColibriInferenceAdapter({
  baseUrl = "http://127.0.0.1:8000/v1",
  modelId,
  apiKey,
  requestTimeoutMs = 120_000,
  fetchImpl = globalThis.fetch
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (typeof modelId !== "string" || !modelId.trim() || modelId.length > 200) {
    throw new TypeError("modelId must be a non-empty string of at most 200 characters.");
  }
  if (apiKey !== undefined && (typeof apiKey !== "string" || !apiKey.trim())) {
    throw new TypeError("apiKey, when supplied, must be a non-empty string.");
  }
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 600_000) {
    throw new TypeError("requestTimeoutMs must be an integer between 1 and 600000.");
  }
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function.");

  const headers = { accept: "application/json" };
  if (apiKey !== undefined) headers.authorization = \`Bearer \${apiKey}\`;

  async function request(path, { method = "GET", body, signal } = {}) {
    const url = \`\${normalizedBaseUrl}\${path}\`;
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: body === undefined ? { ...headers } : { ...headers, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal ?? AbortSignal.timeout(requestTimeoutMs),
        redirect: "error"
      });
    } catch (cause) {
      const code = cause?.name === "TimeoutError" || cause?.name === "AbortError"
        ? "request-timeout"
        : "connection-failed";
      throw new ColibriAdapterError(code, \`Could not complete local Colibrì \${method} request.\`, { cause });
    }
    return readJson(response, \`\${method} \${path}\`);
  }

  return Object.freeze({
    provider: "colibri",
    modelId,

    /** Returns only advertised model identifiers; does not change server state. */
    async listModels({ signal } = {}) {
      const payload = await request("/models", { signal });
      if (!Array.isArray(payload.data)) {
        throw new ColibriAdapterError("invalid-model-list", "Colibrì /v1/models response has no data array.");
      }
      return payload.data
        .filter(item => item && typeof item.id === "string")
        .map(item => item.id);
    },

    /**
     * Performs one non-streaming chat completion. Returned tool calls are
     * proposals only; Cormia's trusted capability/policy layer must validate
     * and authorize them before any tool is executed.
     */
    async chatCompletion({
      messages,
      tools,
      toolChoice,
      maxTokens,
      temperature,
      strictToolCalls = false,
      signal
    } = {}) {
      validateMessages(messages);
      validateTools(tools);
      if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 1_000_000)) {
        throw new TypeError("maxTokens must be a positive integer no greater than 1000000.");
      }
      if (temperature !== undefined && (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2)) {
        throw new TypeError("temperature must be a finite number between 0 and 2.");
      }
      if (strictToolCalls && (!Array.isArray(tools) || tools.length === 0)) {
        throw new TypeError("strictToolCalls requires at least one declared function tool.");
      }
      if (toolChoice !== undefined && !["auto", "none", "required"].includes(toolChoice) &&
          !(toolChoice && toolChoice.type === "function" && typeof toolChoice.function?.name === "string")) {
        throw new TypeError("toolChoice must be auto, none, required, or a named function choice.");
      }

      const body = {
        model: modelId,
        messages,
        stream: false
      };
      if (tools !== undefined) body.tools = tools;
      if (toolChoice !== undefined) body.tool_choice = toolChoice;
      if (maxTokens !== undefined) body.max_tokens = maxTokens;
      if (temperature !== undefined) body.temperature = temperature;
      if (strictToolCalls) body.strict_tool_calls = true;

      const payload = await request("/chat/completions", { method: "POST", body, signal });
      const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
      const message = choice?.message;
      if (!message || message.role !== "assistant" ||
          !(typeof message.content === "string" || message.content === null) ||
          (message.tool_calls !== undefined && !Array.isArray(message.tool_calls))) {
        throw new ColibriAdapterError("invalid-completion", "Colibrì returned no valid assistant completion.");
      }

      return {
        provider: "colibri",
        model: typeof payload.model === "string" ? payload.model : modelId,
        content: message.content,
        toolCalls: message.tool_calls ?? [],
        finishReason: choice.finish_reason ?? null,
        complete: choice.finish_reason !== "length",
        usage: payload.usage && typeof payload.usage === "object" ? {
          promptTokens: Number.isInteger(payload.usage.prompt_tokens) ? payload.usage.prompt_tokens : null,
          completionTokens: Number.isInteger(payload.usage.completion_tokens) ? payload.usage.completion_tokens : null,
          totalTokens: Number.isInteger(payload.usage.total_tokens) ? payload.usage.total_tokens : null
        } : null,
        requestId: typeof payload.id === "string" ? payload.id : null
      };
    }
  });
}
