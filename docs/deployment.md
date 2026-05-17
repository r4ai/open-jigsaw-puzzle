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

The deploy workflow runs on pushes to `main` and manual dispatch. Configure these under repository Settings > Secrets and variables > Actions:

- Secret: `CLOUDFLARE_API_TOKEN`
- Secret: `OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID`
- Variable: `CLOUDFLARE_ACCOUNT_ID`

`CLOUDFLARE_ACCOUNT_ID` can also be stored as a secret. The Cloudflare API token should be scoped to the target account and must allow Workers deployment and D1 migration access.

The workflow uses the `production` GitHub Environment, so configure environment protection rules there if deploys should require approval.

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
