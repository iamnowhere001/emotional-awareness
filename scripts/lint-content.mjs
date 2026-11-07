#!/usr/bin/env node
/* 内容自检：node scripts/lint-content.mjs
   用 vm 把 content/*.js 按 index.html 的顺序跑一遍（它们只往 window.MI 上挂数据），
   不引依赖、不启动浏览器。每次加题、加岛、改关卡表后跑一遍。 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const FILES = [
  'bands',
  'levels-kid',
  'levels-kid-island4',
  'levels-adult',
  'bank-kid-1-3',
  'bank-kid-island4',
  'bank-adult-1-3',
  'bank-adult-island4',
  'library',
  'dictionary',
  'selfhelp',
  'slowvars'
];

/* 让 sandbox 自己当 window：content 里写的是 window.MI = ... 之后又用裸 MI，
   只有「全局对象就是 window」时才成立，和浏览器一致。 */
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const name of FILES) {
  const code = readFileSync(`${root}/content/${name}.js`, 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: `content/${name}.js` });
  } catch (err) {
    console.error(`✗ content/${name}.js 执行失败：${err.message}`);
    process.exit(2);
  }
}

const MI = sandbox.window.MI || {};
const { bands: BANDS = [], kid: KID = {}, adult: ADULT = {}, bankKid = {}, bankAdult = {}, library: LIB = {} } = MI;
const CODEX = LIB.CODEX || {};
const DICT = MI.dictionary || [];
const SH = MI.selfhelp || {};
const SLOW = MI.slowvars || {};

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const TYPES = ['weather', 'clue', 'slider', 'match', 'breath', 'reframe', 'chain', 'sort', 'perspective', 'order', 'compose', 'memory', 'ladder', 'finale'];
const NEED = {
  weather: ['items'],
  clue: ['scenario', 'clues', 'options', 'answer', 'why'],
  slider: ['scenario', 'question', 'replies'],
  match: ['pairs', 'words'],
  breath: ['rounds', 'note'],
  reframe: ['thought', 'options', 'answer', 'why'],
  chain: ['scenario', 'tags', 'cards'],
  sort: ['baskets', 'cards'],
  perspective: ['scenario', 'roles'],
  order: ['scenario', 'steps'],
  compose: ['scenario', 'rows'],
  memory: ['pairs'],
  ladder: ['scenario', 'question', 'rungs']
};
const MIN_VARIANTS = 2;

/* ---------- 每一条轨 ---------- */
const TRACKS = [
  { key: 'kid', name: '儿童 / 亲子', data: KID, bank: bankKid, bands: BANDS.filter(b => b.track !== 'adult') },
  { key: 'adult', name: '成年', data: ADULT, bank: bankAdult, bands: BANDS.filter(b => b.track === 'adult') }
];

const seenCards = new Set();

