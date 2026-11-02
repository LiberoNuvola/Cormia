# ADR-0010: Autonomous project delegation and Runtime-managed authority

- **Status:** Proposed target architecture — aligned with the autonomous local-agent objective; no Agent/runtime integration enabled yet
- **Date:** 2026-11-02
- **Depends on:** ADR-0006, ADR-0007, ADR-0008 and ADR-0009
- **Primary objective:** let the local AI independently plan, edit, test, repair and deliver project work inside one pre-authorized project mandate, without per-edit human approval or operator-supplied API/bearer tokens

## 1. Intent and correction to the current prototype direction

Cormia's target is an autonomous project worker, not an assistant that stops for confirmation after every file edit, patch or test. The README already states the intended protocol principle: once a task is accepted, there should be no human approval for each operation; automation is bounded by the signed task contract and protocol policies.

The present local Agent's interactive APPROVO flow is a compatibility behavior of the old /code interface. It is not the target authorization model for the autonomous Runtime. The current Cormia read-only Coding Workspace adapter and ADR-0008 v0.1 evaluator are prototypes, not the final autonomous execution path.

This ADR resolves the architecture direction:

- one explicit operator delegation establishes a standing project mandate;
- tasks wholly inside that mandate are accepted and executed autonomously;
- the Runtime derives and enforces task-scoped child authority automatically;
- routine file reads, writes, patches, refactors, builds and tests do not ask the operator for approval one by one;
- the model never handles private signing keys, API keys, bearer credentials or manually pasted grant tokens;
- the operator is asked again only to widen the mandate or perform an explicitly protected external/high-impact action.

## 2. Three distinct concepts

### 2.1 API/service credentials

Local Granite inference through the already configured loopback model endpoint does not require an OpenAI/Anthropic API key. Cormia must not insert a cloud model fallback or require a provider API token for local inference.

External services such as GitHub may require an authenticated connection. Their credentials must be managed by an OS credential store, a GitHub App/installation integration, or another trusted credential broker. The Runtime obtains a short-lived scoped credential or performs the operation through the broker. Secret bytes must never be placed in model context, task goals, tool output, evidence sidecars or ordinary logs.

A GitHub credential is needed only for an operation that actually contacts GitHub. Local reading, editing, building, testing and committing in an already available local repository must continue offline. When no remote credential is available, remote push/PR is reported as unavailable; local autonomous work must not stop or silently switch providers.

### 2.2 Project mandate

A project mandate is the one-time, operator-authorized envelope for a defined project/workspace and policy period. It is stored by the trusted local Runtime and loaded automatically. It is not pasted into a prompt and is not manually supplied for every tool invocation.

The mandate defines the maximum authority the Runtime may exercise without further operator interaction. It binds project and trusted workspace identity, worker and Runtime identity, allowed operation families, repository/branch/worktree policy, resource/retry/time budgets, network destination policy, excluded secret/credential areas and protected external actions, plus expiry, suspension and revocation.

### 2.3 Task child authority

When the autonomous planner creates or accepts a task under the mandate, the Runtime checks that the objective and required operations fit within the mandate. It then derives an internal child grant automatically. The child is a strict attenuation of the mandate and task manifest. No new human approval is needed for an in-scope task.

The Runtime resolves authority internally at the adapter boundary. The model sees ordinary tools and typed allow/deny results, not private keys, bearer tokens or signed grant strings. A child grant does not become a user-visible credential and is not a new operator interaction.

## 3. One-time project delegation ceremony

At project setup or when the mandate is materially changed, the operator reviews a compact project policy and grants the AI authority for that project.

The UI must present the human-readable project identity and exact workspace/repository binding; whether the worker may read, create, replace, refactor, build, test, create branches, commit and optionally push/open PRs; branch protection; test/build profiles; network destinations; resource/retry/time budgets; protected operations; expiry; and a one-step way to suspend or revoke the mandate.

The operator approves the whole displayed mandate digest once. The trusted local consent broker records the principal, decision, digest, timestamp and interaction ID. The host authority signs and persists the mandate. It is not necessary to type APPROVO for every file or test.

A change that narrows policy may be applied without a new approval if host policy permits it. A change that widens operations, workspace, branch policy, network destinations, resource budget, expiry or protected action set requires a new operator delegation. Automatic renewal must not silently extend a mandate indefinitely.

## 4. Autonomous execution model

