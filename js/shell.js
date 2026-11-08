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
  /* 成年专题「工作间」：时间线视图，支线进度不算进 17 站 */
  work: { progress: false, esc: 'map', title: null, band: true }
};
function viewCfg(v) { return VIEW_CONFIG[v] || {}; }
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
  if (track) track.innerHTML = sideNow ? '' : LEVELS.map((l, i) => {
    const done = state.cleared.includes(l.id);
    const cur = session.view === 'level' && state.levelIndex === i;
    const unlocked = isUnlocked(i);
    return `<button class="step ${done ? 'done' : ''} ${cur ? 'current' : ''}" data-action="open-level" data-i="${i}" ${unlocked ? '' : 'disabled'} ${cur ? 'aria-current="step"' : ''} title="${esc(l.id + ' · ' + l.name)}" aria-label="第 ${i + 1} 站 ${esc(l.name)}${done ? '，已走过' : ''}"></button>`;
  }).join('');
  const pt = document.getElementById('progress-text');
  if (pt) pt.textContent = sideNow
    ? `支线 · 工作间 ${currentLevel().time || ''} · 不计入 ${TOTAL} 站`
    : (vc.title === 'current' && LEVELS[state.levelIndex])
      ? `第 ${state.levelIndex + 1} / ${TOTAL} 站 · ${LEVELS[state.levelIndex].name}`
      : `已走过 ${clearedInTrack()} / ${TOTAL} 站`;
  syncHash();
}
function viewClass() {
  return session.navDir === 'back' ? 'view enter-back'
    : session.navDir === 'forward' ? 'view enter-forward' : 'view';
}

/* ---------------------------------------------------------------- hash 路由
   地址形如 #/map、#/level/4-2、#/help：刷新、收藏、分享都能回到同一屏。
   - 只认下面这张固定表，其余一律回落，不把用户留在坏地址上。
   - 写地址用 history.replaceState：不往历史栈里塞每一步，Esc / 浏览器返回仍是原来的语义。
     file:// 下个别浏览器会拒绝 replaceState，此时退回 location.hash（多一条历史，功能不丢）。
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
    return { view: 'level', id: decodeURIComponent(parts.slice(1).join('/')) };
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
  try { history.replaceState(null, '', want); }
  catch (e) { try { location.hash = want; } catch (e2) { /* 极端环境只影响地址栏 */ } }
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
    state.levelIndex = idx;
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
  /* 空地址或认不出的地址：落到默认首屏，syncHash 会把坏地址改回合法值 */
  session.navDir = '';
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
/* 当前正在玩的那一关：主线读 state.levelIndex，支线读 play.sideIndex。
   支线不改 state.levelIndex，所以退出支线后主线停在哪一站原样保留。 */
function currentLevel() {
  if (play && play.side) return WORK[play.sideIndex] || WORK[0] || {};
  return LEVELS[state.levelIndex] || LEVELS[0] || {};
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
}
function stopSpeech() { try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* noop */ } }
function speakTexts(texts) {
  if (!state.settings.speak || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    texts.filter(Boolean).forEach(t => {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'zh-CN'; u.rate = 0.88; u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    });
  } catch (e) { /* noop */ }
}
function questionTexts() {
  const sc = document.querySelector('#stage .scenario p');
  const pr = document.querySelector('#stage .prompt');
  return [sc?.textContent, pr?.textContent].filter(Boolean);
}
function optionTexts() {
  const sel = '#stage .opt, #stage .pair-item:not(:disabled), #stage .chip:not(:disabled), #stage .word-chip, #stage .weather-btn, #stage .clue-card.flipped .clue-text';
  return Array.from(document.querySelectorAll(sel)).map(e => e.textContent.trim()).filter(Boolean).slice(0, 10);
}
function bandChip(extra) {
  const b = band();
  return `<span class="band-chip">${esc(b.name)} · ${esc(b.tag)}</span>${extra || ''}`;
}