TRACKS.forEach((tr) => {
  const levels = tr.data.levels || [];
  const isl = tr.data.islands || [];

  if (!levels.length) { err(`${tr.name}：没有关卡`); return; }
  if (!isl.length) err(`${tr.name}：没有岛屿定义`);

  /* 关卡结构 */
  const ids = new Set();
  let finaleAt = -1;
  levels.forEach((l, i) => {
    const tag = `${tr.name} ${l.id || '(无 id)'}`;
    if (!l.id) err(`${tag}: 缺 id`);
    if (ids.has(l.id)) err(`${tag}: id 重复`);
    ids.add(l.id);
    if (!TYPES.includes(l.type)) err(`${tag}: 未知 type「${l.type}」`);
    ['island', 'num', 'name', 'kind', 'goal', 'tip'].forEach((k) => {
      if (l[k] === undefined || l[k] === '') err(`${tag}: 缺字段 ${k}`);
    });
    if (l.type === 'finale') {
      if (finaleAt >= 0) err(`${tag}: 出现第二个终章`);
      finaleAt = i;
    } else {
      if (!l.card) err(`${tag}: 缺 card`);
      if (!l.skill) err(`${tag}: 缺 skill`);
    }
  });
  if (finaleAt !== levels.length - 1) err(`${tr.name}：终章必须正好是最后一站`);

  /* 岛屿与关卡对应 */
  isl.forEach((s) => {
    const n = levels.filter(l => l.island === s.n && l.type !== 'finale').length;
    if (!n) err(`${tr.name} 岛 ${s.n}「${s.name}」没有任何关卡`);
    if (s.n > isl.length) err(`${tr.name} 岛 ${s.n}: 编号超过岛的个数`);
  });
  const strayIslands = [...new Set(levels.filter(l => l.type !== 'finale').map(l => l.island))]
    .filter(n => !isl.some(s => s.n === n));
  if (strayIslands.length) err(`${tr.name}: 关卡用了未定义的岛 ${strayIslands.join(',')}`);

  /* 词卡 / 本领唯一 + 释义齐全 */
  const cards = levels.map(l => l.card).filter(Boolean);
  const skills = levels.map(l => l.skill).filter(Boolean);
  cards.forEach((c) => {
    if (cards.filter(x => x === c).length > 1) err(`${tr.name}: 词卡「${c}」被多关共用`);
    if (!CODEX[c]) err(`${tr.name}: 词卡「${c}」在 CODEX 里没有释义`);
    seenCards.add(c);
  });
  skills.forEach((s) => {
    if (skills.filter(x => x === s).length > 1) err(`${tr.name}: 本领「${s}」被多关共用`);
  });

  /* 题库覆盖 */
  const bodyIds = levels.filter(l => l.type !== 'finale').map(l => l.id);
  Object.keys(tr.bank).forEach((k) => {
    if (!bodyIds.includes(k)) warn(`${tr.name} 题库里的「${k}」没有对应关卡，永远不会被抽到`);
  });
  bodyIds.forEach((id) => {
    const pool = tr.bank[id] || [];
    if (!pool.length) { err(`${tr.name} ${id}: 没有题库`); return; }
    tr.bands.forEach((b) => {
      const n = pool.filter(v => (v.b || []).includes(b.id)).length;
      if (n < MIN_VARIANTS) err(`${tr.name} ${id}: ${b.id} 档只有 ${n} 组（要求 ≥${MIN_VARIANTS}）`);
    });
    const lv = levels.find(l => l.id === id);
    pool.forEach((v, i) => {
      const tag = `${tr.name} ${id}#${i}(${(v.b || []).join('/') || '未标档'})`;
      if (!v.b || !v.b.length) err(`${tag}: 缺 b 档位标记`);
      (v.b || []).forEach((b) => {
        if (!BANDS.some(x => x.id === b)) err(`${tag}: 未知档位「${b}」`);
      });
      (NEED[lv.type] || []).forEach((k) => {
        if (v[k] === undefined) err(`${tag}: 缺字段 ${k}`);
      });
      if (v.answer !== undefined) {
        const n = Array.isArray(v.options) ? v.options.length : 0;
        if (!Number.isInteger(v.answer) || v.answer < 0 || v.answer >= n) err(`${tag}: answer 越界（选项 ${n} 个）`);
      }
    });
  });
});

