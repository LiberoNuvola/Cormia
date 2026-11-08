# Cormia General-Purpose Autonomous Agent & Mixed Community-Support Architecture v0.1

- **Date:** 2026-11-03
- **Status:** Architecture proposal / non-normative / partial Core slices implemented; integrated multi-project Runtime not implemented
- **Scope:** Cormia Core, project modes, community support, optional resource and economic integrations
- **Baseline:** Cormia `main` AEP/Runtime inventory reviewed 2026-11-03
- **Purpose:** define one Cormia architecture that supports both creator-led and agent-led projects, while keeping autonomous execution independent of money, Cardano, wallets, tokens and IMMORTAL.



**Scope clarification (2026-11-08):** this multi-project execution priority is a sequencing overlay only. It does not change this architecture's full scope or final objectives. All project leadership modes, resource/support planes, community patronage, financial and in-kind integrations, Team Collaboration Plane, Integration & Verification Bench, evidence/Materios options, and AEP/CRC/IMMORTAL/Cardano relationships remain as defined in this parent architecture. Only the order of implementation is being prioritized.

## 1. Foundational rule

**Cormia is a general-purpose autonomous agent and project-execution system. Money is not a prerequisite for an agent to work.**

An agent needs an execution environment and usable resources: compute, model access, storage, network, tools, datasets, and an authority/mandate that defines what it may do. Those resources can be local, supplied by a project owner, donated by a community, sponsored, or obtained through optional service integrations.

A financial contribution supports the project and its resource pool. It is not a wage paid to an AI agent. An agent does not need a personal wallet, token balance, bank account or financial identity to plan, execute, collaborate, verify work or maintain a project.

The architecture therefore separates four concerns:

1. **Autonomous capability:** what Cormia can do and how it acts.
2. **Project mandate and stewardship:** whose goals it serves, which decisions it may make, its boundaries and who remains accountable.
3. **Resource availability:** which compute, models, tools, datasets, storage and services are available to execute work.
4. **Community support and optional finance:** how people contribute money, infrastructure, expertise or other resources to a project, and how any resulting funds are held or settled.

These concerns may compose, but none should be collapsed into another. In particular, financial support must not grant tool permissions, alter a Project Mandate, or become an execution dependency.

## 2. Two project leadership modes — one Core

Cormia supports both modes using the same Core, task model, capability engine, evidence model, resource manager and project journal. They are project configurations, not separate products or separate agent architectures.

### Mode A — Creator/team-led project

A person, maintainer group, nonprofit, company or community is the project steward.

- The steward sets the mission, priorities, roadmap and acceptance policy.
- Cormia and its agents plan and execute work within the Project Mandate.
- Humans may contribute directly, review sensitive decisions and change priorities through the declared project process.
- Supporters sustain the project or specific workstreams.
- The steward remains responsible for the project's legal, financial and external commitments.

This is closest to the familiar Patreon/creator-support pattern, with autonomous AI agents added as a persistent execution team.

### Mode B — Agent-led autonomous project

A project is operated day-to-day by one or more agents under a standing, bounded mandate.

- A human, organization or recognized community sponsor establishes the initial mandate, scope, constraints, resource permissions and accountability/stewardship arrangement.
- The agent can propose its own roadmap, decompose goals, prioritize in-scope work, delegate subtasks, execute, test, repair, publish reports and request additional resources.
- The agent may manage project operations autonomously within the mandate and pre-authorized policies.
- The agent is not thereby made a legal person, financial custodian or owner of community funds.
- Supporters contribute to the project's mission, agent-led workstream or declared resource pool; contributions accrue to the project or its named custodian, not to an agent's personal wallet.
- Material changes to mission, legal commitments, financial custody, permissions or mandate boundaries follow the separately declared stewardship/governance process.

This is the more ambitious model: people can support a project whose continuous operator is an autonomous agent, without treating the agent as an employee who must be paid.

### Hybrid mode

