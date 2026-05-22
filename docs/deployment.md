# Deployment

Open Jigsaw Puzzle deploys the Vite SPA and Cloudflare Worker together with Wrangler. The deployed Worker serves both API routes and the built web assets.

## Cloudflare Setup

Authenticate locally:

```bash
pnpm --filter @open-jigsaw-puzzle/api exec wrangler login
```

Create the production D1 database:

```bash
pnpm --filter @open-jigsaw-puzzle/api exec wrangler d1 create open-jigsaw-puzzle
```

Store the returned `database_id` outside Git:

- Local development: set `OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID` in `apps/api/.env` or your shell.
- GitHub Actions: add repository or `production` environment secret `OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID`.

`apps/api/wrangler.jsonc` contains a placeholder. The deploy scripts generate the ignored `apps/api/wrangler.generated.jsonc` file before running Wrangler.

## Manual Deploy

Apply D1 migrations and deploy:

```bash
pnpm db:migrate:remote
pnpm run deploy
```

## GitHub Actions Deploy

The CI workflow runs verification on pushes to `main` and uploads a short-lived `production-bundle` artifact. After CI succeeds, the deploy workflow checks out only the default branch deployment scripts from `.github/scripts`, downloads that verified artifact, applies D1 migrations, and deploys the Worker without checking out application source or running package scripts with Cloudflare secrets.

Configure these under repository Settings > Secrets and variables > Actions:

- Secret: `CLOUDFLARE_API_TOKEN`
- Secret: `OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID`
- Variable: `CLOUDFLARE_ACCOUNT_ID`

`CLOUDFLARE_ACCOUNT_ID` can also be stored as a secret. The Cloudflare API token should be scoped to the target account and must allow Workers deployment and D1 migration access.

The workflow uses the `production` GitHub Environment, so configure environment protection rules there if deploys should require approval.

For manual redeploys, run the Deploy workflow with the CI run id that produced the `production-bundle` artifact to redeploy.

## Pull Request Preview Environments

The preview workflow deploys one temporary Cloudflare Worker and one temporary D1 database per pull request from a branch in this repository. Forked pull requests are skipped because the workflow needs Cloudflare secrets.

Security boundary: pull request code is built and tested only by the unprivileged CI workflow. The privileged preview workflow is triggered after CI succeeds, checks out only the default branch deployment scripts from `.github/scripts`, downloads the verified build artifact, and then runs Cloudflare commands without running pull request package scripts, tests, or build commands. Cleanup runs from `pull_request_target` and does not checkout or install pull request code.

The preview workflow validates that a completed CI run maps to exactly one pull request before deploying. If GitHub reports zero or multiple associated pull requests, the workflow fails instead of guessing which preview environment to update.

Preview resource names use the pull request number:

- Worker: `open-jigsaw-puzzle-pr-<PR number>`
- D1 database: `open-jigsaw-puzzle-pr-<PR number>`

Configure these under repository Settings > Secrets and variables > Actions:

- Secret: `CLOUDFLARE_API_TOKEN`
- Variable: `CLOUDFLARE_ACCOUNT_ID`
- Variable: `CLOUDFLARE_PREVIEW_DOMAIN_SUFFIX`

`CLOUDFLARE_ACCOUNT_ID` can also be stored as a secret. Set `CLOUDFLARE_PREVIEW_DOMAIN_SUFFIX` to the preview domain suffix, for example `puzzle.r4ai.dev`.

The Cloudflare API token must allow Worker deploy/delete, Worker custom domain management, and D1 create/read/migrate/delete operations for the target account.

When a pull request is opened, reopened, updated, or marked ready for review, `.github/workflows/ci.yml` runs the normal verification steps and uploads a short-lived preview bundle. After CI succeeds, `.github/workflows/preview.yml` creates the preview D1 database if needed, applies migrations from the verified bundle, deploys the preview Worker, and posts or updates a PR comment with the preview URL:

```text
https://pr-<PR number>.<CLOUDFLARE_PREVIEW_DOMAIN_SUFFIX>
```

For example, with `CLOUDFLARE_PREVIEW_DOMAIN_SUFFIX=puzzle.r4ai.dev`, pull request 123 is deployed to `https://pr-123.puzzle.r4ai.dev`.

When the pull request is closed or merged, the cleanup job deletes the matching Worker and D1 database, then updates the PR comment. If a resource is already absent, cleanup still completes.

Cloudflare's built-in Worker Preview URLs are not used because they are not generated for Workers that implement Durable Objects. The preview workflow deploys separate temporary Workers instead.

## Verify Before Deploy

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @open-jigsaw-puzzle/api prepare:wrangler
pnpm --filter @open-jigsaw-puzzle/api exec wrangler deploy --dry-run --outdir dist/worker --config wrangler.generated.jsonc
```

## Runtime Configuration

Non-secret defaults are defined in `apps/api/wrangler.jsonc`:

- `ROOM_TTL_SECONDS`
- `MAX_PARTICIPANTS`
- `EXPIRED_ROOM_RETENTION_SECONDS`
- `CLEANUP_BATCH_SIZE`
- `TURN_URLS`
- `TURN_USERNAME`
- `TURN_CREDENTIAL`

For production, configure real TURN values before launch. TURN is required for reliable WebRTC connections across restrictive NATs, mobile carriers, and corporate networks.

If TURN credentials are sensitive, manage them as Cloudflare Worker secrets instead of committing values to `wrangler.jsonc`.

Expired rooms are cleaned by the configured cron trigger. By default, room metadata and event rows are retained for 24 hours after room expiry and then deleted in batches of 500 rooms.
