/* 心情闯关岛 v6.1.0 · 纯前端、零依赖、不联网
   五档：3-6 / 6-9 / 9-12 / 亲子全年龄 / 成年
   设计红线：情绪没有标准答案 / 不打分 / 不排名 / 不采集心情文本
   本地只保存：关卡进度、词卡、本领、贝壳、岛屿装饰、年龄段与显示设置 */

const SCHEMA_VERSION = 3;
const STORAGE_KEY = 'mood-island-v3';
const LEGACY_KEYS = ['mood-island-v2'];

/* ---------------------------------------------------------------- 数据来源
   内容全在 content/ 下：bands.js / levels-kid*.js / levels-adult.js /
   bank-*.js / library.js / dictionary.js / selfhelp.js / slowvars.js。这里是唯一入口；文件缺失时给出可读提示，不白屏。 */
const MI = window.MI || {};
const AGE_BANDS = MI.bands || [];
const KID = MI.kid || { track: 'kid', islands: [], levels: [] };
const ADULT = MI.adult || { track: 'adult', islands: [], levels: [] };
const BANK = MI.bankKid || {};
const BANK_ADULT = MI.bankAdult || {};
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
const CONTENT_OK = !!(AGE_BANDS.length && KID.levels.length && ADULT.levels.length);

/* 当前轨：儿童 / 亲子共用 kid 表，成年档走独立表。切档时 syncTrack() 重绑。 */
let TRACK = KID;
let LEVELS = KID.levels;
let TOTAL = LEVELS.length;
function syncTrack() {
  TRACK = state.band === 'adult' ? ADULT : KID;
  LEVELS = (TRACK && TRACK.levels) || [];
  TOTAL = LEVELS.length;
}
function islands() { return (TRACK && TRACK.islands) || []; }
function isAdultTrack() { return state.band === 'adult'; }

function band() { return AGE_BANDS.find(b => b.id === state.band) || AGE_BANDS[1] || AGE_BANDS[0] || {}; }

/* ---------------------------------------------------------------- 状态 */
const DEFAULT_STATE = {
  version: SCHEMA_VERSION,
  band: null, cleared: [], awarded: [], cards: [], skills: [], shells: 0, decor: [],
  settings: { scale: 1, motion: false, speak: true, speakTouched: false, autoSpeak: false, contrast: false }
};
let state = load();
let play = {};
let session = {
  clearedThisRun: 0, view: 'home', tip: '', navDir: '',
  mapScroll: 0, lastCleared: '', interrupted: false, retreatStep: -1
};
let lastVariant = {};
let dictCat = 'all';
let dictQuery = '';
let shState = null;
let shCat = 'all';
let svVar = null;
let svCat = 'all';
let breathTimer = null;
let memoTimer = null;
let lastFocus = null;
let lastClicked = null;

/* 存档：带 schema 版本。旧键（v2）读到后自动迁移，之后只写新键。
   加字段时在 migrate() 里补一段，老用户进度不会因为版本变更被清空。 */
function readRaw() {
  try {
    const cur = localStorage.getItem(STORAGE_KEY);
    if (cur) return cur;
    for (const k of LEGACY_KEYS) {
      const old = localStorage.getItem(k);
      if (old) return old;
    }
  } catch (e) { /* 隐私模式下不可读 */ }
  return null;
}

function load() {
  try {
    const raw = readRaw();
    if (!raw) return clone(DEFAULT_STATE);
    return migrate(JSON.parse(raw));
  } catch (e) { return clone(DEFAULT_STATE); }
}

/* 旧版终章 id 是 3-5，现在独立成 finale，老存档需要改一次名 */
const ID_REMAP = { '3-5': 'finale' };
const remapIds = arr => arr.map(id => ID_REMAP[id] || id);

