#!/usr/bin/env node
/**
 * Explicit, local-only smoke test for the Cormia llama.cpp ModelProvider adapter.
 *
 * This script performs one real inference only after the operator supplies
 * --confirm-local-inference. It sends a fixed synthetic prompt, has no remote
 * fallback, accepts loopback HTTP only through the adapter, and never prints
 * model output or credentials.
 */

import { randomUUID, createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createLlamaCppModelProvider } from "./llama-cpp-model-provider.mjs";
import { MODEL_PROVIDER_CONTRACT_VERSION } from "./model-provider-contract.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:18080/v1";
const DEFAULT_PROFILE = "profile:local-smoke-v0.1";
const EXPECTED_MARKER = "CORMIA_LOCAL_PROVIDER_SMOKE_OK";

function usage() {
  return [
    "Cormia llama.cpp local provider smoke test",
    "",
    "Usage:",
    "  node runtime/core/llama-cpp-local-smoke.mjs --confirm-local-inference --model-id <server-model-id> [--base-url <loopback-url>] [--generation-profile-ref <ref>]",
    "",
    "Options:",
    "  --confirm-local-inference       Required explicit permission for one local inference",
    "  --model-id <id>                 Required; must match the llama.cpp server model ID/alias",
    "  --base-url <url>                Loopback HTTP URL (default: " + DEFAULT_BASE_URL + ")",
    "  --generation-profile-ref <ref>  Host-pinned profile (default: " + DEFAULT_PROFILE + ")",
    "  --help                          Show this help; does not contact any endpoint",
    "",
    "No API key option, remote endpoint, tool dispatch or remote fallback is supported."
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    confirm: false,
    baseUrl: DEFAULT_BASE_URL,
    modelId: null,
    generationProfileRef: DEFAULT_PROFILE
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help") {
      parsed.help = true;
      continue;
    }
    if (arg === "--confirm-local-inference") {
      parsed.confirm = true;
      continue;
    }
    if (arg === "--base-url" || arg === "--model-id" || arg === "--generation-profile-ref") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for " + arg + ".");
      }
      i += 1;
      if (arg === "--base-url") parsed.baseUrl = value;
      if (arg === "--model-id") parsed.modelId = value;
      if (arg === "--generation-profile-ref") parsed.generationProfileRef = value;
      continue;
    }
    throw new Error("Unsupported argument: " + arg);
  }

  return parsed;
}

function emit(record) {
  process.stdout.write(JSON.stringify(record, null, 2) + "\n");
}

export async function runLocalSmoke(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(error.message + "\n\n" + usage() + "\n");
    return 64;
  }

  if (options.help) {
    process.stdout.write(usage() + "\n");
    return 0;
  }
  if (!options.confirm) {
    process.stderr.write("Refusing to contact the model: --confirm-local-inference is required.\n\n" + usage() + "\n");
    return 64;
  }
  if (!options.modelId) {
    process.stderr.write("Refusing to contact the model: --model-id is required and must match the server-reported model ID.\n\n" + usage() + "\n");
    return 64;
  }

  const runRef = randomUUID();
  let provider;
  try {
    provider = createLlamaCppModelProvider({
      baseUrl: options.baseUrl,
      modelId: options.modelId,
      generationProfileRef: options.generationProfileRef,
      descriptor: {
        contractVersion: MODEL_PROVIDER_CONTRACT_VERSION,
        providerAdapterId: "cormia.llama-cpp",
        adapterVersion: "0.1.0",
        providerInstanceRef: "provider:local-smoke:" + runRef,
        locality: "local",
        endpointClass: "host_service",
        observedModelId: options.modelId,
        inferenceRuntime: { name: "llama.cpp" },
        featureHints: []
      },
      timeoutMs: 60_000,
      maxInputCharacters: 4_096,
      maxOutputTokens: 64,
      temperature: 0,
      enableThinking: false
    });
  } catch (error) {
    emit({
      status: "FAIL",
      stage: "configuration",
      reasonCode: "invalid_host_configuration",
      runRef
    });
    return 2;
  }

  let health;
  try {
    health = await provider.health();
  } catch {
    emit({
      status: "FAIL",
      stage: "health",
      reasonCode: "health_probe_failed",
      runRef,
      locality: "local"
    });
    return 2;
  }

  if (health.status !== "ready") {
    emit({
      status: "BLOCKED",
      stage: "health",
      reasonCode: health.reasonCode ?? "local_provider_not_ready",
      healthStatus: health.status,
      runRef,
      locality: "local",
      modelId: options.modelId
    });
    return 2;
  }

  let response;
  try {
    response = await provider.generate({
      contractVersion: MODEL_PROVIDER_CONTRACT_VERSION,
      requestRef: "request:local-smoke:" + runRef,
      taskRef: "task:local-smoke:" + runRef,
      attemptRef: "attempt:local-smoke:" + runRef,
      purpose: "reason",
      input: [
        { kind: "instruction", text: "For this connectivity check, follow the user's exact output instruction. Do not use tools or request external information." },
        { kind: "text", text: "Reply with exactly this marker and nothing else: " + EXPECTED_MARKER }
      ],
      outputContract: { format: "text" },
      generationProfileRef: options.generationProfileRef
    });
  } catch (error) {
    emit({
      status: "FAIL",
      stage: "generation",
      reasonCode: typeof error?.code === "string" ? error.code : "generation_failed",
      runRef,
      locality: "local",
      modelId: options.modelId
    });
    return 2;
  }

  const output = response.output.content.trim();
  const outputDigest = "sha256:" + createHash("sha256").update(response.output.content, "utf8").digest("hex");
  const matched = response.finishReason === "completed" && output === EXPECTED_MARKER;

  emit({
    status: matched ? "PASS" : "FAIL",
    stage: "generation",
    runRef,
    locality: "local",
    endpointHost: new URL(options.baseUrl).hostname,
    modelId: options.modelId,
    providerAdapterId: response.observedProvider.providerAdapterId,
    providerInstanceRef: response.observedProvider.providerInstanceRef,
    providerRequestRef: response.providerRequestRef ?? null,
    finishReason: response.finishReason,
    responseCharacters: response.output.content.length,
    responseDigest: outputDigest,
    markerMatched: matched,
    warnings: response.warnings ?? [],
    remoteFallback: false,
    toolDispatch: false
  });

  return matched ? 0 : 3;
}

const invokedAsScript = process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsScript) {
  runLocalSmoke().then(code => {
    process.exitCode = code;
  }).catch(() => {
    process.stderr.write("Smoke test terminated with an unexpected local error.\n");
    process.exitCode = 2;
  });
}
