# Agent Task Store v1 test vectors

These are synthetic, redacted fixtures derived from the observed Agent v0.8 format. They contain no real user tasks or evidence.

- \`valid-paused-store.json\`: one paused task with one prior attempt evidence pointer.
- \`valid-attempt-evidence.json\`: one attempt sidecar using the post-incremental-save \`updatedAt\` form; \`createdAt\` is intentionally absent.

The adapter's Node-native tests also cover:
- wrong envelope version and missing tasks array;
- duplicate task IDs;
- legacy records missing \`expectedTools\`;
- exact explicit-resume eligibility;
- evidence path traversal and future-attempt mismatch;
- sidecar task/attempt binding;
- valid sidecars without \`createdAt\`.

Run from this directory's parent runtime folder:

\`\`\`powershell
node --test .\immortal-agent-task-store-v1-adapter.test.mjs
\`\`\`

The fixtures test compatibility only. They are not AEP Task Manifests or signed execution evidence.
