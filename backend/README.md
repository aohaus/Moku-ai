# Moku Scores + Accounts API — デプロイ手順

- **アカウント / クラウドセーブ(`/auth/*` `/save`)**: 本番で使う。SPEC.md §10。
- **スコア(`/scores`)**: ランキングの現行実装は Dreamlo(SPEC.md §6、`shared/moku-scores.js`)。こちらは移行先として保持している自前ホスト版。

AWS SAM CLI が必要 (`brew install aws-sam-cli` 等)。AWSアカウント/認証情報は設定済みであること。

```sh
cd backend
sam build
sam deploy --guided
```

`--guided` の初回実行で `samconfig.toml` が生成される(次回以降は `sam deploy` のみでよい)。
パラメータ:

| パラメータ | 値 |
| --- | --- |
| `AllowedOrigin` | ゲームを配信するオリジン(例: `https://aohaus.github.io`) |
| `AuthSecret` | ログイントークンの署名鍵。`openssl rand -hex 32` で作る。**`dreamlo-proxy` にも同じ値を設定する**。変えると全員ログアウトされる |
| `InviteCode` | 新規登録に必要な招待コード。参加してほしい人にだけ伝える。空にすると新規登録を締め切る |
| `MaxUsers` | アカウント上限(既定 100) |

`AuthSecret` / `InviteCode` は `NoEcho` なので CloudFormation のコンソールには表示されないが、`sam deploy --guided` の
「Save arguments to configuration file」で `samconfig.toml` に平文で保存される。**`samconfig.toml` はコミットしない**こと。

デプロイ完了後、出力される `ApiUrl` を `shared/moku-account.js` 冒頭の `API_BASE_URL` に貼る。
これでハブ(`index.html` / `hub.html`)に「Log In」ボタンが出る(空のままなら従来どおり `Log In (Coming Soon)`)。

## アカウントの管理(保護者向け)

AWS 認証情報を設定した端末で:

```sh
cd backend
npm install
node scripts/accounts.js list                    # 一覧(ID / 表示名 / 作成日 / ロック中か)
node scripts/accounts.js reset-pin aoi 4826      # PINを忘れた時。他の端末はログアウトされる
node scripts/accounts.js unlock aoi              # PIN間違いのロックを解除
node scripts/accounts.js delete aoi              # アカウントとクラウドセーブを削除
```

## テスト

```sh
cd backend && npm test        # AWS 不要(メモリ上のストアで accountApi を検証)
```

ブラウザでの確認はリポジトリ直下で `npm run dev` → http://localhost:3000/hub.html 。
`server.js` が `backend/dev/mount.js` 経由で本物のハンドラをメモリストアで動かす(招待コード `moku-dev`、再起動で消える)。

## ローカルでの動作確認

```sh
sam local start-api
```

## 構成

- `template.yaml` — API Gateway (HTTP API) + Lambda + DynamoDB (`moku-scores` テーブル) を定義。
- `src/submitScore.js` — `POST /scores` ハンドラ。自己ベストのみ保持。
- `src/getScores.js` — `GET /scores` ハンドラ。ランキング取得 / 自分の記録取得。
- `src/db.js` — DynamoDB Document Client、`scoreSort`(降順ソート用ゼロ埋め文字列)の生成。
- `src/accountApi.js` — `/auth/*` `/save` ハンドラ(ストア非依存。`createAccountApi(store, config)`)。
- `src/accountStore.js` / `src/memoryStore.js` — DynamoDB(`moku-accounts` テーブル) / メモリ版のストア。
- `src/token.js` / `src/pin.js` — ログイントークン(HMAC署名) / PINハッシュ(scrypt)。
- `scripts/accounts.js` — 管理用CLI。`dev/mount.js` — `server.js` 用のモック。

詳細な仕様は [`API_SPEC.md`](./API_SPEC.md) を参照。

## コスト

DynamoDBは PAY_PER_REQUEST、Lambda/API Gatewayともに従量課金。
数百プレイヤー規模のアクセス量であれば AWS Free Tier の範囲内に収まる想定。
`moku-accounts` はポイントインタイムリカバリ(PITR)を有効にしている(誤操作で消えても35日以内なら復元可。100人規模なら月数セント)。
