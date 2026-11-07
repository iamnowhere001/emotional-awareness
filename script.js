/* 心情闯关岛 v0.11.1 · 纯前端、零依赖、不联网
   五档：3-6 / 6-9 / 9-12 / 亲子全年龄 / 成年
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
   bank-*.js / bank-compose.js / levels-adult-work.js / library.js /
   dictionary.js / selfhelp.js / slowvars.js / help.js。
   这里是唯一入口；文件缺失时给出可读提示，不白屏。 */
const MI = window.MI || {};
const AGE_BANDS = MI.bands || [];
const KID = MI.kid || { track: 'kid', islands: [], levels: [] };
const ADULT = MI.adult || { track: 'adult', islands: [], levels: [] };
const BANK = MI.bankKid || {};
const BANK_ADULT = MI.bankAdult || {};
/* 拼装试点：只有这两个关的题目由 bank-compose.js 组合出来，其余仍是手写变体池。 */
const BANK_COMPOSE = MI.bankCompose || {};
/* 成年「工作间」支线：关卡与变体都在 content/levels-adult-work.js。 */
const WORK = Array.isArray(MI.adultWork) ? MI.adultWork : [];
const BANK_WORK = MI.bankWork || {};
const LIB = MI.library || {};
const CODEX = LIB.CODEX || {};
const QUOTES = LIB.QUOTES || [];
const TALK_CARDS = LIB.TALK_CARDS || [];
const MICRO_ACTIONS = LIB.MICRO_ACTIONS || [];
const DECOR = LIB.DECOR || [];
const BOTTLES = LIB.BOTTLES || [];
const RETREAT = LIB.RETREAT || [];
const RETREAT_SAFETY = LIB.RETREAT_SAFETY || '';
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
const SH_SAFETY = SELFHELP.safety || '';
const SLOWVARS = MI.slowvars || {};
const SV_VARS = SLOWVARS.vars || [];
const SV_PRACTICES = SLOWVARS.practices || [];
const SV_TRAPS = SLOWVARS.traps || [];
const SV_HORIZONS = SLOWVARS.horizons || [];
const SV_SAFETY = SLOWVARS.safety || '';
/* 急救入口：3 个 1 分钟动作与本地求助信息，全部是 content/help.js 里的固定数据。
   不联网、不拨号、不做风险判断，也不保存用户在这里的选择。 */
