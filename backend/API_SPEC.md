# Moku Series — Game Records API 仕様

Mokuシリーズ各タイトル共通の、軽量なゲーム記録集約API。
API Gateway (HTTP API) + Lambda + DynamoDB (`backend/template.yaml`)。

## 設計方針

- **ログインは任意**。ゲストはデバイスごとのUUID(`deviceId`)で識別する。ログイン中のプレイヤーは `POST /scores` に
  `Authorization: Bearer <token>` を付けると、記録が `deviceId = "user:<uid>"`・`playerName = 表示名` で保存される(端末をまたいで1レコード)。
- **常時通信しない**。SPEC.md §1 の「外部通信なしでも起動できることを基本とする」方針に従い、
  ゲーム側は以下のタイミングのみ通信する:
  - スコア確定時に `POST /scores` でベストスコアを送信(明示的な操作、またはプレイ終了時の自動送信のいずれでも可。ゲームごとに選択)
  - ランキング画面を開いた時のみ `GET /scores` を呼ぶ
- 通信できない/失敗しても、ローカルの `localStorage` 記録(SPEC.md §2)がプレイの正とする。API送信はあくまで「共有ランキングへの反映」であり、ゲーム進行に必須の依存にしない。
- **保持するのは自己ベストのみ**(`gameId` + `deviceId` ごとに1レコード)。より高いスコアが送られた時だけ更新する。

## deviceId の発行(クライアント側規約)

各ゲームは初回起動時に `localStorage` の `moku:deviceId` を確認し、無ければ `crypto.randomUUID()` で生成して保存する。
このキーは全ゲーム共通(ゲームIDのnamespaceを付けない)にし、同一デバイスであれば全タイトルで同じ`deviceId`を使う。

```js
function getMokuDeviceId() {
  const KEY = "moku:deviceId";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
```

## エンドポイント

Base URL はデプロイ後に `sam deploy` の出力(`ApiUrl`)で決まる。

### `POST /scores`

スコアを送信する。既存の自己ベストより高い場合のみ更新される。

**Request body**
```json
{
  "gameId": "angry-moku-battle-royal",
  "deviceId": "5f2c...-uuid",
  "score": 12345,
  "playerName": "Moku",
  "level": 5,
  "meta": { "mode": "battle-royal" }
}
```
- `gameId` (string, required) — `kebab-case`、SPEC.mdのファイル名(拡張子なし)と一致させる。
- `deviceId` (string, required) — 上記の共通デバイスID。
- `score` (number, required) — 0以上。
- `playerName` (string, optional, ≤24文字) — 省略可。ランキング表示用の任意ニックネーム。
- `level` (number, optional) — ゲームによって「到達レベル」等をスコアと併せて表示したい場合。
- `meta` (object, optional, JSON化して512バイト以内) — ゲーム固有の付加情報。ランキング一覧には含まれない(将来の詳細表示用)。

**Response 200**
```json
{ "updated": true, "record": { "gameId": "...", "deviceId": "...", "score": 12345, "...": "..." } }
```
更新されなかった場合(既存の方が高い/同じ):
```json
{ "updated": false, "reason": "existing score is higher or equal" }
```

**Response 400** — バリデーションエラー時 `{ "error": "message" }`

### `GET /scores?gameId=<gameId>&limit=<n>`

指定ゲームのランキング上位を取得する(降順、デフォルト50件、最大100件)。

**Response 200**
```json
{
  "gameId": "angry-moku-battle-royal",
  "ranking": [
    { "rank": 1, "deviceId": "...", "playerName": "Moku", "score": 99999, "level": 9, "updatedAt": "2026-08-14T00:00:00Z" }
  ]
}
```

### `GET /scores?gameId=<gameId>&deviceId=<deviceId>`

自分の記録のみを取得する(ランキング内の自分の順位計算は行わない — 必要になれば将来追加)。

**Response 200**
```json
{ "record": { "gameId": "...", "deviceId": "...", "score": 12345, "...": "..." } }
```
記録が無ければ `{ "record": null }`。

## 認証

`/scores` はゲストなら認証なし(上記の任意トークンのみ)。デバイスIDは自己申告のため、なりすまし・不正送信への耐性は持たない。
数百人規模のカジュアル用途と割り切り、将来的に問題が出た場合は API Gateway の
レート制限強化や reCAPTCHA 的な仕組みの追加を検討する(現時点ではスコープ外)。

## CORS

`template.yaml` の `AllowedOrigin` パラメータで許可オリジンを指定する
(GitHub Pages等の配布先URL)。開発中は `*` のままでよい。


---

# Accounts / Cloud Save(SPEC.md §10)

同じ HTTP API 上のエンドポイント。ハンドラは `src/accountApi.js`(1つの Lambda)。クライアントは `shared/moku-account.js`。

## データ

