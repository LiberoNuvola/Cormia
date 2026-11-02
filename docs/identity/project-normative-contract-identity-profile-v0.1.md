# PNC Identity Profile v0.1 — proposed and testable

- **Status:** Proposed reference profile; not a signing or authorization standard
- **Date:** 2026-11-02
- **Applies to:** Project Normative Contract schema version 0.1.0
- **Implementation:** runtime/reference-worker/pnc-contract-identity.mjs
- **Tests:** runtime/reference-worker/pnc-contract-identity.test.mjs

## 1. Purpose and boundary

A PNC needs a repeatable content identity before a future mandate or task-child-authority schema can bind to it. This profile defines a candidate deterministic fingerprint for a complete PNC v0.1 object.

The digest is **not** a signature, owner-consent receipt, trusted-source proof, active-contract marker, capability, grant or authorization decision. It cannot activate a PNC, permit an operation, or establish who created or approved the contract. The IMMORTAL example remains draft.

## 2. Canonical representation

Use the JSON Canonicalization Scheme (JCS), RFC 8785, over the complete PNC JSON object.

The reference implementation reuses Cormia's existing JCS-compatible restricted JSON canonicalizer from ADR-0008 rather than introducing a second serializer. It provides recursive object-property ordering and ECMAScript JSON primitive serialization for the supported subset, and rejects malformed Unicode, accessors, sparse arrays, non-plain objects and unsafe numeric values.

For PNC schema v0.1 the canonicalized object includes every contract field, including status, sourceSnapshots, source blob SHAs, decisions, invariants, obligations and policy. No property is omitted or normalized away. Object member order and source whitespace do not affect identity after strict parsing; array order and every field value do. Unicode strings are preserved as supplied and are not normalized.

The PNC loader must reject duplicate JSON object member names before the object reaches the identity function. The existing Python reference loader does this. A caller must validate the full v0.1 schema and semantic cross-references before treating the digest as a valid PNC identity.

RFC 8785 is an Informational RFC, not an IETF Standards Track specification. This document adopts it as an explicit Cormia reference encoding profile only.

## 3. Digest algorithm and domain separation

Let JCS(PNC) be the UTF-8 bytes of the canonical JSON representation.

The exact domain-separation prefix is the UTF-8 encoding of:

    CORMIA\0PROJECT-NORMATIVE-CONTRACT\0v0.1\0

The digest is:

    "sha256:" || lowercase_hex(
      SHA-256(
        UTF8("CORMIA\0PROJECT-NORMATIVE-CONTRACT\0v0.1\0") || JCS(PNC)
      )
    )

The prefix is distinct from ADR-0008's local capability-grant domain. The profile identifier is RFC8785-JCS-SHA256-DOMAIN-SEPARATED-v0.1.

## 4. Compatibility and test vectors

The profile is pinned to PNC schema version 0.1.0. It must not silently process a future schema version. A future schema or canonicalization change requires a new profile identifier and independent compatibility vectors.

Golden vector:

Input object (member order is intentionally non-canonical):

    {"schemaVersion":"0.1.0","status":"draft","contractId":"pnc-test"}

Canonical JSON:

    {"contractId":"pnc-test","schemaVersion":"0.1.0","status":"draft"}

Expected digest:

    sha256:51d81feb0bc9893607f68bbbc5f6727311fcbc86aa9b6931437ca345502ca963

The automated suite also checks key-order invariance, array-order sensitivity, full-field coverage (including status), unknown schema rejection, digest mismatch handling and rejection of unsafe JavaScript inputs.

## 5. Future mandate binding

Do not add a model-controlled PNC reference to the existing Project Mandate v0.1. A future mandate schema version may bind a tuple containing the PNC contract identifier, schema version, identity profile and exact digest. The corresponding consent receipt and derived task authority must bind the same tuple. Trusted Runtime code must load the PNC from its authenticated owner-authorized store, validate its source pins and status, recompute the identity and compare it to the mandate-bound tuple at the capability boundary.

No schema migration, mandate signing, consent flow, task grant, PNC activation or Agent integration is implemented by this profile. Those steps require separate implementation and tests. The canonical digest prevents accidental identity substitution; it does not provide authenticity or trust.
