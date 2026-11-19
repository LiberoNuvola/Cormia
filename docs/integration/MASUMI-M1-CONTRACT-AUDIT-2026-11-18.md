# Masumi M1 Contract Audit — 2026-11-18

- **Target:** Cormia / IMMORTAL AEP
- **Status:** PARTIAL — read-only Registry contract mapped from source; deployment/header and identity-format checks remain open
- **Branch:** `work/exp-generalization-crosswalk`
- **Scope:** source-level audit only; no live Masumi endpoint calls, API keys, wallets, payments or chain transactions used

## 1. Executive result

The Masumi integration boundary is viable as an optional read-only provider-discovery adapter, but M1 is not fully frozen.

The current public source code reveals material differences and version evolution relative to some prose documentation:

1. Registry query endpoints are authenticated in current source, despite documentation examples that may describe unauthenticated lookup.
2. Registry middleware reads an HTTP `token` header, while its generated OpenAPI document declares a security header named `API-Key`. This is an implementation/documentation discrepancy and must be resolved against the actual deployed Preprod endpoint before selecting a header.
3. The current Registry Service uses a structured query schema with `network`, `limit`, `cursorId`, `filter` and `sortBy`, not the simplified request shown in older docs.
4. The current Registry output includes multiple agent types and payment-source versions, including OpenAPI, x402 and A2A descriptors and V1/V2 payment source metadata. The adapter must preserve these as discriminated external data and must not assume a single legacy Cardano payment flow.
5. The Registry package currently declares Node `^22.23.4`; the Payment Service declares Node `>=24.22.1 <25`. These are service-repository runtime requirements, not requirements for a Cormia HTTP client. Do not install either service as part of this read-only adapter.

No payment capability is required for M2. Cormia should query only the Registry Service and retain the exact external record and provenance.

## 2. Pinned source observations

Repository default-branch source was inspected on 2026-11-18.

| Component | Repository | Inspected main commit | Package version | Runtime engine |
|---|---|---|---|---|
| Registry Service | https://github.com/masumi-network/masumi-registry-service | `27cfbbec01c5b2301f151e32d86814c954b61d4b` | `0.0.5` | Node `^22.23.4` |
| Payment Service | https://github.com/masumi-network/masumi-payment-service | `a68ebbe9f8879c08e9143d53d0c884db7ec0af3f` | `0.1.0` | Node `>=24.22.1 <25` |

The repositories are MIT-licensed according to their GitHub repository metadata. This is not a review of every transitive dependency or a software security audit.

Key source files:

- Registry query route: https://github.com/masumi-network/masumi-registry-service/blob/main/src/routes/api/registry-entry/index.ts
- Registry query schemas: https://github.com/masumi-network/masumi-registry-service/blob/main/src/routes/api/registry-entry/schemas.ts
- Registry auth middleware: https://github.com/masumi-network/masumi-registry-service/blob/main/src/utils/middleware/auth-middleware/index.ts
- Registry OpenAPI snapshot: https://github.com/masumi-network/masumi-registry-service/blob/main/src/utils/swagger-generator/openapi-docs.json
- Registry payment-information route: https://github.com/masumi-network/masumi-registry-service/blob/main/src/routes/api/payment-information/index.ts
- Payment Service API-key schemas: https://github.com/masumi-network/masumi-payment-service/blob/main/src/routes/api/api-key/schemas.ts

These are moving branch URLs. The commit SHAs above are the source pins for this audit; implementation must pin exact commit/tag and deployed image digest separately.

## 3. Read-only Registry API contract observed in source

### 3.1 Query endpoint

- Method/path: `POST /api/v1/registry-entry/`
- Purpose: query registry entries, with filtering, pagination and optional health refresh behavior.
- Network enum: `Preprod` or `Mainnet`.
- `limit`: integer 1–50, default 10.
- `cursorId`: optional string.
- `filter`: optional structured filter.
- `sortBy`: `uptime`, `price`, `recency`, or `score`.
- Query endpoint returns entries; no blockchain transaction is initiated by this query route.

The current schema supports filters for payment types, status, excluded status, pricing type/unit/base-unit min/max amount, health/uptime, registration dates, policy ID, asset identifier, tags, and capability name/version. Price sorting requires a pricing unit; amounts are digit strings in base units, not floating-point display prices.

### 3.2 Search endpoint

- Method/path: `POST /api/v1/registry-entry-search/`
- Same network, pagination and structured filter model.
- Required `query`: trimmed string, 1–120 characters.
- Fuzzy matching includes core metadata, capability, asset identifier, API base URL and tags.

For the first adapter, prefer structured query with a narrow filter; fuzzy search can be added as a separate explicit user-facing discovery operation.

### 3.3 Normalized fields to retain

The current Registry output schema includes (among other fields):

- `agentIdentifier` (serialized from `assetIdentifier` in the current source);
- `RegistrySource.policyId` and Registry Source URL;
- `status`, `statusUpdatedAt`, `lastUptimeCheck`, uptime counters;
- `type`, `apiBaseUrl`, `openApiSpecUrl`, `x402ResourcesUrl`;
- `Capability.name/version`;
- `A2A.agentCardUrl` and protocol versions where applicable;
- `AgentPricing`, `SupportedPaymentSources`, payment type;
- author, tags, privacy policy, terms, example outputs;
- V2 version lineage fields where applicable.

