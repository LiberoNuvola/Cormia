#!/usr/bin/env python3
"""Deterministic reference PNC v0.1 loader and source-drift policy.

This is not a trusted Runtime boundary and grants no operational capabilities.
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Mapping

from jsonschema import Draft202012Validator

SHA1 = re.compile(r"^[a-f0-9]{40}$")
NORMATIVE = {
    "root-normative", "universal-normative-specification",
    "application-normative-policy", "governance-decision-record",
}
EVIDENCE = {"proof-evidence-registry", "audit-status-record"}


class PncError(ValueError):
    pass


def _pairs_no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise PncError(f"duplicate JSON object key: {key}")
        result[key] = value
    return result


def load_json_strict(path):
    try:
        with Path(path).open("r", encoding="utf-8") as handle:
            return json.load(handle, object_pairs_hook=_pairs_no_duplicates)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise PncError(f"cannot load JSON {path}: {exc}") from exc


def semantic_errors(contract: Mapping[str, Any]) -> list[str]:
    errors = []
    snapshots = contract.get("sourceSnapshots", [])
    sources = contract.get("sources", [])

    def unique(items, key, label):
        vals = [x.get(key) for x in items]
        if len(vals) != len(set(vals)):
            errors.append(f"{label} contains duplicate {key} values")
        return {v for v in vals if isinstance(v, str)}

    snapshot_ids = unique(snapshots, "sourceSetId", "sourceSnapshots")
    source_ids = unique(sources, "sourceId", "sources")
    unique(contract.get("closedDecisions", []), "decisionId", "closedDecisions")
    unique(contract.get("invariants", []), "invariantId", "invariants")
    unique(contract.get("openObligations", []), "obligationId", "openObligations")
    unique(contract.get("humanAuthority", {}).get("triggers", []), "triggerId", "humanAuthority.triggers")

    snapshot_by_id = {x.get("sourceSetId"): x for x in snapshots}
    sources_by_id = {x.get("sourceId"): x for x in sources}
    seen_paths = set()
    for snap in snapshots:
        repo = snap.get("repositoryFullName", "")
        expected_url = f"https://github.com/{repo}"
        if snap.get("repositoryUrl", "").rstrip("/").casefold() != expected_url.casefold():
            errors.append(f"{snap.get('sourceSetId')}: repository URL/name mismatch")
        if not SHA1.fullmatch(snap.get("commitSha", "")):
            errors.append(f"{snap.get('sourceSetId')}: invalid commit SHA")

    for source in sources:
        sid = source.get("sourceId", "<missing>")
        set_id = source.get("sourceSetId")
        if set_id not in snapshot_ids:
            errors.append(f"{sid}: sourceSetId does not resolve to a pinned snapshot")
        path_key = (set_id, source.get("path", ""))
        if path_key in seen_paths:
            errors.append(f"{sid}: duplicate path within source set")
        seen_paths.add(path_key)
        if not SHA1.fullmatch(source.get("blobSha", "")):
            errors.append(f"{sid}: invalid blob SHA")

        authority, change = source.get("authorityClass"), source.get("changePolicy")
        if authority in NORMATIVE and change != "human-authorized-normative-change":
            errors.append(f"{sid}: normative/decision source requires human-authorized change")
        if authority in EVIDENCE and change != "evidence-refresh-only":
            errors.append(f"{sid}: evidence/status source requires evidence-refresh-only")
        if authority == "informative" and change != "informative-update-only":
            errors.append(f"{sid}: informative source requires informative-update-only")
        for target in source.get("supersedes", []):
            if target == sid or target not in source_ids:
                errors.append(f"{sid}: invalid supersedes reference {target}")

    for group, field in (
        ("closedDecisions", "sourceRefs"),
        ("invariants", "sourceRefs"),
        ("openObligations", "sourceRefs"),
    ):
        for item in contract.get(group, []):
            iid = item.get("decisionId") or item.get("invariantId") or item.get("obligationId") or group
            for ref in item.get(field, []):
                if ref not in source_ids:
                    errors.append(f"{group}/{iid}: unknown source reference {ref}")
                elif group == "closedDecisions" and sources_by_id[ref].get("authorityClass") not in NORMATIVE:
                    errors.append(f"{group}/{iid}: {ref} is not a normative/decision source")

    for ref in contract.get("evidencePolicy", {}).get("classificationSourceRefs", []):
        if ref not in source_ids:
            errors.append(f"evidencePolicy: unknown classification source reference {ref}")

    project_repo = contract.get("project", {}).get("repository", {}).get("fullName", "")
    for snap in snapshots:
        if snap.get("repositoryFullName", "").casefold() != project_repo.casefold():
            errors.append(f"{snap.get('sourceSetId')}: snapshot differs from project repository")

    execution = contract.get("executionPolicy", {})
    conflict = contract.get("conflictPolicy", {})
    if execution.get("humanApprovalPerOperation") is not False:
        errors.append("humanApprovalPerOperation must be false")
    if execution.get("continueIndependentTasksOnBlock") is not True:
        errors.append("continueIndependentTasksOnBlock must be true")
    if execution.get("evidencePromotionByModelAllowed") is not False:
        errors.append("evidencePromotionByModelAllowed must be false")
    if conflict.get("floatingSourceRefsAllowed") is not False:
        errors.append("floatingSourceRefsAllowed must be false")
    if conflict.get("evidenceCreatesNormativeAuthority") is not False:
        errors.append("evidence must not create normative authority")
    if conflict.get("unresolvedSameClassConflict") != "escalate":
        errors.append("unresolved same-class conflicts must escalate")
    return errors


def validate_contract(contract, schema):
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    shape_errors = [
        f"schema {'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}"
        for e in sorted(validator.iter_errors(contract), key=lambda e: list(map(str, e.absolute_path)))
    ]
    return shape_errors + semantic_errors(contract)


class GitHubSourceResolver:
    """Read-only public-GitHub resolver. No token or credential is read."""
    def __init__(self, opener=urllib.request.urlopen, timeout=20):
        self.opener, self.timeout = opener, timeout

    @staticmethod
    def _repo_path(name):
        parts = name.split("/")
        if len(parts) != 2 or not all(parts):
            raise PncError("invalid GitHub repository full name")
        return "/".join(urllib.parse.quote(x, safe="") for x in parts)

    def _get(self, url):
        req = urllib.request.Request(url, headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "Cormia-PNC-reference-loader/0.1",
            "X-GitHub-Api-Version": "2022-11-28",
        })
        try:
            with self.opener(req, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise PncError(f"GitHub source lookup failed: {exc}") from exc
        if not isinstance(payload, dict):
            raise PncError("GitHub returned a non-object response")
        return payload

    def resolve_commit(self, repository, commit_sha):
        path = self._repo_path(repository)
        payload = self._get(f"https://api.github.com/repos/{path}/git/commits/{commit_sha}")
        tree_sha = payload.get("tree", {}).get("sha")
        if payload.get("sha") != commit_sha or not isinstance(tree_sha, str):
            raise PncError(f"commit SHA mismatch or malformed response: {repository}@{commit_sha}")
        return {"repositoryFullName": repository, "commitSha": payload["sha"], "treeSha": tree_sha}

    def get_blob_sha(self, repository, commit_sha, path):
        repo = self._repo_path(repository)
        file_path = urllib.parse.quote(path, safe="/")
        payload = self._get(
            f"https://api.github.com/repos/{repo}/contents/{file_path}?ref={commit_sha}"
        )
        if not isinstance(payload.get("sha"), str):
            raise PncError(f"missing blob SHA: {repository}@{commit_sha}:{path}")
        return payload["sha"]


def verify_source_pins(contract, resolver):
    snapshots = {x["sourceSetId"]: x for x in contract["sourceSnapshots"]}
    verified = []
    for set_id, snap in snapshots.items():
        resolved = resolver.resolve_commit(snap["repositoryFullName"], snap["commitSha"])
        if resolved.get("repositoryFullName", "").casefold() != snap["repositoryFullName"].casefold():
            raise PncError(f"{set_id}: resolver returned a different repository")
        if resolved.get("commitSha") != snap["commitSha"]:
            raise PncError(f"{set_id}: commit SHA mismatch")
        verified.append(set_id)
    for source in contract["sources"]:
        snap = snapshots[source["sourceSetId"]]
        actual = resolver.get_blob_sha(snap["repositoryFullName"], snap["commitSha"], source["path"])
        if actual != source["blobSha"]:
            raise PncError(f"{source['sourceId']}: blob SHA mismatch at {source['path']}")
    return tuple(sorted(verified))


def load_pnc(contract_path, schema_path, *, resolver=None, expected_repository=None, require_active=True):
    contract, schema = load_json_strict(contract_path), load_json_strict(schema_path)
    errors = validate_contract(contract, schema)
    if errors:
        raise PncError("PNC validation failed: " + "; ".join(errors))
    actual_repo = contract["project"]["repository"]["fullName"]
    if expected_repository and actual_repo.casefold() != expected_repository.casefold():
        raise PncError("PNC project repository does not match Runtime-bound repository")
    if require_active and contract["status"] != "active":
        raise PncError(f"PNC status is {contract['status']!r}; Runtime requires 'active'")
    sets = verify_source_pins(contract, resolver or GitHubSourceResolver())
    return {"contract": contract, "verifiedSourceSets": sets, "verifiedSourceCount": len(contract["sources"])}


def _looks_like_source(path):
    p = path.casefold()
    return (
        p.startswith(("docs/", "spec/", "specs/", "governance/", "constitution/", "policy/"))
        or p.endswith(".md")
        or p.rsplit("/", 1)[-1] in {"spec.md", "constitution.md", "governance.md", "policy.md", "economy.md"}
    )


def classify_source_drift(contract, source_set_id, changed_paths):
    """Classify host-computed Git changed paths; model-authored labels are ignored."""
    snapshots = {x["sourceSetId"]: x for x in contract.get("sourceSnapshots", [])}
    if source_set_id not in snapshots:
        raise PncError(f"unknown source set: {source_set_id}")
    registry = {
        x["path"]: x for x in contract.get("sources", []) if x.get("sourceSetId") == source_set_id
    }
    buckets = {
        "normative-source-change": [],
        "evidence-status-only": [],
        "informative-only": [],
        "unclassified-source-change": [],
        "implementation-only": [],
    }
    for raw in sorted(set(changed_paths)):
        path = raw.replace("\\", "/")
        if not path or path.startswith("/") or ".." in path.split("/"):
            buckets["unclassified-source-change"].append(raw)
            continue
        src = registry.get(path)
        if src:
            authority, policy = src.get("authorityClass"), src.get("changePolicy")
            if authority in NORMATIVE or policy == "human-authorized-normative-change":
                bucket = "normative-source-change"
            elif authority in EVIDENCE and policy == "evidence-refresh-only":
                bucket = "evidence-status-only"
            elif authority == "informative" and policy == "informative-update-only":
                bucket = "informative-only"
            else:
                bucket = "unclassified-source-change"
        elif _looks_like_source(path):
            bucket = "unclassified-source-change"
        else:
            bucket = "implementation-only"
        buckets[bucket].append(path)

    active = [k for k, v in buckets.items() if v]
    if not active:
        kind = "no-change"
    elif "normative-source-change" in active:
        kind = "normative-source-change"
    elif "unclassified-source-change" in active:
        kind = "unclassified-source-change"
    elif "evidence-status-only" in active:
        kind = "evidence-status-only"
    elif "informative-only" in active:
        kind = "informative-only"
    else:
        kind = "implementation-only"
    return {
        "kind": kind,
        "sourceSetId": source_set_id,
        "classes": active,
        "pathsByClass": {k: v for k, v in buckets.items() if v},
        "nonAuthoritativeOverlay": kind == "evidence-status-only",
        "modelClassificationAccepted": False,
    }


def classify_contract_delta(baseline, candidate):
    changes = []
    if baseline.get("invariants") != candidate.get("invariants"):
        changes.append("invariant-change")
    if baseline.get("closedDecisions") != candidate.get("closedDecisions"):
        changes.append("closed-decision-change")
    if baseline.get("sources") != candidate.get("sources") or baseline.get("sourceSnapshots") != candidate.get("sourceSnapshots"):
        changes.append("source-registry-change")
    if baseline.get("openObligations") != candidate.get("openObligations"):
        changes.append("obligation-registry-change")
    for field in ("project", "evidencePolicy", "humanAuthority", "executionPolicy", "conflictPolicy", "status", "schemaVersion", "contractId"):
        if baseline.get(field) != candidate.get(field):
            changes.append("authority-boundary-change")
            break
    priority = (
        "invariant-change", "closed-decision-change", "authority-boundary-change",
        "source-registry-change", "obligation-registry-change",
    )
    kind = next((x for x in priority if x in changes), "no-change")
    return {"kind": kind, "changes": changes, "modelClassificationAccepted": False}


def evaluate_policy(
    contract, *, source_integrity_verified, task_kind, drift=None,
    contract_delta=None, semantic_facts=None, same_tier_conflict=False,
):
    """Deterministic policy decision. Facts must be computed by trusted host code."""
    facts = semantic_facts or {}
    execution = contract.get("executionPolicy", {})
    allowed = execution.get("autonomousActivities", [])
    delta_kind = (contract_delta or {}).get("kind")
    drift_kind = (drift or {}).get("kind", "no-change")

    if not source_integrity_verified:
        action, reason = "DENY", "PNC_SOURCE_INTEGRITY_UNVERIFIED"
    elif facts.get("evidence_promotion"):
        action, reason = "DENY", "PNC_EVIDENCE_PROMOTION_FORBIDDEN"
    elif facts.get("protected_external_action"):
        action, reason = "DENY", "PNC_PROTECTED_EXTERNAL_ACTION_NOT_AUTHORIZED"
    elif task_kind not in allowed:
        action, reason = "DENY", "PNC_TASK_KIND_NOT_DELEGATED"
    elif same_tier_conflict:
        action, reason = "ESCALATE", "PNC_UNRESOLVED_SAME_TIER_CONFLICT"
    elif facts.get("invariant_change") or delta_kind == "invariant-change":
        action, reason = "ESCALATE", "PNC_INVARIANT_CHANGE_REQUIRES_HUMAN_AUTHORITY"
    elif facts.get("closed_decision_reopening") or delta_kind == "closed-decision-change":
        action, reason = "ESCALATE", "PNC_CLOSED_DECISION_REOPENING"
    elif facts.get("authority_boundary_change") or delta_kind == "authority-boundary-change":
        action, reason = "ESCALATE", "PNC_AUTHORITY_BOUNDARY_CHANGE"
    elif delta_kind in {"source-registry-change", "obligation-registry-change"}:
        action, reason = "ESCALATE", "PNC_BASELINE_OR_OBLIGATION_REGISTRY_CHANGE"
    elif drift_kind == "normative-source-change":
        action, reason = "ESCALATE", "PNC_NORMATIVE_SOURCE_CHANGED"
    elif drift_kind == "unclassified-source-change":
        action, reason = "ESCALATE", "PNC_UNCLASSIFIED_SOURCE_CHANGE"
    elif drift_kind not in {"no-change", "implementation-only", "evidence-status-only", "informative-only"}:
        action, reason = "ESCALATE", "PNC_CHANGE_CLASS_UNRECOGNISED"
    elif drift_kind == "evidence-status-only":
        action, reason = "ALLOW", "PNC_EVIDENCE_REFRESH_NON_AUTHORITATIVE_OVERLAY"
    elif drift_kind == "informative-only":
        action, reason = "ALLOW", "PNC_INFORMATIVE_SOURCE_REFRESH"
    else:
        action, reason = "ALLOW", "PNC_IN_SCOPE_AUTONOMOUS_WORK"

    blocked = action != "ALLOW"
    return {
        "action": action,
        "reasonCode": reason,
        "affectedTaskSuspended": blocked,
        "continueIndependentTasks": bool(execution.get("continueIndependentTasksOnBlock")) if blocked else False,
        "nonAuthoritativeOverlay": action == "ALLOW" and drift_kind == "evidence-status-only",
        "modelClassificationAccepted": False,
    }
