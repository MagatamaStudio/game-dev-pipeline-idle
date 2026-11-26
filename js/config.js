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

  /* ---------------- 事件 ----------------
   * when: early（原型期） / late（打磨期）
   * 效果字段：cost 花钱、quality 品质百分比、progress 进度百分点、sales 销量百分比
   */
  GD.EVENTS = [
    {
      id: 'inspire', when: 'early',
      title: '灵感迸发',
      body: '凌晨三点，主创突然冲进办公室，说他想到一个能让整部作品升华的点子。',
      options: [
        { label: '通宵做出来', cost: 0, quality: 8, progress: -6, tip: '品质 +8%，进度倒退一点' },
        { label: '按原计划走', cost: 0, quality: 0, progress: 0, tip: '不冒险' }
      ]
    },
    {
      id: 'drift', when: 'early',
      title: '方向迷失',
      body: '做到一半，所有人都说不清这游戏到底好玩在哪。原型看起来像一堆积木。',
      options: [
        { label: '推翻重做原型', cost: 0, quality: 5, progress: -10, tip: '品质 +5%，进度 −10%' },
        { label: '硬着头皮往下做', cost: 0, quality: -3, progress: 0, tip: '品质 −3%' }
      ]
    },
    {
      id: 'intern', when: 'early',
      title: '来了个实习生',
      body: '一个大学生愿意免费来帮忙，只要给他一个工位。他看起来什么都不会，但学得很快。',
      options: [
        { label: '让他上手', cost: 6000, quality: 2, progress: 8, tip: '花 $6,000，进度 +8%，品质 +2%' },
        { label: '自己扛', cost: 0, quality: 0, progress: -6, tip: '进度 −6%' }
      ]
    },
    {
      id: 'competitor', when: 'early',
      title: '竞品撞车',
      body: '隔壁公司刚公布了一款新作，玩法和你正在做的一模一样，而且比你先上市。',
      options: [
        { label: '连夜改方向', cost: 0, quality: 4, progress: -8, tip: '品质 +4%，进度 −8%' },
        { label: '硬碰硬', cost: 0, quality: 0, progress: 0, sales: -6, tip: '销量 −6%' }
      ]
    },
    {
      id: 'disk', when: 'late',
      title: '硬盘烧了',
      body: '三周的工程文件，随着一阵焦味消失了。备份停留在两周前。',
      options: [
        { label: '花钱做数据恢复', cost: 15000, quality: 0, progress: 0, tip: '花 $15,000，进度无损' },
        { label: '重做一遍', cost: 0, quality: -2, progress: -12, tip: '进度 −12%，品质 −2%' }
      ]
    },
    {
      id: 'fight', when: 'late',
      title: '程序和美术吵起来了',
      body: '「这个特效根本跑不动！」「那是你的代码烂！」两个人已经三天没说话。',
      options: [
        { label: '请大家吃顿好的', cost: 8000, quality: 2, progress: 0, tip: '花 $8,000，品质 +2%' },
        { label: '让他们自己解决', cost: 0, quality: -5, progress: 0, tip: '品质 −5%' }
      ]
    },
    {
      id: 'outsource', when: 'late',
      title: '外包跑路了',
      body: '约好负责过场动画的外包团队，收了定金之后人间蒸发。',
      options: [
        { label: '换一家', cost: 20000, quality: 0, progress: 0, tip: '花 $20,000，进度无损' },
        { label: '自己补', cost: 0, quality: -2, progress: -15, tip: '进度 −15%，品质 −2%' }
      ]
    },
    {
      id: 'poach', when: 'late',
      title: '主程被挖角',
      body: '一家大公司开出了三倍薪水。他还没答应，但已经在收拾桌子了。',
      options: [
        { label: '加薪留人', cost: 25000, quality: 3, progress: 0, tip: '花 $25,000，品质 +3%' },
        { label: '放他走', cost: 0, quality: -4, progress: -12, tip: '进度 −12%，品质 −4%' }
      ]
    },
    {
      id: 'leak', when: 'late',
      title: '提前泄露',
      body: '一段开发中的视频被传到了网上。评论区都在说“这也太糙了”。',
      options: [
        { label: '花钱做公关', cost: 20000, quality: 0, progress: 0, tip: '花 $20,000，销量不受影响' },
        { label: '不理会', cost: 0, quality: 0, progress: 0, sales: -10, tip: '销量 −10%' }
      ]
    },
    {
      id: 'bug', when: 'late',
      title: '测试挖出一个神级 Bug',
      body: '角色在特定操作下会穿墙，然后掉进一个没做完的隐藏房间。好像……还挺好玩？',
      options: [
        { label: '修掉它', cost: 0, quality: -1, progress: -8, tip: '进度 −8%，品质 −1%' },
        { label: '做成彩蛋', cost: 0, quality: 5, progress: 0, tip: '品质 +5%' }
      ]
    },
    {
      id: 'lastweek', when: 'late',
      title: '最后一周',
      body: '距离收工只剩七天。还有一堆小毛病，但也不是不能发。',
      options: [
        { label: '再压一次', cost: 0, quality: 6, progress: -6, tip: '品质 +6%，进度 −6%' },
        { label: '收工', cost: 0, quality: 0, progress: 0, tip: '就这样吧' }
      ]
    }
  ];

  /* ---------------- 小决定 ----------------
   * 开发期间随机出现，不打断流程，几秒不理会自动消失。
   * 纯可选：不选没有任何惩罚，选了有小收益也有小代价。 */
  GD.MICRO = [
    {
      id: 'polish',
      text: '小林说战斗手感还能再调调。',
      options: [
        { label: '让他改', quality: 3, progress: -2, tip: '品质 +3% · 进度 −2%', result: '小林把战斗手感重做了一遍，凌晨三点发来一句「爽了」。' },
        { label: '先这样' }
      ]
    },
    {
      id: 'art',
      text: '阿雅想给主角加一套走路动画，需要块新绘图板。',
      options: [
        { label: '买', cost: 8000, quality: 2, tip: '花 $8,000 · 品质 +2%', result: '新绘图板第二天就到了。阿雅画了一整天。' },
        { label: '以后再说' }
      ]
    },
    {
      id: 'cut',
      text: '老周提议砍掉一条支线，说没人会走。',
      options: [
        { label: '砍掉', progress: 4, quality: -2, tip: '进度 +4% · 品质 −2%', result: '支线被删了。老周在文档里留了一行「已归档」。' },
        { label: '保留' }
      ]
    },
    {
      id: 'coffee',
      text: '连熬三天，组里的气氛不太对。',
      options: [
        { label: '请全组吃顿好的', cost: 4000, quality: 1, tip: '花 $4,000 · 品质 +1%', result: '一顿火锅之后，办公室又有了笑声。' },
        { label: '继续' }
      ]
    },
    {
      id: 'music',
      text: '音效师说主题曲还能再来一版。',
      options: [
        { label: '再改一版', quality: 2, progress: -3, tip: '品质 +2% · 进度 −3%', result: '第三版主题曲定稿。前两版其实也没人听过。' },
        { label: '用现在的' }
      ]
    },
    {
      id: 'demo',
      text: '有个朋友想先玩玩看。',
      options: [
        { label: '给他 demo', progress: 3, sales: 2, tip: '进度 +3% · 销量 +2%', result: '朋友玩了两小时，提了 40 条建议，其中 3 条有用。' },
        { label: '保密' }
      ]
    },
    {
      id: 'bugs',
      text: '顺手能修掉几个小 bug。',
      options: [
        { label: '修', quality: 2, progress: -2, tip: '品质 +2% · 进度 −2%', result: '修完发现又冒出两个。经典。' },
        { label: '留着' }
      ]
    },
    {
      id: 'fishing',
      text: '有人提议加个钓鱼系统。',
      options: [
        { label: '加', quality: 1, progress: -4, sales: 3, tip: '品质 +1% · 进度 −4% · 销量 +3%', result: '钓鱼系统做了三天，成了后来玩家最喜欢的功能。' },
        { label: '算了' }
      ]
    }
  ];

  /* ---------------- 开发日志 ---------------- */

  GD.DEV_LOG = {
    proto: [
      '小林推倒了物理系统，说这次要一步到位。',
      '老周在餐巾纸上写了三页大纲。',
      '阿雅画了 40 张场景草图，废掉 38 张。',
      '三个人争论了四个小时，最后决定先做出来再说。',
      '有人提议加一个钓鱼系统。被否决了。'
    ],
    build: [
      '第一个可玩版本跑起来了——虽然只有灰色方块。',
      '存档系统炸了一次，回滚到昨天的版本。',
      '小林把加载时间压到了 3 秒以内。',
      '阿雅重做了整个 UI，理由是“看着不舒服”。',
      '老周删掉了第三章，因为“玩家不会看”。',
      '测试用的机器人角色一直卡在墙角。干脆加了个彩蛋。'
    ],
    polish: [
      '音效师给开门声录了 12 个版本。',
      '手柄震动调了三轮，现在手感刚好。',
      '最后一个 Bug 修完，凌晨四点。',
      '老周坚持改了结局的最后一句话。',
      '阿雅给主角加了一个眨眼的动画。没人会注意到。'
    ]
  };

  GD.PHASES = [
    { at: 0, name: '原型' },
    { at: 0.30, name: '制作' },
    { at: 0.70, name: '打磨' }
  ];

  /* ---------------- 档期 ----------------
   * 一年 360 天（12 个月 × 30 天），窗口按「年内第几天」算。
   * 窗口外不发售也能卖，但没有加成——这就是「赶」的理由。 */
  GD.WINDOWS = [
    { id: 'summer', name: '暑期档', start: 150, end: 190, mult: 1.25, tip: '学生放假，装机量最高' },
    { id: 'winter', name: '年末商战', start: 310, end: 350, mult: 1.40, tip: '一年里最贵的一档' }
  ];

  /* ---------------- 数值 ---------- */
  GD.BAL = {
    startMoney: 500000,
    startYear: 1983,
    daysPerYear: 360,

    /* 开发成本 = 平台授权 + 每日工资 × 开发天数
     * 天数往前走，钱就在烧。这是「赶工 / 打磨」有意义的前提。 */
    license: 15000,
    salaryPerDay: 1380,
    daysPerSecond: 2,

    devSeconds: 54,           // 正常速度下的开发时长（会被主创速度削减）
    speedFactor: 0.4,
    eventAts: [0.30, 0.72],   // 每部作品两次事件
    microAt: [0.15, 0.52, 0.88],   // 小决定出现的进度点
    microTtl: 6,                   // 不选就消失

    /* 压货等档期：每多等一天，仓储与资金占用成本 */
    storagePerDay: 900,

    /* 开发档位：随时可切，品质修正按停留时间加权 */
    modes: {
      crunch: { id: 'crunch', name: '赶工', rate: 1.45, quality: -6, tip: '速度 +45% · 品质 −6%' },
      normal: { id: 'normal', name: '正常', rate: 1.0, quality: 0, tip: '按时交付' },
      polish: { id: 'polish', name: '打磨', rate: 0.75, quality: 7, tip: '速度 −25% · 品质 +7%' }
    },

    reviewPerCritic: 1.1,
    reviewTail: 1.4,
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
