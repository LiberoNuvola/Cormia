# Cormia ECC composition review — 2026-11-06

- **Status:** prior-art and integration candidate; non-normative; not adopted; not implemented.
- **Target:** [Everything Claude Code (ECC)](https://github.com/affaan-m/ECC), official upstream repository.
- **Reviewed release:** v2.2.3 (latest release surfaced on the official release page at review time).
- **License:** upstream repository states MIT for ECC open source; re-check every subcomponent and dependency before code vendoring.
- **Cormia branch for this record:** `work/exp-generalization-crosswalk`.

## 1. Identity and category

ECC is an **agent-harness / developer-workflow toolkit**, not a language-model training or weight-compression framework.

Its upstream materials describe a coordinated workflow resembling:

`plan → test → implement → review → verify → remember → improve`

The project distributes agents, skills, rules, commands, hooks, session/context-memory mechanisms, continuous-learning workflows and AgentShield security scanning. Its README reports a large catalog (71 agents and 314 skills at the reviewed snapshot); the actual subset and enforcement behavior vary by host harness.

**Critical distinction from Soup:** ECC's “memory” and context optimization concern agent session continuity, retrieval and context-window/token use. They do not make model weights smaller, reduce model VRAM residency for fine-tuning, or train a larger base model on less hardware. Soup and ECC therefore address different layers and may be complementary, not substitutes.

## 2. What is relevant to Cormia

| ECC capability | Potential Cormia use | Required boundary |
|---|---|---|
| Curated skills, rules and specialist agents | Reuse selected engineering/research/security workflows in Cormia workers. | Skills are instructions, not authority. A skill cannot add tools, expand a task, or override host policy. Review each skill for provenance and scope. |
| Verification loops, TDD, eval-oriented workflows | Improve task plans and local verification recipes; align with existing deterministic tests and evidence gates. | ECC workflow completion does not equal AEP acceptance. Preserve the existing Flux Point and JEV roles; bind outcomes to exact artifacts and test evidence. |
| Context controls and session summaries | Reduce unnecessary prompt/context repetition and improve continuity between sessions. | Session memory is advisory context, not the durable source of task truth. Existing Task Store, manifests, checkpoint lineage and audit evidence remain authoritative for execution history. |
| Continuous Learning v2 “instincts” | Discover recurring project conventions and turn reviewed patterns into reusable skills. | Treat every learned/imported instinct as untrusted data. Require source-session/project scope, provenance, confidence, review and versioning before promotion. No automatic cross-project sharing or policy/mandate changes. |
| AgentShield / security-scan workflows | Add a read-only review of agent definitions, hooks, permissions, MCP manifests and secret exposure. | Static scanning is a detection aid, not a security certification. Review findings manually; do not use `--fix` or execute hooks automatically during the initial evaluation. Verify the scanner's own source/package and license. |
| Cross-harness adapters | Potentially reuse a selected skills catalog through a Cormia adapter; Codex has a native plugin path. | Feature parity is not universal. Codex hook trust is a separate host decision; Cormia's custom Node/Granite runtime is not automatically an ECC-supported harness. |

## 3. Fit against the existing Cormia / IMMORTAL nucleus

The existing nucleus remains the reference worker and must not be replaced by an ECC installation:

- **Agent and model gateway:** existing IMMORTAL Local Agent v0.8 lineage with local Granite via llama.cpp.
- **Task truth:** durable Task Store, task IDs, checkpoints, attempts and audit/evidence lineage.
- **Resource and evolution controls:** existing Resource Manager and Evolution Manager.
- **Authority:** Cormia host policy and Project Mandate; IMMORTAL AEP remains authoritative for governed task/capability/economic transitions.
- **Verification:** existing test/evidence pipeline and the Flux Point / JEV assets already recorded in the preservation map.

Proposed composition:

`Cormia Runtime → selected ECC-derived skills/workflows → existing host policy + Resource Manager → existing verifier/evidence pipeline`

ECC is an optional source of workflow patterns. It does not sit above IMMORTAL authority, and it does not replace task persistence, execution isolation, evidence validation or settlement.

## 4. Compatibility and security findings

1. **Windows is a material gate.** ECC's current README says its core Node.js CLI and managed installers support Windows, but documents open native-Windows defects in the Continuous Learning v2 observer daemon and memory-vault writes. Windows + WSL follows the Linux paths more closely; shell-backed optional features may require Git Bash/WSL.
2. **Harness parity is partial.** The upstream support matrix distinguishes stable, beta, experimental and instruction-only adapters. The Codex native plugin has its own manifest and hook projection; Codex requires an explicit trust decision for hooks. Do not infer Claude hook behavior or trust from a successful plugin installation.
3. **Hooks and MCP are executable trust surfaces.** Inventory and inspect every hook command, environment variable, MCP server, package invocation and permission scope before enabling any runtime behavior.
4. **Memory isolation matters.** Keep ECC data stores separate by project and host. Do not merge learned instincts into the existing IMMORTAL session/task store without a versioned, provenance-bearing adapter.
5. **The security scanner is not an audit.** Treat AgentShield findings as static-analysis evidence with coverage and false-negative limits. Its optional multi-agent/Opus analysis may require external provider access; it must not silently violate Cormia's local-first policy.
6. **License and supply chain:** ECC states MIT for the open-source project, but pin the exact reviewed tag/commit, verify package integrity and inspect each third-party dependency before installation or vendoring. Avoid unversioned `npx` execution in an agent with write permissions.

## 5. Bounded evaluation spike — ECC-01

**Decision:** SPIKE; no production dependency or automatic adoption.

### Phase A — source and asset inventory

- Pin the official `affaan-m/ECC` v2.2.3 release and immutable source revision.
- Verify the tag/signature and package integrity; record license and dependency notices.
- Inventory only relevant assets: agent/skill definitions, hooks, rules, MCP manifests, memory/continuous-learning scripts, Codex adapter and AgentShield.
- Classify every item as `REFERENCE`, `ADAPT`, `REJECT` or `NEEDS_REVIEW`.

### Phase B — read-only security review

- Run or inspect AgentShield only from a reviewed, pinned local checkout/package.
- Scan the intended Cormia and IMMORTAL configuration paths; never scan a broader home directory by default.
- Do not apply automatic fixes, install hooks, register MCP servers, or modify global Claude/Codex/IDE configuration.
- Manually review any critical/high finding and record false positives and unscanned surfaces.

### Phase C — isolated workflow experiment

- Select a small number of non-authoritative workflows (for example: research-first, TDD/verification loop, code-review checklist and a documentation skill).
- Use a dedicated test workspace and isolated harness/data home; do not merge ECC memory into the production Task Store.
- Compare a baseline Cormia task with the selected ECC-derived workflows for context tokens, task completion, test quality, unsupported tool attempts, review defects and repeatability.
- Test Windows-native behavior explicitly; do not assume WSL success proves native-Windows compatibility.
- If testing through Codex, use its native plugin lifecycle in an isolated Codex home and separately review/trust each hook. Do not equate this with integration into the custom Granite agent.

### Acceptance gates

- No increase in effective tool authority or host permissions.
- No task-state or mandate mutation from learned memory/skills.
- No cross-project memory leakage.
- Reproducible improvement in at least one declared metric (context use, verification coverage or defect detection) without material regression elsewhere.
- Hook/MCP inventory reviewed and all enabled commands explicitly approved.
- Clear uninstall/rollback path and no changes to the existing local Agent configuration.

## 6. Explicit non-goals

- No ECC installation on the user's Windows host or production IMMORTAL Agent in this registration step.
- No replacement of the local Granite model, Task Store, Resource Manager, Evolution Manager, Flux Point or JEV.
- No automatic import of all upstream skills, agents, MCP servers or hooks.
- No claim that ECC trains model weights, compresses large LLMs or reduces GPU memory for training.
- No new AEP capability, authority, token, credit, economic rule or protocol schema.

## 7. Official sources

- Official repository and README: https://github.com/affaan-m/ECC
- Latest release page: https://github.com/affaan-m/ECC/releases
- Codex native plugin details: https://github.com/affaan-m/ECC/tree/main/.codex-plugin
- Continuous Learning v2: https://github.com/affaan-m/ECC/tree/main/skills/continuous-learning-v2
- Security scan / AgentShield workflow: https://github.com/affaan-m/ECC/tree/main/skills/security-scan
- AgentShield scanner: https://github.com/affaan-m/agentshield

**Reviewed:** 2026-11-06. Re-check release, support matrix, exact tag, dependencies, package integrity, hooks, memory behavior, platform compatibility and licenses before running or vendoring code.
