/*
 * Moku Wolf — the word pairs (Wordwolf topics).
 *
 * UMD: the browser gets window.MokuWolfWords (moku-wolf.html), Node gets
 * require() (backend/src/wolfParty.js deals the words in Multiplayer rooms).
 * Lambda only ships backend/, so a copy lives in backend/src/vendor/: edit
 * this file, then `cp shared/moku-wolf-words.js backend/src/vendor/`
 * (npm test fails when they differ).
 *
 * One pair = { w1, j1 (Japanese), e1 (emoji), w2, j2, e2 }: two things that are
 * alike but not the same. The Citizens get one word, the WordMoku the other.
 * Mix draws from every topic. Words are unique across all topics.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MokuWolfWords = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PAIRS = {
    food: [
      { w1: "Pizza", j1: "ピザ", e1: "🍕", w2: "Hamburger", j2: "ハンバーガー", e2: "🍔" },
      { w1: "Apple", j1: "りんご", e1: "🍎", w2: "Peach", j2: "もも", e2: "🍑" },
      { w1: "Ice Cream", j1: "アイスクリーム", e1: "🍦", w2: "Frozen Yogurt", j2: "フローズンヨーグルト", e2: "🍧" },
      { w1: "Hot Dog", j1: "ホットドッグ", e1: "🌭", w2: "Sandwich", j2: "サンドイッチ", e2: "🥪" },
      { w1: "Milk", j1: "ぎゅうにゅう", e1: "🥛", w2: "Orange Juice", j2: "オレンジジュース", e2: "🧃" },
      { w1: "Chocolate", j1: "チョコレート", e1: "🍫", w2: "Cookie", j2: "クッキー", e2: "🍪" },
      { w1: "French Fries", j1: "フライドポテト", e1: "🍟", w2: "Potato Chips", j2: "ポテトチップス", e2: "🥔" },
      { w1: "Pancake", j1: "パンケーキ", e1: "🥞", w2: "Waffle", j2: "ワッフル", e2: "🧇" },
      { w1: "Donut", j1: "ドーナツ", e1: "🍩", w2: "Bagel", j2: "ベーグル", e2: "🥯" },
      { w1: "Strawberry", j1: "いちご", e1: "🍓", w2: "Cherry", j2: "さくらんぼ", e2: "🍒" },
      { w1: "Popcorn", j1: "ポップコーン", e1: "🍿", w2: "Nachos", j2: "ナチョス", e2: "🧀" },
      { w1: "Watermelon", j1: "すいか", e1: "🍉", w2: "Melon", j2: "メロン", e2: "🍈" },
      { w1: "Ramen", j1: "ラーメン", e1: "🍜", w2: "Spaghetti", j2: "スパゲッティ", e2: "🍝" },
      { w1: "Cheese", j1: "チーズ", e1: "🧀", w2: "Butter", j2: "バター", e2: "🧈" },
      { w1: "Cupcake", j1: "カップケーキ", e1: "🧁", w2: "Muffin", j2: "マフィン", e2: "🧁" },
      { w1: "Lemonade", j1: "レモネード", e1: "🍋", w2: "Iced Tea", j2: "アイスティー", e2: "🧋" },
      { w1: "Taco", j1: "タコス", e1: "🌮", w2: "Burrito", j2: "ブリトー", e2: "🌯" },
      { w1: "Fried Chicken", j1: "からあげ", e1: "🍗", w2: "Chicken Nuggets", j2: "チキンナゲット", e2: "🍗" },
      { w1: "Banana", j1: "バナナ", e1: "🍌", w2: "Mango", j2: "マンゴー", e2: "🥭" },
      { w1: "Rice Ball (Onigiri)", j1: "おにぎり", e1: "🍙", w2: "Bread", j2: "パン", e2: "🍞" },
      { w1: "Sushi", j1: "おすし", e1: "🍣", w2: "Rice Bowl", j2: "どんぶり", e2: "🍚" },
      { w1: "Grapes", j1: "ぶどう", e1: "🍇", w2: "Blueberries", j2: "ブルーベリー", e2: "🫐" },
      { w1: "Orange", j1: "オレンジ", e1: "🍊", w2: "Lemon", j2: "レモン", e2: "🍋" },
      { w1: "Cake", j1: "ケーキ", e1: "🎂", w2: "Pie", j2: "パイ", e2: "🥧" },
      { w1: "Curry Rice", j1: "カレーライス", e1: "🍛", w2: "Stew", j2: "シチュー", e2: "🫕" },
      { w1: "Dumplings", j1: "ぎょうざ", e1: "🥟", w2: "Spring Rolls", j2: "はるまき", e2: "🥢" },
      { w1: "Boiled Egg", j1: "ゆでたまご", e1: "🥚", w2: "Omelet", j2: "オムレツ", e2: "🍳" },
      { w1: "Carrot", j1: "にんじん", e1: "🥕", w2: "Corn", j2: "とうもろこし", e2: "🌽" },
      { w1: "Tomato", j1: "トマト", e1: "🍅", w2: "Bell Pepper", j2: "ピーマン", e2: "🫑" },
      { w1: "Coffee", j1: "コーヒー", e1: "☕", w2: "Green Tea", j2: "りょくちゃ", e2: "🍵" },
      { w1: "Soda", j1: "ソーダ", e1: "🥤", w2: "Sparkling Water", j2: "たんさん水", e2: "💧" },
      { w1: "Candy", j1: "あめ", e1: "🍬", w2: "Lollipop", j2: "ペロペロキャンディ", e2: "🍭" },
      { w1: "Steak", j1: "ステーキ", e1: "🥩", w2: "Bacon", j2: "ベーコン", e2: "🥓" },
      { w1: "Pineapple", j1: "パイナップル", e1: "🍍", w2: "Coconut", j2: "ココナッツ", e2: "🥥" },
      { w1: "Kiwi", j1: "キウイ", e1: "🥝", w2: "Avocado", j2: "アボカド", e2: "🥑" },
      { w1: "Salad", j1: "サラダ", e1: "🥗", w2: "Soup", j2: "スープ", e2: "🍲" },
      { w1: "Croissant", j1: "クロワッサン", e1: "🥐", w2: "Pretzel", j2: "プレッツェル", e2: "🥨" },
      { w1: "Honey", j1: "はちみつ", e1: "🍯", w2: "Maple Syrup", j2: "メープルシロップ", e2: "🍁" },
      { w1: "Shrimp", j1: "エビ", e1: "🍤", w2: "Crab", j2: "カニ", e2: "🦀" },
      { w1: "Mochi", j1: "おもち", e1: "🍡", w2: "Marshmallow", j2: "マシュマロ", e2: "☁️" }
    ],
    sports: [
      { w1: "Soccer", j1: "サッカー", e1: "⚽", w2: "Basketball", j2: "バスケットボール", e2: "🏀" },
      { w1: "Baseball", j1: "やきゅう", e1: "⚾", w2: "Cricket", j2: "クリケット", e2: "🏏" },
      { w1: "Swimming", j1: "すいえい", e1: "🏊", w2: "Surfing", j2: "サーフィン", e2: "🏄" },
      { w1: "Skateboarding", j1: "スケートボード", e1: "🛹", w2: "Rollerblading", j2: "インラインスケート", e2: "🛼" },
      { w1: "Running", j1: "ランニング", e1: "🏃", w2: "Walking", j2: "さんぽ", e2: "🚶" },
      { w1: "Tennis", j1: "テニス", e1: "🎾", w2: "Badminton", j2: "バドミントン", e2: "🏸" },
      { w1: "Skiing", j1: "スキー", e1: "🎿", w2: "Snowboarding", j2: "スノーボード", e2: "🏂" },
      { w1: "Dodgeball", j1: "ドッジボール", e1: "🏐", w2: "Volleyball", j2: "バレーボール", e2: "🏐" },
      { w1: "Karate", j1: "からて", e1: "🥋", w2: "Judo", j2: "じゅうどう", e2: "🥋" },
      { w1: "Bowling", j1: "ボウリング", e1: "🎳", w2: "Golf", j2: "ゴルフ", e2: "⛳" },
      { w1: "Bicycle Racing", j1: "じてんしゃレース", e1: "🚴", w2: "Scooter", j2: "キックスケーター", e2: "🛴" },
      { w1: "Table Tennis", j1: "たっきゅう", e1: "🏓", w2: "Air Hockey", j2: "エアホッケー", e2: "🏒" },
      { w1: "Gymnastics", j1: "たいそう", e1: "🤸", w2: "Dance", j2: "ダンス", e2: "💃" },
      { w1: "Ice Skating", j1: "アイススケート", e1: "⛸️", w2: "Roller Skating", j2: "ローラースケート", e2: "🛼" },
      { w1: "Rock Climbing", j1: "ボルダリング", e1: "🧗", w2: "Tree Climbing", j2: "木のぼり", e2: "🌲" },
      { w1: "Rugby", j1: "ラグビー", e1: "🏉", w2: "American Football", j2: "アメフト", e2: "🏈" },
      { w1: "Ice Hockey", j1: "アイスホッケー", e1: "🏒", w2: "Field Hockey", j2: "フィールドホッケー", e2: "🏑" },
      { w1: "Boxing", j1: "ボクシング", e1: "🥊", w2: "Wrestling", j2: "レスリング", e2: "🤼" },
      { w1: "Archery", j1: "アーチェリー", e1: "🏹", w2: "Darts", j2: "ダーツ", e2: "🎯" },
      { w1: "Scuba Diving", j1: "スキューバダイビング", e1: "🤿", w2: "Snorkeling", j2: "シュノーケリング", e2: "🐠" },
      { w1: "Sailing", j1: "ヨット", e1: "⛵", w2: "Canoeing", j2: "カヌー", e2: "🛶" },
      { w1: "Horse Riding", j1: "じょうば", e1: "🏇", w2: "Camel Riding", j2: "ラクダのり", e2: "🐪" },
      { w1: "Hiking", j1: "ハイキング", e1: "🥾", w2: "Camping", j2: "キャンプ", e2: "🏕️" },
      { w1: "Jump Rope", j1: "なわとび", e1: "🪢", w2: "Hula Hoop", j2: "フラフープ", e2: "⭕" },
      { w1: "Marathon", j1: "マラソン", e1: "🏅", w2: "Relay Race", j2: "リレー", e2: "🏃‍♀️" },
      { w1: "Fencing", j1: "フェンシング", e1: "🤺", w2: "Kendo", j2: "けんどう", e2: "⚔️" },
      { w1: "Weightlifting", j1: "じゅうりょうあげ", e1: "🏋️", w2: "Push-ups", j2: "うでたてふせ", e2: "💪" },
      { w1: "Water Polo", j1: "すいきゅう", e1: "🤽", w2: "Handball", j2: "ハンドボール", e2: "🤾" },
      { w1: "Tag", j1: "おにごっこ", e1: "🏃‍♂️", w2: "Hide and Seek", j2: "かくれんぼ", e2: "🙈" },
      { w1: "Sledding", j1: "そりあそび", e1: "🛷", w2: "Snowball Fight", j2: "雪がっせん", e2: "❄️" }
    ],
    mix: [
      { w1: "Cat", j1: "ねこ", e1: "🐱", w2: "Dog", j2: "いぬ", e2: "🐶" },
      { w1: "Lion", j1: "ライオン", e1: "🦁", w2: "Tiger", j2: "トラ", e2: "🐯" },
      { w1: "Penguin", j1: "ペンギン", e1: "🐧", w2: "Polar Bear", j2: "シロクマ", e2: "🐻‍❄️" },
      { w1: "Dolphin", j1: "イルカ", e1: "🐬", w2: "Whale", j2: "クジラ", e2: "🐳" },
      { w1: "Rabbit", j1: "ウサギ", e1: "🐰", w2: "Hamster", j2: "ハムスター", e2: "🐹" },
      { w1: "Bicycle", j1: "じてんしゃ", e1: "🚲", w2: "Motorcycle", j2: "バイク", e2: "🏍️" },
      { w1: "Pencil", j1: "えんぴつ", e1: "✏️", w2: "Crayon", j2: "クレヨン", e2: "🖍️" },
      { w1: "Backpack", j1: "リュック", e1: "🎒", w2: "Handbag", j2: "ハンドバッグ", e2: "👜" },
      { w1: "Pillow", j1: "まくら", e1: "🛌", w2: "Cushion", j2: "クッション", e2: "🛋️" },
      { w1: "Sun", j1: "たいよう", e1: "☀️", w2: "Moon", j2: "月", e2: "🌙" },
      { w1: "Beach", j1: "ビーチ", e1: "🏖️", w2: "Swimming Pool", j2: "プール", e2: "🏊" },
      { w1: "Cinema", j1: "えいがかん", e1: "🎬", w2: "Living Room TV", j2: "リビングのテレビ", e2: "📺" },
      { w1: "Smartphone", j1: "スマホ", e1: "📱", w2: "Tablet", j2: "タブレット", e2: "💻" },
      { w1: "Blanket", j1: "もうふ", e1: "🛏️", w2: "Jacket", j2: "ジャケット", e2: "🧥" },
      { w1: "Airplane", j1: "ひこうき", e1: "✈️", w2: "Helicopter", j2: "ヘリコプター", e2: "🚁" },
      { w1: "Guitar", j1: "ギター", e1: "🎸", w2: "Ukulele", j2: "ウクレレ", e2: "🪕" },
      { w1: "Amusement Park", j1: "ゆうえんち", e1: "🎡", w2: "Playground", j2: "こうえん", e2: "🛝" },
      { w1: "Umbrella", j1: "かさ", e1: "☂️", w2: "Raincoat", j2: "レインコート", e2: "🧥" },
      { w1: "Glasses", j1: "めがね", e1: "👓", w2: "Sunglasses", j2: "サングラス", e2: "🕶️" },
      { w1: "Clock", j1: "かけどけい", e1: "⏰", w2: "Watch", j2: "うでどけい", e2: "⌚" },
      { w1: "Owl", j1: "フクロウ", e1: "🦉", w2: "Eagle", j2: "ワシ", e2: "🦅" },
      { w1: "Frog", j1: "カエル", e1: "🐸", w2: "Turtle", j2: "カメ", e2: "🐢" },
      { w1: "Elephant", j1: "ゾウ", e1: "🐘", w2: "Giraffe", j2: "キリン", e2: "🦒" },
      { w1: "Monkey", j1: "サル", e1: "🐵", w2: "Gorilla", j2: "ゴリラ", e2: "🦍" },
      { w1: "Shark", j1: "サメ", e1: "🦈", w2: "Octopus", j2: "タコ", e2: "🐙" },
      { w1: "Butterfly", j1: "ちょうちょ", e1: "🦋", w2: "Bee", j2: "ハチ", e2: "🐝" },
      { w1: "Train", j1: "でんしゃ", e1: "🚆", w2: "Bus", j2: "バス", e2: "🚌" },
      { w1: "Car", j1: "くるま", e1: "🚗", w2: "Taxi", j2: "タクシー", e2: "🚕" },
      { w1: "Rocket", j1: "ロケット", e1: "🚀", w2: "UFO", j2: "UFO", e2: "🛸" },
      { w1: "Ruler", j1: "じょうぎ", e1: "📏", w2: "Scissors", j2: "はさみ", e2: "✂️" },
      { w1: "Notebook", j1: "ノート", e1: "📓", w2: "Sketchbook", j2: "スケッチブック", e2: "🎨" },
      { w1: "Rain", j1: "雨", e1: "🌧️", w2: "Snow", j2: "雪", e2: "🌨️" },
      { w1: "Rainbow", j1: "にじ", e1: "🌈", w2: "Fireworks", j2: "はなび", e2: "🎆" },
      { w1: "Mountain", j1: "山", e1: "⛰️", w2: "Volcano", j2: "かざん", e2: "🌋" },
      { w1: "Piano", j1: "ピアノ", e1: "🎹", w2: "Drum", j2: "たいこ", e2: "🥁" },
      { w1: "Robot", j1: "ロボット", e1: "🤖", w2: "Alien", j2: "うちゅう人", e2: "👽" },
      { w1: "Balloon", j1: "ふうせん", e1: "🎈", w2: "Bubble", j2: "シャボン玉", e2: "🫧" },
      { w1: "Castle", j1: "おしろ", e1: "🏰", w2: "Tower", j2: "タワー", e2: "🗼" },
      { w1: "Toothbrush", j1: "はブラシ", e1: "🪥", w2: "Toothpaste", j2: "はみがきこ", e2: "🧴" },
      { w1: "Teddy Bear", j1: "くまのぬいぐるみ", e1: "🧸", w2: "Doll", j2: "にんぎょう", e2: "🪆" }
    ],
    school: [
      { w1: "Eraser", j1: "けしゴム", e1: "🧼", w2: "Pencil Sharpener", j2: "えんぴつけずり", e2: "✏️" },
      { w1: "Glue", j1: "のり", e1: "🧴", w2: "Stapler", j2: "ホッチキス", e2: "📎" },
      { w1: "Blackboard", j1: "こくばん", e1: "⬛", w2: "Whiteboard", j2: "ホワイトボード", e2: "⬜" },
      { w1: "Principal", j1: "こうちょう先生", e1: "🧑‍💼", w2: "Teacher", j2: "たんにんの先生", e2: "👩‍🏫" },
      { w1: "School Lunch", j1: "きゅうしょく", e1: "🍛", w2: "Packed Lunch", j2: "おべんとう", e2: "🍱" },
      { w1: "Recess", j1: "休み時間", e1: "🛝", w2: "After School", j2: "ほうかご", e2: "🌇" },
      { w1: "Library", j1: "としょしつ", e1: "📚", w2: "Music Room", j2: "おんがくしつ", e2: "🎼" },
      { w1: "Gym", j1: "たいいくかん", e1: "🏀", w2: "Schoolyard", j2: "うんどうじょう", e2: "🏃" },
      { w1: "Sports Day", j1: "うんどうかい", e1: "🏅", w2: "Field Trip", j2: "えんそく", e2: "🎒" },
      { w1: "School Trip", j1: "しゅうがくりょこう", e1: "🗾", w2: "Museum Visit", j2: "はくぶつかん見学", e2: "🏛️" },
      { w1: "Homework", j1: "しゅくだい", e1: "📝", w2: "Test", j2: "テスト", e2: "💯" },
      { w1: "Report Card", j1: "つうしんぼ", e1: "📄", w2: "Award Certificate", j2: "しょうじょう", e2: "🏆" },
      { w1: "Calculator", j1: "でんたく", e1: "🔢", w2: "Abacus", j2: "そろばん", e2: "🧮" },
      { w1: "Globe", j1: "ちきゅうぎ", e1: "🌍", w2: "Map", j2: "ちず", e2: "🗺️" },
      { w1: "Microscope", j1: "けんびきょう", e1: "🔬", w2: "Magnifying Glass", j2: "むしめがね", e2: "🔍" },
      { w1: "Recorder", j1: "リコーダー", e1: "🎶", w2: "Melodica", j2: "けんばんハーモニカ", e2: "🎹" },
      { w1: "Indoor Shoes", j1: "うわばき", e1: "👟", w2: "Rain Boots", j2: "ながぐつ", e2: "👢" },
      { w1: "Name Tag", j1: "名ふだ", e1: "🏷️", w2: "Sticker", j2: "シール", e2: "⭐" },
      { w1: "Chalk", j1: "チョーク", e1: "🖍️", w2: "Marker", j2: "マーカー", e2: "🖊️" },
      { w1: "Lunch Duty", j1: "きゅうしょくとうばん", e1: "🥄", w2: "Cleaning Time", j2: "そうじの時間", e2: "🧹" },
      { w1: "Class Photo", j1: "クラス写真", e1: "📸", w2: "Graduation Album", j2: "そつぎょうアルバム", e2: "📒" },
      { w1: "School Bell", j1: "チャイム", e1: "🔔", w2: "Alarm Clock", j2: "めざましどけい", e2: "⏰" },
      { w1: "Desk", j1: "つくえ", e1: "🗄️", w2: "Chair", j2: "いす", e2: "🪑" },
      { w1: "Pencil Case", j1: "ふでばこ", e1: "🖋️", w2: "Pouch", j2: "ポーチ", e2: "👛" },
      { w1: "Graduation", j1: "そつぎょうしき", e1: "🎓", w2: "Entrance Ceremony", j2: "にゅうがくしき", e2: "🌸" },
      { w1: "Math", j1: "さんすう", e1: "➗", w2: "Science", j2: "りか", e2: "🧲" },
      { w1: "Japanese Class", j1: "こくご", e1: "📕", w2: "English Class", j2: "えいご", e2: "🔤" },
      { w1: "P.E.", j1: "たいいく", e1: "🤸", w2: "Art Class", j2: "ずこう", e2: "🎨" },
      { w1: "Classroom", j1: "きょうしつ", e1: "🏫", w2: "Teachers' Room", j2: "しょくいんしつ", e2: "☕" },
      { w1: "School Route", j1: "つうがくろ", e1: "🚸", w2: "School Bus", j2: "スクールバス", e2: "🚌" }
    ],
    fantasy: [
      { w1: "Dragon", j1: "ドラゴン", e1: "🐉", w2: "Dinosaur", j2: "きょうりゅう", e2: "🦖" },
      { w1: "Wizard", j1: "まほうつかい", e1: "🧙", w2: "Witch", j2: "まじょ", e2: "🧙‍♀️" },
      { w1: "Ghost", j1: "おばけ", e1: "👻", w2: "Zombie", j2: "ゾンビ", e2: "🧟" },
      { w1: "Mermaid", j1: "にんぎょ", e1: "🧜‍♀️", w2: "Fairy", j2: "ようせい", e2: "🧚" },
      { w1: "Unicorn", j1: "ユニコーン", e1: "🦄", w2: "Pegasus", j2: "ペガサス", e2: "🐎" },
      { w1: "Vampire", j1: "きゅうけつき", e1: "🧛", w2: "Werewolf", j2: "オオカミ男", e2: "🐺" },
      { w1: "Pirate", j1: "かいぞく", e1: "🏴‍☠️", w2: "Ninja", j2: "にんじゃ", e2: "🥷" },
      { w1: "Treasure Chest", j1: "たからばこ", e1: "💰", w2: "Magic Lamp", j2: "まほうのランプ", e2: "🪔" },
      { w1: "Magic Wand", j1: "まほうのつえ", e1: "🪄", w2: "Crystal Ball", j2: "すいしょう玉", e2: "🔮" },
      { w1: "Knight", j1: "きし", e1: "🛡️", w2: "Samurai", j2: "さむらい", e2: "⚔️" },
      { w1: "King", j1: "王さま", e1: "👑", w2: "Prince", j2: "王子さま", e2: "🤴" },
      { w1: "Princess", j1: "おひめさま", e1: "👸", w2: "Queen", j2: "女王さま", e2: "💎" },
      { w1: "Superhero", j1: "スーパーヒーロー", e1: "🦸", w2: "Villain", j2: "わるもの", e2: "🦹" },
      { w1: "Giant", j1: "きょじん", e1: "🧌", w2: "Dwarf", j2: "こびと", e2: "🍄" },
      { w1: "Time Machine", j1: "タイムマシン", e1: "⏳", w2: "Warp Door", j2: "ワープのとびら", e2: "🚪" },
      { w1: "Invisible Cloak", j1: "とうめいマント", e1: "🫥", w2: "Flying Shoes", j2: "空とぶくつ", e2: "🪽" },
      { w1: "Magic Potion", j1: "まほうのくすり", e1: "🧪", w2: "Spell Book", j2: "まほうの本", e2: "📖" },
      { w1: "Haunted House", j1: "おばけやしき", e1: "🏚️", w2: "Secret Base", j2: "ひみつきち", e2: "🛖" },
      { w1: "Mummy", j1: "ミイラ", e1: "⚰️", w2: "Skeleton", j2: "ガイコツ", e2: "💀" },
      { w1: "Santa Claus", j1: "サンタクロース", e1: "🎅", w2: "Snowman", j2: "ゆきだるま", e2: "⛄" },
      { w1: "Monster", j1: "かいじゅう", e1: "👾", w2: "Giant Robot", j2: "きょだいロボ", e2: "🦾" },
      { w1: "Oni", j1: "おに", e1: "👹", w2: "Kappa", j2: "かっぱ", e2: "🥒" },
      { w1: "Treasure Map", j1: "たからのちず", e1: "📜", w2: "Secret Code", j2: "あんごう", e2: "🔐" },
      { w1: "Phoenix", j1: "フェニックス", e1: "🪶", w2: "Griffin", j2: "グリフォン", e2: "🦅" },
      { w1: "Shooting Star", j1: "ながれ星", e1: "🌠", w2: "Magic Mirror", j2: "まほうのかがみ", e2: "🪞" },
      { w1: "Ice Magic", j1: "こおりのまほう", e1: "❄️", w2: "Fire Magic", j2: "ほのおのまほう", e2: "🔥" },
      { w1: "Cinderella", j1: "シンデレラ", e1: "👠", w2: "Snow White", j2: "しらゆきひめ", e2: "🍎" },
      { w1: "Momotaro", j1: "ももたろう", e1: "🍑", w2: "Urashima Taro", j2: "うらしまたろう", e2: "🐢" },
      { w1: "Little Red Riding Hood", j1: "赤ずきん", e1: "🧺", w2: "Three Little Pigs", j2: "三びきのこぶた", e2: "🐷" },
      { w1: "Jack and the Beanstalk", j1: "ジャックと豆の木", e1: "🌱", w2: "Pinocchio", j2: "ピノキオ", e2: "🤥" }
    ]
  };

  // PAIRS.mix holds the everyday things; the "mix" topic draws from every list.
  var TOPICS = ['food', 'sports', 'school', 'fantasy', 'mix'];

  // The pairs a game with this topic draws from (mix: every topic).
  function pool(topic) {
    if (topic === 'mix') {
      return Object.keys(PAIRS).reduce(function (all, key) { return all.concat(PAIRS[key]); }, []);
    }
    return PAIRS[topic] || PAIRS.food;
  }

  return { PAIRS: PAIRS, TOPICS: TOPICS, pool: pool };
});