DynamoDB `moku-accounts`(`pk` + `sk`):

| pk | sk | 内容 |
| --- | --- | --- |
| `LOGIN#<loginId>` | `PROFILE` | `loginId` `uid`(公開用ランダムID) `displayName` `pinHash`(scrypt) `tv`(トークン世代) `failCount` `lockedUntil` `lastSeenAt`(最終アクセス、ミリ秒) `createdAt` |
| `LOGIN#<loginId>` | `SAVE` | `data`(localStorage キー→値 のJSON文字列、300KBまで) `rev` `updatedAt` `device` |
| `META` | `USERS` | `count` — 登録時にトランザクションで +1 し、`MaxUsers` を超えないようにする |

## トークン

`base64url(payload).base64url(HMAC-SHA256)`(ヘッダーなしの JWT HS256 相当、`src/token.js`)。
payload: `{ lid, uid, name, tv, iat, exp }`、有効期限90日。`Authorization: Bearer <token>` で送る。
`/auth/me` `/auth/pin` `/save` は DB の `tv` と照合するので、PIN変更・PINリセットで他端末のトークンは無効になる。
`dreamlo-proxy` は同じ `AUTH_SECRET` で署名と期限だけを検証する(DBは見ない)。

## エラー形式

`{ "error": "<code>", "message": "<子ども向けの英語メッセージ>" }`。主なコード:
`invalid_login_id` `invalid_pin` `weak_pin` `bad_invite` `registration_closed` `id_taken` `full` `bad_credentials`
`locked`(429、`retryAfterSec` 付き) `unauthorized`(401、再ログインが必要) `conflict`(409、`rev` 付き) `too_large`(413)。

## `POST /auth/register`

```json
{ "inviteCode": "…", "loginId": "aoi", "pin": "2580", "displayName": "Aoi" }
```
- `loginId`: `[a-z0-9_-]{3,16}`(大文字は小文字に正規化)。
- `pin`: 数字4〜6桁。同じ数字の繰り返し・連番(`1234` `9876` 等)は `weak_pin`。
- `displayName`: 12文字まで。`#` `*` `|` `/` `\` と制御文字は除去。省略時は `loginId`。

**201** `{ "token": "…", "user": { "loginId": "aoi", "displayName": "Aoi", "tag": "u6ffd2" } }`

## `POST /auth/login`

`{ "loginId": "aoi", "pin": "2580" }` → **200** register と同じ形。
IDが存在しない場合と PIN 違いは同じ応答(`401 bad_credentials`)・同じ処理時間。
5回連続で失敗するとロック(15分→30分→…最大24時間)、ロック中は正しいPINでも `429 locked`。

## `GET /auth/me`

**200** `{ "user": { … } }`

## `POST /auth/pin`

`{ "currentPin": "2580", "newPin": "4826" }` → **200** `{ "token": "<新トークン>", "user": { … } }`(他端末はログアウトされる)

## `GET /save`

**200** `{ "save": null }` または `{ "save": { "rev": 3, "updatedAt": "…", "device": "iPad", "data": { "moku:…": "…" } } }`

## `PUT /save`

```json
{ "data": { "moku:shiri-of-moku:progress": "{…}" }, "baseRev": 3, "device": "iPhone" }
```
- `data` の値はすべて文字列(localStorage の値そのまま)。
- `baseRev` はクライアントが最後に見た `rev`(初回は 0)。サーバー側の `rev` と一致した時だけ保存し `rev = baseRev + 1` にする。
  一致しなければ **409** `{ "error": "conflict", "rev": <現在のrev> }`(別端末が先に保存した)。
- `card`(任意、2026-10-26〜): Hollow(ハブの `#hollow`)でほかのプレイヤーに見せる公開カード。ハブだけが送り、ゲームのページは送らない(送らなければ前のカードのまま)。
  ```json
  { "level": 4, "outfit": { "head": "wizard-hat", "mood": "mood-cookie-eyes", "face": "round-glasses", "neck": "pearls", "bg": "bg-japan" },
    "highlights": [ { "icon": "🏆", "title": "Badges", "value": "4 / 5", "game": "" }, { "title": "🍀 Luckiest Steps", "value": "8 in a row", "game": "moku-bridge" } ],
    "records": { "moku-drop": 8200, "moku-bridge": 8 } }
  ```
  サーバーは短い値だけ残す: `outfit` は5つの枠の `[a-z0-9-]{1,40}` のIDだけ、`highlights` は最大4件(`icon` 8文字・`title` 32文字・`value` 40文字・`game` はID、`title` がないものは捨てる)、`records`(2026-10-26〜、ハブの Achievements の Top 3 用)はゲームID→数値で最大40件、正の数だけを整数に丸めて残す(上限 1e9)、`level` は1〜9999の整数。`updatedAt` はサーバーが付ける。セーブの中身そのものはほかの人に見せない。

