# Moku Series — 技術スタック(定期スナップショット)

外部の IDE / AI ツールと並行開発する時に、前提をそろえるための要約。**このファイルはそのままコピペして相手に渡せる**ように書いている。
細かい仕様・数値は `SPEC.md`、方針・世界観・運用ルールは `CLAUDE.md` が正。食い違ったらそちらを優先し、このファイルを直す。

- **最終更新**: 2026-11-01(`main` 時点。次の見直しの目安: 新しい共通モジュール・API・ライブラリが増えた時)
- **対象リポジトリ**: `aohaus/Moku-ai`(本番)。`aohaus/Moku` は 2026-08 で止まっている旧リポジトリで、開発には使わない。

---

## 1. 全体像(ひとことで)

> ビルド工程のない静的サイト(1ゲーム = 1つの HTML に HTML/CSS/JS を全部インライン)+ 共通スクリプト `shared/*.js`。
> バックエンドは AWS SAM(API Gateway HTTP API + Lambda Node.js 20 + DynamoDB)。フロントは GitHub Pages で配信。
> フレームワーク・バンドラー・TypeScript・npm のフロント依存はなし。

```
ブラウザ (iPhone / iPad / Android / PC、モバイル優先)
  ├─ index.html(入口・ログイン) / hub.html(ゲーム一覧) / hollow.html / admin.html(保護者用・日本語)
  ├─ <game>.html × 22(単一HTML。Canvas 2D 中心、4本は three.js)
  └─ shared/*.js(アカウント・ゲート・通貨・エラー収集などの共通 UMD/IIFE スクリプト)
        │  fetch (CORS, Bearer トークン)
        ▼
AWS ap-southeast-5(スタック moku-backend)
  API Gateway HTTP API ─┬─ AccountFunction(/auth/* /save /players /admin/* /errors)
                        ├─ MatchFunction(/matches /challenges /rooms)
                        └─ SubmitScore / GetScores(/scores、予備)
                        ▼
                  DynamoDB: moku-accounts(シングルテーブル) / moku-scores
別スタック: dreamlo-proxy(Lambda 1本。HTTP のみの Dreamlo を HTTPS で中継するランキング用)
```

## 2. フロントエンド

| 項目 | 内容 |
| --- | --- |
| 言語 | 素の HTML / CSS / JavaScript(ES2017+ 程度。モジュール `import` は使っていない、`<script>` タグで読む) |
| 構成 | 1ゲーム = 1ファイル(`kebab-case.html`)。HTML/CSS/JS はインライン。ブラウザで直接開いても動く |
| 描画 | Canvas 2D が基本。3D は **three.js r128**(cdnjs)を `flying-moku.html` / `moku-future-run.html` / `moku-rane.html` / `moku-dropper.html` の4本で使用。UI は DOM/CSS |
| 外部ライブラリ | three.js r128 のみ(`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`)。**CDN 経由のみ、バンドラー導入はしない** |
| フォント | 基本はシステムフォント(`-apple-system, "Segoe UI", Roboto, sans-serif`)。一部ページで Google Fonts(Fredoka / Plus Jakarta Sans / Press Start 2P) |
| 音 | 音源ファイルなし。**Web Audio API で合成**。iOS 対策で最初のタップで `AudioContext.resume()` |
| 重い処理 | Moku Chess の CPU は Web Worker(関数を `toString()` して Worker に渡す) |
| 保存 | `localStorage`(キーは `moku:<gameId>:<key>`、try-catch 必須)。ログイン中は自動でクラウドセーブ |
| PWA | `manifest.json` / `hub-manifest.json`(ホーム画面追加用)。Service Worker はなし |
| 言語(UI) | プレイヤー向けはすべてシンプルな英語。日本語はコメント・開発ドキュメント・`admin.html` のみ |
| 対応端末 | モバイル優先・タッチ第一。`viewport-fit=cover` と `env(safe-area-inset-*)`、iPad 4:3、縦長スマホ |

### 共通スクリプト `shared/`

UMD(ブラウザでは `window.<名前>`、Node では `require`)または IIFE。外部ライブラリなし。