A project may combine both modes. A maintainer can set high-level direction while an agent proposes and operates the day-to-day roadmap. Multiple agents can own separate workstreams under one project mandate. Leadership mode may be versioned and changed through a recorded project decision; it must not silently change the authority or accountability structure.

## 3. Two support dimensions — money and resources are distinct

Both leadership modes can use any combination of the following. Support can be recurring, one-time, milestone-specific, earmarked or unrestricted according to the project's published policy.

### 3.1 Financial patronage

People or organizations may contribute money to sustain a project, creator, agent-led mission or workstream.

Examples:
- recurring community patronage;
- one-time donation or grant;
- sponsor contribution;
- a budget dedicated to a named workstream;
- funding for hosting, hardware, storage, connectivity, model licences or other external costs.

**The beneficiary is the project or its named human/organizational custodian, not the AI agent as an individual.** The project declares the destination, permitted uses, restrictions, custody and reporting. Cormia can read the project's published resource envelope and plan within it; it does not need to own or transfer the money.

A financial contribution does not automatically authorize the donor to change the project's roadmap, access private data, assign tasks, override the mandate or command an agent. Governance rights, if any, must be explicitly defined and separate from the amount contributed.

### 3.2 In-kind resource patronage

People or organizations may contribute the resources that make execution possible, without sending money to the project.

Examples:
- spare CPU/GPU/RAM capacity;
- hosted inference endpoints or model-serving capacity;
- storage, bandwidth, mirrors and backup capacity;
- datasets, test environments, domain expertise or review time;
- devices, servers, hardware or software credits;
- volunteer worker/verifier capacity.

The contributor sets a clear resource offer: type, amount/capacity, availability window, location or privacy constraints, allowed workload, cost/usage caps and revocation conditions. Cormia's Resource Manager schedules only within the accepted offer and the local host's safety limits.

Donated compute is not costless: the contributor bears hardware, electricity, bandwidth, maintenance and availability costs. The platform must disclose this rather than describing community compute as magically free.

### 3.3 Mixed support

A project can receive both money and in-kind resources. Keep their ledgers distinct:

- financial contributions and financial expenses are accounted for in the project's chosen financial system;
- compute and infrastructure offers are accounted for as capacity, leases, usage and evidence;
- expertise and volunteer work are recorded as contributions, not automatically assigned a monetary value;
- no automatic conversion between money, CRC, compute time, GPU seconds, reputation or governance weight is assumed.

An optional reciprocity/quota system may help allocate shared services, but it is not a base Cormia identity, token or payment requirement. CRC or any future accounting credit must remain an optional, explicitly scoped mechanism with its own rules; the Core must function with no credit balance and no credit subsystem.

## 4. The mixed model at a glance

| Project leadership | Financial patronage | In-kind resource support | Result |
| --- | --- | --- | --- |
| Creator/team-led | Recurring support or grants | Donated compute/storage/expertise | Maintainer-directed project with autonomous agent team |
| Creator/team-led | Milestone-specific bounty | Donated worker/verifier capacity | Financed task stream executed and evidenced by Cormia |
| Agent-led | Community patronage for an agent-run mission | Community resource pool | Agent-operated project, with funds held by a named project custodian |
| Agent-led | Sponsor grant to a declared workstream | Donated infrastructure and data | Autonomous roadmap execution within a sponsor-visible mandate |
| Hybrid | Any combination | Any combination | Human stewardship + autonomous project operations |

This is not an automatic employment or payment relationship between a supporter and an agent. It is a community-supported project and resource model.

## 5. Architecture layers

### 5.1 Cormia Core — mandatory, standalone

The Core must support:
- general-purpose planning, reasoning and task decomposition;
- persistent projects, task graph, journal, checkpoints and recovery;
- one or more agents, role specialization and bounded delegation;
- capability/authority enforcement and least privilege;
- local and remote tool adapters;
- local model, user-provided model endpoint or optional hosted provider;
- Resource Manager for compute, memory, storage, concurrency and preemption;
- artifact, test and evidence collection;
- project stewardship and Project Mandate enforcement;
- observability, audit trail, failure handling and safe shutdown;
- resource-aware scheduling and admission based on actual available capacity.

