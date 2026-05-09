/* ============================================================
   render.js - 盤面/カードの DOM 描画
   ============================================================ */

const Render = (() => {

  const SUIT_HINTS = ['♠','♥','♣','♦'];

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /** カードDOMを生成 */
  function createCardElement(card, opts = {}) {
    const wrap = el('div', 'card ' + (card.faceUp ? 'face-up' : 'face-down') + (card.color === 'red' ? ' red' : ''));
    wrap.dataset.id = card.id;
    wrap.dataset.suit = card.suit;
    wrap.dataset.rank = card.rank;

    // 表面
    const front = el('div', 'face-front');
    front.appendChild(buildCornerHTML(card, 'tl'));
    front.appendChild(el('div', 'card-center', card.suitSym));
    front.appendChild(buildCornerHTML(card, 'br'));

    // 裏面
    const back = el('div', 'face-back');

    wrap.appendChild(front);
    wrap.appendChild(back);
    return wrap;
  }

  function buildCornerHTML(card, pos) {
    const c = el('div', 'card-corner ' + pos);
    c.appendChild(el('div', 'rank', card.rank));
    c.appendChild(el('div', 'suit', card.suitSym));
    return c;
  }

  /** 全体描画 */
  function renderAll() {
    const s = Game.state;

    // foundation hints
    for (let i = 0; i < 4; i++) {
      const p = document.getElementById('pile-found-' + i);
      p.dataset.suitHint = SUIT_HINTS[i];
    }

    renderStock();
    renderWaste();
    for (let i = 0; i < 4; i++) renderFoundation(i);
    for (let i = 0; i < 7; i++) renderTableau(i);
    applyCardBack();
  }

  function renderStock() {
    const pile = document.getElementById('pile-stock');
    pile.innerHTML = '';
    const s = Game.state.stock;
    if (s.length === 0) {
      pile.classList.add('empty');
      return;
    }
    pile.classList.remove('empty');
    // 一番上(=最後)だけ表示
    const card = s[s.length-1];
    const node = createCardElement({ ...card, faceUp: false });
    pile.appendChild(node);
    // 残数表示
    const badge = el('div', 'stock-count', String(s.length));
    Object.assign(badge.style, {
      position:'absolute', right:'4px', bottom:'4px',
      background:'rgba(0,0,0,.6)', borderRadius:'10px',
      padding:'2px 6px', fontSize:'11px', zIndex:'10',
    });
    pile.appendChild(badge);
  }

  function renderWaste() {
    const pile = document.getElementById('pile-waste');
    pile.innerHTML = '';
    const w = Game.state.waste;
    // 直近 3 枚を少しずらして表示
    const start = Math.max(0, w.length - 3);
    for (let i = start; i < w.length; i++) {
      const card = w[i];
      const node = createCardElement(card);
      const offset = (i - start) * 14;
      node.style.left = offset + '%';
      node.style.zIndex = i;
      pile.appendChild(node);
    }
  }

  function renderFoundation(idx) {
    const pile = document.getElementById('pile-found-' + idx);
    pile.innerHTML = '';
    const f = Game.state.foundations[idx];
    if (f.length === 0) return;
    const card = f[f.length-1];
    const node = createCardElement(card);
    pile.appendChild(node);
  }

  function renderTableau(idx) {
    const pile = document.getElementById('pile-tab-' + idx);
    pile.innerHTML = '';
    const t = Game.state.tableau[idx];
    if (t.length === 0) return;

    // 動的オーバーラップ計算 (列が長いと縮小)
    const pileH = pile.clientHeight || 400;
    const cardH = pile.clientWidth * 1.4;
    const upGap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tab-overlap-up')) || 24;
    const downGap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tab-overlap-down')) || 14;

    // 計算: 必要トータル height
    let totalNeeded = cardH;
    for (let i = 1; i < t.length; i++) {
      totalNeeded += t[i-1].faceUp ? upGap : downGap;
    }
    let scale = 1;
    if (totalNeeded > pileH && pileH > 0) {
      scale = Math.max(0.4, (pileH - cardH) / (totalNeeded - cardH));
    }

    let top = 0;
    for (let i = 0; i < t.length; i++) {
      const card = t[i];
      const node = createCardElement(card);
      node.style.top = top + 'px';
      node.style.zIndex = i + 1;
      pile.appendChild(node);
      const gap = card.faceUp ? upGap : downGap;
      top += gap * scale;
    }
  }

  /** 状態バー更新 */
  function updateStatus() {
    document.getElementById('stat-score').textContent = Game.state.score;
    document.getElementById('stat-moves').textContent = Game.state.moves;
    const s = Game.elapsedSec();
    const m = Math.floor(s/60);
    document.getElementById('stat-time').textContent =
      String(m).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  }

  /** カード裏面デザイン適用 */
  function applyCardBack() {
    const cls = (window.UI && UI.settings && UI.settings.back) || 'back-blue';
    document.body.classList.remove('back-blue','back-red','back-grid','back-stars');
    document.body.classList.add(cls);
  }

  /** スコアポップ */
  function showScorePop(text, x, y) {
    const e = el('div', 'score-pop', text);
    e.style.left = x + 'px';
    e.style.top = y + 'px';
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 1000);
  }

  /** カードゆれ (無効移動表示) */
  function shakeCard(cardId) {
    const c = document.querySelector(`.card[data-id="${cardId}"]`);
    if (!c) return;
    c.classList.add('shake');
    setTimeout(()=> c.classList.remove('shake'), 350);
  }

  /** ヒントパルス */
  function pulseCard(cardId) {
    const c = document.querySelector(`.card[data-id="${cardId}"]`);
    if (c) c.classList.add('hint-pulse');
    setTimeout(()=> {
      if (c) c.classList.remove('hint-pulse');
    }, 3200);
  }
  function pulsePile(pileEl) {
    pileEl.classList.add('hint-target');
    setTimeout(()=> pileEl.classList.remove('hint-target'), 3200);
  }

  return {
    createCardElement, renderAll, renderStock, renderWaste,
    renderFoundation, renderTableau,
    updateStatus, applyCardBack,
    showScorePop, shakeCard, pulseCard, pulsePile,
  };
})();
