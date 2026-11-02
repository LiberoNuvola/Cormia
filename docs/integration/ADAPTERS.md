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

### Local Evolution Manager adapter

A Cormia-side wrapper is implemented at `runtime/reference-worker/immortal-evolution-manager-adapter.mjs`. It checks the fixed four-entry source map (two implementation modules plus two immutable baseline-test aliases), starts and binds candidate runs to a trusted run ID, and exposes only allowlisted reads, candidate-test creation, SHA-preconditioned patches and a human review packet.

Baseline tests cannot be patched; candidate test creation is limited to `candidate-*.test.mjs`; secret-pattern screening is retained. Evaluation is a trusted-host-only method and accepts only successful syntax evidence for both implementation modules plus successful Docker evidence for the fixed candidate-only, read-only, no-network profile. Automatic promotion remains prohibited.

This wrapper does not replace the Agent's explicit `/evolve` entry, create a peer scheduler, or write live runtime files. See [LOCAL_EVOLUTION_MANAGER_ADAPTER.md](../runtime/reference-worker/LOCAL_EVOLUTION_MANAGER_ADAPTER.md).

### Local Resource Manager adapter

A Cormia-side trusted-orchestrator wrapper is implemented at `runtime/reference-worker/immortal-resource-manager-adapter.mjs`. It maps only three fixed operation identifiers to the existing manager's `model-inference` or `cpu-heavy` lease class, samples a fresh snapshot, fails closed on unavailable/invalid telemetry or denied lease, and releases in `finally`.

The operation identifier must come from trusted Runtime code; model/task text cannot choose a ResourceManager class. The wrapper returns only a bounded resource summary and does not claim OS-level throttling, process termination, persistence, scheduling or remote enforcement. It is not wired into the local Agent yet. See [LOCAL_RESOURCE_MANAGER_ADAPTER.md](../runtime/reference-worker/LOCAL_RESOURCE_MANAGER_ADAPTER.md).

### Coding Workspace read-only adapter

A host-scoped wrapper is implemented at `runtime/reference-worker/immortal-coding-workspace-readonly-adapter.mjs`. It exposes only `workspace_list`, `workspace_read`, `workspace_diff` and `workspace_verify`. Trusted host code must inject exact readable-file and listable-directory allowlists; the model cannot extend them.

