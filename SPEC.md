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
    - Moku Bridge: `#5ED6E8` / `#16596A`(グラスアクア。ガラスの橋の色)
    - Moku Chess: `#8FB3E8` / `#2C4A7A`(スレートブルー。夕暮れの空と盤の落ち着いた色)
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
- **Moint の印**: `CATALOG[].moint` があるゲームはタイルの左上に金色のMコイン、詳細シートに「Earn Moints」(§13)。

**ハブ背景の写真化(完了、2026-08-14)**: 手描きSVGシルエットは廃止し、`backgrounds/<city>.jpg`(都市ごとに1枚、JPEG・軽量化済み)を実背景として採用。時間帯ごとの見た目は画像を差し替えず、CSSの `filter`(brightness/saturate/hue-rotate)+ `mix-blend-mode: multiply` の色調オーバーレイのみで作る。太陽/月の可動域は狭い帯に収めてある(`hub.html` は上部バーの高さ(28〜40px)でプロフィールカードに重ならない、`index.html` は上部バーのすぐ下(画面の高さの6〜9%))。新しい都市を追加する場合は `backgrounds/<key>.jpg` を追加し、`hub.html`/`index.html` 両方の `PLACES` 配列にエントリを足すだけでよい。

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

**2026-10-25〜 ゲームとハブ(`hub.html`)はログインした人だけが遊べる**(それまではログイン任意だった)。

- **ゲート**: [`shared/moku-gate.js`](shared/moku-gate.js) をハブと全ゲームの `<head>` の先頭(`shared/moku-errors.js` の直後)で読み込む。保存済みのセッション(`moku:account:token` と `moku:account:user`、トークンの `exp` が未来)がなければ、描画前に `index.html?next=<そのページ>` へ `location.replace` する。`index.html` はログイン画面を開き、ログインして同期が終わると `next` のページへ戻す(`next` は `<英小文字・数字・->.html` だけ受け付ける)。開いている間にサーバーがトークンを拒否した(管理者がPINやIDを変えた)時や、別のタブでログアウトした時も `index.html` へ送る。
- **対象外**: `index.html`(入口・ログイン)と `admin.html`(管理者専用のログイン)。
- **判定は端末内だけ**(トークンの有効期限を見るだけ)なので、ログイン済みならオフラインでも遊べる(§1)。`moku-account.js` も期限切れのトークンはログアウト扱いにする(ゲートと `index.html` の判定を同じにして、行ったり来たりしないため)。
- **効く場所**: ページを配信しているすべてのアドレス(`aohaus.github.io`、Cloudflare 経由の `dechatgpt.com/Moku-ai/`、`npm run dev` の localhost:3000、今後増えるドメインも)。新しいドメインからゲートを素通りできないよう、許可リストではなく「開発用だけ除外」にしている。除外はファイルを直接ブラウザで開いた時と、localhost の 3000 番以外のポート(開発用)。
- **公開アドレス**: `https://aohaus.github.io/Moku-ai/`(GitHub Pages)と、それを Cloudflare でマスクした `https://dechatgpt.com/Moku-ai/`。API の CORS は両方を許可している(`backend/template.yaml` の `AllowedOrigin` / `ExtraAllowedOrigin`)。`localStorage` はアドレスごとに別なので、片方でログインしてももう片方では未ログイン。進捗はクラウドセーブで同じになる。
- **限界**: GitHub Pages は静的ホスティングなので、これはブラウザ側の入口のチェック。ふつうの訪問者は入れないが、ページのソースを読める人を完全には止められない。
- **新しいゲームを足す時は、`<head>` の `moku-errors.js` の直後に `<script src="shared/moku-gate.js"></script>` を入れること。**

- **想定規模**: 最大100アカウント(`MaxUsers`)。iPhone / iPad / Android / PC など複数端末から同じアカウントで遊ぶ。
- **ログイン方式**: プレイヤーID(英数字 `-` `_` 3〜16文字、大文字小文字は区別しない)+ PIN(数字4〜6桁)。メールアドレス不要(主な利用者は小学生)。
  - 新規登録には**招待コード**が必要(`InviteCode`。保護者が配る)。上限人数に達すると登録不可。
  - PINを5回連続で間違えるとそのIDを15分ロック(以降5回ごとに30分→60分…最大24時間)。API全体にもレート制限あり。PIN忘れ・ロック解除は保護者が `backend/scripts/accounts.js` で行う。
  - 表示名(ランキング用、12文字まで)はIDとは別。IDはランキング等に**公開しない**(ログイン情報の半分のため)。公開用には `#u` + 5桁のタグを使う。
- **バックエンド**: `backend/`(AWS SAM)。`/auth/*` と `/save` を既存の HTTP API に追加。DynamoDB `moku-accounts` テーブル。仕様は [`backend/API_SPEC.md`](backend/API_SPEC.md) の「Accounts」。
- **クライアント**: [`shared/moku-account.js`](shared/moku-account.js)。
  - ハブ(`index.html` / `hub.html`): `<script src="shared/moku-account.js"></script>` + `[data-moku-account]`(ログインボタン/アカウントチップの差し込み先)+ `[data-moku-greeting]`(「Hello, <名前>!」に置き換え)。ページ表示時に同期する。
    - `hub.html` は下部ナビの右端が **My Moku** タブ(着せ替えた Moku のアイコン。下の「My Moku 画面」を開く)。`index.html` はログイン前と後で画面を切り替える(2026-10-25〜。`<html>` の `is-in` クラス、`.guest-only` / `.member-only`)。ログイン前は Moku のバッジ+大きいロゴ+Get Started+幅広のカード型ボタン(`data-moku-account="wide"`。☁️ Log In+説明文+光が流れるアニメーション、`data-moku-new-until` の日付まで NEW バッジ)。ログイン後は Moku Closet で着せ替えた Moku(`MokuMoint.outfitSVG()`)+「Welcome back, <名前>!」+Moint 残高と保存状態(`MokuAccount.statusText()`)+▶ Play Games(ハブへ)+小さいロゴ、右上にアカウントチップ(`data-moku-account`)。Share / Transfer Progress / Add to Home Screen は右上の「⋯」メニュー。Total Played・Achievements はハブだけに置く。
  - ゲーム: `<script src="shared/moku-account.js" data-mode="background"></script>` を `</head>` 直前に1行足すだけ。UIは出さず、ページを閉じる/隠す時に進捗をアップロードする。未導入のゲームの進捗も次にハブを開いた時に同期される。
  - APIのURLは `moku-account.js` 冒頭の `API_BASE_URL`(2026-10-24 デプロイ済み: `https://d6hl1cxi0i.execute-api.ap-southeast-5.amazonaws.com`、呼べるのは `https://aohaus.github.io` と `https://dechatgpt.com` からのみ)。`npm run dev`(localhost:3000)では常に `server.js` のモック(招待コード `moku-dev`、メモリ保存)を使う。`API_BASE_URL` が空ならログインUIを出さない。
