# Moku Word Riddles — Riddle Database

<!--
このファイルが Moku Word Riddles の問題データのすべて。どんな問題を入れるか(仕掛け・子ども向け・用例など)は data/RIDDLES_GUIDE.md。問題を足す・直す時はこのファイルだけ書き換える(コードは触らない)。
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
  - **Example**: 答えのフレーズをそのまま使った短い英文(必須。正解のあとに意味と一緒に出す)

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
- **Example**: We built a little treehouse in the big oak tree.
- **Choices**: birdhouse, greenhouse, tree trunk

## ID: spelling-bee
- **Level**: easy
- **Pattern**: sound
- **Visual**: SPELLING B
- **Answer**: spelling bee
- **Also**: spellingbee
- **Hint**: A contest where you spell words out loud.
- **Why**: SPELLING + B (sounds like BEE) = SPELLING BEE
- **Example**: Aoi won the spelling bee by spelling "giraffe."
- **Choices**: honeybee, word game, bumblebee

## ID: bicycle
- **Level**: medium
- **Pattern**: quantity
- **Visual**: CYCLE | CYCLE
- **Answer**: bicycle
- **Also**: bike
- **Hint**: It has two wheels and you pedal it.
- **Why**: BI means two. Two CYCLEs = BICYCLE!
- **Example**: I ride my bicycle to the park every Sunday.
- **Choices**: motorcycle, tricycle, unicycle

## ID: tricycle
- **Level**: medium
- **Pattern**: quantity
- **Visual**: CYCLE / CYCLE / CYCLE
- **Answer**: tricycle
- **Hint**: Little kids ride it. It has three wheels.
- **Why**: TRI means three. Three CYCLEs = TRICYCLE!
- **Example**: My baby brother rides a red tricycle.
- **Choices**: bicycle, triangle, unicycle

## ID: downtown
- **Level**: medium
- **Pattern**: direction
- **Visual**: TOWN (vertical)
- **Answer**: downtown
- **Also**: down town
- **Hint**: The busy middle of a city.
- **Why**: TOWN goes DOWN the card = DOWNTOWN
- **Example**: We took the bus downtown to see the parade.
- **Choices**: uptown, countdown, town hall

## ID: high-chair
- **Level**: medium
- **Pattern**: position
- **Visual**: CHAIR (top)
- **Answer**: high chair
- **Also**: highchair
- **Hint**: A tall seat for a baby at the table.
- **Why**: The CHAIR is way up HIGH = HIGH CHAIR
- **Example**: The baby ate her peas in the high chair.
- **Choices**: armchair, rocking chair, chairlift

## ID: upside-down
- **Level**: medium
- **Pattern**: typography
- **Visual**: DOWN (upside down)
- **Answer**: upside down
- **Also**: upsidedown
- **Hint**: When the top is at the bottom.
- **Why**: The word DOWN is flipped UPSIDE DOWN!
- **Example**: The bat was hanging upside down in the cave.
- **Choices**: sit down, inside out, downstairs

## ID: backpack
- **Level**: medium
- **Pattern**: typography
- **Visual**: PACK (backwards)
- **Answer**: backpack
- **Also**: back pack
- **Hint**: You carry your school books in it.
- **Why**: PACK is written BACKwards = BACKPACK
- **Example**: I put my lunch and books in my backpack.
- **Choices**: lunch box, school bag, pack it

## ID: banana-split
- **Level**: medium
- **Pattern**: split
- **Visual**: BAN (tilted) | ANA (tilted)
- **Answer**: banana split
- **Also**: bananasplit
- **Hint**: A yummy ice cream treat with fruit.
- **Why**: The word BANANA is SPLIT in two = BANANA SPLIT
- **Example**: We shared a banana split with three scoops of ice cream.
- **Choices**: banana bread, banana peel, half banana

## ID: waterfall
- **Level**: medium
- **Pattern**: direction
- **Visual**: WATER (falling)
- **Answer**: waterfall
- **Also**: water fall
- **Hint**: Water tumbling down from a cliff.
- **Why**: The letters of WATER FALL down = WATERFALL
- **Example**: We heard the waterfall before we saw it.
- **Choices**: rainfall, waterslide, raindrop

## ID: crossroads
- **Level**: medium
- **Pattern**: position
- **Visual**: ROAD (cross)
- **Answer**: crossroads
- **Also**: cross roads, crossroad
- **Hint**: A place where two streets meet.
- **Why**: ROAD crosses ROAD = CROSSROADS
- **Example**: Turn left at the crossroads to find the farm.
- **Choices**: roadwork, side road, crosswalk

## ID: man-overboard
- **Level**: medium
- **Pattern**: position
- **Visual**: MAN / BOARD
- **Answer**: man overboard
- **Also**: man over board
- **Hint**: Someone fell off the ship! Shout it!
- **Why**: MAN is OVER the BOARD = MAN OVERBOARD
- **Example**: "Man overboard!" the sailor shouted, and threw a ring into the sea.
- **Choices**: man on board, boatman, skateboard

## ID: inside
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: SIDE]
- **Answer**: inside
- **Also**: in side
- **Hint**: The opposite of outside.
- **Why**: SIDE is IN the box = INSIDE
- **Example**: It's raining, so let's play inside.
- **Choices**: outside, sideways, inbox

## ID: outside
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box] | SIDE
- **Answer**: outside
- **Also**: out side
- **Hint**: Where you play in the fresh air.
- **Why**: SIDE is OUT of the box = OUTSIDE
- **Example**: The sun is out! Let's play outside.
- **Choices**: inside, sideways, offside

## ID: small-talk
- **Level**: medium
- **Pattern**: size
- **Visual**: talk (tiny)
- **Answer**: small talk
- **Also**: smalltalk, little talk
- **Hint**: Chatting about little things, like the weather.
- **Why**: The word TALK is SMALL = SMALL TALK
- **Example**: At the party, Mom made small talk about the weather.
- **Choices**: whisper, chit chat, tiny voice

## ID: growing-up
- **Level**: medium
- **Pattern**: size
- **Visual**: GROWING (growing)
- **Answer**: growing up
- **Also**: grow up, growingup
- **Hint**: Getting older and taller.
- **Why**: GROWING goes UP and gets bigger = GROWING UP
- **Example**: Growing up, my dad lived next to a farm.
- **Choices**: getting big, stand up, growing tall

## ID: broken-heart
- **Level**: medium
- **Pattern**: split
- **Visual**: HE (tilted) | ART (tilted)
- **Answer**: broken heart
- **Also**: heartbroken, heart broken
- **Hint**: How you feel when something very sad happens.
- **Why**: The word HEART is broken in two = BROKEN HEART
- **Example**: When our cat ran away, I had a broken heart.
- **Choices**: heartbeat, half heart, sweetheart

## ID: sit-down
- **Level**: medium
- **Pattern**: position
- **Visual**: SIT (bottom)
- **Answer**: sit down
- **Also**: sitdown
- **Hint**: What the teacher says when it is time to start.
- **Why**: SIT is way DOWN low = SIT DOWN
- **Example**: Please sit down, class is starting.
- **Choices**: stand up, sit still, lie down

## ID: stand-up
- **Level**: medium
- **Pattern**: direction
- **Visual**: STAND (sideways)
- **Answer**: stand up
- **Also**: standup
- **Hint**: Get up from your chair!
- **Why**: STAND reads going UP = STAND UP
- **Example**: Stand up and stretch your arms!
- **Choices**: sit down, stand still, wake up

## ID: go-for-it
- **Level**: medium
- **Pattern**: sound
- **Visual**: GO 4 IT
- **Answer**: go for it
- **Also**: go 4 it
- **Hint**: Do it! Try your best!
- **Why**: 4 sounds like FOR: GO 4 IT = GO FOR IT
- **Example**: You can do the high jump. Go for it!
- **Choices**: go get it, let it go, go four it

## ID: before
- **Level**: medium
- **Pattern**: sound
- **Visual**: B4
- **Answer**: before
- **Also**: b4
- **Hint**: The opposite of after.
- **Why**: B + 4 sounds like BE-FOUR = BEFORE
- **Example**: Wash your hands before you eat.
- **Choices**: bee, b four, behind

## ID: too-late
- **Level**: medium
- **Pattern**: sound
- **Visual**: 2 LATE
- **Answer**: too late
- **Also**: 2 late
- **Hint**: When you miss the bus by one minute.
- **Why**: 2 sounds like TOO: 2 LATE = TOO LATE
- **Example**: We got to the station too late, and the train was gone.
- **Choices**: two late, so late, late again

## ID: i-see-you
- **Level**: medium
- **Pattern**: sound
- **Visual**: I C U
- **Answer**: i see you
- **Also**: i see u, icu
- **Hint**: What you say when you play peekaboo!
- **Why**: C sounds like SEE and U sounds like YOU = I SEE YOU
- **Example**: Peekaboo, I see you!
- **Choices**: i spy, see you, eyes on you

## ID: tennis
- **Level**: medium
- **Pattern**: sound
- **Visual**: 10 S
- **Answer**: tennis
- **Hint**: A game with a racket, a ball and a net.
- **Why**: 10 + S = TEN-S = TENNIS!
- **Example**: We play tennis at the park after school.
- **Choices**: tens, ping pong, badminton

## ID: forgive
- **Level**: medium
- **Pattern**: sound
- **Visual**: 4 GIVE
- **Answer**: forgive
- **Also**: 4give
- **Hint**: To stop being angry when someone says sorry.
- **Why**: 4 sounds like FOR: 4 GIVE = FORGIVE
- **Example**: I'm sorry I broke your crayon. Can you forgive me?
- **Choices**: four gifts, give up, for you

## ID: forever
- **Level**: medium
- **Pattern**: sound
- **Visual**: 4EVER
- **Answer**: forever
- **Also**: 4ever, for ever
- **Hint**: For all time, with no end.
- **Why**: 4 + EVER = FOREVER
- **Example**: Best friends forever!
- **Choices**: for now, every, four times

## ID: backwards
- **Level**: medium
- **Pattern**: typography
- **Visual**: BACKWARDS (backwards)
- **Answer**: backwards
- **Also**: backward
- **Hint**: Walking with your back in front.
- **Why**: BACKWARDS is written backwards!
- **Example**: Can you say the alphabet backwards?
- **Choices**: upside down, inside out, sideways

## ID: long-ago
- **Level**: medium
- **Pattern**: position
- **Visual**: A | [line] | GO
- **Answer**: long ago
- **Also**: longago
- **Hint**: A very, very long time before now.
- **Why**: A ……… GO with a LONG gap = LONG AGO
- **Example**: Long ago, dinosaurs walked on the Earth.
- **Choices**: long way, go away, a long road

## ID: lunchbox
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: LUNCH]
- **Answer**: lunchbox
- **Also**: lunch box
- **Hint**: You carry your food to school in it.
- **Why**: LUNCH is in a BOX = LUNCHBOX
- **Example**: My lunchbox has a sandwich and an apple.
- **Choices**: lunchtime, backpack, sandwich

## ID: leftovers
- **Level**: medium
- **Pattern**: position
- **Visual**: OVERS (left)
- **Answer**: leftovers
- **Also**: left overs, leftover
- **Hint**: The food you did not finish, saved for later.
- **Why**: OVERS is on the LEFT = LEFTOVERS
- **Example**: We had pizza leftovers for breakfast.
- **Choices**: left side, turnovers, go over

## ID: double-trouble
- **Level**: medium
- **Pattern**: quantity
- **Visual**: TROUBLE / TROUBLE
- **Answer**: double trouble
- **Hint**: Two times the problems!
- **Why**: TROUBLE two times = DOUBLE TROUBLE
- **Example**: The twins are double trouble when they play together!
- **Choices**: big trouble, two troubles, no trouble

## ID: shrinking
- **Level**: medium
- **Pattern**: size
- **Visual**: SHRINK (shrinking)
- **Answer**: shrinking
- **Also**: shrink, shrinks
- **Hint**: Getting smaller and smaller.
- **Why**: SHRINK gets smaller and smaller = SHRINKING
- **Example**: My favorite sweater keeps shrinking in the wash.
- **Choices**: growing, tiny, melting

## ID: bumpy-road
- **Level**: medium
- **Pattern**: typography
- **Visual**: ROAD (bumpy)
- **Answer**: bumpy road
- **Also**: bumpy ride
- **Hint**: A ride that shakes you up and down.
- **Why**: ROAD goes up, down, up, down = BUMPY ROAD
- **Example**: The bus shook on the bumpy road to the farm.
- **Choices**: crossroads, dirt road, rocky ride

## ID: scrambled-eggs
- **Level**: medium
- **Pattern**: typography
- **Visual**: EGGS (jumbled)
- **Answer**: scrambled eggs
- **Also**: scrambled egg
- **Hint**: A yummy breakfast made in a pan.
- **Why**: EGGS with the letters all mixed up = SCRAMBLED EGGS
- **Example**: Grandpa makes the best scrambled eggs.
- **Choices**: fried eggs, egg roll, mixed nuts

## ID: sunrise
- **Level**: medium
- **Pattern**: direction
- **Visual**: SUN (rising)
- **Answer**: sunrise
- **Also**: sun rise
- **Hint**: When the morning begins.
- **Why**: SUN is going up (RISE) = SUNRISE
- **Example**: We woke up early to watch the sunrise.
- **Choices**: sunset, sunshine, morning star

## ID: sunset
- **Level**: medium
- **Pattern**: direction
- **Visual**: SUN (falling)
- **Answer**: sunset
- **Also**: sun set, sundown
- **Hint**: When the sky turns orange in the evening.
- **Why**: SUN is going down (SET) = SUNSET
- **Example**: The sky turned orange and pink at sunset.
- **Choices**: sunrise, moonrise, nighttime

## ID: side-by-side
- **Level**: medium
- **Pattern**: position
- **Visual**: SIDE | SIDE
- **Answer**: side by side
- **Hint**: Right next to each other.
- **Why**: SIDE is BY (next to) SIDE = SIDE BY SIDE
- **Example**: We walked side by side to school.
- **Choices**: two sides, sideways, inside out

## ID: over-and-over
- **Level**: medium
- **Pattern**: quantity
- **Visual**: OVER / OVER / OVER / OVER
- **Answer**: over and over
- **Also**: over and over again
- **Hint**: Again and again and again.
- **Why**: OVER and OVER and OVER = OVER AND OVER
- **Example**: I watched my favorite movie over and over.
- **Choices**: four times, game over, over there

