# Cormia Two-Project Concurrent Task Path — Synthetic Integration Proof v0.1

- Date: 2026-11-08
- Status: two independent project tasks verified concurrently under one in-process Supervisor and one shared ModelProvider, using synthetic host/provider ports; not production or Windows end-to-end
- Test: `runtime/core/multi-project-parallel-task-path.integration.test.mjs`
- CI: [GitHub Actions run #42453075948](https://github.com/LiberoNuvola/Cormia/actions/runs/42453075948)
- Parent architecture: [General-Purpose Autonomous Agent & Mixed Community-Support Architecture](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- Implementation priority: [Multi-Project Autonomous Runtime](./CORMIA_MULTI_PROJECT_AUTONOMOUS_RUNTIME_v0.1.md)

## 1. What the test proves

One `createProjectSupervisor()` instance and one shared deterministic ModelProvider/Model Task Planner/model-backed executor run two project tasks under a single host composition. The test intentionally holds both provider requests until both independent project requests have arrived, then releases them; this demonstrates overlapping progress through the shared inference provider rather than merely two sequential executions.

Each project has its own:
- immutable Project Runtime and separate Plan–Execute Capability Broker instance;
- trusted Task Authority Provider fixture and project resolver fixture;
- read-only CodingWorkspace wrapper, operation-adapter map and exact allowlisted target path;
- Project Task Store and NDJSON journal;
- taskRef, manifest digest, route digest, checkpoint and verifier evidence reference.

The Supervisor is configured with `maxGlobalConcurrency: 2` and `maxConcurrency: 1` for each project. The same provider is shared as an inference service only; it does not merge task identity, project authority, workspace or journal state.

## 2. Actual code exercised

The test executes the repository implementation modules:

1. `createProjectSupervisor()` loads two project queues, validates each host route, and uses its round-robin scheduler to durably claim both tasks.
2. One `createModelTaskPlanner()` sends each task's own `projectRef`, `taskRef`, `manifestDigest` and host-verified requested operations to the same deterministic provider instance.
3. The host `taskContextProvider` checks that each taskRef matches its own project. The shared provider returns an operation proposal whose relativePath is project-specific.
4. The `createProjectRuntimeRegistry()` derives the Runtime from the host route. The caller/model never supplies a project selector.
5. Each Runtime's actual Plan–Execute Capability Broker independently loads/revalidates its own task authority, authorizes `workspace.read`, checks exact relativePath and dispatches only through that Runtime's fixed adapter.
6. The model-backed executor records a checkpoint and invokes a separate fixture verifier. The verifier asserts the only dispatched path for each project belongs to that project's workspace adapter.
7. Each task is marked completed only with its own evidence reference, persisted to its own project journal.

## 3. CI result

On commit `7e6fe1a52ae211328946b16c42bb00ba0f0c16e1`, [run #42453075948](https://github.com/LiberoNuvola/Cormia/actions/runs/42453075948) passed:

- Core Node suite: **151 PASS / 0 FAIL**.
- Read-only CodingWorkspace adapter suite: **7 PASS / 0 FAIL**.

The full Core count includes the single-project end-to-end composition test and this new two-project overlapping execution test.

## 4. What remains synthetic or unproven

- The ModelProvider is `createDeterministicModelProvider()`, not the operator's real Granite model. The previous real Granite smoke test remains a separate provider smoke result, not this two-project proof.
- The task-route provider, Task Authority Providers, project resolvers and Resource Admission providers are test doubles. The Broker executes its real code and checks those ports, but the test does not authenticate real keys, mandates, signatures, operator consent or revocation anchors.
- The result verifier is a fixture that checks the dispatched path and returns evidence references; it is not a production evidence writer, certificate or Materios receipt.
- CodingWorkspace is a synthetic in-memory read-only bridge with one different allowlisted file per project. No user repository or Windows filesystem was opened.
- Only `workspace.read` is exercised. No create/replace/patch/test/build, shell, Git write, wallet, Cardano or ledger operation is enabled.
- The test demonstrates overlapping two-project task progress inside the in-process Supervisor. It does not install or run a Windows background service, survive a host power loss, use real OS process quotas or prove physical GPU inference parallelism. A single local Granite server may serialize/queue inference according to its own configured capacity.
- This test verifies two independent project Runtime instances; it does not yet run the actual IMMORTAL working tree together with a second user project on the user's PC.

## 5. Next production gates

1. Finalize and implement the existing AEP Task Manifest canonical verification path. The current `schemas/task-manifest.schema.json` remains explicitly draft and is not a finalized signing envelope; do not invent a parallel signature format.
2. Wire host key/bootstrap, authenticated operator consent, mandate signature verification, persistent revocation/monotonic anchor, project descriptor and host-policy providers.
3. Derive task routing and Planner context from the same authenticated Task Manifest and ensure taskRef/projectRef/manifestDigest remain bound.
4. Provide per-task isolated worktrees and realpath/symlink-safe filesystem/Git operation adapters before enabling unattended mutation.
5. Connect the actual Windows ResourceManager, resource admission and task-bound Resource Leases; the Supervisor's task concurrency caps are not OS resource quotas.
6. Implement the independent result verifier/evidence writer using the existing evidence/prior-art decisions. Do not invent a Cormia receipt schema or signature envelope before the PA-04 reuse review and open ADR decisions are addressed.
7. Run the Supervisor on the user's Windows host with real local Granite, first on IMMORTAL's designated branch and then with one independent second project, confirming separate mandates, task queues, worktrees and evidence.

## 6. Architecture scope

This two-project proof is an implementation milestone under the unchanged general Cormia architecture. It does not narrow or replace any final goals; it verifies one important near-term capability that the broader architecture requires.