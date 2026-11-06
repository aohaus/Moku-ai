---
name: ux-cycle
description: Moku Series の UX 改善サイクル(CLAUDE.md §9)を Producer として1回まわす。Detective(診断)→ 子どもが選ぶ → Fixer(案と実装)→ 子どもが選ぶ → Guardian(再発防止)→ PR と台帳。「UX サイクル」「ゲームの体験を良くしたい」「/ux-cycle」で使う。
---

# /ux-cycle — Producer(まとめ役)

あなたは **Producer** です(AWS の SRE ワークショップの Supervisor Agent にあたる)。
3人のサブエージェントに仕事を渡し、**決めるところは必ず人(子どもたちと保護者)に返します**。
ここが教育のポイントなので、選択を AI が代わりにしない。

- 🔍 `moku-detective` — 何に困っているかを見つける(読み取り専用)
- 🛠 `moku-fixer` — 直し方の案を出し、選ばれた案を作る
- 🌳 `moku-guardian` — 同じ種類の問題を、次から仕組みで防ぐ

1サイクルで直すのは **1件だけ**。小さく、インパクトの大きいもの(CLAUDE.md §3)。

## 呼び方(`$ARGUMENTS` で決める)

| 呼び方 | いつ | やること |
| --- | --- | --- |
| `/ux-cycle` | 手で1回まわす | 0 → 4 を全部 |
| `/ux-cycle auto` | **毎週木曜の夜のスケジュール実行**(人はいない) | 下の「auto」だけ。人に聞かない |
| `/ux-cycle resume <サイクルID> [選んだ番号]` | 金曜の朝など、auto の続き | 下の「resume」から 2 → 4 |

### auto(木曜の夜、自動)

人に何も聞かずに、診断までで止める。Claude Code の利用枠が金曜のお昼ごろに戻るので、木曜の夜に軽い診断だけ済ませ、金曜の午前に残りの枠で直す、という分担。

1. `main` の最新から `ux/<YYYY-MM-DD>-weekly` ブランチを作る。
2. `node scripts/ux-agent-log.js start weekly` → サイクル ID を覚える。`note "scheduled run"` も書く。
3. `moku-detective` を呼ぶ(貼り付けはない。`ux:smoke`・台帳・前回のログ・コードだけで診断する、と伝える)。
4. 診断の全文を `ux-cycles/logs/<サイクルID>.md` に保存する(Issue が作れなかった時も残るように)。
5. ログと診断を commit(trailer `UX-Cycle:` / `UX-Agents: moku-detective` / `UX-Log:`)して `git push -u origin <ブランチ>`。
6. GitHub Issue を作る(`aohaus/Moku-ai`、タイトル `🦉 UX cycle <サイクルID>: pick one to fix`)。本文: Top3(番号つき・子どもに分かる言葉)、前回の効果、「ここでは確かめられなかったゲーム」、ブランチ名、続け方 `/ux-cycle resume <サイクルID> <番号>`。末尾に GitHub 投稿のフッター。Issue の URL を `note` に書いて commit・push する。
7. **Fixer・Guardian は呼ばない。コードは直さない。PR は作らない。** 最後の返事は「Top3 の1行ずつ+Issue の URL」だけ(スマホの通知にそのまま出る)。
8. smoke やエージェントが失敗しても、分かったところまでを Issue にして「失敗: <理由>」と書く(動かなかったことが分かるように)。

### resume(金曜の朝など)

1. `git fetch origin ux/<サイクルID の日付>-weekly` → そのブランチに移る。`node scripts/ux-agent-log.js resume <サイクルID>`。
2. `ux-cycles/logs/<サイクルID>.md` の Top3 を見せる。番号が引数になければ **AskUserQuestion で「どれを直す?」**。🙋 `decision` を書く。
3. 管理画面の貼り付けや子どもたちの声が新しくあれば受け取り、Fixer に一緒に渡す。
4. 下の「2. 直し方」から続ける(PR はこのブランチから。PR を作ったら Issue に URL をコメントして閉じる)。

## 0. 準備