## ID: ice-cream
- **Level**: medium
- **Pattern**: sound
- **Visual**: I SCREAM
- **Answer**: ice cream
- **Also**: icecream
- **Hint**: A cold, sweet treat in a cone. Say it out loud!
- **Why**: I SCREAM sounds like ICE CREAM!
- **Example**: Let's get ice cream after the game!
- **Choices**: i shout, ice cube, scream

## ID: i-understand
- **Level**: tricky
- **Pattern**: position
- **Visual**: STAND / I
- **Answer**: i understand
- **Also**: understand
- **Hint**: What you say when you get it.
- **Why**: I is UNDER STAND = I UNDERSTAND
- **Example**: Oh, now I understand how to do it!
- **Choices**: i stand up, standing by, stand under

## ID: once-upon-a-time
- **Level**: tricky
- **Pattern**: position
- **Visual**: ONCE / A TIME
- **Answer**: once upon a time
- **Also**: once upon time
- **Hint**: How many fairy tales begin.
- **Why**: ONCE is UPON A TIME = ONCE UPON A TIME
- **Example**: Once upon a time, there lived a little owl named Moku.
- **Choices**: one more time, time after time, once a day

## ID: reading-between-the-lines
- **Level**: tricky
- **Pattern**: position
- **Visual**: [line] / READING / [line]
- **Answer**: reading between the lines
- **Also**: read between the lines, reading between lines
- **Hint**: Finding the secret meaning a story does not say out loud.
- **Why**: READING is BETWEEN THE LINES!
- **Example**: She said "I'm fine," but reading between the lines, I knew she was sad.
- **Choices**: reading a book, lined paper, line by line

## ID: three-blind-mice
- **Level**: tricky
- **Pattern**: missing
- **Visual**: M  CE / M  CE / M  CE
- **Answer**: three blind mice
- **Also**: 3 blind mice
- **Hint**: A nursery rhyme about little animals that cannot see.
- **Why**: Three MICE with no I (eye) = THREE BLIND MICE
- **Example**: We sang "Three Blind Mice" in music class.
- **Choices**: three little mice, missing letters, cheese thieves

## ID: paradise
- **Level**: tricky
- **Pattern**: sound
- **Visual**: DICE (tilted) | DICE (tilted)
- **Answer**: paradise
- **Also**: pair of dice, pairadice
- **Hint**: A perfect, happy place.
- **Why**: A PAIR of DICE sounds like PARADISE!
- **Example**: This beach is paradise!
- **Choices**: double dice, dice game, lucky roll

## ID: forget-it
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: GET IT (x4)
- **Answer**: forget it
- **Also**: forgetit
- **Hint**: What you say when it does not matter anymore.
- **Why**: FOUR "GET IT"s = FOR-GET IT = FORGET IT
- **Example**: Never mind, forget it. It's not important.
- **Choices**: get it all, forgot it, get it four

## ID: big-deal
- **Level**: tricky
- **Pattern**: size
- **Visual**: DEAL (big)
- **Answer**: big deal
- **Also**: bigdeal
- **Hint**: Something very important… or is it?
- **Why**: The word DEAL is BIG = BIG DEAL
- **Example**: I dropped my pencil. It's no big deal.
- **Choices**: good deal, big cards, deal or no deal

## ID: jack-in-the-box
- **Level**: tricky
- **Pattern**: inside
- **Visual**: [box: JACK]
- **Answer**: jack in the box
- **Also**: jack in a box, jack-in-the-box
- **Hint**: A toy that pops up when you turn the handle.
- **Why**: JACK is IN THE BOX = JACK IN THE BOX
- **Example**: The jack-in-the-box popped up and made me jump!
- **Choices**: toy box, jack box, surprise box

## ID: think-outside-the-box
- **Level**: tricky
- **Pattern**: inside
- **Visual**: [box] | THINK
- **Answer**: think outside the box
- **Also**: thinking outside the box, think out of the box
- **Hint**: Have a new, creative idea!
- **Why**: THINK is OUTSIDE THE BOX!
- **Example**: Let's think outside the box and build a robot out of boxes.
- **Choices**: think again, think inside, box idea

## ID: hand-in-hand
- **Level**: tricky
- **Pattern**: inside
- **Visual**: HA{HAND}ND
- **Answer**: hand in hand
- **Hint**: Holding each other’s hands as you walk.
- **Why**: HAND is IN HAND: HA[HAND]ND = HAND IN HAND
- **Example**: The two friends walked hand in hand.
- **Choices**: handshake, two hands, high five

## ID: head-over-heels
- **Level**: tricky
- **Pattern**: position
- **Visual**: HEAD / HEELS
- **Answer**: head over heels
- **Hint**: Very, very happy… or in love!
- **Why**: HEAD is OVER HEELS = HEAD OVER HEELS
- **Example**: My sister is head over heels about her new puppy.
- **Choices**: heads up, upside down, high heels

## ID: pie-in-the-sky
- **Level**: tricky
- **Pattern**: inside
- **Visual**: SK{PIE}Y
- **Answer**: pie in the sky
- **Hint**: A wish that will probably never come true.
- **Why**: PIE is IN the SKY = PIE IN THE SKY
- **Example**: A school with no homework? That's pie in the sky!
- **Choices**: apple pie, cloud cake, sky high

## ID: last-minute
- **Level**: tricky
- **Pattern**: position
- **Visual**: HOUR / HOUR / HOUR / MINUTE
- **Answer**: last minute
- **Also**: the last minute, at the last minute
- **Hint**: Just before it is too late!
- **Why**: MINUTE comes LAST = LAST MINUTE
- **Example**: I finished my poster at the last minute.
- **Choices**: one minute, hourglass, first hour

## ID: tea-for-two
- **Level**: tricky
- **Pattern**: sound
- **Visual**: TEA 4 2
- **Answer**: tea for two
- **Also**: tea 4 2
- **Hint**: A tea party for a pair of friends.
- **Why**: 4 = FOR and 2 = TWO: TEA 4 2 = TEA FOR TWO
- **Example**: Grandma made tea for two and some cookies.
- **Choices**: tea party, forty two, two teas

## ID: see-you-later
- **Level**: tricky
- **Pattern**: sound
- **Visual**: C U L8R
- **Answer**: see you later
- **Also**: see ya later, see u later, cul8r
- **Hint**: What you say when you leave.
- **Why**: C = SEE, U = YOU, L8R = LATER: SEE YOU LATER
- **Example**: Bye, see you later!
- **Choices**: call you later, see you soon, goodbye

## ID: ice-cube
- **Level**: tricky
- **Pattern**: math
- **Visual**: ICE^3
- **Answer**: ice cube
- **Also**: icecube, ice cubed
- **Hint**: A little frozen block in your drink.
- **Why**: The little 3 means CUBED in math: ICE CUBED = ICE CUBE!
- **Example**: I put an ice cube in my juice.
- **Choices**: ice three, snowflake, ice cream

## ID: excellent
- **Level**: tricky
- **Pattern**: sound
- **Visual**: XLNT
- **Answer**: excellent
- **Hint**: Super, super good!
- **Why**: Say the letters: X-L-N-T = EXCELLENT!
- **Example**: Your drawing is excellent!
- **Choices**: extra, extra large, next

## ID: split-second
- **Level**: tricky
- **Pattern**: split
- **Visual**: SEC (tilted) | OND (tilted)
- **Answer**: split second
- **Also**: splitsecond
- **Hint**: A super short moment.
- **Why**: The word SECOND is SPLIT = SPLIT SECOND
- **Example**: The ball came so fast, I had only a split second to catch it.
- **Choices**: second half, one second, split time

## ID: search-high-and-low
- **Level**: tricky
- **Pattern**: position
- **Visual**: SEARCH (top left) | SEARCH (bottom right)
- **Answer**: search high and low
- **Also**: high and low
- **Hint**: Look everywhere for something.
- **Why**: SEARCH is HIGH AND LOW = SEARCH HIGH AND LOW
- **Example**: We searched high and low for my lost shoe.
- **Choices**: hide and seek, look around, search party

## ID: fish-out-of-water
- **Level**: tricky
- **Pattern**: inside
- **Visual**: [box: WATER] | FISH (top right)
- **Answer**: fish out of water
- **Also**: a fish out of water
- **Hint**: How you feel in a strange new place.
- **Why**: FISH is OUT OF the WATER!
- **Example**: On my first day at the new school, I felt like a fish out of water.
- **Choices**: flying fish, fishbowl, swimming fish

## ID: breakfast
- **Level**: tricky
- **Pattern**: split
- **Visual**: FA (tilted) | ST (tilted)
- **Answer**: breakfast
- **Also**: break fast
- **Hint**: The first meal of the day.
- **Why**: FAST is broken (BREAK) = BREAK-FAST = BREAKFAST!
- **Example**: I eat cereal for breakfast.
- **Choices**: fast food, lunch, broken plate

## ID: underground
- **Level**: easy
- **Pattern**: position
- **Visual**: [line] / GROUND
- **Answer**: underground
- **Also**: under ground
- **Hint**: Down below, where the moles and the subway trains are.
- **Why**: GROUND is UNDER the line = UNDERGROUND
- **Example**: Moles live underground.
- **Choices**: playground, background, ground floor

## ID: airport
- **Level**: easy
- **Pattern**: position
- **Visual**: AIR / PORT
- **Answer**: airport
- **Also**: air port
- **Hint**: Where airplanes take off and land.
- **Why**: AIR on top + PORT under it = AIRPORT
- **Example**: We flew from the airport to Tokyo.
- **Choices**: airplane, seaport, passport

## ID: midday
- **Level**: medium
- **Pattern**: inside
- **Visual**: DAY surrounded by M-I-D
- **Answer**: midday
- **Also**: mid day, noon
- **Hint**: The middle of the day, when the sun is high.
- **Why**: DAY is in the middle of MID = MIDDAY
- **Example**: The sun is high in the sky at midday.
- **Choices**: daytime, sunday, birthday

## ID: backstage
- **Level**: medium
- **Pattern**: typography
- **Visual**: STAGE (backwards)
- **Answer**: backstage
- **Also**: back stage
- **Hint**: The secret place behind the stage at a show.
- **Why**: STAGE is written BACKwards = BACKSTAGE
- **Example**: Before the show, we waited backstage.
- **Choices**: on stage, stage left, curtain call

## ID: sunflower
- **Level**: easy
- **Pattern**: position
- **Visual**: SUN / FLOWER
- **Answer**: sunflower
- **Also**: sun flower
- **Hint**: A tall yellow flower that turns to face the sun.
- **Why**: SUN shines over the FLOWER = SUNFLOWER
- **Example**: The sunflower grew taller than me!
- **Choices**: sunshine, flowerpot, sunset

## ID: mind-over-matter
- **Level**: tricky
- **Pattern**: position
- **Visual**: MIND / MATTER
- **Answer**: mind over matter
- **Hint**: When your brain is stronger than the problem.
- **Why**: MIND is OVER MATTER = MIND OVER MATTER
- **Example**: Running up the hill was hard, but it was mind over matter.
- **Choices**: never mind, brain power, matter of fact

## ID: fortnight
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: NIGHT (x4)
- **Answer**: fortnight
- **Also**: four nights
- **Hint**: Two weeks. Say "four night" fast!
- **Why**: FOUR NIGHTs sounds like FORTNIGHT (that means two weeks)!
- **Example**: We are going to camp for a fortnight.
- **Choices**: goodnight, midnight, tonight

## ID: seven-days
- **Level**: easy
- **Pattern**: quantity
- **Visual**: DAY (x7)
- **Answer**: seven days
- **Also**: 7 days, a week, one week
- **Hint**: How long is one week?
- **Why**: Seven DAYs = SEVEN DAYS (one week)!
- **Example**: There are seven days in a week.
- **Choices**: weekend, daytime, every day

## ID: for-you
- **Level**: easy
- **Pattern**: sound
- **Visual**: 4 U
- **Answer**: for you
- **Also**: 4 u, four you
- **Hint**: What you say when you give someone a present.
- **Why**: 4 sounds like FOR and U sounds like YOU = FOR YOU
- **Example**: I made this card for you!
- **Choices**: thank you, four years, to you

## ID: i-owe-you
- **Level**: medium
- **Pattern**: sound
- **Visual**: I O U
- **Answer**: i owe you
- **Also**: iou, i owe u
- **Hint**: A promise to pay back later.
- **Why**: Say the letters: I-O-U = I OWE YOU
- **Example**: Thanks for the snack. I owe you one!
- **Choices**: i love you, oh you, i see you

## ID: easy
- **Level**: medium
- **Pattern**: sound
- **Visual**: EZ
- **Answer**: easy
- **Hint**: Not hard at all!
- **Why**: Say the letters: E-Z = EASY!
- **Example**: This puzzle is easy!
- **Choices**: zebra, crazy, lazy

## ID: energy
- **Level**: medium
- **Pattern**: sound
- **Visual**: NRG
- **Answer**: energy
- **Hint**: What you need to run and jump all day.
- **Why**: Say the letters: N-R-G = ENERGY!
- **Example**: Kids have so much energy after lunch.
- **Choices**: angry, engine, hungry

## ID: great
- **Level**: medium
- **Pattern**: sound
- **Visual**: GR8
- **Answer**: great
- **Also**: gr8
- **Hint**: Super good!
- **Why**: GR + 8 (EIGHT) = GREAT!
- **Example**: You did a great job!
- **Choices**: grate, grapes, green

## ID: cutie
- **Level**: medium
- **Pattern**: sound
- **Visual**: QT
- **Answer**: cutie
- **Also**: cutey, qt
- **Hint**: Someone who is very cute.
- **Why**: Say the letters: Q-T = CUTIE!
- **Example**: Our new kitten is a cutie.
- **Choices**: quiet, kitty, queen

## ID: anyone
- **Level**: medium
- **Pattern**: sound
- **Visual**: NE1
- **Answer**: anyone
- **Also**: any one, anybody
- **Hint**: "Does ___ want a cookie?"
- **Why**: N-E + 1 (ONE) = ANY-ONE = ANYONE!
- **Example**: Does anyone want a cookie?
- **Choices**: no one, everyone, someone

