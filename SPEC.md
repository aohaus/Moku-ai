# Moku Series 共通仕様

Mokuシリーズはポータル(`index.html`)から各ミニゲーム(単一HTMLファイル)へ遷移する構成。
9タイトル予定、現在5タイトル稼働中(Angry Mokumoku / Moyomoyo / MK Mobile / Angry Moku Battle Royal / Shiri of Moku)。
Mokuball は実装済みだがハブ未公開(準備中)。

## 1. ゲーム間の技術構成

- **フレームワーク不使用、単一HTMLファイル完結**を基本とする(現行3タイトルの構成に合わせる)。
  - 1ゲーム = 1つの `.html`(HTML + CSS + JS 全部インライン)。ビルド工程なし、そのまま静的ホスティング可能。
  - ライブラリを使う場合はCDN経由のみ許可(バンドラー導入はしない)。
- **描画方式**: Canvas 2D を基本とする。ジャンル上どうしても必要な場合のみDOM/CSSアニメーションを併用可(現行ポータルのカードUIのように)。
- **ファイル命名**: `kebab-case.html`(例: `angry-mokumoku.html`)。ポータルの `<a href>` と一致させる。
- **ディレクトリ構成(案)**:
  ```
  /index.html              ポータル
  /angry-mokumoku.html
  /moyomoyo.html
  /mk-mobile.html
  /shared/
    moku-ui.css             共通デザイントークン・カードコンポーネント
    moku-save.js             共通セーブデータAPI
  ```
- **対応環境**: モバイルブラウザ優先(viewport-fit=cover 設定済み)。タッチ操作を第一級とし、マウス/キーボードは補助。
- **オフライン/配布**: 外部通信なしでも起動できることを基本とする(広告SDK等を導入する場合はゲーム側で明示的にopt-in)。

## 2. セーブデータ / 進捗管理

- **保存先**: `localStorage`。ログイン中のプレイヤーは §10 のクラウドセーブで端末間同期される(ゲーム側は従来どおり `localStorage` だけを読み書きすればよい)。
- **キー名前空間**: `moku:<gameId>:<key>` 形式で統一し、ゲーム間の衝突を防ぐ。
  - 例: `moku:angry-mokumoku:progress`, `moku:moyomoyo:highscore`
- **共通スキーマ(ゲームごとのセーブデータJSON)**:
  ```json
  {
    "version": 1,
    "gameId": "angry-mokumoku",
    "unlockedStage": 5,
    "highScore": 12300,
    "stageStars": { "1": 3, "2": 2 },
    "updatedAt": "2026-08-10T00:00:00Z"
  }
  ```
  - `version` はマイグレーション用。フィールドはゲームジャンルにより増減可だが、`version` / `gameId` / `updatedAt` は必須。
- **ポータル側の進捗表示**: 将来的に各ゲームの `highScore` 等をポータルのカードに表示する場合、`shared/moku-save.js` が全ゲームのキーを横断的に読み取れるようにする。
- **共通ヘルパーAPI(案: `shared/moku-save.js`)**:
  ```js
  MokuSave.load(gameId, defaults)
  MokuSave.save(gameId, data)
  MokuSave.reset(gameId)
  ```

## 3. 共通UI / デザインシステム

ポータル(`index.html`)のトーンを全ゲーム共通のベースとする。

- **カラー**
  - 背景: ダークネイビー系グラデーション `#0A0B12 → #121320 → #0A0B12`
  - テキスト: `#EDEEF6`
  - ゲームごとのアクセントカラー(`--hi` / `--lo`)を1色ペア割り当てる
    - Angry Mokumoku: `#4CBE55` / `#1A5020`(緑)
    - Moyomoyo: `#E98FC7` / `#7A3D63`(ピンク)
    - MK Mobile: `#FFC94A` / `#8A6218`(黄)
    - Angry Moku Battle Royal: `#6E7BFF` / `#2B2F80`(藍)
    - Shiri of Moku: `#FF6B4A` / `#7A2E1A`(朱)
    - Mokuball: `#B98CFF` / `#4B2E7A`(紫)
    - Moku Fight: `#2EC4B6` / `#145A55`(ティール。Mokuの蝶ネクタイの色)
    - Moku Watch 6 Lazy: `#FFA552` / `#7A4214`(タンジェリン。夕焼けの色)
    - 追加タイトルは新規ペアを定義(既存と被らない色相を選ぶ)