- **同期対象**: `localStorage` のうち `moku:` `moku_` `moyomoyo-` `amoku-` で始まるキー全部(`moku:deviceId` `moku:account:*` `moku:sync:*` は除く)。**新規タイトルはこのどれかの接頭辞のキーを使うこと**(§2の `moku:<gameId>:<key>` 規約に従えば自動で対象になる)。
- **同期ルール**: クラウドセーブは全キーのスナップショット+リビジョン番号(上限300KB)。端末側だけ変化→アップロード、クラウド側だけ変化→ダウンロードしてページ再読み込み。
  - **両方変化したらキーごとに自動でまとめる**(2026-10-25〜): 前回の同期で記録したキーごとのハッシュ(`moku:sync:state` の `keys`)を基準に、片側だけで変わったキーはその側を採用。Moint の財布(`moku:moint:wallet`)は「クラウドの残高 + この端末で前回の同期から増減した分」で足し合わせる(基準の残高は `moku:sync:state` の `wallet`)。`moku:stats:*` `moku:played:*` はこの端末のものを採用。まとめた結果をアップロードしてから端末に書き、ページを再読み込みする(書く前に失敗してもやり直せる。Moint を二重に数えない)。アップロードの前に `moku:sync:pending`(端末側の元の状態と、できあがるはずのセーブのハッシュ)を書いておき、サーバーには届いたのに返事が途中で切れた場合は、次の同期でそれを基準にする(同じ増減を二度足さない)。
  - **同じゲームのセーブが両方で変わった時だけ**「クラウド / この端末」を選ばせる。その時の画面は対象のゲーム名を出し(例「You played Moku Bridge here and on another device」)、選んだ側はそのゲームのキー全部にまとめて使う(Moku Kart のコイン・持っているカート・選んだカートのように、1つのゲームが複数のキーに分けて保存しているため。混ぜると「クラウドのコイン+この端末で買ったカート」のような矛盾が起きる)。ほかはまとめたまま。
  - 前回の同期の記録がない端末(ゲスト進捗がある端末で初ログイン)は従来どおり全体で「クラウド / この端末」を選ばせる。
  - 経緯: 同じアカウントで2台(またはハブを開いただけでも `moku:stats:streak` などが変わる)を使うと、以前は毎回「どちらを残す?」になり、Cloud を選ぶとその端末でクリアした記録や Moint が消えていた。
- **ログアウト**: クラウドへ保存してから、その端末のMoku進捗を消す(兄弟で1台のiPadを共有する想定)。オフラインで保存できない時は「進捗を端末に残したままログアウト」を選べる。
- **My Moku 画面**(2026-10-25〜。旧「プロフィール」モーダルとハブ上部のカード類を1つにまとめた、プレイヤー自身のページ):
  - **開き方**: `hub.html#me`。ハブ上部の帯(着せ替えた Moku・「My Moku ›」ボタン)/下部ナビの My Moku タブ / `index.html` のアカウントチップ(`hub.html#me` へ移動)。古いリンク `hub.html#profile` も開く。✕ Close(またはブラウザの戻る・Esc)でハブに戻る。ゲスト(ゲートのない開発環境など)でも開ける。
  - **ハブ上部の帯**(`.me-strip`): 着せ替えた Moku+「Hello, <名前>!」+Lv/XP+Completed+Moint 残高・Daily・Closet+My Moku ボタン。旧プロフィールカードと「My Moints」カードを1枚にした。
  - **レイアウト**: 幅 820px 以上(横向き iPad・PC)は2列(左 330px 固定・スクロールしても残る/右は記録)。それ未満は1列。最大幅 1000px。
    - 左: 着せ替えた Moku(押すと Moku Closet)・表示名+`#u` タグ・Lv/XP/Completed・Moint 残高と Daily。その下にクラウド保存の状態+Save now / Change PIN / Log Out(/ 🛠 Admin)+Player ID(ゲストは ☁️ Log In)。
    - 右: My Bests → Badge Showcase(ハブのトップから移した)→ My Games(幅が足りれば2列)→ Players。
  - **分担**: 画面の骨組みと My Bests / Badge / My Games は `hub.html`。`shared/moku-account.js` が `[data-moku-name]` `[data-moku-tag]` `[data-moku-profile="account"]` `[data-moku-profile="players"]` を、`shared/moku-moint.js` が `[data-moku-doll]` `[data-moku-moint-bar]` を埋める。`hub.html` は `window.MOKU_PROFILE_PAGE = { open, isOpen }` を置き、アカウントのボタンはこれを開く(ない画面ではログイン中は `hub.html#me` へ、ゲストはログイン画面)。Change PIN / Log Out の確認は従来どおりモーダル。
  - **My Games**: ゲームごとに1行(アイコン・名前・一言サマリー・最後に保存された時刻)。新しい順。押すとそのゲームの詳細シート。サマリーは `hub.html` の `GAMES[].badge()`、一覧は `saveSummary(savedAt)`。時刻は下の保存時刻、なければハブから始めた時刻(`moku:played:<card>`)。ゲームとキーの対応は `moku:<gameId>:…` と `moku:completed:<card>`、古い形式のキーは `hub.html` の `LEGACY_SAVE_PREFIXES`。**新規タイトルは `GAMES` に `badge()` を書けば一覧に出る。**
  - **保存時刻**: 同期のたびに、前回の同期から値が変わったキーに現在時刻を記録する(`moku:meta:saved-at` = キー→時刻のJSON)。このキーもクラウドセーブ・引き継ぎコードに含まれるので、どの端末でも同じ時刻が見える。端末とクラウドが同じかどうかの比較では、この記録は無視してゲームのデータだけを比べる。初回ログインの端末では、既存のセーブはすべてその時刻になる。
  - **Players → The Hollow**(2026-10-26〜): My Moku 画面の一番下にあった Players の一覧は、下の Hollow 画面に移した(My Moku には「🌳 The Hollow」へのボタン)。
