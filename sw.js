/* 心情闯关岛 · Service Worker
   只预缓存本应用自己的静态资源；不接管跨域请求，也不缓存任何用户数据。
   发版时改下面的 VERSION：缓存名随之变化，install 预缓存新清单，
   activate 清掉所有旧缓存，配合 skipWaiting + clients.claim 立即接管。
   页面里的注册代码只在 http(s) 下执行；file:// 双击不注册，照常可玩。 */
const VERSION = '0.17.0';
const CACHE = `mood-island-${VERSION}`;
const ASSETS = [
  './index.html',
  './style.css',
  './js/core.js',
  './js/util.js',
  './js/shell.js',
  './js/views-main.js',
  './js/views-library.js',
  './js/views-level.js',
  './js/ui.js',
  './js/actions.js',
  './js/boot.js',
  './content/bands.js',
  './content/glossary.js',
  './content/levels-kid.js',
  './content/levels-kid-island4.js',
  './content/levels-adult.js',
  './content/bank-kid-1-3.js',
  './content/bank-kid-island4.js',
  './content/bank-adult-1-3.js',
  './content/bank-adult-island4.js',
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
     静态资源走「缓存优先」：清单里的文件都在 install 时按 VERSION 预缓存过。 */
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
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
