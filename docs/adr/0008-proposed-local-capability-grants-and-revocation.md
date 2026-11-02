# ADR-0008: Proposed signed local capability grants and revocation

- **Status:** Proposed — experimental local contract; not normative AEP authorization
- **Date:** 2026-11-02
- **Depends on:** [ADR-0007](./0007-proposed-task-capabilities-and-workspace-scope.md)
- **Scope:** signed, task-bound authorization for the first local read-only Coding Workspace adapter

## 1. Context and source constraints

The current Task Manifest is a draft and does not define a canonical encoding, signature envelope, requester/worker key registry or authenticated grant issuer. The repository's schema guidance explicitly leaves canonical representation, signature envelope, digest algorithm, domain separation, versioning and compatibility rules open.

The local Coding Workspace also has a separate caller-side approval boundary: `callTool()` does not enforce the Agent's `APPROVO` workflow. The first Cormia adapter therefore cannot infer permission from a model-proposed action or call a mutating tool directly.

This ADR defines a testable local grant envelope without changing the normative Task Manifest, the Agent task store, or the interactive approval path.

## 2. Authority proposal

Use two distinct decisions:

1. **Task request:** an authenticated Task Manifest requests a bounded set of capabilities. The requester cannot compel a worker to accept a request.
2. **Local host grant:** the worker's trusted local host authority issues a grant only after its local policy and the operator-consent process accept the exact task, manifest digest, worker/runtime subject, workspace, operations and paths.

The local grant issuer is the **worker host authority**, not the model and not an untrusted task requester. The key resolver supplied by trusted Runtime code must bind a key ID to a public key, an issuer identity, the role `local-host-authority`, and active key status. An unknown, inactive, wrongly typed or mismatched key is denied.

The local host policy is an upper bound. It must explicitly pin the expected `issuerId`, workspace reference, allowed capability/path sets, active signing key and maximum grant lifetime. A grant can only narrow the host's allowed operation and path sets. A signed grant is still insufficient by itself: each invocation also checks the expected task and manifest digest, worker/runtime identity, expiry, current revocation feed, workspace binding, operation and exact path.

### 2.1 Key bootstrap remains unresolved

This repository does not contain a local identity registry or a trusted key-provisioning flow. This ADR does not generate, store, upload or rotate a real private key.

Before production use, the owner-controlled signing key must be provisioned and protected outside the repository (for example, by an OS or hardware-backed key store where available). The trust anchor that authorizes the initial local-host public key, backup/recovery, rotation, compromise response and key revocation are still open decisions. Test keys are generated ephemerally in memory and are never persisted.

A key's presence in a JSON file or a `kid` string is not proof of authority. Trust comes only from the host-controlled resolver and its separately established trust anchor.

## 3. Signed representation proposal

The experimental local transport is **JWS Compact Serialization** with a protected header containing exactly:

- `alg: "Ed25519"`;
- `typ: "application/immortal-aep-local-capability-grant+jws"` (or the corresponding revocation type);
- `kid`: the host-trusted signing-key identifier.

The payload is UTF-8 JSON canonicalized using the JSON Canonicalization Scheme (JCS, RFC 8785). The current v0.1 claim schemas restrict numeric values to safe integers, so the local canonicalizer intentionally rejects floats and unsafe integers. It also rejects non-canonical JSON payload bytes, which catches whitespace/property-order variants and duplicate JSON member ambiguity after parsing.

The signature algorithm identifier is `Ed25519`, not the polymorphic `EdDSA` identifier: RFC 9864 (October 2025) defines fully specified JOSE identifiers and deprecates the polymorphic identifiers updated by that RFC. JWS Compact signing input is the base64url protected header, a dot, and the base64url payload, as defined by RFC 7515.

The grant digest used by revocation is SHA-256 over a domain-separated prefix plus the canonical claim bytes. The JWS protected `typ` and the payload schema version/type provide an additional type boundary. The Task Manifest digest itself is **not** computed here: it must be supplied by a future trusted manifest-verification layer and compared exactly.

