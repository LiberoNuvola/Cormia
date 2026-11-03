"""Fail-closed routing model for AEP lifecycle/economic transitions.

This is a bounded reference model only. It does not implement AEP, IMMORTAL,
C-COMP, a production adapter, or an economic admission decision.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import FrozenSet, Mapping


PERIMETERS = frozenset({"C0", "C1", "C2", "C3", "C4"})

EFFECTS = frozenset({
    "escrow_lock",
    "bond_lock",
    "claim_accrual",
    "fee_accrual",
    "settlement_release",
    "refund",
    "slash",
    "shared_resource_reservation",
    "shared_resource_release",
})

SHARED_RESOURCE_EFFECTS = frozenset({
    "shared_resource_reservation",
    "shared_resource_release",
})

# These events are material by definition in the AEP lifecycle proposal.
# They fail closed when their corresponding economic effect is omitted.
REQUIRED_EFFECTS_BY_EVENT: Mapping[str, FrozenSet[str]] = {
    "funding": frozenset({"escrow_lock"}),
    "settlement": frozenset({"settlement_release"}),
    "refund": frozenset({"refund"}),
    "slash": frozenset({"slash"}),
    "shared_resource_reservation": frozenset({"shared_resource_reservation"}),
    "shared_resource_release": frozenset({"shared_resource_release"}),
}

NON_ECONOMIC_OR_CONDITIONAL_EVENTS = frozenset({
    "draft",
    "open",
    "assignment",
    "running",
    "submission",
    "verifier_selection",
    "verification",
    "challenge_window_open",
    "challenge_submitted",
    "dispute_hold",
    "failure",
    "expired",
    "task_closed",
    "evidence_recorded",
    "observation",
})
KNOWN_EVENTS = frozenset(REQUIRED_EFFECTS_BY_EVENT) | NON_ECONOMIC_OR_CONDITIONAL_EVENTS | frozenset({
    "worker_bond_lock",
    "verifier_bond_lock",
    "challenge_bond_lock",
    "claim_accrual",
    "fee_accrual",
})


@dataclass(frozen=True)
class TransitionRequest:
    event: str
    perimeter: str
    effects: FrozenSet[str] = frozenset()
    canonical_resource_partition: bool = False
    joint_certificate: bool = False


@dataclass(frozen=True)
class RoutingDecision:
    route: str
    requires_immortal_gate: bool
    requires_joint_gate: bool
    reason: str


def route_transition(request: TransitionRequest) -> RoutingDecision:
    """Choose the authority route; never returns an economic admission."""
    if request.event not in KNOWN_EVENTS:
        return RoutingDecision(
            "BLOCKED_UNKNOWN_TRANSITION", False, False,
            "Unknown event: fail closed until the lifecycle mapping is reviewed.",
        )
    if request.perimeter not in PERIMETERS:
        return RoutingDecision(
            "BLOCKED_UNKNOWN_PERIMETER", False, False,
            "Unknown perimeter: fail closed; do not infer an economic jurisdiction.",
        )
    if not request.effects <= EFFECTS:
        return RoutingDecision(
            "BLOCKED_UNKNOWN_EFFECT", False, False,
            "Unknown economic effect: fail closed until it is classified.",
        )

    required = REQUIRED_EFFECTS_BY_EVENT.get(request.event, frozenset())
    if not required <= request.effects:
        return RoutingDecision(
            "BLOCKED_MISSING_REQUIRED_EFFECT", False, False,
            "The event is missing a required economic effect; do not route it as operational-only.",
        )

    if not request.effects:
        return RoutingDecision(
            "NO_GATE_OPERATIONAL_OR_TASK_ONLY", False, False,
            "No material economic effect is declared; Cormia retains the task transition.",
        )

    if request.perimeter in {"C0", "C1"}:
        return RoutingDecision(
            "RECLASSIFICATION_REQUIRED", False, False,
            "An asset obligation, claim, transfer, or shared economic commitment is outside C0/C1; reclassify before execution.",
        )

    if request.perimeter == "C4":
        return RoutingDecision(
            "INDEPENDENT_AUTHORITY_REQUIRED", False, False,
            "C4 must use its own declared authority and complete safety/solvency perimeter; IMMORTAL admission is not implied.",
        )

    if SHARED_RESOURCE_EFFECTS.intersection(request.effects) and request.perimeter != "C3":
        return RoutingDecision(
            "RECLASSIFICATION_TO_C3_REQUIRED", False, True,
            "A cross-system shared economic resource requires the C3 perimeter and C-COMP.",
        )

    if request.perimeter == "C2":
        return RoutingDecision(
            "IMMORTAL_GATE_REQUIRED", True, False,
            "Route the asset-denominated transition to the applicable IMMORTAL application-profile gate.",
        )

    # C3: local approvals are insufficient for a shared/coupled economic resource.
    if not request.canonical_resource_partition or not request.joint_certificate:
        return RoutingDecision(
            "BLOCKED_CCOMP_INCOMPLETE", True, True,
            "C-COMP prerequisites are incomplete: require a canonical exhaustive partition and joint certificate before the joint gate.",
        )
    return RoutingDecision(
        "IMMORTAL_JOINT_GATE_REQUIRED", True, True,
        "Route the composed transition to a joint gate covering concurrent cross-system actions.",
    )