- **タイポグラフィ**: `-apple-system, "Segoe UI", Roboto, sans-serif`。見出しは `font-weight: 800`、字間 `0.01〜0.04em`。
- **タイトル画面メニューの統一(2026-08-14〜)**: フォント**ファミリー**はゲームごとの世界観を尊重して統一しない(Angry MokumokuはCourier New、他はArial/システムフォントのままでよい)。ただし**サイズ・太さ・揃え方・行間**は統一する。
  - HTML実装(Battle Royal / Shiri of Moku / Mokuball): `.titleMenuItem`(または相当クラス)は `font-size: 19px; font-weight: 800;` 固定値(`clamp()`にしない)、`padding: 8px 18px;`。コンテナは `margin-top: 10px; gap: 6px;` で中央揃え。
  - canvas実装(Angry Mokumoku / Moyomoyo): タイトルロゴを基準にメニュー文字サイズを概ね0.38〜0.40倍にする(Angry Mokumoku: 50px→20px。Moyomoyo: 110px→43px)。太字・中央揃え・選択中はグロー+`▶ `プレフィックス、非選択は低コントラストという表現もこの2タイトルで共通。
  - **MK Mobileは対象外**: 現状メニューがテキストリストではなくピルボタン(`▶ START`)のまま(§9の積み残しタスク)。テキストリスト化してから本項のサイズ統一を適用する。
- **共通コンポーネント**
  - カード(`.card`): 角丸16px、2pxボーダー(アクセントカラー)、内側に1pxの縁取り、hoverで浮き上がる。
  - ロック中カード(`.card.soon`): 破線ボーダー、低コントラスト、非活性。
  - フッター: 区切り線 + タグライン + `repo-note`。
- **共通レイアウト規約**
  - `max-width: 900px` 中央寄せ、`clamp()` によるレスポンシブ余白/フォントサイズ。
  - 各ゲーム画面にも「ポータルへ戻る」導線を統一デザインで設置する(未実装 — 要検討)。
- **実装方針**: 上記トークン・コンポーネントを `shared/moku-ui.css` に切り出し、各ゲームHTMLで `<link>` または `<style>@import` して再利用する。
- **言語(2026-10-24 確定)**: ハブ(`index.html` / `hub.html`)もゲーム本編も、プレイヤーに見える文言(UI・HUD・ボタン・ダイアログ・トースト・説明文・ゲーム内テキスト)は**すべてシンプルな英語**にする(英語学習・グローバル展開のため)。日本語はコードのコメントと開発用ドキュメントだけに使う。以前の「ゲーム本編は日本語UIのままでよい」という規定は廃止。日本語UIが残っているタイトルは「未決事項」を参照。

## 4. 「ポータルへ戻る」導線 / タイトル画面の共通フレーム

**この章は実装済みパターンに合わせて更新済み(2026-08-11)。** 当初案の丸ボタン(`.moku-back`)は採用されず、実際には全タイトルが以下の3点セット(HTML固定要素、canvas描画ではない)をタイトル画面にのみ表示する方式に収束している。

- **`#title-frame`**: 画面全体を囲む二重線枠。`position: fixed; inset: 14px;` の外枠(3px, `var(--hi)`)+ `::after` による内枠(inset 5px, 1px, `var(--lo)`)。角丸10px/8px。全タイトル共通・固定値、変更しない。
- **`#hub-link`**: 右上に固定配置する `<a href="index.html">🦉 Moku Series ▶</a>`(2026-08-14〜英語表記に統一)。ゲームごとの `--hi` を文字色に使い、2.2sの緩いパルスアニメーションを掛ける。
- **`#buildInfo`**: 左下に固定配置するバージョン表記。詳細は5章。
- **表示タイミング**: 3要素とも「タイトル画面でのみ表示」。`body.on-title` のようなクラス、または各ゲームの画面遷移関数内で `style.display` を直接切り替える方式のいずれでもよい。プレイ中は必ず非表示にする。
- **実装例**: `angry-mokumoku.html` / `shiri-of-moku.html` / `mokuball.html` を参照。
- **横向き専用タイトルの場合**: `angry-mokumoku.html` と `mokuball.html` はゲーム内容上、横持ち固定(landscape-only)。`@media (max-width: 900px) and (orientation: portrait)` 相当の条件で `#rotate-hint`(回転を促す全画面オーバーレイ)を表示し、同条件で `#title-frame` / `#hub-link` / `#buildInfo` / ゲーム本体を非表示にするパターンを両タイトルで踏襲している。縦持ち基本のタイトルではこの節は不要。

