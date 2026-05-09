/* ============================================================
   cards.js - カード/デッキの定義とユーティリティ
   ============================================================ */

const Cards = (() => {
  const SUITS = [
    { id: 'spade',   sym: '♠', color: 'black' },
    { id: 'heart',   sym: '♥', color: 'red'   },
    { id: 'club',    sym: '♣', color: 'black' },
    { id: 'diamond', sym: '♦', color: 'red'   },
  ];
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

  function rankValue(r) { return RANKS.indexOf(r) + 1; } // A=1 ... K=13

  /** 新しいID付きカード配列を生成 */
  function buildDeck() {
    const deck = [];
    let id = 0;
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push({
          id: 'c' + (id++),
          suit: s.id,
          suitSym: s.sym,
          color: s.color,
          rank: r,
          value: rankValue(r),
          faceUp: false,
        });
      }
    }
    return deck;
  }

  /** Fisher–Yatesシャッフル (seed可) */
  function shuffle(arr, seed) {
    const a = arr.slice();
    let rng = seed != null ? mulberry32(seed) : Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** 反対色判定 (タブロー降順用) */
  function altColor(a, b) {
    return a.color !== b.color;
  }
  /** 同スート判定 (foundation用) */
  function sameSuit(a, b) { return a.suit === b.suit; }

  return {
    SUITS, RANKS,
    buildDeck, shuffle, rankValue, altColor, sameSuit,
  };
})();
