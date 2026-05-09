/* ============================================================
   ui.js - 画面切替/設定/統計/トースト/サウンド/その他UI
   ============================================================ */

const UI = (() => {

  // ===== 設定 =====
  const settings = {
    drawCount: 1,
    back: 'back-blue',
    theme: 'theme-green',
    sound: true,
    anim: true,
    autoflip: true,
    hints: true,
    lefty: false,
    vibe: true,
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem('soli_settings');
      if (raw) Object.assign(settings, JSON.parse(raw));
    } catch (e) {}
  }
  function saveSettings() {
    try { localStorage.setItem('soli_settings', JSON.stringify(settings)); } catch (e) {}
  }

  function applySettings() {
    document.body.classList.remove('theme-green','theme-blue','theme-dark','theme-wood','theme-sunset');
    document.body.classList.add(settings.theme);
    document.body.classList.toggle('lefty', settings.lefty);
    document.body.classList.toggle('no-anim', !settings.anim);
    Render.applyCardBack();
  }

  // ===== 統計 =====
  const stats = {
    played: 0, won: 0, bestTime: null, bestScore: 0, streak: 0,
  };
  function loadStats() {
    try {
      const raw = localStorage.getItem('soli_stats');
      if (raw) Object.assign(stats, JSON.parse(raw));
    } catch(e){}
  }
  function saveStats() {
    try { localStorage.setItem('soli_stats', JSON.stringify(stats)); } catch(e){}
  }
  function updateStatsUI() {
    document.getElementById('ss-played').textContent = stats.played;
    document.getElementById('ss-won').textContent = stats.won;
    document.getElementById('ss-rate').textContent = stats.played
      ? Math.round(stats.won/stats.played*100) + '%' : '0%';
    document.getElementById('ss-best').textContent = stats.bestTime
      ? formatTime(stats.bestTime) : '--:--';
    document.getElementById('ss-bestscore').textContent = stats.bestScore;
    document.getElementById('ss-streak').textContent = stats.streak;
  }

  // ===== 画面切替 =====
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      if (s.id === id) {
        s.classList.add('active');
        s.classList.remove('exiting');
      } else if (s.classList.contains('active')) {
        s.classList.add('exiting');
        s.classList.remove('active');
        setTimeout(()=> s.classList.remove('exiting'), 400);
      }
    });
  }

  // ===== トースト =====
  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  function toast(msg, ms = 1800) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toastEl.classList.remove('show'), ms);
  }

  // ===== サウンド (簡易: WebAudioでビープ) =====
  let audioCtx = null;
  function beep(freq=600, dur=0.06, type='sine', vol=0.05) {
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  function vibrate(ms=20) {
    if (!settings.vibe) return;
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  // ===== ヒント表示 =====
  let hintTimer = null;
  function showHintBanner(text) {
    const e = document.getElementById('hint-banner');
    e.textContent = text;
    e.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(()=> e.classList.remove('show'), 2200);
  }

  function showHint() {
    const h = Game.findHint();
    if (!h) {
      showHintBanner('有効な手が見つかりません');
      return;
    }
    Render.pulseCard(h.card.id);
    const pileId = h.dest.pile === 'foundation'
      ? `pile-found-${h.dest.index}` : `pile-tab-${h.dest.index}`;
    Render.pulsePile(document.getElementById(pileId));
    showHintBanner(`${h.card.rank}${h.card.suitSym} を移動`);
  }

  // ===== 自動完成 =====
  let autoTimer = null;
  function startAutoComplete() {
    if (!Game.canAutoComplete()) {
      toast('自動完成はまだ使えません');
      return;
    }
    function step() {
      const r = Game.autoCompleteStep();
      if (r) {
        afterMove(r, /*silent*/false);
        autoTimer = setTimeout(step, 180);
      }
    }
    step();
  }
  function stopAutoComplete() { clearTimeout(autoTimer); autoTimer = null; }

  // ===== 勝利演出 =====
  function showWin() {
    stats.played++;
    stats.won++;
    stats.streak++;
    if (Game.state.score > stats.bestScore) stats.bestScore = Game.state.score;
    const sec = Math.floor(Game.state.elapsed/1000);
    if (!stats.bestTime || sec < stats.bestTime) stats.bestTime = sec;
    saveStats();
    Game.clearSave();

    const m = document.getElementById('modal-clear');
    document.getElementById('cl-score').textContent = Game.state.score;
    document.getElementById('cl-moves').textContent = Game.state.moves;
    document.getElementById('cl-time').textContent = formatTime(sec);
    m.classList.add('active');
    spawnConfetti();
    beep(880, 0.1); setTimeout(()=> beep(1100, 0.12), 120); setTimeout(()=> beep(1320, 0.18), 280);
  }

  function spawnConfetti() {
    const wrap = document.getElementById('confetti');
    wrap.innerHTML = '';
    const colors = ['#ffd54a','#ff6b6b','#5dd6ff','#82ed8b','#d49bff'];
    for (let i = 0; i < 60; i++) {
      const s = document.createElement('span');
      s.style.left = (Math.random()*100) + '%';
      s.style.background = colors[Math.floor(Math.random()*colors.length)];
      s.style.animationDelay = (Math.random()*0.6) + 's';
      s.style.transform = `rotate(${Math.random()*360}deg)`;
      wrap.appendChild(s);
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec/60), s = sec%60;
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  // ===== タイマー更新 =====
  let tickTimer = null;
  function startTick() {
    stopTick();
    tickTimer = setInterval(()=> Render.updateStatus(), 500);
  }
  function stopTick() { clearInterval(tickTimer); tickTimer = null; }

  // ===== Move後フック =====
  function afterMove(result) {
    Render.renderAll();
    Render.updateStatus();
    Game.save();
    beep(540, 0.04);
    vibrate(15);
    if (Game.state.won) {
      stopTick();
      setTimeout(showWin, 350);
    }
  }

  // ===== 設定UI =====
  function bindSettingsUI() {
    const map = {
      drawCount: 'set-draw',
      back: 'set-back',
      theme: 'set-theme',
      sound: 'set-sound',
      anim: 'set-anim',
      autoflip: 'set-autoflip',
      hints: 'set-hints',
      lefty: 'set-lefty',
      vibe: 'set-vibe',
    };
    Object.entries(map).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (!el) return;
      // 初期値
      if (el.type === 'checkbox') el.checked = !!settings[key];
      else el.value = String(settings[key]);

      el.addEventListener('change', () => {
        if (el.type === 'checkbox') settings[key] = el.checked;
        else if (key === 'drawCount') settings[key] = parseInt(el.value, 10);
        else settings[key] = el.value;
        saveSettings();
        applySettings();
        toast('設定を保存しました');
      });
    });
  }

  return {
    settings, stats,
    loadSettings, saveSettings, applySettings,
    loadStats, saveStats, updateStatsUI,
    showScreen, toast, beep, vibrate,
    showHint, startAutoComplete, stopAutoComplete,
    showWin, afterMove,
    startTick, stopTick, formatTime,
    bindSettingsUI,
  };
})();
