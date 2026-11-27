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
    { id: 'zhao', name: '小赵', seed: 118, role: 'script', salary: 520, quote: '我什么都干一点，什么都还行。', stats: { code: 24, script: 26, art: 24, audio: 24, speed: 30 } }
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
    { id: 'headhunt', branch: 'team', name: '猎头网络', desc: '经验 +10%，品质 +2%', cost: 70000, days: 100, eff: { xp: 1.10, quality: 1.02 } }
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
    { id: 'lab', cat: 'infra', name: '测试实验室', desc: '品质 +4%，经验 +4%', cost: 180000, eff: { quality: 1.04, xp: 1.04 }, art: null }
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
    startYear: 1972,
    endYear: 2002,          // 主线结局年
    daysPerYear: 360,

    /* 开发成本 = 平台授权 + 每日工资 × 开发天数
     * 天数往前走，钱就在烧。这是「赶工 / 打磨」有意义的前提。 */
    license: 15000,
    daysPerSecond: 2,

    /* 团队 */
    hireFeeDays: 70,          // 签约金 = 日薪 × 70 天
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
    publisherCut: 0.40,        // 发行/制造/渠道抽成后到手比例
    prodValueDivisor: 27,     // 制作成本 = 平台(装机×单价)/60 × 工资

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
    rescue: 200000,

    /* 收购对手当子品牌：粉丝门槛 + 基础价 */
    acquireFansMin: 15000,
    acquireBase: 220000,
    brandPerMonth: 4200
  };

  /* 周销量分布（12 周） */
  GD.SALES_CURVE = [0.30, 0.22, 0.14, 0.09, 0.06, 0.045, 0.035, 0.027, 0.021, 0.017, 0.013, 0.011];

})(window.GD = window.GD || {});
