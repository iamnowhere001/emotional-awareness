/* 心情闯关岛 v0.16.0 · 纯前端、零依赖、不联网
   逻辑按职责拆在 js/ 下（core → util → shell → views-* → ui → actions → boot），
   仍是经典脚本顺序加载，共用同一个全局词法作用域。这里是第一块：状态与存档。
   四档：3-6 / 6-12（基础 / 多想一步两层）/ 亲子全年龄 / 成年
   设计红线：情绪没有标准答案 / 不打分 / 不排名 / 不采集心情文本
   本地只保存：关卡进度、词卡（按轨）、本领、贝壳、岛屿装饰、年龄段与显示设置 */

const SCHEMA_VERSION = 5;
const STORAGE_KEY = 'mood-island-v5';
const LEGACY_KEYS = ['mood-island-v4', 'mood-island-v3', 'mood-island-v2'];
/* 导出文件的格式号，和发版号 / SCHEMA_VERSION 都不是一套：
   只在导出载荷的形状变化时 +1。游戏升级但载荷不变时，这个号不动。 */
const EXPORT_VERSION = 1;
const EXPORT_APP = 'mood-island';

/* ---------------------------------------------------------------- 数据来源
   内容全在 content/ 下：bands.js / levels-kid*.js / levels-adult.js /
   bank-*.js / bank-compose.js / levels-adult-work.js / library.js / meditate.js /
   dictionary.js / selfhelp.js / slowvars.js / help.js。
   这里是唯一入口；文件缺失时给出可读提示，不白屏。 */
const MI = window.MI || {};
const AGE_BANDS = MI.bands || [];
const KID = MI.kid || { track: 'kid', islands: [], levels: [] };
const ADULT = MI.adult || { track: 'adult', islands: [], levels: [] };
const BANK = MI.bankKid || {};
const BANK_ADULT = MI.bankAdult || {};
/* 概念层：16 个概念（content/glossary.js）。站点、工具卡、词典、慢变量都通过 id 挂到这里，
   机制与动作规格只写一份，两轨共用。 */
const GLOSSARY = Array.isArray(MI.glossary) ? MI.glossary : [];
const GLOSSARY_BY_ID = GLOSSARY.reduce((m, g) => { m[g.id] = g; return m; }, {});
const GLOSSARY_LINES = GLOSSARY.map(g => g.line);
const CONCEPT_OF_LEVEL = {};
const CONCEPT_OF_TOOL = {};
const CONCEPT_OF_DICT = {};
const CONCEPT_OF_SLOWVAR = {};
GLOSSARY.forEach(g => {
  (g.stations || []).forEach(id => { CONCEPT_OF_LEVEL[id] = g.id; });
  (g.tools || []).forEach(t => { CONCEPT_OF_TOOL[t] = g.id; });
  /* 词典锚点可以有多个：主锚点仍是 g.dict，g.dicts 是同一概念的延伸阅读。
     这里只建索引，不复制词条；词典仍是 content/dictionary.js 的单一来源。 */
  (g.dicts || (g.dict ? [g.dict] : [])).forEach(t => { if (!CONCEPT_OF_DICT[t]) CONCEPT_OF_DICT[t] = g.id; });
  (g.slowvars || []).forEach(v => { CONCEPT_OF_SLOWVAR[v] = g.id; });
});
const conceptOfLevel = id => GLOSSARY_BY_ID[CONCEPT_OF_LEVEL[id] || ''] || null;
const conceptOfCard = name => GLOSSARY.find(g => g.kid === name || g.adult === name) || null;
const conceptOfTool = name => GLOSSARY_BY_ID[CONCEPT_OF_TOOL[name] || ''] || null;
const conceptOfDict = term => GLOSSARY_BY_ID[CONCEPT_OF_DICT[term] || ''] || null;
/* 概念在两轨里的显示名、教学站与动作规格：结果卡、工具卡、静修页共用同一套读法。 */
const conceptName = c => (c ? (isAdultTrack() ? c.adult : c.kid) : '');
const conceptTeach = c => {
  if (!c) return '';
  const teach = c.teach || [];
  return isAdultTrack() ? (teach.find(id => id.startsWith('A')) || teach[0] || '')
    : (teach.find(id => !id.startsWith('A')) || teach[0] || '');
};
const conceptRequires = c => ((c && c.requires) || []).map(id => GLOSSARY_BY_ID[id]).filter(Boolean);
const conceptSpec = c => {
  const d = (c && c.dose) || {};
  return [d.time, d.steps ? `${d.steps} 步` : '', d.stop].filter(Boolean).join(' · ');
};
/* 静修练习没有自己的概念字段：三种题型分别对到身体信号 / 念头链 / 慢呼吸，
   不新增第四种概念，也不给每个练习各写一段机制。 */
