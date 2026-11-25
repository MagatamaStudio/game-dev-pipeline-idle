/* ============================================================
 * tools/e2e.js —— 用 CDP 驱动无头 Edge 做冒烟测试
 * 检查真实布局、点击流程、存档往返，并收集控制台报错。
 * 用法：node tools/e2e.js
 * ============================================================ */
'use strict';

var { spawn } = require('child_process');
var path = require('path');
var fs = require('fs');

var ROOT = path.join(__dirname, '..');
var PORT = 9333;
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
    await sleep(120);
  }
  throw new Error('timeout: ' + label);
}

/* 极简 CDP 客户端 */
function connect(wsUrl) {
  return new Promise(function (resolve, reject) {
    var ws = new WebSocket(wsUrl);
    var id = 0;
    var pending = new Map();
    var listeners = [];

    ws.addEventListener('message', function (ev) {
      var msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        var p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
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
  var userDir = path.join(ROOT, 'shots', 'e2e-profile');
  fs.rmSync(userDir, { recursive: true, force: true });

  var child = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=' + PORT,
    '--remote-allow-origins=*',
    '--user-data-dir=' + userDir,
    '--window-size=1440,900',
    'about:blank'
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
  await cdp.send('Log.enable');

  async function evalJs(expr) {
    var res = await cdp.send('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error('eval failed: ' + (res.exceptionDetails.exception || {}).description + '\n' + expr);
    }
    return res.result.value;
  }

  async function load() {
    await cdp.send('Page.navigate', { url: URL });
    await waitFor(async function () {
      return await evalJs('document.readyState === "complete" && !!window.GD && !!window.GD.UI');
    }, 15000, 'page load');
    await sleep(400);
  }

  /* ---------- 1. 首次加载 ---------- */
  await load();
  await evalJs('localStorage.clear()');
  await load();

  var layout = await evalJs(`(() => {
    const r = el => { const b = el.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)}; };
    const q = s => document.querySelector(s);
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      topbar: r(q('.topbar')),
      pipeline: r(q('#pipeline')),
      shop: r(q('#shop')),
      goalbar: r(q('.goalbar')),
      cols: document.querySelectorAll('.stage-col').length,
      chips: document.querySelectorAll('.chip').length,
      money: q('#money').textContent,
      modalOpen: !q('#modal').hidden,
      modalTitle: q('#modal-title').textContent,
      era: document.body.getAttribute('data-era'),
      advanceDisabled: q('#btn-advance').disabled,
      burstDisabled: q('#btn-burst').disabled
    };
  })()`);

  check('页面无横向溢出', layout.overflow <= 0, 'overflow=' + layout.overflow + 'px');
  check('顶栏有高度', layout.topbar.h > 40, JSON.stringify(layout.topbar));
  check('主区域填满视口', layout.pipeline.h > 300, JSON.stringify(layout.pipeline));
  check('商店在右侧', layout.shop.x >= layout.pipeline.w - 5, 'shop.x=' + layout.shop.x + ' pipeline.w=' + layout.pipeline.w);
  check('底部目标栏可见', layout.goalbar.y + layout.goalbar.h <= 901, JSON.stringify(layout.goalbar));
  check('首时代有 2 个部门', layout.cols === 2, 'cols=' + layout.cols);
  check('生成了在制项目', layout.chips >= 1, 'chips=' + layout.chips);
  check('新游戏弹出时代介绍', layout.modalOpen === true, layout.modalTitle);
  check('目标未完成时按钮禁用', layout.advanceDisabled === true);

  /* ---------- 2. 关闭弹窗 + 灵感迸发 ---------- */
  await evalJs(`document.querySelector('#modal-actions button').click()`);
  await sleep(150);
  var closed = await evalJs(`document.querySelector('#modal').hidden`);
  check('弹窗可以关闭', closed === true);

  await evalJs(`document.querySelector('#btn-burst').click()`);
  await sleep(150);
  var burst = await evalJs(`({
    firing: document.querySelector('#btn-burst').classList.contains('firing'),
    sub: document.querySelector('#burst-sub').textContent,
    until: GD.getState().burstUntil
  })`);
  check('灵感迸发生效', burst.firing === true && burst.until > 0, burst.sub);

  /* ---------- 3. 购买流程 ---------- */
  await evalJs(`GD.getState().money = 100000; GD.UI.render()`);
  var before = await evalJs(`({ money: GD.getState().money, workers: GD.getState().workers.concept })`);
  await evalJs(`document.querySelector('[data-buy="worker"][data-id="concept"]').click()`);
  await sleep(120);
  var after = await evalJs(`({ money: GD.getState().money, workers: GD.getState().workers.concept, shown: document.querySelector('.dept-count').textContent })`);
  check('点击雇佣增加员工并扣钱',
    after.workers === before.workers + 1 && after.money < before.money,
    before.workers + '→' + after.workers + ', $' + Math.round(before.money) + '→$' + Math.round(after.money));

  /* ---------- 4. 切换页签 ---------- */
  await evalJs(`document.querySelector('[data-tab="tech"]').click()`);
  await sleep(120);
  var tech = await evalJs(`({
    rows: document.querySelectorAll('#shop-body .row').length,
    buttons: document.querySelectorAll('#shop-body [data-buy]').length,
    affordable: document.querySelectorAll('#shop-body .buy.affordable').length
  })`);
  check('技术页签渲染工具', tech.buttons >= 3, JSON.stringify(tech));

  await evalJs(`document.querySelector('[data-tab="legacy"]').click()`);
  await sleep(120);
  var legacy = await evalJs(`document.querySelectorAll('#shop-body .legacy-card').length`);
  check('传承页签渲染升级项', legacy === 4, 'cards=' + legacy);

  /* ---------- 5. 通胀到时代目标并推进 ---------- */
  await evalJs(`document.querySelector('[data-tab="team"]').click()`);
  await evalJs(`GD.getState().eraReleases = GD.ERAS[GD.getState().era].goal.releases; GD.UI.render()`);
  await sleep(150);
  var goalUi = await evalJs(`({
    disabled: document.querySelector('#btn-advance').disabled,
    text: document.querySelector('#btn-advance').textContent,
    legacy: GD.getState().legacy
  })`);
  check('达成目标后按钮可用', goalUi.disabled === false, goalUi.text);

  await evalJs(`document.querySelector('#btn-advance').click()`);
  await sleep(250);
  var advanced = await evalJs(`({
    era: GD.getState().era,
    dataEra: document.body.getAttribute('data-era'),
    year: document.querySelector('#era-year').textContent,
    name: document.querySelector('#era-name').textContent,
    legacy: GD.getState().legacy,
    legGain: document.querySelector('#modal-body').textContent.indexOf('传承点') >= 0,
    cols: document.querySelectorAll('.stage-col').length,
    lineCol: document.querySelectorAll('.line-col').length,
    modalOpen: !document.querySelector('#modal').hidden,
    workers: Object.keys(GD.getState().workers).length
  })`);
  check('推进到下一个时代', advanced.era === 1 && advanced.dataEra === '1', advanced.year + ' ' + advanced.name);
  check('获得传承点', advanced.legacy > 0, 'legacy=' + advanced.legacy);
  check('新时代表现介绍了传承', advanced.legGain === true);
  check('1985 出现出厂产线列', advanced.cols === 5 && advanced.lineCol === 1,
    'cols=' + advanced.cols + ' lineCol=' + advanced.lineCol);

  /* ---------- 6. 存档往返 ---------- */
  await evalJs(`document.querySelector('#modal-actions button').click()`);
  await sleep(100);
  var savedSnapshot = await evalJs(`(() => { const s = GD.getState(); s.money = 4321; GD.Engine.serialize(s); localStorage.setItem(GD.SAVE_KEY, GD.Engine.serialize(s)); return { era: s.era, money: s.money, workers: s.workers }; })()`);
  await load();
  var reloaded = await evalJs(`({
    era: GD.getState().era,
    money: GD.getState().money,
    workers: GD.getState().workers,
    year: document.querySelector('#era-year').textContent
  })`);
  check('刷新后读档成功', reloaded.era === savedSnapshot.era && Math.abs(reloaded.money - 4321) < 1,
    'era=' + reloaded.era + ' money=' + Math.round(reloaded.money));

  /* ---------- 7. 1985 卡带产线 ---------- */
  await evalJs(`document.querySelector('[data-tab="tech"]').click()`);
  await sleep(150);
  var lineUi = await evalJs(`(() => {
    const btn = document.querySelector('[data-buy="line"]');
    return { exists: !!btn, text: btn ? btn.textContent : '', disabled: btn ? btn.disabled : true };
  })()`);
  check('技术页有卡带产线升级', lineUi.exists === true, lineUi.text);

  await evalJs(`GD.getState().money = 5000; GD.UI.render()`);
  var lvBefore = await evalJs(`GD.getState().lineLv`);
  await evalJs(`document.querySelector('[data-buy="line"]').click()`);
  await sleep(150);
  var lvAfter = await evalJs(`({ lv: GD.getState().lineLv, rate: GD.Engine.lineRate(GD.getState()), col: document.querySelector('.line-col .cap').textContent })`);
  check('可以升级产线并提速', lvAfter.lv === lvBefore + 1, lvBefore + ' → ' + lvAfter.lv);
  check('产出列显示新节拍', lvAfter.col.indexOf('s') > 0, lvAfter.col);

  /* ---------- 8. 1995 外包 ---------- */
  var uid = await evalJs(`(() => {
    const s = GD.getState();
    s.era = 2; s.cycle = 1;
    GD.Engine.initEra(s);
    s.money = 100000;
    s.projects[0].stage = 1;
    s.projects[0].progress = 0;
    GD.UI.rebuild(); GD.UI.render();
    return s.projects[0].uid;
  })()`);
  await sleep(250);

  var outUi = await evalJs(`(() => {
    const btns = [...document.querySelectorAll('[data-outsource]')];
    return {
      count: btns.length,
      enabled: btns.filter(b => !b.disabled).length,
      labels: btns.map(b => b.textContent.trim()),
      money: GD.getState().money
    };
  })()`);
  check('1995 每个部门都有外包按钮', outUi.count === 5, 'count=' + outUi.count);
  check('有积压的部门才能外包', outUi.enabled === 1, JSON.stringify(outUi.labels));

  await evalJs(`document.querySelector('[data-outsource="code"]').click()`);
  await sleep(250);
  var outAfter = await evalJs(`(() => {
    const s = GD.getState();
    const p = s.projects.filter(x => x.uid === ${uid})[0];
    return { money: s.money, stage: p ? p.stage : -1, toasts: document.querySelectorAll('.toast').length };
  })()`);
  check('外包后项目进入下一部门', outAfter.stage === 2, 'stage=' + outAfter.stage);
  check('外包扣了钱', outAfter.money < 100000, '$' + Math.round(outAfter.money));
  check('外包有提示', outAfter.toasts > 0, 'toasts=' + outAfter.toasts);

  /* ---------- 9. 长时间运行不崩 ---------- */
  var t0 = await evalJs(`({ time: GD.getState().time, p: (GD.getState().projects[0]||{}).progress || 0 })`);
  await sleep(1500);
  var t1 = await evalJs(`({ time: GD.getState().time, p: (GD.getState().projects[0]||{}).progress || 0, chips: document.querySelectorAll('.chip').length })`);
  check('主循环在推进', t1.time > t0.time + 1 && t1.p >= t0.p,
    'time ' + t0.time.toFixed(1) + '→' + t1.time.toFixed(1) + ', progress ' + t0.p.toFixed(1) + '→' + t1.p.toFixed(1));

  /* ---------- 8. 后期时代布局 ---------- */
  await evalJs(`(() => { const s = GD.getState(); s.era = 5; s.cycle = 3; GD.Engine.initEra(s); GD.UI.rebuild(); })()`);
  await sleep(400);
  var late = await evalJs(`(() => {
    const q = s => document.querySelector(s);
    const r = el => { const b = el.getBoundingClientRect(); return {x:Math.round(b.x),w:Math.round(b.width),h:Math.round(b.height)}; };
    return {
      cols: document.querySelectorAll('.stage-col').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pipelineScroll: q('#pipeline-cols').scrollWidth - q('#pipeline-cols').clientWidth,
      minCol: Math.min(...[...document.querySelectorAll('.stage-col')].map(c => r(c).w)),
      year: q('#era-year').textContent,
      cycle: q('#era-cycle').textContent,
      money: q('#money').textContent
    };
  })()`);
  check('第六时代 5 个部门', late.cols === 5, 'cols=' + late.cols);
  check('第六时代无页面溢出', late.overflow <= 0, 'overflow=' + late.overflow);
  check('第六时代流水线不挤压', late.minCol >= 150, 'minCol=' + late.minCol);
  check('轮次显示正确', late.cycle.indexOf('3') >= 0, late.cycle);

  /* ---------- 9. 手机尺寸 ---------- */
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true
  });
  await sleep(500);
  var mobile = await evalJs(`(() => {
    const q = s => document.querySelector(s);
    const r = el => { const b = el.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)}; };
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pipeline: r(q('#pipeline')),
      shop: r(q('#shop')),
      topbarH: r(q('.topbar')).h,
      moneySize: parseFloat(getComputedStyle(q('#money')).fontSize)
    };
  })()`);
  check('手机端无横向溢出', mobile.overflow <= 0, 'overflow=' + mobile.overflow);
  check('手机端商店在流水线下方', mobile.shop.y >= mobile.pipeline.y + mobile.pipeline.h - 2,
    'shop.y=' + mobile.shop.y + ' pipeline.bottom=' + (mobile.pipeline.y + mobile.pipeline.h));
  check('手机端顶栏可换行', mobile.topbarH >= 50, 'h=' + mobile.topbarH);

  await cdp.send('Emulation.clearDeviceMetricsOverride');

  /* ---------- 10. 可见性与触控尺寸 ---------- */
  var audit = await evalJs(`(() => {
    const small = [...document.querySelectorAll('#shop-body button, .topbar button, #btn-advance')]
      .map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 8), h: Math.round(r.height), w: Math.round(r.width) }; })
      .filter(x => x.h > 0 && x.h < 26);
    const hidden = ['.topbar', '#pipeline', '#shop', '.goalbar', '#money', '#btn-burst']
      .filter(s => { const e = document.querySelector(s); if (!e) return true; const r = e.getBoundingClientRect(); return r.width < 1 || r.height < 1; });
    const chipOverflow = [...document.querySelectorAll('.chips')].filter(c => c.scrollWidth > c.clientWidth + 2).length;
    return { small, hidden, chipOverflow, moneySize: getComputedStyle(document.querySelector('#money')).fontSize };
  })()`);
  check('按钮触控高度足够', audit.small.length === 0, JSON.stringify(audit.small.slice(0, 3)));
  check('关键区域均可见', audit.hidden.length === 0, audit.hidden.join(','));
  check('项目卡片不溢出部门列', audit.chipOverflow === 0, 'overflowCols=' + audit.chipOverflow);

  /* ---------- 11. 错误检查 ---------- */
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
