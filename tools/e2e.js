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
      stage: r(q('#stage')), office: r(q('.office'))
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
  check('立项扣了平台授权费', moneyBefore - started.money >= 15000, '$' + (moneyBefore - started.money));
  check('主创被高亮', started.active === 1, 'active=' + started.active);
  check('进度开始推进', started.progress > 0, 'p=' + started.progress.toFixed(3));

  /* ---------- 4. 开发档位与烧钱 ---------- */
  var modes = await evalJs(`({
    count: document.querySelectorAll('#modes [data-mode]').length,
    on: document.querySelector('#modes .on') ? document.querySelector('#modes .on').getAttribute('data-mode') : null,
    phase: (document.querySelector('#dev-phase') || {}).textContent || '',
    q: (document.querySelector('#dev-q') || {}).textContent || ''
  })`);
  check('开发有三档速度', modes.count === 3 && modes.on === 'normal', JSON.stringify(modes));
  check('显示阶段与实时品质', modes.phase.length > 0 && modes.q.indexOf('品质') === 0,
    modes.phase + ' / ' + modes.q);

  var forecast = await evalJs(`({
    date: (document.querySelector('#dev-date') || {}).textContent || '',
    win: (document.querySelector('#dev-window') || {}).textContent || ''
  })`);
  check('开发期显示预计发售日', forecast.date.length > 0 && forecast.win.length > 0,
    forecast.date + ' / ' + forecast.win);

  var m1 = await evalJs(`GD.getState().money`);
  await sleep(1600);
  var m2 = await evalJs(`GD.getState().money`);
  check('开发中钱在烧', m2 < m1, '$' + Math.round(m1 - m2) + ' / 1.6 秒');

  await evalJs(`document.querySelector('[data-mode="crunch"]').click()`);
  await sleep(400);
  var mode = await evalJs(`({
    mode: GD.getState().project.mode,
    on: document.querySelector('#modes .on').getAttribute('data-mode'),
    lines: document.querySelectorAll('#devlog .line').length
  })`);
  check('可以切到赶工', mode.mode === 'crunch' && mode.on === 'crunch');

  await evalJs(`(() => { const s = GD.getState(); if (s.phase === 'developing') s.project.progress = 0.2; })()`);
  await sleep(300);
  var logCount = await evalJs(`({ lines: document.querySelectorAll('#devlog .line').length, text: (document.querySelector('#devlog .line') || {}).textContent || '' })`);
  check('开发日志在滚动', logCount.lines > 0, logCount.text.slice(0, 20));

  var micro = await evalJs(`({
    visible: !document.querySelector('#micro').hidden,
    text: (document.querySelector('.micro-text') || {}).textContent || '',
    btns: document.querySelectorAll('[data-micro]').length
  })`);
  check('出现小决定', micro.visible === true && micro.btns >= 1, micro.text);

  if (micro.visible) {
    await evalJs(`document.querySelector('[data-micro="0"]').click()`);
    await sleep(250);
    var microAfter = await evalJs(`({ hidden: document.querySelector('#micro').hidden })`);
    check('小决定可以处理', microAfter.hidden === true);
  }

  /* ---------- 5. 事件 ---------- */
  await evalJs(`(() => { const s = GD.getState(); s.project.progress = 0.31; })()`);
  await sleep(250);
  var eventShown = await evalJs(`({
    phase: GD.getState().phase,
    visible: !document.querySelector('#event').hidden,
    options: document.querySelectorAll('#event .choice').length,
    title: (document.querySelector('#event h3') || {}).textContent
  })`);
  check('30% 弹出第一个事件', eventShown.phase === 'event' && eventShown.visible === true, eventShown.title);
  check('事件至少两个选项', eventShown.options >= 2, 'options=' + eventShown.options);

  await evalJs(`document.querySelector('#event .choice').click()`);
  await sleep(250);
  var afterEvent = await evalJs(`({ phase: GD.getState().phase, hidden: document.querySelector('#event').hidden })`);
  check('选择后继续开发', afterEvent.phase === 'developing' && afterEvent.hidden === true);

  /* ---------- 6. 评审 ---------- */
  await evalJs(`(() => { const s = GD.getState(); s.project.progress = 1.2; })()`);
  await sleep(350);
  var reviewShown = await evalJs(`({
    phase: GD.getState().phase,
    visible: !document.querySelector('#review').hidden,
    critics: document.querySelectorAll('.critic').length
  })`);
  check('开发完成进入评审', reviewShown.phase === 'review' && reviewShown.visible === true);
  check('评审有 4 位', reviewShown.critics === 4);

  await sleep(1400);
  var revealed = await evalJs(`({ shown: document.querySelectorAll('.critic.shown').length })`);
  check('分数逐个亮起', revealed.shown >= 1, 'shown=' + revealed.shown);

  await evalJs(`(() => { const s = GD.getState(); s.timer = 4.0; })()`);
  await sleep(300);
  var allShown = await evalJs(`({ shown: document.querySelectorAll('.critic.shown').length })`);
  check('四位全部亮分', allShown.shown === 4, 'shown=' + allShown.shown);

  await evalJs(`(() => { const s = GD.getState(); s.timer = 5.4; })()`);
  await sleep(300);
  var totalShown = await evalJs(`({ text: document.querySelector('#rtotal').textContent })`);
  check('总分揭晓', /\d+ \/ 40/.test(totalShown.text), totalShown.text);

  /* ---------- 7. 发售决策 ---------- */
  await evalJs(`(() => { const s = GD.getState(); s.timer = 8; })()`);
  await sleep(350);
  var rel = await evalJs(`({
    phase: GD.getState().phase,
    cards: document.querySelectorAll('.rel-card').length,
    now: (document.querySelector('[data-act="release-now"] .rel-win') || {}).textContent || '',
    hold: (document.querySelector('[data-act="release-hold"] .rel-win') || {}).textContent || ''
  })`);
  check('评审后进入发售决策', rel.phase === 'release' && rel.cards === 2, rel.now);
  check('两个选项都带档期信息', rel.now.indexOf('×') >= 0 && rel.hold.indexOf('×') >= 0,
    rel.now + ' / ' + rel.hold);

  await evalJs(`document.querySelector('[data-act="release-now"]').click()`);
  await sleep(300);
  var salesStart = await evalJs(`({
    phase: GD.getState().phase,
    hasWeeks: !!document.querySelector('#weeks'),
    badge: !!document.querySelector('.sales-window')
  })`);
  check('进入销售期', salesStart.phase === 'sales' && salesStart.hasWeeks === true);
  check('销售期显示档期', salesStart.badge === true);

  await sleep(2300);
  var salesMid = await evalJs(`({
    sold: GD.getState().sales.sold,
    weeks: document.querySelectorAll('.week').length,
    adEnabled: !document.querySelector('#adbtn').disabled
  })`);
  check('周销量在累计', salesMid.sold > 0 && salesMid.weeks >= 1, salesMid.weeks + ' 周');
  check('广告按钮可用', salesMid.adEnabled === true);

  await evalJs(`document.querySelector('#adbtn').click()`);
  await sleep(200);
  var ad = await evalJs(`({ used: GD.getState().sales.adUsed, boost: GD.getState().sales.boost, disabled: document.querySelector('#adbtn').disabled })`);
  check('投放广告生效', ad.used === 1 && ad.disabled === true, 'boost=' + ad.boost);

  /* ---------- 8. 结算 ---------- */
  await evalJs(`(() => { const s = GD.getState(); s.timer = 100; })()`);
  await sleep(400);
  var done = await evalJs(`({
    phase: GD.getState().phase,
    rows: document.querySelectorAll('.done-row').length,
    hasProfit: !!document.querySelector('.done-row b.good, .done-row b.bad'),
    history: GD.getState().history.length
  })`);
  check('销售结束进入结算', done.phase === 'done' && done.rows === 6, 'rows=' + done.rows);
  check('结算显示利润', done.hasProfit === true);

  await evalJs(`document.querySelector('[data-act="next"]').click()`);
  await sleep(300);
  var next = await evalJs(`({ phase: GD.getState().phase, round: GD.getState().round, chips: document.querySelectorAll('.chip').length })`);
  check('可以开始下一部', next.phase === 'planning' && next.round === 2 && next.chips === 13);

  /* ---------- 9. 音效开关 ---------- */
  await evalJs(`document.querySelector('#sound').click()`);
  await sleep(100);
  var sound = await evalJs(`({ muted: GD.SFX.isMuted(), icon: document.querySelector('#sound').textContent })`);
  check('音效可以静音', sound.muted === true, sound.icon);
  await evalJs(`document.querySelector('#sound').click()`);

  /* ---------- 10. 手机尺寸 ---------- */
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

  /* ---------- 11. 错误 ---------- */
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
