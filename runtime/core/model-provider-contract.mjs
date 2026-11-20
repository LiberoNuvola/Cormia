/**
 * Minimal in-process Cormia Model Provider contract validation.
 *
 * This module validates shape and correlation only. It does not authorize
 * operations, validate mandates, admit resources, verify model artifacts or
 * execute provider-supplied tool/function-call content.
 */

export const MODEL_PROVIDER_CONTRACT_VERSION = "cormia.model-provider/0.1";

export const MODEL_PROVIDER_LOCALITIES = Object.freeze(["local", "remote"]);
export const MODEL_PROVIDER_ENDPOINT_CLASSES = Object.freeze([
  "host_process",
  "host_service",
  "configured_remote",
  "mesh_worker"
]);
export const MODEL_PROVIDER_FEATURE_HINTS = Object.freeze([
  "structured_json",
  "json_schema_constrained_output",
  "streaming",
  "image_input",
  "audio_input",
  "video_input",
  "embeddings",
  "best_effort_cancel"
]);
export const MODEL_GENERATION_PURPOSES = Object.freeze([
  "plan",
  "reason",
  "code",
  "classify",
  "review",
  "summarize"
]);
export const MODEL_GENERATION_FINISH_REASONS = Object.freeze([
  "completed",
  "length",
  "cancelled",
  "provider_error"
]);
export const MODEL_PROVIDER_HEALTH_STATUSES = Object.freeze([
  "ready",
  "degraded",
  "unavailable",
  "unknown"
]);
export const MODEL_PROVIDER_USAGE_SOURCES = Object.freeze([
  "provider_reported",
  "host_measured",
  "unknown"
]);
export const MODEL_PROVIDER_CANCEL_STATUSES = Object.freeze([
  "accepted",
  "unsupported",
  "already_finished",
  "unknown"
]);
export const MODEL_PROVIDER_ERROR_CODES = Object.freeze([
  "provider_unavailable",
  "provider_timeout",
  "provider_resource_exhausted",
  "request_unsupported",
  "context_limit_exceeded",
  "generation_truncated",
  "provider_refused",
  "invalid_provider_response",
  "provider_identity_mismatch",
  "provider_cancelled",
  "provider_internal_error"
]);

const MAX_INPUT_ITEMS = 64;
const MAX_INPUT_TEXT_LENGTH = 200_000;
const MAX_OUTPUT_LENGTH = 1_000_000;
const MAX_WARNINGS = 32;
const MAX_WARNING_LENGTH = 512;
const MAX_METADATA_ENTRIES = 32;
const MAX_METADATA_STRING_LENGTH = 2_048;
const SECRET_METADATA_KEY = /^(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|password|secret|private[_-]?key|credential)$/i;

export class ModelProviderContractError extends TypeError {
  constructor(code, message) {
    super(message);
    this.name = "ModelProviderContractError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ModelProviderContractError(code, message);
}

function isRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function onlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail("MODEL_PROVIDER_FIELD_UNSUPPORTED", label + " contains an unsupported field.");
  }
}

function requireRecord(value, label) {
  if (!isRecord(value)) fail("MODEL_PROVIDER_RECORD_INVALID", label + " must be a plain object.");
  return value;
}

function requireText(value, label, max = 256) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    fail("MODEL_PROVIDER_FIELD_INVALID", label + " must be a non-empty bounded string.");
  }
}

function optionalText(value, label, max = 256) {
  if (value !== undefined) requireText(value, label, max);
}

function enumValue(value, allowed, label) {
  if (!allowed.includes(value)) fail("MODEL_PROVIDER_ENUM_INVALID", label + " is not supported.");
}

function safeInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail("MODEL_PROVIDER_NUMBER_INVALID", label + " must be a bounded safe integer.");
  }
}

function isoTimestamp(value, label) {
  requireText(value, label, 64);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
    fail("MODEL_PROVIDER_TIMESTAMP_INVALID", label + " must be an ISO-8601 timestamp.");
  }
}

function clone(value) {
  return structuredClone(value);
}

