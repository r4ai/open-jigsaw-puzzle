import { isMissingCloudflareResource, requiredEnv, runWrangler } from "./workflow-helpers.ts";

const previewName = requiredEnv("PREVIEW_NAME");

runCleanup("Preview Worker", ["delete", previewName, "--force"]);
runCleanup("Preview D1 database", ["d1", "delete", previewName, "--skip-confirmation"]);

function runCleanup(label: string, args: string[]): void {
  const result = runWrangler(args, { allowFailure: true });
  if (result.status === 0) {
    process.stdout.write(result.stdout);
    return;
  }

  const output = result.stderr + result.stdout;
  if (isMissingCloudflareResource(output)) {
    console.log(`${label} was already absent.`);
    return;
  }

  process.stderr.write(result.stderr);
  process.stdout.write(result.stdout);
  throw new Error(`${label} cleanup failed with exit code ${result.status}.`);
}
