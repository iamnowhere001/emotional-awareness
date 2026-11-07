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
    missingLead: '检查 index.html 是否在 library.js 之后、js/core.js 之前引入 content/dictionary.js。打开浏览器控制台可以看到具体是哪个文件 404。',
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
    missingLead: '检查 index.html 是否在 selfhelp.js 之后、js/core.js 之前引入 content/slowvars.js。打开浏览器控制台可以看到具体是哪个文件 404。',
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
