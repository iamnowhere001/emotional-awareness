/* 心情闯关岛 · Service Worker
   只预缓存本应用自己的静态资源；不接管跨域请求，也不缓存任何用户数据。
   发版时改下面的 VERSION：缓存名随之变化，install 预缓存新清单，
   activate 清掉所有旧缓存，配合 skipWaiting + clients.claim 立即接管。
   页面里的注册代码只在 http(s) 下执行；file:// 双击不注册，照常可玩。

   0.19.0 修掉两条会「静默失效」的缓存风险，理由留在这里，避免改回去：
   ① 静态资源原为 caches.match(req).then(hit => hit || fetch(req))：缓存优先，
      且 fetch 结果不回写缓存（navigate 分支有 c.put(req, copy)，静态分支没有）。
      于是只要没有重新 install，静态资源一直是 install 时 addAll 预缓存的旧副本；
      未命中的即便走了网络，下次仍 miss —— 不是「漏 bump VERSION 才新旧混搭」。
      现改 stale-while-revalidate：命中立即返回，后台 fetch 成功后
      c.put(req, copy) 回写（根因修复），下次打开即新内容；离线时后台失败静默保留旧缓存。
   ② install 的 waitUntil 链 caches.open → addAll(ASSETS) → skipWaiting 全程无 catch；
      ASSETS 是 30+ 个文件的大清单，任一 404 / 失败 → install 失败 → 不 activate、
      旧缓存不清、新缓存建不起来，即使 VERSION 已 bump 也拿不到新资源。现链尾补
      .catch(() => self.skipWaiting())，让 SW 至少能 activate，离线能力不至于整个失效。
   注意：js/boot.js 里 .catch(() => {}) 吞的是 register() 的 Promise，与 install 的
   waitUntil 是两个不同的 Promise；准确说法是「install 失败本身无任何上报，
   注册失败又被静默吞掉，两层各自静默叠加」。1.0.0 起两层都补了 console.warn，
   失败仍不打扰用户，但控制台可查。

   1.0.0 起无新增缓存逻辑，只随发版推进版本：缓存名随 VERSION 变化（现为 mood-island-1.1.0），
   旧缓存（含 0.19.0 及更早）在 activate 阶段被清掉。 */
const VERSION = '1.1.0';
const CACHE = `mood-island-${VERSION}`;
const ASSETS = [
  './index.html',
  './style.css',
  './js/core.js',
  './js/util.js',
  './js/shell.js',
  './js/views-main.js',
  './js/views-dictionary.js',
  './js/views-selfhelp.js',
  './js/views-slowvars.js',
  './js/views-retreat.js',
  './js/views-level.js',
  './js/ui.js',
  './js/actions-level.js',
  './js/actions-library.js',
  './js/actions-data.js',
  './js/boot.js',
  './content/bands.js',
  './content/glossary.js',
  './content/levels-kid.js',
  './content/levels-kid-island4.js',
  './content/levels-kid-island5.js',
  './content/levels-adult.js',
  './content/levels-adult-island5.js',
  './content/bank-kid-1-3.js',
  './content/bank-kid-island4.js',
  './content/bank-kid-island5.js',
  './content/bank-adult-1-3.js',
  './content/bank-adult-island4.js',
  './content/bank-adult-island5.js',
  './content/bank-compose.js',
  './content/levels-adult-work.js',
  './content/library.js',
  './content/meditate.js',
  './content/dictionary.js',
  './content/selfhelp.js',
  './content/slowvars.js',
  './content/help.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
      caches.open(CACHE)
        .then((c) => c.addAll(ASSETS))
        .then(() => self.skipWaiting())
        /* addAll 里任一资源 404 会让整条链 reject；这时仍要 skipWaiting，
           否则 SW 永远停在 installed、activate 不跑，离线能力整个失效。
           但失败要留下控制台痕迹：过去这里完全静默，缓存不完整与正常安装无从区分。 */
        .catch((err) => {
          console.warn('[mood-island] 预缓存未完成，离线能力可能不完整：', err);
          return self.skipWaiting();
        })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      .then(() => self.clients.claim())
    )
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  /* 同源以外的请求一律不接管：本应用没有任何远程依赖 */
  if (url.origin !== self.location.origin) return;
  /* 页面导航走「网络优先」：刷新即拿到新版本，断网回落预缓存的 index.html。
     静态资源走 stale-while-revalidate：命中缓存立即返回，再后台取新版回写。 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }
  /* stale-while-revalidate：
     - respondWith 只回缓存命中（或现取），绝不等后台 fetch，命中即秒回；
     - 后台刷新用 waitUntil 在事件同步阶段登记，保证 SW 不被提前回收；
     - 后台失败（离线）静默忽略，保留旧缓存，不产生未处理的 rejection；
     - file:// 下不注册 SW，这条逻辑根本不会执行，双击行为不变。 */
  const cached = caches.match(req);
  e.waitUntil(
    cached
      .then((hit) => {
        if (!hit) return;                 // 未命中：由 respondWith 现取，不重复请求
        return fetch(req).then((res) => {
          if (!res || !res.ok) return;   // 4xx / 5xx 不写进缓存
          const copy = res.clone();
          return caches.open(CACHE).then((c) => c.put(req, copy));
        });
      })
      .catch(() => {})                   // 离线 / 写入失败：静默，保留旧缓存
  );
  e.respondWith(cached.then((hit) => hit || fetch(req)));
});
