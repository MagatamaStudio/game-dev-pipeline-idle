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

/* ---------------- 打法（策略） ----------------
 * 同一个引擎、同一套随机种子，只换「怎么挑企划」，用来找有没有暴力解。 */
var STRATEGIES = {
  /* 中等偏上：品质 × 装机 最高 */
  balanced: {
    name: '均衡',
    pick: function (s) {
      var plats = E.availablePlatforms(s).slice(-4);
      var best = null;
      for (var gi = 0; gi < GENRES.length; gi++) {
        for (var ti = 0; ti < THEMES.length; ti++) {
          for (var pi = 0; pi < plats.length; pi++) {
            for (var si = 0; si < s.staff.length; si++) {
              var plan = { genre: GENRES[gi], theme: THEMES[ti], leader: s.staff[si].id, platform: plats[pi].id, scale: 'mid' };
              var pv = E.preview(s, plan);
              var value = (pv.scoreLow + pv.scoreHigh) / 2 * E.effInstall(s, plats[pi]);
              if (!best || value > best.value) best = { plan: plan, value: value };
            }
          }
        }
      }
      return best ? best.plan : s.plan;
    }
  },

  /* 低价快出：只看成本低、周期短，装机大就行，不追品质 */
  cheap: {
    name: '低价快出',
    pick: function (s) {
      var plats = E.availablePlatforms(s).slice(-2);
      var best = null;
      for (var gi = 0; gi < GENRES.length; gi++) {
        for (var ti = 0; ti < THEMES.length; ti++) {
          for (var pi = 0; pi < plats.length; pi++) {
            var fastest = s.staff[0];
            s.staff.forEach(function (x) { if (x.stats.speed > fastest.stats.speed) fastest = x; });
            var plan = { genre: GENRES[gi], theme: THEMES[ti], leader: fastest.id, platform: plats[pi].id, scale: 'small' };
            var pv = E.preview(s, plan);
            var value = E.effInstall(s, plats[pi]) / Math.max(1, pv.cost);
            if (!best || value > best.value) best = { plan: plan, value: value };
          }
        }
      }
      return best ? best.plan : s.plan;
    }
  },

  /* 偏科：只堆一项，冲「最佳画面 / 音乐 / 剧情」那三个单项奖 */
  specialist: {
    name: '偏科单项',
    cat: 'art',
    pick: function (s, strat) {
      var plats = E.availablePlatforms(s).slice(-4);
      var best = null;
      var key = strat.cat || 'art';
      for (var gi = 0; gi < GENRES.length; gi++) {
        for (var ti = 0; ti < THEMES.length; ti++) {
          for (var pi = 0; pi < plats.length; pi++) {
            var plan = { genre: GENRES[gi], theme: THEMES[ti], leader: s.staff[0].id, platform: plats[pi].id, scale: 'mid' };
            /* 模拟「把资源全砸在这一项上」：用该项能力当价值 */
            var bestStat = 0;
            s.staff.forEach(function (st) { if (st.stats[key] > bestStat) bestStat = st.stats[key]; });
            s.staff.forEach(function (st) {
              if (st.stats[key] === bestStat) plan.leader = st.id;
            });
            var pv = E.preview(s, plan);
            var value = (pv.scoreLow + pv.scoreHigh) / 2 * E.effInstall(s, plats[pi]) * (1 + bestStat / 400);
            if (!best || value > best.value) best = { plan: plan, value: value };
          }
        }
      }
      return best ? best.plan : s.plan;
    }
  },

  /* 续作流：能出续作就出续作 */
  sequel: {
    name: '续作流',
    pick: function (s) {
      var cands = E.sequelCandidates(s);
      if (cands.length) {
        var c = cands[0];
        var plats = E.availablePlatforms(s).slice(-2);
        var plan = { genre: c.genre, theme: c.theme, leader: s.staff[0].id, platform: plats[plats.length - 1].id, sequel: c.index, scale: 'mid' };
        return plan;
      }
      return STRATEGIES.balanced.pick(s);
    }
  },

  /* 合作流：能拉对手就拉 */
  coop: {
    name: '合作流',
    pick: function (s) {
      var base = STRATEGIES.balanced.pick(s);
      var opts = E.coopOptions(s);
      if (opts.length && s.money > E.coopFee(s, opts[0]) * 3) {
        var match = null;
        opts.forEach(function (r) { if (r.genre === base.genre && !match) match = r; });
        base.coop = (match || opts[0]).id;
      }
      return base;
    }
  }
};

function pickPlan(s, strat) {
  return strat.pick(s, strat);
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
      return !E.researchDone(s, it.id) && E.researchYearOk(s, it) &&
        s.money > E.researchCost(s, it) * 2.5;
    }).sort(function (a, b) { return a.cost - b.cost; });
    if (pool.length) E.startResearch(s, pool[0].id);
  }

  var gearPool = GD.GEAR.filter(function (g) {
    return !E.hasGear(s, g.id) && E.gearYearOk(s, g) && s.money > E.gearCost(s, g) * 3;
  }).sort(function (a, b) { return a.cost - b.cost; });
  if (gearPool.length) E.buyGear(s, gearPool[0].id);
}

