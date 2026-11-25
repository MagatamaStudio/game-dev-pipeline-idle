/* ============================================================
 * audio.js —— WebAudio 8-bit 合成器（零素材）
 * ============================================================ */
(function (GD) {
  'use strict';

  var ctx = null, master = null;
  var muted = false;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.3;
      var comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(o) {
    if (muted) return;
    var ac = ensure();
    if (!ac) return;
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
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.03);
  }

  function seq(notes, type, step, vol) {
    for (var i = 0; i < notes.length; i++) {
      tone({ type: type, from: notes[i], dur: step * 0.9, vol: vol, delay: i * step });
    }
  }

  GD.SFX = {
    unlock: function () { ensure(); },
    isMuted: function () { return muted; },
    toggle: function () { muted = !muted; if (!muted) ensure(); return muted; },

    click: function () { tone({ type: 'square', from: 880, to: 660, dur: 0.05, vol: 0.09 }); },
    hover: function () { tone({ type: 'square', from: 1200, dur: 0.02, vol: 0.03 }); },

    /* 评审亮分：四个音逐个升高 */
    reveal: function (i) {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      tone({ type: 'square', from: notes[i] || 523.25, dur: 0.1, vol: 0.13 });
    },

    /* 总分揭晓：高分给长琶音，低分给下行 */
    total: function (score) {
      if (score >= 32) {
        seq([523.25, 659.25, 783.99, 1046.5, 1318.5], 'square', 0.075, 0.11);
      } else if (score >= 24) {
        seq([523.25, 659.25, 783.99], 'square', 0.08, 0.1);
      } else {
        seq([659.25, 587.33, 523.25], 'square', 0.09, 0.09);
      }
    },

    week: function () { tone({ type: 'triangle', from: 1318.5, dur: 0.035, vol: 0.05 }); },
    coin: function () { tone({ type: 'triangle', from: 1046.5, to: 1568, dur: 0.06, vol: 0.06 }); },
    bad: function () { tone({ type: 'square', from: 240, to: 110, dur: 0.2, vol: 0.12 }); },
    win: function () { seq([523.25, 659.25, 783.99, 1046.5], 'square', 0.1, 0.12); }
  };

})(window.GD = window.GD || {});
