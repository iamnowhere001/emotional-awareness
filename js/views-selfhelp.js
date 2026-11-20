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

