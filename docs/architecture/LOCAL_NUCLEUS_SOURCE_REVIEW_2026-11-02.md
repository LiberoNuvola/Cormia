# Local IMMORTAL nucleus — source review

**Date:** 2026-11-02  
**Review input:** `cormia-source-review-20261102-135203.zip`  
**Archive SHA-256:** `04c895cf577842548b99da8015df391b8029cb79e7210b733cdeba381b6ead90`  
**Manifest:** `cormia.source-review-bundle.v1`  
**Review type:** static source review + isolated Node.js syntax/unit checks  
**Status:** implementation map established; no source migrated into Cormia

## 1. Executive result

The archive is readable and its SHA-256 exactly matches the value printed by the local PowerShell exporter. It contains 15 allowlisted source/test/documentation files plus MANIFEST.json. The metadata-only inventory describes 46 files across four local roots; this review archive deliberately contains only selected source and tests.

The existing local nucleus is a set of cooperating but separately rooted components:

1. Local Agent is the orchestrator and owns durable task/session/evidence paths.
2. Coding Workspace is a separate bounded file/tool service rooted outside the Agent directory.
3. Resource Manager and Evolution Manager are separate modules under Coding Workspace.
4. Control Room is a separate localhost dashboard that manages the local model and Agent processes.
5. Mitsuro MCP bridge is a narrow read-only observer of the fixed IMMORTAL GitHub branch.

The source is not yet an AEP Runtime. There is no AEP manifest adapter, protocol capability mapping, peer scheduler/mesh, CRC accounting, contribution receipt pipeline, or Cardano settlement implementation in these selected components.

## 2. Source map and hashes

| Component | Source file | SHA-256 prefix |
|---|---|---|
| Local Agent | `LocalAgent/agent.mjs` | `f60b3fe3f91a` |
| Agent Coding Workspace module | `LocalAgent/coding-workspace.mjs` | `a0dbc2c4dc11` |
| Workspace test subject copy | `CodingWorkspace/coding-workspace-under-test.mjs` | `a0dbc2c4dc11` |
| Resource Manager | `CodingWorkspace/self-improvement/resource-manager.mjs` | `a8ab76ea9eaa` |
| Evolution Manager | `CodingWorkspace/self-improvement/evolution-manager.mjs` | `1eb765427d61` |
| Combined manager test suite | `CodingWorkspace/self-improvement/self-improvement.test.mjs` | `f34f9eb2e813` |
| Control Room | `ControlRoom/control-room.mjs` | `b5a327d801f4` |
| Local Mitsuro bridge | `McpBridge/jev-readonly-mcp.mjs` | `7307ead08d3e` |

The two Coding Workspace implementation files are byte-identical. The second is a copied test subject, not a separate implementation.

The manifest excludes config files, backups, task/session/audit data, credentials, wallet material, models, dependency trees, logs, build output and Git objects. Those omissions are intentional and limit what this review can certify.

## 3. Component findings

### 3.1 Local Agent v0.8

**Role:** local orchestration and tool-policy boundary.

Observed in source:

- Uses a loopback-only LLM base URL; cloud model endpoints are rejected by URL validation.
- Standard mode exposes the four fixed read-only MCP tools.
- Coding tools are exposed only inside an explicit `/code` turn.
- Evolution tools are exposed only inside an explicit `/evolve` run and are constrained to that run ID.
- The HTTP service is a separate read-only mode; coding/evolution tools are not exposed there.
- Service startup requires a loopback bind and a Bearer token of at least 40 UTF-8 bytes.
- The service accepts only a fixed empty-body audit request and task-ID reads; there is no arbitrary goal, shell, Git, workflow, wallet or Cardano endpoint.
- The durable task store is saved through a temporary file and rename. A task found in `running` after restart is changed to `paused`, not automatically re-executed. Resume is explicit.
- Task evidence is stored separately by task ID and attempt. On resume, prior output is context only; the agent is instructed to re-check current facts.

**Integration disposition:** preserve this as the first Cormia local-node host. The initial AEP adapter should wrap the existing task lifecycle rather than replace it. The LLM conversation transcript must remain non-authoritative; the durable task store and evidence files are the recovery surface.

**Observed discrepancy:** the interactive banner identifies Agent 0.8, while the HTTP `/healthz` response still reports version `0.7`. The Control Room documentation also labels the service 0.7. This is a version-reporting mismatch, not evidence that the installed runtime is v0.7.

**Test fixture issue:** `agent.mjs` statically imports `./coding-workspace.mjs`. The included HTTP/e2e tests copy only `agent.mjs` into their temporary application directory, and normal-mode tests also expect the sibling `../Immortal-CodingLab/workspace/self-improvement` modules. As packaged, the tests do not stage these runtime dependencies. In an isolated review copy, adding the missing modules allowed the HTTP service test to pass; the mock e2e suite then passed 7 of 8 tests. The remaining `/probe` test fixture emits `Commit:`, while the current Agent parser requires a line beginning `commitSha:`. This is a stale test fixture mismatch. No fix was made to IMMORTAL-Protocol or the local installation.

