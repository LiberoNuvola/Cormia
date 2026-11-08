# Cormia Model Task Planner and Read-only Workspace Execution v0.1

- **Date:** 2026-11-08
- **Status:** local ModelProvider planner and bounded read-only operation mapping implemented as isolated slices; production task-context and evidence providers not yet wired
- **Parent architecture:** [General-Purpose Autonomous Agent & Mixed Community-Support Architecture](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- **Execution priority:** [Multi-Project Autonomous Runtime](./CORMIA_MULTI_PROJECT_AUTONOMOUS_RUNTIME_v0.1.md)
- **Host orchestration:** [Local Project Supervisor v0.1](./CORMIA_PROJECT_SUPERVISOR_v0.1.md)
- **Plan authorization:** [Plan–Execute Capability Broker v0.1](./CORMIA_PLAN_EXECUTE_CAPABILITY_BROKER_v0.1.md)
- **Workspace capability proposal:** [ADR-0007](../adr/0007-proposed-task-capabilities-and-workspace-scope.md)

## 1. Purpose

Connect a host-selected, verified task to the configured Cormia ModelProvider without giving the model project-selection authority, filesystem access, credentials, tools or a dispatch function. The model returns a bounded inert proposal. The existing Project Runtime Registry and Capability Broker decide whether any proposed step may execute.

The first concrete CodingWorkspace integration remains read-only. This is deliberate: the legacy local CodingWorkspace has separate interactive approval gates for writes, patches and tests, and a shared workspace root that is not yet task-isolated. The new Runtime must not call those operations directly or reinterpret the old per-operation approval prompt as an unattended standing mandate.

## 2. Model Task Planner

Implementation: \`runtime/core/model-task-planner.mjs\`.

\`createModelTaskPlanner()\` captures:
- one host-configured ModelProvider instance;
- one host-pinned generation profile reference;
- one trusted \`taskContextProvider.resolveVerifiedPlanningContext({ taskRef, projectRef })\` port;
- bounded generation deadline/response and a host clock/ID factory.

The initial default requires a **local** provider. It reads and validates the provider descriptor and health and refuses planning unless the exact provider instance is ready. There is no remote-provider fallback. The llama.cpp adapter remains host-configured; the task/model cannot choose its endpoint, model alias or generation profile.

The task context must bind exactly:
- host-selected taskRef;
- host-selected projectRef;
- the same manifestDigest recorded in the durable Cormia task;
- a non-empty, bounded, unique requestedOperations list sourced from the authenticated Task Manifest projection.

A digest-shaped value is not proof of a valid signature. Production signature/claims verification remains the responsibility of the host Task Authority provider, which is not yet integrated.

The planner sends a JSON generation request with:
- a planning-only instruction;
- bounded task goal/source metadata and the verified requested-operation list;
- an explicit JSON output contract;
- host-generated request/attempt references and a bounded deadline.

It sends no \`tools\`, \`tool_choice\`, dispatch function, broker handle, workspace path root, credential, host policy, resource manager, project registry or authority provider. A model's tool-call-shaped response remains inert provider data. Responses with a non-completed finish reason, warnings, malformed JSON, unknown fields, unsupported operation IDs or an operation outside the verified requestedOperations list are rejected.

The only accepted output is the bounded \`cormia.plan-proposal/0.1\` object. It is **not** authorization and not evidence that anything ran.

## 3. Core authorization and dispatch path

The host Model Task Planner returns an inert proposal to the fixed host executor. The executor calls the task-bound Supervisor context's \`preparePlan(proposal)\`, which reaches the Project Runtime Registry. The Registry derives the Runtime from its host-verified task route; no request accepts a model-selected projectRef.

The selected Project Runtime invokes the existing Plan–Execute Capability Broker:
1. load the verified task projection;
2. create a task session using the project's captured Trusted Project Resolver;
3. validate each operation and fixed host adapter input;
4. authorize against the existing Mandate ∩ TaskRequest ∩ HostPolicy relation;
5. create a Core-owned READY plan with a digest, but do not dispatch;
6. on separate host EXECUTE, revalidate Task Manifest, mandate/consent/revocation/lifecycle/host policy and any required Resource Lease immediately before the fixed adapter.

The Broker now also passes authorization fields such as \`relativePath\` into the adapter's side-effect-free PLAN validator. This lets the workspace adapter require the actual input path to equal the path that was authorized.

## 4. Model-backed task executor composition

Implementation: \`createModelBackedTaskExecutor()\` in \`runtime/core/model-task-planner.mjs\`.

The host executor:
1. asks the planner for one bounded proposal for the current task attempt;
2. submits it to the task-bound \`preparePlan\` callback;
3. appends a durable pre-execution checkpoint, conservatively marking the possible side-effect boundary as \`unknown\`;
4. submits the READY plan to task-bound EXECUTE;
5. requires a host-injected \`resultVerifier.verifyTaskResult()\` to independently inspect the actual result and durably persist evidence;
6. returns \`completed\` only with non-empty verifier-issued evidence references.

A plan denied by Core returns a blocked task outcome and does not call EXECUTE. An uncertain EXECUTE result or a verification failure throws; the Supervisor records the attempt as \`recovery_required\` instead of claiming success or automatically retrying. A provider-unavailable/planning failure is blocked for host-controlled recovery, not silently switched to a different model.

This is one bounded planning pass per attempt, not yet an observe→reason→replan loop or a long-running autonomous agent. Subtasks, plan revisions, human-readable progress summaries and adaptive re-planning remain later steps.

## 5. Fixed read-only CodingWorkspace operation set

Implementation:
- \`runtime/reference-worker/immortal-coding-workspace-readonly-adapter.mjs\`
- \`runtime/reference-worker/immortal-coding-workspace-operation-adapters.mjs\`
- \`runtime/reference-worker/immortal-coding-workspace-operation-adapters.test.mjs\`

The fixed protocol mapping is:

| Cormia/AEP proposal ID | Existing local CodingWorkspace tool |
|---|---|
| \`workspace.list\` | \`workspace_list\` |
| \`workspace.read\` | \`workspace_read\` |
| \`workspace.diff\` | \`workspace_diff\` |
| \`workspace.verify\` | \`workspace_verify\` |

The wrapper uses host-configured exact directory and file allowlists and confirms that the underlying legacy tool exists and does not require interactive approval. The new Runtime adapter validates its inputs during PLAN and checks that the supplied \`relativePath\` exactly matches the normalized host-authorized path. \`workspace.verify\` accepts one file per plan step, so each file gets its own capability/path decision.

The adapter exposes no:
- \`workspace.create\`, \`workspace.replace\` or \`workspace.patch\`;
- \`workspace.test\` or \`workspace.build\`;
- arbitrary shell/command execution;
- Git write, branch, commit, push or pull-request operations;
- wallet, Cardano, signing or settlement operation.

It does not weaken or route around the existing Agent's \`APPROVO\` approval flow.

## 6. Evidence and task completion

The planner's response digest, proposed steps and READY plan digest are diagnostic/source records, not proof of execution. Broker COMPLETED status alone is also not semantic correctness evidence.

The task executor therefore requires a separate trusted host verifier. For the real IMMORTAL integration, that verifier must inspect the scoped workspace state, relevant Git revision/diff, allowed verification/test output and operation receipts, then persist immutable evidence and return opaque evidence references. The store only records those references; it does not validate their contents.

No production verifier or signed evidence-certificate format is wired by this slice. Do not report a task complete solely because the model says it is complete or the Broker returned COMPLETED.

## 7. Current implementation and CI evidence

The source contains:
- ModelProvider request/response contract and deterministic test provider;
- loopback-only llama.cpp adapter and a user-completed Granite smoke test;
- strict Model Task Planner and host-backed executor composition;
- Project Runtime Registry and Broker path-bound PLAN validation;
- exact read-only CodingWorkspace mapping.

GitHub Actions [run #42452250557](https://github.com/LiberoNuvola/Cormia/actions/runs/42452250557) on the current planner/test commit passed:
- **149 Core Node tests — 149 PASS / 0 FAIL**;
- **7 read-only CodingWorkspace operation-adapter tests — 7 PASS / 0 FAIL**.

These are contract and synthetic-port tests. They do not demonstrate that the user's Windows Agent, Cormia service, Granite server, real Task Manifest verifier, real host mandate providers or workspace has been wired into this composition.

## 8. Remaining production gates

Before unattended IMMORTAL task execution can be claimed:
1. implement and host-configure a production signed Task Manifest verifier and task-to-project routing provider;
2. implement real project descriptor, mandate/key bootstrap, operator consent, revocation/monotonic-anchor and host-policy providers;
3. derive the planner context from the authenticated Task Manifest, not from caller/model content;
4. implement a task-scoped worktree/workspace root and realpath/symlink-safe fixed operation adapters;
5. preserve the legacy CodingWorkspace approval path and enable create/replace/patch/test only after task worktree isolation and standing project mandate/child-grant tests pass;
6. integrate the actual local ResourceManager through bounded task-bound Resource Leases;
7. implement the independent verifier/evidence writer and crash-safe reconciliation of external effects;
8. compose and run the real Windows service, then prove one IMMORTAL task and a second independent project progress without context, authority, workspace or resource leakage.

The user's Windows \`E:\\AI\\Immortal-Agent-v0.7\`, local data, existing task store, prompts, MCP bridge, Granite settings and the IMMORTAL repository have not been changed by this implementation.

## 9. Scope and architecture

This is the first usable bridge between Cormia's generic ModelProvider boundary, project-scoped authority and the existing read-only workspace compatibility surface. It is an implementation priority under the general Cormia architecture, not a new or narrower architecture. All final architecture goals, collaboration planes, community/resource/economic support layers, AEP/CRC/Cardano/Materios options and governed evolution remain as previously defined.