## ID: you-are-too-good
- **Level**: medium
- **Pattern**: sound
- **Visual**: U R 2 GOOD
- **Answer**: you are too good
- **Also**: you're too good, youre too good, u r 2 good
- **Hint**: What you say to a friend who always wins!
- **Why**: U = YOU, R = ARE, 2 = TOO: YOU ARE TOO GOOD
- **Example**: You won again? You are too good at this game!
- **Choices**: you are so good, two good, good for you

## ID: oh-i-see
- **Level**: medium
- **Pattern**: sound
- **Visual**: O I C
- **Answer**: oh i see
- **Also**: o i see, oic
- **Hint**: What you say when you finally understand.
- **Why**: O = OH, I = I, C = SEE: OH I SEE
- **Example**: Oh, I see! The answer was under the table.
- **Choices**: i see you, oh no, ice

## ID: top-secret
- **Level**: medium
- **Pattern**: position
- **Visual**: SECRET (top)
- **Answer**: top secret
- **Also**: topsecret
- **Hint**: Something nobody else is allowed to know!
- **Why**: SECRET is at the TOP = TOP SECRET
- **Example**: Our club password is top secret.
- **Choices**: big secret, secret code, high secret

## ID: high-five
- **Level**: easy
- **Pattern**: position
- **Visual**: FIVE (top)
- **Answer**: high five
- **Also**: high 5, highfive
- **Hint**: Slap hands up in the air when you win!
- **Why**: FIVE is way up HIGH = HIGH FIVE
- **Example**: We scored! Give me a high five!
- **Choices**: give me five, top five, five fingers

## ID: highway
- **Level**: medium
- **Pattern**: position
- **Visual**: WAY (top)
- **Answer**: highway
- **Also**: high way
- **Hint**: A big, fast road for cars.
- **Why**: WAY is up HIGH = HIGHWAY
- **Example**: The cars drove fast on the highway.
- **Choices**: subway, top way, hallway

## ID: high-school
- **Level**: medium
- **Pattern**: position
- **Visual**: SCHOOL (top)
- **Answer**: high school
- **Also**: highschool
- **Hint**: The school big kids go to after middle school.
- **Why**: SCHOOL is way up HIGH = HIGH SCHOOL
- **Example**: My cousin goes to high school.
- **Choices**: top school, school bus, schoolyard

## ID: upstairs
- **Level**: easy
- **Pattern**: position
- **Visual**: STAIRS (top)
- **Answer**: upstairs
- **Also**: up stairs, up the stairs
- **Hint**: Where your bedroom might be.
- **Why**: STAIRS is UP at the top = UPSTAIRS
- **Example**: My bedroom is upstairs.
- **Choices**: downstairs, staircase, top step

## ID: downstairs
- **Level**: easy
- **Pattern**: position
- **Visual**: STAIRS (bottom)
- **Answer**: downstairs
- **Also**: down stairs, down the stairs
- **Hint**: Go down here for breakfast in the kitchen.
- **Why**: STAIRS is DOWN at the bottom = DOWNSTAIRS
- **Example**: Come downstairs, dinner is ready!
- **Choices**: upstairs, staircase, bottom step

## ID: downhill
- **Level**: medium
- **Pattern**: position
- **Visual**: HILL (bottom)
- **Answer**: downhill
- **Also**: down hill, down the hill
- **Hint**: The fun way to ride your bike: wheee!
- **Why**: HILL is DOWN at the bottom = DOWNHILL
- **Example**: Riding my bike downhill is so much fun!
- **Choices**: uphill, hilltop, ant hill

## ID: underwear
- **Level**: easy
- **Pattern**: position
- **Visual**: [line] / WEAR
- **Answer**: underwear
- **Also**: under wear
- **Hint**: You wear it under your clothes. Hee hee!
- **Why**: WEAR is UNDER the line = UNDERWEAR
- **Example**: Don't forget to pack clean underwear for the trip!
- **Choices**: sweater, raincoat, swimwear

## ID: underdog
- **Level**: tricky
- **Pattern**: position
- **Visual**: [line] / DOG
- **Answer**: underdog
- **Also**: under dog
- **Hint**: The player everyone thinks will lose… but might win!
- **Why**: DOG is UNDER the line = UNDERDOG
- **Example**: Our team was the underdog, but we won the game!
- **Choices**: hot dog, puppy, top dog

## ID: undercover-agent
- **Level**: tricky
- **Pattern**: position
- **Visual**: COVER / AGENT
- **Answer**: undercover agent
- **Also**: undercover, under cover agent, secret agent
- **Hint**: A spy who hides who they really are.
- **Why**: AGENT is UNDER COVER = UNDERCOVER AGENT
- **Example**: The undercover agent wore a big hat and sunglasses.
- **Choices**: cover story, book cover, police officer

## ID: youre-under-arrest
- **Level**: tricky
- **Pattern**: position
- **Visual**: ARREST / YOU'RE
- **Answer**: you're under arrest
- **Also**: youre under arrest, you are under arrest
- **Hint**: What the police say when they catch the bad guy.
- **Why**: YOU'RE is UNDER ARREST = YOU'RE UNDER ARREST
- **Example**: "Stop, you're under arrest!" said the police officer in the movie.
- **Choices**: stop right there, you are free, rest your arms

## ID: all-over-the-world
- **Level**: tricky
- **Pattern**: position
- **Visual**: ALL / WORLD
- **Answer**: all over the world
- **Also**: all around the world, over the world
- **Hint**: In every country, everywhere!
- **Why**: ALL is OVER THE WORLD = ALL OVER THE WORLD
- **Example**: People all over the world love soccer.
- **Choices**: world map, whole world, around the block

## ID: travel-overseas
- **Level**: tricky
- **Pattern**: sound
- **Visual**: TRAVEL / C C C C C C
- **Answer**: travel overseas
- **Also**: travel over seas, traveling overseas
- **Hint**: Going to a faraway country by plane or ship. The C's sound like something…
- **Why**: TRAVEL is OVER the C's (SEAS) = TRAVEL OVERSEAS
- **Example**: My aunt likes to travel overseas every summer.
- **Choices**: see the world, sea travel, cc travel

## ID: history-repeats-itself
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: HISTORY / HISTORY / HISTORY
- **Answer**: history repeats itself
- **Also**: history repeats
- **Hint**: Things that happened before happen again.
- **Why**: HISTORY again and again = HISTORY REPEATS ITSELF
- **Example**: My brother made the same mistake as me. History repeats itself!
- **Choices**: history class, old stories, three histories

## ID: one-in-a-million
- **Level**: tricky
- **Pattern**: inside
- **Visual**: MIL{1}LION
- **Answer**: one in a million
- **Also**: 1 in a million, one in million
- **Hint**: Super special. There's nobody like you!
- **Why**: ONE (1) is IN A MILLION = ONE IN A MILLION
- **Example**: My best friend is one in a million.
- **Choices**: a million dollars, number one, one million

## ID: two-peas-in-a-pod
- **Level**: tricky
- **Pattern**: inside
- **Visual**: P{PEAS PEAS}OD
- **Answer**: two peas in a pod
- **Also**: 2 peas in a pod, peas in a pod
- **Hint**: Two friends who are very alike.
- **Why**: Two PEAS IN A POD = TWO PEAS IN A POD
- **Example**: Those two friends are like two peas in a pod.
- **Choices**: green beans, pea soup, two of a kind

## ID: cloud-nine
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: CLOUD (x9)
- **Answer**: cloud nine
- **Also**: on cloud nine, cloud 9, on cloud 9
- **Hint**: Where you are when you feel super, super happy.
- **Why**: Nine CLOUDs = (on) CLOUD NINE!
- **Example**: When I got a puppy, I was on cloud nine!
- **Choices**: rainy day, sky high, nine lives

## ID: seven-seas
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: SEA (x7)
- **Answer**: seven seas
- **Also**: the seven seas, 7 seas
- **Hint**: Pirates sail across all of these!
- **Why**: Seven SEAs = THE SEVEN SEAS
- **Example**: The pirate sailed the seven seas.
- **Choices**: deep blue sea, sea shells, ocean waves

## ID: step-by-step
- **Level**: medium
- **Pattern**: position
- **Visual**: STEP | STEP
- **Answer**: step by step
- **Also**: step-by-step
- **Hint**: Slowly, one little part at a time.
- **Why**: STEP is BY (next to) STEP = STEP BY STEP
- **Example**: We built the model step by step.
- **Choices**: two steps, staircase, side by side

## ID: back-to-back
- **Level**: medium
- **Pattern**: typography
- **Visual**: BACK | BACK (backwards)
- **Answer**: back to back
- **Also**: back-to-back
- **Hint**: Standing with your backs touching.
- **Why**: BACK and KCAB face away from each other = BACK TO BACK
- **Example**: Stand back to back and see who is taller.
- **Choices**: backpack, come back, face to face

## ID: face-to-face
- **Level**: medium
- **Pattern**: typography
- **Visual**: FACE | FACE (backwards)
- **Answer**: face to face
- **Also**: face-to-face
- **Hint**: Looking right at each other.
- **Why**: FACE and ECAF look at each other = FACE TO FACE
- **Example**: I finally met my pen pal face to face.
- **Choices**: back to back, two faces, funny face

## ID: afternoon
- **Level**: medium
- **Pattern**: position
- **Visual**: NOON | AFTER
- **Answer**: afternoon
- **Also**: after noon
- **Hint**: The time after lunch and before dinner.
- **Why**: AFTER comes after NOON = AFTERNOON
- **Example**: We play outside in the afternoon.
- **Choices**: midnight, morning, noon time

## ID: backspace
- **Level**: medium
- **Pattern**: typography
- **Visual**: SPACE (backwards)
- **Answer**: backspace
- **Also**: back space
- **Hint**: The key you press to erase a letter.
- **Why**: SPACE is written BACKwards = BACKSPACE
- **Example**: Press backspace to delete the letter.
- **Choices**: outer space, space bar, delete

## ID: backyard
- **Level**: medium
- **Pattern**: typography
- **Visual**: YARD (backwards)
- **Answer**: backyard
- **Also**: back yard
- **Hint**: The grassy place behind your house.
- **Why**: YARD is written BACKwards = BACKYARD
- **Example**: We have a swing in our backyard.
- **Choices**: front yard, garden, playground

## ID: talk-back
- **Level**: medium
- **Pattern**: typography
- **Visual**: TALK (backwards)
- **Answer**: talk back
- **Also**: talkback, talking back
- **Hint**: Answering a grown-up in a rude way. Oops!
- **Why**: TALK is written BACKwards = TALK BACK
- **Example**: Please don't talk back to your teacher.
- **Choices**: small talk, walk back, talk show

## ID: feeling-under-the-weather
- **Level**: tricky
- **Pattern**: position
- **Visual**: WEATHER / FEELING
- **Answer**: feeling under the weather
- **Also**: under the weather
- **Hint**: When you feel a little sick.
- **Why**: FEELING is UNDER the WEATHER = FEELING UNDER THE WEATHER
- **Example**: I'm feeling under the weather, so I'll stay home today.
- **Choices**: rainy day, bad weather, feeling blue

## ID: cow-jumped-over-the-moon
- **Level**: tricky
- **Pattern**: position
- **Visual**: COW / MOON
- **Answer**: the cow jumped over the moon
- **Also**: cow jumped over the moon, cow over the moon
- **Hint**: From the rhyme "Hey Diddle Diddle"!
- **Why**: The COW is OVER THE MOON = THE COW JUMPED OVER THE MOON
- **Example**: Hey diddle diddle, the cow jumped over the moon!
- **Choices**: moon cow, milky way, cow in space

## ID: on-top-of-the-world
- **Level**: tricky
- **Pattern**: position
- **Visual**: ME / WORLD
- **Answer**: on top of the world
- **Also**: top of the world
- **Hint**: How you feel when everything goes great!
- **Why**: ME is ON TOP OF THE WORLD
- **Example**: After winning the race, I felt on top of the world!
- **Choices**: all over the world, around the world, world map

## ID: foot-in-the-door
- **Level**: tricky
- **Pattern**: inside
- **Visual**: DO{FOOT}OR
- **Answer**: foot in the door
- **Also**: a foot in the door
- **Hint**: A first small step to get started.
- **Why**: FOOT is IN THE DOOR = FOOT IN THE DOOR
- **Example**: Helping at the cafe got me a foot in the door to cook there.
- **Choices**: door mat, front door, footstep

## ID: hole-in-one
- **Level**: tricky
- **Pattern**: inside
- **Visual**: HO{1}LE
- **Answer**: hole in one
- **Also**: a hole in one, hole in 1
- **Hint**: The best shot in golf!
- **Why**: ONE (1) is IN the HOLE = HOLE IN ONE
- **Example**: Dad got a hole in one at mini golf!
- **Choices**: golf ball, one hole, mini golf

## ID: head-in-the-clouds
- **Level**: tricky
- **Pattern**: inside
- **Visual**: CLO{HEAD}UDS
- **Answer**: head in the clouds
- **Also**: your head in the clouds
- **Hint**: Daydreaming and not paying attention.
- **Why**: HEAD is IN THE CLOUDS = HEAD IN THE CLOUDS
- **Example**: He walked past his own house with his head in the clouds.
- **Choices**: cloudy day, head over heels, sky high

## ID: ants-in-your-pants
- **Level**: tricky
- **Pattern**: inside
- **Visual**: PA{ANTS}NTS
- **Answer**: ants in your pants
- **Also**: ants in my pants, ants in his pants, ants in the pants
- **Hint**: When you just can't sit still! Hee hee.
- **Why**: ANTS are IN the PANTS = ANTS IN YOUR PANTS
- **Example**: Sit still! Do you have ants in your pants?
- **Choices**: picnic ants, pants on fire, ant hill

## ID: lost-in-space
- **Level**: medium
- **Pattern**: inside
- **Visual**: S P A {LOST} C E
- **Answer**: lost in space
- **Also**: lost in outer space
- **Hint**: An astronaut who can't find the way home.
- **Why**: LOST is IN S P A C E = LOST IN SPACE
- **Example**: In the movie, the astronaut was lost in space.
- **Choices**: outer space, spaceship, space race

