#!/usr/bin/env node
/**
 * Explicit, operator-run, read-only Preprod Payment Service registry probe.
 *
 * No endpoint or credential is hardcoded. No request is sent unless an
 * operator supplies a self-hosted Preprod URL, a dedicated read-only token,
 * and the explicit local acknowledgement below. The managed
 * payment.masumi.network endpoint is intentionally rejected by the adapter.
 *
 * The probe performs one GET /api/v1/registry/ request and emits aggregate
 * evidence only. It never prints registry IDs, asset identifiers, names,
 * seller vKeys, wallet addresses, transaction hashes, response bodies or keys.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createMasumiPaymentRegistryReadonlyAdapter } from "../runtime/reference-worker/masumi-payment-registry-readonly-adapter.mjs";

const ACK_VALUE = "I_ACKNOWLEDGE_SELF_HOSTED_PREPROD_READ_ONLY";

export function summarizeMasumiPaymentRegistryProbe(result) {
  if (!result || result.provider !== "masumi-payment-service" ||
      result.network !== "Preprod" || !Array.isArray(result.records)) {
    throw new TypeError("Expected a validated Preprod Payment Service registry result.");
  }

  let registrationConfirmed = 0;
  let updateConfirmed = 0;
  let recordsWithTransactionHash = 0;
  let recordsWithSellerWallet = 0;

  for (const record of result.records) {
    if (record.state === "RegistrationConfirmed") registrationConfirmed++;
    if (record.state === "UpdateConfirmed") updateConfirmed++;
    if (typeof record.CurrentTransaction?.txHash === "string" &&
        record.CurrentTransaction.txHash.length === 64) recordsWithTransactionHash++;
    if (typeof record.SmartContractWallet?.walletVkey === "string") recordsWithSellerWallet++;
  }

  return {
    status: "PASS",
    network: "Preprod",
    observedAt: result.observedAt,
    requestedLimit: result.request.limit,
    exactIdentifierLookup: typeof result.request.filterAgentIdentifier === "string",
    recordCount: result.records.length,
    registrationConfirmed,
    updateConfirmed,
    recordsWithTransactionHash,
    recordsWithSellerWallet
  };
}

async function main() {
  const baseUrl = process.env.MASUMI_PAYMENT_SERVICE_PREPROD_URL?.trim();
  const token = process.env.MASUMI_PAYMENT_SERVICE_PREPROD_READ_TOKEN?.trim();
  const acknowledgement = process.env.MASUMI_PAYMENT_SERVICE_PREPROD_ACK;

  const missing = [];
  if (!baseUrl) missing.push("MASUMI_PAYMENT_SERVICE_PREPROD_URL");
  if (!token) missing.push("MASUMI_PAYMENT_SERVICE_PREPROD_READ_TOKEN");
  if (acknowledgement !== ACK_VALUE) {
    missing.push("MASUMI_PAYMENT_SERVICE_PREPROD_ACK=" + ACK_VALUE);
  }

  if (missing.length > 0) {
    process.stdout.write(JSON.stringify({
      status: "NOT_RUN",
      missing,
      requestSent: false,
      target: "operator-configured-self-hosted-preprod-only"
    }) + "\n");
    process.exitCode = 2;
    return;
  }

  try {
    const payment = createMasumiPaymentRegistryReadonlyAdapter({
      baseUrl,
      apiKey: token,
      timeoutMs: 10_000,
      maxResponseBytes: 1_000_000
    });
    const identifier = process.env.MASUMI_PAYMENT_REGISTRY_AGENT_IDENTIFIER?.trim();
    const result = await payment.queryRegistry({
      limit: 20,
      ...(identifier ? { agentIdentifier: identifier } : {})
    });
    process.stdout.write(JSON.stringify(summarizeMasumiPaymentRegistryProbe(result)) + "\n");
  } catch (error) {
    process.stdout.write(JSON.stringify({
      status: "FAIL",
      errorType: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Payment Service probe failed."
    }) + "\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