- **The Hollow**(`hub.html#hollow`、2026-10-26〜。下部ナビの左から3番目「🌳 Hollow」。旧「Ranking」の場所): みんなの Moku が1本の大きな木に集まる画面。
  - **表示**(2026-10-26 に「木の穴に1羽ずつ」から「1つの部屋にみんな」へ変更): 木の中の大きな部屋に最大5羽が一緒にいる。部屋は「鳥たちが森で拾い集めて組んだ隠れ家」: 壁は色も大きさもふぞろいな端材の板・樹皮・丸太の切り口・小枝を継ぎはぎ(釘あり)、床は土と落ち葉と小石、端に苔。少し暗いけれど温かい明かり(上の葉の隙間から差す木漏れ日の光の筋・ホタル・琥珀色に光るキノコ・まわりのビネット)。真ん中にわらで編んだ敷物。額縁は小枝の枠、名札は傾いた端材の板。壁と床の絵は `buildHollowScene()` が固定の乱数(同じ見た目が毎回出る)で SVG を組み立てる。幅 620px 以上は床に1列、スマホは手前3羽・奥2羽(少し小さく)。それぞれの Moku はその人が Closet で選んだ服・表情で、**Background はその人の真上の壁に掛けた額縁の絵**(なければ空の額)。Moku の下の木の名札に表示名・`#u` タグ・「● Online」/ 最終アクセス(「5 h ago」など)。自分には YOU。見出しに人数とオンライン人数。
  - **動き**: ふだんは少し浮遊。ときどき(4〜12秒おきにランダム)左右へゆっくり(約22px/秒)よちよち歩いて、また止まる。歩く幅は自分の場所の中(最大 90px。となりと少しすれ違うくらい)。吹き出しを開いている Moku・ページが隠れている時は歩かない。iPhone の「視差効果を減らす」設定の時も、浮遊とよちよちの揺れは止めるが、ゆっくり横に動くのは続ける(2026-10-26、iPhone で歩いていないように見えたため)。
  - **6人以上**: 「Choose Mokus (n)」で選ぶ画面(全員の一覧・チェックで最大5人・「Most Recent」で最近の順に戻す)。選んだ人は `moku:hollow:picks`(`#u` タグの配列、クラウドセーブではこの端末の値を使う)。選んでいなければ自分+最近アクセスした順。
  - **Moku を押す(マウスなら乗せる)と** 吹き出しで、その人の Lv と主な記録(最大4件。My Bests → バッジの数 → 最近遊んだゲームの一言サマリー)と更新時刻。記録がまだない人は「No highlights yet…」。
  - **データ**: ほかの人は `GET /players`(`MokuAccount.loadPlayers()` / `getPlayers()`、取れたら window に `moku:players` イベント)。各プレイヤーの公開カード `card = { level, outfit, highlights, updatedAt }` は、その人のハブがクラウドへ保存するたびに `window.MOKU_PUBLIC_CARD()` で作って `PUT /save` に添える(`backend/API_SPEC.md`)。サーバーは短い文字列とIDだけ残す。セーブの中身はほかの人に見せない。カードはその人が次にハブで保存した時から出る(それまでは素の Moku と「No highlights yet」)。自分の Moku はこの端末から直接描く。
  - Player ID は出さない。オンラインの判定は従来どおり(5分以内のアクセス。開いているページが2分おきに `GET /auth/me`)。ログインしていない時は自分だけ+「Log in to see your friends' Mokus here.」。
  - ✕ Close・戻る・Esc で前の画面へ(ハブ、または My Moku から来たら My Moku)。
- **Hollow のオントロジー拡張 `hollow.html`**(2026-10-30〜、初期版。ハブの Hollow の「✨ Hidden Links」から開く): 部屋・Moku・吹き出し・Choose Mokus はハブの `#hollow` と同じ(CSS と `buildHollowScene()` / `hollowLayout()` はハブからコピー。**片方を直したらもう片方も**)。その上に次を足した。
  - **意味ネットワーク** [`shared/moku-ontology.js`](shared/moku-ontology.js)(`MokuOntology`、UMD。ブラウザでも Lambda でも同じ結果。テストは `backend/test/sharedModules.test.js`): 3層の小さなグラフ。もの(ゲーム `GAMES` と Closet の服 `ITEM_RULES`)→ 特徴(`TRAITS` 22個。Strategy / Patience / Sweets …)→ 6つの鳥の家族(`SPIRITS`: Brave Hearts / Quiet Thinkers / Forest Friends / Treasure Hunters / Party Birds / Cozy Cooks)。特徴どうしの「相性がいい」辺(`RELATED`。Strategy〜Puzzles など)もある。入力は**サーバーが今も配っている公開カードだけ**(`records` のゲーム・`highlights` のゲーム・`outfit`・`level`)なので、バックエンドの変更はない。自分だけはこの端末から、遊んだゲーム(`moku:played:*`・`moku:<gameId>:*`)・Moint 残高・Closet の数も足す。服の値段の合計が高い = Style、Moint を貯めている = Collecting(Moint の使い方)。
  - **世界観の自動醸成**: `ambience()` が部屋にいる Moku(自分は2倍)から、光の色・木の色味・苔の量・ホタルの数・飾り(`DECOR`。チェスのナイト・釣りざお・クッキーの皿・楽譜など17種、`hollow.html` の `DECOR_ART` が SVG で描く)を決める。部屋は記憶を持つ(`moku:hollow:world`、1日1回 `remember()`。前日までを8割残して今日を2割足す)。訪れた日が増えるほど過去が強く残り、飾りの数が増える(最初2個、3日ごとに1個、最大5個)。記憶は友達のカードが届いてから付ける(読み込み途中の自分だけの部屋を覚えない)。新しく増えた飾りに NEW(`moku:hollow:decor-seen`)。`moku:hollow:` は同期で両方変わってもこの端末の値を使う(§10)。
  - **意外な共通点**: `compare()` が「同じ特徴を違うもの(Chess と Fishing、ゲームと帽子)から持っている」ほど高く評価し、一番の発見を英語の一言にする(例「Who knew? You (Moku Drop) and Aoi (Moku Fishing Pond) are both Patient Souls.」)。同じ入力なら同じ文(乱数を使わない)。Moku を押した吹き出しに「You & ○○」と似ている度合い(%)、画面下の **Hollow Notes**(部屋の日記)に今日の部屋の雰囲気・育ち具合・自分の一言・友達ごとの Hidden Links を出す。Moku はときどき好きな物の絵文字(♟️ 🍪 🎵 …)を頭の上に浮かべる。
  - 次の候補: ハブの `#hollow` と1つにまとめる / 同じ計算を Lambda で行い「似ている人」をおすすめする API(`moku-ontology.js` はそのまま `require` できる)/ マッチ・チャレンジの対戦履歴を辺に足す。
