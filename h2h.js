// Two levels head to head: seats alternate A,B,A,B and rotate each match.
const E = require('./engine.js'), AI = require('./ai.js');
const [A, B] = [process.argv[2], process.argv[3]], matches = +process.argv[4] || 300;
const tot = { [A]: 0, [B]: 0 }; let hands = 0;
for (let s = 0; s < matches; s++) {
  const levels = s % 2 ? [A, B, A, B] : [B, A, B, A];
  const m = E.newMatch({ seed: 777 + s, levels, startCoins: 1e6 });
  while (m.handNo <= 10) {
    const pd = E.pending(m);
    if (pd.type === 'end') { if (m.hand.result.kind === 'played') hands++; if (m.handNo === 10) break; E.act(m, -1, { type: 'next' }); continue; }
    E.act(m, pd.player, AI.choose(m, levels[pd.player]));
  }
  m.scores.forEach((v, i) => (tot[levels[i]] += v - 1e6));
}
console.log(`${A}: ${(tot[A] / hands / 2).toFixed(2)}  ${B}: ${(tot[B] / hands / 2).toFixed(2)} gold per player per hand over ${hands} hands`);
