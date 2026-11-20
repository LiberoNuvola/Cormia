/**
 * Source-pinned read-only Masumi Payment Service registry-record adapter.
 *
 * This is separate from the Registry Service discovery adapter. It reads the
 * authenticated Payment Service GET /api/v1/registry/ endpoint only, with a
 * fixed Preprod + Web3CardanoV2 + Registered query. It never calls the payment,
 * purchase, wallet, API-key mutation, registry mutation, or chain endpoints.
 *
 * Use only an operator-provisioned Payment Service key with canRead=true,
 * canPay=false, canAdmin=false, Preprod-only network scope, and the narrowest
 * suitable wallet scope. The adapter cannot establish the key's permissions;
 * those are an operator/deployment precondition.
 */
const REGISTRY_PATH = "registry/";
const DISALLOWED_MANAGED_HOST = "payment.masumi.network";
const IDENTIFIER_MIN = 57;
const IDENTIFIER_MAX = 250;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateMasumiPaymentRegistryQuery(input) {
  if (!isPlainObject(input)) throw new TypeError("Payment registry query must be an object.");
  for (const key of Object.keys(input)) {
    if (!["limit", "cursorId", "agentIdentifier"].includes(key)) {
      throw new TypeError("Unsupported Payment registry query field: " + key);
    }
  }

  const limit = input.limit === undefined ? 10 : input.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new TypeError("limit must be an integer from 1 to 20.");
  }
  if (input.cursorId !== undefined &&
      (!nonEmptyString(input.cursorId) || input.cursorId.length > 256)) {
    throw new TypeError("cursorId must contain 1-256 characters.");
  }
  if (input.agentIdentifier !== undefined &&
      (typeof input.agentIdentifier !== "string" ||
       input.agentIdentifier.length < IDENTIFIER_MIN ||
       input.agentIdentifier.length > IDENTIFIER_MAX)) {
    throw new TypeError("agentIdentifier must contain 57-250 characters.");
  }
  return {
    network: "Preprod",
    limit,
    filterPaymentSourceType: "Web3CardanoV2",
    filterStatus: "Registered",
    ...(input.cursorId === undefined ? {} : { cursorId: input.cursorId }),
    ...(input.agentIdentifier === undefined ? {} : { filterAgentIdentifier: input.agentIdentifier })
  };
}

function validateBaseUrl(baseUrl) {
  if (!nonEmptyString(baseUrl)) {
    throw new TypeError("An operator-configured Payment Service baseUrl is required.");
  }
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new TypeError("Payment Service baseUrl must be an absolute URL.");
  }
  const localHttpHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && localHttpHosts.has(parsed.hostname))) {
    throw new TypeError("Payment Service baseUrl must use HTTPS (HTTP is allowed only for loopback self-hosts).");
  }
  if (parsed.username !== "" || parsed.password !== "" ||
      parsed.pathname.replace(/\/$/, "") !== "/api/v1" ||
      parsed.search !== "" || parsed.hash !== "") {
    throw new TypeError("Payment Service baseUrl must end at /api/v1 without credentials, query or fragment.");
  }
  if (parsed.hostname === DISALLOWED_MANAGED_HOST ||
      parsed.hostname.endsWith("." + DISALLOWED_MANAGED_HOST)) {
    throw new TypeError("The managed Payment Service host is Mainnet-only; Preprod requires a self-hosted instance.");
  }
  return parsed;
}

async function readBoundedResponseText(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== "function") {
    throw new TypeError("Payment Service response must expose a readable body stream.");
  }
  const reader = response.body.getReader();
  const bytes = new Uint8Array(maxBytes);
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw new TypeError("Payment Service response stream returned a non-byte chunk.");
      }
      if (totalBytes + value.byteLength > maxBytes) {
        throw new Error("Masumi Payment Service response exceeded the configured size limit.");
      }
      bytes.set(value, totalBytes);
      totalBytes += value.byteLength;
    }
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch {
      // Preserve the original error when cancellation fails.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(bytes.subarray(0, totalBytes));
}

