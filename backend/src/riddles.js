const fs = require("fs");
const path = require("path");
const MokuRiddles = require("./vendor/moku-riddles");

// The Moku Word Riddles engine with its riddle list loaded, for Riddle Race
// (roomApi.js picks riddles and judges answers with it). Both files are
// copies (Lambda only ships backend/): edit shared/moku-riddles.js and
// data/riddles-db.md, then cp them into src/vendor/ (npm test checks).
MokuRiddles.load(fs.readFileSync(path.join(__dirname, "vendor/riddles-db.md"), "utf8"));

module.exports = MokuRiddles;