## ID: man-in-the-moon
- **Level**: tricky
- **Pattern**: inside
- **Visual**: MO{MAN}ON
- **Answer**: man in the moon
- **Also**: the man in the moon
- **Hint**: Some people see a face up there at night.
- **Why**: MAN is IN THE MOON = MAN IN THE MOON
- **Example**: Can you see the man in the moon tonight?
- **Choices**: moonwalk, half moon, moonlight

## ID: sleeping-in
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: SLEEPING]
- **Answer**: sleeping in
- **Also**: sleep in, sleepin
- **Hint**: Staying in bed late on a holiday morning.
- **Why**: SLEEPING is IN the box = SLEEPING IN
- **Example**: It's Saturday, so I'm sleeping in!
- **Choices**: sleepover, bedtime, nap time

## ID: boxing
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: ING]
- **Answer**: boxing
- **Also**: box ing
- **Hint**: A sport with big puffy gloves.
- **Why**: A BOX with ING = BOX-ING = BOXING
- **Example**: My uncle wears big red gloves for boxing.
- **Choices**: wrestling, gift box, karate

## ID: once-in-a-while
- **Level**: tricky
- **Pattern**: inside
- **Visual**: WH{ONCE}ILE
- **Answer**: once in a while
- **Also**: every once in a while
- **Hint**: Not often, just sometimes.
- **Why**: ONCE is IN A WHILE = ONCE IN A WHILE
- **Example**: Once in a while, we eat pizza for dinner.
- **Choices**: all the time, once upon a time, a little while

## ID: keep-in-touch
- **Level**: tricky
- **Pattern**: inside
- **Visual**: TO{KEEP}UCH
- **Answer**: keep in touch
- **Also**: stay in touch
- **Hint**: What you say to a friend who moves away.
- **Why**: KEEP is IN TOUCH = KEEP IN TOUCH
- **Example**: You're moving away? Let's keep in touch!
- **Choices**: touch down, keep out, hold on

## ID: fish-in-the-sea
- **Level**: tricky
- **Pattern**: inside
- **Visual**: S{FISH}EA
- **Answer**: fish in the sea
- **Also**: plenty of fish in the sea, a fish in the sea
- **Hint**: Where the fish swim, under the waves.
- **Why**: FISH is IN THE SEA = FISH IN THE SEA
- **Example**: There are so many fish in the sea!
- **Choices**: seafood, fish tank, sea shell

## ID: cat-in-the-hat
- **Level**: tricky
- **Pattern**: inside
- **Visual**: H{CAT}AT
- **Answer**: the cat in the hat
- **Also**: cat in the hat
- **Hint**: A famous storybook cat with a tall striped hat.
- **Why**: CAT is IN THE HAT = THE CAT IN THE HAT
- **Example**: We read The Cat in the Hat at bedtime.
- **Choices**: top hat, cool cat, magic hat

## ID: mouse-in-the-house
- **Level**: medium
- **Pattern**: inside
- **Visual**: HO{MOUSE}USE
- **Answer**: mouse in the house
- **Also**: a mouse in the house
- **Hint**: Eek! Something tiny is running in the kitchen!
- **Why**: MOUSE is IN THE HOUSE = MOUSE IN THE HOUSE
- **Example**: Eek! There's a mouse in the house!
- **Choices**: mouse trap, dollhouse, house cat

## ID: time-out
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box] | TIME
- **Answer**: time out
- **Also**: timeout
- **Hint**: A short break in a game.
- **Why**: TIME is OUT of the box = TIME OUT
- **Example**: The coach called a time out.
- **Choices**: time's up, halftime, break time

## ID: left-out
- **Level**: medium
- **Pattern**: position
- **Visual**: OUT (left)
- **Answer**: left out
- **Also**: feeling left out
- **Hint**: How you feel when nobody asks you to play.
- **Why**: OUT is on the LEFT = LEFT OUT
- **Example**: Let's ask him to play so he doesn't feel left out.
- **Choices**: way out, left turn, keep out

## ID: low-battery
- **Level**: medium
- **Pattern**: position
- **Visual**: BATTERY (bottom)
- **Answer**: low battery
- **Also**: battery low
- **Hint**: Your tablet needs charging soon!
- **Why**: BATTERY is way down LOW = LOW BATTERY
- **Example**: My tablet says "low battery." I need to charge it.
- **Choices**: dead battery, full battery, charger

## ID: high-heels
- **Level**: medium
- **Pattern**: position
- **Visual**: HEELS (top)
- **Answer**: high heels
- **Also**: high heel
- **Hint**: Fancy shoes that make you taller.
- **Why**: HEELS are way up HIGH = HIGH HEELS
- **Example**: Mom wore high heels to the wedding.
- **Choices**: head over heels, sneakers, boots

## ID: left-behind
- **Level**: medium
- **Pattern**: position
- **Visual**: BEHIND (left)
- **Answer**: left behind
- **Hint**: When everyone goes and you're still here.
- **Why**: BEHIND is on the LEFT = LEFT BEHIND
- **Example**: Wait for me! I don't want to be left behind.
- **Choices**: behind you, left side, fall behind

## ID: right-on-time
- **Level**: tricky
- **Pattern**: position
- **Visual**: TIME (right)
- **Answer**: right on time
- **Also**: on time
- **Hint**: Not early, not late!
- **Why**: TIME is on the RIGHT = RIGHT ON TIME
- **Example**: The bus came right on time.
- **Choices**: just in time, last minute, right now

## ID: right-angle
- **Level**: medium
- **Pattern**: position
- **Visual**: ANGLE (right)
- **Answer**: right angle
- **Hint**: The square corner of a box. It is 90 degrees.
- **Why**: ANGLE is on the RIGHT = RIGHT ANGLE
- **Example**: A square has four right angles.
- **Choices**: triangle, corner, angel

## ID: bottom-line
- **Level**: medium
- **Pattern**: position
- **Visual**: LINE (bottom)
- **Answer**: bottom line
- **Also**: the bottom line
- **Hint**: The most important part, said short.
- **Why**: LINE is at the BOTTOM = BOTTOM LINE
- **Example**: The bottom line is: we need to clean our room.
- **Choices**: finish line, under line, line up

## ID: top-hat
- **Level**: easy
- **Pattern**: position
- **Visual**: HAT (top)
- **Answer**: top hat
- **Also**: tophat
- **Hint**: A tall hat a magician wears.
- **Why**: HAT is at the TOP = TOP HAT
- **Example**: The magician pulled a rabbit out of his top hat.
- **Choices**: sun hat, high hat, cowboy hat

## ID: high-jump
- **Level**: medium
- **Pattern**: position
- **Visual**: JUMP (top)
- **Answer**: high jump
- **Also**: highjump
- **Hint**: A sport where you leap over a tall bar.
- **Why**: JUMP is way up HIGH = HIGH JUMP
- **Example**: She cleared the bar in the high jump!
- **Choices**: long jump, jump rope, trampoline

## ID: uphill
- **Level**: easy
- **Pattern**: position
- **Visual**: HILL (top)
- **Answer**: uphill
- **Also**: up hill, up the hill
- **Hint**: Pedaling your bike this way is hard work!
- **Why**: HILL is UP at the top = UPHILL
- **Example**: Walking uphill makes my legs tired.
- **Choices**: downhill, hilltop, ant hill

## ID: all-right
- **Level**: medium
- **Pattern**: position
- **Visual**: ALL (right)
- **Answer**: all right
- **Also**: alright
- **Hint**: "Are you OK?" "Yes, I'm ___!"
- **Why**: ALL is on the RIGHT = ALL RIGHT
- **Example**: I fell down, but I'm all right.
- **Choices**: all done, right now, all together

## ID: on-the-right-track
- **Level**: tricky
- **Pattern**: position
- **Visual**: TRACK (right)
- **Answer**: on the right track
- **Also**: right track
- **Hint**: You're doing it the correct way. Keep going!
- **Why**: TRACK is on the RIGHT = ON THE RIGHT TRACK
- **Example**: Your answer is not done yet, but you're on the right track.
- **Choices**: race track, train track, off track

## ID: far-away
- **Level**: medium
- **Pattern**: position
- **Visual**: AWAY (bottom right, tiny)
- **Answer**: far away
- **Also**: faraway
- **Hint**: A place that is very, very distant.
- **Why**: AWAY is tiny and FAR in the corner = FAR AWAY
- **Example**: My grandma lives far away, so we visit by plane.
- **Choices**: go away, right away, far out

## ID: four-corners
- **Level**: medium
- **Pattern**: position
- **Visual**: CORNER (top left) | CORNER (top right) | CORNER (bottom left) | CORNER (bottom right)
- **Answer**: four corners
- **Also**: 4 corners
- **Hint**: A game where you run to one side of the room.
- **Why**: CORNER in all FOUR CORNERS = FOUR CORNERS
- **Example**: We played four corners in the gym.
- **Choices**: corner shop, square, four sides

## ID: around-the-clock
- **Level**: tricky
- **Pattern**: position
- **Visual**: 12 / 9 | CLOCK | 3 / 6
- **Answer**: around the clock
- **Also**: round the clock, all around the clock
- **Hint**: Working all day and all night.
- **Why**: The numbers go AROUND THE CLOCK!
- **Example**: Doctors at the hospital work around the clock.
- **Choices**: alarm clock, o'clock, tick tock

## ID: countdown
- **Level**: medium
- **Pattern**: typography
- **Visual**: 10  9  8  7  6  5  4  3  2  1
- **Answer**: countdown
- **Also**: count down
- **Hint**: What you shout before a rocket blasts off!
- **Why**: Counting DOWN from 10 to 1 = COUNTDOWN
- **Example**: The countdown started: three, two, one, blast off!
- **Choices**: count to ten, blast off, numbers

## ID: slow-down
- **Level**: medium
- **Pattern**: direction
- **Visual**: SLOW (vertical)
- **Answer**: slow down
- **Hint**: What a grown-up says when you run too fast.
- **Why**: SLOW goes DOWN = SLOW DOWN
- **Example**: Slow down! The floor is wet.
- **Choices**: speed up, slow motion, sit down

## ID: look-up
- **Level**: medium
- **Pattern**: direction
- **Visual**: LOOK (sideways)
- **Answer**: look up
- **Also**: look up high
- **Hint**: What to do to see the stars.
- **Why**: LOOK reads going UP = LOOK UP
- **Example**: Look up! There's a rainbow!
- **Choices**: look down, look out, stand up

## ID: cheer-up
- **Level**: medium
- **Pattern**: direction
- **Visual**: CHEER (rising)
- **Answer**: cheer up
- **Hint**: What you say to a friend who feels sad.
- **Why**: CHEER goes UP = CHEER UP
- **Example**: Cheer up! We can try again tomorrow.
- **Choices**: cheerleader, cheers, give up

## ID: falling-star
- **Level**: medium
- **Pattern**: direction
- **Visual**: STAR (falling)
- **Answer**: falling star
- **Also**: shooting star
- **Hint**: Make a wish when you see one at night!
- **Why**: STAR is FALLING = FALLING STAR
- **Example**: I saw a falling star and made a wish.
- **Choices**: starfish, star light, sunset

## ID: go-back
- **Level**: easy
- **Pattern**: typography
- **Visual**: GO (backwards)
- **Answer**: go back
- **Hint**: Turn around and return.
- **Why**: GO is written BACKwards = GO BACK
- **Example**: I forgot my hat. Let's go back and get it.
- **Choices**: go away, come back, go on

## ID: upside-down-cake
- **Level**: medium
- **Pattern**: typography
- **Visual**: CAKE (upside down)
- **Answer**: upside down cake
- **Also**: upside-down cake, pineapple upside down cake
- **Hint**: A cake you flip over, often with pineapple on top.
- **Why**: CAKE is UPSIDE DOWN = UPSIDE DOWN CAKE
- **Example**: Grandma baked a pineapple upside down cake.
- **Choices**: cupcake, cake pop, birthday cake

## ID: falling-leaves
- **Level**: medium
- **Pattern**: direction
- **Visual**: LEAVES (falling)
- **Answer**: falling leaves
- **Also**: fall leaves, leaves falling
- **Hint**: What you see in autumn under the trees.
- **Why**: LEAVES are FALLING = FALLING LEAVES
- **Example**: We jumped in the falling leaves.
- **Choices**: tree house, leaf pile, autumn

## ID: snowfall
- **Level**: medium
- **Pattern**: direction
- **Visual**: SNOW (falling)
- **Answer**: snowfall
- **Also**: snow fall, falling snow
- **Hint**: When winter flakes come down from the sky.
- **Why**: SNOW is FALLING = SNOWFALL
- **Example**: After the big snowfall, we built a snowman.
- **Choices**: snowman, snowball, snow day

## ID: growing-pains
- **Level**: tricky
- **Pattern**: size
- **Visual**: PAINS (growing)
- **Answer**: growing pains
- **Also**: growing pain
- **Hint**: Achy legs some kids get when they get taller.
- **Why**: PAINS are GROWING = GROWING PAINS
- **Example**: My legs hurt at night. The doctor said they're growing pains.
- **Choices**: growing up, tummy ache, big pain

## ID: big-mouth
- **Level**: easy
- **Pattern**: size
- **Visual**: MOUTH (big)
- **Answer**: big mouth
- **Also**: bigmouth
- **Hint**: Someone who can't keep a secret!
- **Why**: MOUTH is BIG = BIG MOUTH
- **Example**: Don't tell him the surprise. He has a big mouth!
- **Choices**: loud mouth, big smile, big teeth

## ID: bigfoot
- **Level**: easy
- **Pattern**: size
- **Visual**: FOOT (big)
- **Answer**: bigfoot
- **Also**: big foot
- **Hint**: A hairy, mysterious giant in the forest.
- **Why**: FOOT is BIG = BIGFOOT
- **Example**: Some people say Bigfoot lives in the forest.
- **Choices**: football, footprint, giant

## ID: little-mermaid
- **Level**: medium
- **Pattern**: size
- **Visual**: mermaid (tiny)
- **Answer**: the little mermaid
- **Also**: little mermaid
- **Hint**: A princess who lives under the sea and wants legs.
- **Why**: MERMAID is LITTLE = THE LITTLE MERMAID
- **Example**: We watched The Little Mermaid together.
- **Choices**: sea princess, starfish, big fish

