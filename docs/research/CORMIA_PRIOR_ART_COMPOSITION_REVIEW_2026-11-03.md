# Cormia Prior-Art Composition Review v0.1

- **Date:** 2026-11-03
- **Status:** research / architecture review; non-normative
- **Repository baseline:** `LiberoNuvola/Cormia`, branch `work/exp-generalization-crosswalk`
- **Purpose:** test the current Cormia architecture against existing standards, open-source systems and deployed design patterns before creating new Core subsystems, schemas, protocols or services.
- **Relation:** expands `docs/research/PRIOR_ART.md` and `docs/research/REUSE_AND_COMPOSITION_MATRIX.md`; it does not amend AEP, IMMORTAL, PRE-RICH or any economic decision.

## 1. Executive finding

Cormia is not starting from an empty architecture space. Most of the components recently described have strong prior art:

- **Agent orchestration and durable workflows:** LangGraph, Temporal and Microsoft Agent Framework already provide agent/workflow orchestration, checkpoints, durable recovery, retries and multi-agent composition.
- **Agent interoperability:** A2A covers agent discovery, identity/authentication declarations, messaging, task lifecycles and artifacts. MCP covers agent-to-tool/resource/prompt access.
- **Authorization and delegation:** Cedar and OPA cover policy decision engines; UCAN and Biscuit cover attenuated/delegated capabilities. Cormia should not create a new generic policy language or capability-token format without a comparative spike.
- **Local execution isolation:** Windows AppContainer, Job Objects and Windows Sandbox; Linux OCI/cgroups, gVisor, Kata and Firecracker already provide different isolation/resource-control tiers.
- **Team collaboration and integration:** Matrix or Zulip can provide project conversations; Git worktrees already provide parallel isolated working trees; Yjs is available for true concurrent shared editing; GitHub Actions or Forgejo Actions plus the existing Flux Point DoD/JEV assets cover build/test/evidence pipelines.
- **Work provenance and receipts:** in-toto/DSSE, SLSA, SCITT RFC 9942/9943, OpenTelemetry and Orynq cover substantial parts of artifact provenance, signed attestations, traces, transparency receipts and audit evidence.
- **Volunteer compute and resource exchange:** BOINC, Golem, iExec, Akash, Acurast and Petals already cover worker offers, task distribution, replication, compute leases, provider selection, contribution credits or distributed inference in different combinations.
- **Community money:** Open Collective and fiscal-host models already cover donations, recurring support, budgets, expenses and custody through external legal/financial entities.

**Conclusion:** do not build a Cormia-specific workflow engine, agent messaging protocol, chat system, source-control/worktree engine, sandbox, provenance envelope, generic transparency log, compute marketplace or payment custody layer by default. Compose existing systems through narrow adapters. Build only the Cormia-specific binding between project mandate, task/attempt, accepted resource lease, verifier result, project policy and optional economic consequence.

The potential Cormia contribution is therefore a **local-first, autonomous project-execution composition**: durable project/mandate context, bounded autonomous task execution across owner-controlled workers, explicit separation of money and in-kind resources, and evidence-bound completion/acceptance. This is a research hypothesis, not a novelty or freedom-to-operate conclusion.

## 2. Method and decision vocabulary

This review uses four different prior-art categories and does not treat them as interchangeable:

- **Standard/specification:** an interoperable contract or data format. Prefer adoption or an adapter over a new competing protocol.
- **Reference implementation/system:** working software that may be reused, integrated or benchmarked. Verify exact version, license, threat model and maintenance before adding a dependency.
- **Research/proposal:** useful architecture or a hypothesis, but not proof of production maturity.
- **Observed deployment claim:** evidence about a particular configured deployment only; it must not be generalized to all versions or deployments.

Reuse decisions:

