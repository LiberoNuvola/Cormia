# Cormia Coordination Plane, Team Collaboration and Multi-Node Topology v0.1

- **Date:** 2026-11-03
- **Status:** architecture proposal / non-normative / not implemented as a production coordinator
- **Scope:** multi-agent, multi-machine Cormia Core projects; local-first by default
- **Related contracts:** [Cormia Core Contracts v0.1](./CORMIA_CORE_CONTRACTS_v0.1.md), [Core Interface Catalog v0.1](./CORMIA_CORE_INTERFACE_CATALOG_v0.1.md), [ADR-0010](../adr/0010-autonomous-project-delegation-and-runtime-authority.md)
- **Optional protocol:** [IMMORTAL-AEP SPEC](../../SPEC.md)

## 1. Decision in one sentence

The coordination layer is a **Cormia Runtime service (the Coordination Plane)**. It is a logical project environment that may be hosted on a primary PC, an always-on home server, or a VPS/cloud instance. It is **not** GitHub, a blockchain, or a single shared sandbox.

The Coordination Plane is more than a task scheduler. It contains an agent-to-agent **Team Room** for verbal coordination, a **Project Workbench** for shared collaborative work, an **Integration & Verification Bench** where contributions are composed and tested, and a **Delivery Gate** that decides whether the finished result stays local or is published to an external destination. The scheduler, authority checks, resource leases, shared state and event journal support all four stages.

Worker Runtime instances execute tasks on the machines that actually provide CPU, GPU, memory, storage and local models. They can work independently, pair on the same artifact under conflict controls, or contribute modules to a common integration workspace.

A project has one logically authoritative coordinator for task assignment and lease state in v0.1. The service can move between hosts; its physical host is a deployment choice, not part of the project's identity.

## 2. Separate the logical planes

| Plane | Responsibility | Typical location |
|---|---|---|
| **Cormia Core / project authority** | Project Descriptor, mandate reference, steward/accountability, project lifecycle and host policy | Authoritative coordinator store; trusted host services |
| **Coordination Plane / Control** | Task graph, dependency tracking, agent/worker registry, scheduling, authority checks, lease coordination, durable state and recovery | One logical coordinator per project initially |
| **Team Collaboration Plane** | Agent-to-agent discussion, shared project context, proposals, decisions, peer review and collaboration sessions | Team Room hosted with the coordinator; local clients on each node |
| **Project Workbench** | Common project files/artifacts, isolated task workspaces, patch exchange, local commits and a controlled integration workspace | Owner-controlled project storage plus worker-local worktrees |
| **Integration & Verification Bench** | Compose contributions, compile/build, run tests, review results and create a verified candidate with evidence | Local or owner-controlled execution/storage; may use several workers |
| **Worker / execution plane** | Local agent/model, tools, capability enforcement, resource admission and task execution | Each participating PC/server |
| **Workspace and artifact plane** | Task worktrees, common integration workspace, datasets, outputs, checkpoints and evidence objects | Worker-local storage plus explicitly configured project artifact storage |
| **Local version-control plane** | Local source history, task branches/worktrees, integration commits and snapshots; can exist without any remote | A local Git repository or another versioned project store |
| **External publication plane (optional)** | Push/publish a verified candidate, open a PR, release or deploy under a project delivery policy | GitHub or another explicitly configured destination |
| **Optional protocol/economic plane** | Public task commitments, open worker/verifier participation, escrow, dispute and settlement when explicitly selected | AEP adapter and its selected ledger; execution remains off-chain |

These planes exchange typed, bounded references and events. None silently becomes another plane's authority.

## 3. Default topology: one coordinator, many workers

For one person operating several agents across several PCs, start with a hub-and-spoke topology:

```text
                    PROJECT OWNER / STEWARD
                              |
                     one-time project mandate
                              |
                +-----------------------------+
                | CORMIA COORDINATION PLANE   |
                | one logical project leader  |
                |                             |
                | project + task state        |
                | task DAG / dependencies     |
                | agent and worker registry   |
                | scheduler / lease manager   |
                | policy and recovery         |
                | evidence and artifact index |
                +-----------------------------+
                    /          |          \\
             secure channel  secure channel  secure channel
                  /              |               \\
         +----------------+ +----------------+ +----------------+
         | WORKER NODE A  | | WORKER NODE B  | | WORKER NODE C  |
         | PC / laptop    | | workstation    | | GPU machine    |
         |                | |                | |                |
         | agent(s)       | | agent(s)       | | agent(s)       |
         | local model    | | local model    | | local model    |
         | resource port  | | resource port  | | resource port  |
         | isolated task  | | isolated task  | | isolated task  |
         | worktrees      | | worktrees      | | worktrees      |
         +----------------+ +----------------+ +----------------+
                    \\          |          /
                     \\         |         /
                      +------------------+
                      | Git / Artifacts  |
                      | source + outputs |
                      +------------------+
```

Each machine runs a local Worker Runtime. The worker reports a bounded capability/resource view; it does not expose its entire filesystem, credentials or arbitrary shell to the coordinator. The coordinator assigns a task only when the worker is eligible, the project mandate permits the work, the worker's local policy permits it, and the necessary resource lease is granted.

A single PC can host both the coordinator and one or more workers. That is the simplest first deployment and remains a valid local-only configuration.

## 4. Where state and data live

The system does not need one giant shared folder.

- **Coordinator store:** authoritative project/task assignment state, dependency graph, worker registrations, lease metadata, idempotency records, policy references and event journal. In the first deployment this can be a local durable store on the coordinator host.
- **Worker-local state:** task worktree, model cache, local execution logs, temporary files and attempt/checkpoint data. The worker keeps only what it needs to execute and recover its own assigned work.
- **Artifact store:** larger datasets, build outputs, test reports and evidence objects. This can be coordinator storage or an explicitly configured object/file store. Records keep content digests and access-controlled references, not private payloads on a public chain.
- **Git remote:** source history and collaboration/review. Each worker uses a dedicated clone/worktree/branch or an equivalent isolated checkout. GitHub is not the live scheduler, lease registry or agent message bus.
- **Model storage:** model weights and local inference caches stay on the machine that runs them unless the owner explicitly enables a remote model/provider profile.

A mounted shared filesystem MAY be used for selected immutable datasets or artifacts, but it is not the default concurrency mechanism for source edits. Parallel agents should work in isolated worktrees; integration is an explicit merge/rebase/integration task.

## 5. How coordination actually happens

The coordinator and workers need an authenticated network protocol. The concrete transport and identity technology remain open; this document does not choose a cloud vendor, VPN, message broker or cryptographic profile.

The logical exchange is:

1. A worker joins a project using a host-authenticated worker identity and a project-scoped connection.
2. It advertises only host-approved capabilities and bounded resource offers, with freshness and privacy constraints.
3. The coordinator decomposes the project objective into tasks and tracks dependencies.
4. The scheduler selects an eligible worker and creates a task assignment and time-bounded lease.
5. The worker independently validates the assignment against its local mandate, capability policy, workspace binding and resource admission.
6. The worker executes inside its own isolated workspace and reports progress, status and evidence references.
7. The coordinator validates the returned task/attempt binding, updates project/task state and schedules dependent work.
8. Source changes are integrated through Git; large outputs/evidence are stored through the artifact plane.

A model may suggest a task assignment, but only the trusted coordinator and worker policy boundaries authorize it. Task text cannot select arbitrary machine paths, resource classes, network peers or credentials.

## 6. Team collaboration, shared workbench and pre-publication integration

The missing stage is a **project team environment between the agents and any external Git host**. The agents must be able to converse, exchange partial work, co-develop artifacts, integrate components and test the combined result before a remote publication decision exists.

This is part of the Coordination Plane, but it is not the same thing as the scheduler. It has four cooperating surfaces:

### 6.1 Team Room — verbal coordination

Agents in the same project can communicate in natural language through project/workstream/task threads. They can:
- discuss the goal, architecture and implementation options;
- ask another agent for help or a second opinion;
- explain blockers and propose task reassignments;
- review another agent's patch, design or test result;
- coordinate sequencing and integration work;
- keep the human owner in the loop when the project policy requires a decision.

