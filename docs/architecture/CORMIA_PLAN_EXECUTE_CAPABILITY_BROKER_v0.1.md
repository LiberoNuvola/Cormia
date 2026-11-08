# Cormia Plan–Execute and Capability Broker v0.1

- **Status:** isolated Core enforcement slice implemented; production Gate 4 integration remains blocked
- **Date:** 2026-11-08
- **Scope:** provider-neutral plan validation and host-owned operation dispatch boundary
- **Related implementation:** \`runtime/core/plan-execute-capability-broker.mjs\`
- **Related tests:** \`runtime/core/plan-execute-capability-broker.test.mjs\`
- **Related authority:** \`runtime/core/trusted-project-context-resolver.mjs\`, ADR-0010 and the existing local project-operation evaluator

## 1. Purpose and invariant

Cormia must be able to replace Granite or any other Model Provider without changing the system's authority outcomes.

The model returns candidate content or a plan proposal. It does not receive tools, dispatch callbacks, a Capability Broker, credentials, a host policy object, a Task Manifest verifier, a Resource Manager handle or a trusted project session.

The security invariant is:

> A plan proposal can describe an operation, but it cannot execute it. Every operation must be bound to a host-verified task and re-authorized by the Core immediately before dispatch through a fixed host-owned adapter.

The existing effective capability relation remains:

\[
\mathrm{EffectiveCapabilities}
=
\mathrm{Mandate}
\cap
\mathrm{TaskRequest}
\cap
\mathrm{HostPolicy}
\]

Resource admission is separate. A Resource Lease may be an additional capacity prerequisite for a particular step; it does not add an operation to the effective capability set.

## 2. Implemented state flow

\`\`\`text
Host Task Reference
       |
       v
Task Authority Provider
(load and verify manifest)
       |
       v
Verified Task Projection
       |
       v
Trusted Project Resolver
(mandate / consent / revocation / lifecycle / host policy)
       |
       v
Model Proposal (inert, bounded JSON)
       |
       v
PLAN
  - strict shape/size checks
  - host adapter input validation
  - authorize every operation
  - no dispatch
       |
       v
Core planRef + planDigest + READY
       |
       v
EXECUTE (host orchestrator only)
  - check plan digest and one-shot state
  - re-authorize step
  - resolve host resource requirement
  - acquire lease where required
  - re-authorize within lease callback
  - dispatch fixed host operation adapter
       |
       v
COMPLETED / FAILED
\`\`\`

The model's function/tool-call-shaped output remains inert ModelProvider content. The broker accepts a separate versioned proposal object; arbitrary fields such as \`tools\`, \`dispatch\`, \`hostPolicy\`, \`resourceOperation\` or credential data are rejected by exact-shape validation.

## 3. Proposal and task binding

The broker accepts the proposal contract \`cormia.plan-proposal/0.1\`:
- \`contractVersion\`
- \`steps\`, each containing \`operation\`, a bounded JSON \`input\` record and only the optional authorization fields understood by the existing operation evaluator: \`relativePath\`, \`executionProfileId\`, \`branchName\`, \`remoteHost\`.

The caller passes only a host-selected \`taskRef\`. The broker calls the captured \`taskAuthorityProvider.loadVerifiedTask(taskRef)\` and accepts an exact bounded projection:
- \`taskId\`
- \`manifestDigest\`
- \`requestedOperations\`
- \`expiresAt\`

The host provider is responsible for authenticating and verifying the Task Manifest. The broker verifies the projection's shape, digest format, operation uniqueness, task reference and expiry. It does not claim to verify the signature itself.

The broker then calls \`trustedProjectResolver.createTaskSession(verifiedTask)\`. That existing resolver revalidates project descriptor, steward/accountability, mandate signature/key status via the host provider, operator consent, mandate revocation/anchor, project lifecycle and host policy. Every \`authorizeOperation\` call re-resolves these sources and the policy.

## 4. PLAN

PLAN is an inert validation phase:
1. Verify the exact proposal contract and bounded JSON size/depth.
2. Load and bind the verified Task Manifest projection.
3. Obtain a task session from the Trusted Project Resolver; reject if the project is not active or trust resolution fails.
4. Resolve the fixed host adapter registered for each operation.
5. Run the adapter's synchronous, side-effect-free \`validateInput\`.
6. Ask the task session to authorize the operation against the current mandate/task/host-policy intersection.
7. If every step passes, create a Core-generated \`planRef\`, canonical digest, creation time and \`READY\` state.

No operation adapter's \`execute\` method is called in PLAN. If any step fails, no READY plan is returned and no dispatch occurs.

## 5. EXECUTE

The host orchestrator separately calls \`executePlan({ planRef, expectedPlanDigest })\`. That method is not a tool offered to the model.

The state changes synchronously from \`READY\` to \`EXECUTING\` before the first await. Duplicate and concurrent calls cannot run the same plan twice. The expected digest must match the Core-stored digest.

For every step:
1. Revalidate the Task Manifest signature/status and exact task projection, check task expiry, then recheck task-session authorization.
2. Ask the host-only Resource Admission Provider whether capacity is needed.
3. If required, acquire through the captured Resource Provider using a task-bound lease.
4. Inside the lease callback, assert lease activity and re-authorize mandate, task, host policy, consent, revocation and lifecycle immediately before dispatch.
5. Invoke only the fixed host adapter registered for the operation.
6. Return to the Resource Provider so it can release the lease; require a released lease receipt before treating the step as successful.

If a step fails, the broker stops subsequent steps and records \`FAILED\` with the number of already completed steps. It does not claim rollback or multi-step transactional atomicity; earlier successful side effects may remain.

## 6. Host ports

All of the following are captured at broker construction and are not fields of the model proposal:

- \`trustedProjectResolver.createTaskSession(verifiedTask)\`;
- \`taskAuthorityProvider.loadVerifiedTask(taskRef)\`;
- \`resourceAdmissionProvider.resolveRequirement(context)\`;
- optional fixed \`resourceProvider.withLease(...)\`;
- an operation-adapter registry keyed by operation ID, with \`validateInput\` and \`execute\` host functions.

Adapter validators must be synchronous and side-effect-free. Adapters must independently validate exact operation data, enforce filesystem realpath/symlink containment, use bounded workspace/Git operations and never reinterpret untrusted model content as shell commands or arbitrary host paths. Any resource-sensitive adapter must call the provided \`assertResourceActive\` at each side-effect boundary, not only once at task start.

The Task Authority Provider, Trusted Project Resolver's backing providers, Resource Admission Provider, Resource Provider and operation adapters are trusted composition ports. Interface validation cannot make an untrusted provider trustworthy.

## 7. Failure behavior

Fail-closed conditions include:
- missing, expired, revoked or changed verified task;
- invalid proposal shape, unknown fields or oversized input;
- missing host adapter or rejected adapter input;
- unresolved/expired/revoked mandate, invalid consent, unhealthy revocation anchor or inactive project;
- operation outside the effective capability intersection;
- host policy change after PLAN;
- required Resource Lease denied, expired, revoked or missing a valid active lease context;
- plan digest mismatch, duplicate execution or concurrent execution.

Provider output never becomes an execution callback. No remote fallback or model-selected adapter is introduced.

## 8. Test evidence and implementation boundary

The Node test suite composes the actual broker implementation with the actual Trusted Project Resolver implementation and synthetic host trust ports, a synthetic verified-task provider and operation-adapter doubles. It tests:
- PLAN zero-dispatch behavior;
- protected and out-of-task operations;
- path traversal;
- revalidation after revocation, lifecycle and host-policy changes between PLAN and EXECUTE;
- required Resource Lease denial and task-bound admission;
- rejection of untrusted tool/dispatch/policy fields;
- adapter input rejection;
- plan digest binding, one-shot and concurrent duplicate fencing;
- Task Manifest revalidation, revocation and projection-change rejection;
- task expiry and mandatory port composition.

These tests demonstrate the broker's control flow and deterministic checks. They do not authenticate a real mandate, operator, Task Manifest or revocation anchor, and do not prove safe real filesystem/Git operations.

## 9. Remaining production gates

Gate 4 remains **BLOCKED** pending:
1. Production Task Manifest signature/claims verifier and host Task Authority Provider.
2. Production project-mandate signature/key bootstrap, authenticated operator-consent, identity/accountability and independent monotonic revocation/anchor providers.
3. Production fixed workspace/filesystem/Git operation adapters with realpath/symlink controls and tested side-effect boundaries.
4. Host composition with the actual Windows ResourceManager and local Cormia Runtime.
5. End-to-end test evidence showing real host dispatch count and task/evidence state transitions for both the synthetic provider and llama.cpp provider.
6. Adversarial tests proving all unauthorized proposals yield zero privileged dispatches against that integrated production path.

This implementation does not change IMMORTAL AEP semantics or the user's IMMORTAL Local Agent, prompts, Task Store, MCP allowlist, Granite configuration or Windows installation.
