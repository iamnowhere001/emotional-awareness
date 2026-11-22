/* js/shell.js · 壳层：视图配置表、顶栏与进度、hash 路由、反馈、解锁链、朗读。
   经典脚本顺序加载，与 js/core.js 共享全局词法作用域；不要在此重复声明已有的顶层名字。 */

/* 视图配置表：进度条是否显示、Esc 回哪里、顶栏进度文字、档位标签，都在这里一次声明。
   新增视图只改这张表；scripts/regression.mjs 会校验所有 session.view 都登记过，
   避免「加了视图却忘了藏进度条 / 忘了 Esc 回地图」。 */
const VIEW_CONFIG = {
  gate: { progress: false, esc: null, title: null, band: false },
  home: { progress: false, esc: null, title: null, band: true },
  map: { progress: true, esc: null, title: 'progress', band: true },
  level: { progress: true, esc: 'map', title: 'current', band: true },
  /* 急救入口：Esc 回到进入前的那一屏，而不是固定回地图（可能从首页 / 选档页进来） */
  help: { progress: false, esc: 'back', title: null, band: true },
  retreat: { progress: false, esc: 'map', title: null, band: true },
  dict: { progress: false, esc: 'map', title: null, band: true },
  selfhelp: { progress: false, esc: 'map', title: null, band: true },
  slowvars: { progress: false, esc: 'map', title: null, band: true },
  /* 成年专题「工作间」：时间线视图，支线进度不算进主线站数 */
  work: { progress: false, esc: 'map', title: null, band: true }
};
function viewCfg(v) { return VIEW_CONFIG[v] || {}; }
/* 顶栏分岛进度的分组：按 LEVELS 的 island 字段归岛（终章 island 为 0，单独一段放最后）。
   岛名取 islands() 里的 name，取不到就写「岛 N」。 */
function progressGroups() {
  const groups = [];
  LEVELS.forEach((l, i) => {
    const key = l.type === 'finale' ? 'finale' : l.island;
    let g = groups.find(x => x.key === key);
    if (!g) {
      const isl = islands().find(x => x.n === l.island);
      g = { key, finale: l.type === 'finale', name: l.type === 'finale' ? '终章' : `岛 ${l.island}${isl && isl.name ? ' ' + isl.name : ''}`, idx: [] };
      groups.push(g);
    }
    g.idx.push(i);
  });
  return groups.filter(g => !g.finale).concat(groups.filter(g => g.finale));
}
/* 贝壳是否出现 / 发放由 bands.js 的 shells 字段决定，不在代码里按轨道 id 硬判 */
function hasShells() { return band().shells !== false; }
/* 当前轨走过的站数（两轨进度存在同一个数组里，各算各的） */
function clearedInTrack() {
  return state.cleared.filter(id => LEVELS.some(l => l.id === id)).length;
}
/* 下一站：已解锁、还没走过。终章也按同一规则；全部走完时返回 -1。
   首页主按钮与地图「从这里继续」共用这一处判断，避免两处各算一套。 */
