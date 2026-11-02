# Cardano adapter

No production validator code is included yet. This adapter must be derived from `SPEC.md` and its test vectors.

Initial design constraints:

- Keep validator logic deterministic and bounded.
- Commit large manifests and evidence off-chain by digest.
- Avoid a single global state UTxO for all tasks.
- Define one task's escrow/state transition independently where possible.
- Test concurrent spends, stale inputs, transaction size, execution budgets, fees, collateral and timeout/refund behavior.
- Do not import PRE-RICH constants or economic assumptions without an explicit adapter ADR.