### 3.2 Coding Workspace

**Role:** scoped file operations, verification and isolated test execution.

Observed tool surface:

- Read-only: `workspace_list`, `workspace_read`, `workspace_diff`, `workspace_verify`.
- Mutating/approved: `workspace_write`, `workspace_patch`, `workspace_test`.
- Writes create new files only. Patches require the current full SHA-256 precondition.
- Relative paths are required; drive paths, UNC paths, traversal, symlinks and non-regular files are rejected.
- File content limit is 256 KiB; list output is capped at 200 entries; diff expansion at 500 lines.
- Test runner uses a pre-existing `node:22-alpine` image with `--pull=never`, no network, read-only root filesystem, read-only workspace mount, dropped capabilities, no-new-privileges, PID/CPU/RAM limits and a bounded writable tmpfs.
- `workspace_verify` uses `node --check`; it parses JavaScript without executing the module.

**Integration disposition:** use this as the local filesystem and coding execution adapter. Keep its root fixed and its approval boundary intact. AEP capabilities should narrow the existing tools; do not convert them into a general shell or remote execution capability.

### 3.3 Resource Manager

**Role:** local admission control based on host telemetry.

Observed behavior:

- Samples CPU, available/total RAM and optional NVIDIA GPU telemetry.
- Uses fixed `nvidia-smi` arguments with `shell: false`.
- Classifies resource state as critical, interactive, balanced or idle.
- Blocks new heavy work when CPU/RAM telemetry is insufficient or the machine is busy.
- Uses in-process leases to limit concurrent model and heavy-build work.

**Important limitation:** this is an admission/lease manager, not an operating-system resource controller. It does not continuously throttle processes, resize Docker/WSL limits, or terminate arbitrary workloads. The README explicitly describes snapshots as point-in-time and says no background scheduler or job termination exists in this prototype.

**Integration disposition:** retain as the first local policy adapter. Treat its decision as host admission evidence, not as an enforceable remote protocol guarantee.

### 3.3A Cormia Resource Manager compatibility wrapper (added after source review)

The separate Cormia-side wrapper at `runtime/reference-worker/immortal-resource-manager-adapter.mjs` maps trusted operations to fixed existing manager lease classes, fails closed on missing/invalid snapshots or denied acquisition, and releases leases in `finally`. Eleven unit contracts and the GitHub Actions workflow pass. It is not connected to the existing Agent and does not claim OS-level enforcement. See [LOCAL_RESOURCE_MANAGER_ADAPTER.md](../runtime/reference-worker/LOCAL_RESOURCE_MANAGER_ADAPTER.md).

### 3.4 Evolution Manager

**Role:** isolated candidate lifecycle for two source modules.

Observed behavior:

- Explicit source allowlist currently contains `resource-manager.mjs` and `evolution-manager.mjs`.
- Creates baseline and candidate copies before allowing edits.
- Candidate file paths are normalized and constrained; runtime/config/credential basenames are forbidden.
- Uses file-size/run-size/count limits, SHA preconditions, candidate tree validation and a hash-linked journal.
- Evaluates only after host syntax verification and Docker tests with the candidate directory mounted read-only, no network and bounded resources.
- Requires an additional candidate-specific test for changed implementation code.
- Produces a human-review packet. `promote()` always throws; no automatic runtime activation is implemented.

**Important limitation:** the hash-linked journal is an integrity check, not a digital signature or protection against a privileged local attacker. The README states this limitation.

**Integration disposition:** preserve the candidate manager and its no-auto-promotion invariant. AEP should represent evolution as a task/campaign with immutable source digests, candidate artifacts, test evidence and an external review decision. Do not let the model promote itself.

### 3.5 Control Room

**Role:** localhost operator dashboard for Granite, Agent and Dagu.

Observed in source:

- Uses fixed process invocations via `spawn`/`execFile`, with `shell: false`.
- Tracks only processes it started; it does not silently adopt or terminate externally launched processes.
- Has a fixed set of action routes, same-origin checks and empty JSON body checks.
- Reads the Agent Bearer token from the local data directory and does not expose it in status/log output.
- Dagu commands and workflow path come from local configuration; no arbitrary command field is exposed.

**Review limitation:** `config.json`, `public/index.html` and `public/app.css` were intentionally excluded from the archive. The Control Room safety test imports config and reads HTML/JS assets, so its test cannot run from this source-review bundle. The test was not classified as failed; it is **not run / incomplete due to excluded inputs**.

**Integration disposition:** preserve as an optional local operator surface. It is not a Cormia network node or protocol authority. Keep configuration and credentials out of the Cormia repository.

### 3.6 Mitsuro read-only MCP bridge

**Role:** bounded read-only observation of IMMORTAL public GitHub/JEV evidence.

Observed:

