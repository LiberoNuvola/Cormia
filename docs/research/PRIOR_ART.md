# Prior-art register and reuse strategy

**Research snapshot:** 2 November 2026
**Purpose:** identify existing standards, proposals, research, and software that IMMORTAL-AEP should interoperate with, adapt conceptually, benchmark against, or deliberately not duplicate.

This is a living register, not a legal opinion or exhaustive novelty search. Internet-Drafts are work in progress. Versions and licenses must be checked again before implementation or release.

## 0. Current Cormia architecture composition review — 3 November 2026

The architecture added on 2026-11-03 now has a component-by-component prior-art review. Read [Cormia Prior-Art Composition Review v0.1](CORMIA_PRIOR_ART_COMPOSITION_REVIEW_2026-11-03.md) before creating a new Runtime, Team Room, Workbench, Resource Broker, receipt schema, sandbox, evidence log or support service. That review maps each current proposal to upstream systems, records adopt/adapt/spike/reference decisions and defines six bounded implementation spikes.

The existing register below remains the broad baseline for AEP/IMMORTAL prior art. The 3 November review is the current crosswalk for the newer Cormia Core-first, Coordination Plane and Materios work-completion proposals. It does not authorize code vendoring or claim production conformance.

## 1. Standards and protocol proposals

| Prior art | Existing problem it addresses | Reuse / integration strategy | Boundary: what IMMORTAL must still define |
|---|---|---|---|
| **A2A** | Agent discovery via Agent Cards, authenticated agent interaction, messages, task lifecycle, artifacts, streaming and async updates. | Implement an A2A adapter for discovery and communication. Map AEP task IDs and artifact references to A2A where possible. Reuse its interoperable interaction patterns instead of inventing another agent messaging protocol. | A2A does not define IMMORTAL's economic escrow, capability authority, assurance semantics, dispute outcomes, or Cardano settlement. An A2A state is not automatically an AEP state. |
| **MCP** | Standardized client/server access to tools, resources, prompts, and related capabilities. | Use MCP adapters to connect worker runtimes to external tools. Convert MCP tool declarations into candidate capability descriptors; enforce actual authority in the AEP Policy/Capability Engine. | Tool discovery is not authorization. A tool being exposed by MCP does not mean a task is allowed to invoke it, and a successful tool call is not proof of task completion. |
| **ERC-8004** | On-chain agent identity, reputation, and validation registries intended to support interactions without pre-existing trust. | Use as comparative schema/reference for interoperable agent identity documents, reputation signals, and validation requests. Consider cross-chain identity references. | It is EVM-oriented and states that payments are orthogonal/out of scope. Do not copy ERC-721 registry contracts into Cardano by default. Reputation is not proof, and Sybil resistance remains unresolved. |
| **VCAP draft-02** | Agent-to-agent commerce using escrow, delivery evidence, independent verification engines, and release/refund callbacks. | Map its problem decomposition, delivery evidence binding, escrow lifecycle, and verification callback concepts against the AEP state machine. Build a compatibility note before implementing overlapping objects. | VCAP is an individual informational Internet-Draft, not an IETF standard. AEP still needs its own eUTXO resource model, capability model, assurance levels, risk policy, and governance. Re-check the draft for changes/expiry. |
| **PACT draft-03** | Co-signed task contracts, Delivery and Verdict records, facilitator event trace, Outcome records, subcontract commitments, and liability. | Treat its signed-contract / delivery / verdict / outcome separation as a key prior-art comparison. Explore field-level interoperability and Merkle commitments for task trees. | PACT is an experimental Internet-Draft, not an IETF standard. AEP must define its own Cardano settlement adapter, assurance policy, capability enforcement, and economic policy. No claim of novelty over these object patterns. |
| **Cardano eUTXO / Plutus** | Deterministic validation of transactions against consumed UTxOs, datums, redeemers, and validator logic; off-chain construction with on-chain validation. | Use a separate state/escrow UTxO per task or carefully partitioned task state. Keep validators limited to deterministic transition and asset-flow checks. Keep execution, inference and artifact storage off-chain. | AEP must define UTxO layout, concurrency/contention handling, state token policy, datum commitments, transaction budgets, timeout paths, and conformance tests. Avoid one shared hot UTxO for all tasks. |
| **CIP-1694 / Cardano governance** | On-chain governance actions, voting, DReps, Constitutional Committee, ratification and enactment lifecycle. | Use as a first-class native governance environment/adapter where appropriate; document which decisions belong to AEP governance versus Cardano protocol governance. | AEP governance is not automatically Cardano network governance. Do not conflate votes over AEP parameters with Cardano governance actions. Analyze capture, participation and emergency powers independently. |

## 2. Compute verification and proof systems

