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

