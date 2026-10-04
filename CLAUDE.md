# Moku Series — Claude Code 向けガイド

このリポジトリは **Google AI Studio(Build) と Claude Code で並行開発**している。
プロジェクトの方針・世界観ルールは AI Studio / Gemini 向けと共通なので、以下を必ず読み込むこと。

- プロジェクト概要・世界観ルール: @Gemini.md
- 技術仕様・共通UI・セーブデータ規約: @SPEC.md

## 起動・確認方法

```sh
npm install
npm run dev   # http://localhost:3000 (server.js: 静的配信 + /api/scores のモック)
```

ビルド工程はない。各ゲームは単一HTMLファイル(HTML/CSS/JSインライン)で、ブラウザで直接開いても動く。
変更後はブラウザ(Playwright + Chromium が利用可)で対象ゲームを実際に開いて、コンソールエラーがないことを確認する。

## AI Studio との並行開発ルール

AI Studio の GitHub 連携は **AI Studio 側の全ファイルのスナップショットを1コミット("Push" 等)として `main` に書き込む** 方式で、
GitHub 側の変更を AI Studio に自動で取り込む仕組みではない。そのため以下を守る。

0. **担当分け(Gemini.md §5):** Moku Future Run は Claude Code 担当。それ以外のタイトルは原則 AI Studio 担当なので、触る前にユーザーに確認し、触る場合は Gemini.md §5 の表を更新する。
1. **Claude Code は `main` に直接 push しない。** 必ず作業ブランチで変更し、PR 経由でマージする。
2. **同じファイルを AI Studio と同時に触らない。** 1ファイル = 1ゲームなので、「今どのゲームをどちらで触っているか」を分担して作業する。
3. **AI Studio の "Push" コミットが来たら、作業ブランチに `main` をマージしてから続ける。**
   AI Studio のスナップショットが Claude 側の変更を巻き戻していないか、`git diff` で必ず確認する。
4. **画像などのバイナリ(`backgrounds/` `brand/` `icons/`)は理由なく再生成・再エンコードしない。**
5. 変更したゲームは SPEC.md §5 に従い `#buildInfo` のバージョンと日付を更新する。
6. `metadata.json` は AI Studio 用の設定ファイル。Claude Code からは原則変更しない。

## コーディング規約(要点)

- フレームワーク・バンドラーは導入しない。ライブラリは CDN 経由のみ。
- `localStorage` のキーは `moku:<gameId>:<key>`。`gameId` はファイル名(拡張子なし)。
- 新規タイトルを追加したら `index.html` / `hub.html` の `GAMES` 配列(stats / `progress()`)にも追加する。
- 1回の変更は小さく、インパクトの大きいものに絞る(Gemini.md §4)。既存コードを省略・短縮しない。
- 過去の履歴を追うときは `git log --full-history -- <file>` を使う(SPEC.md「開発履歴について」)。
