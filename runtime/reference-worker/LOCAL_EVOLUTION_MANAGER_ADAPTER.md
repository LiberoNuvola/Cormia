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
