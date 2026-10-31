# Moku Series — 開発ガイド

『Moku Series』は、フクロウのキャラクター「Moku(モクモク)」が主役のブラウザ向けミニゲーム集。
小学生2名とアイディアを出し合い、AIを活用した開発ライフサイクルを体験しながら共同制作している。
**2026-10-24 から Claude Code のみで開発している**(それ以前は Google AI Studio と並行開発。経緯は「開発履歴について」)。

- 技術仕様・共通UI・セーブデータ・アカウント規約: @SPEC.md

## 1. ビジョン

1. **子どもたちの体験・教育**: AIとの適切な距離感や活用法を身につけ、将来「自分専用の学習・家庭教師アプリ」などを自力で計画・開発できるスキルとマインドを育む。
2. **クオリティ目標**: 子どもたちが友達に自慢して紹介できる、市販ゲームのような「垢抜け感」「洗練されたUI/UX」。
3. **ビジネス目標**: 将来的な収益化(年間約1,200ドルが目標)を見据え、社会に役立ち愛されるプロダクトに育てる。

## 2. 収録タイトル

| タイトル | ファイル | ジャンル |
| --- | --- | --- |
| Angry Mokumoku | `angry-mokumoku.html` | スリングショット物理アクション |
| Angry Moku Battle Royal | `angry-moku-battle-royal.html` | 4対4のスリングショット対戦 |
| MK Mobile | `mk-mobile.html` | サッカー |
| Moku Fight | `moku-fight.html` | 格闘アクション |
| Moku Kart Dash | `moku-kart.html` | サーキットレース |
| Moku Future Run | `moku-future-run.html` | 3レーンランナー |
| Moyomoyo | `moyomoyo.html` | 落ち物パズル(ぷよぷよ風) |
| Moku Drop | `moku-drop.html` | 合体パズル(スイカゲーム風) |
| Shiri of Moku | `shiri-of-moku.html` | チャット形式のクイズ |
| Moku City | `mokucity.html` | 街づくり(緑化率がテーマ) |
| Moku Fishing Pond | `moku-fishing.html` | のんびり釣り |
| Moku Rhythm Cafe | `moku-rhythm.html` | リズム |
| Moku Bento | `moku-bento.html` | お弁当づくりのキッチンラッシュ |
| Flying Moku | `flying-moku.html` | 3Dの空中飛行 |
| Moku Wolf | `moku-wolf.html` | パーティー(ワードウルフ、1台を回して遊ぶ+みんなのスマホで遊ぶ Multiplayer) |
| Moku Watch 6 Lazy | `moku-watch-6-lazy.html` | 怠け者のスマートウォッチ |
| Moku-rane | `moku-rane.html` | 3Dクレーンゲーム |
| Moku Bridge | `moku-bridge.html` | ガラスの橋渡り(左右を選ぶ運試し+Mointショップ) |
| Moku Chess | `moku-chess.html` | 3D盤のチェス(Moku Fight のライバルが10段階のCPU) |
| Moku Word Riddles | `moku-word-riddles.html` | 英語のレバス・パズル100問(文字の配置・大きさ・数から単語を当てる)+早押しの Riddle Race |
| Moku Dropper | `moku-dropper.html` | 3Dドロッパー(大きな木の幹の中を落ちてポータルへ。ライバルとレース) |
| Mokuball | `mokuball.html` | サッカー/ピンボール風(ハブ未公開) |

ハブは `index.html`(入口のスプラッシュ)と `hub.html`(ゲーム一覧)。最新の一覧は `hub.html` の `CATALOG` が正。

### 子どもたちと決めた、コードからは見えない意図

