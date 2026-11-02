# ADR-0009: Proposed local authority bootstrap, operator consent and revocation anchor

- **Status:** Proposed — non-normative security design; no real key or persistence provider activated
- **Date:** 2026-11-02
- **Depends on:** [ADR-0007](./0007-proposed-task-capabilities-and-workspace-scope.md) and [ADR-0008](./0008-proposed-local-capability-grants-and-revocation.md)
- **Scope:** local-only host identity, task-specific operator consent, and rollback-aware revocation recovery

## 1. Source findings and security boundary

The 2026-11-02 local nucleus source review records these relevant properties:

- The Agent Task Store is saved through a temporary file and rename. This is a useful crash-recovery pattern, but it does not establish anti-rollback protection.
- The Evolution Manager has a hash-linked journal. The source review explicitly says that this is an integrity check, not a digital signature or protection against a privileged local attacker.
- The Control Room is a local operator surface, but its configuration and UI assets were excluded from the source-review bundle. Its actual authentication, session and consent affordances have therefore not been certified for this purpose.
- The existing Agent `APPROVO` is an interactive operation-scoped approval, not a durable signed authorization for an unattended task.

No existing component currently supplies a complete local host trust anchor, task-bound operator-consent receipt, or rollback-resistant revocation counter. This ADR deliberately composes no new authority from those incomplete pieces.

## 2. Decision summary

Separate three independent records and their authorities:

1. **Host authority key descriptor:** identifies the public key and opaque key-provider handle of the local host authority. The private key remains inside a protected signing provider and is never written to Cormia, Task Store, evidence sidecars, Git or ordinary configuration.
2. **Operator consent receipt:** records one explicit, authenticated, interactive decision over a canonical task/grant intent. It is not inferred from model output, task text, a prior generic approval or mere possession of a host signing key.
3. **Revocation journal + protected monotonic anchor:** records signed revocation events in a hash-linked sequence and binds the latest journal head to state that cannot be rolled back together with the journal file.

A grant is usable only when all three trust paths are healthy: host key trusted and active, the applicable operator delegation valid, and revocation journal reconciled with the monotonic anchor. For the autonomous project-worker target, the operator consents once to the complete project mandate digest; the Runtime derives child task grants automatically. Per-operation approval is explicitly not the target. See [ADR-0010](./0010-autonomous-project-delegation-and-runtime-authority.md).

The present ADR-008 v0.1 grant helper remains a test-only contract. It does not gain these production properties by the addition of these schemas.

## 3. Host authority bootstrap and key lifecycle

### 3.1 First-use trust ceremony

The first operational key must not be trusted merely because it appears in a local JSON file, a workspace, a task, a Git repository, a downloaded configuration or a remote response.

Proposed bootstrap:

1. The operator starts an explicit local setup command or trusted local setup UI on the worker machine.
2. A platform key provider creates an Ed25519 key pair. Private material is non-exportable through the provider API. Cormia receives only an opaque provider key reference and the public SubjectPublicKeyInfo (SPKI) bytes.
3. Cormia computes a domain-separated public-key fingerprint and displays the `issuerId`, `keyId`, provider, algorithm and full fingerprint to the operator.
4. The operator explicitly pins that fingerprint through a trust operation outside the workspace and task data being protected. The first key descriptor remains `pending-pin` until the pin is verified.
5. Only after the pin is verified may the descriptor become `active` and the resolver return it as `role: local-host-authority`, `status: active`.

No silent trust-on-first-use is proposed. A cloned repository or restored task backup must not be able to bootstrap a new authority automatically.

### 3.2 Provider boundary

Use an injected platform provider interface, not a PEM private key file:

- `createNonExportableSigningKey({ algorithm: "Ed25519" | "ES256" })`;
- `getPublicKey(keyRef)`;
- `sign(keyRef, signingInput)`;
- `resolvePublicKey(keyId)`;
- `getProviderIdentity()`;
- `getTrustedBootstrapPin()`.

The first interface is a design contract, not a claim that all operating systems/providers support Ed25519 non-exportable signing identically. The concrete Windows, Linux and hardware-backed implementations must be independently reviewed and tested. A provider that cannot protect its private key or bind the public key to the expected local issuer must not issue production grants.

No private key, seed, recovery phrase, provider secret or hardware credential may be placed in the repository, a GitHub secret, Agent task data, audit log, evidence sidecar or workspace.

### 3.2.1 Windows CNG compatibility — discovery only