The Team Room maintains references to tasks, artifacts, decisions and evidence. Important decisions are promoted from conversation into structured, attributable project decision records. Conversation alone is not authority: a chat message cannot widen a mandate, change resource permissions, approve a protected action or silently rewrite the project plan.

### 6.2 Project Workbench — actual teamwork

The Workbench is the project-level working environment shared by the team. It is the place where agents exchange and combine real work products, not merely messages.

For software and structured-artifact projects it contains:
- the project source tree and shared project documents;
- a local repository/version history, independent of GitHub;
- individual task worktrees or component branches for parallel contributions;
- a common integration worktree/branch where accepted contributions are composed;
- build inputs, datasets, generated outputs, patches and review notes.

The agents have three collaboration modes:
1. **Parallel contribution:** each agent works on an isolated task worktree and submits a patch/artifact to the Workbench.
2. **Pair/team work:** agents can work on the same module or document through explicit file/module ownership, short-lived edit leases or a conflict-aware collaboration backend. They can see one another's changes and discuss them in the Team Room.
3. **Integration work:** an integrator agent (or a trusted integration service) applies accepted patches to the common integration workspace, resolves conflicts with the contributing agents, and preserves attribution and source snapshots.

This does not mean an uncontrolled shared folder where every agent can overwrite every file. The Workbench provides controlled shared visibility and collaboration, while the host enforces workspace boundaries, file/module claims and conflict resolution. A shared filesystem may be one storage backend, but is not the coordination protocol.

**Local Git is allowed here.** Agents may create local commits, branches and tags in the project's local repository. Those commits remain private to the project until the owner selects an external publication destination. GitHub is not required for local history or teamwork.

### 6.3 Integration & Verification Bench — combine before publishing

The integration stage is an internal release candidate pipeline:
1. collect accepted patches/components from the Workbench;
2. compose them in the integration workspace;
3. compile/build/package the combined project;
4. run the declared test, lint, audit, simulation or validation profiles;
5. request independent agent review where the assurance profile requires it;
6. record failures, fixes, reruns and evidence;
7. freeze a candidate snapshot with source/artifact digests, test results, environment identity and unresolved risks.

The output is a **Verified Project Candidate**, not automatically a GitHub commit, release or deployment. Failed tests remain visible; the team may repair and repeat within its mandate and resource budget. A coordinator cannot convert a failed or missing test into a pass.

The bench applies to code projects, but is not hard-coded to code. A non-software project can compose and validate documents, datasets, plans, images, research or other deliverables using its own validation profile.

### 6.4 Delivery Gate — GitHub is an optional destination

Every project declares a delivery profile. Examples:
- **Local action only:** carry out a bounded local task, then report what changed. Example: clean and organize a PC. No Team Room, repository, GitHub account or publication stage is necessary for a single-agent task.
- **Local deliverable:** save files, reports or packages to a chosen local destination.
- **Project artifact:** produce a dataset, document, build or evidence package in project storage.
- **Software repository:** maintain local source history and a tested integration branch; no remote host is required.
- **GitHub publication:** publish a verified candidate to a named repository/branch or open a pull request only after the project's delivery authorization.
- **AEP/network task:** optionally publish a task or offer work to an external worker/verifier network under its separate protocol and privacy/economic profile.

**Default publication rule:** completing local work, merging contributions into the internal integration workspace and passing the local test profile do not require a new human prompt. Publishing to GitHub is a separate external boundary and, by default, the Runtime presents the candidate and asks the owner to authorize the push/PR. A project owner may instead grant a narrow standing publication mandate for a specific repository, branch and operation set; absent that explicit delegation, the Runtime does not publish.

Pushing a branch/opening a PR, merging to a protected branch, releasing a package and deploying to production are distinct actions. Authorization for one does not imply authorization for the others. A GitHub PR is not the same as a production deployment.

### 6.5 End-to-end team flow

```text
PROJECT OWNER / MANDATE
          |
          v
CORMIA COORDINATION PLANE
          |
          +---- Team Room <----> agents discuss / plan / peer-review
          |
          +---- task graph + scheduler + resource leases
          |
          v
WORKER NODES (one or many PCs)
          |
          +---- isolated task worktrees
          +---- pair/team editing under conflict controls
          +---- patches, commits and artifacts
          |
          v
PROJECT WORKBENCH
          |
          v
INTEGRATION & VERIFICATION BENCH
          |
          +---- compose / build / test / review
          +---- evidence + candidate digest
          |
          v
VERIFIED PROJECT CANDIDATE
          |
          +---- local action/report/artifact -> DONE
          |
          +---- GitHub publish -> owner authorization by default
          |
          +---- other optional delivery adapter
```

