# Semi-Auto Code Review & Health Check (Moku-ai Series)

> **使い方**: このファイルの「---」から下を丸ごと AI(Claude Code など)に渡す。
> `[ ]` の欄は実行する人が埋める。分からなければ空のままでよい(AI が `reviews/README.md` から探す)。
> 結果は `reviews/YYYY-MM-DD.md` に保存し、`reviews/README.md` の台帳に1行足す(運用ルールは `CLAUDE.md`「8. 定期コードレビュー」)。
> **このテンプレートの採点基準・チェック項目を変えたら、台帳の「テンプレート版」を上げる**(版が違う回どうしの点数は単純に比べない)。

- テンプレート版: **v1**(2026-11-01)

---

# Semi-Auto Code Review & Health Check (Moku-ai Series)

前回レビューから現在までのコードベースを診断し、重大な問題と必要な対処のみを報告してください。
**レビューは読み取り専用**。コード・設定・データは変更せず、ブランチへの commit / push もしない(結果ファイルの作成だけは行ってよい)。

## 0. Review Baseline & Meta-Data

- **Comparison Reference**:
  - 前回レビュー時のHEADコミットSHA: `[ここに前回のSHAを記入]`
  - 現在の比較元HEADコミットSHA: `[git rev-parse HEADで取得した現在のSHAを記入]`
  - ※比較元が不明な場合は差分判定を行わず、初回ベースラインとして報告する。
- **前回のレビュー結果**: `[reviews/YYYY-MM-DD.md]`(空なら `reviews/README.md` の台帳の最新行を使う。台帳が空なら初回)
- **テンプレート版**: v1
- **実施日 / 実施者(AI名・ツール)**: `[YYYY-MM-DD / 例: Claude Code]`

最初に次を実行し、結果をレポートの冒頭に貼る:

```sh
git rev-parse HEAD
git log --oneline <前回SHA>..HEAD | wc -l           # 期間中のコミット数
git diff --stat <前回SHA>..HEAD | tail -1             # 変わったファイル数・行数
git diff --name-only <前回SHA>..HEAD                  # 重点的に読むファイル
```

※ 古いファイルの経緯を追う時は `git log --full-history -- <file>`(CLAUDE.md「開発履歴について」)。

## 1. Review Scope

リポジトリ全体(フロントエンド `shared/`、各ゲームHTML、AWSバックエンド `backend/`、`dreamlo-proxy/`、`.github/workflows/`)を対象に、以下の6領域を確認する。
差分のあるファイルを重点的に読み、差分のないところは下の「固定チェック」と前回の継続指摘の再確認に留める。

1. **コード最適化・重複排除**: 複数ゲームに影響する重大な重複、`shared/` 共通モジュール(乱数、チェスルール等)の設計上の不整合
   - 例: ハブの `#hollow` と `hollow.html` のコピー(`buildHollowScene()` / `hollowLayout()`)の食い違い、`admin.html` と `hub.html` の `LEGACY_*_PREFIXES` の食い違い、`moku-account.js` と `moku-transfer.js` の同期対象キー定義の食い違い、`token.js` と `dreamlo-proxy/src/proxy.js` の `verify()` の食い違い
2. **パフォーマンス**: Canvasの描画ループ、LocalStorageの読み書き、マルチプレイ用ショート・ポーリング(1〜3秒間隔等)の性能劣化・過剰リクエスト
   - 例: 非表示タブでのポーリング停止、`requestAnimationFrame` の二重起動、毎フレームの `localStorage` / `JSON.parse`、three.js の `dispose()` 漏れ(CLAUDE.md §5)
3. **データ整合性**: ゲーム結果、Moint(共通通貨)、クラウドセーブ、マルチプレイ(`/matches`, `/challenges`, `/rooms`)における、不正操作・二重処理・同時更新によるデータ破損や不整合のリスク
   - 例: Moint の二重付与(`mointClaims` / `paid` / `DAILY_GAME_CAP`)、`balance` が負になる経路、`version` による楽観的排他の抜け、`moku:sync:pending` の扱い、セーブ上限 300KB 超過時の挙動
