'use strict';
const E = require('./engine.js');
const AI = require('./ai.js');
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };

// ---- 1. Game scoring vs the multiplier table on pagat.com ----
// columns: no trick, <=23, 24-47, 48-70, 71+, all tricks (declarer's points/tricks)
const cols = [[0, 0], [20, 3], [40, 5], [60, 6], [80, 8], [94, 9]];
const it = (team, type, k) => ({ key: team + ':' + type, type, team, kontra: k || 0 });
function items(spec) {
  const o = { game: { key: 'game', type: 'game', team: 'D', kontra: spec.gameK || 0 } };
  for (const s of spec.list || []) o[s.key] = s;
  return o;
}
const rows = [
  ['Nothing', {}, [-3, -2, -1, 1, 2, 3]],
  ['Double game', { list: [it('D', 'double')] }, [-7, -6, -5, -4, 4, 7]],
  ['Volát', { list: [it('D', 'volat')] }, [-9, -8, -7, -6, -6, 6]],
  ['Double and volát', { list: [it('D', 'double'), it('D', 'volat')] }, [-13, -12, -11, -10, -2, 10]],
  ['Kontra game', { gameK: 1 }, [-5, -4, -2, 2, 4, 5]],
  ['Kontra game; opp double', { gameK: 1, list: [it('O', 'double')] }, [-9, -6, 2, 6, 8, 9]],
  ['Double; opp kontra double', { list: [it('D', 'double', 1)] }, [-11, -10, -9, -8, 8, 11]],
  ['Double; opp kontra double+game', { gameK: 1, list: [it('D', 'double', 1)] }, [-13, -12, -10, -6, 10, 13]],
];
for (const [name, spec, exp] of rows) for (let i = 0; i < 6; i++) {
  for (const g of [1, 3]) {
    const r = E.scoreGameCore(g, cols[i][0], cols[i][1], items(spec));
    ok(r.net === exp[i] * g, `${name} col ${i} g=${g}: got ${r.net} want ${exp[i] * g}`);
  }
}
console.log('scoring table checked');

// ---- 2. Deck sanity ----
const deck = E.fullDeck();
ok(deck.length === 42, 'deck 42');
ok(deck.reduce((s, c) => s + E.points(c), 0) === 94, 'deck 94 points');

