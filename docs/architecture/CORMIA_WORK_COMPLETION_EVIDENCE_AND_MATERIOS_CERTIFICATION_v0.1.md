# Cormia Work Completion Evidence, Local Resource Metering and Materios Certification Adapter v0.1

- **Date:** 2026-11-03
- **Status:** architecture proposal / non-normative / not implemented end-to-end
- **Scope:** verifiable completion evidence for Cormia agent tasks and contributed compute
- **Core invariant:** Cormia controls execution locally; Materios certifies only evidence covered by an implemented verification profile.
- **Related:** [Cormia Core Contracts](./CORMIA_CORE_CONTRACTS_v0.1.md), [Core Interface Catalog](./CORMIA_CORE_INTERFACE_CATALOG_v0.1.md), [Coordination Plane](./CORMIA_COORDINATION_PLANE_AND_MULTI_NODE_TOPOLOGY_v0.1.md), [Compute Reciprocity](../economics/COMPUTE_RECIPROCITY.md)

## 1. Architectural decision

Cormia should treat **work completion as an evidence-bearing claim**, not as a status string or an agent self-report.

The target responsibility split is:

1. **Cormia Core / Coordination Plane** defines the task, assignment, acceptance criteria, authority and project context.
2. **Cormia Node / Local Resource Broker** enforces the host owner's local limits, runs the task inside a bounded environment, measures local resource usage and creates a signed evidence receipt.
3. **Task-specific verifier(s)** independently check the claims meaningful for that workload: build/test result, deterministic recomputation, output constraints, replication, attestation or a supported execution proof.
4. **Materios Adapter** submits a canonical receipt and its evidence references to Materios. Materios records commitments and certifies only the claims supported by its active on-chain/off-chain verifier profile.
5. **Cormia CRC Accounting** may mint usage credits only after the contribution receipt reaches the project/task's declared acceptance and certification threshold.

This is an optional integration. Local Cormia tasks must continue to work when Materios, Cardano, Midnight, a wallet or any network connection is absent.

## 2. Do not collapse different claims into one “certified” flag

A certificate must say **what** was checked. These evidence dimensions are related but not interchangeable:

| Evidence dimension | Claim that may be supported | What it does not prove by itself |
|---|---|---|
| Receipt integrity | The canonical receipt/artifact matches the committed digest or Merkle root | That the described work actually happened |
| Availability | The committed evidence blob/chunks were retrievable and match the committed root at verification time | That the task was correct or useful |
| Assignment/provenance binding | The receipt refers to the intended project, task, attempt, worker, mandate, lease and workload profile | That the worker's statements are truthful |
| Resource metering | A named meter observed specified CPU/GPU/RAM/VRAM/time/energy counters | That a self-reported host counter cannot be manipulated |
| Execution provenance | A supported hardware/runtime attestation binds evidence to a measured environment | That the program's output satisfies the task |
| Outcome acceptance | A declared verifier accepted the output under a named, versioned predicate | That an untrusted verifier was independent or correct |
| Execution proof | A proof system establishes execution of a supported computation over committed public inputs | That arbitrary workloads or subjective quality are covered |
| Chain finality/ordering | A receipt commitment/attestation was included in the relevant finalized chain history | That the committed off-chain claim is semantically true |

A UI may show a concise status, but the underlying certificate and receipt must preserve the individual evidence dimensions, verification profiles, versions, issuers and residual assumptions. Do not define one universal scalar trust score that hides missing dimensions.

## 3. Cormia Node: local execution and metering boundary

Cormia Node is an installed desktop/host service. Its Local Resource Broker, not a remote agent or project coordinator, owns admission control on that machine.

It is responsible for:

- sampling host-approved resource counters and reporting their source, measurement interval, units, precision and limitations;
- enforcing owner-selected CPU/GPU/RAM/VRAM/storage/network/time/power/thermal limits;
- binding each execution to a project, task, attempt, capability profile and short-lived Resource Lease;
- running approved workloads in a least-privilege isolated environment;
- keeping project jobs away from personal files, credentials, browser profiles, wallets, SSH keys and unrestricted host shells;
- preempting, pausing or terminating work when local policy or the owner requires it;
- signing a canonical receipt and retaining enough local evidence for later audit/challenge;
- refusing new execution after local revocation, lease expiry or policy failure.