- Fixed repository `LiberoNuvola/Immortal-Protocol` and branch `work/immortal-green-closure`.
- Four tools: `get_branch_head`, `get_ci_status`, `read_jev_registry`, `read_allowed_file`.
- Unauthenticated GitHub REST GET only.
- Explicit file allowlist, 24,000-character output cap and 10-second timeout.
- No shell, subprocess, arbitrary filesystem, write API, wallet or on-chain path.
- Historical JEV fixture is expressly labeled historical, not a current certification.

**Review limitation:** the local MCP root inventory contains only this bridge source; no local test file was included in the archive. The IMMORTAL-Protocol branch has a separate bridge regression test.

**Integration disposition:** keep this bridge fixed and read-only. A Cormia observer must be a separate versioned adapter, not a broadening of this bridge.

### 3.7 Cormia Evolution Manager adapter (post-review implementation)

The new wrapper at `runtime/reference-worker/immortal-evolution-manager-adapter.mjs` binds candidate work to a trusted run ID and fixed source map, enforces candidate-only test creation, prevents baseline test patches, uses exact SHA and anchor-count preconditions, validates host-produced syntax/Docker evidence before evaluation, and permanently denies runtime promotion. Its tests use a fake manager to check boundary logic; they do not run the local SelfImprovementManager against the user's workspace. See [LOCAL_EVOLUTION_MANAGER_ADAPTER.md](../runtime/reference-worker/LOCAL_EVOLUTION_MANAGER_ADAPTER.md).

## 4. Prior evolution run: no candidate delta

The metadata inventory for `EVOL-20261102072415-46c24ca0` shows identical hashes between active source, baseline copies and candidate copies for both manager modules. The same combined test file was copied under the two manager test names in baseline and candidate.

Conclusion: this run did not modify either manager implementation. Its context-overflow stop must remain classified as an incomplete evolution attempt, not a successful improvement.

## 5. Isolated test and syntax results

Node.js available in the review container: **v22.16.0**.

| Check | Result | Scope / limitation |
|---|---|---|
| `node --check` on six main JS modules | PASS | Syntax only; does not execute code |
| `node --test CodingWorkspace/coding-workspace.test.mjs` | 33 passed | Unit tests; Docker command is mocked in this suite |
| `node --test CodingWorkspace/self-improvement/self-improvement.test.mjs` | 51 passed | Manager/resource-policy unit tests |
| `node --test` from extracted CodingWorkspace root | 85 passed | Includes one no-assertion subtest for `coding-workspace-under-test.mjs` |
| Agent HTTP service test after staging missing runtime import in a temporary test fixture | 1 passed | Mock LLM/MCP; not a live local service |
| Agent mock e2e suite after staging missing runtime modules | 7 passed, 1 failed | Remaining failure is stale `Commit:` vs required `commitSha:` mock response |
| Control Room safety-contract test | NOT RUN | Bundle intentionally lacks config.json and public HTML/CSS assets |
| Real Docker candidate execution | NOT RUN | No Docker container was launched in this review |
| Live Granite/MCP/Dagu/Windows integration | NOT RUN | No local service or Windows machine was accessed |

The syntax/unit checks were run against the extracted archive in an isolated review environment. They are not a CI result for a GitHub commit and do not prove Windows behavior, Docker isolation on the user's PC, real MCP connectivity or AEP conformance.

## 6. Migration order

1. **Freeze this source inventory.** Preserve the Agent and Coding Workspace as-is; do not copy local state or credentials.
2. **Extract formal interfaces.** Document agent command dispatcher, task-store schema, task/evidence lifecycle, Resource Manager lease API, Evolution Manager run API, Coding Workspace tool schemas and Control Room actions.
3. **Add compatibility contract tests.** In particular, repair the Agent temporary test fixtures so they stage required modules and align the mock `/probe` response with the current parser. Keep Control Room tests blocked until config/assets are provided in a safe test fixture.
4. **Create Cormia local runtime adapter.** Wrap the current task lifecycle and local tool boundary; do not rewrite the Agent.
5. **Add AEP manifest/capability mapping.** Start local-only and fail closed when a task asks for capabilities not represented by the current host policy.
6. **Add evidence adapter.** Convert actual test/tool outputs into a versioned AEP Evidence Package. Preserve JEV `PASS/FAIL/BLOCKED/NOT_RUN` semantics.
7. **Only later, evaluate reciprocal inference.** Resource donation leases, model/runtime identity, signed contribution receipts, verification and CRC accounting are separate work; no values or formulas are approved by this review.
8. **Keep Cardano settlement last.** This local nucleus does not yet establish AEP settlement conformance. No wallet or on-chain action is authorized here.

## 7. Stop conditions

- Do not modify V3, Reveal, PRE-RICH economic semantics, Issue admission or validator logic for Cormia.
- Do not copy `data/`, `config.json`, tokens, keys, task/session/audit state, wallet material, user prompts, logs, models or dependency trees.
- Do not vendor Flux Point source based only on the documented version; license/NOTICE and dependency review remain separate.
- Do not call the current Agent or managers AEP-conformant.
- Do not treat passing unit tests or the hash-linked journal as cryptographic proof of correctness.
- Do not enable peer compute, CRC issuance or Cardano settlement before the respective versioned contracts and independent verification exist.
