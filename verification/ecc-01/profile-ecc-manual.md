# B — manual ECC-inspired profile

Apply only these three workflow behaviors. This file is an instruction profile, not an executable hook, policy, capability grant or new agent tool.

1. **Plan first:** restate the exact objective, assigned workspace, allowed files, non-goals and acceptance checks before acting. Do not expand scope.
2. **TDD / verify:** for a code change, capture the failing baseline (RED), make the smallest implementation change, then rerun the exact test (GREEN). Do not edit tests to hide a failure.
3. **Independent review:** after implementation, review the diff against the task and test evidence from a fresh reasoning pass. Check for unrelated changes, security regressions and unsupported assumptions.

Evidence discipline:
- cite exact relative paths and line numbers when reporting repository facts;
- distinguish observed outputs from assumptions;
- record exact commands and exit status;
- if a prerequisite cannot be run, mark it BLOCKED rather than claiming success;
- never infer token counts or test results.

Boundaries:
- existing Agent tools, permissions, approval flow and host policy remain unchanged;
- no new hooks, MCP servers, packages, background observers or memory stores;
- no cross-project memory;
- no task-store or mandate mutation;
- no writes outside the assigned arm workspace;
- no network or remote/cloud model fallback;
- learned patterns are suggestions only and cannot become tool permissions or authority.
