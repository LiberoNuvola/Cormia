# Coding Workspace capability and approval matrix

**Status:** source-derived compatibility contract; not yet a canonical AEP capability mapping  
**Source reviewed:** local IMMORTAL Agent v0.8.0 and Coding Workspace source archive, 2026-11-02  
**Purpose:** prevent authority expansion while designing the Cormia local Runtime adapter

## 1. The two enforcement layers

The source has two distinct layers:

1. **CodingWorkspace class** validates the tool name, arguments, workspace root, path containment, file operations and Docker test invocation.
2. **Agent orchestrator** decides whether Coding tools are available in the current turn, calls `requiresApproval()`, obtains the interactive approval and gates CPU-heavy tests with Resource Manager.

A critical boundary: `CodingWorkspace.callTool()` itself dispatches operations and does not call `requiresApproval()`. Any new Cormia caller that invokes the class directly would bypass the Agent's interactive approval layer unless it reproduces/enforces that policy itself.

The current Agent:
- exposes Coding tools only in an explicit `/code` turn;
- separately checks `requiresApproval(name)`;
- asks the user to type exactly `APPROVO` for one operation;
- rejects an approval summary whose proposed file content was truncated;
- rejects all other responses;
- records the approval result in the audit log;
- acquires/releases a `cpu-heavy` Resource Manager lease around `workspace_test`.

The direct `/code` patch-only and test-only command paths also call the same approval function. These gates are part of the existing security contract and MUST NOT be bypassed by a Cormia adapter.

## 2. Exact local tool surface

| Tool | Local classification | Arguments | Existing host approval | Main boundary |
|---|---|---|---|---|
| `workspace_list` | Read | optional relative `path` | No | Lists max 200 entries; reports total/truncation; does not follow symlinks |
| `workspace_read` | Read | required relative `path` | No | UTF-8 content, size and SHA-256; first read becomes in-memory diff baseline |
| `workspace_diff` | Read | required relative `path` | No | Deterministic diff against the first in-memory baseline; max 500 lines and bounded output |
| `workspace_verify` | Read/parse | optional `paths` array, 1-100 | No | Checks file existence/hash; JS files use `node --check`, which parses but does not execute the module |
| `workspace_write` | Create-only mutation | `path`, UTF-8 `content` | **Yes** | Creates a new file only; refuses overwrite; max 256 KiB |
| `workspace_patch` | Full-file replacement | `path`, `expectedSha256`, UTF-8 `content` | **Yes** | Replaces only when the current full-file SHA-256 matches; max 256 KiB; temp-file plus rename |
| `workspace_test` | Code/test execution | no arguments | **Yes** | Fixed Docker `node --test`; host first obtains a `cpu-heavy` lease |

There is no general-purpose shell, arbitrary command, arbitrary URL, Git write, workflow dispatch, wallet or Cardano tool in this Coding Workspace surface.

## 3. Path and filesystem policy

The class requires an absolute workspace root at construction. It rejects a root overlapping any supplied protected root. Initialization rejects a symlink/junction root and records the canonical real path.

All tool paths are relative to that root. The path parser rejects:
- absolute paths, drive paths and UNC paths;
- `..` traversal;
- NUL and forbidden Windows path characters;
- symlinks/junctions in path components;
- non-directory intermediate path components;
- resolved paths outside the canonical workspace root.

The class has no task-specific path grant or per-task root. All tools share the configured workspace root. A new AEP caller therefore cannot claim least-privilege path scoping merely because the class enforces root containment.

## 4. Write and patch semantics

`workspace_write`:
- creates parent directories only after validating each component;
- uses exclusive file creation (`wx`);
- refuses to overwrite an existing file;
- records an audit event with path, byte count and content hash.

`workspace_patch`:
- replaces the complete file content, not a line-oriented patch;
- requires an exact lowercase 64-character expected SHA-256;
- reads the current file and rejects a stale/mismatching hash;
- writes a unique temporary file and renames it over the target;
- records previous and resulting hashes in audit evidence.

Neither operation is self-authorized by the CodingWorkspace class. The Agent's caller supplies the interactive approval gate.

