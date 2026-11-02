# ADR-0006: Integrate the existing local Agent through a bounded Runtime boundary

- **Status:** Proposed
- **Date:** 2026-11-02
- **Decision owners:** IMMORTAL-AEP maintainers / future community governance
- **Scope:** local Runtime integration only; no changes to Immortal-Protocol

## Context

The local source review confirms that the current IMMORTAL Local Agent v0.8 is a working process-oriented prototype, but it is not yet an importable AEP Runtime.

The current source has these properties:

- \`agent.mjs\` is an executable entry point. Its orchestration functions are local to the module and are not exported as a library API; importing it reaches the top-level \`main()\` invocation.
- Its HTTP mode is intentionally fixed to a read-only Dagu audit operation. It accepts an empty body at \`POST /v1/tasks/read-only-audit\` and exposes task-ID reads. It is not a generic task submission API and must not be repurposed by silently widening the endpoint.
- Normal CLI mode dynamically loads \`CodingWorkspace\`, \`ResourceManager\` and \`SelfImprovementManager\` from the separate Coding Workspace root.
- The Coding Workspace requires interactive approval for \`workspace_write\`, \`workspace_patch\` and \`workspace_test\`. This is an existing host safety policy.
- Resource Manager and Self-Improvement Manager are importable classes, but their current behavior is local-host scoped.
- Control Room is an operator dashboard, not a task API or protocol authority.
- Mitsuro MCP is a fixed read-only observer of IMMORTAL GitHub/JEV evidence.

AEP, by contrast, requires task-scoped manifests, capability checks, durable task state, evidence packages and explicit authority boundaries. The current Agent task record does not yet implement the canonical AEP Task Manifest or a signed worker-delivery/compute receipt.

## Decision proposal

### 1. Preserve the existing Agent as a compatibility runtime

Do not replace the current Agent or use its fixed read-only HTTP endpoint for arbitrary AEP tasks.

Keep the existing CLI and service behavior working while a separately reviewed Runtime boundary is designed. Existing task/session/audit data remains local and is not copied into Cormia.

### 2. Build a Cormia-owned adapter boundary before refactoring the Agent

The first Cormia Runtime adapter should be a separate module that depends only on explicit interfaces. It must not import \`agent.mjs\` while that file remains a side-effecting executable.

Initial adapter responsibilities:

- validate a versioned local task envelope against a known schema and local host policy;
- map only explicitly supported AEP capability names to existing module operations;
- create a durable adapter task record and attempt record without changing the v1 Agent task-store schema;
- acquire/release Resource Manager leases around supported local work;
- invoke bounded Coding Workspace operations;
- record source/runtime digests, operation outcomes, test results and artifact commitments;
- emit a versioned Evidence Package with explicit limitations;
- stop with a typed blocked/unsupported result when the envelope asks for a capability not implemented by the adapter.

This first adapter is local-only. It does not accept network peers, award CRC, submit receipts for settlement, or invoke Cardano.

### 3. Keep write approval semantics explicit

The current per-operation approval requirement MUST remain intact during the first integration.

A future task-scoped consent envelope could authorize a bounded set of operations at task acceptance, but that is a separate policy decision and requires:
- exact repository/root/path allowlists;
- command and test profile allowlists;
- budget/time/resource limits;
- cancellation and revocation semantics;
- positive and negative tests proving no operation exceeds the signed envelope.

Until that contract exists, the current interactive \`APPROVO\` gate remains. AEP tasks that assume unattended mutation must be rejected or marked unsupported by the local adapter; approval must not be bypassed.

### 4. Use the existing classes only through their current contracts

- \`CodingWorkspace\`: retain its path validation, SHA preconditions, approval classification and Docker restrictions. Do not turn it into a general shell.
- \`ResourceManager\`: use it for local admission and in-process leases; do not claim it enforces OS-level quotas or terminates jobs.
- \`SelfImprovementManager\`: use only for isolated manager candidates and review packets. It is not the general AEP task engine and cannot promote runtime code.
- \`Control Room\`: operator-only local UI, outside the peer protocol.
- \`Mitsuro\`: read-only evidence observer, outside execution and settlement authority.
- \`JEV\`: evidence normalization/index only; no capability, credit or settlement authority.

### 5. Defer any Agent core extraction to a separate implementation change

If a later integration requires direct in-process orchestration, extract a side-effect-free core module (for example, an exported Agent runtime factory) and leave \`agent.mjs\` as a thin backward-compatible CLI bootstrap.

That extraction must preserve:
- CLI commands and their current behavior;
- the existing read-only service contract;
- task-store recovery and evidence paths;
- loopback-only model access;
- coding approval gates;
- evolution candidate isolation and no-auto-promotion;
- all existing positive/negative tests.

No extraction is authorized by this ADR alone.

## First implementation slice recorded 2026-11-02

The following compatibility artifacts have been added without modifying the local Agent or its store:

- `schemas/immortal-agent-task-store-v1.schema.json`;
- `schemas/immortal-agent-attempt-evidence-v1.schema.json`;
- `runtime/reference-worker/immortal-agent-task-store-v1-adapter.mjs`;
- Node-native adapter contract tests and synthetic test vectors;
- [LOCAL_AGENT_TASK_STORE_V1.md](../runtime/reference-worker/LOCAL_AGENT_TASK_STORE_V1.md).

This slice is **read-only**. It does not implement the durable AEP adapter task record described in section 2, does not write the v1 store, does not run/resume tasks, and does not claim instruction-level checkpoint recovery. It establishes the observed v1 compatibility contract before any runtime orchestration is added. The tests are run independently in the Cormia repository and still need a Windows-side compatibility check against a redacted copy of the user's actual store.

## Alternatives considered

### A. Import \`agent.mjs\` directly

Rejected. The file is an executable with top-level startup behavior and no exported core API. Importing it is not a safe adapter contract.

### B. Widen the existing HTTP service endpoint

Rejected. The endpoint is intentionally read-only and designed for one fixed Dagu audit. Turning it into a generic task API would materially expand the attack surface and invalidate its current security description.

### C. Replace the Agent with a new greenfield Runtime

Rejected for the initial integration. It would discard durable task/recovery behavior and duplicate already implemented local modules before parity tests exist.

### D. Start with a separate Cormia-owned adapter

Preferred proposal. It preserves the current executable and creates a testable protocol boundary without granting new authority to existing components.

## Consequences

### Positive

- Keeps the current working local Agent and its service boundary intact.
- Separates AEP task semantics from local CLI/service implementation details.
- Makes capability mapping, evidence, recovery and unsupported operations testable before peer networking.
- Preserves local-first inference and keeps the default model endpoint loopback-only.

### Costs and unresolved items

- AEP Task Manifest schema and local subset still need to be frozen.
- The exact durable adapter-store schema and migration/recovery policy remain to be designed.
- Per-task workspace subroots or path allowlists are not yet exposed by the current Coding Workspace API.
- Current interactive approvals are not equivalent to unattended permissionless task execution.
- Resource Manager leases are in-process and do not constitute an OS sandbox or remote quota guarantee.
- Evidence Package schema, worker identity and receipt signatures remain open.
- No CRC formula, accounting conversion, audit quorum or Cardano settlement behavior is decided here.

## Non-regression constraints

- Do not change V3, Reveal, PRE-RICH economic semantics, Issue admission or validators.
- Do not widen Mitsuro's four-tool read-only surface.
- Do not give JEV, Flux Point, Control Room or the model protocol authority.
- Do not copy local task/session/audit data, secrets, wallet material, model files or logs into Cormia.
- Do not claim AEP conformance until adapter contract tests and evidence profiles pass.
