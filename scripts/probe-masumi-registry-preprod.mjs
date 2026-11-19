#!/usr/bin/env node
/**
 * Controlled, read-only Masumi Registry Preprod probe.
 *
 * Required environment:
 *   MASUMI_REGISTRY_READONLY_TOKEN=<operator-provisioned read-only token>
 *
 * The destination is pinned to the documented managed Registry origin. This
 * prevents an environment typo or injected origin from receiving the token.
 * Sends exactly one fixed Registry query with the documented "token" header.
 * Never prints the token or raw Registry entries and never calls provider,
 * payment, wallet, registration, refresh, or Cardano transaction endpoints.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createMasumiRegistryReadonlyAdapter } from "../runtime/reference-worker/masumi-registry-readonly-adapter.mjs";

const REGISTRY_ORIGIN = "https://registry.masumi.network";

export function summarizeMasumiRegistryProbe(result) {
  if (!result || result.network !== "Preprod" || !Array.isArray(result.entries)) {
    throw new TypeError("Expected a validated Preprod Registry query result.");
  }

  let entriesWithIdentifier = 0;
  let entriesWithPolicyId = 0;
  let onlineEntries = 0;

  for (const entry of result.entries) {
    if (typeof entry.agentIdentifier === "string" && entry.agentIdentifier.length > 0) {
      entriesWithIdentifier++;
    }
    if (typeof entry.RegistrySource?.policyId === "string" &&
        entry.RegistrySource.policyId.length > 0) {
      entriesWithPolicyId++;
    }
    if (entry.status === "Online") onlineEntries++;
  }

  return {
    status: "PASS",
    network: "Preprod",
    observedAt: result.observedAt,
    requestLimit: result.request.limit,
    entryCount: result.entries.length,
    entriesWithIdentifier,
    entriesWithPolicyId,
    onlineEntries
  };
}

async function main() {
  const token = process.env.MASUMI_REGISTRY_READONLY_TOKEN?.trim();

  if (!token) {
    process.stdout.write(JSON.stringify({
      status: "NOT_RUN",
      missing: ["MASUMI_REGISTRY_READONLY_TOKEN"],
      requestSent: false,
      registryOrigin: REGISTRY_ORIGIN
    }) + "\n");
    process.exitCode = 2;
    return;
  }

  try {
    const registry = createMasumiRegistryReadonlyAdapter({
      baseUrl: REGISTRY_ORIGIN,
      apiKey: token,
      authHeaderName: "token",
      fetchImpl: globalThis.fetch,
      timeoutMs: 10_000,
      maxResponseBytes: 1_000_000
    });

    const result = await registry.queryRegistry({
      network: "Preprod",
      limit: 1
    });
    process.stdout.write(JSON.stringify(summarizeMasumiRegistryProbe(result)) + "\n");
  } catch (error) {
    process.stdout.write(JSON.stringify({
      status: "FAIL",
      network: "Preprod",
      errorType: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Registry probe failed."
    }) + "\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
