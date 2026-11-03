# Moku Word Riddles — Riddle Database

<!--
このファイルが Moku Word Riddles の問題データのすべて。問題を足す・直す時はこのファイルだけ書き換える(コードは触らない)。
moku-word-riddles.html が起動時に読み込み、shared/moku-riddles.js がパース・レイアウト・判定をする。
Riddle Race のサーバーも同じものを使うので、書き換えたら:
  cp data/riddles-db.md backend/src/vendor/ && (cd backend && npm test)
npm test は「読めない問題」「同じ ID・同じ答えの重複」があると失敗する(どこが悪いかを表示する)。
そのまま PR をマージすれば、ひとりで遊ぶモードは GitHub Pages に、Riddle Race のサーバーは
GitHub Actions の自動デプロイ(.github/workflows/deploy-backend.yml。テストに通った時だけ)で本番に入る。

1問の書き方:
  ## ID: <英小文字・数字・- の ID。セーブのキーなので、一度出したら変えない>
  - **Level**: easy / medium / tricky
  - **Pattern**: position / quantity / size / sound / inside / typography … (分類のメモ。emoji は出題しない)
  - **Visual**: カードに描く内容(下の書き方)
  - **Answer**: 正解
  - **Also**: ほかに正解にする答え(カンマ区切り。省略可)
  - **Hint**: 💡 Hint で出す意味のヒント(英語)
  - **Why**: 正解のあとに出す説明(英語。省略すると「The answer is …!」)
  - **Choices**: 🔤 Choices の4択に混ぜるハズレ3つ(省略すると他の問題の答えから選ぶ)

Visual の書き方:
  " / " で上から下への行、" | " で同じ行の左から右に並べる。
  文字は全部同じ色。{WORD} だけアクセント色(色そのものがヒントの時だけ使う)。ICE^3 の ^ は右上の小さい文字。
  [line] 横線 / [box] 空の枠 / [box: LUNCH] 枠の中に文字
  文字のあとの ( ) で動き・位置(カンマで複数):
    top, bottom, left, right, top left, top right, bottom left, bottom right
    xN(N個並べる: DAY (x7)) / vertical(縦に1文字ずつ) / upside down / sideways(下から上に読む)
    backwards(逆さ文字) / big / small / tiny / stretched(字間を広げる) / tilted(少し傾ける)
    growing(右上へ大きくなる) / rising(右上へ) / shrinking(小さくなる) / falling(落ちる)
    bumpy(上下にがたがた) / jumbled(文字を混ぜる) / cross(十字に交差)
  例: AIR / PORT    CYCLE | CYCLE    GET IT (x4)    CHAIR (top)    [box] | THINK    HA{HAND}ND
-->

## ID: treehouse
- **Level**: medium
- **Pattern**: inside
- **Visual**: TR{HOUSE}EE
- **Answer**: treehouse
- **Also**: tree house
- **Hint**: A little home built up in the branches.
- **Why**: HOUSE is in the TREE = TREEHOUSE
- **Choices**: birdhouse, greenhouse, tree trunk

## ID: spelling-bee
- **Level**: easy
- **Pattern**: sound
- **Visual**: SPELLING B
- **Answer**: spelling bee
- **Also**: spellingbee
- **Hint**: A contest where you spell words out loud.
- **Why**: SPELLING + B (sounds like BEE) = SPELLING BEE
- **Choices**: honeybee, word game, bumblebee

## ID: bicycle
- **Level**: medium
- **Pattern**: quantity
- **Visual**: CYCLE | CYCLE
- **Answer**: bicycle
- **Also**: bike
- **Hint**: It has two wheels and you pedal it.
- **Why**: BI means two. Two CYCLEs = BICYCLE!
- **Choices**: motorcycle, tricycle, unicycle

## ID: tricycle
- **Level**: medium
- **Pattern**: quantity
- **Visual**: CYCLE / CYCLE / CYCLE
- **Answer**: tricycle
- **Hint**: Little kids ride it. It has three wheels.
- **Why**: TRI means three. Three CYCLEs = TRICYCLE!
- **Choices**: bicycle, triangle, unicycle

## ID: downtown
- **Level**: medium
- **Pattern**: direction
- **Visual**: TOWN (vertical)
- **Answer**: downtown
- **Also**: down town
- **Hint**: The busy middle of a city.
- **Why**: TOWN goes DOWN the card = DOWNTOWN
- **Choices**: uptown, countdown, town hall

## ID: high-chair
- **Level**: medium
- **Pattern**: position
- **Visual**: CHAIR (top)
- **Answer**: high chair
- **Also**: highchair
- **Hint**: A tall seat for a baby at the table.
- **Why**: The CHAIR is way up HIGH = HIGH CHAIR
- **Choices**: armchair, rocking chair, chairlift

## ID: upside-down
- **Level**: medium
- **Pattern**: typography
- **Visual**: DOWN (upside down)
- **Answer**: upside down
- **Also**: upsidedown
- **Hint**: When the top is at the bottom.
- **Why**: The word DOWN is flipped UPSIDE DOWN!
- **Choices**: sit down, inside out, downstairs

## ID: backpack
- **Level**: medium
- **Pattern**: typography
- **Visual**: PACK (backwards)
- **Answer**: backpack
- **Also**: back pack
- **Hint**: You carry your school books in it.
- **Why**: PACK is written BACKwards = BACKPACK
- **Choices**: lunch box, school bag, pack it

## ID: banana-split
- **Level**: medium
- **Pattern**: split
- **Visual**: BAN (tilted) | ANA (tilted)
- **Answer**: banana split
- **Also**: bananasplit
- **Hint**: A yummy ice cream treat with fruit.
- **Why**: The word BANANA is SPLIT in two = BANANA SPLIT
- **Choices**: banana bread, banana peel, half banana

## ID: waterfall
- **Level**: medium
- **Pattern**: direction
- **Visual**: WATER (falling)
- **Answer**: waterfall
- **Also**: water fall
- **Hint**: Water tumbling down from a cliff.
- **Why**: The letters of WATER FALL down = WATERFALL
- **Choices**: rainfall, waterslide, raindrop

## ID: crossroads
- **Level**: medium
- **Pattern**: position
- **Visual**: ROAD (cross)
- **Answer**: crossroads
- **Also**: cross roads, crossroad
- **Hint**: A place where two streets meet.
- **Why**: ROAD crosses ROAD = CROSSROADS
- **Choices**: roadwork, side road, crosswalk

## ID: man-overboard
- **Level**: medium
- **Pattern**: position
- **Visual**: MAN / BOARD
- **Answer**: man overboard
- **Also**: man over board
- **Hint**: Someone fell off the ship! Shout it!
- **Why**: MAN is OVER the BOARD = MAN OVERBOARD
- **Choices**: man on board, boatman, skateboard

## ID: inside
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: SIDE]
- **Answer**: inside
- **Also**: in side
- **Hint**: The opposite of outside.
- **Why**: SIDE is IN the box = INSIDE
- **Choices**: outside, sideways, inbox

## ID: outside
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box] | SIDE
- **Answer**: outside
- **Also**: out side
- **Hint**: Where you play in the fresh air.
- **Why**: SIDE is OUT of the box = OUTSIDE
- **Choices**: inside, sideways, offside

## ID: small-talk
- **Level**: medium
- **Pattern**: size
- **Visual**: talk (tiny)
- **Answer**: small talk
- **Also**: smalltalk, little talk
- **Hint**: Chatting about little things, like the weather.
- **Why**: The word TALK is SMALL = SMALL TALK
- **Choices**: whisper, chit chat, tiny voice

## ID: growing-up
- **Level**: medium
- **Pattern**: size
- **Visual**: GROWING (growing)
- **Answer**: growing up
- **Also**: grow up, growingup
- **Hint**: Getting older and taller.
- **Why**: GROWING goes UP and gets bigger = GROWING UP
- **Choices**: getting big, stand up, growing tall

## ID: broken-heart
- **Level**: medium
- **Pattern**: split
- **Visual**: HE (tilted) | ART (tilted)
- **Answer**: broken heart
- **Also**: heartbroken, heart broken
- **Hint**: How you feel when something very sad happens.
- **Why**: The word HEART is broken in two = BROKEN HEART
- **Choices**: heartbeat, half heart, sweetheart

## ID: sit-down
- **Level**: medium
- **Pattern**: position
- **Visual**: SIT (bottom)
- **Answer**: sit down
- **Also**: sitdown
- **Hint**: What the teacher says when it is time to start.
- **Why**: SIT is way DOWN low = SIT DOWN
- **Choices**: stand up, sit still, lie down