| ファイル | グローバル | 役割 |
| --- | --- | --- |
| `moku-errors.js` | — | 全ページの `<head>` 先頭。エラーを `POST /errors` へ送る |
| `moku-gate.js` | — | ログイン必須ゲート(未ログインなら `index.html?next=` へ) |
| `moku-account.js` | `MokuAccount` | ログイン・クラウドセーブ同期・Players。`API_BASE_URL` はここ |
| `moku-moint.js` | `MokuMoint` | シリーズ共通通貨 Moint・Moku Closet(着せ替え SVG) |
| `moku-transfer.js` | — | サーバー不要の引き継ぎコード(`MOKU1-` + deflate + base64url) |
| `moku-scores.js` | `MokuScores` | ランキング(dreamlo-proxy 経由) |
| `moku-random.js` | `MokuRandom` | シード付き乱数(mulberry32。端末とサーバーで同じ数列) |
| `moku-chess-rules.js` | `MokuChessRules` | チェスのルール(0x88 盤・FEN・UCI)。サーバーでも使う |
| `moku-riddles.js` | `MokuRiddles` | Word Riddles の問題データと判定。サーバーでも使う |
| `moku-wolf-words.js` | — | Moku Wolf のお題。サーバーでも使う |
| `moku-ontology.js` | `MokuOntology` | Hollow の意味ネットワーク。サーバーでも使う |

- 読み込みは `src="shared/moku-xxx.js?v=20261031c"` の形。**`shared/*.js` を変えたら、読み込む全 HTML の `?v=` を同じ値に上げる**(CDN/ブラウザのキャッシュ対策)。
- サーバーでも使うもの(chess-rules / riddles / wolf-words / ontology)は `backend/src/vendor/` にコピーがある。**`shared/` を直して `cp` する**(差分があると `npm test` が落ちる)。

## 3. バックエンド

| 項目 | 内容 |
| --- | --- |
| IaC | AWS SAM(`backend/template.yaml`)。リージョン `ap-southeast-5`(マレーシア)、スタック `moku-backend` |
| API | API Gateway **HTTP API**(ルートごとのスロットリング、CORS は `aohaus.github.io` と `dechatgpt.com`) |
| 実行環境 | Lambda **Node.js 20.x**(CommonJS、128MB / Account は 256MB、Timeout 5s)。`sam build` なし(`backend/` をそのまま zip) |
| 依存 | `@aws-sdk/client-dynamodb` / `@aws-sdk/lib-dynamodb` のみ(Lambda ランタイム同梱) |
| DB | DynamoDB オンデマンド。`moku-accounts` はシングルテーブル設計(`pk`/`sk`、`ttl` で自動削除): アカウント・セーブ・`LOG#日付`・`ERR`・`CONFIG/SETTINGS`・`MATCH#`・`CHAL#`・`ROOM#`・`PLAYER#uid/…`。ほかに `moku-scores` |
| 認証 | プレイヤーID + PIN(4〜6桁、**scrypt** ハッシュ、5回ミスでロック)。セッションは自前の HMAC-SHA256 トークン(JWT 風、ヘッダなし、90日)。ライブラリ不使用 |
| リアルタイム | **WebSocket なし**。ポーリング(1〜3秒)+ `version` による楽観的排他。サーバーは審判・中継のみ |
| 主なソース | `backend/src/`: `accountApi.js` `accountStore.js` `matchApi.js` `challengeApi.js` `roomApi.js` `moyoParty.js` `wolfParty.js` `settings.js` `playCommon.js` `token.js` `pin.js` |
| 設定値 | 時間・回数などは `backend/src/settings.js` の `SCHEMA` に置き、`admin.html` の「⚙️ 設定」から変更(ハードコーディングしない) |
| テスト | Node 標準の `node:test`(`cd backend && npm test`、AWS 不要、メモリストア) |
| API 仕様 | `backend/API_SPEC.md` |

### 別系統: `dreamlo-proxy/`