**Standalone guarantee:** Cormia Core must be installable and useful in local-only mode on one machine, with no account, subscription, wallet, Cardano node, token, CRC, IMMORTAL service, network connection or payment provider. The user may optionally configure remote services, but there must be no silent remote fallback.

The Core must not require a treasury, economic gate, token balance or financial provider before starting a task. A project with zero financial contributions may continue while its existing local or donated resources are available.

### 5.2 Project and mandate layer

Defines:
- project identity, objective and public/private scope;
- creator/team-led, agent-led or hybrid operation mode;
- human/organizational steward and accountability contact;
- standing agent mandate, capabilities, exclusions and delegation rules;
- roadmap proposal and approval/change policy;
- privacy, release and publication policy;
- which decisions are autonomous, reviewable or reserved to a steward;
- resource requests and escalation paths;
- durable versioning of mandate and project decisions.

An agent may autonomously propose changes, create tasks and operate within its authority. It may not enlarge its own authority, appoint itself as custodian of funds, rewrite its mandate, or treat a sponsor's payment as a capability grant.

### 5.3 Resource plane

Treat resources as typed, independent inputs to execution:

- local compute and storage;
- donated compute and remote worker capacity;
- model weights and inference endpoints;
- tool/API access and service quotas;
- datasets and content-addressed artifacts;
- human expertise and review capacity;
- financial budget available to the project through an external custodian/provider.

The Resource Manager decides whether a machine or service can safely execute a workload. It does not determine financial solvency. A budget manager or external financial authority does not decide CPU/GPU scheduling or grant host privileges.

The local Resource Broker is an adapter over owner-approved host controls, not a new Cormia sandbox. Windows Job Objects/AppContainer and Windows Sandbox, or Linux OCI/cgroups and optional gVisor/Kata/Firecracker tiers, are prior art to evaluate before writing host enforcement code. CPU/RAM/process control and GPU isolation/measurement are separate capabilities. See the [Cormia Prior-Art Composition Review](../research/CORMIA_PRIOR_ART_COMPOSITION_REVIEW_2026-11-03.md).

A resource offer is not automatically a task capability. The task policy must still authorize what an agent may do with the resource.

### 5.4 Community support layer — optional

Provides project pages and support intents such as:
- support a creator/team-led project;
- support an agent-led project or named agent workstream;
- fund a milestone/bounty;
- donate compute or infrastructure;
- contribute expertise, review or datasets;
- earmark a contribution for a resource category;
- view public reports, results, costs and evidence.

The support layer records what was offered, accepted, restricted, consumed or returned, within its declared trust model. It should be possible to disable it completely without affecting Cormia Core.

A project may optionally create a finite Project Compute Reward Pool for a campaign/workstream. Compute providers opt in with a bounded resource offer; only completed and verified useful work can qualify for a proportional share of a funded reward pool. This is not part of the current support schemas or CRC v1 and is not adopted until its allocation, custody and anti-abuse rules are defined. See [Compute Reciprocity, section 14](../economics/COMPUTE_RECIPROCITY.md).

A Patreon-like recurring pledge is one support option, not the governing model for all projects. Bounties and in-kind donations are first-class alternatives. The system must distinguish a pledge from settled money and distinguish a declared compute offer from actually available capacity.

### 5.5 Optional financial and settlement integrations

Financial custody, payments, refunds, contracts and settlement belong behind optional providers/adapters. Possible categories include conventional payment processors, grants/donation platforms, invoicing/banking systems, crypto wallets and chain adapters.

- Core interfaces describe a project funding/resource envelope, not a mandatory payment method.
- A provider handles its own authentication, settlement, custody, refunds, compliance and fees.
- A provider outage must not disable local agent execution or non-financial resource scheduling.
- An agent may request a pre-authorized external purchase or service allocation only under a separately configured spending/consent policy; it must not obtain an unrestricted wallet by default.
- Cardano is one optional settlement adapter, not the protocol's required substrate.
- IMMORTAL is one optional economic governance/admissibility integration when a deployment deliberately places economic obligations or shared protected capital under IMMORTAL rules. It is not the agent's general authority engine and is not required for project creation, task execution, patronage or in-kind support.

