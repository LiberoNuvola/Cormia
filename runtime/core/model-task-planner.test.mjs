import test from "node:test";
import assert from "node:assert/strict";

import {
  createDeterministicModelProvider
} from "./deterministic-model-provider.mjs";
import {
  createModelTaskPlanner,
  createModelBackedTaskExecutor,
  ModelTaskPlannerError
} from "./model-task-planner.mjs";
import { PLAN_PROPOSAL_CONTRACT_VERSION } from "./plan-execute-capability-broker.mjs";

const PROJECT_REF = "project:immortal";
const TASK_REF = "task:immortal-read";
const MANIFEST_DIGEST = "sha256:" + "a".repeat(64);
const NOW = "2026-11-08T06:30:00.000Z";

function task() {
  return {
    projectRef: PROJECT_REF,
    taskRef: TASK_REF,
    manifestDigest: MANIFEST_DIGEST,
    goal: "Inspect the runtime module and verify its current syntax.",
    sourceRef: "source:operator-request",
    dependsOn: [],
    maxAttempts: 3,
    state: "running",
    attempt: 1,
    workerRef: "worker:cormia-supervisor",
    createdAt: NOW,
    updatedAt: NOW,
    createdSequence: 1,
    lastCheckpointRef: null,
    lastEffectBoundary: null,
    checkpointRefs: [],
    evidenceRefs: [],
    reasonCode: "test"
  };
}

function proposal() {
  return {
    contractVersion: PLAN_PROPOSAL_CONTRACT_VERSION,
    steps: [{
      operation: "workspace.read",
      input: { path: "runtime/core/README.md" },
      relativePath: "runtime/core/README.md"
    }]
  };
}

function taskContextProvider(overrides = {}) {
  return {
    async resolveVerifiedPlanningContext({ taskRef, projectRef }) {
      return {
        taskRef,
        projectRef,
        manifestDigest: MANIFEST_DIGEST,
        requestedOperations: ["workspace.read", "workspace.verify"],
        ...overrides
      };
    }
  };
}

function fakeProvider({
  content = JSON.stringify(proposal()),
  healthStatus = "ready",
  locality = "local",
  responseWarnings = []
} = {}) {
  const requests = [];
  const descriptor = {
    contractVersion: "cormia.model-provider/0.1",
    providerAdapterId: "cormia.synthetic",
    adapterVersion: "0.1.0",
    providerInstanceRef: "provider:planner-test",
    locality,
    endpointClass: "host_process",
    observedModelId: "synthetic-planner-v1",
    inferenceRuntime: { name: "cormia-test-double", version: "0.1.0" },
    featureHints: ["structured_json", "best_effort_cancel"]
  };
  const provider = {
    async describe() { return descriptor; },
    async health() {
      return {
        providerInstanceRef: descriptor.providerInstanceRef,
        observedAt: NOW,
        status: healthStatus
      };
    },
    async generate(request) {
      requests.push(request);
      return {
        contractVersion: "cormia.model-provider/0.1",
        requestRef: request.requestRef,
        providerRequestRef: "provider-request:planner-test",
        observedProvider: {
          providerAdapterId: descriptor.providerAdapterId,
          providerInstanceRef: descriptor.providerInstanceRef,
          observedModelId: descriptor.observedModelId
        },
        output: { format: "json", content },
        finishReason: "completed",
        warnings: responseWarnings
      };
    }
  };
  return { provider, requests, descriptor };
}

function makePlanner(options = {}) {
  const model = fakeProvider(options);
  const planner = createModelTaskPlanner({
    modelProvider: model.provider,
    taskContextProvider: taskContextProvider(),
    generationProfileRef: "profile:granite-plan",
    clock: () => new Date(NOW),
    idFactory: () => "model-request:planner-test"
  });
  return { planner, model };
}

