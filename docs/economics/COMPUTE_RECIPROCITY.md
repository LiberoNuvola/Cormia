# Compute Reciprocity Economy (CRE)

**Status:** proposed economic/access model; not yet normative parameters  
**Version:** draft 0.1.0  
**Goal:** user-accessible local AI and shared inference without mandatory subscriptions, API-token billing, or a customer-facing native crypto token.

## 1. Design objective

A user can download IMMORTAL, run an open-weight model locally, and use the local assistant without a subscription or metered external API. If the user opts in to sharing spare CPU/GPU/RAM capacity with the network, the node can earn non-transferable **Compute Reciprocity Credits (CRC)**. Those credits provide a quota to consume shared network inference or other eligible compute services.

“No token billing” means no paid provider API-token meter; the model may still tokenize text internally for inference. The local model remains available when the network is offline, when the user has no CRC, or when no remote worker is available. Network access is an additional capability, not a prerequisite for basic AI access. AEP SHOULD create a local protocol keypair on first run for optional mesh identity; this is not a custodial account or a Cardano wallet. The user may export/back up the key. Losing the key may mean losing access to an account-bound CRC balance; recovery policy must not introduce a privileged identity administrator.

This is a barter/reciprocity accounting model, not a promise that electricity, hardware, network traffic, storage, model weights or maintenance are costless. The user's costs are shifted away from subscriptions and API-token invoices toward local resources and optional compute contribution.

## 2. Three access modes

### Mode L — Local-only

- Model weights are downloaded from an approved source with a recorded hash and license metadata.
- Inference runs entirely on the user's device.
- No network prompt routing, account, wallet, subscription or CRC is required.
- The user pays only their own hardware/electricity/storage costs and accepts the model license.
- The application MUST show clearly that the request is local and MUST NOT silently fall back to a remote provider.

### Mode R — Reciprocal mesh

- The user opts in to serve spare compute under explicit local resource limits.
- Completed, eligible contributions accrue CRC after the applicable receipt/verification rules.
- CRC can be spent on shared mesh inference or other eligible AEP services.
- CRC are non-transferable by default, have no cash redemption, no fixed fiat price and are not a native cryptocurrency token.
- No per-token cash billing is shown to the user. The quota is based on normalized useful work, not raw text-token count alone.
- If CRC are exhausted, the client falls back to local-only mode, waits in a queue, or requests access to a disclosed community-sponsored pool. It MUST NOT create a paid API balance or hidden external bill.

### Mode C — Community-sponsored pool

- Community members, maintainers, research grants or public-good sponsors may donate capacity or fund a limited compute pool.
- AEP governance may allocate a transparent share of available capacity to users unable to contribute hardware.
- Sponsored access is finite and subject to published quotas, queue policy and pool availability. It is not an unlimited free-service guarantee.
- Sponsor identity, allocation rules and expiry must be visible. No sponsor may gain access to user prompts or privileged protocol control as a condition of donation.

## 3. No customer-facing native token in v1

The initial consumer access path SHOULD NOT require:

- purchasing a token;
- staking a token;
- holding ADA or another cryptoasset;
- connecting a wallet;
- paying per generated token;
- subscribing to a hosted inference plan.

CRC is an internal usage-right accounting unit, not an ERC-20/CIP-68 asset and not redeemable for money. The design may anchor periodic accounting commitments to Cardano, but normal inference must not require one on-chain transaction per prompt or generated token.

The AEP protocol may still support separately escrowed economic contracts for high-value compute tasks. Those contracts are optional to the free/local/reciprocal consumer path. Asset-denominated settlement, if later enabled, must be an explicit task class and must not silently change CRC into a speculative or transferable asset.

## 4. Contribution accounting

CRC MUST be earned for accepted useful work, not for merely installing the application, advertising capacity, staying online, reporting GPU seconds, or solving arbitrary proof-of-work puzzles.

A contribution receipt SHOULD bind at least:

- protocol and receipt schema version;
- contributor node public-key identifier;
- task/job identifier and task class;
- model artifact digest, tokenizer digest, quantization and runtime version where applicable;
- hardware/resource profile and a bounded measurement summary;
- input commitment (never plaintext private prompts by default; use a blinded commitment, not a bare hash of a potentially guessable prompt);
- output/artifact digest;
- start/end or service interval and the measured useful-work counters;
- requester/client acknowledgement;
- verifier profile, audit result and any challenge reference;
- a nonce/sequence number preventing replay;
- signatures and content-addressed evidence references.

