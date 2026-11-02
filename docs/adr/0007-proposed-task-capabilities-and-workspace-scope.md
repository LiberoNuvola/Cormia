# ADR-0007: Proposed AEP task capabilities and workspace scope

- **Status:** Proposed — non-normative; schema and Runtime behavior unchanged
- **Date:** 2026-11-02
- **Decision owners:** IMMORTAL-AEP maintainers / future community governance
- **Scope:** Task Manifest capability vocabulary and the first local Coding Workspace mapping

## 1. Context

The current Task Manifest schema exposes `capabilitySet[]` entries with generic `capability`, `scope`, optional `constraints`, and `delegable`. It does not yet freeze operation identifiers, path-scope grammar, the signer/issuer of a grant, or the semantics of task-scoped consent.

The normative draft already requires capabilities to be explicit, task-scoped, attenuable and least-privilege. It lists input reads, workspace writes, repository/branch access, allowlisted commands, declared network endpoints, bounded resources, sandboxed build/test, and artifact publication as possible capability types. It also says that a model may propose operations but must not determine its own permissions.

The reviewed local Coding Workspace has seven operations. Its class enforces input/path/root checks, but `CodingWorkspace.callTool()` does not enforce the Agent caller's approval gate. The current Agent orchestrator gates `workspace_write`, `workspace_patch`, and `workspace_test` with an interactive `APPROVO` step. The Coding Workspace has one shared root rather than task-specific roots; its test tool executes Node test discovery across that entire root.

This ADR proposes a vocabulary and mapping only. It does not change the Task Manifest schema or connect adapters to the Agent. The target autonomous authorization model is now defined separately in ADR-0010: one standing project mandate, isolated worktree scope and Runtime-derived task child grants, without per-edit approval. This is a target design, not an implemented permission.

## 2. Proposed naming convention

Use stable, namespaced, action-oriented identifiers in `capability`. The first proposed Coding Workspace vocabulary is:

| Proposed capability ID | Existing local tool | Semantics to preserve |
|---|---|---|
| `workspace.list` | `workspace_list` | List one exact host-authorized relative directory; metadata only |
| `workspace.read` | `workspace_read` | Read one exact host-authorized regular file |
| `workspace.diff` | `workspace_diff` | Read-only diff against a previously captured in-memory baseline |
| `workspace.verify` | `workspace_verify` | Check explicit paths and hashes; JavaScript verification is `node --check`, not semantic execution |
| `workspace.create` | `workspace_write` | Create a new file only; refuse overwrite |
| `workspace.replace` | `workspace_patch` | Full-file replacement guarded by an exact expected SHA-256; it is not a line-oriented patch |
| `workspace.test` | `workspace_test` | Fixed Docker Node test runner; currently runs discovery across the whole configured workspace root |

The identifiers describe protocol-level intent, not permission by themselves. Implementations must keep the mapping versioned and reject unknown identifiers rather than guessing a tool.

No generic `shell.exec`, arbitrary `command.exec`, unrestricted `network.*`, Git write, workflow dispatch, wallet, or Cardano signing capability is proposed for this first local slice. Repository/branch access, network access and artifact publication remain separate adapter families; they must not be inferred from filesystem access.

## 3. Proposed scope grammar

The initial scope proposal contains an opaque host-resolved workspace reference and exact path sets. Illustrative only:

```json
{
  "capability": "workspace.read",
  "scope": {
    "workspaceRef": "worker-local-workspace",
    "files": ["src/module.mjs"]
  },
  "constraints": {},
  "delegable": false
}
```

For `workspace.list`, use an exact `directories` set instead of `files`. For `workspace.read`, `workspace.diff`, and `workspace.verify`, use exact `files`. Create/replace scopes, if later enabled, must enumerate exact target files and preserve the underlying create-only or expected-hash semantics. A workspace test grant must identify a named execution profile; the present whole-root test behavior is not sufficient task scoping.

### 3.1 Path rules proposed for the initial adapter

1. `workspaceRef` is an opaque identifier resolved by trusted host configuration to one preconfigured canonical root. The manifest must never supply an absolute host path, drive path, UNC path, or arbitrary root.
2. Paths are relative to that root and must be canonical. Reject absolute paths, empty/dot/traversal segments, drive/UNC forms, NUL, forbidden platform characters, symlinks/junctions, non-regular file targets, and any resolved path outside the canonical root.
3. Initial grants use exact file and exact directory allowlists. No wildcard, glob, implicit directory-prefix expansion, or recursive inheritance is enabled.
4. The host configuration is an upper bound. A task grant may narrow it but cannot extend it. The effective path set is the intersection of the signed task grant, trusted host allowlist, and any delegator grant.
5. Re-check containment and object type at invocation time; initialization-time validation alone is insufficient.
6. Case-folding, Unicode normalization, repository/worktree binding, branch identity, and cross-platform canonicalization require explicit test vectors before they can be normative.

This proposal intentionally does not claim that the current shared Coding Workspace root is isolated per task. Until task-specific roots or an equivalent OS-enforced workspace boundary exist, local read-only access may use exact host allowlists, but unattended writes and tests in the shared root remain unsupported.

## 4. Proposed authorization model

A capability entry is a bounded task request/grant, not a command from the model. Authorization should be computed by trusted Runtime code from all of the following:

- a validated and authenticated task manifest (the current schema is still a draft and does not yet define its signing envelope);
- the worker's fixed host policy and configured root/path allowlists;
- the delegator's grant, when applicable;
- the exact operation argument and current filesystem state;
- the operation's resource and execution profile;
- revocation, task lifecycle and deadline state.

