# Existing IMMORTAL nucleus and integration preservation map

**Status:** architecture preservation record / draft 0.1.1  
**Purpose:** carry forward prior work into IMMORTAL-AEP without rewriting or silently replacing it.

This document is a map of existing project assets. It is not a claim that every component is installed on every workstation or that the AEP network is already implemented.

## 1. Existing local nucleus

The IMMORTAL Local Agent v0.8.0 remains the first reference-worker candidate. Its current known environment is:

- local model runtime: `llama.cpp` server with `ibm-granite/granite-4.2-8b-GGUF:Q4_K_M`;
- agent: `E:\AI\Immortal-Agent-v0.7`;
- local coding workspace: `E:\AI\Immortal-CodingLab\workspace`;
- Control Room: `E:\AI\Immortal-Control-Room`;
- MCP bridge: `E:\AI\Immortal-MCP`;
- persistent local session, task and audit data from the v0.7 lineage;
- Resource Manager and Evolution Manager introduced in v0.8.0;
- Docker-isolated candidate testing and controlled candidate review.

**AEP disposition:** preserve this codebase as the first local node/runtime prototype. Do not replace it with a new reference worker before extracting interfaces and migration tests. It is not yet AEP-conformant: it still needs the canonical AEP manifest, capability enforcement mapped to the protocol, worker identity, receipt/evidence production, reciprocity accounting, and protocol-state reconciliation.

The LLM conversation transcript is not the durable source of task truth. Task manifests, task-store records, evidence, run identifiers and checkpoint data must survive a model restart or context-window failure.

## 2. Flux Point engineering harness

The existing `Immortal-Protocol` work branch contains a documented Flux Point DoD pilot:

- upstream: `Flux-Point-Studios/fluxpoint-plugins`;
- reviewed plugin version recorded by the pilot: `1.49.0`;
- reviewed source commit recorded by the pilot: `175c0a79f9a998b5fe1e212b511dd490ec06f4a8`;
- upstream licence: Apache-2.0;
- local repository declarations: `.fluxpoint-gates.json`, `scripts/harness.sh`, `.github/workflows/fluxpoint-dod-pilot.yml`, and `docs/04-verification/FLUXPOINT-DOD-PILOT.md`.

The useful capabilities are:

- deterministic Definition-of-Done checks rather than trusting an agent's self-report;
- per-edit scoped verification;
- explicit evidence rows and execution attestations;
- declarative `WORK.md` graph IR compiled deterministically into typed-contract workflows;
- separate mutating and independent verification nodes;
- counterexample retention, regression ratchets, benchmark gates and replay provenance;
- multi-agent campaign structure with explicit budgets and a deterministic compiler.

**AEP disposition:** use Flux Point as an optional engineering-campaign adapter and source of proven harness patterns. Its graph compiler can inform AEP's off-chain task DAG/campaign executor. Its DoD and evidence gates can feed AEP evidence packages. The AEP kernel remains the authority for capabilities, economic state and settlement; Flux Point is not the ledger and cannot authorize protocol transitions.

Important existing limitations must remain visible: the pilot documentation states that it does not claim every Flux Point feature is integrated, does not prove Haskell/Plutus builds or Preprod deployment, and does not establish that the plugin is installed on every developer machine. Do not run `/fluxpoint:init` blindly in an already tailored IMMORTAL repository. Pin and review the exact upstream version/commit before enabling plugin updates.

The upstream project declares Apache-2.0. Any future source vendoring must preserve the license, copyright and NOTICE obligations, mark modified files, and be reviewed separately from merely interoperating with the plugin.

## 3. JEV verification registry / plugin surface

The existing IMMORTAL repository contains a JEV verification registry and associated schemas, generators, validators, tests and workflows under `audit/jev`, `scripts/*jev*` and `.github/workflows/jev-*`.

The registry's result vocabulary is deliberately limited:

- `PASS` — the specific check ran and passed with evidence;
- `FAIL` — the specific check ran and failed with evidence;
- `BLOCKED` — a prerequisite was missing or unavailable;
- `NOT_RUN` — the check was not executed.

A check carries a stable identifier, requirement reference, evidence references and limitations. A historical artifact is not a current certification; a local result does not prove devnet, Preprod or mainnet behavior; an overall PASS must not be inferred from a subset of passing checks.