| Decision | Meaning |
|---|---|
| **ADOPT** | Use the existing standard or stable interface directly. |
| **ADAPT** | Build a narrow Cormia adapter/binding around an existing implementation. |
| **SPIKE** | Compare alternatives in a bounded, executable experiment before selecting. |
| **REFERENCE** | Borrow a pattern or threat model; do not import code or claim equivalent guarantees. |
| **KEEP / BIND** | Preserve existing Cormia/IMMORTAL assets and connect them through a contract. |
| **BUILD NARROWLY** | Implement only the residual Cormia-specific invariant that prior art does not provide. |
| **DO NOT BUILD** | Do not create a parallel generic subsystem while the upstream solution is adequate. |

This is an architecture/prior-art screen, not a patentability opinion, legal opinion, exhaustive novelty search or freedom-to-operate analysis.

## 3. Component-by-component composition matrix

| Cormia component being proposed | Closest prior art / what already exists | Recommended treatment | Residual Cormia work |
|---|---|---|---|
| General agent/runtime execution | Existing IMMORTAL Local Agent v0.8.0; OpenHands; SWE-agent; LangGraph; Microsoft Agent Framework; **Everything Claude Code (ECC)** | **KEEP / SPIKE / selectively ADAPT.** Preserve the working local Agent, Granite model gateway, Task Store, Resource Manager and Evolution Manager. Evaluate ECC as a source of curated skills, verification workflows, context-management patterns, confidence-scored learning and security checks—not as a replacement runtime or a model-training system. ECC's harness support is provider-specific; native Windows has documented Continuous Learning v2 observer/memory-vault defects, and Codex hooks require separate explicit trust. | Run bounded ECC-01: pin/review the upstream release and license; inventory skills/hooks/MCP/permissions; scan without auto-fix; map only selected workflows to Cormia; test memory scoping, token/context cost, Windows behavior and hook isolation. Learned instincts remain suggestions and cannot grant tools, modify mandates or become task truth. Preserve the local Task Store and AEP authority boundary. |
| Durable task engine, DAG, retry, checkpoint and recovery | Temporal durable Workflows/Event History/replay/Activities; LangGraph checkpointers, graph state and interrupts; Microsoft Agent Framework durable extension | **SPIKE before implementation.** Temporal is strongest prior art for long-running durable workflow execution and worker task queues. LangGraph is agent-graph orchestration and checkpointing, not a replacement for every durable workflow concern. Microsoft Agent Framework has durable workflow integration. Compare local-first deployment, persistent storage, deterministic replay, side-effect/idempotency rules and operational footprint. | Keep Project, Mandate and Task lifecycles distinct. Do not promote the existing project-lifecycle journal into a generic task engine. Select one runtime composition and prove crash/restart, duplicate delivery, side-effect idempotency and resume. |
| Agent-to-agent discovery, delegation and communication | **A2A**: Agent Cards, discovery, authentication declarations, messages, async task lifecycle, streaming and artifacts | **ADOPT / ADAPT.** Use A2A for interoperability between independently implemented agents. | Map A2A Task/Artifact references to Cormia tasks and evidence. A2A does not grant Cormia mandate authority, enforce a local resource lease, prove correctness or settle funds. |
| Agent-to-tool, resource and prompt interface | **MCP**: standard client/server tool, resource and prompt access | **ADOPT / ADAPT.** Keep the existing Mitsuro read-only MCP bridge as a narrow observer. Use MCP adapters for tools. | Tool discovery/exposure is not authorization. Every call must still pass Cormia's trusted capability/mandate boundary; tool success is not proof of task acceptance. |
| Project Mandate, policy decision and delegated child authority | **Cedar / OPA** policy decision engines; **UCAN / Biscuit** attenuated delegated capabilities; existing Cormia mandate claims and capability-grant/JWS work | **SPIKE, then KEEP / ADAPT.** Do not invent another policy language or a second signing/revocation scheme. Test whether Cedar or OPA can express the current Cormia host-policy decisions. Compare UCAN and Biscuit with the existing signed grant for delegation attenuation, offline verification, expiry and revocation. | Cormia still owns the Project Mandate's project meaning, steward/accountability binding and host consent. A policy engine is not identity proof. Biscuit explicitly leaves revocation to external state; capability attenuation does not remove the need for a trusted revocation/rollback source. |
| Team Room and persistent project discussion | **Matrix** rooms/events/federation/application services; **Zulip** streams/topics/bots and APIs; A2A for agent-to-agent task communication | **DO NOT BUILD a new chat protocol. SPIKE** Matrix versus Zulip only if a first two-agent workflow proves the need. | Add typed task/artifact/decision references and preserve the rule that conversation cannot mutate authority or mandate. A local-only task needs no Team Room. |
| Project Workbench / parallel editing | **Git worktree** supports multiple linked working trees in one repository; Git branches/patches; **Yjs** CRDT shared types for concurrent collaborative editing; Jujutsu provides operation log and conflict-aware versioning as an alternative VCS | **ADOPT Git worktrees first. REFERENCE Yjs.** Do not build a custom VCS or shared filesystem protocol. A CRDT editor is only justified if simultaneous same-document editing is a measured requirement. | Cormia-specific integration/merge task, workspace permissions, patch attribution and artifact indexing. Task isolation should be based on separate worktrees, not unrestricted shared writes. |
| Integration & Verification Bench / Delivery Gate | GitHub Actions and self-hosted runners; Forgejo Actions/runners; existing Flux Point DoD harness and workflows; existing JEV registry, validators and result vocabulary | **KEEP / ADAPT.** Reuse the current DoD/JEV assets and existing CI runner. Do not build another build/test engine. | Bind a candidate to exact source revision, inputs, test profile, result and verifier. CI runners execute code and are security boundaries; they need the same sandbox/resource controls as other workers. Publication/merge/release/deploy remain separate authority boundaries. |
| Worker-local isolation / Cormia Node | Windows AppContainer/LPAC, Windows Sandbox, Windows Job Objects; Linux OCI, cgroups, seccomp, Landlock, AppArmor; gVisor, Kata and Firecracker | **ADAPT OS/runtime primitives; DO NOT BUILD a sandbox.** Choose a tier by workload and host OS. Windows Job Objects expose CPU/memory/time/process accounting and limits; AppContainer restricts resource access. gVisor is a user-space application kernel; Kata/Firecracker use VM isolation with different operational costs. | Cormia Node should be a small owner-controlled broker that provisions a selected sandbox profile, binds a task/lease, collects native usage counters, revokes/stops the process tree and returns evidence. GPU isolation/measurement is a separate capability and must not be inferred from CPU/RAM controls. |
| Resource offers, leases, provider discovery and scheduling | **BOINC** volunteer work units, task replication, per-application validators and accepted-result credit; **Golem** provider/requestor offers/reputation; **iExec** workerpools; **Akash** provider bidding and leases; **Acurast** compute provider deployments/heartbeats/TEE claims; **Petals** volunteer split-model inference | **REFERENCE / ADAPT.** Reuse offer/lease/provider concepts; BOINC is strong prior art for useful-work validation and credit only after accepted results. Golem/Akash/iExec are relevant to later remote provider markets, but their economics/assumptions differ. | Do not launch a marketplace or peer mesh in the first local Runtime. Begin with local owner-accepted capacity and bounded leases; add remote provider interoperability only after task binding, isolation, revocation, evidence and privacy are tested. |
| Financial patronage and community funding | **Open Collective** contributions, budgets, expenses and Fiscal Hosts; external grants/donation/payment services | **ADAPT as optional provider integrations. DO NOT BUILD custody/accounting.** A fiscal host is a legal/financial custodian, not just a software endpoint. | Cormia records project/support intent and provider references. Financial settlement, custody, tax/compliance and expense disbursement stay with the selected provider/custodian. Funding never widens agent capabilities. |
| Agent process trace and action-level receipts | **OpenTelemetry** spans/events for observability; **Orynq SDK** records agent observations, decisions, tool calls and spans as rolling hash chains/Merkle bundles; optional Cardano or Materios anchoring. Orynq repository declares MIT license. | **SPIKE Orynq before inventing a Cormia trace/receipt envelope. ADAPT OTel for operational telemetry.** Orynq is unusually close to the current agent-work evidence proposal. | Verify exact package/API/version, signer trust, key lifecycle, payload privacy, durable storage and offline verification. Orynq proves integrity/provenance of recorded events under its trust assumptions; it does not prove arbitrary task outcomes, GPU work or host counters are truthful. |
| Build/artifact provenance and signed evidence | **in-toto Statement/Attestation Framework + DSSE**; **SLSA provenance**; **SCITT RFC 9942/9943** COSE receipts and transparency architecture | **ADOPT formats where they fit.** Use in-toto/DSSE as the candidate attestation envelope; SLSA provenance for build provenance; SCITT as a transparent registration/receipt layer where useful. Do not make a new canonical signed JSON envelope by default. | Add a narrowly typed Cormia predicate binding project, task, attempt, assignment digest, lease, workload, inputs/outputs, verifier identity, policy and acceptance decision. Keep the predicate separate from the standard envelope and the transparency service. |
| Work Completion Receipt and assurance profiles | Existing in-toto/SLSA provenance, Orynq action traces/tool receipts, SCITT receipts, BOINC validation, deterministic tests/re-execution, optional RISC Zero/TEE profiles | **DO NOT FREEZE A NEW RECEIPT SCHEMA YET. SPIKE the composition first.** Preserve separate claims: trace integrity, artifact provenance, availability, resource measurement, execution environment, task outcome, execution proof and finality. | Cormia-specific task/lease/mandate binding and acceptance semantics are likely necessary. Avoid a universal assurance ladder (current R0–R4 is only Cormia terminology) unless a cross-profile test proves it useful; prefer a matrix of independent claims and per-workload required evidence. |
| Materios certification adapter | Materios Orinq receipt pallet and cert daemon; off-chain blob verification/Merkle root; committee availability attestation; TEE-attestation pallet | **OPTIONAL ADAPTER ONLY; no semantic-completion claim.** Current audited Materios source is labelled Alpha/MVP. Its receipt path can attest commitment integrity/availability, not arbitrary task correctness. The inspected TEE verifier implements ARM TrustZone while other declared types return `NotImplemented`; the path has challenge-binding prerequisites. | Cormia must provide independently verified task-outcome evidence before calling a task complete. Read back exactly what Materios certified. The `compute_metering_v2` self-rooted shortcut depends on gateway manifest authority and is not independent proof that GPU work occurred. |
| CRC and Project Compute Reward Pool | BOINC accepted-result credits; Senda/peer inference contribution credits; Golem/Akash provider payments and escrow | **REFERENCE, then specify separately.** The broad idea of earning credits for useful compute already exists. Keep Cormia CRC (non-transferable usage right) distinct from financial provider payouts and a project-funded reward pool. | No credit for advertised capacity, online time, raw worker signature or availability-only certificate. Credit must follow task-bound, accepted useful work under a named verifier profile. Allocation, anti-Sybil, custody and dispute parameters remain open. |

