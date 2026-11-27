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

  /* 制作成本倍率：平台越大、越贵，制作费越高。移动端便宜，3A 贵。
   * 指数 1.3 让「大平台」的成本涨得比收入快，否则后期利润会失控。 */
  E.prodMultFor = function (s, p) {
    var raw = (E.effInstall(s, p) * p.price) / BAL.prodValueDivisor;
    /* 小平台线性、大平台额外加价：早期别把车库压死，后期又能吃掉暴利 */
    var cost = raw * (1 + Math.max(0, raw - 2.5) * 0.72);
    return Math.max(0.35, Math.min(320, cost));
  };

  E.prodMult = function (s) {
    return E.prodMultFor(s, E.platform(s));
  };

  E.teamSalary = function (s) {
    var sum = 0;
    for (var i = 0; i < s.staff.length; i++) {
      sum += s.staff[i].salary * E.inflation(s) * (1 + E.traitSum(s.staff[i], 'salaryPct'));
    }
    return sum * E.bonusMul(s, 'salary') * E.ruleMul(s, 'salary');
  };

  /* ---------------- 员工特质 ----------------
   * 每人固定 2 个特质，由 seed 派生 —— 不写进存档，老档也能直接获得。
   * 全队类效果取平均而不是求和，否则人越多叠得越狠会爆表。 */

  function traitHash(st) {
    var seed = (st && st.seed != null) ? String(st.seed) : String((st && st.id) || '');
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  E.traitList = function (st) {
    var n = (GD.TRAITS && GD.TRAITS.length) || 0;
    if (!st || n < 2) return [];
    var h = traitHash(st);
    var a = h % n;
    var b = (h >>> 7) % (n - 1);
    if (b >= a) b += 1;
    return [GD.TRAITS[a], GD.TRAITS[b]];
  };

  E.traitSum = function (st, key) {
    var list = E.traitList(st), sum = 0;
    for (var i = 0; i < list.length; i++) sum += (list[i].eff[key] || 0);
    return sum;
  };

  E.teamTrait = function (s, key) {
    if (!s.staff || !s.staff.length) return 0;
    var sum = 0;
    for (var i = 0; i < s.staff.length; i++) sum += E.traitSum(s.staff[i], key);
    return sum / s.staff.length;
  };

  function traitClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  E.traitSpeedMul = function (s) { return 1 - traitClamp(E.teamTrait(s, 'speedPct'), -0.25, 0.30); };
  E.traitQualityMul = function (s) { return 1 + traitClamp(E.teamTrait(s, 'qualityPct'), -0.25, 0.30); };
  E.traitFansMul = function (s) { return 1 + traitClamp(E.teamTrait(s, 'fansPct'), -0.40, 0.40); };

  E.rosterById = function (id) {
    for (var i = 0; i < GD.ROSTER.length; i++) if (GD.ROSTER[i].id === id) return GD.ROSTER[i];
    return GD.ROSTER[0];
  };

  E.platformById = function (id, s) {
    var list = s ? E.allPlatforms(s) : GD.PLATFORMS;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || GD.PLATFORMS[0];
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
    var all = E.allPlatforms(s);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].year <= year) out.push(all[i]);
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
    return base * E.affinity(genreId, themeId) * 1.08 * E.teamBonus(s) * E.traitQualityMul(s) * E.bonusMul(s, 'quality') * E.ruleMul(s, 'quality');
  };

  E.devDuration = function (s, leaderId) {
    var leader = E.staffById(s, leaderId);
    var d = BAL.devSeconds - leader.stats.speed * BAL.speedFactor -
      Math.max(0, s.staff.length - 3) * BAL.teamSpeedBonus;
    return Math.max(BAL.minDevSeconds, d * E.traitSpeedMul(s) * E.bonusMul(s, 'speed') * E.ruleMul(s, 'speed'));
  };

  /* 企划面板的预估 */
  E.preview = function (s, plan) {
    var q = E.baseQuality(s, plan.genre, plan.theme, plan.leader);
    /* 必须用 plan 里指定的平台 —— 以前这里读的是 s.plan，导致「换平台预览」永远是旧平台的数据 */
    var p = E.platformById(plan.platform || (s.plan && s.plan.platform) || E.platform(s).id, s);
    var cap = p.cap;
    var duration = E.devDuration(s, plan.leader);
    var days = duration * BAL.daysPerSecond;
    return {
      affinity: E.affinity(plan.genre, plan.theme),
      quality: q,
      duration: duration,
      days: days,
      cost: p.license * E.bonusMul(s, 'license') + E.teamSalary(s) * days * E.prodMultFor(s, p),
      platform: p.id,
      license: p.license,
      scoreLow: Math.max(1, Math.min(40, Math.round(40 * Math.pow(Math.max(0.01, q / cap), 0.45) * 0.85 * 0.92))),
      scoreHigh: Math.max(1, Math.min(40, Math.round(40 * Math.pow(Math.max(0.01, q / cap), 0.45) * 0.85 * 1.10) + 3))
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

  /* ---------------- 声望 ----------------
   * 0~100。拿奖加（年度游戏 +10 / 提名 +5），影响签约金、评审分、结局判定。 */
  E.REP_MAX = 100;

  E.addRep = function (s, n) {
    s.rep = Math.max(0, Math.min(E.REP_MAX, (s.rep || 0) + n));
    return s.rep;
  };

  /* 办公室等级：目前用工位数当等级（3~6 级） */
  E.officeLevel = function (s) { return s.seats || 3; };

  /* 拿过几次年度游戏（提名不算） */
  E.awardWins = function (s) {
    var n = 0;
    (s.yearResults || []).forEach(function (y) { if (!y.winner) n++; });
    return n;
  };

  /* 签约金：声望越高越便宜，最多打六折 */
  E.hireFee = function (s, r) {
    var disc = Math.max(0.6, 1 - (s.rep || 0) / 250);
    return Math.round(r.salary * BAL.hireFeeDays * E.inflation(s) * disc);
  };

  E.hire = function (s, id) {
    if (s.staff.length >= s.seats) return false;
    if (s.candidates.indexOf(id) === -1) return false;
    var r = E.rosterById(id);
    var fee = E.hireFee(s, r);
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
      st.xp += gain * (1 + E.traitSum(st, 'xpPct')) * E.bonusMul(s, 'xp');
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
      rep: 0,
      day: 0,
      phase: 'planning',
      plan: { genre: 'rpg', theme: 'fantasy', leader: 'zhou', platform: 'arc72', name: '' },
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
        return { id: d.id, name: d.name, genre: d.genre, theme: d.theme, power: d.power, debut: d.debut, lastYear: 0, awards: 0, games: [], poached: [] };
      }),
      yearRivalReleases: [],
      yearResults: [],
      yearBest: 0,
      awardYear: BAL.startYear,
      ended: false,
      staff: GD.FOUNDERS.map(function (id) { return E.makeStaff(id); }),
      seats: 3,
      declaration: null,
      research: { done: [], active: null },
      furniture: [],
      brands: [],
      myPlatform: null,
      rulesPaid: [],
      candidates: []
    };
    E.rollCandidates(s);
    return s;
  };

  /* ---------------- 创业宣言 ----------------
   * 只有全新的一局、还没做完第一部时才需要选；老存档直接跳过。 */

  E.needDeclaration = function (s) {
    if (!s || s.declaration) return false;
    if (s.phase !== 'planning') return false;
    if (s.round !== 1) return false;
    return !(s.history && s.history.length);
  };

  E.chooseDeclaration = function (s, id) {
    if (!E.needDeclaration(s)) return false;
    var pick = null;
    for (var i = 0; i < GD.DECLARATIONS.length; i++) {
      if (GD.DECLARATIONS[i].id === id) pick = GD.DECLARATIONS[i];
    }
    if (!pick) return false;
    s.declaration = pick.id;

    if (pick.id === 'garage') {
      s.money += 150000;
    } else if (pick.id === 'network') {
      s.fans += 300;
    } else if (pick.id === 'tech') {
      s.staff.forEach(function (st) {
        st.stats[st.role] = Math.min(99, st.stats[st.role] + 6);
      });
    } else if (pick.id === 'thrift') {
      s.seats = Math.min(4, s.seats + 1);
    }
    return true;
  };

  /* ---------------- 世代规则 ----------------
   * 无尽时代每进入一个新世代就换一条规则，效果全部挂在已有的乘数出口上。 */

  E.ruleFor = function (year) {
    var hit = null;
    for (var i = 0; i < GD.RULES.length; i++) if (year >= GD.RULES[i].from) hit = GD.RULES[i];
    return hit;
  };

  E.rulePaid = function (s, from) {
    return Array.isArray(s.rulesPaid) && s.rulesPaid.indexOf(from) >= 0;
  };

  /* 当前真正生效的规则：带一次性投入的，没付钱就先不生效 */
  E.ruleOf = function (s) {
    var r = E.ruleFor(E.year(s));
    if (!r) return null;
    if (r.eff.cost && !E.rulePaid(s, r.from)) return null;
    return r;
  };

  E.ruleMul = function (s, key) {
    var r = E.ruleOf(s);
    return (r && r.eff[key] != null) ? r.eff[key] : 1;
  };

  E.ruleDelta = function (s, key) {
    var r = E.ruleOf(s);
    return (r && r.eff[key] != null) ? r.eff[key] : 0;
  };

  E.ruleFlag = function (s, key) {
    var r = E.ruleOf(s);
    return !!(r && r.eff[key]);
  };

  E.ruleSalesMul = function (s) {
    var r = E.ruleOf(s);
    if (!r) return 1;
    var m = r.eff.sales || 1;
    if (r.eff.fanSales) m *= 1 + Math.min(0.8, Math.sqrt(Math.max(0, s.fans)) * r.eff.fanSales);
    if (r.eff.repSales) m *= 1 + (s.rep || 0) / 100 * r.eff.repSales;
    return m;
  };

  /* 新世代的一次性投入：付得起就付，付不起明年再试 */
  E.tickRules = function (s) {
    if (!Array.isArray(s.rulesPaid)) s.rulesPaid = [];
    var r = E.ruleFor(E.year(s));
    if (!r || !r.eff.cost || E.rulePaid(s, r.from)) return null;
    var cost = Math.round(r.eff.cost * E.inflation(s));
    if (s.money < cost) return { type: 'missed', rule: r, cost: cost };
    s.money -= cost;
    s.rulesPaid.push(r.from);
    return { type: 'paid', rule: r, cost: cost };
  };
  /* ---------------- 研究 ----------------
   * 一次只做一个项目，按日历推进：不开发游戏时间就不走。
   * 完成后给公司永久加成，走乘数（quality/speed/salary/xp/fans/sales/license）
   * 和加数（review）两套语义。 */

  E.researchById = function (id) {
    for (var i = 0; i < GD.RESEARCH.length; i++) if (GD.RESEARCH[i].id === id) return GD.RESEARCH[i];
    return null;
  };

  function researchState(s) {
    if (!s.research || typeof s.research !== 'object') s.research = { done: [], active: null };
    if (!Array.isArray(s.research.done)) s.research.done = [];
    return s.research;
  }

  E.researchDone = function (s, id) { return researchState(s).done.indexOf(id) >= 0; };
  E.researchActive = function (s) { return researchState(s).active; };
  E.researchCost = function (s, item) { return Math.round(item.cost * E.inflation(s)); };

  E.researchProgress = function (s) {
    var a = researchState(s).active;
    if (!a) return 0;
    var it = E.researchById(a.id);
    if (!it || !(it.days > 0)) return 1;
    return Math.max(0, Math.min(1, (s.day - a.start) / it.days));
  };

  E.researchMul = function (s, key) {
    var st = researchState(s), m = 1;
    for (var i = 0; i < st.done.length; i++) {
      var it = E.researchById(st.done[i]);
      if (it && it.eff && it.eff[key]) m *= it.eff[key];
    }
    return m;
  };

  E.researchAdd = function (s, key) {
    var st = researchState(s), sum = 0;
    for (var i = 0; i < st.done.length; i++) {
      var it = E.researchById(st.done[i]);
      if (it && it.eff && it.eff[key]) sum += it.eff[key];
    }
    return sum;
  };

  E.startResearch = function (s, id) {
    var st = researchState(s);
    if (st.active) return false;
    if (st.done.indexOf(id) >= 0) return false;
    var it = E.researchById(id);
    if (!it) return false;
    var cost = E.researchCost(s, it);
    if (s.money < cost) return false;
    s.money -= cost;
    st.active = { id: it.id, start: s.day };
    return true;
  };

  /* ---------------- 设备 / 家具 ----------------
   * 买断制，一次性花钱，永久加成；部分会在像素办公室里画出来。 */

  E.gearById = function (id) {
    for (var i = 0; i < GD.GEAR.length; i++) if (GD.GEAR[i].id === id) return GD.GEAR[i];
    return null;
  };

  function gearState(s) {
    if (!Array.isArray(s.furniture)) s.furniture = [];
    return s.furniture;
  }

  E.hasGear = function (s, id) { return gearState(s).indexOf(id) >= 0; };
  E.gearCost = function (s, item) { return Math.round(item.cost * E.inflation(s)); };

  E.buyGear = function (s, id) {
    var list = gearState(s);
    if (list.indexOf(id) >= 0) return false;
    var it = E.gearById(id);
    if (!it) return false;
    var cost = E.gearCost(s, it);
    if (s.money < cost) return false;
    s.money -= cost;
    list.push(it.id);
    return true;
  };

  E.furnitureMul = function (s, key) {
    var list = gearState(s), m = 1;
    for (var i = 0; i < list.length; i++) {
      var it = E.gearById(list[i]);
      if (it && it.eff && it.eff[key]) m *= it.eff[key];
    }
    return m;
  };

  E.furnitureAdd = function (s, key) {
    var list = gearState(s), sum = 0;
    for (var i = 0; i < list.length; i++) {
      var it = E.gearById(list[i]);
      if (it && it.eff && it.eff[key]) sum += it.eff[key];
    }
    return sum;
  };

  /* 研究 + 设备合并成的总加成 —— 挂钩点统一用这两个 */
  E.bonusMul = function (s, key) { return E.researchMul(s, key) * E.furnitureMul(s, key); };
  E.bonusAdd = function (s, key) { return E.researchAdd(s, key) + E.furnitureAdd(s, key); };

  /* ---------------- 挖人 ----------------
   * 对手的员工不写进存档：id 形如 'rv:<rivalId>:<idx>'，随时能由种子重建。
   * 这样存档只需要记「谁被挖走了」。 */

  function crewHash(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  E.rivalCrew = function (r) {
    if (!r || !r.id) return [];
    var out = [];
    var ROLES = ['code', 'script', 'art', 'audio'];
    for (var idx = 0; idx < 2; idx++) {
      var h = crewHash(r.id + ':' + idx);
      var role = ROLES[h % 4];
      var base = Math.round(22 + r.power * 12);          // power 1.0~1.2 → 34~36
      var stats = { code: base, script: base, art: base, audio: base, speed: Math.round(24 + r.power * 4) };
      stats[role] = Math.min(60, base + 7);
      var bump = ROLES[(h >>> 5) % 4];
      stats[bump] = Math.min(60, stats[bump] + 2);
      out.push({
        id: 'rv:' + r.id + ':' + idx,
        rival: r.id,
        idx: idx,
        name: GD.CREW_NAMES[(h >>> 8) % GD.CREW_NAMES.length],
        seed: r.id + '-' + idx,
        role: role,
        salary: Math.round(base * 12),
        quote: GD.CREW_QUOTES[(h >>> 11) % GD.CREW_QUOTES.length],
        stats: stats
      });
    }
    return out;
  };

  E.rivalCrewById = function (id) {
    var m = /^rv:([^:]+):(\d+)$/.exec(String(id));
    if (!m) return null;
    for (var i = 0; i < GD.RIVALS.length; i++) {
      if (GD.RIVALS[i].id !== m[1]) continue;
      var crew = E.rivalCrew(GD.RIVALS[i]);
      return crew[Number(m[2])] || null;
    }
    return null;
  };

  E.makeCrewStaff = function (id) {
    var c = E.rivalCrewById(id);
    if (!c) return null;
    return {
      id: c.id, name: c.name, seed: c.seed, role: c.role, salary: c.salary,
      quote: c.quote, level: 1, xp: 0, fromRival: c.rival,
      stats: { code: c.stats.code, script: c.stats.script, art: c.stats.art, audio: c.stats.audio, speed: c.stats.speed }
    };
  };

  E.poachInfo = function (s, r, idx) {
    var crew = E.rivalCrew(r);
    var m = crew[idx];
    if (!m) return null;
    var P = GD.POACH;
    var cost = Math.round(m.salary * BAL.hireFeeDays * P.feeDays * (1 + r.power * 0.5) * E.inflation(s));
    var chance = P.chanceBase + s.fans / P.fanDiv + (s.rep || 0) / 400 - (r.power - 1.0) * P.powerPenalty;
    chance = Math.max(0.2, Math.min(0.9, chance));
    return { cost: cost, chance: chance, member: m };
  };

  E.poach = function (s, rivalId, idx) {
    var r = null;
    for (var i = 0; i < s.rivals.length; i++) if (s.rivals[i].id === rivalId) r = s.rivals[i];
    if (!r) return { ok: false, reason: 'no-rival' };
    if (E.year(s) < r.debut) return { ok: false, reason: 'not-debut' };
    if (!Array.isArray(r.poached)) r.poached = [];
    if (r.poached.indexOf(idx) >= 0) return { ok: false, reason: 'gone' };
    if (s.staff.length >= s.seats) return { ok: false, reason: 'no-seat' };

    var info = E.poachInfo(s, r, idx);
    if (!info) return { ok: false, reason: 'no-member' };
    if (s.money < info.cost) return { ok: false, reason: 'poor', cost: info.cost };

    if (Math.random() >= info.chance) {
      s.money -= Math.round(info.cost * GD.POACH.failKeep);
      return { ok: false, reason: 'refused', cost: info.cost, member: info.member };
    }

    s.money -= info.cost;
    r.poached.push(idx);
    r.power = Math.max(0.6, Math.round((r.power - GD.POACH.powerDrop) * 100) / 100);
    var st = E.makeCrewStaff(info.member.id);
    s.staff.push(st);
    return { ok: true, member: info.member, cost: info.cost, staff: st };
  };

  /* ---------------- 收购 / 子品牌 ----------------
   * 买下一整家对手：他们不再参赛，风格与粉丝归你，
   * 之后作为子品牌每月贡献一笔分成收入。 */

  E.brands = function (s) {
    if (!Array.isArray(s.brands)) s.brands = [];
    return s.brands;
  };

  E.isAcquired = function (s, rivalId) {
    var list = E.brands(s);
    for (var i = 0; i < list.length; i++) if (list[i].id === rivalId) return true;
    return false;
  };

  E.acquireCost = function (s, r) {
    return Math.round(BAL.acquireBase * (0.7 + r.power) * (1 + r.games.length * 0.12) * E.inflation(s));
  };

  E.acquireFans = function (r) {
    return Math.round(r.games.length * 600 + r.power * 2000);
  };

  /* 返回 null 表示可以收购；否则是拦下来的原因 */
  E.acquireBlock = function (s, r) {
    if (!r) return 'no-rival';
    if (E.year(s) < r.debut) return 'not-debut';
    if (E.isAcquired(s, r.id)) return 'owned';
    if ((s.fans || 0) < BAL.acquireFansMin) return 'fans';
    if (s.money < E.acquireCost(s, r)) return 'poor';
    return null;
  };

  E.acquire = function (s, rivalId) {
    var r = null;
    for (var i = 0; i < s.rivals.length; i++) if (s.rivals[i].id === rivalId) r = s.rivals[i];
    if (!r) return { ok: false, reason: 'no-rival' };
    var blocked = E.acquireBlock(s, r);
    if (blocked) return { ok: false, reason: blocked, cost: E.acquireCost(s, r) };

    var cost = E.acquireCost(s, r);
    s.money -= cost;
    r.acquired = true;
    var fans = E.acquireFans(r);
    s.fans += fans;
    var brand = {
      id: r.id, name: r.name, genre: r.genre, theme: r.theme,
      since: E.year(s), power: r.power, titles: r.games.length,
      output: 0, lastYear: 0
    };
    E.brands(s).push(brand);
    return { ok: true, cost: cost, fans: fans, brand: brand };
  };

  /* 子品牌每月的被动收入 */
  E.brandIncome = function (s) {
    var list = E.brands(s), sum = 0;
    for (var i = 0; i < list.length; i++) sum += list[i].power * BAL.brandPerMonth;
    return sum * E.inflation(s);
  };

  /* 子品牌每年自己出一部作品（保留原来的类型与题材，成绩随年头缓慢变好） */
  E.tickBrands = function (s) {
    var yr = E.year(s);
    var list = E.brands(s);
    if (!Array.isArray(s.yearBrand)) s.yearBrand = [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.lastYear >= yr) continue;
      b.lastYear = yr;
      var def = E.rivalDef(b.id);
      var titlesArr = (def && def.titles && def.titles.length) ? def.titles : ['新作'];
      var out = b.output || 0;
      var title = titlesArr[out % titlesArr.length];
      var score = Math.round(26 + (yr - b.since) * 0.35 + b.power * 3 + (Math.random() * 4 - 2));
      score = Math.max(14, Math.min(40, score));
      b.output = out + 1;
      s.yearBrand.push({ year: yr, title: title, score: score, brand: b.id, brandName: b.name });
    }
    if (s.yearBrand.length > 200) s.yearBrand.shift();
  };

  /* ---------------- 自研平台 ----------------
   * 2068 起可以自己开平台：定三个参数，之后每年涨装机、收第三方抽成。
   * 平台本身作为一个动态平台对象混进 GD.PLATFORMS 的序列里，
   * 这样企划界面和其它平台逻辑完全不用改。 */

  function mpTier(kind, id) {
    var list = GD.MYPLATFORM[kind];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  E.myPlatformDef = function (s) {
    var mp = s && s.myPlatform;
    if (!mp) return null;
    return {
      id: 'own', code: GD.MYPLATFORM.code, brand: GD.MYPLATFORM.brand, name: mp.name,
      year: mp.launched, retire: 9999,
      install: mp.install, license: 0, price: mp.price,
      cap: GD.MYPLATFORM.cap, fav: null, own: true
    };
  };

  E.allPlatforms = function (s) {
    var def = E.myPlatformDef(s);
    return def ? GD.PLATFORMS.concat([def]) : GD.PLATFORMS;
  };

  E.launchBlock = function (s, pick) {
    if (s.myPlatform) return 'exists';
    if (E.year(s) < GD.MYPLATFORM.minYear) return 'early';
    var cost = Math.round(mpTier('tierBudget', pick && pick.budget).cost * E.inflation(s));
    if (s.money < cost) return 'poor';
    return null;
  };

  E.launchPreview = function (s, pick) {
    var b = mpTier('tierBudget', pick && pick.budget);
    var p = mpTier('tierPrice', pick && pick.price);
    var c = mpTier('tierCut', pick && pick.cut);
    return {
      cost: Math.round(b.cost * E.inflation(s)),
      install: Math.round(b.installBase * p.installMul * 10) / 10,
      price: p.price,
      cut: c.cut,
      budgetName: b.name, priceName: p.name, cutName: c.name,
      b: b, p: p, c: c
    };
  };

  E.launchPlatform = function (s, pick) {
    var blocked = E.launchBlock(s, pick);
    if (blocked) return { ok: false, reason: blocked, cost: E.launchPreview(s, pick).cost };
    var pv = E.launchPreview(s, pick);
    s.money -= pv.cost;
    s.myPlatform = {
      name: 'M-' + String(E.year(s)).slice(-2),
      launched: E.year(s),
      install: pv.install,
      price: pv.price,
      unitMul: pv.p.unitMul,
      cut: pv.cut,
      thirdMul: pv.c.thirdMul,
      budgetName: pv.budgetName,
      priceName: pv.priceName,
      cutName: pv.cutName,
      lastYear: E.year(s),
      thirdParty: 0,
      revenue: 0,
      lastRevenue: 0,
      lastTitles: 0
    };
    return { ok: true, cost: pv.cost, mp: s.myPlatform };
  };

  /* 每年：装机增长 + 第三方上架与抽成 */
  E.tickPlatform = function (s) {
    var mp = s.myPlatform;
    if (!mp) return null;
    var yr = E.year(s);
    if (mp.lastYear >= yr) return null;
    mp.lastYear = yr;

    /* 装机：投入越大涨得越多，但基数越大越难涨 */
    var grow = 1.6 * (mp.install > 0 ? 1 : 0) - 0.055 * mp.install;
    mp.install = Math.max(0.5, Math.round((mp.install + grow) * 10) / 10);

    var rivals = 0;
    for (var i = 0; i < s.rivals.length; i++) {
      if (!s.rivals[i].acquired && yr >= s.rivals[i].debut) rivals++;
    }
    var titles = Math.max(0, Math.round((rivals + 1) * mp.thirdMul * (0.4 + mp.install / 22)));

    var rev = Math.round(titles * mp.install * mp.price * 900 * mp.cut * E.inflation(s));
    mp.lastTitles = titles;
    mp.lastRevenue = rev;
    mp.thirdParty += titles;
    mp.revenue += rev;
    s.money += rev;
    s.totalEarned += rev;
    return { titles: titles, revenue: rev, install: mp.install };
  };

  /* ---------------- 企划 → 开发 ---------------- */

  E.startProject = function (s, plan) {
    if (s.phase !== 'planning') return false;
    var plat = E.platformById(plan.platform || E.platform(s).id, s);
    var lic = plat.license * E.bonusMul(s, 'license');
    if (s.money < lic) return false;

    s.plan = { genre: plan.genre, theme: plan.theme, leader: plan.leader, platform: plat.id, name: plan.name || '' };
    s.money -= lic;
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
      cost: lic,
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
    /* 只有「要花钱且钱不够」才拦。零成本选项永远可选 ——
     * 否则现金一旦为负，连免费选项都会被判成买不起，事件永远答不了，游戏软锁。 */
    if (opt.cost > 0 && s.money < opt.cost) return false;

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
      /* 次线性：品质超出 cap 越多，边际收益越小，避免「品质一高必打满分」 */
      var v = 10 * Math.pow(Math.max(0.01, q / cap), 0.45) * 0.85 + E.bonusAdd(s, 'review') + (s.rep || 0) / 100 * 0.8;
      if (!E.ruleFlag(s, 'noBias') && c.fav === s.plan.genre) v += c.bias;
      if (!E.ruleFlag(s, 'noBias') && c.hate === s.plan.genre) v -= 1.0;
      v += (Math.random() * 2 - 1) * E.ruleMul(s, 'reviewNoise');
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
    var fanF = 1 + Math.min(3, Math.sqrt(Math.max(0, s.fans)) / 160);   // 平方根 + 封顶：打破「粉丝越多卖越多」的滚雪球
    var scoreF = Math.pow(total / 40, 2.5) * 2.2;
    var salesMult = 1 + (((s.project && s.project.salesPct) || 0) / 100);
    var mid = BAL.salesBase * E.effInstall(s, E.platform(s)) * fanF * scoreF * mult * salesMult *
      E.bonusMul(s, 'sales') * E.traitFansMul(s) * E.ruleSalesMul(s);
    return { low: Math.round(mid * 0.85), mid: Math.round(mid), high: Math.round(mid * 1.15) };
  };

  /* ---------------- 销售 ---------------- */

  E.startSales = function (s) {
    var total = s.review.total;
    var fanF = 1 + Math.min(3, Math.sqrt(Math.max(0, s.fans)) / 160);   // 平方根 + 封顶：打破「粉丝越多卖越多」的滚雪球
    var scoreF = Math.pow(total / 40, 2.5) * 2.2;
    var rnd = 0.85 + Math.random() * 0.3;
    var windowMult = s.release ? s.release.mult : 1;
    var salesMult = 1 + ((s.project.salesPct || 0) / 100);
    var clashMult = s.release && s.release.collision ? s.release.collision.mult : 1;
    var copies = Math.round(BAL.salesBase * E.effInstall(s, E.platform(s)) * fanF * scoreF * rnd * windowMult * salesMult * clashMult * E.bonusMul(s, 'sales') * E.ruleSalesMul(s));

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
    var revenue = copies * E.platform(s).price * (BAL.publisherCut + E.ruleDelta(s, 'cut'));

    s.money += revenue;
    s.totalEarned += revenue;
    s.fans += copies * BAL.fanPerCopy * E.traitFansMul(s) * E.bonusMul(s, 'fans');
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

    /* 研发按日历推进：跨过目标天数就算完成，跟当前处在哪个阶段无关 */
    var rs = researchState(s);
    if (rs.active) {
      var ra = E.researchById(rs.active.id);
      if (ra && s.day - rs.active.start >= ra.days) {
        rs.done.push(ra.id);
        rs.active = null;
        out.push({ type: 'research', item: ra });
      }
    }

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
    E.tickBrands(s);
    E.tickPlatform(s);
    var ruleEv = E.tickRules(s);
    if (ruleEv) out.push({ type: ruleEv.type === 'paid' ? 'rulePaid' : 'ruleMissed', rule: ruleEv.rule, cost: ruleEv.cost });
    var got = E.settleAwards(s);
    for (var ai = 0; ai < got.length; ai++) out.push({ type: 'award', award: got[ai] });
    if (s.phase === 'planning' && !s.ended && E.year(s) >= BAL.endYear) {
      s.phase = 'ending';
      out.push({ type: 'ending' });
    }
    return out;
  };

  /* ---------------- 收尾 ---------------- */

  /* 作品名：玩家填了就用玩家的，没填就用「类型·题材」自动名 */
  E.gameName = function (s) {
    var custom = (s.plan && s.plan.name) ? String(s.plan.name).trim() : '';
    if (custom) return custom.slice(0, 18);
    var g = E.genre(s.plan.genre), t = E.theme(s.plan.theme);
    return g.name + '·' + t.name;
  };

  E.randomGameName = function () {
    var a = GD.GAME_WORDS.a, b = GD.GAME_WORDS.b;
    return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
  };

  E.nextRound = function (s) {
    if (s.phase !== 'done') return false;
    s.round++;
    s.phase = 'planning';
    if (s.plan) s.plan.name = '';
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
      if (r.acquired) continue;          // 被收购的对手不再参赛
      if (yr < r.debut || r.lastYear >= yr) continue;
      r.lastYear = yr;
      if (Math.random() < 0.12) continue;

      /* 对手强度跟着「年代」走，而不是只看自己出道多久 ——
       * 否则 90 年代才出道的新对手永远是弱鸡，奖项后期毫无竞争。 */
      var score = Math.round(25 + (yr - BAL.startYear) * 0.44 + r.power * 2.2 + (Math.random() * 5 - 2.5));
      score = Math.max(14, Math.min(46, score));

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

      /* 每年粉丝衰减，防止「粉丝越多卖越多」的无限滚雪球 */
      s.fans = Math.max(0, s.fans * (1 - BAL.fanDecayPerYear));

      /* 子品牌的作品算你的成绩：取当年子品牌里最好的一部 */
      var brandBest = null;
      var brandList = Array.isArray(s.yearBrand) ? s.yearBrand : [];
      for (var bi = 0; bi < brandList.length; bi++) {
        if (brandList[bi].year !== last) continue;
        if (!brandBest || brandList[bi].score > brandBest.score) brandBest = brandList[bi];
      }
      if (brandBest && brandBest.score > mine) mine = brandBest.score;
      var byBrand = !!(brandBest && brandBest.score === mine && brandBest.score > (s.yearBest || 0));

      var theirs = [];
      for (var i = 0; i < s.yearRivalReleases.length; i++) {
        if (s.yearRivalReleases[i].year === last) theirs.push(s.yearRivalReleases[i]);
      }
      theirs.sort(function (a, b) { return b.score - a.score; });
      var top = theirs[0] || null;

      var topScore = top ? top.score : 0;
      var best = Math.max(mine, topScore);
      /* 必须「严格超过」才算拿奖：同分归对手，否则满分玩家会白拿所有年份 */
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
        E.addRep(s, award.title === '年度游戏' ? 10 : 5);
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
        playerAward: award ? award.title : null,
        playerBrand: byBrand ? brandBest.brandName : null,
        playerBrandTitle: byBrand ? brandBest.title : null
      });
      if (s.yearResults.length > 100) s.yearResults.shift();

      s.yearBest = 0;
      last++;
    }

    s.awardYear = yr;
    s.yearRivalReleases = s.yearRivalReleases.filter(function (g) { return g.year >= yr - 1; });
    s.yearBrand = (Array.isArray(s.yearBrand) ? s.yearBrand : []).filter(function (g) { return g.year >= yr - 1; });
    return got;
  };

  /* ---------------- 结局 ---------------- */

  E.ending = function (s) {
    var rep = Math.round(s.rep || 0);
    var wins = E.awardWins(s);
    var awards = (s.awards || []).length;
    var best = 0;
    for (var i = 0; i < s.history.length; i++) if (s.history[i].total > best) best = s.history[i].total;
    var title, tone;
    /* 判定顺序按文档 4.5：先看「年度游戏次数 + 声望」，再看声望，再看「小而美」 */
    if (wins >= 3 && rep >= 80) { title = '时代定义者'; tone = '你定的规则，别人在遵守。'; }
    else if (rep >= 50) { title = '一流工作室'; tone = '你活下来了，而且活得不错。'; }
    else if (s.fans >= 500000 && E.officeLevel(s) <= 3) { title = '小而美'; tone = '人不多，但每一部都拿得出手。'; }
    else { title = '勉强维生'; tone = '还在，还没倒。'; }
    return {
      title: title,
      tone: tone,
      years: BAL.endYear - BAL.startYear,
      releases: s.history.length,
      best: best,
      awards: awards,
      wins: wins,
      rep: rep,
      fans: Math.round(s.fans),
      earned: Math.round(s.totalEarned)
    };
  };

  /* ---------------- 长尾 ---------------- */

  E.monthIncome = function (s) {
    var sum = 0;
    for (var i = 0; i < s.history.length; i++) sum += (s.history[i].revenue || 0) * BAL.tailPerMonth * E.ruleMul(s, 'tail');
    return sum;
  };

  E.settleMonths = function (s) {
    var month = Math.floor(s.day / 30);
    var last = s.tailMonth || 0;
    if (month <= last) return 0;
    var per = E.monthIncome(s) + E.brandIncome(s);
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
        var isRoster = GD.ROSTER.some(function (r) { return r.id === x.id; });
        /* 名单里的人从 ROSTER 重建；挖来的人（rv:...）从对手船员表重建 */
        var m = isRoster ? E.makeStaff(x.id) : E.makeCrewStaff(x.id);
        if (!m) return;
        if (staff.some(function (y) { return y.id === x.id; })) return;
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