References:
- [RFC 7515 — JSON Web Signature](https://www.rfc-editor.org/rfc/rfc7515.html)
- [RFC 9864 — Fully-Specified Algorithms for JOSE and COSE](https://www.rfc-editor.org/rfc/rfc9864.html)
- [RFC 8785 — JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html)

RFC 8785 is an Informational RFC, not an IETF Standards Track specification. It is proposed here as an encoding profile for this experimental local contract, not as a decision that the whole AEP protocol has selected a canonical encoding.

## 4. Grant claims v0.1

The claims are defined by [local-runtime-capability-grant-claims-v0.1.schema.json](../../schemas/local-runtime-capability-grant-claims-v0.1.schema.json). They bind:

- version and unique `grantId`;
- `taskId` and exact `manifestDigest`;
- trusted `issuerId`;
- `subject.workerId` and `subject.runtimeId`;
- one capability identifier;
- one `workspaceRef` plus exact file or directory paths (or a named test profile for a future test capability);
- `issuedAt`, `notBefore` and `expiresAt`;
- `delegable: false`.

A separate grant is issued for each capability. No wildcard, glob, recursive prefix expansion, absolute host path, drive path, UNC path or general shell permission is represented. File/directory path strings use slash separators and must be canonical. The underlying workspace adapter must still re-check realpath, symlink/junction and file-type boundaries at invocation time.

A local grant's maximum lifetime is not globally hard-coded. A trusted host policy supplies `maxGrantLifetimeSeconds`; the evaluator denies grants exceeding it. The local policy must also provide the exact workspace binding, allowed capabilities, allowed files and allowed directories.

## 5. Initial executable disposition

The contract verifier and evaluator expose only these operations as initially supported:

- `workspace.list`;
- `workspace.read`;
- `workspace.diff`;
- `workspace.verify`.

They require an exact operation/path match and intersection with host policy. `workspace.create`, `workspace.replace` and `workspace.test` may be described by the schema, but the v0.1 evaluator always rejects them as unsupported by the read-only adapter. They do not acquire a new unattended meaning.

The grant's `delegable` value is fixed to `false`. Parent/child grants, attenuation chains, delegation signatures and delegated issuer roles are not enabled by this version. A later version must prove that child operation, path, lifetime and resource limits are a strict subset of the parent grant.

## 6. Revocation proposal

A revocation is a separately signed JWS using the distinct revocation `typ` and [local-runtime-capability-revocation-claims-v0.1.schema.json](../../schemas/local-runtime-capability-revocation-claims-v0.1.schema.json). It binds the exact `grantId`, domain-separated `grantDigest`, `taskId`, `issuerId`, `revokedAt`, positive monotonic `sequence`, and a closed `reasonCode`.

For v0.1, only the original local-host authority can revoke its own grant. The evaluator verifies the signature, issuer, grant ID, grant digest and task binding before denying an invocation. The supplied revocation list must be in strictly increasing sequence order; duplicates and out-of-order events fail closed.

**Important limitation:** this contract does not yet implement a durable, rollback-resistant revocation journal or signed revocation checkpoint. A caller must supply the current host-trusted revocation feed. Preventing an attacker from restoring an older feed requires monotonic durable state, atomic persistence, backup/recovery rules and a trusted latest-sequence checkpoint. Until that exists, this is a revocation contract test, not a production revocation service.

## 7. Implemented experimental contract

Implementation:
- [local-runtime-capability-grants.mjs](../../runtime/reference-worker/local-runtime-capability-grants.mjs)
- [local-runtime-capability-grants.test.mjs](../../runtime/reference-worker/local-runtime-capability-grants.test.mjs)

The helper:
- canonicalizes the restricted claims subset;
- signs and verifies compact JWS tokens with Node's Ed25519 primitives;
- resolves signer keys only through a trusted host-supplied resolver;
- validates claim shape, subject, task/manifest binding and lifetime;
- intersects exact paths with host policy;
- checks the supplied signed revocation list;
- denies all write/replace/test capabilities in this local v0.1 evaluator.

This helper is **not connected** to `agent.mjs`, `CodingWorkspace.callTool()`, the existing `APPROVO` workflow, a Task Manifest parser, a key store, or a persistent revocation journal. It does not issue grants automatically. The tests use ephemeral in-memory keys only. Its per-capability token representation is an internal contract candidate, not a requirement for the model or operator to handle a token on each call. The autonomous target is one project mandate with Runtime-derived child authority, as defined in [ADR-0010](./0010-autonomous-project-delegation-and-runtime-authority.md).

The dedicated [Local Runtime Capability Grant Contracts run #11](https://github.com/LiberoNuvola/Cormia/actions/runs/41475593197) completed **SUCCESS**: all 21 cryptographic and policy contract tests passed. The final suite also checks that sparse arrays and accessor properties are rejected before validation reads them. It is a contract test of this isolated helper, not proof of key custody, host policy provisioning, operator consent, Agent integration, task isolation, durable revocation or AEP conformance.

## 8. Follow-on authority lifecycle design

The next non-normative design step is recorded in [ADR-0009 — local authority bootstrap, operator consent and revocation anchor](./0009-proposed-local-authority-bootstrap-consent-and-revocation-anchor.md). ADR-0008 v0.1 remains an isolated grant-verification contract and must not be treated as production-ready until that lifecycle design is implemented and reviewed.

## 9. Open decisions before any production integration

1. How is the local host authority identity and first public key established, protected, recovered, rotated and revoked?
2. What exact operator-consent action causes a host grant to be signed, and how is that consent bound to the displayed digest and scope?
3. How is the current revocation feed protected against truncation, rollback, stale backup restoration and concurrent updates?
4. What persistent store and atomicity/locking model protect grants, revocations, sequence counters and audit records?
5. What authenticated manifest format supplies the exact `manifestDigest` and requester identity?
6. How will a task-specific workspace root/worktree be created and cleaned up before enabling unattended mutation or testing?
7. What delegation chain and attenuation proof are required before `delegable` can ever become true?

## 10. Non-regression and non-goals

- Do not change `SPEC.md`, `schemas/task-manifest.schema.json`, current local task-store formats, or PRE-RICH/IMMORTAL-Protocol semantics through this ADR.
- Do not bypass or silently weaken the existing Agent `/code` and `APPROVO` compatibility workflow. The target autonomous mode is a new Runtime authorization path under the project mandate in ADR-0010, not a repeated approval prompt.
- Do not generate or store real signing keys in GitHub or this repository.
- Do not expose shell, Git mutation, workflow dispatch, network, wallet or Cardano signing capabilities.
- Do not permit mutation/test grants in the current shared Coding Workspace.
- Do not claim production authorization, durable revocation, task isolation or AEP conformance from the helper tests.