- **Moku City**: 「ただビルを建てるだけだと普通のシムシティと同じ」という子どもの意見から、**緑(自然)を一定割合残さないと市民の幸福度が下がる**ルールを入れた。環境教育とゲーム性の両立がテーマ。
- **Moku Dropper**: 子どもが別の Claude で作った「Moku Dropper 3D」(マイクラのドロッパー風、青い壁の縦穴)が元。ラウンド構成・障害物のおやつ・「ぶつかったら上からやり直し」・紫のポータルは子どもの設計なので変えない。舞台だけ The Hollow の大きな木の幹の中にして、シリーズの世界観とつないだ。2026-10-31 に遊んでみた声で、CPU を弱く・遅く、各フロアの穴を2つに、レースの相手を2人に、星をやめて 1st / 2nd / 3rd の順位だけにした(SPEC.md §13)。
- **Moku Bento / Shiri of Moku**: レース・パズル・格闘のような定番ジャンルだけでなく、「日常の可愛いもの」「子どもが大笑いするもの」を入れたいという子どもたちのアイディアから誕生。高度なグラフィックより、動きの愛嬌(イージングアニメーション)を大事にする。
- **ゲーム内は英語**: 英語学習・グローバル展開・友達への自慢を意識した方針(§4)。

## 3. 役割と進め方

Claude は『Moku Series』の**プロプランナー 兼 クリエイティブエンジニア**として動く。

- ゲームをワクワクさせる新システム・演出・イベントを提案し、実装する。
- 市販ゲームのような洗練されたデザイン・アニメーション・効果音で「垢抜け感」を高める。
- 抽象的なレポートや提案だけのテキストファイル(`README_AI_SUGGESTION.md` 等)は作らない。**そのまま動くコードの変更**として出す。
- 1回の変更(PR)は小さく、インパクトの大きいものに絞る。既存コードを省略・短縮しない。

## 4. デザイン・世界観の絶対ルール

- **世界観の維持**: 温かみのあるイラスト調・絵本のような世界観(夕焼け、木目、可愛いキャラクター)を必ず維持する。子どもと作っているので「怖くない」「温かい」「親しみやすい」が最優先。
- **禁止事項**: ネオン調、サイバー感、過度なダークモード、幾何学的すぎるUIへの作り替え。
  - 例外: `SPEC.md` §3 で定義済みのハブ(`index.html` / `hub.html`)のダークネイビー基調+都市写真背景は確立済みのデザインで、維持する。
- **改修範囲**: デザインの全面刷新ではなく、ゲーム性の微調整(演出の追加、サウンド効果、ステージ配置、エフェクトの軽微な追加)を基本とする。
- **Moku City**: 街づくり機能を追加する際は、必ず「緑化率・自然環境への影響」のパラメータや演出を考慮する。
- **言語(2026-10-24 確定)**: ゲーム内のUI・HUD・ボタン・ダイアログ・トースト・説明文は**すべてシンプルな英語**。日本語はコードのコメントや開発用ドキュメントだけに使う。詳細は SPEC.md §3。 例外: 保護者専用の管理画面 `admin.html` は日本語(SPEC.md §12)。
- **優先順位**: 色・寸法・レイアウトなど具体的な値は `SPEC.md` が正。本ファイルは世界観・方針を定める。

## 5. 起動・確認方法

```sh
npm install
npm run dev   # http://localhost:3000 (server.js: 静的配信 + /api/scores と /auth・/save のモック)
cd backend && npm test   # アカウントAPIのテスト(AWS不要)
```

ビルド工程はない。各ゲームは単一HTMLファイル(HTML/CSS/JSインライン)で、ブラウザで直接開いても動く。
変更後はブラウザ(Playwright + Chromium が利用可)で対象ゲームを実際に開いて、コンソールエラーがないことを確認する。

### 端末対応で気をつけること

- **音**: iOS Safari などは最初のタップまで `AudioContext` が `suspended` のまま。`ctx.resume()` をタッチ/クリックに紐付ける。効果音・BGMは音源ファイルを使わず Web Audio API で合成している。
- **画面**: iPhone のノッチ/ホームバー(`env(safe-area-inset-*)`)、iPad の 4:3、縦長スマホで HUD や操作ボタンが重ならない・見切れないか確認する(特に `moku-kart.html` / `moku-bento.html` の固定操作パネル)。
- **localStorage**: プライベートブラウズ等で例外が出てもゲームが止まらないよう try-catch で包む。
- **Three.js**(`moku-future-run.html` / `flying-moku.html` / `moku-rane.html` / `moku-dropper.html`): リトライやシーン再初期化で geometry / material / texture を `dispose()` しているか気をつける。

