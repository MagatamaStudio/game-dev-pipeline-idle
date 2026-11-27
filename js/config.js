/* ============================================================
 * config.js —— M0 数据表
 * 5 类型 × 5 题材、3 名员工、4 位评审、4 个事件、1 个平台
 * ============================================================ */
(function (GD) {
  'use strict';

  /* ---------------- 平台 ----------------
   * 11 个主线平台，1972–2002。安装量 = install × 人气系数（按上市年数递减）。
   * cap 是品质上限，price 是单价，license 是每部作品的授权费。 */
  GD.PLATFORMS = [
    { id: 'arc72', code: 'ARC-72', brand: '雅达瑞', name: '街机板', year: 1972, retire: 1981, install: 2.4, license: 6000, price: 26, cap: 45, fav: 'action' },
    { id: 'l1', code: 'L-1', brand: '雅达瑞', name: '2600', year: 1978, retire: 1987, install: 1.9, license: 9000, price: 18, cap: 50, fav: null },
    { id: 'l3', code: 'L-3', brand: '天任', name: 'FC', year: 1983, retire: 1992, install: 4.0, license: 15000, price: 22, cap: 58, fav: 'action' },
    { id: 'bm', code: 'B-M', brand: '天任', name: '掌上小子', year: 1987, retire: 1995, install: 2.6, license: 11000, price: 14, cap: 48, fav: 'sim' },
    { id: 'i16', code: 'I-16', brand: '世加', name: 'MD', year: 1989, retire: 1998, install: 5.0, license: 26000, price: 30, cap: 66, fav: 'rpg' },
    { id: 'bc', code: 'B-C', brand: '世加', name: '掌上彩', year: 1992, retire: 2001, install: 3.6, license: 18000, price: 20, cap: 56, fav: 'sim' },
    { id: 'icd', code: 'I-CD', brand: '索妮', name: 'PS', year: 1994, retire: 2003, install: 4.3, license: 40000, price: 40, cap: 74, fav: 'adv' },
    { id: 'l64', code: 'L-64', brand: '天任', name: '64', year: 1996, retire: 2005, install: 3.1, license: 45000, price: 46, cap: 78, fav: 'action' },
    { id: 'ba', code: 'B-A', brand: '天任', name: '彩色掌机', year: 1998, retire: 2007, install: 4.8, license: 30000, price: 26, cap: 62, fav: 'rpg' },
    { id: 'i2', code: 'I-2', brand: '索妮', name: '2', year: 2000, retire: 2009, install: 6.0, license: 60000, price: 48, cap: 86, fav: 'action' },
    { id: 'lg', code: 'L-G', brand: '天任', name: '随身网', year: 2002, retire: 2011, install: 3.2, license: 35000, price: 34, cap: 70, fav: 'sim' },

    /* 无尽模式：2002 之后 */
    { id: 'ihd', code: 'I-HD', brand: '微硬', name: '360', year: 2005, retire: 2014, install: 6.5, license: 80000, price: 55, cap: 92, fav: 'shooter' },
    { id: 'dm', code: 'D-M', brand: '天任', name: '体感', year: 2007, retire: 2016, install: 5.5, license: 55000, price: 45, cap: 88, fav: 'sim' },
    { id: 'bd', code: 'B-D', brand: '天任', name: '双屏', year: 2011, retire: 2020, install: 5.0, license: 40000, price: 32, cap: 82, fav: 'adv' },
    { id: 'rm', code: 'R-M', brand: '平果', name: '手机', year: 2013, retire: 2022, install: 9.0, license: 10000, price: 6, cap: 76, fav: 'sim' },
    { id: 'lh', code: 'L-H', brand: '天任', name: '混合', year: 2017, retire: 2026, install: 6.0, license: 50000, price: 60, cap: 95, fav: 'action' },
    { id: 'oc', code: 'O-C', brand: '云阁', name: '云', year: 2021, retire: 2030, install: 7.5, license: 30000, price: 40, cap: 100, fav: 'rpg' },
    { id: 'dv', code: 'D-V', brand: '织梦', name: '头显', year: 2026, retire: 2036, install: 3.0, license: 45000, price: 50, cap: 108, fav: 'adv' },
    { id: 'nl', code: 'N-L', brand: '灵境', name: '神经', year: 2033, retire: 2043, install: 4.0, license: 60000, price: 65, cap: 118, fav: 'rpg' },
    { id: 'op', code: 'O-P', brand: '万象', name: '协议', year: 2040, retire: 2050, install: 8.0, license: 0, price: 45, cap: 125, fav: 'action' },
    { id: 'm1', code: 'M-1', brand: '酣梦', name: '眠机', year: 2047, retire: 2057, install: 5.0, license: 35000, price: 55, cap: 130, fav: 'rpg' },
    { id: 'q1', code: 'Q-1', brand: '全感', name: '舱', year: 2054, retire: 2064, install: 3.5, license: 90000, price: 120, cap: 140, fav: 'adv' },
    { id: 's1', code: 'S-1', brand: '自衍', name: '种子', year: 2061, retire: 2071, install: 7.0, license: 20000, price: 70, cap: 150, fav: 'sim' },
    { id: 'v1', code: 'V-1', brand: '现实层', name: '城市', year: 2068, retire: 2078, install: 9.5, license: 0, price: 80, cap: 160, fav: 'action' },
    { id: 't1', code: 'T-1', brand: '群星', name: '方舟', year: 2075, retire: 2085, install: 4.0, license: 120000, price: 200, cap: 175, fav: 'rpg' }
  ];

  /* 人气系数：按「上市年数」查表，取第一个命中的档 */
  GD.POP = [
    { under: 1, mult: 0.55 },   // 首发年，装机还没铺开
    { under: 2, mult: 0.95 },
    { under: 4, mult: 1.15 },   // 黄金期
    { under: 6, mult: 0.95 },
    { under: 8, mult: 0.6 },
    { under: 10, mult: 0.3 },
    { under: 99, mult: 0.12 }   // 退市边缘
  ];

  /* ---------------- 类型 ---------------- */
  GD.GENRES = [
    { id: 'rpg', name: 'RPG', icon: '⚔', weights: { code: .25, script: .40, art: .20, audio: .15 } },
    { id: 'action', name: '动作', icon: '✦', weights: { code: .45, script: .15, art: .25, audio: .15 } },
    { id: 'shooter', name: '射击', icon: '◎', weights: { code: .40, script: .15, art: .25, audio: .20 } },
    { id: 'adv', name: '冒险', icon: '❖', weights: { code: .20, script: .40, art: .25, audio: .15 } },
    { id: 'sim', name: '模拟', icon: '⚙', weights: { code: .35, script: .20, art: .30, audio: .15 } },
    { id: 'puzzle', name: '解谜', icon: '✧', weights: { code: .35, script: .20, art: .30, audio: .15 } },
    { id: 'sports', name: '体育', icon: '⚡', weights: { code: .35, script: .10, art: .30, audio: .25 } },
    { id: 'strategy', name: '策略', icon: '♜', weights: { code: .40, script: .25, art: .20, audio: .15 } },
    { id: 'horror', name: '恐怖', icon: '☠', weights: { code: .20, script: .35, art: .30, audio: .15 } },
    { id: 'rhythm', name: '音游', icon: '♪', weights: { code: .30, script: .10, art: .25, audio: .35 } }
  ];

  /* ---------------- 题材 ---------------- */
  GD.THEMES = [
    { id: 'fantasy', name: '幻想', icon: '☾' },
    { id: 'scifi', name: '科幻', icon: '◈' },
    { id: 'medieval', name: '中世纪', icon: '⚑' },
    { id: 'modern', name: '现代', icon: '▤' },
    { id: 'warring', name: '战国', icon: '⚔' },
    { id: 'cyber', name: '赛博', icon: '⌁' },
    { id: 'myth', name: '神话', icon: '✶' },
    { id: 'school', name: '校园', icon: '✎' },
    { id: 'post', name: '末世', icon: '▨' },
    { id: 'idol', name: '偶像', icon: '♡' }
  ];

  /* 相性表：行=类型，列=题材，10×10 全填。
   * ≥1.30 的算「王牌组合」，一共 12 格（见 E.isLegendary）；其余自动生成评语。 */
  GD.COMBO = {
    rpg: { fantasy: 1.35, scifi: 1.15, medieval: 1.25, modern: 0.95, warring: 1.30, cyber: 1.05, myth: 1.30, school: 0.90, post: 1.10, idol: 0.85 },
    action: { fantasy: 1.05, scifi: 1.10, medieval: 1.10, modern: 1.15, warring: 1.15, cyber: 1.30, myth: 1.05, school: 0.95, post: 1.15, idol: 0.90 },
    shooter: { fantasy: 0.95, scifi: 1.20, medieval: 0.85, modern: 1.10, warring: 0.90, cyber: 1.15, myth: 0.90, school: 0.85, post: 1.30, idol: 0.80 },
    adv: { fantasy: 1.15, scifi: 1.10, medieval: 1.25, modern: 1.05, warring: 1.05, cyber: 1.15, myth: 1.20, school: 1.20, post: 1.15, idol: 1.00 },
    sim: { fantasy: 1.00, scifi: 1.05, medieval: 1.05, modern: 1.20, warring: 1.00, cyber: 1.10, myth: 0.95, school: 1.30, post: 1.00, idol: 1.20 },
    puzzle: { fantasy: 1.10, scifi: 1.10, medieval: 1.05, modern: 1.10, warring: 1.00, cyber: 1.20, myth: 1.15, school: 1.10, post: 1.05, idol: 1.00 },
    sports: { fantasy: 1.00, scifi: 1.00, medieval: 0.95, modern: 1.20, warring: 1.00, cyber: 1.05, myth: 1.00, school: 1.30, post: 1.05, idol: 1.15 },
    strategy: { fantasy: 1.10, scifi: 1.20, medieval: 1.30, modern: 1.00, warring: 1.35, cyber: 1.15, myth: 1.15, school: 0.90, post: 1.15, idol: 0.85 },
    horror: { fantasy: 1.05, scifi: 1.10, medieval: 1.15, modern: 1.10, warring: 0.95, cyber: 1.20, myth: 1.30, school: 1.20, post: 1.30, idol: 0.85 },
    rhythm: { fantasy: 1.00, scifi: 1.05, medieval: 0.90, modern: 1.15, warring: 0.90, cyber: 1.20, myth: 1.00, school: 1.25, post: 1.00, idol: 1.35 }
  };

  /* ---------------- 员工 ----------------
   * 前三位是创始人，其余是招聘池。
   * role 用于升级时的成长方向；salary 是日薪。 */
  GD.ROSTER = [
    { id: 'zhou', name: '老周', seed: 7, role: 'script', salary: 460, quote: '故事讲不好，画面再花也没用。', stats: { code: 18, script: 42, art: 15, audio: 20, speed: 30 } },
    { id: 'lin', name: '小林', seed: 23, role: 'code', salary: 480, quote: '手感，一切都是手感。', stats: { code: 45, script: 15, art: 22, audio: 18, speed: 35 } },
    { id: 'ya', name: '阿雅', seed: 41, role: 'art', salary: 440, quote: '我要玩家第一眼就记住这个世界。', stats: { code: 12, script: 20, art: 44, audio: 25, speed: 28 } },

    { id: 'song', name: '老宋', seed: 58, role: 'code', salary: 560, quote: '代码写干净，改需求的时候才不慌。', stats: { code: 38, script: 20, art: 18, audio: 22, speed: 26 } },
    { id: 'man', name: '小满', seed: 66, role: 'art', salary: 540, quote: '给我三天，我给你一座城。', stats: { code: 14, script: 24, art: 36, audio: 20, speed: 30 } },
    { id: 'kang', name: '阿康', seed: 73, role: 'audio', salary: 520, quote: '声音是最容易被忽略的那一半。', stats: { code: 16, script: 14, art: 18, audio: 40, speed: 25 } },
    { id: 'xi', name: '林夕', seed: 81, role: 'script', salary: 600, quote: '玩家记不住系统，只记得住人。', stats: { code: 20, script: 38, art: 22, audio: 16, speed: 27 } },
    { id: 'bear', name: '大熊', seed: 88, role: 'code', salary: 680, quote: '给我一周，没有我做不出来的东西。', stats: { code: 42, script: 12, art: 14, audio: 14, speed: 22 } },
    { id: 'qi', name: '小七', seed: 95, role: 'art', salary: 640, quote: '配色不对，我睡不着。', stats: { code: 18, script: 18, art: 40, audio: 24, speed: 32 } },
    { id: 'li', name: '老李', seed: 102, role: 'code', salary: 500, quote: '做了十年，什么坑没见过。', stats: { code: 34, script: 26, art: 20, audio: 18, speed: 20 } },
    { id: 'may', name: '阿May', seed: 111, role: 'audio', salary: 580, quote: '音乐一响，玩家就知道该紧张了。', stats: { code: 12, script: 20, art: 26, audio: 34, speed: 28 } },
    { id: 'zhao', name: '小赵', seed: 118, role: 'script', salary: 520, quote: '我什么都干一点，什么都还行。', stats: { code: 24, script: 26, art: 24, audio: 24, speed: 30 } },

    /* ---- 程序 ---- */
    { id: 'qiang', name: '阿强', seed: 126, role: 'code', salary: 420, quote: '能跑就行，先能跑。', stats: { code: 32, script: 16, art: 16, audio: 14, speed: 34 } },
    { id: 'deep', name: '老深', seed: 133, role: 'code', salary: 760, quote: '我不赶工。赶工的东西我不签名。', stats: { code: 48, script: 22, art: 16, audio: 14, speed: 18 } },
    { id: 'mo', name: '阿墨', seed: 140, role: 'code', salary: 470, quote: '架构做对了，后面都是填格子。', stats: { code: 30, script: 24, art: 20, audio: 16, speed: 28 } },
    { id: 'tang', name: '小唐', seed: 147, role: 'code', salary: 610, quote: '真机跑过才算数。', stats: { code: 40, script: 18, art: 22, audio: 18, speed: 31 } },
    { id: 'nine', name: '阿九', seed: 154, role: 'code', salary: 380, quote: '我便宜，但我学得快。', stats: { code: 26, script: 14, art: 18, audio: 16, speed: 36 } },

    /* ---- 剧本 ---- */
    { id: 'wen', name: '阿文', seed: 161, role: 'script', salary: 500, quote: '先把人写活，玩家才在乎他死不死。', stats: { code: 18, script: 34, art: 20, audio: 18, speed: 27 } },
    { id: 'lu', name: '陆姐', seed: 168, role: 'script', salary: 720, quote: '我写过三十个结局，只有两个是真的。', stats: { code: 16, script: 46, art: 22, audio: 20, speed: 19 } },
    { id: 'bei', name: '小北', seed: 175, role: 'script', salary: 430, quote: '节奏，节奏比文笔重要。', stats: { code: 22, script: 28, art: 18, audio: 20, speed: 33 } },
    { id: 'shen', name: '老沈', seed: 182, role: 'script', salary: 560, quote: '世界观不是设定集，是规矩。', stats: { code: 26, script: 36, art: 16, audio: 14, speed: 22 } },
    { id: 'yao', name: '幺妹', seed: 189, role: 'script', salary: 400, quote: '我写的台词，我自己先哭一遍。', stats: { code: 16, script: 24, art: 26, audio: 22, speed: 30 } },

    /* ---- 美术 ---- */
    { id: 'da', name: '阿大', seed: 196, role: 'art', salary: 660, quote: '角色站不住，场景再美也没用。', stats: { code: 16, script: 18, art: 46, audio: 22, speed: 24 } },
    { id: 'miao', name: '喵喵', seed: 203, role: 'art', salary: 450, quote: '给我两小时，我给你三版。', stats: { code: 14, script: 22, art: 30, audio: 24, speed: 34 } },
    { id: 'jiu', name: '老酒', seed: 210, role: 'art', salary: 590, quote: '颜色要有味道。', stats: { code: 20, script: 26, art: 38, audio: 18, speed: 20 } },
    { id: 'ling', name: '小铃', seed: 217, role: 'art', salary: 410, quote: '我不太会画人，但我会画气氛。', stats: { code: 18, script: 20, art: 26, audio: 28, speed: 31 } },

    /* ---- 音效 ---- */
    { id: 'tone', name: '老音', seed: 224, role: 'audio', salary: 700, quote: '十几秒的循环，我能做一个月。', stats: { code: 18, script: 16, art: 20, audio: 44, speed: 21 } },
    { id: 'beibei', name: '贝贝', seed: 231, role: 'audio', salary: 440, quote: '这段旋律你听三遍就会哼了。', stats: { code: 14, script: 18, art: 24, audio: 30, speed: 32 } },
    { id: 'wa', name: '瓦片', seed: 238, role: 'audio', salary: 380, quote: '音效嘛，对就行。', stats: { code: 20, script: 16, art: 18, audio: 24, speed: 35 } },
    { id: 'mumu', name: '木木', seed: 245, role: 'audio', salary: 540, quote: '安静也是声音的一部分。', stats: { code: 16, script: 22, art: 20, audio: 36, speed: 26 } }
  ];

  /* 员工特质：由 seed 确定性派生，每人 2 个，不占存档字段。
   * 效果全是百分比，挂在已有的团队聚合函数上：
   *   speedPct   开发速度（全队取平均）
   *   qualityPct 作品品质（全队取平均）
   *   salaryPct  个人日薪
   *   xpPct      个人经验
   *   fansPct    粉丝转化（全队取平均） */
  GD.TRAITS = [
    { id: 'nightowl', name: '夜猫子', desc: '开发速度 +8%，日薪 +10%', eff: { speedPct: 0.08, salaryPct: 0.10 } },
    { id: 'perfection', name: '完美主义', desc: '品质 +6%，开发速度 −6%', eff: { qualityPct: 0.06, speedPct: -0.06 } },
    { id: 'fasthand', name: '手速惊人', desc: '开发速度 +12%', eff: { speedPct: 0.12 } },
    { id: 'detail', name: '细节狂', desc: '品质 +8%，经验 −10%', eff: { qualityPct: 0.08, xpPct: -0.10 } },
    { id: 'niceguy', name: '老好人', desc: '全队品质 +3%', eff: { qualityPct: 0.03 } },
    { id: 'shy', name: '社恐', desc: '品质 +5%，粉丝转化 −12%', eff: { qualityPct: 0.05, fansPct: -0.12 } },
    { id: 'bigmouth', name: '嘴强王者', desc: '粉丝转化 +15%，品质 −4%', eff: { fansPct: 0.15, qualityPct: -0.04 } },
    { id: 'overtime', name: '加班战士', desc: '开发速度 +10%，日薪 +15%', eff: { speedPct: 0.10, salaryPct: 0.15 } },
    { id: 'ontime', name: '按时下班', desc: '日薪 −8%，开发速度 −5%', eff: { salaryPct: -0.08, speedPct: -0.05 } },
    { id: 'apprentice', name: '学徒', desc: '经验 +25%', eff: { xpPct: 0.25 } },
    { id: 'veteran', name: '老油条', desc: '品质 +7%，经验 −15%', eff: { qualityPct: 0.07, xpPct: -0.15 } },
    { id: 'genius', name: '天才', desc: '品质 +10%，日薪 +20%', eff: { qualityPct: 0.10, salaryPct: 0.20 } },
    { id: 'slacker', name: '混子', desc: '日薪 −15%，品质 −6%', eff: { salaryPct: -0.15, qualityPct: -0.06 } },
    { id: 'keyboard', name: '键盘侠', desc: '开发速度 +7%，粉丝转化 +8%', eff: { speedPct: 0.07, fansPct: 0.08 } },
    { id: 'ocd', name: '强迫症', desc: '品质 +5%，开发速度 −4%', eff: { qualityPct: 0.05, speedPct: -0.04 } },
    { id: 'nightshift', name: '夜班司机', desc: '开发速度 +9%，经验 −5%', eff: { speedPct: 0.09, xpPct: -0.05 } },
    { id: 'inspired', name: '灵感型', desc: '品质 +9%，经验 −8%', eff: { qualityPct: 0.09, xpPct: -0.08 } },
    { id: 'steady', name: '稳如老狗', desc: '品质 +4%，日薪 −4%', eff: { qualityPct: 0.04, salaryPct: -0.04 } },
    { id: 'joker', name: '段子手', desc: '粉丝转化 +20%', eff: { fansPct: 0.20 } },
    { id: 'techhead', name: '技术宅', desc: '开发速度 +6%，品质 +3%，粉丝转化 −8%', eff: { speedPct: 0.06, qualityPct: 0.03, fansPct: -0.08 } }
  ];

  /* 创业宣言：开局选一次，只生效一次，不做长期流派 */
  GD.DECLARATIONS = [
    { id: 'garage', name: '车库苦干', desc: '起始资金 +$150,000', tip: '先把钱拿到手，前两部的容错就宽了。' },
    { id: 'network', name: '人脉派', desc: '开局自带 300 粉丝', tip: '起步就有基本盘，首批销量会好看一些。' },
    { id: 'tech', name: '技术狂人', desc: '三位创始人主属性 +6', tip: '品质和速度的底子更好，但钱一分没多。' },
    { id: 'thrift', name: '能省则省', desc: '开局就有 4 个工位', tip: '白拿一个工位，早招人早开发。' }
  ];

  /* 研究项：24 项，四条支线各 6 项。完成后给公司永久加成。
   * eff 里两套语义：
   *   乘数键 quality / speed / salary / xp / fans / sales / license（默认 1）
   *   加数键 review（每位评审加多少分，默认 0）
   * 研发只按日历推进 —— 不开发游戏时间就不走。 */
  GD.RESEARCH_BRANCHES = [
    { id: 'tech', name: '技术', icon: '⚙', color: '#7fb2ff' },
    { id: 'content', name: '内容', icon: '✦', color: '#d98bd8' },
    { id: 'biz', name: '商业', icon: '◎', color: '#e8b04b' },
    { id: 'team', name: '团队', icon: '☰', color: '#4fc3a1' }
  ];

  GD.RESEARCH = [
    /* ---- 技术 ---- */
    { id: 'toolchain', branch: 'tech', name: '版本管理', desc: '品质 +3%', cost: 40000, days: 60, eff: { quality: 1.03 } },
    { id: 'autotest', branch: 'tech', name: '自动化测试', desc: '品质 +4%', cost: 60000, days: 90, eff: { quality: 1.04 } },
    { id: 'intools', branch: 'tech', name: '内部工具链', desc: '开发速度 +6%', cost: 80000, days: 110, eff: { speed: 0.94 } },
    { id: 'engine', branch: 'tech', name: '自研引擎', desc: '品质 +6%，开发速度 +3%', cost: 120000, days: 150, eff: { quality: 1.06, speed: 0.97 } },
    { id: 'perf', branch: 'tech', name: '性能优化', desc: '品质 +3%，开发速度 +3%', cost: 90000, days: 120, eff: { quality: 1.03, speed: 0.97 } },
    { id: 'aifirst', branch: 'tech', name: 'AI 辅助开发', desc: '开发速度 +10%，品质 +2%', cost: 200000, days: 180, eff: { speed: 0.90, quality: 1.02 } },

    /* ---- 内容 ---- */
    { id: 'narrative', branch: 'content', name: '叙事工作坊', desc: '品质 +4%', cost: 50000, days: 70, eff: { quality: 1.04 } },
    { id: 'playtest', branch: 'content', name: '玩家测试组', desc: '每位评审 +0.4 分', cost: 70000, days: 100, eff: { review: 0.4 } },
    { id: 'artdir', branch: 'content', name: '美术总监制', desc: '品质 +5%', cost: 100000, days: 130, eff: { quality: 1.05 } },
    { id: 'audiolab', branch: 'content', name: '音频实验室', desc: '品质 +3%', cost: 60000, days: 90, eff: { quality: 1.03 } },
    { id: 'worldbook', branch: 'content', name: '世界观库', desc: '品质 +5%，粉丝 +5%', cost: 140000, days: 160, eff: { quality: 1.05, fans: 1.05 } },
    { id: 'media', branch: 'content', name: '媒体关系', desc: '每位评审 +0.5 分', cost: 80000, days: 110, eff: { review: 0.5 } },

    /* ---- 商业 ---- */
    { id: 'marketing', branch: 'biz', name: '营销部门', desc: '销量 +6%', cost: 90000, days: 120, eff: { sales: 1.06 } },
    { id: 'community', branch: 'biz', name: '社区运营', desc: '粉丝 +10%', cost: 70000, days: 100, eff: { fans: 1.10 } },
    { id: 'publish', branch: 'biz', name: '发行谈判', desc: '平台授权费 −15%', cost: 110000, days: 130, eff: { license: 0.85 } },
    { id: 'retail', branch: 'biz', name: '渠道合作', desc: '销量 +8%', cost: 130000, days: 150, eff: { sales: 1.08 } },
    { id: 'brand', branch: 'biz', name: '品牌授权', desc: '粉丝 +8%，销量 +4%', cost: 150000, days: 170, eff: { fans: 1.08, sales: 1.04 } },
    { id: 'global', branch: 'biz', name: '海外发行', desc: '销量 +10%', cost: 180000, days: 190, eff: { sales: 1.10 } },

    /* ---- 团队 ---- */
    { id: 'officere', branch: 'team', name: '办公室改造', desc: '日薪 −6%', cost: 60000, days: 90, eff: { salary: 0.94 } },
    { id: 'training', branch: 'team', name: '内训体系', desc: '经验 +20%', cost: 80000, days: 120, eff: { xp: 1.20 } },
    { id: 'benefits', branch: 'team', name: '福利制度', desc: '日薪 −8%', cost: 100000, days: 140, eff: { salary: 0.92 } },
    { id: 'mentor', branch: 'team', name: '导师制', desc: '经验 +15%，品质 +2%', cost: 90000, days: 130, eff: { xp: 1.15, quality: 1.02 } },
    { id: 'remote', branch: 'team', name: '远程协作', desc: '开发速度 +5%，日薪 −5%', cost: 120000, days: 150, eff: { speed: 0.95, salary: 0.95 } },
    { id: 'headhunt', branch: 'team', name: '猎头网络', desc: '经验 +10%，品质 +2%', cost: 70000, days: 100, eff: { xp: 1.10, quality: 1.02 } },

  /* ---- 第二轮扩展：中后期项目，价格与天数都往上抬 ---- */

  /* 技术 */
  { id: 'cloud', branch: 'tech', name: '云构建', desc: '开发速度 +5%，品质 +2%', cost: 240000, days: 200, eff: { speed: 0.95, quality: 1.02 } },
  { id: 'engine2', branch: 'tech', name: '引擎二代', desc: '品质 +7%，开发速度 +5%', cost: 320000, days: 240, eff: { quality: 1.07, speed: 0.95 } },
  { id: 'mltune', branch: 'tech', name: '机器学习调优', desc: '品质 +5%', cost: 360000, days: 260, eff: { quality: 1.05 } },
  { id: 'devops', branch: 'tech', name: '自动化流水线', desc: '开发速度 +8%', cost: 280000, days: 230, eff: { speed: 0.92 } },
  { id: 'locpipe', branch: 'tech', name: '本地化管线', desc: '品质 +3%，销量 +3%', cost: 260000, days: 210, eff: { quality: 1.03, sales: 1.03 } },
  { id: 'arsenal', branch: 'tech', name: '工具矩阵', desc: '品质 +8%，开发速度 +6%', cost: 480000, days: 300, eff: { quality: 1.08, speed: 0.94 } },

  /* 内容 */
  { id: 'casting', branch: 'content', name: '选角与表演', desc: '每位评审 +0.6 分', cost: 220000, days: 190, eff: { review: 0.6 } },
  { id: 'musicprod', branch: 'content', name: '音乐制作室', desc: '品质 +5%，粉丝 +5%', cost: 260000, days: 220, eff: { quality: 1.05, fans: 1.05 } },
  { id: 'ipbible', branch: 'content', name: '设定集', desc: '品质 +6%，粉丝 +6%', cost: 300000, days: 240, eff: { quality: 1.06, fans: 1.06 } },
  { id: 'cinematic', branch: 'content', name: '过场动画组', desc: '品质 +7%', cost: 340000, days: 260, eff: { quality: 1.07 } },
  { id: 'critique', branch: 'content', name: '内部评审会', desc: '每位评审 +0.8 分', cost: 180000, days: 160, eff: { review: 0.8 } },
  { id: 'editing', branch: 'content', name: '剪辑与节奏', desc: '品质 +6%，销量 +3%', cost: 400000, days: 280, eff: { quality: 1.06, sales: 1.03 } },

  /* 商业 */
  { id: 'pr', branch: 'biz', name: '公关团队', desc: '销量 +7%', cost: 200000, days: 180, eff: { sales: 1.07 } },
  { id: 'live', branch: 'biz', name: '线下活动', desc: '粉丝 +12%，销量 +4%', cost: 260000, days: 220, eff: { fans: 1.12, sales: 1.04 } },
  { id: 'sub', branch: 'biz', name: '订阅制探索', desc: '销量 +9%', cost: 320000, days: 250, eff: { sales: 1.09 } },
  { id: 'merch', branch: 'biz', name: '周边授权', desc: '粉丝 +10%，销量 +5%', cost: 300000, days: 240, eff: { fans: 1.10, sales: 1.05 } },
  { id: 'excl', branch: 'biz', name: '独占谈判', desc: '平台授权费 −20%，销量 +6%', cost: 380000, days: 280, eff: { license: 0.80, sales: 1.06 } },
  { id: 'empire', branch: 'biz', name: '发行帝国', desc: '销量 +12%，粉丝 +8%', cost: 520000, days: 320, eff: { sales: 1.12, fans: 1.08 } },

  /* 团队 */
  { id: 'campus', branch: 'team', name: '校招通道', desc: '经验 +12%，日薪 −4%', cost: 160000, days: 150, eff: { xp: 1.12, salary: 0.96 } },
  { id: 'perfsys', branch: 'team', name: '绩效体系', desc: '经验 +15%，品质 +2%', cost: 220000, days: 200, eff: { xp: 1.15, quality: 1.02 } },
  { id: 'wellness', branch: 'team', name: '健康计划', desc: '日薪 −6%，经验 +8%', cost: 260000, days: 220, eff: { salary: 0.94, xp: 1.08 } },
  { id: 'studio', branch: 'team', name: '工作室制', desc: '品质 +4%，开发速度 +3%', cost: 300000, days: 240, eff: { quality: 1.04, speed: 0.97 } },
  { id: 'retention', branch: 'team', name: '留人计划', desc: '日薪 −10%', cost: 360000, days: 260, eff: { salary: 0.90 } },
  { id: 'academy', branch: 'team', name: '内部学院', desc: '经验 +25%，品质 +3%', cost: 480000, days: 320, eff: { xp: 1.25, quality: 1.03 } }
  ];

  /* 设备 / 家具：24 件，买断制，一次性花钱。每个品类 6 件。
   * eff 语义与研究系统完全一致（乘数 + review 加数）。
   * art 非空的会真的出现在像素办公室里。 */
  GD.GEAR_CATS = [
    { id: 'desk', name: '工位', icon: '▤' },
    { id: 'room', name: '环境', icon: '◫' },
    { id: 'fun', name: '娱乐', icon: '♪' },
    { id: 'infra', name: '基建', icon: '⚡' }
  ];

  GD.GEAR = [
    /* ---- 工位 ---- */
    { id: 'ergochair', cat: 'desk', name: '人体工学椅', desc: '开发速度 +3%', cost: 80000, eff: { speed: 0.97 }, art: null },
    { id: 'dblmon', cat: 'desk', name: '双显示器', desc: '品质 +3%', cost: 60000, eff: { quality: 1.03 }, art: null },
    { id: 'bigdesk', cat: 'desk', name: '大工作台', desc: '品质 +2%，开发速度 +2%', cost: 100000, eff: { quality: 1.02, speed: 0.98 }, art: null },
    { id: 'quiet', cat: 'desk', name: '隔音舱', desc: '品质 +4%', cost: 140000, eff: { quality: 1.04 }, art: null },
    { id: 'tablet', cat: 'desk', name: '数位板', desc: '品质 +2%', cost: 50000, eff: { quality: 1.02 }, art: null },
    { id: 'second', cat: 'desk', name: '备用开发机', desc: '开发速度 +2%', cost: 70000, eff: { speed: 0.98 }, art: null },

    /* ---- 环境 ---- */
    { id: 'plantwall', cat: 'room', name: '绿植墙', desc: '粉丝 +3%', cost: 40000, eff: { fans: 1.03 }, art: 'plant' },
    { id: 'rug', cat: 'room', name: '地毯', desc: '日薪 −2%', cost: 30000, eff: { salary: 0.98 }, art: 'rug' },
    { id: 'aircon', cat: 'room', name: '中央空调', desc: '品质 +2%', cost: 90000, eff: { quality: 1.02 }, art: null },
    { id: 'neon', cat: 'room', name: '霓虹灯牌', desc: '粉丝 +4%', cost: 60000, eff: { fans: 1.04 }, art: 'neon' },
    { id: 'sofa', cat: 'room', name: '休息沙发', desc: '日薪 −3%', cost: 80000, eff: { salary: 0.97 }, art: 'sofa' },
    { id: 'window', cat: 'room', name: '落地窗', desc: '粉丝 +3%，品质 +1%', cost: 120000, eff: { fans: 1.03, quality: 1.01 }, art: null },

    /* ---- 娱乐 ---- */
    { id: 'arcade', cat: 'fun', name: '街机柜', desc: '粉丝 +5%', cost: 70000, eff: { fans: 1.05 }, art: 'arcade' },
    { id: 'coffee', cat: 'fun', name: '咖啡机', desc: '日薪 −4%', cost: 50000, eff: { salary: 0.96 }, art: 'coffee' },
    { id: 'fridge', cat: 'fun', name: '冰箱', desc: '日薪 −2%，经验 +3%', cost: 60000, eff: { salary: 0.98, xp: 1.03 }, art: null },
    { id: 'pingpong', cat: 'fun', name: '乒乓球台', desc: '经验 +5%', cost: 90000, eff: { xp: 1.05 }, art: null },
    { id: 'console', cat: 'fun', name: '游戏机', desc: '品质 +2%，粉丝 +2%', cost: 60000, eff: { quality: 1.02, fans: 1.02 }, art: null },
    { id: 'gym', cat: 'fun', name: '健身房', desc: '日薪 −3%，经验 +4%', cost: 150000, eff: { salary: 0.97, xp: 1.04 }, art: null },

    /* ---- 基建 ---- */
    { id: 'server', cat: 'infra', name: '服务器', desc: '开发速度 +4%', cost: 160000, eff: { speed: 0.96 }, art: 'server' },
    { id: 'backup', cat: 'infra', name: '备份系统', desc: '品质 +3%', cost: 80000, eff: { quality: 1.03 }, art: null },
    { id: 'security', cat: 'infra', name: '安保系统', desc: '日薪 −2%', cost: 70000, eff: { salary: 0.98 }, art: null },
    { id: 'net', cat: 'infra', name: '专线网络', desc: '开发速度 +3%', cost: 110000, eff: { speed: 0.97 }, art: null },
    { id: 'workshop', cat: 'infra', name: '维修间', desc: '日薪 −3%', cost: 100000, eff: { salary: 0.97 }, art: null },
    { id: 'lab', cat: 'infra', name: '测试实验室', desc: '品质 +4%，经验 +4%', cost: 180000, eff: { quality: 1.04, xp: 1.04 }, art: null },

  /* ---- 第二轮扩展：中后期设备 ---- */

  /* 工位 */
  { id: 'dual4k', cat: 'desk', name: '双 4K 屏', desc: '品质 +3%', cost: 180000, eff: { quality: 1.03 }, art: null },
  { id: 'haptic', cat: 'desk', name: '力反馈外设', desc: '品质 +2%，开发速度 +3%', cost: 220000, eff: { quality: 1.02, speed: 0.97 }, art: null },
  { id: 'capture', cat: 'desk', name: '采集工作站', desc: '品质 +3%，粉丝 +2%', cost: 260000, eff: { quality: 1.03, fans: 1.02 }, art: null },
  { id: 'ergopro', cat: 'desk', name: '升降桌', desc: '日薪 −3%，开发速度 +2%', cost: 240000, eff: { salary: 0.97, speed: 0.98 }, art: null },
  { id: 'soundcard', cat: 'desk', name: '专业声卡', desc: '品质 +3%', cost: 280000, eff: { quality: 1.03 }, art: null },
  { id: 'renderfarm', cat: 'desk', name: '渲染农场节点', desc: '品质 +4%，开发速度 +4%', cost: 420000, eff: { quality: 1.04, speed: 0.96 }, art: null },

  /* 环境 */
  { id: 'acoustic', cat: 'room', name: '声学装修', desc: '品质 +3%', cost: 200000, eff: { quality: 1.03 }, art: null },
  { id: 'lounge', cat: 'room', name: '休闲区', desc: '日薪 −4%', cost: 220000, eff: { salary: 0.96 }, art: 'sofa' },
  { id: 'greenery', cat: 'room', name: '空中花园', desc: '粉丝 +5%', cost: 260000, eff: { fans: 1.05 }, art: 'plant' },
  { id: 'skyline', cat: 'room', name: '顶层视野', desc: '粉丝 +6%，品质 +2%', cost: 320000, eff: { fans: 1.06, quality: 1.02 }, art: null },
  { id: 'smartlight', cat: 'room', name: '智能灯光', desc: '粉丝 +3%，品质 +2%', cost: 240000, eff: { fans: 1.03, quality: 1.02 }, art: 'neon' },
  { id: 'gallery', cat: 'room', name: '作品陈列墙', desc: '粉丝 +7%', cost: 380000, eff: { fans: 1.07 }, art: null },

  /* 娱乐 */
  { id: 'billiards', cat: 'fun', name: '台球桌', desc: '经验 +6%', cost: 140000, eff: { xp: 1.06 }, art: null },
  { id: 'karaoke', cat: 'fun', name: '卡拉 OK', desc: '经验 +5%，日薪 −2%', cost: 160000, eff: { xp: 1.05, salary: 0.98 }, art: null },
  { id: 'cinema', cat: 'fun', name: '内部影院', desc: '品质 +3%，粉丝 +3%', cost: 220000, eff: { quality: 1.03, fans: 1.03 }, art: null },
  { id: 'barcorner', cat: 'fun', name: '吧台', desc: '日薪 −5%', cost: 180000, eff: { salary: 0.95 }, art: null },
  { id: 'esports', cat: 'fun', name: '电竞房', desc: '粉丝 +6%，经验 +4%', cost: 300000, eff: { fans: 1.06, xp: 1.04 }, art: 'arcade' },
  { id: 'spa', cat: 'fun', name: '按摩室', desc: '日薪 −6%，经验 +5%', cost: 340000, eff: { salary: 0.94, xp: 1.05 }, art: null },

  /* 基建 */
  { id: 'dc', cat: 'infra', name: '自建机房', desc: '开发速度 +5%，品质 +2%', cost: 380000, eff: { speed: 0.95, quality: 1.02 }, art: 'server' },
  { id: 'mocap', cat: 'infra', name: '动捕棚', desc: '品质 +6%', cost: 460000, eff: { quality: 1.06 }, art: null },
  { id: 'rendernode', cat: 'infra', name: '渲染集群', desc: '开发速度 +6%，品质 +3%', cost: 520000, eff: { speed: 0.94, quality: 1.03 }, art: null },
  { id: 'biobadge', cat: 'infra', name: '生物门禁', desc: '日薪 −3%，品质 +2%', cost: 260000, eff: { salary: 0.97, quality: 1.02 }, art: null },
  { id: 'cloudstore', cat: 'infra', name: '云端归档', desc: '品质 +3%，开发速度 +3%', cost: 300000, eff: { quality: 1.03, speed: 0.97 }, art: null },
  { id: 'aifarm', cat: 'infra', name: 'AI 训练集群', desc: '品质 +7%，开发速度 +4%', cost: 600000, eff: { quality: 1.07, speed: 0.96 }, art: 'server' }
  ];

  /* 第二轮设备的解锁年份 */
  GD.GEAR_FROM = {
    billiards: 1980, karaoke: 1983, dual4k: 1984, acoustic: 1985, dc: 1986,
    lounge: 1987, haptic: 1988, cinema: 1989, barcorner: 1990, capture: 1991,
    greenery: 1992, esports: 1993, ergopro: 1994, smartlight: 1995, biobadge: 1996,
    soundcard: 1997, mocap: 1998, skyline: 1999, cloudstore: 2000, spa: 2001,
    renderfarm: 2003, gallery: 2005, rendernode: 2007, aifarm: 2010
  };

  /* ---------------- 办公室（4 级） ----------------
   * 工位数就是房间等级：3/4/5/6 张桌子分别对应车库 → 独栋。
   * 加成一类走乘数，跟研究/设备/宣言同一套语言；视觉上每级换房间。 */
  GD.ROOMS = [
    {
      seats: 3, key: 'garage', name: '车库', sub: '自家车库',
      desc: '三张折叠桌，冬天漏风。便宜，但只能坐 3 个人。',
      eff: { quality: 1.00, research: 1.00, sales: 1.00 }
    },
    {
      seats: 4, key: 'street', name: '街边二层', sub: '临街小楼',
      desc: '有了第二扇窗和一间接待室。品质 +2%。',
      eff: { quality: 1.02, research: 1.00, sales: 1.00 }
    },
    {
      seats: 5, key: 'floor', name: '写字楼整层', sub: '开放工位',
      desc: '一整层通透的开放工位。品质 +5%，研究快 10%。',
      eff: { quality: 1.05, research: 1.10, sales: 1.00 }
    },
    {
      seats: 6, key: 'building', name: '独栋小楼', sub: '带招牌',
      desc: '楼下有自己的招牌和会客区。品质 +8%，销量 +6%。',
      eff: { quality: 1.08, research: 1.10, sales: 1.06 }
    }
  ];

  /* ---------------- 玩家自研平台（2068 起） ----------------
   * 三个参数各三档：研发投入（决定初始装机）、售价（装机 × 单份收入）、
   * 第三方抽成（抽成率 × 对第三方的吸引力）。 */
  GD.MYPLATFORM = {
    minYear: 2068,
    code: 'OWN',
    brand: '自研',
    cap: 170,
    tierBudget: [
      { id: 'lean', name: '轻量投入', cost: 2000000, installBase: 5.0, tip: '便宜，装机少' },
      { id: 'normal', name: '标准投入', cost: 5000000, installBase: 9.0, tip: '均衡' },
      { id: 'heavy', name: '重注投入', cost: 9000000, installBase: 14.0, tip: '贵，装机多' }
    ],
    tierPrice: [
      { id: 'cheap', name: '低价铺量', price: 55, installMul: 1.35, unitMul: 0.8, tip: '装机多、单份少' },
      { id: 'mid', name: '中价', price: 80, installMul: 1.0, unitMul: 1.0, tip: '均衡' },
      { id: 'premium', name: '高价', price: 130, installMul: 0.72, unitMul: 1.25, tip: '装机少、单份多' }
    ],
    tierCut: [
      { id: 'lure', name: '低抽成', cut: 0.15, thirdMul: 1.5, tip: '吸引更多第三方上架' },
      { id: 'normal', name: '标准抽成', cut: 0.30, thirdMul: 1.0, tip: '均衡' },
      { id: 'greedy', name: '高抽成', cut: 0.45, thirdMul: 0.6, tip: '抽得多但上架的少' }
    ]
  };

  /* 随机作品名词库（「随机」按钮用，玩家可以随便改） */
  GD.GAME_WORDS = {
    a: ['暗', '光', '铁', '星', '雾', '雪', '钢', '龙', '夜', '荒', '潮', '灰', '赤', '幽', '银', '远'],
    b: ['之刃', '纪元', '回响', '边境', '物语', '协议', '传说', '都市', '裂痕', '奇谭', '战线', '列车',
      '实验室', '回廊', '残响', '航线']
  };

  /* ---------------- 世代规则（无尽时代 2021–2075） ----------------
   * 每条规则从某一年开始生效，直到下一条生效为止。
   * 效果键（都能挂在引擎已有的出口上）：
   *   speed      开发时长乘数（>1 更慢）
   *   quality    品质乘数
   *   salary     日薪乘数
   *   sales      销量乘数
   *   fanSales   销量额外吃粉丝：×(1 + min(0.8, sqrt(fans) × 系数))
   *   repSales   销量额外吃声望：×(1 + rep/100 × 系数)
   *   cut        发行抽成增减（加到 publisherCut 上）
   *   tail       长尾收入乘数
   *   reviewNoise 评审随机波动倍率；noBias 为 true 时不吃评审偏科
   *   cost       进入该世代的**一次性**投入（付不起就先不生效，每年重试） */
  GD.RULES = [
    {
      from: 2021, name: '分成制', desc: '不再有一次性回款，平台抽成更高，但长尾更值钱',
      eff: { cut: -0.12, tail: 2.2 },
      learn: '首发不重要了，得看一部作品能卖多久'
    },
    {
      from: 2026, name: '沉浸度', desc: '新增沉浸度：(美术+程序) 决定品质上限，开发周期 +50%',
      eff: { speed: 1.5, quality: 1.12 },
      learn: '周期变长，硬堆速度不如堆对属性'
    },
    {
      from: 2033, name: 'AI 员工', desc: 'AI 接手了重复劳动，人力成本大降',
      eff: { salary: 0.62, quality: 1.02 },
      learn: '人可以少，创意才是稀缺资源'
    },
    {
      from: 2040, name: '粉丝驱动', desc: '销量几乎完全由粉丝盘决定，装机量不再关键',
      eff: { fanSales: 0.0025 },
      learn: '从讨好平台变成讨好社区'
    },
    {
      from: 2047, name: '梦境开发', desc: '开发搬进梦境，周期减半，但品质略有损失',
      eff: { speed: 0.55, quality: 0.94 },
      learn: '时间变成可交易资源，代价是状态'
    },
    {
      from: 2054, name: '感官舱体', desc: '新增感官维度，需要一次性投入 $5,000,000 建造舱体',
      eff: { cost: 5000000, quality: 1.18 },
      learn: '从轻资产转向重资产，现金流风险剧增'
    },
    {
      from: 2061, name: '策展人', desc: '主体由 AI 生成，评分改为玩家众评：波动翻倍、不再吃评审偏科',
      eff: { reviewNoise: 2.2, noBias: true },
      learn: '品质不再可控，要学的是「挑选」'
    },
    {
      from: 2068, name: '城市参与', desc: '销量由城市参与人数驱动，声望成了硬通货',
      eff: { sales: 1.1, repSales: 0.5 },
      learn: '从商业转向公共事务'
    },
    {
      from: 2075, name: '跨殖民地', desc: '多市场调度，销量大涨但要承受风格错配',
      eff: { sales: 1.35, quality: 0.96 },
      learn: '本地化成了核心'
    }
  ];

  /* 破产后重新开公司时的宣言（和开局那 4 条不是一套） */
  GD.DECLARATIONS_RETRY = [
    {
      id: 'makewhat', name: '只做我想做的', desc: '品质 +6%',
      tip: '反正已经死过一次了，这次至少做点自己认的。', eff: { quality: 1.06 }
    },
    {
      id: 'makemoney', name: '这次要赚钱', desc: '销量 +10%，品质 −5%',
      tip: '活下去比什么都重要。', eff: { sales: 1.10, quality: 0.95 }
    },
    {
      id: 'small', name: '从小做起', desc: '起始资金翻倍，办公室最多 5 个工位',
      tip: '先把现金攥在手里，别再铺摊子。', eff: { moneyMul: 2, seatCap: 5 }
    },
    {
      id: 'bigshot', name: '跟着大佬走', desc: '开局粉丝 +50%，声望清零',
      tip: '借别人的盘子起步，代价是重新证明自己。', eff: { fansMul: 1.5, resetRep: true }
    }
  ];

  GD.FOUNDERS = ['zhou', 'lin', 'ya'];

  GD.STAT_NAMES = { code: '程序', script: '剧本', art: '美术', audio: '音效', speed: '速度' };

  /* ---------------- 竞争对手 ----------------
   * 每家每年出一部作品，分数随出道年数与实力成长。
   * 年度奖项是「你和他们比」，不是「你跟自己比」。 */
  GD.RIVALS = [
    { id: 'old', name: '老街机', genre: 'action', theme: 'modern', debut: 1973, power: 1.10, titles: ['打砖块', '太空侵略', '迷宫吃豆'] },
    { id: 'white', name: '白噪音', genre: 'adv', theme: 'modern', debut: 1981, power: 1.15, titles: ['无声回廊', '深夜电台', '第七夜'] },
    { id: 'seven', name: '第七区', genre: 'shooter', theme: 'warring', debut: 1985, power: 1.20, titles: ['东线', '钢铁风暴', '焦土'] },
    { id: 'tin', name: '铁皮屋', genre: 'sim', theme: 'fantasy', debut: 1988, power: 1.00, titles: ['小镇牧场', '铁皮王国', '慢生活'] },
    { id: 'echo', name: '回声组', genre: 'rpg', theme: 'medieval', debut: 1991, power: 1.10, titles: ['回声之书', '古城', '最后的吟游诗人'] },
    { id: 'nobody', name: '无名氏', genre: 'action', theme: 'modern', debut: 1996, power: 1.05, titles: ['又一款动作游戏', '跟风之作', '大家的老朋友'] }
  ];

  /* ---------------- 挖人 ----------------
   * 每位对手有 2 名可挖员工，由 rival id 确定性生成（不占存档字段）。
   * 挖人花钱 + 掷骰子；失败赔违约金，成功后对手实力下滑。 */
  GD.CREW_NAMES = ['阿勋', '小柯', '老麦', '阿岚', '知秋', '大伟', '菜菜', '阿伦', '默然', '小鹿', '阿乐', '小米'];
  GD.CREW_QUOTES = [
    '那边给的钱多，我就来了。',
    '在这边一个想法都推不动。',
    '想跟更强的人一起做游戏。',
    '其实我早就想跳了。'
  ];
  GD.POACH = {
    feeDays: 2.2,        // 挖人签字费 = 日薪 × 70 × 2.2 × (1 + power×0.5)
    failKeep: 0.4,       // 被回绝时白赔多少比例
    chanceBase: 0.5,     // 基础成功率
    fanDiv: 60000,       // 粉丝每 6 万 +100% 成功率
    powerPenalty: 0.6,   // 对手每强 0.1，成功率 −6%
    powerDrop: 0.06      // 被挖走一人，对手实力 −0.06
  };

  /* ---------------- 评审 ---------------- */
  /* 评审台词：4 位 × 20 句（低 7 / 中 7 / 高 6），按分数档抽一句 */
  GD.CRITICS = [
    {
      id: 'chen', name: '老陈', tag: '纸媒老炮', seed: 3,
      fav: 'rpg', hate: 'shooter', bias: 1.4,
      lines: {
        low: [
          '我玩了三个小时，还是不知道主角想干嘛。',
          '这种东西也配叫 RPG？',
          '系统比说明书还厚，乐趣比纸还薄。',
          '这剧情我二十年前就写过，而且写得比这好。',
          '别拿怀旧当借口，烂就是烂。',
          '我给它留了版面，现在后悔了。',
          '连个像样的迷宫都没有。'
        ],
        mid: [
          '故事还行，可惜系统太单薄。',
          '中规中矩，我会给它一个及格分。',
          '骨架是对的，肉还没长出来。',
          '看得出想做大事，可惜只做了一半。',
          '流程够长，回味不够长。',
          '老派但扎实，年轻人可能嫌慢。',
          '差一点点就能让人记住。'
        ],
        high: [
          '这代人的 RPG 记忆，会从这一部开始。',
          '很久没为一款游戏熬夜了。',
          '我很少给这种分数，你们配。',
          '这一部值得我在专栏里写三个版面。',
          '当年我想做的东西，被他们做出来了。',
          '如果这是最后一代 RPG，那它是个好结尾。'
        ]
      }
    },
    {
      id: 'lin2', name: '小林', tag: '前职业选手', seed: 11,
      fav: 'action', hate: 'sim', bias: 1.4,
      lines: {
        low: [
          '输入延迟有一帧，我就没法玩。',
          '手感像在糖浆里挥拳。',
          '这操作，像是在隔着毛玻璃打架。',
          '帧数掉成这样，别谈什么竞技性。',
          '按键回馈是有的，只是它回馈给了别人。',
          '我试了三遍才确认这不是我的问题。',
          '十分钟后我选择了关机。'
        ],
        mid: [
          '判定还行，节奏可以再快一点。',
          '能玩，但打不出爽感。',
          '够爽，但爽得不够久。',
          '数值有想法，手感欠打磨。',
          '能连招，但连不出花样。',
          '训练模式比正片好玩，这不太好。',
          '再给我两帧，我能打得更好看。'
        ],
        high: [
          '这个手感，我想打职业。',
          '每一帧都在回应我的操作。',
          '这个打击感，我会拿去给学员当范例。',
          '每一招都能预判，每一招都接得住。',
          '我愿意为它重新练一遍。',
          '这是我今年唯一没骂过的游戏。'
        ]
      }
    },
    {
      id: 'ya2', name: '阿雅', tag: '插画师', seed: 19,
      fav: 'adv', hate: 'shooter', bias: 1.2,
      lines: {
        low: [
          '配色像打翻的调色盘。',
          '我闭上了眼睛，画面更好看。',
          '人物站在场景里，像是被贴上去的。',
          '这个配色方案，我不敢看第二眼。',
          'UI 把我的视线全挡住了。',
          '光影是没有的，只有更亮和更暗。',
          '我怀疑美术是用鼠标画的。'
        ],
        mid: [
          '有几张场景我愿意截图。',
          '美术有想法，执行还差一口气。',
          '个别场景很戳我，整体不够统一。',
          '风格立住了，细节还毛糙。',
          '有几张真好看，其余在凑数。',
          '看得出赶工，但审美在线。',
          '角色设计比场景用心。'
        ],
        high: [
          '我想把每一帧都画下来。',
          '这不是游戏，是一本会动的画册。',
          '这一作的色彩，我想印成海报挂在墙上。',
          '每一处留白都在讲故事。',
          '美术组知道自己要什么，而且做到了。',
          '我截图存了四十张。'
        ]
      }
    },
    {
      id: 'k', name: '老K', tag: '电视主持', seed: 31,
      fav: null, hate: null, bias: 0.6,
      lines: {
        low: [
          '观众朋友们，这款我们就跳过了。',
          '嗯……下一款。',
          '这个我们就不占用黄金时段了。',
          '观众朋友们，今天时间有限。',
          '我试着玩了一会儿，后来去泡了杯茶。',
          '连背景音都算不上。',
          '广告时间都比它精彩。'
        ],
        mid: [
          '周末可以试试，别抱太大期望。',
          '中规中矩，适合打发时间。',
          '适合下班后放松，别有别的期待。',
          '一家人一起玩可能有点意思。',
          '画面不错，玩法也不难，就是记不住。',
          '我给它一个中评，观众自己判断。',
          '能玩，但我不一定会推荐给朋友。'
        ],
        high: [
          '年度节目必须给它一期专题。',
          '我太太都在玩这个。',
          '这节目我要做三期。',
          '我女儿问我在玩什么，我说这是好游戏。',
          '很久没在演播室聊游戏聊到超时了。',
          '今年的年度推荐，我提前预定了。'
        ]
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
    },

    /* ---------- 早期补充 ---------- */
    {
      id: 'engine', when: 'early',
      title: '引擎选型',
      body: '第一周就卡在这里：自己造轮子、买商业引擎，还是拿开源凑。三条路都能走，代价不一样。',
      options: [
        { label: '自己造', cost: 0, quality: 5, progress: -12, tip: '品质 +5%，进度 −12%（后期受益）' },
        { label: '买商业引擎', cost: 12000, quality: 1, progress: 4, tip: '$12,000，进度 +4%' },
        { label: '用开源', cost: 0, quality: -2, progress: 6, tip: '品质 −2%，进度 +6%' }
      ]
    },
    {
      id: 'artstyle', when: 'early',
      title: '美术风格之争',
      body: '美术坚持手绘，程序说先用色块占位。两人在会议室吵了四十分钟。',
      options: [
        { label: '听美术的', cost: 0, quality: 4, progress: -5, tip: '品质 +4%，进度 −5%' },
        { label: '先用色块', cost: 0, quality: -3, progress: 6, tip: '品质 −3%，进度 +6%' }
      ]
    },
    {
      id: 'hardname', when: 'early',
      title: '名字太难念',
      body: '测试组反馈：没人记住游戏叫什么。连你自己都得想两秒。',
      options: [
        { label: '改名', cost: 8000, quality: 0, progress: 0, sales: 6, tip: '$8,000，销量 +6%' },
        { label: '不改', cost: 0, quality: 0, progress: 0, sales: -2, tip: '销量 −2%' }
      ]
    },
    {
      id: 'studio', when: 'early',
      title: '录音棚',
      body: '音效师说，现在这套合成音"能听，但没有灵魂"。真乐队已经在楼下等着了。',
      options: [
        { label: '请真乐队', cost: 25000, quality: 6, progress: 0, tip: '$25,000，品质 +6%' },
        { label: '继续合成音', cost: 0, quality: -1, progress: 0, tip: '品质 −1%' }
      ]
    },
    {
      id: 'scope', when: 'early',
      title: '功能越加越多',
      body: '策划的需求列表从 30 条涨到了 80 条。每一条都写着"这个必须有"。',
      options: [
        { label: '砍掉一半', cost: 0, quality: 3, progress: 8, tip: '品质 +3%，进度 +8%' },
        { label: '全都做', cost: 0, quality: 2, progress: -12, tip: '品质 +2%，进度 −12%' }
      ]
    },
    {
      id: 'burnout', when: 'early',
      title: '有人撑不住了',
      body: '主程说他昨天在键盘上睡着了。这是他这周第三次提这件事。',
      options: [
        { label: '强制休息两天', cost: 0, quality: 2, progress: -6, tip: '品质 +2%，进度 −6%' },
        { label: '再顶一周', cost: 0, quality: -4, progress: 5, tip: '品质 −4%，进度 +5%' }
      ]
    },
    {
      id: 'borrow', when: 'early',
      title: '隔壁组借人',
      body: '隔壁项目延期了，两个技术现在闲着。要不要借过来用两周？',
      options: [
        { label: '借两个人', cost: 15000, quality: 0, progress: 9, tip: '$15,000，进度 +9%' },
        { label: '自己扛', cost: 0, quality: -1, progress: 0, tip: '品质 −1%' }
      ]
    },
    {
      id: 'artout', when: 'early',
      title: '外包美术',
      body: '外包报价还行，画风能不能对上就不好说了。',
      options: [
        { label: '外包出去', cost: 30000, quality: -3, progress: 10, tip: '$30,000，进度 +10%，品质 −3%' },
        { label: '自己做', cost: 0, quality: 2, progress: -4, tip: '品质 +2%，进度 −4%' }
      ]
    },
    {
      id: 'viral', when: 'early',
      title: '内部 GIF 火了',
      body: '一段试玩 GIF 在公司群里传开了，连老板都问这是谁做的。',
      options: [
        { label: '顺势预热', cost: 5000, quality: 0, progress: 0, sales: 8, tip: '$5,000，销量 +8%' },
        { label: '保持低调', cost: 0, quality: 0, progress: 0, sales: 2, tip: '销量 +2%' }
      ]
    },
    {
      id: 'savebug', when: 'early',
      title: '存档丢失',
      body: '测试时发现退出游戏会把存档洗掉。概率不高，但只要中一次，玩家会骂一辈子。',
      options: [
        { label: '立刻修', cost: 0, quality: 4, progress: -8, tip: '品质 +4%，进度 −8%' },
        { label: '先记下来', cost: 0, quality: -4, progress: 0, tip: '品质 −4%' }
      ]
    },
    {
      id: 'meetings', when: 'early',
      title: '一天四个会',
      body: '早会、需求评审、进度同步、复盘会。今天一行代码没写。',
      options: [
        { label: '取消所有会', cost: 0, quality: -1, progress: 8, tip: '品质 −1%，进度 +8%' },
        { label: '照常开', cost: 0, quality: 1, progress: -4, tip: '品质 +1%，进度 −4%' }
      ]
    },

    /* ---------- 后期补充 ---------- */
    {
      id: 'preview', when: 'late',
      title: '媒体想提前试玩',
      body: '一家媒体打来电话，说想拿试玩版做一期前瞻。他们也可能会挑毛病。',
      options: [
        { label: '给他们试玩', cost: 10000, quality: 0, progress: 0, sales: 10, tip: '$10,000，销量 +10%' },
        { label: '婉拒', cost: 0, quality: 0, progress: 0, sales: -3, tip: '销量 −3%' }
      ]
    },
    {
      id: 'crash', when: 'late',
      title: '某个机型必崩',
      body: '测试机里有一台，进第二关必黑屏。厂商那边说"不影响主体评分"。',
      options: [
        { label: '延期三天修', cost: 0, quality: 5, progress: -10, tip: '品质 +5%，进度 −10%' },
        { label: '先发补丁', cost: 0, quality: -5, progress: 2, tip: '品质 −5%，进度 +2%' }
      ]
    },
    {
      id: 'storepage', when: 'late',
      title: '商店页素材',
      body: '商店页那五张图决定了多少人点进来。现在的素材是临时拼的。',
      options: [
        { label: '花钱认真做', cost: 20000, quality: 0, progress: 0, sales: 9, tip: '$20,000，销量 +9%' },
        { label: '用截图凑', cost: 0, quality: 0, progress: 0, sales: -4, tip: '销量 −4%' }
      ]
    },
    {
      id: 'discpress', when: 'late',
      title: '压盘出错',
      body: '第一批盘印出来偏色严重，封面像被晒过。工厂说重压要三天。',
      options: [
        { label: '重新压', cost: 15000, quality: 2, progress: 0, tip: '$15,000，品质 +2%' },
        { label: '就这样发', cost: 0, quality: 0, progress: 0, sales: -6, tip: '销量 −6%' }
      ]
    },
    {
      id: 'streamer', when: 'late',
      title: '主播找上门',
      body: '一个挺大的主播说首发想播你的游戏，条件是当天独家。',
      options: [
        { label: '给独家', cost: 0, quality: 0, progress: 0, sales: 12, tip: '销量 +12%' },
        { label: '不给', cost: 0, quality: 0, progress: 0, sales: 1, tip: '销量 +1%' }
      ]
    },
    {
      id: 'legal', when: 'late',
      title: '收到法务函',
      body: '有家公司说你的主角"高度相似"。他们的角色是去年注册的，你有印象。',
      options: [
        { label: '庭外和解', cost: 30000, quality: 0, progress: 0, sales: 0, tip: '$30,000，不影响销量' },
        { label: '硬扛到底', cost: 0, quality: 1, progress: 0, sales: -8, tip: '品质 +1%，销量 −8%' }
      ]
    },
    {
      id: 'quit', when: 'late',
      title: '核心成员想走',
      body: '猎头开了两倍薪水。他说还没答应，但也没说不。',
      options: [
        { label: '加薪留人', cost: 25000, quality: 4, progress: 0, tip: '$25,000，品质 +4%' },
        { label: '让他走', cost: 0, quality: -6, progress: 4, tip: '品质 −6%，进度 +4%' }
      ]
    },
    {
      id: 'finalbuild', when: 'late',
      title: '最终构建',
      body: '打包脚本跑完了。要不要再把全量回归跑一遍？跑一次要六小时。',
      options: [
        { label: '全量回归', cost: 0, quality: 5, progress: -6, tip: '品质 +5%，进度 −6%' },
        { label: '直接打包', cost: 0, quality: -2, progress: 3, tip: '品质 −2%，进度 +3%' }
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
  /* 第二轮项目的解锁年份：研究不再是一张能一口气点完的清单，
   * 而是一条跨年代的长线。没列到的（第一轮 24 项）开局就能研究。 */
  GD.RESEARCH_FROM = {
    campus: 1982, pr: 1983, casting: 1984, cloud: 1985, perfsys: 1987, live: 1988,
    musicprod: 1989, engine2: 1990, wellness: 1992, sub: 1993, ipbible: 1994,
    mltune: 1996, studio: 1998, merch: 1999, cinematic: 2000, devops: 2002,
    retention: 2004, excl: 2005, critique: 2006, locpipe: 2008, academy: 2010,
    editing: 2012, empire: 2013, arsenal: 2015
  };

  /* 年度 6 个奖项：年度游戏 + 2 个类型奖 + 3 个单项奖。
   * 类型奖只在该类型的作品里评；单项奖看画面 / 音乐 / 剧情分。
   * min 是「够格线」：低于这个数哪怕没有对手也不给奖（避免烂片躺赢）。 */
  GD.AWARD_CATS = [
    { id: 'goty', name: '年度游戏', kind: 'total', min: 26, icon: '🏆', short: '年度' },
    { id: 'rpg', name: '最佳 RPG', kind: 'genre', genre: 'rpg', min: 24, icon: '⚔', short: 'RPG' },
    { id: 'action', name: '最佳动作', kind: 'genre', genre: 'action', min: 24, icon: '✦', short: '动作' },
    { id: 'art', name: '最佳画面', kind: 'cat', cat: 'art', min: 42, icon: '🎨', short: '画面' },
    { id: 'audio', name: '最佳音乐', kind: 'cat', cat: 'audio', min: 42, icon: '🎵', short: '音乐' },
    { id: 'script', name: '最佳剧情', kind: 'cat', cat: 'script', min: 42, icon: '📖', short: '剧情' }
  ];

  /* 对手的单项分换算比例：对手只有总分，按这个系数摊成单项分。
   * 玩家的单项分是按员工能力算的（后期约 50–65），所以这条必须落在同一量级，
   * 否则「玩家永远输」或「玩家永远赢」。1.10 是模拟里调出来的。 */
  GD.BAL_AWARD = { catScale: 1.10, catJitter: 6 };

  GD.BAL = {
    startMoney: 620000,
    startYear: 1972,
    endYear: 2002,          // 主线结局年
    daysPerYear: 360,

    /* 市场流行：每年 2 个题材 + 1 个类型走红，命中主题材销量 ×1.30、中类型 ×1.15。
     * 走势由年份哈希决定（同一局每一年都一样，存档不用多存字段）。 */
    trendThemes: 2,
    trendThemeSales: 1.25,
    trendGenreSales: 1.10,

    /* 加成收益递减：研究 + 设备 + 家具 + 宣言全部相乘，48 件设备会叠到 5 倍以上，
     * 一叠上去后期随便一部都满分。这里给「偏离 1 的幅度」设上限，
     * 再叠只会越来越接近上限，不会指数爆炸。 */
    mulCap: 1.20,

    /* 平台上限随年代放宽：后期工作室的能力涨得比平台快，
     * 上限不跟着涨，品质/上限 就会到 7 倍，评分永远封顶。 */
    capBase: 1.10,
    capGrowth: 0.054,

    /* 平台退市：到 retire 那年不能再立项，上面的作品长尾也基本停掉。
     * 提前 warnYears 年预警；退市后可把老作品「移植」到新平台复活。 */
    platformWarnYears: 2,
    retiredTailMult: 0.08,
    portCostRate: 0.25,       // 移植成本 = 原开发成本 × 25%
    portSalesRate: 0.45,      // 移植销量 = 原销量 × 装机比 × 0.45
    portMinAge: 4,            // 平台至少用了 4 年才能往外移植（不让人刚发完就搬）

    /* 对手强度：跟着年代抬，1990 年代后期要能真的压住你 */
    rivalBase: 27,
    rivalYearSlope: 0.44,
    rivalPower: 2.1,
    rivalJitter: 2.5,
    rivalCap: 46,

    /* 怀旧潮：每 12 年一次，持续 2 年，某一个类型销量 ×1.30 */
    nostalgiaEvery: 12,
    nostalgiaYears: 2,
    nostalgiaSales: 1.30,

    /* NG+：带着收藏 / 品牌 / 10% 粉丝重开，日历 ×2，每部作品多解锁 1 格 */
    ngTimeSpeed: 2,
    ngComboBonus: 1,
    ngFansKeep: 0.10,

    /* 士气 / 体力：每部作品消耗，作品之间回一点；低了会掉速度/品质 */
    moraleStart: 72,
    staminaStart: 100,
    staminaDrain: 18,
    staminaCrunchExtra: 10,   // 赶工时间占比 > 40% 时多掉
    staminaRest: 26,          // 每部之间恢复
    moraleRest: 3,
    moraleGainHit: 5,         // 总分 >= 34
    moraleDrainFlop: 7,       // 总分 < 24
    moraleDrainCrunch: 4,
    lowStaminaAt: 35,
    lowStaminaMul: 0.88,
    tiredStaminaAt: 15,
    tiredStaminaMul: 0.70,
    lowMoraleAt: 30,
    lowMoraleMul: 0.94,
    teamBuildCost: 120000,    // 团建：一次性花钱，全员士气 +15
    teamBuildMorale: 15,

    /* 续作：销量够高的旧作才能出续作。
     * 续作卖得好、做得快，但同一套组合的相性打折（不能一直吃同一招）。 */
    sequelMinCopies: 80000,
    sequelSales: 1.40,      // 销量 ×1.40
    sequelSpeed: 0.80,      // 开发耗时 ×0.80
    sequelAffinity: 0.85,   // 相性 ×0.85

    /* 开发成本 = 平台授权 + 每日工资 × 开发天数
     * 天数往前走，钱就在烧。这是「赶工 / 打磨」有意义的前提。 */
    license: 15000,
    daysPerSecond: 2,

    /* 团队 */
    hireFeeDays: 70,          // 签约金 = 日薪 × 70 天
    fireDays: 30,             // 遣散费 = 日薪 × 30 天
    seatCosts: [120000, 220000, 380000],   // 第 4/5/6 个工位
    refreshCost: 10000,       // 换一批候选人
    teamSpeedBonus: 4,        // 每多一人，开发快 4 秒
    teamQualityBonus: 0.04,   // 每多一人，品质 +4%
    minDevSeconds: 18,
    xpBase: 15,               // 每部作品经验 = 15 + 评分

    /* 长尾与离线 */
    tailPerMonth: 0.006,      // 每月长尾 = 作品总收入 × 0.6%
    offlineCapHours: 8,
    offlineDaysPerHour: 3,    // 每离线 1 小时，日历走 3 天
    offlineMaxDays: 120,      // 日历最多跳 120 天
    offlineMinSeconds: 60,
    inflationPerYear: 0.06, inflationBase: 1.0,  // 成本每年线性上涨 6%，30 年约 2.8 倍
    publisherCut: 0.395,        // 发行/制造/渠道抽成后到手比例
    prodValueDivisor: 24,     // 制作成本 = 平台(装机×单价)/24 × 工资
    prodPenaltyFrom: 2.5,     // 超过这个「平台价值」才开始额外加价

    devSeconds: 58,           // 正常速度下的开发时长（会被主创速度削减）
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
    fanDecayPerYear: 0.05,   // 粉丝每年衰减 5%，防止无限滚雪球
    rescue: 200000,
    brokeMonthsToFail: 2,   // 连续几个月付不出钱就清算
    newCompanyBase: 200000, // 新公司起始资金 = 基础 + 声望 x 10000
    newCompanyRepBonus: 10000,
    newCompanyFansKeep: 0.3,// 破产后保留 30% 粉丝

    /* 收购对手当子品牌：粉丝门槛 + 基础价 */
    acquireFansMin: 15000,
    acquireBase: 220000,
    brandPerMonth: 4200
  };

  /* 周销量分布（12 周） */
  GD.SALES_CURVE = [0.30, 0.22, 0.14, 0.09, 0.06, 0.045, 0.035, 0.027, 0.021, 0.017, 0.013, 0.011];

})(window.GD = window.GD || {});
