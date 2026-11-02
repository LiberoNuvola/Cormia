# ADR-0011: Project Normative Contract (PNC)

- **Status:** Proposed target architecture — design contract only; no Runtime enforcement enabled
- **Date:** 2026-11-02
- **Depends on:** ADR-0006, ADR-0007, ADR-0008, ADR-0009 and ADR-0010
- **Primary objective:** let Cormia understand and preserve a project's existing normative boundaries while autonomously implementing, testing, repairing and evidencing work inside them

## 1. Context

ADR-0010 establishes a standing project mandate and Runtime-derived task authority. That mandate answers **what the worker may do** in a project workspace. It does not, by itself, answer **which project rules the work must preserve**, which decisions are already closed, what counts as evidence, or which semantic conflicts require the project owner's authority.

A project may have a mature normative corpus, such as IMMORTAL, where a change to implementation code is routine engineering but a change to the Constitution, economic semantics, a closed application decision or a governance boundary is not.

The Runtime therefore needs a machine-readable project-level contract describing the authoritative sources and their relationships. The contract must not become another permission token, approval prompt or model-owned policy file.

## 2. Decision

Introduce a **Project Normative Contract (PNC)** as a versioned, source-pinned, machine-readable project policy record.

The PNC is separate from, and subordinate to, the Project Mandate:

- **Project Mandate:** grants bounded operational authority to the Runtime.
- **PNC:** declares the normative sources, scope, closed decisions, invariants, evidence semantics and human-authority boundaries governing work in that project.
- **Task Manifest / child authority:** identifies the requested task and narrows the operational mandate; it cannot override the PNC.
- **Runtime host policy:** remains the enforcement authority. The model may read and reason about the PNC but cannot edit an active PNC, authorize itself, or decide that a protected change is permitted.

The PNC grants **zero capabilities**. It cannot authorize filesystem access, Git operations, network access, signing, deployment, settlement or any other action. An operation must independently pass the project mandate, task child authority, host policy and PNC semantic guard.

## 3. What a PNC records

The v0.1 contract contains:

1. **Project identity and scope:** project identifier, target repository and base reference.
2. **Immutable source snapshots:** repository identity, immutable commit SHA, resolution time and Git object format.
3. **Source registry:** source ID, path, blob SHA, authority class, governed scope, lifecycle status, version and relevant section locators.
4. **Closed decisions:** explicit statements that are considered settled for the declared scope, their source references, and the authority required to reopen them.
5. **Protected invariants:** stable identifiers, statements, source locators and required enforcement treatment.
6. **Open obligations:** known unresolved evidence or implementation obligations with their current status and evidence requirements. An open obligation is not a licence to invent a new rule or declare a blocker discharged.
7. **Evidence policy:** permitted evidence classes and explicit non-promotion rules.
8. **Human-authority triggers:** structural, normative, governance, trust, signer, protected external-action, mandate-widening and resource-expansion decisions that cannot be made by the model.
9. **Execution policy:** autonomous engineering activities, forbidden semantic actions, no per-operation approval, selective suspension and continuation of independent work.
10. **Conflict policy:** source precedence, supersession handling and fail-closed treatment of unresolved conflicts.

Source references are immutable: a branch name such as `main` is descriptive metadata only. Each source is resolved through a pinned repository commit and its Git blob SHA. A source record whose repository, commit, path or blob identity cannot be verified is stale or untrusted and cannot silently govern a task.

## 4. Normative authority and evidence are different dimensions

The PNC must not collapse every project document into one flat priority list. It distinguishes authority classes:

| Class | Purpose | May change normative meaning? |
|---|---|---|
| Root normative source | Constitution or equivalent supreme project authority | Yes, only through its own authorized amendment process |
| Universal normative specification | Canonical invariants, transition, economic and conformance rules | Defines binding requirements beneath the root |
| Application normative policy | Closed application-specific semantics and declared parameters | Only within the authority delegated by the universal layer |
| Governance / decision record | Records a decision and the process by which it became effective | Only when its validity and authority are established |
| Proof / evidence registry | Classifies proofs, obligations and evidence | No; establishes the kind and status of evidence |
| Audit / residual-status record | Reports current implementation, deployment or evidence gaps | No; reports status and does not amend the rules |
| Informative material | Navigation, rationale or background | No |

A proof, test, CI result, audit report or deployment observation cannot create or amend normative authority. Equally, a normative requirement is not implementation evidence. The PNC must preserve the distinction among mathematical proof, conditional result, normative requirement, conformance obligation, mechanical test evidence, adapter evidence and deployment evidence.

Within the same authority class, explicit version/supersession rules may resolve a conflict only when the source itself establishes that relationship. Otherwise the Runtime records a typed conflict and escalates it. A lower-authority source may not override a higher-authority source. A status report may show that an obligation is open; it may not waive that obligation.

## 5. Autonomous implementation inside normative boundaries

The PNC is designed to preserve autonomy, not prevent work on important code.