const RETREAT_CONCEPT_BY_TYPE = { ground: 'body', defuse: 'chain', space: 'breath' };
const conceptOfRetreat = r => GLOSSARY_BY_ID[RETREAT_CONCEPT_BY_TYPE[(r && r.type) || ''] || ''] || null;
/* 工作间解锁点由内容层给出（content/levels-adult-work.js 的 MI.workGate），逻辑不另写一份。 */
const WORK_GATE = MI.workGate || 'A3-4';
/* 边界与安全：自助工具箱 / 慢变量 / 静修三页共用同一份（content/glossary.js 顶部的 MI.safety）。 */
const SAFETY_TEXT = (MI.safety && MI.safety.text) || '';

/* 拼装试点：只有这两个关的题目由 bank-compose.js 组合出来，其余仍是手写变体池。 */
const BANK_COMPOSE = MI.bankCompose || {};
/* 成年「工作间」支线：关卡与变体都在 content/levels-adult-work.js。 */
const WORK = Array.isArray(MI.adultWork) ? MI.adultWork : [];
const BANK_WORK = MI.bankWork || {};
const LIB = MI.library || {};
const CODEX = LIB.CODEX || {};
const TALK_CARDS = LIB.TALK_CARDS || [];
const MICRO_ACTIONS = LIB.MICRO_ACTIONS || [];
const DECOR = LIB.DECOR || [];
const BOTTLES = LIB.BOTTLES || [];
const RETREAT = LIB.RETREAT || [];
const RETREAT_SAFETY = SAFETY_TEXT;
/* 静修间 2.0：5 个练习族 × 2 档，数据在 content/meditate.js。
   练习只负责步骤；机制与「什么时候不做」写在族上，避免每条重复。 */
const MEDITATE = MI.meditate || {};
const MD_FAMILIES = MEDITATE.families || [];
const MD_PRACTICES = MEDITATE.practices || [];
const MD_SCENES = MEDITATE.scenes || [];
const MD_INTENTS = MEDITATE.intents || [];
const MD_FAMILY_BY_ID = MD_FAMILIES.reduce((m, f) => { m[f.id] = f; return m; }, {});
const MD_PRACTICE_BY_ID = MD_PRACTICES.reduce((m, p) => { m[p.id] = p; return m; }, {});
const conceptOfMeditate = p => GLOSSARY_BY_ID[(MD_FAMILY_BY_ID[(p && p.family) || ''] || {}).concept || ''] || null;
const DICTIONARY = MI.dictionary || [];
/* 词典的组织方式也在数据里：主题分组、顺序与概念类型都不在逻辑里另写一份。 */
const DICT_META = MI.dictionaryMeta || {};
const DICT_GROUPS = DICT_META.groups || [];
const DICT_KINDS = DICT_META.kinds || [];
const DICT_CATS = DICT_GROUPS.flatMap(g => g.cats || []);
const dictKindName = k => (DICT_KINDS.find(x => x.id === k) || {}).name || k;
const dictCountBy = (fn) => DICTIONARY.filter(fn).length;
const SELFHELP = MI.selfhelp || {};
const SH_STATES = SELFHELP.states || [];
const SH_TOOLS = SELFHELP.tools || [];
const SH_DISTORTIONS = SELFHELP.distortions || [];
const SH_SAFETY = SAFETY_TEXT;
const SLOWVARS = MI.slowvars || {};
const SV_VARS = SLOWVARS.vars || [];
const SV_PRACTICES = SLOWVARS.practices || [];
const SV_TRAPS = SLOWVARS.traps || [];
const SV_HORIZONS = SLOWVARS.horizons || [];
const SV_SAFETY = SAFETY_TEXT;
/* 急救入口：3 个 1 分钟动作与本地求助信息，全部是 content/help.js 里的固定数据。
   不联网、不拨号、不做风险判断，也不保存用户在这里的选择。 */