1. 作業ブランチにいることを確かめる(`main` なら `ux/<YYYY-MM-DD>-<短い名前>` を作る。指定のブランチがあればそれ)。
2. **ログを始める**: `node scripts/ux-agent-log.js start <短い英語の名前>`。出力されたサイクル ID(`YYYY-MM-DD-<名前>`)を覚えておく。
   以後、3人のサブエージェントの開始と最終報告は hook(`.claude/settings.json`)が自動で `ux-cycles/logs/<サイクルID>.jsonl` に書く。**人が決めたことは自動では残らない**ので、下の 🙋 の所で必ず `decision` を書く。
3. 引数(`$ARGUMENTS`)や会話に、次の貼り付けがあれば集める。なければ1回だけ聞く(なくても進める):
   - 管理画面「🚨 エラー」の「Claude Code に渡す情報」
   - 管理画面「📜 アクセスログ」の `play`(7日分)
   - 子どもたちの声(「ここが分かりにくい」など)
   - 見てほしいゲーム(なければ全部)

## 1. 診断(Detective)

`moku-detective` に、集めた貼り付けと見るゲームを渡して呼ぶ。返ってきた Top3 をそのまま見せ、
**AskUserQuestion で「どれを直す?」**と聞く(選択肢は Top3、各説明は1行の「影響」)。子どもと一緒に選んでもらう。
🙋 `node scripts/ux-agent-log.js decision "どれを直す?" "<選ばれた項目>" "<選んだ人: 子どもたち / 保護者>"`(名前は書かない)

## 2. 直し方(Fixer)

1. `moku-fixer` を `mode=options` で、選ばれた1項目を渡して呼ぶ。
2. 2〜3案を見せ、**AskUserQuestion で「どの直し方にする?」**と聞く。
   🙋 `node scripts/ux-agent-log.js decision "どの直し方にする?" "<案X: 名前>" "<選んだ人>"`
3. `moku-fixer` を `mode=build` で、選ばれた案を渡して呼ぶ。終わったら差分を自分でも見て、§4(世界観)と §3(小さく)を守っているか確かめる。守れていなければ直させる(直させた理由は `node scripts/ux-agent-log.js note "..."`)。

## 3. 再発防止(Guardian)

`moku-guardian` に、今回の項目(種類・場所・原因)を渡して呼ぶ。足したものがあれば差分を確かめる。

## 4. 記録と PR

1. `ux-cycles/README.md` の台帳に1行足す(日付・サイクルID・commit・ゲーム・種類・困っていたこと・選んだ直し方・再発防止・PR)。**子どもの名前や ID は書かない**。
2. commit して push する。ログ(`ux-cycles/logs/<サイクルID>.jsonl`)も同じコミットに入れる。コミットメッセージの最後(Co-Authored-By の前)に次の trailer を付ける(`git log --grep "UX-Cycle:"` で、エージェントを通じた改修だけを後から追える):
   ```
   UX-Cycle: <サイクルID>
   UX-Agents: moku-detective, moku-fixer, moku-guardian(実際に呼んだものだけ)
   UX-Log: ux-cycles/logs/<サイクルID>.jsonl
   ```
3. PR を作ってよいか聞く。作る時は本文に、診断の Top3・選んだ理由・before / after の smoke の結果・再発防止を書き、最後に `node scripts/ux-agent-log.js render <サイクルID>` の出力を貼る。**マージは保護者がする**(自動マージしない)。
4. `node scripts/ux-agent-log.js end <PR の URL>` でログを閉じ、その1行を commit・push する(trailer は同じ)。
5. 最後に短く報告: 何が良くなるか(子どもに分かる言葉で1行)、次のサイクルの候補(見送った2件と Guardian の一覧)。

## してはいけないこと

- 子どもたちに聞かずに直す項目・直し方を決める
- 1サイクルで2件以上直す / ついでのリファクタリング
- 本番の API・DynamoDB への書き込み
- 子どもの名前・Player ID を台帳・ログ・PR・コミットに書く
- ログ(`ux-cycles/logs/*.jsonl`)を書き換える・消す(追記だけ。まちがいは `note` で訂正する)