## 5. バージョン / 最終更新日時の表示

各ゲームのタイトル画面左下に、目立たないバージョン表記を英語で置く。

- **表示**: `v<version> · Updated <Mon D, YYYY>`(例: `v1.0.0 · Updated Aug 10, 2026`)。日付は英語表記(`Aug 10, 2026`)固定、和暦・スラッシュ区切りは使わない。
- **配置**: 画面左下 `position: fixed`、`env(safe-area-inset-*)` 考慮。`#hub-link`(右上)と対になる位置。
- **見た目**: `color: rgba(255,255,255,0.28)` 程度の低コントラスト、`font-size: 10.5px` 前後。ゲームのアクセントカラーは使わず、常にニュートラルな白の低透明度にする(視認性より控えめさ優先)。
- **表示タイミング**: `#hub-link` / `#title-frame` と同じタイミングでのみ表示(タイトル画面のみ。プレイ中は非表示)。
- **id**: `#buildInfo` で統一。
- **バージョンの更新**: そのゲームに実質的な変更を加えたセッションが、`v<major>.<minor>.<patch>` を適宜インクリメントし、日付を更新する。運用ルールの詳細(何が minor/patch にあたるか等)は今のところ決めておらず、各セッションの裁量に委ねる。

## 6. ゲーム記録集約API(共通ランキング基盤)

Mokuシリーズ全体で使う軽量な共有バックエンド。§1の「外部通信なしでも起動できることを基本とする」方針を維持したまま、
各タイトルが任意でランキング機能を追加できるようにするための共通規約。

- **現在の実装方針: Dreamlo(外部ホスト型リーダーボードサービス) + HTTPSプロキシ**
  - 自前インフラほぼ不要、キー発行のみで使える無料サービス。開発工数を抑えるため採用。
  - タイトルごとに**別々のDreamloリーダーボード**(別々のpublic/private keyペア)を作成する。1リーダーボード共有にしない(下記の理由による)。
  - Dreamloの無料枠は**1リーダーボードにつき上位25件まで**保持(それ以降は最下位が押し出される)。同名で再送すると高い方のスコアだけが残る(自己ベスト管理は不要、Dreamlo側で自動)。ランキング表示用途としてはこの挙動で十分。
  - **⚠️ DreamloのURLは`http://`のみ**(HTTPS化は有料寄付が必要)。GitHub Pages等HTTPS配信のゲームから直接叩くとMixed Contentでブラウザにブロックされるため、`dreamlo-proxy/`(Lambda 1関数、HTTPS入口はFunction URLまたはAPI Gateway)経由で使う。ACMや独自ドメインは使わない。
  - **private codeはクライアントに渡さない**。ゲームHTMLは誰でもソースを閲覧できる公開ファイルのため、Dreamloの書き込み用private codeをクライアント設定に含めるとランキングを自由に改ざんされる。`dreamlo-proxy`が`gameId → {public, private}`のマッピングをLambdaの環境変数(`GAME_KEYS`)として保持し、クライアントは`gameId`とスコアのみを送る(Dreamlo自体のURLやキーは一切意識しない)。仕様・デプロイ手順・**デプロイ済みのProxy base URL**は [`dreamlo-proxy/README.md`](dreamlo-proxy/README.md) を参照。
  - クライアント側ヘルパー: [`shared/moku-scores.js`](shared/moku-scores.js)(`MokuScores.configure({ proxyBaseUrl, gameId })` / `submit` / `fetchTop`)。
  - 外部サービス依存のため、可用性・改ざん耐性はコントロール外。数百人規模のカジュアル用途と割り切る。
- **将来の代替/拡張案: 自前ホスト(API Gateway + Lambda + DynamoDB)**
  - 実装済みテンプレートが `backend/`(AWS SAM)にある。仕様は [`backend/API_SPEC.md`](backend/API_SPEC.md) / デプロイ手順は [`backend/README.md`](backend/README.md)。
  - Dreamloで要件を満たせなくなった場合(25件超の保持、改ざん対策、独自ロジック等)の移行先として保持。
  - 2026-10-24〜 同じスタックに §10 のアカウント / クラウドセーブ API(`/auth/*` `/save`)を同居させている。スコアAPI(`/scores`)は引き続き予備。
