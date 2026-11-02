# Governance — draft

**Status:** design policy; no voting token, quorum, council size, or timelock values approved.

## 1. Scope

Governance may propose and enact future versions of protocol rules, assurance profiles, supported adapters, schemas, and bounded parameters. It MUST NOT rewrite the terms, budget, or verdict rules of already funded tasks.

## 2. Process requirements

Every normative change proposal MUST include:

- motivation and affected specification sections;
- compatibility and migration plan;
- threat-model delta;
- economic impact and simulations;
- positive and negative test vectors;
- implementation and audit evidence;
- activation epoch/slot or other explicit activation rule;
- rollback, pause, and exit behavior.

## 3. Permissionless participation

Submitting proposals, reviewing them, and participating in voting SHOULD be open under public anti-spam rules. Identity registration must not become a discretionary allowlist. Any stake- or reputation-based weighting must document Sybil, concentration, bribery and voter-apathy risks.

## 4. Emergency powers

An emergency mechanism, if approved, MUST be narrowly scoped, time-limited, observable, and unable to transfer escrow or rewrite task outcomes. A pause SHOULD stop new assignments or new task creation rather than confiscate existing funds. Emergency authority must be replaceable and subject to public review.

## 5. Open decisions

Voting mechanism, representation model, quorum, timelock, emergency guardian composition, upgrade mechanism, parameter bounds, and treasury policy remain unresolved. No native governance token is approved by this draft.