## ID: stand-up
- **Level**: medium
- **Pattern**: direction
- **Visual**: STAND (sideways)
- **Answer**: stand up
- **Also**: standup
- **Hint**: Get up from your chair!
- **Why**: STAND reads going UP = STAND UP
- **Choices**: sit down, stand still, wake up

## ID: go-for-it
- **Level**: medium
- **Pattern**: sound
- **Visual**: GO 4 IT
- **Answer**: go for it
- **Also**: go 4 it
- **Hint**: Do it! Try your best!
- **Why**: 4 sounds like FOR: GO 4 IT = GO FOR IT
- **Choices**: go get it, let it go, go four it

## ID: before
- **Level**: medium
- **Pattern**: sound
- **Visual**: B4
- **Answer**: before
- **Also**: b4
- **Hint**: The opposite of after.
- **Why**: B + 4 sounds like BE-FOUR = BEFORE
- **Choices**: bee, b four, behind

## ID: too-late
- **Level**: medium
- **Pattern**: sound
- **Visual**: 2 LATE
- **Answer**: too late
- **Also**: 2 late
- **Hint**: When you miss the bus by one minute.
- **Why**: 2 sounds like TOO: 2 LATE = TOO LATE
- **Choices**: two late, so late, late again

## ID: i-see-you
- **Level**: medium
- **Pattern**: sound
- **Visual**: I C U
- **Answer**: i see you
- **Also**: i see u, icu
- **Hint**: What you say when you play peekaboo!
- **Why**: C sounds like SEE and U sounds like YOU = I SEE YOU
- **Choices**: i spy, see you, eyes on you

## ID: tennis
- **Level**: medium
- **Pattern**: sound
- **Visual**: 10 S
- **Answer**: tennis
- **Hint**: A game with a racket, a ball and a net.
- **Why**: 10 + S = TEN-S = TENNIS!
- **Choices**: tens, ping pong, badminton

## ID: forgive
- **Level**: medium
- **Pattern**: sound
- **Visual**: 4 GIVE
- **Answer**: forgive
- **Also**: 4give
- **Hint**: To stop being angry when someone says sorry.
- **Why**: 4 sounds like FOR: 4 GIVE = FORGIVE
- **Choices**: four gifts, give up, for you

## ID: forever
- **Level**: medium
- **Pattern**: sound
- **Visual**: 4EVER
- **Answer**: forever
- **Also**: 4ever, for ever
- **Hint**: For all time, with no end.
- **Why**: 4 + EVER = FOREVER
- **Choices**: for now, every, four times

## ID: backwards
- **Level**: medium
- **Pattern**: typography
- **Visual**: BACKWARDS (backwards)
- **Answer**: backwards
- **Also**: backward
- **Hint**: Walking with your back in front.
- **Why**: BACKWARDS is written backwards!
- **Choices**: upside down, inside out, sideways

## ID: long-ago
- **Level**: medium
- **Pattern**: position
- **Visual**: A | [line] | GO
- **Answer**: long ago
- **Also**: longago
- **Hint**: A very, very long time before now.
- **Why**: A ……… GO with a LONG gap = LONG AGO
- **Choices**: long way, go away, a long road

## ID: lunchbox
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: LUNCH]
- **Answer**: lunchbox
- **Also**: lunch box
- **Hint**: You carry your food to school in it.
- **Why**: LUNCH is in a BOX = LUNCHBOX
- **Choices**: lunchtime, backpack, sandwich

## ID: leftovers
- **Level**: medium
- **Pattern**: position
- **Visual**: OVERS (left)
- **Answer**: leftovers
- **Also**: left overs, leftover
- **Hint**: The food you did not finish, saved for later.
- **Why**: OVERS is on the LEFT = LEFTOVERS
- **Choices**: left side, turnovers, go over

## ID: double-trouble
- **Level**: medium
- **Pattern**: quantity
- **Visual**: TROUBLE / TROUBLE
- **Answer**: double trouble
- **Hint**: Two times the problems!
- **Why**: TROUBLE two times = DOUBLE TROUBLE
- **Choices**: big trouble, two troubles, no trouble

## ID: shrinking
- **Level**: medium
- **Pattern**: size
- **Visual**: SHRINK (shrinking)
- **Answer**: shrinking
- **Also**: shrink, shrinks
- **Hint**: Getting smaller and smaller.
- **Why**: SHRINK gets smaller and smaller = SHRINKING
- **Choices**: growing, tiny, melting

## ID: bumpy-road
- **Level**: medium
- **Pattern**: typography
- **Visual**: ROAD (bumpy)
- **Answer**: bumpy road
- **Also**: bumpy ride
- **Hint**: A ride that shakes you up and down.
- **Why**: ROAD goes up, down, up, down = BUMPY ROAD
- **Choices**: crossroads, dirt road, rocky ride

## ID: scrambled-eggs
- **Level**: medium
- **Pattern**: typography
- **Visual**: EGGS (jumbled)
- **Answer**: scrambled eggs
- **Also**: scrambled egg
- **Hint**: A yummy breakfast made in a pan.
- **Why**: EGGS with the letters all mixed up = SCRAMBLED EGGS
- **Choices**: fried eggs, egg roll, mixed nuts

## ID: sunrise
- **Level**: medium
- **Pattern**: direction
- **Visual**: SUN (rising)
- **Answer**: sunrise
- **Also**: sun rise
- **Hint**: When the morning begins.
- **Why**: SUN is going up (RISE) = SUNRISE
- **Choices**: sunset, sunshine, morning star

## ID: sunset
- **Level**: medium
- **Pattern**: direction
- **Visual**: SUN (falling)
- **Answer**: sunset
- **Also**: sun set, sundown
- **Hint**: When the sky turns orange in the evening.
- **Why**: SUN is going down (SET) = SUNSET
- **Choices**: sunrise, moonrise, nighttime

## ID: side-by-side
- **Level**: medium
- **Pattern**: position
- **Visual**: SIDE | SIDE
- **Answer**: side by side
- **Hint**: Right next to each other.
- **Why**: SIDE is BY (next to) SIDE = SIDE BY SIDE
- **Choices**: two sides, sideways, inside out

## ID: over-and-over
- **Level**: medium
- **Pattern**: quantity
- **Visual**: OVER / OVER / OVER / OVER
- **Answer**: over and over
- **Also**: over and over again
- **Hint**: Again and again and again.
- **Why**: OVER and OVER and OVER = OVER AND OVER
- **Choices**: four times, game over, over there

## ID: ice-cream
- **Level**: medium
- **Pattern**: sound
- **Visual**: I SCREAM
- **Answer**: ice cream
- **Also**: icecream
- **Hint**: A cold, sweet treat in a cone. Say it out loud!
- **Why**: I SCREAM sounds like ICE CREAM!
- **Choices**: i shout, ice cube, scream

## ID: i-understand
- **Level**: tricky
- **Pattern**: position
- **Visual**: STAND / I
- **Answer**: i understand
- **Also**: understand
- **Hint**: What you say when you get it.
- **Why**: I is UNDER STAND = I UNDERSTAND
- **Choices**: i stand up, standing by, stand under

## ID: once-upon-a-time
- **Level**: tricky
- **Pattern**: position
- **Visual**: ONCE / A TIME
- **Answer**: once upon a time
- **Also**: once upon time
- **Hint**: How many fairy tales begin.
- **Why**: ONCE is UPON A TIME = ONCE UPON A TIME
- **Choices**: one more time, time after time, once a day

## ID: reading-between-the-lines
- **Level**: tricky
- **Pattern**: position
- **Visual**: [line] / READING / [line]
- **Answer**: reading between the lines
- **Also**: read between the lines, reading between lines
- **Hint**: Finding the secret meaning a story does not say out loud.
- **Why**: READING is BETWEEN THE LINES!
- **Choices**: reading a book, lined paper, line by line

## ID: three-blind-mice
- **Level**: tricky
- **Pattern**: missing
- **Visual**: M  CE / M  CE / M  CE
- **Answer**: three blind mice
- **Also**: 3 blind mice
- **Hint**: A nursery rhyme about little animals that cannot see.
- **Why**: Three MICE with no I (eye) = THREE BLIND MICE
- **Choices**: three little mice, missing letters, cheese thieves

## ID: paradise
- **Level**: tricky
- **Pattern**: sound
- **Visual**: DICE (tilted) | DICE (tilted)
- **Answer**: paradise
- **Also**: pair of dice, pairadice
- **Hint**: A perfect, happy place.
- **Why**: A PAIR of DICE sounds like PARADISE!
- **Choices**: double dice, dice game, lucky roll

## ID: forget-it
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: GET IT (x4)
- **Answer**: forget it
- **Also**: forgetit
- **Hint**: What you say when it does not matter anymore.
- **Why**: FOUR "GET IT"s = FOR-GET IT = FORGET IT
- **Choices**: get it all, forgot it, get it four

