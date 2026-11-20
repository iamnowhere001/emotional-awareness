/* js/boot.js · 启动接线：事件委托、离线注册、按 hash 进入首屏。
   必须最后加载：这里的顶层语句会立即执行，依赖前面全部文件已求值。 */

/* ---------------------------------------------------------------- 安装到主屏
   Chromium 系在满足条件时发 beforeinstallprompt，必须先 preventDefault 拦下默认条，
   存起来供设置里「安装到主屏」按钮调用。iOS Safari 不支持此事件，设置里用文案引导。 */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

/* ---------------------------------------------------------------- 全局错误兜底
   启动期的 CONTENT_OK 只覆盖「数据文件完全没读到」；渲染途中的任何异常
   （字段缺失、个别设备的 speechSynthesis 抛错等）过去会让 stage 停在半途白屏，
   用户既看不到提示也不知道怎么恢复。这里统一兜底：给可读说明 + 两个出口。
   只处理真正的脚本异常（有 message）；图片等资源加载失败不打扰用户。 */
let fatalShown = false;
function showFatalError(detail) {
  if (fatalShown) return;
  fatalShown = true;
  try { clearAsyncTimers(); stopSpeech(); } catch (e) { /* noop */ }
  const el = document.getElementById('stage');
  if (!el) return;
  const overlayEl = document.getElementById('overlay');
  if (overlayEl) { overlayEl.classList.remove('open'); overlayEl.innerHTML = ''; }
  document.body.classList.remove('modal-open');
  /* 这里不依赖 esc() 等工具函数：它们若没加载成功，本处理器也要能独立工作。 */
  const safe = String(detail == null ? '' : detail).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  el.innerHTML = `<div class="view">
    <h2>这一下没能加载好</h2>
    <p class="lead">不是你的错。可以先试一次重新载入；若还是不行，退回地图换个入口继续，已经走过的进度不会丢。</p>
    <div class="actions" style="margin-top:18px">
      <button class="btn btn-primary" data-action="reload-app">重新载入</button>
      <button class="btn btn-secondary" data-action="fatal-dismiss">回到地图</button>
    </div>
    ${safe ? `<details style="margin-top:20px"><summary class="muted">技术细节（反馈时可用）</summary><pre style="white-space:pre-wrap;word-break:break-all;font-size:.82em;color:var(--ink-3)">${safe}</pre></details>` : ''}
  </div>`;
  try { el.focus({ preventScroll: true }); } catch (e) { /* noop */ }
}
ACTIONS['reload-app'] = () => { try { location.reload(); } catch (e) { /* noop */ } };
/* 「回到地图」必须解除重入保护：否则这一屏的错误提示会把之后所有异常都吞掉，
   用户回到地图后再出错时既没有提示也没有出口。回到地图若立即再次抛错，
   会重新走一遍兜底（fatalShown 已复位），不会陷入静默。 */
