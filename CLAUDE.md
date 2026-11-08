# Moku Series — 開発ガイド

『Moku Series』は、フクロウのキャラクター「Moku(モクモク)」が主役のブラウザ向けミニゲーム集。
小学生2名とアイディアを出し合い、AIを活用した開発ライフサイクルを体験しながら共同制作している。
**2026-10-24 から Claude Code のみで開発している**(それ以前は Google AI Studio と並行開発。経緯は「開発履歴について」)。

- 技術仕様・共通UI・セーブデータ・アカウント規約: @SPEC.md
- 技術スタックの要約(外部IDE・ツールとの並行開発で前提をそろえる用、コピペで渡せる): `TECH_STACK.md`。スタック(ライブラリ・API・デプロイ・共通モジュール)を変えたら更新する

## 1. ビジョン

1. **子どもたちの体験・教育**: AIとの適切な距離感や活用法を身につけ、将来「自分専用の学習・家庭教師アプリ」などを自力で計画・開発できるスキルとマインドを育む。
2. **クオリティ目標**: 子どもたちが友達に自慢して紹介できる、市販ゲームのような「垢抜け感」「洗練されたUI/UX」。
3. **ビジネス目標**: 将来的な収益化(年間約1,200ドルが目標)を見据え、社会に役立ち愛されるプロダクトに育てる。

## 2. 収録タイトル