The receipt is evidence of a claimed service event. It is not, by itself, proof that the model produced a semantically correct answer or that every reported hardware counter is truthful. A public input commitment MUST NOT be a bare hash of a low-entropy prompt: use a random per-receipt blinding value and disclose the preimage only to an authorized verifier when required by the privacy profile and user consent.

## 5. Normalized Useful Work Units

The network needs a model-aware unit of contribution and consumption. The working concept is a **Normalized Useful Work Unit (NUWU)**, a benchmark-derived measure of useful compute under a declared workload class.

NUWU accounting SHOULD take account of:

- model artifact and model family;
- parameter/quantization class;
- context length and output length;
- batch size and concurrency;
- hardware backend and verified throughput envelope;
- successful completion and service quality;
- verification profile and audit outcome.

It MUST NOT be equated mechanically with wall-clock runtime, claimed FLOPs, advertised GPU model, generated token count, or a single synthetic benchmark. The mapping from workload to earned/spent CRC is an open parameter requiring benchmark data, anti-gaming analysis and economic simulation. No fixed conversion rate is approved by this document.

## 6. Verification and anti-abuse layers

A staged design is recommended:

1. **Node/model identity:** publish content hashes for model weights, tokenizer, quantization and runtime; challenge the node with unpredictable synthetic probes. This checks what it appears to serve, not the correctness of every private request.
2. **Signed service receipt:** requester and worker bind the same task, model, completion and output digest. This prevents simple unilateral fabrication but does not prevent collusion.
3. **Randomized audits:** independent verifier nodes issue synthetic challenge jobs and sample node behavior. Audit selection must be unpredictable and replay-resistant.
4. **Selective replication:** important jobs or sampled inference requests are served independently by more than one worker and compared under a declared equivalence rule. Generative outputs may differ; exact string comparison is not a universal correctness test.
5. **Task-specific verification:** software builds/tests, deterministic transforms and structured jobs use executable acceptance checks and evidence packages.
6. **Optional stronger assurance:** TEE attestation or ZK execution proofs only for supported workloads and after explicit cost/security analysis.

A model fingerprint is not proof that every request was actually executed. A worker signature is not proof of correct computation. A replica quorum is not immune to Sybil identities or collusion. The selected assurance profile must state those residual assumptions.

Because CRC are non-transferable and have no cash redemption in v1, successful fraud primarily inflates a usage entitlement rather than stealing cash. That reduces one attack incentive but does not eliminate spam, free-riding, resource exhaustion or credit inflation. Rate limits, randomized audit, per-node quotas, expiry and revocation procedures still need to be designed and simulated.

## 7. Credit finality and accounting topology

Proposed two-layer accounting:

- **Off-chain receipt log:** nodes and clients exchange signed receipts. Participants can reconstruct their own balance from receipts and published rules. This permits high-frequency usage without a chain transaction per request.
- **Epoch commitment:** the network periodically commits a Merkle root or other deterministic digest of an epoch's accepted receipts/balance updates to Cardano. The complete receipt set remains available off-chain under content-addressed references.
- **Challenge path:** a participant can challenge an invalid, duplicate, missing or misattributed receipt under public rules. On-chain validators check signatures, commitments, time bounds, replay protection and value flow; off-chain verifiers check computational statements.
- **No hidden coordinator:** a single service MUST NOT be the only party able to calculate or alter balances. The ledger format, receipt rules and epoch roots must permit independent reconstruction.

The exact epoch cadence, data-availability scheme, challenge window and verifier quorum are open parameters. Cardano validators do not execute LLM inference and cannot prove GPU work merely because a provider submits a datum. They enforce the deterministic commitments and transitions that have been formally specified.

## 8. Privacy modes

- **P0 Local-only:** prompt and inference remain on the user's device.
- **P1 Shared peer:** prompt is sent to the selected peer. Transport encryption protects transit, not plaintext from the peer operator. The UI must disclose this.
- **P2 Attested execution:** only after a supported TEE/remote-attestation path exists; disclose vendor/hardware trust assumptions and side-channel limitations.
- **P3 Split inference:** model layers are distributed across peers. A peer may see activations rather than the full original prompt, but this is not a proof of prompt confidentiality. Leakage and collusion risks remain.