The adapter must preserve unknown fields and raw source JSON in a bounded, redacted evidence record. Normalization is additive; it must not silently discard new source variants.

### 3.4 Identity-format caution

The current Registry serializer assigns `agentIdentifier: entry.assetIdentifier`. Current schemas also use `assetIdentifier` and `policyId` as separate filter fields. Some prose documentation describes a 64-character asset-name-derived identifier, while current payment-information input accepts identifiers of length 57–250 and current Registry source has V1/V2 versioning.

Therefore the adapter must not hardcode a 64-hex validation rule or infer the NFT policy ID from the identifier string. Preserve the exact identifier, explicit registry-source policy ID, network and source evidence; verify the actual on-chain asset representation against the pinned registry policy and contract version before setting `VERIFIED_EXTERNAL`.

## 4. Authentication discrepancy — M1 blocker

Current Registry source shows:

- `authenticatedEndpointFactory` wraps registry query and payment-information endpoints with authentication middleware.
- Middleware reads `request.headers.token` and rejects missing/invalid/revoked tokens.
- The generated OpenAPI snapshot labels its security scheme `API-Key`, while the implementation-side declaration refers to `api-key`.

**Follow-up documentation cross-check (2026-11-19):** the current Masumi identity guide's Registry query example sends `-H "token: <your-api-key>"`; current API Reference pages describe API-key authentication via the header `token`; and the Masumi skills debug recipe uses `REGISTRY_SERVICE_URL=https://registry.masumi.network/api/v1` with `token` authentication. This makes `token` the strongest current documented candidate and aligns with the inspected middleware. See [Masumi identity documentation](https://www.masumi.network/dev/masumi/core-concepts/identity), [Registry API reference](https://www.masumi.network/dev/masumi/api-reference/registry-service/get-registry-entry-spec), and [Masumi API debug recipes](https://github.com/masumi-network/masumi-skills/blob/main/skill/references/api-debug-recipes.md).

This does **not** prove the authentication policy or deployed image of a particular Preprod Registry instance. The official docs have also described public/default test access, while the Registry repository README labels its public test key and endpoint experimental/testing-only. Do not infer that a key or no-auth mode for one deployment applies to another.

**Required resolution:** pin the exact Preprod Registry origin, deployed version/image digest and operator-approved read-only credential source. Perform one controlled read-only query using the currently documented `token` header, record the exact HTTP status and response shape, and freeze the behavior only for that pinned deployment. Test another header only if that deployment's own contract requires it; never probe/fallback automatically. Do not place a key in this document, a fixture, Git, model context or logs.

The repository's public test key remains explicitly excluded: it is experimental/testing-only and is not a production credential or a substitute for a controlled deployment.

## 5. Permission model

The Payment Service's current API-key schema exposes the flags:

- `canRead`
- `canPay`
- `canAdmin`

It also supports Cardano network limits, usage credits, wallet scopes and key status.

For any future Registry/payment read-only credential, the intended least-privilege profile is:

- read allowed;
- pay denied;
- admin denied;
- Preprod-only network scope for testing;
- no wallet scope unless a future exact read operation requires it;
- active status and explicit expiry/rotation policy where supported.

The Payment Service API-key schema is not itself the Registry Service's authentication contract. Do not assume a key created in one service authenticates against the other. Each service and key issuer must be verified independently.

M2 does not require a Payment Service API key, wallet, seller vKey, or payment endpoint.

## 6. Payment-information endpoint disposition

Current Registry source defines:

- `GET /api/v1/payment-information/?agentIdentifier=...`
- protected by the same Registry authenticated endpoint factory;
- returns payment-source information, exact pricing/asset data, service metadata and seller wallet details.

This endpoint is **excluded from M2**. It is not needed to discover a provider and introduces payment-oriented fields that should not be collected before a separately approved purchase stage. Revisit only in M3, with a read-only Registry key and explicit field minimization.

No `POST /purchase`, `/start_job`, wallet, refund, dispute, registration, deregistration, x402 verify/settle, or transaction endpoints are in scope.

## 7. Cormia M2 interface freeze candidate

The only operation proposed for M2 is:

`queryRegistry({ network: "Preprod", limit, cursorId?, filter? })`

Contract requirements:

1. Base URL is an operator-configured Registry Service origin, never a URL supplied by a registry entry.
2. Only the exact `POST /api/v1/registry-entry/` route is callable.
3. Authentication header remains a deployment configuration value until the M1 discrepancy is resolved; never guess or silently fall back between headers.
4. Network is fixed to `Preprod` in the first test profile.
5. Request schema is validated locally; limit is capped at 20 by Cormia even though upstream permits 50.
6. Response is size-bounded, schema-checked and stored with observed time, endpoint origin, network, request digest and upstream source pin.
7. Registry fields are untrusted claims; an `Online` status is a recent service health signal, not an AEP assurance or correctness verdict.
8. No automatic endpoint call to an agent's `apiBaseUrl`, OpenAPI URL, x402 resource URL or A2A Agent Card is allowed in the first M2 slice.
9. No API key is forwarded to any provider endpoint.
10. Errors, stale results, unknown enum values, malformed amounts or schema drift fail closed; raw input is retained only within configured size/redaction bounds.