test("planner builds a host-pinned JSON request and returns a bounded inert proposal", async () => {
  const { planner, model } = makePlanner();
  const result = await planner.proposeTaskPlan({
    projectRef: PROJECT_REF,
    task: task(),
    attempt: 1
  });

  assert.equal(result.projectRef, PROJECT_REF);
  assert.equal(result.taskRef, TASK_REF);
  assert.equal(result.manifestDigest, MANIFEST_DIGEST);
  assert.equal(result.providerInstanceRef, "provider:planner-test");
  assert.match(result.responseDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(result.proposal, proposal());
  assert.equal(model.requests.length, 1);
  const request = model.requests[0];
  assert.equal(request.purpose, "plan");
  assert.equal(request.outputContract.format, "json");
  assert.equal(request.outputContract.schemaRef, PLAN_PROPOSAL_CONTRACT_VERSION);
  assert.deepEqual(request.input.map(item => item.kind), ["instruction", "text"]);
  const suppliedTask = JSON.parse(request.input[1].text);
  assert.deepEqual(suppliedTask.requestedOperations, ["workspace.read", "workspace.verify"]);
  assert.equal(suppliedTask.goal, task().goal);
  assert.equal(Object.hasOwn(request, "tools"), false);
  assert.equal(Object.hasOwn(request, "dispatch"), false);
});

test("planner rejects a manifest-context digest mismatch before model inference", async () => {
  const model = fakeProvider();
  const planner = createModelTaskPlanner({
    modelProvider: model.provider,
    taskContextProvider: taskContextProvider({ manifestDigest: "sha256:" + "b".repeat(64) }),
    generationProfileRef: "profile:granite-plan",
    clock: () => new Date(NOW)
  });
  await assert.rejects(
    planner.proposeTaskPlan({ projectRef: PROJECT_REF, task: task(), attempt: 1 }),
    error => error.code === "VERIFIED_PLANNING_CONTEXT_INVALID"
  );
  assert.equal(model.requests.length, 0);
});

test("planner rejects an operation not present in the verified Task Manifest projection", async () => {
  const response = {
    contractVersion: PLAN_PROPOSAL_CONTRACT_VERSION,
    steps: [{ operation: "workspace.create", input: {}, relativePath: "new-file.txt" }]
  };
  const { planner } = makePlanner({ content: JSON.stringify(response) });
  await assert.rejects(
    planner.proposeTaskPlan({ projectRef: PROJECT_REF, task: task(), attempt: 1 }),
    error => error.code === "MODEL_PLAN_STEP_INVALID"
  );
});

test("planner rejects malformed JSON and inert tool-call data", async () => {
  const malformed = makePlanner({ content: "not-json" });
  await assert.rejects(
    malformed.planner.proposeTaskPlan({ projectRef: PROJECT_REF, task: task(), attempt: 1 }),
    error => error.code === "MODEL_PLAN_JSON_INVALID"
  );

  const toolCalls = makePlanner({
    content: JSON.stringify({
      content: null,
      toolCalls: [{ name: "workspace_write", arguments: { path: "x", content: "x" } }]
    })
  });
  await assert.rejects(
    toolCalls.planner.proposeTaskPlan({ projectRef: PROJECT_REF, task: task(), attempt: 1 }),
    error => error.code === "MODEL_PLAN_PROPOSAL_INVALID"
  );
});

test("planner requires a ready local host-pinned provider and clean completion", async () => {
  const degraded = makePlanner({ healthStatus: "degraded" });
  await assert.rejects(
    degraded.planner.proposeTaskPlan({ projectRef: PROJECT_REF, task: task(), attempt: 1 }),
    error => error.code === "MODEL_PROVIDER_NOT_READY"
  );
  assert.equal(degraded.model.requests.length, 0);

  const remote = makePlanner({ locality: "remote" });
  await assert.rejects(
    remote.planner.proposeTaskPlan({ projectRef: PROJECT_REF, task: task(), attempt: 1 }),
    error => error.code === "MODEL_PROVIDER_NOT_LOCAL"
  );
  assert.equal(remote.model.requests.length, 0);

  const warning = makePlanner({ responseWarnings: ["provider_tool_call_data_inert"] });
  await assert.rejects(
    warning.planner.proposeTaskPlan({ projectRef: PROJECT_REF, task: task(), attempt: 1 }),
    error => error.code === "MODEL_GENERATION_NOT_COMPLETED_CLEANLY"
  );
});

test("planner refuses caller-selected or task-mismatched project identity", async () => {
  const { planner, model } = makePlanner();
  await assert.rejects(
    planner.proposeTaskPlan({
      projectRef: PROJECT_REF,
      task: { ...task(), projectRef: PROJECT_B },
      attempt: 1
    }),
    error => error.code === "MODEL_TASK_INPUT_INVALID"
  );
  assert.equal(model.requests.length, 0);
});

test("model-backed executor composes PLAN, durable pre-execute checkpoint, EXECUTE and verifier", async () => {
  const generated = {
    requestRef: "model-request:one",
    proposal: proposal()
  };
  const calls = [];
  const executor = createModelBackedTaskExecutor({
    planner: {
      async proposeTaskPlan(input) {
        calls.push({ method: "plan", input });
        return generated;
      }
    },
    resultVerifier: {
      async verifyTaskResult(input) {
        calls.push({ method: "verify", input });
        return { verified: true, evidenceRefs: ["evidence:workspace-verified"] };
      }
    }
  });

  const result = await executor.executeTask({
    projectRef: PROJECT_REF,
    task: task(),
    attempt: 1,
    async preparePlan(value) {
      calls.push({ method: "prepare", value });
      return {
        accepted: true,
        planRef: "plan:one",
        planDigest: "sha256:" + "c".repeat(64),
        stepCount: 1
      };
    },
    async checkpoint(value) {
      calls.push({ method: "checkpoint", value });
      return { appended: true };
    },
    async executePlan(planRef, digest) {
      calls.push({ method: "execute", planRef, digest });
      return {
        executed: true,
        state: "COMPLETED",
        completedStepCount: 1,
        steps: [{ operation: "workspace.read" }]
      };
    }
  });

  assert.deepEqual(result, {
    state: "completed",
    evidenceRefs: ["evidence:workspace-verified"]
  });
  assert.deepEqual(calls.map(call => call.method), [
    "plan", "prepare", "checkpoint", "execute", "verify"
  ]);
  assert.equal(calls[3].planRef, "plan:one");
  assert.equal(calls[2].value.effectBoundary, "unknown");
});

test("model-backed executor blocks rejected plans without EXECUTE", async () => {
  let executeCalls = 0;
  const executor = createModelBackedTaskExecutor({
    planner: { async proposeTaskPlan() { return { proposal: proposal() }; } },
    resultVerifier: { async verifyTaskResult() { throw new Error("must not be called"); } }
  });
  const result = await executor.executeTask({
    projectRef: PROJECT_REF,
    task: task(),
    attempt: 1,
    async preparePlan() {
      return { accepted: false, reason: "OPERATION_NOT_AUTHORIZED" };
    },
    async checkpoint() { throw new Error("must not checkpoint"); },
    async executePlan() { executeCalls += 1; }
  });
  assert.equal(result.state, "blocked");
  assert.equal(result.reasonCode, "OPERATION_NOT_AUTHORIZED");
  assert.equal(executeCalls, 0);
});

test("model-backed executor throws after uncertain execution failure so Supervisor recovers the attempt", async () => {
  const executor = createModelBackedTaskExecutor({
    planner: { async proposeTaskPlan() { return { requestRef: "request:two", proposal: proposal() }; } },
    resultVerifier: { async verifyTaskResult() { return { verified: true, evidenceRefs: ["evidence:x"] }; } }
  });
  await assert.rejects(
    executor.executeTask({
      projectRef: PROJECT_REF,
      task: task(),
      attempt: 1,
      async preparePlan() {
        return {
          accepted: true,
          planRef: "plan:partial",
          planDigest: "sha256:" + "d".repeat(64),
          stepCount: 1
        };
      },
      async checkpoint() {},
      async executePlan() {
        return { executed: false, state: "FAILED", completedStepCount: 0 };
      }
    }),
    error => error instanceof ModelTaskPlannerError &&
      error.code === "PLAN_EXECUTION_REQUIRES_RECONCILIATION"
  );
});

test("model-backed executor refuses completion without independently persisted evidence", async () => {
  const executor = createModelBackedTaskExecutor({
    planner: { async proposeTaskPlan() { return { proposal: proposal() }; } },
    resultVerifier: {
      async verifyTaskResult() {
        return { verified: true, evidenceRefs: [] };
      }
    }
  });
  await assert.rejects(
    executor.executeTask({
      projectRef: PROJECT_REF,
      task: task(),
      attempt: 1,
      async preparePlan() {
        return {
          accepted: true,
          planRef: "plan:without-evidence",
          planDigest: "sha256:" + "e".repeat(64),
          stepCount: 1
        };
      },
      async checkpoint() {},
      async executePlan() {
        return { executed: true, state: "COMPLETED", completedStepCount: 1 };
      }
    }),
    error => error.code === "TASK_RESULT_NOT_VERIFIED"
  );
});
