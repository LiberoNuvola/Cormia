# Synthetic local security profile

This file is an evaluation fixture, not an active Cormia policy.

- Default network mode: offline.
- Outbound requests: denied.
- Allowed workspace operations: workspace_list, workspace_read, workspace_diff, workspace_verify.
- Approval is required before workspace_write, workspace_patch and workspace_test.
- Denied read paths: .env, secrets/** and wallet/**.
- Maximum parallel tasks: 2.
- Model fallback: none; the fixture requires local-only execution.