The effective grant must never exceed any input grant. Unknown capability IDs, unknown scope semantics, missing trust inputs, ambiguous path resolution, or unavailable enforcement must produce a typed denied/unsupported outcome. A model-supplied operation name, path, resource class, approval result, or evidence claim must never enlarge the host policy.

`delegable` should default to `false`. A delegated capability must be an intersection/subset of the delegator's operation, workspace, path, constraints and lifetime. The delegation format, signature chain and revocation mechanism remain OPEN.

## 5. Compatibility status against the current local implementation

| Proposed operation | Current local boundary | Initial AEP adapter disposition |
|---|---|---|
| `workspace.list` | Read-only wrapper; exact directory allowlist | Candidate-supported; root listing was exercised in the Windows smoke test |
| `workspace.read` | Read-only wrapper; exact file allowlist | Candidate-supported by wrapper contract; not yet exercised against the live Windows workspace |
| `workspace.diff` | Read-only wrapper; exact file allowlist; baseline is in-memory | Candidate-supported only within a live adapter session; do not assume baseline survives restart |
| `workspace.verify` | Read-only wrapper; explicit exact file allowlist; parser/hash checks | Candidate-supported by wrapper contract; not a semantic test; live Windows path not yet exercised |
| `workspace.create` | Existing Agent approval required | Unsupported by the new AEP adapter |
| `workspace.replace` | Existing Agent approval required; full-file replacement with SHA precondition | Unsupported by the new AEP adapter |
| `workspace.test` | Existing Agent approval plus `cpu-heavy` Resource Manager lease; whole-root test discovery | Unsupported for task-scoped AEP work until isolation and test selection are defined |

The separate Cormia read-only Coding Workspace wrapper exposes only list/read/diff/verify. It checks the underlying tool classification but deliberately does not attempt to recreate or bypass the Agent's interactive approval workflow.

The existing `APPROVO` prompt remains part of the Agent's current `/code` compatibility path. It is an operation-scoped interactive approval, not a signed task-scoped consent grant. It must not be silently reinterpreted as permission for remote or unattended work. Conversely, the Cormia adapter must not directly call the underlying write/replace/test operations merely because the local class recognizes them.

The project goal of bounded autonomous execution after a task is accepted is addressed by ADR-0010. Until the project mandate, isolated worktree, child-grant engine and consent/revocation lifecycle are implemented and tested, this current read-only adapter must continue to reject mutation/test grants. Do not replace this gap with a human prompt on every edit, and do not simply bypass the legacy Agent approval gate.

## 6. Resource and execution separation

A Task Manifest resource requirement is not itself authority to consume host resources. The local Resource Manager wrapper accepts only fixed operation identifiers supplied by trusted Runtime code and maps them to existing lease classes. The model/task text must not select a Resource Manager class.

For `workspace.test`, admission must include the trusted `workspace-test` lease operation, and release must occur on every exit path. This is still in-process admission control, not an OS-level quota or sandbox proof. The current test runner is fixed and network-disabled, but it discovers tests across the full workspace root. That prevents claiming per-task execution isolation.

`workspace.verify` must remain distinct from `workspace.test`: the former performs file/hash and parser checks; the latter executes tests in Docker. Evidence must preserve this distinction.

## 7. Required negative and positive conformance tests

Before any capability mapping is enabled:

- known operation + exact allowlisted file/directory succeeds;
- unknown operation or extra argument is rejected;
- absolute, drive, UNC, traversal, dot/empty-segment and symlink/junction paths are rejected;
- a path outside the host allowlist is rejected even when the manifest requests it;
- a delegated grant cannot widen operation, path, resource, time or lifetime scope;
- unknown `workspaceRef`, missing host binding, stale task, expired/revoked grant, or invalid signature is denied;
- model/task text cannot choose host paths, arbitrary commands, network endpoints, or Resource Manager classes;
- write and replace cannot run without the separately approved task-consent model;
- test cannot run without a defined task workspace, test selector/profile and trusted resource lease;
- the current Agent `/code` and `APPROVO` paths remain unchanged during this adapter work.

## 8. Open decisions before schema changes

1. Who is authorized to issue/sign a task capability grant, and how does the worker authenticate that authority?
2. Is `workspaceRef` a task-created snapshot, worktree, directory namespace, or a host-selected shared workspace? What are its creation, cleanup and recovery rules?
3. What path canonicalization rules apply consistently on Windows and POSIX, including case and Unicode behavior?
4. How will the one-time project mandate, automatic child-grant derivation, expiry, cancellation and revocation model in ADR-0010 be implemented and tested without reintroducing per-operation human approval?
5. What test profile and selector give task-scoped execution without running unrelated tests in the shared workspace?
6. How are resource requirements separated from actual host admission, preemption and enforceable OS quotas?
7. What evidence schema binds each operation, its exact arguments, host policy decision, source digest, result commitment and verifier outcome?

## 9. Consequences and non-goals

- This ADR is a proposal, not a normative change.
- `schemas/task-manifest.schema.json`, `SPEC.md`, local Agent source, current task store, approval behavior, and adapters remain unchanged by this ADR.
- The read-only adapter remains the only Coding Workspace capability surface proposed for initial AEP compatibility.
- No peer task intake, remote inference, shell, arbitrary network, Git mutation, artifact publication, CRC accounting, wallet or Cardano settlement is enabled.
- No AEP conformance claim follows from the local compatibility probe or adapter unit tests.
