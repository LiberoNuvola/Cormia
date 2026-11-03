"""JSON Schema conformance tests for versioned Cormia Core records."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker, ValidationError


ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT / "schemas" / "core"
NOW = "2026-11-03T12:00:00Z"
DIGEST = "sha256:" + ("a" * 64)


def load_schema(name: str) -> dict:
    with (SCHEMA_DIR / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


class CoreJsonSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema_names = {
            "project": "project-descriptor-v0.1.schema.json",
            "lifecycle": "project-lifecycle-record-v0.1.schema.json",
            "event": "project-lifecycle-event-v0.1.schema.json",
            "offer": "resource-offer-v0.1.schema.json",
            "lease": "resource-lease-v0.1.schema.json",
            "financial": "financial-support-contribution-v0.1.schema.json",
            "in_kind": "in-kind-support-contribution-v0.1.schema.json",
        }
        cls.schemas = {key: load_schema(name) for key, name in cls.schema_names.items()}
        cls.validators = {
            key: Draft202012Validator(schema, format_checker=FormatChecker())
            for key, schema in cls.schemas.items()
        }

    def assert_valid(self, kind: str, instance: dict):
        self.validators[kind].validate(instance)

    def assert_invalid(self, kind: str, instance: dict):
        with self.assertRaises(ValidationError):
            self.assert_valid(kind, instance)

    @staticmethod
    def project_descriptor():
        return {
            "schemaVersion": "0.1.0",
            "recordType": "cormia.core.project-descriptor",
            "projectRef": "project:cormia-demo",
            "displayName": "Cormia Demo",
            "leadershipMode": "agent_led",
            "stewardRef": "principal:steward-1",
            "accountabilityRef": "accountability:project-board-1",
            "mandateRef": {
                "mandateId": "mandate-1",
                "claimsSchemaId": "urn:immortal-aep:schema:local-autonomous-project-mandate:0.1.0",
                "claimsDigest": DIGEST,
            },
            "missionRef": "mission:core-demo",
            "visibilityPolicyRef": "policy:public-project",
            "createdAt": NOW,
            "updatedAt": NOW,
            "revision": 1,
        }

    @staticmethod
    def lifecycle_record():
        return {
            "schemaVersion": "0.1.0",
            "recordType": "cormia.core.project-lifecycle-record",
            "projectRef": "project:cormia-demo",
            "state": "active",
            "revision": 3,
            "updatedAt": NOW,
            "journalRef": {
                "journalId": "journal:projects",
                "streamId": "project:cormia-demo",
                "sequence": 3,
                "recordDigest": DIGEST,
                "storageRef": "local-journal:projects/project:cormia-demo",
            },
            "lastEventRef": "event:project:cormia-demo/3",
        }

    @staticmethod
    def lifecycle_event():
        return {
            "schemaVersion": "0.1.0",
            "recordType": "cormia.core.project-lifecycle-event",
            "eventId": "event:project:cormia-demo/3",
            "projectRef": "project:cormia-demo",
            "sequence": 3,
            "eventType": "project_activated",
            "fromState": "configured",
            "toState": "active",
            "actorRef": "runtime:cormia-local",
            "occurredAt": NOW,
            "reasonCode": "initial_configuration_validated",
            "evidenceRefs": ["evidence:project-setup/1"],
            "previousEventDigest": DIGEST,
            "recordDigest": DIGEST,
        }

    @staticmethod
    def resource_offer():
        return {
            "schemaVersion": "0.1.0",
            "recordType": "cormia.core.resource-offer",
            "offerId": "offer:local-gpu-1",
            "providerRef": "provider:local-host-1",
            "resourceType": "compute.gpu",
            "capabilityProfileRef": "profile:inference-local",
            "capacity": {"quantity": 1, "unit": "device"},
            "availability": {"notBefore": NOW, "expiresAt": "2026-11-04T12:00:00Z"},
            "privacyProfileRef": "privacy:local-only",
            "offerState": "available",
            "ownerAccepted": True,
            "ownerAcceptanceRef": "acceptance:owner-1",
            "validated": True,
            "validationEvidenceRefs": ["evidence:gpu-probe/1"],
            "createdAt": NOW,
            "updatedAt": NOW,
        }

    @staticmethod
    def resource_lease():
        return {
            "schemaVersion": "0.1.0",
            "recordType": "cormia.core.resource-lease",
            "leaseId": "lease:task-1",
            "offerId": "offer:local-gpu-1",
            "consumerTaskRef": "task:project-1/1",
            "capabilityProfileRef": "profile:inference-local",
            "reservedCapacity": {"quantity": 1, "unit": "device"},
            "leaseState": "active",
            "issuedAt": NOW,
            "activatedAt": NOW,
            "expiresAt": "2026-11-03T13:00:00Z",
        }

    @staticmethod
    def financial_support():
        return {
            "schemaVersion": "0.1.0",
            "recordType": "cormia.core.financial-support-contribution",
            "contributionId": "contribution:grant-1",
            "contributionKind": "financial",
            "targetKind": "project",
            "targetRef": "project:cormia-demo",
            "contributorRef": "supporter:community-1",
            "beneficiaryKind": "project",
            "beneficiaryRef": "project:cormia-demo",
            "amountMinor": 10000,
            "currency": "EUR",
            "providerRef": "provider:external-custodian",
            "providerContributionRef": "provider-record:grant-1",
            "providerStatus": "settled",
            "providerConfirmed": True,
            "recordedAt": NOW,
            "updatedAt": NOW,
            "evidenceRefs": ["evidence:provider-settlement/1"],
        }

    @staticmethod
    def in_kind_support():
        return {
            "schemaVersion": "0.1.0",
            "recordType": "cormia.core.in-kind-support-contribution",
            "contributionId": "contribution:compute-1",
            "contributionKind": "in_kind",
            "inKindType": "compute",
            "targetKind": "project",
            "targetRef": "project:cormia-demo",
            "contributorRef": "supporter:compute-donor-1",
            "beneficiaryKind": "project",
            "beneficiaryRef": "project:cormia-demo",
            "scopeRef": "scope:inference-batch-1",
            "resourceOfferRef": "offer:local-gpu-1",
            "status": "accepted",
            "acceptanceRef": "acceptance:project-1",
            "recordedAt": NOW,
            "updatedAt": NOW,
        }

    def test_all_documents_are_valid_draft_2020_12_schemas(self):
        for name, schema in self.schemas.items():
            with self.subTest(schema=name):
                Draft202012Validator.check_schema(schema)

    def test_project_descriptor_accepts_all_three_leadership_modes(self):
        for mode in ("creator_team_led", "agent_led", "hybrid"):
            with self.subTest(mode=mode):
                instance = self.project_descriptor()
                instance["leadershipMode"] = mode
                self.assert_valid("project", instance)

    def test_project_descriptor_requires_steward_and_accountability_references(self):
        for field in ("stewardRef", "accountabilityRef"):
            with self.subTest(field=field):
                instance = self.project_descriptor()
                del instance[field]
                self.assert_invalid("project", instance)

    def test_project_descriptor_rejects_chain_or_payment_prerequisites(self):
        for field in ("cardanoPolicy", "walletRef", "paymentProviderRef", "crcBalance"):
            with self.subTest(field=field):
                instance = self.project_descriptor()
                instance[field] = "must-not-enter-core"
                self.assert_invalid("project", instance)

    def test_mandate_reference_does_not_duplicate_claims_or_authority(self):
        instance = self.project_descriptor()
        instance["mandateRef"]["allowedOperations"] = ["workspace.read"]
        self.assert_invalid("project", instance)

    def test_project_lifecycle_projection_is_valid_and_orthogonal(self):
        self.assert_valid("lifecycle", self.lifecycle_record())

    def test_project_lifecycle_projection_rejects_task_and_authority_states(self):
        for field, value in (("taskState", "running"), ("authorityState", "revoked")):
            with self.subTest(field=field):
                instance = self.lifecycle_record()
                instance[field] = value
                self.assert_invalid("lifecycle", instance)

    def test_project_lifecycle_event_has_a_valid_journal_shape(self):
        self.assert_valid("event", self.lifecycle_event())

    def test_project_metadata_event_requires_metadata_artifact_reference(self):
        instance = self.lifecycle_event()
        instance["eventType"] = "project_metadata_updated"
        instance["evidenceRefs"] = []
        self.assert_invalid("event", instance)

    def test_project_lifecycle_event_requires_digest_chain_metadata(self):
        instance = self.lifecycle_event()
        del instance["recordDigest"]
        self.assert_invalid("event", instance)

    def test_available_resource_offer_requires_validation_and_owner_acceptance(self):
        self.assert_valid("offer", self.resource_offer())

    def test_available_resource_offer_rejects_unaccepted_or_unvalidated_capacity(self):
        for changes in (
            {"ownerAccepted": False},
            {"validated": False},
            {"validationEvidenceRefs": []},
            {"capacity": {"quantity": 0, "unit": "device"}},
        ):
            with self.subTest(changes=changes):
                instance = self.resource_offer()
                instance.update(changes)
                self.assert_invalid("offer", instance)

    def test_resource_offer_rejects_financial_or_chain_fields(self):
        for field in ("price", "paymentRef", "cardanoAddress", "crcBalance"):
            with self.subTest(field=field):
                instance = self.resource_offer()
                instance[field] = "not-a-resource-contract-field"
                self.assert_invalid("offer", instance)

    def test_active_resource_lease_requires_activation_timestamp(self):
        instance = self.resource_lease()
        self.assert_valid("lease", instance)
        del instance["activatedAt"]
        self.assert_invalid("lease", instance)

    def test_settled_financial_support_requires_provider_confirmation(self):
        instance = self.financial_support()
        instance["providerConfirmed"] = False
        self.assert_invalid("financial", instance)

    def test_financial_support_cannot_name_an_agent_wallet_as_beneficiary(self):
        instance = self.financial_support()
        instance["beneficiaryKind"] = "agent_personal_wallet"
        self.assert_invalid("financial", instance)

    def test_pledge_can_be_recorded_without_becoming_settled_funds(self):
        instance = self.financial_support()
        instance["providerStatus"] = "pledged"
        instance["providerConfirmed"] = False
        self.assert_valid("financial", instance)
        self.assertNotEqual(instance["providerStatus"], "settled")

    def test_compute_in_kind_support_requires_a_resource_offer_reference(self):
        instance = self.in_kind_support()
        del instance["resourceOfferRef"]
        self.assert_invalid("in_kind", instance)

    def test_in_kind_support_rejects_money_equivalent_fields(self):
        instance = self.in_kind_support()
        instance["amountMinor"] = 10000
        instance["currency"] = "EUR"
        self.assert_invalid("in_kind", instance)


if __name__ == "__main__":
    unittest.main(verbosity=2)
