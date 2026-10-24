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
| `LOGIN#<loginId>` | `PROFILE` | `loginId` `uid`(公開用ランダムID) `displayName` `pinHash`(scrypt) `tv`(トークン世代) `failCount` `lockedUntil` `createdAt` |
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

**200** `{ "rev": 4, "updatedAt": "…" }`