## ID: big-deal
- **Level**: tricky
- **Pattern**: size
- **Visual**: DEAL (big)
- **Answer**: big deal
- **Also**: bigdeal
- **Hint**: Something very important… or is it?
- **Why**: The word DEAL is BIG = BIG DEAL
- **Choices**: good deal, big cards, deal or no deal

## ID: jack-in-the-box
- **Level**: tricky
- **Pattern**: inside
- **Visual**: [box: JACK]
- **Answer**: jack in the box
- **Also**: jack in a box, jack-in-the-box
- **Hint**: A toy that pops up when you turn the handle.
- **Why**: JACK is IN THE BOX = JACK IN THE BOX
- **Choices**: toy box, jack box, surprise box

## ID: think-outside-the-box
- **Level**: tricky
- **Pattern**: inside
- **Visual**: [box] | THINK
- **Answer**: think outside the box
- **Also**: thinking outside the box, think out of the box
- **Hint**: Have a new, creative idea!
- **Why**: THINK is OUTSIDE THE BOX!
- **Choices**: think again, think inside, box idea

## ID: hand-in-hand
- **Level**: tricky
- **Pattern**: inside
- **Visual**: HA{HAND}ND
- **Answer**: hand in hand
- **Hint**: Holding each other’s hands as you walk.
- **Why**: HAND is IN HAND: HA[HAND]ND = HAND IN HAND
- **Choices**: handshake, two hands, high five

## ID: head-over-heels
- **Level**: tricky
- **Pattern**: position
- **Visual**: HEAD / HEELS
- **Answer**: head over heels
- **Hint**: Very, very happy… or in love!
- **Why**: HEAD is OVER HEELS = HEAD OVER HEELS
- **Choices**: heads up, upside down, high heels

## ID: pie-in-the-sky
- **Level**: tricky
- **Pattern**: inside
- **Visual**: SK{PIE}Y
- **Answer**: pie in the sky
- **Hint**: A wish that will probably never come true.
- **Why**: PIE is IN the SKY = PIE IN THE SKY
- **Choices**: apple pie, cloud cake, sky high

## ID: last-minute
- **Level**: tricky
- **Pattern**: position
- **Visual**: HOUR / HOUR / HOUR / MINUTE
- **Answer**: last minute
- **Also**: the last minute, at the last minute
- **Hint**: Just before it is too late!
- **Why**: MINUTE comes LAST = LAST MINUTE
- **Choices**: one minute, hourglass, first hour

## ID: tea-for-two
- **Level**: tricky
- **Pattern**: sound
- **Visual**: TEA 4 2
- **Answer**: tea for two
- **Also**: tea 4 2
- **Hint**: A tea party for a pair of friends.
- **Why**: 4 = FOR and 2 = TWO: TEA 4 2 = TEA FOR TWO
- **Choices**: tea party, forty two, two teas

## ID: see-you-later
- **Level**: tricky
- **Pattern**: sound
- **Visual**: C U L8R
- **Answer**: see you later
- **Also**: see ya later, see u later, cul8r
- **Hint**: What you say when you leave.
- **Why**: C = SEE, U = YOU, L8R = LATER: SEE YOU LATER
- **Choices**: call you later, see you soon, goodbye

## ID: ice-cube
- **Level**: tricky
- **Pattern**: math
- **Visual**: ICE^3
- **Answer**: ice cube
- **Also**: icecube, ice cubed
- **Hint**: A little frozen block in your drink.
- **Why**: The little 3 means CUBED in math: ICE CUBED = ICE CUBE!
- **Choices**: ice three, snowflake, ice cream

## ID: excellent
- **Level**: tricky
- **Pattern**: sound
- **Visual**: XLNT
- **Answer**: excellent
- **Hint**: Super, super good!
- **Why**: Say the letters: X-L-N-T = EXCELLENT!
- **Choices**: extra, extra large, next

## ID: split-second
- **Level**: tricky
- **Pattern**: split
- **Visual**: SEC (tilted) | OND (tilted)
- **Answer**: split second
- **Also**: splitsecond
- **Hint**: A super short moment.
- **Why**: The word SECOND is SPLIT = SPLIT SECOND
- **Choices**: second half, one second, split time

## ID: search-high-and-low
- **Level**: tricky
- **Pattern**: position
- **Visual**: SEARCH (top left) | SEARCH (bottom right)
- **Answer**: search high and low
- **Also**: high and low
- **Hint**: Look everywhere for something.
- **Why**: SEARCH is HIGH AND LOW = SEARCH HIGH AND LOW
- **Choices**: hide and seek, look around, search party

## ID: fish-out-of-water
- **Level**: tricky
- **Pattern**: inside
- **Visual**: [box: WATER] | FISH (top right)
- **Answer**: fish out of water
- **Also**: a fish out of water
- **Hint**: How you feel in a strange new place.
- **Why**: FISH is OUT OF the WATER!
- **Choices**: flying fish, fishbowl, swimming fish

## ID: breakfast
- **Level**: tricky
- **Pattern**: split
- **Visual**: FA (tilted) | ST (tilted)
- **Answer**: breakfast
- **Also**: break fast
- **Hint**: The first meal of the day.
- **Why**: FAST is broken (BREAK) = BREAK-FAST = BREAKFAST!
- **Choices**: fast food, lunch, broken plate

## ID: underground
- **Level**: easy
- **Pattern**: position
- **Visual**: [line] / GROUND
- **Answer**: underground
- **Also**: under ground
- **Hint**: Down below, where the moles and the subway trains are.
- **Why**: GROUND is UNDER the line = UNDERGROUND
- **Choices**: playground, background, ground floor

## ID: airport
- **Level**: easy
- **Pattern**: position
- **Visual**: AIR / PORT
- **Answer**: airport
- **Also**: air port
- **Hint**: Where airplanes take off and land.
- **Why**: AIR on top + PORT under it = AIRPORT
- **Choices**: airplane, seaport, passport

## ID: midday
- **Level**: medium
- **Pattern**: inside
- **Visual**: DAY surrounded by M-I-D
- **Answer**: midday
- **Also**: mid day, noon
- **Hint**: The middle of the day, when the sun is high.
- **Why**: DAY is in the middle of MID = MIDDAY
- **Choices**: daytime, sunday, birthday

## ID: backstage
- **Level**: medium
- **Pattern**: typography
- **Visual**: STAGE (backwards)
- **Answer**: backstage
- **Also**: back stage
- **Hint**: The secret place behind the stage at a show.
- **Why**: STAGE is written BACKwards = BACKSTAGE
- **Choices**: on stage, stage left, curtain call

## ID: sunflower
- **Level**: easy
- **Pattern**: position
- **Visual**: SUN / FLOWER
- **Answer**: sunflower
- **Also**: sun flower
- **Hint**: A tall yellow flower that turns to face the sun.
- **Why**: SUN shines over the FLOWER = SUNFLOWER
- **Choices**: sunshine, flowerpot, sunset

## ID: mind-over-matter
- **Level**: tricky
- **Pattern**: position
- **Visual**: MIND / MATTER
- **Answer**: mind over matter
- **Hint**: When your brain is stronger than the problem.
- **Why**: MIND is OVER MATTER = MIND OVER MATTER
- **Choices**: never mind, brain power, matter of fact

## ID: fortnight
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: NIGHT (x4)
- **Answer**: fortnight
- **Also**: four nights
- **Hint**: Two weeks. Say "four night" fast!
- **Why**: FOUR NIGHTs sounds like FORTNIGHT (that means two weeks)!
- **Choices**: goodnight, midnight, tonight

## ID: seven-days
- **Level**: easy
- **Pattern**: quantity
- **Visual**: DAY (x7)
- **Answer**: seven days
- **Also**: 7 days, a week, one week
- **Hint**: How long is one week?
- **Why**: Seven DAYs = SEVEN DAYS (one week)!
- **Choices**: weekend, daytime, every day

## ID: for-you
- **Level**: easy
- **Pattern**: sound
- **Visual**: 4 U
- **Answer**: for you
- **Also**: 4 u, four you
- **Hint**: What you say when you give someone a present.
- **Why**: 4 sounds like FOR and U sounds like YOU = FOR YOU
- **Choices**: thank you, four years, to you

## ID: i-owe-you
- **Level**: medium
- **Pattern**: sound
- **Visual**: I O U
- **Answer**: i owe you
- **Also**: iou, i owe u
- **Hint**: A promise to pay back later.
- **Why**: Say the letters: I-O-U = I OWE YOU
- **Choices**: i love you, oh you, i see you