| Prior art | What it contributes | Reuse / caution |
|---|---|---|
| **Lilypad** | Permissionless two-sided compute marketplace; its research describes off-chain matching, on-chain deals/deposits, replication-based verification and GPU-compute validation limitations. | Benchmark the compute-provider model, resource-provider incentives and verification approaches. Do not assume GPU outputs are bit-for-bit reproducible across hardware. Study replication, fingerprinting and profile-based verification as distinct assurance options. |
| **RISC Zero zkVM** | Cryptographic receipts can attest that a specified guest program ran and produced committed public outputs, identified by an image/program ID. | Use as an optional proof adapter for tasks whose computation can be expressed in a supported zkVM. A receipt proves the encoded statement/execution, not that the program or task specification is semantically correct. Cost and memory requirements must be benchmarked. |
| **TEE / remote attestation ecosystems** | Attestation can bind execution to a hardware and software measurement under a vendor trust chain. | Optional profile only. Publish vendor, firmware, attestation roots, revocation and side-channel assumptions. Never call TEE-based assurance trustless. |

## 3. Agent Runtime and self-improvement research

| Prior art | What it contributes | Reuse / caution |
|---|---|---|
| **OpenHands** | Open-source agent server, tools, workspaces, sandbox-oriented deployment patterns and developer control plane. | Evaluate reusable components only after license, dependency, architecture and security review. Prefer interop or isolated adapters before vendoring code. OpenHands describes multiple repositories and explicitly distinguishes UI from execution/sandbox services. |
| **SWE-agent** | Demonstrates the importance of agent-computer interfaces for repository navigation, editing, and test execution. | Use as evidence that tool/interface design affects engineering-agent performance. Benchmark runtime interfaces rather than assuming prompt changes alone solve coding reliability. |
| **Darwin Gödel Machine (DGM)** | Empirical iterative self-modification of coding agents, benchmarking candidate variants and retaining an archive of solutions. | Adopt the principle of empirical validation and candidate archives. AEP must add protocol-level authorization, immutable baselines, evidence linkage, risk budgets, and controlled promotion. |
| **A Self-Improving Coding Agent** | Research on coding agents that autonomously modify themselves and evaluate improvements on benchmark tasks. | Treat as self-improvement prior art; distinguish benchmark improvements from security, economic, and on-chain correctness. |

## 4. Peer inference, volunteer compute and reciprocity

The user-facing idea of sharing personal hardware to access AI without subscriptions is active prior art. See the field-level comparison in [`DECENTRALIZED_INFERENCE_PRIOR_ART.md`](DECENTRALIZED_INFERENCE_PRIOR_ART.md).

- **Senda:** closest current public example of a peer-powered open-model mesh, free chat without account, volunteer nodes and contribution credits. Its current materials disclose early-access limitations, peer prompt visibility, no TEE/encrypted-inference guarantee, and an observe-mode peer verification status.
- **Decoupled AI / d-compute:** describes compute credits and distributed inference; the current status page labels it developer preview and states that real layer-sliced execution is still in progress.
- **Petals:** established collaborative inference research/software with transformer layers served by volunteer nodes; public prompts are processed by other participants.
- **BOINC:** useful-work work units, replicated computation and delayed credit granting after result comparison; batch/scientific orientation differs from interactive LLM inference.
- **Golem:** provider/requestor compute market and GLM payment; useful provider lifecycle and resource offer patterns, not our no-customer-token path.
- **Morpheus Lumerin:** separate local `llama.cpp` demo from a remote marketplace that uses MOR/ETH; useful local-first precedent, though its remote consumer path is tokenized.

AEP must not claim the credit-for-compute model itself as novel. Its possible contribution is a verifiable composition of reciprocal access, task-scoped capabilities, Resource Manager enforcement, deterministic engineering gates, JEV evidence normalization, read-only audit connectors, on-chain epoch commitments, challenges and governance.


## 4A. Local model post-training with constrained GPU memory

- **Soup CLI / Layer Streaming:** open-source local LLM training/post-training toolkit. Its optional BETA streaming path keeps the frozen quantized base in CPU RAM (with NVMe overflow) and loads one decoder layer at a time into VRAM while LoRA adapters and optimizer state remain on-device. It is a candidate for low-VRAM local adapter production, not a decentralized inference mesh or a substitute for peer execution/reciprocity. The reported Llama-3.1-8B-on-4GB result is configuration-specific and Soup's own page distinguishes pre- and post-correctness-repair measurements; do not generalize the benchmark. Granite 4.0 H Tiny recipe availability does not establish Granite 4.2 8B compatibility. See [DECENTRALIZED_INFERENCE_PRIOR_ART.md](DECENTRALIZED_INFERENCE_PRIOR_ART.md), section 1A, for the bounded Cormia evaluation and provenance requirements.

## 5. Existing IMMORTAL implementation assets to preserve

The existing `Immortal-Protocol` work branch already contains a Flux Point DoD pilot, JEV verification registry assets and a Mitsuro JEV read-only MCP bridge. These are not fresh ideas to replace with a new stack:

- Flux Point pilot: `.fluxpoint-gates.json`, `scripts/harness.sh`, `.github/workflows/fluxpoint-dod-pilot.yml`, `docs/04-verification/FLUXPOINT-DOD-PILOT.md`.
- JEV: `audit/jev/`, `scripts/*jev*`, `.github/workflows/jev-*`, verification-registry schema and tests.
- Mitsuro: `integrations/mitsuro/jev-readonly-mcp.mjs`, its tests and README; fixed repository/branch and four GET-only tools.
- Local Runtime: IMMORTAL Agent v0.8.0 with Granite, task store lineage, Coding Workspace, Resource Manager and Evolution Manager.

