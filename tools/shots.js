/* ============================================================
 * tools/shots.js —— 生成 M0 展示截图
 * 用法：node tools/shots.js
 * ============================================================ */
'use strict';

var { spawn } = require('child_process');
var path = require('path');
var fs = require('fs');

var ROOT = path.join(__dirname, '..');
var PORT = 9336;
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
  var userDir = path.join(OUT, 'shot-m0');
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

  await cdp.send('Page.navigate', { url: URL });
  await waitFor(async function () { return await evalJs('document.readyState === "complete" && !!window.GD'); }, 15000, 'load');
  await sleep(600);

  /* 1. 企划 */
  await evalJs(`document.querySelector('[data-plan="theme:fantasy"]').click()`);
  await sleep(300);
  await shot('m0-01-planning');

  /* 2. 开发中（档位 + 日志） */
  await evalJs(`document.querySelector('[data-act="go"]').click()`);
  await sleep(700);
  await evalJs(`(() => { const s = GD.getState(); if (s.phase === 'developing') s.project.progress = 0.36; })()`);
  await sleep(600);
  await evalJs(`document.querySelector('[data-mode="crunch"]').click()`);
  await sleep(400);
  await shot('m0-02-developing');

  /* 3. 评审（全部亮分） */
  await evalJs(`(() => {
    const s = GD.getState();
    s.project.progress = 1.01;
  })()`);
  await sleep(400);
  await evalJs(`(() => { const s = GD.getState(); if (s.phase === 'review') s.timer = 5.2; })()`);
  await sleep(500);
  await shot('m0-03-review');

  /* 4. 发售决策 */
  await evalJs(`(() => { const s = GD.getState(); if (s.phase === 'review') s.timer = 8; })()`);
  await sleep(600);
  await shot('m0-04-release');

  /* 5. 销售 */
  await evalJs(`document.querySelector('[data-act="release-now"]').click()`);
  await sleep(800);
  await shot('m0-05-sales');

  /* 6. 手机端企划 */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await evalJs(`GD.reset()`);
  await sleep(500);
  await shot('m0-06-mobile');

  cdp.close();
  child.kill();
  await sleep(300);
  console.log('done');
})().catch(function (e) {
  console.error('失败:', e.message);
  process.exit(1);
});
