/* js/views-library.js · 知识库视图：公共骨架、心理学词典、自助工具箱、慢变量、静修练习。
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
    missingLead: '检查 index.html 是否在 dictionary.js 之后、js/core.js 之前引入 content/selfhelp.js。打开浏览器控制台可以看到具体是哪个文件 404。',
    eyebrow: '自助工具箱 · 心力与认知',
    title: '先恢复一点力气，再换一个看法',
    lead: `${SH_STATES.length} 种“现在最像”的状态、${SH_TOOLS.length} 张工具卡、${SH_DISTORTIONS.length} 条认知扭曲速查。全部是选择式或阅读式，不填心情文字，也不记录你选了什么。`,
    safety: SH_SAFETY,
    prelude: `<section class="sh-section">
      <h3 class="sh-section-title">现在最像哪一种？</h3>
      <p class="muted sh-section-sub">不用选得很准，挑一个最接近的就好。选完只看这一组建议，不做测试，也不打分。</p>
      ${states}
      <div id="sh-state-panel" aria-live="polite">${shState ? shStatePanel(shState) : `<p class="sh-hint">${esc(SH_HINT)}</p>`}</div>
    </section>
    ${conceptStartPanel(
      '按概念找工具',
      '如果你已经知道自己要练哪一个动作，直接从概念进：点一个概念，跳到它对应的第一张工具卡。',
      GLOSSARY.filter(g => g.tools.length).map(g => g.id),
      'sh-concept'
    )}`,
    items: SH_TOOLS,
    catOf: t => t.c,
    /* 卡片按主题分区显示：31 张不再是一堵平铺的墙，分区标题在筛选时一起收起。 */
    groupTitle(c) {
      return `<h3 class="dict-group-title" data-group="${esc(c)}">
        <span class="dict-group-name">${esc(c)}</span>
        <span class="dict-group-count">${SH_TOOLS.filter(t => t.c === c).length} 张</span>
      </h3>`;
    },
    card(t) {
      /* 卡头统一带一句边界；有对应概念的工具再标出它属于哪个概念（同一概念两轨共用）。 */
      const meta = `<span class="dict-rule-badge">自助练习，不是治疗</span>`;
      const c = conceptOfTool(t.t);
      const conceptBadge = c ? `<span class="dict-concept-badge">概念 · ${esc(isAdultTrack() ? c.adult : c.kid)}</span>` : '';
      /* 机制与规格来自概念层：同一动作在多张卡里只解释一次。 */
      const mech = c ? `<div class="sh-mech"><b>为什么可能有用</b><p>${esc(c.mechanism)}</p>
        <p class="muted">动作规格 · ${esc(conceptSpec(c))}</p>
        <p class="sh-refs">${conceptRefLinks(c)}</p></div>` : '';
      return howCard(t, 'sh-card', t.c, null, meta + conceptBadge, mech);
    },
    sectionClass: 'sh-section', sectionTitle: '工具卡',
    sectionTitleClass: 'sh-section-title', sectionSub: '自助练习，不是治疗。按主题分区，点开看「怎么做」「提醒」和「为什么可能有用」。',
    sectionSubClass: 'sh-section-sub',
    gridId: 'sh-grid', gridClass: 'sh-grid', cardClass: 'sh-card',
    catsId: 'sh-cats', catsClass: 'sh-cats', catsLabel: '按主题筛选自助工具', catsAction: 'sh-cat',
    currentCat: () => shCat,
    countId: 'sh-count', unit: '张', idleHint: ' · 点卡片展开',
    emptyId: 'sh-empty', emptyText: '这一类暂时没有卡片。点「全部」看看。',
    epilogue: `<section class="sh-section">
      <h3 class="sh-section-title">认知扭曲速查</h3>
      <p class="muted sh-section-sub">给想法起个名字，通常能让人和它拉开一点距离。标签是为了松绑，不是给自己扣帽子。这 ${SH_DISTORTIONS.length} 条是想法层的；节奏层的 ${SV_TRAPS.length} 条「快变量陷阱」在慢变量页。<button class="link-btn" data-action="open-slowvars">去慢变量页</button></p>
      <div class="sh-dist-grid">${SH_DISTORTIONS.map(d => `<div class="sh-dist">
        <b>${esc(d.t)}</b><span>${esc(d.d)}</span><em>${esc(d.eg)}</em></div>`).join('')}</div>
    </section>`,
    note: '自助适合日常调节，不替代专业帮助。如果困扰持续数周、明显影响生活，或出现伤害自己的念头，请尽快联系专业人士或当地急救。选择和搜索都不会被保存。'
  };
}
function renderSelfHelp() { renderLibraryView(selfHelpView()); }
function applyShFilter() { applyLibraryFilter(selfHelpView()); }