## ID: easy
- **Level**: medium
- **Pattern**: sound
- **Visual**: EZ
- **Answer**: easy
- **Hint**: Not hard at all!
- **Why**: Say the letters: E-Z = EASY!
- **Choices**: zebra, crazy, lazy

## ID: energy
- **Level**: medium
- **Pattern**: sound
- **Visual**: NRG
- **Answer**: energy
- **Hint**: What you need to run and jump all day.
- **Why**: Say the letters: N-R-G = ENERGY!
- **Choices**: angry, engine, hungry

## ID: great
- **Level**: medium
- **Pattern**: sound
- **Visual**: GR8
- **Answer**: great
- **Also**: gr8
- **Hint**: Super good!
- **Why**: GR + 8 (EIGHT) = GREAT!
- **Choices**: grate, grapes, green

## ID: cutie
- **Level**: medium
- **Pattern**: sound
- **Visual**: QT
- **Answer**: cutie
- **Also**: cutey, qt
- **Hint**: Someone who is very cute.
- **Why**: Say the letters: Q-T = CUTIE!
- **Choices**: quiet, kitty, queen

## ID: anyone
- **Level**: medium
- **Pattern**: sound
- **Visual**: NE1
- **Answer**: anyone
- **Also**: any one, anybody
- **Hint**: "Does ___ want a cookie?"
- **Why**: N-E + 1 (ONE) = ANY-ONE = ANYONE!
- **Choices**: no one, everyone, someone

## ID: you-are-too-good
- **Level**: medium
- **Pattern**: sound
- **Visual**: U R 2 GOOD
- **Answer**: you are too good
- **Also**: you're too good, youre too good, u r 2 good
- **Hint**: What you say to a friend who always wins!
- **Why**: U = YOU, R = ARE, 2 = TOO: YOU ARE TOO GOOD
- **Choices**: you are so good, two good, good for you

## ID: oh-i-see
- **Level**: medium
- **Pattern**: sound
- **Visual**: O I C
- **Answer**: oh i see
- **Also**: o i see, oic
- **Hint**: What you say when you finally understand.
- **Why**: O = OH, I = I, C = SEE: OH I SEE
- **Choices**: i see you, oh no, ice

## ID: top-secret
- **Level**: medium
- **Pattern**: position
- **Visual**: SECRET (top)
- **Answer**: top secret
- **Also**: topsecret
- **Hint**: Something nobody else is allowed to know!
- **Why**: SECRET is at the TOP = TOP SECRET
- **Choices**: big secret, secret code, high secret

## ID: high-five
- **Level**: easy
- **Pattern**: position
- **Visual**: FIVE (top)
- **Answer**: high five
- **Also**: high 5, highfive
- **Hint**: Slap hands up in the air when you win!
- **Why**: FIVE is way up HIGH = HIGH FIVE
- **Choices**: give me five, top five, five fingers

## ID: highway
- **Level**: medium
- **Pattern**: position
- **Visual**: WAY (top)
- **Answer**: highway
- **Also**: high way
- **Hint**: A big, fast road for cars.
- **Why**: WAY is up HIGH = HIGHWAY
- **Choices**: subway, top way, hallway

## ID: high-school
- **Level**: medium
- **Pattern**: position
- **Visual**: SCHOOL (top)
- **Answer**: high school
- **Also**: highschool
- **Hint**: The school big kids go to after middle school.
- **Why**: SCHOOL is way up HIGH = HIGH SCHOOL
- **Choices**: top school, school bus, schoolyard

## ID: upstairs
- **Level**: easy
- **Pattern**: position
- **Visual**: STAIRS (top)
- **Answer**: upstairs
- **Also**: up stairs, up the stairs
- **Hint**: Where your bedroom might be.
- **Why**: STAIRS is UP at the top = UPSTAIRS
- **Choices**: downstairs, staircase, top step

## ID: downstairs
- **Level**: easy
- **Pattern**: position
- **Visual**: STAIRS (bottom)
- **Answer**: downstairs
- **Also**: down stairs, down the stairs
- **Hint**: Go down here for breakfast in the kitchen.
- **Why**: STAIRS is DOWN at the bottom = DOWNSTAIRS
- **Choices**: upstairs, staircase, bottom step

## ID: downhill
- **Level**: medium
- **Pattern**: position
- **Visual**: HILL (bottom)
- **Answer**: downhill
- **Also**: down hill, down the hill
- **Hint**: The fun way to ride your bike: wheee!
- **Why**: HILL is DOWN at the bottom = DOWNHILL
- **Choices**: uphill, hilltop, ant hill

## ID: underwear
- **Level**: easy
- **Pattern**: position
- **Visual**: [line] / WEAR
- **Answer**: underwear
- **Also**: under wear
- **Hint**: You wear it under your clothes. Hee hee!
- **Why**: WEAR is UNDER the line = UNDERWEAR
- **Choices**: sweater, raincoat, swimwear

## ID: underdog
- **Level**: tricky
- **Pattern**: position
- **Visual**: [line] / DOG
- **Answer**: underdog
- **Also**: under dog
- **Hint**: The player everyone thinks will lose… but might win!
- **Why**: DOG is UNDER the line = UNDERDOG
- **Choices**: hot dog, puppy, top dog

## ID: undercover-agent
- **Level**: tricky
- **Pattern**: position
- **Visual**: COVER / AGENT
- **Answer**: undercover agent
- **Also**: undercover, under cover agent, secret agent
- **Hint**: A spy who hides who they really are.
- **Why**: AGENT is UNDER COVER = UNDERCOVER AGENT
- **Choices**: cover story, book cover, police officer

## ID: youre-under-arrest
- **Level**: tricky
- **Pattern**: position
- **Visual**: ARREST / YOU'RE
- **Answer**: you're under arrest
- **Also**: youre under arrest, you are under arrest
- **Hint**: What the police say when they catch the bad guy.
- **Why**: YOU'RE is UNDER ARREST = YOU'RE UNDER ARREST
- **Choices**: stop right there, you are free, rest your arms

## ID: all-over-the-world
- **Level**: tricky
- **Pattern**: position
- **Visual**: ALL / WORLD
- **Answer**: all over the world
- **Also**: all around the world, over the world
- **Hint**: In every country, everywhere!
- **Why**: ALL is OVER THE WORLD = ALL OVER THE WORLD
- **Choices**: world map, whole world, around the block

## ID: travel-overseas
- **Level**: tricky
- **Pattern**: sound
- **Visual**: TRAVEL / C C C C C C
- **Answer**: travel overseas
- **Also**: travel over seas, traveling overseas
- **Hint**: Going to a faraway country by plane or ship. The C's sound like something…
- **Why**: TRAVEL is OVER the C's (SEAS) = TRAVEL OVERSEAS
- **Choices**: see the world, sea travel, cc travel

## ID: history-repeats-itself
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: HISTORY / HISTORY / HISTORY
- **Answer**: history repeats itself
- **Also**: history repeats
- **Hint**: Things that happened before happen again.
- **Why**: HISTORY again and again = HISTORY REPEATS ITSELF
- **Choices**: history class, old stories, three histories

## ID: one-in-a-million
- **Level**: tricky
- **Pattern**: inside
- **Visual**: MIL{1}LION
- **Answer**: one in a million
- **Also**: 1 in a million, one in million
- **Hint**: Super special. There's nobody like you!
- **Why**: ONE (1) is IN A MILLION = ONE IN A MILLION
- **Choices**: a million dollars, number one, one million

## ID: two-peas-in-a-pod
- **Level**: tricky
- **Pattern**: inside
- **Visual**: P{PEAS PEAS}OD
- **Answer**: two peas in a pod
- **Also**: 2 peas in a pod, peas in a pod
- **Hint**: Two friends who are very alike.
- **Why**: Two PEAS IN A POD = TWO PEAS IN A POD
- **Choices**: green beans, pea soup, two of a kind

## ID: cloud-nine
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: CLOUD (x9)
- **Answer**: cloud nine
- **Also**: on cloud nine, cloud 9, on cloud 9
- **Hint**: Where you are when you feel super, super happy.
- **Why**: Nine CLOUDs = (on) CLOUD NINE!
- **Choices**: rainy day, sky high, nine lives

## ID: seven-seas
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: SEA (x7)
- **Answer**: seven seas
- **Also**: the seven seas, 7 seas
- **Hint**: Pirates sail across all of these!
- **Why**: Seven SEAs = THE SEVEN SEAS
- **Choices**: deep blue sea, sea shells, ocean waves

## ID: step-by-step
- **Level**: medium
- **Pattern**: position
- **Visual**: STEP | STEP
- **Answer**: step by step
- **Also**: step-by-step
- **Hint**: Slowly, one little part at a time.
- **Why**: STEP is BY (next to) STEP = STEP BY STEP
- **Choices**: two steps, staircase, side by side

