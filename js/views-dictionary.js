/* js/views-dictionary.js · 知识库公共骨架 + 心理学词典（原 views-library.js 拆分之一）。
   经典脚本顺序加载，与 js/core.js 共享全局词法作用域；不要在此重复声明已有的顶层名字。 */

/* ---------------------------------------------------------------- 知识库公共视图
   心理学词典 / 自助工具箱 / 慢变量共用一副骨架：返回地图、标题、可选搜索、
   可选说明面板、分类筛选、计数、卡片网格、空态、页脚说明。
   差异（文案、分类来源、计数单位、空态、section 包裹）全部走 config；
   三个模块的 DOM 结构、id、类名与筛选结果保持不变。 */
/* 空态文案与「怎么做 / 提醒」卡片是自助与慢变量共用的，收在这里避免改一处漏一处。 */
const SH_HINT = '选一个状态，这里会出现三件可以先做的小事。';
const SV_HINT = '选一个慢变量，这里会出现它的长期逻辑和一个可以开始的小动作。';
/* 工具卡 / 慢变量卡共用外壳。detail 是可选块：本轮用它把概念层的机制与规格
   带进工具卡，不改卡片数据结构，也不给每张卡各写一段解释。 */
function howCard(item, cls, cat, catLabel, meta, detail) {
  return `<details class="dict-card ${cls}" data-term="${esc(item.t)}" data-cat="${esc(cat)}">
    <summary>
      <span class="dict-term">${esc(item.t)}</span>
      <span class="dict-en" lang="en">${esc(item.e)}</span>
      <span class="dict-short">${esc(item.when)}</span>
      <span class="dict-cat-badge">${esc(catLabel || cat)}</span>
      ${meta || ''}
    </summary>
    <div class="dict-detail">
      <div class="sh-how"><b>怎么做</b><ol>${item.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
      <p class="dict-mis"><b>提醒</b>${esc(item.note)}</p>
      ${detail || ''}
    </div>
  </details>`;
}
/* 概念回链：指回教学站（已解锁时可点）与 concept.dicts 里的已有词条。
   工具卡、静修页、结果卡共用，避免每处各拼一遍「第几站 / 哪个词」。 */
function conceptRefLinks(c) {
  if (!c) return '';
  const teachId = conceptTeach(c);
  const tlv = LEVELS.find(l => l.id === teachId);
  const ti = tlv ? LEVELS.indexOf(tlv) : -1;
  const parts = [];
  if (tlv) {
    parts.push(ti >= 0 && isUnlocked(ti)
      ? `<button class="link-btn" data-action="open-level" data-i="${ti}">对应第 ${tlv.num} 站「${esc(tlv.name)}」</button>`
      : `对应第 ${tlv.num} 站「${esc(tlv.name)}」`);
  }
  (c.dicts || []).slice(0, 1).forEach(t => {
    parts.push(`<button class="dict-link" data-action="dict-jump" data-t="${esc(t)}">词典 · ${esc(t)}</button>`);
  });
  return parts.join('　·　');
}
/* 「按概念找」入口面板：只列有对应内容的既有概念，不新增条目。
   jump 是页面内的动作名（自助 / 词典各自一套），不改变现有筛选结构。 */
