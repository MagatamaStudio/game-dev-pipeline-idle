/* ============================================================
 * ui.js —— M0 界面
 * ============================================================ */
(function (GD) {
  'use strict';

  var E = GD.Engine;
  var UI = {};
  GD.UI = UI;

  var s = null, hooks = {}, el = {};
  var ui = {
    phase: null, planSig: '', revealed: -1, totalShown: false,
    weekCount: 0, lines: {}, logCount: -1, staffCount: -1, microUid: null, awardCount: 0, yearCount: 0
  };

  function byId(id) { return document.getElementById(id); }
  function esc(v) { return String(v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function num(n) { return Math.round(n).toLocaleString('en-US'); }

  /* ---------------- 像素小人 ---------------- */

  var SKINS = ['#f2c9a0', '#e0ac7e', '#c68a5f', '#8d5a3b'];
  var HAIRS = ['#2b2118', '#4a3222', '#7a4a2a', '#1c1c22', '#8a8a92', '#b06a3a'];
  var SHIRTS = ['#4fc3a1', '#e8b04b', '#d98bd8', '#7fb2ff', '#ff8f6b', '#9b8bff'];

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function avatarSvg(seed) {
    var h = hash(String(seed));
    var skin = SKINS[h % 4];
    var hair = HAIRS[(h >> 3) % 6];
    var shirt = SHIRTS[(h >> 6) % 6];
    var rows = [
      '  hhhh  ',
      ' hhhhhh ',
      ' hffffh ',
      ' ffffff ',
      ' fEffEf ',
      '  ssss  ',
      ' ssssss ',
      ' ss  ss '
    ];
    var rects = '';
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < 8; x++) {
        var ch = rows[y][x];
        var c = ch === 'h' ? hair : ch === 'f' ? skin : ch === 's' ? shirt : ch === 'E' ? '#20202a' : null;
        if (c) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + c + '"/>';
      }
    }
    return '<svg viewBox="0 0 8 8" width="64" height="64" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>';
  }

  function topStats(st) {
    var arr = ['code', 'script', 'art', 'audio'].map(function (k) {
      return { k: k, v: st.stats[k] };
    });
    arr.sort(function (a, b) { return b.v - a.v; });
    return GD.STAT_NAMES[arr[0].k] + ' ' + arr[0].v + ' · ' + GD.STAT_NAMES[arr[1].k] + ' ' + arr[1].v;
  }

  /* ---------------- 挂载 ---------------- */

  UI.mount = function (state, h) {
    s = state; hooks = h || {};
    el.money = byId('money');
    el.fans = byId('fans');
    el.round = byId('round');
    el.platform = byId('platform');
    el.date = byId('date');
    el.desks = byId('desks');
    el.stage = byId('stage');
    el.hint = byId('hint');
    el.review = byId('review');
    el.event = byId('event');
    el.team = byId('team');
    el.archive = byId('archive');
    el.offline = byId('offline');
    el.industry = byId('industry');
    el.sound = byId('sound');
    el.theme = byId('theme');

    var savedTheme = 'light';
    try { savedTheme = localStorage.getItem('garageStudio.theme') || 'light'; } catch (e) { }
    applyTheme(savedTheme);

    buildOffice();
    bind();
    UI.render();
  };

  function applyTheme(t) {
    document.body.setAttribute('data-theme', t);
    if (el.theme) el.theme.textContent = t === 'dark' ? '☀' : '☾';
    try { localStorage.setItem('garageStudio.theme', t); } catch (e) { }
  }

  function buildOffice() {
    el.desks.innerHTML = '';
    s.staff.forEach(function (st) {
      var d = document.createElement('div');
      d.className = 'desk';
      d.setAttribute('data-staff', st.id);
      d.innerHTML =
        '<div class="bubble" hidden></div>' +
        '<div class="desk-body">' +
          '<div class="avatar">' + avatarSvg(st.seed) + '</div>' +
          '<div class="desk-info">' +
            '<div class="desk-name">' + esc(st.name) + ' <span class="lv">Lv ' + st.level + '</span></div>' +
            '<div class="desk-role">' + esc(GD.STAT_NAMES[st.role]) + '</div>' +
            '<div class="desk-stats">' + esc(topStats(st)) + '</div>' +
          '</div>' +
        '</div>';
      el.desks.appendChild(d);
    });
  }

  /* ---------------- 事件绑定 ---------------- */

  function bind() {
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act],[data-plan],[data-choice],[data-mode],[data-micro],[data-hire]');
      if (!t) return;
      GD.SFX.unlock();

      var panelAct = t.getAttribute('data-act');
      var hireId = t.getAttribute('data-hire');

      if (hireId) {
        if (E.hire(s, hireId)) { GD.SFX.coin(); renderTeam(); if (hooks.onSave) hooks.onSave(); UI.render(); }
        else { GD.SFX.bad(); }
        return;
      }
      if (panelAct === 'endless') {
        if (E.continueEndless(s)) { GD.SFX.win(); if (hooks.onSave) hooks.onSave(); }
        return;
      }
      if (panelAct === 'team') { GD.SFX.click(); openTeam(); return; }
      if (panelAct === 'archive') { GD.SFX.click(); openArchive(); return; }
      if (panelAct === 'industry') { GD.SFX.click(); renderIndustry(); el.industry.hidden = false; return; }
      if (panelAct === 'close-panel') {
        GD.SFX.click();
        el.team.hidden = true;
        el.archive.hidden = true;
        el.offline.hidden = true;
        el.industry.hidden = true;
        return;
      }
      if (panelAct === 'expand') {
        if (E.expandOffice(s)) { GD.SFX.coin(); renderTeam(); if (hooks.onSave) hooks.onSave(); }
        else { GD.SFX.bad(); }
        return;
      }
      if (panelAct === 'refresh') {
        if (E.refreshCandidates(s)) { GD.SFX.click(); renderTeam(); if (hooks.onSave) hooks.onSave(); }
        else { GD.SFX.bad(); }
        return;
      }

      var microAttr = t.getAttribute('data-micro');
      if (microAttr != null) {
        if (E.microChoice(s, Number(microAttr))) { GD.SFX.coin(); }
        else { GD.SFX.click(); }
        UI.render();
        return;
      }

      var modeAttr = t.getAttribute('data-mode');
      if (modeAttr) {
        if (E.setMode(s, modeAttr)) { GD.SFX.click(); }
        UI.render();
        return;
      }

      var planAttr = t.getAttribute('data-plan');
      if (planAttr) {
        var parts = planAttr.split(':');
        s.plan[parts[0]] = parts[1];
        GD.SFX.click();
        UI.render();
        return;
      }

      var choice = t.getAttribute('data-choice');
      if (choice != null) {
        if (E.chooseEvent(s, Number(choice))) {
          GD.SFX.click();
          el.event.hidden = true;
          ui.phase = null;
          UI.render();
        }
        return;
      }

      var act = t.getAttribute('data-act');
      if (act === 'go') {
        if (E.startProject(s, s.plan)) { GD.SFX.click(); }
        else { GD.SFX.bad(); el.hint.textContent = '资金不足，先找发行商预支一笔。'; }
      } else if (act === 'next') {
        if (E.nextRound(s)) { GD.SFX.click(); }
      } else if (act === 'ad') {
        if (E.buyAd(s)) { GD.SFX.coin(); }
        else { GD.SFX.bad(); }
      } else if (act === 'rescue') {
        if (E.rescue(s)) { GD.SFX.coin(); el.hint.textContent = '发行商预支了 $200,000。下一部得争气。'; }
      } else if (act === 'skip') {
        if (s.phase === 'review') {
          s.review.revealed = 4;
          s.review.totalShown = true;
          s.phase = 'release';
          GD.SFX.click();
        }
      } else if (act === 'release-now') {
        if (E.confirmRelease(s, 'now')) { GD.SFX.click(); }
      } else if (act === 'release-hold') {
        if (E.confirmRelease(s, 'hold')) { GD.SFX.coin(); }
        else { GD.SFX.bad(); }
      } else if (act === 'theme') {
        applyTheme(document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        GD.SFX.click();
      } else if (act === 'sound') {
        var m = GD.SFX.toggle();
        el.sound.textContent = m ? '🔇' : '🔊';
      }
      UI.render();
    });
  }

  /* ---------------- 渲染 ---------------- */

  UI.render = function () {
    if (!s) return;

    el.money.textContent = money(s.money);
    el.money.classList.toggle('negative', s.money < 0);
    el.fans.textContent = num(s.fans);
    el.round.textContent = String(s.round);
    el.platform.textContent = E.platformLabel(E.platform(s));
    el.date.textContent = E.dateString(s.day);

    if ((s.yearResults || []).length > (ui.yearCount || 0)) {
      var y = s.yearResults[s.yearResults.length - 1];
      ui.yearCount = s.yearResults.length;
      if (!y.winner) {
        UI.toast('🏆 ' + y.year + ' 年度游戏：你（' + y.playerScore + ' 分）');
      } else {
        UI.toast(y.year + ' 年度游戏被 ' + esc(y.winner) + '《' + esc(y.winnerTitle) + '》' + y.winnerScore + ' 分拿走（你 ' + y.playerScore + ' 分）');
      }
    }

    if (ui.staffCount !== s.staff.length) { ui.staffCount = s.staff.length; buildOffice(); }

    if (ui.phase !== s.phase) {
      ui.phase = s.phase;
      buildStage();
    }
    updateStage();
    updateOffice();
  };

  function buildStage() {
    el.review.hidden = true;
    el.event.hidden = true;

    if (s.phase === 'planning') { ui.planSig = ''; buildPlanning(); }
    else if (s.phase === 'developing') buildDeveloping();
    else if (s.phase === 'event') buildEvent();
    else if (s.phase === 'review') buildReview();
    else if (s.phase === 'release') buildRelease();
    else if (s.phase === 'sales') buildSales();
    else if (s.phase === 'done') buildDone();
    else if (s.phase === 'ending') buildEnding();
  }

  function updateStage() {
    if (s.phase === 'planning') {
      var sig = s.plan.genre + '|' + s.plan.theme + '|' + s.plan.leader;
      if (sig !== ui.planSig) { ui.planSig = sig; buildPlanning(); }
    } else if (s.phase === 'developing') {
      var bar = byId('dev-bar');
      if (bar) {
        bar.style.width = (s.project.progress * 100).toFixed(1) + '%';
        byId('dev-pct').textContent = Math.round(s.project.progress * 100) + '%';
        byId('dev-phase').textContent = E.devPhase(s);
        byId('dev-q').textContent = '品质 ' + E.liveQuality(s).toFixed(1);

        var pd = E.projectedReleaseDay(s);
        var w = E.windowAt(pd);
        var nx = E.nextWindow(pd);
        var dateEl = byId('dev-date');
        var winEl = byId('dev-window');
        if (dateEl && winEl) {
          dateEl.textContent = E.dateString(pd).replace(/^\d+ 年 /, '');
          if (w) {
            winEl.textContent = w.name + ' ×' + w.mult.toFixed(2);
            winEl.className = 'tag good';
          } else {
            winEl.textContent = '下个档期：' + nx.win.name + '（还差 ' + Math.round(nx.days) + ' 天）';
            winEl.className = 'tag';
          }
        }

        var btns = document.querySelectorAll('#modes [data-mode]');
        for (var i = 0; i < btns.length; i++) {
          btns[i].classList.toggle('on', btns[i].getAttribute('data-mode') === s.project.mode);
        }

        if (s.project.log.length !== ui.logCount) {
          ui.logCount = s.project.log.length;
          var logEl = byId('devlog');
          if (logEl) {
            logEl.innerHTML = s.project.log.slice(-4).map(function (line) {
              return '<div class="line">' + esc(line) + '</div>';
            }).join('');
          }
        }

        if (s.micro) {
          if (ui.microUid !== s.micro.uid) { ui.microUid = s.micro.uid; renderMicro(); }
          var fill = byId('micro-fill');
          if (fill) fill.style.width = Math.max(0, (s.micro.ttl / GD.BAL.microTtl) * 100) + '%';
        } else if (ui.microUid) {
          ui.microUid = null;
          var mEl = byId('micro');
          if (mEl) mEl.hidden = true;
        }
      }
    } else if (s.phase === 'review') {
      updateReview();
    } else if (s.phase === 'sales') {
      updateSales();
    }
  }

  /* ---------------- 企划 ---------------- */

  function buildPlanning() {
    var p = E.preview(s, s.plan);
    var g = E.genre(s.plan.genre), t = E.theme(s.plan.theme);
    var leader = E.staffById(s, s.plan.leader);

    var html = '<div class="plan">';

    html += '<div class="plan-group"><div class="plan-label">类型</div><div class="chips">';
    GD.GENRES.forEach(function (x) {
      html += '<button class="chip' + (x.id === s.plan.genre ? ' on' : '') + '" data-plan="genre:' + x.id + '">' +
        '<span class="ci">' + x.icon + '</span>' + esc(x.name) + '</button>';
    });
    html += '</div></div>';

    html += '<div class="plan-group"><div class="plan-label">题材</div><div class="chips">';
    GD.THEMES.forEach(function (x) {
      html += '<button class="chip' + (x.id === s.plan.theme ? ' on' : '') + '" data-plan="theme:' + x.id + '">' +
        '<span class="ci">' + x.icon + '</span>' + esc(x.name) + '</button>';
    });
    html += '</div></div>';

    html += '<div class="plan-group"><div class="plan-label">平台</div><div class="chips">';
    E.availablePlatforms(s).forEach(function (x) {
      var pop = E.popMult(x, E.year(s));
      var mark = pop >= 1.1 ? '▲' : pop >= 0.8 ? '●' : '▼';
      html += '<button class="chip' + (x.id === s.plan.platform ? ' on' : '') + '" data-plan="platform:' + x.id + '">' +
        esc(E.platformLabel(x)) +
        '<span class="ci">' + mark + '</span></button>';
    });
    html += '</div></div>';

    html += '<div class="plan-group"><div class="plan-label">主创</div><div class="chips">';
    s.staff.forEach(function (x) {
      html += '<button class="chip' + (x.id === s.plan.leader ? ' on' : '') + '" data-plan="leader:' + x.id + '">' +
        '<span class="ci">' + esc(x.name.charAt(0)) + '</span>' + esc(x.name) + '</button>';
    });
    html += '</div></div>';

    html += '<div class="preview">' +
      '<div class="pv"><label>作品</label><b>' + esc(g.name) + ' · ' + esc(t.name) + '</b></div>' +
      '<div class="pv"><label>相性</label><b class="' + (p.affinity >= 1.2 ? 'good' : p.affinity < 0.95 ? 'bad' : '') + '">×' + p.affinity.toFixed(2) + '</b></div>' +
      '<div class="pv"><label>预计评分</label><b>' + p.scoreLow + ' – ' + p.scoreHigh + ' / 40</b></div>' +
      '<div class="pv"><label>开发耗时</label><b>' + p.duration.toFixed(0) + ' 秒</b></div>' +
      '<div class="pv"><label>成本</label><b>' + money(p.cost) + '</b></div>' +
      '<div class="pv"><label>平台装机</label><b>' + E.effInstall(s, E.platform(s)).toFixed(1) + '</b></div>' +
      '<div class="pv"><label>主创</label><b>' + esc(leader.name) + '</b></div>' +
      '</div>';

    var enough = s.money >= GD.BAL.license;
    html += '<div class="plan-actions">';
    html += '<button class="primary big" data-act="go"' + (enough ? '' : ' disabled') + '>立项开发</button>';
    if (!enough) html += '<button class="ghost" data-act="rescue">找发行商预支 ' + money(GD.BAL.rescue) + '</button>';
    html += '</div>';

    html += '</div>';
    el.stage.innerHTML = html;
    el.hint.textContent = '相性越高，品质越高。换主创也能看出差别——老周写故事，小林做手感，阿雅画画。';
  }

  /* ---------------- 开发 ---------------- */

  function buildDeveloping() {
    var g = E.genre(s.plan.genre), t = E.theme(s.plan.theme);
    el.stage.innerHTML =
      '<div class="dev">' +
      '<div class="dev-head">' +
      '<span class="dev-name">《' + esc(g.name) + ' · ' + esc(t.name) + '》</span>' +
      '<span class="dev-cost">-$' + Math.round(GD.BAL.salaryPerDay * GD.BAL.daysPerSecond).toLocaleString('en-US') + ' / 天</span>' +
      '</div>' +
      '<div class="bar"><i id="dev-bar" style="width:0%"></i></div>' +
      '<div class="dev-meta">' +
      '<span id="dev-phase">原型</span>' +
      '<span id="dev-pct">0%</span>' +
      '<span id="dev-q">品质 —</span>' +
      '</div>' +
      '<div class="dev-forecast">' +
      '<span>预计发售</span><b id="dev-date">—</b>' +
      '<span class="tag" id="dev-window">—</span>' +
      '</div>' +
      '<div class="modes" id="modes">' +
      '<button data-mode="crunch"><b>赶工</b><small>+45% 速度 · −6% 品质</small></button>' +
      '<button data-mode="normal" class="on"><b>正常</b><small>按时交付</small></button>' +
      '<button data-mode="polish"><b>打磨</b><small>−25% 速度 · +7% 品质</small></button>' +
      '</div>' +
      '<div class="micro" id="micro" hidden></div>' +
      '<div class="devlog" id="devlog"></div>' +
      '</div>';
    el.hint.textContent = '每过一天都在烧工资。赶工省钱但伤品质，打磨费钱但做得更好——随时可以切。';
    ui.logCount = -1;
    ui.microUid = null;
  }

  function renderMicro() {
    var box = byId('micro');
    if (!box || !s.micro) return;
    var it = s.micro.item;
    var html = '<div class="micro-text">' + esc(it.text) + '</div><div class="micro-acts">';
    it.options.forEach(function (o, i) {
      html += '<button data-micro="' + i + '"><b>' + esc(o.label) + '</b>' +
        (o.tip ? '<small>' + esc(o.tip) + '</small>' : '') + '</button>';
    });
    html += '</div><div class="micro-timer"><i id="micro-fill"></i></div>';
    box.innerHTML = html;
    box.hidden = false;
  }

  /* ---------------- 团队面板 ---------------- */

  function statLine(stats) {
    return ['code', 'script', 'art', 'audio', 'speed'].map(function (k) {
      return GD.STAT_NAMES[k] + ' ' + stats[k];
    }).join(' · ');
  }

  function xpBar(st) {
    var need = E.xpNeeded(st.level);
    var pct = Math.min(100, (st.xp / need) * 100);
    return '<div class="xp"><i style="width:' + pct.toFixed(1) + '%"></i></div>';
  }

  function openTeam() { renderTeam(); el.team.hidden = false; }

  function renderTeam() {
    var cost = E.expandCost(s);
    var html = '<div class="panel-card">' +
      '<div class="panel-head"><div><h3>团队</h3>' +
      '<div class="panel-sub">' + s.staff.length + ' / ' + s.seats + ' 个工位 · 日薪 ' + money(E.teamSalary(s)) + '</div></div>' +
      '<button class="ghost" data-act="close-panel">关闭</button></div>' +
      '<div class="panel-scroll">';

    html += '<div class="staff-list">';
    s.staff.forEach(function (st) {
      html += '<div class="staff-row">' +
        '<div class="avatar sm">' + avatarSvg(st.seed) + '</div>' +
        '<div class="staff-main">' +
        '<div class="staff-name">' + esc(st.name) +
        ' <span class="lv">Lv ' + st.level + '</span>' +
        ' <span class="role">' + esc(GD.STAT_NAMES[st.role]) + '</span></div>' +
        '<div class="staff-stats">' + esc(statLine(st.stats)) + '</div>' +
        xpBar(st) +
        '</div>' +
        '<div class="staff-salary">' + money(E.effSalary(s, st)) + '<small>/天</small></div>' +
        '</div>';
    });
    html += '</div>';

    if (cost != null) {
      html += '<div class="panel-block">' +
        '<button class="wide" data-act="expand"' + (s.money < cost ? ' disabled' : '') + '>' +
        '扩建到 ' + (s.seats + 1) + ' 个工位 · ' + money(cost) + '</button></div>';
    }

    html += '<div class="panel-block"><div class="block-title">候选人<span class="dim"> · 每部作品后刷新</span></div>';

    if (s.staff.length >= s.seats) {
      html += '<p class="dim">工位满了，先扩建办公室才能招聘。</p>';
    }
    if (!s.candidates.length) {
      html += '<p class="dim">暂时没有合适的人。</p>';
    } else {
      s.candidates.forEach(function (id) {
        var r = E.rosterById(id);
        var fee = r.salary * GD.BAL.hireFeeDays * E.inflation(s);
        var can = s.money >= fee && s.staff.length < s.seats;
        html += '<div class="cand">' +
          '<div class="avatar sm">' + avatarSvg(r.seed) + '</div>' +
          '<div class="staff-main">' +
          '<div class="staff-name">' + esc(r.name) + ' <span class="role">' + esc(GD.STAT_NAMES[r.role]) + '</span></div>' +
          '<div class="staff-stats">' + esc(statLine(r.stats)) + '</div>' +
          '<div class="cand-quote">' + esc(r.quote) + '</div>' +
          '</div>' +
          '<button class="hire" data-hire="' + r.id + '"' + (can ? '' : ' disabled') + '>招聘<small>' + money(fee) + '</small></button>' +
          '</div>';
      });
      html += '<button class="ghost" data-act="refresh"' + (s.money < GD.BAL.refreshCost ? ' disabled' : '') + '>' +
        '换一批 · ' + money(GD.BAL.refreshCost * E.inflation(s)) + '</button>';
    }
    html += '</div>';

    html += '</div></div>';
    el.team.innerHTML = html;
  }

  /* ---------------- 作品集 ---------------- */

  function openArchive() { renderArchive(); el.archive.hidden = false; }

  function renderArchive() {
    var html = '<div class="panel-card">' +
      '<div class="panel-head"><div><h3>作品集</h3>' +
      '<div class="panel-sub">已发行 ' + s.history.length + ' 部</div></div>' +
      '<button class="ghost" data-act="close-panel">关闭</button></div>' +
      '<div class="panel-scroll">';

    if (!s.history.length) {
      html += '<p class="dim">还没有作品。去立项吧。</p>';
    } else {
      html += '<div class="arch-list">';
      s.history.slice().reverse().forEach(function (h) {
        var cls = h.total >= 26 ? 'good' : h.total >= 20 ? '' : 'bad';
        html += '<div class="arch-row">' +
          '<div class="arch-name">' + esc(E.genre(h.genre).name) + ' · ' + esc(E.theme(h.theme).name) + '</div>' +
          '<div class="arch-meta">' + esc(h.date || '') + ' · ' + esc(h.window || '普通档期') + '</div>' +
          '<div class="arch-score ' + cls + '">' + h.total + '</div>' +
          '<div class="arch-sales">' + num(h.copies) + ' 份<br>' + money(h.revenue) + '</div>' +
          '</div>';
      });
      html += '</div>';
    }

    html += '</div></div>';
    el.archive.innerHTML = html;
  }

  /* ---------------- 行业 ---------------- */

  function renderIndustry() {
    var html = '<div class="panel-card">' +
      '<div class="panel-head"><div><h3>行业</h3>' +
      '<div class="panel-sub">' + E.year(s) + ' 年 · 你的年度奖 ' + s.awards.length + ' 次</div></div>' +
      '<button class="ghost" data-act="close-panel">关闭</button></div>' +
      '<div class="panel-scroll">';

    s.rivals.forEach(function (r) {
      var active = E.year(s) >= r.debut;
      var last = r.games[r.games.length - 1];
      var wins = 0;
      for (var i = 0; i < s.yearResults.length; i++) {
        if (s.yearResults[i].winner === r.name) wins++;
      }
      html += '<div class="rival' + (active ? '' : ' off') + '">' +
        '<div class="rival-main">' +
        '<div class="rival-name">' + esc(r.name) + '<span class="role">' + esc(E.genre(r.genre).name) + '</span></div>' +
        '<div class="rival-sub">出道 ' + r.debut + ' · 年度奖 ' + wins + ' 次</div>' +
        '</div>' +
        '<div class="rival-latest">' +
        (last
          ? '<b>' + (active ? last.year + ' 年' : '') + '</b>《' + esc(last.title) + '》<span class="rival-score">' + last.score + '</span>'
          : '<span class="dim">还没出道</span>') +
        '</div>' +
        '</div>';
    });

    html += '<div class="panel-block"><div class="block-title">历年年度游戏</div>';
    if (!s.yearResults.length) {
      html += '<p class="dim">还没有评过奖。</p>';
    } else {
      s.yearResults.slice().reverse().slice(0, 8).forEach(function (y) {
        html += '<div class="year-row"><span>' + y.year + '</span>' +
          (y.winner ? '<b class="dim">' + esc(y.winner) + '《' + esc(y.winnerTitle) + '》</b>' :
            '<b class="good">你《' + esc(y.playerAward || '') + '》') +
          '<span class="mono">' + y.winnerScore + '</span></div>';
      });
    }
    html += '</div>';

    html += '</div></div>';
    el.industry.innerHTML = html;
  }

  /* ---------------- 离线报告 ---------------- */

  function fmtAway(sec) {
    sec = Math.round(sec);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + ' 小时 ' + m + ' 分';
    if (m > 0) return m + ' 分钟';
    return sec + ' 秒';
  }

  UI.showOffline = function (rep) {
    var sign = rep.total >= 0 ? '+' : '−';
    var html = '<div class="panel-card" style="width:min(460px,92vw)">' +
      '<div class="panel-head"><div><h3>你不在的时候</h3>' +
      '<div class="panel-sub">工作室自己运转了一会儿</div></div></div>' +
      '<div class="offline-rows">' +
      '<div class="offline-row"><span>离开时长</span><b>' + fmtAway(rep.seconds) + '</b></div>' +
      '<div class="offline-row"><span>日历前进</span><b>' + rep.days + ' 天</b></div>' +
      (rep.copies > 0
        ? '<div class="offline-row"><span>在售销量</span><b>' + num(rep.copies) + ' 份 · ' + money(rep.revenue) + '</b></div>'
        : '') +
      '<div class="offline-row"><span>长尾收入</span><b>' + money(rep.tail) + '</b></div>' +
      '<div class="offline-row total"><span>合计</span><b class="' + (rep.total >= 0 ? 'good' : 'bad') + '">' + sign + money(Math.abs(rep.total)) + '</b></div>' +
      '</div>' +
      '<button class="primary big" style="width:100%;margin-top:16px" data-act="close-panel">继续经营</button>' +
      '</div>';
    el.offline.innerHTML = html;
    el.offline.hidden = false;
  };

  /* ---------------- 事件 ---------------- */

  function buildEvent() {
    if (!s.event) return;
    var ev = s.event;
    var html = '<div class="modal-card">' +
      '<div class="modal-tag">开发事件 ' + s.project.eventsDone + ' / ' + GD.BAL.eventAts.length + '</div>' +
      '<h3>' + esc(ev.title) + '</h3>' +
      '<p>' + esc(ev.body) + '</p>' +
      '<div class="choices">';
    ev.options.forEach(function (o, i) {
      var disabled = o.cost > s.money;
      html += '<button class="choice" data-choice="' + i + '"' + (disabled ? ' disabled' : '') + '>' +
        '<b>' + esc(o.label) + '</b><small>' + esc(o.tip) + '</small></button>';
    });
    html += '</div></div>';
    el.event.innerHTML = html;
    el.event.hidden = false;
  }

  /* ---------------- 评审 ---------------- */

  function buildReview() {
    ui.revealed = 0;
    ui.totalShown = false;
    ui.lines = {};

    var html = '<div class="review-card">' +
      '<div class="review-title">评 审</div>' +
      '<div class="critics">';
    GD.CRITICS.forEach(function (c, i) {
      html += '<div class="critic" data-i="' + i + '">' +
        '<div class="critic-score">—</div>' +
        '<div class="critic-name">' + esc(c.name) + '</div>' +
        '<div class="critic-tag">' + esc(c.tag) + '</div>' +
        '<div class="critic-line"></div>' +
        '</div>';
    });
    html += '</div>' +
      '<div class="review-total" id="rtotal">—</div>' +
      '<div class="review-acts"><button class="ghost" data-act="skip">跳过</button></div>' +
      '</div>';
    el.review.innerHTML = html;
    el.review.hidden = false;
  }

  function updateReview() {
    if (!s.review) return;

    if (s.review.revealed > ui.revealed) {
      for (var i = ui.revealed; i < s.review.revealed; i++) {
        var card = el.review.querySelector('.critic[data-i="' + i + '"]');
        if (!card) continue;
        var score = s.review.scores[i];
        card.querySelector('.critic-score').textContent = String(score);
        card.classList.add('shown');
        if (score >= 8) card.classList.add('great');
        else if (score <= 4) card.classList.add('poor');

        var band = score >= 8 ? 'high' : score >= 6 ? 'mid' : 'low';
        var pool = GD.CRITICS[i].lines[band];
        var line = pool[(Math.random() * pool.length) | 0];
        card.querySelector('.critic-line').textContent = line;
        GD.SFX.reveal(i);
      }
      ui.revealed = s.review.revealed;
    }

    if (s.review.totalShown && !ui.totalShown) {
      ui.totalShown = true;
      var tEl = byId('rtotal');
      if (tEl) {
        tEl.textContent = s.review.total + ' / 40';
        tEl.classList.add('shown');
        if (s.review.total >= 32) tEl.classList.add('great');
        else if (s.review.total < 20) tEl.classList.add('poor');
      }
      GD.SFX.total(s.review.total);
    }
  }

  /* ---------------- 结局 ---------------- */

  function buildEnding() {
    var r = E.ending(s);
    el.stage.innerHTML =
      '<div class="ending">' +
      '<div class="ending-tag">' + GD.BAL.startYear + ' — ' + GD.BAL.endYear + ' · ' + r.years + ' 年</div>' +
      '<div class="ending-title">' + esc(r.title) + '</div>' +
      '<div class="ending-tone">' + esc(r.tone) + '</div>' +
      '<div class="ending-stats">' +
      '<div class="done-row"><span>发行作品</span><b>' + r.releases + ' 部</b></div>' +
      '<div class="done-row"><span>最高评分</span><b>' + r.best + ' / 40</b></div>' +
      '<div class="done-row"><span>年度奖项</span><b>' + r.awards + ' 次</b></div>' +
      '<div class="done-row"><span>粉丝</span><b>' + num(r.fans) + '</b></div>' +
      '<div class="done-row"><span>累计收入</span><b>' + money(r.earned) + '</b></div>' +
      '</div>' +
      '<button class="primary big" data-act="endless">继续经营</button>' +
      '</div>';
    el.hint.textContent = '主线结束了，但行业还在往前跑。';
  }

  /* ---------------- 发售决策 ---------------- */

  function buildRelease() {
    var o = E.releaseOptions(s);
    var canHold = s.money >= o.hold.cost && o.hold.days > 0;

    var nowCol = E.collisionAt(s, s.day);
    var holdCol = E.collisionAt(s, s.day + Math.round(o.hold.days));
    var nowEst = E.estimateSales(s, o.now.mult * nowCol.mult);
    var holdEst = E.estimateSales(s, o.hold.mult * holdCol.mult);

    function clashLine(c) {
      if (!c.rival) return '<div class="rel-clash none">同期没有对手发售</div>';
      var better = c.mult > 1;
      return '<div class="rel-clash ' + (better ? 'good' : 'bad') + '">' +
        (better ? '你压过了 ' : '撞档：') + esc(c.rival.name) + '《' + esc(c.rival.title) + '》' +
        c.rival.score + ' 分 · 销量 ×' + c.mult.toFixed(2) + '</div>';
    }

    el.stage.innerHTML =
      '<div class="release">' +
      '<div class="rel-head">' +
      '<div class="rel-title">评审结束 · 决定发售日</div>' +
      '<div class="rel-date">今天是 ' + esc(o.date) + '</div>' +
      '</div>' +
      '<div class="rel-options">' +
      '<button class="rel-card" data-act="release-now">' +
      '<div class="rel-name">立即发售</div>' +
      '<div class="rel-win' + (o.now.inWindow ? ' good' : '') + '">' + esc(o.now.name) + ' · ×' + o.now.mult.toFixed(2) + '</div>' +
      '<div class="rel-est">预计 ' + num(nowEst.low) + ' – ' + num(nowEst.high) + ' 份</div>' +
      clashLine(nowCol) +
      '</button>' +
      '<button class="rel-card" data-act="release-hold"' + (canHold ? '' : ' disabled') + '>' +
      '<div class="rel-name">压货到 ' + esc(o.hold.name) + '</div>' +
      '<div class="rel-win good">×' + o.hold.mult.toFixed(2) + ' · 等 ' + Math.round(o.hold.days) + ' 天</div>' +
      '<div class="rel-cost">仓储成本 ' + money(o.hold.cost) + '</div>' +
      '<div class="rel-est">预计 ' + num(holdEst.low) + ' – ' + num(holdEst.high) + ' 份</div>' +
      clashLine(holdCol) +
      '</button>' +
      '</div>' +
      '<div class="rel-hint">压货要付仓储费，还会拖慢下一部；但如果差一档，它可能值回票价。</div>' +
      '</div>';
    el.hint.textContent = '档期对销量影响很大：暑期 ×1.25，年末商战 ×1.40。';
  }

  /* ---------------- 销售 ---------------- */

  function buildSales() {
    ui.weekCount = 0;
    el.stage.innerHTML =
      '<div class="sales">' +
      '<div class="sales-window">' + esc(s.release ? s.release.name : '普通档期') +
      ' · ×' + (s.release ? s.release.mult : 1).toFixed(2) +
      (s.release && s.release.collision ? ' · 撞档 ×' + s.release.collision.mult.toFixed(2) : '') + '</div>' +
      '<div class="sales-head">' +
      '<div class="sales-col"><div class="sales-label">累计销量</div><div class="sales-big" id="copies">0</div></div>' +
      '<div class="sales-col"><div class="sales-label">累计收入</div><div class="sales-big money" id="revenue">$0</div></div>' +
      '</div>' +
      '<div class="weeks" id="weeks"></div>' +
      '<div class="sales-acts"><button class="ad" id="adbtn" data-act="ad">追加广告 ' + money(GD.BAL.adCost) + ' · 下周 +' + Math.round((GD.BAL.adBoost - 1) * 100) + '%</button></div>' +
      '</div>';
    el.hint.textContent = '销量按周结算。前 6 周内可以追加一次广告。';
  }

  function updateSales() {
    if (!s.sales) return;

    var copiesEl = byId('copies');
    if (copiesEl) copiesEl.textContent = num(s.sales.sold);
    var revEl = byId('revenue');
    if (revEl) revEl.textContent = money(s.sales.revenue);

    if (s.sales.index !== ui.weekCount) {
      ui.weekCount = s.sales.index;
      var max = 1;
      s.sales.weeks.forEach(function (w) { if (w.copies > max) max = w.copies; });
      var html = '';
      s.sales.weeks.forEach(function (w) {
        var h = Math.max(6, Math.round(w.copies / max * 100));
        html += '<div class="week"><i style="height:' + h + '%"></i><span>' + w.week + '</span></div>';
      });
      var weeks = byId('weeks');
      if (weeks) weeks.innerHTML = html;
      if (s.sales.index > 0) GD.SFX.week();
    }

    var ad = byId('adbtn');
    if (ad) {
      if (s.sales.adUsed > 0) { ad.textContent = '本期已投过广告'; ad.disabled = true; }
      else if (s.sales.index >= 6) { ad.textContent = '广告窗口已过'; ad.disabled = true; }
      else if (s.money < GD.BAL.adCost) { ad.textContent = '资金不足'; ad.disabled = true; }
    }
  }

  /* ---------------- 收尾 ---------------- */

  function buildDone() {
    var r = s.lastResult;
    if (!r) return;
    var g = E.genre(r.genre), t = E.theme(r.theme);
    var verdict = r.total >= 32 ? '神作' : r.total >= 26 ? '好评' : r.total >= 20 ? '一般' : '扑街';
    var cls = r.total >= 26 ? 'good' : r.total >= 20 ? '' : 'bad';

    el.stage.innerHTML =
      '<div class="done">' +
      '<div class="done-title">《' + esc(g.name) + ' · ' + esc(t.name) + '》</div>' +
      '<div class="done-score ' + cls + '">' + r.total + '<span>/40</span></div>' +
      '<div class="done-row"><span>销量</span><b>' + num(r.copies) + ' 份</b></div>' +
      '<div class="done-row"><span>收入</span><b>' + money(r.revenue) + '</b></div>' +
      '<div class="done-row"><span>成本</span><b>' + money(r.cost || 0) + '</b></div>' +
      '<div class="done-row"><span>利润</span><b class="' + ((r.profit || 0) >= 0 ? 'good' : 'bad') + '">' +
        ((r.profit || 0) >= 0 ? '+' : '−') + money(Math.abs(r.profit || 0)) + '</b></div>' +
      '<div class="done-row"><span>档期</span><b>' + esc(r.window || '普通档期') + ' ×' + (r.windowMult || 1).toFixed(2) + '</b></div>' +
      '<div class="done-row"><span>评价</span><b class="' + cls + '">' + verdict + '</b></div>' +
      (s.lastXp ? '<div class="xp-note">全队 +' + s.lastXp.gain + ' 经验' +
        (s.lastXp.ups.length ? ' · ' + s.lastXp.ups.map(function (x) { return E.staffById(s, x.id).name + ' 升到 Lv' + x.level; }).join('，') : '') +
        '</div>' : '') +
      '<button class="primary big" data-act="next">再来一部</button>' +
      '</div>';
    el.hint.textContent = '换个类型或主创，结果会完全不同。';
  }

  /* ---------------- 办公室 ---------------- */

  function updateOffice() {
    var leaders = document.querySelectorAll('.desk');
    var active = (s.phase === 'developing' || s.phase === 'event') ? s.plan.leader : null;

    for (var i = 0; i < leaders.length; i++) {
      var d = leaders[i];
      var id = d.getAttribute('data-staff');
      var isActive = id === active;
      d.classList.toggle('active', isActive);
      var b = d.querySelector('.bubble');
      if (!b) continue;
      if (isActive) {
        b.hidden = false;
        b.textContent = s.phase === 'event' ? '……' : Math.round(s.project.progress * 100) + '%';
      } else {
        b.hidden = true;
      }
    }
  }

  UI.phaseReset = function () { ui.phase = null; };

})(window.GD = window.GD || {});
