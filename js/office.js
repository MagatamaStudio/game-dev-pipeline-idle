/* ============================================================
 * office.js —— 像素办公室（纯程序化，零外部素材）
 *
 * 画一间隔间：墙、地板、窗、家具、灯，外加每个人自己的像素小人。
 * 时代（1972→2013）决定配色与家具，办公室等级决定工位数量，
 * 当前阶段决定小人在干嘛（敲键盘 / 发呆 / 庆祝 / 打瞌睡）。
 *
 * 关键约束：
 *   - 本文件不碰引擎状态，只读 s；不写任何状态。
 *   - Canvas 后备缓冲就是「美术像素」，靠 CSS image-rendering: pixelated
 *     放大，因此不用管 DPR，也不会有半像素模糊。
 *   - 所有装饰都必须「低频」：3~4 倍放大下，周期小于 6 美术像素的纹理
 *     会和缩放混叠成噪点，所以墙面、地板一律用大色块 + 稀疏点缀。
 * ============================================================ */
(function (GD) {
  'use strict';

  var O = {};
  GD.Office = O;

  /* ---------------- 几何常量（单位＝美术像素） ---------------- */
  var ROWS = 40;            // 画布高度
  var CEIL_H = 2;           // 天花板暗带
  var WALL_Y = 21;          // 墙面底边（含踢脚线）
  var P_TOP = 14;           // 小人头顶
  var DESK_TOP = 26;        // 桌面上沿
  var DESK_BOT = 33;        // 桌面前脸下沿
  var LEG_BOT = 37;         // 桌腿落地

  var SKIN = ['#f2c9a0', '#e0ac7e', '#c68a5f', '#8d5a3b'];
  var HAIR = ['#2b2118', '#4a3222', '#7a4a2a', '#1c1c22', '#8a8a92', '#b06a3a'];
  var SHIRT = ['#4fc3a1', '#e8b04b', '#d98bd8', '#7fb2ff', '#ff8f6b', '#9b8bff', '#eceff4', '#5d6b8a'];
  var EYE = '#20202a';
  var GLASS = '#2b2b38';

  /* 6 种发型：只定义头 5 行，身体共用（合计 12 行） */
  var STYLES = [
    ['...hhhh...', '..hhhhhh..', '..hffffh..', '..ffffff..', '..fEffEf..'], // 短发
    ['..hhhhhh..', '.hhhhhhhh.', '.hhffffhh.', '.hhffffhh.', '.hfEffEfh.'], // 长发
    ['..hhhhhh..', '.hhhhhhhh.', 'hhhhhhhhhh', '.hffffffh.', '.hfEffEfh.'], // 爆炸头
    ['..........', '...hhhh...', '..hhhhhh..', '..ffffff..', '..fEffEf..'], // 寸头
    ['....hh....', '....hh....', '..hhhhhh..', '..ffffff..', '..fEffEf..'], // 莫西干
    ['.h.hhhh.h.', '.hhhhhhhh.', '..hffffh..', '..ffffff..', '..fEffEf..']  // 双丸子
  ];
  var BODY = [
    '..ssssss..', '.ssssssss.', '.ssssssss.', '.ssssssss.',
    '.ssssssss.', '..ssssss..', '..ssssss..'
  ];

  /* ---------------- 时代配色 / 家具 ---------------- */
  var ERAS = [
    {
      from: 1972, key: 'garage',
      wall: '#413b32', wallHi: '#544c40', wallLo: '#332f28', ceil: '#221f1a',
      floor: '#38342c', floor2: '#302d26', floorStyle: 'concrete',
      desk: '#7d5c36', deskHi: '#9c7444', deskLo: '#5c4227',
      case: '#b9ae94', screen: '#63c07f', crt: true,
      sky: ['#161b24', '#28323f'], lamp: '#ffcf8a', lampX: 0.16,
      props: ['bulb', 'clock', 'poster', 'poster', 'boxes', 'cable']
    },
    {
      from: 1983, key: 'office',
      wall: '#5e5445', wallHi: '#726654', wallLo: '#4b4337', ceil: '#332d24',
      floor: '#4c4134', floor2: '#443a2e', floorStyle: 'carpet',
      desk: '#8a6438', deskHi: '#a87c4a', deskLo: '#684a29',
      case: '#c9bfa6', screen: '#5fd18a', crt: true,
      sky: ['#2c3140', '#4a546e'], lamp: '#ffe0a8', lampX: 0.5,
      props: ['window', 'clock', 'plant', 'poster']
    },
    {
      from: 1989, key: 'bit16',
      wall: '#525863', wallHi: '#656c78', wallLo: '#444952', ceil: '#2c3038',
      floor: '#3e4149', floor2: '#373a41', floorStyle: 'carpet',
      desk: '#726d62', deskHi: '#8d877a', deskLo: '#57534b',
      case: '#d2cbb8', screen: '#6fd0f0', crt: true,
      sky: ['#262e3e', '#405974'], lamp: '#ffe0a8', lampX: 0.5,
      props: ['window', 'clock', 'shelf', 'plant']
    },
    {
      from: 1994, key: 'cd',
      wall: '#4d4854', wallHi: '#605a68', wallLo: '#403c46', ceil: '#2b2730',
      floor: '#3c3944', floor2: '#35323c', floorStyle: 'wood',
      desk: '#7d7567', deskHi: '#978d7c', deskLo: '#5f594b',
      case: '#dbd4c2', screen: '#8ad4ff', crt: true,
      sky: ['#2e2435', '#4d3d5b'], lamp: '#ffe6b8', lampX: 0.5,
      props: ['window', 'clock', 'tower', 'poster']
    },
    {
      from: 2000, key: 'lcd',
      wall: '#4a535f', wallHi: '#5c6673', wallLo: '#3d454f', ceil: '#2a3038',
      floor: '#3d444c', floor2: '#363c43', floorStyle: 'carpet',
      desk: '#8f8779', deskHi: '#aaa191', deskLo: '#6d665a',
      case: '#33383f', screen: '#7fd3ff', crt: false,
      sky: ['#2f3d4d', '#587594'], lamp: '#fff0d0', lampX: 0.5,
      props: ['window', 'whiteboard', 'plant', 'clock']
    },
    {
      from: 2013, key: 'modern',
      wall: '#454e59', wallHi: '#57616e', wallLo: '#39404a', ceil: '#272d34',
      floor: '#40474f', floor2: '#383e45', floorStyle: 'carpet',
      desk: '#b9b3a6', deskHi: '#d2ccc0', deskLo: '#8e887c',
      case: '#2a2d33', screen: '#8fd4ff', crt: false,
      sky: ['#364760', '#6f93bf'], lamp: '#fff6e0', lampX: 0.5,
      props: ['window', 'plant', 'whiteboard', 'clock', 'lamp2']
    }
  ];

  function eraFor(year) {
    var e = ERAS[0];
    for (var i = 0; i < ERAS.length; i++) if (year >= ERAS[i].from) e = ERAS[i];
    return e;
  }
  O.eraFor = eraFor;

  /* ---------------- 小工具 ---------------- */
  function hash(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function look(seed) {
    var h = hash(seed);
    return {
      skin: SKIN[h % 4],
      hair: HAIR[(h >>> 3) % 6],
      shirt: SHIRT[(h >>> 6) % 8],
      style: (h >>> 9) % 6,
      acc: (h >>> 12) % 5,          // 0 无 · 1 眼镜 · 2 耳机 · 3 帽子 · 4 领带
      seed: h
    };
  }
  O.look = look;

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /* ---------------- 像素小人 ---------------- */
  function drawPerson(c, x, y, lk, mood, frame) {
    var rows = STYLES[lk.style].concat(BODY);
    var dy = (mood === 'tired') ? 1 : 0;

    /* 椅背（先画，压在小人后面） */
    px(c, x - 1, y + 6 + dy, 12, 7, '#2b2b33');
    px(c, x - 1, y + 6 + dy, 12, 1, '#3d3d47');

    for (var r = 0; r < rows.length; r++) {
      var line = rows[r];
      for (var i = 0; i < line.length; i++) {
        var ch = line.charAt(i);
        if (ch === '.') continue;
        var col = ch === 'h' ? lk.hair : ch === 'f' ? lk.skin : ch === 's' ? lk.shirt : null;
        if (col) px(c, x + i, y + r + dy, 1, 1, col);
      }
    }

    /* 眼睛 */
    var ey = y + 4 + dy;
    if (mood === 'happy') {
      px(c, x + 3, ey, 2, 1, EYE); px(c, x + 3, ey - 1, 1, 1, EYE);
      px(c, x + 6, ey, 2, 1, EYE); px(c, x + 7, ey - 1, 1, 1, EYE);
    } else if (mood === 'tired' || (mood === 'idle' && frame === 1)) {
      px(c, x + 3, ey, 2, 1, EYE);
      px(c, x + 6, ey, 2, 1, EYE);
    } else {
      px(c, x + 3, ey, 1, 1, EYE);
      px(c, x + 6, ey, 1, 1, EYE);
    }

    /* 配饰 */
    if (lk.acc === 1) {
      px(c, x + 2, ey, 2, 1, GLASS); px(c, x + 6, ey, 2, 1, GLASS);
      px(c, x + 4, ey, 2, 1, GLASS);
      px(c, x + 2, ey - 1, 1, 1, GLASS); px(c, x + 7, ey - 1, 1, 1, GLASS);
    } else if (lk.acc === 2) {
      px(c, x + 1, y + 3 + dy, 1, 3, GLASS);
      px(c, x + 8, y + 3 + dy, 1, 3, GLASS);
      px(c, x + 2, y + 1 + dy, 6, 1, GLASS);
    } else if (lk.acc === 3) {
      px(c, x + 2, y + dy, 6, 1, lk.shirt);
      px(c, x + 1, y + 1 + dy, 7, 1, lk.shirt);
      px(c, x + 1, y + 2 + dy, 7, 1, '#2b2118');
    } else if (lk.acc === 4) {
      px(c, x + 4, y + 8 + dy, 2, 1, '#e8e8e8');
      px(c, x + 4, y + 9 + dy, 2, 3, '#c9453f');
    }

    /* 手：搭在桌沿，敲键盘时上下交替 */
    var hx = x + 1, hy = y + rows.length - 1;
    if (mood === 'type') {
      px(c, hx, hy - (frame ? 1 : 0), 2, 1, lk.skin);
      px(c, hx + 6, hy - (frame ? 0 : 1), 2, 1, lk.skin);
    } else {
      px(c, hx, hy, 2, 1, lk.skin);
      px(c, hx + 6, hy, 2, 1, lk.skin);
    }
  }

  /* 顶上的 SVG 版小人（给 DOM 卡片用，和场景里长得一样） */
  O.avatarSvg = function (seed) {
    var lk = look(seed);
    var rows = STYLES[lk.style].concat(BODY);
    var out = [];
    for (var r = 0; r < rows.length; r++) {
      var line = rows[r];
      for (var i = 0; i < line.length; i++) {
        var ch = line.charAt(i);
        if (ch === '.') continue;
        var col = ch === 'h' ? lk.hair : ch === 'f' ? lk.skin : ch === 's' ? lk.shirt : null;
        if (col) out.push('<rect x="' + i + '" y="' + r + '" width="1" height="1" fill="' + col + '"/>');
      }
    }
    out.push('<rect x="3" y="4" width="1" height="1" fill="' + EYE + '"/>');
    out.push('<rect x="6" y="4" width="1" height="1" fill="' + EYE + '"/>');
    if (lk.acc === 1) {
      out.push('<rect x="2" y="4" width="2" height="1" fill="' + GLASS + '"/>');
      out.push('<rect x="6" y="4" width="2" height="1" fill="' + GLASS + '"/>');
      out.push('<rect x="4" y="4" width="2" height="1" fill="' + GLASS + '"/>');
    } else if (lk.acc === 2) {
      out.push('<rect x="1" y="3" width="1" height="3" fill="' + GLASS + '"/>');
      out.push('<rect x="8" y="3" width="1" height="3" fill="' + GLASS + '"/>');
      out.push('<rect x="2" y="1" width="6" height="1" fill="' + GLASS + '"/>');
    } else if (lk.acc === 3) {
      out.push('<rect x="1" y="1" width="7" height="1" fill="' + lk.shirt + '"/>');
      out.push('<rect x="1" y="2" width="7" height="1" fill="#2b2118"/>');
    } else if (lk.acc === 4) {
      out.push('<rect x="4" y="8" width="2" height="4" fill="#c9453f"/>');
    }
    return '<svg viewBox="0 0 10 12" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" ' +
      'shape-rendering="crispEdges" aria-hidden="true">' + out.join('') + '</svg>';
  };

  /* ---------------- 装饰 ---------------- */
  function drawWindow(c, x, y, w, h, pal) {
    px(c, x - 1, y - 1, w + 2, h + 2, pal.wallLo);
    px(c, x, y, w, Math.round(h * 0.58), pal.sky[0]);
    px(c, x, y + Math.round(h * 0.58), w, h - Math.round(h * 0.58), pal.sky[1]);
    /* 窗外剪影，靠底部 */
    var base = y + h - 1;
    for (var i = 1; i < w - 1; i += 4) {
      var bh = 1 + ((i * 5) % 2);
      px(c, x + i, base - bh, 3, bh, pal.sky[0]);
    }
    px(c, x + Math.floor(w / 2), y, 1, h, pal.wallHi);
    px(c, x, y + Math.floor(h / 2), w, 1, pal.wallHi);
  }

  function drawPoster(c, x, y, w, h, k) {
    px(c, x - 1, y - 1, w + 2, h + 2, '#2b2620');
    px(c, x, y, w, h, ['#c9453f', '#3f7dc9', '#c9a13f', '#7a3fc9'][k % 4]);
    px(c, x + 2, y + 2, w - 4, 3, 'rgba(255,255,255,.35)');
    px(c, x + 2, y + 6, w - 5, 1, 'rgba(0,0,0,.28)');
  }

  function drawClock(c, x, y, pal, frac) {
    px(c, x - 1, y - 1, 9, 9, pal.wallLo);
    px(c, x, y, 7, 7, '#e8e2d2');
    var cx = x + 3, cy = y + 3;
    var ang = frac * Math.PI * 2 - Math.PI / 2;
    for (var t = 1; t <= 2; t++) {
      px(c, cx + Math.round(Math.cos(ang) * t), cy + Math.round(Math.sin(ang) * t), 1, 1, '#3a3a48');
    }
    px(c, cx, cy, 1, 1, '#3a3a48');
  }

  function drawPlant(c, x, baseY) {
    px(c, x + 1, baseY - 4, 5, 4, '#8a5a3a');
    px(c, x + 1, baseY - 4, 5, 1, '#a06c46');
    px(c, x + 2, baseY - 8, 3, 4, '#3f8a4d');
    px(c, x, baseY - 11, 2, 4, '#4ea35e');
    px(c, x + 5, baseY - 12, 2, 5, '#4ea35e');
    px(c, x + 3, baseY - 13, 2, 2, '#5cb86c');
  }

  function drawBoxes(c, x, baseY) {
    px(c, x, baseY - 5, 8, 5, '#8a7448');
    px(c, x, baseY - 5, 8, 1, '#a89257');
    px(c, x + 3, baseY - 5, 1, 5, '#6d5a36');
    px(c, x + 6, baseY - 9, 6, 4, '#94814f');
    px(c, x + 6, baseY - 9, 6, 1, '#ae9a63');
  }

  function drawShelf(c, x, y, w, pal) {
    px(c, x - 1, y - 1, w + 2, 12, pal.wallLo);
    px(c, x, y, w, 10, '#3a332b');
    for (var s = 0; s < 3; s++) px(c, x, y + 2 + s * 4, w, 1, pal.desk);
    for (var i = 1; i < w - 2; i += 3) {
      px(c, x + i, y + 1, 2, 1, ['#c9453f', '#3f7dc9', '#c9a13f', '#4ea35e'][i % 4]);
    }
  }

  function drawTower(c, x, baseY) {
    px(c, x, baseY - 8, 5, 8, '#c9bfa6');
    px(c, x + 1, baseY - 7, 3, 1, '#6b6459');
    px(c, x + 1, baseY - 5, 3, 1, '#6b6459');
    px(c, x + 3, baseY - 3, 1, 1, '#5fd18a');
  }

  function drawWhiteboard(c, x, y, w, h, pal) {
    px(c, x - 1, y - 1, w + 2, h + 2, pal.wallLo);
    px(c, x, y, w, h, '#e8e6de');
    px(c, x + 1, y + 1, w - 2, 1, '#cfccc2');
    px(c, x + 3, y + 3, w - 10, 1, '#7fb2ff');
    px(c, x + 3, y + 5, w - 6, 1, '#d98bd8');
    px(c, x + 3, y + 7, w - 13, 1, '#4fc3a1');
  }

  function drawBulb(c, x, pal) {
    px(c, x, CEIL_H, 1, 3, pal.wallLo);
    px(c, x - 1, CEIL_H + 3, 3, 2, pal.lamp);
    px(c, x, CEIL_H + 5, 1, 1, '#8a7448');
  }

  function drawLamp2(c, x, baseY, pal) {
    px(c, x, baseY - 5, 1, 5, pal.wallLo);
    px(c, x - 2, baseY - 7, 5, 2, pal.lamp);
  }

  function drawCable(c, x, baseY) {
    px(c, x, baseY - 1, 6, 1, '#232020');
    px(c, x + 6, baseY - 2, 3, 2, '#232020');
    px(c, x + 9, baseY - 1, 6, 1, '#232020');
  }

  /* ---------------- 买来的设备 / 家具 ---------------- */
  function gearHas(list, id) { return list && list.indexOf(id) >= 0; }

  function drawRug(c) {
    var x = Math.round(W * 0.10), w = Math.round(W * 0.80);
    var y = LEG_BOT - 3;
    px(c, x, y, w, 4, 'rgba(180,72,66,.42)');
    px(c, x, y, w, 1, 'rgba(255,255,255,.14)');
    px(c, x - 1, y + 1, 1, 2, 'rgba(180,72,66,.42)');
    px(c, x + w, y + 1, 1, 2, 'rgba(180,72,66,.42)');
  }

  function drawNeon(c, x, y) {
    px(c, x - 1, y - 1, 24, 11, '#1d1a26');
    px(c, x + 1, y + 2, 19, 1, '#ff6ea8');
    px(c, x + 1, y + 5, 13, 1, '#6ee0ff');
    px(c, x + 16, y + 5, 4, 1, '#ffd166');
    px(c, x + 1, y + 7, 8, 1, 'rgba(255,110,168,.55)');
  }

  function drawArcade(c, x, baseY) {
    px(c, x, baseY - 14, 11, 14, '#2a2d3a');
    px(c, x + 1, baseY - 13, 9, 6, '#15151f');
    px(c, x + 2, baseY - 12, 7, 4, '#5fd18a');
    px(c, x + 2, baseY - 12, 7, 1, '#9be8b8');
    px(c, x + 1, baseY - 6, 9, 1, '#3a3f52');
    px(c, x + 2, baseY - 5, 3, 1, '#e05c4a');
    px(c, x + 6, baseY - 5, 3, 1, '#e8b04b');
  }

  function drawServer(c, x, baseY) {
    px(c, x, baseY - 16, 9, 16, '#2c3038');
    px(c, x, baseY - 16, 9, 1, '#41485a');
    for (var i = 0; i < 6; i++) {
      px(c, x + 1, baseY - 15 + i * 2, 7, 1, '#3a404b');
      px(c, x + 6, baseY - 15 + i * 2, 1, 1, i % 2 ? '#5fd18a' : '#7fb2ff');
    }
  }

  function drawCoffee(c, x, baseY) {
    px(c, x, baseY - 6, 10, 6, '#6b6459');
    px(c, x, baseY - 6, 10, 1, '#8d8578');
    px(c, x + 3, baseY - 12, 5, 6, '#3a3a42');
    px(c, x + 4, baseY - 11, 3, 2, '#e8b04b');
    px(c, x + 5, baseY - 7, 1, 1, '#c9bfa6');
  }

  function drawSofa(c, x, baseY) {
    px(c, x, baseY - 7, 16, 7, '#5d6b8a');
    px(c, x, baseY - 9, 16, 3, '#6f7d9c');
    px(c, x + 1, baseY - 6, 6, 4, '#7a88a8');
    px(c, x + 9, baseY - 6, 6, 4, '#7a88a8');
    px(c, x + 1, baseY - 1, 3, 1, '#3a3f52');
    px(c, x + 13, baseY - 1, 3, 1, '#3a3f52');
  }

  /* 前景道具：摆在桌子前面那一条空地上 */
  function drawFrontGear(gear) {
    var fy = ROWS - 1;
    var l = Math.round(W * 0.02);
    if (gearHas(gear, 'arcade')) { drawArcade(ctx, l, fy); l += 15; }
    if (gearHas(gear, 'plantwall')) { drawPlant(ctx, l + 2, fy - 1); l += 13; }

    var r = W - Math.round(W * 0.02);
    if (gearHas(gear, 'server')) { drawServer(ctx, r - 9, fy); r -= 13; }
    if (gearHas(gear, 'sofa')) { drawSofa(ctx, r - 16, fy); r -= 20; }
    if (gearHas(gear, 'coffee')) { drawCoffee(ctx, r - 10, fy); r -= 16; }
  }

  /* ---------------- 桌子 / 显示器 ---------------- */
  function drawDesk(c, deskL, deskW, pal, occupied) {
    var deskR = deskL + deskW;
    px(c, deskL + 1, DESK_BOT, 2, LEG_BOT - DESK_BOT, pal.deskLo);
    px(c, deskR - 3, DESK_BOT, 2, LEG_BOT - DESK_BOT, pal.deskLo);
    px(c, deskL, DESK_TOP, deskW, DESK_BOT - DESK_TOP, pal.desk);
    px(c, deskL, DESK_TOP, deskW, 1, pal.deskHi);
    px(c, deskL, DESK_BOT - 1, deskW, 1, pal.deskLo);
    /* 抽屉：只画在一个位置，避免变成横条纹 */
    var dw = Math.max(6, Math.min(14, deskW - 12));
    px(c, deskL + 5, DESK_TOP + 2, dw, 3, pal.deskLo);
    px(c, deskL + 5, DESK_TOP + 2, dw, 1, pal.deskHi);
    if (occupied) px(c, deskL + 6, DESK_TOP + 3, 2, 1, pal.deskHi);
    px(c, deskL - 1, LEG_BOT, deskW + 2, 1, 'rgba(0,0,0,.22)');
  }

  function drawMonitor(c, x, pal, prog) {
    if (pal.crt) {
      px(c, x, DESK_TOP - 9, 10, 8, pal.case);              // 机身
      px(c, x, DESK_TOP - 9, 10, 1, '#ffffff33');           // 顶部高光
      px(c, x + 1, DESK_TOP - 8, 8, 6, '#24242a');          // 屏幕边框
      px(c, x + 2, DESK_TOP - 7, 6, 4, pal.screen);         // 屏幕
      px(c, x + 2, DESK_TOP - 7, 6, 1, '#ffffff40');        // 反光
      px(c, x + 3, DESK_TOP - 1, 4, 1, pal.case);           // 底座
    } else {
      px(c, x, DESK_TOP - 8, 10, 6, pal.case);              // 边框
      px(c, x + 1, DESK_TOP - 7, 8, 4, pal.screen);         // 面板
      px(c, x + 1, DESK_TOP - 7, 8, 1, '#ffffff35');
      px(c, x + 4, DESK_TOP - 2, 2, 2, pal.case);           // 支架
      px(c, x + 2, DESK_TOP - 1, 6, 1, pal.case);
    }
    /* 屏幕最底一行做进度条：开发中能直接看出做到哪了 */
    if (prog != null) {
      var w = pal.crt ? 6 : 8;
      var bx = x + (pal.crt ? 2 : 1);
      px(c, bx, DESK_TOP - 4, w, 1, '#15151a');
      px(c, bx, DESK_TOP - 4, Math.max(1, Math.round(w * prog)), 1, '#7fe0a0');
    }
  }

  /* ---------------- 渲染 ---------------- */
  var canvas = null, ctx = null;
  var W = 200, dirty = true, frame = 0, timer = 0;
  var state = null, mounted = false, lastSig = '';

  function isDark() {
    return !!(document.body && document.body.getAttribute('data-theme') === 'dark');
  }

  function moodFor(phase) {
    if (phase === 'release' || phase === 'sales' || phase === 'ending') return 'happy';
    if (phase === 'developing') return 'type';
    return 'idle';
  }

  /* ---- 房间等级：工位数 3/4/5/6 → 车库/街边/写字楼/独栋 ---- */
  function roomTag(seats) { return Math.max(1, Math.min(4, (seats || 3) - 2)); }

  function shade(hex, f) {
    if (typeof hex !== 'string' || hex.charAt(0) !== '#' || hex.length < 7) return hex;
    var n = parseInt(hex.slice(1, 7), 16);
    var r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
    var g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
    var b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  /* 房间越大越亮；车库压暗一点，独栋提亮一点 */
  var ROOM_TINT = [0.88, 0.96, 1.03, 1.08];

  function roomPalette(pal, lv) {
    var p = {};
    for (var k in pal) p[k] = pal[k];
    var f = ROOM_TINT[lv - 1] || 1;
    var keys = ['wall', 'wallLo', 'wallHi', 'ceil', 'floor', 'floor2', 'sky', 'desk'];
    for (var i = 0; i < keys.length; i++) {
      var kk = keys[i];
      if (Array.isArray(p[kk])) {
        p[kk] = p[kk].map(function (c) { return shade(c, f); });
      } else if (typeof p[kk] === 'string' && p[kk].charAt(0) === '#') {
        p[kk] = shade(p[kk], f);
      }
    }
    /* 车库永远是水泥地，之后才是木地板 / 地毯 */
    p.floorStyle = lv === 1 ? 'concrete' : lv === 2 ? 'wood' : 'carpet';
    return p;
  }

  /* 车库卷帘门：替代窗户 */
  function drawGarageDoor(c, x, y, w, h, pal) {
    px(c, x - 1, y - 1, w + 2, h + 2, pal.wallLo);
    var slat = shade(pal.wallHi, 0.94);
    for (var yy = y; yy < y + h; yy += 3) {
      px(c, x, yy, w, 2, slat);
      px(c, x, yy + 2, w, 1, pal.wallLo);
    }
    for (var xx = x + 2; xx < x + w; xx += 7) px(c, xx, y, 1, h, shade(pal.wallLo, 0.9));
    px(c, x + Math.floor(w / 2) - 3, y + h - 4, 7, 2, pal.desk);
  }

  function render() {
    if (!ctx || !state) return;
    var roomLv = roomTag(state.seats || 3);
    var pal = roomPalette(eraFor(GD.Engine.year(state)), roomLv);
    var dark = isDark();
    var year = GD.Engine.year(state);
    var frac = (((state.day % 360) + 360) % 360) / 360;
    var staff = state.staff || [];
    var seats = Math.max(staff.length, state.seats || 3);
    seats = Math.max(1, Math.min(seats, 8));
    var mood = moodFor(state.phase);
    var working = state.phase === 'developing' || state.phase === 'event';
    var prog = state.project && working
      ? Math.max(0, Math.min(1, state.project.progress || 0))
      : null;
    var leaderId = state.plan && state.plan.leader;
    var gear = state.furniture || [];

    drawShell(pal);
    drawWallDecor(pal, year, frac, gear, roomLv);
    drawFloor(pal);
    if (gearHas(gear, 'rug')) drawRug(ctx);

    /* ---- 工位 ---- */
    var slotW = W / seats;
    var compact = slotW < 34;
    for (var i = 0; i < seats; i++) {
      var cx = slotW * (i + 0.5);
      var st = staff[i] || null;
      var deskW = Math.max(16, Math.min(30, Math.round(slotW - 8)));
      var deskL = Math.round(cx - deskW / 2);
      var groupW = compact ? 10 : 22;
      var gL = Math.round(cx - groupW / 2);

      if (st) {
        drawPerson(ctx, gL, P_TOP, look(st.seed), mood, frame);
        if (working && st.id === leaderId) {
          /* 主创头顶一个小三角，跟办公室卡片上的高亮对应 */
          var my = P_TOP - 3 - (frame ? 0 : 1);
          px(ctx, gL + 4, my, 2, 1, '#ffb454');
          px(ctx, gL + 3, my + 1, 4, 1, '#ffb454');
        }
      } else {
        px(ctx, gL + 1, P_TOP + 8, 8, 4, '#2b2b33');       // 空位＝空椅子
      }
      drawDesk(ctx, deskL, deskW, pal, !!st);
      if (!compact) drawMonitor(ctx, gL + 12, pal, prog);
      else if (st) px(ctx, gL, DESK_TOP - 5, 8, 5, pal.case);
    }

    drawFrontGear(gear);

    light(pal, dark);
    grade(dark);
  }

  function drawShell(pal) {
    /* 天花板暗带 → 墙 → 踢脚线 */
    px(ctx, 0, 0, W, CEIL_H, pal.ceil);
    px(ctx, 0, CEIL_H, W, WALL_Y - CEIL_H, pal.wall);
    /* 只有一条墙裙分界，别画竖条纹（会跟缩放打架） */
    px(ctx, 0, WALL_Y - 4, W, 3, pal.wallLo);
    px(ctx, 0, WALL_Y - 1, W, 1, pal.wallHi);
  }

  function drawWallDecor(pal, year, frac, gear, roomLv) {
    var lv = roomLv || 1;
    var pad = Math.round(W * 0.035);
    var props = pal.props;
    var cursor = pad;
    var top = CEIL_H + 2;
    var wh = Math.min(13, WALL_Y - top - 2);

    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      if (p === 'window') {
        if (lv === 1) {
          /* 车库：窗户位置是一扇卷帘门 */
          var gw = Math.min(44, Math.round(W * 0.21));
          drawGarageDoor(ctx, pad, top - 1, gw, wh + 2, pal);
          cursor = pad + gw + 6;
        } else {
          /* 楼越好，窗越大 */
          var ww = Math.min(20 + lv * 10, Math.round(W * (0.10 + lv * 0.055)));
          drawWindow(ctx, pad, top, ww, wh, pal);
          cursor = pad + ww + 6;
        }
      } else if (p === 'bulb') {
        drawBulb(ctx, Math.round(W * pal.lampX), pal);
        cursor = Math.round(W * pal.lampX) + 8;
      } else if (p === 'clock') {
        drawClock(ctx, W - pad - 8, top, pal, frac);
      } else if (p === 'poster') {
        var pxx = Math.min(Math.max(cursor, pad), W - pad - 14);
        drawPoster(ctx, pxx, top + 1, 12, 10, year + i);
        cursor = pxx + 16;
      } else if (p === 'whiteboard') {
        var bw = Math.min(36, Math.round(W * 0.18));
        drawWhiteboard(ctx, W - pad - bw, top, bw, wh, pal);
      } else if (p === 'shelf') {
        drawShelf(ctx, cursor + 8, top + 1, Math.min(20, Math.round(W * 0.06)), pal);
        cursor += 32;
      }
    }

    /* 买了霓虹灯牌就挂在墙上 */
    if (gearHas(gear, 'neon')) drawNeon(ctx, Math.round(W * 0.40), CEIL_H + 1);
  }

  function drawFloor(pal) {
    var fh = ROWS - WALL_Y;
    px(ctx, 0, WALL_Y, W, fh, pal.floor);

    if (pal.floorStyle === 'carpet') {
      /* 稀疏点阵：周期 13，缩放后不会混叠 */
      for (var y = WALL_Y + 3; y < ROWS; y += 5) {
        for (var x = (y * 7) % 13; x < W; x += 13) px(ctx, x, y, 1, 1, pal.floor2);
      }
    } else if (pal.floorStyle === 'wood') {
      for (var yy = WALL_Y + 4; yy < ROWS; yy += 6) px(ctx, 0, yy, W, 1, pal.floor2);
      for (var xx = 0; xx < W; xx += 23) {
        px(ctx, xx, WALL_Y + 4, 1, 2, pal.floor2);
        px(ctx, (xx + 11) % W, WALL_Y + 10, 1, 2, pal.floor2);
      }
    } else {
      /* 水泥：两块污渍 + 一条缝，够用 */
      px(ctx, Math.round(W * 0.06), WALL_Y + 13, 11, 2, pal.floor2);
      px(ctx, Math.round(W * 0.62), WALL_Y + 17, 8, 1, pal.floor2);
      px(ctx, Math.round(W * 0.35), WALL_Y + 1, W, 1, pal.floor2);
    }

    /* 地面道具贴墙放，压在桌子后面 */
    var baseY = WALL_Y + 13;
    if (pal.props.indexOf('boxes') >= 0) drawBoxes(ctx, Math.round(W * 0.02), baseY);
    if (pal.props.indexOf('cable') >= 0) drawCable(ctx, Math.round(W * 0.05), LEG_BOT + 2);
    if (pal.props.indexOf('plant') >= 0) {
      drawPlant(ctx, Math.round(W * 0.015), baseY);
      if (W > 150) drawPlant(ctx, W - Math.round(W * 0.045), baseY);
    }
    if (pal.props.indexOf('tower') >= 0) drawTower(ctx, W - Math.round(W * 0.05), baseY);
    if (pal.props.indexOf('lamp2') >= 0) drawLamp2(ctx, W - Math.round(W * 0.08), baseY, pal);
  }

  function light(pal, dark) {
    var sx = Math.round(W * pal.lampX);
    var sy = CEIL_H + 5;
    if (pal.props.indexOf('lamp2') >= 0) { sx = W - Math.round(W * 0.08); sy = WALL_Y - 6; }
    var r = Math.max(30, W * 0.20);
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(sx, sy, 2, sx, sy, r);
    g.addColorStop(0, dark ? 'rgba(255,214,150,.26)' : 'rgba(255,214,150,.16)');
    g.addColorStop(0.6, dark ? 'rgba(255,214,150,.07)' : 'rgba(255,214,150,.04)');
    g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, ROWS);
    ctx.globalCompositeOperation = 'source-over';
  }

  function grade(dark) {
    /* 暗色主题只做很轻的压暗（原来 34% 会把整幅图压成黑的） */
    if (dark) px(ctx, 0, 0, W, ROWS, 'rgba(8,7,6,.10)');
    var g = ctx.createLinearGradient(0, 0, 0, ROWS);
    g.addColorStop(0, 'rgba(0,0,0,.16)');
    g.addColorStop(0.35, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.14)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, ROWS);
  }

  /* ---------------- 尺寸 & 循环 ---------------- */
  function fit() {
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var cssW = Math.max(60, Math.round(rect.width || canvas.clientWidth || 600));
    var cssH = Math.max(ROWS, Math.round(rect.height || 150));
    var scale = cssH / ROWS;
    var cols = Math.max(40, Math.round(cssW / scale));
    if (cols !== W || canvas.height !== ROWS) {
      W = cols;
      canvas.width = W;
      canvas.height = ROWS;
      dirty = true;
    }
  }

  function tick() {
    if (!mounted) return;
    if (dirty) fit();
    var f = Math.floor(Date.now() / 170) % 2;
    if (f !== frame) { frame = f; dirty = true; }
    if (dirty) { dirty = false; render(); }
    timer = window.requestAnimationFrame(tick);
  }

  O.mount = function (canvasEl) {
    if (!canvasEl || !canvasEl.getContext) return false;
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.imageSmoothingEnabled = false;
    mounted = true;
    fit();
    if (window.ResizeObserver) {
      try { new ResizeObserver(function () { dirty = true; }).observe(canvas); } catch (e) { }
    }
    window.addEventListener('resize', function () { dirty = true; });
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      render();
      return true;
    }
    timer = window.requestAnimationFrame(tick);
    return true;
  };

  O.sync = function (nextState) {
    state = nextState || state;
    if (!state) return;
    var sig = [
      state.phase,
      state.seats,
      (state.staff || []).length,
      Math.floor((state.day || 0) / 30),
      state.plan && state.plan.leader
    ].join('|');
    if (sig !== lastSig) { lastSig = sig; dirty = true; }
  };

  O.invalidate = function () { dirty = true; };

  /* 同步渲染一帧：给测试、截图和无动画环境用 */
  O.renderNow = function () {
    if (!ctx) return false;
    fit();
    render();
    dirty = false;
    return true;
  };

  O.stop = function () {
    mounted = false;
    if (timer) window.cancelAnimationFrame(timer);
    timer = 0;
  };

})(window.GD = window.GD || {});
