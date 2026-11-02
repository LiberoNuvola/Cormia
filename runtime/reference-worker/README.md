# Reference worker runtime

**Status:** local IMMORTAL nucleus source-reviewed; no runtime source migrated into Cormia.  
**Source review:** [LOCAL_NUCLEUS_SOURCE_REVIEW_2026-11-02.md](../../docs/architecture/LOCAL_NUCLEUS_SOURCE_REVIEW_2026-11-02.md)  
**Integration proposal:** [ADR-0006 — bounded Local Runtime adapter](../../docs/adr/0006-local-runtime-adapter-boundary.md)  
**Coding Workspace boundary:** [capability and approval matrix](../../docs/architecture/CODING_WORKSPACE_CAPABILITY_MATRIX_2026-11-02.md)  
**Resource Manager adapter:** [local lease wrapper contract](./LOCAL_RESOURCE_MANAGER_ADAPTER.md)  
**Evolution Manager adapter:** [run-bound candidate lifecycle contract](./LOCAL_EVOLUTION_MANAGER_ADAPTER.md)  
**Coding Workspace read-only adapter:** [host-scoped file and directory allowlist](./LOCAL_CODING_WORKSPACE_READONLY_ADAPTER.md)

The local IMMORTAL Agent v0.8.0 is a prototype and potential starting point, not yet AEP-conformant. The component map and four narrow adapter compatibility slices have now been source-reviewed and smoke-tested. The next work is to freeze the local AEP Task Manifest/capability/evidence contract and recovery model before wiring any adapter into an Agent execution loop; this is not a greenfield rewrite.

**First compatibility slice implemented:** a read-only Agent Task Store v1 inspector, evidence-sidecar validator, schemas and synthetic test vectors are now published. It never opens the local store, mutates records, launches tasks or claims AEP Task Manifest semantics. See [LOCAL_AGENT_TASK_STORE_V1.md](./LOCAL_AGENT_TASK_STORE_V1.md).

A second slice wraps the current Resource Manager with a trusted fixed-operation map, fail-closed snapshot/acquisition handling, and `finally`-based lease release. It is not yet connected to `agent.mjs` or any network task intake. See [LOCAL_RESOURCE_MANAGER_ADAPTER.md](./LOCAL_RESOURCE_MANAGER_ADAPTER.md).

A third slice wraps the Evolution Manager around one trusted run ID and a fixed source map. It restricts candidate paths, preserves immutable baseline tests, checks hash and anchor preconditions, accepts only host-produced verification evidence and never promotes runtime code. See [LOCAL_EVOLUTION_MANAGER_ADAPTER.md](./LOCAL_EVOLUTION_MANAGER_ADAPTER.md).

A fourth slice adds a host-scoped Coding Workspace adapter that exposes only list/read/diff/verify through exact trusted-host allowlists; write, patch and test remain outside its surface. Its 10 contract tests passed in GitHub Actions, and the expanded Windows probe successfully exercised root-only `workspace_list`. See [LOCAL_CODING_WORKSPACE_READONLY_ADAPTER.md](./LOCAL_CODING_WORKSPACE_READONLY_ADAPTER.md).

## Existing source map

- **Agent host:** `E:\AI\Immortal-Agent-v0.7\agent.mjs`. Process-oriented executable; it does not currently export an importable orchestration API. Its HTTP service deliberately exposes only a fixed read-only Dagu audit operation and task-ID reads. Do not repurpose this endpoint as generic AEP task intake.
- **Coding Workspace:** `E:\AI\Immortal-Agent-v0.7\coding-workspace.mjs`, with a byte-identical test subject copy in the separate Coding Workspace root. It provides bounded list/read/write/patch/diff/test/verify tools. Mutating operations require interactive approval.
- **Resource Manager:** `E:\AI\Immortal-CodingLab\workspace\self-improvement\resource-manager.mjs`. Host telemetry and in-process admission leases; not an OS-level quota controller.
- **Evolution Manager:** `E:\AI\Immortal-CodingLab\workspace\self-improvement\evolution-manager.mjs`. Candidate-only lifecycle for the two manager modules; hash-linked journal and human-review packet; automatic promotion is disabled.
- **Control Room:** `E:\AI\Immortal-Control-Room\control-room.mjs`. Local operator dashboard for Granite, Agent and Dagu; not a worker API.
- **Mitsuro bridge:** `E:\AI\Immortal-MCP\jev-readonly-mcp.mjs`. Four fixed read-only GitHub/JEV tools; not a scheduler, worker or settlement actor.

