# Cormia Model Provider Contract v0.1

- **Date:** 2026-11-07
- **Version:** 0.1
- **Status:** Interface proposal / non-normative / initial in-process validation and deterministic test double implemented; production provider adapter and integrated authority path not implemented
- **Scope:** Provider-neutral inference boundary between Cormia Core and local or explicitly configured remote model runtimes
- **Authority boundary:** [Cormia Model Provider Independence & Core Authority Boundary v0.1](./CORMIA_MODEL_PROVIDER_INDEPENDENCE_AND_CORE_AUTHORITY_BOUNDARY_v0.1.md)
- **Core contracts:** [Cormia Core Contracts v0.1](./CORMIA_CORE_CONTRACTS_v0.1.md) · [Core Interface Catalog v0.1](./CORMIA_CORE_INTERFACE_CATALOG_v0.1.md)
- **Normative protocol:** [IMMORTAL AEP — SPEC.md](../../SPEC.md)

## 1. Purpose and status

This proposal defines the narrow interface through which Cormia Core requests inference from a Model Provider and receives a candidate result.

It is intended to make Granite replaceable without moving project/task state, mandate resolution, host policy, capability enforcement, resource admission, approvals, verification or evidence authority into the model layer.

This is an interface proposal only. It does not define a model marketplace, provider-routing service, registry database, distributed inference protocol, model-training system or production API. The TypeScript-like declarations below are illustrative contract shapes, not a frozen generated API or JSON Schema.

## 2. Non-negotiable interface rules

1. **Inference only:** the provider generates candidate content. It is not a project orchestrator, policy engine, task journal, capability broker or verifier of record.
2. **No authority in provider metadata:** model IDs, provider descriptions, self-reported capabilities, health and usage do not grant permissions or prove trustworthiness.
3. **Core-owned selection:** only trusted Core configuration/policy selects the provider and model for an attempt. A prompt or model output cannot switch providers.
4. **Task-scoped input:** Core supplies only the information allowed by project, task, privacy and data-egress policy.
5. **No credentials or host handles:** requests must not carry API keys, bearer tokens, signing keys, wallet secrets, raw filesystem handles, unrestricted shell access or executable tool closures.
6. **No direct tool execution:** provider output is data. Function-call-shaped output is an inert proposal until Core validates and dispatches it through the Capability Broker.
7. **Local-first and no silent fallback:** local-only means local-only. A remote endpoint requires explicit host configuration and policy authorization. Provider failure never authorizes implicit failover.
8. **Resource admission outside the provider:** Core/Node decides whether resources are available and admits the inference workload. A provider's capacity claim is informational.
9. **Durable attempt binding:** Core owns task/attempt identifiers and records provider/model/runtime selection and relevant request/result digests.
10. **Provider replacement must not change authority:** a provider swap may change output quality or supported features, but cannot change mandates, capabilities, approvals, task truth or AEP obligations.

## 3. Responsibility and ownership

| Concern | Owner | Model Provider role |
| --- | --- | --- |
| Project, task and attempt identity/state | Cormia Core | Receives opaque scoped references; cannot mutate authoritative state |
| Project Mandate and child authority | Core plus trusted mandate/host providers | No authority role |
| Provider/model selection | Core configuration and policy | Reports observed descriptor only |
| Resource admission and lease | Cormia Node / Resource Manager | Reports local requirements or limitations; does not admit itself |
| Inference generation | Model Provider | Executes inference and returns candidate output |
| Tool/capability authorization | Capability Broker | Cannot grant or exercise capabilities |
| Tool execution | Trusted host adapter through Core | No direct execution |
| Verification and acceptance | Core verifier interfaces / declared independent profile | May suggest tests or review; cannot self-certify |
| AEP protocol state and obligations | IMMORTAL AEP adapter and normative task profile | No authority to reinterpret or bypass |
| Durable evidence and audit | Cormia Core / evidence subsystem | Supplies metadata and output; Core records and validates it |

This table describes intended responsibility boundaries. It does not claim that every component is integrated or production-ready.

## 4. Minimal provider port

The proposed port is intentionally small:

~~~typescript
interface ModelProvider {
  describe(): Promise<ModelProviderDescriptor>;
  health(): Promise<ModelProviderHealth>;
  generate(request: ModelGenerationRequest): Promise<ModelGenerationResponse>;
  cancel?(providerRequestRef: string): Promise<ModelCancelResult>;
}
~~~

The Core may use a trusted adapter wrapper around a vendor SDK, local inference server or another node's explicitly configured inference endpoint. The wrapper normalizes transport and provider-specific formats; it must not become an alternate authority path.

A provider adapter must not receive the Core's capability registry, host policy object, approval authority, mandate verifier, task-store write handle or credential-broker secrets.

## 5. Contract data shapes

The following shapes are conceptual v0.1 proposal types. They are not yet published JSON Schemas.

### 5.1 ModelProviderDescriptor

~~~typescript
interface ModelProviderDescriptor {
  contractVersion: "cormia.model-provider/0.1";
  providerAdapterId: string;
  adapterVersion: string;
  providerInstanceRef: string;
  locality: "local" | "remote";
  endpointClass: "host_process" | "host_service" | "configured_remote" | "mesh_worker";
  observedModelId: string;
  observedModelRevision?: string;
  modelArtifactDigest?: string;
  inferenceRuntime: {
    name: string;
    version?: string;
    buildRef?: string;
  };
  featureHints: Array<
    | "structured_json"
    | "json_schema_constrained_output"
    | "streaming"
    | "image_input"
    | "audio_input"
    | "video_input"
    | "embeddings"
    | "best_effort_cancel"
  >;
}
~~~

Rules:

- The host supplies or pins the trusted adapter configuration and expected endpoint. The descriptor is observed metadata, not proof that a binary, model artifact or remote endpoint is trustworthy.
- Feature hints are descriptive and may be challenged by conformance tests. They are not capabilities to access Cormia tools, data or resources.
- No feature hint named tool execution or authority exists. If a provider uses a vendor-native tool-call format, the adapter must normalize it into inert proposal data.
- Remote identity, transport authentication, artifact integrity and data-egress permission are separate host/Core concerns and are not proven by this descriptor.

### 5.2 ModelProviderHealth

~~~typescript
interface ModelProviderHealth {
  providerInstanceRef: string;
  observedAt: string;
  status: "ready" | "degraded" | "unavailable" | "unknown";
  reasonCode?: string;
  observedLimits?: {
    maxContextTokens?: number;
    maxOutputTokens?: number;
    concurrencyHint?: number;
  };
}
~~~

Health is a point-in-time observation. Ready does not reserve RAM/VRAM, create a resource lease, guarantee a successful generation or authorize a task. Admission remains a separate Core/Node decision.

### 5.3 ModelGenerationRequest

~~~typescript
interface ModelGenerationRequest {
  contractVersion: "cormia.model-provider/0.1";
  requestRef: string;       // Core-generated, unique within the provider attempt
  taskRef: string;          // opaque, non-authorizing reference
  attemptRef: string;       // Core-owned attempt identifier
  purpose: "plan" | "reason" | "code" | "classify" | "review" | "summarize";
  input: Array<{
    kind: "instruction" | "text" | "artifact";
    mediaType?: string;
    text?: string;
    artifactRef?: string;
    artifactDigest?: string;
  }>;
  outputContract: {
    format: "text" | "json";
    schemaRef?: string;
    schemaDigest?: string;
  };
  generationProfileRef: string; // trusted, host-resolved profile identifier
  deadlineAt?: string;
}
~~~

Rules:

- Core creates all identifiers and resolves the generation profile. The caller/model cannot use request fields to select an arbitrary endpoint, local file path, model, credential or tool.
- The input is already filtered by Core data policy. An artifact reference is not automatically a grant to fetch it; the provider adapter receives only materialized, authorized input.
- The request contains no arbitrary URL-fetch directive, filesystem path capability, shell command, MCP server definition, tool implementation or raw secret.
- Generation settings (temperature, context budget, output limit, seed and similar provider parameters) are resolved and bounded by trusted Core/host profiles. They are not free-form authority fields supplied by model output.
- For PLAN requests, Core supplies no executable tool definitions or capabilities. A provider returning a tool-call-shaped payload does not cause a dispatch.
- Task, attempt and plan references are correlation identifiers, not bearer tokens and not proof of mandate authorization.