### 5.6 Team Collaboration Plane — the agents work as a team

A multi-agent project needs more than task dispatch and isolated worker sandboxes. Cormia needs a Team Room experience, but it should compose an existing conversation backend rather than invent a new chat protocol. Matrix or Zulip are candidates for persistent project discussion; A2A is the agent-to-agent interoperability boundary, while MCP covers agent-to-tool/resource access. Significant decisions are recorded as structured project decisions linked to tasks and artifacts; a chat message alone never grants authority or changes the mandate.

The Team Room experience is paired with a Project Workbench composed from existing primitives:
- shared project context and an artifact index;
- isolated Git worktrees for parallel contributions;
- local repository/version history, independent of any GitHub remote;
- patch exchange and a common integration worktree;
- explicit integration/merge operations; evaluate Yjs or another CRDT only if simultaneous same-document editing is a demonstrated requirement;
- accepted contributions, conflict resolution and attribution.

Agents can work independently, pair on the same component or contribute modules to a common project. The system prevents uncontrolled concurrent overwrites; "shared work" means shared visibility and integration, not unrestricted write access to every host file. Do not build a custom VCS, shared filesystem protocol or real-time editor before the first two-agent workflow demonstrates a gap. See the [prior-art composition review](../research/CORMIA_PRIOR_ART_COMPOSITION_REVIEW_2026-11-03.md).

### 5.7 Integration & Verification Bench and optional delivery

Contributions are composed in an internal integration workspace before any external publication. The team uses the selected existing CI runner, Flux Point DoD gates and JEV evidence vocabulary to compile/build, run declared tests, validate documents/data, conduct independent review, fix failures and rerun within its mandate and resource budget. Cormia binds the exact source revision, inputs, test profile, result and candidate digest; it does not create a parallel CI engine. The output is a digest-bound candidate with evidence and unresolved risks.

Each project declares a delivery profile:
- local action only (for example, organize/clean a PC);
- local files or reports;
- project artifacts/datasets;
- local software repository with local commits;
- optional GitHub publication;
- optional AEP/network publication.

A GitHub remote is not a prerequisite for team collaboration, local commits, integration or testing. By default, publishing a verified candidate to GitHub requires an owner authorization at the external boundary. A narrowly scoped standing publication mandate can opt into automatic push/PR. Protected merge, release and production deployment remain separate actions. A one-agent local task can bypass Team Room, Workbench, build/test and publication stages it does not need.

### 5.8 Work completion evidence and optional Materios certification

A project may require verifiable completion evidence for selected tasks or compute contributions. Completion is an evidence-bearing claim, not just a task status or agent self-report. The worker-local Cormia Node remains the resource authority: it enforces owner-controlled limits, isolates the workload and produces a task-bound meter/receipt. Resource donation does not give the project or its agents general access to the contributor's PC.

The Work Completion Receipt is a proposed Cormia claim model, not a decision to invent a new signed-evidence envelope. Before schema freeze, map the Cormia task/attempt/assignment/lease/verifier/acceptance binding to in-toto Statement/DSSE, SLSA provenance, Orynq agent traces/tool receipts and optional SCITT transparency receipts. OpenTelemetry may supply operational traces but is not a correctness proof. The integrity/availability, resource metering, execution-environment attestation, task-outcome acceptance, execution proof and chain finality dimensions remain separate.

Materios may act as an optional receipt/evidence certification adapter; it must not control local resources or project authority. Its current receipt path supports commitment integrity and availability attestation, which does not alone prove task execution or semantic correctness. The [Work Completion Evidence and Materios Certification proposal](./CORMIA_WORK_COMPLETION_EVIDENCE_AND_MATERIOS_CERTIFICATION_v0.1.md) records current implementation limits, while the [prior-art composition review](../research/CORMIA_PRIOR_ART_COMPOSITION_REVIEW_2026-11-03.md) defines the PA-04 comparison. No bespoke receipt schema is to be frozen until that comparison leaves a concrete Cormia-specific gap. R0–R4 remain Cormia proposal labels, not an adopted industry assurance standard. Local Core remains independent of Materios.

