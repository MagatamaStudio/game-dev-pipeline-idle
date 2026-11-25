/* ============================================================
 * tools/measure.js —— 实测一局真实耗时（不加速）
 * 用法：node tools/measure.js [url]
 * ============================================================ */
'use strict';

var { spawn } = require('child_process');
var path = require('path');
var fs = require('fs');

var ROOT = path.join(__dirname, '..');
var PORT = 9337;
var URL = process.argv[2] || 'http://127.0.0.1:8765/';
var EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function waitFor(fn, timeout, label) {
  var start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await fn()) return true; } catch (e) { }
    await sleep(100);
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
  var userDir = path.join(ROOT, 'shots', 'measure');
  fs.rmSync(userDir, { recursive: true, force: true });

  var child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--remote-debugging-port=' + PORT, '--remote-allow-origins=*',
    '--user-data-dir=' + userDir, '--window-size=1440,900', 'about:blank'
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
    var res = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (res.exceptionDetails) throw new Error('eval failed');
    return res.result.value;
  }

  await cdp.send('Page.navigate', { url: URL });
  await waitFor(async function () { return await evalJs('document.readyState === "complete" && !!window.GD'); }, 15000, 'load');
  await sleep(400);

  await evalJs(`document.querySelector('[data-act="go"]').click()`);
  var t0 = Date.now();
  var marks = { dev: null, event: null, review: null, sales: null, done: null };

  await waitFor(async function () {
    var phase = await evalJs('GD.getState().phase');
    var now = Date.now() - t0;
    if (phase === 'event') {
      if (marks.event === null) marks.event = now;
      await evalJs(`(() => { const s = GD.getState(); if (s.phase === 'event') GD.Engine.chooseEvent(s, 0); })()`);
    }
    if (!marks.review && phase === 'review') marks.review = now;
    if (!marks.sales && phase === 'sales') marks.sales = now;
    if (phase === 'done') { marks.done = now; return true; }
    return false;
  }, 180000, 'finish');

  var res = await evalJs(`({
    score: GD.getState().lastResult.total,
    copies: GD.getState().lastResult.copies,
    revenue: Math.round(GD.getState().lastResult.revenue),
    money: Math.round(GD.getState().money)
  })`);

  console.log('事件触发  ' + (marks.event / 1000).toFixed(1) + 's');
  console.log('评审开始  ' + (marks.review / 1000).toFixed(1) + 's');
  console.log('销售开始  ' + (marks.sales / 1000).toFixed(1) + 's');
  console.log('一局结束  ' + (marks.done / 1000).toFixed(1) + 's');
  console.log('评分 ' + res.score + '/40 · 销量 ' + res.copies + ' · 收入 $' + res.revenue);

  cdp.close();
  child.kill();
  await sleep(300);
})().catch(function (e) {
  console.error('失败:', e.message);
  process.exit(1);
});
