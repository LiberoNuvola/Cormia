"""Bounded reference model for Cormia's four Core contracts.

This is an abstract contract test model, not a production Runtime, mandate
verifier, resource manager, payment ledger or community-support service.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import FrozenSet, Mapping


PROJECT_MODES = frozenset({"creator_team_led", "agent_led", "hybrid"})
PROJECT_STATES = frozenset({
    "draft", "configured", "active", "paused", "blocked", "completed", "archived"
})
AUTHORITY_STATES = frozenset({
    "active", "suspended", "expired", "revoked", "trust_failed"
})
RESOURCE_STATES = frozenset({
    "offered", "inspected", "accepted", "available", "exhausted",
    "revoked", "expired",
})


@dataclass(frozen=True)
class Project:
    project_ref: str
    leadership_mode: str
    steward_ref: str
    lifecycle_state: str
    authority_state: str
    mandate_operations: FrozenSet[str]


@dataclass(frozen=True)
class ExecutionEnvironment:
    local_model_available: bool = True
    local_resources_available: bool = True
    remote_provider_available: bool = False
    remote_lease_active: bool = False
    remote_privacy_accepted: bool = False
    # Optional integration health is deliberately outside the Core decision.
    optional_adapters: Mapping[str, bool] = field(default_factory=dict)
    host_policy_operations: FrozenSet[str] = frozenset({"read", "write", "test"})


@dataclass(frozen=True)
class ExecutionRequest:
    requested_operations: FrozenSet[str]
    mode: str = "local"
    explicit_remote_opt_in: bool = False


@dataclass(frozen=True)
class ResourceOffer:
    offer_id: str
    resource_type: str
    status: str
    validated: bool
    accepted_by_owner: bool
    available_capacity: int
    revoked: bool = False


@dataclass(frozen=True)
class FinancialSupport:
    contribution_id: str
    beneficiary_kind: str
    provider_status: str
    provider_confirmed: bool
    refunded_or_reversed: bool = False


def project_is_operable(project: Project) -> bool:
    """Project state and mandate state must both be active, independently."""
    return (
        bool(project.project_ref)
        and project.leadership_mode in PROJECT_MODES
        and bool(project.steward_ref)
        and project.lifecycle_state == "active"
        and project.authority_state == "active"
    )


def derive_child_authority(
    mandate_operations: FrozenSet[str],
    task_requested_operations: FrozenSet[str],
    host_policy_operations: FrozenSet[str],
) -> FrozenSet[str]:
    """A child grant is strict intersection, never an expansion."""
    return mandate_operations & task_requested_operations & host_policy_operations


def may_execute_core_task(
    project: Project,
    request: ExecutionRequest,
    environment: ExecutionEnvironment,
) -> bool:
    """Check local/explicit remote execution without any economic adapter.

    Optional payment, Cardano, token, CRC, AEP settlement and IMMORTAL flags
    are intentionally not inputs to this function.
    """
    if not project_is_operable(project):
        return False

    effective = derive_child_authority(
        project.mandate_operations,
        request.requested_operations,
        environment.host_policy_operations,
    )
    if not request.requested_operations or effective != request.requested_operations:
        return False

    if request.mode == "local":
        # Local means local: do not silently substitute a remote provider.
        return environment.local_model_available and environment.local_resources_available

    if request.mode == "remote":
        return (
            request.explicit_remote_opt_in
            and environment.remote_provider_available
            and environment.remote_lease_active
            and environment.remote_privacy_accepted
        )

    return False


def may_reserve_resource_offer(
    offer: ResourceOffer,
    requested_capacity: int,
) -> bool:
    """Offers are not usable until validated, owner-accepted and available."""
    return (
        bool(offer.offer_id)
        and offer.status == "available"
        and offer.validated
        and offer.accepted_by_owner
        and not offer.revoked
        and requested_capacity > 0
        and offer.available_capacity >= requested_capacity
    )


def support_grants_authority() -> bool:
    """A contribution is never an operational capability grant."""
    return False


def financial_support_is_confirmed_available(support: FinancialSupport) -> bool:
    """Pledges are not settled funds; provider is authoritative for status."""
    return (
        bool(support.contribution_id)
        and support.provider_status == "settled"
        and support.provider_confirmed
        and not support.refunded_or_reversed
        and support.beneficiary_kind in {"project", "named_custodian", "resource_pool"}
    )
