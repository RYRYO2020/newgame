/* ============================================================
   game.js - クロンダイク・ソリティア ゲームロジック
   ============================================================ */

const Game = (() => {

  // ===== State =====
  const state = {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    moves: 0,
    score: 0,
    history: [],     // undo
    startedAt: 0,
    elapsed: 0,
    won: false,
    drawCount: 1,
    seed: 0,
  };

  // ===== Init =====
  function newGame(opts = {}) {
    state.drawCount = opts.drawCount || 1;
    state.seed = opts.seed != null ? opts.seed : Date.now();
    const deck = Cards.shuffle(Cards.buildDeck(), state.seed);

    state.stock = [];
    state.waste = [];
    state.foundations = [[], [], [], []];
    state.tableau = [[], [], [], [], [], [], []];
    state.moves = 0;
    state.score = 0;
    state.history = [];
    state.startedAt = Date.now();
    state.elapsed = 0;
    state.won = false;

    // タブロー配布: 列 i に i+1 枚, 一番上だけ表向き
    let p = 0;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j <= i; j++) {
        const c = deck[p++];
        c.faceUp = (j === i);
        state.tableau[i].push(c);
      }
    }
    // 残りは stock
    while (p < deck.length) {
      const c = deck[p++];
      c.faceUp = false;
      state.stock.push(c);
    }
    return state;
  }

  // ===== History =====
  function snapshot() {
    return JSON.stringify({
      stock: state.stock,
      waste: state.waste,
      foundations: state.foundations,
      tableau: state.tableau,
      moves: state.moves,
      score: state.score,
    });
  }
  function pushHistory() {
    state.history.push(snapshot());
    if (state.history.length > 200) state.history.shift();
  }
  function undo() {
    if (state.history.length === 0) return false;
    const snap = JSON.parse(state.history.pop());
    state.stock = snap.stock;
    state.waste = snap.waste;
    state.foundations = snap.foundations;
    state.tableau = snap.tableau;
    state.moves = snap.moves + 1;
    state.score = Math.max(0, snap.score - 5);
    return true;
  }

  // ===== Stock / Waste =====
  function drawFromStock() {
    if (state.stock.length === 0 && state.waste.length === 0) return false;
    pushHistory();
    if (state.stock.length === 0) {
      // recycle
      while (state.waste.length) {
        const c = state.waste.pop();
        c.faceUp = false;
        state.stock.push(c);
      }
      state.score = Math.max(0, state.score - (state.drawCount === 1 ? 100 : 0));
    } else {
      const n = Math.min(state.drawCount, state.stock.length);
      for (let i = 0; i < n; i++) {
        const c = state.stock.pop();
        c.faceUp = true;
        state.waste.push(c);
      }
    }
    state.moves++;
    return true;
  }

  // ===== 移動可能判定 =====
  function canPlaceOnTableau(card, destTopCard) {
    if (!destTopCard) return card.rank === 'K';
    if (!destTopCard.faceUp) return false;
    return Cards.altColor(card, destTopCard) && card.value === destTopCard.value - 1;
  }
  function canPlaceOnFoundation(card, foundationPile) {
    if (foundationPile.length === 0) return card.value === 1;
    const top = foundationPile[foundationPile.length - 1];
    return Cards.sameSuit(card, top) && card.value === top.value + 1;
  }

  /** カードがある位置 (パイル) を見つける */
  function findCardLocation(cardId) {
    if (state.waste.length && state.waste[state.waste.length-1].id === cardId)
      return { pile: 'waste', index: 0, cardIdx: state.waste.length-1 };
    for (let i = 0; i < 4; i++) {
      const f = state.foundations[i];
      if (f.length && f[f.length-1].id === cardId)
        return { pile: 'foundation', index: i, cardIdx: f.length-1 };
    }
    for (let i = 0; i < 7; i++) {
      const t = state.tableau[i];
      const idx = t.findIndex(c => c.id === cardId);
      if (idx >= 0) return { pile: 'tableau', index: i, cardIdx: idx };
    }
    return null;
  }

  /** あるパイルから cardIdx 以降のカード列を取得 (move対象) */
  function getMovingStack(loc) {
    if (loc.pile === 'waste') return [state.waste[state.waste.length-1]];
    if (loc.pile === 'foundation') return [state.foundations[loc.index][state.foundations[loc.index].length-1]];
    if (loc.pile === 'tableau') {
      const t = state.tableau[loc.index];
      const stack = t.slice(loc.cardIdx);
      // 全部 faceUp で連続している必要
      if (stack.some(c => !c.faceUp)) return null;
      for (let i = 1; i < stack.length; i++) {
        if (!Cards.altColor(stack[i], stack[i-1])) return null;
        if (stack[i].value !== stack[i-1].value - 1) return null;
      }
      return stack;
    }
    return null;
  }

  /** 移動を試行 */
  function tryMove(cardId, destPile, destIndex) {
    const loc = findCardLocation(cardId);
    if (!loc) return false;
    const moving = getMovingStack(loc);
    if (!moving) return false;
    if (moving.length > 1 && destPile === 'foundation') return false;

    // 検証
    if (destPile === 'tableau') {
      const dest = state.tableau[destIndex];
      const top = dest[dest.length-1];
      if (!canPlaceOnTableau(moving[0], top)) return false;
    } else if (destPile === 'foundation') {
      const dest = state.foundations[destIndex];
      if (!canPlaceOnFoundation(moving[0], dest)) return false;
    } else return false;

    pushHistory();
    // 元から削除
    if (loc.pile === 'waste') state.waste.pop();
    else if (loc.pile === 'foundation') state.foundations[loc.index].pop();
    else if (loc.pile === 'tableau') state.tableau[loc.index].splice(loc.cardIdx, moving.length);

    // 行先へ
    if (destPile === 'tableau') state.tableau[destIndex].push(...moving);
    else state.foundations[destIndex].push(...moving);

    // 自動フリップ
    if (loc.pile === 'tableau') {
      const t = state.tableau[loc.index];
      if (t.length && !t[t.length-1].faceUp) {
        t[t.length-1].faceUp = true;
        state.score += 5;
      }
    }

    // スコア
    if (destPile === 'foundation') state.score += 10;
    if (loc.pile === 'foundation' && destPile === 'tableau') state.score = Math.max(0, state.score - 15);
    if (loc.pile === 'waste' && destPile === 'tableau') state.score += 5;

    state.moves++;
    checkWin();
    return { from: loc, to: { pile: destPile, index: destIndex }, count: moving.length };
  }

  /** 自動移動先を探索 (タップ時) */
  function findAutoDestination(cardId) {
    const loc = findCardLocation(cardId);
    if (!loc) return null;
    const moving = getMovingStack(loc);
    if (!moving) return null;

    // 1) foundation 優先 (1枚のみ)
    if (moving.length === 1) {
      for (let i = 0; i < 4; i++) {
        if (canPlaceOnFoundation(moving[0], state.foundations[i])) {
          return { pile: 'foundation', index: i };
        }
      }
    }
    // 2) tableau (空でない先優先)
    for (let i = 0; i < 7; i++) {
      const dest = state.tableau[i];
      if (dest.length === 0) continue;
      if (loc.pile === 'tableau' && loc.index === i) continue;
      if (canPlaceOnTableau(moving[0], dest[dest.length-1])) {
        return { pile: 'tableau', index: i };
      }
    }
    // 3) tableau (空) - K のみ
    if (moving[0].rank === 'K') {
      for (let i = 0; i < 7; i++) {
        if (state.tableau[i].length === 0) {
          if (loc.pile === 'tableau' && loc.index === i) continue;
          return { pile: 'tableau', index: i };
        }
      }
    }
    return null;
  }

  /** ヒント: 何か1つ良さげな手を返す */
  function findHint() {
    // foundation 行ける waste / tableau top
    const candidates = [];
    if (state.waste.length) candidates.push({ src: state.waste[state.waste.length-1] });
    for (let i = 0; i < 7; i++) {
      const t = state.tableau[i];
      if (t.length && t[t.length-1].faceUp) candidates.push({ src: t[t.length-1] });
    }
    for (const c of candidates) {
      for (let i = 0; i < 4; i++) {
        if (canPlaceOnFoundation(c.src, state.foundations[i]))
          return { card: c.src, dest: { pile: 'foundation', index: i } };
      }
    }
    // タブロー間の有意な移動 (faceDownを開けるもの優先)
    for (let i = 0; i < 7; i++) {
      const t = state.tableau[i];
      const upStart = t.findIndex(c => c.faceUp);
      if (upStart < 0) continue;
      const moving = t.slice(upStart);
      for (let j = 0; j < 7; j++) {
        if (j === i) continue;
        const d = state.tableau[j];
        const top = d[d.length-1];
        if (canPlaceOnTableau(moving[0], top)) {
          return { card: moving[0], dest: { pile: 'tableau', index: j } };
        }
      }
    }
    // waste -> tableau
    if (state.waste.length) {
      const c = state.waste[state.waste.length-1];
      for (let j = 0; j < 7; j++) {
        const d = state.tableau[j];
        const top = d[d.length-1];
        if (canPlaceOnTableau(c, top)) {
          return { card: c, dest: { pile: 'tableau', index: j } };
        }
      }
    }
    return null;
  }

  /** 自動完成: すべて表向き且つすべての場札も移動可能なら true */
  function canAutoComplete() {
    if (state.stock.length || state.waste.length) return false;
    for (const t of state.tableau) {
      if (t.some(c => !c.faceUp)) return false;
    }
    return true;
  }

  /** 自動完成: 1手だけ進める */
  function autoCompleteStep() {
    // 一番小さい value のカードを foundation に
    const tops = [];
    for (let i = 0; i < 7; i++) {
      const t = state.tableau[i];
      if (t.length) tops.push({ src: 'tableau', i, c: t[t.length-1] });
    }
    if (state.waste.length) tops.push({ src: 'waste', i: 0, c: state.waste[state.waste.length-1] });
    tops.sort((a,b) => a.c.value - b.c.value);
    for (const t of tops) {
      for (let f = 0; f < 4; f++) {
        if (canPlaceOnFoundation(t.c, state.foundations[f])) {
          return tryMove(t.c.id, 'foundation', f);
        }
      }
    }
    return null;
  }

  function checkWin() {
    const total = state.foundations.reduce((s,f) => s+f.length, 0);
    if (total === 52) {
      state.won = true;
      state.elapsed = Date.now() - state.startedAt;
      // タイムボーナス
      const sec = state.elapsed / 1000;
      if (sec > 30) state.score += Math.floor(700000 / sec);
    }
  }

  // ===== 永続化 =====
  function save() {
    try {
      localStorage.setItem('soli_save', JSON.stringify({
        stock: state.stock, waste: state.waste,
        foundations: state.foundations, tableau: state.tableau,
        moves: state.moves, score: state.score,
        startedAt: state.startedAt, drawCount: state.drawCount,
      }));
    } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem('soli_save');
      if (!raw) return false;
      const d = JSON.parse(raw);
      state.stock = d.stock; state.waste = d.waste;
      state.foundations = d.foundations; state.tableau = d.tableau;
      state.moves = d.moves; state.score = d.score;
      state.startedAt = d.startedAt || Date.now();
      state.drawCount = d.drawCount || 1;
      state.history = []; state.won = false;
      return true;
    } catch (e) { return false; }
  }
  function clearSave() { try { localStorage.removeItem('soli_save'); } catch(e){} }

  function elapsedSec() {
    return Math.floor((Date.now() - state.startedAt) / 1000);
  }

  return {
    state,
    newGame, undo, drawFromStock,
    tryMove, findAutoDestination, findHint,
    canAutoComplete, autoCompleteStep, checkWin,
    canPlaceOnTableau, canPlaceOnFoundation,
    findCardLocation, getMovingStack,
    save, load, clearSave,
    elapsedSec,
  };
})();
