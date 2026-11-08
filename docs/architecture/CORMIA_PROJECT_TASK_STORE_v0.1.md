# Cormia Durable Project Task Store v0.1

- **Date:** 2026-11-08
- **Status:** per-project durable queue/journal slice implemented; not yet integrated into a running Supervisor
- **Implementation:** \`runtime/core/project-task-store.mjs\`
- **Tests:** \`runtime/core/project-task-store.test.mjs\`
- **Parent architecture:** [General-Purpose Autonomous Agent & Mixed Community-Support Architecture](./CORMIA_GENERAL_PURPOSE_AUTONOMOUS_AGENT_AND_MIXED_SUPPORT_ARCHITECTURE_v0.1.md)
- **Execution priority:** [Multi-Project Autonomous Runtime](./CORMIA_MULTI_PROJECT_AUTONOMOUS_RUNTIME_v0.1.md)
- **Runtime composition:** [Project Runtime Composition v0.1](./CORMIA_PROJECT_RUNTIME_COMPOSITION_v0.1.md)

## 1. Purpose and ownership

Cormia needs its own durable task state so the Supervisor can queue, claim, checkpoint, recover and verify work independently for every registered project.

This store is deliberately separate from:
- the Project Lifecycle Journal, which records project lifecycle only;
- the user's IMMORTAL Local Agent Task Store v1, which remains owned by that Agent and read-only to Cormia.

This implementation does not migrate, modify or replay the IMMORTAL Agent's task data and does not change its \`/resume\` semantics.

## 2. Per-project journal contract

Create one store instance with a host-resolved absolute journal path and one project reference:

\`\`\`js
import { createProjectTaskStore } from "./project-task-store.mjs";

const store = createProjectTaskStore({
  journalPath: "/host-resolved/cormia/projects/immortal/tasks.ndjson",
  projectRef: "project:immortal"
});
\`\`\`

Every event is bound to that project. Opening the same journal under a different projectRef fails validation. The store is local-filesystem only and must not use an unqualified network share.

Task creation persists:
- taskRef and host-verified Task Manifest digest;
- task goal and source reference;
- maxAttempts, explicitly configured between 1 and 20;
- dependency task references, limited to already-created tasks in this project.

The store does not verify the Task Manifest. The host must verify the Task Authority before enqueueing or otherwise prevent an untrusted caller from writing tasks.

## 3. Task states

| State | Meaning |
|---|---|
| \`queued\` | Durable and eligible once dependencies are completed and attempts remain |
| \`running\` | Claimed by one worker for a specific attempt |
| \`blocked\` | Waiting for an explicit host-resolved dependency or policy condition |
| \`recovery_required\` | Was running at restart; side-effect state must be reconciled |
| \`completed\` | Terminal result recorded with evidence references |
| \`failed\` | Terminal attempt failure recorded |

A project lifecycle state is not inferred from any task state. A project's mandate or trust state is not inferred from task status.

## 4. Event and concurrency rules

The append-only journal supports:
- \`task_created\`;
- \`task_claimed\`;
- \`task_checkpointed\`;
- \`task_blocked\` and \`task_unblocked\`;
- \`task_interrupted\`;
- \`task_recovery_reconciled\`;
- \`task_completed\` and \`task_failed\`.

Each record includes project/task binding, contiguous sequence, state transition, attempt number, actor reference, reason, evidence references, timestamp, previous-event digest and SHA-256 record digest.

A process-local API is not enough for concurrency: the journal uses a local exclusive lock file and fsync, and mutations require the expected journal revision. Two workers attempting the same claim from one revision cannot both win. Reusing an eventId for the same intent is idempotent; reusing it for different intent is rejected.

Dependencies are accepted only when their task records already exist in the same journal; this produces an acyclic, backward-only task graph for v0.1. \`listRunnable()\` returns only queued tasks whose dependencies are all completed and whose attempt limit is not exhausted.

## 5. Restart and side-effect safety

At startup, the trusted Supervisor calls \`recoverInterruptedTasks()\`. Every task found in \`running\` is changed to \`recovery_required\`. The store never silently resets a running task to queued.

The trusted host must inspect external state and submit an evidence-backed reconciliation:
- \`safe_to_retry\`: queue the task again only if maxAttempts has not been exhausted and the host has reconciled possible side effects;
- \`confirmed_complete\`: mark completed only when evidence confirms the resulting external state;
- \`blocked\`: keep the task stopped until a separately resolved condition is cleared.

The task journal records this decision; it does not independently query Cardano, GitHub, filesystem operations or other external systems to establish side-effect truth. A model response is not recovery evidence.

The three checkpoint effect-boundary labels are:
- \`no_external_effects\`;
- \`idempotent_or_reconciled\`;
- \`unknown\`.

They annotate a checkpoint but do not independently authorize a retry. Restart always enters \`recovery_required\`, even where the last checkpoint appears safe.

## 6. File integrity and recovery

The journal has:
- SHA-256 record digests and a previous-event digest chain;
- contiguous sequence enforcement and deterministic replay;
- an exclusive \`.lock\` file with bounded lock wait;
- fsync on appended event records;
- explicit torn-tail inspection/repair;
- fail-closed behavior on complete malformed JSON, invalid digest, broken chain, wrong project binding or invalid transitions.

A stale lock is not automatically removed. A complete malformed/corrupted record is preserved for investigation. Only a final non-newline-terminated suffix can be truncated, and only through explicit \`recover({ repairTornTail: true })\`.

The v0.1 implementation caps the journal at 250,000 events. Snapshotting, compaction, retention, encrypted storage, backups and cross-host replication are not implemented. Task goals are persisted as local text: they must not contain credentials or secrets.

## 7. Tests and verification

The Node test suite covers:
- new instance replay and project binding;
- claim, checkpoint and completion persistence;
- startup interruption classification and explicit safe retry reconciliation;
- exhausted-attempt denial;
- dependency gating;
- concurrent claims with compare-and-set;
- idempotency conflict;
- explicit torn-tail repair;
- evidence-required completion and invalid transitions.

Run:

\`\`\`sh
node --check runtime/core/project-task-store.mjs
node --test runtime/core/project-task-store.test.mjs
node --test runtime/core/*.test.mjs
\`\`\`

CI evidence is linked from the multi-project runtime plan and will be updated after the current full run completes.

## 8. Explicit non-goals / next layer

The task store does not implement:
- a global Project Supervisor or fair multi-project scheduler;
- concurrency/resource quotas or durable Resource Leases;
- automatic worker/process launch or Windows service lifecycle;
- signed Task Manifest verification or production host identity;
- task-to-project routing (the separate Project Runtime Registry owns this boundary);
- task execution, model prompting, worktree operations, Git, CI or evidence verification.

Next, a host-only Project Supervisor must compose the project registry and one task store per project, recover interrupted tasks at startup, apply round-robin fairness with host-configured concurrency limits, and pass only verified task context into the corresponding Project Runtime. It must not take ownership of the IMMORTAL Agent's separate task store.
