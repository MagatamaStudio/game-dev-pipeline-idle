/* ============================================================
 * audio.js —— WebAudio 8-bit 合成器（零素材）
 *
 * 两层：
 *   1. 28 个短音效，全部由振荡器 + 包络现场合成
 *   2. 3 首循环 BGM，按时代切换（车库 / 16-bit / 现代）
 *
 * 音量四档循环：低 → 中 → 高 → 静音，存在 localStorage。
 * 浏览器要求用户手势后才能出声，所以第一次点击时调 unlock()。
 * ============================================================ */
(function (GD) {
  'use strict';

  var ctx = null, master = null, comp = null;

  var LEVELS = [0.3, 0.6, 1.0, 0];
  var LABELS = ['低', '中', '高', '静音'];
  var ICONS = ['🔈', '🔉', '🔊', '🔇'];
  var level = 0;

  function loadPref() {
    try {
      var v = localStorage.getItem('garageStudio.soundLevel');
      if (v != null) {
        var n = parseInt(v, 10);
        if (n >= 0 && n < LEVELS.length) level = n;
      }
    } catch (e) { }
  }
  function savePref() {
    try { localStorage.setItem('garageStudio.soundLevel', String(level)); } catch (e) { }
  }
  loadPref();

  function isMuted() { return LEVELS[level] === 0; }

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = LEVELS[level];
      comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function applyGain() {
    if (!master || !ctx) return;
    master.gain.setTargetAtTime(LEVELS[level], ctx.currentTime, 0.02);
  }

  /* ---------------- 基础音 ---------------- */

  function tone(o) {
    if (isMuted()) return;
    var ac = ensure();
    if (!ac || !o.from) return;
    var t0 = ac.currentTime + (o.delay || 0);
    var osc = ac.createOscillator();
    var gain = ac.createGain();

    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.from, t0);
    if (o.to && o.to !== o.from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
    }

    var vol = o.vol == null ? 0.12 : o.vol;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.006));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.03);
  }

  /* 噪声：用于「翻页 / 撞击 / 失败」这类不像音的动静 */
  function noise(o) {
    if (isMuted()) return;
    var ac = ensure();
    if (!ac) return;
    var t0 = ac.currentTime + (o.delay || 0);
    var len = Math.max(1, Math.floor(ac.sampleRate * o.dur));
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var src = ac.createBufferSource();
    src.buffer = buf;
    var filt = ac.createBiquadFilter();
    filt.type = o.filter || 'bandpass';
    filt.frequency.value = o.freq || 1200;
    filt.Q.value = o.q || 1;
    var gain = ac.createGain();
    gain.gain.value = o.vol == null ? 0.1 : o.vol;
    src.connect(filt);
    filt.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function seq(notes, type, step, vol) {
    for (var i = 0; i < notes.length; i++) {
      if (!notes[i]) continue;
      tone({ type: type, from: notes[i], dur: step * 0.9, vol: vol, delay: i * step });
    }
  }

  /* ---------------- BGM ---------------- */

  var N = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77
  };

  var TRACKS = {
    /* 车库期：A 小调，跑动的八分音符 */
    garage: {
      bpm: 132, leadType: 'square', leadVol: 0.035, bassVol: 0.055,
      lead: [N.A4, 0, N.C5, 0, N.E5, 0, N.A5, 0, N.E5, 0, N.C5, 0, N.A4, 0, N.G4, 0,
        N.F4, 0, N.A4, 0, N.C5, 0, N.F5, 0, N.C5, 0, N.A4, 0, N.G4, 0, N.E4, 0],
      bass: [N.A3, 0, N.A3, 0, N.E3, 0, N.E3, 0, N.F3, 0, N.F3, 0, N.C3, 0, N.C3, 0,
        N.A3, 0, N.A3, 0, N.E3, 0, N.E3, 0, N.F3, 0, N.F3, 0, N.G3, 0, N.G3, 0]
    },
    /* 16-bit：C 大调，跳跃 */
    bit: {
      bpm: 140, leadType: 'square', leadVol: 0.038, bassVol: 0.055,
      lead: [N.C5, N.E5, N.G5, N.C5, N.E5, N.G5, N.A5, N.G5,
        N.F5, N.A5, N.C5, N.F5, N.A5, N.C5, N.D5, N.B4,
        N.C5, N.E5, N.G5, N.C5, N.E5, N.G5, N.C5, N.A5,
        N.F5, N.A5, N.C5, N.F5, N.G5, N.B4, N.D5, N.G5],
      bass: [N.C3, 0, N.C3, 0, N.G3, 0, N.G3, 0, N.F3, 0, N.F3, 0, N.G3, 0, N.G3, 0,
        N.C3, 0, N.C3, 0, N.G3, 0, N.G3, 0, N.F3, 0, N.F3, 0, N.G3, 0, N.G3, 0]
    },
    /* 现代：E 小调，留白多 */
    modern: {
      bpm: 96, leadType: 'triangle', leadVol: 0.045, bassVol: 0.06,
      lead: [N.E5, 0, 0, N.G5, 0, 0, N.B5, 0, N.A5, 0, 0, N.G5, 0, 0, N.E5, 0,
        N.D5, 0, 0, N.B4, 0, 0, N.G4, 0, N.A4, 0, 0, N.B4, 0, 0, 0, 0],
      bass: [N.E3, 0, 0, 0, N.C3, 0, 0, 0, N.G3, 0, 0, 0, N.D3, 0, 0, 0,
        N.E3, 0, 0, 0, N.C3, 0, 0, 0, N.G3, 0, 0, 0, N.D3, 0, 0, 0]
    }
  };

  var BGM = { id: null, step: 0, next: 0, timer: null, want: true };
  var unlocked = false;

  function bgmStepLen(tr) { return 60 / tr.bpm / 2; }

  function bgmPump() {
    if (!BGM.id || !BGM.want || isMuted() || !ctx || ctx.state !== 'running') return;
    var tr = TRACKS[BGM.id];
    if (!tr) return;
    var ac = ctx;
    var stepLen = bgmStepLen(tr);
    if (BGM.next < ac.currentTime) BGM.next = ac.currentTime + 0.05;
    while (BGM.next < ac.currentTime + 0.5) {
      var delay = Math.max(0, BGM.next - ac.currentTime);
      var i = BGM.step % tr.lead.length;
      var lf = tr.lead[i];
      if (lf) {
        tone({ type: tr.leadType, from: lf, dur: stepLen * 1.7, vol: tr.leadVol, delay: delay, attack: 0.012 });
      }
      var bf = tr.bass[i % tr.bass.length];
      if (bf) {
        tone({ type: 'triangle', from: bf, dur: stepLen * 2.4, vol: tr.bassVol, delay: delay, attack: 0.015 });
      }
      BGM.step++;
      BGM.next += stepLen;
    }
  }

  function bgmStart(id) {
    if (!id || !TRACKS[id]) return;
    if (BGM.id === id) return;
    BGM.id = id;
    BGM.step = 0;
    BGM.next = 0;
    if (!BGM.timer) BGM.timer = setInterval(bgmPump, 140);
    bgmPump();
  }

  function bgmStop() {
    BGM.id = null;
    BGM.step = 0;
    BGM.next = 0;
    if (BGM.timer) { clearInterval(BGM.timer); BGM.timer = null; }
  }

  function eraTrack(year) {
    if (year < 1983) return 'garage';
    if (year < 2000) return 'bit';
    return 'modern';
  }

  /* ---------------- 28 个音效 ---------------- */

  GD.SFX = {
    /* --- 控制 --- */
    unlock: function () {
      unlocked = true;
      ensure();
      if (BGM.want && !isMuted() && GD.__lastYear != null) {
        bgmStart(eraTrack(GD.__lastYear));
      }
    },
    isMuted: isMuted,
    level: function () { return level; },
    label: function () { return LABELS[level]; },
    icon: function () { return ICONS[level]; },

    /* 四档循环：低 → 中 → 高 → 静音 */
    cycle: function () {
      level = (level + 1) % LEVELS.length;
      savePref();
      ensure();
      applyGain();
      if (isMuted()) { bgmStop(); }
      else if (BGM.want) { bgmStart(BGM.id || eraTrack(GD.__lastYear || 1972)); }
      return { level: level, muted: isMuted(), label: LABELS[level], icon: ICONS[level] };
    },

    /* 兼容旧接口 */
    toggle: function () {
      level = isMuted() ? 0 : (LEVELS.length - 1);
      savePref();
      ensure();
      applyGain();
      if (isMuted()) bgmStop();
      return isMuted();
    },

    setEra: function (year) {
      GD.__lastYear = year;
      if (!unlocked || !BGM.want || isMuted()) return;
      var want = eraTrack(year);
      if (BGM.id !== want) bgmStart(want);
    },

    bgmEnabled: function () { return BGM.want; },
    setBgm: function (on) {
      BGM.want = !!on;
      if (!BGM.want) bgmStop();
      else if (GD.__lastYear != null) bgmStart(eraTrack(GD.__lastYear));
    },

    /* --- 1~8 界面基础 --- */
    click: function () { tone({ type: 'square', from: 880, to: 660, dur: 0.05, vol: 0.09 }); },
    hover: function () { tone({ type: 'square', from: 1200, dur: 0.02, vol: 0.03 }); },
    back: function () { tone({ type: 'square', from: 520, to: 380, dur: 0.07, vol: 0.08 }); },
    open: function () { tone({ type: 'triangle', from: 440, to: 660, dur: 0.08, vol: 0.08 }); },
    close: function () { tone({ type: 'triangle', from: 660, to: 440, dur: 0.08, vol: 0.07 }); },
    type: function () { tone({ type: 'square', from: 1400 + Math.random() * 300, dur: 0.012, vol: 0.02 }); },
    page: function () { noise({ dur: 0.09, freq: 2200, q: 0.8, vol: 0.05 }); },
    scroll: function () { noise({ dur: 0.04, freq: 3200, q: 1.2, vol: 0.03 }); },

    /* --- 9~16 经营动作 --- */
    coin: function () { tone({ type: 'triangle', from: 1046.5, to: 1568, dur: 0.06, vol: 0.06 }); },
    bad: function () { tone({ type: 'square', from: 240, to: 110, dur: 0.2, vol: 0.12 }); },
    win: function () { seq([523.25, 659.25, 783.99, 1046.5], 'square', 0.1, 0.12); },
    hire: function () {
      seq([523.25, 659.25], 'triangle', 0.07, 0.1);
      tone({ type: 'square', from: 783.99, dur: 0.12, vol: 0.08, delay: 0.15 });
    },
    expand: function () {
      noise({ dur: 0.18, freq: 500, q: 0.6, vol: 0.1 });
      tone({ type: 'square', from: 220, to: 440, dur: 0.2, vol: 0.09 });
    },
    research: function () {
      tone({ type: 'triangle', from: 392, to: 523.25, dur: 0.14, vol: 0.09 });
      tone({ type: 'triangle', from: 523.25, to: 659.25, dur: 0.14, vol: 0.08, delay: 0.1 });
    },
    researchDone: function () {
      seq([523.25, 659.25, 783.99, 1046.5, 1318.5], 'triangle', 0.07, 0.1);
    },
    gear: function () {
      noise({ dur: 0.12, freq: 900, q: 0.9, vol: 0.09 });
      tone({ type: 'square', from: 330, to: 496, dur: 0.1, vol: 0.07, delay: 0.05 });
    },
    poach: function () {
      tone({ type: 'square', from: 300, to: 900, dur: 0.16, vol: 0.1 });
      tone({ type: 'triangle', from: 900, to: 1300, dur: 0.12, vol: 0.08, delay: 0.14 });
    },
    poachFail: function () {
      noise({ dur: 0.16, freq: 700, q: 0.7, vol: 0.1 });
      tone({ type: 'square', from: 300, to: 180, dur: 0.2, vol: 0.1, delay: 0.05 });
    },

    /* --- 17~24 流程节点 --- */
    startProject: function () {
      seq([392, 523.25, 659.25], 'square', 0.08, 0.1);
      tone({ type: 'triangle', from: 783.99, dur: 0.18, vol: 0.07, delay: 0.24 });
    },
    mode: function () { tone({ type: 'square', from: 660, to: 880, dur: 0.05, vol: 0.07 }); },
    eventAppear: function () {
      tone({ type: 'square', from: 880, to: 1174.66, dur: 0.1, vol: 0.1 });
      tone({ type: 'square', from: 1174.66, to: 880, dur: 0.1, vol: 0.08, delay: 0.1 });
    },
    eventPick: function () {
      tone({ type: 'square', from: 523.25, dur: 0.06, vol: 0.09 });
      tone({ type: 'square', from: 659.25, dur: 0.09, vol: 0.08, delay: 0.06 });
    },
    microAppear: function () { tone({ type: 'triangle', from: 1046.5, to: 1318.5, dur: 0.07, vol: 0.06 }); },
    microPick: function () { tone({ type: 'square', from: 783.99, dur: 0.06, vol: 0.08 }); },
    reveal: function (i) {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      tone({ type: 'square', from: notes[i] || 523.25, dur: 0.1, vol: 0.13 });
    },
    total: function (score) {
      if (score >= 32) seq([523.25, 659.25, 783.99, 1046.5, 1318.5], 'square', 0.075, 0.11);
      else if (score >= 24) seq([523.25, 659.25, 783.99], 'square', 0.08, 0.1);
      else seq([659.25, 587.33, 523.25], 'square', 0.09, 0.09);
    },

    /* --- 25~28 大事件 --- */
    week: function () { tone({ type: 'triangle', from: 1318.5, dur: 0.035, vol: 0.05 }); },
    award: function () {
      seq([523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], 'square', 0.1, 0.12);
    },
    awardLose: function () { seq([587.33, 523.25, 440], 'triangle', 0.12, 0.08); },
    ending: function () {
      seq([523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5, 1567.98], 'square', 0.16, 0.11);
    }
  };

  /* 标签页切走就停 BGM，回来接着放 */
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) bgmStop();
      else if (BGM.want && !isMuted() && GD.__lastYear != null) bgmStart(eraTrack(GD.__lastYear));
    });
  }

})(window.GD = window.GD || {});
