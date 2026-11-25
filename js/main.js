/* ============================================================
 * main.js —— 启动、主循环、存档、离线结算
 * ============================================================ */
(function (GD) {
  'use strict';

  var E = GD.Engine;
  var UI = GD.UI;

  var state = null;
  var lastFrame = 0;
  var acc = 0;
  var renderAcc = 0;
  var sinceSave = 0;
  var hiddenAt = 0;
  var loopBroken = false;

  /* ---------------- 启动 ---------------- */

  function boot() {
    state = loadFromStorage();

    var isNew = !state;
    if (isNew) {
      state = E.newGame();
    }

    var offlineReport = null;
    if (!isNew) {
      var away = (Date.now() - (state.lastSeen || Date.now())) / 1000;
      if (away > 60) {
        offlineReport = E.offline(state, away);
        offlineReport.capped = away > GD.OFFLINE_CAP;
        offlineReport.away = away;
      }
    }
    state.lastSeen = Date.now();

    UI.mount(state, {
      onAdvance: advanceEra,
      onSave: save,
      onExport: exportSave,
      onImport: importSave,
      onReset: resetGame
    });

    if (offlineReport && (offlineReport.earned > 0 || offlineReport.releases > 0)) {
      UI.showOffline(offlineReport);
    } else if (isNew) {
      UI.showEraIntro();
    } else if (isNew === false && state.eraReleases === 0 && state.totalReleases === 0) {
      UI.showEraIntro();
    }

    requestAnimationFrame(frame);
    setInterval(function () { if (document.hidden) save(); }, 15000);
  }

  /* ---------------- 主循环 ---------------- */

  function frame(ts) {
    if (loopBroken) return;
    try {
      if (!lastFrame) lastFrame = ts;
      var dt = Math.min(0.5, (ts - lastFrame) / 1000);
      lastFrame = ts;

      acc += dt;
      renderAcc += dt;
      sinceSave += dt;

      var step = GD.TICK_MS / 1000;
      var guard = 0;
      while (acc >= step && guard++ < 30) {
        var events = E.tick(state, step);
        if (events.length) UI.handleEvents(events);
        acc -= step;
      }

      if (renderAcc >= 0.1) {
        renderAcc = 0;
        UI.render();
      }

      if (sinceSave >= GD.SAVE_EVERY_MS / 1000) {
        sinceSave = 0;
        save();
      }

      requestAnimationFrame(frame);
    } catch (err) {
      loopBroken = true;
      console.error('主循环出错', err);
      UI.toast('游戏循环出错，请刷新页面', 'legacy');
    }
  }

  /* ---------------- 时代推进 ---------------- */

  function advanceEra() {
    var res = E.advanceEra(state);
    if (!res) return;
    UI.rebuild();
    save();
    UI.showEraIntro({ gain: res.gain, wrapped: res.wrapped, finished: res.finished });
  }

  /* ---------------- 存档 ---------------- */

  function save() {
    if (!state) return;
    try {
      localStorage.setItem(GD.SAVE_KEY, E.serialize(state));
    } catch (err) {
      console.warn('存档失败', err);
    }
  }

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(GD.SAVE_KEY);
      if (!raw) return null;
      return E.deserialize(raw);
    } catch (err) {
      console.warn('读档失败，将开始新游戏', err);
      return null;
    }
  }

  /* ---------------- 导出 / 导入 ---------------- */

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64decode(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function exportSave() {
    var code = b64encode(E.serialize(state));
    UI.modal({
      eyebrow: 'SAVE',
      title: '导出存档',
      html:
        '<p>把下面这段文本保存好。换设备时用「导入存档」贴回去即可。</p>' +
        '<textarea id="save-code" readonly>' + code + '</textarea>',
      actions: [
        {
          label: '复制',
          onClick: function () {
            var ta = document.getElementById('save-code');
            if (ta) { ta.select(); }
            if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () { });
            else { try { document.execCommand('copy'); } catch (e) { } }
            UI.toast('已复制到剪贴板');
          }
        },
        { label: '完成', primary: true }
      ]
    });
  }

  function importSave() {
    UI.modal({
      eyebrow: 'SAVE',
      title: '导入存档',
      html:
        '<p>粘贴之前导出的存档文本。这会覆盖当前进度。</p>' +
        '<textarea id="save-import" placeholder="粘贴存档文本…"></textarea>',
      actions: [
        {
          label: '导入', primary: true,
          onClick: function () {
            var ta = document.getElementById('save-import');
            var text = ta ? ta.value.trim() : '';
            if (!text) return;
            try {
              var next = E.deserialize(b64decode(text));
              state = next;
              state.lastSeen = Date.now();
              save();
              UI.rebuild();
              UI.toast('存档已导入');
            } catch (err) {
              UI.toast('存档格式不对，导入失败');
            }
          }
        },
        { label: '取消' }
      ]
    });
  }

  function resetGame() {
    UI.modal({
      eyebrow: 'RESET',
      title: '重新开始？',
      html: '<p>这会清空当前进度（包括传承点），从 1972 年重新来过。建议先导出存档。</p>',
      actions: [
        {
          label: '确认清空', primary: true,
          onClick: function () {
            try { localStorage.removeItem(GD.SAVE_KEY); } catch (e) { }
            state = E.newGame();
            state.lastSeen = Date.now();
            lastFrame = 0; acc = 0; renderAcc = 0;
            UI.rebuild();
            UI.showEraIntro();
            save();
          }
        },
        { label: '取消' }
      ]
    });
  }

  /* ---------------- 调试入口（自动化测试用） ---------------- */
  GD.getState = function () { return state; };

  /* ---------------- 标签页切换 ---------------- */

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      hiddenAt = Date.now();
      save();
    } else if (hiddenAt) {
      var away = (Date.now() - hiddenAt) / 1000;
      hiddenAt = 0;
      lastFrame = 0;
      acc = 0;
      if (away > 5) {
        var rep = E.offline(state, away, 1);
        if (rep.earned > 0) {
          UI.toast('离开 ' + GD.fmtTime(away) + '，收入 <b>+' + GD.fmtMoney(rep.earned) + '</b>');
        }
      }
    }
  });

  window.addEventListener('pagehide', save);
  window.addEventListener('beforeunload', save);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window.GD = window.GD || {});