## ID: big-bang
- **Level**: medium
- **Pattern**: size
- **Visual**: BANG (big)
- **Answer**: big bang
- **Also**: the big bang
- **Hint**: How some scientists say the universe began.
- **Why**: BANG is BIG = BIG BANG
- **Example**: Scientists say the universe began with the Big Bang.
- **Choices**: fireworks, loud noise, bang bang

## ID: small-world
- **Level**: medium
- **Pattern**: size
- **Visual**: world (tiny)
- **Answer**: small world
- **Also**: it's a small world, its a small world
- **Hint**: "You know her too? It's a ___!"
- **Why**: WORLD is SMALL = (IT'S A) SMALL WORLD
- **Example**: You know my cousin too? It's a small world!
- **Choices**: world map, big world, little world

## ID: big-apple
- **Level**: tricky
- **Pattern**: size
- **Visual**: APPLE (big)
- **Answer**: the big apple
- **Also**: big apple
- **Hint**: A nickname for New York City.
- **Why**: APPLE is BIG = THE BIG APPLE
- **Example**: New York City is called the Big Apple.
- **Choices**: apple pie, red apple, pineapple

## ID: little-bit
- **Level**: easy
- **Pattern**: size
- **Visual**: bit (tiny)
- **Answer**: a little bit
- **Also**: little bit
- **Hint**: Just a tiny amount.
- **Why**: BIT is LITTLE = A LITTLE BIT
- **Example**: Can I have a little bit more soup, please?
- **Choices**: a lot, big bite, bit by bit

## ID: short-story
- **Level**: medium
- **Pattern**: size
- **Visual**: STORY (small)
- **Answer**: short story
- **Also**: a short story
- **Hint**: A tale you can read in one sitting.
- **Why**: STORY is SHORT = SHORT STORY
- **Example**: I wrote a short story about a brave owl.
- **Choices**: story time, tall tale, storybook

## ID: long-time
- **Level**: medium
- **Pattern**: size
- **Visual**: TIME (stretched)
- **Answer**: long time
- **Also**: a long time, long time no see
- **Hint**: When you haven't seen a friend for ages!
- **Why**: TIME is stretched LONG = A LONG TIME
- **Example**: I haven't seen you in a long time!
- **Choices**: last minute, time out, short time

## ID: big-brother
- **Level**: easy
- **Pattern**: size
- **Visual**: BROTHER (big)
- **Answer**: big brother
- **Also**: older brother
- **Hint**: An older boy in your family.
- **Why**: BROTHER is BIG = BIG BROTHER
- **Example**: My big brother helps me with my homework.
- **Choices**: little brother, sister, twin

## ID: little-sister
- **Level**: easy
- **Pattern**: size
- **Visual**: sister (tiny)
- **Answer**: little sister
- **Also**: younger sister, baby sister
- **Hint**: A younger girl in your family.
- **Why**: SISTER is LITTLE = LITTLE SISTER
- **Example**: My little sister loves to play with dolls.
- **Choices**: big sister, brother, cousin

## ID: think-big
- **Level**: medium
- **Pattern**: size
- **Visual**: THINK (big)
- **Answer**: think big
- **Hint**: Dream about something huge and amazing!
- **Why**: THINK is BIG = THINK BIG
- **Example**: Think big! You can be anything you want.
- **Choices**: think twice, big idea, think again

## ID: shortcut
- **Level**: medium
- **Pattern**: size
- **Visual**: CUT (small)
- **Answer**: shortcut
- **Also**: short cut
- **Hint**: A quicker way to get there.
- **Why**: CUT is SHORT = SHORTCUT
- **Example**: We took a shortcut through the park.
- **Choices**: haircut, cut out, long way

## ID: long-jump
- **Level**: medium
- **Pattern**: size
- **Visual**: JUMP (stretched)
- **Answer**: long jump
- **Also**: longjump
- **Hint**: A sport where you run and leap far into sand.
- **Why**: JUMP is stretched LONG = LONG JUMP
- **Example**: I jumped three meters in the long jump!
- **Choices**: high jump, jump rope, hopscotch

## ID: wide-awake
- **Level**: medium
- **Pattern**: size
- **Visual**: AWAKE (stretched)
- **Answer**: wide awake
- **Hint**: When you can't fall asleep at all!
- **Why**: AWAKE is stretched WIDE = WIDE AWAKE
- **Example**: I drank cocoa, but I'm still wide awake.
- **Choices**: fast asleep, wake up, good morning

## ID: wide-open
- **Level**: medium
- **Pattern**: size
- **Visual**: OPEN (stretched)
- **Answer**: wide open
- **Also**: open wide
- **Hint**: What the dentist says: "Open ___!"
- **Why**: OPEN is stretched WIDE = WIDE OPEN
- **Example**: The door was wide open, so the cat ran out.
- **Choices**: open door, closed, open up

## ID: two-left-feet
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: FEET (left, x2)
- **Answer**: two left feet
- **Also**: 2 left feet
- **Hint**: Someone who can't dance well. Oops!
- **Why**: Two FEET on the LEFT = TWO LEFT FEET
- **Example**: I can't dance. I have two left feet!
- **Choices**: big feet, tiptoe, dance shoes

## ID: three-little-pigs
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: pig (tiny) | pig (tiny) | pig (tiny)
- **Answer**: three little pigs
- **Also**: the three little pigs, 3 little pigs
- **Hint**: They built houses of straw, sticks and bricks.
- **Why**: Three LITTLE PIGs = THREE LITTLE PIGS
- **Example**: The wolf could not blow down the third house of the three little pigs.
- **Choices**: piggy bank, three bears, farm animals

## ID: two-heads-better
- **Level**: tricky
- **Pattern**: math
- **Visual**: HEAD HEAD > HEAD
- **Answer**: two heads are better than one
- **Also**: two heads better than one
- **Hint**: Working together is smarter than working alone.
- **Why**: Two HEADs are bigger (>) than one HEAD!
- **Example**: Let's do the puzzle together. Two heads are better than one!
- **Choices**: head to head, heads up, use your head

## ID: four-seasons
- **Level**: medium
- **Pattern**: quantity
- **Visual**: SEASON (x4)
- **Answer**: four seasons
- **Also**: the four seasons, 4 seasons
- **Hint**: Spring, summer, fall and winter.
- **Why**: Four SEASONs = FOUR SEASONS
- **Example**: Japan has four seasons.
- **Choices**: rainy season, all year, four weeks

## ID: seven-dwarfs
- **Level**: medium
- **Pattern**: quantity
- **Visual**: DWARF (x7)
- **Answer**: seven dwarfs
- **Also**: the seven dwarfs, 7 dwarfs
- **Hint**: Snow White's little friends.
- **Why**: Seven DWARFs = THE SEVEN DWARFS
- **Example**: Snow White lived with the seven dwarfs.
- **Choices**: seven days, three bears, small friends

## ID: twelve-months
- **Level**: medium
- **Pattern**: quantity
- **Visual**: MONTH (x12)
- **Answer**: twelve months
- **Also**: 12 months, one year, a year
- **Hint**: January to December.
- **Why**: Twelve MONTHs = TWELVE MONTHS (one year)
- **Example**: There are twelve months in a year.
- **Choices**: one month, calendar, twelve days

## ID: nine-lives
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: LIFE (x9)
- **Answer**: nine lives
- **Also**: 9 lives, a cat has nine lives
- **Hint**: People say a cat has this many.
- **Why**: Nine LIVES = NINE LIVES
- **Example**: My cat fell off the fence but was fine. She must have nine lives!
- **Choices**: cloud nine, cat nap, long life

## ID: double-cheeseburger
- **Level**: medium
- **Pattern**: quantity
- **Visual**: CHEESEBURGER / CHEESEBURGER
- **Answer**: double cheeseburger
- **Also**: double cheese burger
- **Hint**: A burger with two patties. Yum!
- **Why**: Two CHEESEBURGERs = DOUBLE CHEESEBURGER
- **Example**: Dad ordered a double cheeseburger and fries.
- **Choices**: hot dog, big burger, cheese pizza

## ID: a-dozen-eggs
- **Level**: medium
- **Pattern**: quantity
- **Visual**: EGG (x12)
- **Answer**: a dozen eggs
- **Also**: dozen eggs, twelve eggs, 12 eggs
- **Hint**: What comes in a carton from the store.
- **Why**: Twelve EGGs = A DOZEN EGGS
- **Example**: Mom bought a dozen eggs at the store.
- **Choices**: egg hunt, scrambled eggs, bird nest

## ID: pair-of-socks
- **Level**: easy
- **Pattern**: quantity
- **Visual**: SOCK | SOCK
- **Answer**: pair of socks
- **Also**: a pair of socks, two socks
- **Hint**: You wear them on your feet, one on each.
- **Why**: Two SOCKs = A PAIR OF SOCKS
- **Example**: I can't find a matching pair of socks!
- **Choices**: stinky socks, shoes, mittens

## ID: think-twice
- **Level**: medium
- **Pattern**: quantity
- **Visual**: THINK | THINK
- **Answer**: think twice
- **Hint**: Be careful before you decide!
- **Why**: THINK two times = THINK TWICE
- **Example**: Think twice before you jump into the cold pool!
- **Choices**: think big, think again, double trouble

## ID: again-and-again
- **Level**: medium
- **Pattern**: quantity
- **Visual**: AGAIN (x4)
- **Answer**: again and again
- **Hint**: Doing something many, many times.
- **Why**: AGAIN, AGAIN, AGAIN… = AGAIN AND AGAIN
- **Example**: We sang the song again and again.
- **Choices**: one more time, try again, never again

## ID: envy
- **Level**: medium
- **Pattern**: sound
- **Visual**: NV
- **Answer**: envy
- **Hint**: Wishing you had what someone else has.
- **Why**: Say the letters: N-V = ENVY
- **Example**: My friend looked at my new bike with envy.
- **Choices**: navy, nervous, ivy

## ID: enemy
- **Level**: medium
- **Pattern**: sound
- **Visual**: NME
- **Answer**: enemy
- **Hint**: The opposite of a friend.
- **Why**: Say the letters: N-M-E = ENEMY
- **Example**: In the game, the dragon is the enemy.
- **Choices**: army, any me, energy

## ID: icy
- **Level**: medium
- **Pattern**: sound
- **Visual**: IC
- **Answer**: icy
- **Hint**: Slippery and frozen, like a winter road.
- **Why**: Say the letters: I-C = ICY
- **Example**: Be careful, the road is icy!
- **Choices**: ice cube, I see, icicle

## ID: extra-large
- **Level**: medium
- **Pattern**: sound
- **Visual**: XL
- **Answer**: extra large
- **Also**: extra-large
- **Hint**: The biggest T-shirt size.
- **Why**: XL is short for EXTRA LARGE!
- **Example**: Dad's T-shirt is extra large.
- **Choices**: excellent, x-ray, small

## ID: essay
- **Level**: tricky
- **Pattern**: sound
- **Visual**: SA
- **Answer**: essay
- **Hint**: A piece of writing you do for school.
- **Why**: Say the letters: S-A = ESSAY
- **Example**: I wrote an essay about my summer.
- **Choices**: say, easy, essay test

## ID: ivy
- **Level**: medium
- **Pattern**: sound
- **Visual**: IV
- **Answer**: ivy
- **Hint**: A green plant that climbs up walls.
- **Why**: Say the letters: I-V = IVY
- **Example**: Green ivy grows on the old school wall.
- **Choices**: four, envy, vine

## ID: tepee
- **Level**: medium
- **Pattern**: sound
- **Visual**: TP
- **Answer**: tepee
- **Also**: teepee, tipi
- **Hint**: A cone-shaped tent.
- **Why**: Say the letters: T-P = TEPEE
- **Example**: We slept in a tepee at summer camp.
- **Choices**: toilet paper, tent, tape

## ID: wait-for-me
- **Level**: medium
- **Pattern**: sound
- **Visual**: W8 4 ME
- **Answer**: wait for me
- **Also**: w8 4 me
- **Hint**: What you shout when your friends walk too fast!
- **Why**: W8 = WAIT, 4 = FOR: WAIT FOR ME
- **Example**: Hey, wait for me!
- **Choices**: weight for me, wait a minute, come here

## ID: see-you-soon
- **Level**: medium
- **Pattern**: sound
- **Visual**: C U SOON
- **Answer**: see you soon
- **Also**: see u soon
- **Hint**: A happy goodbye when you'll meet again quickly.
- **Why**: C = SEE, U = YOU: SEE YOU SOON
- **Example**: Bye, Grandma! See you soon!
- **Choices**: see you later, goodbye, so soon

## ID: for-sure
- **Level**: medium
- **Pattern**: sound
- **Visual**: 4 SURE
- **Answer**: for sure
- **Also**: 4 sure
- **Hint**: Yes, definitely!
- **Why**: 4 = FOR: FOR SURE
- **Example**: Are you coming to my party? For sure!
- **Choices**: four sure, of course, not sure

## ID: too-cool
- **Level**: medium
- **Pattern**: sound
- **Visual**: 2 COOL
- **Answer**: too cool
- **Also**: 2 cool, too cool for school
- **Hint**: Super awesome!
- **Why**: 2 = TOO: TOO COOL
- **Example**: Your new skateboard is too cool!
- **Choices**: two cool, so cool, cool down

## ID: you-too
- **Level**: easy
- **Pattern**: sound
- **Visual**: U 2
- **Answer**: you too
- **Also**: u 2, you 2
- **Hint**: "Have a nice day!" "___!"
- **Why**: U = YOU, 2 = TOO: YOU TOO
- **Example**: "Have a nice day!" "You too!"
- **Choices**: me too, u turn, two of you

## ID: to-be-or-not-to-be
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 2B OR NOT 2B
- **Answer**: to be or not to be
- **Also**: 2b or not 2b
- **Hint**: A famous line from a very old play by Shakespeare.
- **Why**: 2B = TO BE: TO BE OR NOT TO BE
- **Example**: "To be or not to be" is a famous line from Hamlet.
- **Choices**: two bees, or not, be quiet

## ID: wonton
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 1 TON
- **Answer**: wonton
- **Also**: won ton, wonton soup
- **Hint**: A dumpling you can eat in soup.
- **Why**: 1 = ONE (WON) + TON = WONTON!
- **Example**: I love wonton soup.
- **Choices**: one ton, dumpling, heavy

## ID: tutu
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 2 2
- **Answer**: tutu
- **Also**: tu tu
- **Hint**: A puffy skirt a ballerina wears.
- **Why**: 2 2 = TWO TWO = TUTU!
- **Example**: The ballerina wore a pink tutu.
- **Choices**: twenty two, two two, tiara

## ID: potato
- **Level**: tricky
- **Pattern**: sound
- **Visual**: POT 8 O
- **Answer**: potato
- **Hint**: You can mash it, bake it or make fries with it.
- **Why**: POT + 8 (ATE) + O = POTATO!
- **Example**: I want a baked potato with cheese.
- **Choices**: tomato, pot of gold, pot pie

## ID: free-for-all
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 3 4 ALL
- **Answer**: free for all
- **Also**: free-for-all
- **Hint**: Everyone can join in, no rules!
- **Why**: 3 = FREE, 4 = FOR: FREE FOR ALL
- **Example**: The cake was free for all at the party.
- **Choices**: three for all, all for one, seven

## ID: skate
- **Level**: medium
- **Pattern**: sound
- **Visual**: SK8
- **Answer**: skate
- **Also**: sk8
- **Hint**: Glide on wheels or on ice!
- **Why**: SK + 8 (EIGHT) = SKATE!
- **Example**: I learned to skate on the ice rink.
- **Choices**: skateboard, skip, eight

## ID: create
- **Level**: medium
- **Pattern**: sound
- **Visual**: CRE8
- **Answer**: create
- **Also**: cre8
- **Hint**: To make something new.
- **Why**: CRE + 8 (EIGHT) = CREATE!
- **Example**: Let's create a comic book together!
- **Choices**: crate, crayon, great

## ID: missing
- **Level**: tricky
- **Pattern**: missing
- **Visual**: M SS NG
- **Answer**: missing
- **Also**: missing i
- **Hint**: Something is gone! Look at the letters.
- **Why**: MISSING with the I's missing = MISSING!
- **Example**: One of my socks is missing.
- **Choices**: messing, mess, nothing

## ID: noel
- **Level**: tricky
- **Pattern**: missing
- **Visual**: ABCDEFGHIJKMNOPQRSTUVWXYZ
- **Answer**: noel
- **Also**: no l, no el
- **Hint**: A Christmas word. Which letter is gone?
- **Why**: The alphabet has NO L = NOEL!
- **Example**: We sang "The First Noel" at the Christmas concert.
- **Choices**: alphabet, abc, christmas

## ID: cross-my-heart
- **Level**: tricky
- **Pattern**: position
- **Visual**: HEART (cross)
- **Answer**: cross my heart
- **Also**: cross your heart
- **Hint**: What you say when you promise to tell the truth.
- **Why**: HEART crosses itself = CROSS MY HEART
- **Example**: I didn't eat your cookie, cross my heart!
- **Choices**: broken heart, heartbeat, sweetheart

## ID: crossword
- **Level**: medium
- **Pattern**: position
- **Visual**: WORD (cross)
- **Answer**: crossword
- **Also**: cross word, crossword puzzle
- **Hint**: A puzzle with words going across and down.
- **Why**: WORD crosses WORD = CROSSWORD
- **Example**: Grandpa does the crossword every morning.
- **Choices**: password, word search, crossroads

## ID: broken-promise
- **Level**: tricky
- **Pattern**: split
- **Visual**: PRO (tilted) | MISE (tilted)
- **Answer**: broken promise
- **Also**: a broken promise
- **Hint**: When someone doesn't do what they said. Sad!
- **Why**: The word PROMISE is broken = BROKEN PROMISE
- **Example**: He said he would come, but it was a broken promise.
- **Choices**: pinky promise, broken heart, promise ring

## ID: mixed-feelings
- **Level**: medium
- **Pattern**: typography
- **Visual**: FEELINGS (jumbled)
- **Answer**: mixed feelings
- **Also**: mixed up feelings
- **Hint**: Happy and sad at the same time.
- **Why**: FEELINGS are all mixed up = MIXED FEELINGS
- **Example**: I had mixed feelings about moving to a new town.
- **Choices**: good feelings, hurt feelings, mood swing

## ID: tossed-salad
- **Level**: medium
- **Pattern**: typography
- **Visual**: SALAD (jumbled)
- **Answer**: tossed salad
- **Also**: mixed salad
- **Hint**: A bowl of greens all mixed together.
- **Why**: SALAD is tossed around = TOSSED SALAD
- **Example**: We had a tossed salad with tomatoes and cucumbers.
- **Choices**: fruit salad, salad bar, sandwich

## ID: red-alert
- **Level**: medium
- **Pattern**: color
- **Visual**: {ALERT}
- **Answer**: red alert
- **Hint**: Danger! Everybody watch out!
- **Why**: ALERT in RED = RED ALERT
- **Example**: The ship was on red alert during the storm.
- **Choices**: fire alarm, red light, stop sign

## ID: little-red-riding-hood
- **Level**: tricky
- **Pattern**: color
- **Visual**: {HOOD} (tiny)
- **Answer**: little red riding hood
- **Also**: little red
- **Hint**: A girl in a red cape visiting her grandma… and a wolf!
- **Why**: A LITTLE RED HOOD = LITTLE RED RIDING HOOD
- **Example**: Little Red Riding Hood took a basket to her grandma.
- **Choices**: red cape, robin hood, big bad wolf

## ID: bird-in-the-hand
- **Level**: tricky
- **Pattern**: inside
- **Visual**: HA{BIRD}ND
- **Answer**: a bird in the hand
- **Also**: bird in the hand
- **Hint**: Something you already have is better than something you might get.
- **Why**: BIRD is IN the HAND = A BIRD IN THE HAND
- **Example**: A bird in the hand is worth two in the bush.
- **Choices**: bird nest, hand in hand, birdhouse

## ID: singing-in-the-rain
- **Level**: medium
- **Pattern**: inside
- **Visual**: RA{SING}IN
- **Answer**: singing in the rain
- **Also**: sing in the rain
- **Hint**: Happy music even on a wet day.
- **Why**: SING is IN the RAIN = SINGING IN THE RAIN
- **Example**: We were singing in the rain with our umbrellas.
- **Choices**: rainbow, rainy day, raindrop

## ID: money-in-the-bank
- **Level**: medium
- **Pattern**: inside
- **Visual**: BA{MONEY}NK
- **Answer**: money in the bank
- **Hint**: Saved coins that are kept safe.
- **Why**: MONEY is IN the BANK = MONEY IN THE BANK
- **Example**: I keep my birthday money in the bank.
- **Choices**: piggy bank, bank card, pocket money

## ID: needle-in-a-haystack
- **Level**: tricky
- **Pattern**: inside
- **Visual**: HAY{NEEDLE}STACK
- **Answer**: a needle in a haystack
- **Also**: needle in a haystack
- **Hint**: Something very, very hard to find.
- **Why**: NEEDLE is IN the HAYSTACK = A NEEDLE IN A HAYSTACK
- **Example**: Finding my earring on the beach was like looking for a needle in a haystack.
- **Choices**: sewing kit, hay ride, farm work

## ID: stuck-in-the-middle
- **Level**: tricky
- **Pattern**: inside
- **Visual**: MID{STUCK}DLE
- **Answer**: stuck in the middle
- **Hint**: Caught between two sides.
- **Why**: STUCK is IN THE MIDDLE = STUCK IN THE MIDDLE
- **Example**: I was stuck in the middle of the back seat.
- **Choices**: middle school, stuck up, sticky

## ID: in-love
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: LOVE]
- **Answer**: in love
- **Also**: fall in love, fell in love
- **Hint**: A very strong, happy feeling for someone.
- **Why**: LOVE is IN the box = IN LOVE
- **Example**: In the story, the prince fell in love with the princess.
- **Choices**: lovely, love letter, best friend

