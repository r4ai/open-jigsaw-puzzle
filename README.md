# Open Jigsaw Puzzle

Login-free online image jigsaw puzzle MVP for Cloudflare Workers.

## Stack

- Vite + React + TypeScript SPA
- Hono on Cloudflare Workers API
- Durable Objects WebSocket signaling hub
- D1 metadata storage
- Native WebRTC DataChannel mesh for image and puzzle-state sync

Images are resized in the browser and sent peer-to-peer. They are not stored in D1, R2, or Worker storage.

## Local Development

```bash
pnpm install
printf 'OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID=00000000-0000-4000-8000-000000000000\n' >> apps/api/.env
pnpm --filter @open-jigsaw-puzzle/api prepare:wrangler
pnpm --filter @open-jigsaw-puzzle/api exec wrangler d1 migrations apply open-jigsaw-puzzle --local --config wrangler.generated.jsonc
pnpm build
pnpm --filter @open-jigsaw-puzzle/api dev -- --local --ip 0.0.0.0 --port 8787
```

Open `http://127.0.0.1:8787`.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @open-jigsaw-puzzle/api prepare:wrangler
pnpm --filter @open-jigsaw-puzzle/api exec wrangler deploy --dry-run --outdir dist/worker --config wrangler.generated.jsonc
```

Before remote deploy, create a real D1 database and set `OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID` in your shell or GitHub Actions secrets.

For production rooms, configure TURN credentials through `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL`.
STUN-only WebRTC works on some networks, but TURN is required for reliable connections across restrictive NATs,
mobile carriers, and corporate networks.

## Deployment

See [Deployment](docs/deployment.md) for Cloudflare setup.