/* ---------------------------------------------------------------- 慢变量
   两层：方向层（6 个慢变量：为什么值得养）+ 日常层（五件套：今天做多少）。
   只做阅读与选择，不打卡、不打分、不落盘；日常层给的是最小剂量，不是目标剂量。 */
function svPanel(id) {
  const v = SV_VARS.find(x => x.id === id);
  if (!v) return '';
  /* 五件套与变量的对应也来自数据（daily[].v），面板只做展示，不另写一张对照表。 */
  const daily = SV_DAILY.filter(d => d.v === id);
  return `<div class="sv-panel">
    <div class="sv-panel-head"><b>${esc(v.name)}</b><span>${esc(v.sub)}</span><p>${esc(v.lead)}</p></div>
    <div class="sv-rows">
      <div class="sv-row"><b>为什么慢</b><p>${esc(v.why)}</p></div>
      <div class="sv-row"><b>常见误用</b><p>${esc(v.misuse)}</p></div>
      <div class="sv-row sv-row-move"><b>可以先做</b><p><strong>${esc(v.move.t)}</strong> ${esc(v.move.d)}</p></div>
      <div class="sv-row"><b>不用什么衡量</b><p>${esc(v.check)}</p></div>
    </div>
    ${daily.length ? `<p class="sv-panel-daily"><b>日常对应</b>${daily.map(d =>
      `<a href="#sv-daily">${esc(d.name)}</a>`).join('')}</p>` : ''}
    <button class="btn-read" data-action="sv-var-clear">换一个慢变量</button>
    <p class="sv-jump">选好了就往下看相关的练习 · <a href="#sv-practices">去练习卡</a></p>
  </div>`;
}
/* 五件套的出口只有两条：指向页内练习卡，或直接进静修间的引导练习。
   两种情况都靠数据里的 link 声明，不在视图里硬编码「冥想 = 静修间」。 */
function svDailyLink(d) {
  const l = d.link || {};
  if (l.kind === 'md' && MD_PRACTICE_BY_ID[l.id]) {
    /* 静修间只在成年档开放：低龄档连入口都不渲染，与 md-start 的动作层门禁一致，
       避免「看得见、点进去又被带回地图」。 */
    if (!band().mindful) return '';
    const p = MD_PRACTICE_BY_ID[l.id];
    return `<button class="btn-read" data-action="md-start" data-id="${esc(l.id)}">进静修间 · ${esc(p.name)}（${esc(p.minutes)}）</button>`;
  }
  if (l.kind === 'card' && SV_PRACTICES.some(p => p.t === l.id)) {
    return `<button class="link-btn" data-action="sv-card" data-t="${esc(l.id)}">看练习卡 · ${esc(l.id)}</button>`;
  }
  return '';
}
function svDailyCard(d) {
  return `<article class="sv-daily-card" data-daily="${esc(d.id)}">
    <div class="sv-daily-head"><b>${esc(d.name)}</b><span lang="en">${esc(d.e)}</span></div>
    <p class="sv-daily-sub">${esc(d.sub)}</p>
    <dl class="sv-dose">
      <div><dt>最小剂量</dt><dd>${esc(d.dose.min)}</dd></div>
      <div><dt>标准版</dt><dd>${esc(d.dose.std)}</dd></div>
      <div><dt>放在</dt><dd>${esc(d.when)}</dd></div>
    </dl>
    <p class="sv-daily-why">${esc(d.why)}</p>
    <p class="sv-daily-line"><b>再降一级</b>${esc(d.cut)}</p>
    <p class="sv-daily-line"><b>断了</b>${esc(d.broken)}</p>
    <div class="sv-daily-foot">${svDailyLink(d)}</div>
  </article>`;
}

