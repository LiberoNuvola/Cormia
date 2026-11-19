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

### 7.1 Registry policies, asset identifiers and public Registry target (2026-11-19)

The Registry Service source pinned in section 2 distinguishes two policy generations:

| Generation | Preprod policy ID | Mainnet policy ID | Source disposition |
|---|---|---|---|
| V1 | `7e8bdaf2b2b919a3a4b94002cafb50086c0c845fe535d07a77ab7f77` | `ad6424e3ce9e47bbd8364984bd731b41de591f1d11f6d7d43d0da9b9` | Network-specific policies |
| V2 current | `67ab0c92c4ac1610895a1c965ee50aba41a8f1513b15240723b3bd0b` | Same as Preprod | Unparameterized validator; same policy hash on both networks |
| V2 previous | `7890b485b808043ef80136a447a3a43c18893a309dc323d1f8b0a13d` | Same old V2 hash | Replaced after the Aiken v1.1.23 recompilation; migration repoints sources to current V2 policy |

The source config and contract test pin current V2 to `67ab0c92...`; the migration explicitly records the old-to-new V2 policy change. The earlier two-value policy list is therefore the **V1** pair, not the complete current Registry policy set. Do not treat a V1 policy ID as the only valid Registry policy or treat the previous V2 policy as current.

For all generations, the source code extracts the leading 56 hex characters of `assetIdentifier` as the policy ID, i.e. the serialized identifier is `policyId ++ assetName`. For V2 specifically, the asset name is exactly 32 bytes: `nonce(1 byte) ++ root_hash(28 bytes) ++ version(3 bytes)`. The final three bytes encode a big-endian version; an update burns the previous asset and mints a replacement with the same nonce/root hash and incremented version. The V2 stable lineage key is the full identifier without that three-byte version suffix. Do not apply the V2 asset-name shape to V1 records.

The Registry Service README at the exact source pin recorded in section 2 (`27cfbbec01c5b2301f151e32d86814c954b61d4b`) explicitly describes `https://registry.masumi.network/docs/` as a public service intended only for testing and development, says not to use it in production, and warns that it is experimental and may change or be removed. It also publishes a public test API key. That public key is excluded from this integration. The hostname is therefore a **public testing/development endpoint**, not evidence of a pinned production service or of a particular Preprod deployment's image, version or authentication policy.

The probe remains pinned to `https://registry.masumi.network` to prevent destination substitution, but additionally requires the operator to acknowledge locally that this is the public test/development target. This acknowledgement is only a guard against accidental use; it is not deployment attestation and does not close M1. A token may be supplied only when explicitly issued for that exact endpoint. No credential should be sent before the operator has independently confirmed the intended target.

## 8. Identity verification policy

### 8.1 V2 policy presence is not proof of a genuine Masumi registration

The pinned V2 contract README states that its minting policy is intentionally permissionless: it has no payment-source parameter, admin signer or Registry-owner check. Any wallet can mint an asset satisfying the nonce/root-hash naming rule. The on-chain policy guarantees asset-name uniqueness and mint/update/burn quantity rules; it does **not** certify that metadata was created through the Masumi operator API or belongs to a recognized payment source.

Consequently, `NFT_CONFIRMED` must not mean only “an asset exists under the expected policy”. For V2, qualification must additionally bind the exact `(policyId, assetName)` to an authoritative known-good registration source, or verify the minting transaction against an independently pinned set of authorized selling-wallet vkeys. The upstream V2 contract README describes the operator API's `GET /api/v1/registry` as the known-good list of assets minted through its API.

**Resolution found on 2026-11-19:** the endpoint is implemented by the separate `masumi-payment-service`, not by `masumi-registry-service`. At pinned source commit `a68ebbe9f8879c08e9143d53d0c884db7ec0af3f`, `src/routes/api/index.ts` maps `GET /api/v1/registry` to `queryRegistryRequestGet` in `src/routes/api/registry/index.ts`. It uses `readAuthenticatedEndpointFactory` (`canRead`), checks the key's allowed Cardano network, and calls the database query with the authenticated key's wallet scope. The middleware reads the `token` header. The official Payment Service API reference also lists `GET /registry` as a READ operation.

Important query semantics: `network` is required; `limit` is 1–100 (default 10); `cursorId` paginates. **Without a V2-aware filter the query defaults to Web3CardanoV1.** A V2 lookup must explicitly pass `filterPaymentSourceType=Web3CardanoV2`, or use `filterAgentIdentifier` (whose exact lookup bypasses the V1 compatibility default). `filterStatus=Registered` maps to `RegistrationConfirmed` and `UpdateConfirmed`. A wallet-scoped key sees only records within its managed wallet scope; an unscoped read key can query the full allowed network. This endpoint is therefore the correct authoritative registration-record source, subject to the caller's key scope and network permissions.

This resolves the source-code ownership/route/auth question, but **does not yet qualify a deployed endpoint**: the intended Payment Service origin, deployed version/image digest, actual key permission/network/scope, pagination behavior and a redacted response fixture remain unverified. Do not assume a Registry Service key authenticates against Payment Service; the two services and their credentials must be established independently. No live request or credential was used.

