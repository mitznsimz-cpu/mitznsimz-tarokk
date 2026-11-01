/* Mitz & Simz Tarokk — AI players.
   Levels: novice, intermediate, seasoned, pro.
   - novice:       rough hand judgement, often plays a random legal card, forgets most announcements
   - intermediate: rule-of-thumb play (cash kings, smear points on partner, catch the XXI, keep the pagát)
   - seasoned:     intermediate + card counting: tracks which players are out of a suit or of tarokks
   - pro:          for every card play, deals out many guesses of the hidden hands that fit everything seen so far,
                   plays each guess to the end, and picks the card that scores best on average (Monte Carlo)
   AIs only use information a real player at the table would have. */
(function (root) {
'use strict';
const E = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.TarokkEngine;
const { isT, tv, suitOf, isHonour, isKing, points, beats, SUITS } = E;
const LEVELS = ['novice', 'intermediate', 'seasoned', 'pro'];
const FLAGS = (typeof process !== 'undefined' && process.env && process.env.TAROKK_AI) ? Object.fromEntries(process.env.TAROKK_AI.split(',').map(k => [k, true])) : {};

function strength(hand) {
  const ts = hand.filter(isT);
  const nT = ts.length;
  const has = c => hand.includes(c);
  const highs = ts.filter(c => tv(c) >= 17 && tv(c) <= 20).length;
  const kings = hand.filter(isKing).length;
  const queens = hand.filter(c => !isT(c) && c[1] === 'Q').length;
  const voids = SUITS.filter(s => !hand.some(c => c[0] === s)).length;
  let s = nT + 3 * has('T22') + 2.5 * has('T21') + 0.5 * has('T1') + 0.7 * highs + kings + 0.4 * queens + 0.6 * voids;
  if (!has('T22') && !has('T21')) s -= 1;
  return s;
}
const str = c => (isT(c) ? 100 + tv(c) : E.RANKS.length - E.RANKS.indexOf(c[1]));
const rnd = m => E.rngNext(m.rs);
const pick = (m, arr) => arr[Math.floor(rnd(m) * arr.length)];

// ---------- Bidding ----------
function bid(m, p, level) {
  const h = m.hand, hand = h.hands[p];
  const opts = E.bidOptions(h, p);
  let s = strength(hand);
  if (level === 'novice') s += (rnd(m) - 0.5) * 5;
  if (level === 'seasoned' || level === 'pro') s += 0.3;
  let max = s < 9 ? 0 : s < 11 ? 1 : s < 13 ? 2 : s < 15.5 ? 3 : 4;
  if (level === 'novice') max = Math.min(max, 2);
  if (!hand.some(isHonour)) max = 0;
  const pass = opts.find(o => o.type === 'pass');
  if (pass && pass.yielded && max < 3 && level !== 'novice') return pass;
  const hold = opts.find(o => o.type === 'hold');
  if (hold && hold.level <= max) return hold;
  const bids = opts.filter(o => o.type === 'bid' && !o.proba && o.level <= max && !(level === 'novice' && o.cue));
  if (bids.length) {
    const cue = bids.find(o => o.cue);
    const cueP = level === 'intermediate' ? 0.35 : 0.6;
    if (cue && rnd(m) < cueP) return cue;
    const plain = bids.filter(o => !o.cue);
    return plain.length ? plain[0] : bids[0];
  }
  if (pass) return pass;
  return hold || opts[0]; // forced (yield situation without the promised cards)
}

// ---------- Discard ----------
function discard(m, p, level) {
  const h = m.hand;
  const need = h.exch.need[p];
  let hand = h.hands[p].slice();
  const chosen = [];
  const isDecl = p === h.declarer;
  for (let k = 0; k < need; k++) {
    const legal = hand.filter(c => !E.discardForbidden(h, p, c));
    let best = null;
    if (level === 'novice') {
      const plain = legal.filter(c => !isT(c));
      best = pick(m, plain.length ? plain : legal);
    } else {
      let bestScore = -1e9;
      for (const c of legal) {
        let sc;
        if (isT(c)) sc = -50 - tv(c);
        else {
          const len = hand.filter(x => x[0] === c[0]).length;
          const hasKing = hand.includes(c[0] + 'K');
          sc = 20 + (isDecl ? points(c) * 1.2 : -points(c) * 1.5) + (hasKing ? -2 : 0) + (6 - len * 1.6);
        }
        if (sc > bestScore) { bestScore = sc; best = c; }
      }
    }
    chosen.push(best);
    hand = hand.filter(c => c !== best);
  }
  return chosen;
}

function annul(m, p) {
  return m.hand.hands[p].filter(isKing).length !== 4; // the other annul-able holdings are all very poor
}

function call(m, p) {
  const h = m.hand;
  const opts = E.callOptions(h);
  if (opts.length === 1) return opts[0].card;
  const plain = opts.find(o => !o.self && !o.any);
  if (strength(h.hands[p]) >= 17.5) { const self = opts.find(o => o.self && o.card === 'T20'); if (self) return self.card; }
  return (plain || opts[0]).card;
}

// ---------- Announcements ----------
function announce(m, p, level) {
  const h = m.hand, hand = h.hands[p];
  const o = E.announceOptions(h, p);
  const S = h.side[p];
  const has = c => hand.includes(c);
  const nT = hand.filter(isT).length;
  const s = strength(hand);
  const novice = level === 'novice';
  const a = { type: 'announce', declare: (o.declare && (!novice || rnd(m) < 0.5)) ? o.declare : 0, bonuses: [], kontras: [] };
  const want = k => { if (o.bonuses.some(b => b.key === k) && !a.bonuses.includes(k)) a.bonuses.push(k); };
  const kon = k => { if (o.kontras.some(b => b.key === k) && !a.kontras.includes(k)) a.kontras.push(k); };
  for (const md of o.mandatory) {
    if (md.kind === 'kontraGame') kon('game');
    if (md.kind === 'ultimo') { want(S + ':ultimo'); if (o.declare) a.declare = o.declare; }
  }
  if (!novice && h.ann.turns[p] === 0) {
    const kontraAt = level === 'intermediate' ? 12 : 11.2;
    if (S === 'D') {
      if (has('T1') && has('T21') && has('T22') && nT >= 6) want('D:trull');
      if (hand.filter(isKing).length === 4 && nT >= 6 && has('T22')) want('D:kings4');
      if (has('T1') && (nT >= 9 || (nT >= 8 && (has('T21') || has('T22'))))) want('D:ultimo');
      if (s >= 18.5) want('D:double');
    } else {
      if (s >= kontraAt && h.items.game.kontra === 0) kon('game');
      if (has('T1') && nT >= 9) want('O:ultimo');
    }
  }
  if (!novice) for (const k of o.kontras) {
    const it = h.items[k.key];
    if (k.level % 2 === 0) {
      if (it.type === 'game' && p === h.declarer && s >= 16 && k.level === 2) kon(k.key);
      continue;
    }
    if (it.type === 'game') continue;
    switch (it.type) {
      case 'ultimo': if (nT >= 6 && (has('T22') || has('T21'))) kon(k.key); break;
      case 'trull': if (has('T22')) kon(k.key); break;
      case 'kings4': if (hand.some(isKing) && nT >= 5) kon(k.key); break;
      case 'double': if (s >= 9) kon(k.key); break;
      case 'volat': if (s >= 7) kon(k.key); break;
      default: if (E.BONUS[it.type].ill && nT >= 6 && (has('T22') || has('T21'))) kon(k.key);
    }
  }
  if (a.bonuses.length && !a.kontras.length && h.ann.pub[p] == null && h.ann.ref !== S) {
    if (S === 'O' && o.kontras.some(k => k.key === 'game') && s >= 9) a.kontras.push('game');
    else a.bonuses = [];
  }
  if (E.validateAnnounce(h, p, a)) {
    const b = { type: 'announce', declare: o.declare || 0, bonuses: [], kontras: [] };
    for (const md of o.mandatory) {
      if (md.kind === 'kontraGame') b.kontras.push('game');
      if (md.kind === 'ultimo') b.bonuses.push(S + ':ultimo');
    }
    return b;
  }
  return a;
}

// ---------- Card play: shared knowledge ----------
function relation(h, p, q) {
  if (q === p) return 'ally';
  const S = h.side[p];
  if (h.ann.pub[q]) return h.ann.pub[q] === S ? 'ally' : 'enemy';
  if (q === h.declarer) return S === 'D' ? 'ally' : 'enemy';
  if (p === h.partner) return 'enemy'; // the partner knows everyone
  if (h.play && h.play.revealed && h.partner < 0) return S === 'O' ? 'ally' : 'enemy';
  if (S === 'O' && h.calledSkartBy === p) return 'ally';
  return 'unknown';
}
// Reading the play: who smears points onto whose tricks, and who overtakes whom, hints at the hidden partnership.
// Returns evidence per player: positive = looks like the declarer's side, negative = looks like a defender.
function partnerEvidence(h, p) {
  const e = [0, 0, 0, 0];
  const S = h.side[p], other = S === 'D' ? 'O' : 'D';
  const ks = q => { const r = relation(h, p, q); return r === 'unknown' ? null : r === 'ally' ? S : other; };
  const all = h.play.tricks.map(t => t.cards).concat(h.play.trick.length ? [h.play.trick] : []);
  for (const cards of all) {
    const led = suitOf(cards[0].c);
    for (let i = 1; i < cards.length; i++) {
      const q = cards[i].p;
      if (ks(q)) continue;
      let w = 0;
      for (let j = 1; j < i; j++) if (beats(cards[j].c, cards[w].c, led)) w = j;
      const ws = ks(cards[w].p);
      if (!ws) continue;
      const over = beats(cards[i].c, cards[w].c, led), pts = points(cards[i].c);
      const sign = ws === 'D' ? 1 : -1;
      if (over) e[q] -= 1.5 * sign;          // overtaking a side's winning card: probably not on that side
      else if (pts >= 3) e[q] += 1.5 * sign; // feeding points to a side's winning card: probably on that side
    }
  }
  return e;
}
function relationInfer(h, p, q, e) {
  const r = relation(h, p, q);
  if (r !== 'unknown') return r;
  const S = h.side[p];
  if (S === 'O') {
    const unk = [0, 1, 2, 3].filter(x => x !== p && x !== h.declarer && relation(h, p, x) === 'unknown');
    if (unk.length === 1) { // the other non-declarer has shown their side, so this one is on the opposite side
      const o = [0, 1, 2, 3].find(x => x !== p && x !== h.declarer && x !== q);
      return relation(h, p, o) === 'enemy' ? 'ally' : 'enemy';
    }
    if (unk.length !== 2) return 'unknown';
    if (!FLAGS.useEvidence) return 'unknown'; // play-reading guesses measured no better than not guessing
    const [a, b] = unk;
    const d = e[a] - e[b];
    if (Math.abs(d) >= 1.5) return q === (d > 0 ? a : b) ? 'enemy' : 'ally';
    if (e[q] >= 2.5) return 'enemy';
    if (e[q] <= -2.5) return 'ally';
    return 'unknown';
  }
  // the declarer looking for a partner
  if (!FLAGS.useEvidence) return 'unknown';
  const unk = [0, 1, 2, 3].filter(x => x !== p && relation(h, p, x) === 'unknown');
  const best = unk.slice().sort((x, y) => e[y] - e[x]);
  if (e[best[0]] >= 1.5 && (best.length < 2 || e[best[0]] - e[best[1]] >= 1.5)) return q === best[0] ? 'ally' : 'enemy';
  if (e[q] <= -1.5) return 'enemy';
  return 'unknown';
}
function unseenTarokks(h, p) {
  const seen = new Set(h.hands[p]);
  for (const t of h.play.tricks) for (const x of t.cards) seen.add(x.c);
  for (const x of h.play.trick) seen.add(x.c);
  for (const c of h.skartBy[p]) seen.add(c);
  for (const c of h.skartD) if (isT(c)) seen.add(c); // the declarer's discarded tarokks were shown
  const out = [];
  for (let i = 1; i <= 22; i++) if (!seen.has('T' + i)) out.push(i);
  return out;
}
function suitPlayed(h, s) {
  let n = 0;
  for (const t of h.play.tricks) if (suitOf(t.cards[0].c) === s) n++;
  return n;
}
// who has shown out of what: voids[q][suit or 'T']
function voids(h) {
  const v = [0, 1, 2, 3].map(() => ({}));
  const all = h.play.tricks.map(t => t.cards).concat(h.play.trick.length ? [h.play.trick] : []);
  for (const cards of all) {
    const led = suitOf(cards[0].c);
    for (let i = 1; i < cards.length; i++) {
      const s = suitOf(cards[i].c);
      if (s !== led) {
        v[cards[i].p][led] = true;
        if (led !== 'T' && s !== 'T') v[cards[i].p].T = true;
      }
    }
  }
  return v;
}
function lowest(cards, avoid) {
  const pool = cards.filter(c => !avoid.includes(c));
  const use = pool.length ? pool : cards;
  return use.slice().sort((a, b) => points(a) - points(b) || str(a) - str(b))[0];
}
function highestPts(cards, avoid) {
  const pool = cards.filter(c => !avoid.includes(c));
  const use = pool.length ? pool : cards;
  return use.slice().sort((a, b) => points(b) - points(a) || str(a) - str(b))[0];
}

// ---------- Card play: rule-of-thumb player (intermediate; seasoned adds card counting) ----------
function heuristicPlay(m, p, legal, track) {
  const h = m.hand, pl = h.play;
  if (legal.length === 1) return legal[0];
  const hand = h.hands[p];
  const unseen = unseenTarokks(h, p);
  const topUnseen = unseen.length ? Math.max(...unseen) : 0;
  const skizOut = unseen.includes(22);
  const tr = pl.trick;
  const nT = hand.filter(isT).length;
  const S = h.side[p];
  const keep = ['T1'];
  if (skizOut) keep.push('T21');
  const vd = track ? voids(h) : null;
  const ev = track ? partnerEvidence(h, p) : null;
  const rel_ = q => (track && !FLAGS.noInfer ? relationInfer(h, p, q, ev) : relation(h, p, q));
  const enemyUlti = !!h.items[(S === 'D' ? 'O' : 'D') + ':ultimo'] && !hand.includes('T1');
  const after = [];
  for (let i = tr.length + 1; i < 4; i++) after.push((p + i - tr.length) % 4);
  const afterOutOfTrumps = !!track && after.length > 0 && after.every(q => vd[q].T);
  const others = [0, 1, 2, 3].filter(q => q !== p);

  if (!tr.length) { // leading
    const ts = legal.filter(isT);
    const ulti = h.items[S + ':ultimo'];
    if (track && enemyUlti && FLAGS.hunt) { // keep tarokks for the last trick: lead suits instead
      const plain = legal.filter(c => !isT(c));
      if (plain.length) return FLAGS.huntLow ? lowest(plain, []) : (plain.find(isKing) || lowest(plain, []));
    }
    if (ulti && ts.length) {
      const top = ts.filter(c => tv(c) > topUnseen && c !== 'T1');
      if (top.length) return top.sort((a, b) => tv(a) - tv(b))[0];
      return lowest(ts, ['T1', 'T22', 'T21']);
    }
    let kings = legal.filter(isKing);
    if (track) kings = kings.filter(c => others.every(q => rel_(q) === 'ally' || !vd[q][c[0]] || vd[q].T));
    else kings = kings.filter(c => suitPlayed(h, c[0]) === 0);
    if (kings.length && pl.trickNo <= (track ? 7 : 5)) return kings[0];
    if (ts.length) {
      const top = ts.filter(c => tv(c) > topUnseen && c !== 'T1');
      if (S === 'D' && top.length && nT >= 3) return top.sort((a, b) => tv(a) - tv(b))[0];
      if (S === 'D' && nT >= 5) return lowest(ts, keep.concat(['T22']));
    }
    let suits = legal.filter(c => !isT(c));
    if (track && suits.length) { // prefer a suit an ally is void in (they can trump it)
      const good = suits.filter(c => others.some(q => rel_(q) === 'ally' && vd[q][c[0]] && !vd[q].T));
      if (good.length) suits = good;
    }
    if (suits.length) return lowest(suits, []);
    return lowest(legal, keep.concat(['T22']));
  }

  const led = suitOf(tr[0].c);
  let wi = 0;
  for (let i = 1; i < tr.length; i++) if (beats(tr[i].c, tr[wi].c, led)) wi = i;
  const cur = tr[wi];
  const rel = rel_(cur.p);
  const isLast = tr.length === 3;
  const pts = tr.reduce((s, x) => s + points(x.c), 0);
  const winners = legal.filter(c => beats(c, cur.c, led));
  const xxi = tr.find(x => x.c === 'T21');
  if (xxi && legal.includes('T22') && rel_(xxi.p) !== 'ally') return 'T22';
  const pag = tr.find(x => x.c === 'T1');
  if (track && !FLAGS.noCatch && pag && rel_(pag.p) !== 'ally' && rel !== 'ally' && winners.length) { // catch the pagát
    const cheap = winners.filter(c => c !== 'T22' || winners.length === 1).sort((a, b) => str(a) - str(b));
    if (cheap.length) return cheap[0];
  }
  const topTrump = c => isT(c) && (tv(c) > topUnseen || afterOutOfTrumps);

  if (rel === 'ally') {
    let safe = isLast || cur.c === 'T22' || topTrump(cur.c);
    if (!safe && track && !isT(cur.c)) // ally's suit card holds if nobody after can beat it
      safe = after.every(q => rel_(q) === 'ally' || (!vd[q][led])) && cur.c[1] === 'K' && suitPlayed(h, led) === 0;
    if (safe) return highestPts(legal, isLast ? ['T22'] : ['T22', 'T21', 'T1']);
    if (!(track && FLAGS.cover && after.some(q => rel_(q) !== 'ally') && winners.length)) return lowest(legal, keep.concat(['T22']));
    // an opponent can still overtake my partner: play to win it myself, as if the partner weren't there
  }
  const relW = rel === 'ally' ? 'unknown' : rel;
  if (winners.length) {
    if (isLast) {
      const cheap = winners.slice().sort((a, b) => str(a) - str(b));
      const c0 = cheap[0];
      if (relW === 'unknown' && pts < 3 && (c0 === 'T22' || c0 === 'T21')) return lowest(legal, keep.concat(['T22']));
      if (c0 === 'T1' && cheap.length > 1 && pl.trickNo < 9) return pts >= 5 ? c0 : cheap[1];
      return c0;
    }
    const safeWins = winners.filter(c => topTrump(c) || (!isT(c) && led !== 'T' && c[1] === 'K' && suitPlayed(h, led) === 0 &&
      (!track || after.every(q => !vd[q][led] || rel_(q) === 'ally'))));
    if (safeWins.length && (pts >= 3 || relW === 'enemy')) {
      const nonHonour = safeWins.filter(c => c !== 'T21' && c !== 'T22');
      return (nonHonour.length ? nonHonour : safeWins).sort((a, b) => str(a) - str(b))[0];
    }
    if (relW === 'enemy' || pts >= 4) {
      const usable = winners.filter(c => !keep.includes(c) && c !== 'T22');
      if (usable.length) return usable.sort((a, b) => str(b) - str(a))[0];
    }
  }
  return lowest(legal, keep.concat(['T22']));
}

// ---------- Card play: Monte Carlo (pro) ----------
// Deal the unseen cards to the other players in a way consistent with what has been seen
// (who is out of which suit, shown discards, promised cards from invitations), many times over.
function sampleWorld(m, p) {
  const h = m.hand;
  const seen = new Set(h.hands[p]);
  for (const t of h.play.tricks) for (const x of t.cards) seen.add(x.c);
  for (const x of h.play.trick) seen.add(x.c);
  for (const c of h.skartBy[p]) seen.add(c);
  if (p !== h.declarer) h.skartD.filter(isT).forEach(c => seen.add(c));
  const U = E.fullDeck().filter(c => !seen.has(c));
  const vd = voids(h);
  const others = [0, 1, 2, 3].filter(q => q !== p);
  const must = {};
  const b = h.bid;
  if (b.cue && b.cue.by !== p && !seen.has(b.cue.card)) must[b.cue.card] = b.cue.by;
  if (b.yielded && b.yielded.by !== p && !seen.has('T20')) must.T20 = b.yielded.by;
  for (let attempt = 0; attempt < 60; attempt++) {
    const relax = attempt >= 40;
    const pool = E.shuffle(U.slice(), m.rs);
    const hands = {}, skart = {};
    for (const q of others) { hands[q] = []; skart[q] = []; }
    let okAll = true;
    for (const [c, q] of Object.entries(must)) { hands[q].push(c); pool.splice(pool.indexOf(c), 1); }
    for (const q of others) {
      const len = h.skartBy[q].length;
      if (!len) continue;
      const shownT = q === h.declarer ? h.skartD.filter(isT) : [];
      let nT = q === h.declarer ? 0 : h.tarokkDiscards[q];
      let nS = len - shownT.length - nT;
      skart[q].push(...shownT);
      for (let i = pool.length - 1; i >= 0 && (nT > 0 || nS > 0); i--) {
        const c = pool[i];
        if (isT(c)) { if (nT > 0 && !isHonour(c) && c !== 'T20' && must[c] == null) { skart[q].push(c); pool.splice(i, 1); nT--; } }
        else if (nS > 0 && !isKing(c)) { skart[q].push(c); pool.splice(i, 1); nS--; }
      }
      if (nT > 0 || nS > 0) { okAll = false; break; }
    }
    if (!okAll) continue;
    const space = q => h.hands[q].length - hands[q].length;
    const elig = c => others.filter(q => space(q) > 0 && (relax || !vd[q][suitOf(c)]));
    pool.sort((a, c2) => elig(a).length - elig(c2).length);
    for (const c of pool) {
      const e = elig(c);
      if (!e.length) { okAll = false; break; }
      const tot = e.reduce((s, q) => s + space(q), 0);
      let r = E.rngNext(m.rs) * tot, chosen = e[0];
      for (const q of e) { r -= space(q); if (r < 0) { chosen = q; break; } }
      hands[chosen].push(c);
    }
    if (!okAll) continue;
    return { hands, skart };
  }
  return null;
}
// What the table has revealed about each hidden hand: bidders hold an honour, declared tarokk counts are exact,
// announcers hold their bonus card. Used to reject sampled deals that contradict it.
function handConstraints(h, p) {
  const played = [[], [], [], []];
  for (const t of h.play.tricks) for (const x of t.cards) played[x.p].push(x.c);
  for (const x of h.play.trick) played[x.p].push(x.c);
  const cons = [0, 1, 2, 3].map(() => ({ honour: false, nT: null, cards: [] }));
  for (const a of h.bid.actions) if (a.type === 'bid' && !(h.bid.proba && a.p === h.declarer)) cons[a.p].honour = true;
  for (let q = 0; q < 4; q++) if (h.ann.declared[q]) cons[q].nT = h.ann.declared[q] - played[q].filter(isT).length;
  for (const it of Object.values(h.items)) {
    if (it.type === 'game' || it.by == null) continue;
    const def = E.BONUS[it.type];
    const c = def.king ? it.param + 'K' : def.card;
    if (c && !played[it.by].includes(c)) cons[it.by].cards.push(c);
  }
  for (let q = 0; q < 4; q++) if (cons[q].honour && played[q].some(isHonour)) cons[q].honour = false;
  return cons;
}
function fits(w, cons, p) {
  for (const q of Object.keys(w.hands)) {
    const c = cons[q], hand = w.hands[q];
    if (c.honour && !hand.some(isHonour)) return false;
    if (c.nT != null && hand.filter(isT).length !== c.nT) return false;
    if (c.cards.some(x => !hand.includes(x))) return false;
  }
  return true;
}
function sampleWorldFit(m, p, cons) {
  let w = null;
  for (let i = 0; i < 25; i++) { w = sampleWorld(m, p); if (!w || fits(w, cons, p)) return w; }
  return w; // couldn't satisfy everything: use the last guess
}
function buildSim(m, p, w) {
  const h = m.hand;
  const sim = { v: 1, seed: 0, rs: { s: (E.rngNext(m.rs) * 4294967296) >>> 0 }, illustrated: m.illustrated, names: m.names,
    levels: m.levels, scores: [0, 0, 0, 0], dealer: m.dealer, handNo: m.handNo, doubles: [], history: [], hand: JSON.parse(JSON.stringify(h)) };
  const s = sim.hand;
  for (const q of Object.keys(w.hands)) s.hands[q] = E.sortHand(w.hands[q]);
  for (const q of Object.keys(w.skart)) s.skartBy[q] = w.skart[q];
  s.skartD = s.skartBy[s.declarer].slice();
  s.skartO = [0, 1, 2, 3].filter(q => q !== s.declarer).flatMap(q => s.skartBy[q]);
  if (!(h.play && h.play.revealed) && p !== h.partner) {
    let partner = -1;
    for (let q = 0; q < 4; q++) if (s.hands[q].includes(s.called)) partner = q;
    s.alone = partner === -1 || partner === s.declarer;
    s.partner = s.alone ? -1 : partner;
    s.side = [0, 1, 2, 3].map(q => (q === s.declarer || q === s.partner ? 'D' : 'O'));
  }
  s.ann.pub = s.side.slice();
  return sim;
}
function rollout(sim) {
  let guard = 0;
  while (sim.hand.phase === 'play' && guard++ < 60) {
    const q = sim.hand.play.turn;
    const legal = E.legalPlays(sim.hand, q);
    E.act(sim, q, { type: 'play', card: heuristicPlay(sim, q, legal, false) });
  }
}
function evalFor(sim, p) {
  const r = sim.hand.result;
  if (!r || r.kind !== 'played') return 0;
  const mine = sim.hand.side[p];
  return (mine === 'D' ? r.net : -r.net) * 6 + (mine === 'D' ? r.ptsD : r.ptsO) * 0.15;
}
function proPlay(m, p, legal, budget) {
  const n = Math.max(budget ? 6 : 10, Math.min(budget ? 14 : 36, Math.ceil((budget || 260) / legal.length)));
  const cons = FLAGS.noCons ? null : handConstraints(m.hand, p);
  const total = legal.map(() => 0);
  let used = 0;
  for (let i = 0; i < n; i++) {
    const w = cons ? sampleWorldFit(m, p, cons) : sampleWorld(m, p);
    if (!w) break;
    const base = buildSim(m, p, w);
    const baseJSON = JSON.stringify(base.hand);
    legal.forEach((c, k) => {
      const sim = Object.assign({}, base, { rs: { s: base.rs.s }, scores: [0, 0, 0, 0], hand: JSON.parse(baseJSON) });
      E.act(sim, p, { type: 'play', card: c });
      rollout(sim);
      total[k] += evalFor(sim, p);
    });
    used++;
  }
  if (!used) return heuristicPlay(m, p, legal, true);
  let best = 0;
  for (let k = 1; k < legal.length; k++) if (total[k] > total[best]) best = k;
  return legal[best];
}

function play(m, p, level) {
  const legal = E.legalPlays(m.hand, p);
  if (legal.length === 1) return legal[0];
  switch (level) {
    case 'novice': return rnd(m) < 0.45 ? pick(m, legal) : heuristicPlay(m, p, legal, false);
    case 'seasoned': // defenders look a few deals ahead; the declarer's side plays by card-counting rules of thumb
      return m.hand.side[p] === 'O' && !FLAGS.noLook ? proPlay(m, p, legal, 90) : heuristicPlay(m, p, legal, true);
    case 'pro': return proPlay(m, p, legal);
    default: return heuristicPlay(m, p, legal, false);
  }
}

function choose(m, level) {
  const pd = E.pending(m);
  const p = pd.player;
  level = level || (m.levels && m.levels[p]) || 'intermediate';
  switch (pd.type) {
    case 'bid': { const o = bid(m, p, level); return { type: o.type, level: o.level }; }
    case 'discard': return { type: 'discard', cards: discard(m, p, level) };
    case 'annul': return { type: 'annul', yes: annul(m, p) };
    case 'call': return { type: 'call', card: call(m, p) };
    case 'announce': return announce(m, p, level);
    case 'play': return { type: 'play', card: play(m, p, level) };
    default: return null;
  }
}

// What a strong player would do here — computed on a copy so the live game's random stream is untouched.
function recommend(m, level) {
  const copy = JSON.parse(JSON.stringify(m));
  return choose(copy, level || 'seasoned');
}

const api = { choose, recommend, strength, relation, relationInfer, partnerEvidence, voids, LEVELS, sampleWorld, FLAGS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.TarokkAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
