/* js/actions-data.js · 数据与设置动作：选档 / 重开 / 安装 / 导出导入 / 显示 / 清空。
   由原 actions.js 拆分而来，向 actions-level.js 定义的主表追加动作。 */

Object.assign(ACTIONS, {
  'set-band': (el) => {
    const b = AGE_BANDS.find(x => x.id === el.dataset.b) || AGE_BANDS[1];
    const firstPick = !state.band;
    const prev = band();
    const customScale = state.settings.scale !== prev.scale;
    state.band = b.id;
    /* 换档回到按通关记录自动决定深度层；「带回下一站」的卡也只属于刚才那一趟。 */
    session.depth = null;
    session.pocket = null;
    session.undoRestart = null;
    if (firstPick || !customScale) state.settings.scale = b.scale;
    if (firstPick || !state.settings.speakTouched) state.settings.speak = b.speak;
    /* 3-6 岁首次选档时自动读题：孩子不识字，进站就该听到题目。
       只在首次选档生效，之后用户在设置里关掉就永远不再被打开。
       选档本身是一次点击，iOS 的「先交互才能出声」限制已满足。 */
    if (firstPick && b.id === 'a3') state.settings.autoSpeak = true;
    save(); applySettings(); closeModal();
    session.tip = b.id === 'adult'
      ? '已切换到「成年 · 心智整理」，换成一套成年人的站，另有一间静修间。儿童 / 亲子档的进度也还留着。'
      : `已切换到「${b.name} · ${b.tag}」，题目会换一批，进度和词卡都还在。`;
    session.navDir = '';
    if (el.dataset.next === 'map') renderMap(); else renderHome();
  },
  /* 「从头再来」先确认：界面上的按钮一律走 restart-ask，确认后才调 restart-all。 */
  'restart-ask': () => openModal(`<div class="modal-title">从头再来一轮？</div>
    <div class="modal-body"><p>会把这一轨走过的 <b>${clearedInTrack()}</b> 站重新标成「还没走」，每站的题目也会换一批。</p>
    <p>词卡、本领、贝壳和工作间都还留着。</p>
    <p class="muted">重来之后、开始下一站之前，还可以撤销；关掉页面后就不再提供撤销。</p></div>
    <div class="modal-actions"><button class="btn btn-secondary" data-action="close-modal">先不了</button>
    <button class="btn btn-primary" data-action="restart-all">确认重来</button></div>`),
  'restart-all': () => {
    /* 只重置当前轨的主线；另一条轨的进度、支线 sideCleared、拼装题的 seen 都不动。
       清之前把这一轨的 cleared 存进 session（只在内存，不落盘），供 restart-undo 恢复。 */
    const mine = new Set(LEVELS.map(l => l.id));
    session.undoRestart = { track: bandTrack(), ids: state.cleared.filter(id => mine.has(id)) };
    state.cleared = state.cleared.filter(id => !mine.has(id));
    session.clearedThisRun = 0; lastVariant = {}; save();
    closeModal();
    session.tip = '新的一轮，当前轨的主线重新开始；词卡、本领、贝壳、工作间和已见过的题型都还留着。';
    renderMap();
  },
  /* 撤销重来：把清掉的站并回去（期间若又走了别的站也保留），只认同一条轨。 */
  'restart-undo': () => {
    const u = session.undoRestart;
    session.undoRestart = null;
    if (u && u.track === bandTrack()) {
      u.ids.forEach(id => { if (!state.cleared.includes(id)) state.cleared.push(id); });
      save();
      session.tip = '已撤销，刚才走过的站都回来了。';
    }
    renderMap();
  },
  'open-settings': () => openSettings(),
  /* 底栏两个抽屉：先收抽屉再执行原动作，遮罩不会盖住新页面。
     走 ACTIONS 查表而不是直接调函数，保持「所有入口都过同一张动作表」。 */
  'open-tools': () => openToolsSheet(),
  'open-mine': () => openMineSheet(),
  'sheet-go': (el) => {
    const to = el.dataset.to;
    const fn = ACTIONS[to];
    closeModal();
    if (fn) fn(el);
  },
  /* 安装到主屏：用先前暂存的 beforeinstallprompt 调起安装。
     deferredInstallPrompt 由 boot.js 在运行时赋值，存在此处只读取。 */
  'install-app': () => {
    if (!deferredInstallPrompt) return;
    try {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(() => { deferredInstallPrompt = null; }).catch(() => { deferredInstallPrompt = null; });
    } catch (e) { /* noop */ }
  },
  'export-progress': () => exportProgress(),
  'import-progress': () => pickImportFile(),
  'cancel-import': () => { pendingImport = null; closeModal(); openSettings(); },
  'import-confirm': () => {
    if (!pendingImport) return;
    /* 先留一份内存快照，再覆盖；写盘失败也不影响撤销（快照不依赖 localStorage） */
    const before = clone(state);
    const fileName = pendingImport.fileName;
    state = pendingImport.state;
    pendingImport = null;
    importUndo = before;
    session.undoRestart = null;
    save(); applySettings();
    closeModal();
    openModal(`<div class="modal-title">导入完成</div>
      <div class="modal-body">
        <p>已用 <b>${esc(fileName || '这份文件')}</b> 覆盖当前进度。年龄段与显示设置也一起换成了文件里的。</p>
        <p class="muted">如果选错了文件，现在还可以恢复成导入前的那一份；关掉页面后就不再提供撤销。</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="import-undo">撤销这次导入</button>
        <button class="btn btn-primary" data-action="import-finish">好，继续</button>
      </div>`);
  },
  'import-undo': () => {
    if (importUndo) {
      state = importUndo;
      save(); applySettings();
    }
    importUndo = null;
    closeModal();
    session.tip = '已撤销这次导入，恢复到导入前的进度。';
    if (!state.band) renderAgeGate(); else renderHome();
  },
  'import-finish': () => {
    importUndo = null;
    closeModal();
    session.tip = '进度已导入。';
    if (!state.band) renderAgeGate(); else renderHome();
  },
  'set-scale': (el) => { state.settings.scale = Number(el.dataset.v); save(); applySettings(); openSettings(); },
  'toggle-flag': (el) => {
    state.settings[el.dataset.k] = el.dataset.v === '1';
    if (el.dataset.k === 'speak') state.settings.speakTouched = true;
    save(); applySettings();
    if (!state.settings.speak) stopSpeech();
    openSettings();
  },
  'clear-progress': () => openModal(`<div class="modal-title">确认清空？</div>
    <div class="modal-body"><p>会清掉这台设备上记录的站点进度、词卡、本领、贝壳和小岛摆设，无法撤销。年龄段和显示设置会保留。</p></div>
    <div class="modal-actions"><button class="btn btn-secondary" data-action="open-settings">先不清了</button>
    <button class="btn btn-primary" data-action="clear-progress-confirm">确认清空</button></div>`),
  'clear-progress-confirm': () => {
    const keep = { band: state.band, settings: state.settings };
    removeAllSaves();
    state = clone(DEFAULT_STATE); state.band = keep.band; state.settings = keep.settings;
    save(); session.clearedThisRun = 0; session.undoRestart = null; closeModal(); renderHome();
  },
});
