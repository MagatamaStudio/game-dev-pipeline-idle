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
    weekCount: 0, lines: {}, logCount: -1, staffCount: -1, microUid: null, awardCount: 0, yearCount: 0,
    researchCount: 0, bound: false, lastError: '', mpPick: null, bankStep: 1,
  portIdx: null
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
    if (GD.Office && GD.Office.avatarSvg) return GD.Office.avatarSvg(seed);
    /* 极端降级：office.js 没加载时也不能白板 */
    var h = hash(String(seed));
    var rows = ['..hhhh..', '.hhhhhh.', '.hffffh.', '.ffffff.', '.fEffEf.', '..ssss..', '.ssssss.', '.ss..ss.'];
    var rects = '';
    var cols = { h: HAIRS[h % 6], f: SKINS[h % 4], s: SHIRTS[(h >>> 6) % 6], E: '#20202a' };
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < 8; x++) {
        var c = cols[rows[y][x]];
        if (c) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + c + '"/>';
      }
    }
    return '<svg viewBox="0 0 8 8" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>';
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
    /* 读档进来时已经有年度结果，别在首屏补弹一堆过期提示 */
    ui.yearCount = (s.yearResults || []).length;
    ui.researchCount = (s.research && s.research.done) ? s.research.done.length : 0;
    ui.ruleFrom = (E.ruleFor(E.year(s)) || {}).from || 0;
    ui.rulesPaidN = (s.rulesPaid || []).length;
  ui.platSeen = {};
  ui.platSeenInit = 0;
    el.money = byId('money');
    el.fans = byId('fans');
    el.rep = byId('rep');
    el.platform = byId('platform');
    el.date = byId('date');
    el.desks = byId('desks');
    el.scene = byId('office-scene');
    el.stage = byId('stage');
    el.hint = byId('hint');
    el.review = byId('review');
    el.event = byId('event');
    el.team = byId('team');
    el.archive = byId('archive');
    el.offline = byId('offline');
    el.industry = byId('industry');
    el.research = byId('research');
    el.sound = byId('sound');
    el.theme = byId('theme');
    if (el.sound && GD.SFX && GD.SFX.icon) {
      el.sound.textContent = GD.SFX.icon();
      el.sound.title = '音量：' + GD.SFX.label() + '（点击切换）';
    }

    var savedTheme = 'light';
    try { savedTheme = localStorage.getItem('garageStudio.theme') || 'light'; } catch (e) { }
    applyTheme(savedTheme);

    buildOffice();
    if (GD.Office && el.scene) GD.Office.mount(el.scene);
    bind();
    UI.render();
  };

  function applyTheme(t) {
    document.body.setAttribute('data-theme', t);
    if (el.theme) el.theme.textContent = t === 'dark' ? '☀' : '☾';
    if (GD.Office) GD.Office.invalidate();
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
    if (ui.bound) return;      /* 只绑一次：界面初始化失败后重挂载不会重复响应 */
    ui.bound = true;
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act],[data-plan],[data-choice],[data-mode],[data-micro],[data-hire],[data-fire],[data-room],[data-port],[data-portto],[data-custom],[data-dec],[data-research],[data-rtab],[data-gear],[data-poach],[data-acquire],[data-mpick],[data-rebuild],[data-buyback]');
      if (!t) return;
      GD.SFX.unlock();

      var rebuildId = t.getAttribute('data-rebuild');
      if (rebuildId) {
        var nb = E.newCompany(s, rebuildId);
        if (nb && nb.ok) {
          GD.SFX.award();
          UI.toast('🏢 新公司开张：' + nb.declaration.name + ' · 起始资金 ' + money(nb.money) +
            ' · 粉丝 ' + num(nb.fans));
          ui.bankStep = 1;
          ui.phase = null;
          ui.planSig = '';
          if (hooks.onSave) hooks.onSave();
          UI.render();
        } else { GD.SFX.bad(); }
        return;
      }

      var mpick = t.getAttribute('data-mpick');
      if (mpick) {
        var mparts = String(mpick).split(':');
        ui.mpPick = ui.mpPick || { budget: 'normal', price: 'mid', cut: 'normal' };
        ui.mpPick[mparts[0]] = mparts[1];
        GD.SFX.click();
        renderIndustry();
        return;
      }

      var panelAct = t.getAttribute('data-act');
      var hireId = t.getAttribute('data-hire');
      var fireId = t.getAttribute('data-fire');
      var decId = t.getAttribute('data-dec');
      var researchId = t.getAttribute('data-research');
      var rtab = t.getAttribute('data-rtab');
      var gearId = t.getAttribute('data-gear');
      var poachId = t.getAttribute('data-poach');
      var acqId = t.getAttribute('data-acquire');

      var buybackId = t.getAttribute('data-buyback');
      if (buybackId) {
        var bb = E.buyback(s, buybackId);
        if (bb.ok) {
          GD.SFX.award();
          UI.toast('🏷 买回了「' + bb.brand.name + '」，花 ' + money(bb.cost) + '。它重新归到旗下。');
          if (hooks.onSave) hooks.onSave();
          renderIndustry();
          UI.render();
        } else {
          GD.SFX.bad();
          el.hint.textContent = bb.reason === 'poor' ? '钱不够，要 ' + money(bb.cost) + '。'
            : bb.reason === 'not-lost' ? '这家不是从你这儿脱离的子公司。'
              : '现在买不回来。';
        }
        return;
      }

      if (acqId) {
        var ar = E.acquire(s, acqId);
        if (ar.ok) {
          GD.SFX.award();
          UI.toast('🤝 收购了 ' + ar.brand.name + '：粉丝 +' + num(ar.fans) + '，他们以后不再参赛');
          if (hooks.onSave) hooks.onSave();
          renderIndustry();
          UI.render();
        } else {
          GD.SFX.bad();
          UI.toast(ar.reason === 'fans' ? '粉丝太少，对方不卖 —— 需要 ' + num(GD.BAL.acquireFansMin)
            : ar.reason === 'poor' ? '钱不够，需要 ' + money(ar.cost)
              : '现在还不能收购');
        }
        return;
      }

      if (poachId) {
        var parts = String(poachId).split(':');
        var pr = E.poach(s, parts[0], Number(parts[1]));
        if (pr.ok) {
          GD.SFX.poach();
          UI.toast('📥 挖来了 ' + pr.member.name + '（' + GD.STAT_NAMES[pr.member.role] + ' ' +
            pr.member.stats[pr.member.role] + '），签字费 ' + money(pr.cost));
        } else if (pr.reason === 'refused') {
          GD.SFX.poachFail();
          UI.toast('被回绝了：' + pr.member.name + ' 决定留下，违约金 ' +
            money(Math.round(pr.cost * GD.POACH.failKeep)));
        } else if (pr.reason === 'no-seat') {
          GD.SFX.bad();
          UI.toast('没有空工位 —— 先去团队面板扩建办公室');
          return;
        } else if (pr.reason === 'poor') {
          GD.SFX.bad();
          UI.toast('钱不够，挖人需要 ' + money(pr.cost));
          return;
        } else {
          GD.SFX.bad();
          return;
        }
        if (hooks.onSave) hooks.onSave();
        renderIndustry();
        UI.render();
        return;
      }

      if (rtab) {
        GD.SFX.click();
        ui.rTab = rtab;
        ui.researchSig = '';
        renderResearch();
        return;
      }
      if (gearId) {
        if (E.buyGear(s, gearId)) {
          GD.SFX.gear();
          renderResearch();
          if (hooks.onSave) hooks.onSave();
          UI.render();
        } else { GD.SFX.bad(); }
        return;
      }

      var roomKey = t.getAttribute('data-room');
      if (roomKey) {
        var beforeIdx = E.roomIndex(s);
        if (E.expandOffice(s)) {
          GD.SFX.expand();
          if (E.roomIndex(s) > beforeIdx) {
            var newRoom = E.room(s);
            UI.toast('🏢 搬进「' + newRoom.name + '」· ' + newRoom.desc);
          }
          if (!el.research.hidden) renderResearch();
          if (!el.team.hidden) renderTeam();
          if (hooks.onSave) hooks.onSave();
          UI.render();
        } else { GD.SFX.bad(); }
        return;
      }

      /* 移植：先点「移植」展开平台列表，再选目标平台 */
      var portIdxAttr = t.getAttribute('data-port');
      if (portIdxAttr != null) {
        var pi = Number(portIdxAttr);
        ui.portIdx = (ui.portIdx === pi) ? null : pi;
        GD.SFX.click();
        renderArchive();
        return;
      }
      var portToAttr = t.getAttribute('data-portto');
      if (portToAttr) {
        var parts2 = portToAttr.split(':');
        var pr = E.port(s, Number(parts2[0]), parts2[1]);
        if (pr.ok) {
          GD.SFX.coin();
          ui.portIdx = null;
          UI.toast('📦 《' + pr.title + '》移植到 ' + E.platformLabel(pr.to) +
            '：卖 ' + num(pr.copies) + ' 份，进账 ' + money(pr.revenue) +
            '（花了 ' + money(pr.cost) + '）');
          renderArchive();
          if (hooks.onSave) hooks.onSave();
          UI.render();
        } else {
          GD.SFX.bad();
          ui.portIdx = null;
          renderArchive();
          var msg = pr.reason === 'money' ? '钱不够（要 ' + money(pr.cost) + '）。'
            : pr.reason === 'too-new' ? '这部作品还太新，先在原平台放几年。'
              : pr.reason === 'phase' ? '只能在企划阶段移植。'
                : '这个平台不行。';
          el.hint.textContent = msg;
        }
        return;
      }

      if (researchId) {        if (E.startResearch(s, researchId)) {
          GD.SFX.research();
          renderResearch();
          if (hooks.onSave) hooks.onSave();
          UI.render();
        } else { GD.SFX.bad(); }
        return;
      }

      if (decId) {
        if (E.chooseDeclaration(s, decId)) {
          GD.SFX.win();
          if (hooks.onSave) hooks.onSave();
          ui.planSig = '';
          UI.render();
        } else { GD.SFX.bad(); }
        return;
      }

      if (hireId) {
        if (E.hire(s, hireId)) { GD.SFX.hire(); renderTeam(); if (hooks.onSave) hooks.onSave(); UI.render(); }
        else { GD.SFX.bad(); }
        return;
      }
      if (fireId) {
        var fr = E.fireStaff(s, fireId);
        if (fr.ok) {
          GD.SFX.bad();
          UI.toast('👋 ' + fr.name + ' 收拾东西走了，遣散费 ' + money(fr.cost));
          renderTeam();
          if (hooks.onSave) hooks.onSave();
          UI.render();
        } else {
          GD.SFX.bad();
          if (fr.reason === 'money') el.hint.textContent = '遣散费不够（要 ' + money(fr.cost) + '）。';
          else if (fr.reason === 'last') el.hint.textContent = '最后一个人不能解雇，否则没人开工。';
        }
        return;
      }
      if (panelAct === 'endless') {
        if (E.continueEndless(s)) { GD.SFX.win(); if (hooks.onSave) hooks.onSave(); }
        return;
      }
      if (panelAct === 'ngplus') {
        if (E.newGamePlus(s)) {
          GD.SFX.win();
          ui.phase = null; ui.planSig = ''; ui.trendYear = null; ui.nostKey = null;
          UI.render();
          if (hooks.onSave) hooks.onSave();
        } else { GD.SFX.bad(); }
        return;
      }
      if (panelAct === 'team') { GD.SFX.click(); openTeam(); return; }
      if (panelAct === 'archive') { GD.SFX.click(); openArchive(); return; }
      if (panelAct === 'industry') { GD.SFX.click(); renderIndustry(); el.industry.hidden = false; return; }
      if (panelAct === 'rebuild') { GD.SFX.click(); ui.bankStep = 2; buildBankrupt(); return; }
      if (panelAct === 'research') { GD.SFX.click(); renderResearch(); el.research.hidden = false; return; }
      if (panelAct === 'launch-platform') {
        var lp = E.launchPlatform(s, ui.mpPick || { budget: 'normal', price: 'mid', cut: 'normal' });
        if (lp.ok) {
          GD.SFX.researchDone();
          UI.toast('🛰 平台发布：' + lp.mp.name + ' · 装机 ' + lp.mp.install + ' 万，投入 ' + money(lp.cost));
          ui.planSig = '';
          if (hooks.onSave) hooks.onSave();
          renderIndustry();
          UI.render();
        } else {
          GD.SFX.bad();
          UI.toast(lp.reason === 'early' ? '还没到能自研平台的年份'
            : lp.reason === 'poor' ? '钱不够，需要 ' + money(lp.cost)
              : '已经有一个平台了');
        }
        return;
      }
      if (panelAct === 'close-panel') {
        GD.SFX.click();
        el.team.hidden = true;
        el.archive.hidden = true;
        el.offline.hidden = true;
        el.industry.hidden = true;
        el.research.hidden = true;
        return;
      }
      if (panelAct === 'expand') {
        var roomBefore = E.roomIndex(s);
        if (E.expandOffice(s)) {
          GD.SFX.expand(); renderTeam();
          var roomNow = E.room(s);
          if (E.roomIndex(s) > roomBefore) UI.toast('🏢 搬进「' + roomNow.name + '」· ' + roomNow.desc);
          if (hooks.onSave) hooks.onSave();
        } else { GD.SFX.bad(); }
        return;
      }
      /* 自定时代：选卡 / 重抽 / 随机 */
      var customIdx = t.getAttribute('data-custom');
      if (customIdx != null) {
        var cr = E.pickCustomCard(s, Number(customIdx));
        if (cr.ok) {
          GD.SFX.award();
          UI.toast('📜 自定规则生效：' + cr.rule.code + ' ' + cr.rule.name +
            '（' + effText(cr.rule.eff) + '）· 花 ' + cr.cost + ' 影响力');
          renderIndustry();
          if (hooks.onSave) hooks.onSave();
          UI.render();
        } else {
          GD.SFX.bad();
          el.hint.textContent = '影响力不够（要 ' + GD.CUSTOM.pickCost + '）。多出几部高分作品。';
        }
        return;
      }
      if (panelAct === 'custom-reroll') {
        var rr = E.rerollCustomCards(s);
        if (rr.ok) {
          GD.SFX.click();
          renderIndustry();
          if (hooks.onSave) hooks.onSave();
        } else { GD.SFX.bad(); }
        return;
      }
      if (panelAct === 'custom-random') {
        var rnd = E.randomCustomCard(s);
        if (rnd.ok) {
          if (rnd.paradigm) {
            GD.SFX.award();
            UI.toast('🌌 范式跃迁！一次拿到两条规则：' +
              rnd.rules.map(function (x) { return x.code + ' ' + x.name; }).join(' + '));
          } else {
            GD.SFX.click();
            UI.toast('🎲 随机到：' + rnd.rules[0].code + ' ' + rnd.rules[0].name +
              '（' + effText(rnd.rules[0].eff) + '）');
          }
          renderIndustry();
          if (hooks.onSave) hooks.onSave();
          UI.render();
        } else { GD.SFX.bad(); }
        return;
      }
      if (panelAct === 'teambuild') {
        if (E.teamBuild(s)) {
          GD.SFX.coin();
          UI.toast('🍻 团建了一次：全员士气 +' + GD.BAL.teamBuildMorale + '、体力 +10');
          renderTeam();
          if (hooks.onSave) hooks.onSave();
        } else { GD.SFX.bad(); }
        return;
      }
      if (panelAct === 'refresh') {
        if (E.refreshCandidates(s)) { GD.SFX.click(); renderTeam(); if (hooks.onSave) hooks.onSave(); }
        else { GD.SFX.bad(); }
        return;
      }

      var microAttr = t.getAttribute('data-micro');
      if (microAttr != null) {
        if (E.microChoice(s, Number(microAttr))) { GD.SFX.microPick(); }
        else { GD.SFX.click(); }
        UI.render();
        return;
      }

      var modeAttr = t.getAttribute('data-mode');
      if (modeAttr) {
        if (E.setMode(s, modeAttr)) { GD.SFX.mode(); }
        UI.render();
        return;
      }

      var planAttr = t.getAttribute('data-plan');
      if (planAttr) {
        var parts = planAttr.split(':');
        s.plan[parts[0]] = parts[1];
        /* 选续作：自动切回原作的类型与题材 */
        if (parts[0] === 'sequel' && parts[1] !== '') {
          var origH = s.history[Number(parts[1])];
          if (origH) { s.plan.genre = origH.genre; s.plan.theme = origH.theme; }
        }
        /* 换类型/题材就不再是那部续作了 */
        if (parts[0] === 'genre' || parts[0] === 'theme') s.plan.sequel = null;
        /* 换类型后原来选的题材可能没解锁，落到该类型里相性最高的已解锁题材 */
        if (parts[0] === 'genre') E.ensurePlanCombo(s);
        GD.SFX.click();
        UI.render();
        return;
      }

      var choice = t.getAttribute('data-choice');
      if (choice != null) {
        if (E.chooseEvent(s, Number(choice))) {
          GD.SFX.eventPick();
          el.event.hidden = true;
          ui.phase = null;
          UI.render();
        }
        return;
      }

      var act = t.getAttribute('data-act');
      if (act === 'go') {
        if (E.startProject(s, s.plan)) { GD.SFX.startProject(); }
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
      } else if (act === 'random-name') {
        if (s.phase === 'planning') {
          s.plan.name = E.randomGameName();
          var nameInput = byId('plan-name');
          if (nameInput) { nameInput.value = s.plan.name; nameInput.focus(); }
          GD.SFX.click();
        }
      } else if (act === 'theme') {
        applyTheme(document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        GD.SFX.click();
      } else if (act === 'sound') {
        var st = GD.SFX.cycle();
        el.sound.textContent = st.icon;
        el.sound.title = '音量：' + st.label + '（点击切换）';
        if (!st.muted) GD.SFX.click();
      }
      UI.render();
    });

    /* 作品名输入：不重建界面，避免打字时输入框失焦 */
    document.addEventListener('input', function (ev) {
      if (!ev.target || ev.target.id !== 'plan-name') return;
      if (!s || !s.plan) return;
      s.plan.name = String(ev.target.value || '').slice(0, 18);
    });
  }

  /* ---------------- 渲染 ---------------- */

  UI.render = function () {
    if (!s) return;

    el.money.textContent = money(s.money);
    el.money.classList.toggle('negative', s.money < 0);
    el.fans.textContent = num(s.fans);
    el.rep.textContent = String(Math.round(s.rep || 0));
    el.platform.textContent = E.platformLabel(E.platform(s));
    el.date.textContent = E.dateString(s.day);

    if ((s.yearResults || []).length > (ui.yearCount || 0)) {
      var y = s.yearResults[s.yearResults.length - 1];
      ui.yearCount = s.yearResults.length;
      /* 一年可能拿好几个奖：年度游戏之外还有类型奖和单项奖 */
      var wonIds = Array.isArray(y.won) ? y.won : (y.playerAward ? [] : []);
      var shortOf = function (id) {
        for (var ci = 0; ci < GD.AWARD_CATS.length; ci++) {
          if (GD.AWARD_CATS[ci].id === id) return GD.AWARD_CATS[ci].short;
        }
        return id;
      };
      var gotyWon = wonIds.indexOf('goty') >= 0;
      var others = wonIds.filter(function (id) { return id !== 'goty'; }).map(shortOf);
      var tail = others.length ? '　另夺 ' + others.join(' / ') : '';
      if (!y.winner) {
        UI.toast('🏆 ' + y.year + ' 年度游戏：' +
          (y.playerBrand ? '子品牌 ' + esc(y.playerBrand) + '《' + esc(y.playerBrandTitle) + '》' : '你') +
          '（' + y.playerScore + ' 分）' + tail);
        GD.SFX.award();
      } else {
        UI.toast(y.year + ' 年度游戏被 ' + esc(y.winner) + '《' + esc(y.winnerTitle) + '》' + y.winnerScore +
          ' 分拿走（你 ' + y.playerScore + ' 分）' +
          (others.length ? '　你拿到 ' + others.join(' / ') : (gotyWon ? '' : '')));
        GD.SFX.awardLose();
      }
    }

    if (ui.staffCount !== s.staff.length) { ui.staffCount = s.staff.length; buildOffice(); }

    if (ui.phase !== s.phase) {
      ui.phase = s.phase;
      buildStage();
    }
    updateStage();
    updateOffice();

    /* 研发完成提示 + 面板进度自刷新 */
    var rdone = (s.research && s.research.done) ? s.research.done.length : 0;
    if (rdone > (ui.researchCount || 0)) {
      ui.researchCount = rdone;
      var lastIt = E.researchById(s.research.done[rdone - 1]);
      if (lastIt) {
        UI.toast('🔬 研究完成：' + lastIt.name + ' · ' + lastIt.desc);
        GD.SFX.researchDone();
      }
    } else if (rdone < (ui.researchCount || 0)) {
      ui.researchCount = rdone;
    }
    if (el.research && !el.research.hidden) {
      var act = E.researchActive(s);
      var sig = (act ? act.id : '') + '|' + Math.floor(E.researchProgress(s) * 20);
      if (ui.researchSig !== sig) { ui.researchSig = sig; renderResearch(); }
    }

    if (GD.SFX && GD.SFX.setEra) GD.SFX.setEra(E.year(s));

    /* 世代规则：进入新世代弹提示；带一次性投入的付完也弹一次 */
    var era = E.ruleFor(E.year(s));
    if (era && ui.ruleFrom !== era.from) {
      ui.ruleFrom = era.from;
      UI.toast('🌐 ' + era.from + ' 世代 · ' + era.name + '：' + era.desc + '（要学的是：' + era.learn + '）');
      GD.SFX.award();
    }
    var paidN = (s.rulesPaid || []).length;
    if (paidN > (ui.rulesPaidN || 0)) {
      ui.rulesPaidN = paidN;
      UI.toast('🏗 为了 ' + (era ? era.name : '新世代') + ' 投了一笔重资产，钱已经花了。');
    } else if (paidN < (ui.rulesPaidN || 0)) {
      ui.rulesPaidN = paidN;
    }

    /* 自定时代：新一代开始时提示一次（选卡在行业面板里） */
    var ceFrom = E.customPendingFrom(s);
    if (ceFrom != null && ui.customFrom !== ceFrom) {
      ui.customFrom = ceFrom;
      UI.toast('📜 ' + ceFrom + ' 年，自定时代开始了 —— 去行业面板用影响力定一条新规则。');
      GD.SFX.award();
    } else if (ceFrom == null) {
      ui.customFrom = null;
    }

    /* 组合收藏：新解锁 / 王牌达成 */
    var news = E.drainComboNews(s);
    for (var ni = 0; ni < news.length; ni++) {
      var it = news[ni];
      var gn = E.genre(it.genre).name, tn = E.theme(it.theme).name;
      if (it.type === 'found') {
        UI.toast('★ 王牌组合达成：' + gn + ' × ' + tn + '（×' + it.aff.toFixed(2) + '）');
        GD.SFX.award();
      } else {
        UI.toast('🧩 解锁组合：' + gn + ' × ' + tn + '（×' + it.aff.toFixed(2) + ' · ' +
          E.comboCount(s) + '/100）');
        GD.SFX.click();
      }
    }
    if (news.length && el.archive && !el.archive.hidden) renderArchive();

    /* 市场流行：换年时提示一次 */
    var tYear = E.trendFor(E.year(s)).year;
    if (ui.trendYear !== tYear) {
      if (ui.trendYear != null) {
        var tr = E.trendFor(tYear);
        UI.toast('📈 ' + tYear + ' 年热门：' + E.trendText(tYear) + '（题材销量 ×' +
          GD.BAL.trendThemeSales.toFixed(2) + '）· ' + E.genre(tr.genre).name +
          '（×' + GD.BAL.trendGenreSales.toFixed(2) + '）');
      }
      ui.trendYear = tYear;
    }

    /* 怀旧潮开始时提示一次 */
    var nost = E.nostalgiaFor(E.year(s));
    var nostKey = nost ? nost.from : null;
    if (ui.nostKey !== undefined && ui.nostKey !== nostKey && nost) {
      UI.toast('🕰 怀旧潮：' + E.genre(nost.genre).name + ' 突然又流行了（销量 ×' +
        nost.mult.toFixed(2) + '，到 ' + nost.to + ' 年）');
      GD.SFX.award();
    }
    ui.nostKey = nostKey;

    /* 平台退市 / 快退市提示（每条只弹一次；读档进来不补弹历史） */
    if (!ui.platSeen) ui.platSeen = {};
    var curYear = E.year(s);
    GD.PLATFORMS.forEach(function (p) {
      if (!p.retire) return;
      var goneKey = 'g:' + p.id, warnKey = 'w:' + p.id;
      if (curYear > p.retire) {
        if (!ui.platSeen[goneKey]) {
          ui.platSeen[goneKey] = 1;
          if (ui.platSeenInit) {
            UI.toast('📉 ' + E.platformLabel(p) + ' 退市了 —— 上面的作品长尾只剩零星，' +
              '去作品集把它们移植到新平台。');
            GD.SFX.bad();
            if (el.archive && !el.archive.hidden) renderArchive();
          }
        }
      } else if (curYear >= p.retire - (GD.BAL.platformWarnYears || 2)) {
        if (!ui.platSeen[warnKey]) {
          ui.platSeen[warnKey] = 1;
          if (ui.platSeenInit) {
            UI.toast('⚠ ' + E.platformLabel(p) + ' 将在 ' + p.retire + ' 年退市。');
          }
        }
      }
    });
    ui.platSeenInit = 1;

    applyError();
    if (GD.Office) GD.Office.sync(s);
  };

  /* ---------------- 错误显示 ----------------
   * 主循环出异常时把原因固定显示在底部提示条上，
   * 否则下一次 buildStage 会把它覆盖掉，用户什么也看不到。 */

  function applyError() {
    if (!el.hint) return;
    if (ui.lastError) {
      el.hint.classList.add('err');
      el.hint.textContent = '⚠ ' + ui.lastError;
    } else if (el.hint.classList.contains('err')) {
      el.hint.classList.remove('err');
    }
  }

  UI.showError = function (text) {
    ui.lastError = text || '';
    applyError();
  };

  /* ---------------- 浮层提示 ----------------
   * 年度奖项、研发完成这类「不需要打断操作」的消息走这里。
   * 之前 UI.toast 被调用但根本没实现，一结算年度奖项就抛异常把主循环打死。 */

  UI.toast = function (text) {
    var box = byId('toasts');
    if (!box || !text) return;
    var node = document.createElement('div');
    node.className = 'toast';
    node.textContent = String(text);
    box.appendChild(node);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    window.setTimeout(function () {
      node.classList.add('out');
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 400);
    }, 4200);
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
    else if (s.phase === 'ending') { GD.SFX.ending(); buildEnding(); }
    else if (s.phase === 'bankrupt') { ui.bankStep = 1; buildBankrupt(); }
  }

  function updateStage() {
    if (s.phase === 'planning') {
      /* 老存档 / 换类型后题材可能还锁着，先纠正再算签名，避免多重建一帧 */
      E.ensurePlanCombo(s);
      /* 选中的平台可能已经退市了，换到最新可用平台 */
      E.ensurePlanPlatform(s);
      /* 平台必须进签名：否则换平台不会重建企划界面，要再点别的按钮才生效 */
      var sig = s.plan.genre + '|' + s.plan.theme + '|' + s.plan.leader + '|' + s.plan.platform +
        '|' + (s.plan.sequel == null ? '' : s.plan.sequel) + '|' + (s.plan.coop || '') + '|' + E.year(s);
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

  /* 创业宣言：只在全新一局的最开始出现一次 */
  function buildDeclaration() {
    var html = '<div class="declare">' +
      '<div class="declare-title">创业宣言</div>' +
      '<div class="declare-sub">只生效一次。选一个，然后就开始吧。</div>' +
      '<div class="declare-list">';
    GD.DECLARATIONS.forEach(function (d) {
      html += '<button class="dec" data-dec="' + d.id + '">' +
        '<b>' + esc(d.name) + '</b>' +
        '<span class="dec-desc">' + esc(d.desc) + '</span>' +
        '<span class="dec-tip">' + esc(d.tip) + '</span>' +
        '</button>';
    });
    html += '</div></div>';
    el.stage.innerHTML = html;
    el.hint.textContent = '创业宣言只在开局生效一次，之后不会再出现。';
  }

  function buildPlanning() {
    if (E.needDeclaration(s)) { buildDeclaration(); return; }
    var p = E.preview(s, s.plan);
    var g = E.genre(s.plan.genre), t = E.theme(s.plan.theme);
    var leader = E.staffById(s, s.plan.leader);

    var html = '<div class="plan">';

    /* 今年什么卖得动 */
    var trend = E.trendFor(E.year(s));
    var trNames = trend.themes.map(function (id) { return E.theme(id).name; }).join(' / ');
    html += '<div class="trend-bar">' +
      '<span class="trend-k">今年热门</span>' +
      '<b>' + esc(trNames) + '</b>' +
      '<span class="dim">题材 · 销量 ×' + GD.BAL.trendThemeSales.toFixed(2) + '</span>' +
      '<span class="trend-dot">·</span>' +
      '<b>' + esc(E.genre(trend.genre).name) + '</b>' +
      '<span class="dim">类型 · 销量 ×' + GD.BAL.trendGenreSales.toFixed(2) + '</span>' +
      '</div>';

    /* 怀旧潮 */
    var nost = E.nostalgiaFor(E.year(s));
    if (nost) {
      html += '<div class="nost-bar">🕰 怀旧潮 · ' + esc(E.genre(nost.genre).name) +
        ' <b>×' + nost.mult.toFixed(2) + '</b>' +
        '<span class="dim">' + nost.from + '–' + nost.to + ' 年，老类型整年好卖</span></div>';
    }

    /* NG+ 标记 */
    if ((s.ng || 0) > 0) {
      html += '<div class="ng-bar">NG+ 第 ' + s.ng + ' 轮 · 日历 ×' + GD.BAL.ngTimeSpeed +
        ' · 每部解锁 ' + (2 + GD.BAL.ngComboBonus) + ' 格 · 收藏 ' + E.comboCount(s) + ' / 100</div>';
    }

    html += '<div class="plan-group"><div class="plan-label">类型</div><div class="chips">';
    GD.GENRES.forEach(function (x) {
      var hot = E.trendIsHotGenre(E.year(s), x.id);
      html += '<button class="chip' + (x.id === s.plan.genre ? ' on' : '') + (hot ? ' hot' : '') +
        '" data-plan="genre:' + x.id + '">' +
        '<span class="ci">' + x.icon + '</span>' + esc(x.name) +
        (hot ? '<span class="hot-tag">热</span>' : '') + '</button>';
    });
    html += '</div></div>';

    html += '<div class="plan-group"><div class="plan-label">题材' +
      '<span class="plan-label-hint">已解锁 ' + E.comboThemes(s, s.plan.genre).length + ' / ' + GD.THEMES.length + '</span>' +
      '</div><div class="chips">';
    GD.THEMES.forEach(function (x) {
      var open = E.comboUnlocked(s, s.plan.genre, x.id);
      var hot = E.trendIsHotTheme(E.year(s), x.id);
      var cls = 'chip' + (x.id === s.plan.theme ? ' on' : '') + (open ? '' : ' lock') + (hot ? ' hot' : '');
      var tip = open ? (hot ? '今年热门题材：销量 ×' + GD.BAL.trendThemeSales.toFixed(2) : '') : '还没解锁：多开发几部作品、完成研究或收购对手';
      html += '<button class="' + cls + '"' + (tip ? ' title="' + esc(tip) + '"' : '') + (open ? '' : ' disabled') +
        ' data-plan="theme:' + x.id + '">' +
        '<span class="ci">' + (open ? x.icon : '🔒') + '</span>' + esc(x.name) +
        (hot && open ? '<span class="hot-tag">热</span>' : '') + '</button>';
    });
    html += '</div></div>';

    /* 续作：销量够高的旧作可以接着做（会自动切回原作的类型与题材） */
    var seqs = E.sequelCandidates(s);
    if (seqs.length) {
      html += '<div class="plan-group"><div class="plan-label">续作' +
        '<span class="plan-label-hint">销量 ≥ ' + num(GD.BAL.sequelMinCopies) + ' 才能出</span></div>' +
        '<div class="chips">';
      html += '<button class="chip' + (s.plan.sequel == null || s.plan.sequel === '' ? ' on' : '') +
        '" data-plan="sequel:">新作</button>';
      seqs.forEach(function (q) {
        html += '<button class="chip' + (String(s.plan.sequel) === String(q.index) ? ' on' : '') +
          '" data-plan="sequel:' + q.index + '">' + esc(q.seriesTitle) + ' ' + q.seq +
          '<span class="ci">' + num(q.copies) + '</span></button>';
      });
      html += '</div></div>';
    }

    var seqPlan = E.planSequel(s);
    var placeholder = seqPlan
      ? seqPlan.seriesTitle + ' ' + seqPlan.seq
      : g.name + '·' + t.name;

    html += '<div class="plan-group"><div class="plan-label">作品名<span class="plan-label-hint">可以不填</span></div>' +
      '<div class="name-row">' +
      '<input class="plan-name" id="plan-name" maxlength="18" autocomplete="off" spellcheck="false" ' +
      'placeholder="' + esc(placeholder) + '" value="' + esc(s.plan.name || '') + '">' +
      '<button class="ghost tiny" data-act="random-name">随机</button>' +
      '</div></div>';

    html += '<div class="plan-group"><div class="plan-label">平台</div><div class="chips">';
    E.availablePlatforms(s).forEach(function (x) {
      var pop = E.popMult(x, E.year(s));
      var mark = pop >= 1.1 ? '▲' : pop >= 0.8 ? '●' : '▼';
      var dying = E.retiringSoon(s, x);
      html += '<button class="chip' + (x.id === s.plan.platform ? ' on' : '') + (dying ? ' dying' : '') +
        '" data-plan="platform:' + x.id + '"' +
        (dying ? ' title="' + esc(x.retire + ' 年退市，之后不能再立项') + '"' : '') + '>' +
        esc(E.platformLabel(x)) +
        '<span class="ci">' + mark + '</span>' +
        (dying ? '<span class="hot-tag dying-tag">' + x.retire + ' 退市</span>' : '') + '</button>';
    });
    html += '</div></div>';

    html += '<div class="plan-group"><div class="plan-label">主创</div><div class="chips">';
    s.staff.forEach(function (x) {
      html += '<button class="chip' + (x.id === s.plan.leader ? ' on' : '') + '" data-plan="leader:' + x.id + '">' +
        '<span class="ci">' + esc(x.name.charAt(0)) + '</span>' + esc(x.name) + '</button>';
    });
    html += '</div></div>';

    /* 联合开发：找一家对手一起做 */
    var coopList = E.coopOptions(s);
    if (coopList.length) {
      html += '<div class="plan-group"><div class="plan-label">联合开发' +
        '<span class="plan-label-hint">对方分担 40% 成本 · 分走 ' +
        Math.round(GD.BAL.coopRevenueShare * 100) + '% 收入</span></div><div class="chips">';
      html += '<button class="chip' + (!s.plan.coop ? ' on' : '') + '" data-plan="coop:">自己扛</button>';
      coopList.forEach(function (r) {
        var ci = E.coopInfo(s, r, s.plan.genre);
        html += '<button class="chip' + (s.plan.coop === r.id ? ' on' : '') +
          (ci.match ? ' hot' : '') + '" data-plan="coop:' + r.id + '">' + esc(r.name) +
          '<span class="ci">' + esc(E.genre(r.genre).name) + (ci.match ? ' 对口' : '') + '</span></button>';
      });
      html += '</div></div>';
    }

    html += '<div class="preview">' +
      '<div class="pv"><label>作品</label><b>' + esc(g.name) + ' · ' + esc(t.name) + '</b></div>' +
      (p.sequel
        ? '<div class="pv"><label>续作</label><b class="good">' + esc(p.sequel.title) + ' 第 ' + p.sequel.seq + ' 作 · 销量 ×' +
          GD.BAL.sequelSales.toFixed(2) + '</b></div>'
        : '') +
      '<div class="pv"><label>相性</label><b class="' + (p.affinity >= 1.2 ? 'good' : p.affinity < 0.95 ? 'bad' : '') + '">×' + p.affinity.toFixed(2) + '</b></div>' +
      '<div class="pv"><label>趋势</label><b class="' + (p.trend > 1 ? 'good' : '') + '">×' + p.trend.toFixed(2) + '</b></div>' +
      '<div class="pv"><label>预计评分</label><b>' + p.scoreLow + ' – ' + p.scoreHigh + ' / 40</b></div>' +
      '<div class="pv"><label>开发耗时</label><b>' + p.duration.toFixed(0) + ' 秒</b></div>' +
      '<div class="pv"><label>成本</label><b>' + money(p.cost) + '</b></div>' +
      '<div class="pv"><label>平台装机</label><b>' + E.effInstall(s, E.platform(s)).toFixed(1) + '</b></div>' +
      '<div class="pv"><label>主创</label><b>' + esc(leader.name) + '</b></div>' +
      (p.coop
        ? '<div class="pv"><label>联合开发</label><b class="good">' + esc(p.coop.name) +
          '（品质 ×' + p.coop.qualityMul.toFixed(2) + ' · 销量 ×' + p.coop.salesMul.toFixed(2) +
          ' · 分成 ' + Math.round(p.coop.share * 100) + '%）</b></div>'
        : '') +
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
    /* 每秒烧掉的钱 = 日薪总和 × 每秒天数 × 制作倍率
     * （老代码用的是 GD.BAL.salaryPerDay，这个字段根本不存在，所以一直显示 -$NaN） */
    var burn = E.teamSalary(s) * GD.BAL.daysPerSecond * E.prodMult(s);
    if (!isFinite(burn)) burn = 0;
    el.stage.innerHTML =
      '<div class="dev">' +
      '<div class="dev-head">' +
      '<span class="dev-name">《' + esc(E.gameName(s)) + '》</span>' +
      '<span class="dev-cost">-$' + Math.round(burn).toLocaleString('en-US') + ' / 秒</span>' +
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
    GD.SFX.microAppear();
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

  function traitChips(st) {
    var list = E.traitList(st);
    if (!list || !list.length) return '';
    return '<div class="traits">' + list.map(function (t) {
      return '<span class="trait" title="' + esc(t.desc) + '">' + esc(t.name) + '</span>';
    }).join('') + '</div>';
  }

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
    var room = E.room(s);
    var next = E.nextRoom(s);
    var html = '<div class="panel-card">' +
      '<div class="panel-head"><div><h3>团队</h3>' +
      '<div class="panel-sub">' + esc(room.name) + ' · ' + s.staff.length + ' / ' + s.seats +
      ' 个工位 · 日薪 ' + money(E.teamSalary(s)) + ' · 声望 ' + Math.round(s.rep || 0) + '</div></div>' +
      '<button class="ghost" data-act="close-panel">关闭</button></div>' +
      '<div class="panel-scroll">';

    /* 当前办公室 */
    html += '<div class="room-card">' +
      '<div class="room-head"><b>' + esc(room.name) + '</b>' +
      '<span class="dim">' + esc(room.sub) + ' · ' + s.seats + ' 个工位</span></div>' +
      '<div class="room-desc">' + esc(room.desc) + '</div>' +
      '</div>';

    html += '<div class="staff-list">';
    s.staff.forEach(function (st) {
      var mo = Math.round(E.moraleOf(st)), stm = Math.round(E.staminaOf(st));
      var mood = E.moodLabel(st);
      html += '<div class="staff-row">' +
        '<div class="avatar sm">' + avatarSvg(st.seed) + '</div>' +
        '<div class="staff-main">' +
        '<div class="staff-name">' + esc(st.name) +
        ' <span class="lv">Lv ' + st.level + '</span>' +
        ' <span class="role">' + esc(GD.STAT_NAMES[st.role]) + '</span>' +
        ' <span class="mood-tag' + (mood === '正常' ? '' : ' low') + '">' + mood + '</span></div>' +
        '<div class="staff-stats">' + esc(statLine(st.stats)) + '</div>' +
        '<div class="moods">' +
        '<span class="mood-line"><label>士气</label><i class="mood-bar"><b style="width:' + mo + '%"></b></i><em>' + mo + '</em></span>' +
        '<span class="mood-line"><label>体力</label><i class="mood-bar stam"><b style="width:' + stm + '%"></b></i><em>' + stm + '</em></span>' +
        '</div>' +
        traitChips(st) +
        xpBar(st) +
        '</div>' +
        '<div class="staff-side">' +
        '<div class="staff-salary">' + money(E.effSalary(s, st)) + '<small>/天</small></div>' +
        (s.staff.length > 1
          ? '<button class="ghost tiny fire" data-fire="' + st.id + '" title="遣散费 ' +
            money(E.fireCost(s, st)) + '">解雇</button>'
          : '') +
        '</div>' +
        '</div>';
    });
    html += '</div>';

    /* 团建 */
    var tbCost = E.teamBuildCost(s);
    var canTB = s.builtRound !== s.round && s.money >= tbCost;
    html += '<div class="panel-block"><div class="block-title">团建' +
      '<span class="dim"> · 每部作品一次</span></div>' +
      '<div class="room-next"><span class="dim">全员士气 +' + GD.BAL.teamBuildMorale +
      '、体力 +10。连着赶工会掉状态，别等到全员疲劳再想起来。</span></div>' +
      '<button class="wide" data-act="teambuild"' + (canTB ? '' : ' disabled') + '>' +
      (s.builtRound === s.round ? '这轮已经聚过餐了' : '团建 · ' + money(tbCost)) + '</button></div>';

    if (cost != null && next) {
      html += '<div class="panel-block"><div class="block-title">搬办公室</div>' +
        '<div class="room-next"><b>搬到「' + esc(next.name) + '」</b>' +
        '<span class="dim">' + next.seats + ' 个工位 · ' + esc(next.desc) + '</span></div>' +
        '<button class="wide" data-act="expand"' + (s.money < cost ? ' disabled' : '') + '>' +
        '搬家 · ' + money(cost) + '</button></div>';
    } else if (E.roomIndex(s) < (GD.ROOMS || []).length - 1) {
      html += '<div class="panel-block"><p class="dim">受创业宣言限制，这栋楼最多就 ' +
        s.seats + ' 个工位。</p></div>';
    } else {
      html += '<div class="panel-block"><p class="dim">已经是最大的一栋楼了。</p></div>';
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
        var fee = E.hireFee(s, r);
        var can = s.money >= fee && s.staff.length < s.seats;
        html += '<div class="cand">' +
          '<div class="avatar sm">' + avatarSvg(r.seed) + '</div>' +
          '<div class="staff-main">' +
          '<div class="staff-name">' + esc(r.name) + ' <span class="role">' + esc(GD.STAT_NAMES[r.role]) + '</span></div>' +
          '<div class="staff-stats">' + esc(statLine(r.stats)) + '</div>' +
          traitChips(r) +
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

  /* 作品集里一行的「移植」格子：能搬就给按钮，展开后选平台 */
  function portCell(idx) {
    var h = s.history[idx];
    if (!h) return '<div class="arch-port"></div>';
    if (ui.portIdx === idx) {
      var targets = E.portTargets(s, idx);
      var body = '';
      targets.forEach(function (p) {
        var pv = E.portPreview(s, idx, p.id);
        body += '<button class="port-opt" data-portto="' + idx + ':' + p.id + '"' +
          (s.money < pv.cost ? ' disabled' : '') + '>' +
          esc(E.platformLabel(p)) +
          '<small>' + money(pv.cost) + ' → ' + num(pv.copies) + ' 份 · ' + money(pv.revenue) + '</small></button>';
      });
      return '<div class="arch-port open">' +
        '<div class="port-head">搬到：<button class="ghost tiny" data-port="' + idx + '">取消</button></div>' +
        body + '</div>';
    }
    var block = E.portBlock(s, idx);
    if (block === 'missing' || block === 'no-target' || block === 'no-platform') {
      return '<div class="arch-port"></div>';
    }
    var label = block === 'too-new' ? '太新' : block === 'money' ? '钱不够' : '移植';
    return '<div class="arch-port">' +
      '<button class="ghost tiny' + (block ? ' dimbtn' : '') + '" data-port="' + idx + '"' +
      (block ? ' disabled' : '') + '>' + label + '</button></div>';
  }

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
      s.history.slice().reverse().forEach(function (h, ri) {
        var idx = s.history.length - 1 - ri;   // 真实下标（列表是倒序的）
        var cls = h.total >= 26 ? 'good' : h.total >= 20 ? '' : 'bad';
        /* 名字存的是 h.name；自动名才回退成「类型·题材」 */
        var autoName = E.genre(h.genre).name + '·' + E.theme(h.theme).name;
        var title = (h.name && String(h.name).trim()) || autoName;
        var isCustom = title !== autoName;
        html += '<div class="arch-row">' +
          '<div class="arch-name">' + esc(title) +
          (isCustom ? '<span class="arch-genre">' + esc(autoName) + '</span>' : '') +
          (h.seq > 1 ? '<span class="arch-seq">系列第 ' + h.seq + ' 作</span>' : '') +
          (Array.isArray(h.awards) && h.awards.length
            ? '<span class="arch-awards">🏆 ' + h.awards.map(function (a) { return esc(a); }).join(' · ') + '</span>'
            : '') +
          '</div>' +
          '<div class="arch-meta">' +
          (h.platformLabel ? esc(h.platformLabel) + ' · ' : '') +
          esc(h.date || '') + ' · ' + esc(h.window || '普通档期') +
          (h.ported ? ' · 移植 ×' + h.ported : '') +
          '</div>' +
          '<div class="arch-score ' + cls + '">' + h.total + '</div>' +
          '<div class="arch-sales">' + num(h.copies) + ' 份<br>' + money(h.revenue) + '</div>' +
          portCell(idx) +
          '</div>';
      });
      html += '</div>';
    }

    /* 组合收藏：类型 × 题材 100 格 */
    var cst = E.comboStats(s);
    html += '<div class="cm-box">' +
      '<div class="cm-head">' +
      '<div><b>组合收藏</b><span class="cm-sub">类型 × 题材</span></div>' +
      '<div class="cm-stat">已解锁 <b>' + cst.have + '</b> / ' + cst.total +
      ' · 王牌 <b>' + cst.found + '</b> / ' + cst.legend + '</div>' +
      '</div>' +
      '<div class="cm-grid">' +
      '<div class="cm-row cm-top"><span class="cm-lbl"></span>';
    GD.THEMES.forEach(function (t) {
      html += '<span class="cm-th" title="' + esc(t.name) + '">' + t.icon + '</span>';
    });
    html += '</div>';
    GD.GENRES.forEach(function (g) {
      html += '<div class="cm-row"><span class="cm-lbl" title="' + esc(g.name) + '">' +
        g.icon + '</span>';
      GD.THEMES.forEach(function (t) {
        var open = E.comboUnlocked(s, g.id, t.id);
        var won = E.comboFound(s, g.id, t.id);
        var aff = E.affinity(g.id, t.id);
        var cls = !open ? 'lock' : won ? 'won' : aff >= 1.3 ? 'top' : aff >= 1.1 ? 'good' : '';
        var txt = !open ? '·' : won ? '★' : t.icon;
        var tip = g.name + ' × ' + t.name + (open ? '（相性 ×' + aff.toFixed(2) + '）' : '（未解锁）');
        html += '<span class="cm-cell ' + cls + '" title="' + esc(tip) + '">' + txt + '</span>';
      });
      html += '</div>';
    });
    html += '</div>' +
      '<div class="cm-legend"><span class="cm-cell lock">·</span> 未解锁　' +
      '<span class="cm-cell">' + GD.THEMES[0].icon + '</span> 已解锁　' +
      '<span class="cm-cell top">' + GD.THEMES[2].icon + '</span> 王牌格　' +
      '<span class="cm-cell won">★</span> 王牌达成</div>' +
      '</div>';

    html += '</div></div>';

    el.archive.innerHTML = html;
  }

  /* ---------------- 行业 ---------------- */

  /* ---------------- 研究 ---------------- */

  function renderResearch() {
    var tab = ui.rTab || 'research';
    var active = E.researchActive(s);
    var prog = E.researchProgress(s);
    var doneN = (s.research && s.research.done) ? s.research.done.length : 0;
    var gearN = (s.furniture || []).length;

    var sub = tab === 'research'
      ? '已完成 ' + doneN + ' / ' + GD.RESEARCH.length + ' · ' +
        (active ? '进行中：' + esc(E.researchById(active.id).name) + ' ' + Math.round(prog * 100) + '%' : '当前空闲')
      : '已购置 ' + gearN + ' / ' + GD.GEAR.length;

    var html = '<div class="panel-card">' +
      '<div class="panel-head"><div><h3>研发</h3><div class="panel-sub">' + sub + '</div></div>' +
      '<button class="ghost" data-act="close-panel">关闭</button></div>' +
      '<div class="tabs">' +
      '<button class="tab' + (tab === 'research' ? ' on' : '') + '" data-rtab="research">研究</button>' +
      '<button class="tab' + (tab === 'gear' ? ' on' : '') + '" data-rtab="gear">设备</button>' +
      '</div>' +
      '<div class="panel-scroll">' +
      (tab === 'research' ? researchBody(active, prog) : gearBody()) +
      '</div></div>';
    el.research.innerHTML = html;
  }

  function researchBody(active, prog) {
    var html = '';
    GD.RESEARCH_BRANCHES.forEach(function (b) {
      html += '<div class="res-branch">' +
        '<div class="res-branch-head"><span class="res-icon" style="color:' + b.color + '">' + b.icon + '</span>' +
        esc(b.name) + '</div><div class="res-list">';
      GD.RESEARCH.forEach(function (it) {
        if (it.branch !== b.id) return;
        var done = E.researchDone(s, it.id);
        var running = !!active && active.id === it.id;
        var cost = E.researchCost(s, it);
        var from = E.researchFrom(it);
        var locked = from > E.year(s);
        var busy = done || running || locked || !!active || s.money < cost;
        html += '<button class="res-item' + (done ? ' done' : '') + (running ? ' running' : '') +
          (locked ? ' locked' : '') + '"' +
          ' data-research="' + it.id + '"' + (busy ? ' disabled' : '') + '>' +
          '<span class="res-name">' + esc(it.name) + (done ? ' ✓' : '') + '</span>' +
          '<span class="res-desc">' + esc(it.desc) + '</span>' +
          '<span class="res-meta">' + (locked ? from + ' 年起' : money(cost) + ' · ' + it.days + ' 天') +
          (running ? ' · ' + Math.round(prog * 100) + '%' : '') + '</span>' +
          '</button>';
      });
      html += '</div></div>';
    });
    html += '<div class="panel-foot">研发按游戏内日历推进 —— 不开发、不发售，时间就不走。</div>';
    return html;
  }

  function gearBody() {
    var html = '';

    /* 办公室也在这里买：买工位 = 搬家 */
    var roomIdx = E.roomIndex(s);
    var next = E.nextRoom(s);
    var rcost = E.expandCost(s);
    html += '<div class="res-branch">' +
      '<div class="res-branch-head"><span class="res-icon">🏢</span>办公室' +
      '<span class="res-count">' + (roomIdx + 1) + '/' + GD.ROOMS.length + '</span></div>' +
      '<div class="res-list">';
    GD.ROOMS.forEach(function (r, i) {
      var cur = i === roomIdx;
      var upnext = !!next && r.key === next.key;
      var locked = i > roomIdx + 1;
      var can = upnext && s.money >= rcost;
      var meta = cur ? '当前所在' : upnext ? money(rcost) : locked ? '先搬前一间' : '已搬过';
      html += '<button class="res-item room' + (cur ? ' done' : '') + (locked ? ' locked' : '') + '"' +
        (can ? '' : ' disabled') + ' data-room="' + r.key + '">' +
        '<span class="res-name">' + esc(r.name) + (cur ? ' ✓' : '') + '</span>' +
        '<span class="res-desc">' + r.seats + ' 个工位 · ' + esc(r.desc) + '</span>' +
        '<span class="res-meta">' + meta + '</span>' +
        '</button>';
    });
    html += '</div></div>';

    GD.GEAR_CATS.forEach(function (c) {
      var all = GD.GEAR.filter(function (g) { return g.cat === c.id; });
      var own = all.filter(function (g) { return E.hasGear(s, g.id); }).length;
      html += '<div class="res-branch">' +
        '<div class="res-branch-head"><span class="res-icon">' + c.icon + '</span>' + esc(c.name) +
        '<span class="res-count">' + own + '/' + all.length + '</span></div><div class="res-list">';
      all.forEach(function (g) {
        var has = E.hasGear(s, g.id);
        var cost = E.gearCost(s, g);
        var from = E.gearFrom(g);
        var locked = from > E.year(s);
        var busy = has || locked || s.money < cost;
        html += '<button class="res-item gear' + (has ? ' done' : '') + (locked ? ' locked' : '') +
          '" data-gear="' + g.id + '"' + (busy ? ' disabled' : '') + '>' +
          '<span class="res-name">' + esc(g.name) + (has ? ' ✓' : '') + '</span>' +
          '<span class="res-desc">' + esc(g.desc) + '</span>' +
          '<span class="res-meta">' + (has ? '已购置' : locked ? from + ' 年起' : money(cost)) + '</span>' +
          '</button>';
      });
      html += '</div></div>';
    });
    html += '<div class="panel-foot">设备买断制：一次性花钱、永久生效。带家具标记的会真的出现在办公室里。办公室也在这一页买 —— 买工位就是搬家。</div>';
    return html;
  }

  function mpPickRow(kind, label, list, pick) {
    var html = '<div class="mp-pick"><div class="mp-pick-label">' + label + '</div><div class="mp-opts">';
    list.forEach(function (t) {
      html += '<button class="mp-opt' + (pick[kind] === t.id ? ' on' : '') +
        '" data-mpick="' + kind + ':' + t.id + '">' +
        '<b>' + esc(t.name) + '</b><span>' + esc(t.tip) + '</span></button>';
    });
    return html + '</div></div>';
  }

  /* 自定时代：2075 之后每 8 年开一代，用影响力换规则卡 */
  function customEraBody() {
    var idx = E.customEraIndex(E.year(s));
    if (idx < 0) return '';
    var chosen = E.customRuleOf(s);
    var pendingFrom = E.customPendingFrom(s);
    var inf = Math.round(s.influence || 0);

    var html = '<div class="panel-block"><div class="block-title">自定时代' +
      '<span class="dim"> · 影响力 ' + inf + '</span></div>';

    /* 已经生效的自定规则 */
    if (chosen) {
      html += '<div class="ce-active"><b>' + esc(chosen.code) + ' ' + esc(chosen.name) + '</b>' +
        '<span class="dim">' + esc(chosen.desc) + '（' + esc(chosen.learn) + '）</span></div>';
    }

    if (!pendingFrom) {
      if (!chosen) html += '<p class="dim">下一个自定时代还没到。</p>';
      else {
        html += '<p class="dim">下一次换代：' + esc(String(E.customEraFrom(idx + 1))) + ' 年。</p>';
      }
      html += '</div>';
      return html;
    }

    /* 待选：发一批卡 */
    var offer = E.rollCustomCards(s);
    html += '<div class="ce-hint">新一代开始了（' + pendingFrom + ' 年）。三选一花 ' +
      GD.CUSTOM.pickCost + ' 影响力，或者免费随机（10% 概率范式跃迁）。</div>';
    html += '<div class="ce-cards">';
    (offer ? offer.cards : []).forEach(function (c, i) {
      html += '<button class="ce-card" data-custom="' + i + '"' +
        (inf < GD.CUSTOM.pickCost ? ' disabled' : '') + '>' +
        '<span class="ce-code">' + esc(c.code) + '</span>' +
        '<span class="ce-name">' + esc(c.name) + '</span>' +
        '<span class="ce-desc">' + esc(c.desc) + '</span>' +
        '<span class="ce-eff">' + esc(effText(c.eff)) + '</span>' +
        '<span class="ce-learn">' + esc(c.learn) + '</span>' +
        '<span class="ce-tier">' + esc(c.tier) + '</span>' +
        '</button>';
    });
    html += '</div>';
    html += '<div class="ce-actions">' +
      '<button class="ghost" data-act="custom-reroll"' +
      (inf < GD.CUSTOM.rerollCost ? ' disabled' : '') + '>重抽一批 · ' +
      GD.CUSTOM.rerollCost + '</button>' +
      '<button class="primary" data-act="custom-random">听天由命 · 免费</button>' +
      '</div>';
    html += '</div>';
    return html;
  }

  /* 把 eff 翻成人话 */
  function effText(eff) {
    var names = {
      speed: '开发周期', quality: '品质', salary: '日薪', sales: '销量',
      tail: '长尾', cut: '抽成', fanSales: '粉丝销量', repSales: '声望销量',
      reviewNoise: '评分波动', noBias: '不吃偏科', cost: '一次性投入'
    };
    var out = [];
    for (var k in eff) {
      if (!Object.prototype.hasOwnProperty.call(eff, k)) continue;
      var v = eff[k];
      var label = names[k] || k;
      if (v === true) { out.push(label); continue; }
      if (typeof v !== 'number') continue;
      if (k === 'cost') { out.push(label + ' ' + money(v)); continue; }
      if (k === 'cut') { out.push(label + (v < 0 ? ' 降 ' + Math.round(-v * 100) + '%' : ' 加 ' + Math.round(v * 100) + '%')); continue; }
      if (k === 'reviewNoise' || k === 'fanSales' || k === 'repSales') {
        out.push(label + ' ×' + v.toFixed(4)); continue;
      }
      out.push(label + ' ' + (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%');
    }
    return out.join(' · ');
  }

  function renderIndustry() {
    var html = '<div class="panel-card">' +
      '<div class="panel-head"><div><h3>行业</h3>' +
      '<div class="panel-sub">' + E.year(s) + ' 年 · ' +
      (function () {
        var r = E.ruleFor(E.year(s));
        if (!r) return '主线时代（还没有世代规则）';
        var on = E.ruleOf(s) ? '' : '（未投入，未生效）';
        return r.name + '：' + r.desc + on;
      })() +
      ' · 你的奖项 ' + s.awards.length + ' 座 · 影响力 ' + Math.round(s.influence || 0) +
      '</div></div>' +
      '<button class="ghost" data-act="close-panel">关闭</button></div>' +
      '<div class="panel-scroll">';

    html += customEraBody();

    s.rivals.forEach(function (r) {
      var active = E.year(s) >= r.debut;
      var owned = E.isAcquired(s, r.id);

      if (owned) {
        var brand = null;
        E.brands(s).forEach(function (b) { if (b.id === r.id) brand = b; });
        var lastOut = null;
        (Array.isArray(s.yearBrand) ? s.yearBrand : []).forEach(function (g) {
          if (g.brand === r.id) lastOut = g;
        });
        var totalWorks = brand ? (brand.titles || 0) + (brand.output || 0) : 0;
        html += '<div class="rival owned">' +
          '<div class="rival-main">' +
          '<div class="rival-name">' + esc(r.name) + '<span class="role">子品牌</span></div>' +
          '<div class="rival-sub">' + (brand ? brand.since + ' 年收购' : '已收购') +
          ' · 累计 ' + totalWorks + ' 部 · 月度分成 ' +
          money((brand ? brand.power : r.power) * GD.BAL.brandPerMonth * E.inflation(s)) + '</div>' +
          '</div>' +
          '<div class="rival-latest">' +
          (lastOut
            ? '<b>' + lastOut.year + ' 年</b>《' + esc(lastOut.title) + '》<span class="rival-score">' + lastOut.score + '</span>'
            : '<span class="good">已归入旗下</span>') +
          '</div>' +
          '</div>';
        return;
      }

      var last = r.games[r.games.length - 1];
      var wins = 0;
      for (var i = 0; i < s.yearResults.length; i++) {
        if (s.yearResults[i].winner === r.name) wins++;
      }
      html += '<div class="rival' + (active ? '' : ' off') + (E.isLostBrand(s, r.id) ? ' lost' : '') + '">' +
        '<div class="rival-main">' +
        '<div class="rival-name">' + esc(r.name) +
        '<span class="role">' + esc(E.genre(r.genre).name) + '</span>' +
        (E.isLostBrand(s, r.id) ? '<span class="role lost-tag">脱离的子公司</span>' : '') +
        '</div>' +
        '<div class="rival-sub">出道 ' + r.debut + ' · 年度奖 ' + wins + ' 次</div>' +
        '</div>' +
        '<div class="rival-latest">' +
        (last
          ? '<b>' + (active ? last.year + ' 年' : '') + '</b>《' + esc(last.title) + '》<span class="rival-score">' + last.score + '</span>'
          : '<span class="dim">还没出道</span>') +
        '</div>';

      /* 破产时脱离的子公司：可以按 0.8 折买回来 */
      if (E.isLostBrand(s, r.id) && !E.isAcquired(s, r.id)) {
        var bbBlock = E.buybackBlock(s, r);
        html += '<div class="buyback">' +
          '<button class="ghost tiny" data-buyback="' + r.id + '"' + (bbBlock ? ' disabled' : '') + '>' +
          '买回子公司 · ' + money(E.buybackCost(s, r)) + '</button>' +
          (bbBlock === 'poor' ? '<span class="dim">钱不够</span>' : '') +
          '</div>';
      }

      if (active) {
        html += '<div class="crew">';
        E.rivalCrew(r).forEach(function (m, idx) {
          var gone = (r.poached || []).indexOf(idx) >= 0;
          var info = E.poachInfo(s, r, idx);
          var poor = s.money < info.cost;
          html += '<div class="crew-row' + (gone ? ' gone' : '') + '">' +
            '<div class="avatar sm">' + avatarSvg(m.seed) + '</div>' +
            '<div class="crew-main">' +
            '<div class="crew-name">' + esc(m.name) +
            ' <span class="role">' + esc(GD.STAT_NAMES[m.role]) + ' ' + m.stats[m.role] + '</span></div>' +
            '<div class="crew-stats">' + esc(statLine(m.stats)) + '</div>' +
            '</div>' +
            '<button class="poach" data-poach="' + r.id + ':' + idx + '"' + (gone || poor ? ' disabled' : '') + '>' +
            (gone ? '已挖走' : '挖<small>' + money(info.cost) + ' · ' + Math.round(info.chance * 100) + '%</small>') +
            '</button></div>';
        });
        html += '</div>';

        /* 收购整家 */
        var blocked = E.acquireBlock(s, r);
        html += '<div class="buyout">' +
          '<span class="buyout-cost">收购整家 · ' + money(E.acquireCost(s, r)) +
          (blocked === 'fans' ? ' · 需要 ' + num(GD.BAL.acquireFansMin) + ' 粉丝' : '') +
          '</span>' +
          '<button class="poach wide" data-acquire="' + r.id + '"' +
          (blocked ? ' disabled' : '') + '>收购</button>' +
          '</div>';
      }

      html += '</div>';
    });

    /* 奖项墙：6 类各拿过几次 */
    var awCount = {};
    (s.awards || []).forEach(function (a) { if (a && a.cat) awCount[a.cat] = (awCount[a.cat] || 0) + 1; });
    html += '<div class="panel-block"><div class="block-title">奖项墙</div><div class="award-wall">';
    GD.AWARD_CATS.forEach(function (c) {
      var n = awCount[c.id] || 0;
      html += '<div class="aw' + (n ? ' has' : '') + '">' +
        '<span class="aw-ico">' + c.icon + '</span>' +
        '<span class="aw-name">' + esc(c.name) + '</span>' +
        '<b>' + n + '</b></div>';
    });
    html += '</div></div>';

    html += '<div class="panel-block"><div class="block-title">历年评奖</div>';
    if (!s.yearResults.length) {
      html += '<p class="dim">还没有评过奖。</p>';
    } else {
      s.yearResults.slice().reverse().slice(0, 8).forEach(function (y) {
        var wl = (Array.isArray(y.won) ? y.won : []).map(function (id) {
          var nm = id;
          GD.AWARD_CATS.forEach(function (c) { if (c.id === id) nm = c.short; });
          return nm;
        });
        var mine = wl.length ? '<b class="good">' + wl.join(' / ') + '</b>'
          : (y.playerAward ? '<b class="dim">' + esc(y.playerAward) + '</b>' : '<span class="dim">—</span>');
        html += '<div class="year-row"><span>' + y.year + '</span>' +
          (y.winner ? '<b class="dim">' + esc(y.winner) + '《' + esc(y.winnerTitle) + '》</b>' : '<b class="good">你拿年度</b>') +
          '<span class="year-mine">' + mine + '</span>' +
          '<span class="mono">' + y.winnerScore + '</span></div>';
      });
    }
    html += '</div>';

    /* 平台方 */
    html += '<div class="panel-block"><div class="block-title">平台方</div>';
    if (s.myPlatform) {
      var mp = s.myPlatform;
      var hp = E.platformHealth(s);
      html += '<div class="mp-status">' +
        '<div class="mp-row"><span>平台</span><b>' + esc(mp.name) + '</b>' +
        '<span class="mono">' + mp.launched + ' 年发布 · ' + esc(mp.budgetName) + ' / ' +
        esc(mp.priceName) + ' / ' + esc(mp.cutName) + '</span></div>' +
        '<div class="mp-row"><span>装机</span><b>' + Number(mp.install).toFixed(1) + ' 万</b>' +
        '<span>售价</span><b>$' + mp.price + '</b>' +
        '<span>抽成</span><b>' + Math.round(mp.cut * 100) + '%</b></div>' +
        '<div class="mp-row"><span>去年分成</span><b class="good">' + money(mp.lastRevenue) + '</b>' +
        '<span class="mono">上架 ' + mp.lastTitles + ' 部 · 累计 ' + mp.thirdParty + ' 部</span></div>' +
        (hp ? '<div class="mp-row"><span>维护费</span><b class="bad">−' + money(hp.upkeep) + '</b>' +
          '<span>净</span><b class="' + (hp.net >= 0 ? 'good' : 'bad') + '">' +
          (hp.net >= 0 ? '+' : '') + money(hp.net) + '</b></div>' : '') +
        (hp && hp.danger ? '<div class="mp-warn">⚠ 去年亏了。再亏 ' + hp.left +
          ' 年会撑不住 —— 倒闭要赔掉 60% 现金。</div>' : '') +
        '</div>';
    } else if (E.year(s) < GD.MYPLATFORM.minYear) {
      html += '<p class="dim">到 ' + GD.MYPLATFORM.minYear + ' 年才能自研平台（现在是 ' + E.year(s) + ' 年）。</p>';
    } else {
      var pick = ui.mpPick || { budget: 'normal', price: 'mid', cut: 'normal' };
      var pv = E.launchPreview(s, pick);
      var mpBlocked = E.launchBlock(s, pick);
      html += '<p class="dim">自己当平台方：定三个参数，之后每年涨装机、收第三方抽成。' +
        '自家平台的游戏不用交授权费。</p>';
      html += mpPickRow('budget', '研发投入', GD.MYPLATFORM.tierBudget, pick);
      html += mpPickRow('price', '售价', GD.MYPLATFORM.tierPrice, pick);
      html += mpPickRow('cut', '第三方抽成', GD.MYPLATFORM.tierCut, pick);
      html += '<div class="mp-summary">初始装机 <b>' + pv.install + '</b> 万 · 售价 <b>$' + pv.price +
        '</b> · 抽成 <b>' + Math.round(pv.cut * 100) + '%</b> · 投入 <b>' + money(pv.cost) + '</b>' +
        (mpBlocked === 'poor' ? ' · <span class="bad">资金不足</span>' : '') + '</div>';
      html += '<button class="wide" data-act="launch-platform"' +
        (mpBlocked ? ' disabled' : '') + '>发布平台</button>';
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
    GD.SFX.eventAppear();
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

  /* ---------------- 破产 ---------------- */

  function buildBankrupt() {
    if (ui.bankStep === 2) {
      var html = '<div class="declare">' +
        '<div class="declare-title">重新开始</div>' +
        '<div class="declare-sub">选一条宣言。这次也只生效一次。</div><div class="declare-list">';
      GD.DECLARATIONS_RETRY.forEach(function (d) {
        html += '<button class="dec" data-rebuild="' + d.id + '">' +
          '<b>' + esc(d.name) + '</b>' +
          '<span class="dec-desc">' + esc(d.desc) + '</span>' +
          '<span class="dec-tip">' + esc(d.tip) + '</span>' +
          '</button>';
      });
      html += '</div></div>';
      el.stage.innerHTML = html;
      el.hint.textContent = '宣言只在开局生效一次。';
      return;
    }

    var rel = E.brands(s).map(function (b) { return b.name; });
    el.stage.innerHTML = '<div class="ending bankrupt">' +
      '<div class="ending-tag">公司清算</div>' +
      '<div class="ending-title">破产了</div>' +
      '<div class="ending-tone">员工散了，办公室退了。但作品还在卖，名字还在行业里。</div>' +
      '<div class="ending-stats">' +
      '<div class="done-row"><span>保留作品</span><b>' + s.history.length + ' 部</b></div>' +
      '<div class="done-row"><span>保留粉丝</span><b>' + num(Math.round((s.fans || 0) * GD.BAL.newCompanyFansKeep)) + '</b></div>' +
      '<div class="done-row"><span>保留研究</span><b>' + ((s.research && s.research.done) || []).length + ' 项</b></div>' +
      '<div class="done-row"><span>新公司起始资金</span><b>' + money(E.newCompanyMoney(s)) + '</b></div>' +
      (rel.length ? '<div class="done-row"><span>脱离的子品牌</span><b>' + esc(rel.join('、')) + '</b></div>' : '') +
      '</div>' +
      '<button class="primary big" data-act="rebuild">重新开一家公司</button>' +
      '</div>';
    el.hint.textContent = '公司会死，行业不会。';
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
      '<div class="done-row"><span>声望</span><b>' + (r.rep || 0) + ' / 100</b></div>' +
      '<div class="done-row"><span>粉丝</span><b>' + num(r.fans) + '</b></div>' +
      '<div class="done-row"><span>累计收入</span><b>' + money(r.earned) + '</b></div>' +
      '</div>' +
      '<button class="primary big" data-act="endless">继续经营</button>' +
      '<button class="ghost wide" data-act="ngplus">带收藏开第二轮 · NG+ 第 ' + ((s.ng || 0) + 1) + ' 轮</button>' +
      '<div class="ending-note">保留 ' + E.comboCount(s) + ' / 100 格收藏、' +
      E.brands(s).length + ' 个子品牌，带 ' + num(Math.floor((s.fans || 0) * GD.BAL.ngFansKeep)) +
      ' 粉丝回到 ' + GD.BAL.startYear + '；日历 ×' + GD.BAL.ngTimeSpeed +
      '，每部作品多解锁 ' + GD.BAL.ngComboBonus + ' 格组合。目标：集齐 100 格。</div>' +
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
      '<div class="done-title">《' + esc(E.gameName(s)) + '》</div>' +
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