## 6. What supporters are actually supporting

A supporter can choose the object of support independently of the operator:

1. **The project:** general-purpose contribution to its published mission and resource pool.
2. **The creator/team:** support the maintainer's continued work, coordination or stewardship.
3. **An agent-led mission:** support a named autonomous workstream or its resource envelope, without paying the agent personally.
4. **A milestone/bounty:** contribute to a defined deliverable with acceptance criteria and evidence.
5. **Shared infrastructure:** contribute compute, storage, bandwidth, data or other capacity to a community pool.

Supporters may receive project updates, public progress reports, early access, community participation, or other explicitly declared benefits. None is automatic. A project must disclose whether a contribution is a donation, pledge, grant, bounty, prepayment or payment for a defined service; these concepts must not be blurred.

Contributing more money must not automatically produce more operational authority. A sponsor may have only the reporting/benefits declared by the project, unless a separate governance rule says otherwise.

## 7. Example end-to-end flows

### Flow A — zero-money local agent

1. A user installs Cormia on a personal computer.
2. The user configures a local model and a bounded Project Mandate.
3. Cormia plans and executes tasks using local tools and local compute.
4. It stores checkpoints and evidence locally.
5. No account, wallet, token, payment provider, Cardano or IMMORTAL is present.

This is the baseline product path, not a demo mode.

### Flow B — creator-led project with mixed support

1. A maintainer creates a public project and sets the roadmap.
2. Supporters make recurring contributions through an optional payment provider; other contributors donate GPU capacity and storage.
3. The project steward declares how money and donated resources may be used.
4. Cormia coordinates agents, assigns work and schedules available compute.
5. Reports separate money received/spent from donated compute capacity/usage.
6. Agents publish code, tests, release notes and evidence within the project mandate.

### Flow C — agent-led project with patronage

1. A steward establishes an agent-led project, appoints its accountability contact and grants a standing bounded mandate.
2. The lead agent proposes a roadmap and creates workstreams.
3. The community supports the project or specific workstreams with money, donated infrastructure, data or expertise.
4. Financial contributions flow to the project's designated custodian/provider account; they are not credited to an agent wallet.
5. The lead agent uses the available resources, delegates work to specialist agents and publishes verifiable progress.
6. The agent requests additional resources when local capacity is insufficient; the request follows the project's published policy.
7. Changes outside the mandate, legal commitments and financial custody remain subject to the declared steward/governance process.

### Flow D — funded milestone/bounty

1. A requester publishes a task and acceptance criteria.
2. A community or sponsor contributes to a project/task budget through an optional funding rail.
3. Cormia decomposes and executes the task using authorized workers and resources.
4. Evidence and independent checks determine whether the stated deliverable is complete.
5. The task is closed and any payout/refund is performed by the selected financial/settlement adapter under the task's declared contract.
6. This financial workflow is optional and must not be imported into ordinary Cormia Core tasks.

## 8. Non-goals and invariants

- No direct salary, token reward or wallet is required for an AI agent.
- No financial contribution is required for local task execution.
- No Cardano, wallet, token, CRC, IMMORTAL, payment provider or remote model is required by Core.
- Donated compute is an optional resource offer, not an economic liability or promise of perpetual availability.
- The model must not describe supporters' funds as compute capacity until the funds have actually been converted into available resources.
- A resource donation is not ownership or control over the recipient project's mandate.
- Patronage does not itself grant capabilities, tool access, data access or governance rights.
- A bounty/escrow workflow applies only to tasks explicitly declared as funded economic contracts.
- Financial accounting, resource scheduling, project authority and evidence verification remain separate.
- Agents may operate autonomously within a mandate but cannot enlarge their own mandate or assume custody of community funds.
- The Core must continue functioning when every optional support/payment/chain/economic adapter is disconnected.