- **通信タイミング(opt-in、Dreamlo/自前どちらの実装でも共通)**: 常時通信はしない。ゲーム側が明示的に呼ぶのは以下のみ。
  - スコア確定時にベストスコアを送信
  - ランキング画面を開いた時のみ取得を呼ぶ
  - 通信失敗時もローカルの `localStorage` 記録(§2)を正とし、プレイ継続に影響させない。
- **プレイヤー識別**: ゲストはデバイスごとのUUIDを`localStorage`の`moku:deviceId`(全ゲーム共通、ゲームIDのnamespaceを付けない)に保存し、プレイヤーキーとして使う。ログインは任意(§10)。ログイン中は `shared/moku-scores.js` がセッショントークンを送り、プロキシがアカウントの表示名+検証済みタグ `#u…` に置き換える(ゲスト名は `#u` で始まるサフィックスを使えない)。
- **`gameId`**: ファイル名(拡張子なし、`kebab-case`)と一致させる。例: `angry-moku-battle-royal`。Dreamloのリーダーボード名にもこれを使う。
- **新規タイトルがランキングを実装する場合**: そのタイトル専用のDreamloリーダーボードを作成し、`dreamlo-proxy`の`GAME_KEYS`環境変数にそのタイトルの`gameId`とpublic/private keyを追加する(要AWSコンソール/デプロイ操作)。クライアント側は`shared/moku-scores.js`を`<script>`で読み込み、`MokuScores.configure({ proxyBaseUrl, gameId })`を呼ぶだけでよく、Dreamloのキーには一切触れない。

## 7. ハブ画面へのDashboard統合(2026-08-14〜)

`dashboard.html` は廃止し、統計テーブルはハブ(`index.html`)自体に `#statsTable` として埋め込み済み。各ゲーム名+主要スタッツ(Lv./スコア/コインなど)を1行ずつ、レスポンシブな2〜3列グリッドで表示する。ロジックは旧`dashboard.html`のものをそのまま移植(localStorageのみ参照、ネットワーク通信なし)。新規タイトルを追加する際は、この`GAMES`配列(index.html内のJSブロック)にも1エントリ追加すること。

**ゲーム一覧のリデザイン(2026-10-13〜、`hub.html`)**: 旧来の「全タイトル同サイズのカードグリッド(枠線+絵文字+説明文)」を廃止し、以下の構成に変更した。
- **Today's Pick**: 1日1本を大きなバナーで紹介(実際のゲーム画面スクリーンショット背景)。候補はプレイ画面が撮れているタイトルのみ(`FEATURED` 配列)。
- **Continue**: `moku:played:<card>` のタイムスタンプが新しい順に最大3本。未プレイなら非表示。
- **ジャンル棚**(`SHELVES` 配列): Action & Sports / Puzzle & Brain / Cozy & Create / Party & Arcade。各ゲームは「遊びの内容を想起させるモノ」のアイコン(`icons/games/<gameId>.svg`)をアクセントカラーの角丸タイルに載せて表示。Mokuのキャラ絵は並べない。
- **詳細シート**: タイルを押すと開く。スクリーンショット(`screenshots/<gameId>.jpg`)・説明文・ローカル進捗(`GAMES[].badge()` / `progress()`)・Playボタン。
- **NEW表示**は `CATALOG[].newUntil` の日付まで自動で出る(付けっぱなしにしない)。
- 表示用データは `hub.html` の `CATALOG`、進捗ロジックは従来どおり `GAMES`(同じ `card` キー)。新規タイトル追加時は両方+`SHELVES`+アイコンSVG+スクリーンショットを追加する。

**ハブ背景の写真化(完了、2026-08-14)**: 手描きSVGシルエットは廃止し、`backgrounds/<city>.jpg`(都市ごとに1枚、JPEG・軽量化済み)を実背景として採用。時間帯ごとの見た目は画像を差し替えず、CSSの `filter`(brightness/saturate/hue-rotate)+ `mix-blend-mode: multiply` の色調オーバーレイのみで作る。太陽/月の可動域はヘッダーバッジ付近の狭い帯(カード・時刻表示と重ならない範囲)に収めてある。新しい都市を追加する場合は `backgrounds/<key>.jpg` を追加し、`hub.html`/`index.html` 両方の `PLACES` 配列にエントリを足すだけでよい。