Microsoft's current CNG provider documentation lists ECDSA P-256/P-384/P-521 and RSA among the documented Microsoft Software Key Storage Provider algorithms. It identifies the Microsoft Platform Crypto Provider as the TPM-backed KSP, but the provider page does not promise one universal algorithm list for every TPM/device. The CNG algorithm identifiers page also notes that third-party providers can offer additional algorithms.

Relevant API behavior:
- `NCryptOpenStorageProvider` opens a named registered KSP;
- `NCryptEnumAlgorithms` enumerates the algorithms the opened provider reports; `dwAlgOperations = 0x10` filters for digital-signature operations, while zero enumerates all algorithms.

Sources:
- [Microsoft — CNG Key Storage Providers](https://learn.microsoft.com/en-us/windows/win32/seccertenroll/cng-key-storage-providers)
- [Microsoft — CNG Algorithm Identifiers](https://learn.microsoft.com/en-us/windows/win32/seccng/cng-algorithm-identifiers)
- [Microsoft — NCryptEnumAlgorithms](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptenumalgorithms)
- [Microsoft — NCryptOpenStorageProvider](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptopenstorageprovider)

The read-only discovery script is [`scripts/probe-windows-cng-capabilities.ps1`](../../scripts/probe-windows-cng-capabilities.ps1). It queries the Microsoft Platform and Software KSPs and, when present, reads TPM status through `Get-Tpm`. It creates no key, certificate or file and does not change machine state. [Windows CNG Capability Discovery run #2](https://github.com/LiberoNuvola/Cormia/actions/runs/41480382232) executed successfully on a GitHub-hosted Windows runner. That runner reported no TPM and an unavailable Platform Crypto Provider; its Software KSP reported ECDSA P-256/P-384/P-521, DSA, ML-DSA and RSA, but did not report Ed25519. This is CI-runner evidence only and says nothing about the user's actual Windows device.

Consequently, ES256 (JWS ECDSA P-256) is a candidate for a Windows CNG-backed key, not an accepted implementation choice. The descriptor schema can describe `Ed25519` or `ES256`, but the existing ADR-008 v0.1 grant helper verifies only Ed25519. An ES256 grant profile requires a separately versioned implementation and positive/negative cryptographic tests. A read-only provider inventory is not proof that a key can actually be created non-exportably, signed with, and verified end-to-end. The actual machine's provider and TPM must be probed before selecting a path.

### 3.3 Descriptor and rotation

[local-host-authority-key-descriptor-v0.1.schema.json](../../schemas/local-host-authority-key-descriptor-v0.1.schema.json) is public/opaque metadata only. It requires:
- a declared `Ed25519` or `ES256` algorithm and public SPKI bytes/fingerprint;
- issuer and key identifiers;
- opaque provider ID/reference;
- `privateKeyExportable: false`;
- monotonically increasing key generation and explicit status;
- trust-anchor fingerprint for active/retired/revoked descriptors.

Private key material is not a permitted property.

The host must have exactly one active signing key per issuer for v0.1. Rotation requires:
- a new key generated by the trusted provider;
- explicit operator review and pinning of the new public fingerprint;
- a transition record binding old and new key IDs, generations and fingerprints;
- an authenticated activation time;
- retirement or revocation of the old key in the trusted resolver.

If the old key is suspected compromised, do not accept its signature as sufficient authorization to replace itself. Recovery requires an out-of-band re-pin using the operator's separately protected recovery procedure. That procedure is not yet implemented.

Historical verification is a separate policy from permission to sign new grants. Retired keys must remain available as public verification keys for their valid historical period. The current ADR-008 v0.1 verifier accepts only resolver entries marked `active`; that is a deliberate prototype restriction, not a complete key-rotation design. Before activation, define and test separate `canSign` and `canVerifyHistorical` decisions, trusted retirement/revocation cutoffs and compromised-key handling. Do not make a retired key active again merely to replay an old journal.

### 3.4 Fail-closed conditions

Do not sign a grant when the key is missing, inactive, expired, revoked, unpinned, wrong-issuer, provider-unavailable or unable to report the expected key fingerprint. Never regenerate a replacement key automatically after a missing key or restore event.

## 4. Exact operator-consent ceremony

### 4.1 Canonical intent

Before presenting consent, the trusted Runtime constructs one immutable intent from trusted inputs. It includes at minimum:

- task ID and authenticated manifest digest;
- issuer, worker and Runtime identities;
- capability ID;
- workspace reference and exact file/directory set or named execution profile;
- resource/constraint profile where applicable;
- host-policy digest;
- grant validity interval;
- intended adapter and operation family.

The host computes a domain-separated `consentIntentDigest` over the canonical intent. This digest, not free-form task prose, is the object the operator approves.

### 4.2 Local interactive project-mandate delegation

A trusted local consent broker must display the complete project mandate digest and its effective authority in the same initial project-setup interaction. It must clearly state that routine in-scope reads, edits, tests and builds will run autonomously without further prompts. The detail below is a one-time mandate delegation ceremony, not an approval step repeated for every operation:

- task ID and manifest digest;
- exact operation(s), workspace and paths;
- whether content will be read, created, replaced or executed;
- expiry and relevant resource/network/privacy constraints;
- the complete intent fingerprint and a short challenge derived from it.

The operator explicitly approves or denies the whole mandate once. The proposed initial challenge is the final eight lowercase hexadecimal characters of the mandate digest; the operator must type the displayed suffix to approve the project authority. A change that widens the mandate requires a new consent; routine tool calls and automatically derived child grants do not. A timeout, closed window, missing authenticated operator identity, denied action, mismatched challenge or unavailable consent broker is a denial.

This proposal is one-time and project-scoped. It allows autonomous child tasks only within the displayed mandate, project worktree, budgets and protected-action limits. It does not allow model-generated approval or silent widening/renewal. The existing `APPROVO` command remains unchanged as a legacy interactive mode until the separately reviewed autonomous Runtime path is implemented.

### 4.3 Consent receipt

[local-operator-consent-claims-v0.1.schema.json](../../schemas/local-operator-consent-claims-v0.1.schema.json) defines the proposed receipt claims. The signed receipt binds:
- issuer and authenticated operator principal;
- trusted consent broker and unique interaction ID;
- exact grant intent digest, task, manifest and host-policy digest;
- capability, workspace and scope digest;
- explicit `approve` or `deny` decision;
- displayed/confirmed challenge, short expiry, nonce and sequence.

Semantic verification MUST compare `displayedChallenge` with `confirmedChallenge`, recompute the intent and scope digests from trusted inputs, bind all duplicated values to the grant, check the authenticated operator principal and ensure the consent has not been replayed or revoked. JSON Schema validation alone cannot establish any of those facts.

The local host authority may sign an approval receipt only after the trusted consent broker reports a successful authenticated interactive action. The signature attests that the host authority recorded the broker's decision; it does not magically prove a physical human interaction if the broker itself is compromised.

### 4.4 Binding consent to the grant

Do not add one new human consent receipt to each ADR-008 v0.1 child grant. The autonomous project mandate in ADR-0010 is the consented parent authority. A future grant profile may bind each internal child grant to the parent mandate digest and task digest; that machine binding is not a new human approval. The operator consent receipt binds to the entire project mandate, including all allowed operation families and limits.

To avoid a circular hash:
1. construct and canonicalize the grant intent without a consent field;
2. compute its domain-separated `consentIntentDigest`;
3. obtain and verify the one-time signed operator-consent receipt;
4. include the digest of that receipt and the intent digest in the final grant claims;
5. sign the final grant;
6. at invocation, require both the valid grant and the matching consent receipt.

A missing, denied, expired, mismatched, replayed or unverifiable project-mandate consent receipt is a hard denial for new autonomous tasks. Existing in-scope tasks may continue only if host policy explicitly allows graceful completion during renewal; no fallback to model judgement is permitted. The legacy interactive `/code` path remains separate.

### 4.5 Operator identity caveat

The source review does not certify a current OS-authenticated operator identity API or a trusted Control Room consent flow. The concrete broker must prove how it obtains the current OS principal/session and protects against request forgery, session substitution and confused-deputy calls. Until then, `operatorPrincipalId` is only a schema field, not an authenticated identity claim.

## 5. Revocation journal and monotonic anti-rollback anchor

### 5.1 Journal event structure

[local-revocation-journal-event-v0.1.schema.json](../../schemas/local-revocation-journal-event-v0.1.schema.json) defines one event envelope:

- strictly increasing `sequence`;
- `previousEventDigest` (null only for the genesis event);
- a separately signed ADR-008 revocation JWS.

The event digest is computed from a versioned, domain-separated canonical encoding of the event envelope. It is not included in its own hash preimage. The next event links to the previous event digest. Every nested revocation JWS must verify under the trusted issuer key and its sequence/issuer/grant binding must equal the journal envelope.

A plain hash chain detects edits/reordering only when its head is anchored elsewhere. It does not by itself detect restoration of a complete old, internally consistent journal.

### 5.2 Signed checkpoint and independent anchor

[local-revocation-checkpoint-claims-v0.1.schema.json](../../schemas/local-revocation-checkpoint-claims-v0.1.schema.json) defines a signed statement of:
- issuer;
- anchor provider ID;
- latest sequence;
- exact head event digest (null only for an empty journal);
- issue time and unique checkpoint ID.

The checkpoint signature authenticates the journal head. A separate trusted monotonic anchor provider stores the latest accepted pair `(sequence, headEventDigest)`. It must be outside the journal's rollback domain and support atomic compare-and-set/monotonic advance. Storing the checkpoint next to the journal file is not an independent anchor.

The provider is intentionally not selected in this ADR. A TPM-backed counter, OS-protected hardware provider or separately administered witness may be evaluated, but none is assumed to exist or to provide the required semantics on the user's current machines. A normal JSON file, registry value or backup copied with the journal does not meet the anti-rollback requirement.

### 5.3 Durable append and anchor update order

One trusted single-writer authority process performs revocation commits:

1. Read and validate the current journal, checkpoint and external anchor.
2. Construct the next signed revocation JWS and event envelope.
3. Append the complete event using a platform storage adapter that guarantees a single-writer lock, complete record write and durable flush.
4. Flush the journal file and the required directory metadata according to the platform adapter's documented durability contract.
5. Sign a checkpoint for the new sequence/head.
6. Atomically compare-and-set the external anchor from the previously observed pair to the new pair.
7. Only after the anchor update succeeds, report the revocation commit as complete and allow the Runtime to resume protected operations.

If the process crashes after the durable journal append but before the anchor update, startup may verify the complete signed chain and advance the anchor before accepting work. If the anchor is ahead of the journal, the journal has been rolled back or lost and the Runtime must fail closed. If sequence is equal but digest differs, it is a fork/tamper condition and must fail closed.

The storage adapter must not claim single-writer safety based only on an in-process JavaScript mutex. Cross-process serialization needs an OS-backed lock or a single authority service. Atomic file replacement and flush behavior must be tested separately on Windows and POSIX; do not assume identical filesystem semantics.

### 5.6 Pure in-memory reconciliation model — implemented; no persistence provider

A first deterministic state-machine model is implemented in:
- [local-revocation-anchor-model.mjs](../../runtime/reference-worker/local-revocation-anchor-model.mjs);
- [local-revocation-anchor-model.test.mjs](../../runtime/reference-worker/local-revocation-anchor-model.test.mjs).

It verifies contiguous sequence numbers and predecessor digests, calls an injected trusted revocation-token verifier for every event, binds a separately verified checkpoint to the reconstructed journal head and provider ID, and compares the result with a trusted anchor. If the journal is ahead, it requires an atomic compare-and-set from the exact prior anchor pair before returning an allowed result. Journal rollback, equal-sequence digest mismatch, prefix mismatch, invalid event/checkpoint, missing verifier, unavailable anchor and failed compare-and-set all deny.

The test suite uses synthetic token strings and fake verifier/anchor callbacks in memory. It proves only the deterministic reconciliation state machine. It does **not** perform Ed25519 verification itself, persist events, fsync a file, acquire an OS lock, create a signed checkpoint, or contact a TPM/OS/hardware anchor. ADR-008 separately tests Ed25519 grant/revocation token verification.

### 5.4 Recovery state machine

At startup, compare the fully verified journal head `J=(seq,digest)` with external anchor `A=(seq,digest)`:

| Condition | Result |
|---|---|
| `J.seq < A.seq` | ROLLBACK — quarantine; deny all protected operations |
| `J.seq = A.seq` and digests equal | HEALTHY — normal operation may continue |
| `J.seq = A.seq` and digests differ | FORK/TAMPER — quarantine; deny |
| `J.seq > A.seq` and the chain contains the exact anchored pair at `A.seq` | RECOVERABLE AHEAD — validate all newer events, advance anchor, then permit |
| Anchor unavailable, missing, reset or unreadable | ANCHOR UNAVAILABLE — deny; never auto-initialize/reset |
| Journal/checkpoint missing or invalid | CORRUPT/INCOMPLETE — deny; require operator recovery |

An empty initial state is valid only when both the signed genesis checkpoint and the independent anchor explicitly attest sequence zero and a null head. Missing state is not equivalent to genesis.

### 5.5 Threat-model limit

The design can detect journal rollback only when the attacker cannot also roll back or replace the independent anchor and its trust root. A machine administrator who controls the OS, the key provider and the anchor provider may defeat a purely local design. The system must state this residual trust assumption rather than call the journal trustless.

If no suitable monotonic provider is available, the honest fallback is:
- retain signed revocation events and a hash-linked journal for integrity/audit;
- label it `rollback protection unavailable`;
- do not enable unattended long-lived grants;
- require a fresh trusted operator recovery/pin before protected work resumes.

Do not silently downgrade a failed anchor into a file-only journal.

## 6. Persistence interface contract

A future persistence adapter must expose trusted operations equivalent to:

- `readJournalSnapshot()`;
- `appendEventAndFlush(expectedPreviousHead, event)`;
- `readSignedCheckpoint()`;
- `writeCheckpointAndFlush(checkpoint)`;
- `readMonotonicAnchor()`;
- `advanceMonotonicAnchor(expectedPair, nextPair)`;
- `acquireSingleWriterLease()` / `releaseSingleWriterLease()`.

All mutating operations return explicit committed/not-committed outcomes. Ambiguous I/O results are treated as uncommitted until recovery verifies the durable state. Lease release occurs in `finally`. A checkpoint or anchor write is not considered successful merely because an API call returned without throwing; provider-specific durable semantics must be documented and tested.

No file path, provider handle, private key or anchor namespace may be supplied by a task or model. Host configuration chooses the provider and storage roots.

## 7. Required test vectors before implementation

Positive:
- first-time operator pin moves one descriptor from `pending-pin` to `active`;
- valid consent over one exact grant intent allows grant issuance;
- a valid revocation sequence extends the journal from genesis;
- matching journal/checkpoint/anchor permits startup;
- durable journal entries ahead of the anchor are replayed and the anchor is advanced before protected operations begin;
- rotation activates a new pinned key and retires the old key without changing historical verification.

Negative:
- copied/replaced key descriptor without a matching protected fingerprint;
- private key material present in descriptor or logs;
- inactive/revoked/expired key or mismatched issuer;
- consent denied, expired, challenge mismatch, operator mismatch, policy digest mismatch, grant intent mismatch or replayed nonce;
- journal truncation below anchored sequence;
- same sequence with a different head digest;
- missing, duplicate, reordered or invalidly signed journal events;
- stale/missing/invalid checkpoint;
- anchor provider unavailable, reset, lower sequence or compare-and-set race;
- crash at every boundary between append, flush, checkpoint and anchor advance;
- two simultaneous writers attempting the same next sequence;
- restore of a journal backup without the independent anchor;
- attempt to use the v0.1 grant without the future consent binding.

The in-memory reconciliation state-machine contract currently passes 15 synthetic tests covering genesis, healthy match, recovery-ahead, rollback, fork, prefix mismatch, reordered/broken links, invalid signature callback, wrong issuer, missing/stale/wrong-provider checkpoint, anchor outage, failed CAS, missing verifier, accessor-backed objects and size bounds. The latest combined [GitHub Actions run #19](https://github.com/LiberoNuvola/Cormia/actions/runs/41479984954) passed alongside the 21 grant tests and 6 schema-profile tests (42 total; zero failures). The separate [Windows CNG discovery run #2](https://github.com/LiberoNuvola/Cormia/actions/runs/41480382232) also passed on a hosted runner without TPM hardware. These are synthetic contract and hosted-runner results only.

The provider implementation tests must additionally include process termination and restart simulations at every durability boundary, not only in-memory cases. Real provider tests must use disposable test keys and isolated storage, never the user's production authority key.

## 8. Implementation order

1. Review and accept the key/consent/anchor threat model and residual administrator assumption.
2. Use the read-only Windows CNG discovery probe to identify the actual local provider and TPM state; do not create a key or modify local state during this discovery.
3. Decide whether the provider can use the current Ed25519 profile or needs a separately versioned ES256 profile; do not infer this from the GitHub-hosted runner.
4. Implement a fake provider and deterministic state-machine tests first.
5. Implement one platform provider behind the opaque interface; validate private-key non-exportability and anchor semantics independently.
6. Implement the signed one-time project-mandate consent broker and bind automatically derived child grants to the mandate; keep current `/code` + `APPROVO` as a legacy compatibility path.
7. Implement journal append, flush, checkpoint and anchor CAS with crash/restart tests.
8. Integrate with the read-only local adapter only after key trust, consent and anchor all pass.
9. Keep create/replace/test disabled until task-specific workspace isolation and test selection are established.

## 9. Non-goals and non-regression

- No real key creation, import, rotation, revocation or OS keystore modification in this ADR.
- No write to the user's PC, Agent, Control Room, local Task Store or Evolution Manager.
- No GitHub secret, repository private key or hosted signer.
- No change to `SPEC.md`, Task Manifest schema, Agent `APPROVO`, IMMORTAL/PRE-RICH on-chain logic or task-store format.
- No production or unattended grants.
- No claim that a file hash chain is rollback-resistant.
- No claim that an operator consent schema is proof of a human action until the trusted broker and OS principal binding exist.
