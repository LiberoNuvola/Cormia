import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schemaPaths = {
  key: new URL("../../schemas/local-host-authority-key-descriptor-v0.1.schema.json", import.meta.url),
  consent: new URL("../../schemas/local-operator-consent-claims-v0.1.schema.json", import.meta.url),
  event: new URL("../../schemas/local-revocation-journal-event-v0.1.schema.json", import.meta.url),
  checkpoint: new URL("../../schemas/local-revocation-checkpoint-claims-v0.1.schema.json", import.meta.url)
};

async function loadSchema(url) {
  const schema = JSON.parse(await readFile(url, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  return schema;
}

test("all lifecycle claim schemas are valid JSON Schema draft 2020-12 objects", async () => {
  for (const url of Object.values(schemaPaths)) {
    const schema = await loadSchema(url);
    assert.equal(schema.type, "object");
    assert.ok(Array.isArray(schema.required));
    assert.ok(schema.required.length > 0);
  }
});

test("host key descriptor contains only public metadata and an opaque key-provider reference", async () => {
  const schema = await loadSchema(schemaPaths.key);
  const properties = schema.properties;
  assert.equal(properties.algorithm.const, "Ed25519");
  assert.equal(properties.privateKeyExportable.const, false);
  assert.ok(properties.publicKeySpkiDerBase64);
  assert.ok(properties.publicKeySha256);
  assert.ok(properties.providerKeyRef);
  assert.ok(!Object.hasOwn(properties, "privateKey"));
  assert.ok(!Object.hasOwn(properties, "privateKeyPem"));
  assert.ok(!Object.hasOwn(properties, "privateKeyBytes"));
  const activeRule = schema.allOf.find(rule => rule.if?.properties?.status?.const === "active");
  assert.ok(activeRule);
  assert.ok(activeRule.then.required.includes("trustAnchorFingerprint"));
});

test("operator consent is exact-scope, interactive, task-bound and challenge-bearing", async () => {
  const schema = await loadSchema(schemaPaths.consent);
  const required = new Set(schema.required);
  for (const field of [
    "operatorPrincipalId", "consentBrokerId", "grantId", "consentIntentDigest",
    "taskId", "manifestDigest", "hostPolicyDigest", "capability", "workspaceRef",
    "scopeDigest", "decision", "interactionId", "displayedChallenge",
    "confirmedChallenge", "nonce", "sequence"
  ]) assert.ok(required.has(field), field);
  assert.deepEqual(schema.properties.decision.enum, ["approve", "deny"]);
  assert.equal(schema.properties.interactionMode.const, "local-interactive-digest-confirmation");
  assert.equal(schema.properties.displayedChallenge.pattern, "^[a-f0-9]{8}$");
  assert.equal(schema.properties.confirmedChallenge.pattern, "^[a-f0-9]{8}$");
  assert.ok(!JSON.stringify(schema).includes("aaaaaaaa"));
});

test("revocation event envelope has sequence, predecessor digest and signed event", async () => {
  const schema = await loadSchema(schemaPaths.event);
  assert.deepEqual(schema.required, [
    "schemaVersion", "sequence", "previousEventDigest", "revocationToken"
  ]);
  assert.equal(schema.properties.sequence.minimum, 1);
  assert.deepEqual(schema.properties.previousEventDigest.type, ["string", "null"]);
  assert.ok(schema.properties.revocationToken.pattern.includes("A-Za-z0-9_-"));
  assert.equal(schema.allOf.length, 2);
  assert.equal(schema.allOf[0].then.properties.previousEventDigest.type, "null");
  assert.equal(schema.allOf[1].then.properties.previousEventDigest.type, "string");
});

test("checkpoint binds a signed journal head to a named independent anchor provider", async () => {
  const schema = await loadSchema(schemaPaths.checkpoint);
  const required = new Set(schema.required);
  for (const field of [
    "issuerId", "anchorProviderId", "sequence", "headEventDigest", "issuedAt", "checkpointId"
  ]) assert.ok(required.has(field), field);
  assert.equal(schema.properties.sequence.minimum, 0);
  assert.deepEqual(schema.properties.headEventDigest.type, ["string", "null"]);
  assert.equal(schema.allOf.length, 2);
  assert.equal(schema.allOf[0].then.properties.headEventDigest.type, "null");
  assert.equal(schema.allOf[1].then.properties.headEventDigest.type, "string");
});

test("schemas do not claim that file-only hash chaining provides rollback protection", async () => {
  const event = await loadSchema(schemaPaths.event);
  const checkpoint = await loadSchema(schemaPaths.checkpoint);
  assert.ok(event.description.includes("signed revocation JWS"));
  assert.ok(checkpoint.description.includes("independently pinned"));
});
