/**
 * Source-pinned, read-only Masumi Registry query adapter (M2 candidate).
 *
 * This adapter talks only to the configured Registry Service origin and the
 * fixed POST /api/v1/registry-entry/ route. It never calls provider endpoints,
 * payment services, wallets, or Cardano transaction APIs.
 *
 * The authentication header name is deliberately mandatory because the
 * inspected Registry middleware reads "token" while its generated OpenAPI
 * snapshot declares "API-Key". No fallback or probing is performed.
 */
const REGISTRY_PATH = "/api/v1/registry-entry/";
const ALLOWED_AUTH_HEADERS = new Set(["token", "API-Key"]);
const ALLOWED_FILTER_KEYS = new Set([
  "paymentTypes",
  "status",
  "excludeStatus",
  "policyId",
  "assetIdentifier",
  "tags",
  "capability"
]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateFilter(filter) {
  if (filter === undefined) return;
  if (!isPlainObject(filter)) throw new TypeError("filter must be an object.");
  for (const key of Object.keys(filter)) {
    if (!ALLOWED_FILTER_KEYS.has(key)) throw new TypeError("Unsupported Registry filter: " + key);
  }
  for (const key of ["policyId", "assetIdentifier"]) {
    if (filter[key] !== undefined && !nonEmptyString(filter[key])) {
      throw new TypeError("filter." + key + " must be a non-empty string.");
    }
  }
  for (const key of ["paymentTypes", "status", "excludeStatus", "tags"]) {
    if (filter[key] !== undefined &&
        (!Array.isArray(filter[key]) || !filter[key].every(nonEmptyString))) {
      throw new TypeError("filter." + key + " must be an array of non-empty strings.");
    }
  }
  if (filter.capability !== undefined) {
    if (!isPlainObject(filter.capability) || !nonEmptyString(filter.capability.name)) {
      throw new TypeError("filter.capability.name must be a non-empty string.");
    }
    if (filter.capability.version !== undefined && typeof filter.capability.version !== "string") {
      throw new TypeError("filter.capability.version must be a string.");
    }
    for (const key of Object.keys(filter.capability)) {
      if (key !== "name" && key !== "version") {
        throw new TypeError("Unsupported filter.capability field: " + key);
      }
    }
  }
}

export function validateMasumiRegistryQuery(input) {
  if (!isPlainObject(input)) throw new TypeError("Registry query must be an object.");
  if (input.network !== "Preprod") {
    throw new TypeError("M2 permits only the Preprod network.");
  }
  const limit = input.limit === undefined ? 10 : input.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new TypeError("limit must be an integer from 1 to 20.");
  }
  if (input.cursorId !== undefined &&
      (!nonEmptyString(input.cursorId) || input.cursorId.length > 50)) {
    throw new TypeError("cursorId must contain 1-50 characters.");
  }
  for (const key of Object.keys(input)) {
    if (!["network", "limit", "cursorId", "filter"].includes(key)) {
      throw new TypeError("Unsupported Registry query field: " + key);
    }
  }
  validateFilter(input.filter);
  return {
    network: "Preprod",
    limit,
    ...(input.cursorId === undefined ? {} : { cursorId: input.cursorId }),
    ...(input.filter === undefined ? {} : { filter: structuredClone(input.filter) })
  };
}

function validateRegistryResponse(payload) {
  if (!isPlainObject(payload) || !Array.isArray(payload.entries)) {
    throw new TypeError("Registry response must contain an entries array.");
  }
  for (let i = 0; i < payload.entries.length; i++) {
    const entry = payload.entries[i];
    if (!isPlainObject(entry) ||
        !nonEmptyString(entry.agentIdentifier) ||
        typeof entry.status !== "string" ||
        !isPlainObject(entry.RegistrySource)) {
      throw new TypeError("Registry entry " + i + " is missing required identity/status/source fields.");
    }
    if (entry.RegistrySource.policyId !== null &&
        entry.RegistrySource.policyId !== undefined &&
        typeof entry.RegistrySource.policyId !== "string") {
      throw new TypeError("Registry entry " + i + " has an invalid source policyId.");
    }
  }
  return payload.entries;
}

export function createMasumiRegistryReadonlyAdapter(options = {}) {
  const baseUrl = options.baseUrl;
  const apiKey = options.apiKey;
  const authHeaderName = options.authHeaderName;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const maxResponseBytes = options.maxResponseBytes ?? 1_000_000;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const now = options.now ?? (() => new Date().toISOString());

  if (!nonEmptyString(baseUrl)) throw new TypeError("A configured Registry Service baseUrl is required.");
  const parsedBase = new URL(baseUrl);
  if (parsedBase.protocol !== "https:" ||
      parsedBase.username !== "" ||
      parsedBase.password !== "" ||
      parsedBase.pathname !== "/" ||
      parsedBase.search !== "" ||
      parsedBase.hash !== "") {
    throw new TypeError("Registry baseUrl must be an HTTPS origin without credentials, path, query or fragment.");
  }
  if (!nonEmptyString(apiKey)) throw new TypeError("A read-only Registry API key is required.");
  if (!ALLOWED_AUTH_HEADERS.has(authHeaderName)) {
    throw new TypeError('authHeaderName must be explicitly set to "token" or "API-Key"; no fallback is allowed.');
  }
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 5_000_000) {
    throw new TypeError("maxResponseBytes must be an integer from 1 to 5000000.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new TypeError("timeoutMs must be an integer from 100 to 30000.");
  }

  const endpoint = new URL(REGISTRY_PATH, parsedBase.origin).toString();

  return Object.freeze({
    async queryRegistry(input) {
      const body = validateMasumiRegistryQuery(input);
      const response = await fetchImpl(endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          [authHeaderName]: apiKey,
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (!response || typeof response.text !== "function") {
        throw new TypeError("Registry fetch returned an invalid response.");
      }
      if (!response.ok) {
        throw new Error("Masumi Registry returned HTTP " + response.status + ".");
      }
      const raw = await response.text();
      const byteLength = new TextEncoder().encode(raw).byteLength;
      if (byteLength > maxResponseBytes) {
        throw new Error("Masumi Registry response exceeded the configured size limit.");
      }
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new TypeError("Masumi Registry returned invalid JSON.");
      }
      const entries = validateRegistryResponse(payload);
      return {
        provider: "masumi-registry",
        network: "Preprod",
        endpoint,
        observedAt: now(),
        request: body,
        entries
      };
    }
  });
}