function validateDescriptor(value) {
  const descriptor = requireRecord(value, "ModelProviderDescriptor");
  onlyKeys(descriptor, [
    "contractVersion", "providerAdapterId", "adapterVersion",
    "providerInstanceRef", "locality", "endpointClass", "observedModelId",
    "observedModelRevision", "modelArtifactDigest", "inferenceRuntime",
    "featureHints"
  ], "ModelProviderDescriptor");

  if (descriptor.contractVersion !== MODEL_PROVIDER_CONTRACT_VERSION) {
    fail("MODEL_PROVIDER_VERSION_UNSUPPORTED", "Unsupported ModelProvider contract version.");
  }
  requireText(descriptor.providerAdapterId, "providerAdapterId", 128);
  requireText(descriptor.adapterVersion, "adapterVersion", 64);
  requireText(descriptor.providerInstanceRef, "providerInstanceRef", 256);
  enumValue(descriptor.locality, MODEL_PROVIDER_LOCALITIES, "locality");
  enumValue(descriptor.endpointClass, MODEL_PROVIDER_ENDPOINT_CLASSES, "endpointClass");
  requireText(descriptor.observedModelId, "observedModelId", 256);
  optionalText(descriptor.observedModelRevision, "observedModelRevision", 256);
  optionalText(descriptor.modelArtifactDigest, "modelArtifactDigest", 256);

  const runtime = requireRecord(descriptor.inferenceRuntime, "inferenceRuntime");
  onlyKeys(runtime, ["name", "version", "buildRef"], "inferenceRuntime");
  requireText(runtime.name, "inferenceRuntime.name", 128);
  optionalText(runtime.version, "inferenceRuntime.version", 128);
  optionalText(runtime.buildRef, "inferenceRuntime.buildRef", 256);

  if (!Array.isArray(descriptor.featureHints) || descriptor.featureHints.length > MODEL_PROVIDER_FEATURE_HINTS.length) {
    fail("MODEL_PROVIDER_FIELD_INVALID", "featureHints must be a bounded array.");
  }
  const seen = new Set();
  for (const hint of descriptor.featureHints) {
    enumValue(hint, MODEL_PROVIDER_FEATURE_HINTS, "featureHints item");
    if (seen.has(hint)) fail("MODEL_PROVIDER_FIELD_INVALID", "featureHints must not contain duplicates.");
    seen.add(hint);
  }
  return descriptor;
}

export function validateModelProviderDescriptor(value) {
  validateDescriptor(value);
  return clone(value);
}

export function validateModelProviderHealth(value, { expectedProviderInstanceRef } = {}) {
  const health = requireRecord(value, "ModelProviderHealth");
  onlyKeys(health, ["providerInstanceRef", "observedAt", "status", "reasonCode", "observedLimits"], "ModelProviderHealth");
  requireText(health.providerInstanceRef, "providerInstanceRef", 256);
  if (expectedProviderInstanceRef !== undefined && health.providerInstanceRef !== expectedProviderInstanceRef) {
    fail("MODEL_PROVIDER_IDENTITY_MISMATCH", "Health response belongs to an unexpected provider instance.");
  }
  isoTimestamp(health.observedAt, "observedAt");
  enumValue(health.status, MODEL_PROVIDER_HEALTH_STATUSES, "status");
  optionalText(health.reasonCode, "reasonCode", 128);

  if (health.observedLimits !== undefined) {
    const limits = requireRecord(health.observedLimits, "observedLimits");
    onlyKeys(limits, ["maxContextTokens", "maxOutputTokens", "concurrencyHint"], "observedLimits");
    for (const [key, amount] of Object.entries(limits)) safeInteger(amount, "observedLimits." + key, { min: 1 });
  }
  return clone(health);
}