When an existing specification clearly determines the required behavior, Cormia may autonomously:

- implement or correct code that conforms to the pinned specification;
- refactor validators, adapters, builders, observers and DApp code without changing their normative semantics;
- add positive, negative, property-based and regression tests;
- repair test fixtures and test harnesses without falsifying the expected result;
- execute allowed builds, simulations and verification profiles;
- collect and classify evidence without promoting it beyond what it establishes;
- prepare feature-branch commits and pull requests, when separately permitted by the mandate;
- produce a proposal for a normative change without applying it to the active source of authority.

A change to code that implements a normative rule is **not** automatically a normative change. The question is whether the change preserves the rule's meaning. If the specification is clear and the implementation is wrong, the agent fixes the implementation. If two authoritative sources conflict, a rule is underspecified in a materially consequential way, or the requested outcome requires changing a protected invariant or closed decision, Cormia must not guess.

The PNC must never be used to justify weakening a validator, narrowing an authoritative uncertainty envelope, changing an economic constant, changing a payout or expiry rule, suppressing a failed check, relabeling evidence, or claiming a theorem or deployment certificate that has not been established.

## 6. Human-authority boundary

The following are human-authority decisions unless a separate explicit authority process is already defined and verified by the project:

- amendment, weakening, replacement or withdrawal of a root or canonical normative source;
- reopening a decision recorded as closed;
- changing protocol, economic, safety, transition, accounting or application semantics;
- resolving a material conflict between authoritative sources where no deterministic precedence exists;
- changing the project architecture in a way that alters protocol/application/adapter boundaries or trust assumptions;
- adding or changing a signer, governance authority, trust root or deployment authority;
- approving a new external economic action, wallet signature, fund transfer, Cardano settlement, production deployment or protected release;
- widening or renewing the standing mandate, workspace, network, resource budget or protected-action set;
- accepting an unverified source, changing the normative source registry, or adopting a new normative baseline.

The agent must prepare an escalation dossier containing the exact affected sources and locators, conflict or proposed change, evidence gathered, alternatives, consequences, affected tasks and the narrowest decision required. It must ask one focused question and must not disguise a policy choice as an implementation detail.

A human escalation should suspend only the affected task or dependent subgraph. Independent in-scope tasks continue. A project-wide stop is justified for trust-root, source-integrity, mandate-integrity or other failures whose effects cannot be isolated safely.

## 7. Source updates and version drift

The PNC operates against pinned snapshots, not floating branches.

When a newer repository commit is detected:

1. record the new commit and compute the changed-source set;
2. compare changed paths and blob identities against the PNC registry;
3. classify changes as normative-source changes, decision-registry changes, evidence/status-only changes or unrelated implementation changes;
4. continue work against the pinned contract while the comparison is trustworthy;
5. permit evidence/status-only refresh as a separately labelled, non-authoritative overlay only when no normative source, closed decision, invariant, authority boundary or PNC schema has changed;
6. prepare a new PNC candidate and request human authority before adopting any change to a normative source, closed decision, protected invariant, source registry or authority boundary.

A newer commit is never automatically accepted as a new normative baseline. If the source diff cannot be classified reliably, the affected tasks are suspended and escalated. A source-integrity mismatch is a trust failure, not an ordinary engineering failure.

## 8. IMMORTAL reference profile

The initial example is [immortal-protocol-v0.1.json](../../examples/project-normative-contracts/immortal-protocol-v0.1.json). It pins the IMMORTAL source corpus to one observed commit of `LiberoNuvola/Immortal-Protocol` and binds each listed document to its Git blob SHA.

The example distinguishes:

- the IMMORTAL Constitution as root normative authority;
- universal economic, transition, invariant and conformance specifications;
- PRE-RICH Game Economy as application-level normative policy;
- the Formal Proof Register as an evidence-classification record;
- Verification Status, Residual Obligation Register and Audit Closure Matrix as status/evidence records.

It also records that R1–R9 remain deployment, implementation, adapter, governance or profile obligations. It does not claim that the repository implementation is formally verified or that a Preprod deployment is certified. The example is a project-contract fixture, not a new IMMORTAL normative document and not an approval to change IMMORTAL.

## 9. Integration with ADR-0010

Before autonomous project execution can be enabled, the trusted mandate store and consent flow must bind the active PNC identity and digest to the standing project mandate. The task child authority must then bind the same PNC digest (or a host-verified immutable contract version) so that a model cannot switch normative baselines between task creation and tool execution.

This binding belongs in a future version of the project-mandate schema and Runtime adapter. Do not silently add an optional model-controlled PNC reference to the current v0.1 mandate and treat it as trusted. The current v0.1 mandate schema and isolated authority tests do **not** yet load, verify, persist or enforce a PNC.

At each relevant tool boundary, the trusted Runtime must evaluate both:
- **operational authorization:** mandate ∩ task child authority ∩ host policy;
- **normative admissibility:** active PNC ∩ source integrity ∩ task's semantic change class.

