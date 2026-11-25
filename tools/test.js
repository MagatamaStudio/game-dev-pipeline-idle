/* ============================================================
 * tools/test.js —— 引擎逻辑测试（不需要浏览器）
 * 用法：node tools/test.js
 * ============================================================ */
'use strict';

global.window = global;
require('../js/config.js');
require('../js/engine.js');

var GD = global.GD;
var E = GD.Engine;

var passed = 0, failed = 0;

function ok(name, cond, detail) {
  if (cond) { passed++; console.log('PASS ' + name); }
  else { failed++; console.log('FAIL ' + name + (detail ? '  → ' + detail : '')); }
}

function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }

/* ---------- 基础 ---------- */
(function () {
  var s = E.newGame();
  ok('新游戏从 1972 开始', s.era === 0 && s.cycle === 1);
  ok('初始有 1 个在制项目', s.projects.length === 1);
  ok('初始每部门 1 人', s.workers.concept === 1 && s.workers.code === 1);

  var before = s.projects[0].progress;
  E.tick(s, 1);
  ok('tick 推进项目进度', s.projects[0].progress > before,
    before + ' → ' + s.projects[0].progress);
})();

/* ---------- 完整跑完一个时代 ---------- */
(function () {
  var s = E.newGame();
  s.money = 1e5;
  var guard = 0;
  while (s.eraReleases < 10 && guard++ < 20000) {
    E.tick(s, 0.5);
    if (guard % 20 === 0) {
      E.buyWorker(s, 'concept');
      E.buyWorker(s, 'code');
    }
  }
  ok('能在合理时间内完成首时代', s.eraReleases >= 10, 'releases=' + s.eraReleases);
  ok('发行会带来收入', s.totalEarned > 0);
  ok('目标达成后可推进', E.goalMet(s) === true);

  var legacyBefore = s.legacy;
  var res = E.advanceEra(s);
  ok('推进时代返回传承点', res && res.gain > 0 && s.legacy > legacyBefore,
    'gain=' + (res && res.gain));
  ok('推进后部门数量变化', Object.keys(s.workers).length === 4);
  ok('推进后资金重置为时代启动资金', s.money === GD.ERAS[1].startCash);
})();

/* ---------- 1985：卡带产线 ---------- */
(function () {
  var s = E.newGame();
  s.era = 1;
  E.initEra(s);
  var era = GD.ERAS[1];

  ok('1985 有产线定义', !!era.line);
  ok('线速率符合配置', near(E.lineRate(s), era.line.base));

  var p = s.projects[0];
  p.stage = era.stages.length;   // 开发完成，等产线
  p.progress = 0;
  var moneyBefore = s.money;

  E.tick(s, 1);
  ok('产线上的项目会推进', p.progress > 0 && p.progress < 1, 'progress=' + p.progress);
  ok('未走完产线不发行', s.eraReleases === 0 && s.money === moneyBefore);

  // 走满
  var guard = 0;
  while (s.eraReleases === 0 && guard++ < 100) E.tick(s, 0.5);
  ok('产线走完后发行', s.eraReleases === 1, 'releases=' + s.eraReleases);
  ok('发行后拿到钱', s.money > moneyBefore);

  var slow = E.lineRate(s);
  var cost = E.lineCost(s);
  s.money = 1e6;
  ok('可以购买产线', E.buyLine(s) === true);
  ok('产线升级后更快', E.lineRate(s) > slow, slow + ' → ' + E.lineRate(s));
  ok('产线升级扣钱', s.money < 1e6, 'cost=' + cost);
  ok('产能估算把产线算进去',
    E.throughput(s) <= E.lineRate(s) + 1e-9,
    'thr=' + E.throughput(s) + ' line=' + E.lineRate(s));
})();

