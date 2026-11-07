/* 浏览器回归用例：由 scripts/regression.mjs 注入到 index.html 之后执行。
   两个 <script> 同为经典脚本，共享全局词法环境，可以直接读写 script.js 的顶层变量。
   全部逻辑放在 load 回调里，避免顶层声明和主脚本撞名。 */

window.addEventListener('load', function () {
  const lines = [];
  let failed = 0;
  const A = (cond, msg) => { if (!cond) throw new Error(msg || '断言失败'); };
  const test = (name, fn) => {
    try { fn(); lines.push('PASS · ' + name); }
    catch (e) { lines.push('FAIL · ' + name + ' → ' + (e && e.message ? e.message : String(e))); failed++; }
  };
  const bandTo = id => { state.band = id; applySettings(); };
  const goLevel = i => { state.levelIndex = i; renderLevel(); };
  const byType = t => LEVELS.findIndex(l => l.type === t);
  const count = o => Object.values(o).reduce((s, a) => s + a.length, 0);

  /* ---------- 内容与加载 ---------- */
  test('内容文件全部加载（CONTENT_OK）', () => A(CONTENT_OK === true));
  test('5 个年龄段', () => A(AGE_BANDS.length === 5));
  test('两条轨各 17 站 / 4 岛', () => {
    A(KID.levels.length === 17 && ADULT.levels.length === 17);
    A(KID.islands.length === 4 && ADULT.islands.length === 4);
  });
  test('题库变体 91 + 32', () => A(count(BANK) === 91 && count(BANK_ADULT) === 32));
  test('两轨 id 不重叠，终章都在最后', () => {
    const kidIds = new Set(KID.levels.map(l => l.id));
    A(ADULT.levels.every(l => !kidIds.has(l.id)));
    A(KID.levels[16].type === 'finale' && ADULT.levels[16].type === 'finale');
  });
  test('静修 10 个 / 漂流瓶 16 题', () => A(RETREAT.length === 10 && BOTTLES.length === 16));
  test('静修每个练习都有状态分组与所需字段', () => {
    const moods = ['现在很烦', '现在很累', '睡不着', '心里空'];
    A(RETREAT.every(r => moods.includes(r.mood) && r.when && r.name && r.intro));
    A(new Set(RETREAT.map(r => r.id)).size === RETREAT.length);
  });
  test('心理学词典数量不设上限，主题 / 类型 / 关联都由元数据约束', () => {
    A(DICTIONARY.length >= 100);
    A(new Set(DICTIONARY.map(d => d.t)).size === DICTIONARY.length);
    A(DICTIONARY.every(d => d.t && d.e && d.c && d.k && d.s && d.d));
    const cats = MI.dictionaryMeta.groups.flatMap(g => g.cats);
    const kinds = MI.dictionaryMeta.kinds.map(k => k.id);
    A(new Set(DICTIONARY.map(d => d.c)).size === cats.length);
    A(DICTIONARY.every(d => cats.includes(d.c) && kinds.includes(d.k)));
    A(DICTIONARY.every(d => !d.r || (d.r.length && d.r.every(r => r !== d.t && DICTIONARY.some(x => x.t === r)))));
  });
  test('心理学词典可搜索、可按分类筛选', () => {
    bandTo('a6');
    ACTIONS['open-dictionary']();
    A(session.view === 'dict');
    const cards = [...document.querySelectorAll('#dict-grid .dict-card')];
    A(cards.length === DICTIONARY.length);
    const input = document.getElementById('dict-search');
    dictQuery = '依恋'; input.value = dictQuery;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const hit = cards.filter(c => !c.hidden);
    A(hit.length >= 2 && hit.every(c => c.dataset.search.includes('依恋')));
    dictQuery = ''; input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const catBtn = [...document.querySelectorAll('#dict-cats .dict-cat')].find(b => b.dataset.c === '关系与沟通');
    A(!!catBtn);
    catBtn.click();
    const rel = cards.filter(c => !c.hidden);
    A(rel.length === DICTIONARY.filter(d => d.c === '关系与沟通').length
      && rel.every(c => c.dataset.cat === '关系与沟通'));
    dictQuery = ''; dictCat = 'all'; dictKind = 'all'; renderMap();
  });
  test('词典按大组分区，分组标题、目录锚点与分类计数齐全', () => {
    bandTo('a6');
    ACTIONS['open-dictionary']();
    const groups = MI.dictionaryMeta.groups;
    const catCount = groups.flatMap(g => g.cats).length;
    const heads = [...document.querySelectorAll('#dict-grid .dict-group-title')];
    A(heads.length === catCount, `分区标题应有 ${catCount} 个，实际 ${heads.length}`);
    A(heads.every(h => h.dataset.group && !h.hidden && h.querySelector('.dict-group-count').textContent.includes('条')));
    const navs = [...document.querySelectorAll('.dict-nav a')];
    A(navs.length === groups.length);
    A(navs.every(a => !!document.querySelector(a.getAttribute('href'))), '每个目录锚点都要指向真实分区');
    A(document.querySelectorAll('#dict-cats .dict-cat-num').length === catCount + 1);
    renderMap();
  });
  test('词典可按概念类型筛选，并与主题、搜索叠加，清空后复原', () => {
    bandTo('a6');
    ACTIONS['open-dictionary']();
    const kindBtn = [...document.querySelectorAll('#dict-kinds .dict-kind-btn')].find(b => b.dataset.k === 'frontier');
    A(!!kindBtn);
    kindBtn.click();
    const cards = [...document.querySelectorAll('#dict-grid .dict-card')];
    const shown = cards.filter(c => !c.hidden);
    A(shown.length === DICTIONARY.filter(d => d.k === 'frontier').length
      && shown.every(c => c.dataset.kind === 'frontier'));
    A(kindBtn.classList.contains('on') && kindBtn.getAttribute('aria-pressed') === 'true');
    A(document.getElementById('dict-count').textContent.includes('当代议题'));
    A(!document.getElementById('dict-reset').hidden);
    const byCat = {};
    shown.forEach(c => { byCat[c.dataset.cat] = (byCat[c.dataset.cat] || 0) + 1; });
    A([...document.querySelectorAll('#dict-grid .dict-group-title')].every(h => {
      const n = byCat[h.dataset.group] || 0;
      return h.hidden === (n === 0) && h.querySelector('.dict-group-count').textContent === `${n} 条`;
    }), '分区标题的条数要跟着可见卡片走');
    const catBtn = [...document.querySelectorAll('#dict-cats .dict-cat')].find(b => b.dataset.c === '数字生活与注意力');
    catBtn.click();
    const both = cards.filter(c => !c.hidden);
    A(both.length === DICTIONARY.filter(d => d.k === 'frontier' && d.c === '数字生活与注意力').length
      && both.every(c => c.dataset.kind === 'frontier' && c.dataset.cat === '数字生活与注意力'));
    const input = document.getElementById('dict-search');
    dictQuery = 'FoMO'; input.value = dictQuery;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const hit = cards.filter(c => !c.hidden);
    A(hit.length === 1 && hit[0].dataset.term === '错失恐惧');
    A(document.getElementById('dict-count').textContent.includes('「FoMO」'));
    document.getElementById('dict-reset').click();
    A([...document.querySelectorAll('#dict-grid .dict-card')].every(c => !c.hidden));
    A(document.getElementById('dict-reset').hidden);
    A(dictKind === 'all' && dictCat === 'all' && dictQuery === ''
      && document.getElementById('dict-search').value === '');
    renderMap();
  });
  test('词典卡片带类型角标与「接着看」，跳转会清筛选并展开目标', () => {
    bandTo('a6');
    ACTIONS['open-dictionary']();
    A(document.querySelectorAll('#dict-grid .dict-kind-badge').length === DICTIONARY.length);
    A(document.querySelectorAll('#dict-grid .dict-related').length === DICTIONARY.filter(d => d.r && d.r.length).length);
    [...document.querySelectorAll('#dict-kinds .dict-kind-btn')].find(b => b.dataset.k === 'method').click();
    const first = [...document.querySelectorAll('#dict-grid .dict-card')].find(c => !c.hidden && c.querySelector('.dict-link'));
    A(!!first);
    const target = first.querySelector('.dict-link').dataset.t;
    first.querySelector('.dict-link').click();
    A(dictCat === 'all' && dictKind === 'all' && dictQuery === '');
    const targetCard = [...document.querySelectorAll('#dict-grid .dict-card')].find(c => c.dataset.term === target);
    A(!!targetCard && targetCard.open);
    A([...document.querySelectorAll('#dict-grid .dict-card')].every(c => !c.hidden));
    renderMap();
  });
  test('重新进入词典会清空主题、类型与搜索词', () => {
    bandTo('a6');
    ACTIONS['open-dictionary']();
    const input = document.getElementById('dict-search');
    dictQuery = '依恋'; input.value = dictQuery;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    [...document.querySelectorAll('#dict-cats .dict-cat')].find(b => b.dataset.c === '关系与沟通').click();
    [...document.querySelectorAll('#dict-kinds .dict-kind-btn')].find(b => b.dataset.k === 'core').click();
    A(dictQuery === '依恋' && dictCat === '关系与沟通' && dictKind === 'core');
    ACTIONS['go-map']();
    ACTIONS['open-dictionary']();
    A(dictQuery === '' && dictCat === 'all' && dictKind === 'all');
    A(document.getElementById('dict-search').value === '');
    A([...document.querySelectorAll('#dict-grid .dict-card')].every(c => !c.hidden));
    renderMap();
  });
  test('词典页确实有且只有一个搜索框，只做本地过滤', () => {
    bandTo('a6');
    ACTIONS['open-dictionary']();
    const inputs = document.querySelectorAll('#stage input');
    A(inputs.length === 1, `词典页应有 1 个输入框，实际 ${inputs.length}`);
    A(inputs[0].id === 'dict-search' && inputs[0].type === 'search');
    A(inputs[0].getAttribute('autocomplete') === 'off');
    A(inputs[0].getAttribute('aria-controls') === 'dict-grid');
    A(!!document.querySelector('#stage .module-foot [data-action="go-map"]'), '长列表底部应有回到地图');
    renderMap();
  });
  test('自助工具箱 5 状态 / 32 工具 / 10 条认知扭曲', () => {
    A(SH_STATES.length === 5);
    A(SH_TOOLS.length === 32);
    A(SH_DISTORTIONS.length === 10);
    A(SH_TOOLS.every(t => t.t && t.e && t.c && t.when && t.note && Array.isArray(t.how) && t.how.length >= 2));
    A(new Set(SH_TOOLS.map(t => t.t)).size === 32);
    A(SH_STATES.every(s => s.moves.length >= 3 && s.lead && s.avoid));
  });
  test('自助工具箱：状态面板与分类筛选', () => {
    bandTo('a6');
    ACTIONS['open-selfhelp']();
    A(session.view === 'selfhelp');
    const stateBtn = document.querySelector('#sh-states .sh-state[data-id="drained"]');
    A(!!stateBtn);
    stateBtn.click();
    const panel = document.getElementById('sh-state-panel');
    A(panel.querySelectorAll('.sh-move').length === 3);
    A(panel.textContent.includes('先把消耗降下来'));
    const cards = [...document.querySelectorAll('#sh-grid .sh-card')];
    A(cards.length === 32);
    const cat = [...document.querySelectorAll('#sh-cats .dict-cat')].find(b => b.dataset.c === '心力恢复');
    A(!!cat);
    cat.click();
    const shown = cards.filter(c => !c.hidden);
    A(shown.length === 8 && shown.every(c => c.dataset.cat === '心力恢复'));
    shCat = 'all'; shState = null; renderMap();
  });

  test('慢变量 6 个变量 / 12 张练习 / 10 个陷阱 / 3 个尺度', () => {
    A(SV_VARS.length === 6);
    A(SV_PRACTICES.length === 12);
    A(SV_TRAPS.length === 10);
    A(SV_HORIZONS.length === 3);
    A(SV_VARS.every(v => v.id && v.name && v.sub && v.lead && v.why && v.misuse && v.check && v.move && v.move.t && v.move.d));
    A(new Set(SV_VARS.map(v => v.id)).size === 6);
    A(SV_PRACTICES.every(p => p.t && p.e && p.v && p.when && p.note && Array.isArray(p.how) && p.how.length >= 2));
    A(SV_PRACTICES.every(p => SV_VARS.some(v => v.id === p.v)), '每张练习卡都要挂在合法变量上');
    A(SV_VARS.every(v => SV_PRACTICES.some(p => p.v === v.id)), '每个变量至少要有一张练习卡');
    A(new Set(SV_PRACTICES.map(p => p.t)).size === 12);
    A(!SV_PRACTICES.some(p => SV_VARS.some(v => v.name === p.t)), '练习卡不应与慢变量重名');
    A(SV_HORIZONS.every(h => h.t && h.d && Array.isArray(h.asks) && h.asks.length >= 2 && Array.isArray(h.cards) && h.cards.length));
    A(SV_HORIZONS.every(h => h.cards.every(c => SV_PRACTICES.some(p => p.t === c))), '尺度引用必须指向真实练习卡');
    A(!SV_TRAPS.some(t => t.t === '用情绪代替事实'), '与自助认知扭曲重复的陷阱应已替换');
  });
  test('慢变量：变量面板、分类联动与清选', () => {
    bandTo('a6');
    ACTIONS['open-slowvars']();
    A(session.view === 'slowvars');
    A(svVar === null && svCat === 'all', '每次进入都应是干净状态');
    const varBtn = document.querySelector('#sv-vars .sv-var[data-id="health"]');
    A(!!varBtn);
    varBtn.click();
    const panel = document.getElementById('sv-panel');
    A(panel.querySelectorAll('.sv-row').length === 4);
    A(panel.textContent.includes('先固定一个起床时间'));
    A(panel.querySelector('.sv-jump a[href="#sv-practices"]') !== null, '面板要有到练习卡的跳转出口');
    A(svVar === 'health' && svCat === 'health', '选变量应联动筛选');
    const catOn = [...document.querySelectorAll('#sv-cats .dict-cat.on')];
    A(catOn.length === 1 && catOn[0].dataset.c === 'health', '分类按钮应同步高亮');
    const cards = [...document.querySelectorAll('#sv-grid .sv-card')];
    A(cards.length === 12);
    let shown = cards.filter(c => !c.hidden);
    A(shown.length === 3 && shown.every(c => c.dataset.cat === 'health'), '应只留健康底盘的 3 张卡');
    A(document.getElementById('sv-count').textContent.includes('3 / 12'));
    const craftCat = [...document.querySelectorAll('#sv-cats .dict-cat')].find(b => b.dataset.c === 'craft');
    A(!!craftCat);
    craftCat.click();
    A(svVar === 'health' && svCat === 'craft', '手动切分类不应清掉变量面板');
    A(panel.querySelectorAll('.sv-row').length === 4, '面板不应被重建');
    shown = cards.filter(c => !c.hidden);
    A(shown.length === 2 && shown.every(c => c.dataset.cat === 'craft'));
    document.querySelector('[data-action="sv-var-clear"]').click();
    A(svVar === null && svCat === 'all');
    A(cards.every(c => !c.hidden), '清选后应恢复 12 张');
    A(panel.querySelector('.sv-hint') !== null);
    A(document.getElementById('sv-count').textContent.includes('12 张'));
  });
  test('慢变量：非法 id 不改变状态、重新进入清空选择', () => {
    ACTIONS['open-slowvars']();
    document.querySelector('#sv-vars .sv-var[data-id="health"]').click();
    const before = document.getElementById('sv-panel').textContent;
    ACTIONS['sv-var']({ dataset: { id: 'not-a-var' } });
    A(svVar === 'health' && svCat === 'health');
    A(document.getElementById('sv-panel').textContent === before, '非法 id 不应清空面板');
    ACTIONS['open-slowvars']();
    A(svVar === null && svCat === 'all', '重新进入应清空上次选择');
    A([...document.querySelectorAll('#sv-grid .sv-card')].every(c => !c.hidden));
    renderMap();
  });
  test('慢变量：页内目录、尺度引用与无障碍', () => {
    ACTIONS['open-slowvars']();
    const nav = [...document.querySelectorAll('.sv-nav a')];
    A(nav.length === 4);
    A(nav.every(a => {
      const href = a.getAttribute('href') || '';
      return href.startsWith('#') && document.getElementById(href.slice(1));
    }), '目录每一项都要有对应锚点');
    A(document.querySelectorAll('#sv-horizons .sv-horizon-link').length === 3);
    A(document.querySelectorAll('#sv-traps .sv-trap').length === 10);
    A(document.getElementById('sv-panel').getAttribute('aria-live') === 'polite');
    renderMap();
  });

  /* ---------- 存档与迁移 ---------- */
  test('v2 旧档迁移到 v4，3-5 改名 finale，旧键保留', () => {
    for (const k of ['mood-island-v4', 'mood-island-v3', 'mood-island-v2']) localStorage.removeItem(k);
    localStorage.setItem('mood-island-v2', JSON.stringify({
      band: 'a6', cleared: ['1-1', '3-5'], shells: 4, cards: ['觉察']
    }));
    state = load();
    A(state.version === 4);
    A(state.cleared.includes('finale') && !state.cleared.includes('3-5'));
    A(localStorage.getItem('mood-island-v2') !== null);
    A(state.cards.kid.includes('觉察') && state.cards.adult.length === 0, '旧档词卡应只进儿童轨');
  });
  test('旧档同名卡按通关证据归轨，不虚增成年档', () => {
    const kid = migrate({ version: 3, band: 'a6', cleared: ['1-1'], cards: ['觉察'] });
    A(kid.cards.kid.includes('觉察') && kid.cards.adult.length === 0);
    const adult = migrate({ version: 3, band: 'adult', cleared: ['A1-1'], cards: ['觉察'] });
    A(adult.cards.adult.includes('觉察') && adult.cards.kid.length === 0, '只玩过成年档时不应把卡算进儿童档');
    const bothNoEvidence = migrate({ version: 3, band: 'adult', cleared: ['1-1', 'A1-1'], awarded: ['1-1'], cards: ['身体信号'] });
    A(bothNoEvidence.cards.kid.includes('身体信号') && !bothNoEvidence.cards.adult.includes('身体信号'),
      '两轨都无法判定时应保守归儿童档');
  });
  test('跨轨同名词卡不互相解锁', () => {
    state.cards = { kid: ['觉察'], adult: [] };
    bandTo('adult');
    A(cardsInTrack().length === 0, '儿童档收集的卡不应出现在成年图鉴');
    bandTo('a6');
    A(cardsInTrack().includes('觉察'));
  });
  test('坏存档回落默认值，不抛错', () => {
    const s = migrate(null);
    A(s.version === 4 && Array.isArray(s.cleared) && Array.isArray(s.cards.kid));
  });
  test('v4 新键损坏时回退到 v3 旧档', () => {
    for (const k of ['mood-island-v4', 'mood-island-v3', 'mood-island-v2']) localStorage.removeItem(k);
    localStorage.setItem('mood-island-v4', '{broken');
    localStorage.setItem('mood-island-v3', JSON.stringify({ version: 3, band: 'a6', cleared: ['1-1'], cards: ['觉察'] }));
    state = load();
    A(state.version === 4 && state.cleared.includes('1-1') && state.cards.kid.includes('觉察'));
  });
  test('save 写入 v4 新键', () => {
    save();
    const raw = localStorage.getItem('mood-island-v4');
    A(!!raw && JSON.parse(raw).version === 4 && Array.isArray(JSON.parse(raw).cards.kid));
  });
  test('v4 档字段非法时逐项回落到安全值', () => {
    const s = migrate({
      version: 4, band: 'adult',
      cleared: ['1-1', '1-1', 'ghost', 7],
      awarded: ['A1-1', 'nope'],
      cards: { kid: ['觉察', '不存在的卡', 7], adult: ['身体信号'] },
      skills: ['注意到自己有感觉', '不存在的本领', 7],
      shells: -3,
      decor: ['2', 99, 1, 1, 4],
      settings: { scale: 99, motion: 'yes', speak: false, contrast: 1 }
    });
    A(s.cleared.length === 1 && s.cleared[0] === '1-1');
    A(s.awarded.length === 1 && s.awarded[0] === 'A1-1');
    A(s.cards.kid.length === 1 && s.cards.kid[0] === '觉察');
    A(s.cards.adult.length === 1 && s.cards.adult[0] === '身体信号');
    A(s.skills.length === 1 && s.skills[0] === '注意到自己有感觉');
    A(s.shells === 0);
    A(s.decor.length === 2 && s.decor.join(',') === '1,4', '装饰下标应去重并限定在 DECOR 范围内');
    A(s.settings.scale === 1 && s.settings.motion === true && s.settings.speak === false && s.settings.contrast === true);
  });
  test('清空本机进度会连旧键一起删掉，不会回退复活', () => {
    localStorage.setItem('mood-island-v3', JSON.stringify({ version: 3, band: 'a6', cleared: ['1-1'] }));
    localStorage.setItem('mood-island-v2', JSON.stringify({ band: 'a6', cleared: ['1-1'] }));
    state.band = 'a6';
    state.settings = { ...DEFAULT_STATE.settings };
    state.cleared = ['1-1'];
    state.shells = 4;
    ACTIONS['clear-progress-confirm']();
    A(!localStorage.getItem('mood-island-v3') && !localStorage.getItem('mood-island-v2'));
    const saved = JSON.parse(localStorage.getItem('mood-island-v4'));
    A(saved.cleared.length === 0 && saved.shells === 0 && saved.cards.kid.length === 0);
    A(state.band === 'a6', '清空进度不应丢年龄段');
  });

  /* ---------- 双轨 ---------- */
  test('切到成年档重绑 LEVELS', () => {
    bandTo('adult');
    A(LEVELS === ADULT.levels && TOTAL === 17 && isAdultTrack());
  });
  test('切回儿童档重绑 LEVELS', () => {
    bandTo('a6');
    A(LEVELS === KID.levels && TOTAL === 17 && !isAdultTrack());
  });
  test('进度按当前轨分开计数', () => {
    state.cleared = ['1-1', 'A1-1', 'A1-2'];
    bandTo('a6'); A(clearedInTrack() === 1);
    bandTo('adult'); A(clearedInTrack() === 2);
  });
  test('贝壳显示由 bands.shells 决定', () => {
    bandTo('a6'); updateTopbar();
    A(document.getElementById('shell-count').hidden === false);
    bandTo('adult'); updateTopbar();
    A(document.getElementById('shell-count').hidden === true);
  });
  test('两轨本领名不重复，清单只算当前轨', () => {
    const kidSkills = KID.levels.map(l => l.skill).filter(Boolean);
    const adultSkills = ADULT.levels.map(l => l.skill).filter(Boolean);
    const overlap = adultSkills.filter(s => kidSkills.includes(s));
    A(overlap.length === 0, '两轨出现同名本领：' + overlap.join(' / '));
    state.skills = [kidSkills[0]];
    bandTo('adult'); openSkills();
    A(overlay.querySelector('.modal-title').textContent.includes('0 /'), '成年清单不应把儿童本领算进来');
    closeModal();
    bandTo('a6'); openSkills();
    A(overlay.querySelector('.modal-title').textContent.includes('1 /'), '儿童清单应认出自己的本领');
    closeModal();
    state.skills = [];
  });
  test('restart-all 只清当前轨', () => {
    state.cleared = ['1-1', '1-2', 'A1-1'];
    bandTo('a6');
    ACTIONS['restart-all']();
    A(!state.cleared.includes('1-1') && state.cleared.includes('A1-1'));
  });
  test('换档 / 重开提示只出现一次，不串到下一屏', () => {
    bandTo('a6'); state.cleared = [];
    session.tip = '地图上的提示';
    renderMap();
    A(document.getElementById('stage').innerHTML.includes('地图上的提示'));
    A(session.tip === '', '地图渲染后应消费掉提示');
    renderHome();
    A(!document.getElementById('stage').innerHTML.includes('地图上的提示'), '提示不应再次出现在首页');
    session.tip = '首页的提示';
    renderHome();
    A(document.getElementById('stage').innerHTML.includes('首页的提示') && session.tip === '');
  });

  /* ---------- 解锁规则 ---------- */
  test('第一岛四站全开', () => {
    bandTo('a6'); state.cleared = [];
    A([0, 1, 2, 3].every(i => isUnlocked(i)));
  });
  test('岛 2 初始锁定', () => A(isUnlocked(4) === false));
  test('走过岛 1 收尾站后开放岛 2', () => {
    state.cleared = [KID.levels[3].id];
    A(isUnlocked(4) === true);
  });
  test('终章需走完全部 16 站', () => {
    A(isUnlocked(16) === false);
    state.cleared = KID.levels.slice(0, 16).map(l => l.id);
    A(isUnlocked(16) === true);
  });
  test('地图锁定文案与规则一致', () => {
    state.cleared = [];
    renderMap();
    const h = document.getElementById('stage').innerHTML;
    A(!h.includes('先走完上一座岛') && h.includes('先把上一座岛走到头'));
  });
  test('地图入口按用途分组，不再是一排等权重按钮', () => {
    state.cleared = [];
    bandTo('adult');
    renderMap();
    A(document.querySelectorAll('#stage .map-hub .hub-card').length === 8);
    A(!!document.querySelector('#stage .map-hub .hub-help'), '急救入口应在地图「随时可用」组里');
    A(document.querySelectorAll('#stage .map-tools').length === 0);
    const heads = [...document.querySelectorAll('#stage .hub-head h3')].map(e => e.textContent.trim());
    A(heads.includes('随时可用') && heads.includes('知识与工具') && heads.includes('这一趟的收集'));
  });
  test('地图只标一个下一站，岛头显示走过站数', () => {
    state.cleared = [];
    renderMap();
    const next = [...document.querySelectorAll('#stage .node.next')];
    A(next.length === 1 && next[0].dataset.i === '0', '空白进度只应点亮第一站');
    A(next[0].textContent.includes('下一站'));
    A(document.querySelectorAll('#stage .island-count').length === 4);
    A(document.getElementById('stage').textContent.includes('0 / 4 站'));
  });
  test('首页保留单一主 CTA，知识入口是低权重快捷', () => {
    bandTo('a6');
    renderHome();
    A(document.querySelectorAll('#stage .actions .btn-primary').length === 1);
    A(document.querySelectorAll('#stage .home-shortcuts .btn-read').length === 3);
  });

  /* ---------- 急救入口 ---------- */
  test('急救入口常驻顶栏，两轨措辞不同', () => {
    const btn = document.getElementById('help-entry');
    A(!!btn && btn.dataset.action === 'open-help', '顶栏需要有常驻入口');
    bandTo('a6'); renderHome();
    A(btn.textContent === '现在有点难受', `6-9 档应显示「现在有点难受」，实际「${btn.textContent}」`);
    ['a3', 'a9'].forEach(id => {
      bandTo(id); renderHome();
      A(btn.textContent === '现在有点难受');
    });
    bandTo('adult'); renderHome();
    A(btn.textContent === '现在很难受');
    bandTo('all'); renderHome();
    A(btn.textContent === '现在很难受', '亲子档走成人口径');
  });
  test('首页首屏有急救卡片，点击进入急救视图', () => {
    bandTo('adult'); renderHome();
    A(!!document.querySelector('#stage .help-entry'), '首页应有急救卡片');
    /* 真的点顶栏按钮：走 document 级事件代理，验证 data-action 真的接上了 */
    document.getElementById('help-entry').click();
    A(session.view === 'help' && session.helpFrom === 'home');
    A(document.getElementById('progress-wrap').hidden === true, '急救页不显示关卡进度');
    A(document.querySelectorAll('#stage .help-action').length === 3);
    A(document.querySelectorAll('#stage .help-word').length === 8);
    A(document.querySelectorAll('#stage .help-num').length === 3);
  });
  test('急救入口返回进入前那一屏（按钮与 Esc）', () => {
    bandTo('adult'); renderHome();
    ACTIONS['open-help'](); ACTIONS['help-close']();
    A(session.view === 'home');
    renderMap();
    ACTIONS['open-help']();
    A(session.helpFrom === 'map');
    ACTIONS['help-close']();
    A(session.view === 'map', '从地图进入应回到地图');
    ACTIONS['open-help']();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    A(session.view === 'map', 'Esc 应回到地图');
    /* 关卡里也能开急救：返回必须回到同一站、同一道题，不能重新抽题或跳回首页 */
    goLevel(0);
    const vBefore = play.v;
    ACTIONS['open-help']();
    A(session.helpFrom === 'level', '应记下来源是关卡');
    A(document.querySelector('#stage [data-action="help-close"]').textContent === '回到刚才那一站');
    ACTIONS['help-close']();
    A(session.view === 'level' && play.v === vBefore, '返回关卡应沿用同一道题');
    ACTIONS['open-help']();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    A(session.view === 'level' && play.v === vBefore, 'Esc 也应回到同一道题');
    /* 只读模块里同样回到原页，筛选不丢 */
    ACTIONS['open-dictionary']();
    ACTIONS['open-help']();
    A(session.helpFrom === 'dict');
    ACTIONS['help-close']();
    A(session.view === 'dict', '从词典进入应回到词典');
    renderHome();
  });
  test('儿童档只给「找一个大人」，成人口径给出本地求助信息', () => {
    bandTo('a6'); ACTIONS['open-help']();
    const kidText = document.getElementById('stage').textContent;
    A(kidText.includes('找一个大人') && !kidText.includes('12356'), '儿童档不应出现热线号码');
    bandTo('adult'); ACTIONS['open-help']();
    const adultText = document.getElementById('stage').textContent;
    A(adultText.includes('12356') && adultText.includes('12355'));
    A(adultText.includes('不是心理咨询') && adultText.includes('不承诺效果') && adultText.includes('不能代替专业帮助'));
    A(!/诊断|治疗方案/.test(adultText), '求助信息不做诊断或疗效承诺');
  });
  test('三个动作都能在本页走完，且不写入存档', () => {
    localStorage.removeItem(STORAGE_KEY);
    bandTo('adult'); renderHome();
    const before = localStorage.getItem(STORAGE_KEY);
    ACTIONS['open-help']();
    ACTIONS['help-ground']();
    A(document.getElementById('help-ground-done').hidden === false);
    document.querySelectorAll('#stage .help-word')[0].click();
    A(helpWord === '紧' && document.getElementById('help-picked').textContent.includes('「紧」'));
    document.querySelectorAll('#stage .help-word')[1].click();
    A(helpWord === '闷' && document.querySelectorAll('#stage .help-word')[1].classList.contains('on'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    A(helpWord === '紧', '数字键应能选第 1 个词');
    A(!!document.querySelector('#stage [data-action="help-speak"]'), '「读给我听」应可用');
    A(localStorage.getItem(STORAGE_KEY) === before, '急救页不应写入存档');
    ACTIONS['help-close']();
    ACTIONS['open-help']();
    A(helpWord === null && document.getElementById('help-ground-done').hidden === true, '重新进入应回到干净状态');
    ACTIONS['help-close']();
  });

  /* ---------- 玩法与洗牌 ---------- */
  test('clue 选项渲染时会洗牌', () => {
    bandTo('a6');
    const i = byType('clue');
    const pos = new Set();
    for (let k = 0; k < 12; k++) {
      goLevel(i);
      const b = document.querySelector('#stage .opt[data-orig="0"]');
      if (b) pos.add(b.dataset.i);
    }
    A(pos.size >= 2, '12 次渲染里原始第 0 项始终在同一位置');
  });
  test('洗牌后点原始答案仍能通关', () => {
    goLevel(byType('clue'));
    const b = document.querySelector(`#stage .opt[data-orig="${play.v.answer}"]`);
    A(!!b, '找不到正确项');
    b.click();
    A(play.done === true);
  });
  test('compose 首行选项会换顺序 / 换变体', () => {
    const i = byType('compose'), first = new Set();
    for (let k = 0; k < 10; k++) {
      goLevel(i);
      const c = document.querySelector('#stage .compose-row .word-chip');
      if (c) first.add(c.textContent.trim());
    }
    A(first.size >= 2);
  });
  test('ladder 任挑一档都能完成', () => {
    goLevel(byType('ladder'));
    const rung = document.querySelector('#stage .rung');
    A(!!rung);
    rung.click();
    A(document.getElementById('rung-result').innerHTML.trim().length > 0);
  });
  test('选项徽标是数字，且与 1–9 键盘一致', () => {
    bandTo('a6'); goLevel(byType('clue'));
    const opts = [...document.querySelectorAll('#stage .opt')];
    A(opts.length > 0 && opts.length <= 9);
    A(opts.every((b, i) => b.querySelector('.opt-key').textContent.trim() === String(i + 1)), '徽标应与数字键一致');
    A(opts[0].getAttribute('aria-keyshortcuts') === '1');
    const before = document.getElementById('feedback-slot').innerHTML;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    A(document.getElementById('feedback-slot').innerHTML !== before, '按 1 应当选中第一个选项');
  });
  test('字母键不会选中选项（徽标只对应数字）', () => {
    bandTo('a6'); goLevel(byType('clue'));
    const before = document.getElementById('feedback-slot').innerHTML;
    ['a', 'b', 'c', 'A'].forEach(key => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
    A(document.getElementById('feedback-slot').innerHTML === before, '字母键不应触发任何选项');
  });
  test('completeLevel 默认转义纯文本', () => {
    bandTo('a6'); goLevel(byType('weather'));
    play.done = false;
    completeLevel('<b>不是标签</b><img src=x onerror=1>');
    const main = document.querySelector('.result-main');
    A(!!main);
    A(main.textContent.includes('<b>不是标签</b>'), '文本应原样显示');
    A(!main.querySelector('b') && !main.querySelector('img'), '不应把内容执行成 HTML');
  });
  test('completeLevel 收掉呼吸计时器', () => {
    bandTo('a6'); goLevel(byType('weather'));
    play.done = false; play.running = true;
    breathTimer = setInterval(() => {}, 10000);
    completeLevel('测试');
    A(breathTimer === null && play.running === false);
  });
  test('儿童终章有布置小岛，成年终章没有', () => {
    bandTo('a6');
    state.cleared = KID.levels.slice(0, 16).map(l => l.id);
    goLevel(16);
    A(document.getElementById('stage').innerHTML.includes('island-canvas'));
    bandTo('adult');
    state.cleared = ADULT.levels.slice(0, 16).map(l => l.id);
    goLevel(16);
    const h = document.getElementById('stage').innerHTML;
    A(!h.includes('island-canvas') && !h.includes('decor-slot'));
  });

  /* ---------- 弹窗与无障碍 ---------- */
  test('弹窗用 aria-labelledby 指向标题，Tab 焦点不跑出去', () => {
    openModal('<div class="modal-title">测试弹窗</div><button>一</button><button>二</button>');
    const modal = overlay.querySelector('.modal');
    const labelId = modal.getAttribute('aria-labelledby');
    A(!!labelId && labelId !== 'aria-label');
    const titleEl = modal.querySelector('#' + labelId);
    A(!!titleEl && titleEl.textContent.trim() === '测试弹窗', 'aria-labelledby 应指向真正的标题元素');
    A(!modal.hasAttribute('aria-label'), '有标题时不应再挂通用 aria-label');
    A(!!modal.querySelector('.modal-close'), '弹窗应有一个可见的关闭按钮');
    A(document.body.classList.contains('modal-open'), '弹窗打开时应锁住背景滚动');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    A(overlay.contains(document.activeElement));
    closeModal();
    A(!document.body.classList.contains('modal-open'));
  });
  test('无标题弹窗退回通用 aria-label', () => {
    openModal('<p>没有标题</p><button>好</button>');
    A(overlay.querySelector('.modal').getAttribute('aria-label') === '对话框');
    closeModal();
  });
  test('#overlay 不再整体 aria-live 播报', () => {
    A(!overlay.hasAttribute('aria-live'));
  });
  test('进度格只有当前一站带 aria-current', () => {
    bandTo('a6');
    const i = byType('clue');
    goLevel(i);
    const steps = [...document.querySelectorAll('#step-track .step')];
    A(steps.length === 17);
    const cur = steps.filter(s => s.getAttribute('aria-current') === 'step');
    A(cur.length === 1 && Number(cur[0].dataset.i) === i, '只应标出当前这一站');
    renderMap();
    A(document.querySelectorAll('#step-track [aria-current]').length === 0);
  });
  test('记忆牌有可读的状态标签', () => {
    bandTo('adult');
    goLevel(byType('memory'));
    const before = [...document.querySelectorAll('#memo-grid .memo-card')];
    A(before.length > 0);
    A(before.every(c => c.getAttribute('aria-label')));
    const hidden = before.find(c => c.getAttribute('aria-label') === '未翻开的记忆牌');
    A(!!hidden, '初始应有未翻开的记忆牌');
    hidden.click();
    const after = [...document.querySelectorAll('#memo-grid .memo-card')];
    A(after.some(c => c.getAttribute('aria-label').startsWith('已翻开：')));
    A(document.getElementById('memo-progress').getAttribute('aria-live') === 'polite');
  });
  test('英文词条标注 lang="en"', () => {
    bandTo('adult');
    ACTIONS['open-dictionary']();
    const dictEns = [...document.querySelectorAll('#dict-grid .dict-en')];
    A(dictEns.length === DICTIONARY.length && dictEns.every(e => e.getAttribute('lang') === 'en'));
    ACTIONS['open-selfhelp']();
    A([...document.querySelectorAll('#sh-grid .dict-en')].every(e => e.getAttribute('lang') === 'en'));
    ACTIONS['open-slowvars']();
    A([...document.querySelectorAll('#sv-grid .dict-en')].every(e => e.getAttribute('lang') === 'en'));
    renderMap();
  });
  test('两轨岛末站都发放今日微行动，终章不发放', () => {
    bandTo('a6');
    state.levelIndex = KID.levels.findIndex(l => l.id === '4-4');
    renderLevel();
    session.clearedThisRun = 0;
    completeLevel('测试');
    A(document.getElementById('feedback-slot').textContent.includes('今日微行动'));
    bandTo('adult');
    state.levelIndex = ADULT.levels.findIndex(l => l.id === 'A4-4');
    renderLevel();
    session.clearedThisRun = 0;
    completeLevel('测试');
    A(document.getElementById('feedback-slot').textContent.includes('今日微行动'));
    bandTo('a6');
    goLevel(16);
    session.clearedThisRun = 0;
    completeLevel('测试');
    A(!document.getElementById('feedback-slot').textContent.includes('今日微行动'));
  });
  test('进度格点击区不小于 30px', () => {
    bandTo('a6'); renderMap();
    const s = document.querySelector('.step');
    A(!!s && s.getBoundingClientRect().height >= 30);
  });

  /* ---------- 静修间扩容 ---------- */
  test('静修列表按 4 个状态分组，共 10 张卡', () => {
    bandTo('adult'); renderRetreatList();
    A(document.querySelectorAll('#stage .retreat-group-title').length === 4);
    A(document.querySelectorAll('#stage .retreat-card').length === RETREAT.length);
    A(document.getElementById('stage').innerHTML.includes(`${RETREAT.length} 个可以随时停下的小练习`));
  });
  test('10 个练习都能进入，且各自索引正确', () => {
    for (let i = 0; i < RETREAT.length; i++) {
      renderRetreatPractice(i);
      A(play.retreatIndex === i, `第 ${i + 1} 个练习索引错`);
      A(document.getElementById('stage').innerHTML.length > 100);
    }
  });
  test('space 练习「再做一次」指向自身', () => {
    const i = RETREAT.findIndex(r => r.type === 'space');
    renderRetreatPractice(i);
    play.step = play.data.steps.length;
    paintSpace();
    const btn = document.querySelector('#retreat-result [data-action="retreat-start"]');
    A(!!btn && Number(btn.dataset.i) === i);
  });
  test('ground 练习「再来一次」指向自身', () => {
    const i = RETREAT.findIndex(r => r.type === 'ground');
    renderRetreatPractice(i);
    play.data.rows.forEach((row, ri) => {
      const chip = document.querySelector(`#stage .ground-row[data-row="${ri}"] .word-chip`);
      A(!!chip); chip.click();
    });
    const btn = document.querySelector('#retreat-result [data-action="retreat-start"]');
    A(!!btn && Number(btn.dataset.i) === i);
  });

  /* ---------- 漂流瓶 ---------- */
  test('漂流瓶换一题不会连续重复', () => {
    const qs = [];
    for (let k = 0; k < 14; k++) {
      openBottle();
      qs.push(document.querySelector('#overlay .modal-body p').textContent.trim());
    }
    closeModal();
    A(qs.every((q, k) => k === 0 || q !== qs[k - 1]));
    A(new Set(BOTTLES.map(b => b.q)).size === BOTTLES.length);
  });

  /* ---------- 隐私模式写入失败（放后面，避免影响前面的存档用例） ---------- */
  test('写入失败时出现常驻提示，不再静默吞掉', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
    try { save(); } finally { Storage.prototype.setItem = orig; }
    A(storageWritable === false);
    const warn = document.getElementById('storage-warning');
    A(!!warn && warn.textContent.includes('不能保存数据'));
  });
  test('设置页明确说明当前无法保存', () => {
    openSettings();
    A(overlay.innerHTML.includes('当前浏览器无法保存数据'));
    closeModal();
    const warn = document.getElementById('storage-warning');
    if (warn) warn.remove();
    storageWritable = true;
  });

  /* ---------- 红线与布局 ---------- */
  test('关卡页没有自由文本输入框（滑杆除外）', () => {
    bandTo('a6');
    goLevel(byType('slider'));
    A(document.querySelectorAll('textarea, input:not([type="range"])').length === 0);
  });
  test('回归视口为真 390×900（iframe，不受无头窗口钳制）', () => {
    A(window.innerWidth === 390, `innerWidth=${window.innerWidth}`);
    A(window.innerHeight >= 800, `innerHeight=${window.innerHeight}`);
  });
  test('390px 视口无横向溢出', () => {
    bandTo('a6');
    renderMap();
    A(document.documentElement.scrollWidth <= window.innerWidth + 1,
      `地图 scrollWidth=${document.documentElement.scrollWidth} innerWidth=${window.innerWidth}`);
    const hubCols = getComputedStyle(document.querySelector('.hub-grid')).gridTemplateColumns.split(' ').length;
    A(hubCols === 1, `地图入口卡在 390px 应为单列，实际 ${hubCols} 列`);
    A([...document.querySelectorAll('.hub-card')].every(c => c.getBoundingClientRect().height >= 44));
    ACTIONS['open-dictionary']();
    A(document.documentElement.scrollWidth <= window.innerWidth + 1,
      `词典 scrollWidth=${document.documentElement.scrollWidth} innerWidth=${window.innerWidth}`);
    const cols = getComputedStyle(document.getElementById('dict-grid')).gridTemplateColumns.split(' ').length;
    A(cols === 1, `词典在 390px 应为单列，实际 ${cols} 列`);
    ACTIONS['open-selfhelp']();
    A(document.documentElement.scrollWidth <= window.innerWidth + 1,
      `自助 scrollWidth=${document.documentElement.scrollWidth} innerWidth=${window.innerWidth}`);
    const shCols = getComputedStyle(document.getElementById('sh-grid')).gridTemplateColumns.split(' ').length;
    A(shCols === 1, `自助工具在 390px 应为单列，实际 ${shCols} 列`);
    const stateCols = getComputedStyle(document.getElementById('sh-states')).gridTemplateColumns.split(' ').length;
    A(stateCols === 1, `状态按钮在 390px 应为单列，实际 ${stateCols} 列`);
    ACTIONS['open-slowvars']();
    A(document.documentElement.scrollWidth <= window.innerWidth + 1,
      `慢变量 scrollWidth=${document.documentElement.scrollWidth} innerWidth=${window.innerWidth}`);
    const svCols = getComputedStyle(document.getElementById('sv-grid')).gridTemplateColumns.split(' ').length;
    A(svCols === 1, `慢变量卡在 390px 应为单列，实际 ${svCols} 列`);
    const svVarCols = getComputedStyle(document.getElementById('sv-vars')).gridTemplateColumns.split(' ').length;
    A(svVarCols === 1, `慢变量按钮在 390px 应为单列，实际 ${svVarCols} 列`);
    const svHorizonCols = getComputedStyle(document.querySelector('.sv-horizons')).gridTemplateColumns.split(' ').length;
    A(svHorizonCols === 1, `时间尺度在 390px 应为单列，实际 ${svHorizonCols} 列`);
    const svTrapCols = getComputedStyle(document.querySelector('.sv-traps')).gridTemplateColumns.split(' ').length;
    A(svTrapCols === 1, `快变量陷阱在 390px 应为单列，实际 ${svTrapCols} 列`);
    bandTo('adult');
    ACTIONS['open-help']();
    A(document.documentElement.scrollWidth <= window.innerWidth + 1,
      `急救页 scrollWidth=${document.documentElement.scrollWidth} innerWidth=${window.innerWidth}`);
    A([...document.querySelectorAll('.help-word')].every(b => b.getBoundingClientRect().height >= 44));
    renderMap();
  });

  const pre = document.createElement('pre');
  pre.id = '__e2e_result__';
  pre.style.display = 'none';
  pre.textContent = JSON.stringify({ total: lines.length, failed, lines });
  /* 用例跑在固定 390×900 的 iframe 里（绕开 Chrome 无头的 500px 钳制），
     结果写回父页面，--dump-dom 才能读到。 */
  const host = (window.parent && window.parent !== window) ? window.parent.document : document;
  let out = host.getElementById('__e2e_result__');
  if (!out) { out = pre; host.body.appendChild(out); }
  out.textContent = pre.textContent;
});