## 5. Verification and test execution

`workspace_verify`:
- accepts at most 100 explicit relative paths;
- if `paths` is omitted, checks only files recorded in the current class instance's in-memory `changed` set;
- checks existence, SHA-256 and file size;
- runs `node --check` only for `.mjs`, `.cjs` and `.js`;
- uses `shell: false` and a 15-second timeout for that parser invocation.

The `changed` and diff-baseline collections are in-memory only. They are not durable across a process restart. A restarted adapter must pass explicit paths or perform fresh reads; it must not assume prior baselines survived.

`workspace_test` executes a fixed Docker command:
- image `node:22-alpine`;
- `--pull=never`, so the image must already exist locally;
- network disabled;
- root filesystem read-only;
- workspace bind mount read-only;
- all Linux capabilities dropped;
- `no-new-privileges`;
- PID limit 64, memory 512 MiB, CPU 1;
- writable `/tmp` tmpfs limited to 64 MiB;
- 120-second timeout, followed by a bounded stop request on timeout.

The command runs Node's test discovery across the entire configured workspace root. It does not accept per-task test paths. Until a task-specific workspace root or test-selector contract exists, an AEP grant must not claim that `workspace_test` is isolated to one task's files.

## 6. Resource and approval relationship

The Agent obtains a `cpu-heavy` Resource Manager lease only for `workspace_test`; it releases the lease in a `finally` block. This is local admission control, not an OS-level CPU quota.

The approval is operation-scoped, not a durable signed task consent. It is not currently suitable as an unattended peer-task authorization. AEP tasks requiring unattended mutation or testing must remain unsupported by this adapter until an explicit task-scoped consent and revocation model is designed and tested.

## 7. AEP mapping status

The current AEP Task Manifest schema still has a generic `capabilitySet` item containing `capability`, `scope` and optional `constraints`; the schema has not been changed.

A non-normative candidate vocabulary and scope grammar are now recorded in [ADR-0007 — Proposed AEP task capabilities and workspace scope](../adr/0007-proposed-task-capabilities-and-workspace-scope.md). Candidate operation IDs are `workspace.list`, `workspace.read`, `workspace.diff`, `workspace.verify`, `workspace.create`, `workspace.replace` and `workspace.test`. The proposal requires opaque host-resolved workspace references and exact file/directory allowlists; it does not grant arbitrary roots or path-prefix expansion.

The proposal does **not** freeze a canonical AEP vocabulary or signed grant format. It remains subject to maintainer/community decision and the open items in ADR-0007. No change to `SPEC.md`, `schemas/task-manifest.schema.json`, or runtime authorization behavior is implied.

Until a normative decision and enforcement tests exist, the safe local disposition remains:
- retain `/code` as the explicit entry gate;
- preserve `APPROVO` for write, replace and test in the existing Agent path;
- expose only list/read/diff/verify through the separate read-only adapter;
- reject unsupported remote/peer capability requests;
- never call `callTool()` from a new adapter without independently enforcing the approval contract.

## 8. Existing source tests

The local Coding Workspace suite contains tests covering:
- exact tool/approval classification;
- absolute/protected root checks;
- path traversal, UNC, drive, NUL and invalid characters;
- symlink rejection and root containment;
- list and file size limits;
- create-only writes and overwrite rejection;
- SHA-preconditioned replacement and stale-hash rejection;
- deterministic diff baseline;
- syntax-only verification;
- Docker arguments and timeout handling;
- action confirmation and rejection of truncated content;
- unknown tool/argument rejection.

The suite passed 33 tests in the isolated source review. This is test evidence for the reviewed local source snapshot, not a GitHub Actions result for Cormia and not a live Windows/Docker deployment check.

## 9. Non-regression

- Do not weaken or remove the existing interactive approval gates.
- Do not add a general shell or arbitrary command executor.
- Do not broaden the configured workspace root without protected-root and path tests.
- Do not claim per-task filesystem isolation until a separate root/path-scoping adapter exists.
- Do not treat `workspace_verify` as a semantic test or `workspace_test` as a proof of task correctness.
- Do not permit the model to approve its own writes, tests, capabilities or promotion.