## ID: back-to-back
- **Level**: medium
- **Pattern**: typography
- **Visual**: BACK | BACK (backwards)
- **Answer**: back to back
- **Also**: back-to-back
- **Hint**: Standing with your backs touching.
- **Why**: BACK and KCAB face away from each other = BACK TO BACK
- **Choices**: backpack, come back, face to face

## ID: face-to-face
- **Level**: medium
- **Pattern**: typography
- **Visual**: FACE | FACE (backwards)
- **Answer**: face to face
- **Also**: face-to-face
- **Hint**: Looking right at each other.
- **Why**: FACE and ECAF look at each other = FACE TO FACE
- **Choices**: back to back, two faces, funny face

## ID: afternoon
- **Level**: medium
- **Pattern**: position
- **Visual**: NOON | AFTER
- **Answer**: afternoon
- **Also**: after noon
- **Hint**: The time after lunch and before dinner.
- **Why**: AFTER comes after NOON = AFTERNOON
- **Choices**: midnight, morning, noon time

## ID: backspace
- **Level**: medium
- **Pattern**: typography
- **Visual**: SPACE (backwards)
- **Answer**: backspace
- **Also**: back space
- **Hint**: The key you press to erase a letter.
- **Why**: SPACE is written BACKwards = BACKSPACE
- **Choices**: outer space, space bar, delete

## ID: backyard
- **Level**: medium
- **Pattern**: typography
- **Visual**: YARD (backwards)
- **Answer**: backyard
- **Also**: back yard
- **Hint**: The grassy place behind your house.
- **Why**: YARD is written BACKwards = BACKYARD
- **Choices**: front yard, garden, playground

## ID: talk-back
- **Level**: medium
- **Pattern**: typography
- **Visual**: TALK (backwards)
- **Answer**: talk back
- **Also**: talkback, talking back
- **Hint**: Answering a grown-up in a rude way. Oops!
- **Why**: TALK is written BACKwards = TALK BACK
- **Choices**: small talk, walk back, talk show

## ID: feeling-under-the-weather
- **Level**: tricky
- **Pattern**: position
- **Visual**: WEATHER / FEELING
- **Answer**: feeling under the weather
- **Also**: under the weather
- **Hint**: When you feel a little sick.
- **Why**: FEELING is UNDER the WEATHER = FEELING UNDER THE WEATHER
- **Choices**: rainy day, bad weather, feeling blue

## ID: cow-jumped-over-the-moon
- **Level**: tricky
- **Pattern**: position
- **Visual**: COW / MOON
- **Answer**: the cow jumped over the moon
- **Also**: cow jumped over the moon, cow over the moon
- **Hint**: From the rhyme "Hey Diddle Diddle"!
- **Why**: The COW is OVER THE MOON = THE COW JUMPED OVER THE MOON
- **Choices**: moon cow, milky way, cow in space

## ID: on-top-of-the-world
- **Level**: tricky
- **Pattern**: position
- **Visual**: ME / WORLD
- **Answer**: on top of the world
- **Also**: top of the world
- **Hint**: How you feel when everything goes great!
- **Why**: ME is ON TOP OF THE WORLD
- **Choices**: all over the world, around the world, world map

## ID: foot-in-the-door
- **Level**: tricky
- **Pattern**: inside
- **Visual**: DO{FOOT}OR
- **Answer**: foot in the door
- **Also**: a foot in the door
- **Hint**: A first small step to get started.
- **Why**: FOOT is IN THE DOOR = FOOT IN THE DOOR
- **Choices**: door mat, front door, footstep

## ID: hole-in-one
- **Level**: tricky
- **Pattern**: inside
- **Visual**: HO{1}LE
- **Answer**: hole in one
- **Also**: a hole in one, hole in 1
- **Hint**: The best shot in golf!
- **Why**: ONE (1) is IN the HOLE = HOLE IN ONE
- **Choices**: golf ball, one hole, mini golf

## ID: head-in-the-clouds
- **Level**: tricky
- **Pattern**: inside
- **Visual**: CLO{HEAD}UDS
- **Answer**: head in the clouds
- **Also**: your head in the clouds
- **Hint**: Daydreaming and not paying attention.
- **Why**: HEAD is IN THE CLOUDS = HEAD IN THE CLOUDS
- **Choices**: cloudy day, head over heels, sky high

## ID: ants-in-your-pants
- **Level**: tricky
- **Pattern**: inside
- **Visual**: PA{ANTS}NTS
- **Answer**: ants in your pants
- **Also**: ants in my pants, ants in his pants, ants in the pants
- **Hint**: When you just can't sit still! Hee hee.
- **Why**: ANTS are IN the PANTS = ANTS IN YOUR PANTS
- **Choices**: picnic ants, pants on fire, ant hill

## ID: lost-in-space
- **Level**: medium
- **Pattern**: inside
- **Visual**: S P A {LOST} C E
- **Answer**: lost in space
- **Also**: lost in outer space
- **Hint**: An astronaut who can't find the way home.
- **Why**: LOST is IN S P A C E = LOST IN SPACE
- **Choices**: outer space, spaceship, space race

## ID: man-in-the-moon
- **Level**: tricky
- **Pattern**: inside
- **Visual**: MO{MAN}ON
- **Answer**: man in the moon
- **Also**: the man in the moon
- **Hint**: Some people see a face up there at night.
- **Why**: MAN is IN THE MOON = MAN IN THE MOON
- **Choices**: moonwalk, half moon, moonlight

## ID: sleeping-in
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: SLEEPING]
- **Answer**: sleeping in
- **Also**: sleep in, sleepin
- **Hint**: Staying in bed late on a holiday morning.
- **Why**: SLEEPING is IN the box = SLEEPING IN
- **Choices**: sleepover, bedtime, nap time

## ID: boxing
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: ING]
- **Answer**: boxing
- **Also**: box ing
- **Hint**: A sport with big puffy gloves.
- **Why**: A BOX with ING = BOX-ING = BOXING
- **Choices**: wrestling, gift box, karate

## ID: once-in-a-while
- **Level**: tricky
- **Pattern**: inside
- **Visual**: WH{ONCE}ILE
- **Answer**: once in a while
- **Also**: every once in a while
- **Hint**: Not often, just sometimes.
- **Why**: ONCE is IN A WHILE = ONCE IN A WHILE
- **Choices**: all the time, once upon a time, a little while

## ID: keep-in-touch
- **Level**: tricky
- **Pattern**: inside
- **Visual**: TO{KEEP}UCH
- **Answer**: keep in touch
- **Also**: stay in touch
- **Hint**: What you say to a friend who moves away.
- **Why**: KEEP is IN TOUCH = KEEP IN TOUCH
- **Choices**: touch down, keep out, hold on

## ID: fish-in-the-sea
- **Level**: tricky
- **Pattern**: inside
- **Visual**: S{FISH}EA
- **Answer**: fish in the sea
- **Also**: plenty of fish in the sea, a fish in the sea
- **Hint**: Where the fish swim, under the waves.
- **Why**: FISH is IN THE SEA = FISH IN THE SEA
- **Choices**: seafood, fish tank, sea shell

## ID: cat-in-the-hat
- **Level**: tricky
- **Pattern**: inside
- **Visual**: H{CAT}AT
- **Answer**: the cat in the hat
- **Also**: cat in the hat
- **Hint**: A famous storybook cat with a tall striped hat.
- **Why**: CAT is IN THE HAT = THE CAT IN THE HAT
- **Choices**: top hat, cool cat, magic hat

## ID: mouse-in-the-house
- **Level**: medium
- **Pattern**: inside
- **Visual**: HO{MOUSE}USE
- **Answer**: mouse in the house
- **Also**: a mouse in the house
- **Hint**: Eek! Something tiny is running in the kitchen!
- **Why**: MOUSE is IN THE HOUSE = MOUSE IN THE HOUSE
- **Choices**: mouse trap, dollhouse, house cat

## ID: time-out
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box] | TIME
- **Answer**: time out
- **Also**: timeout
- **Hint**: A short break in a game.
- **Why**: TIME is OUT of the box = TIME OUT
- **Choices**: time's up, halftime, break time

## ID: left-out
- **Level**: medium
- **Pattern**: position
- **Visual**: OUT (left)
- **Answer**: left out
- **Also**: feeling left out
- **Hint**: How you feel when nobody asks you to play.
- **Why**: OUT is on the LEFT = LEFT OUT
- **Choices**: way out, left turn, keep out