- **Achievements**(`hub.html#awards`、2026-10-26〜。下部ナビの左から2番目「🏆 Achievements」。それまでは Coming soon で押せなかった): ゲームごとに「難関の記録」を1つ決め、全プレイヤーの Top 3 を出す画面。
  - **記録**(大きいほど上。`hub.html` の `RECORDS`、`GAMES` と同じ card キー): Angry Mokumoku / Moku Drop / Moku Bento / Moku Rhythm Cafe / Moku Future Run = High Score、Moyomoyo = Marathon High Score、MK Mobile = Strongest Player(持っている選手の Sp+Sh+Def の最大)、Battle Royal = Battle Level、Shiri of Moku = Stages Cleared、Moku City = City Level、Moku-rane = Prizes Won、Moku Fishing Pond = Fish Caught、Moku Kart = Grand Prix Trophies、Flying Moku = Acorns Found、Moku Wolf = Rounds Played、Moku Fight = Wins、Moku Watch 6 Lazy = Laziest Watch、Moku Bridge = Luckiest Steps、Moku Chess = Strongest CPU Beaten(勝ったCPUの最高レベル)。新しいタイトルは `RECORDS` に1つ足す。
  - **表示**: ゲームごとのカード(アイコン・名前・記録の名前)に 🥇🥈🥉 の3人(着せ替えた Moku の顔・表示名・`#u` タグ・記録)。同じ記録は同じ順位。自分が4位以下なら「⋮」の下に自分の行と「Beat ○○ to move up!」。1位なら「You are No. 1! 👑」。記録がまだないゲームは1行(「No records yet. Be the first!」)で、記録のあるゲームを上に並べる。「All Games / Games I Play」で、自分が記録を持っているゲームだけに絞れる。幅 700px 以上は2列。
  - **データ**: Hollow と同じ公開カードに `records = { gameId: 数 }` を足した(`window.MOKU_PUBLIC_CARD()`。サーバーは正の数だけ整数で残す。`backend/API_SPEC.md`)。ほかの人の記録はその人が次にハブで保存した時から出る。自分の記録はこの端末から直接読む。管理者アカウントは Players と同じく出ない。
  - ✕ Close・戻る・Esc でハブへ。

## 11. 引き継ぎコード(2026-10-24〜)

サーバーもアカウントも使わずに、進捗を別の端末へ移す仕組み。§10 のログインがまだ使えない環境でも、ログインしたくない人でも使える。

- **クライアント**: [`shared/moku-transfer.js`](shared/moku-transfer.js)。`<script src="shared/moku-transfer.js"></script>` を読み込み、ボタンに `data-moku-transfer` 属性を付けるだけで画面が開く。現在は `hub.html` と `index.html` の「⋯」メニューに置いている。
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
  - 管理者もハブで普通にログインして遊べる。その場合 My Moku 画面に「🛠 Admin」ボタンが出る。
- **管理画面へのログイン**: `admin.html` の専用フォーム(ID+PIN)。管理者以外のアカウントは入れない(サーバー側でも全 `/admin/*` で `role` を確認)。セッションは `sessionStorage`(タブを閉じると消える)で、ハブのプレイヤー用ログインとは別。
- **ユーザー管理**(`/admin/users`):
  - 一覧: 表示名・ID・タグ・オンライン・最終アクセス・登録日時・ロック状態・PIN失敗回数・クラウドセーブ(更新日時・端末・rev)。
  - 追加: 招待コードなしで ID・表示名・PIN を指定して作る(人数の上限は守る)。
  - 編集: ID(アカウントとセーブを新しいIDへ移す。その人の端末はログアウト)、表示名(その人の端末は次の確認で新しい名前のトークンに自動で切り替わる)、PIN(その人の端末はログアウト)、ロック解除。
  - 削除: アカウントとクラウドセーブ(元に戻せない)。自分の管理者アカウントは削除できない。
- **アクセスログ**(`/admin/logs`、2026-10-25〜): サーバーが自動で記録し、管理画面の「📜 アクセスログ」タブで見る。期間(今日/3日/7日/30日)・プレイヤー・種類で絞り込み、日ごとに新しい順。
  - ログイン: `login`(成功)・`register`(招待コードで新規登録)・`login_failed`(PINまちがい n回目/存在しないID/ロック中)・`locked`(5回まちがえてロック)。
  - プレイ: `play` = クラウドへのセーブで値が変わったキー(最大30個)。管理画面がキーをゲーム名に変換する(`admin.html` の `GAME_NAMES` / `CARD_GAMES` / `LEGACY_PREFIXES`。`hub.html` の `LEGACY_SAVE_PREFIXES` と同じ規則なので、変える時は両方)。`moku:meta:*` `moku:stats:*` だけの変化はプレイに数えない。ログインしていない(ゲストの)プレイは記録されない。
  - 設定変更: `pin_change`(本人)・`admin_create` / `admin_update`(変えた項目と変更前のID・表示名)/ `admin_delete`。
  - 各行に端末(iPad など。User-Agent から判定)。**PINは記録しない。**
  - 保存: DynamoDB の同じテーブルに日ごとのパーティション(`pk = LOG#<UTCの日付>`)。`ttl` 属性で90日後に自動削除。1日あたり最大500件まで取得。
