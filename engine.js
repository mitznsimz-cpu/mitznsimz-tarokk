/* Mitz & Simz Tarokk — rules engine (Hungarian / Paskievics Tarokk, optional Illustrated bonuses)
   Pure, JSON-serialisable state. Works in browser (window.TarokkEngine) and Node (module.exports). */
(function (root) {
'use strict';

// ---------- Cards ----------
// Tarokks: 'T1'..'T21', 'T22' = skíz.  Suit cards: suit + rank, suits H D C S, ranks K Q C J X (X = ace in red, ten in black)
const SUITS = ['H', 'D', 'C', 'S'];
const RANKS = ['K', 'Q', 'C', 'J', 'X'];
const RANK_VAL = { K: 5, Q: 4, C: 3, J: 2, X: 1 };
const BID_NAMES = ['', 'Three', 'Two', 'One', 'Solo'];
const BID_HU = ['', 'Három', 'Kettő', 'Egy', 'Szóló'];
const KONTRA_NAMES = ['', 'Kontra', 'Rekontra', 'Szubkontra', 'Hirskontra', 'Mordkontra'];

function fullDeck() {
  const d = [];
  for (let i = 1; i <= 22; i++) d.push('T' + i);
  for (const s of SUITS) for (const r of RANKS) d.push(s + r);
  return d;
}
const isT = c => c[0] === 'T';
const tv = c => +c.slice(1);
const suitOf = c => (isT(c) ? 'T' : c[0]);
const isHonour = c => c === 'T1' || c === 'T21' || c === 'T22';
const isKing = c => !isT(c) && c[1] === 'K';
function points(c) {
  if (isT(c)) return isHonour(c) ? 5 : 1;
  return RANK_VAL[c[1]];
}
function roman(n) {
  const m = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of m) while (n >= v) { s += r; n -= v; }
  return s;
}
function cardName(c) {
  if (c === 'T22') return 'Skíz';
  if (c === 'T1') return 'Pagát (I)';
  if (isT(c)) return roman(tv(c));
  const sn = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' }[c[0]];
  const red = c[0] === 'H' || c[0] === 'D';
  const rn = { K: 'King', Q: 'Queen', C: 'Cavalier', J: 'Jack', X: red ? 'Ace' : 'Ten' }[c[1]];
  return rn + ' of ' + sn;
}
function shortName(c) {
  if (c === 'T22') return 'Skíz';
  if (isT(c)) return roman(tv(c));
  const sym = { H: '♥', D: '♦', C: '♣', S: '♠' }[c[0]];
  const red = c[0] === 'H' || c[0] === 'D';
  const r = c[1] === 'X' ? (red ? 'A' : '10') : c[1];
  return sym + r;
}
// strength for comparisons within a trick
function beats(a, b, led) { // does card a beat card b given suit led
  const ta = isT(a), tb = isT(b);
  if (ta && tb) return tv(a) > tv(b);
  if (ta) return true;
  if (tb) return false;
  if (a[0] !== b[0]) return a[0] === led && b[0] !== led;
  return RANK_VAL[a[1]] > RANK_VAL[b[1]];
}
function trickWinnerIdx(cards) { // cards: [{p,c}]
  const led = suitOf(cards[0].c);
  let w = 0;
  for (let i = 1; i < cards.length; i++) if (beats(cards[i].c, cards[w].c, led)) w = i;
  return w;
}
function sortHand(h) {
  const order = c => (isT(c) ? 100 + tv(c) : SUITS.indexOf(c[0]) * 10 + RANK_VAL[c[1]]);
  return h.slice().sort((a, b) => order(a) - order(b));
}

// ---------- RNG ----------
function rngNext(state) { // mulberry32 on an object {s}
  let t = (state.s = (state.s + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(arr, rs) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rngNext(rs) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Bonus definitions ----------
const BONUS = {
  trull:     { name: 'Trull', hu: 'Tulétroá', silent: 1, ann: 2 },
  kings4:    { name: 'Four kings', hu: 'Négykirály', silent: 1, ann: 2 },
  ultimo:    { name: 'Pagát ultimó', hu: 'Pagátulti', silent: 5, ann: 10, card: 'T1', trick: 9 },
  xxi:       { name: 'XXI catch', hu: 'Huszonegyfogás', silent: 21, ann: 42, card: 'T22' },
  double:    { name: 'Double game', hu: 'Duplajáték' },
  volat:     { name: 'Volát', hu: 'Volát' },
  // Illustrated only (announced only)
  centrum:   { name: 'Centrum', hu: 'Centrum', ann: 10, card: 'T20', trick: 5, run: true, ill: true },
  kismadar:  { name: 'Small bird', hu: 'Kismadár', ann: 10, card: 'T21', trick: 6, run: true, ill: true },
  nagymadar: { name: 'Large bird', hu: 'Nagymadár', ann: 10, card: 'T22', trick: 7, run: true, ill: true },
  uhu:       { name: 'Pagát uhu', hu: 'Pagátuhu', ann: 20, card: 'T1', trick: 8, ill: true },
  kultimo:   { name: 'King ultimó', hu: 'Királyulti', ann: 15, trick: 9, king: true, ill: true },
  kuhu:      { name: 'King uhu', hu: 'Királyuhu', ann: 20, trick: 8, king: true, ill: true },
};
const PASK_TYPES = ['trull', 'kings4', 'ultimo', 'xxi', 'double', 'volat'];
const ILL_TYPES = ['centrum', 'kismadar', 'nagymadar', 'uhu', 'kultimo', 'kuhu'];
const SUIT_NAME = { H: 'hearts', D: 'diamonds', C: 'clubs', S: 'spades' };
function bonusCard(type, param) { return BONUS[type].king ? param + 'K' : BONUS[type].card; }
function itemLabel(it) {
  if (it.type === 'game') return 'Game';
  let n = BONUS[it.type].name;
  if (BONUS[it.type].king) n = n.replace('King', 'King of ' + SUIT_NAME[it.param]);
  return n;
}

// ---------- Match ----------
function newMatch(opts) {
  opts = opts || {};
  const seed = opts.seed != null ? opts.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
  const rs = { s: seed };
  const coins = opts.startCoins || 100;
  const m = {
    v: 2,
    seed,
    rs,
    illustrated: !!opts.illustrated,
    xxiDouble: opts.xxiDouble !== false,   // house rule: a caught XXI makes the next four deals double
    names: opts.names || ['You', 'Mitz', 'Simz', rngNext(rs) < 0.5 ? 'Zsófi' : 'Zsolt'],
    levels: opts.levels || [null, 'intermediate', 'intermediate', 'intermediate'],
    startCoins: coins,
    scores: [coins, coins, coins, coins],   // gold coins held by each player
    over: null,
    dealer: opts.dealer != null ? opts.dealer : 3,
    handNo: 0,
    doubles: [],          // remaining deals in each doubled window
    history: [],          // per-hand summaries
    hand: null,
  };
  startHand(m);
  return m;
}
function stakeMult(m) { return Math.pow(2, m.doubles.length); }

function startHand(m) {
  const deck = shuffle(fullDeck(), m.rs);
  const d = m.dealer;
  const hands = [[], [], [], []];
  const talon = deck.slice(0, 6);
  let k = 6;
  // packets of five then four, starting at the dealer's right (next seat anticlockwise = d+1)
  for (const pk of [5, 4]) for (let i = 1; i <= 4; i++) {
    const p = (d + i) % 4;
    for (let j = 0; j < pk; j++) hands[p].push(deck[k++]);
  }
  const pri = [1, 2, 3, 4].map(i => (d + i) % 4);
  m.handNo++;
  m.hand = {
    phase: 'bidding',
    dealer: d,
    mult: stakeMult(m),
    illustrated: m.illustrated,
    hands: hands.map(sortHand),
    dealt: hands.map(sortHand),   // starting hands, kept for the replay (hidden from other seats during play)
    talon,
    log: [],
    bid: {
      pri, turn: pri[0], high: 0, highBidder: -1,
      passed: [false, false, false, false], acted: [false, false, false, false],
      lastHold: [false, false, false, false], actions: [], cue: null, cueUsed: false,
      yielded: null, proba: false,
    },
    declarer: -1, level: 0,
    exch: null, skartD: [], skartO: [], skartBy: [[], [], [], []], tarokkDiscards: [0, 0, 0, 0],
    shownSkart: [],
    annulQ: null,
    called: null, partner: -1, alone: false, side: null,
    ann: null, items: null,
    play: null,
    result: null,
    hat: -1,
  };
  logp(m.hand, -1, `Hand ${m.handNo}: ${d === 0 ? 'You deal' : m.names[d] + ' deals'}.` + (m.hand.mult > 1 ? ` Stakes ×${m.hand.mult}.` : ''));
}
function logp(h, p, text, kind, to) { const e = { p, text, kind: kind || 'info' }; if (to != null) e.to = to; h.log.push(e); }

// ---------- Pending action ----------
function pending(m) {
  const h = m.hand;
  switch (h.phase) {
    case 'bidding': return { type: 'bid', player: h.bid.turn, options: bidOptions(h, h.bid.turn) };
    case 'exchange': {
      const p = h.exch.queue[0];
      return { type: 'discard', player: p, count: h.exch.need[p], legal: discardLegal(h, p) };
    }
    case 'annul': return { type: 'annul', player: h.annulQ[0] };
    case 'call': return { type: 'call', player: h.declarer, options: callOptions(h) };
    case 'announce': return { type: 'announce', player: h.ann.turn, options: announceOptions(h, h.ann.turn) };
    case 'play': return { type: 'play', player: h.play.turn, legal: legalPlays(h, h.play.turn) };
    default: return { type: m.over ? 'over' : 'end', player: -1 };
  }
}

// ---------- Bidding ----------
function hasHonour(hand) { return hand.some(isHonour); }
function bidOptions(h, p) {
  const b = h.bid;
  const hand = h.hands[p];
  const opts = [];
  const priIdx = b.pri.indexOf(p);
  const passCount = b.passed.filter(Boolean).length;
  const probaSeat = priIdx === 3 && passCount === 3 && b.high === 0;
  // yielded game situation: X bid three, Y bid two, others passed, X to act with hold priority
  const yieldCase = isYieldCase(h, p);
  if (!yieldCase || (hand.includes('T20') && (hand.includes('T21') || hand.includes('T22'))))
    opts.push({ type: 'pass', yielded: !!yieldCase });
  if (!hasHonour(hand)) {
    if (probaSeat) opts.push({ type: 'bid', level: 1, proba: true });
    if (!opts.length) opts.push({ type: 'pass' });
    return opts;
  }
  if (b.high > 0 && b.highBidder !== p && priIdx < b.pri.indexOf(b.highBidder) && !b.lastHold[p])
    opts.push({ type: 'hold', level: b.high });
  const minNeeded = b.high + 1;
  for (let L = minNeeded; L <= 4; L++) {
    const o = { type: 'bid', level: L };
    const jump = L - minNeeded;
    if (!b.cueUsed && !probaSeat && (jump === 1 || jump === 2)) {
      const cueCard = jump === 1 ? 'T19' : 'T18';
      if (!hand.includes(cueCard)) continue;
      if (h.illustrated && !(hand.includes('T21') || hand.includes('T22'))) continue;
      o.cue = cueCard;
    }
    opts.push(o);
  }
  return opts;
}
function isYieldCase(h, p) {
  const b = h.bid;
  const bids = b.actions.filter(a => a.type !== 'pass');
  if (bids.length !== 2) return false;
  if (!(bids[0].type === 'bid' && bids[0].level === 1 && bids[1].type === 'bid' && bids[1].level === 2)) return false;
  if (bids[0].p !== p) return false;
  const others = [0, 1, 2, 3].filter(q => q !== p && q !== bids[1].p);
  if (!others.every(q => b.passed[q])) return false;
  return b.pri.indexOf(p) < b.pri.indexOf(bids[1].p);
}
function sameOpt(a, o) { return a.type === o.type && (a.type === 'pass' || a.level === o.level); }
function applyBid(m, p, a) {
  const h = m.hand, b = h.bid;
  if (h.phase !== 'bidding' || p !== b.turn) throw new Error('Not your bid');
  const opt = bidOptions(h, p).find(o => sameOpt(a, o));
  if (!opt) throw new Error('Illegal bid');
  b.acted[p] = true;
  if (opt.type === 'pass') {
    b.passed[p] = true;
    b.lastHold[p] = false;
    b.actions.push({ p, type: 'pass' });
    if (opt.yielded) {
      b.yielded = { by: p, to: b.highBidder };
      logp(h, p, `${m.names[p]}: Passz — yields the game (promises the XX and a high honour).`, 'bid');
    } else logp(h, p, `${m.names[p]}: Pass`, 'bid');
  } else if (opt.type === 'hold') {
    b.highBidder = p; b.lastHold[p] = true;
    b.actions.push({ p, type: 'hold', level: opt.level });
    logp(h, p, `${m.names[p]}: Hold (${BID_NAMES[opt.level]}) — Tartom`, 'bid');
  } else {
    if (opt.cue) b.cueUsed = true;
    const passCount = b.passed.filter(Boolean).length;
    if (b.high === 0 && b.pri.indexOf(p) === 3 && passCount === 3) b.cueUsed = true; // 4th seat after passes: no cue meaning
    if (opt.cue) b.cue = { by: p, card: opt.cue };
    if (opt.proba) b.proba = true;
    b.high = opt.level; b.highBidder = p; b.lastHold[p] = false;
    b.actions.push({ p, type: 'bid', level: opt.level, cue: opt.cue || null });
    logp(h, p, `${m.names[p]}: ${BID_NAMES[opt.level]} — ${BID_HU[opt.level]}` +
      (opt.cue ? ` (invitation: shows the ${roman(tv(opt.cue))})` : '') + (opt.proba ? ' (without an honour!)' : ''), 'bid');
  }
  // termination
  const active = [0, 1, 2, 3].filter(q => !b.passed[q]);
  if (b.high === 0 && active.length === 0) return passOut(m);
  if (b.high > 0 && active.length === 1) return endBidding(m, active[0]);
  // next turn
  let i = b.pri.indexOf(p);
  for (let k = 0; k < 4; k++) {
    i = (i + 1) % 4;
    const q = b.pri[i];
    if (!b.passed[q]) { b.turn = q; break; }
  }
  if (b.high > 0 && b.turn === b.highBidder && active.length === 1) return endBidding(m, b.turn);
}
function passOut(m) {
  const h = m.hand;
  h.phase = 'passedout';
  logp(h, -1, 'Everyone passed. The cards are thrown in; the next four deals are at double stakes.', 'big');
  h.result = { kind: 'passedout', deltas: [0, 0, 0, 0], lines: [] };
}
function endBidding(m, decl) {
  const h = m.hand, b = h.bid;
  h.declarer = decl;
  h.level = b.high;
  logp(h, decl, `${m.names[decl]} wins the bidding: ${BID_NAMES[h.level]}.`, 'big');
  // distribute talon
  const table = { 1: [3, 1, 1, 1], 2: [2, 2, 1, 1], 3: [1, 2, 2, 1], 4: [0, 2, 2, 2] }[h.level];
  let k = 0;
  const need = [0, 0, 0, 0];
  const got = [[], [], [], []];
  for (let i = 0; i < 4; i++) {
    const p = (decl + i) % 4;
    for (let j = 0; j < table[i]; j++) { got[p].push(h.talon[k]); h.hands[p].push(h.talon[k++]); }
    need[p] = table[i];
    h.hands[p] = sortHand(h.hands[p]);
  }
  h.talonGot = got;
  // próbahárom: fourth seat bid without an honour
  if (b.proba && !hasHonour(h.hands[decl])) {
    h.phase = 'done';
    const g = h.level, mult = h.mult;
    const deltas = [0, 0, 0, 0].map((_, q) => (q === decl ? -3 * g : g) * mult);
    h.result = { kind: 'proba', deltas, lines: [{ text: `${m.names[decl]} drew no honour from the talon — the game is lost.`, v: -g }] };
    logp(h, decl, `${m.names[decl]} found no honour in the talon. Game lost automatically.`, 'big');
    finishHand(m);
    return;
  }
  const queue = [0, 1, 2, 3].map(i => (decl + i) % 4).filter(p => need[p] > 0);
  h.exch = { need, queue };
  h.phase = 'exchange';
  if (!queue.length) afterExchange(m);
}

// ---------- Exchange ----------
function discardForbidden(h, p, c) {
  if (isKing(c) || isHonour(c)) return true;
  if (c === 'T20') return true; // house standard: the XX may not be discarded
  const b = h.bid;
  if (b.cue && b.cue.by === p && b.cue.card === c) return true;
  return false;
}
function discardLegal(h, p) { return h.hands[p].filter(c => !discardForbidden(h, p, c)); }
function applyDiscard(m, p, cards) {
  const h = m.hand;
  if (h.phase !== 'exchange' || h.exch.queue[0] !== p) throw new Error('Not your discard');
  const n = h.exch.need[p];
  if (!Array.isArray(cards) || cards.length !== n || new Set(cards).size !== n) throw new Error(`Discard exactly ${n}`);
  for (const c of cards) {
    if (!h.hands[p].includes(c)) throw new Error('Card not in hand');
    if (discardForbidden(h, p, c)) throw new Error(`${cardName(c)} may not be discarded`);
  }
  h.hands[p] = h.hands[p].filter(c => !cards.includes(c));
  h.skartBy[p] = cards.slice();
  const nt = cards.filter(isT).length;
  h.tarokkDiscards[p] = nt;
  if (p === h.declarer) { h.skartD.push(...cards); h.shownSkart = cards.filter(isT); }
  else h.skartO.push(...cards);
  if (nt) logp(h, p, `${m.names[p]} discarded ${nt === 1 ? 'a tarokk' : nt + ' tarokks'}` +
    (p === h.declarer ? ': ' + cards.filter(isT).map(shortName).join(', ') : '') + '.', 'info');
  h.exch.queue.shift();
  if (!h.exch.queue.length) afterExchange(m);
}
function canAnnul(h, p) {
  const hand = h.hands[p];
  const ts = hand.filter(isT);
  const kings = hand.filter(isKing).length;
  if (kings === 4) return true;
  if (h.tarokkDiscards[p] > 0) return false;
  if (ts.length === 0) return true;
  const key = ts.slice().sort().join(',');
  return key === 'T21' || key === 'T1' || key === 'T1,T21';
}
function afterExchange(m) {
  const h = m.hand;
  const q = [0, 1, 2, 3].map(i => (h.declarer + i) % 4).filter(p => canAnnul(h, p));
  if (q.length) { h.annulQ = q; h.phase = 'annul'; return; }
  h.phase = 'call';
}
function applyAnnul(m, p, yes) {
  const h = m.hand;
  if (h.phase !== 'annul' || h.annulQ[0] !== p) throw new Error('Not your choice');
  if (yes) {
    h.phase = 'annulled';
    logp(h, p, `${m.names[p]} annuls the hand. The next four deals are at double stakes.`, 'big');
    h.result = { kind: 'annulled', deltas: [0, 0, 0, 0], lines: [] };
    return;
  }
  h.annulQ.shift();
  if (!h.annulQ.length) h.phase = 'call';
}

// ---------- Calling a partner ----------
function callOptions(h) {
  const d = h.declarer, hand = h.hands[d], b = h.bid;
  if (b.cue && b.cue.by !== d) return [{ card: b.cue.card, forced: 'invitation' }];
  if (b.yielded) return [{ card: 'T20', forced: 'yielded game' }];
  const opts = [];
  const has = c => hand.includes(c);
  if (!has('T20')) opts.push({ card: 'T20' });
  else {
    for (let n = 19; n >= 2; n--) if (!has('T' + n)) { opts.push({ card: 'T' + n }); break; }
    opts.push({ card: 'T20', self: true });
  }
  const othersDiscardedT = [0, 1, 2, 3].some(q => q !== d && h.tarokkDiscards[q] > 0);
  if (othersDiscardedT) for (let n = 20; n >= 2; n--) {
    const c = 'T' + n;
    if (!opts.some(o => o.card === c)) opts.push({ card: c, any: true, self: has(c) || undefined });
  }
  return opts;
}
function applyCall(m, p, card) {
  const h = m.hand;
  if (h.phase !== 'call' || p !== h.declarer) throw new Error('Not your call');
  if (!callOptions(h).some(o => o.card === card)) throw new Error('Illegal call');
  h.called = card;
  let partner = -1, skartBy = -1;
  for (let q = 0; q < 4; q++) {
    if (h.hands[q].includes(card)) partner = q;
    if (h.skartBy[q].includes(card)) skartBy = q;
  }
  h.alone = partner === -1 || partner === h.declarer;
  h.partner = h.alone ? -1 : partner;
  h.tarokkCount = h.hands.map(x => x.filter(isT).length);
  h.calledSkartBy = skartBy;
  h.side = [0, 1, 2, 3].map(q => (q === h.declarer || q === h.partner ? 'D' : 'O'));
  logp(h, p, `${m.names[p]} calls the ${roman(tv(card))}.`, 'big');
  if (skartBy >= 0 && skartBy !== h.declarer)
    logp(h, skartBy, `The ${roman(tv(card))} is in your discards: the declarer is alone and you must kontra the game.`, 'info', skartBy);
  // announcements
  h.items = { game: { key: 'game', type: 'game', team: 'D', by: h.declarer, kontra: 0, kontraBy: [] } };
  const pub = [null, null, null, null];
  pub[h.declarer] = 'D';
  const mandatory = [[], [], [], []];
  if (skartBy >= 0 && skartBy !== h.declarer) mandatory[skartBy].push({ kind: 'kontraGame' });
  if (h.bid.cue && h.bid.cue.by >= 0) {
    const cb = h.bid.cue.by, hand = h.hands[cb];
    if (!hand.includes('T21') && !hand.includes('T22') && hand.includes('T1') && !h.illustrated)
      mandatory[cb].push({ kind: 'ultimo' });
  }
  h.ann = {
    turn: h.declarer, passes: 0, first: true, pub, ref: 'D',
    declared: [0, 0, 0, 0], mandatory, turns: [0, 0, 0, 0], round: [],
  };
  h.phase = 'announce';
}

// ---------- Announcements ----------
function teamHolds(h, team, card) {
  for (let q = 0; q < 4; q++) if (h.side[q] === team && h.hands[q].includes(card)) return true;
  return false;
}
function announceOptions(h, p) {
  const team = h.side[p], hand = h.hands[p];
  const nT = hand.filter(isT).length;
  const o = { declare: 0, bonuses: [], kontras: [], mandatory: h.ann.mandatory[p].slice() };
  if (!h.ann.declared[p] && nT >= 8) o.declare = nT;
  const types = PASK_TYPES.concat(h.illustrated ? ILL_TYPES : []);
  const usedCards = new Set();
  for (const it of Object.values(h.items)) if (it.team === team && it.type !== 'game') {
    const bc = BONUS[it.type].trick ? bonusCard(it.type, it.param) : null;
    if (bc) usedCards.add(bc);
  }
  for (const t of types) {
    const def = BONUS[t];
    const params = def.king ? SUITS : [null];
    for (const param of params) {
      const key = team + ':' + t + (param ? ':' + param : '');
      if (h.items[key]) continue;
      if (t === 'double' && h.items[team + ':volat']) continue;
      const card = def.card || (def.king ? param + 'K' : null);
      if (card && !hand.includes(card)) continue;
      if (def.trick && card && usedCards.has(card)) continue;
      o.bonuses.push({ type: t, param, key, label: def.king ? def.name.replace('King', 'King of ' + SUIT_NAME[param]) : def.name });
    }
  }
  for (const it of Object.values(h.items)) {
    if (it.kontra >= 5) continue;
    const next = it.kontra + 1;
    const mySideNeeded = next % 2 === 1 ? (it.team === 'D' ? 'O' : 'D') : it.team;
    if (team !== mySideNeeded) continue;
    o.kontras.push({ key: it.key, level: next, label: KONTRA_NAMES[next] + ' ' + itemLabel(it).toLowerCase() });
  }
  return o;
}
// action: { declare: n|0, bonuses: [key...], kontras: [key...] }
function validateAnnounce(h, p, a) {
  const o = announceOptions(h, p);
  const bonuses = a.bonuses || [], kontras = a.kontras || [];
  if (a.declare && a.declare !== o.declare) return 'You can only declare the exact number of tarokks you hold (8 or 9).';
  for (const k of bonuses) if (!o.bonuses.some(b => b.key === k)) return 'That announcement is not available.';
  for (const k of kontras) if (!o.kontras.some(b => b.key === k)) return 'That kontra is not available.';
  if (new Set(bonuses).size !== bonuses.length || new Set(kontras).size !== kontras.length) return 'Duplicate.';
  const types = bonuses.map(k => k.split(':')[1]);
  if (types.includes('double') && types.includes('volat')) return 'Double game and volát cannot be announced in the same turn.';
  const cards = bonuses.map(k => { const [, t, prm] = k.split(':'); return BONUS[t].trick ? bonusCard(t, prm) : null; }).filter(Boolean);
  if (new Set(cards).size !== cards.length) return 'One card cannot be used for two trick bonuses.';
  // mandatory obligations
  for (const md of h.ann.mandatory[p]) {
    if (md.kind === 'kontraGame' && h.items.game.kontra === 0 && !kontras.includes('game')) return 'You must kontra the game: the called card is in your discards.';
    if (md.kind === 'ultimo' && !bonuses.some(k => k.endsWith(':ultimo'))) return 'Your invitation with only the pagát obliges you to announce pagát ultimó now.';
  }
  // must declare tarokks when announcing/kontra-ing ultimó
  const ultiInvolved = bonuses.some(k => k.endsWith(':ultimo')) || kontras.some(k => /:ultimo$/.test(k));
  if (ultiInvolved && o.declare && !h.ann.declared[p] && !a.declare) return `Announcing or kontra-ing pagát ultimó: you must also declare your ${o.declare} tarokks.`;
  // side identification
  if (bonuses.length && !kontras.length && h.ann.pub[p] == null && h.ann.ref !== h.side[p])
    return 'Your side is not yet known: announcing now would put you on the side of the last announcer. Kontra something first to show your side.';
  return null;
}
function applyAnnounce(m, p, a) {
  const h = m.hand;
  if (h.phase !== 'announce' || h.ann.turn !== p) throw new Error('Not your turn to announce');
  a = { declare: a.declare || 0, bonuses: a.bonuses || [], kontras: a.kontras || [] };
  const err = validateAnnounce(h, p, a);
  if (err) throw new Error(err);
  const parts = [];
  if (a.declare) { h.ann.declared[p] = a.declare; parts.push(`${a.declare} tarokks`); }
  for (const k of a.bonuses) {
    const [team, type, param] = k.split(':');
    h.items[k] = { key: k, type, param: param || null, team, by: p, kontra: 0, kontraBy: [] };
    parts.push(itemLabel(h.items[k]));
  }
  for (const k of a.kontras) {
    const it = h.items[k];
    it.kontra++;
    it.kontraBy.push(p);
    parts.push(KONTRA_NAMES[it.kontra] + (it.type === 'game' ? ' (game)' : ' ' + itemLabel(it).toLowerCase()));
  }
  h.ann.mandatory[p] = [];
  const acted = a.declare || a.bonuses.length || a.kontras.length;
  if (a.bonuses.length || a.kontras.length) { h.ann.pub[p] = h.side[p]; h.ann.ref = h.side[p]; }
  h.ann.turns[p]++;
  h.ann.round.push({ p, parts });
  logp(h, p, `${m.names[p]}: ${parts.length ? parts.join(', ') : 'Pass'}`, 'ann');
  if (acted || h.ann.first) h.ann.passes = 0; else h.ann.passes++;
  h.ann.first = false;
  if (h.ann.passes >= 3) return startPlay(m);
  h.ann.turn = (p + 1) % 4;
}

// ---------- Play ----------
function startPlay(m) {
  const h = m.hand;
  const lead = (h.dealer + 1) % 4;
  h.play = { turn: lead, leader: lead, trick: [], tricks: [], trickNo: 1, lost: { D: false, O: false }, revealed: false };
  h.phase = 'play';
  logp(h, -1, 'Play begins.', 'big');
}
function obligations(h, p) { // cards p must keep for a given trick
  const out = [];
  for (const it of Object.values(h.items)) {
    if (it.type === 'game' || it.team !== h.side[p]) continue;
    const def = BONUS[it.type];
    if (!def.trick) continue;
    const card = bonusCard(it.type, it.param);
    if (!h.hands[p].includes(card)) continue;
    if (def.run && h.play.lost[it.team]) continue;
    out.push({ card, trick: def.trick, mustPlayAt: def.trick !== 9 });
  }
  return out.sort((a, b) => b.trick - a.trick); // later-due cards are held back first

}
function legalPlays(h, p) {
  const hand = h.hands[p], tr = h.play.trick;
  let legal;
  if (!tr.length) legal = hand.slice();
  else {
    const led = suitOf(tr[0].c);
    const follow = hand.filter(c => suitOf(c) === led);
    if (follow.length) legal = follow;
    else {
      const ts = hand.filter(isT);
      legal = ts.length ? ts : hand.slice();
    }
  }
  const tn = h.play.trickNo;
  for (const ob of obligations(h, p)) {
    if (!legal.includes(ob.card)) continue;
    if (tn < ob.trick && legal.length > 1) legal = legal.filter(c => c !== ob.card);
    else if (tn === ob.trick && ob.mustPlayAt) legal = [ob.card];
  }
  return legal;
}
function applyPlay(m, p, c) {
  const h = m.hand, pl = h.play;
  if (h.phase !== 'play' || pl.turn !== p) throw new Error('Not your turn');
  if (!legalPlays(h, p).includes(c)) throw new Error('Illegal card');
  h.hands[p] = h.hands[p].filter(x => x !== c);
  pl.trick.push({ p, c });
  if (pl.trickNo === 1 && pl.trick.length === 1) h.shownSkart = [];
  if (c === h.called && !pl.revealed) {
    pl.revealed = true;
    if (h.partner >= 0) { h.ann.pub[p] = 'D'; logp(h, p, `${m.names[p]} plays the called ${roman(tv(c))} — partner revealed!`, 'big'); }
    else if (p === h.declarer) logp(h, p, `${m.names[p]} plays the called ${roman(tv(c))} — playing alone!`, 'big');
  }
  if (pl.trick.length < 4) { pl.turn = (p + 1) % 4; return; }
  const wi = trickWinnerIdx(pl.trick);
  const winner = pl.trick[wi].p;
  const trick = { no: pl.trickNo, cards: pl.trick.slice(), winner, wcard: pl.trick[wi].c, leader: pl.leader };
  pl.tricks.push(trick);
  const wt = h.side[winner];
  pl.lost[wt === 'D' ? 'O' : 'D'] = true;
  // XXI catch hat
  const s = trick.cards.find(x => x.c === 'T22'), x21 = trick.cards.find(x => x.c === 'T21');
  if (s && x21 && h.side[s.p] !== h.side[x21.p]) { h.hat = x21.p; logp(h, s.p, `The skíz catches ${m.names[x21.p]}'s XXI! ${m.names[x21.p]} wears the mayor's hat.` + (m.xxiDouble ? ' The next four deals are at double stakes.' : ''), 'big'); }
  pl.trick = [];
  pl.leader = winner;
  pl.turn = winner;
  pl.trickNo++;
  if (pl.trickNo > 9) scoreHand(m);
}

// ---------- Scoring ----------
// Core game/double/volát scoring (exported for tests). Returns net for team D and lines.
function scoreGameCore(g, ptsD, tricksD, items) {
  const ptsO = 94 - ptsD, tricksO = 9 - tricksD;
  const ach = {
    D: { vol: tricksD === 9, dbl: ptsD >= 71 },
    O: { vol: tricksO === 9, dbl: ptsO >= 71 },
  };
  const ann = (T, t) => items[T + ':' + t];
  const W = ptsD >= 48 ? 'D' : 'O';
  const lines = [];
  let net = 0;
  const add = (T, v, text, calc) => { const s = T === 'D' ? v : -v; net += s; lines.push({ text, v: s, calc: calc || '' }); };
  const silentExtra = T => {
    if (ach[T].vol && !ann(T, 'volat')) return { v: 3 * g, text: 'Volát (silent): all nine tricks', calc: `3 × game value ${g}` };
    if (ach[T].dbl && !ann(T, 'double') && !ann(T, 'volat')) return { v: 2 * g, text: 'Double game (silent): 71+ points', calc: `2 × game value ${g}` };
    return null;
  };
  const gname = `${BID_NAMES[g]} game = ${g}`;
  const tn = T => (T === 'D' ? 'declarers' : 'defenders');
  const game = items.game;
  const gm = Math.pow(2, game.kontra);
  if (game.kontra > 0) {
    add(W, g * gm, `Game won by the ${tn(W)}`, gname + mx(game));
    const se = silentExtra(W); if (se) add(W, se.v, se.text + `, ${tn(W)}`, se.calc);
  } else if (!ann(W, 'double') && !ann(W, 'volat')) {
    const se = silentExtra(W);
    if (se) add(W, se.v, se.text + `, ${tn(W)} (replaces the plain game)`, se.calc); else add(W, g, `Game won by the ${tn(W)}`, gname);
  } else {
    const se = silentExtra(W); if (se) add(W, se.v, se.text + `, ${tn(W)}`, se.calc);
  }
  for (const T of ['D', 'O']) {
    const d = ann(T, 'double');
    if (d) { const v = 4 * g * Math.pow(2, d.kontra); add(T, ach[T].dbl ? v : -v, `Double game announced by the ${tn(T)}: ${ach[T].dbl ? 'made' : 'failed'}`, `4 × game value ${g}` + mx(d)); }
    const vl = ann(T, 'volat');
    if (vl) { const v = 6 * g * Math.pow(2, vl.kontra); add(T, ach[T].vol ? v : -v, `Volát announced by the ${tn(T)}: ${ach[T].vol ? 'made' : 'failed'}`, `6 × game value ${g}` + mx(vl)); }
  }
  return { net, lines, W };
}
function kx(it) { return it.kontra ? ', ' + KONTRA_NAMES[it.kontra].toLowerCase() : ''; }
function mx(it) { return it.kontra ? ` × ${Math.pow(2, it.kontra)} (${KONTRA_NAMES[it.kontra].toLowerCase()})` : ''; }

function scoreHand(m) {
  const h = m.hand, pl = h.play;
  const won = { D: [], O: [] };
  let tricksD = 0;
  for (const t of pl.tricks) {
    const T = h.side[t.winner];
    won[T].push(...t.cards.map(x => x.c));
    if (T === 'D') tricksD++;
  }
  const pile = { D: won.D.concat(h.skartD), O: won.O.concat(h.skartO) };
  const ptsD = pile.D.reduce((s, c) => s + points(c), 0);
  const ptsO = pile.O.reduce((s, c) => s + points(c), 0);
  const g = h.level;
  const core = scoreGameCore(g, ptsD, tricksD, h.items);
  let net = core.net;
  const lines = core.lines.slice();
  const add = (T, v, text, calc) => { const s = T === 'D' ? v : -v; net += s; lines.push({ text, v: s, calc: calc || '' }); };
  const tn = T => (T === 'D' ? 'declarers' : 'defenders');
  const vol = { D: tricksD === 9, O: tricksD === 0 };
  const ann = (T, t, prm) => h.items[T + ':' + t + (prm ? ':' + prm : '')];
  const mul = it => Math.pow(2, it.kontra);
  // Trull & four kings
  for (const [t, set] of [['trull', ['T1', 'T21', 'T22']], ['kings4', SUITS.map(s => s + 'K')]]) {
    for (const T of ['D', 'O']) {
      const got = set.every(c => won[T].includes(c));
      const a = ann(T, t);
      if (a) { const v = BONUS[t].ann * mul(a); add(T, got ? v : -v, `${BONUS[t].name} announced by the ${tn(T)}: ${got ? 'made' : 'failed'}`, `announced ${BONUS[t].ann}` + mx(a)); }
      else if (got && !vol[T]) add(T, BONUS[t].silent, `${BONUS[t].name} (silent), ${tn(T)}`, `silent ${BONUS[t].silent}`);
    }
  }
  // Pagát ultimó
  const last = pl.tricks[8];
  const pagLast = last.cards.find(x => x.c === 'T1');
  for (const T of ['D', 'O']) {
    const a = ann(T, 'ultimo');
    if (a) {
      const ok = pagLast && h.side[pagLast.p] === T && last.wcard === 'T1';
      const v = BONUS.ultimo.ann * mul(a);
      add(T, ok ? v : -v, `Pagát ultimó announced by the ${tn(T)}: ${ok ? 'made' : 'failed'}`, `announced 10` + mx(a));
    }
  }
  if (pagLast && !ann(h.side[pagLast.p], 'ultimo')) {
    const T = h.side[pagLast.p];
    if (last.wcard === 'T1') add(T, 5, `Pagát ultimó (silent), ${tn(T)}`, 'silent 5');
    else add(T, -5, `Pagát lost in the last trick by the ${tn(T)}`, 'silent 5');
  }
  // XXI catch
  let catcher = null;
  for (const t of pl.tricks) {
    const s = t.cards.find(x => x.c === 'T22'), x = t.cards.find(x => x.c === 'T21');
    if (s && x && h.side[s.p] !== h.side[x.p]) catcher = h.side[s.p];
  }
  for (const T of ['D', 'O']) {
    const a = ann(T, 'xxi');
    if (a) { const v = BONUS.xxi.ann * mul(a); add(T, catcher === T ? v : -v, `XXI catch announced by the ${tn(T)}: ${catcher === T ? 'made' : 'failed'}`, 'announced 42' + mx(a)); }
    else if (catcher === T) add(T, 21, `XXI catch (silent), ${tn(T)}`, 'silent 21');
  }
  // Illustrated bonuses
  if (h.illustrated) {
    const tr = pl.tricks;
    for (const it of Object.values(h.items)) {
      if (!BONUS[it.type] || !BONUS[it.type].ill) continue;
      const def = BONUS[it.type], T = it.team;
      const card = bonusCard(it.type, it.param);
      const target = tr[def.trick - 1];
      let ok = target.wcard === card && h.side[target.winner] === T;
      if (def.run) for (let i = 0; i < def.trick; i++) if (h.side[tr[i].winner] !== T) ok = false;
      const v = def.ann * mul(it);
      add(T, ok ? v : -v, `${itemLabel(it)} announced by the ${tn(T)}: ${ok ? 'made' : 'failed'}`, `announced ${def.ann}` + mx(it));
    }
  }
  // per-player settlement, kept as separate rows so the summary can show how each total adds up
  const rows = [];
  const teamRow = [0, 1, 2, 3].map(q => (h.alone ? (q === h.declarer ? 3 * net : -net) : (h.side[q] === 'D' ? net : -net)));
  rows.push({ label: h.alone ? `Game & bonuses (${m.names[h.declarer]} alone: collects or pays ×3)` : 'Game & bonuses', deltas: teamRow });
  const declLines = [];
  for (let q = 0; q < 4; q++) if (h.ann.declared[q]) {
    const v = h.ann.declared[q] === 9 ? 2 : 1;
    rows.push({ label: `${m.names[q]} declared ${h.ann.declared[q]} tarokks (${v} from each player)`, deltas: [0, 1, 2, 3].map(r => (r === q ? 3 * v : -v)) });
    declLines.push({ text: `${m.names[q]} declared ${h.ann.declared[q]} tarokks: ${v} from each player`, v: 0, player: q });
  }
  // undeclared 8 or 9 tarokks may only be claimed from partners
  for (let q = 0; q < 4; q++) {
    const n = h.tarokkCount ? h.tarokkCount[q] : 0;
    if (n < 8 || h.ann.declared[q]) continue;
    const v = n === 9 ? 2 : 1;
    const partners = [0, 1, 2, 3].filter(r => r !== q && h.side[r] === h.side[q]);
    if (!partners.length) {
      declLines.push({ text: `${m.names[q]} held ${n} tarokks undeclared, with no partner to claim from`, v: 0, player: q });
      continue;
    }
    const d = [0, 0, 0, 0];
    for (const r of partners) { d[q] += v; d[r] -= v; }
    rows.push({ label: `${m.names[q]} held ${n} tarokks undeclared: ${v} from partner${partners.length > 1 ? 's' : ''} only`, deltas: d });
    declLines.push({ text: `${m.names[q]} held ${n} tarokks undeclared: claims ${v} from partner ${partners.map(r => m.names[r]).join(' and ')}`, v: 0, player: q });
  }
  const mult = h.mult;
  const subtotal = [0, 1, 2, 3].map(q => rows.reduce((a, r) => a + r.deltas[q], 0));
  const deltas = subtotal.map(x => x * mult);
  // where the card points came from
  const sumPts = cs => cs.reduce((a, c) => a + points(c), 0);
  const cardPile = {
    D: { tricks: tricksD, trickPts: sumPts(won.D), skartPts: sumPts(h.skartD) },
    O: { tricks: 9 - tricksD, trickPts: sumPts(won.O), skartPts: sumPts(h.skartO) },
  };
  h.result = { kind: 'played', ptsD, ptsO, tricksD, net, lines, declLines, rows, subtotal, deltas, mult, pile: cardPile, W: core.W, alone: h.alone, level: g };
  h.phase = 'done';
  finishHand(m);
}
function finishHand(m) {
  const h = m.hand;
  for (let q = 0; q < 4; q++) m.scores[q] += h.result.deltas[q];
  if (h.hat >= 0 && m.xxiDouble) h.result.xxiDoubleNext = true;
  if (m.scores.some(c => c <= 0)) {
    const best = Math.max(...m.scores);
    m.over = { winners: [0, 1, 2, 3].filter(q => m.scores[q] === best), broke: [0, 1, 2, 3].filter(q => m.scores[q] <= 0), handNo: m.handNo };
  }
}
// move to the next hand (after 'done', 'passedout', 'annulled')
function nextHand(m) {
  const h = m.hand;
  if (m.over) throw new Error('The game is over');
  if (h.phase === 'passedout' || h.phase === 'annulled') {
    m.doubles.push(4);
    m.history.push({ no: m.handNo, kind: h.phase, deltas: [0, 0, 0, 0], dealer: h.dealer });
    // same dealer deals again
  } else if (h.phase === 'done') {
    m.history.push({
      no: m.handNo, kind: h.result.kind, deltas: h.result.deltas.slice(), dealer: h.dealer,
      declarer: h.declarer, level: h.level, partner: h.partner, ptsD: h.result.ptsD, mult: h.mult,
    });
    m.doubles = m.doubles.map(x => x - 1).filter(x => x > 0);
    if (h.hat >= 0 && m.xxiDouble) m.doubles.push(4);
    if (h.result.kind === 'played') m.lastHand = JSON.parse(JSON.stringify(h)); // for "replay last hand"
    m.dealer = (m.dealer + 1) % 4;
  } else throw new Error('Hand not finished');
  startHand(m);
}

// ---------- Per-player view (what one seat may know) ----------
// Used by the UI now, and by a server later: send each client only viewFor(match, seat).
function viewFor(m, p) {
  const h = m.hand;
  const v = JSON.parse(JSON.stringify(h));
  const ended = h.phase === 'done' || h.phase === 'passedout' || h.phase === 'annulled';
  if (!ended) {
    v.hands = h.hands.map((x, q) => (q === p ? x.slice() : x.map(() => null)));
    v.dealt = (h.dealt || []).map((x, q) => (q === p ? x.slice() : x.map(() => null)));
    if (h.phase === 'bidding') v.talon = h.talon.map(() => null);
    else v.talon = [];
    if (h.talonGot) v.talonGot = h.talonGot.map((x, q) => (q === p ? x.slice() : x.map(() => null)));
    v.skartBy = h.skartBy.map((x, q) => (q === p ? x.slice() : x.map(c => (q === h.declarer && isT(c) ? c : null))));
    v.skartD = p === h.declarer ? h.skartD.slice() : h.skartD.map(c => (isT(c) ? c : null));
    v.skartO = h.skartO.map(c => null);
    const revealed = h.play && h.play.revealed;
    if (h.side) {
      v.side = h.side.map((s, q) => {
        if (q === p || q === h.declarer) return s;
        if (h.ann && h.ann.pub[q]) return h.ann.pub[q];
        if (p === h.partner) return 'O';
        if (revealed) return s;
        return null;
      });
      v.partner = (revealed || p === h.partner) ? h.partner : -1;
      v.alone = revealed ? h.alone : (p === h.declarer ? null : null);
      v.calledSkartBy = p === h.calledSkartBy ? p : -1;
    }
    if (h.ann) v.ann.mandatory = h.ann.mandatory.map((x, q) => (q === p ? x : []));
    v.bid.cue = h.bid.cue; // public
  }
  v.log = h.log.filter(e => e.to == null || e.to === p);
  return {
    seat: p, names: m.names.slice(), levels: m.levels.slice(), scores: m.scores.slice(), over: m.over, dealer: m.dealer,
    handNo: m.handNo, doubles: m.doubles.slice(), illustrated: m.illustrated, history: m.history, lastHand: m.lastHand || null, hand: v,
  };
}

// ---------- Dispatch ----------
function act(m, p, a) {
  switch (a.type) {
    case 'bid': case 'pass': case 'hold': return applyBid(m, p, a);
    case 'discard': return applyDiscard(m, p, a.cards);
    case 'annul': return applyAnnul(m, p, !!a.yes);
    case 'call': return applyCall(m, p, a.card);
    case 'announce': return applyAnnounce(m, p, a);
    case 'play': return applyPlay(m, p, a.card);
    case 'next': return nextHand(m);
    default: throw new Error('Unknown action ' + a.type);
  }
}

const api = {
  SUITS, RANKS, BONUS, BID_NAMES, BID_HU, KONTRA_NAMES, PASK_TYPES, ILL_TYPES, SUIT_NAME,
  fullDeck, isT, tv, suitOf, isHonour, isKing, points, roman, cardName, shortName, beats, trickWinnerIdx, sortHand,
  rngNext, shuffle, newMatch, startHand, pending, act, bidOptions, discardLegal, discardForbidden, callOptions,
  announceOptions, validateAnnounce, legalPlays, viewFor, obligations, scoreGameCore, itemLabel, bonusCard, canAnnul, stakeMult, nextHand,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.TarokkEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