const HELP = MI.help || {};
const HELP_ACTIONS = HELP.actions || [];
const HELP_NUMBERS = HELP.numbers || {};
const HELP_KID = HELP.kid || {};
const CONTENT_OK = !!(AGE_BANDS.length && KID.levels.length && ADULT.levels.length && HELP_ACTIONS.length
  && Object.keys(BANK_COMPOSE).length && WORK.length && MD_PRACTICES.length);

/* 当前轨：儿童 / 亲子共用 kid 表，成年档走独立表。切档时 syncTrack() 重绑。
   轨道身份以 bands.js 的 track 字段为准，不硬编码档位 id；
   这样以后再加成年向档位，不会静默掉回儿童轨。 */
let TRACK = KID;
let LEVELS = KID.levels;
let TOTAL = LEVELS.length;
const KID_CARD_LEVELS = new Map(KID.levels.filter(l => l.card).map(l => [l.card, l.id]));
const ADULT_CARD_LEVELS = new Map(ADULT.levels.filter(l => l.card).map(l => [l.card, l.id]));
/* 存档校验用的白名单：两轨合法 id / 本领。词卡按各自的 Map 校验。 */
const ALL_LEVEL_IDS = new Set([...KID.levels, ...ADULT.levels].map(l => l.id));
const ALL_SKILLS = new Set([...KID.levels, ...ADULT.levels].map(l => l.skill).filter(Boolean));
/* 支线 id 单独一张白名单：sideCleared 只认这 4 个，主线的 cleared / awarded 不认。
   支线进度因此不可能混进 17 站，也不会被主线解锁逻辑读到。 */
const WORK_IDS = new Set(WORK.map(l => l.id));
/* 拼装：把「场景 × 想法 × 问法」展开成组合键白名单，迁移与选道都按这张表校验。
   组合键形如 s1:t2:a1；任何不在表里的键都不会进存档。 */
const COMPOSE_LEVEL_IDS = Object.keys(BANK_COMPOSE);
const SEEN_CAP = 8;
const COMPOSE_KEYS = {};
for (const id of COMPOSE_LEVEL_IDS) {
  const cfg = BANK_COMPOSE[id] || {};
  const keys = new Set();
  for (const scene of cfg.scenes || []) {
    for (const tid of scene.thoughts || []) {
      const th = (cfg.thoughts || {})[tid];
      for (const aid of (th && th.askIds) || []) keys.add(`${scene.id}:${tid}:${aid}`);
    }
  }
  COMPOSE_KEYS[id] = keys;
}
/* 字号既可能是用户手选的 3 档，也可能是档位自带的 scale；只有这些值会被接受。
   1.06 / 1.18 显式留一份：档位合并后若哪天调了 bands 的 scale，老存档里手动设过的字号仍不能被判为越界。 */
const SCALE_VALUES = new Set([1, 1.06, 1.15, 1.18, 1.3].concat(AGE_BANDS.map(b => b.scale).filter(Number.isFinite)));
/* skills 目前不分轨：两轨没有同名本领，回归会断言这一点。
   若以后要复用名字，必须先把 skills 拆成按轨结构并写迁移，否则会跨轨解锁。 */
