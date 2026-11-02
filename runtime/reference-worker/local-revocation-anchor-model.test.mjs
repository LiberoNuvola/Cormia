import test from "node:test";
import assert from "node:assert/strict";
import {
  computeLocalRevocationEventDigest,
  createLocalRevocationJournalEvent,
  verifyAndReconcileLocalRevocationJournal
} from "./local-revocation-anchor-model.mjs";

const issuerId = "local-host:operator-1";
const providerId = "test-monotonic-anchor";

function makeFixture(count = 0, anchorSequence = 0, anchorDigestOverride) {
  const revocations = new Map();
  const events = [];
  let previousEventDigest = null;

  for (let sequence = 1; sequence <= count; sequence++) {
    const revocationToken = "synthetic-signed-revocation-" + sequence;
    revocations.set(revocationToken, {
      valid: true,
      issuerId,
      claims: { sequence, issuerId }
    });
    const event = createLocalRevocationJournalEvent({
      sequence,
      previousEventDigest,
      revocationToken
    });
    events.push(event);
    previousEventDigest = computeLocalRevocationEventDigest(event);
  }

  const anchor = {
    providerId,
    sequence: anchorSequence,
    headEventDigest: anchorSequence === 0
      ? null
      : anchorDigestOverride ?? (
        anchorSequence <= events.length
          ? computeLocalRevocationEventDigest(events[anchorSequence - 1])
          : "sha256:" + "a".repeat(64)
      )
  };

  const checkpointToken = "synthetic-signed-checkpoint";
  const checkpoints = new Map([[checkpointToken, {
    valid: true,
    issuerId,
    claims: {
      issuerId,
      anchorProviderId: providerId,
      sequence: events.length,
      headEventDigest: previousEventDigest
    }
  }]]);

  const state = { ...anchor };
  let advanceCalls = 0;

  const options = {
    events,
    checkpointToken,
    expectedIssuerId: issuerId,
    verifyRevocationToken: async token => revocations.get(token) ?? { valid: false },
    verifyCheckpointToken: async token => checkpoints.get(token) ?? { valid: false },
    readAnchor: async () => ({ ...state }),
    advanceAnchor: async (expected, next) => {
      advanceCalls++;
      if (state.providerId !== expected.providerId ||
          state.sequence !== expected.sequence ||
          state.headEventDigest !== expected.headEventDigest) {
        return false;
      }
      state.sequence = next.sequence;
      state.headEventDigest = next.headEventDigest;
      return true;
    }
  };

  return {
    options,
    state,
    advanceCalls: () => advanceCalls,
    events,
    revocations,
    checkpoints
  };
}

test("accepts the empty genesis journal only when the external anchor is also genesis", async () => {
  const fixture = makeFixture(0, 0);
  const result = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(result.allowed, true);
  assert.equal(result.status, "HEALTHY");
  assert.equal(fixture.advanceCalls(), 0);
});

test("accepts a journal whose signed checkpoint and anchor head match", async () => {
  const fixture = makeFixture(3, 3);
  const result = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(result.allowed, true);
  assert.equal(result.status, "HEALTHY");
  assert.equal(result.head.sequence, 3);
  assert.equal(fixture.advanceCalls(), 0);
});

test("recovers a durable journal that is ahead of the last anchored sequence", async () => {
  const fixture = makeFixture(3, 1);
  const result = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(result.allowed, true);
  assert.equal(result.status, "RECOVERED_AHEAD");
  assert.equal(fixture.state.sequence, 3);
  assert.equal(fixture.state.headEventDigest, result.head.headEventDigest);
  assert.equal(fixture.advanceCalls(), 1);
});

test("rejects a journal that is behind the monotonic anchor", async () => {
  const fixture = makeFixture(1, 2);
  const result = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(result.allowed, false);
  assert.equal(result.status, "ROLLBACK");
  assert.equal(fixture.advanceCalls(), 0);
});

test("rejects equal sequence with a different anchored head digest", async () => {
  const fixture = makeFixture(2, 2, "sha256:" + "f".repeat(64));
  const result = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(result.allowed, false);
  assert.equal(result.status, "FORK_OR_TAMPER");
  assert.equal(fixture.advanceCalls(), 0);
});

test("rejects a journal that does not contain the independently anchored prefix", async () => {
  const fixture = makeFixture(3, 1, "sha256:" + "e".repeat(64));
  const result = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "journal-does-not-contain-anchored-prefix");
  assert.equal(fixture.advanceCalls(), 0);
});

test("rejects gaps, reordered events and broken predecessor links", async () => {
  const reordered = makeFixture(2, 0);
  reordered.options.events = [
    reordered.events[1],
    reordered.events[0]
  ];
  const reorderedResult = await verifyAndReconcileLocalRevocationJournal(reordered.options);
  assert.equal(reorderedResult.allowed, false);
  assert.equal(reorderedResult.reason, "event-sequence-or-link-mismatch");

  const brokenLink = makeFixture(2, 0);
  brokenLink.options.events = [
    brokenLink.events[0],
    { ...brokenLink.events[1], previousEventDigest: "sha256:" + "0".repeat(64) }
  ];
  const brokenResult = await verifyAndReconcileLocalRevocationJournal(brokenLink.options);
  assert.equal(brokenResult.allowed, false);
  assert.equal(brokenResult.reason, "event-sequence-or-link-mismatch");
});

