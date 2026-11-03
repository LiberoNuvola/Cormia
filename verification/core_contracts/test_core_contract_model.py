"""Bounded conformance tests for the Cormia Core contract proposal."""
import unittest
from dataclasses import replace

from core_contract_model import (
    ExecutionEnvironment,
    ExecutionRequest,
    FinancialSupport,
    Project,
    ResourceOffer,
    derive_child_authority,
    financial_support_is_confirmed_available,
    may_execute_core_task,
    may_reserve_resource_offer,
    project_is_operable,
    support_grants_authority,
)


class ProjectAuthorityContractTests(unittest.TestCase):
    def project(self, **changes):
        base = Project(
            project_ref="project-1",
            leadership_mode="creator_team_led",
            steward_ref="steward-1",
            lifecycle_state="active",
            authority_state="active",
            mandate_operations=frozenset({"read", "write", "test"}),
        )
        return replace(base, **changes)

    def test_host_policy_can_narrow_a_valid_project_mandate(self):
        env = ExecutionEnvironment(
            host_policy_operations=frozenset({"read", "test"})
        )
        self.assertFalse(may_execute_core_task(
            self.project(),
            ExecutionRequest(frozenset({"write"})),
            env,
        ))
        self.assertTrue(may_execute_core_task(
            self.project(),
            ExecutionRequest(frozenset({"read"})),
            env,
        ))

    def test_same_core_supports_all_three_leadership_modes(self):
        for mode in ("creator_team_led", "agent_led", "hybrid"):
            with self.subTest(mode=mode):
                project = self.project(leadership_mode=mode)
                request = ExecutionRequest(frozenset({"read"}))
                self.assertTrue(may_execute_core_task(
                    project, request, ExecutionEnvironment()
                ))

    def test_agent_led_project_requires_steward_and_active_mandate(self):
        project = self.project(leadership_mode="agent_led", steward_ref="")
        self.assertFalse(project_is_operable(project))
        project = self.project(leadership_mode="agent_led", authority_state="revoked")
        self.assertFalse(project_is_operable(project))

    def test_project_and_authority_lifecycles_are_independent(self):
        self.assertFalse(project_is_operable(self.project(lifecycle_state="paused")))
        self.assertFalse(project_is_operable(self.project(authority_state="suspended")))
        self.assertTrue(project_is_operable(self.project(lifecycle_state="active")))

    def test_non_active_project_cannot_start_new_work(self):
        for state in ("draft", "configured", "paused", "blocked", "completed", "archived"):
            with self.subTest(state=state):
                self.assertFalse(may_execute_core_task(
                    self.project(lifecycle_state=state),
                    ExecutionRequest(frozenset({"read"})),
                    ExecutionEnvironment(),
                ))

    def test_expired_revoked_or_trust_failed_mandate_blocks_work(self):
        for state in ("suspended", "expired", "revoked", "trust_failed"):
            with self.subTest(state=state):
                self.assertFalse(may_execute_core_task(
                    self.project(authority_state=state),
                    ExecutionRequest(frozenset({"read"})),
                    ExecutionEnvironment(),
                ))

    def test_child_authority_is_intersection_of_all_three_bounds(self):
        child = derive_child_authority(
            frozenset({"read", "write", "test"}),
            frozenset({"read", "write", "delete"}),
            frozenset({"read", "test", "network"}),
        )
        self.assertEqual(child, frozenset({"read"}))
        self.assertTrue(child <= frozenset({"read", "write", "test"}))
        self.assertTrue(child <= frozenset({"read", "write", "delete"}))
        self.assertTrue(child <= frozenset({"read", "test", "network"}))

    def test_task_cannot_expand_mandate_or_host_policy(self):
        request = ExecutionRequest(frozenset({"read", "wallet.sign"}))
        self.assertFalse(may_execute_core_task(
            self.project(), request, ExecutionEnvironment()
        ))


