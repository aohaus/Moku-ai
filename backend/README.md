# Moku Scores + Accounts API — デプロイ手順

- **アカウント / クラウドセーブ(`/auth/*` `/save`)**: 本番で使う。SPEC.md §10。
- **スコア(`/scores`)**: ランキングの現行実装は Dreamlo(SPEC.md §6、`shared/moku-scores.js`)。こちらは移行先として保持している自前ホスト版。

## デプロイ済み環境

2026-10-24 にデプロイ済み。

- **スタック名**: `moku-backend`(リージョン `ap-southeast-5` マレーシア。dreamlo-proxy と同じ)
- **ApiUrl**: `https://d6hl1cxi0i.execute-api.ap-southeast-5.amazonaws.com`(`shared/moku-account.js` の `API_BASE_URL` に設定済み)
- **AllowedOrigin**: `https://aohaus.github.io`(これ以外のサイトからはブラウザが API を呼べない。公開先を変えたら再デプロイが必要)
- **ExtraAllowedOrigin**: `https://dechatgpt.com`(2026-10-25〜。Cloudflare で `https://dechatgpt.com/Moku-ai/` から同じページを配信している。初期値に入っているので `sam deploy` だけで反映される。パスは付けず scheme+host だけ)
- `AuthSecret` / `InviteCode` の値はリポジトリには書かない(保護者が保管)。

## GitHub Actions で自動デプロイ(2026-11-01〜)

`main` に `backend/` の変更が入る(PR をマージする)と、[`.github/workflows/deploy-backend.yml`](../.github/workflows/deploy-backend.yml) が自動で次を行う。CloudShell での手作業は、下の初回設定と、招待コード・AuthSecret を変える時だけになる。

1. **Test**: `cd backend && npm test`。失敗したらデプロイしない。
2. **Deploy**: `sam validate` → `sam deploy`(スタック `moku-backend`、`ap-southeast-5`)。`sam build` はしない(下の「デプロイ / 更新の手順」と同じ理由)。
   - パラメータ(`AuthSecret` `InviteCode` `AllowedOrigin` `MaxUsers` …)は渡さない。既存のスタックでは、渡さなかったパラメータは**今の値のまま**になるので、秘密の値を GitHub に置く必要はない。
   - そのため、`template.yaml` に**新しいパラメータを足す時は必ず `Default` を付ける**(初期値がないと自動デプロイが失敗する)。
3. **Health check**: スタックが `*_COMPLETE` か、API が動いているかを確かめる。ログインが必要な5つのルート(`/players` `/admin/settings` `/matches` `/challenges` `/rooms`)がログインなしで `401` を返すか(`404` ならデプロイされていない)、公開サイト(`https://aohaus.github.io`)からの CORS の確認が `204` を返すか。1つでも違えば赤くなる。結果は Actions の実行画面の Summary に表で出る。
- `backend/` を変えない PR(ゲームの HTML だけなど)では動かない。手で動かす時は GitHub の Actions → **Deploy backend** → **Run workflow**。
- 同時に2つは動かない(後から来た方は前のデプロイが終わるまで待つ)。

### 初回設定(1回だけ)

GitHub Actions は AWS のアクセスキーを持たない。GitHub が発行する一時的な身分証(OIDC)で、決まったロールにだけなれる。そのロールを作る。

**1. ロールを作る(CloudShell)**

この AWS アカウントに GitHub の OIDC プロバイダーがもうあるか確かめる。

```sh
aws iam list-open-id-connect-providers
```

出力に `token.actions.githubusercontent.com` があれば、下の最後の行を `CreateOidcProvider=false` にする(なければそのまま)。

```sh
cd ~/Moku-ai && git pull
aws cloudformation deploy --region ap-southeast-5 \
  --template-file .github/aws/deploy-roles.yaml --stack-name moku-github-deploy \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides CreateOidcProvider=true
```

できる物([`.github/aws/deploy-roles.yaml`](../.github/aws/deploy-roles.yaml)):

| ロール | 使う人 | できること |
| --- | --- | --- |
| `moku-github-deploy` | GitHub Actions(`aohaus/Moku-ai` の `main` / `production` 環境だけ) | コードの zip を S3 に置く・`moku-backend` スタックの変更セットを作って実行する・下のロールを CloudFormation に渡す。これ以外は何もできない |
| `moku-cfn-exec` | CloudFormation | `moku-backend` の中身(`moku-backend-*` の Lambda とそのロール・HTTP API・DynamoDB の `moku-accounts` / `moku-scores`)を作り変える |

**2. ロールの ARN を確かめる(CloudShell)**

```sh
aws cloudformation describe-stacks --region ap-southeast-5 --stack-name moku-github-deploy \
  --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
```

**3. GitHub に登録する**

リポジトリの **Settings → Environments → New environment** で `production` を作る。
- **Deployment branches and tags** で `main` だけにする(ほかのブランチからデプロイできないように)。
- 必要なら **Required reviewers** に自分を入れる(デプロイの前に毎回「承認」ボタンを押す運用になる)。

その `production` 環境の **Environment secrets** に2つ足す。

| Secret 名 | 値 | 中身 |
| --- | --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | 手順2の `DeployRoleArn`(`arn:aws:iam::…:role/moku-github-deploy`) | GitHub Actions がなるロール |
| `AWS_CFN_EXEC_ROLE_ARN` | 手順2の `CfnExecRoleArn`(`arn:aws:iam::…:role/moku-cfn-exec`) | CloudFormation が使うロール |

`AuthSecret`・`InviteCode`・管理者の PIN は GitHub に**登録しない**(上のとおり、デプロイでは今の値がそのまま使われる)。

**4. 動かしてみる**

