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
    /* 小平台线性、大平台额外加价：早期别把车库压死，后期又能吃掉暴利。
     * 起征点 3.5：1972 年的街机板刚好在线下，做第一部游戏不至于亏。 */
    var cost = raw * (1 + Math.max(0, raw - (BAL.prodPenaltyFrom || 3.5)) * 0.72);
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

  /* ---------------- 市场流行 ----------------
   * 每年 2 个题材 + 1 个类型走红。走势由年份哈希推出来，
   * 同一局每一年都一样，不占存档字段，也不会因为读档而变。 */
  E.trendFor = function (year) {
    var y = Math.floor(year == null ? BAL.startYear : year);
    var themes = [], guard = 0;
    while (themes.length < (BAL.trendThemes || 2) && guard < 40) {
      var idx = crewHash('trend-theme:' + y + ':' + guard) % GD.THEMES.length;
      var id = GD.THEMES[idx].id;
      if (themes.indexOf(id) === -1) themes.push(id);
      guard++;
    }
    var gi = crewHash('trend-genre:' + y) % GD.GENRES.length;
    return { year: y, themes: themes, genre: GD.GENRES[gi].id };
  };

  E.trendSalesMul = function (year, genreId, themeId) {
    var t = E.trendFor(year), m = 1;
    if (t.themes.indexOf(themeId) >= 0) m *= BAL.trendThemeSales;
    if (t.genre === genreId) m *= BAL.trendGenreSales;
    return m;
  };

  E.trendIsHotTheme = function (year, themeId) {
    return E.trendFor(year).themes.indexOf(themeId) >= 0;
  };

  E.trendIsHotGenre = function (year, genreId) {
    return E.trendFor(year).genre === genreId;
  };

  E.trendText = function (year) {
    var t = E.trendFor(year);
    return t.themes.map(function (id) { return E.theme(id).name; }).join(' / ');
  };

  /* ---------------- 怀旧潮 ----------------
   * 每 12 年一次（1984、1996、2008…），持续 2 年：年初抽一个类型，销量 ×1.30。
   * 同样由年份哈希决定，不占存档。收藏越全越容易吃到 —— 那条线正是老类型的招牌组合。 */
  E.nostalgiaFor = function (year) {
    var y = Math.floor(year == null ? BAL.startYear : year);
    var every = BAL.nostalgiaEvery || 12;
    if (!(every > 0)) return null;
    var rel = y - BAL.startYear;
    /* 开局前 12 年不来潮，也别把开局那一年算成一波 */
    if (rel < every) return null;
    var from = BAL.startYear + Math.floor(rel / every) * every;
    if (y < from || y >= from + (BAL.nostalgiaYears || 2)) return null;
    var g = GD.GENRES[crewHash('nostalgia:' + from) % GD.GENRES.length];
    return {
      from: from,
      to: from + (BAL.nostalgiaYears || 2) - 1,
      genre: g.id,
      mult: BAL.nostalgiaSales
    };
  };

  E.nostalgiaSalesMul = function (year, genreId) {
    var n = E.nostalgiaFor(year);
    return n && n.genre === genreId ? n.mult : 1;
  };

  /* NG+ 的日历倍速 */
  E.timeSpeed = function (s) { return (s.ng || 0) > 0 ? (BAL.ngTimeSpeed || 1) : 1; };

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
      if (all[i].year <= year && !E.isRetired(s, all[i])) out.push(all[i]);
    }
    /* 极端情况（所有平台都退市了也不会发生，自研平台永不退市） */
    return out.length ? out : [all[all.length - 1]];
  };

  /* 平台是否已经退市：过了 retire 那一年就不能再做新作品 */
  E.isRetired = function (s, p) {
    if (!p) return false;
    if (p.own) return false;                 // 自研平台永不退市
    var retire = p.retire || 9999;
    return E.year(s) > retire;
  };

  /* 快退市了：给企划界面打预警 */
  E.retiringSoon = function (s, p) {
    if (!p || E.isRetired(s, p)) return false;
    var retire = p.retire || 9999;
    return retire - E.year(s) <= (BAL.platformWarnYears || 2);
  };

  E.retiredPlatforms = function (s) {
    var all = E.allPlatforms(s), out = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].year <= E.year(s) && E.isRetired(s, all[i])) out.push(all[i]);
    }
    return out;
  };

  /* 当前企划的平台如果退市了，自动换到最新可用平台 */
  /* 当前企划的平台如果不在可用列表里（还没上市 / 已退市），换到最新可用的那个。
   * 注意：只判断「没退市」不够 —— 存档里可能留着一个还没上市的平台 id。 */
  E.ensurePlanPlatform = function (s) {
    if (!s || !s.plan) return null;
    var yr = E.year(s);
    var p = E.platformById(s.plan.platform, s);
    if (p && p.year <= yr && !E.isRetired(s, p)) return null;
    var avail = E.availablePlatforms(s);
    if (!avail.length) return null;
    var from = s.plan.platform;
    s.plan.platform = avail[avail.length - 1].id;
    return { from: from, to: s.plan.platform };
  };

  /* 解析「这次企划用哪个平台」：给的那个不合法就退回当前可用平台 */
  E.planPlatform = function (s, plan) {
    var yr = E.year(s);
    var id = (plan && plan.platform) || (s.plan && s.plan.platform) || null;
    if (id) {
      var p = E.platformById(id, s);
      if (p && p.id === id && p.year <= yr && !E.isRetired(s, p)) return p;
    }
    return E.platform(s);
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

  /* 确定性品质（不含随机与事件），用于企划预告。
   * affMul：续作的相性折扣（BAL.sequelAffinity），默认 1。 */
  E.baseQuality = function (s, genreId, themeId, leaderId, affMul) {
    var g = E.genre(genreId);
    var leader = E.staffById(s, leaderId);
    var w = g.weights;
    var leaderQ = 0, teamQ = 0;
    for (var k in w) {
      leaderQ += w[k] * leader.stats[k];
      teamQ += w[k] * E.teamStat(s, k);
    }
    var base = 0.75 * leaderQ + 0.25 * teamQ;
    return base * E.affinity(genreId, themeId) * (affMul || 1) * 1.08 *
      E.teamBonus(s) * E.traitQualityMul(s) * E.bonusMul(s, 'quality') * E.ruleMul(s, 'quality') *
      E.moodMul(leader).quality;
  };

  E.devDuration = function (s, leaderId) {
    var leader = E.staffById(s, leaderId);
    var d = BAL.devSeconds - leader.stats.speed * BAL.speedFactor -
      Math.max(0, s.staff.length - 3) * BAL.teamSpeedBonus;
    /* 状态倍率是「速度」，耗时要除：疲劳 0.70 的速度 = 耗时 ÷ 0.70 */
    return Math.max(BAL.minDevSeconds,
      d * E.traitSpeedMul(s) * E.bonusMul(s, 'speed') * E.ruleMul(s, 'speed') / E.moodMul(leader).speed);
  };

  /* 企划面板的预估 */
  E.preview = function (s, plan) {
    var sq = E.planSequelOf(s, plan);
    var affMul = sq ? BAL.sequelAffinity : 1;
    var q = E.baseQuality(s, plan.genre, plan.theme, plan.leader, affMul);
    /* 必须用 plan 里指定的平台 —— 以前这里读的是 s.plan，导致「换平台预览」永远是旧平台的数据。
     * 指定平台不合法（未上市/已退市）时退回当前可用平台。 */
    var p = E.planPlatform(s, plan);
    var cap = E.capOf(p);
    var duration = E.devDuration(s, plan.leader) * (sq ? BAL.sequelSpeed : 1);
    var days = duration * BAL.daysPerSecond;
    return {
      affinity: E.affinity(plan.genre, plan.theme) * affMul,
      sequel: sq,
      trend: E.trendSalesMul(E.year(s), plan.genre, plan.theme) *
        E.nostalgiaSalesMul(E.year(s), plan.genre),
      nostalgia: E.nostalgiaFor(E.year(s)),
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

  /* ---------------- 续作 ----------------
   * 销量 >= BAL.sequelMinCopies 的旧作能出续作：
   *   销量 ×1.40、开发耗时 ×0.80、相性 ×0.85（同一套组合不能一直吃）。
   * 续作继承原作的系列编号，作品集里显示「第 n 作」。 */

  E.historyTitle = function (h) {
    if (!h) return '';
    var custom = h.name ? String(h.name).trim() : '';
    if (custom) return custom;
    return E.genre(h.genre).name + '·' + E.theme(h.theme).name;
  };

  /* 去掉标题末尾的编号：'古墓丽影 2' / '古墓丽影2' / '古墓丽影 II' 都回到 '古墓丽影'。
   * 续作的自动名字永远接在「系列第一作」的名字后面，不会出现「古墓丽影2 3」。 */
  E.stripSeq = function (title) {
    var t = String(title == null ? '' : title).trim();
    t = t.replace(/[\s·:：\-—]*第?\s*[0-9０-９]+$/, '');
    t = t.replace(/[\s·:：\-—]+(?:[IVXLC]+)$/i, '');
    return t.trim() || String(title || '').trim();
  };

  /* 系列根名：第一作叫过什么，后面就一直用它 */
  E.seriesRoot = function (h) {
    if (!h) return '';
    var root = h.seriesTitle ? String(h.seriesTitle).trim() : '';
    return root || E.stripSeq(E.historyTitle(h));
  };

  /* 能出续作的旧作，最近的排前面，最多 4 个 */
  E.sequelCandidates = function (s) {
    var hist = s.history || [], out = [];
    for (var i = hist.length - 1; i >= 0 && out.length < 4; i--) {
      var h = hist[i];
      if (!h || (h.copies || 0) < BAL.sequelMinCopies) continue;
      out.push({
        index: i,
        title: E.historyTitle(h),
        seriesTitle: E.seriesRoot(h),
        copies: h.copies || 0,
        seq: (h.seq || 1) + 1,
        genre: h.genre, theme: h.theme
      });
    }
    return out;
  };

  /* plan.sequel 存的是作品集下标（字符串也行）；解析成一份续作信息 */
  E.planSequelOf = function (s, plan) {
    if (!plan || plan.sequel == null || plan.sequel === '') return null;
    var h = (s.history || [])[Number(plan.sequel)];
    if (!h || (h.copies || 0) < BAL.sequelMinCopies) return null;
    return {
      index: Number(plan.sequel),
      title: E.historyTitle(h),
      seriesTitle: E.seriesRoot(h),
      seriesKey: h.seriesKey || ('s' + Number(plan.sequel)),
      seq: (h.seq || 1) + 1
    };
  };

  E.planSequel = function (s) { return E.planSequelOf(s, s.plan); };

  /* 当前企划的相性折扣：续作 ×0.85，其余 1 */
  E.planAffMul = function (s) { return E.planSequel(s) ? BAL.sequelAffinity : 1; };

  /* 开发中的实时品质（不含随机） */
  E.liveQuality = function (s) {
    if (!s.project) return 0;
    var avg = s.project.elapsed > 0 ? s.project.modeQSum / s.project.elapsed : 0;
    return E.baseQuality(s, s.plan.genre, s.plan.theme, s.plan.leader, E.planAffMul(s)) *
      (1 + ((s.project.eventQualityPct || 0) + avg) / 100);
  };

  /* ---------------- 团队 ---------------- */

  E.makeStaff = function (id) {
    var r = E.rosterById(id);
    return {
      id: r.id, name: r.name, seed: r.seed, role: r.role, salary: r.salary,
      quote: r.quote, level: 1, xp: 0,
      morale: BAL.moraleStart, stamina: BAL.staminaStart,
      stats: { code: r.stats.code, script: r.stats.script, art: r.stats.art, audio: r.stats.audio, speed: r.stats.speed }
    };
  };

  /* ---------------- 士气 / 体力 ----------------
   * 每部作品消耗体力、按成绩涨落士气；作品之间自动回一点。
   * 低了不是死局，只是掉速度和品质 —— 玩家可以花钱团建救回来。 */

  function clampMood(v) { return Math.max(0, Math.min(100, v)); }

  E.moraleOf = function (st) {
    return clampMood(st && st.morale != null ? st.morale : BAL.moraleStart);
  };

  E.staminaOf = function (st) {
    return clampMood(st && st.stamina != null ? st.stamina : BAL.staminaStart);
  };

  /* 一个人的状态倍率：疲劳掉速度，低士气掉品质 */
  E.moodMul = function (st) {
    var stm = E.staminaOf(st), mo = E.moraleOf(st);
    var speed = 1;
    if (stm < BAL.tiredStaminaAt) speed = BAL.tiredStaminaMul;
    else if (stm < BAL.lowStaminaAt) speed = BAL.lowStaminaMul;
    return {
      speed: speed,
      quality: mo < BAL.lowMoraleAt ? BAL.lowMoraleMul : 1,
      stamina: stm, morale: mo
    };
  };

  E.moodLabel = function (st) {
    var m = E.moodMul(st);
    if (m.stamina < BAL.tiredStaminaAt) return '疲劳';
    if (m.morale < BAL.lowMoraleAt) return '低落';
    if (m.stamina < BAL.lowStaminaAt) return '有点累';
    return '正常';
  };

  /* 团队整体状态（给界面用） */
  E.teamMood = function (s) {
    var stm = 0, mo = 0, n = s.staff.length || 1;
    s.staff.forEach(function (x) {
      stm += E.staminaOf(x);
      mo += E.moraleOf(x);
    });
    return { stamina: stm / n, morale: mo / n };
  };

  /* 一部作品做完：全员掉体力、按成绩涨落士气 */
  E.settleMood = function (s) {
    if (!s.staff || !s.staff.length) return;
    var score = (s.review && s.review.total) || 0;
    var elapsed = (s.project && s.project.elapsed) || 0;
    var crunch = (s.project && s.project.crunchTime) || 0;
    var crunching = elapsed > 0 && crunch > elapsed * 0.4;
    var drain = BAL.staminaDrain + (crunching ? BAL.staminaCrunchExtra : 0);
    var dMorale = 0;
    if (score >= 34) dMorale += BAL.moraleGainHit;
    if (score < 24) dMorale -= BAL.moraleDrainFlop;
    if (crunching) dMorale -= BAL.moraleDrainCrunch;
    s.staff.forEach(function (st) {
      st.stamina = clampMood(E.staminaOf(st) - drain);
      st.morale = clampMood(E.moraleOf(st) + dMorale);
    });
  };

  /* 作品之间恢复 */
  E.restMood = function (s) {
    if (!s.staff) return;
    s.staff.forEach(function (st) {
      st.stamina = clampMood(E.staminaOf(st) + BAL.staminaRest);
      st.morale = clampMood(E.moraleOf(st) + BAL.moraleRest);
    });
  };

  E.teamBuildCost = function (s) { return Math.round(BAL.teamBuildCost * E.inflation(s)); };

  E.teamBuild = function (s) {
    if (s.phase !== 'planning') return false;
    if (s.builtRound === s.round) return false;
    var cost = E.teamBuildCost(s);
    if (s.money < cost) return false;
    s.money -= cost;
    s.builtRound = s.round;
    s.staff.forEach(function (st) {
      st.morale = clampMood(E.moraleOf(st) + BAL.teamBuildMorale);
      st.stamina = clampMood(E.staminaOf(st) + 10);
    });
    return true;
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

  /* 办公室等级：工位数就是房间等级（3 车库 / 4 街边 / 5 写字楼 / 6 独栋） */
  E.officeLevel = function (s) { return Math.max(3, Math.min(6, s.seats || 3)); };

  E.roomDef = function (idx) {
    var i = Math.max(0, Math.min((GD.ROOMS || []).length - 1, idx));
    return GD.ROOMS[i];
  };

  E.roomIndex = function (s) { return E.officeLevel(s) - 3; };

  E.room = function (s) { return E.roomDef(E.roomIndex(s)); };

  E.nextRoom = function (s) {
    var i = E.roomIndex(s), n = E.roomDef(i + 1);
    if (!n || (GD.ROOMS || []).length <= i + 1) return null;
    if (s.seats >= (s.seatCap || 6)) return null;
    return n;
  };

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

  /* ---------------- 解雇 ----------------
   * 遣散费 = 日薪 × BAL.fireDays。人会回到候选池，之后还能再招回来。
   * 最后一个人不能解雇（否则没法开工）。 */
  E.fireCost = function (s, st) {
    return Math.round(E.effSalary(s, st) * (BAL.fireDays || 30));
  };

  E.fireStaff = function (s, id) {
    if (!s.staff || s.staff.length <= 1) return { ok: false, reason: 'last' };
    var idx = -1;
    for (var i = 0; i < s.staff.length; i++) {
      if (s.staff[i].id === id) { idx = i; break; }
    }
    if (idx < 0) return { ok: false, reason: 'missing' };
    var st = s.staff[idx];
    var cost = E.fireCost(s, st);
    if (s.money < cost) return { ok: false, reason: 'money', cost: cost };
    s.money -= cost;
    s.staff.splice(idx, 1);
    if (s.plan && s.plan.leader === id) s.plan.leader = s.staff[0].id;
    s.firedFee = (s.firedFee || 0) + cost;
    E.rollCandidates(s);
    return { ok: true, cost: cost, name: st.name };
  };

  E.expandOffice = function (s) {
    var idx = s.seats - 3;
    if (idx >= BAL.seatCosts.length || s.seats >= (s.seatCap || 6)) return false;
    var cost = BAL.seatCosts[idx] * E.inflation(s);
    if (s.money < cost) return false;
    s.money -= cost;
    s.seats++;
    return true;
  };

  E.expandCost = function (s) {
    var idx = s.seats - 3;
    if (idx >= BAL.seatCosts.length || s.seats >= (s.seatCap || 6)) return null;
    return BAL.seatCosts[idx] * E.inflation(s);
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
      yearBrand: [],
      yearWorks: [],
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
      lostBrands: [],
      platformCrashes: 0,
      crashedPlatforms: [],
      influence: 0,
      customRules: [],
      customOffer: null,
      customCodeN: 0,
      brokeMonths: 0,
      bankrupts: 0,
      seatCap: 6,
      declEff: null,
      combos: E.initialCombos(),
      found: [],
      comboNews: [],
      builtRound: 0,
      ng: 0,
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
    var m = 1;
    var r = E.ruleOf(s);
    if (r && r.eff[key] != null) m *= r.eff[key];
    var c = E.customRuleOf(s);
    if (c && c.eff[key] != null) m *= c.eff[key];
    return m;
  };

  E.ruleDelta = function (s, key) {
    var d = 0;
    var r = E.ruleOf(s);
    if (r && r.eff[key] != null) d += r.eff[key];
    var c = E.customRuleOf(s);
    if (c && c.eff[key] != null) d += c.eff[key];
    return d;
  };

  E.ruleFlag = function (s, key) {
    var r = E.ruleOf(s);
    if (r && r.eff[key]) return true;
    var c = E.customRuleOf(s);
    return !!(c && c.eff[key]);
  };

  /* ---------------- 自定时代（2075 之后） ----------------
   * 最后一条固定规则是 2075 的「跨殖民地」。之后每 8 年开一个自定时代：
   * 从 3 张随机规则卡里选一张（花影响力），或者直接随机（免费，10% 范式跃迁）。
   * 选定的规则会一直生效，和固定规则叠乘。 */

  /* 行业影响力：一部作品 +1，拿奖加更多。够不够花，全看你这几年出了什么货。 */
  E.influenceGain = function (total) {
    return (total >= 30 ? 2 : 1);
  };

  E.addInfluence = function (s, n) {
    s.influence = Math.max(0, Math.round((s.influence || 0) + n));
    return s.influence;
  };

  /* 当前处在第几个自定时代；还没开始返回 -1 */
  E.customEraIndex = function (year) {
    var c = GD.CUSTOM;
    if (!c || year < c.startYear) return -1;
    return Math.floor((year - c.startYear) / c.everyYears);
  };

  /* 某个自定时代的起始年 */
  E.customEraFrom = function (i) {
    var c = GD.CUSTOM;
    return c.startYear + i * c.everyYears;
  };

  /* 当前该生效的自定规则（已选的、from <= 今年里最晚那条） */
  E.customRuleOf = function (s) {
    var list = Array.isArray(s.customRules) ? s.customRules : [];
    var yr = E.year(s);
    var hit = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].from <= yr) hit = list[i];
    }
    return hit;
  };

  /* 该选规则了但还没选：返回待选的 era from，否则 null */
  E.customPendingFrom = function (s) {
    var idx = E.customEraIndex(E.year(s));
    if (idx < 0) return null;
    var from = E.customEraFrom(idx);
    var list = Array.isArray(s.customRules) ? s.customRules : [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].from >= from) return null;
    return from;
  };

  /* 强度缩放：乘数类按「偏离 1 的幅度」缩放，加减类直接缩放 */
  var CUSTOM_MUL_KEYS = { speed: 1, quality: 1, salary: 1, sales: 1, tail: 1 };
  function scaleEff(eff, k) {
    var out = {};
    for (var key in eff) {
      if (!Object.prototype.hasOwnProperty.call(eff, key)) continue;
      var v = eff[key];
      if (typeof v !== 'number') { out[key] = v; continue; }
      if (CUSTOM_MUL_KEYS[key]) out[key] = Math.round((1 + (v - 1) * k) * 1000) / 1000;
      else out[key] = Math.round(v * k * 1000) / 1000;
    }
    return out;
  }

  var CUSTOM_TIERS = [
    { k: 0.8, label: '弱' },
    { k: 1.0, label: '中' },
    { k: 1.25, label: '强' }
  ];

  function nextCode(s) {
    s.customCodeN = (s.customCodeN || 0) + 1;
    var codes = (GD.CUSTOM && GD.CUSTOM.codes) || ['NX'];
    var head = codes[(s.customCodeN - 1) % codes.length];
    return head + '-' + s.customCodeN;
  }

  /* 生成一张卡 */
  E.makeCustomCard = function (s, tierK) {
    var pool = GD.CUSTOM_TEMPLATES;
    var t = pool[Math.floor(Math.random() * pool.length)];
    var tier = CUSTOM_TIERS[Math.floor(Math.random() * CUSTOM_TIERS.length)];
    var k = (tierK || tier.k) * (tierK ? 1 : 1);
    var name = t.names[Math.floor(Math.random() * t.names.length)];
    return {
      code: nextCode(s),
      tpl: t.id,
      name: name,
      desc: t.desc,
      learn: t.learn,
      tier: tierK ? '跃迁' : tier.label,
      eff: scaleEff(t.eff, k)
    };
  };

  /* 给待选时代发一批卡 */
  E.rollCustomCards = function (s) {
    var from = E.customPendingFrom(s);
    if (from == null) return null;
    if (!s.customOffer || s.customOffer.from !== from) {
      var cards = [];
      var used = {};
      var guard = 0;
      while (cards.length < GD.CUSTOM.cards && guard++ < 60) {
        var c = E.makeCustomCard(s, 0);
        if (used[c.tpl]) continue;
        used[c.tpl] = 1;
        cards.push(c);
      }
      s.customOffer = { from: from, cards: cards };
    }
    return s.customOffer;
  };

  /* 重抽一批（花钱） */
  E.rerollCustomCards = function (s) {
    var cost = GD.CUSTOM.rerollCost;
    if ((s.influence || 0) < cost) return { ok: false, reason: 'influence', cost: cost };
    if (!s.customOffer) E.rollCustomCards(s);
    if (!s.customOffer) return { ok: false, reason: 'none' };
    s.influence -= cost;
    s.customOffer = null;
    E.rollCustomCards(s);
    return { ok: true, cost: cost };
  };

  /* 选定一张卡 */
  E.pickCustomCard = function (s, idx) {
    if (!s.customOffer) return { ok: false, reason: 'none' };
    var card = s.customOffer.cards[idx];
    if (!card) return { ok: false, reason: 'bad' };
    var cost = GD.CUSTOM.pickCost;
    if ((s.influence || 0) < cost) return { ok: false, reason: 'influence', cost: cost };
    s.influence -= cost;
    if (!Array.isArray(s.customRules)) s.customRules = [];
    s.customRules.push({
      from: s.customOffer.from, code: card.code, name: card.name,
      desc: card.desc, learn: card.learn, tier: card.tier, eff: card.eff
    });
    s.customOffer = null;
    return { ok: true, cost: cost, rule: s.customRules[s.customRules.length - 1] };
  };

  /* 随机：免费，10% 概率范式跃迁（一次得两条，第二条强度 ×1.3） */
  E.randomCustomCard = function (s) {
    if (!s.customOffer) return { ok: false, reason: 'none' };
    var from = s.customOffer.from;
    var card = E.makeCustomCard(s, 0);
    if (!Array.isArray(s.customRules)) s.customRules = [];
    var got = [card];
    s.customRules.push({
      from: from, code: card.code, name: card.name,
      desc: card.desc, learn: card.learn, tier: card.tier, eff: card.eff
    });

    var shifted = false;
    if (Math.random() < GD.CUSTOM.paradigmChance) {
      shifted = true;
      var extra = E.makeCustomCard(s, GD.CUSTOM.paradigmBoost);
      s.customRules.push({
        from: from, code: extra.code, name: extra.name,
        desc: extra.desc, learn: extra.learn, tier: '跃迁', eff: extra.eff
      });
      got.push(extra);
    }
    s.customOffer = null;
    return { ok: true, cost: 0, rules: got, paradigm: shifted };
  };

  E.ruleSalesMul = function (s) {
    var m = 1;
    var list = [E.ruleOf(s), E.customRuleOf(s)];
    for (var i = 0; i < list.length; i++) {
      var e = list[i] && list[i].eff;
      if (!e) continue;
      if (e.sales != null) m *= e.sales;
      if (e.fanSales) m *= 1 + Math.min(0.8, Math.sqrt(Math.max(0, s.fans)) * e.fanSales);
      if (e.repSales) m *= 1 + (s.rep || 0) / 100 * e.repSales;
    }
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
  /* ---------------- 组合收藏 ----------------
   * 10 类型 x 10 题材 = 100 格，开局每个类型给相性最高的 2 格（共 20）。
   * 其余靠玩拿到，三条路：
   *   完成一部作品 -> 解锁 2 格（优先相性高的，同时往题材种类上铺开）
   *   完成一项研究 -> 解锁 1 格
   *   收购一家对手 -> 解锁它主打的类型 x 题材
   * 相性 >= 1.30 的 12 格是「王牌组合」，做出一部就记进 found（只在收藏里加星）。
   * 新拿到的东西进 s.comboNews 队列，UI 取走弹提示后清空。 */

  E.LEGEND_AFF = 1.30;

  E.comboKey = function (g, t) { return g + ':' + t; };

  E.comboList = function () {
    var out = [];
    for (var i = 0; i < GD.GENRES.length; i++) {
      for (var j = 0; j < GD.THEMES.length; j++) {
        out.push({
          genre: GD.GENRES[i].id, theme: GD.THEMES[j].id,
          aff: E.affinity(GD.GENRES[i].id, GD.THEMES[j].id)
        });
      }
    }
    return out;
  };

  E.comboUnlocked = function (s, g, t) {
    return Array.isArray(s.combos) && s.combos.indexOf(E.comboKey(g, t)) >= 0;
  };

  E.comboCount = function (s) { return Array.isArray(s.combos) ? s.combos.length : 0; };

  E.isLegendary = function (g, t) { return E.affinity(g, t) >= E.LEGEND_AFF; };

  E.comboFound = function (s, g, t) {
    return Array.isArray(s.found) && s.found.indexOf(E.comboKey(g, t)) >= 0;
  };

  /* 收藏总览：have/total 格数，found 王牌已达成数 */
  E.comboStats = function (s) {
    var all = E.comboList(), legend = 0, have = 0;
    for (var i = 0; i < all.length; i++) {
      if (E.isLegendary(all[i].genre, all[i].theme)) legend++;
      if (E.comboUnlocked(s, all[i].genre, all[i].theme)) have++;
    }
    return {
      have: have, total: all.length,
      found: Array.isArray(s.found) ? s.found.length : 0,
      legend: legend
    };
  };

  /* 开局：每个类型相性最高的 2 个题材 */
  E.initialCombos = function () {
    var all = E.comboList(), out = [];
    for (var i = 0; i < GD.GENRES.length; i++) {
      var g = GD.GENRES[i].id;
      var row = all.filter(function (c) { return c.genre === g; });
      row.sort(function (a, b) { return b.aff - a.aff; });
      for (var k = 0; k < 2 && k < row.length; k++) out.push(E.comboKey(row[k].genre, row[k].theme));
    }
    return out;
  };

  E.unlockCombo = function (s, g, t) {
    if (!Array.isArray(s.combos)) s.combos = [];
    var key = E.comboKey(g, t);
    if (s.combos.indexOf(key) >= 0) return null;
    s.combos.push(key);
    if (!Array.isArray(s.comboNews)) s.comboNews = [];
    s.comboNews.push({ type: 'unlock', genre: g, theme: t, aff: E.affinity(g, t) });
    return { genre: g, theme: t, aff: E.affinity(g, t) };
  };

  /* 下一个该给哪个：相性高的优先，但题材被用过的次数越多扣得越狠，避免一路只堆一个题材 */
  E.unlockNextCombo = function (s) {
    var all = E.comboList(), best = null, bestScore = -1e9, use = {};
    for (var i = 0; i < (s.combos || []).length; i++) {
      var th = String(s.combos[i]).split(':')[1];
      use[th] = (use[th] || 0) + 1;
    }
    for (var j = 0; j < all.length; j++) {
      var c = all[j];
      if (E.comboUnlocked(s, c.genre, c.theme)) continue;
      var score = c.aff - 0.16 * (use[c.theme] || 0);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best) return null;
    return E.unlockCombo(s, best.genre, best.theme);
  };

  E.markFound = function (s, g, t) {
    if (!Array.isArray(s.found)) s.found = [];
    var key = E.comboKey(g, t);
    if (s.found.indexOf(key) >= 0) return false;
    s.found.push(key);
    if (!Array.isArray(s.comboNews)) s.comboNews = [];
    s.comboNews.push({ type: 'found', genre: g, theme: t, aff: E.affinity(g, t) });
    return true;
  };

  E.drainComboNews = function (s) {
    var out = Array.isArray(s.comboNews) ? s.comboNews.slice() : [];
    s.comboNews = [];
    return out;
  };

  /* 某类型下已解锁的题材 id */
  E.comboThemes = function (s, g) {
    var out = [];
    for (var i = 0; i < GD.THEMES.length; i++) {
      if (E.comboUnlocked(s, g, GD.THEMES[i].id)) out.push(GD.THEMES[i].id);
    }
    return out;
  };

  /* 题材被锁时自动落到该类型里相性最高的已解锁题材；返回换成了哪个（没换返回 null） */
  E.ensurePlanCombo = function (s) {
    if (!s || !s.plan) return null;
    if (E.comboUnlocked(s, s.plan.genre, s.plan.theme)) return null;
    var row = E.comboList().filter(function (c) {
      return c.genre === s.plan.genre && E.comboUnlocked(s, c.genre, c.theme);
    }).sort(function (a, b) { return b.aff - a.aff; });
    if (!row.length) return null;
    var was = s.plan.theme;
    s.plan.theme = row[0].theme;
    return { from: was, to: s.plan.theme };
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
    return Math.max(0, Math.min(1, (s.day - a.start) / (it.days / E.bonusMul(s, 'research'))));
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

  /* 研究项目的开放年份（第二轮那 24 项），没列到的开局就能做 */
  E.researchFrom = function (it) {
    return (it && GD.RESEARCH_FROM && GD.RESEARCH_FROM[it.id]) || 0;
  };

  E.researchYearOk = function (s, it) {
    return E.year(s) >= E.researchFrom(it);
  };

  E.startResearch = function (s, id) {
    var st = researchState(s);
    if (st.active) return false;
    if (st.done.indexOf(id) >= 0) return false;
    var it = E.researchById(id);
    if (!it) return false;
    if (!E.researchYearOk(s, it)) return false;
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
    if (!E.gearYearOk(s, it)) return false;
    var cost = E.gearCost(s, it);
    if (s.money < cost) return false;
    s.money -= cost;
    list.push(it.id);
    return true;
  };

  /* 第二轮设备的开放年份 */
  E.gearFrom = function (it) {
    return (it && GD.GEAR_FROM && GD.GEAR_FROM[it.id]) || 0;
  };

  E.gearYearOk = function (s, it) {
    return E.year(s) >= E.gearFrom(it);
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
  /* 加成收益递减：把「偏离 1 的幅度」压到一个上限以内。
   * 加分成因是研究 × 设备 × 家具 × 宣言全部相乘，48 件设备能叠到 5 倍以上，
   * 直接乘进去会让后期随便一部作品都顶到平台上限。
   * 这项对「变小」的方向同样生效（比如开发速度 0.55 会被抬回 0.75 左右）。 */
  E.softMul = function (m) {
    if (!(m > 0)) return 1;
    var lim = (BAL && BAL.mulCap) || 1.2;
    var away = m - 1;
    if (away === 0) return 1;
    var mag = Math.abs(away);
    var out = lim * (1 - Math.exp(-mag / lim));
    return 1 + (away > 0 ? out : -out);
  };

  /* 平台的品质上限：越晚的平台能承载的工艺越高 */
  E.capOf = function (p) {
    if (!p) return 60;
    var base = (BAL && BAL.capBase) || 1.9;
    var growth = (BAL && BAL.capGrowth) || 0.033;
    var yr = p.year || BAL.startYear;
    return Math.max(10, p.cap * (base + Math.max(0, yr - BAL.startYear) * growth));
  };

  E.bonusMul = function (s, key) {
    var m = E.researchMul(s, key) * E.furnitureMul(s, key);
    var d = s.declEff && s.declEff[key];
    if (d) m *= d;
    /* 办公室等级：quality / research / sales 三类乘数 */
    var rd = E.room(s);
    if (rd && rd.eff && rd.eff[key]) m *= rd.eff[key];
    return E.softMul(m);
  };
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
    E.unlockCombo(s, r.genre, r.theme);
    return { ok: true, cost: cost, fans: fans, brand: brand };
  };

  /* ---------------- 子品牌买回 ----------------
   * 破产清算时子品牌会脱离、变回独立对手。之后可以按 0.8 折买回来。
   * 记录的是「谁脱离过」，所以买回是有限次的重逢，不是无限白嫖。 */

  E.lostBrands = function (s) {
    if (!Array.isArray(s.lostBrands)) s.lostBrands = [];
    return s.lostBrands;
  };

  E.isLostBrand = function (s, rivalId) {
    var list = E.lostBrands(s);
    for (var i = 0; i < list.length; i++) if (list[i].id === rivalId) return true;
    return false;
  };

  E.buybackCost = function (s, r) {
    return Math.round(E.acquireCost(s, r) * (BAL.buybackRate || 0.8));
  };

  /* 返回 null 表示可以买回，否则是拦下来的原因 */
  E.buybackBlock = function (s, r) {
    if (!r) return 'no-rival';
    /* 已经归到旗下的，先说清楚是「重复」而不是「没脱离过」 */
    if (E.isAcquired(s, r.id)) return 'owned';
    if (!E.isLostBrand(s, r.id)) return 'not-lost';
    if (s.money < E.buybackCost(s, r)) return 'poor';
    return null;
  };

  E.buyback = function (s, rivalId) {
    var r = null;
    for (var i = 0; i < s.rivals.length; i++) if (s.rivals[i].id === rivalId) r = s.rivals[i];
    if (!r) return { ok: false, reason: 'no-rival' };
    var blocked = E.buybackBlock(s, r);
    if (blocked) return { ok: false, reason: blocked, cost: E.buybackCost(s, r) };

    var cost = E.buybackCost(s, r);
    s.money -= cost;
    r.acquired = true;
    var brand = {
      id: r.id, name: r.name, genre: r.genre, theme: r.theme,
      since: E.year(s), power: r.power, titles: r.games.length,
      output: 0, lastYear: 0, boughtBack: true
    };
    E.brands(s).push(brand);
    /* 从「脱离名单」里划掉 */
    s.lostBrands = E.lostBrands(s).filter(function (x) { return x.id !== rivalId; });
    E.unlockCombo(s, r.genre, r.theme);
    return { ok: true, cost: cost, brand: brand };
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
      var bCats = E.rivalCats({ year: yr, title: title }, score, b.id);
      s.yearBrand.push({
        year: yr, title: title, score: score, brand: b.id, brandName: b.name,
        genre: (b.genre || (def && def.genre) || 'rpg'),
        theme: (b.theme || (def && def.theme) || 'fantasy'),
        cats: bCats
      });
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
      launchInstall: pv.install,
      installTarget: Math.round(pv.install * 2.2 * 10) / 10,
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

  /* 每年：装机增长 + 第三方上架与抽成 + 维护费。亏损连年会倒闭。 */
  E.tickPlatform = function (s) {
    var mp = s.myPlatform;
    if (!mp) return null;
    var yr = E.year(s);
    if (mp.lastYear >= yr) return null;
    mp.lastYear = yr;

    /* 装机：朝「天花板」增长。天花板在开台时由三档参数定死，
     * 所以选型决定的是上限，不是一时的数字。 */
    var target = mp.installTarget || (mp.installTarget = Math.round((mp.launchInstall || mp.install) * 2.2 * 10) / 10);
    var grow = 0.95 * (1 - mp.install / Math.max(1, target));
    mp.install = Math.max(0.5, Math.round((mp.install + grow) * 10) / 10);
    if (mp.install > target) mp.install = target;

    var rivals = 0;
    for (var i = 0; i < s.rivals.length; i++) {
      if (!s.rivals[i].acquired && yr >= s.rivals[i].debut) rivals++;
    }
    var titles = Math.max(0, Math.round((rivals + 1) * mp.thirdMul * (0.4 + mp.install / 22)));

    var rev = Math.round(titles * mp.install * mp.price * 900 * mp.cut * E.inflation(s));
    /* 维护费两部分：
     *   1) 每上架一部第三方作品都要认证 + 带宽，抽成越低越可能亏；
     *   2) 装机本身要养服务器，所以「重注投入」不是稳赚。
     * 两项都和收入同量级，选型才真的要做取舍。 */
    var perTitle = Math.round(titles * mp.install * mp.price * 900 *
      (BAL.platformUpkeepRate || 0.20) * E.inflation(s));
    var perInstall = Math.round(mp.install * (BAL.platformUpkeepPerInstall || 20000) * E.inflation(s));
    var upkeep = perTitle + perInstall;
    var net = rev - upkeep;

    mp.lastTitles = titles;
    mp.lastRevenue = rev;
    mp.upkeep = upkeep;
    mp.net = net;
    mp.thirdParty += titles;
    mp.revenue += rev;
    s.money += rev;
    s.totalEarned += rev;

    /* 连年亏损：先警告，撑不住就倒闭 */
    if (net < 0) mp.debtYears = (mp.debtYears || 0) + 1;
    else mp.debtYears = 0;

    var crashed = false;
    if ((mp.debtYears || 0) >= (BAL.platformFailYears || 2)) {
      var loss = Math.round(Math.max(0, s.money) * (BAL.platformCrashLoss || 0.6));
      s.money -= loss;
      mp.crashed = { year: yr, loss: loss, install: mp.install };
      s.platformCrashes = (s.platformCrashes || 0) + 1;
      if (!Array.isArray(s.crashedPlatforms)) s.crashedPlatforms = [];
      s.crashedPlatforms.push({
        name: mp.name, launched: mp.launched, year: yr,
        install: mp.install, revenue: mp.revenue, loss: loss
      });
      s.myPlatform = null;
      crashed = true;
    }

    return {
      titles: titles, revenue: rev, install: mp.install,
      upkeep: upkeep, net: net, debtYears: crashed ? 0 : (mp.debtYears || 0),
      crashed: crashed, loss: crashed ? mp.crashed.loss : 0
    };
  };

  /* 平台健康度：给界面用 */
  E.platformHealth = function (s) {
    var mp = s.myPlatform;
    if (!mp) return null;
    var debt = mp.debtYears || 0;
    return {
      net: mp.net || 0,
      upkeep: mp.upkeep || 0,
      debtYears: debt,
      left: Math.max(0, (BAL.platformFailYears || 2) - debt),
      danger: debt > 0
    };
  };

  /* ---------------- 企划 → 开发 ---------------- */

  E.startProject = function (s, plan) {
    if (s.phase !== 'planning') return false;
    var plat = E.planPlatform(s, plan);
    var lic = plat.license * E.bonusMul(s, 'license');
    if (s.money < lic) return false;

    /* 锁着的题材不能立项：落到该类型里相性最高的已解锁题材 */
    var themeId = plan.theme;
    if (!E.comboUnlocked(s, plan.genre, themeId)) {
      var list = E.comboList(), best = null, bestAff = -1;
      for (var ci = 0; ci < list.length; ci++) {
        var c = list[ci];
        if (c.genre !== plan.genre || !E.comboUnlocked(s, c.genre, c.theme)) continue;
        if (c.aff > bestAff) { bestAff = c.aff; best = c.theme; }
      }
      if (!best) return false;
      themeId = best;
    }

    /* 续作：继承系列编号，开发更快、相性打折 */
    var sq = E.planSequelOf(s, plan);

    s.plan = {
      genre: plan.genre, theme: themeId, leader: plan.leader, platform: plat.id,
      name: plan.name || '', sequel: sq ? sq.index : null
    };
    s.money -= lic;
    s.project = {
      baseDuration: E.devDuration(s, plan.leader) * (sq ? BAL.sequelSpeed : 1),
      elapsed: 0,
      progress: 0,
      mode: 'normal',
      modeQSum: 0,
      crunchTime: 0,
      eventQualityPct: 0,
      salesPct: 0,
      eventsDone: 0,
      microDone: 0,
      quality: 0,
      cost: lic,
      sequel: sq,
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
    var q = E.baseQuality(s, s.plan.genre, s.plan.theme, s.plan.leader, E.planAffMul(s));
    q *= 1 + ((s.project.eventQualityPct || 0) + avgMode) / 100;
    q += Math.random() * 6 - 3;
    return Math.max(5, Math.min(100, q));
  }

  function computeReview(s) {
    var q = s.project.quality;
    var cap = E.capOf(E.platform(s));
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
    var sequelMult = (s.project && s.project.sequel) ? BAL.sequelSales : 1;
    var trendMult = s.plan ? E.trendSalesMul(E.year(s), s.plan.genre, s.plan.theme) *
      E.nostalgiaSalesMul(E.year(s), s.plan.genre) : 1;
    var mid = BAL.salesBase * E.effInstall(s, E.platform(s)) * fanF * scoreF * mult * salesMult * sequelMult * trendMult *
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
    var sequelMult = (s.project && s.project.sequel) ? BAL.sequelSales : 1;
    /* 今年是不是怀旧潮（老类型整年好卖） */
    var trendMult = E.trendSalesMul(E.year(s), s.plan.genre, s.plan.theme);
    var nostMult = E.nostalgiaSalesMul(E.year(s), s.plan.genre);
    var copies = Math.round(BAL.salesBase * E.effInstall(s, E.platform(s)) * fanF * scoreF * rnd * windowMult * salesMult * clashMult * sequelMult * trendMult * nostMult * E.bonusMul(s, 'sales') * E.ruleSalesMul(s));

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
      if (ra && s.day - rs.active.start >= ra.days / E.bonusMul(s, 'research')) {
        rs.done.push(ra.id);
        E.unlockNextCombo(s);
        rs.active = null;
        out.push({ type: 'research', item: ra });
      }
    }

    if (s.phase === 'developing') {
      var mode = BAL.modes[s.project.mode] || BAL.modes.normal;

      s.project.elapsed += dt;
      s.project.modeQSum += mode.quality * dt;
      if (s.project.mode === 'crunch') s.project.crunchTime = (s.project.crunchTime || 0) + dt;
      s.project.progress += (dt * mode.rate) / s.project.baseDuration;
      s.day += dt * BAL.daysPerSecond * E.timeSpeed(s);

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
          platform: s.plan.platform,
          platformLabel: E.platformLabel(E.platform(s)),
          quality: s.project.quality,
          total: s.review.total,
          copies: s.sales.sold,
          revenue: s.sales.revenue,
          cost: s.project.cost,
          profit: s.sales.revenue - s.project.cost,
          date: E.dateString(s.day),
          window: s.release ? s.release.name : '普通档期',
          windowMult: s.release ? s.release.mult : 1,
          seriesKey: s.project.sequel ? s.project.sequel.seriesKey : null,
          seriesTitle: s.project.sequel ? s.project.sequel.seriesTitle : null,
          seq: s.project.sequel ? s.project.sequel.seq : 1,
          sequelOf: s.project.sequel ? s.project.sequel.title : ''
        };
        s.history.push(s.lastResult);
        /* 记录这部作品的四个单项分，年底评「最佳画面 / 音乐 / 剧情」要用 */
        var myCats = E.catScores(s, s.plan, s.review.total);
        s.lastResult.cats = myCats;
        if (!Array.isArray(s.yearWorks)) s.yearWorks = [];
        s.yearWorks.push({
          year: E.year(s), title: E.gameName(s),
          genre: s.plan.genre, theme: s.plan.theme,
          total: s.review.total, cats: myCats,
          brandName: '', fromBrand: false,
          hi: s.history.length - 1
        });
        if (s.yearWorks.length > 60) s.yearWorks.shift();
        /* 士气 / 体力：做完一部结算一次 */
        E.settleMood(s);
        /* 行业影响力：出片就有，分高的多给一点。2075 之后靠它选规则 */
        E.addInfluence(s, E.influenceGain(s.review.total));
        /* 做完一部：解锁 2 个新组合（NG+ 多给 1 个）；如果这次用的是传说组合，记一笔 */
        var unlockN = 2 + ((s.ng || 0) > 0 ? (BAL.ngComboBonus || 0) : 0);
        for (var ui2 = 0; ui2 < unlockN; ui2++) E.unlockNextCombo(s);
        if (E.isLegendary(s.plan.genre, s.plan.theme)) E.markFound(s, s.plan.genre, s.plan.theme);
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
    /* 平台退市 / 快退市：各推一次提示 */
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
    var sq = E.planSequel(s);
    if (sq) {
      /* 续作没起名就接在系列根名后面：「古墓丽影 2」「古墓丽影 3」，不会堆成「古墓丽影2 3」 */
      return (sq.seriesTitle + ' ' + sq.seq).slice(0, 18);
    }
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
    E.restMood(s);
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

  /* ---------------- NG+ ----------------
   * 结局后带着收藏 / 子品牌 / 10% 粉丝重开 1972：
   * 日历 ×2（更早看到新平台与新世代），每部作品多解锁 1 格组合。
   * 这是唯一的重置层，目标是集齐 100 格。 */
  E.canNewGamePlus = function (s) { return !!s && s.phase === 'ending'; };

  E.newGamePlus = function (s) {
    if (!E.canNewGamePlus(s)) return false;
    var combos = Array.isArray(s.combos) ? s.combos.slice() : E.initialCombos();
    var found = Array.isArray(s.found) ? s.found.slice() : [];
    var brands = JSON.parse(JSON.stringify(s.brands || []));
    var fans = Math.floor((s.fans || 0) * (BAL.ngFansKeep || 0.1));
    var ng = (s.ng || 0) + 1;
    /* 公司理念跟着你走：不用再选一次宣言 */
    var declId = s.declaration || 'ngplus';
    var declEff = s.declEff ? JSON.parse(JSON.stringify(s.declEff)) : null;
    var fresh = E.newGame();
    Object.keys(fresh).forEach(function (k) { s[k] = fresh[k]; });
    s.combos = combos;
    s.found = found;
    s.comboNews = [];
    s.brands = brands;
    s.fans = fans;
    s.ng = ng;
    s.declaration = declId;
    s.declEff = declEff;
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

  /* ---------------- 破产与新公司 ----------------
   * 公司会死，行业不会：作品 / 长尾 / 研究 / 30% 粉丝 / 子品牌带来的关系都还留着，
   * 员工、办公室、设备、平台、现金、奖项清空；子品牌脱离变回独立对手。 */

  E.needRebuild = function (s) { return s.phase === 'bankrupt'; };

  E.declRetryById = function (id) {
    for (var i = 0; i < GD.DECLARATIONS_RETRY.length; i++) {
      if (GD.DECLARATIONS_RETRY[i].id === id) return GD.DECLARATIONS_RETRY[i];
    }
    return null;
  };

  E.newCompanyMoney = function (s) {
    return BAL.newCompanyBase + Math.round((s.rep || 0) * BAL.newCompanyRepBonus);
  };

  E.newCompany = function (s, declId) {
    var d = E.declRetryById(declId);
    if (!d) return false;
    if (s.phase !== 'bankrupt') return false;

    /* 子品牌脱离，变回独立竞争对手；记下 id 供之后按 0.8 折买回 */
    var released = [];
    if (!Array.isArray(s.lostBrands)) s.lostBrands = [];
    E.brands(s).forEach(function (b) {
      for (var i = 0; i < s.rivals.length; i++) {
        if (s.rivals[i].id !== b.id) continue;
        s.rivals[i].acquired = false;
        s.rivals[i].power = Math.max(0.8, b.power);
        s.rivals[i].lastYear = 0;
        released.push(s.rivals[i].name);
        /* 已经是「脱离过」的就不重复记 */
        var had = false;
        for (var k = 0; k < s.lostBrands.length; k++) if (s.lostBrands[k].id === b.id) had = true;
        if (!had) {
          s.lostBrands.push({ id: b.id, name: b.name, at: E.year(s), power: b.power });
        }
      }
    });
    s.brands = [];

    s.bankrupts = (s.bankrupts || 0) + 1;
    s.awards = [];
    s.myPlatform = null;
    s.furniture = [];
    s.staff = GD.FOUNDERS.map(function (id) { return E.makeStaff(id); });
    s.seats = 3;
    s.seatCap = d.eff.seatCap || 6;
    s.fans = Math.round((s.fans || 0) * BAL.newCompanyFansKeep * (d.eff.fansMul || 1));
    s.money = Math.round(E.newCompanyMoney(s) * (d.eff.moneyMul || 1));
    if (d.eff.resetRep) s.rep = 0;
    E.addRep(s, 5);            /* 每破产一次 +5 创始人声望 */
    s.declaration = d.id;
    s.declEff = d.eff;
    s.brokeMonths = 0;
    s.rescued = 0;
    s.project = null;
    s.review = null;
    s.sales = null;
    s.event = null;
    s.micro = null;
    s.release = null;
    s.timer = 0;
    s.lastEvent = null;
    s.phase = 'planning';
    s.round = (s.history || []).length + 1;
    E.rollCandidates(s);
    return { ok: true, declaration: d, released: released, money: s.money, fans: s.fans };
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
      var cfgR = {
        base: BAL.rivalBase != null ? BAL.rivalBase : 25,
        slope: BAL.rivalYearSlope != null ? BAL.rivalYearSlope : 0.44,
        power: BAL.rivalPower != null ? BAL.rivalPower : 2.2,
        jitter: BAL.rivalJitter != null ? BAL.rivalJitter : 2.5,
        cap: BAL.rivalCap != null ? BAL.rivalCap : 46
      };
      var score = Math.round(cfgR.base + (yr - BAL.startYear) * cfgR.slope +
        r.power * cfgR.power + (Math.random() * cfgR.jitter * 2 - cfgR.jitter));
      score = Math.max(14, Math.min(cfgR.cap, score));

      var def = E.rivalDef(r.id);
      var title = def.titles[r.games.length % def.titles.length];
      var game = {
        year: yr, week: 1 + Math.floor(Math.random() * 52), title: title, score: score,
        rival: r.id, name: r.name,
        genre: r.genre || (def && def.genre) || 'action',
        theme: r.theme || (def && def.theme) || 'modern'
      };
      game.cats = E.rivalCats(game, score, r.id);
      r.games.push(game);
      s.yearRivalReleases.push(game);
      if (s.yearRivalReleases.length > 200) s.yearRivalReleases.shift();
    }
  };

  /* ---------------- 年度奖项 ---------------- */

  /* 一部作品的四个单项分：
   *   该项最强的人 45% + 团队平均 35% + 主创 20%，再按总口碑微调。
   * 谁当主创仍然有影响（20%），但「招了个好美术」比「让谁当导演」更重要，
   * 否则剧本型主创会把画面分一直压死、这三个奖变成永远拿不到。 */
  E.catScores = function (s, plan, total) {
    var leader = E.staffById(s, (plan && plan.leader)) || (s.staff && s.staff[0]);
    var t = total == null ? 30 : total;
    var team = s.staff || [];
    var out = {};
    ['code', 'script', 'art', 'audio'].forEach(function (k) {
      var lead = leader && leader.stats ? leader.stats[k] : 40;
      var teamAvg = team.length ? E.teamStat(s, k) : lead;
      var best = 0;
      for (var i = 0; i < team.length; i++) {
        if (team[i].stats && team[i].stats[k] > best) best = team[i].stats[k];
      }
      if (!best) best = lead;
      var base = 0.45 * best + 0.35 * teamAvg + 0.20 * lead;
      out[k] = Math.max(4, Math.min(99, Math.round(base * (0.55 + 0.45 * (t / 40)))));
    });
    return out;
  };

  /* 对手没有明细数据，用分数 + 哈希摊出四个单项分（同一条记录永远一样） */
  E.rivalCats = function (game, score, seedKey) {
    var sc = score == null ? (game && game.score) || 30 : score;
    var cfg = GD.BAL_AWARD || { catScale: 1.35, catJitter: 6 };
    var h = crewHash('cats:' + (game ? game.year : 0) + ':' + (seedKey || (game && game.rival) || '') + ':' + (game ? game.title : ''));
    var span = cfg.catJitter * 2 + 1;
    var out = {};
    ['code', 'script', 'art', 'audio'].forEach(function (k, i) {
      var off = ((h >>> (i * 5 + 1)) % span) - cfg.catJitter;
      out[k] = Math.max(4, Math.min(99, Math.round(sc * cfg.catScale + off)));
    });
    return out;
  };

  /* 从一组候选里挑某个奖项值最高的一个 */
  function pickBest(list, cat) {
    var best = null, bestV = -1;
    for (var i = 0; i < list.length; i++) {
      var v = E.awardValue(cat, list[i]);
      if (v > bestV) { bestV = v; best = list[i]; }
    }
    return { entry: best, value: bestV < 0 ? 0 : bestV };
  }

  /* 奖项奖金 / 粉丝 / 声望 */
  function awardPrize(cat, year) {
    var y = Math.max(0, year - BAL.startYear);
    if (cat && cat.id === 'goty') {
      return { rep: 10, money: 60000 + y * 30000, fans: 3000 + y * 600 };
    }
    return { rep: 5, money: 25000 + y * 12000, fans: 1200 + y * 250 };
  }

  /* 某个奖项的候选值；没资格返回 -1。
   * 玩家作品用 total，对手/子品牌记录用的是 score，这里统一回退。 */
  E.awardValue = function (cat, entry) {
    if (!entry) return -1;
    var total = entry.total != null ? entry.total : (entry.score || 0);
    if (cat.kind === 'total') return total;
    if (cat.kind === 'genre') return entry.genre === cat.genre ? total : -1;
    var cats = entry.cats || {};
    return cats[cat.cat] || 0;
  };

  E.awardCount = function (s, id) {
    var n = 0;
    (s.awards || []).forEach(function (a) { if (a && a.cat === id) n++; });
    return n;
  };

  E.settleAwards = function (s) {
    var yr = E.year(s);
    var last = s.awardYear || BAL.startYear;
    var got = [];
    var guard = 0;
    if (!Array.isArray(s.yearWorks)) s.yearWorks = [];
    if (!Array.isArray(s.yearBrand)) s.yearBrand = [];

    while (last < yr && guard++ < 50) {
      /* 每年粉丝衰减，防止「粉丝越多卖越多」的无限滚雪球 */
      s.fans = Math.max(0, s.fans * (1 - BAL.fanDecayPerYear));

      /* 这一年算你名下的所有作品：自己的 + 子品牌的 */
      var mine = [];
      for (var wi = 0; wi < s.yearWorks.length; wi++) {
        var w = s.yearWorks[wi];
        if (w && w.year === last) mine.push(w);
      }
      for (var bi = 0; bi < s.yearBrand.length; bi++) {
        var bw = s.yearBrand[bi];
        if (!bw || bw.year !== last) continue;
        mine.push({
          year: last, title: bw.title, genre: bw.genre, theme: bw.theme,
          total: bw.score,
          cats: bw.cats || E.rivalCats({ year: last, title: bw.title }, bw.score, bw.brand),
          brandName: bw.brandName || '', fromBrand: true, hi: -1
        });
      }

      /* 老存档兼容：当年只记了 yearBest、没有 yearWorks 明细时，用当前企划补一条 */
      if (!mine.length && (s.yearBest || 0) > 0) {
        var fp = s.plan || {};
        var fTotal = s.yearBest;
        var fTitle = s.yearBestTitle || '';
        if (!fTitle) {
          try { fTitle = E.gameName(s); } catch (e) { fTitle = '旧作'; }
        }
        mine.push({
          year: last, title: fTitle,
          genre: fp.genre || 'rpg', theme: fp.theme || 'fantasy',
          total: fTotal, cats: E.catScores(s, fp, fTotal),
          brandName: '', fromBrand: false, hi: -1
        });
      }

      var theirs = [];
      for (var i = 0; i < s.yearRivalReleases.length; i++) {
        if (s.yearRivalReleases[i].year === last) theirs.push(s.yearRivalReleases[i]);
      }

      /* 6 个奖项逐个评：玩家最好的那部和对手最好的那部比 */
      var detail = [];
      var fresh = [];
      for (var ci = 0; ci < GD.AWARD_CATS.length; ci++) {
        var cat = GD.AWARD_CATS[ci];
        var p = pickBest(mine, cat);
        var r = pickBest(theirs, cat);
        var min = cat.min || 0;
        var won = !!(p.entry && p.value >= min && p.value >= r.value);

        detail.push({
          id: cat.id, name: cat.name, icon: cat.icon, kind: cat.kind,
          won: won,
          me: p.entry ? p.value : 0,
          meTitle: p.entry ? p.entry.title : '',
          meBrand: (p.entry && p.entry.brandName) ? p.entry.brandName : null,
          them: r.entry ? r.value : 0,
          themName: r.entry ? (r.entry.name || r.entry.brandName || '') : '',
          themTitle: r.entry ? (r.entry.title || '') : ''
        });

        if (!won) continue;

        /* 给你的那部作品挂上奖章（作品集里显示） */
        if (p.entry && p.entry.hi != null && p.entry.hi >= 0) {
          var hist = s.history[p.entry.hi];
          if (hist) {
            if (!Array.isArray(hist.awards)) hist.awards = [];
            hist.awards.push(cat.name);
          }
        }

        var prize = awardPrize(cat, last);
        var aw = {
          year: last, cat: cat.id, title: cat.name, score: Math.round(p.value),
          money: prize.money, fans: prize.fans
        };
        E.addRep(s, prize.rep);
        s.money += prize.money;
        s.fans += prize.fans;
        /* 拿奖换影响力：年度游戏给得最多 */
        E.addInfluence(s, cat.id === 'goty' ? 20 : 8);
        s.awards.push(aw);
        got.push(aw);
        fresh.push(aw);
      }

      /* 年度游戏没拿到但差得不多：给提名（唯一保留的「安慰奖」） */
      var goty = detail[0];
      var nom = null;
      if (goty && !goty.won && goty.me >= 24 && goty.me >= goty.them - 2) {
        var y0 = Math.max(0, last - BAL.startYear);
        nom = {
          year: last, cat: 'nominee', title: '年度提名', score: goty.me,
          money: 20000 + y0 * 10000, fans: 800 + y0 * 200
        };
        E.addRep(s, 5);
        s.money += nom.money;
        s.fans += nom.fans;
        s.awards.push(nom);
        got.push(nom);
      }
      if (s.awards.length > 400) s.awards = s.awards.slice(-400);

      s.yearResults.push({
        year: last,
        winner: goty && !goty.won ? (goty.themName || null) : null,
        winnerTitle: goty && !goty.won ? (goty.themTitle || null) : null,
        winnerScore: goty ? (goty.won ? goty.me : goty.them) : 0,
        playerScore: goty ? goty.me : 0,
        playerAward: fresh.length
          ? fresh.map(function (a) { return a.title; }).join(' / ')
          : (nom ? nom.title : null),
        playerBrand: goty && goty.won ? goty.meBrand : null,
        playerBrandTitle: goty && goty.won && goty.meBrand ? goty.meTitle : null,
        awards: detail,
        won: fresh.map(function (a) { return a.cat; })
      });
      if (s.yearResults.length > 100) s.yearResults.shift();

      s.yearBest = 0;
      last++;
    }

    s.awardYear = yr;
    var keepFrom = yr - 1;
    s.yearWorks = s.yearWorks.filter(function (w) { return w && w.year >= keepFrom; });
    s.yearRivalReleases = s.yearRivalReleases.filter(function (g) { return g.year >= keepFrom; });
    s.yearBrand = s.yearBrand.filter(function (g) { return g.year >= keepFrom; });
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
    var retired = BAL.retiredTailMult != null ? BAL.retiredTailMult : 0;
    for (var i = 0; i < s.history.length; i++) {
      var h = s.history[i];
      var mult = 1;
      /* 平台退市的作品只剩零星长尾；移植到新平台就恢复 */
      if (h && h.platform) {
        var p = E.platformById(h.platform, s);
        if (p && E.isRetired(s, p)) mult = retired;
      }
      sum += (h.revenue || 0) * BAL.tailPerMonth * mult;
    }
    return sum * E.ruleMul(s, 'tail');
  };

  /* ---------------- 移植 ----------------
   * 把旧作搬到新平台：成本 = 原开发成本 × 25%，
   * 一次买断的销量 = 原销量 × (新装机 / 原装机) × 0.6，
   * 搬过去之后这部作品的长尾在新平台上重新算（平台退市不再扣）。
   * 同一部作品可以搬多次，但不能搬回已经搬过的平台，也不能搬去就快退市的平台。 */

  E.historyPlatformId = function (s, h) {
    if (!h) return null;
    if (h.platform) return h.platform;
    /* 老存档没记平台：按发售年份猜最近上市的那个 */
    var all = GD.PLATFORMS, year = BAL.startYear + Math.floor((h.date ? 0 : 0));
    for (var i = all.length - 1; i >= 0; i--) if (all[i].year <= year + 1972) return all[i].id;
    return GD.PLATFORMS[0].id;
  };

  E.portTargets = function (s, idx) {
    var h = (s.history || [])[idx];
    if (!h) return [];
    var from = E.platformById(h.platform, s);
    var out = [];
    var avail = E.availablePlatforms(s);
    var ports = Array.isArray(h.ports) ? h.ports : [];
    for (var i = 0; i < avail.length; i++) {
      var p = avail[i];
      if (from && p.id === from.id) continue;
      if (ports.indexOf(p.id) >= 0) continue;
      if (E.isRetired(s, p) || E.retiringSoon(s, p)) continue;
      out.push(p);
    }
    return out;
  };

  /* 这部作品现在能不能移植（平台太新就不让搬） */
  E.portBlock = function (s, idx) {
    var h = (s.history || [])[idx];
    if (!h) return 'missing';
    /* 老存档没记平台：不提供移植，避免把几十年前的作品凭空搬过来 */
    if (!h.platform) return 'no-platform';
    var from = E.platformById(h.platform, s);
    if (from && !E.isRetired(s, from) &&
      (E.year(s) - from.year) < (BAL.portMinAge || 4)) return 'too-new';
    var cost = E.portCost(s, idx);
    if (s.money < cost) return 'money';
    if (!E.portTargets(s, idx).length) return 'no-target';
    return null;
  };

  E.portCost = function (s, idx) {
    var h = (s.history || [])[idx];
    if (!h) return 0;
    return Math.round((h.cost || 0) * (BAL.portCostRate || 0.25));
  };

  E.portPreview = function (s, idx, targetId) {
    var h = (s.history || [])[idx];
    if (!h) return null;
    var from = E.platformById(h.platform, s);
    var to = E.platformById(targetId, s);
    if (!to) return null;
    /* 用平台原始装机算比值，不用 effInstall ——
     * 老平台的人气衰减会让比值失真（实测能到 9 倍，等于白捡钱）。 */
    var fromInst = Math.max(0.8, (from && from.install) || 1);
    var toInst = Math.max(0.8, to.install || 1);
    var ratio = Math.max(0.25, Math.min(3, toInst / fromInst));
    var copies = Math.round((h.copies || 0) * ratio * (BAL.portSalesRate || 0.6));
    var price = to.price || 0;
    var revenue = Math.round(copies * price * (BAL.publisherCut + E.ruleDelta(s, 'cut')));
    return {
      copies: copies, revenue: revenue,
      cost: E.portCost(s, idx),
      profit: revenue - E.portCost(s, idx),
      ratio: ratio,
      from: from, to: to
    };
  };

  E.port = function (s, idx, targetId) {
    if (s.phase !== 'planning') return { ok: false, reason: 'phase' };
    var block = E.portBlock(s, idx);
    if (block) return { ok: false, reason: block };
    var targets = E.portTargets(s, idx);
    var ok = false;
    for (var i = 0; i < targets.length; i++) if (targets[i].id === targetId) ok = true;
    if (!ok) return { ok: false, reason: 'bad-target' };

    var pv = E.portPreview(s, idx, targetId);
    var cost = pv.cost;
    if (s.money < cost) return { ok: false, reason: 'money', cost: cost };

    var h = s.history[idx];
    s.money -= cost;
    s.money += pv.revenue;
    s.totalEarned += pv.revenue;
    s.fans += pv.copies * BAL.fanPerCopy * E.traitFansMul(s) * E.bonusMul(s, 'fans');
    if (!Array.isArray(h.ports)) h.ports = [];
    h.ports.push(targetId);
    h.platform = targetId;
    h.ported = (h.ported || 0) + 1;
    return { ok: true, cost: cost, revenue: pv.revenue, copies: pv.copies, to: pv.to, title: E.historyTitle(h) };
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

    /* 破产判定：连续 N 个月付不出钱（现金为负）就清算 */
    if (s.money < 0) s.brokeMonths = (s.brokeMonths || 0) + 1;
    else s.brokeMonths = 0;
    if ((s.brokeMonths || 0) >= BAL.brokeMonthsToFail && s.phase !== 'bankrupt' && s.phase !== 'ending') {
      s.phase = 'bankrupt';
      s.project = null;
      s.review = null;
      s.sales = null;
      s.event = null;
      s.micro = null;
      s.timer = 0;
    }
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
        /* 老存档没有士气/体力：按默认值补，不奖励也不惩罚 */
        m.morale = clampMood(clampNum(x.morale, 0, 100, BAL.moraleStart));
        m.stamina = clampMood(clampNum(x.stamina, 0, 100, BAL.staminaStart));
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
    /* 续作指向的作品必须还在（破产清算/换公司后可能已经对不上） */
    if (s.plan.sequel != null) {
      var sqi = Number(s.plan.sequel);
      if (!(s.history || [])[sqi] || ((s.history[sqi].copies || 0) < BAL.sequelMinCopies)) s.plan.sequel = null;
    }

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
