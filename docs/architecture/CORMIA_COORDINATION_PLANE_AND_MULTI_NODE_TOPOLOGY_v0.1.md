# Cormia Coordination Plane and Multi-Node Topology v0.1

- **Date:** 2026-11-03
- **Status:** architecture proposal / non-normative / not implemented as a production coordinator
- **Scope:** multi-agent, multi-machine Cormia Core projects; local-first by default
- **Related contracts:** [Cormia Core Contracts v0.1](./CORMIA_CORE_CONTRACTS_v0.1.md), [Core Interface Catalog v0.1](./CORMIA_CORE_INTERFACE_CATALOG_v0.1.md), [ADR-0010](../adr/0010-autonomous-project-delegation-and-runtime-authority.md)
- **Optional protocol:** [IMMORTAL-AEP SPEC](../../SPEC.md)

## 1. Decision in one sentence

The coordination layer is a **Cormia Runtime service (the Coordination Plane)**. It is a logical control plane that may be hosted on a primary PC, an always-on home server, or a VPS/cloud instance. It is **not** GitHub, a blockchain, or a shared sandbox.

The Core contracts define project identity, authority, lifecycle and resource/support boundaries. The Coordination Plane is the running service that consumes those contracts to coordinate project work. Worker Runtime instances execute tasks on the machines that actually provide CPU, GPU, memory, storage and local models.

A project has one logically authoritative coordinator for task assignment and lease state in v0.1. The service can move between hosts; its physical host is a deployment choice, not part of the project's identity.

## 2. Separate the logical planes

| Plane | Responsibility | Typical location |
|---|---|---|
| **Cormia Core / project authority** | Project Descriptor, mandate reference, steward/accountability, project lifecycle and host policy | Authoritative coordinator store; trusted host services |
| **Coordination Plane** | Task decomposition, dependency tracking, worker selection, dispatch, lease coordination, progress, recovery and project-level observability | One coordinator service per project in the initial topology |
| **Worker / execution plane** | Local agent/model, tools, capability enforcement, resource admission and task execution | Each participating PC/server |
| **Workspace and artifact plane** | Isolated task worktrees, source, datasets, outputs, checkpoints and evidence objects | Worker-local storage plus explicitly configured artifact storage |
| **Version-control plane** | Source history, branches, commits, pull requests and human review | Git repository such as GitHub |
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

## 6. What each of the commonly confused components does

### GitHub

GitHub stores and reviews source code. It is useful for branches, commits, pull requests and independent human review. It is not designed to be the real-time runtime scheduler or authoritative lease store. Local task work should continue when GitHub is unavailable; remote push/PR waits for the host credential broker and network.

### Blockchain

A blockchain is not the coordinator for ordinary multi-agent work. It is too public and too costly/slow for private prompts, task messages, frequent heartbeats, local resource telemetry or per-operation scheduling. An explicitly selected AEP/economic profile MAY use a ledger for task commitments, escrow, dispute/settlement or minimal public commitments/anchors. The workers still execute off-chain and the Coordination Plane still coordinates execution.

The standalone Cormia Core must continue to plan and execute local tasks when no blockchain, wallet, token, payment provider or AEP adapter is configured.

### Sandbox

A sandbox is an execution boundary on a worker machine, not a meeting place for agents and not the global coordinator. Each task receives an isolated workspace and bounded tools. Agents coordinate through the Coordination Plane and exchange typed results/artifact references; they do not need simultaneous write access to one shared directory.

### Cloud

Cloud is one possible host for the coordinator and/or artifact storage, not an architectural requirement. The owner may self-host on a PC or home server. Remote workers can connect to a self-hosted coordinator through an authenticated encrypted network path. No remote/cloud inference fallback is implicit.

## 7. Hosting choices

| Deployment | Coordinator location | Suitable use | Main trade-off |
|---|---|---|---|
| **Single-PC local** | Primary PC also runs a worker | First prototype, one user, several local agents | Other machines cannot receive new work when the PC is offline |
| **Home hub** | Always-on mini PC/home server/NAS-class host | Several household/workstation nodes | Owner operates updates, backups, network and availability |
| **VPS/cloud hub** | Owner-controlled remote instance | PCs in different places; coordinator stays online | Hosting cost and additional trust/credential/network exposure |
| **Federated coordinators** | Multiple independently operated control nodes | Future multi-organization or resilient network | Conflict resolution, authority, identity, leases and partition recovery become much harder |

**Recommended first topology:** one owner-controlled coordinator on the primary PC or an always-on home server, with one worker process per participating machine. Add a VPS only when real availability or geographic reach requires it. Keep the coordinator's data portable so the host can be moved without changing project identity.

