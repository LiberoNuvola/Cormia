# Cormia manual adaptation profile for Everything Claude Code — v0.1

- **Date:** 2026-11-06
- **Status:** evaluation profile / non-normative / no runtime installation
- **Upstream baseline:** [Everything Claude Code (ECC)](https://github.com/affaan-m/ECC), release **v2.2.3**, latest release shown at review time; signed GitHub tag and signed release commit are displayed as verified by GitHub (short commit `c05b2d6`).
- **Target runtime:** IMMORTAL Local Agent v0.8 lineage, custom Node.js process, local Granite 4.2 8B via llama.cpp, Windows host.
- **Reason for manual adaptation:** ECC lists no native target for the custom Cormia/IMMORTAL Node+Granite agent. Its own Manual Adaptation Guide recommends selecting a very small set of workflow skills and reproducing command intent / hook discipline in instructions, while acknowledging that native hook execution and command plumbing are lost.

## 1. Scope

This profile tests only reusable workflow behavior, not the ECC installer or its full plugin ecosystem.

Included:
- task framing and scope before execution;
- test-first change workflow;
- fresh-context or independent review;
- evidence-backed final verification;
- small, task-scoped context bundles.

Excluded:
- ECC installation or global configuration changes;
- hooks, background observers, automatic command execution and new MCP servers;
- ECC Memory Vault and Continuous Learning v2 on the native Windows host;
- wholesale import of skills, rules, agents or commands;
- changes to the IMMORTAL Agent, Task Store, Resource Manager, Evolution Manager, Coding Workspace, Granite configuration or credentials.

## 2. Cormia-native mapping

| ECC behavior | Existing Cormia/IMMORTAL surface | Manual adaptation |
|---|---|---|
| Plan before implementation | Existing durable task creation with `/task <goal>` | Start each experiment with objective, exact scope, non-goals, baseline commit, expected outputs and stop conditions. |
| TDD / RED → GREEN → REFACTOR | Existing repo tests, local test runner and current approval gates | Reproduce a failing test before a code change; make the smallest change; rerun focused and regression tests. No test is claimed to have failed/passed unless its output exists. |
| Fresh-context review | Separate review pass / independent agent or fresh session where available | Reviewer receives diff, task objective and test evidence, not an unfiltered implementation transcript. Reviewer reports findings before approval. |
| Verification loop | Existing test evidence, GitHub Actions, local adapter probes and `/evidence <ID>` | Verify exact commit, changed paths, commands, CI result and limitations. Treat historical evidence as historical. |
| Session continuity | Existing Task Store, attempt sidecars and `/resume <ID>` | Keep task state and evidence in the existing store. Current `/resume` starts a new attempt from the original goal; it is not an instruction-level checkpoint restore. |
| Learned instincts | No ECC runtime imported | Suggestions only. Any recurring pattern requires explicit source references, project scope, confidence, review and a human-approved documentation promotion. |

The currently documented agent commands remain unchanged: `/task`, `/tasks`, `/resume <ID>`, `/evidence <ID>`, `/probe`, `/head`, `/ci <SHA>`, `/tools`, `/status`, `/clear`, `/help`, `/exit`. This file does not create executable slash commands.

## 3. Compact ECC-inspired task preamble

Use this only for the bounded ECC-01 comparison task; it is not a global system prompt.

> **Plan:** Restate the goal, scope, non-goals, baseline revision, affected paths, risk and acceptance checks before changing anything. Resolve the relevant source and ownership map first.
>
> **Research:** Inspect the exact current source and authoritative project documents. Distinguish verified facts, assumptions, historical evidence and unknowns. Do not invent APIs, test results or repository state.
>
> **Test first:** For a code change, identify or add a focused regression test and capture the failing baseline before implementation. If a test cannot safely be run, mark it BLOCKED rather than simulating success.
>
> **Implement:** Make the smallest scoped change. Respect existing path, branch, approval, resource and tool allowlists. Do not add dependencies, hooks, MCP servers, permissions or remote fallback unless separately authorized.
>
> **Review:** Review the diff from a clean context where practical. Check for unintended paths, authority expansion, secret exposure, test weakening and regressions.
>
> **Verify:** Run the exact focused tests and relevant regressions. Record command, exit status, commit, evidence reference and limitations. Never infer a PASS from a code inspection or from an old CI run.
>
> **Remember:** Suggest reusable patterns only with provenance and scope. Do not automatically write them into task truth, policy, mandates, permissions or global memory.

## 4. Security and platform exclusions

1. **No native-Windows observer or automatic memory promotion.** ECC's current README still lists #2489 and #2626, but the issue pages conflict with that summary: #2626 was closed via #2637 and a September comment says the fix is on main; #2489 was closed via #2606 but later comments say the actual observer-detach defect remained. Newer Windows hook issues (#3756, #3765, #3802) are also reported after v2.2.3. The evaluation therefore excludes Continuous Learning v2 observer, hooks and Memory Vault integration; it does not claim that all of these defects remain open. Any future trial must verify the exact package on the target host first.

2. **No hooks.** ECC hooks are executable host configuration. This profile simulates their intent as instructions only; it does not install or register them.
3. **No new MCP.** ECC's Codex plugin bundles a default Chrome DevTools MCP server; that is not needed for the custom Granite agent and must not be registered.
4. **AgentShield not yet run.** ECC describes scanning CLAUDE.md, settings, MCP configs, hooks, agent definitions and skills. The scanner is an aid, not a full audit of arbitrary Node.js agent code. Do not install/run an unpinned scanner or claim the custom agent has been scanned. A separate exact-path review of the local agent configuration is still required.
5. **No secrets in evidence.** Inventory may report presence/count/path class, never secret values, tokens, wallet material, model prompt payloads or raw task contents.
6. **No memory duplication.** The existing Agent Task Store and attempt evidence remain authoritative for the work the agent performed. A future context-memory store, if independently justified, must be separate, project-scoped, create-only before review, and non-executable.

## 5. ECC-01 A/B evaluation design

### Baseline and adapted arms

- **Arm A — baseline:** the existing local Agent handles a task using its current behavior and normal controls.
- **Arm B — manual ECC profile:** same Agent, same Granite model, same resource limits and same tools; only the compact task preamble in section 3 is added.
- Do not compare different models, system settings, permissions, repositories or task complexity.
- Use a disposable copy/worktree and synthetic fixture. Do not use live IMMORTAL/Cardano/Preprod tasks, secrets, wallet files or production branches.

### Suggested matched tasks

1. **Read-only research task:** answer a fixed question from a small fixture repository, list exact supporting paths/lines and separate assumptions.
2. **Bug-fix task:** repair one seeded, deterministic bug in a disposable Node.js fixture; require RED evidence, minimal patch and GREEN regression test.
3. **Review task:** inspect a known diff containing seeded benign and security-relevant issues; report findings with path, evidence, severity and uncertainty.

Run at least three matched pairs where feasible. Randomize which arm runs first if practical. Keep the model temperature and task prompt fixed. The baseline and adapted arm must use the same tool allowlist.

### Measures

Primary measures:
- task acceptance against a pre-written answer/DoD rubric;
- evidence completeness (source references, test command, exit code, revision);
- missed seeded defects and false-positive findings;
- number of unsupported tool/capability attempts (must remain zero);
- unintended file changes or authority/permission changes (must remain zero).

Secondary measures, only when reliably exposed by the local runtime:
- input/output token counts;
- elapsed time;
- number of tool calls and task attempts;
- context size at handoff.

Do not estimate tokens from character counts and label them token measurements. Record unavailable metrics as NOT_MEASURED.

### Acceptance / stop rules

- **Immediate stop / FAIL:** secret disclosure; unapproved file or configuration mutation; new tool or permission; network/cloud fallback; task-store corruption; or any attempted authority/mandate expansion.
- **No adoption:** any measurable increase in unsupported tool attempts, task-state confusion or data leakage.
- **Candidate PASS:** no safety regressions, all test/evidence claims reproducible, and a repeatable improvement in at least one predeclared primary quality measure without a material regression in the others.
- Three pairs are an engineering screen, not a statistically conclusive benchmark. Preserve raw anonymized counts and label the evidence scope.

## 6. Local execution boundary

This profile is committed as documentation only. The actual A/B run must occur on the operator's Windows machine because this environment cannot inspect the live `E:\AI\Immortal-Agent-v0.7` process, its private Task Store or local runtime telemetry.

Before any A/B task:
- use the existing read-only probe only if the current local Cormia checkout is aligned with the reviewed branch and the operator explicitly intends to run it;
- make a disposable fixture/worktree and confirm the actual model and allowed tools;
- keep the live Agent, task store, audit logs and production coding workspace unchanged.

**Current experiment state:** Phase A (public source/release inventory) reviewed; Phase B (static security/platform review) partial; Phase C (local A/B) NOT RUN / BLOCKED pending operator-side execution and measurements.

## 7. Upstream references

- ECC v2.2.3 release: https://github.com/affaan-m/ECC/releases/tag/v2.2.3
- Manual Adaptation Guide: https://github.com/affaan-m/ECC/blob/v2.2.3/docs/MANUAL-ADAPTATION-GUIDE.md
- Platform support: https://github.com/affaan-m/ECC#platform-support
- Memory Vault and trust boundaries: https://github.com/affaan-m/ECC#share-context-between-harnesses
- AgentShield security scan: https://github.com/affaan-m/ECC/blob/v2.2.3/commands/security-scan.md
- Native Windows observer defect: https://github.com/affaan-m/ECC/issues/2489
- Native Windows Memory Vault defect: https://github.com/affaan-m/ECC/issues/2626

**Reviewed:** 2026-11-06. Recheck upstream fixes before changing any exclusion or enabling runtime automation.