4. **セキュリティ・スケーラビリティ**: HMAC認証、AWS API Gatewayのレート制限(ルート別スロットリング)、DynamoDBのアクセス効率、データ保護
   - 例: `/admin/*` の `role` 確認漏れ、PIN・トークン・Player ID のログ/レスポンスへの露出、Scan の多用、`ttl` の付け忘れ、CORS の許可元、秘密値(AuthSecret・InviteCode・Dreamlo private key)のリポジトリ混入
5. **構造的健全性 & リリース安全性**:
   - `shared/` スクリプトの読み込み規則(`?v=日付` キャッシュバスティング)、vendor同期、新規ゲーム追加時の整合性(`GAMES` / `CATALOG` / `SHELVES` / `RECORDS` / アイコン / スクリーンショット)
   - 共通JS・APIの新旧互換性(古い HTML が新しい API を、新しい HTML が古いサーバーを呼んだ時)、主要ゲーム操作の回帰(リグレッション)、デプロイ失敗時のロールバック可能性
   - `template.yaml` の新パラメータに `Default` があるか(自動デプロイの前提。CLAUDE.md §6)
6. **運用レジリエンス**: 重大障害の検知、エラー収集機能(`moku-errors.js`)、AWSデータの復旧可能性
   - 例: 全ページで `moku-errors.js` が最初に読まれているか、デプロイ後ヘルスチェックの範囲、DynamoDB のバックアップ/PITR の有無、管理者がロックアウトされた時の復旧手段

"CLAUDE.md"、"SPEC.md"、"TECH_STACK.md" の既存方針を尊重し、過剰な設計変更は提案しない。
(例: フレームワーク・バンドラー・TypeScript の導入、WebSocket 化、単一HTMLの分割、全面リファクタリングは提案しない)

### 固定チェック(毎回同じコマンドで実行し、結果を表にする = 定点観測)

| ID | 内容 | コマンド | 合格条件 |
| --- | --- | --- | --- |
| C1 | バックエンドのテスト | `cd backend && npm install --no-audit --no-fund && npm test` | `fail 0` |
| C2 | vendor コピーの一致 | `for f in backend/src/vendor/*.js; do diff -q "$f" "shared/$(basename "$f")"; done` | 出力なし |
| C3 | `shared/` の `?v=` がそろっている | `grep -ohE 'src="shared/[^"]+\?v=[^"]+"' *.html \| sed -E 's/.*\?v=//' \| sort \| uniq -c` | 値が1種類 |
| C4 | `?v=` の付け忘れ | `grep -noE 'src="shared/[^"?]+"' *.html` | 出力なし |
| C5 | 全ページに `moku-errors.js` | `for f in *.html; do grep -q 'shared/moku-errors.js' "$f" \|\| echo "$f"; done` | 出力なし |
| C6 | ゲームとハブに `moku-gate.js` | `for f in *.html; do grep -q 'shared/moku-gate.js' "$f" \|\| echo "$f"; done` | `admin.html` 以外は出力なし(`admin.html` は専用ログインなので対象外。`index.html` はコメントで名前が出るだけで読み込まない入口なので、出力されなくてよい) |
| C7 | 秘密値の混入 | `git grep -nIE 'AKIA[0-9A-Z]{16}\|BEGIN (RSA\|EC\|OPENSSH) PRIVATE KEY'` に加え、`template.yaml` の `NoEcho` パラメータ(AuthSecret・InviteCode)に実際の値の `Default` が書かれていないか目で確認 | 出力なし・`Default` は空文字か無し |
| C8 | 開発サーバーの起動とコンソールエラー | `npm install && npm run dev` → Playwright で `index.html` / `hub.html` / 期間中に変わったゲームを開く | コンソールエラーなし |
| C9 | 画像がテキスト扱いで壊れていない | `git diff --name-only <前回SHA>..HEAD -- '*.png' '*.jpg' '*.ico'` で出たファイルを `file` で確認 | 画像として認識される |

表の中の `\|` はシェルでは `|`(表の区切りと区別するためのエスケープ)。

実行できなかったチェックは「未検証」と書き、理由(ネットワーク不可など)を添える。合格とみなさない。

## 2. Review Rules