Within an active mandate, the Runtime owns a closed-loop worker:

1. Receive a project objective from the operator or an allowed autonomous project backlog.
2. Decompose it into tasks and dependencies.
3. Resolve each task to the project/worktree and create an attenuated internal task authority.
4. Plan and execute code/document changes through the workspace adapter.
5. Run the allowed focused tests/build profiles under host resource limits.
6. Inspect failures, diagnose, revise and rerun within the mandate's retry and resource budgets.
7. Record immutable attempt/evidence references and update durable task state.
8. Continue to the next task while the mandate and budgets remain valid.
9. Produce a completion report with commits, changed files, test evidence, unresolved risks and remaining tasks.

The agent may autonomously choose implementation details, create additional in-scope subtasks, refactor, add tests and correct its own failures. It may not enlarge the mandate, change its own trust root, suppress failed evidence, fabricate a successful test result, or convert an unsupported action into a pass.

The model may recommend actions; only the Runtime capability engine authorizes them. Authorization is performed automatically at each tool boundary using the already-loaded mandate and derived child grant. This is a machine check, not a new human prompt.

## 5. Workspace and repository isolation

The present local Coding Workspace uses a shared configured root and its test operation discovers tests across that whole root. It is not yet suitable for autonomous write/test authority merely by removing the APPROVO prompt.

Before enabling autonomous mutation, the host must create a task worktree or dedicated project workspace with an opaque host-resolved projectRef and workspaceRef, a dedicated root and feature branch, a clean baseline and source/runtime digest, no symlink/junction escape, explicit test/build execution profiles and bounded test selection, independent resource admission and OS/container isolation, and cleanup/crash recovery rules.

A mandate may authorize all normal project files inside that isolated worktree rather than requiring the operator to enumerate every new file before the agent can work. The scope is the host-resolved worktree root, not an arbitrary filesystem root. Secret stores, user profiles, wallet directories, credential files and other host paths remain outside the workspace. Repository-specific excluded paths and protected operations are enforced by trusted Runtime policy, not model-generated glob expansion.

This resolves the practical conflict between least privilege and autonomous project work: the AI receives broad edit freedom within a dedicated project sandbox, not broad authority over the whole PC.

## 6. Default operation policy for the first autonomous project worker

| Operation family | In-mandate default |
|---|---|
| Read project source, docs, tests and history | Allowed |
| Create/replace/refactor files inside task worktree | Allowed |
| Add and update tests | Allowed |
| Run named build/test/lint profiles | Allowed within Resource Manager/OS limits |
| Create task branches and local commits | Allowed |
| Update an authorized feature branch and open/update a PR | Allowed only when remote scope is included and a credential broker is available |
| Work on another repository or host path | Denied |
| Push directly to protected default/release branch | Denied |
| Merge to protected branch, tag release, publish package, deploy production | Escalation / separate authority |
| Read raw secrets, private keys, wallet seed or credential material | Denied |
| Transfer funds, sign Cardano transactions, alter production governance or submit settlement | Outside this local coding mandate; separate explicit authority required |
| Expand own capabilities, disable policy, modify trust anchor or revoke audit evidence | Denied |

The operator may choose a different policy during the initial mandate ceremony. This table is a proposed default, not a claim that all listed integrations exist today.

Changes to protocol specifications, economic logic or validator code may be autonomously prepared and tested in a feature worktree, with full evidence and a PR. They must not be silently merged, deployed or settled on-chain. Independent review can remain a gate on publication/activation without blocking ordinary autonomous engineering work.

## 7. No token handling in model context

- The local model receives no provider API key, PAT, refresh token, private key, signing seed, TPM handle or bearer credential.
- The model does not sign grants or choose the key used to sign them.
- The Runtime loads the mandate and resolves child authority from trusted local storage; tool calls do not require the operator to copy/paste a token.
- Credential-bearing remote operations are brokered outside the model process and restricted to the mandate's exact repository/organization/operation.
- The agent receives a narrow result such as remote-operation-completed, credential-unavailable or scope-denied, never secret bytes.
- No credential or grant is added to task prompts, transcripts, evidence payloads or Git commits.

A signed internal mandate/grant may still exist as an implementation detail for integrity and audit. That is not an API token the user must obtain, paste or manage.

## 8. Renewal, revocation and stop conditions

