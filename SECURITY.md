# Security policy and threat model

**Status:** initial threat inventory; not a security audit.

## Reporting

Do not publish exploitable vulnerability details in public issues. Until a dedicated security contact is configured, repository maintainers should establish a private reporting channel before announcing a production deployment. No production funds or mainnet worker contracts should be enabled before that channel and a response process exist.

## Security invariants

1. No AI model output can grant itself capabilities or override protocol policy.
2. No worker can access resources beyond the task's capability envelope and local host policy.
3. No escrow payout occurs without a valid state transition and required evidence/verdict commitments.
4. No funded task's terms change retroactively.
5. No ambiguous verification result is silently treated as successful.
6. Every task reaches a defined terminal or recovery outcome; funds must not remain locked indefinitely by design.
7. Evidence is content-bound to task, manifest, delivery, toolchain and verdict.

## Threat classes

- Sybil identities and verifier collusion
- Requester/worker/verifier collusion
- malicious or ambiguous manifests and prompt injection
- capability confusion, confused deputy and privilege escalation
- sandbox escape, host filesystem/network exfiltration
- secret leakage and malicious tool output
- compromised container images, dependencies and model artifacts
- replay, duplicate settlement, stale datum and concurrent UTxO spends
- task spam, resource exhaustion and denial of service
- storage unavailability, data withholding and censorship
- model nondeterminism and GPU result variance
- forged evidence, invalid signatures and equivocation
- economic griefing, under-collateralization and challenge spam
- governance capture, malicious upgrades and emergency-key compromise

## Runtime minimums

- deny-by-default filesystem and network access;
- per-task ephemeral credentials and capability attenuation;
- immutable or digest-pinned execution images;
- resource/time/process limits;
- isolated workspaces and no host-wide shell access;
- structured audit events for actual tool invocations;
- input and tool-output validation;
- persistent task state independent of LLM context;
- safe cancellation and lease release;
- secret redaction from logs and evidence.

## On-chain minimums

- domain-separated identifiers and signatures;
- manifest digest and version pinning;
- exact asset and value checks;
- role and state-transition validation;
- idempotent settlement and replay protection;
- bounded datum/redeemer size and script execution cost;
- timeout/refund exits;
- race and stale-input tests;
- independent validator audit before real funds.

## Assurance caveats

A hash proves integrity, not correctness. Re-execution proves agreement only under independence assumptions. A zkVM receipt proves the committed program's execution statement, not that the program implements the right task. A TEE introduces hardware/vendor assumptions. Reputation and stake do not establish truth.


## Reciprocal inference privacy and contribution

- Local-only inference (P0) is the default for sensitive prompts and must not perform silent remote fallback.
- A shared peer (P1) receives prompt plaintext required for inference. TLS protects transport, not the peer operator from inspecting its own machine. The UI must obtain explicit opt-in before routing.
- Split inference (P3) is not automatically confidential: activations, model shards, timing and colluding peers can leak information.
- TEE (P2) is optional and must identify vendor, firmware, attestation and revocation assumptions.
- Contributor nodes must serve only approved model/runtime artifacts. Inference-only donation must not execute requester-supplied shell, plugins or arbitrary code on the host.
- A compute receipt proves signed statements and commitments, not correct GPU execution. Credit issuance is a separate policy transition requiring the applicable verifier/audit profile.
- A bare hash of a predictable prompt can be dictionary-attacked. Public evidence must use blinded commitments and keep prompt preimages off-chain unless explicitly authorized.