Sensitive tasks SHOULD default to P0. AEP MUST NOT describe P1 or P3 as confidential merely because traffic is encrypted or the model is split across nodes. External API fallback is disabled by default and requires explicit user consent.

## 9. Resource contribution safety

The worker must remain under local owner control:

- opt-in is explicit and reversible;
- CPU/GPU/RAM/VRAM/network/disk budgets are user-configurable;
- idle-only, battery, thermal and foreground-interaction policies are respected;
- user activity can preempt background inference;
- Resource Manager owns admission control and lease release;
- remote tasks cannot request arbitrary host shell, filesystem, secrets, wallet or unrestricted network access;
- only approved model/runtime packages are served by the inference worker;
- model downloads and updates are hash- and license-checked;
- worker uninstall/disable and local-only operation remain available without loss of local files.

## 10. Bootstrapping and fairness

A network with no initial contributors has no remote capacity. AEP must state its bootstrapping source rather than imply free compute appears without cost. “No subscription/no API-token billing” does not mean zero resource cost: local mode consumes the user’s electricity and hardware; remote mode consumes a contributor’s resources; sponsored mode consumes an explicitly funded pool.

Possible sources:

- founder/community seed nodes;
- voluntary contributor pool;
- public-good/research compute grants;
- donations of hardware capacity;
- sponsored capacity with transparent quota.

New users can always run local-only inference. Mesh access without contribution depends on the disclosed sponsored pool; no unlimited entitlement is promised.

Fairness policy must consider model availability, heterogeneous hardware, latency, geography, reliability and privacy profile. It must avoid rewarding mere uptime while starving low-power contributors or concentrating all traffic in a few powerful nodes. Exact scheduler weights remain experimental.

## 11. Prior-art boundary

The core idea of peer-powered free/credit-based AI is not new. Senda publicly describes a peer-to-peer open-model mesh, free chat, volunteer nodes and contribution credits; its site also states that credits are not cash, paid API/Peer USD is an early-access preview, peers can read prompts, and its current privacy/security page documents missing TEE/encrypted-inference guarantees. Decoupled AI describes credits redeemable for remote inference and P2P layer-splitting, while labeling the project a developer preview and stating that real layer-sliced execution is still in progress. Petals demonstrates collaborative model-layer hosting and warns that prompts are processed with help from other participants. BOINC contributes useful work-unit replication and credit validation patterns, but its workloads are batch/throughput oriented rather than interactive LLM chat.

AEP must therefore not claim novelty for “users share compute to obtain free AI” by itself. The possible distinct contribution is a composition with deterministic task contracts, capability-bounded execution, Resource Manager, Flux Point DoD/graph harness, JEV evidence registry, Mitsuro read-only evidence access, Cardano commitments/escrow/disputes, and persistent self-improvement under a versioned normative kernel. This claim requires implementation and comparative experiments.

## 12. Open decisions before implementation

1. Is CRC purely personal/non-transferable, or can family/team accounts pool them?
2. Are credits earned only by inference serving, or also by verifier/storage/documentation tasks?
3. What is the N-UWU benchmark suite and how is it updated without reward manipulation?
4. How are randomized audits selected and funded without a trusted scheduler?
5. What percentage of inference is sampled/replayed for each assurance class?
6. What is the exact Cardano epoch anchor and data-availability design?
7. Can local-only model access remain entirely anonymous and wallet-free? (Proposed: yes.)
8. What sponsor/community pool allocation prevents Sybil abuse and preserves fairness?
9. Which model licenses and distributions are eligible for the default catalog?
10. What privacy profile is the default for network requests? (Proposed: explicit P1 disclosure, no silent remote routing.)

Do not freeze numerical credit ratios, epoch durations, challenge windows, audit probabilities or scheduler weights before measurements and adversarial simulation.


## 13. First implementation profile (proposed)

The first no-subscription user experience SHOULD ship in this order:

