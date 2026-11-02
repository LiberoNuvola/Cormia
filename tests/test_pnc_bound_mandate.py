import copy
import json
import unittest
from pathlib import Path
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
MANDATE_SCHEMA = json.loads((ROOT / "schemas/local-autonomous-project-mandate-claims-v0.2.schema.json").read_text(encoding="utf-8"))
CONSENT_SCHEMA = json.loads((ROOT / "schemas/local-project-mandate-consent-claims-v0.2.schema.json").read_text(encoding="utf-8"))
MANDATE = Draft202012Validator(MANDATE_SCHEMA)
CONSENT = Draft202012Validator(CONSENT_SCHEMA)
BINDING = {
    "contractId": "immortal-protocol.normative-contract.v0.1",
    "schemaVersion": "0.1.0",
    "identityProfile": "RFC8785-JCS-SHA256-DOMAIN-SEPARATED-v0.1",
    "digest": "sha256:" + "a" * 64,
}

def mandate():
    return {
        "schemaVersion": "0.2.0", "mandateId": "11111111-1111-4111-8111-111111111111",
        "issuerId": "local-host:operator-1", "operatorPrincipalId": "os-principal:operator-1",
        "subject": {"workerId": "worker-1", "runtimeId": "runtime-1"},
        "project": {"projectRef": "immortal-protocol", "repositoryRef": "LiberoNuvola/Immortal-Protocol", "baseRef": "main"},
        "workspace": {
            "workspaceRef": "worktree-1", "scopeMode": "isolated-project-worktree",
            "recursive": True, "excludedPaths": [".secrets", "wallet"], "taskWorktreeRequired": True
        },
        "allowedOperations": ["workspace.read", "workspace.create", "workspace.test"],
        "gitPolicy": {
            "branchPrefix": "agent/", "defaultBranchWrite": "deny",
            "protectedBranchMerge": "separate-authority", "releaseTag": "separate-authority",
            "autoPushFeatureBranch": False, "autoCreatePullRequest": False
        },
        "networkPolicy": {"mode": "offline", "allowedHttpsHosts": []},
        "resourceBudget": {
            "maxConcurrentTasks": 1, "maxAttemptsPerTask": 3, "maxRuntimeMinutes": 60,
            "maxCpuHeavyMinutes": 30, "maxMemoryMiB": 2048
        },
        "autonomyPolicy": {
            "acceptInScopeTasksAutomatically": True, "allowAgentCreatedSubtasks": True,
            "humanApprovalPerOperation": False, "continueIndependentTasksOnBlock": True,
            "stopOnTrustFailure": True
        },
        "protectedActions": ["merge-protected-branch", "release", "production-deploy", "read-secret-material",
            "wallet-signing", "fund-transfer", "cardano-settlement", "change-trust-anchor", "widen-mandate"],
        "issuedAt": "2026-11-02T16:00:00Z", "notBefore": "2026-11-02T16:00:00Z",
        "expiresAt": "2026-11-03T16:00:00Z", "delegable": False,
        "operatorConsentDigest": "sha256:" + "b" * 64,
        "consentIntentDigest": "sha256:" + "c" * 64,
        "executionProfileIds": ["node22-project-tests"],
        "normativeContractBinding": copy.deepcopy(BINDING),
    }

def consent():
    return {
        "schemaVersion": "0.2.0", "consentId": "22222222-2222-4222-8222-222222222222",
        "issuerId": "local-host:operator-1", "operatorPrincipalId": "os-principal:operator-1",
        "consentBrokerId": "os-consent-broker:1", "consentIntentDigest": "sha256:" + "c" * 64,
        "projectRef": "immortal-protocol", "workspaceRef": "worktree-1", "decision": "approve",
        "interactionMode": "local-interactive-project-mandate",
        "interactionId": "33333333-3333-4333-8333-333333333333",
        "displayedChallenge": "abcdef01", "confirmedChallenge": "abcdef01",
        "issuedAt": "2026-11-02T16:00:00Z", "expiresAt": "2026-11-02T16:10:00Z",
        "nonce": "44444444-4444-4444-8444-444444444444", "sequence": 1,
        "normativeContractBinding": copy.deepcopy(BINDING),
    }

class PncBoundMandateSchemaTests(unittest.TestCase):
    def test_v2_schemas_are_valid_and_require_both_non_circular_digest_fields(self):
        Draft202012Validator.check_schema(MANDATE_SCHEMA)
        Draft202012Validator.check_schema(CONSENT_SCHEMA)
        self.assertIn("operatorConsentDigest", MANDATE_SCHEMA["required"])
        self.assertIn("consentIntentDigest", MANDATE_SCHEMA["required"])
        self.assertIn("consentIntentDigest", CONSENT_SCHEMA["required"])

    def test_v2_mandate_and_consent_validate(self):
        self.assertEqual(list(MANDATE.iter_errors(mandate())), [])
        self.assertEqual(list(CONSENT.iter_errors(consent())), [])

    def test_v1_mandate_and_consent_are_not_v2(self):
        for value, validator in ((mandate(), MANDATE), (consent(), CONSENT)):
            value["schemaVersion"] = "0.1.0"
            self.assertTrue(list(validator.iter_errors(value)))

    def test_missing_pnc_binding_or_consent_intent_digest_is_rejected(self):
        for field in ("normativeContractBinding", "consentIntentDigest"):
            m, c = mandate(), consent()
            m.pop(field)
            c.pop(field)
            self.assertTrue(list(MANDATE.iter_errors(m)))
            self.assertTrue(list(CONSENT.iter_errors(c)))

    def test_invalid_binding_profile_version_or_digest_is_rejected(self):
        for field, bad in (("digest", "not-a-digest"), ("identityProfile", "model-invented"),
                           ("schemaVersion", "0.2.0")):
            value = mandate()
            value["normativeContractBinding"][field] = bad
            self.assertTrue(list(MANDATE.iter_errors(value)))

    def test_receipt_binds_to_intent_not_final_mandate_digest(self):
        m, c = mandate(), consent()
        self.assertNotIn("mandateDigest", c)
        self.assertEqual(c["consentIntentDigest"], m["consentIntentDigest"])
        self.assertIn("operatorConsentDigest", m)

if __name__ == "__main__":
    unittest.main(verbosity=2)
