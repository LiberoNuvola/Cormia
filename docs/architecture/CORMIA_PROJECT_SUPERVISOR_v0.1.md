# Cormia Local Project Supervisor v0.1

- Date: 2026-11-08
- Status: in-process Supervisor slice implemented and unit-tested; production local service and end-to-end autonomous runner remain incomplete
- Implementation: `runtime/core/project-supervisor.mjs`
- Tests: `runtime/core/project-supervisor.test.mjs`
- Parent architecture: [General-Purpose Autonomous Agent & Mixed Community-Support Architecture](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- Execution priority: [Multi-Project Autonomous Runtime](./CORMIA_MULTI_PROJECT_AUTONOMOUS_RUNTIME_v0.1.md)
- Runtime registry: [Project Runtime Composition v0.1](./CORMIA_PROJECT_RUNTIME_COMPOSITION_v0.1.md)
- Task persistence: [Durable Project Task Store v0.1](./CORMIA_PROJECT_TASK_STORE_v0.1.md)

## 1. Purpose

This Supervisor composes the host-configured Project Runtime Registry with one durable Project Task Store per project. Its first use case is an IMMORTAL task and another independent project's task progressing under one local Core without crossing mandates, queues or repository contexts.

It is a subordinate implementation component under the existing general Cormia architecture. It does not replace the architecture, redefine final scope or change IMMORTAL protocol semantics.

## 2. Host-only composition

```js
const supervisor = createProjectSupervisor({
  projectStores: [
    { projectRef: "project:immortal", taskStore: immortalStore, maxConcurrency: 1 },
    { projectRef: "project:second-project", taskStore: secondStore, maxConcurrency: 1 }
  ],
  runtimeRegistry,
  taskRoutingProvider,
  taskExecutor,
  supervisorLockPath: "C:/host-controlled/cormia/supervisor.lock",
  actorRef: "actor:cormia-supervisor",
  maxGlobalConcurrency: 2
});
```

The store registration set must equal the Runtime Registry project set. Every store is bound to its projectRef; journal paths must be unique. Configuration is captured at construction.

The task route provider is a trusted host port: resolveVerifiedTaskRoute({ taskRef }) returns schemaVersion, status, taskRef, projectRef, manifestDigest and routeDigest. The host route is checked before claim and again by the Registry before planning/execution. The Project Runtime itself rechecks its own Task Authority and mandate/policy providers. The model/caller does not provide projectRef.

## 3. Lifecycle and single-instance safety

- `start()` acquires a local exclusive lock using create-if-absent.
- A second cooperating Supervisor with the same lock path fails with PROJECT_SUPERVISOR_LOCKED.
- A stale lock is never auto-stolen; it must be inspected by the trusted host/operator.
- At startup, each Task Store reclassifies all remaining running tasks as recovery_required.
- `stop()` releases the lock only after scheduling becomes idle; it refuses to release while startup or a cycle is active.

The lock coordinates one local host filesystem only. It is not a distributed lock and the journals must not reside on an unqualified network share.

## 4. Scheduler

`runCycle()` loads every project's runnable tasks and advances a deterministic round-robin cursor across the configured project order. It claims one eligible task at a time with durable revision compare-and-set, then invokes the host runner up to the global ceiling maxGlobalConcurrency and the per-project ceiling maxConcurrency.

A queue burst in Project A does not consume every slot ahead of Project B. The v0.1 policy is fixed and deterministic; it adds no adaptive weights, speculative priorities or token economics.

If a route cannot be verified or does not match the task's project/manifest digest, the task remains queued and a skipped blocker is reported. It is not claimed or dispatched. The Runtime Registry performs its own route resolution before PLAN and EXECUTE.

`runUntilIdle({ maxCycles })` offers a bounded explicit run loop. It does not keep a daemon alive or poll asynchronously; the local host controls how/when to invoke it or build a service lifecycle around it.

## 5. Fixed host task executor contract

The Supervisor invokes only the host-injected `taskExecutor.executeTask(context)`. The context contains the host-resolved projectRef and immutable task snapshot, host-created workerRef and attempt, task-bound preparePlan/executePlan callbacks that accept no project selector, and a task-bound checkpoint callback.

The runner is a trusted host integration. The repository now contains an initial `createModelTaskPlanner()` and `createModelBackedTaskExecutor()` composition in `runtime/core/model-task-planner.mjs`. The planner requires a host-pinned local ModelProvider, a trusted Task Context Provider bound to the persisted task's manifest digest, and a bounded JSON proposal. The executor performs PLAN, appends an `unknown` side-effect checkpoint, performs host EXECUTE and requires a separate evidence verifier before returning completed. It does not itself make those providers production-ready. The runner must treat the task goal as untrusted data, obtain/refresh a verified Task Manifest and check its digest, ask the configured Model Provider for a bounded proposal, call only task-bound Registry methods, rely on Core PLAN/EXECUTE authorization, use fixed realpath/symlink-safe filesystem/Git adapters and Resource Lease assertions, independently verify results and persist evidence.

A successful outcome has exactly:
```js
{ state: "completed", evidenceRefs: ["evidence:..."] }
```

A failed/blocked outcome has exactly:
```js
{ state: "failed" /* or "blocked" */, reasonCode: "STABLE_CODE", evidenceRefs: ["evidence:..."] }
```

Failure evidence must demonstrate that the trusted runner has reconciled possible side effects. A model-generated status alone is never accepted as trusted execution evidence.

## 6. Interruption and outcome recording

- A thrown exception or malformed executor outcome appends task_interrupted and moves the active attempt to recovery_required.
- If a final completion/failure/block record cannot be persisted after work was performed, the Supervisor attempts the same recovery-required transition.
- If even that append fails, the task remains running; the next process startup classifies it as recovery_required.
- No task is automatically returned to queued after an exception or process restart.
- Task-store mutations use a fresh revision and bounded retries on compare-and-set conflicts.

## 7. Synthetic end-to-end composition proof

The test `runtime/core/multi-project-autonomous-path.integration.test.mjs` now composes the actual per-project Task Store, Supervisor, Model Task Planner, Project Runtime Registry, Plan–Execute Broker and read-only CodingWorkspace adapter in one in-process path. A deterministic ModelProvider and synthetic identity/mandate/consent/revocation/task-route/result-verifier ports are used. The test executes one `workspace.read`, persists the pre-execute checkpoint and verifier-issued fixture evidence reference, and completes the durable task.

CI [run #42452775680](https://github.com/LiberoNuvola/Cormia/actions/runs/42452775680): **150 Core PASS / 0 FAIL** plus **7 read-only adapter PASS / 0 FAIL**.

This closes the synthetic component-composition gap only. It does not authenticate production trust providers, use actual Granite inference, execute against the user's IMMORTAL checkout or prove two complete model-backed Runtime instances simultaneously. The full test boundary is described in [Synthetic Task Path Integration v0.1](./CORMIA_AUTONOMOUS_TASK_PATH_SYNTHETIC_INTEGRATION_v0.1.md).

## 7. Verification and limitations

Tests cover one store per registered project, route checks, success/evidence completion, round-robin fairness, concurrency caps, startup recovery, exception-to-recovery_required, wrong-project route rejection, single-instance locking and malformed runner outcomes.

A synthetic two-project concurrent path test now runs two independent Project Runtime/Broker instances, task authorities, read-only workspace adapters and durable task journals under one Supervisor, sharing one deterministic ModelProvider/Planner. Both tasks are held at the provider until both requests arrive, then independently complete with project-specific dispatches and evidence. CI [run #42453075948](https://github.com/LiberoNuvola/Cormia/actions/runs/42453075948): 151 Core PASS / 0 FAIL and 7 read-only adapter PASS / 0 FAIL. This remains an in-process synthetic proof: it does not prove production Task Manifest/routing/mandate providers, real Granite inference, real filesystem/Git worktrees, persistent worker identity, OS-level quotas, Windows background service, or a live IMMORTAL checkout plus a second user project. See [Two-Project Concurrent Task Path Proof](./CORMIA_MULTI_PROJECT_PARALLEL_TASK_PATH_SYNTHETIC_INTEGRATION_v0.1.md).

No files in the user's Windows E:\AI\Immortal-Agent-v0.7 and no IMMORTAL Local Agent Task Store have been changed by this component.

## 8. Next implementation dependency

The next work is to supply the production host ports and finish the real execution boundary: (1) signed Task Manifest and task-to-project route verification; (2) production mandate/consent/revocation/host-policy providers; (3) a host Task Context Provider derived from that authenticated manifest; (4) a task-scoped isolated worktree and realpath/symlink-safe operation adapters; (5) actual ResourceManager Lease composition; and (6) the independent evidence verifier/writer. The current read-only workspace mapping is limited to list/read/diff/verify. The model planner is present, and synthetic single-project and two-project concurrent composition tests now pass. They are not yet wired to the user's Windows runtime. Do not start a Windows service or enable unattended mutation until these boundaries pass host integration tests.