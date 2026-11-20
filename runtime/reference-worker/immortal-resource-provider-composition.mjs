/**
 * Compose the existing IMMORTAL local ResourceManager with Cormia's
 * Broker-facing Local Resource Provider.
 *
 * Offers and their operation mappings are host-owned. The model cannot select
 * a ResourceManager class or operation. This bridge preserves the existing
 * snapshot/acquire/release lifecycle and does not claim OS quotas or mid-run
 * preemption beyond the Resource Provider's callback-scoped lease checks.
 */

import { createLocalResourceProvider } from "../core/local-resource-provider.mjs";
import {
  RESOURCE_OPERATION_KINDS,
  withLocalResourceLease
} from "./immortal-resource-manager-adapter.mjs";

export class ImmortalResourceProviderCompositionError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "ImmortalResourceProviderCompositionError";
    this.code = code;
  }
}

export function createImmortalResourceProvider({
  providerRef,
  offers,
  resourceManager,
  leaseTtlMs,
  clock = () => new Date(),
  idFactory
} = {}) {
  if (!Array.isArray(offers) || offers.length < 1) {
    throw new TypeError("At least one host-owned local resource offer is required.");
  }
  for (const offer of offers) {
    if (!offer || typeof offer !== "object" ||
        typeof offer.operation !== "string" ||
        !Object.hasOwn(RESOURCE_OPERATION_KINDS, offer.operation)) {
      throw new ImmortalResourceProviderCompositionError(
        "RESOURCE_OPERATION_NOT_ALLOWLISTED",
        "Local resource offer uses an operation not mapped by the reviewed ResourceManager adapter."
      );
    }
  }

  const executeWithLocalLease = async ({ operation, run } = {}) => {
    if (typeof operation !== "string" ||
        !Object.hasOwn(RESOURCE_OPERATION_KINDS, operation) ||
        typeof run !== "function") {
      throw new ImmortalResourceProviderCompositionError("RESOURCE_EXECUTION_PORT_INVALID");
    }
    return withLocalResourceLease({
      resourceManager,
      operation,
      run: async context => run(Object.freeze({
        resource: context.resource,
        resourceKind: context.resourceKind,
        leaseId: context.leaseId
      }))
    });
  };

  return createLocalResourceProvider({
    providerRef,
    offers,
    executeWithLocalLease,
    leaseTtlMs,
    clock,
    ...(idFactory ? { idFactory } : {})
  });
}
