# Mitz & Simz Tarokk

**Play:** open `index.html`. It's a single self-contained file, and the one GitHub Pages serves. `node build.js` regenerates it from the sources below.

Hungarian (Paskievics) Tarokk for one human and three AI players. It has optional Illustrated bonuses.

- `engine.js`: the rules engine. It is pure and holds JSON-serialisable state. `act(match, seat, action)` and `pending(match)` drive the whole game, and `viewFor(match, seat)` returns only what that seat may see.
- `ai.js`: the AI players at four levels (novice, intermediate, seasoned, pro).
- `ui.html`: the table UI. It has `/*ENGINE*/` and `/*AI*/` placeholders for the scripts.
- `build.js`: inlines everything into `dist/tarokk.html`, which is a single file you can drop on GitHub Pages.
- `test.js`: checks scoring against the pagat.com multiplier table, then runs about 7,000 seeded AI hands. It checks 94 points per hand, zero-sum scoring, legal play, and that views don't leak cards.
- `tourney.js`: plays each AI level against the others with seats rotated: `node tourney.js 80 10`.
- Card art: set `window.TAROKK_ART = { back: 'data:...', T1: '...', HK: '...' }` before the scripts load. Any card without an image keeps the drawn face.

Run `node test.js && node build.js` after any change.

## v2 additions
- Gold: everyone starts with 100 coins (50/200 in Settings) and the game ends when someone hits 0. Undeclared 8/9 tarokks are claimed from partners only. A caught XXI makes the next four deals double (house rule, switchable).
- Zsófi or Zsolt is picked at random as the fourth player in each new game.
- Tutorial (Learn → lessons 1–4): fixed deals (seeds 3, 9 and 196, found with `node seeds.js declarer|partner|opponent`) where following Mitz's advice wins. There's also a practice hand. Coach advice comes from `AI.recommend()`, which runs on a copy of the game, so the live deal isn't affected.
- Helper: in normal games Mitz suggests moves on request or on every move (Settings). Card plays use the Pro search; everything else uses Seasoned.
- Card art: the full Mitz & Simz deck (42 faces + back) is in `art/*.svg`, about 750 KB, and build.js inlines it as `window.MS_ART`. Tarokks are two genre scenes each, honours get one tall scene, and the courts are double-ended. Hearts are the Mitz & Simz court, diamonds a ginger court, clubs a tabby court and spades a grey court. `art/SPEC.md` is the style brief. Settings → Card art switches back to plain faces.
- Coach: Mitz and Simz take turns, by lesson in the tutorial and by hand in normal games.

## v3 additions
- Sharper defending: Seasoned defenders now use a light version of the Pro look-ahead. The look-ahead's guesses at the hidden hands also respect what the table has revealed: bidders hold an honour, declared tarokk counts are exact, and announcers hold their bonus card. With Seasoned AIs in every seat, the declarer now wins 82.7% of hands (down from 85.1%). In tests where only the defenders were upgraded, the drop was from 89% to 84%. `abtest.js`, `declrate.js` and `h2h.js` are the measuring tools. Head to head: Intermediate beats Novice by 0.71 gold per player per hand, and Seasoned beats Intermediate by 0.51.
- Ideas that measured no better are behind flags in `ai.js` and off by default: guessing partners from smears and overtakes, Pagát-hunting leads, covering a partner's card.
- The summary shows the talon and who took each card. "Replay this hand" (and "Replay last hand" on the score sheet) steps through the deal, bidding and discards, announcements and each trick, with all hands shown.
- Sound effects are generated in the browser (Settings → Sound). Lifetime stats (Scores → Your stats) are kept in localStorage under `msTarokk.stats`.

## Licence
Code: MIT (see LICENSE).
Card art and the Mitz & Simz characters: © MitzNSimz. Not covered by the MIT licence.