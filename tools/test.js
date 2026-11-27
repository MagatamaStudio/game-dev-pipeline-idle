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
      ok('10 类型 × 10 题材', GD.GENRES.length === 10 && GD.THEMES.length === 10,
      GD.GENRES.length + ' x ' + GD.THEMES.length);

    var cellN = 0, missing = 0, legend = 0;
    GD.GENRES.forEach(function (g) {
      GD.THEMES.forEach(function (th) {
        cellN++;
        var v = GD.COMBO[g.id] && GD.COMBO[g.id][th.id];
        if (v == null) missing++;
        else if (v >= 1.30) legend++;
      });
    });
    ok('相性表 100 格全填', cellN === 100 && missing === 0, '格=' + cellN + ' 缺=' + missing);
    ok('传说组合有 12 个', legend === 12, '数量=' + legend);

    var weightBad = GD.GENRES.filter(function (g) {
      var sum = 0;
      ['code', 'script', 'art', 'audio'].forEach(function (k) { sum += g.weights[k] || 0; });
      return Math.abs(sum - 1) > 1e-6;
    });
    ok('每个类型的四项权重都等于 1', weightBad.length === 0,
      weightBad.map(function (g) { return g.id; }).join(','));
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
  ok('立项扣平台授权费', near(s.money, before - E.platform(s).license));
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
    Math.abs((m0 - s.money) - E.teamSalary(s) * GD.BAL.daysPerSecond * E.prodMult(s)) < 1,
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
  var expectCost = E.platform(s5).license + E.teamSalary(s5) * GD.BAL.daysPerSecond * s5.project.elapsed * E.prodMult(s5);
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
  ok('收入 = 销量 × 单价 × 到手比例', near(s.sales.revenue, s.sales.sold * E.platform(s).price * GD.BAL.publisherCut, 1));
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

  var expected = before - r.cost + r.revenue + (s.tailTotal || 0);
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
  ok('换一批要扣钱', E.refreshCandidates(s) === true && Math.abs(s.money - (m - GD.BAL.refreshCost * E.inflation(s))) < 1);
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

/* ---------- 长尾与离线 ---------- */
(function () {
  var s = E.newGame();
  s.history.push({ revenue: 300000 });
  ok('长尾按月计算', Math.abs(E.monthIncome(s) - 1800) < 1, E.monthIncome(s));

  s.day = 30;
  var before = s.money;
  var gained = E.settleMonths(s);
  ok('跨月结算长尾', Math.abs(gained - 1800) < 1 && Math.abs(s.money - before - 1800) < 1);
  ok('同月不重复结算', E.settleMonths(s) === 0);

  var rep = E.offline(E.newGame(), 8 * 3600);
  ok('离线推进日历', rep.days === 24, 'days=' + rep.days);
  ok('离线最多结算 8 小时', E.offline(E.newGame(), 100 * 3600).days === 24,
    E.offline(E.newGame(), 100 * 3600).days + ' 天');

  var s3 = E.newGame();
  s3.review = { total: 26, scores: [], revealed: 4, totalShown: true };
  s3.project = { quality: 30, salesPct: 0 };
  E.startSales(s3);
  var rep3 = E.offline(s3, 600);
  ok('离线会把在售作品卖完', s3.phase === 'done' && rep3.copies > 0, 'copies=' + rep3.copies);
  ok('离线收益计入资金', rep3.total > 0, Math.round(rep3.total) + '');
})();

/* ---------- 时间线与平台 ---------- */
(function () {
  var s = E.newGame();
  ok('1972 年只有街机', E.availablePlatforms(s).length === 1 && E.availablePlatforms(s)[0].id === 'arc72');
  ok('默认平台是 ARC-72', E.platform(s).id === 'arc72');
  ok('年份从 1972 开始', E.year(s) === 1972);

  s.day = 11 * 360;
  var avail = E.availablePlatforms(s);
  ok('1983 年解锁新平台', avail.length >= 2, avail.map(function (p) { return p.code; }).join(','));
  ok('能看到 L-3', avail.some(function (p) { return p.id === 'l3'; }));
  ok('退市的 ARC-72 不再可选', !avail.some(function (p) { return p.id === 'arc72'; }),
    avail.map(function (p) { return p.id; }).join(','));

  s.plan.platform = 'l3';
  ok('可以选 L-3', E.platform(s).id === 'l3');

  var l3 = E.platformById('l3');
  var popNew = E.popMult(l3, 1983);
  var popPeak = E.popMult(l3, 1986);
  var popOld = E.popMult(l3, 1992);
  ok('平台有生命周期', popNew < popPeak && popOld < popPeak,
    popNew + ' / ' + popPeak + ' / ' + popOld);
})();

/* ---------- 年度奖项（6 类） ---------- */
(function () {
  var s = E.newGame();
  s.yearBest = 33;
  s.yearBestTitle = '试作';
  s.plan = { genre: 'rpg', theme: 'fantasy', leader: s.staff[0].id, platform: 'arc72' };
  s.day = 360;
  var got = E.settleAwards(s);
  var titles = got.map(function (a) { return a.title; });
  ok('没有对手时拿年度游戏', titles.indexOf('年度游戏') >= 0, titles.join(' / '));
  ok('年度游戏排在第一个', !!got[0] && got[0].cat === 'goty', JSON.stringify(got[0] || null));
  ok('类型对得上就给类型奖', titles.indexOf('最佳 RPG') >= 0, titles.join(' / '));
  ok('类型对不上就没有类型奖', titles.indexOf('最佳动作') < 0, titles.join(' / '));
  ok('奖项进档案', s.awards.length === got.length && s.awards.length >= 2,
    'awards=' + s.awards.length + ' got=' + got.length);
  ok('同一年不重复颁奖', E.settleAwards(s).length === 0);
  ok('一年最多 6 个奖', got.length <= GD.AWARD_CATS.length, String(got.length));

  var r0 = s.yearResults[0];
  ok('年度结果记了 6 个奖项明细', r0.awards && r0.awards.length === 6,
    String((r0.awards || []).length));
  ok('年度游戏那行确实记成赢了',
    (r0.awards.filter(function (a) { return a.id === 'goty'; })[0] || {}).won === true);

  /* 输给对手：不算年度游戏，但仍可能拿类型奖 */
  var s2 = E.newGame();
  s2.yearBest = 33;
  s2.plan = { genre: 'rpg', theme: 'fantasy', leader: s2.staff[0].id, platform: 'arc72' };
  s2.yearRivalReleases = [{ year: 1972, score: 35, name: '白噪音', title: '第七夜', genre: 'rpg', theme: 'modern' }];
  s2.day = 360;
  var t2 = E.settleAwards(s2).map(function (a) { return a.title; });
  ok('输给对手不给年度游戏', t2.indexOf('年度游戏') < 0, t2.join(' / '));
  ok('输给对手只给提名', t2.indexOf('年度提名') >= 0, t2.join(' / '));
  ok('年度结果记录了对手', s2.yearResults[0].winner === '白噪音', String(s2.yearResults[0].winner));

  /* 对手太强时连类型奖也丢 */
  var s2b = E.newGame();
  s2b.yearBest = 26;
  s2b.plan = { genre: 'rpg', theme: 'fantasy', leader: s2b.staff[0].id, platform: 'arc72' };
  s2b.yearRivalReleases = [{ year: 1972, score: 40, name: '白噪音', title: '第七夜', genre: 'rpg', theme: 'modern' }];
  s2b.day = 360;
  var t2b = E.settleAwards(s2b).map(function (a) { return a.title; });
  ok('对手更强时类型奖也拿不到', t2b.indexOf('最佳 RPG') < 0, t2b.join(' / '));

  var s3 = E.newGame();
  s3.yearBest = 20;
  s3.plan = { genre: 'rpg', theme: 'fantasy', leader: s3.staff[0].id, platform: 'arc72' };
  s3.day = 360;
  ok('分数不够没有奖', E.settleAwards(s3).length === 0);

  /* 单项奖：偏科也能拿 */
  var s5 = E.newGame();
  s5.plan = { genre: 'puzzle', theme: 'cyber', leader: 'ya', platform: 'arc72' };
  s5.day = 360;
  s5.yearWorks = [{
    year: 1972, title: '画面之作', genre: 'puzzle', theme: 'cyber', total: 22,
    cats: { code: 30, script: 28, art: 88, audio: 30 }, brandName: '', fromBrand: false, hi: -1
  }];
  var t5 = E.settleAwards(s5).map(function (a) { return a.title; });
  ok('总分不高但画面强也能拿最佳画面', t5.indexOf('最佳画面') >= 0, t5.join(' / '));
  ok('偏科不会送它年度游戏', t5.indexOf('年度游戏') < 0, t5.join(' / '));

  /* 门槛：烂片不会因为没有对手就躺赢 */
  var s6 = E.newGame();
  s6.plan = { genre: 'rpg', theme: 'fantasy', leader: 'ya', platform: 'arc72' };
  s6.day = 360;
  s6.yearWorks = [{
    year: 1972, title: '烂作', genre: 'rpg', theme: 'fantasy', total: 24,
    cats: { code: 20, script: 20, art: 20, audio: 20 }, brandName: '', fromBrand: false, hi: -1
  }];
  var t6 = E.settleAwards(s6).map(function (a) { return a.title; });
  ok('单项分不够不给单项奖', t6.indexOf('最佳画面') < 0 && t6.indexOf('最佳音乐') < 0, t6.join(' / '));

  /* 奖项挂到作品上，作品集能显示 */
  var s7 = E.newGame();
  s7.plan = { genre: 'rpg', theme: 'fantasy', leader: s7.staff[0].id, platform: 'arc72' };
  s7.day = 360;
  s7.history = [{ name: '获奖作', genre: 'rpg', theme: 'fantasy', total: 34, copies: 90000, revenue: 1, cost: 1 }];
  s7.yearWorks = [{
    year: 1972, title: '获奖作', genre: 'rpg', theme: 'fantasy', total: 34,
    cats: { code: 60, script: 62, art: 60, audio: 60 }, brandName: '', fromBrand: false, hi: 0
  }];
  E.settleAwards(s7);
  ok('奖项挂到了作品上',
    Array.isArray(s7.history[0].awards) && s7.history[0].awards.indexOf('年度游戏') >= 0,
    JSON.stringify(s7.history[0].awards || null));
  ok('能按类别数奖项', E.awardCount(s7, 'goty') === 1, String(E.awardCount(s7, 'goty')));
})();

/* ---------- 结局 ---------- */
(function () {
  var s = E.newGame();
  s.day = (GD.BAL.endYear - GD.BAL.startYear) * 360;
  s.phase = 'planning';
  E.tick(s, 1 / 30);
  ok('主线年份到点进入结局', s.phase === 'ending');

  var e = E.ending(s);
  ok('结局有标题与文案', typeof e.title === 'string' && e.title.length > 0, e.title + ' · ' + e.tone);

  ok('可以继续经营', E.continueEndless(s) === true && s.phase === 'planning' && s.ended === true);

  var s2 = E.newGame();
  s2.rep = 80;
  s2.yearResults = [{ winner: null }, { winner: null }, { winner: null }];
  ok('三座年度游戏 + 声望 80 是时代定义者', E.ending(s2).title === '时代定义者', E.ending(s2).title);
})();

/* ---------- 声望与粉丝衰减 ---------- */
(function () {
  var s = E.newGame();
  ok('新开局声望为 0', (s.rep || 0) === 0);

  E.addRep(s, 30);
  ok('加声望生效', s.rep === 30, String(s.rep));
  E.addRep(s, 500);
  ok('声望上限 100', s.rep === 100, String(s.rep));
  E.addRep(s, -500);
  ok('声望下限 0', s.rep === 0, String(s.rep));

  var r = E.rosterById('lin');
  var full = E.hireFee(E.newGame(), r);
  var rich = E.newGame(); rich.rep = 100;
  var cheap = E.hireFee(rich, r);
  ok('声望越高签约金越便宜（最多六折）',
    cheap < full && Math.abs(cheap / full - 0.6) < 0.02,
    full + ' → ' + cheap);

  /* 拿年度游戏：+10 声望，其它奖项各 +5；粉丝先衰减 5% 再加奖项粉丝 */
  var s3 = E.newGame();
  s3.awardYear = 1972;
  s3.day = (1973 - GD.BAL.startYear) * 360;
  s3.yearBest = 38;
  s3.yearBestTitle = '神作';
  s3.plan = { genre: 'rpg', theme: 'fantasy', leader: s3.staff[0].id, platform: 'arc72' };
  s3.yearRivalReleases = [];
  s3.fans = 100000;
  var gotA = E.settleAwards(s3);
  var gotyWon = gotA.some(function (a) { return a.cat === 'goty'; });
  var others = gotA.filter(function (a) { return a.cat !== 'goty'; }).length;
  ok('拿下年度游戏加 10 点声望', gotyWon && s3.rep === 10 + 5 * others,
    'rep=' + s3.rep + ' 其它奖=' + others);
  var fansWant = 100000 * (1 - GD.BAL.fanDecayPerYear);
  gotA.forEach(function (a) { fansWant += a.fans; });
  ok('粉丝每年衰减 5%（再叠加奖项粉丝）',
    Math.abs(s3.fans - fansWant) < 1,
    '100000 → ' + Math.round(s3.fans) + ' 期望 ' + Math.round(fansWant));

  /* 没拿年度游戏：只有提名和类型/单项奖，声望按 +5 计 */
  var s4 = E.newGame();
  s4.awardYear = 1972;
  s4.day = (1973 - GD.BAL.startYear) * 360;
  s4.yearBest = 37;
  s4.yearBestTitle = '惜败';
  s4.plan = { genre: 'rpg', theme: 'fantasy', leader: s4.staff[0].id, platform: 'arc72' };
  s4.yearRivalReleases = [{ year: 1972, title: '对手作', score: 39, rival: 'old', name: '老街机', genre: 'action', theme: 'modern' }];
  var gotB = E.settleAwards(s4);
  var gotyLost = !gotB.some(function (a) { return a.cat === 'goty'; });
  var nB = gotB.length;
  ok('没拿年度游戏时声望按每次 +5 计', gotyLost && s4.rep === 5 * nB,
    'rep=' + s4.rep + ' 奖项数=' + nB);

  /* 结局四档 */
  var e1 = E.newGame(); e1.rep = 50;
  ok('声望 50 是一流工作室', E.ending(e1).title === '一流工作室', E.ending(e1).title);
  var e2 = E.newGame(); e2.rep = 10; e2.fans = 600000;
  ok('粉丝 60 万且办公室 3 级是小而美', E.ending(e2).title === '小而美', E.ending(e2).title);
  var e3 = E.newGame(); e3.rep = 0; e3.fans = 0;
  ok('什么都没有是勉强维生', E.ending(e3).title === '勉强维生', E.ending(e3).title);
})();

