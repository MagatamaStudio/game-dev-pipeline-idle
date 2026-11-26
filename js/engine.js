/* ============================================================
 * engine.js —— M0 纯逻辑（不碰 DOM，可在 Node 里跑）
 * 状态机：planning → developing → event → review → sales → done
 * ============================================================ */
(function (GD) {
  'use strict';

  var E = {};
  GD.Engine = E;
  var BAL = GD.BAL;

  /* ---------------- 查询 ---------------- */

  E.staff = function (id) {
    for (var i = 0; i < GD.STAFF.length; i++) if (GD.STAFF[i].id === id) return GD.STAFF[i];
    return GD.STAFF[0];
  };

  E.genre = function (id) {
    for (var i = 0; i < GD.GENRES.length; i++) if (GD.GENRES[i].id === id) return GD.GENRES[i];
    return GD.GENRES[0];
  };

  E.theme = function (id) {
    for (var i = 0; i < GD.THEMES.length; i++) if (GD.THEMES[i].id === id) return GD.THEMES[i];
    return GD.THEMES[0];
  };

  E.affinity = function (genreId, themeId) {
    var row = GD.COMBO[genreId];
    return (row && row[themeId]) || 1;
  };

  E.teamStat = function (stat) {
    var sum = 0;
    for (var i = 0; i < GD.STAFF.length; i++) sum += GD.STAFF[i].stats[stat];
    return sum / GD.STAFF.length;
  };

  /* 确定性品质（不含随机与事件），用于企划预告 */
  E.baseQuality = function (genreId, themeId, leaderId) {
    var g = E.genre(genreId);
    var leader = E.staff(leaderId);
    var w = g.weights;
    var leaderQ = 0, teamQ = 0;
    for (var k in w) {
      leaderQ += w[k] * leader.stats[k];
      teamQ += w[k] * E.teamStat(k);
    }
    var base = 0.75 * leaderQ + 0.25 * teamQ;
    return base * E.affinity(genreId, themeId) * 1.08;
  };

  E.devDuration = function (leaderId) {
    var leader = E.staff(leaderId);
    return BAL.devSeconds - leader.stats.speed * BAL.speedFactor;
  };

  /* 企划面板的预估 */
  E.preview = function (plan) {
    var q = E.baseQuality(plan.genre, plan.theme, plan.leader);
    var cap = GD.PLATFORM.cap;
    var duration = E.devDuration(plan.leader);
    var days = duration * BAL.daysPerSecond;
    return {
      affinity: E.affinity(plan.genre, plan.theme),
      quality: q,
      duration: duration,
      days: days,
      cost: BAL.license + BAL.salaryPerDay * days,
      scoreLow: Math.max(1, Math.round(40 * q * 0.92 / cap)),
      scoreHigh: Math.min(40, Math.round(40 * q * 1.10 / cap))
    };
  };

  /* 开发中的实时品质（不含随机） */
  E.liveQuality = function (s) {
    if (!s.project) return 0;
    var avg = s.project.elapsed > 0 ? s.project.modeQSum / s.project.elapsed : 0;
    return E.baseQuality(s.plan.genre, s.plan.theme, s.plan.leader) *
      (1 + ((s.project.eventQualityPct || 0) + avg) / 100);
  };

  /* ---------------- 新游戏 ---------------- */

  E.newGame = function () {
    return {
      round: 1,
      money: BAL.startMoney,
      fans: 0,
      day: 0,
      phase: 'planning',
      plan: { genre: 'rpg', theme: 'fantasy', leader: 'zhou' },
      project: null,
      event: null,
      review: null,
      release: null,
      sales: null,
      lastEvent: null,
      lastResult: null,
      history: [],
      timer: 0,
      totalEarned: 0,
      rescued: 0
    };
  };

  /* ---------------- 企划 → 开发 ---------------- */

  E.startProject = function (s, plan) {
    if (s.phase !== 'planning') return false;
    if (s.money < BAL.license) return false;

    s.plan = { genre: plan.genre, theme: plan.theme, leader: plan.leader };
    s.money -= BAL.license;
    s.project = {
      baseDuration: E.devDuration(plan.leader),
      elapsed: 0,
      progress: 0,
      mode: 'normal',
      modeQSum: 0,
      eventQualityPct: 0,
      eventFired: false,
      quality: 0,
      cost: BAL.license,
      log: [],
      logAt: 0
    };
    s.event = null;
    s.review = null;
    s.sales = null;
    s.timer = 0;
    s.phase = 'developing';
    return true;
  };

  E.setMode = function (s, mode) {
    if (s.phase !== 'developing' || !s.project) return false;
    if (!BAL.modes[mode]) return false;
    s.project.mode = mode;
    return true;
  };

  E.devPhase = function (s) {
    if (!s.project) return '';
    var p = s.project.progress;
    var name = GD.PHASES[0].name;
    for (var i = 0; i < GD.PHASES.length; i++) if (p >= GD.PHASES[i].at) name = GD.PHASES[i].name;
    return name;
  };

  function pickEvent(s) {
    var pool = GD.EVENTS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  E.chooseEvent = function (s, index) {
    if (s.phase !== 'event' || !s.event) return false;
    var opt = s.event.options[index];
    if (!opt) return false;
    if (opt.cost > s.money) return false;

    s.money -= opt.cost;
    s.project.cost += opt.cost;
    s.project.eventQualityPct += opt.quality;
    if (opt.progress < 0) {
      s.project.elapsed = Math.max(0.5, s.project.elapsed * (1 + opt.progress / 100));
    }
    s.lastEvent = { title: s.event.title, choice: opt.label, cost: opt.cost };
    s.event = null;
    s.phase = 'developing';
    return true;
  };

  /* ---------------- 开发完成 → 评审 ---------------- */

  function rollQuality(s) {
    var avgMode = s.project.elapsed > 0 ? s.project.modeQSum / s.project.elapsed : 0;
    var q = E.baseQuality(s.plan.genre, s.plan.theme, s.plan.leader);
    q *= 1 + ((s.project.eventQualityPct || 0) + avgMode) / 100;
    q += Math.random() * 6 - 3;
    return Math.max(5, Math.min(100, q));
  }

  function computeReview(s) {
    var q = s.project.quality;
    var cap = GD.PLATFORM.cap;
    var scores = [];
    for (var i = 0; i < GD.CRITICS.length; i++) {
      var c = GD.CRITICS[i];
      var v = 10 * q / cap * 0.85;
      if (c.fav === s.plan.genre) v += c.bias;
      if (c.hate === s.plan.genre) v -= 1.0;
      v += Math.random() * 2 - 1;
      scores.push(Math.max(1, Math.min(10, Math.round(v))));
    }
    var total = 0;
    for (var j = 0; j < scores.length; j++) total += scores[j];
    return { scores: scores, total: total, revealed: 0, totalShown: false };
  }

  E.finishDev = function (s) {
    s.project.quality = rollQuality(s);
    s.review = computeReview(s);
    s.phase = 'review';
    s.timer = 0;
  };

  /* ---------------- 档期 ---------------- */

  E.dayOfYear = function (day) { return ((day % BAL.daysPerYear) + BAL.daysPerYear) % BAL.daysPerYear; };

  E.dateString = function (day) {
    day = Math.floor(day);
    var year = BAL.startYear + Math.floor(day / BAL.daysPerYear);
    var doy = E.dayOfYear(day);
    var month = Math.floor(doy / 30) + 1;
    var date = (doy % 30) + 1;
    return year + ' 年 ' + month + ' 月 ' + date + ' 日';
  };

  E.windowAt = function (day) {
    var doy = E.dayOfYear(day);
    for (var i = 0; i < GD.WINDOWS.length; i++) {
      var w = GD.WINDOWS[i];
      if (doy >= w.start && doy <= w.end) return w;
    }
    return null;
  };

  /* 下一个档期（如果正在档期内，返回再下一个） */
  E.nextWindow = function (day) {
    var doy = E.dayOfYear(day);
    var inside = !!E.windowAt(day);
    var best = null;
    for (var i = 0; i < GD.WINDOWS.length; i++) {
      var w = GD.WINDOWS[i];
      var d = w.start - doy;
      if (d < 0) d += BAL.daysPerYear;
      if (inside && d === 0) d = BAL.daysPerYear;
      if (!best || d < best.days) best = { win: w, days: d };
    }
    return best;
  };

  E.releaseOptions = function (s) {
    var nowW = E.windowAt(s.day);
    var nx = E.nextWindow(s.day);
    return {
      day: s.day,
      date: E.dateString(s.day),
      now: {
        mult: nowW ? nowW.mult : 1,
        name: nowW ? nowW.name : '普通档期',
        inWindow: !!nowW
      },
      hold: {
        mult: nx.win.mult,
        name: nx.win.name,
        days: nx.days,
        cost: Math.round(nx.days * BAL.storagePerDay)
      }
    };
  };

  E.confirmRelease = function (s, which) {
    if (s.phase !== 'release') return false;
    var opts = E.releaseOptions(s);
    if (which === 'hold') {
      if (s.money < opts.hold.cost) return false;
      s.money -= opts.hold.cost;
      s.day += opts.hold.days;
      s.release = { mult: opts.hold.mult, name: opts.hold.name, days: opts.hold.days, cost: opts.hold.cost };
    } else {
      s.release = { mult: opts.now.mult, name: opts.now.name, days: 0, cost: 0 };
    }
    E.startSales(s);
    return true;
  };

  /* 开发中预测发售日 */
  E.projectedReleaseDay = function (s) {
    if (!s.project) return s.day;
    var mode = BAL.modes[s.project.mode] || BAL.modes.normal;
    var remain = (1 - s.project.progress) * s.project.baseDuration * BAL.daysPerSecond / mode.rate;
    return s.day + remain;
  };

  /* 销量预估（给发售决策用） */
  E.estimateSales = function (s, mult) {
    var total = s.review.total;
    var fanF = 1 + s.fans / 25000;
    var scoreF = Math.pow(total / 40, 2.5) * 2.2;
    var mid = BAL.salesBase * GD.PLATFORM.install * fanF * scoreF * mult;
    return { low: Math.round(mid * 0.85), mid: Math.round(mid), high: Math.round(mid * 1.15) };
  };

  /* ---------------- 销售 ---------------- */

  E.startSales = function (s) {
    var total = s.review.total;
    var fanF = 1 + s.fans / 25000;
    var scoreF = Math.pow(total / 40, 2.5) * 2.2;
    var rnd = 0.85 + Math.random() * 0.3;
    var windowMult = s.release ? s.release.mult : 1;
    var copies = Math.round(BAL.salesBase * GD.PLATFORM.install * fanF * scoreF * rnd * windowMult);

    s.sales = {
      total: Math.max(300, copies),
      sold: 0,
      revenue: 0,
      index: 0,
      adUsed: 0,
      boost: 1,
      weeks: []
    };
    s.phase = 'sales';
    s.timer = 0;
  };

  E.settleWeek = function (s) {
    if (!s.sales || s.sales.index >= BAL.salesWeeks) return null;
    var i = s.sales.index;
    var frac = GD.SALES_CURVE[i] || 0.011;
    var copies = Math.round(s.sales.total * frac * s.sales.boost);
    var revenue = copies * GD.PLATFORM.price;

    s.money += revenue;
    s.totalEarned += revenue;
    s.fans += copies * BAL.fanPerCopy;
    s.sales.sold += copies;
    s.sales.revenue += revenue;
    s.sales.index++;
    s.sales.boost = 1;
    s.day += 7;
    s.sales.weeks.push({ week: i + 1, copies: copies, revenue: revenue });

    return { week: i + 1, copies: copies, revenue: revenue };
  };

  E.canBuyAd = function (s) {
    return !!(s.sales && s.phase === 'sales' && s.sales.adUsed < 1 &&
      s.sales.index < 6 && s.money >= BAL.adCost);
  };

  E.buyAd = function (s) {
    if (!E.canBuyAd(s)) return false;
    s.money -= BAL.adCost;
    s.sales.adUsed++;
    s.sales.boost = BAL.adBoost;
    return true;
  };

  /* ---------------- 主循环 ---------------- */

  E.tick = function (s, dt) {
    var out = [];
    if (!(dt > 0)) return out;

    if (s.phase === 'developing') {
      var mode = BAL.modes[s.project.mode] || BAL.modes.normal;

      s.project.elapsed += dt;
      s.project.modeQSum += mode.quality * dt;
      s.project.progress += (dt * mode.rate) / s.project.baseDuration;
      s.day += dt * BAL.daysPerSecond;

      /* 每过一天，工资就烧一天——这是「时间有代价」的来源 */
      var burn = BAL.salaryPerDay * BAL.daysPerSecond * dt;
      s.money -= burn;
      s.project.cost += burn;

      var LOG_AT = [0.12, 0.32, 0.55, 0.78, 0.93];
      while (s.project.logAt < LOG_AT.length && s.project.progress >= LOG_AT[s.project.logAt]) {
        var at = s.project.progress;
        var pool = at < 0.3 ? GD.DEV_LOG.proto : at < 0.7 ? GD.DEV_LOG.build : GD.DEV_LOG.polish;
        s.project.log.push(pool[Math.floor(Math.random() * pool.length)]);
        s.project.logAt++;
      }

      if (s.project.progress >= 1) {
        s.project.progress = 1;
        E.finishDev(s);
        out.push({ type: 'devDone' });
      } else if (!s.project.eventFired && s.project.progress >= BAL.eventAt) {
        s.project.eventFired = true;
        s.event = pickEvent(s);
        s.phase = 'event';
        out.push({ type: 'event' });
      }
    }

    else if (s.phase === 'review') {
      s.timer += dt;
      var reveal = Math.min(4, Math.floor(s.timer / BAL.reviewPerCritic) + 1);
      if (reveal !== s.review.revealed) {
        s.review.revealed = reveal;
        out.push({ type: 'reveal', index: reveal - 1 });
      }
      var totalAt = 4 * BAL.reviewPerCritic + 0.6;
      if (!s.review.totalShown && s.timer >= totalAt) {
        s.review.totalShown = true;
        out.push({ type: 'total', total: s.review.total });
      }
      if (s.timer >= totalAt + BAL.reviewTail) {
        s.phase = 'release';
        out.push({ type: 'releaseReady' });
      }
    }

    else if (s.phase === 'sales') {
      s.timer += dt;
      var target = Math.floor(s.timer / BAL.salesWeekSeconds);
      var guard = 0;
      while (s.sales.index < target && s.sales.index < BAL.salesWeeks && guard++ < 20) {
        var w = E.settleWeek(s);
        if (w) out.push({ type: 'week', data: w });
      }
      if (s.sales.index >= BAL.salesWeeks) {
        s.lastResult = {
          name: E.gameName(s),
          genre: s.plan.genre,
          theme: s.plan.theme,
          quality: s.project.quality,
          total: s.review.total,
          copies: s.sales.sold,
          revenue: s.sales.revenue,
          cost: s.project.cost,
          profit: s.sales.revenue - s.project.cost,
          window: s.release ? s.release.name : '普通档期',
          windowMult: s.release ? s.release.mult : 1
        };
        s.history.push(s.lastResult);
        s.phase = 'done';
        out.push({ type: 'done' });
      }
    }

    return out;
  };

  /* ---------------- 收尾 ---------------- */

  E.gameName = function (s) {
    var g = E.genre(s.plan.genre), t = E.theme(s.plan.theme);
    return g.name + '·' + t.name;
  };

  E.nextRound = function (s) {
    if (s.phase !== 'done') return false;
    s.round++;
    s.phase = 'planning';
    s.project = null;
    s.review = null;
    s.release = null;
    s.sales = null;
    s.event = null;
    s.timer = 0;
    s.lastEvent = null;
    return true;
  };

  E.needRescue = function (s) {
    return s.phase === 'planning' && s.money < BAL.license;
  };

  E.rescue = function (s) {
    if (!E.needRescue(s)) return false;
    s.money += BAL.rescue;
    s.rescued++;
    return true;
  };

})(window.GD = window.GD || {});
