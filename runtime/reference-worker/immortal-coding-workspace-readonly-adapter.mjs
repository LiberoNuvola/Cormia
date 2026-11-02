/**
 * Read-only, host-scoped adapter for the existing IMMORTAL CodingWorkspace.
 *
 * This adapter deliberately exposes only list/read/diff/verify. Mutating
 * operations (write/patch/test) are not part of its exported operation set.
 * File and directory allowlists must be injected by trusted host code.
 */
export const CODING_READ_ONLY_OPERATIONS = Object.freeze([
  "workspace_list",
  "workspace_read",
  "workspace_diff",
  "workspace_verify"
]);

const OPERATION_SET = new Set(CODING_READ_ONLY_OPERATIONS);
const MAX_VERIFY_PATHS = 100;

function normalizeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new Error("A non-empty relative path is required.");
  }
  const portable = value.replace(/\\/g, "/");
  if (portable.startsWith("/") || portable.startsWith("//") || /^[A-Za-z]:/.test(portable)) {
    throw new Error("Absolute, drive and UNC paths are prohibited.");
  }
  const segments = portable.split("/");
  if (segments.some(segment => segment === "" || segment === "." || segment === "..")) {
    throw new Error("Path traversal or non-canonical path is prohibited.");
  }
  if (segments.some(segment => /[<>:"|?*\x00-\x1f]/.test(segment))) {
    throw new Error("Path contains prohibited characters.");
  }
  return segments.join("/");
}

function requireExactKeys(args, allowed, required) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be an object.");
  }
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) throw new Error("Unexpected argument: " + key);
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(args, key)) {
      throw new Error("Missing required argument: " + key);
    }
  }
}

function buildScope({ readableFiles, listableDirectories }) {
  if (!Array.isArray(readableFiles) || !Array.isArray(listableDirectories)) {
    throw new TypeError("Trusted host must provide readableFiles and listableDirectories arrays.");
  }
  const files = new Set(readableFiles.map(normalizeRelativePath));
  const directories = new Set(listableDirectories.map(value => {
    if (value === ".") return ".";
    return normalizeRelativePath(value);
  }));
  return { files, directories };
}

export function createReadOnlyCodingWorkspaceAdapter({
  codingWorkspace,
  readableFiles,
  listableDirectories
} = {}) {
  if (!codingWorkspace || typeof codingWorkspace.callTool !== "function" ||
      typeof codingWorkspace.isTool !== "function" ||
      typeof codingWorkspace.requiresApproval !== "function") {
    throw new TypeError("CodingWorkspace must implement callTool, isTool and requiresApproval.");
  }

  const scope = buildScope({ readableFiles, listableDirectories });

  async function invoke(operation, args) {
    if (!OPERATION_SET.has(operation)) {
      throw new Error("Coding Workspace operation is not exposed by the read-only adapter.");
    }
    if (!codingWorkspace.isTool(operation)) {
      throw new Error("CodingWorkspace does not recognize the requested operation.");
    }
    if (codingWorkspace.requiresApproval(operation) !== false) {
      throw new Error("Read-only adapter refuses any operation requiring host approval.");
    }
    return codingWorkspace.callTool(operation, args);
  }

  return Object.freeze({
    operations: CODING_READ_ONLY_OPERATIONS,

    async list({ path = "." } = {}) {
      requireExactKeys(arguments[0] ?? {}, ["path"], []);
      const normalized = path === "." ? "." : normalizeRelativePath(path);
      if (!scope.directories.has(normalized)) {
        throw new Error("Directory is not in the trusted host listableDirectories allowlist.");
      }
      return invoke("workspace_list", normalized === "." ? {} : { path: normalized });
    },

    async read({ path } = {}) {
      requireExactKeys(arguments[0] ?? {}, ["path"], ["path"]);
      const normalized = normalizeRelativePath(path);
      if (!scope.files.has(normalized)) {
        throw new Error("File is not in the trusted host readableFiles allowlist.");
      }
      return invoke("workspace_read", { path: normalized });
    },

    async diff({ path } = {}) {
      requireExactKeys(arguments[0] ?? {}, ["path"], ["path"]);
      const normalized = normalizeRelativePath(path);
      if (!scope.files.has(normalized)) {
        throw new Error("File is not in the trusted host readableFiles allowlist.");
      }
      return invoke("workspace_diff", { path: normalized });
    },

    async verify({ paths } = {}) {
      requireExactKeys(arguments[0] ?? {}, ["paths"], ["paths"]);
      if (!Array.isArray(paths) || paths.length < 1 || paths.length > MAX_VERIFY_PATHS) {
        throw new Error("verify requires 1-100 explicitly allowlisted paths.");
      }
      const normalized = paths.map(normalizeRelativePath);
      if (new Set(normalized).size !== normalized.length) {
        throw new Error("Duplicate verify paths are prohibited.");
      }
      for (const item of normalized) {
        if (!scope.files.has(item)) {
          throw new Error("Verify path is not in the trusted host readableFiles allowlist.");
        }
      }
      return invoke("workspace_verify", { paths: normalized });
    }
  });
}
