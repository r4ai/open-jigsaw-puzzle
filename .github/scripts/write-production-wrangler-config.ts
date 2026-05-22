import { writeFileSync } from "node:fs";
import { buildWranglerConfig, requiredEnv } from "./workflow-helpers.ts";

const config = buildWranglerConfig({
  workerName: "open-jigsaw-puzzle",
  databaseName: "open-jigsaw-puzzle",
  databaseId: requiredEnv("OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID"),
});

writeFileSync("apps/api/wrangler.production.jsonc", `${JSON.stringify(config, null, 2)}\n`, "utf8");