The wrapper checks that the underlying CodingWorkspace recognizes each operation and does not classify it as approval-required. It does not expose write, patch or test methods. The dedicated 10-test GitHub Actions run passed: [run #2](https://github.com/LiberoNuvola/Cormia/actions/runs/41466372070). The aggregate Windows probe additionally called root-only `workspace_list` through this adapter on 2026-11-02 at 14:59:32.825Z and passed, reporting 5 entries with `truncated: false` and no entry names. This verifies the local list path only; it does not prove read/diff/verify behavior or connect the adapter to the Agent.

See [LOCAL_CODING_WORKSPACE_READONLY_ADAPTER.md](../runtime/reference-worker/LOCAL_CODING_WORKSPACE_READONLY_ADAPTER.md).

### Coding Workspace capability boundary

The local Coding Workspace exposes seven tools and enforces path/root safety in its class. However, the existing Agent orchestrator—not `CodingWorkspace.callTool()`—enforces the `/code` turn gate, the single-operation `APPROVO` confirmation for `workspace_write`, `workspace_patch` and `workspace_test`, and the `cpu-heavy` lease for tests.

The exact tool classification, path rules, file limits, Docker restrictions and AEP mapping blockers are recorded in the [Coding Workspace capability matrix](../architecture/CODING_WORKSPACE_CAPABILITY_MATRIX_2026-11-02.md).

The current AEP `capabilitySet` still has no frozen normative operation vocabulary or path-scope grammar. A candidate vocabulary and exact-path scope proposal is recorded in [ADR-0007](../adr/0007-proposed-task-capabilities-and-workspace-scope.md), but it is non-normative and the Task Manifest schema remains unchanged. A Cormia capability adapter must not invent additional semantics or call the class directly in a way that bypasses the Agent approval gate. Per-task path roots and task-scoped test selection remain unimplemented.

### IMMORTAL Agent Task Store v1 compatibility adapter

A read-only compatibility slice is implemented at `runtime/reference-worker/immortal-agent-task-store-v1-adapter.mjs`, with schemas for the v1 task-store envelope and attempt evidence sidecars.

It validates and summarizes known fields while tolerating unknown properties. It mirrors the Agent's explicit-resume status allowlist (`pending`, `paused`, `failed`) and labels the operation as a new attempt from the original goal, with previous output treated only as context. It does not access local files, mutate the task store, launch work, or produce a canonical AEP Task Manifest.

See [the v1 compatibility contract](../runtime/reference-worker/LOCAL_AGENT_TASK_STORE_V1.md) and [synthetic test vectors](../test-vectors/agent-task-store-v1/README.md).

### Verified Local Agent integration boundary

The source review of 2026-11-02 found that `agent.mjs` is a process entry point with no exported orchestration API and a top-level `main()` invocation. Its HTTP service is deliberately limited to the fixed read-only Dagu audit request and task-ID reads; it is not a general AEP task intake endpoint.

Normal CLI mode dynamically loads the Coding Workspace, Resource Manager and Evolution Manager from the separate local workspace root. The current Coding Workspace continues to require interactive approval for writes, patches and tests. That approval policy must not be bypassed by an adapter.

Consequences:

- Do not import `agent.mjs` directly into Cormia.
- Do not widen the existing read-only HTTP endpoint into a generic task API.
- Treat the current Agent as a preserved compatibility runtime until an importable core boundary is separately implemented and regression-tested.
- Coding Workspace, Resource Manager and Evolution Manager have explicit module APIs and may be wrapped individually, but only within their existing root, approval, lease and candidate-isolation constraints.
- Control Room remains a local operator surface; Mitsuro remains a read-only observer.
- The proposed integration route is documented in [ADR-0006](../adr/0006-local-runtime-adapter-boundary.md). The source-level evidence and test limitations are in [the local nucleus review](../architecture/LOCAL_NUCLEUS_SOURCE_REVIEW_2026-11-02.md).

The current local source is not yet AEP-conformant and no generic AEP task is accepted by the existing service mode.

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


### Local adapter verification on Windows

The aggregate local probe is `scripts/verify-local-runtime-adapters.mjs`. It checks the real Task Store v1 envelope without printing task contents, validates only its exact referenced evidence sidecars in memory (8 MiB per-file bound; no raw payload output), samples the local Resource Manager using an immediate lease release, validates existing Evolution Manager run journals, and performs a bounded candidate read only when a valid open run exists. It does not start a task, evolution or model process, call Docker or modify live state. See [the reference worker README](../runtime/reference-worker/README.md) and [the sidecar probe contract](../runtime/reference-worker/LOCAL_ATTEMPT_EVIDENCE_SIDECAR_PROBE.md).

## Experimental local capability grant contract

Cormia now contains a separately testable proposal for signed local host grants and revocation in [ADR-0008](../adr/0008-proposed-local-capability-grants-and-revocation.md). The verifier accepts compact JWS tokens using an Ed25519 signer resolved by trusted host code, binds the claims to task/manifest/worker/runtime/workspace, and intersects exact paths with host policy. The host policy must pin the permitted issuer identity and an active key.

This contract is **not connected** to the Agent or to the existing Coding Workspace adapter. It does not create/provision keys, does not replace `APPROVO`, and does not enable create/replace/test or delegation. Its revocation input is supplied by the host; persistent rollback-resistant sequence state and a durable journal remain unimplemented. The dedicated GitHub Actions contract suite passed 21 tests in [run #6](https://github.com/LiberoNuvola/Cormia/actions/runs/41474422554). These tests use only ephemeral in-memory keys and synthetic data; they do not establish production key custody, user consent, AEP conformance or task isolation.

### Local authority lifecycle boundary — proposed; state model only

[ADR-0009](../adr/0009-proposed-local-authority-bootstrap-consent-and-revocation-anchor.md) specifies a non-exportable host signing key, one-time consent over an exact grant-intent digest, and a signed/hash-linked revocation journal whose head is independently pinned by a monotonic anchor provider. Four draft schemas describe the public key descriptor, consent receipt, journal event and checkpoint.

A pure in-memory reconciliation model and synthetic tests are now present in `runtime/reference-worker`. The tests verify rollback/fork/prefix conditions and compare-and-set failure behavior using injected fake providers. They do not implement durable file I/O, OS locking, key provisioning, an authenticated consent broker, or a real TPM/OS monotonic anchor. The local Agent and `APPROVO` path remain untouched.

### Windows CNG key-provider discovery

The read-only Windows CNG probe at `scripts/probe-windows-cng-capabilities.ps1` enumerates signature algorithms and reads TPM state only. Its [GitHub-hosted Windows run #2](https://github.com/LiberoNuvola/Cormia/actions/runs/41480382232) passed, but the runner had no TPM and cannot establish the user's local hardware capabilities. The existing Ed25519 grant helper remains unchanged; ES256/P-256 is only a candidate for a separately versioned CNG signing profile. See [ADR-0009](../adr/0009-proposed-local-authority-bootstrap-consent-and-revocation-anchor.md).