## 8. Identity verification policy

Use distinct states:

- `OBSERVED`: a Registry API record was returned.
- `SOURCE_CONFIRMED`: the record's source/network and source metadata were independently checked against the pinned source/contract.
- `NFT_CONFIRMED`: the exact asset is present under the expected policy on the requested Cardano network at a sufficiently confirmed chain point.
- `VERIFIED_EXTERNAL`: all required checks for the selected verification profile pass, with evidence references and freshness recorded.
- `STALE`, `REVOKED_OR_BURNED`, `INVALID`, `UNKNOWN`: explicit non-success states.

Do not use a single boolean `verified` field. NFT presence verifies the external registration asset under the selected policy; it does not verify operator honesty, runtime integrity, capability quality or task correctness.

The current documentation also describes optional DID/Verifiable Credential material. Such claims are separate evidence and must be validated against their own issuer/schema/trust policy; they do not follow automatically from NFT verification.

## 9. M1 acceptance criteria

M1 may be marked **FROZEN** only when:

- [x] Current Registry and Payment Service source repositories identified.
- [x] Exact inspected main commit SHAs and package/runtime metadata recorded.
- [x] Registry query and search route paths and core request schema mapped.
- [x] Read-only versus payment/admin permission model mapped.
- [x] M2 scope excludes payment-information and all side effects.
- [x] Adapter and local-probe syntax checks plus all 15 offline tests passed in GitHub Actions on PR head `3ce1f8ee06bcf3aa2463fff79561ffb2948c5831` (PR run #35).
- [ ] Deployed Preprod Registry Service version and image digest pinned.
- [x] Current official docs cross-checked: `token` is the strongest documented auth-header candidate and the managed Registry URL is identified.
- [x] Operator probe destination pinned to `https://registry.masumi.network`; no environment override can redirect the read-only token.
- [ ] Deployed Preprod authentication policy verified by a controlled read-only probe.
- [ ] Exact deployed response fixtures captured and redacted.
- [ ] `agentIdentifier` / `assetIdentifier` / policy / asset-name relationship verified on Preprod chain.
- [ ] Source policy ID and contract version pinned for the target network.
- [ ] Registry pagination and health/status freshness semantics tested against deployment.

Until the unchecked items pass, M1 status is **PARTIAL / BLOCKED**, not frozen.

## 10. Next action

The next implementation step is not a payment integration. The M2 read-only adapter is implemented at `runtime/reference-worker/masumi-registry-readonly-adapter.mjs` with a dedicated GitHub Actions workflow. It requires an explicitly injected auth header (no fallback), restricts requests to the configured Registry origin and fixed query route, forces Preprod, rejects redirects, enforces timeout and streaming response-byte limits, and never calls provider/payment endpoints.

**M2 offline verification:** adapter and local-probe syntax checks plus all 15 tests passed on PR head `3ce1f8ee06bcf3aa2463fff79561ffb2948c5831` in [PR run #35](https://github.com/LiberoNuvola/Cormia/actions/runs/44463148022). The suite comprises 12 adapter contract tests and 3 local-probe tests, including a child-process check that missing credentials exits `NOT_RUN` without sending a request. The adapter-only 12-test slice also passed earlier in [push run #14](https://github.com/LiberoNuvola/Cormia/actions/runs/44461546644) and [PR run #15](https://github.com/LiberoNuvola/Cormia/actions/runs/44461553018). All CI checks use synthetic responses; they do not establish deployed Preprod compatibility.

A local operator-only probe is now available at `scripts/probe-masumi-registry-preprod.mjs`. It requires an explicitly provisioned read-only token through one environment variable and pins the destination to `https://registry.masumi.network` so the token cannot be redirected by another environment variable. It sends one Preprod Registry query with the documented `token` header and prints only aggregate response counts. Missing credentials produce `NOT_RUN` with no network request. The probe has not been run because no operator credential was supplied to this environment; it does not use the public experimental key.

Live discovery remains disabled. M1 is still **PARTIAL / BLOCKED** until the exact deployed Registry version/image digest, deployment-specific authentication behavior, response fixture, identifier-to-NFT mapping, source policy/contract version, pagination and freshness semantics are verified against Preprod. No live endpoint, credential, wallet, payment or chain transaction was used.

## 11. References

Official source repositories and documentation:

- https://github.com/masumi-network/masumi-registry-service
- https://github.com/masumi-network/masumi-payment-service
- https://www.masumi.network/dev/masumi/core-concepts/identity
- https://www.masumi.network/dev/masumi/core-concepts/registry
- https://www.masumi.network/dev/masumi/documentation/technical-documentation/agent-identity-nft
- https://www.masumi.network/dev/masumi/documentation/technical-documentation/registry-metadata-standard

This audit is a source-level integration assessment, not a security audit, deployed-service attestation, or live Preprod verification.