## 4. High-signal details and limitations

### 4.1 Durable execution is already a solved product category

Temporal records an ordered Workflow Event History and reconstructs state by replaying deterministic workflow code. Activities isolate external side effects and record results so they are not repeated during replay. Temporal also documents a local development server and self-hosted service. LangGraph persists graph state using checkpointers and supports interrupts; graph nodes may restart from the start after resume, so side effects must be idempotent.

This means Cormia should not write a generic scheduler/checkpoint/retry/replay engine before benchmarking these options. The spike must test local self-hosting, crash recovery, duplicate task delivery, long-running tasks, resource leases, and whether the service can operate with no cloud account. Temporal's event history is workflow state, not by itself the Cormia Project Mandate or a public evidence certificate.

### 4.2 Authorization has two distinct layers

Cedar/OPA answer policy questions. UCAN/Biscuit-style tokens carry delegated capability restrictions. Neither substitutes for the trusted identity and consent source that authorizes the root Project Mandate. The current local Cormia mandate is coding-workspace-specific and should not be silently generalized. Preserve its existing evaluator while testing standard policy/token components; do not add a parallel signer, second prompt, or second revocation system.

### 4.3 OS controls enforce resource limits; Cormia records the binding

Windows Job Objects can manage process trees and enforce CPU-rate, memory, time and termination controls. AppContainer/LPAC restrict process access to resources that have been explicitly granted. Linux cgroups and OCI runtimes expose native CPU/memory controls; gVisor, Kata and Firecracker add isolation layers with different compatibility and resource costs.