function conceptStartPanel(title, sub, ids, action, collapsed) {
  const list = ids.map(id => GLOSSARY_BY_ID[id]).filter(g => g);
  const chips = list.map(g => {
    const tlv = LEVELS.find(l => l.id === conceptTeach(g));
    const uses = [
      (g.tools || []).length ? `${g.tools.length} 工具` : '',
      (g.dicts || []).length ? `${g.dicts.length} 词条` : '',
      (g.slowvars || []).length ? `${g.slowvars.length} 长期` : ''
    ].filter(Boolean).join(' · ');
    /* 每个概念直接标出：先依赖谁、教在第几站、被几处内容用到。 */
    return `<button class="concept-chip" data-action="${action}" data-id="${esc(g.id)}">
      <b>${esc(conceptName(g))}</b>
      <span>${esc(conceptRequires(g).map(r => conceptName(r)).join('、') || '起点')}</span>
      <em>${tlv ? `教在第 ${tlv.num} 站` : ''}${uses ? `　·　${uses}` : ''}</em></button>`;
  }).join('');
  /* 词典的 16 张概念卡曾把首屏占满，真正的 162 条词条被推到一屏之外：
     词典默认收起成一行的入口，工具箱 / 慢变量仍按原样平铺。 */
  if (collapsed) {
    return `<details class="concept-start concept-start-folded" aria-label="${esc(title)}">
      <summary><b>${esc(title)}</b><span class="muted">${list.length} 个概念 · 展开挑选</span></summary>
      <p class="muted sh-section-sub">${esc(sub)}</p>
      <div class="concept-start-grid">${chips}</div>
    </details>`;
  }
  return `<section class="concept-start" aria-label="${esc(title)}">
    <h3 class="sh-section-title">${esc(title)}</h3>
    <p class="muted sh-section-sub">${esc(sub)}</p>
    <div class="concept-start-grid">${chips}</div>
  </section>`;
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
    resetViewScroll();
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
    /* 可选钩子：只有词典传。概念簇把长分区切成几个可见的小台阶，
       标题由词条的簇起点派生，筛选时和分区标题一起收起。 */
    const cluster = cfg.clusterTitle ? cfg.clusterTitle(item) : '';
    lastCat = c;
    return head + cluster + cfg.card(item);
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
    ${cfg.notice ? `<p class="notice">${esc(cfg.notice)}</p>` : ''}
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
  resetViewScroll();
  applyLibraryFilter(cfg);
  stage.focus({ preventScroll: true });
}

