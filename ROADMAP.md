# Roadmap and release gates

## Gate 0 — Repository and architecture baseline

- Dedicated repository separate from `Immortal-Protocol`.
- Prior-art register and licensing decision.
- Normative principles, actors, trust model and layer boundaries.

## Gate 0B — Preserve and map the existing nucleus

- Map the IMMORTAL Local Agent v0.8.0, Resource Manager, Evolution Manager, Coding Workspace and persistent task/audit lineage.
- Preserve the Flux Point DoD pilot and its exact upstream version/commit record.
- Preserve JEV registry schemas, validators, result vocabulary and limitations.
- Preserve the Mitsuro four-tool read-only MCP bridge and its closed-schema/path-allowlist tests.
- Create compatibility adapters; do not replace these components before tests and ADRs.
- Add the local-only / reciprocal mesh / sponsored-pool user model.

## Gate 0C — Reciprocal compute model

- Specify local-only mode, opt-in compute donation, shared inference access and sponsored pool.
- Define compute contribution receipts and non-transferable CRC semantics.
- Design NUWU measurement, model identity challenge, randomized audit and selective replication.
- Define off-chain receipt reconstruction and Cardano epoch anchor/dispute mechanism.
- Test power/thermal preemption, lease cancellation, user priority and prompt privacy disclosures.
- No native customer-facing token, subscription, API-token billing or per-prompt on-chain transaction in the initial consumer path.

## Gate 1 — Task contract and deterministic state machine

- canonical Task Manifest and signature/domain-separation rules;
- task state machine and transition table;
- capability vocabulary and delegation rules;
- schema validation and transition test vectors.

## Gate 2 — Verification, dispute and economic simulations

- assurance profiles and explicit residual assumptions;
- verifier selection and independence model;
- escrow, worker/verifier/challenge bonds, reward, refund and timeout policy;
- collusion, Sybil, griefing and economic attack simulations.

## Gate 3 — Cardano reference adapter

- per-task eUTXO layout and state transitions;
- exact asset/value validation;
- concurrency and stale-input recovery;
- transaction size, execution budget, fee and collateral tests;
- validator audit before real funds.

## Gate 4 — Local reference worker

- protocol client and chain adapter;
- persistent task engine, checkpoint/resume;
- deterministic capability engine;
- resource manager and sandbox;
- evidence package generation.

## Gate 4A — Team Collaboration and Internal Delivery

- Build the Cormia Team Room: persistent agent-to-agent threads, project context, task discussion and structured decision records.
- Build the Project Workbench: local project repository/history, isolated task worktrees, contribution patches, shared artifact index and controlled integration workspace.
- Support independent contributions and pair/team editing under explicit file/module claims, edit leases or conflict-aware operations; never unrestricted shared writes.
- Build the Integration & Verification Bench: compose contributions, compile/build/package, run named tests, conduct peer review and create an evidence-backed candidate.
- Add project delivery profiles: local action, local artifact, local repository, optional GitHub publication or other adapter.
- Request owner authorization by default before publishing a verified candidate to GitHub; keep protected merge, release and production deploy as separate actions.
- Prove a solo local-maintenance task can finish without Team Room, repository, GitHub or economic adapters.
- Prove a two-agent team flow with discussion, collaborative edits, integration, build/test, repair and local candidate delivery before adding a second PC.

## Gate 5 — Independent verifier network

- permissionless verifier admission under public profiles;
- replication, verdict commitments and challenges;
- proof adapters where justified;
- liveness and collusion testing.

## Gate 6 — Testnet public pilot

- low-value tasks only;
- third-party workers and verifiers;
- public telemetry and failure reports;
- bug bounty and independent audit.

## Gate 7 — Mainnet readiness

- economic model validated;
- governance and emergency exits tested;
- independent security reviews;
- published operational risk limits and upgrade process.

No gate is passed solely by code compilation, model self-report, or a single happy-path test.


## Gate 8 — Reciprocal inference pilot

- local-only user experience works without wallet, account, network or model API key;
- first node can donate only opt-in spare capacity under Resource Manager policy;
- whole-model serving on one peer is measured before split-model inference;
- CRC balance can be reconstructed from signed receipts and challenged;
- no silent paid/cloud fallback;
- model identity, prompt privacy disclosure and node revocation are tested;
- published benchmark compares local inference, peer inference and contribution/consumption fairness.
- Keep the existing CRC usage-right model distinct from a project-specific compute reward pool.
- Specify an optional funded reward bucket for accepted useful compute only after contribution receipts, NUWU benchmarking, allocation rules, sponsor custody, dispute handling and anti-Sybil controls are evidenced.
- Do not pay for advertised capacity or raw uptime; do not promise a share of an unfunded bucket.

Split-model inference, TEE, ZKML and monetary provider payouts are later optional profiles, not prerequisites for the first pilot. A project-specific compute reward pool remains a separate optional economic profile and is not a prerequisite for local or team collaboration.