The model can propose a classification, but the Runtime owns the protected-source registry and the final allow / deny / escalate result. PNC evaluation must be deterministic for the same trusted inputs and must emit an auditable reason code.

## 10. Schema, digest and trust limits

The v0.1 JSON Schema defines the data shape only. It does not establish source authenticity, GitHub trust, signature validity, effective governance, semantic consistency, proof correctness or implementation conformance.

The repository has not yet selected a canonical JSON encoding and digest profile for these project contracts. Therefore this ADR does not invent one. Before a PNC digest is signed or bound to a mandate, select and test the canonical representation, digest algorithm, domain separation and compatibility rules. Until then, the example's pinned Git commit and blob SHAs provide source identity, not a signed PNC authorization.

A PNC must be issued and activated by trusted host code after an authenticated project-owner review. The model may draft a candidate PNC but cannot activate it, change its authority class, mark a decision closed, change a source pin or sign/approve it.

## 11. Implementation plan and acceptance criteria

1. Review the PNC authority model, source classes, conflict handling and human-escalation taxonomy.
2. Validate the v0.1 PNC JSON Schema and the IMMORTAL example, including all source-set references, commit SHAs, blob SHAs and section locators.
3. Add a deterministic PNC loader that rejects floating source refs, duplicate IDs, missing source sets, wrong repository/commit bindings, blob mismatches and invalid authority-class combinations.
4. Add a source-drift classifier that distinguishes implementation-only changes, evidence/status-only changes and normative/decision changes.
5. Add deterministic policy tests for: routine implementation repair (allow), evidence collection (allow with classification), invariant weakening (escalate/deny), closed decision reopening (escalate), ambiguous same-tier conflict (escalate), stale source or blob mismatch (fail closed), evidence promotion (deny), and independent-task continuation.
6. Add PNC identity/digest binding to the next project-mandate schema version, consent intent and task child authority.
7. Integrate PNC evaluation into the reviewed Runtime capability boundary before enabling autonomous mutation.
8. Run end-to-end IMMORTAL pilot tasks, including one routine implementation repair and one deliberately normative-changing task that must stop only the affected dependency branch and produce an escalation dossier.

Acceptance means a synthetic IMMORTAL task can implement, test, repair and report a clearly specified behavior with zero per-operation human prompts, while a normative amendment, material authority conflict or invalid source pin cannot be silently applied.

## 11A. Deterministic reference implementation checkpoint (2026-11-02)

The Cormia repository now carries a reference implementation under \`scripts/pnc_runtime.py\` and deterministic tests under \`tests/test_pnc_runtime.py\`.

The reference component:
- rejects duplicate JSON object keys, validates the v0.1 schema and cross-reference/authority-class invariants;
- resolves each declared commit and file blob through an injectable read-only source adapter; its public-GitHub adapter uses unauthenticated GET requests and fails closed on lookup errors or SHA mismatches;
- requires \`status: active\` by default at the loader entry point, while allowing explicit draft loading only for validation/tests;
- classifies trusted Git changed-path facts as implementation-only, evidence/status-only, informative-only, normative-source-change or unclassified-source-change;
- treats changed, unregistered source-like documents as unclassified and escalates them;
- compares structured PNC candidates for invariant, closed-decision, source-registry, obligation-registry and authority-boundary changes;
- returns deterministic \`ALLOW\`, \`DENY\` or \`ESCALATE\` outcomes with reason codes and independent-task continuation.

The source-drift classifier consumes paths from a trusted Git adapter; it does not accept a model-authored classification. Its evidence/status-only result is a non-authoritative overlay and never updates or replaces the PNC. It does not parse arbitrary prose to prove semantic equivalence. Unregistered source-like files are therefore escalated rather than guessed.

**Trust limit:** this is a tested reference library, not an integrated Runtime boundary. The \`active\` status field is only a necessary loader condition, not proof of owner approval or authenticity. A future host must load the contract from an authenticated, owner-authorized store, bind its identity to the standing mandate and task child authority, and enforce the result at every capability boundary. The reference implementation does not define or compute a canonical PNC digest, does not sign or activate a contract, does not grant capabilities, and does not connect to the local Agent. The IMMORTAL fixture remains \`draft\`.

## 12. Non-goals and non-regression

- No change to IMMORTAL or PRE-RICH source specifications.
- No claim that the example PNC is signed, trusted, runtime-enforced or already bound to a project mandate.
- No new permission, grant, API token, signer, trust root or operator credential.
- No change to the existing mandate schema v0.1 or the current Agent approval path in this ADR.
- No automatic adoption of a newer normative baseline.
- No human approval for ordinary in-scope code changes, tests, builds, refactors or evidence collection.
- No autonomous semantic changes to normative sources, closed decisions or protected invariants.
- No merge to protected branches, production deployment, wallet signing, fund transfer or Cardano settlement authority from the PNC.
