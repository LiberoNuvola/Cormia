# Integration baseline — 2026-11-02

**Status:** repository and local-source inventory verified; five local compatibility boundaries passed Windows smoke testing; AEP Runtime integration remains proposed  
**Cormia:** public repository, branch main; initial scaffold commit fdc3e868c032257323e341ba846d169f01f34939 (three-commit history preserved)  
**IMMORTAL source branch inspected:** work/immortal-green-closure  
**IMMORTAL source HEAD observed:** cabe00f1b7743e4335b5a140b32feb52e47f2be6  
**Inspection date:** 2026-11-02

## 1. Purpose and scope

This record separates source verifiably present in GitHub from components described as running on a local workstation. It is an integration inventory, not a declaration of AEP conformance.

Cormia is a sibling project. This integration work must not rewrite, replace, or change the economic or validator semantics of Immortal-Protocol. Existing components are composed through versioned adapters. No source is vendored merely because a design document references it.

## 2. Cormia implementation status

The published Cormia tree contained 32 tracked files at the inspected initial baseline. It contains the AEP specification, design records, schemas, examples, and README files for the proposed reference worker and verifier. It does not yet contain an implemented Runtime, scheduler, peer mesh, task engine, resource manager, or verifier service. The runtime/reference-worker and verifier directories are documentation-only at this baseline.

The normative specification is a draft. A local prototype must not be described as AEP-conformant until it passes the applicable manifest, capability, lifecycle, evidence, and recovery contracts.

## 3. Verified IMMORTAL assets

| Component | Verified source / state | Cormia integration disposition |
|---|---|---|
| IMMORTAL Local Agent v0.8.0 | Documented as a local prototype at E:\AI\Immortal-Agent-v0.7. Its source is not present in either GitHub repository tree inspected. | First reference Runtime candidate. Obtain a read-only local source inventory before copying or adapting code. |
| Resource Manager / Evolution Manager | Documented as part of local Agent v0.8.0; not present as source files in the inspected IMMORTAL-Protocol branch tree. | Preserve the existing managers. First define narrow interfaces and recoverable persistent state; do not rewrite them. |
| Coding Workspace / Docker test path | Documented as a local component at E:\AI\Immortal-CodingLab\workspace with isolated candidate testing. No source was verified in Cormia. | Treat as a bounded execution adapter. Confirm actual mount, network, and privilege controls from local source/configuration. |
| Flux Point DoD pilot | Present in IMMORTAL-Protocol: .fluxpoint-gates.json, scripts/harness.sh, .github/workflows/fluxpoint-dod-pilot.yml, and docs/04-verification/FLUXPOINT-DOD-PILOT.md. The pilot records Flux Point 1.49.0 and reviewed upstream commit 175c0a79f9a998b5fe1e212b511dd490ec06f4a8, Apache-2.0. | Optional engineering-campaign / DoD adapter. It supplies evidence about declared checks; it does not grant AEP capabilities or authorize ledger transitions. Installation on each workstation must be checked separately. |
| JEV evidence registry | Present under audit/jev, including verification-registry.schema.json and registry-run-1718-attempt-2.json; generator and validator scripts are present under scripts/. The inspected schema normalizes PASS, FAIL, BLOCKED, and NOT_RUN with evidence references and limitations. | Reuse as evidence normalization only. Add a versioned AEP mapping and contract tests. JEV must not schedule workers, mint CRC, or authorize settlement. |
| Mitsuro read-only MCP bridge | Present under integrations/mitsuro: source, test, and README. Four tools are exposed: get_branch_head, get_ci_status, read_jev_registry, and read_allowed_file. The source pins Immortal-Protocol/work/immortal-green-closure, uses GitHub GET only, a path allowlist, output cap, and timeout; tests check closed schemas and traversal rejection. | Preserve as optional read-only observer. Do not broaden its repository, path, network, or write permissions in place. A Cormia observer should be a separate versioned adapter. |

### JEV evidence warning

The fixture registry-run-1718-attempt-2.json is historical. Its subject is commit e6909bcd83d4a833ecbb9f1efbdea6630873d9f1, workflow run 38615595908, execution context devnet, generated 2026-10-14. Its PASS/FAIL records describe that exact historical attempt and cannot certify current branch, Preprod, or mainnet behavior.