Actions → **Deploy backend** → **Run workflow**(Branch: `main`)。緑になり、Summary の表がすべて ✅ ならおしまい。

- 初回のデプロイから、スタックの変更は `moku-cfn-exec` ロールで行われる(CloudFormation がスタックに覚える)。CloudShell から手で `sam deploy` しても、このロールが使われる。
- `Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity` で失敗した時は、GitHub が名乗った名前(トークンの `sub`)がロールの条件と合っていない。CloudShell で `aws cloudtrail lookup-events --region ap-southeast-5 --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity --max-results 3 --query "Events[].CloudTrailEvent" --output text | grep -o '"principalId":"[^"]*"'` を実行すると、名乗った名前が分かる(2026-11-01 には `repo:aohaus@991104/Moku-ai@1338191090:environment:production` という ID つきの形だった。テンプレートは ID なし・ID つきの両方を受け入れる)。
- `AccessDenied` で失敗した時は、エラーに出ている操作をロールに足す。`moku-github-deploy` の権限なら Deploy のログ、`moku-cfn-exec` の権限ならスタックのイベント(CloudFormation コンソール)に出る。ロールは `.github/aws/deploy-roles.yaml` を直して手順1をもう一度実行すれば更新される。
- **招待コード・AuthSecret を変える時**は、従来どおり CloudShell で下の `sam deploy --parameter-overrides …` を実行する。そのあとの自動デプロイは、その新しい値をそのまま使う。

## デプロイ / 更新の手順(AWS CloudShell を使う)

パソコンへのインストールは不要。AWS コンソール上部の `>_` アイコンから CloudShell を開くと、AWS CLI と SAM CLI が入っている。
ライブラリ(`@aws-sdk/*`)は Lambda の Node.js ランタイムに最初から入っているので `sam build` は不要。
**`sam build` は実行しないこと。** 一度でも実行すると `backend/.aws-sam/build/` ができ、`sam deploy` は `git pull` した `template.yaml` ではなくその古いコピーを使い続ける(「File with same data already exists」「No changes to deploy」と出て、何も更新されない。2026-10-31 に Moyomoyo Multiplayer の `POST /rooms/{id}/state` がこれで 404 のままだった)。下の更新の手順は、念のため毎回 `.aws-sam` を消してからデプロイする。

```sh
git clone https://github.com/aohaus/Moku-ai.git   # 初回だけ。2回目以降は cd ~/Moku-ai && git pull
cd ~/Moku-ai/backend
SECRET=$(openssl rand -hex 32)    # 初回だけ。表示された値は保護者が保管する
echo $SECRET
sam deploy --parameter-overrides AllowedOrigin=https://aohaus.github.io AuthSecret=$SECRET InviteCode=<招待コード> MaxUsers=100
```

- 途中の `Deploy this changeset? [y/N]:` には **`y` を入力してから Enter**。Enter だけだと初期値の `N`(デプロイしない)になり、何も更新されないまま終わる(2026-10-24 に実際に起きた)。
- **2回目以降(コードの更新だけ)**: `cd ~/Moku-ai && git pull && cd backend && rm -rf .aws-sam && sam deploy`(保存済みの値で更新される。`rm -rf .aws-sam` は古いビルドのコピーを消すだけで、`samconfig.toml` や AWS 上のデータには影響しない)。
  - `No changes to deploy` と出たのに新しい機能が動かない時は、`.aws-sam` が残っていないか、`git log -1 --oneline` が最新か、を確かめる。スタックが本当に更新されたかは下の「デプロイ後の確認」の日時で分かる。
  - 新しいエンドポイントを足した時(例: 2026-10-24 の `GET /players`)もこれでよい。デプロイ前の古い API でもクライアントは壊れない(プロフィールの Players 欄が出ないだけ)。
  - 2026-10-25 のアクセスログ追加では、テーブルに TTL(`ttl` 属性で古いログを自動削除)の設定も入る。これも `sam deploy` だけでよい。
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

オンライン対戦(2026-10-30〜)を足した時は `/matches` で同じように確かめる(`401` なら OK)。

```sh
curl -s -w ' HTTP %{http_code}\n' https://d6hl1cxi0i.execute-api.ap-southeast-5.amazonaws.com/matches
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
- `src/roomApi.js` — `/rooms` ハンドラ(Riddle Race。Lambda は `MatchFunction` を共用)。問題は `src/vendor/riddles-db.md`、読み込みと判定は `src/vendor/moku-riddles.js`(`src/riddles.js` が読み込む。どちらも `data/` と `shared/` のコピー。**直接直さない**。元を直して `cp data/riddles-db.md shared/moku-riddles.js backend/src/vendor/`)。問題を足した PR をマージすると、`backend/` が変わるので上の自動デプロイが走る(テストに通った時だけ)。
- `src/matchApi.js` — `/matches` ハンドラ(オンライン対戦。Lambda は `MatchFunction`)。チェスのルールは `src/vendor/moku-chess-rules.js`(`shared/` のコピー。**直接直さない**。`shared/` を直して `cp shared/moku-chess-rules.js backend/src/vendor/`。違うと `npm test` が失敗する)。
- `scripts/accounts.js` — 管理用CLI。`dev/mount.js` — `server.js` 用のモック。

詳細な仕様は [`API_SPEC.md`](./API_SPEC.md) を参照。

## コスト

DynamoDBは PAY_PER_REQUEST、Lambda/API Gatewayともに従量課金。
数百プレイヤー規模のアクセス量であれば AWS Free Tier の範囲内に収まる想定。
`moku-accounts` はポイントインタイムリカバリ(PITR)を有効にしている(誤操作で消えても35日以内なら復元可。100人規模なら月数セント)。