1. **Local-only desktop:** download an approved open-weight model; verify its digest and license; run it with the local inference backend; no account, wallet, API key, network request or CRC ledger required.
2. **Opt-in contributor node:** the user explicitly enables idle compute donation. Resource Manager enforces budgets and preemption. Donation mode serves only approved model/runtime packages and never executes requester-supplied shell or arbitrary code.
3. **Reciprocal mesh client:** a local protocol keypair identifies the user's non-custodial CRC account; no Cardano wallet is required. Shared inference displays the selected peer, model digest, privacy class, quota consumption and receipt state.
4. **Sponsored capacity:** a separately identified pool provides bounded remote inference to users who cannot contribute hardware. Quotas and sponsor funding are public; no sponsor receives prompt access or governance privilege by donating.
5. **On-chain audit/settlement:** only after off-chain accounting can be independently reconstructed, batch epoch commitments and challenges are implemented. No per-prompt transaction.

The first mesh mode SHOULD route a whole model to one capable peer. Split-model inference is a later profile because it adds network coordination, activation-leakage and peer-collusion risks.


## 14. Optional project compute reward pool — proposed extension

The current CRC/sponsored-pool model does **not** yet define a project-specific reward bucket whose value is distributed proportionally among users who contribute compute to that project. This section records that additional design candidate; it does not change CRC v1 semantics or adopt economic parameters.

### 14.1 Separate three things

1. **Resource Offer / Lease:** the contributor declares how much CPU/GPU/RAM/network capacity they are willing to make available and under which time, power, thermal, privacy and workload constraints. The host owner can change or revoke the offer. A lease reserves a bounded slice for an eligible task.
2. **Accepted Contribution Receipt:** after a task actually consumes the leased capacity, the system records the task, worker/node, workload profile, useful-work measurements, service quality, completion result and verification evidence. Merely advertising capacity, keeping a machine online or reserving an unused lease does not earn a contribution share.
3. **Project Compute Reward Pool:** a project owner or sponsor may establish a finite, separately identified bucket for an eligible campaign/workstream. The bucket declares its target project, funding/custody status, reward type, eligible workload profiles, contribution period, allocation-rule version, caps, verification and challenge policy, and treatment of any undistributed remainder.

The bucket is a reward budget, not a resource offer and not a lease. The contributor's hardware remains under the contributor's local control.

### 14.2 Candidate proportional allocation

The proposed rule is **pro-rata distribution over accepted useful work**, rather than over promised capacity or raw GPU-hours.

At the end of a declared period or campaign, eligible accepted contribution units are aggregated under the published allocation rule. Each contributor receives a share of the distributable pool corresponding to that contributor's eligible contribution relative to all eligible contributions in the same pool. The pool, eligible workload classes, weighting/quality adjustments, caps, rounding, payout timing and challenge treatment must be fixed and disclosed before work is counted.

No percentage, NUWU-to-reward ratio, quality coefficient, minimum contribution or campaign duration is selected here. The existing NUWU remains a measurement concept whose benchmark and conversion parameters are open. It must not be replaced by self-reported uptime, advertised GPU model, raw FLOPs or an unverified wall-clock counter.

### 14.3 Funding and reward types

A reward pool may declare one of the following distinct benefit classes:
- **Usage-right reward:** non-transferable quota for shared inference or eligible compute. This may be represented through CRC accounting but is still subject to the separate CRC rules.
- **Financial/asset-denominated reward:** a funded amount held by a named custodian or optional payment/economic adapter. It is not a Core wallet balance. A pledge or unfunded promise is not a distributable bucket.
- **Non-financial project benefit:** a declared service, storage, access or other benefit with its own availability and acceptance rules.

These classes are not interchangeable. CRC does not become cash or a transferable token merely because a project creates a reward pool. Financial payout is not implied by a compute contribution. If a project chooses an asset-denominated reward inside an IMMORTAL-governed perimeter, the applicable AEP/IMMORTAL economic contracts and admission rules must be used; ordinary Cormia Core execution remains independent.

### 14.4 User and project controls

