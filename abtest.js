// Defenders use the new defending ideas, the declarer's side plays the old way (or vice versa) — isolates defending.
const E = require('./engine.js'), AI = require('./ai.js');
const lvl = process.argv[2] || 'seasoned', N = +process.argv[3] || 800, defFlags = (process.argv[4] || '').split(',').filter(Boolean), defLvl = process.argv[5] || lvl;
const OLD = ['noInfer', 'noHunt', 'noCatch'];
let played = 0, dw = 0, ptsO = 0, guess = 0, right = 0;
for (let s = 1; played < N; s++) {
  const m = E.newMatch({ seed: 9000 + s, levels: [lvl, lvl, lvl, lvl] });
  while (true) {
    const pd = E.pending(m); if (pd.type === 'end' || pd.type === 'over') break;
    const h = m.hand;
    for (const k of Object.keys(AI.FLAGS)) delete AI.FLAGS[k];
    if (pd.type === 'play') {
      const flags = h.side[pd.player] === 'O' ? defFlags : OLD;
      flags.forEach(f => (AI.FLAGS[f] = true));
      if (h.side[pd.player] === 'O' && !AI.FLAGS.noInfer) { // accuracy of partnership guesses
        const e = AI.partnerEvidence(h, pd.player);
        for (let q = 0; q < 4; q++) if (q !== pd.player && AI.relation(h, pd.player, q) === 'unknown') {
          const g = AI.relationInfer(h, pd.player, q, e);
          if (g !== 'unknown') { guess++; if ((g === 'ally') === (h.side[q] === 'O')) right++; }
        }
      }
    }
    E.act(m, pd.player, AI.choose(m, pd.type === 'play' && h.side[pd.player] === 'O' ? defLvl : lvl));
  }
  const r = m.hand.result; if (r.kind !== 'played') continue;
  played++; if (r.ptsD >= 48) dw++; ptsO += r.ptsO;
}
console.log(`${defLvl} defenders[${defFlags.join(',') || 'all new'}] vs old declarers: declarer wins ${(dw / played * 100).toFixed(1)}%, defenders avg ${(ptsO / played).toFixed(1)} pts` + (guess ? `, partner guesses right ${(right / guess * 100).toFixed(0)}% of ${guess}` : ''));