## ID: low-battery
- **Level**: medium
- **Pattern**: position
- **Visual**: BATTERY (bottom)
- **Answer**: low battery
- **Also**: battery low
- **Hint**: Your tablet needs charging soon!
- **Why**: BATTERY is way down LOW = LOW BATTERY
- **Choices**: dead battery, full battery, charger

## ID: high-heels
- **Level**: medium
- **Pattern**: position
- **Visual**: HEELS (top)
- **Answer**: high heels
- **Also**: high heel
- **Hint**: Fancy shoes that make you taller.
- **Why**: HEELS are way up HIGH = HIGH HEELS
- **Choices**: head over heels, sneakers, boots

## ID: left-behind
- **Level**: medium
- **Pattern**: position
- **Visual**: BEHIND (left)
- **Answer**: left behind
- **Hint**: When everyone goes and you're still here.
- **Why**: BEHIND is on the LEFT = LEFT BEHIND
- **Choices**: behind you, left side, fall behind

## ID: right-on-time
- **Level**: tricky
- **Pattern**: position
- **Visual**: TIME (right)
- **Answer**: right on time
- **Also**: on time
- **Hint**: Not early, not late!
- **Why**: TIME is on the RIGHT = RIGHT ON TIME
- **Choices**: just in time, last minute, right now

## ID: right-angle
- **Level**: medium
- **Pattern**: position
- **Visual**: ANGLE (right)
- **Answer**: right angle
- **Hint**: The square corner of a box. It is 90 degrees.
- **Why**: ANGLE is on the RIGHT = RIGHT ANGLE
- **Choices**: triangle, corner, angel

## ID: bottom-line
- **Level**: medium
- **Pattern**: position
- **Visual**: LINE (bottom)
- **Answer**: bottom line
- **Also**: the bottom line
- **Hint**: The most important part, said short.
- **Why**: LINE is at the BOTTOM = BOTTOM LINE
- **Choices**: finish line, under line, line up

## ID: top-hat
- **Level**: easy
- **Pattern**: position
- **Visual**: HAT (top)
- **Answer**: top hat
- **Also**: tophat
- **Hint**: A tall hat a magician wears.
- **Why**: HAT is at the TOP = TOP HAT
- **Choices**: sun hat, high hat, cowboy hat

## ID: high-jump
- **Level**: medium
- **Pattern**: position
- **Visual**: JUMP (top)
- **Answer**: high jump
- **Also**: highjump
- **Hint**: A sport where you leap over a tall bar.
- **Why**: JUMP is way up HIGH = HIGH JUMP
- **Choices**: long jump, jump rope, trampoline

## ID: uphill
- **Level**: easy
- **Pattern**: position
- **Visual**: HILL (top)
- **Answer**: uphill
- **Also**: up hill, up the hill
- **Hint**: Pedaling your bike this way is hard work!
- **Why**: HILL is UP at the top = UPHILL
- **Choices**: downhill, hilltop, ant hill

## ID: all-right
- **Level**: medium
- **Pattern**: position
- **Visual**: ALL (right)
- **Answer**: all right
- **Also**: alright
- **Hint**: "Are you OK?" "Yes, I'm ___!"
- **Why**: ALL is on the RIGHT = ALL RIGHT
- **Choices**: all done, right now, all together

## ID: on-the-right-track
- **Level**: tricky
- **Pattern**: position
- **Visual**: TRACK (right)
- **Answer**: on the right track
- **Also**: right track
- **Hint**: You're doing it the correct way. Keep going!
- **Why**: TRACK is on the RIGHT = ON THE RIGHT TRACK
- **Choices**: race track, train track, off track

## ID: far-away
- **Level**: medium
- **Pattern**: position
- **Visual**: AWAY (bottom right, tiny)
- **Answer**: far away
- **Also**: faraway
- **Hint**: A place that is very, very distant.
- **Why**: AWAY is tiny and FAR in the corner = FAR AWAY
- **Choices**: go away, right away, far out

## ID: four-corners
- **Level**: medium
- **Pattern**: position
- **Visual**: CORNER (top left) | CORNER (top right) | CORNER (bottom left) | CORNER (bottom right)
- **Answer**: four corners
- **Also**: 4 corners
- **Hint**: A game where you run to one side of the room.
- **Why**: CORNER in all FOUR CORNERS = FOUR CORNERS
- **Choices**: corner shop, square, four sides

## ID: around-the-clock
- **Level**: tricky
- **Pattern**: position
- **Visual**: 12 / 9 | CLOCK | 3 / 6
- **Answer**: around the clock
- **Also**: round the clock, all around the clock
- **Hint**: Working all day and all night.
- **Why**: The numbers go AROUND THE CLOCK!
- **Choices**: alarm clock, o'clock, tick tock

## ID: countdown
- **Level**: medium
- **Pattern**: typography
- **Visual**: 10  9  8  7  6  5  4  3  2  1
- **Answer**: countdown
- **Also**: count down
- **Hint**: What you shout before a rocket blasts off!
- **Why**: Counting DOWN from 10 to 1 = COUNTDOWN
- **Choices**: count to ten, blast off, numbers

## ID: slow-down
- **Level**: medium
- **Pattern**: direction
- **Visual**: SLOW (vertical)
- **Answer**: slow down
- **Hint**: What a grown-up says when you run too fast.
- **Why**: SLOW goes DOWN = SLOW DOWN
- **Choices**: speed up, slow motion, sit down

## ID: look-up
- **Level**: medium
- **Pattern**: direction
- **Visual**: LOOK (sideways)
- **Answer**: look up
- **Also**: look up high
- **Hint**: What to do to see the stars.
- **Why**: LOOK reads going UP = LOOK UP
- **Choices**: look down, look out, stand up

## ID: cheer-up
- **Level**: medium
- **Pattern**: direction
- **Visual**: CHEER (rising)
- **Answer**: cheer up
- **Hint**: What you say to a friend who feels sad.
- **Why**: CHEER goes UP = CHEER UP
- **Choices**: cheerleader, cheers, give up

## ID: falling-star
- **Level**: medium
- **Pattern**: direction
- **Visual**: STAR (falling)
- **Answer**: falling star
- **Also**: shooting star
- **Hint**: Make a wish when you see one at night!
- **Why**: STAR is FALLING = FALLING STAR
- **Choices**: starfish, star light, sunset

## ID: go-back
- **Level**: easy
- **Pattern**: typography
- **Visual**: GO (backwards)
- **Answer**: go back
- **Hint**: Turn around and return.
- **Why**: GO is written BACKwards = GO BACK
- **Choices**: go away, come back, go on

## ID: upside-down-cake
- **Level**: medium
- **Pattern**: typography
- **Visual**: CAKE (upside down)
- **Answer**: upside down cake
- **Also**: upside-down cake, pineapple upside down cake
- **Hint**: A cake you flip over, often with pineapple on top.
- **Why**: CAKE is UPSIDE DOWN = UPSIDE DOWN CAKE
- **Choices**: cupcake, cake pop, birthday cake

## ID: falling-leaves
- **Level**: medium
- **Pattern**: direction
- **Visual**: LEAVES (falling)
- **Answer**: falling leaves
- **Also**: fall leaves, leaves falling
- **Hint**: What you see in autumn under the trees.
- **Why**: LEAVES are FALLING = FALLING LEAVES
- **Choices**: tree house, leaf pile, autumn

## ID: snowfall
- **Level**: medium
- **Pattern**: direction
- **Visual**: SNOW (falling)
- **Answer**: snowfall
- **Also**: snow fall, falling snow
- **Hint**: When winter flakes come down from the sky.
- **Why**: SNOW is FALLING = SNOWFALL
- **Choices**: snowman, snowball, snow day

## ID: growing-pains
- **Level**: tricky
- **Pattern**: size
- **Visual**: PAINS (growing)
- **Answer**: growing pains
- **Also**: growing pain
- **Hint**: Achy legs some kids get when they get taller.
- **Why**: PAINS are GROWING = GROWING PAINS
- **Choices**: growing up, tummy ache, big pain

## ID: big-mouth
- **Level**: easy
- **Pattern**: size
- **Visual**: MOUTH (big)
- **Answer**: big mouth
- **Also**: bigmouth
- **Hint**: Someone who can't keep a secret!
- **Why**: MOUTH is BIG = BIG MOUTH
- **Choices**: loud mouth, big smile, big teeth

## ID: bigfoot
- **Level**: easy
- **Pattern**: size
- **Visual**: FOOT (big)
- **Answer**: bigfoot
- **Also**: big foot
- **Hint**: A hairy, mysterious giant in the forest.
- **Why**: FOOT is BIG = BIGFOOT
- **Choices**: football, footprint, giant

