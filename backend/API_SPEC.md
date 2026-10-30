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
- `endReason`: `checkmate` / `stalemate` / `fifty` / `material` / `repetition`。

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

