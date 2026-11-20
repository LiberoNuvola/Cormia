"""Finite reference model for the proposed Cormia / IMMORTAL boundary.

This is an abstract specification harness. It does not import or execute Cormia
Runtime, AEP validators, IMMORTAL kernel, a ledger adapter, or a key provider.
Its results apply only to the small finite model defined here.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import FrozenSet, Iterable, Mapping, Sequence


@dataclass(frozen=True)
class SettlementEvidence:
    task_id: str
    expected_task_id: str
    manifest_digest: str
    evidence_manifest_digest: str
    delivery_digest: str
    evidence_delivery_digest: str
    evidence_complete: bool
    verifier_verdict: str
    challenge_status: str
    immortal_scope: bool
    gate_result: str
    gate_manifest_digest: str
    gate_transition_id: str
    expected_transition_id: str


def settlement_admissible(evidence: SettlementEvidence) -> bool:
    """Return true only for exact evidence binding and all required gates."""
    if evidence.task_id != evidence.expected_task_id:
        return False
    if not evidence.manifest_digest or evidence.manifest_digest != evidence.evidence_manifest_digest:
        return False
    if not evidence.delivery_digest or evidence.delivery_digest != evidence.evidence_delivery_digest:
        return False
    if not evidence.evidence_complete:
        return False
    if evidence.verifier_verdict != "verified":
        return False
    if evidence.challenge_status != "closed":
        return False
    if evidence.immortal_scope:
        if evidence.gate_result != "admit":
            return False
        if evidence.gate_manifest_digest != evidence.manifest_digest:
            return False
        if evidence.gate_transition_id != evidence.expected_transition_id:
            return False
    return True


def derive_child_capabilities(
    parent: FrozenSet[str],
    requested: FrozenSet[str],
    task_scope: FrozenSet[str],
    host_policy: FrozenSet[str],
) -> FrozenSet[str]:
    """Child authority is the intersection, never a widening."""
    return parent & requested & task_scope & host_policy


ROLE_ACTIONS: Mapping[str, FrozenSet[str]] = {
    "model": frozenset({"propose"}),
    "observer": frozenset({"observe"}),
    "worker": frozenset({"execute_with_capability"}),
    "verifier": frozenset({"submit_verdict"}),
    "aep_engine": frozenset({"advance_task_state"}),
    "immortal_gate": frozenset({"admit_economic_transition"}),
    "adapter": frozenset({"serialize_admitted_transition"}),
}


def role_allows(role: str, action: str) -> bool:
    return action in ROLE_ACTIONS.get(role, frozenset())


def adapter_may_submit(gate_result: str, transition_id: str, admitted_transition_id: str) -> bool:
    """The adapter may realize only the exact transition already admitted."""
    return (
        gate_result == "admit"
        and bool(transition_id)
        and transition_id == admitted_transition_id
    )


def joint_resource_admissible(capacity: int, draws: Sequence[int]) -> bool:
    """A joint action is safe only when all simultaneous draws fit the resource."""
    return capacity >= 0 and all(draw >= 0 for draw in draws) and sum(draws) <= capacity


def canonical_partition_admissible(
    shared_resource_id: str,
    references: Sequence[str],
    capacity: int,
    assigned_shares: Sequence[int],
) -> bool:
    """All participants name one canonical resource and receive non-overlapping shares."""
    return (
        bool(shared_resource_id)
        and bool(references)
        and all(ref == shared_resource_id for ref in references)
        and capacity >= 0
        and all(share >= 0 for share in assigned_shares)
        and sum(assigned_shares) <= capacity
    )


def reservation_admissible(
    capacity: int,
    existing_reservations: Iterable[int],
    candidate_reservations: Iterable[int],
) -> bool:
    """Aggregate commitments, not independent stale local approvals, govern admission."""
    values = list(existing_reservations) + list(candidate_reservations)
    return (
        capacity >= 0
        and all(value >= 0 for value in values)
        and sum(values) <= capacity
    )


@dataclass(frozen=True)
class Worker:
    worker_id: str
    capabilities: FrozenSet[str]
    privacy_classes: FrozenSet[str]
    assurance_profiles: FrozenSet[str]
    capacity: int


@dataclass(frozen=True)
class TaskDemand:
    task_id: str
    capabilities: FrozenSet[str]
    privacy_class: str
    assurance_profile: str


def allocate_feasible(
    tasks: Sequence[TaskDemand],
    workers: Sequence[Worker],
) -> Mapping[str, str]:
    """Deterministic feasibility allocator used only to check eligibility/capacity.

    Lexicographic ordering is a test tie-break, not a proposed production scheduler
    or fairness policy.
    """
    used: dict[str, int] = {worker.worker_id: 0 for worker in workers}
    result: dict[str, str] = {}
    for task in sorted(tasks, key=lambda item: item.task_id):
        eligible = [
            worker for worker in workers
            if task.capabilities <= worker.capabilities
            and task.privacy_class in worker.privacy_classes
            and task.assurance_profile in worker.assurance_profiles
            and used[worker.worker_id] < worker.capacity
        ]
        if not eligible:
            continue
        selected = sorted(eligible, key=lambda item: item.worker_id)[0]
        result[task.task_id] = selected.worker_id
        used[selected.worker_id] += 1
    return result
