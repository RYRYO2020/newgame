/* ============================================================
   main.js - エントリーポイント / ボタンバインド
   ============================================================ */

(function () {

  function start() {
    UI.loadSettings();
    UI.loadStats();
    UI.applySettings();
    UI.bindSettingsUI();
    UI.updateStatsUI();
    DragDrop.init();

    // タイトルへ
    UI.showScreen('screen-title');

    // 全ボタン data-action でデリゲート
    document.body.addEventListener('click', onAction);

    // モーダルクリックで閉じる
    document.getElementById('modal-clear').addEventListener('click', (e) => {
      if (e.target.id === 'modal-clear') closeClearModal();
    });

    // リサイズ時に再描画 (タブロー overlap 再計算)
    let rzT;
    window.addEventListener('resize', () => {
      clearTimeout(rzT);
      rzT = setTimeout(() => {
        if (document.getElementById('screen-game').classList.contains('active')) {
          Render.renderAll();
        }
      }, 120);
    });

    // キーボードショートカット (PC)
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('screen-game').classList.contains('active')) return;
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doUndo(); }
      else if (e.key === 'h') UI.showHint();
      else if (e.key === ' ') { e.preventDefault(); Game.drawFromStock(); UI.afterMove({}); }
      else if (e.key === 'a') UI.startAutoComplete();
    });

    // 訪問時に保存があれば「つづきから」を有効化
    refreshContinueButton();
  }

  function refreshContinueButton() {
    const btn = document.querySelector('[data-action="continue"]');
    if (!btn) return;
    const has = !!localStorage.getItem('soli_save');
    btn.disabled = !has;
    btn.style.opacity = has ? '1' : '0.45';
  }

  function onAction(e) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    switch (a) {
      case 'start-new':   startNew(); break;
      case 'continue':    continueGame(); break;
      case 'open-settings': UI.showScreen('screen-settings'); break;
      case 'open-stats':  UI.updateStatsUI(); UI.showScreen('screen-stats'); break;
      case 'open-help':   UI.showScreen('screen-help'); break;
      case 'back-title':  goTitle(); break;
      case 'undo':        doUndo(); break;
      case 'hint':        UI.showHint(); break;
      case 'auto':        UI.startAutoComplete(); break;
      case 'restart':     restart(); break;
      case 'reset-stats': resetStats(); break;
    }
  }

  function startNew() {
    closeClearModal();
    // クリア済の場合は streakを保持; ロスとして扱うのは「やり直し中断」のみ
    Game.newGame({ drawCount: UI.settings.drawCount });
    UI.showScreen('screen-game');
    requestAnimationFrame(() => {
      Render.renderAll();
      Render.updateStatus();
      UI.startTick();
    });
    Game.save();
    refreshContinueButton();
  }

  function continueGame() {
    if (!Game.load()) {
      UI.toast('保存データがありません');
      return;
    }
    UI.showScreen('screen-game');
    requestAnimationFrame(() => {
      Render.renderAll();
      Render.updateStatus();
      UI.startTick();
    });
  }

  function goTitle() {
    UI.stopTick();
    UI.stopAutoComplete();
    closeClearModal();
    UI.showScreen('screen-title');
    refreshContinueButton();
  }

  function doUndo() {
    if (Game.undo()) {
      Render.renderAll();
      Render.updateStatus();
      Game.save();
      UI.beep(420, 0.04);
    } else {
      UI.toast('元に戻せません');
    }
  }

  function restart() {
    if (!confirm('今のゲームをやり直しますか?')) return;
    UI.stats.streak = 0; // 連勝リセット
    UI.stats.played++;
    UI.saveStats();
    startNew();
  }

  function resetStats() {
    if (!confirm('統計をリセットしますか?')) return;
    Object.assign(UI.stats, { played:0, won:0, bestTime:null, bestScore:0, streak:0 });
    UI.saveStats();
    UI.updateStatsUI();
    UI.toast('統計をリセットしました');
  }

  function closeClearModal() {
    document.getElementById('modal-clear').classList.remove('active');
  }

  // 起動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
