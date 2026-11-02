# Cormia AEP ↔ IMMORTAL: Economic Jurisdiction Boundary & EXP-06/12/10/11 Conformance Contract v0.1

- **Date:** 2026-11-02
- **Status:** Research / architecture proposal; non-normative, not adopted or implemented
- **Cormia baseline:** LiberoNuvola/Cormia main at b699b20de01c4c81fc7636a555e2ce382ce52987
- **Crosswalk:** [IMMORTAL–Cormia EXP Generalization Crosswalk v1.0](./IMMORTAL_CORMIA_EXP_GENERALIZATION_CROSSWALK_v1.0.md)
- **Related PRs:** [Cormia PR #1 — PNC / ADR-0011](https://github.com/LiberoNuvola/Cormia/pull/1); [Cormia PR #2 — EXP crosswalk](https://github.com/LiberoNuvola/Cormia/pull/2)
- **Purpose:** specify a testable economic boundary and conformance obligations for EXP-06, EXP-12, EXP-10 and EXP-11 without changing either protocol's semantics.

## 1. Executive result

The current source set supports a clear separation of responsibilities:

1. **Cormia AEP owns work/task semantics:** Task Manifest, worker and verifier roles, task lifecycle, capability-bounded execution, resource scheduling, privacy, task delivery, challenge and the application-level outcome.
2. **IMMORTAL owns economic admissibility only for the economic perimeter governed by IMMORTAL:** representation of accepted obligations and material exposure, protection, viability, economic gate and admissible economic state transitions.
3. **An adapter owns concrete realization:** chain-specific serialization, observation/evidence transport, transaction construction, settlement mechanics and native chain execution cost. It does not become a second economic authority.
4. **Evidence and observation do not create authority:** receipts, JEV entries, monitor output, model output and verifier statements are typed inputs to protocol decisions; none can grant capability or authorize itself.

This follows the IMMORTAL Constitution's root requirements: accepted obligations and material unresolved exposure must be represented before the creating action is executable; protected capital cannot become discretionary surplus; execution requires a certified concrete kernel; and economic changes are atomic. The normative C-COMP further rejects automatic composition of local safety guarantees when economic resources or obligations are shared.

**Recommended integration default:** when an AEP task creates asset-denominated escrow, bonds, compensation, fees, claims or exposure against resources/capital within an IMMORTAL-governed deployment, model the AEP economics as a versioned Cormia application economic profile and route every economically material transition through the applicable IMMORTAL admission gate. Keep AEP task execution and task outcome determination in Cormia.

**Not decided:** whether an entirely separate Cormia AEP deployment, with no shared IMMORTAL resources, reserves, collateral, obligations or economic claims, should operate as an independent economic jurisdiction. That would be a separate protocol/deployment perimeter with its own complete safety and solvency model; it must not be described as IMMORTAL-conformant merely because it reuses Cormia AEP.

No numerical economic parameter, CRC conversion, bond amount, verifier quorum, scheduler weight or PRE-RICH rule is selected here.

## 2. Source-backed authority boundary

### 2.1 IMMORTAL normative requirements

The current IMMORTAL Constitution (root normative authority, v3.0.0) establishes:

- accepted obligations and economically material unresolved exposure must be represented before the action that creates or accepts them becomes executable;
- unrepresentable exposure blocks execution;
- RawSurplus = max(0, EEV - ProtectedCapital);
- execution must be gated by a declared certified concrete kernel;
- the environment perimeter E and residual risk must be declared; Omega cannot be narrowed by caller, adapter or operator;
- economic state transitions commit atomically;
- individually conforming systems do not automatically compose.

The [normative Composition Contract v3.0.0](https://github.com/LiberoNuvola/Immortal-Protocol/blob/97b09a38742098f17a61eb07734c401aeedccc06/docs/01-contracts/15_COMPOSITION_CONTRACT.md) applies to economic interaction between an IMMORTAL deployment and another IMMORTAL instance or external economic system. Its X1–X7 conditions include:
- compatible declared environments and perimeters;
- one canonical exhaustive partition for every shared economic resource, or exclusive non-overlapping shares;
- no reduction of another system's protected content without a represented cross-system obligation;
- atomic coupled commitments, or explicit unresolved exposure in both systems until settlement;
- a certificate for the composed system;
- a joint gate covering simultaneous/concurrent combinations;
- a composed perimeter and residual-risk statement.

A product of local certificates is not automatically a joint certificate or gate. The contract's shared-reserve counterexample demonstrates why two locally admissible draws can jointly overdraw a shared reserve.

Sources:
- [IMMORTAL Constitution](https://github.com/LiberoNuvola/Immortal-Protocol/blob/97b09a38742098f17a61eb07734c401aeedccc06/docs/00-normative/01_CONSTITUTION_FINAL.md)
- [IMMORTAL Composition Contract — C-COMP](https://github.com/LiberoNuvola/Immortal-Protocol/blob/97b09a38742098f17a61eb07734c401aeedccc06/docs/01-contracts/15_COMPOSITION_CONTRACT.md)
- [IMMORTAL system map — application profile / kernel / adapter boundary](https://github.com/LiberoNuvola/Immortal-Protocol/blob/97b09a38742098f17a61eb07734c401aeedccc06/docs/IMMORTAL-SYSTEM-MAP.md)
- [Economic Canon & Parameter Boundary Register](https://app.notion.com/p/3e2c4454d6d581e39ad6e764d162dbd7)

### 2.2 Cormia responsibilities

Cormia retains:
- task identity, manifest, acceptance criteria, task state and immutable funded terms;
- worker/verifier selection and performance obligations;
- local/shared workspace identity/access, Project Mandate and task child authority;
- CPU/GPU/RAM/network/disk resource scheduling, leases and user preemption;
- privacy class, prompt routing and local/remote inference;
- evidence-package construction, verifier process, challenges and task outcome;
- Compute Contribution Receipts, NUWU research and CRC use accounting, subject to the stated conversion/transfer boundaries.

The AEP Task Manifest already contains the budget asset/amount, worker/verifier/challenge bond profiles, assurance/verifier profiles, deadlines, resource profile, privacy class, cancellation/failure/dispute policy and evidence format. The AEP lifecycle determines whether a task is funded, assigned, submitted, verified, challenged, settled, failed or refunded.

Cormia's task engine must not become an alternative authority over IMMORTAL economic admissibility. Equally, IMMORTAL should not receive every prompt, workspace document, raw model history or membership record: only the evidence and economic commitments necessary for the declared economic transition should cross the boundary.

Sources:
- [Cormia SPEC — Task Manifest, economic model, evidence, verifier and Runtime](https://github.com/LiberoNuvola/Cormia/blob/main/SPEC.md)
- [Cormia Architecture](https://github.com/LiberoNuvola/Cormia/blob/main/docs/architecture/ARCHITECTURE.md)
- [Cormia Compute Reciprocity](https://github.com/LiberoNuvola/Cormia/blob/main/docs/economics/COMPUTE_RECIPROCITY.md)
- [Cormia Integration Baseline](https://github.com/LiberoNuvola/Cormia/blob/main/docs/architecture/INTEGRATION_BASELINE_2026-11-02.md)

### 2.3 Application profile and adapter

The economic profile declares AEP-specific task-economic semantics and parameters. It may define which task classes create which obligations, the applicable asset set, bond/reward/refund rules, time horizon, maximum exposure and task outcome mappings. These are not universal IMMORTAL constants.

IMMORTAL owns the universal admissibility meaning and decides whether a candidate economic transition is admissible within its perimeter. The profile supplies application parameters and mappings. The adapter realizes the admitted transition on the target environment and supplies chain-specific observations, costs and settlement evidence.

The Economic Canon Register distinguishes universal semantics of obligations, bounded exposure, ProtectedCapital, RawSurplus, liability-first protection and the Economic Gate from application-specific values such as PRE-RICH's 500× payout bound. Cormia must not inherit PRE-RICH's 500, KA/KC/KD, ticket ladder, expiry or payout mechanics.

## 3. Economic perimeter classification

This classification is proposed as a routing rule for task/economic classes. It is not a new AEP schema.

| Class | Cormia activity | Economic ownership / admission |
|---|---|---|
| **C0 — local non-economic work** | Private local document, workspace, local inference or coding task; no external economic obligation and no IMMORTAL-governed shared resource | Cormia Runtime/AEP only. No IMMORTAL gate is required. |
| **C1 — reciprocal compute usage** | Signed contribution receipts and internal usage accounting for non-transferable, non-cash-redeemable CRC | Cormia Compute Reciprocity profile owns the usage-accounting semantics. A receipt is evidence of a claimed service event, not proof of correct execution. It must not silently become cash, collateral or an external economic claim. |
| **C2 — asset-denominated AEP task contract** | Requester escrow, worker/verifier/challenge bonds, verifier reward, refund, protocol/task fee or other funded economic entitlement | In an IMMORTAL-governed deployment/perimeter, map these into profile-defined obligations/exposures and obtain IMMORTAL admission before the transition creates or accepts them. Cormia keeps task lifecycle and outcome determination. |
| **C3 — shared or cross-system economic resource** | AEP and IMMORTAL share reserve, collateral, liquidity, treasury, sponsor pool, economically relevant oracle/input or coupled obligation | C-COMP applies. Require a canonical exhaustive resource partition or exclusive non-overlapping shares, cross-system atomicity or mirrored unresolved exposure, joint certification and joint gate. |
| **C4 — isolated independent AEP economic deployment** | Cormia AEP operates with its own segregated resources, collateral, claims, settlement and economic state, with no IMMORTAL-governed resource or obligation | Possible only as an explicitly declared independent deployment/jurisdiction with its own complete safety, solvency, protection, evidence and dispute rules. It must not use or claim IMMORTAL's certificate, protected capital or economic gate. **Open decision; not adopted.** |

### 3.1 CRC reclassification triggers

The C1 treatment depends on preserving the current draft boundary: CRC is a non-transferable internal usage entitlement with no cash redemption in v1. The following changes require reclassification and a fresh economic review:
- CRC becomes transferable or exchangeable;
- CRC becomes redeemable for money or an asset;
- CRC is accepted as collateral for asset-denominated obligations;
- CRC creates a third-party claim enforceable against an IMMORTAL-governed pool;
- CRC usage is backed by a shared economic resource already protected or allocated by IMMORTAL.

A Compute Contribution Receipt with state provisional, challenged or rejected must not create spendable CRC. A signed receipt proves the signature/claim, not that the claimed hardware work was correct.

### 3.2 AEP fee versus IMMORTAL Protocol Usage Fee

The AEP SPEC lists an optional task/protocol fee in its funded manifest. The IMMORTAL fee workflow establishes the separation:
- IMMORTAL defines the economic semantics of one Protocol Usage Fee;
- the Adapter realizes settlement;
- chain-native execution cost remains distinct;
- TotalCost = ProtocolUsageFee + ChainExecutionCost;
- a second IMMORTAL Protocol Usage Fee for the same transition must not be introduced by the Adapter.

Therefore, for an IMMORTAL-governed AEP profile, the fee mapping must identify whether the AEP fee is the same Protocol Usage Fee or a separately defined task-contract distribution. It must identify its beneficiary, funding point, economic effect and settlement condition, and prove there is no duplicate fee on the same transition. The name "protocol fee" in an AEP manifest is not enough to determine semantic identity.

The fee target, amount, asset conversion, oracle, rounding and affordability policy are not selected by this document.

Source: [IMMORTAL Economic Usage Fee & Adapter Settlement Workflow v0.1](https://app.notion.com/p/3e0c4454d6d581f9b78fd05de6ea7763).

## 4. AEP ↔ IMMORTAL economic interface

The following is a conceptual typed interface, not an approved JSON schema.

### 4.1 Request: Cormia → IMMORTAL

For each economically material transition within IMMORTAL jurisdiction, the request must bind:

| Field group | Required meaning |
|---|---|
| Identity and scope | Cormia/AEP deployment ID, declared economic jurisdiction, profile ID/version, task ID |
| Contract | Exact Task Manifest canonical digest and the funding-time economic terms/profile version |
| Transition | AEP event ID, transition type, prior canonical economic state reference, candidate post-state/transition commitment |
| Obligations | Stable obligation IDs, subject/debtor, beneficiary/creditor, asset, maximum amount, trigger/condition, maturity/expiry, priority/class, status and discharge rule |
| Exposure | Worst-case unresolved exposure under the declared profile and the horizon/perimeter used; any statistical assessment kept separately typed |
| Resource partition | Canonical resource ID, owner/arbiter, share/partition, other systems with visibility and any coupled obligation reference |
| Evidence | Exact references/digests for task delivery, receipts, verifier verdict, challenge outcome, source provenance and timestamps |
| Replay/concurrency | Unique transition/idempotency identity, predecessor reference and concurrency/replay protection |

Only the minimum necessary inputs should cross the boundary. Private prompts, raw workspace contents and model chat history do not become economic inputs merely because an economic settlement is requested.

### 4.2 Result: IMMORTAL → Cormia

The result must be typed and machine-verifiable and distinguish:
- admission / rejection / insufficient-evidence or unresolved state;
- gate and certified-kernel identity/version;
- application profile/ruleset identity/version;
- prior and resulting canonical economic state/transition reference;
- obligations and exposures accepted/rejected/remaining;
- protection/resource-partition result and any joint-gate reference;
- exact failed predicates, missing evidence or unresolved conditions;
- replay/idempotency result.

A text response from a model, Runtime, verifier, observer or adapter is not an authoritative gate result. Cormia must not convert unknown, timeout or unverified gate output into positive admission.

### 4.3 Transition protocol

For an IMMORTAL-governed economic transition:

1. AEP validates the signed, funded Task Manifest and the requested task-state transition.
2. The relevant evidence is collected and classified; a verifier outcome is accepted only under the declared assurance profile.
3. Cormia constructs the economic request, mapping the transition's complete obligations, exposure and resource effects.
4. IMMORTAL evaluates the candidate against authoritative state, declared Omega, certified kernel, protection and applicable C-COMP joint gate.
5. If admitted, the coupled state/economic commitments are committed atomically; if atomic cross-system commitment is not available, the obligation/exposure remains represented in both systems until settled.
6. The chain adapter serializes and submits the already-admitted transition; it cannot reinterpret its economic meaning.
7. Cormia records the canonical transition reference and closes the AEP task state only when AEP lifecycle conditions and economic settlement conditions are both satisfied.

No positive economic settlement is permitted on missing/stale evidence, unavailable gate, unresolved challenge, state mismatch, stale predecessor, unrepresented obligation or resource-accounting conflict.

## 5. EXP-06 — Evidence-as-Input conformance contract

### 5.1 Evidence object classes

Cormia must distinguish, at minimum:
- **observation:** raw or normalized information collected by a tool, node, host, chain or observer;
- **claim/receipt:** a signed statement that an event or service occurred;
- **integrity commitment:** digest binding exact task, manifest, input, output or artifact;
- **verification result:** verifier-produced verdict under a specific assurance profile;
- **challenge/dispute evidence:** evidence supporting a contested outcome;
- **protocol outcome:** deterministic AEP state transition derived from permitted evidence and manifest;
- **economic admission/settlement reference:** authoritative economic result when IMMORTAL jurisdiction applies.

A record's presence in JEV or an Evidence Package does not promote it to an independent proof or authorization.

### 5.2 Required invariants

| ID | Invariant | Required result |
|---|---|---|
| EVI-01 | Subject binding | Every evidence item binds the exact task ID, manifest digest, attempt/delivery and artifact version it supports. |
| EVI-02 | Provenance | Producer identity, source, tool/runtime/profile version, timestamp/slot, digest and derivation are recoverable. |
| EVI-03 | Typed assurance | A receipt, hash, test result, attestation, verifier verdict and proof are not interchangeable; each is evaluated only against the property it establishes. |
| EVI-04 | Non-promotion | Evidence cannot self-promote to protocol authority, task completion, spendable CRC or economic admission. |
| EVI-05 | Freshness and replay | Stale, duplicate, replayed, mismatched or invalidly ordered evidence cannot satisfy a fresh transition. |
| EVI-06 | Independent verification | Where the profile requires independent verification, worker/requester/verifier independence and conflict assumptions are checked; distinct keys alone do not prove independence. |
| EVI-07 | Inconclusive handling | Inconclusive, invalid and failed remain distinct outcomes with declared recovery paths. Missing data is not automatically proof of fraud. |
| EVI-08 | Settlement binding | The final settlement references the exact delivery, verifier/outcome, challenge status, funded manifest and admitted economic transition. |

### 5.3 Minimum negative/positive vectors

- Worker-signed receipt with false or unverified workload measurement → claim only; no spendable CRC/settlement.
- Receipt marked provisional/challenged/rejected → no spendable CRC.
- Evidence from manifest digest A presented for task/manifest B → reject.
- Test PASS for artifact A followed by replacement with artifact B → no payment for B without a new commitment and verification.
- Verifier verdict without the required evidence/profile/quorum → inconclusive or reject; no direct escrow movement.
- Duplicate receipt/settlement event → idempotent rejection; no second credit/payment.
- Observer/JEV record only, with no AEP transition and no economic gate result → no authority or settlement.
- Missing, stale or unclassifiable evidence → fail closed for economic settlement.
- Correctly bound evidence, valid assurance profile, challenge closed and gate admitted → permit only the specific transition justified.

## 6. EXP-12 — Observer / Authority separation contract

### 6.1 Role separation

| Role | May do | Must not do |
|---|---|---|
| Observer / telemetry source | Read, measure, collect and report observations | Grant capabilities, decide task outcome, authorize settlement or mutate canonical state |
| Evidence builder / JEV | Normalize, bind and store claims/evidence | Certify truth, grant authority, issue credits or admit economic transitions |
| Worker / model | Propose plan and perform bounded task actions | Widen its grant, rewrite manifest/budget, sign as requester, decide independent verdict or authorize economic action |
| Verifier | Evaluate exact delivery against declared assurance profile and issue verdict/evidence | Change funded manifest or directly transfer escrow |
| Cormia AEP task engine | Enforce task lifecycle, capability and accepted task outcome | Override IMMORTAL economic gate or treat a verifier/observer message as economic authority |
| Cormia Runtime / host policy | Enforce Project Mandate, task child authority, workspace and resource limits | Infer authority from model output or widen the human-approved mandate |
| IMMORTAL Economic Gate | Decide admissibility of economic transitions in its declared perimeter | Schedule workers, inspect private prompts unnecessarily, control workspaces or decide community membership |
| Chain adapter / ledger submitter | Serialize, transport and execute admitted transitions; report chain costs/evidence | Redefine obligations, weaken protection, create a second economic authority or self-certify the gate |

PNC, if adopted, records normative sources and boundaries but grants zero capabilities. Project Mandate grants bounded operational authority; Task Manifest narrows it. Neither a PNC digest nor an agent identity is itself an operation grant.

### 6.2 Required invariants

| ID | Invariant | Required result |
|---|---|---|
| AUT-01 | No model authority | Model output cannot authorize its own action or alter its effective mandate/capabilities/budget. |
| AUT-02 | Attenuation | Every task/subtask child grant is a subset of parent mandate, task scope and host policy. |
| AUT-03 | Role non-equivalence | Observation, evidence creation, verification, task authorization, economic admission and settlement are distinct authority classes. |
| AUT-04 | Verifier containment | Verifier may submit a verdict but cannot mutate manifest or transfer escrow. |
| AUT-05 | Adapter containment | Adapter cannot widen the economic action set or substitute its own gate. |
| AUT-06 | Trust-root binding | A mandate/PNC/identity mismatch, stale source pin or unverified consent cannot authorize operation. |
| AUT-07 | Independence discipline | One actor represented under multiple labels does not become independent evidence or multiplied authority. |
| AUT-08 | Selective suspension | A conflict blocks the affected task/dependency chain; independent in-scope tasks continue unless a trust-root/perimeter failure makes isolation unsafe. |

### 6.3 Minimum negative/positive vectors

- Observer returns a high-confidence measurement but lacks authorization → observation only; action denied.
- Model proposes widening its file/network/resource scope → denied.
- Child grant contains any capability outside the parent/host intersection → denied.
- Verifier attempts direct escrow movement or manifest amendment → denied.
- Adapter returns a different economic parameter/profile from the accepted gate request → reject.
- PNC identity changes between task planning and operation authorization → suspend affected task and revalidate; no silent switch.
- Same operator supplies worker, verifier and observer identities → apply profile independence/conflict rules; do not count as independent solely due to separate keys.
- One task hits a protected human-authority trigger → suspend that task/dependent subgraph, not unrelated authorized work.

## 7. EXP-10 — Risk budget and economic exposure contract

### 7.1 Two budgets, two owners

**Operational resource budget — Cormia Runtime / Resource Manager**
- CPU/GPU/RAM/VRAM/network/disk;
- concurrency, lease duration, retry/attempt limits and timeouts;
- user preemption, thermal/power constraints and local availability;
- sandbox/worktree and execution profile limits.

**Economic exposure budget — IMMORTAL profile/gate where within IMMORTAL jurisdiction**
- requester escrow and refund obligations;
- worker/verifier/challenge bonds and contingent release/forfeiture;
- verifier reward, task reward and any fee obligation;
- outstanding accepted claims and unresolved exposure;
- shared pool, collateral, liquidity and cross-system commitments;
- worst-case exposure and any separately declared statistical risk assessment.

A CPU/GPU lease does not prove solvency. An escrow amount does not impose a local CPU quota. Neither budget may be silently converted into the other.

### 7.2 Required invariants

| ID | Invariant | Required result |
|---|---|---|
| RSK-01 | Complete obligation coverage | Every funded/accepted economic obligation and material unresolved exposure is represented before its creating transition executes. |
| RSK-02 | Unique resource partition | A shared resource is represented once in one exhaustive canonical partition or in exclusive non-overlapping shares. |
| RSK-03 | No concurrent overcommit | Concurrent funding/assignment/settlement candidates are evaluated against the same authoritative predecessor or a certified joint state; stale local approvals do not stack. |
| RSK-04 | Atomic reservation/release | Economic reserve is committed/released only through defined atomic lifecycle transitions; timeout/partial commit leaves explicit unresolved exposure. |
| RSK-05 | Non-overlapping protection | Escrow, bonds, refunds, fees and contingent claims have stable IDs and non-overlapping accounting treatment; the same resource is not counted twice as available capital. |
| RSK-06 | Profile-parameterized exposure | Exposure bound, statistical model, horizon and risk assumptions are supplied by the declared profile; no PRE-RICH numerical constant is imported as universal law. |
| RSK-07 | ProtectedCapital separation | Where IMMORTAL protects the resource, ProtectedCapital includes the authoritative applicable obligations/protection exactly once; no allocator may consume protected capital. |
| RSK-08 | Fail closed | Missing state, unrepresentable exposure, failed gate, stale state or uncertain resource ownership blocks the affected economic commit. |

### 7.3 No invented risk formula

The crosswalk does not set a universal risk-budget formula or numerical threshold. IMMORTAL's canonical semantics require bounded obligations/exposure, liability-first protection, ProtectedCapital, RawSurplus and admissibility. The profile determines contextual bounds and any statistical assumptions. Worst-case and statistical risk are distinct mechanisms; they are not automatically additive or interchangeable.

### 7.4 Minimum negative/positive vectors

- Two tasks each locally consume a reserve unit that is shared and has only one unit available → individual local gates are insufficient; joint gate rejects the simultaneous pair.
- Funding a task creates an obligation absent from the canonical record → reject before Open/Assigned.
- Same reserve/collateral counted in AEP and IMMORTAL protection as separate available resources → reject double count.
- Operational Resource Manager reports capacity available while economic gate denies exposure → economic transition remains denied.
- Economic gate admits a bounded claim while host CPU budget denies compute execution → no worker execution; economic admission is not a compute lease.
- A profile changes its exposure bound without updating the funded manifest/profile version → reject retroactive rewrite; use new task/amendment process allowed by protocol.
- Gate timeout or stale predecessor → no positive economic commit.
- Task closes with a valid refund/settlement transition → release only the matching reservation/obligation after terminal conditions; do not release unrelated protected claims.

## 8. EXP-11 — Allocation contract

### 8.1 Ownership

Cormia AEP/Runtime owns:
- task eligibility and worker/verifier selection policy;
- matching, queueing and scheduling;
- local resource reservations and donation leases;
- sponsored-capacity quotas;
- privacy-compatible routing and worker availability;
- fairness/anti-starvation policy within declared profiles.

IMMORTAL does not choose which worker should execute a task. It may gate an allocation when that allocation creates or changes an economic obligation/exposure or consumes a shared IMMORTAL-governed economic resource. The scheduler's result is not itself authority to spend protected capital or pay a worker.

### 8.2 Required invariants

| ID | Invariant | Required result |
|---|---|---|
| ALC-01 | Eligibility | Allocation selects only workers satisfying the task's declared capability, assurance, resource and privacy constraints. |
| ALC-02 | Capacity reservation | A worker/resource lease is reserved before execution and never exceeds the owner's current operational budget. |
| ALC-03 | Economic gate separation | Selection/matching does not by itself create a funded economic claim or authorize payout; the relevant economic transition must pass the gate. |
| ALC-04 | Shared-pool allocation | Allocation from a shared economic/sponsored pool respects its single resource partition and the applicable joint gate. |
| ALC-05 | Deterministic decision record | Given the same canonical inputs, profile version and tie-break data, allocation outcome is reproducible or its randomness is committed/auditable under the declared profile. |
| ALC-06 | Fairness observability | Queue age, service rate, rejection, starvation and resource heterogeneity are measured before fairness weights are frozen. |
| ALC-07 | Anti-Sybil/conflict assumptions | Worker/verifier independence, duplicate identities and collusion assumptions are declared; account/key count alone is not an independence proof. |
| ALC-08 | Sponsor neutrality | Contribution/donation does not automatically grant governance power, prompt access, priority outside declared quotas or authority over other users. |

### 8.3 Open allocation parameters

The following remain open in AEP and must not be invented by this crosswalk:
- first-accept, auction, matching or hybrid selection;
- fairness weights and service-priority weights;
- sponsor allocation and quota parameters;
- anti-Sybil costs/identity assumptions;
- verifier quorum/selection and independent assurance thresholds;
- exact queue-time, epoch and audit-sampling parameters.

### 8.4 Minimum negative/positive vectors

- Worker matches task but lacks capability/privacy/assurance eligibility → reject assignment.
- Assignment would exceed worker CPU/GPU/RAM quota or current lease → reject/defer before execution.
- Scheduler chooses a worker and then tries to infer that this authorizes payment → no economic admission without evidence and gate.
- Two schedulers allocate the same non-shareable donated GPU concurrently → one lease wins; the other is rejected/deferred.
- Two AEP instances allocate the same sponsored pool without a common partition → C-COMP failure; no local scheduler approval can override it.
- Worker contribution increases reputation/CRC but not governance weight or resource ownership → no governance/capability escalation.
- Allocation policy lacks measured fairness evidence → retain as open profile parameter; do not claim fair/optimal scheduling.

## 9. Combined formal state and invariants

For future TLA+/Quint or an equivalent finite-state model, the minimum abstract state should include:

- taskState, manifestDigest, profileVersion;
- evidenceRefs, evidenceStatus, verifierOutcome, challengeState;
- obligationLedger, exposureByResource, resourcePartition;
- operationalLeases, resourceBudget, allocation;
- authorityChain, observerRole, verifierRole, gateAuthority;
- economicGateResult, economicGateVersion, settlementRef.

Minimum safety invariants to model:

1. **NoEconomicCommitWithoutGate:** an economic commit in IMMORTAL scope implies a current positive admission for that exact transition/predecessor/profile.
2. **EveryAcceptedObligationRepresented:** no task transition creates an accepted economic obligation absent from the authoritative obligation/exposure representation.
3. **NoSharedResourceDoubleCount:** one shared resource has one canonical owner/partition or provably exclusive shares.
4. **CoupledAtomicityOrMirroredExposure:** a cross-system obligation is committed on both sides or remains visible as unresolved exposure on both.
5. **NoSettlementWithoutEvidence:** settlement references exact manifest, delivery, verifier/outcome and closed challenge condition.
6. **NoRoleEscalation:** observer, worker, verifier, model and adapter cannot exercise economic-gate or settlement authority by virtue of their other roles.
7. **CapabilityAttenuation:** every child grant is contained in its parent's effective scope and host-policy intersection.
8. **OperationalBudgetInvariant:** resource use never exceeds the valid lease/quota.
9. **AllocationEligibilityInvariant:** allocated worker satisfies all profile constraints and capacity is reserved.
10. **IdempotentEconomicLifecycle:** replaying the same receipt, gate decision or settlement event cannot create a second credit/payment/obligation.

These are model/check obligations, not a claim that a TLA+/Quint model has already been built or proved.

## 10. Bounded reference-model evidence

A standalone Python reference model and standard-library test suite are present under verification/exp_boundary/. They exercise the finite abstractions above; they do not import or execute Cormia Runtime, AEP validators, IMMORTAL kernel, an adapter, or a ledger.

- [Reference model](../../verification/exp_boundary/reference_model.py)
- [15 bounded tests](../../verification/exp_boundary/test_reference_model.py)
- [GitHub Actions workflow](../../.github/workflows/exp-boundary-reference-model.yml)
- [PR run #4 — SUCCESS](https://github.com/LiberoNuvola/Cormia/actions/runs/41528325294)
- Tested branch head: e59f4cf35eef43304f4eaec0aeff56184a77307f

The 15 tests cover exact evidence/manifest/delivery/gate binding, a receipt-only negative case, capability attenuation, role-authority boundaries, adapter admission binding, concurrent shared-resource draws, canonical non-overlapping partitions, aggregate reservations, worker capability/privacy/assurance eligibility and finite worker capacity. The first CI attempt exposed an incorrect test expectation that assigned two tasks to a capacity-one worker; that assertion was corrected. The later PR run passed all 15 tests.

**Interpretation limit:** this is bounded executable evidence for the abstract reference model only. It is not an implementation conformance test, production Runtime result, full-state model check, TLA+/Quint proof, C-COMP deployment certificate, or evidence of economic solvency.

## 10. Minimal adversarial model-check scenarios

| Scenario | Attack / interleaving | Expected result |
|---|---|---|
| MC-01 | Two tasks independently pass local checks but jointly draw the same shared reserve | Joint gate rejects simultaneous pair or preserves a safe serial allocation; no double draw |
| MC-02 | Worker receipt is signed but workload execution is false/unverified | Evidence remains a claim; no spendable CRC or settlement |
| MC-03 | Verifier verdict arrives before required evidence or from conflicted identity | No accepted outcome / settlement |
| MC-04 | Model requests a wider path, network or resource scope than its mandate | Child authorization denied |
| MC-05 | Adapter substitutes a different profile/asset/fee after gate admission | Transition rejected |
| MC-06 | AEP task funding creates escrow/bond claim but gate request omits that obligation | Funding transition denied |
| MC-07 | Two independent schedulers reserve the same non-shareable worker resource | One valid lease only |
| MC-08 | Old evidence or gate result is replayed against a new manifest or state predecessor | Reject by binding/freshness/idempotency |
| MC-09 | Resource Manager allows compute but economic gate denies exposure | No economic commit; execution follows declared task cancellation/recovery rule |
| MC-10 | One Cormia and one IMMORTAL process share collateral but present separate local certificates | C-COMP joint certification and gate required; local certificates are insufficient |
| MC-11 | One actor appears as observer, worker and verifier | Do not infer independence; declared conflict/assurance policy controls |
| MC-12 | Economic gate or evidence service times out | No positive settlement; defined retry/refund/dispute path, no indefinite silent lock |

## 11. Decisions still requiring explicit adoption

| Decision | Candidate direction | Status |
|---|---|---|
| **JUR-01 — First integrated AEP economic profile** | Treat asset-denominated AEP escrow/bonds/rewards/refunds/fees backed by an IMMORTAL-governed perimeter as an IMMORTAL application profile with a Cormia adapter | **Proposed; human/project-owner adoption required** |
| **JUR-02 — Independent AEP deployment** | Permit only as a separately declared, fully isolated economic jurisdiction with its own complete safety/solvency model; no shared IMMORTAL capital/claims and no IMMORTAL-conformance claim | **Open** |
| **JUR-03 — Protocol fee identity** | One fee per economic transition; explicitly map the AEP manifest fee to IMMORTAL Protocol Usage Fee or prove a distinct task-contract distribution; chain execution cost remains separate | **Open** |
| **JUR-04 — CRC economic status** | Keep CRC as internal non-transferable/non-redeemable usage accounting until a new profile decision and economic analysis | **Current v1 draft direction; conversions remain open** |
| **JUR-05 — Resource/obligation ownership** | Canonical resource ID, owner/arbiter, share partition, obligation identity and joint transition protocol before shared-pool deployment | **Required before any shared economic deployment** |
| **JUR-06 — Allocation profile** | Choose worker/verifier selection, fairness, anti-Sybil and sponsor policy only after measurement/adversarial simulation | **Open** |

This document does not approve these decisions. JUR-01 is the recommended route for an AEP deployment that is intentionally integrated with IMMORTAL, but the project owner must explicitly adopt its economic jurisdiction and profile before implementation.

## 12. Implementation sequence

1. **Freeze no new economics yet.** Keep AEP amount/bond/fee/quorum/CRC formulas open until their source profile is decided.
2. **Define the profile mapping.** Create an AEP economic profile that classifies each Task Manifest economic field as an obligation, exposure, protected resource, refundable deposit, fee or non-economic usage right.
3. **Define the exact transition surface.** Identify which AEP transitions create, enlarge, discharge or transfer economic obligations and therefore require gate requests.
4. **Specify the shared resource partition.** Include all pools, collateral, sponsor funds, fees, oracle-dependent inputs and concurrent AEP/IMMORTAL claims.
5. **Specify typed evidence and authority boundaries.** Bind receipts, verifier outcomes, challenges, mandates and gate results to exact task/profile/state identities.
6. **Build the abstract formal model.** Encode the Section 9 variables/invariants and Section 10 interleavings; do not claim proof until model runs and traces are reviewed.
7. **Add adapter/Runtime conformance tests.** Positive and negative cases must use actual schemas and implementations when those are ready.
8. **Only then consider live economic integration or settlement.**

## 13. Non-regression

- No change to IMMORTAL Constitution, Economic Kernel, C-COMP, C-Kernel proof, PRE-RICH policy or constants.
- No change to Cormia SPEC.md, Task Manifest schema, ADR-0010 or proposed ADR-0011.
- No new numeric parameter, CRC formula, bond amount, fee target, verifier quorum or scheduler weight.
- No claim of AEP conformance, formal proof, economic solvency, production readiness or deployed cross-system gate.
- No changes to V3, Reveal, Issue or Cardano settlement.
- No automatic requirement to invoke IMMORTAL for Cormia local/private tasks outside an IMMORTAL economic perimeter.

## 14. Source register

**Cormia**
- [SPEC.md](https://github.com/LiberoNuvola/Cormia/blob/main/SPEC.md)
- [Architecture](https://github.com/LiberoNuvola/Cormia/blob/main/docs/architecture/ARCHITECTURE.md)
- [Compute Reciprocity](https://github.com/LiberoNuvola/Cormia/blob/main/docs/economics/COMPUTE_RECIPROCITY.md)
- [Integration Baseline](https://github.com/LiberoNuvola/Cormia/blob/main/docs/architecture/INTEGRATION_BASELINE_2026-11-02.md)
- [ADR-0010](https://github.com/LiberoNuvola/Cormia/blob/main/docs/adr/0010-autonomous-project-delegation-and-runtime-authority.md)
- [PR #1 — ADR-0011 / PNC proposal](https://github.com/LiberoNuvola/Cormia/pull/1)

**IMMORTAL**
- [Constitution — root normative source](https://github.com/LiberoNuvola/Immortal-Protocol/blob/97b09a38742098f17a61eb07734c401aeedccc06/docs/00-normative/01_CONSTITUTION_FINAL.md)
- [C-COMP — normative Composition Contract v3.0.0](https://github.com/LiberoNuvola/Immortal-Protocol/blob/97b09a38742098f17a61eb07734c401aeedccc06/docs/01-contracts/15_COMPOSITION_CONTRACT.md)
- [IMMORTAL System Map](https://github.com/LiberoNuvola/Immortal-Protocol/blob/97b09a38742098f17a61eb07734c401aeedccc06/docs/IMMORTAL-SYSTEM-MAP.md)
- [Economic Canon & Parameter Boundary Register](https://app.notion.com/p/3e2c4454d6d581e39ad6e764d162dbd7)
- [Economic Usage Fee & Adapter Settlement Workflow](https://app.notion.com/p/3e0c4454d6d581f9b78fd05de6ea7763)

**Cross-domain**
- [IMMORTAL–Cormia EXP crosswalk v1.0](https://github.com/LiberoNuvola/Cormia/blob/work/exp-generalization-crosswalk/docs/research/IMMORTAL_CORMIA_EXP_GENERALIZATION_CROSSWALK_v1.0.md)
- [Existing IMMORTAL–Cormia Boundary research page](https://app.notion.com/p/3e3c4454d6d58136a85cfcdbc0e287f3)