**200** `{ "rev": 4, "updatedAt": "…" }`

## `GET /players`

ログイン中のプレイヤーだけが呼べる、全アカウントの一覧(新しくアクセスした順)。

**200**
```json
{
  "players": [
    { "displayName": "Aoi", "tag": "u6ffd2", "lastSeenAt": "2026-10-24T15:20:00.000Z", "online": true, "you": false,
      "card": { "level": 4, "outfit": { "head": "wizard-hat" }, "highlights": [ … ], "updatedAt": "…" } }
  ],
  "onlineWindowSec": 300
}
```
- `online`: `lastSeenAt` が5分以内。
- `card`: `PUT /save` で最後に送られた公開カード(まだなければ `null`)。
- Player ID(`loginId`)は含めない(ログイン情報の半分のため)。
- `lastSeenAt` は、認証付きのリクエスト(`/auth/me` `/save` `/players` など)とログイン・新規登録のたびに更新される。書き込みは1人1分に1回まで。

## `GET /players/kin`(2026-10-30〜)

ログイン中のプレイヤーだけが呼べる。The Hollow(`hollow.html`)の「Birds Like You」用。全員の公開カード(`GET /players` の `card`)を `shared/moku-ontology.js`(サーバーは `src/vendor/` のコピー)で自分のカードと比べ、似ている人と「意外な共通点」の人を返す。入力は公開カードだけなので、`GET /players` で見える以上のことは分からない。

**200**
```json
{
  "me": { "spirit": "thinker", "text": "One of the Quiet Thinkers 🦉 — loves Strategy and Patience." },
  "kin": [
    { "displayName": "Sora", "tag": "u1a2b3", "online": false, "score": 0.87, "sharedGames": ["moku-chess"],
      "link": { "type": "spirit", "emoji": "🦉", "text": "Two Quiet Thinkers 🦉 — …" } }
  ],
  "surprise": { "displayName": "Aoi", "tag": "u6ffd2", "online": true, "score": 0.36, "sharedGames": [],
    "link": { "type": "same", "emoji": "⏳", "text": "Who knew? You (Moku Chess) and Aoi (Moku Fishing Pond) are both Patient Souls." } }
}
```
- `kin`: 共通点が見つかった人を `score`(0〜1、似ている度合い)の高い順に最大3人。
- `surprise`: 同じゲームの記録を1つも持っていないのに共通点がある人の中で、一番意外な1人(なければ `null`)。`kin` とは重ならない。
- 自分のカードがまだない(ハブで保存したことがない)時は `kin: []`・`surprise: null`・`me.spirit: ""`。カードのない人・管理者は出ない。
- 文の中の自分は「You」、相手は表示名。服の名前はサーバーに `MokuMoint` がないので ID から作る(`mood-cookie-eyes` → `Cookie Eyes`)。

---

# Admin(SPEC.md §12)

`role: "admin"` のアカウントだけが呼べる。それ以外は `403 forbidden`、未ログインは `401`。
管理者アカウントは `scripts/accounts.js create-admin` でのみ作る。`GET /auth/me` の `user` に `admin: true` が付く。

## `GET /admin/users`

**200**
```json
{
  "users": [
    {
      "loginId": "aoi", "displayName": "Aoi", "tag": "u6ffd2", "admin": false,
      "createdAt": "…", "lastSeenAt": "…", "online": true,
      "failCount": 0, "lockedUntil": null,
      "save": { "rev": 3, "updatedAt": "…", "device": "iPad" }
    }
  ],
  "count": 12,
  "maxUsers": 100
}
```
`count` は管理者を除いた人数。PINのハッシュは返さない。

## `POST /admin/users`

`{ "loginId": "ren", "displayName": "Ren", "pin": "4826" }` → **201** `{ "user": { …上と同じ形… } }`
招待コード不要。ID・PINのルールと予約ID・人数の上限は新規登録と同じ。

## `PATCH /admin/users/{loginId}`

変える項目だけ送る: `{ "loginId": "aoi2", "displayName": "Aoi-chan", "pin": "3691", "unlock": true }` → **200** `{ "user": … }`
- `loginId`: アカウントとクラウドセーブを新しいIDへ移す(トランザクション)。トークン世代を上げるので本人の端末はログアウト。
- `pin`: 本人の端末はログアウト。ロックも解除される。
- `displayName`: 本人の端末は次の `GET /auth/me` で新しい `token` を受け取り、ログインしたまま名前が変わる(`/auth/me` はトークンの名前が古いと `token` を返す)。
- エラー: `404 not_found` `409 id_taken` `400 invalid_login_id` `invalid_pin` `weak_pin` `invalid_name`。

## `DELETE /admin/users/{loginId}`

**200** `{ "deleted": "aoi" }`。アカウントとクラウドセーブを削除。自分自身は `400 cannot_delete_self`。