## ID: in-trouble
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: TROUBLE]
- **Answer**: in trouble
- **Hint**: Uh-oh! Someone is going to be told off.
- **Why**: TROUBLE is IN the box = IN TROUBLE
- **Example**: Uh-oh, I'm in trouble for breaking the vase!
- **Choices**: double trouble, no problem, trouble maker

## ID: in-charge
- **Level**: tricky
- **Pattern**: inside
- **Visual**: [box: CHARGE]
- **Answer**: in charge
- **Hint**: The one who makes the rules for now.
- **Why**: CHARGE is IN the box = IN CHARGE
- **Example**: The teacher put me in charge of the class pet.
- **Choices**: charger, battery, the boss

## ID: inbox
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box: IN]
- **Answer**: inbox
- **Also**: in box
- **Hint**: Where your new emails arrive.
- **Why**: IN is in a BOX = INBOX
- **Example**: I have a new email in my inbox.
- **Choices**: lunchbox, mailbox, toy box

## ID: sold-out
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box] | SOLD
- **Answer**: sold out
- **Hint**: There are no more left to buy.
- **Why**: SOLD is OUT of the box = SOLD OUT
- **Example**: The cookies were sold out before lunch!
- **Choices**: for sale, shopping, all gone

## ID: watch-out
- **Level**: easy
- **Pattern**: inside
- **Visual**: [box] | WATCH
- **Answer**: watch out
- **Also**: look out
- **Hint**: Be careful! Something is coming!
- **Why**: WATCH is OUT of the box = WATCH OUT
- **Example**: Watch out for the puddle!
- **Choices**: wristwatch, watch tv, stop

## ID: work-out
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box] | WORK
- **Answer**: work out
- **Also**: workout, working out
- **Hint**: Exercise to get strong.
- **Why**: WORK is OUT of the box = WORK OUT
- **Example**: My dad likes to work out at the gym.
- **Choices**: homework, hard work, run

## ID: way-out
- **Level**: medium
- **Pattern**: inside
- **Visual**: [box] | WAY
- **Answer**: way out
- **Also**: the way out
- **Hint**: The exit! How to leave.
- **Why**: WAY is OUT of the box = WAY OUT
- **Example**: Where is the way out of this maze?
- **Choices**: highway, one way, front door

## ID: out-of-this-world
- **Level**: tricky
- **Pattern**: inside
- **Visual**: [box: THIS WORLD] | YUM (top right)
- **Answer**: out of this world
- **Hint**: Amazing! So good it can't be from here.
- **Why**: YUM is OUT OF THIS WORLD!
- **Example**: Grandma's apple pie is out of this world!
- **Choices**: all over the world, outer space, world map

## ID: over-the-rainbow
- **Level**: tricky
- **Pattern**: position
- **Visual**: SOMEWHERE / RAINBOW
- **Answer**: somewhere over the rainbow
- **Also**: over the rainbow
- **Hint**: A famous dreamy song from The Wizard of Oz.
- **Why**: SOMEWHERE is OVER THE RAINBOW
- **Example**: We sang "Somewhere Over the Rainbow" in music class.
- **Choices**: end of the rainbow, rainy day, pot of gold

## ID: under-pressure
- **Level**: tricky
- **Pattern**: position
- **Visual**: PRESSURE / ME
- **Answer**: under pressure
- **Hint**: When there is a lot of stress and not much time.
- **Why**: ME is UNDER PRESSURE = UNDER PRESSURE
- **Example**: It's hard to think under pressure.
- **Choices**: high pressure, pressed, in a hurry

## ID: under-control
- **Level**: tricky
- **Pattern**: position
- **Visual**: CONTROL / IT
- **Answer**: under control
- **Also**: it's under control, it is under control
- **Hint**: Everything is OK. I can handle it.
- **Why**: IT is UNDER CONTROL = UNDER CONTROL
- **Example**: Don't worry, everything is under control.
- **Choices**: remote control, out of control, game controller

## ID: everything-under-the-sun
- **Level**: tricky
- **Pattern**: position
- **Visual**: SUN / EVERYTHING
- **Answer**: everything under the sun
- **Hint**: Every kind of thing you can think of.
- **Why**: EVERYTHING is UNDER THE SUN
- **Example**: That shop sells everything under the sun.
- **Choices**: sunshine, everything is fine, sun hat

## ID: underline
- **Level**: easy
- **Pattern**: position
- **Visual**: TEXT / [line]
- **Answer**: underline
- **Also**: underlined, under line
- **Hint**: A line you draw below a word.
- **Why**: A line UNDER the word = UNDERLINE
- **Example**: Underline the title with a ruler.
- **Choices**: headline, outline, line up

## ID: upper-hand
- **Level**: tricky
- **Pattern**: position
- **Visual**: HAND (top)
- **Answer**: the upper hand
- **Also**: upper hand
- **Hint**: When you are winning and in control.
- **Why**: HAND is UP at the top = THE UPPER HAND
- **Example**: With two goals, we had the upper hand.
- **Choices**: high five, hand up, second hand

## ID: high-hopes
- **Level**: tricky
- **Pattern**: position
- **Visual**: HOPES (top)
- **Answer**: high hopes
- **Hint**: Wishing for something really good.
- **Why**: HOPES are up HIGH = HIGH HOPES
- **Example**: We have high hopes for our team this year.
- **Choices**: hopeless, good luck, big dreams

## ID: high-tide
- **Level**: medium
- **Pattern**: position
- **Visual**: TIDE (top)
- **Answer**: high tide
- **Hint**: When the sea comes up the beach.
- **Why**: TIDE is up HIGH = HIGH TIDE
- **Example**: At high tide, the water covers the rocks.
- **Choices**: low tide, big wave, seashore

## ID: high-score
- **Level**: easy
- **Pattern**: position
- **Visual**: SCORE (top)
- **Answer**: high score
- **Also**: highscore, high scores
- **Hint**: The best number of points in a game.
- **Why**: SCORE is up HIGH = HIGH SCORE
- **Example**: I got a new high score!
- **Choices**: scoreboard, top score, game over

## ID: top-floor
- **Level**: easy
- **Pattern**: position
- **Visual**: FLOOR (top)
- **Answer**: top floor
- **Hint**: The highest level of a building.
- **Why**: FLOOR is at the TOP = TOP FLOOR
- **Example**: We live on the top floor.
- **Choices**: ground floor, rooftop, upstairs

## ID: ground-floor
- **Level**: medium
- **Pattern**: position
- **Visual**: FLOOR (bottom)
- **Answer**: ground floor
- **Also**: first floor
- **Hint**: The level of a building at the street.
- **Why**: FLOOR is at the bottom, on the GROUND = GROUND FLOOR
- **Example**: The cafe is on the ground floor.
- **Choices**: top floor, basement, downstairs

