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

  function load() {
    try {
      var raw = localStorage.getItem(E.SAVE_KEY);
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

  function boot() {
    state = load() || E.newGame();
    lastPhase = state.phase;
    UI.mount(state, { onSave: save });
    requestAnimationFrame(frame);
  }

  function frame(ts) {
    if (!last) last = ts;
    var dt = Math.min(0.25, (ts - last) / 1000);
    last = ts;

    acc += dt;
    renderAcc += dt;
    saveAcc += dt;

    var step = 1 / 30;
    var guard = 0;
    while (acc >= step && guard++ < 8) {
      E.tick(state, step);
      acc -= step;
    }

    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      save();
    }

    if (saveAcc >= 6) {
      saveAcc = 0;
      save();
    }

    if (renderAcc >= 0.05) {
      renderAcc = 0;
      UI.render();
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