## `GET /admin/logs?days=7&loginId=aoi`

アクセスログ(新しい順)。`days` は 1〜30(既定 7)、`loginId` は省略可(その人の行と、その人の旧IDの行)。

**200**
```json
{
  "days": 7,
  "logs": [
    { "at": "2026-10-25T02:07:00.000Z", "type": "play", "loginId": "aoi", "displayName": "Aoi",
      "device": "iPad", "detail": { "keys": ["moku:moku-fight:progress"], "rev": 3 } }
  ]
}
```

| `type` | いつ | `detail` |
| --- | --- | --- |
| `login` | ログイン成功 | — |
| `register` | 招待コードで新規登録 | — |
| `login_failed` | ログイン失敗 | `reason`: `wrong_pin`(+`failCount`) / `unknown_id` / `locked` |
| `locked` | 5回目のPINまちがいでロック | `failCount` |
| `play` | クラウドセーブで値が変わった | `keys`(最大30)・`rev` |
| `pin_change` | 本人がPINを変更 | — |
| `admin_create` / `admin_delete` | 管理者が追加 / 削除 | `by` |
| `admin_update` | 管理者が変更 | `by`・`changes`(`loginId` `displayName` `pin` `unlock`)・`from`(旧ID)・`fromName`(旧表示名) |

PINはどこにも記録しない。DynamoDB の `ttl` で90日後に自動削除。

---

# Error reports(SPEC.md §12)

## `POST /errors`(ログイン不要)

`shared/moku-errors.js` が送る。本文は JSON(`content-type: text/plain` で送ってよい)。

```json
{ "page": "moku-fight.html", "message": "TypeError: …", "source": "https://…/moku-fight.html", "line": 120, "col": 7,
  "stack": "…", "kind": "error", "version": "v0.7.1 · Updated Oct 24, 2026", "url": "…", "auth": "<ログイン中ならトークン>" }
```
- `kind`: `error` / `rejection` / `resource`(スクリプトの読み込み失敗)。`message` 必須(500文字まで)、`stack` は4000文字まで。
- ページ+エラー文+ファイル(クエリ除く)+行が同じなら同じエラーとして回数を足す。`auth` が有効なら、そのプレイヤーのIDを「影響した人」に足す。
- **200** `{ "ok": true }` / **400** `invalid_report`。

## `GET /admin/errors`

**200** `{ "errors": [ { "sig": "3f…(16桁)", "page", "message", "source", "line", "col", "stack", "kind", "count", "users": ["aoi"],
"firstAt", "lastAt", "lastDevice", "lastUserAgent", "lastVersion", "url", "status": "new", "note": "" } ] }`
並びは重要な順(`fix` → `new` → `watch` → `ignore`、同じなら影響人数・回数・新しさ)。

## `PATCH /admin/errors/{sig}`

`{ "status": "fix" | "watch" | "ignore" | "new", "note": "…" }` → **200**。`404 not_found` / `400 invalid_status`。

## `DELETE /admin/errors/{sig}`

**200** `{ "deleted": "<sig>" }`。同じエラーがまた起きれば `new` で作り直される。

# Matches(オンライン対戦、2026-10-30〜)

ログインした2人のオンライン対戦。最初は Moku Chess で、手紙チェスのように持ち時間はない(`src/matchApi.js`、Lambda は `MatchFunction`)。

- **サーバーが正**: `POST /matches/{id}/move` のたびに、サーバーが最初からの手順を `shared/moku-chess-rules.js`(Lambda には `src/vendor/` のコピー)で指し直し、合法手か・終局かを決める。
- **ポーリング**: 相手の番の間、ページは `GET /matches/{id}?v=<持っている version>` を3秒おきに呼ぶ。変化がなければ `{ "changed": false }` だけ返る。
- **見せるもの**: 表示名と `#u` タグだけ。Player ID・uid は返さない。対局はその2人だけが見られる(ほかの人には `404`)。
- **データ**: `pk MATCH#<id> / sk STATE`(対局。手の列・FEN・手番・`version`)と、2人それぞれの一覧用 `pk PLAYER#<uid> / sk MATCH#<id>`。指すたびに3つを1つのトランザクションで書く(`version` が読んだ時と同じ時だけ)。プレイヤーは変わらない `uid` で持つ(管理者が Player ID を変えても対局は残る)。
- **期限**: 最後の手から7日動きがなければ消える(DynamoDB の TTL)。終わった対局は30日。
- **上限**: 1人が同時に進められる対局は20まで。スロットリングは `template.yaml` の `RouteSettings`(`GET /matches/{id}` 40/秒・瞬間80、ほかは 5〜15/秒)。

全エンドポイントで `Authorization: Bearer <token>` が必要(なければ `401 unauthorized`)。

## 対局の形(`match`)