function nextStationIndex() {
  return LEVELS.findIndex((l, i) => isUnlocked(i) && !state.cleared.includes(l.id));
}
function updateTopbar() {
  const vc = viewCfg(session.view);
  const shells = document.getElementById('shell-count');
  if (shells) {
    shells.hidden = !hasShells();
    shells.textContent = `贝壳 ${state.shells}`;
  }
  const bandEl = document.getElementById('topbar-band');
  if (bandEl) {
    bandEl.hidden = (!vc.band || !state.band);
    bandEl.textContent = state.band ? `${band().name} · ${band().tag}` : '';
  }
  /* 顶栏入口在两轨用不同措辞：孩子看到「有点难受」，成年 / 亲子看到「很难受」。
     未选档时按成人口径，避免把「找一个大人」直接推给一个成年人。 */
  const helpBtn = document.getElementById('help-entry');
  if (helpBtn) {
    const kid = isKidTone();
    helpBtn.textContent = kid ? '现在有点难受' : '现在很难受';
    helpBtn.setAttribute('aria-label', kid ? '打开 1 分钟安抚：现在有点难受' : '打开 1 分钟安抚与求助：现在很难受');
  }
  document.getElementById('progress-wrap').hidden = !vc.progress;
  /* 支线关卡里不画主线站点：17 个圆点会把「工作间只走一幕」误读成主线进度。
     只保留一句支线说明，主线的 cleared / TOTAL 一个都不动。 */
  const sideNow = session.view === 'level' && !!play.side;
  const track = document.getElementById('step-track');
  /* 分岛进度（docs/design-home-toolbar.html 方案 C）：21 个 9px 的站点格改成「每座岛一段 + 终章一段」。
     每段宽度够点（≥ 44px），填充比例 = 这座岛走过几站；点一段进这座岛「下一处没走过的站」，
     全走过就进岛的第一站。仍复用 open-level，解锁判断仍走 isUnlocked，不另起一套规则。
     只给当前所在的那一段标 aria-current。 */
  if (track) track.innerHTML = sideNow ? '' : progressGroups().map(g => {
    const doneN = g.idx.filter(i => state.cleared.includes(LEVELS[i].id)).length;
    const total = g.idx.length;
    const target = g.idx.find(i => isUnlocked(i) && !state.cleared.includes(LEVELS[i].id));
    const goI = target !== undefined ? target : g.idx.find(i => isUnlocked(i));
    const cur = session.view === 'level' && g.idx.includes(session.levelIndex);
    const pct = total ? Math.round(doneN / total * 100) : 0;
    const state_ = doneN === total ? 'done' : doneN > 0 ? 'part' : '';
    const label = `${g.name}，走过 ${doneN} 站，共 ${total} 站${goI === undefined ? '，还没解锁' : ''}`;
    return `<button class="seg-isl ${state_} ${cur ? 'current' : ''} ${g.finale ? 'is-finale' : ''}" data-action="open-level" data-i="${goI === undefined ? '' : goI}" ${goI === undefined ? 'disabled' : ''} ${cur ? 'aria-current="step"' : ''} title="${esc(label)}" aria-label="${esc(label)}"><span class="seg-fill" style="width:${pct}%"></span></button>`;
  }).join('');
  const pt = document.getElementById('progress-text');
  const curLv = LEVELS[session.levelIndex];
  if (pt) pt.textContent = sideNow
    ? `支线 · 工作间 ${currentLevel().time || ''} · 不计入 ${TOTAL} 站`
    : (vc.title === 'current' && curLv)
      ? (curLv.type === 'finale' ? `终章 · ${curLv.name}` : `岛 ${curLv.island} · 第 ${curLv.num} 站 · ${curLv.name}`)
      : `已走过 ${clearedInTrack()} / ${TOTAL} 站`;
  syncHash();
}
function viewClass() {
  return session.navDir === 'back' ? 'view enter-back'
    : session.navDir === 'forward' ? 'view enter-forward' : 'view';
}
/* 整屏重建时统一回到顶部：否则从 28533px 的词典回地图，会停在上一屏的 Y 坐标，
   把「从这里继续」埋在视口上方。地图自己会用 session.mapScroll 恢复指定位置。 */
function resetViewScroll() {
  try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { /* noop */ }
}

/* ---------------------------------------------------------------- hash 路由
   地址形如 #/map、#/level/4-2、#/help：刷新、收藏、分享都能回到同一屏。
   - 只认下面这张固定表，其余一律回落，不把用户留在坏地址上。
   - http(s) 下每次视图切换用 pushState 入栈，浏览器后退 / Android 物理返回 / iOS 侧滑
     才有落点，由 boot.js 的 popstate 映射回上一屏；file:// 下 pushState 常被拒，
     保持原来的 replaceState + location.hash 回落，双击打开的行为一字不变。
   - hash 里的 id 只查当前轨的关卡表：另一条轨的站视为「不可达」，回落地图。 */
