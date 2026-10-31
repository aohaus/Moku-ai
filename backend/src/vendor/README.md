# backend/src/vendor

Copies of files from `shared/` that the Lambda functions need. Only `backend/`
is uploaded on `sam deploy`, so a Lambda can't `require("../../shared/…")`.

| File | Copied from |
| --- | --- |
| `moku-chess-rules.js` | `shared/moku-chess-rules.js` |
| `moku-ontology.js` | `shared/moku-ontology.js` (GET /players/kin) |
| `moku-wolf-words.js` | `shared/moku-wolf-words.js` (Moku Wolf Multiplayer rooms) |

**Never edit these.** Change the file in `shared/`, then copy it again:

```sh
cp shared/moku-chess-rules.js backend/src/vendor/
cp shared/moku-ontology.js backend/src/vendor/
cp shared/moku-wolf-words.js backend/src/vendor/
```

`npm test` fails if a copy differs from its original (`test/matchApi.test.js`, `test/accountApi.test.js`, `test/wolfRoom.test.js`).