function validateRegistrationRecords(payload, requestedIdentifier) {
  if (!isPlainObject(payload) ||
      payload.status !== "success" ||
      !isPlainObject(payload.data) ||
      !Array.isArray(payload.data.Assets)) {
    throw new TypeError("Payment Service response must contain status=success and data.Assets.");
  }

  for (let i = 0; i < payload.data.Assets.length; i++) {
    const record = payload.data.Assets[i];
    if (!isPlainObject(record) ||
        !nonEmptyString(record.id) ||
        !nonEmptyString(record.agentIdentifier) ||
        record.agentIdentifier.length < IDENTIFIER_MIN ||
        record.agentIdentifier.length > IDENTIFIER_MAX ||
        !["RegistrationConfirmed", "UpdateConfirmed"].includes(record.state) ||
        record.paymentSourceType !== "Web3CardanoV2" ||
        !isPlainObject(record.SmartContractWallet) ||
        !/^[0-9a-fA-F]{56}$/.test(record.SmartContractWallet.walletVkey) ||
        !nonEmptyString(record.SmartContractWallet.walletAddress)) {
      throw new TypeError("Payment registry record " + i + " is not a complete confirmed V2 registration.");
    }
    if (record.CurrentTransaction !== null && record.CurrentTransaction !== undefined) {
      if (!isPlainObject(record.CurrentTransaction) ||
          (record.CurrentTransaction.txHash !== null &&
           record.CurrentTransaction.txHash !== undefined &&
           !/^[0-9a-fA-F]{64}$/.test(record.CurrentTransaction.txHash))) {
        throw new TypeError("Payment registry record " + i + " has an invalid CurrentTransaction.");
      }
    }
    if (requestedIdentifier !== undefined && record.agentIdentifier !== requestedIdentifier) {
      throw new TypeError("Payment Service returned a record outside the requested exact identifier.");
    }
  }
  return payload.data.Assets;
}

export function createMasumiPaymentRegistryReadonlyAdapter(options = {}) {
  const parsedBase = validateBaseUrl(options.baseUrl);
  const apiKey = options.apiKey;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const maxResponseBytes = options.maxResponseBytes ?? 1_000_000;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const now = options.now ?? (() => new Date().toISOString());

  if (!nonEmptyString(apiKey) || apiKey.trim() !== apiKey || /[\r\n]/.test(apiKey)) {
    throw new TypeError("An operator-provisioned Payment Service read-only token is required.");
  }
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 5_000_000) {
    throw new TypeError("maxResponseBytes must be an integer from 1 to 5000000.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new TypeError("timeoutMs must be an integer from 100 to 30000.");
  }

  const endpoint = new URL(REGISTRY_PATH, parsedBase.href.endsWith("/") ? parsedBase : parsedBase.href + "/");
  return Object.freeze({
    async queryRegistry(input) {
      const request = validateMasumiPaymentRegistryQuery(input);
      const url = new URL(endpoint);
      for (const [key, value] of Object.entries(request)) {
        url.searchParams.set(key, String(value));
      }
      const response = await fetchImpl(url.toString(), {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          token: apiKey,
          accept: "application/json"
        }
      });
      if (!response || typeof response.ok !== "boolean" || !response.body) {
        throw new TypeError("Payment Service fetch returned an invalid response.");
      }
      if (!response.ok) {
        throw new Error("Masumi Payment Service returned HTTP " + response.status + ".");
      }
      const raw = await readBoundedResponseText(response, maxResponseBytes);
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new TypeError("Masumi Payment Service returned invalid JSON.");
      }
      const records = validateRegistrationRecords(payload, request.filterAgentIdentifier);
      return Object.freeze({
        provider: "masumi-payment-service",
        network: "Preprod",
        endpoint: endpoint.toString(),
        observedAt: now(),
        request,
        records
      });
    }
  });
}
