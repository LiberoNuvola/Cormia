/**
 * Fixed capability mapping for the existing read-only CodingWorkspace bridge.
 *
 * Protocol operation IDs use the proposed AEP names (workspace.list/read/
 * diff/verify); the legacy CodingWorkspace method names remain behind this
 * adapter. No write, patch, test, shell, Git or remote operation is exposed.
 */

const OPERATION_MAP = Object.freeze({
  "workspace.list": "workspace_list",
  "workspace.read": "workspace_read",
  "workspace.diff": "workspace_diff",
  "workspace.verify": "workspace_verify"
});

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, required, optional = []) {
  if (!isPlainObject(value)) return false;
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== "string" || !allowed.has(key))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some(key => {
    const descriptor = descriptors[key];
    return !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value");
  })) return false;
  return required.every(key => Object.hasOwn(value, key));
}

function requirePathBinding(context, expectedPath, operation) {
  if (context.phase !== "PLAN" ||
      typeof context.relativePath !== "string" ||
      context.relativePath !== expectedPath) {
    throw new TypeError(operation + " relativePath must exactly match the input path.");
  }
}

export function createReadOnlyCodingWorkspaceOperationAdapters({
  readOnlyWorkspace
} = {}) {
  if (!readOnlyWorkspace ||
      typeof readOnlyWorkspace.validateInput !== "function" ||
      typeof readOnlyWorkspace.list !== "function" ||
      typeof readOnlyWorkspace.read !== "function" ||
      typeof readOnlyWorkspace.diff !== "function" ||
      typeof readOnlyWorkspace.verify !== "function") {
    throw new TypeError("A validated read-only CodingWorkspace adapter is required.");
  }

  function makeAdapter(protocolOperation, execute) {
    const legacyOperation = OPERATION_MAP[protocolOperation];
    return Object.freeze({
      validateInput(input, context) {
        if (!isPlainObject(context) ||
            context.operation !== protocolOperation ||
            context.phase !== "PLAN") {
          throw new TypeError("Read-only CodingWorkspace PLAN validation context is invalid.");
        }

        const normalized = readOnlyWorkspace.validateInput(legacyOperation, input);
        if (protocolOperation === "workspace.list") {
          if (!exactKeys(normalized, ["path"])) {
            throw new TypeError("workspace.list normalized input is invalid.");
          }
          requirePathBinding(context, normalized.path, protocolOperation);
        } else if (
          protocolOperation === "workspace.read" ||
          protocolOperation === "workspace.diff"
        ) {
          if (!exactKeys(normalized, ["path"])) {
            throw new TypeError(protocolOperation + " normalized input is invalid.");
          }
          requirePathBinding(context, normalized.path, protocolOperation);
        } else if (protocolOperation === "workspace.verify") {
          if (!exactKeys(normalized, ["paths"]) ||
              !Array.isArray(normalized.paths) ||
              normalized.paths.length !== 1) {
            throw new TypeError("workspace.verify requires exactly one scoped path per step.");
          }
          requirePathBinding(context, normalized.paths[0], protocolOperation);
        }
        return normalized;
      },

      async execute(context) {
        if (!isPlainObject(context) ||
            context.operation !== protocolOperation ||
            !isPlainObject(context.input)) {
          throw new TypeError("Read-only CodingWorkspace execution context is invalid.");
        }
        return execute(context.input);
      }
    });
  }

  return Object.freeze({
    "workspace.list": makeAdapter(
      "workspace.list",
      input => readOnlyWorkspace.list({ path: input.path })
    ),
    "workspace.read": makeAdapter(
      "workspace.read",
      input => readOnlyWorkspace.read({ path: input.path })
    ),
    "workspace.diff": makeAdapter(
      "workspace.diff",
      input => readOnlyWorkspace.diff({ path: input.path })
    ),
    "workspace.verify": makeAdapter(
      "workspace.verify",
      input => readOnlyWorkspace.verify({ paths: input.paths })
    )
  });
}