- **Evidence First**: 指摘には対象ファイル・行番号・根拠(コードの引用、再現手順、コマンド出力)を必ず示す。未確認事項は断定しない。
- **Critical Issues Only**: セキュリティ脆弱性、データ消失・破損リスク、機能停止、重大な性能劣化、広範囲の保守障害につながる問題だけ報告する。軽微なスタイルの指摘は除外。
- **Delta & Regression**: 比較元コミットと現在のHEADを比較し、新規・継続・解消を区別する。前回の指摘は ID を引き継ぎ、全件の状態を必ず書く(黙って消さない)。
- **Verification**: 既存テストや実行可能な検証(`node:test` やローカルモック等)を行い、結果を明記する。修正は提案のみとし、コードは自動変更しない。
- **本番に触らない**: 本番 API(`execute-api.ap-southeast-5.amazonaws.com`)・本番 DynamoDB・GitHub Pages に書き込むリクエストは送らない。検証は `npm run dev` のモックとテストで行う。

### 重大度の定義(毎回同じ基準で判定する)

| 重大度 | 基準 | 例 |
| --- | --- | --- |
| **High** | 今すぐ、または通常の操作で起こりうる: セキュリティ侵害、データ消失・破損、Moint の不正増殖、ゲーム/ハブ全体の停止 | 認証の抜け、クラウドセーブの上書き消失、二重付与が誰でも再現できる |
| **Medium** | 条件付きで起こる、または影響が1タイトルに限られるが放置すると広がる | 2台同時の特定タイミングでの不整合、1ゲームの起動不能、vendor の食い違い、ポーリングの過剰リクエスト |
| (報告しない) | スタイル、命名、好み、理論上だけのリスク、影響が小さい最適化 | — |

### 確信度

- **High**: 再現した / テストやコマンドで確認した
- **Medium**: コードを読んで経路を特定したが、実行では確かめていない
- **Low**: 可能性の指摘。根拠が弱い(Low の指摘は High 重大度でも点数から引かず、「要確認」として残す)

### 採点基準(10点満点、毎回この式で計算する)

- 10点から、**未解消**の指摘ごとに引く: High = −2.0、Medium = −0.5(確信度 Low は引かない)
- 固定チェック C1〜C6 の不合格 1件ごとに −0.5(同じ原因の指摘とは二重に引かない)
- 下限は 0。小数第1位まで。
- **未検証の項目は合格扱いにしない**: 点数とは別に「確信度: 高/中/低」を併記する(固定チェックの未検証が 2件以上なら「中」以下)。

## 3. Output Format

結果は `reviews/YYYY-MM-DD.md` に、次の順で書く。

1. **Executive Summary**:
   - 全体の健全性(10点満点評価。10点を基準に検証された重大問題の影響度・件数・未解消状況を考慮し、前回と同一基準で採点。未検証事項は正常とみなさず確信度を併記する)
   - 前回比(前回の点数 → 今回の点数、テンプレート版が同じか)、最重要リスク(1〜3行)
   - 比較範囲(前回SHA..今回SHA、コミット数、変更ファイル数)
2. **Critical Findings**: High / Medium の問題のみ。証拠, 影響, 確信度を明示。

   | ID | 状態 | 重大度 | 確信度 | 領域(1〜6) | 場所 | 概要 |
   | --- | --- | --- | --- | --- | --- | --- |
   | MR-001 | 新規 / 継続 / 解消 / 取り下げ | High | Medium | 3 | `backend/src/accountApi.js:123` | … |

   - ID は `MR-<3桁>` の通し番号。前回からの指摘は同じ ID を使い、新規は台帳の最大番号の次から振る。
   - 表のあと、ID ごとに「証拠(引用・コマンド出力)」「影響(何が起きるか、誰に)」「再現手順(あれば)」を書く。
   - 「解消」は直したコミット SHA を書く。「取り下げ」は前回の判断が誤りだった理由を書く。
3. **Recommended Actions**: 具体的な修正方針、優先順位、検証方法(1件 = 小さな PR 1つで直せる粒度。CLAUDE.md §3)
4. **Impact Mapping**: 影響するゲーム、共通モジュール (`shared/`)、AWSバックエンド (`backend/`)
5. **Verification Results**: 実行したテスト、成功・失敗、未検証事項(固定チェック C1〜C9 の表+そのほかに実行したこと)

最後に `reviews/README.md` の台帳に1行足す(日付・今回SHA・前回SHA・点数・確信度・High/Medium の未解消件数・テンプレート版・結果ファイル)。

問題がなければ「重大な問題なし」と報告する。指摘件数を増やすことを目的にしない。
