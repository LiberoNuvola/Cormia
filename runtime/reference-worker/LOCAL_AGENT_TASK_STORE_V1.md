# IMMORTAL Agent Task Store v1 compatibility contract

**Status:** implemented as a read-only compatibility inspector; not an AEP Task Manifest  
**Source runtime:** IMMORTAL Local Agent v0.8 source reviewed 2026-11-02  
**Runtime store:** local `data/tasks.json`  
**Evidence sidecars:** local `data/evidence/<task-id>-attempt-<n>.json`

## 1. Purpose and boundary

The existing Agent task store is a local persistence format. This contract lets Cormia inspect it without taking ownership of the Agent's file writes or changing the Agent's task behavior.

- The Agent remains the sole writer of its v1 task store and evidence sidecars.
- The Cormia adapter is pure/read-only: it does not access the filesystem, mutate task records, launch tasks, or issue AEP authority.
- Unknown properties are tolerated so that legacy and future Agent fields are not discarded.
- This schema is not the canonical IMMORTAL-AEP Task Manifest and does not imply AEP conformance.
- No local task/session/audit data is to be copied to the public repository.

## 2. Observed v1 envelope

The Agent loads a JSON object with `version: 1` and a `tasks` array. When saving, it writes `version`, `updatedAt` and the task array. The adapter validates known fields but allows additional properties.

A task created by the current Agent includes:

| Field | Meaning |
|---|---|
| `id` | `TASK-<UTC timestamp>-<8 lowercase hex chars>` |
| `goal` | Original task objective |
| `expectedTools` | Required read-only MCP tools inferred from the goal; older records may omit it and are migrated at startup |
| `status` | pending / running / paused / failed / completed |
| `attempts` | Number of execution attempts |
| `createdAt`, `updatedAt` | Task timestamps |
| `toolsUsed` | Tool names used in the most recent attempt |
| `lastResult`, `lastError` | Most recent result and error, when present |
| `evidencePath` | Relative pointer to a task evidence sidecar |
| `source` | Optional origin, e.g. `dagu-http-service` |
| `serviceValidation` | Optional service-specific validation result |

Additional observed lifecycle fields include `lastStartedAt`, `lastFinishedAt` and `interruptedAt`.

The adapter does not treat the task record as a signed manifest. The v1 task store does not contain a cryptographic requester signature, task capability manifest, worker identity, protocol state commitment or CRC balance.

## 3. Existing status and recovery semantics

| Stored status | Normal execute | Explicit `/resume` | Observed semantics |
|---|---:|---:|---|
| pending | yes | yes | New task may start |
| running | no | no | On Agent restart, changed to paused; never auto-relaunched |
| paused | no | yes | Requires explicit user-directed new attempt |
| failed | no | yes | Requires explicit user-directed new attempt |
| completed | no | no | Completion integrity checks may downgrade to paused |

The Agent's `/resume <ID>` is **not continuation from an instruction-level checkpoint**.

A resume:
1. increments the attempt number;
2. returns the task to running;
3. reuses the original goal;
4. includes a compact excerpt of the previous result as untrusted context, if available;
5. starts a new attempt-specific evidence file;
6. reacquires current facts through the tools instead of assuming prior observations remain current.

Therefore the adapter describes this as `new-attempt-from-original-goal`, not `checkpoint-resume`.

## 4. Attempt evidence sidecar

A sidecar is written at `data/evidence/<task-id>-attempt-<n>.json`. Its observed fields are:

- `version: 1`
- `taskId`
- `attempt`
- `evidence[]`
- `createdAt` at initial creation, or `updatedAt` after incremental evidence saves

The absence of `createdAt` in a later saved version is valid: the Agent's incremental write replaces the initial sidecar object with an object containing `updatedAt`.

Each evidence item contains:
- `observedAt`
- `tool`
- `arguments`
- `isError`
- `rawResultText`

An evidence item records the tool result text and its observation time. It is not, by itself, a verifier verdict or proof that the tool output is truthful.

## 5. Adapter surface

Implementation: [immortal-agent-task-store-v1-adapter.mjs](./immortal-agent-task-store-v1-adapter.mjs)

- `inspectTaskStoreV1(store)`: validates known v1 structure, checks duplicate IDs and evidence path containment, returns summaries/warnings, and does not mutate the input.
- `checkExplicitResumeV1(task)`: mirrors the Agent's explicit resume status allowlist; it only returns an eligibility decision and does not start anything.
- `inspectAttemptEvidenceV1(evidence, expected)`: validates sidecar version, task/attempt binding and evidence item structure.

Schemas:
- [Task Store v1](../../schemas/immortal-agent-task-store-v1.schema.json)
- [Attempt Evidence v1](../../schemas/immortal-agent-attempt-evidence-v1.schema.json)

Tests:
- [Adapter contract tests](./immortal-agent-task-store-v1-adapter.test.mjs)
- [Test vectors](../../test-vectors/agent-task-store-v1/README.md)

CI evidence: [Local Agent Task Store v1 Compatibility run #1](https://github.com/LiberoNuvola/Cormia/actions/runs/41461474545) completed **SUCCESS** at commit `ac44f2a03aecd6272cf80d4dadae35da17972fcf`. The workflow ran the adapter syntax check, 10 contract tests, and JSON parsing for both schemas and both synthetic fixtures. This is repository CI evidence, not a Windows integration run against the user's live task store.


## 6. Non-goals and limitations

This first adapter does not:
- read or write the actual Agent files;
- replace the Agent's persistence layer;
- change the v1 schema or migrate user data;
- create a new AEP task from a local task automatically;
- authorize tools, filesystem paths, shell commands or remote peers;
- create instruction-level checkpoints or guarantee exactly-once execution;
- create AEP Evidence Packages, signed worker receipts or CRC entries;
- connect Cardano or perform any wallet/signing action.

The Agent uses a temporary file plus rename for task-store writes. This review does not claim fsync durability, multi-process locking, backup rotation or protection against a privileged local attacker. Those remain separate engineering requirements if the persistence layer is ever generalized.

## 7. Required next step

The next safe step is a separate compatibility test that compares representative real v1 records and evidence sidecars against these contracts on the user's Windows installation. It must use redacted copies and must not expose the live task store. Only after that should a local Cormia adapter be allowed to consume this format.