function trackOfBandId(id) {
  const b = AGE_BANDS.find(x => x.id === id);
  return b && b.track === 'adult' ? 'adult' : 'kid';
}
function bandTrack() { return trackOfBandId(state.band); }
function syncTrack() {
  TRACK = bandTrack() === 'adult' ? ADULT : KID;
  LEVELS = (TRACK && TRACK.levels) || [];
  TOTAL = LEVELS.length;
}
function islands() { return (TRACK && TRACK.islands) || []; }
function isAdultTrack() { return bandTrack() === 'adult'; }
/* 词卡图鉴按轨存取：两轨各有一份，同名卡不会互相解锁 */
function cardsInTrack() { return state.cards[bandTrack()] || []; }

function band() { return AGE_BANDS.find(b => b.id === state.band) || AGE_BANDS[1] || AGE_BANDS[0] || {}; }
/* 急救入口的语气分层：3-6 / 6-9 / 9-12 走「找一个大人」，亲子档与成年档走成人口径。
   尚未选档时按成人口径处理——不能假设拿着设备的是一个孩子。 */
function isKidTone() {
  const b = band();
  return !!state.band && b.track === 'kid' && b.id !== 'all';
}

/* ---------------------------------------------------------------- 状态 */
const DEFAULT_STATE = {
  version: SCHEMA_VERSION,
  band: null, cleared: [], awarded: [], cards: { kid: [], adult: [] }, skills: [], shells: 0, decor: [],
  /* seen：只记两关拼装题已经出现过的组合键，按关分桶，最多 8 条；不是打卡进度，界面上不显示。
     sideCleared：成年「工作间」支线的完成记录，与主线的 cleared 完全分开。 */
  seen: {}, sideCleared: [],
  settings: { scale: 1, motion: false, speak: true, speakTouched: false, autoSpeak: false, contrast: false }
};
/* 旧版终章 id 是 3-5，现在独立成 finale，老存档需要改一次名。
   必须在 `let state = load()` 之前定义：migrate() 会用到它，const 晚于调用会落入 TDZ。 */
const ID_REMAP = { '3-5': 'finale' };
const remapIds = arr => arr.map(id => ID_REMAP[id] || id);
/* 6-9 与 9-12 合并成 6-12 岁档后，旧存档 / 旧导出 JSON 里的 a9 仍要认得。
   id 沿用 a6，是为了让主线进度、词卡、贝壳、seen 与 sideCleared 一个字段都不用迁移。 */
const BAND_REMAP = { 'a9': 'a6' };
const remapBand = id => (typeof id === 'string' ? (BAND_REMAP[id] || id) : null);
let state = load();
let play = {};
let session = {
  clearedThisRun: 0, view: 'home', tip: '', navDir: '',
  mapScroll: 0, lastCleared: '', interrupted: false, retreatStep: -1,
  helpFrom: 'home',
  /* 6-12 岁档的深度层：null 表示按「这站走过没有」自动决定，1 基础 / 2 多想一步。
     与 pocket（带回下一站的实践卡）一样只活在这一次打开里，不写存档、不计数。 */
  depth: null, pocket: null,
  /* 「两个人一起选」的临时状态：两次选择 + 对照，不判对错、不写存档。 */
  duo: null
};
let lastVariant = {};
let helpWord = null;
let helpGroundDone = false;
/* 从关卡里打开急救时，暂存当前的进行态（题目、已选、试过几次）。
   返回时恢复同一道题；只在内存里，不写存档。 */
let helpResume = null;
let dictCat = 'all';
let dictQuery = '';
let dictKind = 'all';
let shState = null;
let shCat = 'all';
let mdScene = 'all';
let svVar = null;
let svCat = 'all';
let breathTimer = null;
let memoTimer = null;
/* 「歇一下」的延迟提醒：切视图时要随 breathTimer / memoTimer 一起清掉，
   否则 900ms 后弹出的休息弹窗会盖在新页面上。 */
let restTimer = null;
let lastFocus = null;
let lastClicked = null;

/* 存档：带 schema 版本。旧键（v4 / v3 / v2）读到后自动迁移，之后只写新键。
   加字段时在 migrate() 里补一段，老用户进度不会因为版本变更被清空。 */
