# No-Mandatory-Cash Access Model

**Status:** design proposal / non-normative until ratified  
**Working product name:** IMMORTAL Hive  
**Protocol:** IMMORTAL Autonomous Execution Protocol (AEP)  
**Date:** 2026-11-02

## 1. The economic question

Can IMMORTAL provide useful AI access without subscriptions, paid API-token meters, or mandatory purchases?

**Yes, for the user-facing payment path. No, if “free” is taken to mean that computation has no cost.** The system must identify who supplies hardware, electricity, bandwidth, storage, maintenance, model distribution, bootstrap infrastructure, and any on-chain transaction fees.

The design objective is therefore **zero mandatory cash payment by the end user**, not zero resource cost.

## 2. Three access lanes

### L — Local-first, always available

- The user downloads the application and a compatible open-weight model.
- Inference runs on the user's device, including when offline.
- No account, wallet, subscription, external API key, remote prompt routing, or protocol credit is required.
- The user bears the local electricity, device wear, storage, and model-download/network costs.
- The client MUST disclose the model licence and MUST NOT silently send prompts to a remote provider.

### R — Reciprocal mesh

- Compute contribution is opt-in and bounded by the local node's Resource Manager.
- A contributor's node serves eligible tasks from the network.
- The contributor receives non-transferable Compute Reciprocity Credits (CRC) only after the agreed receipt and verification process.
- CRC grant access quota to eligible shared inference/compute. They are not cash, not redeemable for fiat, not transferable, and have no promised market or fixed fiat value in the initial design.
- A user may consume CRC earned earlier without contributing during that session.
- If the CRC balance or mesh capacity is insufficient, the client queues, uses local inference, or asks whether a disclosed sponsored pool is available. It MUST NOT create an undisclosed bill or paid API fallback.

### C — Community-sponsored capacity

- Individuals, institutions, public-interest grants, research programmes, or other sponsors may donate compute or fund shared worker capacity.
- Allocation rules, caps, eligibility, queue priority and remaining pool capacity must be public and auditable.
- Sponsored capacity is finite. It is not a guarantee of unlimited free remote inference.
- No one must be forced to contribute hardware to use the local lane.

## 3. Who bears which costs?

| Cost | Local lane | Reciprocal mesh | Sponsored pool |
|---|---|---|---|
| Electricity | User | Worker/contributor | Sponsor or donated worker |
| Hardware purchase/depreciation | User | Contributor | Sponsor or donated worker |
| Bandwidth | User | Worker and requester/relay operators | Sponsor/donated infrastructure |
| Model storage/download | User | Contributor; optionally mirrors | Sponsor/community mirrors |
| Runtime maintenance | User/community | Community/maintainers | Grants/sponsor/community |
| Bootstrap/discovery/relay | Optional local/LAN setup | Volunteer operators or sponsor | Sponsor/community |
| Cardano anchoring fees | None required | Aggregated fee paid by designated relayer/treasury if enabled | Sponsor/treasury if enabled |

No individual user payment is necessary for the local lane. A reciprocal network can operate without user cash purchases if contributors voluntarily provide capacity and the protocol does not promise more service than the available supply. A sponsored pool requires a donor, grant, institution, or other source of resources. Network costs are borne in kind or by a sponsor; they do not disappear.

## 4. Credits are access accounting, not a token launch

CRC are intended as an internal reciprocity meter, not as a speculative asset.

V1 design constraints:

- no public sale;
- no transfer between user identities;
- no cash/fiat redemption;
- no investment, yield, staking return, or price promise;
- no requirement to hold CRC for local inference;
- no fixed conversion into money;
- no on-chain transaction for every prompt.

The protocol must not issue CRC merely for uptime, claimed GPU-hours, raw token counts, or self-reported benchmark scores. A contribution receipt should bind at minimum: task/workload identifier, model digest, runtime identity/version, worker key, execution interval, declared resource class, output/evidence digest, verifier profile, verifier result, and signatures. Hardware telemetry is evidence, not automatically truth.

A workload-specific normalization method is required before production credit issuance. It must account for model size/quantization, task type, latency class, accepted output, and verification cost. Coefficients must be experimentally calibrated and versioned; this document introduces none.

## 5. Verification limits

Inference outputs are often stochastic. Re-running a prompt on another GPU may produce different but acceptable text, and agreement between peers does not prove semantic truth. A signed receipt proves who made a claim, not that the computation or answer was correct.

Verification profiles must state their assurance level:

