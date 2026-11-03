# Cormia Core Contracts v0.1 — Mandate, Project Lifecycle, Resources & Community Support

- **Date:** 2026-11-03
- **Status:** Architecture contract proposal / non-normative / not implemented as a unified Core
- **Scope:** General-purpose Cormia Core; creator/team-led, agent-led and hybrid projects
- **Related design:** [General-Purpose Autonomous Agent & Mixed Community-Support Architecture v0.1](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- **Existing authority proposal:** [ADR-0010 — Autonomous project delegation and Runtime-managed authority](../adr/0010-autonomous-project-delegation-and-runtime-authority.md)
- **Purpose:** define the four minimal contracts that let one Cormia Core autonomously operate projects without making finance, Cardano, wallets, tokens, CRC, AEP settlement or IMMORTAL mandatory.

## 1. Core contract

Cormia Core is a general-purpose autonomous project-execution system. It must be useful in local-only mode. An agent needs a valid bounded mandate, an execution environment and available resources; it does not need wages, a personal wallet, a token balance, a payment account or economic authority.

The four contracts are independent:

1. **Project Mandate Contract** — defines who is responsible for the project and what authority the Runtime may exercise.
2. **Autonomous Project Lifecycle Contract** — defines durable project operation and recovery without confusing project status with authority or task status.
3. **Resource Provider Contract** — describes resources, their availability and leases without turning resource scheduling into financial accounting.
4. **Community Support Contract** — records financial and in-kind contributions to projects/workstreams while keeping custody, authority and execution separate.

One Core implements and composes these contracts. Creator/team-led, agent-led and hybrid are project configurations, not different agent products.

### 1.1 Non-negotiable independence invariant

The Core execution path must not import, require or assume availability of any of the following:

- Cardano node, transaction, wallet or wallet signature;
- cryptocurrency token, CRC balance, chain identity or on-chain account;
- payment provider, bank account, subscription, patronage or grant rail;
- AEP escrow, bond, funded-task settlement or economic gate;
- IMMORTAL kernel, EEV, ProtectedCapital, economic admission or C-COMP certificate.

Any of these may be connected through an optional adapter. Disabling or losing an optional adapter must not disable local project planning, local task execution, local inference, local resource scheduling, evidence collection or recovery.

The Core may report that a requested external/paid service is unavailable. It must not silently replace a local model with a remote provider or create an undisclosed bill.

## 2. Source alignment and reuse boundaries

### 2.1 Reuse ADR-0010; do not create a second mandate authority

Cormia main already contains:
- ADR-0010's target of one standing project mandate, automatic in-scope task acceptance, Runtime-derived attenuated child authority, zero approval prompts per normal edit/test, and escalation only for mandate expansion or protected actions;
- draft local-autonomous-project-mandate-claims-v0.1 and local-project-mandate-consent-claims-v0.1 schemas;
- an isolated policy evaluator with 17 contract tests;
- ADR-0008's local grant verification proposal and ADR-0009's host authority, one-time consent and rollback-aware revocation proposal.

These are the source of the proposed Project Mandate security semantics. Do not create a second signer, operator approval, revocation journal or child-grant implementation for general Cormia projects.

**Generalization gap:** the current mandate v0.1 schema is specifically shaped around a local software project/worktree: Git branch rules, filesystem exclusions, HTTPS host allowlist, CPU-heavy time, memory, named build/test profiles and coding operations. It is not yet a universal schema for every project type, tool family, remote agent, physical resource or multi-party community project. This document does not alter that schema. A later version must generalize through typed capability/resource profiles while preserving the v0.1 local coding profile as a compatible specialization.

### 2.2 Keep three policy/authority planes distinct

- **Project Mandate:** grants bounded operational authority to a Runtime/agent for one project.
- **Task child authority:** is derived by trusted Runtime code as an attenuation of the active mandate, task request and host policy. It is not a human approval per operation and is not exposed as a bearer token to the model.
- **Project Normative Contract (PNC), where adopted:** pins which normative sources, closed decisions, invariants and evidence rules govern a project. It does not grant operational capabilities. The PNC proposal remains in separate draft PR #1 and is not assumed active on main.

No model, supporter, task requester or resource provider may create or widen these authorities by declaring itself trusted.

### 2.3 Reuse the resource work; do not claim it is a complete provider mesh

The current Resource Manager adapter wraps existing snapshot(), acquire() and release() behavior with a fixed trusted operation map and finally-based release. It is explicitly not connected to the Agent execution loop, does not provide OS-level quotas, durable leases, remote worker scheduling or a peer resource protocol.

The Resource Provider Contract below generalizes the interface, not the implementation status.

### 2.4 Keep existing task stores and task contracts separate

The existing Local Agent Task Store v1 is a local persistence format with pending/running/paused/failed/completed. It is not a Project Lifecycle state machine, not the AEP lifecycle, and not an authority object. Do not map these status vocabularies onto one another.

A project can be active while some tasks are pending, blocked or completed. A mandate can be revoked while the project record remains available for audit. These lifecycles must remain independently represented.

## 3. Contract 1 — Project Mandate

### 3.1 Purpose

A Project Mandate is the durable, bounded authorization envelope for an agent or team of agents to operate a project. It answers:

- Who is the accountable project steward?
- Which project, workspaces and data are in scope?
- Which agent/runtime subjects may act?
- Which operation families are allowed?
- What resource, retry, time, network and privacy constraints apply?
- Which actions are explicitly reserved to a separate authority?
- How are expiry, suspension, revocation and trust failure handled?

For routine operations within an active mandate, the Runtime decides automatically. A human is not asked to approve each file edit, task step, tool call or test.

### 3.2 Leadership modes

The project descriptor includes one of:
- creator_team_led: a human, organization or community stewards the project direction;
- agent_led: an agent proposes and manages day-to-day work under a standing mandate;
- hybrid: a steward sets strategic boundaries while the agent autonomously manages in-scope operations.

The leadership mode does not alter the security rule: all modes require an established steward/accountability arrangement and an active mandate before the Runtime executes privileged project operations. Agent-led means autonomous operation within delegated scope, not self-authorization or assumed legal/financial personhood.

A project record should identify an accountable steward reference and, where applicable, a community governance body. Whether a community body can replace a single named natural/legal-person steward is an open governance decision; it is not silently resolved here.

### 3.3 Mandate invariants

1. **Single source:** one active mandate authority is authoritative for the given project/workspace; no parallel approval path may broaden it.
2. **Bound subject:** the mandate binds project, workspace, Runtime and agent/worker subject identities.
3. **Upper bound:** effective child authority is the intersection of mandate authority, task-requested capabilities and host policy; it can never exceed any of them.
4. **No per-operation prompt:** in-scope operations are machine-authorized from the already verified mandate and child authority.
5. **Protected actions:** protected branch merge, release, production deploy, secret access, trust-anchor change, mandate widening, wallet signing, fund transfer and chain settlement require separate authority, if enabled at all.
6. **No credential in model context:** signing keys, API tokens, wallet keys, bearer credentials and provider secrets stay in the trusted host/credential broker.
7. **No supporter authority:** a financial contribution, resource donation, bounty or high contribution tier does not enlarge capabilities, grant private-data access or modify mandate policy.
8. **Fail closed:** expired/revoked/suspended mandate, invalid consent, trust/anchor failure or unresolved authority state blocks new privileged work.
9. **Safe continuation:** a blocked task should not automatically stop unrelated in-scope tasks unless the failure is global to trust, integrity or the project mandate.
10. **Explicit widening:** changes that widen project scope, operation set, workspace, network policy, resource/retry budget, expiry or protected-action set require a new authorized mandate/consent event.

### 3.4 Generalized conceptual interface

This is a conceptual interface, not a replacement JSON schema:

~~~text
ProjectDescriptor {
  projectRef
  leadershipMode: creator_team_led | agent_led | hybrid
  stewardRef
  accountabilityRef
  missionRef
  visibilityPolicyRef
}

ProjectMandateRef {
  mandateId
  projectRef
  subjectRefs[]
  workspaceRefs[]
  allowedOperationProfiles[]
  capabilityProfileRefs[]
  resourceBudgetProfileRef
  networkPolicyRef
  protectedActionPolicyRef
  consentDigest
  issuedAt
  expiresAt
  authorityState
}

AuthorityState =
  active | suspended | expired | revoked | trust_failed

ChildAuthority =
  intersect(mandateCapabilities, taskRequestedCapabilities, hostPolicy)
~~~

The current v0.1 local-project mandate schema may back the coding-workspace profile. Do not append leadershipMode, generic service permissions or payment fields to it without a separate schema decision and compatibility review.

## 4. Contract 2 — Autonomous Project Lifecycle

### 4.1 Separate the project from its tasks and its authority

Three state machines are orthogonal:

- **Project lifecycle:** whether the project is being prepared, operated, paused or closed.
- **Mandate/authority lifecycle:** whether the Runtime is allowed to act.
- **Task lifecycle:** whether a particular unit of work is ready, running, blocked or completed.

A project can be active while a specific task is blocked; an authority can be suspended while the project remains readable; a project can be paused while its mandate remains valid. No state in one machine should implicitly promote another.

### 4.2 Proposed project lifecycle

| State | Meaning | Permitted behavior |
| --- | --- | --- |
| draft | Mission, steward and initial configuration are being prepared | Read/edit project metadata; no autonomous privileged execution |
| configured | Initial mandate and required local profiles have been validated | Prepare plans and check available resources |
| active | Project is operating | Autonomous in-scope planning, task creation, delegation, execution, verification and reporting |
| paused | Steward or project policy has paused work | Preserve state/evidence; no new work starts |
| blocked | A required trust, resource, policy or external dependency is unavailable | Record exact blocker; continue independent work only where policy permits |
| completed | Project objective or declared lifecycle has ended | Preserve final artifacts, evidence and report |
| archived | Read-only retention state | Read/audit/export subject to retention policy; no new execution |

### 4.3 Lifecycle invariants

- A project enters active only after its project descriptor, steward/accountability arrangement, mandate and required execution profiles are valid.
- An agent may create and prioritize in-scope work items autonomously; it cannot reactivate a paused project or reverse a revocation without the relevant authority.
- Each task has durable identity, dependencies, attempts, checkpoints, evidence references and a terminal/outstanding status appropriate to that task system.
- Model conversation history is not the authoritative journal. The project/task journal and host records must support restart and reconstruction.
- After a crash, incomplete work is reconciled against durable state and resource leases; it is never blindly re-executed when duplicate side effects are possible.
- A task blocked by unavailable optional remote infrastructure may be queued or reassigned; local tasks must remain executable if their local requirements are available.
- Completion and archival never erase the mandate, decision or evidence history needed for audit and recovery.
- Changing creator/team-led to agent-led or hybrid is a project governance event; it does not silently enlarge the mandate.

### 4.4 Autonomous operating loop

The Core's continuous loop is:

1. Load the project record, active mandate, policy versions and durable journal.
2. Reconcile trust, revocation, workspace and resource state.
3. Read the project goal/roadmap and choose the next in-scope objective.
4. Decompose it into tasks and dependencies.
5. Derive attenuated child authority for each task.
6. Select suitable local or explicitly opted-in remote resources.
7. Execute, observe, verify, diagnose and repair within the mandate and resource limits.
8. Persist checkpoints, artifacts, evidence, decisions and resource lease outcomes.
9. Continue other independent work where permitted.
10. Report completed work, blockers, uncertainties and proposed mandate/roadmap changes.

The agent may propose new objectives, project improvements and resource requests. It cannot approve its own mandate changes, create funds, accept financial custody or turn a proposal into an authorized action.

## 5. Contract 3 — Resource Provider

### 5.1 Resource is not money and not authority

A Resource Provider exposes usable capacity or a service. Examples include:

- local CPU, GPU, RAM, storage and network;
- a user-opted-in remote compute worker;
- a model/inference endpoint;
- a build/test sandbox;
- remote storage, content mirror or dataset service;
- human review/expertise availability;
- a hosted API/service quota.

A resource record describes capability and constraints. It does not itself grant the task permission to use the resource: effective tool/task authority still comes from the Project Mandate and host policy.

### 5.2 Provider interface

Conceptual, not an approved implementation API:

~~~text
ResourceOffer {
  offerId
  providerRef
  resourceType
  capabilityProfileRef
  capacityDescription
  availabilityWindow
  privacyAndDataHandlingProfile
  networkAndLocationConstraints
  revocationPolicy
  evidenceReferences[]
}

ResourceLease {
  leaseId
  offerId
  consumerTaskRef
  acceptedCapabilityProfile
  reservedCapacity
  leaseState
  startedAt
  expiresAt
}

ResourceProvider:
  discover(filter) -> offers
  inspect(offerId) -> offer + evidence
  accept(offerId, taskRef, requestedProfile) -> lease | deny
  renew(leaseId) -> lease | deny
  release(leaseId) -> releaseReceipt
  revoke(offerId | leaseId, reason) -> revocationEvent
~~~

A provider may implement only a subset; unsupported operations are reported explicitly. A local provider does not need a network registry.

### 5.3 Offer and lease lifecycle

Proposed offer states:

offered → inspected → accepted → available → exhausted/revoked/expired

Proposed lease states:

requested → reserved → active → released/revoked/expired/failed

A mere offer is not available capacity. The scheduler may reserve capacity only after the offer has been inspected, accepted by the provider and checked against task requirements and host policy. A remote provider can reject or revoke an offer; the Core must preserve the task journal and release/reconcile the lease.

### 5.4 Resource invariants

1. Local resources are sufficient for the standalone local execution path; they do not require a mesh identity, CRC balance or payment.
2. The Resource Manager/host policy is authoritative for local capacity, preemption, thermal/power/privacy and concurrency constraints.
3. Resource admission is not economic solvency or financial-budget admission.
4. A remote/donated resource offer is opt-in, scoped, time-bounded, auditable and revocable by its owner.
5. No requester can use a donated host's arbitrary shell, filesystem, wallet, credentials or unrestricted network through a compute offer.
6. A task's mandate/capability scope remains a ceiling when a provider offers broader capabilities.
7. Resource usage and financial expenditure are recorded separately; compute time is not silently converted into a cash amount, token or CRC.
8. Revocation prevents new leases immediately and ends existing work at a safe boundary according to the lease/host policy.
9. Failure of a remote provider must not silently trigger a different remote model or a paid API. Use another explicitly accepted provider, queue, report a blocker or run locally if suitable.
10. Capacity measurements are evidence with declared trust/assurance; provider self-reports are not automatically authoritative truth.

### 5.5 Existing implementation mapping

The existing Resource Manager wrapper's trusted fixed-operation map and finally release behavior are useful local adapter foundations. Its process-local counters are not OS-level resource enforcement, durable leases or a remote provider registry. The first interface implementation should wrap existing local behavior without rewriting the manager; remote provider discovery, consent and leases are later optional adapters.

## 6. Contract 4 — Community Support

### 6.1 Support target and contribution types

Community Support is an optional project-facing registry, not the Core's payment engine or agent authority service.

A contribution targets one of:
- a project;
- a workstream;
- a milestone/bounty;
- a shared infrastructure/resource pool.

Contribution kinds are separate:

**Financial patronage**
- recurring pledge, one-time donation, grant, sponsorship or a funded milestone;
- held/processed by a named human/organizational custodian or an external financial provider;
- reflected in Cormia as a provider-referenced contribution record, not an agent wallet balance.

**In-kind patronage**
- compute/GPU/RAM, storage, bandwidth, model serving, hosting or hardware;
- datasets, documentation, expertise, review and volunteer work;
- described as an offer and accepted contribution with scope, constraints and evidence.

A project may combine both. The financial ledger and resource/contribution ledger remain distinct. Do not infer a monetary value for volunteer expertise or donated capacity unless a separately disclosed accounting policy explicitly does so.

### 6.2 Support record

Conceptual, not an approved financial schema:

~~~text
SupportContribution {
  contributionId
  targetRef: project | workstream | milestone | resource_pool
  contributionKind: financial | compute | infrastructure | data | expertise | review
  contributorRef
  beneficiaryRef: project | named_custodian | resource_pool
  restrictions[]
  providerOrOfferRef
  declaredBenefits[]
  status
  evidenceReferences[]
}
~~~

For a financial contribution, payment provider/custodian records remain authoritative for pledge, settlement, refund, reversal and custody. Cormia must distinguish at least a declared pledge from a provider-confirmed received/settled contribution. A displayed pledge is not available project cash.

For in-kind contributions, the Resource Provider Contract is authoritative for whether offered capacity was validated, accepted, available, leased, used or revoked. A compute offer is not available capacity until accepted and admitted.

### 6.3 Support invariants

1. Support is voluntary and optional. A project with no patronage or donated resources can still operate on local resources.
2. Financial contributions accrue to the project or its named custodian, never to an AI agent as a personal financial account by default.
3. The Core does not custody, transfer, refund or settle money. A configured external provider/custodian handles those operations and supplies references/status.
4. Pledge, receipt/settlement, allocation, expenditure and refund are distinct facts; Cormia must not report one as another.
5. In-kind resources are not financial contributions and do not become cash by measurement or inference.
6. A supporter payment or contribution tier grants no tool capability, host permission, private-data access, project mandate, or automatic governance vote.
7. Any supporter benefits (updates, early access, service entitlement, governance participation) are explicit project policy and separate from agent operational authority.
8. Sponsor restrictions can constrain a contribution's use, but they cannot make the agent exceed the Project Mandate or host policy.
9. A project may decline a contribution that carries incompatible conditions, unsafe resource access or a mandate conflict.
10. Public support reports disclose the type, target, restriction, state and available evidence while respecting contributor privacy.
11. The system must not promise recurring outputs or guaranteed compute beyond accepted and available resources.
12. No universal Cormia currency is implied. CRC, if enabled, is an optional access/quota mechanism and not a base identity, wage, financial balance or prerequisite.

## 7. Composition: how the four contracts interact

The Core composes the contracts in this order:

1. Project descriptor identifies leadership mode, mission and accountable steward.
2. Mandate authority validates whether the Runtime/agent may operate in the project.
3. Project lifecycle determines whether new work may start.
4. Task planner proposes work; trusted Runtime derives attenuated child authority.
5. Resource Provider offers are inspected and accepted only if both task authority and resource/host policy permit.
6. Community Support may fund a project or add resources, but does not bypass steps 2–5.
7. Execution produces durable journal entries, artifacts and evidence.
8. Optional adapters can report support/payment/resource events; they cannot rewrite Core authority or task outcomes by themselves.

### 7.1 Independence test

For the same valid local Project Mandate, task and local resources, execution must succeed regardless of whether these optional integrations are:
- absent;
- configured but unavailable;
- disconnected during runtime;
- configured but unused.

An explicitly selected remote model/service is different: it requires explicit opt-in, the corresponding resource lease/provider availability and the relevant privacy/network policy. There is no silent fallback.

### 7.2 Authority and data-flow separation

- The model may propose a roadmap, task, resource requirement or support need.
- The deterministic Runtime validates mandates, capabilities, leases and lifecycle transitions.
- The Resource Manager admits/denies resource usage.
- A payment/custody provider reports financial events.
- The Support Registry records contribution references and declared restrictions.
- A verifier/evidence subsystem evaluates task outputs under the selected assurance policy.
- IMMORTAL, if enabled, governs only the explicitly declared economic perimeter; it is not the general agent authority engine.

No model, supporter, sponsor, resource provider or payment adapter can promote its own output into a capability grant or a valid mandate.

## 8. Conformance matrix

| Test | Expected result |
| --- | --- |
| Local Core with no payment, wallet, chain, token, CRC or IMMORTAL adapter | Executes an in-scope local task |
| Same task with optional adapter endpoints configured but offline | Same local result; no dependency failure |
| Local model unavailable and no explicit remote opt-in | Block/queue; no remote fallback |
| Sponsor contributes money or compute | Support record changes; authority does not |
| Agent-led project | Executes only under a steward-backed active mandate |
| Agent creates an in-scope subtask | Runtime derives attenuated child authority automatically |
| Task requests operation outside mandate/host policy | Denied, independent of sponsor/support status |
| Compute is offered but not accepted/available | No lease; task does not assume capacity |
| Donated compute is revoked | Stop new leases and reconcile current work at safe boundary |
| Pledge exists but provider has not confirmed receipt/settlement | Not reported as available settled funds |
| Financial and in-kind contributions coexist | Separate records/ledgers; no implicit conversion |
| Payment/Cardano/IMMORTAL adapter fails | Core local execution remains available |

## 9. Current implementation status and gaps

**Present as proposals/contracts on main:**
- ADR-0010 one-time Project Mandate and Runtime-derived task child authority;
- v0.1 mandate and consent claim schemas;
- isolated authority evaluator and its 17 contract tests;
- ADR-0008/0009 proposed cryptographic, consent and revocation lifecycle;
- local Resource Manager compatibility wrapper;
- local-first, reciprocal-mesh and sponsored capacity design in Compute Reciprocity / No-Mandatory-Cash.

**Not yet present as one integrated Core:**
- durable, signed Project Mandate store and consent/anchor lifecycle;
- generalized project descriptor/leadership-mode registry;
- project lifecycle/state reducer and autonomous project loop;
- task-scoped workspace/worktree manager with recovery;
- integrated Runtime capability enforcement and credential broker;
- generalized Resource Provider interface, remote resource discovery and lease registry;
- Support Registry and payment-provider-independent contribution record;
- end-to-end evidence-backed support/resource reporting.

The current AEP draft, task manifest and local Agent task store are not substitutes for these integrated Core contracts. No existing implementation should be described as satisfying this document until the acceptance tests and end-to-end flows pass.

## 10. Implementation sequence

1. **Core interfaces and types:** an initial versioned record-schema slice is now drafted in [CORMIA_CORE_INTERFACE_CATALOG_v0.1.md](./CORMIA_CORE_INTERFACE_CATALOG_v0.1.md): project descriptor, project lifecycle projection/event, resource offer/lease, and separate financial/in-kind support records. The descriptor references existing mandate claims by digest and does not duplicate them. A generic durable task record and production runtime bindings remain deferred.
2. **Mandate alignment:** map the current ADR-0010 v0.1 local coding mandate into the generalized model; record unsupported general-project operations without widening the schema silently. Reuse ADR-0008/0009 trust decisions and ADR-0010 autonomy behavior.
3. **Project lifecycle:** add a durable reducer for project and authority states; keep task-specific state machines separate.
4. **Local Resource Provider:** wrap the existing Resource Manager and local model/filesystem execution first; test no silent fallback and safe resource release.
5. **Autonomous project loop:** connect the mandate, project journal, task decomposition, workspace isolation, resource lease and evidence package in a local-only end-to-end task.
6. **Community Support Registry:** first record pledges/offers/restrictions and their provider/evidence references; do not implement payment custody or token issuance in the Core.
7. **In-kind providers:** add explicit opt-in remote resource offers, lease, preemption, privacy and revocation.
8. **Optional adapters:** only after Core works independently, add a financial provider; later add AEP funded task contracts, Cardano, CRC or IMMORTAL where a project explicitly needs them.
9. **Acceptance:** demonstrate a creator-led and an agent-led project using one Core, with zero optional economic adapters; then disconnect adapters and repeat the local task unchanged.

## 11. Open decisions (must not block Core)

- How a multi-person/team/community steward is represented and authenticated.
- Whether agent-led projects can use a community stewardship body instead of one human/organizational steward.
- Universal project/task identity across local, remote and multi-agent contexts.
- Generalized multi-agent and remote-workspace capability profiles beyond the current coding-worktree mandate schema.
- Resource offer measurement, discovery, privacy, provider reputation and cross-host lease semantics.
- How project benefit tiers and governance participation are defined, if offered.
- Provider/custodian selection, financial reporting and applicable legal/accounting review.
- Whether/when CRC quota accounting is enabled.
- Which payment, compute, storage and chain adapters ship first.

These decisions do not block a local general-purpose agent or creator/team-led / agent-led project operation under a valid local mandate.


## 12. Bounded verification status

The abstract Core reference model is in `verification/core_contracts/core_contract_model.py`; its tests are in `test_core_contract_model.py`. GitHub Actions [run #48](https://github.com/LiberoNuvola/Cormia/actions/runs/41583912440) passed **39 Core tests** (22 abstract predicate tests + 17 JSON Schema conformance tests) and all **31 EXP boundary tests**, for **70 tests total and zero failures**. The schemas are validated against JSON Schema Draft 2020-12.

The Core tests cover:
- JSON Schema shape/version validation for the project, lifecycle, resource and support records;
- strict rejection of undeclared payment, wallet, Cardano, token, task-state and authority-state fields from mandatory Core records;
- creator/team-led, agent-led and hybrid projects under the same Core contract;
- steward, active project and active mandate requirements;
- separate project and authority lifecycles;
- child authority as the intersection of mandate, task request and host policy;
- execution with no optional economic/chain adapters;
- local-only execution without silent remote fallback;
- explicit remote opt-in, provider/lease availability and privacy acceptance;
- resource offer validation, owner acceptance, capacity, expiry and revocation;
- no authority grant from financial or in-kind support;
- provider-confirmed settled contributions versus unconfirmed pledges;
- no default financial beneficiary that is an agent's personal wallet.

These are finite reference-model checks only. They do not prove the actual Runtime, signed mandate store, consent broker, revocation anchor, durable project lifecycle, OS resource isolation, remote provider mesh, payment custody or end-to-end community support. No production schema or runtime was changed.


## 13. Versioned record interfaces — draft v0.1.0

The initial JSON record contracts are catalogued in [CORMIA_CORE_INTERFACE_CATALOG_v0.1.md](./CORMIA_CORE_INTERFACE_CATALOG_v0.1.md) and live under `schemas/core/`.

The slice includes:
- Project Descriptor with leadership/steward/accountability references and a digest-only pointer to the existing signed mandate claims;
- Project Lifecycle Record and Project Lifecycle Event with a separate journal cursor and append-event digest fields;
- Resource Offer and Resource Lease with explicit availability, owner acceptance, validation evidence, task binding and lease expiry;
- separate Financial Support and In-Kind Support records.

These schemas deliberately do not merge project, task and mandate authority lifecycles. The mandatory Core records reject undeclared economic/chain fields. Optional financial support is provider-referenced and cannot name an agent personal wallet as beneficiary; in-kind support contains no monetary equivalent.

The new CI suite validates schema shape and fail-closed conditions. It does not establish durable journal semantics, signed mandate resolution, schema-generated Runtime types, OS quota enforcement, persistent leases or a support/payment service. The schemas remain proposals for review, not a normative runtime API.
