# Cormia Multi-Project Autonomous Runtime v0.1

- **Date:** 2026-11-08
- **Status:** execution architecture / implementation plan; integrated autonomous multi-project runtime not yet implemented
- **Primary product priority:** autonomously execute work across multiple independent projects on one Cormia Core
- **First project profile:** IMMORTAL Protocol
- **Current Cormia branch:** work/exp-generalization-crosswalk
- **Current IMMORTAL working branch observed:** work/immortal-green-closure, HEAD 11fefbdb13a43f9e9133d8998330378daeeddc2e
- **Related design:** [General-Purpose Autonomous Agent & Mixed Support Architecture](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- **Related enforcement slice:** [Plan–Execute Capability Broker v0.1](./CORMIA_PLAN_EXECUTE_CAPABILITY_BROKER_v0.1.md)

## 1. Product objective

Cormia's principal job is to receive durable project goals, plan and carry out authorized work, verify the results, preserve evidence, recover safely and continue with other independent work.

The first operational target is the user's IMMORTAL Protocol repository. The same Cormia Core must also be able to operate other registered projects concurrently, without copying the IMMORTAL-specific policy into the Core and without allowing one project's context, authority, files, credentials, task state or resource use to leak into another.

This is a local-first execution product. Financial support, Cardano, CRC, remote peer mesh, wallet operations and optional service integrations are not prerequisites for ordinary project work.

The required outcome is not a collection of hand-started agents. It is one host-controlled Project Supervisor that schedules several independently governed Project Runtime instances.

## 2. Non-negotiable architecture

### 2.1 One Supervisor, isolated Project Runtime instances

A single Cormia Supervisor owns the local process lifecycle and global scheduling. Each registered project gets an independent Project Runtime with its own:
- project reference and versioned descriptor;
- steward/accountability binding and active Project Mandate;
- host policy and exact repository/branch/workspace scope;
- durable task queue, task graph, attempts and checkpoints;
- project lifecycle journal and task/evidence journal;
- isolated repository workspace or Git worktree;
- fixed operation-adapter registry and resource profiles;
- project-specific logs, evidence and recovery state.

A Project Runtime is not allowed to borrow another project's mandate or workspace. A model response cannot select or switch the active project. The project identity comes from a trusted host-resolved task envelope and is revalidated before dispatch.

### 2.2 Shared services, not shared authority

Projects may share host services where appropriate:
- one local Model Provider endpoint (currently Granite through llama.cpp);
- one global Resource Manager and capacity scheduler;
- host monitoring and service lifecycle;
- immutable tool binaries and CI/test images.

Sharing a service does not merge project authority or context. Each inference request is constructed from one project/task context. No conversation transcript, private artifact or prompt history is implicitly reused across projects.

Resource admission is global and project-aware. A project can consume only its configured budget and accepted lease. The same GPU or CPU pool may serve different projects, but scarce capacity must be scheduled and accounted for centrally. Capacity shortage defers work; it does not silently switch providers or borrow another project's quota.

### 2.3 Autonomy is bounded by a standing mandate

For every project, the host resolves the effective operation set as:

\[
\mathrm{Mandate} \cap \mathrm{TaskRequest} \cap \mathrm{HostPolicy}
\]

A standing project mandate may authorize unattended in-scope work without a human approval prompt for every edit. The model cannot widen that authority, approve its own plan, promote its own candidate or change host policy.

The following remain distinct and separately gated: protected-branch merge, release/tag, production deployment, wallet signing, funds movement, ledger settlement, trust-anchor change, mandate widening and other irreversible external actions.

### 2.4 Local-first, provider-independent

Granite is the current inference provider, not the Supervisor, scheduler, authority engine or execution environment. A provider outage pauses tasks that require inference; it does not erase their durable state. Deterministic verification or recovery may continue only when separately authorized and independent of inference. There is no silent remote fallback.

## 3. Project execution topology

| Component | Responsibility |
|---|---|
| Cormia Local Supervisor | Durable project registry, fair scheduler and host lifecycle |
| Project Runtime A | IMMORTAL mandate, queue, worktree, journal and adapters |
| Project Runtime B | Separate mandate, queue, worktree, journal and adapters for another project |
| Core Plan–Execute / Capability Broker | Host authorization, task binding and fixed operation dispatch |
| Global Resource Manager | Shared CPU/GPU/inference/memory capacity admission and leases |
| Shared Model Provider | Stateless inference service; no authority or implicit cross-project context |

The table describes the target composition. The current codebase contains several of these components as isolated slices, not as a running Supervisor or integrated Project Runtime.

## 4. Scheduling and concurrency

The Supervisor maintains a separate ready queue for each registered project and a global view of resource availability.

Initial scheduling rules:
1. Only tasks admitted by that project's trusted host resolver enter its runnable queue.
2. The project/task association is immutable once the task is admitted.
3. Select work fairly across eligible projects; no single project may starve another merely by generating a large queue.
4. Apply a host-configured global concurrency ceiling and per-project concurrency ceilings.
5. Admit CPU-heavy, GPU/inference, memory-intensive and other resource-sensitive work through the Resource Manager. Resource Lease is capacity admission, not a capability.
6. A task waiting for resources remains queued; it does not exceed the project budget or acquire resources from another project by inference.
7. Pausing, revoking or blocking one project must not silently pause unrelated projects. Continue independent projects only when each remains trusted, authorized and resource-admissible.
8. The scheduler must expose queue age, active attempts, leases, blocked reason and project-level resource use.

The first release should use a simple deterministic fairness policy (for example, round-robin among eligible projects with configured per-project caps). Do not invent adaptive priority coefficients or a token-based scheduler. Project priority and deadlines must be explicit host configuration.

### 4.1 What “simultaneous” means

Independent project work can progress concurrently at the orchestration level. The host may run multiple non-conflicting read, planning, verification or I/O activities at once, subject to configured limits. GPU inference and CPU-heavy test/build operations are scheduled against actual local capacity; Cormia must not promise that every task has simultaneous model or GPU access. It may queue or interleave inference calls while other independent work continues.

### 4.2 Conflict avoidance

- One mutable task worktree per task/attempt, or a host-defined exclusive workspace lease.
- No two attempts may mutate the same worktree at the same time.
- Integration into a project branch is an explicit adapter operation and is still mandate/policy checked.
- Cross-project file sharing is denied by default. Shared artifacts require an explicit read-only artifact reference and privacy policy.
- Git branch names, repository URLs, workspace roots and adapter selection are host-resolved; they are not accepted from model-generated content as authority.

## 5. Durable task execution and recovery

A task must survive model context loss, terminal closure and process restart. Context window state is never the authoritative task state.

The Cormia-owned durable task record should bind at minimum:
- projectRef, taskRef and manifest digest;
- objective/acceptance predicate and requested operation set;
- priority/dependencies and originating project decision;
- attempt number, state and timestamps;
- plan reference/digest and step results;
- exact workspace/worktree/branch binding;
- resource leases and observed resource profile;
- checkpoint and evidence references;
- failure/block reason and retry eligibility.

The task journal is append-only or equivalently tamper-evident, sequence-checked, recoverable and project-scoped. Project lifecycle and task lifecycle are separate state machines.

On restart:
- queued tasks may be reconsidered after current trust and resource checks;
- a task interrupted during planning may be replanned from its durable objective after revalidation;
- a task interrupted during an external side effect is not blindly replayed;
- uncertain operations require idempotency/reconciliation evidence or remain blocked for review;
- the prior model output is untrusted context, not authority and not a checkpoint;
- the host records which steps completed and which have uncertain outcome.

The existing IMMORTAL Agent Task Store v1 remains owned by the Agent and read-only to Cormia until a separately reviewed migration/ownership decision. The current explicit resume behavior is a new attempt from the original goal, not instruction-level continuation; Cormia must not silently change that contract.

## 6. Model planning loop and Core dispatch

For an eligible task:
1. The host assembles a bounded prompt from that project's objective, task manifest, allowed context and current evidence.
2. The provider returns plain candidate content. Tool-call-shaped provider output remains inert data.
3. Core parses a strict, versioned plan proposal with exact fields and bounded JSON data.
4. PLAN runs adapter input validation and checks every operation against the current mandate/task/host-policy intersection. PLAN performs zero dispatch.
5. Core stores the plan digest and transitions it to READY.
6. The host orchestrator initiates EXECUTE separately.
7. Immediately before each operation, Core revalidates the task manifest, mandate, consent, revocation/anchor, project lifecycle, host policy and resource lease.
8. A fixed host-owned operation adapter performs the exact operation and records a result.
9. The verifier/acceptance policy evaluates the result and writes evidence; only then can the task transition to completed.
10. The Supervisor schedules the next ready task, including tasks from other projects.

Self-generated subtasks are allowed only when the active mandate permits delegation and the trusted Runtime derives attenuated child authority for each child task. A model cannot create its own capabilities.

## 7. First project: IMMORTAL Protocol

Initial project profile:

- **Repository:** LiberoNuvola/Immortal-Protocol
- **Working branch observed:** work/immortal-green-closure
- **HEAD observed on 2026-11-08:** 11fefbdb13a43f9e9133d8998330378daeeddc2e
- **Coordination:** preserve the repository's central coordination checkpoint and the assigned Agent A/B/C workstream boundaries.
- **Workspace:** isolated task worktrees derived from the explicitly selected source branch; never work directly on protected/default branches.
- **Execution:** existing repository workflows, tests, evidence tools and task-specific gates remain authoritative.

IMMORTAL is the first project profile, not a special authority engine inside Cormia. Its project policy must encode the exact current workstream and protected-operation constraints. Cormia must not infer permission to alter protocol semantics from the mere fact that it can read the repository.

For any task touching economic rules, validators, V3/Reveal, EEV, deployment/Issue admission, signing or ledger state, the Supervisor must require an explicit task scope and the corresponding project mandate/host policy. Existing central checkpoints and exact evidence remain the source for task assignment and change-control. No task may bypass a blocked gate by changing its classification or editing an upstream normative boundary.

The local IMMORTAL Agent v0.8, Coding Workspace, Resource Manager and Evolution Manager are compatibility targets. Cormia must preserve their existing safety boundaries and avoid taking ownership of their local stores without a reviewed migration.

## 8. Other projects

A second project is registered by creating a separate Project Descriptor, host-resolved workspace, mandate, host policy, task/evidence journals and operation-adapter profile. It must not require changes to the Supervisor's authority logic.

The initial multi-project proof should use:
- Project A: IMMORTAL Protocol, with its real branch/mandate/host-policy bindings;
- Project B: a separate test repository or explicitly selected user project with its own workspace and task manifest.

A cross-project task/dependency is not implicit. If one project consumes an artifact from another, the dependency must be represented by a digest-bound, policy-approved artifact reference. A task in Project B must never inherit Project A's task authority.

## 9. Autonomy levels and explicit boundaries

| Work class | Target behavior |
|---|---|
| Read/research/analysis within mandate | Autonomous |
| Plan/decompose in-scope tasks | Autonomous, Core validates |
| Create task worktree / write code in authorized task scope | Autonomous under standing mandate and isolated adapter |
| Run declared tests/builds | Autonomous with Resource Manager admission |
| Retry a bounded failed task | Autonomous only under task retry policy and fresh trust checks |
| Open/update feature branch or PR | Only when the mandate and host policy explicitly permit |
| Merge protected branch, release, deploy | Separate explicit authority |
| Wallet signing, funds transfer, Cardano settlement | Separate explicit authority; not part of general coding autonomy |
| Modify the mandate, trust anchor or project identity | Never self-authorized by an agent |
| Promote Cormia/Agent self-modification candidate | Existing human review/promotion boundary remains; no self-promotion |

The user should not have to type an approval phrase for every ordinary edit when a valid standing project mandate explicitly authorizes that task class. This does not remove separate gates for protected or irreversible operations.

## 10. Current component inventory — verified against the Cormia branch

| Component | Current evidence | Operational status |
|---|---|---|
| Local ModelProvider and llama.cpp adapter | Real Granite 4.2 local smoke returned PASS; HTTP stub tests and Core CI pass | Available as an inference boundary |
| Trusted Project Context Resolver | Host-port orchestration and contract tests exist | Synthetic port doubles; production identity/mandate/consent/revocation providers absent |
| Project Lifecycle journal/reducer | Local append-only journal and deterministic reducer tests exist | Not integrated with a task orchestrator |
| Plan–Execute Capability Broker | Host-owned broker, one-shot digest-bound execute, per-step revalidation and test suite exist | Isolated enforcement slice; task and trust provider doubles in tests |
| Task Manifest authority | Broker has host-only load/revalidate ports | No production signature-verification provider wired |
| IMMORTAL Task Store v1 adapter | Read-only inspector; no filesystem writes or task execution | Compatibility only |
| Coding Workspace adapter | Four read-only operations; no write/patch/test exposure | Insufficient for unattended code changes |
| Evolution Manager adapter | Candidate-only operations and trusted-host evaluation wrapper | Not wired into Cormia/Agent loop; promotion remains denied |
| Local Resource Manager adapter | Fixed operation-to-resource mapping and lease/release wrapper | Not integrated with global scheduler; process-local limits |
| Multi-project registry/Supervisor | No integrated implementation | Missing |
| Persistent task queue/graph/checkpoint recovery | No Cormia-owned integrated task engine | Missing |
| Project/task worktree isolation | Mandate requires isolated worktree; production worktree manager not integrated | Missing |
| Autonomous plan→execute→verify loop | Provider, resolver and broker exist as separate slices | Not integrated |
| Continuous local service / restart recovery | No integrated multi-project service loop | Missing |

## 11. Implementation sequence — prioritize useful autonomous work

1. **Project Runtime composition:** define the host-owned registration contract for multiple projects and create one independently bound Runtime context (resolver, task authority, broker, host policy, adapters) per project. Project identity is never model-selected.
2. **Durable task engine:** implement project-scoped task queues, task graph, attempts, event journal, checkpoint/evidence references and crash recovery. Reconcile the existing IMMORTAL Agent task store without taking over its writes.
3. **Workspace/worktree adapter:** provide task-scoped isolated worktrees and bounded write/patch/test/Git operations. Reuse the existing Coding Workspace/Evolution Manager controls; do not add a general shell or arbitrary command runner.
4. **Autonomous execution loop:** connect ModelProvider → strict proposal parser → PLAN → Core broker → Resource Lease → fixed adapter → verifier/evidence → durable task transition. Add bounded retries and safe pause/recovery.
5. **Global multi-project scheduler:** round-robin/fair scheduling with global and per-project concurrency/resource caps, independent pause/block behavior and starvation tests.
6. **IMMORTAL first integration:** create the actual local Project Runtime profile on the selected working branch; prove one bounded task end-to-end without changing protected semantics or bypassing the central checkpoint.
7. **Second-project proof:** register another repository/workspace and prove independent concurrent progress, context separation, authority isolation and resource fairness.
8. **Local service operations:** add explicit host start/stop/status, startup recovery, safe shutdown and operator-visible queue/lease/evidence views. No hidden background process or silent restart.
9. **Only afterwards:** expand to multi-agent teams, remote workers, project support/finance, CRC, Cardano, Materios and optional community resource mesh.

## 12. Acceptance gates

The first useful release is accepted only when all of the following are demonstrated on the operator's Windows environment:

- Two registered projects coexist under one Supervisor.
- An IMMORTAL task and a separate-project task can both make progress without sharing workspace, task context or authority.
- Each project has its own mandate, task queue, journals, worktrees and evidence.
- The model cannot switch the project or choose a repository/worktree by returning different text.
- Unauthorized operations produce zero host-adapter dispatches.
- Revoking/pausing Project A blocks A but does not stop independently authorized Project B.
- Global/per-project capacity limits are enforced; scarcity queues tasks without oversubscription.
- A process restart recovers queued work, classifies interrupted work and never blindly repeats uncertain side effects.
- Provider failure causes no remote fallback and preserves durable task state.
- Ordinary in-scope code work does not require per-file human confirmation when covered by a valid standing mandate.
- Protected branch merge, release, deployment, wallet and ledger operations remain separately gated.
- Test/build results and source revisions are bound to durable evidence, not just model claims.

Passing unit tests or a local model smoke alone does not close these gates.

## 13. Out of scope for this priority

Do not prioritize now:
- Patreon-like support pages or payment custody;
- CRC accounting or reward pools;
- Cardano settlement or wallet automation;
- distributed peer mesh and remote donated compute;
- bespoke chat/CRDT collaboration tools;
- a new CI engine or self-improvement path that can promote itself.

These remain optional future layers. They must not delay the local-first multi-project Project Supervisor and autonomous execution loop.
