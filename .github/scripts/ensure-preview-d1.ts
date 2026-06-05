import { pathToFileURL } from "node:url";
import {
  findUuid,
  isMissingCloudflareResource,
  requiredEnv,
  runWrangler,
  validateDatabaseId,
  writeGithubOutput,
  type WranglerResult,
} from "./workflow-helpers.ts";

type EnsurePreviewD1Options = {
  databaseName: string;
  run: (args: string[], options?: { allowFailure?: boolean }) => WranglerResult;
  writeOutput: (name: string, value: string) => void;
};

export function ensurePreviewD1({ databaseName, run, writeOutput }: EnsurePreviewD1Options): string {
  let databaseId = readDatabaseId(databaseName, run);

  if (!databaseId) {
    const create = run(["d1", "create", databaseName]);
    databaseId = findUuid(create.stdout + create.stderr);
    if (!databaseId) databaseId = readDatabaseId(databaseName, run);
  }

  if (!databaseId) {
    throw new Error(`Unable to determine D1 database id for "${databaseName}".`);
  }

  validateDatabaseId(databaseId);
  console.log(`Preview D1 database ${databaseName} is ready: ${databaseId}`);
  writeOutput("database_id", databaseId);
  return databaseId;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ensurePreviewD1({
    databaseName: requiredEnv("PREVIEW_NAME"),
    run: runWrangler,
    writeOutput: writeGithubOutput,
  });
}

function readDatabaseId(
  name: string,
  run: (args: string[], options?: { allowFailure?: boolean }) => WranglerResult,
): string | null {
  const info = run(["d1", "info", name, "--json"], { allowFailure: true });
  if (info.status !== 0) {
    if (isMissingCloudflareResource(info.stderr + info.stdout)) return null;
    process.stderr.write(info.stderr);
    process.stdout.write(info.stdout);
    throw new Error(`Unable to inspect D1 database "${name}".`);
  }

  const databaseId = findUuid(JSON.parse(info.stdout));
  if (!databaseId) throw new Error(`Unexpected d1 info response: no database UUID in JSON output.`);
  validateDatabaseId(databaseId);
  return databaseId;
}