/* ---------- 题型内部一致性 ---------- */
const allBanks = [['儿童', bankKid], ['成年', bankAdult]];
allBanks.forEach(([label, bank]) => Object.entries(bank).forEach(([id, arr]) => arr.forEach((v, i) => {
  const tag = `${label} ${id}#${i}`;

  if (v.tags && v.cards) {
    if (v.cards.length !== v.tags.length) err(`${tag}: 卡片 ${v.cards.length} 张 ≠ 格子 ${v.tags.length} 个`);
    if (new Set(v.tags).size !== v.tags.length) err(`${tag}: tags 有重复`);
    v.cards.forEach(c => { if (!v.tags.includes(c.tag)) err(`${tag}: 卡片标签「${c.tag}」不在 tags 里`); });
    v.tags.forEach(t => { if (!v.cards.some(c => c.tag === t)) err(`${tag}: 格子「${t}」没有对应卡片`); });
  }

  if (v.baskets && v.cards) {
    v.cards.forEach(c => {
      if (!(c.to >= 0 && c.to < v.baskets.length)) err(`${tag}: 卡片 to=${c.to} 越界`);
    });
    v.baskets.forEach((_, bi) => {
      if (!v.cards.some(c => c.to === bi)) warn(`${tag}: 「${v.baskets[bi]}」这个筐没有卡片会进去`);
    });
  }

  if (v.rungs) {
    if (v.rungs.length < 2) err(`${tag}: 分级至少两档`);
    v.rungs.forEach((r, ri) => {
      ['label', 'body', 'move'].forEach(k => { if (!r[k]) err(`${tag}: 第 ${ri + 1} 档缺 ${k}`); });
    });
  }

  if (v.rows) {
    v.rows.forEach((r, ri) => {
      const g = r.choices.filter(c => c.gentle).length;
      if (g !== 1) err(`${tag}: 第 ${ri + 1} 行有 ${g} 个「好好说」选项（必须恰好 1 个）`);
      if (!r.choices.length) err(`${tag}: 第 ${ri + 1} 行没有选项`);
    });
  }

  if (v.pairs && v.words) {
    const a = v.pairs.map(p => p.word).slice().sort().join('|');
    const b = v.words.slice().sort().join('|');
    if (a !== b) err(`${tag}: words 与 pairs.word 对不上`);
    if (new Set(v.words).size !== v.words.length) err(`${tag}: words 有重复`);
  }

  if (v.roles) {
    if (v.roles.length < 2) err(`${tag}: 至少需要两个视角`);
    if (new Set(v.roles.map(r => r.thought)).size !== v.roles.length) err(`${tag}: 两个角色的想法重复`);
  }

  if (v.steps) {
    if (v.steps.length < 2) err(`${tag}: 排序至少需要两步`);
    if (new Set(v.steps).size !== v.steps.length) err(`${tag}: steps 有重复文本`);
  }

  if (v.pairs && Array.isArray(v.pairs[0])) {
    const flat = v.pairs.flat();
    if (new Set(flat).size !== flat.length) err(`${tag}: 记忆牌有重复文本`);
  }

  if (v.items && new Set(v.items.map(x => x.n)).size !== v.items.length) err(`${tag}: 天气项重复`);
})));

/* ---------- 文案长度 ---------- */
const LONG = 90;
const checkLen = (t, where) => {
  if (typeof t === 'string' && t.length > LONG) warn(`${where}: ${t.length} 字，小屏可能溢出`);
};
allBanks.forEach(([label, bank]) => Object.entries(bank).forEach(([id, arr]) => arr.forEach((v, i) => {
  const tag = `${label} ${id}#${i}`;
  [v.scenario, v.question, v.thought, v.note].forEach(t => checkLen(t, tag));
  (v.options || []).forEach(o => checkLen(typeof o === 'string' ? o : o.t, tag));
  (v.clues || []).forEach(t => checkLen(t, tag));
  (v.steps || []).forEach(t => checkLen(t, tag));
  (v.replies || []).forEach(t => checkLen(t, tag));
  (v.cards || []).forEach(c => checkLen(c.text || c.t, tag));
  (v.rungs || []).forEach(r => { checkLen(r.label, tag); checkLen(r.body, tag); checkLen(r.move, tag); });
})));

/* ---------- CODEX 里没人用的条目 ---------- */
Object.keys(CODEX).forEach((k) => {
  if (!seenCards.has(k)) warn(`CODEX 里的「${k}」没有关卡会发，永远锁着`);
});

/* ---------- 心理学词典 ---------- */
const DICT_CATS = [
  '基础与神经', '学习与记忆', '思维与判断', '情绪与动机', '发展与人格',
  '社会与群体', '关系与沟通', '心理健康与干预', '方法与科学素养'
];
const seenTerms = new Set();
if (DICT.length !== 100) err(`心理学词典应为 100 条，当前 ${DICT.length} 条`);
DICT.forEach((d, i) => {
  const tag = `词典#${i} ${d.t || '(无名词)'}`;
  ['t', 'e', 'c', 's', 'd'].forEach(k => { if (!d[k]) err(`${tag}: 缺字段 ${k}`); });
  if (d.t && seenTerms.has(d.t)) err(`${tag}: 名词重复`);
  seenTerms.add(d.t);
  if (!DICT_CATS.includes(d.c)) err(`${tag}: 未知分类「${d.c}」`);
  checkLen(d.s, tag);
  if (d.d && d.d.length > 160) warn(`${tag}: 展开 ${d.d.length} 字，偏长`);
  if (d.m && d.m.length > 90) warn(`${tag}: 误解 ${d.m.length} 字，偏长`);
});
DICT_CATS.forEach(c => { if (!DICT.some(d => d.c === c)) err(`词典分类「${c}」没有词条`); });