- **エラーの確認**(`/errors` `/admin/errors`、2026-10-25〜):
  - **収集**: [`shared/moku-errors.js`](shared/moku-errors.js) を**全ページの `<head>` の先頭**(`<meta charset>` の直後、ほかのどのスクリプトよりも前)で読み込む。予期しないエラー・Promise の未処理エラー・`<script>` の読み込み失敗(three.js の CDN など)を `POST /errors` へ送る。1回のページ表示で最大5件、同じエラーは1回だけ。cross-origin の「Script error.」・ブラウザ拡張・ResizeObserver の警告は送らない。セーブデータやPINは送らない。ログイン中ならトークンを本文に入れ、誰が影響を受けたかだけ分かるようにする(本文は text/plain の JSON にして CORS のプリフライトを出さない)。`aohaus.github.io`・`dechatgpt.com`・`localhost:3000` 以外では何もしない。
  - **まとめ方**: ページ+エラー文+ファイル+行が同じなら1件(`pk = ERR`、`sk` = シグネチャ)。回数・影響した人(ID)・最初/最後の日時・最後の端末/User-Agent/ゲームのバージョン(`#buildInfo`)/スタックを保持。最後の発生から60日で `ttl` により自動削除。
  - **管理画面「🚨 エラー」タブ**: 重要な順(「直す」→未対応→様子見→無視、同じなら影響人数→回数→新しさ)に**上位3件**をカードで表示し、残りは「その他」。カードごとに **改修判断**(🛠 直す / 👀 様子見 / 🙈 無視。もう一度押すと未対応に戻る)・メモ・**Claude Code に渡す情報の選択**(エラー文・ページ・場所・スタック・回数と期間・端末・バージョン・影響した人のID・URL・メモをチェックで選び、プレビューを見てコピー)・削除(直したら消す。また起きれば新しく出る)。無視にしたエラーは、また起きても無視のまま。
  - **新しいページを足す時は、`<head>` の先頭に `<script src="shared/moku-errors.js"></script>` を入れること。**

## 13. Moint(シリーズ共通通貨、2026-10-25〜)

- 共通ヘルパー: [`shared/moku-moint.js`](shared/moku-moint.js)(`MokuMoint.balance()` / `add(n)` / `claimDaily()` / `closet()` / `buy(id)` / `equip(id)` / `outfitSVG(equipped)` / `layerImage(slot)`)。ハブは通常モード(Moint 残高・着せ替えた Moku のスロット+デイリーボーナス+Moku Closet のUI)、ゲームは `data-mode="none"`(APIだけ)で読み込む。
- **デイリーボーナス**(2026-10-25〜): 1日1回 100 Moint。ハブ(`hub.html`)を開くとポップアップで受け取れる(端末のローカル日付で判定)。記録は `moku:moint:daily` = `{ version: 1, last: 'YYYY-MM-DD', days, updatedAt }`。ログイン中はクラウド同期が終わってから出し、受け取ったらすぐアップロードする(同じ日に別の端末でもう一度もらえない・同期の衝突を起こさない)。ゲストは端末ごと。
- **Moku Closet**(2026-10-25〜): ハブ上部の帯の Closet ボタン / My Moku 画面の Moku から開く着せ替えショップ。タブは Hats(24)/ Moods(28)/ Face(16、メガネ・ほっぺのシール・アイパッチなど)/ Necklaces(15)/ Backgrounds(7)。スマホでは横にスクロールする。服・表情は4枠それぞれ1つずつ(2026-10-25 に服を 11 種類から 55 種類に増やした)。一覧が長いので、大きいプレビューが画面の外に出たら右上に小さいプレビューを出す。持っていない物はタップで試着(プレビュー)、Buy で購入してすぐ着る。服の値段は 100〜600 Moint。保存は `moku:moint:closet` = `{ version: 1, owned: [id], equipped: { head, mood, face, neck, bg }, updatedAt }`。
  - **Moods**(表情、2026-10-26〜): 28種類、150〜320 Moint。ふつう(Happy / Wink / Heart Eyes / Star Eyes / Sleepy / Surprised / Shy / Puppy Eyes / Laughing / Cool)150〜200、おもしろ系(Googly Eyes / Dizzy / Moint Eyes / Crying a River / Derp / Tongue Out / Snoring / Side-Eye / Sweat Drop / Pixel Eyes)200〜300、子どもたちのアイデア(Cake / Ice Cream / Chocolate / Candy / Rice Cracker / Cookie Eyes、Show-Off(カッコつけ)/ Meh(やる気なし))250〜320。いつもの怒り眉の顔は「Usual」(表情なし)で、いつでも戻せる。
    - 描き方: 元の目と眉を、顔の毛の色(`#F4E6D7`)のふちをぼかした楕円で隠してから新しい目を描く(`moodPatch()`)。重ねる順は 表情 → ネックレス → Face(メガネ)→ 帽子 なので、メガネと同時に付けられる。Closet の一覧では Moku の顔のアップで見せる。
    - 出る場所: 着せ替えた Moku が出る所すべて(ハブの帯・下部ナビ・My Moku・Closet・`index.html`・Moku Bridge のタイトル画面)。Moku Bridge のプレイ中は後ろ姿なので出ない。
  - **Backgrounds**(2026-10-25〜): My Moku 画面の左の Moku の後ろに敷く背景カード(Closet のプレビューにも出る)。各 300 Moint。Japan / Kuala Lumpur / Singapore / Vietnam / Indonesia / Thailand / Cambodia。シンプルな色数のポップアート調(平らな空+サンバースト+網点+太い輪郭線のランドマーク)。Moku が真ん中に立つので、ランドマークは上と左右に置く。絵は `moku-moint.js` の `BACKGROUNDS`(自分の 100×100 グリッド)。`[data-moku-doll data-moku-scene]` のスロットが背景つきで描く(ハブの帯・下部ナビ・ゲームのタイトル画面は背景なし)。
  - 服の絵は `brand/mokumoku-hero.png` にぴったり重なる 100×100 グリッドの SVG(頭のてっぺん ≈ y 8、目 ≈ (35, 41.5) / (65, 41.5)、葉の蝶ネクタイ ≈ y 44〜58)。どの大きさの Moku にも同じ絵を重ねられる。新しい服は `moku-moint.js` の `ITEMS` に足す。
  - Moku Bridge はタイトル画面のヒーロー画像に全部の服を、プレイ中の後ろ姿の Moku には帽子だけを描く。他のタイトルでも `MokuMoint.outfitSVG()` / `layerImage()` で同じ服を着せられる。