## 8. Failure and offline behavior

- If the coordinator is unavailable, workers do not accept new assignments or invent work outside their current mandate.
- An already-running task may continue only within its existing, unexpired assignment/lease and local policy; operations that require fresh trust/revocation checks stop at a safe boundary.
- Workers may queue bounded completion metadata/artifact references locally and reconcile them after reconnect. Duplicate delivery must be idempotent.
- A stale or ambiguous lease is not silently renewed. The coordinator reconciles the task attempt and resource state before assigning competing work.
- A lost worker does not erase project state. The coordinator can mark the attempt interrupted/expired and schedule a new attempt after checking side effects and checkpoints.
- Coordinator persistence and backup/restore are required before claiming crash-safe multi-node orchestration. A replicated/high-availability coordinator is a later profile, not assumed by v0.1.

## 9. Authority and privacy boundaries

1. Project mandate and host policy remain the upper authority bounds. Registering a worker or donating capacity never widens either.
2. Each host owner decides which resources, capabilities, data classes and time windows are offered.
3. The coordinator receives bounded metadata and task envelopes, not private keys, API tokens or raw OS credentials.
4. The model never selects a remote endpoint or chooses whether private prompts leave the host. Remote execution/inference requires explicit opt-in and a compatible privacy profile.
5. Every worker enforces its own local boundary even when the coordinator says a task is eligible.
6. A project's coordinator does not grant access to another project or another user's host by default.
7. Financial patronage, in-kind compute support, task priority, governance and operational authority remain separate.
8. No public ledger receives prompts, private task payloads, secrets, full telemetry or private artifact bytes.

## 10. Relationship between Cormia Core and IMMORTAL-AEP

Cormia Core is the general-purpose project and agent coordination foundation. It supports local-only projects and can coordinate privately owned agents/resources without any payment or blockchain integration.

IMMORTAL-AEP is an optional protocol profile for open task publication/assignment, independent verification and (where selected) economic commitments and settlement. Its public/permissionless worker model does not replace the private project coordinator. A task may be:
- local/private and coordinated only by Cormia Core;
- executed by a worker from the owner's own machines;
- explicitly offered to an external AEP worker/verifier network under an AEP profile.

When a task opts into AEP, its AEP manifest/economic state is handled by the protocol adapter and applicable ledger. Private project authority, local host policy, workspaces, model calls and execution remain off-chain. The AEP adapter cannot silently broaden the project mandate.

## 11. Current implementation status — critical distinction

This topology is an architecture proposal, not a report of an existing deployed service.

The Cormia repository currently has proposal-level Core contracts and schemas, an isolated Project Lifecycle journal/reducer, a fail-closed Trusted Project Context Resolver orchestration contract, and a separate local Resource Manager compatibility wrapper. The wrapper is process-local and is not connected to a coordinator or Agent execution loop.

The repository does **not** yet implement:
- the generic Cormia Coordination Plane service;
- an AEP task engine/state reducer, scheduler or worker registration protocol;
- a multi-node authenticated message/dispatch channel or peer mesh;
- a durable project task/attempt journal and checkpoint/restart reconciler;
- a persistent cross-worker Resource Lease registry;
- remote resource discovery/acceptance/revocation;
- a production trusted mandate/key/consent/identity/revocation provider stack;
- an end-to-end multi-agent, multi-PC autonomous execution loop.

Consequently, no multi-PC coordination, remote scheduling or production autonomous worker network is claimed today. Existing CI tests validate bounded contracts and isolated components only.

## 12. Implementation sequence

1. Freeze the Coordinator ↔ Worker protocol boundary and typed task/attempt/lease events, preserving the separate Project, Mandate and Task lifecycles.
2. Define the worker registration and local Resource Provider port; expose only owner-accepted, validated capacity with a bounded privacy profile.
3. Add durable task/attempt state and idempotent assignment/lease reconciliation at the coordinator.
4. Bind one local worker to the current host adapters without changing the legacy Agent approval path.
5. Prove a two-process, two-workspace local task flow with synthetic workers and no per-operation human prompts after one mandate.
6. Add a second machine over an authenticated network path; test disconnect, lease expiry, duplicate delivery, worker crash and recovery.
7. Add artifact transfer and Git integration with per-task worktrees.
8. Only after local multi-node behavior is sound, consider remote/community providers and optional AEP/ledger integration.

No blockchain, cloud vendor, transport, broker, consensus algorithm, key format, economic parameter or production trust provider is selected by this document. Those decisions remain separately versioned and evidence-driven.
