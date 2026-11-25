/* ============================================================
 * engine.js —— 纯逻辑，不碰 DOM，可在 Node 里直接跑
 * 所有数值都在这里结算，方便做离线模拟与自动化测试。
 * ============================================================ */
(function (GD) {
  'use strict';

  var E = {};
  GD.Engine = E;

  /* ---------------- 基础查询 ---------------- */

  E.era = function (s) { return GD.ERAS[s.era]; };

  E.burstMult = function (s) {
    return s.time < s.burstUntil ? GD.BURST_MULT : 1;
  };

  E.burstReadyIn = function (s) {
    return Math.max(0, s.burstReadyAt - s.time);
  };

  E.capacity = function (s, stageId) {
    var era = GD.ERAS[s.era];
    var workers = s.workers[stageId] || 0;
    if (workers <= 0) return 0;
    var mult = Math.pow(era.engine.mult, s.engineLv || 0);
    for (var i = 0; i < era.tools.length; i++) {
      var t = era.tools[i];
      if (t.stage === stageId) mult *= Math.pow(t.mult, s.toolLv[t.id] || 0);
    }
    mult *= 1 + 0.12 * (s.legacyUp.speed || 0);
    mult *= E.burstMult(s);
    return workers * era.eff * mult;
  };

  /* 卡带产线：出厂速度的硬上限（只有 1985 这类有产线的时代才有） */
  E.lineRate = function (s) {
    var era = GD.ERAS[s.era];
    if (!era.line) return Infinity;
    return era.line.base * Math.pow(era.line.mult, s.lineLv || 0) *
      (1 + 0.12 * (s.legacyUp.speed || 0));
  };

  E.lineCost = function (s) {
    var era = GD.ERAS[s.era];
    if (!era.line) return Infinity;
    return era.line.cost * Math.pow(era.line.growth, s.lineLv || 0);
  };

  E.buyLine = function (s) {
    var era = E.era(s);
    if (!era.line) return false;
    var cost = E.lineCost(s);
    if (s.money < cost) return false;
    s.money -= cost;
    s.lineLv = (s.lineLv || 0) + 1;
    return true;
  };

  /* 每秒能完成多少部作品。
   * 三个上限取小：最慢部门（瓶颈）、槽位 / 单部总耗时、产线节拍。 */
  E.throughput = function (s) {
    var era = GD.ERAS[s.era];
    var slowest = Infinity, total = 0;
    for (var i = 0; i < era.stages.length; i++) {
      var st = era.stages[i];
      var cap = E.capacity(s, st.id);
      if (cap <= 0) return 0;
      var t = st.need / cap;
      total += t;
      var rate = 1 / t;
      if (rate < slowest) slowest = rate;
    }
    var bySlots = s.slots / total;
    if (era.line) {
      var tl = 1 / E.lineRate(s);
      total += tl;
      if (1 / tl < slowest) slowest = 1 / tl;
      bySlots = s.slots / total;
    }
    return Math.min(isFinite(slowest) ? slowest : 0, bySlots);
  };

  E.bottleneck = function (s) {
    var era = GD.ERAS[s.era];
    var worst = null, worstRate = Infinity;
    for (var i = 0; i < era.stages.length; i++) {
      var st = era.stages[i];
      var rate = E.capacity(s, st.id) / st.need;
      if (rate < worstRate) { worstRate = rate; worst = st.id; }
    }
    return worst;
  };

  E.fameMult = function (s) { return 1 + Math.sqrt(s.fame) * 0.035; };

  E.workerCost = function (s, stageId) {
    var era = GD.ERAS[s.era];
    var have = s.workers[stageId] || 0;
    return era.wages[stageId] * Math.pow(era.wageGrowth, have - s.baseWorkers);
  };

  E.toolCost = function (s, tool) {
    return tool.cost * Math.pow(2, s.toolLv[tool.id] || 0);
  };

  E.engineCost = function (s) {
    return E.era(s).engine.cost * Math.pow(2.2, s.engineLv || 0);
  };

  E.slotCost = function (s) {
    var era = E.era(s);
    return era.slotCost * Math.pow(era.slotGrowth, s.slots - 1);
  };

  /* ---------------- 项目 ---------------- */

  E.newProject = function (s) {
    var era = GD.ERAS[s.era];
    var used = s.projects.map(function (p) { return p.name; });
    return {
      uid: s.uid++,
      name: GD.pickName(era.words, used),
      size: GD.pickSize(era.sizes),
      stage: 0,
      progress: 0,
      since: s.time
    };
  };

  E.topUp = function (s) {
    var guard = 0;
    while (s.projects.length < s.slots && guard++ < 20) {
      s.projects.push(E.newProject(s));
    }
  };

  function logEvent(s, events, ev) {
    s.log.push({ t: s.time, text: ev.text, kind: ev.kind });
    if (s.log.length > 40) s.log.shift();
    if (events && events.length < 40) events.push(ev);
  }

  E.release = function (s, p, events) {
    var era = GD.ERAS[s.era];
    var quality = 1 + Math.random() * 0.25;
    var money = era.price * p.size * quality * E.fameMult(s);

    s.money += money;
    s.earned += money;
    s.totalEarned += money;
    s.releases++;
    s.eraReleases++;
    s.totalReleases = (s.totalReleases || 0) + 1;
    s.fame += 1 + (p.size - 1) * 0.5;
    if (money > s.best) s.best = money;

    logEvent(s, events, {
      type: 'release', name: p.name, price: money,
      size: p.size, quality: quality,
      text: '发行《' + p.name + '》 +' + GD.fmtMoney(money)
    });
  };

  function advanceStage(s, p, events) {
    var era = GD.ERAS[s.era];
    p.stage++;
    p.progress = 0;
    p.since = s.time;
    if (p.stage >= era.stages.length) {
      if (era.line) {
        p.shipping = true;           // 做完了，排队等产线
      } else {
        E.release(s, p, events);
        p.done = true;
      }
    }
  }

  /* ---------------- 主循环 ---------------- */

  E.tick = function (s, dt, opts) {
    if (!(dt > 0)) return [];
    var events = [];
    var era = GD.ERAS[s.era];
    s.time += dt;
    E.topUp(s);

    for (var i = 0; i < era.stages.length; i++) {
      var stage = era.stages[i];
      var cap = E.capacity(s, stage.id) * dt;
      if (cap <= 0) continue;

      var list = [];
      for (var j = 0; j < s.projects.length; j++) {
        if (s.projects[j].stage === i) list.push(s.projects[j]);
      }
      if (list.length > 1) list.sort(function (a, b) { return a.since - b.since; });

      for (var k = 0; k < list.length && cap > 0; k++) {
        var p = list[k];
        var need = stage.need * p.size;
        var remain = need - p.progress;
        if (remain <= 0) { advanceStage(s, p, events); continue; }
        var use = cap < remain ? cap : remain;
        p.progress += use;
        cap -= use;
        if (p.progress >= need - 1e-6) advanceStage(s, p, events);
      }
    }

    /* 出厂：有产线的时代，产线本身就是最后一道工序，
     * 每个项目在产线上要花 1 / 产线速率 秒。 */
    if (era.line) {
      var budget = E.lineRate(s) * dt;
      var queue = [];
      for (var w = 0; w < s.projects.length; w++) {
        if (s.projects[w].stage >= era.stages.length && !s.projects[w].done) queue.push(s.projects[w]);
      }
      if (queue.length > 1) queue.sort(function (a, b) { return a.since - b.since; });
      for (var q = 0; q < queue.length && budget > 0; q++) {
        var ship = queue[q];
        var remain = 1 - (ship.progress || 0);
        var use = budget < remain ? budget : remain;
        ship.progress = (ship.progress || 0) + use;
        budget -= use;
        if (ship.progress >= 1 - 1e-9) {
          E.release(s, ship, events);
          ship.done = true;
        }
      }
    }

    if (s.projects.length && s.projects.some(function (p) { return p.done; })) {
      s.projects = s.projects.filter(function (p) { return !p.done; });
    }
    E.topUp(s);

    if (s.money > (s.peakMoney || 0)) s.peakMoney = s.money;
    return events;
  };

  /* ---------------- 外包（1995 专属） ---------------- */

  E.stageIndex = function (s, stageId) {
    var stages = E.era(s).stages;
    for (var i = 0; i < stages.length; i++) if (stages[i].id === stageId) return i;
    return -1;
  };

  /* 价格 = 该部门所有在制项目的「剩余工作量」折算成收入的比例。
   * 越早介入越贵，因为省下的时间更多。 */
  E.outsourceCost = function (s, stageId) {
    var era = E.era(s);
    if (!era.outsource) return 0;
    var idx = E.stageIndex(s, stageId);
    if (idx < 0) return 0;
    var st = era.stages[idx];
    var total = 0;
    for (var i = 0; i < s.projects.length; i++) {
      var p = s.projects[i];
      if (p.stage !== idx) continue;
      var need = st.need * p.size;
      var remain = Math.max(0, need - p.progress);
      total += era.price * p.size * era.outsource.rate * (remain / need);
    }
    return total;
  };

  E.outsource = function (s, stageId) {
    var cost = E.outsourceCost(s, stageId);
    if (!(cost > 0) || s.money < cost) return null;
    var era = E.era(s);
    var idx = E.stageIndex(s, stageId);
    var st = era.stages[idx];
    var events = [];

    s.money -= cost;
    var list = s.projects.filter(function (p) { return p.stage === idx; });
    for (var i = 0; i < list.length; i++) {
      list[i].progress = st.need * list[i].size;
      advanceStage(s, list[i], events);
    }
    s.projects = s.projects.filter(function (p) { return !p.done; });
    E.topUp(s);
    return { cost: cost, events: events };
  };

  /* ---------------- 购买 ---------------- */

  E.buyWorker = function (s, stageId) {
    var cost = E.workerCost(s, stageId);
    if (s.money < cost) return false;
    s.money -= cost;
    s.workers[stageId] = (s.workers[stageId] || 0) + 1;
    return true;
  };

  E.buyTool = function (s, tool) {
    var cost = E.toolCost(s, tool);
    if (s.money < cost) return false;
    s.money -= cost;
    s.toolLv[tool.id] = (s.toolLv[tool.id] || 0) + 1;
    return true;
  };

  E.buyEngine = function (s) {
    var cost = E.engineCost(s);
    if (s.money < cost) return false;
    s.money -= cost;
    s.engineLv = (s.engineLv || 0) + 1;
    return true;
  };

  E.buySlot = function (s) {
    if (s.slots >= GD.MAX_SLOTS) return false;
    var cost = E.slotCost(s);
    if (s.money < cost) return false;
    s.money -= cost;
    s.slots++;
    return true;
  };

  E.burst = function (s) {
    if (s.time < s.burstReadyAt) return false;
    s.burstUntil = s.time + GD.BURST_DURATION;
    s.burstReadyAt = s.time + GD.BURST_COOLDOWN;
    return true;
  };

  /* ---------------- 时代推进 ---------------- */

  E.goalMet = function (s) {
    return s.eraReleases >= GD.ERAS[s.era].goal.releases;
  };

  E.legacyGain = function (s) {
    var base = 2 + Math.sqrt(s.eraReleases) * (1 + s.era * 0.35);
    return Math.max(2, Math.floor(base));
  };

  E.advanceEra = function (s) {
    if (!E.goalMet(s)) return null;
    var gain = E.legacyGain(s);
    s.legacy += gain;
    var finishedName = GD.ERAS[s.era].name;
    s.era++;
    var wrapped = false;
    if (s.era >= GD.ERAS.length) {
      s.era = 0;
      s.cycle = (s.cycle || 1) + 1;
      wrapped = true;
    }
    E.initEra(s);
    return { gain: gain, finished: finishedName, wrapped: wrapped, era: s.era };
  };

  E.initEra = function (s) {
    var era = GD.ERAS[s.era];
    s.money = 0;
    s.fame = 0;
    s.earned = 0;
    s.eraReleases = 0;
    s.projects = [];
    s.toolLv = {};
    s.engineLv = 0;
    s.lineLv = 0;
    s.slots = 1;
    s.burstUntil = 0;
    s.burstReadyAt = 0;

    s.baseWorkers = 1 + (s.legacyUp.crew || 0);
    s.workers = {};
    for (var i = 0; i < era.stages.length; i++) {
      s.workers[era.stages[i].id] = s.baseWorkers;
    }

    s.money = (era.startCash || 0) + era.price * 2 * (s.legacyUp.cash || 0);
    s.eraStartedAt = s.time;
    E.topUp(s);
  };

  E.buyLegacy = function (s, id) {
    var def = null;
    for (var i = 0; i < GD.LEGACY.length; i++) if (GD.LEGACY[i].id === id) def = GD.LEGACY[i];
    if (!def) return false;
    var lv = s.legacyUp[id] || 0;
    if (lv >= def.max) return false;
    var cost = def.cost(lv);
    if (s.legacy < cost) return false;
    s.legacy -= cost;
    s.legacyUp[id] = lv + 1;
    return true;
  };

  /* ---------------- 存档 ---------------- */

  E.newGame = function () {
    var s = {
      v: 1,
      era: 0,
      cycle: 1,
      time: 0,
      money: 0,
      fame: 0,
      earned: 0,
      totalEarned: 0,
      releases: 0,
      totalReleases: 0,
      eraReleases: 0,
      peakMoney: 0,
      best: 0,
      legacy: 0,
      legacyUp: { cash: 0, speed: 0, offline: 0, crew: 0 },
      workers: {},
      toolLv: {},
      engineLv: 0,
      lineLv: 0,
      slots: 1,
      baseWorkers: 1,
      projects: [],
      uid: 1,
      burstUntil: 0,
      burstReadyAt: 0,
      log: [],
      lastSeen: Date.now()
    };
    E.initEra(s);
    return s;
  };

  E.serialize = function (s) {
    s.lastSeen = Date.now();
    return JSON.stringify(s);
  };

  E.deserialize = function (text) {
    var raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object') throw new Error('存档格式不正确');

    var s = E.newGame();
    var keys = Object.keys(raw);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] === 'workers' || keys[i] === 'toolLv' || keys[i] === 'legacyUp' || keys[i] === 'projects' || keys[i] === 'log') continue;
      if (raw[keys[i]] !== undefined) s[keys[i]] = raw[keys[i]];
    }

    s.legacyUp = Object.assign({ cash: 0, speed: 0, offline: 0, crew: 0 }, raw.legacyUp || {});
    if (!(s.era >= 0 && s.era < GD.ERAS.length)) s.era = 0;
    if (!(s.cycle >= 1)) s.cycle = 1;
    if (!(s.time >= 0)) s.time = 0;

    var era = GD.ERAS[s.era];
    s.workers = {};
    for (var w = 0; w < era.stages.length; w++) {
      var id = era.stages[w].id;
      var n = raw.workers ? raw.workers[id] : undefined;
      s.workers[id] = (typeof n === 'number' && isFinite(n) && n >= 0) ? Math.floor(n) : (1 + (s.legacyUp.crew || 0));
    }

    s.toolLv = {};
    for (var t = 0; t < era.tools.length; t++) {
      var tool = era.tools[t];
      var lv = raw.toolLv ? raw.toolLv[tool.id] : undefined;
      s.toolLv[tool.id] = (typeof lv === 'number' && isFinite(lv) && lv >= 0) ? Math.floor(lv) : 0;
    }

    s.slots = Math.max(1, Math.min(GD.MAX_SLOTS, Math.floor(s.slots) || 1));
    s.engineLv = Math.max(0, Math.floor(s.engineLv) || 0);
    s.lineLv = Math.max(0, Math.floor(raw.lineLv) || 0);
    s.baseWorkers = 1 + (s.legacyUp.crew || 0);
    for (var k in s.workers) {
      if (s.workers[k] < s.baseWorkers) s.workers[k] = s.baseWorkers;
    }

    var projs = [];
    var shippingStage = era.line ? era.stages.length : era.stages.length - 1;
    if (Array.isArray(raw.projects)) {
      for (var p = 0; p < raw.projects.length; p++) {
        var pr = raw.projects[p];
        if (!pr || typeof pr !== 'object') continue;
        if (!(pr.stage >= 0 && pr.stage <= shippingStage)) continue;
        if (!isFinite(pr.progress) || !isFinite(pr.size)) continue;
        var atEnd = pr.stage >= era.stages.length;
        projs.push({
          uid: pr.uid || (s.uid++),
          name: typeof pr.name === 'string' ? pr.name : '未命名项目',
          size: Math.max(1, Math.min(3, Math.round(pr.size))),
          stage: Math.floor(pr.stage),
          progress: atEnd ? Math.max(0, Math.min(1, pr.progress)) : Math.max(0, pr.progress),
          since: isFinite(pr.since) ? pr.since : s.time,
          shipping: atEnd || undefined
        });
      }
    }
    s.projects = projs.slice(0, s.slots);
    E.topUp(s);

    s.log = Array.isArray(raw.log) ? raw.log.slice(-40) : [];

    var nums = ['money', 'fame', 'earned', 'totalEarned', 'releases', 'totalReleases',
      'eraReleases', 'legacy', 'peakMoney', 'best'];
    for (var n2 = 0; n2 < nums.length; n2++) {
      var key = nums[n2];
      if (!isFinite(s[key]) || s[key] < 0) s[key] = 0;
    }
    if (!isFinite(s.uid) || s.uid < 1) s.uid = 1;
    return s;
  };

  /* ---------------- 离线结算 ---------------- */

  E.offlineEfficiency = function (s) {
    return 0.5 + 0.08 * (s.legacyUp.offline || 0);
  };

  E.offline = function (s, realSeconds, effOverride) {
    var capped = Math.min(Math.max(0, realSeconds), GD.OFFLINE_CAP);
    var eff = typeof effOverride === 'number' ? effOverride : E.offlineEfficiency(s);
    var simulating = capped * eff;
    var before = s.totalEarned;
    var beforeReleases = s.totalReleases || 0;
    var left = simulating;
    var guard = 0;
    while (left > 0.01 && guard++ < 100000) {
      var step = Math.min(GD.OFFLINE_STEP, left);
      E.tick(s, step);
      left -= step;
    }
    E.topUp(s);
    return {
      seconds: capped,
      simulated: simulating,
      earned: s.totalEarned - before,
      releases: (s.totalReleases || 0) - beforeReleases
    };
  };

  /* ---------------- 估算（给 UI 用） ---------------- */

  E.avgSize = function (s) {
    var era = E.era(s), sum = 0;
    for (var i = 0; i < era.sizes.length; i++) sum += era.sizes[i].size * era.sizes[i].w;
    return sum;
  };

  E.incomePerSec = function (s) {
    return E.throughput(s) * E.era(s).price * E.avgSize(s) * E.fameMult(s);
  };

  E.projectEta = function (s, p) {
    var era = E.era(s);
    var total = 0;
    for (var i = p.stage; i < era.stages.length; i++) {
      var need = era.stages[i].need * p.size - (i === p.stage ? p.progress : 0);
      var cap = E.capacity(s, era.stages[i].id);
      total += cap > 0 ? need / cap : Infinity;
    }
    return total;
  };

})(window.GD = window.GD || {});
