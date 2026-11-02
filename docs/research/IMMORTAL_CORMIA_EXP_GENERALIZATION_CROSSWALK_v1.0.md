# IMMORTAL–Cormia EXP Generalization Crosswalk v1.0

- **Date:** 2026-11-02
- **Status:** Research / architecture coordination artifact; non-normative
- **Cormia repository baseline:** `LiberoNuvola/Cormia`, `main` at `b699b20de01c4c81fc7636a555e2ce382ce52987`
- **PNC proposal under review:** PR [#1](https://github.com/LiberoNuvola/Cormia/pull/1), head `882629e447ed7a4c7d7f8116bf0b20201f48f231`, branch `work/project-normative-contract`
- **Related research:** Notion — [IMMORTAL Algorithmic Governability Boundary & Adaptive Incentive System](https://app.notion.com/p/3e3c4454d6d58136a85cfcdbc0e287f3); Library memo `IMMORTAL_Cormia_Boundary_Spec_Research_Draft_v0.1.md`
- **Purpose:** test the IMMORTAL EXP-01…EXP-12 generalization axes against Cormia as an independent application domain without duplicating components or importing PRE-RICH policy.

## 1. Executive conclusion

Cormia already contains several architectural counterparts to EXP, especially in the Task Manifest, task lifecycle, capability model, verifier/evidence flow, resource manager boundary, and the separation between model, Runtime, and protocol authority.

That does **not** mean the EXP agenda has already been fully incorporated into Cormia. The present AEP specification remains a draft; the local Runtime integration is incomplete; and the current contracts do not yet implement all the semantic guarantees that EXP is intended to test.

The correct conclusion is:

1. **The EXP axes are relevant to Cormia and should be part of its architecture review.**
2. **Cormia already covers some of their structural concerns in draft form.** Rewriting those concerns as new independent Cormia subsystems would create duplication.
3. **Several semantic gaps remain open**, notably the distinction between task assignment and novation, operational resource limits and economic risk budgets, and compute-credit accounting versus obligation netting.
4. **The economic jurisdiction between Cormia AEP and IMMORTAL must be made explicit** before Cormia's escrow, bonds, fees, CRC or settlement are integrated with IMMORTAL's economic kernel.
5. **This crosswalk does not establish that the three projects implement one proven universal algorithm or theorem.** The common research object remains under investigation.

This document is a mapping and gap register. It does not amend AEP, ADR-0010, the proposed ADR-0011, IMMORTAL's Constitution, PRE-RICH semantics, or any EXP contract.

## 2. What “generalization” means here

For this research, generalization means identifying properties that remain meaningful when the application domain changes, then expressing them as reusable contracts, invariants, transition constraints and evidence requirements.

It does **not** mean:
- copying a PRE-RICH controller into Cormia;
- treating every task, resource, credit or obligation as the same economic object;
- forcing local, non-economic Cormia work through IMMORTAL;
- creating twelve new Cormia modules merely because twelve EXP labels exist;
- asserting that a shared vocabulary proves a shared algorithm.

The current cross-domain lens keeps three composition domains distinct:

| Domain | Primary responsibility | Relevant Cormia / IMMORTAL boundary |
|---|---|---|
| **Authority / action composition** | Who may act, for whom, over which workspace/resources, for how long, and how delegated authority is attenuated | Cormia Runtime, Project Mandate, Task Manifest, task child authority |
| **Economic / resource composition** | Which obligations and exposures exist, which resources are protected or shared, and which economic transitions may be admitted | IMMORTAL Economic Kernel and composition gate; Cormia escrow, bonds, CRC and Resource Manager remain separately typed |
| **Governance / jurisdiction composition** | Who may change which rules, under which source of authority, evidence, lifecycle and jurisdiction | IMMORTAL Governance Framework plus application profiles; Cormia PNC and project-owner authority |

These are useful research partitions, not a claim that they are already a single unified formal model. In particular, authority composition is not the same thing as economic resource composition, and neither is the same thing as governance delegation.

## 3. Cormia evidence baseline and status discipline

### 3.1 What is present on `main`

The inspected Cormia `main` baseline contains:
- A draft AEP `SPEC.md` with a signed Task Manifest, task lifecycle, task-scoped capabilities, escrow/bond concepts, assurance profiles, evidence packages, verifier/challenge rules and settlement conditions.
- `docs/architecture/ARCHITECTURE.md`, which separates protocol authority/economic state, off-chain execution, independent verification and governance.
- ADR-0010, which proposes a standing project mandate and Runtime-derived child authority for autonomous local project work.
- ADR-0007/0008/0009 proposals and reference contracts for capability scope, signed local grants, operator consent and revocation/anchor lifecycle.
- Reference-worker adapters and source-review documents that preserve the current local Agent as an integration input rather than claiming it is already AEP-conformant.
- Compute Reciprocity draft material for contribution receipts, NUWU, CRC, resource donation, verification and epoch accounting.

Sources:
- [Cormia SPEC.md](https://github.com/LiberoNuvola/Cormia/blob/main/SPEC.md)
- [Architecture](https://github.com/LiberoNuvola/Cormia/blob/main/docs/architecture/ARCHITECTURE.md)
- [ADR-0010](https://github.com/LiberoNuvola/Cormia/blob/main/docs/adr/0010-autonomous-project-delegation-and-runtime-authority.md)
- [Compute Reciprocity](https://github.com/LiberoNuvola/Cormia/blob/main/docs/economics/COMPUTE_RECIPROCITY.md)
- [Integration Baseline](https://github.com/LiberoNuvola/Cormia/blob/main/docs/architecture/INTEGRATION_BASELINE_2026-11-02.md)

### 3.2 PNC / ADR-0011 correction

ADR-0011 is **not present on the inspected `main` baseline**. It is proposed in the open draft PR [#1](https://github.com/LiberoNuvola/Cormia/pull/1), on `work/project-normative-contract`.

That PR adds:
- ADR-0011 and the PNC source-pinned policy concept;
- a PNC schema and IMMORTAL example fixture;
- a PNC identity profile;
- reference validation/runtime code and PNC-bound mandate v0.2 schemas/adapters.

The proposal makes the important distinction:
- Project Mandate grants bounded operational authority;
- PNC pins normative sources, closed decisions, invariants, evidence classes and human-authority boundaries;
- Task Manifest / child authority narrows the task;
- PNC grants **zero capabilities**.

The PR explicitly classifies the PNC as proposed/reference work, not an active trusted or Runtime-enforced contract. The PNC-bound mandate adapter assumes host-validated PNC, consent and authority inputs; persistent trusted storage, signing/consent services, revocation anchor, isolated worktree manager and full Agent integration remain separate prerequisites. The PR is a draft and must be reviewed on its own terms.

**Coordination rule:** this crosswalk does not edit PR #1's branch or claim its proposed PNC is already active. The EXP review should consume ADR-0011 only as a proposed boundary until it is merged, adopted and independently integrated.

## 4. EXP-01…EXP-12 crosswalk

Status labels describe the strength of the current evidence, not product readiness:

- **Partial — specified:** a related concept appears in AEP/ADR text, but its complete semantics or conformance are not established.
- **Architectural — boundary present:** roles or separation are stated, but integration/enforcement is incomplete.
- **Open — not specified:** no sufficiently explicit Cormia contract was found in the inspected baseline.
- **Cross-domain decision:** the mapping depends on a jurisdiction/ownership decision that must not be assumed.

| EXP axis | Cormia application | Evidence in Cormia baseline | Assessment and required gap closure |
|---|---|---|---|
| **EXP-01 — obligation classification / seniority** | Distinguish requester, worker, verifier, challenger, protocol and settlement obligations; distinguish service obligations from economic claims and protected resources | Task Manifest roles, lifecycle and escrow/bond flows are drafted in `SPEC.md`; settlement is derived from manifest/state/delivery/verdict/dispute/versioned rule | **Partial.** A complete obligation taxonomy, priority/seniority relation, source, beneficiary, maturity, discharge and conflict/tie behavior are not yet shown as one canonical contract. Do not import PRE-RICH priority or numeric parameters. |
| **EXP-02 — term structure / time horizon** | Deadline, submission window, challenge window, mandate expiry, task timeout, lease duration, retry windows and revocation timing | Task Manifest has `deadline`, `submissionWindow`, `challengeWindow`; ADR-0010 includes mandate validity, expiry and retry/runtime budgets; Resource Manager has leases/timeouts | **Partial.** Define clock/source semantics, monotonicity, boundary inclusivity, stale observations, freshness, timeout recovery and how concurrent events are ordered. A single timestamp field is not a full temporal contract. |
| **EXP-03 — asset identity / eligibility / valuation provenance** | Settlement assets, escrow/bonds, CRC usage rights, compute resources and any asset-backed task class | Task Manifest budget includes asset and maximum amount; AEP lists escrow and bond types; SPEC leaves initial settlement asset/liquidity/issuer risk open; CRC is described as non-transferable internal usage accounting | **Partial.** Define asset identity, eligible asset set, issuer/chain, valuation source/version and liquidity assumptions per profile. Do not treat CRC as a cash-equivalent asset or silently select an oracle/haircut. |
| **EXP-04 — composition of profiles** | Combine task class, worker capability, assurance/verifier selection, resource profile and privacy class | Task Manifest includes `capabilitySet`, `assuranceProfile`, `verifierSelectionProfile`, `resourceProfile` and `privacyClass` | **Partial.** The fields exist, but the canonical composition semantics, compatibility constraints, conflict detection, precedence and profile version pinning need testable contracts. No implicit profile may widen capability or weaken assurance. |
| **EXP-05 — abstract contingent claims** | Turn funded task terms into an established entitlement only after the required delivery, verification and challenge conditions; then settle exactly once | AEP lifecycle defines Submitted → Verifying → ChallengeWindow → Settled; settlement is derived from immutable manifest, state, delivery, verdict, dispute outcome and funding-time rule | **Partial.** AEP has a claim-like lifecycle, but the inspected baseline does not establish a separate canonical `ClaimSpec → established claim → single settlement` abstraction with explicit finality, amendment and replay semantics. Do not assume Claim PRE-RICH semantics transfer unchanged. |
| **EXP-06 — Evidence-as-Input** | Treat receipts, artifacts, verifier verdicts, challenges, runtime attestations and JEV records as typed inputs to admission/settlement | SPEC requires an Evidence Package bound to task, manifest, worker/runtime, artifacts, input commitments, timestamps and verifier; Compute Reciprocity states that a signed receipt is not proof of correct computation; JEV is an evidence registry, not authority | **Architectural, with important gaps.** The conceptual separation is strong. Production verifier independence, data availability, provenance/freshness policy, real receipt reconstruction and evidence-to-settlement conformance remain open. Evidence must never promote itself or grant authority. |
| **EXP-07 — regime / hysteresis** | Potentially model mesh capacity/service regimes: available, constrained, congested, degraded, recovery; separately, any economic exposure regime | Resource Manager draft covers admission, leases, preemption, thermal/power and concurrency; Compute Reciprocity notes variable capacity and experimental scheduling | **Open as a regime controller.** No Cormia hysteresis/regime state machine was found. This is a candidate domain adaptation, not a reason to import PRE-RICH's 8/4/4 controller. It may be unnecessary for the first local-only Runtime. |
| **EXP-08 — netting / offset** | Potentially offset compatible economic obligations or account for earned/spent CRC | Compute Reciprocity defines receipts and off-chain accounting; group balance pooling is explicitly open in the draft | **Open.** Earn/spend accounting is not obligation netting. Define gross obligations, compatibility, consent, protected-claim exclusions, temporal scope and atomic settlement before any netting. Do not use netting to erase funded task obligations. |
| **EXP-09 — novation** | Replace a worker or verifier, or transfer an already-established contractual obligation after failure/exit | AEP has assignment, cancellation/exit, failure, expiry, dispute and recovery concepts; worker selection method remains open | **Open.** Reassignment is not automatically novation. Define whether the original worker remains liable, what consent/assumption is required, which evidence/commitments survive, and how funded terms and claims are preserved. |
| **EXP-10 — risk budget** | Separate local operational limits from economic exposure: CPU/GPU/RAM/network/time/retry/concurrency versus escrow, bonds, outstanding claims and shared-pool exposure | ADR-0010 proposes resource/retry/time budgets; SPEC defines requester escrow and worker/verifier/challenge bonds; Resource Manager governs local resource leases/admission; economic magnitudes and risk-pool policy remain open | **Partial, with a critical type distinction.** Operational admission limits are not an economic risk budget. AEP still needs a named authority, scope, horizon, reservation/release, aggregation and concurrency policy for economic exposure. Do not reuse IMMORTAL's economic constants without an explicit profile decision. |
| **EXP-11 — allocation** | Select workers/verifiers and allocate scarce compute, sponsored capacity, task queues and shared resource budgets | SPEC leaves first-accept/auction/matching open; Compute Reciprocity says scheduler weights are experimental and calls out fairness across heterogeneous nodes; sponsored capacity has quotas and funding visibility | **Open.** Need a deterministic, auditable allocation policy with fairness/anti-starvation, quota, eligibility, conflict and replay rules. Do not let worker self-selection or a scheduler silently allocate economic authority. |
| **EXP-12 — observer / authority separation** | Separate telemetry/observation, evidence production, independent verification, task authorization, economic admission and settlement | Architecture says the model proposes but the deterministic policy engine authorizes; verifier cannot move escrow; PNC proposal separates normative source pinning from operational mandate and grants zero capabilities | **Architectural, not closed.** The boundary is explicit in documents and PNC reference work, but trusted authority bootstrap, signed consent, revocation/anchor persistence, PNC-to-mandate binding and actual Runtime enforcement remain incomplete. An observer or model must never become its own authority. |

## 5. Critical distinctions to preserve

### 5.1 Operational budget is not economic risk budget

Cormia already has a useful operational resource boundary: CPU/GPU/RAM/network/disk budgets, leases, admission control, preemption and concurrency. This governs safe local execution.

EXP-10's economic risk budget is different. It concerns aggregate economic exposure, outstanding claims, escrow/bonds, shared capital or pool limits, reservation and release, and competing commitments. One cannot substitute for the other.

### 5.2 CRC accounting is not netting

Compute Reciprocity receipts may support earned/spent usage accounting. That does not prove a legal/economic netting relation between obligations. CRC is described as non-transferable access accounting in the initial design; it must not silently become a fungible asset or offset protected task claims.

### 5.3 Reassignment is not novation

Changing the worker selected to execute a task does not automatically transfer the original worker's accepted obligations to another worker. The task contract must say whether the first worker is discharged, whether the replacement accepts the same scope/terms, and how already-submitted evidence and accrued claims are treated.

### 5.4 Verifier verdict is not authority

A verifier supplies an evidence-bound verdict under a declared profile. It does not acquire authority to change the manifest, authorize itself, or transfer escrow outside protocol settlement rules. Likewise, model output, telemetry and a signed receipt are not self-authenticating permission.

### 5.5 PRE-RICH controller is not a Cormia default

EXP-07 identifies a reusable problem family, not a mandate to reuse PRE-RICH's state machine, coefficients, thresholds or semantics. Cormia's capacity regimes, if required, need their own evidence, model and profile.

## 6. Cross-domain economic boundary — unresolved decision

Cormia AEP's draft SPEC defines requester escrow, worker/verifier/challenge bonds, verifier reward, possible protocol fee and settlement. IMMORTAL has its own normative economic kernel, obligation/exposure model and composition gates.

Before wiring these together, one explicit architecture decision is required:

**Option A — Cormia economic profile/adapter under IMMORTAL.** Cormia retains task execution and manifest semantics; economic commitments that fall under IMMORTAL's jurisdiction are mapped to canonical IMMORTAL obligations/exposures and pass the applicable IMMORTAL gate. The mapping must preserve task/asset/profile identity and must not invent values or bypass protected obligations.

**Option B — explicitly independent Cormia AEP economic jurisdiction.** Cormia defines its own complete solvency, protection, accounting, dispute and settlement perimeter for the resources it controls. The boundary must state what is outside IMMORTAL and prevent both systems from independently claiming authority over or protecting the same resource.

This crosswalk does **not** choose between A and B. It does establish three constraints:
1. No duplicate or contradictory solvency/protection accounting for the same resource.
2. No automatic import of PRE-RICH constants, asset valuations, payout/expiry rules or governance parameters into Cormia.
3. Local, private or non-economic Cormia tasks that create no externally governed economic obligation and do not use an IMMORTAL-governed shared economic resource need not call the IMMORTAL economic gate.

This is a blocking architecture decision for economic integration, not a blocker to local Runtime engineering.

## 7. Proposed conformance backlog

These are proposed test obligations, not implemented tests or normative decisions.

| Test family | Minimum positive/negative evidence |
|---|---|
| **CORMIA-EXP-01** | Classify each obligation with source, subject, beneficiary, status, horizon and priority; reject implicit ties/priority and role-derived economic authority. |
| **CORMIA-EXP-02** | Verify deadlines/windows/expiry against the declared clock and exact boundaries; reject stale, missing or mismatched temporal evidence; prove defined timeout recovery. |
| **CORMIA-EXP-03** | Bind asset identity and eligible set to manifest/profile; reject unqualified assets, missing valuation provenance or treating CRC as cash/settlement asset. |
| **CORMIA-EXP-04** | Compose capability, assurance, verifier, resource and privacy profiles deterministically; reject conflicts, unpinned versions and privilege/assurance widening. |
| **CORMIA-EXP-05** | Establish a claim only from the funded manifest and required evidence; reject entitlement mutation, duplicate claim, replay and second settlement. |
| **CORMIA-EXP-06** | Reject missing, stale, mismatched or self-promoted evidence; bind every verdict to exact task, manifest and artifact; preserve inconclusive versus invalid. |
| **CORMIA-EXP-07** | If a mesh regime controller is needed, test hysteresis, stale observations, direct safety contraction, safe recovery and no cross-profile parameter leakage. |
| **CORMIA-EXP-08** | Preserve gross obligations; allow offset only for explicitly compatible, authorized claims; reject offset of protected or disputed claims and concurrent double consumption. |
| **CORMIA-EXP-09** | Test worker replacement/novation with explicit acceptance, liability disposition, evidence continuity, claim preservation and idempotent recovery. |
| **CORMIA-EXP-10** | Test operational resource quotas separately from economic budgets; reserve against concurrent tasks atomically; release only on defined terminal transitions; reject self-authorized budget widening. |
| **CORMIA-EXP-11** | Test deterministic worker/verifier/capacity allocation, fairness constraints, quotas, tie handling, anti-Sybil assumptions and reproducible replay. |
| **CORMIA-EXP-12** | Prove observation, verification, authorization, execution and settlement identities remain distinct; reject model/observer/verifier self-authorization and untrusted trust-root substitution. |

Every family needs positive and negative vectors. A passing structural harness is evidence only for the property it actually exercises; it is not proof of production deployment, trustworthiness of a key provider, economic solvency or full AEP conformance.

## 8. Recommended order

1. **Keep the PNC/mandate track separate and complete its own review.** PR #1 is the current proposal for ADR-0011 and PNC-bound mandate v0.2. Do not duplicate or rewrite that work in the EXP branch. Resolve its contract/test findings on its own branch.
2. **Resolve economic jurisdiction before economic composition work.** Decide whether AEP escrow/bonds/fees/settlement are an IMMORTAL-governed profile or an independent Cormia economic perimeter. Keep both choices open until evidence and ownership are explicit.
3. **Specify the shared contract interfaces.** Start with typed obligation, temporal, asset, profile and evidence references. Keep application-specific parameters in profiles.
4. **Prove authority and evidence boundaries.** Prioritize EXP-06 and EXP-12 because task evidence must not self-authorize and authority must not be inferred from observation.
5. **Formalize economic/resource composition.** Then work on EXP-10 and EXP-11; only after the economic boundary is decided should EXP-08/09 be designed.
6. **Add domain-specific adaptive control only when justified.** EXP-07 is not a prerequisite for the first local-only Cormia worker.

## 9. Non-regression and scope

This crosswalk:
- does not change IMMORTAL normative law or any PRE-RICH parameter;
- does not change AEP `SPEC.md`, schemas, settlement policy or ADRs;
- does not activate ADR-0011 or a PNC;
- does not change the active PR #1 or its branch;
- does not implement a mesh scheduler, risk engine, netting or novation;
- does not establish that Cormia is AEP-conformant or production-ready;
- does not assert scientific novelty or a unified theorem.

The next revision should be driven by source changes, an explicit architecture decision, or new conformance evidence—not by relabeling a proposal as implemented.

## 10. Source register

**Follow-up boundary and formal conformance contract**

The detailed AEP–IMMORTAL economic-jurisdiction boundary and the four priority EXP contract sets are now specified in [CORMIA_AEP_IMMORTAL_ECONOMIC_JURISDICTION_AND_EXP_CONFORMANCE_v0.1.md](./CORMIA_AEP_IMMORTAL_ECONOMIC_JURISDICTION_AND_EXP_CONFORMANCE_v0.1.md). It formalizes the C0–C4 economic-perimeter classification, AEP→IMMORTAL request/result semantics, C-COMP triggers, and proposed invariants/test vectors for EXP-06, EXP-12, EXP-10 and EXP-11. It remains a research proposal, not normative adoption or implementation. A bounded Python reference model for EXP-06/12/10/11 was added in the same PR; its 15 tests passed in [GitHub Actions run #4](https://github.com/LiberoNuvola/Cormia/actions/runs/41528325294) at e59f4cf35eef43304f4eaec0aeff56184a77307f. This is bounded evidence for the abstract model only, not a full-state model check, TLA+/Quint proof or production conformance.

**Cormia**
- [SPEC.md — Task Manifest, lifecycle, capability, escrow, CRC, Evidence Package and Runtime](https://github.com/LiberoNuvola/Cormia/blob/main/SPEC.md)
- [Architecture and authority boundaries](https://github.com/LiberoNuvola/Cormia/blob/main/docs/architecture/ARCHITECTURE.md)
- [ADR-0010 — Project Mandate and Runtime-managed authority](https://github.com/LiberoNuvola/Cormia/blob/main/docs/adr/0010-autonomous-project-delegation-and-runtime-authority.md)
- [ADR-0009 — host key, consent and revocation anchor proposal](https://github.com/LiberoNuvola/Cormia/blob/main/docs/adr/0009-proposed-local-authority-bootstrap-consent-and-revocation-anchor.md)
- [Compute Reciprocity](https://github.com/LiberoNuvola/Cormia/blob/main/docs/economics/COMPUTE_RECIPROCITY.md)
- [Integration Baseline](https://github.com/LiberoNuvola/Cormia/blob/main/docs/architecture/INTEGRATION_BASELINE_2026-11-02.md)
- [PR #1 — proposed ADR-0011 / PNC and PNC-bound mandate reference work](https://github.com/LiberoNuvola/Cormia/pull/1)

**IMMORTAL / EXP**
- [Notion — Algorithmic Governability / EXP register](https://app.notion.com/p/3e3c4454d6d58136a85cfcdbc0e287f3)
- [Notion — Open Decisions & Roadmap](https://app.notion.com/p/3d9c4454d6d581738bf2c461a8694a2e)
- `IMMORTAL_Cormia_Boundary_Spec_Research_Draft_v0.1.md` — existing research draft in the user's Library; non-normative.
- EXP definitions and maturity are taken from the current IMMORTAL EXP register; the Cormia mapping/status judgments are this crosswalk's comparative assessment.
