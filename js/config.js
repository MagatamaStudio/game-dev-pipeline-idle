/* ============================================================
 * config.js —— M0 数据表
 * 5 类型 × 5 题材、3 名员工、4 位评审、4 个事件、1 个平台
 * ============================================================ */
(function (GD) {
  'use strict';

  /* ---------------- 平台 ---------------- */
  GD.PLATFORM = {
    code: 'L-3',
    alias: '客厅盒',
    year: 1983,
    cap: 58,          // 品质上限
    price: 22,        // 单价
    license: 15000,   // 授权费
    install: 1.6      // 销量系数
  };

  /* ---------------- 类型 ---------------- */
  GD.GENRES = [
    { id: 'rpg', name: 'RPG', icon: '⚔', weights: { code: .25, script: .40, art: .20, audio: .15 } },
    { id: 'action', name: '动作', icon: '✦', weights: { code: .45, script: .15, art: .25, audio: .15 } },
    { id: 'shooter', name: '射击', icon: '◎', weights: { code: .40, script: .15, art: .25, audio: .20 } },
    { id: 'adv', name: '冒险', icon: '❖', weights: { code: .20, script: .40, art: .25, audio: .15 } },
    { id: 'sim', name: '模拟', icon: '⚙', weights: { code: .35, script: .20, art: .30, audio: .15 } }
  ];

  /* ---------------- 题材 ---------------- */
  GD.THEMES = [
    { id: 'fantasy', name: '幻想', icon: '☾' },
    { id: 'scifi', name: '科幻', icon: '◈' },
    { id: 'medieval', name: '中世纪', icon: '⚑' },
    { id: 'modern', name: '现代', icon: '▤' },
    { id: 'warring', name: '战国', icon: '⚔' }
  ];

  /* 相性表：行=类型，列=题材（顺序同上） */
  GD.COMBO = {
    rpg: { fantasy: 1.35, scifi: 1.15, medieval: 1.25, modern: 0.95, warring: 1.30 },
    action: { fantasy: 1.05, scifi: 1.10, medieval: 1.10, modern: 1.15, warring: 1.15 },
    shooter: { fantasy: 0.95, scifi: 1.20, medieval: 0.85, modern: 1.10, warring: 0.90 },
    adv: { fantasy: 1.15, scifi: 1.10, medieval: 1.25, modern: 1.05, warring: 1.05 },
    sim: { fantasy: 1.00, scifi: 1.05, medieval: 1.05, modern: 1.20, warring: 1.00 }
  };

  /* ---------------- 员工 ---------------- */
  GD.STAFF = [
    {
      id: 'zhou', name: '老周', seed: 7, role: '剧本',
      stats: { code: 18, script: 42, art: 15, audio: 20, speed: 30 },
      quote: '故事讲不好，画面再花也没用。'
    },
    {
      id: 'lin', name: '小林', seed: 23, role: '程序',
      stats: { code: 45, script: 15, art: 22, audio: 18, speed: 35 },
      quote: '手感，一切都是手感。'
    },
    {
      id: 'ya', name: '阿雅', seed: 41, role: '美术',
      stats: { code: 12, script: 20, art: 44, audio: 25, speed: 28 },
      quote: '我要玩家第一眼就记住这个世界。'
    }
  ];

  GD.STAT_NAMES = { code: '程序', script: '剧本', art: '美术', audio: '音效', speed: '速度' };

  /* ---------------- 评审 ---------------- */
  GD.CRITICS = [
    {
      id: 'chen', name: '老陈', tag: '纸媒老炮', seed: 3,
      fav: 'rpg', hate: 'shooter', bias: 1.4,
      lines: {
        low: ['我玩了三个小时，还是不知道主角想干嘛。', '这种东西也配叫 RPG？'],
        mid: ['故事还行，可惜系统太单薄。', '中规中矩，我会给它一个及格分。'],
        high: ['这代人的 RPG 记忆，会从这一部开始。', '很久没为一款游戏熬夜了。']
      }
    },
    {
      id: 'lin2', name: '小林', tag: '前职业选手', seed: 11,
      fav: 'action', hate: 'sim', bias: 1.4,
      lines: {
        low: ['输入延迟有一帧，我就没法玩。', '手感像在糖浆里挥拳。'],
        mid: ['判定还行，节奏可以再快一点。', '能玩，但打不出爽感。'],
        high: ['这个手感，我想打职业。', '每一帧都在回应我的操作。']
      }
    },
    {
      id: 'ya2', name: '阿雅', tag: '插画师', seed: 19,
      fav: 'adv', hate: 'shooter', bias: 1.2,
      lines: {
        low: ['配色像打翻的调色盘。', '我闭上了眼睛，画面更好看。'],
        mid: ['有几张场景我愿意截图。', '美术有想法，执行还差一口气。'],
        high: ['我想把每一帧都画下来。', '这不是游戏，是一本会动的画册。']
      }
    },
    {
      id: 'k', name: '老K', tag: '电视主持', seed: 31,
      fav: null, hate: null, bias: 0.6,
      lines: {
        low: ['观众朋友们，这款我们就跳过了。', '嗯……下一款。'],
        mid: ['周末可以试试，别抱太大期望。', '中规中矩，适合打发时间。'],
        high: ['年度节目必须给它一期专题。', '我太太都在玩这个。']
      }
    }
  ];

  /* ---------------- 事件 ---------------- */
  GD.EVENTS = [
    {
      id: 'inspire',
      title: '灵感迸发',
      body: '凌晨三点，主创突然冲进办公室，说他想到一个能让整部作品升华的点子。',
      options: [
        { label: '通宵做出来', cost: 0, quality: 8, progress: -6, tip: '品质 +8%，进度倒退一点' },
        { label: '按原计划走', cost: 0, quality: 0, progress: 0, tip: '不冒险' }
      ]
    },
    {
      id: 'disk',
      title: '硬盘烧了',
      body: '三周的工程文件，随着一阵焦味消失了。备份停留在两周前。',
      options: [
        { label: '花钱做数据恢复', cost: 15000, quality: 0, progress: 0, tip: '花 $15,000，进度无损' },
        { label: '重做一遍', cost: 0, quality: -2, progress: -12, tip: '进度 −12%，品质 −2%' }
      ]
    },
    {
      id: 'fight',
      title: '程序和美术吵起来了',
      body: '「这个特效根本跑不动！」「那是你的代码烂！」两个人已经三天没说话。',
      options: [
        { label: '请大家吃顿好的', cost: 8000, quality: 2, progress: 0, tip: '花 $8,000，品质 +2%' },
        { label: '让他们自己解决', cost: 0, quality: -5, progress: 0, tip: '品质 −5%' }
      ]
    },
    {
      id: 'bug',
      title: '测试挖出一个神级 Bug',
      body: '角色在特定操作下会穿墙，然后掉进一个没做完的隐藏房间。好像……还挺好玩？',
      options: [
        { label: '修掉它', cost: 0, quality: -1, progress: -8, tip: '进度 −8%，品质 −1%' },
        { label: '做成彩蛋', cost: 0, quality: 5, progress: 0, tip: '品质 +5%' }
      ]
    }
  ];

  /* ---------------- 数值 ---------- */
  GD.BAL = {
    startMoney: 500000,
    devCost: 130000,          // 每部作品的固定成本
    devSeconds: 54,           // 基础开发时长（会被主创速度削减）
    speedFactor: 0.4,
    eventAt: 0.45,            // 进度到 45% 触发事件
    reviewPerCritic: 1.1,     // 每位评审亮分间隔
    reviewTail: 1.4,          // 总分亮出后的停顿
    salesWeeks: 12,
    salesWeekSeconds: 2.0,
    salesBase: 12000,
    adCost: 50000,
    adBoost: 1.4,
    fanPerCopy: 1 / 500,
    rescue: 200000
  };

  /* 周销量分布（12 周） */
  GD.SALES_CURVE = [0.30, 0.22, 0.14, 0.09, 0.06, 0.045, 0.035, 0.027, 0.021, 0.017, 0.013, 0.011];

})(window.GD = window.GD || {});