## ID: uppercase
- **Level**: medium
- **Pattern**: typography
- **Visual**: CASE (top)
- **Answer**: uppercase
- **Also**: upper case, capital letters
- **Hint**: BIG letters like A, B and C.
- **Why**: Capital letters UP at the top = UPPERCASE
- **Example**: Write your name in uppercase letters.
- **Choices**: lowercase, suitcase, bookcase

## ID: lowercase
- **Level**: medium
- **Pattern**: typography
- **Visual**: case (bottom)
- **Answer**: lowercase
- **Also**: lower case, small letters
- **Hint**: Small letters like a, b and c.
- **Why**: Small letters DOWN LOW = LOWERCASE
- **Example**: Write the word in lowercase letters.
- **Choices**: uppercase, pencil case, small talk

## ID: middle-name
- **Level**: medium
- **Pattern**: position
- **Visual**: TOM | NAME | LEE
- **Answer**: middle name
- **Hint**: The name between your first and last name.
- **Why**: NAME is in the MIDDLE = MIDDLE NAME
- **Example**: My middle name is Rose.
- **Choices**: nickname, last name, name tag

## ID: corner-store
- **Level**: medium
- **Pattern**: position
- **Visual**: STORE (bottom right)
- **Answer**: corner store
- **Also**: corner shop
- **Hint**: A small shop on the street corner.
- **Why**: STORE is in the CORNER = CORNER STORE
- **Example**: We bought milk at the corner store.
- **Choices**: toy store, four corners, supermarket

## ID: big-cheese
- **Level**: tricky
- **Pattern**: size
- **Visual**: CHEESE (big)
- **Answer**: big cheese
- **Also**: the big cheese
- **Hint**: The most important person in charge.
- **Why**: CHEESE is BIG = BIG CHEESE
- **Example**: The principal is the big cheese at our school.
- **Choices**: cheeseburger, say cheese, blue cheese

## ID: small-print
- **Level**: tricky
- **Pattern**: size
- **Visual**: print (tiny)
- **Answer**: small print
- **Also**: fine print
- **Hint**: Tiny words at the bottom of a paper. Read them carefully!
- **Why**: PRINT is SMALL = SMALL PRINT
- **Example**: Read the small print before you sign.
- **Choices**: printer, footprint, big letters

## ID: little-by-little
- **Level**: medium
- **Pattern**: size
- **Visual**: little (tiny) | little (tiny)
- **Answer**: little by little
- **Also**: bit by bit
- **Hint**: Slowly, a tiny bit at a time.
- **Why**: LITTLE is BY (next to) LITTLE = LITTLE BY LITTLE
- **Example**: Little by little, my tower got taller.
- **Choices**: a little bit, step by step, side by side

## ID: long-face
- **Level**: tricky
- **Pattern**: size
- **Visual**: FACE (stretched)
- **Answer**: long face
- **Also**: a long face, why the long face
- **Hint**: A sad look.
- **Why**: FACE is stretched LONG = LONG FACE
- **Example**: Why the long face? Did you lose your toy?
- **Choices**: funny face, face to face, big smile

## ID: big-heart
- **Level**: easy
- **Pattern**: size
- **Visual**: HEART (big)
- **Answer**: big heart
- **Also**: a big heart
- **Hint**: Someone very kind and caring.
- **Why**: HEART is BIG = BIG HEART
- **Example**: My grandma has a big heart.
- **Choices**: broken heart, heartbeat, sweetheart

## ID: a-little-help
- **Level**: medium
- **Pattern**: size
- **Visual**: help (tiny)
- **Answer**: a little help
- **Also**: little help
- **Hint**: Just a small amount of help.
- **Why**: HELP is LITTLE = A LITTLE HELP
- **Example**: Can I get a little help with this box?
- **Choices**: helper, help me, first aid

## ID: short-and-sweet
- **Level**: medium
- **Pattern**: size
- **Visual**: sweet (small)
- **Answer**: short and sweet
- **Hint**: Quick and nice, not too long.
- **Why**: SWEET is SHORT = SHORT AND SWEET
- **Example**: Keep your speech short and sweet.
- **Choices**: sweet tooth, candy, short story

## ID: five-senses
- **Level**: medium
- **Pattern**: quantity
- **Visual**: SENSE (x5)
- **Answer**: five senses
- **Also**: the five senses, 5 senses
- **Hint**: Seeing, hearing, smelling, tasting and touching.
- **Why**: Five SENSEs = FIVE SENSES
- **Example**: We use our five senses to learn about the world.
- **Choices**: common sense, five fingers, nonsense

## ID: three-cheers
- **Level**: medium
- **Pattern**: quantity
- **Visual**: CHEER (x3)
- **Answer**: three cheers
- **Also**: 3 cheers
- **Hint**: Hip hip hooray! Hip hip hooray! Hip hip hooray!
- **Why**: Three CHEERs = THREE CHEERS
- **Example**: Three cheers for the winning team!
- **Choices**: cheer up, cheerleader, cheers

## ID: two-cents
- **Level**: tricky
- **Pattern**: quantity
- **Visual**: CENT | CENT
- **Answer**: my two cents
- **Also**: two cents, 2 cents
- **Hint**: Your own small idea or opinion.
- **Why**: Two CENTs = (MY) TWO CENTS
- **Example**: Can I add my two cents? Let's play tag!
- **Choices**: pocket money, piggy bank, one dollar

## ID: triple-jump
- **Level**: medium
- **Pattern**: quantity
- **Visual**: JUMP (x3)
- **Answer**: triple jump
- **Hint**: A sport: hop, step and jump into the sand.
- **Why**: Three JUMPs = TRIPLE JUMP
- **Example**: She won the triple jump at sports day.
- **Choices**: long jump, jump rope, high jump

## ID: four-leaf-clover
- **Level**: medium
- **Pattern**: quantity
- **Visual**: LEAF (x4)
- **Answer**: four-leaf clover
- **Also**: four leaf clover, 4 leaf clover
- **Hint**: A lucky green plant that is hard to find.
- **Why**: Four LEAFs = FOUR-LEAF CLOVER
- **Example**: I found a four-leaf clover in the park!
- **Choices**: leaf pile, falling leaves, flower

## ID: twice-as-nice
- **Level**: medium
- **Pattern**: quantity
- **Visual**: NICE | NICE
- **Answer**: twice as nice
- **Hint**: Two times better!
- **Why**: NICE two times = TWICE AS NICE
- **Example**: Two scoops of ice cream are twice as nice!
- **Choices**: very nice, think twice, nice try

## ID: three-strikes
- **Level**: medium
- **Pattern**: quantity
- **Visual**: STRIKE (x3)
- **Answer**: three strikes
- **Also**: three strikes and you're out, 3 strikes
- **Hint**: In baseball, this means you're out!
- **Why**: Three STRIKEs = THREE STRIKES
- **Example**: Three strikes and you're out!
- **Choices**: home run, strike out, lucky three

## ID: ducks-in-a-row
- **Level**: tricky
- **Pattern**: position
- **Visual**: DUCK | DUCK | DUCK | DUCK
- **Answer**: ducks in a row
- **Also**: get your ducks in a row
- **Hint**: Getting everything ready and in order.
- **Why**: DUCKs all IN A ROW = DUCKS IN A ROW
- **Example**: Get your ducks in a row before the trip.
- **Choices**: rubber duck, duck pond, sitting duck

## ID: follow-the-leader
- **Level**: medium
- **Pattern**: position
- **Visual**: LEADER | ME | ME | ME
- **Answer**: follow the leader
- **Hint**: A game where everyone copies the first person.
- **Why**: ME, ME, ME FOLLOW THE LEADER
- **Example**: We played follow the leader in the yard.
- **Choices**: team leader, simon says, line up

## ID: calm-down
- **Level**: medium
- **Pattern**: direction
- **Visual**: CALM (vertical)
- **Answer**: calm down
- **Hint**: Take a deep breath and relax.
- **Why**: CALM goes DOWN = CALM DOWN
- **Example**: Take a deep breath and calm down.
- **Choices**: slow down, sit down, cool off

## ID: climb-up
- **Level**: easy
- **Pattern**: direction
- **Visual**: CLIMB (rising)
- **Answer**: climb up
- **Also**: climbing up
- **Hint**: Going higher on a tree or a hill.
- **Why**: CLIMB goes UP = CLIMB UP
- **Example**: Let's climb up the hill.
- **Choices**: climb down, rock climbing, step up