/* ---------- 自助工具箱 ---------- */
const SH_CATS = ['心力恢复', '认知自助', '行为与身体', '关系与支持', '自助边界'];
const SH_STATES = SH.states || [];
const SH_TOOLS = SH.tools || [];
const SH_DISTS = SH.distortions || [];
if (!SH.safety) err('自助工具箱：缺 safety 边界说明');
if (SH_STATES.length !== 5) err(`自助工具箱：状态应为 5 种，当前 ${SH_STATES.length} 种`);
if (SH_TOOLS.length !== 32) err(`自助工具箱：工具卡应为 32 张，当前 ${SH_TOOLS.length} 张`);
if (SH_DISTS.length !== 10) err(`自助工具箱：认知扭曲应为 10 条，当前 ${SH_DISTS.length} 条`);
const seenShState = new Set();
SH_STATES.forEach((s, i) => {
  const tag = `自助状态#${i} ${s.name || '(无名)'}`;
  ['id', 'name', 'sub', 'lead', 'avoid'].forEach(k => { if (!s[k]) err(`${tag}: 缺字段 ${k}`); });
  if (s.id && seenShState.has(s.id)) err(`${tag}: id 重复`);
  seenShState.add(s.id);
  if (!Array.isArray(s.moves) || s.moves.length < 3) err(`${tag}: 至少需要 3 个可做动作`);
  (s.moves || []).forEach((m, mi) => {
    if (!m.t || !m.d) err(`${tag}: 第 ${mi + 1} 个动作缺 t / d`);
  });
});
const seenShTool = new Set();
SH_TOOLS.forEach((t, i) => {
  const tag = `自助工具#${i} ${t.t || '(无名)'}`;
  ['t', 'e', 'c', 'when', 'note'].forEach(k => { if (!t[k]) err(`${tag}: 缺字段 ${k}`); });
  if (t.t && seenShTool.has(t.t)) err(`${tag}: 名称重复`);
  seenShTool.add(t.t);
  if (!SH_CATS.includes(t.c)) err(`${tag}: 未知分类「${t.c}」`);
  if (!Array.isArray(t.how) || t.how.length < 2) err(`${tag}: 至少需要 2 个步骤`);
  (t.how || []).forEach((x, xi) => { if (!x) err(`${tag}: 第 ${xi + 1} 步为空`); });
});
SH_CATS.forEach(c => { if (!SH_TOOLS.some(t => t.c === c)) err(`自助分类「${c}」没有工具卡`); });
const seenShDist = new Set();
SH_DISTS.forEach((d, i) => {
  const tag = `认知扭曲#${i} ${d.t || '(无名)'}`;
  ['t', 'd', 'eg'].forEach(k => { if (!d[k]) err(`${tag}: 缺字段 ${k}`); });
  if (d.t && seenShDist.has(d.t)) err(`${tag}: 名称重复`);
  seenShDist.add(d.t);
});

