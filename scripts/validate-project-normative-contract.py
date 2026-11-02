#!/usr/bin/env python3
"""Validate the Project Normative Contract schema, fixture and cross-references."""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schemas" / "project-normative-contract-v0.1.schema.json"
EXAMPLE_PATH = ROOT / "examples" / "project-normative-contracts" / "immortal-protocol-v0.1.json"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def semantic_errors(contract: dict) -> list[str]:
    errors: list[str] = []
    snapshots = contract.get("sourceSnapshots", [])
    sources = contract.get("sources", [])
    snapshot_ids = [item.get("sourceSetId") for item in snapshots]
    source_ids = [item.get("sourceId") for item in sources]

    if len(snapshot_ids) != len(set(snapshot_ids)):
        errors.append("sourceSnapshots contains duplicate sourceSetId values")
    if len(source_ids) != len(set(source_ids)):
        errors.append("sources contains duplicate sourceId values")

    snapshot_id_set = set(snapshot_ids)
    source_id_set = set(source_ids)
    for source in sources:
        source_id = source.get("sourceId", "<missing>")
        if source.get("sourceSetId") not in snapshot_id_set:
            errors.append(f"{source_id}: sourceSetId does not resolve to a pinned snapshot")
        authority = source.get("authorityClass")
        policy = source.get("changePolicy")
        if authority in {
            "root-normative",
            "universal-normative-specification",
            "application-normative-policy",
            "governance-decision-record",
        } and policy != "human-authorized-normative-change":
            errors.append(f"{source_id}: normative/decision source must require human-authorized change")
        if authority in {"proof-evidence-registry", "audit-status-record"} and policy != "evidence-refresh-only":
            errors.append(f"{source_id}: evidence/status source must use evidence-refresh-only")
        if authority == "informative" and policy != "informative-update-only":
            errors.append(f"{source_id}: informative source must use informative-update-only")

    reference_groups = [
        ("closedDecisions", "sourceRefs"),
        ("invariants", "sourceRefs"),
        ("openObligations", "sourceRefs"),
    ]
    for group_name, field_name in reference_groups:
        for item in contract.get(group_name, []):
            item_id = item.get("decisionId") or item.get("invariantId") or item.get("obligationId") or group_name
            for source_ref in item.get(field_name, []):
                if source_ref not in source_id_set:
                    errors.append(f"{group_name}/{item_id}: unknown source reference {source_ref}")

    for source_ref in contract.get("evidencePolicy", {}).get("classificationSourceRefs", []):
        if source_ref not in source_id_set:
            errors.append(f"evidencePolicy: unknown classification source reference {source_ref}")

    if contract.get("executionPolicy", {}).get("humanApprovalPerOperation") is not False:
        errors.append("executionPolicy must not require human approval per operation")
    if contract.get("executionPolicy", {}).get("continueIndependentTasksOnBlock") is not True:
        errors.append("executionPolicy must continue independent tasks when one task is blocked")
    if contract.get("executionPolicy", {}).get("evidencePromotionByModelAllowed") is not False:
        errors.append("the model must not promote evidence classes")
    if contract.get("conflictPolicy", {}).get("floatingSourceRefsAllowed") is not False:
        errors.append("floating source refs must remain forbidden")

    return errors


def check_contract(schema: dict, contract: dict) -> list[str]:
    validator = Draft202012Validator(schema)
    errors = [
        f"schema {'/'.join(str(part) for part in error.absolute_path) or '<root>'}: {error.message}"
        for error in sorted(validator.iter_errors(contract), key=lambda item: list(map(str, item.absolute_path)))
    ]
    return errors + semantic_errors(contract)


def expect_rejected(name: str, schema: dict, baseline: dict, mutate) -> None:
    candidate = copy.deepcopy(baseline)
    mutate(candidate)
    if not check_contract(schema, candidate):
        raise AssertionError(f"negative test unexpectedly passed: {name}")


def main() -> int:
    schema = load_json(SCHEMA_PATH)
    example = load_json(EXAMPLE_PATH)
    Draft202012Validator.check_schema(schema)

    errors = check_contract(schema, example)
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1

    negative_cases = [
        (
            "unknown source set",
            lambda value: value["sources"][0].update(sourceSetId="missing-source-set"),
        ),
        (
            "duplicate source identity",
            lambda value: value["sources"][1].update(sourceId=value["sources"][0]["sourceId"]),
        ),
        (
            "unresolved normative source reference",
            lambda value: value["invariants"][0]["sourceRefs"].append("unknown.source"),
        ),
        (
            "normative source made evidence-refreshable",
            lambda value: value["sources"][0].update(changePolicy="evidence-refresh-only"),
        ),
        (
            "per-operation human approval reintroduced",
            lambda value: value["executionPolicy"].update(humanApprovalPerOperation=True),
        ),
        (
            "floating source reference enabled",
            lambda value: value["conflictPolicy"].update(floatingSourceRefsAllowed=True),
        ),
    ]
    for name, mutation in negative_cases:
        expect_rejected(name, schema, example, mutation)

    print(
        "PASS: PNC schema and IMMORTAL fixture validated "
        f"({len(example['sources'])} pinned source documents, "
        f"{len(example['closedDecisions'])} closed decisions, "
        f"{len(example['invariants'])} invariants, "
        f"{len(example['openObligations'])} open obligations)."
    )
    print(f"PASS: {len(negative_cases)} fail-closed semantic negative cases rejected.")
    print("NOTE: this validates JSON shape and declared references; it does not fetch GitHub blobs or establish source authenticity.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
