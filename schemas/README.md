# Schemas

The JSON Schemas in this directory are early interface drafts. They are not yet a canonical encoding specification. Before protocol implementation, select and pin a canonical JSON representation, signature envelope, digest algorithm, domain separation, versioning and backwards-compatibility rules. Schema validity alone is not a protocol verdict.


## Compute contribution receipt

`compute-contribution-receipt.schema.json` is an interface draft for a remote contribution. It distinguishes reciprocal-mesh and sponsored service modes, and requires a declared privacy class and verification profile when those fields are present. JSON Schema validation only checks shape. Semantic policy MUST separately reject credit issuance from `provisional`, `challenged`, `rejected` or expired receipts. Public input commitments must be blinded; never publish a bare prompt hash that enables dictionary guessing.


## Local IMMORTAL Agent compatibility formats

- [immortal-agent-task-store-v1.schema.json](immortal-agent-task-store-v1.schema.json) describes the existing local Agent v1 `tasks.json` envelope. It is not an AEP Task Manifest.
- [immortal-agent-attempt-evidence-v1.schema.json](immortal-agent-attempt-evidence-v1.schema.json) describes one per-attempt evidence sidecar. It is not a canonical AEP Evidence Package.

These schemas preserve unknown properties and are used only for compatibility validation. See [the adapter contract](../runtime/reference-worker/LOCAL_AGENT_TASK_STORE_V1.md).

## Experimental local capability grant contracts

- [local-runtime-capability-grant-claims-v0.1.schema.json](local-runtime-capability-grant-claims-v0.1.schema.json) describes the payload claims for one host-issued local Coding Workspace capability.
- [local-runtime-capability-revocation-claims-v0.1.schema.json](local-runtime-capability-revocation-claims-v0.1.schema.json) describes one signed revocation statement.

These are experimental local contracts, not additions to the canonical Task Manifest or a network-wide identity/authorization format. The payloads are carried in compact JWS tokens using the proposed Ed25519/JCS profile described in [ADR-0008](../docs/adr/0008-proposed-local-capability-grants-and-revocation.md). The host key resolver and host policy are trusted inputs; the schemas alone do not establish trust. No real key material is stored in this repository, and the contracts are not connected to the Agent.

## Local authority lifecycle proposals

The following v0.1 files are non-normative local design contracts associated with [ADR-0009](../docs/adr/0009-proposed-local-authority-bootstrap-consent-and-revocation-anchor.md):

- [local-host-authority-key-descriptor-v0.1.schema.json](local-host-authority-key-descriptor-v0.1.schema.json): public key metadata and opaque provider reference only; private key export is forbidden.
- [local-operator-consent-claims-v0.1.schema.json](local-operator-consent-claims-v0.1.schema.json): one explicit, task/grant-intent-bound operator decision.
- [local-revocation-journal-event-v0.1.schema.json](local-revocation-journal-event-v0.1.schema.json): one event in a hash-linked, signed revocation journal.
- [local-revocation-checkpoint-claims-v0.1.schema.json](local-revocation-checkpoint-claims-v0.1.schema.json): signed journal head to compare with an independent monotonic anchor.

These schemas do not implement key provisioning, authenticated UI consent, persistent journal storage or anti-rollback by themselves. Semantic checks and provider guarantees are defined in ADR-0009. They do not change the Task Manifest or ADR-008 v0.1 grant profile.

The host key descriptor permits `Ed25519` (the current isolated ADR-008 v0.1 profile) and `ES256` (a candidate for a future Windows CNG profile). The ADR-008 grant helper currently supports Ed25519 only. Listing ES256 in the descriptor schema does not enable ES256 signing or verification; see the read-only [Windows CNG discovery probe](../scripts/probe-windows-cng-capabilities.ps1) and [ADR-0009](../docs/adr/0009-proposed-local-authority-bootstrap-consent-and-revocation-anchor.md).

## Autonomous project delegation proposal

[ADR-0010](../docs/adr/0010-autonomous-project-delegation-and-runtime-authority.md) defines the target for autonomous local project work. Its draft schemas are:

- [local-autonomous-project-mandate-claims-v0.1.schema.json](local-autonomous-project-mandate-claims-v0.1.schema.json): one standing project mandate with multi-operation authority, a dedicated project worktree, operation/network/resource policies, expiry and protected-action boundaries.
- [local-project-mandate-consent-claims-v0.1.schema.json](local-project-mandate-consent-claims-v0.1.schema.json): one interactive operator consent receipt over the complete mandate digest.

The intended interaction is one initial project delegation, not approval for every edit, patch or test. The Runtime loads the mandate and derives internal child grants automatically. The schema files do not yet implement mandate signing, storage, Agent integration or credential brokering.

## Project Normative Contract

[ADR-0011](../docs/adr/0011-project-normative-contract.md) defines the Project Normative Contract (PNC), a source-pinned project policy record distinct from the operational project mandate. Its v0.1 interface is:

- [project-normative-contract-v0.1.schema.json](project-normative-contract-v0.1.schema.json): declares pinned source snapshots, source authority classes, closed decisions, protected invariants, open obligations, evidence classification rules and human-authority triggers.
- [IMMORTAL example contract](../examples/project-normative-contracts/immortal-protocol-v0.1.json): a draft fixture pinned to one observed IMMORTAL repository commit and the Git blob SHA of each listed source document.

A PNC grants no capabilities and is not a signature, consent receipt or authorization token. JSON Schema checks shape only; the Runtime must independently verify repository/commit/path/blob bindings, source precedence, references, semantic consistency and authenticated project-owner activation. The proposed PNC Identity Profile v0.1 (docs/identity/project-normative-contract-identity-profile-v0.1.md) defines a tested JCS/SHA-256 fingerprint, but does not authenticate or activate a contract. The current Project Mandate v0.1 and authority prototype do not yet bind or enforce a PNC identity.


## PNC-bound Project Mandate v0.2

- [local-autonomous-project-mandate-claims-v0.2.schema.json](local-autonomous-project-mandate-claims-v0.2.schema.json): a new mandate format requiring the complete PNC identity tuple.
- [local-project-mandate-consent-claims-v0.2.schema.json](local-project-mandate-consent-claims-v0.2.schema.json): consent receipt repeats the same PNC identity tuple as well as the mandate digest.

Version 0.1 remains unchanged. The isolated reference adapter is in runtime/reference-worker/pnc-bound-project-authority.mjs; it requires an active, source-verified, owner-authorized PNC and binds the same tuple into each derived child authority. It is not wired into the Agent or an authenticated local PNC store.