## Required compatibility boundary

Before an AEP task can use this worker, an adapter must:

1. validate the applicable versioned Task Manifest and local policy envelope;
2. map manifest capabilities to an explicit allowlist of host operations and paths;
3. preserve the current approval requirement for writes, patches and tests until a separate task-scoped consent policy is designed and tested;
4. record durable task identity, attempt/checkpoint state and evidence without treating model conversation history as authority;
5. use Resource Manager leases as local admission decisions, without claiming OS-level enforcement;
6. bind artifacts, test outcomes and execution metadata to a versioned Evidence Package;
7. reject unsupported capabilities and all silent remote/cloud fallback.

The first adapter must remain local-only. It must not accept peer tasks, issue CRC, create signed compute-contribution receipts, or invoke Cardano settlement.

## Implementation stages

1. Freeze module/API hashes and source ownership from the source review.
2. Define the task-store and evidence adapter contracts without rewriting Agent task-store v1.
3. Add compatibility tests for recovery, approval gates, path containment, Docker execution and no-auto-promotion.
4. Decide separately whether to extract a side-effect-free Agent core while retaining the CLI as a compatibility bootstrap.
5. Implement the local Runtime adapter only after the contracts and negative tests are reviewed.

## Not yet implemented

- canonical AEP Task Manifest parsing/signature verification;
- protocol state reconciliation and idempotent AEP event handling;
- AEP capability/delegation enforcement;
- AEP task journal/checkpoints and evidence-package schema mapping;
- peer discovery, remote inference scheduling and CRC accounting;
- Cardano task/receipt anchoring or settlement.

No code is moved here by this documentation. Existing IMMORTAL components remain separate until a reviewed adapter passes parity tests and a rollback path is documented.


## Local Windows compatibility probe

After pulling `main`, run from the Cormia checkout:

```powershell
node .\scripts\verify-local-runtime-adapters.mjs --agent-root "E:\AI\Immortal-Agent-v0.7" --coding-root "E:\AI\Immortal-CodingLab\workspace"
```

The probe checks the local `data/tasks.json` in memory and prints only aggregate status counts and schema error counts; it never prints task goals or result text. It then reads only exact `data/evidence/<task-id>-attempt-<n>.json` paths referenced by the valid Task Store snapshot, validates their structure and task/attempt binding in memory, rejects symlinks and skips files larger than 8 MiB. When any task is marked `running`, it skips all sidecar reads and reports a blocker. It never prints or returns sidecar content, identifiers, file names or tool payloads. See [the bounded sidecar probe contract](./LOCAL_ATTEMPT_EVIDENCE_SIDECAR_PROBE.md).

It samples the real Resource Manager through a short acquire/release lease with a no-op callback. It imports the real SelfImprovementManager, validates existing run journals through its list operation and, if an open candidate exists, reads only the first line of `resource-manager.mjs` and reports a short SHA prefix. It also imports the real CodingWorkspace class, initializes it against the already-existing root and calls only root `workspace_list` through the host-scoped read-only adapter; only `totalEntries` and `truncated` are printed, never entry names.