function playOnce(seed, strat) {
  Math.random = mulberry32(seed);
  var s = E.newGame();
  E.chooseDeclaration(s, 'garage');

  var guard = 0, bankrupt = 0, bankruptsSeen = 0, marks = {}, platformUse = {}, stuck = null, trace = [];
  var revSum = 0, profitSum = 0;

  while (guard++ < 500000) {
    E.tick(s, 1 / 30);

    if (s.phase === 'ending') break;

    /* 破产：先记账，然后用新公司接着跑（这也是真实玩法，顺便验证重开流程） */
    if (s.phase === 'bankrupt') {
      bankrupt++;
      bankruptsSeen = (bankruptsSeen || 0) + 1;
      if (!E.newCompany(s, 'makemoney')) { stuck = 'bankrupt'; break; }
      continue;
    }

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
      s.plan = pickPlan(s, strat);
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
  var catWins = {};
  (s.awards || []).forEach(function (a) {
    var k = a.cat || a.title || '?';
    catWins[k] = (catWins[k] || 0) + 1;
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
    catWins: catWins,
    wins: wins,
    noms: noms,
    bankrupt: bankruptsSeen || bankrupt,
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
var ONLY = process.argv[3] && process.argv[3] !== 'detail' ? process.argv[3] : null;
var DETAIL = process.argv.indexOf('detail') >= 0;

/* 只跑一种打法（默认均衡），保持旧的输出格式 */
function runOne(stratKey, detail) {
  var strat = STRATEGIES[stratKey] || STRATEGIES.balanced;
  var rows = [];
  for (var i = 1; i <= N; i++) {
    var one = playOnce(i, strat);
    rows.push(one);
    if (detail && i === 1) {
      console.log('=== seed 1 逐年结果（' + strat.name + '）===');
      (one.trace || []).slice(-14).forEach(function (t) { console.log('  作品 ' + t.year + ' 平台 ' + t.plat + ' 评分 ' + t.total + ' 收入 $' + (t.rev/1e6).toFixed(2) + 'M 成本 $' + (t.cost/1e6).toFixed(2) + 'M 净利率 ' + (t.rev ? Math.round((t.rev-t.cost)/t.rev*100) : 0) + '%'); });
    }
  }
  return rows;
}

/* 多打法对比模式 */
function compareAll() {
  var keys = Object.keys(STRATEGIES);
  console.log('=== 多打法对比（每格 ' + N + ' 局）===');
  console.log('打法        | 作品 | 破产 | 冠/年 | 净利率 | 结束现金 | 总分中位 | 最该赢的赢了吗');
  keys.forEach(function (k) {
    var rows = [];
    for (var i = 1; i <= N; i++) rows.push(playOnce(i, STRATEGIES[k]));
    var rev = sum(rows.map(function (r) { return r.revSum; }));
    var prof = sum(rows.map(function (r) { return r.profitSum; }));
    var wins = sum(rows.map(function (r) { return r.wins; }));
    var games = sum(rows.map(function (r) { return r.games; }));
    var bankrupt = sum(rows.map(function (r) { return r.bankrupt; }));
    var cash = med(rows.map(function (r) { return r.money; }));
    var scores = [];
    rows.forEach(function (r) { (r.trace || []).forEach(function (t) { if (t.total) scores.push(t.total); }); });
    console.log([
      STRATEGIES[k].name.padEnd(10),
      String(games).padStart(4),
      String(bankrupt).padStart(4),
      String(wins).padStart(5),
      String(rev ? Math.round(prof / rev * 100) : 0).padStart(5) + '%',
      ('$' + (cash / 1e6).toFixed(0) + 'M').padStart(8),
      String(scores.length ? med(scores) : 0).padStart(8),
      String(rows.map(function (r) { return r.stuck || '-'; }).join('/')).padStart(10)
    ].join(' | '));
  });
}

var rows = (function () {
  if (ONLY === 'compare') { compareAll(); return []; }
  return runOne(ONLY || 'balanced', DETAIL);
})();
if (!rows.length) process.exit(0);

function avg(list) { return list.reduce(function (a, b) { return a + b; }, 0) / list.length; }
function sum(list) { return list.reduce(function (a, b) { return a + b; }, 0); }
function and(list) { return sum(list) || 1; }
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

/* 6 类奖项分别赢了多少年（分母是总局数 × 30 年） */
var catTotal = {};
rows.forEach(function (r) {
  for (var k in r.catWins) catTotal[k] = (catTotal[k] || 0) + r.catWins[k];
});
var yearsTotal = and(rows.map(function (r) { return r.endedYear - GD.BAL.startYear; }));
console.log('奖项分布   ' + GD.AWARD_CATS.map(function (c) {
  var n = catTotal[c.id] || 0;
  return c.short + ' ' + (n / yearsTotal * 100).toFixed(0) + '%';
}).join(' · '));
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