The exact mapping and limitations are documented in [`../architecture/EXISTING_LOCAL_NUCLEUS.md`](../architecture/EXISTING_LOCAL_NUCLEUS.md) and [`REUSE_AND_COMPOSITION_MATRIX.md`](REUSE_AND_COMPOSITION_MATRIX.md). Preserve these components and build AEP adapters around them; do not replace them without compatibility tests and an ADR.

## 6. Proposed composition in IMMORTAL-AEP

The intended composition is deliberately modular:

1. **A2A adapter:** agent discovery, agent card, task messages, streaming, artifact exchange.
2. **MCP adapter:** tools/resources/prompts presented to a worker; AEP capability engine remains authoritative.
3. **AEP Task Contract:** canonical task manifest, signatures, capability grants, resource limits, economic terms, assurance and dispute profile.
4. **AEP Evidence Model:** versioned delivery, evidence package, verifier verdict, outcome record, and task event chain.
5. **Cardano adapter:** on-chain task commitment, escrow/bond accounting, state transitions, challenge and settlement.
6. **Worker Runtime:** model gateway, task engine, resource manager, sandbox, evidence builder and chain client.
7. **Verifier network:** independent deterministic verification, replication, optional zk proofs and explicit fallback rules.
8. **Governance:** versioned updates with timelock and no retroactive rewriting of already-funded task terms.

## 7. What we should not do

- Do not fork or copy an entire codebase because it is popular.
- Do not copy normative prose from standards or Internet-Drafts into SPEC.md; summarize, cite, and define our own interface.
- Do not assume a public Internet-Draft is stable or license-free.
- Do not claim AEP invented escrow, agent identity, signed contracts, task state machines, replication, challenge windows, or zk execution proofs individually.
- Do not equate a successful test run with proof of correct behavior for every input.
- Do not treat a model-generated summary, self-reported log, reputation score, or stake amount as a correctness proof.
- Do not copy runtime code into this repository until its exact license, dependency licenses, security posture, attribution obligations and ownership are reviewed.

## 8. Research gaps to investigate

1. AEP versus VCAP/PACT: field-level mapping, state machine differences, liability semantics, verifier independence and Cardano eUTXO mapping.
2. A2A task lifecycle to AEP lifecycle mapping, including cancel, pause, resume, artifact updates and terminal states.
3. MCP 2026-07-28 protocol changes and current SDK support; maintain a tested adapter version matrix.
4. Sybil resistance and verifier collusion under permissionless participation.
5. Heterogeneous/GPU non-determinism and risk-tiered verification.
6. Task-level capabilities and nested delegation/attenuation.
7. Economic failure, griefing, worker churn, requester cancellation and escrow liveness.
8. Governance capture, emergency powers, parameter migration and version coexistence.
9. What claims can be proved by zkVM receipts, TEE attestation, deterministic re-execution, or only by subjective arbitration.

## 9. Sources

- A2A specification: https://a2a-protocol.org/latest/specification/
- A2A task lifecycle: https://a2aproject.github.io/A2A/latest/topics/life-of-a-task/
- MCP specification 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28
- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- VCAP draft-02: https://datatracker.ietf.org/doc/draft-stone-vcap/
- PACT draft-03: https://datatracker.ietf.org/doc/draft-laxsharma-pact/
- Cardano Plutus / eUTXO: https://docs.cardano.org/developer-resources/smart-contracts/plutus
- Cardano eUTXO explainer: https://docs.cardano.org/about-cardano/learn/eutxo-explainer
- Cardano transaction cost and determinism: https://docs.cardano.org/about-cardano/learn/transaction-costs-determinism
- Cardano governance CIP-1694: https://cips.cardano.org/cip/cip-1694
- Lilypad compute problem statement: https://docs.lilypad.tech/lilypad/research-and-vision/v1-research-documents/problem-statement
- Lilypad GPU validation: https://docs.lilypad.tech/lilypad/research-and-vision/validation-of-gpu-compute
- RISC Zero zkVM: https://dev.risczero.com/api/zkvm
- Darwin Gödel Machine: https://arxiv.org/abs/2505.22954
- Senda: https://senda.network/; contributor credits: https://senda.network/contribute; security: https://senda.network/security
- Decoupled AI / d-compute: https://decoupled.ai/
- Petals: https://github.com/bigscience-workshop/petals
- BOINC work and credit flow: https://boinc.berkeley.edu/intro.php
- BOINC validators: https://github.com/BOINC/boinc/wiki/Validators
- Golem provider model: https://docs.golem.network/docs/providers
- Morpheus local model and marketplace: https://nodedocs.mor.org/get-started/introduction
- SWE-agent / NeurIPS 2024: https://proceedings.neurips.cc/paper_files/paper/2024/hash/5a7c947568c1b1328ccc5230172e1e7c-Abstract-Conference.html
- OpenHands: https://github.com/OpenHands/OpenHands

**Reviewed:** 2026-11-02. Re-check all current versions, draft status, licenses and IPR before implementation/publication.