**背景ローテーションの粒度(2026-08-15更新)**: 当初は「訪問者のローカル曜日」だけで都市を1つに固定していたため、同じ曜日にアクセスすると丸1日同じ都市(例: 土曜だけ常にOtherworld)しか見えないという報告があった。これを修正し、`slot = dayOfWeek * 4 + bandOrder(morning=0/day=1/evening=2/night=3)`、`place = PLACES[slot % 7]` という式で、時間帯(1日4回)が変わるたびに都市も切り替わるようにした。7都市 × 4時間帯 = 28通りのスロットが1週間でちょうど1周し、各都市は週4回、毎回違う時間帯の光で登場する。

## 8. ブランド素材とタイトル画面ヒーローマスコット(2026-08-14〜)

- **`brand/` ディレクトリ**: シリーズ共通のマスターイラスト置き場。アプリアイコン書き出し用の `icons/` とは別。
  - `brand/mokumoku-hero.png` — モクモクの高精細マスターイラスト(透過PNG、正方形、キャラがフレームの大部分を占める構図)。
  - `brand/moku-series-wordmark.png` — 「MOKU SERIES」ロゴタイプ素材(未採用。現状ハブは2段組みCSSテキストのロゴ実装を使用 — 下記参照)。
- **ハブのマスコットバッジ**: `index.html` ヘッダーは `brand/mokumoku-hero.png` を円形クロップし、レインボーリング(`conic-gradient`)をCSSで再構築して表示する(`.owl-badge` / `.owl-inner`)。素材自体にはリングを焼き込まない。
- **ハブのロゴタイプ**: 画像化はせず、CSSで「MOKU」(白・太字)を上段、「SERIES」(レインボーグラデーションの `background-clip: text`)を下段に2行組み。
- **各ゲームのタイトル画面ヒーローマスコット**: モクモク(フクロウ)がタイトル画面の主役として登場するタイトル(Angry Mokumoku / MK Mobile / Angry Moku Battle Royal / Shiri of Moku / Mokuball)は、タイトル画面だけ `brand/mokumoku-hero.png` を使ったHTML `<img>` に統一済み。**ゲームプレイ中に描画される `drawMokumoku()`(スリングで飛ばす鳥、選手アバター、チャット中の反応する顔など)は対象外・変更しない** — あくまで各タイトルのタイトル画面という「静止した1カット」だけを高精細イラストに差し替える。
  - Moyomoyo はモクモクではなく独自キャラ(グミ)が主役のため、この置き換え対象外。
  - 実装パターン: `<img>` にタイトル画面用のCSS(`width`/`object-fit: cover`/`object-position: center 30%`/浮遊アニメーション/ゲームごとのアクセントカラーで `drop-shadow` グロー)を当て、`#title-frame`・`#hub-link`・`#buildInfo` と同じタイミング(タイトル画面のみ)で表示・非表示を切り替える。
  - canvas内部座標を基準に配置する場合、`#wrapper` がcanvasぴったりのサイズでない実装(flexで中央寄せしているだけ等)では、canvasだけを包む専用コンテナ(例: `#canvasBox { position:relative; display:inline-block; line-height:0; }`)を追加してから、その中に `%` 指定で `<img>` を重ねること(MK Mobileがこのパターン)。
- **タイトル画面の英語化(2026-08-14〜)**: ハブに合わせて、各ゲームの**タイトル画面のみ**を英語表記に統一した(`#hub-link` のラベル `🦉 Moku Series ▶` 含む)。2026-10-24 以降はゲーム本編も英語に統一する方針になった(§3)。

## 9. MAINページとハブのローカル集計XP(2026-08-14〜)

