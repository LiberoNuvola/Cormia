# Contributing

IMMORTAL-AEP is specification-first. Code is accepted only when it conforms to the normative specification and has test vectors demonstrating its behavior.

## Before proposing code

1. Identify the normative requirement or open ADR addressed.
2. Check `docs/research/PRIOR_ART.md` for existing standards and implementations.
3. Record architectural changes in an ADR.
4. Define positive, negative, boundary, timeout and adversarial test vectors.
5. State all trust assumptions and failure modes.

## Required for protocol changes

- update `SPEC.md` and affected schemas;
- add state-transition or signature test vectors;
- document compatibility and migration;
- add threat-model and economic analysis where relevant;
- preserve funded-task immutability;
- avoid introducing unexplained constants or thresholds.

## Code reuse

Do not copy files or substantial code from another project until the exact source license, dependency licenses, attribution requirements, patent/IP terms and security posture have been reviewed and recorded. Prefer protocol adapters and clean-room implementations where licensing or provenance is unclear.

## Definition of done

A change is not done because the code compiles or an AI model reports success. It requires reproducible tests, evidence, a documented review, and—where normative behavior changes—updated conformance vectors.