/* ---------- 慢变量 ---------- */
const SV_CATS = ['身体底盘', '价值与方向', '关系与复利'];
const SV_VARS = SLOW.vars || [];
const SV_PRACTICES = SLOW.practices || [];
const SV_TRAPS = SLOW.traps || [];
const SV_HORIZONS = SLOW.horizons || [];
if (!SLOW.safety) err('慢变量：缺 safety 边界说明');
if (SV_VARS.length !== 6) err(`慢变量：变量应为 6 个，当前 ${SV_VARS.length} 个`);
if (SV_PRACTICES.length !== 12) err(`慢变量：练习卡应为 12 张，当前 ${SV_PRACTICES.length} 张`);
if (SV_TRAPS.length !== 10) err(`慢变量：快变量陷阱应为 10 条，当前 ${SV_TRAPS.length} 条`);
if (SV_HORIZONS.length !== 3) err(`慢变量：时间尺度应为 3 个，当前 ${SV_HORIZONS.length} 个`);
const seenSvVar = new Set();
SV_VARS.forEach((v, i) => {
  const tag = `慢变量#${i} ${v.name || '(无名)'}`;
  ['id', 'name', 'sub', 'lead', 'why', 'misuse', 'check'].forEach(k => { if (!v[k]) err(`${tag}: 缺字段 ${k}`); });
  if (v.id && seenSvVar.has(v.id)) err(`${tag}: id 重复`);
  seenSvVar.add(v.id);
  if (!v.move || !v.move.t || !v.move.d) err(`${tag}: 缺 move.t / move.d`);
});
const seenSvPractice = new Set();
SV_PRACTICES.forEach((p, i) => {
  const tag = `慢变量练习#${i} ${p.t || '(无名)'}`;
  ['t', 'e', 'c', 'when', 'note'].forEach(k => { if (!p[k]) err(`${tag}: 缺字段 ${k}`); });
  if (p.t && seenSvPractice.has(p.t)) err(`${tag}: 名称重复`);
  seenSvPractice.add(p.t);
  if (!SV_CATS.includes(p.c)) err(`${tag}: 未知分类「${p.c}」`);
  if (!Array.isArray(p.how) || p.how.length < 2) err(`${tag}: 至少需要 2 个步骤`);
  (p.how || []).forEach((x, xi) => { if (!x) err(`${tag}: 第 ${xi + 1} 步为空`); });
});
SV_CATS.forEach(c => { if (!SV_PRACTICES.some(p => p.c === c)) err(`慢变量分类「${c}」没有练习卡`); });
const seenSvTrap = new Set();
SV_TRAPS.forEach((t, i) => {
  const tag = `快变量陷阱#${i} ${t.t || '(无名)'}`;
  ['t', 'd', 'eg'].forEach(k => { if (!t[k]) err(`${tag}: 缺字段 ${k}`); });
  if (t.t && seenSvTrap.has(t.t)) err(`${tag}: 名称重复`);
  seenSvTrap.add(t.t);
});
SV_HORIZONS.forEach((h, i) => {
  const tag = `时间尺度#${i} ${h.t || '(无名)'}`;
  ['t', 'd'].forEach(k => { if (!h[k]) err(`${tag}: 缺字段 ${k}`); });
  if (!Array.isArray(h.asks) || h.asks.length < 2) err(`${tag}: 至少需要 2 个问题`);
  (h.asks || []).forEach((a, ai) => { if (!a) err(`${tag}: 第 ${ai + 1} 个问题为空`); });
});

