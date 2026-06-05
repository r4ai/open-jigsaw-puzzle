import { describe, expect, it } from "vitest";

import { ensurePreviewD1 } from "./ensure-preview-d1.ts";
import type { WranglerResult } from "./workflow-helpers.ts";

describe("ensurePreviewD1", () => {
  it("reads the database id after create when wrangler create output omits it", () => {
    const calls: string[][] = [];
    const outputs: Record<string, string> = {};
    const databaseId = "00000000-0000-4000-8000-000000000123";

    const id = ensurePreviewD1({
      databaseName: "open-jigsaw-puzzle-pr-8",
      run: (args): WranglerResult => {
        calls.push(args);
        if (args[1] === "info" && calls.length === 1) {
          return { status: 1, stdout: "", stderr: "Couldn't find D1 database" };
        }
        if (args[1] === "create") {
          return { status: 0, stdout: "Created database open-jigsaw-puzzle-pr-8\n", stderr: "" };
        }
        if (args[1] === "info") {
          return {
            status: 0,
            stdout: JSON.stringify({ name: "open-jigsaw-puzzle-pr-8", uuid: databaseId }),
            stderr: "",
          };
        }
        throw new Error(`Unexpected wrangler args: ${args.join(" ")}`);
      },
      writeOutput: (name, value) => {
        outputs[name] = value;
      },
    });

    expect(id).toBe(databaseId);
    expect(outputs.database_id).toBe(databaseId);
    expect(calls).toEqual([
      ["d1", "info", "open-jigsaw-puzzle-pr-8", "--json"],
      ["d1", "create", "open-jigsaw-puzzle-pr-8"],
      ["d1", "info", "open-jigsaw-puzzle-pr-8", "--json"],
    ]);
  });

  it("accepts nested database ids from wrangler info JSON", () => {
    const databaseId = "00000000-0000-4000-8000-000000000456";

    expect(
      ensurePreviewD1({
        databaseName: "open-jigsaw-puzzle-pr-8",
        run: (): WranglerResult => ({
          status: 0,
          stdout: JSON.stringify({ result: { database: { id: databaseId } } }),
          stderr: "",
        }),
        writeOutput: () => {},
      }),
    ).toBe(databaseId);
  });
});
