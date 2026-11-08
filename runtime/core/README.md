# Cormia Core — Project Lifecycle Journal v0.1

- **Status:** isolated local-runtime component / experimental implementation slice
- **Version:** event record `0.1.0`
- **Scope:** single-project, single-host local filesystem journal
- **Related schema:** `schemas/core/project-lifecycle-event-v0.1.schema.json`
- **Related projection:** `schemas/core/project-lifecycle-record-v0.1.schema.json`
- **Architecture contract:** `docs/architecture/CORMIA_CORE_CONTRACTS_v0.1.md`

## 1. Files

- `project-lifecycle-reducer.mjs` — pure deterministic state reducer.
- `project-lifecycle-journal.mjs` — append-only NDJSON journal, locking, digest validation, replay and explicit torn-tail recovery.
- `project-lifecycle-journal.test.mjs` — Node-native contract tests.
- `trusted-project-context-resolver.mjs` / `.test.mjs` — host-port trust-context resolution and task-session boundary.
- `plan-execute-capability-broker.mjs` / `.test.mjs` — inert PLAN validation and host-authorized EXECUTE boundary.
- `project-runtime-registry.mjs` / `.test.mjs` — isolated per-project broker composition and host-verified task routing.
- `project-task-store.mjs` / `.test.mjs` — per-project durable task journal, queue, attempts, checkpoints and explicit restart reconciliation.

The component is deliberately outside `runtime/reference-worker/`. It does not replace, read or write the existing Local Agent Task Store v1 and does not change the IMMORTAL Agent's /resume behavior.

## 2. Lifecycle state machine

Implemented transitions:

| Event | From | To |
| --- | --- | --- |
| `project_created` | none | `draft` |
| `project_configured` | `draft` | `configured` |
| `project_activated` | `configured` | `active` |
| `project_paused` | `active` | `paused` |
| `project_resumed` | `paused` | `active` |
| `project_blocked` | `active` | `blocked` |
| `project_unblocked` | `blocked` | `active` |
| `project_completed` | `active` | `completed` |
| `project_archived` | `completed` | `archived` |
| `project_metadata_updated` | any created non-archived state | unchanged |

Unsupported transitions and event types are rejected. The reducer never accepts mandate states (`suspended`, `expired`, `revoked`, `trust_failed`) or task states (`pending`, `running`, etc.) as project states.

This is the implemented transition subset for v0.1. In particular, blocking is currently modeled only from `active`, and unblocking returns to `active`; there is no configured→blocked or pause-from-blocked shortcut.

## 3. Storage and append contract

The host supplies:
- an absolute, host-resolved journal path;
- a non-empty `projectRef`;
- a trusted `actorRef` and evidence references in each append command.

The journal uses one UTF-8 NDJSON record per event. Each event contains the schema/version, project binding, event ID, contiguous sequence, event type, exact from/to state, actor reference, timestamp, reason code, evidence references, previous event digest and current record digest.

The record digest is `sha256:` plus the lowercase SHA-256 of the event JSON with `recordDigest` removed. Object keys are serialized in lexicographic order; values in this record profile are strings, integers, nulls and arrays of strings. This is the local v0.1 serialization profile, not a signed or cross-language canonicalization standard.

Append behavior:
1. Acquire a local exclusive `.lock` file using create-if-absent semantics.
2. Replay and validate the existing journal while holding the lock.
3. Check `expectedRevision` (compare-and-set) and derive the next state using the reducer.
4. Deduplicate a retry by `eventId`; reusing the same ID with different intent is rejected.
5. Append the complete line and call file `sync()`; directory sync is attempted on first creation where the filesystem supports it.
6. Release the lock.

Readers use the same lock, so a reader never consumes an append in progress. The lock serializes cooperating processes on one local filesystem. It is not a network/distributed lock and should not be placed on an unqualified network share.

A crashed process may leave a stale `.lock` file. It is not automatically stolen or deleted. The trusted host must inspect it and clear it only after verifying no writer remains.

## 4. Recovery

A valid journal must end each record with a newline. An incomplete final non-newline-terminated suffix is treated as an uncommitted/torn tail and blocks reads and appends.

Only an explicit call may discard that suffix:

```js
const result = await journal.recover({ repairTornTail: true });
```