function applyLibraryFilter(cfg) {
  const q = cfg.query ? cfg.query().trim().toLowerCase() : '';
  const cat = cfg.currentCat();
  /* 第三维筛选只有词典传；其余两个知识库保持「分类 + 搜索」两维，行为不变。 */
  const kind = cfg.queryKind ? cfg.queryKind() : 'all';
  const visibleByCat = new Map();
  const visibleByCluster = new Map();
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
      if (card.dataset.cluster) {
        visibleByCluster.set(card.dataset.cluster, (visibleByCluster.get(card.dataset.cluster) || 0) + 1);
      }
    }
  });
  /* 词典的分区标题跟着可见卡片走：某主题被筛空，标题也一起收起。 */
  document.querySelectorAll(`#${cfg.gridId} .dict-group-title`).forEach((h) => {
    const shown = visibleByCat.get(h.dataset.group) || 0;
    h.hidden = shown === 0;
    const badge = h.querySelector('.dict-group-count');
    if (badge) badge.textContent = `${shown} 条`;
  });
  /* 概念簇标题按簇内可见卡片收起；大组导语按整组可见数收起。
     两个库没有这两类元素，querySelectorAll 为空时行为完全不变。 */
  document.querySelectorAll(`#${cfg.gridId} .dict-cluster-title`).forEach((h) => {
    const shown = visibleByCluster.get(h.dataset.cluster) || 0;
    h.hidden = shown === 0;
    const badge = h.querySelector('.dict-cluster-count');
    if (badge) badge.textContent = `${shown} 条`;
  });
  document.querySelectorAll(`#${cfg.gridId} .dict-group-lead`).forEach((h) => {
    const shown = (h.dataset.groupLead || '').split('|').reduce((s, c) => s + (visibleByCat.get(c) || 0), 0);
    h.hidden = shown === 0;
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
   大组、主题、概念簇与类型全部定义在 content/dictionary.js 的 MI.dictionaryMeta，逻辑不另存一份。 */
/* 概念簇只声明「这一簇从哪条开始」，边界随词条数组顺序自动派生，
   数据里不重复存一份 162 条的名单；选簇起点时同时算出簇内条数。 */
const DICT_CAT_META = (DICT_META.catMeta) || {};
function dictClusterMap() {
  const map = new Map();
  DICT_CATS.forEach(c => {
    const starts = (DICT_CAT_META[c] || {}).clusters || [];
    const terms = DICTIONARY.filter(d => d.c === c).map(d => d.t);
    const groups = [];
    let cur = null;
    terms.forEach(t => {
      const hit = starts.find(x => x.start === t);
      if (hit) {
        cur = { name: hit.name, id: `${c}::${hit.name}`, terms: [] };
        groups.push(cur);
      }
      if (cur) cur.terms.push(t);
    });
    groups.forEach(g => g.terms.forEach((t, i) => map.set(t, {
      id: g.id, name: g.name, isStart: i === 0, count: g.terms.length
    })));
  });
  return map;
}
/* 五分钟起步路径：不新增筛选维度、不新增词条，只把已有词条按「先能判断 → 再能叫出感受 → 再能行动」串起来。 */
const DICT_START_PATH = [
  { t: '心理学', why: '这门学科在说什么' },
  { t: '相关不等于因果', why: '看到「研究发现」先问一句' },
  { t: '情绪', why: '先能叫出自己的感受' },
  { t: '情绪调节', why: '再说能做什么' },
  { t: '心理灵活性', why: '带着不舒服也能往前' }
];
function dictStartPathHtml() {
  return `<section class="dict-start-path" aria-label="五分钟起步路径">
    <h3 class="sh-section-title">第一次来？按这 ${DICT_START_PATH.length} 条读</h3>
    <p class="muted sh-section-sub">从「这门学科在说什么」走到「带着不舒服也能往前」。点一条直接展开它，不用从头翻 ${DICTIONARY.length} 条。</p>
    <ol class="dict-path-list">
      ${DICT_START_PATH.map((x, i) => `<li><button class="dict-path-btn" data-action="dict-jump" data-t="${esc(x.t)}" title="${esc(x.why)}"><span class="dict-path-num">${i + 1}</span><b>${esc(x.t)}</b></button></li>`).join('')}
    </ol>
  </section>`;
}
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
    ? '类型和主题可以叠着筛；也可以直接搜。'
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
  const clusterMap = dictClusterMap();
  const kindDesc = dictKind === 'all'
    ? '类型和主题可以叠着筛；也可以直接搜。'
    : ((DICT_KINDS.find(k => k.id === dictKind) || {}).desc || '');
  return {
    view: 'dict',
    ready: () => DICTIONARY.length > 0 && DICT_CATS.length > 0 && DICT_KINDS.length > 0,
    missingTitle: '词典内容没有加载出来',
    missingLead: '检查 index.html 是否在 library.js 之后、js/core.js 之前引入 content/dictionary.js。打开浏览器控制台可以看到具体是哪个文件 404。',
    eyebrow: `心理学词典 · ${DICTIONARY.length} 条 · ${DICT_GROUPS.length} 组 · ${DICT_CATS.length} 个主题`,
    title: '把常用的心理学词，说清楚一点',
    lead: `按「先看见自己的状态 → 再理解心智怎么运作 → 从自己走向他人 → 数字时代与证据素养」四组排。每组、每个主题都有一句导语，长主题再切成几个概念簇；也可以直接搜，或按主题 / 概念类型叠加筛选。只做科普，不提供诊断或个体化建议。`,
    nav: `<details class="dict-index">
      <summary>按组浏览 · ${DICT_GROUPS.length} 组 · 从「我此刻怎么了」开始</summary>
      <nav class="dict-nav" aria-label="本页目录">
        ${DICT_GROUPS.map((g, i) => `<a class="dict-nav-group" href="#dict-group-${esc(g.id)}"><b>第 ${i + 1} 组 · ${esc(g.name)}</b><em>${esc(g.desc)}</em><span>${(g.cats || []).reduce((s, c) => s + dictCountBy(d => d.c === c), 0)} 条</span></a>`).join('')}
      </nav>
    </details>`,
    search: `<div class="dict-controls">
      <label class="dict-search" for="dict-search">
        <span class="visually-hidden">搜索词条</span>
        <input id="dict-search" type="search" autocomplete="off" aria-controls="dict-grid" aria-describedby="dict-count" placeholder="搜名词、英文或释义，例如：依恋、FoMO" value="${esc(dictQuery)}">
      </label>
    </div>`,
    prelude: `${dictStartPathHtml()}
    ${conceptStartPanel(
      '按概念读',
      `${GLOSSARY.length} 个概念是站点、工具卡、词典共用的一套叫法。点一个，直接跳到它对应的已有词条；小字是它先依赖的概念。`,
      GLOSSARY.map(g => g.id),
      'dict-concept',
      true
    )}
    <section class="dict-start" aria-label="按概念类型筛选">
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
      const meta = DICT_CAT_META[c] || {};
      /* 大组导语只在每组第一个主题前出现；筛到整组为空时由 applyLibraryFilter 收起。 */
      const lead = first ? `<div class="dict-group-lead" data-group-lead="${esc((g.cats || []).join('|'))}">
        <span class="dict-group-kicker">第 ${DICT_GROUPS.indexOf(g) + 1} 组 · ${esc(g.name)}</span>
        <p>${esc(g.desc)}</p>
      </div>` : '';
      return `${lead}<h3 class="dict-group-title" id="${esc(id)}" data-group="${esc(c)}">
        <span class="dict-group-name">${esc(c)}</span>
        <span class="dict-group-meta">${esc(g.name || '')}</span>
        <span class="dict-group-count">${dictCountBy(d => d.c === c)} 条</span>
        ${meta.lead ? `<span class="dict-cat-lead">${esc(meta.lead)}</span>` : ''}
      </h3>`;
    },
    card(d) {
      const hay = [d.t, d.e, d.c, dictKindName(d.k), d.s, d.d, d.m || ''].join(' ').toLowerCase();
      /* 词条若挂到概念层，就在卡头标出概念名；不改变词条内容，只是多一条回链。 */
      const cc = conceptOfDict(d.t);
      const conceptBadge = cc ? `<span class="dict-concept-badge">概念 · ${esc(conceptName(cc))}</span>` : '';
      const cl = clusterMap.get(d.t);
      return `<details class="dict-card" data-term="${esc(d.t)}" data-cat="${esc(d.c)}" data-kind="${esc(d.k)}"${cl ? ` data-cluster="${esc(cl.id)}"` : ''} data-search="${esc(hay)}">
        <summary>
          <span class="dict-term">${esc(d.t)}</span>
          <span class="dict-en" lang="en">${esc(d.e)}</span>
          <span class="dict-short">${esc(d.s)}</span>
          <div class="dict-badges">
            <span class="dict-cat-badge">${esc(d.c)}</span>
            <span class="dict-kind-badge k-${esc(d.k)}">${esc(dictKindName(d.k))}</span>
            ${conceptBadge}
          </div>
        </summary>
        <div class="dict-detail">
          <p>${esc(d.d)}</p>
          ${d.m ? `<p class="dict-mis"><b>常见误解</b>${esc(d.m)}</p>` : ''}
          ${d.sos ? `<div class="dict-sos"><button class="help-btn" data-action="open-help">现在很难受？先缓一缓</button></div>` : ''}
          ${(d.r || []).length ? `<div class="dict-related"><b>接着看</b><div class="dict-related-links">${d.r.map(t => {
            const target = DICTIONARY.find(x => x.t === t);
            const cross = target && target.c !== d.c;
            return `<button class="dict-link${cross ? ' dict-link-cross' : ''}" data-action="dict-jump" data-t="${esc(t)}"${cross ? ` title="在「${esc(target.c)}」里"` : ''}>${esc(t)}</button>`;
          }).join('')}</div></div>` : ''}
        </div>
      </details>`;
    },
    clusterTitle(d) {
      const cl = clusterMap.get(d.t);
      if (!cl || !cl.isStart) return '';
      return `<h4 class="dict-cluster-title" data-cluster="${esc(cl.id)}" data-group="${esc(d.c)}">
        <span>${esc(cl.name)}</span><span class="dict-cluster-count">${cl.count} 条</span>
      </h4>`;
    },
    gridId: 'dict-grid', gridClass: '', cardClass: 'dict-card',
    catsId: 'dict-cats', catsClass: 'dict-cats', catsLabel: '按主题筛选', catsAction: 'dict-cat',
    currentCat: () => dictCat, query: () => dictQuery, queryKind: () => dictKind,
    active: dictFiltersActive, countText: dictCountText, syncSelection: syncDictSelection,
    countId: 'dict-count', unit: '条', idleHint: ' · 点卡片展开释义',
    emptyId: 'dict-empty', emptyText: '没有匹配的词条。换个关键词，或点「清空筛选」看看。',
    note: '词条按成人阅读深度编写；和孩子一起看时，挑他问到的那个就好。同一概念簇里的词按「先懂什么、再看什么」排，带小箭头的「接着看」会跳到别的主题。有争议的地方会写明边界，不把“研究平均”说成“对每个人都适用”。搜索与筛选只在当前页面内生效，不保存、不上传，返回地图也会清掉。'
  };
}
function renderDictionary() { renderLibraryView(dictView()); }
function applyDictFilter() { applyLibraryFilter(dictView()); }

