import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const workerNamePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const d1DatabaseNamePattern = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/;
const domainLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type WranglerResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type WorkerConfigOptions = {
  workerName: string;
  databaseName: string;
  databaseId: string;
  customDomainHost?: string;
};

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function writeGithubOutput(name: string, value: string): void {
  const outputPath = requiredEnv("GITHUB_OUTPUT");
  appendFileSync(outputPath, `${name}=${value}\n`, "utf8");
}

export function runWrangler(args: string[], options: { allowFailure?: boolean } = {}): WranglerResult {
  const result = spawnSync("wrangler", args, { encoding: "utf8" });
  const output = {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };

  if (output.status === 0 || options.allowFailure) return output;

  process.stderr.write(output.stderr);
  process.stdout.write(output.stdout);
  throw new Error(`wrangler ${args.join(" ")} failed with exit code ${output.status}.`);
}

export function findUuid(value: unknown): string | null {
  if (typeof value === "string") return value.match(uuidPattern)?.[0] ?? null;

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

// Matches wrangler@4.x error messages. Update this pattern when upgrading WRANGLER_VERSION.
export function isMissingCloudflareResource(output: string): boolean {
  return /not found|could not find|does not exist|Couldn't find/i.test(output);
}

export function buildWranglerConfig(options: WorkerConfigOptions): Record<string, unknown> {
  validateWorkerName(options.workerName);
  validateD1DatabaseName(options.databaseName);
  validateDatabaseId(options.databaseId);

  const config: Record<string, unknown> = {
    name: options.workerName,
    main: "dist/worker/index.js",
    compatibility_date: "2026-05-16",
    assets: {
      directory: "../web/dist",
      binding: "ASSETS",
    },
    durable_objects: {
      bindings: [
        {
          name: "ROOMS",
          class_name: "PuzzleRoom",
        },
      ],
    },
    migrations: [
      {
        tag: "v1",
        new_sqlite_classes: ["PuzzleRoom"],
      },
    ],
    triggers: {
      crons: ["17 * * * *"],
    },
    d1_databases: [
      {
        binding: "DB",
        database_name: options.databaseName,
        database_id: options.databaseId,
        migrations_dir: "migrations",
      },
    ],
    vars: {
      ROOM_TTL_SECONDS: "7200",
      MAX_PARTICIPANTS: "6",
      EXPIRED_ROOM_RETENTION_SECONDS: "86400",
      CLEANUP_BATCH_SIZE: "500",
      TURN_URLS: "",
      TURN_USERNAME: "",
      TURN_CREDENTIAL: "",
    },
  };

  if (options.customDomainHost) {
    validateHostname(options.customDomainHost);
    config.workers_dev = false;
    config.routes = [{ pattern: options.customDomainHost, custom_domain: true }];
  }

  return config;
}

export function validateDatabaseId(databaseId: string): void {
  if (!uuidPattern.test(databaseId)) throw new Error("Invalid D1 database id.");
}

function validateWorkerName(workerName: string): void {
  if (!workerNamePattern.test(workerName)) throw new Error("Invalid Worker name.");
}

function validateD1DatabaseName(databaseName: string): void {
  if (!d1DatabaseNamePattern.test(databaseName)) throw new Error("Invalid D1 database name.");
}

function validateHostname(hostname: string): void {
  if (hostname.length > 253 || hostname.includes("://") || hostname.includes("/") || hostname.includes(":")) {
    throw new Error("Invalid custom domain host.");
  }

  const labels = hostname.split(".");
  if (labels.length < 2 || !labels.every((label) => domainLabelPattern.test(label))) {
    throw new Error("Invalid custom domain host.");
  }
}