### 5.4 ModelGenerationResponse

~~~typescript
interface ModelGenerationResponse {
  contractVersion: "cormia.model-provider/0.1";
  requestRef: string;
  providerRequestRef?: string;
  observedProvider: {
    providerAdapterId: string;
    providerInstanceRef: string;
    observedModelId: string;
    observedModelRevision?: string;
  };
  output: {
    format: "text" | "json";
    content: string;
    contentDigest?: string;
  };
  finishReason: "completed" | "length" | "cancelled" | "provider_error";
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    source: "provider_reported" | "host_measured" | "unknown";
  };
  warnings?: string[];
  providerMetadata?: Record<string, string | number | boolean | null>;
}
~~~

Rules:

- Core verifies that the response is bound to the outstanding request and expected provider instance. Unexpected, duplicate, late or mismatched responses are rejected or quarantined.
- JSON output is untrusted data. Core validates it against the declared schema and then applies semantic, task, authority and path checks. Schema-valid JSON is not approval.
- A response may contain a proposed plan, patch text, review finding or operation intent. None is an authoritative state transition or a tool invocation.
- Usage counters are source-labelled. Provider-reported token counts are not host resource measurements and cannot by themselves establish cost, compute contribution or reward eligibility.
- Provider metadata is bounded, redacted and treated as untrusted. It must not contain credentials or arbitrary executable instructions.
- Truncation, refusal, malformed output, missing required fields or schema mismatch cannot be treated as successful completion.

### 5.5 ModelCancelResult

~~~typescript
interface ModelCancelResult {
  providerRequestRef: string;
  status: "accepted" | "unsupported" | "already_finished" | "unknown";
}
~~~

Cancellation is best-effort inference control. Even when accepted, it does not roll back a side effect already dispatched by Core, revoke a resource lease or determine task state. Core owns cancellation/reconciliation of the task and any in-flight authorized operation.

## 6. Operation intents and tool-calling formats

Vendor-native function calling is an optional transport feature, not a Cormia execution protocol.

If an adapter accepts provider-native tool-call output, it must:

1. convert the result into inert, versioned operation-intent data;
2. retain the raw provider response only according to task evidence/privacy policy;
3. validate the intent against a Core-owned operation schema;
4. check the approved plan, task scope, workspace, mandate, host policy and required resource lease;
5. ask for a separate approval where the action is protected;
6. dispatch only through the Capability Broker and host adapter;
7. record the actual dispatched operation and result.

The adapter must never receive general MCP servers, an unrestricted tool registry or executable callbacks. A model-supplied tool name is only an untrusted string until Core resolves it against the fixed, approved operation registry.

For PLAN, there are no executable tool definitions. For EXECUTE, operation-intent schemas may be provided where useful, but actual capabilities remain exclusively in Core and are evaluated per operation.

## 7. Provider selection, locality and failover

- Provider selection is made by trusted Core configuration/policy before the attempt. The model cannot nominate itself or select a fallback.
- Local-only tasks use a locally configured provider. If unavailable, Core pauses/blocks inference-dependent work or reports that no local provider is available.
- Remote provider use requires explicit endpoint configuration, transport trust, task/project data-egress permission and any applicable mandate/host-policy authorization.
- Provider switching starts a new recorded provider attempt. It must not silently reuse unredacted context across a different locality or data classification.
- Automatic retries against the same pinned provider may occur only under a bounded retry policy with idempotent inference semantics and resource admission. Retries must not duplicate tool side effects because the provider never executes tools.
- Multi-model voting, independent model review or routing is a separately declared workflow with explicit privacy, resource and acceptance rules. It is not an implicit feature of this interface.
- A remote inference provider does not become a Cormia coordinator, project steward or task authority merely because it runs on a peer node.

## 8. Resource and runtime boundary

The Model Provider interface does not own resource admission.

Before generation, Core/Node decides whether the request fits current host policy and available resources. Where applicable, the host acquires a bounded resource lease and binds it to the inference attempt. The lease expresses admitted capacity; it does not grant operation permissions.

