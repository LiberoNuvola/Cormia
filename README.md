# IMMORTAL Autonomous Execution Protocol

**Working name:** IMMORTAL-AEP
**Status:** Architecture-first, specification draft v0.1.0
**First settlement adapter proposed:** Cardano eUTXO
**Repository proposal:** `LiberoNuvola/immortal-autonomous-execution-protocol`

IMMORTAL-AEP is a proposed open protocol for publishing, assigning, executing, verifying, disputing, and settling digital work through a permissionless network of workers and verifiers.

Its core design separates:

1. **Protocol authority and economic state** — task commitments, capability limits, escrow, bonds, state transitions, challenge outcomes, and settlement.
2. **Off-chain execution** — AI inference, planning, tools, builds, tests, and artifact production.
3. **Independent verification** — deterministic tests, re-execution, quorum-based review, and optional cryptographic execution proofs.
4. **Governance** — public, versioned changes that do not retroactively rewrite funded task commitments.

The goal is full automation **inside a declared, funded, machine-checkable task envelope**. The project also adopts a local-first access direction: local open-weight inference has no subscription/API-token meter; shared inference can use non-transferable Compute Reciprocity Credits earned by contributing accepted useful compute. No customer-facing native token is required for the v1 consumer path. The project does not claim that every subjective or real-world task can be made trustless. Every assurance profile must state what it proves and what assumptions remain.

## Normative source

[`SPEC.md`](SPEC.md) is the current architecture baseline. Runtime code, Cardano validators, schemas, and tests must derive from it. Implementations must not silently redefine normative semantics.

## Repository status

This is an initial local repository scaffold. No GitHub remote has been created yet. The first public release is intended to be **spec-first**: specification, prior-art register, ADRs, threat model, schemas, and test vectors before production contracts or worker code.

The existing `LiberoNuvola/Immortal-Protocol` remains a separate project. IMMORTAL-AEP is a sibling project, not a migration or replacement. Any future integration must be explicit, versioned, and tested through adapters.

## Prior-art policy

We intend to reuse established protocols and implementation components where appropriate, but we will not copy source code or normative text without a license and compatibility review. See [`docs/research/PRIOR_ART.md`](docs/research/PRIOR_ART.md) and the component-level [`REUSE_AND_COMPOSITION_MATRIX.md`](docs/research/REUSE_AND_COMPOSITION_MATRIX.md).

Initial integration direction:

- A2A for agent discovery, task interaction, and artifact/message interoperability.
- MCP for tool/resource/prompt connectivity, never as the source of protocol authorization.
- ERC-8004 as prior art for identity, reputation, and validation registries; no automatic adoption of its EVM-specific contracts.
- VCAP and PACT as adjacent Internet-Draft prior art for task commerce, delivery commitments, verdicts, liabilities, escrow, and settlement.
- Cardano eUTXO as the first settlement state machine.
- Lilypad and related compute networks as prior art for permissionless resource providers and compute verification.
- RISC Zero or other proof systems as optional assurance adapters, not universal requirements.
- OpenHands, SWE-agent, and self-improving coding research as Runtime/agent engineering prior art.
- Senda, Decoupled AI, Petals, BOINC, Golem and Morpheus as prior art for peer inference, useful-work credit accounting, volunteer compute, split models and local-first access. See [`docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md`](docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md).

## Current implementation evidence

The local IMMORTAL Agent v0.8.0 is a prototype and potential reference-worker starting point. It is **not yet an IMMORTAL-AEP conformant worker**. Conformance requires Task Manifest handling, protocol state reconciliation, capability enforcement, persisted checkpoint recovery, evidence package production, compute contribution receipts, CRC accounting and Cardano adapter behavior to be implemented and tested against this specification. Existing Flux Point, JEV and Mitsuro components are preserved as integration inputs; see [`docs/architecture/EXISTING_LOCAL_NUCLEUS.md`](docs/architecture/EXISTING_LOCAL_NUCLEUS.md) and [`docs/integration/ADAPTERS.md`](docs/integration/ADAPTERS.md).

## Development principles

- Spec first; implementation follows normative decisions.
- No invented tokenomics, bond ratios, validator quorum, or challenge periods.
- Every state transition gets positive and negative test vectors.
- Fail closed on ambiguous authorization, invalid evidence, or stale state.
- No human approval for each operation once a task is permissionlessly accepted; automation remains bounded by the signed task contract and protocol policies.
- Never describe a subjective verdict or a TEE assumption as trustless.
- No production funds until independent security and economic reviews are complete.

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
│   └── research/
├── schemas/
├── test-vectors/
├── onchain/cardano/
├── runtime/reference-worker/
└── verifier/
```

## Local-first and compute reciprocity direction

AEP's consumer model is local inference first, opt-in compute contribution, and optional shared inference using non-transferable Compute Reciprocity Credits. No hidden remote billing or silent cloud fallback is allowed. CRC are not a tradable crypto token. The exact accounting, benchmark and audit parameters remain open. See [`docs/economics/COMPUTE_RECIPROCITY.md`](docs/economics/COMPUTE_RECIPROCITY.md), [`docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md`](docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md), [`docs/research/REUSE_AND_COMPOSITION_MATRIX.md`](docs/research/REUSE_AND_COMPOSITION_MATRIX.md) and ADR-0004.

## First milestone

Complete the normative Task Manifest, canonical encoding, lifecycle transitions, capability vocabulary, and verification profile definitions. Then derive schemas and test vectors. Do not begin Cardano validator implementation until the state machine and economic invariants are stable enough to test.

## Disclaimer

This repository is an experimental protocol design. It is not audited, is not production-ready, and makes no guarantee of security, correctness, performance, financial return, or regulatory suitability.
