// Find tutorial deals: following the coach's advice, the human (seat 0) ends up in the wanted role and their side wins.
const E = require('./engine.js'), AI = require('./ai.js');
const want = process.argv[2];
const found = [];
for (let seed = 1; seed < 6000 && found.length < 5; seed++) {
  const m = E.newMatch({ seed, levels: [null, 'intermediate', 'intermediate', 'intermediate'], names: ['You', 'Mitz', 'Simz', 'Zsófi'] });
  let ok = true;
  while (true) {
    const pd = E.pending(m);
    if (pd.type === 'end' || pd.type === 'over') break;
    const a = pd.player === 0 ? AI.recommend(m) : AI.choose(m);
    E.act(m, pd.player, a);
  }
  const h = m.hand;
  if (h.result.kind !== 'played') continue;
  const role = h.declarer === 0 ? 'declarer' : h.partner === 0 ? 'partner' : 'opponent';
  if (role !== want) continue;
  const mine = h.side[0];
  const win = (h.result.ptsD >= 48) === (mine === 'D');
  if (!win) continue;
  if (h.alone) continue;
  const nT = h.tarokkCount[0];
  const extras = Object.keys(h.items).length - 1;
  found.push({ seed, level: h.level, pts: mine === 'D' ? h.result.ptsD : h.result.ptsO, nT, extras, kontra: h.items.game.kontra, delta: h.result.deltas[0] });
}
console.log(want, JSON.stringify(found));
