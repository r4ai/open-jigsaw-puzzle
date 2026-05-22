import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareWranglerConfig } from "./wrangler-config.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const sourcePath = join(appDir, "wrangler.jsonc");
const outputPath = join(appDir, "wrangler.generated.jsonc");

await loadLocalEnv(join(appDir, ".dev.vars"));
await loadLocalEnv(join(appDir, ".env"));

const config = await readFile(sourcePath, "utf8");
await writeFile(outputPath, prepareWranglerConfig(config));

async function loadLocalEnv(path) {
	let contents;
	try {
		contents = await readFile(path, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") {
			return;
		}
		throw error;
	}

	for (const line of contents.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmed.indexOf("=");
		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmed.slice(0, separatorIndex).trim();
		const rawValue = trimmed.slice(separatorIndex + 1).trim();
		if (!key || process.env[key] !== undefined) {
			continue;
		}

		process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
	}
}