The repair truncates only bytes after the final newline (or all bytes if the first event never reached a newline), syncs the file, then replays the remaining complete records. A complete malformed JSON line, invalid digest, broken chain, wrong project, duplicate event ID or invalid transition is never auto-truncated. Preserve the file for investigation.

## 5. API

```js
import { createProjectLifecycleJournal } from "./project-lifecycle-journal.mjs";

const journal = createProjectLifecycleJournal({
  journalPath: "/host-resolved/cormia/projects/project-1/lifecycle.ndjson",
  projectRef: "project:project-1"
});

const current = await journal.read();

await journal.append({
  eventId: "host-generated-idempotency-reference",
  expectedRevision: current.revision,
  eventType: "project_created",
  actorRef: "principal:resolved-steward",
  reasonCode: "project_initialized",
  evidenceRefs: ["artifact:project-descriptor-sha256-reference"]
});
```

Do not expose the raw filesystem path to an untrusted model or caller. A retry after an ambiguous response should reuse the same `eventId`; a new command must use the revision returned by `read()` or by the append receipt.

## 6. Security and authority boundary

This module is not an identity provider, mandate verifier, consent broker, revocation anchor, credential broker, task scheduler or resource manager.

- `actorRef` is a host-supplied reference. The journal does not authenticate the actor or prove a person's/legal entity's role.
- `evidenceRefs` are opaque pointers. The journal does not fetch, validate or assess the referenced evidence.
- A successful `project_activated` append does not by itself prove that steward, accountability, mandate, workspace or execution profiles have been verified. Trusted orchestration must enforce those preconditions before issuing the command.
- Hash chaining detects accidental edits and incomplete/altered records when the full chain is not recomputed. It is not a digital signature, non-repudiation proof or protection against a privileged attacker who can rewrite the entire file.
- The journal contains references and status metadata, not secrets. Do not place API keys, signing keys, prompts, private project data or raw evidence payloads in event fields.
- It contains no payment, Cardano, wallet, token, CRC, AEP settlement or IMMORTAL dependency.

## 7. Explicit non-goals / remaining work

This slice does not implement:
- a project descriptor registry or trusted steward/accountability resolution;
- signed mandate/consent verification or binding to ADR-0008/0009/0010;
- automatic mandate revalidation on every protected operation;
- a task journal, task engine, checkpoint executor or crash-safe side-effect reconciliation;
- schema-generated runtime types or a database projection store;
- snapshotting, compaction, retention, backup rotation or bounded journal growth;
- durable/cross-process Resource Lease storage, OS-level quotas and remote provider discovery; the partial worker-local offer/lease adapter is described in section 10;
- Community Support, payment custody, remote worker mesh or cross-host replication;
- Agent/Granite integration, autonomous task execution or project-loop activation.

The next layer is to implement the production providers required by the resolver contract: host-pinned mandate signature/key verification, authenticated operator consent, steward/accountability resolution, mandate-specific revocation with an independent monotonic anchor, and a durable Project Descriptor/host-policy registry. The current resolver is only a fail-closed orchestration contract over those host ports. The worker-local Resource Provider described in section 10 is separate from project lifecycle and does not substitute for the missing Coordination Plane or durable cross-worker lease registry.

## 8. Tests

Run from repository root:

```sh
node --check runtime/core/project-lifecycle-reducer.mjs
node --check runtime/core/project-lifecycle-journal.mjs
node --test runtime/core/*.test.mjs
```

The contract tests cover pure transition replay, journal reconstruction after a fresh instance, digest chain, idempotent retry, revision conflicts under concurrent writes, invalid transitions, metadata artifact references, tamper detection, explicit torn-tail repair, preservation of complete corruption, stale-lock fail-closed behavior and symbolic-link rejection.


## 9. Trusted Project Context Resolver — host-port orchestration slice

Implementation:
- `trusted-project-context-resolver.mjs`
- `trusted-project-context-resolver.test.mjs`

The resolver binds the versioned Core Project Descriptor to the existing ADR-0010 v0.1 mandate claims and reuses `local-autonomous-project-authority.mjs`. It does not introduce another mandate, child-grant, signature, consent or revocation format.

### Resolution sequence