- **`main.html`(新規)**: シリーズの入口となるシンプルなスプラッシュページ。マスコットバッジ・2段ロゴ・タグライン・「▶ Get Started」ボタン(`index.html`へ遷移)のみのミニマル構成。背景はハブと同じ写真+時間帯グラデーションシステムをそのまま複製している(`PLACES`/`BANDS`/`updateSky()`ロジック共通)。「What's Moku Series?」の説明トグルボタンを備える。設定歯車は非活性のプレースホルダー。ログイン導線は 2026-10-24 に §10 で実装した(API未設定の環境では従来どおり `Log In (Coming Soon)` のまま)。
- **ハブのグリーティング + Lv/XPバー**: `index.html` ヘッダーに「Hello, Moku! What will you play today?」の挨拶文と、Lv./XPバー(`#xpBar`)を追加した。**サーバーもログインも一切使わず、`#statsTable`と同じ`GAMES`配列から算出する完全ローカル集計値**。
  - 各ゲームエントリに `progress()` 関数を追加(0〜1を返す、未プレイなら0)。ゲームごとの指標例: Angry Mokumoku = クリアLv/30、Shiri of Moku = 解放ステージ/20、Mokuball = 解放ステージ/5、Moyomoyo = ベストスコアとQuestベストをそれぞれ3000点で正規化し50%ずつ合算、MK Mobile・Battle Royalはポイント/レベルを適当な上限値で正規化。
  - `XP_PER_GAME = 400`、`XP_PER_LEVEL = 200`。全ゲームの `progress() * 400` を合算して総XPを算出し、`Lv = floor(総XP / 200) + 1`。全ゲーム未プレイ(総XP = 0)の場合はXPバー自体を非表示にする(`#xpBar.has-xp`)。
  - 新規タイトル追加時は `progress()` も忘れずに追加すること(`#statsTable`の`read()`とセットで管理)。

## 10. アカウント / クラウドセーブ(2026-10-24〜)

ログインは**任意**。ゲストのままでも従来どおり全機能で遊べる(§1「外部通信なしでも起動できる」は維持)。

- **想定規模**: 最大100アカウント(`MaxUsers`)。iPhone / iPad / Android / PC など複数端末から同じアカウントで遊ぶ。
- **ログイン方式**: プレイヤーID(英数字 `-` `_` 3〜16文字、大文字小文字は区別しない)+ PIN(数字4〜6桁)。メールアドレス不要(主な利用者は小学生)。
  - 新規登録には**招待コード**が必要(`InviteCode`。保護者が配る)。上限人数に達すると登録不可。
  - PINを5回連続で間違えるとそのIDを15分ロック(以降5回ごとに30分→60分…最大24時間)。API全体にもレート制限あり。PIN忘れ・ロック解除は保護者が `backend/scripts/accounts.js` で行う。
  - 表示名(ランキング用、12文字まで)はIDとは別。IDはランキング等に**公開しない**(ログイン情報の半分のため)。公開用には `#u` + 5桁のタグを使う。
- **バックエンド**: `backend/`(AWS SAM)。`/auth/*` と `/save` を既存の HTTP API に追加。DynamoDB `moku-accounts` テーブル。仕様は [`backend/API_SPEC.md`](backend/API_SPEC.md) の「Accounts」。
- **クライアント**: [`shared/moku-account.js`](shared/moku-account.js)。
  - ハブ(`index.html` / `hub.html`): `<script src="shared/moku-account.js"></script>` + `[data-moku-account]`(ログインボタン/アカウントチップの差し込み先)+ `[data-moku-greeting]`(「Hello, <名前>!」に置き換え)。ページ表示時に同期する。
    - `hub.html` は下部ナビの **Profile** タブがログイン/アカウントボタン(`data-moku-account="nav"`。中の `[data-moku-account-icon]` と `[data-moku-account-label]` をスクリプトが書き換える。未ログインは 👤 Log In、ログイン中は頭文字アイコン+同期状態の点+表示名)。API未設定の環境では従来どおり非活性の「Coming soon」。`index.html` は Get Started の下に幅広のカード型ボタン(`data-moku-account="wide"`。未ログインは ☁️ Log In+説明文+光が流れるアニメーション、`data-moku-new-until` の日付まで NEW バッジ。ログイン中は頭文字アイコン+表示名+保存状態)。
  - ゲーム: `<script src="shared/moku-account.js" data-mode="background"></script>` を `</head>` 直前に1行足すだけ。UIは出さず、ページを閉じる/隠す時に進捗をアップロードする。未導入のゲームの進捗も次にハブを開いた時に同期される。
  - APIのURLは `moku-account.js` 冒頭の `API_BASE_URL`(2026-10-24 デプロイ済み: `https://d6hl1cxi0i.execute-api.ap-southeast-5.amazonaws.com`、呼べるのは `https://aohaus.github.io` からのみ)。`npm run dev`(localhost:3000)では常に `server.js` のモック(招待コード `moku-dev`、メモリ保存)を使う。`API_BASE_URL` が空ならログインUIを出さない。
