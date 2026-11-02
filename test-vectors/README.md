# Test vectors

No normative state-transition vectors are approved yet. The first test-vector set must include:

- valid and invalid manifest commitments;
- funding below/above exact budget;
- `Open -> Assigned` with and without required worker bond;
- duplicate/replayed assignment and delivery;
- delivery bound to wrong manifest or worker;
- valid/invalid verifier verdict signatures;
- challenge inside/outside challenge window;
- conflicting verdicts and `inconclusive` outcome;
- worker timeout, verifier timeout, storage unavailability;
- cancellation/refund paths;
- duplicate settlement prevention;
- concurrent spend/stale UTxO recovery on Cardano.
