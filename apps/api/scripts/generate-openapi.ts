import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateSpecs } from "hono-openapi";
import { createApp } from "../src/presentation/http/app";
import { OPENAPI_DOCUMENTATION } from "../src/presentation/http/openapi";

const outputPath = resolve("apps/api/openapi.json");
const spec = await generateSpecs(createApp(), {
  documentation: OPENAPI_DOCUMENTATION,
  exclude: ["/api/openapi.json", "/api/rooms/{roomId}/socket"],
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`);
