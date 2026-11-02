# ADR-0002: Compose prior art through adapters and explicit mappings

- **Status:** Proposed baseline
- **Date:** 2026-11-02

## Context

A2A, MCP, ERC-8004, VCAP, PACT, Cardano eUTXO, decentralized compute networks, zkVMs and coding-agent research already cover significant portions of the design space.

## Decision

IMMORTAL-AEP will not fork or wholesale copy these projects. It will:

- use A2A for agent interaction where compatible;
- use MCP for tool connectivity, with a separate deterministic capability authority;
- treat ERC-8004 as prior art and an interoperability reference, not an EVM contract to clone;
- maintain explicit compatibility mappings to VCAP and PACT, both still Internet-Drafts as of this decision date;
- use Cardano eUTXO as the first settlement adapter;
- treat compute marketplaces and proof systems as pluggable adapters;
- evaluate source code reuse only after license, provenance, dependency and security review.

## Consequences

The originality claim must concern a measurable composition and integration, not invention of agent identity, task contracts, escrow, verification, or zk execution in isolation. Prior-art review is a release requirement.
