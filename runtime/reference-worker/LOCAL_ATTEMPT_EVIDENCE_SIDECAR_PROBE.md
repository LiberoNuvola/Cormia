# Local Agent attempt evidence sidecar probe

**Status:** implemented as a bounded, read-only local compatibility check  
**Input:** only evidence paths exposed by a valid Task Store v1 inspection  
**Implementation:** [local-evidence-sidecar-probe.mjs](./local-evidence-sidecar-probe.mjs)

## 1. Scope

The probe reads only sidecar files explicitly referenced by task summaries returned from `inspectTaskStoreV1`. It does not enumerate `data/evidence`, search for unreferenced files, infer alternate paths, or read task evidence when the Task Store envelope is invalid.

Every referenced path must match the exact task-bound form:

`data/evidence/<task-id>-attempt-<n>.json`

The embedded `taskId` and `attempt` are checked against the task ID and attempt parsed from that filename. An earlier attempt sidecar remains valid as a reference when the Task Store's current attempt count has advanced; the existing Task Store contract explicitly permits this.

## 2. Validation performed

For each referenced file the probe:
- requires the existing `data` and `data/evidence` directories to be real directories, not symlinks;
- requires the target to be a regular, non-symlink file contained under the evidence directory;
- skips files larger than **8 MiB**; this is a defensive limit of this probe, not a schema limit;
- parses JSON in memory and applies `inspectAttemptEvidenceV1`;
- checks the sidecar version, task binding, attempt binding, timestamps and evidence item structure;
- returns aggregate counts only.

The probe records counts for valid, missing, unsafe, oversized, malformed-JSON and schema-invalid sidecars, plus aggregate evidence item/error counts and bytes read. It never returns task IDs, file names, tool arguments, `rawResultText`, prompts, results or parser error text.

## 3. Outcomes

- `PASS`: every referenced sidecar was read within the size bound and passed the adapter's structural and task/attempt binding checks.
- `PARTIAL_OR_FAIL`: at least one referenced sidecar was missing, unsafe, oversized, unreadable, malformed or structurally invalid.
- `not-present`: no task summary supplied an evidence path; no sidecar file was inspected.

An item with `isError: true` is counted but does not by itself make the sidecar structurally invalid. A structurally valid sidecar is not proof that its raw tool output is true, current, complete or semantically sufficient.

## 4. Non-goals

This probe does not:
- modify task records or evidence files;
- execute or resume a task;
- print, upload or persist raw evidence;
- treat `rawResultText` as a verifier verdict;
- validate AEP Evidence Package semantics, signatures, worker identity or protocol authority;
- prove the local Agent's completion-integrity policy or Docker isolation.

## 5. Tests

Run:

```powershell
node --test .\runtime\reference-worker\local-evidence-sidecar-probe.test.mjs
```

The contract tests cover valid and empty sidecars, missing references, path escape, task/attempt mismatch, malformed JSON, size bounds, symlink rejection and the no-reference case.

The aggregate Windows probe invokes this check automatically after a valid Task Store inspection. Only its aggregate counts are printed.
