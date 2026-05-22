import { describe, expect, it } from "vitest";
import { prepareWranglerConfig } from "./wrangler-config.mjs";

const sourceConfig = `{
  "name": "open-jigsaw-puzzle",
  "main": "src/index.ts",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "open-jigsaw-puzzle",
      "database_id": "__DB_DATABASE_ID__"
    }
  ]
}
`;

const productionEnv = {
  OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID: "00000000-0000-4000-8000-000000000000",
};

describe("prepareWranglerConfig", () => {
  it("keeps production names when preview overrides are not set", () => {
    const config = JSON.parse(prepareWranglerConfig(sourceConfig, productionEnv));

    expect(config.name).toBe("open-jigsaw-puzzle");
    expect(config.d1_databases[0].database_name).toBe("open-jigsaw-puzzle");
    expect(config.d1_databases[0].database_id).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("applies preview worker and D1 names", () => {
    const config = JSON.parse(prepareWranglerConfig(sourceConfig, {
      ...productionEnv,
      OPEN_JIGSAW_PUZZLE_WORKER_NAME: "open-jigsaw-puzzle-pr-123",
      OPEN_JIGSAW_PUZZLE_D1_DATABASE_NAME: "open-jigsaw-puzzle-pr-123",
    }));

    expect(config.name).toBe("open-jigsaw-puzzle-pr-123");
    expect(config.d1_databases[0].database_name).toBe("open-jigsaw-puzzle-pr-123");
    expect(config.d1_databases[0].database_id).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("applies a preview custom domain route", () => {
    const config = JSON.parse(prepareWranglerConfig(sourceConfig, {
      ...productionEnv,
      OPEN_JIGSAW_PUZZLE_CUSTOM_DOMAIN_HOST: "pr-123.puzzle.r4ai.dev",
    }));

    expect(config.workers_dev).toBe(false);
    expect(config.routes).toEqual([{ pattern: "pr-123.puzzle.r4ai.dev", custom_domain: true }]);
  });

  it("rejects invalid preview worker names", () => {
    expect(() => prepareWranglerConfig(sourceConfig, {
      ...productionEnv,
      OPEN_JIGSAW_PUZZLE_WORKER_NAME: "Open_Jigsaw_Puzzle_PR_123",
    })).toThrow("Invalid Worker name");
  });

  it("rejects invalid D1 database ids", () => {
    expect(() => prepareWranglerConfig(sourceConfig, {
      OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID: "not-a-uuid",
    })).toThrow("Invalid D1 database_id");
  });

  it("rejects invalid preview custom domain hosts", () => {
    expect(() => prepareWranglerConfig(sourceConfig, {
      ...productionEnv,
      OPEN_JIGSAW_PUZZLE_CUSTOM_DOMAIN_HOST: "https://pr-123.puzzle.r4ai.dev",
    })).toThrow("Invalid custom domain host");
  });
});
