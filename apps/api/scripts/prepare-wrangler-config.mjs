import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const sourcePath = join(appDir, "wrangler.jsonc");
const outputPath = join(appDir, "wrangler.generated.jsonc");

await loadLocalEnv(join(appDir, ".dev.vars"));
await loadLocalEnv(join(appDir, ".env"));

const databaseIdsByBinding = {
	DB: process.env.OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID,
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const config = await readFile(sourcePath, "utf8");
let output = config;
const missing = [];

for (const [binding, databaseId] of Object.entries(databaseIdsByBinding)) {
	const token = `__${binding.toUpperCase()}_DATABASE_ID__`;
	if (!output.includes(token)) {
		continue;
	}

	if (!databaseId) {
		missing.push(`${token}: set OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID`);
		continue;
	}

	if (!uuidPattern.test(databaseId)) {
		throw new Error(`Invalid D1 database_id for ${binding}: expected a UUID.`);
	}

	output = output.replaceAll(token, databaseId);
}

if (missing.length > 0) {
	throw new Error(`Missing D1 database_id secret(s):\n${missing.map((item) => `- ${item}`).join("\n")}`);
}

await writeFile(outputPath, output);

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