Cormia should not assert that one profile works identically on Windows and Linux. The Resource Broker must report which native controls actually applied, which counters were available, which controls were unavailable and whether enforcement failed. GPU scheduling, utilization and memory telemetry remain a separate host/hardware integration.

### 4.4 Integrity is not correctness

The evidence stack must keep the following distinct:

1. **Observability:** what spans/events were recorded (OpenTelemetry).
2. **Integrity/provenance:** whether signed statements and artifacts still match their digests (in-toto/DSSE/SLSA/Orynq).
3. **Transparency:** whether a signed statement/commitment was registered and can be proven in an append-only history (SCITT, Cardano anchoring or Materios).
4. **Availability:** whether the committed evidence can be retrieved and verified.
5. **Execution environment:** what measured environment a TEE/VM attestation covers.
6. **Resource measurement:** what the host's counters observed and which issuer/control boundary is trusted.
7. **Outcome acceptance:** whether an independent workload-specific verifier accepted the output against predeclared criteria.
8. **Finality:** whether the relevant ledger/settlement reached its required state.

No one of these proves all the others. In particular, worker signatures, hash chains, Merkle roots, committee availability attestations, model fingerprints and TEE quotes do not by themselves prove that an AI task was correct or that a GPU performed the claimed amount of useful work.