The probe's expanded syntax/import checks passed in [GitHub Actions run #4](https://github.com/LiberoNuvola/Cormia/actions/runs/41466699401) at commit `0ce597fd1d8193a04682a3d4f8adf3580b2124be`, including the new CodingWorkspace adapter import. The separate CodingWorkspace adapter tests passed in [run #2](https://github.com/LiberoNuvola/Cormia/actions/runs/41466372070). GitHub CI does not access the user's local Windows paths. The user completed the aggregate local probe on 2026-11-02 at 15:22:04.248Z: `PASS`, zero blockers; Task Store 7 records (0 errors, 6 warnings); 6/6 referenced evidence sidecars valid (24 evidence items, 0 marked `isError`, 0 unsafe/missing/invalid); Resource Manager lease passed; Coding Workspace root listing passed (5 entries, not truncated); Evolution Manager registry and bounded candidate read passed. No raw sidecar content was printed.

It refuses to create missing roots, source files, or `self-improvement/runs` directories. The CodingWorkspace root is checked before initialization; the probe does not create files or directories. It does not start an evolution, call Granite, run Docker, write the Agent task store, create/patch a candidate, or promote code. A resource lease may report `blocked` when the host policy says the machine is busy; this is an availability result, not a corruption error.

## Experimental signed local capability grant contract

A separate, non-integrated contract now exists at [ADR-0008](../../docs/adr/0008-proposed-local-capability-grants-and-revocation.md), with claim schemas and a test-only local evaluator:

- [grant claims schema](../../schemas/local-runtime-capability-grant-claims-v0.1.schema.json);
- [revocation claims schema](../../schemas/local-runtime-capability-revocation-claims-v0.1.schema.json);
- [verifier/evaluator](./local-runtime-capability-grants.mjs);
- [contract tests](./local-runtime-capability-grants.test.mjs).

The local evaluator verifies compact JWS Ed25519 signatures through a trusted host key resolver, binds one grant to the exact task/manifest/worker/runtime/workspace, intersects its exact file/directory paths with host policy, applies the host's maximum grant lifetime, and checks a supplied signed revocation feed. The host policy must pin the expected `issuerId`, active signer key, workspace reference, allowed capability/path sets and lifetime.

Only `workspace.list`, `workspace.read`, `workspace.diff` and `workspace.verify` can be authorized by this v0.1 evaluator. Create, replace, test and delegation remain denied. The current Agent `APPROVO` path is unchanged.

This is not a production key-management or revocation service. There is no real local key provisioned, no durable rollback-resistant revocation journal/checkpoint, no persistent grant store, and no integration with `agent.mjs` or `CodingWorkspace.callTool()`. Tests use ephemeral in-memory Ed25519 key pairs only. See ADR-0008 before using this contract in any Runtime.

## Local host authority lifecycle — design only

[ADR-0009](../../docs/adr/0009-proposed-local-authority-bootstrap-consent-and-revocation-anchor.md) and four schemas now describe the next trust boundaries: a host-pinned non-exportable signing key, one-time operator consent bound to an exact canonical grant intent, and a signed/hash-linked revocation journal reconciled against an independent monotonic anchor.

This is design and schema work only. No provider, key store, consent broker, journal writer or anchor is implemented or activated. The current `APPROVO` behavior and the read-only adapter remain unchanged. A file-only hash chain is explicitly not considered rollback protection.

The pure [revocation-anchor reconciliation model](./local-revocation-anchor-model.mjs) and its [synthetic state-machine tests](./local-revocation-anchor-model.test.mjs) now exercise hash-chain replay, checkpoint binding, rollback/fork detection and atomic anchor compare-and-set outcomes. They use injected verifier and anchor callbacks; they do not persist a journal or contact a platform monotonic counter. The current GitHub workflow runs these alongside the cryptographic grant tests and lifecycle-schema checks.

## Windows CNG provider discovery

The read-only [Windows CNG capability probe](../../scripts/probe-windows-cng-capabilities.ps1) enumerates signature algorithms exposed by the Microsoft Platform Crypto Provider and Microsoft Software Key Storage Provider and reads TPM status when `Get-Tpm` is available. It does not create a key or certificate, read private key material, or change machine state. [The Windows GitHub Actions run #2](https://github.com/LiberoNuvola/Cormia/actions/runs/41480382232) validates the script on a hosted runner only; it is not a measurement of the user's device. Actual host provider selection remains pending an operator-run read-only probe and a separate disposable-key signing test.