const ROUTE_VIEWS = new Set(['gate', 'home', 'map', 'help', 'retreat', 'dict', 'selfhelp', 'slowvars', 'work']);
/* 首次路由前 session.view 只是占位值，不能拿它做「已在目标屏」的判断 */
let routeReady = false;

function parseHash(hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { view: null };
  if (parts[0] === 'level') {
    if (parts.length < 2) return { view: 'bad' };
    /* 地址栏是外部输入：非法 percent-encoding 会让 decodeURIComponent 抛 URIError。
       它曾在冷启动的顶层语句里冒泡，导致首屏再也不渲染（白屏），所以就地降级成坏地址。 */
    try {
      return { view: 'level', id: decodeURIComponent(parts.slice(1).join('/')) };
    } catch (e) { return { view: 'bad' }; }
  }
  if (parts.length > 1 || !ROUTE_VIEWS.has(parts[0])) return { view: 'bad' };
  return { view: parts[0] };
}

function hashFor(view) {
  if (view === 'level') {
    const lv = currentLevel();
    return lv ? `#/level/${encodeURIComponent(lv.id)}` : '#/map';
  }
  return `#/${view}`;
}

/* 把当前 session.view 同步回地址栏。幂等：地址已经是目标值就直接返回，
   所以 hashchange → 渲染 → syncHash 不会自己触发自己。 */
function syncHash() {
  const want = hashFor(session.view);
  if (location.hash === want) return;
  /* 只在「一条合法视图地址换成另一条」时入栈；首次写入、坏地址纠正仍用 replaceState，
     避免刷新一次就多一条历史，也避免坏地址被压进栈后按后退永远绕不出去。
     file:// 一律走原来的写法。parseHash 已对非法编码就地降级，这里可以直接复用。 */
  const canStack = location.protocol === 'http:' || location.protocol === 'https:';
  const currentOk = parseHash(location.hash).view !== 'bad';
  const switching = canStack && currentOk && /^#\//.test(location.hash) && /^#\//.test(want);
  try {
    if (switching) history.pushState(null, '', want);
    else history.replaceState(null, '', want);
  } catch (e) { try { location.hash = want; } catch (e2) { /* 极端环境只影响地址栏 */ } }
}

/* 当前地址是否已经就是这一屏：避免 hashchange 把同一屏重新渲染一遍
   （急救页会因此清掉刚选的词，首页会清掉刚取的提示）。 */
function atRoute(r) {
  if (r.view === 'level') {
    const lv = currentLevel();
    return session.view === 'level' && !!lv && lv.id === r.id;
  }
  return r.view !== 'bad' && !!r.view && session.view === r.view;
}