The same Core supports solo and team execution. The team stages are activated only when the project's task needs multiple agents or collaborative integration. A local maintenance task must not be forced through repository, build, GitHub or economic infrastructure it does not need.


## 7. What each of the commonly confused components does

### GitHub

GitHub stores and reviews source code. It is useful for branches, commits, pull requests and independent human review. It is not designed to be the real-time runtime scheduler or authoritative lease store. Local task work should continue when GitHub is unavailable; remote push/PR waits for the host credential broker and network.

### Blockchain

A blockchain is not the coordinator for ordinary multi-agent work. It is too public and too costly/slow for private prompts, task messages, frequent heartbeats, local resource telemetry or per-operation scheduling. An explicitly selected AEP/economic profile MAY use a ledger for task commitments, escrow, dispute/settlement or minimal public commitments/anchors. The workers still execute off-chain and the Coordination Plane still coordinates execution.

The standalone Cormia Core must continue to plan and execute local tasks when no blockchain, wallet, token, payment provider or AEP adapter is configured.

### Sandbox

A sandbox is an execution boundary on a worker machine, not the Team Room, the Workbench or the global coordinator. Each task receives an isolated workspace and bounded tools. Agents coordinate through the Team Room, exchange patches/artifact references through the Workbench and compose accepted contributions in the integration workspace. Pair work is supported through host-controlled edit leases or conflict-aware operations; unrestricted shared writes are not.

### Cloud

Cloud is one possible host for the coordinator and/or artifact storage, not an architectural requirement. The owner may self-host on a PC or home server. Remote workers can connect to a self-hosted coordinator through an authenticated encrypted network path. No remote/cloud inference fallback is implicit.

## 8. Hosting choices

| Deployment | Coordinator location | Suitable use | Main trade-off |
|---|---|---|---|
| **Single-PC local** | Primary PC also runs a worker | First prototype, one user, several local agents | Other machines cannot receive new work when the PC is offline |
| **Home hub** | Always-on mini PC/home server/NAS-class host | Several household/workstation nodes | Owner operates updates, backups, network and availability |
| **VPS/cloud hub** | Owner-controlled remote instance | PCs in different places; coordinator stays online | Hosting cost and additional trust/credential/network exposure |
| **Federated coordinators** | Multiple independently operated control nodes | Future multi-organization or resilient network | Conflict resolution, authority, identity, leases and partition recovery become much harder |

**Recommended first topology:** one owner-controlled coordinator on the primary PC or an always-on home server, with one worker process per participating machine. Add a VPS only when real availability or geographic reach requires it. Keep the coordinator's data portable so the host can be moved without changing project identity.

## 9. Failure and offline behavior

- If the coordinator is unavailable, workers do not accept new assignments or invent work outside their current mandate.
- An already-running task may continue only within its existing, unexpired assignment/lease and local policy; operations that require fresh trust/revocation checks stop at a safe boundary.
- Workers may queue bounded completion metadata/artifact references locally and reconcile them after reconnect. Duplicate delivery must be idempotent.
- A stale or ambiguous lease is not silently renewed. The coordinator reconciles the task attempt and resource state before assigning competing work.
- A lost worker does not erase project state. The coordinator can mark the attempt interrupted/expired and schedule a new attempt after checking side effects and checkpoints.
- Coordinator persistence and backup/restore are required before claiming crash-safe multi-node orchestration. A replicated/high-availability coordinator is a later profile, not assumed by v0.1.

## 10. Authority and privacy boundaries