// ---- 3. Simulated matches ----
function runMatch(seed, illustrated, hands) {
  const L = ['novice', 'intermediate', 'seasoned'];
  const m = E.newMatch({ seed, illustrated, levels: [L[seed % 3], L[(seed + 1) % 3], L[(seed + 2) % 3], 'intermediate'] });
  const stats = { played: 0, passed: 0, annulled: 0, proba: 0, declWins: 0, ann: {}, kontraGame: 0, alone: 0, levels: [0, 0, 0, 0, 0] };
  let steps = 0;
  while (m.handNo <= hands) {
    const pd = E.pending(m);
    if (pd.type === 'end' || pd.type === 'over') {
      const h = m.hand;
      const r = h.result;
      const sum = r.deltas.reduce((a, b) => a + b, 0);
      ok(sum === 0, `seed ${seed} hand ${m.handNo} zero-sum (${r.deltas})`);
      if (r.kind === 'played') {
        stats.played++;
        ok(r.ptsD + r.ptsO === 94, 'points 94');
        ok(r.pile.D.trickPts + r.pile.D.skartPts === r.ptsD && r.pile.O.trickPts + r.pile.O.skartPts === r.ptsO, 'pile breakdown adds up');
        ok(r.deltas.every((d, q) => d === r.rows.reduce((a, row) => a + row.deltas[q], 0) * r.mult), 'rows add up to deltas');
        ok(r.lines.reduce((a, l) => a + l.v, 0) === r.net, 'lines add up to net');
        ok(h.play.tricks.length === 9, '9 tricks');
        ok(h.hands.every(x => x.length === 0), 'hands empty');
        const all = new Set();
        for (const t of h.play.tricks) for (const x of t.cards) all.add(x.c);
        h.skartD.concat(h.skartO).forEach(c => all.add(c));
        ok(all.size === 42, 'all cards accounted');
        if (r.ptsD >= 48) stats.declWins++;
        stats.levels[h.level]++;
        if (h.alone) stats.alone++;
        if (h.items.game.kontra) stats.kontraGame++;
        for (const k of Object.keys(h.items)) if (k !== 'game') { const t = k.split(':')[1]; stats.ann[t] = (stats.ann[t] || 0) + 1; }
      } else if (r.kind === 'passedout') stats.passed++;
      else if (r.kind === 'annulled') stats.annulled++;
      else if (r.kind === 'proba') stats.proba++;
      if (h.result.kind === 'played' && h.hat >= 0) stats.xxi = (stats.xxi || 0) + 1;
      if (m.over) { stats.overs = (stats.overs || 0) + 1; ok(m.scores.some(c => c <= 0), 'over only when someone is broke'); break; }
      if (m.handNo === hands) break;
      const dBefore = m.doubles.length, hat = h.hat >= 0 && h.result.kind === 'played';
      E.act(m, -1, { type: 'next' });
      if (hat) ok(m.doubles.includes(4), 'XXI catch adds a 4-deal double window');
      continue;
    }
    const a = AI.choose(m, m.levels[pd.player] || 'intermediate');
    // views must not leak hidden cards
    if (steps % 13 === 0 && pd.type === 'play') {
      const v = E.viewFor(m, 1);
      for (let q = 0; q < 4; q++) if (q !== 1) ok(v.hand.hands[q].every(c => c === null), 'view hides hands');
      ok(v.hand.skartO.every(c => c === null), 'view hides opp discards');
      ok(v.hand.dealt.every((x, q) => q === 1 || x.every(c => c === null)), 'view hides starting hands');
      if (m.hand.partner !== 1 && !m.hand.play.revealed && 1 !== m.hand.declarer) ok(v.hand.partner === -1, 'view hides partner');
    }
    // legality cross-checks
    if (pd.type === 'play') ok(pd.legal.includes(a.card), 'AI picked legal card');
    E.act(m, pd.player, a);
    // JSON round-trip must preserve state
    if (++steps % 97 === 0) {
      const copy = JSON.parse(JSON.stringify(m));
      ok(JSON.stringify(copy) === JSON.stringify(m), 'serialisable');
    }
    if (steps > 200000) { ok(false, 'runaway'); break; }
  }
  ok(m.scores.reduce((a, b) => a + b, 0) === 400, 'coins conserved');
  return stats;
}
const agg = { played: 0, passed: 0, annulled: 0, proba: 0, declWins: 0, ann: {}, kontraGame: 0, alone: 0, levels: [0, 0, 0, 0, 0] };
const t0 = Date.now();
for (let s = 1; s <= 300; s++) {
  let st;
  try { st = runMatch(s, s % 2 === 0, 25); } catch (e) { fails++; console.log('EXC seed', s, e.stack); continue; }
  for (const k of ['played', 'passed', 'annulled', 'proba', 'declWins', 'kontraGame', 'alone', 'xxi', 'overs']) agg[k] = (agg[k] || 0) + (st[k] || 0);
  for (const [k, v] of Object.entries(st.ann)) agg.ann[k] = (agg.ann[k] || 0) + v;
  st.levels.forEach((v, i) => (agg.levels[i] += v));
}
console.log('simulated in', Date.now() - t0, 'ms', JSON.stringify(agg));
console.log('declarer win rate', (agg.declWins / agg.played).toFixed(3));

