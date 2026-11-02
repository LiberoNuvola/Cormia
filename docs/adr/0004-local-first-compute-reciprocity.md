# ADR-0004: Local-first AI and compute reciprocity instead of mandatory token billing

- **Status:** Proposed
- **Date:** 2026-11-02
- **Decision owners:** IMMORTAL-AEP maintainers / future community governance

## Context

The initial AEP design described escrowed task commerce. The existing IMMORTAL local agent already runs a local open-weight model and has a Resource Manager capable of observing CPU, RAM and GPU availability. The project also has a prior Flux Point engineering harness pilot, JEV evidence registry and Mitsuro read-only MCP bridge.

The user-facing objective is to let people download and use AI without a subscription or customer-facing API-token charges, while allowing volunteers to share spare compute and receive access to network inference in return.

This idea has direct prior art. Senda describes a peer-powered model mesh and contributor credits. Decoupled AI describes a credits-for-remote-inference model. Petals demonstrates collaborative inference across volunteer model shards. BOINC provides a long-standing model for useful-work validation, replication and contribution credits. AEP must acknowledge this prior art and differentiate through its normative execution/evidence/economic integration rather than claiming to invent reciprocal compute.

## Decision proposal

1. **Local-only access is always available** without account, wallet, subscription, external API key or network prompt routing, subject to hardware and model licence.
2. **Shared inference uses Compute Reciprocity Credits (CRC)** earned from accepted useful contribution. CRC are non-transferable usage rights, not a native cryptocurrency token, not a cash claim and not redeemable for fiat in v1.
3. **No hidden paid fallback.** When CRC or mesh capacity is unavailable, the client stays local, waits, or uses an explicitly disclosed sponsored pool. It must not silently bill a card or a paid API.
4. **Compute sharing is opt-in and resource-bounded.** The local Resource Manager controls leases, thermal/battery limits, user preemption, RAM/VRAM and concurrency.
5. **Credit issuance is evidence-gated.** Online time, claimed GPU seconds, synthetic benchmark scores or raw generated-token counters alone are not sufficient. Use signed receipts, model identity challenges, sampled audits, selective replication and explicit residual assumptions.
6. **No on-chain transaction per prompt.** Low-value high-frequency credit activity is recorded in a reconstructible off-chain signed receipt log with periodic Cardano epoch commitments. High-value task commerce may use separate on-chain escrow and dispute paths.
7. **The consumer path is wallet-optional.** Wallets are needed only for optional on-chain economic roles or payouts, not for local inference or basic CRC use.
8. **Flux Point, JEV and Mitsuro remain in the architecture.** Flux Point supplies engineering DoD/graph workflow patterns; JEV normalizes verification evidence; Mitsuro provides the existing read-only evidence connector. None becomes the economic or protocol authority. See `docs/integration/ADAPTERS.md`.

## Consequences

### Positive

- Removes subscription and API-token metering from the default experience.
- Preserves offline/local use and user control over prompts.
- Rewards actual useful network contribution rather than speculative token holding.
- Reuses an existing Resource Manager and local Runtime as the first worker.
- Avoids chain fees on each chat and keeps on-chain functions focused on commitments, escrow, challenges and governance.

### Costs and risks

- Free local use still consumes hardware, electricity, storage and maintenance.
- Shared inference without contribution depends on a finite sponsored/community pool.
- Credit abuse, Sybil workers, colluding requester/worker pairs and dishonest hardware claims require careful verification.
- Stochastic inference is not universally bit-for-bit reproducible.
- Remote workers can read prompt plaintext unless stronger privacy mechanisms are implemented.
- Off-chain credit accounting needs data availability and independent reconstruction to avoid recreating a centralized operator.

## Not decided

- CRC earning/spending conversion;
- workload benchmark suite and normalization;
- audit probability and verifier quorum;
- epoch length, root commitment and dispute windows;
- whether group CRC pools are allowed;
- sponsor allocation rules;
- whether future paid enterprise tasks use native tokens, stable assets or existing rails.

These values require measurements, adversarial simulations and governance decisions. No numerical coefficient is introduced by this ADR.