### 4.5 Orynq is a concrete candidate, not a substitute for Cormia acceptance

The inspected Orynq SDK source records AI process events in a rolling hash chain, produces Merkle bundles, supports model-manifest pinning, and provides signed tool-call receipt verification for supported response-signature mechanisms (for example RFC 9421 and provider webhooks). Its documentation warns that an embedded public key proves only that a payload was signed by that key; the relying party must bind the signer to a trusted key. Its signing-proxy pattern for unsigned tools shifts trust to the proxy that observed and signed the response.

Therefore Orynq can reduce the need for a bespoke Cormia trace/anchor system, but it does not remove Cormia's need for a workload-specific independent verifier and acceptance record.

### 4.6 Materios has a narrower current guarantee than the Cormia target

The Materios README describes an Alpha/MVP partner-chain system for gaming microtransaction settlement and AI audit receipts. The inspected receipt pallet stores receipt commitments and supports threshold availability certification. The blob verifier checks chunks and Merkle roots in the normal path; its special self-rooted `compute_metering_v2` branch can trust a gateway-provided manifest rather than independently fetching the claimed chunks. The inspected TEE verifier has a narrower implemented platform set than the enum suggests.

Treat Materios as a possible external receipt/availability certification and anchoring service. Do not describe it as an already available general-purpose semantic verifier for Cormia's completed tasks.

## 5. Recommended target composition

The current proposal should be simplified into the following composition, with one implementation choice per open decision rather than parallel bespoke subsystems:

```text
Project / Steward / Standing Mandate
                  |
                  v
        Cormia Authority Binding
  (trusted identity + policy decision + attenuated task scope)
                  |
                  v
        Durable Workflow Runtime
  (Temporal OR a validated alternative; not a new home-grown engine)
                  |
                  v
     Agent Worker / Existing Local Agent
          |                |
          |                +--> A2A (agent-to-agent)
          +--------------------> MCP (tools/resources)
                  |
                  v
       Host-owned Resource Broker
 (Windows/OCI/Linux native controls; bounded lease)
                  |
                  v
     Isolated task workspace / Git worktree
                  |
                  v
       Existing CI / DoD / JEV verification
                  |
                  v
   in-toto/DSSE + SLSA predicate + Orynq trace
                  |
           optional SCITT / Materios / Cardano
                  |
                  v
     Cormia task acceptance & project record
                  |
         optional CRC / funded reward adapter
```

This is a target composition, not a claim that these connections are implemented. The first useful vertical slice should remain local-only and should not require a chat backend, remote worker network, payment provider, Cardano or Materios.

## 6. What Cormia still has to define (narrow residuals)

The prior art does not remove the need for Cormia-specific contracts. It narrows them:

1. **Project/mandate binding:** which authenticated steward and mandate authorize a project, how revocation/expiry/rollback are checked, and how task authority is attenuated without per-operation human prompts.
2. **Task-to-resource binding:** assignment digest, exact worker, accepted resource offer, lease, workspace, host policy and revocation must refer to the same attempt.
3. **Outcome acceptance:** acceptance criteria are frozen before execution; verifier identity/version and verdict are bound to exact inputs and output digests. `FAILED`, `INDETERMINATE`, `EVIDENCE_INSUFFICIENT` and `ACCEPTED` must not collapse into a single completed flag.
4. **Evidence composition:** Cormia defines a typed predicate, not a competing signature/envelope/transparency standard. It must say exactly which upstream evidence supports each claim and which remains unverified.
5. **Local-first autonomy:** the first runtime must recover without cloud accounts, external task queues or per-action approvals, while respecting a standing bounded mandate.
6. **Optional perimeter isolation:** AEP/IMMORTAL, Cardano, Materios, financial support and CRC remain optional adapters and cannot become prerequisites of Core operation.

A new repository-level abstraction is justified only when a reproducible conformance experiment demonstrates that the available upstream components cannot satisfy one of these residuals without violating Cormia's stated constraints.

## 7. Decisions to freeze now

- **No custom agent messaging protocol:** A2A for inter-agent interoperability; MCP for tools/resources/prompts.
- **No new Team Room protocol/UI yet:** compare Matrix and Zulip only after the first two-agent local workflow requires it.
- **No custom version-control or shared-write system:** use Git worktrees and explicit integration. Evaluate Yjs only for genuine simultaneous shared editing.
- **No custom build/test pipeline:** reuse GitHub Actions or another CI runner, existing Flux Point DoD gates and JEV result vocabulary.
- **No custom sandbox:** build host adapters around Windows or Linux enforcement primitives and report their real limits.
- **No generic resource marketplace in the first local Runtime:** local offer → accepted lease → host-enforced task. Remote markets are a later adapter.
- **No custom durable execution engine until Temporal/LangGraph/Agent Framework are benchmarked against the actual local-first requirements.**
- **No new general-purpose receipt envelope or Materios-specific Core schema yet:** first test in-toto/DSSE/SLSA + Orynq + SCITT/Materios composition.
- **No generic R0–R4 assurance grade until the labels map to independently verifiable claims.** Keep evidence dimensions orthogonal and define a per-workload evidence requirement matrix.
- **No CRC or reward-pool issuance from availability-only, worker-only or raw meter evidence.**

## 8. Required bounded implementation spikes