function readRaw() {
  /* 新键损坏时继续往旧键找，避免一个坏 JSON 把全部进度判死刑 */
  for (const k of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && !Array.isArray(data)) return raw;
    } catch (e) { /* 当前键损坏或不可读，试下一个 */ }
  }
  return null;
}

function load() {
  try {
    const raw = readRaw();
    if (!raw) return clone(DEFAULT_STATE);
    return migrate(JSON.parse(raw));
  } catch (e) { return clone(DEFAULT_STATE); }
}

/* v3 及更早的词卡是一个不分轨的数组（`cards: ['觉察', ...]`）。
   v4 拆成 `cards: { kid: [], adult: [] }`，同名卡不再跨轨解锁。
   旧档没有轨信息，只能按证据推断；推断顺序见下方注释。 */
function migrateCards(rawCards, s) {
  const out = { kid: [], adult: [] };
  const push = (track, name) => { if (!out[track].includes(name)) out[track].push(name); };
  if (!Array.isArray(rawCards)) {
    const src = rawCards && typeof rawCards === 'object' ? rawCards : {};
    /* 按轨校验：成年卡不会留在儿童数组里，反之亦然；两轨同名卡两边都合法 */
    if (Array.isArray(src.kid)) src.kid.filter(n => typeof n === 'string' && KID_CARD_LEVELS.has(n)).forEach(n => push('kid', n));
    if (Array.isArray(src.adult)) src.adult.filter(n => typeof n === 'string' && ADULT_CARD_LEVELS.has(n)).forEach(n => push('adult', n));
    return out;
  }
  const cleared = new Set(remapIds(Array.isArray(s.cleared) ? s.cleared : []));
  const awarded = new Set(remapIds(Array.isArray(s.awarded) ? s.awarded : (Array.isArray(s.cleared) ? s.cleared : [])));
  const kidEvidence = [...cleared, ...awarded].some(id => !id.startsWith('A'));
  const adultEvidence = [...cleared].some(id => id.startsWith('A'));
  const fallback = trackOfBandId(s.band);
  for (const name of rawCards) {
    if (typeof name !== 'string') continue;
    const kidId = KID_CARD_LEVELS.get(name);
    const adultId = ADULT_CARD_LEVELS.get(name);
    if (!kidId && !adultId) continue;   /* 内容里已不存在的卡，旧档里也不保留 */
    const kidEarned = !!kidId && (cleared.has(kidId) || awarded.has(kidId));
    const adultEarned = !!adultId && cleared.has(adultId);
    /* 1. 只在一轨出现 → 直接归该轨
       2. 两轨同名：哪一轨的通关记录能对上就归哪一轨；两轨都对上说明确实各拿过一次
       3. 对不上时，只玩过一轨就归那一轨
       4. 两轨都玩过但仍无法判定 → 归儿童档（宁可少给成年档，也不把儿童卡虚增成成年卡） */
    if (kidId && !adultId) push('kid', name);
    else if (adultId && !kidId) push('adult', name);
    else if (kidEarned && adultEarned) { push('kid', name); push('adult', name); }
    else if (kidEarned) push('kid', name);
    else if (adultEarned) push('adult', name);
    else if (kidEvidence && !adultEvidence) push('kid', name);
    else if (adultEvidence && !kidEvidence) push('adult', name);
    else if (!kidEvidence && !adultEvidence) push(fallback, name);
    else push('kid', name);
  }
  return out;
}

/* v5 的 seen 只接受拼装关的组合键，且必须真的存在于当前内容里。
   旧档没有这个字段，按空桶补齐；导入的坏结构也不会让选道读到不存在的组合。 */
function migrateSeen(rawSeen) {
  const out = {};
  const src = rawSeen && typeof rawSeen === 'object' && !Array.isArray(rawSeen) ? rawSeen : {};
  for (const id of COMPOSE_LEVEL_IDS) {
    const list = Array.isArray(src[id]) ? src[id] : [];
    const known = COMPOSE_KEYS[id] || new Set();
    const clean = [...new Set(list.filter(k => typeof k === 'string' && known.has(k)))];
    out[id] = clean.slice(-SEEN_CAP);
  }
  return out;
}

