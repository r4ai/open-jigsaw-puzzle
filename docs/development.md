# Local Development

## Setup

```bash
pnpm install

# D1 データベース ID を設定（ローカル開発用ダミー値でOK）
printf 'OPEN_JIGSAW_PUZZLE_D1_DATABASE_ID=00000000-0000-4000-8000-000000000000\n' >> apps/api/.env

# Wrangler 設定を生成して D1 マイグレーションを適用
pnpm --filter @open-jigsaw-puzzle/api prepare:wrangler
pnpm --filter @open-jigsaw-puzzle/api exec wrangler d1 migrations apply open-jigsaw-puzzle --local --config wrangler.generated.jsonc

# ビルドして起動
pnpm build
pnpm --filter @open-jigsaw-puzzle/api dev -- --local --ip 0.0.0.0 --port 8787
```

`http://127.0.0.1:8787` を開く。

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @open-jigsaw-puzzle/api prepare:wrangler
pnpm --filter @open-jigsaw-puzzle/api exec wrangler deploy --dry-run --outdir dist/worker --config wrangler.generated.jsonc
```
