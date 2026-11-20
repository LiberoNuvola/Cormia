"""Bounded exhaustive checks for the Cormia / IMMORTAL reference model."""
from dataclasses import replace
from itertools import product
import unittest

from reference_model import (
    SettlementEvidence,
    Worker,
    TaskDemand,
    adapter_may_submit,
    allocate_feasible,
    canonical_partition_admissible,
    derive_child_capabilities,
    joint_resource_admissible,
    reservation_admissible,
    role_allows,
    settlement_admissible,
)


class EvidenceInputTests(unittest.TestCase):
    def valid_evidence(self, **changes):
        item = SettlementEvidence(
            task_id="task-1",
            expected_task_id="task-1",
            manifest_digest="manifest-A",
            evidence_manifest_digest="manifest-A",
            delivery_digest="delivery-A",
            evidence_delivery_digest="delivery-A",
            evidence_complete=True,
            verifier_verdict="verified",
            challenge_status="closed",
            immortal_scope=True,
            gate_result="admit",
            gate_manifest_digest="manifest-A",
            gate_transition_id="transition-1",
            expected_transition_id="transition-1",
        )
        return replace(item, **changes)

    def test_complete_settlement_predicate_exhaustively(self):
        outcomes = ("verified", "invalid", "inconclusive")
        challenges = ("closed", "open", "disputed")
        gates = ("admit", "deny", "unknown")
        for complete, verdict, challenge, gate in product(
            (False, True), outcomes, challenges, gates
        ):
            candidate = self.valid_evidence(
                evidence_complete=complete,
                verifier_verdict=verdict,
                challenge_status=challenge,
                gate_result=gate,
            )
            expected = (
                complete
                and verdict == "verified"
                and challenge == "closed"
                and gate == "admit"
            )
            self.assertEqual(settlement_admissible(candidate), expected)

    def test_receipt_alone_is_not_enough(self):
        candidate = self.valid_evidence(
            evidence_complete=False,
            verifier_verdict="inconclusive",
            challenge_status="open",
        )
        self.assertFalse(settlement_admissible(candidate))

    def test_manifest_delivery_and_gate_are_exactly_bound(self):
        mutations = (
            {"task_id": "task-2"},
            {"evidence_manifest_digest": "manifest-B"},
            {"evidence_delivery_digest": "delivery-B"},
            {"gate_manifest_digest": "manifest-B"},
            {"gate_transition_id": "transition-2"},
        )
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                self.assertFalse(settlement_admissible(self.valid_evidence(**mutation)))

    def test_non_immortal_local_task_does_not_require_immortal_gate(self):
        candidate = self.valid_evidence(
            immortal_scope=False,
            gate_result="unknown",
            gate_manifest_digest="",
            gate_transition_id="",
        )
        self.assertTrue(settlement_admissible(candidate))


class AuthoritySeparationTests(unittest.TestCase):
    def test_child_grant_is_attenuated_by_all_four_sets(self):
        parent = frozenset({"read", "write", "test", "network"})
        requested = frozenset({"read", "write", "delete"})
        task_scope = frozenset({"read", "write", "test"})
        host_policy = frozenset({"read", "test", "network"})
        child = derive_child_capabilities(parent, requested, task_scope, host_policy)
        self.assertEqual(child, frozenset({"read"}))
        self.assertTrue(child <= parent)
        self.assertTrue(child <= task_scope)
        self.assertTrue(child <= host_policy)

    def test_only_economic_gate_can_admit_economic_transition(self):
        for role in ROLE_ACTIONS_FOR_TEST:
            with self.subTest(role=role):
                expected = role == "immortal_gate"
                self.assertEqual(role_allows(role, "admit_economic_transition"), expected)

    def test_verifier_and_observer_cannot_settle_or_authorize(self):
        for role in ("model", "observer", "worker", "verifier", "adapter"):
            self.assertFalse(role_allows(role, "admit_economic_transition"))
            self.assertFalse(role_allows(role, "advance_task_state"))

    def test_adapter_can_submit_only_the_admitted_transition(self):
        self.assertTrue(adapter_may_submit("admit", "tx-1", "tx-1"))
        self.assertFalse(adapter_may_submit("deny", "tx-1", "tx-1"))
        self.assertFalse(adapter_may_submit("admit", "tx-2", "tx-1"))


ROLE_ACTIONS_FOR_TEST = (
    "model", "observer", "worker", "verifier", "aep_engine", "immortal_gate", "adapter"
)


class EconomicExposureTests(unittest.TestCase):
    def test_two_individually_safe_draws_can_fail_joint_gate(self):
        capacity = 1
        self.assertTrue(joint_resource_admissible(capacity, (1,)))
        self.assertTrue(joint_resource_admissible(capacity, (1,)))
        self.assertFalse(joint_resource_admissible(capacity, (1, 1)))

    def test_shared_resource_partition_is_canonical_and_non_overlapping(self):
        self.assertTrue(
            canonical_partition_admissible("reserve-1", ("reserve-1", "reserve-1"), 10, (4, 6))
        )
        self.assertFalse(
            canonical_partition_admissible("reserve-1", ("reserve-A", "reserve-B"), 10, (4, 6))
        )
        self.assertFalse(
            canonical_partition_admissible("reserve-1", ("reserve-1", "reserve-1"), 10, (7, 6))
        )

    def test_concurrent_reservations_are_aggregated(self):
        capacity = 10
        self.assertTrue(reservation_admissible(capacity, (2,), (5,)))
        self.assertFalse(reservation_admissible(capacity, (2,), (5, 4)))

    def test_invalid_or_negative_reservations_fail_closed(self):
        self.assertFalse(reservation_admissible(10, (2,), (-1,)))
        self.assertFalse(reservation_admissible(10, (11,), (0,)))


class AllocationTests(unittest.TestCase):
    def test_assignment_respects_capability_privacy_and_assurance(self):
        workers = (
            Worker("worker-a", frozenset({"build"}), frozenset({"P0"}), frozenset({"A2"}), 1),
            Worker("worker-b", frozenset({"build", "test"}), frozenset({"P0", "P1"}), frozenset({"A2", "A3"}), 1),
        )
        tasks = (
            TaskDemand("task-1", frozenset({"build", "test"}), "P0", "A3"),
            TaskDemand("task-2", frozenset({"build"}), "P1", "A2"),
        )
        result = allocate_feasible(tasks, workers)
        self.assertEqual(result, {"task-1": "worker-b"})
        # The second task is left unassigned because the only eligible worker is full.
        self.assertLessEqual(sum(worker == "worker-b" for worker in result.values()), 1)

    def test_capacity_prevents_double_assignment(self):
        workers = (
            Worker("worker-a", frozenset({"infer"}), frozenset({"P1"}), frozenset({"A1"}), 1),
        )
        tasks = (
            TaskDemand("task-1", frozenset({"infer"}), "P1", "A1"),
            TaskDemand("task-2", frozenset({"infer"}), "P1", "A1"),
        )
        result = allocate_feasible(tasks, workers)
        self.assertEqual(len(result), 1)

    def test_scheduler_feasibility_does_not_grant_economic_authority(self):
        self.assertTrue(role_allows("aep_engine", "advance_task_state"))
        self.assertFalse(role_allows("aep_engine", "admit_economic_transition"))
        self.assertFalse(role_allows("adapter", "admit_economic_transition"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
