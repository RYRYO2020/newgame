/* ============================================================
   dragdrop.js - ポインタによるドラッグ＆ドロップ + タップ操作
   ============================================================ */

const DragDrop = (() => {

  const ghost = document.getElementById('drag-ghost');

  let dragging = null; // { cards, srcLoc, originEls, startX, startY, offsetX, offsetY, lastTap, doubled }
  let lastTap = { id: null, time: 0 };

  function getCardElById(id) {
    return document.querySelector(`.card[data-id="${id}"]`);
  }

  function elFromPoint(x, y) {
    return document.elementFromPoint(x, y);
  }

  function findPileElAt(x, y) {
    let el = elFromPoint(x, y);
    while (el && !el.classList?.contains('pile')) {
      if (el.dataset?.pile) break;
      el = el.parentElement;
    }
    return el && el.dataset?.pile ? el : null;
  }

  function clearDropTargets() {
    document.querySelectorAll('.pile.drop-target-ok, .pile.drop-target-no')
      .forEach(p => p.classList.remove('drop-target-ok','drop-target-no'));
  }

  function onPointerDown(e) {
    // 修正: 山札(stock)エリアがタップされた場合、ここで処理を一元化して確実に反応させる
    const stockPile = e.target.closest('#pile-stock');
    if (stockPile) {
      e.preventDefault();
      // カードがある、もしくは空だけどwasteにカードがありリサイクルできる場合
      if (Game.state.stock.length > 0 || Game.state.waste.length > 0) {
        handleStockClick();
      }
      return;
    }

    const cardEl = e.target.closest('.card');
    if (!cardEl) return;

    const cardId = cardEl.dataset.id;
    const loc = Game.findCardLocation(cardId);
    if (!loc) return;

    const cardObj = getCardObj(loc);
    if (!cardObj || !cardObj.faceUp) return;

    // ダブルタップ判定
    const now = performance.now();
    if (lastTap.id === cardId && now - lastTap.time < 320) {
      lastTap = { id: null, time: 0 };
      doubleTap(cardId);
      return;
    }
    lastTap = { id: cardId, time: now };

    // 移動可能スタック
    const moving = Game.getMovingStack(loc);
    if (!moving || moving.length === 0) return;

    e.preventDefault();
    cardEl.setPointerCapture?.(e.pointerId);

    const rect = cardEl.getBoundingClientRect();
    dragging = {
      cards: moving,
      srcLoc: loc,
      originEls: moving.map(c => getCardElById(c.id)),
      startX: e.clientX, startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      moved: false,
      pointerId: e.pointerId,
    };
    // ghost構築
    ghost.innerHTML = '';
    ghost.style.width = rect.width + 'px';
    moving.forEach(c => {
      const node = Render.createCardElement(c);
      node.style.position = 'relative';
      node.style.width = '100%';
      node.style.aspectRatio = '5/7';
      ghost.appendChild(node);
    });

    // 元カード半透明
    dragging.originEls.forEach(el => el && el.classList.add('dragging'));

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  }

  function getCardObj(loc) {
    const s = Game.state;
    if (loc.pile === 'waste') return s.waste[loc.cardIdx];
    if (loc.pile === 'foundation') return s.foundations[loc.index][loc.cardIdx];
    if (loc.pile === 'tableau') return s.tableau[loc.index][loc.cardIdx];
    return null;
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    if (!dragging.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      dragging.moved = true;
      ghost.classList.add('active');
    }
    if (dragging.moved) {
      ghost.style.left = (e.clientX - dragging.offsetX) + 'px';
      ghost.style.top  = (e.clientY - dragging.offsetY) + 'px';
      // hover pile
      clearDropTargets();
      const pileEl = findPileElAt(e.clientX, e.clientY);
      if (pileEl && (pileEl.dataset.pile === 'tableau' || pileEl.dataset.pile === 'foundation')) {
        const ok = canDropTo(pileEl);
        pileEl.classList.add(ok ? 'drop-target-ok' : 'drop-target-no');
      }
    }
  }

  function canDropTo(pileEl) {
    if (!dragging) return false;
    const card = dragging.cards[0];
    const type = pileEl.dataset.pile;
    const idx = Number(pileEl.dataset.index);
    if (type === 'tableau') {
      const dest = Game.state.tableau[idx];
      const top = dest[dest.length-1];
      return Game.canPlaceOnTableau(card, top);
    }
    if (type === 'foundation') {
      if (dragging.cards.length > 1) return false;
      return Game.canPlaceOnFoundation(card, Game.state.foundations[idx]);
    }
    return false;
  }

  function onPointerUp(e) {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);

    if (!dragging) return;

    const wasMoved = dragging.moved;
    const cards = dragging.cards;
    const srcLoc = dragging.srcLoc;

    // tap (= no movement)
    if (!wasMoved) {
      finalize();
      handleTap(cards[0]);
      return;
    }

    const pileEl = findPileElAt(e.clientX, e.clientY);
    if (pileEl && (pileEl.dataset.pile === 'tableau' || pileEl.dataset.pile === 'foundation')) {
      const result = Game.tryMove(cards[0].id, pileEl.dataset.pile, Number(pileEl.dataset.index));
      if (result) {
        UI.afterMove(result);
        finalize();
        return;
      } else {
        Render.shakeCard(cards[0].id);
      }
    } else {
      Render.shakeCard(cards[0].id);
    }
    finalize();
  }

  function finalize() {
    clearDropTargets();
    if (dragging) {
      dragging.originEls.forEach(el => el && el.classList.remove('dragging'));
    }
    ghost.classList.remove('active');
    ghost.innerHTML = '';
    dragging = null;
  }

  // タップ: 自動移動先へ
  function handleTap(card) {
    const dest = Game.findAutoDestination(card.id);
    if (!dest) {
      Render.shakeCard(card.id);
      return;
    }
    const result = Game.tryMove(card.id, dest.pile, dest.index);
    if (result) UI.afterMove(result);
  }

  function doubleTap(cardId) {
    // 強制 foundation
    const loc = Game.findCardLocation(cardId);
    if (!loc) return;
    const moving = Game.getMovingStack(loc);
    if (!moving || moving.length !== 1) return;
    for (let i = 0; i < 4; i++) {
      if (Game.canPlaceOnFoundation(moving[0], Game.state.foundations[i])) {
        const r = Game.tryMove(cardId, 'foundation', i);
        if (r) UI.afterMove(r);
        return;
      }
    }
  }

  function handleStockClick() {
    if (Game.drawFromStock()) {
      UI.afterMove({ pile: 'stock' });
    }
  }

  function init() {
    // 修正: イベントを pointerdown に統一。click イベントでの判定は削除。
    document.getElementById('game-board').addEventListener('pointerdown', onPointerDown);
  }

  return { init };
})();