### Flux Point evidence warning

The repository-side DoD pilot is not proof that the Flux Point plugin is installed on this workstation or every contributor machine. Its own documentation says the plugin installation commands were not run by GitHub Actions. A green repository harness proves only that its declared commands passed at the recorded revision.

## 4. Source-of-truth boundaries

1. IMMORTAL-AEP specification and its versioned transition rules define protocol semantics.
2. A local model may propose work but cannot grant capabilities, set economic values, approve evidence, or promote itself.
3. The local Runtime and Resource Manager enforce task-scoped permissions and host resource limits.
4. Flux Point reports engineering DoD results; it is not the economic kernel.
5. JEV records and normalizes evidence; it is not an authority or credit issuer.
6. Mitsuro observes a fixed public evidence surface; it is not a scheduler, worker, wallet, or transaction submitter.
7. Cardano adapters may request transitions; only the normative rules and applicable validator/evidence checks determine acceptance.

## 5. Integration sequence

### I0 — local source inventory (next required action)

Run scripts/inventory-local-nucleus.ps1 from the Cormia checkout. The script records relative paths, file sizes, SHA-256 digests, and package metadata for the four known local roots. It does not collect file contents, task/audit stores, environment files, credentials, model weights, logs, dependency trees, Git objects, or build outputs. Review the JSON locally before sharing it.

### I1 — reference Runtime compatibility boundary

After reviewing the inventory, identify the smallest source modules implementing:
- model gateway and deterministic command dispatcher;
- durable task store, checkpoint, and resume;
- Resource Manager admission, lease, and preemption;
- Evolution Manager candidate isolation, test, review, and promotion;
- Coding Workspace approval and Docker execution boundary.

Document public functions, state formats, invariants, and existing tests before adapter code is written. The context-overflow evolution run from 2026-11-02 is a required recovery regression case: model context must not be the only source of workflow state.

### I2 — local AEP contract

Use [ADR-0007](../adr/0007-proposed-task-capabilities-and-workspace-scope.md) as the non-normative starting proposal for operation identifiers and exact workspace scopes. [ADR-0008](../adr/0008-proposed-local-capability-grants-and-revocation.md) now provides an experimental signed local-grant and revocation contract with a host-pinned issuer. [ADR-0009](../adr/0009-proposed-local-authority-bootstrap-consent-and-revocation-anchor.md) defines the proposed non-exportable key bootstrap, exact task-bound operator consent and independent monotonic revocation anchor; none is implemented yet. Resolve and test those lifecycle requirements, plus ADR-0007's workspace-isolation and test-selection decisions, before changing `SPEC.md` or `schemas/task-manifest.schema.json`. Then define the versioned local Task Manifest subset and deterministic capability mapping before enabling remote task intake. Start local-only. Do not connect a peer mesh, issue CRC, sign contribution receipts, or use Cardano settlement until those contracts and positive/negative tests exist.

### I3 — evidence adapters

Map native test and execution results into versioned AEP Evidence Packages. Keep JEV result semantics unchanged. Use Flux Point as an optional engineering gate and Mitsuro as an optional read-only observer. Preserve the authority boundaries above.

### I4 — reciprocal compute

Only after local Runtime and task isolation are validated: add opt-in contribution leases, workload/model/runtime identity, signed receipts, verification profiles, reconstructible off-chain accounting, and explicit prompt-privacy disclosure. CRC conversion, NUWU formula, audit probability, and epoch policy remain open in the AEP draft; do not invent values.

### I5 — Cardano adapter

Keep settlement optional and later. Do not import PRE-RICH tokenomics or validator assumptions into AEP. No transaction or wallet operation is authorized by this integration baseline.

## 6. Stop conditions

- Do not modify V3, Reveal, PRE-RICH kernel, or Issue semantics for Cormia integration.
- Do not add a new branch to Immortal-Protocol or alter existing agent assignments.
- Do not copy local task/session/audit data, secrets, API tokens, wallet material, model files, or user datasets into Cormia.
- Do not vendor Flux Point source without a separate license/NOTICE review.
- Do not claim AEP conformance, trustlessness, production readiness, or scientific novelty from repository structure or passing unit tests alone.
- Do not let JEV, Flux Point, Mitsuro, or an LLM take over protocol authority.

## 6A. Local metadata inventory result

