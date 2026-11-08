# Cormia Autonomous Task Path — Synthetic Integration Proof v0.1

- Date: 2026-11-08
- Status: full single-project path verified with synthetic host/provider ports; the separate two-project concurrent test is documented in [CORMIA_MULTI_PROJECT_PARALLEL_TASK_PATH_SYNTHETIC_INTEGRATION_v0.1.md](./CORMIA_MULTI_PROJECT_PARALLEL_TASK_PATH_SYNTHETIC_INTEGRATION_v0.1.md); neither is a production or Windows end-to-end deployment
- Test: `runtime/core/multi-project-autonomous-path.integration.test.mjs`
- Parent: [General Cormia architecture](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- Multi-project priority: [Multi-Project Autonomous Runtime](./CORMIA_MULTI_PROJECT_AUTONOMOUS_RUNTIME_v0.1.md)

## 1. What the integration test composes

The test exercises the actual implementation modules in one process:

1. Cormia Project Task Store: enqueues a task and persists claim, checkpoint and completion events in a temporary per-project NDJSON journal.
2. Local Project Supervisor: acquires its lock, verifies the host task route, claims the task and invokes the fixed executor.
3. Model Task Planner: invokes the actual deterministic ModelProvider implementation with a strict JSON-only proposal response. The test provider is synthetic; no Granite inference is executed.
4. Project Runtime Registry: resolves the task to the fixed Project Runtime from a host-supplied task route; no caller/model project selector is passed.
5. Actual Plan–Execute Capability Broker: validates the proposal and invokes the synthetic trusted project resolver/Task Authority/mandate/consent/revocation/policy ports. The resolver and Broker code are real; the authority providers are test fixtures, not authenticated production services.
6. Actual read-only CodingWorkspace wrappers: the fixed `workspace.read` capability maps to `workspace_read`, requires exact allowlisted relativePath equality and invokes a synthetic in-memory CodingWorkspace host adapter.
7. Synthetic result verifier: independently checks that the expected operation and exact target path were dispatched, then returns an evidence reference. It is not a production evidence writer or certificate.
8. Model-backed task executor: records its pre-execute checkpoint and only returns completed after the verifier returns evidence.

## 2. Test assertions

The test requires a queued task to reach completed through the above composition, exactly one `workspace_read` dispatch for the host-authorized path, one attempt, one durable pre-execute checkpoint and one evidence reference stored in that project's task journal. It uses a temporary directory and removes it at test end.

The ModelProvider result is deterministic and synthetic. The host key bootstrap, signed Task Manifest verification, route signature/provider, operator consent service, persistent revocation anchor, production mandate store, Windows workspace, real ResourceManager and evidence store are not exercised.

## 3. CI result

[GitHub Actions run #42452775680](https://github.com/LiberoNuvola/Cormia/actions/runs/42452775680) completed successfully on commit `7c533fc06a4c948227a0eae7f80387bea51d91a3`:

- Core Node suite: **150 PASS / 0 FAIL**.
- Read-only CodingWorkspace adapter suite: **7 PASS / 0 FAIL**.
- No syntax or test failures.

This run includes the complete synthetic path integration test. It validates code composition and regression behavior, not production identity/signature security or real-machine deployment.

## 4. What this does not prove

- It does not prove that Cormia can already launch unattended on the user's Windows machine.
- It does not run the actual local Granite model; the deterministic provider is used for CI.
- It does not use the user's actual IMMORTAL checkout, local Agent, Task Store, CodingWorkspace files or credentials.
- The separate synthetic two-project concurrent composition test now verifies that two independent project tasks can complete through separate Runtime/Broker, Task Authority, workspace adapters and task journals under one shared Supervisor and deterministic ModelProvider. It is not a live Windows/Granite/IMMORTAL + second-project host run.
- It does not enable code mutation. Only list/read/diff/verify are mapped, and the E2E uses `workspace.read`.
- It does not authenticate mandate, consent, revocation or Task Manifest claims: all those host providers in this test are explicit synthetic doubles.
- It does not issue an evidence certificate; the test verifier returns a fixture reference after checking the in-memory dispatch.

## 5. Next production integration steps

1. Implement the canonical Task Manifest verification path from the already-approved AEP/ADR formats; do not invent a parallel signature envelope while ADR-0008/0009 decisions are open.
2. Wire real host bootstrap/key, operator consent, project descriptor, mandate signature, revocation/monotonic-anchor and host-policy providers.
3. Derive the Planner context from that authenticated Task Manifest and bind the routing provider to the same verified task/project pair.
4. Implement task-scoped worktree isolation and filesystem realpath/symlink-safe adapters before introducing create/replace/patch/test operations.
5. Connect the actual Windows ResourceManager and task-bound Resource Leases.
6. Complete the independent evidence verifier/writer using the existing evidence architecture/prior-art decisions; do not treat a model claim or Broker COMPLETED status as evidence.
7. Run on the user's Windows environment with local Granite, first on IMMORTAL's designated branch, then on an independent second project under the same Supervisor. The existing CI proof is synthetic and is not a substitute for this host acceptance gate.

## 6. Architecture scope

This proof is an implementation milestone under the already-defined Cormia architecture. It changes neither the final architecture nor its objectives. Community support, resource reciprocity, collaboration planes, A2A/MCP, AEP/CRC/Cardano/Materios options and governed evolution remain in the final target.