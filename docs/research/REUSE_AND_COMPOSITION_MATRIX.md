# Reuse and composition matrix

**Status:** working integration design, not a code-vendoring authorization.  
**Date:** 2 November 2026

This matrix preserves the actual IMMORTAL assets already built and identifies upstream concepts/components to study. A reference, interface, design pattern, source-code dependency and fork are different things. AEP must record which one it is doing for each component.

## A. Preserve the existing IMMORTAL nucleus

| Existing component | Already available / evidenced | AEP role | Rule |
|---|---|---|---|
| IMMORTAL Local Agent v0.8.0 | Granite 4.2 via llama.cpp; task-store lineage; Coding Workspace; Resource Manager; Evolution Manager; Docker candidate tests | First local worker and reference Runtime | Preserve the working code and backups. Extract adapters around it; do not rewrite it as a greenfield AEP runtime. The local context-window failure during `EVOL-20261102072415-46c24ca0` is a recovery test case, not a reason to discard the persistent run. |
| Flux Point plugin | Existing `Immortal-Protocol` branch has `.fluxpoint-gates.json`, `scripts/harness.sh`, pilot workflow and documented version/commit | Engineering DoD gate and declarative agent-campaign executor | Reuse the installed plugin or adapt its public contracts. Do not treat its local Stop hook as on-chain authority. Upstream reviewed version 1.49.0 / recorded source commit `175c0a79f9a998b5fe1e212b511dd490ec06f4a8`, Apache-2.0; re-check before vendoring/upgrading and preserve notices/modified-file notices. |
| JEV evidence registry / plugin surface | `audit/jev/`, schemas, generators, validators, result vocabulary and workflows in `Immortal-Protocol` | Evidence normalization for task, worker, verifier, challenge and compute receipts | Keep PASS/FAIL/BLOCKED/NOT_RUN semantics and limitations. Add versioned schemas; do not make JEV a scheduler, wallet or credit issuer. Check the exact package/source license before copying code into AEP. |
| Mitsuro read-only MCP | `integrations/mitsuro/jev-readonly-mcp.mjs`, test, README, workflow | Optional read-only observer for public GitHub/JEV records | Preserve the four GET-only tools, fixed repository/branch, allowlist and no-token/no-shell/no-write design. Do not broaden it into a task executor or protocol authority. |
| Materios / FluxPoint Studios endpoints | Existing Materios/B3 endpoint and provenance references | Optional network/provenance adapter, if independently justified | Do not confuse Flux Point plugin with FluxPoint Studios/Materios infrastructure. Do not infer current availability or protocol authority from historical references. |

## B. Compose upstream prior art through adapters

| Source | Reusable piece to study | AEP composition | What not to assume |
|---|---|---|---|
| Flux Point plugins | Definition-of-Done harness, per-edit checks, execution attestations, graph IR/compiler, provenance and replay | `AEP Engineering Gate` adapter producing typed evidence and campaign records | A green local harness is not a cryptographic proof and does not authorize settlement. Apache-2.0 obligations apply if code is vendored. |
| A2A | Agent Card/discovery, task interaction, streaming and artifact exchange | `A2A Adapter` at network boundary | A2A discovery is not capability authorization or economic settlement. |
| MCP | Tool/resource/prompt protocol | `MCP Capability Adapter` translating tool declarations into proposed capabilities | MCP exposure is not permission; AEP policy engine decides allowed scope. |
| ERC-8004 | Identity/reputation/validation registries | Identity and validation interoperability mapping | EVM/NFT contracts are not imported directly; reputation is not correctness. |
| VCAP / PACT | Delivery commitments, co-signed contracts, verdict/outcome, escrow/settlement decomposition | Field-level compatibility mappings against AEP Task Manifest, Delivery, Verdict and Outcome | Both are draft proposals, not approved IETF standards; version and expiry must be rechecked. |
| Senda | Volunteer peer mesh, capability-aware serving, local/mesh choice and contribution accounting | Comparative reference for the consumer experience and node-serving flow | The compute-for-credits idea is not novel by itself. Peer operators can see prompts unless an effective stronger privacy profile is in place. |
| Decoupled AI / d-compute | Rust node, P2P discovery, credit concept, VRAM-aware placement, inference runtime | Candidate implementation to benchmark and possibly interoperate with | The public status page calls it developer preview; layer-sliced execution and escrow have been described as in progress/specified, not assumed production-ready. Verify repository source and license before reuse. |
| Petals | Distributed transformer-layer serving and volunteer nodes | Later `Split Inference` backend for models that do not fit on one peer | Splitting layers is not a proof of prompt confidentiality; measure activation leakage, peer collusion, latency and failure recovery. |
| BOINC | Work-unit validation, replication, agreement and credit after accepted work | Useful-work accounting and delayed credit-finality patterns | Batch scientific jobs differ from stochastic low-latency LLM inference. Exact output comparison is not universally valid for LLM answers. |
| Golem | Provider/requestor resource offers and provider lifecycle | Optional compute-provider lifecycle comparison | GLM/token settlement is not the default no-customer-token CRC path. |
| Morpheus Lumerin | Distinction between local inference and remote marketplace access | Local-first UX comparison | Remote marketplace paths may require token/staking/gas; don't make them a prerequisite for AEP local use. |

## C. Proposed AEP adapters and data flow

```text
IMMORTAL Local Agent v0.8.0
  ├── Model Gateway (llama.cpp / local open-weight model)
  ├── Resource Manager (local admission, lease, preemption)
  ├── Task Store (durable task identity/checkpoint/resume)
  ├── Coding Workspace + Docker (bounded execution)
  ├── Flux Point adapter (DoD, graph campaign, independent gate evidence)
  ├── JEV adapter (normalized evidence/verdict records)
  └── Mitsuro adapter (read-only public evidence observation)
             │
             ▼
IMMORTAL-AEP Runtime Adapter
  ├── Task Manifest and capability enforcement
  ├── Worker identity and signed delivery/compute receipts
  ├── CRC accounting for opt-in reciprocal inference
  ├── Privacy-mode selection / no silent remote fallback
  └── Protocol-state reconciliation
             │
             ▼
IMMORTAL-AEP Network and Cardano Adapter
  ├── peer discovery / capability advertisement
  ├── off-chain signed receipt log and independent reconstruction
  ├── epoch commitments + data availability + challenge path
  └── optional escrow, bond, dispute and settlement for task commerce
```

## D. Reuse decision rules

Before source is copied, vendored, forked or linked as a dependency, record:

1. exact upstream repository, release/tag/commit and file list;
2. SPDX license and any NOTICE/attribution obligations;
3. dependency and supply-chain review;
4. security boundary and permissions of the imported component;
5. adapter contract and tests demonstrating the component cannot exceed AEP authority;
6. update policy, fork divergence and rollback route.

The default is **interop or a narrow adapter**, not vendoring. Source code reuse requires a separate recorded decision. `LICENSING-DECISION.md` remains a publication blocker until AEP's own license and third-party notice policy are selected.