export function validateModelGenerationRequest(value) {
  const request = requireRecord(value, "ModelGenerationRequest");
  onlyKeys(request, [
    "contractVersion", "requestRef", "taskRef", "attemptRef", "purpose",
    "input", "outputContract", "generationProfileRef", "deadlineAt"
  ], "ModelGenerationRequest");

  if (request.contractVersion !== MODEL_PROVIDER_CONTRACT_VERSION) {
    fail("MODEL_PROVIDER_VERSION_UNSUPPORTED", "Unsupported ModelProvider contract version.");
  }
  requireText(request.requestRef, "requestRef", 256);
  requireText(request.taskRef, "taskRef", 256);
  requireText(request.attemptRef, "attemptRef", 256);
  enumValue(request.purpose, MODEL_GENERATION_PURPOSES, "purpose");
  requireText(request.generationProfileRef, "generationProfileRef", 256);
  if (request.deadlineAt !== undefined) isoTimestamp(request.deadlineAt, "deadlineAt");

  if (!Array.isArray(request.input) || request.input.length > MAX_INPUT_ITEMS) {
    fail("MODEL_PROVIDER_FIELD_INVALID", "input must be an array within the configured item limit.");
  }
  for (const item of request.input) {
    requireRecord(item, "input item");
    onlyKeys(item, ["kind", "mediaType", "text", "artifactRef", "artifactDigest"], "input item");
    enumValue(item.kind, ["instruction", "text", "artifact"], "input.kind");
    optionalText(item.mediaType, "input.mediaType", 128);
    if (item.kind === "artifact") {
      requireText(item.artifactRef, "input.artifactRef", 512);
      optionalText(item.artifactDigest, "input.artifactDigest", 256);
      if (item.text !== undefined) fail("MODEL_PROVIDER_INPUT_INVALID", "Artifact input must not contain inline text.");
    } else {
      if (typeof item.text !== "string" || item.text.length > MAX_INPUT_TEXT_LENGTH) {
        fail("MODEL_PROVIDER_INPUT_INVALID", "Text and instruction inputs require bounded text.");
      }
      if (item.artifactRef !== undefined || item.artifactDigest !== undefined) {
        fail("MODEL_PROVIDER_INPUT_INVALID", "Text and instruction inputs must not carry artifact references.");
      }
    }
  }

  const outputContract = requireRecord(request.outputContract, "outputContract");
  onlyKeys(outputContract, ["format", "schemaRef", "schemaDigest"], "outputContract");
  enumValue(outputContract.format, ["text", "json"], "outputContract.format");
  optionalText(outputContract.schemaRef, "outputContract.schemaRef", 256);
  optionalText(outputContract.schemaDigest, "outputContract.schemaDigest", 256);
  return clone(request);
}