- **同期対象**: `localStorage` のうち `moku:` `moku_` `moyomoyo-` `amoku-` で始まるキー全部(`moku:deviceId` `moku:account:*` `moku:sync:*` は除く)。**新規タイトルはこのどれかの接頭辞のキーを使うこと**(§2の `moku:<gameId>:<key>` 規約に従えば自動で対象になる)。
- **同期ルール**: クラウドセーブは全キーのスナップショット+リビジョン番号(上限300KB)。端末側だけ変化→アップロード、クラウド側だけ変化→ダウンロードしてページ再読み込み、両方変化(またはゲスト進捗がある端末で初ログイン)→「クラウド / この端末」のどちらを残すかプレイヤーに選ばせる。
- **ログアウト**: クラウドへ保存してから、その端末のMoku進捗を消す(兄弟で1台のiPadを共有する想定)。オフラインで保存できない時は「進捗を端末に残したままログアウト」を選べる。
- **プロフィール画面**(ログイン中にハブの Profile タブ / 最初の画面のカードから開く、2026-10-24〜):
  - **My Saves**: ゲームごとに1行(アイコン・名前・一言サマリー・最後に保存された時刻)。新しい順。サマリーは `hub.html` の `GAMES[].badge()`。`hub.html` が `window.MOKU_SAVE_SUMMARY(savedAt)` で一覧を渡す(`index.html` には `GAMES` がないので「See my saves」で `hub.html#profile` に飛ばす)。ゲームとキーの対応は `moku:<gameId>:…` と `moku:completed:<card>`、古い形式のキーは `hub.html` の `LEGACY_SAVE_PREFIXES`。**新規タイトルは `GAMES` に `badge()` を書けば一覧に出る。**
  - **保存時刻**: 同期のたびに、前回の同期から値が変わったキーに現在時刻を記録する(`moku:meta:saved-at` = キー→時刻のJSON)。このキーもクラウドセーブ・引き継ぎコードに含まれるので、どの端末でも同じ時刻が見える。端末とクラウドが同じかどうかの比較では、この記録は無視してゲームのデータだけを比べる。初回ログインの端末では、既存のセーブはすべてその時刻になる。
  - **Players**: アカウントを持つ全員(最大100人)の表示名・`#u` タグ・最終アクセス時刻。5分以内にアクセスがあれば「● Online」。ログイン中の人だけが見られる(`GET /players`)。Player ID は出さない。開いているページが2分おきに `GET /auth/me` を呼んで「まだいる」ことを伝える(サーバーは1分に1回まで記録)。

## 11. 引き継ぎコード(2026-10-24〜)

サーバーもアカウントも使わずに、進捗を別の端末へ移す仕組み。§10 のログインがまだ使えない環境でも、ログインしたくない人でも使える。

- **クライアント**: [`shared/moku-transfer.js`](shared/moku-transfer.js)。`<script src="shared/moku-transfer.js"></script>` を読み込み、ボタンに `data-moku-transfer` 属性を付けるだけで画面が開く。現在は `hub.html` の「⋯」メニューと `index.html` の Log In の下に置いている。
- **Send(送る側)**: §10 と同じ同期対象のキー(`moku:` `moku_` `moyomoyo-` `amoku-`、`moku:deviceId` `moku:account:*` `moku:sync:*` は除く)を1つのコードにまとめる。コピー / 共有シート(AirDrop・LINE 等)/ テキストファイル保存で渡す。
- **Receive(受け取る側)**: コードを貼り付けるかファイルを開くと、送った端末・作成日時・セーブ数を見せて確認したうえで、**その端末の進捗をコードの内容で置き換える**(マージはしない)。そのあとページを再読み込みする。
- **形式**: `MOKU1-` + base64url(zlib deflate(JSON))。`CompressionStream` がないブラウザでは非圧縮の `MOKU0-`。JSON は `{ v: 1, at, device, data }`。改行が混ざっても読める。途中で切れたコードは zlib のチェックサムで弾く。読み込み時は同期対象のキー・文字列値だけを受け付ける(ログイントークン等を書き込ませない)。
- **大きさの目安**: 6タイトル分ほどの進捗で約1,200文字。手入力は想定せず、コピー&ペーストか共有で渡す。
- **注意**: コードを持っている人は誰でも進捗をコピーできる(画面にも表示している)。同期対象のキーの定義は `moku-account.js` と同じで、変更する時は両方を直すこと。

