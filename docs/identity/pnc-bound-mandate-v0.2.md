# PNC-bound Project Mandate v0.2 — reference integration slice

- **Status:** Proposed reference schemas and isolated policy adapter; not production authority
- **Date:** 2026-11-02
- **Dependencies:** ADR-0010, ADR-0011, PNC Identity Profile v0.1, ADR-0009

## 1. Purpose

Mandate v0.1 remains unchanged. The v0.2 mandate binds one exact PNC identity tuple and uses a non-circular consent construction aligned with ADR-0009 §4.4.

## 2. Non-circular consent and mandate digests

The v0.2 mandate contains two receipt-related fields:
- consentIntentDigest: canonical digest of complete mandate intent after removing consentIntentDigest and operatorConsentDigest;
- operatorConsentDigest: digest of the canonical consent receipt claims.

The receipt contains consentIntentDigest, not the final mandate digest. This is intentional: including the final mandate digest in a receipt whose own digest is embedded in the mandate would create a circular dependency.

Construction order:
1. construct complete mandate intent, including the PNC binding, but omit both consent digest fields;
2. compute the domain-separated consentIntentDigest;
3. build the consent receipt with that digest and the final eight hexadecimal characters as the displayed/confirmed challenge;
4. obtain the host-signed receipt after authenticated interactive approval by the broker;
5. compute operatorConsentDigest over canonical receipt claims;
6. insert both digests into the final mandate claims;
7. compute the final mandate claims digest and sign the mandate;
8. at every task/operation boundary, verify mandate signature/digest, receipt signature/digest, intent digest, challenge, expiry, PNC identity/status/source pins and exact tuple equality.

The reference identity helper uses three independent SHA-256 domains and the existing restricted JCS-compatible canonicalizer. No receipt or mandate signature is performed by these helpers.

## 3. Runtime binding

The reference adapter requires host-validated v0.2 mandate, receipt and PNC envelopes. It recomputes the intent digest, receipt claims digest and complete mandate claims digest. It checks the receipt's mandate ID, issuer, operator, project, workspace, PNC tuple, approved decision, challenge equality and validity window.

It also requires host-resolved PNC store assertions for schema validation, source integrity and owner authorization; active status; recomputed PNC digest; and project/repository match. It derives a child authority containing the same PNC tuple and rechecks these bindings before each operational authorization.

## 4. Compatibility and trust limits

The v0.1 mandate and consent schemas are unchanged. The v0.2 schemas require the PNC identity tuple and both consent digest fields. The PNC-bound adapter rejects v0.1 mandates.

This remains a reference contract, not production authority. It does not verify signed JWS envelopes itself, create a real OS-authenticated consent UI, provision or access a non-exportable key, persist mandates or PNC records, implement a durable revocation journal/monotonic anchor, create isolated worktrees, or connect to the Agent. Signature and broker flags are trusted host-store assertions, not model inputs.

The IMMORTAL fixture remains draft. No PNC activation, mandate issuance or real project delegation has occurred.
