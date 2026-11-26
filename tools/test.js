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
  }
  return s.lastResult;
}

/* ---------- 基础 ---------- */
(function () {
  var s = E.newGame();
  ok('新游戏是企划阶段', s.phase === 'planning');
  ok('初始资金正确', s.money === BAL.startMoney);
  ok('初始 3 名员工', GD.STAFF.length === 3);
  ok('5 类型 × 5 题材', GD.GENRES.length === 5 && GD.THEMES.length === 5);
  ok('4 位评审', GD.CRITICS.length === 4);
})();

/* ---------- 相性与预告 ---------- */
(function () {
  ok('RPG×幻想 相性最高', E.affinity('rpg', 'fantasy') === 1.35);
  ok('RPG×现代 相性偏低', E.affinity('rpg', 'modern') === 0.95);

  var good = E.preview({ genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  var bad = E.preview({ genre: 'rpg', theme: 'modern', leader: 'zhou' });
  ok('好组合品质高于差组合', good.quality > bad.quality + 8,
    good.quality.toFixed(1) + ' vs ' + bad.quality.toFixed(1));
  ok('预告分数区间合理', good.scoreLow >= 1 && good.scoreHigh <= 40 && good.scoreLow < good.scoreHigh,
    good.scoreLow + '–' + good.scoreHigh);

  ok('速度影响开发时长',
    E.devDuration('lin') < E.devDuration('ya'),
    E.devDuration('lin') + ' vs ' + E.devDuration('ya'));

  var actLin = E.preview({ genre: 'action', theme: 'modern', leader: 'lin' });
  var actZhou = E.preview({ genre: 'action', theme: 'modern', leader: 'zhou' });
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
  ok('开发时长按主创速度算', near(s.project.baseDuration, E.devDuration('zhou')));

  ok('开发中不能重复立项', E.startProject(s, plan) === false);

  E.tick(s, 1);
  ok('进度随时间推进', s.project.progress > 0, 'p=' + s.project.progress.toFixed(3));
  ok('未到 45% 不触发事件', s.phase === 'developing');
})();

/* ---------- 事件 ---------- */
(function () {
  var s = E.newGame();
  E.startProject(s, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  s.project.progress = BAL.eventAt + 0.01;
  E.tick(s, 1 / 30);
  ok('45% 触发事件', s.phase === 'event' && !!s.event);

  var moneyBefore = s.money;
  var okChoice = E.chooseEvent(s, 0);
  ok('选择事件生效', okChoice === true && s.phase === 'developing');
  ok('事件会改变金钱或品质', s.money !== moneyBefore || s.project.qualityPct !== 0);

  var s2 = E.newGame();
  E.startProject(s2, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  s2.phase = 'event';
  s2.event = GD.EVENTS[1];          // 硬盘烧了，选项 0 花钱
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
    Math.abs((m0 - s.money) - GD.BAL.salaryPerDay * GD.BAL.daysPerSecond) < 1,
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
  for (var i = 0; i < 10; i++) E.tick(s4, 1);
  ok('品质修正按停留时间累积', Math.abs(s4.project.modeQSum + 60) < 1.5,
    'sum=' + s4.project.modeQSum.toFixed(1));

  ok('打磨的实时品质更高', E.liveQuality(s3) > E.liveQuality(s2),
    E.liveQuality(s3).toFixed(1) + ' vs ' + E.liveQuality(s2).toFixed(1));

  ok('开发阶段名会变化', E.devPhase(s2) === '原型' || E.devPhase(s2) === '制作', E.devPhase(s2));

  /* 总成本 = 授权 + 工资（这次不触发事件） */
  var s5 = E.newGame();
  E.startProject(s5, plan);
  s5.project.eventFired = true;
  var guard = 0;
  while (s5.phase !== 'review' && guard++ < 20000) E.tick(s5, 1 / 30);
  var expectCost = GD.BAL.license + GD.BAL.salaryPerDay * GD.BAL.daysPerSecond * s5.project.elapsed;
  ok('总成本 = 授权 + 工资', Math.abs(s5.project.cost - expectCost) < 50,
    Math.round(s5.project.cost) + ' vs ' + Math.round(expectCost));
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
  ok('评审结束进入销售', s.phase === 'sales' && !!s.sales);
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