Lambda 1本(Node.js 20.x、`src/proxy.js`)。Dreamlo(無料ランキング、HTTP のみ)を HTTPS で中継し、private key をクライアントに渡さない。別の SAM スタックで手動デプロイ。トークン検証はバックエンドの `token.js` のコピー(同期が必要)。

## 4. 開発環境・ツール

```sh
npm install
npm run dev              # http://localhost:3000 — server.js(Express 4 + cors)で静的配信 + API モック
cd backend && npm test   # バックエンドのテスト
```

- `server.js` は `backend/dev/mount.js` で**本物のハンドラをメモリストアで動かす**(招待コード `moku-dev`、開発用管理者 `admin` / `1357`)。再起動でデータは消える。
- localhost:3000 以外のポートやファイル直開きではログインゲートが外れる(開発用)。
- 動作確認: Playwright + Chromium で対象ページを開き、コンソールエラーがないことを確認。
- UX スモークチェック: `npm run ux:smoke`(`scripts/ux-smoke.js`。Playwright でハブと全ゲームを3つの画面サイズで開き、エラー・見切れを `.ux-cycle/` に報告。CLAUDE.md §9 の `/ux-cycle` で使う)。
- リンター・フォーマッター・型チェックは**なし**(`npm run lint` / `build` はダミー)。
- アイコン生成: `python3 scripts/make-icons.py`(Pillow)。`brand/mokumoku-hero.png` から作る。
- 画像は `.gitattributes` で binary 指定。理由なく再エンコードしない。

## 5. 配信・デプロイ

| 対象 | 方法 |
| --- | --- |
| フロント | GitHub Pages(`https://aohaus.github.io/Moku-ai/`)+ Cloudflare でマスクした `https://dechatgpt.com/Moku-ai/`。`main` にマージで反映 |
| バックエンド | GitHub Actions `.github/workflows/deploy-backend.yml`: `main` の `backend/**` 変更で `npm test` → `sam validate` → `sam deploy`(OIDC で AWS ロールを引き受ける、キー保存なし)→ ヘルスチェック。**新しい SAM パラメータには必ず `Default`** |
| API URL | `https://d6hl1cxi0i.execute-api.ap-southeast-5.amazonaws.com`(`shared/moku-account.js`) |
| キャッシュ | `shared/*.js` は `?v=` で、アイコンも `?v=` で更新。HTML はハブの「↻ Get the latest games & updates」で取り直せる |

## 6. 並行開発で守ること(要点)

1. **`main` に直接 push しない**。作業ブランチ → PR。変更は小さく。
2. フレームワーク・バンドラー・npm のフロント依存を**入れない**。ライブラリは CDN のみ。
3. 新しいページは `<head>` の `<meta charset>` 直後に `moku-errors.js` → `moku-gate.js`、ゲームは `</head>` 前に `moku-account.js data-mode="background"`。
4. `localStorage` キーは `moku:<gameId>:<key>`(自動でクラウドセーブ対象)。
5. 変更したゲームは `#buildInfo` のバージョンと日付を上げる(`v1.2.3 · Updated Nov 1, 2026`)。
6. `shared/*.js` を変えたら全 HTML の `?v=` を同じ値に。vendor コピーがあるものは `cp` も。
7. 新しいゲームは `index.html` / `hub.html` の `GAMES`、`hub.html` の `CATALOG` / `SHELVES`、`icons/games/<gameId>.svg`、`screenshots/<gameId>.jpg` に追加。
8. three.js を使うページは作り直し時に geometry / material / texture を `dispose()`。
9. 世界観は温かい絵本調。ネオン・サイバー・過度なダークは禁止(ハブのダークネイビーは例外)。
10. 過去の経緯は `git log --full-history -- <file>`(古い履歴が merge で省略されるため)。
11. 2週に1回の定期レビューは `REVIEW_TEMPLATE.md`、記録は `reviews/`(CLAUDE.md §8)。

## 7. 規模の目安(2026-11-01)

- ゲーム HTML 22本(ハブ公開 21 + 未公開の Mokuball)+ ハブ系 4ページ
- `shared/` 11ファイル、バックエンド `src/` 16ファイル・テスト 7ファイル
- 想定ユーザー: 最大100アカウント(招待制)
