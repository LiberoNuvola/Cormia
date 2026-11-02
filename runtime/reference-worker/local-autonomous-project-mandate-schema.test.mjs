import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mandateUrl = new URL("../../schemas/local-autonomous-project-mandate-claims-v0.1.schema.json", import.meta.url);
const consentUrl = new URL("../../schemas/local-project-mandate-consent-claims-v0.1.schema.json", import.meta.url);

async function load(url) {
  const schema = JSON.parse(await readFile(url, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  return schema;
}

test("project mandate schema is closed and binds project, worktree and subject", async () => {
  const schema = await load(mandateUrl);
  const required = new Set(schema.required);
  for (const key of [
    "mandateId", "issuerId", "operatorPrincipalId", "subject", "project",
    "workspace", "allowedOperations", "gitPolicy", "networkPolicy",
    "resourceBudget", "autonomyPolicy", "protectedActions", "operatorConsentDigest"
  ]) assert.ok(required.has(key), key);

  assert.equal(schema.properties.workspace.properties.scopeMode.const, "isolated-project-worktree");
  assert.equal(schema.properties.workspace.properties.recursive.const, true);
  assert.equal(schema.properties.workspace.properties.taskWorktreeRequired.const, true);
  assert.equal(schema.properties.gitPolicy.properties.defaultBranchWrite.const, "deny");
});

test("mandate authorizes autonomous in-scope work without per-operation human prompts", async () => {
  const schema = await load(mandateUrl);
  const policy = schema.properties.autonomyPolicy.properties;
  assert.equal(policy.acceptInScopeTasksAutomatically.const, true);
  assert.equal(policy.allowAgentCreatedSubtasks.const, true);
  assert.equal(policy.humanApprovalPerOperation.const, false);
  assert.equal(policy.continueIndependentTasksOnBlock.const, true);
  assert.equal(policy.stopOnTrustFailure.const, true);
});

test("mandate permits ordinary project edit, test and local git operation families", async () => {
  const schema = await load(mandateUrl);
  const operations = schema.properties.allowedOperations.items.enum;
  for (const operation of [
    "workspace.read", "workspace.create", "workspace.replace", "workspace.patch",
    "workspace.test", "workspace.build", "git.branch.create", "git.commit.local"
  ]) assert.ok(operations.includes(operation), operation);

  assert.ok(operations.includes("git.push.feature-branch"));
  assert.ok(operations.includes("github.pull-request.create"));
  assert.ok(!operations.includes("git.push.protected-branch"));
  assert.ok(!operations.includes("wallet.sign"));
  assert.ok(!operations.includes("cardano.settle"));
});

test("mandate protects remote credentials and limits external side effects", async () => {
  const schema = await load(mandateUrl);
  const topLevel = Object.keys(schema.properties);
  for (const forbidden of [
    "apiKey", "accessToken", "refreshToken", "bearerToken",
    "privateKey", "privateKeyPem", "signingSeed", "walletSeed"
  ]) assert.ok(!topLevel.includes(forbidden), forbidden);

  assert.equal(schema.properties.gitPolicy.properties.protectedBranchMerge.const, "separate-authority");
  assert.equal(schema.properties.gitPolicy.properties.releaseTag.const, "separate-authority");
  assert.ok(schema.properties.protectedActions.items.enum.includes("production-deploy"));
  assert.ok(schema.properties.protectedActions.items.enum.includes("wallet-signing"));
});

test("one consent receipt binds the complete project mandate, not an individual file operation", async () => {
  const schema = await load(consentUrl);
  const required = new Set(schema.required);
  for (const field of [
    "operatorPrincipalId", "consentBrokerId", "mandateId", "mandateDigest",
    "projectRef", "workspaceRef", "decision", "interactionId",
    "displayedChallenge", "confirmedChallenge", "nonce", "sequence"
  ]) assert.ok(required.has(field), field);
  assert.equal(schema.properties.interactionMode.const, "local-interactive-project-mandate");
  assert.deepEqual(schema.properties.decision.enum, ["approve", "deny"]);
  assert.ok(!Object.hasOwn(schema.properties, "capability"));
  assert.ok(!Object.hasOwn(schema.properties, "filePath"));
  assert.ok(!Object.hasOwn(schema.properties, "apiToken"));
});

test("project consent is short-lived, replay-identifiable and challenge-bearing", async () => {
  const schema = await load(consentUrl);
  assert.ok(schema.properties.expiresAt);
  assert.ok(schema.properties.nonce);
  assert.ok(schema.properties.sequence);
  assert.equal(schema.properties.displayedChallenge.pattern, "^[a-f0-9]{8}$");
  assert.equal(schema.properties.confirmedChallenge.pattern, "^[a-f0-9]{8}$");
});
