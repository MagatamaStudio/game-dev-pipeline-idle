/* ============================================================
 * main.js —— 启动与主循环
 * ============================================================ */
(function (GD) {
  'use strict';

  var E = GD.Engine;
  var UI = GD.UI;

  var state = E.newGame();
  var last = 0;
  var acc = 0;
  var renderAcc = 0;

  function boot() {
    UI.mount(state, {});
    requestAnimationFrame(frame);
  }

  function frame(ts) {
    if (!last) last = ts;
    var dt = Math.min(0.25, (ts - last) / 1000);
    last = ts;

    acc += dt;
    renderAcc += dt;

    var step = 1 / 30;
    var guard = 0;
    while (acc >= step && guard++ < 8) {
      E.tick(state, step);
      acc -= step;
    }

    if (renderAcc >= 0.05) {
      renderAcc = 0;
      UI.render();
    }

    requestAnimationFrame(frame);
  }

  /* 调试入口（自动化测试用） */
  GD.getState = function () { return state; };
  GD.reset = function () { state = E.newGame(); UI.phaseReset(); UI.render(); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window.GD = window.GD || {});