The provider may expose observed context limits, concurrency hints or a best-effort estimate. Core treats those as scheduling inputs, not authoritative telemetry. Actual host CPU/RAM/VRAM observations and lease decisions remain attributed to their real host source.

A Resource Manager denial must prevent the generation call from being started or queued in a way that violates declared policy. The provider cannot override admission, launch a secondary model or move work to a remote node.

## 9. Error vocabulary and retry boundary

The adapter should normalize provider failures to a bounded error family:

- provider_unavailable
- provider_timeout
- provider_resource_exhausted
- request_unsupported
- context_limit_exceeded
- generation_truncated
- provider_refused
- invalid_provider_response
- provider_identity_mismatch
- provider_cancelled
- provider_internal_error

The normalized error includes the provider/request reference where available, a retryability hint and a redacted diagnostic reference. It must not contain raw secrets or private prompt contents.

The retryability hint is advisory. Core policy decides whether to retry, pause, select an explicitly allowed alternative, or terminate the attempt. A provider error never authorizes an authority or privacy boundary change.

## 10. Attempt metadata and evidence

Core should bind at least the following to the task attempt:

- provider adapter ID and adapter version;
- provider instance reference and locality classification;
- observed model ID/revision and model artifact digest where available;
- inference runtime name/version/build reference;
- generation-profile reference/digest;
- request and response digest or protected artifact references;
- request start/end and finish reason;
- usage and resource observations with explicit source attribution;
- normalized errors/retry decisions and any provider switch event;
- resource lease reference where applicable;
- proposed operation-intent digests, actual dispatched operation evidence and authorization decisions.

Do not store private prompts, data or raw outputs in public project records by default. Retention, access and redaction remain governed by project privacy policy. A digest proves correspondence to bytes under the named hash method; it does not prove truth or correctness.

## 11. AEP boundary

For tasks that explicitly opt into or are committed under an AEP task profile:

- AEP task commitment and protocol state remain authoritative for the applicable normative obligations.
- A Model Provider is not an AEP worker identity, verifier, dispute authority, settlement actor or source of protocol state merely by generating content.
- Core binds the inference attempt and resulting artifacts/evidence to the AEP task/attempt references required by the applicable adapter profile.
- Core blocks protocol-bound actions when the AEP adapter reports inadmissible state or unavailable required authority/evidence.
- Local-only tasks that are not AEP-bound remain independent of AEP settlement, Cardano and optional economic services.

This interface does not alter AEP normative semantics or create a second AEP task lifecycle.

## 12. Conformance suite required before adoption

A provider adapter is not conformant merely because it answers a prompt. The same Core-side tests must be run against at least two materially different providers or a real adapter plus a deterministic adversarial provider double.

| Test | Required result |
| --- | --- |
| Provider swap | Core authority checks and task semantics remain unchanged |
| PLAN request | No tool definitions/capabilities are supplied |
| Tool-call-shaped output | Returned as inert intent data; no direct execution |
| Prompt asks model to widen mandate | No trusted state or authority changes |
| Out-of-scope file/operation intent | Core rejects before dispatch |
| Invalid JSON / schema mismatch | Rejected or escalated; never treated as approval |
| Late or mismatched response | Rejected or quarantined |
| Provider unavailable | Plan/task/evidence preserved; no silent failover |
| Remote model requested by output | Denied unless Core policy independently allows it |
| Local-only privacy profile | No request leaves the local provider boundary |
| Resource admission denied | Provider generation does not start |
| Cancel acknowledged | Core still reconciles task and any dispatched side effects |
| Provider-reported token count | Labelled provider-reported; not treated as host metering |
| AEP-bound task with inadmissible state | Protocol-bound action is blocked |
| Non-AEP local task while AEP adapter is unavailable | Local task remains available if its own requirements are met |
| No LLM provider present | Deterministic Core services remain available within their declared scope |

Tests should assert both successful behavior and absence of forbidden side effects. Model quality and task success rates are measured separately from security-boundary conformance.

## 13. Compatibility and versioning

- Contract identifier: **cormia.model-provider/0.1**.
- Unknown major contract versions are rejected, not silently coerced.
- Adapter-specific metadata belongs in a bounded namespaced field and must not alter Core semantics.
- Adding a new optional provider feature requires explicit capability negotiation and tests; absence of the feature must not break the baseline contract.
- A change affecting authority, locality, request scope, operation-intent semantics or evidence binding requires a new contract decision/version.
- This proposal does not yet define canonical JSON serialization, signed provider manifests, remote provider identity proofs or a provider registry schema. Those remain separate decisions.

