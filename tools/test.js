/* ============================================================
 * tools/test.js —— M0 引擎逻辑测试
 * 用法：node tools/test.js
 * ============================================================ */
'use strict';

global.window = global;
require('../js/config.js');
require('../js/engine.js');

var GD = global.GD;
var E = GD.Engine;
var BAL = GD.BAL;

var passed = 0, failed = 0;

function ok(name, cond, detail) {
  if (cond) { passed++; console.log('PASS ' + name); }
  else { failed++; console.log('FAIL ' + name + (detail ? '  → ' + detail : '')); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }

function playOne(s, plan, choice) {
  if (!E.startProject(s, plan)) return null;
  var guard = 0;
  while (s.phase !== 'done' && guard++ < 60000) {
    E.tick(s, 1 / 30);
    if (s.phase === 'event') {
      var done = false;
      var order = choice == null ? [0, 1] : [choice, 0, 1];
      for (var i = 0; i < order.length && !done; i++) done = E.chooseEvent(s, order[i]);
      if (!done) break;
    }
    if (s.phase === 'release') E.confirmRelease(s, 'now');
  }
  return s.lastResult;
}

/* ---------- 基础 ---------- */
(function () {
  var s = E.newGame();
  ok('新游戏是企划阶段', s.phase === 'planning');
  ok('初始资金正确', s.money === BAL.startMoney);
  ok('初始 3 名员工', s.staff.length === 3);
  ok('5 类型 × 5 题材', GD.GENRES.length === 5 && GD.THEMES.length === 5);
  ok('4 位评审', GD.CRITICS.length === 4);
})();

/* ---------- 相性与预告 ---------- */
(function () {
  var s = E.newGame();
  ok('RPG×幻想 相性最高', E.affinity('rpg', 'fantasy') === 1.35);
  ok('RPG×现代 相性偏低', E.affinity('rpg', 'modern') === 0.95);

  var good = E.preview(s, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  var bad = E.preview(s, { genre: 'rpg', theme: 'modern', leader: 'zhou' });
  ok('好组合品质高于差组合', good.quality > bad.quality + 8,
    good.quality.toFixed(1) + ' vs ' + bad.quality.toFixed(1));
  ok('预告分数区间合理', good.scoreLow >= 1 && good.scoreHigh <= 40 && good.scoreLow < good.scoreHigh,
    good.scoreLow + '–' + good.scoreHigh);

  ok('速度影响开发时长',
    E.devDuration(s, 'lin') < E.devDuration(s, 'ya'),
    E.devDuration(s, 'lin') + ' vs ' + E.devDuration(s, 'ya'));

  var actLin = E.preview(s, { genre: 'action', theme: 'modern', leader: 'lin' });
  var actZhou = E.preview(s, { genre: 'action', theme: 'modern', leader: 'zhou' });
  ok('同类型换主创有差别', actLin.quality > actZhou.quality + 2,
    actLin.quality.toFixed(1) + ' vs ' + actZhou.quality.toFixed(1));
})();

/* ---------- 立项与开发 ---------- */
(function () {
  var s = E.newGame();
  var before = s.money;
  var plan = { genre: 'rpg', theme: 'fantasy', leader: 'zhou' };
  ok('可以立项', E.startProject(s, plan) === true);
  ok('立项扣平台授权费', near(s.money, before - BAL.license));
  ok('进入开发阶段', s.phase === 'developing');
  ok('开发时长按主创速度算', near(s.project.baseDuration, E.devDuration(s, 'zhou')));

  ok('开发中不能重复立项', E.startProject(s, plan) === false);

  E.tick(s, 1);
  ok('进度随时间推进', s.project.progress > 0, 'p=' + s.project.progress.toFixed(3));
  ok('未到 45% 不触发事件', s.phase === 'developing');
})();

/* ---------- 事件 ---------- */
(function () {
  var s = E.newGame();
  E.startProject(s, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  s.project.progress = BAL.eventAts[0] + 0.01;
  E.tick(s, 1 / 30);
  ok('30% 触发第一个事件', s.phase === 'event' && !!s.event);

  var moneyBefore = s.money;
  var okChoice = E.chooseEvent(s, 0);
  ok('选择事件生效', okChoice === true && s.phase === 'developing');
  ok('事件会改变金钱或品质', s.money !== moneyBefore || s.project.qualityPct !== 0);

  var s2 = E.newGame();
  E.startProject(s2, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  s2.phase = 'event';
  s2.event = GD.EVENTS.filter(function (e) { return e.id === 'disk'; })[0];  // 硬盘烧了，选项 0 花钱
  s2.money = 100;
  ok('钱不够不能选付费选项', E.chooseEvent(s2, 0) === false);
  ok('钱不够可以选免费选项', E.chooseEvent(s2, 1) === true);
})();

/* ---------- 开发档位与烧钱 ---------- */
(function () {
  var plan = { genre: 'rpg', theme: 'fantasy', leader: 'zhou' };

  var s = E.newGame();
  E.startProject(s, plan);
  var m0 = s.money;
  E.tick(s, 1);
  ok('开发中按天烧工资', s.money < m0, 'Δ=' + Math.round(m0 - s.money));
  ok('烧钱速率符合配置',
    Math.abs((m0 - s.money) - E.teamSalary(s) * GD.BAL.daysPerSecond) < 1,
    Math.round(m0 - s.money) + ' / 秒');

  ok('可以切换开发档位', E.setMode(s, 'crunch') === true && s.project.mode === 'crunch');
  ok('非法档位被拒绝', E.setMode(s, 'nope') === false);

  var p0 = s.project.progress;
  E.tick(s, 1);
  var crunchRate = s.project.progress - p0;

  var s2 = E.newGame();
  E.startProject(s2, plan);
  var q0 = s2.project.progress;
  E.tick(s2, 1);
  var normalRate = s2.project.progress - q0;

  ok('赶工比正常快', crunchRate > normalRate * 1.3,
    crunchRate.toFixed(4) + ' vs ' + normalRate.toFixed(4));

  var s3 = E.newGame();
  E.startProject(s3, plan);
  E.setMode(s3, 'polish');
  var r0 = s3.project.progress;
  E.tick(s3, 1);
  ok('打磨比正常慢', (s3.project.progress - r0) < normalRate,
    (s3.project.progress - r0).toFixed(4) + ' vs ' + normalRate.toFixed(4));

  var s4 = E.newGame();
  E.startProject(s4, plan);
  E.setMode(s4, 'crunch');
  s4.project.eventsDone = BAL.eventAts.length;   // 本测试不触发事件
  for (var i = 0; i < 10; i++) E.tick(s4, 1);
  ok('品质修正按停留时间累积', Math.abs(s4.project.modeQSum + 60) < 1.5,
    'sum=' + s4.project.modeQSum.toFixed(1));

  ok('打磨的实时品质更高', E.liveQuality(s3) > E.liveQuality(s2),
    E.liveQuality(s3).toFixed(1) + ' vs ' + E.liveQuality(s2).toFixed(1));

  ok('开发阶段名会变化', E.devPhase(s2) === '原型' || E.devPhase(s2) === '制作', E.devPhase(s2));

  /* 总成本 = 授权 + 工资（这次不触发事件） */
  var s5 = E.newGame();
  E.startProject(s5, plan);
  s5.project.eventsDone = BAL.eventAts.length;
  var guard = 0;
  while (s5.phase !== 'review' && guard++ < 20000) E.tick(s5, 1 / 30);
  var expectCost = GD.BAL.license + E.teamSalary(s5) * GD.BAL.daysPerSecond * s5.project.elapsed;
  ok('总成本 = 授权 + 工资', Math.abs(s5.project.cost - expectCost) < 50,
    Math.round(s5.project.cost) + ' vs ' + Math.round(expectCost));
})();

/* ---------- 两次事件 ---------- */
(function () {
  var s = E.newGame();
  E.startProject(s, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  var seen = [], guard = 0;
  while (s.phase !== 'review' && guard++ < 20000) {
    E.tick(s, 1 / 30);
    if (s.phase === 'event') {
      seen.push(s.event.when);
      if (!E.chooseEvent(s, 0)) E.chooseEvent(s, 1);
    }
  }
  ok('一部作品触发两次事件', seen.length === 2, JSON.stringify(seen));
  ok('第一次是早期事件', seen[0] === 'early', seen[0]);
  ok('第二次是后期事件', seen[1] === 'late', seen[1]);
  ok('事件计数到 2', s.project.eventsDone === 2);

  var s2 = E.newGame();
  s2.review = { total: 26, scores: [], revealed: 4, totalShown: true };
  s2.project = { quality: 30, salesPct: -20 };
  var low = E.estimateSales(s2, 1).mid;
  s2.project.salesPct = 0;
  var base = E.estimateSales(s2, 1).mid;
  ok('事件能影响销量预估', low < base * 0.85, low + ' vs ' + base);
})();

/* ---------- 小决定 ---------- */
(function () {
  var plan = { genre: 'rpg', theme: 'fantasy', leader: 'zhou' };
  var s = E.newGame();
  E.startProject(s, plan);

  var guard = 0;
  while (!s.micro && guard++ < 5000) E.tick(s, 1 / 30);
  ok('开发中会出现小决定', !!s.micro, s.micro ? s.micro.item.text : '');
  ok('小决定有选项', s.micro.item.options.length >= 1);

  var ttl0 = s.micro.ttl;
  E.tick(s, 1);
  ok('小决定会倒计时', s.micro.ttl < ttl0);

  var money0 = s.money;
  guard = 0;
  while (s.micro && guard++ < 3000) E.tick(s, 1 / 30);
  ok('不理会就自动消失', s.micro === null);
  ok('过期不扣钱', s.money === money0 || s.money < money0);
})();

(function () {
  var plan = { genre: 'rpg', theme: 'fantasy', leader: 'zhou' };
  var s = E.newGame();
  E.startProject(s, plan);
  var guard = 0;
  while (!s.micro && guard++ < 5000) E.tick(s, 1 / 30);

  var opt = s.micro.item.options[0];
  var money0 = s.money;
  var cost0 = s.project.cost;
  var q0 = s.project.eventQualityPct;
  var s0 = s.project.salesPct;
  var log0 = s.project.log.length;

  ok('可以选择小决定', E.microChoice(s, 0) === true && s.micro === null);
  ok('小决定按选项扣钱', s.money === money0 - (opt.cost || 0));
  ok('小决定计入成本', s.project.cost === cost0 + (opt.cost || 0));
  ok('小决定影响品质或销量',
    s.project.eventQualityPct !== q0 || s.project.salesPct !== s0,
    'q ' + q0 + '→' + s.project.eventQualityPct);
  ok('小决定写进开发日志', s.project.log.length > log0);

  // 大事件会清掉小决定
  var s2 = E.newGame();
  E.startProject(s2, plan);
  s2.micro = { uid: 999, item: GD.MICRO[0], ttl: 5 };
  s2.project.progress = 0.2999;
  E.tick(s2, 1 / 30);
  ok('大事件会清掉小决定', s2.micro === null && s2.phase === 'event');
})();

/* ---------- 评审 ---------- */
(function () {
  var s = E.newGame();
  E.startProject(s, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  s.project.progress = 1;
  E.tick(s, 1 / 30);

  ok('开发完成进入评审', s.phase === 'review');
  ok('打分有 4 位', s.review.scores.length === 4);
  ok('每位 1–10 分', s.review.scores.every(function (v) { return v >= 1 && v <= 10; }), JSON.stringify(s.review.scores));
  ok('总分等于四位之和',
    s.review.total === s.review.scores.reduce(function (a, b) { return a + b; }, 0));

  s.timer = 2;
  E.tick(s, 1 / 30);
  ok('评审逐个亮分', s.review.revealed >= 2, 'revealed=' + s.review.revealed);

  s.timer = 10;
  E.tick(s, 1 / 30);
  ok('评审结束进入发售决策', s.phase === 'release');
})();

/* ---------- 档期 ---------- */
(function () {
  ok('暑期档识别', !!E.windowAt(160) && E.windowAt(160).id === 'summer');
  ok('年末档识别', !!E.windowAt(320) && E.windowAt(320).id === 'winter');
  ok('窗口外没有档期', E.windowAt(100) === null);

  var nx = E.nextWindow(100);
  ok('能找到下一个档期', nx.win.id === 'summer' && nx.days === 50, 'days=' + nx.days);

  var s = E.newGame();
  s.day = 160;
  s.phase = 'release';
  s.review = { total: 26, scores: [6, 6, 7, 7], revealed: 4, totalShown: true };
  s.project = { quality: 35, cost: 130000 };

  var o = E.releaseOptions(s);
  ok('档期内立即发售有加成', o.now.mult === 1.25 && o.now.inWindow === true);
  ok('压货目标是下一个档期', o.hold.name === '年末商战' && o.hold.mult === 1.40);

  var day0 = s.day;
  ok('可以立即发售', E.confirmRelease(s, 'now') === true && s.phase === 'sales');
  ok('立即发售不改日历', s.day === day0);
  ok('销售已按档期开算', s.sales.total > 0);

  var s2 = E.newGame();
  s2.day = 100;
  s2.phase = 'release';
  s2.review = { total: 26, scores: [], revealed: 4, totalShown: true };
  s2.project = { quality: 35, cost: 0 };
  s2.money = 500000;

  var m0 = s2.money;
  var o2 = E.releaseOptions(s2);
  ok('压货要付仓储费', o2.hold.cost === Math.round(o2.hold.days * GD.BAL.storagePerDay));
  ok('压货成功', E.confirmRelease(s2, 'hold') === true);
  ok('压货推进了日期', s2.day === 100 + o2.hold.days, 'day=' + s2.day);
  ok('压货扣了钱', s2.money === m0 - o2.hold.cost);
  ok('压货后落在档期内', !!E.windowAt(s2.day), 'doy=' + E.dayOfYear(s2.day));

  var s3 = E.newGame();
  E.startProject(s3, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  var pd = E.projectedReleaseDay(s3);
  ok('能预测发售日', pd > s3.day + 70 && pd < s3.day + 100, 'pd=' + Math.round(pd - s3.day) + ' 天后');

  ok('日期格式正确', /^\d+ 年 \d+ 月 \d+ 日$/.test(E.dateString(0)), E.dateString(0));
})();

/* ---------- 销售 ---------- */
(function () {
  var s = E.newGame();
  s.review = { scores: [6, 6, 7, 6], total: 25, revealed: 4, totalShown: true };
  s.project = { quality: 30 };
  E.startSales(s);
  ok('销售期开始', s.phase === 'sales' && s.sales.total > 0, 'total=' + s.sales.total);

  var sum = 0;
  for (var i = 0; i < BAL.salesWeeks; i++) {
    var w = E.settleWeek(s);
    if (w) sum += w.copies;
  }
  ok('12 周全部结算', s.sales.index === BAL.salesWeeks);
  ok('周销量累计接近总量', Math.abs(sum - s.sales.total) < s.sales.total * 0.08,
    sum + ' vs ' + s.sales.total);
  ok('收入 = 销量 × 单价', near(s.sales.revenue, s.sales.sold * GD.PLATFORM.price, 1));
  ok('售完不再结算', E.settleWeek(s) === null);
})();

/* ---------- 广告 ---------- */
(function () {
  var s = E.newGame();
  s.review = { scores: [6, 6, 7, 6], total: 25, revealed: 4, totalShown: true };
  s.project = { quality: 30 };
  s.money = 200000;
  E.startSales(s);

  var week1 = E.settleWeek(s);
  var moneyBeforeAd = s.money;
  ok('可以买广告', E.buyAd(s) === true);
  ok('广告扣钱', Math.abs(s.money - (moneyBeforeAd - GD.BAL.adCost)) < 1);
  var week2 = E.settleWeek(s);
  ok('广告提升下周销量', week2.copies > week1.copies,
    week1.copies + ' → ' + week2.copies);
  ok('只能投一次', E.buyAd(s) === false);
})();

/* ---------- 完整一局 ---------- */
(function () {
  var s = E.newGame();
  var before = s.money;
  var r = playOne(s, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });

  ok('一局能跑完', s.phase === 'done' && !!r);
  ok('有销量与收入', r.copies > 1000 && r.revenue > 0, r.copies + ' 份 / $' + Math.round(r.revenue));
  ok('粉丝增长', s.fans > 0, 'fans=' + Math.round(s.fans));
  ok('记入历史', s.history.length === 1);

  var expected = before - r.cost + r.revenue;
  ok('资金账目对得上', Math.abs(s.money - expected) < 1,
    'money=' + Math.round(s.money) + ' expected=' + Math.round(expected));

  ok('可以进入下一部', E.nextRound(s) === true);
  ok('下一部回到企划', s.phase === 'planning' && s.round === 2);
  ok('在制项目已清空', s.project === null);
})();

/* ---------- 救援 ---------- */
(function () {
  var s = E.newGame();
  s.money = 1000;
  ok('没钱时提示救援', E.needRescue(s) === true);
  ok('没钱不能立项', E.startProject(s, s.plan) === false);
  ok('可以预支', E.rescue(s) === true && s.money >= BAL.license);
  ok('有钱时不需要救援', E.needRescue(s) === false);
})();

/* ---------- 连打 5 部 ---------- */
(function () {
  var s = E.newGame();
  var plans = [
    { genre: 'rpg', theme: 'fantasy', leader: 'zhou' },
    { genre: 'action', theme: 'modern', leader: 'lin' },
    { genre: 'adv', theme: 'medieval', leader: 'ya' },
    { genre: 'sim', theme: 'modern', leader: 'ya' },
    { genre: 'shooter', theme: 'scifi', leader: 'lin' }
  ];
  var scores = [];
  for (var i = 0; i < plans.length; i++) {
    if (s.money < BAL.license) E.rescue(s);
    var r = playOne(s, plans[i]);
    if (r) scores.push(r.total);
    if (s.phase === 'done') E.nextRound(s);
  }
  ok('连打 5 部不崩', scores.length === 5, JSON.stringify(scores));
  ok('分数有波动', new Set(scores).size >= 2, JSON.stringify(scores));

  var avg = scores.reduce(function (a, b) { return a + b; }, 0) / scores.length;
  console.log('   5 部得分：' + scores.join(' / ') + '，平均 ' + avg.toFixed(1));
})();

/* ---------- 团队 ---------- */
(function () {
  var s = E.newGame();
  ok('初始 3 人 3 工位', s.staff.length === 3 && s.seats === 3);
  ok('初始有 3 个候选人', s.candidates.length === 3);
  ok('候选人不在队里', s.candidates.every(function (id) {
    return !s.staff.some(function (x) { return x.id === id; });
  }));

  var cand = s.candidates[0];
  s.money = 1e6;
  ok('工位满时招不了', E.hire(s, cand) === false);

  var cost = E.expandCost(s);
  ok('扩建报价存在', cost > 0, '$' + cost);
  ok('扩建成功', E.expandOffice(s) === true && s.seats === 4);
  ok('扩建扣钱', s.money === 1e6 - cost);

  var before = s.staff.length;
  var salaryBefore = E.teamSalary(s);
  ok('扩建后可以招人', E.hire(s, cand) === true);
  ok('招到人', s.staff.length === before + 1);
  ok('团队工资变高', E.teamSalary(s) > salaryBefore);
  ok('招完刷新候选人', s.candidates.indexOf(cand) === -1);

  var m = s.money;
  ok('换一批要扣钱', E.refreshCandidates(s) === true && s.money === m - GD.BAL.refreshCost);
})();

/* ---------- 成长 ---------- */
(function () {
  var s = E.newGame();
  playOne(s, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  ok('完成作品后获得经验', s.staff[0].xp > 0, 'xp=' + Math.round(s.staff[0].xp));
  ok('有经验结算记录', !!s.lastXp && s.lastXp.gain > 0);

  var s2 = E.newGame();
  var st = s2.staff[0];
  var before = st.stats.script;
  st.xp = E.xpNeeded(1) - 1;
  var up = E.gainXp(s2, 40);
  ok('经验够了会升级', st.level === 2, 'lv=' + st.level);
  ok('升级涨主属性', st.stats.script > before, before + ' → ' + st.stats.script);
  ok('升级有记录', up.ups.length >= 1);
})();

/* ---------- 团队影响 ---------- */
(function () {
  var s = E.newGame();
  var d3 = E.devDuration(s, 'zhou');
  var q3 = E.baseQuality(s, 'rpg', 'fantasy', 'zhou');
  var salary3 = E.teamSalary(s);

  s.staff.push(E.makeStaff('song'));
  s.staff.push(E.makeStaff('man'));
  s.staff.push(E.makeStaff('kang'));

  var d6 = E.devDuration(s, 'zhou');
  var q6 = E.baseQuality(s, 'rpg', 'fantasy', 'zhou');
  ok('人多开发更快', d6 < d3, d3 + 's → ' + d6 + 's');
  ok('人多品质更高', q6 > q3, q3.toFixed(1) + ' → ' + q6.toFixed(1));
  ok('人多工资更高', E.teamSalary(s) > salary3, salary3 + ' → ' + E.teamSalary(s));
})();

/* ---------- 存档 ---------- */
(function () {
  var s = E.newGame();
  s.money = 1e6;
  E.expandOffice(s);
  E.hire(s, s.candidates[0]);
  s.staff[0].level = 3;
  s.staff[0].stats.script = 50;
  s.day = 123;
  s.history.push({
    name: 'x', genre: 'rpg', theme: 'fantasy', total: 28, copies: 1000,
    revenue: 22000, window: '暑期档', windowMult: 1.25, date: '1983 年 5 月 1 日'
  });

  var back = E.deserialize(E.serialize(s));
  ok('存档保留员工数', back.staff.length === 4, 'n=' + back.staff.length);
  ok('存档保留等级', back.staff[0].level === 3);
  ok('存档保留属性', back.staff[0].stats.script === 50);
  ok('存档保留工位', back.seats === 4);
  ok('存档保留作品集', back.history.length === 1);
  ok('存档保留日期', back.day === 123);
  ok('坏存档会被拒绝', (function () {
    try { E.deserialize('{}'); return false; } catch (e) { return true; }
  })());
})();

/* ---------- 平衡探针 ---------- */
(function () {
  var runs = 24;
  var totals = [], margins = [];
  for (var i = 0; i < runs; i++) {
    var s = E.newGame();
    var start = s.money;
    var r = playOne(s, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
    totals.push(r.total);
    margins.push((s.money - start) / r.cost);
  }
  totals.sort(function (a, b) { return a - b; });
  margins.sort(function (a, b) { return a - b; });
  var median = totals[Math.floor(runs / 2)];
  var medMargin = margins[Math.floor(runs / 2)];
  console.log('   24 局 RPG×幻想：评分中位数 ' + median + '/40，回报中位数 ' + medMargin.toFixed(2) + ' 倍成本');

  ok('评分中位数落在 20–32', median >= 20 && median <= 32, 'median=' + median);
  ok('净回报中位数在 0.8–3.5 倍之间', medMargin >= 0.8 && medMargin <= 3.5, 'margin=' + medMargin.toFixed(2));
})();

console.log('\n' + passed + ' 项通过，' + failed + ' 项失败');
process.exit(failed ? 1 : 0);
