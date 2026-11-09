/* js/boot.js · 启动接线：事件委托、离线注册、按 hash 进入首屏。
   必须最后加载：这里的顶层语句会立即执行，依赖前面全部文件已求值。 */

/* ---------------------------------------------------------------- 事件绑定 */
document.addEventListener('click', (e) => {
  /* 页内目录锚点不能进 hash 路由：#/xxx 是视图地址，#xxx 只是本页里的滚动目标。
     不拦下来的话 location.hash 变化会触发 hashchange → parseHash 判定 bad → 整屏重建回首页。
     即使目标暂时被筛选隐藏，也要吞掉这次点击，绝不让用户被踢出当前功能。 */
  const anchor = e.target.closest && e.target.closest('a[href^="#"]');
  if (anchor && !anchor.getAttribute('href').startsWith('#/')) {
    e.preventDefault();
    const id = decodeURIComponent(anchor.getAttribute('href').slice(1));
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
     关卡里其余「一排按钮」题型（配对、拼词、天气、翻线索、分筐）也走同一套序号；
     急救页的 8 个词同样支持数字键。 */
  if (/^[1-9]$/.test(e.key)) {
    const n = Number(e.key) - 1;
    const opts = document.querySelectorAll('#stage .opt:not(:disabled)');
    const rungs = document.querySelectorAll('#stage .rung:not(:disabled)');
    const others = session.view === 'level'
      ? document.querySelectorAll('#stage .pair-item:not(:disabled), #stage .word-chip:not(:disabled), #stage .weather-btn:not(:disabled), #stage .chip:not(:disabled), #stage .clue-card:not(:disabled)')
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
    const i = state.levelIndex + d;
    if (i >= 0 && i < TOTAL && isUnlocked(i)) {
      session.navDir = d < 0 ? 'back' : 'forward';
      state.levelIndex = i; renderLevel(); e.preventDefault();
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
        .then((reg) => { try { reg.update(); } catch (e) { /* noop */ } })
        .catch(() => { /* 离线能力不是玩法的前提，失败不打扰用户 */ });
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
window.addEventListener('hashchange', () => routeTo(parseHash(location.hash)));
/* 系统返回：http(s) 下每次换屏都会 pushState，浏览器后退 / 物理返回键 / 侧滑
   在这里映射回上一屏。与 hashchange 可能同时触发，atRoute 拦掉重复渲染。
   弹窗打开时先收掉遮罩，避免返回后留一个盖住新页面的对话框。 */
window.addEventListener('popstate', () => {
  /* 弹窗不占地址：第一次返回只收掉弹窗，再把地址同步回当前屏，
     不要让「关弹窗」顺带把用户推回上一页。 */
  if (overlay.classList.contains('open')) { closeModal(); syncHash(); return; }
  const r = parseHash(location.hash);
  if (routeReady && atRoute(r)) return;
  routeTo(r);
});
if (!CONTENT_OK) {
  stage.innerHTML = `<div class="view">
    <h2>内容没加载出来</h2>
    <p class="lead">content/ 下的数据文件没有读到。检查 index.html 里 content/*.js 的引入顺序：
    需要 bands → levels-kid → levels-kid-island4 → levels-adult → bank-* → bank-compose → levels-adult-work → library → dictionary → selfhelp → slowvars → help，之后才是 js/core.js 起的逻辑脚本（顺序见 README §3.1）。</p>
    <p class="muted">打开浏览器控制台可以看到具体是哪个文件 404。</p>
  </div>`;
} else {
  const initial = parseHash(location.hash);
  /* 没选档时 routeTo 自己会回落到选档页；正常有档则按地址 / 默认首页 */
  routeTo(initial);
  /* 空地址或非法地址在渲染时已被 syncHash 改写；这里再兜一次，确保首次进入地址合法 */
  if (!initial.view) syncHash();
}
