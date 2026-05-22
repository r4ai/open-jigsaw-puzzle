import { appendFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const databaseName = process.argv[2];
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

if (!databaseName) {
  throw new Error("Usage: node scripts/ensure-preview-d1.mjs <database-name>");
}

const infoResult = await runWrangler(["d1", "info", databaseName, "--json"], { allowFailure: true });
let databaseId = null;

if (infoResult.status === 0) {
  databaseId = findUuid(JSON.parse(infoResult.stdout));
} else if (!isMissingDatabase(infoResult.stderr + infoResult.stdout)) {
  process.stderr.write(infoResult.stderr);
  process.stdout.write(infoResult.stdout);
  throw new Error(`Unable to inspect D1 database "${databaseName}".`);
}

if (!databaseId) {
  const createResult = await runWrangler(["d1", "create", databaseName]);
  databaseId = findUuid(createResult.stdout + createResult.stderr);
}

if (!databaseId) {
  throw new Error(`Unable to determine D1 database id for "${databaseName}".`);
}

console.log(`Preview D1 database ${databaseName} is ready: ${databaseId}`);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `database_id=${databaseId}\n`, "utf8");
}

function isMissingDatabase(output) {
  return /not found|could not find|does not exist|Couldn't find/i.test(output);
}

function findUuid(value) {
  if (typeof value === "string") {
    return value.match(uuidPattern)?.[0] ?? null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const uuid = findUuid(item);
      if (uuid) return uuid;
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const uuid = findUuid(item);
      if (uuid) return uuid;
    }
  }

  return null;
}

function runWrangler(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("wrangler", args, {
      cwd: new URL("..", import.meta.url),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      const result = { status, stdout, stderr };
      if (status === 0 || options.allowFailure) {
        resolve(result);
        return;
      }
      process.stderr.write(stderr);
      process.stdout.write(stdout);
      reject(new Error(`wrangler ${args.join(" ")} failed with exit code ${status}.`));
    });
  });
}