export function validateModelGenerationResponse(value, { request, descriptor } = {}) {
  const response = requireRecord(value, "ModelGenerationResponse");
  onlyKeys(response, [
    "contractVersion", "requestRef", "providerRequestRef", "observedProvider",
    "output", "finishReason", "usage", "warnings", "providerMetadata"
  ], "ModelGenerationResponse");

  if (response.contractVersion !== MODEL_PROVIDER_CONTRACT_VERSION) {
    fail("MODEL_PROVIDER_VERSION_UNSUPPORTED", "Unsupported ModelProvider contract version.");
  }
  requireText(response.requestRef, "requestRef", 256);
  optionalText(response.providerRequestRef, "providerRequestRef", 256);
  if (request !== undefined) {
    validateModelGenerationRequest(request);
    if (response.requestRef !== request.requestRef) {
      fail("MODEL_PROVIDER_REQUEST_MISMATCH", "Response does not match the outstanding request.");
    }
  }

  const observed = requireRecord(response.observedProvider, "observedProvider");
  onlyKeys(observed, [
    "providerAdapterId", "providerInstanceRef", "observedModelId", "observedModelRevision"
  ], "observedProvider");
  requireText(observed.providerAdapterId, "observedProvider.providerAdapterId", 128);
  requireText(observed.providerInstanceRef, "observedProvider.providerInstanceRef", 256);
  requireText(observed.observedModelId, "observedProvider.observedModelId", 256);
  optionalText(observed.observedModelRevision, "observedProvider.observedModelRevision", 256);
  if (descriptor !== undefined) {
    validateDescriptor(descriptor);
    if (
      observed.providerAdapterId !== descriptor.providerAdapterId ||
      observed.providerInstanceRef !== descriptor.providerInstanceRef ||
      observed.observedModelId !== descriptor.observedModelId ||
      (descriptor.observedModelRevision !== undefined &&
        observed.observedModelRevision !== descriptor.observedModelRevision)
    ) {
      fail("MODEL_PROVIDER_IDENTITY_MISMATCH", "Response provider identity does not match the selected provider.");
    }
  }

  const output = requireRecord(response.output, "output");
  onlyKeys(output, ["format", "content", "contentDigest"], "output");
  enumValue(output.format, ["text", "json"], "output.format");
  if (typeof output.content !== "string" || output.content.length > MAX_OUTPUT_LENGTH) {
    fail("MODEL_PROVIDER_OUTPUT_INVALID", "Output content must be a bounded string.");
  }
  optionalText(output.contentDigest, "output.contentDigest", 256);
  if (request !== undefined && output.format !== request.outputContract.format) {
    fail("MODEL_PROVIDER_OUTPUT_INVALID", "Output format does not match the requested output contract.");
  }
  enumValue(response.finishReason, MODEL_GENERATION_FINISH_REASONS, "finishReason");

  if (response.usage !== undefined) {
    const usage = requireRecord(response.usage, "usage");
    onlyKeys(usage, ["inputTokens", "outputTokens", "totalTokens", "source"], "usage");
    for (const key of ["inputTokens", "outputTokens", "totalTokens"]) {
      if (usage[key] !== undefined) safeInteger(usage[key], "usage." + key);
    }
    enumValue(usage.source, MODEL_PROVIDER_USAGE_SOURCES, "usage.source");
  }

  if (response.warnings !== undefined) {
    if (!Array.isArray(response.warnings) || response.warnings.length > MAX_WARNINGS) {
      fail("MODEL_PROVIDER_FIELD_INVALID", "warnings must be a bounded array.");
    }
    for (const warning of response.warnings) requireText(warning, "warning", MAX_WARNING_LENGTH);
  }

  if (response.providerMetadata !== undefined) {
    const metadata = requireRecord(response.providerMetadata, "providerMetadata");
    const entries = Object.entries(metadata);
    if (entries.length > MAX_METADATA_ENTRIES) fail("MODEL_PROVIDER_METADATA_INVALID", "providerMetadata has too many entries.");
    for (const [key, item] of entries) {
      requireText(key, "providerMetadata key", 128);
      if (SECRET_METADATA_KEY.test(key)) {
        fail("MODEL_PROVIDER_METADATA_SENSITIVE", "providerMetadata contains a prohibited sensitive field.");
      }
      const type = typeof item;
      if (
        item !== null &&
        type !== "string" &&
        type !== "number" &&
        type !== "boolean"
      ) {
        fail("MODEL_PROVIDER_METADATA_INVALID", "providerMetadata values must be primitive.");
      }
      if (type === "string" && item.length > MAX_METADATA_STRING_LENGTH) {
        fail("MODEL_PROVIDER_METADATA_INVALID", "providerMetadata string value is too large.");
      }
      if (type === "number" && !Number.isFinite(item)) {
        fail("MODEL_PROVIDER_METADATA_INVALID", "providerMetadata numbers must be finite.");
      }
    }
  }

  return clone(response);
}

export function validateModelCancelResult(value, { expectedProviderRequestRef } = {}) {
  const result = requireRecord(value, "ModelCancelResult");
  onlyKeys(result, ["providerRequestRef", "status"], "ModelCancelResult");
  requireText(result.providerRequestRef, "providerRequestRef", 256);
  if (
    expectedProviderRequestRef !== undefined &&
    result.providerRequestRef !== expectedProviderRequestRef
  ) {
    fail("MODEL_PROVIDER_REQUEST_MISMATCH", "Cancellation result belongs to another provider request.");
  }
  enumValue(result.status, MODEL_PROVIDER_CANCEL_STATUSES, "status");
  return clone(result);
}

export function assertModelProviderPort(provider) {
  requireRecord(provider, "ModelProvider");
  for (const method of ["describe", "health", "generate"]) {
    if (typeof provider[method] !== "function") {
      fail("MODEL_PROVIDER_PORT_INCOMPLETE", "ModelProvider is missing a required method.");
    }
  }
  if (provider.cancel !== undefined && typeof provider.cancel !== "function") {
    fail("MODEL_PROVIDER_PORT_INCOMPLETE", "Optional cancel method must be callable when present.");
  }
  return provider;
}

export function isCompletedModelGenerationResponse(response) {
  return response?.finishReason === "completed";
}