The read-only metadata inventory was generated on 2026-11-02 at 13:40:28Z using `scripts/inventory-local-nucleus.ps1`.

| Root | Files | Bytes |
|---|---:|---:|
| LocalAgent | 18 | 632,818 |
| CodingWorkspace | 17 | 309,018 |
| ControlRoom | 10 | 50,726 |
| McpBridge | 1 | 7,090 |
| **Total** | **46** | **999,652** |

The inventory contains paths, extensions, sizes, SHA-256 digests and last-write timestamps. It does not contain source contents, task/session/audit data, credentials, model weights, logs, dependency trees or Git objects. No package.json metadata was found in the four inventoried roots.

### Hash-level findings

- `LocalAgent/agent.mjs` SHA-256 is `f60b3fe3f91a550ecb79a46ef2740a6ed8982e9cdd2a5996825b7ebf2d554952`, matching the previously recorded Agent v0.8.0 file digest.
- `LocalAgent/coding-workspace.mjs` and `CodingWorkspace/coding-workspace-under-test.mjs` are byte-identical (SHA-256 `a0dbc2c4dc11934163bb285651af3d20af38374d9b06653a86a80f7add0a737b`).
- In run `EVOL-20261102072415-46c24ca0`, the working, baseline and candidate copies of both `evolution-manager.mjs` and `resource-manager.mjs` have matching hashes. The inspected inventory therefore shows no code delta in that candidate run.
- The copies named `self-improvement.test.mjs`, `baseline/evolution-manager.test.mjs`, `baseline/resource-manager.test.mjs`, `candidate/evolution-manager.test.mjs` and `candidate/resource-manager.test.mjs` share one SHA-256. Treat them as identical byte copies until content review explains their intended role; do not infer distinct test coverage from the filenames.
- Five historical Agent backups are present. Preserve them as recovery material; do not import them as runtime modules.
- The Resource Manager and Evolution Manager live under the separate CodingWorkspace root, while the main agent entry point and its Coding Workspace module live under LocalAgent. Their import and ownership relationships still require source inspection.

These are hash/path observations, not code-quality or semantic assessments. A matching digest establishes byte identity, not that either copy is correct or safe.

## 6E. Evolution Manager adapter implementation

A separate run-bound wrapper has been added at `runtime/reference-worker/immortal-evolution-manager-adapter.mjs`. It enforces the fixed four-entry source map, candidate-only test creation, immutable baseline tests, SHA/anchor preconditions, trusted-host verification evidence and disabled promotion. Its adapter CI is separate from running a real local evolution. See [LOCAL_EVOLUTION_MANAGER_ADAPTER.md](../runtime/reference-worker/LOCAL_EVOLUTION_MANAGER_ADAPTER.md).

## 6D. Resource Manager adapter implementation

A separate Cormia-side adapter has been added at `runtime/reference-worker/immortal-resource-manager-adapter.mjs`. It maps only `agent-inference`, `workspace-test` and `evolution-docker-test` to fixed ResourceManager classes, fails closed on missing/invalid data and releases the lease in `finally`. The dedicated 11-test GitHub Actions workflow passed. This wrapper is not connected to the Agent and does not provide OS-level resource enforcement. See [LOCAL_RESOURCE_MANAGER_ADAPTER.md](../runtime/reference-worker/LOCAL_RESOURCE_MANAGER_ADAPTER.md).

## 6C. Coding Workspace capability mapping

The local Coding Workspace tool surface, caller-side approval gates, resource lease for tests, root/path restrictions and unresolved task-specific isolation requirements are recorded in [CODING_WORKSPACE_CAPABILITY_MATRIX_2026-11-02.md](CODING_WORKSPACE_CAPABILITY_MATRIX_2026-11-02.md). The capability mapping is not yet canonical because AEP's current Task Manifest schema does not define operation identifiers or path-scope grammar.

## 6B. Source-level review

The selected local source archive has now been reviewed. Detailed file map, hash identities, security boundaries, syntax/unit-test results, test-fixture defects and migration sequence are recorded in [`LOCAL_NUCLEUS_SOURCE_REVIEW_2026-11-02.md`](LOCAL_NUCLEUS_SOURCE_REVIEW_2026-11-02.md). The next decision is no longer blocked on source discovery; it is blocked on adapter contracts and compatibility tests. No local source has been copied into Cormia.

