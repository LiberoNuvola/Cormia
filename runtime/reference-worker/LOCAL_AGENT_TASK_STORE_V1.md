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

The aggregate Windows probe has validated the actual local `data/tasks.json` envelope in memory. A bounded sidecar check is now integrated: it reads only exact sidecar paths referenced by the valid Task Store snapshot, verifies task/attempt binding and structural fields in memory, rejects symlinks and skips files above 8 MiB. It prints aggregate counts only; raw tool outputs, identifiers and file names are never returned. See [LOCAL_ATTEMPT_EVIDENCE_SIDECAR_PROBE.md](./LOCAL_ATTEMPT_EVIDENCE_SIDECAR_PROBE.md).

The local sidecar check has not yet been run on the user's Windows installation. The next compatibility step is to pull the updated Cormia `main` and rerun the aggregate probe. This remains an inspector only: it does not execute tasks, change the store or sidecars, or establish AEP Evidence Package conformance.

## 8. Sidecar probe CI and local execution status

The bounded sidecar probe contract suite passed all 9 tests in [GitHub Actions run #2](https://github.com/LiberoNuvola/Cormia/actions/runs/41469116933). The aggregate probe's syntax/import workflow passed in [run #8](https://github.com/LiberoNuvola/Cormia/actions/runs/41469547041).

These are synthetic GitHub checks. The integrated check against the user's actual Windows sidecar files remains pending; it is performed by the aggregate Windows command documented in [the reference worker README](./README.md).
