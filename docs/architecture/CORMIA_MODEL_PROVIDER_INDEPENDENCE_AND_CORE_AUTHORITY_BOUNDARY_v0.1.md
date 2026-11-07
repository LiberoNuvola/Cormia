# Cormia Model Provider Independence & Core Authority Boundary v0.1

- **Date:** 2026-11-07
- **Version:** 0.1
- **Status:** Architecture proposal / non-normative / not implemented as an integrated Runtime contract
- **Scope:** Boundary between IMMORTAL AEP, Cormia Core/Node, and replaceable AI Model Providers
- **Related architecture:** [General-Purpose Autonomous Agent & Mixed Community-Support Architecture v0.1](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- **Related contracts:** [Cormia Core Contracts v0.1](./CORMIA_CORE_CONTRACTS_v0.1.md) · [Core Interface Catalog v0.1](./CORMIA_CORE_INTERFACE_CATALOG_v0.1.md)
- **Related coordination design:** [Coordination Plane and Multi-Node Topology v0.1](./CORMIA_COORDINATION_PLANE_AND_MULTI_NODE_TOPOLOGY_v0.1.md)
- **Normative protocol:** [IMMORTAL AEP — SPEC.md](../../SPEC.md)

## 1. Purpose

This document makes explicit a boundary that must remain true as Cormia evolves:

**Granite is an interchangeable intelligence provider. It is not Cormia Core, the authority for a project, or the executor of privileged operations.**

Cormia must not become a wrapper whose policy, task state, permissions, evidence or continuity depend on one model, model vendor, inference server or prompting convention.

The architecture separates three concerns:

1. **IMMORTAL AEP — normative protocol:** defines the protocol obligations and state semantics for work that is explicitly committed to an AEP task profile, including the applicable execution, verification, challenge, liability, reciprocity and settlement rules.
2. **Cormia Core and Cormia Node — system and enforcement:** own project/task orchestration, mandate and host-policy enforcement, capability mediation, resource admission, durable state, evidence handling and recovery. Cormia Core may operate locally without optional economic, chain, payment or hosted-model integrations.
3. **Model Provider — intelligence:** generates candidate reasoning, plans, classifications, explanations, code and structured action proposals. A provider has no authority merely because it produced an output or a tool-call-shaped response.

These are connected boundaries, not competing implementations of the same responsibility.

## 2. Architectural boundary

### 2.1 IMMORTAL AEP: normative protocol, not the general-purpose LLM runtime

For an AEP-enabled task, the AEP specification and the task's bound normative profile remain authoritative for protocol-level commitments, eligibility, state transitions, verification/dispute semantics and settlement obligations. A Cormia adapter may translate between Core task records and AEP records, but it must not redefine or weaken AEP semantics.

AEP is not the general-purpose model provider, local process supervisor, project conversation store or generic source of filesystem permissions. AEP participation is explicit and profile-bound; local-only project work must not acquire an economic or chain dependency merely because Cormia can integrate with AEP.

Cormia Core must reject or pause an AEP-bound action when the authoritative AEP adapter reports that the required protocol state or obligation is not satisfied. A model response cannot override that result.

### 2.2 Cormia Core: operational control plane

Cormia Core owns the trusted orchestration path. Its responsibilities include:

- loading the project descriptor, mandate references, current task scope and host policy;
- resolving the effective operational authority using trusted providers;
- maintaining authoritative project/task/attempt state and recovery checkpoints;
- creating and validating plans and binding approved execution to their digest;
- exposing only bounded capabilities through a host-controlled Capability Broker;
- acquiring and releasing resource leases through the Resource Manager/Resource Provider;
- enforcing workspace, path, network, process, privacy and concurrency restrictions through the relevant host adapters;
- recording approvals, actual tool invocations, results, verification and evidence references;
- reconciling optional AEP, repository, payment, identity, storage and certification adapters without silently making them prerequisites of local execution.

The Core is not free to invent authority. Its decisions must derive from the applicable mandate, task request, host policy and, for AEP-bound work, the AEP contract. The Core is the enforcement and orchestration point for those sources.

### 2.3 Model Provider: replaceable intelligence

A Model Provider performs inference. Granite accessed through llama.cpp is one possible local provider implementation.

A provider may propose:
- task decomposition and plans;
- file or document interpretations;
- code and patches;
- classifications, reviews and verification suggestions;
- structured operation intents.

A provider does not:
- create, approve, widen, suspend or revoke a Project Mandate;
- decide that a plan or action is authorized;
- become the source of truth for project, task, attempt, approval, lease or AEP state;
- grant itself tools, credentials, network access, filesystem access or resource capacity;
- execute a tool merely by returning a function-call or tool-call payload;
- certify its own output as correct or its own task as complete;
- select an undisclosed remote fallback or change the task's data-egress boundary.

Model output is untrusted input, even when syntactically valid, confidently expressed, locally generated or returned by a model advertised as tool-capable.

## 3. Authority composition

For ordinary operational capabilities, the effective action scope is bounded by the intersection of all applicable trusted constraints:

`EffectiveCapabilities = Mandate ∩ TaskRequest ∩ HostPolicy ∩ ResourceLease`

For AEP-bound work, the action must additionally satisfy the applicable AEP task commitment and protocol state. This is an additional admissibility condition, not a reason to merge the AEP state machine with the project, mandate or local task state machine.

Rules:

1. The model may suggest requested capabilities, but it cannot add them to the effective set.
2. A task request may narrow a mandate; it cannot widen it.
3. Host policy and resource admission may impose stricter limits.
4. A resource offer or lease makes capacity available; it does not grant permission to use that capacity for an otherwise unauthorized operation.
5. Financial patronage, CRC, donated compute, model quality, provider reputation or a model's confidence score grant no operational authority.
6. No model, prompt, skill, memory, agent-generated plan or tool result may alter the trusted mandate, host policy, approval record or AEP state.
7. A protected action remains subject to its separate authority/approval requirement even if it appears in an approved plan.

## 4. Core components and ownership

| Component / boundary | Owner | Responsibility | Must not be delegated to a Model Provider |
| --- | --- | --- | --- |
| Project and task journal | Cormia Core | Durable state, attempts, checkpoints, recovery | Task truth or terminal status |
| Mandate and policy resolver | Cormia Core + trusted host providers | Establish and re-check authority | Identity, consent, mandate validity or permission decisions |
| Plan validator and execution gate | Cormia Core | Validate plan shape, scope, digest and transition | Plan approval or authority expansion |
| Capability Broker | Cormia Core + host adapters | Authorize and dispatch each operation | Direct tool execution or credential custody |
| Resource Manager / Provider | Cormia Node / trusted host | Resource admission, lease, limits and release | Self-reported capacity as authoritative admission |
| AEP adapter | Cormia integration boundary | Bind protocol records and return authoritative AEP decisions | Reinterpretation of normative AEP rules |
| Evidence Store / verifier interfaces | Cormia Core and independent verifier profiles | Preserve provenance and validate acceptance criteria | Self-certification by the model |
| Model Provider adapter | Intelligence integration | Inference request/response and provider metadata | Policy, task state, tools or authority |

The table describes intended responsibility boundaries. It does not claim that every component is integrated or production-ready.

## 5. Model Provider interface — conceptual contract

A provider-neutral Core port is required. The following is a conceptual boundary, not a frozen TypeScript API or implemented interface:

```typescript
interface ModelProvider {
  describe(): Promise<ModelDescriptor>;
  health(): Promise<ModelHealth>;
  generate(request: ModelRequest, options?: GenerateOptions): Promise<ModelResponse>;
  cancel?(generationRef: string): Promise<void>;
}
```

The contract should be kept deliberately small:

- `ModelDescriptor` identifies the provider adapter and observed model/version/quantization/runtime metadata. It is descriptive; it is not an authorization credential.
- `ModelRequest` carries only the task-scoped context and output contract that Core policy permits the provider to receive.
- `ModelResponse` carries generated content or structured proposals, finish status and usage/provider metadata. It does not contain an authoritative state transition.
- cancellation and provider health are operational signals; they do not decide whether a Cormia task is complete, failed or accepted.

The Core port must not expose host credentials, raw filesystem handles, unrestricted shell access or executable tool closures to the provider.

If a provider supports native function calling, the returned call is treated as an **untrusted operation intent**. Cormia validates its schema, resolves it against the approved capability registry, re-evaluates mandate/task/host/resource/AEP constraints and obtains any required approval before dispatch. Provider-side function calling is not a substitute for the Capability Broker.

Provider-specific features (streaming, constrained decoding, embeddings, multimodal inputs, caching or fine-tuning) belong behind optional adapter capabilities. Their absence must not change Core authority semantics.

## 6. Plan and execution boundary

Plan–Execute is a Cormia Core workflow, not a Granite feature.

### PLAN

- Core creates a plan-generation request in a mode with **no executable tools or capabilities supplied to the provider**.
- The provider returns a candidate plan as untrusted data.
- Core validates the required schema, task binding, file/workspace scope, non-goals, resource profile, acceptance criteria and requested operation set.
- Core canonicalizes and hashes the validated plan, records the model-provider metadata and stores the plan as pending approval or as pending the authority decision defined by the project policy.
- Any human/steward approval is recorded by a trusted Core/host path, bound to that exact plan digest and relevant mandate/task revision.

A model's statement that it has completed PLAN is not proof that no tool was called. The Core enforces tool-free PLAN by not providing tool capabilities and by rejecting any attempted operation in that phase.

### EXECUTE

- Execution can begin only from a validated plan whose required approval/authority conditions are satisfied.
- Each operation is re-authorized by Core at dispatch time; plan approval does not create capabilities or override protected-action policy.
- Model-generated operation intents are proposals only. The Capability Broker is the sole path to host tools.
- The actual path, arguments, tool identity, approval result, lease, output and evidence reference are recorded by Core.
- If the plan, mandate revision, task binding or relevant policy digest changes, the prior approval cannot be silently reused. The changed plan must be revalidated and, where required, reapproved.

### VERIFY / REVIEW

Verification is a separate responsibility from generation. Core invokes the declared deterministic tests or independent verifier profile, compares results with frozen acceptance criteria, and records the outcome. A review model may assist with analysis but cannot write, approve its own patch, or turn its own claim into an accepted result.

This section establishes the authority boundary only. A dedicated Plan–Execute Gate specification and its conformance suite must be maintained separately; this document does not implement or freeze that gate.

## 7. Provider selection, locality and failover

1. **No silent remote fallback.** Local-only mode must remain local. A remote provider can be used only when explicitly configured and allowed by project privacy, host policy and any applicable mandate.
2. **Data egress is explicit.** Before a remote provider receives task data, Core must apply the declared egress policy and record the provider boundary. Secrets and credentials remain in the host/credential broker.
3. **Attempt pinning.** Each task attempt records the selected provider adapter, model identifier/revision or artifact digest where available, inference runtime/version, relevant generation configuration digest and local/remote classification.
4. **Failover is a policy decision.** A provider outage does not authorize the model or adapter to select another provider. Core may fail over only under an explicit provider/failover policy that permits the target provider and data class. The switch is recorded as an attempt/provider event; otherwise the task is paused or marked blocked.
5. **No hidden model ensemble.** Multi-model voting, review or routing is a separately configured workflow with resource and privacy bounds, not an implicit provider behavior.
6. **Resource admission remains external to the provider.** Core/Node checks current RAM, VRAM, CPU, storage, concurrency, lease and host limits. A provider's capacity advertisement is not proof that a node has admitted the workload.

## 8. Multi-node and Mesh implications

- A Cormia Node may expose one or more host-approved model providers, including a local model, an explicitly configured remote endpoint or a bounded inference service offered by another node.
- The project's Coordination Plane and trusted mandate/host policy determine task assignment and permitted data flow. The model provider does not become the coordinator or project steward.
- A worker node executes only the task scope and resource lease accepted by its local host boundary. A remote inference provider receives only the data and capabilities allowed by the task's egress and privacy policy.
- Provider location does not change the authority model. A local Granite process is not trusted with more permissions merely because it runs on the same PC; a remote provider is not trusted merely because it is part of the Mesh.
- A node without an LLM may still provide deterministic verification, storage, artifact transport or other host-approved services.
- The Mesh must not require one central model. Different nodes may use different providers, versions and hardware while conforming to the same Core contracts and task/evidence schemas.

This is compatible with the existing proposed owner-controlled Coordination Plane and worker-side Resource Provider boundary. It does not claim that a multi-node provider registry, authenticated peer transport or distributed inference runtime is implemented.

## 9. Evidence and audit

For each inference attempt, Core should retain enough metadata to explain which provider influenced a result without storing unnecessary private prompt or output content.

At minimum, the attempt/evidence record should bind:

- task, attempt and plan identifiers/digests;
- provider adapter ID and observed model ID/revision or artifact digest where available;
- local/remote classification and relevant runtime/configuration identifiers;
- request and response digests or protected artifact references under the project's data-retention policy;
- finish status and usage/resource observations, with their sources and limitations;
- proposed operation intents, actual dispatched operations and their arguments or protected references;
- authorization/approval decisions, resource lease references and execution results;
- verifier profile/version, test output digest and acceptance decision.

A model transcript, provider signature, tool-call JSON, self-reported token count, hash chain or model-generated summary is not by itself proof of task correctness, authorization, resource usage or AEP settlement. Evidence dimensions must remain distinct.

## 10. Degraded operation and recovery

Loss, overload, timeout or incompatibility of a Model Provider must not corrupt Cormia's durable state.

- Core preserves plan, task, attempt, approvals and collected evidence.
- Tasks that require further inference may be paused/blocked with a typed reason.
- Deterministic work independent of inference may continue if its own mandate, dependencies, resource lease and policy permit it.
- No retry may silently duplicate side effects. Resume/retry is controlled by durable Core state and idempotency/reconciliation rules.
- Provider restart or replacement must not reset the task, erase evidence, change the plan digest or widen authority.
- The Resource Manager may pause inference or reject a new load without allowing the provider to override the decision.

Graceful degradation means preserving state and completing only work that remains valid without the unavailable provider; it does not promise that generative tasks can finish without inference.

## 11. Conformance requirements

A provider/Core integration is not conformant merely because it can generate text or return OpenAI-compatible responses. At minimum, its test suite must demonstrate:

| Test | Required result |
| --- | --- |
| Replace Granite with another conforming provider | Same Core authority and capability checks remain in force |
| PLAN phase | No tool definitions/capabilities supplied; any attempted operation is rejected |
| Tool-call-shaped model output | Treated as an intent; no direct execution |
| Prompt injection asks to widen authority | Mandate and host policy remain unchanged |
| Provider asks for an out-of-scope path | Capability Broker denies it |
| Invalid/ambiguous structured output | Rejected or escalated; never interpreted as approval |
| Provider unavailable | Task state/evidence preserved; no silent provider switch |
| Remote fallback requested by model | Denied unless independently allowed by explicit Core policy |
| Resource Manager denies admission | No inference load or execution bypass |
| AEP-bound task has an inadmissible protocol state | Core blocks the AEP-bound operation |
| AEP adapter unavailable for a task that requires it | Task is blocked; local non-AEP tasks remain independent |
| Model claims its own completion | Core still requires declared verification and acceptance evidence |
| Node without an LLM | Deterministic Core services remain available within their declared limits |

Per-provider test scores may differ. Conformance means preserving the system boundary, not guaranteeing equal model quality.

## 12. Current implementation boundary

The repository already contains architecture proposals and isolated Core slices relevant to this design: Project Mandate/Project Lifecycle/Resource Provider/Community Support contracts, versioned Core records, a local Project Lifecycle journal/reducer, a trusted-context resolver contract tested with synthetic provider doubles, and a worker-local Resource Provider adapter.

The documented limits remain material:

- the Core slices are not yet one integrated production Runtime;
- trusted project/mandate identity, consent, revocation and host-policy providers remain production gaps;
- the local Resource Provider is not a durable multi-node scheduler and is not connected to the Agent execution loop;
- the journal and resolver are not integrated with the current Local Agent/Granite process;
- no generic provider-neutral ModelProvider adapter/registry and no Core-enforced Plan–Execute Gate are claimed as implemented;
- no production multi-node model-routing or distributed-inference layer is claimed.

The local IMMORTAL Agent/Granite installation is therefore a current prototype and integration input, not the definition of Cormia Core and not evidence that the provider-neutral architecture is complete.

## 13. Non-goals

This proposal does not:

- select Granite, Qwen, Llama, Mistral or any other model as the preferred Cormia provider;
- require a hosted model, account, subscription, wallet, Cardano, CRC, payment provider or AEP settlement for local-only work;
- create a new task/mandate authority format or replace ADR-0010;
- implement a ModelProvider API, provider registry, Plan–Execute Gate, distributed inference engine, model marketplace or remote routing service;
- modify the current IMMORTAL Local Agent, its Task Store, Resource Manager, MCP servers, prompts, allowlist or local configuration;
- alter ECC-01 fixtures, execution results or evidence;
- claim production conformance, security certification, task correctness or AEP settlement.

## 14. Proposed implementation order

1. Review this boundary document against the existing Core contracts, ADR-0010, AEP SPEC and Coordination Plane proposal.
2. Freeze the minimal provider-neutral port and its metadata/evidence requirements as a separate interface proposal.
3. Specify Plan–Execute Gate as a separate Core state machine and adversarial conformance suite; keep it independent of any one provider's tool-calling format.
4. Add provider contract tests using at least two materially different provider adapters or deterministic test doubles; verify that authority behavior is unchanged.
5. Integrate only after trusted mandate/host-policy providers and the Capability Broker have a tested enforcement boundary.
6. Treat any Mesh/remote provider routing as a later adapter with explicit identity, lease, privacy and egress tests.

A successful model swap test demonstrates provider independence at the tested boundary. It does not, by itself, certify the whole Cormia Runtime.

## 15. Related sources

- [Cormia General-Purpose Autonomous Agent & Mixed Community-Support Architecture v0.1](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- [Cormia Core Contracts v0.1](./CORMIA_CORE_CONTRACTS_v0.1.md)
- [Cormia Core Interface Catalog v0.1](./CORMIA_CORE_INTERFACE_CATALOG_v0.1.md)
- [Cormia Coordination Plane and Multi-Node Topology v0.1](./CORMIA_COORDINATION_PLANE_AND_MULTI_NODE_TOPOLOGY_v0.1.md)
- [IMMORTAL AEP normative specification](../../SPEC.md)
- [Cormia Prior-Art Composition Review](../research/CORMIA_PRIOR_ART_COMPOSITION_REVIEW_2026-11-03.md)