1. Read the descriptor for the fixed host-selected `projectRef`; callers cannot pass a descriptor into `resolve()`.
2. Resolve the declared steward and accountability arrangement through the trusted identity provider. v0.1 accepts a verified human or organization steward and requires that the accountability arrangement includes that steward. A community stewardship body is not yet defined and is rejected.
3. Resolve the mandate by its ID/schema ID/digest through the host mandate authority provider. That provider must verify the signed representation, active host key and claims digest; the Core resolver independently invokes the existing ADR-0010 claims validator and checks project/repository/workspace/worker/Runtime binding and validity time.
4. Resolve the mandate's one-time project-consent receipt through a trusted consent provider. The resolver checks the receipt digest, issuer/operator/mandate/project/workspace binding, explicit approval, challenge equality and challenge suffix, validity interval and nonce/sequence shape. The provider must verify the signature, authenticated broker/session, recomputed intent, and replay/revocation state.
5. Reconcile mandate revocation and its independent monotonic anchor through a mandate-specific trusted provider.
6. Replay/read the Project Lifecycle journal and confirm that it belongs to the host-selected project. Trust state and project state remain separate.

### Runtime use

`resolve()` returns a sanitized summary; it does not return raw mandate claims or the trusted-mandate boolean bundle.

`createTaskSession(verifiedTask)` is a host-only operation. It creates a child authority using the existing ADR-0010 evaluator only while project lifecycle state is `active`. The returned session's `authorizeOperation()` reloads and revalidates descriptor, identity, mandate/key state, consent, revocation/anchor and project lifecycle before every operation. It then re-reads the host policy and calls the existing operation evaluator. These are automatic machine checks, not human prompts.

The caller must supply a task object produced by a separate trusted Task Manifest verifier. This resolver does not parse or authenticate AEP Task Manifests.

### Trusted provider ports

The constructor captures these host-only providers:
- `projectStore.readProjectDescriptor(projectRef)`;
- `identityProvider.resolveSteward(stewardRef)`;
- `identityProvider.resolveAccountability(accountabilityRef)`;
- `identityProvider.authorizeMandateOperator(...)`;
- `mandateAuthority.verifyAndLoad(...)`;
- `consentAuthority.verifyActiveReceipt(...)`;
- `revocationAuthority.reconcileMandate(...)`;
- `hostPolicyProvider.readPolicy()`;
- the local `projectLifecycleJournal.read()`.

No provider, key, descriptor, path or host policy may be supplied by a model/task. The ports are trust boundaries: the resolver validates their outputs and bindings, but cannot make an untrusted implementation trusted.

### Explicit implementation limitation

The repository does **not** yet contain production implementations for the following providers:
- host-pinned mandate JWS/signature verification and digest profile for the project mandate (ADR-0009 still leaves the exact signing provider/bootstrap and key lifecycle open);
- authenticated OS/operator identity and consent broker, including signed project-consent receipt verification and replay registry;
- trusted steward/accountability/mandate-operator identity registry;
- mandate-specific revocation records, signed checkpoint and independent monotonic anchor provider;
- persistent host policy store and project descriptor registry.

The existing ADR-008 Ed25519 helper verifies the separate local capability-grant/revocation JWS profile; it is not silently treated as a project-mandate signature verifier. The existing ADR-009 reconciliation model is in-memory and synthetic, and its revocation-event schema binds grant revocations, not the project mandate. Neither is claimed as a production provider for this resolver.

Consequently, this module is a fail-closed orchestration contract and test harness, **not a production trusted resolver**. With no real providers configured, no trusted context can be resolved. The unit tests use synthetic in-memory provider doubles and test the boundary logic only; they do not prove key custody, consent authenticity, operator authentication, anti-rollback persistence, or host integration.


## 10. Local worker-side Resource Provider — callback-scoped adapter

Implementation:
- `local-resource-provider.mjs`
- `local-resource-provider.test.mjs`

This module is a generic Cormia Core worker-side adapter. It does not import the existing IMMORTAL ResourceManager or the reference-worker wrapper. The trusted host injects:
- a provider identity;
- preconfigured Resource Offer records that already have owner acceptance and validation evidence;
- an `executeWithLocalLease({ operation, run })` port bound to the actual local ResourceManager adapter;
- an explicit `leaseTtlMs` from host policy, plus host clock and ID generation.

