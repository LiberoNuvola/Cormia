#!/usr/bin/env python3
"""Tests for PNC loader, source drift classifier and deterministic policy."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from pnc_runtime import (  # noqa: E402
    PncError, classify_contract_delta, classify_source_drift, evaluate_policy,
    load_json_strict, load_pnc, semantic_errors, validate_contract,
)

CONTRACT = ROOT / "examples/project-normative-contracts/immortal-protocol-v0.1.json"
SCHEMA = ROOT / "schemas/project-normative-contract-v0.1.schema.json"


class FakeResolver:
    def __init__(self, contract, wrong=None):
        self.contract, self.wrong = contract, wrong

    def resolve_commit(self, repository, commit_sha):
        return {
            "repositoryFullName": "wrong/repo" if self.wrong == "repo" else repository,
            "commitSha": "0" * 40 if self.wrong == "commit" else commit_sha,
        }

    def get_blob_sha(self, repository, commit_sha, path):
        item = next(x for x in self.contract["sources"] if x["path"] == path)
        return "0" * 40 if self.wrong == "blob" else item["blobSha"]


class PncRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
        cls.schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        cls.set_id = cls.contract["sourceSnapshots"][0]["sourceSetId"]

    def load(self, wrong=None):
        return load_pnc(
            CONTRACT, SCHEMA, resolver=FakeResolver(self.contract, wrong),
            expected_repository="LiberoNuvola/Immortal-Protocol", require_active=False,
        )

    def evaluate(self, **kwargs):
        return evaluate_policy(self.contract, source_integrity_verified=True, task_kind="bug-fix", **kwargs)

    def test_schema_and_semantic_validation(self):
        self.assertEqual(validate_contract(self.contract, self.schema), [])

    def test_loader_verifies_all_pins_and_does_not_activate_draft(self):
        loaded = self.load()
        self.assertEqual(loaded["verifiedSourceCount"], len(self.contract["sources"]))
        self.assertEqual(len(loaded["verifiedSourceSets"]), 1)
        with self.assertRaisesRegex(PncError, "requires 'active'"):
            load_pnc(CONTRACT, SCHEMA, resolver=FakeResolver(self.contract))

    def test_loader_rejects_wrong_repository_commit_and_blob(self):
        for mismatch, expected in (("repo", "different repository"), ("commit", "commit SHA mismatch"), ("blob", "blob SHA mismatch")):
            with self.subTest(mismatch=mismatch), self.assertRaisesRegex(PncError, expected):
                self.load(mismatch)

    def test_loader_rejects_runtime_repository_mismatch(self):
        with self.assertRaisesRegex(PncError, "does not match"):
            load_pnc(CONTRACT, SCHEMA, resolver=FakeResolver(self.contract),
                     expected_repository="LiberoNuvola/Cormia", require_active=False)

    def test_duplicate_source_id_is_rejected(self):
        candidate = copy.deepcopy(self.contract)
        candidate["sources"][1]["sourceId"] = candidate["sources"][0]["sourceId"]
        self.assertTrue(any("duplicate sourceId" in e for e in semantic_errors(candidate)))

    def test_duplicate_json_object_keys_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "duplicate.json"
            path.write_text('{"status":"draft","status":"active"}', encoding="utf-8")
            with self.assertRaisesRegex(PncError, "duplicate JSON object key"):
                load_json_strict(path)

    def test_routine_implementation_change_is_allowed(self):
        drift = classify_source_drift(self.contract, self.set_id, ["src/runtime/worker.py"])
        self.assertEqual(drift["kind"], "implementation-only")
        self.assertEqual(self.evaluate(drift=drift)["action"], "ALLOW")

    def test_normative_source_change_escalates(self):
        drift = classify_source_drift(self.contract, self.set_id, ["docs/00-normative/01_CONSTITUTION_FINAL.md"])
        result = self.evaluate(drift=drift)
        self.assertEqual(drift["kind"], "normative-source-change")
        self.assertEqual(result["action"], "ESCALATE")
        self.assertEqual(result["reasonCode"], "PNC_NORMATIVE_SOURCE_CHANGED")

    def test_evidence_status_change_is_non_authoritative_overlay(self):
        path = next(x["path"] for x in self.contract["sources"] if x["authorityClass"] == "audit-status-record")
        drift = classify_source_drift(self.contract, self.set_id, [path, "src/tests/report.py"])
        result = evaluate_policy(self.contract, source_integrity_verified=True,
                                 task_kind="evidence-collection", drift=drift)
        self.assertEqual(drift["kind"], "evidence-status-only")
        self.assertEqual(result["action"], "ALLOW")
        self.assertTrue(result["nonAuthoritativeOverlay"])

    def test_unregistered_document_escalates(self):
        drift = classify_source_drift(self.contract, self.set_id, ["docs/new-policy.md"])
        self.assertEqual(drift["kind"], "unclassified-source-change")
        self.assertEqual(self.evaluate(drift=drift)["action"], "ESCALATE")

    def test_evidence_collection_is_allowed(self):
        result = evaluate_policy(self.contract, source_integrity_verified=True, task_kind="evidence-collection")
        self.assertEqual(result["action"], "ALLOW")

    def test_invariant_weakening_escalates(self):
        candidate = copy.deepcopy(self.contract)
        candidate["invariants"][0]["statement"] = "An operator may obtain discretionary economic authority."
        delta = classify_contract_delta(self.contract, candidate)
        self.assertEqual(delta["kind"], "invariant-change")
        self.assertEqual(self.evaluate(contract_delta=delta)["action"], "ESCALATE")

    def test_closed_decision_reopening_escalates(self):
        candidate = copy.deepcopy(self.contract)
        candidate["closedDecisions"][0]["statement"] += " Reopened."
        delta = classify_contract_delta(self.contract, candidate)
        self.assertEqual(delta["kind"], "closed-decision-change")
        self.assertEqual(self.evaluate(contract_delta=delta)["reasonCode"], "PNC_CLOSED_DECISION_REOPENING")

    def test_ambiguous_same_tier_conflict_escalates(self):
        result = self.evaluate(same_tier_conflict=True)
        self.assertEqual(result["action"], "ESCALATE")
        self.assertEqual(result["reasonCode"], "PNC_UNRESOLVED_SAME_TIER_CONFLICT")

    def test_stale_source_integrity_fails_closed(self):
        result = evaluate_policy(self.contract, source_integrity_verified=False, task_kind="bug-fix")
        self.assertEqual(result["action"], "DENY")
        self.assertEqual(result["reasonCode"], "PNC_SOURCE_INTEGRITY_UNVERIFIED")

    def test_evidence_promotion_is_denied(self):
        result = evaluate_policy(self.contract, source_integrity_verified=True,
                                 task_kind="evidence-classification",
                                 semantic_facts={"evidence_promotion": True})
        self.assertEqual(result["action"], "DENY")
        self.assertEqual(result["reasonCode"], "PNC_EVIDENCE_PROMOTION_FORBIDDEN")

    def test_independent_tasks_continue_when_one_task_escalates(self):
        result = self.evaluate(semantic_facts={"invariant_change": True})
        self.assertTrue(result["affectedTaskSuspended"])
        self.assertTrue(result["continueIndependentTasks"])

    def test_protected_external_action_is_denied(self):
        result = self.evaluate(semantic_facts={"protected_external_action": True})
        self.assertEqual(result["action"], "DENY")


if __name__ == "__main__":
    unittest.main(verbosity=2)