## 7. Next required evidence

The metadata inventory is now complete. The next implementation decision remains blocked on source-level review of the selected runtime and manager modules. Source transfer, adapter implementation and test baselines must follow only after their actual imports, state formats, permissions and test contracts have been inspected.


## 6G. Windows local compatibility result — 2026-11-02

The user executed `scripts/verify-local-runtime-adapters.mjs` on the Windows host using Node v22.15.0. The aggregate report was generated at `2026-11-02T14:50:09.504Z`.

| Probe | Observed result |
|---|---|
| Agent root / Coding Workspace root | Both present |
| Task Store v1 | Valid; 7 tasks; 6 completed and 1 paused; 0 validation errors; 6 warnings |
| Resource Manager import | Passed |
| Resource Manager lease probe | Passed; reported mode `balanced`; no persistent write |
| Evolution Manager import | Passed |
| Existing evolution runs | 1 run, status `candidate_open` |
| Bound candidate read | Passed; SHA-256 prefix `a8ab76ea9eaa` |
| Overall probe | `PASS`; 0 blockers |

The six Task Store warnings are consistent with the adapter's expected warning for each `completed` record, which requires completion-integrity checks before treating the result as trusted. The report intentionally did not expose goals, result strings, evidence bodies or task IDs.

The probe did not start Agent/Granite, create or patch an evolution candidate, run Docker, modify the task store, or promote code. The Resource Manager lease was acquired and released around a no-op callback. The Evolution Manager inspection used its existing run registry and a bounded first-line candidate read.

This is a successful local compatibility smoke test for the three adapters on the user's Windows environment. It is **not** a full end-to-end Runtime execution, a Docker isolation proof, an AEP conformance verdict, or approval to promote the existing open candidate.

## 6F. Aggregate local verification

The read-only Windows verification entry point is `scripts/verify-local-runtime-adapters.mjs`. It now checks four compatibility boundaries against the selected local installation: Task Store v1, Resource Manager, Coding Workspace read-only operations, and Evolution Manager. The probe validates the task-store envelope in memory, performs a no-op lease acquire/release, lists only root-level Coding Workspace metadata through the read-only adapter, and checks the existing Evolution Manager run registry with a bounded candidate read. It prints aggregate counts and a short digest prefix only; it does not expose task text, entry names, source contents or evidence bodies.

The successful local result is a compatibility smoke test, not a test of Agent/Granite inference, Docker candidate execution, task execution, AEP conformance, or approval to promote an open candidate.


## 6H. Coding Workspace read-only adapter implementation

