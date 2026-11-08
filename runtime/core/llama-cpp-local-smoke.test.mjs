import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(here, "llama-cpp-local-smoke.mjs");

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    timeout: 5_000
  });
}

test("help is available without contacting a provider", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--confirm-local-inference/);
  assert.match(result.stdout, /No API key option, remote endpoint, tool dispatch or remote fallback/);
});

test("refuses to infer without explicit operator confirmation", () => {
  const result = run(["--model-id", "test-local-alias"]);
  assert.equal(result.status, 64);
  assert.match(result.stderr, /--confirm-local-inference is required/);
  assert.doesNotMatch(result.stdout + result.stderr, /"stage":"health"/);
});

test("refuses to infer without an explicit server model identity", () => {
  const result = run(["--confirm-local-inference"]);
  assert.equal(result.status, 64);
  assert.match(result.stderr, /--model-id is required/);
});

test("rejects unknown options rather than silently accepting configuration", () => {
  const result = run(["--confirm-local-inference", "--model-id", "test-local-alias", "--api-key", "secret"]);
  assert.equal(result.status, 64);
  assert.match(result.stderr, /Unsupported argument: --api-key/);
});