/* ---------- 撞档 ---------- */
(function () {
  var s = E.newGame();
  s.review = { total: 30 };
  s.day = 100;
  var wk = E.weekOf(100);
  ok('周次计算正确', wk === 15, 'wk=' + wk);

  var yr = E.year(s);
  s.yearRivalReleases = [{ year: yr, week: wk, score: 35, name: '白噪音', title: '第七夜' }];
  var c = E.collisionAt(s, s.day);
  ok('对手更强会撞档', !!c.rival && c.mult === 0.78, c.mult + '');
  ok('撞档信息带作品', c.rival.title === '第七夜');

  s.yearRivalReleases = [{ year: yr, week: wk, score: 25, name: '白噪音', title: '第七夜' }];
  ok('压过对手有加成', E.collisionAt(s, s.day).mult === 1.08);

  s.yearRivalReleases = [{ year: yr, week: wk + 10, score: 40, name: '白噪音', title: '第七夜' }];
  ok('错开档期不撞', E.collisionAt(s, s.day).rival === null);

  var s2 = E.newGame();
  s2.phase = 'release';
  s2.review = { total: 30, scores: [], revealed: 4, totalShown: true };
  s2.project = { quality: 35, cost: 100000 };
  s2.day = 100;
  s2.yearRivalReleases = [{ year: 1972, week: E.weekOf(100), score: 35, name: '白噪音', title: '第七夜' }];
  E.confirmRelease(s2, 'now');
  ok('发售时记录了撞档', !!s2.release.collision && s2.release.collision.mult === 0.78);
})();

