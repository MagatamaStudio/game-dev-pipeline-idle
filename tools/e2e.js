/* ============================================================
 * tools/e2e.js —— M0 浏览器冒烟测试（CDP 驱动无头 Edge）
 * 用法：node tools/e2e.js [url]
 * ============================================================ */
'use strict';

var { spawn } = require('child_process');
var os = require('os');
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
  /* Edge profile 放系统临时目录：以前放 shots/ 里，跑几次就堆几百 MB */
  var userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gws-e2e-'));
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
      rep: (document.querySelector('#rep') || {}).textContent || '',
      stage: r(q('#stage')), office: r(q('.office'))
    };
  })()`);

  check('无横向溢出', first.overflow <= 0, 'overflow=' + first.overflow);
  check('顶栏显示声望', first.rep === '0', first.rep);
  check('办公室有 3 个人', first.desks === 3 && first.avatars === 3);
  check('企划有 10 类型 / 10 题材 / 3 主创',
    first.genres === 10 && first.themes === 10 && first.leaders === 3,
    first.genres + '/' + first.themes + '/' + first.leaders);
  check('1972 年只有街机一个平台',
    first.platforms === 1 && first.platformCode.indexOf('雅达瑞') === 0, first.platformCode);
  check('预告面板 9 项（含规模与趋势）', first.previews >= 9, 'pv=' + first.previews);
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

  /* ---------- 1.55 办公室：车库 → 街边 ---------- */
  var room0 = await evalJs(`({
    name: (document.querySelector('#team .room-head b') || {}).textContent || '',
    desc: (document.querySelector('#team .room-desc') || {}).textContent || '',
    next: (document.querySelector('#team .room-next b') || {}).textContent || '',
    seats: GD.getState().seats
  })`);
  check('团队面板显示当前办公室', room0.name === '车库' && room0.desc.length > 4,
    room0.name + ' / ' + room0.desc);
  check('团队面板显示下一间办公室', room0.next.indexOf('街边') >= 0, room0.next);

  var moved = await evalJs(`(() => {
    GD.getState().money = 5000000;
    document.querySelector('#team [data-act="expand"]').click();
    const st = GD.getState();
    return {
      seats: st.seats,
      name: (document.querySelector('#team .room-head b') || {}).textContent || '',
      toast: [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | ')
    };
  })()`);
  check('能搬进街边二层', moved.seats === 4 && moved.name === '街边二层',
    moved.name + ' seats=' + moved.seats);
  check('搬家会弹提示', moved.toast.indexOf('搬进') >= 0, moved.toast);

  /* ---------- 1.56 士气 / 体力 ---------- */
  var moodUI = await evalJs(`(() => {
    const rows = document.querySelectorAll('#team .staff-row');
    const bars = document.querySelectorAll('#team .mood-bar');
    return {
      rows: rows.length,
      bars: bars.length,
      tags: [...document.querySelectorAll('#team .mood-tag')].map(x => x.textContent),
      buildBtn: (document.querySelector('#team [data-act="teambuild"]') || {}).textContent || ''
    };
  })()`);
  check('每人显示士气与体力', moodUI.bars === moodUI.rows * 2, 'bars=' + moodUI.bars);
  check('每人有状态标签', moodUI.tags.length === moodUI.rows, moodUI.tags.join(','));
  check('团队面板有团建按钮', moodUI.buildBtn.indexOf('团建') >= 0, moodUI.buildBtn);

  var built = await evalJs(`(() => {
    const st = GD.getState();
    st.money = 5000000;
    const before = Math.round(GD.Engine.moraleOf(st.staff[0]));
    document.querySelector('#team [data-act="teambuild"]').click();
    return {
      before: before,
      after: Math.round(GD.Engine.moraleOf(st.staff[0])),
      btn: (document.querySelector('#team [data-act="teambuild"]') || {}).textContent || '',
      toast: [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | ')
    };
  })()`);
  check('团建能涨士气', built.after > built.before, built.before + ' → ' + built.after);
  check('一轮只能团建一次', built.btn.indexOf('已经') >= 0 && built.toast.indexOf('团建') >= 0,
    built.btn + ' / ' + built.toast);

  var tiredUI = await evalJs(`(() => {
    const st = GD.getState();
    st.staff[0].stamina = 8;
    document.querySelector('[data-act="close-panel"]').click();
    document.querySelector('[data-act="team"]').click();
    return {
      tags: [...document.querySelectorAll('#team .mood-tag')].map(x => x.textContent),
      low: document.querySelectorAll('#team .mood-tag.low').length
    };
  })()`);
  check('体力见底会显示疲劳', tiredUI.tags.indexOf('疲劳') >= 0 && tiredUI.low >= 1,
    tiredUI.tags.join(','));

  /* 解雇 */
  var fired = await evalJs(`(() => {
    const st = GD.getState();
    st.money = 5000000;
    const before = st.staff.length;
    const btn = document.querySelector('#team [data-fire]');
    const id = btn ? btn.getAttribute('data-fire') : '';
    if (btn) btn.click();
    return {
      before: before,
      after: GD.getState().staff.length,
      rows: document.querySelectorAll('#team .staff-row').length,
      gone: !GD.getState().staff.some(x => x.id === id),
      toast: [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | ')
    };
  })()`);
  check('能解雇员工', fired.after === fired.before - 1 && fired.gone === true,
    fired.before + ' → ' + fired.after);
  check('解雇后列表跟着少一行', fired.rows === fired.after, 'rows=' + fired.rows);
  check('解雇会弹提示', fired.toast.indexOf('遣散费') >= 0, fired.toast);

  await evalJs(`document.querySelector('[data-act="close-panel"]').click()`);
  await sleep(150);
  check('团队面板可以关闭', await evalJs(`document.querySelector('#team').hidden`) === true);

  /* ---------- 1.57 市场流行 ---------- */
  var trendUI = await evalJs(`(() => {
    const st = GD.getState();
    const yr = GD.Engine.year(st);
    const t = GD.Engine.trendFor(yr);
    const hotChips = [...document.querySelectorAll('.chips .chip.hot')];
    const bars = document.querySelector('#stage .trend-bar');
    const pvLabels = [...document.querySelectorAll('#stage .preview .pv label')].map(x => x.textContent);
    return {
      bar: !!bars,
      barText: bars ? bars.textContent : '',
      hot: hotChips.length,
      hotGenres: document.querySelectorAll('[data-plan^="genre:"].hot').length,
      hotThemes: document.querySelectorAll('[data-plan^="theme:"].hot').length,
      wantGenre: GD.Engine.trendIsHotGenre(yr, st.plan.genre) ? 1 : 0,
      previewLabels: pvLabels,
      trend: GD.Engine.trendSalesMul(yr, st.plan.genre, st.plan.theme)
    };
  })()`);
  check('企划顶部显示今年热门', trendUI.bar === true && trendUI.barText.indexOf('今年热门') >= 0,
    trendUI.barText);
  check('热门题材 chip 带「热」标', trendUI.hotThemes <= 2 && trendUI.hot === trendUI.hotThemes + trendUI.hotGenres,
    'themes=' + trendUI.hotThemes + ' all=' + trendUI.hot);
  check('热门类型 chip 带「热」标', trendUI.hotGenres === 1, 'genres=' + trendUI.hotGenres);
  check('预览显示趋势倍率', trendUI.previewLabels.indexOf('趋势') >= 0,
    trendUI.previewLabels.join(','));

  var trendToast = await evalJs(`(() => {
    const st = GD.getState();
    st.day += 360;
    GD.UI.render();
    return [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | ');
  })()`);
  check('换年会提示新热门', trendToast.indexOf('年热门') >= 0, trendToast);

  /* 怀旧潮：每 12 年一次，1984 起 */
  var nostUI = await evalJs(`(() => {
    const st = GD.getState();
    const keep = st.day;
    st.day = 12 * 360;
    GD.UI.render();
    const bar = document.querySelector('#stage .nost-bar');
    const toast = [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | ');
    st.day = keep;
    GD.UI.render();
    return { year: GD.Engine.year({ day: 12 * 360 }), hasBar: !!bar,
             text: bar ? bar.textContent : '', toast: toast };
  })()`);
  check('怀旧潮有专属提示条', nostUI.hasBar === true && nostUI.text.indexOf('怀旧潮') >= 0,
    nostUI.text);
  check('怀旧潮开始时弹提示', nostUI.toast.indexOf('怀旧潮') >= 0, nostUI.toast);

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

  /* ---------- 1.99 自定时代（2075 之后） ---------- */
  var ceUI = await evalJs(`(function () {
    var s = GD.getState();
    var keepDay = s.day, keepInf = s.influence, keepRules = s.customRules, keepOffer = s.customOffer;
    var out = {};
    var seen = [];
    var origToast = GD.UI.toast;
    GD.UI.toast = function (t) { seen.push(t); return origToast.call(GD.UI, t); };
    try {
      s.day = (2085 - GD.BAL.startYear) * GD.BAL.daysPerYear;
      s.influence = 200;
      s.customRules = []; s.customOffer = null;
      document.querySelector('[data-act="industry"]').click();
      out.open = !document.querySelector('#industry').hidden;
      out.cards = document.querySelectorAll('#industry [data-custom]').length;
      out.sub = (document.querySelector('#industry .panel-sub') || {}).textContent || '';
      out.code = (document.querySelector('#industry .ce-code') || {}).textContent || '';
      out.eff = (document.querySelector('#industry .ce-eff') || {}).textContent || '';
      out.reroll = !!document.querySelector('#industry [data-act="custom-reroll"]');
      out.random = !!document.querySelector('#industry [data-act="custom-random"]');
      GD.UI.render();
      out.toast = seen.join(' | ');
    } catch (e) { out.err = String((e && e.message) || e); }
    GD.UI.toast = origToast;
    s.day = keepDay; s.influence = keepInf; s.customRules = keepRules; s.customOffer = keepOffer;
    document.querySelector('#industry [data-act="close-panel"]').click();
    GD.UI.render();
    return out;
  })()`);
  check('自定时代面板能打开', !ceUI.err && ceUI.open === true, ceUI.err || 'ok');
  check('给出 3 张规则卡', ceUI.cards === 3, 'cards=' + ceUI.cards);
  check('卡片有代号和效果说明', /^[A-Z]{2}-\d+$/.test(ceUI.code || '') && (ceUI.eff || '').length > 0,
    ceUI.code + ' / ' + ceUI.eff);
  check('行业面板顶部显示影响力', (ceUI.sub || '').indexOf('影响力') >= 0, ceUI.sub);
  check('有重抽与随机按钮', ceUI.reroll === true && ceUI.random === true);
  check('换代会弹提示', (ceUI.toast || '').indexOf('自定时代') >= 0, ceUI.toast);

  /* 选卡真的生效 */
  var cePick = await evalJs(`(function () {
    var s = GD.getState();
    var keepDay = s.day, keepInf = s.influence, keepRules = s.customRules, keepOffer = s.customOffer;
    var out = {};
    var seen = [];
    var origToast = GD.UI.toast;
    GD.UI.toast = function (t) { seen.push(t); return origToast.call(GD.UI, t); };
    try {
      s.day = (2085 - GD.BAL.startYear) * GD.BAL.daysPerYear;
      s.influence = 200;
      s.customRules = []; s.customOffer = null;
      document.querySelector('[data-act="industry"]').click();
      var inf0 = s.influence;
      document.querySelector('#industry [data-custom="0"]').click();
      out.used = inf0 - s.influence;
      out.pickCost = GD.CUSTOM.pickCost;
      out.rules = (s.customRules || []).length;
      out.name = (s.customRules[0] || {}).name || '';
      out.stillPending = GD.Engine.customPendingFrom(s) !== null;
      out.toast = seen.join(' | ');
    } catch (e) { out.err = String((e && e.message) || e); }
    GD.UI.toast = origToast;
    s.day = keepDay; s.influence = keepInf; s.customRules = keepRules; s.customOffer = keepOffer;
    document.querySelector('#industry [data-act="close-panel"]').click();
    GD.UI.render();
    return out;
  })()`);
  check('选卡扣影响力', !cePick.err && cePick.used === cePick.pickCost, 'used=' + cePick.used);
  check('选卡后规则生效', cePick.rules === 1 && cePick.name.length > 0, cePick.name);
  check('选卡后不再待选', cePick.stillPending === false);
  check('选卡会弹提示', (cePick.toast || '').indexOf('自定规则生效') >= 0, cePick.toast);

  /* ---------- 1.995 自研平台倒闭 + 子品牌买回 ---------- */
  var mpUI2 = await evalJs(`(function () {
    var s = GD.getState();
    var keepDay = s.day, keepMoney = s.money, keepFans = s.fans, keepRep = s.rep;
    var keepMp = s.myPlatform, keepCrashes = s.platformCrashes, keepCrashed = s.crashedPlatforms;
    var out = {};
    try {
      s.day = (2068 - GD.BAL.startYear) * GD.BAL.daysPerYear;
      s.money = 1e8; s.fans = 6e5; s.rep = 95;
      s.myPlatform = null; s.platformCrashes = 0; s.crashedPlatforms = [];
      var lr = GD.Engine.launchPlatform(s, { budget: 'normal', price: 'mid', cut: 'lure' });
      out.launched = lr.ok === true;
      var crashed = false;
      for (var i = 0; i < 8 && !crashed; i++) {
        s.day += GD.BAL.daysPerYear;
        var ev = GD.Engine.tickPlatform(s);
        if (ev && ev.crashed) crashed = true;
      }
      out.crashed = crashed;
      out.noPlatform = s.myPlatform === null;
      out.crashes = s.platformCrashes || 0;
      document.querySelector('[data-act="industry"]').click();
      out.panelOk = !document.querySelector('#industry').hidden;
      out.noMpBlock = document.querySelector('#industry .mp-status') === null;
      document.querySelector('#industry [data-act="close-panel"]').click();
    } catch (e) { out.err = String((e && e.message) || e); }
    s.day = keepDay; s.money = keepMoney; s.fans = keepFans; s.rep = keepRep;
    s.myPlatform = keepMp; s.platformCrashes = keepCrashes; s.crashedPlatforms = keepCrashed;
    GD.UI.render();
    return out;
  })()`);
  check('低抽成平台会在界面里倒闭', !mpUI2.err && mpUI2.launched === true && mpUI2.crashed === true,
    mpUI2.err || ('launched=' + mpUI2.launched + ' crashed=' + mpUI2.crashed));
  check('倒闭后平台位清空', mpUI2.noPlatform === true && mpUI2.crashes === 1,
    'crashes=' + mpUI2.crashes);
  check('倒闭后行业面板正常', mpUI2.panelOk === true && mpUI2.noMpBlock === true);

  /* 平台健康度显示 */
  var mpHealth = await evalJs(`(function () {
    var s = GD.getState();
    var keepDay = s.day, keepMp = s.myPlatform, keepMoney = s.money, keepFans = s.fans, keepRep = s.rep;
    var out = {};
    try {
      s.day = (2068 - GD.BAL.startYear) * GD.BAL.daysPerYear;
      s.money = 1e8; s.fans = 6e5; s.rep = 95; s.myPlatform = null;
      GD.Engine.launchPlatform(s, { budget: 'normal', price: 'mid', cut: 'normal' });
      s.day += GD.BAL.daysPerYear;
      GD.Engine.tickPlatform(s);
      document.querySelector('[data-act="industry"]').click();
      out.rowText = (document.querySelector('#industry .mp-status') || {}).textContent || '';
      out.warn = document.querySelectorAll('#industry .mp-warn').length;
      document.querySelector('#industry [data-act="close-panel"]').click();
    } catch (e) { out.err = String((e && e.message) || e); }
    s.day = keepDay; s.myPlatform = keepMp; s.money = keepMoney;
    s.fans = keepFans; s.rep = keepRep;
    GD.UI.render();
    return out;
  })()`);
  check('平台面板显示维护费与净收益',
    !mpHealth.err && mpHealth.rowText.indexOf('维护费') >= 0 && mpHealth.rowText.indexOf('净') >= 0,
    mpHealth.err || mpHealth.rowText);
  check('正常配置不会报警', mpHealth.warn === 0, 'warn=' + mpHealth.warn);

  /* 买回脱离的子公司 */
  var bbUI = await evalJs(`(function () {
    var s = GD.getState();
    var keepDay = s.day, keepMoney = s.money, keepFans = s.fans;
    var keepBrands = s.brands, keepLost = s.lostBrands, keepPhase = s.phase;
    var keepRivals = s.rivals.map(function (r) { return r.acquired; });
    var out = {};
    try {
      s.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
      s.money = 1e9; s.fans = 6e5;
      s.brands = []; s.lostBrands = [];
      GD.Engine.acquire(s, 'white');
      s.phase = 'bankrupt';
      GD.Engine.newCompany(s, 'makemoney');
      s.money = 1e9;
      document.querySelector('[data-act="industry"]').click();
      out.lostTag = document.querySelectorAll('#industry .lost-tag').length;
      var btn = document.querySelector('#industry [data-buyback]');
      out.hasBtn = !!btn;
      out.btnText = btn ? btn.textContent : '';
      var money0 = s.money;
      var seen = [];
      var origToast = GD.UI.toast;
      GD.UI.toast = function (t) { seen.push(t); return origToast.call(GD.UI, t); };
      try { if (btn) btn.click(); } finally { GD.UI.toast = origToast; }
      out.owned = GD.Engine.isAcquired(s, 'white');
      out.spent = money0 - s.money;
      out.lostLeft = (s.lostBrands || []).length;
      out.toast = seen.join(' | ');
      document.querySelector('#industry [data-act="close-panel"]').click();
    } catch (e) { out.err = String((e && e.message) || e); }
    s.day = keepDay; s.money = keepMoney; s.fans = keepFans;
    s.brands = keepBrands; s.lostBrands = keepLost; s.phase = keepPhase;
    s.rivals.forEach(function (r, i) { r.acquired = keepRivals[i]; });
    GD.UI.render();
    return out;
  })()`);
  check('脱离的子公司在行业面板有标记', !bbUI.err && bbUI.lostTag >= 1, bbUI.err || ('tag=' + bbUI.lostTag));
  check('有买回按钮且写明价格',
    bbUI.hasBtn === true && (bbUI.btnText || '').indexOf('买回') >= 0, bbUI.btnText);
  check('点买回真的收回来了', bbUI.owned === true && bbUI.lostLeft === 0,
    'owned=' + bbUI.owned + ' left=' + bbUI.lostLeft);
  check('买回扣钱并弹提示',
    bbUI.spent > 0 && (bbUI.toast || '').indexOf('买回') >= 0, 'spent=' + bbUI.spent + ' / ' + bbUI.toast);

  /* ---------- 1.996 对手合作（联合开发） ---------- */
  var coopUI = await evalJs(`(function () {
    var s = GD.getState();
    var keepDay = s.day, keepMoney = s.money;
    var out = {};
    try {
      s.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
      s.money = 1e7;
      s.phase = 'planning';
      s.plan.coop = null;
      GD.UI.render();
      out.chips = document.querySelectorAll('#stage [data-plan^="coop:"]').length;
      out.selfOn = document.querySelectorAll('#stage [data-plan="coop:"].on').length;
      out.label = [].map.call(document.querySelectorAll('#stage .plan-label-hint'),
        function (x) { return x.textContent; }).join(' | ');

      /* 选一家对手，看预览里的联合开发行 */
      var btn = document.querySelector('#stage [data-plan^="coop:"]:not([data-plan="coop:"])');
      out.pick = btn ? btn.getAttribute('data-plan') : '';
      if (btn) btn.click();
      out.planCoop = s.plan.coop;
      out.previewText = [].map.call(document.querySelectorAll('#stage .preview .pv'),
        function (x) { return x.textContent; }).join(' | ');
      out.coopOn = document.querySelectorAll('#stage [data-plan^="coop:"].on').length;
    } catch (e) { out.err = String((e && e.message) || e); }
    s.day = keepDay; s.money = keepMoney; s.plan.coop = null;
    GD.UI.render();
    return out;
  })()`);
  check('企划里有联合开发选项', !coopUI.err && coopUI.chips >= 4 && coopUI.selfOn === 1,
    coopUI.err || ('chips=' + coopUI.chips + ' selfOn=' + coopUI.selfOn));
  check('联合开发写明分成代价', (coopUI.label || '').indexOf('分走') >= 0, coopUI.label);
  check('能选中一家对手合作',
    (coopUI.pick || '').indexOf('coop:') === 0 && coopUI.pick !== 'coop:' && !!coopUI.planCoop,
    coopUI.pick + ' → ' + coopUI.planCoop);
  check('预览里显示联合开发效果',
    (coopUI.previewText || '').indexOf('联合开发') >= 0 &&
    (coopUI.previewText || '').indexOf('分成') >= 0, coopUI.previewText);
  check('选中的合作方高亮', coopUI.coopOn === 1, 'coopOn=' + coopUI.coopOn);

  /* ---------- 1.997 规模 / 办公室 6 级 / 培训 ---------- */
  var scaleUI = await evalJs(`(function () {
    var s = GD.getState();
    var keepDay = s.day, keepScale = s.plan.scale;
    var out = {};
    try {
      s.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
      s.phase = 'planning';
      s.plan.scale = 'mid';
      GD.UI.render();
      out.chips = document.querySelectorAll('#stage [data-plan^="scale:"]').length;
      out.midOn = document.querySelectorAll('#stage [data-plan="scale:mid"].on').length;
      var large = document.querySelector('#stage [data-plan="scale:large"]');
      if (large) large.click();
      out.picked = s.plan.scale;
      out.preview = [].map.call(document.querySelectorAll('#stage .preview .pv'),
        function (x) { return x.textContent; }).join(' | ');
    } catch (e) { out.err = String((e && e.message) || e); }
    s.day = keepDay; s.plan.scale = keepScale;
    GD.UI.render();
    return out;
  })()`);
  check('企划里有 3 档规模', !scaleUI.err && scaleUI.chips === 3 && scaleUI.midOn === 1,
    scaleUI.err || ('chips=' + scaleUI.chips + ' midOn=' + scaleUI.midOn));
  check('能选中大型', scaleUI.picked === 'large', String(scaleUI.picked));
  check('预览里显示规模与倍率',
    (scaleUI.preview || '').indexOf('规模') >= 0 && (scaleUI.preview || '').indexOf('成本 ×') >= 0,
    scaleUI.preview);

  var officeUI = await evalJs(`(function () {
    var s = GD.getState();
    var keepSeats = s.seats, keepMoney = s.money;
    var out = {};
    try {
      s.money = 1e9;
      var before = GD.Engine.officeLevel(s);
      var moved = 0;
      while (GD.Engine.expandOffice(s) && moved++ < 10) { }
      out.from = before;
      out.to = GD.Engine.officeLevel(s);
      out.room = GD.Engine.room(s).name;
      out.rooms = GD.ROOMS.length;
    } catch (e) { out.err = String((e && e.message) || e); }
    s.seats = keepSeats; s.money = keepMoney;
    GD.UI.render();
    return out;
  })()`);
  check('办公室能一路搬到第 8 个工位',
    !officeUI.err && officeUI.to >= 8 && officeUI.rooms === 6,
    officeUI.err || ('level=' + officeUI.from + '→' + officeUI.to + ' room=' + officeUI.room));

  var trainUI = await evalJs(`(function () {
    var s = GD.getState();
    var keepMoney = s.money, keepTrain = s.trainRound, keepPhase = s.phase;
    var out = {};
    var seen = [];
    var origToast = GD.UI.toast;
    GD.UI.toast = function (t) { seen.push(t); return origToast.call(GD.UI, t); };
    try {
      s.money = 1e7; s.phase = 'planning'; s.trainRound = {};
      document.querySelector('[data-act="team"]').click();
      var btns = document.querySelectorAll('#team [data-train]');
      out.btns = btns.length;
      out.label = btns[0] ? btns[0].textContent : '';
      var before = s.staff[0].stats[s.staff[0].role];
      var money0 = s.money;
      if (btns[0]) btns[0].click();
      out.after = s.staff[0].stats[s.staff[0].role];
      out.spent = money0 - s.money;
      out.disabled = document.querySelectorAll('#team [data-train]:disabled').length;
      out.toast = seen.join(' | ');
      document.querySelector('#team [data-act="close-panel"]').click();
    } catch (e) { out.err = String((e && e.message) || e); }
    GD.UI.toast = origToast;
    s.money = keepMoney; s.trainRound = keepTrain; s.phase = keepPhase;
    GD.UI.render();
    return out;
  })()`);
  check('团队面板每人有培训按钮', !trainUI.err && trainUI.btns >= 3 && (trainUI.label || '').indexOf('培训') >= 0,
    trainUI.err || ('btns=' + trainUI.btns + ' ' + trainUI.label));
  check('点培训真的涨属性', (trainUI.after || 0) > (trainUI.before || 0) || trainUI.after > 0,
    trainUI.before + ' → ' + trainUI.after);
  check('培训扣钱并弹提示',
    trainUI.spent > 0 && (trainUI.toast || '').indexOf('特训') >= 0,
    'spent=' + trainUI.spent + ' / ' + trainUI.toast);
  check('练完后按钮置灰', trainUI.disabled >= 1, 'disabled=' + trainUI.disabled);

  /* ---------- 1.9 研究面板 ---------- */
  await evalJs(`document.querySelector('[data-act="research"]').click()`);
  await sleep(220);
  var resPanel = await evalJs(`({
    open: !document.querySelector('#research').hidden,
    items: document.querySelectorAll('#research [data-research]').length,
    branches: document.querySelectorAll('#research .res-branch').length,
    done: document.querySelectorAll('#research .res-item.done').length,
    locked: document.querySelectorAll('#research .res-item.locked').length,
    lockedMeta: [...document.querySelectorAll('#research .res-item.locked .res-meta')]
      .slice(0, 2).map(x => x.textContent)
  })`);
  check('研究面板有 4 条支线 48 项',
    resPanel.open === true && resPanel.items === 48 && resPanel.branches === 4,
    'items=' + resPanel.items + ' branches=' + resPanel.branches);
  check('1972 年有 24 项还没到年份', resPanel.locked === 24, 'locked=' + resPanel.locked);
  check('未到年份的项显示开放年份',
    resPanel.lockedMeta.every(function (t) { return /\d{4} 年起/.test(t); }),
    resPanel.lockedMeta.join(' / '));

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
    rooms: document.querySelectorAll('#research [data-room]').length,
    cats: document.querySelectorAll('#research .res-branch').length,
    locked: document.querySelectorAll('#research .res-item.locked').length,
    officeHead: (document.querySelector('#research .res-branch-head') || {}).textContent || '',
    tabOn: (document.querySelector('#research .tab.on') || {}).textContent || ''
  })`);
  check('设备页有 4 个品类 48 件 + 办公室 6 级',
    gearPanel.items === 48 && gearPanel.rooms === 6 && gearPanel.cats === 5 && gearPanel.tabOn === '设备',
    'items=' + gearPanel.items + ' rooms=' + gearPanel.rooms + ' cats=' + gearPanel.cats);
  check('办公室排在最前面', gearPanel.officeHead.indexOf('办公室') >= 0, gearPanel.officeHead);
  check('未到年份的设备也灰着', gearPanel.locked >= 20, 'locked=' + gearPanel.locked);

  /* 设备页里直接搬办公室 */
  var roomBuy = await evalJs(`(function () {
    var s = GD.getState();
    s.money = 5000000;
    var before = s.seats;
    var btn = [...document.querySelectorAll('#research [data-room]')]
      .find(b => !b.disabled);
    var key = btn ? btn.getAttribute('data-room') : '';
    if (btn) btn.click();
    return {
      key: key,
      before: before,
      seats: s.seats,
      room: GD.Engine.room(s).name,
      toast: [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | ')
    };
  })()`);
  check('设备页能买办公室', roomBuy.key !== '' && roomBuy.seats === roomBuy.before + 1,
    roomBuy.before + ' → ' + roomBuy.seats + ' · ' + roomBuy.room);
  check('搬家会弹提示', roomBuy.toast.indexOf('搬进') >= 0, roomBuy.toast);

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
  /* 题材现在要先解锁，所以挑一个当前类型下已经开放的题材来点 */
  var themePick = await evalJs(`(() => {
    const st = GD.getState();
    const before = st.plan.theme;
    const open = GD.Engine.comboThemes(st, st.plan.genre).filter(id => id !== before);
    const target = open[0];
    document.querySelector('[data-plan="theme:' + target + '"]').click();
    return { before: before, target: target };
  })()`);
  await sleep(200);
  var afterPick = await evalJs(`({ theme: GD.getState().plan.theme, on: document.querySelectorAll('.chip.on').length,
    platOn: document.querySelectorAll('#stage [data-plan^="platform:"].on').length,
    coopOn: document.querySelectorAll('#stage [data-plan^="coop:"].on').length })`);
  check('点击题材会改变企划', afterPick.theme === themePick.target && afterPick.platOn === 1 &&
    afterPick.coopOn === 1,
    themePick.before + ' → theme=' + afterPick.theme + ' on=' + afterPick.on +
    ' plat=' + afterPick.platOn + ' coop=' + afterPick.coopOn);

  /* ---------- 2.5 怎么玩（帮助）面板 ---------- */
  var helpUI = await evalJs(`(function () {
    var out = {};
    try {
      document.querySelector('[data-act="help"]').click();
      out.open = !document.querySelector('#help').hidden;
      out.rows = document.querySelectorAll('#help .help-row').length;
      out.text = (document.querySelector('#help') || {}).textContent || '';
    } catch (e) { out.err = String((e && e.message) || e); }
    return out;
  })()`);
  check('帮助面板能打开', !helpUI.err && helpUI.open === true,
    helpUI.err || 'ok');
  check('帮助面板讲清了五个步骤与提示', helpUI.rows >= 8,
    'rows=' + helpUI.rows);
  check('帮助面板提到首部免授权费',
    (helpUI.text || '').indexOf('免授权费') >= 0, helpUI.text.slice(0, 60));
  /* 无障碍：图标按钮有 aria-label，帮助面板里能切慢速提示 */
  var a11y = await evalJs(`(function () {
    var out = {};
    try {
      out.iconLabels = ['theme', 'sound', 'helpbtn'].filter(function (id) {
        var b = document.getElementById(id);
        return b && b.getAttribute('aria-label');
      }).length;
      var slow = document.querySelector('#help [data-act="slow-toast"]');
      out.hasSlow = !!slow;
      var before = localStorage.getItem('garageStudio.slowToast');
      if (slow) slow.click();
      out.after = localStorage.getItem('garageStudio.slowToast');
      out.label = (document.querySelector('#help [data-act="slow-toast"]') || {}).textContent || '';
      if (out.after !== before) { var again = document.querySelector('#help [data-act="slow-toast"]'); if (again) again.click(); }
    } catch (e) { out.err = String((e && e.message) || e); }
    return out;
  })()`);
  check('图标按钮都有 aria-label', !a11y.err && a11y.iconLabels === 3,
    a11y.err || ('labels=' + a11y.iconLabels));
  check('帮助面板里有慢速提示开关', a11y.hasSlow === true);
  check('开关会写进本地存储并改标签',
    a11y.after === '1' || a11y.after === '0', 'after=' + a11y.after + ' label=' + a11y.label);

  await evalJs(`document.querySelector('#help [data-act="close-panel"]').click()`);
  await sleep(120);
  check('帮助面板可以关闭', await evalJs(`document.querySelector('#help').hidden`) === true);

  /* ---------- 2.6 发售期决策 ---------- */
  var seUI = await evalJs(`(function () {
    var out = {};
    var s = GD.getState();
    var keepPhase = s.phase, keepSales = s.sales;
    try {
      s.phase = 'sales';
      s.sales = { index: 2, total: 100000, sold: 20000, revenue: 500000, adUsed: 0,
        eventsDone: 0, pending: null, log: [], boost: 1, weeks: [], eventCost: 0 };
      s.project = { coop: null, cost: 100000 };
      GD.Engine.salesEventDue(s);
      GD.UI.render();
      out.cardAfter = document.querySelectorAll('#sales-event .se-card').length;
      out.opts = document.querySelectorAll('#sales-event .se-opt').length;
      out.name = (document.querySelector('#sales-event .se-name') || {}).textContent || '';
      s.money = 1e7;
      var btn = document.querySelector('#sales-event .se-opt');
      var before = s.money;
      if (btn) btn.click();
      out.picked = s.sales.pending === null;
      out.logged = (s.sales.log || []).length;
      out.spent = before - s.money;
      out.stillThere = document.querySelectorAll('#sales-event .se-card').length;
    } catch (e) { out.err = String((e && e.message) || e); }
    s.phase = keepPhase; s.sales = keepSales;
    GD.UI.render();
    return out;
  })()`);
  check('发售期会弹决策卡', !seUI.err && seUI.cardAfter === 1 && seUI.opts >= 2,
    seUI.err || ('card=' + seUI.cardAfter + ' opts=' + seUI.opts + ' name=' + seUI.name));
  check('决策卡能选择并记账',
    seUI.picked === true && seUI.logged === 1 && seUI.stillThere === 0,
    'picked=' + seUI.picked + ' log=' + seUI.logged + ' spent=' + seUI.spent);

  /* ---------- 2.7 帮助浮层不能再被压在底层 / 销售期不能死锁 ---------- */
  var helpLayer = await evalJs(`(function () {
    var out = {};
    try {
      document.querySelector('[data-act="help"]').click();
      var el = document.getElementById('help');
      var cs = getComputedStyle(el);
      out.position = cs.position;
      out.zIndex = cs.zIndex;
      out.shown = !el.hidden;
      out.fillsViewport = el.getBoundingClientRect().width > window.innerWidth * 0.9;
      document.querySelector('#help [data-act="close-panel"]').click();
    } catch (e) { out.err = String((e && e.message) || e); }
    return out;
  })()`);
  check('帮助浮层是独立的全屏浮层', !helpLayer.err && helpLayer.shown === true &&
    helpLayer.position === 'fixed' && helpLayer.fillsViewport === true,
    helpLayer.err || ('position=' + helpLayer.position + ' z=' + helpLayer.zIndex +
      ' fills=' + helpLayer.fillsViewport));
  check('帮助浮层层级够高', Number(helpLayer.zIndex) >= 50, 'z=' + helpLayer.zIndex);

  var noLock = await evalJs(`(function () {
    var out = {};
    try {
      /* 在克隆状态上测：别把当前存档推进坏了 */
      var clone = JSON.parse(JSON.stringify(GD.getState()));
      clone.phase = 'sales';
      clone.sales = { index: 2, total: 100000, sold: 0, revenue: 0, adUsed: 0, eventsDone: 0,
        eventWeeks: [], pendingWait: 0, log: [], boost: 1, weeks: [], eventCost: 0,
        pending: { week: 3, name: '卡死测试', desc: '', options: [
          { label: '贵', cost: 9999999, boost: 1.5 },
          { label: '便宜', cost: 0, boost: 1.1 }
        ] } };
      clone.money = 1000;
      clone.project = { coop: null, cost: 1 };
      var ticks = 0;
      while (clone.sales && clone.sales.pending && ticks++ < 4000) GD.Engine.tick(clone, 1 / 30);
      out.resolved = !clone.sales.pending;
      out.picked = (clone.sales.log || []).map(function (x) { return x.choice; }).join(',');
      out.ticks = ticks;
    } catch (e) { out.err = String((e && e.message) || e); }
    return out;
  })()`);

  check('待选事件不会永久卡死', !noLock.err && noLock.resolved === true,
    noLock.err || ('picked=' + noLock.picked));

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
  /* 首部作品免授权费：这里只该扣工资，不该扣授权费 */
  check('首部作品不扣授权费',
    moneyBefore - started.money < 6000 && moneyBefore - started.money >= 0,
    'paid ' + (moneyBefore - started.money));
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
  check('可以开始下一部', next.phase === 'planning' && next.round === 2 && next.genres === 10);

  /* ---------- 8.4 组合收藏：企划界面 ---------- */
  var lockUI = await evalJs(`(() => {
    const st = GD.getState();
    const chips = [...document.querySelectorAll('[data-plan^="theme:"]')];
    const locked = chips.filter(c => c.disabled);
    const open = chips.filter(c => !c.disabled);
    return {
      total: chips.length,
      open: open.length,
      expectOpen: GD.Engine.comboThemes(st, st.plan.genre).length,
      locked: locked.length,
      lockedLook: locked.every(c => c.classList.contains('lock')
        && c.querySelector('.ci').textContent === '🔒'),
      hint: (document.querySelector('.plan-label-hint') || {}).textContent || '',
      combos: GD.Engine.comboCount(st)
    };
  })()`);
  check('题材一定显示 10 个', lockUI.total === 10, String(lockUI.total));
  check('已解锁题材数 = 该类型解锁数', lockUI.open === lockUI.expectOpen,
    lockUI.open + ' vs ' + lockUI.expectOpen);
  check('没解锁的题材都带锁', lockUI.locked === 10 - lockUI.open && lockUI.lockedLook === true,
    'locked=' + lockUI.locked);
  check('题材标题显示已解锁进度', lockUI.hint.indexOf('已解锁') >= 0, lockUI.hint);
  check('玩过一部之后组合比开局多', lockUI.combos > 20, String(lockUI.combos));

  var lockClick = await evalJs(`(() => {
    const chip = [...document.querySelectorAll('[data-plan^="theme:"]')].find(c => c.disabled);
    const t0 = GD.getState().plan.theme;
    chip.click();
    return { same: GD.getState().plan.theme === t0, had: !!chip };
  })()`);
  check('点锁着的题材不会改企划', lockClick.had === true && lockClick.same === true);

  var snapUI = await evalJs(`(() => {
    document.querySelector('[data-plan="genre:rhythm"]').click();
    const st = GD.getState();
    return {
      genre: st.plan.genre,
      theme: st.plan.theme,
      ok: GD.Engine.comboUnlocked(st, st.plan.genre, st.plan.theme),
      open: [...document.querySelectorAll('[data-plan^="theme:"]')].filter(c => !c.disabled).length
    };
  })()`);
  check('换类型后题材自动落到已解锁的',
    snapUI.genre === 'rhythm' && snapUI.ok === true && snapUI.open > 0, JSON.stringify(snapUI));
  await evalJs(`document.querySelector('[data-plan="genre:rpg"]').click()`);
  await sleep(150);

  /* ---------- 8.45 续作 ---------- */
  var seqUI = await evalJs(`(() => {
    const st = GD.getState();
    st.history[0].copies = 120000;
    /* 点同类型不会触发重建，先切走再切回来 */
    document.querySelector('[data-plan="genre:rhythm"]').click();
    document.querySelector('[data-plan="genre:rpg"]').click();
    const chips = [...document.querySelectorAll('[data-plan^="sequel:"]')];
    return {
      chips: chips.length,
      labels: chips.map(c => c.textContent),
      hasNew: chips.some(c => c.getAttribute('data-plan') === 'sequel:')
    };
  })()`);
  check('企划里出现续作组', seqUI.chips >= 2 && seqUI.hasNew === true, seqUI.labels.join(' / '));

  var seqPick = await evalJs(`(() => {
    const chip = [...document.querySelectorAll('[data-plan^="sequel:"]')]
      .find(c => c.getAttribute('data-plan') !== 'sequel:');
    chip.click();
    const st = GD.getState();
    const pv = [...document.querySelectorAll('.preview .pv')].map(p => p.textContent).join(' | ');
    return {
      sequel: st.plan.sequel,
      genre: st.plan.genre,
      theme: st.plan.theme,
      preview: pv,
      placeholder: (document.getElementById('plan-name') || {}).placeholder || '',
      engineOk: !!GD.Engine.planSequel(st)
    };
  })()`);
  check('选续作会记住它', String(seqPick.sequel) === '0' && seqPick.engineOk === true,
    String(seqPick.sequel));
  check('续作会切回原作的类型', seqPick.genre === 'rpg', seqPick.genre);
  check('预览里显示续作与销量加成',
    seqPick.preview.indexOf('续作') >= 0 && seqPick.preview.indexOf('销量 ×') >= 0, seqPick.preview);
  check('作品名占位符带系列编号', / 2$/.test(seqPick.placeholder), seqPick.placeholder);

  /* 清掉续作，别影响后面的流程 */
  await evalJs(`(() => {
    GD.getState().plan.sequel = null;
    document.querySelector('[data-plan="genre:rpg"]').click();
  })()`);
  await sleep(150);

  /* ---------- 8.5 作品集与存档 ---------- */
  await evalJs(`document.querySelector('[data-act="archive"]').click()`);
  await sleep(200);
  var arch1 = await evalJs(`({ rows: document.querySelectorAll('#archive .arch-row').length, text: (document.querySelector('.arch-name') || {}).textContent || '' })`);
  check('作品集记录了这一部', arch1.rows === 1, arch1.text);
  check('作品集显示自定义作品名', arch1.text.indexOf('星海列车') >= 0, arch1.text);

  /* ---------- 8.5b 组合收藏：作品集面板 ---------- */
  var cmUI = await evalJs(`(() => {
    /* 组合收藏现在在第二个页签里，先切过去 */
    const comboBtn = document.querySelector('#archive [data-atab="combo"]');
    if (comboBtn) comboBtn.click();
    const box = document.querySelector('#archive .cm-box');
    const cells = [...document.querySelectorAll('#archive .cm-cell')]
      .filter(c => !c.closest('.cm-legend'));
    const st = GD.getState();
    return {
      box: !!box,
      rows: document.querySelectorAll('#archive .cm-row').length,
      cells: cells.length,
      unlocked: cells.filter(c => !c.classList.contains('lock')).length,
      locked: cells.filter(c => c.classList.contains('lock')).length,
      combos: GD.Engine.comboCount(st),
      stat: (document.querySelector('#archive .cm-stat') || {}).textContent || '',
      legend: document.querySelectorAll('#archive .cm-cell.won').length
    };
  })()`);
  check('作品集里有组合收藏面板', cmUI.box === true);
  check('收藏是 10 类型 x 10 题材', cmUI.rows === 11 && cmUI.cells === 100,
    'rows=' + cmUI.rows + ' cells=' + cmUI.cells);
  check('收藏格数与实际解锁一致', cmUI.unlocked === cmUI.combos,
    cmUI.unlocked + ' vs ' + cmUI.combos);
  check('未解锁的格子占多数', cmUI.locked === 100 - cmUI.combos, 'locked=' + cmUI.locked);
  check('收藏表头显示已解锁 / 王牌', cmUI.stat.indexOf('已解锁') >= 0 && cmUI.stat.indexOf('王牌') >= 0,
    cmUI.stat);
  /* 作品集页签：作品 / 组合收藏 应该能互相切换 */
  var archTabs = await evalJs(`(function () {
    var out = {};
    try {
      out.tabs = document.querySelectorAll('#archive [data-atab]').length;
      var works = document.querySelector('#archive [data-atab="works"]');
      if (works) works.click();
      out.worksRows = document.querySelectorAll('#archive .arch-row').length;
      out.worksCombo = document.querySelectorAll('#archive .cm-box').length;
      var combo = document.querySelector('#archive [data-atab="combo"]');
      if (combo) combo.click();
      out.comboRows = document.querySelectorAll('#archive .cm-row').length;
      out.comboWorks = document.querySelectorAll('#archive .arch-row').length;
    } catch (e) { out.err = String((e && e.message) || e); }
    return out;
  })()`);
  check('作品集有两个页签', !archTabs.err && archTabs.tabs === 2,
    archTabs.err || ('tabs=' + archTabs.tabs));
  check('作品页签只显示作品列表',
    archTabs.worksRows >= 1 && archTabs.worksCombo === 0,
    'rows=' + archTabs.worksRows + ' combo=' + archTabs.worksCombo);
  check('组合页签不再拖着长列表',
    archTabs.comboRows === 11 && archTabs.comboWorks === 0,
    'cmRows=' + archTabs.comboRows + ' works=' + archTabs.comboWorks);
  await evalJs(`document.querySelector('#archive [data-atab="works"]').click()`);

  /* 解锁与王牌达成都会弹提示（引擎队列 -> UI 取走） */
  var cmToast = await evalJs(`(() => {
    const st = GD.getState();
    const miss = GD.Engine.comboList().find(c => !GD.Engine.comboUnlocked(st, c.genre, c.theme));
    st.comboNews = [];
    GD.Engine.unlockCombo(st, miss.genre, miss.theme);
    const leg = GD.Engine.comboList().find(c => GD.Engine.isLegendary(c.genre, c.theme));
    GD.Engine.markFound(st, leg.genre, leg.theme);
    GD.UI.render();
    const texts = [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | ');
    return { left: st.comboNews.length, texts: texts, found: GD.Engine.comboStats(st).found };
  })()`);
  check('解锁组合会弹提示',
    cmToast.left === 0 && cmToast.texts.indexOf('解锁组合') >= 0, cmToast.texts);
  check('王牌达成会弹提示',
    cmToast.texts.indexOf('王牌组合达成') >= 0 && cmToast.found > 0, cmToast.texts);
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
    const W = document.documentElement.clientWidth;
    const over = [];
    document.querySelectorAll('body *').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width && b.right > W + 0.5) {
        over.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0] +
          '[' + Math.round(b.right) + '] ' + (el.textContent || '').trim().slice(0, 18));
      }
    });
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      office: r(q('.office')), stage: r(q('#stage')),
      chipWrap: getComputedStyle(q('.chips')).flexWrap,
      over: over.slice(0, 3)
    };
  })()`);
  check('手机端无横向溢出', mobile.overflow <= 0,
    'overflow=' + mobile.overflow + (mobile.over.length ? ' ← ' + mobile.over.join(' | ') : ''));
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

  /* ---------- 10.2 六类奖项 ---------- */
  var awardUI = await evalJs(`(function () {
    var s = GD.getState();
    var keepRes = s.yearResults.slice(), keepAw = s.awards.slice();
    var err = null, toastText = '', wall = null, sub = '';
    var fake = {
      year: 1972, winner: null, playerScore: 34, playerAward: '年度游戏 / 最佳画面',
      won: ['goty', 'art'],
      awards: GD.AWARD_CATS.map(function (c) {
        return { id: c.id, name: c.name, won: c.id === 'goty' || c.id === 'art', me: 34, them: 30 };
      })
    };
    try {
      /* 多推两条：UI 用 yearResults.length 判新结果，单推一条会被上一轮计数吃掉 */
      s.yearResults.push(fake, fake);
      s.awards.push({ year: 1972, cat: 'goty', title: '年度游戏', score: 34, money: 1, fans: 1 });
      s.awards.push({ year: 1972, cat: 'art', title: '最佳画面', score: 60, money: 1, fans: 1 });
      GD.UI.render();
      toastText = [].map.call(document.querySelectorAll('#toasts .toast'), function (x) { return x.textContent; }).join(' | ');

      document.querySelector('[data-act="industry"]').click();
      var box = document.querySelector('#industry .award-wall');
      wall = {
        has: !!box,
        items: document.querySelectorAll('#industry .aw').length,
        hasCount: document.querySelectorAll('#industry .aw.has').length,
        text: box ? box.textContent : ''
      };
      sub = (document.querySelector('#industry .panel-sub') || {}).textContent || '';
      document.querySelector('#industry [data-act="close-panel"]').click();
    } catch (e) { err = String((e && e.message) || e); }
    s.yearResults = keepRes;
    s.awards = keepAw;
    return { err: err, toast: toastText, wall: wall, sub: sub, cats: GD.AWARD_CATS.length };
  })()`);
  check('六类奖项提示能正常弹出', !awardUI.err, awardUI.err || 'ok');
  check('提示里会带上「另夺」的其它奖',
    awardUI.toast.indexOf('另夺') >= 0 && awardUI.toast.indexOf('画面') >= 0, awardUI.toast);
  check('奖项一共 6 类', awardUI.cats === 6, String(awardUI.cats));
  check('行业面板有奖项墙', !!awardUI.wall && awardUI.wall.has === true && awardUI.wall.items === 6,
    'items=' + (awardUI.wall || {}).items);
  check('奖项墙标出哪些拿过', (awardUI.wall || {}).hasCount >= 2,
    'has=' + (awardUI.wall || {}).hasCount);
  check('行业面板顶部改成「奖项 N 座」', awardUI.sub.indexOf('奖项') >= 0, awardUI.sub);
  await sleep(120);

  /* ---------- 10.3 平台退市 ---------- */
  var retireUI = await evalJs(`(function () {
    var s = GD.getState();
    var keepDay = s.day, keepPlan = s.plan.platform;
    var out = {};
    try {
      s.day = (1980 - GD.BAL.startYear) * GD.BAL.daysPerYear;   // ARC-72 进入退市预警
      if (s.phase !== 'planning') s.phase = 'planning';
      GD.UI.render();
      out.warnChip = document.querySelectorAll('#stage .chip.dying').length;
      out.warnTag = [].map.call(document.querySelectorAll('#stage .chip.dying .dying-tag'),
        function (x) { return x.textContent; }).join(' | ');

      s.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;   // ARC-72 已退市
      GD.UI.render();
      out.retiredGone = !GD.Engine.availablePlatforms(s).some(function (p) { return p.id === 'arc72'; });
      out.planFixed = s.plan.platform !== 'arc72';
      out.chipsOn = document.querySelectorAll('#stage .chip.on').length;
      out.platOn = document.querySelectorAll('#stage [data-plan^="platform:"].on').length;
    } catch (e) { out.err = String((e && e.message) || e); }
    s.day = keepDay;
    s.plan.platform = keepPlan;
    GD.UI.render();
    return out;
  })()`);
  check('平台退市前有预警标记', !retireUI.err && retireUI.warnChip >= 1,
    retireUI.err || ('预警 chip=' + retireUI.warnChip));
  check('预警标签写明退市年份', (retireUI.warnTag || '').indexOf('退市') >= 0, retireUI.warnTag);
  check('退市后平台不可选', retireUI.retiredGone === true);
  check('退市后企划平台被自动换掉', retireUI.planFixed === true);
  check('换平台后企划仍然完整', retireUI.chipsOn >= 4 && retireUI.platOn === 1,
    'on=' + retireUI.chipsOn + ' platOn=' + retireUI.platOn);

  /* ---------- 10.4 移植 ---------- */
  var portUI = await evalJs(`(function () {
    var s = GD.getState();
    var keepHist = s.history, keepMoney = s.money, keepDay = s.day, keepPhase = s.phase;
    var out = {};
    try {
      s.money = 5000000;
      s.phase = 'planning';
      s.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
      s.history = [{
        name: '移植测试作', genre: 'rpg', theme: 'fantasy',
        platform: 'arc72', platformLabel: '雅达瑞 街机板',
        total: 32, copies: 60000, revenue: 900000, cost: 300000,
        date: '1975 年 6 月', window: '普通档期'
      }];
      document.querySelector('[data-act="archive"]').click();
      out.btn = document.querySelectorAll('#archive [data-port]').length;
      out.label = (document.querySelector('#archive [data-port]') || {}).textContent || '';

      /* 展开目标列表 */
      document.querySelector('#archive [data-port]').click();
      out.opts = document.querySelectorAll('#archive [data-portto]').length;
      out.optText = [].map.call(document.querySelectorAll('#archive .port-opt small'),
        function (x) { return x.textContent; }).join(' | ');

      var beforeMoney = s.money;
      var target = document.querySelector('#archive [data-portto]');
      target.click();
      out.moved = s.history[0].platform !== 'arc72';
      out.ports = JSON.stringify(s.history[0].ports || null);
      out.moneyGrew = s.money > beforeMoney;
      out.toast = [].map.call(document.querySelectorAll('#toasts .toast'),
        function (x) { return x.textContent; }).join(' | ');
      out.meta = (document.querySelector('#archive .arch-meta') || {}).textContent || '';
      document.querySelector('#archive [data-act="close-panel"]').click();
    } catch (e) { out.err = String((e && e.message) || e); }
    s.history = keepHist; s.money = keepMoney; s.day = keepDay; s.phase = keepPhase;
    GD.UI.render();
    return out;
  })()`);
  check('作品集里有移植按钮', !portUI.err && portUI.btn === 1 && portUI.label.indexOf('移植') >= 0,
    portUI.err || (portUI.btn + ' / ' + portUI.label));
  check('点移植能展开平台列表', portUI.opts >= 1, 'opts=' + portUI.opts);
  check('每个目标显示成本与预估销量', (portUI.optText || '').indexOf('$') >= 0, portUI.optText);
  check('移植真的换了平台', portUI.moved === true && portUI.ports !== 'null', portUI.ports);
  check('移植进账并弹提示', portUI.moneyGrew === true && (portUI.toast || '').indexOf('移植到') >= 0,
    portUI.toast);
  check('作品集里显示移植次数', (portUI.meta || '').indexOf('移植 ×1') >= 0, portUI.meta);

  /* ---------- 10.5 破产与新公司 ---------- */
  var bankUI = await evalJs(`(function () {
    var s = GD.getState();
    s.history = [];          // 清掉长尾收入，否则每月进账会把现金拉回正数
    s.brands = [];
    s.money = -1000;
    s.day = 360;
    s.tailMonth = 0;
    s.brokeMonths = 0;
    GD.Engine.settleMonths(s);
    s.day += 30;
    GD.Engine.settleMonths(s);
    GD.UI.render();
    var btn = document.querySelector('[data-act="rebuild"]');
    var title = (document.querySelector('.ending-title') || {}).textContent || '';
    var phase = GD.getState().phase;
    if (btn) btn.click();
    var cards = document.querySelectorAll('[data-rebuild]').length;
    var first = document.querySelector('[data-rebuild]');
    if (first) first.click();
    var after = {
      phase: GD.getState().phase,
      decl: GD.getState().declaration,
      money: Math.round(GD.getState().money),
      staff: GD.getState().staff.length
    };
    return { phase: phase, title: title, cards: cards, after: after };
  })()`);
  check('现金连续两个月为负会进破产界面',
    bankUI.phase === 'bankrupt' && bankUI.title.indexOf('破产') >= 0, bankUI.phase + ' / ' + bankUI.title);
  check('破产后能选 4 条新公司宣言', bankUI.cards === 4, 'cards=' + bankUI.cards);
  check('开新公司回到企划阶段',
    bankUI.after.phase === 'planning' && bankUI.after.decl === 'makewhat' && bankUI.after.staff === 3,
    JSON.stringify(bankUI.after));

  /* ---------- 10.5 NG+ ---------- */
  var endBg = await evalJs(`(() => {
    const st = GD.getState();
    const keep = st.phase;
    st.phase = 'ending';
    GD.UI.render();
    const el = document.querySelector('.ending');
    const cs = el ? getComputedStyle(el) : null;
    const out = {
      has: !!el,
      image: cs ? cs.backgroundImage : '',
      color: cs ? cs.backgroundColor : ''
    };
    st.phase = keep;
    GD.UI.render();
    return out;
  })()`);
  check('结局页有卡片', endBg.has === true);
  check('结局页不再写死深色底',
    endBg.image.indexOf('33, 26, 19') < 0 && endBg.image.indexOf('20, 16, 13') < 0,
    (endBg.image || '').slice(0, 80));
  var ngUI = await evalJs(`(() => {
    const st = GD.getState();
    st.phase = 'ending';
    GD.UI.render();
    const btn = document.querySelector('[data-act="ngplus"]');
    return {
      has: !!btn,
      label: btn ? btn.textContent : '',
      note: (document.querySelector('.ending-note') || {}).textContent || '',
      combos: GD.Engine.comboCount(st)
    };
  })()`);
  check('结局页有 NG+ 按钮', ngUI.has === true && ngUI.label.indexOf('NG+') >= 0, ngUI.label);
  check('结局页说明保留了什么',
    ngUI.note.indexOf('收藏') >= 0 && ngUI.note.indexOf('粉丝') >= 0, ngUI.note);

  var ng2 = await evalJs(`(() => {
    document.querySelector('[data-act="ngplus"]').click();
    const st = GD.getState();
    return {
      phase: st.phase,
      ng: st.ng || 0,
      combos: GD.Engine.comboCount(st),
      year: GD.Engine.year(st),
      fans: st.fans,
      bar: !!document.querySelector('#stage .ng-bar')
    };
  })()`);
  check('NG+ 回到 1972 且轮次 +1',
    ng2.phase === 'planning' && ng2.ng === 1 && ng2.year === 1972, JSON.stringify(ng2));
  check('NG+ 保住收藏', ng2.combos === ngUI.combos, ng2.combos + ' vs ' + ngUI.combos);
  check('企划页显示 NG+ 标记', ng2.bar === true);

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