- 最初に導入したのは Moku Bridge。財布は `localStorage` の `moku:moint:wallet` = `{ version: 1, balance, updatedAt }`(ゲームIDを付けないシリーズ共通キー。`moku:` 接頭辞なのでクラウドセーブ・引き継ぎコードの対象)。
- 他のタイトルで Moint を配る・使う場合も同じキーを読み書きする。`balance` は 0 未満にしない。
- **他のゲームへの展開**(2026-10-25〜、1本ずつ): 相場は「1回遊ぶ(2〜3分)と 50〜150、毎日遊べば 300 Moint の物が1日1個買える」。
  - 配る時は `MokuMoint.earn(gameId, amount)`。毎回もらえる分(勝ち・クリアなど)は**1ゲーム1日 500 まで**(`DAILY_GAME_CAP`)。1回きりの実績は `{ capped: false }` で上限の外。今日の分は `moku:moint:earned` = `{ version: 1, day, games: { gameId: n }, updatedAt }`(クラウドセーブではこの端末の値を使う)。実績を受け取ったかどうかはそのゲーム自身のセーブに記録する(2台で食い違った時、ゲームごとに選ばせるため)。
  - **ハブの印**: `hub.html` の `CATALOG` に `moint: { how, cap }` を書いたゲームは、タイルの左上に小さい金色のMコインが付き、詳細シートに「Earn Moints」(もらい方の説明。`cap` があれば今日の分 n / 500)が出る。今は Moku Fight / Moku Bridge / Moku Drop / Moyomoyo / MK Mobile / Moku Chess。
  - 次の候補: Moku Kart(独自コインがあるので実績だけにするか要相談)など。
- **Moku Drop**(2026-10-26〜): ビンがいっぱいになった(JAR FULL)時の画面に内訳と今日の分 n / 500。途中で 🔄 でやり直した回は払わない。
  - 毎回(上限 500/日): スコア 100 点ごとに 1(1回で最大 150。コンボで点が大きく伸びるので Moyomoyo より割る数を大きくした)。自己ベスト更新 +30(ベストが 0 の初回は除く)。
  - 1回きり: その大きさの Moku を初めて作った Sakura 50 / Cosmic 100 / Emerald 150 / Ruby 250 / King Moku 500。受け取り済みは `moku:moku-drop:progress` の `mointClaims`(`tier6`〜`tier10`)。
- **Moyomoyo**(2026-10-26〜): 結果画面に内訳と今日の分。
  - 毎回(上限 500/日): マラソンはスコア 30 点ごとに 1(最大 150)+全面クリア 100+自己ベスト更新 30。モヨクエストはネズミを倒すごとに 20 / 30 / 40 / 50 / 80(倒した時点で払う。次へ進む画面に「+n Moints」)。
  - 1回きり: 初めて Lv.5 到達 100、初めての全面クリア 300、ネズミごとの初勝利 100 / 150 / 200 / 250 / 500。受け取り済みは `moku:moyomoyo:progress` の `mointClaims`(`lv5` `clear` `boss1`〜`boss5`)。
- **MK Mobile**(2026-10-26〜): MK Mobile 独自のポイント(選手の購入・強化用)はそのまま、Ready!(CPU戦)の結果画面で Moint も払う。
  - 毎回(上限 500/日): 勝ち = 試合の長さ(1分 25 / 3分 60 / 5分 90)× CPU(Easy ×1 / Normal ×1.3 / Hard ×1.6)。無失点の勝ち +10。引き分け 10。負けは 0。
  - 1回きり: CPU の難易度ごとの初勝利 100 / 200 / 300。受け取り済みは `moku:mk-mobile:profile` の `mointClaims`(`win0`〜`win2`)。
  - 3本とも Moint 導入前の記録にはさかのぼって払わない(Moku Fight と同じ。導入後にもう一度達成すれば1回きりの分ももらえる)。
- **Moku Chess**(2026-10-27〜): 結果画面に内訳(数え上がる)と今日の分 n / 500。タイトル画面に残高と今日の分。負け・投了は 0。
  - 毎回(上限 500/日): 勝ち = 20 + 10 × レベル(Lv.1 30 〜 Lv.10 120)。引き分け(ステイルメイト・3回同じ局面・50手・駒不足)= 5 + 3 × レベル。
  - 1回きり: ライバルごとの初勝利 Lv.1〜10 = 50 / 60 / 80 / 100 / 120 / 150 / 200 / 250 / 300 / 500。受け取り済みは `moku:moku-chess:progress` の `mointClaims`(`win1`〜`win10`)。
  - 使い道: タイトル画面の Board Shop で盤の着せ替え(Forest Oak は無料、Spring Meadow 200 / Cherry Blossom 250 / Sunset Sky 300 / Snowy Birch 350 / Candy Shop 450)。持っている盤と選んだ盤は同じ progress の `boards` / `board`。
  - CPU は10段階(Lv.1 Moyo / 2 Chef Rat / 3 Ponta / 4 Ninja Rat / 5 Kon / 6 Nox / 7 Goro / 8 Sage Kon / 9 King Nox / 10 Thunder King Goro。8〜10 は Moku Fight のキャラの「師範」版で、顔に王冠と後光)。最初は Lv.1〜3 が遊べ、Lv.n に勝つと Lv.n+1 が開く(`progress.best` = 勝った最高レベル)。Lv.1〜4 だけ 💡 Hint と ↩ Undo が使える(初心者の練習用。高いレベルの初勝利ボーナスを Undo で取れないように)。
  - 対局中の盤面は `moku:moku-chess:game`(初期局面からの手順 UCI の配列)に毎手保存し、タイトル画面の「Continue」で再開できる。終局で消す。