| Spike | Compare | Required pass criteria | Output |
|---|---|---|---|
| **PA-01 Durable local task execution** | Temporal vs LangGraph plus current Cormia local store | offline/local startup; crash/restart; retry/idempotency; persisted task and lease binding; no duplicate external side effects; resource-aware cancellation | ADR and smallest tested runtime adapter |
| **PA-02 Authority and delegation** | Existing mandate evaluator + Cedar/OPA; existing grant + UCAN/Biscuit | same request decisions; fail-closed error handling; attenuation; expiry; revocation; rollback/freshness; no per-operation approval prompt | ADR, policy fixtures, token mapping |
| **PA-03 Host isolation** | Windows AppContainer + Job Objects + optional Windows Sandbox; Linux OCI/cgroups + gVisor/Kata/Firecracker | task cannot read ungranted files/secrets; network defaults declared; limits are enforced; lease expiry kills process tree; counters identify source and unsupported dimensions | OS-specific adapter decision and adversarial tests |
| **PA-04 Work provenance** | Existing JEV/Flux Point + in-toto/DSSE/SLSA + Orynq + SCITT/Materios | offline evidence verification; exact task/attempt/manifest/output binding; signer trust; privacy; explicit distinction between trace, provenance, availability, metering and semantic acceptance | standard-envelope and predicate mapping; do not create a new envelope unless gap remains |
| **PA-05 Team collaboration** | Git worktree-only vs Matrix/Zulip + A2A; Yjs only if necessary | two agents exchange patches, cite evidence, resolve integration conflicts, keep decisions separate from authority and preserve offline/local workflow | defer UI or choose one adapter based on measured need |
| **PA-06 Resource reciprocity** | BOINC validation/credit patterns vs Golem/iExec/Akash/Acurast provider patterns | accepted-work credit, replay protection, provider revocation, Sybil/collusion disclosure, resource metering uncertainty | keep CRC and any reward pool as separate profiles |

No spike is a broad new subsystem. Each is a small comparison with fixtures and an ADR. Code reuse additionally requires a separate dependency/license/security review.

## 9. Immediate roadmap correction

Before Gates 4/4A create the proposed worker, team workspace or completion receipt implementation, add a prior-art composition gate:

- map every planned component to one upstream standard/system or mark it Cormia-specific with evidence;
- finish PA-01 through PA-04 before implementing a durable task engine, host sandbox or receipt schema;
- finish PA-05 only if an actual two-agent collaboration requirement remains after Git worktree/A2A/MCP composition;
- preserve all existing local Agent, JEV, Flux Point and Mitsuro assets;
- record exact source version, commit, license, dependency and trust boundary for every adopted implementation.

A failed spike is a valid result: if an existing system satisfies the requirement, adopt/adapt it and do not implement a duplicate.

## 10. Source register

### Durable execution and agent orchestration
- Temporal Workflows and Event History: https://docs.temporal.io/workflows
- Temporal self-hosted service / local development: https://docs.temporal.io/self-hosted-guide
- LangGraph persistence and checkpointers: https://docs.langchain.com/oss/python/langgraph/persistence
- LangGraph interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts
- Microsoft Agent Framework durable extension: https://learn.microsoft.com/en-us/agent-framework/hosting/durable-extension
- OpenHands: https://github.com/OpenHands/OpenHands
- SWE-agent: https://github.com/SWE-agent/SWE-agent

### Inter-agent, tool and authority protocols
- A2A specification: https://a2a-protocol.org/latest/specification/
- A2A task lifecycle: https://a2a-protocol.org/latest/topics/life-of-a-task/
- MCP specification: https://modelcontextprotocol.io/specification/2026-07-28
- Cedar authorization: https://docs.cedarpolicy.com/auth/authorization.html
- Open Policy Agent: https://www.openpolicyagent.org/docs/latest/
- Biscuit authorization and attenuation: https://www.biscuitsec.org/docs/why-biscuit/
- UCAN specification: https://github.com/ucan-wg/spec

### Isolation, host resource control and collaboration
- Windows AppContainer: https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer
- Windows Job Objects: https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects
- Windows Sandbox: https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/
- Docker resource constraints: https://docs.docker.com/engine/containers/resource_constraints/
- gVisor architecture/security: https://gvisor.dev/docs/architecture_guide/intro/
- gVisor security model: https://gvisor.dev/docs/architecture_guide/security/
- Firecracker design: https://github.com/firecracker-microvm/firecracker/blob/main/docs/design.md
- Kata Containers architecture/threat model: https://kata-containers.github.io/kata-containers/design/architecture/
- Git worktrees: https://git-scm.com/docs/git-worktree
- Yjs: https://docs.yjs.dev/
- Matrix application services: https://www.matrix.org/docs/guides/application-services/
- Zulip API: https://docs.zulip.com/api/
- Forgejo Actions and runners: https://forgejo.org/docs/latest/user/actions/overview/