The local configuration contains a host-only `operation` mapping for each offer. That value is stripped from public Resource Offer records and cannot be selected by a task/model caller. The module validates the offer's version, provider binding, availability window, owner acceptance, validation evidence, capacity and capability profile. `discover()` exposes only the bounded offer record; it does not expose raw host telemetry. Actual resource admission is rechecked by the injected execution port when the task is run.

`withLease()` binds an offer to a verified task reference and exact capability profile, checks requested quantity/unit and delegates acquisition to the host execution port. The callback receives a task-bound active Resource Lease record, a bounded resource summary and `assertActive()`. The trusted executor should call `assertActive()` before each side-effecting tool operation. Expiry or local offer revocation then fails closed at that boundary. On successful callback completion the module returns a `released` lease record; the injected local ResourceManager wrapper releases its underlying process-local lease in `finally`.

`revokeOffer()` prevents new admissions and causes the next `assertActive()` check in an existing callback to fail. It is in-memory only; it does not persist a revocation event or forcibly terminate an OS process. Lease renewal is not implemented.

### Explicit limits

- No durable lease registry, cross-process reservation, scheduler, coordinator, worker registration or network dispatch.
- No OS-level CPU/RAM/GPU quotas, process kill, resource preemption or guarantee that a long-running callback stops unless the trusted executor checks `assertActive()` at operation boundaries.
- No live capacity sampling during `discover()`; the actual local ResourceManager admission is authoritative at `withLease()` time.
- No remote resource provider or shared writable workspace.
- No automatic import or dependency from Cormia Core to IMMORTAL; host composition injects the adapter.
- No claim of production Agent integration or multi-PC execution.

The tests use injected execution-port doubles. They verify host-bound operation mapping, offer/lease binding, time-window and revocation checks, fail-closed admission and release/error boundaries. They do not test the user's Windows ResourceManager or create a persistent lease.


## Model Provider — initial in-process contract slice (2026-11-07)

Files:
- `model-provider-contract.mjs` — version constants, bounded enums, strict shape validation and correlation checks for provider descriptors, health, generation requests/responses and cancellation results.
- `deterministic-model-provider.mjs` — in-process test double with controlled response factory and best-effort cancellation behavior.
- `model-provider-contract.test.mjs` — Node-native contract tests, including request field allowlisting, response/provider binding, metadata limits, non-completed finish reasons and adversarial tool-call-shaped content.

Run the provider-specific tests from the repository root:

```sh
node --check runtime/core/model-provider-contract.mjs
node --check runtime/core/deterministic-model-provider.mjs
node --test runtime/core/model-provider-contract.test.mjs
```

The existing Core CI command `node --test runtime/core/*.test.mjs` includes this suite.

This slice validates the provider-facing data boundary; it does not implement a production inference adapter, provider registry, Core Capability Broker, Plan–Execute gate, resource admission integration or task orchestration. The synthetic provider has no tool registry, filesystem access, network access or host execution callback. Provider output remains untrusted content. A tool-call-shaped response is not dispatched by this module.

No Granite/llama.cpp integration, local Agent modification or remote fallback is part of this implementation.


## llama.cpp ModelProvider adapter — local HTTP integration (2026-11-07)

File:
- `llama-cpp-model-provider.mjs` — local-only adapter from the Cormia in-process ModelProvider contract to llama.cpp's OpenAI-compatible chat-completions route.

The initial adapter is deliberately restricted to loopback HTTP endpoints (`localhost`, `127.0.0.1`, `::1`). It rejects remote hosts, HTTPS, URL credentials, query/fragment components and redirects. The host pins:
- endpoint URL;
- model alias/ID, which must match the provider descriptor and any model ID reported by the server;
- generation profile reference;
- timeout, input/output bounds and generation parameters;
- optional API key, held only in the adapter closure and sent as an Authorization header.

The request path is fixed to `/v1/chat/completions`; health uses the fixed `/health` path. The adapter sends no `tools` or `tool_choice` definitions. A provider-returned native `tool_calls` array is serialized into inert response content and marked with a warning; it is never dispatched.

