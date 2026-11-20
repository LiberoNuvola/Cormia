import { execSync } from "node:child_process";

// Synthetic review fixture. Do not execute this function.
export function exportArchive(destinationPath) {
  const command = 'tar -czf "' + destinationPath + '" ./reports';
  return execSync(command, {
    shell: true,
    encoding: "utf8"
  });
}