1. Project mandate and host policy remain the upper authority bounds. Registering a worker or donating capacity never widens either.
2. Each host owner decides which resources, capabilities, data classes and time windows are offered.
3. The coordinator receives bounded metadata and task envelopes, not private keys, API tokens or raw OS credentials.
4. The model never selects a remote endpoint or chooses whether private prompts leave the host. Remote execution/inference requires explicit opt-in and a compatible privacy profile.
5. Every worker enforces its own local boundary even when the coordinator says a task is eligible.
6. A project's coordinator does not grant access to another project or another user's host by default.
7. Financial patronage, in-kind compute support, task priority, governance and operational authority remain separate.
8. No public ledger receives prompts, private task payloads, secrets, full telemetry or private artifact bytes.

## 11. Relationship between Cormia Core and IMMORTAL-AEP

Cormia Core is the general-purpose project and agent coordination foundation. It supports local-only projects and can coordinate privately owned agents/resources without any payment or blockchain integration.

IMMORTAL-AEP is an optional protocol profile for open task publication/assignment, independent verification and (where selected) economic commitments and settlement. Its public/permissionless worker model does not replace the private project coordinator. A task may be:
- local/private and coordinated only by Cormia Core;
- executed by a worker from the owner's own machines;
- explicitly offered to an external AEP worker/verifier network under an AEP profile.

When a task opts into AEP, its AEP manifest/economic state is handled by the protocol adapter and applicable ledger. Private project authority, local host policy, workspaces, model calls and execution remain off-chain. The AEP adapter cannot silently broaden the project mandate.

## 12. Current implementation status — critical distinction

This topology is an architecture proposal, not a report of an existing deployed service.

The Cormia repository currently has proposal-level Core contracts and schemas, an isolated Project Lifecycle journal/reducer, a fail-closed Trusted Project Context Resolver orchestration contract, and a separate local Resource Manager compatibility wrapper. The wrapper is process-local and is not connected to a coordinator or Agent execution loop.

The repository does **not** yet implement:
- the generic Cormia Coordination Plane service;
- the agent Team Room with durable project threads and structured decision records;
- the shared Project Workbench/integration worktree with pair-editing, patch exchange and conflict management;
- the Integration & Verification Bench and Verified Project Candidate lifecycle;
- project delivery profiles and the external publication authorization gate;
- an AEP task engine/state reducer, scheduler or worker registration protocol;
- a multi-node authenticated message/dispatch channel or peer mesh;
- a durable project task/attempt journal and checkpoint/restart reconciler;
- a persistent cross-worker Resource Lease registry;
- remote resource discovery/acceptance/revocation;
- a production trusted mandate/key/consent/identity/revocation provider stack;
- an end-to-end multi-agent, multi-PC autonomous execution loop.

Consequently, no multi-agent team collaboration, pre-publication integration pipeline, multi-PC coordination, remote scheduling or production autonomous worker network is claimed today. Existing CI tests validate bounded contracts and isolated components only.

## 13. Implementation sequence

1. Freeze the Coordinator ↔ Worker protocol boundary and typed task/attempt/lease events, preserving the separate Project, Mandate and Task lifecycles.
2. Define the worker registration and local Resource Provider port; expose only owner-accepted, validated capacity with a bounded privacy profile.
3. Add durable task/attempt state and idempotent assignment/lease reconciliation at the coordinator.
4. Implement the Team Room message/thread model and structured decision records; keep conversation separate from authority.
5. Implement the Project Workbench with local repository history, task worktrees, contribution patches, pair-edit controls and an integration worktree.
6. Implement the Integration & Verification Bench: candidate snapshots, build/test profiles, evidence, independent review and repair loops.
7. Add project delivery profiles; default GitHub publication to a candidate-level owner authorization, separately from protected merge/release/deploy.
8. Bind one local worker to the current host adapters without changing the legacy Agent approval path; prove a solo local task (such as PC cleanup) does not require repository or team infrastructure.
9. Prove a two-agent/two-workspace team flow with synthetic workers: agent discussion, shared artifact work, integration, tests and local candidate completion with no per-operation prompts.
10. Add a second machine over an authenticated network path; test disconnect, lease expiry, duplicate delivery, worker crash and recovery.
11. Only after local collaboration/integration is sound, consider remote/community providers and optional AEP/ledger integration.

No blockchain, cloud vendor, transport, broker, consensus algorithm, key format, economic parameter or production trust provider is selected by this document. Those decisions remain separately versioned and evidence-driven.