ACTIONS['fatal-dismiss'] = () => {
  fatalShown = false;
  try { ACTIONS['go-map'](); } catch (e) { /* 交给全局兜底重新显示 */ }
};
window.addEventListener('error', (e) => {
  /* 无 message 的是 <img>/<link> 等资源加载失败，不打断玩法 */
  if (!e || !e.message) return;
  showFatalError(`${e.message}${e.filename ? ` · ${e.filename}:${e.lineno}` : ''}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e && e.reason;
  showFatalError(r && (r.message || String(r)));
});

/* ---------------------------------------------------------------- 跨标签页冲突
   存档是全量覆盖式写入：两个标签页同时打开时，后写的一方会用旧内存抹掉新进度。
   浏览器在「别的标签页改了 localStorage」时会触发 storage 事件，这里据此提示，
   让用户明确选一份，而不是无声丢进度。只提示一次，避免连续写入反复弹窗。 */
let storageNotified = false;
window.addEventListener('storage', (e) => {
  if (!e || storageNotified || fatalShown) return;
  if (e.key !== STORAGE_KEY && !LEGACY_KEYS.includes(e.key)) return;
  storageNotified = true;
  try {
    openModal(`<div class="modal-title">另一个标签页更新了进度</div>
      <div class="modal-body">
        <p>你可能也在别的地方打开了《心情闯关岛》，那边刚写入了新的进度。为了避免两个页面互相覆盖，建议载入最新的一份。</p>
        <p class="muted">若选择留在这页，会继续使用当前进度；之后保存时，另一个标签页的记录会被这份覆盖。</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" data-action="reload-app">载入最新进度</button>
        <button class="btn btn-ghost" data-action="close-modal">留在这页</button>
      </div>`);
  } catch (err) { /* 极端环境下不打扰玩法 */ }
});

/* ---------------------------------------------------------------- 事件绑定 */
document.addEventListener('click', (e) => {
  /* 页内目录锚点不能进 hash 路由：#/xxx 是视图地址，#xxx 只是本页里的滚动目标。
     不拦下来的话 location.hash 变化会触发 hashchange → parseHash 判定 bad → 整屏重建回首页。
     即使目标暂时被筛选隐藏，也要吞掉这次点击，绝不让用户被踢出当前功能。 */
  const anchor = e.target.closest && e.target.closest('a[href^="#"]');
  if (anchor && !anchor.getAttribute('href').startsWith('#/')) {
    e.preventDefault();
    let id = '';
    try { id = decodeURIComponent(anchor.getAttribute('href').slice(1)); }
    catch (err) { /* 坏锚点只影响这一次滚动，不能让它冒到委托外、把当前功能整屏重建 */ }
    const target = id ? document.getElementById(id) : null;
    if (target) {
      /* 词典单页可长达 2.8 万像素，平滑滚动会走上好几秒；目录跳转用瞬时定位。 */
      target.scrollIntoView({ block: 'start', behavior: 'auto' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      try { target.focus({ preventScroll: true }); } catch (err) { /* noop */ }
    }
    return;
  }
  if (e.target.classList && e.target.classList.contains('modal-backdrop')) { closeModal(); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  lastClicked = el;
  const fn = ACTIONS[el.dataset.action];
  if (fn) fn(el);
});
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'dict-search') {
    dictQuery = e.target.value;
    applyDictFilter();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (overlay.classList.contains('open')) { closeModal(); return; }
    if (viewCfg(session.view).esc === 'map') { ACTIONS['go-map'](); return; }
    if (viewCfg(session.view).esc === 'back') { ACTIONS['help-close'](); return; }
  }
  if (overlay.classList.contains('open')) {
    if (e.key === 'Tab') { trapTab(e); return; }
    /* 漂流瓶弹窗里的选项也有数字徽标，同样让 1–9 可用 */
    if (/^[1-9]$/.test(e.key)) {
      const target = document.querySelectorAll('#overlay .opt:not(:disabled)')[Number(e.key) - 1];
      if (target) { target.click(); e.preventDefault(); }
    }
    return;
  }
  if (e.target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable)) return;
  /* 数字键和徽标一致：.opt / 梯子档位的 1/2/3… 都能按；
     关卡里其余「一排按钮」题型（配对、拼词、天气、分筐）也走同一套序号；
     急救页的 8 个词同样支持数字键。
     线索关的 .clue-card 也带「线索 N」编号，但和答案 .opt 的 1/2/3 数字冲突：
     原先把两者都放进候选时，find 恒命中 .opt，线索卡其实从未被数字键触发过。
     现在明确按既有行为处理——数字键统一选答案；线索卡用 Tab + Enter 翻开，
     避免「看起来能用、实际按不到」的假承诺。 */
  if (/^[1-9]$/.test(e.key)) {
    const n = Number(e.key) - 1;
    const opts = document.querySelectorAll('#stage .opt:not(:disabled)');
    const rungs = document.querySelectorAll('#stage .rung:not(:disabled)');
    const others = session.view === 'level'
      ? document.querySelectorAll('#stage .pair-item:not(:disabled), #stage .word-chip:not(:disabled), #stage .weather-btn:not(:disabled), #stage .chip:not(:disabled)')
      : session.view === 'help'
        ? document.querySelectorAll('#stage .help-word:not(:disabled)')
        : [];
    const target = [opts, rungs, others].find(g => g.length)?.[n];
    if (target) { target.click(); e.preventDefault(); }
    return;
  }
  if (session.view === 'level' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const d = e.key === 'ArrowLeft' ? -1 : 1;
    if (play.side) {
      const i = play.sideIndex + d;
      if (i >= 0 && i < WORK.length && sideUnlocked(i)) {
        session.navDir = d < 0 ? 'back' : 'forward';
        renderLevel(null, WORK[i], i);
        e.preventDefault();
      }
      return;
    }
    const i = session.levelIndex + d;
    if (i >= 0 && i < TOTAL && isUnlocked(i)) {
      session.navDir = d < 0 ? 'back' : 'forward';
      session.levelIndex = i; renderLevel(); e.preventDefault();
    }
  }
});

/* ---------------------------------------------------------------- 离线与安装 */
/* PWA 只在 http(s) 下注册。file:// 双击打开时没有可用的 Service Worker：
   这里直接跳过，页面照常完整可玩；注册失败也只影响「装到主屏」，不影响玩法。
   先等页面加载完再注册，避免和首屏渲染抢资源。 */
function registerOffline() {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    try {
      navigator.serviceWorker.register('sw.js')
        /* 主动检查更新：SW 本身带版本号，新版本 install 后立刻接管并清掉旧缓存 */
        .then((reg) => { try { const p = reg.update(); if (p && p.catch) p.catch((e) => console.warn('[mood-island] SW 更新检查失败：', e)); } catch (e) { /* noop */ } })
        /* 离线能力不是玩法的前提，失败不打扰用户；但留一条控制台痕迹便于排查。 */
        .catch((e) => { console.warn('[mood-island] Service Worker 注册失败：', e); });
    } catch (e) { /* noop */ }
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/* ---------------------------------------------------------------- 启动 */
applySettings();
/* 系统切到深色 / 浅色时不用刷新页面，跟着换一层变量即可。 */
if (window.matchMedia) {
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  const onSchemeChange = () => applyColorScheme();
  if (scheme.addEventListener) scheme.addEventListener('change', onSchemeChange);
  else if (scheme.addListener) scheme.addListener(onSchemeChange);
}
registerOffline();
/* 地址栏里带了 hash 就按它直达；没有则落到默认首屏，并由 syncHash 写入合法地址。
   hashchange 覆盖手动改地址、刷新后同页跳转，以及少数浏览器 replaceState 失败时的回落。 */
window.addEventListener('hashchange', () => {
  /* 地址栏是外部输入：解析或渲染一旦抛错，兜底回默认首屏，别让页面卡在旧屏。 */
  try { routeTo(parseHash(location.hash)); }
  catch (e) { try { routeTo({ view: null }); } catch (e2) { /* noop */ } }
});
/* 系统返回：http(s) 下每次换屏都会 pushState，浏览器后退 / 物理返回键 / 侧滑
   在这里映射回上一屏。与 hashchange 可能同时触发，atRoute 拦掉重复渲染。
   弹窗打开时先收掉遮罩，避免返回后留一个盖住新页面的对话框。 */
window.addEventListener('popstate', () => {
  /* 弹窗不占地址：第一次返回只收掉弹窗，再把地址同步回当前屏，
     不要让「关弹窗」顺带把用户推回上一页。 */
  if (overlay.classList.contains('open')) { closeModal(); syncHash(); return; }
  let r;
  try { r = parseHash(location.hash); } catch (e) { r = { view: null }; }
  if (routeReady && atRoute(r)) return;
  routeTo(r);
});
if (!CONTENT_OK) {
  stage.innerHTML = `<div class="view">
    <h2>内容没加载出来</h2>
    <p class="lead">content/ 下的数据文件没有读到。脚本的引入顺序以 index.html 为准（内容在前、逻辑在后，清单见 scripts/js-files.mjs），也可以跑 npm run doctor 检查。</p>
    <p class="muted">打开浏览器控制台可以看到具体是哪个文件 404。</p>
  </div>`;
} else {
  let initial;
  try { initial = parseHash(location.hash); } catch (e) { initial = { view: null }; }
  /* 没选档时 routeTo 自己会回落到选档页；正常有档则按地址 / 默认首页 */
  routeTo(initial);
  /* 空地址或非法地址在渲染时已被 syncHash 改写；这里再兜一次，确保首次进入地址合法 */
  if (!initial.view) syncHash();
}