## 12. 管理者と管理画面(2026-10-25〜)

保護者1名用の管理者アカウントと、管理画面 `admin.html`。**管理画面は保護者専用なので日本語UI**(§3の「英語」はプレイヤーに見える画面のルール)。

- **管理者アカウント**: プロフィールに `role: "admin"` を持つアカウント。**アプリの画面からは作れず**、CloudShell で `node scripts/accounts.js create-admin <ID> <PIN>` を実行して作る(もう一度実行するとPINの変更)。PINはリポジトリに書かない。
  - `MaxUsers`(100人)には数えない(`uncounted`)。Players 一覧にも出さない。
  - `admin` `administrator` `root` `moku` `mokumoku` `system` は予約IDで、子どもは新規登録に使えない。
  - 管理者もハブで普通にログインして遊べる。その場合プロフィールに「🛠 Admin」ボタンが出る。
- **管理画面へのログイン**: `admin.html` の専用フォーム(ID+PIN)。管理者以外のアカウントは入れない(サーバー側でも全 `/admin/*` で `role` を確認)。セッションは `sessionStorage`(タブを閉じると消える)で、ハブのプレイヤー用ログインとは別。
- **ユーザー管理**(`/admin/users`):
  - 一覧: 表示名・ID・タグ・オンライン・最終アクセス・登録日時・ロック状態・PIN失敗回数・クラウドセーブ(更新日時・端末・rev)。
  - 追加: 招待コードなしで ID・表示名・PIN を指定して作る(人数の上限は守る)。
  - 編集: ID(アカウントとセーブを新しいIDへ移す。その人の端末はログアウト)、表示名(その人の端末は次の確認で新しい名前のトークンに自動で切り替わる)、PIN(その人の端末はログアウト)、ロック解除。
  - 削除: アカウントとクラウドセーブ(元に戻せない)。自分の管理者アカウントは削除できない。
- **予定**: アクセスログ(ログイン・プレイ・設定変更)、エラーの収集と確認(最大3件、改修判断、Claude Code へ渡す情報の選択)。画面のタブは「準備中」として置いてある。

## 未決事項 / 次に決めること

- [ ] `shared/moku-ui.css`・`shared/moku-save.js` の実ファイルを作成するか
- [x] 各ゲーム画面への「ポータルへ戻る」ボタンのデザイン(上記4章で決定)
- [ ] 広告/課金など収益化まわりの共通化(引き続き対象外)。ランキングAPIは§6で仕様策定済み、実デプロイ・各ゲームへのクライアント実装は今後のセッションで対応
- [ ] 残り6タイトルのアクセントカラー割り当てルール
- [ ] ハブ背景を都市写真ベースに差し替え(§7参照、素材生成待ち)
- [ ] 各ゲームのスタート画面リデザイン(写真背景刷新の後続タスクとして想定)
- [ ] ゲーム内の日本語UIを英語化(§3、2026-10-24 時点): Moku Wolf(お題の単語が中心。英語化すると遊び方が変わるので要相談)、Shiri of Moku、Moyomoyo、MK Mobile、Angry Mokumoku、Mokuball
- [ ] Moku Future Run への子どもたちの要望(2026-10 AI Studio から引き継ぎ): ①危険な障害物を黒やハザードストライプでひと目で分かるようにする ②ジャンプするとベリーの列も一緒に動くバグ ③クリアはお祝い・失敗は残念な演出で差をはっきりさせる ④しゃがんでくぐる障害物を増やす

## 開発履歴について

2026-10-24 までは Google AI Studio と Claude Code で並行開発していた(詳細は CLAUDE.md「開発履歴について」)。

各ゲームファイルの開発履歴は `aohaus/Dev` から `git merge --allow-unrelated-histories -s ours` で本リポジトリに統合済み。
ワークツリーの内容は変わらないが、コミットログは残っている。ただし**通常の `git log -- <file>` は merge simplification により古い履歴が省略される**ため、
過去の開発経緯を追うときは必ず `--full-history` を付けること。

```sh
git log --full-history --oneline -- moyomoyo.html
```