## ID: little-mermaid
- **Level**: medium
- **Pattern**: size
- **Visual**: mermaid (tiny)
- **Answer**: the little mermaid
- **Also**: little mermaid
- **Hint**: A princess who lives under the sea and wants legs.
- **Why**: MERMAID is LITTLE = THE LITTLE MERMAID
- **Choices**: sea princess, starfish, big fish

## ID: big-bang
- **Level**: medium
- **Pattern**: size
- **Visual**: BANG (big)
- **Answer**: big bang
- **Also**: the big bang
- **Hint**: How some scientists say the universe began.
- **Why**: BANG is BIG = BIG BANG
- **Choices**: fireworks, loud noise, bang bang

## ID: small-world
- **Level**: medium
- **Pattern**: size
- **Visual**: world (tiny)
- **Answer**: small world
- **Also**: it's a small world, its a small world
- **Hint**: "You know her too? It's a ___!"
- **Why**: WORLD is SMALL = (IT'S A) SMALL WORLD
- **Choices**: world map, big world, little world

## ID: big-apple
- **Level**: tricky
- **Pattern**: size
- **Visual**: APPLE (big)
- **Answer**: the big apple
- **Also**: big apple
- **Hint**: A nickname for New York City.
- **Why**: APPLE is BIG = THE BIG APPLE
- **Choices**: apple pie, red apple, pineapple

## ID: little-bit
- **Level**: easy
- **Pattern**: size
- **Visual**: bit (tiny)
- **Answer**: a little bit
- **Also**: little bit
- **Hint**: Just a tiny amount.
- **Why**: BIT is LITTLE = A LITTLE BIT
- **Choices**: a lot, big bite, bit by bit

## ID: short-story
- **Level**: medium
- **Pattern**: size
- **Visual**: STORY (small)
- **Answer**: short story
- **Also**: a short story
- **Hint**: A tale you can read in one sitting.
- **Why**: STORY is SHORT = SHORT STORY
- **Choices**: story time, tall tale, storybook

## ID: long-time
- **Level**: medium
- **Pattern**: size
- **Visual**: TIME (stretched)
- **Answer**: long time
- **Also**: a long time, long time no see
- **Hint**: When you haven't seen a friend for ages!
- **Why**: TIME is stretched LONG = A LONG TIME
- **Choices**: last minute, time out, short time

## ID: big-brother
- **Level**: easy
- **Pattern**: size
- **Visual**: BROTHER (big)
- **Answer**: big brother
- **Also**: older brother
- **Hint**: An older boy in your family.
- **Why**: BROTHER is BIG = BIG BROTHER
- **Choices**: little brother, sister, twin

## ID: little-sister
- **Level**: easy
- **Pattern**: size
- **Visual**: sister (tiny)
- **Answer**: little sister
- **Also**: younger sister, baby sister
- **Hint**: A younger girl in your family.
- **Why**: SISTER is LITTLE = LITTLE SISTER
- **Choices**: big sister, brother, cousin

## ID: think-big
- **Level**: medium
- **Pattern**: size
- **Visual**: THINK (big)
- **Answer**: think big
- **Hint**: Dream about something huge and amazing!
- **Why**: THINK is BIG = THINK BIG
- **Choices**: think twice, big idea, think again

## ID: shortcut
- **Level**: medium
- **Pattern**: size
- **Visual**: CUT (small)
- **Answer**: shortcut
- **Also**: short cut
- **Hint**: A quicker way to get there.
- **Why**: CUT is SHORT = SHORTCUT
- **Choices**: haircut, cut out, long way

## ID: long-jump
- **Level**: medium
- **Pattern**: size
- **Visual**: JUMP (stretched)
- **Answer**: long jump
- **Also**: longjump
- **Hint**: A sport where you run and leap far into sand.
- **Why**: JUMP is stretched LONG = LONG JUMP
- **Choices**: high jump, jump rope, hopscotch

## ID: wide-awake
- **Level**: medium
- **Pattern**: size
- **Visual**: AWAKE (stretched)
- **Answer**: wide awake
- **Hint**: When you can't fall asleep at all!
- **Why**: AWAKE is stretched WIDE = WIDE AWAKE
- **Choices**: fast asleep, wake up, good morning

## ID: wide-open
- **Level**: medium
- **Pattern**: size
- **Visual**: OPEN (stretched)
- **Answer**: wide open
- **Also**: open wide
- **Hint**: What the dentist says: "Open ___!"
- **Why**: OPEN is stretched WIDE = WIDE OPEN
- **Choices**: open door, closed, open up

## ID: two-left-feet
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: FEET (left, x2)
- **Answer**: two left feet
- **Also**: 2 left feet
- **Hint**: Someone who can't dance well. Oops!
- **Why**: Two FEET on the LEFT = TWO LEFT FEET
- **Choices**: big feet, tiptoe, dance shoes

## ID: three-little-pigs
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: pig (tiny) | pig (tiny) | pig (tiny)
- **Answer**: three little pigs
- **Also**: the three little pigs, 3 little pigs
- **Hint**: They built houses of straw, sticks and bricks.
- **Why**: Three LITTLE PIGs = THREE LITTLE PIGS
- **Choices**: piggy bank, three bears, farm animals

## ID: two-heads-better
- **Level**: tricky
- **Pattern**: math
- **Visual**: HEAD HEAD > HEAD
- **Answer**: two heads are better than one
- **Also**: two heads better than one
- **Hint**: Working together is smarter than working alone.
- **Why**: Two HEADs are bigger (>) than one HEAD!
- **Choices**: head to head, heads up, use your head

## ID: four-seasons
- **Level**: medium
- **Pattern**: quantity
- **Visual**: SEASON (x4)
- **Answer**: four seasons
- **Also**: the four seasons, 4 seasons
- **Hint**: Spring, summer, fall and winter.
- **Why**: Four SEASONs = FOUR SEASONS
- **Choices**: rainy season, all year, four weeks

## ID: seven-dwarfs
- **Level**: medium
- **Pattern**: quantity
- **Visual**: DWARF (x7)
- **Answer**: seven dwarfs
- **Also**: the seven dwarfs, 7 dwarfs
- **Hint**: Snow White's little friends.
- **Why**: Seven DWARFs = THE SEVEN DWARFS
- **Choices**: seven days, three bears, small friends

## ID: twelve-months
- **Level**: medium
- **Pattern**: quantity
- **Visual**: MONTH (x12)
- **Answer**: twelve months
- **Also**: 12 months, one year, a year
- **Hint**: January to December.
- **Why**: Twelve MONTHs = TWELVE MONTHS (one year)
- **Choices**: one month, calendar, twelve days

## ID: nine-lives
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: LIFE (x9)
- **Answer**: nine lives
- **Also**: 9 lives, a cat has nine lives
- **Hint**: People say a cat has this many.
- **Why**: Nine LIVES = NINE LIVES
- **Choices**: cloud nine, cat nap, long life

## ID: double-cheeseburger
- **Level**: medium
- **Pattern**: quantity
- **Visual**: CHEESEBURGER / CHEESEBURGER
- **Answer**: double cheeseburger
- **Also**: double cheese burger
- **Hint**: A burger with two patties. Yum!
- **Why**: Two CHEESEBURGERs = DOUBLE CHEESEBURGER
- **Choices**: hot dog, big burger, cheese pizza

## ID: a-dozen-eggs
- **Level**: medium
- **Pattern**: quantity
- **Visual**: EGG (x12)
- **Answer**: a dozen eggs
- **Also**: dozen eggs, twelve eggs, 12 eggs
- **Hint**: What comes in a carton from the store.
- **Why**: Twelve EGGs = A DOZEN EGGS
- **Choices**: egg hunt, scrambled eggs, bird nest

## ID: pair-of-socks
- **Level**: easy
- **Pattern**: quantity
- **Visual**: SOCK | SOCK
- **Answer**: pair of socks
- **Also**: a pair of socks, two socks
- **Hint**: You wear them on your feet, one on each.
- **Why**: Two SOCKs = A PAIR OF SOCKS
- **Choices**: stinky socks, shoes, mittens

## ID: think-twice
- **Level**: medium
- **Pattern**: quantity
- **Visual**: THINK | THINK
- **Answer**: think twice
- **Hint**: Be careful before you decide!
- **Why**: THINK two times = THINK TWICE
- **Choices**: think big, think again, double trouble

## ID: again-and-again
- **Level**: medium
- **Pattern**: quantity
- **Visual**: AGAIN (x4)
- **Answer**: again and again
- **Hint**: Doing something many, many times.
- **Why**: AGAIN, AGAIN, AGAIN… = AGAIN AND AGAIN
- **Choices**: one more time, try again, never again

## ID: envy
- **Level**: medium
- **Pattern**: sound
- **Visual**: NV
- **Answer**: envy
- **Hint**: Wishing you had what someone else has.
- **Why**: Say the letters: N-V = ENVY
- **Choices**: navy, nervous, ivy

## ID: enemy
- **Level**: medium
- **Pattern**: sound
- **Visual**: NME
- **Answer**: enemy
- **Hint**: The opposite of a friend.
- **Why**: Say the letters: N-M-E = ENEMY
- **Choices**: army, any me, energy

## ID: icy
- **Level**: medium
- **Pattern**: sound
- **Visual**: IC
- **Answer**: icy
- **Hint**: Slippery and frozen, like a winter road.
- **Why**: Say the letters: I-C = ICY
- **Choices**: ice cube, I see, icicle

## ID: extra-large
- **Level**: medium
- **Pattern**: sound
- **Visual**: XL
- **Answer**: extra large
- **Also**: extra-large
- **Hint**: The biggest T-shirt size.
- **Why**: XL is short for EXTRA LARGE!
- **Choices**: excellent, x-ray, small

## ID: essay
- **Level**: tricky
- **Pattern**: sound
- **Visual**: SA
- **Answer**: essay
- **Hint**: A piece of writing you do for school.
- **Why**: Say the letters: S-A = ESSAY
- **Choices**: say, easy, essay test

## ID: ivy
- **Level**: medium
- **Pattern**: sound
- **Visual**: IV
- **Answer**: ivy
- **Hint**: A green plant that climbs up walls.
- **Why**: Say the letters: I-V = IVY
- **Choices**: four, envy, vine

## ID: tepee
- **Level**: medium
- **Pattern**: sound
- **Visual**: TP
- **Answer**: tepee
- **Also**: teepee, tipi
- **Hint**: A cone-shaped tent.
- **Why**: Say the letters: T-P = TEPEE
- **Choices**: toilet paper, tent, tape

## ID: wait-for-me
- **Level**: medium
- **Pattern**: sound
- **Visual**: W8 4 ME
- **Answer**: wait for me
- **Also**: w8 4 me
- **Hint**: What you shout when your friends walk too fast!
- **Why**: W8 = WAIT, 4 = FOR: WAIT FOR ME
- **Choices**: weight for me, wait a minute, come here

## ID: see-you-soon
- **Level**: medium
- **Pattern**: sound
- **Visual**: C U SOON
- **Answer**: see you soon
- **Also**: see u soon
- **Hint**: A happy goodbye when you'll meet again quickly.
- **Why**: C = SEE, U = YOU: SEE YOU SOON
- **Choices**: see you later, goodbye, so soon

## ID: for-sure
- **Level**: medium
- **Pattern**: sound
- **Visual**: 4 SURE
- **Answer**: for sure
- **Also**: 4 sure
- **Hint**: Yes, definitely!
- **Why**: 4 = FOR: FOR SURE
- **Choices**: four sure, of course, not sure

## ID: too-cool
- **Level**: medium
- **Pattern**: sound
- **Visual**: 2 COOL
- **Answer**: too cool
- **Also**: 2 cool, too cool for school
- **Hint**: Super awesome!
- **Why**: 2 = TOO: TOO COOL
- **Choices**: two cool, so cool, cool down

## ID: you-too
- **Level**: easy
- **Pattern**: sound
- **Visual**: U 2
- **Answer**: you too
- **Also**: u 2, you 2
- **Hint**: "Have a nice day!" "___!"
- **Why**: U = YOU, 2 = TOO: YOU TOO
- **Choices**: me too, u turn, two of you

## ID: to-be-or-not-to-be
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 2B OR NOT 2B
- **Answer**: to be or not to be
- **Also**: 2b or not 2b
- **Hint**: A famous line from a very old play by Shakespeare.
- **Why**: 2B = TO BE: TO BE OR NOT TO BE
- **Choices**: two bees, or not, be quiet

## ID: wonton
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 1 TON
- **Answer**: wonton
- **Also**: won ton, wonton soup
- **Hint**: A dumpling you can eat in soup.
- **Why**: 1 = ONE (WON) + TON = WONTON!
- **Choices**: one ton, dumpling, heavy

## ID: tutu
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 2 2
- **Answer**: tutu
- **Also**: tu tu
- **Hint**: A puffy skirt a ballerina wears.
- **Why**: 2 2 = TWO TWO = TUTU!
- **Choices**: twenty two, two two, tiara

## ID: potato
- **Level**: tricky
- **Pattern**: sound
- **Visual**: POT 8 O
- **Answer**: potato
- **Hint**: You can mash it, bake it or make fries with it.
- **Why**: POT + 8 (ATE) + O = POTATO!
- **Choices**: tomato, pot of gold, pot pie

## ID: free-for-all
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 3 4 ALL
- **Answer**: free for all
- **Also**: free-for-all
- **Hint**: Everyone can join in, no rules!
- **Why**: 3 = FREE, 4 = FOR: FREE FOR ALL
- **Choices**: three for all, all for one, seven

## ID: skate
- **Level**: medium
- **Pattern**: sound
- **Visual**: SK8
- **Answer**: skate
- **Also**: sk8
- **Hint**: Glide on wheels or on ice!
- **Why**: SK + 8 (EIGHT) = SKATE!
- **Choices**: skateboard, skip, eight

## ID: create
- **Level**: medium
- **Pattern**: sound
- **Visual**: CRE8
- **Answer**: create
- **Also**: cre8
- **Hint**: To make something new.
- **Why**: CRE + 8 (EIGHT) = CREATE!
- **Choices**: crate, crayon, great

## ID: missing
- **Level**: tricky
- **Pattern**: missing
- **Visual**: M SS NG
- **Answer**: missing
- **Also**: missing i
- **Hint**: Something is gone! Look at the letters.
- **Why**: MISSING with the I's missing = MISSING!
- **Choices**: messing, mess, nothing

## ID: noel
- **Level**: tricky
- **Pattern**: missing
- **Visual**: ABCDEFGHIJKMNOPQRSTUVWXYZ
- **Answer**: noel
- **Also**: no l, no el
- **Hint**: A Christmas word. Which letter is gone?
- **Why**: The alphabet has NO L = NOEL!
- **Choices**: alphabet, abc, christmas

## ID: cross-my-heart
- **Level**: tricky
- **Pattern**: position
- **Visual**: HEART (cross)
- **Answer**: cross my heart
- **Also**: cross your heart
- **Hint**: What you say when you promise to tell the truth.
- **Why**: HEART crosses itself = CROSS MY HEART
- **Choices**: broken heart, heartbeat, sweetheart

## ID: crossword
- **Level**: medium
- **Pattern**: position
- **Visual**: WORD (cross)
- **Answer**: crossword
- **Also**: cross word, crossword puzzle
- **Hint**: A puzzle with words going across and down.
- **Why**: WORD crosses WORD = CROSSWORD
- **Choices**: password, word search, crossroads

## ID: broken-promise
- **Level**: tricky
- **Pattern**: split
- **Visual**: PRO (tilted) | MISE (tilted)
- **Answer**: broken promise
- **Also**: a broken promise
- **Hint**: When someone doesn't do what they said. Sad!
- **Why**: The word PROMISE is broken = BROKEN PROMISE
- **Choices**: pinky promise, broken heart, promise ring

## ID: mixed-feelings
- **Level**: medium
- **Pattern**: typography
- **Visual**: FEELINGS (jumbled)
- **Answer**: mixed feelings
- **Also**: mixed up feelings
- **Hint**: Happy and sad at the same time.
- **Why**: FEELINGS are all mixed up = MIXED FEELINGS
- **Choices**: good feelings, hurt feelings, mood swing

## ID: tossed-salad
- **Level**: medium
- **Pattern**: typography
- **Visual**: SALAD (jumbled)
- **Answer**: tossed salad
- **Also**: mixed salad
- **Hint**: A bowl of greens all mixed together.
- **Why**: SALAD is tossed around = TOSSED SALAD
- **Choices**: fruit salad, salad bar, sandwich

## ID: red-alert
- **Level**: medium
- **Pattern**: color
- **Visual**: {ALERT}
- **Answer**: red alert
- **Hint**: Danger! Everybody watch out!
- **Why**: ALERT in RED = RED ALERT
- **Choices**: fire alarm, red light, stop sign

## ID: little-red-riding-hood
- **Level**: tricky
- **Pattern**: color
- **Visual**: {HOOD} (tiny)
- **Answer**: little red riding hood
- **Also**: little red
- **Hint**: A girl in a red cape visiting her grandma… and a wolf!
- **Why**: A LITTLE RED HOOD = LITTLE RED RIDING HOOD
- **Choices**: red cape, robin hood, big bad wolf