const HELP = MI.help || {};
const HELP_ACTIONS = HELP.actions || [];
const HELP_NUMBERS = HELP.numbers || {};
const HELP_KID = HELP.kid || {};
const CONTENT_OK = !!(AGE_BANDS.length && KID.levels.length && ADULT.levels.length && HELP_ACTIONS.length
  && Object.keys(BANK_COMPOSE).length && WORK.length);

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
/* 字号既可能是用户手选的 3 档，也可能是档位自带的 scale；只有这些值会被接受 */
const SCALE_VALUES = new Set([1, 1.15, 1.3].concat(AGE_BANDS.map(b => b.scale).filter(Number.isFinite)));
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
let state = load();
let play = {};
let session = {
  clearedThisRun: 0, view: 'home', tip: '', navDir: '',
  mapScroll: 0, lastCleared: '', interrupted: false, retreatStep: -1,
  helpFrom: 'home'
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
let svVar = null;
let svCat = 'all';
let breathTimer = null;
let memoTimer = null;
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
    band: AGE_BANDS.some(b => b.id === s.band) ? s.band : null,
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

/* ---------------------------------------------------------------- 工具 */
const stage = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffled = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rand = arr => arr[Math.floor(Math.random() * arr.length)];
/* 打乱选项时保留原始下标，答案比对仍按原始下标走 */
const withIndex = arr => arr.map((v, i) => ({ v, i }));

/* ---------------------------------------------------------------- 拼装选道
   试点只覆盖 4-3 与 A4-3。选道是纯函数：不碰 Math.random，同一份历史 + 同一种子
   必得同一个组合；组合键直接写到 DOM 的 data-variant 上，测试可以用 forceKey 复现。
   seen 只用来判断「这组见过没有」，不是可见进度，界面不显示任何组合计数。 */
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededRandom(seed) {
  let x = seed >>> 0 || 0x9e3779b9;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}
/* 用组合键派生固定种子打乱选项：同一 key 每次渲染的选项顺序与答案位置都相同。 */
function seededShuffle(arr, seed) {
  const a = arr.slice();
  const rnd = seededRandom(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function seenKeys(id) {
  return (state.seen && Array.isArray(state.seen[id])) ? state.seen[id] : [];
}
/* 出现即记录；上限 8 条，超出丢最旧。已存在时不重复写，也不额外触发存档。 */
function recordSeen(id, key) {
  if (!COMPOSE_KEYS[id] || !COMPOSE_KEYS[id].has(key)) return;
  if (!state.seen || typeof state.seen !== 'object') state.seen = {};
  const list = seenKeys(id);
  if (list.includes(key)) return;
  state.seen[id] = list.concat(key).slice(-SEEN_CAP);
  save();
}
function materializeComposed(id, key) {
  const cfg = BANK_COMPOSE[id];
  const known = COMPOSE_KEYS[id];
  if (!cfg || !known || !known.has(key)) return null;
  const [sid, tid, aid] = key.split(':');
  const scene = (cfg.scenes || []).find(x => x.id === sid);
  const th = (cfg.thoughts || {})[tid];
  const ask = (cfg.asks || []).find(x => x.id === aid);
  if (!scene || !th || !ask || !Array.isArray(th.lenses) || !th.lenses.some(l => l.ok)) return null;
  const base = th.lenses.map(l => ({ t: l.t, d: l.d || '', ok: !!l.ok }));
  const order = seededShuffle(base.map((_, i) => i), hash32(id + '|' + key));
  const options = order.map(i => ({ t: base[i].t, d: base[i].d }));
  const answer = order.findIndex(i => base[i].ok);
  return {
    b: (cfg.b || []).slice(), thought: th.text, question: ask.q,
    options, answer, why: th.why, key, compose: id
  };
}
/* 选道顺序：未见过的「想法」优先，其次未见过的「问法」；记录只保留最近 8 条，
   所以最近 8 轮一定不重复；第 9 轮起，掉出这 8 条的旧组合才可能被重新抽到。
   若某关组合数少于上限、真的全部见过，则从第一组重新开始。
   seed 缺省由「关 id + 已见组合」派生，因此历史不变 → 结果不变。 */
function pickComposed(id, seen, seed, opts) {
  const combos = [...(COMPOSE_KEYS[id] || [])];
  const o = opts || {};
  if (o.forceKey && COMPOSE_KEYS[id] && COMPOSE_KEYS[id].has(o.forceKey)) {
    return materializeComposed(id, o.forceKey) || {};
  }
  if (!combos.length) return {};
  const seenSet = new Set(Array.isArray(seen) ? seen : []);
  const baseSeed = Number.isFinite(seed) ? seed : hash32(id + '|' + [...seenSet].sort().join(','));
  let pool = combos.filter(k => !seenSet.has(k));
  if (pool.length === 0) pool = combos;   /* 组合数小于上限且全部见过时才重置 */
  const seenThoughts = new Set([...seenSet].map(k => k.split(':').slice(0, 2).join(':')));
  const fresh = pool.filter(k => !seenThoughts.has(k.split(':').slice(0, 2).join(':')));
  const source = fresh.length ? fresh : pool;
  const ordered = source.slice().sort((a, b) =>
    hash32(baseSeed + '|' + a) - hash32(baseSeed + '|' + b) || (a < b ? -1 : 1));
  return materializeComposed(id, ordered[0]) || {};
}
function pickVariant(id, opts) {
  if (BANK_COMPOSE[id]) {
    const o = opts || {};
    const r = pickComposed(id, seenKeys(id), o.seed, o);
    if (!o.forceKey) recordSeen(id, r.key);
    return r;
  }
  const all = (BANK[id] || []).concat(BANK_ADULT[id] || []).concat(BANK_WORK[id] || []);
  const pool = all.filter(v => !v.b || v.b.includes(state.band));
  const arr = pool.length ? pool : all;
  if (!arr.length) return {};
  let i = Math.floor(Math.random() * arr.length);
  if (arr.length > 1 && lastVariant[id] === i) i = (i + 1) % arr.length;
  lastVariant[id] = i;
  return arr[i];
}
function scenarioBox(label, text) {
  return `<div class="scenario"><div class="scenario-label">${esc(label)}</div><p>${esc(text)}</p></div>`;
}
/* 选项按钮：i 是渲染位置（键盘数字键用），orig 是数据里的原始下标（判对错用）。
   徽标必须和实际按键一致：显示 1、2、3…，不再用 A/B/C 误导键盘用户。 */
function optBtn(i, title, desc, action, orig) {
  const o = orig === undefined ? i : orig;
  const key = i < 9 ? ` aria-keyshortcuts="${i + 1}"` : '';
  return `<button class="opt" data-action="${action}" data-i="${i}" data-orig="${o}"${key}><span class="opt-key" aria-hidden="true">${i + 1}</span><span><span>${esc(title)}</span>${desc ? `<span class="opt-desc">${esc(desc)}</span>` : ''}</span></button>`;
}
function sliderLabels(v) {
  return v.replies.length === 3 ? ['一点点', '中等', '很大很大'] : ['很轻', '有一点', '中等', '挺明显', '很满'];
}
function applySettings() {
  syncTrack();
  const b = band();
  document.documentElement.style.setProperty('--scale', String(state.settings.scale || b.scale || 1));
  document.documentElement.classList.toggle('reduce-motion', !!state.settings.motion);
  document.documentElement.classList.toggle('high-contrast', !!state.settings.contrast);
  document.documentElement.dataset.band = state.band || 'a6';
}
/* 视图配置表：进度条是否显示、Esc 回哪里、顶栏进度文字、档位标签，都在这里一次声明。
   新增视图只改这张表；scripts/regression.mjs 会校验所有 session.view 都登记过，
   避免「加了视图却忘了藏进度条 / 忘了 Esc 回地图」。 */
const VIEW_CONFIG = {
  gate: { progress: false, esc: null, title: null, band: false },
  home: { progress: false, esc: null, title: null, band: true },
  map: { progress: true, esc: null, title: 'progress', band: true },
  level: { progress: true, esc: 'map', title: 'current', band: true },
  /* 急救入口：Esc 回到进入前的那一屏，而不是固定回地图（可能从首页 / 选档页进来） */
  help: { progress: false, esc: 'back', title: null, band: true },
  retreat: { progress: false, esc: 'map', title: null, band: true },
  dict: { progress: false, esc: 'map', title: null, band: true },
  selfhelp: { progress: false, esc: 'map', title: null, band: true },
  slowvars: { progress: false, esc: 'map', title: null, band: true },
  /* 成年专题「工作间」：时间线视图，支线进度不算进 17 站 */
  work: { progress: false, esc: 'map', title: null, band: true }
};
function viewCfg(v) { return VIEW_CONFIG[v] || {}; }
/* 贝壳是否出现 / 发放由 bands.js 的 shells 字段决定，不在代码里按轨道 id 硬判 */
function hasShells() { return band().shells !== false; }
/* 当前轨走过的站数（两轨进度存在同一个数组里，各算各的） */
function clearedInTrack() {
  return state.cleared.filter(id => LEVELS.some(l => l.id === id)).length;
}
function updateTopbar() {
  const vc = viewCfg(session.view);
  const shells = document.getElementById('shell-count');
  if (shells) {
    shells.hidden = !hasShells();
    shells.textContent = `贝壳 ${state.shells}`;
  }
  const bandEl = document.getElementById('topbar-band');
  if (bandEl) {
    bandEl.hidden = (!vc.band || !state.band);
    bandEl.textContent = state.band ? `${band().name} · ${band().tag}` : '';
  }
  /* 顶栏入口在两轨用不同措辞：孩子看到「有点难受」，成年 / 亲子看到「很难受」。
     未选档时按成人口径，避免把「找一个大人」直接推给一个成年人。 */
  const helpBtn = document.getElementById('help-entry');
  if (helpBtn) {
    const kid = isKidTone();
    helpBtn.textContent = kid ? '现在有点难受' : '现在很难受';
    helpBtn.setAttribute('aria-label', kid ? '打开 1 分钟安抚：现在有点难受' : '打开 1 分钟安抚与求助：现在很难受');
  }
  document.getElementById('progress-wrap').hidden = !vc.progress;
  /* 支线关卡里不画主线站点：17 个圆点会把「工作间只走一幕」误读成主线进度。
     只保留一句支线说明，主线的 cleared / TOTAL 一个都不动。 */
  const sideNow = session.view === 'level' && !!play.side;
  const track = document.getElementById('step-track');
  if (track) track.innerHTML = sideNow ? '' : LEVELS.map((l, i) => {
    const done = state.cleared.includes(l.id);
    const cur = session.view === 'level' && state.levelIndex === i;
    const unlocked = isUnlocked(i);
    return `<button class="step ${done ? 'done' : ''} ${cur ? 'current' : ''}" data-action="open-level" data-i="${i}" ${unlocked ? '' : 'disabled'} ${cur ? 'aria-current="step"' : ''} title="${esc(l.id + ' · ' + l.name)}" aria-label="第 ${i + 1} 站 ${esc(l.name)}${done ? '，已走过' : ''}"></button>`;
  }).join('');
  const pt = document.getElementById('progress-text');
  if (pt) pt.textContent = sideNow
    ? `支线 · 工作间 ${currentLevel().time || ''} · 不计入 ${TOTAL} 站`
    : (vc.title === 'current' && LEVELS[state.levelIndex])
      ? `第 ${state.levelIndex + 1} / ${TOTAL} 站 · ${LEVELS[state.levelIndex].name}`
      : `已走过 ${clearedInTrack()} / ${TOTAL} 站`;
  syncHash();
}
function viewClass() {
  return session.navDir === 'back' ? 'view enter-back'
    : session.navDir === 'forward' ? 'view enter-forward' : 'view';
}

/* ---------------------------------------------------------------- hash 路由
   地址形如 #/map、#/level/4-2、#/help：刷新、收藏、分享都能回到同一屏。
   - 只认下面这张固定表，其余一律回落，不把用户留在坏地址上。
   - 写地址用 history.replaceState：不往历史栈里塞每一步，Esc / 浏览器返回仍是原来的语义。
     file:// 下个别浏览器会拒绝 replaceState，此时退回 location.hash（多一条历史，功能不丢）。
   - hash 里的 id 只查当前轨的关卡表：另一条轨的站视为「不可达」，回落地图。 */
const ROUTE_VIEWS = new Set(['gate', 'home', 'map', 'help', 'retreat', 'dict', 'selfhelp', 'slowvars', 'work']);
/* 首次路由前 session.view 只是占位值，不能拿它做「已在目标屏」的判断 */
let routeReady = false;

function parseHash(hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { view: null };
  if (parts[0] === 'level') {
    if (parts.length < 2) return { view: 'bad' };
    return { view: 'level', id: decodeURIComponent(parts.slice(1).join('/')) };
  }
  if (parts.length > 1 || !ROUTE_VIEWS.has(parts[0])) return { view: 'bad' };
  return { view: parts[0] };
}

function hashFor(view) {
  if (view === 'level') {
    const lv = currentLevel();
    return lv ? `#/level/${encodeURIComponent(lv.id)}` : '#/map';
  }
  return `#/${view}`;
}

/* 把当前 session.view 同步回地址栏。幂等：地址已经是目标值就直接返回，
   所以 hashchange → 渲染 → syncHash 不会自己触发自己。 */
function syncHash() {
  const want = hashFor(session.view);
  if (location.hash === want) return;
  try { history.replaceState(null, '', want); }
  catch (e) { try { location.hash = want; } catch (e2) { /* 极端环境只影响地址栏 */ } }
}

/* 当前地址是否已经就是这一屏：避免 hashchange 把同一屏重新渲染一遍
   （急救页会因此清掉刚选的词，首页会清掉刚取的提示）。 */
function atRoute(r) {
  if (r.view === 'level') {
    const lv = currentLevel();
    return session.view === 'level' && !!lv && lv.id === r.id;
  }
  return r.view !== 'bad' && !!r.view && session.view === r.view;
}

function routeTo(r) {
  if (routeReady && atRoute(r)) return;
  routeReady = true;
  /* 没选年龄段时不放行地图 / 关卡 / 知识库：先选档，和冷启动一致。
     急救页是例外——难受的当下不该先被问年龄。 */
  if (!state.band) {
    if (r.view === 'help') { session.helpFrom = 'gate'; renderHelp(); return; }
    renderAgeGate();
    return;
  }
  if (r.view === 'level') {
    const idx = LEVELS.findIndex(l => l.id === r.id);
    /* 支线 id 单独查：儿童 / 亲子轨直接视为不可达，成年轨要满足幕次解锁 */
    if (idx === -1) {
      const wi = WORK.findIndex(l => l.id === r.id);
      if (wi !== -1) {
        if (!isAdultTrack()) {
          session.tip = '工作间只在成年档开放，先回地图。';
          renderMap();
          return;
        }
        if (!workReachable(wi)) {
          session.tip = '这一幕还没解锁，先回到工作间。';
          renderWork();
          return;
        }
        session.navDir = '';
        closeModal();
        renderLevel(null, WORK[wi], wi);
        return;
      }
      session.tip = '链接里的这一站不在当前年龄段，先回到地图挑一站。';
      renderMap();
      return;
    }
    if (!isUnlocked(idx)) {
      session.tip = '这一站还没解锁，先回到地图。';
      renderMap();
      return;
    }
    state.levelIndex = idx;
    play = {};
    session.navDir = '';
    renderLevel();
    return;
  }
  if (r.view === 'work') {
    if (!isAdultTrack()) {
      session.tip = '工作间只在成年档开放，先回地图。';
      renderMap();
      return;
    }
    renderWork();
    return;
  }
  if (r.view === 'retreat' && !band().mindful) {
    session.tip = '静修间只在成年档开放，先回地图。';
    renderMap();
    return;
  }
  if (r.view === 'help') {
    session.helpFrom = session.view === 'gate' && state.band ? 'home' : (session.view || 'home');
    if (session.view === 'level') helpResume = play;
    else helpResume = null;   /* 非关卡来源不留旧进行态 */
    renderHelp();
    return;
  }
  if (r.view === 'gate') { session.navDir = ''; renderAgeGate(); return; }
  if (r.view === 'home') { session.navDir = ''; renderHome(); return; }
  if (r.view === 'map') { session.navDir = ''; renderMap(); return; }
  if (r.view === 'retreat') { renderRetreatList(); return; }
  if (r.view === 'dict') { ACTIONS['open-dictionary'](); return; }
  if (r.view === 'selfhelp') { ACTIONS['open-selfhelp'](); return; }
  if (r.view === 'slowvars') { ACTIONS['open-slowvars'](); return; }
  /* 空地址或认不出的地址：落到默认首屏，syncHash 会把坏地址改回合法值 */
  session.navDir = '';
  renderHome();
}
function showFeedback(type, html) {
  const slot = document.getElementById('feedback-slot');
  if (slot) slot.innerHTML = `<div class="feedback ${type}">${html}</div>`;
}
function nudge(msg, el) {
  play.tries = (play.tries || 0) + 1;
  const lv = currentLevel();
  const extra = (play.tries >= 2 && lv.hint) ? `<div class="hint-line">小提示：${esc(lv.hint)}　·　还点得动，慢慢来。</div>` : '';
  showFeedback('gentle', `${esc(msg)}${extra}`);
  const target = el || lastClicked;
  if (target && target.classList && document.contains(target)) {
    target.classList.add('tried');
    setTimeout(() => { if (target.classList) target.classList.remove('tried'); }, 650);
  }
  const slot = document.getElementById('feedback-slot');
  if (slot) try { slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
}
/* 解锁规则：按「岛」为单位。第一岛全开；后一岛需要走过上一岛的收尾站，
   岛内各站自由进出。这样地图上「想去哪站，就去哪站」不再是空话，同时保留章节顺序。
   注意：这里检查的是「收尾站」，不是「上一岛全部走完」——岛内自由是刻意的产品判断。 */
function isUnlocked(i) {
  if (i === 0) return true;
  const lv = LEVELS[i];
  if (i === TOTAL - 1) return LEVELS.slice(0, TOTAL - 1).every(l => state.cleared.includes(l.id));
  if (!lv) return false;
  /* 终章 island 记为 0，不能算成「第 0 岛」，否则第一岛会被它锁住 */
  const prevIsland = LEVELS.filter(l => l.island === lv.island - 1 && l.type !== 'finale');
  if (!prevIsland.length) return true;
  return state.cleared.includes(prevIsland[prevIsland.length - 1].id);
}
/* 当前正在玩的那一关：主线读 state.levelIndex，支线读 play.sideIndex。
   支线不改 state.levelIndex，所以退出支线后主线停在哪一站原样保留。 */
function currentLevel() {
  if (play && play.side) return WORK[play.sideIndex] || WORK[0] || {};
  return LEVELS[state.levelIndex] || LEVELS[0] || {};
}
/* 工作间四幕线性解锁：走完 A1-4 开放第一幕，之后每一幕要求上一幕已完成。
   只读 sideCleared，不读主线 cleared（A1-4 是入口条件，不是支线进度）。 */
function sideUnlocked(i) {
  if (!isAdultTrack() || i < 0 || i >= WORK.length) return false;
  if (i === 0) return state.cleared.includes('A1-4');
  return state.sideCleared.includes(WORK[i - 1].id);
}
/* 某一幕能不能进：正常解锁链，或这一幕本身已经走过。
   后者用于主线「从头再来一轮」后仍允许回看 / 重玩已完成的幕。 */
function workReachable(i) {
  if (sideUnlocked(i)) return true;
  return !!(WORK[i] && state.sideCleared.includes(WORK[i].id));
}
function clearAsyncTimers() {
  if (breathTimer) {
    clearInterval(breathTimer); breathTimer = null;
    if (play && play.running) session.interrupted = true;
  }
  if (memoTimer) { clearTimeout(memoTimer); memoTimer = null; }
}
function stopSpeech() { try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* noop */ } }
function speakTexts(texts) {
  if (!state.settings.speak || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    texts.filter(Boolean).forEach(t => {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'zh-CN'; u.rate = 0.88; u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    });
  } catch (e) { /* noop */ }
}
function questionTexts() {
  const sc = document.querySelector('#stage .scenario p');
  const pr = document.querySelector('#stage .prompt');
  return [sc?.textContent, pr?.textContent].filter(Boolean);
}
function optionTexts() {
  const sel = '#stage .opt, #stage .pair-item:not(:disabled), #stage .chip:not(:disabled), #stage .word-chip, #stage .weather-btn, #stage .clue-card.flipped .clue-text';
  return Array.from(document.querySelectorAll(sel)).map(e => e.textContent.trim()).filter(Boolean).slice(0, 10);
}
function bandChip(extra) {
  const b = band();
  return `<span class="band-chip">${esc(b.name)} · ${esc(b.tag)}</span>${extra || ''}`;
}

/* ---------------------------------------------------------------- 视图：选年龄段 */
/* 一次性提示：渲染当前页面时取走并清空，避免换档 / 重开的提示串到下一屏 */
function takeTip() {
  if (!session.tip) return '';
  const html = `<div class="notice">${esc(session.tip)}</div>`;
  session.tip = '';
  return html;
}
function renderAgeGate() {
  clearAsyncTimers();
  session.view = 'gate';
  session.tip = '';
  stage.innerHTML = `<div class="view">
    <span class="eyebrow">第一步 · 只选一次，之后随时能改</span>
    <h2 style="margin:12px 0 10px">先选一下，谁来玩</h2>
    <p class="lead">不同年龄用的是不同题目：选项多少、线索长短、要不要读给你听，都会跟着变。前三档与亲子档共用一套站，成年档是单独的一套；两边进度各自保留，换档不会丢。</p>
    <div class="age-grid">${AGE_BANDS.map(b =>
      `<button class="age-card ${b.id === 'adult' ? 'adult-card' : ''}" data-action="set-band" data-b="${b.id}" data-next="home">
        <span class="age-name">${esc(b.name)}</span><span class="age-tag">${esc(b.tag)}</span>
        <span class="age-desc">${esc(b.desc)}</span><span class="age-len">${esc(b.len)}${b.mindful ? ' · 含静修间' : ''}</span>
      </button>`).join('')}</div>
    <p class="home-note">前四档面向孩子与亲子共玩；最后一项是给自己的，另有一间不打卡的静修间。拿不准就选中间那档，随时可以在「设置」里换。不会记录年龄，也不会上传任何信息。</p>
  </div>`;
  updateTopbar();
}

/* ---------------------------------------------------------------- 视图：首页 */
function renderHome() {
  clearAsyncTimers();
  session.view = 'home';
  const b = band();
  const hasAnyProgress = clearedInTrack() > 0;
  const islCount = islands().length;
  stage.innerHTML = `<div class="view home-hero">
    <div class="toolbar">${bandChip()}<button class="btn-read" data-action="goto-band">换年龄段</button></div>
    <span class="eyebrow">${islCount} 座岛 · ${TOTAL} 站 · 随时可以离开</span>
    <h2>不赶走情绪，先认出它</h2>
    <p class="lead">这是一座关于情绪的小岛。你要做的不是答对，而是把模糊的感觉看得更清楚一点，再带走一个用得上的小工具。</p>
    ${takeTip()}
    <div class="home-horizon" aria-hidden="true">
      <span class="hh-sun"></span>
      <span class="hh-islet i1"></span><span class="hh-islet i2"></span><span class="hh-islet i3"></span>
      <span class="hh-route"></span>
      <span class="hh-land"></span>
      <span class="hh-wave"></span><span class="hh-wave w2"></span>
    </div>
    <div class="actions">
      <button class="btn btn-primary" data-action="start">${hasAnyProgress ? '继续上岛' : '开始上岛'}</button>
      ${hasAnyProgress ? '<button class="btn btn-secondary" data-action="restart-all">从头再来一轮</button>' : ''}
    </div>
    <div class="home-points">
      <div class="home-point"><span class="dot"></span><span><b>没有标准答案。</b>情绪不分好坏，这一趟不打分、不排名、不比谁快。</span></div>
      <div class="home-point"><span class="dot"></span><span><b>每一站换一种玩法。</b>拼线索、调刻度、排顺序、翻记忆，动脑也动手。</span></div>
      <div class="home-point"><span class="dot"></span><span><b>按 ${esc(b.name)} 出题。</b>${esc(b.desc)} ${esc(b.len)}。</span></div>
    </div>
    <div class="help-entry">
      <div class="help-entry-copy">
        <span class="help-entry-kicker">不用上岛 · 1 分钟</span>
        <b>${isKidTone() ? '现在有点难受？' : '现在很难受？'}</b>
        <span>先落地、给感受一个词、找一个人。不计进度，也不保存你选了什么。</span>
      </div>
      <button class="btn help-entry-btn" data-action="open-help">先缓一缓</button>
    </div>
    <div class="home-shortcuts">
      <span class="muted">还没准备好上岛？</span>
      <button class="btn-read" data-action="open-dictionary">心理学词典</button>
      <button class="btn-read" data-action="open-selfhelp">自助工具箱</button>
      <button class="btn-read" data-action="open-slowvars">慢变量</button>
    </div>
    <p class="home-note">全程不联网、不填写心情文字；天气选择不会被保存。${isAdultTrack() ? '成年档有自己的一套站，和儿童档的进度分开记。' : '适合一个人玩，也适合大人和孩子一起聊。'}</p>
  </div>`;
  updateTopbar();
}

/* ---------------------------------------------------------------- 视图：急救入口
   三个判断：
   1. 做成独立视图而不是弹窗——要放下三个动作和求助信息，弹窗在 390px 上会变成
      一个内部滚动的小盒子；急救时最不该出现的就是「内容藏在滚动条里」。
   2. 三步全部在本页内完成，不跳去静修间或关卡——否则「现在很难受」就变成
      「先去别处」，1 分钟也守不住。
   3. 完成状态与选中的词只存在内存里，不进 localStorage、不进存档。 */
function renderHelp() {
  clearAsyncTimers(); stopSpeech();
  session.view = 'help'; session.navDir = '';
  helpWord = null; helpGroundDone = false;
  const kid = isKidTone();
  const ground = HELP_ACTIONS.find(a => a.id === 'ground') || {};
  const nameAct = HELP_ACTIONS.find(a => a.id === 'name') || {};
  const reach = HELP_ACTIONS.find(a => a.id === 'reach') || {};
  const say = kid ? reach.sayKid : reach.say;
  const backLabels = {
    map: '回到地图', gate: '回到选年龄段', level: '回到刚才那一站',
    retreat: '回到静修间', dict: '回到词典', selfhelp: '回到工具箱', slowvars: '回到慢变量',
    work: '回到工作间'
  };
  const backLabel = backLabels[session.helpFrom] || '回到首页';
  stage.innerHTML = `<div class="view help-view">
    <div class="toolbar">${state.band ? bandChip() : ''}<button class="btn-read" data-action="help-close">${backLabel}</button></div>
    <span class="eyebrow">${esc(HELP.eyebrow)}</span>
    <h2 class="help-title">${esc(HELP.title)}</h2>
    <p class="lead">${esc(HELP.lead)}</p>
    <div class="help-actions">
      <section class="help-action" aria-labelledby="help-h-ground">
        <div class="help-head"><span class="help-num" aria-hidden="true">1</span><h3 id="help-h-ground">${esc(ground.name)}</h3><span class="help-len">${esc(ground.len)}</span></div>
        <p class="help-lead">${esc(ground.lead)}</p>
        <ol class="help-steps">${(ground.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <button class="btn btn-secondary help-do" data-action="help-ground">我跟着做完了</button>
        <p class="help-done" id="help-ground-done" role="status" hidden>${esc(ground.done)}</p>
      </section>
      <section class="help-action" aria-labelledby="help-h-name">
        <div class="help-head"><span class="help-num" aria-hidden="true">2</span><h3 id="help-h-name">${esc(nameAct.name)}</h3><span class="help-len">${esc(nameAct.len)}</span></div>
        <p class="help-lead">${esc(nameAct.lead)}</p>
        <div class="help-words" role="group" aria-label="挑一个最接近的词">
          ${(nameAct.words || []).map(w => `<button class="help-word" data-action="help-word" data-w="${esc(w)}">${esc(w)}</button>`).join('')}
        </div>
        <p class="help-picked" id="help-picked" role="status" hidden></p>
      </section>
      <section class="help-action" aria-labelledby="help-h-reach">
        <div class="help-head"><span class="help-num" aria-hidden="true">3</span><h3 id="help-h-reach">${esc(reach.name)}</h3><span class="help-len">${esc(reach.len)}</span></div>
        <p class="help-lead">${esc(kid ? reach.kidLead : reach.lead)}</p>
        <p class="help-say">「${esc(say)}」</p>
        <button class="btn btn-secondary help-do" data-action="help-speak" data-say="${esc(say)}">读给我听</button>
        <p class="help-hint">${esc(reach.hint)}</p>
      </section>
    </div>
    ${kid
      ? `<section class="help-lines help-kid">
          <h3>${esc(HELP_KID.title)}</h3>
          <p>${esc(HELP_KID.body)}</p>
          <p class="help-note">${esc(HELP_KID.note)}</p>
        </section>`
      : `<section class="help-lines">
          <h3>${esc(HELP_NUMBERS.title)}</h3>
          <ul>${(HELP_NUMBERS.items || []).map(it => `<li><b>${esc(it.k)}</b>${esc(it.t)}</li>`).join('')}</ul>
          <p class="help-note">${esc(HELP_NUMBERS.note)}</p>
        </section>`}
    <p class="home-note help-foot">不用做完，也不用变好。随时可以离开，什么都不用留下。</p>
  </div>`;
  updateTopbar();
}

/* ---------------------------------------------------------------- 视图：地图
   地图是一条「手绘航线」：四座岛画在同一张海图上，岛内站点用虚线航迹连起来。
   所有装饰层（海岸线、等高线、罗盘、水纹）都是 aria-hidden 的 SVG，信息仍然只在
   节点按钮上：站名、玩法、锁定原因、下一站，一个都不少。 */
/* 海岸线形状：viewBox 0 0 100 100，随岛块拉伸；只作为氛围，不参与交互 */
const ISLAND_TRACES = [
  'M5,46 C4,26 18,12 38,9 C60,5 82,14 91,32 C99,50 92,70 74,82 C54,95 24,90 10,72 C5,64 5,54 5,46 Z',
  'M7,50 C6,30 20,14 40,11 C62,7 84,18 92,36 C99,54 88,74 70,86 C50,98 22,92 11,74 C7,67 7,57 7,50 Z',
  'M6,42 C8,24 26,11 47,9 C70,7 88,19 93,38 C97,54 87,60 90,72 C84,86 66,92 48,88 C26,84 12,74 6,62 C4,54 5,48 6,42 Z',
  'M6,48 C7,28 22,13 43,10 C66,7 86,17 92,34 C98,51 91,69 78,82 C63,96 34,95 15,79 C8,71 5,58 6,48 Z'
];
/* 岛内的一道等高线，让「地图」不只是四个色块 */
const ISLAND_CONTOURS = [
  'M16,52 C22,32 44,20 64,28 C78,34 82,50 72,64 C58,78 30,76 20,62',
  'M18,50 C24,30 46,20 66,30 C80,40 80,58 66,70 C50,84 26,76 18,62',
  'M17,44 C24,26 48,18 68,26 C82,34 84,52 72,66 C58,80 30,80 18,66',
  'M18,52 C22,34 42,24 62,30 C78,36 80,54 68,66 C54,80 28,76 18,62'
];
/* 岛内的高地轮廓，补一点「地形图」的密度 */
const ISLAND_HIGHLANDS = [
  'M36,32 C48,28 62,32 64,42 C65,51 52,56 42,50 C34,45 32,37 36,32 Z',
  'M38,34 C50,30 64,34 65,44 C66,53 52,57 43,51 C36,46 34,38 38,34 Z',
  'M37,33 C49,29 63,33 65,43 C66,52 53,57 43,51 C35,46 33,38 37,33 Z',
  'M36,34 C48,30 62,34 64,44 C65,53 51,57 42,51 C34,46 32,38 36,34 Z'
];
const MAP_COMPASS = `<svg class="map-compass" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/>
  <path d="M32 8 L38 32 L32 40 L26 32 Z" fill="currentColor" opacity=".55"/>
  <path d="M32 40 L38 32 L32 56 L26 32 Z" fill="currentColor" opacity=".2"/>
  <text x="32" y="5" text-anchor="middle" font-size="7" fill="currentColor" opacity=".8">N</text>
</svg>`;
function renderMap() {
  clearAsyncTimers();
  session.view = 'map';
  const list = islands();
  const trackCards = LEVELS.map(l => l.card).filter(Boolean);
  const trackSkills = LEVELS.map(l => l.skill).filter(Boolean);
  const gotCards = trackCards.filter(c => cardsInTrack().includes(c)).length;
  const gotSkills = trackSkills.filter(s => state.skills.includes(s)).length;
  /* 唯一一个「现在就能继续」的站：已解锁且没走过。终章也算，全部走完时它会被点亮。 */
  const nextIdx = LEVELS.findIndex((l, i) => isUnlocked(i) && !state.cleared.includes(l.id));
  const interrupted = session.interrupted;
  session.interrupted = false;
  let html = `<div class="${viewClass()}">
    ${interrupted ? '<div class="notice">刚才的呼吸练习被打断了，不用补上。想做的时候随时可以重新开始。</div>' : ''}
    ${takeTip()}
    <div class="map-head"><div><span class="eyebrow">岛屿地图 · ${esc(band().name)}</span>
      <h2 style="margin-top:10px">想去哪站，就去哪站</h2>
      <p class="lead">四座岛连成一条航线。同一座岛里的站可以随便进出，走过的还能再走，每次题目会换一批。</p></div>
      <span class="map-count">已走过 <b>${clearedInTrack()}</b> / ${TOTAL} 站</span></div>
    <div class="toolbar">${bandChip()}<span class="muted">${esc(band().len)}</span>
      <button class="btn-read" data-action="goto-band">换年龄段</button></div>
    <div class="map-legend-row" aria-hidden="true">
      <div class="map-legend">
        <span class="map-lg"><i class="lg-dot"></i>还没走</span>
        <span class="map-lg"><i class="lg-dot done"></i>走过</span>
        <span class="map-lg"><i class="lg-dot locked"></i>未解锁</span>
      </div>
      ${MAP_COMPASS}
    </div>
    <div class="map-board">`;
  list.forEach((isl, islIdx) => {
    const items = LEVELS.filter(l => l.island === isl.n && l.type !== 'finale');
    const doneCount = items.filter(l => state.cleared.includes(l.id)).length;
    const shape = ISLAND_TRACES[(isl.n - 1) % ISLAND_TRACES.length];
    const contour = ISLAND_CONTOURS[(isl.n - 1) % ISLAND_CONTOURS.length];
    const highland = ISLAND_HIGHLANDS[(isl.n - 1) % ISLAND_HIGHLANDS.length];
    html += `<section class="island" data-island="${isl.n}">
      <div class="island-art" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
        <path class="isle-water" d="${shape}"/>
        <path class="isle-land" d="${shape}"/>
        <path class="isle-edge" d="${shape}"/>
        <path class="isle-contour" d="${contour}"/>
        <path class="isle-contour alt" d="${highland}"/>
      </svg></div>
      <div class="island-head">
        <div class="island-label">
          <span class="island-kicker">岛 ${isl.n}</span>
          <span class="island-name">${esc(isl.name)}</span>
          <span class="island-theme">${esc(isl.theme)}</span>
        </div>
        <span class="island-count">${doneCount} / ${items.length} 站</span>
      </div>
      <div class="node-grid">`;
    const firstLocked = items.findIndex(l => !isUnlocked(LEVELS.indexOf(l)));
    items.forEach((l, itemIdx) => {
      const idx = LEVELS.indexOf(l);
      const done = state.cleared.includes(l.id);
      const unlocked = isUnlocked(idx);
      const isNext = idx === nextIdx;
      const extra = l.card ? `，会留下「${esc(l.card)}」词卡` : '';
      const lockedHint = itemIdx === firstLocked ? '未解锁 · 先走完上一岛' : '未解锁';
      html += `<button class="node ${done ? 'done' : ''} ${isNext ? 'next' : ''} ${session.lastCleared === l.id ? 'just-done' : ''} ${unlocked ? '' : 'locked'}" data-action="open-level" data-i="${idx}" ${unlocked ? '' : 'disabled'} aria-label="${esc(l.name)}${done ? '，已走过' : ''}${isNext ? '，可以从这里继续' : ''}${unlocked ? '，' + esc(l.kind) + extra : '，尚未解锁'}"${unlocked ? '' : ' title="先把上一座岛走到头"'}>
        ${isNext ? '<span class="node-next">下一站</span>' : ''}
        <span class="node-pin" aria-hidden="true">${done ? '✓' : esc(String(l.num || '·'))}</span>
        <span class="node-name">${esc(l.name)}</span>
        <span class="node-type">${unlocked ? esc(l.kind) : lockedHint}</span>
      </button>`;
    });
    html += `</div></section>`;
    if (islIdx < list.length - 1) html += `<div class="route-gap" aria-hidden="true"></div>`;
  });
  const fin = LEVELS[TOTAL - 1] || {};
  const finaleOpen = isUnlocked(TOTAL - 1);
  const finDesc = finaleOpen
    ? (isAdultTrack() ? '挑一句带走，看看这一程练过的，也可以什么都不挑。' : '布置小岛、看看这一轮练过的本领，带走一句话和一张可以一起聊的卡片。')
    : `走完前 ${TOTAL - 1} 站后开放。不用着急，一站一站来。`;
  html += `<div class="route-gap finale-gap" aria-hidden="true"></div>
    <div class="finale-entry ${finaleOpen ? 'open' : 'locked'}">
      <span class="finale-flag" aria-hidden="true"><svg viewBox="0 0 32 44" focusable="false">
        <path d="M12 41 V5" stroke="currentColor" stroke-width="1.6" fill="none"/>
        <path d="M13 7 L27 13 L13 19 Z" fill="currentColor" opacity=".85"/>
        <path d="M6 41 H20" stroke="currentColor" stroke-width="1.6" fill="none" opacity=".5"/>
      </svg></span>
      <div class="finale-body"><h3>终章 · ${esc(fin.name || '小结')}</h3>
        <p>${finDesc}</p></div>
      <button class="btn ${finaleOpen ? 'btn-primary' : 'btn-secondary'}" data-action="open-level" data-i="${TOTAL - 1}" ${finaleOpen ? '' : 'disabled'}>${finaleOpen ? '去终章' : '还没开放'}</button>
    </div>
    <p class="map-caption" aria-hidden="true">手绘航线 · 不按比例</p>
    <svg class="map-wave" viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0,20 C20,10 40,30 60,20 S100,10 120,20 S160,30 180,20 S220,10 240,20"/>
    </svg>
  </div>`;
  const mindful = !!band().mindful;
  /* 入口按「什么时候会用到」分组：先随身工具，再知识，最后收集。
     原来的 7 个按钮平铺，主次全靠阅读顺序；分组后主线和支线的权重一眼能分开。 */
  html += `<div class="map-hub">
    <section class="hub-block">
      <div class="hub-head"><h3>随时可用</h3><span class="muted">不计进度 · 随时可停</span></div>
      <div class="hub-grid">
        <button class="hub-card hub-help" data-action="open-help">
          <span class="hub-name">${isKidTone() ? '现在有点难受' : '现在很难受'}</span>
          <span class="hub-desc">三个 1 分钟动作：先落地、给感受一个词、找一个人。</span>
          <span class="hub-meta">不计进度 · 不保存 · 随时可停</span>
        </button>
        <button class="hub-card" data-action="open-bottle">
          <span class="hub-name">今日漂流瓶</span>
          <span class="hub-desc">从 ${BOTTLES.length} 个问题里抽一个，和自己聊一句；答案不保存。</span>
          <span class="hub-meta">一题就够 · 不记录</span>
        </button>
        <button class="hub-card" data-action="${mindful ? 'open-retreat' : 'goto-band'}">
          <span class="hub-name">静修间</span>
          <span class="hub-desc">五感锚定、给想法松绑、三分钟呼吸空间。</span>
          <span class="hub-meta">${mindful ? `${RETREAT.length} 个练习 · 随时可停` : '成年档开放 · 现在可切换'}</span>
        </button>
      </div>
    </section>
    ${isAdultTrack() && WORK.length ? `<section class="hub-block">
      <div class="hub-head"><h3>专题 · 工作间</h3><span class="muted">支线 · 不计入 ${TOTAL} 站</span></div>
      <div class="hub-grid">
        <button class="hub-card hub-work" data-action="go-work">
          <span class="hub-name">工作间</span>
          <span class="hub-desc">会前、汇报被否、冲突、下班反刍：四个工作日的时刻。</span>
          <span class="hub-meta">${sideUnlocked(0) ? `${WORK.length} 个时刻 · 不加奖励` : '走完 A1-4 后开放'}</span>
        </button>
      </div>
    </section>` : ''}
    <section class="hub-block">
      <div class="hub-head"><h3>知识与工具</h3><span class="muted">想查就查，不占进度</span></div>
      <div class="hub-grid">
        <button class="hub-card" data-action="open-dictionary">
          <span class="hub-name">心理学词典</span>
          <span class="hub-desc">${DICTIONARY.length} 条概念，按主题找、按类型挑，或直接搜。</span>
          <span class="hub-meta">${DICT_GROUPS.length} 组 · ${DICT_CATS.length} 个主题 · 本地搜索</span>
        </button>
        <button class="hub-card" data-action="open-selfhelp">
          <span class="hub-name">自助工具箱</span>
          <span class="hub-desc">按此刻的状态，挑一张能马上用的小工具卡。</span>
          <span class="hub-meta">${SH_TOOLS.length} 张卡 · ${SH_STATES.length} 种状态</span>
        </button>
        <button class="hub-card" data-action="open-slowvars">
          <span class="hub-name">慢变量</span>
          <span class="hub-desc">健康、关系、三观这些长期底盘，慢一点看。</span>
          <span class="hub-meta">${SV_VARS.length} 个变量 · ${SV_PRACTICES.length} 张练习</span>
        </button>
      </div>
    </section>
    <section class="hub-block">
      <div class="hub-head"><h3>这一趟的收集</h3><span class="muted">走过才会留下</span></div>
      <div class="hub-grid two">
        <button class="hub-card" data-action="open-codex">
          <span class="hub-name">词卡图鉴</span>
          <span class="hub-desc">每走过一站，会留下一张可以回看的词卡。</span>
          <span class="hub-meta">${gotCards} / ${trackCards.length} 张</span>
        </button>
        <button class="hub-card" data-action="open-skills">
          <span class="hub-name">本领清单</span>
          <span class="hub-desc">这一程练过的小本领，都收在这里。</span>
          <span class="hub-meta">${gotSkills} / ${trackSkills.length} 个</span>
        </button>
      </div>
    </section>
  </div>
  <div class="map-foot"><button class="btn btn-ghost" data-action="open-settings">显示、朗读与数据</button></div>
    <p class="home-note">没有每日签到，也没有连续登录奖励。想来就来，进度不会掉。${band().adult ? '每一站底下都留了一句给大人的话。' : ''}${mindful ? '呼吸与正念练习可以随时停止，不算中断。' : ''}${isAdultTrack() ? '成年档与儿童档的进度分开记，互不影响。' : ''}</p>
  </div>`;
  stage.innerHTML = html;
  updateTopbar();
  const justDone = session.lastCleared;
  session.lastCleared = '';
  if (session.mapScroll) {
    const y = session.mapScroll;
    session.mapScroll = 0;
    requestAnimationFrame(() => { try { window.scrollTo(0, y); } catch (e) { /* noop */ } });
  }
  if (justDone) setTimeout(() => {
    const n = document.querySelector('.node.just-done');
    if (n) n.classList.remove('just-done');
  }, 1800);
}

/* ---------------------------------------------------------------- 工作间（成年档支线）
   时间线不是一个平铺题库：四幕按一个工作日的时间往下排，每幕只说一个时刻。
   完成只写 state.sideCleared；这里不显示「已完成几幕」，避免变成打卡。 */
function renderWork() {
  clearAsyncTimers(); stopSpeech();
  session.view = 'work'; session.navDir = '';
  const done = new Set(state.sideCleared);
  const open0 = workReachable(0);
  const stops = WORK.map((l, i) => {
    const unlocked = workReachable(i);
    const finished = done.has(l.id);
    const stateText = finished ? '✓ 走过' : unlocked ? '去这一幕' : (i === 0 ? '走完 A1-4 开放' : '先走上一幕');
    return `<button class="work-stop ${finished ? 'done' : ''} ${unlocked ? '' : 'locked'}" data-action="open-work-level" data-i="${i}" ${unlocked ? '' : 'disabled'}>
      <span class="work-time">${esc(l.time)}</span>
      <span class="work-body">
        <span class="work-name">${esc(l.name)}</span>
        <span class="work-kind">${esc(l.kind)}</span>
        <span class="work-goal">${esc(l.goal)}</span>
      </span>
      <span class="work-state">${esc(stateText)}</span>
    </button>`;
  }).join('');
  stage.innerHTML = `<div class="${viewClass()} work-view">
    <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
    ${takeTip()}
    <span class="eyebrow">成年档 · 专题支线</span>
    <h2 style="margin-top:10px">工作间</h2>
    <p class="lead">四个时刻，沿着一个工作日往下走。它是支线：不计入 ${TOTAL} 站，也不加贝壳、词卡或本领；主线停在哪一站，出来还是那一站。</p>
    ${!open0 ? '<div class="notice">走完地图上的 A1-4 后开放第一幕。</div>' : ''}
    <div class="work-line">${stops}</div>
    <p class="home-note">不用按顺序打卡，也不记录时长。想停就停，进度只留在本机。</p>
  </div>`;
  updateTopbar();
}

/* ---------------------------------------------------------------- 静修间（成年档支线） */
function retreatSafety() { return `<div class="retreat-safety">${esc(RETREAT_SAFETY)}</div>`; }

/* 按「此刻的状态」分组展示：只是排列顺序，不是筛选器，也不要求用户先描述感受 */
const RETREAT_GROUPS = ['现在很烦', '现在很累', '睡不着', '心里空'];
function retreatCard(r, i) {
  return `<button class="retreat-card" data-action="retreat-start" data-i="${i}">
    <span class="retreat-name">${esc(r.name)}</span>
    <span class="retreat-sub">${esc(r.when || r.sub)}</span>
    <span class="retreat-len">${esc(r.minutes)} · 随时可停</span>
  </button>`;
}
function renderRetreatList() {
  clearAsyncTimers(); stopSpeech();
  session.view = 'retreat'; session.navDir = ''; session.retreatStep = -1;
  const indexed = RETREAT.map((r, i) => ({ r, i }));
  const groups = RETREAT_GROUPS.map(m => ({ m, list: indexed.filter(x => x.r.mood === m) }))
    .filter(g => g.list.length);
  const other = indexed.filter(x => !RETREAT_GROUPS.includes(x.r.mood));
  if (other.length) groups.push({ m: '别的时刻', list: other });
  stage.innerHTML = `<div class="view">
    <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
    <span class="eyebrow">静修间 · 不计进度</span>
    <h2 style="margin:12px 0 10px">不用完成什么，坐一会儿就好</h2>
    <p class="lead">${RETREAT.length} 个可以随时停下的小练习，按此刻的状态挑一个就好。没有连续天数、没有提醒、不记录你做过几次，也不给任何评价。</p>
    ${retreatSafety()}
    ${groups.map(g => `<section class="retreat-group">
      <h3 class="retreat-group-title">${esc(g.m)}</h3>
      <div class="retreat-grid">${g.list.map(x => retreatCard(x.r, x.i)).join('')}</div></section>`).join('')}
    <p class="home-note">这些练习参考了正念与认知取向里常见的通用思路，经过简化，只是一般性的放松方式，不是治疗，也不能代替专业帮助。</p>
  </div>`;
  updateTopbar();
}

/* ---------------------------------------------------------------- 知识库公共视图
   心理学词典 / 自助工具箱 / 慢变量共用一副骨架：返回地图、标题、可选搜索、
   可选说明面板、分类筛选、计数、卡片网格、空态、页脚说明。
   差异（文案、分类来源、计数单位、空态、section 包裹）全部走 config；
   三个模块的 DOM 结构、id、类名与筛选结果保持不变。 */
/* 空态文案与「怎么做 / 提醒」卡片是自助与慢变量共用的，收在这里避免改一处漏一处。 */
const SH_HINT = '选一个状态，这里会出现三件可以先做的小事。';
const SV_HINT = '选一个慢变量，这里会出现它的长期逻辑和一个可以开始的小动作。';
function howCard(item, cls, cat, catLabel) {
  return `<details class="dict-card ${cls}" data-cat="${esc(cat)}">
    <summary>
      <span class="dict-term">${esc(item.t)}</span>
      <span class="dict-en" lang="en">${esc(item.e)}</span>
      <span class="dict-short">${esc(item.when)}</span>
      <span class="dict-cat-badge">${esc(catLabel || cat)}</span>
    </summary>
    <div class="dict-detail">
      <div class="sh-how"><b>怎么做</b><ol>${item.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
      <p class="dict-mis"><b>提醒</b>${esc(item.note)}</p>
    </div>
  </details>`;
}
function renderLibraryView(cfg) {
  clearAsyncTimers(); stopSpeech();
  session.view = cfg.view; session.navDir = 'forward';
  if (!cfg.ready()) {
    stage.innerHTML = `<div class="${viewClass()}">
      <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
      <h2>${esc(cfg.missingTitle)}</h2>
      <p class="lead">${esc(cfg.missingLead)}</p>
    </div>`;
    updateTopbar();
    return;
  }
  const cats = [...new Set(cfg.items.map(cfg.catOf))];
  const catBtns = [{ c: 'all', name: '全部' }].concat(cats.map(c => ({ c, name: cfg.catName ? cfg.catName(c) : c })));
  /* 可选钩子：只有词典传，自助工具箱与慢变量的 DOM 结构完全不变。
     groupTitle 让同一主题的卡片前插一个跨整行的分区标题，筛选时一起收起。 */
  let lastCat = null;
  const cards = cfg.items.map((item) => {
    const c = cfg.catOf(item);
    const head = cfg.groupTitle && c !== lastCat ? cfg.groupTitle(c) : '';
    lastCat = c;
    return head + cfg.card(item);
  }).join('');
  const catalog = `
    <div class="${cfg.catsClass}" id="${cfg.catsId}" role="group" aria-label="${esc(cfg.catsLabel)}">
      ${catBtns.map(x => `<button class="dict-cat ${cfg.currentCat() === x.c ? 'on' : ''}" data-action="${cfg.catsAction}" data-c="${esc(x.c)}">${cfg.catNameHtml ? cfg.catNameHtml(x.c) : esc(x.name)}</button>`).join('')}
    </div>
    <p class="dict-count muted" id="${cfg.countId}" aria-live="polite">${cfg.items.length} ${cfg.unit}${cfg.idleHint}</p>
    <div class="${['dict-grid', cfg.gridClass].filter(Boolean).join(' ')}" id="${cfg.gridId}">${cards}</div>
    <p class="dict-empty" id="${cfg.emptyId}" hidden>${esc(cfg.emptyText)}</p>`;
  const catalogBlock = cfg.sectionClass
    ? `<section class="${cfg.sectionClass}"${cfg.sectionId ? ` id="${cfg.sectionId}"` : ''}>
      ${cfg.sectionTitle ? `<h3 class="${cfg.sectionTitleClass}">${esc(cfg.sectionTitle)}</h3>` : ''}
      ${cfg.sectionSub ? `<p class="muted ${cfg.sectionSubClass}">${esc(cfg.sectionSub)}</p>` : ''}
      ${catalog}
    </section>`
    : catalog;
  stage.innerHTML = `<div class="${viewClass()}">
    <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
    <span class="eyebrow">${esc(cfg.eyebrow)}</span>
    <h2 style="margin:12px 0 10px">${esc(cfg.title)}</h2>
    <p class="lead">${esc(cfg.lead)}</p>
    ${cfg.nav || ''}
    ${cfg.safety ? `<div class="retreat-safety">${esc(cfg.safety)}</div>` : ''}
    ${cfg.search || ''}
    ${cfg.prelude || ''}
    ${catalogBlock}
    ${cfg.epilogue || ''}
    <p class="home-note">${esc(cfg.note)}</p>
    <div class="module-foot"><button class="btn btn-secondary" data-action="go-map">回到地图</button></div>
  </div>`;
  updateTopbar();
  applyLibraryFilter(cfg);
  stage.focus({ preventScroll: true });
}

function applyLibraryFilter(cfg) {
  const q = cfg.query ? cfg.query().trim().toLowerCase() : '';
  const cat = cfg.currentCat();
  /* 第三维筛选只有词典传；其余两个知识库保持「分类 + 搜索」两维，行为不变。 */
  const kind = cfg.queryKind ? cfg.queryKind() : 'all';
  const visibleByCat = new Map();
  let n = 0;
  document.querySelectorAll(`#${cfg.gridId} .${cfg.cardClass}`).forEach((card) => {
    const catOk = cat === 'all' || card.dataset.cat === cat;
    const qOk = !q || (card.dataset.search || '').includes(q);
    const kindOk = kind === 'all' || !card.dataset.kind || card.dataset.kind === kind;
    const show = catOk && qOk && kindOk;
    card.hidden = !show;
    if (show) {
      n += 1;
      visibleByCat.set(card.dataset.cat, (visibleByCat.get(card.dataset.cat) || 0) + 1);
    }
  });
  /* 词典的分区标题跟着可见卡片走：某主题被筛空，标题也一起收起。 */
  document.querySelectorAll(`#${cfg.gridId} .dict-group-title`).forEach((h) => {
    const shown = visibleByCat.get(h.dataset.group) || 0;
    h.hidden = shown === 0;
    const badge = h.querySelector('.dict-group-count');
    if (badge) badge.textContent = `${shown} 条`;
  });
  const active = cfg.active ? cfg.active() : (q || cat !== 'all');
  const count = document.getElementById(cfg.countId);
  if (count) {
    count.textContent = cfg.countText
      ? cfg.countText(n)
      : (active ? `筛出 ${n} / ${cfg.items.length} ${cfg.unit}` : `${cfg.items.length} ${cfg.unit}${cfg.idleHint}`);
  }
  const empty = document.getElementById(cfg.emptyId);
  if (empty) empty.hidden = n !== 0;
  if (cfg.syncSelection) cfg.syncSelection();
}

/* ---------------------------------------------------------------- 心理学词典
   纯科普，不计进度、不落盘；主题 / 类型 / 搜索三个维度只在内存里，重新进入会清空。
   主题分组与概念类型定义在 content/dictionary.js 的 MI.dictionaryMeta，逻辑不另存一份。 */
function dictFiltersActive() {
  return !!(dictQuery.trim() || dictCat !== 'all' || dictKind !== 'all');
}
function syncDictSelection() {
  document.querySelectorAll('#dict-kinds .dict-kind-btn').forEach((b) => {
    const on = b.dataset.k === dictKind;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.querySelectorAll('#dict-cats .dict-cat').forEach(b => b.classList.toggle('on', b.dataset.c === dictCat));
  const desc = document.getElementById('dict-kind-desc');
  if (desc) desc.textContent = dictKind === 'all'
    ? '先按主题翻，或按类型挑一类；两种筛选可以叠在一起。'
    : (DICT_KINDS.find(k => k.id === dictKind) || {}).desc || '';
  const reset = document.getElementById('dict-reset');
  if (reset) reset.hidden = !dictFiltersActive();
}
function dictCountText(n) {
  const parts = [];
  if (dictCat !== 'all') parts.push(dictCat);
  if (dictKind !== 'all') parts.push(dictKindName(dictKind));
  if (dictQuery.trim()) parts.push(`「${dictQuery.trim()}」`);
  return parts.length
    ? `筛出 ${n} / ${DICTIONARY.length} 条 · ${parts.join(' + ')}`
    : `${DICTIONARY.length} 条 · 点卡片展开释义，底部可以接着看相关词条`;
}
function dictView() {
  const kindDesc = dictKind === 'all'
    ? '先按主题翻，或按类型挑一类；两种筛选可以叠在一起。'
    : ((DICT_KINDS.find(k => k.id === dictKind) || {}).desc || '');
  return {
    view: 'dict',
    ready: () => DICTIONARY.length > 0 && DICT_CATS.length > 0 && DICT_KINDS.length > 0,
    missingTitle: '词典内容没有加载出来',
    missingLead: '检查 index.html 是否在 library.js 之后、script.js 之前引入 content/dictionary.js。打开浏览器控制台可以看到具体是哪个文件 404。',
    eyebrow: `心理学词典 · ${DICTIONARY.length} 条 · ${DICT_GROUPS.length} 组`,
    title: '把常用的心理学词，说清楚一点',
    lead: `${DICT_CATS.length} 个主题收进 ${DICT_GROUPS.length} 组，另有 ${DICT_KINDS.length} 种概念类型可以先挑一类。每张卡先给一句话，点开看展开、常见误解与「接着看」的相关词条。这里只做科普，不提供诊断或个体化建议。`,
    nav: `<nav class="dict-nav" aria-label="本页目录">
      ${DICT_GROUPS.map(g => `<a href="#dict-group-${esc(g.id)}">${esc(g.name)}<span>${(g.cats || []).reduce((s, c) => s + dictCountBy(d => d.c === c), 0)} 条</span></a>`).join('')}
    </nav>`,
    search: `<div class="dict-controls">
      <label class="dict-search" for="dict-search">
        <span class="visually-hidden">搜索词条</span>
        <input id="dict-search" type="search" autocomplete="off" aria-controls="dict-grid" aria-describedby="dict-count" placeholder="搜名词、英文或释义，例如：依恋、FoMO" value="${esc(dictQuery)}">
      </label>
    </div>`,
    prelude: `<section class="dict-start" aria-labelledby="dict-start-title">
      <h3 class="dict-start-title" id="dict-start-title">从哪里开始</h3>
      <p class="muted dict-start-sub">${DICTIONARY.length} 条不必从头翻。先挑一类，或直接搜名词与英文；主题和类型可以叠着筛。</p>
      <div class="dict-kinds" id="dict-kinds" role="group" aria-label="按概念类型筛选">
        <button class="dict-kind-btn ${dictKind === 'all' ? 'on' : ''}" data-action="dict-kind" data-k="all" aria-pressed="${dictKind === 'all'}">全部<span>${DICTIONARY.length}</span></button>
        ${DICT_KINDS.map(k => `<button class="dict-kind-btn ${dictKind === k.id ? 'on' : ''}" data-action="dict-kind" data-k="${esc(k.id)}" aria-pressed="${dictKind === k.id}" title="${esc(k.desc)}"><b>${esc(k.name)}</b><span>${dictCountBy(d => d.k === k.id)}</span></button>`).join('')}
      </div>
      <p class="dict-kind-desc" id="dict-kind-desc">${esc(kindDesc)}</p>
      <button class="btn-read dict-reset" id="dict-reset" data-action="dict-reset"${dictFiltersActive() ? '' : ' hidden'}>清空筛选</button>
    </section>`,
    items: DICTIONARY,
    catOf: d => d.c,
    catNameHtml(c) {
      return c === 'all'
        ? `全部<span class="dict-cat-num">${DICTIONARY.length}</span>`
        : `${esc(c)}<span class="dict-cat-num">${dictCountBy(d => d.c === c)}</span>`;
    },
    groupTitle(c) {
      const g = DICT_GROUPS.find(x => (x.cats || []).includes(c)) || {};
      const first = g.cats && g.cats[0] === c;
      const id = first ? `dict-group-${g.id}` : `dict-cat-${DICT_CATS.indexOf(c)}`;
      return `<h3 class="dict-group-title" id="${esc(id)}" data-group="${esc(c)}">
        <span class="dict-group-name">${esc(c)}</span>
        <span class="dict-group-meta">${esc(g.name || '')}</span>
        <span class="dict-group-count">${dictCountBy(d => d.c === c)} 条</span>
      </h3>`;
    },
    card(d) {
      const hay = [d.t, d.e, d.c, dictKindName(d.k), d.s, d.d, d.m || ''].join(' ').toLowerCase();
      return `<details class="dict-card" data-term="${esc(d.t)}" data-cat="${esc(d.c)}" data-kind="${esc(d.k)}" data-search="${esc(hay)}">
        <summary>
          <span class="dict-term">${esc(d.t)}</span>
          <span class="dict-en" lang="en">${esc(d.e)}</span>
          <span class="dict-short">${esc(d.s)}</span>
          <div class="dict-badges">
            <span class="dict-cat-badge">${esc(d.c)}</span>
            <span class="dict-kind-badge k-${esc(d.k)}">${esc(dictKindName(d.k))}</span>
          </div>
        </summary>
        <div class="dict-detail">
          <p>${esc(d.d)}</p>
          ${d.m ? `<p class="dict-mis"><b>常见误解</b>${esc(d.m)}</p>` : ''}
          ${(d.r || []).length ? `<div class="dict-related"><b>接着看</b><div class="dict-related-links">${d.r.map(t => `<button class="dict-link" data-action="dict-jump" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>` : ''}
        </div>
      </details>`;
    },
    gridId: 'dict-grid', gridClass: '', cardClass: 'dict-card',
    catsId: 'dict-cats', catsClass: 'dict-cats', catsLabel: '按主题筛选', catsAction: 'dict-cat',
    currentCat: () => dictCat, query: () => dictQuery, queryKind: () => dictKind,
    active: dictFiltersActive, countText: dictCountText, syncSelection: syncDictSelection,
    countId: 'dict-count', unit: '条', idleHint: ' · 点卡片展开释义',
    emptyId: 'dict-empty', emptyText: '没有匹配的词条。换个关键词，或点「清空筛选」看看。',
    note: '词条按成人阅读深度编写；和孩子一起看时，挑他问到的那个就好。有争议的地方会写明边界，不把“研究平均”说成“对每个人都适用”。搜索与筛选只在当前页面内生效，不保存、不上传，返回地图也会清掉。'
  };
}
function renderDictionary() { renderLibraryView(dictView()); }
function applyDictFilter() { applyLibraryFilter(dictView()); }

/* ---------------------------------------------------------------- 自助工具箱
   心力恢复与认知取向自助；只做科普和一般性练习，不诊断、不追踪、不落盘。 */
function shStatePanel(id) {
  const st = SH_STATES.find(s => s.id === id);
  if (!st) return '';
  return `<div class="sh-state-panel">
    <div class="sh-state-head"><b>${esc(st.name)}</b><p>${esc(st.lead)}</p></div>
    <div class="sh-moves">${st.moves.map((m, i) => `<div class="sh-move">
      <span class="sh-move-num">${i + 1}</span>
      <div><b>${esc(m.t)}</b><p>${esc(m.d)}</p></div></div>`).join('')}</div>
    <p class="sh-avoid"><b>先别</b>${esc(st.avoid)}</p>
    <button class="btn-read" data-action="sh-state-clear">换一个状态</button>
  </div>`;
}

function selfHelpView() {
  const states = `<div class="sh-states" id="sh-states">
    ${SH_STATES.map(s => `<button class="sh-state ${shState === s.id ? 'on' : ''}" data-action="sh-state" data-id="${esc(s.id)}">
      <b>${esc(s.name)}</b><span>${esc(s.sub)}</span></button>`).join('')}
  </div>`;
  return {
    view: 'selfhelp',
    ready: () => SH_TOOLS.length > 0,
    missingTitle: '自助内容没有加载出来',
    missingLead: '检查 index.html 是否在 dictionary.js 之后、script.js 之前引入 content/selfhelp.js。打开浏览器控制台可以看到具体是哪个文件 404。',
    eyebrow: '自助工具箱 · 心力与认知',
    title: '先恢复一点力气，再换一个看法',
    lead: `${SH_STATES.length} 种“现在最像”的状态、${SH_TOOLS.length} 张工具卡、${SH_DISTORTIONS.length} 条认知扭曲速查。全部是选择式或阅读式，不填心情文字，也不记录你选了什么。`,
    safety: SH_SAFETY,
    prelude: `<section class="sh-section">
      <h3 class="sh-section-title">现在最像哪一种？</h3>
      <p class="muted sh-section-sub">不用选得很准，挑一个最接近的就好。选完只看这一组建议，不做测试，也不打分。</p>
      ${states}
      <div id="sh-state-panel" aria-live="polite">${shState ? shStatePanel(shState) : `<p class="sh-hint">${esc(SH_HINT)}</p>`}</div>
    </section>`,
    items: SH_TOOLS,
    catOf: t => t.c,
    card(t) { return howCard(t, 'sh-card', t.c); },
    sectionClass: 'sh-section', sectionTitle: '工具卡',
    sectionTitleClass: 'sh-section-title', sectionSub: '按主题筛，点开看“怎么做”和“提醒”。',
    sectionSubClass: 'sh-section-sub',
    gridId: 'sh-grid', gridClass: 'sh-grid', cardClass: 'sh-card',
    catsId: 'sh-cats', catsClass: 'sh-cats', catsLabel: '按主题筛选自助工具', catsAction: 'sh-cat',
    currentCat: () => shCat,
    countId: 'sh-count', unit: '张', idleHint: ' · 点卡片展开',
    emptyId: 'sh-empty', emptyText: '这一类暂时没有卡片。点「全部」看看。',
    epilogue: `<section class="sh-section">
      <h3 class="sh-section-title">认知扭曲速查</h3>
      <p class="muted sh-section-sub">给想法起个名字，通常能让人和它拉开一点距离。标签是为了松绑，不是给自己扣帽子。</p>
      <div class="sh-dist-grid">${SH_DISTORTIONS.map(d => `<div class="sh-dist">
        <b>${esc(d.t)}</b><span>${esc(d.d)}</span><em>${esc(d.eg)}</em></div>`).join('')}</div>
    </section>`,
    note: '自助适合日常调节，不替代专业帮助。如果困扰持续数周、明显影响生活，或出现伤害自己的念头，请尽快联系专业人士或当地急救。选择和搜索都不会被保存。'
  };
}
function renderSelfHelp() { renderLibraryView(selfHelpView()); }
function applyShFilter() { applyLibraryFilter(selfHelpView()); }

/* ---------------------------------------------------------------- 慢变量
   健康、三观、目的与目标等长期底盘；只做阅读与选择，不打卡、不打分、不落盘。 */
function svPanel(id) {
  const v = SV_VARS.find(x => x.id === id);
  if (!v) return '';
  return `<div class="sv-panel">
    <div class="sv-panel-head"><b>${esc(v.name)}</b><span>${esc(v.sub)}</span><p>${esc(v.lead)}</p></div>
    <div class="sv-rows">
      <div class="sv-row"><b>为什么慢</b><p>${esc(v.why)}</p></div>
      <div class="sv-row"><b>常见误用</b><p>${esc(v.misuse)}</p></div>
      <div class="sv-row sv-row-move"><b>可以先做</b><p><strong>${esc(v.move.t)}</strong> ${esc(v.move.d)}</p></div>
      <div class="sv-row"><b>不用什么衡量</b><p>${esc(v.check)}</p></div>
    </div>
    <button class="btn-read" data-action="sv-var-clear">换一个慢变量</button>
    <p class="sv-jump">选好了就往下看相关的练习 · <a href="#sv-practices">去练习卡</a></p>
  </div>`;
}

function svVarName(id) {
  const v = SV_VARS.find(x => x.id === id);
  return v ? v.name : id;
}

function slowVarsView() {
  const vars = `<div class="sv-vars" id="sv-vars">
    ${SV_VARS.map(v => `<button class="sv-var ${svVar === v.id ? 'on' : ''}" data-action="sv-var" data-id="${esc(v.id)}">
      <b>${esc(v.name)}</b><span>${esc(v.sub)}</span></button>`).join('')}
  </div>`;
  return {
    view: 'slowvars',
    ready: () => SV_VARS.length > 0 && SV_PRACTICES.length > 0,
    missingTitle: '慢变量内容没有加载出来',
    missingLead: '检查 index.html 是否在 selfhelp.js 之后、script.js 之前引入 content/slowvars.js。打开浏览器控制台可以看到具体是哪个文件 404。',
    eyebrow: '慢变量 · 在快时代里养底盘',
    title: '有些东西，值得慢慢养',
    lead: `${SV_VARS.length} 个慢变量、${SV_PRACTICES.length} 张练习卡、${SV_TRAPS.length} 个快变量陷阱、${SV_HORIZONS.length} 个时间尺度。选一个慢变量，下面会只留相关的练习。没有打卡，也不问你做到了多少。`,
    nav: `<nav class="sv-nav" aria-label="本页目录">
      <a href="#sv-var-section">选一个慢变量</a>
      <a href="#sv-practices">练习卡</a>
      <a href="#sv-horizons">三个时间尺度</a>
      <a href="#sv-traps">快变量陷阱</a>
    </nav>`,
    safety: SV_SAFETY,
    prelude: `<section class="sv-section" id="sv-var-section">
      <h3 class="sv-section-title">你现在最想稳住哪一块？</h3>
      <p class="muted sv-section-sub">不用选得很准；选一个最接近的，看看它为什么慢、可以先做什么。</p>
      ${vars}
      <div id="sv-panel" aria-live="polite" data-var="${esc(svVar || '')}">${svVar ? svPanel(svVar) : `<p class="sv-hint">${esc(SV_HINT)}</p>`}</div>
    </section>`,
    items: SV_PRACTICES,
    catOf: p => p.v,
    catName: id => svVarName(id),
    card(p) { return howCard(p, 'sv-card', p.v, svVarName(p.v)); },
    sectionClass: 'sv-section', sectionId: 'sv-practices', sectionTitle: '慢变量练习卡',
    sectionTitleClass: 'sv-section-title', sectionSub: '选上面的慢变量，会自动筛到相关练习；也可以自己按变量挑。每个变量下的卡数本来就不同，不用凑齐，点开看“怎么做”和“提醒”。',
    sectionSubClass: 'sv-section-sub',
    gridId: 'sv-grid', gridClass: 'sv-grid', cardClass: 'sv-card',
    catsId: 'sv-cats', catsClass: 'sv-cats', catsLabel: '按慢变量筛选练习', catsAction: 'sv-cat',
    currentCat: () => svCat,
    countId: 'sv-count', unit: '张', idleHint: ' · 点卡片展开',
    emptyId: 'sv-empty', emptyText: '这个慢变量暂时没有练习卡。点「全部」看看。',
    epilogue: `<section class="sv-section" id="sv-horizons">
      <h3 class="sv-section-title">三个时间尺度</h3>
      <p class="muted sv-section-sub">同一个问题，放在不同长度里看，答案会不一样。每个尺度都指回一张能动手的练习卡。</p>
      <div class="sv-horizons">${SV_HORIZONS.map(h => `<div class="sv-horizon">
        <b>${esc(h.t)}</b><p>${esc(h.d)}</p>
        <ul>${h.asks.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
        ${h.cards && h.cards.length ? `<p class="sv-horizon-link">可以先看：${h.cards.map(c => esc(c)).join(' · ')}</p>` : ''}</div>`).join('')}</div>
    </section>
    <section class="sv-section" id="sv-traps">
      <h3 class="sv-section-title">快变量陷阱速查</h3>
      <p class="muted sv-section-sub">不是要你消灭快变量，而是别让它们替你决定长期方向。</p>
      <div class="sv-traps">${SV_TRAPS.map(t => `<div class="sv-trap">
        <b>${esc(t.t)}</b><span>${esc(t.d)}</span><em>${esc(t.eg)}</em></div>`).join('')}</div>
    </section>`,
    note: '选中的慢变量和分类只在本次打开期间有效，返回地图就会清掉，也不会被保存。身体或情绪上的持续不适，请找医生或专业支持。'
  };
}
function renderSlowVars() { renderLibraryView(slowVarsView()); }
function applySvFilter() { applyLibraryFilter(slowVarsView()); }
/* 变量选择与练习筛选共用一个同步点：面板、两处按钮高亮、卡片可见性、计数一起更新。 */
function syncSvSelection() {
  document.querySelectorAll('#sv-vars .sv-var').forEach(b => b.classList.toggle('on', b.dataset.id === svVar));
  document.querySelectorAll('#sv-cats .dict-cat').forEach(b => b.classList.toggle('on', b.dataset.c === svCat));
  const panel = document.getElementById('sv-panel');
  if (panel) {
    /* 只切分类时不重建面板：避免 aria-live 把同一段说明重复播报 */
    const key = svVar || '';
    if (panel.dataset.var !== key) {
      panel.innerHTML = svVar ? svPanel(svVar) : `<p class="sv-hint">${esc(SV_HINT)}</p>`;
      panel.dataset.var = key;
    }
  }
  applySvFilter();
}

function renderRetreatPractice(i) {
  clearAsyncTimers(); stopSpeech();
  session.view = 'retreat'; session.retreatStep = i;
  const r = RETREAT[i];
  if (!r) { renderRetreatList(); return; }
  play = { type: r.type, data: r, tries: 0, done: false, retreatIndex: i };
  let body = '';
  if (r.type === 'ground') {
    play.picks = r.rows.map(() => null);
    body = `<div class="ground-rows">${r.rows.map((row, ri) =>
      `<div class="ground-row" data-row="${ri}"><div class="compose-label">${esc(row.label)}</div>
        <div class="compose-choices">${row.choices.map((c, ci) =>
          `<button class="word-chip" data-action="ground-pick" data-row="${ri}" data-i="${ci}">${esc(c)}</button>`).join('')}</div></div>`).join('')}</div>
      <div id="retreat-result"></div>`;
  } else if (r.type === 'defuse') {
    play.v = rand(r.variants);
    play.opts = shuffled(withIndex(play.v.options));
    body = `${scenarioBox('脑子里冒出来的那句话', play.v.thought)}
      <div class="opt-grid">${play.opts.map(({ v: o, i }, k) => optBtn(k, o.t, o.d, 'defuse-pick', i)).join('')}</div>
      <div id="retreat-result"></div>
      <div class="actions"><button class="btn btn-secondary" data-action="defuse-reroll">换一句</button></div>`;
  } else {
    play.step = 0;
    body = `<div id="space-body"></div><div id="retreat-result"></div>`;
  }
  stage.innerHTML = `<div class="view">
    <div class="toolbar">${bandChip('<span class="muted">静修间</span>')}
      <button class="btn-read" data-action="open-retreat">换一个练习</button>
      <button class="btn-read" data-action="go-map">结束，回地图</button></div>
    <h2>${esc(r.name)}</h2>
    <p class="level-goal">${esc(r.sub)}　·　${esc(r.intro)}</p>
    ${retreatSafety()}
    <div class="play-area" style="margin-top:20px">${body}</div>
    <div id="feedback-slot" aria-live="polite"></div>
  </div>`;
  if (r.type === 'space') paintSpace();
  updateTopbar();
  stage.focus({ preventScroll: true });
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* noop */ }
}

function paintSpace() {
  const r = play.data, s = play.step;
  const box = document.getElementById('space-body');
  if (!box) return;
  if (s >= r.steps.length) {
    box.innerHTML = `<div class="space-card"><span class="space-label">结束</span><p>${esc(r.close)}</p></div>`;
    document.getElementById('retreat-result').innerHTML =
      `<div class="actions"><button class="btn btn-primary" data-action="go-map">回到刚才的事</button>
       <button class="btn btn-secondary" data-action="retreat-start" data-i="${play.retreatIndex}">再做一次</button></div>`;
    return;
  }
  const st = r.steps[s];
  box.innerHTML = `<div class="space-card"><span class="space-label">${esc(st.label)}</span><p>${esc(st.text)}</p></div>
    <div class="space-dots">${r.steps.map((x, i) => `<span class="space-dot ${i < s ? 'done' : i === s ? 'current' : ''}"></span>`).join('')}</div>
    <div class="actions"><button class="btn btn-primary" data-action="space-next">${s === r.steps.length - 1 ? '做完这一段' : '继续'}</button>
      <button class="btn btn-ghost" data-action="go-map">随时结束</button></div>`;
}

/* ---------------------------------------------------------------- 各关渲染器（规模全部由数据驱动） */
const RENDERERS = {
  weather(v) {
    return `<p class="lead">${esc(v.note)}</p>
      <div class="weather-grid" style="margin-top:18px">${v.items.map((it, i) =>
        `<button class="weather-btn" data-action="weather-pick" data-i="${i}">
          <span class="weather-glyph" aria-hidden="true">${it.g}</span>
          <span class="weather-name">${esc(it.n)}</span>
          <span class="weather-sub">${esc(it.s)}</span></button>`).join('')}</div>
      <div class="actions"><button class="btn btn-primary" data-action="weather-go" id="weather-go" disabled>带着它上岛</button>
      <button class="btn btn-ghost" data-action="weather-go">直接出发</button></div>`;
  },
  clue(v) {
    const opts = shuffled(withIndex(v.options));
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">先翻开线索卡，再想想这些线索合起来像哪种感觉。</p>
      <div class="clue-grid">${v.clues.map((c, i) =>
        `<button class="clue-card" data-action="clue-flip" data-i="${i}"><span class="clue-num">线索 ${i + 1}</span><span class="clue-text">点一下翻开</span></button>`).join('')}</div>
      <div class="opt-grid ${v.options.length > 2 ? 'cols-2' : ''}">${opts.map(({ v: o, i }, k) => optBtn(k, o, '', 'clue-choose', i)).join('')}</div>`;
  },
  slider(v) {
    const n = v.replies.length, mid = Math.ceil(n / 2), labels = sliderLabels(v);
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">${esc(v.question)}</p>
      <div class="thermo">
        <div class="thermo-value" id="thermo-value">${mid} · ${labels[mid - 1]}</div>
        <input type="range" id="thermo" min="1" max="${n}" step="1" value="${mid}" aria-label="感受强度，1 到 ${n}">
        <div class="thermo-labels"><span>1 · ${labels[0]}</span><span>${mid} · ${labels[mid - 1]}</span><span>${n} · ${labels[n - 1]}</span></div>
      </div>
      <p class="muted" style="margin-top:12px">这一关没有正确档位。选完会告诉你，这个刻度下的感受通常长什么样。</p>
      <div class="actions"><button class="btn btn-primary" data-action="slider-submit">就用这一格</button></div>`;
  },
  match(v) {
    return `<p class="prompt">先点左边的一件事，再点右边那个最贴近的词。</p>
      <div class="pair-cols">
        <div class="pair-col"><div class="section-label">发生了什么</div>${v.pairs.map((p, i) =>
          `<button class="pair-item" data-action="pair-left" data-i="${i}">${esc(p.scene)}</button>`).join('')}</div>
        <div class="pair-col"><div class="section-label">心里那个词</div>${shuffled(v.words).map(w =>
          `<button class="pair-item" data-action="pair-right" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>
      </div>`;
  },
  breath(v) {
    return `<div class="breath-box">
      <p class="lead">${esc(v.note)}</p>
      <div class="breath-ring" id="breath-ring"><span class="breath-word" id="breath-word">准备好了再开始</span></div>
      <div class="breath-round" id="breath-round">做几轮都算数，随时可以停。</div>
      <div class="breath-actions">
        <button class="btn btn-secondary" data-action="breath-start" id="breath-start">跟着做 ${v.rounds} 轮</button>
        <button class="btn btn-primary" data-action="breath-done">我做完了 / 直接继续</button>
      </div>
      <p class="muted" style="margin-top:14px">头晕、憋气或不想做，就恢复平时呼吸，点右边继续。这里不计分、不计时。</p>
    </div>`;
  },
  reframe(v) {
    /* 拼装题的选项顺序已由组合键确定，不能再随机打乱，否则同一历史会看到不同顺序；
       手写变体仍按原来的随机打乱，行为不变。 */
    const opts = v.compose ? withIndex(v.options) : shuffled(withIndex(v.options));
    const prompt = esc(v.question || '下面几个镜头里，哪一个更贴近事实、也更留得住原本的感受？');
    return `${scenarioBox('脑子里自动冒出来的那句话', v.thought)}
      <p class="prompt">${prompt}</p>
      <div class="opt-grid">${opts.map(({ v: o, i }, k) => optBtn(k, o.t, o.d, 'reframe-choose', i)).join('')}</div>`;
  },
  chain(v) {
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">按「${esc(v.tags.join(' → '))}」的顺序，把卡片依次放进格子。</p>
      <div class="slots" id="chain-slots"></div>
      <div class="section-label">待放的卡片</div><div class="tray" id="chain-tray"></div>
      <div class="actions"><button class="btn btn-secondary" data-action="chain-undo">撤回一步</button></div>`;
  },
  sort(v) {
    return `<p class="prompt">先点一张卡，再点它更像属于的那个筐。</p>
      <div class="baskets" id="sort-baskets"></div>
      <div class="section-label">待分拣的卡片</div><div class="tray" id="sort-tray"></div>`;
  },
  perspective(v) {
    return `${scenarioBox('同一件事', v.scenario)}
      <p class="prompt">先点一个人的名字，再点他更可能冒出的那句话。</p>
      <div class="pair-cols">
        <div class="pair-col"><div class="section-label">谁在看</div>${v.roles.map((r, i) =>
          `<button class="pair-item" data-action="persp-left" data-i="${i}">${esc(r.name)}</button>`).join('')}</div>
        <div class="pair-col"><div class="section-label">他可能怎么想</div>${shuffled(v.roles.map((r, i) => ({ t: r.thought, i }))).map(o =>
          `<button class="pair-item" data-action="persp-right" data-i="${o.i}">${esc(o.t)}</button>`).join('')}</div>
      </div>`;
  },
  order(v) {
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">把 ${v.steps.length} 张线索按发生的先后排好，看看误会是从哪一环开始的。</p>
      <div class="slots" id="order-slots"></div>
      <div class="section-label">线索卡（顺序已打乱）</div><div class="tray" id="order-tray"></div>
      <div class="actions"><button class="btn btn-secondary" data-action="order-undo">撤回一步</button></div>`;
  },
  compose(v) {
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">每一行挑一块，拼成一句既说出自己、又不指责对方的话。</p>
      <div class="compose-rows">${v.rows.map((r, ri) =>
        `<div class="compose-row" data-row="${ri}"><div class="compose-label">${esc(r.label)}</div>
          <div class="compose-choices">${shuffled(withIndex(r.choices)).map(({ v: c, i: ci }) =>
            `<button class="word-chip" data-action="compose-pick" data-row="${ri}" data-i="${ci}">${esc(c.t)}</button>`).join('')}</div></div>`).join('')}</div>
      <div id="compose-preview"></div>
      <div class="actions"><button class="btn btn-primary" data-action="compose-submit" id="compose-submit" disabled>拼好了，看看这句话</button></div>`;
  },
  memory(v) {
    return `<p class="prompt">翻开两张牌，把「情绪词」和它常见的「身体信号」配成对。</p>
      <div class="memo-progress" id="memo-progress" aria-live="polite">已找到 0 / ${v.pairs.length} 对</div>
      <div class="memory-grid" id="memo-grid"></div>
      <p class="muted" style="margin-top:14px">翻错了就盖回去，不记次数。每个人的身体反应不一样，这里只是常见的一种。</p>`;
  },
  ladder(v) {
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">${esc(v.question)}</p>
      <div class="ladder">${v.rungs.map((r, i) =>
        `<button class="rung" data-action="rung-pick" data-i="${i}">
          <span class="rung-lv" aria-hidden="true">${i + 1}</span>
          <span class="rung-main"><span class="rung-label">${esc(r.label)}</span><span class="rung-body">${esc(r.body)}</span></span>
        </button>`).join('')}</div>
      <p class="muted" style="margin-top:12px">没有对错。选完之后，会看到这一档通常可以先做什么。</p>
      <div id="rung-result"></div>`;
  },
  finale(v) {
    const skills = LEVELS.filter(l => l.skill && state.skills.includes(l.skill));
    const adult = isAdultTrack();
    const skillBlock = `<h3${adult ? '' : ' style="margin-top:22px"'}>${adult ? '1' : '2'} · 这一程练过的</h3>
      <p class="muted" style="margin:6px 0 10px">不是分数，只是你遇到过的事。</p>
      <div class="skill-list">${skills.length ? skills.map(l => `<span class="skill-chip">${esc(l.skill)}</span>`).join('') : '<span class="muted">还没走过前面的站，随时可以回去。</span>'}</div>`;
    const quoteBlock = `<h3 style="margin-top:22px">${adult ? '2' : '3'} · 带走一句话</h3>
      <p class="muted" style="margin:6px 0 10px">挑一句今天最用得上的，截图留住就好，不用上传。</p>
      <div id="quote-picks" class="quote-picks">${play.quotes.map((q, i) =>
        `<button class="opt" data-action="quote-pick" data-i="${i}" aria-keyshortcuts="${i + 1}"><span class="opt-key" aria-hidden="true">${i + 1}</span><span>${esc(q)}</span></button>`).join('')}</div>
      <button class="btn-read" data-action="quote-reroll">换一组句子</button>
      <div id="finale-quote"></div>`;
    const microBlock = `<h3 style="margin-top:22px">${adult ? '3' : '4'} · 生活里可以试试</h3>
      <div id="micro-list" class="micro-list">${play.acts.map(a => `<div class="micro-card">${esc(a)}</div>`).join('')}</div>
      <button class="btn-read" data-action="micro-reroll">换两件小事</button>`;

    if (adult) {
      return `<p class="lead">走到这里。不用总结这一程，也不用给自己打分。剩下几件小事，挑着做就行。</p>
        ${skillBlock}
        ${quoteBlock}
        ${microBlock}
        <div class="talk-card" style="margin-top:22px"><h3>4 · 给三个月后的自己留一句</h3>
          <p>不用写下来，在心里说一句就够了。可以从这三个开头里挑一个：</p>
          <div class="micro-list" style="margin-top:12px">
            <div class="micro-card">「如果三个月后我还是会这样，我希望那时候的我知道……」</div>
            <div class="micro-card">「这阵子最难的是……，我做对的一点是……」</div>
            <div class="micro-card">「下次再遇到，我想先对自己说一句话：……」</div>
          </div>
          <p class="muted">这里没有输入框，也不会保存任何文字。说出来、或者只在心里过一遍，都可以。</p></div>
        <div class="actions"><button class="btn btn-primary" data-action="go-map">回到地图</button>
          <button class="btn btn-secondary" data-action="restart-all">再走一轮（换一批题）</button></div>`;
    }

    const picks = state.decor || [];
    return `<p class="lead">这一趟走到了岛的尽头。这里没有考试，只有几件小事：布置一下、看看练过的本领、带走一句话，或者和旁边的人聊两句。</p>
      <h3 style="margin-top:22px">1 · 用贝壳布置小岛（最多选 3 样）</h3>
      <div class="island-canvas"><div class="island-ground"></div>
        ${[0, 1, 2].map(s => {
          const d = picks[s] !== undefined ? DECOR[picks[s]] : null;
          return `<div class="decor-slot ${d ? 'on' : ''}" style="left:${[18, 42, 68][s]}%"><span class="decor-glyph">${d ? d.g : '＋'}</span><span class="decor-name">${d ? esc(d.n) : '空地'}</span></div>`;
        }).join('')}
      </div>
      <div class="decor-picker">${DECOR.map((d, i) =>
        `<button class="chip ${picks.includes(i) ? 'active' : ''}" data-action="decor-toggle" data-i="${i}">${d.g} ${esc(d.n)}</button>`).join('')}</div>
      ${skillBlock}
      ${quoteBlock}
      ${microBlock}
      <div class="talk-card" style="margin-top:22px"><h3>5 · 可以一起聊的卡片</h3>
        <p id="talk-text">${esc(play.talk)}</p>
        <button class="btn-read" data-action="talk-reroll">换一张</button>
        <p class="muted">不用回答，也不用聊出结论。聊聊就行，或者跳过。</p></div>
      <div class="actions"><button class="btn btn-primary" data-action="go-map">回到地图</button>
        <button class="btn btn-secondary" data-action="restart-all">再走一轮（换一批题）</button></div>`;
  }
};

/* ---------------------------------------------------------------- 关卡初始化 */
function makePlay(lv, v) {
  const base = { id: lv.id, type: lv.type, v, tries: 0, done: false };
  switch (lv.type) {
    case 'weather': return { ...base, picked: null };
    case 'clue': return { ...base, flipped: new Set() };
    case 'slider': return { ...base, value: Math.ceil(v.replies.length / 2) };
    case 'match': return { ...base, left: null, paired: new Map() };
    case 'breath': return { ...base, elapsed: 0, running: false };
    case 'chain': return { ...base, order: shuffled(v.cards.map((c, i) => i)), placed: [] };
    case 'sort': return { ...base, selected: null, placed: new Map(), trayOrder: shuffled(v.cards.map((c, i) => i)) };
    case 'perspective': return { ...base, role: null, matched: new Map() };
    case 'order': return { ...base, order: shuffled(v.steps.map((s, i) => i)), placed: [] };
    case 'compose': return { ...base, picks: v.rows.map(() => null) };
    case 'ladder': return { ...base, picked: null };
    case 'memory': {
      const deck = [];
      v.pairs.forEach((p, pi) => deck.push({ text: p[0], pair: pi, side: 0 }, { text: p[1], pair: pi, side: 1 }));
      return { ...base, deck: shuffled(deck), open: new Set(), matched: new Set(), first: null, lock: false, found: 0 };
    }
    case 'finale': return { ...base, quotes: shuffled(QUOTES).slice(0, 3), talk: rand(TALK_CARDS), acts: shuffled(MICRO_ACTIONS).slice(0, 2) };
    default: return base;
  }
}

function renderLevel(resumePlay, lvOverride, sideIndex) {
  clearAsyncTimers(); stopSpeech();
  session.view = 'level';
  const lv = lvOverride || currentLevel();
  /* 从急救页返回时沿用同一份进行态：不重新抽题、不清已选；
     呼吸计时器已被 clearAsyncTimers 停掉，把 running 归位即可。 */
  play = resumePlay || makePlay(lv, lv.type === 'finale' ? {} : pickVariant(lv.id));
  if (sideIndex !== undefined) {
    play.side = true;
    play.sideIndex = sideIndex;
  }
  const v = play.v;
  if (play.type === 'breath') play.running = false;
  const b = band();
  const side = !!play.side;
  const speakBtns = (state.settings.speak && lv.type !== 'finale')
    ? `<button class="btn-read" data-action="speak-question" aria-label="朗读题目">🔊 读题目</button><button class="btn-read" data-action="speak-options" aria-label="朗读选项">🔊 读选项</button>` : '';
  stage.innerHTML = `<div class="${viewClass()}" data-variant="${v && v.key ? esc(v.key) : ''}">
    <div class="toolbar">${bandChip(`<span class="muted">${lv.type === 'finale' ? '终章' : side ? `工作间 · ${esc(lv.time || '')} · 支线` : `岛 ${lv.island} · 第 ${lv.num} 站`}</span>`)}
      ${lv.type !== 'finale' ? '<button class="btn-read" data-action="reroll">换一道题</button>' : ''}
      ${speakBtns}
    </div>
    <div class="level-head">
      <div class="level-kicker"><span class="eyebrow">${esc(lv.kind)}</span></div>
      <h2>${esc(lv.name)}</h2><p class="level-goal">${esc(lv.goal)}</p>
    </div>
    <div class="play-area">${RENDERERS[lv.type](v)}</div>
    <div id="feedback-slot" aria-live="polite"></div>
    <div class="actions" id="level-actions">${lv.type === 'finale' ? '' : '<button class="btn btn-ghost" data-action="go-map">先回地图，进度会留着</button>'}</div>
    ${b.adult && lv.adult ? `<div class="adult-tip"><b>给大人：</b>${esc(lv.adult)}</div>` : ''}
  </div>`;
  afterRender(lv);
  updateTopbar();
  stage.focus({ preventScroll: true });
  try { window.scrollTo({ top: 0, behavior: state.settings.motion ? 'auto' : 'smooth' }); } catch (e) { /* noop */ }
  if (state.settings.autoSpeak && state.settings.speak && lv.type !== 'finale') {
    setTimeout(() => speakTexts(questionTexts()), 350);
  }
}

function afterRender(lv) {
  if (lv.type === 'chain') paintChain();
  if (lv.type === 'sort') paintSort();
  if (lv.type === 'order') paintOrder();
  if (lv.type === 'memory') paintMemory();
  if (lv.type === 'slider') {
    const input = document.getElementById('thermo');
    if (input) input.addEventListener('input', () => {
      play.value = Number(input.value);
      const labels = sliderLabels(play.v);
      document.getElementById('thermo-value').textContent = `${play.value} · ${labels[play.value - 1]}`;
    });
  }
}

/* ---------------------------------------------------------------- 子渲染 */
function paintChain() {
  const v = play.v;
  document.getElementById('chain-slots').innerHTML = v.tags.map((t, s) => {
    const cardIdx = play.placed[s];
    return `<div class="slot ${cardIdx !== undefined ? 'filled' : ''}"><span class="slot-tag">${esc(t)}</span><span>${cardIdx !== undefined ? esc(v.cards[cardIdx].text) : '等待放入…'}</span></div>`;
  }).join('');
  document.getElementById('chain-tray').innerHTML = play.order.map(i =>
    `<button class="chip ${play.placed.includes(i) ? 'used' : ''}" data-action="chain-pick" data-i="${i}" ${play.placed.includes(i) ? 'disabled' : ''}>${esc(v.cards[i].text)}</button>`).join('');
}
function paintSort() {
  const v = play.v;
  document.getElementById('sort-baskets').innerHTML = v.baskets.map((b, bi) => {
    const items = [...play.placed.entries()].filter(([, to]) => to === bi);
    return `<button class="basket ${play.selected !== null ? 'active' : ''}" data-action="sort-put" data-i="${bi}">
      <span class="basket-title">${esc(b)}（${items.length}）</span>
      <span class="basket-items">${items.length ? items.map(([ci]) => `<span class="basket-item">${esc(v.cards[ci].text)}</span>`).join('') : '<span class="muted">还没放卡片</span>'}</span></button>`;
  }).join('');
  document.getElementById('sort-tray').innerHTML = play.trayOrder.map(i =>
    `<button class="chip ${play.selected === i ? 'active' : ''} ${play.placed.has(i) ? 'used' : ''}" data-action="sort-pick" data-i="${i}" ${play.placed.has(i) ? 'disabled' : ''}>${esc(v.cards[i].text)}</button>`).join('');
}
function paintOrder() {
  const v = play.v;
  document.getElementById('order-slots').innerHTML = v.steps.map((s, i) => {
    const cardIdx = play.placed[i];
    return `<div class="slot ${cardIdx !== undefined ? 'filled' : ''}"><span class="slot-tag">第 ${i + 1} 步</span><span>${cardIdx !== undefined ? esc(v.steps[cardIdx]) : '等待放入…'}</span></div>`;
  }).join('');
  document.getElementById('order-tray').innerHTML = play.order.map(i =>
    `<button class="chip ${play.placed.includes(i) ? 'used' : ''}" data-action="order-pick" data-i="${i}" ${play.placed.includes(i) ? 'disabled' : ''}>${esc(v.steps[i])}</button>`).join('');
}
function paintMemory() {
  document.getElementById('memo-progress').textContent = `已找到 ${play.found} / ${play.v.pairs.length} 对`;
  document.getElementById('memo-grid').innerHTML = play.deck.map((c, i) => {
    const matched = play.matched.has(i);
    const open = play.open.has(i) || matched;
    const label = matched ? `已配对：${c.text}` : open ? `已翻开：${c.text}` : '未翻开的记忆牌';
    return `<button class="memo-card ${matched ? 'matched' : open ? 'open' : ''}" data-action="memo-flip" data-i="${i}" ${matched ? 'disabled' : ''} aria-label="${esc(label)}">${open ? esc(c.text) : '背面'}</button>`;
  }).join('');
}

/* ---------------------------------------------------------------- 通关 */
/* 通关结果默认按纯文本转义；只有确实要拼标签的调用方走 completeLevelHtml。
   这样以后新增题型时，即使直接把内容变量传进来，也不会执行成 HTML。 */
function completeLevel(text) { completeLevelHtml(esc(text)); }
/* 主线与支线共用的结果卡外壳：只负责渲染反馈槽、滚动到可见、清空底部动作。
   奖励 / 存档 / 文案的差异仍留在两个完成分支里，不在这里合流。 */
function paintResultCard({ kicker, html, rows, extra, buttons }) {
  const slot = document.getElementById('feedback-slot');
  if (slot) {
    slot.innerHTML = `<div class="feedback good result-card">
      <div class="result-kicker"><span class="result-check" aria-hidden="true">✓</span>${kicker}</div>
      <p class="result-main">${html}</p>
      <div class="result-rows">${rows}</div>
      ${extra || ''}
      <div class="result-actions">${buttons}</div>
    </div>`;
    try { slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
  }
  const actions = document.getElementById('level-actions');
  if (actions) actions.innerHTML = '';
}
function completeLevelHtml(html) {
  if (play.done) return;
  play.done = true;
  stopSpeech();
  /* 呼吸练习中途点「我做完了」时，计时器要立刻收掉；
     这里手动清而不是走 clearAsyncTimers，免得被标成「被打断」。 */
  if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
  if (play.running) {
    play.running = false;
    const ring = document.getElementById('breath-ring');
    if (ring) ring.classList.remove('running');
    const word = document.getElementById('breath-word');
    if (word) word.textContent = '做完了';
  }
  const lv = currentLevel();
  /* 支线完成：只写 sideCleared，不碰 cleared / awarded / cards / skills / shells，
     也不触发「一轮歇一下」的计数。主线进度与支线进度在这里彻底分开。 */
  if (play.side) {
    if (!state.sideCleared.includes(lv.id)) state.sideCleared.push(lv.id);
    save();
    updateTopbar();
    const nextI = play.sideIndex + 1;
    const canNext = nextI < WORK.length && sideUnlocked(nextI);
    const buttons = `${canNext ? `<button class="btn btn-primary" data-action="next-level">去下一幕 · ${esc(WORK[nextI].name)}</button>` : ''}
      <button class="btn btn-secondary" data-action="go-work">回到工作间</button>
      <button class="btn btn-ghost" data-action="reroll">这一幕再玩一次</button>`;
    const rows = `<div class="result-row"><b>小贴士</b><span>${esc(lv.tip)}</span></div>
          ${lv.tryIt ? `<div class="result-row"><b>生活里试试</b><span>${esc(lv.tryIt)}</span></div>` : ''}
          <div class="result-row"><b>说明</b><span>工作间是支线：不计入 ${TOTAL} 站，也不加贝壳、词卡或本领。</span></div>`;
    paintResultCard({ kicker: '这一幕走过了 · 支线', html, rows, buttons });
    return;
  }
  if (!state.cleared.includes(lv.id)) state.cleared.push(lv.id);
  if (!state.awarded.includes(lv.id)) {
    state.awarded.push(lv.id);
    if (hasShells()) state.shells += 2;   /* 贝壳是否发放由 bands.shells 决定 */
  }
  if (lv.card) {
    const bag = state.cards[bandTrack()];
    if (bag && !bag.includes(lv.card)) bag.push(lv.card);
  }
  if (lv.skill && !state.skills.includes(lv.skill)) state.skills.push(lv.skill);
  save();
  updateTopbar();
  const micro = lv.type !== 'finale' && lv.num === 4
    ? `<div class="micro-card" style="margin-top:12px">今日微行动：${esc(rand(MICRO_ACTIONS))}</div>` : '';
  const next = state.levelIndex + 1;
  const canNext = next < TOTAL && isUnlocked(next);
  const buttons = `${canNext ? `<button class="btn btn-primary" data-action="next-level">去下一站 · ${esc(LEVELS[next].name)}</button>` : ''}
      <button class="btn btn-secondary" data-action="go-map">回到地图</button>
      <button class="btn btn-ghost" data-action="reroll">这站再玩一次</button>`;
  const rows = `<div class="result-row"><b>小贴士</b><span>${esc(lv.tip)}</span></div>
        ${lv.tryIt ? `<div class="result-row"><b>生活里试试</b><span>${esc(lv.tryIt)}</span></div>` : ''}
        <div class="result-row"><b>收进图鉴</b><span>${esc(lv.card || '这一站')}　·　本领：${esc(lv.skill || '这一站')}</span></div>`;
  paintResultCard({ kicker: '这一站完成了 · 带走了什么', html, rows, extra: micro, buttons });
  session.lastCleared = lv.id;
  session.clearedThisRun += 1;
  if (session.clearedThisRun % band().rest === 0) setTimeout(openRest, 900);
}

/* ---------------------------------------------------------------- 弹窗 */
function openModal(html) {
  lastFocus = document.activeElement;
  overlay.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}<button class="modal-close" data-action="close-modal" aria-label="关闭弹窗">×</button></div></div>`;
  /* 弹窗打开时锁住背后的页面滚动：小屏上滑到弹窗底部不会把地图也带着滚。 */
  document.body.classList.add('modal-open');
  /* 用 DOM 取标题，避免正则漏掉带属性的标题；有标题就走 aria-labelledby，
     没有才退回通用 aria-label。overlay 不再挂 aria-live，避免整个弹窗被重复播报。 */
  const modal = overlay.querySelector('.modal');
  const titleEl = modal && modal.querySelector('.modal-title');
  if (titleEl) {
    if (!titleEl.id) titleEl.id = 'modal-title';
    modal.setAttribute('aria-labelledby', titleEl.id);
  } else if (modal) {
    modal.setAttribute('aria-label', '对话框');
  }
  overlay.classList.add('open');
  const first = overlay.querySelector('button, [tabindex]');
  if (first) { try { first.focus(); } catch (e) { /* noop */ } }
}
/* 弹窗内的 Tab 循环，避免焦点跑到背后页面 */
function trapTab(e) {
  const focusables = Array.from(overlay.querySelectorAll('button:not(:disabled), [tabindex]:not([tabindex="-1"])'))
    .filter(el2 => el2.offsetParent !== null || el2 === document.activeElement);
  if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  else if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
}
function closeModal() {
  overlay.classList.remove('open'); overlay.innerHTML = '';
  document.body.classList.remove('modal-open');
  if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) { /* noop */ } }
  lastFocus = null;
}

function openRest() {
  openModal(`<div class="modal-title">歇一下，看看远处</div>
    <div class="modal-body"><p>已经走了 ${session.clearedThisRun} 站。眼睛和肩膀大概也想动一动了：抬头看看 6 米外的地方，约 20 秒；或者站起来伸个懒腰、喝口水。</p>
    <p>${esc(band().len)}，走到这里正好可以停。这是一般性的休息提醒，不是医疗建议；想继续玩也完全可以，进度不会丢。</p></div>
    <div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">好，继续</button>
    <button class="btn btn-ghost" data-action="go-map">先到这里，回地图</button></div>`);
}
/* ---------------------------------------------------------------- 导出 / 导入
   导出把 README §5 的存档字段原样装进 JSON，带独立的 exportVersion。
   导入的文件属于外部输入：先校验来源与结构，再让用户确认覆盖；
   确认之前不改动当前档，确认后仍可用内存里的快照撤销一次。 */
let pendingImport = null;   /* 校验通过、等待确认的导入 */
let importUndo = null;      /* 上一次导入前的快照，只存在内存里 */

function exportFilename(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `mood-island-progress-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

function exportPayload() {
  return {
    app: EXPORT_APP,
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    state: clone(state)
  };
}

function setDataStatus(msg) {
  const el = document.getElementById('data-status');
  if (el) el.textContent = msg;
}

function exportProgress() {
  const name = exportFilename();
  const text = JSON.stringify(exportPayload(), null, 2);
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    /* 立刻 revoke 会让个别浏览器把下载取消掉，挪到下一轮事件循环 */
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* noop */ } }, 0);
    setDataStatus(`已导出 ${name}。文件在浏览器的下载目录里，只含本机的进度与设置。`);
  } catch (e) {
    setDataStatus('这台浏览器不允许导出文件。可以换用 Chrome / Safari 再试。');
  }
}

function hasProgress(s) {
  return !!s.band || s.cleared.length > 0 || s.awarded.length > 0
    || s.cards.kid.length > 0 || s.cards.adult.length > 0
    || s.skills.length > 0 || s.shells > 0 || s.decor.length > 0;
}

/* 只做校验，不碰当前 state。返回 code 供测试断言，message 直接给用户看。 */
function validateImport(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (e) { return { ok: false, code: 'json', message: '这个文件不是有效的 JSON，可能不是本游戏导出的文件，或者传输时被改坏了。' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, code: 'shape', message: '文件内容不是一份进度存档。' };
  }
  if (data.app !== EXPORT_APP) {
    return { ok: false, code: 'app', message: '这不是《心情闯关岛》导出的进度文件：缺少应用标识。请选设置里「导出进度」得到的 JSON。' };
  }
  const ev = data.exportVersion;
  if (!Number.isInteger(ev) || ev < 1) {
    return { ok: false, code: 'export-version-missing', message: '文件里的导出格式版本缺失或无法识别。' };
  }
  if (ev > EXPORT_VERSION) {
    return { ok: false, code: 'export-version-newer', message: `这个文件来自更新的导出格式（v${ev}），当前版本只认得 v${EXPORT_VERSION}。请先更新游戏再导入。` };
  }
  const raw = data.state;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, code: 'state-missing', message: '文件里缺少存档内容（state），无法导入。当前进度没有被改动。' };
  }
  const sv = Number(raw.version);
  if (Number.isFinite(sv) && sv > SCHEMA_VERSION) {
    return { ok: false, code: 'schema-newer', message: `这份存档的结构版本（v${sv}）比当前游戏（v${SCHEMA_VERSION}）新，导进来可能会丢字段。请先更新游戏。` };
  }
  /* 不论导出时是哪个结构版本，都走同一条 migrate()：白名单过滤 + 旧档补齐 */
  const next = migrate(raw);
  if (!hasProgress(next)) {
    return { ok: false, code: 'empty', message: '这份文件里没有可以导入的进度（没有年龄段、关卡、词卡、本领或贝壳）。当前进度没有被改动。' };
  }
  return { ok: true, state: next, exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '', exportVersion: ev };
}

function summarizeState(s) {
  const b = AGE_BANDS.find(x => x.id === s.band);
  return {
    band: b ? `${b.name} · ${b.tag}` : '还没选年龄段',
    kid: s.cleared.filter(id => KID.levels.some(l => l.id === id)).length,
    adult: s.cleared.filter(id => ADULT.levels.some(l => l.id === id)).length,
    cards: s.cards.kid.length + s.cards.adult.length,
    skills: s.skills.length,
    shells: s.shells
  };
}

function formatExportTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try { return d.toLocaleString('zh-CN', { hour12: false }); }
  catch (e) { return iso; }
}

function importSummaryHtml(s) {
  return `<p>${esc(s.band)}</p>
    <p>儿童轨 ${s.kid} 站 · 成年轨 ${s.adult} 站</p>
    <p>词卡 ${s.cards} 张 · 本领 ${s.skills} 个 · 贝壳 ${s.shells}</p>`;
}

function showImportError(message, fileName) {
  openModal(`<div class="modal-title">导入失败</div>
    <div class="modal-body">
      ${fileName ? `<p>文件：<b>${esc(fileName)}</b></p>` : ''}
      <p>${esc(message)}</p>
      <p class="muted">当前设备上的进度没有被改动。</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-action="close-modal">知道了</button>
      <button class="btn btn-primary" data-action="import-progress">换个文件</button>
    </div>`);
}

function previewImport(text, fileName) {
  const res = validateImport(text);
  if (!res.ok) { showImportError(res.message, fileName); return; }
  pendingImport = { ...res, fileName };
  const now = summarizeState(state);
  const next = summarizeState(res.state);
  const when = formatExportTime(res.exportedAt);
  openModal(`<div class="modal-title">导入前先看一眼</div>
    <div class="modal-body">
      <p>文件：<b>${esc(fileName || '未命名')}</b>${when ? ` · 导出于 ${esc(when)}` : ''}</p>
      <div class="import-compare">
        <div><b>文件里的进度</b>${importSummaryHtml(next)}</div>
        <div><b>当前设备</b>${importSummaryHtml(now)}</div>
      </div>
      <p class="muted">导入会<b>覆盖</b>当前设备的进度与显示设置，不做合并。确认后，本次打开期间还可以撤销一次。</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-action="cancel-import">先不导入</button>
      <button class="btn btn-primary" data-action="import-confirm">覆盖并导入</button>
    </div>`);
}

function readImportFile(file) {
  if (!file) return;
  /* 进度 JSON 只有几十 KB；过大的文件多半不是本游戏的导出，先挡在门外 */
  if (file.size > 5 * 1024 * 1024) {
    showImportError('这个文件太大了（超过 5 MB），不像是一份进度备份。当前进度没有被改动。', file.name);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => previewImport(String(reader.result || ''), file.name);
  reader.onerror = () => showImportError('读不出这个文件，可能是权限或编码问题。当前进度没有被改动。', file.name);
  reader.readAsText(file);
}

/* 文件选择框按需创建、用完移除：设置页 DOM 里不留常驻的 input，
   既符合「页面上没有自由文本输入框」的约束，也不让选择器打断设置页的焦点顺序。 */
function pickImportFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.remove();
    if (file) readImportFile(file);
  });
  /* 用户取消选择：清掉临时 input（cancel 事件较新，旧浏览器靠 change 分支） */
  input.addEventListener('cancel', () => input.remove());
  document.body.appendChild(input);
  input.click();
}

function openSettings() {
  const s = state.settings;
  openModal(`<div class="modal-title">显示、朗读与数据</div>
    <div class="modal-body">
      <div class="setting-row"><strong>年龄段</strong><div class="seg">
        ${AGE_BANDS.map(b => `<button class="${state.band === b.id ? 'on' : ''}" data-action="set-band" data-b="${b.id}" data-next="map">${esc(b.name)}</button>`).join('')}
      </div><p class="muted" style="margin-top:8px">${esc(band().desc)}　${esc(band().len)}。前四档共用一套儿童 / 亲子的站，成年档是独立的一套，两边进度分开记、都保留。</p></div>
      <div class="setting-row"><strong>字号</strong><div class="seg">
        ${[[1, '标准'], [1.15, '大'], [1.3, '特大']].map(([v, n]) => `<button class="${s.scale === v ? 'on' : ''}" data-action="set-scale" data-v="${v}">${n}</button>`).join('')}
      </div></div>
      <div class="setting-row"><strong>朗读（用这台设备自带的语音，不联网）</strong><div class="seg">
        <button class="${s.speak ? 'on' : ''}" data-action="toggle-flag" data-k="speak" data-v="1">开启朗读</button>
        <button class="${!s.speak ? 'on' : ''}" data-action="toggle-flag" data-k="speak" data-v="0">关闭</button>
        <button class="${s.autoSpeak ? 'on' : ''}" data-action="toggle-flag" data-k="autoSpeak" data-v="${s.autoSpeak ? 0 : 1}">进站自动读题目</button>
      </div><p class="muted" style="margin-top:8px">朗读用的是设备自带语音，不需要联网。iPhone / iPad 等浏览器要求先点一下页面才允许自动朗读；这时点关卡里的「读题目」总是有效。</p></div>
      <div class="setting-row"><strong>动效与对比</strong><div class="seg">
        <button class="${!s.motion ? 'on' : ''}" data-action="toggle-flag" data-k="motion" data-v="0">保留轻微动效</button>
        <button class="${s.motion ? 'on' : ''}" data-action="toggle-flag" data-k="motion" data-v="1">尽量减少动画</button>
        <button class="${s.contrast ? 'on' : ''}" data-action="toggle-flag" data-k="contrast" data-v="${s.contrast ? 0 : 1}">高对比</button>
      </div><p class="muted" style="margin-top:8px">系统设置了「减少动态效果」时，本游戏会自动遵守。</p></div>
      <div class="setting-row"><strong>这里存了什么</strong>
        <p>只存「年龄段、走到哪一站、词卡、本领、贝壳、小岛摆设、显示设置」，全部留在这台设备的浏览器里，不上传、不联网。</p>
        <p><b>不会保存</b>：开场选的天气、任何输入的心情文字（本游戏也不提供文字输入框）。</p>
        ${storageWritable ? '' : '<p class="muted"><b>当前浏览器无法保存数据</b>：这一趟仍能继续玩，但关掉页面后进度不会留下来。换普通窗口打开即可正常保存。</p>'}</div>
      <div class="setting-row"><strong>备份与迁移</strong>
        <p>导出会生成一个 JSON 文件，只含上面这些字段；换设备或清浏览器数据前留一份，之后可以再导入。</p>
        <p class="muted">导入会先让你核对年龄段与站数，确认后才覆盖；覆盖前的那一份在本次打开期间还能撤销一次。</p>
        <div class="seg">
          <button data-action="export-progress">导出进度</button>
          <button data-action="import-progress">导入进度</button>
        </div>
        <p class="muted" id="data-status" role="status"></p></div>
    </div>
    <div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">完成</button>
      <button class="btn btn-ghost" data-action="clear-progress">清空本机进度</button></div>`);
}
function openCodex() {
  /* 图鉴按当前轨展示：成年档有自己的一套卡片，不和儿童档混在一起 */
  const keys = LEVELS.map(l => l.card).filter(Boolean);
  const bag = cardsInTrack();
  const got = keys.filter(k => bag.includes(k)).length;
  openModal(`<div class="modal-title">词卡图鉴 · ${got} / ${keys.length}</div>
    <div class="modal-body">每张卡都是从一站里带回来的小工具。没有集齐压力，也没有隐藏奖励。</div>
    <div class="codex-grid">${keys.map(k => {
      const has = bag.includes(k);
      const def = CODEX[k] || { t: '', e: '' };
      return `<div class="codex-card ${has ? '' : 'locked'}"><b>${has ? esc(k) : '???'}</b>
        <span>${has ? esc(def.t) : '走到那一站就能遇见'}</span>
        ${has ? `<span class="codex-eg">${esc(def.e)}</span>` : ''}</div>`;
    }).join('')}</div>
    <div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">合上图鉴</button></div>`);
}
function openSkills() {
  const list = LEVELS.filter(l => l.skill);
  const got = list.filter(l => state.skills.includes(l.skill)).length;
  openModal(`<div class="modal-title">本领清单 · ${got} / ${list.length}</div>
    <div class="modal-body">只是这一趟遇到过的事，不评级、不比较。同一条轨上再走一遍，本领会接着留着。</div>
    <div class="skill-list" style="margin-top:16px">${list.map(l => {
      const has = state.skills.includes(l.skill);
      return `<span class="skill-chip ${has ? '' : 'locked'}">${has ? esc(l.skill) : '· · ·'}</span>`;
    }).join('')}</div>
    <div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">合上</button></div>`);
}
let lastBottle = -1;
function openBottle() {
  /* 换一题时避开上一题，题池够大就不会连着抽到同一道 */
  let i = Math.floor(Math.random() * BOTTLES.length);
  if (BOTTLES.length > 1 && i === lastBottle) i = (i + 1) % BOTTLES.length;
  lastBottle = i;
  const b = BOTTLES[i];
  openModal(`<div class="modal-title">今日漂流瓶 · 一题就好</div>
    <div class="modal-body"><p>${esc(b.q)}</p><p class="muted">不记进度、不打卡，选哪一个都会给一句回应。</p></div>
    <div class="opt-grid" style="margin-top:16px" id="bottle-opts">${b.opts.map((o, i) => optBtn(i, o, '', 'bottle-choose')).join('')}</div>
    <div id="bottle-feedback"></div>
    <div class="modal-actions"><button class="btn btn-ghost" data-action="open-bottle">换一题</button>
      <button class="btn btn-secondary" data-action="close-modal">收起</button></div>`);
  overlay.dataset.why = b.why;
}

/* ---------------------------------------------------------------- 动作分发 */
const ACTIONS = {
  'start': () => { session.navDir = 'forward'; renderMap(); },
  'go-map': () => { stopSpeech(); closeModal(); session.navDir = 'back'; renderMap(); },
  'open-level': (el) => {
    if (session.view === 'map') session.mapScroll = window.scrollY || 0;
    state.levelIndex = Number(el.dataset.i);
    play = {};
    session.navDir = 'forward'; closeModal(); renderLevel();
  },
  'open-work-level': (el) => {
    const i = Number(el.dataset.i);
    if (!workReachable(i)) return;
    session.navDir = 'forward'; closeModal();
    renderLevel(null, WORK[i], i);
  },
  'go-work': () => { stopSpeech(); closeModal(); session.navDir = 'back'; renderWork(); },
  'next-level': () => {
    if (play.side) {
      const i = play.sideIndex + 1;
      if (i < WORK.length && sideUnlocked(i)) {
        session.navDir = 'forward';
        renderLevel(null, WORK[i], i);
      }
      return;
    }
    state.levelIndex += 1; session.navDir = 'forward'; renderLevel();
  },
  'reroll': () => {
    session.navDir = 'forward';
    /* 支线重抽要带回来源幕次：否则新 play 会丢掉 side 标记，通关时写进主线进度。 */
    if (play.side) renderLevel(null, WORK[play.sideIndex], play.sideIndex);
    else renderLevel();
    showFeedback('gentle', '换了一道题，进度还留着。慢慢来。');
  },
  'goto-band': () => { stopSpeech(); session.navDir = ''; renderAgeGate(); },
  /* 急救入口：记下进入前那一屏，Esc 与「回到…」都回到那里。
     入口本身不改 session.view 之外的状态，也不写存档。 */
  'open-help': () => {
    if (session.view !== 'help') {
      /* 与 routeTo 的回落规则保持一致：已有年龄段时，选档页只是换档过渡屏。 */
      session.helpFrom = session.view === 'gate' && state.band ? 'home' : (session.view || 'home');
      helpResume = session.view === 'level' ? play : null;
    }
    renderHelp();
  },
  'help-close': () => {
    stopSpeech(); closeModal(); session.navDir = 'back';
    const from = session.helpFrom;
    const resume = helpResume;
    helpResume = null;
    if (from === 'map') renderMap();
    else if (from === 'level') renderLevel(resume);
    else if (from === 'retreat') (session.retreatStep >= 0 ? renderRetreatPractice(session.retreatStep) : renderRetreatList());
    else if (from === 'dict') renderDictionary();
    else if (from === 'selfhelp') renderSelfHelp();
    else if (from === 'slowvars') renderSlowVars();
    else if (from === 'work') renderWork();
    else if (from === 'gate' && !state.band) renderAgeGate();
    else renderHome();
  },
  'help-ground': () => {
    if (helpGroundDone) return;
    helpGroundDone = true;
    const done = document.getElementById('help-ground-done');
    if (done) done.hidden = false;
  },
  'help-word': (el) => {
    const w = el.dataset.w;
    const act = HELP_ACTIONS.find(a => a.id === 'name') || {};
    if (!w || !(act.words || []).includes(w)) return;
    helpWord = w;
    document.querySelectorAll('#stage .help-word').forEach(b => {
      const on = b.dataset.w === w;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const out = document.getElementById('help-picked');
    if (out) {
      out.hidden = false;
      out.textContent = String(act.after || '').replace('{word}', w);
    }
  },
  'help-speak': (el) => {
    /* 「读给我听」是显式请求：即使设置里关了自动朗读，也读这一次 */
    const t = el.dataset.say || '';
    try {
      if (t && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t);
        u.lang = 'zh-CN'; u.rate = 0.85; u.pitch = 1.05;
        window.speechSynthesis.speak(u);
      }
    } catch (err) { /* 不支持朗读时静默：文字仍然在页面上 */ }
  },
  'set-band': (el) => {
    const b = AGE_BANDS.find(x => x.id === el.dataset.b) || AGE_BANDS[1];
    const firstPick = !state.band;
    const prev = band();
    const customScale = state.settings.scale !== prev.scale;
    state.band = b.id;
    if (firstPick || !customScale) state.settings.scale = b.scale;
    if (firstPick || !state.settings.speakTouched) state.settings.speak = b.speak;
    save(); applySettings(); closeModal();
    session.tip = b.id === 'adult'
      ? '已切换到「成年 · 心智整理」，换成一套成年人的站，另有一间静修间。儿童档的进度也还留着。'
      : `已切换到「${b.name} · ${b.tag}」，题目会换一批，进度和词卡都还在。`;
    session.navDir = '';
    if (el.dataset.next === 'map') renderMap(); else renderHome();
  },
  'restart-all': () => {
    /* 只重置当前轨的主线；另一条轨的进度、支线 sideCleared、拼装题的 seen 都不动。 */
    const mine = new Set(LEVELS.map(l => l.id));
    state.cleared = state.cleared.filter(id => !mine.has(id));
    session.clearedThisRun = 0; lastVariant = {}; save();
    session.tip = '新的一轮，当前轨的主线重新开始；词卡、本领、贝壳、工作间和已见过的题型都还留着。';
    renderMap();
  },
  'open-settings': () => openSettings(),
  'export-progress': () => exportProgress(),
  'import-progress': () => pickImportFile(),
  'cancel-import': () => { pendingImport = null; closeModal(); openSettings(); },
  'import-confirm': () => {
    if (!pendingImport) return;
    /* 先留一份内存快照，再覆盖；写盘失败也不影响撤销（快照不依赖 localStorage） */
    const before = clone(state);
    const fileName = pendingImport.fileName;
    state = pendingImport.state;
    pendingImport = null;
    importUndo = before;
    save(); applySettings();
    closeModal();
    openModal(`<div class="modal-title">导入完成</div>
      <div class="modal-body">
        <p>已用 <b>${esc(fileName || '这份文件')}</b> 覆盖当前进度。年龄段与显示设置也一起换成了文件里的。</p>
        <p class="muted">如果选错了文件，现在还可以恢复成导入前的那一份；关掉页面后就不再提供撤销。</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="import-undo">撤销这次导入</button>
        <button class="btn btn-primary" data-action="import-finish">好，继续</button>
      </div>`);
  },
  'import-undo': () => {
    if (importUndo) {
      state = importUndo;
      save(); applySettings();
    }
    importUndo = null;
    closeModal();
    session.tip = '已撤销这次导入，恢复到导入前的进度。';
    if (!state.band) renderAgeGate(); else renderHome();
  },
  'import-finish': () => {
    importUndo = null;
    closeModal();
    session.tip = '进度已导入。';
    if (!state.band) renderAgeGate(); else renderHome();
  },
  'set-scale': (el) => { state.settings.scale = Number(el.dataset.v); save(); applySettings(); openSettings(); },
  'toggle-flag': (el) => {
    state.settings[el.dataset.k] = el.dataset.v === '1';
    if (el.dataset.k === 'speak') state.settings.speakTouched = true;
    save(); applySettings();
    if (!state.settings.speak) stopSpeech();
    openSettings();
  },
  'clear-progress': () => openModal(`<div class="modal-title">确认清空？</div>
    <div class="modal-body"><p>会清掉这台设备上记录的关卡进度、词卡、本领、贝壳和小岛摆设，无法撤销。年龄段和显示设置会保留。</p></div>
    <div class="modal-actions"><button class="btn btn-secondary" data-action="open-settings">先不清了</button>
    <button class="btn btn-primary" data-action="clear-progress-confirm">确认清空</button></div>`),
  'clear-progress-confirm': () => {
    const keep = { band: state.band, settings: state.settings };
    removeAllSaves();
    state = clone(DEFAULT_STATE); state.band = keep.band; state.settings = keep.settings;
    save(); session.clearedThisRun = 0; closeModal(); renderHome();
  },
  'open-codex': () => openCodex(),
  'open-dictionary': () => {
    /* 与慢变量一致：每次进入都是干净状态，筛选与搜索词不跨视图保留，也不落盘 */
    dictCat = 'all'; dictQuery = ''; dictKind = 'all';
    session.navDir = 'forward'; renderDictionary();
  },
  'dict-cat': (el) => {
    dictCat = el.dataset.c || 'all';
    if (dictCat !== 'all' && !DICT_CATS.includes(dictCat)) dictCat = 'all';
    applyDictFilter();
  },
  'dict-kind': (el) => {
    const k = el.dataset.k || 'all';
    if (k !== 'all' && !DICT_KINDS.some(x => x.id === k)) return;
    dictKind = k;
    applyDictFilter();
  },
  'dict-reset': () => {
    dictCat = 'all'; dictQuery = ''; dictKind = 'all';
    renderDictionary();
  },
  'dict-jump': (el) => {
    const t = el.dataset.t;
    if (!DICTIONARY.some(d => d.t === t)) return;
    /* 关联词条可能被当前筛选挡住：先清干净再跳，避免「点了没反应」 */
    dictCat = 'all'; dictQuery = ''; dictKind = 'all';
    renderDictionary();
    const card = [...document.querySelectorAll('#dict-grid .dict-card')].find(c => c.dataset.term === t);
    if (!card) return;
    card.open = true;
    card.scrollIntoView({ block: 'center' });
    const summary = card.querySelector('summary');
    if (summary) summary.focus({ preventScroll: true });
  },
  'open-selfhelp': () => { session.navDir = 'forward'; renderSelfHelp(); },
  'sh-state': (el) => {
    shState = el.dataset.id || null;
    document.querySelectorAll('#sh-states .sh-state').forEach(b => b.classList.toggle('on', b.dataset.id === shState));
    const panel = document.getElementById('sh-state-panel');
    if (panel) panel.innerHTML = shState ? shStatePanel(shState) : `<p class="sh-hint">${esc(SH_HINT)}</p>`;
  },
  'sh-state-clear': () => {
    shState = null;
    document.querySelectorAll('#sh-states .sh-state').forEach(b => b.classList.remove('on'));
    const panel = document.getElementById('sh-state-panel');
    if (panel) panel.innerHTML = `<p class="sh-hint">${esc(SH_HINT)}</p>`;
  },
  'sh-cat': (el) => {
    shCat = el.dataset.c || 'all';
    document.querySelectorAll('#sh-cats .dict-cat').forEach(b => b.classList.toggle('on', b.dataset.c === shCat));
    applyShFilter();
  },
  'open-slowvars': () => {
    /* 每次进入都是干净状态：选择与筛选不跨视图保留，也不落盘 */
    svVar = null; svCat = 'all';
    session.navDir = 'forward'; renderSlowVars();
  },
  'sv-var': (el) => {
    const id = el.dataset.id;
    if (!SV_VARS.some(v => v.id === id)) return;
    svVar = id; svCat = id;
    syncSvSelection();
  },
  'sv-var-clear': () => {
    svVar = null; svCat = 'all';
    syncSvSelection();
  },
  'sv-cat': (el) => {
    const c = el.dataset.c || 'all';
    if (c !== 'all' && !SV_VARS.some(v => v.id === c)) return;
    svCat = c;
    syncSvSelection();
  },
  'open-skills': () => openSkills(),
  'open-bottle': () => openBottle(),
  'bottle-choose': () => {
    document.getElementById('bottle-feedback').innerHTML =
      `<div class="feedback good" style="margin-top:14px">${esc(overlay.dataset.why || '谢谢，慢慢来。')}</div>`;
    const opts = document.getElementById('bottle-opts');
    if (opts) opts.querySelectorAll('button').forEach(b => b.disabled = true);
  },
  'close-modal': () => closeModal(),

  /* 静修间：不计进度、不打卡、不判对错 */
  'open-retreat': () => { session.navDir = 'forward'; renderRetreatList(); },
  'retreat-start': (el) => { session.navDir = 'forward'; renderRetreatPractice(Number(el.dataset.i)); },
  'ground-pick': (el) => {
    const r = Number(el.dataset.row), i = Number(el.dataset.i);
    play.picks[r] = i;
    document.querySelectorAll(`.ground-row[data-row="${r}"] .word-chip`).forEach((b, bi) => b.classList.toggle('selected', bi === i));
    if (play.picks.some(p => p === null)) return;
    const chosen = play.data.rows.map((row, ri) => `${row.label.split(' · ')[0]}：${row.choices[play.picks[ri]]}`);
    const box = document.getElementById('retreat-result');
    if (box) box.innerHTML = `<div class="feedback good"><p>${esc(play.data.close)}</p>
      <div class="result-rows">${chosen.map(c => `<div class="result-row"><span>${esc(c)}</span></div>`).join('')}</div>
      <div class="actions" style="margin-top:14px"><button class="btn btn-secondary" data-action="retreat-start" data-i="${play.retreatIndex}">再来一次</button>
      <button class="btn btn-ghost" data-action="go-map">结束</button></div></div>`;
  },
  'defuse-pick': (el) => {
    const i = Number(el.dataset.orig), v = play.v;
    if (i === v.answer) {
      document.querySelectorAll('#stage .opt').forEach(b => { b.disabled = true; });
      el.classList.add('selected');
      const box = document.getElementById('retreat-result');
      if (box) box.innerHTML = `<div class="feedback good"><p>${esc(v.why)}</p>
        <p class="muted" style="margin-top:8px">这里没有分数，也不要求你马上觉得好一点。</p>
        <div class="actions" style="margin-top:12px"><button class="btn btn-secondary" data-action="defuse-reroll">再练一句</button>
        <button class="btn btn-ghost" data-action="go-map">结束</button></div></div>`;
    } else {
      showFeedback('gentle', `「${esc(v.options[i].d)}」也常是人的第一反应。再看看哪一种只是「看见」，没有再加一层评判？`);
      el.classList.add('tried'); setTimeout(() => el.classList.remove('tried'), 650);
    }
  },
  'defuse-reroll': () => renderRetreatPractice(session.retreatStep),
  'space-next': () => { play.step += 1; paintSpace(); },

  'speak-question': () => speakTexts(questionTexts()),
  'speak-options': () => speakTexts(optionTexts()),

  /* 1-1 天气：只存在内存，不落盘 */
  'weather-pick': (el) => {
    play.picked = Number(el.dataset.i);
    document.querySelectorAll('.weather-btn').forEach((b, i) => b.classList.toggle('selected', i === play.picked));
    document.getElementById('weather-go').disabled = false;
    showFeedback('gentle', '选好了就出发。这个选择不会被保存，也不会被拿去分析。');
  },
  'weather-go': () => completeLevel('天气没有好坏，也不需要向谁解释。出发吧。'),

  /* 1-2 线索 */
  'clue-flip': (el) => {
    const i = Number(el.dataset.i);
    play.flipped.add(i);
    el.classList.add('flipped');
    el.querySelector('.clue-text').textContent = play.v.clues[i];
  },
  'clue-choose': (el) => {
    const i = Number(el.dataset.orig);
    if (i === play.v.answer) {
      document.querySelectorAll('#stage .opt').forEach(b => { b.disabled = true; });
      el.classList.add('selected');
      completeLevelHtml(`${esc(play.v.why)}<span class="tip">你翻开了 ${play.flipped.size} / ${play.v.clues.length} 张线索。</span>`);
    } else {
      nudge(`「${play.v.options[i]}」也是一种可能。再把几张线索合起来看看？`);
    }
  },

  /* 1-3 温度计：任何档位都完成 */
  'slider-submit': () => {
    const labels = sliderLabels(play.v);
    const msg = `你选了「${labels[play.value - 1]}」。${esc(play.v.replies[play.value - 1])}<span class="tip">同一件事，别人可能停在另一格，那也一样成立。</span>`;
    const input = document.getElementById('thermo'); if (input) input.disabled = true;
    document.querySelectorAll('[data-action="slider-submit"]').forEach(b => b.disabled = true);
    completeLevelHtml(msg);
  },

  /* 1-4 近义词配对 */
  'pair-left': (el) => {
    play.left = Number(el.dataset.i);
    document.querySelectorAll('[data-action="pair-left"]').forEach((b, i) => b.classList.toggle('active', i === play.left));
  },
  'pair-right': (el) => {
    if (play.left === null) { nudge('先点左边的一件事，再来选词。'); return; }
    const word = el.dataset.w;
    const target = play.v.pairs[play.left].word;
    if (word === target) {
      play.paired.set(play.left, word);
      el.classList.add('paired'); el.disabled = true;
      const leftBtn = document.querySelectorAll('[data-action="pair-left"]')[play.left];
      if (leftBtn) { leftBtn.classList.add('paired'); leftBtn.classList.remove('active'); leftBtn.disabled = true; }
      play.left = null;
      showFeedback('gentle', `配上了：「${esc(word)}」。<span class="tip">同一件事也可能同时有别的感觉，这里只取最贴近的那个词。</span>`);
      if (play.paired.size === play.v.pairs.length) completeLevel('几个词各归其位。能把感受分得这么细，本身就是一种照顾。');
    } else {
      nudge(`「${word}」也很像，但再看看左边那件事，重点落在哪里？`);
    }
  },

  /* 2-1 呼吸 */
  'breath-start': () => {
    if (play.running) return;
    const rounds = play.v.rounds || 2;
    play.running = true; play.elapsed = 0;
    const ring = document.getElementById('breath-ring');
    const word = document.getElementById('breath-word');
    const round = document.getElementById('breath-round');
    if (ring) ring.classList.add('running');
    const start = document.getElementById('breath-start');
    if (start) { start.disabled = true; start.textContent = '正在跟着做…'; }
    breathTimer = setInterval(() => {
      play.elapsed += 1;
      const t = play.elapsed % 10;
      const r = Math.min(rounds, Math.floor(play.elapsed / 10) + 1);
      if (word) word.textContent = t < 4 ? '慢慢吸气' : '慢慢呼气';
      if (round) round.textContent = `第 ${r} / ${rounds} 轮 · 呼气比吸气长一点 · 随时可以停`;
      if (play.elapsed >= rounds * 10) {
        clearInterval(breathTimer); breathTimer = null;
        if (ring) ring.classList.remove('running');
        if (word) word.textContent = '做完了';
        if (round) round.textContent = `${rounds} 轮完成。感觉怎么样都可以，不用评价自己。`;
      }
    }, 1000);
  },
  'breath-done': () => completeLevel('谢谢你陪自己待了这一小会儿。'),

  /* 2-2 换镜头 */
  'reframe-choose': (el) => {
    const i = Number(el.dataset.orig);
    if (i === play.v.answer) {
      document.querySelectorAll('#stage .opt').forEach(b => { b.disabled = true; });
      el.classList.add('selected');
      completeLevel(play.v.why);
    } else {
      nudge(`「${play.v.options[i].d}」这个方向，可能会让那句话更紧一点。换个镜头试试？`);
    }
  },

  /* 2-3 要素连线 */
  'chain-pick': (el) => {
    const i = Number(el.dataset.i);
    const slot = play.placed.length;
    const expect = play.v.tags[slot];
    if (play.v.cards[i].tag === expect) {
      play.placed.push(i); paintChain();
      showFeedback('gentle', `放进「${esc(expect)}」了，继续。`);
      if (play.placed.length === play.v.cards.length) {
        completeLevel('几环连起来了：发生了一件事，脑子里冒出一句话，身体跟着有反应，于是做了某个动作。顺序不是唯一的，有时身体会先回答。');
      }
    } else {
      nudge(`这张更像在说「${play.v.cards[i].tag}」，而现在这一格是「${expect}」。`);
    }
  },
  'chain-undo': () => { if (play.placed.length) { play.placed.pop(); paintChain(); } },

  /* 2-4 需求分拣 */
  'sort-pick': (el) => { play.selected = Number(el.dataset.i); paintSort(); showFeedback('gentle', '选好了，再点一个筐。'); },
  'sort-put': (el) => {
    const bi = Number(el.dataset.i);
    if (play.selected === null) { nudge('先点一张卡，再点筐。'); return; }
    const card = play.v.cards[play.selected];
    if (card.to === bi) {
      play.placed.set(play.selected, bi); play.selected = null; paintSort();
      if (play.placed.size === play.v.cards.length) completeLevel('卡片都有了去处。有时候一张卡放进两个筐都说得通，按第一感觉来就好。');
      else showFeedback('gentle', '放好了，继续。');
    } else {
      nudge(`「${card.text}」更像是在说「${play.v.baskets[card.to]}」，要不要换个筐试试？`);
    }
  },

  /* 3-1 换位 */
  'persp-left': (el) => {
    play.role = Number(el.dataset.i);
    document.querySelectorAll('[data-action="persp-left"]').forEach((b, i) => b.classList.toggle('active', i === play.role));
  },
  'persp-right': (el) => {
    if (play.role === null) { nudge('先点一个人的名字。'); return; }
    const i = Number(el.dataset.i);
    if (i === play.role) {
      play.matched.set(play.role, i);
      el.classList.add('paired'); el.disabled = true;
      const left = document.querySelectorAll('[data-action="persp-left"]')[play.role];
      if (left) { left.classList.add('paired'); left.classList.remove('active'); left.disabled = true; }
      play.role = null;
      showFeedback('gentle', '两副眼镜对上了。两个人的重点不一样，但都可以成立。');
      if (play.matched.size === play.v.roles.length) completeLevel('先弄清楚对方看见了什么，比急着判断谁对谁错更省力。');
    } else {
      nudge('这句话放在另一个人身上，好像更说得通？再换一副眼镜看看。');
    }
  },

  /* 3-2 线索排序 */
  'order-pick': (el) => {
    const i = Number(el.dataset.i);
    const slot = play.placed.length;
    if (i === slot) {
      play.placed.push(i); paintOrder();
      if (play.placed.length === play.v.steps.length) completeLevel(play.v.why || '顺序排好了。回头看，中间少的往往不是善意，只是一条还没送到的信息。');
      else showFeedback('gentle', '这一步放好了，接着找下一步。');
    } else {
      nudge('这张卡发生得好像更早或更晚一点。试试先找时间上最靠前的那张。');
    }
  },
  'order-undo': () => { if (play.placed.length) { play.placed.pop(); paintOrder(); } },

  /* 3-3 回应拼贴：允许坚持自己的句子 */
  'compose-pick': (el) => {
    const r = Number(el.dataset.row), i = Number(el.dataset.i);
    play.picks[r] = i;
    document.querySelectorAll(`.compose-row[data-row="${r}"] .word-chip`).forEach(b => b.classList.toggle('selected', Number(b.dataset.i) === i));
    const submit = document.getElementById('compose-submit');
    if (submit) submit.disabled = play.picks.some(p => p === null);
    const preview = document.getElementById('compose-preview'); if (preview) preview.innerHTML = '';
    const fb = document.getElementById('feedback-slot'); if (fb) fb.innerHTML = '';
  },
  'compose-submit': () => {
    if (play.picks.some(p => p === null)) return;
    const sentence = play.v.rows.map((r, ri) => r.choices[play.picks[ri]].t).join('，');
    const sharp = play.v.rows.some((r, ri) => !r.choices[play.picks[ri]].gentle);
    document.getElementById('compose-preview').innerHTML =
      `<div class="compose-preview"><span class="muted">拼出来的一句话</span><br>${esc(sentence)}</div>`;
    if (sharp) {
      showFeedback('gentle', `这句话里有一块听起来像在给对方下结论，听的人可能先竖起防线。<span class="tip">可以换一块试试；当然，你想说的本来就有道理，也可以就用这句。</span>`);
      const actions = document.getElementById('level-actions');
      if (actions) actions.innerHTML = `<button class="btn btn-secondary" data-action="compose-keep">就用这句，继续</button><button class="btn btn-ghost" data-action="go-map">先回地图</button>`;
    } else {
      completeLevel('这句话既说出了自己的感受，也给对方留了余地。说出来会怎样，可以在生活里试一试。');
    }
  },
  'compose-keep': () => completeLevel('你保留了原本的说法。怎么说、什么时候说，本来就该由你决定。'),

  /* 3-4 记忆翻牌 */
  'memo-flip': (el) => {
    if (play.lock || play.done) return;
    const i = Number(el.dataset.i);
    if (play.matched.has(i) || play.open.has(i)) return;
    play.open.add(i); paintMemory();
    if (play.first === null) { play.first = i; return; }
    const a = play.first, b = i;
    play.first = null;
    if (play.deck[a].pair === play.deck[b].pair && play.deck[a].side !== play.deck[b].side) {
      play.matched.add(a); play.matched.add(b); play.found += 1; paintMemory();
      if (play.found === play.v.pairs.length) completeLevel('都找到了。翻错多少次这里不记，只看你找到了几对。');
      else showFeedback('gentle', `找到第 ${play.found} 对了，继续。`);
    } else {
      play.lock = true;
      memoTimer = setTimeout(() => {
        play.open.delete(a); play.open.delete(b); play.lock = false; paintMemory();
      }, 850);
    }
  },

  /* 4-2 / A4-2 火气分级：选哪一档都算完成 */
  'rung-pick': (el) => {
    const i = Number(el.dataset.i);
    const r = (play.v.rungs || [])[i];
    if (!r) return;
    document.querySelectorAll('.rung').forEach((b, bi) => {
      b.classList.toggle('selected', bi === i);
      b.disabled = true;
    });
    el.classList.remove('selected');
    el.classList.add('selected');
    const box = document.getElementById('rung-result');
    if (box) box.innerHTML = `<div class="feedback good">
      <p><b>${esc(r.label)}</b>这一档，通常可以先做一件事：</p>
      <p class="result-main" style="margin:8px 0 0">${esc(r.move)}</p>
      <p class="muted" style="margin-top:8px">哪一档都不丢人。认出来，就比被它推着走多了一点余地。</p></div>`;
    completeLevel(`火在这一档，出口还在：${r.move}`);
  },

  /* 终章 */
  'decor-toggle': (el) => {
    const i = Number(el.dataset.i);
    if (!Array.isArray(state.decor)) state.decor = [];
    if (state.decor.includes(i)) state.decor = state.decor.filter(x => x !== i);
    else if (state.decor.length >= 3) { showFeedback('gentle', '小岛上最多摆 3 样，先收起一样再换吧。'); return; }
    else state.decor.push(i);
    save();
    document.querySelectorAll('.decor-slot').forEach((slot, s) => {
      const d = state.decor[s] !== undefined ? DECOR[state.decor[s]] : null;
      slot.classList.toggle('on', !!d);
      slot.querySelector('.decor-glyph').textContent = d ? d.g : '＋';
      slot.querySelector('.decor-name').textContent = d ? d.n : '空地';
    });
    document.querySelectorAll('.decor-picker .chip').forEach((b, bi) => b.classList.toggle('active', state.decor.includes(bi)));
  },
  'quote-pick': (el) => {
    const i = Number(el.dataset.i);
    document.querySelectorAll('#quote-picks .opt').forEach((b, bi) => b.classList.toggle('selected', bi === i));
    document.getElementById('finale-quote').innerHTML = `<div class="finale-quote">「${esc(play.quotes[i])}」</div>`;
  },
  'quote-reroll': () => {
    play.quotes = shuffled(QUOTES).slice(0, 3);
    document.getElementById('quote-picks').innerHTML = play.quotes.map((q, i) =>
      `<button class="opt" data-action="quote-pick" data-i="${i}" aria-keyshortcuts="${i + 1}"><span class="opt-key" aria-hidden="true">${i + 1}</span><span>${esc(q)}</span></button>`).join('');
    document.getElementById('finale-quote').innerHTML = '';
  },
  'micro-reroll': () => {
    play.acts = shuffled(MICRO_ACTIONS).slice(0, 2);
    document.getElementById('micro-list').innerHTML = play.acts.map(a => `<div class="micro-card">${esc(a)}</div>`).join('');
  },
  'talk-reroll': () => {
    play.talk = rand(TALK_CARDS);
    document.getElementById('talk-text').textContent = play.talk;
  }
};

/* ---------------------------------------------------------------- 事件绑定 */
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-backdrop')) { closeModal(); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  lastClicked = el;
  const fn = ACTIONS[el.dataset.action];
  if (fn) fn(el);
});
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'dict-search') {
    dictQuery = e.target.value;
    applyDictFilter();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (overlay.classList.contains('open')) { closeModal(); return; }
    if (viewCfg(session.view).esc === 'map') { ACTIONS['go-map'](); return; }
    if (viewCfg(session.view).esc === 'back') { ACTIONS['help-close'](); return; }
  }
  if (overlay.classList.contains('open')) {
    if (e.key === 'Tab') { trapTab(e); return; }
    /* 漂流瓶弹窗里的选项也有数字徽标，同样让 1–9 可用 */
    if (/^[1-9]$/.test(e.key)) {
      const target = document.querySelectorAll('#overlay .opt:not(:disabled)')[Number(e.key) - 1];
      if (target) { target.click(); e.preventDefault(); }
    }
    return;
  }
  if (e.target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable)) return;
  /* 数字键和徽标一致：.opt / 梯子档位的 1/2/3… 都能按；
     关卡里其余「一排按钮」题型（配对、拼词、天气、翻线索、分筐）也走同一套序号；
     急救页的 8 个词同样支持数字键。 */
  if (/^[1-9]$/.test(e.key)) {
    const n = Number(e.key) - 1;
    const opts = document.querySelectorAll('#stage .opt:not(:disabled)');
    const rungs = document.querySelectorAll('#stage .rung:not(:disabled)');
    const others = session.view === 'level'
      ? document.querySelectorAll('#stage .pair-item:not(:disabled), #stage .word-chip:not(:disabled), #stage .weather-btn:not(:disabled), #stage .chip:not(:disabled), #stage .clue-card:not(:disabled)')
      : session.view === 'help'
        ? document.querySelectorAll('#stage .help-word:not(:disabled)')
        : [];
    const target = [opts, rungs, others].find(g => g.length)?.[n];
    if (target) { target.click(); e.preventDefault(); }
    return;
  }
  if (session.view === 'level' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const d = e.key === 'ArrowLeft' ? -1 : 1;
    if (play.side) {
      const i = play.sideIndex + d;
      if (i >= 0 && i < WORK.length && sideUnlocked(i)) {
        session.navDir = d < 0 ? 'back' : 'forward';
        renderLevel(null, WORK[i], i);
        e.preventDefault();
      }
      return;
    }
    const i = state.levelIndex + d;
    if (i >= 0 && i < TOTAL && isUnlocked(i)) {
      session.navDir = d < 0 ? 'back' : 'forward';
      state.levelIndex = i; renderLevel(); e.preventDefault();
    }
  }
});