## 14. Relationship to existing Cormia and local-agent components

The contract composes with existing proposals; it does not replace them:

- Project Mandate, task-child authority and trusted project context remain governed by the existing Core/ADR-0010 direction and trusted host providers.
- Project Lifecycle and Local Agent Task Store remain distinct state systems until a reviewed adapter explicitly binds them.
- Resource Offer/Lease and the local Resource Provider describe resource capacity/admission, not model authority.
- The Coordination Plane owns project task assignment and worker coordination; the Model Provider is not the coordinator.
- MCP remains a tool/resource connectivity interface, not the source of authorization. A2A remains an agent-to-agent interoperability boundary, not a model-provider contract.
- Existing Local Agent/Granite is a prototype integration input. The contract does not require migrating its current process-oriented CLI or replacing its Task Store as a first step.

## 15. Explicit non-goals and implementation status

This proposal does not:

- implement a production ModelProvider adapter, registry, discovery, routing or marketplace. A minimal in-process shape/correlation validator, deterministic synthetic test double and experimental loopback-only llama.cpp HTTP adapter now exist under `runtime/core/`; they are not a production multi-provider runtime or a full Core execution path;
- select Granite or any other model as the default provider;
- promise identical quality, latency, hardware requirements or context size across providers;
- create tool, filesystem, network, credential or mandate permissions in a provider;
- freeze JSON Schemas or generated runtime types;
- implement streaming, embeddings, multimodal media transport or remote Mesh inference;
- modify the IMMORTAL Local Agent, Granite configuration, prompts, MCP servers, allowlists, Task Store or Resource Manager;
- change ECC-01 fixtures, results or evidence;
- alter IMMORTAL AEP semantics or claim AEP/Runtime conformance.

The current repository has isolated Core contract/schema and local Runtime slices, plus an initial ModelProvider validator, deterministic test double and experimental local loopback llama.cpp adapter. The adapter has HTTP-stub tests; the combined Core Node runtime run completed with 88 PASS / 0 FAIL, including 17 adapter tests. It has not been used against a real model server. The repository still does not have a unified production Core Runtime, a generic ModelProvider registry, or the Core-enforced Plan–Execute and Capability Broker execution path described here. These tests establish provider-facing contract, transport and locality behavior; they are not an implementation of execution authority or a security certification.

## 16. Proposed next steps

1. Review the initial validator, synthetic provider and loopback adapter against this interface proposal; keep the in-process port and avoid redundant JSON Schemas until a cross-process/persisted contract is required.
2. Run the opt-in local Granite smoke test using an explicitly pinned local endpoint and model alias; do not reuse a production agent's credentials or enable remote fallback.
3. Specify and implement the Core Capability Broker and Plan–Execute state machine separately; the Model Provider interface must not absorb either responsibility.
4. Extend the common conformance harness to exercise provider replacement while asserting identical Core authorization outcomes. Keep execution-authority cases BLOCKED until a real Core-owned dispatch path exists.
5. Only then run a bounded provider-swap spike. Preserve the current IMMORTAL Agent and its local store until parity, security and recovery checks are independently evidenced.

## 17. Related documents

- [Model Provider Independence & Core Authority Boundary v0.1](./CORMIA_MODEL_PROVIDER_INDEPENDENCE_AND_CORE_AUTHORITY_BOUNDARY_v0.1.md)
- [General-Purpose Autonomous Agent & Mixed Community-Support Architecture v0.1](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- [Cormia Core Contracts v0.1](./CORMIA_CORE_CONTRACTS_v0.1.md)
- [Cormia Core Interface Catalog v0.1](./CORMIA_CORE_INTERFACE_CATALOG_v0.1.md)
- [Coordination Plane and Multi-Node Topology v0.1](./CORMIA_COORDINATION_PLANE_AND_MULTI_NODE_TOPOLOGY_v0.1.md)
- [IMMORTAL AEP normative specification](../../SPEC.md)
