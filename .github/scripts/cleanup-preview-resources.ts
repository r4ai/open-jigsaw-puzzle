import { isMissingCloudflareResource, requiredEnv, runWrangler } from "./workflow-helpers.ts";

const previewName = requiredEnv("PREVIEW_NAME");

// Use the Cloudflare REST API directly for Worker deletion to avoid wrangler's
// unnecessary KV namespace enumeration, which requires extra token permissions.
await deleteWorker("Preview Worker", previewName);
runCleanup("Preview D1 database", ["d1", "delete", previewName, "--skip-confirmation"]);

async function deleteWorker(label: string, workerName: string): Promise<void> {
  const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiToken}` },
    },
  );

  type CloudflareResponse = { success: boolean; errors: { code: number; message: string }[] };
  const data = (await response.json()) as CloudflareResponse;

  if (data.success) {
    console.log(`${label} deleted.`);
    return;
  }

  if (response.status === 404 || isMissingCloudflareResource(data.errors.map((e) => e.message).join(" "))) {
    console.log(`${label} was already absent.`);
    return;
  }

  throw new Error(`${label} cleanup failed: ${JSON.stringify(data.errors)}`);
}

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