The remote project receives task-scoped inputs, outputs and explicitly released artifacts only. Resource donation does not grant filesystem, desktop, shell, credential or general network access. The user can revoke locally without consent from the project.

**Metering trust limit:** a signature authenticates the node key that produced a measurement; it does not prove the measurement is honest. Ordinary OS/driver counters on a contributor-controlled PC are operator-observable evidence, not a cryptographic proof against a malicious device owner. Stronger claims require a declared independent verification method, a supported hardware-attestation profile, selective replication/recomputation or a proof system. A TEE report also does not automatically prove GPU work or output correctness.

The current resource-provider module in runtime/core is only a process-local, callback-scoped adapter. It does not sample live hardware telemetry, persist leases, enforce OS quotas, isolate hostile workloads or terminate processes on revocation. This section specifies a target boundary, not an implemented desktop service.

## 4. Work Completion Receipt — proposed logical record

A task attempt that may earn CRC or receive a Materios certification should produce a canonical, versioned receipt. This is a logical contract only; it is **not** a new approved JSON Schema or production API.

Minimum fields to design and bind:

- receipt schema/version and verification-profile identifiers;
- project ID, task ID, attempt ID, assignment/manifest digest and task class;
- worker/node identity reference and agent/runtime/model artifact digests where applicable;
- mandate/capability-profile reference and exact Resource Lease reference;
- workload profile, declared input commitments and privacy classification;
- start/end or bounded service interval, monotonic sequence/nonce and replay-protection data;
- meter identity/version, measurement source, units, CPU/GPU device/profile, RAM/VRAM, wall time and any supported energy/throughput counters;
- output/artifact digest and content-addressed evidence references;
- acceptance predicate identifier/version, verifier identity/profile, result and reason codes;
- requester/consumer acknowledgement where relevant;
- attestation/proof references, challenge state, signer set and certification state;
- explicit limitations and unresolved/disputed flags.

Private prompts, datasets, source files, raw outputs, secrets and full telemetry stay off-chain. Public commitments must be appropriately blinded where low-entropy inputs could be guessed. Evidence artifacts remain access-controlled off-chain; the chain stores bounded commitments and attestation metadata.

The receipt must bind the same task, attempt, lease, workload and output across worker, requester and verifier records. A receipt for one task or attempt cannot be replayed as evidence for another.

## 5. Verification profiles — multidimensional, workload-specific

Profiles define a collection of claims and required evidence. They are not an automatic ranking and must disclose residual trust assumptions.

### Profile R0 — Declared / unverified

The worker or agent submits a completion declaration and receipt. This is useful for progress tracking, but is not a certification and is not sufficient for CRC minting or project reward allocation.

### Profile R1 — Integrity and availability

The receipt body/artifacts are canonicalized and committed; a verifier retrieves the relevant data, checks chunk hashes and recomputes the committed Merkle root. A committee can attest the availability certificate under its configured threshold.

This establishes that the evidence corresponds to the commitment and was retrievable under the stated checks. **It does not establish that the task was executed or that its result is correct.**

### Profile R2 — Task outcome verified

A task-specific verifier evaluates a versioned acceptance predicate. Depending on the workload, this may include:
- reproducible build output and source/toolchain binding;
- deterministic test suite and test-result artifact;
- deterministic transformation with independent recomputation;
- schema/invariant validation;
- independently replicated execution and a declared comparison rule;
- requester acceptance combined with objective checks.

A test report hash is not enough: the verifier must establish that the declared tests/predicate were actually run against the bound source/input/output and that the result meets the task's acceptance rule. The profile must say whether the verifier is independent, who operates it and what collusion assumptions remain.

### Profile R3 — Execution environment attested

A supported hardware-rooted attestation binds an execution environment or key to a receipt challenge and workload. The verifier checks the attestation chain, freshness/challenge binding, policy and workload linkage.

This strengthens execution provenance. It does not by itself prove semantic correctness, arbitrary GPU utilization, absence of all side channels or task usefulness. Platform coverage and exact claims must be stated.

### Profile R4 — Provable execution

A supported VM/proof system verifies a proof of a precisely specified computation over committed public inputs and outputs. The proof statement, circuit/VM, version, verifier, public inputs and soundness assumptions are part of the receipt.