- **Moku Fight**(2026-10-25〜): 結果画面に内訳(コインが数え上がる)。タイトル画面に残高と今日の分。負けても減らない。
  - 毎回(上限 500/日): 勝ち Easy 30 / Normal 60 / Hard 120。ノーダメージで取ったラウンドがあれば +20。連勝ボーナスは2連勝目から1つごとに +10(最大 +50)。
  - 1回きり: ライバルごと・CPUの難易度ごとの初勝利 100 / 200 / 300(ゲストのライバルも)。Goro への初勝利は 500(その時の難易度の初勝利も済みにする)。新しい技を覚えた 50。技の練習を初めて終えた 10。
  - 受け取り済みは `moku:moku-fight:progress` の `mointClaims`(`"kon:normal": true` `boss` など)。Moint 導入前に覚えた技・勝った相手には払わない(さかのぼらないと決定。勝ち直せばライバルの初勝利はもらえる)。
  - 今回は貯めるだけ(Moku Fight の中で使う場所はない)。使い道は Moku Closet。
- Moku Bridge 内の買い物(Hint 15 / Magic Carpet 40)と所持数は `moku:moku-bridge:progress` の `items`。初回だけお試し用に 40 Moint 配る(`welcomeGift`)。
- Moku Bridge で橋を渡りきると最低 100 Moint(8段の橋 100 / 9段 110 / 10段 120)+ヒントなしで当てた段ごとに 10 + 1回目でクリアなら 50。このクリア報酬は全部「毎回もらえる分」で、1日 500 まで(2026-10-25〜。`MokuMoint.earn`。超えた分は結果画面に「You got all of today's bridge Moints!」)。落ちた時の −3 や Hint / Magic Carpet の買い物は上限と関係ない。
- Moku Bridge で落ちると 3 Moint 減る(残高が 3 未満ならあるだけ。0 未満にはしない)。
- **Challenge a Friend**(2026-10-30〜、v0.6.0。§14 の `/challenges`): タイトル画面のボタン(ログイン中だけ。自分の番のチャレンジがあれば赤い数字)→「Your challenges」と「Challenge a friend」(Players の一覧)。友達を選ぶと、サーバーが配ったシードから作る9段の新しい橋をすぐ渡る。友達も同じ橋を好きな時に渡り、**落ちた回数が少ない方の勝ち**(同じなら引き分け)。
  - チャレンジ中は Hint / Magic Carpet なし(ボタンも出さない)、お助けセールの成績にも数えない。落ちても Moint は減らない。何度落ちても続きから(ふだんの橋と同じく、分かったガラスは覚えている)。HUD は「VS <名前> · FALLS n」。ふだんの橋の進み具合(`bridge` など)は変えない。
  - 渡りきったら落ちた回数をサーバーへ送る。相手がまだなら「Waiting for …」。相手の結果は自分が送るまで見えない。オフラインで送れなかった時は、次に Challenges を開いた時に送る。
  - Moint: 渡りきった +20、勝ち +30(どちらも1チャレンジ1回、`MokuMoint.earn` の 1日 500 の中)。相手が後から渡って勝ちが決まった分は、次に Challenges を開いた時に払う。同じ友達への勝ちで Moint がもらえるのは1日2回まで(`chalWins`)。
  - 記録は `moku:moku-bridge:progress` の `challenges[id] = { steps, seed, name, tag, pattern, solved, broken, tries, falls, done, sent, forgetAt }` と `chalPaid['<id>:finish' | '<id>:win'] = 忘れてよい時刻`。`challenges` はチャレンジを作ってから29日(まだ渡っていない人のチャレンジがサーバーに残りうる最長28日より長く)、`chalPaid` は払ってから15日(サーバーが最後の変化から消す14日より長く)で消す。
- **お助けセール**(2026-10-25〜): その橋で「まだ分からないガラスを自分で選んだ回数」のうちハズレが7割以上(3回以上選んでから)になったら、次の挑戦から Hint / Magic Carpet を強調(光る枠+「50% OFF」タグ)して半額(Hint 8 / Carpet 20、切り上げ)で買えるようにする。一度始まったセールはその橋を渡りきるまで続く(次の挑戦で当てて割合が下がっても取り消さない。`bridgeStats.saleOn`)。半額は橋ごとに各1つまで(買い溜め防止)。分かっているガラス・ヒントを使った段は数えない。成績は `moku:moku-bridge:progress` の `bridgeStats = { guesses, misses, saleUsed: { hint, carpet } }` で、次の橋でリセット。落ちた時の結果画面と次の挑戦の最初のメッセージでも知らせる。
- Magic Carpet は3枚先のガラスへ飛ぶ。とばした2段は踏まないので正解は分からないまま(次の挑戦でも未知)。
- **Luckiest Steps**(2026-10-25〜): 1回の挑戦で、ヒントなしで続けて当てた段数の最高記録を `moku:moku-bridge:progress` の `bestLucky` に保存する。答えが分かっている段は数えず連続も切らない。ヒント・カーペット・ハズレで連続が切れる。
- **My Moku の My Bests**: `hub.html` の `profileBests()` が返す `{ title, game, value, hi, lo, icon }` の一覧を My Moku 画面の右列の先頭に出す。他のタイトルの自慢できる記録もここに足せる。

## 14. マルチプレイの共通基盤(2026-10-30〜)

マルチプレイ(まず Moku Chess のオンライン対戦)に向けて、ブラウザと Lambda(Node.js 20)の両方で同じコードを使う共通モジュールを先に用意した。どちらも UMD 形式(ブラウザは `window.<名前>`、Node は `require`)で、外部ライブラリなし。テストは `backend/test/sharedModules.test.js`(`cd backend && npm test`)。

- **`shared/moku-random.js`(`MokuRandom`)**: シード付きの乱数。同じシード(文字列か数)なら、どの端末でもサーバーでも同じ数が出る(「同じ橋・同じ玉の順番で勝負」用)。`create(seed)` → `next()`(0以上1未満、`Math.random()` の代わり)/ `int(min, max)`(両端を含む)/ `pick(list)` / `shuffle(list)`(コピーを返す)/ `chance(p)` / `fork(label)`(同じシードから別の流れ)。`newSeed()` は人に渡すための8文字のシード(紛らわしい 0/O・1/I/L を使わない)。中身は mulberry32+シード文字列の32ビットハッシュ。**数列を変えると古いページと新しいページで別の問題になる**ので、テストで最初の値を固定している。
- **`shared/moku-chess-rules.js`(`MokuChessRules`)**: チェスのルールだけ(0x88 盤・FEN・合法手・指す/戻す・チェック・終局判定)。`moku-chess.html` から切り出した。`create(fen?)` → `play(uci)`(合法なら指して手を返す、だめなら null で何も変えない)/ `moveFromUci` / `uciOf` / `legalMoves` / `make` / `unmake` / `fen` / `posKey` / `status(keys)`(`checkmate` `stalemate` `fifty` `material` `repetition` / null)。`replay(moves, fen?)` は手の列を最初から指して `{ ok, applied, fen, turn, keys, status }` を返す(サーバーで手の正しさと終局を決める用)。UCI は厳密(成る時は駒の文字が必要、成らない手に付けると無効)。標準の perft 局面で合法手の数を確認している。
  - `moku-chess.html` の CPU(探索・評価・10段階)は `MokuChessEngine(MokuChessRules.create)` としてこの上に載る。Web Worker には `create.toString()` を渡すので、**`create()` の中から外の変数を使わないこと**。
  - Lambda はデプロイ時に `backend/` しか入らないので、`backend/src/vendor/moku-chess-rules.js` にコピーを置いている。**`shared/` の方を直して `cp shared/moku-chess-rules.js backend/src/vendor/`**。違うと `npm test` が失敗する。
- **オンライン対戦の API**(`/matches`、2026-10-30〜。仕様は `backend/API_SPEC.md` の「Matches」): ログインした2人の対戦。最初は Moku Chess(持ち時間なしの手紙チェス型)。`POST /matches`(友達の `#u` タグで作る。相手の一覧にすぐ出る)/ `GET /matches`(自分の対局一覧と「自分の番」の数)/ `GET /matches/{id}?v=`(ポーリング。変化がなければ `changed:false` だけ)/ `POST /matches/{id}/move`(UCI+`version`)。
  - サーバーが毎手、最初からの手順をルールで指し直して合法手と終局を決める。`version` が読んだ時と同じ時だけ書く(二度押し・2台からの同時の手を弾き、今の対局を返す)。
  - DynamoDB は同じ `moku-accounts` テーブル: `MATCH#<id> / STATE`(対局)と `PLAYER#<uid> / MATCH#<id>`(2人それぞれの一覧の行)。プレイヤーは `uid` で持ち、返すのは表示名と `#u` タグだけ。最後の手から7日で消える(終わった対局は30日)。1人20局まで。
  - Lambda は `MatchFunction`(ログインの scrypt で遅くなる `AccountFunction` と分けた)。スロットリングはルートごとに `RouteSettings` で設定(ポーリングの `GET /matches/{id}` は 40/秒・瞬間80。既定の 10/秒 はルートごとの値)。
  - `POST /matches/{id}/resign`(投了。自分の番でなくてもよい。相手の勝ち)も足した。
- **同じ問題で勝負する API**(`/challenges`、2026-10-30〜。仕様は `backend/API_SPEC.md` の「Challenges」): 2人が同時にいなくても遊べる非同期の勝負。サーバーがシードと条件を配り、2人がそれぞれ遊んで結果を1回ずつ送り、そろったらサーバーが勝ち負けを決める。自分が送るまで相手の結果は見えない。最初は Moku Bridge(§13)。新しいゲームは `backend/src/challengeApi.js` の `GAMES` に `params` / `result` / `compare` を足す。Lambda は `MatchFunction` を共用、データは同じテーブルの `CHAL#<id>` と `PLAYER#<uid> / CHAL#<id>`、14日で消える。共通の処理(ログイン確認・相手探し)は `backend/src/playCommon.js`。
- **Moku Chess の「Play a Friend」**(2026-10-30〜、v0.2.0): タイトル画面のボタン(ログイン中だけ出る。自分の番の対局があれば赤い数字)→ 「Your games」(自分の番が先頭。相手の着せ替えた Moku・`#u` タグ・状態)と「Start a new game」(Players の一覧。先手後手はランダム)。
  - 対局画面は CPU 戦と同じ。上の段は友達(Moku の顔・「Friend」)。黒番の時は盤を逆さにする(マスを h1→a8 の順に作り直し、駒はマスの位置に付いてくる)。Hint / Undo はなし。Give Up はサーバーに投了を送る。Menu は「Your games」へ戻る(対局はサーバーに残っている)。
  - 指すとすぐ盤に反映して送る。サーバーが受け付けなかった時(先に別の手が入った等)は、返ってきた対局に合わせて盤を描き直す。オフラインの間は3秒おきに送り直す。
  - 相手の番の間は3秒おき(2分たったら10秒おき)、自分の番の間も15秒おき(相手の投了に気づくため)に `GET /matches/{id}?v=` を見る。ページが隠れている間は見ない。相手の手は CPU の手と同じアニメーションで動く。
  - Moint: 勝ち 40 / 引き分け 10(`MokuMoint.earn`、1日 500 の上限の中)。同じ友達への勝ちで Moint がもらえるのは1日2回まで(兄弟の2アカウントで稼げないように)。1局につき1回だけ(「Your games」から開き直しても二重にもらえない)。自分の手で終わった対局は、サーバーがその手を受け付けてから結果と Moint を出す(断られたら盤を戻し、何も払わない)。記録は `moku:moku-chess:progress` の `online = { day, wins: { tag: n }, paid: { matchId: 忘れてよい時刻 }, played, won }`。`paid` はサーバーが終わった対局を残す30日より長い31日で消す。CPU 戦の記録(`best` / `winsBy`)は変えない。

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