Only Core-materialized text/instruction inputs are accepted. Artifact references are rejected until a separate Core/host materialization boundary supplies authorized content. JSON mode requests `response_format: { type: "json_object" }`; a request's `schemaRef`/digest are not treated as a schema payload and semantic JSON Schema validation remains a Core responsibility.

Cancellation returns `unsupported` because the adapter does not claim a portable server-side request cancellation API. Request deadlines/timeouts abort the local HTTP request where supported. HTTP error bodies and transport exception details are not copied into normalized error messages. There is no retry to another provider and no remote fallback.

Example host configuration (the alias must also be configured in the llama.cpp server):

```js
import { createLlamaCppModelProvider } from "./llama-cpp-model-provider.mjs";

const provider = createLlamaCppModelProvider({
  baseUrl: "http://127.0.0.1:8080",
  modelId: "granite-local-alias",
  generationProfileRef: "profile:local-safe",
  descriptor: {
    contractVersion: "cormia.model-provider/0.1",
    providerAdapterId: "cormia.llama-cpp",
    adapterVersion: "0.1.0",
    providerInstanceRef: "provider:host:llama-cpp",
    locality: "local",
    endpointClass: "host_service",
    observedModelId: "granite-local-alias",
    inferenceRuntime: { name: "llama.cpp" },
    featureHints: ["structured_json"]
  },
  timeoutMs: 60000,
  maxOutputTokens: 2048
});
```

Run the HTTP-stub adapter tests without a model, GPU, external network or secret:

```sh
node --check runtime/core/llama-cpp-model-provider.mjs
node --test runtime/core/llama-cpp-model-provider.test.mjs
```

The adapter is tested against a local HTTP stub in mandatory CI; the current combined Core run reports 94 PASS / 0 FAIL, including 19 adapter tests. An operator-run real local Granite smoke test passed on 2026-11-07 (evidence recorded below). This adapter is not an integrated Core task runner and has no Capability Broker or Plan–Execute dispatch path.

Upstream transport reference: [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), which documents the OpenAI-compatible `/v1/chat/completions` route, the `/health` probe and the JSON response-format option.


## Opt-in local llama.cpp smoke test

`runtime/core/llama-cpp-local-smoke.mjs` performs one real local inference through the same ModelProvider adapter. It is intentionally separate from mandatory CI and never modifies the IMMORTAL Agent or its Granite configuration.

From the repository root in PowerShell:

```powershell
node .\runtime\core\llama-cpp-local-smoke.mjs --help
node .\runtime\core\llama-cpp-local-smoke.mjs --confirm-local-inference --model-id "<the-exact-model-id-reported-by-your-llama-server>"
```

The default endpoint is `http://127.0.0.1:18080/v1`; override it with `--base-url` only when the server listens on another loopback port. The model ID is required and must match the identity returned by the server (configure a matching llama.cpp alias where applicable). The profile defaults to `profile:local-smoke-v0.1` and can be pinned with `--generation-profile-ref`.

Safety properties:
- `--confirm-local-inference` is mandatory before any health or generation request.
- The adapter enforces loopback HTTP only and rejects redirects; no remote fallback exists.
- The test uses a fixed synthetic marker prompt, sends one generation request, and does not expose tools or dispatch operations.
- No API-key argument is accepted. The script prints only sanitized metadata, result status and a response digest, never the generated text.
- Exit code `0` means the expected marker was returned; `2` means configuration/provider failure or not-ready; `3` means inference returned but did not match the marker; `64` means invocation was refused or invalid.
- A successful smoke test verifies connectivity and response normalization only. It is not a Core security, authorization or production-integration proof.

CI tests the opt-in guard and CLI behavior without contacting a model. The real local smoke test was subsequently executed by the operator and **PASSED** on 2026-11-07.

Recorded local run (operator-provided sanitized output):
- Result: `PASS`; `stage: generation`; `finishReason: completed`; `markerMatched: true`.
- Model: `granite-4.2-8b-Q4_K_M`; endpoint host: `127.0.0.1`; locality: `local`.
- Provider: `cormia.llama-cpp`; provider instance: `provider:local-smoke:fc8186e3-6f56-46b1-92d3-de1ebbdb75fa`.
- Run reference: `fc8186e3-6f56-46b1-92d3-de1ebbdb75fa`; provider request reference: `chatcmpl-EOnpNWzCDxZiIAx3ohVGQMCZdDI6ih6w`.
- Output length: 30 characters; response digest: `sha256:a212a60b065fb4a1e36e9d711886e23bf6c4551c381a2305ebfc3fc99166a878`.
- Smoke report: `remoteFallback: false`; `toolDispatch: false`; no warnings.

