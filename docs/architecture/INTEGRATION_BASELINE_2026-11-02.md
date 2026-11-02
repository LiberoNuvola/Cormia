# Integration baseline — 2026-11-02

**Status:** verified repository inventory; local-source inventory pending  
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

Define a versioned local Task Manifest subset and deterministic capability mapping before enabling remote task intake. Start local-only. Do not connect a peer mesh, issue CRC, sign receipts, or use Cardano settlement until those contracts and positive/negative tests exist.

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

## 6D. Resource Manager adapter implementation

A separate Cormia-side adapter has been added at `runtime/reference-worker/immortal-resource-manager-adapter.mjs`. It maps only `agent-inference`, `workspace-test` and `evolution-docker-test` to fixed ResourceManager classes, fails closed on missing/invalid data and releases the lease in `finally`. The dedicated 11-test GitHub Actions workflow passed. This wrapper is not connected to the Agent and does not provide OS-level resource enforcement. See [LOCAL_RESOURCE_MANAGER_ADAPTER.md](../runtime/reference-worker/LOCAL_RESOURCE_MANAGER_ADAPTER.md).

## 6C. Coding Workspace capability mapping

The local Coding Workspace tool surface, caller-side approval gates, resource lease for tests, root/path restrictions and unresolved task-specific isolation requirements are recorded in [CODING_WORKSPACE_CAPABILITY_MATRIX_2026-11-02.md](CODING_WORKSPACE_CAPABILITY_MATRIX_2026-11-02.md). The capability mapping is not yet canonical because AEP's current Task Manifest schema does not define operation identifiers or path-scope grammar.

## 6B. Source-level review

The selected local source archive has now been reviewed. Detailed file map, hash identities, security boundaries, syntax/unit-test results, test-fixture defects and migration sequence are recorded in [`LOCAL_NUCLEUS_SOURCE_REVIEW_2026-11-02.md`](LOCAL_NUCLEUS_SOURCE_REVIEW_2026-11-02.md). The next decision is no longer blocked on source discovery; it is blocked on adapter contracts and compatibility tests. No local source has been copied into Cormia.

## 7. Next required evidence

The metadata inventory is now complete. The next implementation decision remains blocked on source-level review of the selected runtime and manager modules. Source transfer, adapter implementation and test baselines must follow only after their actual imports, state formats, permissions and test contracts have been inspected.
