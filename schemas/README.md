# Schemas

The JSON Schemas in this directory are early interface drafts. They are not yet a canonical encoding specification. Before protocol implementation, select and pin a canonical JSON representation, signature envelope, digest algorithm, domain separation, versioning and backwards-compatibility rules. Schema validity alone is not a protocol verdict.


## Compute contribution receipt

`compute-contribution-receipt.schema.json` is an interface draft for a remote contribution. It distinguishes reciprocal-mesh and sponsored service modes, and requires a declared privacy class and verification profile when those fields are present. JSON Schema validation only checks shape. Semantic policy MUST separately reject credit issuance from `provisional`, `challenged`, `rejected` or expired receipts. Public input commitments must be blinded; never publish a bare prompt hash that enables dictionary guessing.