This proves one real local generation through the adapter and normalized response binding. The report's no-fallback/no-dispatch fields describe the script/adapter boundary; this was not an independent network packet capture or a test of the integrated Core authorization path.

**Granite 4.2 chat-template note:** Granite 4.2 enables thinking by default in its embedded chat template. The smoke probe deliberately caps generation at 64 tokens and expects a short literal marker; with thinking enabled, the reasoning trace can consume that budget and llama.cpp can correctly return `finish_reason: "length"` before the marker.

The smoke runner now pins non-thinking mode on this single HTTP request by setting the host-only adapter option `enableThinking: false`. The adapter maps it to llama.cpp's request-level `chat_template_kwargs: { "enable_thinking": false }`. It does not change the running server's global chat template settings, other clients or the IMMORTAL Agent. The adapter defaults to the model/server's configured thinking behavior when this option is omitted.

The server must use the model's Jinja chat template. For Granite GGUF, check that `llama-server --help` exposes `--jinja`, then start the local server with `--jinja` in addition to the existing model/alias/loopback arguments. The request-level option is documented in the [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md); Granite's thinking default and disable parameter are documented in the [Granite 4.2 GGUF model card](https://huggingface.co/webAI-Official/granite-4.2-8B).


## Core Plan–Execute and Capability Broker — first enforcement slice

Files:
- `plan-execute-capability-broker.mjs` — host-composed Core broker for bounded inert plan proposals, PLAN validation, digest-bound one-shot EXECUTE, just-in-time authority revalidation, optional resource-lease admission and fixed host operation adapters.
- `plan-execute-capability-broker.test.mjs` — contract/integration tests composed with the existing `createTrustedProjectResolver` and synthetic trusted-port/operation-adapter doubles.

### Execution boundary

1. `preparePlan({ taskRef, proposal })` asks the host-only Task Authority Provider for a verified Task Manifest projection. The projection is bound to task ID, manifest digest, requested operations and expiry.
2. The broker obtains a task session from the captured Trusted Project Resolver. The existing ADR-0010 evaluator rechecks project mandate, task scope, host policy, project lifecycle, consent, revocation and anchor state.
3. During PLAN, the broker validates the proposal shape and bounded JSON inputs, runs each registered adapter's input validator, and authorizes every operation. No operation adapter is dispatched in this phase.
4. The Core creates a plan reference and digest; the result is `READY`. `executePlan({ planRef, expectedPlanDigest })` is a separate host-orchestrator action. Plans are one-shot and duplicate/concurrent execute requests are fenced.
5. During EXECUTE, each step is re-authorized. If the host Resource Admission Provider says a lease is required, the fixed Resource Provider must admit it. The broker re-authorizes once more inside the lease callback immediately before dispatch.
6. Dispatch is possible only through the fixed host adapter registered for that operation. The model cannot supply an adapter, tool registry, dispatcher, capability set, Resource Manager operation mapping, host policy, task session or credential.

The effective operation rule remains the existing mandate ∩ verified Task Request ∩ Host Policy. Resource Lease remains a separate capacity-admission prerequisite; it is not an authority set.

### Host ports and trust boundary

Constructor-captured host ports:
- `trustedProjectResolver.createTaskSession(verifiedTask)`
- `taskAuthorityProvider.loadVerifiedTask(taskRef)` and `revalidateVerifiedTask({ taskRef, expectedManifestDigest })` before every dispatch
- `resourceAdmissionProvider.resolveRequirement(context)`
- optional `resourceProvider.withLease(...)` for steps whose trusted host requirement needs a lease;
- a host-owned, fixed operation-adapter registry. Each adapter has a synchronous `validateInput(input, context)` and an `execute(context)` method.

The Task Authority Provider must independently verify the Task Manifest, return only the bounded trusted projection, and revalidate that the exact same task ID/digest/operation/expiry projection remains valid before each dispatch. A changed or revoked projection blocks execution. The resolver's underlying mandate-signature/key, authenticated-consent, identity/accountability and mandate-revocation/anchor providers must be real trusted implementations. Operation adapters must enforce workspace realpath/symlink containment and safe side-effect semantics. A trusted Resource Admission Provider must decide whether a step requires a lease; the broker fails closed when a required lease is unavailable or invalid.

### What this slice proves — and what it does not

The tests compose the actual broker code with the existing resolver code, while injecting synthetic trust providers, a synthetic Task Manifest authority and test operation adapters. They prove the broker's deterministic enforcement logic, not the authenticity of those upstream providers or the safety of a production filesystem/Git adapter.

Covered cases include:
- PLAN performs no dispatch;
- protected, out-of-task and path-traversal proposals are denied;
- mandate revocation, lifecycle and host-policy changes between PLAN and EXECUTE block dispatch;
- required Resource Lease denial blocks dispatch; admitted lease is task-bound and checked at the dispatch boundary;
- untrusted extra tool/dispatch/policy fields are rejected;
- adapter input validation occurs before a plan becomes READY;
- plan digest binding, one-shot execution and concurrent duplicate fencing;
- Task Manifest revocation/projection changes between PLAN and EXECUTE, task expiry and mandatory host-port composition.

**CI evidence:** [GitHub Actions run #42449752396](https://github.com/LiberoNuvola/Cormia/actions/runs/42449752396) completed successfully on the broker/Task Manifest revalidation code path: **110 PASS / 0 FAIL**, including the new Core broker tests and its syntax check.

**Current implementation status:** isolated Core Plan–Execute/Capability Broker slice and contract tests implemented. **Not yet a production integrated Gate 4.** The repository still lacks production Task Manifest signature verification/provider wiring, production Project Mandate/consent/identity/revocation providers, a concrete production operation-adapter set, and end-to-end Windows workspace/ResourceManager composition. Failure after earlier steps may leave those earlier side effects in place; the broker stops later steps and reports the completed-step count, but does not claim rollback or transactional atomicity.

This slice does not modify the IMMORTAL Local Agent, its prompts, task store, MCP allowlist, Granite configuration or Windows runtime.

## Primary product priority: autonomous multi-project work

The current near-term implementation priority is one local Supervisor operating independent Project Runtime instances, with IMMORTAL Protocol as the first project and other projects isolated by their own mandate, task queue, workspace, evidence and resource budget. This is a sequencing priority only: it does not narrow or replace the full Cormia architecture, final product objectives or later community/resource/economic/team/evidence integrations. See [CORMIA Multi-Project Autonomous Runtime v0.1](../../docs/architecture/CORMIA_MULTI_PROJECT_AUTONOMOUS_RUNTIME_v0.1.md). The Supervisor, durable task engine, task-scoped worktree manager and integrated plan→execute→verify loop are not yet implemented; existing ModelProvider, trusted resolver, broker and local adapters are component slices.


## 11. Project Runtime composition and registry — first multi-project slice

Implementation:
- \`project-runtime-registry.mjs\`
- \`project-runtime-registry.test.mjs\`

\`createProjectRuntime()\` composes one Plan–Execute Capability Broker with exactly one trusted project resolver, Task Authority Provider, Resource Admission Provider, optional Resource Provider and fixed operation-adapter registry. The returned facade is bound to one host-selected \`projectRef\`; plans and execution requests are also bound to their \`taskRef\`.

\`createProjectRuntimeRegistry()\` captures an immutable set of those Runtime facades and a host-owned \`taskRoutingProvider.resolveVerifiedTaskRoute()\` port. The caller supplies a \`taskRef\` and inert proposal, never a \`projectRef\`. The host route binds the task to a project and manifest digest. The registry checks that route before PLAN, again after PLAN and immediately before EXECUTE; it also keeps a registry-side binding between the task, project, manifest digest, route digest and plan digest. A plan cannot be replayed under a different task or Runtime.

Each Project Runtime has separate broker state and captures its own resolver, task authority, resource admission and adapters. Shared Model Provider or host Resource Manager services do not become shared authority.

### Contract and tests

The route port must return exactly:
\`\`\`js
{
  schemaVersion: "0.1.0",
  status: "verified",
  taskRef: "...",
  projectRef: "...",
  manifestDigest: "sha256:...",
  routeDigest: "sha256:..."
}
\`\`\`

The route provider is a trusted host port, not a model-supplied object. The implementation validates shape and binding but does not authenticate the provider's underlying signature or persistence. The selected Project Runtime's own Task Authority Provider and Trusted Project Resolver remain independent checks and must reject a task that is not bound to that project.

Tests cover two-project routing, inability to nominate a project from the request, duplicate registration, unknown project, provider failure, route change after PLAN, plan/task cross-binding and rejection by the wrong project's own Task Authority.

### Explicit remaining gaps

This is an **in-process composition and routing slice**, not the complete Supervisor:
- no production signed/persistent task routing provider;
- no persistent project descriptor/runtime registry or live registration lifecycle;
- no durable Cormia-owned task queue, task journal, task graph or restart recovery;
- no fairness scheduler, global/per-project concurrency admission or background service lifecycle;
- no task-scoped filesystem/Git worktree adapters or Windows ResourceManager composition;
- no real IMMORTAL execution path or second-project host proof.

Existing runtime facades and route bindings live in memory and are lost at process restart. This is not advertised as durable autonomy. The next implementation layer is the durable task engine and host Project Supervisor, reusing these project-bound Runtime facades without taking over the user's separate IMMORTAL Local Agent Task Store v1.


## 12. Durable Project Task Store — Cormia-owned task queue

Implementation:
- \`project-task-store.mjs\`
- \`project-task-store.test.mjs\`

\`createProjectTaskStore({ journalPath, projectRef })\` creates one local append-only NDJSON task journal for exactly one host-selected project. It is separate from the Project Lifecycle journal and from the user's IMMORTAL Local Agent Task Store v1. It does not read or write the latter.

Task records bind a taskRef, manifest digest, goal, source reference, attempt limit and dependencies. A task can be claimed only once its dependencies have completed. Each claim increments the attempt counter under a cross-process local lock and a journal-revision compare-and-set. Checkpoints are append-only and record the checkpoint reference, evidence references and the side-effect boundary classification (\`no_external_effects\`, \`idempotent_or_reconciled\`, \`unknown\`).

### Task state and recovery

\`queued → running → completed | failed | blocked\`

A process restart changes remaining \`running\` tasks to \`recovery_required\`. It does **not** requeue them. A host-side reconciliation event with evidence must explicitly choose:
- \`safe_to_retry\` — return to \`queued\` only when attempts remain and external side effects have been reconciled;
- \`confirmed_complete\` — mark completed with evidence of the resulting state;
- \`blocked\` — preserve the unresolved task without retry.

A blocked task can only be unblocked with evidence. A recovery event does not rely on a model's claim that replay is safe. This conservative policy may pause a task that could in fact be harmless to retry; that is preferable to duplicating an uncertain external side effect.

### Durability contract

- one journal per project, with projectRef binding on every event;
- append-only records with contiguous sequence, previous-event digest and SHA-256 record digest;
- exclusive local lock, fsync, compare-and-set revision and idempotent eventId;
- complete corruption fails closed; only an incomplete non-newline tail can be removed through explicit \`recover({ repairTornTail: true })\`;
- a stale lock is never stolen automatically;
- task dependency references must point to tasks already created in the same project, giving the v0.1 queue a backward-only DAG;
- current journal event cap: 250,000; compaction/snapshotting is not implemented.

### Boundaries and remaining work

This store is a persistence primitive, not a complete autonomous engine. It does not authenticate Task Manifest signatures, choose a project, schedule fairly across projects, launch workers, enforce resource leases or perform side-effect reconciliation itself. The host must verify a Task Manifest before enqueueing, resolve its project route, and supply evidence-backed recovery decisions. The tests use local temporary files and synthetic host actors; they do not prove production key custody or Windows service recovery.

The next layer is the host Project Supervisor: fair scheduling across the registered Runtime/store pairs, global/per-project concurrency limits, recovery invocation at startup, and the autonomous plan→execute→verify loop. The existing IMMORTAL Agent store remains untouched.
