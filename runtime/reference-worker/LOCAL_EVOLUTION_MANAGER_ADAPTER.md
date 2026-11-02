# Local Evolution Manager adapter

**Status:** proposed trusted-host wrapper; not connected to the existing Agent.

The existing SelfImprovementManager has a deliberately narrow candidate lifecycle:
- fixed source snapshot and baseline/candidate trees;
- candidate-only writes and SHA-preconditioned patches;
- append-only hash-linked journal checked on read;
- host syntax verification and isolated read-only Docker testing;
- evidence-gated evaluation;
- human review packet;
- automatic promotion always disabled.

This Cormia adapter mirrors the boundary and binds every candidate operation to a run ID selected by trusted host code.

## Fixed source profile

The start helper accepts exactly four source-map keys:
- `resource-manager.mjs`
- `evolution-manager.mjs`
- `resource-manager.test.mjs`
- `evolution-manager.test.mjs`

The two baseline test entries must both map to the existing `self-improvement.test.mjs`. Source paths must be the corresponding files under `<workspaceRoot>/self-improvement`. The LLM cannot choose source paths.

## Candidate operation contract

- Reads are limited to the two implementation modules, the two immutable baseline test copies, and `candidate-*.test.mjs` files; at most 120 lines per call.
- New candidate files must match `candidate-<name>.test.mjs`, remain ≤64 KiB, and pass the same high-confidence credential-pattern guard used by the current Agent.
- Patches may target only `resource-manager.mjs`, `evolution-manager.mjs`, or a candidate-specific test. Baseline tests are immutable. Patches require a full SHA-256 and exact anchor occurrence count.
- Every method checks the requested run ID against the adapter's bound run ID.
- Run listing returns summaries only, not candidate contents or journals.

## Trusted-host evaluation

`evaluateFromTrustedHost` is a host-only method and must never be exposed as a model tool. It accepts only:
- successful `workspace_verify` evidence for both implementation modules with full SHA-256 values;
- successful `workspace_test` evidence with exit code 0, no timeout, fixed image `node:22-alpine`, network `none`, and a candidate-only read-only mount.

Only then does it call the existing SelfImprovementManager evaluation. These records are host-generated measurements, not model claims. The adapter does not execute candidate code itself.

## Promotion boundary

`reviewPacket` returns the existing human review packet. `promote()` always rejects. Candidate eligibility is not production approval, code safety proof or authority to change the running Agent.



## Verification evidence

- **Adapter unit contracts:** 13 tests passed in the isolated review environment.
- **Real-manager smoke test:** the adapter was exercised against the actual `SelfImprovementManager` source copied into a disposable temporary workspace. It created a temporary run, read a candidate source file, created a candidate-specific test, applied a SHA-preconditioned patch, listed the open run and confirmed that promotion is denied. The temporary workspace was deleted afterward. No user PC files or live Agent state were touched.
- **GitHub Actions:** [Local Evolution Manager Adapter Compatibility run #1](https://github.com/LiberoNuvola/Cormia/actions/runs/41464055794) completed **SUCCESS** at `f65a7852b31b96b08c48527c3a5ccda8c53188ee`; syntax and all adapter contract tests passed.

These checks do not run Docker against the user's local setup, do not invoke Granite, and do not evaluate or promote an actual candidate. The aggregate local probe at `scripts/verify-local-runtime-adapters.mjs` can validate existing Windows run journals and read one line from an open candidate without creating or modifying a run.

## Limitations

This wrapper does not:
- launch or wire the local agent;
- provide a new scheduler, peer task intake or background process;
- mutate live source files;
- bypass /evolve explicit user initiation;
- authorize changes to the Agent, Coding Workspace, configuration, MCP, protocol repository or baseline tests;
- make the hash-linked journal a digital signature;
- provide cryptographic proof of correctness;
- create CRC, receipts, on-chain commitments or wallet actions.

The current evolution manager remains a local prototype whose journal and candidate tree are stored on the local filesystem. A future networked adapter must preserve these boundaries and add its own manifest, authorization, persistence and evidence protocol.


## Verification evidence

Thirteen Node-native adapter contract tests pass in the isolated review environment. A dedicated GitHub Actions workflow now checks syntax and all adapter contracts. The workflow result is recorded after it completes.

These are adapter-boundary tests using a fake manager. They do not claim that a real run was started, that candidate code was evaluated, or that the local Windows/Docker environment was exercised.