function svVarName(id) {
  const v = SV_VARS.find(x => x.id === id);
  return v ? v.name : id;
}

function slowVarsView() {
  const vars = `<div class="sv-vars" id="sv-vars">
    ${SV_VARS.map(v => `<button class="sv-var ${svVar === v.id ? 'on' : ''}" data-action="sv-var" data-id="${esc(v.id)}">
      <b>${esc(v.name)}</b><span>${esc(v.sub)}</span><em>${SV_PRACTICES.filter(p => p.v === v.id).length} 张练习</em></button>`).join('')}
  </div>`;
  return {
    view: 'slowvars',
    ready: () => SV_VARS.length > 0 && SV_PRACTICES.length > 0,
    missingTitle: '慢变量内容没有加载出来',
    missingLead: '检查 index.html 是否在 selfhelp.js 之后、js/core.js 之前引入 content/slowvars.js。打开浏览器控制台可以看到具体是哪个文件 404。',
    eyebrow: '慢变量 · 在快时代里养底盘',
    title: '有些东西，值得慢慢养',
    lead: `${SV_VARS.length} 个慢变量管方向，${SV_DAILY.length} 件日常管今天：早起、冥想、阅读、写作、运动。另有 ${SV_PRACTICES.length} 张练习卡、${SV_BUDGET.length} 档可用时间、${SV_TRAPS.length} 个快变量陷阱、${SV_HORIZONS.length} 个时间尺度。没有打卡，也不问你做到了多少。`,
    /* 这一页写的是三观 / 十年视角 / 就医体检，更多是给大人看的：
       只在 3-6 / 6-12 两档于页头补一句，亲子与成年档保持原样。纯渲染层，不动数据。 */
    notice: isKidTone() ? '这一页更多写给大人；孩子可以先去玩主线' : '',
    nav: `<details class="sv-index">
      <summary>本页目录 · ${SV_VARS.length} 个慢变量 + ${SV_DAILY.length} 件日常</summary>
      <nav class="sv-nav" aria-label="本页目录">
        <a href="#sv-var-section">选一个慢变量</a>
        <a href="#sv-daily">日常五件套</a>
        <a href="#sv-budget">按可用时间挑</a>
        <a href="#sv-practices">练习卡</a>
        <a href="#sv-horizons">三个时间尺度</a>
        <a href="#sv-traps">快变量陷阱</a>
      </nav>
    </details>`,
    safety: SV_SAFETY,
    prelude: `<section class="sv-section" id="sv-var-section">
      <h3 class="sv-section-title">你现在最想稳住哪一块？</h3>
      <p class="muted sv-section-sub">不用选得很准；选一个最接近的，看看它为什么慢、可以先做什么。</p>
      ${vars}
      <div id="sv-panel" aria-live="polite" data-var="${esc(svVar || '')}">${svVar ? svPanel(svVar) : `<p class="sv-hint">${esc(SV_HINT)}</p>`}</div>
    </section>
    <section class="sv-section" id="sv-daily">
      <h3 class="sv-section-title">日常五件套</h3>
      <p class="muted sv-section-sub">早起、冥想、阅读、写作、运动。它们不产出结果，只把底盘的日常维护压到「今天也能做完」的量：每件都给了最小剂量和再降一级，做不到标准版就从最小剂量开始，断了不用补、不累计天数。</p>
      <div class="sv-daily">${SV_DAILY.map(svDailyCard).join('')}</div>
      <div class="sv-budget" id="sv-budget">
        <h4 class="sv-budget-title">今天只有这么多时间？</h4>
        <p class="muted sv-section-sub">按时长挑一张卡，够用就停。不用把几个 2 分钟攒成一次 30 分钟，也不用拿短时段证明自己不够努力。</p>
        <div class="sv-budget-grid">${SV_BUDGET.map(b => `<div class="sv-budget-card">
          <b>${esc(b.t)}</b><p>${esc(b.d)}</p>
          <div class="sv-budget-picks">${b.picks.map(t =>
            `<button class="link-btn" data-action="sv-card" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        </div>`).join('')}</div>
      </div>
    </section>`,
    items: SV_PRACTICES,
    catOf: p => p.v,
    catName: id => svVarName(id),
    /* 练习卡按变量分区：不再平铺，选变量后只留下对应分区。 */
    groupTitle(c) {
      return `<h3 class="dict-group-title" data-group="${esc(c)}">
        <span class="dict-group-name">${esc(svVarName(c))}</span>
        <span class="dict-group-count">${SV_PRACTICES.filter(p => p.v === c).length} 张</span>
      </h3>`;
    },
    card(p) {
      /* 有些练习在静修间里已有逐步引导：卡片不重写步骤，只给一个入口。
         入口 id 写在数据里（practices[].md），视图不认识「哪个练习属于冥想」。 */
      /* 同 svDailyLink：低龄档不渲染进静修间的入口，只保留卡片本身的说明。 */
      const md = band().mindful && p.md ? MD_PRACTICE_BY_ID[p.md] : null;
      const detail = md ? `<div class="sv-md-entry"><b>静修间有引导</b>
        <p>${esc(md.name)} · ${esc(md.minutes)}，逐步走，随时可以停。</p>
        <button class="btn-read" data-action="md-start" data-id="${esc(md.id)}">进静修间做这一张</button></div>` : '';
      return howCard(p, 'sv-card', p.v, svVarName(p.v), '', detail);
    },
    sectionClass: 'sv-section', sectionId: 'sv-practices', sectionTitle: '慢变量练习卡',
    sectionTitleClass: 'sv-section-title', sectionSub: `${SV_PRACTICES.length} 张练习按 ${SV_VARS.length} 个变量分区；选上面的慢变量会自动筛到相关分区，也可以自己按变量挑。每张卡是能单独做完的动作，不必凑齐。`,
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
      <p class="muted sv-section-sub">不是要你消灭快变量，而是别让它们替你决定长期方向。这 ${SV_TRAPS.length} 条是节奏层的；想法层的 ${SH_DISTORTIONS.length} 条认知扭曲在自助工具箱。<button class="link-btn" data-action="open-selfhelp">去工具箱</button></p>
      <div class="sv-traps">${SV_TRAPS.map(t => `<div class="sv-trap">
        <b>${esc(t.t)}</b><span>${esc(t.d)}</span><em>${esc(t.eg)}</em></div>`).join('')}</div>
    </section>`,
    note: '选中的慢变量和分类只在本次打开期间有效，返回地图就会清掉，也不会被保存。五件套不记次数、不记连续天数，页面也不保存你点过哪一张。身体或情绪上的持续不适，请找医生或专业支持。'
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

function renderRetreatPractice(i, resumePlay) {
  clearAsyncTimers(); stopSpeech();
  session.view = 'retreat'; session.retreatStep = i;
  const r = RETREAT[i];
  if (!r) { renderRetreatList(); return; }
  /* 从急救页返回时沿用同一份进行态：不重新抽 defuse 变体、不重置 ground / space 的进度。 */
  play = resumePlay || { type: r.type, data: r, tries: 0, done: false, retreatIndex: i };
  let body = '';
  if (r.type === 'ground') {
    if (!resumePlay) play.picks = r.rows.map(() => null);
    body = `<div class="ground-rows">${r.rows.map((row, ri) =>
      `<div class="ground-row" data-row="${ri}"><div class="compose-label">${esc(row.label)}</div>
        <div class="compose-choices">${row.choices.map((c, ci) =>
          `<button class="word-chip" data-action="ground-pick" data-row="${ri}" data-i="${ci}">${esc(c)}</button>`).join('')}</div></div>`).join('')}</div>
      <div id="retreat-result"></div>`;
  } else if (r.type === 'defuse') {
    if (!resumePlay) {
      play.v = rand(r.variants);
      play.opts = shuffled(withIndex(play.v.options));
    }
    body = `${scenarioBox('脑子里冒出来的那句话', play.v.thought)}
      <div class="opt-grid">${play.opts.map(({ v: o, i }, k) => optBtn(k, o.t, o.d, 'defuse-pick', i)).join('')}</div>
      <div id="retreat-result"></div>
      <div class="actions"><button class="btn btn-secondary" data-action="defuse-reroll">换一句</button></div>`;
  } else {
    if (!resumePlay) play.step = 0;
    body = `<div id="space-body"></div><div id="retreat-result"></div>`;
  }
  /* 静修练习复用概念层的机制与规格：三种题型各对到一个概念，不新增解释文本。 */
  const rc = conceptOfRetreat(r);
  const conceptBlock = rc ? `<div class="retreat-concept">
    <b>对应概念 · ${esc(conceptName(rc))}</b>
    <p>${esc(rc.mechanism)}</p>
    <p class="muted">动作规格 · ${esc(conceptSpec(rc))}</p>
    <p class="sh-refs">${conceptRefLinks(rc)}</p>
  </div>` : '';
  stage.innerHTML = `<div class="view">
    <div class="toolbar">${bandChip('<span class="muted">静修间</span>')}
      <button class="btn-read" data-action="md-list">换一个练习</button>
      <button class="btn-read" data-action="go-map">结束，回地图</button></div>
    <h2>${esc(r.name)}</h2>
    <p class="level-goal">${esc(r.sub)}　·　${esc(r.intro)}</p>
    ${retreatSafety()}
    ${conceptBlock}
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

/* ---------------------------------------------------------------- 静修间 2.0 · sit 引导
   逐步文字，不计时、不显示剩余秒数；每一步都能「先停在这儿」。
   结束页只做机制归因与一句 if-then，不显示次数 / 天数 / 时长。 */
function renderMeditatePractice(id, resumePlay) {
  clearAsyncTimers(); stopSpeech();
  const p = MD_PRACTICE_BY_ID[id];
  if (!p) { renderRetreatList(); return; }
  const f = MD_FAMILY_BY_ID[p.family] || {};
  session.view = 'retreat'; session.retreatStep = -1;
  /* 从急救页返回时沿用同一份进行态：paintSit() 按 play.step 重画，
     不重新抽题、不退回第一步；只在内存，不写存档。 */
  play = resumePlay || { type: 'sit', data: p, family: f, step: 0, done: false, stopped: false, intent: 0 };
  const rc = conceptOfMeditate(p);
  const conceptBlock = `<div class="retreat-concept">
    <b>${esc(f.name || '这一步在做什么')}</b>
    <p class="muted">什么时候不做 · ${esc(f.notFor || '不舒服就停')}</p>
    <p class="muted">${esc(p.minutes)} · 不用计时，随时可以停</p>
    ${rc ? `<p class="sh-refs">${conceptRefLinks(rc)}</p>` : ''}
  </div>`;
  stage.innerHTML = `<div class="view">
    <div class="toolbar">${bandChip('<span class="muted">静修间</span>')}
      <button class="btn-read" data-action="md-list">换一个练习</button>
      <button class="btn-read" data-action="go-map">结束，回地图</button></div>
    <h2>${esc(p.name)}</h2>
    <p class="level-goal">${esc(p.sub)}　·　${esc(p.intro)}</p>
    ${conceptBlock}
    <div class="play-area" style="margin-top:20px"><div id="sit-body"></div><div id="retreat-result"></div></div>
    ${retreatSafety()}
    <div id="feedback-slot" aria-live="polite"></div>
  </div>`;
  paintSit();
  updateTopbar();
  stage.focus({ preventScroll: true });
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* noop */ }
}

function paintSit() {
  const p = play.data, s = play.step;
  const box = document.getElementById('sit-body');
  if (!box) return;
  if (s >= p.steps.length) { finishSit(false); return; }
  const st = p.steps[s];
  const pacer = (play.family && play.family.id === 'breath')
    ? `<div class="md-pacer" aria-hidden="true"><div class="breath-ring running"></div><p>圆变大时吸气，变小时呼气；不跟也可以。</p></div>`
    : '';
  box.innerHTML = `<div class="space-card md-step">
      <span class="space-label">${esc(st.label)}</span>
      <p>${esc(st.text)}</p>
    </div>
    ${pacer}
    <div class="space-dots">${p.steps.map((x, i) => `<span class="space-dot ${i < s ? 'done' : i === s ? 'current' : ''}"></span>`).join('')}</div>
    <div class="actions">
      <button class="btn btn-primary" data-action="md-next">${s === p.steps.length - 1 ? '做完这一步' : '继续'}</button>
      <button class="btn btn-ghost" data-action="md-stop">先停在这儿</button>
    </div>`;
  const res = document.getElementById('retreat-result');
  if (res) res.innerHTML = '';
}

function finishSit(stopped) {
  const p = play.data, f = play.family || {};
  play.done = true; play.stopped = !!stopped;
  const box = document.getElementById('sit-body');
  const res = document.getElementById('retreat-result');
  if (box) box.innerHTML = `<div class="space-card"><span class="space-label">${stopped ? '停在这里' : '做完了'}</span><p>${esc(p.close)}</p></div>`;
  if (!res) return;
  if (stopped) {
    res.innerHTML = `<div class="feedback good"><p>停在这里也可以，不用补上。</p>
      <div class="actions" style="margin-top:12px">
        <button class="btn btn-secondary" data-action="md-start" data-id="${esc(p.id)}">再做一次</button>
        <button class="btn btn-ghost" data-action="md-list">换一个练习</button>
        <button class="btn btn-ghost" data-action="go-map">回地图</button>
      </div></div>`;
    return;
  }
  const byFamily = MD_INTENTS.findIndex(x => x.family === p.family);
  const byScene = MD_INTENTS.findIndex(x => x.scene === 'all' || (p.scenes || []).includes(x.scene));
  play.intent = byFamily >= 0 ? byFamily : (byScene >= 0 ? byScene : 0);
  const intent = (MD_INTENTS[play.intent] || {}).t || '';
  res.innerHTML = `<div class="feedback good">
    <p><b>你刚刚做的是</b>：${esc(f.mechanism || '')}</p>
    <p class="muted" style="margin-top:8px">不用评价做得好不好，也不用延长。</p>
    <div class="md-intent"><span class="md-intent-kicker">带回一句</span><p id="md-intent-text">${esc(intent)}</p>
      <button class="btn-read" data-action="md-intent">换一句</button></div>
    <div class="actions" style="margin-top:12px">
      <button class="btn btn-secondary" data-action="md-start" data-id="${esc(p.id)}">再做一次</button>
      <button class="btn btn-ghost" data-action="md-list">换一个练习</button>
      <button class="btn btn-ghost" data-action="go-map">回地图</button>
    </div></div>`;
}
