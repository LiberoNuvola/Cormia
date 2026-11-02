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