The Runtime automatically continues while the mandate is active and unexpired, the trusted host key and consent receipt remain valid, the revocation journal and monotonic anchor reconcile, task/resource budgets remain available, and the requested operation stays within project, branch, path and network scope.

Suspend the worker and report a typed block only when a task requires an operation outside the mandate; workspace/repository/branch identity does not match; remote credentials are unavailable (local work may continue); a budget/lease is denied or exhausted; repeated tests fail beyond the retry policy; source/evidence integrity is ambiguous or stale; signing key, consent, journal or anchor becomes unavailable/invalid; or a protected external action is requested.

No repeated confirmation is needed for ordinary code changes. If a task is blocked, the agent should continue independent in-scope work rather than idling the entire project, unless an integrity or trust failure requires global suspension.

A mandate can be revoked once through the trusted operator control surface. Revocation stops new child grants; current execution is cancelled at a safe boundary and journaled. Recovery from anchor failure remains fail-closed.

## 9. Reconciliation with ADR-0007, ADR-0008 and ADR-0009

- **ADR-0007:** keep operation identifiers and scope as candidate vocabulary, but change the scope model for the autonomous worker from per-file pre-enumeration to a host-resolved isolated worktree root plus exclusions and named execution profiles. The workspace boundary is broad inside the sandbox and narrow outside it.
- **ADR-0008:** keep its Ed25519/JWS verifier as a cryptographic contract. Its one-capability grant may remain an internal child-grant representation; it must not be presented to the operator for each tool call. A later grant-set profile may bundle multiple operations under one task authority.
- **ADR-0009:** replace one-consent-per-grant-intent as the normal workflow with one consent receipt for the project mandate digest. Child task grants are derived automatically. A new consent is required only for renewal that widens the mandate or for an explicitly protected action. Key bootstrap and revocation anchor remain host lifecycle services, not per-operation prompts.
- **Current Agent:** preserve the interactive /code + APPROVO compatibility mode until the autonomous Runtime path is implemented and regression-tested. The autonomous path must use a new trusted task-authority adapter. Do not bypass the old approval prompt by directly calling CodingWorkspace.callTool(); replace it with the reviewed Runtime boundary.
- **Task Manifest:** the manifest records task intent and requested capabilities. It does not carry private credentials. The host mandate supplies the maximum authority; the task request can only attenuate it.

## 10. Implementation plan and acceptance criteria

1. Define and schema-test the project mandate, including a multi-operation capability set, project/worktree binding, branch policy, resource/retry budget, network policy, expiry and protected-action list.
2. Build a fake mandate/child-grant provider and deterministic Runtime authorization engine. Tests must prove no human callback is requested for an in-scope read/write/test loop.
3. Build a dedicated workspace/worktree manager with task-safe root binding, path/symlink containment, named test profiles and cleanup/recovery.
4. Implement local credential brokering as a separate host service. Test that secrets never enter model messages, tool responses, task store or evidence.
5. Implement a durable one-time project mandate store using the key provider and monotonic/revocation model in ADR-0009.
6. Add a new autonomous Agent execution mode that calls the Runtime adapter; keep /code interactive mode available as a legacy/manual fallback.
7. Run end-to-end synthetic tasks that create files, patch files, add tests, fail, repair and finish without any intervening human approval.
8. Add crash/restart tests, scope-escape tests, credential-redaction tests, resource-budget tests and cancellation/revocation tests.
9. Only then enable the autonomous mode for the user's project workspace. Do not activate it by changing the old Agent approval function alone.

Acceptance means: after one project mandate is approved, a synthetic multi-step coding task can read, create, replace, run its named tests, diagnose a failure, fix it, rerun and produce a completion/evidence report with zero per-operation human prompts, while failing closed outside the isolated mandate and never exposing a credential to the model.

## 11. Non-goals and non-regression

- No per-edit, per-file or per-test human approval inside an active project mandate.
- No user-supplied OpenAI/Anthropic API token for local Granite inference.
- No manually pasted bearer token or grant token in prompts or tool calls.
- No model access to private signing keys, API credentials, wallet keys or secrets.
- No direct writes to protected default/release branches by default.
- No uncontrolled host filesystem, general shell, unrestricted network or unbounded compute authority.
- No silent cloud fallback when local inference is unavailable.
- No direct merge/deploy/release, fund transfer, wallet signing or Cardano settlement authority from this coding mandate.
- No removal of the legacy APPROVO path until the new autonomous Runtime boundary has passed its parity and safety tests.
