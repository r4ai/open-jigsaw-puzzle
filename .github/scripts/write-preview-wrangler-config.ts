import { writeFileSync } from "node:fs";
import { buildWranglerConfig, requiredEnv } from "./workflow-helpers.ts";

const workerName = requiredEnv("PREVIEW_NAME");
const config = buildWranglerConfig({
  workerName,
  databaseName: workerName,
  databaseId: requiredEnv("OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID"),
  customDomainHost: requiredEnv("PREVIEW_HOST"),
});

writeFileSync("apps/api/wrangler.preview.jsonc", `${JSON.stringify(config, null, 2)}\n`, "utf8");
