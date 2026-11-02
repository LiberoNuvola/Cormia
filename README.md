# Cormia — the local-first AI network built on IMMORTAL

- **Product:** Cormia
- **Normative protocol:** IMMORTAL Autonomous Execution Protocol (AEP)
- **Repository:** `LiberoNuvola/cormia` (local scaffold prepared; GitHub remote pending)
- **Status:** architecture-first specification draft v0.1.3
- **First proposed settlement adapter:** Cardano eUTXO

Cormia is a proposed local-first, peer-to-peer AI network. It is designed so that each participant can run AI locally, optionally contribute bounded spare compute, and access shared network capacity through a reciprocal, evidence-based model.

Cormia is built on the **IMMORTAL Autonomous Execution Protocol (AEP)**, which specifies how digital work is committed, assigned, executed, verified, challenged, and settled across permissionless workers and verifiers.

The architecture separates:

1. **Protocol authority and economic state** — task commitments, capability limits, escrow, bonds, state transitions, challenge outcomes, and settlement.
2. **Off-chain execution** — AI inference, planning, tool use, builds, tests, and artifact production.
3. **Independent verification** — deterministic tests, re-execution, quorum-based review, and optional cryptographic execution proofs.
4. **Governance** — public, versioned changes that do not retroactively rewrite funded task commitments.
5. **Local-first access and reciprocity** — local inference remains available without an account, wallet, subscription, external API key, or protocol credits; shared inference is opt-in and capacity-bounded.

The goal is full automation **inside a declared, funded, machine-checkable task envelope**. Cormia does not claim that every subjective or real-world task can be made trustless. Every assurance profile must state what it proves and which assumptions remain.

## Project identity

- **IMMORTAL** — the wider project and protocol ecosystem.
- **Cormia** — the user-facing network and product.
- **IMMORTAL AEP** — the normative execution, verification, dispute, reciprocity, settlement, and governance protocol.
- **Cormia Node** — the software instance a participant runs on a device.
- **Cormia Runtime** — the bounded execution environment for local and assigned work.
- **Cormia Mesh** — the peer-to-peer network of participating nodes.
- **Compute Reciprocity Credits (CRC)** — provisional, non-transferable internal access accounting; not a tradable or redeemable token.

The name Cormia is a coined product name inspired by the biological term *cormidium*, a repeated functional sequence of specialized zooids found in siphonophore colonies. It is not itself a zoological term. See [ADR-0005](docs/adr/0005-cormia-product-identity.md). The biological analogy is inspirational, not a claim that computer nodes are biologically equivalent to zooids.

## Normative source

[`SPEC.md`](SPEC.md) is the current architecture baseline for IMMORTAL AEP. Runtime code, Cardano validators, schemas, and tests must derive from it. Implementations must not silently redefine normative semantics.

## Repository status

This is an initial local repository scaffold. **No GitHub remote has been created yet.** The repository is prepared under `/mnt/data/cormia`; publishing instructions are in [`PUBLISHING.md`](PUBLISHING.md).

The existing `LiberoNuvola/Immortal-Protocol` remains a separate project. Cormia/AEP is a sibling project, not a migration or replacement. Any future integration must be explicit, versioned, and tested through adapters.

The first public release is intended to be spec-first: specification, prior-art register, ADRs, threat model, schemas, and test vectors before production contracts or worker code. Repository visibility and licenses still require owner approval.

## Prior-art policy

We intend to reuse established protocols and implementation components where appropriate, but we will not copy source code or normative text without a license and compatibility review. See [`docs/research/PRIOR_ART.md`](docs/research/PRIOR_ART.md) and the component-level [`REUSE_AND_COMPOSITION_MATRIX.md`](docs/research/REUSE_AND_COMPOSITION_MATRIX.md).

Initial integration direction:

- A2A for agent discovery, task interaction, and artifact/message interoperability.
- MCP for tool/resource/prompt connectivity, never as the source of protocol authorization.
- ERC-8004 as prior art for identity, reputation, and validation registries; no automatic adoption of its EVM-specific contracts.
- VCAP and PACT as adjacent Internet-Draft prior art for task commerce, delivery commitments, verdicts, liabilities, escrow, and settlement.
- Cardano eUTXO as the first proposed settlement state machine.
- Lilypad and related compute networks as prior art for permissionless resource providers and compute verification.
- RISC Zero or other proof systems as optional assurance adapters, not universal requirements.
- OpenHands, SWE-agent, and self-improving coding research as Runtime/agent engineering prior art.
- Senda, Decoupled AI, Petals, BOINC, Golem and Morpheus as prior art for peer inference, useful-work credit accounting, volunteer compute, split models and local-first access. See [`docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md`](docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md).

## Existing implementation evidence

The local IMMORTAL Agent v0.8.0 is a prototype and potential reference-worker starting point. It is **not yet an IMMORTAL-AEP-conformant worker**. Conformance requires Task Manifest handling, protocol state reconciliation, capability enforcement, persisted checkpoint recovery, evidence package production, compute contribution receipts, CRC accounting, and Cardano adapter behavior to be implemented and tested against the specification.

Existing Flux Point, JEV, and Mitsuro components are preserved as integration inputs; see [`docs/architecture/EXISTING_LOCAL_NUCLEUS.md`](docs/architecture/EXISTING_LOCAL_NUCLEUS.md) and [`docs/integration/ADAPTERS.md`](docs/integration/ADAPTERS.md). Their current prototypes are not automatically protocol authorities.

## Development principles

- Spec first; implementation follows normative decisions.
- No invented tokenomics, bond ratios, validator quorum, or challenge periods.
- Every state transition gets positive and negative test vectors.
- Fail closed on ambiguous authorization, invalid evidence, or stale state.
- No human approval for each operation once a task is permissionlessly accepted; automation remains bounded by the signed task contract and protocol policies.
- Never describe a subjective verdict or a TEE assumption as trustless.
- No production funds until independent security and economic reviews are complete.
- Local inference must not silently fall back to remote providers.
- Compute sharing must be opt-in, resource-bounded, preemptible, and transparent about privacy.

## Initial tree

```text
.
├── README.md
├── SPEC.md
├── GOVERNANCE.md
├── SECURITY.md
├── CONTRIBUTING.md
├── LICENSING-DECISION.md
├── ROADMAP.md
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── economics/
│   └── research/
├── schemas/
├── test-vectors/
├── onchain/cardano/
├── runtime/reference-worker/
└── verifier/
```

## Local-first access and compute reciprocity

The consumer model is local inference first, opt-in compute contribution, and optional shared inference using non-transferable CRC. No hidden remote billing or silent cloud fallback is allowed. CRC are not a tradable crypto token. The exact accounting, benchmark, and audit parameters remain open. See [`docs/economics/COMPUTE_RECIPROCITY.md`](docs/economics/COMPUTE_RECIPROCITY.md), [`docs/economics/NO_MANDATORY_CASH_MODEL.md`](docs/economics/NO_MANDATORY_CASH_MODEL.md), [`docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md`](docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md), and ADR-0004.

## First milestone

Complete the normative Task Manifest, canonical encoding, lifecycle transitions, capability vocabulary, and verification profile definitions. Then derive schemas and test vectors. Do not begin Cardano validator implementation until the state machine and economic invariants are stable enough to test.

## Disclaimer

This repository is an experimental protocol and product design. It is not audited, is not production-ready, and makes no guarantee of security, correctness, performance, financial return, or regulatory suitability.