```json
{ "id": "6f44822846471414", "game": "moku-chess", "status": "active",
  "you": "w", "white": { "name": "Aoi", "tag": "u1a2b3" }, "black": { "name": "Ren", "tag": "u4c5d6" },
  "moves": ["e2e4"], "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "turn": "b", "yourTurn": false, "version": 1,
  "result": null, "endReason": null, "createdAt": "…", "updatedAt": "…" }
```

- `status`: `active` / `finished`。`result`: `white` / `black` / `draw`(終わるまで `null`)。
- `endReason`: `checkmate` / `stalemate` / `fifty` / `material` / `repetition` / `resign`(投了)。

## `POST /matches`

`{ "game": "moku-chess", "opponentTag": "u4c5d6", "color": "white" | "black" | "random" }`(`color` は省略すると `random`)
→ **201** `{ "match": … }`。相手の一覧にもすぐ出る(相手が受ける操作はない。最初の手番の人から指せる)。

- `400 invalid_game` / `invalid_opponent`(自分自身など)/ `invalid_color`
- `404 opponent_not_found`(タグの人がいない。管理者も選べない)
- `409 too_many_matches`(自分が20局進行中)/ `opponent_busy`(相手が20局進行中)

## `GET /matches`

**200** `{ "matches": [ { "id", "game", "status", "you", "opponent": { "name", "tag" }, "turn", "yourTurn", "version", "result", "endReason", "updatedAt" } ], "yourTurn": 2 }`
並びは「自分の番」→ ほかの進行中 → 終わった対局、それぞれ新しい順。`yourTurn` はハブの「Your turn!」バッジ用の数。

## `GET /matches/{id}?v=<version>`

- `v` が今の `version` と同じ → **200** `{ "changed": false, "version": 3 }`
- それ以外(`v` なしを含む)→ **200** `{ "changed": true, "match": … }`
- `404 match_not_found`(ない・期限切れ・自分の対局でない)

## `POST /matches/{id}/move`

`{ "move": "e2e4", "version": 0 }`(`move` は UCI。成る時は駒の文字が必要: `e7e8q`。`version` は今持っている値)
→ **200** `{ "match": … }`(`version` が1増える。終局なら `status: "finished"`)。

- `400 invalid_move`(書き方が違う)/ `illegal_move`(反則。今の `match` を添える)/ `invalid_version`
- `409 version_conflict`(先に別の手が入った・二度押し)/ `not_your_turn` / `match_over` — どれも今の `match` を添えるので、ページはそれで描き直す
- `404 match_not_found`

## `POST /matches/{id}/resign`

本文なし。自分の手番でなくても、進行中ならいつでも投了できる(相手の勝ち、`endReason: "resign"`)。
→ **200** `{ "match": … }`。`409 match_over`(もう終わっている。今の `match` を添える)/ `404 match_not_found`。

# Challenges(同じ問題で勝負、2026-10-30〜)

ログインした2人が、サーバーの配った**同じ問題**をそれぞれ好きな時に遊び、結果を比べる(`src/challengeApi.js`、Lambda は `MatchFunction` を `/matches` と共用)。最初は Moku Bridge(同じ新しいガラスの橋。落ちた回数が少ない方の勝ち)。

- **問題**: サーバーが8文字のシード(`seed`)と条件(`params`、Moku Bridge は `{ steps: 8〜10 }`、省略すると 9)を決める。ページは `shared/moku-random.js` で `MokuRandom.create('moku-bridge/' + seed)` から橋を作るので、2人とも同じ橋になる。
- **結果はページから**: `{ falls }`(0〜99 の整数)を1人1回だけ送る。2人そろった時にサーバーが勝ち負けを決める(少ない方の勝ち、同じなら引き分け)。手の正しさまでは検証しない(招待制の子ども向けのカジュアルな勝負と割り切る)。
- **見せるもの**: 表示名と `#u` タグだけ。**自分が結果を送るまで、相手の結果は返さない**(`theirResult: null`。遊んだかどうかの `theyPlayed` だけ)。一覧の行にはシードを入れない。
- **データ**: `pk CHAL#<id> / sk STATE` と2人それぞれの一覧用 `pk PLAYER#<uid> / sk CHAL#<id>`。結果を書く時は `version` が読んだ時と同じ時だけ書き、2人が同時に送った時は読み直して重ねる(どちらも消えない)。
- **期限**: 最後の変化から14日で消える(DynamoDB の TTL。期限を過ぎたものは消える前でも `404`)。
- **上限**: 1人が同時に進められる(`open` の)チャレンジは20まで。

## チャレンジの形(`challenge`)

