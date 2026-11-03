# Moku Word Riddles — 作問の指針

`data/riddles-db.md` に問題を足す・直す時の決まり。書き方(欄と Visual の記法)は `riddles-db.md` 先頭のコメント、仕組みは `SPEC.md` §13 を見る。
このファイルは「どんな問題を入れるか」を決める。

## 1. ねらい(教育的な背景)

Moku Word Riddles は、絵(文字の配置)を見て英語のフレーズを当てるゲームであると同時に、英語の語彙を「使える形」で身につける練習として作っている。将来の目標として IELTS 7 相当(Reading / Speaking で、言い換えを見抜き、イディオムやコロケーションを自然に使える力)を意識している。次の考え方をよりどころにしている(効果を測ったわけではなく、設計のねらい)。

1. **見方を切り替える力(認知的柔軟性)**: 文字の位置・大きさ・向きといった見た目を、別の言葉の意味に読みかえる。ゲッツェルス(Getzels)やギルフォード(Guilford)の創造性・拡散的思考の研究で扱われる「ひとつの物を別の見方でとらえ直す」働きに近い。IELTS Reading の言い換え(パラフレーズ)や見出し選択では、同じ意味を別の表現で見抜く力が問われる。
2. **かたまりで覚える(チャンク化)**: `underground` `head over heels` `once in a while` のような複合語・イディオム・句動詞は、英語の「かたまり(チャンク)」。単語1つずつより、意味のあるまとまりで覚えたほうが思い出しやすい。IELTS の Lexical Resource(語彙)の評価では、自然なコロケーションやイディオムを使えるかが見られる。
3. **絵と言葉の両方で覚える(パイヴィオの二重符号化理論)**: 言葉だけより、見た目(空間の配置)と言葉の両方で覚えたほうが、思い出す手がかりが増える。

ゲームへの落とし込み:

- **位置の問題(Position)**: `under` `over` `in` `out` `up` `down` `high` `low` `left` `right` `after` などの前置詞・副詞が持つ空間の感覚を、文字の上下左右で体に入れる(例: `[line] / GROUND` = underground、`HEAD / HEELS` = head over heels、`H{CAT}AT` = the cat in the hat)。
- **見た目・記号の問題(Typography / Sound / Math)**: ひとつの文字列を別の角度から読みかえる(例: `10 S` = tennis、`POT 8 O` = potato、`FA (tilted) | ST (tilted)` = breakfast(FAST が割れる = break))。
- **用例(Example)**: 当てたあとに、そのフレーズを実際の文の中で見る。**答えを当てても意味が分からないまま終わる**ことがないようにする(2026-11-03〜、全問に必須)。

## 2. 入れる問題の条件(全部満たすこと)

1. **仕掛けがある**: 文字の位置・大きさ・数・向き・音(数字やアルファベットの読み)・中/外・欠けた文字・交差・色のどれかが、答えの言葉に**そのまま**なっている。
   - 前後の単語をつなげるだけの問題(`AIR / PORT` = airport のような「上の単語+下の単語」)は**新しく足さない**(今あるものは残す)。
   - 見た目から答えを説明できないものは入れない。例: 「FAST を横に伸ばす = breakfast」(伸ばすは break ではない)、「Try / (stand / 2) = understand」(理屈が通らない)。
2. **覚える価値がある**: よく使う複合語・イディオム・句動詞・コロケーションを優先する。物語・歌・地名などの固有名詞(The Cat in the Hat、The Big Apple)は、全体の一部にとどめる。
3. **子ども向け**: 怖い・死・暴力・大人向けの話題はさける(例: afterlife、six feet under)。シリーズの世界観(CLAUDE.md §4)にも合わせ、ネオンなどを題材にしない。
4. **絵文字の足し算は出さない**(☀️ + 👓 など。`Pattern: emoji` はゲームが読み飛ばす)。文字は**全部同じ色**。`{WORD}` のアクセント色は、色そのものが答えの時(`{ALERT}` = red alert)か、中に入っている物を見分ける時(`H{CAT}AT`)だけ。
5. **重ならない**: 同じ答え・ほぼ同じ見た目の問題は足さない(テストが答えの重複を止める)。同じ仕掛け(`(backwards)` など)ばかり増やさない。

## 3. 欄の書き方

| 欄 | 書き方 | 例 |
| --- | --- | --- |
| `ID` | 英小文字・数字・`-`。**一度出したら変えない**(セーブのキー) | `fish-out-of-water` |
| `Level` | easy(1語・見てすぐ分かる)/ medium(よく知っているフレーズ)/ tricky(イディオム・2段階の読みかえ) | tricky |
| `Pattern` | 分類のメモ: position / quantity / size / direction / sound / inside / missing / split / typography / math / color | inside |
| `Visual` | 記法は `riddles-db.md` の先頭 | `[box: WATER] \| FISH (top right)` |
| `Answer` | 正解(小文字) | fish out of water |
| `Also` | ほかに正解にする言い方(カンマ区切り)。ほかの問題の答えと重ならないこと | a fish out of water |
| `Hint` | **意味**をやさしい英語で1文。答えの単語は入れない(💡 Hint で見せ、正解のあとにも出す) | How you feel in a strange new place. |
| `Why` | 仕掛けの説明。「X is UNDER Y = …」の形 | The FISH is OUT OF the WATER! |
| `Example` | **答えのフレーズをそのまま使った**短い英文(15語くらいまで)。子どもの生活の場面で。テストが「答えが入っているか」を確かめる | On my first day at the new school, I felt like a fish out of water. |
| `Choices` | もっともらしいハズレを3つ。正解・`Also` は入れない(テストが確かめる) | flying fish, fishbowl, swimming fish |

## 4. 良い例・さける例

| | Visual | 答え | 理由 |
| --- | --- | --- | --- |
| ◯ | `[line] / GROUND` | underground | 下にある = under。前置詞の感覚がそのまま答え |
| ◯ | `WEATHER / FEELING` | feeling under the weather | 位置の関係からイディオムになる |
| ◯ | `PA{ANTS}NTS` | ants in your pants | 中に入っている = in。子どもが笑える |
| ◯ | `EGG (x12)` | a dozen eggs | 数がそのまま単語になる |
| ◯ | `POT 8 O` | potato | 数字の読み(8 = ate)で言いかえ |
| × | `AIR / PORT` | airport | 上と下をつなげるだけ(仕掛けがない。今あるものは残す) |
| × | `FAST (stretched)` | breakfast | 見た目から答えを説明できない |
| × | `LIFE (upside down)` | afterlife | 死の話題。見た目の説明も通らない |
| × | `☀️ + 👓` | sunglasses | 絵文字の足し算 |

## 5. 足す手順

1. `data/riddles-db.md` の最後に追記する。
2. `cp data/riddles-db.md backend/src/vendor/` → `cd backend && npm test`。読めない Visual・ID や答えの重複・ハズレが正解になっている・用例に答えが入っていない、のどれかがあると失敗し、どの ID かを出す。
3. `npm run dev` でゲームを開き、足した問題のカードの見た目を確かめる(文字が重ならない・小さすぎない)。
4. PR を作ってマージする。ひとりで遊ぶモードは GitHub Pages、Riddle Race のサーバーは GitHub Actions の自動デプロイで本番に入る。
