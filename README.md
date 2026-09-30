# ufo-simulator-v2

Pixi.js を使った UFO フライトシミュレータ。物理演算（加速・摩擦・ブースト）+ パーティクル + トレイル + サウンド。GitHub description: 「UFO飛ばすやつ v2」。

## スタック

- TypeScript 7 / Vite 8
- パッケージマネージャ: Bun（`bun.lock` あり）
- レンダリング: Pixi.js 8（WebGL）
- Lint: Biome / Husky + lint-staged

## 構成

```
src/
  main.ts          エントリ + ゲームループ
  Ufo.ts           UFO 描画 + 物理（加速 / 摩擦 / ブースト）
  input.ts         キーボード入力
  Environment.ts   背景 / 環境
  Particles.ts     パーティクルプール
  Trail.ts         軌跡描画
  Hud.ts           HUD（速度・ブーストゲージ）
  Sound.ts         サウンド管理
  constants.ts     物理定数
  types.ts         型定義
```

## 操作

- 移動: 矢印キー or WASD
- ブースト: スペース（速度 ×2.6、リチャージあり）
- ブースト蓄積: スペース長押し
- 画面リサイズに自動追従

## 物理パラメータ（src/constants.ts）

- 加速度: 540 / 最高速度: 440
- 摩擦係数: 0.97
- ブースト倍率: 2.6 / 消耗 1.15・回復 0.42
- トレイル長: 55 / パーティクル pool: 700

## 開発

```bash
bun install
bun run dev          # Vite（:3000、vite.config.ts の server.port）
bun run build        # tsc + vite build
bun run lint         # Biome
```

## デプロイ

公開はしていない（GitHub Pages 無効、デプロイ用ワークフローも無い）。ローカルの `bun run dev` で確認する。

## CI

- `.github/workflows/ci.yml`（Biome / 型チェック / ビルド）
- CodeQL: `codeql.yml` / PR レビュー: `gemini-review.yml` / Dependabot patch/minor は `dependabot-automerge.yml` で auto-merge
