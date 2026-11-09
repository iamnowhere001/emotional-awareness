/* js/util.js · 纯工具：DOM 引用、转义与洗牌、拼装选道、微型渲染件、设置应用。
   经典脚本顺序加载，与 js/core.js 共享全局词法作用域；不要在此重复声明已有的顶层名字。 */

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
/* 夜间使用：只随系统深浅色切一层 CSS 变量，不新增存档字段、不发请求。
   高对比模式由 CSS 自己优先，不让两套覆盖打架。 */
function applyColorScheme() {
  if (!window.matchMedia) return;
  document.documentElement.dataset.theme =
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applySettings() {
  syncTrack();
  const b = band();
  document.documentElement.style.setProperty('--scale', String(state.settings.scale || b.scale || 1));
  document.documentElement.classList.toggle('reduce-motion', !!state.settings.motion);
  document.documentElement.classList.toggle('high-contrast', !!state.settings.contrast);
  document.documentElement.dataset.band = state.band || 'a6';
  applyColorScheme();
}
