# IMMORTAL-AEP adapter boundaries

**Status:** proposed adapter contracts, draft 0.1.1.

This file defines how AEP composes existing IMMORTAL components and public protocols without transferring authority to them implicitly.

## 1. Existing IMMORTAL components

### Flux Point engineering harness adapter

**Input:** AEP Task Manifest, locked requirement/DoD packet, repository/worktree identity, task-scoped capabilities.  
**Output:** typed `HarnessCheck`, `ExecutionAttestation`, counterexample references, graph node results and content-bound evidence.

The existing Flux Point pilot already supplies a deterministic Definition-of-Done harness, per-edit checks, evidence and a declarative graph compiler. AEP may adopt its harness and graph contracts for coding tasks. AEP capability policy still decides which repo, paths, commands and network scopes the worker can access. A green harness does not itself authorize a Cardano state transition or prove subjective task correctness.

Upstream Flux Point plugin reviewed version/commit and Apache-2.0 license are recorded in `../architecture/EXISTING_LOCAL_NUCLEUS.md`. The local pilot documentation explicitly states that the repository settings do not install the plugin on every developer machine. Plugin installation/version must be verified on each worker before relying on hooks.

### JEV evidence adapter

**Input:** task/manifest digest, requirement IDs, source execution receipts, verifier profile and limitations.  
**Output:** versioned JEV check records with `PASS`, `FAIL`, `BLOCKED` or `NOT_RUN`, evidence references and limitation declarations.

JEV is a normalization and evidence index. It does not decide who may execute a task, mint CRC, transfer funds or settle escrow. An overall PASS must be derived from a separately versioned policy over an explicit set of required checks.

### Mitsuro observer adapter

**Input:** explicit read-only request for branch head, CI status, historical JEV registry or allowlisted public file.  
**Output:** bounded public GitHub evidence and provenance.

The existing bridge is intentionally fixed to `LiberoNuvola/Immortal-Protocol` / `work/immortal-green-closure` and four GET-only tools. It does not become the AEP peer protocol, scheduler, worker or wallet. Any broader connector is a new versioned capability, not a silent change to Mitsuro's current allowlist.

### Local IMMORTAL Runtime adapter

**Input:** signed/validated AEP task manifest and a local policy envelope.  
**Output:** execution events, checkpoints, artifact commitments, compute receipts and verifier inputs.

The v0.8.0 local agent, Granite/llama.cpp backend, task-store lineage, Resource Manager, Evolution Manager, Coding Workspace and Docker test path are the initial implementation nucleus. AEP conformance requires adapters and test vectors; v0.8.0 is not declared conformant today.

## 2. External protocol adapters

| Adapter | Boundary | Authority remains with |
|---|---|---|
| A2A | Peer discovery, Agent Cards, task/message/artifact exchange | AEP manifest and capability engine |
| MCP | Discover/call tools and read resources | AEP policy/capability engine; tool exposure alone grants no authority |
| Cardano | Task commitments, escrow, bond, epoch roots, challenges, settlement and governance references | AEP normative transition rules implemented by audited validators |
| Peer inference transport | Discover capability-compatible model peers and establish session transport | User privacy choice + signed task/service manifest |
| Optional proof adapter | TEE or zkVM proof object for a supported claim | Explicit AEP assurance profile and verifier policy |

## 3. No authority inversion

The following invariants MUST hold:

1. Flux Point may decide that its declared engineering DoD passed; it cannot grant new AEP capabilities or release escrow by itself.
2. JEV may normalize a verifier claim and evidence reference; it cannot mint CRC or turn `NOT_RUN`/`BLOCKED` into `PASS`.
3. Mitsuro may read only its fixed public evidence surface; it cannot mutate GitHub, dispatch workflows or submit Cardano transactions.
4. MCP describes tool interfaces; AEP still performs authorization at invocation time.
5. A2A describes interaction; AEP still checks the signed task contract and capability envelope.
6. A local Runtime may request an on-chain transition; only the validator rules and required evidence determine whether the transaction is accepted.
7. A model may recommend a verifier or worker; it cannot control the verifier registry or settle its own work.

## 4. Compatibility and migration policy

Every adapter MUST pin its protocol/schema version, expose its capability set, record a source/runtime digest, and provide positive/negative contract tests. Existing components are preserved until a target adapter passes parity tests and a rollback path is documented in an ADR.
