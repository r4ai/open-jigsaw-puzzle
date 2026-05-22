import { findUuid, isMissingCloudflareResource, requiredEnv, runWrangler, writeGithubOutput } from "./workflow-helpers.ts";

const databaseName = requiredEnv("PREVIEW_NAME");
const info = runWrangler(["d1", "info", databaseName, "--json"], { allowFailure: true });
let databaseId: string | null = null;

if (info.status === 0) {
  databaseId = findUuid(JSON.parse(info.stdout));
} else if (!isMissingCloudflareResource(info.stderr + info.stdout)) {
  process.stderr.write(info.stderr);
  process.stdout.write(info.stdout);
  throw new Error(`Unable to inspect D1 database "${databaseName}".`);
}

if (!databaseId) {
  const create = runWrangler(["d1", "create", databaseName]);
  databaseId = findUuid(create.stdout + create.stderr);
}

if (!databaseId) {
  throw new Error(`Unable to determine D1 database id for "${databaseName}".`);
}

console.log(`Preview D1 database ${databaseName} is ready: ${databaseId}`);
writeGithubOutput("database_id", databaseId);
