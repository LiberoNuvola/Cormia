# Local Task-Worktree Test Execution Adapter

- Status: implemented candidate adapter and contract tests; not yet wired to a production host ResourceManager or Windows service
- Date: 2026-11-08
- Related: ADR-0007, ADR-0010, `git-task-worktree-manager.mjs`, `task-worktree-workspace-operation-adapters.mjs`

## 1. Purpose

Add the bounded `workspace.test` leg to the isolated task-worktree execution path without exposing a general shell or model-selected command. The model may propose only a host-registered `executionProfileId`; the profile fixes the runner type, digest-pinned container image, exact test files, time limit and resource bounds.

This adapter is registered behind the Project Runtime Plan–Execute Capability Broker. The trusted Project Runtime must independently authorize `workspace.test` against the standing project mandate and task child authority. The adapter does not authorize itself.

## 2. Host profile

Each profile is host-owned configuration with exactly these fields:

| Field | Contract |
|---|---|
| `executionProfileId` | Stable host-registered ID; this is the only profile selector exposed in a plan |
| `runner` | Fixed literal `node-test` in v0.1 |
| `imageDigest` | Container image reference pinned to `@sha256:<64 lowercase hex>` |
| `testFiles` | 1–128 unique canonical relative paths, checked as regular non-symlink files inside the task worktree |
| `maxRuntimeMs` | 1,000–600,000 |
| `memoryMiB` | 256–8,192; Docker memory and memory-swap are both capped to this value |
| `cpus` | 0.25–8 |
| `pidsLimit` | 32–512 |
| `tmpfsMiB` | 16–1,024 for `/tmp` |
| `maxOutputBytes` | 4 KiB–1 MiB per output stream |

The model cannot provide an image, command, arguments, environment, mount, path list, network setting or resource class. v0.1 invokes only `node --test <host-profile-files>`; there is no npm install, shell, arbitrary command or network endpoint.

## 3. Docker boundary

Before execution, the runner:

1. Re-checks that the task worktree root is a canonical real directory and every host-profile test file is a regular non-symlink file contained within it.
2. Inspects Docker's named `default` context and accepts only a local `unix://` endpoint on POSIX or `npipe://` endpoint on Windows. A TCP/SSH/remote context is denied.
3. Inspects the exact digest-pinned image and refuses to proceed if it is not already present locally.
4. Starts Docker with `--context default` and `--pull=never`, so a missing image cannot trigger an implicit registry pull.

The container runs with network disabled, read-only container root, dropped Linux capabilities, `no-new-privileges`, non-root UID/GID, PID/memory/swap/CPU limits and bounded tmpfs. Only the task worktree is bind-mounted, at `/workspace`; no host home, credentials, Docker socket or arbitrary path is mounted. The worktree mount is writable because authorized tests may create project-local test artifacts.

These are Docker configuration controls, not a claim of a hardened VM or protection against every container-kernel escape. Docker daemon availability and local context integrity remain host assumptions.

## 4. Resource lease and cancellation

`workspace.test` always requires an active Broker-provided Resource Lease. The adapter rejects a missing/released lease and calls the Broker's `assertResourceActive()` before and after execution. The Docker runner polls the same callback every 200 ms and terminates the Docker client if the lease expires or is revoked. It also enforces a host-profile runtime timeout and output bounds.

The adapter does not create a lease itself. The production composition must map `workspace.test` to the trusted local ResourceManager through the existing Resource Provider boundary. This callback-scoped lease is admission control; it does not replace Docker limits or claim OS-wide quotas.

## 5. Result semantics

The adapter returns the fixed runner ID, image digest, exact test-file list, exit code, pass/fail, duration and bounded stdout/stderr. A non-zero test exit is a test result, not a successful task. The independent task result verifier must inspect `passed` and exit code before it can issue evidence or allow task completion. This adapter does not issue a Work Completion Receipt or Materios certificate.

## 6. Tests and evidence

`task-worktree-test-operation-adapter.test.mjs` covers host-profile selection, mandatory lease, exact worktree binding, Docker argv, non-root/resource flags, local context selection, preloaded-image/no-pull behavior, symlink rejection and lease-loss termination. [CI run #42457456976](https://github.com/LiberoNuvola/Cormia/actions/runs/42457456976) passed **152 Core tests, 7 read-only adapter tests, 16 worktree/write adapter tests and 8 test-runner adapter tests** (all zero failures). The Docker CLI is a deterministic fake in CI; the workflow does not run a real Docker daemon or claim Windows host compatibility.

CI workflow adds syntax checks and a dedicated Node test step. Existing `multi-project-task-worktree-write.integration.test.mjs` separately proves two synthetic projects can create/replace files in two real temporary Git worktrees under one Supervisor; it does not yet include a real Docker test run.

## 7. Explicit gaps

- The adapter is not yet connected to the actual Windows ResourceManager/Resource Provider.
- No host execution profile has yet been approved for the user's IMMORTAL repository; do not invent an image digest or test selection.
- No Docker image is automatically pulled or built by this adapter. The host must provision and verify an approved digest-pinned image separately.
- The test runner supports Node's built-in test runner only. Aiken/Haskell/TypeScript or other project toolchains require separate reviewed, fixed profiles/adapters; do not generalize this into model-selected commands.
- The real Windows Docker Desktop default context, image digest, non-root bind-mount behavior, lease cancellation and resource limits remain untested on the user's machine.
- Production signed project mandate, consent broker, key provider, durable anti-rollback revocation anchor, Task Manifest verification and independent evidence writer remain separate gates.

## 8. Next integration

Connect the existing local ResourceManager through the Broker Resource Provider; define a host-reviewed Node test profile only after inspecting the target repository's actual test tooling and selecting exact tests; then run a local Windows smoke test with a disposable synthetic repository before registering the IMMORTAL project. Do not touch IMMORTAL V3, Reveal, PRE-RICH economic semantics or the old Agent `/code` + `APPROVO` compatibility path.