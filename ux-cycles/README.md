# UX サイクルの台帳

`/ux-cycle`(CLAUDE.md §9)を1回まわすごとに1行足す。Guardian が「同じ種類の問題が前にもあったか」をここで調べる。

- **種類**: `crash` / `layout` / `confusing` / `too-hard` / `too-easy` / `slow` / `not-played` / `other`(`moku-detective` と同じ)
- **再発防止**: Guardian が足したもの(smoke のチェック / テスト / ルール)か「なし(初回)」
- **ログ**: 各サイクルの全部の流れ(エージェントの報告・人が選んだこと)は `logs/<サイクルID>.jsonl`。読む時は `node scripts/ux-agent-log.js render <サイクルID>`。
- 子どもの名前・Player ID は書かない。人数は数で。

| 日付 | サイクルID | commit | ゲーム | 種類 | 困っていたこと | 選んだ直し方 | 再発防止 | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