## 9. Relationship to AEP, Compute Reciprocity and IMMORTAL

### AEP

The existing AEP draft describes a permissionless task-contract and settlement protocol. It can serve as an optional advanced execution/commerce profile for tasks that genuinely need funded contracts, escrow, bonds, challenges and settlement. It must not define the minimum requirements for all general-purpose Cormia agents or local projects.

A Cormia Core task may be local, private, unfunded and outside AEP settlement. A task enters the AEP economic path only when the project explicitly chooses a funded contract profile.

### Compute Reciprocity (CRC)

Compute Reciprocity is an optional mechanism for shared inference/service quotas. Local-only inference must remain possible at zero CRC. The Core should schedule available capacity even without CRC. Do not treat CRC as a base token, universal project currency, financial contribution, salary or mandatory account balance.

The proposed Project Compute Reward Pool is a separate, project-specific incentive model: it can distribute a funded bucket among contributors pro-rata to accepted useful work. It is not already implemented by CRC or by the sponsored-capacity pool, and it must not turn CRC into cash or a transferable asset. Allocation/verification/funding rules remain open.

### IMMORTAL

IMMORTAL can govern an explicitly integrated economic perimeter, protected capital, obligations, exposure and settlement admissibility. It does not decide whether an agent may read a project file, run a test, delegate a task or use a donated GPU unless that action separately creates an obligation/resources within a declared IMMORTAL-governed economic perimeter.

No universal Cormia agent operation should be routed through IMMORTAL merely because the project accepts patronage or community compute.

## 10. Implementation sequencing

The following is the **current implementation order**, not a replacement or reduction of this document's full architecture or final product goals. All architecture layers and objectives described in this document remain in scope for the final Cormia system. The immediate operational priority is local autonomous project execution; community support, finance, remote compute, team collaboration, AEP/economic, Cardano, CRC and Materios layers remain in the architecture and are sequenced according to their dependencies. The detailed priority plan is [CORMIA Multi-Project Autonomous Runtime v0.1](./CORMIA_MULTI_PROJECT_AUTONOMOUS_RUNTIME_v0.1.md).

1. **Project Runtime composition:** register multiple projects through host-resolved descriptors and bind a separate resolver, mandate, host policy, task authority, broker, workspace and adapter set to each project. The model must not select or switch project identity.
2. **Durable task engine and Supervisor:** implement project-scoped queues, task graph, attempts, checkpoints, evidence and crash recovery, with one global scheduler and per-project concurrency/resource ceilings.
3. **Task-scoped workspace/worktree adapters:** enable bounded writes, patches, tests and Git operations only inside isolated task worktrees; preserve the existing Agent approval boundaries and self-improvement review/promotion limits.
4. **Autonomous execution loop:** connect ModelProvider, strict inert plan proposal, PLAN validation, Core Capability Broker, Resource Lease, host adapter, verifier/evidence and durable task transition.
5. **IMMORTAL first integration:** operate on the selected working branch and preserve its central coordination checkpoint, assigned workstreams and normative protocol boundaries.
6. **Second-project proof:** run a separate project under the same Supervisor and prove context, authority, workspace and resource isolation while both projects make progress.
7. **Local service lifecycle:** add explicit host start/stop/status, startup recovery, safe shutdown and operator-visible queue/lease/evidence state.
8. **Prior-art composition and team collaboration:** complete the bounded PA-01…PA-06 comparisons and compose A2A/MCP, Git worktrees and existing CI/DoD/JEV. Add Matrix/Zulip or a CRDT editor only if a measured workflow requires them.
9. **Optional project support registry:** model support targets, contributions, restrictions, custodian, benefits and reporting. Do not assume payment settlement.
10. **Optional financial, in-kind mesh and AEP/economic integrations:** add only after local Runtime authority, task isolation, resource enforcement and recovery are demonstrated.
11. **Conformance:** prove local Core works without optional adapters, provider failure causes no remote fallback, unrelated projects continue safely when one is blocked, sponsors cannot increase authority, and financial/resource records remain separate.