// ---- 4. Targeted rule checks ----
{
  // obligations: announced ultimó keeps the pagát
  const m = E.newMatch({ seed: 7 });
  const h = m.hand;
  h.phase = 'play'; h.side = ['D', 'O', 'D', 'O']; h.declarer = 0; h.partner = 2;
  h.items = { game: { key: 'game', type: 'game', team: 'D', kontra: 0 }, 'D:ultimo': { key: 'D:ultimo', type: 'ultimo', team: 'D', kontra: 0 } };
  h.hands[0] = ['T1', 'T5', 'HK'];
  h.play = { turn: 0, leader: 0, trick: [{ p: 3, c: 'T9' }], tricks: [], trickNo: 7, lost: { D: false, O: false } };
  const l = E.legalPlays(h, 0);
  ok(l.length === 1 && l[0] === 'T5', 'ultimó pagát held back: ' + l);
  h.hands[0] = ['T1', 'HK'];
  ok(E.legalPlays(h, 0).join() === 'T1', 'pagát forced when only tarokk');
}
{
  // bidding: no honour => pass only (unless 4th seat after 3 passes)
  const m = E.newMatch({ seed: 11 });
  const h = m.hand; const p = h.bid.turn;
  h.hands[p] = ['T2', 'T3', 'HK', 'HQ', 'DK', 'DQ', 'CK', 'CQ', 'SK'];
  ok(E.bidOptions(h, p).map(o => o.type).join() === 'pass', 'no honour must pass');
  h.hands[p] = ['T22', 'T3', 'HK', 'HQ', 'DK', 'DQ', 'CK', 'CQ', 'SK'];
  const o = E.bidOptions(h, p);
  ok(o.some(x => x.type === 'bid' && x.level === 1) && !o.some(x => x.level === 2), 'no XIX → cannot open two (cue)');
  h.hands[p] = ['T22', 'T19', 'HK', 'HQ', 'DK', 'DQ', 'CK', 'CQ', 'SK'];
  ok(E.bidOptions(h, p).some(x => x.level === 2 && x.cue === 'T19'), 'XIX allows cue two');
}
{
  // undeclared 9 tarokks: claimed from the partner only; declared: from everyone
  const play = (declare) => {
    for (let seed = 1; seed < 4000; seed++) {
      const m = E.newMatch({ seed });
      let found = false;
      while (true) {
        const pd = E.pending(m);
        if (pd.type === 'end' || pd.type === 'over') break;
        let a = AI.choose(m, 'intermediate');
        if (pd.type === 'announce' && a.declare) { if (!declare) a.declare = 0; found = true; }
        E.act(m, pd.player, a);
      }
      const h = m.hand;
      if (!found || h.result.kind !== 'played') continue;
      return h;
    }
  };
  const h1 = play(false);
  const q = h1.tarokkCount.findIndex(n => n >= 8);
  const line = h1.result.declLines.find(l => l.player === q);
  ok(line && /undeclared/.test(line.text), 'undeclared claim line: ' + (line && line.text));
  const h2 = play(true);
  ok(h2.result.declLines.some(l => /declared \d tarokks: \d from each/.test(l.text)), 'declared line');
  // names: Zsófi or Zsolt
  const names = new Set();
  for (let s2 = 1; s2 < 40; s2++) names.add(E.newMatch({ seed: s2 }).names[3]);
  ok(names.has('Zsófi') && names.has('Zsolt') && names.size === 2, 'Zsófi/Zsolt alternate: ' + [...names]);
}
// ---- 5. Pro AI smoke test: a few hands with pro players, legal and terminating ----
{
  const t1 = Date.now();
  const m = E.newMatch({ seed: 99, levels: ['pro', 'pro', 'pro', 'pro'] });
  let decisions = 0;
  while (m.handNo <= 3) {
    const pd = E.pending(m);
    if (pd.type === 'end' || pd.type === 'over') { if (m.handNo === 3 || m.over) break; E.act(m, -1, { type: 'next' }); continue; }
    const a = AI.choose(m, 'pro');
    if (pd.type === 'play') { ok(pd.legal.includes(a.card), 'pro legal'); decisions++; }
    E.act(m, pd.player, a);
  }
  console.log('pro: ' + decisions + ' plays in ' + (Date.now() - t1) + 'ms');
}
console.log(fails ? `${fails} FAILURES` : 'ALL OK');
process.exit(fails ? 1 : 0);
