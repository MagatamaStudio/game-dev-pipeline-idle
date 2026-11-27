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

  E.staffById = function (s, id) {
    for (var i = 0; i < s.staff.length; i++) if (s.staff[i].id === id) return s.staff[i];
    return s.staff[0];
  };

  E.inflation = function (s) {
    return BAL.inflationBase + Math.max(0, E.year(s) - BAL.startYear) * BAL.inflationPerYear;
  };

  E.effSalary = function (s, st) { return st.salary * E.inflation(s); };

  /* 制作成本倍率：平台越大、越贵，制作费越高。移动端便宜，3A 贵。 */
  E.prodMult = function (s) {
    var p = E.platform(s);
    return Math.max(0.35, Math.min(24, (E.effInstall(s, p) * p.price) / BAL.prodValueDivisor));
  };

  E.teamSalary = function (s) {
    var sum = 0;
    for (var i = 0; i < s.staff.length; i++) sum += s.staff[i].salary * E.inflation(s);
    return sum;
  };

  E.rosterById = function (id) {
    for (var i = 0; i < GD.ROSTER.length; i++) if (GD.ROSTER[i].id === id) return GD.ROSTER[i];
    return GD.ROSTER[0];
  };

  E.platformById = function (id) {
    for (var i = 0; i < GD.PLATFORMS.length; i++) if (GD.PLATFORMS[i].id === id) return GD.PLATFORMS[i];
    return GD.PLATFORMS[0];
  };

  E.platformLabel = function (p) {
    return p.brand ? (p.brand + ' ' + p.name) : p.code;
  };

  E.year = function (s) {
    return BAL.startYear + Math.floor(s.day / BAL.daysPerYear);
  };

  /* 当前选中的平台（没选就用最新上市的可用平台） */
  E.platform = function (s) {
    var avail = E.availablePlatforms(s);
    if (!avail.length) return GD.PLATFORMS[0];
    var want = s.plan && s.plan.platform;
    for (var i = 0; i < avail.length; i++) if (avail[i].id === want) return avail[i];
    return avail[avail.length - 1];
  };

  E.availablePlatforms = function (s) {
    var year = E.year(s);
    var out = [];
    for (var i = 0; i < GD.PLATFORMS.length; i++) {
      if (GD.PLATFORMS[i].year <= year) out.push(GD.PLATFORMS[i]);
    }
    return out;
  };

  E.platformAge = function (p, year) { return year - p.year; };

  E.popMult = function (p, year) {
    var age = Math.max(0, year - p.year);
    for (var i = 0; i < GD.POP.length; i++) {
      if (age < GD.POP[i].under) return GD.POP[i].mult;
    }
    return 0.12;
  };

  /* 有效装机量：基础装机 × 人气系数 */
  E.effInstall = function (s, p) {
    return p.install * E.popMult(p, E.year(s));
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

  E.teamStat = function (s, stat) {
    var sum = 0;
    for (var i = 0; i < s.staff.length; i++) sum += s.staff[i].stats[stat];
    return sum / s.staff.length;
  };

  E.teamBonus = function (s) {
    return 1 + Math.max(0, s.staff.length - 3) * BAL.teamQualityBonus;
  };

  /* 确定性品质（不含随机与事件），用于企划预告 */
  E.baseQuality = function (s, genreId, themeId, leaderId) {
    var g = E.genre(genreId);
    var leader = E.staffById(s, leaderId);
    var w = g.weights;
    var leaderQ = 0, teamQ = 0;
    for (var k in w) {
      leaderQ += w[k] * leader.stats[k];
      teamQ += w[k] * E.teamStat(s, k);
    }
    var base = 0.75 * leaderQ + 0.25 * teamQ;
    return base * E.affinity(genreId, themeId) * 1.08 * E.teamBonus(s);
  };

  E.devDuration = function (s, leaderId) {
    var leader = E.staffById(s, leaderId);
    var d = BAL.devSeconds - leader.stats.speed * BAL.speedFactor -
      Math.max(0, s.staff.length - 3) * BAL.teamSpeedBonus;
    return Math.max(BAL.minDevSeconds, d);
  };

  /* 企划面板的预估 */
  E.preview = function (s, plan) {
    var q = E.baseQuality(s, plan.genre, plan.theme, plan.leader);
    var p = E.platform(s);
    var cap = p.cap;
    var duration = E.devDuration(s, plan.leader);
    var days = duration * BAL.daysPerSecond;
    return {
      affinity: E.affinity(plan.genre, plan.theme),
      quality: q,
      duration: duration,
      days: days,
      cost: p.license + E.teamSalary(s) * days * E.prodMult(s),
      platform: p.id,
      license: p.license,
      scoreLow: Math.max(1, Math.round(40 * q * 0.92 / cap)),
      scoreHigh: Math.min(40, Math.round(40 * q * 1.10 / cap))
    };
  };

  /* 开发中的实时品质（不含随机） */
  E.liveQuality = function (s) {
    if (!s.project) return 0;
    var avg = s.project.elapsed > 0 ? s.project.modeQSum / s.project.elapsed : 0;
    return E.baseQuality(s, s.plan.genre, s.plan.theme, s.plan.leader) *
      (1 + ((s.project.eventQualityPct || 0) + avg) / 100);
  };

  /* ---------------- 团队 ---------------- */

  E.makeStaff = function (id) {
    var r = E.rosterById(id);
    return {
      id: r.id, name: r.name, seed: r.seed, role: r.role, salary: r.salary,
      quote: r.quote, level: 1, xp: 0,
      stats: { code: r.stats.code, script: r.stats.script, art: r.stats.art, audio: r.stats.audio, speed: r.stats.speed }
    };
  };

  E.rollCandidates = function (s) {
    var taken = s.staff.map(function (x) { return x.id; });
    var pool = GD.ROSTER.filter(function (r) { return taken.indexOf(r.id) === -1; });
    var out = [];
    while (out.length < 3 && pool.length) {
      var i = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(i, 1)[0].id);
    }
    s.candidates = out;
    return out;
  };

  E.hire = function (s, id) {
    if (s.staff.length >= s.seats) return false;
    if (s.candidates.indexOf(id) === -1) return false;
    var r = E.rosterById(id);
    var fee = r.salary * BAL.hireFeeDays * E.inflation(s);
    if (s.money < fee) return false;
    s.money -= fee;
    s.staff.push(E.makeStaff(id));
    s.hiredFee = (s.hiredFee || 0) + fee;
    E.rollCandidates(s);
    return true;
  };

  E.expandOffice = function (s) {
    var idx = s.seats - 3;
    if (idx >= BAL.seatCosts.length) return false;
    var cost = BAL.seatCosts[idx] * E.inflation(s);
    if (s.money < cost) return false;
    s.money -= cost;
    s.seats++;
    return true;
  };

  E.expandCost = function (s) {
    var idx = s.seats - 3;
    return idx < BAL.seatCosts.length ? BAL.seatCosts[idx] * E.inflation(s) : null;
  };

  E.refreshCandidates = function (s) {
    var rc = BAL.refreshCost * E.inflation(s);
    if (s.money < rc) return false;
    s.money -= rc;
    E.rollCandidates(s);
    return true;
  };

  E.xpNeeded = function (level) { return 80 + level * 60; };

  E.gainXp = function (s, score) {
    var gain = BAL.xpBase + score;
    var ups = [];
    s.staff.forEach(function (st) {
      st.xp += gain;
      while (st.xp >= E.xpNeeded(st.level)) {
        st.xp -= E.xpNeeded(st.level);
        st.level++;
        st.stats[st.role] = Math.min(99, st.stats[st.role] + 2);
        var others = ['code', 'script', 'art', 'audio'].filter(function (k) { return k !== st.role; });
        others.sort(function (a, b) { return st.stats[b] - st.stats[a]; });
        st.stats[others[0]] = Math.min(99, st.stats[others[0]] + 1);
        ups.push({ id: st.id, level: st.level });
      }
    });
    return { gain: gain, ups: ups };
  };

  /* ---------------- 新游戏 ---------------- */

  E.newGame = function () {
    var s = {
      version: 1,
      round: 1,
      money: BAL.startMoney,
      fans: 0,
      day: 0,
      phase: 'planning',
      plan: { genre: 'rpg', theme: 'fantasy', leader: 'zhou', platform: 'arc72' },
      project: null,
      event: null,
      review: null,
      release: null,
      micro: null,
      microUid: 0,
      sales: null,
      lastEvent: null,
      lastResult: null,
      lastXp: null,
      history: [],
      timer: 0,
      totalEarned: 0,
      rescued: 0,
      tailMonth: 0,
      tailTotal: 0,
      awards: [],
      rivals: GD.RIVALS.map(function (d) {
        return { id: d.id, name: d.name, genre: d.genre, theme: d.theme, power: d.power, debut: d.debut, lastYear: 0, awards: 0, games: [] };
      }),
      yearRivalReleases: [],
      yearResults: [],
      yearBest: 0,
      awardYear: BAL.startYear,
      ended: false,
      staff: GD.FOUNDERS.map(function (id) { return E.makeStaff(id); }),
      seats: 3,
      candidates: []
    };
    E.rollCandidates(s);
    return s;
  };

  /* ---------------- 企划 → 开发 ---------------- */

  E.startProject = function (s, plan) {
    if (s.phase !== 'planning') return false;
    var plat = E.platformById(plan.platform || E.platform(s).id);
    if (s.money < plat.license) return false;

    s.plan = { genre: plan.genre, theme: plan.theme, leader: plan.leader, platform: plat.id };
    s.money -= plat.license;
    s.project = {
      baseDuration: E.devDuration(s, plan.leader),
      elapsed: 0,
      progress: 0,
      mode: 'normal',
      modeQSum: 0,
      eventQualityPct: 0,
      salesPct: 0,
      eventsDone: 0,
      microDone: 0,
      quality: 0,
      cost: plat.license,
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

  function pickEvent(s, when) {
    var pool = [];
    for (var i = 0; i < GD.EVENTS.length; i++) {
      if (!when || GD.EVENTS[i].when === when) pool.push(GD.EVENTS[i]);
    }
    if (!pool.length) pool = GD.EVENTS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  E.chooseEvent = function (s, index) {
    if (s.phase !== 'event' || !s.event) return false;
    var opt = s.event.options[index];
    if (!opt) return false;
    if (opt.cost > s.money) return false;

    s.money -= opt.cost;
    s.project.cost += opt.cost;
    s.project.eventQualityPct += (opt.quality || 0);
    s.project.salesPct = (s.project.salesPct || 0) + (opt.sales || 0);
    if (opt.progress) {
      s.project.progress = Math.max(0.02, Math.min(0.99, s.project.progress + opt.progress / 100));
    }
    s.lastEvent = { title: s.event.title, choice: opt.label, cost: opt.cost };
    s.event = null;
    s.phase = 'developing';
    return true;
  };

  E.microChoice = function (s, index) {
    if (!s.micro || s.phase !== 'developing') return false;
    var o = s.micro.item.options[index];
    if (!o) return false;
    var cost = o.cost || 0;
    if (cost > s.money) return false;

    s.money -= cost;
    s.project.cost += cost;
    s.project.eventQualityPct += (o.quality || 0);
    s.project.salesPct = (s.project.salesPct || 0) + (o.sales || 0);
    if (o.progress) {
      s.project.progress = Math.max(0.02, Math.min(0.99, s.project.progress + o.progress / 100));
    }
    if (o.result) s.project.log.push('· ' + o.result);
    s.micro = null;
    return true;
  };

  E.dismissMicro = function (s) {
    if (!s.micro) return false;
    s.micro = null;
    return true;
  };

  /* ---------------- 开发完成 → 评审 ---------------- */

  function rollQuality(s) {
    var avgMode = s.project.elapsed > 0 ? s.project.modeQSum / s.project.elapsed : 0;
    var q = E.baseQuality(s, s.plan.genre, s.plan.theme, s.plan.leader);
    q *= 1 + ((s.project.eventQualityPct || 0) + avgMode) / 100;
    q += Math.random() * 6 - 3;
    return Math.max(5, Math.min(100, q));
  }

  function computeReview(s) {
    var q = s.project.quality;
    var cap = E.platform(s).cap;
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

  E.weekOf = function (day) {
    return Math.floor(((day % BAL.daysPerYear) + BAL.daysPerYear) % BAL.daysPerYear / 7) + 1;
  };

  /* 同期（±2 周）发售的对手作品 */
  E.collisionsAt = function (s, day) {
    var yr = E.year(s);
    var wk = E.weekOf(day);
    var out = [];
    for (var i = 0; i < s.yearRivalReleases.length; i++) {
      var g = s.yearRivalReleases[i];
      if (g.year !== yr) continue;
      var d = Math.abs(g.week - wk);
      if (d <= 2 || d >= 50) out.push(g);
    }
    return out;
  };

  E.collisionAt = function (s, day) {
    var list = E.collisionsAt(s, day);
    if (!list.length) return { mult: 1, rival: null, list: [] };
    var best = list[0];
    for (var i = 1; i < list.length; i++) if (list[i].score > best.score) best = list[i];
    var mine = s.review ? s.review.total : 0;
    var mult = mine > best.score ? 1.08 : (mine < best.score ? 0.78 : 1);
    return { mult: mult, rival: best, list: list };
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
    var col = E.collisionAt(s, s.day);
    s.release.collision = col.rival ? col : null;
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
    var salesMult = 1 + (((s.project && s.project.salesPct) || 0) / 100);
    var mid = BAL.salesBase * E.effInstall(s, E.platform(s)) * fanF * scoreF * mult * salesMult;
    return { low: Math.round(mid * 0.85), mid: Math.round(mid), high: Math.round(mid * 1.15) };
  };

  /* ---------------- 销售 ---------------- */

  E.startSales = function (s) {
    var total = s.review.total;
    var fanF = 1 + s.fans / 25000;
    var scoreF = Math.pow(total / 40, 2.5) * 2.2;
    var rnd = 0.85 + Math.random() * 0.3;
    var windowMult = s.release ? s.release.mult : 1;
    var salesMult = 1 + ((s.project.salesPct || 0) / 100);
    var clashMult = s.release && s.release.collision ? s.release.collision.mult : 1;
    var copies = Math.round(BAL.salesBase * E.effInstall(s, E.platform(s)) * fanF * scoreF * rnd * windowMult * salesMult * clashMult);

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
    var revenue = copies * E.platform(s).price * BAL.publisherCut;

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
      var burn = E.teamSalary(s) * BAL.daysPerSecond * dt * E.prodMult(s);
      s.money -= burn;
      s.project.cost += burn;

      var LOG_AT = [0.12, 0.32, 0.55, 0.78, 0.93];
      while (s.project.logAt < LOG_AT.length && s.project.progress >= LOG_AT[s.project.logAt]) {
        var at = s.project.progress;
        var pool = at < 0.3 ? GD.DEV_LOG.proto : at < 0.7 ? GD.DEV_LOG.build : GD.DEV_LOG.polish;
        s.project.log.push(pool[Math.floor(Math.random() * pool.length)]);
        s.project.logAt++;
      }

      /* 小决定：可选、不打断、过期作废 */
      if (!s.micro && s.project.microDone < BAL.microAt.length &&
        s.project.progress >= BAL.microAt[s.project.microDone]) {
        s.project.microDone++;
        s.micro = {
          uid: ++s.microUid,
          item: GD.MICRO[Math.floor(Math.random() * GD.MICRO.length)],
          ttl: BAL.microTtl
        };
        out.push({ type: 'micro' });
      }
      if (s.micro) {
        s.micro.ttl -= dt;
        if (s.micro.ttl <= 0) s.micro = null;
      }

      if (s.project.progress >= 1) {
        s.project.progress = 1;
        E.finishDev(s);
        out.push({ type: 'devDone' });
      } else if (s.project.eventsDone < BAL.eventAts.length &&
        s.project.progress >= BAL.eventAts[s.project.eventsDone]) {
        var when = s.project.eventsDone === 0 ? 'early' : 'late';
        s.micro = null;
        s.event = pickEvent(s, when);
        s.project.eventsDone++;
        s.phase = 'event';
        out.push({ type: 'event', index: s.project.eventsDone });
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
          date: E.dateString(s.day),
          window: s.release ? s.release.name : '普通档期',
          windowMult: s.release ? s.release.mult : 1
        };
        s.history.push(s.lastResult);
        if (s.review.total > (s.yearBest || 0)) {
          s.yearBest = s.review.total;
          s.yearBestTitle = E.gameName(s);
        }
        s.lastXp = E.gainXp(s, s.review.total);
        E.rollCandidates(s);
        s.phase = 'done';
        out.push({ type: 'done' });
      }
    }

    E.settleMonths(s);
    E.tickRivals(s);
    var got = E.settleAwards(s);
    for (var ai = 0; ai < got.length; ai++) out.push({ type: 'award', award: got[ai] });
    if (s.phase === 'planning' && !s.ended && E.year(s) >= BAL.endYear) {
      s.phase = 'ending';
      out.push({ type: 'ending' });
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
    s.micro = null;
    s.sales = null;
    s.event = null;
    s.timer = 0;
    s.lastEvent = null;
    return true;
  };

  E.continueEndless = function (s) {
    if (s.phase !== 'ending') return false;
    s.ended = true;
    s.phase = 'planning';
    return true;
  };

  E.needRescue = function (s) {
    return s.phase === 'planning' && s.money < 20000;
  };

  E.rescue = function (s) {
    if (!E.needRescue(s)) return false;
    s.money += BAL.rescue * E.inflation(s);
    s.rescued++;
    return true;
  };

  /* ---------------- 竞争对手 ---------------- */

  E.rivalDef = function (id) {
    for (var i = 0; i < GD.RIVALS.length; i++) if (GD.RIVALS[i].id === id) return GD.RIVALS[i];
    return GD.RIVALS[0];
  };

  E.tickRivals = function (s) {
    var yr = E.year(s);
    for (var i = 0; i < s.rivals.length; i++) {
      var r = s.rivals[i];
      if (yr < r.debut || r.lastYear >= yr) continue;
      r.lastYear = yr;
      if (Math.random() < 0.12) continue;

      var score = Math.round(28 + (yr - r.debut) * 0.25 + r.power * 2.5 + (Math.random() * 6 - 3));
      score = Math.max(14, Math.min(40, score));

      var def = E.rivalDef(r.id);
      var title = def.titles[r.games.length % def.titles.length];
      var game = { year: yr, week: 1 + Math.floor(Math.random() * 52), title: title, score: score, rival: r.id, name: r.name };
      r.games.push(game);
      s.yearRivalReleases.push(game);
      if (s.yearRivalReleases.length > 200) s.yearRivalReleases.shift();
    }
  };

  /* ---------------- 年度奖项 ---------------- */

  E.settleAwards = function (s) {
    var yr = E.year(s);
    var last = s.awardYear || BAL.startYear;
    var got = [];
    var guard = 0;

    while (last < yr && guard++ < 50) {
      var mine = s.yearBest || 0;

      var theirs = [];
      for (var i = 0; i < s.yearRivalReleases.length; i++) {
        if (s.yearRivalReleases[i].year === last) theirs.push(s.yearRivalReleases[i]);
      }
      theirs.sort(function (a, b) { return b.score - a.score; });
      var top = theirs[0] || null;

      var topScore = top ? top.score : 0;
      var best = Math.max(mine, topScore);
      var playerWins = mine > 0 && mine >= best && mine >= 26;
      var award = null;

      if (playerWins) {
        award = {
          year: last, title: '年度游戏', score: mine,
          money: 60000 + (last - BAL.startYear) * 30000,
          fans: 3000 + (last - BAL.startYear) * 600
        };
      } else if (mine >= 24 && mine >= best - 2) {
        award = {
          year: last, title: '年度提名', score: mine,
          money: 20000 + (last - BAL.startYear) * 10000,
          fans: 800 + (last - BAL.startYear) * 200
        };
      }

      if (award) {
        s.money += award.money;
        s.fans += award.fans;
        s.awards.push(award);
        got.push(award);
      }

      s.yearResults.push({
        year: last,
        winner: playerWins ? null : (top ? top.name : null),
        winnerTitle: playerWins ? null : (top ? top.title : null),
        winnerScore: playerWins ? mine : (top ? top.score : 0),
        playerScore: mine,
        playerAward: award ? award.title : null
      });
      if (s.yearResults.length > 100) s.yearResults.shift();

      s.yearBest = 0;
      last++;
    }

    s.awardYear = yr;
    s.yearRivalReleases = s.yearRivalReleases.filter(function (g) { return g.year >= yr - 1; });
    return got;
  };

  /* ---------------- 结局 ---------------- */

  E.ending = function (s) {
    var awards = s.awards.length;
    var best = 0;
    for (var i = 0; i < s.history.length; i++) if (s.history[i].total > best) best = s.history[i].total;
    var title, tone;
    if (awards >= 3) { title = '时代定义者'; tone = '你定的规则，别人在遵守。'; }
    else if (awards >= 1) { title = '一流工作室'; tone = '你活下来了，而且活得不错。'; }
    else if (s.history.length <= 25 && best >= 30) { title = '小而美'; tone = '人不多，但每一部都拿得出手。'; }
    else { title = '勉强维生'; tone = '还在，还没倒。'; }
    return {
      title: title,
      tone: tone,
      years: BAL.endYear - BAL.startYear,
      releases: s.history.length,
      best: best,
      awards: awards,
      fans: Math.round(s.fans),
      earned: Math.round(s.totalEarned)
    };
  };

  /* ---------------- 长尾 ---------------- */

  E.monthIncome = function (s) {
    var sum = 0;
    for (var i = 0; i < s.history.length; i++) sum += (s.history[i].revenue || 0) * BAL.tailPerMonth;
    return sum;
  };

  E.settleMonths = function (s) {
    var month = Math.floor(s.day / 30);
    var last = s.tailMonth || 0;
    if (month <= last) return 0;
    var per = E.monthIncome(s);
    s.tailMonth = month;
    var gained = per * (month - last);
    s.money += gained;
    s.totalEarned += gained;
    s.tailTotal = (s.tailTotal || 0) + gained;
    return gained;
  };

  /* ---------------- 离线 ---------------- */

  E.offline = function (s, realSeconds) {
    var elapsed = Math.max(0, Math.min(realSeconds, BAL.offlineCapHours * 3600));
    var budgetDays = Math.min((elapsed / 3600) * BAL.offlineDaysPerHour, BAL.offlineMaxDays);

    var startDay = s.day;
    var startMoney = s.money;
    var tailStart = s.tailTotal || 0;
    var copies = 0, revenue = 0, weeks = 0;

    /* 在售作品继续卖完——这一段没有任何决策，可以全自动 */
    if (s.phase === 'sales' && s.sales) {
      var guard = 0;
      while (s.phase === 'sales' && guard++ < 20000) {
        var soldBefore = s.sales.sold;
        var revBefore = s.sales.revenue;
        E.tick(s, 0.5);
        if (s.sales) {
          copies += s.sales.sold - soldBefore;
          revenue += s.sales.revenue - revBefore;
          weeks = s.sales.index;
        }
      }
    }

    /* 日历推进 */
    var target = startDay + budgetDays;
    if (s.day < target) s.day = target;
    E.settleMonths(s);

    return {
      seconds: elapsed,
      days: Math.round(s.day - startDay),
      copies: copies,
      revenue: revenue,
      weeks: weeks,
      tail: (s.tailTotal || 0) - tailStart,
      total: s.money - startMoney
    };
  };

  /* ---------------- 存档 ---------------- */

  E.SAVE_VERSION = 2;
  E.SAVE_KEY = 'garageStudio.save.v2';

  E.serialize = function (s) {
    s.version = E.SAVE_VERSION;
    s.savedAt = Date.now();
    return JSON.stringify(s);
  };

  function clampNum(v, lo, hi, fallback) {
    if (!isFinite(v)) return fallback;
    return Math.max(lo, Math.min(hi, v));
  }

  E.deserialize = function (text) {
    var raw = JSON.parse(text);
    if (!raw || raw.version !== E.SAVE_VERSION) throw new Error('存档版本不兼容');

    var s = E.newGame();
    Object.keys(raw).forEach(function (k) {
      if (k === 'staff' || k === 'candidates' || k === 'version') return;
      s[k] = raw[k];
    });

    /* 员工 */
    var staff = [];
    if (Array.isArray(raw.staff)) {
      raw.staff.forEach(function (x) {
        if (!x || !x.id) return;
        var known = GD.ROSTER.some(function (r) { return r.id === x.id; });
        if (!known) return;
        if (staff.some(function (y) { return y.id === x.id; })) return;
        var m = E.makeStaff(x.id);
        m.level = Math.round(clampNum(x.level, 1, 20, 1));
        m.xp = clampNum(x.xp, 0, 999999, 0);
        ['code', 'script', 'art', 'audio', 'speed'].forEach(function (k) {
          if (x.stats && isFinite(x.stats[k])) {
            m.stats[k] = Math.round(clampNum(x.stats[k], 1, 99, m.stats[k]));
          }
        });
        staff.push(m);
      });
    }
    if (!staff.length) staff = GD.FOUNDERS.map(function (id) { return E.makeStaff(id); });
    s.staff = staff;

    s.seats = Math.round(clampNum(raw.seats, 3, 6, 3));
    if (s.seats < s.staff.length) s.seats = s.staff.length;

    /* 候选人 */
    var taken = s.staff.map(function (x) { return x.id; });
    s.candidates = Array.isArray(raw.candidates) ? raw.candidates.filter(function (id) {
      return taken.indexOf(id) === -1 && GD.ROSTER.some(function (r) { return r.id === id; });
    }) : [];
    if (s.candidates.length < 3) E.rollCandidates(s);

    /* 企划 */
    if (!s.plan || typeof s.plan !== 'object') s.plan = { genre: 'rpg', theme: 'fantasy', leader: s.staff[0].id };
    if (!s.staff.some(function (x) { return x.id === s.plan.leader; })) s.plan.leader = s.staff[0].id;
    if (!GD.GENRES.some(function (g) { return g.id === s.plan.genre; })) s.plan.genre = 'rpg';
    if (!GD.THEMES.some(function (t) { return t.id === s.plan.theme; })) s.plan.theme = 'fantasy';
    if (!s.plan.platform || !GD.PLATFORMS.some(function (p) { return p.id === s.plan.platform; })) s.plan.platform = 'arc72';

    /* 数字与状态 */
    var phases = ['planning', 'developing', 'event', 'review', 'release', 'sales', 'done'];
    if (phases.indexOf(s.phase) === -1) s.phase = 'planning';
    if (s.phase !== 'planning' && s.phase !== 'done' && !s.project) s.phase = 'planning';

    s.money = clampNum(s.money, -1e9, 1e12, BAL.startMoney);
    s.fans = clampNum(s.fans, 0, 1e12, 0);
    s.day = clampNum(s.day, 0, 1e7, 0);
    s.round = Math.round(clampNum(s.round, 1, 1e6, 1));
    s.timer = clampNum(s.timer, 0, 1e6, 0);
    s.microUid = Math.round(clampNum(s.microUid, 0, 1e9, 0));
    if (!Array.isArray(s.history)) s.history = [];
    if (!Array.isArray(s.rivals) || !s.rivals.length) {
      s.rivals = GD.RIVALS.map(function (d) {
        return { id: d.id, name: d.name, genre: d.genre, theme: d.theme, power: d.power, debut: d.debut, lastYear: 0, awards: 0, games: [] };
      });
    }
    if (!Array.isArray(s.yearRivalReleases)) s.yearRivalReleases = [];
    if (!Array.isArray(s.yearResults)) s.yearResults = [];
    if (s.phase === 'done' && !s.lastResult) s.phase = 'planning';

    return s;
  };

})(window.GD = window.GD || {});
