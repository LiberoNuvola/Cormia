# Reference worker runtime

The local IMMORTAL Agent v0.8.0 is a prototype and potential starting point, not yet conformant. Before code is moved here, audit source ownership, licenses, dependencies, secrets, and security boundaries.

The reference worker should implement:

1. Task Manifest parsing and signature verification.
2. Protocol state reconciliation and idempotent event handling.
3. Capability/policy enforcement independent of the model.
4. Persistent task journal, checkpoints and recovery.
5. Model gateway and provider abstraction.
6. Resource Manager with safe lease acquisition/release.
7. Sandboxed execution and resource limits.
8. Evidence Package construction and content commitments.
9. Cardano adapter transaction construction and status tracking.