- Each user explicitly opts in per project/pool and selects the maximum capacity, schedule and workload/privacy constraints for each node they own.
- A user may contribute more than one PC, but each node/offer is independently validated and bounded; multiplying node identities does not multiply reward without accepted work.
- The owner may pause or revoke an offer. A lease ends at a safe task boundary and no new lease is admitted.
- Only completed and accepted useful work earns a share. Failed, duplicate, unverified or challenged work is excluded or held according to the published rule.
- The project cannot promise shares beyond the funded/confirmed reward pool. If the pool is exhausted or not funded, the system must not create an implicit debt or hidden bill.
- Contribution and reward do not grant project governance, mandate widening, private-data access, tool capabilities or ownership of the project.

### 14.5 Open design questions — do not freeze yet

1. Is the bucket project-wide, workstream-specific, campaign-based, or can it be nested?
2. Is the contribution score based only on normalized useful work, or also on availability, reliability, latency, energy efficiency or quality? Any weighting must be benchmarked and anti-gamed.
3. Are resource providers rewarded for capacity actually consumed only, or can a separately declared reservation fee exist?
4. How are multiple PCs owned by one person aggregated, and how are Sybil/collusion controls applied?
5. Who funds and custodies a financial bucket, and which unused/reversed funds return to whom?
6. What are payout cadence, caps, minimum threshold, challenge window and dispute path?
7. Does a pool distribute only to compute contributors, or also to task authors, verifiers, storage operators and maintainers under separately declared shares?
8. Which reward types are purely internal usage rights and which require an optional financial/economic profile?

This proposal is related to JUR-05 (canonical owner/partition for shared resources) and JUR-06 (worker/verifier allocation, fairness, sponsor and anti-Sybil parameters). Those decisions remain open. 
No PRE-RICH parameter, IMMORTAL rule, CRC conversion ratio or payment mechanism is adopted by this section.

## 15. Work completion certification and Materios — proposed integration boundary

The Project Compute Reward Pool and CRC contribution accounting need a reliable distinction between a **declared task completion**, an **integrity-preserved receipt**, and **accepted useful work**. This section links compute reciprocity to the proposed [Cormia Work Completion Evidence and Materios Certification Adapter](../architecture/CORMIA_WORK_COMPLETION_EVIDENCE_AND_MATERIOS_CERTIFICATION_v0.1.md).

A contributor's Cormia Node is the local resource authority and meter. It enforces the owner's offer/lease limits, isolates the workload and records host-observed CPU/GPU/RAM/VRAM/time counters with meter identity, units and interval. Its signature binds the report to the node key; it does not make an ordinary OS/driver reading cryptographically truthful.

A task-bound Work Completion Receipt should bind the project, task and attempt, assignment/manifest, worker, exact lease, workload, committed input/output, meter profile, acceptance predicate, verifier evidence and replay-protection data. Private prompts, raw datasets, output payloads and telemetry remain off-chain and access-controlled; public commitments require privacy-aware input blinding.

Do not treat all certification as one level:
- receipt/hash/Merkle verification establishes integrity of committed evidence;
- availability attestation establishes that the committed evidence was retrievable under the declared checks;
- a task verifier establishes whether a workload-specific acceptance predicate passed;
- hardware attestation establishes only the measured environment and claims supported by that hardware verifier;
- a ZK/VM proof establishes only its explicitly specified computation and public-input bindings.

**Current Materios boundary:** the existing Orinq/cert-daemon path verifies receipt data against its committed root and supports receipt availability attestation. That does not prove task execution or semantic correctness. The TEE pallet declares AMD SEV-SNP, Intel TDX, ARM TrustZone, reproducible-build and ZK-VM evidence types, but in the source examined only ARM TrustZone has a verifier implementation; the other verifier paths return NotImplemented. The source also records challenge-binding work as a prerequisite to enabling evidence submission. Treat the other evidence classes as planned/unsupported until their implementation and deployed configuration are independently verified. Materios source references and detailed caveats are in the linked architecture proposal.

**CRC mint boundary:** the existing principle remains that credits are earned for accepted useful work, not declared capacity, uptime or raw GPU-hours. A task class must name its required verification profile before execution. Receipt integrity/availability alone does not qualify a task as completed useful work. No universal R2/R3/R4 profile, NUWU-to-CRC ratio, reward formula, tokenization, or Materios economic change is adopted here.

CRC remains a Cormia usage-right unit; it is not MATRA or MOTRA. CRC mint for accepted contributions, CRC burn for service consumption, Materios network fees and financial Project Compute Reward Pool payouts remain separate accounting events.