## ID: give-up
- **Level**: medium
- **Pattern**: direction
- **Visual**: GIVE (rising)
- **Answer**: give up
- **Also**: giving up
- **Hint**: To stop trying. (Don't do it!)
- **Why**: GIVE goes UP = GIVE UP
- **Example**: Don't give up, you can do it!
- **Choices**: give away, forgive, try again

## ID: speed-up
- **Level**: medium
- **Pattern**: direction
- **Visual**: SPEED (rising)
- **Answer**: speed up
- **Hint**: Go faster!
- **Why**: SPEED goes UP = SPEED UP
- **Example**: Speed up, we're going to miss the bus!
- **Choices**: slow down, speed bump, hurry

## ID: fall-apart
- **Level**: tricky
- **Pattern**: direction
- **Visual**: APART (falling)
- **Answer**: fall apart
- **Also**: falling apart, fell apart
- **Hint**: Break into pieces.
- **Why**: APART is FALLING = FALL APART
- **Example**: My old shoes are starting to fall apart.
- **Choices**: far apart, fall down, broken

## ID: fall-asleep
- **Level**: medium
- **Pattern**: direction
- **Visual**: ASLEEP (falling)
- **Answer**: fall asleep
- **Also**: falling asleep, fell asleep
- **Hint**: Start sleeping.
- **Why**: ASLEEP is FALLING = FALL ASLEEP
- **Example**: I fall asleep fast after swimming.
- **Choices**: wide awake, wake up, sleepy

## ID: fall-behind
- **Level**: medium
- **Pattern**: direction
- **Visual**: BEHIND (falling)
- **Answer**: fall behind
- **Also**: falling behind
- **Hint**: Get slower than everyone else.
- **Why**: BEHIND is FALLING = FALL BEHIND
- **Example**: If you don't practice, you'll fall behind.
- **Choices**: left behind, behind you, fall down

## ID: rise-and-shine
- **Level**: medium
- **Pattern**: direction
- **Visual**: SHINE (rising)
- **Answer**: rise and shine
- **Hint**: What you say to wake someone up in the morning!
- **Why**: SHINE is RISING = RISE AND SHINE
- **Example**: Rise and shine! It's time for school.
- **Choices**: sunshine, good night, sunrise

## ID: back-and-forth
- **Level**: medium
- **Pattern**: typography
- **Visual**: FORTH | FORTH (backwards)
- **Answer**: back and forth
- **Also**: forth and back
- **Hint**: Going one way and then the other way.
- **Why**: FORTH and HTROF go BACK AND FORTH
- **Example**: The swing went back and forth.
- **Choices**: back to back, go back, so on

## ID: turn-the-tables
- **Level**: tricky
- **Pattern**: typography
- **Visual**: TABLES (upside down)
- **Answer**: turn the tables
- **Also**: turned the tables
- **Hint**: To change from losing to winning.
- **Why**: TABLES are turned over = TURN THE TABLES
- **Example**: Our team was losing, but we managed to turn the tables and win!
- **Choices**: set the table, times tables, upside down

## ID: flip-flop
- **Level**: medium
- **Pattern**: typography
- **Visual**: FLOP | FLOP (upside down)
- **Answer**: flip-flop
- **Also**: flip flop, flip-flops, flip flops
- **Hint**: A rubber sandal you wear at the beach.
- **Why**: FLOP and a flipped FLOP = FLIP-FLOP
- **Example**: I lost one flip-flop at the beach.
- **Choices**: sneaker, flip book, flapjack

## ID: topsy-turvy
- **Level**: tricky
- **Pattern**: typography
- **Visual**: TOPSY | TURVY (upside down)
- **Answer**: topsy-turvy
- **Also**: topsy turvy
- **Hint**: All mixed up and upside down.
- **Why**: TURVY is upside down = TOPSY-TURVY
- **Example**: After the party, the room was topsy-turvy.
- **Choices**: upside down, inside out, higgledy-piggledy

## ID: look-both-ways
- **Level**: medium
- **Pattern**: typography
- **Visual**: LOOK | LOOK (backwards)
- **Answer**: look both ways
- **Hint**: What to do before you cross the road.
- **Why**: LOOK one way and LOOK the other way = LOOK BOTH WAYS
- **Example**: Always look both ways at the crosswalk.
- **Choices**: look up, look out, both sides

## ID: chin-up
- **Level**: medium
- **Pattern**: direction
- **Visual**: CHIN (sideways)
- **Answer**: chin up
- **Also**: keep your chin up
- **Hint**: Stay brave and don't be sad!
- **Why**: CHIN goes UP = CHIN UP
- **Example**: Chin up! You'll do better next time.
- **Choices**: cheer up, chin chin, stand up

## ID: hands-up
- **Level**: easy
- **Pattern**: direction
- **Visual**: HANDS (sideways)
- **Answer**: hands up
- **Also**: put your hands up, hand up
- **Hint**: Raise your arms high!
- **Why**: HANDS go UP = HANDS UP
- **Example**: Hands up if you know the answer!
- **Choices**: high five, hand in hand, raise

## ID: line-up
- **Level**: easy
- **Pattern**: direction
- **Visual**: LINE (sideways)
- **Answer**: line up
- **Also**: lining up
- **Hint**: Stand one behind the other.
- **Why**: LINE goes UP = LINE UP
- **Example**: Please line up at the door.
- **Choices**: bottom line, underline, stand up

## ID: be-happy
- **Level**: easy
- **Pattern**: sound
- **Visual**: B HAPPY
- **Answer**: be happy
- **Also**: b happy
- **Hint**: Smile and don't worry!
- **Why**: B sounds like BE: B HAPPY = BE HAPPY
- **Example**: Don't worry, be happy!
- **Choices**: bee happy, so happy, happy bee

## ID: why-not
- **Level**: medium
- **Pattern**: sound
- **Visual**: Y NOT
- **Answer**: why not
- **Also**: y not
- **Hint**: "Sure, let's do it!"
- **Why**: Y sounds like WHY: Y NOT = WHY NOT
- **Example**: Want to play? Sure, why not!
- **Choices**: yes or no, why me, not now

## ID: excuse-me
- **Level**: tricky
- **Pattern**: sound
- **Visual**: XQZ ME
- **Answer**: excuse me
- **Also**: xqz me
- **Hint**: A polite way to get someone's attention.
- **Why**: X-Q-Z sounds like EX-CUSE: XQZ ME = EXCUSE ME
- **Example**: Excuse me, where is the library?
- **Choices**: thank you, kiss me, x marks

## ID: tonight
- **Level**: medium
- **Pattern**: sound
- **Visual**: 2 NITE
- **Answer**: tonight
- **Also**: 2nite, to night
- **Hint**: This evening, after the sun goes down.
- **Why**: 2 = TO + NITE (NIGHT) = TONIGHT
- **Example**: We are having pizza tonight.
- **Choices**: two nights, goodnight, midnight

## ID: today
- **Level**: easy
- **Pattern**: sound
- **Visual**: 2 DAY
- **Answer**: today
- **Also**: 2day, to day
- **Hint**: This day, right now.
- **Why**: 2 = TO + DAY = TODAY
- **Example**: Today is my birthday!
- **Choices**: two days, tomorrow, sunday

## ID: tomorrow
- **Level**: easy
- **Pattern**: sound
- **Visual**: 2 MORROW
- **Answer**: tomorrow
- **Also**: 2morrow, to morrow
- **Hint**: The day after today.
- **Why**: 2 = TO + MORROW = TOMORROW
- **Example**: See you tomorrow!
- **Choices**: yesterday, today, morning

## ID: together
- **Level**: medium
- **Pattern**: sound
- **Visual**: 2 GETHER
- **Answer**: together
- **Also**: 2gether, to gether
- **Hint**: With each other, not alone.
- **Why**: 2 = TO + GETHER = TOGETHER
- **Example**: Let's clean up together.
- **Choices**: get there, two of us, forget

## ID: for-real
- **Level**: medium
- **Pattern**: sound
- **Visual**: 4 REAL
- **Answer**: for real
- **Also**: 4 real
- **Hint**: "Really? Is that true?"
- **Why**: 4 sounds like FOR: 4 REAL = FOR REAL
- **Example**: You saw a whale? For real?
- **Choices**: four reels, really, for sure

## ID: forward
- **Level**: medium
- **Pattern**: sound
- **Visual**: 4 WARD
- **Answer**: forward
- **Also**: 4ward
- **Hint**: The way in front of you.
- **Why**: 4 sounds like FOR: 4 WARD = FORWARD
- **Example**: Take one step forward.
- **Choices**: backward, four words, foreword

## ID: seesaw
- **Level**: medium
- **Pattern**: sound
- **Visual**: C SAW
- **Answer**: seesaw
- **Also**: see saw, see-saw
- **Hint**: A playground board that goes up and down.
- **Why**: C sounds like SEE: C SAW = SEESAW
- **Example**: We played on the seesaw at the park.
- **Choices**: swing, slide, sea saw

## ID: peas
- **Level**: medium
- **Pattern**: sound
- **Visual**: P P P
- **Answer**: peas
- **Also**: p's
- **Hint**: Little green balls you eat with dinner.
- **Why**: Lots of P's sounds like PEAS!
- **Example**: Please eat your peas.
- **Choices**: beans, peace, peppers

## ID: eyes
- **Level**: medium
- **Pattern**: sound
- **Visual**: I I
- **Answer**: eyes
- **Also**: i's
- **Hint**: You see with them.
- **Why**: Two I's sounds like EYES!
- **Example**: Close your eyes and make a wish.
- **Choices**: ice, i see you, aye aye

## ID: ten-to-one
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 10 2 1
- **Answer**: ten to one
- **Also**: 10 to 1, ten to 1
- **Hint**: A time on the clock: 12:50.
- **Why**: 10 2 (TO) 1 = TEN TO ONE
- **Example**: It's ten to one, so lunch is almost over.
- **Choices**: one to ten, ten past one, one o'clock

## ID: nine-to-five
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 9 2 5
- **Answer**: nine to five
- **Also**: 9 to 5
- **Hint**: The hours of a usual work day.
- **Why**: 9 2 (TO) 5 = NINE TO FIVE
- **Example**: My mom works from nine to five.
- **Choices**: high five, five to nine, take five

## ID: easy-peasy
- **Level**: medium
- **Pattern**: sound
- **Visual**: EZ PZ
- **Answer**: easy peasy
- **Also**: easy peasy lemon squeezy, ezpz
- **Hint**: Super, super easy!
- **Why**: Say the letters: E-Z P-Z = EASY PEASY
- **Example**: This puzzle is easy peasy!
- **Choices**: peas, piece of cake, lazy

## ID: late-for-school
- **Level**: medium
- **Pattern**: sound
- **Visual**: L8 4 SCHOOL
- **Answer**: late for school
- **Also**: l8 4 school
- **Hint**: When the bell rings and you're not there yet!
- **Why**: L8 = LATE, 4 = FOR: LATE FOR SCHOOL
- **Example**: Hurry up, or you'll be late for school!
- **Choices**: after school, school bus, too late

## ID: wait-a-minute
- **Level**: medium
- **Pattern**: sound
- **Visual**: W8 A MIN
- **Answer**: wait a minute
- **Also**: wait a min, w8 a min
- **Hint**: "Hold on, just a moment!"
- **Why**: W8 = WAIT, MIN = MINUTE: WAIT A MINUTE
- **Example**: Wait a minute, I forgot my hat!
- **Choices**: last minute, wait for me, one minute

## ID: see-eye-to-eye
- **Level**: tricky
- **Pattern**: sound
- **Visual**: C | EYE | 2 | EYE
- **Answer**: see eye to eye
- **Hint**: To agree with someone.
- **Why**: C = SEE, 2 = TO: SEE EYE TO EYE
- **Example**: My brother and I don't always see eye to eye.
- **Choices**: eye to eye, face to face, i see you

## ID: a-to-z
- **Level**: medium
- **Pattern**: sound
- **Visual**: A 2 Z
- **Answer**: from a to z
- **Also**: a to z
- **Hint**: Everything, from the start to the end.
- **Why**: A 2 (TO) Z = FROM A TO Z
- **Example**: This book has animals from A to Z.
- **Choices**: abc, alphabet, a to b

## ID: zero-to-hero
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 0 2 HERO
- **Answer**: zero to hero
- **Also**: from zero to hero
- **Hint**: From nobody special to a star!
- **Why**: 0 = ZERO, 2 = TO: ZERO TO HERO
- **Example**: He went from zero to hero when he scored the last goal.
- **Choices**: superhero, number one, hero

## ID: all-for-one
- **Level**: tricky
- **Pattern**: sound
- **Visual**: 1 4 ALL / ALL 4 1
- **Answer**: one for all and all for one
- **Also**: one for all, all for one and one for all
- **Hint**: The famous team promise of the Three Musketeers.
- **Why**: 1 = ONE, 4 = FOR: ONE FOR ALL, ALL FOR ONE
- **Example**: The three friends shouted, "One for all and all for one!"
- **Choices**: all in all, one by one, free for all

## ID: break-the-ice
- **Level**: tricky
- **Pattern**: split
- **Visual**: I (tilted) | CE (tilted)
- **Answer**: break the ice
- **Also**: breaking the ice
- **Hint**: Do something fun so new people feel friendly.
- **Why**: The word ICE is broken = BREAK THE ICE
- **Example**: We played a name game to break the ice.
- **Choices**: ice cube, icy, ice cream

## ID: piece-of-cake
- **Level**: tricky
- **Pattern**: split
- **Visual**: C (tilted) | AK (tilted) | E (tilted)
- **Answer**: a piece of cake
- **Also**: piece of cake
- **Hint**: Something very easy.
- **Why**: CAKE in pieces = A PIECE OF CAKE
- **Example**: The math test was a piece of cake!
- **Choices**: cupcake, birthday cake, cake pop

## ID: split-the-bill
- **Level**: medium
- **Pattern**: split
- **Visual**: BI (tilted) | LL (tilted)
- **Answer**: split the bill
- **Also**: split the check
- **Hint**: Everyone pays some of the cost.
- **Why**: The word BILL is split = SPLIT THE BILL
- **Example**: We split the bill for the pizza.
- **Choices**: pay the bill, banana split, duck bill

## ID: cross-eyed
- **Level**: medium
- **Pattern**: position
- **Visual**: EYE (cross)
- **Answer**: cross-eyed
- **Also**: cross eyed
- **Hint**: Looking at your own nose with both eyes. Silly face!
- **Why**: EYE crosses itself = CROSS-EYED
- **Example**: He made a funny cross-eyed face.
- **Choices**: eye to eye, eyeball, blink

## ID: cross-the-street
- **Level**: medium
- **Pattern**: position
- **Visual**: STREET (cross)
- **Answer**: cross the street
- **Also**: crossing the street
- **Hint**: Walk to the other side of the road.
- **Why**: STREET crosses itself = CROSS THE STREET
- **Example**: Hold my hand when we cross the street.
- **Choices**: crossroads, street light, crosswalk

## ID: red-carpet
- **Level**: medium
- **Pattern**: color
- **Visual**: {CARPET}
- **Answer**: red carpet
- **Also**: the red carpet
- **Hint**: Where movie stars walk at a big event.
- **Why**: CARPET in RED = RED CARPET
- **Example**: The movie stars walked on the red carpet.
- **Choices**: magic carpet, rug, red rose

## ID: red-light
- **Level**: easy
- **Pattern**: color
- **Visual**: {LIGHT}
- **Answer**: red light
- **Hint**: It means STOP at the street corner.
- **Why**: LIGHT in RED = RED LIGHT
- **Example**: Stop at the red light.
- **Choices**: green light, light bulb, flashlight

## ID: red-handed
- **Level**: tricky
- **Pattern**: color
- **Visual**: CAUGHT {HANDED}
- **Answer**: caught red-handed
- **Also**: caught red handed, red-handed, red handed
- **Hint**: Caught just as you were doing something wrong!
- **Why**: CAUGHT and HANDED in RED = CAUGHT RED-HANDED
- **Example**: My dog was caught red-handed eating the cake.
- **Choices**: left-handed, hand in hand, caught a cold

## ID: seeing-red
- **Level**: tricky
- **Pattern**: color
- **Visual**: {SEEING}
- **Answer**: seeing red
- **Hint**: Feeling very, very angry.
- **Why**: SEEING in RED = SEEING RED
- **Example**: When my brother broke my toy, I was seeing red.
- **Choices**: red alert, i see you, sunburn

## ID: less-is-more
- **Level**: tricky
- **Pattern**: math
- **Visual**: LESS > MORE
- **Answer**: less is more
- **Hint**: Simple can be better than too much.
- **Why**: LESS is bigger (>) than MORE = LESS IS MORE
- **Example**: When you decorate a cake, less is more.
- **Choices**: more or less, no more, nevermore

## ID: after-all
- **Level**: tricky
- **Pattern**: position
- **Visual**: ALL | AFTER
- **Answer**: after all
- **Hint**: "In the end, it turned out like this."
- **Why**: AFTER comes after ALL = AFTER ALL
- **Example**: It didn't rain after all, so we went to the beach.
- **Choices**: all in all, afternoon, all done

## ID: just-in-time
- **Level**: tricky
- **Pattern**: inside
- **Visual**: TI{JUST}ME
- **Answer**: just in time
- **Hint**: Not late, right at the last moment!
- **Why**: JUST is IN TIME = JUST IN TIME
- **Example**: We got to the bus just in time.
- **Choices**: right on time, last minute, time out

## ID: pain-in-the-neck
- **Level**: tricky
- **Pattern**: inside
- **Visual**: NE{PAIN}CK
- **Answer**: pain in the neck
- **Also**: a pain in the neck
- **Hint**: Something really annoying.
- **Why**: PAIN is IN THE NECK = PAIN IN THE NECK
- **Example**: My noisy alarm clock is a pain in the neck.
- **Choices**: neck and neck, sore throat, headache

## ID: butterflies-in-my-stomach
- **Level**: tricky
- **Pattern**: inside
- **Visual**: STOM{BUTTERFLIES}ACH
- **Answer**: butterflies in my stomach
- **Also**: butterflies in your stomach, butterflies in the stomach
- **Hint**: The nervous, fluttery feeling before something big.
- **Why**: BUTTERFLIES are IN the STOMACH = BUTTERFLIES IN MY STOMACH
- **Example**: Before the show, I had butterflies in my stomach.
- **Choices**: stomach ache, butterfly net, hungry

## ID: ball-in-your-court
- **Level**: tricky
- **Pattern**: inside
- **Visual**: COU{BALL}RT
- **Answer**: the ball is in your court
- **Also**: ball in your court
- **Hint**: Now it's your turn to decide.
- **Why**: BALL is IN the COURT = THE BALL IS IN YOUR COURT
- **Example**: I said sorry, so now the ball is in your court.
- **Choices**: tennis ball, basketball court, play ball

## ID: from-head-to-toe
- **Level**: medium
- **Pattern**: position
- **Visual**: HEAD / ⬇ / TOE
- **Answer**: from head to toe
- **Also**: head to toe
- **Hint**: Your whole body, top to bottom.
- **Why**: From HEAD down to TOE = FROM HEAD TO TOE
- **Example**: I was covered in mud from head to toe.
- **Choices**: head over heels, tiptoe, toe to toe

## ID: neck-and-neck
- **Level**: medium
- **Pattern**: quantity
- **Visual**: NECK | NECK
- **Answer**: neck and neck
- **Hint**: When two racers are exactly even.
- **Why**: NECK and NECK side by side = NECK AND NECK
- **Example**: The two runners were neck and neck at the end.
- **Choices**: head to head, necklace, pain in the neck

## ID: heart-to-heart
- **Level**: medium
- **Pattern**: typography
- **Visual**: HEART | HEART (backwards)
- **Answer**: heart to heart
- **Also**: a heart to heart, heart-to-heart
- **Hint**: A long, honest talk with someone you love.
- **Why**: HEART faces HEART = HEART TO HEART
- **Example**: Mom and I had a heart to heart about my new school.
- **Choices**: big heart, sweetheart, heart shape