1. **Execution/accounting evidence:** confirms that a worker returned an artifact under a declared model/runtime identity; it does not prove correctness.
2. **Deterministic task validation:** checks structured outputs, hashes, unit tests, constraints or other objective predicates.
3. **Independent replication/audit:** compares independently produced results or sampled executions; useful against faults, but vulnerable to collusion and common-mode failures.
4. **Attested execution:** may bind a run to hardware-backed measurements, subject to the specific hardware vendor and attestation trust assumptions.
5. **Cryptographic proof:** optional zkVM/zkML or other proof where a practical circuit/system exists; not a universal prerequisite for general LLM inference.

The network must distinguish “work accepted for service accounting” from “answer proven true”. General-purpose chat must not be marketed as trustless or confidential merely because it ran on a peer.

## 6. Privacy and user control

- Local mode is the default for private or sensitive prompts.
- Remote inference explicitly discloses that the serving peer receives the prompt in plaintext unless a separately specified privacy technology changes that fact.
- A worker must not receive arbitrary shell access to the contributor's device. Model serving is isolated from personal files, credentials, wallets and user sessions.
- The user can pause/preempt compute sharing and set resource, schedule, power, thermal, battery and network limits.
- The Resource Manager must fail closed when telemetry is missing or ambiguous, using existing approved policies rather than invented thresholds.

## 7. No per-prompt chain fee

High-frequency low-value inference receipts should be recorded in a reconstructible signed off-chain log. If Cardano anchoring is enabled, the network may periodically commit an aggregate Merkle root or epoch commitment. This reduces transaction frequency; it does not eliminate ledger fees. A designated relayer, community treasury, grant, or sponsor must fund those transactions. If no funding is available, local and off-chain reciprocal operation remains available, while on-chain anchoring pauses transparently.

High-value task contracts, escrow, disputes and payouts are separate from everyday chat. They must not be prerequisites for local inference.

## 8. Supply/demand and fairness

A reciprocal mesh cannot guarantee instant capacity at all times. When demand exceeds volunteered capacity, it should:

- expose availability and queue estimates;
- offer local fallback or smaller compatible models;
- enforce transparent per-identity quotas and abuse controls;
- prioritize according to published policy, not undisclosed operator discretion;
- keep sponsored capacity visibly separate from earned CRC capacity;
- never promise infinite capacity against finite volunteer supply.

Sybil resistance and account recovery must not introduce a privileged identity administrator. The threat model and identity mechanism require separate review.

## 9. Proposed minimum viable rollout

1. **M0 — Local AI:** installer/model manager, model licence/hash record, offline inference, explicit local/remote indicator.
2. **M1 — Two-node LAN mesh:** capability advertisement, opt-in worker, bounded inference endpoint, signed job/result receipt; no token and no blockchain dependency.
3. **M2 — Internet mesh:** peer discovery, authenticated encrypted transport, abuse resistance, privacy warnings, resource preemption and reliable retries.
4. **M3 — Reciprocity accounting:** workload-specific benchmarks, receipt validation, independent sampling and non-transferable CRC ledger; initially off-chain and reconstructible.
5. **M4 — Cardano anchoring:** periodic commitments and dispute/escrow integration only after threat model, data availability, costs and economic invariants are validated.
6. **M5 — Sponsored pool:** transparent grant/community capacity and public allocation accounting.

## 10. Prior art and differentiation discipline

Senda publicly describes a peer-to-peer LLM mesh, free chat, contributor credits that are not cash, and a separate paid API preview. Decoupled AI describes contributing hardware for network credits and access to shared models. These projects establish that the broad “contribute compute, receive AI access” concept is prior art.

IMMORTAL must not claim to invent compute reciprocity. Its potential contribution must be demonstrated in the integration of: guaranteed local/offline access; bounded resource-aware workers; deterministic capability governance; durable evidence and verification; non-speculative reciprocity accounting; optional Cardano anchoring/settlement; and governed self-improvement. This is a research hypothesis, not yet a proven novelty claim.

## 11. Open decisions

- model catalogue and licence acceptance policy;
- peer discovery and bootstrap design;
- transport and prompt confidentiality profile;
- CRC earning/spending normalization and expiration policy;
- verifier selection, sampling and collusion defence;
- identity/Sybil resistance;
- sponsored pool governance;
- Cardano anchoring epoch and fee sponsorship;
- legal review of the proposed non-transferable, non-redeemable credit design in relevant jurisdictions.

No legal classification is asserted by this document. No CRC issuance, monetary claim, production escrow, or public compute marketplace is authorized by this draft.

## 12. References

- Senda, peer mesh and contributor credits: https://senda.network/ and https://senda.network/contribute
- Senda terms and separation between non-cash credits and any paid-service liability: https://senda.network/terms
- Decoupled AI: https://decoupled.ai/
- BOINC job replication: https://github.com/BOINC/boinc/wiki/Job-replication
- BOINC validators: https://github.com/BOINC/boinc/wiki/Validators
- Petals: https://github.com/bigscience-workshop/petals
- exo: https://github.com/exo-explore/exo
