# ECC-01 task 03 — read-only security review

**Workspace:** {{WORKSPACE_ROOT}}

Review src/archive-export.mjs and src/report-format.mjs statically.

Requirements:
- Do not execute either module.
- Do not run the archive/export command.
- Do not edit or create files.
- Identify security-relevant defects only when supported by exact code evidence.
- For each finding provide severity, file/line, the untrusted input, the vulnerable operation, a realistic precondition, impact, and a minimal mitigation.
- Separate security findings from style/maintainability observations.
- Do not claim that a vulnerability was exploited or that a scanner was run.

There is one intentionally seeded high-severity security defect. Find it. If you cannot justify a finding from the source, say so rather than guessing.
