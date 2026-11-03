# Cormia Core Interface Catalog v0.1

- **Date:** 2026-11-03
- **Status:** versioned contract/schema proposal; non-normative; not integrated into a production Core Runtime
- **Branch:** `work/exp-generalization-crosswalk`
- **Canonical architecture:** [Cormia Core Contracts v0.1](./CORMIA_CORE_CONTRACTS_v0.1.md)
- **Authority source:** [ADR-0010](../adr/0010-autonomous-project-delegation-and-runtime-authority.md)

## 1. Scope

This catalog turns the four proposed Core contracts into strict, versioned JSON record schemas. The schemas define interoperable data shapes and validation constraints; they do not implement a Runtime, reducer, database, durable journal, resource scheduler, mandate verifier or support registry.

All schemas use JSON Schema Draft 2020-12, carry the record version `0.1.0`, and reject undeclared properties. Unknown fields or versions must not be silently interpreted as a compatible extension.

## 2. Canonical record schemas

| Core surface | Schema | Record type | Purpose |
| --- | --- | --- | --- |
| Project identity and mandate binding | `schemas/core/project-descriptor-v0.1.schema.json` | `cormia.core.project-descriptor` | Project reference, leadership mode, steward/accountability references and immutable mandate-claims reference. |
| Project lifecycle projection | `schemas/core/project-lifecycle-record-v0.1.schema.json` | `cormia.core.project-lifecycle-record` | Current project state, monotonic projection revision and journal cursor. |
| Project lifecycle journal | `schemas/core/project-lifecycle-event-v0.1.schema.json` | `cormia.core.project-lifecycle-event` | Append-event shape with sequence, actor, cause/reason, evidence references and digest-chain fields. |
| Resource Provider | `schemas/core/resource-offer-v0.1.schema.json` | `cormia.core.resource-offer` | Typed resource capacity, availability, privacy profile, provider acceptance and validation evidence. |
| Resource Provider | `schemas/core/resource-lease-v0.1.schema.json` | `cormia.core.resource-lease` | Task-bound reservation, capability profile, reserved capacity, lease state and bounded lifetime. |
| Community Support — financial | `schemas/core/financial-support-contribution-v0.1.schema.json` | `cormia.core.financial-support-contribution` | Provider-referenced money contribution for a project, workstream, milestone or resource pool. |
| Community Support — in-kind | `schemas/core/in-kind-support-contribution-v0.1.schema.json` | `cormia.core.in-kind-support-contribution` | Compute, infrastructure, data, expertise, review or volunteer contribution without a monetary equivalent. |

The schema files are the canonical wire-record shapes for this proposal. The existing Python classes in `verification/core_contracts/core_contract_model.py` remain abstract predicate fixtures; they are not generated from these schemas and are not Runtime domain classes.

## 3. Mandate integration — reference, not duplication

`ProjectDescriptor.mandateRef` contains only:
- the existing mandate identifier;
- the claims schema identifier;
- the digest of the claims record.

It deliberately does not embed the mandate claims, operation allowlist, consent, authority state, private key, signature material, revocation state or bearer credential.

The existing `schemas/local-autonomous-project-mandate-claims-v0.1.schema.json`, its consent counterpart and ADR-0010 remain the current proposal for the local coding-workspace mandate. The v0.1 mandate is not a universal project mandate. The Runtime must resolve the reference through the existing trusted mandate/consent/revocation path, verify its integrity and derive child authority as:

```text
effectiveChildAuthority =
  verifiedMandateCapabilities
  ∩ taskRequestedCapabilities
  ∩ hostPolicy
```

A schema-valid `ProjectDescriptor` is not proof that its steward/accountability references resolve to an authorized principal, nor that its referenced mandate is authentic, active or in scope. Trusted identity and mandate resolution remain host responsibilities. No second signer, approval prompt, grant token or revocation system is introduced here.

## 4. Project lifecycle and journal boundary

The project lifecycle projection uses only:
`draft | configured | active | paused | blocked | completed | archived`.

The authority lifecycle remains separate:
`active | suspended | expired | revoked | trust_failed`.

Task state remains the responsibility of the task subsystem. These vocabularies are not interchangeable: the project lifecycle schema intentionally rejects `taskState` and `authorityState`.