/* ---------------------------------------------------------------- 离线与安装 */
/* PWA 只在 http(s) 下注册。file:// 双击打开时没有可用的 Service Worker：
   这里直接跳过，页面照常完整可玩；注册失败也只影响「装到主屏」，不影响玩法。
   先等页面加载完再注册，避免和首屏渲染抢资源。 */
function registerOffline() {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    try {
      navigator.serviceWorker.register('sw.js')
        /* 主动检查更新：SW 本身带版本号，新版本 install 后立刻接管并清掉旧缓存 */
        .then((reg) => { try { reg.update(); } catch (e) { /* noop */ } })
        .catch(() => { /* 离线能力不是玩法的前提，失败不打扰用户 */ });
    } catch (e) { /* noop */ }
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/* ---------------------------------------------------------------- 启动 */
applySettings();
registerOffline();
/* 地址栏里带了 hash 就按它直达；没有则落到默认首屏，并由 syncHash 写入合法地址。
   hashchange 覆盖手动改地址、刷新后同页跳转，以及少数浏览器 replaceState 失败时的回落。 */
window.addEventListener('hashchange', () => routeTo(parseHash(location.hash)));
if (!CONTENT_OK) {
  stage.innerHTML = `<div class="view">
    <h2>内容没加载出来</h2>
    <p class="lead">content/ 下的数据文件没有读到。检查 index.html 里 content/*.js 的引入顺序：
    需要 bands → levels-kid → levels-kid-island4 → levels-adult → bank-* → bank-compose → levels-adult-work → library → dictionary → selfhelp → slowvars → help，最后才是 script.js。</p>
    <p class="muted">打开浏览器控制台可以看到具体是哪个文件 404。</p>
  </div>`;
} else {
  const initial = parseHash(location.hash);
  /* 没选档时 routeTo 自己会回落到选档页；正常有档则按地址 / 默认首页 */
  routeTo(initial);
  /* 空地址或非法地址在渲染时已被 syncHash 改写；这里再兜一次，确保首次进入地址合法 */
  if (!initial.view) syncHash();
}