## 6. ブランチ・PR運用

- **`main` に直接 push しない。** 作業ブランチで変更し、PR 経由でマージする。
- 画像などのバイナリ(`backgrounds/` `brand/` `icons/` `screenshots/`)は理由なく再生成・再エンコードしない。
  - アプリアイコン・ファビコン(`icons/icon-*.png` `icons/apple-touch-icon.png` `icons/favicon-32.png` `favicon.ico`)は `python3 scripts/make-icons.py` で `brand/mokumoku-hero.png` から作る。作り直したら `index.html` / `hub.html` / `hub-manifest.json` のアイコンURLの `?v=` を上げる(ブラウザのキャッシュ対策)。
  - 2026-10 に AI Studio の Push で PNG がテキスト扱いされて壊れた(バイト列が `EF BF BD` に化けた)。`.gitattributes` で画像を binary 指定している。
- 変更したゲームは SPEC.md §5 に従い `#buildInfo` のバージョンと日付を更新する。
- **`shared/*.js` を変えたら、読み込んでいる全HTMLの `?v=` を上げる**(`src="shared/moku-account.js?v=20261025"` の形。値は全ファイルで同じにそろえる。日付で、同じ日に2回目以降は `20261025b` のように英字を足す)。上げないと、ブラウザや dechatgpt.com の Cloudflare が古い共通スクリプトを使い続け、新しい HTML と食い違う(2026-10-25 に My Moku 画面が「Guest」・Moku なしで表示された)。

## 7. コーディング規約(要点)

- フレームワーク・バンドラーは導入しない。ライブラリは CDN 経由のみ。
- `localStorage` のキーは `moku:<gameId>:<key>`。`gameId` はファイル名(拡張子なし)。このキーは自動でクラウドセーブの対象になる(SPEC.md §10)。
- 新規タイトルを追加したら `index.html` / `hub.html` の `GAMES` 配列(stats / `progress()` / 一言サマリーの `badge()`。`badge()` は My Moku 画面(`hub.html#me`)の My Games にも出る)にも追加する。`hub.html` は表示用の `CATALOG` / `SHELVES` と `icons/games/<gameId>.svg` / `screenshots/<gameId>.jpg` も必要(SPEC.md §7)。
- ゲームページには `<script src="shared/moku-account.js" data-mode="background"></script>` を入れると、ページを閉じた時に進捗がクラウドへ保存される(SPEC.md §10)。
- **すべてのページ**(新しいゲームも)は `<head>` の先頭(`<meta charset>` の直後)に `<script src="shared/moku-errors.js"></script>` を入れる。エラーが管理画面に届く(SPEC.md §12)。
- **ゲームとハブはログインした人だけ**(2026-10-25〜)。新しいゲームも `moku-errors.js` の直後に `<script src="shared/moku-gate.js"></script>` を入れる。未ログインなら `index.html` のログインへ送られる(SPEC.md §10)。
- 進捗の端末間の移動は2通り: ログインしてのクラウドセーブ(SPEC.md §10)と、サーバー不要の引き継ぎコード `shared/moku-transfer.js`(SPEC.md §11)。どちらも同じ同期対象キーを使う。

## 開発履歴について

- 2026-10-24 までは Google AI Studio(Build)と Claude Code で並行開発していた。AI Studio はリポジトリ全体のスナップショットを1コミット("Push" 等)として `main` に書き込む方式だったため、コミットの粒度が粗い。AI Studio 用の `Gemini.md` / `AGENTS.md` / `metadata.json` / Gemini 自動改修ワークフローは移行時に削除し、内容は本ファイルと SPEC.md に統合した。
- 各ゲームファイルの初期の開発履歴は `aohaus/Dev` から `git merge --allow-unrelated-histories -s ours` で統合済み。**通常の `git log -- <file>` は merge simplification により古い履歴が省略される**ため、過去の経緯を追うときは `--full-history` を付ける。

```sh
git log --full-history --oneline -- moyomoyo.html
```
