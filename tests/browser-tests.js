/* 浏览器回归用例：由 scripts/regression.mjs 注入到 index.html 之后执行。
   同为经典脚本，与 js/*.js 共享全局词法环境，可以直接读写 js/core.js 的顶层变量。
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
  const goLevel = i => { session.levelIndex = i; renderLevel(); };
  const byType = t => LEVELS.findIndex(l => l.type === t);
  const count = o => Object.values(o).reduce((s, a) => s + a.length, 0);

  /* ---------- 内容与加载 ---------- */
  test('内容文件全部加载（CONTENT_OK）', () => A(CONTENT_OK === true));
  test('4 个年龄段，6-12 岁合并档带深度层', () => {
    A(AGE_BANDS.length === 4);
    const b = AGE_BANDS.find(x => x.id === 'a6');
    A(b && b.name === '6-12 岁' && b.tiers === true);
    A(!AGE_BANDS.some(x => x.id === 'a9'));
  });
  test('两条轨各 21 站 / 5 岛', () => {
    A(KID.levels.length === 21 && ADULT.levels.length === 21);
    A(KID.islands.length === 5 && ADULT.islands.length === 5);
  });
  test('题库变体 111 + 44', () => A(count(BANK) === 111 && count(BANK_ADULT) === 44));
  test('两轨 id 不重叠，终章都在最后', () => {
    const kidIds = new Set(KID.levels.map(l => l.id));
    A(ADULT.levels.every(l => !kidIds.has(l.id)));
    A(KID.levels[20].type === 'finale' && ADULT.levels[20].type === 'finale');
  });
  test('岛 5 双轨各 4 站在每档都能抽题并渲染', () => {
    const kid5 = KID.levels.filter(l => l.island === 5);
    const adult5 = ADULT.levels.filter(l => l.island === 5);
    A(kid5.length === 4 && adult5.length === 4, '岛 5 应各 4 站');
    const themes = ['羞耻', '比较', '孤独', '身体'];
    A(kid5.every((l, i) => l.name && l.goal && l.tip && l.card && l.skill && l.kind.includes(themes[i])),
      '岛 5 四站应覆盖羞耻/比较/孤独/身体且有完整字段');
    /* 直接抽题 + 渲染到临时容器：不碰 session/view/hash/history，零副作用。
       逐档验证题库覆盖（每档至少 2 组变体都能被抽到）。 */
    const probe = document.createElement('div');
    const check = (lv, bandId) => {
      state.band = bandId;
      const v = pickVariant(lv.id);
      A(v && v.b && v.b.includes(bandId), `${lv.id}/${bandId} 应抽到本档变体`);
      const html = RENDERERS[lv.type](v);
      probe.innerHTML = html;
      A(probe.children.length > 0 && probe.textContent.trim().length > 0,
        `${lv.id}/${bandId} 应有非空题面`);
    };
    ['a3', 'a6', 'all'].forEach(bandId => kid5.forEach(l => check(l, bandId)));
    adult5.forEach(l => check(l, 'adult'));
    state.band = null; applySettings();
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
  /* 0.17.0 审查的结论不能靠记忆维持：myth 是指「现象或工具本身被证据削弱」，
     稳健概念（工作记忆、神经可塑性、确认偏差一类）被标成 myth 会误导读者。
     这里只锁占比，不锁名单——加词条时不会误伤，但「什么都往 myth 里塞」会被拦下。 */
  test('「容易误读」不吞掉稳健概念：myth 占比不超过两成', () => {
    const myth = DICTIONARY.filter(d => d.k === 'myth');
    A(myth.length / DICTIONARY.length <= 0.2, `myth ${myth.length} / ${DICTIONARY.length}，超过两成`);
    A(myth.every(d => d.m), '每张 myth 卡都要写边界，不能只贴标签');
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
  test('词典按 4 组递进排列，词条顺序与分组元数据一致', () => {
    const groups = MI.dictionaryMeta.groups;
    A(groups.length === 4, `应为 4 组，实际 ${groups.length}`);
    A(groups[0].cats[0] === '情绪与动机' && groups[1].cats[0] === '基础与神经');
    A(groups[3].cats.join('|') === '数字生活与注意力|方法与科学素养');
    const cats = groups.flatMap(g => g.cats);
    const seen = [...new Set(DICTIONARY.map(d => d.c))];
    A(seen.length === cats.length && seen.every((c, i) => c === cats[i]), '词条数组里的主题顺序应等于 groups.cats 展开');
    A(DICTIONARY[0].t === '情绪', '首条应是「情绪」');
    ['科学方法', '双盲实验', '生态瞬时评估'].forEach(t => {
      A((DICTIONARY.find(d => d.t === t) || {}).c === '方法与科学素养', `${t} 应归位到方法与科学素养`);
    });
  });
  test('词典显示大组导语、主题导语、概念簇与起步路径', () => {
    bandTo('a6');
    ACTIONS['open-dictionary']();
    const meta = MI.dictionaryMeta.catMeta;
    const cats = MI.dictionaryMeta.groups.flatMap(g => g.cats);
    A(document.querySelectorAll('#dict-grid .dict-group-lead').length === MI.dictionaryMeta.groups.length);
    A(document.querySelectorAll('#dict-grid .dict-cat-lead').length === cats.length, '每个主题都要有一句导语');
    const clusterCount = cats.reduce((s, c) => s + (meta[c].clusters || []).length, 0);
    const heads = [...document.querySelectorAll('#dict-grid .dict-cluster-title')];
    A(heads.length === clusterCount, `概念簇标题应有 ${clusterCount} 个，实际 ${heads.length}`);
    A(heads.every(h => h.dataset.cluster && h.querySelector('.dict-cluster-count')));
    const cards = [...document.querySelectorAll('#dict-grid .dict-card')];
    A(cards.filter(c => c.dataset.cluster).length === DICTIONARY.length, '每张卡都应归属一个概念簇');
    A(heads.every(h => cards.some(c => c.dataset.cluster === h.dataset.cluster)), '每个簇都要有卡片');
    const navs = [...document.querySelectorAll('.dict-nav-group')];
    A(navs.length === MI.dictionaryMeta.groups.length && navs.every(a => a.querySelector('b') && a.querySelector('em')));
    const steps = [...document.querySelectorAll('.dict-start-path .dict-path-btn')];
    A(steps.length === 5 && steps.every(b => b.dataset.action === 'dict-jump' && DICTIONARY.some(d => d.t === b.dataset.t)));
    renderMap();
  });
  test('概念簇标题与大组导语随筛选一起收起', () => {
    bandTo('a6');
    ACTIONS['open-dictionary']();
    [...document.querySelectorAll('#dict-kinds .dict-kind-btn')].find(b => b.dataset.k === 'method').click();
    const cards = [...document.querySelectorAll('#dict-grid .dict-card')].filter(c => !c.hidden);
    A(cards.length > 0 && cards.every(c => c.dataset.cat === '方法与科学素养'), '方法与证据词条应全部归位到第四组');
    const byCluster = {};
    cards.forEach(c => { byCluster[c.dataset.cluster] = (byCluster[c.dataset.cluster] || 0) + 1; });
    const heads = [...document.querySelectorAll('#dict-grid .dict-cluster-title')];
    A(heads.every(h => {
      const n = byCluster[h.dataset.cluster] || 0;
      return h.hidden === (n === 0) && h.querySelector('.dict-cluster-count').textContent === `${n} 条`;
    }), '簇标题的显隐与条数要跟着可见卡片走');
    const leads = [...document.querySelectorAll('#dict-grid .dict-group-lead')];
    A(leads.slice(0, 3).every(el => el.hidden), '前三组没有可见词条时组导语应收起');
    A(!leads[3].hidden, '第四组仍可见时组导语应保留');
    document.getElementById('dict-reset').click();
    renderMap();
  });
  test('五分钟起步路径能跳到已有词条并清掉筛选', () => {
    bandTo('a6');
    ACTIONS['open-dictionary']();
    const steps = [...document.querySelectorAll('.dict-start-path .dict-path-btn')];
    [...document.querySelectorAll('#dict-cats .dict-cat')].find(b => b.dataset.c === '关系与沟通').click();
    steps[1].click();
    const target = [...document.querySelectorAll('#dict-grid .dict-card')].find(c => c.dataset.term === '相关不等于因果');
    A(!!target && target.open && !target.hidden, '第 2 步应展开「相关不等于因果」');
    A(dictCat === 'all' && dictKind === 'all' && dictQuery === '');
    renderMap();
  });
  test('跨主题的「接着看」标出目标主题', () => {
    bandTo('a6');
    ACTIONS['open-dictionary']();
    const cross = [...document.querySelectorAll('#dict-grid .dict-link-cross')];
    A(cross.length > 0);
    const cats = new Set(MI.dictionaryMeta.groups.flatMap(g => g.cats));
    A(cross.every(b => b.title.startsWith('在「') && cats.has(b.title.slice(2, -2))));
    renderMap();
  });
  test('自助工具箱 5 状态 / 31 工具 / 10 条认知扭曲', () => {
    A(SH_STATES.length === 5);
    A(SH_TOOLS.length === 31);
    A(SH_DISTORTIONS.length === 10);
    A(SH_TOOLS.every(t => t.t && t.e && t.c && t.when && t.note && Array.isArray(t.how) && t.how.length >= 2));
    A(new Set(SH_TOOLS.map(t => t.t)).size === 31);
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
    A(cards.length === 31);
    const cat = [...document.querySelectorAll('#sh-cats .dict-cat')].find(b => b.dataset.c === '心力恢复');
    A(!!cat);
    cat.click();
    const shown = cards.filter(c => !c.hidden);
    A(shown.length === 8 && shown.every(c => c.dataset.cat === '心力恢复'));
    shCat = 'all'; shState = null; renderMap();
  });

  test('慢变量 6 变量 / 5 件日常 / 20 张练习 / 12 个陷阱 / 3 个尺度', () => {
    A(SV_VARS.length === 6);
    A(SV_DAILY.length === 5);
    A(SV_BUDGET.length === 3);
    A(SV_PRACTICES.length === 20);
    A(SV_TRAPS.length === 12);
    A(SV_HORIZONS.length === 3);
    A(SV_VARS.every(v => v.id && v.name && v.sub && v.lead && v.why && v.misuse && v.check && v.move && v.move.t && v.move.d));
    A(new Set(SV_VARS.map(v => v.id)).size === 6);
    A(SV_PRACTICES.every(p => p.t && p.e && p.v && p.when && p.note && Array.isArray(p.how) && p.how.length >= 2));
    A(SV_PRACTICES.every(p => SV_VARS.some(v => v.id === p.v)), '每张练习卡都要挂在合法变量上');
    A(SV_VARS.every(v => SV_PRACTICES.some(p => p.v === v.id)), '每个变量至少要有一张练习卡');
    A(new Set(SV_PRACTICES.map(p => p.t)).size === 20);
    A(new Set(SV_DAILY.map(d => d.id)).size === 5, '五件套 id 不重复');
    A(SV_DAILY.every(d => d.name && d.sub && d.when && d.why && d.cut && d.broken && d.dose && d.dose.min && d.dose.std));
    A(SV_DAILY.every(d => SV_VARS.some(v => v.id === d.v)), '五件套要挂在真实慢变量上');
    A(SV_DAILY.every(d => (d.link.kind === 'card' && SV_PRACTICES.some(p => p.t === d.link.id))
      || (d.link.kind === 'md' && !!MD_PRACTICE_BY_ID[d.link.id])), '五件套的出口只能是练习卡或静修间练习');
    A(SV_DAILY.every(d => !SV_VARS.some(v => v.name === d.name)), '五件套不应与慢变量重名');
    A(SV_BUDGET.every(b => Array.isArray(b.picks) && b.picks.length >= 2
      && b.picks.every(t => SV_PRACTICES.some(p => p.t === t))), '时间预算只能引用真实练习卡');
    A(SV_PRACTICES.every(p => !('md' in p) || !!MD_PRACTICE_BY_ID[p.md]), '练习卡的 md 必须指向静修间练习');
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
    A(cards.length === 20);
    let shown = cards.filter(c => !c.hidden);
    A(shown.length === 7 && shown.every(c => c.dataset.cat === 'health'), '应只留健康底盘的 7 张卡');
    A(document.getElementById('sv-count').textContent.includes('7 / 20'));
    A(document.querySelectorAll('#sv-panel .sv-panel-daily a').length === 2, '健康底盘应带出早起与运动');
    const craftCat = [...document.querySelectorAll('#sv-cats .dict-cat')].find(b => b.dataset.c === 'craft');
    A(!!craftCat);
    craftCat.click();
    A(svVar === 'health' && svCat === 'craft', '手动切分类不应清掉变量面板');
    A(panel.querySelectorAll('.sv-row').length === 4, '面板不应被重建');
    shown = cards.filter(c => !c.hidden);
    A(shown.length === 4 && shown.every(c => c.dataset.cat === 'craft'));
    document.querySelector('[data-action="sv-var-clear"]').click();
    A(svVar === null && svCat === 'all');
    A(cards.every(c => !c.hidden), '清选后应恢复 20 张');
    A(panel.querySelector('.sv-hint') !== null);
    A(document.getElementById('sv-count').textContent.includes('20 张'));
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
    A(nav.length === 6);
    A(nav.every(a => {
      const href = a.getAttribute('href') || '';
      return href.startsWith('#') && document.getElementById(href.slice(1));
    }), '目录每一项都要有对应锚点');
    A(document.querySelectorAll('#sv-horizons .sv-horizon-link').length === 3);
    A(document.querySelectorAll('#sv-traps .sv-trap').length === 12);
    A(document.getElementById('sv-panel').getAttribute('aria-live') === 'polite');
    renderMap();
  });
  test('慢变量：日常五件套的出口只有练习卡与静修间', () => {
    bandTo('adult'); ACTIONS['open-slowvars']();
    const cards = [...document.querySelectorAll('#sv-daily .sv-daily-card')];
    A(cards.length === 5, `五件套应有 5 张，实际 ${cards.length}`);
    /* 每张卡都必须给到「最小剂量」与「断了怎么办」，否则它就只是一句口号 */
    A(cards.every(c => c.querySelector('.sv-dose') && c.querySelector('.sv-daily-line')), '每张卡都要有剂量表与断点处理');
    A(document.querySelectorAll('#sv-daily .sv-daily-head span[lang="en"]').length === 5);
    /* 冥想那一件必须直达静修间已有的引导，而不是在慢变量里再写一份步骤 */
    const mdBtn = document.querySelector('#sv-daily .sv-daily-card[data-daily="sit"] [data-action="md-start"]');
    A(!!mdBtn && !!MD_PRACTICE_BY_ID[mdBtn.dataset.id], '冥想应直达静修间引导');
    mdBtn.click();
    A(session.view === 'retreat' && play && play.type === 'sit', '点「进静修间」应进入逐步引导');
    ACTIONS['open-slowvars']();
    /* 练习卡里那张「把注意力带回来」也要能进静修间（入口来自数据里的 md 字段） */
    const cardBtn = document.querySelector('#sv-grid .dict-card[data-term="把注意力带回来"] [data-action="md-start"]');
    A(!!cardBtn, '冥想练习卡应带静修间入口');
    renderMap();
  });
  test('慢变量：时间预算点开对应的练习卡，被筛掉时自动退回全部', () => {
    bandTo('adult'); ACTIONS['open-slowvars']();
    A(document.querySelectorAll('#sv-budget .sv-budget-card').length === 3);
    A(document.querySelectorAll('#sv-budget .sv-budget-picks .link-btn').length >= 6, '每档至少 2 个入口');
    /* 先筛到「健康底盘」，再点一张属于「心性与注意力」的卡：应退回全部而不是点了没反应 */
    document.querySelector('#sv-vars .sv-var[data-id="health"]').click();
    A(svVar === 'health');
    const pick = [...document.querySelectorAll('#sv-budget .sv-budget-picks .link-btn')]
      .find(b => b.dataset.t === '把注意力带回来');
    A(!!pick, '2 分钟档应包含「把注意力带回来」');
    pick.click();
    A(svVar === null && svCat === 'all', '目标卡被筛掉时应退回全部');
    const opened = document.querySelector('#sv-grid .dict-card[data-term="把注意力带回来"]');
    A(!!opened && opened.open, '预算入口应展开对应练习卡');
    renderMap();
  });

  /* ---------- 存档与迁移 ---------- */
  test('v2 旧档迁移到 v5，3-5 改名 finale，旧键保留', () => {
    for (const k of ['mood-island-v5', 'mood-island-v4', 'mood-island-v3', 'mood-island-v2']) localStorage.removeItem(k);
    localStorage.setItem('mood-island-v2', JSON.stringify({
      band: 'a6', cleared: ['1-1', '3-5'], shells: 4, cards: ['觉察']
    }));
    state = load();
    A(state.version === 5);
    A(state.cleared.includes('finale') && !state.cleared.includes('3-5'));
    A(localStorage.getItem('mood-island-v2') !== null);
    A(state.cards.kid.includes('觉察') && state.cards.adult.length === 0, '旧档词卡应只进儿童轨');
  });
  test('v2 / v3 / v4 旧档升到 v5：主线、词卡、本领、贝壳都不丢', () => {
    const kidLv = KID.levels[0];
    const adultLv = ADULT.levels[0];
    const cases = [
      { version: 2, band: 'a6', cleared: [kidLv.id, '3-5'], cards: [kidLv.card] },
      { version: 3, band: 'a6', cleared: [kidLv.id], cards: [kidLv.card] },
      { version: 4, band: 'a6', cleared: [kidLv.id], cards: { kid: [kidLv.card], adult: [] } }
    ];
    cases.forEach((raw) => {
      const s = migrate({
        ...raw, awarded: [kidLv.id], skills: [kidLv.skill], shells: 5,
        settings: { scale: 1 }
      });
      A(s.version === 5, `v${raw.version} 应升到 v5`);
      A(s.cleared.includes(kidLv.id) && (raw.version !== 2 || s.cleared.includes('finale')), '主线进度不应丢');
      A(s.cards.kid.includes(kidLv.card), `v${raw.version} 词卡不应丢`);
      A(s.skills.includes(kidLv.skill), `v${raw.version} 本领不应丢`);
      A(s.shells === 5, `v${raw.version} 贝壳不应丢`);
      A(Array.isArray(s.seen['4-3']) && Array.isArray(s.seen['A4-3']), 'v5 应补齐 seen 空桶');
      A(Array.isArray(s.sideCleared) && s.sideCleared.length === 0, 'v5 应补齐 sideCleared');
    });
    const adult = migrate({
      version: 4, band: 'adult', cleared: [adultLv.id], awarded: [adultLv.id],
      cards: { kid: [], adult: [adultLv.card] }, shells: 2,
      sideCleared: ['W-1', 'W-9'],
      seen: { '4-3': ['s1:t1:a1', 'bad', 's9:t9:a9'], 'A4-3': ['s1:t1:a1'] }
    });
    A(adult.sideCleared.join(',') === 'W-1', '支线只保留合法 id');
    A(adult.seen['4-3'].join(',') === 's1:t1:a1', 'seen 只保留真实组合键');
    A(adult.seen['A4-3'].length === 1);
    A(adult.cards.adult.includes(adultLv.card) && adult.shells === 2);
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
    A(s.version === 5 && Array.isArray(s.cleared) && Array.isArray(s.cards.kid) && Array.isArray(s.sideCleared));
  });
  test('v5 新键损坏时回退到 v4 旧档', () => {
    for (const k of ['mood-island-v5', 'mood-island-v4', 'mood-island-v3', 'mood-island-v2']) localStorage.removeItem(k);
    localStorage.setItem('mood-island-v5', '{broken');
    localStorage.setItem('mood-island-v4', JSON.stringify({ version: 4, band: 'a6', cleared: ['1-1'], cards: { kid: ['觉察'], adult: [] } }));
    state = load();
    A(state.version === 5 && state.cleared.includes('1-1') && state.cards.kid.includes('觉察'));
  });
  test('save 写入 v5 新键', () => {
    save();
    const raw = localStorage.getItem('mood-island-v5');
    A(!!raw && JSON.parse(raw).version === 5 && Array.isArray(JSON.parse(raw).cards.kid));
  });
  test('v5 档字段非法时逐项回落到安全值', () => {
    const s = migrate({
      version: 5, band: 'adult',
      cleared: ['1-1', '1-1', 'ghost', 7],
      awarded: ['A1-1', 'nope'],
      cards: { kid: ['觉察', '不存在的卡', 7], adult: ['身体信号'] },
      skills: ['注意到自己有感觉', '不存在的本领', 7],
      shells: -3,
      decor: ['2', 99, 1, 1, 4],
      seen: { '4-3': ['s1:t1:a1', 'bad', 7], 'A4-3': 'oops' },
      sideCleared: ['W-1', 'W-1', 'W-9', 7],
      settings: { scale: 99, motion: 'yes', speak: false, contrast: 1 }
    });
    A(s.cleared.length === 1 && s.cleared[0] === '1-1');
    A(s.awarded.length === 1 && s.awarded[0] === 'A1-1');
    A(s.cards.kid.length === 1 && s.cards.kid[0] === '觉察');
    A(s.cards.adult.length === 1 && s.cards.adult[0] === '身体信号');
    A(s.skills.length === 1 && s.skills[0] === '注意到自己有感觉');
    A(s.shells === 0);
    A(s.decor.length === 2 && s.decor.join(',') === '1,4', '装饰下标应去重并限定在 DECOR 范围内');
    A(s.seen['4-3'].join(',') === 's1:t1:a1' && s.seen['A4-3'].length === 0, 'seen 应逐条清洗');
    A(s.sideCleared.join(',') === 'W-1', 'sideCleared 应去重并只留合法 id');
    A(s.settings.scale === 1 && s.settings.motion === true && s.settings.speak === false && s.settings.contrast === true);
  });
  test('清空本机进度会连旧键一起删掉，不会回退复活', () => {
    localStorage.setItem('mood-island-v4', JSON.stringify({ version: 4, band: 'a6', cleared: ['1-1'] }));
    localStorage.setItem('mood-island-v3', JSON.stringify({ version: 3, band: 'a6', cleared: ['1-1'] }));
    localStorage.setItem('mood-island-v2', JSON.stringify({ band: 'a6', cleared: ['1-1'] }));
    state.band = 'a6';
    state.settings = { ...DEFAULT_STATE.settings };
    state.cleared = ['1-1'];
    state.shells = 4;
    ACTIONS['clear-progress-confirm']();
    A(!localStorage.getItem('mood-island-v4') && !localStorage.getItem('mood-island-v3') && !localStorage.getItem('mood-island-v2'));
    const saved = JSON.parse(localStorage.getItem('mood-island-v5'));
    A(saved.cleared.length === 0 && saved.shells === 0 && saved.cards.kid.length === 0);
    A(state.band === 'a6', '清空进度不应丢年龄段');
  });

  /* ---------- 双轨 ---------- */
  test('切到成年档重绑 LEVELS', () => {
    bandTo('adult');
    A(LEVELS === ADULT.levels && TOTAL === 21 && isAdultTrack());
  });
  test('切回儿童档重绑 LEVELS', () => {
    bandTo('a6');
    A(LEVELS === KID.levels && TOTAL === 21 && !isAdultTrack());
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
    /* 重来后地图给一次撤销；撤销只认本轨，恢复后提示收起 */
    A(!!document.querySelector('#stage [data-action="restart-undo"]'), '重来后地图上应给撤销');
    A(!('undoRestart' in JSON.parse(localStorage.getItem(STORAGE_KEY))), '撤销快照不该落盘');
    ACTIONS['restart-undo']();
    A(['1-1', '1-2', 'A1-1'].every(id => state.cleared.includes(id)), '撤销后应恢复本轨走过的站');
    A(session.undoRestart === null && !document.querySelector('#stage [data-action="restart-undo"]'), '撤销后提示应收起');
    /* 界面上的「从头再来」都要先确认，不能直连 restart-all */
    renderHome();
    A(!document.querySelector('#stage [data-action="restart-ask"], #stage [data-action="restart-all"]'), '首页不再放从头再来');
    openSettings();
    A(!!overlay.querySelector('[data-action="restart-ask"]') && !overlay.querySelector('[data-action="restart-all"]'), '设置里的从头再来应走确认');
    ACTIONS['restart-ask']();
    A(!!overlay.querySelector('[data-action="restart-all"]') && state.cleared.includes('1-1'), '确认弹窗出现前不该清进度');
    closeModal();
    state.cleared = ['A1-1'];
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
    state.cleared = KID.levels.slice(0, 20).map(l => l.id);
    A(isUnlocked(16) === true);
  });
  test('地图锁定文案与规则一致', () => {
    state.cleared = [];
    renderMap();
    const h = document.getElementById('stage').innerHTML;
    A(!h.includes('先走完上一岛') && h.includes('先走过上一岛最后一站'));
  });
  test('地图入口按用途分组，不再是一排等权重按钮', () => {
    state.cleared = [];
    bandTo('adult');
    renderMap();
    A(document.querySelectorAll('#stage .map-hub .hub-card').length === 9);
    A(!!document.querySelector('#stage .map-hub .hub-help'), '急救入口应在地图「随时可用」组里');
    A(!!document.querySelector('#stage .map-hub [data-action="go-work"]'), '成年地图应有工作间支线入口');
    A(document.querySelectorAll('#stage .map-tools').length === 0);
    const heads = [...document.querySelectorAll('#stage .hub-head h3')].map(e => e.textContent.trim());
    A(heads.includes('随时可用') && heads.includes('知识与工具') && heads.includes('这一趟的收集'));
    A(heads.includes('专题 · 工作间'), '工作间应是独立分组，不是塞进收集区');
  });
  test('地图只标一个下一站，岛头显示走过站数', () => {
    state.cleared = [];
    renderMap();
    const next = [...document.querySelectorAll('#stage .node.next')];
    A(next.length === 1 && next[0].dataset.i === '0', '空白进度只应点亮第一站');
    A(next[0].textContent.includes('下一站'));
    A(document.querySelectorAll('#stage .island-count').length === 5);
    A(document.getElementById('stage').textContent.includes('0 / 4 站'));
  });
  test('首页保留单一主 CTA，知识入口是低权重快捷', () => {
    bandTo('a6');
    renderHome();
    A(document.querySelectorAll('#stage .actions .btn-primary').length === 1);
    /* 孩子档：知识入口与换档收进「给大人」，首页不直接摆 */
    A(!document.querySelector('#stage .home-shortcuts'), '6-12 岁首页不直接摆知识入口');
    A(['goto-band', 'open-dictionary', 'open-selfhelp', 'open-slowvars'].every(a => document.querySelector(`#stage .home-adult [data-action="${a}"]`)), '换档与知识入口应在给大人里');
    A(!document.querySelector('#stage .toolbar [data-action="goto-band"]'), '孩子档工具栏不放换年龄段');
    bandTo('a3'); renderHome();
    A(document.querySelectorAll('#stage .actions .btn-primary').length === 1 && !!document.querySelector('#stage .home-adult'));
    A(!document.querySelector('#stage .home-points') && !document.querySelector('#stage .home-next-meta'), '3-6 岁首页不显示卖点与站数');
    bandTo('all'); renderHome();
    A(document.querySelectorAll('#stage .home-shortcuts .btn-read').length === 3 && !document.querySelector('#stage .home-adult'), '亲子档保留知识入口');
    A(!!document.querySelector('#stage .toolbar [data-action="goto-band"]'), '亲子档保留换年龄段');
    bandTo('a6'); renderHome();
  });
  test('首页主按钮直达下一处已解锁未走站', () => {
    bandTo('a6');
    state.cleared = [KID.levels[0].id];
    renderHome();
    A(document.querySelector('.home-next').textContent.includes(KID.levels[1].name));
    document.querySelector('#stage .actions .btn-primary').click();
    A(session.view === 'level' && session.levelIndex === 1, '应跳过地图，直接进入第 2 站');
  });
  test('地图「从这里继续」与首页走同一处判断', () => {
    bandTo('a6');
    state.cleared = [];
    renderMap();
    const btn = document.querySelector('#stage .map-next [data-action="continue"]');
    A(!!btn && document.querySelector('.map-next').textContent.includes(KID.levels[0].name));
    btn.click();
    A(session.view === 'level' && session.levelIndex === 0);
  });

  /* ---------- 急救入口 ---------- */
  test('急救入口常驻顶栏，两轨措辞不同', () => {
    const btn = document.getElementById('help-entry');
    A(!!btn && btn.dataset.action === 'open-help', '顶栏需要有常驻入口');
    bandTo('a6'); renderHome();
    A(btn.textContent === '现在有点难受', `6-12 档应显示「现在有点难受」，实际「${btn.textContent}」`);
    ['a3', 'a6'].forEach(id => {
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
    /* 危机词条内的出口：展开「自杀风险信号」应看到按钮，点击后同样回到词典 */
    const sosCard = document.querySelector('#dict-grid .dict-card[data-term="自杀风险信号"]');
    A(!!sosCard, '词典应有「自杀风险信号」词条');
    const sosBtn = sosCard.querySelector('[data-action="open-help"]');
    A(!!sosBtn, '危机词条应带站内急救出口');
    sosBtn.click();
    A(session.view === 'help' && session.helpFrom === 'dict', '危机词条出口应进入急救页并记下来源');
    ACTIONS['help-close']();
    A(session.view === 'dict', '从危机词条进入应回到词典');
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

  /* ---------- 导出 / 导入 ---------- */
  test('导出载荷带独立 exportVersion，文件名带时间戳', () => {
    bandTo('a6');
    const p = exportPayload();
    A(p.app === 'mood-island');
    A(p.exportVersion === EXPORT_VERSION && EXPORT_VERSION === 1, '导出格式号应独立且当前为 1');
    A(typeof p.exportedAt === 'string' && !Number.isNaN(new Date(p.exportedAt).getTime()));
    A(!!p.state && p.state.version === SCHEMA_VERSION, '载荷里应是完整存档');
    const name = exportFilename(new Date(2026, 10, 7, 9, 5));
    A(name === 'mood-island-progress-20261107-0905.json', `文件名不对：${name}`);
  });
  test('导入逐条拒绝坏文件 / 陌生来源 / 更新的格式', () => {
    A(validateImport('{').code === 'json');
    A(validateImport('[]').code === 'shape');
    A(validateImport(JSON.stringify({ app: 'other', exportVersion: 1, state: {} })).code === 'app');
    A(validateImport(JSON.stringify({ app: 'mood-island', exportVersion: 9, state: {} })).code === 'export-version-newer');
    A(validateImport(JSON.stringify({ app: 'mood-island', exportVersion: 1 })).code === 'state-missing');
    A(validateImport(JSON.stringify({ app: 'mood-island', exportVersion: 1, state: { version: 9 } })).code === 'schema-newer');
    A(validateImport(JSON.stringify({ app: 'mood-island', exportVersion: 1, state: { version: 5 } })).code === 'empty');
  });
  test('导入一律走 migrate()，旧结构词卡按轨补齐', () => {
    const cardLv = KID.levels.find(l => l.card);
    const old = {
      app: 'mood-island', exportVersion: 1, exportedAt: '2026-11-07T00:00:00.000Z',
      state: { version: 3, band: 'a6', cleared: [cardLv.id], awarded: [cardLv.id], cards: [cardLv.card], shells: 4, settings: { scale: 1 } }
    };
    const res = validateImport(JSON.stringify(old));
    A(res.ok, `旧结构应能导入：${res.message || ''}`);
    A(res.state.version === SCHEMA_VERSION);
    A(res.state.cards.kid.includes(cardLv.card) && !res.state.cards.adult.includes(cardLv.card), '旧数组词卡应按证据归到儿童轨');
  });
  test('导入预览不改当前档，确认后覆盖、可撤销一次', () => {
    bandTo('a6');
    state.cleared = [KID.levels[0].id];
    state.cards.kid = [];
    state.shells = 2;
    save();
    const payload = {
      app: 'mood-island', exportVersion: 1, exportedAt: '2026-11-07T00:00:00.000Z',
      state: { version: 3, band: 'adult', cleared: [ADULT.levels[0].id], awarded: [ADULT.levels[0].id], cards: [], shells: 6, settings: { scale: 1.15 } }
    };
    previewImport(JSON.stringify(payload), 'backup.json');
    A(state.band === 'a6' && state.shells === 2, '预览阶段不能动当前档');
    A(overlay.textContent.includes('导入前先看一眼'));
    ACTIONS['import-confirm']();
    A(state.band === 'adult' && state.shells === 6 && state.settings.scale === 1.15, '确认后应换成文件里的档');
    A(state.version === SCHEMA_VERSION);
    A(overlay.textContent.includes('导入完成') && !!document.querySelector('[data-action="import-undo"]'));
    ACTIONS['import-undo']();
    A(state.band === 'a6' && state.shells === 2 && state.cleared.length === 1, '撤销应恢复导入前');
    A(localStorage.getItem(STORAGE_KEY) === JSON.stringify(state), '撤销后应写回本机');
    bandTo('a6'); renderHome();
  });

  test('导出 → 清空 → 导入：同一份载荷逐字段闭环', () => {
    const kidLv = KID.levels[0];
    state = migrate({
      version: 5, band: 'adult',
      cleared: [ADULT.levels[0].id, kidLv.id],
      awarded: [ADULT.levels[0].id, kidLv.id],
      cards: { kid: [kidLv.card], adult: [ADULT.levels[0].card] },
      skills: [kidLv.skill, ADULT.levels[0].skill],
      shells: 6,
      decor: [1, 4],
      seen: { '4-3': ['s1:t1:a1'], 'A4-3': ['s1:t1:a1'] },
      sideCleared: ['W-1'],
      settings: { scale: 1.15, motion: true, speak: false, speakTouched: true, autoSpeak: false, contrast: true }
    });
    save();
    const before = clone(state);
    const exported = JSON.stringify(exportPayload());
    A(JSON.parse(exported).state.version === SCHEMA_VERSION);

    ACTIONS['clear-progress-confirm']();
    A(state.cleared.length === 0 && state.cards.kid.length === 0 && state.cards.adult.length === 0,
      '清空后不应留下进度');
    A(!localStorage.getItem('mood-island-v4') && !localStorage.getItem('mood-island-v3') && !localStorage.getItem('mood-island-v2'),
      '清空应连旧键一起删掉');

    previewImport(exported, 'loop.json');
    A(overlay.textContent.includes('导入前先看一眼'), '应进入导入预览');
    A(state.cleared.length === 0, '预览阶段不能改当前档');
    ACTIONS['import-confirm']();

    ['version', 'band', 'cleared', 'awarded', 'cards', 'skills', 'shells', 'decor', 'seen', 'sideCleared', 'settings'].forEach((f) => {
      A(JSON.stringify(state[f]) === JSON.stringify(before[f]), `字段 ${f} 与导出前不一致`);
    });
    A(JSON.stringify(state) === JSON.stringify(before), '整份存档与导出前不一致');
    A(localStorage.getItem(STORAGE_KEY) === JSON.stringify(state), '导入后应写回本机');
    ACTIONS['import-finish']();
    bandTo('a6'); renderMap();
  });

  /* ---------- hash 路由 ---------- */
  test('hash 解析：合法视图 / 关卡 id / 非法地址', () => {
    A(parseHash('#/map').view === 'map');
    A(parseHash('#level/4-2').view === 'level' && parseHash('#level/4-2').id === '4-2');
    A(parseHash('#/level/').view === 'bad');
    A(parseHash('#/nope').view === 'bad');
    A(parseHash('').view === null);
  });
  test('直达关卡按 id 定位，刷新前后地址一致', () => {
    bandTo('a6');
    state.cleared = KID.levels.map(l => l.id);
    save(); applySettings();
    const lv = KID.levels[3];
    session.levelIndex = 0;
    routeTo(parseHash('#/level/' + lv.id));
    A(session.view === 'level' && session.levelIndex === 3, `应定位到第 4 站，实际 ${session.levelIndex}`);
    A(location.hash === '#/level/' + lv.id, `地址应同步，实际 ${location.hash}`);
    renderMap();
    A(location.hash === '#/map');
  });
  test('未知或不可达的 hash 回落，不报错', () => {
    bandTo('a6'); state.cleared = []; save(); renderHome();
    session.levelIndex = 0;
    routeTo(parseHash('#/level/' + KID.levels[20].id));
    A(session.view === 'map' && location.hash === '#/map', '未解锁的站应回到地图');
    A(stage.textContent.includes('还没解锁'));
    routeTo(parseHash('#/nope'));
    A(session.view === 'home' && location.hash === '#/home', '认不出的地址应落到首页并改写地址');
    routeTo(parseHash('#/level/' + ADULT.levels[0].id));
    A(session.view === 'map' && location.hash === '#/map', '另一条轨的站应视为不可达');
  });
  test('hash 进急救不打断 Esc / 返回路径', () => {
    bandTo('adult');
    state.cleared = ADULT.levels.map(l => l.id);
    save(); applySettings();
    routeTo(parseHash('#/level/' + ADULT.levels[0].id));
    const vBefore = play.v;
    routeTo(parseHash('#/help'));
    A(session.view === 'help' && session.helpFrom === 'level');
    A(helpResume === play, '应暂存关卡的进行态');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    A(session.view === 'level' && play.v === vBefore, 'Esc 应回到同一站同一题');
    A(location.hash === '#/level/' + ADULT.levels[0].id);
    bandTo('a6'); renderHome();
  });

  /* ---------- 拼装试点 / 工作间支线 ---------- */
  test('拼装题物化成 reframe 契约，同一组合键选项顺序固定', () => {
    bandTo('a6');
    const cfg = MI.bankCompose['4-3'];
    const key = 's1:t1:a1';
    const a = pickVariant('4-3', { forceKey: key, seed: 1 });
    const b = pickVariant('4-3', { forceKey: key, seed: 99 });
    A(a.key === key && a.compose === '4-3', '应物化到指定组合');
    A(a.options.length === 4 && a.answer >= 0 && a.answer < 4, 'reframe 契约要求 3–4 个选项且 answer 合法');
    A(a.question === cfg.asks.find(x => x.id === 'a1').q);
    A(a.options[a.answer].t === cfg.thoughts.t1.lenses.find(l => l.ok).t, 'answer 应指向 ok 镜头');
    A(JSON.stringify(a.options) === JSON.stringify(b.options), '同一 key 换种子也不得改变选项顺序');
    A(a.options.every(o => o.t && o.d && !o.ok), '对外只暴露 t / d，不泄漏 ok 标记');
    const idx = KID.levels.findIndex(l => l.id === '4-3');
    session.levelIndex = idx;
    play = makePlay(KID.levels[idx], a);
    renderLevel(play);
    const root = document.querySelector('#stage [data-variant]');
    A(!!root && root.dataset.variant === key, '组合键必须能在 DOM 上读到');
    renderMap();
  });
  test('拼装同关连续 6 轮不出现重复组合，seen 落盘且上限 8', () => {
    bandTo('a6');
    state.seen = { '4-3': [], 'A4-3': [] };
    lastVariant = {};
    save();
    const keys = [];
    const combos = [];
    for (let i = 0; i < 6; i++) {
      const p = pickVariant('4-3');
      keys.push(p.key);
      combos.push(p.thought + '|' + p.question);
    }
    A(new Set(keys).size === 6, `6 轮应有 6 个不同组合，实际 ${keys.join(' / ')}`);
    A(new Set(combos).size === 6, '题干与问法合起来也不得重复');
    A(state.seen['4-3'].length === 6, '每轮出现的组合都应记录');
    A(JSON.parse(localStorage.getItem(STORAGE_KEY)).seen['4-3'].length === 6, 'seen 应随存档落盘');
    for (let i = 0; i < 4; i++) pickVariant('4-3');
    A(state.seen['4-3'].length === 8, `seen 上限应为 8，实际 ${state.seen['4-3'].length}`);
    A(JSON.parse(localStorage.getItem(STORAGE_KEY)).seen['4-3'].length === 8);
    const before = state.seen['4-3'].slice();
    ACTIONS['restart-all']();
    A(state.seen['4-3'].join(',') === before.join(','), 'restart-all 不应清已见组合');
    session.undoRestart = null;
  });
  test('工作间只在成年档出现，儿童轨看不到入口', () => {
    bandTo('adult'); state.cleared = [WORK_GATE]; renderMap();
    A(!!document.querySelector('#stage [data-action="go-work"]'), '成年地图应有工作间入口');
    A(document.getElementById('stage').textContent.includes('工作间'));
    bandTo('a6'); renderMap();
    A(!document.querySelector('#stage [data-action="go-work"]'), '儿童轨不应出现工作间入口');
  });
  test('工作间按幕解锁，完成只写 sideCleared 且不加任何奖励', () => {
    bandTo('adult');
    state.cleared = [WORK_GATE]; state.awarded = []; state.sideCleared = [];
    state.cards = { kid: [], adult: [] }; state.skills = []; state.shells = 0;
    save(); applySettings();
    A(sideUnlocked(0) && !sideUnlocked(1), '只开放第一幕');
    const beforeCards = JSON.stringify(state.cards);
    const beforeSkills = JSON.stringify(state.skills);
    renderLevel(null, WORK[0], 0);
    A(play.side && currentLevel().id === 'W-1');
    A(document.getElementById('progress-text').textContent.includes('支线'), '顶栏应标明支线');
    completeLevel('这一幕走过了');
    A(state.sideCleared.join(',') === 'W-1', '完成应写入 sideCleared');
    A(state.cleared.join(',') === WORK_GATE, '支线不得写进主线 cleared');
    A(JSON.stringify(state.cards) === beforeCards && JSON.stringify(state.skills) === beforeSkills && state.shells === 0,
      '支线不加词卡 / 本领 / 贝壳');
    A(state.awarded.length === 0);
    A(TOTAL === 21 && clearedInTrack() === 1, '支线不计入 21 站');
    A(sideUnlocked(1), '完成第一幕后第二幕解锁');
    const card = document.getElementById('feedback-slot').textContent;
    A(card.includes('不计入 21 站') && card.includes('不加贝壳、词卡或本领'), '完成卡应写明支线口径');
    A(!document.querySelector('#feedback-slot [data-action="next-chapter"]'));
    renderLevel(null, WORK[1], 1);
    A(play.side && currentLevel().id === 'W-2');
    completeLevel('第二幕');
    A(state.sideCleared.join(',') === 'W-1,W-2');
    A(state.cleared.join(',') === WORK_GATE, '连续两幕也不得污染主线');
  });
  test('工作间 hash 直达、不可达回落、Esc 回地图', () => {
    bandTo('adult'); state.cleared = [WORK_GATE]; state.sideCleared = []; session.levelIndex = 0; save(); applySettings();
    renderHome();
    routeTo(parseHash('#/level/W-1'));
    A(session.view === 'level' && currentLevel().id === 'W-1' && !!play.side, '应直达第一幕');
    A(location.hash === '#/level/W-1');
    A(session.levelIndex === 0, '支线不应改写主线停在哪一站');
    routeTo(parseHash('#/work'));
    A(session.view === 'work' && location.hash === '#/work', '应进入工作间时间线');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    A(session.view === 'map' && location.hash === '#/map', 'Esc 应回地图');
    routeTo(parseHash('#/level/W-2'));
    A(session.view === 'work', '未解锁的幕应回落工作间');
    A(document.getElementById('stage').textContent.includes('还没解锁'));
    bandTo('a6'); renderHome();
    routeTo(parseHash('#/level/W-1'));
    A(session.view === 'map', '儿童轨把工作间视为不可达');
    A(location.hash === '#/map');
  });

  test('支线换题保留 side 上下文，通关不写主线', () => {
    bandTo('adult');
    state.cleared = [WORK_GATE]; state.awarded = [WORK_GATE];
    state.cards = { kid: [], adult: [] }; state.skills = []; state.shells = 0;
    state.sideCleared = [];
    const idx = LEVELS.findIndex(l => l.id === 'A2-1');
    A(idx > 0, '应能定位到未通关的 A2-1');
    session.levelIndex = idx;
    save(); applySettings();
    renderLevel(null, WORK[0], 0);
    ACTIONS['reroll']();
    A(play.side === true && play.sideIndex === 0, '换题后仍是支线');
    A(currentLevel().id === 'W-1', '换题后仍读支线关卡');
    A(document.getElementById('stage').textContent.includes('工作间 · 09:00 · 支线'));
    completeLevel('这一幕走过了');
    A(state.cleared.join(',') === WORK_GATE, '支线换题后通关不得写主线 cleared');
    A(state.sideCleared.join(',') === 'W-1');
    A(state.shells === 0 && state.skills.length === 0 && state.cards.adult.length === 0, '支线不得发奖励');
  });

  test('工作间进急救，返回与 Esc 都回到工作间', () => {
    bandTo('adult'); state.cleared = [WORK_GATE]; state.sideCleared = []; save(); applySettings();
    renderWork();
    ACTIONS['open-help']();
    A(session.view === 'help' && session.helpFrom === 'work');
    const back = document.querySelector('#stage [data-action="help-close"]');
    A(!!back && back.textContent.includes('回到工作间'), '返回按钮应写回到工作间');
    back.click();
    A(session.view === 'work' && location.hash === '#/work');
    ACTIONS['open-help']();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    A(session.view === 'work', 'Esc 也应回工作间');
  });

  test('工作间解锁点在 A3-4：只走完 A2-4 不够', () => {
    bandTo('adult');
    state.cleared = ['A1-1', 'A1-2', 'A1-3', 'A1-4', 'A2-1', 'A2-2', 'A2-3', 'A2-4']; state.sideCleared = [];
    save(); applySettings();
    A(!sideUnlocked(0), '只到 A2-4 不应解锁第一幕（表达还没教）');
    renderMap();
    A(document.querySelector('.hub-work .hub-meta').textContent.includes(`走完 ${WORK_GATE} 后开放`), '入口应标为未开放');
    state.cleared.push(WORK_GATE); save(); renderMap();
    A(sideUnlocked(0), '走到 A3-4 才解锁第一幕');
    A(document.querySelector('.hub-work .hub-meta').textContent.includes('个时刻'), '解锁后入口应可用');
  });
  test('旧档已完成支线：解锁点后移后 sideCleared 仍可回看', () => {
    bandTo('adult');
    state.cleared = ['A1-4']; state.sideCleared = ['W-1', 'W-2'];
    save(); applySettings();
    A(!sideUnlocked(0), '未走解锁点时第一幕不再自动开放');
    A(workReachable(0) && workReachable(1), '已完成的两幕必须仍可回看');
    renderWork();
    A(document.getElementById('stage').textContent.includes('会前十分钟'), '工作间应列出已完成的幕');
    routeTo(parseHash('#/level/W-1'));
    A(session.view === 'level' && currentLevel().id === 'W-1', '旧档已完成的幕仍可直达');
  });
  test('A2-1 呼吸空间：约 3 分钟、不引导吸呼节奏', () => {
    bandTo('adult');
    play = {};
    const idx = LEVELS.findIndex(l => l.id === 'A2-1');
    session.levelIndex = idx; renderLevel();
    A(play.v.mode === 'space', `A2-1 的变体应是 space 模式（id=${play.id} mode=${play.v.mode}）`);
    const txt = document.getElementById('stage').textContent;
    A(txt.includes('约 3 分钟') && !txt.includes('跟着做'), '按钮应写约 3 分钟，不再按轮数');
    A(!txt.includes('呼气比吸气长'), 'space 模式不得引导吸呼节奏');
    A(txt.includes('不用调整呼吸'), '应写明不用调整呼吸');
  });
  test('概念层 16 条：两轨词卡名与反链都指向真实内容', () => {
    A(GLOSSARY.length === 20 && new Set(GLOSSARY.map(g => g.id)).size === 20);
    A(conceptOfLevel('A2-2') && conceptOfLevel('A2-2').id === 'reframe');
    A(conceptOfLevel('2-2') && conceptOfLevel('2-2').id === 'reframe', '两轨同一概念共用一条');
    A(conceptOfCard('命名') && conceptOfCard('命名').id === 'granularity');
    A(conceptOfCard('情绪粒度') && conceptOfCard('情绪粒度').id === 'granularity');
    A(conceptOfTool('想法检验四问') && conceptOfTool('想法检验四问').id === 'reframe');
  });
  test('概念依赖先教后用：两轨教学站顺序成立，工作间不再倒挂', () => {
    bandTo('adult');
    const order = LEVELS.map(l => l.id);
    const kidOrder = MI.kid.levels.map(l => l.id);
    GLOSSARY.forEach(g => {
      A(Array.isArray(g.teach) && g.teach.length === 2, `${g.id} 应有两条教学站`);
      A(g.teach.every(id => (g.stations || []).includes(id)), `${g.id} 的教学站应在 stations 里`);
      A((g.requires || []).every(id => GLOSSARY.some(x => x.id === id)), `${g.id} 的依赖应真实存在`);
      A(!(g.requires || []).includes(g.id), `${g.id} 不能依赖自己`);
      const adultSelf = order.indexOf(g.teach.find(id => id.startsWith('A')));
      const kidSelf = kidOrder.indexOf(g.teach.find(id => !id.startsWith('A')));
      A(adultSelf >= 0 && kidSelf >= 0, `${g.id} 两轨都应有教学站`);
      (g.requires || []).forEach(id => {
        const r = GLOSSARY.find(x => x.id === id);
        const adultReq = order.indexOf(r.teach.find(x => x.startsWith('A')));
        const kidReq = kidOrder.indexOf(r.teach.find(x => !x.startsWith('A')));
        A(adultReq < adultSelf && kidReq < kidSelf, `${g.id} 依赖 ${id}，教学站必须更早`);
      });
    });
    const gate = order.indexOf(WORK_GATE);
    A(gate > 0, '工作间解锁点应在成年轨里');
    WORK.forEach(w => {
      const c = conceptOfLevel(w.id);
      A(!!c, `${w.id} 应挂到概念`);
      const ti = order.indexOf(conceptTeach(c));
      A(ti >= 0 && ti <= gate, `${w.id} 用的 ${c.id} 必须早于解锁点教过`);
    });
  });
  test('关卡页标出概念关系：复习站 / 工作间回指教学站', () => {
    bandTo('adult');
    state.cleared = ['A2-4', WORK_GATE]; state.sideCleared = ['W-1', 'W-2'];
    session.levelIndex = LEVELS.findIndex(l => l.id === 'A3-4');
    renderLevel();
    const line = document.querySelector('.concept-line');
    A(!!line && line.textContent.includes('复习'), 'A3-4 应标为复习站');
    renderLevel(null, WORK[2], 2);
    const wline = document.querySelector('.concept-line');
    A(!!wline && wline.textContent.includes('会用到') && wline.textContent.includes('表达'), 'W-3 应回指表达');
    const back = wline.querySelector('[data-action="open-level"]');
    A(!!back && LEVELS[Number(back.dataset.i)].id === 'A3-3', '应能回到 A3-3 教学站');
    play = {}; session.levelIndex = 0; renderMap();
  });
  test('结果卡先给机制与规格，并接词典', () => {
    bandTo('adult');
    state.cleared = ['A1-1']; state.awarded = []; state.sideCleared = [];
    session.levelIndex = LEVELS.findIndex(l => l.id === 'A1-2');
    renderLevel();
    completeLevel('走过了');
    const txt = document.getElementById('stage').textContent;
    A(txt.includes('为什么可能有用'), '结果卡应先给机制');
    A(txt.includes(conceptOfLevel('A1-2').mechanism.slice(0, 12)), '结果卡应显示概念机制原文');
    A(txt.includes('动作规格'), '结果卡应显示统一规格');
    A(!!document.querySelector('#stage [data-action="dict-jump"][data-t="内感受"]'), '结果卡应接词典');
  });
  test('词卡图鉴按 20 组显示双名，state.cards 键值不变', () => {
    bandTo('adult');
    state.cards = { kid: [], adult: ['觉察', '命名', '呼吸空间'] };
    save(); applySettings();
    openCodex();
    const cards = [...document.querySelectorAll('.codex-grid .codex-card')];
    A(cards.length === 20, `图鉴应显示 20 组，实际 ${cards.length}`);
    A(document.querySelector('.modal-title').textContent.includes('3 / 20'), '计数应按概念组');
    A(cards.some(c => c.textContent.includes('也叫「情绪粒度」')), '双名概念应同时标出另一种叫法');
    A(JSON.stringify(state.cards) === JSON.stringify({ kid: [], adult: ['觉察', '命名', '呼吸空间'] }), '渲染层不得改写存档');
    closeModal();
  });
  test('边界说明只有一份：静修 / 自助 / 慢变量都读 MI.safety', () => {
    A(!!MI.safety && !!MI.safety.text && SAFETY_TEXT === MI.safety.text);
    A(RETREAT_SAFETY === SAFETY_TEXT && SH_SAFETY === SAFETY_TEXT && SV_SAFETY === SAFETY_TEXT);
    A(!('RETREAT_SAFETY' in LIB) && !('safety' in (MI.selfhelp || {})) && !('safety' in (MI.slowvars || {})),
      '旧的多份安全文案应已删除');
  });
  test('自助工具卡 31 张，认知扭曲改为速查呈现', () => {
    A(SH_TOOLS.length === 31 && SH_DISTORTIONS.length === 10);
    A(!SH_TOOLS.some(t => t.t === '认知扭曲总览'), '总览卡应已并入速查');
    bandTo('adult'); ACTIONS['open-selfhelp']();
    A(document.querySelectorAll('#sh-grid .sh-card').length === 31);
    A(document.getElementById('stage').textContent.includes('31 张工具卡'));
    A(document.querySelectorAll('.sh-dist').length === 10, '速查仍应保留 10 条');
    renderMap();
  });
  test('工具箱给出按概念的入口，31 张卡按主题分区', () => {
    bandTo('adult'); ACTIONS['open-selfhelp']();
    const chips = [...document.querySelectorAll('#stage .concept-start .concept-chip')];
    A(chips.length === GLOSSARY.filter(g => (g.tools || []).length).length, '概念入口应覆盖所有有工具的概念');
    A(document.querySelectorAll('#sh-grid .dict-group-title').length === 5, '31 张卡应按 5 个主题分区');
    const reframeChip = chips.find(c => c.dataset.id === 'reframe');
    A(!!reframeChip); reframeChip.click();
    const target = [...document.querySelectorAll('#sh-grid .dict-card')].find(c => c.dataset.term === '认知模型');
    A(!!target && target.open, '点概念应跳到并展开对应工具卡');
    renderMap();
  });
  test('工具卡显示概念机制，并回链教学站与词典', () => {
    bandTo('adult'); state.cleared = ['A1-4']; ACTIONS['open-selfhelp']();
    const card = [...document.querySelectorAll('#sh-grid .dict-card')].find(c => c.dataset.term === '想法检验四问');
    A(!!card && !!card.querySelector('.sh-mech'), '工具卡应带机制块');
    const mech = card.querySelector('.sh-mech').textContent;
    A(mech.includes(conceptOfTool('想法检验四问').mechanism.slice(0, 10)), '应显示所属概念的机制');
    A(mech.includes('动作规格'), '应显示统一规格');
    const back = card.querySelector('.sh-mech [data-action="open-level"]');
    A(!!back && LEVELS[Number(back.dataset.i)].id === 'A2-2', '应回链到第 2 站');
    A(!!card.querySelector('.sh-mech [data-action="dict-jump"][data-t="认知重评"]'), '应接词典');
    renderMap();
  });
  test('慢变量 20 张按 6 个变量分区，入口按钮带张数', () => {
    bandTo('adult'); ACTIONS['open-slowvars']();
    A(document.querySelectorAll('#sv-vars .sv-var').length === 6);
    A(document.querySelectorAll('#sv-vars .sv-var em').length === 6, '每个入口应标出练习张数');
    A(document.querySelectorAll('#sv-practices .dict-group-title').length === 6, '20 张卡应按 6 个变量分区');
    A(document.querySelectorAll('#sv-practices .dict-card').length === 20);
    renderMap();
  });
  test('词典按概念读：20 个概念都能跳到已有词条', () => {
    bandTo('adult'); ACTIONS['open-dictionary']();
    const chips = [...document.querySelectorAll('#stage .concept-start .concept-chip')];
    A(chips.length === 20, `概念入口应有 20 个，实际 ${chips.length}`);
    const chip = chips.find(c => c.dataset.id === 'reframe');
    A(!!chip); chip.click();
    const card = [...document.querySelectorAll('#dict-grid .dict-card')].find(c => c.dataset.term === '认知重评');
    A(!!card && card.open, '点概念应展开对应词条');
    A(card.textContent.includes('概念 · 观察与推测'), '词条卡应标出概念名');
    renderMap();
  });
  test('两份清单互链：10 条想法层 / 12 条节奏层', () => {
    bandTo('adult'); ACTIONS['open-selfhelp']();
    A(document.querySelectorAll('#stage .sh-dist').length === 10);
    A(!!document.querySelector('#stage [data-action="open-slowvars"]'), '想法层应指向节奏层');
    ACTIONS['open-slowvars']();
    A(document.querySelectorAll('#stage .sv-trap').length === 12);
    A(!!document.querySelector('#sv-traps [data-action="open-selfhelp"]'), '节奏层应指向想法层');
    renderMap();
  });
  test('终章三句话来自概念层，独立金句数组已删除', () => {
    A(!('QUOTES' in LIB));
    bandTo('adult');
    const idx = LEVELS.findIndex(l => l.type === 'finale');
    session.levelIndex = idx; renderLevel();
    A(play.quotes.length === 3 && play.quotes.every(q => GLOSSARY_LINES.includes(q)));
  });
  test('5-4-3-2-1 统一为五步，急救版标注「急诊版」', () => {
    const tool = SH_TOOLS.find(t => t.t === '5-4-3-2-1 锚定');
    A(!!tool && tool.how.length === 5, '工具卡应写全五步');
    const stateWithMove = SH_STATES.find(s => s.moves.some(m => m.t === '5-4-3-2-1 锚定'));
    const move = stateWithMove.moves.find(m => m.t === '5-4-3-2-1 锚定');
    ['5 样', '4 样', '3 种', '2 种', '1 种'].forEach(k => A(move.d.includes(k), `状态动作缺「${k}」`));
    const ground = HELP_ACTIONS.find(a => a.id === 'ground');
    A(ground && ground.tag === '急诊版', '急救的落地动作应标急诊版');
    /* 0.19 文案把「精简形态」改写成「急诊版」：三步 = 落地 / 呼吸 / 看到 3 样东西，
       完整的五步在工具箱。断言锁语义与三件事都在，不再绑死某四个字。 */
    A(ground && ground.lead.includes('急诊版'), '应说明这是急诊版');
    ['先落地', '呼吸', '3 样东西'].forEach(k =>
      A(ground.lead.includes(k), `急诊版文案缺「${k}」`));
  });
  test('选档页进急救：已有档回首页，无档回选档页', () => {
    bandTo('adult');
    renderAgeGate();
    ACTIONS['open-help']();
    A(session.helpFrom === 'home', '已有档时选档页只是过渡屏');
    let back = document.querySelector('#stage [data-action="help-close"]');
    A(back.textContent.includes('回到首页'));
    back.click();
    A(session.view === 'home' && location.hash === '#/home');
    state.band = null; applySettings(); renderAgeGate();
    ACTIONS['open-help']();
    A(session.helpFrom === 'gate');
    back = document.querySelector('#stage [data-action="help-close"]');
    A(back.textContent.includes('回到选年龄段'));
    back.click();
    A(session.view === 'gate' && location.hash === '#/gate');
  });
  test('选档页有图卡与朗读按钮，3-6 岁首次选档自动读题', () => {
    /* 选档页：四档都有图标和独立朗读按钮，点朗读不进档。 */
    bandTo('adult'); state.settings.autoSpeak = false; renderAgeGate();
    const picks = [...document.querySelectorAll('#stage .age-pick')];
    A(picks.length === AGE_BANDS.length, '选档页每档一张卡');
    A(picks.every(p => p.querySelector('.age-icon') && p.querySelector('.age-card') && p.querySelector('.age-read')),
      '每张档位卡应有图标、进入按钮与朗读按钮');
    const beforeBand = state.band;
    const readA3 = document.querySelector('#stage .age-read[data-b="a3"]');
    A(readA3 && readA3.dataset.action === 'speak-band', '朗读按钮应带 speak-band 动作');
    readA3.click();
    A(state.band === beforeBand && session.view === 'gate', '点朗读不应进档');
    /* 首次选 a3 自动开朗读；第二次选档不再覆盖用户的手动关闭。 */
    state.band = null; state.settings.autoSpeak = false; applySettings();
    const a3 = AGE_BANDS.find(b => b.id === 'a3');
    ACTIONS['set-band']({ dataset: { b: 'a3', next: 'home' } });
    A(state.settings.autoSpeak === true, '首次选 3-6 岁应自动读题');
    state.settings.autoSpeak = false;
    ACTIONS['set-band']({ dataset: { b: 'a6', next: 'home' } });
    A(state.settings.autoSpeak === false, '非首次选档不应再打开自动朗读');
    bandTo('a6'); renderHome();
  });

  test('从头再来后已完成的幕仍可回看与直达', () => {
    bandTo('adult');
    state.cleared = []; state.sideCleared = ['W-1', 'W-2']; session.levelIndex = 0;
    save(); applySettings();
    renderWork();
    const stop = document.querySelector('#stage [data-action="open-work-level"][data-i="0"]');
    A(!!stop && !stop.disabled, '已完成的幕不应被锁');
    stop.click();
    A(session.view === 'level' && currentLevel().id === 'W-1' && !!play.side);
    renderWork();
    routeTo(parseHash('#/level/W-2'));
    A(session.view === 'level' && currentLevel().id === 'W-2', '直达已完成的幕也应放行');
    bandTo('a6');
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
    state.cleared = KID.levels.slice(0, 20).map(l => l.id);
    goLevel(20);
    A(document.getElementById('stage').innerHTML.includes('island-canvas'));
    bandTo('adult');
    state.cleared = ADULT.levels.slice(0, 20).map(l => l.id);
    goLevel(20);
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
  test('进度格只有当前一座岛带 aria-current', () => {
    bandTo('a6');
    const i = byType('clue');
    goLevel(i);
    const segs = [...document.querySelectorAll('#step-track .seg-isl')];
    A(segs.length === islands().length + 1, `应为每岛一段 + 终章一段，实际 ${segs.length}`);
    A(!document.querySelector('#step-track .step'), '不再画每站一格');
    const cur = segs.filter(s => s.getAttribute('aria-current') === 'step');
    A(cur.length === 1 && cur[0].getAttribute('aria-label').startsWith(`岛 ${LEVELS[i].island}`), '只应标出当前所在的岛');
    A(segs.every(s => /走过 \d+ 站，共 \d+ 站/.test(s.getAttribute('aria-label'))), '每段都应读出走过几站、共几站');
    A(document.getElementById('progress-text').textContent.startsWith(`岛 ${LEVELS[i].island} · 第 ${LEVELS[i].num} 站`));
    /* 点第一岛：进它下一处没走过的站；终章未开放时那一段不可点 */
    state.cleared = [KID.levels[0].id]; renderMap();
    document.querySelectorAll('#step-track .seg-isl')[0].click();
    A(session.view === 'level' && session.levelIndex === 1, '点岛应进这座岛下一处没走过的站');
    A(document.querySelector('#step-track .seg-isl.is-finale').disabled === true, '终章未开放时不可点');
    state.cleared = [];
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
  test('两轨岛末站都发放与概念绑定的实践卡，终章不发放', () => {
    bandTo('a6');
    session.levelIndex = KID.levels.findIndex(l => l.id === '4-4');
    renderLevel();
    session.clearedThisRun = 0;
    completeLevel('测试');
    const kidCard = document.querySelector('.practice-card');
    A(kidCard && kidCard.textContent.includes('这一站带走一个动作'));
    A(kidCard.textContent.includes(conceptOfLevel('4-4').practice));
    A(kidCard.querySelector('[data-action="pocket-add"]'));
    bandTo('adult');
    session.levelIndex = ADULT.levels.findIndex(l => l.id === 'A4-4');
    renderLevel();
    session.clearedThisRun = 0;
    completeLevel('测试');
    const adultCard = document.querySelector('.practice-card');
    A(adultCard && adultCard.textContent.includes(conceptOfLevel('A4-4').practice));
    bandTo('a6');
    goLevel(20);
    session.clearedThisRun = 0;
    completeLevel('测试');
    A(!document.querySelector('.practice-card'));
  });
  test('进度格点击区不小于 44×30', () => {
    bandTo('a6'); renderMap();
    const segs = [...document.querySelectorAll('#step-track .seg-isl')];
    A(segs.length > 0 && segs.every(s => { const r = s.getBoundingClientRect(); return r.height >= 30 && r.width >= 44; }),
      `每段应不小于 44×30，实际 ${segs.map(s => Math.round(s.getBoundingClientRect().width)).join('/')}`);
  });

  /* ---------- 静修间扩容 / 2.0 ---------- */
  test('静修列表：此刻 3 张 / 5 族 / 更多 10 张', () => {
    bandTo('adult'); mdScene = 'all'; renderRetreatList();
    A(document.querySelectorAll('#stage .md-now-grid .md-card').length === 3);
    A(document.querySelectorAll('#stage .md-family').length === MD_FAMILIES.length);
    A(document.querySelectorAll('#stage .md-more .retreat-group-title').length === 4);
    A(document.querySelectorAll('#stage .md-more .retreat-card').length === RETREAT.length);
    A(document.getElementById('stage').innerHTML.includes(`${MD_PRACTICES.length} 条引导`));
  });
  test('冥想练习 5 族 × 2 档 / 6 场景 / 8 句 if-then', () => {
    A(MD_FAMILIES.length === 5 && MD_PRACTICES.length === 10);
    A(MD_SCENES.length === 6 && MD_INTENTS.length === 8);
    A(MD_FAMILIES.every(f =>
      MD_PRACTICES.some(p => p.family === f.id && p.dose === 1)
      && MD_PRACTICES.some(p => p.family === f.id && p.dose === 3)));
  });
  test('静修场景筛选只显示匹配的短版', () => {
    bandTo('adult'); mdScene = 'all'; renderRetreatList();
    const btn = [...document.querySelectorAll('.md-scene')].find(b => b.dataset.s === 'sleep');
    A(!!btn); btn.click();
    const cards = [...document.querySelectorAll('.md-now-grid .md-card')];
    A(cards.length >= 2 && cards.length <= 3, `睡前应 2–3 张，实际 ${cards.length}`);
    A(cards.every(c => MD_PRACTICE_BY_ID[c.dataset.id].scenes.includes('sleep')));
    const active = [...document.querySelectorAll('.md-scene')].find(b => b.dataset.s === 'sleep');
    A(active.classList.contains('on') && active.getAttribute('aria-pressed') === 'true');
    mdScene = 'all'; renderRetreatList();
  });
  test('从「此刻」卡片点击进入 sit', () => {
    bandTo('adult'); mdScene = 'all'; renderRetreatList();
    const card = document.querySelector('.md-now-grid .md-card');
    A(!!card); card.click();
    A(session.view === 'retreat' && play.type === 'sit');
    A(!!document.getElementById('sit-body'));
  });
  test('sit 练习逐步前进、先停在这儿，且不写存档', () => {
    bandTo('adult');
    const before = localStorage.getItem('mood-island-v5');
    renderMeditatePractice('breath-1');
    A(play.type === 'sit' && play.step === 0);
    A(!!document.querySelector('.md-step') && !!document.querySelector('[data-action="md-next"]'));
    ACTIONS['md-next']();
    A(play.step === 1);
    ACTIONS['md-stop']();
    A(play.stopped === true);
    A(document.getElementById('retreat-result').textContent.includes('停在这里也可以'));
    A(localStorage.getItem('mood-island-v5') === before, '静修练习不应写 localStorage');
  });
  test('sit 做完显示机制与 if-then，可换一句', () => {
    bandTo('adult'); renderMeditatePractice('fist-1');
    play.step = play.data.steps.length; paintSit();
    const text = document.getElementById('retreat-result').textContent;
    A(text.includes('你刚刚做的是') && text.includes('带回一句'));
    const idx = MD_INTENTS.findIndex(x => x.family === 'fist');
    A(idx >= 0);
    A(document.getElementById('md-intent-text').textContent === MD_INTENTS[idx].t);
    ACTIONS['md-intent']();
    A(document.getElementById('md-intent-text').textContent === MD_INTENTS[(idx + 1) % MD_INTENTS.length].t);
    A(!document.body.textContent.includes('连续天数'));
  });
  test('首页 1 分钟练习快捷入口只在成年轨', () => {
    const keepCleared = state.cleared.slice();
    bandTo('adult'); state.cleared = []; renderHome();
    A(!!document.querySelector('#stage .home-main .actions [data-action="open-retreat"]'), '成年首页静修间是第二按钮');
    A(!document.querySelector('#stage .home-work'), '工作间未开放时首页不放入口');
    state.cleared = [WORK_GATE]; renderHome();
    A(!!document.querySelector('#stage .home-work[data-action="go-work"]'), '工作间开放后首页给入口');
    state.cleared = keepCleared;
    bandTo('a6'); renderHome();
    A(!document.querySelector('#stage [data-action="open-retreat"]') && !document.querySelector('#stage .home-work'));
  });
  test('静修 2.0 在 390px 无横向溢出且为单列', () => {
    bandTo('adult'); mdScene = 'all'; renderRetreatList();
    A(document.documentElement.scrollWidth <= window.innerWidth + 1,
      `静修列表 scrollWidth=${document.documentElement.scrollWidth}`);
    A(getComputedStyle(document.querySelector('.md-now-grid')).gridTemplateColumns.split(' ').length === 1);
    A(getComputedStyle(document.querySelector('.md-family-grid')).gridTemplateColumns.split(' ').length === 1);
    renderMeditatePractice('breath-1');
    A(document.documentElement.scrollWidth <= window.innerWidth + 1,
      `sit 练习页 scrollWidth=${document.documentElement.scrollWidth}`);
  });
  test('静修练习页显示对应概念、机制与规格', () => {
    bandTo('adult');
    const i = RETREAT.findIndex(r => r.type === 'ground');
    renderRetreatPractice(i);
    const block = document.querySelector('.retreat-concept');
    A(!!block, '静修页应显示概念块');
    A(block.textContent.includes('身体信号'));
    A(block.textContent.includes(conceptOfRetreat(RETREAT[i]).mechanism.slice(0, 10)));
    A(block.textContent.includes('动作规格'));
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

  /* ---------- 0.14.1 修复回归 ---------- */
  /* 下面几条会通关 / 改计数，跑完后按快照还原，避免污染后面的布局断言。 */
  const snapshotProgress = () => ({
    cleared: state.cleared.slice(), awarded: state.awarded.slice(), skills: state.skills.slice(),
    cards: JSON.parse(JSON.stringify(state.cards)), shells: state.shells, run: session.clearedThisRun,
    idx: session.levelIndex, play, interrupted: session.interrupted
  });
  const restoreProgress = (snap) => {
    state.cleared = snap.cleared; state.awarded = snap.awarded; state.skills = snap.skills;
    state.cards = snap.cards; state.shells = snap.shells; session.clearedThisRun = snap.run;
    session.levelIndex = snap.idx; play = snap.play; session.interrupted = snap.interrupted;
    if (restTimer) { clearTimeout(restTimer); restTimer = null; }
    closeModal(); save();
  };

  test('B1 通关后开急救再返回，结果卡与「去下一站 / 回地图」仍在', () => {
    bandTo('a6');
    const snap = snapshotProgress();
    try {
      session.levelIndex = 0; play = {}; renderLevel();
      completeLevel('测试');
      A(!!document.querySelector('#feedback-slot .result-card'), '通关后应有结果卡');
      A(!!document.querySelector('#feedback-slot [data-action="next-level"]'), '结果卡应有「去下一站」');
      A(!!document.querySelector('#feedback-slot [data-action="go-map"]'), '结果卡应有「回地图」');
      ACTIONS['open-help']();
      A(session.view === 'help' && !!helpResume && helpResume.done === true, '急救应暂存已完成的进行态');
      ACTIONS['help-close']();
      A(session.view === 'level');
      A(document.querySelectorAll('#feedback-slot .result-card').length === 1, '返回后结果卡应重画一次');
      A(!!document.querySelector('#feedback-slot [data-action="next-level"]'), '返回后「去下一站」仍可达');
      A(!!document.querySelector('#feedback-slot [data-action="go-map"]'), '返回后「回地图」仍可达');
    } finally { restoreProgress(snap); renderMap(); }
  });

  test('B2 休息弹窗随换页取消，复玩同一站不再计数', () => {
    bandTo('a6');
    const snap = snapshotProgress();
    const rest = band().rest;
    try {
      session.clearedThisRun = rest - 1;
      state.cleared = state.cleared.filter(id => id !== LEVELS[0].id);
      state.awarded = state.awarded.filter(id => id !== LEVELS[0].id);
      session.levelIndex = 0; play = {}; renderLevel();
      completeLevel('测试');
      A(session.clearedThisRun === rest, `首次通关后本轮计数应为 ${rest}，实际 ${session.clearedThisRun}`);
      A(restTimer !== null, '到点后应排一次休息提醒');
      session.levelIndex = 1; play = {}; renderLevel();
      A(restTimer === null, '换到下一站时应取消休息提醒');
      const before = session.clearedThisRun;
      session.levelIndex = 0; play = {}; renderLevel();
      completeLevel('测试');
      A(session.clearedThisRun === before, '复玩同一站不应再自增');
      A(restTimer === null, '复玩不应重新排休息提醒');
    } finally { restoreProgress(snap); renderMap(); }
  });

  test('B3 设置里切换开关保留滚动位置与焦点', () => {
    bandTo('a6');
    const snapSpeak = state.settings.speak;
    openSettings();
    const modal = overlay.querySelector('.modal');
    A(!!modal, '设置弹窗应打开');
    modal.scrollTop = 300;
    const scrolled = modal.scrollTop;
    A(scrolled > 0, `设置弹窗应可滚动，实际 scrollTop=${scrolled}`);
    const btn = modal.querySelector('[data-action="toggle-flag"][data-k="speak"][data-v="0"]');
    A(!!btn, '设置里应有朗读开关');
    btn.focus();
    btn.click();
    const next = overlay.querySelector('.modal');
    A(next.scrollTop === scrolled, `重建后滚动位置应保留，实际 ${next.scrollTop}`);
    const back = next.querySelector('[data-action="toggle-flag"][data-k="speak"][data-v="0"]');
    A(document.activeElement === back, '焦点应回到同一个开关按钮');
    state.settings.speak = snapSpeak; save(); applySettings();
    closeModal();
  });

  test('B4 完成呼吸后不再残留「呼吸被打断」', () => {
    bandTo('a6');
    const snap = snapshotProgress();
    try {
      const i = byType('breath');
      A(i >= 0, '应能找到呼吸站');
      session.levelIndex = i; play = {}; renderLevel();
      ACTIONS['breath-start']();
      A(breathTimer !== null && play.running === true, '呼吸应开始计时');
      ACTIONS['open-help']();
      A(session.interrupted === true, '中途离开应记为被打断');
      ACTIONS['help-close']();
      ACTIONS['breath-done']();
      A(session.interrupted === false, '完成这一站后提示状态应清掉');
      ACTIONS['go-map']();
      A(![...document.querySelectorAll('.notice')].some(n => n.textContent.includes('呼吸练习被打断')),
        '地图上不应再出现被打断提示');
    } finally { restoreProgress(snap); renderMap(); }
  });

  test('B5 首页 meta description 的词典条数与实际一致', () => {
    const meta = document.querySelector('meta[name="description"]');
    A(!!meta, '首页应有 meta description');
    A(meta.content.includes(`${DICTIONARY.length} 条心理学词典`), `meta 应写 ${DICTIONARY.length} 条，实际：${meta.content}`);
    A(!meta.content.includes('159 条'), '不应残留旧条数');
    A(meta.content.includes('5 座岛 21 站'), '站点数应仍准确');
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
    const svDailyCols = getComputedStyle(document.getElementById('sv-daily')).gridTemplateColumns.split(' ').length;
    A(svDailyCols === 1, `五件套在 390px 应为单列，实际 ${svDailyCols} 列`);
    const svBudgetCols = getComputedStyle(document.querySelector('.sv-budget-grid')).gridTemplateColumns.split(' ').length;
    A(svBudgetCols === 1, `时间预算在 390px 应为单列，实际 ${svBudgetCols} 列`);
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

  test('360 / 414px 视口无横向溢出', () => {
    const atWidth = (w, fn) => {
      const fe = window.frameElement;
      A(!!fe, '回归页需要跑在 iframe 里才能改视口');
      const old = fe.style.width;
      fe.style.width = w + 'px';
      void fe.getBoundingClientRect();
      A(window.innerWidth === w, `视口未切到 ${w}px：innerWidth=${window.innerWidth}`);
      try { fn(); } finally {
        fe.style.width = old;
        void fe.getBoundingClientRect();
        A(window.innerWidth === 390, `恢复视口失败：innerWidth=${window.innerWidth}`);
      }
    };
    [360, 414].forEach((w) => {
      atWidth(w, () => {
        bandTo('a6');
        renderMap();
        A(document.documentElement.scrollWidth <= w + 1,
          `${w}px 地图 scrollWidth=${document.documentElement.scrollWidth}`);
        const hubCols = getComputedStyle(document.querySelector('.hub-grid')).gridTemplateColumns.split(' ').length;
        A(hubCols === 1, `${w}px 地图入口卡应为单列，实际 ${hubCols} 列`);
        A([...document.querySelectorAll('.hub-card')].every(c => c.getBoundingClientRect().height >= 44));

        ACTIONS['open-dictionary']();
        A(document.documentElement.scrollWidth <= w + 1,
          `${w}px 词典 scrollWidth=${document.documentElement.scrollWidth}`);
        A(getComputedStyle(document.getElementById('dict-grid')).gridTemplateColumns.split(' ').length === 1,
          `${w}px 词典应为单列`);

        ACTIONS['open-selfhelp']();
        A(document.documentElement.scrollWidth <= w + 1,
          `${w}px 自助 scrollWidth=${document.documentElement.scrollWidth}`);
        A(getComputedStyle(document.getElementById('sh-grid')).gridTemplateColumns.split(' ').length === 1,
          `${w}px 自助工具应为单列`);

        ACTIONS['open-slowvars']();
        A(document.documentElement.scrollWidth <= w + 1,
          `${w}px 慢变量 scrollWidth=${document.documentElement.scrollWidth}`);
        A(getComputedStyle(document.getElementById('sv-grid')).gridTemplateColumns.split(' ').length === 1,
          `${w}px 慢变量卡应为单列`);

        bandTo('adult');
        ACTIONS['open-help']();
        A(document.documentElement.scrollWidth <= w + 1,
          `${w}px 急救 scrollWidth=${document.documentElement.scrollWidth}`);
        renderMap();
      });
    });
    bandTo('a6'); renderMap();
  });

  /* ---------- 档位合并 / 深度层 / 学习闭环 / 两个人一起选 ---------- */
  test('旧档 a9 迁到 a6，进度 / 词卡 / 贝壳 / 字号都不丢', () => {
    const raw = {
      version: 5, band: 'a9', cleared: ['1-1'], awarded: ['1-1'],
      cards: { kid: ['觉察'], adult: [] }, skills: ['注意到自己有感觉'], shells: 4,
      settings: { scale: 1.06 }
    };
    const m = migrate(JSON.parse(JSON.stringify(raw)));
    A(m.band === 'a6');
    A(m.cleared.includes('1-1') && m.awarded.includes('1-1'));
    A(m.cards.kid.includes('觉察') && m.skills.includes('注意到自己有感觉'));
    A(m.shells === 4 && m.settings.scale === 1.06);
  });
  test('题库不再引用 a9，a6 档每关两层都有题', () => {
    const ids = KID.levels.filter(l => l.type !== 'finale').map(l => l.id);
    A(ids.every(id => {
      const pool = (BANK[id] || []).filter(v => v.b.includes('a6'));
      return pool.filter(v => (v.tier || 1) === 1).length >= 2 && pool.filter(v => v.tier === 2).length >= 1;
    }));
    A(Object.values(BANK).flat().every(v => !v.b.includes('a9')));
  });
  test('首次进站抽基础层，走过一次自动进「多想一步」', () => {
    bandTo('a6'); session.depth = null; state.cleared = [];
    session.levelIndex = KID.levels.findIndex(l => l.id === '2-3');
    renderLevel();
    A(play.depth === 1 && (play.v.tier || 1) === 1);
    state.cleared.push('2-3');
    renderLevel();
    A(play.depth === 2 && play.v.tier === 2);
    state.cleared = []; session.depth = null;
  });
  test('手动切层不写存档，换档后回到自动决定', () => {
    bandTo('a6'); session.depth = null;
    session.levelIndex = KID.levels.findIndex(l => l.id === '2-3');
    renderLevel();
    const before = localStorage.getItem('mood-island-v5');
    ACTIONS['set-depth']({ dataset: { d: '2' } });
    A(session.depth === 2 && play.v.tier === 2);
    A(localStorage.getItem('mood-island-v5') === before, '切层不应写存档');
    ACTIONS['set-band']({ dataset: { b: 'all', next: 'home' } });
    A(session.depth === null && session.pocket === null);
    bandTo('a6');
  });
  test('结果卡详细度跟着当前题的深度走，不再绑年龄段', () => {
    bandTo('a6'); session.depth = 1;
    session.levelIndex = 0; renderLevel();
    session.clearedThisRun = 0; completeLevel('测试');
    A(!!document.querySelector('.result-more'), '基础层应折叠成人说明');
    session.depth = 2; renderLevel();
    session.clearedThisRun = 0; completeLevel('测试');
    A(!document.querySelector('.result-more'), '进阶层应显示完整六行');
    session.depth = null;
  });
  test('关卡页有站间承接句，概念层 16 条都有桥与实践卡', () => {
    bandTo('a6'); session.depth = null;
    session.levelIndex = KID.levels.findIndex(l => l.id === '1-2');
    renderLevel();
    const bridge = document.querySelector('.level-bridge');
    A(bridge && bridge.textContent.includes('这一站接着'));
    A(bridge.textContent.includes(conceptOfLevel('1-2').bridge));
    A(GLOSSARY.length === 20 && GLOSSARY.every(g => g.bridge && g.practice));
  });
  test('带回下一站的实践卡只出现一次，不写存档', () => {
    bandTo('a6'); session.depth = null; session.pocket = null;
    session.levelIndex = KID.levels.findIndex(l => l.id === '1-4');
    renderLevel();
    session.clearedThisRun = 0; completeLevel('测试');
    const btn = document.querySelector('[data-action="pocket-add"]');
    A(btn);
    const before = localStorage.getItem('mood-island-v5');
    ACTIONS['pocket-add'](btn);
    A(session.pocket && session.pocket.from === '1-4');
    A(localStorage.getItem('mood-island-v5') === before, '口袋不该落盘');
    session.levelIndex = KID.levels.findIndex(l => l.id === '2-1');
    renderLevel();
    A(document.querySelector('.level-bridge').textContent.includes('上一站带走的'));
    A(session.pocket === null, '取用后应清掉');
    session.levelIndex = KID.levels.findIndex(l => l.id === '2-2');
    renderLevel();
    A(!document.querySelector('.level-bridge').textContent.includes('上一站带走的'), '不该重复出现');
  });
  test('两个人一起选：两轮后并排看，不推进进度、不写存档', () => {
    bandTo('a6'); session.depth = null; state.cleared = [];
    session.levelIndex = KID.levels.findIndex(l => l.id === '2-2');
    renderLevel();
    const before = localStorage.getItem('mood-island-v5');
    const clearedBefore = state.cleared.length;
    ACTIONS['duo-open']();
    A(session.duo && session.duo.step === 1 && session.duo.opts.length >= 2);
    ACTIONS['duo-pick']({ dataset: { i: '0' } });
    A(session.duo.step === 2 && session.duo.first === 0);
    ACTIONS['duo-pick']({ dataset: { i: '1' } });
    A(session.duo.step === 3);
    const panel = document.querySelector('.duo-panel');
    A(panel && panel.textContent.includes('第一个人') && panel.textContent.includes('第二个人'));
    A(!play.done && state.cleared.length === clearedBefore, '双人选择不该通关');
    A(localStorage.getItem('mood-island-v5') === before, '双人选择不该写存档');
    ACTIONS['duo-close']();
    A(session.duo === null && !document.querySelector('.duo-panel'));
  });
  test('首站天气主按钮默认可用，选过之后换文案', () => {
    bandTo('a6'); session.depth = null;
    session.levelIndex = 0; renderLevel();
    const go = document.getElementById('weather-go');
    A(go && !go.disabled, '首站主按钮不该禁用');
    A(go.textContent.includes('就这样出发'));
    ACTIONS['weather-pick']({ dataset: { i: '0' } });
    A(document.getElementById('weather-go').textContent.includes('带着'));
  });
  test('亲子档保留、成年档仍走独立轨，两者都不按深度层抽题', () => {
    A(AGE_BANDS.some(b => b.id === 'all' && b.track === 'kid'));
    A(AGE_BANDS.some(b => b.id === 'adult' && b.track === 'adult'));
    bandTo('all'); A(!band().tiers);
    bandTo('adult'); A(!band().tiers);
    bandTo('a6');
  });

  /* ---------- 0.19.0 运行时修复回归 ---------- */
  test('0.19 · 非法 percent-encoding 的 hash 不抛错、回落到首页', () => {
    bandTo('a6'); state.cleared = []; save(); renderHome();
    A(parseHash('#/level/%').view === 'bad', '坏编码应判为 bad 而不是抛 URIError');
    A(parseHash('#/level/%zz').view === 'bad');
    A(parseHash('#/level/%E0%A4%A').view === 'bad');
    routeTo(parseHash('#/level/%'));
    A(session.view === 'home' && location.hash === '#/home', '应落到首页并改写地址');
    A(stage.innerHTML.length > 100, '首屏不应空白（冷启动白屏回归）');
  });
  test('0.19 · 坏地址纠正走 replaceState，不往历史栈压记录', () => {
    bandTo('a6'); state.cleared = []; save(); renderHome();
    const before = history.length;
    routeTo(parseHash('#/nope'));
    A(session.view === 'home' && location.hash === '#/home');
    A(history.length === before, `坏地址纠正不该增加历史记录（${before} → ${history.length}）`);
    routeTo(parseHash('#/level/%-bad'));
    A(history.length === before, '坏编码地址纠正同样不该入栈');
  });
  test('0.19 · 儿童档慢变量页不渲染静修间入口，直接调动作也被挡', () => {
    bandTo('a6'); ACTIONS['open-slowvars']();
    A(document.querySelectorAll('[data-action="md-start"]').length === 0,
      '低龄档不应渲染静修间入口（UI 与动作层门禁一致）');
    ACTIONS['md-start']({ dataset: { id: MD_PRACTICES[0].id } });
    A(session.view === 'map', `应回到地图，实际 ${session.view}`);
    A(!play || play.type !== 'sit', '不应进入 sit 练习');
    ACTIONS['open-retreat']();
    A(session.view === 'map', 'open-retreat 在低龄档也应回到地图');
    bandTo('adult'); ACTIONS['open-slowvars']();
    A(document.querySelectorAll('[data-action="md-start"]').length > 0, '成年档应保留静修间入口');
    renderMap();
  });
  test('0.19 · 记忆翻牌中途进急救，返回后仍能继续翻牌', () => {
    bandTo('a6'); session.depth = null;
    const idx = byType('memory');
    A(idx >= 0, '应能找到记忆翻牌关');
    session.levelIndex = idx; renderLevel();
    A(play.type === 'memory');
    let a = -1, b = -1;
    for (let i = 0; i < play.deck.length && b < 0; i++) {
      for (let j = i + 1; j < play.deck.length; j++) {
        if (play.deck[i].pair !== play.deck[j].pair) { a = i; b = j; break; }
      }
    }
    A(a >= 0 && b >= 0, '应能找到一对不匹配的牌');
    ACTIONS['memo-flip']({ dataset: { i: String(a) } });
    ACTIONS['memo-flip']({ dataset: { i: String(b) } });
    A(play.lock === true, '不匹配时应进入锁定态');
    ACTIONS['open-help']();
    A(session.view === 'help', '应进入急救页');
    ACTIONS['help-close']();
    A(session.view === 'level' && play.type === 'memory', '应回到同一关');
    A(play.lock === false, '返回后必须解锁，否则整局点不动');
    A(play.open.size === 0, '两张不匹配牌应盖回，不该永远翻着');
    const next = [...document.querySelectorAll('#stage .memo-card')]
      .find(c => !c.disabled && !play.open.has(Number(c.dataset.i)));
    A(!!next, '应有可翻的牌');
    const before = play.open.size;
    ACTIONS['memo-flip']({ dataset: { i: next.dataset.i } });
    A(play.open.size === before + 1, '应能继续翻牌');
  });
  test('0.19 · slider 从急救返回后显示值与 play.value 一致', () => {
    bandTo('a6'); session.depth = null;
    const idx = byType('slider');
    A(idx >= 0, '应能找到温度计关');
    session.levelIndex = idx; renderLevel();
    A(play.type === 'slider');
    const input = document.getElementById('thermo');
    A(!!input, '应渲染滑块');
    const target = play.v.replies.length;
    input.value = String(target);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    A(play.value === target, '拖动应更新 play.value');
    ACTIONS['open-help']();
    ACTIONS['help-close']();
    A(session.view === 'level' && play.type === 'slider', '应回到同一关');
    const shown = document.getElementById('thermo');
    A(Number(shown.value) === play.value, `滑块显示 ${shown.value} 应与 play.value ${play.value} 一致`);
    A(document.getElementById('thermo-value').textContent.includes(String(play.value)), '读数也应一致');
  });
  test('0.19 · 通关后 toolbar 的双人按钮被禁用，结果卡按钮保留', () => {
    bandTo('a6'); session.depth = null;
    session.levelIndex = 0; renderLevel();
    const duo = document.querySelector('#stage .toolbar [data-action="duo-open"]');
    A(!!duo && !duo.disabled, '未通关时双人按钮可用');
    /* 工具栏一行：6-12 岁的双人与换题收进「更多」，深度开关挪到说明行，朗读合成一个 */
    const bar = document.querySelector('#stage .toolbar');
    A(!!bar.querySelector('.tool-more [data-action="duo-open"]') && !!bar.querySelector('.tool-more [data-action="reroll"]'), '双人与换题应在更多菜单里');
    A(!bar.querySelector('[data-action="set-depth"]') && !!document.querySelector('#stage .level-depth [data-action="set-depth"]'), '深度开关应在说明行');
    A(!bar.querySelector('[data-action="speak-question"], [data-action="speak-options"]'), '读题目 / 读选项应合并为读给我听');
    A([...bar.children].filter(el => el.tagName === 'BUTTON').length <= 2, '工具栏外露按钮不超过「地图 + 读给我听」');
    completeLevel('回归用通关文案');
    A(play.done === true);
    const after = document.querySelector('#stage .toolbar [data-action="duo-open"]');
    A(!!after && after.disabled, '通关后双人按钮应禁用');
    A(bar.querySelector('.tool-more').hidden === true, '更多里的项都收掉后，菜单整体收起');
    A(document.querySelector('#stage .level-depth [data-action="set-depth"]').hidden === true, '通关后深度开关也收起');
    A(!document.querySelector('.duo-panel'), '不该出现双人面板');
    ACTIONS['duo-open']();
    A(session.duo === null, '通关后直接调 duo-open 也不该开启面板');
    A(!!document.querySelector('#feedback-slot [data-action="reroll"]'), '结果卡里的「这站再玩一次」仍要保留');
  });
  test('0.19 · sit 练习中途进急救，返回仍停在同一练习同一步', () => {
    bandTo('adult');
    const p = MD_PRACTICES.find(x => x.steps && x.steps.length >= 3) || MD_PRACTICES[0];
    A(!!p);
    ACTIONS['md-start']({ dataset: { id: p.id } });
    A(session.view === 'retreat' && play.type === 'sit', '应进入 sit 引导');
    ACTIONS['md-next']();
    const step = play.step;
    A(step === 1, '应前进一步');
    ACTIONS['open-help']();
    A(session.view === 'help' && session.helpFrom === 'retreat');
    ACTIONS['help-close']();
    A(session.view === 'retreat' && play.type === 'sit', '应回到同一练习而不是列表');
    A(play.step === step, `应停在同一步 ${step}，实际 ${play.step}`);
    A(!!document.getElementById('sit-body'), '练习容器应重建');
    renderMap();
  });
  test('0.19 · 慢变量页仅低龄档显示年龄适配提示', () => {
    bandTo('a6'); ACTIONS['open-slowvars']();
    A(stage.textContent.includes('这一页更多写给大人；孩子可以先去玩主线'), '低龄档应显示提示');
    bandTo('adult'); ACTIONS['open-slowvars']();
    A(!stage.textContent.includes('这一页更多写给大人'), '成年档不应显示提示');
    bandTo('all'); ACTIONS['open-slowvars']();
    A(!stage.textContent.includes('这一页更多写给大人'), '亲子档不应显示提示');
    renderMap();
  });

  /* ---------- 1.0.0 健壮性收尾回归 ---------- */
  test('1.0 · 渲染期异常显示可读错误页，详情转义且重入不覆盖', () => {
    bandTo('a6'); renderMap();
    showFatalError('boom <script>alert(1)</script>');
    A(stage.textContent.includes('没能加载好'), '应显示可读错误页');
    A(!!document.querySelector('#stage [data-action="reload-app"]'), '应给出重新载入出口');
    A(!!document.querySelector('#stage [data-action="fatal-dismiss"]'), '应给出回到地图出口');
    A(!document.querySelector('#stage script'), '错误详情必须转义，不得注入脚本');
    A(stage.textContent.includes('alert(1)'), '详情仍要作为纯文本可读');
    showFatalError('第二条');
    A(!stage.textContent.includes('第二条'), '重入时不该用第二条覆盖已有提示');
    fatalShown = false;
    renderMap();
  });
  test('1.0 · 错误页「回到地图」复位重入保护，之后仍能兜住新异常', () => {
    bandTo('a6'); renderMap();
    showFatalError('第一次');
    A(fatalShown === true);
    ACTIONS['fatal-dismiss']();
    A(fatalShown === false, '回到地图后必须解除保护');
    A(session.view === 'map' && stage.innerHTML.length > 100, '应回到地图');
    showFatalError('第二次');
    A(stage.textContent.includes('第二次'), '之后的新异常仍要有提示');
    fatalShown = false;
    renderMap();
  });
  test('1.0 · 另一个标签页改了存档时提示一次，无关键不打扰', () => {
    bandTo('a6'); renderMap();
    storageNotified = false; closeModal();
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: '{}' }));
    A(overlay.classList.contains('open'), '应弹出提示');
    A(overlay.textContent.includes('另一个标签页'), '提示应说明冲突来源');
    A(!!overlay.querySelector('[data-action="reload-app"]'), '应给出载入最新进度的出口');
    closeModal(); storageNotified = false;
    window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-key', newValue: '1' }));
    A(!overlay.classList.contains('open'), '非存档键不该弹窗');
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: '{}' }));
    A(overlay.classList.contains('open'), '存档键仍要提示');
    closeModal(); storageNotified = false;
  });
  test('1.0 · 设置里有「装到主屏」：无安装事件时给手动路径，动作不抛错', () => {
    bandTo('a6'); renderMap();
    deferredInstallPrompt = null;
    openSettings();
    A(overlay.textContent.includes('装到主屏'), '设置里应有安装分组');
    A(overlay.textContent.includes('添加到主屏'), '不支持 beforeinstallprompt 时应给手动路径');
    A(!overlay.querySelector('[data-action="install-app"]'), '没有暂存事件时不该显示会空转的按钮');
    ACTIONS['install-app']();
    closeModal();
  });
  test('1.0 · 进站自动朗读的延迟句柄随切屏一起清掉', () => {
    bandTo('a6'); session.depth = null;
    state.settings.speak = true; state.settings.autoSpeak = true;
    session.levelIndex = 0; renderLevel();
    A(speakTimer !== null, '进站应挂起延迟朗读');
    clearAsyncTimers(); stopSpeech();
    A(speakTimer === null, '切屏时必须清掉延迟朗读，否则会读出下一页的内容');
    state.settings.autoSpeak = false;
    renderMap();
  });
  test('1.0 · 数字键选答案，不会误翻线索卡', () => {
    bandTo('a6'); session.depth = null;
    const idx = byType('clue');
    A(idx >= 0, '应能找到线索关');
    session.levelIndex = idx; renderLevel();
    A(play.type === 'clue');
    A(document.querySelectorAll('#stage .clue-card').length > 0, '应渲染线索卡');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    A(play.flipped.size === 0, '数字键应选答案，不该顺带翻开线索卡');
    renderMap();
  });
  test('1.0 · http(s) 下注入收紧的 CSP，且不放开内联脚本与 eval', () => {
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    A(!!m, 'http 下应注入 CSP meta');
    A(/script-src 'self'/.test(m.content), '脚本只允许同源');
    A(/object-src 'none'/.test(m.content) && /base-uri 'none'/.test(m.content), '应禁用 object / base');
    A(!/unsafe-eval/.test(m.content) && !/script-src[^;]*'unsafe-inline'/.test(m.content), '不应放开 eval 或内联脚本');
  });
  test('1.0 · 全部脚本都用 defer 保序，boot 之后才是注入的测试脚本', () => {
    const scripts = [...document.querySelectorAll('script[src]')];
    A(scripts.length >= 27, `脚本数量偏少：${scripts.length}`);
    A(scripts.every(s => s.hasAttribute('defer')), '任一脚本漏 defer 都会破坏保序或阻塞首屏');
    const srcs = scripts.map(s => s.getAttribute('src'));
    const bootAt = srcs.indexOf('js/boot.js');
    A(bootAt > 0 && bootAt === srcs.length - 2, `boot 应是倒数第二个脚本，实际位置 ${bootAt}/${srcs.length}`);
    A(srcs[0] === 'content/bands.js', '内容脚本仍要排在最前');
  });
  test('1.0 · 运行时游标 levelIndex 既不落盘也不进导出', () => {
    bandTo('a6'); session.levelIndex = 3; save();
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    A(!('levelIndex' in raw), '存档里不该出现 levelIndex');
    A(!('levelIndex' in exportPayload().state), '导出载荷同样不该带 levelIndex');
  });

  bandTo('a6');
  session.depth = null; session.pocket = null; session.duo = null;
  state.cleared = [];
  renderMap();

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
