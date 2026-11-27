/* ============================================================
 * tools/balance.js —— 30 年主线数值模拟器
 *
 * 用法：node tools/balance.js [局数] [detail]
 *   detail 会打印第一局的逐年奖项与每部作品的收入/成本
 *
 * 用一个「中等偏上」的机器人跑完整条 1972–2002 主线：
 * 每部作品按「品质 × 装机」挑企划与平台，该扩建就扩建、该买就买。
 * 输出作品数、破产次数、年度奖（冠/提）、现金轨迹、平台分布、净利率。
 * ============================================================ */
'use strict';

global.window = global;
require('../js/config.js');
require('../js/engine.js');

var GD = global.GD;
var E = GD.Engine;
var BAL = GD.BAL;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

var GENRES = GD.GENRES.map(function (g) { return g.id; });
var THEMES = GD.THEMES.map(function (t) { return t.id; });

/* 中等水平玩家：在「最近 4 个可用平台」里挑品质 × 装机的最高值 */
function pickPlan(s) {
  var plats = E.availablePlatforms(s).slice(-4);
  var best = null;
  for (var gi = 0; gi < GENRES.length; gi++) {
    for (var ti = 0; ti < THEMES.length; ti++) {
      for (var pi = 0; pi < plats.length; pi++) {
        for (var si = 0; si < s.staff.length; si++) {
          var plan = {
            genre: GENRES[gi], theme: THEMES[ti],
            leader: s.staff[si].id, platform: plats[pi].id
          };
          var pv = E.preview(s, plan);
          var value = (pv.scoreLow + pv.scoreHigh) / 2 * E.effInstall(s, plats[pi]);
          if (!best || value > best.value) best = { plan: plan, value: value };
        }
      }
    }
  }
  return best ? best.plan : s.plan;
}

function manage(s) {
  var cost = E.expandCost(s);
  if (cost != null && s.money > cost * 2.2 && s.staff.length >= s.seats) E.expandOffice(s);

  if (s.candidates.length && s.staff.length < s.seats) {
    var id = s.candidates[0];
    var fee = Math.round(E.rosterById(id).salary * BAL.hireFeeDays * E.inflation(s));
    if (s.money > fee * 4) E.hire(s, id);
  }

  if (!E.researchActive(s)) {
    var pool = GD.RESEARCH.filter(function (it) {
      return !E.researchDone(s, it.id) && s.money > E.researchCost(s, it) * 2.5;
    }).sort(function (a, b) { return a.cost - b.cost; });
    if (pool.length) E.startResearch(s, pool[0].id);
  }

  var gearPool = GD.GEAR.filter(function (g) {
    return !E.hasGear(s, g.id) && s.money > E.gearCost(s, g) * 3;
  }).sort(function (a, b) { return a.cost - b.cost; });
  if (gearPool.length) E.buyGear(s, gearPool[0].id);
}

function playOnce(seed) {
  Math.random = mulberry32(seed);
  var s = E.newGame();
  E.chooseDeclaration(s, 'garage');

  var guard = 0, bankrupt = 0, marks = {}, platformUse = {}, stuck = null, trace = [];
  var revSum = 0, profitSum = 0;

  while (guard++ < 500000) {
    E.tick(s, 1 / 30);

    if (s.phase === 'ending') break;

    if (s.phase === 'event') {
      if (!s.event) {
        console.log('!! seed ' + seed + ' phase=event 但 s.event 为空 · year=' + E.year(s) +
          ' progress=' + (s.project ? (s.project.progress * 100).toFixed(1) + '%' : 'n/a') +
          ' eventsDone=' + (s.project ? s.project.eventsDone : 'n/a'));
        stuck = 'event-null';
        break;
      }
      var optN = s.event.options.length;
      var done = false;
      for (var c = 0; c < optN && !done; c++) done = E.chooseEvent(s, c);
      if (!done) { stuck = 'event'; break; }
      continue;
    }
    if (s.phase === 'release') { E.confirmRelease(s, 'now'); continue; }
    if (s.phase === 'done') {
      var lr = s.lastResult || {};
      trace.push({
        year: E.year(s), plat: s.plan.platform,
        cap: E.platformById(s.plan.platform, s).cap,
        q: Math.round(lr.quality || 0), total: lr.total || 0,
        rev: Math.round(lr.revenue || 0), cost: Math.round(lr.cost || 0)
      });
      E.nextRound(s);
      continue;
    }

    if (s.phase === 'planning') {
      if (marks[E.year(s)] == null) marks[E.year(s)] = s.money;
      manage(s);
      s.plan = pickPlan(s);
      if (!E.startProject(s, s.plan)) {
        if (E.rescue(s)) { bankrupt++; }
        else { stuck = 'poor'; break; }
        if (!E.startProject(s, s.plan)) { stuck = 'poor2'; break; }
      }
      platformUse[s.plan.platform] = (platformUse[s.plan.platform] || 0) + 1;
      continue;
    }
  }
  if (!stuck && s.phase !== 'ending') stuck = 'guard';

  (s.history || []).forEach(function (h) { if (!h || h.revenue == null) return; revSum += h.revenue; profitSum += (h.profit || 0); });
  var endYear = BAL.endYear;
  var wins = 0, noms = 0;
  (s.yearResults || []).forEach(function (y) {
    if (!y.winner) wins++; else if (y.playerAward) noms++;
  });
  return {
    seed: seed,
    ended: s.phase,
    endedYear: E.year(s),
    finished: s.ended,
    games: s.history.length,
    money: Math.round(s.money),
    totalEarned: Math.round(s.totalEarned),
    awards: s.awards.length,
    wins: wins,
    noms: noms,
    bankrupt: bankrupt,
    research: (s.research.done || []).length,
    gear: (s.furniture || []).length,
    staff: s.staff.length,
    stuck: stuck,
    marks: marks,
    platformUse: platformUse,
    trace: trace,
    yearResults: s.yearResults,
    revSum: revSum, profitSum: profitSum,
    lastScore: s.history.length ? s.history[s.history.length - 1].total : 0
  };
}