This is available only for supported workloads. It is not a general proof that an arbitrary AI agent behaved correctly or that a subjective deliverable is useful.

### Profile composition

A profile may require R1+R2, R1+R3, R1+R2+R3, or R1+R4, for example. The selected combination must be declared before the task begins. No lower profile may silently stand in for a missing higher-profile condition.

## 6. Materios: current capability versus target integration

Materios is a natural certification/receipt layer for this design, but the present code must be described precisely. Its current README describes Materios as an Alpha/MVP prototype purpose-built for gaming micro-transaction settlement and AI audit receipts. This is a promising foundation for agent-work evidence, but it is not evidence that general-purpose agent task-completion certification is already a completed capability.

### Existing capabilities observed in the repositories

The current Materios architecture describes:
- a Substrate Partner Chain that stores receipt commitments, content hashes, Merkle roots and attestation records;
- off-chain receipt bodies and evidence artifacts, with only commitments/attestation metadata on-chain;
- a cert-daemon network that fetches and verifies receipt data before submitting availability attestations;
- threshold-based receipt certification and optional Cardano checkpoint anchoring;
- a Midnight coprocessor intended to produce ZK attestations about batched receipt integrity.

The current cert daemon requires ROOT_VERIFIED: fetched chunks must match their declared hashes and the recomputed Merkle root must match the on-chain base_root_sha256. This is a meaningful integrity/availability check, not a semantic task-completion verifier. There is also a specific self-rooted shortcut for compute_metering_v2: when the manifest declares chunks=[] and the on-chain base_root_sha256 equals content_hash, the verifier returns ROOT_VERIFIED without fetching chunks. Its source comments explicitly state that this path relies on the gateway as manifest authority. It therefore validates the self-rooted receipt under that trust model; it is not an independent proof that the declared GPU/CPU work took place.

The current pallet-tee-attestation types include AMD SEV-SNP, Intel TDX, ARM TrustZone, reproducible-build and ZK-VM execution evidence types. In the source examined for this proposal, only the ARM TrustZone verifier is implemented; the other verifier branches return NotImplemented. The pallet's source also records that challenge binding is a prerequisite to enabling the evidence submission path, and its Disabled storage defaults to true. Therefore the listed types must not be represented as fully operational certifications.