function routeTo(r) {
  if (routeReady && atRoute(r)) return;
  routeReady = true;
  /* 没选年龄段时不放行地图 / 关卡 / 知识库：先选档，和冷启动一致。
     急救页是例外——难受的当下不该先被问年龄。 */
  if (!state.band) {
    if (r.view === 'help') { session.helpFrom = 'gate'; renderHelp(); return; }
    renderAgeGate();
    return;
  }
  if (r.view === 'level') {
    const idx = LEVELS.findIndex(l => l.id === r.id);
    /* 支线 id 单独查：儿童 / 亲子轨直接视为不可达，成年轨要满足幕次解锁 */
    if (idx === -1) {
      const wi = WORK.findIndex(l => l.id === r.id);
      if (wi !== -1) {
        if (!isAdultTrack()) {
          session.tip = '工作间只在成年档开放，先回地图。';
          renderMap();
          return;
        }
        if (!workReachable(wi)) {
          session.tip = '这一幕还没解锁，先回到工作间。';
          renderWork();
          return;
        }
        session.navDir = '';
        closeModal();
        renderLevel(null, WORK[wi], wi);
        return;
      }
      session.tip = '链接里的这一站不在当前年龄段，先回到地图挑一站。';
      renderMap();
      return;
    }
    if (!isUnlocked(idx)) {
      session.tip = '这一站还没解锁，先回到地图。';
      renderMap();
      return;
    }
    session.levelIndex = idx;
    play = {};
    session.navDir = '';
    renderLevel();
    return;
  }
  if (r.view === 'work') {
    if (!isAdultTrack()) {
      session.tip = '工作间只在成年档开放，先回地图。';
      renderMap();
      return;
    }
    renderWork();
    return;
  }
  if (r.view === 'retreat' && !band().mindful) {
    session.tip = '静修间只在成年档开放，先回地图。';
    renderMap();
    return;
  }
  if (r.view === 'help') {
    session.helpFrom = session.view === 'gate' && state.band ? 'home' : (session.view || 'home');
    if (session.view === 'level') helpResume = play;
    else helpResume = null;   /* 非关卡来源不留旧进行态 */
    retreatResume = session.view === 'retreat'
      ? { play, kind: play && play.type, id: (play && play.data && play.data.id) || '', index: play && play.retreatIndex }
      : null;
    renderHelp();
    return;
  }
  if (r.view === 'gate') { session.navDir = ''; renderAgeGate(); return; }
  if (r.view === 'home') { session.navDir = ''; renderHome(); return; }
  if (r.view === 'map') { session.navDir = ''; renderMap(); return; }
  if (r.view === 'retreat') { renderRetreatList(); return; }
  if (r.view === 'dict') { ACTIONS['open-dictionary'](); return; }
  if (r.view === 'selfhelp') { ACTIONS['open-selfhelp'](); return; }
  if (r.view === 'slowvars') { ACTIONS['open-slowvars'](); return; }
  /* 空地址或认不出的地址：落到默认首屏。坏地址纠正一律用 replaceState，
     否则每次按后退都会回到坏地址、再被入栈一次纠正，历史栈永远清不掉。
     file:// 下 replaceState 可能被拒，忽略即可，syncHash 还有 location.hash 回落兜底。 */
  session.navDir = '';
  try { history.replaceState(null, '', hashFor('home')); } catch (e) { /* noop */ }
  renderHome();
}
function showFeedback(type, html) {
  const slot = document.getElementById('feedback-slot');
  if (slot) slot.innerHTML = `<div class="feedback ${type}">${html}</div>`;
}
function nudge(msg, el) {
  play.tries = (play.tries || 0) + 1;
  const lv = currentLevel();
  const extra = (play.tries >= 2 && lv.hint) ? `<div class="hint-line">小提示：${esc(lv.hint)}　·　还点得动，慢慢来。</div>` : '';
  showFeedback('gentle', `${esc(msg)}${extra}`);
  const target = el || lastClicked;
  if (target && target.classList && document.contains(target)) {
    target.classList.add('tried');
    setTimeout(() => { if (target.classList) target.classList.remove('tried'); }, 650);
  }
  const slot = document.getElementById('feedback-slot');
  if (slot) try { slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
}
/* 解锁规则：按「岛」为单位。第一岛全开；后一岛需要走过上一岛的收尾站，
   岛内各站自由进出。这样地图上「想去哪站，就去哪站」不再是空话，同时保留章节顺序。
   注意：这里检查的是「收尾站」，不是「上一岛全部走完」——岛内自由是刻意的产品判断。 */
function isUnlocked(i) {
  if (i === 0) return true;
  const lv = LEVELS[i];
  if (i === TOTAL - 1) return LEVELS.slice(0, TOTAL - 1).every(l => state.cleared.includes(l.id));
  if (!lv) return false;
  /* 终章 island 记为 0，不能算成「第 0 岛」，否则第一岛会被它锁住 */
  const prevIsland = LEVELS.filter(l => l.island === lv.island - 1 && l.type !== 'finale');
  if (!prevIsland.length) return true;
  return state.cleared.includes(prevIsland[prevIsland.length - 1].id);
}
/* 当前正在玩的那一关：主线读 session.levelIndex（运行时游标，不落盘），支线读 play.sideIndex。
   支线不改 session.levelIndex，所以退出支线后主线停在哪一站原样保留。 */
function currentLevel() {
  if (play && play.side) return WORK[play.sideIndex] || WORK[0] || {};
  return LEVELS[session.levelIndex] || LEVELS[0] || {};
}
/* 工作间四幕线性解锁：走完 WORK_GATE（A3-4）开放第一幕，之后每一幕要求上一幕已完成。
   入口放在第 3 岛收尾之后，是因为四幕用到的身体信号 / 重评 / 念头链 / 表达
   分别在第 1、2、3 岛；最早也要等 A3-3 教完表达，取整到 A3-4。
   只读主线 cleared（WORK_GATE 是入口条件）与 sideCleared（支线进度），两者不混用。 */
function sideUnlocked(i) {
  if (!isAdultTrack() || i < 0 || i >= WORK.length) return false;
  if (i === 0) return state.cleared.includes(WORK_GATE);
  return state.sideCleared.includes(WORK[i - 1].id);
}
/* 某一幕能不能进：正常解锁链，或这一幕本身已经走过。
   后者用于主线「从头再来一轮」后仍允许回看 / 重玩已完成的幕。 */
function workReachable(i) {
  if (sideUnlocked(i)) return true;
  return !!(WORK[i] && state.sideCleared.includes(WORK[i].id));
}
function clearAsyncTimers() {
  if (breathTimer) {
    clearInterval(breathTimer); breathTimer = null;
    if (play && play.running) session.interrupted = true;
  }
  if (memoTimer) { clearTimeout(memoTimer); memoTimer = null; }
  /* 自动朗读的延迟回调必须跟着视图一起收掉，否则切屏后仍会读新页面内容 */
  if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
  if (restTimer) { clearTimeout(restTimer); restTimer = null; }
}
/* 长文本朗读的保活定时器：Chrome 对 speechSynthesis 约 15 秒后会静默停住，
   周期性 pause/resume 可唤醒；必须在停止/结束时清理，否则空转耗电。 */
let speechKeepAlive = null;
function stopSpeech() {
  try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
  if (speechKeepAlive) { clearInterval(speechKeepAlive); speechKeepAlive = null; }
}
function speakTexts(texts) {
  if (!state.settings.speak || !('speechSynthesis' in window)) return;
  /* 空内容直接返回：cancel() 会把正在播的「读选项」掐掉，造成「点了读题目反而没声」。 */
  const list = (texts || []).filter(Boolean);
  if (!list.length) return;
  try {
    window.speechSynthesis.cancel();
    if (speechKeepAlive) { clearInterval(speechKeepAlive); speechKeepAlive = null; }
    /* 合并成一条再读：一次排多段是 Chrome 中途静默的主要诱因；
       用句号连接保留逐项之间的自然停顿，读选项最多 10 项。 */
    const u = new SpeechSynthesisUtterance(list.join('。'));
    u.lang = 'zh-CN'; u.rate = 0.88; u.pitch = 1.05;
    const done = () => { if (speechKeepAlive) { clearInterval(speechKeepAlive); speechKeepAlive = null; } };
    u.onend = done;
    u.onerror = done;
    speechKeepAlive = setInterval(() => {
      try {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      } catch (e) { /* noop */ }
    }, 12000);
    window.speechSynthesis.speak(u);
  } catch (e) { /* noop */ }
}
function questionTexts() {
  /* weather / breath 两关没有 .scenario 与 .prompt，题干写在 .lead 里；
     兜底后「读题目」在首站与呼吸站不再静音。 */
  const sc = document.querySelector('#stage .scenario p, #stage .lead');
  const pr = document.querySelector('#stage .prompt');
  return [sc?.textContent, pr?.textContent].filter(Boolean);
}
function optionTexts() {
  const sel = '#stage .opt, #stage .pair-item:not(:disabled), #stage .chip:not(:disabled), #stage .word-chip, #stage .weather-btn, #stage .breath-actions .btn, #stage .clue-card.flipped .clue-text';
  return Array.from(document.querySelectorAll(sel)).map(e => e.textContent.trim()).filter(Boolean).slice(0, 10);
}
function bandChip(extra) {
  const b = band();
  return `<span class="band-chip">${esc(b.name)} · ${esc(b.tag)}</span>${extra || ''}`;
}