/* ---------- 静修间 / 漂流瓶 ---------- */
const MOODS = ['现在很烦', '现在很累', '睡不着', '心里空'];
const RETREAT_TYPES = ['ground', 'defuse', 'space'];
const retreat = LIB.RETREAT || [];
const bottles = LIB.BOTTLES || [];
if (retreat.length < 8) err(`静修练习只有 ${retreat.length} 个（至少 8 个）`);
const seenRetreat = new Set();
retreat.forEach((r, i) => {
  const tag = `静修#${i} ${r.id || ''}`;
  if (!r.id || seenRetreat.has(r.id)) err(`${tag}: id 缺失或重复`);
  seenRetreat.add(r.id);
  ['name', 'sub', 'minutes', 'intro'].forEach(k => { if (!r[k]) err(`${tag}: 缺 ${k}`); });
  if (!RETREAT_TYPES.includes(r.type)) err(`${tag}: 未知 type「${r.type}」`);
  if (!MOODS.includes(r.mood)) err(`${tag}: mood「${r.mood}」不在分组里`);
  if (!r.when) warn(`${tag}: 缺 when，列表会退回显示 sub`);
  if (r.type === 'ground') {
    if (!Array.isArray(r.rows) || r.rows.length < 2) err(`${tag}: ground 至少 2 行`);
    (r.rows || []).forEach((row, ri) => {
      if (!row.label || !Array.isArray(row.choices) || row.choices.length < 2) err(`${tag}: 第 ${ri + 1} 行选项不足`);
      if (row.choices && new Set(row.choices).size !== row.choices.length) err(`${tag}: 第 ${ri + 1} 行选项重复`);
    });
    if (!r.close) err(`${tag}: 缺 close`);
  }
  if (r.type === 'space') {
    if (!Array.isArray(r.steps) || r.steps.length < 2) err(`${tag}: space 至少 2 段`);
    (r.steps || []).forEach((s, si) => { if (!s.label || !s.text) err(`${tag}: 第 ${si + 1} 段缺字段`); });
    if (!r.close) err(`${tag}: 缺 close`);
  }
  if (r.type === 'defuse') {
    if (!Array.isArray(r.variants) || !r.variants.length) err(`${tag}: defuse 缺 variants`);
    (r.variants || []).forEach((v, vi) => {
      if (!v.thought || !v.why) err(`${tag}: 第 ${vi + 1} 组缺 thought / why`);
      if (!Array.isArray(v.options) || v.options.length < 2) err(`${tag}: 第 ${vi + 1} 组选项不足`);
      if (!(Number.isInteger(v.answer) && v.answer >= 0 && v.answer < (v.options || []).length)) err(`${tag}: 第 ${vi + 1} 组 answer 越界`);
    });
  }
});
MOODS.forEach(m => { if (!retreat.some(r => r.mood === m)) err(`静修分组「${m}」没有任何练习`); });
if (bottles.length < 12) err(`漂流瓶只有 ${bottles.length} 题（至少 12 题）`);
const seenBottleQ = new Set();
bottles.forEach((b, i) => {
  if (!b.q || !b.why) err(`漂流瓶#${i}: 缺 q / why`);
  if (!Array.isArray(b.opts) || b.opts.length < 2) err(`漂流瓶#${i}: 选项不足`);
  if (seenBottleQ.has(b.q)) err(`漂流瓶#${i}: 题目重复`);
  seenBottleQ.add(b.q);
});

/* ---------- 红线词 ---------- */
const RED = ['得分率', '分数', '排名', '正确率', '治疗', '疗效', '诊断', '抑郁症', '焦虑症', '量表', '障碍'];
const blob = JSON.stringify(MI);
RED.forEach((w) => {
  const n = blob.split(w).length - 1;
  if (n) warn(`出现「${w}」${n} 次，确认语境没有评分 / 诊断 / 疗效暗示`);
});

/* ---------- 汇总 ---------- */
const countOf = (bank) => Object.values(bank).reduce((s, a) => s + a.length, 0);
const perBand = (bank, id) => (bank[id] || []).length;
console.log(`儿童 / 亲子：${KID.levels.length} 站（含终章）· ${(KID.islands || []).length} 岛 · 变体 ${countOf(bankKid)} 组`);
console.log(`成年：${ADULT.levels.length} 站（含终章）· ${(ADULT.islands || []).length} 岛 · 变体 ${countOf(bankAdult)} 组`);
console.log(`词卡释义 ${Object.keys(CODEX).length} 条 · 静修 ${retreat.length}（${MOODS.map(m => m + ' ' + retreat.filter(r => r.mood === m).length).join(' / ')}） · 漂流瓶 ${bottles.length} · 心理学词典 ${DICT.length} 条 · 自助工具 ${SH_TOOLS.length} 张 + ${SH_DISTS.length} 条扭曲 · 慢变量 ${SV_VARS.length} 个 + ${SV_PRACTICES.length} 张练习 + ${SV_HORIZONS.length} 个尺度 + ${SV_TRAPS.length} 个陷阱`);

if (warns.length) {
  console.log(`\n提示 ${warns.length} 条：`);
  warns.forEach(w => console.log('  · ' + w));
}
if (errors.length) {
  console.log(`\n错误 ${errors.length} 条：`);
  errors.forEach(e => console.log('  ✗ ' + e));
  process.exit(1);
}
console.log('\n内容自检通过。');