class CoreIndependenceTests(unittest.TestCase):
    def project(self):
        return Project(
            "project-2", "agent_led", "steward-2", "active", "active",
            frozenset({"read", "write", "test"}),
        )

    def test_local_core_runs_with_no_optional_adapters(self):
        self.assertTrue(may_execute_core_task(
            self.project(),
            ExecutionRequest(frozenset({"read", "write", "test"})),
            ExecutionEnvironment(optional_adapters={}),
        ))

    def test_local_core_is_independent_of_optional_adapter_health(self):
        names = ("payment", "cardano", "token", "crc", "aep", "immortal")
        for mask in range(1 << len(names)):
            adapters = {name: bool(mask & (1 << i)) for i, name in enumerate(names)}
            with self.subTest(adapters=adapters):
                self.assertTrue(may_execute_core_task(
                    self.project(),
                    ExecutionRequest(frozenset({"read"})),
                    ExecutionEnvironment(optional_adapters=adapters),
                ))

    def test_unavailable_local_model_does_not_silently_fallback_to_remote(self):
        env = ExecutionEnvironment(
            local_model_available=False,
            local_resources_available=True,
            remote_provider_available=True,
            remote_lease_active=True,
            remote_privacy_accepted=True,
        )
        self.assertFalse(may_execute_core_task(
            self.project(),
            ExecutionRequest(frozenset({"read"}), mode="local"),
            env,
        ))

    def test_remote_execution_requires_explicit_opt_in_and_active_lease(self):
        env = ExecutionEnvironment(
            remote_provider_available=True,
            remote_lease_active=True,
            remote_privacy_accepted=True,
        )
        self.assertFalse(may_execute_core_task(
            self.project(),
            ExecutionRequest(frozenset({"read"}), mode="remote"),
            env,
        ))
        self.assertTrue(may_execute_core_task(
            self.project(),
            ExecutionRequest(
                frozenset({"read"}), mode="remote", explicit_remote_opt_in=True
            ),
            env,
        ))

    def test_remote_execution_fails_without_privacy_acceptance(self):
        env = ExecutionEnvironment(
            remote_provider_available=True,
            remote_lease_active=True,
            remote_privacy_accepted=False,
        )
        self.assertFalse(may_execute_core_task(
            self.project(),
            ExecutionRequest(
                frozenset({"read"}), mode="remote", explicit_remote_opt_in=True
            ),
            env,
        ))


class ResourceProviderContractTests(unittest.TestCase):
    def offer(self, **changes):
        base = ResourceOffer(
            offer_id="offer-1",
            resource_type="compute.cpu",
            status="available",
            validated=True,
            accepted_by_owner=True,
            available_capacity=4,
            revoked=False,
        )
        return replace(base, **changes)

    def test_unaccepted_or_unvalidated_offer_is_not_available(self):
        self.assertFalse(may_reserve_resource_offer(
            self.offer(status="offered", accepted_by_owner=False), 1
        ))
        self.assertFalse(may_reserve_resource_offer(
            self.offer(validated=False), 1
        ))
        self.assertFalse(may_reserve_resource_offer(
            self.offer(accepted_by_owner=False), 1
        ))

    def test_only_accepted_available_capacity_can_be_reserved(self):
        self.assertTrue(may_reserve_resource_offer(self.offer(), 4))
        self.assertFalse(may_reserve_resource_offer(self.offer(), 5))
        self.assertFalse(may_reserve_resource_offer(self.offer(), 0))

    def test_revoked_or_expired_offer_cannot_be_reserved(self):
        self.assertFalse(may_reserve_resource_offer(
            self.offer(revoked=True), 1
        ))
        self.assertFalse(may_reserve_resource_offer(
            self.offer(status="expired"), 1
        ))

    def test_resource_offer_does_not_create_task_authority(self):
        self.assertTrue(may_reserve_resource_offer(self.offer(), 1))
        self.assertFalse(support_grants_authority())


class CommunitySupportContractTests(unittest.TestCase):
    def support(self, **changes):
        base = FinancialSupport(
            contribution_id="contribution-1",
            beneficiary_kind="project",
            provider_status="pledged",
            provider_confirmed=False,
            refunded_or_reversed=False,
        )
        return replace(base, **changes)

    def test_pledge_is_not_reported_as_settled_available_funds(self):
        self.assertFalse(financial_support_is_confirmed_available(self.support()))

    def test_provider_confirmed_settlement_is_recorded_for_project(self):
        support = self.support(
            provider_status="settled",
            provider_confirmed=True,
        )
        self.assertTrue(financial_support_is_confirmed_available(support))

    def test_refunded_or_reversed_contribution_is_not_available(self):
        support = self.support(
            provider_status="settled",
            provider_confirmed=True,
            refunded_or_reversed=True,
        )
        self.assertFalse(financial_support_is_confirmed_available(support))

    def test_agent_personal_wallet_is_not_a_default_beneficiary(self):
        support = self.support(
            beneficiary_kind="agent_personal",
            provider_status="settled",
            provider_confirmed=True,
        )
        self.assertFalse(financial_support_is_confirmed_available(support))

    def test_financial_or_in_kind_support_never_grants_authority(self):
        self.assertFalse(support_grants_authority())


if __name__ == "__main__":
    unittest.main(verbosity=2)
