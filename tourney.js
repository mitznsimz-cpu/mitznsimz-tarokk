// Tournament: one player of each level, seats rotated each match. Reports average score per hand by level.
const E = require('./engine.js'), AI = require('./ai.js');
const L = ['novice', 'intermediate', 'seasoned', 'pro'];
const tot = { novice: 0, intermediate: 0, seasoned: 0, pro: 0 }; let hands = 0;
const matches = +process.argv[2] || 60, per = +process.argv[3] || 10;
for (let s = 0; s < matches; s++) {
  const rot = s % 4;
  const levels = [0, 1, 2, 3].map(i => L[(i + rot) % 4]);
  const m = E.newMatch({ seed: 1000 + s, levels });
  while (true) {
    const pd = E.pending(m);
    if (pd.type === 'end' || pd.type === 'over') { if (m.hand.result.kind === 'played') hands++; if (m.handNo >= per || m.over) break; E.act(m, -1, { type: 'next' }); continue; }
    E.act(m, pd.player, AI.choose(m, levels[pd.player]));
  }
  m.scores.forEach((v, i) => (tot[levels[i]] += v - m.startCoins));
}
for (const k of L) console.log(k.padEnd(13), (tot[k] / hands).toFixed(3), 'per hand');
console.log('hands', hands);
