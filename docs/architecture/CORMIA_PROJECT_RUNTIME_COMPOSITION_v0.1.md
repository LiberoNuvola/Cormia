# Cormia Project Runtime Composition and Host Registry v0.1

- **Date:** 2026-11-08
- **Status:** isolated in-process composition slice implemented; production multi-project Supervisor remains incomplete
- **Role:** implementation component under the broader general Cormia architecture and the multi-project execution-priority overlay
- **Parent architecture:** [General-Purpose Autonomous Agent & Mixed Community-Support Architecture](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- **Execution priority:** [Multi-Project Autonomous Runtime](./CORMIA_MULTI_PROJECT_AUTONOMOUS_RUNTIME_v0.1.md)

## 1. Purpose

Compose multiple project-bound Plan–Execute runtimes in one local Cormia Core without merging their authority, task context, resource admission or operation adapters.

This is a first implementation step toward the complete Supervisor. It does not replace the Cormia architecture or retire any final product goal.

## 2. Project Runtime composition

`createProjectRuntime()` captures, for one host-selected `projectRef`:

- one `TrustedProjectResolver`;
- one Task Authority Provider, with load and revalidation ports;
- one Resource Admission Provider;
- an optional Resource Provider;
- one fixed host-owned operation-adapter registry;
- one isolated Plan–Execute Capability Broker instance.

The returned Runtime facade exposes plan preparation, plan execution and task-bound plan status. Its execute method checks that the requested task owns the plan reference and digest before calling the broker. Broker-level task, mandate, policy and resource checks remain in force.

Each project gets a separate broker instance. There is no shared plan map between Project A and Project B.

## 3. Host task routing

`createProjectRuntimeRegistry()` receives a fixed list of Runtime registrations and a trusted host port named `taskRoutingProvider.resolveVerifiedTaskRoute({ taskRef })`.

The public registry operations accept task references and proposals/plan references. They do **not** accept a project reference:

- `prepareTaskPlan({ taskRef, proposal })`;
- `executeTaskPlan({ taskRef, planRef, expectedPlanDigest })`;
- `getTaskPlanStatus({ taskRef, planRef })`.

The model may propose task operations, but it cannot nominate a project or repository. The host routing provider resolves a task to a project; the registry selects only the Runtime already registered for that project.

### 3.1 Route contract

The host provider must return exactly:

```js
{
  schemaVersion: "0.1.0",
  status: "verified",
  taskRef: "task:...",
  projectRef: "project:...",
  manifestDigest: "sha256:<64 lowercase hex characters>",
  routeDigest: "sha256:<64 lowercase hex characters>"
}
```

The route is checked before and after plan preparation and again immediately before execution. Registry state binds the plan reference to taskRef, projectRef, manifestDigest, routeDigest and planDigest. A route change, manifest change, cross-task plan reference or unregistered project blocks execution before a host adapter is invoked.

The selected Runtime then performs its own independent checks using its own Task Authority Provider and Trusted Project Resolver. The task-routing provider does not replace project mandate, consent, revocation, policy or Task Manifest verification.

## 4. Isolation invariants

1. A caller/model cannot select or switch project identity by adding `projectRef` to a request; the request shape is rejected.
2. Each Runtime is bound to one immutable `projectRef` at construction.
3. The Runtime's resolver, task authority provider, resource admission provider and adapter registry are captured by its own broker instance.
4. The routing provider is injected by the host and never read from a task proposal.
5. A verified route to a project not registered in the current host configuration fails closed.
6. The registry binds every prepared plan to the task and route from which it was created.
7. A route that changes between PLAN and EXECUTE cannot dispatch.
8. The project-specific Task Authority and resolver must independently reject a task that does not belong to their project.
9. One project's route/provider failure does not mutate or delete another project's registry entry.
10. Runtime registrations are immutable for the lifetime of this registry instance; onboarding or reconfiguration requires a future host-controlled registry lifecycle.

## 5. Verification

The Node tests cover:
- two projects operating under one registry and dispatching through their own adapter closures;
- no model/caller-supplied project selector;
- unregistered project rejection before any runtime invocation;
- route change between PLAN and EXECUTE;
- task/plan cross-binding rejection;
- independent project Task Authority rejection when a task is routed to the wrong Runtime;
- duplicate registration rejection;
- unavailable/unverified route provider fail-closed behavior;
- Runtime facade cross-task and malformed-command rejection.

Run:

```sh
node --check runtime/core/project-runtime-registry.mjs
node --test runtime/core/project-runtime-registry.test.mjs
node --test runtime/core/*.test.mjs
```

## 6. What this implementation does not prove

This code is an in-process boundary and composition contract. It does not authenticate an arbitrary provider implementation, verify route signatures, provide durable task routing, or persist the runtime registry. Its tests use synthetic host ports. It is not a production multi-project execution environment.

Still missing:
- a production signed/host-pinned Task Manifest verifier and task-to-project routing provider;
- persistent Project Descriptor/host-policy registry and project onboarding lifecycle;
- Cormia-owned durable task records, queues, dependencies, attempts, checkpoints and evidence journal;
- crash recovery that reconciles uncertain side effects before retry;
- global fair scheduler, per-project concurrency limits and durable Resource Lease integration;
- safe task-scoped filesystem/Git worktree adapters and realpath/symlink confinement;
- actual Windows local service/ResourceManager composition;
- end-to-end IMMORTAL execution and independent second-project proof.

The user's existing IMMORTAL Local Agent Task Store v1 remains separately owned and read-only to Cormia. This slice neither writes it nor changes `/resume`, V3, Reveal, protocol economics, wallet behavior or Cardano semantics.

## 7. Next implementation dependency

The next layer is a **Cormia-owned durable task engine and Project Supervisor** over these project-bound Runtime facades. It must keep a separate queue/journal per project, bind each task to a verified project route, schedule fairly under host-configured concurrency/resource limits, and recover interrupted work without blind replay. It must not silently assume ownership of the existing IMMORTAL Agent Task Store v1.