function migrate(s) {
  if (!s || typeof s !== 'object') return clone(DEFAULT_STATE);
  const from = Number.isFinite(s.version) ? s.version : 2;
  /* v2 → v3：补 version 字段与 3-5 → finale；v3 → v4：词卡按轨拆分（见 migrateCards）；
     v4 → v5：补 seen / sideCleared。之后只做字段白名单校验，不再改结构：
     旧档和现有 v5 档都走同一条路径，主线进度、词卡、本领、贝壳一样不丢。 */
  if (from < 5) s.version = 5;
  const validIds = arr => [...new Set(arr.filter(id => typeof id === 'string' && ALL_LEVEL_IDS.has(id)))];
  const rawCleared = Array.isArray(s.cleared) ? remapIds(s.cleared) : [];
  const rawAwarded = Array.isArray(s.awarded) ? remapIds(s.awarded)
    : (Array.isArray(s.cleared) ? remapIds(s.cleared) : []);
  const cleared = validIds(rawCleared);
  const awarded = validIds(rawAwarded);
  const settings = s.settings && typeof s.settings === 'object' ? s.settings : {};
  const scale = Number.isFinite(settings.scale) && SCALE_VALUES.has(settings.scale) ? settings.scale : 1;
  return {
    version: SCHEMA_VERSION,
    band: (() => { const id = remapBand(s.band); return AGE_BANDS.some(b => b.id === id) ? id : null; })(),
    cleared, awarded,
    cards: migrateCards(s.cards, { ...s, cleared, awarded }),
    skills: Array.isArray(s.skills) ? [...new Set(s.skills.filter(x => typeof x === 'string' && ALL_SKILLS.has(x)))] : [],
    shells: Number.isFinite(s.shells) ? Math.max(0, Math.floor(s.shells)) : 0,
    /* 装饰下标必须落在 DECOR 内，最多 3 个；旧档里的脏数据不会让终章取到空对象 */
    decor: Array.isArray(s.decor)
      ? [...new Set(s.decor.filter(i => Number.isInteger(i) && i >= 0 && i < DECOR.length))].slice(0, 3)
      : [],
    seen: migrateSeen(s.seen),
    /* 支线白名单只认 WORK_IDS；mix 进主线的 id（例如 W-1）不会被接受 */
    sideCleared: Array.isArray(s.sideCleared)
      ? [...new Set(s.sideCleared.filter(id => typeof id === 'string' && WORK_IDS.has(id)))]
      : [],
    settings: {
      scale, motion: !!settings.motion,
      speak: settings.speak !== false, speakTouched: !!settings.speakTouched,
      autoSpeak: !!settings.autoSpeak, contrast: !!settings.contrast
    }
  };
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }

/* 隐私 / 无痕模式下 localStorage 可能不可写。写失败必须让用户看见，
   否则他会以为进度已经留下。提示只插一次，不打断当前这一关。 */
let storageWritable = true;
function showStorageWarning() {
  if (document.getElementById('storage-warning')) return;
  const warn = document.createElement('div');
  warn.id = 'storage-warning';
  warn.className = 'storage-warning';
  warn.setAttribute('role', 'status');
  warn.textContent = '这台浏览器现在不能保存数据（常见于隐私 / 无痕模式）。这一趟照样能玩，但关掉页面后进度不会留下来。';
  const app = document.getElementById('app');
  if (app) app.insertBefore(warn, document.getElementById('stage'));
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageWritable = true;
  } catch (e) {
    storageWritable = false;
    showStorageWarning();
  }
}
/* 用户明确「清空本机进度」时，连 v4 / v3 / v2 旧键一起删。
   否则以后新键损坏，readRaw() 回退旧键会把已经清掉的进度又读回来。 */
function removeAllSaves() {
  for (const k of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try { localStorage.removeItem(k); } catch (e) { /* 隐私模式下不可写，忽略 */ }
  }
}