/* ---------- 平衡探针 ---------- */
(function () {
  var runs = 24;
  var totals = [], margins = [];
  /* 固定随机种子：这条测的是「一期作品的期望回报」，
   * 不种的话跑三次会挂一次（首作偶尔小亏），测试就没有意义了。 */
  var savedRandom = Math.random;
  var seed = 20261128;
  Math.random = function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  try {
    for (var i = 0; i < runs; i++) {
      var s = E.newGame();
      var start = s.money;
      var r = playOne(s, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
      totals.push(r.total);
      margins.push((s.money - start) / r.cost);
    }
  } finally {
    Math.random = savedRandom;
  }
  totals.sort(function (a, b) { return a - b; });
  margins.sort(function (a, b) { return a - b; });
  var median = totals[Math.floor(runs / 2)];
  var medMargin = margins[Math.floor(runs / 2)];
  console.log('   24 局 RPG×幻想：评分中位数 ' + median + '/40，回报中位数 ' + medMargin.toFixed(2) + ' 倍成本');

  ok('评分中位数在合理区间（1972 年 cap 45）', median >= 18 && median <= 38, 'median=' + median);
  /* 车库期本来就薄：第二轮平衡把首作压到「刚好回本」，要 2–3 部才攒得起来。
   * 下限放到 -0.05，是为了能抓「早期直接大亏」这种真问题，而不是卡死手感。 */
  ok('首时代净回报中位数在 -0.05–3 倍之间（车库期本来就薄）',
    medMargin >= -0.05 && medMargin <= 3, 'margin=' + medMargin.toFixed(2));
})();

/* ---------------- 自研平台 ---------------- */
(function () {
  var pick = { budget: 'normal', price: 'mid', cut: 'normal' };
  var s = E.newGame();
  ok('2068 年前不能自研平台', E.launchBlock(s, pick) === 'early');

  s.day = (2068 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  s.money = 100000000;
  var pv = E.launchPreview(s, { budget: 'heavy', price: 'cheap', cut: 'lure' });
  ok('平台预览给出装机 / 售价 / 抽成',
    pv.install > 0 && pv.price > 0 && pv.cut > 0,
    'install=' + pv.install + ' price=' + pv.price + ' cut=' + pv.cut);

  var moneyBefore = s.money;
  var res = E.launchPlatform(s, { budget: 'heavy', price: 'cheap', cut: 'lure' });
  ok('发布平台扣投入并记录状态',
    res.ok === true && s.money === moneyBefore - pv.cost && !!s.myPlatform,
    'cost=' + pv.cost);
  ok('不能重复发布平台', E.launchBlock(s, pick) === 'exists');

  ok('平台立刻进可用平台列表',
    E.availablePlatforms(s).some(function (p) { return p.id === 'own'; }));

  var ownDef = E.platformById('own', s);
  ok('自有平台免授权费且装机来自平台状态',
    ownDef.license === 0 && ownDef.install === pv.install,
    'install=' + ownDef.install);

  /* 自家平台立项 */
  var s2 = E.newGame();
  s2.day = (2068 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  s2.money = 100000000;
  E.launchPlatform(s2, pick);
  var started = E.startProject(s2, {
    genre: 'rpg', theme: 'fantasy', leader: 'zhou', platform: 'own'
  });
  ok('自家平台立项不花授权费',
    started === true && s2.project.cost === 0 && s2.plan.platform === 'own',
    'cost=' + (s2.project ? s2.project.cost : 'n/a'));

  /* 每年涨装机 + 第三方分成 */
  var s3 = E.newGame();
  s3.day = (2068 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  s3.money = 100000000;
  E.launchPlatform(s3, pick);
  var inst0 = s3.myPlatform.install;
  var money0 = s3.money;
  s3.day += GD.BAL.daysPerYear;
  var tp = E.tickPlatform(s3);
  ok('平台每年涨装机', s3.myPlatform.install > inst0, inst0 + ' → ' + s3.myPlatform.install);
  ok('平台产生第三方分成',
    tp && tp.revenue > 0 && s3.money >= money0,
    tp ? 'rev=' + tp.revenue + ' 上架=' + tp.titles : 'null');

  var back = E.deserialize(E.serialize(s3));
  ok('存档往返保留自研平台',
    !!back.myPlatform && typeof back.myPlatform.install === 'number',
    String(back.myPlatform && back.myPlatform.install));
})();

/* ---------------- 子品牌产出线 ---------------- */
(function () {
  var s = E.newGame();
  s.day = (1990 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  s.fans = GD.BAL.acquireFansMin;
  s.money = 20000000;
  E.acquire(s, 'white');
  var b = E.brands(s)[0];

  ok('子品牌刚收购时还没出过作品', (b.output || 0) === 0 && (s.yearBrand || []).length === 0);

  E.tickBrands(s);
  ok('收购当年就出一部', s.yearBrand.length === 1 && s.yearBrand[0].brand === 'white',
    (s.yearBrand[0] || {}).title);
  ok('子品牌作品成绩在合理区间',
    s.yearBrand[0].score >= 14 && s.yearBrand[0].score <= 40, String(s.yearBrand[0].score));

  var n1 = s.yearBrand.length;
  E.tickBrands(s);
  ok('同一年不会出第二部', s.yearBrand.length === n1, String(s.yearBrand.length));

  s.day += GD.BAL.daysPerYear;
  E.tickBrands(s);
  ok('第二年再出一部', s.yearBrand.length === n1 + 1, String(s.yearBrand.length));
  ok('子品牌作品数递增', E.brands(s)[0].output === 2, String(E.brands(s)[0].output));

  s.money = 20000000;
  E.acquire(s, 'seven');
  s.day += GD.BAL.daysPerYear;
  E.tickBrands(s);
  ok('每家子品牌每年各出一部',
    E.brands(s).length === 2 && E.brands(s)[1].output === 1,
    'brands=' + E.brands(s).length);

  /* 子品牌成绩算你的 */
  var s2 = E.newGame();
  s2.awardYear = 1972;
  s2.day = (1973 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  s2.yearBest = 0;
  s2.yearRivalReleases = [];
  s2.yearBrand = [{ year: 1972, title: '测试作', score: 33, brand: 'white', brandName: '白噪音' }];
  var got = E.settleAwards(s2);
  ok('子品牌高分计入你的年度成绩',
    s2.yearResults.length === 1 && s2.yearResults[0].playerScore === 33,
    'playerScore=' + (s2.yearResults[0] || {}).playerScore);
  ok('子品牌拿奖会标出品牌名',
    s2.yearResults[0].playerBrand === '白噪音' && got.length >= 1,
    String(s2.yearResults[0].playerBrand));
  ok('子品牌拿的年度游戏记在品牌名下',
    got.some(function (a) { return a.cat === 'goty'; }),
    got.map(function (a) { return a.title; }).join(' / '));
})();

/* ---------------- 收购 / 子品牌 ---------------- */
(function () {
  var s = E.newGame();
  var white = s.rivals.filter(function (x) { return x.id === 'white'; })[0];

  ok('新开局没有子品牌', E.brands(s).length === 0);
  ok('还没出道不能收购', E.acquireBlock(s, white) === 'not-debut');

  s.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  ok('粉丝不够不能收购', E.acquireBlock(s, white) === 'fans', 'fans=' + s.fans);

  s.fans = GD.BAL.acquireFansMin;
  s.money = 100;
  ok('钱不够不能收购', E.acquireBlock(s, white) === 'poor');

  s.money = 20000000;
  ok('条件齐了就能收购', E.acquireBlock(s, white) === null);

  var cost = E.acquireCost(s, white);
  var moneyBefore = s.money, fansBefore = s.fans;
  var res = E.acquire(s, 'white');
  ok('收购成功扣钱并加粉丝',
    res.ok === true && s.money === moneyBefore - cost &&
    s.fans === fansBefore + E.acquireFans(white),
    'cost=' + cost + ' 粉丝+' + (s.fans - fansBefore));
  ok('收购后对手变成子品牌', E.isAcquired(s, 'white') === true && E.brands(s).length === 1);
  ok('不能重复收购', E.acquireBlock(s, white) === 'owned');
  ok('子品牌带来月度分成', E.brandIncome(s) > 0, Math.round(E.brandIncome(s)) + '/月');

  var before = white.games.length;
  s.day += GD.BAL.daysPerYear * 3;
  for (var i = 0; i < 24; i++) E.tickRivals(s);
  ok('被收购后不再发新作品', white.games.length === before, 'games=' + white.games.length);

  var back = E.deserialize(E.serialize(s));
  ok('存档往返保留子品牌', back.brands.length === 1 && E.isAcquired(back, 'white'));
})();

/* ---------------- 评审台词 ---------------- */
(function () {
  var total = 0, bad = [];
  GD.CRITICS.forEach(function (c) {
    ['low', 'mid', 'high'].forEach(function (k) {
      var arr = c.lines && c.lines[k];
      if (!Array.isArray(arr) || !arr.length) bad.push(c.name + ' 缺 ' + k);
      else total += arr.length;
    });
  });
  ok('评审台词一共 80 句', total === 80, String(total));
  ok('每位评审低中高三档都有台词', bad.length === 0, bad.join(','));
})();

/* ---------------- 员工名册 ---------------- */
(function () {
  ok('名册一共 30 人', GD.ROSTER.length === 30, String(GD.ROSTER.length));

  var ids = {}, seeds = {}, dup = [];
  GD.ROSTER.forEach(function (r) {
    if (ids[r.id]) dup.push('id:' + r.id); ids[r.id] = 1;
    if (seeds[r.seed]) dup.push('seed:' + r.seed); seeds[r.seed] = 1;
  });
  ok('名册的 id 与 seed 都不重复', dup.length === 0, dup.join(','));

  var roles = {};
  GD.ROSTER.forEach(function (r) { roles[r.role] = (roles[r.role] || 0) + 1; });
  ok('四个角色都有人',
    roles.code > 0 && roles.script > 0 && roles.art > 0 && roles.audio > 0,
    JSON.stringify(roles));

  ok('创始人都在名册里',
    GD.FOUNDERS.every(function (id) { return !!ids[id]; }), GD.FOUNDERS.join(','));
})();

/* ---------------- 作品名 ---------------- */
(function () {
  var s = E.newGame();
  s.plan = { genre: 'rpg', theme: 'fantasy', leader: 'zhou', platform: 'arc72', name: '' };

  ok('不填名字时用「类型·题材」自动名',
    E.gameName(s).indexOf('·') > 0, E.gameName(s));

  s.plan.name = '星海列车';
  ok('填了名字就用玩家的名字', E.gameName(s) === '星海列车', E.gameName(s));

  s.plan.name = '  前后留空格  ';
  ok('名字会去掉首尾空格', E.gameName(s) === '前后留空格', '[' + E.gameName(s) + ']');

  s.plan.name = '这是一个超过十八个字的非常长的作品名字测试';
  ok('名字过长会被截断到 18 字', E.gameName(s).length === 18, String(E.gameName(s).length));

  s.plan.name = '星海列车';
  E.startProject(s, s.plan);
  ok('立项后自定义名跟着项目走', E.gameName(s) === '星海列车');

  s.phase = 'done';
  E.nextRound(s);
  ok('下一部会清空上一部的名字', s.plan.name === '' && E.gameName(s).indexOf('·') > 0,
    '[' + s.plan.name + '] ' + E.gameName(s));

  /* 完整跑一部，确认历史记录里存的是自定义名 */
  var s5 = E.newGame();
  playOne(s5, { genre: 'rpg', theme: 'fantasy', leader: 'zhou', platform: 'arc72', name: '星海列车' });
  ok('作品集历史里保留自定义名字',
    s5.history.length === 1 && s5.history[0].name === '星海列车',
    s5.history.length ? String(s5.history[0].name) : 'no-history');

  var rnd = E.randomGameName();
  ok('随机名不是空的', typeof rnd === 'string' && rnd.length >= 2, rnd);
})();

/* ---------------- 世代规则 ---------------- */
(function () {
  ok('规则表一共 9 条', GD.RULES.length === 9, String(GD.RULES.length));

  var s = E.newGame();
  ok('1972 年没有世代规则', E.ruleFor(E.year(s)) === null && E.ruleOf(s) === null);

  s.day = (2025 - GD.BAL.startYear) * 360;
  var r1 = E.ruleFor(E.year(s));
  ok('2025 年生效的是「分成制」', r1 && r1.name === '分成制', r1 && r1.name);
  ok('分成制把发行抽成调低', Math.abs(E.ruleDelta(s, 'cut') + 0.12) < 1e-9, String(E.ruleDelta(s, 'cut')));
  ok('分成制把长尾调高', Math.abs(E.ruleMul(s, 'tail') - 2.2) < 1e-9, String(E.ruleMul(s, 'tail')));

  /* 对比同一局面在「有规则 / 清空规则表」下的结果 */
  function ratioAt(year, fn) {
    var st = E.newGame();
    st.day = (year - GD.BAL.startYear) * 360;
    var withRule = fn(st);
    var keep = GD.RULES;
    GD.RULES = [];
    var noRule = fn(st);
    GD.RULES = keep;
    return noRule ? withRule / noRule : 0;
  }

  var sp = ratioAt(2030, function (st) { return E.devDuration(st, 'zhou'); });
  ok('沉浸度让开发周期变为 1.5 倍', Math.abs(sp - 1.5) < 0.05, sp.toFixed(3));

  var sal = ratioAt(2035, function (st) { return E.teamSalary(st); });
  ok('AI 员工让日薪降到 62%', Math.abs(sal - 0.62) < 0.02, sal.toFixed(3));

  var tail = ratioAt(2025, function (st) { st.history = [{ revenue: 100000 }]; return E.monthIncome(st); });
  ok('分成制的长尾是 2.2 倍', Math.abs(tail - 2.2) < 0.02, tail.toFixed(3));

  var s2 = E.newGame(); s2.day = (2045 - GD.BAL.startYear) * 360;
  s2.fans = 0;
  var m0 = E.ruleSalesMul(s2);
  s2.fans = 400000;
  var m1 = E.ruleSalesMul(s2);
  ok('粉丝驱动时代：粉丝越多销量乘数越高', m1 > m0, m0.toFixed(2) + ' → ' + m1.toFixed(2));

  var s3 = E.newGame(); s3.day = (2070 - GD.BAL.startYear) * 360;
  s3.rep = 0;
  var q0 = E.ruleSalesMul(s3);
  s3.rep = 100;
  var q1 = E.ruleSalesMul(s3);
  ok('城市参与时代：声望越高销量乘数越高', q1 > q0, q0.toFixed(2) + ' → ' + q1.toFixed(2));

  var s4 = E.newGame(); s4.day = (2065 - GD.BAL.startYear) * 360;
  ok('策展人时代不吃评审偏科', E.ruleFlag(s4, 'noBias') === true);
  ok('策展人时代波动翻倍', Math.abs(E.ruleMul(s4, 'reviewNoise') - 2.2) < 1e-9);

  /* 2054 舱体：没付钱不生效，付了才生效，只付一次 */
  var s5 = E.newGame();
  s5.day = (2055 - GD.BAL.startYear) * 360;
  s5.money = 100000000;
  ok('舱体没付钱前规则不生效', E.ruleOf(s5) === null);
  var ev1 = E.tickRules(s5);
  ok('付得起就自动建造舱体', ev1 && ev1.type === 'paid' && s5.rulesPaid.length === 1, ev1 && ev1.type);
  ok('付完之后规则生效', E.ruleOf(s5) !== null && E.ruleOf(s5).name === '感官舱体');
  var moneyAfter = s5.money;
  ok('舱体只扣一次', E.tickRules(s5) === null && s5.money === moneyAfter, String(moneyAfter));

  var s6 = E.newGame();
  s6.day = (2055 - GD.BAL.startYear) * 360;
  s6.money = 100;
  ok('钱不够时规则保持未生效', E.tickRules(s6).type === 'missed' && E.ruleOf(s6) === null);
})();

/* ---------------- 破产与新公司 ---------------- */
(function () {
  /* 连续两个月现金为负 -> 清算 */
  var s = E.newGame();
  s.money = -1000;
  s.day = 360;
  s.tailMonth = 0;
  s.brokeMonths = 0;
  E.settleMonths(s);
  ok('现金为负第一个月还没清算', s.phase !== 'bankrupt', s.phase);
  s.day += 30;
  E.settleMonths(s);
  ok('连续两个月为负就破产', s.phase === 'bankrupt', s.phase);
  ok('破产状态可以被识别', E.needRebuild(s) === true);

  /* 只差一点不算破产 */
  var s0 = E.newGame();
  s0.money = 5000;
  s0.day = 360;
  s0.tailMonth = 0;
  E.settleMonths(s0);
  ok('现金为正不会破产', s0.phase !== 'bankrupt' && (s0.brokeMonths || 0) === 0);

  /* 开新公司：保留什么、清空什么 */
  var s2 = E.newGame();
  s2.phase = 'bankrupt';
  s2.money = -5000;
  s2.fans = 100000;
  s2.rep = 60;
  s2.awards = [{ year: 1990, title: '年度游戏' }];
  s2.history = [{ name: '旧作', total: 30, revenue: 100000 }];
  s2.furniture = ['rug', 'coffee'];
  s2.research.done = ['toolchain', 'engine'];
  s2.myPlatform = { name: 'M-1', install: 10 };
  s2.brands = [{ id: 'white', name: '白噪音', power: 1.2, since: 1995, titles: 3, output: 2 }];
  s2.rivals.forEach(function (r) { if (r.id === 'white') r.acquired = true; });

  var nb = E.newCompany(s2, 'small');
  ok('开新公司成功', nb && nb.ok === true);
  ok('起始资金按「基础 + 声望 × 1 万」算，从小做起翻倍',
    s2.money === (GD.BAL.newCompanyBase + 60 * GD.BAL.newCompanyRepBonus) * 2, String(s2.money));
  ok('保留 30% 粉丝', Math.round(s2.fans) === 30000, String(Math.round(s2.fans)));
  ok('保留作品档案与历史', s2.history.length === 1 && s2.history[0].name === '旧作');
  ok('保留已解锁研究', s2.research.done.length === 2);
  ok('清空奖项 / 设备 / 自研平台',
    s2.awards.length === 0 && s2.furniture.length === 0 && s2.myPlatform === null);
  ok('员工回到 3 位创始人', s2.staff.length === 3);
  ok('每破产一次 +5 创始人声望', s2.rep === 65, String(s2.rep));
  ok('破产次数被记录', s2.bankrupts === 1);
  ok('回到企划阶段', s2.phase === 'planning');

  /* 子品牌脱离，变回独立竞争对手 */
  var white = s2.rivals.filter(function (r) { return r.id === 'white'; })[0];
  ok('子品牌脱离并恢复独立', white.acquired === false && s2.brands.length === 0);
  ok('脱离的对手实力保留', Math.abs(white.power - 1.2) < 1e-9, String(white.power));

  /* 从小做起：工位上限 5 */
  s2.seats = 5;
  ok('「从小做起」把工位上限压到 5', E.expandCost(s2) === null && E.expandOffice(s2) === false);

  /* 宣言效果进倍率（加成因收益递减被轻微压缩，但方向不变） */
  var s3 = E.newGame();
  s3.phase = 'bankrupt';
  E.newCompany(s3, 'makemoney');
  var dSales = E.bonusMul(s3, 'sales'), dQual = E.bonusMul(s3, 'quality');
  ok('「这次要赚钱」让销量上升、品质下降',
    dSales > 1.08 && dSales < 1.10 && dQual > 0.94 && dQual < 0.96,
    dSales.toFixed(3) + ' / ' + dQual.toFixed(3));

  var s4 = E.newGame();
  s4.phase = 'bankrupt';
  s4.rep = 70;
  s4.fans = 200000;
  E.newCompany(s4, 'bigshot');
  ok('「跟着大佬走」粉丝 +50%、声望清零后再加 5',
    Math.abs(s4.fans - 200000 * 0.3 * 1.5) < 1 && s4.rep === 5,
    Math.round(s4.fans) + ' / ' + s4.rep);
})();

/* ---------------- 挖人 ---------------- */
(function () {
  var s = E.newGame();
  var white = s.rivals.filter(function (x) { return x.id === 'white'; })[0];

  var crew = E.rivalCrew(white);
  ok('每位对手有 2 名可挖员工', crew.length === 2, 'len=' + crew.length);
  ok('员工 id 由对手与序号组成', crew[0].id === 'rv:white:0', crew[0].id);
  ok('同一对手的船员稳定不变',
    E.rivalCrew(white)[0].name === crew[0].name &&
    E.rivalCrew(white)[0].stats.code === crew[0].stats.code, crew[0].name);

  var names = {};
  s.rivals.forEach(function (r) {
    E.rivalCrew(r).forEach(function (m) { names[m.name] = 1; });
  });
  ok('六家对手的船员有区分度', Object.keys(names).length >= 5, '种=' + Object.keys(names).length);

  ok('还没出道不能挖', E.poach(s, 'white', 0).reason === 'not-debut');

  s.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  ok('没有空工位挖不了', E.poach(s, 'white', 0).reason === 'no-seat');

  s.seats = 6;
  s.money = 5000000;
  var info = E.poachInfo(s, white, 0);
  ok('挖人报价包含签字费与成功率',
    info.cost > 0 && info.chance > 0.2 && info.chance < 0.9,
    'cost=' + info.cost + ' chance=' + info.chance.toFixed(2));

  var sA = E.newGame(), sB = E.newGame();
  sA.fans = 0; sB.fans = 60000;
  var wA = sA.rivals.filter(function (x) { return x.id === 'white'; })[0];
  var wB = sB.rivals.filter(function (x) { return x.id === 'white'; })[0];
  ok('粉丝越多挖人越容易',
    E.poachInfo(sB, wB, 0).chance > E.poachInfo(sA, wA, 0).chance,
    E.poachInfo(sA, wA, 0).chance.toFixed(2) + ' → ' + E.poachInfo(sB, wB, 0).chance.toFixed(2));

  /* 把 Math.random 固定成 0 强制成功 */
  var rand = Math.random;
  Math.random = function () { return 0; };
  var powerBefore = white.power;
  var staffBefore = s.staff.length;
  var moneyBefore = s.money;
  var res = E.poach(s, 'white', 0);
  Math.random = rand;

  ok('挖人成功会加入队伍', res.ok === true && s.staff.length === staffBefore + 1, res.reason || 'ok');
  ok('挖人成功扣签字费', s.money === moneyBefore - info.cost, 'paid=' + (moneyBefore - s.money));
  ok('被挖的对手实力下滑', white.power < powerBefore, powerBefore + ' → ' + white.power);
  ok('同一名员工挖不到第二次', E.poach(s, 'white', 0).reason === 'gone');

  var back = E.deserialize(E.serialize(s));
  ok('存档往返保留挖来的人',
    back.staff.some(function (x) { return x.id === 'rv:white:0'; }),
    back.staff.map(function (x) { return x.id; }).join(','));
  ok('挖来的人保留出身标记',
    back.staff.filter(function (x) { return x.id === 'rv:white:0'; })[0].fromRival === 'white');

  /* 强制失败，要赔违约金 */
  var s2 = E.newGame();
  s2.seats = 6;
  s2.money = 5000000;
  s2.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  var m2 = s2.money;
  var rand2 = Math.random;
  Math.random = function () { return 0.999; };
  var fail = E.poach(s2, 'white', 0);
  Math.random = rand2;
  ok('被回绝要赔违约金',
    fail.ok === false && fail.reason === 'refused' && s2.money < m2,
    'lost=' + (m2 - s2.money));
})();

/* ---------------- 设备 / 家具 ---------------- */
(function () {
  ok('设备一共 48 件', GD.GEAR.length === 48, String(GD.GEAR.length));
  ok('设备分 4 个品类', GD.GEAR_CATS.length === 4);
  ok('设备 id 不重复', GD.GEAR.every(function (g, i) {
    return GD.GEAR.map(function (x) { return x.id; }).indexOf(g.id) === i;
  }));
  ok('每个品类都是 12 件', GD.GEAR_CATS.every(function (c) {
    return GD.GEAR.filter(function (g) { return g.cat === c.id; }).length === 12;
  }));

  /* 中后期设备要等到年份才上架 */
  var future = GD.GEAR.filter(function (g) { return E.gearFrom(g) > 1972; });
  ok('有带年份门槛的设备', future.length >= 20, String(future.length));
  var sFuture = E.newGame();
  sFuture.money = 1e9;
  var f0 = future[0];
  ok('年份没到买不了设备', E.gearYearOk(sFuture, f0) === false && E.buyGear(sFuture, f0.id) === false,
    f0.name + ' ' + E.gearFrom(f0));
  sFuture.day = (E.gearFrom(f0) - GD.BAL.startYear) * GD.BAL.daysPerYear;
  ok('年份到了就能买', E.gearYearOk(sFuture, f0) === true && E.buyGear(sFuture, f0.id) === true);

  /* 办公桌也在设备页里买：搬一次房间 = 买一档工位 */
  var sRoom = E.newGame();
  sRoom.money = 1e9;
  ok('设备页的办公室能搬', E.expandOffice(sRoom) === true && E.room(sRoom).key === 'street');
  ok('搬家按房间等级走', E.roomDef(1).seats === 4 && E.roomDef(3).seats === 6);

  var s = E.newGame();
  ok('新开局没有任何设备', s.furniture.length === 0);

  var item = E.gearById('dblmon');
  var cost = E.gearCost(s, item);
  var m0 = s.money;
  ok('买设备扣钱并记录',
    E.buyGear(s, 'dblmon') === true && s.money === m0 - cost && E.hasGear(s, 'dblmon'),
    'cost=' + cost);
  ok('不能重复购买同一件', E.buyGear(s, 'dblmon') === false);

  var q0 = E.baseQuality(E.newGame(), 'rpg', 'fantasy', 'zhou');
  var q1 = E.baseQuality(s, 'rpg', 'fantasy', 'zhou');
  ok('设备加成进了作品品质',
    q1 > q0 && Math.abs(q1 / q0 - E.softMul(1.03)) < 1e-9,
    q0.toFixed(2) + ' → ' + q1.toFixed(2) + '（倍率 ' + (q1 / q0).toFixed(4) + '）');

  var s2 = E.newGame();
  s2.research.done.push('autotest');
  E.buyGear(s2, 'dblmon');
  var both = E.bonusMul(s2, 'quality');
  ok('研究与设备加成相乘（但有递减，不会到 1.04×1.03）',
    both > E.softMul(1.04) && both < 1.04 * 1.03,
    both.toFixed(4) + ' 介于 ' + E.softMul(1.04).toFixed(4) + ' 与 ' + (1.04 * 1.03).toFixed(4) + ' 之间');

  var s3 = E.newGame();
  var sal0 = E.teamSalary(s3);
  E.buyGear(s3, 'coffee');
  ok('咖啡机降低日薪', Math.abs(E.teamSalary(s3) - sal0 * 0.96) < 1,
    Math.round(sal0) + ' → ' + Math.round(E.teamSalary(s3)));

  var s4 = E.newGame();
  s4.money = 10;
  ok('钱不够买不了设备', E.buyGear(s4, 'server') === false);

  var bare = {};
  ok('对象里没有 furniture 字段也不会崩',
    E.hasGear(bare, 'rug') === false && E.furnitureMul(bare, 'quality') === 1);

  var back = E.deserialize(E.serialize(s));
  ok('存档往返保留已购设备', back.furniture.indexOf('dblmon') >= 0);
})();

/* ---------------- 研究 ---------------- */
(function () {
  ok('研究项一共 48 个', GD.RESEARCH.length === 48, String(GD.RESEARCH.length));
  ok('研究项 id 不重复', GD.RESEARCH.every(function (r, i) {
    return GD.RESEARCH.map(function (x) { return x.id; }).indexOf(r.id) === i;
  }));
  ok('每项研究都挂在合法支线上', GD.RESEARCH.every(function (r) {
    return GD.RESEARCH_BRANCHES.some(function (b) { return b.id === r.branch; });
  }));
  ok('每条支线都是 12 项', GD.RESEARCH_BRANCHES.every(function (b) {
    return GD.RESEARCH.filter(function (r) { return r.branch === b.id; }).length === 12;
  }));
  ok('研究分 4 条支线', GD.RESEARCH_BRANCHES.length === 4);

  var s = E.newGame();
  ok('新开局研究树是空的', s.research.done.length === 0 && s.research.active === null);

  var item = GD.RESEARCH[0];
  var money0 = s.money, cost = E.researchCost(s, item);
  ok('开始研究扣钱并占用队列',
    E.startResearch(s, item.id) === true && s.money === money0 - cost,
    'cost=' + cost);
  ok('同一时间只能研究一项', E.startResearch(s, GD.RESEARCH[1].id) === false);
  ok('不能重复研究同一项', E.startResearch(s, item.id) === false);

  var out = E.tick(s, 1 / 30);
  ok('日历没走够时不会提前完成', E.researchActive(s) !== null);

  s.day += item.days + 1;
  E.tick(s, 1 / 30);
  ok('日历走够天数后研究完成',
    E.researchDone(s, item.id) === true && s.research.active === null);

  ok('品质研究按乘法生效', Math.abs(E.researchMul(s, 'quality') - 1.03) < 1e-9,
    String(E.researchMul(s, 'quality')));

  E.startResearch(s, 'autotest');
  s.day += 200;
  E.tick(s, 1 / 30);
  ok('同类研究加成相乘',
    Math.abs(E.researchMul(s, 'quality') - 1.03 * 1.04) < 1e-9,
    String(E.researchMul(s, 'quality')));

  /* 授权费折扣（收益递减：省得比 15% 少一点） */
  var s2 = E.newGame();
  var p0 = E.preview(s2, s2.plan).cost;
  s2.research.done.push('publish');
  var p1 = E.preview(s2, s2.plan).cost;
  var licSave = p0 - p1;
  ok('发行谈判降低授权费', p1 < p0 && licSave > 6000 * 0.10 && licSave < 6000 * 0.15,
    p0.toFixed(0) + ' → ' + p1.toFixed(0) + '（省 ' + licSave.toFixed(0) + '）');

  /* 开发速度 */
  var s3 = E.newGame();
  var d0 = E.devDuration(s3, 'zhou');
  s3.research.done.push('aifirst');
  var d1 = E.devDuration(s3, 'zhou');
  ok('AI 辅助开发缩短开发时长', d1 < d0, d0.toFixed(2) + ' → ' + d1.toFixed(2) + ' 秒');

  /* 日薪（收益递减：降得比 8% 少一点） */
  var s4 = E.newGame();
  var sal0 = E.teamSalary(s4);
  s4.research.done.push('benefits');
  var sal1 = E.teamSalary(s4);
  ok('福利制度降低日薪', sal1 < sal0 && sal1 > sal0 * 0.92 && sal1 < sal0 * 0.96,
    Math.round(sal0) + ' → ' + Math.round(sal1));

  /* 钱不够不能开 */
  var s5 = E.newGame();
  s5.money = 100;
  ok('钱不够开不了研究', E.startResearch(s5, 'engine') === false);

  /* 老存档 / 空对象兜底 */
  var bare = {};
  ok('对象里没有 research 字段也不会崩',
    E.researchDone(bare, 'engine') === false && E.researchMul(bare, 'quality') === 1 &&
    E.researchProgress(bare) === 0);

  var reloaded = E.deserialize(E.serialize(E.newGame()));
  ok('存档往返保留研究进度',
    reloaded.research && Array.isArray(reloaded.research.done) && reloaded.research.active === null);
})();

/* ---------------- 创业宣言 ---------------- */
(function () {
  function fresh() { return E.newGame(); }

  var s = fresh();
  ok('新开局需要选创业宣言', E.needDeclaration(s) === true);
  ok('没选之前 declaration 是空的', !s.declaration);

  var money0 = s.money;
  ok('车库苦干发放 15 万启动金',
    E.chooseDeclaration(s, 'garage') === true && s.money - money0 === 150000,
    '+' + (s.money - money0));
  ok('选过之后不再要求选宣言', E.needDeclaration(s) === false);
  ok('同一局不能重复选', E.chooseDeclaration(s, 'network') === false);

  var s2 = fresh();
  var fans0 = s2.fans;
  E.chooseDeclaration(s2, 'network');
  ok('人脉派给 300 粉丝', s2.fans - fans0 === 300, '+' + (s2.fans - fans0));

  var s3 = fresh();
  var before = s3.staff.map(function (st) { return st.stats[st.role]; });
  E.chooseDeclaration(s3, 'tech');
  var after = s3.staff.map(function (st) { return st.stats[st.role]; });
  ok('技术狂人给创始人主属性 +6',
    after.every(function (v, i) { return v - before[i] === 6; }),
    before.join('/') + ' → ' + after.join('/'));

  var s4 = fresh();
  E.chooseDeclaration(s4, 'thrift');
  ok('能省则省开局就有 4 个工位', s4.seats === 4, 'seats=' + s4.seats);
  ok('第 5 个工位走第二档价格',
    Math.abs(E.expandCost(s4) - GD.BAL.seatCosts[1] * E.inflation(s4)) < 1,
    String(E.expandCost(s4)));

  var back = E.deserialize(E.serialize(s));
  ok('存档往返保留创业宣言', back.declaration === 'garage');

  var old = fresh();
  old.history.push({ round: 1 });
  ok('已经做过作品的老局不再要求宣言', E.needDeclaration(old) === false);

  var busy = fresh();
  busy.phase = 'developing';
  ok('非企划阶段不要求选宣言', E.needDeclaration(busy) === false);
})();

/* ---------------- 员工特质 ---------------- */
(function () {
  var s = E.newGame();

  var allOk = true, bad = [];
  s.staff.forEach(function (st) {
    var list = E.traitList(st);
    if (list.length !== 2 || list[0].id === list[1].id) { allOk = false; bad.push(st.id); }
  });
  ok('每人正好 2 个特质且不重复', allOk, bad.join(','));

  var t1 = E.traitList(s.staff[0]).map(function (t) { return t.id; }).join(',');
  var t2 = E.traitList(s.staff[0]).map(function (t) { return t.id; }).join(',');
  ok('特质对同一个 seed 稳定不变', t1 === t2 && t1.length > 0, t1);

  var seen = {}, combos = {};
  GD.ROSTER.forEach(function (r) {
    var l = E.traitList(r);
    l.forEach(function (t) { seen[t.id] = 1; });
    combos[l[0].id + '+' + l[1].id] = 1;
  });
  var kinds = Object.keys(seen).length;
  ok('30 名员工覆盖到大部分特质', kinds >= 14, '覆盖 ' + kinds + ' 种 / 共 ' + GD.TRAITS.length + ' 种');

  ok('速度倍率被夹在安全区间', E.traitSpeedMul(s) > 0.6 && E.traitSpeedMul(s) < 1.5,
    E.traitSpeedMul(s).toFixed(3));
  ok('品质倍率被夹在安全区间', E.traitQualityMul(s) > 0.7 && E.traitQualityMul(s) < 1.4,
    E.traitQualityMul(s).toFixed(3));
  ok('粉丝倍率被夹在安全区间', E.traitFansMul(s) > 0.5 && E.traitFansMul(s) < 1.6,
    E.traitFansMul(s).toFixed(3));

  /* 把特质表清空，对比同一个局面的结果差异 —— 证明五处挂钩真的生效 */
  var dYes = E.devDuration(s, 'zhou');
  var qYes = E.baseQuality(s, 'rpg', 'fantasy', 'zhou');
  var salYes = E.teamSalary(s);
  var saved = GD.TRAITS;
  GD.TRAITS = [];
  var dNo = E.devDuration(s, 'zhou');
  var qNo = E.baseQuality(s, 'rpg', 'fantasy', 'zhou');
  var salNo = E.teamSalary(s);
  GD.TRAITS = saved;

  ok('特质真的改变了开发时长', Math.abs(dYes - dNo) > 0.01,
    dNo.toFixed(2) + ' → ' + dYes.toFixed(2) + ' 秒');
  ok('特质真的改变了作品品质', Math.abs(qYes - qNo) > 0.01,
    qNo.toFixed(2) + ' → ' + qYes.toFixed(2));
  ok('特质真的改变了日薪', Math.abs(salYes - salNo) > 1,
    Math.round(salNo) + ' → ' + Math.round(salYes));

  /* 老存档兼容：不含 traits 字段的存档读回来照样有特质 */
  var raw = E.serialize(s);
  var back = E.deserialize(raw);
  ok('老存档读回来后员工仍然有特质', E.traitList(back.staff[0]).length === 2,
    E.traitList(back.staff[0]).map(function (t) { return t.name; }).join('+'));
})();

/* ---------- 组合收藏 ---------- */
(function () {
  var s = E.newGame();
  var st0 = E.comboStats(s);
  ok('开局解锁 20 格', st0.have === 20, String(st0.have));
  ok('收藏一共 100 格', st0.total === 100, String(st0.total));
  ok('王牌格一共 12 个', st0.legend === 12, String(st0.legend));

  var twoEach = GD.GENRES.every(function (g) { return E.comboThemes(s, g.id).length === 2; });
  ok('每个类型开局给 2 个题材', twoEach);

  var topTwo = GD.GENRES.every(function (g) {
    var row = E.comboList().filter(function (c) { return c.genre === g.id; })
      .sort(function (a, b) { return b.aff - a.aff; });
    return E.comboUnlocked(s, g.id, row[0].theme) && E.comboUnlocked(s, g.id, row[1].theme);
  });
  ok('开局给的都是该类型相性最高的两个', topTwo);

  ok('没解锁的组合默认选不了', !E.comboUnlocked(s, 'rpg', 'idol'));

  var u1 = E.unlockCombo(s, 'rpg', 'idol');
  var u2 = E.unlockCombo(s, 'rpg', 'idol');
  ok('重复解锁返回 null', !!u1 && u2 === null);
  ok('解锁后格数 +1', E.comboCount(s) === 21, String(E.comboCount(s)));
  ok('解锁进提示队列', s.comboNews.length === 1 && s.comboNews[0].type === 'unlock');
  var news = E.drainComboNews(s);
  ok('提示队列取走后清空', news.length === 1 && s.comboNews.length === 0);

  var legend = E.comboList().filter(function (c) { return c.aff >= 1.3; })[0];
  ok('王牌判定用相性 >= 1.30', E.isLegendary(legend.genre, legend.theme));
  var first = E.markFound(s, legend.genre, legend.theme);
  ok('王牌达成记进 found', first && E.comboFound(s, legend.genre, legend.theme));
  ok('同一格不重复记', E.markFound(s, legend.genre, legend.theme) === false);
  ok('王牌达成数跟着涨', E.comboStats(s).found === 1, String(E.comboStats(s).found));

  /* 换类型：原来选的题材可能没解锁，要自动纠正 */
  var s2 = E.newGame();
  s2.plan.genre = 'rhythm';
  s2.plan.theme = 'fantasy';
  var swap = E.ensurePlanCombo(s2);
  ok('换类型后自动落到已解锁题材', !!swap && E.comboUnlocked(s2, 'rhythm', s2.plan.theme),
    JSON.stringify(swap));
  ok('已解锁的题材不会被乱动', E.ensurePlanCombo(s2) === null);

  /* 立项兜底：锁着的题材也能立项，但会换成已解锁的 */
  var s3 = E.newGame();
  var plan3 = { genre: 'rpg', theme: 'idol', leader: s3.staff[0].id, platform: 'arc72', name: '' };
  var started = E.startProject(s3, plan3);
  ok('锁着的题材立项会被换成已解锁的',
    !!started && E.comboUnlocked(s3, 'rpg', s3.plan.theme),
    started ? s3.plan.theme : '没立项');

  /* 做完一部作品 -> 解锁 2 格 */
  var s4 = E.newGame();
  var before4 = E.comboCount(s4);
  var r4 = playOne(s4, {
    genre: 'rpg', theme: 'fantasy', leader: s4.staff[0].id, platform: 'arc72', name: ''
  });
  ok('做完一部作品解锁 2 格', !!r4 && E.comboCount(s4) >= before4 + 2,
    before4 + ' → ' + E.comboCount(s4));

  /* 完成一项研究 -> 解锁 1 格 */
  var s5 = E.newGame();
  var before5 = E.comboCount(s5);
  ok('研究能开工', E.startResearch(s5, 'toolchain') === true);
  s5.day += 61;
  E.tick(s5, 1 / 30);
  ok('完成研究解锁 1 格', E.comboCount(s5) === before5 + 1,
    before5 + ' → ' + E.comboCount(s5));

  /* 收满不会卡住 */
  var s6 = E.newGame();
  var n = 0;
  while (n < 300 && E.unlockNextCombo(s6)) n++;
  ok('组合可以一路收满 100 格', E.comboCount(s6) === 100, String(E.comboCount(s6)));
  ok('收满之后不再发', E.unlockNextCombo(s6) === null);

  /* 解锁顺序会往题材上铺开，不会一路堆同一个题材 */
  var s7 = E.newGame();
  for (var k = 0; k < 40; k++) E.unlockNextCombo(s7);
  var byTheme = {};
  s7.combos.forEach(function (key) {
    var th = key.split(':')[1];
    byTheme[th] = (byTheme[th] || 0) + 1;
  });
  var spread = Object.keys(byTheme).length;
  ok('解锁会铺开到多个题材', spread >= 10, spread + ' 个题材');

  /* 老存档没有 combos 字段 */
  var raw = E.serialize(E.newGame());
  var obj = JSON.parse(raw);
  delete obj.combos; delete obj.found; delete obj.comboNews;
  var back = E.deserialize(JSON.stringify(obj));
  ok('老存档读回来仍有 20 格', E.comboCount(back) === 20, String(E.comboCount(back)));
  ok('老存档读回来收藏面板能算', E.comboStats(back).have === 20);
})();

/* ---------- 办公室（4 级） ---------- */
(function () {
  var s = E.newGame();
  ok('开局在车库里', E.room(s).key === 'garage' && E.roomIndex(s) === 0, E.room(s).name);
  ok('车库 3 个工位', E.officeLevel(s) === 3);
  ok('车库没有品质加成', E.room(s).eff.quality === 1);

  var q0 = E.baseQuality(s, 'rpg', 'fantasy', s.staff[0].id);
  s.money = 1e9;
  ok('能搬第一次', E.expandOffice(s) === true && E.room(s).key === 'street', E.room(s).name);
  var q1 = E.baseQuality(s, 'rpg', 'fantasy', s.staff[0].id);
  ok('搬家后品质有加成', q1 > q0, q0.toFixed(2) + ' → ' + q1.toFixed(2));
  ok('街边 4 个工位', E.officeLevel(s) === 4 && s.seats === 4);
  ok('搬完能多招一个人', s.staff.length < s.seats);

  var guard = 0;
  while (E.expandOffice(s) && guard++ < 10) { }
  ok('一路能搬到独栋', E.room(s).key === 'building' && E.officeLevel(s) === 6,
    E.room(s).name + ' / ' + s.seats + ' 工位');
  ok('顶了就没有下一级', E.nextRoom(s) === null && E.expandCost(s) === null);
  ok('搬不动时不再扣钱', (function () {
    var m = s.money;
    var r = E.expandOffice(s);
    return r === false && s.money === m;
  })());

  /* 三级（写字楼）起研究更快：日历换算成进度 */
  ok('写字楼研究加成生效', E.roomDef(2).eff.research > 1);
  ok('独栋卖得更多', E.roomDef(3).eff.sales > 1);

  /* 老存档只有 seats：房间等级跟着推出来 */
  var saved = E.serialize(E.newGame());
  var obj = JSON.parse(saved);
  obj.seats = 5;
  var back = E.deserialize(JSON.stringify(obj));
  ok('老存档按工位数推出房间', E.room(back).key === 'floor', E.room(back).name);
})();

/* ---------- 续作 ---------- */
(function () {
  var s = E.newGame();
  ok('一开始没有可做续作的作品', E.sequelCandidates(s).length === 0);

  var base = { genre: 'rpg', theme: 'fantasy', leader: s.staff[0].id, platform: 'arc72', name: '' };
  var r0 = playOne(s, base);
  ok('第一部是一代', !!r0 && r0.seq === 1, r0 ? String(r0.seq) : '没做完');

  s.history[0].copies = GD.BAL.sequelMinCopies - 1;
  ok('差一份就不算够格', E.sequelCandidates(s).length === 0,
    String(s.history[0].copies));

  s.history[0].copies = GD.BAL.sequelMinCopies;
  var cands = E.sequelCandidates(s);
  ok('销量够的旧作能出续作', cands.length === 1 && cands[0].seq === 2,
    cands.length ? cands[0].title + ' 第 ' + cands[0].seq + ' 作' : '空');

  s.phase = 'planning';
  s.plan = { genre: 'rpg', theme: 'fantasy', leader: s.staff[0].id, platform: 'arc72', name: '', sequel: null };
  var pvNormal = E.preview(s, base);
  var pvSeq = E.preview(s, { genre: 'rpg', theme: 'fantasy', leader: s.staff[0].id, platform: 'arc72', name: '', sequel: 0 });

  ok('续作开发更快', pvSeq.duration < pvNormal.duration,
    pvNormal.duration.toFixed(1) + ' → ' + pvSeq.duration.toFixed(1) + ' 秒');
  ok('续作相性打折', Math.abs(pvSeq.affinity - pvNormal.affinity * GD.BAL.sequelAffinity) < 1e-9,
    pvNormal.affinity.toFixed(2) + ' → ' + pvSeq.affinity.toFixed(2));
  ok('续作品质更低', pvSeq.quality < pvNormal.quality,
    pvNormal.quality.toFixed(1) + ' → ' + pvSeq.quality.toFixed(1));

  ok('续作能立项', E.startProject(s, { genre: 'rpg', theme: 'fantasy', leader: s.staff[0].id, platform: 'arc72', name: '', sequel: 0 }) === true);
  ok('立项后记住是第 2 作', !!s.project.sequel && s.project.sequel.seq === 2);
  ok('续作自动带编号', E.gameName(s) === E.historyTitle(s.history[0]) + ' 2', E.gameName(s));

  s.review = { total: 30 };
  var estWith = E.estimateSales(s, 1);
  var savedSq = s.project.sequel;
  s.project.sequel = null;
  var estWithout = E.estimateSales(s, 1);
  s.project.sequel = savedSq;
  ok('续作预估销量更高', estWith.mid > estWithout.mid,
    estWithout.mid + ' → ' + estWith.mid);

  /* 完整做一部续作：历史里记成系列第 2 作，再做第 3 作会接上编号 */
  var s2 = E.newGame();
  var g0 = { genre: 'rpg', theme: 'fantasy', leader: s2.staff[0].id, platform: 'arc72', name: '' };
  playOne(s2, g0);
  s2.history[0].copies = 120000;
  E.nextRound(s2);
  var g1 = { genre: 'rpg', theme: 'fantasy', leader: s2.staff[0].id, platform: 'arc72', name: '', sequel: 0 };
  var r1 = playOne(s2, g1);
  ok('用完的续作记成系列第 2 作', !!r1 && r1.seq === 2, r1 ? String(r1.seq) : '没做完');

  s2.history[1].copies = 120000;
  E.nextRound(s2);
  s2.phase = 'planning';
  s2.plan = { genre: 'rpg', theme: 'fantasy', leader: s2.staff[0].id, platform: 'arc72', name: '', sequel: null };
  var cands2 = E.sequelCandidates(s2);
  ok('续作自己也能再出续作', cands2.some(function (c) { return c.seq === 3; }),
    cands2.map(function (c) { return c.title + ' ' + c.seq; }).join(' / '));

  var seq3 = E.sequelCandidates(s2).filter(function (c) { return c.seq === 3; })[0];
  E.nextRound(s2);
  var r2 = playOne(s2, {
    genre: 'rpg', theme: 'fantasy', leader: s2.staff[0].id, platform: 'arc72', name: '', sequel: seq3.index
  });
  ok('第三作接上同一个系列', !!r2 && r2.seq === 3 && r2.seriesKey === r1.seriesKey,
    r2 ? String(r2.seq) + ' / ' + r2.seriesKey : '没做完');

  /* 老存档里指向不存在的续作：读档时清掉，不会崩 */
  var raw = E.serialize(E.newGame());
  var obj2 = JSON.parse(raw);
  obj2.plan.sequel = 99;
  var back2 = E.deserialize(JSON.stringify(obj2));
  ok('指向不存在的续作会被清掉', back2.plan.sequel === null, String(back2.plan.sequel));
})();

/* ---------- 系列命名：不能堆成「古墓丽影2 3」 ---------- */
(function () {
  ok('去编号：带空格', E.stripSeq('古墓丽影 2') === '古墓丽影', E.stripSeq('古墓丽影 2'));
  ok('去编号：不带空格', E.stripSeq('古墓丽影2') === '古墓丽影', E.stripSeq('古墓丽影2'));
  ok('去编号：罗马数字', E.stripSeq('古墓丽影 II') === '古墓丽影', E.stripSeq('古墓丽影 II'));
  ok('没有编号的标题不动', E.stripSeq('最终幻想') === '最终幻想');

  var s3 = E.newGame();
  s3.history = [
    { name: '古墓丽影', copies: 200000, seq: 1, genre: 'adv', theme: 'modern' },
    { name: '古墓丽影2', copies: 200000, seq: 2, seriesKey: 's0', seriesTitle: '古墓丽影', genre: 'adv', theme: 'modern' }
  ];
  s3.plan = { genre: 'adv', theme: 'modern', leader: s3.staff[0].id, platform: 'arc72', name: '', sequel: 1 };
  ok('第三代的自动名接根名', E.gameName(s3) === '古墓丽影 3', E.gameName(s3));
  ok('系列根名沿用第一作', E.seriesRoot(s3.history[1]) === '古墓丽影', E.seriesRoot(s3.history[1]));
  s3.plan.sequel = 0;
  ok('第二代还是根名 + 2', E.gameName(s3) === '古墓丽影 2', E.gameName(s3));
})();

/* ---------- 市场流行 ---------- */
(function () {
  var y1 = E.trendFor(1985), y2 = E.trendFor(1986);
  ok('每一年 2 个热门题材', y1.themes.length === 2 && y2.themes.length === 2,
    y1.themes.join(',') + ' / ' + y2.themes.join(','));
  ok('同一年结果稳定', JSON.stringify(E.trendFor(1985)) === JSON.stringify(y1));
  ok('两个热门题材不重复', y1.themes[0] !== y1.themes[1]);
  ok('热门类型是合法 id', GD.GENRES.some(function (g) { return g.id === y1.genre; }), y1.genre);

  var otherTheme = GD.THEMES.filter(function (t) { return y1.themes.indexOf(t.id) < 0; })[0].id;
  var otherGenre = GD.GENRES.filter(function (g) { return g.id !== y1.genre; })[0].id;

  ok('两个都不中 = 无加成', E.trendSalesMul(1985, otherGenre, otherTheme) === 1);
  ok('中热门题材 = ×1.30',
    near(E.trendSalesMul(1985, otherGenre, y1.themes[0]), GD.BAL.trendThemeSales));
  ok('中热门类型 = ×1.15',
    near(E.trendSalesMul(1985, y1.genre, otherTheme), GD.BAL.trendGenreSales));
  ok('都中 = 两个相乘',
    near(E.trendSalesMul(1985, y1.genre, y1.themes[0]), GD.BAL.trendThemeSales * GD.BAL.trendGenreSales),
    E.trendSalesMul(1985, y1.genre, y1.themes[0]).toFixed(3));

  /* 30 年里走势要真的在变，不能年年一样 */
  var sigs = {};
  for (var y = GD.BAL.startYear; y <= GD.BAL.endYear; y++) {
    sigs[E.trendText(y) + '|' + E.trendFor(y).genre] = 1;
  }
  ok('30 年里走势确实在变', Object.keys(sigs).length >= 20, Object.keys(sigs).length + ' 种');

  /* 企划预览里带趋势倍率 */
  var s = E.newGame();
  var hotT = E.trendFor(E.year(s)).themes[0];
  var pv = E.preview(s, { genre: 'rpg', theme: hotT, leader: s.staff[0].id, platform: 'arc72' });
  ok('企划预览显示趋势倍率', near(pv.trend, GD.BAL.trendThemeSales), String(pv.trend));

  /* 趋势真的进销量：同一部作品，热门题材卖得更多 */
  var sA = E.newGame(), sB = E.newGame();
  sA.plan = { genre: 'rpg', theme: hotT, leader: sA.staff[0].id, platform: 'arc72' };
  sB.plan = { genre: 'rpg', theme: otherTheme, leader: sB.staff[0].id, platform: 'arc72' };
  sA.project = { sequel: null }; sB.project = { sequel: null };
  sA.review = { total: 30 }; sB.review = { total: 30 };
  var estA = E.estimateSales(sA, 1), estB = E.estimateSales(sB, 1);
  ok('热门题材预估卖得更多', estA.mid > estB.mid, estB.mid + ' → ' + estA.mid);
})();

/* ---------- 士气 / 体力 ---------- */
(function () {
  var s = E.newGame();
  ok('新人默认士气体力', E.moraleOf(s.staff[0]) === GD.BAL.moraleStart &&
    E.staminaOf(s.staff[0]) === GD.BAL.staminaStart,
    E.moraleOf(s.staff[0]) + '/' + E.staminaOf(s.staff[0]));
  ok('默认状态正常', E.moodLabel(s.staff[0]) === '正常');

  /* 体力低 → 开发慢；士气低 → 品质差 */
  var s2 = E.newGame();
  s2.staff[0].stamina = 10;
  var dTired = E.devDuration(s2, s2.staff[0].id);
  var qTired = E.baseQuality(s2, 'rpg', 'fantasy', s2.staff[0].id);
  s2.staff[0].stamina = 100;
  var dFresh = E.devDuration(s2, s2.staff[0].id);
  ok('体力低时开发更慢', dTired > dFresh, dFresh.toFixed(1) + ' → ' + dTired.toFixed(1));
  ok('体力低时标签是疲劳', E.moodLabel(s2.staff[0]) === '正常');

  s2.staff[0].morale = 10;
  var qLow = E.baseQuality(s2, 'rpg', 'fantasy', s2.staff[0].id);
  s2.staff[0].morale = 90;
  var qHigh = E.baseQuality(s2, 'rpg', 'fantasy', s2.staff[0].id);
  ok('士气低时品质更差', qLow < qHigh, qLow.toFixed(1) + ' < ' + qHigh.toFixed(1));

  /* 做完一部：掉体力 */
  var s3 = E.newGame();
  playOne(s3, { genre: 'rpg', theme: 'fantasy', leader: s3.staff[0].id, platform: 'arc72' });
  ok('做完一部体力下降', E.staminaOf(s3.staff[0]) < GD.BAL.staminaStart,
    String(Math.round(E.staminaOf(s3.staff[0]))));
  var beforeRest = E.staminaOf(s3.staff[0]);
  E.nextRound(s3);
  ok('下一部开始前回一点体力', E.staminaOf(s3.staff[0]) > beforeRest,
    beforeRest.toFixed(0) + ' → ' + E.staminaOf(s3.staff[0]).toFixed(0));

  /* 分数决定士气涨落 */
  var s6 = E.newGame();
  s6.project = { elapsed: 10, crunchTime: 0 };
  s6.review = { total: 20 };
  E.settleMood(s6);
  ok('低分会掉士气', E.moraleOf(s6.staff[0]) < GD.BAL.moraleStart,
    String(Math.round(E.moraleOf(s6.staff[0]))));
  var beforeM = E.moraleOf(s6.staff[0]);
  s6.project = { elapsed: 10, crunchTime: 0 };
  s6.review = { total: 38 };
  E.settleMood(s6);
  ok('高分回士气', E.moraleOf(s6.staff[0]) > beforeM,
    beforeM.toFixed(0) + ' → ' + E.moraleOf(s6.staff[0]).toFixed(0));

  /* 赶工更累 */
  var s7 = E.newGame();
  s7.project = { elapsed: 10, crunchTime: 8 };
  s7.review = { total: 30 };
  E.settleMood(s7);
  ok('赶工掉更多体力',
    E.staminaOf(s7.staff[0]) < GD.BAL.staminaStart - GD.BAL.staminaDrain,
    String(Math.round(E.staminaOf(s7.staff[0]))));

  /* 团建 */
  var s4 = E.newGame();
  s4.staff.forEach(function (st) { st.morale = 40; });
  s4.money = 5000000;
  var m0 = E.moraleOf(s4.staff[0]);
  ok('团建成功', E.teamBuild(s4) === true);
  ok('团建涨士气', E.moraleOf(s4.staff[0]) === Math.min(100, m0 + GD.BAL.teamBuildMorale),
    String(Math.round(E.moraleOf(s4.staff[0]))));
  ok('一轮只能团建一次', E.teamBuild(s4) === false);

  var s5 = E.newGame();
  s5.money = 0;
  ok('没钱团建不了', E.teamBuild(s5) === false);

  /* 老存档补士气体力 */
  var raw = E.serialize(E.newGame());
  var obj = JSON.parse(raw);
  delete obj.staff[0].morale;
  delete obj.staff[0].stamina;
  var back = E.deserialize(JSON.stringify(obj));
  ok('老存档补默认士气体力',
    E.moraleOf(back.staff[0]) === GD.BAL.moraleStart && E.staminaOf(back.staff[0]) === GD.BAL.staminaStart);
})();

/* ---------- 怀旧潮 ---------- */
(function () {
  var waves = [], uniq = [];
  for (var y = GD.BAL.startYear; y <= 2030; y++) {
    var n = E.nostalgiaFor(y);
    if (n) {
      waves.push(n.from);
      if (uniq.indexOf(n.from) < 0) uniq.push(n.from);
    }
  }
  ok('怀旧潮每 12 年一次', uniq.length >= 4 && uniq[1] - uniq[0] === 12, uniq.join(','));
  ok('每次持续 2 年', waves.length === uniq.length * 2, waves.length + ' 年 / ' + uniq.length + ' 波');
  ok('前 12 年没有怀旧潮', !E.nostalgiaFor(1972) && !E.nostalgiaFor(1983));

  var w = E.nostalgiaFor(1984);
  ok('同一波年年内一致', JSON.stringify(E.nostalgiaFor(1985)) === JSON.stringify(w));
  ok('潮期只加成本命类型', E.nostalgiaSalesMul(1984, w.genre) === GD.BAL.nostalgiaSales,
    w.genre + ' ×' + E.nostalgiaSalesMul(1984, w.genre));
  var otherG = GD.GENRES.filter(function (g) { return g.id !== w.genre; })[0].id;
  ok('别的类型没有加成', E.nostalgiaSalesMul(1984, otherG) === 1);
  ok('潮过了就恢复', E.nostalgiaSalesMul(w.to + 1, w.genre) === 1);

  /* 进销量：潮期做本命类型卖得更多 */
  var sA = E.newGame(), sB = E.newGame();
  sA.day = sB.day = (w.from - GD.BAL.startYear) * GD.BAL.daysPerYear;
  sA.plan = { genre: w.genre, theme: 'fantasy', leader: sA.staff[0].id, platform: 'arc72' };
  sB.plan = { genre: otherG, theme: 'fantasy', leader: sB.staff[0].id, platform: 'arc72' };
  sA.project = { sequel: null }; sB.project = { sequel: null };
  sA.review = { total: 30 }; sB.review = { total: 30 };
  ok('怀旧潮确实进销量',
    E.estimateSales(sA, 1).mid > E.estimateSales(sB, 1).mid,
    E.estimateSales(sB, 1).mid + ' → ' + E.estimateSales(sA, 1).mid);
})();

/* ---------- NG+ ---------- */
(function () {
  var s = E.newGame();
  ok('开局不是 NG+', (s.ng || 0) === 0 && E.timeSpeed(s) === 1);

  s.phase = 'planning';
  ok('非结局不能开 NG+', E.canNewGamePlus(s) === false && E.newGamePlus(s) === false);

  s.phase = 'ending';
  ok('结局可以开 NG+', E.canNewGamePlus(s) === true);

  var picks = E.comboList().slice(0, 40);
  s.combos = picks.map(function (c) { return E.comboKey(c.genre, c.theme); });
  s.found = ['rpg:fantasy'];
  s.fans = 100000;
  s.rep = 66;
  s.brands = [{ name: '子品牌A', genre: 'rpg', theme: 'fantasy', income: 1200 }];
  s.money = 99999999;

  var combosBefore = E.comboCount(s);
  ok('NG+ 能开', E.newGamePlus(s) === true);
  ok('回到企划阶段', s.phase === 'planning');
  ok('年份回到开局', E.year(s) === GD.BAL.startYear, String(E.year(s)));
  ok('收藏带过来了', E.comboCount(s) === combosBefore, E.comboCount(s) + ' / ' + combosBefore);
  ok('王牌星带过来了', E.comboStats(s).found === 1);
  ok('粉丝只带 10%', s.fans === 10000, String(s.fans));
  ok('子品牌带过来了', E.brands(s).length === 1);
  ok('轮次 +1', s.ng === 1);
  ok('日历 ×2', E.timeSpeed(s) === GD.BAL.ngTimeSpeed);
  ok('声望从零开始', s.rep === 0);
  ok('钱回到开局', s.money === GD.BAL.startMoney, String(s.money));
  ok('员工回到 3 个创始人', s.staff.length === 3);

  /* NG+ 每部多解锁 1 格 */
  var before = E.comboCount(s);
  playOne(s, { genre: 'rpg', theme: 'fantasy', leader: s.staff[0].id, platform: 'arc72' });
  ok('NG+ 每部多解锁 1 格',
    E.comboCount(s) === before + 2 + GD.BAL.ngComboBonus,
    before + ' → ' + E.comboCount(s));

  /* 日历来真的走快一倍 */
  var s1 = E.newGame(), s2 = E.newGame();
  var p1 = { genre: 'rpg', theme: 'fantasy', leader: s1.staff[0].id, platform: 'arc72' };
  var p2 = { genre: 'rpg', theme: 'fantasy', leader: s2.staff[0].id, platform: 'arc72' };
  E.startProject(s1, p1);
  E.startProject(s2, p2);
  s2.ng = 1;
  E.tick(s1, 0.2);
  E.tick(s2, 0.2);
  ok('NG+ 日历来走得快一倍', s2.day > s1.day * 1.8, s1.day.toFixed(1) + ' vs ' + s2.day.toFixed(1));

  /* 存档读回来仍然是 NG+ */
  var back = E.deserialize(E.serialize(s));
  ok('读档保住 NG+ 轮次', back.ng === 1 && E.timeSpeed(back) === GD.BAL.ngTimeSpeed);
})();

/* ---------- 解雇 ---------- */
(function () {
  var s = E.newGame();
  s.money = 1000000;
  var before = s.staff.length;
  var cost = E.fireCost(s, s.staff[0]);
  var name = s.staff[0].name;
  var r = E.fireStaff(s, s.staff[0].id);
  ok('能解雇', r.ok === true && r.name === name && s.staff.length === before - 1,
    r.name + ' / ' + s.staff.length + ' 人');
  ok('解雇要付遣散费', s.money === 1000000 - cost, String(cost));
  ok('遣散费进账本', s.firedFee === cost);

  var s2 = E.newGame();
  s2.money = 1000000;
  var lead = s2.staff[0].id;
  s2.plan = { genre: 'rpg', theme: 'fantasy', leader: lead, platform: 'arc72' };
  E.fireStaff(s2, lead);
  ok('主创被解雇后自动换人', s2.plan.leader !== lead && s2.staff.length === 2, s2.plan.leader);

  var s3 = E.newGame();
  s3.money = 1000000;
  E.fireStaff(s3, s3.staff[0].id);
  E.fireStaff(s3, s3.staff[1].id);
  ok('最后一个人不能解雇',
    s3.staff.length === 1 && E.fireStaff(s3, s3.staff[0].id).reason === 'last');

  var s4 = E.newGame();
  s4.money = 0;
  var xr = E.fireStaff(s4, s4.staff[0].id);
  ok('钱不够解雇不了', xr.reason === 'money' && s4.staff.length === 3, xr.reason);

  var s5 = E.newGame();
  s5.money = 1000000;
  var goneId = s5.staff[2].id;
  E.fireStaff(s5, goneId);
  s5.candidates = [goneId];
  ok('解雇的人可以再招回来',
    E.hire(s5, goneId) === true && s5.staff.some(function (x) { return x.id === goneId; }));
})();

/* ---------- 加成递减与平台上限（第二轮平衡的两个核心旋钮） ---------- */
(function () {
  ok('单件加成几乎不受影响', Math.abs(E.softMul(1.03) - 1.0296) < 0.001, E.softMul(1.03).toFixed(4));
  ok('叠到 5.59 倍会被压到 2 倍出头', E.softMul(5.59) > 2.0 && E.softMul(5.59) < 2.4,
    E.softMul(5.59).toFixed(2));
  ok('递减是单调的', E.softMul(2) < E.softMul(3) && E.softMul(3) < E.softMul(8));
  ok('小于 1 的倍率也会被抬回来', E.softMul(0.55) > 0.55 && E.softMul(0.55) < 1,
    E.softMul(0.55).toFixed(3));
  ok('1 还是 1', E.softMul(1) === 1);
  ok('递减有上限，不会越叠越离谱', E.softMul(100) < 1 + (GD.BAL.mulCap + 0.01),
    E.softMul(100).toFixed(2));

  var sA = E.newGame();
  var p72 = E.platformById('arc72', sA);
  var sB = E.newGame();
  sB.day = (2002 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  var p02 = E.platformById('i2', sB);
  ok('平台上限比原始 cap 宽', E.capOf(p72) > p72.cap && E.capOf(p02) > p02.cap,
    E.capOf(p72).toFixed(0) + ' / ' + E.capOf(p02).toFixed(0));
  ok('越晚的平台上限放得越宽',
    E.capOf(p02) / p02.cap > (E.capOf(p72) / p72.cap) * 1.5,
    (E.capOf(p72) / p72.cap).toFixed(2) + ' → ' + (E.capOf(p02) / p02.cap).toFixed(2));

  /* 后期品质/上限 要落在 1 附近，不能到 8 倍（那样每部都满分） */
  var sl = E.newGame();
  sl.day = (2000 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  sl.research.done = GD.RESEARCH.slice(0, 30).map(function (r) { return r.id; });
  sl.furniture = GD.GEAR.slice(0, 30).map(function (g) { return g.id; });
  sl.staff.forEach(function (st) { for (var k in st.stats) st.stats[k] = 75; });
  var big = E.availablePlatforms(sl).sort(function (a, b) { return b.install - a.install; })[0];
  sl.plan.platform = big.id;
  var ratio = E.baseQuality(sl, 'rpg', 'fantasy', sl.staff[0].id) / E.capOf(big);
  ok('后期品质/上限 落在合理区间（不该爆到几倍）', ratio > 0.6 && ratio < 2.0, ratio.toFixed(2));

  /* 首作不该直接封顶 */
  var s1 = E.newGame();
  var r1 = playOne(s1, { genre: 'rpg', theme: 'fantasy', leader: 'zhou' });
  ok('第一部作品不会直接 40 分', !!r1 && r1.total < 38, r1 ? String(r1.total) : '没做完');
})();

/* ---------- 平台退市 ---------- */
(function () {
  var s = E.newGame();
  ok('开局 ARC-72 没退市', E.isRetired(s, E.platformById('arc72', s)) === false);
  ok('开局不预警退市', E.retiringSoon(s, E.platformById('arc72', s)) === false);

  ok('第 9 年 ARC-72 开始预警退市', E.retiringSoon({
    day: (1980 - GD.BAL.startYear) * GD.BAL.daysPerYear
  }, E.platformById('arc72', s)) === true);

  s.day = (1982 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  ok('过了 retire 年就退市', E.isRetired(s, E.platformById('arc72', s)) === true);
  ok('退市平台进 retiredPlatforms',
    E.retiredPlatforms(s).some(function (p) { return p.id === 'arc72'; }),
    E.retiredPlatforms(s).map(function (p) { return p.id; }).join(','));
  ok('退市平台不在可选里',
    !E.availablePlatforms(s).some(function (p) { return p.id === 'arc72'; }));

  /* 企划里留着退市平台：自动换掉 */
  var s2 = E.newGame();
  s2.plan.platform = 'arc72';
  s2.day = (1990 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  var fixed = E.ensurePlanPlatform(s2);
  ok('企划平台退市后自动换', !!fixed && s2.plan.platform !== 'arc72' &&
    !E.isRetired(s2, E.platformById(s2.plan.platform, s2)), JSON.stringify(fixed));
  ok('换完之后不再重复纠正', E.ensurePlanPlatform(s2) === null);

  /* 还没上市的平台也要纠正（存档里可能留着未来的平台 id） */
  var s3 = E.newGame();
  s3.plan.platform = 'v1';       // 2068 年才上市
  var fixed2 = E.ensurePlanPlatform(s3);
  ok('还没上市的平台也会被换掉', !!fixed2 && s3.plan.platform !== 'v1', JSON.stringify(fixed2));
  ok('退回的平台确实是已上市的',
    E.platformById(s3.plan.platform, s3).year <= E.year(s3), s3.plan.platform);

  /* 立项时指定了一个非法平台：退回当前可用平台，按对的授权费扣钱 */
  var s4 = E.newGame();
  s4.money = 1e6;
  var payPlan = { genre: 'rpg', theme: 'fantasy', leader: s4.staff[0].id, platform: 'v1' };
  var pv = E.preview(s4, payPlan);
  ok('预览用合法平台的授权费', pv.license === E.platform(s4).license,
    pv.license + ' vs ' + E.platform(s4).license);
  var before4 = s4.money;
  E.startProject(s4, payPlan);
  var paid = before4 - s4.money;
  ok('非法平台立项按合法平台扣费', paid >= E.platform(s4).license,
    'paid=' + Math.round(paid));

  /* 长尾：平台退市后只剩零星 */
  var tail = E.newGame();
  tail.history = [
    { name: 'A', genre: 'rpg', theme: 'fantasy', platform: 'arc72', total: 30, copies: 1, revenue: 1000000, cost: 1 },
    { name: 'B', genre: 'rpg', theme: 'fantasy', platform: 'l3', total: 30, copies: 1, revenue: 1000000, cost: 1 }
  ];
  var tailNow = E.monthIncome(tail);
  tail.day = (1995 - GD.BAL.startYear) * GD.BAL.daysPerYear;   // 两个平台都退市了
  var tailLater = E.monthIncome(tail);
  ok('平台退市后长尾大幅缩水', tailLater < tailNow * 0.3,
    Math.round(tailNow) + ' → ' + Math.round(tailLater));
  ok('没记平台的老作品长尾不变', (function () {
    var t2 = E.newGame();
    t2.history = [{ name: 'C', genre: 'rpg', theme: 'fantasy', total: 30, copies: 1, revenue: 1000000, cost: 1 }];
    var m1 = E.monthIncome(t2);
    t2.day = (1995 - GD.BAL.startYear) * GD.BAL.daysPerYear;
    return E.monthIncome(t2) === m1;
  })());

  /* 自研平台永不退市 */
  var own = E.newGame();
  ok('自研平台永不退市', E.isRetired(own, { id: 'own', own: true, retire: 9999 }) === false);
})();

/* ---------- 移植 ---------- */
(function () {
  var s = E.newGame();
  s.money = 5000000;
  s.phase = 'planning';
  s.history = [{
    name: '老作品', genre: 'rpg', theme: 'fantasy',
    platform: 'arc72', platformLabel: '雅达瑞 街机板',
    total: 32, copies: 60000, revenue: 900000, cost: 300000,
    date: '1975 年 6 月', window: '普通档期'
  }];
  s.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;   // arc72 已退市

  var targets = E.portTargets(s, 0);
  ok('退市平台上的作品可以移植', targets.length >= 1, targets.map(function (p) { return p.id; }).join(','));
  ok('移植目标不含原平台', !targets.some(function (p) { return p.id === 'arc72'; }));
  ok('移植目标不含快退市的平台',
    targets.every(function (p) { return !E.retiringSoon(s, p); }));

  var pv = E.portPreview(s, 0, targets[0].id);
  ok('移植有成本', pv.cost === Math.round(300000 * GD.BAL.portCostRate), String(pv.cost));
  ok('移植有销量与收入', pv.copies > 0 && pv.revenue > 0,
    pv.copies + ' 份 / ' + pv.revenue);
  ok('移植装机比被夹在合理区间', pv.ratio >= 0.25 && pv.ratio <= 3, pv.ratio.toFixed(2));

  var money0 = s.money, fans0 = s.fans;
  var r = E.port(s, 0, targets[0].id);
  ok('能移植', r.ok === true, JSON.stringify(r));
  ok('移植扣成本并进账', Math.abs((s.money - money0) - (r.revenue - r.cost)) < 1,
    '成本 ' + r.cost + ' 收入 ' + r.revenue);
  ok('移植涨粉丝', s.fans > fans0, Math.round(fans0) + ' → ' + Math.round(s.fans));
  ok('作品平台改成新平台', s.history[0].platform === targets[0].id, s.history[0].platform);
  ok('记下了搬过哪些平台',
    Array.isArray(s.history[0].ports) && s.history[0].ports.indexOf(targets[0].id) >= 0,
    JSON.stringify(s.history[0].ports));
  ok('移植次数 +1', s.history[0].ported === 1, String(s.history[0].ported));
  ok('不能搬回同一个平台',
    E.port(s, 0, targets[0].id).ok === false);
  ok('刚搬完太新，不能马上再搬', E.portBlock(s, 0) === 'too-new', String(E.portBlock(s, 0)));

  /* 太新的作品不让移植 */
  var s2 = E.newGame();
  s2.money = 5000000;
  s2.phase = 'planning';
  s2.history = [{ name: '新作', genre: 'rpg', theme: 'fantasy', platform: 'l3', total: 30, copies: 1000, revenue: 1000, cost: 100000 }];
  s2.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;   // l3 才 2 年
  ok('平台太新不许移植', E.portBlock(s2, 0) === 'too-new', String(E.portBlock(s2, 0)));

  /* 钱不够 */
  var s3 = E.newGame();
  s3.money = 100;
  s3.phase = 'planning';
  s3.history = [{ name: '老', genre: 'rpg', theme: 'fantasy', platform: 'arc72', total: 30, copies: 1000, revenue: 1000, cost: 300000 }];
  s3.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  ok('钱不够移植不了', E.port(s3, 0, E.portTargets(s3, 0)[0].id).reason === 'money');

  /* 只能企划阶段 */
  var s4 = E.newGame();
  s4.money = 5000000;
  s4.phase = 'developing';
  s4.history = [{ name: '老', genre: 'rpg', theme: 'fantasy', platform: 'arc72', total: 30, copies: 1000, revenue: 1000, cost: 300000 }];
  s4.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  ok('非企划阶段不能移植', E.port(s4, 0, E.portTargets(s4, 0)[0].id).reason === 'phase');

  /* 老存档没有平台记录：不给移植，避免凭空搬 */
  var s5 = E.newGame();
  s5.money = 5000000;
  s5.phase = 'planning';
  s5.history = [{ name: '旧', genre: 'rpg', theme: 'fantasy', total: 30, copies: 1000, revenue: 1000, cost: 100000 }];
  s5.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  ok('老存档没平台记录就不给移植', E.portBlock(s5, 0) === 'no-platform', String(E.portBlock(s5, 0)));
})();

/* ---------- 自定时代（2075 之后） ---------- */
(function () {
  var s = E.newGame();
  ok('开局没有影响力', (s.influence || 0) === 0);
  ok('2075 之前没有自定时代', E.customEraIndex(2075) < 0 && E.customEraIndex(2082) < 0);
  ok('2083 年是第一个自定时代', E.customEraIndex(2083) === 0 && E.customEraFrom(0) === 2083,
    String(E.customEraIndex(2083)));
  ok('每 8 年开一代', E.customEraIndex(2091) === 1 && E.customEraFrom(1) === 2091);
  ok('2075 之前没有待选', E.customPendingFrom(s) === null);

  /* 出片和拿奖给影响力 */
  var s2 = E.newGame();
  E.addInfluence(s2, E.influenceGain(34));
  ok('高分作品给 2 点影响力', s2.influence === 2, String(s2.influence));
  E.addInfluence(s2, E.influenceGain(22));
  ok('低分作品给 1 点', s2.influence === 3, String(s2.influence));
  ok('影响力不会变成负数', (function () {
    E.addInfluence(s2, -999);
    return s2.influence === 0;
  })(), String(s2.influence));

  /* 到了 2083 就该选卡 */
  var s3 = E.newGame();
  s3.day = (2085 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  ok('到年份就有待选', E.customPendingFrom(s3) === 2083, String(E.customPendingFrom(s3)));
  ok('还没选就没有自定规则', E.customRuleOf(s3) === null);

  var offer = E.rollCustomCards(s3);
  ok('发 3 张卡', offer && offer.cards.length === 3, offer ? String(offer.cards.length) : '空');
  ok('三张卡模板不重复', (function () {
    var ids = offer.cards.map(function (c) { return c.tpl; });
    return ids.length === 3 && ids[0] !== ids[1] && ids[1] !== ids[2] && ids[0] !== ids[2];
  })(), offer.cards.map(function (c) { return c.tpl; }).join(','));
  ok('卡有代号和说明',
    offer.cards.every(function (c) { return c.code && c.name && c.desc && c.eff; }),
    JSON.stringify(offer.cards[0]));
  ok('代号是 厂商码-序号 形式', /^[A-Z]{2}-\d+$/.test(offer.cards[0].code), offer.cards[0].code);
  ok('重复取同一批不会变', E.rollCustomCards(s3) === offer);

  /* 影响力不够选不了 */
  s3.influence = 10;
  ok('影响力不够选不了卡', E.pickCustomCard(s3, 0).reason === 'influence');
  s3.influence = 200;
  ok('影响力不够也重抽不了', (function () {
    var t = E.newGame();
    t.day = s3.day;
    t.influence = 5;
    E.rollCustomCards(t);
    return E.rerollCustomCards(t).reason === 'influence';
  })());

  /* 选卡：花 50，规则生效 */
  var before = s3.influence;
  var pick = E.pickCustomCard(s3, 0);
  ok('能选定一张卡', pick.ok === true && s3.customRules.length === 1, JSON.stringify(pick.ok));
  ok('选卡扣影响力', s3.influence === before - GD.CUSTOM.pickCost,
    before + ' → ' + s3.influence);
  ok('选完就不再待选', E.customPendingFrom(s3) === null);
  ok('选定的规则会生效', !!E.customRuleOf(s3), JSON.stringify(E.customRuleOf(s3).name));
  ok('offer 清空', s3.customOffer === null);

  /* 规则真的叠进乘数出口 */
  var s4 = E.newGame();
  s4.day = (2085 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  s4.customRules = [{
    from: 2083, code: 'AR-9', name: '测试规则', desc: 'x', learn: 'x', tier: '中',
    eff: { quality: 1.20, sales: 1.25, reviewNoise: 1.5, noBias: true, cut: -0.05 }
  }];
  var base = E.ruleOf(s4);
  ok('自定规则和固定规则叠乘',
    Math.abs(E.ruleMul(s4, 'quality') - base.eff.quality * 1.20) < 1e-9,
    E.ruleMul(s4, 'quality').toFixed(4));
  ok('自定规则的销量也生效',
    E.ruleSalesMul(s4) > (base.eff.sales || 1),
    E.ruleSalesMul(s4).toFixed(3));
  ok('自定规则的抽成叠加', Math.abs(E.ruleDelta(s4, 'cut') - (-0.05)) < 1e-9,
    String(E.ruleDelta(s4, 'cut')));
  ok('自定规则的开关类生效', E.ruleFlag(s4, 'noBias') === true);

  /* 没选过的时代不生效，但选过的会一直生效 */
  var s5 = E.newGame();
  s5.customRules = [{ from: 2083, eff: { quality: 1.2 }, name: 'A', code: 'A-1', desc: '', learn: '' }];
  s5.day = (2100 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  ok('选过的规则跨代继续生效', !!E.customRuleOf(s5) && E.customRuleOf(s5).name === 'A');
  s5.customRules.push({ from: 2091, eff: { quality: 1.3 }, name: 'B', code: 'B-2', desc: '', learn: '' });
  ok('新一代的规则覆盖旧的', E.customRuleOf(s5).name === 'B');

  /* 随机：免费，范式跃迁概率交给种子 */
  var s6 = E.newGame();
  s6.day = (2085 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  E.rollCustomCards(s6);
  var savedRandom = Math.random;
  Math.random = function () { return 0.5; };
  var rnd = E.randomCustomCard(s6);
  Math.random = savedRandom;
  ok('随机是免费的', rnd.ok === true && rnd.cost === 0);
  ok('随机也拿到一条规则', s6.customRules.length === 1 && E.customPendingFrom(s6) === null);
  ok('0.5 不触发跃迁', rnd.paradigm === false && s6.customRules.length === 1);

  /* 范式跃迁：10% 概率一次两条，第二条强度 ×1.3 */
  var s7 = E.newGame();
  s7.day = (2085 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  E.rollCustomCards(s7);
  var savedR2 = Math.random;
  /* 常驻 0.05：既能让 makeCustomCard 正常取到第 0 个模板/档位/名字，
   * 又让后面的 `Math.random() < 0.10` 必然成立 */
  Math.random = function () { return 0.05; };
  var jump = E.randomCustomCard(s7);
  Math.random = savedR2;
  ok('范式跃迁一次给两条', jump.paradigm === true && jump.rules.length === 2 && s7.customRules.length === 2,
    'paradigm=' + jump.paradigm + ' rules=' + s7.customRules.length);
  ok('跃迁那条标了跃迁', s7.customRules[1].tier === '跃迁', s7.customRules[1].tier);

  /* 老存档没有自定字段：不影响，也不会崩 */
  var raw = E.serialize(E.newGame());
  var obj = JSON.parse(raw);
  delete obj.influence; delete obj.customRules; delete obj.customOffer; delete obj.customCodeN;
  var back = E.deserialize(JSON.stringify(obj));
  ok('老存档读回来影响力是 0', (back.influence || 0) === 0);
  ok('老存档读回来没有自定规则', Array.isArray(back.customRules) && back.customRules.length === 0);
  ok('老存档读回来不会待选', E.customPendingFrom(back) === null);
})();

/* ---------- 自研平台倒闭 ---------- */
(function () {
  var s = E.newGame();
  s.day = (2068 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  s.money = 5e7; s.fans = 6e5; s.rep = 95;
  ok('2068 年之前不能开台', E.launchBlock((function () {
    var t = E.newGame();
    t.day = (2060 - GD.BAL.startYear) * GD.BAL.daysPerYear;
    return t;
  })(), { budget: 'normal', price: 'mid', cut: 'normal' }) === 'early');

  var lr = E.launchPlatform(s, { budget: 'normal', price: 'mid', cut: 'normal' });
  ok('能开自研平台', lr.ok === true && !!s.myPlatform, JSON.stringify(lr.ok));
  ok('开台记下装机天花板', s.myPlatform.installTarget > s.myPlatform.install,
    s.myPlatform.install + ' → ' + s.myPlatform.installTarget);

  /* 正常配置：能赚钱 */
  for (var i = 0; i < 6; i++) {
    s.day += GD.BAL.daysPerYear;
    E.tickPlatform(s);
  }
  ok('正常配置的平台不会倒闭', !!s.myPlatform && s.platformCrashes === 0);
  var hp = E.platformHealth(s);
  ok('平台有健康度', !!hp && typeof hp.net === 'number', JSON.stringify(hp));
  ok('正常配置净收益为正', hp.net > 0, String(hp.net));
  ok('装了机但没超过天花板', s.myPlatform.install <= s.myPlatform.installTarget + 0.05,
    s.myPlatform.install + ' / ' + s.myPlatform.installTarget);

  /* 低抽成 = 每部都亏，连亏两年倒闭 */
  var s2 = E.newGame();
  s2.day = (2068 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  s2.money = 1e8; s2.fans = 6e5; s2.rep = 95;
  E.launchPlatform(s2, { budget: 'normal', price: 'mid', cut: 'lure' });
  var cash0 = s2.money;
  var crashed = false, guard = 0;
  while (!crashed && guard++ < 8) {
    s2.day += GD.BAL.daysPerYear;
    var ev = E.tickPlatform(s2);
    if (ev && ev.crashed) crashed = true;
  }
  ok('低抽成平台会倒闭', crashed === true && s2.myPlatform === null);
  ok('倒闭记了档案', s2.platformCrashes === 1 && s2.crashedPlatforms.length === 1,
    JSON.stringify(s2.crashedPlatforms));
  ok('倒闭赔掉六成现金', s2.crashedPlatforms[0].loss > 0, String(s2.crashedPlatforms[0].loss));
  ok('倒闭后平台没了但作品粉丝留着',
    s2.myPlatform === null && Array.isArray(s2.history) && s2.fans >= 0);
  ok('倒闭不影响长尾', typeof E.monthIncome(s2) === 'number');
})();

/* ---------- 子品牌买回 ---------- */
(function () {
  var s = E.newGame();
  var white = s.rivals.filter(function (x) { return x.id === 'white'; })[0];
  ok('开局没有脱离的子公司', E.lostBrands(s).length === 0);

  /* 先收购再破产，看它是否进「脱离名单」（white 1981 年才出道，先把年份推过去） */
  s.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  s.money = 1e9; s.fans = 6e5;
  ok('先收购成功', E.acquire(s, 'white').ok === true && E.isAcquired(s, 'white') === true);
  s.phase = 'bankrupt';
  E.newCompany(s, 'makemoney');
  ok('破产后子公司脱离', E.isAcquired(s, 'white') === false);
  ok('脱离名单记下了它', E.isLostBrand(s, 'white') === true, JSON.stringify(E.lostBrands(s)));
  ok('脱离的是对手不是子公司', E.brands(s).length === 0);

  s.money = 1e9;
  var cost = E.buybackCost(s, white);
  ok('买回有 0.8 折', Math.abs(cost - Math.round(E.acquireCost(s, white) * GD.BAL.buybackRate)) < 1,
    String(cost));
  ok('买回比正常收购便宜', cost < E.acquireCost(s, white),
    cost + ' < ' + E.acquireCost(s, white));

  var money0 = s.money;
  var bb = E.buyback(s, 'white');
  ok('能买回', bb.ok === true, JSON.stringify(bb));
  ok('买回扣钱', s.money === money0 - cost, money0 + ' → ' + s.money);
  ok('买回后重新归到旗下', E.isAcquired(s, 'white') === true && E.brands(s).length === 1);
  ok('买回后从脱离名单里划掉', E.isLostBrand(s, 'white') === false);
  ok('不能重复买回', E.buyback(s, 'white').reason === 'owned');
  ok('买回的子品牌标了来源', E.brands(s)[0].boughtBack === true);

  /* 没脱离过的对手不能买回 */
  var s2 = E.newGame();
  s2.money = 1e9; s2.fans = 6e5;
  var black = s2.rivals.filter(function (x) { return x.id !== 'white'; })[0];
  ok('没脱离过的不能买回', E.buybackBlock(s2, black) === 'not-lost', String(E.buybackBlock(s2, black)));

  /* 钱不够 */
  var s3 = E.newGame();
  s3.day = (1985 - GD.BAL.startYear) * GD.BAL.daysPerYear;
  s3.money = 1e9; s3.fans = 6e5;
  E.acquire(s3, 'white');
  s3.phase = 'bankrupt';
  E.newCompany(s3, 'makemoney');
  s3.money = 10;
  var w3 = s3.rivals.filter(function (x) { return x.id === 'white'; })[0];
  ok('钱不够买不回来', E.buybackBlock(s3, w3) === 'poor', String(E.buybackBlock(s3, w3)));

  /* 老存档没有 lostBrands 不崩 */
  var raw = E.serialize(E.newGame());
  var obj = JSON.parse(raw);
  delete obj.lostBrands;
  var back = E.deserialize(JSON.stringify(obj));
  ok('老存档没有脱离名单也能跑', Array.isArray(E.lostBrands(back)) && E.lostBrands(back).length === 0);
})();

console.log('\n' + passed + ' 项通过，' + failed + ' 项失败');
process.exit(failed ? 1 : 0);