/* ---------- 1995：外包 ---------- */
(function () {
  var s = E.newGame();
  s.era = 2;
  E.initEra(s);
  var p = s.projects[0];
  p.stage = 1;              // 卡在程序部
  p.progress = 0;
  s.money = 1e7;

  var cost = E.outsourceCost(s, 'code');
  ok('外包有报价', cost > 0, 'cost=' + cost);
  ok('非外包时代没有报价', E.outsourceCost(E.newGame(), 'code') === 0);

  var moneyBefore = s.money;
  var res = E.outsource(s, 'code');
  ok('外包返回结果', !!res);
  ok('外包扣钱', s.money < moneyBefore && near(s.money, moneyBefore - res.cost, 1e-6));
  ok('外包把项目推进到下一部门', p.stage === 2, 'stage=' + p.stage);
  ok('没有项目时不能外包', E.outsourceCost(s, 'code') === 0);
  ok('钱不够时不能外包', (function () {
    var s2 = E.newGame();
    s2.era = 2; E.initEra(s2);
    s2.projects[0].stage = 1;
    s2.money = 0;
    return E.outsource(s2, 'code') === null;
  })());
})();

/* ---------- 存档往返 ---------- */
(function () {
  var s = E.newGame();
  s.era = 1;
  E.initEra(s);
  s.money = 12345;
  s.lineLv = 2;
  s.slots = 3;
  s.eraReleases = 5;
  s.projects[0].stage = GD.ERAS[1].stages.length;
  s.projects[0].progress = 0.42;

  var text = E.serialize(s);
  var back = E.deserialize(text);

  ok('存档往返保留时代', back.era === 1);
  ok('存档往返保留资金', near(back.money, 12345));
  ok('存档往返保留产线等级', back.lineLv === 2);
  ok('存档往返保留在制项目',
    back.projects.length >= s.projects.length && back.projects[0].name === s.projects[0].name,
    back.projects.length + ' vs ' + s.projects.length);
  ok('存档往返保留出厂进度', near(back.projects[0].progress, 0.42, 0.01),
    'progress=' + back.projects[0].progress);
  ok('存档往返保留发行数', back.eraReleases === 5);

  ok('坏存档不会崩溃', (function () {
    try { E.deserialize('{"era": 99, "projects": "x"}'); return true; }
    catch (e) { return false; }
  })());

  ok('越界的项目会被丢弃', (function () {
    var s3 = E.newGame();
    s3.era = 0;
    s3.projects = [{ uid: 1, name: 'x', size: 1, stage: 9, progress: 0, since: 0 }];
    var t = E.serialize(s3);
    var b = E.deserialize(t);
    return b.projects.every(function (p) { return p.stage < 2; });
  })());
})();

/* ---------- 离线 ---------- */
(function () {
  var s = E.newGame();
  s.era = 2;
  E.initEra(s);
  s.money = 1e5;
  for (var i = 0; i < 30; i++) E.tick(s, 1);

  var before = s.totalEarned;
  var rep = E.offline(s, 3600);
  ok('离线有收益', rep.earned > 0 && s.totalEarned > before, 'earned=' + Math.round(rep.earned));
  ok('离线收益受效率影响', near(rep.simulated, 3600 * E.offlineEfficiency(s), 1),
    rep.simulated + ' vs ' + 3600 * E.offlineEfficiency(s));
  ok('离线时长有上限', E.offline(s, 1e9).seconds === GD.OFFLINE_CAP);

  var before2 = s.totalEarned;
  var full = E.offline(s, 60, 1);
  ok('可以按 100% 效率结算（切标签页用）', full.simulated === 60 && s.totalEarned >= before2);
})();

/* ---------- 传承 ---------- */
(function () {
  var s = E.newGame();
  s.legacy = 100;
  ok('可以买传承', E.buyLegacy(s, 'speed') === true && s.legacyUp.speed === 1);
  var lv = s.legacyUp.speed;
  var cost = GD.LEGACY[1].cost(lv);
  var before = s.legacy;
  E.buyLegacy(s, 'speed');
  ok('传承价格递增', before - s.legacy > cost - GD.LEGACY[1].cost(lv - 1));

  var s2 = E.newGame();
  s2.legacyUp.crew = 2;
  s2.legacyUp.cash = 1;
  E.initEra(s2);
  ok('核心班底影响开局人数', s2.workers.concept === 3, 'workers=' + s2.workers.concept);
  ok('启动资金按时代物价缩放', s2.money > GD.ERAS[0].startCash);
})();

console.log('\n' + passed + ' 项通过，' + failed + ' 项失败');
process.exit(failed ? 1 : 0);
