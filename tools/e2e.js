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

  /* ---------- 0. 创业宣言（新开局才有） ---------- */
  var dec = await evalJs(`(() => ({
    cards: document.querySelectorAll('[data-dec]').length,
    planChips: document.querySelectorAll('[data-plan]').length,
    money: GD.getState().money
  }))()`);
  check('开局先出现 4 个创业宣言', dec.cards === 4 && dec.planChips === 0,
    'cards=' + dec.cards + ' plan=' + dec.planChips);
  await evalJs(`document.querySelector('[data-dec="garage"]').click()`);
  await sleep(300);
  var decAfter = await evalJs(`(() => ({
    declaration: GD.getState().declaration,
    money: GD.getState().money,
    planChips: document.querySelectorAll('[data-plan]').length
  }))()`);
  check('选了车库苦干会发 15 万启动金',
    decAfter.declaration === 'garage' && decAfter.money - dec.money === 150000,
    '+' + (decAfter.money - dec.money));
  check('选完宣言后进入企划界面', decAfter.planChips > 0, 'plan=' + decAfter.planChips);

  /* ---------- 1. 首屏 ---------- */
  var first = await evalJs(`(() => {
    const q = s => document.querySelector(s);
    const r = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      desks: document.querySelectorAll('.desk').length,
      avatars: document.querySelectorAll('.avatar svg').length,
      genres: document.querySelectorAll('[data-plan^="genre:"]').length,
      themes: document.querySelectorAll('[data-plan^="theme:"]').length,
      leaders: document.querySelectorAll('[data-plan^="leader:"]').length,
      platforms: document.querySelectorAll('[data-plan^="platform:"]').length,
      platformCode: (document.querySelector('#platform') || {}).textContent || '',
      previews: document.querySelectorAll('.pv').length,
      phase: GD.getState().phase,
      money: GD.getState().money,
      stage: r(q('#stage')), office: r(q('.office'))
    };
  })()`);

  check('无横向溢出', first.overflow <= 0, 'overflow=' + first.overflow);
  check('办公室有 3 个人', first.desks === 3 && first.avatars === 3);
  check('企划有 5 类型 / 5 题材 / 3 主创',
    first.genres === 5 && first.themes === 5 && first.leaders === 3,
    first.genres + '/' + first.themes + '/' + first.leaders);
  check('1972 年只有街机一个平台',
    first.platforms === 1 && first.platformCode.indexOf('雅达瑞') === 0, first.platformCode);
  check('预告面板 7 项', first.previews === 7, 'pv=' + first.previews);
  check('初始进入企划阶段', first.phase === 'planning');
  check('舞台与办公室都有高度', first.stage.h > 200 && first.office.h > 120,
    'stage=' + first.stage.h + ' office=' + first.office.h);

  /* ---------- 1.2 像素办公室画布 ---------- */
  var scene = await evalJs(`(() => {
    const cv = document.getElementById('office-scene');
    if (!cv || !cv.getContext) return { ok: false };
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let sum = 0, sum2 = 0, n = 0;
    const colors = new Set();
    for (let i = 0; i < d.length; i += 4 * 7) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += L; sum2 += L * L; n++;
      colors.add((r >> 4) + ',' + (g >> 4) + ',' + (b >> 4));
    }
    const mean = sum / n;
    return {
      ok: true, w: cv.width, h: cv.height,
      mean: Math.round(mean),
      sd: Math.round(Math.sqrt(Math.max(0, sum2 / n - mean * mean))),
      colors: colors.size
    };
  })()`);
  check('办公室画布尺寸正常', scene.ok && scene.w > 40 && scene.h >= 30, 'w=' + scene.w + ' h=' + scene.h);
  check('办公室画面不是空白', scene.sd > 8 && scene.colors > 8,
    'sd=' + scene.sd + ' colors=' + scene.colors + ' mean=' + scene.mean);

  /* 时代切换之后画面必须真的换掉 */
  var eraShift = await evalJs(`(() => {
    const cv = document.getElementById('office-scene');
    const snap = () => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 4 * 11) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0;
      return h;
    };
    const st = GD.getState();
    const before = snap();
    const fake = {
      day: (2013 - GD.BAL.startYear) * GD.BAL.daysPerYear,
      phase: 'developing', seats: 3, staff: st.staff,
      plan: { leader: st.staff[0].id }
    };
    GD.Office.sync(fake); GD.Office.renderNow();
    const after = snap();
    GD.Office.sync(st); GD.Office.renderNow();
    return { changed: before !== after, before: before, after: after };
  })()`);
  check('时代切换会换掉办公室画面', eraShift.changed === true,
    eraShift.before + ' → ' + eraShift.after);

  /* ---------- 1.5 团队与作品集面板 ---------- */
  await evalJs(`document.querySelector('[data-act="team"]').click()`);
  await sleep(220);
  var team = await evalJs(`({
    open: !document.querySelector('#team').hidden,
    rows: document.querySelectorAll('#team .staff-row').length,
    cands: document.querySelectorAll('#team .cand').length,
    traits: document.querySelectorAll('#team .staff-row .trait').length,
    salary: (document.querySelector('#team .panel-sub') || {}).textContent || ''
  })`);
  check('团队面板显示 3 人', team.open === true && team.rows === 3, 'rows=' + team.rows);
  check('团队面板每人显示 2 个特质', team.traits === team.rows * 2, 'traits=' + team.traits);
  check('团队面板显示候选人', team.cands >= 1, 'cands=' + team.cands);
  check('团队面板显示日薪', team.salary.indexOf('日薪') > 0, team.salary);

  await evalJs(`document.querySelector('[data-act="close-panel"]').click()`);
  await sleep(150);
  check('团队面板可以关闭', await evalJs(`document.querySelector('#team').hidden`) === true);

  await evalJs(`document.querySelector('[data-act="archive"]').click()`);
  await sleep(150);
  var arch0 = await evalJs(`({ open: !document.querySelector('#archive').hidden, rows: document.querySelectorAll('#archive .arch-row').length })`);
  check('作品集初始为空', arch0.open === true && arch0.rows === 0);
  await evalJs(`document.querySelector('[data-act="close-panel"]').click()`);
  await sleep(150);

  await evalJs(`document.querySelector('[data-act="industry"]').click()`);
  await sleep(200);
  var ind = await evalJs(`({
    open: !document.querySelector('#industry').hidden,
    rivals: document.querySelectorAll('#industry .rival').length
  })`);
  check('行业面板显示竞争对手', ind.open === true && ind.rivals >= 5, 'rivals=' + ind.rivals);

  /* 挖人：把日历推到 1990，对手的员工作表应该出现 */
  var poachUI = await evalJs(`(function () {
    var s = GD.getState();
    var keep = { day: s.day, money: s.money };
    s.day = (1990 - GD.BAL.startYear) * GD.BAL.daysPerYear;
    s.money = 5000000;
    GD.UI.render();
    var crews = 0, btns = 0, acq = 0, name = '';
    if (document.querySelector('[data-act="industry"]')) {
      document.querySelector('[data-act="industry"]').click();
      crews = document.querySelectorAll('#industry .crew-row').length;
      btns = document.querySelectorAll('#industry [data-poach]').length;
      acq = document.querySelectorAll('#industry [data-acquire]').length;
      name = ((document.querySelector('#industry .crew-name') || {}).textContent || '').trim();
      document.querySelector('[data-act="close-panel"]').click();
    }
    s.day = keep.day;
    s.money = keep.money;
    GD.UI.render();
    return { crews: crews, btns: btns, acq: acq, name: name };
  })()`);
  check('行业面板显示对手的可挖员工',
    poachUI.crews >= 6 && poachUI.btns >= 6,
    '员工行=' + poachUI.crews + ' 按钮=' + poachUI.btns + ' 例=' + poachUI.name);
  check('行业面板提供整家收购入口', poachUI.acq >= 4, '收购按钮=' + poachUI.acq);

  /* 自研平台：2068 之后行业面板底部出现三组参数 */
  var mpUI = await evalJs(`(function () {
    var s = GD.getState();
    var keep = { day: s.day, money: s.money };
    s.day = (2068 - GD.BAL.startYear) * GD.BAL.daysPerYear;
    s.money = 50000000;
    GD.UI.render();
    document.querySelector('[data-act="industry"]').click();
    var picks = document.querySelectorAll('#industry .mp-pick').length;
    var opts = document.querySelectorAll('#industry [data-mpick]').length;
    var btn = document.querySelectorAll('#industry [data-act="launch-platform"]').length;
    var on = 0;
    var heavy = document.querySelector('#industry [data-mpick="budget:heavy"]');
    if (heavy) { heavy.click(); on = document.querySelectorAll('#industry .mp-opt.on').length; }
    document.querySelector('[data-act="close-panel"]').click();
    s.day = keep.day;
    s.money = keep.money;
    GD.UI.render();
    return { picks: picks, opts: opts, btn: btn, on: on };
  })()`);
  check('行业面板提供自研平台入口',
    mpUI.picks === 3 && mpUI.opts === 9 && mpUI.btn === 1,
    '参数组=' + mpUI.picks + ' 选项=' + mpUI.opts + ' 按钮=' + mpUI.btn);
  check('平台参数可以切换', mpUI.on >= 3, '选中=' + mpUI.on);

  await evalJs(`document.querySelector('[data-act="close-panel"]').click()`);
  await sleep(150);

  /* ---------- 1.9 研究面板 ---------- */
  await evalJs(`document.querySelector('[data-act="research"]').click()`);
  await sleep(220);
  var resPanel = await evalJs(`({
    open: !document.querySelector('#research').hidden,
    items: document.querySelectorAll('#research [data-research]').length,
    branches: document.querySelectorAll('#research .res-branch').length,
    done: document.querySelectorAll('#research .res-item.done').length
  })`);
  check('研究面板有 4 条支线 24 项',
    resPanel.open === true && resPanel.items === 24 && resPanel.branches === 4,
    'items=' + resPanel.items + ' branches=' + resPanel.branches);

  var moneyBeforeRes = await evalJs(`GD.getState().money`);
  await evalJs(`document.querySelector('#research [data-research]:not([disabled])').click()`);
  await sleep(250);
  var resRun = await evalJs(`(function () {
    var s = GD.getState();
    return {
      active: s.research.active ? s.research.active.id : null,
      running: document.querySelectorAll('#research .res-item.running').length,
      money: s.money
    };
  })()`);
  check('可以开始一项研究并扣钱',
    !!resRun.active && resRun.running === 1 && moneyBeforeRes - resRun.money > 0,
    'active=' + resRun.active + ' paid=' + (moneyBeforeRes - resRun.money));
  await evalJs(`document.querySelector('#research [data-act="close-panel"]').click()`);
  await sleep(150);

  /* ---------- 1.95 设备标签页 ---------- */
  await evalJs(`document.querySelector('[data-act="research"]').click()`);
  await sleep(200);
  await evalJs(`document.querySelector('#research [data-rtab="gear"]').click()`);
  await sleep(220);
  var gearPanel = await evalJs(`({
    items: document.querySelectorAll('#research [data-gear]').length,
    cats: document.querySelectorAll('#research .res-branch').length,
    tabOn: (document.querySelector('#research .tab.on') || {}).textContent || ''
  })`);
  check('设备页有 4 个品类 24 件',
    gearPanel.items === 24 && gearPanel.cats === 4 && gearPanel.tabOn === '设备',
    'items=' + gearPanel.items + ' cats=' + gearPanel.cats);

  var moneyBeforeGear = await evalJs(`GD.getState().money`);
  await evalJs(`document.querySelector('#research [data-gear="rug"]').click()`);
  await sleep(220);
  var gearBuy = await evalJs(`(function () {
    var s = GD.getState();
    var canvasErr = null;
    try { GD.Office.renderNow(); } catch (e) { canvasErr = String((e && e.message) || e); }
    return { owned: (s.furniture || []).length, money: s.money, canvasErr: canvasErr };
  })()`);
  check('可以买设备并扣钱',
    gearBuy.owned === 1 && moneyBeforeGear - gearBuy.money > 0,
    'owned=' + gearBuy.owned + ' paid=' + (moneyBeforeGear - gearBuy.money));
  check('买完设备办公室仍能正常渲染', gearBuy.canvasErr === null, gearBuy.canvasErr || 'ok');
  await evalJs(`document.querySelector('#research [data-act="close-panel"]').click()`);
  await sleep(150);

  /* ---------- 1.99 换平台立即生效 + 作品名 ---------- */
  var platSwitch = await evalJs(`(function () {
    var s = GD.getState();
    var keep = { day: s.day, plat: s.plan.platform, genre: s.plan.genre };
    s.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
    /* 改个类型把界面推到 1985 年再重建（顺手验证多平台列表） */
    s.plan.genre = (s.plan.genre === 'rpg' ? 'action' : 'rpg');
    GD.UI.render();
    var chips = Array.prototype.slice.call(document.querySelectorAll('[data-plan^="platform:"]'));
    var target = chips.filter(function (c) { return !c.classList.contains('on'); })[0];
    var picked = target ? target.textContent.trim() : '';
    if (target) target.click();
    var onNow = Array.prototype.slice.call(document.querySelectorAll('[data-plan^="platform:"]'))
      .filter(function (c) { return c.classList.contains('on'); })
      .map(function (c) { return c.textContent.trim(); }).join('|');
    var out = { count: chips.length, picked: picked, nowOn: onNow };
    s.day = keep.day;
    s.plan.platform = keep.plat;
    s.plan.genre = keep.genre;
    GD.UI.render();
    return out;
  })()`);
  check('换平台会立刻生效（不需要再点别的按钮）',
    platSwitch.count >= 2 && platSwitch.picked.length > 0 && platSwitch.nowOn === platSwitch.picked,
    '平台数=' + platSwitch.count + ' 点了=' + platSwitch.picked + ' 现在=' + platSwitch.nowOn);

  var nameTyped = await evalJs(`(function () {
    var inp = document.getElementById('plan-name');
    if (!inp) return { ok: false };
    inp.value = '星海列车';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true, name: GD.getState().plan.name };
  })()`);
  check('可以给作品起自定义名字',
    nameTyped.ok === true && nameTyped.name === '星海列车', String(nameTyped.name));

  /* ---------- 2. 选择类型/题材 ---------- */
  await evalJs(`document.querySelector('[data-plan="theme:modern"]').click()`);
  await sleep(200);
  var afterPick = await evalJs(`({ theme: GD.getState().plan.theme, on: document.querySelectorAll('.chip.on').length })`);
  check('点击题材会改变企划', afterPick.theme === 'modern' && afterPick.on === 4,
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
    cost: (document.querySelector('.dev-cost') || {}).textContent || '',
    title: (document.querySelector('.dev-name') || {}).textContent || '',
    active: document.querySelectorAll('.desk.active').length
  })`);
  check('立项后进入开发', started.phase === 'developing' && started.bar === true);
  check('开发界面显示自定义作品名', started.title.indexOf('星海列车') >= 0, started.title);
  check('每日成本显示的是数字不是 NaN', started.cost.indexOf('NaN') < 0 && /\d/.test(started.cost), started.cost);
  check('立项扣了平台授权费', moneyBefore - started.money >= 6000, 'paid ' + (moneyBefore - started.money));
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
  var next = await evalJs(`({ phase: GD.getState().phase, round: GD.getState().round, genres: document.querySelectorAll('[data-plan^="genre:"]').length })`);
  check('可以开始下一部', next.phase === 'planning' && next.round === 2 && next.genres === 5);

  /* ---------- 8.5 作品集与存档 ---------- */
  await evalJs(`document.querySelector('[data-act="archive"]').click()`);
  await sleep(200);
  var arch1 = await evalJs(`({ rows: document.querySelectorAll('#archive .arch-row').length, text: (document.querySelector('.arch-name') || {}).textContent || '' })`);
  check('作品集记录了这一部', arch1.rows === 1, arch1.text);
  check('作品集显示自定义作品名', arch1.text.indexOf('星海列车') >= 0, arch1.text);
  await evalJs(`document.querySelector('[data-act="close-panel"]').click()`);
  await sleep(150);

  var beforeReload = await evalJs(`({ round: GD.getState().round, money: Math.round(GD.getState().money), history: GD.getState().history.length })`);
  await cdp.send('Page.navigate', { url: URL });
  await waitFor(async function () {
    return await evalJs('document.readyState === "complete" && !!window.GD && !!GD.getState()');
  }, 15000, 'reload');
  await sleep(500);
  var afterReload = await evalJs(`({ round: GD.getState().round, money: Math.round(GD.getState().money), history: GD.getState().history.length })`);
  check('刷新后进度还在',
    afterReload.round === beforeReload.round && afterReload.history === beforeReload.history,
    JSON.stringify(afterReload) + ' vs ' + JSON.stringify(beforeReload));

  /* ---------- 8.6 离线结算 ---------- */
  await evalJs(`(() => {
    const rep = GD.Engine.offline(GD.getState(), 3600);
    GD.UI.showOffline(rep);
  })()`);
  await sleep(400);
  var off = await evalJs(`({
    open: !document.querySelector('#offline').hidden,
    text: (document.querySelector('#offline') || {}).textContent || ''
  })`);
  check('离线后弹出结算', off.open === true && off.text.indexOf('你不在的时候') >= 0,
    off.text.slice(0, 30));
  await evalJs(`document.querySelector('#offline [data-act="close-panel"]').click()`);
  await sleep(200);
  check('可以关闭离线报告', await evalJs(`document.querySelector('#offline').hidden`) === true);

  /* ---------- 9. 音量 / 音效开关 ---------- */
  var sound = await evalJs(`(function () {
    var el = document.querySelector('#sound');
    var startLevel = GD.SFX.level();
    var startIcon = el.textContent;
    for (var i = 0; i < 4 && !GD.SFX.isMuted(); i++) el.click();
    var muted = GD.SFX.isMuted();
    var mutedIcon = el.textContent;
    el.click();
    return { startLevel: startLevel, startIcon: startIcon, muted: muted, mutedIcon: mutedIcon, after: GD.SFX.level() };
  })()`);
  check('音量按钮是四档循环', sound.startLevel === 0, '初始档=' + sound.startLevel);
  check('循环到静音会显示 🔇', sound.muted === true && sound.mutedIcon === '🔇', sound.mutedIcon);
  check('静音后再点会回到第一档', sound.after === 0, 'level=' + sound.after);

  var audioApi = await evalJs(`({
    hasBgm: typeof GD.SFX.setBgm === 'function' && typeof GD.SFX.setEra === 'function',
    sfx: Object.keys(GD.SFX).filter(function (k) { return typeof GD.SFX[k] === 'function'; }).length
  })`);
  check('音频接口齐全（音效 + 循环 BGM）',
    audioApi.hasBgm === true && audioApi.sfx >= 30, 'api=' + audioApi.sfx);

  /* ---------- 9.5 窗口尺寸自适应 ---------- */
  async function sizeAt(w, h) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await sleep(420);
    return await evalJs(`(function () {
      var o = document.querySelector('.office').getBoundingClientRect();
      var st = document.querySelector('#stage').getBoundingClientRect();
      var cv = document.getElementById('office-scene');
      return {
        office: Math.round(o.height), stage: Math.round(st.height),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        canvasW: cv ? cv.width : 0
      };
    })()`);
  }
  var vTall = await sizeAt(1280, 1000);
  var vShort = await sizeAt(1280, 620);
  var vWide = await sizeAt(1920, 900);
  check('窗口变矮时办公室跟着变矮', vShort.office < vTall.office,
    vTall.office + 'px → ' + vShort.office + 'px');
  check('窗口变矮后舞台仍然可用', vShort.stage >= 120, 'stage=' + vShort.stage);
  check('超宽窗口不会横向溢出', vWide.overflow <= 0, 'overflow=' + vWide.overflow);
  check('超宽窗口下画布也跟着变宽', vWide.canvasW > vTall.canvasW,
    vTall.canvasW + ' → ' + vWide.canvasW);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(300);

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

  /* ---------- 年度奖项提示 ----------
   * 这条曾经是致命 bug：UI.toast 被调用但没实现，
   * 一结算年度奖项就抛异常，主循环冻死，刷新后 #stage 建不起来。 */
  var toastRes = await evalJs(`(function () {
    var s = GD.getState();
    var before = document.querySelectorAll('#toasts .toast').length;
    var err = null;
    s.yearResults.push({ year: 1972, playerScore: 33, winner: null });
    try { GD.UI.render(); } catch (e) { err = String((e && e.message) || e); }
    var after = document.querySelectorAll('#toasts .toast').length;
    s.yearResults.pop();
    return { before: before, after: after, err: err };
  })()`);
  check('年度结果会弹提示而不是抛异常', !toastRes.err && toastRes.after > toastRes.before,
    'toast ' + toastRes.before + '→' + toastRes.after + ' err=' + toastRes.err);

  /* ---------- 11. 错误 ---------- */
  check('无运行时错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  /* ---------- 12. 抗异常：一次推进异常不能冻死主循环 ---------- */
  var beforeRenders = await evalJs(`(function () {
    window.__renders = 0;
    var origRender = GD.UI.render;
    GD.UI.render = function () { window.__renders++; return origRender.apply(this, arguments); };
    window.__origTick = GD.Engine.tick;
    GD.Engine.tick = function () { throw new Error('注入的测试异常'); };
    return window.__renders;
  })()`);
  await sleep(800);
  var afterErr = await evalJs(`(function () {
    var el = document.getElementById('hint');
    return {
      renders: window.__renders,
      err: el.classList.contains('err'),
      text: (el.textContent || '').slice(0, 60)
    };
  })()`);
  check('注入异常后主循环仍在跑', afterErr.renders > beforeRenders + 2,
    beforeRenders + ' → ' + afterErr.renders);
  check('异常原因显示在底部提示条', afterErr.err && afterErr.text.indexOf('运行出错') >= 0, afterErr.text);

  /* 恢复引擎，确认能立刻接着跑 */
  var restored = await evalJs(`(function () {
    GD.Engine.tick = window.__origTick;
    try { GD.Engine.tick(GD.getState(), 0.01); return 'ok'; }
    catch (e) { return 'throw: ' + e.message; }
  })()`);
  check('恢复后引擎可正常推进', restored === 'ok', restored);

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