var N = Number(process.argv[2] || 12);
var DETAIL = process.argv[3] === 'detail';
var rows = [];
for (var i = 1; i <= N; i++) {
  var one = playOnce(i);
  rows.push(one);
  if (DETAIL && i === 1) {
    console.log('=== seed 1 逐年结果 ===');
    (one.trace || []).slice(-14).forEach(function (t) { console.log('  作品 ' + t.year + ' 平台 ' + t.plat + ' 评分 ' + t.total + ' 收入 $' + (t.rev/1e6).toFixed(2) + 'M 成本 $' + (t.cost/1e6).toFixed(2) + 'M 净利率 ' + (t.rev ? Math.round((t.rev-t.cost)/t.rev*100) : 0) + '%'); });
    (one.yearResults || []).forEach(function (y) {
      console.log('  ' + y.year + '  你 ' + y.playerScore + '  ' +
        (y.winner ? '被 ' + y.winner + '《' + y.winnerTitle + '》' + y.winnerScore + ' 拿走' : '你拿奖') +
        (y.playerBrand ? '（子品牌）' : ''));
    });
  }
}

function avg(list) { return list.reduce(function (a, b) { return a + b; }, 0) / list.length; }
function med(list) {
  var c = list.slice().sort(function (a, b) { return a - b; });
  return c[Math.floor(c.length / 2)];
}

console.log('seed | 结局          | 结束年 | 作品 | 破产 | 冠/提 | 现金      | 总收入    | 研究 | 设备 | 团队 | 卡住');
rows.forEach(function (r) {
  console.log([
    String(r.seed).padStart(4),
    (r.ended + (r.finished ? '(完)' : '')).padEnd(13),
    String(r.endedYear).padStart(6),
    String(r.games).padStart(4),
    String(r.bankrupt).padStart(4),
    ((r.wins + '/' + r.noms)).padStart(6),
    ('$' + (r.money / 1e6).toFixed(2) + 'M').padStart(9),
    ('$' + (r.totalEarned / 1e6).toFixed(1) + 'M').padStart(9),
    String(r.research).padStart(4),
    String(r.gear).padStart(4),
    String(r.staff).padStart(4),
    (r.stuck || '-').padStart(6)
  ].join(' | '));
});

console.log('\n=== 汇总（' + N + ' 局）===');
console.log('作品数     中位 ' + med(rows.map(function (r) { return r.games; })));
console.log('破产/预支  合计 ' + rows.reduce(function (a, r) { return a + r.bankrupt; }, 0) +
  ' · 平均 ' + avg(rows.map(function (r) { return r.bankrupt; })).toFixed(2));
console.log('年度奖     中位 ' + med(rows.map(function (r) { return r.awards; })));
console.log('结束时现金  中位 $' + (med(rows.map(function (r) { return r.money; })) / 1e6).toFixed(2) + 'M');
console.log('总收入     中位 $' + (med(rows.map(function (r) { return r.totalEarned; })) / 1e6).toFixed(1) + 'M');
console.log('研究完成    中位 ' + med(rows.map(function (r) { return r.research; })) + ' / ' + GD.RESEARCH.length);
console.log('设备购置    中位 ' + med(rows.map(function (r) { return r.gear; })) + ' / ' + GD.GEAR.length);

var endings = {};
rows.forEach(function (r) { endings[r.ended] = (endings[r.ended] || 0) + 1; });
console.log('结局分布   ' + JSON.stringify(endings));
var revs = rows.reduce(function (a, r) { return a + r.revSum; }, 0);
var profs = rows.reduce(function (a, r) { return a + r.profitSum; }, 0);
console.log('整体净利率  ' + (revs ? Math.round(profs / revs * 100) : 0) + '%（利润/营收）');

var eras = [[1972, 1982], [1983, 1991], [1992, 2001]];
console.log('\n=== 现金轨迹（各局中位）===');
eras.forEach(function (e) {
  var vals = rows.map(function (r) {
    var sum = 0, n = 0;
    for (var y = e[0]; y <= e[1]; y++) if (r.marks[y] != null) { sum += r.marks[y]; n++; }
    return n ? sum / n : 0;
  });
  console.log(e[0] + '-' + e[1] + '  平均现金 $' + (med(vals) / 1e6).toFixed(2) + 'M');
});

var use = {};
rows.forEach(function (r) { for (var k in r.platformUse) use[k] = (use[k] || 0) + r.platformUse[k]; });
var totalUse = Object.keys(use).reduce(function (a, k) { return a + use[k]; }, 0) || 1;
var top = Object.keys(use).sort(function (a, b) { return use[b] - use[a]; }).slice(0, 5);
console.log('\n=== 平台使用（前五）===');
top.forEach(function (k) {
  console.log('  ' + k + ': ' + use[k] + ' 次 (' + Math.round(use[k] / totalUse * 100) + '%)');
});
