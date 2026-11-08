# Cormia Two-Project Task-Worktree Write Path — Synthetic Integration Proof v0.1

- Date: 2026-11-08
- Status: two-project concurrent create/replace path verified using real temporary Git repositories and task worktrees; trust providers remain synthetic
- Test: `runtime/core/multi-project-task-worktree-write.integration.test.mjs`
- CI: [GitHub Actions run #42455045258](https://github.com/LiberoNuvola/Cormia/actions/runs/42455045258)
- Commit: `194efbc3201ac97f394bafdbbff8c248899dea81`

## 1. What is exercised

One Project Supervisor and one shared deterministic ModelProvider/Planner/executor process two project tasks concurrently. The test gates provider responses until both project requests have arrived.

Each project uses:
- a separate temporary source Git repository initialized by the test;
- a host-configured `createTaskWorktreeManager()` with its own repository root, worktree base, projectRef and repositoryRef;
- a detached task worktree at the host-selected `main` base commit;
- a separate Project Runtime and Plan–Execute Broker;
- a separate Task Authority/resolver fixture and manifest digest;
- a separate Cormia Task Store journal;
- the task-worktree `workspace.create` and `workspace.replace` adapters.

The model proposes one new file and one full-file replacement. The Broker authorizes each exact operation/path through the synthetic task session. The adapters resolve the task's worktree from host-captured project/task bindings, reject unsafe paths and use per-task-path locks. Replacement is conditional on the expected SHA-256.

## 2. Assertions

The integration test verifies that both project requests overlap at the shared provider; both tasks complete exactly once; each worktree contains only its own created/replaced content; each source repository remains byte-for-byte at its original file content and HEAD; each task journal contains its own checkpoint and evidence reference; and no project can resolve the other project's task context.

CI [run #42455045258](https://github.com/LiberoNuvola/Cormia/actions/runs/42455045258) on the above commit passed:

- Core Node suite: **152 PASS / 0 FAIL**.
- Read-only CodingWorkspace adapter suite: **7 PASS / 0 FAIL**.
- Git worktree and workspace mutation adapter suite: **16 PASS / 0 FAIL**.

## 3. What this does not prove

- The two source repositories are temporary synthetic Git repositories. The IMMORTAL repository name is used as a host identity fixture; the user's actual `Immortal-Protocol` checkout is not opened or modified.
- Project mandates, signatures, operator consent, revocation anchors, task routing and task authority are synthetic test doubles. The real Broker and worktree/write adapter code is exercised, but production trust providers are not.
- The ModelProvider is deterministic, not live Granite inference.
- The test does not create branches, commit, push, merge, deploy or alter protected branches.
- The test does not run `workspace.test`, a real Docker daemon, Windows Docker Desktop or the user's ResourceManager.
- A Git worktree is repository isolation, not by itself a hardened OS sandbox.

## 4. Next task execution increment

The separate candidate `workspace.test` adapter now exists in `runtime/reference-worker/task-worktree-test-operation-adapter.mjs`. It accepts only a host-registered Node test profile, exact test files and a digest-pinned image; it requires a Broker Resource Lease and uses local Docker only, no network and no implicit image pull. Its unit tests use a fake Docker CLI and do not yet form a full two-project write→test→verify integration.

Next: compose create/replace/test through the actual Broker and fixed profile, wire the real local ResourceManager through the Resource Provider, then run a disposable Windows synthetic-repository smoke test. Only after that host proof should an IMMORTAL test profile be registered. No test selection, image digest, authority or branch permission should be guessed from the repository name.

## 5. Architecture scope

This is a milestone in the existing autonomous multi-project architecture. It does not replace the wider Cormia objectives or change IMMORTAL protocol semantics.