```json
{ "id": "6f44822846471414", "game": "moku-bridge", "status": "open",
  "you": "from", "opponent": { "name": "Ren", "tag": "u4c5d6" },
  "seed": "K7QMZ2PA", "params": { "steps": 9 },
  "yourResult": { "falls": 1 }, "theirResult": null, "theyPlayed": false, "yourTurn": false,
  "winner": null, "version": 1, "createdAt": "…", "updatedAt": "…" }
```

- `status`: `open` / `done`(2人の結果がそろった)。`winner`: `you` / `them` / `tie`(`done` まで `null`)。
- `yourTurn`: まだ自分の結果を送っていない。

## `POST /challenges`

`{ "game": "moku-bridge", "opponentTag": "u4c5d6", "steps": 9 }` → **201** `{ "challenge": … }`(相手の一覧にもすぐ出る)。

- `400 invalid_game` / `invalid_params` / `invalid_opponent`
- `404 opponent_not_found`(管理者も選べない)
- `409 too_many_challenges` / `opponent_busy`

## `GET /challenges`

**200** `{ "challenges": [ challenge から seed と params を除いたもの ], "yourTurn": 1 }`。並びは「自分の番」→ 相手待ち → 終わったもの、それぞれ新しい順。

## `GET /challenges/{id}`

**200** `{ "challenge": … }` / `404 challenge_not_found`(ない・期限切れ・自分のでない)。

## `POST /challenges/{id}/result`

`{ "result": { "falls": 2 } }` → **200** `{ "challenge": … }`(相手がもう送っていれば `status: "done"` と `winner` が入る)。

- `400 invalid_result`
- `409 already_played`(もう送った。今の `challenge` を添える)
- `404 challenge_not_found`

# Rooms(Riddle Race、2026-10-31〜)

ログインした2〜6人が**同時に**同じ Moku Word Riddles を解く早押しレース(`src/roomApi.js`、Lambda は `MatchFunction` を `/matches` `/challenges` と共用)。ホストが部屋を作り、友達は4文字のコードを入れるか招待から入る。みんなで1問ずつ進み、**サーバーに最初に届いた正解**がその問題の勝ち。勝った問題の数が多い人が優勝。

- **問題と判定**: 問題のデータと答えの判定(`isCorrect`)は `shared/moku-riddles.js`(Lambda には `src/vendor/` のコピー。違うと `npm test` が失敗)。サーバーは開始時に全100問からランダムに `count` 問(5 か 10)を選ぶ。
- **進み方(タイムライン)**: `startAt` と `wins` だけから、ページとサーバーが同じ関数 `MokuRiddles.raceTimeline(room, now)` で今の場面を出す。サーバーが部屋を進める処理はない(書き込みは参加・開始・最初の正解の時だけ)。
  - 開始の4秒後(`COUNTDOWN_MS`)に1問目。1問は最大45秒(`LIMIT_MS`)。誰かが正解するか時間切れで、5秒(`GAP_MS`)答えを見せてから次の問題。値は部屋の `race` にも入っている。
  - 答えを受け付けるのは、今出ている問題(`question` の場面の `q`)だけ。カウントダウン中・答えを見せている間・先の問題は `first: false, late: true`。
- **時計**: 返事の `now`(サーバーの時刻、ミリ秒)で、ページは自分の時計とのずれを直して残り時間を出す。
- **ポーリング**: レース中、ページは `GET /rooms/{id}?v=<version>` を1秒おき(ロビーは2秒おき)に呼ぶ。変化がなければ `{ changed: false, now }` だけ。スロットリングは `GET /rooms/{id}` 40/秒・瞬間80、`POST /rooms/{id}/answer` 20/秒・瞬間40。
- **見せるもの**: 表示名と `#u` タグだけ。Player ID・uid は返さない。部屋はそのプレイヤーと招待された人だけが見られる(ほかの人には `404`)。問題の列(`riddles`)は開始してから返す。
- **データ**: `pk ROOM#<コード> / sk STATE`(部屋)と、プレイヤー・招待された人それぞれの一覧用 `pk PLAYER#<uid> / sk ROOM#<コード>`(`roomId` と部屋の `key` だけ)。書く時は `version` が読んだ時と同じ時だけ書き、ぶつかったら読み直してやり直す(同時の正解は先に書けた方の勝ち、もう1人は `first: false`)。
- **コード**: `ABCDEFGHJKMNPQRSTUVWXYZ`(I・L・O なし)の4文字。大文字小文字は区別しない。使用中なら別のコード。期限が切れた部屋のコードは使い回すので、一覧の行は部屋の `key` が同じ時だけ有効。
- **期限**: 最後の変化から1日で消える(TTL。期限を過ぎたものは消える前でも `404`)。
- **上限**: 1部屋6人(`room_full`)、招待は10人まで。1人が同時に入っている(ロビー・レース中の)部屋は10まで。

## 部屋の形(`room`)

