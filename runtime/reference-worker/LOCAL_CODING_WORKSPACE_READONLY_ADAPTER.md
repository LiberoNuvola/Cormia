# Local Coding Workspace read-only adapter

**Status:** implemented as a host-scoped wrapper; not connected to the local Agent or peer task intake.

The reviewed CodingWorkspace class provides seven local tools. Its caller-side Agent approval gate protects `workspace_write`, `workspace_patch` and `workspace_test`. The class method `callTool()` does not independently enforce that approval gate.

This first Cormia adapter therefore exposes only four non-mutating operations:
- `workspace_list`
- `workspace_read`
- `workspace_diff`
- `workspace_verify`

It does not expose write, patch or test methods.

## Trusted host scope

At construction, trusted Runtime code must inject:
- `readableFiles`: exact relative file paths that may be read, diffed or syntax-verified;
- `listableDirectories`: exact relative directories that may be listed.

The model/task cannot supply or expand these arrays. Directory listing is metadata-only; read/diff returns file content and must only be granted for files the host is willing to disclose to the task context.

The wrapper rejects absolute, drive, UNC and traversal paths, non-canonical path segments, duplicate verify paths and unexpected tool arguments. It also checks the underlying class reports each operation as a known tool and not approval-required before calling it.

## No mutating authority

`workspace_write`, `workspace_patch` and `workspace_test` are not exported by the adapter. They remain available only through the existing Agent's explicit `/code` path and its per-operation `APPROVO` gate. This adapter does not reimplement or bypass the approval workflow.

## Limitations

- All paths remain relative to the underlying single workspace root; the existing class has no per-task root or OS-level namespace.
- `workspace_verify` runs `node --check` only; it is not a semantic test.
- The host allowlist is an integration policy, not yet a canonical AEP capability vocabulary.
- This wrapper does not invoke the Resource Manager; verification is a bounded parser operation in the existing class.
- It does not start the local Agent, invoke Granite, start Docker, mutate files, handle peer tasks, issue CRC or perform Cardano actions.

## Verification evidence

The dedicated [GitHub Actions run #2](https://github.com/LiberoNuvola/Cormia/actions/runs/41466372070) completed **SUCCESS** at commit `6d7629537ef7d7fbb2a37cd143cd770c1bc3d90b`; all 10 read-only adapter contract tests passed.

The expanded Windows probe imported the real local CodingWorkspace class and called only `workspace_list` for the already-existing root directory. On 2026-11-02 at 14:59:32.825Z it passed, reporting `totalEntries: 5` and `truncated: false`, without printing entry names. This verifies the local list path only; CI does not access the user's Windows installation, and this probe does not exercise read/diff/verify, write/patch/test, Agent integration or Docker.

## Tests

Run from this directory:

```powershell
node --test .\immortal-coding-workspace-readonly-adapter.test.mjs
```
