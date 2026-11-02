# ADR-0003: Off-chain execution, on-chain task authority and settlement

- **Status:** Proposed baseline
- **Date:** 2026-11-02

## Context

AI inference, code execution, network access and artifact generation are high-cost, external, and often nondeterministic. Cardano validators evaluate transactions; they are not general-purpose autonomous workers.

## Decision

- On-chain state commits task identity, manifest digest, state, escrow/bond, role conditions, evidence commitments, challenge and settlement transitions.
- Off-chain workers perform inference, planning, tool calls, build, test and artifact generation.
- Verifiers assess the committed delivery using the task's assurance profile.
- Full data and logs remain off-chain; integrity-critical data are content-committed.
- The Cardano adapter should avoid a single global hot UTxO and model concurrency and stale-input races explicitly.

## Consequences

The protocol must define canonical manifests, event ordering, data availability assumptions, verifier semantics and timeout/refund paths before on-chain implementation.
