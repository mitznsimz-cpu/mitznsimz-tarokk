# Mitz & Simz Tarokk — card art spec (sample set)

Original illustrations for a browser Hungarian Tarokk game, in the spirit of the classic 19th-century
"Industrie und Glück" tarock pattern (public domain): each plain tarokk shows two small genre scenes of
everyday 19th-century life, one above the other, in an engraved/woodcut look with flat colour.
Do NOT copy any specific existing card artwork — invent original scenes.

## The characters
Mitz and Simz are two BLACK CATS (the brand mascots). Body #1d1a1f with soft highlights #3a3540, eyes
yellow-green #d8e04a with dark slit pupils, small pink-grey noses #b07a80. To tell them apart:
Mitz always wears something GOLD (collar, waistcoat, ribbon); Simz always wears something RED.
They may stand upright and wear 19th-century clothing (waistcoats, bonnets, aprons, hats), like the
people in Industrie und Glück scenes. Charming, a little dignified, not cartoon-cute. Other figures in
scenes may be other cats (tabby/grey/white) — no humans.

## Format (every file)
- Standalone SVG: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 310">`. No width/height attrs.
- No external references, no <image>, no scripts, no fonts beyond `font-family="Georgia, 'Times New Roman', serif"`.
- No heavy filters (no feTurbulence/feGaussianBlur). Gradients are fine. Keep each file under ~25 KB.
- Card base: rounded rect 0,0,200,310 rx=12 filled cream #fbf4e2; an inner frame (inset 6) stroked gold #d9ad45 ~2px.
- IMPORTANT: the game overlays a small corner index badge in the TOP-LEFT corner (about x 0–46, y 0–40).
  Keep that area plain background (no important drawing there). The scene panel may start below/right of it,
  or the top-left of the panel can be simple sky/wall.
- The card is shown as small as 66×102 px on phones, so shapes must read at small size: bold silhouettes,
  clear contrast, ink outlines (#2a1a12, stroke 1.4–2.2), limited detail, some hatching for engraved feel.

## Palette
cream #fbf4e2, paper shade #f1e3bd, ink #2a1a12, brand red #b3161f, deep red #8e141c,
gold #d9ad45, light gold #f3d27a, plus muted scene colours used sparingly: grass #6f8a4e, sky #c9d8de,
wood #8a5a34, stone #9a948a, water #6d8fa6.

## Layouts
- Plain tarokk (II–XX): two scene panels, top (x 10–190, y 12–147) and bottom (x 10–190, y 163–298), each
  with a thin ink border. Between them a band y 147–163 holding the Roman numeral centred
  (Georgia bold ~13px, fill #8e141c) with small gold flourishes either side.
- Honours (Skíz, XXI, I/Pagát): ONE tall scene panel (x 10–190, y 12–270) plus a bottom name band
  (y 272–298, deep red fill) with the name in light gold small caps: "SKÍZ", "XXI", "I · PAGÁT". Richer gold accents.
- Court card (king): double-ended like French-suited tarock courts: upper half figure (x 10–190, y 12–153),
  the same figure rotated 180° in the lower half, separated by a thin diagonal or horizontal gold rule.
  Suit symbol drawn small near the TOP-RIGHT and BOTTOM-LEFT corners (top-left belongs to the index badge).
- Back: no cream; deep red #8e141c with a gold lattice/diamond pattern, gold double border, and a central oval
  medallion (cream) containing the two black cats curled into an ampersand "&" shape (that is the brand logo idea:
  two cats forming the & of "D&D"), with one gold and one red collar. Must look good repeated and small.

## Check your work
Render each SVG to PNG at 400x620 and at 66x102 with Playwright (Chromium is pre-installed:
`require('playwright')`, `chromium.launch()` needs no options; do NOT install playwright) and LOOK at both.
Fix anything that is muddy at small size or overlaps the top-left badge zone. Iterate at least once.

---------------------------------------------------------------------------------------------------
# Full deck (approved style: "purrrrfect")

The 7 approved samples are the style reference. Open them and match them closely:
- Plain tarokks: `T2.svg`, `T14.svg` (frames, numeral band, line weight, palette, how Mitz and Simz are drawn).
- Honours and the back: `T22.svg`, `T21.svg`, `T1.svg`, `back.svg`.
- Court cards: `HK.svg`. BUT: in HK the two halves crowd each other in the middle. For every court card,
  each half is a HALF-LENGTH figure (head to waist) that ends cleanly at the centre rule (y=155), with the lower
  half an exact 180° rotation of the upper half: `<g transform="rotate(180 100 155)">`. Nothing crosses the rule
  except the rule itself. Suit pips small near the TOP-RIGHT and BOTTOM-LEFT corners only.
Look at each reference PNG (`preview-*.png`) too. Existing helper scripts may help: /home/claude/work/lib.py
(cat head, sitting cat, honours frame, tails) and /home/claude/artwork-tools/ (preview rendering).

## Recurring characters
- Mitz: black cat, ALWAYS something gold (gold waistcoat, collar, crown...).
- Simz: black cat, ALWAYS something red (red bonnet, scarf, dress...).
- Supporting cast (other cats, never humans): ginger cats (#d4782f with #f0b070 stripes), tabby cats
  (#9a7a52 with dark #5a4430 stripes), grey/silver cats (#8e9298 / #c3c6cb), the occasional white cat (#f4f1ea).

## Suit courts (K, Q, C = cavalier/rider, J = jack/page), all double-ended as above
- Hearts: the Mitz & Simz court. K Mitz (redraw HK with the fixed middle), Q Simz (red gown, rose or fan),
  C Mitz riding: show the half-length rider with the horse's head and neck in front of him (white horse),
  J Simz as a page carrying a small heart banner.
- Diamonds: ginger merchant-court. K with a money pouch and fur hat, Q with jewels and a mirror,
  C ginger rider on a bay horse, J ginger page with a ledger/coin box.
- Clubs: tabby country-court. K with a knotted oak sceptre, Q with a wheat sheaf, C tabby rider on a sturdy
  farm horse, J tabby page with a lantern and staff.
- Spades: grey martial-court. K with a sword, Q with a shield, C grey knight in a plumed helmet on a dark horse,
  J grey squire with a halberd.
Robe colours follow the suit: hearts red/gold, diamonds red/ochre, clubs green/brown (#4e6b3a, #8a5a34) with black
trim, spades slate/black with silver. Keep faces clear and cat-like; keep the figures dignified.

## Pip cards (no court figure)
- Ace of hearts `HX.svg`, ace of diamonds `DX.svg`: one large ornate suit pip in the centre with a gold wreath,
  and a small Mitz (hearts) / ginger kitten (diamonds) curled at its foot. Corner pips TOP-RIGHT and BOTTOM-LEFT.
- Ten of clubs `CX.svg`, ten of spades `SX.svg`: the classic ten-pip layout (4+2+4 in two columns plus middle pair,
  bottom five rotated 180°), pips bold and black, with a tiny tabby (clubs) / grey cat (spades) peeking from the
  bottom edge between the columns. Keep the top-left badge zone (x 0–46, y 0–40) empty.

## File names
Tarokks `T3.svg` … `T20.svg`. Suit cards: suit letter + rank letter, suits H D C S, ranks K Q C J X
(X = ace in red suits, ten in black suits). E.g. `HQ.svg`, `DC.svg`, `SJ.svg`, `CX.svg`.
