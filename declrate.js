// Declarer win rate and average defender card points for a given AI level at all four seats.
const E = require('./engine.js'), AI = require('./ai.js');
const lvl = process.argv[2] || 'intermediate', N = +process.argv[3] || 400;
let played = 0, dw = 0, optsO = 0, catches = 0, ulti = 0, ultiMade = 0;
for (let s = 1; played < N; s++) {
  const m = E.newMatch({ seed: 5000 + s, levels: [lvl, lvl, lvl, lvl] });
  while (true) { const pd = E.pending(m); if (pd.type === 'end' || pd.type === 'over') break; E.act(m, pd.player, AI.choose(m, lvl)); }
  const r = m.hand.result; if (r.kind !== 'played') continue;
  played++; if (r.ptsD >= 48) dw++; optsO += r.ptsO;
  for (const l of r.lines) { if (/^Pagát ultimó announced by the declarers/.test(l.text)) { ulti++; if (/made/.test(l.text)) ultiMade++; } }
}
console.log(lvl.padEnd(12), 'declarer wins', (dw / played * 100).toFixed(1) + '%', '| defenders avg pts', (optsO / played).toFixed(1), '| decl ultimó made', ultiMade + '/' + ulti);