The existing M2 `POST /api/v1/registry-entry/` response remains discovery/indexer data, not an authoritative allowlist or an on-chain trust verdict. Keep returned entries in `OBSERVED` until the exact asset is cross-checked against a `Registered` Payment Service record and chain evidence (including exact network, policy ID, asset name and mint transaction provenance). Preserve V1/V2 generation and version lineage separately.


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
- [x] Adapter and local-probe syntax checks plus all 16 offline tests passed in GitHub Actions on code commit `b4777ed82d1b4c74ff6dfb8b4b3a932396aa725c` (PR run #52).
- [ ] Exact intended Preprod Registry deployment/target confirmed as the source of truth.
- [x] Current official docs cross-checked: `token` is the strongest documented auth-header candidate.
- [x] Official source identifies `https://registry.masumi.network` as a public testing/development Registry endpoint; it is not treated as a pinned deployment attestation.
- [x] Official Masumi Network GitHub organization policy IDs recorded for Preprod and Mainnet.
- [x] Operator probe destination pinned to `https://registry.masumi.network`; no environment override can redirect the read-only token.
- [ ] Exact Registry Service version and image digest pinned for that approved target.
- [ ] A credential explicitly issued for that exact target provisioned locally; public test key and keys from other deployments excluded.
- [ ] Deployed Preprod authentication policy verified by a controlled read-only probe after target confirmation.
- [ ] Exact deployed response fixtures captured and redacted.
- [ ] `agentIdentifier` / `assetIdentifier` / policy / asset-name relationship verified on Preprod chain.
- [x] Official V1/V2 Registry policy generations, current V2 policy and previous V2 retirement recorded from pinned source.
- [x] V2 `assetIdentifier` prefix and 32-byte asset-name/version structure mapped from pinned source.
- [x] V2 permissionless minting limitation identified; policy presence alone is explicitly insufficient for genuine-registration trust.
- [x] Authoritative registration-record endpoint located in pinned Payment Service source: `GET /api/v1/registry`, `canRead`, `token` header, network/wallet scope and V2 query filter semantics mapped.
- [ ] Exact asset tuple `(network, policyId, assetName)` cross-checked against the authoritative registration source and chain provenance.
- [ ] Deployed Registry contract/version pinned and source policy cross-checked against chain evidence.
- [ ] Registry pagination and health/status freshness semantics tested against deployment.

Until the unchecked items pass, M1 status is **PARTIAL / BLOCKED**, not frozen.

## 10. Next action

The next implementation step is not a payment integration. The M2 read-only adapter is implemented at `runtime/reference-worker/masumi-registry-readonly-adapter.mjs` with a dedicated GitHub Actions workflow. It requires an explicitly injected auth header (no fallback), restricts requests to the configured Registry origin and fixed query route, forces Preprod, rejects redirects, enforces timeout and streaming response-byte limits, and never calls provider/payment endpoints.

**M2 offline verification:** adapter and local-probe syntax checks plus all 16 tests passed on code commit `b4777ed82d1b4c74ff6dfb8b4b3a932396aa725c` in [PR run #52](https://github.com/LiberoNuvola/Cormia/actions/runs/44531947039). The suite comprises 12 adapter contract tests and 4 local-probe tests, including child-process checks that missing credentials or missing public-test target acknowledgement exit `NOT_RUN` without sending a request. The earlier 15-test result in [PR run #45](https://github.com/LiberoNuvola/Cormia/actions/runs/44465093289) is superseded. All CI checks use synthetic responses; they do not establish deployed Preprod compatibility.

A local operator-only probe is available at `scripts/probe-masumi-registry-preprod.mjs`. It pins the destination to `https://registry.masumi.network`, which the upstream Registry repository describes as a public testing/development service. It now requires both an explicitly provisioned token for that exact endpoint and the local acknowledgement `MASUMI_REGISTRY_PUBLIC_TEST_ACK=I_ACKNOWLEDGE_PUBLIC_TEST_ENDPOINT`. Without either it returns `NOT_RUN` and sends no request. With both, it sends one Preprod Registry query with the documented `token` header and prints aggregate response counts only. It never uses the public experimental key.

Live discovery remains disabled. M1 is still **PARTIAL / BLOCKED** until the intended Preprod Payment Service origin is explicitly confirmed, its deployed version/image digest and `canRead` key permission/network/wallet scope are pinned, a redacted `GET /api/v1/registry` response fixture is captured using `filterPaymentSourceType=Web3CardanoV2` (or an exact identifier lookup), pagination/freshness semantics are checked, and identifier-to-NFT mapping plus contract version are verified on-chain. The authoritative endpoint is now identified in source; deployment qualification and exact asset evidence remain open. No live endpoint, credential, wallet, payment or chain transaction was used in this audit.

## 11. References

Official source repositories and documentation:

- https://github.com/masumi-network/masumi-registry-service
- https://github.com/masumi-network/masumi-registry-service/blob/27cfbbec01c5b2301f151e32d86814c954b61d4b/src/utils/config/index.ts
- https://github.com/masumi-network/masumi-registry-service/blob/27cfbbec01c5b2301f151e32d86814c954b61d4b/src/utils/agent-version/index.ts
- https://github.com/masumi-network/masumi-registry-service/blob/27cfbbec01c5b2301f151e32d86814c954b61d4b/src/utils/contracts/registry-v2/README.md
- https://github.com/masumi-network/masumi-registry-service/blob/27cfbbec01c5b2301f151e32d86814c954b61d4b/prisma/migrations/20260703000000_repoint_v2_registry_policy/migration.sql
- https://github.com/masumi-network/masumi-registry-service/blob/27cfbbec01c5b2301f151e32d86814c954b61d4b/src/routes/api/index.ts
- https://github.com/masumi-network/masumi-registry-service/blob/27cfbbec01c5b2301f151e32d86814c954b61d4b/README.md
- https://github.com/masumi-network/masumi-payment-service
- https://github.com/masumi-network
- https://www.masumi.network/dev/masumi/core-concepts/identity
- https://www.masumi.network/dev/masumi/core-concepts/registry
- https://www.masumi.network/dev/masumi/documentation/technical-documentation/agent-identity-nft
- https://www.masumi.network/dev/masumi/documentation/technical-documentation/registry-metadata-standard

This audit is a source-level integration assessment, not a security audit, deployed-service attestation, or live Preprod verification.
