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

The runner is a trusted host integration. It must treat the task goal as untrusted data, obtain/refresh a verified Task Manifest and check its digest, ask the configured Model Provider for a bounded proposal, call only task-bound Registry methods, rely on Core PLAN/EXECUTE authorization, use fixed realpath/symlink-safe filesystem/Git adapters and Resource Lease assertions, independently verify results and persist evidence.

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

## 7. Verification and limitations

Tests cover one store per registered project, route checks, success/evidence completion, round-robin fairness, concurrency caps, startup recovery, exception-to-recovery_required, wrong-project route rejection, single-instance locking and malformed runner outcomes.

This is still an in-process orchestrator with synthetic executor, route provider and Registry test doubles. It does not prove production Task Manifest/routing/mandate providers, a real Granite task loop, real filesystem/Git worktrees, persistent worker process identity, OS-level quotas, Windows background service, real IMMORTAL execution or a second-project end-to-end run.

No files in the user's Windows E:\AI\Immortal-Agent-v0.7 and no IMMORTAL Local Agent Task Store have been changed by this component.

## 8. Next implementation dependency

The next work is the concrete trusted host Task Executor: connect verified task snapshots to the existing Model Provider, strict proposal validator, Registry, fixed workspace adapters, Resource Manager Lease and evidence verifier. The model adapter is not itself a task runner. A Windows service should only be composed after those real host providers/adapters are safely wired.