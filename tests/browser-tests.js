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

  /* ---------- 存档与迁移 ---------- */
  test('v2 旧档迁移到 v3，3-5 改名 finale，旧键保留', () => {
    localStorage.removeItem('mood-island-v3');
    localStorage.setItem('mood-island-v2', JSON.stringify({
      band: 'a6', cleared: ['1-1', '3-5'], shells: 4, cards: ['觉察']
    }));
    state = load();
    A(state.version === 3);
    A(state.cleared.includes('finale') && !state.cleared.includes('3-5'));
    A(localStorage.getItem('mood-island-v2') !== null);
  });
  test('坏存档回落默认值，不抛错', () => {
    const s = migrate(null);
    A(s.version === 3 && Array.isArray(s.cleared));
  });
  test('save 写入 v3 新键', () => {
    save();
    const raw = localStorage.getItem('mood-island-v3');
    A(!!raw && JSON.parse(raw).version === 3);
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
  test('成年档隐藏贝壳', () => {
    bandTo('adult'); updateTopbar();
    A(document.getElementById('shell-count').hidden === true);
  });
  test('restart-all 只清当前轨', () => {
    state.cleared = ['1-1', '1-2', 'A1-1'];
    bandTo('a6');
    ACTIONS['restart-all']();
    A(!state.cleared.includes('1-1') && state.cleared.includes('A1-1'));
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
  test('弹窗有 aria-label，Tab 焦点不跑出去', () => {
    openModal('<div class="modal-title">测试弹窗</div><button>一</button><button>二</button>');
    A(overlay.querySelector('.modal').getAttribute('aria-label') === '测试弹窗');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    A(overlay.contains(document.activeElement));
    closeModal();
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
  test('页面没有自由文本输入框', () => {
    bandTo('a6');
    goLevel(byType('slider'));
    A(document.querySelectorAll('input:not([type="range"]), textarea').length === 0);
  });
  test('390px 视口无横向溢出', () => {
    renderMap();
    A(document.documentElement.scrollWidth <= window.innerWidth + 1,
      `scrollWidth=${document.documentElement.scrollWidth} innerWidth=${window.innerWidth}`);
  });

  const pre = document.createElement('pre');
  pre.id = '__e2e_result__';
  pre.style.display = 'none';
  pre.textContent = JSON.stringify({ total: lines.length, failed, lines });
  document.body.appendChild(pre);
});