function migrate(s) {
  if (!s || typeof s !== 'object') return clone(DEFAULT_STATE);
  const from = Number.isFinite(s.version) ? s.version : 2;
  /* v2 → v3：补 version 字段；v3 期间把 3-5 改为 finale，其余结构兼容 */
  if (from < 3) s.version = 3;
  return {
    version: SCHEMA_VERSION,
    band: AGE_BANDS.some(b => b.id === s.band) ? s.band : null,
    cleared: Array.isArray(s.cleared) ? remapIds(s.cleared) : [],
    awarded: Array.isArray(s.awarded) ? remapIds(s.awarded)
      : (Array.isArray(s.cleared) ? remapIds(s.cleared) : []),
    cards: Array.isArray(s.cards) ? s.cards : [],
    skills: Array.isArray(s.skills) ? s.skills : [],
    shells: Number.isFinite(s.shells) ? s.shells : 0,
    decor: Array.isArray(s.decor) ? s.decor : [],
    settings: {
      scale: s.settings?.scale || 1, motion: !!s.settings?.motion,
      speak: s.settings?.speak !== false, speakTouched: !!s.settings?.speakTouched,
      autoSpeak: !!s.settings?.autoSpeak, contrast: !!s.settings?.contrast
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

/* ---------------------------------------------------------------- 工具 */
const stage = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffled = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rand = arr => arr[Math.floor(Math.random() * arr.length)];
/* 打乱选项时保留原始下标，答案比对仍按原始下标走 */
const withIndex = arr => arr.map((v, i) => ({ v, i }));

function pickVariant(id) {
  const all = (BANK[id] || []).concat(BANK_ADULT[id] || []);
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
/* 选项按钮：i 是渲染位置（键盘数字键用），orig 是数据里的原始下标（判对错用） */
function optBtn(i, title, desc, action, orig) {
  const o = orig === undefined ? i : orig;
  return `<button class="opt" data-action="${action}" data-i="${i}" data-orig="${o}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span><span>${esc(title)}</span>${desc ? `<span class="opt-desc">${esc(desc)}</span>` : ''}</span></button>`;
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
/* 当前轨走过的站数（两轨进度存在同一个数组里，各算各的） */
function clearedInTrack() {
  return state.cleared.filter(id => LEVELS.some(l => l.id === id)).length;
}
function updateTopbar() {
  const shells = document.getElementById('shell-count');
  if (shells) {
    shells.hidden = isAdultTrack();
    shells.textContent = `贝壳 ${state.shells}`;
  }
  const bandEl = document.getElementById('topbar-band');
  if (bandEl) {
    bandEl.hidden = (session.view === 'gate' || !state.band);
    bandEl.textContent = state.band ? `${band().name} · ${band().tag}` : '';
  }
  document.getElementById('progress-wrap').hidden = (session.view === 'home' || session.view === 'gate' || session.view === 'retreat' || session.view === 'dict' || session.view === 'selfhelp' || session.view === 'slowvars');
  const track = document.getElementById('step-track');
  if (track) track.innerHTML = LEVELS.map((l, i) => {
    const done = state.cleared.includes(l.id);
    const cur = session.view === 'level' && state.levelIndex === i;
    const unlocked = isUnlocked(i);
    return `<button class="step ${done ? 'done' : ''} ${cur ? 'current' : ''}" data-action="open-level" data-i="${i}" ${unlocked ? '' : 'disabled'} title="${esc(l.id + ' · ' + l.name)}" aria-label="第 ${i + 1} 站 ${esc(l.name)}${done ? '，已走过' : ''}"></button>`;
  }).join('');
  const pt = document.getElementById('progress-text');
  if (pt) pt.textContent = (session.view === 'level' && LEVELS[state.levelIndex])
    ? `第 ${state.levelIndex + 1} / ${TOTAL} 站 · ${LEVELS[state.levelIndex].name}`
    : `已走过 ${clearedInTrack()} / ${TOTAL} 站`;
}
function viewClass() {
  return session.navDir === 'back' ? 'view enter-back'
    : session.navDir === 'forward' ? 'view enter-forward' : 'view';
}
function showFeedback(type, html) {
  const slot = document.getElementById('feedback-slot');
  if (slot) slot.innerHTML = `<div class="feedback ${type}">${html}</div>`;
}
function nudge(msg, el) {
  play.tries = (play.tries || 0) + 1;
  const lv = LEVELS[state.levelIndex] || LEVELS[0];
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
function renderAgeGate() {
  clearAsyncTimers();
  session.view = 'gate';
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
  const hasProgress = clearedInTrack() > 0;
  const islCount = islands().length;
  stage.innerHTML = `<div class="view home-hero">
    <div class="toolbar">${bandChip()}<button class="btn-read" data-action="goto-band">换年龄段</button></div>
    <span class="eyebrow">${islCount} 座岛 · ${TOTAL} 站 · 随时可以离开</span>
    <h2>不赶走情绪，先认出它</h2>
    <p class="lead">这是一座关于情绪的小岛。你要做的不是答对，而是把模糊的感觉看得更清楚一点，再带走一个用得上的小工具。</p>
    ${session.tip ? `<div class="notice">${esc(session.tip)}</div>` : ''}
    <div class="home-points">
      <div class="home-point"><span class="dot"></span><span><b>没有标准答案。</b>情绪不分好坏，这一趟不打分、不排名、不比谁快。</span></div>
      <div class="home-point"><span class="dot"></span><span><b>每一站换一种玩法。</b>拼线索、调刻度、排顺序、翻记忆，动脑也动手。</span></div>
      <div class="home-point"><span class="dot"></span><span><b>按 ${esc(b.name)} 出题。</b>${esc(b.desc)} ${esc(b.len)}。</span></div>
    </div>
    <div class="actions">
      <button class="btn btn-primary" data-action="start">${hasProgress ? '继续上岛' : '开始上岛'}</button>
      ${hasProgress ? '<button class="btn btn-secondary" data-action="restart-all">从头再来一轮</button>' : ''}
    </div>
    <p class="home-note">全程不联网、不填写心情文字；天气选择不会被保存。${isAdultTrack() ? '成年档有自己的一套站，和儿童档的进度分开记。' : '适合一个人玩，也适合大人和孩子一起聊。'}</p>
  </div>`;
  session.tip = '';
  updateTopbar();
}

/* ---------------------------------------------------------------- 视图：地图 */
function renderMap() {
  clearAsyncTimers();
  session.view = 'map';
  const list = islands();
  const trackCards = LEVELS.map(l => l.card).filter(Boolean);
  const trackSkills = LEVELS.map(l => l.skill).filter(Boolean);
  const gotCards = trackCards.filter(c => state.cards.includes(c)).length;
  const gotSkills = trackSkills.filter(s => state.skills.includes(s)).length;
  const interrupted = session.interrupted;
  session.interrupted = false;
  let html = `<div class="${viewClass()}">
    ${interrupted ? '<div class="notice">刚才的呼吸练习被打断了，不用补上。想做的时候随时可以重新开始。</div>' : ''}
    <div class="map-head"><div><span class="eyebrow">岛屿地图 · ${esc(band().name)}</span>
      <h2 style="margin-top:10px">想去哪站，就去哪站</h2>
      <p class="lead">同一座岛里的站可以随便进出，走过的还能再走，每次题目会换一批。</p></div>
      <span class="muted">词卡 ${gotCards} / ${trackCards.length}</span></div>
    <div class="toolbar">${bandChip()}<span class="muted">${esc(band().len)}</span>
      <button class="btn-read" data-action="goto-band">换年龄段</button></div>`;
  list.forEach(isl => {
    const items = LEVELS.filter(l => l.island === isl.n && l.type !== 'finale');
    html += `<section class="island" data-island="${isl.n}">
      <div class="island-head"><span class="island-name">岛 ${isl.n} · ${esc(isl.name)}</span><span class="island-theme">${esc(isl.theme)}</span></div>
      <div class="node-grid">`;
    items.forEach(l => {
      const idx = LEVELS.indexOf(l);
      const done = state.cleared.includes(l.id);
      const unlocked = isUnlocked(idx);
      html += `<button class="node ${done ? 'done' : ''} ${session.lastCleared === l.id ? 'just-done' : ''} ${unlocked ? '' : 'locked'}" data-action="open-level" data-i="${idx}" ${unlocked ? '' : 'disabled'} aria-label="${esc(l.name)}${unlocked ? '' : '，尚未解锁'}">
        ${done ? '<span class="node-check">✓</span>' : ''}
        <span class="node-id">${esc(l.id)}</span>
        <span class="node-name">${esc(l.name)}</span>
        <span class="node-type">${unlocked ? esc(l.kind) : '先把上一座岛走到头'}</span>
      </button>`;
    });
    html += `</div></section>`;
  });
  const fin = LEVELS[TOTAL - 1] || {};
  const finaleOpen = isUnlocked(TOTAL - 1);
  const finDesc = finaleOpen
    ? (isAdultTrack() ? '挑一句带走，看看这一程练过的，也可以什么都不挑。' : '布置小岛、看看这一轮练过的本领，带走一句话和一张可以一起聊的卡片。')
    : `走完前 ${TOTAL - 1} 站后开放。不用着急，一站一站来。`;
  html += `<div class="finale-entry"><div><h3>终章 · ${esc(fin.name || '小结')}</h3>
    <p>${finDesc}</p></div>
    <button class="btn ${finaleOpen ? 'btn-primary' : 'btn-secondary'}" data-action="open-level" data-i="${TOTAL - 1}" ${finaleOpen ? '' : 'disabled'}>${finaleOpen ? '去终章' : '还没开放'}</button></div>`;
  const mindful = !!band().mindful;
  html += `<div class="retreat-entry">
      <div><span class="eyebrow">另一条路 · 不计进度</span><h3 style="margin-top:8px">静修间</h3>
        <p>五感锚定、给想法松绑、三分钟呼吸空间。不计时、不打卡、不记录你做了几次，随时可以停。</p></div>
      <button class="btn ${mindful ? 'btn-primary' : 'btn-secondary'}" data-action="${mindful ? 'open-retreat' : 'goto-band'}">${mindful ? '进去坐坐' : '切换到成年档'}</button>
    </div>`;
  html += `<div class="map-tools">
      <button class="tool-btn" data-action="open-dictionary">心理学词典（${DICTIONARY.length}）</button>
      <button class="tool-btn" data-action="open-selfhelp">自助工具箱（心力 · 认知）</button>
      <button class="tool-btn" data-action="open-slowvars">慢变量（健康 · 三观 · 目的）</button>
      <button class="tool-btn" data-action="open-codex">词卡图鉴（${gotCards}/${trackCards.length}）</button>
      <button class="tool-btn" data-action="open-skills">本领清单（${gotSkills}/${trackSkills.length}）</button>
      <button class="tool-btn" data-action="open-bottle">今日漂流瓶 · 一题</button>
      <button class="tool-btn" data-action="open-settings">显示与数据</button>
    </div>
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

/* ---------------------------------------------------------------- 心理学词典
   纯科普，不计进度、不落盘；搜索只在当前页面内过滤，关掉就没了。 */
function renderDictionary() {
  clearAsyncTimers(); stopSpeech();
  session.view = 'dict'; session.navDir = 'forward';
  if (!DICTIONARY.length) {
    stage.innerHTML = `<div class="${viewClass()}">
      <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
      <h2>词典内容没有加载出来</h2>
      <p class="lead">检查 index.html 是否在 library.js 之后、script.js 之前引入 content/dictionary.js。打开浏览器控制台可以看到具体是哪个文件 404。</p>
    </div>`;
    updateTopbar();
    return;
  }
  const cats = [...new Set(DICTIONARY.map(d => d.c))];
  const catBtns = [{ c: 'all', name: '全部' }].concat(cats.map(c => ({ c, name: c })));
  const cards = DICTIONARY.map((d) => {
    const hay = [d.t, d.e, d.c, d.s, d.d, d.m || ''].join(' ').toLowerCase();
    return `<details class="dict-card" data-cat="${esc(d.c)}" data-search="${esc(hay)}">
      <summary>
        <span class="dict-term">${esc(d.t)}</span>
        <span class="dict-en">${esc(d.e)}</span>
        <span class="dict-short">${esc(d.s)}</span>
        <span class="dict-cat-badge">${esc(d.c)}</span>
      </summary>
      <div class="dict-detail">
        <p>${esc(d.d)}</p>
        ${d.m ? `<p class="dict-mis"><b>常见误解</b>${esc(d.m)}</p>` : ''}
      </div>
    </details>`;
  }).join('');
  stage.innerHTML = `<div class="${viewClass()}">
    <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
    <span class="eyebrow">心理学词典 · ${DICTIONARY.length} 条</span>
    <h2 style="margin:12px 0 10px">把常用的心理学词，说清楚一点</h2>
    <p class="lead">按主题收好 ${DICTIONARY.length} 个名词与概念。每张卡先给一句话，点开再看展开与常见误解。这里只做科普，不提供诊断或个体化建议。</p>
    <div class="dict-controls">
      <label class="dict-search" for="dict-search">
        <span class="visually-hidden">搜索词条</span>
        <input id="dict-search" type="search" autocomplete="off" aria-controls="dict-grid" aria-describedby="dict-count" placeholder="搜名词、英文或释义，例如：依恋" value="${esc(dictQuery)}">
      </label>
    </div>
    <div class="dict-cats" id="dict-cats" role="group" aria-label="按主题筛选">
      ${catBtns.map(x => `<button class="dict-cat ${dictCat === x.c ? 'on' : ''}" data-action="dict-cat" data-c="${esc(x.c)}">${esc(x.name)}</button>`).join('')}
    </div>
    <p class="dict-count muted" id="dict-count" aria-live="polite">${DICTIONARY.length} 条 · 点卡片展开释义</p>
    <div class="dict-grid" id="dict-grid">${cards}</div>
    <p class="dict-empty" id="dict-empty" hidden>没有匹配的词条。换个关键词，或点「全部」看看。</p>
    <p class="home-note">词条按成人阅读深度编写；和孩子一起看时，挑他问到的那个就好。有争议的地方会写明边界，不把“研究平均”说成“对每个人都适用”。搜索只在当前页面内过滤，不会保存，也不会上传。</p>
  </div>`;
  updateTopbar();
  applyDictFilter();
  stage.focus({ preventScroll: true });
}

function applyDictFilter() {
  const q = dictQuery.trim().toLowerCase();
  let n = 0;
  document.querySelectorAll('#dict-grid .dict-card').forEach((card) => {
    const catOk = dictCat === 'all' || card.dataset.cat === dictCat;
    const qOk = !q || (card.dataset.search || '').includes(q);
    const show = catOk && qOk;
    card.hidden = !show;
    if (show) n += 1;
  });
  const count = document.getElementById('dict-count');
  if (count) {
    count.textContent = (q || dictCat !== 'all')
      ? `筛出 ${n} / ${DICTIONARY.length} 条`
      : `${DICTIONARY.length} 条 · 点卡片展开释义`;
  }
  const empty = document.getElementById('dict-empty');
  if (empty) empty.hidden = n !== 0;
}

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

function renderSelfHelp() {
  clearAsyncTimers(); stopSpeech();
  session.view = 'selfhelp'; session.navDir = 'forward';
  if (!SH_TOOLS.length) {
    stage.innerHTML = `<div class="${viewClass()}">
      <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
      <h2>自助内容没有加载出来</h2>
      <p class="lead">检查 index.html 是否在 dictionary.js 之后、script.js 之前引入 content/selfhelp.js。打开浏览器控制台可以看到具体是哪个文件 404。</p>
    </div>`;
    updateTopbar();
    return;
  }
  const cats = [...new Set(SH_TOOLS.map(t => t.c))];
  const catBtns = [{ c: 'all', name: '全部' }].concat(cats.map(c => ({ c, name: c })));
  const cards = SH_TOOLS.map((t) => `<details class="dict-card sh-card" data-cat="${esc(t.c)}">
    <summary>
      <span class="dict-term">${esc(t.t)}</span>
      <span class="dict-en">${esc(t.e)}</span>
      <span class="dict-short">${esc(t.when)}</span>
      <span class="dict-cat-badge">${esc(t.c)}</span>
    </summary>
    <div class="dict-detail">
      <div class="sh-how"><b>怎么做</b><ol>${t.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
      <p class="dict-mis"><b>提醒</b>${esc(t.note)}</p>
    </div>
  </details>`).join('');
  stage.innerHTML = `<div class="${viewClass()}">
    <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
    <span class="eyebrow">自助工具箱 · 心力与认知</span>
    <h2 style="margin:12px 0 10px">先恢复一点力气，再换一个看法</h2>
    <p class="lead">${SH_STATES.length} 种“现在最像”的状态、${SH_TOOLS.length} 张工具卡、${SH_DISTORTIONS.length} 条认知扭曲速查。全部是选择式或阅读式，不填心情文字，也不记录你选了什么。</p>
    <div class="retreat-safety">${esc(SH_SAFETY)}</div>
    <section class="sh-section">
      <h3 class="sh-section-title">现在最像哪一种？</h3>
      <p class="muted sh-section-sub">不用选得很准，挑一个最接近的就好。选完只看这一组建议，不做测试，也不打分。</p>
      <div class="sh-states" id="sh-states">
        ${SH_STATES.map(s => `<button class="sh-state ${shState === s.id ? 'on' : ''}" data-action="sh-state" data-id="${esc(s.id)}">
          <b>${esc(s.name)}</b><span>${esc(s.sub)}</span></button>`).join('')}
      </div>
      <div id="sh-state-panel">${shState ? shStatePanel(shState) : '<p class="sh-hint">选一个状态，这里会出现三件可以先做的小事。</p>'}</div>
    </section>
    <section class="sh-section">
      <h3 class="sh-section-title">工具卡</h3>
      <p class="muted sh-section-sub">按主题筛，点开看“怎么做”和“提醒”。</p>
      <div class="sh-cats" id="sh-cats" role="group" aria-label="按主题筛选自助工具">
        ${catBtns.map(x => `<button class="dict-cat ${shCat === x.c ? 'on' : ''}" data-action="sh-cat" data-c="${esc(x.c)}">${esc(x.name)}</button>`).join('')}
      </div>
      <p class="dict-count muted" id="sh-count" aria-live="polite">${SH_TOOLS.length} 张 · 点卡片展开</p>
      <div class="dict-grid sh-grid" id="sh-grid">${cards}</div>
      <p class="dict-empty" id="sh-empty" hidden>这一类暂时没有卡片。点「全部」看看。</p>
    </section>
    <section class="sh-section">
      <h3 class="sh-section-title">认知扭曲速查</h3>
      <p class="muted sh-section-sub">给想法起个名字，通常能让人和它拉开一点距离。标签是为了松绑，不是给自己扣帽子。</p>
      <div class="sh-dist-grid">${SH_DISTORTIONS.map(d => `<div class="sh-dist">
        <b>${esc(d.t)}</b><span>${esc(d.d)}</span><em>${esc(d.eg)}</em></div>`).join('')}</div>
    </section>
    <p class="home-note">自助适合日常调节，不替代专业帮助。如果困扰持续数周、明显影响生活，或出现伤害自己的念头，请尽快联系专业人士或当地急救。选择和搜索都不会被保存。</p>
  </div>`;
  updateTopbar();
  applyShFilter();
  stage.focus({ preventScroll: true });
}

function applyShFilter() {
  let n = 0;
  document.querySelectorAll('#sh-grid .sh-card').forEach((card) => {
    const show = shCat === 'all' || card.dataset.cat === shCat;
    card.hidden = !show;
    if (show) n += 1;
  });
  const count = document.getElementById('sh-count');
  if (count) {
    count.textContent = shCat !== 'all'
      ? `筛出 ${n} / ${SH_TOOLS.length} 张`
      : `${SH_TOOLS.length} 张 · 点卡片展开`;
  }
  const empty = document.getElementById('sh-empty');
  if (empty) empty.hidden = n !== 0;
}

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
  </div>`;
}

function renderSlowVars() {
  clearAsyncTimers(); stopSpeech();
  session.view = 'slowvars'; session.navDir = 'forward';
  if (!SV_VARS.length || !SV_PRACTICES.length) {
    stage.innerHTML = `<div class="${viewClass()}">
      <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
      <h2>慢变量内容没有加载出来</h2>
      <p class="lead">检查 index.html 是否在 selfhelp.js 之后、script.js 之前引入 content/slowvars.js。打开浏览器控制台可以看到具体是哪个文件 404。</p>
    </div>`;
    updateTopbar();
    return;
  }
  const cats = [...new Set(SV_PRACTICES.map(p => p.c))];
  const catBtns = [{ c: 'all', name: '全部' }].concat(cats.map(c => ({ c, name: c })));
  const cards = SV_PRACTICES.map((p) => `<details class="dict-card sv-card" data-cat="${esc(p.c)}">
    <summary>
      <span class="dict-term">${esc(p.t)}</span>
      <span class="dict-en">${esc(p.e)}</span>
      <span class="dict-short">${esc(p.when)}</span>
      <span class="dict-cat-badge">${esc(p.c)}</span>
    </summary>
    <div class="dict-detail">
      <div class="sh-how"><b>怎么做</b><ol>${p.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
      <p class="dict-mis"><b>提醒</b>${esc(p.note)}</p>
    </div>
  </details>`).join('');
  stage.innerHTML = `<div class="${viewClass()}">
    <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
    <span class="eyebrow">慢变量 · 在快时代里养底盘</span>
    <h2 style="margin:12px 0 10px">有些东西，值得慢慢养</h2>
    <p class="lead">${SV_VARS.length} 个慢变量、${SV_PRACTICES.length} 张练习卡、${SV_TRAPS.length} 个快变量陷阱、${SV_HORIZONS.length} 个时间尺度。没有打卡，也不问你做到了多少。</p>
    <div class="retreat-safety">${esc(SV_SAFETY)}</div>
    <section class="sv-section">
      <h3 class="sv-section-title">你现在最想稳住哪一块？</h3>
      <p class="muted sv-section-sub">不用选得很准；选一个最接近的，看看它为什么慢、可以先做什么。</p>
      <div class="sv-vars" id="sv-vars">
        ${SV_VARS.map(v => `<button class="sv-var ${svVar === v.id ? 'on' : ''}" data-action="sv-var" data-id="${esc(v.id)}">
          <b>${esc(v.name)}</b><span>${esc(v.sub)}</span></button>`).join('')}
      </div>
      <div id="sv-panel">${svVar ? svPanel(svVar) : '<p class="sv-hint">选一个慢变量，这里会出现它的长期逻辑和一个可以开始的小动作。</p>'}</div>
    </section>
    <section class="sv-section">
      <h3 class="sv-section-title">慢变量练习卡</h3>
      <p class="muted sv-section-sub">按主题筛，点开看“怎么做”和“提醒”。不用全做，挑一张顺眼的就好。</p>
      <div class="sv-cats" id="sv-cats" role="group" aria-label="按主题筛选慢变量练习">
        ${catBtns.map(x => `<button class="dict-cat ${svCat === x.c ? 'on' : ''}" data-action="sv-cat" data-c="${esc(x.c)}">${esc(x.name)}</button>`).join('')}
      </div>
      <p class="dict-count muted" id="sv-count" aria-live="polite">${SV_PRACTICES.length} 张 · 点卡片展开</p>
      <div class="dict-grid sv-grid" id="sv-grid">${cards}</div>
      <p class="dict-empty" id="sv-empty" hidden>这一类暂时没有卡片。点「全部」看看。</p>
    </section>
    <section class="sv-section">
      <h3 class="sv-section-title">三个时间尺度</h3>
      <p class="muted sv-section-sub">同一个问题，放在不同长度里看，答案会不一样。</p>
      <div class="sv-horizons">${SV_HORIZONS.map(h => `<div class="sv-horizon">
        <b>${esc(h.t)}</b><p>${esc(h.d)}</p>
        <ul>${h.asks.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>`).join('')}</div>
    </section>
    <section class="sv-section">
      <h3 class="sv-section-title">快变量陷阱速查</h3>
      <p class="muted sv-section-sub">不是要你消灭快变量，而是别让它们替你决定长期方向。</p>
      <div class="sv-traps">${SV_TRAPS.map(t => `<div class="sv-trap">
        <b>${esc(t.t)}</b><span>${esc(t.d)}</span><em>${esc(t.eg)}</em></div>`).join('')}</div>
    </section>
    <p class="home-note">慢变量不是另一套 KPI，也不是要求你立刻改变生活。选中的慢变量和分类只留在当前页面，不会被保存。身体或情绪上的持续不适，请找医生或专业支持。</p>
  </div>`;
  updateTopbar();
  applySvFilter();
  stage.focus({ preventScroll: true });
}

function applySvFilter() {
  let n = 0;
  document.querySelectorAll('#sv-grid .sv-card').forEach((card) => {
    const show = svCat === 'all' || card.dataset.cat === svCat;
    card.hidden = !show;
    if (show) n += 1;
  });
  const count = document.getElementById('sv-count');
  if (count) {
    count.textContent = svCat !== 'all'
      ? `筛出 ${n} / ${SV_PRACTICES.length} 张`
      : `${SV_PRACTICES.length} 张 · 点卡片展开`;
  }
  const empty = document.getElementById('sv-empty');
  if (empty) empty.hidden = n !== 0;
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
    const opts = shuffled(withIndex(v.options));
    return `${scenarioBox('脑子里自动冒出来的那句话', v.thought)}
      <p class="prompt">下面几个镜头里，哪一个更贴近事实、也更留得住原本的感受？</p>
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
      <div class="memo-progress" id="memo-progress">已找到 0 / ${v.pairs.length} 对</div>
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
        `<button class="opt" data-action="quote-pick" data-i="${i}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${esc(q)}</span></button>`).join('')}</div>
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

function renderLevel() {
  clearAsyncTimers(); stopSpeech();
  session.view = 'level';
  const lv = LEVELS[state.levelIndex];
  const v = lv.type === 'finale' ? {} : pickVariant(lv.id);
  play = makePlay(lv, v);
  const b = band();
  const speakBtns = (state.settings.speak && lv.type !== 'finale')
    ? `<button class="btn-read" data-action="speak-question" aria-label="朗读题目">🔊 读题目</button><button class="btn-read" data-action="speak-options" aria-label="朗读选项">🔊 读选项</button>` : '';
  stage.innerHTML = `<div class="${viewClass()}">
    <div class="toolbar">${bandChip(`<span class="muted">${lv.type === 'finale' ? '终章' : `岛 ${lv.island} · 第 ${lv.num} 站`}</span>`)}
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
    return `<button class="memo-card ${matched ? 'matched' : open ? 'open' : ''}" data-action="memo-flip" data-i="${i}" ${matched ? 'disabled' : ''}>${open ? esc(c.text) : '背面'}</button>`;
  }).join('');
}

/* ---------------------------------------------------------------- 通关 */
function completeLevel(msg) {
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
  const lv = LEVELS[state.levelIndex];
  if (!state.cleared.includes(lv.id)) state.cleared.push(lv.id);
  if (!state.awarded.includes(lv.id)) {
    state.awarded.push(lv.id);
    if (!isAdultTrack()) state.shells += 2;   /* 贝壳是儿童档的货币，成年档不发 */
  }
  if (lv.card && !state.cards.includes(lv.card)) state.cards.push(lv.card);
  if (lv.skill && !state.skills.includes(lv.skill)) state.skills.push(lv.skill);
  save();
  updateTopbar();
  const micro = ['1-4', '2-4', '3-4'].includes(lv.id)
    ? `<div class="micro-card" style="margin-top:12px">今日微行动：${esc(rand(MICRO_ACTIONS))}</div>` : '';
  const next = state.levelIndex + 1;
  const canNext = next < TOTAL && isUnlocked(next);
  const buttons = `${canNext ? `<button class="btn btn-primary" data-action="next-level">去下一站 · ${esc(LEVELS[next].name)}</button>` : ''}
      <button class="btn btn-secondary" data-action="go-map">回到地图</button>
      <button class="btn btn-ghost" data-action="reroll">这站再玩一次</button>`;
  const slot = document.getElementById('feedback-slot');
  if (slot) {
    slot.innerHTML = `<div class="feedback good result-card">
      <div class="result-kicker">这一站，带走了什么</div>
      <p class="result-main">${msg}</p>
      <div class="result-rows">
        <div class="result-row"><b>小贴士</b><span>${esc(lv.tip)}</span></div>
        ${lv.tryIt ? `<div class="result-row"><b>生活里试试</b><span>${esc(lv.tryIt)}</span></div>` : ''}
        <div class="result-row"><b>收进图鉴</b><span>${esc(lv.card || '这一站')}　·　本领：${esc(lv.skill || '这一站')}</span></div>
      </div>
      ${micro}
      <div class="result-actions">${buttons}</div>
    </div>`;
    try { slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
  }
  const actions = document.getElementById('level-actions');
  if (actions) actions.innerHTML = '';
  session.lastCleared = lv.id;
  session.clearedThisRun += 1;
  if (session.clearedThisRun % band().rest === 0) setTimeout(openRest, 900);
}

/* ---------------------------------------------------------------- 弹窗 */
function openModal(html) {
  lastFocus = document.activeElement;
  const title = (html.match(/class="modal-title"[^>]*>([^<]+)</) || [])[1] || '对话框';
  overlay.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">${html}</div></div>`;
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
      </div><p class="muted" style="margin-top:8px">朗读用的是设备自带语音，不需要联网。部分浏览器要求先点一下页面才允许自动朗读，点「读题目」总是有效的。</p></div>
      <div class="setting-row"><strong>动效与对比</strong><div class="seg">
        <button class="${!s.motion ? 'on' : ''}" data-action="toggle-flag" data-k="motion" data-v="0">保留轻微动效</button>
        <button class="${s.motion ? 'on' : ''}" data-action="toggle-flag" data-k="motion" data-v="1">尽量减少动画</button>
        <button class="${s.contrast ? 'on' : ''}" data-action="toggle-flag" data-k="contrast" data-v="${s.contrast ? 0 : 1}">高对比</button>
      </div><p class="muted" style="margin-top:8px">系统设置了「减少动态效果」时，本游戏会自动遵守。</p></div>
      <div class="setting-row"><strong>这里存了什么</strong>
        <p>只存「年龄段、走到哪一站、词卡、本领、贝壳、小岛摆设、显示设置」，全部留在这台设备的浏览器里，不上传、不联网。</p>
        <p><b>不会保存</b>：开场选的天气、任何输入的心情文字（本游戏也不提供文字输入框）。</p>
        ${storageWritable ? '' : '<p class="muted"><b>当前浏览器无法保存数据</b>：这一趟仍能继续玩，但关掉页面后进度不会留下来。换普通窗口打开即可正常保存。</p>'}</div>
    </div>
    <div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">完成</button>
      <button class="btn btn-ghost" data-action="clear-progress">清空本机进度</button></div>`);
}
function openCodex() {
  /* 图鉴按当前轨展示：成年档有自己的一套卡片，不和儿童档混在一起 */
  const keys = LEVELS.map(l => l.card).filter(Boolean);
  const got = keys.filter(k => state.cards.includes(k)).length;
  openModal(`<div class="modal-title">词卡图鉴 · ${got} / ${keys.length}</div>
    <div class="modal-body">每张卡都是从一站里带回来的小工具。没有集齐压力，也没有隐藏奖励。</div>
    <div class="codex-grid">${keys.map(k => {
      const has = state.cards.includes(k);
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
    session.navDir = 'forward'; closeModal(); renderLevel();
  },
  'next-level': () => { state.levelIndex += 1; session.navDir = 'forward'; renderLevel(); },
  'reroll': () => { session.navDir = 'forward'; renderLevel(); showFeedback('gentle', '换了一道题，进度还留着。慢慢来。'); },
  'goto-band': () => { stopSpeech(); session.navDir = ''; renderAgeGate(); },
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
    /* 只重置当前轨，另一条轨的进度不动 */
    const mine = new Set(LEVELS.map(l => l.id));
    state.cleared = state.cleared.filter(id => !mine.has(id));
    session.clearedThisRun = 0; lastVariant = {}; save();
    session.tip = '新的一轮，题目换了一批；词卡和本领都还留着。';
    renderMap();
  },
  'open-settings': () => openSettings(),
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
    state = clone(DEFAULT_STATE); state.band = keep.band; state.settings = keep.settings;
    save(); session.clearedThisRun = 0; closeModal(); renderHome();
  },
  'open-codex': () => openCodex(),
  'open-dictionary': () => { session.navDir = 'forward'; renderDictionary(); },
  'dict-cat': (el) => {
    dictCat = el.dataset.c || 'all';
    document.querySelectorAll('#dict-cats .dict-cat').forEach(b => b.classList.toggle('on', b.dataset.c === dictCat));
    applyDictFilter();
  },
  'open-selfhelp': () => { session.navDir = 'forward'; renderSelfHelp(); },
  'sh-state': (el) => {
    shState = el.dataset.id || null;
    document.querySelectorAll('#sh-states .sh-state').forEach(b => b.classList.toggle('on', b.dataset.id === shState));
    const panel = document.getElementById('sh-state-panel');
    if (panel) panel.innerHTML = shStatePanel(shState);
  },
  'sh-state-clear': () => {
    shState = null;
    document.querySelectorAll('#sh-states .sh-state').forEach(b => b.classList.remove('on'));
    const panel = document.getElementById('sh-state-panel');
    if (panel) panel.innerHTML = '<p class="sh-hint">选一个状态，这里会出现三件可以先做的小事。</p>';
  },
  'sh-cat': (el) => {
    shCat = el.dataset.c || 'all';
    document.querySelectorAll('#sh-cats .dict-cat').forEach(b => b.classList.toggle('on', b.dataset.c === shCat));
    applyShFilter();
  },
  'open-slowvars': () => { session.navDir = 'forward'; renderSlowVars(); },
  'sv-var': (el) => {
    svVar = el.dataset.id || null;
    document.querySelectorAll('#sv-vars .sv-var').forEach(b => b.classList.toggle('on', b.dataset.id === svVar));
    const panel = document.getElementById('sv-panel');
    if (panel) panel.innerHTML = svPanel(svVar);
  },
  'sv-var-clear': () => {
    svVar = null;
    document.querySelectorAll('#sv-vars .sv-var').forEach(b => b.classList.remove('on'));
    const panel = document.getElementById('sv-panel');
    if (panel) panel.innerHTML = '<p class="sv-hint">选一个慢变量，这里会出现它的长期逻辑和一个可以开始的小动作。</p>';
  },
  'sv-cat': (el) => {
    svCat = el.dataset.c || 'all';
    document.querySelectorAll('#sv-cats .dict-cat').forEach(b => b.classList.toggle('on', b.dataset.c === svCat));
    applySvFilter();
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
      completeLevel(`${esc(play.v.why)}<span class="tip">你翻开了 ${play.flipped.size} / ${play.v.clues.length} 张线索。</span>`);
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
    completeLevel(msg);
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
      completeLevel(esc(play.v.why));
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
      if (play.placed.length === play.v.steps.length) completeLevel(play.v.why ? esc(play.v.why) : '顺序排好了。回头看，中间少的往往不是善意，只是一条还没送到的信息。');
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
    completeLevel(`火在这一档，出口还在：${esc(r.move)}`);
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
      `<button class="opt" data-action="quote-pick" data-i="${i}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${esc(q)}</span></button>`).join('');
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
    if (session.view === 'level' || session.view === 'retreat' || session.view === 'dict' || session.view === 'selfhelp' || session.view === 'slowvars') { ACTIONS['go-map'](); return; }
  }
  if (overlay.classList.contains('open')) {
    if (e.key === 'Tab') trapTab(e);
    return;
  }
  if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (session.view === 'level' && /^[1-9]$/.test(e.key)) {
    const opts = document.querySelectorAll('#stage .opt:not(:disabled)');
    const target = opts[Number(e.key) - 1];
    if (target) { target.click(); e.preventDefault(); }
    return;
  }
  if (session.view === 'level' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const d = e.key === 'ArrowLeft' ? -1 : 1;
    const i = state.levelIndex + d;
    if (i >= 0 && i < TOTAL && isUnlocked(i)) {
      session.navDir = d < 0 ? 'back' : 'forward';
      state.levelIndex = i; renderLevel(); e.preventDefault();
    }
  }
});

/* ---------------------------------------------------------------- 启动 */
applySettings();
if (!CONTENT_OK) {
  stage.innerHTML = `<div class="view">
    <h2>内容没加载出来</h2>
    <p class="lead">content/ 下的数据文件没有读到。检查 index.html 里 content/*.js 的引入顺序：
    需要 bands → levels-kid → levels-kid-island4 → levels-adult → bank-* → library → dictionary → selfhelp → slowvars，最后才是 script.js。</p>
    <p class="muted">打开浏览器控制台可以看到具体是哪个文件 404。</p>
  </div>`;
} else if (!state.band) renderAgeGate();
else renderHome();