Relevant implementation references:
- [Materios README](https://github.com/Flux-Point-Studios/materios/blob/main/README.md)
- [Materios architecture](https://github.com/Flux-Point-Studios/materios/blob/main/docs/ARCHITECTURE.md)
- [Orinq Receipts pallet](https://github.com/Flux-Point-Studios/materios/blob/main/partnerchain/pallets/orinq-receipts/src/lib.rs)
- [TEE attestation pallet](https://github.com/Flux-Point-Studios/materios/blob/main/partnerchain/pallets/tee-attestation/src/lib.rs)
- [TEE verifier implementations](https://github.com/Flux-Point-Studios/materios/blob/main/partnerchain/pallets/tee-attestation/src/verifier.rs)
- [Evidence type definitions](https://github.com/Flux-Point-Studios/materios/blob/main/partnerchain/pallets/tee-attestation/src/types.rs)
- [Operator cert daemon](https://github.com/Flux-Point-Studios/materios-operator-kit/blob/main/daemon/cert_daemon.py)
- [Blob verifier](https://github.com/Flux-Point-Studios/materios-operator-kit/blob/main/daemon/blob_verifier.py)

### Target Cormia ↔ Materios adapter

The proposed adapter should:
1. accept only a canonical Work Completion Receipt and evidence manifest;
2. validate schema/profile versions and the task/attempt/lease bindings before submission;
3. upload private evidence only to the selected access-controlled storage path, never to the public chain;
4. submit receipt commitments through Materios' receipt interface;
5. request only evidence types/verifiers whose implementation status is explicitly qualified;
6. read back the receipt, verified evidence, threshold/attestation state and chain inclusion/finality evidence;
7. return a typed certificate to Cormia containing the verified claims, verifier profile, receipt IDs, commitment hashes, signer/threshold details, inclusion/finality references and unresolved limitations;
8. fail closed if a requested evidence type is unsupported, the challenge binding is missing, the threshold is not reached, or the evidence does not match the receipt.

Materios must not make the local resource decision, gain host access, or decide project mandate scope. It certifies claims about committed evidence according to its verifier contracts; Cormia remains responsible for task intent, local authorization, acceptance policy and CRC accounting.

## 7. CRC accounting and certification boundary

CRC remains a Cormia usage-right accounting unit under the current proposal. It is not MATRA or MOTRA, not a Materios network fee, not automatically an on-chain token and not a financial reward.

Candidate mint condition:

- a task-bound contribution receipt exists;
- the required evidence dimensions for that workload/profile have passed;
- the result meets the predeclared acceptance predicate;
- the contribution is accepted and not currently disputed/revoked/duplicated;
- the CRC rule version and normalized-work measurement are known.

The local meter's raw GPU-hours alone are not enough. Profile R1 alone is not enough because it verifies the receipt data, not the actual work. A task class may define a suitable R2/R3/R4 combination; this requires a published policy and verification evidence.

Burn/consumption of CRC for shared inference remains a separate accounting event with its own task/service receipt. Do not conflate:
- CRC mint for an accepted contribution;
- CRC burn for shared compute consumption;
- Materios MATRA/MOTRA fee accounting;
- an optional funded Project Compute Reward Pool payout.

No CRC conversion rate, mint formula, burn rate, reward distribution, token deployment or Materios economic change is selected here. No IMMORTAL/PRE-RICH rule is changed.

## 8. Threat model and fail-closed rules

- A project or remote agent never receives arbitrary host shell, desktop, filesystem, credentials, wallet or unrestricted network access through a resource lease.
- The local owner can revoke/suspend a lease independently of Materios availability or committee state.
- A worker signature alone does not prove truthful measurement; a requester signature alone does not prove correct execution; a committee signature over a receipt hash alone does not prove semantic correctness.
- A content/Merkle proof protects integrity of the committed bytes, not the truth of their contents.
- A TEE quote proves only the claims covered by its platform/measurement/challenge verifier; it is not an automatic GPU meter or correctness oracle.
- A ZK proof proves only its formally specified statement and public-input bindings.
- Independent replication must account for correlated implementations, shared operators, Sybil nodes and non-deterministic outputs.
- Missing, stale, unbound, duplicated, unsupported or challenged evidence blocks certification and CRC mint for the affected profile.
- Evidence correction/revocation must preserve the original receipt and append an attributable correction/revocation record; history must not be silently overwritten.
- Materios/Cardano/Midnight outages may delay certification/anchoring, but must not grant the coordinator extra local authority or cause local resource limits to be bypassed.

## 9. Implementation status and next sequence

**Specified here:** target responsibility split, receipt contents, evidence dimensions, workload-specific assurance profiles, Materios adapter behavior, CRC mint boundary and explicit residual assumptions.

**Not implemented by this proposal:** Cormia Node desktop service, live CPU/GPU metering, OS-enforced isolation/quotas, persistent resource leases, Work Completion Receipt schema, independent task-verifier service, Materios adapter, Materios work-completion verifier types, CRC mint/burn ledger or a live end-to-end certification path.

Recommended sequence:

1. Freeze a versioned Cormia Work Completion Receipt and evidence-manifest contract without embedding Materios fields in mandatory Core records.
2. Implement the local meter/receipt producer behind Cormia Node; tests must prove scope, revocation, lease binding and no access outside the isolated task workspace.
3. Add deterministic task-verifier profiles (build/test/schema/transform) and negative/adversarial vectors before adding hardware-specific trust.
4. Define the Materios adapter mapping to existing Orinq receipt/availability contracts; test readback and fail-closed behavior against a Materios test environment.
5. Only after the protocol team implements and qualifies the required execution-evidence verifiers/challenge binding, enable R3/R4 profiles.
6. Implement CRC accounting against accepted receipts, with replay protection and independently reconstructible balances.
7. Test the complete lifecycle with one local worker, two independent verifiers where appropriate, a challenged receipt, an unsupported evidence type and a Materios outage.

No Materios code, runtime, governance, token economics or deployment is changed by this Cormia proposal. Materios is an optional evidence/certification adapter; local Core remains usable without it.
