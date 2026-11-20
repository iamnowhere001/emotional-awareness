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
  'glossary',
  'levels-kid',
  'levels-kid-island4',
  'levels-kid-island5',
  'levels-adult',
  'levels-adult-island5',
  'bank-kid-1-3',
  'bank-kid-island4',
  'bank-kid-island5',
  'bank-adult-1-3',
  'bank-adult-island4',
  'bank-adult-island5',
  'bank-compose',
  'levels-adult-work',
  'library',
  'meditate',
  'dictionary',
  'selfhelp',
  'slowvars',
  'help'
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
      const visible = pool.filter(v => (v.b || []).includes(b.id));
      if (visible.length < MIN_VARIANTS) err(`${tr.name} ${id}: ${b.id} 档只有 ${visible.length} 组（要求 ≥${MIN_VARIANTS}）`);
      /* 带 tiers 的档（6-12 岁）两层都要有题：基础层保证第一次来就能玩，
         进阶层保证走过一次之后「多想一步」不会抽出空题。 */
      if (b.tiers) {
        const t1 = visible.filter(v => (v.tier || 1) === 1).length;
        const t2 = visible.filter(v => v.tier === 2).length;
        if (t1 < MIN_VARIANTS) err(`${tr.name} ${id}: ${b.id} 档基础层只有 ${t1} 组（要求 ≥${MIN_VARIANTS}）`);
        if (t2 < 1) err(`${tr.name} ${id}: ${b.id} 档「多想一步」层没有题`);
      }
    });
    const lv = levels.find(l => l.id === id);
    pool.forEach((v, i) => {
      const tag = `${tr.name} ${id}#${i}(${(v.b || []).join('/') || '未标档'})`;
      if (!v.b || !v.b.length) err(`${tag}: 缺 b 档位标记`);
      /* 儿童 / 亲子轨按深度分层，每条变体都要明确属于哪一层；
         成年与工作间是单层题库，不要求 tier。 */
      if (tr.key === 'kid' && v.tier !== 1 && v.tier !== 2) err(`${tag}: 缺 tier 字段（只能是 1 或 2）`);
      if (v.tier !== undefined && v.tier !== 1 && v.tier !== 2) err(`${tag}: tier 只能是 1 或 2`);
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
const allBanks = [['儿童', bankKid], ['成年', bankAdult], ['工作间', MI.bankWork || {}]];
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

/* ---------- 心理学词典 ----------
   数量不设上限：加词条不必删旧词条，只保留一条防止误删的下限。
   主题分组与概念类型由 MI.dictionaryMeta 定义，lint 校验两者和实际词条一致。 */
const DICT_META = MI.dictionaryMeta || {};
const DICT_GROUPS = DICT_META.groups || [];
const DICT_KINDS = DICT_META.kinds || [];
const DICT_CATS = DICT_GROUPS.flatMap(g => g.cats || []);
const DICT_KIND_IDS = new Set(DICT_KINDS.map(k => k.id));
if (!DICT.length) err('心理学词典为空');
else if (DICT.length < 100) err(`心理学词典至少 100 条（当前 ${DICT.length} 条）：这是防止误删的下限，不是数量上限`);
if (!DICT_GROUPS.length) err('心理学词典缺 dictionaryMeta.groups');
if (!DICT_KINDS.length) err('心理学词典缺 dictionaryMeta.kinds');
if (new Set(DICT_CATS).size !== DICT_CATS.length) err('dictionaryMeta 里有重复主题');
if (DICT_KIND_IDS.size !== DICT_KINDS.length) err('dictionaryMeta 里有重复概念类型');
DICT_GROUPS.forEach((g, i) => {
  const tag = `词典分组#${i} ${g.name || ''}`;
  ['id', 'name', 'desc'].forEach(k => { if (!g[k]) err(`${tag}: 缺字段 ${k}`); });
  if (!/^[a-z][a-z0-9-]*$/.test(g.id || '')) err(`${tag}: id 应为小写字母 / 数字 / 连字符`);
  if (!Array.isArray(g.cats) || !g.cats.length) err(`${tag}: cats 为空`);
});
DICT_KINDS.forEach((k, i) => {
  const tag = `词典类型#${i} ${k.name || ''}`;
  ['id', 'name', 'desc'].forEach(x => { if (!k[x]) err(`${tag}: 缺字段 ${x}`); });
  if (!/^[a-z][a-z0-9-]*$/.test(k.id || '')) err(`${tag}: id 应为小写字母 / 数字 / 连字符`);
});
const seenTerms = new Set();
const allTerms = new Set(DICT.map(d => d.t));
DICT.forEach((d, i) => {
  const tag = `词典#${i} ${d.t || '(无名词)'}`;
  ['t', 'e', 'c', 'k', 's', 'd'].forEach(k => { if (!d[k]) err(`${tag}: 缺字段 ${k}`); });
  if (d.t && seenTerms.has(d.t)) err(`${tag}: 名词重复`);
  seenTerms.add(d.t);
  if (!DICT_CATS.includes(d.c)) err(`${tag}: 主题「${d.c}」不在 dictionaryMeta.groups 里`);
  if (!DICT_KIND_IDS.has(d.k)) err(`${tag}: 概念类型「${d.k}」不在 dictionaryMeta.kinds 里`);
  if (d.r !== undefined) {
    if (!Array.isArray(d.r) || !d.r.length) err(`${tag}: r 关联词条应为非空数组`);
    else {
      if (new Set(d.r).size !== d.r.length) err(`${tag}: r 关联词条重复`);
      d.r.forEach((r) => {
        if (r === d.t) err(`${tag}: r 不能指向自己`);
        if (!allTerms.has(r)) err(`${tag}: r 关联「${r}」不是真实词条`);
      });
    }
  }
  checkLen(d.s, tag);
  if (d.d && d.d.length > 160) warn(`${tag}: 展开 ${d.d.length} 字，偏长`);
  if (d.m && d.m.length > 90) warn(`${tag}: 误解 ${d.m.length} 字，偏长`);
});
DICT_CATS.forEach(c => { if (!DICT.some(d => d.c === c)) err(`词典主题「${c}」没有词条`); });
DICT_KIND_IDS.forEach(k => { if (!DICT.some(d => d.k === k)) err(`词典概念类型「${k}」没有词条`); });
/* myth 的 m 要写「误解」，不要写成「建议」：0.17.0 审查发现，凡是 m 被写成行动建议的条目，
   几乎都是稳健概念被错标成 myth。这条只兜住体例，真正的证据判断仍要人来做。 */
const MYTH_NEG = /不是|不等于|不能|别把|别让|不该|并非|未必|不代表|不适合|是夸张|缺乏|没有/;
DICT.filter(d => d.k === 'myth' && d.m && !MYTH_NEG.test(d.m)).forEach(d => {
  warn(`词典「${d.t}」标为 myth，但 m 里没有否定式的误解句：先确认这是「概念被夸大」还是「概念本身成立」`);
});
/* 阅读顺序的结构锁：catMeta 给每个主题一句导语与若干概念簇，簇只声明起点，
   边界由词条数组顺序派生。起点必须真实存在、单调递增，且首簇起点就是主题首条。 */
const DICT_CAT_META = DICT_META.catMeta || {};
DICT_CATS.forEach(c => {
  const meta = DICT_CAT_META[c];
  if (!meta) { err(`词典主题「${c}」缺 dictionaryMeta.catMeta 导语与概念簇`); return; }
  if (!meta.lead) err(`词典主题「${c}」缺 catMeta.lead 导语`);
  if (!Array.isArray(meta.clusters) || !meta.clusters.length) {
    err(`词典主题「${c}」缺 catMeta.clusters`);
    return;
  }
  const terms = DICT.filter(d => d.c === c).map(d => d.t);
  const starts = meta.clusters.map(cl => cl.start);
  if (new Set(starts).size !== starts.length) err(`词典主题「${c}」的概念簇起点重复`);
  let last = -1;
  meta.clusters.forEach((cl, i) => {
    if (!cl.name || !cl.start) { err(`词典主题「${c}」概念簇#${i} 缺 name 或 start`); return; }
    const at = terms.indexOf(cl.start);
    if (at < 0) err(`词典主题「${c}」概念簇「${cl.name}」的起点「${cl.start}」不是本主题词条`);
    else {
      if (at <= last) err(`词典主题「${c}」概念簇起点顺序与词条数组不一致：${cl.start}`);
      if (i === 0 && at !== 0) err(`词典主题「${c}」第一个概念簇的起点应是该主题首条`);
      last = at;
    }
  });
});
Object.keys(DICT_CAT_META).forEach(c => {
  if (!DICT_CATS.includes(c)) err(`dictionaryMeta.catMeta 里的「${c}」不是合法主题`);
});

/* ---------- 自助工具箱 ---------- */
const SH_CATS = ['心力恢复', '认知自助', '行为与身体', '关系与支持', '自助边界'];
const SH_STATES = SH.states || [];
const SH_TOOLS = SH.tools || [];
const SH_DISTS = SH.distortions || [];
if (!MI.safety || !MI.safety.text) err('边界说明：缺 MI.safety.text（所有知识库共用一份）');
if (SH_STATES.length !== 5) err(`自助工具箱：状态应为 5 种，当前 ${SH_STATES.length} 种`);
if (SH_TOOLS.length !== 31) err(`自助工具箱：工具卡应为 31 张，当前 ${SH_TOOLS.length} 张`);
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
const SV_VARS = SLOW.vars || [];
const SV_PRACTICES = SLOW.practices || [];
const SV_TRAPS = SLOW.traps || [];
const SV_HORIZONS = SLOW.horizons || [];
/* 日常层与时间预算：内容是两层结构（方向层 + 日常层），但数量仍是显式契约。 */
const SV_DAILY = SLOW.daily || [];
const SV_BUDGET = SLOW.budget || [];
const SV_MD_IDS = new Set(((MI.meditate || {}).practices || []).map(p => p.id));
if (!MI.safety || !MI.safety.text) err('边界说明：缺 MI.safety.text（所有知识库共用一份）');
if (SV_VARS.length !== 6) err(`慢变量：变量应为 6 个，当前 ${SV_VARS.length} 个`);
if (SV_DAILY.length !== 5) err(`慢变量：日常五件套应为 5 件，当前 ${SV_DAILY.length} 件`);
if (SV_BUDGET.length !== 3) err(`慢变量：时间预算应为 3 档，当前 ${SV_BUDGET.length} 档`);
if (SV_PRACTICES.length !== 20) err(`慢变量：练习卡应为 20 张，当前 ${SV_PRACTICES.length} 张`);
if (SV_TRAPS.length !== 12) err(`慢变量：快变量陷阱应为 12 条，当前 ${SV_TRAPS.length} 条`);
if (SV_HORIZONS.length !== 3) err(`慢变量：时间尺度应为 3 个，当前 ${SV_HORIZONS.length} 个`);
const seenSvVar = new Set();
const seenSvVarName = new Set();
SV_VARS.forEach((v, i) => {
  const tag = `慢变量#${i} ${v.name || '(无名)'}`;
  ['id', 'name', 'sub', 'lead', 'why', 'misuse', 'check'].forEach(k => { if (!v[k]) err(`${tag}: 缺字段 ${k}`); });
  if (v.id && seenSvVar.has(v.id)) err(`${tag}: id 重复`);
  if (v.name && seenSvVarName.has(v.name)) err(`${tag}: 名称重复`);
  if (!/^[a-z][a-z0-9-]*$/.test(v.id || '')) err(`${tag}: id 应为小写字母 / 数字 / 连字符`);
  seenSvVar.add(v.id);
  seenSvVarName.add(v.name);
  if (!v.move || !v.move.t || !v.move.d) err(`${tag}: 缺 move.t / move.d`);
});
const SV_VAR_IDS = new Set(seenSvVar);
const seenSvPractice = new Set();
SV_PRACTICES.forEach((p, i) => {
  const tag = `慢变量练习#${i} ${p.t || '(无名)'}`;
  ['t', 'e', 'v', 'when', 'note'].forEach(k => { if (!p[k]) err(`${tag}: 缺字段 ${k}`); });
  if (p.t && seenSvPractice.has(p.t)) err(`${tag}: 名称重复`);
  if (p.t && seenSvVarName.has(p.t)) err(`${tag}: 与慢变量重名，变量与卡片会混淆`);
  if ('c' in p) err(`${tag}: 旧字段 c 已废弃，改用 v（慢变量 id）`);
  seenSvPractice.add(p.t);
  if (!SV_VAR_IDS.has(p.v)) err(`${tag}: v「${p.v}」不是任何 vars[].id`);
  if (!Array.isArray(p.how) || p.how.length < 2) err(`${tag}: 至少需要 2 个步骤`);
  (p.how || []).forEach((x, xi) => { if (!x) err(`${tag}: 第 ${xi + 1} 步为空`); });
  /* 可选 md：该卡在静修间里已有逐步引导时只给入口；指错 id 会得到一张点不动的卡。 */
  if ('md' in p && !SV_MD_IDS.has(p.md)) err(`${tag}: md「${p.md}」不是任何静修间练习 id`);
});
SV_VAR_IDS.forEach(id => { if (!SV_PRACTICES.some(p => p.v === id)) err(`慢变量「${id}」没有练习卡`); });

/* 日常五件套：名称去重、挂真实变量、剂量字段齐全、出口必须落到真实内容。
   出口只允许两种（练习卡 / 静修间），别的一律报错——避免又长出一套「虚拟练习」。 */
const seenSvDaily = new Set();
SV_DAILY.forEach((d, i) => {
  const tag = `日常五件套#${i} ${d.name || '(无名)'}`;
  ['id', 'name', 'e', 'sub', 'when', 'why', 'cut', 'broken'].forEach(k => { if (!d[k]) err(`${tag}: 缺字段 ${k}`); });
  if (d.id && !/^[a-z][a-z0-9-]*$/.test(d.id)) err(`${tag}: id 应为小写字母 / 数字 / 连字符`);
  if (d.id && seenSvDaily.has(d.id)) err(`${tag}: id 重复`);
  if (d.name && seenSvVarName.has(d.name)) err(`${tag}: 与慢变量重名，两层会混淆`);
  if (d.name && seenSvPractice.has(d.name)) err(`${tag}: 与练习卡重名，两层会混淆`);
  seenSvDaily.add(d.id);
  if (!SV_VAR_IDS.has(d.v)) err(`${tag}: v「${d.v}」不是任何 vars[].id`);
  if (!d.dose || !d.dose.min || !d.dose.std) err(`${tag}: 缺 dose.min / dose.std（最小剂量与标准版）`);
  const l = d.link || {};
  if (l.kind === 'card') {
    if (!seenSvPractice.has(l.id)) err(`${tag}: link.id「${l.id}」不是练习卡标题`);
  } else if (l.kind === 'md') {
    if (!SV_MD_IDS.has(l.id)) err(`${tag}: link.id「${l.id}」不是静修间练习 id`);
  } else {
    err(`${tag}: link.kind 只能是 card 或 md，当前「${l.kind}」`);
  }
});
/* 时间预算：每档至少 2 张卡，且必须是真实卡片标题——点不动的入口比没有入口更糟。 */
SV_BUDGET.forEach((b, i) => {
  const tag = `时间预算#${i} ${b.t || '(无名)'}`;
  ['t', 'd'].forEach(k => { if (!b[k]) err(`${tag}: 缺字段 ${k}`); });
  if (!Array.isArray(b.picks) || b.picks.length < 2) err(`${tag}: picks 至少引用 2 张练习卡`);
  (b.picks || []).forEach((t, ti) => {
    if (!seenSvPractice.has(t)) err(`${tag}: picks[${ti}]「${t}」不是练习卡标题`);
  });
  if (b.picks && new Set(b.picks).size !== b.picks.length) err(`${tag}: picks 引用重复`);
});
const seenSvTrap = new Set();
SV_TRAPS.forEach((t, i) => {
  const tag = `快变量陷阱#${i} ${t.t || '(无名)'}`;
  ['t', 'd', 'eg'].forEach(k => { if (!t[k]) err(`${tag}: 缺字段 ${k}`); });
  if (t.t && seenSvTrap.has(t.t)) err(`${tag}: 名称重复`);
  if (t.t && SH_DISTS.some(d => d.t === t.t)) err(`${tag}: 与自助工具箱认知扭曲同名，内容会重复`);
  seenSvTrap.add(t.t);
});
const seenSvHorizon = new Set();
SV_HORIZONS.forEach((h, i) => {
  const tag = `时间尺度#${i} ${h.t || '(无名)'}`;
  ['t', 'd'].forEach(k => { if (!h[k]) err(`${tag}: 缺字段 ${k}`); });
  if (h.t && seenSvHorizon.has(h.t)) err(`${tag}: 名称重复`);
  seenSvHorizon.add(h.t);
  if (!Array.isArray(h.asks) || h.asks.length < 2) err(`${tag}: 至少需要 2 个问题`);
  (h.asks || []).forEach((a, ai) => { if (!a) err(`${tag}: 第 ${ai + 1} 个问题为空`); });
  if (!Array.isArray(h.cards) || !h.cards.length) err(`${tag}: cards 至少引用 1 张练习卡`);
  (h.cards || []).forEach((c, ci) => {
    if (!seenSvPractice.has(c)) err(`${tag}: cards[${ci}]「${c}」不是练习卡标题`);
  });
  if (h.cards && new Set(h.cards).size !== h.cards.length) err(`${tag}: cards 引用重复`);
});

/* ---------- 概念层 ----------
   20 个概念是站点 / 工具卡 / 词典 / 慢变量的共同锚点（1.1.0 岛 5 增 4 个）。这里校验：
   id 唯一、两轨词卡名与 CODEX 一致、stations / tools / dict / slowvars 反链都真实存在；
   teach 覆盖两轨各一站、requires 不成环且教学顺序成立、dicts 只引用已有词条；
   工作间四幕用到的概念必须早于 MI.workGate 教完（直接拦住「用到但没教」的倒挂）。 */
const GLOSSARY = MI.glossary || [];
if (GLOSSARY.length !== 20) err(`概念层：应为 20 个概念，当前 ${GLOSSARY.length} 个`);
const seenConcept = new Set();
const CONCEPT_BY_ID = new Map(GLOSSARY.map(g => [g.id, g]));
const TRACK_ORDER = {
  kid: new Map((KID.levels || []).map((l, i) => [l.id, i])),
  adult: new Map((ADULT.levels || []).map((l, i) => [l.id, i]))
};
const conceptLevelIds = new Set([
  ...(KID.levels || []).map(l => l.id),
  ...(ADULT.levels || []).map(l => l.id),
  ...((MI.adultWork) || []).map(l => l.id)
]);
GLOSSARY.forEach((g, i) => {
  const tag = `概念#${i} ${g.id || '(无 id)'}`;
  if (!g.id || !/^[a-z][a-z0-9-]*$/.test(g.id)) err(`${tag}: id 应为小写字母 / 数字 / 连字符`);
  if (seenConcept.has(g.id)) err(`${tag}: id 重复`);
  seenConcept.add(g.id);
  ['kid', 'adult', 'line', 'mechanism', 'bridge', 'practice'].forEach(k => { if (!g[k]) err(`${tag}: 缺字段 ${k}`); });
  /* 承接句与实践卡是站间闭环：太短会变成口号，太长又会盖住题目本身。 */
  if (g.bridge && (g.bridge.length < 12 || g.bridge.length > 70)) err(`${tag}: bridge 应在 12–70 字，当前 ${g.bridge.length}`);
  if (g.practice && (g.practice.length < 12 || g.practice.length > 70)) err(`${tag}: practice 应在 12–70 字，当前 ${g.practice.length}`);
  if (!g.dose || !g.dose.time) err(`${tag}: 缺 dose.time`);
  if (!CODEX[g.kid]) err(`${tag}: kid「${g.kid}」不在 CODEX 里`);
  if (!CODEX[g.adult]) err(`${tag}: adult「${g.adult}」不在 CODEX 里`);
  (g.stations || []).forEach(s => { if (!conceptLevelIds.has(s)) err(`${tag}: stations「${s}」不是任何关卡 id`); });
  (g.tools || []).forEach(t => { if (!SH_TOOLS.some(x => x.t === t)) err(`${tag}: tools「${t}」不在自助工具卡里`); });
  if (g.dict && !DICT.some(d => d.t === g.dict)) err(`${tag}: dict「${g.dict}」不在词典里`);
  (g.slowvars || []).forEach(v => { if (!SV_VARS.some(x => x.id === v)) err(`${tag}: slowvars「${v}」不是任何慢变量`); });

  /* teach：两轨各一个教学站，且必须在本概念的 stations 里。 */
  if (!Array.isArray(g.teach) || g.teach.length !== 2) err(`${tag}: teach 应为两轨各一个站点，当前 ${JSON.stringify(g.teach || null)}`);
  const kidTeach = (g.teach || []).find(id => !id.startsWith('A'));
  const adultTeach = (g.teach || []).find(id => id.startsWith('A'));
  if (!kidTeach || !TRACK_ORDER.kid.has(kidTeach)) err(`${tag}: teach 缺儿童轨教学站`);
  if (!adultTeach || !TRACK_ORDER.adult.has(adultTeach)) err(`${tag}: teach 缺成年轨教学站`);
  if (kidTeach && !(g.stations || []).includes(kidTeach)) err(`${tag}: teach「${kidTeach}」不在 stations 里`);
  if (adultTeach && !(g.stations || []).includes(adultTeach)) err(`${tag}: teach「${adultTeach}」不在 stations 里`);

  /* requires：只能指向真实概念，不能指向自己，不能重复。 */
  if (!Array.isArray(g.requires)) err(`${tag}: 缺 requires（可为空数组）`);
  const seenReq = new Set();
  (g.requires || []).forEach(id => {
    if (!CONCEPT_BY_ID.has(id)) err(`${tag}: requires「${id}」不是真实概念`);
    if (id === g.id) err(`${tag}: requires 不能指向自己`);
    if (seenReq.has(id)) err(`${tag}: requires「${id}」重复`);
    seenReq.add(id);
  });

  /* dicts：只引用已有词条，不新增；主锚点 must 是其中之一。 */
  if (!Array.isArray(g.dicts) || !g.dicts.length) err(`${tag}: dicts 至少引用 1 条已有词条`);
  (g.dicts || []).forEach(t => { if (!DICT.some(d => d.t === t)) err(`${tag}: dicts「${t}」不在词典里`); });
  if (new Set(g.dicts || []).size !== (g.dicts || []).length) err(`${tag}: dicts 重复`);
  if (g.dict && !(g.dicts || []).includes(g.dict)) err(`${tag}: 主锚点 dict「${g.dict}」不在 dicts 里`);
});
/* 先教后用：依赖概念的教学站必须早于本概念，两轨分别检查。 */
GLOSSARY.forEach(g => {
  (g.requires || []).forEach(id => {
    const r = CONCEPT_BY_ID.get(id);
    if (!r) return;
    ['kid', 'adult'].forEach(track => {
      const order = TRACK_ORDER[track];
      const self = order.get((g.teach || []).find(x => (track === 'adult') === x.startsWith('A')));
      const req = order.get((r.teach || []).find(x => (track === 'adult') === x.startsWith('A')));
      if (self == null || req == null) return;
      if (req >= self) err(`概念「${g.id}」依赖「${id}」，但 ${track} 轨教学站不早于本概念`);
    });
  });
});
/* 依赖不能成环。 */
(function checkCycles() {
  const done = new Set(), visiting = new Set();
  const walk = (id, path) => {
    if (done.has(id)) return;
    if (visiting.has(id)) { err(`概念依赖成环：${path.concat(id).join(' → ')}`); return; }
    visiting.add(id);
    (CONCEPT_BY_ID.get(id)?.requires || []).forEach(next => walk(next, path.concat(id)));
    visiting.delete(id);
    done.add(id);
  };
  GLOSSARY.forEach(g => walk(g.id, []));
})();
/* 复习站：全表只应有一个 review 概念，且它对应的站点要标出来。 */
const REVIEW_CONCEPTS = GLOSSARY.filter(g => g.review);
if (REVIEW_CONCEPTS.length !== 1) err(`概念层：应有且只有 1 个复习概念，当前 ${REVIEW_CONCEPTS.length} 个`);
if (REVIEW_CONCEPTS[0] && !(REVIEW_CONCEPTS[0].stations || []).includes('3-4')) err('复习概念应挂在 3-4 / A3-4');
/* 工作间：四幕用到的概念必须早于解锁点教完。 */
const WORK_GATE_ID = MI.workGate;
if (!WORK_GATE_ID) err('工作间：缺 MI.workGate');
const GATE_INDEX = (ADULT.levels || []).findIndex(l => l.id === WORK_GATE_ID);
if (GATE_INDEX < 0) err(`工作间：workGate「${WORK_GATE_ID}」不是成年轨关卡 id`);
(MI.adultWork || []).forEach(w => {
  const c = GLOSSARY.find(g => (g.stations || []).includes(w.id));
  if (!c) { err(`工作间「${w.id}」没有挂到任何概念`); return; }
  const t = (c.teach || []).find(id => id.startsWith('A'));
  const ti = (ADULT.levels || []).findIndex(l => l.id === t);
  if (ti < 0) { err(`工作间「${w.id}」的概念「${c.id}」没有成年轨教学站`); return; }
  if (ti > GATE_INDEX) err(`工作间「${w.id}」用到「${c.id}」，但它教在 ${t}，晚于解锁点 ${WORK_GATE_ID}`);
});
/* 两轨每个站点都应挂到一个概念，避免新站漏配后结果卡没有机制说明。
   终章是收束，不教新概念，刻意不挂：两轨 finale / A-finale 不参与这条检查。 */
const FINALE_IDS = new Set(
  [...(KID.levels || []), ...(ADULT.levels || [])]
    .filter(l => l.type === 'finale')
    .map(l => l.id)
);
conceptLevelIds.forEach(id => {
  if (FINALE_IDS.has(id)) return;
  if (id && !GLOSSARY.some(g => (g.stations || []).includes(id))) warn(`关卡「${id}」没有挂到任何概念`);
});

/* ---------- 急救入口 ---------- */
const HELP = MI.help || {};
const H_ACTS = HELP.actions || [];
if (!HELP.title || !HELP.lead) err('急救入口：缺 title / lead');
if (H_ACTS.length !== 3) err(`急救入口：动作应为 3 个，当前 ${H_ACTS.length} 个`);
['ground', 'name', 'reach'].forEach(id => { if (!H_ACTS.some(a => a.id === id)) err(`急救入口：缺动作 ${id}`); });
H_ACTS.forEach((a, i) => {
  const tag = `急救动作#${i} ${a.id || ''}`;
  if (!a.name || !a.len) err(`${tag}: 缺 name / len`);
  if (a.id === 'ground' && (!Array.isArray(a.steps) || a.steps.length < 3)) err(`${tag}: 至少 3 步`);
  if (a.id === 'name') {
    if (!Array.isArray(a.words) || a.words.length < 6 || a.words.length > 8) err(`${tag}: 词应在 6–8 个，当前 ${(a.words || []).length} 个`);
    if (!a.after || !a.after.includes('{word}')) err(`${tag}: after 缺 {word} 占位符`);
  }
  if (a.id === 'reach' && (!a.say || !a.sayKid || !a.kidLead)) err(`${tag}: 缺 say / sayKid / kidLead`);
});
const H_NUM = HELP.numbers || {};
const H_ITEMS = H_NUM.items || [];
if (!H_NUM.title || !H_NUM.note) err('急救求助：缺 title / note');
['12356', '12355'].forEach(k => { if (!H_ITEMS.some(x => x.k === k)) err(`急救求助：缺号码 ${k}`); });
if (!/不承诺效果/.test(H_NUM.note) || !/不能代替专业帮助/.test(H_NUM.note)) err('急救求助：note 必须写清「不承诺效果 / 不能代替专业帮助」');
const H_KID = HELP.kid || {};
if (!H_KID.title || !H_KID.body) err('急救入口：缺儿童档说明');
if (JSON.stringify(H_NUM).includes('http')) err('急救入口：求助信息里不得出现链接');

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

/* ---------- 静修间 2.0：练习族与 sit 引导 ----------
   5 族 × 2 档；族上写机制与边界，练习只写步骤。
   场景只用于「此刻」筛选，不落盘；intent 是固定句式的 if-then，不保存。 */
const MD = MI.meditate || {};
const MD_FAMS = MD.families || [];
const MD_PS = MD.practices || [];
const MD_SCENES = MD.scenes || [];
const MD_INTENTS = MD.intents || [];
if (MD_FAMS.length !== 5) err(`冥想练习：族应为 5 个，当前 ${MD_FAMS.length} 个`);
if (MD_PS.length !== 10) err(`冥想练习：引导练习应为 10 条，当前 ${MD_PS.length} 条`);
if (MD_SCENES.length !== 6) err(`冥想练习：场景应为 6 个，当前 ${MD_SCENES.length} 个`);
if (MD_INTENTS.length < 6) err(`冥想练习：if-then 句至少 6 条，当前 ${MD_INTENTS.length} 条`);
const mdFamIds = new Set();
MD_FAMS.forEach((f, i) => {
  const tag = `冥想族#${i} ${f.id || ''}`;
  if (!f.id || mdFamIds.has(f.id)) err(`${tag}: id 缺失或重复`);
  mdFamIds.add(f.id);
  ['name', 'sub', 'mechanism', 'notFor'].forEach(k => { if (!f[k]) err(`${tag}: 缺 ${k}`); });
  if (f.concept && !GLOSSARY.some(g => g.id === f.concept)) err(`${tag}: 概念锚点「${f.concept}」不存在`);
  checkLen(f.mechanism, tag);
});
const mdSceneIds = new Set();
MD_SCENES.forEach((s, i) => {
  if (!s.id || !s.name) err(`冥想场景#${i}: 缺 id / name`);
  if (mdSceneIds.has(s.id)) err(`冥想场景#${i}: id 重复`);
  mdSceneIds.add(s.id);
});
const mdPracticeIds = new Set();
const mdDosesByFamily = new Map();
MD_PS.forEach((p, i) => {
  const tag = `冥想练习#${i} ${p.id || ''}`;
  if (!p.id || mdPracticeIds.has(p.id)) err(`${tag}: id 缺失或重复`);
  mdPracticeIds.add(p.id);
  if (!mdFamIds.has(p.family)) err(`${tag}: family「${p.family}」不存在`);
  if (![1, 3].includes(p.dose)) err(`${tag}: dose 只能是 1 或 3，当前 ${p.dose}`);
  ['name', 'sub', 'minutes', 'intro', 'close'].forEach(k => { if (!p[k]) err(`${tag}: 缺 ${k}`); });
  if (p.minutes && !p.minutes.includes(p.dose === 1 ? '1 分钟' : '3 分钟')) err(`${tag}: minutes 与 dose 不一致`);
  if (!Array.isArray(p.steps) || p.steps.length < 3 || p.steps.length > 5) err(`${tag}: 步骤应为 3–5 步，当前 ${(p.steps || []).length} 步`);
  (p.steps || []).forEach((s, si) => {
    if (!s.label || !s.text) err(`${tag}: 第 ${si + 1} 步缺 label / text`);
    if (typeof s.text === 'string' && s.text.length > 40) err(`${tag}: 第 ${si + 1} 步 ${s.text.length} 字，超过 40 字`);
  });
  if (!Array.isArray(p.scenes) || !p.scenes.length) err(`${tag}: 至少 1 个场景`);
  (p.scenes || []).forEach(s => { if (!mdSceneIds.has(s)) err(`${tag}: 场景「${s}」不存在`); });
  if (!mdDosesByFamily.has(p.family)) mdDosesByFamily.set(p.family, []);
  mdDosesByFamily.get(p.family).push(p.dose);
});
MD_FAMS.forEach((f) => {
  const doses = (mdDosesByFamily.get(f.id) || []).sort();
  if (doses.join(',') !== '1,3') err(`冥想族「${f.id}」: 必须有 1 分钟与 3 分钟各一条，当前 ${doses.join(',') || '无'}`);
});
MD_SCENES.forEach((s) => {
  const n = MD_PS.filter(p => p.dose === 1 && (p.scenes || []).includes(s.id)).length;
  if (n < 2) err(`冥想场景「${s.name}」: 短版练习只有 ${n} 条，至少要 2 条`);
});
MD_INTENTS.forEach((t, i) => {
  if (!t || !t.t || !t.family || !t.scene) err(`冥想 if-then 句#${i}: 缺 t / family / scene`);
  if (t.family && t.family !== 'all' && !mdFamIds.has(t.family)) err(`冥想 if-then 句#${i}: family「${t.family}」不存在`);
  if (t.scene && t.scene !== 'all' && !mdSceneIds.has(t.scene)) err(`冥想 if-then 句#${i}: scene「${t.scene}」不存在`);
  if (t.t && (!t.t.includes('如果') || !t.t.includes('就'))) err(`冥想 if-then 句#${i}: 需含「如果…就…」`);
  checkLen(t.t, `冥想 if-then 句#${i}`);
});

/* ---------- 工作间（成年支线） ----------
   支线关卡不在 ADULT.levels 里，所以不参与 17 站结构检查；这里单独校验：
   4 幕、id 唯一、只标成年档、变体池与关卡一一对应、不带 card / skill / island / num。 */
const WORK = MI.adultWork || [];
const WBANK = MI.bankWork || {};
if (WORK.length !== 4) err(`工作间：应为 4 幕，当前 ${WORK.length} 幕`);
const workIds = new Set();
WORK.forEach((l, i) => {
  const tag = `工作间#${i} ${l.id || '(无 id)'}`;
  ['id', 'time', 'name', 'type', 'kind', 'goal', 'tip', 'hint'].forEach(k => { if (!l[k]) err(`${tag}: 缺字段 ${k}`); });
  if (l.id && !/^W-\d+$/.test(l.id)) err(`${tag}: id 应为 W-数字`);
  if (workIds.has(l.id)) err(`${tag}: id 重复`);
  workIds.add(l.id);
  if (!TYPES.includes(l.type) || l.type === 'finale') err(`${tag}: type「${l.type}」不适合支线`);
  ['island', 'num', 'card', 'skill'].forEach(k => { if (k in l) err(`${tag}: 支线不得带 ${k}（会混进主线进度 / 奖励）`); });
  if (ADULT.levels.some(x => x.id === l.id)) err(`${tag}: id 与主线关卡冲突`);
});
if (new Set(WORK.map(l => l.time)).size !== WORK.length) err('工作间：时间点重复，时间线会读不出先后');
Object.keys(WBANK).forEach(id => {
  if (!workIds.has(id)) err(`工作间题库「${id}」没有对应关卡`);
});
WORK.forEach(l => {
  const pool = WBANK[l.id] || [];
  if (pool.length < MIN_VARIANTS) err(`工作间 ${l.id}: 变体只有 ${pool.length} 组（要求 ≥${MIN_VARIANTS}）`);
  pool.forEach((v, i) => {
    const tag = `工作间 ${l.id}#${i}`;
    const b = v.b || [];
    if (!b.length || b.some(x => x !== 'adult')) err(`${tag}: b 必须只标 adult`);
    (NEED[l.type] || []).forEach(k => { if (v[k] === undefined) err(`${tag}: 缺字段 ${k}`); });
    if (v.answer !== undefined) {
      const n = Array.isArray(v.options) ? v.options.length : 0;
      if (!Number.isInteger(v.answer) || v.answer < 0 || v.answer >= n) err(`${tag}: answer 越界（选项 ${n} 个）`);
    }
  });
});

/* ---------- 变体拼装试点 ----------
   只在 4-3 / A4-3 两关上做通。这里校验数据的语义约束，而不是随机结果：
   - 想法只能属于一个场景（树形，不做自由交叉）
   - 每条想法恰好 1 个 ok，4 个镜头，组内文案不重复
   - 问法只换提问角度，不换正确答案；每个组合物化后都必须满足 reframe 契约
   - 每关正确答案的原始位置至少 2 种，避免「总是第一个」 */
const COMPOSE = MI.bankCompose || {};
const COMPOSE_IDS = Object.keys(COMPOSE);
if (COMPOSE_IDS.length !== 2) err(`拼装试点应为 2 关，当前 ${COMPOSE_IDS.length} 关`);
COMPOSE_IDS.forEach((id) => {
  const cfg = COMPOSE[id] || {};
  const tag = `拼装 ${id}`;
  const owner = [...KID.levels, ...ADULT.levels].find(l => l.id === id);
  if (!owner) err(`${tag}: 找不到对应关卡`);
  else if (owner.type !== 'reframe') err(`${tag}: 只有 reframe 题型可以拼装，当前 ${owner.type}`);
  if (!Array.isArray(cfg.asks) || cfg.asks.length !== 2) err(`${tag}: 问法应为 2 句，当前 ${(cfg.asks || []).length} 句`);
  const askIds = new Set((cfg.asks || []).map(a => a.id));
  if (askIds.size !== (cfg.asks || []).length) err(`${tag}: 问法 id 重复`);
  (cfg.asks || []).forEach((a, i) => {
    if (!a.id || !a.q) err(`${tag}: 问法#${i} 缺 id / q`);
    if (!/^[a-z][a-z0-9-]*$/.test(a.id)) err(`${tag}: 问法 id「${a.id}」应小写起头`);
    checkLen(a.q, `${tag} 问法#${i}`);
  });
  if (!Array.isArray(cfg.scenes) || cfg.scenes.length !== 3) err(`${tag}: 场景应为 3 个，当前 ${(cfg.scenes || []).length} 个`);
  if (!Array.isArray(cfg.b) || !cfg.b.length) err(`${tag}: 缺 b 档位标记`);
  (cfg.b || []).forEach(b => { if (!BANDS.some(x => x.id === b)) err(`${tag}: 未知档位「${b}」`); });
  const sceneIds = new Set();
  const thoughtHome = new Map();
  const thoughtIds = new Set(Object.keys(cfg.thoughts || {}));
  (cfg.scenes || []).forEach((s, si) => {
    if (!s.id || !s.text) err(`${tag}: 场景#${si} 缺 id / text`);
    if (sceneIds.has(s.id)) err(`${tag}: 场景 id 重复`);
    sceneIds.add(s.id);
    if (!Array.isArray(s.thoughts) || s.thoughts.length !== 2) err(`${tag}: 场景#${si} 应有 2 条想法`);
    (s.thoughts || []).forEach((tid) => {
      if (thoughtHome.has(tid)) err(`${tag}: 想法「${tid}」同时属于多个场景`);
      thoughtHome.set(tid, s.id);
      if (!thoughtIds.has(tid)) err(`${tag}: 场景引用了不存在的想法「${tid}」`);
    });
  });
  thoughtIds.forEach(tid => { if (!thoughtHome.has(tid)) err(`${tag}: 想法「${tid}」没有归属场景（会成为孤儿）`); });
  const answerPositions = new Set();
  let combos = 0;
  thoughtIds.forEach((tid) => {
    const th = cfg.thoughts[tid];
    const ttag = `${tag} ${tid}`;
    if (!th || !th.text || !th.why) err(`${ttag}: 缺 text / why`);
    checkLen(th.text, ttag);
    if (!Array.isArray(th.askIds) || !th.askIds.length) err(`${ttag}: askIds 为空`);
    (th.askIds || []).forEach(a => { if (!askIds.has(a)) err(`${ttag}: askIds 引用了不存在的问法「${a}」`); });
    const lenses = th.lenses || [];
    if (lenses.length < 3 || lenses.length > 4) err(`${ttag}: 镜头应为 3–4 个，当前 ${lenses.length} 个`);
    const okCount = lenses.filter(l => l.ok).length;
    if (okCount !== 1) err(`${ttag}: 恰好 1 个 ok，当前 ${okCount} 个`);
    const seenT = new Set();
    lenses.forEach((l, li) => {
      if (!l.t || !l.d) err(`${ttag}: 镜头#${li} 缺 t / d`);
      checkLen(l.t, ttag);
      if (seenT.has(l.t)) err(`${ttag}: 镜头文案重复「${l.t}」`);
      seenT.add(l.t);
      if (l.ok) answerPositions.add(li);
    });
  });
  /* 每关正确答案的原始位置至少 2 种：拼装不能把答案永远放在第一项。
     运行时还会按组合键做确定性打乱，但原始位置的多样性先在这里守住。 */
  if (answerPositions.size < 2) err(`${tag}: 正确答案在原始数据里只有 1 种位置，容易形成「总选第一个」`);
  /* 组合展开：场景 × 想法 × 问法，组合键唯一，且至少 5 组可做到 5 轮不重复 */
  (cfg.scenes || []).forEach(s => (s.thoughts || []).forEach(tid => {
    const th = cfg.thoughts[tid] || {};
    (th.askIds || []).forEach(aid => {
      combos += 1;
      const key = `${s.id}:${tid}:${aid}`;
      if (!/^[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/.test(key)) err(`${tag}: 组合键「${key}」含非法字符`);
      const lenses = th.lenses || [];
      const answer = lenses.findIndex(l => l.ok);
      if (answer < 0 || answer >= lenses.length) err(`${tag} ${key}: 物化后 answer 越界`);
      if (lenses.length && lenses[answer].ok !== true) err(`${tag} ${key}: answer 没有指向 ok 镜头`);
    });
  }));
  if (combos < 5) err(`${tag}: 组合只有 ${combos} 组，做不到 5 轮不重复`);
  if (combos < 10) warn(`${tag}: 组合 ${combos} 组，复玩空间偏小`);
});


/* ---------- 红线词 ----------
   不再对整份 MI 做裸子串匹配：那会把「不是诊断」「心理治疗」（词典词条名）、
   「排名什么时候出」（关卡题干）这类合法语境也算成固定噪声。
   改成逐次命中看上下文：只有「否定 / 免责语境」或「已登记白名单」才放过，
   评分 / 疗效 / 诊断的正向语境仍照常报。末尾的自检反证检测没有被放宽。 */
const RED = ['得分率', '分数', '排名', '正确率', '治疗', '疗效', '诊断', '抑郁症', '焦虑症', '量表', '障碍'];
const blob = JSON.stringify(MI);
/* 已人工确认的合法专名 / 题干：只是恰好含红线词，不是评分或诊断暗示。
   '心理治疗' 是词典词条名，也覆盖 r 关联与 catMeta 起点里的引用；
   '排名什么时候出' 是 sort 关卡里「在意排名」的念头，不是给玩家排名。 */
const RED_WHITELIST = ['心理治疗', '排名什么时候出'];
/* 否定 / 免责句式：红线词前紧邻这些标记，说明是在声明「这里不做诊断 / 不是治疗」。 */
const NEG_BEFORE = /(?:不是|并非|不等于|不代表|不提供|不做|不用于|不能替代|不能代替|别把)$/;
/* 科普澄清：如「临床诊断不是一回事」，否定落在红线词之后。 */
const NEG_AFTER = /^(?:不是一回事|不等于|并非|不能替代|不能代替)/;
/* 这次命中是否正好落在某个已登记白名单短语内部（不是「附近出现过」就算）。 */
function inWhiteList(text, word, at) {
  return RED_WHITELIST.some((phrase) => {
    const p = phrase.indexOf(word);
    if (p < 0) return false;
    let from = 0, idx;
    while ((idx = text.indexOf(phrase, from)) !== -1) {
      if (at === idx + p) return true;
      from = idx + 1;
    }
    return false;
  });
}
/* 可放过的合法语境：白名单短语，或紧邻的否定 / 免责 / 澄清句式。 */
function benignHit(text, word, at) {
  if (inWhiteList(text, word, at)) return true;
  const before = text.slice(Math.max(0, at - 6), at);
  const after = text.slice(at + word.length, at + word.length + 6);
  return NEG_BEFORE.test(before) || NEG_AFTER.test(after);
}
/* 扫出所有「真正可疑」的命中（白名单与否定语境之外的）。 */
function redFlags(text) {
  const hits = [];
  RED.forEach((w) => {
    let at = -1;
    while ((at = text.indexOf(w, at + 1)) !== -1) {
      if (!benignHit(text, w, at)) hits.push(w);
    }
  });
  return hits;
}
const tally = new Map();
redFlags(blob).forEach((w) => tally.set(w, (tally.get(w) || 0) + 1));
tally.forEach((n, w) => warn(`出现「${w}」${n} 次，确认语境没有评分 / 诊断 / 疗效暗示`));
/* 自检：正向语境的敏感词必须仍被判为可疑，防止白名单 / 否定式放宽后漏报。
   样本故意不带任何否定词，逐个都应由 redFlags 抓到。 */
const POSITIVE = '按得分率算分数、正确率排名，疗效显著，可以诊断抑郁症和焦虑症，用量表筛查障碍。';
const caught = new Set(redFlags(POSITIVE));
['得分率', '分数', '正确率', '疗效', '诊断'].forEach((w) => {
  if (!caught.has(w)) err(`红线词自检失败：「${w}」在正向语境没被检出，检测被削弱了`);
});

/* ---------- 汇总 ---------- */
const countOf = (bank) => Object.values(bank).reduce((s, a) => s + a.length, 0);
const perBand = (bank, id) => (bank[id] || []).length;
console.log(`儿童 / 亲子：${KID.levels.length} 站（含终章）· ${(KID.islands || []).length} 岛 · 变体 ${countOf(bankKid)} 组`);
console.log(`成年：${ADULT.levels.length} 站（含终章）· ${(ADULT.islands || []).length} 岛 · 变体 ${countOf(bankAdult)} 组`);
console.log(`词卡释义 ${Object.keys(CODEX).length} 条 · 静修 ${retreat.length}（${MOODS.map(m => m + ' ' + retreat.filter(r => r.mood === m).length).join(' / ')}） · 冥想 ${MD_PS.length} 条 / ${MD_FAMS.length} 族 / ${MD_SCENES.length} 场景 · 漂流瓶 ${bottles.length} · 心理学词典 ${DICT.length} 条 · 自助工具 ${SH_TOOLS.length} 张 + ${SH_DISTS.length} 条扭曲 · 慢变量 ${SV_VARS.length} 个 + ${SV_DAILY.length} 件日常 + ${SV_PRACTICES.length} 张练习 + ${SV_BUDGET.length} 档预算 + ${SV_HORIZONS.length} 个尺度 + ${SV_TRAPS.length} 个陷阱 · 急救入口 ${H_ACTS.length} 个动作 + ${H_ITEMS.length} 条求助`);

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
