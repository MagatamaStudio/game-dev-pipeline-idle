/* ============================================================
 * tools/shots.js —— 生成展示用截图（需要本机 Edge）
 * 用法：node tools/shots.js
 * ============================================================ */
'use strict';

var { spawn } = require('child_process');
var path = require('path');
var fs = require('fs');

var ROOT = path.join(__dirname, '..');
var PORT = 9334;
var URL = process.argv[2] || 'http://127.0.0.1:8765/';
var EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
var OUT = path.join(ROOT, 'shots');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function waitFor(fn, timeout, label) {
  var start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await fn()) return true; } catch (e) { }
    await sleep(120);
  }
  throw new Error('timeout: ' + label);
}

function connect(wsUrl) {
  return new Promise(function (resolve, reject) {
    var ws = new WebSocket(wsUrl);
    var id = 0, pending = new Map();
    ws.addEventListener('message', function (ev) {
      var msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        var p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      }
    });
    ws.addEventListener('open', function () {
      resolve({
        send: function (method, params) {
          return new Promise(function (res, rej) {
            var mid = ++id;
            pending.set(mid, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id: mid, method: method, params: params || {} }));
          });
        },
        close: function () { ws.close(); }
      });
    });
    ws.addEventListener('error', function () { reject(new Error('ws error')); });
  });
}

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  var userDir = path.join(OUT, 'shot-profile');
  fs.rmSync(userDir, { recursive: true, force: true });

  var child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-port=' + PORT,
    '--remote-allow-origins=*', '--user-data-dir=' + userDir,
    '--window-size=1440,900', 'about:blank'
  ], { stdio: 'ignore' });

  var target = null;
  await waitFor(async function () {
    var res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
    var list = await res.json();
    target = list.find(function (t) { return t.type === 'page'; });
    return !!target;
  }, 20000, 'devtools');

  var cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  async function evalJs(expr) {
    var res = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error((res.exceptionDetails.exception || {}).description);
    return res.result.value;
  }

  async function shot(name) {
    var res = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(res.data, 'base64'));
    console.log('saved', name + '.png');
  }

  async function load() {
    await cdp.send('Page.navigate', { url: URL });
    await waitFor(async function () {
      return await evalJs('document.readyState === "complete" && !!window.GD && !!window.GD.UI');
    }, 15000, 'load');
    await sleep(500);
  }

  /* 1. 1972 开局 + 时代介绍 */
  await load();
  await evalJs('localStorage.clear()');
  await load();
  await sleep(700);
  await shot('01-1972-intro');

  /* 2. 1985：卡带产线 */
  await evalJs('document.querySelector("#modal-actions button").click()');
  await evalJs(`(() => {
    const s = GD.getState();
    s.era = 1; s.cycle = 1;
    GD.Engine.initEra(s);
    s.workers = { concept: 3, code: 4, art: 3, audio: 3 };
    s.toolLv = { b_code: 1, b_art: 1 };
    s.engineLv = 1;
    s.slots = 2;
    s.lineLv = 1;
    s.money = 640;
    s.fame = 46;
    s.eraReleases = 6;
    GD.UI.rebuild();
    // 造两部做完、正在等产线的作品
    const p = s.projects[0];
    if (p) { p.stage = GD.ERAS[1].stages.length; p.progress = 0.35; }
  })()`);
  await sleep(1800);
  await evalJs(`document.querySelector('[data-tab="team"]').click()`);
  await sleep(300);
  await shot('02-1985-line');

  /* 3. 1995：外包 */
  await evalJs(`(() => {
    const s = GD.getState();
    s.era = 2; s.cycle = 1;
    GD.Engine.initEra(s);
    s.workers = { concept: 4, code: 5, art: 4, audio: 4, polish: 4 };
    s.toolLv = { c_code: 1, c_art: 1, c_audio: 1 };
    s.engineLv = 1;
    s.slots = 3;
    s.money = 5600;
    s.fame = 96;
    s.eraReleases = 9;
    GD.UI.rebuild();
  })()`);
  await sleep(2600);
  await shot('03-1995-outsource');

  /* 4. 2022 手机端 */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await evalJs(`(() => {
    const s = GD.getState();
    s.era = 5; s.cycle = 2;
    GD.Engine.initEra(s);
    s.workers = { concept: 5, code: 6, art: 5, audio: 4, polish: 4 };
    s.toolLv = { f_code: 1, f_art: 1 };
    s.engineLv = 1; s.slots = 3; s.money = 268000; s.fame = 260; s.eraReleases = 17;
    GD.UI.rebuild();
  })()`);
  await sleep(2200);
  await shot('04-2022-mobile');

  cdp.close();
  child.kill();
  await sleep(300);
  console.log('done');
})().catch(function (e) {
  console.error('失败:', e.message);
  process.exit(1);
});