## 10A. Current operational priority — multi-project autonomy (2026-11-08)

The principal Cormia outcome is one local Supervisor that can autonomously advance IMMORTAL and other independent projects at the same time, under separate project mandates and resource budgets. A dedicated implementation plan is maintained in [CORMIA_MULTI_PROJECT_AUTONOMOUS_RUNTIME_v0.1.md](./CORMIA_MULTI_PROJECT_AUTONOMOUS_RUNTIME_v0.1.md).

The first Project Runtime profile is IMMORTAL Protocol on the observed working branch `work/immortal-green-closure`. Other projects are registered independently; they do not inherit IMMORTAL's mandate, task queue, repository or workspace. The model cannot select a project by returning different text.

“Simultaneous” means independently scheduled progress subject to global/per-project concurrency and actual CPU/GPU/inference capacity. A shared local Granite server is an inference service, not a shared project session or authority source. Resource shortage queues work rather than oversubscribing or silently switching providers.

Current verified boundary:
- Real local Granite inference through the Cormia ModelProvider passed the operator smoke test; no remote fallback or model tool dispatch was used.
- The Core Plan–Execute/Capability Broker, host Project Runtime Registry, per-project durable Task Store and local Project Supervisor exist as tested slices. The Supervisor provides a local single-instance lock, round-robin scheduling, global/per-project concurrency caps and conservative recovery; it is not a Windows daemon.
- The local Model Task Planner now accepts strict JSON proposals from a host-pinned local provider and the model-backed executor composition runs through the Registry/Broker and requires an independent evidence verifier. Production Task Manifest/context providers and the evidence verifier are not yet wired.
- The first CodingWorkspace operation mapping exposes only list/read/diff/verify with exact host allowlists and `relativePath` binding. Write/replace/patch/test/build, shell and Git writes remain unavailable; existing Agent approval gates are not bypassed.
- CI on the current planner commit passed 149 Core Node tests and 7 read-only operation-adapter tests (0 failures in both suites).
- The current IMMORTAL Task Store v1 integration remains a read-only inspector; it is not read or written by the new Cormia Task Store, and Cormia does not launch or resume the existing Agent.
- Task-scoped workspace/worktree adapters, production signed Task Manifest/routing and mandate/consent/revocation providers, real Windows ResourceManager composition, independent evidence persistence, Windows service integration and the second-project end-to-end proof remain outstanding.

This priority does not authorize automatic changes to IMMORTAL protocol rules. The project's central checkpoint, task assignments, current branch and protected-operation boundaries remain authoritative. Ordinary in-scope edits may become unattended under a valid standing mandate; protected merges, releases, deployments, wallet/ledger actions, trust-anchor changes and mandate widening remain separate gates.

Community support, CRC, Cardano settlement, remote peer mesh, payment custody, team collaboration and the optional integrations described in this architecture remain part of the final product direction. They are later in the current implementation sequence, not removed or cancelled. Their existing architectural definitions and open decisions remain valid.

## 11. Open decisions — keep separate from Core

- Whether project patronage supports public-only, private or mixed projects.
- Whether agent-led projects require one named human/organizational steward or can use a community stewardship body.
- Which benefits (updates, early access, governance input, services) a project may offer to supporters.
- How financial custodians/providers and refunds are selected.
- Whether project budgets can authorize bounded automatic purchases, and what spending caps/approval rules apply.
- How donated compute capacity is measured, leased, preempted, rewarded or reciprocated.
- Whether a project uses a finite compute-reward bucket and which contribution/verification rule distributes it.
- How project-team discussion, structured decisions, pair editing, integration and independent test gates are represented.
- Whether a support layer includes recurring pledges, milestone bounties, or both in its first release.
- Whether CRC is enabled as an optional access/quota mechanism; no token is assumed.
- Which external payment, storage, compute and chain adapters are supported first.

