/* ============================================================
 * config.js —— 数值、文案、时代表
 * 想调平衡，只改这一个文件。
 * 无构建、无依赖：挂在全局 GD 上，用普通 <script> 顺序加载。
 *
 * 费用标定原则：以「开局每秒收入」为基准，
 *   员工 ≈ 20 秒收入、工具 ≈ 70 秒、引擎 ≈ 250 秒、项目槽 ≈ 50 秒。
 * ============================================================ */
(function (GD) {
  'use strict';

  /* ---------- 数字格式化 ---------- */
  var SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  GD.fmt = function (n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + GD.fmt(-n);
    if (n < 1000) return n < 10 ? String(Math.round(n * 10) / 10) : String(Math.floor(n));
    var tier = Math.floor(Math.log10(n) / 3);
    if (tier >= SUFFIX.length) return n.toExponential(2);
    var scaled = n / Math.pow(1000, tier);
    var digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    return scaled.toFixed(digits) + SUFFIX[tier];
  };

  GD.fmtMoney = function (n) { return '$' + GD.fmt(n); };

  GD.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  /* ---------- 全局常量 ---------- */
  GD.SAVE_KEY = 'gameDevPipeline.save.v1';
  GD.TICK_MS = 100;                 // 逻辑步长
  GD.SAVE_EVERY_MS = 8000;          // 自动存档间隔
  GD.OFFLINE_CAP = 8 * 3600;        // 最多结算 8 小时
  GD.OFFLINE_STEP = 5;              // 离线按 5 秒一步模拟
  GD.BURST_DURATION = 8;            // 灵感迸发持续秒数
  GD.BURST_COOLDOWN = 26;           // 冷却秒数
  GD.BURST_MULT = 2.5;
  GD.MAX_SLOTS = 6;

  /* ---------- 传承（跨时代永久加成） ---------- */
  GD.LEGACY = [
    {
      id: 'cash', name: '启动资金',
      desc: '每次进入新时代，账户里多一笔钱',
      max: 12,
      cost: function (lv) { return Math.ceil(2 * Math.pow(1.75, lv)); },
      effectText: function (lv, era) { return '起始 $' + GD.fmt((era ? era.price * 2 : 100) * lv); }
    },
    {
      id: 'speed', name: '方法论',
      desc: '所有部门的产能永久提升',
      max: 12,
      cost: function (lv) { return Math.ceil(3 * Math.pow(1.8, lv)); },
      effectText: function (lv) { return '产能 ×' + (1 + 0.12 * lv).toFixed(2); }
    },
    {
      id: 'offline', name: '远程办公',
      desc: '离线收益效率提升',
      max: 6,
      cost: function (lv) { return Math.ceil(4 * Math.pow(2.1, lv)); },
      effectText: function (lv) { return '离线 ' + Math.round((0.5 + 0.08 * lv) * 100) + '%'; }
    },
    {
      id: 'crew', name: '核心班底',
      desc: '每次进入新时代，每个部门自带一名老员工',
      max: 6,
      cost: function (lv) { return Math.ceil(5 * Math.pow(2.3, lv)); },
      effectText: function (lv) { return '起始 ' + (1 + lv) + ' 人/部门'; }
    }
  ];

  /* ---------- 时代表 ----------
   * eff：单个员工的基础产能（时代越晚，工具越强）
   * stages[].need：完成 size=1 的项目在该部门需要的进度 = eff × 秒数
   * price：size=1 作品的基础售价
   * 目标统一是「本时代发行 N 部作品」
   */
  GD.ERAS = [
    {
      key: 'arcade',
      year: '1972',
      name: '街机黎明',
      tagline: '一枚硬币，两块挡板，一个行业。',
      intro: '你在车库里用示波器做出第一个会动的光点。没有引擎、没有美术、没有发行商——只有你、一卷打孔纸带，和一台不肯散热的机器。',
      price: 10,
      eff: 1,
      startCash: 0,
      sizes: [{ size: 1, w: 0.7 }, { size: 2, w: 0.3 }],
      stages: [
        { id: 'concept', name: '概念', icon: '✎', need: 5 },
        { id: 'code', name: '程序', icon: '⌨', need: 12 }
      ],
      wages: { concept: 14, code: 20 },
      wageGrowth: 1.18,
      tools: [
        { id: 'a_concept', stage: 'concept', name: '餐巾纸草图', mult: 1.7, cost: 30 },
        { id: 'a_code', stage: 'code', name: '汇编宏库', mult: 1.7, cost: 40 }
      ],
      engine: { name: '自研街机基板', mult: 1.3, cost: 46 },
      slotCost: 40,
      slotGrowth: 1.9,
      goal: { releases: 10 },
      words: {
        pre: ['像素', '太空', '迷宫', '弹球', '赛车', '方块'],
        post: ['入侵者', '大冒险', '对决', '冲刺', '传说', '弹珠']
      },
      nextHint: '家用机把游戏搬进了客厅。'
    },

    {
      key: 'nes',
      year: '1985',
      name: '8 位家用机',
      tagline: '客厅里的战争。',
      intro: '卡带、手柄、电视机。玩家第一次不用投币就能玩上一整晚。你需要一支真正的团队：程序、美术、音效——而且做完还不算完，卡带要一片片压出来。开发再快，出厂跟不上也没用。',
      price: 50,
      eff: 5,
      startCash: 80,
      sizes: [{ size: 1, w: 0.5 }, { size: 2, w: 0.35 }, { size: 3, w: 0.15 }],
      stages: [
        { id: 'concept', name: '概念', icon: '✎', need: 30 },
        { id: 'code', name: '程序', icon: '⌨', need: 45 },
        { id: 'art', name: '美术', icon: '◈', need: 35 },
        { id: 'audio', name: '音效', icon: '♪', need: 20 }
      ],
      wages: { concept: 60, code: 80, art: 68, audio: 50 },
      wageGrowth: 1.18,
      tools: [
        { id: 'b_concept', stage: 'concept', name: '关卡设计手册', mult: 1.7, cost: 110 },
        { id: 'b_code', stage: 'code', name: '图形加速芯片', mult: 1.7, cost: 140 },
        { id: 'b_art', stage: 'art', name: '像素绘图板', mult: 1.7, cost: 120 },
        { id: 'b_audio', stage: 'audio', name: 'FM 音源芯片', mult: 1.7, cost: 90 }
      ],
      engine: { name: '滚动卷轴引擎', mult: 1.3, cost: 190 },
      slotCost: 160,
      slotGrowth: 1.9,
      goal: { releases: 14 },
      /* 本时代专属：卡带必须真的生产出来。
       * 出厂速度被产线节拍封顶，开发再快也得等产线；产线可以花钱扩。 */
      line: {
        name: '卡带产线',
        base: 0.12,       // 部 / 秒（约 8 秒一部）
        mult: 1.6,
        cost: 120,
        growth: 1.8,
        desc: '就算开发完了，卡带也得一片片压出来。'
      },
      words: {
        pre: ['超级', '影子', '忍者', '魔界', '银河', '热血'],
        post: ['兄弟', '冒险', '战记', '物语', '传说', '奇兵']
      },
      nextHint: '十六位色与光盘，把游戏变成了电影。'
    },

    {
      key: 'pc16',
      year: '1995',
      name: '16 位与 PC',
      tagline: '光盘转动的声音，就是野心。',
      intro: '光盘容量突然变大，玩家开始要求剧情、配乐、过场动画。测试部门第一次成为必需品。进度卡在某个部门时，你可以花钱把整个部门的活外包出去——只是这笔钱花得心疼。',
      price: 300,
      eff: 30,
      startCash: 500,
      sizes: [{ size: 1, w: 0.4 }, { size: 2, w: 0.4 }, { size: 3, w: 0.2 }],
      stages: [
        { id: 'concept', name: '概念', icon: '✎', need: 180 },
        { id: 'code', name: '程序', icon: '⌨', need: 300 },
        { id: 'art', name: '美术', icon: '◈', need: 240 },
        { id: 'audio', name: '音效', icon: '♪', need: 150 },
        { id: 'polish', name: '测试', icon: '✓', need: 120 }
      ],
      wages: { concept: 330, code: 440, art: 380, audio: 290, polish: 250 },
      wageGrowth: 1.18,
      tools: [
        { id: 'c_concept', stage: 'concept', name: '剧本工坊', mult: 1.7, cost: 580 },
        { id: 'c_code', stage: 'code', name: 'C 编译器', mult: 1.7, cost: 750 },
        { id: 'c_art', stage: 'art', name: '3D 建模软件', mult: 1.7, cost: 650 },
        { id: 'c_audio', stage: 'audio', name: 'CD 音轨', mult: 1.7, cost: 500 },
        { id: 'c_polish', stage: 'polish', name: '自动化测试', mult: 1.7, cost: 450 }
      ],
      engine: { name: '自研 3D 软渲染', mult: 1.3, cost: 985 },
      slotCost: 820,
      slotGrowth: 1.9,
      goal: { releases: 17 },
      /* 本时代专属：外包。钱可以买时间——按剩余工作量付费，立刻清空某个部门的积压。 */
      outsource: {
        rate: 0.55,   // 相当于该作品收入的 55%，越早介入越贵
        label: '外包'
      },
      words: {
        pre: ['暗黑', '星际', '极速', '幻境', '铁血', '最终'],
        post: ['远征', '指挥官', '幻想', '战线', '余晖', '战记']
      },
      nextHint: '显卡、互联网、和一群通宵的人。'
    },

    {
      key: 'polygon',
      year: '2005',
      name: '3D 与在线',
      tagline: '多边形数量就是排面。',
      intro: '硬件每 18 个月翻倍，玩家开始用显卡跑分。你在做一件以前无法想象的事：让上千人同时出现在同一个世界里。',
      price: 2000,
      eff: 200,
      startCash: 3000,
      sizes: [{ size: 1, w: 0.35 }, { size: 2, w: 0.4 }, { size: 3, w: 0.25 }],
      stages: [
        { id: 'concept', name: '概念', icon: '✎', need: 1000 },
        { id: 'code', name: '程序', icon: '⌨', need: 1800 },
        { id: 'art', name: '美术', icon: '◈', need: 1400 },
        { id: 'audio', name: '音效', icon: '♪', need: 800 },
        { id: 'polish', name: '测试', icon: '✓', need: 800 }
      ],
      wages: { concept: 2600, code: 3400, art: 3000, audio: 2300, polish: 2000 },
      wageGrowth: 1.18,
      tools: [
        { id: 'd_concept', stage: 'concept', name: '关卡编辑器', mult: 1.7, cost: 4600 },
        { id: 'd_code', stage: 'code', name: '物理中间件', mult: 1.7, cost: 6000 },
        { id: 'd_art', stage: 'art', name: '法线贴图流程', mult: 1.7, cost: 5200 },
        { id: 'd_audio', stage: 'audio', name: '环绕声混音', mult: 1.7, cost: 4100 },
        { id: 'd_polish', stage: 'polish', name: '兼容性实验室', mult: 1.7, cost: 3800 }
      ],
      engine: { name: '自研网络引擎', mult: 1.3, cost: 7860 },
      slotCost: 6600,
      slotGrowth: 1.9,
      goal: { releases: 19 },
      words: {
        pre: ['赛博', '末日', '暗影', '钢铁', '量子', '深渊'],
        post: ['协议', '前线', '裂痕', '回响', '纪元', '行动']
      },
      nextHint: '每个人都有一块屏幕，而且永远在线。'
    },

    {
      key: 'mobile',
      year: '2013',
      name: '移动与独立',
      tagline: '口袋里的一千款游戏。',
      intro: '渠道变了，玩家变了，赚钱的方式也变了。三个人做出的小游戏可能比三千万美元的大作更赚钱——但前提是，你得懂运营。',
      price: 15000,
      eff: 1500,
      startCash: 20000,
      sizes: [{ size: 1, w: 0.3 }, { size: 2, w: 0.4 }, { size: 3, w: 0.3 }],
      stages: [
        { id: 'concept', name: '概念', icon: '✎', need: 7500 },
        { id: 'code', name: '程序', icon: '⌨', need: 13500 },
        { id: 'art', name: '美术', icon: '◈', need: 10500 },
        { id: 'audio', name: '音效', icon: '♪', need: 6000 },
        { id: 'polish', name: '运营', icon: '◎', need: 6000 }
      ],
      wages: { concept: 21000, code: 27000, art: 24000, audio: 18500, polish: 16000 },
      wageGrowth: 1.18,
      tools: [
        { id: 'e_concept', stage: 'concept', name: '数据选品', mult: 1.7, cost: 36000 },
        { id: 'e_code', stage: 'code', name: '跨平台套件', mult: 1.7, cost: 48000 },
        { id: 'e_art', stage: 'art', name: '美术外包管线', mult: 1.7, cost: 42000 },
        { id: 'e_audio', stage: 'audio', name: '免版权音库', mult: 1.7, cost: 32000 },
        { id: 'e_polish', stage: 'polish', name: 'A/B 测试系统', mult: 1.7, cost: 30000 }
      ],
      engine: { name: '商业化 SDK', mult: 1.3, cost: 62000 },
      slotCost: 52000,
      slotGrowth: 1.9,
      goal: { releases: 21 },
      words: {
        pre: ['放置', '合成', '塔防', '休闲', '奇幻', '迷你'],
        post: ['大亨', '传奇', '物语', '远征', '日记', '工坊']
      },
      nextHint: '游戏不再是一个产品，而是一项长期服务。'
    },

    {
      key: 'live',
      year: '2022',
      name: '服务型时代',
      tagline: '上线只是开始。',
      intro: '赛季、通行证、社区、创作者经济。你做的已经不只是一个游戏，而是一个持续十年、跨越所有平台的宇宙。',
      price: 120000,
      eff: 12000,
      startCash: 150000,
      sizes: [{ size: 1, w: 0.25 }, { size: 2, w: 0.4 }, { size: 3, w: 0.35 }],
      stages: [
        { id: 'concept', name: '概念', icon: '✎', need: 60000 },
        { id: 'code', name: '程序', icon: '⌨', need: 108000 },
        { id: 'art', name: '美术', icon: '◈', need: 84000 },
        { id: 'audio', name: '音效', icon: '♪', need: 48000 },
        { id: 'polish', name: '长线运营', icon: '◎', need: 48000 }
      ],
      wages: { concept: 170000, code: 220000, art: 195000, audio: 150000, polish: 130000 },
      wageGrowth: 1.18,
      tools: [
        { id: 'f_concept', stage: 'concept', name: '玩家共创平台', mult: 1.7, cost: 304000 },
        { id: 'f_code', stage: 'code', name: '云原生后端', mult: 1.7, cost: 390000 },
        { id: 'f_art', stage: 'art', name: '程序化内容生成', mult: 1.7, cost: 350000 },
        { id: 'f_audio', stage: 'audio', name: '自适应配乐', mult: 1.7, cost: 280000 },
        { id: 'f_polish', stage: 'polish', name: '实时数据看板', mult: 1.7, cost: 260000 }
      ],
      engine: { name: '全球发行网络', mult: 1.3, cost: 520000 },
      slotCost: 430000,
      slotGrowth: 1.9,
      goal: { releases: 24 },
      words: {
        pre: ['开放世界', '服务型', '跨平台', '云原生', '共创', '长线'],
        post: ['宇宙', '生态', '平台', '赛季', '传奇', '计划']
      },
      nextHint: '你写下的每一行代码，都变成了这个行业的历史。'
    }
  ];

  /* ---------- 阶段配色 ---------- */
  GD.STAGE_STYLE = {
    concept: { color: '#e8b04b' },
    code: { color: '#4fc3a1' },
    art: { color: '#d98bd8' },
    audio: { color: '#7fb2ff' },
    polish: { color: '#ff8f6b' }
  };

  /* ---------- 工具函数 ---------- */
  GD.pickSize = function (sizes) {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < sizes.length; i++) {
      acc += sizes[i].w;
      if (r <= acc) return sizes[i].size;
    }
    return sizes[sizes.length - 1].size;
  };

  GD.pickName = function (words, used) {
    var pre = words.pre, post = words.post;
    for (var attempt = 0; attempt < 12; attempt++) {
      var name = pre[(Math.random() * pre.length) | 0] + post[(Math.random() * post.length) | 0];
      if (!used || used.indexOf(name) === -1) return name;
    }
    return pre[(Math.random() * pre.length) | 0] + post[(Math.random() * post.length) | 0];
  };

})(window.GD = window.GD || {});