**AEP disposition:** preserve JEV as the evidence registry/normalization layer. Extend its data model only by versioned, backward-compatible schemas so that it can represent AEP task receipts, verifier verdicts, challenges, runtime proofs and compute-contribution receipts. JEV records claims and evidence; it does not mint credits, authorize workers or decide economic settlement.

The read-only tools currently exposed by the bridge are evidence readers, not a permissionless compute API. Their historical registry warning must remain.

## 4. Mitsuro read-only MCP connector

The existing `integrations/mitsuro` implementation in `Immortal-Protocol` contains:

- `jev-readonly-mcp.mjs`;
- `jev-readonly-mcp.test.mjs`;
- `README.md` with a Mitsuro configuration example;
- `.github/workflows/mitsuro-readonly-mcp.yml`.

The bridge is intentionally narrow:

- fixed repository `LiberoNuvola/Immortal-Protocol`;
- fixed branch `work/immortal-green-closure`;
- unauthenticated GitHub REST GET only;
- no GitHub token, shell, arbitrary filesystem access, Git writes, workflow dispatch/reruns, PR/issue mutation, wallet access or on-chain actions;
- four tools: `get_branch_head`, `get_ci_status`, `read_jev_registry`, `read_allowed_file`;
- explicit path allowlist, bounded output and request timeout;
- newline-delimited JSON-RPC over stdio; it opens no listening port;
- dedicated regression tests for closed tool schemas, read-only network method, path traversal rejection, protocol initialization and documented relative invocation.

**AEP disposition:** keep Mitsuro as an optional read-only observability/evidence connector. It may help an operator or worker inspect public GitHub/JEV evidence. It is not a protocol authority, worker scheduler, task executor, credit issuer, wallet or settlement agent. The fixed-repository scope is appropriate for the current bridge; a future general AEP connector must use a separate versioned scope and capability manifest rather than silently broadening this one.

## 5. FluxPoint/Materios infrastructure distinction

The existing IMMORTAL work also references FluxPoint Studios-hosted Materios endpoints and bootnodes for Materios/B3 work. That infrastructure must not be confused with the Flux Point engineering plugin.

AEP's first settlement adapter remains Cardano eUTXO as a design decision. Materios can be evaluated as a separate network/provenance or execution adapter if its chain guarantees, availability, licensing and trust model are independently assessed. Neither endpoint names nor historical observations are proof of current availability or protocol authority.

## 6. Integration topology

```text
IMMORTAL-AEP normative kernel
  ├── Task Manifest / lifecycle / capabilities
  ├── Reciprocity accounting / escrow / disputes
  ├── Evidence and verifier profiles
  └── Governance and versioning

First local worker (preserve existing v0.8.0 nucleus)
  ├── Granite model gateway / llama.cpp
  ├── Task store + checkpoint/resume
  ├── Resource Manager + Evolution Manager
  ├── Coding Workspace + Docker sandbox
  ├── Flux Point campaign/DoD adapter
  ├── JEV evidence adapter
  └── Optional Mitsuro read-only MCP connector

Future permissionless network
  ├── peer discovery and capability advertisement
  ├── remote inference / worker scheduling
  ├── signed work receipts and independent verification
  └── Cardano epoch anchors / escrow / challenge / settlement
```

## 6A. Source-level review status — 2026-11-02

The metadata inventory and selected source review are complete. The review archive SHA-256 is `04c895cf577842548b99da8015df391b8029cb79e7210b733cdeba381b6ead90`. The review confirms the existing Agent v0.8, Coding Workspace, Resource Manager, Evolution Manager, Control Room and Mitsuro bridge as separate components with distinct authority boundaries. It also records local test-fixture limitations and the remaining AEP adapter work. See [`LOCAL_NUCLEUS_SOURCE_REVIEW_2026-11-02.md`](LOCAL_NUCLEUS_SOURCE_REVIEW_2026-11-02.md).

No implementation code, runtime data or credentials have been migrated to Cormia.

## 7. Migration rule

No existing component is deleted merely because a new AEP abstraction is introduced. Each proposed replacement must provide:

1. a source-to-target mapping;
2. compatibility tests against existing behavior;
3. evidence that the target preserves security boundaries;
4. a migration plan and rollback path;
5. an explicit ADR approved before code replacement.

The goal is composition and evolution, not a greenfield rewrite.