| タイトル | ファイル | ジャンル |
| --- | --- | --- |
| Angry Mokumoku | `angry-mokumoku.html` | スリングショット物理アクション |
| Angry Moku Battle Royal | `angry-moku-battle-royal.html` | 3Dのバトルロイヤル(迷路の広場で Moku vs CPU 3羽) |
| Angry Moku Battle Royal (Classic) | `angry-moku-battle-royal-classic.html` | 2D だった v1.2.0 をそのまま残した版(ハブには出さず、本編のタイトル画面「🕰 Classic Mode」から開く) |
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
| Moku Word Riddles | `moku-word-riddles.html` | 英語のレバス・パズル(問題は `data/riddles-db.md` に Markdown で追記するだけ)+早押しの Riddle Race |
| Moku Dropper | `moku-dropper.html` | 3Dドロッパー(大きな木の幹の中を落ちてポータルへ。ライバルとレース) |
| Moku Mall | `moku-mall.html` | モール経営+泥棒退治(店を開いて稼ぎ、ATM をねらう泥棒をつかまえる。4つのモール) |
| Mokuball | `mokuball.html` | サッカー/ピンボール風(ハブ未公開) |
| Sir CEO Moku | `ceo-moku.html` | 社長の Moku と会話する部屋(CEO's Pick のボーナス・Pop Quiz・ゲームのアイデア相談) |

ハブは `index.html`(入口のスプラッシュ)と `hub.html`(ゲーム一覧)。最新の一覧は `hub.html` の `CATALOG` が正。

### 子どもたちと決めた、コードからは見えない意図

- **Moku City**: 「ただビルを建てるだけだと普通のシムシティと同じ」という子どもの意見から、**緑(自然)を一定割合残さないと市民の幸福度が下がる**ルールを入れた。環境教育とゲーム性の両立がテーマ。
- **Moku Dropper**: 子どもが別の Claude で作った「Moku Dropper 3D」(マイクラのドロッパー風、青い壁の縦穴)が元。ラウンド構成・障害物のおやつ・「ぶつかったら上からやり直し」・紫のポータルは子どもの設計なので変えない。舞台だけ The Hollow の大きな木の幹の中にして、シリーズの世界観とつないだ。2026-10-31 に遊んでみた声で、CPU を弱く・遅く、各フロアの穴を2つに、レースの相手を2人に、星をやめて 1st / 2nd / 3rd の順位だけにした(SPEC.md §13)。
- **Moku Mall**: 子どもが別の Claude で作った「Moku Mall Tycoon」(v0.11)を 2026-11-08 に取り込んだ。**以後はこのリポジトリの Claude Code で開発する**(子どもの Claude では続けない)。10 の店・4 つのモール・泥棒とスーパー泥棒・警備員・Superpower・Check・悪いお客さん・調整済みの数値は子どもの設計なので変えない。取り込み時に保護者と決めたこと: 名前から参考にしたゲーム名(Tycoon)を外す/実在のモール名を架空の名前に(豪華な順に Moku Sunshine Resort Mall > Moku's Garden Mall > Moku's 1st Mall。Sunset Plaza はそのまま。背景も名前に合わせて海辺のリゾートと花の庭に描き直した)/固定の名前の Leaderboard と Ranked Mode を外す/横向き専用/Moint は泥棒 30・スーパー泥棒 50・モールの初クリア 100〜500(SPEC.md §13)。泥棒の設定は残し、文言だけやわらかくした。
- **Angry Moku Battle Royal の Classic Mode**(2026-11-08): エンハンスの前に、今の版(v1.2.0)を `angry-moku-battle-royal-classic.html` に凍結して、いつでも遊べるように残した。**Classic のゲームの中身は直さない**(エラーの修正と共通スクリプトの `?v=` 上げは除く)。セーブ(`moku:save`)とランキングは本編と共有なので、本編でセーブの形を変える時は Classic でも読める形にするか、本編だけ新しいキーにする。
- **Angry Moku Battle Royal の 3D**(2026-11-08、v2.0.0): 子どもたちのホワイトボードのスケッチから。Moku の後ろから見るカメラ・左上の MAP(押すと大きい地図)と時計・左下のジョイスティック・右下の技ボタン・右側の CPU の顔(矢印で「Moku から見てどっちにいるか」、自分を狙っていたら 👀、戦っている最中は ⚔️)・迷路のような生け垣のある地図と四隅のスタート(自分は S)は子どもの設計なので変えない。技・ダメージ・装備・コイン・レベル・Spin の決まりとセーブは 2D の時のまま。
  - v2.1.0(2026-11-08): **自分の Moku は Moku Bridge / Flying Moku のぬいぐるみの Moku**(ベージュの体・緑の3枚葉のしっぽ。Moku Closet の帽子も載せる。装備は 服=肩のケープ、帽子=ハチマキ、翼=色と大きさ、武器=手に持つ、お守り=足元の輪)。CPU は前のフクロウのまま。**タイトルとホームを1つのスタート画面に**して、3D のフィールドをななめ上からゆっくり回って見渡す背景の上に Start / Customize / Spin / 🏆 Leaderboard(ハブの Achievements = 共通のリーダーボード)/ 🕰 Classic Mode。ゲーム内の Ranks 画面はなくした(スコアは Classic の Ranks のために今までどおり送る)。Customize はカメラが自分の Moku に寄って、レア度で色分けしたカード。Spin は当たりやすさどおりの大きさに分けたルーレット。
- **Moku Bento / Shiri of Moku**: レース・パズル・格闘のような定番ジャンルだけでなく、「日常の可愛いもの」「子どもが大笑いするもの」を入れたいという子どもたちのアイディアから誕生。高度なグラフィックより、動きの愛嬌(イージングアニメーション)を大事にする。
- **ゲーム内は英語**: 英語学習・グローバル展開・友達への自慢を意識した方針(§4)。

## 3. 役割と進め方

Claude は『Moku Series』の**プロプランナー 兼 クリエイティブエンジニア**として動く。

- ゲームをワクワクさせる新システム・演出・イベントを提案し、実装する。
- 市販ゲームのような洗練されたデザイン・アニメーション・効果音で「垢抜け感」を高める。
- 抽象的なレポートや提案だけのテキストファイル(`README_AI_SUGGESTION.md` 等)は作らない。**そのまま動くコードの変更**として出す(例外: §8 の定期レビューの記録 `reviews/` と §9 の UX サイクルの台帳 `ux-cycles/`)。
- 1回の変更(PR)は小さく、インパクトの大きいものに絞る。既存コードを省略・短縮しない。

## 4. デザイン・世界観の絶対ルール

- **世界観の維持**: 温かみのあるイラスト調・絵本のような世界観(夕焼け、木目、可愛いキャラクター)を必ず維持する。子どもと作っているので「怖くない」「温かい」「親しみやすい」が最優先。
- **禁止事項**: ネオン調、サイバー感、過度なダークモード、幾何学的すぎるUIへの作り替え。
  - 例外: `SPEC.md` §3 で定義済みのハブ(`index.html` / `hub.html`)のダークネイビー基調+都市写真背景は確立済みのデザインで、維持する。
- **改修範囲**: デザインの全面刷新ではなく、ゲーム性の微調整(演出の追加、サウンド効果、ステージ配置、エフェクトの軽微な追加)を基本とする。
- **Moku City**: 街づくり機能を追加する際は、必ず「緑化率・自然環境への影響」のパラメータや演出を考慮する。
- **言語(2026-10-24 確定)**: ゲーム内のUI・HUD・ボタン・ダイアログ・トースト・説明文は**すべてシンプルな英語**。日本語はコードのコメントや開発用ドキュメントだけに使う。詳細は SPEC.md §3。 例外: 保護者専用の管理画面 `admin.html` は日本語(SPEC.md §12)。Sir CEO Moku(`ceo-moku.html`)だけは、Moku の話し方(語尾「〜モク」)を活かすため、英語が初期値のまま日本語モードに切り替えられる(2026-11-08、保護者と決定。SPEC.md §13)。ほかのゲームには広げない。
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
- **Three.js**(`moku-future-run.html` / `flying-moku.html` / `moku-rane.html` / `moku-dropper.html` / `angry-moku-battle-royal.html`): リトライやシーン再初期化で geometry / material / texture を `dispose()` しているか気をつける。

## 6. ブランチ・PR運用

- **`main` に直接 push しない。** 作業ブランチで変更し、PR 経由でマージする。
- **バックエンド(`backend/`)は `main` へのマージで自動デプロイ**(2026-11-01〜、`.github/workflows/deploy-backend.yml`: テスト → `sam deploy` → ヘルスチェック)。CloudShell での手作業はいらない(招待コード・AuthSecret を変える時を除く)。`template.yaml` に新しいパラメータを足す時は必ず `Default` を付ける(自動デプロイは既存の値のまま更新するため)。初回設定は `backend/README.md`。
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
- **時間・回数・上限などの「決まりの数字」はハードコーディングしない**(2026-11-01〜)。サーバーで決める値は `backend/src/settings.js` の `SCHEMA` に初期値と範囲つきで足し、管理画面の「⚙️ 設定」から保護者が変えられるようにする(SPEC.md §12)。既存のハードコーディングは、さわる機会に順に移す。
- 進捗の端末間の移動は2通り: ログインしてのクラウドセーブ(SPEC.md §10)と、サーバー不要の引き継ぎコード `shared/moku-transfer.js`(SPEC.md §11)。どちらも同じ同期対象キーを使う。

## 8. 定期コードレビュー(Semi-Auto Code Review & Health Check、2026-11-01〜)

コードの肥大化・重複・セキュリティ・性能・データ整合性を定点観測するための、**2週に1回**のセルフレビュー。

- **いつ**: 2週に1回、開発が落ち着いて**ほかの作業ブランチが動いていない時**(進行中の変更が混ざると差分の比較がぶれるため)。日付はきっちりでなくてよい。
- **どうやって**: `REVIEW_TEMPLATE.md` の「---」から下をそのまま AI(Claude Code など)に渡す。前回SHAは `reviews/README.md` の台帳の一番下の行の「今回SHA」。AI が変わってもテンプレートの重大度・確信度・採点の基準と固定チェック(C1〜C9)は同じものを使う。
- **レビューは読み取り専用**: AI はコードを直さない(提案だけ)。本番 API・DynamoDB には書き込まない(検証は `npm run dev` のモックと `npm test`)。
- **記録**: 結果を `reviews/YYYY-MM-DD.md` に保存し、`reviews/README.md` の台帳に1行(日付・今回SHA・前回SHA・点数・確信度・未解消の High / Medium 件数・テンプレート版)。記録だけの小さな PR(`reviews/` だけを変える)でマージする。
- **直す時**: 指摘は1件ずつ、ふだんの小さな PR で直す(レビューの PR に修正を混ぜない)。コミットメッセージや PR に指摘の ID(`MR-001` など)を書くと、次のレビューで「解消」を確かめやすい。High は次のレビューを待たずに直す。
- **過剰な変更をしない**: レビューをきっかけにした全面リファクタリング・フレームワーク導入・設計の作り替えはしない(本ファイル §3・§7)。
- **テンプレートを変えたら** `REVIEW_TEMPLATE.md` 冒頭の「テンプレート版」を上げる。版が違う回の点数は単純に比べない。

## 9. UX 改善サイクル(`/ux-cycle`、2026-11-06〜)

ゲームの**遊ぶ人の体験**を、小さく継続的に良くするための週1回のサイクル(§8 はコードの健康診断、こちらは体験)。
AWS re:Invent 2025 の「AIM301: Build an End-to-End SRE Use Case with Bedrock AgentCore」の4エージェント構成を、Claude Code のサブエージェントで小さく真似ている。

| ワークショップ | Moku | 定義 |
| --- | --- | --- |
| Supervisor | 🦉 Producer(まとめ役) | `.claude/skills/ux-cycle/SKILL.md`(`/ux-cycle`) |
| Diagnostic | 🔍 Play Detective(診断。読み取り専用) | `.claude/agents/moku-detective.md` |
| Remediation | 🛠 Fixer(案を出す・選ばれた案を作る) | `.claude/agents/moku-fixer.md` |
| Prevention | 🌳 Guardian(同じ種類の問題を仕組みで防ぐ) | `.claude/agents/moku-guardian.md` |
| AgentCore Gateway | 受け渡しの場所 | 会話+ログ `ux-cycles/logs/`+台帳 `ux-cycles/README.md`+PR |

- **流れ**: Detective が Top3 → **子どもたちが1つ選ぶ** → Fixer が直し方を2〜3案 → **子どもたちが選ぶ** → Fixer が作る → Guardian が再発防止 → 台帳に1行+PR(マージは保護者)。AI は選択を代わりにしない(§1 の「AIとの適切な距離感」)。1サイクルで直すのは1件。
- **Detective の手がかり**: `npm run ux:smoke`(= `node scripts/ux-smoke.js [gameId ...]`。ハブと全ゲームを iPhone 縦・iPad 横・PC の大きさで、ログインした状態で開き、コンソールエラー・ログイン画面への飛ばされ・横スクロール・画面の外に出たボタンを調べてスクリーンショットを撮る。結果は gitignore 済みの `.ux-cycle/<日付>/report.md`)。あれば管理画面のエラー(「Claude Code に渡す情報」)・アクセスログの `play`・子どもたちの声を貼り付けて渡す。
- **Guardian**: 台帳の「種類」で、同じ種類の問題が2回目以上なら、smoke のチェック / `backend/test/` のテスト / このファイルか SPEC.md のルールのどれか1つを足す。
- **改修のログ**(エージェントを通じた変更は必ず残す): `ux-cycles/logs/<サイクルID>.jsonl` に1行1件で追記だけする(`scripts/ux-agent-log.js`)。
  - 自動: `.claude/settings.json` の `SubagentStart` / `SubagentStop` hook が、3人のエージェントの開始と最終報告(その時点のコミット・変更中のファイルつき)を書く。ほかのサブエージェント(Explore など)は書かない。
  - Producer が書く: サイクルの開始(`start`)・人が選んだこと(`decision`)・メモ(`note`)・終了と PR(`end`)。
  - コミットには trailer `UX-Cycle:` / `UX-Agents:` / `UX-Log:` を付ける。`git log --grep "UX-Cycle:"` でエージェント経由の改修だけを一覧でき、`node scripts/ux-agent-log.js render <サイクルID>` で1サイクルの流れを Markdown で読める(PR の本文にも貼る)。
  - ログは書き換え・削除をしない(まちがいは `note` で訂正)。
- 台帳・ログ・PR・コミットに子どもの名前や Player ID を書かない(人数は数で)。
- **毎週木曜の夜に自動で前半だけ**(2026-11-06〜、木曜 18:47 マレーシア時間): Claude Code のスケジュール実行が、診断専用のクラウドセッション「🦉 Moku UX weekly diagnosis (home)」(リポジトリつきで立ち上げてあるので、3人のエージェント・`/ux-cycle`・ログの hook がそろっている。新しいセッションを毎回作る方式は、リポジトリが付かず使えなかった)を起こして `/ux-cycle auto` を動かし、smoke+Detective の診断を `ux/<日付>-weekly` ブランチ(`ux-cycles/logs/<サイクルID>.md` と `.jsonl`)と GitHub Issue「🦉 UX cycle …: pick one to fix」に残して、スマホに通知する。直すのは人が選んでから(金曜の午前に `/ux-cycle resume <サイクルID> <番号>`)。Claude Code の利用枠が金曜のお昼ごろに戻るので、木曜の夜は軽い診断だけ、金曜の午前に残りの枠で直す分担。
  - **トークンを抑える工夫**(2026-11-06〜): ①Detective は Sonnet で動く(`moku-detective.md` の `model: sonnet`。Fixer / Guardian は人が選んだ後の金曜なので既定のまま)。②専用セッションは毎週同じものを使う(毎週新しいセッションに入れ替える案は、スケジュールの宛先をあとから変えられないため 2026-11-06 にやめた。一番重い診断が Sonnet なので、会話がたまっても増え方は小さい)。時間がかかるのは `ux:smoke` のブラウザの待ち時間で、その間トークンはほぼ使わない。
  - **動いているかの確かめ方**: 毎週木曜の夜〜金曜の朝にスマホの通知と Issue が来ているか。来ていなければ Claude Code に「UX の定期実行の最後の実行」を聞く(スケジュールの最後の実行と、専用セッションの記録を見られる)。専用セッションがなくなった・ずっと失敗する時は、リポジトリつきのセッションを作り直して、スケジュールの宛先をそのセッションにする。`ux-cycles/logs/` にはブランチがマージされた週の分だけが入る。
  - 自動の診断が見られないもの: 管理画面のデータ(エラー・アクセスログ。resume の時に貼り付ける)と、クラウドから CDN に届かない 3D のゲーム。
- 次の段階の候補: 管理者専用の読み取りだけの `GET /admin/ux-digest`(エラーとゲームごとの遊ばれ方をまとめた JSON)で、自動の診断でも管理画面のデータを使えるようにする。

## 開発履歴について

- 2026-10-24 までは Google AI Studio(Build)と Claude Code で並行開発していた。AI Studio はリポジトリ全体のスナップショットを1コミット("Push" 等)として `main` に書き込む方式だったため、コミットの粒度が粗い。AI Studio 用の `Gemini.md` / `AGENTS.md` / `metadata.json` / Gemini 自動改修ワークフローは移行時に削除し、内容は本ファイルと SPEC.md に統合した。
- 各ゲームファイルの初期の開発履歴は `aohaus/Dev` から `git merge --allow-unrelated-histories -s ours` で統合済み。**通常の `git log -- <file>` は merge simplification により古い履歴が省略される**ため、過去の経緯を追うときは `--full-history` を付ける。

```sh
git log --full-history --oneline -- moyomoyo.html
```
