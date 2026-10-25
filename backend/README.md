# Moku Scores + Accounts API — デプロイ手順

- **アカウント / クラウドセーブ(`/auth/*` `/save`)**: 本番で使う。SPEC.md §10。
- **スコア(`/scores`)**: ランキングの現行実装は Dreamlo(SPEC.md §6、`shared/moku-scores.js`)。こちらは移行先として保持している自前ホスト版。

## デプロイ済み環境

2026-10-24 にデプロイ済み。

- **スタック名**: `moku-backend`(リージョン `ap-southeast-5` マレーシア。dreamlo-proxy と同じ)
- **ApiUrl**: `https://d6hl1cxi0i.execute-api.ap-southeast-5.amazonaws.com`(`shared/moku-account.js` の `API_BASE_URL` に設定済み)
- **AllowedOrigin**: `https://aohaus.github.io`(これ以外のサイトからはブラウザが API を呼べない。公開先を変えたら再デプロイが必要)
- `AuthSecret` / `InviteCode` の値はリポジトリには書かない(保護者が保管)。

## デプロイ / 更新の手順(AWS CloudShell を使う)

パソコンへのインストールは不要。AWS コンソール上部の `>_` アイコンから CloudShell を開くと、AWS CLI と SAM CLI が入っている。
ライブラリ(`@aws-sdk/*`)は Lambda の Node.js ランタイムに最初から入っているので `sam build` は不要。

```sh
git clone https://github.com/aohaus/Moku-ai.git   # 初回だけ。2回目以降は cd ~/Moku-ai && git pull
cd ~/Moku-ai/backend
SECRET=$(openssl rand -hex 32)    # 初回だけ。表示された値は保護者が保管する
echo $SECRET
sam deploy --parameter-overrides AllowedOrigin=https://aohaus.github.io AuthSecret=$SECRET InviteCode=<招待コード> MaxUsers=100
```

- 途中の `Deploy this changeset? [y/N]:` には **`y` を入力してから Enter**。Enter だけだと初期値の `N`(デプロイしない)になり、何も更新されないまま終わる(2026-10-24 に実際に起きた)。
- **2回目以降(コードの更新だけ)**: `cd ~/Moku-ai && git pull && cd backend && sam deploy`(保存済みの値で更新される)。
  - 新しいエンドポイントを足した時(例: 2026-10-24 の `GET /players`)もこれでよい。デプロイ前の古い API でもクライアントは壊れない(プロフィールの Players 欄が出ないだけ)。
- **AuthSecret を変えずに招待コードだけ変える**: 保管している AuthSecret を `SECRET=...` に入れてから、上の `sam deploy --parameter-overrides ...` を新しい招待コードで実行する。AuthSecret を変えると全員ログアウトされる。
- `sam deploy --guided`(質問形式)でもよいが、**`AuthSecret` と `InviteCode` は入力しても画面に何も表示されない**(パスワード入力と同じ)。
  貼り付けは1回だけにすること。見えない制御文字が混ざると `ParameterValue for ParameterKey AuthSecret contains invalid characters` で失敗する。
  上の `--parameter-overrides` 方式なら入力欄に貼らないのでこの問題が起きない。
- 質問形式の場合、`... has no authentication. Is this okay?` には `y`(ログイン確認は Lambda の中で行っている)。

### デプロイ後の確認

`Successfully created/updated stack - moku-backend` と出たら、本当に更新されたかを確かめる。

```sh
aws cloudformation describe-stacks --stack-name moku-backend --query "Stacks[0].[StackStatus,LastUpdatedTime]" --output text
```

- `UPDATE_COMPLETE` と**今デプロイした日時**(UTC)が出れば成功。
- `CREATE_COMPLETE` のまま、または日時が古い場合は更新されていない。もう一度 `sam deploy` して、最後の質問に `y` と答える。

新しいエンドポイントは、ログインなしで呼んで `401`(ログインが必要)が返れば存在している(`404` ならまだデプロイされていない)。

```sh
curl -s -w ' HTTP %{http_code}\n' https://d6hl1cxi0i.execute-api.ap-southeast-5.amazonaws.com/players
```

パラメータ:

| パラメータ | 値 |
| --- | --- |
| `AllowedOrigin` | ゲームを配信するオリジン(例: `https://aohaus.github.io`) |
| `AuthSecret` | ログイントークンの署名鍵。`openssl rand -hex 32` で作る。**`dreamlo-proxy` にも同じ値を設定する**。変えると全員ログアウトされる |
| `InviteCode` | 新規登録に必要な招待コード。参加してほしい人にだけ伝える。空にすると新規登録を締め切る |
| `MaxUsers` | アカウント上限(既定 100) |

`AuthSecret` / `InviteCode` は `NoEcho` なので CloudFormation のコンソールには表示されないが、`samconfig.toml`(CloudShell 上)に平文で保存される。
**`samconfig.toml` はコミットしない**こと(`.gitignore` 済み)。

新しく作り直した場合は、出力される `ApiUrl` を `shared/moku-account.js` 冒頭の `API_BASE_URL` に貼る。
空のままならハブのログインは `Log In (Coming Soon)` のまま。`npm run dev`(localhost:3000)では常に開発用モックが使われる。

## アカウントの管理(保護者向け)

AWS CloudShell(リージョン `ap-southeast-5`)で:

```sh
cd ~/Moku-ai/backend
npm install                                      # 初回だけ
node scripts/accounts.js list                    # 一覧(ID / 表示名 / 作成日 / ロック中か)
node scripts/accounts.js reset-pin aoi 4826      # PINを忘れた時。他の端末はログアウトされる
node scripts/accounts.js unlock aoi              # PIN間違いのロックを解除
node scripts/accounts.js delete aoi              # アカウントとクラウドセーブを削除
node scripts/accounts.js create-admin admin <PIN> # 管理者アカウントを作る(2回目以降はPINの変更)
```

## 管理者アカウントと管理画面

`admin.html`(https://aohaus.github.io/Moku-ai/admin.html)は、管理者アカウントでだけ使える保護者用の画面(SPEC.md §12)。
管理者アカウントはアプリからは作れない。CloudShell で一度だけ実行する:

```sh
cd ~/Moku-ai/backend
npm install                                 # 初回だけ
node scripts/accounts.js create-admin admin <PIN>
```

- ID は大文字・小文字を区別しない(`Admin` でログインできる)。PIN はこのリポジトリやチャットに書かないこと。
- 管理者は100人の上限に数えず、Players 一覧にも出ない。
- 同じコマンドをもう一度実行すると PIN の変更になる(管理者の端末はログアウト)。

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
