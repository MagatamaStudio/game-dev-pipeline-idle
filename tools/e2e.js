/* ============================================================
 * tools/e2e.js —— M0 浏览器冒烟测试（CDP 驱动无头 Edge）
 * 用法：node tools/e2e.js [url]
 * ============================================================ */
'use strict';

var { spawn } = require('child_process');
var path = require('path');
var fs = require('fs');

var ROOT = path.join(__dirname, '..');
var PORT = 9335;
var URL = process.argv[2] || 'http://127.0.0.1:8765/';
var EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

var results = [];
function check(name, ok, detail) {
  results.push({ name: name, ok: !!ok, detail: detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  → ' + detail : ''));
}
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
    var id = 0, pending = new Map(), listeners = [];
    ws.addEventListener('message', function (ev) {
      var msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        var p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      } else if (msg.method) {
        listeners.forEach(function (fn) { fn(msg); });
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
        on: function (fn) { listeners.push(fn); },
        close: function () { ws.close(); }
      });
    });
    ws.addEventListener('error', function () { reject(new Error('ws error')); });
  });
}

(async function main() {
  var userDir = path.join(ROOT, 'shots', 'e2e-m0');
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
  var errors = [];
  cdp.on(function (msg) {
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push('exception: ' + (msg.params.exceptionDetails.exception || {}).description);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push('console.error: ' + msg.params.args.map(function (a) { return a.value || a.description; }).join(' '));
    }
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  async function evalJs(expr) {
    var res = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error('eval: ' + (res.exceptionDetails.exception || {}).description);
    return res.result.value;
  }

  await cdp.send('Page.navigate', { url: URL });
  await waitFor(async function () { return await evalJs('document.readyState === "complete" && !!window.GD && !!window.GD.UI'); }, 15000, 'load');
  await sleep(500);

  /* ---------- 1. 首屏 ---------- */
  var first = await evalJs(`(() => {
    const q = s => document.querySelector(s);
    const r = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      desks: document.querySelectorAll('.desk').length,
      avatars: document.querySelectorAll('.avatar svg').length,
      chips: document.querySelectorAll('.chip').length,
      previews: document.querySelectorAll('.pv').length,
      phase: GD.getState().phase,
      money: GD.getState().money,
      stage: r(q('#stage')), office: r(q('.office')), hud: r(q('.hud'))
    };
  })()`);

  check('无横向溢出', first.overflow <= 0, 'overflow=' + first.overflow);
  check('办公室有 3 个人', first.desks === 3 && first.avatars === 3);
  check('企划有 13 个选项（5+5+3）', first.chips === 13, 'chips=' + first.chips);
  check('预告面板 6 项', first.previews === 6, 'pv=' + first.previews);
  check('初始进入企划阶段', first.phase === 'planning');
  check('舞台与办公室都有高度', first.stage.h > 200 && first.office.h > 120,
    'stage=' + first.stage.h + ' office=' + first.office.h);

  /* ---------- 2. 选择类型/题材 ---------- */
  await evalJs(`document.querySelector('[data-plan="theme:modern"]').click()`);
  await sleep(200);
  var afterPick = await evalJs(`({ theme: GD.getState().plan.theme, on: document.querySelectorAll('.chip.on').length })`);
  check('点击题材会改变企划', afterPick.theme === 'modern' && afterPick.on === 3,
    'theme=' + afterPick.theme + ' on=' + afterPick.on);

  var badAffinity = await evalJs(`document.querySelector('.pv b').textContent`);
  check('预告会跟着刷新', true, badAffinity);

  /* ---------- 3. 立项 ---------- */
  var moneyBefore = await evalJs(`GD.getState().money`);
  await evalJs(`document.querySelector('[data-act="go"]').click()`);
  await sleep(300);
  var started = await evalJs(`({
    phase: GD.getState().phase,
    money: GD.getState().money,
    progress: GD.getState().project.progress,
    bar: !!document.querySelector('#dev-bar'),
    active: document.querySelectorAll('.desk.active').length
  })`);
  check('立项后进入开发', started.phase === 'developing' && started.bar === true);
  check('立项扣了成本', moneyBefore - started.money === 130000, '$' + (moneyBefore - started.money));
  check('主创被高亮', started.active === 1, 'active=' + started.active);
  check('进度开始推进', started.progress > 0, 'p=' + started.progress.toFixed(3));

  /* ---------- 4. 事件 ---------- */
  await evalJs(`(() => { const s = GD.getState(); s.project.elapsed = s.project.duration * 0.46; })()`);
  await sleep(250);
  var eventShown = await evalJs(`({
    phase: GD.getState().phase,
    visible: !document.querySelector('#event').hidden,
    options: document.querySelectorAll('#event .choice').length,
    title: (document.querySelector('#event h3') || {}).textContent
  })`);
  check('45% 弹出事件', eventShown.phase === 'event' && eventShown.visible === true, eventShown.title);
  check('事件至少两个选项', eventShown.options >= 2, 'options=' + eventShown.options);

  await evalJs(`document.querySelector('#event .choice').click()`);
  await sleep(250);
  var afterEvent = await evalJs(`({ phase: GD.getState().phase, hidden: document.querySelector('#event').hidden, q: GD.getState().project.qualityPct })`);
  check('选择后继续开发', afterEvent.phase === 'developing' && afterEvent.hidden === true);

  /* ---------- 5. 评审 ---------- */
  await evalJs(`(() => { const s = GD.getState(); s.project.elapsed = s.project.duration * 1.2; })()`);
  await sleep(300);
  var reviewShown = await evalJs(`({
    phase: GD.getState().phase,
    visible: !document.querySelector('#review').hidden,
    critics: document.querySelectorAll('.critic').length
  })`);
  check('开发完成进入评审', reviewShown.phase === 'review' && reviewShown.visible === true);
  check('评审有 4 位', reviewShown.critics === 4);

  await sleep(1400);
  var revealed = await evalJs(`({
    shown: document.querySelectorAll('.critic.shown').length,
    scores: [...document.querySelectorAll('.critic-score')].map(e => e.textContent)
  })`);
  check('分数逐个亮起', revealed.shown >= 1, 'shown=' + revealed.shown + ' ' + revealed.scores.join(','));

  await evalJs(`(() => { const s = GD.getState(); s.timer = 4.0; })()`);
  await sleep(300);
  var allShown = await evalJs(`({ shown: document.querySelectorAll('.critic.shown').length })`);
  check('四位全部亮分', allShown.shown === 4, 'shown=' + allShown.shown);

  await evalJs(`(() => { const s = GD.getState(); s.timer = 5.4; })()`);
  await sleep(300);
  var totalShown = await evalJs(`({ text: document.querySelector('#rtotal').textContent, cls: document.querySelector('#rtotal').className })`);
  check('总分揭晓', /\d+ \/ 40/.test(totalShown.text), totalShown.text);

  /* ---------- 6. 销售 ---------- */
  await evalJs(`(() => { const s = GD.getState(); s.timer = 8; })()`);
  await sleep(300);
  var salesStart = await evalJs(`({ phase: GD.getState().phase, hasWeeks: !!document.querySelector('#weeks') })`);
  check('进入销售期', salesStart.phase === 'sales' && salesStart.hasWeeks === true);

  await sleep(2200);
  var salesMid = await evalJs(`({
    sold: GD.getState().sales.sold,
    copies: document.querySelector('#copies').textContent,
    weeks: document.querySelectorAll('.week').length,
    adEnabled: !document.querySelector('#adbtn').disabled
  })`);
  check('周销量在累计', salesMid.sold > 0 && salesMid.weeks >= 1, salesMid.copies + ' 份 / ' + salesMid.weeks + ' 周');
  check('广告按钮可用', salesMid.adEnabled === true);

  await evalJs(`document.querySelector('#adbtn').click()`);
  await sleep(200);
  var ad = await evalJs(`({ used: GD.getState().sales.adUsed, boost: GD.getState().sales.boost, disabled: document.querySelector('#adbtn').disabled })`);
  check('投放广告生效', ad.used === 1 && ad.disabled === true, 'boost=' + ad.boost);

  /* ---------- 7. 结算 ---------- */
  await evalJs(`(() => { const s = GD.getState(); s.timer = 100; })()`);
  await sleep(400);
  var done = await evalJs(`({
    phase: GD.getState().phase,
    score: (document.querySelector('.done-score') || {}).textContent,
    rows: document.querySelectorAll('.done-row').length,
    history: GD.getState().history.length
  })`);
  check('销售结束进入结算', done.phase === 'done' && done.rows === 3, done.score);

  await evalJs(`document.querySelector('[data-act="next"]').click()`);
  await sleep(300);
  var next = await evalJs(`({ phase: GD.getState().phase, round: GD.getState().round, chips: document.querySelectorAll('.chip').length })`);
  check('可以开始下一部', next.phase === 'planning' && next.round === 2 && next.chips === 13);

  /* ---------- 8. 音效开关 ---------- */
  await evalJs(`document.querySelector('#sound').click()`);
  await sleep(100);
  var sound = await evalJs(`({ muted: GD.SFX.isMuted(), icon: document.querySelector('#sound').textContent })`);
  check('音效可以静音', sound.muted === true, sound.icon);
  await evalJs(`document.querySelector('#sound').click()`);

  /* ---------- 9. 手机尺寸 ---------- */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
  var mobile = await evalJs(`(() => {
    const q = s => document.querySelector(s);
    const r = el => { const b = el.getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height) }; };
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      office: r(q('.office')), stage: r(q('#stage')),
      chipWrap: getComputedStyle(q('.chips')).flexWrap
    };
  })()`);
  check('手机端无横向溢出', mobile.overflow <= 0, 'overflow=' + mobile.overflow);
  check('手机端布局纵向排列', mobile.stage.y >= mobile.office.y + mobile.office.h - 2,
    'stage.y=' + mobile.stage.y + ' office.bottom=' + (mobile.office.y + mobile.office.h));
  check('选项会换行', mobile.chipWrap === 'wrap');

  await cdp.send('Emulation.clearDeviceMetricsOverride');

  /* ---------- 10. 错误 ---------- */
  check('无运行时错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  cdp.close();
  child.kill();
  await sleep(300);

  var failed = results.filter(function (r) { return !r.ok; });
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' 项通过');
  process.exit(failed.length ? 1 : 0);
})().catch(function (err) {
  console.error('E2E 失败:', err.message);
  process.exit(2);
});
