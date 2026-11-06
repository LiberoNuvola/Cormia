#!/usr/bin/env node
/**
 * Validates only the synthetic ECC-01 fixtures.
 * It runs the harmless page-size unit tests in a disposable OS temp directory.
 * It never executes the archive-export review fixture or touches an Agent workspace.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const fixturesRoot = path.join(suiteRoot, "fixtures");

function runTests(cwd) {
  return spawnSync(process.execPath, ["--test", "test/page-size.test.mjs"], {
    cwd,
    encoding: "utf8",
    timeout: 15000,
    windowsHide: true
  });
}

const researchProfile = await readFile(
  path.join(fixturesRoot, "01-research", "resource-profile.json"),
  "utf8"
);
const parsedResearch = JSON.parse(researchProfile);
assert.equal(parsedResearch.limits.maxReadBytes, 65536);
assert.equal(parsedResearch.network.mode, "offline");
assert.equal(parsedResearch.network.allowOutbound, false);

const reviewSource = await readFile(
  path.join(fixturesRoot, "03-review", "src", "archive-export.mjs"),
  "utf8"
);
assert.match(reviewSource, /execSync/);
assert.match(reviewSource, /shell:\s*true/);
assert.match(reviewSource, /destinationPath/);

const originalSource = await readFile(
  path.join(fixturesRoot, "02-bugfix", "src", "page-size.mjs"),
  "utf8"
);
const originalTests = await readFile(
  path.join(fixturesRoot, "02-bugfix", "test", "page-size.test.mjs")
);
assert.equal((originalSource.match(/Math\.min\(value, 51\)/g) ?? []).length, 1);

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cormia-ecc01-"));
try {
  await mkdtemp;
  const workspace = path.join(tempRoot, "bugfix");
  const sourceDir = path.join(workspace, "src");
  const testDir = path.join(workspace, "test");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(testDir, { recursive: true });
  await copyFile(
    path.join(fixturesRoot, "02-bugfix", "src", "page-size.mjs"),
    path.join(sourceDir, "page-size.mjs")
  );
  await copyFile(
    path.join(fixturesRoot, "02-bugfix", "test", "page-size.test.mjs"),
    path.join(testDir, "page-size.test.mjs")
  );

  const baseline = runTests(workspace);
  assert.equal(baseline.error, undefined, baseline.error?.message);
  assert.equal(baseline.status, 1, "Seeded baseline must exit 1 (RED).");
  assert.match(baseline.stdout, /# tests 4/);
  assert.match(baseline.stdout, /# pass 2/);
  assert.match(baseline.stdout, /# fail 2/);

  const copiedSourcePath = path.join(sourceDir, "page-size.mjs");
  const patchedSource = originalSource.replace(
    "Math.min(value, 51)",
    "Math.min(value, 50)"
  );
  await writeFile(copiedSourcePath, patchedSource, "utf8");

  const green = runTests(workspace);
  assert.equal(green.error, undefined, green.error?.message);
  assert.equal(green.status, 0, "Corrected fixture must exit 0 (GREEN).");
  assert.match(green.stdout, /# tests 4/);
  assert.match(green.stdout, /# pass 4/);
  assert.match(green.stdout, /# fail 0/);

  const unchangedTests = await readFile(path.join(testDir, "page-size.test.mjs"));
  assert.equal(
    createHash("sha256").update(unchangedTests).digest("hex"),
    createHash("sha256").update(originalTests).digest("hex"),
    "Test file must remain unchanged."
  );

  process.stdout.write(JSON.stringify({
    schema: "cormia.ecc01.fixture-validation.v1",
    result: "PASS",
    researchFixture: "valid",
    reviewFixture: "static-shell-injection-pattern-present-not-executed",
    bugfixBaseline: { exitCode: baseline.status, tests: 4, pass: 2, fail: 2 },
    bugfixCorrected: { exitCode: green.status, tests: 4, pass: 4, fail: 0 },
    testFileChanged: false,
    executionScope: "disposable-os-temp-directory",
    localAgentStarted: false,
    graniteStarted: false,
    powershellStagingScriptExecuted: false,
    reviewFixtureExecuted: false
  }, null, 2) + "\n");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