### Provenance, trace and transparency
- in-toto attestation framework: https://github.com/in-toto/attestation
- in-toto specifications: https://in-toto.io/docs/specs/
- SLSA v1.2: https://slsa.dev/spec/v1.2/
- SCITT RFC 9942 — COSE Receipts: https://www.rfc-editor.org/rfc/rfc9942
- SCITT RFC 9943 — trustworthy and transparent digital supply chains: https://www.rfc-editor.org/rfc/rfc9943
- Sigstore Rekor: https://github.com/sigstore/rekor
- OpenTelemetry: https://opentelemetry.io/docs/
- Orynq SDK (MIT): https://github.com/Flux-Point-Studios/orynq-sdk
- Orynq tool-receipt trust note: https://github.com/Flux-Point-Studios/orynq-sdk/blob/main/docs/anti-lie-tool-receipts.md
- Materios receipt pallet: https://github.com/Flux-Point-Studios/materios/blob/main/partnerchain/pallets/orinq-receipts/src/lib.rs
- Materios blob verifier: https://github.com/Flux-Point-Studios/materios-operator-kit/blob/main/daemon/blob_verifier.py
- Materios TEE verifier: https://github.com/Flux-Point-Studios/materios/blob/main/partnerchain/pallets/tee-attestation/src/verifier.rs

### Volunteer compute, resource markets and community funding
- BOINC validators: https://github.com/BOINC/boinc/wiki/Validators
- BOINC job replication: https://github.com/BOINC/boinc/wiki/Job-replication
- Golem provider model: https://docs.golem.network/docs/providers
- iExec workerpools: https://docs.iex.ec/get-started/overview/workerpool
- Akash providers and leases: https://akash.network/docs/learn/core-concepts/providers-leases/
- Acurast compute network: https://acurast.com/blog/network-and-tech/decentralized-compute/
- Petals: https://github.com/bigscience-workshop/petals
- Open Collective contributions: https://documentation.opencollective.com/getting-started/understanding-contributions
- Open Collective Fiscal Hosts: https://documentation.opencollective.com/fiscal-hosts/fiscal-hosts

### Cormia's existing research/assets
- Prior-art register: https://github.com/LiberoNuvola/Cormia/blob/work/exp-generalization-crosswalk/docs/research/PRIOR_ART.md
- Reuse/composition matrix: https://github.com/LiberoNuvola/Cormia/blob/work/exp-generalization-crosswalk/docs/research/REUSE_AND_COMPOSITION_MATRIX.md
- Decentralized inference prior art: https://github.com/LiberoNuvola/Cormia/blob/work/exp-generalization-crosswalk/docs/research/DECENTRALIZED_INFERENCE_PRIOR_ART.md
- Core-first architecture proposal: https://github.com/LiberoNuvola/Cormia/blob/work/exp-generalization-crosswalk/docs/architecture/CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md
- Coordination Plane proposal: https://github.com/LiberoNuvola/Cormia/blob/work/exp-generalization-crosswalk/docs/architecture/CORMIA_COORDINATION_PLANE_AND_MULTI_NODE_TOPOLOGY_v0.1.md
- Work Completion Evidence proposal: https://github.com/LiberoNuvola/Cormia/blob/work/exp-generalization-crosswalk/docs/architecture/CORMIA_WORK_COMPLETION_EVIDENCE_AND_MATERIOS_CERTIFICATION_v0.1.md

**Reviewed:** 2026-11-03. All source versions, deployment claims, licenses, APIs and IPR must be re-checked before vendoring, production use or public novelty claims.
