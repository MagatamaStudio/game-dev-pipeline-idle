/* ============================================================
 * main.js —— 启动、主循环、存档
 * ============================================================ */
(function (GD) {
  'use strict';

  var E = GD.Engine;
  var UI = GD.UI;

  var state = null;
  var last = 0;
  var acc = 0;
  var renderAcc = 0;
  var saveAcc = 0;
  var lastPhase = '';
  var saveWarned = false;
  var errShown = '';

  function load() {
    try {
      var raw = localStorage.getItem(E.SAVE_KEY) || localStorage.getItem(E.SAVE_KEY_LEGACY);
      if (!raw) return null;
      return E.deserialize(raw);
    } catch (err) {
      console.warn('读档失败，开始新游戏', err);
      return null;
    }
  }

  function save() {
    if (!state) return;
    try {
      localStorage.setItem(E.SAVE_KEY, E.serialize(state));
    } catch (err) {
      if (!saveWarned) {
        saveWarned = true;
        console.warn('存档失败（浏览器可能禁用了本地存储）', err);
      }
    }
  }

  function quarantine() {
    try {
      var raw = localStorage.getItem(E.SAVE_KEY) || localStorage.getItem(E.SAVE_KEY_LEGACY);
      if (raw) localStorage.setItem(E.SAVE_KEY + '.broken', raw);
      localStorage.removeItem(E.SAVE_KEY);
    } catch (e) { }
  }

  function boot() {
    state = load() || E.newGame();

    var report = null;
    if (state.savedAt) {
      var away = (Date.now() - state.savedAt) / 1000;
      if (away > GD.BAL.offlineMinSeconds) {
        try { report = E.offline(state, away); } catch (err) { console.warn('离线结算失败', err); }
      }
    }

    lastPhase = state.phase;
    try {
      UI.mount(state, { onSave: save });
    } catch (err) {
      /* 某个存档把界面弄崩了：隔离备份、重开一局，别让用户对着白屏 */
      console.error('界面初始化失败，隔离存档并重开', err);
      quarantine();
      report = null;
      state = E.newGame();
      lastPhase = state.phase;
      save();
      try {
        UI.mount(state, { onSave: save });
        if (UI.showError) UI.showError('原存档无法载入，已备份为 garageStudio.save.v2.broken 并重开');
      } catch (err2) {
        console.error('重开也失败', err2);
      }
    }
    if (report && (report.days > 0 || Math.abs(report.total) > 1)) UI.showOffline(report);
    requestAnimationFrame(frame);
  }

  function reportError(err) {
    var msg = String((err && err.message) || err);
    console.error('主循环异常', err);
    if (msg !== errShown) {
      errShown = msg;
      if (UI.showError) UI.showError('运行出错：' + msg + ' —— 把这句发我就能修');
    }
  }

  function frame(ts) {
    if (!last) last = ts;
    var dt = Math.min(0.25, (ts - last) / 1000);
    last = ts;

    acc += dt;
    renderAcc += dt;
    saveAcc += dt;

    /* 推进、存档、渲染分开 try——任何一段坏了都不该拖死另外两段，
     * 更不该让主循环停止（否则局面会永久冻在当前进度）。 */
    try {
      var step = 1 / 30;
      var guard = 0;
      while (acc >= step && guard++ < 8) {
        E.tick(state, step);
        acc -= step;
      }
    } catch (err) {
      reportError(err);
      acc = 0;
    }

    try {
      if (state.phase !== lastPhase) {
        lastPhase = state.phase;
        save();
      }
      if (saveAcc >= 6) {
        saveAcc = 0;
        save();
      }
    } catch (err) {
      reportError(err);
    }

    try {
      if (renderAcc >= 0.05) {
        renderAcc = 0;
        UI.render();
      }
    } catch (err) {
      reportError(err);
      renderAcc = 0;
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) save();
  });

  /* 调试入口 */
  GD.getState = function () { return state; };
  GD.reset = function () {
    state = E.newGame();
    lastPhase = state.phase;
    save();
    UI.phaseReset();
    UI.render();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window.GD = window.GD || {});
