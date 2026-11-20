/* js/actions-library.js · 知识库动作：词典 / 自助 / 慢变量 / 静修间的交互。
   由原 actions.js 拆分而来，向 actions-level.js 定义的主表追加动作。 */

/* 词典跳转的唯一实现：清空筛选、重建词典页、展开并聚焦目标卡。
   结果卡、概念入口、工具卡、图鉴都走这里，避免多处各写一遍「点了没反应」。 */
function jumpToDictTerm(term) {
  if (!DICTIONARY.some(d => d.t === term)) return;
  dictCat = 'all'; dictQuery = ''; dictKind = 'all';
  renderDictionary();
  const card = [...document.querySelectorAll('#dict-grid .dict-card')].find(c => c.dataset.term === term);
  if (!card) return;
  card.open = true;
  card.scrollIntoView({ block: 'center' });
  const summary = card.querySelector('summary');
  if (summary) summary.focus({ preventScroll: true });
}

Object.assign(ACTIONS, {
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
  'dict-jump': (el) => jumpToDictTerm(el.dataset.t),
  /* 概念入口：一个概念可能对应多条已有词条，先打开主锚点。 */
  'dict-concept': (el) => {
    const g = GLOSSARY_BY_ID[el.dataset.id];
    if (!g || !(g.dicts || []).length) return;
    jumpToDictTerm(g.dicts[0]);
  },
  /* 图鉴是弹窗：先关掉再进词典，避免词典渲染在遮罩后面。 */
  'open-dict-term': (el) => { closeModal(); jumpToDictTerm(el.dataset.t); },
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
  /* 按概念找工具：跳到该概念的第一张卡并展开；不改筛选，只是导航。 */
  'sh-concept': (el) => {
    const g = GLOSSARY_BY_ID[el.dataset.id];
    if (!g || !(g.tools || []).length) return;
    const term = g.tools[0];
    shState = null; shCat = 'all';
    renderSelfHelp();
    const card = [...document.querySelectorAll('#sh-grid .dict-card')].find(c => c.dataset.term === term);
    if (!card) return;
    card.open = true;
    card.scrollIntoView({ block: 'center' });
    const summary = card.querySelector('summary');
    if (summary) summary.focus({ preventScroll: true });
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
  /* 五件套 / 时间预算跳到某张练习卡：先确认那张卡在页面上。
     如果它被当前筛选藏起来了，就退回「全部」再展开——不给「点了没反应」的死路。 */
  'sv-card': (el) => {
    const t = el.dataset.t;
    const find = () => [...document.querySelectorAll('#sv-grid .dict-card')].find(c => c.dataset.term === t);
    const first = find();
    if (!first) return;
    if (first.hidden) {
      svVar = null; svCat = 'all';
      syncSvSelection();
    }
    const card = find();
    if (!card) return;
    card.open = true;
    card.scrollIntoView({ block: 'center' });
    const summary = card.querySelector('summary');
    if (summary) summary.focus({ preventScroll: true });
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
  'open-retreat': () => {
    if (!band().mindful) { session.tip = '静修间只在成年档开放，先回地图。'; renderMap(); return; }
    mdScene = 'all'; session.navDir = 'forward'; renderRetreatList();
  },
  'retreat-start': (el) => {
    if (!band().mindful) { session.tip = '静修间只在成年档开放，先回地图。'; renderMap(); return; }
    session.navDir = 'forward'; renderRetreatPractice(Number(el.dataset.i));
  },
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

  /* 静修间 2.0：场景筛选与 sit 引导；全部只在内存 */
  'md-list': () => { renderRetreatList(); },
  'md-scene': (el) => {
    const s = el.dataset.s || 'all';
    if (s !== 'all' && !MD_SCENES.some(x => x.id === s)) return;
    const y = window.scrollY;
    mdScene = s;
    renderRetreatList();
    /* 筛选不把人送回页首：重渲染后回到原来的滚动位置 */
    requestAnimationFrame(() => { try { window.scrollTo(0, y); } catch (e) { /* noop */ } });
  },
  'md-start': (el) => {
    if (!band().mindful) { session.tip = '静修间只在成年档开放，先回地图。'; renderMap(); return; }
    const id = el.dataset.id;
    if (!MD_PRACTICE_BY_ID[id]) return;
    session.navDir = 'forward';
    renderMeditatePractice(id);
  },
  'md-next': () => {
    if (!play || play.type !== 'sit') return;
    play.step += 1;
    paintSit();
  },
  'md-stop': () => {
    if (!play || play.type !== 'sit') return;
    finishSit(true);
  },
  'md-intent': () => {
    if (!play || play.type !== 'sit' || !MD_INTENTS.length) return;
    play.intent = (play.intent + 1) % MD_INTENTS.length;
    const t = document.getElementById('md-intent-text');
    if (t) t.textContent = (MD_INTENTS[play.intent] || {}).t || '';
  },

});
