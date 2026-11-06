import test from "node:test";
import assert from "node:assert/strict";
import { normalizePageSize } from "../src/page-size.mjs";

test("invalid values use the documented default", () => {
  assert.equal(normalizePageSize(0), 10);
  assert.equal(normalizePageSize(-1), 10);
  assert.equal(normalizePageSize(1.5), 10);
  assert.equal(normalizePageSize("not-a-number"), 10);
});

test("ordinary valid page sizes are preserved", () => {
  assert.equal(normalizePageSize(1), 1);
  assert.equal(normalizePageSize(25), 25);
  assert.equal(normalizePageSize(50), 50);
});

test("values above the maximum are capped at 50", () => {
  assert.equal(normalizePageSize(51), 50);
  assert.equal(normalizePageSize(500), 50);
});
