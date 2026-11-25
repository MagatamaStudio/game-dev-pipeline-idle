/* ============================================================
 * tools/sim.js —— 数值模拟器
 * 用一个「聪明玩家」的贪心策略把整条历史跑一遍，输出每个时代的耗时。
 * 用法：node tools/sim.js
 * ============================================================ */
'use strict';

global.window = global;
require('../js/config.js');
require('../js/engine.js');

var GD = global.GD;
var E = GD.Engine;

/* 给定产能数组，估算有效吞吐（与 engine 的算法一致） */
function throughputOf(needs, caps, slots, lineRate) {
  var slowest = Infinity, total = 0;
  for (var i = 0; i < needs.length; i++) {
    if (caps[i] <= 0) return 0;
    var t = needs[i] / caps[i];
    total += t;
    if (1 / t < slowest) slowest = 1 / t;
  }
  if (isFinite(lineRate) && lineRate > 0) {
    var tl = 1 / lineRate;
    total += tl;
    if (1 / tl < slowest) slowest = 1 / tl;
  }
  return Math.min(slowest, slots / total);
}

function capsOf(s) {
  var era = GD.ERAS[s.era];
  var out = [];
  for (var i = 0; i < era.stages.length; i++) out.push(E.capacity(s, era.stages[i].id));
  return out;
}

/* 走一步贪心：在所有可买的升级里，找「每块钱带来的吞吐提升」最大的 */
function buyBest(s) {
  var era = GD.ERAS[s.era];
  var needs = era.stages.map(function (st) { return st.need; });
  var caps = capsOf(s);
  var base = throughputOf(needs, caps, s.slots, E.lineRate(s));
  var best = null;

  function consider(kind, cost, apply, newLineRate) {
    if (!(cost > 0) || s.money < cost) return;
    var next = caps.slice();
    var slots = s.slots;
    apply(next, function () { slots++; });
    var rate = typeof newLineRate === 'number' ? newLineRate : E.lineRate(s);
    var gain = throughputOf(needs, next, slots, rate) - base;
    if (!(gain > 0)) return;
    var score = gain / cost;
    if (!best || score > best.score) best = { kind: kind, cost: cost, score: score, run: apply };
  }

  for (var i = 0; i < era.stages.length; i++) {
    (function (idx) {
      var id = era.stages[idx].id;
      consider('worker:' + id, E.workerCost(s, id), function (arr) {
        arr[idx] += era.eff * (caps[idx] / (s.workers[id] * era.eff));
      });
    })(i);
  }

  for (var t = 0; t < era.tools.length; t++) {
    (function (tool) {
      var idx = era.stages.findIndex(function (st) { return st.id === tool.stage; });
      consider('tool:' + tool.id, E.toolCost(s, tool), function (arr) {
        arr[idx] *= tool.mult;
      });
    })(era.tools[t]);
  }

  consider('engine', E.engineCost(s), function (arr) {
    for (var k = 0; k < arr.length; k++) arr[k] *= era.engine.mult;
  });

  if (s.slots < GD.MAX_SLOTS) {
    consider('slot', E.slotCost(s), function (arr, incSlots) { incSlots(); });
  }

  if (era.line) {
    consider('line', E.lineCost(s), function () {}, E.lineRate(s) * era.line.mult);
  }

  if (!best) return false;
  if (best.kind.indexOf('worker:') === 0) E.buyWorker(s, best.kind.slice(7));
  else if (best.kind.indexOf('tool:') === 0) {
    var id2 = best.kind.slice(5);
    E.buyTool(s, era.tools.find(function (x) { return x.id === id2; }));
  } else if (best.kind === 'engine') E.buyEngine(s);
  else if (best.kind === 'slot') E.buySlot(s);
  else if (best.kind === 'line') E.buyLine(s);
  return true;
}

function runEra(eraIndex, legacyUp, verbose) {
  var s = E.newGame();
  s.era = eraIndex;
  s.legacyUp = Object.assign({ cash: 0, speed: 0, offline: 0, crew: 0 }, legacyUp || {});
  E.initEra(s);

  var goal = GD.ERAS[eraIndex].goal.releases;
  var dt = 0.5;
  var t = 0;
  var guard = 0;
  while (s.eraReleases < goal && guard++ < 200000) {
    E.tick(s, dt);
    t += dt;
    // 每 2 秒尝试一次购物，模拟人类手速
    if (Math.floor(t / 2) !== Math.floor((t - dt) / 2)) {
      var bought = 0;
      while (bought < 6 && buyBest(s)) bought++;
    }
  }
  if (verbose) {
    console.log('  workers', JSON.stringify(s.workers),
      'tools', JSON.stringify(s.toolLv), 'slots', s.slots, 'engine', s.engineLv, 'line', s.lineLv);
  }
  return { time: t, s: s, ok: s.eraReleases >= goal };
}

function fmtT(sec) {
  var m = Math.floor(sec / 60), ss = Math.floor(sec % 60);
  return m + 'm' + (ss < 10 ? '0' : '') + ss + 's';
}

var total = 0;
var legacy = 0;
console.log('=== 单时代（无传承加成） ===');
for (var i = 0; i < GD.ERAS.length; i++) {
  var r = runEra(i, { cash: 0, speed: 0, offline: 0, crew: 0 }, true);
  total += r.time;
  console.log(
    'E' + (i + 1) + ' ' + GD.ERAS[i].year + ' ' + GD.ERAS[i].name +
    ' | 目标 ' + GD.ERAS[i].goal.releases + ' 部 | 用时 ' + fmtT(r.time) +
    ' | 遗产 +' + E.legacyGain(r.s) + ' | 结束资金 $' + GD.fmt(r.s.money)
  );
}
console.log('合计 ' + fmtT(total));

console.log('\n=== 完整一轮（传承即时消费） ===');
var s2 = E.newGame();
var t2 = 0, guard2 = 0;
var eraReport = [];
while (guard2++ < 400000) {
  E.tick(s2, 0.5);
  t2 += 0.5;
  if (Math.floor(t2 / 2) !== Math.floor((t2 - 0.5) / 2)) {
    var b = 0;
    while (b < 6 && buyBest(s2)) b++;
  }
  if (E.goalMet(s2)) {
    var before = s2.era;
    var res = E.advanceEra(s2);
    if (res) {
      eraReport.push(res.finished + ' ' + fmtT(t2 - (s2.eraStartedAt || 0)));
      // 花掉遗产：优先 crew / speed
      var spent = true;
      while (spent) {
        spent = false;
        if (E.buyLegacy(s2, 'crew')) spent = true;
        else if (E.buyLegacy(s2, 'speed')) spent = true;
        else if (E.buyLegacy(s2, 'cash')) spent = true;
      }
      if (res.wrapped) { console.log('一轮完成，用时 ' + fmtT(t2)); break; }
    }
  }
}
console.log('传承等级', JSON.stringify(s2.legacyUp), '剩余传承', s2.legacy);

console.log('\n=== 离线 8 小时（从 E3 开局） ===');
var s3 = E.newGame();
s3.era = 2;
E.initEra(s3);
for (var k = 0; k < 60; k++) E.tick(s3, 1);
var off = E.offline(s3, 8 * 3600);
console.log('离线收益 $' + GD.fmt(off.earned) + '，发行 ' + off.releases + ' 部');
