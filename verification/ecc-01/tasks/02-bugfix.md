# ECC-01 task 02 — seeded bug fix

**Workspace:** {{WORKSPACE_ROOT}}

The workspace contains a tiny dependency-free Node.js module and its tests.

Goal: correct the off-by-one defect in src/page-size.mjs so that page size is always an integer between 1 and 50 for valid positive integers, invalid input returns the documented default of 10, and values above 50 are capped at 50.

Requirements:
1. Before editing, run node --test test/page-size.test.mjs and record the actual RED result.
2. Change only src/page-size.mjs. Do not modify or delete tests.
3. Implement the smallest correct fix.
4. Run the same test command and record the actual GREEN result.
5. Review the final diff and report changed paths.
6. Do not install dependencies, contact the network, alter global configuration or use a different model.

If the baseline is not failing as expected, stop and report BLOCKED; do not invent a failing result.
