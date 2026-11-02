# PNC-bound Project Mandate v0.2 — reference integration slice

- **Status:** Proposed reference schemas and isolated policy adapter; not production authority
- **Date:** 2026-11-02
- **Dependencies:** ADR-0010, ADR-0011, PNC Identity Profile v0.1

## 1. Purpose

Mandate v0.1 has no PNC identity field. This proposal adds an explicit PNC identity tuple to a new mandate/consent schema version without changing or reinterpreting v0.1.

The tuple contains contractId, PNC schemaVersion, identityProfile and digest. The mandate digest therefore commits to the PNC identity. The v0.2 consent receipt repeats the tuple so the trusted consent broker can display and compare the exact normative baseline that the operator is approving. The receipt must also bind the complete mandateDigest.

## 2. Runtime binding

The reference adapter requires the following host-resolved facts before deriving a task child authority:
- mandate signature verified, consent verified and revocation state healthy;
- mandate schema validated as v0.2 and includes the PNC identity tuple;
- PNC came from the trusted owner-authorized PNC store;
- PNC schema and semantic checks succeeded;
- every pinned commit and blob SHA was verified;
- PNC status is active;
- recomputed JCS/SHA-256 identity exactly matches the tuple;
- PNC projectRef and repositoryFullName exactly match the mandate project binding.

At each tool invocation, the adapter repeats the PNC identity/status/source-integrity check and verifies the internal child authority contains the same tuple. It then delegates ordinary operational checks to the existing v0.1 policy engine. The PNC does not add operations or increase operational authority.

## 3. Compatibility

The existing v0.1 mandate and consent schemas remain unchanged. The new v0.2 schemas require the PNC tuple; the PNC-bound adapter rejects a v0.1 mandate. The old reference-authority module remains available as a legacy test contract and is not silently treated as PNC-bound.

The consent schema duplicates the PNC tuple deliberately for human-display binding. Schema validation alone cannot compare two documents; the consent verifier must compare the receipt tuple with the mandate tuple and verify the signed mandateDigest. That consent verifier is not yet integrated.

## 4. Trust limits

This is not an integrated local Agent or production Runtime. The flags representing schema validation, source integrity and owner authorization are trusted host-store inputs; they are not accepted from the model. The current repository still has no authenticated PNC store, no mandate signing/persistence lifecycle, no consent UI/broker integration, no runtime Agent connection and no OS-isolated worktree manager. This slice tests the binding contract; it does not enable unattended local mutation or remote credential access.

No PNC is activated by this work. The IMMORTAL example remains draft, so it cannot be used to create an accepted PNC-bound mandate until an authenticated owner-authorized activation process exists.


## 5. Consent tuple enforcement

The v0.2 reference adapter also receives a host-verified consent receipt. Before deriving a child authority and again before each operation, it checks that the receipt is schema-validated, signature-verified and broker-authenticated; that the decision is approve; that mandate ID/digest, issuer, operator, project and workspace match; and that the repeated PNC identity tuple is identical and the receipt remains within its validity window.

The adapter does not verify the receipt signature itself. The booleans are trusted host-store assertions, analogous to the already-required mandate signature/consent assertions. A future consent broker must produce these assertions only after verifying the authenticated envelope and displayed challenge.