```json
{ "id": "KQRT", "key": "6f44822846471414", "status": "playing", "you": "u1a2b3", "joined": true, "isHost": true,
  "count": 5, "players": [ { "name": "Aoi", "tag": "u1a2b3", "host": true, "score": 1 }, { "name": "Ren", "tag": "u4c5d6", "host": false, "score": 0 } ],
  "invited": [ { "name": "Sora", "tag": "u7e8f9" } ],
  "riddles": ["bicycle", "sunglasses", "i-understand", "rainbow", "tennis"], "startAt": 1793420000000,
  "wins": [ { "q": 0, "tag": "u1a2b3", "at": 1793420006500 } ],
  "race": { "COUNTDOWN_MS": 4000, "LIMIT_MS": 45000, "GAP_MS": 5000 },
  "next": null, "version": 4, "createdAt": "…", "updatedAt": "…", "now": 1793420007000 }
```

- `status`: `lobby` / `playing` / `done`(最後の問題が終わった)/ `closed`(ホストがロビーで抜けた)。
- `invited`: 招待されてまだ入っていない人。`joined: false` なら自分は招待されただけ(`POST …/join` で入る)。
- `next`: 終わった後にホストが「もう一回」で作った新しい部屋のコード(ほかの人のページはそこへ移る)。

## `POST /rooms`

`{ "count": 5 | 10 }`(省略すると 5)→ **201** `{ "room": … }`(作った人がホストで、もう入っている)。

- `400 invalid_count`
- `409 too_many_rooms`

## `GET /rooms`

**200** `{ "rooms": [ room ], "invites": 1, "now": … }`。ロビーかレース中の、自分が入っている・招待された部屋(終わった・閉じた部屋は出ない)。招待されただけの部屋が先。`invites` はロビーの招待の数(ボタンのバッジ用)。

## `GET /rooms/{code}?v=<version>`

- `v` が今の `version` と同じ → **200** `{ "changed": false, "now": … }`
- それ以外 → **200** `{ "changed": true, "room": … }`
- `404 room_not_found`(ない・期限切れ・プレイヤーでも招待された人でもない)

## `POST /rooms/{code}/join`

本文なし。コードを知っていれば誰でも入れる(招待はいらない)。もう入っていれば今の部屋を返すだけ。
→ **200** `{ "room": … }` / `409 already_started` / `room_full` / `404 room_not_found`

## `POST /rooms/{code}/invite`

`{ "tag": "u7e8f9" }` → **200** `{ "room": … }`。部屋のプレイヤーなら誰でも、ロビーの間だけ。招待された人の `GET /rooms` に出る。
`400 invalid_opponent` / `404 opponent_not_found`(管理者も選べない)/ `409 already_started` / `too_many_invites`

## `POST /rooms/{code}/leave`

本文なし。ロビーの間だけ抜けられる(ホストが抜けると部屋は `closed`)。始まった後は何もしない(ページを閉じるだけでよい)。→ **200** `{ "ok": true }`

## `POST /rooms/{code}/start`

本文なし。ホストだけ、2人以上いる時。問題を選び、`startAt = 今 + COUNTDOWN_MS` にする。
→ **200** `{ "room": … }` / `403 not_host` / `409 need_players`

## `POST /rooms/{code}/answer`

`{ "q": 0, "answer": "bicycle" }`(`answer` は60文字まで)→ **200** `{ "correct", "first", "late"?, "room" }`

- `correct`: 答えが合っているか。`first`: この答えでその問題を勝ち取ったか(最初の正解)。
- `late: true`: その問題はもう受け付けていない(カウントダウン中・ほかの人が先に正解・時間切れ・先の問題)。
- まちがいは何も記録しない(何回でも答えられる)。

## `POST /rooms/{code}/again`

本文なし。ホストだけ、レースが終わった後。同じプレイヤーが入った新しいロビーを作り、元の部屋の `next` にそのコードを入れる。2回押しても同じ部屋を返す。
→ **201** `{ "room": … }`(新しい部屋)/ `403 not_host` / `409 not_done`

# Moyomoyo Multiplayer(Rooms の `game: "moyomoyo"`、2026-10-31〜)

ログインした2〜4人が、それぞれの端末で Moyo Quest と同じ盤面を同時に遊ぶ。**3試合のスコアの合計**で順位を決める(`src/moyoParty.js`。部屋のコード・招待・開始・`again` は Riddle Race と同じ `src/roomApi.js`)。

