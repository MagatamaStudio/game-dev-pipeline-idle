/* ============================================================
 * ui.js —— 所有 DOM 相关的东西都在这里
 * 引擎只算数，这里只画图。
 * ============================================================ */
(function (GD) {
  'use strict';

  var E = GD.Engine;
  var UI = {};
  GD.UI = UI;

  var el = {};
  var state = null;
  var hooks = {};

  var pipeline = { cols: [], era: -1, key: '' };
  var shop = { tab: 'team', buttons: [], texts: [], era: -1 };
  var toastTimer = [];

  /* ---------------- 初始化 ---------------- */

  UI.mount = function (s, h) {
    state = s;
    hooks = h || {};

    el = {
      year: byId('era-year'),
      cycle: byId('era-cycle'),
      name: byId('era-name'),
      tagline: byId('era-tagline'),
      money: byId('money'),
      income: byId('income'),
      fame: byId('fame'),
      legacy: byId('legacy'),
      burst: byId('btn-burst'),
      burstSub: byId('burst-sub'),
      burstFill: byId('burst-fill'),
      menu: byId('btn-menu'),
      cols: byId('pipeline-cols'),
      pipelineEmpty: byId('pipeline-empty'),
      shopBody: byId('shop-body'),
      goalDesc: byId('goal-desc'),
      goalFill: byId('goal-fill'),
      goalCount: byId('goal-count'),
      advance: byId('btn-advance'),
      toasts: byId('toasts'),
      modal: byId('modal'),
      modalEyebrow: byId('modal-eyebrow'),
      modalTitle: byId('modal-title'),
      modalBody: byId('modal-body'),
      modalActions: byId('modal-actions')
    };

    bind();
    pipeline.era = -1;
    shop.era = -1;
    UI.rebuild();
    UI.render();
  };

  function byId(id) { return document.getElementById(id); }

  /* ---------------- 事件 ---------------- */

  function bind() {
    el.burst.addEventListener('click', function () {
      if (E.burst(state)) { UI.render(); if (hooks.onSave) hooks.onSave(); }
    });

    el.advance.addEventListener('click', function () {
      if (hooks.onAdvance) hooks.onAdvance();
    });

    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function (ev) {
        var t = ev.currentTarget.getAttribute('data-tab');
        if (t === shop.tab) return;
        shop.tab = t;
        var all = document.querySelectorAll('.tab');
        for (var k = 0; k < all.length; k++) {
          all[k].classList.toggle('active', all[k].getAttribute('data-tab') === t);
        }
        buildShop();
      });
    }

    el.shopBody.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-buy]');
      if (!btn || btn.disabled) return;
      var kind = btn.getAttribute('data-buy');
      var id = btn.getAttribute('data-id') || '';
      var ok = false;
      if (kind === 'worker') ok = E.buyWorker(state, id);
      else if (kind === 'tool') {
        var tool = E.era(state).tools.filter(function (t) { return t.id === id; })[0];
        if (tool) ok = E.buyTool(state, tool);
      } else if (kind === 'engine') ok = E.buyEngine(state);
      else if (kind === 'line') ok = E.buyLine(state);
      else if (kind === 'slot') ok = E.buySlot(state);
      else if (kind === 'legacy') ok = E.buyLegacy(state, id);
      if (ok) {
        if (kind === 'legacy') buildShop();
        updateShop();
        UI.render();
        if (hooks.onSave) hooks.onSave();
      }
    });

    el.menu.addEventListener('click', function () { UI.openMenu(); });

    el.cols.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-outsource]');
      if (!btn || btn.disabled) return;
      var res = E.outsource(state, btn.getAttribute('data-outsource'));
      if (!res) return;
      UI.handleEvents(res.events);
      UI.render();
      if (hooks.onSave) hooks.onSave();
      UI.toast('外包完成 · <b>-' + GD.fmtMoney(res.cost) + '</b>');
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.code === 'Space' && !ev.repeat && document.activeElement === document.body) {
        ev.preventDefault();
        if (E.burst(state)) { UI.render(); if (hooks.onSave) hooks.onSave(); }
      }
    });
  }

  /* ---------------- 整体渲染 ---------------- */

  UI.rebuild = function () {
    var era = E.era(state);
    document.body.setAttribute('data-era', String(state.era));
    el.year.textContent = era.year;
    el.name.textContent = era.name;
    el.tagline.textContent = era.tagline;
    el.cycle.textContent = '第 ' + (state.cycle || 1) + ' 轮';
    pipeline.era = -1;
    shop.era = -1;
    buildPipeline();
    buildShop();
    UI.render();
  };

  UI.render = function () {
    var era = E.era(state);

    el.money.textContent = GD.fmtMoney(state.money);
    el.income.textContent = GD.fmtMoney(E.incomePerSec(state));
    el.fame.textContent = GD.fmt(Math.floor(state.fame));
    el.legacy.textContent = GD.fmt(state.legacy);

    renderBurst();
    renderPipeline(era);
    updateShop();
    renderGoal(era);
  };

  /* ---------------- 顶栏 ---------------- */

  function renderBurst() {
    var firing = state.time < state.burstUntil;
    var ready = state.time >= state.burstReadyAt;
    var frac, sub;

    if (firing) {
      var left = state.burstUntil - state.time;
      frac = left / GD.BURST_DURATION;
      sub = '×2.5 · ' + left.toFixed(1) + 's';
      el.burst.disabled = true;
      el.burst.classList.add('firing');
    } else if (!ready) {
      var cd = state.burstReadyAt - state.time;
      frac = 1 - cd / GD.BURST_COOLDOWN;
      sub = '冷却 ' + Math.ceil(cd) + 's';
      el.burst.disabled = true;
      el.burst.classList.remove('firing');
    } else {
      frac = 1;
      sub = '就绪';
      el.burst.disabled = false;
      el.burst.classList.remove('firing');
    }
    el.burstSub.textContent = sub;
    el.burstFill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, frac)) + ')';
  }

  /* ---------------- 流水线 ---------------- */

  function pipelineStages(era) {
    var stages = era.stages.slice();
    if (era.line) stages.push({ id: '__line', name: '出厂', icon: '▤', virtual: true });
    return stages;
  }

  function buildPipeline() {
    var era = E.era(state);
    var stages = pipelineStages(era);
    el.cols.innerHTML = '';
    pipeline.cols = [];

    stages.forEach(function (st) {
      var virtual = !!st.virtual;
      var color = virtual ? 'var(--warn)' : ((GD.STAGE_STYLE[st.id] || {}).color || 'var(--accent)');

      var col = document.createElement('div');
      col.className = 'stage-col' + (virtual ? ' line-col' : '');
      col.style.setProperty('--stage-color', color);

      var head = document.createElement('div');
      head.className = 'stage-head';
      head.innerHTML =
        '<div class="stage-title">' +
        '<span class="stage-icon">' + st.icon + '</span>' +
        '<span class="stage-name">' + st.name + '</span>' +
        '<span class="stage-tag" hidden>瓶颈</span>' +
        '</div>' +
        '<div class="stage-meta"><span class="people"></span><span class="cap"></span></div>';

      var chips = document.createElement('div');
      chips.className = 'chips';

      col.appendChild(head);
      col.appendChild(chips);

      var out = null;
      if (era.outsource && !virtual) {
        var foot = document.createElement('div');
        foot.className = 'stage-foot';
        var ob = document.createElement('button');
        ob.className = 'outsource';
        ob.setAttribute('data-outsource', st.id);
        ob.textContent = '外包';
        foot.appendChild(ob);
        col.appendChild(foot);
        out = { btn: ob, wrap: foot };
      }

      el.cols.appendChild(col);

      pipeline.cols.push({
        el: col,
        chips: chips,
        tag: head.querySelector('.stage-tag'),
        people: head.querySelector('.people'),
        cap: head.querySelector('.cap'),
        out: out,
        sig: 'init',
        chipMap: {}
      });
    });

    pipeline.era = state.era;
    pipeline.key = stages.map(function (s) { return s.id; }).join('|');
  }

  function renderPipeline(era) {
    var stages = pipelineStages(era);
    if (pipeline.era !== state.era || pipeline.key !== stages.map(function (s) { return s.id; }).join('|')) {
      buildPipeline();
    }

    var bottleneck = E.bottleneck(state);
    var lineRate = E.lineRate(state);
    el.pipelineEmpty.hidden = state.projects.length > 0;

    for (var i = 0; i < stages.length; i++) {
      var st = stages[i];
      var ref = pipeline.cols[i];
      if (!ref) continue;
      var virtual = !!st.virtual;

      var list = [];
      for (var j = 0; j < state.projects.length; j++) {
        var pj = state.projects[j];
        if (virtual ? pj.stage >= era.stages.length : pj.stage === i) list.push(pj);
      }
      list.sort(function (a, b) { return a.since - b.since; });

      var isSlow = !virtual && bottleneck === st.id && state.projects.length > 0;

      if (virtual) {
        ref.people.textContent = list.length ? list.length + ' 部待出厂' : '产线空闲';
        ref.cap.textContent = isFinite(lineRate) ? (1 / lineRate).toFixed(1) + 's / 部' : '—';
        ref.tag.textContent = '产线满负荷';
        ref.tag.hidden = list.length === 0;
        ref.el.classList.toggle('slow', list.length > 0);
        ref.el.classList.toggle('idle', list.length === 0);
      } else {
        var people = state.workers[st.id] || 0;
        ref.people.textContent = people + ' 人';
        ref.cap.textContent = GD.fmt(E.capacity(state, st.id)) + ' /秒';
        ref.tag.textContent = '瓶颈';
        ref.tag.hidden = !isSlow;
        ref.el.classList.toggle('slow', isSlow);
        ref.el.classList.toggle('idle', people === 0);

        if (ref.out) {
          var cost = E.outsourceCost(state, st.id);
          ref.out.btn.textContent = cost > 0 ? '外包 · ' + GD.fmtMoney(cost) : '外包';
          ref.out.btn.disabled = !(cost > 0) || state.money < cost;
        }
      }

      var sig = list.map(function (p) { return p.uid; }).join(',');
      if (sig !== ref.sig) {
        ref.sig = sig;
        ref.chips.innerHTML = '';
        ref.chipMap = {};
        for (var k = 0; k < list.length; k++) {
          var p = list[k];
          var chip = document.createElement('div');
          chip.className = 'chip' + (virtual ? ' shipping' : '');
          chip.innerHTML =
            '<div class="chip-top">' +
            '<span class="chip-name"></span>' +
            '<span class="chip-size">×' + p.size + '</span>' +
            '</div>' +
            '<div class="chip-bar"><i></i></div>';
          chip.querySelector('.chip-name').textContent = p.name;
          ref.chips.appendChild(chip);
          ref.chipMap[p.uid] = chip.querySelector('.chip-bar i');
        }
        if (!list.length) {
          var ph = document.createElement('div');
          ph.className = 'empty-slot';
          ph.textContent = virtual ? '等成品' : (state.workers[st.id] ? '等待上游' : '没有员工');
          ref.chips.appendChild(ph);
        }
      }

      for (var m = 0; m < list.length; m++) {
        var pr = list[m];
        var bar = ref.chipMap[pr.uid];
        if (!bar) continue;
        var pct = 1;
        if (virtual) {
          pct = Math.max(0, Math.min(1, pr.progress || 0));
        } else {
          var need = st.need * pr.size;
          pct = Math.max(0, Math.min(1, pr.progress / need));
        }
        bar.style.width = (pct * 100).toFixed(1) + '%';
      }
    }
  }

  /* ---------------- 商店 ---------------- */

  function buildShop() {
    el.shopBody.innerHTML = '';
    shop.buttons = [];
    shop.texts = [];
    shop.era = state.era;

    if (shop.tab === 'team') buildTeam();
    else if (shop.tab === 'tech') buildTech();
    else buildLegacy();
    updateShop();
  }

  function addBuy(btn, costFn, affordFn, labelFn) {
    shop.buttons.push({ btn: btn, costFn: costFn, affordFn: affordFn, labelFn: labelFn });
  }

  function addText(fn) { shop.texts.push(fn); }

  function section(title) {
    var s = document.createElement('div');
    s.className = 'shop-section';
    if (title) {
      var h = document.createElement('h4');
      h.textContent = title;
      s.appendChild(h);
    }
    el.shopBody.appendChild(s);
    return s;
  }

  function deptCard(parent, stage, extraRow) {
    var card = document.createElement('div');
    card.className = 'dept';
    card.innerHTML =
      '<div class="dept-head">' +
      '<span class="dept-icon">' + stage.icon + '</span>' +
      '<span class="dept-name"></span>' +
      '<span class="dept-count"></span>' +
      '</div>';
    card.querySelector('.dept-name').textContent = stage.name;
    parent.appendChild(card);
    return card;
  }

  function buildTeam() {
    var era = E.era(state);
    var sec = section('部门编制');

    era.stages.forEach(function (st) {
      var card = deptCard(sec, st);
      var count = card.querySelector('.dept-count');
      addText(function () {
        var n = state.workers[st.id] || 0;
        count.textContent = n + ' 人 · ' + GD.fmt(E.capacity(state, st.id)) + '/秒';
      });

      var row = document.createElement('div');
      row.className = 'row';
      row.innerHTML =
        '<div class="row-info">' +
        '<div class="row-name">雇佣 ' + st.name + '员工</div>' +
        '<div class="row-sub">+1 人，永久提升该部门产能</div>' +
        '</div>';
      var btn = document.createElement('button');
      btn.className = 'buy';
      btn.setAttribute('data-buy', 'worker');
      btn.setAttribute('data-id', st.id);
      row.appendChild(btn);
      card.appendChild(row);
      addBuy(btn, function () { return E.workerCost(state, st.id); }, null, null);
    });

    var sec2 = section('产能');
    var slot = document.createElement('div');
    slot.className = 'slot-row';
    slot.innerHTML =
      '<div class="row">' +
      '<div class="row-info">' +
      '<div class="row-name">并行项目槽</div>' +
      '<div class="row-sub slotsub"></div>' +
      '</div>' +
      '</div>';
    var sbtn = document.createElement('button');
    sbtn.className = 'buy';
    sbtn.setAttribute('data-buy', 'slot');
    slot.querySelector('.row').appendChild(sbtn);
    sec2.appendChild(slot);

    var sub = slot.querySelector('.slotsub');
    addText(function () {
      sub.textContent = state.slots + ' / ' + GD.MAX_SLOTS + ' 个在制项目';
      if (state.slots >= GD.MAX_SLOTS) {
        sbtn.textContent = '已满';
      }
    });
    addBuy(sbtn, function () { return E.slotCost(state); }, function () { return state.slots < GD.MAX_SLOTS; }, null);

    var note = document.createElement('p');
    note.className = 'legacy-desc';
    note.style.padding = '0 2px';
    note.textContent = '槽位越多，项目越能同时流过不同部门；只有一个槽时，一部作品必须走完全部工序才能开始下一部。';
    sec2.appendChild(note);
  }

  function buildTech() {
    var era = E.era(state);
    var sec = section('部门工具');

    era.stages.forEach(function (st) {
      var tool = era.tools.filter(function (t) { return t.stage === st.id; })[0];
      var card = deptCard(sec, st);
      var count = card.querySelector('.dept-count');
      addText(function () {
        count.textContent = '产能 ' + GD.fmt(E.capacity(state, st.id)) + '/秒';
      });
      if (!tool) return;

      var row = document.createElement('div');
      row.className = 'row';
      row.innerHTML =
        '<div class="row-info">' +
        '<div class="row-name"><span class="tname"></span><span class="lv"></span></div>' +
        '<div class="row-sub">' + st.name + '产能 ×' + tool.mult.toFixed(2) + ' / 级</div>' +
        '</div>';
      row.querySelector('.tname').textContent = tool.name;
      var lv = row.querySelector('.lv');
      var btn = document.createElement('button');
      btn.className = 'buy';
      btn.setAttribute('data-buy', 'tool');
      btn.setAttribute('data-id', tool.id);
      row.appendChild(btn);
      card.appendChild(row);

      addText(function () {
        var l = state.toolLv[tool.id] || 0;
        lv.textContent = 'Lv ' + l;
        lv.hidden = l === 0;
      });
      addBuy(btn, function () { return E.toolCost(state, tool); }, null, null);
    });

    var sec2 = section('引擎');
    var eng = document.createElement('div');
    eng.className = 'engine-row';
    eng.innerHTML =
      '<div class="row">' +
      '<div class="row-info">' +
      '<div class="row-name"><span class="ename"></span><span class="lv"></span></div>' +
      '<div class="row-sub">所有部门产能 ×' + era.engine.mult.toFixed(2) + ' / 级</div>' +
      '</div>' +
      '</div>';
    eng.querySelector('.ename').textContent = era.engine.name;
    var elv = eng.querySelector('.lv');
    var ebtn = document.createElement('button');
    ebtn.className = 'buy';
    ebtn.setAttribute('data-buy', 'engine');
    eng.querySelector('.row').appendChild(ebtn);
    sec2.appendChild(eng);

    addText(function () {
      var l = state.engineLv || 0;
      elv.textContent = 'Lv ' + l;
      elv.hidden = l === 0;
    });
    addBuy(ebtn, function () { return E.engineCost(state); }, null, null);

    if (era.line) {
      var line = document.createElement('div');
      line.className = 'engine-row';
      line.innerHTML =
        '<div class="row">' +
        '<div class="row-info">' +
        '<div class="row-name"><span class="linename"></span><span class="lv"></span></div>' +
        '<div class="row-sub"><span class="liner"></span> · 开发再快也要等它</div>' +
        '</div>' +
        '</div>';
      line.querySelector('.linename').textContent = era.line.name;
      var llv = line.querySelector('.lv');
      var lrate = line.querySelector('.liner');
      var lbtn = document.createElement('button');
      lbtn.className = 'buy';
      lbtn.setAttribute('data-buy', 'line');
      line.querySelector('.row').appendChild(lbtn);
      sec2.appendChild(line);

      addText(function () {
        var l = state.lineLv || 0;
        llv.textContent = 'Lv ' + l;
        llv.hidden = l === 0;
        lrate.textContent = '出厂 ' + (1 / E.lineRate(state)).toFixed(1) + ' 秒 / 部';
      });
      addBuy(lbtn, function () { return E.lineCost(state); }, null, null);
    }

    var note = document.createElement('p');
    note.className = 'legacy-desc';
    note.style.padding = '0 2px';
    note.textContent = '工具只提升单个部门，引擎提升所有部门。先补瓶颈，再考虑全局。';
    sec2.appendChild(note);
  }

  function buildLegacy() {
    var sec = section('跨时代传承');

    var intro = document.createElement('p');
    intro.className = 'legacy-empty';
    intro.textContent = '每次进入新时代，团队与资金清零，但会留下传承点。传承点是永久的，可以投资到这里。';
    sec.appendChild(intro);

    var points = document.createElement('p');
    points.className = 'legacy-empty';
    points.style.color = 'var(--warn)';
    points.style.fontFamily = 'var(--mono)';
    sec.appendChild(points);
    addText(function () { points.textContent = '可用传承点：' + GD.fmt(state.legacy); });

    GD.LEGACY.forEach(function (def) {
      var lv = state.legacyUp[def.id] || 0;
      var card = document.createElement('div');
      card.className = 'legacy-card';
      var maxed = lv >= def.max;

      card.innerHTML =
        '<div class="row-info">' +
        '<div class="row-name"><span class="lname"></span><span class="lv"></span></div>' +
        '<div class="legacy-desc"><span class="ldesc"></span><br><span class="leff"></span></div>' +
        '</div>';
      card.querySelector('.lname').textContent = def.name;
      card.querySelector('.ldesc').textContent = def.desc;

      var lvEl = card.querySelector('.lv');
      var effEl = card.querySelector('.leff');
      var btn = document.createElement('button');
      btn.className = 'buy';
      btn.setAttribute('data-buy', 'legacy');
      btn.setAttribute('data-id', def.id);
      card.appendChild(btn);
      sec.appendChild(card);

      addText(function () {
        var cur = state.legacyUp[def.id] || 0;
        lvEl.textContent = cur + ' / ' + def.max;
        effEl.textContent = '当前：' + def.effectText(cur, E.era(state));
        if (cur >= def.max) btn.textContent = '已满级';
      });
      addBuy(
        btn,
        function () { return def.cost(state.legacyUp[def.id] || 0); },
        function () { return (state.legacyUp[def.id] || 0) < def.max; },
        'legacy'
      );
    });

    var stats = document.createElement('div');
    stats.className = 'shop-section';
    stats.innerHTML = '<h4>生涯统计</h4>';
    var list = document.createElement('div');
    list.className = 'legacy-desc';
    list.style.lineHeight = '1.9';
    stats.appendChild(list);
    sec.appendChild(stats);
    addText(function () {
      list.innerHTML =
        '累计发行：<b style="color:var(--text)">' + (state.totalReleases || 0) + '</b> 部<br>' +
        '累计收入：<b style="color:var(--text)">' + GD.fmtMoney(state.totalEarned || 0) + '</b><br>' +
        '单部最高：<b style="color:var(--text)">' + GD.fmtMoney(state.best || 0) + '</b><br>' +
        '游戏内时长：<b style="color:var(--text)">' + GD.fmtTime(state.time || 0) + '</b>';
    });
  }

  function updateShop() {
    if (!shop.buttons.length && !shop.texts.length) return;

    for (var i = 0; i < shop.texts.length; i++) {
      try { shop.texts[i](); } catch (e) { }
    }

    for (var j = 0; j < shop.buttons.length; j++) {
      var b = shop.buttons[j];
      var cost = b.costFn();
      var afford = b.affordFn ? b.affordFn() : state.money >= cost;
      var isLegacy = b.labelFn === 'legacy';
      var maxed = b.affordFn && !afford;
      b.btn.textContent = maxed ? (isLegacy ? '已满级' : '已满') : (isLegacy ? cost + ' 传承' : GD.fmtMoney(cost));
      b.btn.disabled = !afford;
      b.btn.classList.toggle('affordable', !!afford);
    }
  }

  /* ---------------- 目标栏 ---------------- */

  function renderGoal(era) {
    var done = state.eraReleases;
    var total = era.goal.releases;
    var met = done >= total;
    var nextEra = GD.ERAS[(state.era + 1) % GD.ERAS.length];

    el.goalDesc.textContent = '发行 ' + total + ' 部作品';
    el.goalCount.textContent = Math.min(done, total) + ' / ' + total;
    el.goalFill.style.width = Math.min(100, (done / total) * 100) + '%';

    el.advance.disabled = !met;
    if (met) {
      el.advance.textContent = state.era === GD.ERAS.length - 1
        ? '开启新一轮 · ' + nextEra.year + ' →'
        : '进入 ' + nextEra.year + ' · ' + nextEra.name + ' →';
    } else {
      el.advance.textContent = '目标未完成';
    }
  }

  /* ---------------- 吐司 ---------------- */

  UI.toast = function (html, kind) {
    var t = document.createElement('div');
    t.className = 'toast';
    if (kind === 'legacy') t.style.borderLeftColor = 'var(--warn)';
    t.innerHTML = html;
    el.toasts.appendChild(t);

    while (el.toasts.children.length > 5) {
      el.toasts.removeChild(el.toasts.firstChild);
    }

    var timer = setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 3200);
    toastTimer.push(timer);
  };

  UI.handleEvents = function (events) {
    if (!events || !events.length) return;
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.type === 'release') {
        UI.toast('《' + ev.name + '》 <b>+' + GD.fmtMoney(ev.price) + '</b>');
      }
    }
  };

  /* ---------------- 弹窗 ---------------- */

  UI.modal = function (opts) {
    el.modalEyebrow.textContent = opts.eyebrow || '';
    el.modalEyebrow.hidden = !opts.eyebrow;
    el.modalTitle.textContent = opts.title || '';
    el.modalBody.innerHTML = opts.html || '';
    el.modalActions.innerHTML = '';

    (opts.actions || [{ label: '好' }]).forEach(function (a) {
      var b = document.createElement('button');
      b.textContent = a.label;
      if (a.primary) b.className = 'primary';
      b.addEventListener('click', function () {
        if (a.onClick) a.onClick();
        if (a.close !== false) UI.closeModal();
      });
      el.modalActions.appendChild(b);
    });

    el.modal.hidden = false;
    if (opts.onClose) UI._onClose = opts.onClose;
  };

  UI.closeModal = function () {
    el.modal.hidden = true;
    if (UI._onClose) { var f = UI._onClose; UI._onClose = null; f(); }
  };

  UI.openMenu = function () {
    UI.modal({
      eyebrow: 'SYSTEM',
      title: '菜单',
      html:
        '<p>进度会自动保存在本地浏览器里。也可以导出成一段文本，换设备时再导入。</p>' +
        '<div class="kv"><span>累计发行</span><b>' + (state.totalReleases || 0) + ' 部</b></div>' +
        '<div class="kv"><span>累计收入</span><b>' + GD.fmtMoney(state.totalEarned || 0) + '</b></div>' +
        '<div class="kv"><span>当前时代</span><b>' + E.era(state).year + ' ' + E.era(state).name + '</b></div>',
      actions: [
        { label: '导出存档', onClick: function () { if (hooks.onExport) hooks.onExport(); } },
        { label: '导入存档', onClick: function () { if (hooks.onImport) hooks.onImport(); } },
        { label: '重新开始', onClick: function () { if (hooks.onReset) hooks.onReset(); } },
        { label: '关闭', primary: true }
      ]
    });
  };

  /* ---------------- 时代介绍 ---------------- */

  UI.showEraIntro = function (opts) {
    var era = E.era(state);
    UI.modal({
      eyebrow: 'ERA ' + (state.era + 1) + ' / ' + GD.ERAS.length + ' · ' + era.year,
      title: era.name,
      html:
        (opts && opts.wrapped
          ? '<p style="color:var(--warn)">你走完了一整轮游戏史，带着全部传承回到了原点。这一次，会快得多。</p>'
          : '') +
        '<p style="color:var(--text);font-size:14px">' + era.tagline + '</p>' +
        '<p>' + era.intro + '</p>' +
        (opts && opts.gain
          ? '<div class="kv"><span>上一时代的传承</span><b>+' + opts.gain + ' 传承点</b></div>'
          : '') +
        '<div class="kv"><span>本时代目标</span><b>发行 ' + era.goal.releases + ' 部作品</b></div>' +
        '<p style="margin-top:14px;color:var(--dim-2)">把项目送过每一道工序，用收入招人、买工具。' +
        (era.stages.length > 2 ? '注意最慢的那个部门——它会拖住整条线。' : '先点「灵感迸发」加速，攒钱招第一个员工。') +
        '</p>',
      actions: [{ label: '开工', primary: true }]
    });
  };

  UI.showOffline = function (report) {
    UI.modal({
      eyebrow: 'OFFLINE',
      title: '你不在的时候',
      html:
        '<p>工作室自己运转了一会儿。</p>' +
        '<div class="kv"><span>离开时长</span><b>' + GD.fmtTime(report.seconds) + '</b></div>' +
        '<div class="kv"><span>有效结算</span><b>' + GD.fmtTime(report.simulated) + '</b></div>' +
        '<div class="kv"><span>发行作品</span><b>' + report.releases + ' 部</b></div>' +
        '<div class="kv"><span>收入</span><b>' + GD.fmtMoney(report.earned) + '</b></div>' +
        (report.capped ? '<p style="margin-top:12px;color:var(--dim-2)">离线收益最多结算 8 小时。</p>' : ''),
      actions: [{ label: '继续', primary: true }]
    });
  };

})(window.GD = window.GD || {});