A separate wrapper exposes exactly four non-mutating operations and requires exact readable-file/listable-directory allowlists injected by trusted host code. The model cannot expand these sets. Write/patch/test are not exposed. Its 10 contract tests passed in [GitHub Actions run #2](https://github.com/LiberoNuvola/Cormia/actions/runs/41466372070).

The expanded Windows probe imported the real `CodingWorkspace` class and called only root `workspace_list` through the new adapter. On 2026-11-02 at 14:59:32.825Z it passed and reported `totalEntries: 5`, `truncated: false`; no entry names were printed. This confirms the local read-only list path against the existing workspace root, not the other three operations or any write/patch/test path.

## 6I. Aggregate Windows probe result — 2026-11-02

The user ran the updated probe from the local Cormia checkout after a fast-forward pull from `9f1ad98` to `45dd82c69c89a0ed4e037a4939400a7769487bb1`. The probe generated at `2026-11-02T14:59:32.825Z` returned `PASS` with zero blockers:

| Boundary | Local result |
|---|---|
| Task Store v1 | Present and valid; 7 tasks (6 completed, 1 paused), 0 errors, 6 warnings |
| Resource Manager | Imported; no-op `agent-inference` lease probe passed; resource mode `interactive` |
| Coding Workspace | Imported; read-only root listing passed; 5 entries, not truncated |
| Evolution Manager | Imported; 1 existing run (`candidate_open`); bounded candidate read passed; digest prefix `a8ab76ea9eaa` |

The six Task Store warnings were recorded without treating them as errors. Earlier review found that this warning count is consistent with the adapter's completion-integrity warnings on completed records; the aggregate output does not independently certify the correctness of those records.

The probe did not start Agent or Granite, run Docker or workspace tests, start a task/evolution, modify the task store, create or patch a candidate, or promote code. It is local compatibility evidence for the listed probe operations only.

## 6J. Bounded attempt evidence sidecar probe — implemented; Windows check passed

A new local-only helper, `runtime/reference-worker/local-evidence-sidecar-probe.mjs`, is integrated into `scripts/verify-local-runtime-adapters.mjs`. It inspects only exact sidecar paths referenced by a valid Task Store v1 snapshot; it does not scan the evidence directory or infer missing paths.

For each reference it checks the exact task-bound filename, embedded task ID and attempt, directory/file symlink boundaries, JSON structure through `inspectAttemptEvidenceV1`, and a defensive 8 MiB per-file read limit. If any task is marked `running`, it skips all sidecar reads and fails the sidecar probe rather than inspect potentially changing evidence. The limit belongs to this probe, not to the v1 evidence schema. It returns only aggregate counts; raw tool payloads, task identifiers and file names are never printed.

The dedicated GitHub Actions workflow `.github/workflows/local-agent-attempt-evidence-sidecar-compatibility.yml` runs syntax checks and contract tests for valid/empty, missing, unsafe, mismatched, malformed, oversized and symlink cases. Repository CI validates only synthetic fixtures; it cannot access the user's local sidecar files.

**Local Windows evidence — PASS:** the user fast-forwarded `main` from `45dd82c` to `f6dfb67` and ran the aggregate probe at `2026-11-02T15:22:04.248Z` with Node v22.15.0. It returned `PASS`, zero blockers. Six referenced sidecars were valid; one task had no evidence path. There were zero missing, unsafe, oversized, malformed-JSON, schema-invalid or unreadable sidecars; zero tasks were running. The 6 sidecars contained 24 structurally valid evidence items, of which 0 were marked `isError`. The probe read 79,924 bytes in total, within the 8 MiB per-file bound. It printed no task identifiers, file names or raw payloads. This proves sidecar structural compatibility and task/attempt binding, not truthfulness or semantic sufficiency of the recorded tool outputs.

### GitHub CI evidence for 6J

- [Sidecar probe contract run #5](https://github.com/LiberoNuvola/Cormia/actions/runs/41470239168): **SUCCESS**, 10 tests passed, 0 failed, at `7e00e7aecd3bbf99535700d00ce22bbc6801c241`.
- [Aggregate probe syntax/import run #10](https://github.com/LiberoNuvola/Cormia/actions/runs/41470239182): **SUCCESS**, at `7e00e7aecd3bbf99535700d00ce22bbc6801c241`.

The local sidecar check against `E:\AI\Immortal-Agent-v0.7\data\evidence` completed successfully on the user's Windows host. GitHub Actions did not access that path; the `PASS` above comes from the user's local execution.

## 6K. Experimental signed local capability grant contract

The non-normative [ADR-0008](../adr/0008-proposed-local-capability-grants-and-revocation.md) and two draft claim schemas define a local host-issued grant and separate revocation statement. The testable helper uses JWS Compact Serialization, the fully specified JOSE `Ed25519` algorithm, and a restricted JCS payload profile. The grant binds one task, exact manifest digest, issuer, worker/runtime subject, capability, workspace/path scope and bounded time interval. The host policy pins the issuer identity, active signing key, capabilities, exact paths and maximum lifetime.

The v0.1 evaluator allows only `workspace.list`, `workspace.read`, `workspace.diff` and `workspace.verify`. It rejects create/replace/test and all delegation. The current Agent's `APPROVO` flow is unchanged. The evaluator is not connected to `agent.mjs`, `CodingWorkspace.callTool()`, manifest verification or a real key store. Its revocation feed is caller-supplied; durable rollback-resistant feed storage and monotonic checkpointing remain unimplemented.

The [Local Runtime Capability Grant Contracts run #19](https://github.com/LiberoNuvola/Cormia/actions/runs/41479984954) completed **SUCCESS**: 21 cryptographic/policy tests, 6 lifecycle schema-profile tests and 15 in-memory revocation-anchor model tests all passed (42 total, 0 failed). Tests create ephemeral Ed25519 key pairs in memory and exercise canonicalization (including sparse-array/accessor rejection), signature verification, key/issuer trust, task/manifest/subject binding, expiry, exact host path intersection, denied mutation/delegation, signed revocation, anchor rollback/fork/prefix detection and compare-and-set recovery. This is isolated contract evidence, not proof of real key custody, operator consent, durable storage, task isolation or AEP conformance.

No private key, local Agent data or user workspace content was added to Cormia.

## 6L. Windows CNG capability discovery — read-only probe implemented

A read-only PowerShell probe, `scripts/probe-windows-cng-capabilities.ps1`, queries:
- the Microsoft Platform Crypto Provider (TPM KSP);
- the Microsoft Software Key Storage Provider;
- signature algorithms exposed through `NCryptEnumAlgorithms`;
- TPM presence/readiness through `Get-Tpm`, when the cmdlet is available.

It does not create keys/certificates, read private key material, or change machine state. The dedicated [Windows CNG Capability Discovery run #2](https://github.com/LiberoNuvola/Cormia/actions/runs/41480382232) passed on a GitHub-hosted Windows runner. That hosted runner had no TPM; the Microsoft Platform Crypto Provider was unavailable, while the Software KSP listed `ECDSA_P256`, `ECDSA_P384`, `ECDSA_P521`, DSA, ML-DSA and RSA. This is not evidence about the user's physical Windows machine.

The result reinforces the algorithm decision boundary: the current ADR-008 v0.1 grant helper supports Ed25519; ES256/P-256 is recorded only as a candidate for a separately versioned Windows CNG profile. The actual local provider inventory and a disposable-key end-to-end signing test are still required before selecting an operational key profile. No key has been created and no local Windows system has been queried by GitHub Actions.

## 6M. Autonomous project mandate — target architecture and schema contracts

[ADR-0010](../adr/0010-autonomous-project-delegation-and-runtime-authority.md) makes the intended local-AI objective explicit: one initial operator delegation for a standing project mandate, then autonomous planning, task creation, file changes, builds, tests, failure repair and evidence reporting inside a host-created isolated project worktree. The Runtime derives child grants automatically; there is no human approval for each edit, patch or test. The model is not given API keys, PATs, bearer credentials, signing keys or grant strings. Local Granite inference and offline repository work do not depend on cloud-provider API tokens.

Two draft schemas are present:
- `schemas/local-autonomous-project-mandate-claims-v0.1.schema.json`;
- `schemas/local-project-mandate-consent-claims-v0.1.schema.json`.

The [Local Runtime Capability Grant Contracts run #25](https://github.com/LiberoNuvola/Cormia/actions/runs/41484097123) passed 65 tests: 21 cryptographic/grant tests, 6 lifecycle-schema tests, 6 autonomous-project-mandate schema tests, 17 autonomous authority policy tests and 15 in-memory revocation-anchor tests (0 failures). A pure project authority evaluator now derives one internal task child authority and authorizes repeated in-scope edits/tests/builds without per-operation approval callbacks. It checks exact task/manifest/worktree binding, exclusions, host-policy intersection, named test profiles, branch/remote policy and expiry.

The current Agent `/code` + `APPROVO` path remains an interactive compatibility mode. The new policy helper is not yet integrated into Agent execution and does not verify signatures or persist mandates. The new autonomous Runtime path is therefore not yet implemented or activated. Do not remove or bypass legacy approval checks in isolation; implement the verified mandate store, isolated worktree, credential broker, workspace I/O enforcement and autonomous task loop, then prove an end-to-end multi-step task can edit, test, repair and finish with zero per-operation prompts before enabling it.


## 6N. IMMORTAL EXP generalization crosswalk — research coordination

The cross-domain mapping of IMMORTAL EXP-01…EXP-12 against Cormia AEP and its Runtime is recorded in [IMMORTAL–Cormia EXP Generalization Crosswalk v1.0](../research/IMMORTAL_CORMIA_EXP_GENERALIZATION_CROSSWALK_v1.0.md).

The crosswalk classifies each EXP as partial, architectural, open or dependent on an explicit cross-domain decision. It distinguishes authority/action composition (Cormia Runtime), economic/resource composition (IMMORTAL kernel and any explicit AEP economic adapter), and governance/jurisdiction composition (Governance Framework and profiles). It does not assume these are already one proven algorithm or theorem.

Coordination notes:
- Cormia `main` baseline is unchanged by the draft PNC work; ADR-0011 is proposed on [PR #1](https://github.com/LiberoNuvola/Cormia/pull/1), not yet merged.
- The crosswalk is maintained on a separate branch/PR and does not alter PR #1 or its PNC-bound mandate work.
- The AEP-to-IMMORTAL economic jurisdiction question remains OPEN: no duplicate or conflicting solvency/protection accounting may be created for the same resource.
- No PRE-RICH constants, V3, Reveal, Issue semantics, AEP economic parameters or Runtime authority are changed by this research mapping.

## 6O. AEP ↔ IMMORTAL economic jurisdiction and four EXP conformance contracts

The follow-up contract is recorded in [CORMIA_AEP_IMMORTAL_ECONOMIC_JURISDICTION_AND_EXP_CONFORMANCE_v0.1.md](../research/CORMIA_AEP_IMMORTAL_ECONOMIC_JURISDICTION_AND_EXP_CONFORMANCE_v0.1.md).

It distinguishes Cormia-local non-economic tasks, internal reciprocal-compute usage accounting, asset-denominated AEP task contracts, shared/cross-system economic resources subject to C-COMP, and a possible fully isolated independent AEP economic deployment. It recommends an IMMORTAL application profile for asset-denominated AEP flows that operate within an IMMORTAL-governed perimeter, while leaving the independent-jurisdiction option and fee identity as explicit open decisions.

The document also specifies proposed invariants and positive/negative conformance vectors for EXP-06 (Evidence-as-Input), EXP-12 (observer/authority separation), EXP-10 (economic risk budget distinct from operational resource budget) and EXP-11 (allocation). Its formal state variables and model-check scenarios are a specification proposal. A bounded Python reference model was added at verification/exp_boundary/, and its 15 tests passed in [GitHub Actions run #4](https://github.com/LiberoNuvola/Cormia/actions/runs/41528325294) at e59f4cf35eef43304f4eaec0aeff56184a77307f. This is evidence only for the abstract model, not Cormia implementation conformance, a full-state model check, a TLA+/Quint proof, a C-COMP deployment certificate or a live AEP/IMMORTAL adapter.

No AEP SPEC, schema, economic parameter, Runtime authority, IMMORTAL normative rule or PRE-RICH semantic change is made.


## 6P. AEP lifecycle economic-effect routing — research addendum

The v0.2 routing addendum in [the AEP–IMMORTAL jurisdiction/conformance contract](../research/CORMIA_AEP_IMMORTAL_ECONOMIC_JURISDICTION_AND_EXP_CONFORMANCE_v0.1.md) maps every existing AEP lifecycle point from Draft through Funded/Open/Assigned/Running/Submitted/Verifying/ChallengeWindow/Disputed/Settled/Failed/Expired/Cancelled/Refunded/Slashed to its possible economic effects and authority route.

The boundary is effect-driven, not event-driven: IMMORTAL is not called for every AEP state change. Funding/escrow lock, bond lock, claim or fee accrual, settlement release, refund, slash and shared economic-resource reservation/release are economic effects. Assignment, execution, submission, verifier evidence, challenge-window opening and failure classification are Cormia task events unless they also create one of those effects. Operational CPU/GPU/RAM/time limits remain Resource Manager controls and are not converted into economic exposure.

The current schemas/task-manifest.schema.json was inspected to bind the matrix to real field names. It exposes budget asset/max amount/refund address/protocol fee, worker/verifier bond profiles, deadlines/windows, policy strings and resource profile. It does not yet encode an explicit C0–C4/profile identity, a typed challenge-bond profile, verifier-reward/settlement-allocation profile, or C3 resource partition/joint-certificate references; taskId is not required by the current schema. These are recorded as schema/contract gaps, not silently added here.

A fail-closed preflight reference model and tests now live in verification/exp_boundary/transition_routing.py and test_transition_routing.py. It routes C2 effects to the IMMORTAL gate, blocks C3 until canonical partition + joint certificate are present, requires reclassification for C0/C1 external claims or shared-resource effects, and keeps C4 independent. It never returns an economic admission. GitHub Actions [run #19](https://github.com/LiberoNuvola/Cormia/actions/runs/41580764675) passed all 31 bounded abstract tests (15 EXP boundary + 16 lifecycle-routing), with 0 failures. This is not implementation conformance or a C-COMP/solvency proof.

No change was made to SPEC.md, schemas/task-manifest.schema.json, Runtime code, economic parameters, JUR-01…JUR-06 status, IMMORTAL normative sources, PRE-RICH or the separate PNC PR #1.


## 6Q. AEP Runtime implementation boundary — transition model is not yet wired

The current Cormia main baseline and reference-worker documents were rechecked on 2026-11-03. They describe the AEP SPEC, draft manifest schema and architecture, but no implemented AEP task engine/state reducer, scheduler, peer mesh or verifier service. The local Agent Task Store v1 inspector is a distinct read-only compatibility adapter for the existing IMMORTAL Local Agent; its pending/running/paused/failed/completed statuses are not the AEP Draft/Funded/Assigned/Settled lifecycle and it is not an AEP authority surface.

The new transition-routing reference model therefore maps the SPEC vocabulary and current manifest field paths, but has no executable AEP event API against which to integrate. Its effect set is test input only; a production implementation must derive effects from a typed transition + signed/committed manifest + authoritative protocol state + versioned economic profile, never from a model/observer/caller flag. The recommended integration sequence and blockers are recorded in section 7.8 of the jurisdiction/conformance contract.

No runtime files, local task-store data, manifest schema, economic parameters, wallet or settlement path were changed.


## 6R. General-purpose Cormia Core and mixed community support — architecture correction

The Core-first and mixed-support proposal is recorded in [CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md](CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md). It defines two project leadership modes (creator/team-led and agent-led, with hybrid projects) on one Core and two independent support dimensions: financial patronage and in-kind resources such as compute, storage, datasets, expertise and infrastructure. Contributions support a project or named workstream/resource pool; they are not wages to an AI agent. Agent-led projects require an explicit bounded mandate and named stewardship/accountability arrangement; the agent does not receive personal custody of community funds by default.

**Core independence is a non-negotiable architecture constraint:** local/general-purpose Cormia must run with no account, subscription, wallet, Cardano, token, CRC, payment provider, AEP settlement or IMMORTAL integration. Community support, remote resource mesh, funded bounties, Cardano and IMMORTAL are optional, composable adapters. Payment/financial accounting and resource scheduling remain separate. A project's receipt of patronage or compute donations does not grant supporters tool permissions, private-data access or the ability to expand an agent's Project Mandate.

The AEP–IMMORTAL economic jurisdiction contract and C0–C4 routing tests apply only to projects/tasks that explicitly opt into the relevant funded/economic profile. They do not apply to ordinary agent operations, unfunded tasks, local work, patronage as such or donated compute as such. The AEP SPEC and normative schema were not changed by this architecture clarification.


## 6S. Four Cormia Core contracts — authority, lifecycle, resources and support

The contract proposal is recorded in [CORMIA_CORE_CONTRACTS_v0.1.md](CORMIA_CORE_CONTRACTS_v0.1.md). It defines four independent surfaces: Project Mandate, Autonomous Project Lifecycle, Resource Provider, and Community Support.

Reuse ADR-0010 and the existing mandate/consent claims schemas, ADR-0008/0009 trust design and local Resource Manager wrapper. Do not create a parallel mandate signer, per-operation approval flow, trust anchor or child-grant mechanism. The existing local-project mandate is coding-worktree-specific, so generalization to other project types must use versioned typed capability/resource profiles; do not silently extend the v0.1 schema.

The contract keeps project lifecycle, mandate/authority lifecycle and individual task lifecycle separate. It also keeps financial patronage separate from in-kind compute/storage/data/expertise, and makes explicit that supporters and resource providers do not gain agent capabilities or mandate authority.

A bounded Core reference model and 22 standard-library tests were added in `verification/core_contracts/`. GitHub Actions [run #37](https://github.com/LiberoNuvola/Cormia/actions/runs/41583031982) passed 22 Core tests plus 31 EXP boundary tests (53 total, 0 failures). This verifies only abstract contract predicates; it is not a production Core implementation, mandate/consent persistence, credential broker, Resource Provider mesh, Community Support registry or end-to-end agent loop.

No runtime, mandate schema, Task Manifest, payment provider, wallet, Cardano, token, CRC or IMMORTAL economic behavior was implemented or changed.