- **方式**: サーバーは**中継と審判だけ**。お邪魔の計算も盤面の動きも各ページ(`moyomoyo.html`)がする。ページは試合中、自分の盤面の様子を約1秒おきに `POST /rooms/{code}/state` で送り、返事で全員の盤面と攻撃を受け取る。お邪魔は「予告トレイ」に入って次のグミが出る時に落ちるので、1秒ほど遅れて届いても遊んでいる人には分からない。
- **公平**: 試合ごとに `seed` を配り、全員が同じ順番のグミで遊ぶ(`shared/moku-random.js`)。
- **お邪魔**: 連鎖した人のページが、その時まだ残っている相手全員で**山分け**して送り先を決め、自分の `attacks` に `{ id, to: { "#uタグ": マス数 } }` を足す(`id` は試合ごとに 1 から)。受け取る側は、まだ読んでいない `id` の自分あての数を予告トレイに足す(相殺は Moyo Quest と同じ)。
- **試合の終わり**(`advance()`。サーバーは部屋を読む・書くたびに同じ規則で判定する):
  - 残っている人が1人以下になった(盤面があふれた `alive: false`、または `STALE_MS` = 12秒なにも送ってこないページ)か、`ROUND_MS` = 3分たった → `roundEndAt`。
  - ページは `roundEndAt` を見たら盤面を止め、`final: true` で最後のスコアを送る。全員の `final` がそろうか `GRACE_MS` = 4秒たったら、その試合のスコアを `results` に残す。
  - 次の試合は `INTERMISSION_MS` = 9秒後(新しい `seed`)。3試合目の後は `status: "done"`。
- **データ**: 部屋(`pk ROOM#<コード> / sk STATE`)が変わるのは開始・試合の終わり・次の試合だけ。盤面は**プレイヤーごとの行** `pk ROOM#<コード> / sk P#<uid>`(本人だけが書くので、4人が同時に連鎖してもぶつからない)。行には部屋の `key` を入れ、使い回されたコードの古い行は読まない。部屋と同じ TTL。
- **ポーリング**: 試合中(カウントダウン・休憩も)は `POST …/state` を約0.8秒おき。ロビーと結果は `GET /rooms/{code}?v=` を2秒おき。スロットリングは `POST /rooms/{id}/state` 40/秒・瞬間80。
- **Moint**(ページ側、`MokuMoint.earn` の上限の外): 合計の順位で 1位 500 / 2位 300 / 3位 200 / 4位 100(同点は同じ順位)。もらえるのは1日2セット(3試合で1セット)まで。

## Moyomoyo の部屋の形

```json
{ "id": "KQRT", "key": "…", "game": "moyomoyo", "status": "playing", "you": "u1a2b3", "joined": true, "isHost": true,
  "players": [ { "name": "Aoi", "tag": "u1a2b3", "host": true, "score": 310 } ], "invited": [],
  "rules": { "ROUNDS": 3, "MAX_PLAYERS": 4, "COUNTDOWN_MS": 5000, "ROUND_MS": 180000, "INTERMISSION_MS": 9000, "STALE_MS": 12000, "GRACE_MS": 4000 },
  "round": 2, "seed": "9f3a01bc", "roundStartAt": 1793420000000, "roundEndAt": null,
  "results": [ { "scores": { "u1a2b3": 310, "u4c5d6": 150 } } ],
  "standings": [ { "tag": "u1a2b3", "name": "Aoi", "games": [310], "total": 310, "rank": 1 } ],
  "states": [ { "tag": "u1a2b3", "r": 2, "score": 40, "alive": true, "out": false, "final": false,
                "board": "…90文字…", "attacks": [ { "id": 1, "to": { "u4c5d6": 5 } } ] } ],
  "next": null, "version": 3, "now": 1793420007000 }
```

- `players[].score`: ここまでの合計。`standings`: 合計の高い順、`rank` は同点なら同じ。
- `states`: 今の試合(`round`)の各プレイヤー。まだ送っていない人は `alive: true, score: 0`。`out`: あふれた、または黙っている。`board`: 10列×9段を上の段から90文字(`.` 空き、`0`〜`4` グミの段階、`r` レインボー、`g` お邪魔)。
- `seed`: 試合中だけ。`done` では `null`。

## `POST /rooms`(Moyomoyo)

`{ "game": "moyomoyo" }` → **201** `{ "room": … }`。`400 invalid_game`。`GET /rooms?game=moyomoyo` で Moyomoyo の部屋だけ(`game` なしは Riddle Race の部屋だけ)。1部屋4人まで。`POST …/answer` は `400 wrong_game`。

## `POST /rooms/{code}/state`

`{ "r": 1, "score": 120, "alive": true, "final": false, "board": "…", "attacks": [ { "id": 1, "to": { "u4c5d6": 3 } } ] }`

- `r` が今の試合(休憩・カウントダウン中は次の試合)の時だけ保存する。前の試合の遅れた送信は保存せず、今の部屋を返す。一度 `alive: false` になったら、その試合は `false` のまま。`final` の後のスコアは変わらない。
- `attacks` は最大30件(古いものはページが消す)、送り先は3人まで、1件200マスまで。
→ **200** `{ "room": … }`(全員の `states` つき)/ `400 invalid_state` / `wrong_game` / `404 room_not_found`
