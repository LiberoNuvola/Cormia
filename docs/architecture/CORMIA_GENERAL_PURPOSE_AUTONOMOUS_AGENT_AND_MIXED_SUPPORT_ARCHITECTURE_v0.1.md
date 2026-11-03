# Cormia General-Purpose Autonomous Agent & Mixed Community-Support Architecture v0.1

- **Date:** 2026-11-03
- **Status:** Architecture proposal / non-normative / not implemented
- **Scope:** Cormia Core, project modes, community support, optional resource and economic integrations
- **Baseline:** Cormia `main` AEP/Runtime inventory reviewed 2026-11-03
- **Purpose:** define one Cormia architecture that supports both creator-led and agent-led projects, while keeping autonomous execution independent of money, Cardano, wallets, tokens and IMMORTAL.

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

A Patreon-like recurring pledge is one support option, not the governing model for all projects. Bounties and in-kind donations are first-class alternatives. The system must distinguish a pledge from settled money and distinguish a declared compute offer from actually available capacity.

### 5.5 Optional financial and settlement integrations

Financial custody, payments, refunds, contracts and settlement belong behind optional providers/adapters. Possible categories include conventional payment processors, grants/donation platforms, invoicing/banking systems, crypto wallets and chain adapters.

- Core interfaces describe a project funding/resource envelope, not a mandatory payment method.
- A provider handles its own authentication, settlement, custody, refunds, compliance and fees.
- A provider outage must not disable local agent execution or non-financial resource scheduling.
- An agent may request a pre-authorized external purchase or service allocation only under a separately configured spending/consent policy; it must not obtain an unrestricted wallet by default.
- Cardano is one optional settlement adapter, not the protocol's required substrate.
- IMMORTAL is one optional economic governance/admissibility integration when a deployment deliberately places economic obligations or shared protected capital under IMMORTAL rules. It is not the agent's general authority engine and is not required for project creation, task execution, patronage or in-kind support.

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

### IMMORTAL

IMMORTAL can govern an explicitly integrated economic perimeter, protected capital, obligations, exposure and settlement admissibility. It does not decide whether an agent may read a project file, run a test, delegate a task or use a donated GPU unless that action separately creates an obligation/resources within a declared IMMORTAL-governed economic perimeter.

No universal Cormia agent operation should be routed through IMMORTAL merely because the project accepts patronage or community compute.

## 10. Implementation sequencing

1. **Core-first contract:** define the standalone Cormia Core interfaces for project, mandate, agent, task, capability, resource offer, evidence and journal. Keep money/chain fields out of mandatory Core types.
2. **Two leadership modes:** define creator/team-led, agent-led and hybrid configurations against the same mandate and stewardship interfaces.
3. **Resource abstraction:** unify local resources, donated resources, model providers and service quotas behind typed Resource Provider interfaces; scheduling and safety stay in Cormia.
4. **Project support registry:** model support target, contribution type, restrictions, status, custodian, benefits and reporting. Do not assume payment settlement.
5. **Optional financial adapter:** connect one provider only after support semantics, custody, refunds and spending policy are explicit.
6. **Optional in-kind mesh:** add opt-in resource discovery, offers, leases, preemption, privacy and reliability evidence.
7. **Optional AEP/IMMORTAL/Cardano profiles:** connect only the task classes and economic perimeters that require them.
8. **Conformance:** test that Core runs without all optional adapters, that adapter failure does not halt local work, that sponsors cannot increase agent authority, that funds never enter agent wallets by default, and that financial/resource ledgers remain separate.

## 11. Open decisions — keep separate from Core

- Whether project patronage supports public-only, private or mixed projects.
- Whether agent-led projects require one named human/organizational steward or can use a community stewardship body.
- Which benefits (updates, early access, governance input, services) a project may offer to supporters.
- How financial custodians/providers and refunds are selected.
- Whether project budgets can authorize bounded automatic purchases, and what spending caps/approval rules apply.
- How donated compute capacity is measured, leased, preempted, rewarded or reciprocated.
- Whether a support layer includes recurring pledges, milestone bounties, or both in its first release.
- Whether CRC is enabled as an optional access/quota mechanism; no token is assumed.
- Which external payment, storage, compute and chain adapters are supported first.

These decisions must not block the Core architecture or its local-first general-purpose operation.


## 12. Core contracts and implementation boundary

The four versioned conceptual contracts — Project Mandate, Autonomous Project Lifecycle, Resource Provider and Community Support — are defined in [CORMIA_CORE_CONTRACTS_v0.1.md](./CORMIA_CORE_CONTRACTS_v0.1.md). They refine this architecture's Core-first sequence without changing the AEP SPEC or schemas. ADR-0010 remains the source for one-time project delegation and task-child authority; its existing v0.1 mandate is coding-worktree-specific, not a universal mandate schema. Local Resource Manager compatibility is not yet a remote resource-provider mesh. Financial patronage and in-kind support remain separate records and neither grants operational authority.

The bounded abstract contract model is under [verification/core_contracts](../../verification/core_contracts). Its tests do not establish Runtime implementation or end-to-end conformance.
