"""Bounded lifecycle/economic routing checks; not production conformance."""
import unittest

from transition_routing import TransitionRequest, route_transition


class LifecycleTransitionRoutingTests(unittest.TestCase):
    def route(self, event, perimeter="C2", effects=(), **kwargs):
        return route_transition(TransitionRequest(
            event=event,
            perimeter=perimeter,
            effects=frozenset(effects),
            **kwargs,
        ))

    def test_funding_cannot_be_misclassified_as_operational_only(self):
        result = self.route("funding", effects=())
        self.assertEqual(result.route, "BLOCKED_MISSING_REQUIRED_EFFECT")
        self.assertFalse(result.requires_immortal_gate)

    def test_funding_routes_escrow_lock_to_immortal_in_c2(self):
        result = self.route("funding", effects={"escrow_lock"})
        self.assertEqual(result.route, "IMMORTAL_GATE_REQUIRED")
        self.assertTrue(result.requires_immortal_gate)

    def test_assignment_without_bond_or_claim_is_task_only(self):
        result = self.route("assignment")
        self.assertEqual(result.route, "NO_GATE_OPERATIONAL_OR_TASK_ONLY")

    def test_assignment_with_worker_bond_routes_economic_effect(self):
        result = self.route("assignment", effects={"bond_lock"})
        self.assertEqual(result.route, "IMMORTAL_GATE_REQUIRED")

    def test_verifier_reward_claim_is_gated_when_it_accrues(self):
        result = self.route("verification", effects={"claim_accrual"})
        self.assertEqual(result.route, "IMMORTAL_GATE_REQUIRED")

    def test_submission_verification_and_challenge_window_do_not_gate_by_themselves(self):
        for event in ("submission", "verification", "challenge_window_open", "dispute_hold"):
            with self.subTest(event=event):
                result = self.route(event)
                self.assertEqual(result.route, "NO_GATE_OPERATIONAL_OR_TASK_ONLY")
                self.assertFalse(result.requires_immortal_gate)

    def test_challenge_bond_and_fee_accrual_are_gated(self):
        self.assertEqual(
            self.route("challenge_bond_lock", effects={"bond_lock"}).route,
            "IMMORTAL_GATE_REQUIRED",
        )
        self.assertEqual(
            self.route("fee_accrual", effects={"fee_accrual"}).route,
            "IMMORTAL_GATE_REQUIRED",
        )

    def test_settlement_refund_and_slash_require_their_economic_effects(self):
        self.assertEqual(self.route("settlement").route, "BLOCKED_MISSING_REQUIRED_EFFECT")
        self.assertEqual(
            self.route("settlement", effects={"settlement_release"}).route,
            "IMMORTAL_GATE_REQUIRED",
        )
        self.assertEqual(
            self.route("refund", effects={"refund"}).route,
            "IMMORTAL_GATE_REQUIRED",
        )
        self.assertEqual(
            self.route("slash", effects={"slash"}).route,
            "IMMORTAL_GATE_REQUIRED",
        )

    def test_failure_or_expiry_is_task_outcome_until_money_moves(self):
        for event in ("failure", "expired"):
            with self.subTest(event=event):
                self.assertEqual(self.route(event).route, "NO_GATE_OPERATIONAL_OR_TASK_ONLY")
        self.assertEqual(
            self.route("failure", effects={"refund"}).route,
            "IMMORTAL_GATE_REQUIRED",
        )

    def test_all_asset_effects_in_c0_or_c1_require_reclassification(self):
        effects = (
            "escrow_lock", "bond_lock", "claim_accrual", "fee_accrual",
            "settlement_release", "refund", "slash",
        )
        for perimeter in ("C0", "C1"):
            for effect in effects:
                with self.subTest(perimeter=perimeter, effect=effect):
                    result = self.route("claim_accrual", perimeter=perimeter, effects={effect})
                    self.assertEqual(result.route, "RECLASSIFICATION_REQUIRED")

    def test_c4_requires_independent_authority_not_immortal(self):
        result = self.route("funding", perimeter="C4", effects={"escrow_lock"})
        self.assertEqual(result.route, "INDEPENDENT_AUTHORITY_REQUIRED")
        self.assertFalse(result.requires_immortal_gate)

    def test_shared_economic_resource_outside_c3_must_be_reclassified(self):
        result = self.route(
            "shared_resource_reservation", perimeter="C2",
            effects={"shared_resource_reservation"},
        )
        self.assertEqual(result.route, "RECLASSIFICATION_TO_C3_REQUIRED")
        self.assertTrue(result.requires_joint_gate)

    def test_c3_fails_closed_without_partition_or_joint_certificate(self):
        result = self.route(
            "shared_resource_reservation", perimeter="C3",
            effects={"shared_resource_reservation"},
            canonical_resource_partition=True,
            joint_certificate=False,
        )
        self.assertEqual(result.route, "BLOCKED_CCOMP_INCOMPLETE")
        self.assertTrue(result.requires_joint_gate)

    def test_c3_routes_only_after_partition_and_joint_certificate(self):
        result = self.route(
            "shared_resource_reservation", perimeter="C3",
            effects={"shared_resource_reservation"},
            canonical_resource_partition=True,
            joint_certificate=True,
        )
        self.assertEqual(result.route, "IMMORTAL_JOINT_GATE_REQUIRED")
        self.assertTrue(result.requires_immortal_gate)
        self.assertTrue(result.requires_joint_gate)

    def test_unknown_transition_perimeter_and_effect_fail_closed(self):
        self.assertEqual(self.route("invented_event").route, "BLOCKED_UNKNOWN_TRANSITION")
        self.assertEqual(
            self.route("funding", perimeter="CX", effects={"escrow_lock"}).route,
            "BLOCKED_UNKNOWN_PERIMETER",
        )
        self.assertEqual(
            self.route("assignment", effects={"mystery"}).route,
            "BLOCKED_UNKNOWN_EFFECT",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