test("rejects an invalid signed event or an event from another issuer", async () => {
  const badSignature = makeFixture(2, 0);
  badSignature.revocations.set("synthetic-signed-revocation-2", { valid: false });
  const signatureResult = await verifyAndReconcileLocalRevocationJournal(badSignature.options);
  assert.equal(signatureResult.allowed, false);
  assert.equal(signatureResult.reason, "invalid-revocation-signature-or-binding");

  const wrongIssuer = makeFixture(1, 0);
  wrongIssuer.revocations.set("synthetic-signed-revocation-1", {
    valid: true,
    issuerId: "other-host",
    claims: { sequence: 1, issuerId: "other-host" }
  });
  const issuerResult = await verifyAndReconcileLocalRevocationJournal(wrongIssuer.options);
  assert.equal(issuerResult.allowed, false);
  assert.equal(issuerResult.reason, "invalid-revocation-signature-or-binding");
});

test("rejects a missing, stale or wrong-provider checkpoint", async () => {
  const missing = makeFixture(1, 0);
  missing.options.checkpointToken = "missing";
  const missingResult = await verifyAndReconcileLocalRevocationJournal(missing.options);
  assert.equal(missingResult.status, "CHECKPOINT_INVALID");

  const stale = makeFixture(2, 0);
  stale.checkpoints.get("synthetic-signed-checkpoint").claims.sequence = 1;
  const staleResult = await verifyAndReconcileLocalRevocationJournal(stale.options);
  assert.equal(staleResult.status, "CHECKPOINT_INVALID");

  const wrongProvider = makeFixture(1, 1);
  wrongProvider.checkpoints.get("synthetic-signed-checkpoint").claims.anchorProviderId = "other-provider";
  const providerResult = await verifyAndReconcileLocalRevocationJournal(wrongProvider.options);
  assert.equal(providerResult.status, "ANCHOR_MISMATCH");
});

test("denies when the independent anchor cannot be read", async () => {
  const fixture = makeFixture(1, 1);
  fixture.options.readAnchor = async () => {
    throw new Error("anchor provider unavailable");
  };
  const result = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(result.allowed, false);
  assert.equal(result.status, "ANCHOR_UNAVAILABLE");
});

test("denies when atomic anchor compare-and-set fails or is unavailable", async () => {
  const conflict = makeFixture(2, 1);
  conflict.options.advanceAnchor = async () => false;
  const conflictResult = await verifyAndReconcileLocalRevocationJournal(conflict.options);
  assert.equal(conflictResult.allowed, false);
  assert.equal(conflictResult.status, "ANCHOR_ADVANCE_FAILED");

  const missingProvider = makeFixture(2, 1);
  delete missingProvider.options.advanceAnchor;
  const missingResult = await verifyAndReconcileLocalRevocationJournal(missingProvider.options);
  assert.equal(missingResult.allowed, false);
  assert.equal(missingResult.status, "ANCHOR_ADVANCE_REQUIRED");
});

test("denies if signature verifiers or trusted issuer context are missing", async () => {
  const fixture = makeFixture(0, 0);
  fixture.options.verifyCheckpointToken = undefined;
  const result = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(result.allowed, false);
  assert.equal(result.status, "CONFIGURATION_INVALID");
});

test("rejects accessor-backed journal envelopes without invoking getters", async () => {
  const fixture = makeFixture(1, 0);
  let getterCalls = 0;
  const accessorEvent = { ...fixture.events[0] };
  Object.defineProperty(accessorEvent, "sequence", {
    enumerable: true,
    get() {
      getterCalls++;
      return 1;
    }
  });
  fixture.options.events = [accessorEvent];
  const result = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(result.allowed, false);
  assert.equal(result.status, "JOURNAL_INVALID");
  assert.equal(getterCalls, 0);
});

test("classifies signature verifier failures separately from anchor outages", async () => {
  const eventFailure = makeFixture(1, 0);
  eventFailure.options.verifyRevocationToken = async () => {
    throw new Error("signature verifier failed");
  };
  const eventResult = await verifyAndReconcileLocalRevocationJournal(eventFailure.options);
  assert.equal(eventResult.status, "JOURNAL_INVALID");
  assert.equal(eventResult.reason, "revocation-signature-verifier-failed");

  const checkpointFailure = makeFixture(1, 0);
  checkpointFailure.options.verifyCheckpointToken = async () => {
    throw new Error("checkpoint verifier failed");
  };
  const checkpointResult = await verifyAndReconcileLocalRevocationJournal(checkpointFailure.options);
  assert.equal(checkpointResult.status, "CHECKPOINT_INVALID");
  assert.equal(checkpointResult.reason, "checkpoint-signature-verifier-failed");
});

test("bounds the journal size and event shape before reconciliation", async () => {
  const fixture = makeFixture(1, 0);
  fixture.options.events = [{ ...fixture.events[0], extra: true }];
  const shapeResult = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(shapeResult.allowed, false);
  assert.equal(shapeResult.reason, "event-sequence-or-link-mismatch");

  fixture.options.events = new Array(100001);
  const sizeResult = await verifyAndReconcileLocalRevocationJournal(fixture.options);
  assert.equal(sizeResult.allowed, false);
  assert.equal(sizeResult.reason, "invalid-journal-size");
});