The lifecycle record points to a journal stream and last event. Lifecycle events carry a sequence and digest-chain fields. The schema does not define the canonical serialization/digest algorithm, append-only storage guarantees, compare-and-set behavior, crash recovery, event replay or anti-rollback anchor. Those remain requirements for the journal implementation. This journal is not a relabeling of the existing Local Agent Task Store v1.

## 5. Resource Provider boundary

A Resource Offer is descriptive capacity, not task authority and not a lease. An offer can be `available` only when its owner acceptance and validation evidence are present. A Resource Lease is task-bound, scoped to a capability profile and time-bounded.

Resource capacity uses explicit quantity/unit fields. It is not a monetary amount, economic exposure, CRC quota or solvency statement. The project/task mandate and host policy still bound which operations may use a provider's resources. A remote lease additionally requires explicit opt-in, privacy acceptance and a provider path; no remote fallback is implicit in these schemas.

The schemas do not implement OS-level quotas, local Resource Manager enforcement, durable reservations, provider discovery, remote worker isolation, preemption or revocation delivery. The existing local Resource Manager adapter remains a process-local compatibility wrapper around existing snapshot/acquire/release behavior.

## 6. Community Support boundary

Financial and in-kind records are separate schemas and separate ledgers.

- Financial records identify a provider, provider-side contribution reference, amount in minor units, currency and provider status. A `settled` record requires provider confirmation. A pledge or pending contribution is not settled available funds. The beneficiary kind is limited to the project, a named custodian or a resource pool; an agent personal wallet is not a beneficiary type. A `named_custodian` reference is not self-authenticating: a trusted identity/policy resolver must confirm that it denotes a human, organization or accountable custodian and not an agent acting as its own beneficiary. JSON Schema cannot prove the identity behind an opaque reference.
- In-kind records describe the contribution kind, target, declared scope, status and acceptance. Compute/infrastructure contributions reference a Resource Offer. The schema has no currency or money-equivalent field.

Neither contribution type grants capabilities, private-data access, governance authority, mandate widening or task priority by itself. A supporter can make an offer; the provider/host still determines whether a resource is valid and available. No implicit exchange rate converts compute, expertise or volunteer time into money.

## 7. Local-first and optional-integration invariant

The mandatory project descriptor, lifecycle projection/event and resource offer/lease schemas contain no payment, Cardano, wallet, token, CRC, AEP settlement or IMMORTAL fields. They reject undeclared additions.

Financial contribution records exist only as an optional Community Support surface. They are not dependencies of project creation, local planning, local inference, local execution, task journals or local resource management. In-kind support does not require a financial account or settlement adapter.

## 8. Verification

`verification/core_contracts/test_core_json_schemas.py` validates the records against Draft 2020-12, including:
- valid descriptor modes and strict mandate-reference boundaries;
- orthogonal project lifecycle and journal event structure;
- resource availability, owner acceptance, validation evidence and lease activation;
- provider-confirmed settlement and non-agent financial beneficiaries;
- in-kind resource-offer references and absence of money-equivalent fields;
- rejection of undeclared payment, wallet, Cardano, token and task/authority-state fields from mandatory Core records.

The workflow `.github/workflows/exp-boundary-reference-model.yml` installs the pinned JSON Schema test dependency and runs the schema suite alongside the EXP and abstract Core predicate suites.

## 9. Implementation status and next boundary

**Implemented in this proposal:** seven JSON Schema documents, schema conformance tests and CI wiring.

**Not implemented:** schema-generated runtime types, serialization adapters, project registry, durable project journal, lifecycle reducer, mandate-reference resolver, local Resource Provider binding, lease persistence/recovery, Community Support registry, financial custody, remote compute mesh or integrated autonomous project loop.

The next implementation slice should consume these schemas in a trusted local Core adapter, bind the existing mandate evaluator without changing its approval semantics, and add a durable project journal plus a local Resource Provider wrapper. A complete end-to-end autonomous task must still prove restart/reconciliation and zero per-operation approval prompts under a one-time mandate. Remote resources and financial adapters remain later optional integrations.

No existing mandate claims schema, AEP Task Manifest, ADR, runtime execution path, wallet, chain or economic policy is modified by this catalog.