These decisions must not block the Core architecture or its local-first general-purpose operation.


## 12. Core contracts and implementation boundary

The four versioned conceptual contracts — Project Mandate, Autonomous Project Lifecycle, Resource Provider and Community Support — are defined in [CORMIA_CORE_CONTRACTS_v0.1.md](./CORMIA_CORE_CONTRACTS_v0.1.md). They refine this architecture's Core-first sequence without changing the AEP SPEC or schemas. ADR-0010 remains the source for one-time project delegation and task-child authority; its existing v0.1 mandate is coding-worktree-specific, not a universal mandate schema. Local Resource Manager compatibility is not yet a remote resource-provider mesh. Financial patronage and in-kind support remain separate records and neither grants operational authority.

The bounded abstract contract model is under [verification/core_contracts](../../verification/core_contracts). Its tests do not establish Runtime implementation or end-to-end conformance.


## Versioned Core interface slice (2026-11-03)

The four Core contracts now have an initial versioned record-schema proposal catalogued in [CORMIA_CORE_INTERFACE_CATALOG_v0.1.md](./CORMIA_CORE_INTERFACE_CATALOG_v0.1.md). It covers project identity and mandate reference, separate project lifecycle projection/event records, resource offers/leases, and separate financial/in-kind support records.

The mandatory project, lifecycle and resource records do not contain payment, Cardano, wallet, token, CRC, AEP or IMMORTAL requirements. The mandate reference points to the existing signed claims rather than creating a second authority system. JSON Schema conformance is tested in GitHub Actions. An isolated local append-only Project Lifecycle journal and deterministic reducer now exist under `runtime/core/`; this is not an integrated Core Runtime and does not authenticate mandates or stewards, manage tasks or enforce OS resources.


## Local Project Lifecycle journal slice (2026-11-03)

The initial local event journal and deterministic Project Lifecycle reducer are documented in [runtime/core/README.md](../../runtime/core/README.md). This is a separate Core component; the existing Local Agent Task Store v1 remains a read-only compatibility inspector and is not modified or adopted as the project journal.

The hosted [GitHub Actions run #77](https://github.com/LiberoNuvola/Cormia/actions/runs/41585273487) passed 15 Node tests for append/reopen/replay, digest chaining, idempotent retry, revision conflicts, transition rejection, explicit torn-tail repair, complete-record corruption handling and stale-lock fail-closed behavior. This does not prove end-to-end Runtime integration, power-loss recovery on the user's host, mandate/identity authentication, task checkpoint recovery, durable resource leases or OS-level quotas.


## Trusted Project Context Resolver slice — 2026-11-03

An isolated host-port orchestration contract now lives in `runtime/core/trusted-project-context-resolver.mjs`. It binds the project descriptor to a host-resolved steward/accountability arrangement, existing ADR-0010 mandate claims, the one-time project consent receipt, a mandate-specific revocation/anchor decision and the Project Lifecycle journal. It reuses the existing mandate validator and child-authority evaluator rather than creating a second approval or grant system.

For an active project, the Runtime can create a task session from a host-verified task. Every operation re-resolves trust state and current host policy before reusing the existing operation evaluator. These are automatic machine checks, not per-operation human prompts.

This is not yet a production resolver. The repository still lacks real host key/bootstrap and mandate-signature providers, OS-authenticated operator/consent broker, trusted steward/accountability registry, mandate-specific persistent revocation/monotonic-anchor provider, project descriptor registry and host-policy store. The tests use synthetic in-memory provider doubles; missing or unhealthy provider results fail closed. The resolver does not integrate with Agent/Granite or start the autonomous project loop.

Verification: [run #105](https://github.com/LiberoNuvola/Cormia/actions/runs/41586377831) passed 110 tests (41 Python Core/schema + 31 EXP + 38 Node journal/reducer/resolver); [grant/authority regression run #37](https://github.com/LiberoNuvola/Cormia/actions/runs/41586377749) passed 65 existing crypto/authority/revocation-model tests.
