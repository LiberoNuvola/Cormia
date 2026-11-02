# ADR-0001: Dedicated repository for IMMORTAL Autonomous Execution Protocol

- **Status:** Accepted as project direction; remote repository creation pending
- **Date:** 2026-11-02

## Context

`Immortal-Protocol` contains an existing economic protocol and application work. The autonomous execution system has a different normative scope: agent task contracts, worker runtime, verification, disputes, and permissionless execution network.

## Decision

Create a separate project named `immortal-autonomous-execution-protocol`. Treat it as a sibling protocol and keep `Immortal-Protocol` separate. Publish an architecture/specification baseline before importing runtime code.

## Consequences

- Separate issues, releases, governance and versioning.
- Explicit adapters are required for any future integration with PRE-RICH or other IMMORTAL modules.
- Existing local Agent v0.8.0 is a prototype/reference-worker candidate, not automatically a conformant implementation.
- Repository visibility and license are not yet established; licensing must be approved before external code contributions.
