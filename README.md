<div align="center">
  <img src="apps/web/public/favicon.png" width="96" alt="Open Jigsaw Puzzle" />
  <h1>Open Jigsaw Puzzle</h1>
  <p><b>みんなで一緒にパズルを楽しもう</b></p>
  <p>ログイン不要。リンクを共有して、画像を選んで、みんなでジグソーパズルを解こう。</p>

  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat&logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SolidJS-2C4F7C?style=flat&logo=solid&logoColor=white" alt="SolidJS" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Hono-E36002?style=flat&logo=hono&logoColor=white" alt="Hono" />

<br /><br />

  <img src="apps/web/public/og-image.png" alt="Open Jigsaw Puzzle" width="640" />
</div>

---

## スタック

| レイヤー         | 技術                                           |
| ---------------- | ---------------------------------------------- |
| フロントエンド   | Vite + SolidJS + TypeScript                    |
| スタイリング     | Panda CSS + Ark UI                             |
| API              | Hono on Cloudflare Workers                     |
| リアルタイム通信 | Durable Objects WebSocket + WebRTC DataChannel |
| メタデータ       | Cloudflare D1                                  |

画像はブラウザでリサイズされ、ピア間で P2P 転送される。サーバーには保存されない。

## 操作

- PC: ピースをドラッグして移動。空白をドラッグ、またはマウスホイールで盤面を移動・拡大縮小できる。
- モバイル/タブレット: 1本指でピースを移動、2本指でピース上からでも盤面をパン・ピンチズームできる。
- 右下のズームボタンでも拡大、縮小、全体表示を操作できる。

## ドキュメント

- [ローカル開発](docs/development.md)
- [デプロイ](docs/deployment.md)
- [無料枠の試算](docs/free-tier-estimate.md)
