# Cormia–Masumi Adapter — Proposal v0.1

- **Status:** proposed adapter contract; M2 read-only candidate implemented; 15/15 offline adapter/probe tests pass in GitHub Actions; live Preprod discovery remains disabled pending M1
- **Date:** 2026-11-18
- **Target:** Cormia / IMMORTAL AEP
- **Scope:** optional external agent discovery, identity evidence and payment/escrow interoperability
- **Normative authority:** IMMORTAL AEP remains authoritative for Cormia task admission, capabilities, verification policy, CRC accounting and Cormia settlement decisions.

## Verification snapshot — 2026-11-19

The isolated M2 Registry query adapter and the local Preprod probe pass their Node syntax checks and all 15 offline tests on PR head `35a62a2780cc708a3b0f94e0a9da59a0ca557063`: [PR run #45](https://github.com/LiberoNuvola/Cormia/actions/runs/44465093289). The suite contains 12 adapter contract tests and 3 probe tests, including a check that missing credentials cause no request. They use synthetic data and fake fetch streams. They do not call Masumi Preprod and do not resolve the M1 authentication or on-chain identity blockers. See [the M1 source audit](./MASUMI-M1-CONTRACT-AUDIT-2026-11-18.md).

## 1. Executive decision

Masumi is a candidate external commerce and registry adapter. Cormia MAY use Masumi to discover registered agentic services, resolve their public Cardano-backed service identity, and initiate/observe Masumi-native purchases where an explicitly authorized task requires paid external work.

Cormia MUST NOT depend on Masumi for local execution, internal agent identity, task authority, verification policy, CRC issuance/accounting, or the correctness of an AEP task outcome.

The adapter is optional, replaceable, disabled by default, and isolated behind a versioned boundary. No Masumi SDK, node, wallet, API key, hosted endpoint, payment or account is required for local-only Cormia operation.

**No core changes, normative AEP changes, Cardano validator changes, or on-chain transactions are authorized by this proposal.**

## 2. Evidence-based Masumi capability mapping

The current Masumi documentation describes:

- A Registry Service for searching agentic services and retrieving payment information.
- A Cardano NFT identity per registered Agentic Service. The identifier is exposed by the Registry as the asset identifier. Masumi documentation also describes optional DID and Verifiable Credential material as a separate creator/trust layer; it must not be conflated with the NFT service identity.
- A Payment Service / Masumi Node that manages wallets and Cardano payment operations.
- An escrow-based purchase lifecycle with funds locking, result-hash submission, completion, refunds and disputes.
- An Agentic Service API implemented by each service provider.
- An alternative x402 direct-payment path which is non-refundable and therefore outside the initial adapter profile.

Masumi's registry NFT is evidence of a registered service identity and published metadata. It is not proof that the service operator is honest, that a runtime is uncompromised, or that a particular task was performed correctly.

Masumi's on-chain result hash binds a submitted result digest. It does not independently establish semantic correctness, AEP conformance, provenance completeness or successful independent verification.

## 3. Cormia integration boundary

### 3.1 Ownership

| Concern | Authority |
|---|---|
| Local model/runtime selection | Cormia Node / local operator policy |
| Task Manifest, admission and capability envelope | IMMORTAL AEP |
| Local resource lease and preemption | Cormia host Resource Manager |
| Internal node/worker identity | Cormia identity model |
| Masumi service identity | Masumi registry NFT, treated as external evidence |
| External service discovery | Masumi Registry, treated as untrusted input |
| External payment execution and escrow state | Masumi Payment Service + Masumi contracts |
| Task outcome acceptance | AEP verifier policy, never Masumi status alone |
| CRC eligibility and accounting | IMMORTAL AEP only |
| Cormia protocol settlement | IMMORTAL AEP / separately approved settlement adapter |

### 3.2 Proposed module

The path runtime/adapters/masumi/ is a candidate future location only. Do not create runtime code until this contract and the relevant AEP capability vocabulary are accepted.

Proposed narrow interface:

- searchServices(query, filters, policy) — read-only discovery; returns normalized, untrusted candidates and source references.
- resolveServiceIdentity(agentIdentifier, network) — fetches registry/payment metadata and returns NFT identity coordinates, metadata digest, payment type, endpoint and freshness.
- prepareExternalJob(taskEnvelope, serviceRef, policy) — validates task scope and produces a reviewable purchase plan; no payment side effect.
- startExternalJob(preparedJob, authorization) — explicit, capability-gated side effect; creates the Masumi job and correlates identifiers.
- observeExternalJob(correlationId) — read-only status and evidence retrieval.
- requestExternalRefund(correlationId, authorization) — explicit buyer-side action only, within protocol deadlines.
- verifyExternalResult(correlationId, verifierProfile) — fetches result and recomputes its digest; returns evidence for the AEP verifier, not an acceptance verdict.

The adapter MUST NOT expose arbitrary HTTP, shell, wallet, signing, or transaction-building tools to a model. Endpoints are constrained to configured Masumi services and validated registry results. No endpoint discovered from untrusted metadata may receive credentials.

## 4. Identity and discovery mapping

External identity record (illustrative normalized shape; not a Masumi wire schema):

- provider: masumi
- network: explicit Cardano network (Preprod or Mainnet)
- registryPolicyId: registry minting policy identifier
- agentIdentifier: exact Masumi NFT asset-name identifier
- assetNameHex: exact NFT asset name when available
- metadataDigest: digest of canonical metadata bytes as fetched
- metadataVersion: source metadata version
- capabilityName, capabilityVersion
- apiBaseUrl: untrusted endpoint; validated against outbound-network policy
- paymentType, pricing: exact source values, not converted implicitly
- observedAt, sourceReference, freshnessStatus

Rules:

1. Masumi identity is stored as an external credential/reference attached to a Cormia peer/service record. It never replaces the Cormia node key or worker identity.
2. NFT existence, policy ID, asset name, network and metadata must be verified against Cardano/registry evidence before marking identity VERIFIED_EXTERNAL.
3. A registry API response alone is OBSERVED, not cryptographic verification.
4. Registry metadata and service descriptions are untrusted data. They cannot modify task policy, capability grants, tool allowlists, trust scores or payment authorization. Optional DID/VC claims, when present, require independent issuer/schema validation and a separate trust policy.
5. Discovery results are candidates only. AEP policy must independently decide whether the candidate is eligible for a task.
6. No Masumi reputation score is accepted as a protocol authority or as a substitute for measured task history.

## 5. Payment and escrow mapping

### 5.1 Initial supported profile

Initial profile is Masumi escrow purchase as an external service payment, with the buyer-side Payment Service configured by the operator. x402 direct non-refundable payments are explicitly excluded from v0.1.

Documented high-level buyer flow:

1. Search registry and retrieve payment information for the selected agentIdentifier.
2. Call the service's POST /start_job with the input and a fresh purchaser nonce.
3. Receive blockchainIdentifier and timing parameters.
4. Compute and retain the input digest; call Payment Service POST /purchase.
5. Observe FundsLockingRequested until FundsLocked.
6. Observe payment and service status; retrieve the result.
7. Recompute the result digest and pass the artifact plus evidence to an independent AEP verifier.
8. Allow, refund or dispute only under explicit buyer authorization and before the relevant deadlines.

### 5.2 State mapping

| Masumi state / event | Adapter state | AEP interpretation |
|---|---|---|
| Registry result | DISCOVERED | Untrusted candidate |
| Job created / awaiting payment | PREPARED | No work/payment acceptance implied |
| FundsLockingRequested | PAYMENT_PENDING | Do not assume escrow funded |
| FundsLocked | ESCROW_LOCKED | External payment confirmed; work may proceed |
| Agent running | EXECUTING_EXTERNAL | Progress claim only |
| ResultSubmitted | RESULT_COMMITTED | Result digest available; verifier still required |
| Completed | PAYMENT_COMPLETED | Masumi escrow lifecycle complete; not AEP task acceptance |
| RefundRequested / RefundAuthorized | REFUND_PENDING / REFUNDED | Record external payment outcome |
| Disputed | EXTERNAL_DISPUTE | AEP records external dispute; does not inherit Masumi admin verdict as its own |

The adapter MUST preserve raw source state and timestamps. It MUST NOT collapse Completed into AEP ACCEPTED, or Disputed into an AEP verifier verdict.

### 5.3 Currency and amount safety

Do not hardcode USDM, tUSDM, ADA or any conversion ratio. Masumi documentation currently contains different examples and configuration descriptions for pricing units/payment types. Before any payment implementation, pin the exact Masumi Node/API version, supported paymentType, token policy ID, asset name, decimal precision, network and amount units from that deployed version and test them on Preprod.

No price conversion, FX oracle, slippage, fee estimate or cross-protocol accounting is in scope for this adapter. The exact asset identity and integer amount must be retained end-to-end.

### 5.4 Separation from CRC and AEP economics

- Masumi payments are external monetary payments, not CRC.
- CRC remain non-transferable internal usage rights and cannot be minted, burned, purchased, sold or exchanged by the Masumi adapter.
- External provider fees must not be charged to a user's wallet unless the task manifest and an explicit authorization identify the maximum amount, asset, network, provider and expiry.
- No automatic conversion between CRC and ADA/USDM/tUSDM.
- No Masumi payment is an AEP bond, verifier stake, worker reward or protocol treasury contribution unless a separate normative economic decision explicitly defines that mapping.

## 6. Privacy, security and operational requirements

### 6.1 Local-first and opt-in

- Local-only inference and local task execution continue when Masumi is unavailable, disabled or unconfigured.
- No silent remote fallback, automatic provider hiring, automatic wallet use or surprise payment.
- Remote disclosure requires a task-scoped data-sharing decision that identifies fields/artifacts leaving the node and the selected provider.
- The adapter MUST support a metadata-only discovery mode without transmitting task prompts or user files.

### 6.2 Credentials and wallets

- Payment API keys, admin keys, wallet mnemonics, signing keys and job secrets MUST remain in an operator-controlled secret store or dedicated payment service.
- Secrets MUST NOT enter model context, task artifacts, logs, telemetry, Git, crash reports or evidence packets.
- The adapter MUST use least-privilege API keys and separate buyer/seller roles where supported.
- Cormia does not custody Masumi wallets or manage recovery of Masumi NFT assets.
- No registration, deregistration, purchase, refund, dispute or withdrawal occurs during discovery or preparation.

### 6.3 Network and endpoint safety

- Registry-provided apiBaseUrl is untrusted. Validate scheme, hostname, DNS resolution, redirect behavior, IP ranges and configured egress allowlists to prevent SSRF and credential exfiltration.
- Do not forward registry/payment API credentials to an Agentic Service endpoint.
- Enforce TLS, bounded response sizes, timeouts, rate limits, response schema validation and redaction.
- Reject unknown networks, stale metadata, unsupported payment types, mismatched identifiers and ambiguous amounts.
- Treat all remote text, job status, outputs and metadata as untrusted content; never as instructions.

### 6.4 Durability, idempotency and recovery

- Persist a local correlation record before initiating side effects.
- Bind Cormia taskId, manifest digest, attempt ID, provider identity, Masumi agentIdentifier, purchaser nonce, blockchainIdentifier, payment identifier, network and deadlines.
- Use idempotency keys where the API supports them; otherwise reconcile remote state before retrying a non-idempotent call.
- Never blindly retry POST /purchase, refund or other financial side effects after timeout.
- Recover from remote state using the Masumi identifiers and durable Cormia task journal. A process restart must not orphan a locked escrow or duplicate a purchase.
- Expired deadlines, unavailable payment service, ambiguous chain state or failed reconciliation result in BLOCKED/manual review, not guessed success.

### 6.5 Verification and disputes

- Recompute SHA-256 over the exact canonical result bytes received; compare with Masumi's submitted digest.
- Preserve input/result hashes, content-addressed artifact references, source transaction references and the verifier profile.
- A hash match proves byte consistency only. Semantic correctness, execution provenance, model identity, privacy, completeness and AEP task acceptance require their own verifier claims.
- Masumi dispute resolution may involve Masumi-controlled 2-of-3 multisig administration according to the current contract documentation. Cormia must disclose this external trust assumption and must not represent it as permissionless AEP arbitration.
- AEP challenge/verification and Masumi refund/dispute are separate processes with separately recorded deadlines and outcomes.

## 7. Explicit exclusions

v0.1 does not include:

- replacing Cormia identity or local protocol keys with Masumi NFT identity;
- adopting DID claims not established by the inspected Masumi identity specification;
- replacing CRC or the reciprocity model with transferable tokens or paid API billing;
- remote execution of local agents by default or public exposure of local nodes;
- Masumi as scheduler, Supervisor, capability authority, verifier, reputation oracle or governance authority;
- automatic agent hiring, payment, refund, dispute, withdrawal or wallet provisioning;
- x402 direct/non-refundable payment;
- automatic currency conversion or shared treasury;
- on-chain logging of every internal Cormia decision;
- Cardano validator changes, new AEP normative semantics, or mainnet use.

## 8. Failure behavior

| Condition | Required behavior |
|---|---|
| Masumi unavailable | Local operation continues; external task is BLOCKED or not offered |
| Registry metadata invalid/stale | Reject candidate; retain diagnostic evidence |
| Unknown NFT policy/network | Identity remains unverified; no paid interaction |
| Provider endpoint fails validation | Reject endpoint; do not send credentials or task data |
| Price/asset/unit mismatch | Reject before payment preparation |
| Payment state ambiguous | Reconcile read-only; do not retry payment blindly |
| Escrow not confirmed | Do not release task input to the seller |
| Result hash mismatch | Mark evidence FAIL; preserve bytes and open explicit review path |
| Result hash matches but verifier fails | AEP task remains unaccepted |
| Deadline expired | BLOCKED/dispute handling; never infer success |
| Secret leakage suspected | Stop adapter, revoke affected key, preserve redacted incident evidence |

## 9. Test and acceptance plan

No production adapter is accepted until all of the following pass against a pinned Masumi Preprod deployment and versioned fixtures.

### Contract tests

- registry response parsing, unknown-field tolerance and malformed-field rejection;
- NFT identity verification: network, policy ID, asset name, metadata digest and deregistration/burn detection;
- endpoint allowlist, DNS rebinding, redirect, private-IP and SSRF rejection;
- exact asset/unit/decimal handling and overflow/underflow rejection;
- lifecycle mapping for every state listed in section 5.2;
- result hash recomputation over exact canonical bytes;
- no equivalence between Masumi Completed and AEP ACCEPTED;
- no equivalence between Masumi dispute outcome and AEP verifier outcome;
- no CRC mutation from any Masumi event.

### Side-effect safety tests

- preparation mode makes zero payment/wallet/registration calls;
- missing or expired authorization blocks every financial side effect;
- duplicate request and timeout reconciliation cannot create duplicate purchases;
- payment not yet FundsLocked never releases task data to the seller;
- restart at every lifecycle boundary recovers without duplicate payment or orphaned correlation;
- refund request deadline and authorization checks;
- secrets never appear in logs, model context, artifacts or Git.

### End-to-end Preprod pilot

1. Read-only discover one test service.
2. Verify its on-chain identity and metadata.
3. Prepare a zero-side-effect purchase plan.
4. Execute one explicitly approved low-value Preprod escrow purchase using a dedicated test wallet.
5. Verify result bytes/hash and run a separate deterministic verifier.
6. Record the Masumi and AEP outcomes separately.
7. Exercise a failed/timeout/refund fixture without mainnet funds.
8. Publish a redacted evidence packet and pinned dependency/version record.

Mainnet and automatic hiring remain out of scope pending independent security, economic and privacy review.

## 10. Delivery gates

- **M0 — Research baseline:** completed by this document; documentation-based mapping only.
- **M1 — Contract freeze:** confirm Masumi Node version, API schema, identity policy, payment types/units, API key model and dispute semantics; add fixtures.
- **M2 — Read-only adapter:** discovery, metadata normalization, identity verification and endpoint policy; no credentials beyond read-only access and no side effects.
- **M3 — Prepared purchase:** generate and validate purchase plans; still no financial side effects.
- **M4 — Preprod buyer flow:** explicit authorization, durable journal, escrow observation, independent result verification and refund path.
- **M5 — Optional seller publication:** only if Cormia deliberately chooses to publish a hosted, opt-in service endpoint; requires privacy/legal review and dedicated operator-controlled payment infrastructure.

Each gate requires review and tests. Passing a prior gate does not automatically authorize the next.

## 11. M1 source audit update (2026-11-18)\n\nThe follow-on source-level audit is recorded in [MASUMI-M1-CONTRACT-AUDIT-2026-11-18.md](MASUMI-M1-CONTRACT-AUDIT-2026-11-18.md). It pins the inspected Registry Service and Payment Service main commits, maps the current Registry query/search schemas, and identifies an unresolved authentication discrepancy: Registry middleware reads the `token` header while its generated OpenAPI security declaration names `API-Key`. The deployed Preprod version/header and exact identifier-to-policy/asset format remain unverified. Therefore M1 is **PARTIAL / BLOCKED**, not frozen.\n\nM2 is narrowed to `POST /api/v1/registry-entry/` only, using an operator-configured Registry origin and a verified read-only credential after the header discrepancy is resolved. `GET /api/v1/payment-information/` is deferred to a later separately authorized stage. The Payment Service API key permission flags (`canRead`, `canPay`, `canAdmin`) are not interchangeable with Registry Service authentication; no Payment Service key or wallet is needed for M2.\n\n## 12. Repository impact

This proposal is deliberately additive. It does not modify SPEC.md, schemas/task-manifest.schema.json, economics, runtime, verifier, Cardano contracts, or existing adapters. The current architecture-first status remains unchanged.

The existing docs/integration/ADAPTERS.md already establishes that external components are adapters and that protocol authority remains with AEP. This document specializes that boundary for Masumi; it does not supersede the general adapter policy.

## 13. References

Masumi documentation and source inspected on 2026-11-18:

- Introduction: https://www.masumi.network/dev/masumi/documentation
- Identity and NFT: https://www.masumi.network/dev/masumi/documentation/technical-documentation/agent-identity-nft
- Identity core concept: https://www.masumi.network/dev/masumi/core-concepts/identity
- Registry: https://www.masumi.network/dev/masumi/core-concepts/registry
- Payments and escrow: https://www.masumi.network/dev/masumi/core-concepts/payments
- Payment smart contract: https://www.masumi.network/dev/masumi/documentation/technical-documentation/smart-contracts/payment-smart-contract
- Agent state persistence and recovery: https://www.masumi.network/dev/masumi/documentation/technical-documentation/agent-state-persistence
- Cardano Developer Portal: https://developers.cardano.org/docs/build/integrate/ai-agents/masumi/

Documentation is mutable. Pin the deployed Masumi Node, API and contract versions before implementation; this proposal does not claim a live integration or an independent audit of Masumi.
\n\nSee also the source-pinned M1 audit: https://github.com/LiberoNuvola/Cormia/blob/work/exp-generalization-crosswalk/docs/integration/MASUMI-M1-CONTRACT-AUDIT-2026-11-18.md\n