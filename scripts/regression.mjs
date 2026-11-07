#!/usr/bin/env node
/* 浏览器回归：无头 Chrome 打开一个「注入了测试用例」的临时页面，
   不改任何源文件。测试脚本在 tests/browser-tests.js，结果写进 DOM 再取回解析。
   用法：npm run test:e2e [-- --verbose]
   找不到浏览器时用 CHROME_PATH=/path/to/chrome 指定。 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createStaticServer } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const verbose = process.argv.includes('--verbose');

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    '/Applications/Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ];
  return candidates.find(p => existsSync(p)) || null;
}

/* ---------- 源码级检查（不需要浏览器） ---------- */
const staticChecks = [];
const S = (name, cond) => staticChecks.push({ name, ok: !!cond });
const src = readFileSync(join(root, 'script.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
const roadmap = readFileSync(join(root, 'ROADMAP.md'), 'utf8');
const css = readFileSync(join(root, 'style.css'), 'utf8');
const lint = readFileSync(join(root, 'scripts/lint-content.mjs'), 'utf8');
const contentFiles = [
  'bands', 'levels-kid', 'levels-kid-island4', 'levels-adult',
  'bank-kid-1-3', 'bank-kid-island4', 'bank-adult-1-3', 'bank-adult-island4',
  'bank-compose', 'levels-adult-work', 'library', 'dictionary', 'selfhelp', 'slowvars', 'help'
];
const headerVersion = (src.slice(0, 200).match(/\bv(\d+\.\d+\.\d+)\b/) || [])[1];
/* 0.x 台阶制：发版号与存档 schema 是两套编号，重排发版号不得带走 storage key。 */
S('script.js 头注释 / package.json 一致且采用 0.x 台阶制',
  headerVersion === pkg.version && /^0\.\d+\.\d+$/.test(pkg.version) &&
  /const SCHEMA_VERSION = \d+;/.test(src) && /const STORAGE_KEY = 'mood-island-v5';/.test(src));
const clVersions = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map(m => m[1]);
S('README / CHANGELOG / ROADMAP 版本口径一致且历史编号已重排',
  readme.includes(`当前版本 **${pkg.version}**`) &&
  roadmap.includes(`当前版本 **${pkg.version}**`) &&
  changelog.includes(`## [${pkg.version}]`) &&
  clVersions.length >= 10 && clVersions.every(v => /^0\.\d+\.\d+$/.test(v)) &&
  !/不占用 ROADMAP|留给.{0,12}编号|不记 \d+\.\d+\.0/.test(changelog));
/* 对比度：正文/提示色必须在浅色底上达到 WCAG AA 4.5:1 */
const tokenOf = name => {
  const m = css.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'));
  return m && m[1];
};
const channel = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = hex => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const ink3 = tokenOf('ink-3'), warm = tokenOf('warm');
S('ink-3 / warm 在 bg / surface / surface-2 上 ≥ 4.5:1',
  ['bg', 'surface', 'surface-2'].every(n => contrast(ink3, tokenOf(n)) >= 4.5 && contrast(warm, tokenOf(n)) >= 4.5));
S('index.html 进度占位不再写死 13 关', !/13 关/.test(html));
S('#overlay 不再挂 aria-live，避免整个弹窗重复播报', !/<div id="overlay"[^>]*aria-live/.test(html));
S('content/*.js 全部被 index.html 引入', contentFiles.every(n => html.includes(`content/${n}.js`)));
S('script.js 在所有 content 之后加载', html.lastIndexOf('script.js') > html.lastIndexOf('content/library.js'));
S('心理学词典在 library 之后、script.js 之前', html.indexOf('content/dictionary.js') > html.indexOf('content/library.js') && html.indexOf('content/dictionary.js') < html.indexOf('script.js'));
S('自助工具箱在 dictionary 之后、script.js 之前', html.indexOf('content/selfhelp.js') > html.indexOf('content/dictionary.js') && html.indexOf('content/selfhelp.js') < html.indexOf('script.js'));
S('慢变量在 selfhelp 之后、script.js 之前', html.indexOf('content/slowvars.js') > html.indexOf('content/selfhelp.js') && html.indexOf('content/slowvars.js') < html.indexOf('script.js'));
S('急救入口文案在 slowvars 之后、script.js 之前', html.indexOf('content/help.js') > html.indexOf('content/slowvars.js') && html.indexOf('content/help.js') < html.indexOf('script.js'));
S('拼装数据在题库之后、script.js 之前', html.indexOf('content/bank-compose.js') > html.indexOf('content/bank-adult-island4.js') && html.indexOf('content/bank-compose.js') < html.indexOf('script.js'));
S('工作间数据在拼装数据之后、script.js 之前', html.indexOf('content/levels-adult-work.js') > html.indexOf('content/bank-compose.js') && html.indexOf('content/levels-adult-work.js') < html.indexOf('script.js'));
/* 急救入口的红线：文案是本地常量，不联网、不拨号；视图本身不写存档。 */
const helpSrc = readFileSync(join(root, 'content/help.js'), 'utf8');
S('急救入口文案不含网络调用或链接', !/fetch\s*\(|XMLHttpRequest|https?:\/\//.test(helpSrc));
const helpFn = src.slice(src.indexOf('function renderHelp'), src.indexOf('function renderMap'));
S('急救入口视图不写存档', helpFn.length > 0 && !/save\s*\(|localStorage/.test(helpFn));
S('急救入口已接线：动作 + 视图 + 返回前一屏',
  /'open-help'\s*:/.test(src) && /'help-close'\s*:/.test(src) && /'help-ground'\s*:/.test(src) && /'help-word'\s*:/.test(src) && /help:\s*\{\s*progress:\s*false,\s*esc:\s*'back'/.test(src));
S('顶栏入口常驻且共用同一动作', /id="help-entry"[^>]*data-action="open-help"/.test(html));
/* PWA：manifest 与 sw 是纯本地资源，不能借缓存引入任何远程请求。
   file:// 下不注册 SW，页面照旧完整可玩（注册代码必须自己按协议判断）。 */
const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
const swSrc = readFileSync(join(root, 'sw.js'), 'utf8');
S('PWA：manifest 可解析、start_url 指向 index、图标齐全且含 maskable',
  manifest.start_url === './index.html' &&
  manifest.icons.length >= 3 &&
  manifest.icons.some(i => i.purpose === 'maskable') &&
  manifest.icons.every(i => existsSync(join(root, i.src))));
S('PWA：service worker 预缓存全部内容文件且不引用外部域名',
  contentFiles.every(n => swSrc.includes(`./content/${n}.js`)) && !/https?:\/\//.test(swSrc));
S('PWA：注册只在 http(s) 下执行，file:// 直接跳过',
  /location\.protocol !== 'http:' && location\.protocol !== 'https:'/.test(src) &&
  /serviceWorker\.register/.test(src));
S('PWA：index.html 引入 manifest 与图标', /rel="manifest"/.test(html) && /icons\/icon-192\.png/.test(html));
/* 0.10.0：导出 / 导入与 hash 路由 */
S('sw.js 的 VERSION 与 package.json 版本一致',
  (swSrc.match(/const VERSION = '([^']+)'/) || [])[1] === pkg.version);
S('导出格式号独立于发版号与 schema 号',
  /const EXPORT_VERSION = \d+;/.test(src) && /exportVersion:\s*EXPORT_VERSION/.test(src));
S('导入先校验来源与结构，再走 migrate()',
  /function validateImport/.test(src) && /data\.app !== EXPORT_APP/.test(src) &&
  /data\.exportVersion/.test(src) && /migrate\(raw\)/.test(src));
S('导入确认前不改当前档，确认后可撤销一次',
  /pendingImport/.test(src) && /importUndo/.test(src) &&
  /'import-confirm'\s*:/.test(src) && /'import-undo'\s*:/.test(src));
S('hash 路由：解析、同步、回落齐全',
  /function parseHash/.test(src) && /function syncHash/.test(src) &&
  /routeReady/.test(src) && /#\/level\//.test(src));
S('hash 写地址优先 replaceState，file:// 下有回落',
  /history\.replaceState/.test(src) && /location\.hash = want/.test(src));
/* 0.11.0：拼装试点 / 工作间支线 / 复玩不重复 */
S('存档 v5：storage key 升级，旧键 v4/v3/v2 仍在 LEGACY_KEYS',
  /const SCHEMA_VERSION = 5;/.test(src) &&
  /const STORAGE_KEY = 'mood-island-v5';/.test(src) &&
  /const LEGACY_KEYS = \['mood-island-v4', 'mood-island-v3', 'mood-island-v2'\]/.test(src));
S('迁移 v5 补 seen / sideCleared，旧的 cards / skills / shells 路径不变',
  /seen:\s*migrateSeen\(s\.seen\)/.test(src) && /sideCleared:\s*Array\.isArray/.test(src) &&
  /cards:\s*migrateCards\(s\.cards/.test(src) && /skills:\s*Array\.isArray\(s\.skills\)/.test(src));
S('支线白名单与主线白名单分开，side 不计入 ALL_LEVEL_IDS',
  /const ALL_LEVEL_IDS = new Set\(\[\.\.\.KID\.levels, \.\.\.ADULT\.levels\]/.test(src) &&
  /const WORK_IDS = new Set\(WORK\.map/.test(src) && /WORK_IDS\.has\(id\)/.test(src));
S('拼装选道不碰 Math.random，同历史可复现',
  (() => {
    const at = src.indexOf('function pickComposed');
    const end = src.indexOf('function pickVariant', at);
    const block = at !== -1 && end > at ? src.slice(at, end) : '';
    return block.length > 0 && !/Math\.random/.test(block) && /hash32/.test(block) && /forceKey/.test(block);
  })());
S('组合键写进 DOM，测试可强制复现',
  /data-variant="\$\{v && v\.key/.test(src) && /forceKey/.test(src));
S('工作间支线只写 sideCleared，不碰主线 cleared / cards / skills / shells',
  (() => {
    const at = src.indexOf("if (play.side) {");
    const end = src.indexOf('if (!state.cleared.includes(lv.id))', at);
    const block = at !== -1 && end > at ? src.slice(at, end) : '';
    return block.length > 0 && /state\.sideCleared\.push/.test(block) &&
      !/state\.cleared\.push/.test(block) && !/state\.cards/.test(block) &&
      !/state\.skills\.push/.test(block) && !/state\.shells\s*\+=/.test(block);
  })());
S('restart-all 不清 seen，也不清 sideCleared',
  (() => {
    const at = src.indexOf("'restart-all'");
    const end = src.indexOf("'clear-progress-confirm'", at);
    const block = at !== -1 && end > at ? src.slice(at, end) : '';
    return block.length > 0 && !/seen\s*=\s*\{\}/.test(block) && !/sideCleared\s*=/.test(block);
  })());
/* 0.11.1：支线上下文 / 急救返回 / 已完成幕可重玩 */
S('支线换题保留 side 上下文，不回落主线',
  (() => {
    const at = src.indexOf("'reroll'");
    const end = src.indexOf("'goto-band'", at);
    const block = at !== -1 && end > at ? src.slice(at, end) : '';
    return block.length > 0 && /play\.side/.test(block) &&
      /renderLevel\(null,\s*WORK\[play\.sideIndex\],\s*play\.sideIndex\)/.test(block);
  })());
S('急救返回覆盖 backLabels 的每个来源，包括工作间',
  (() => {
    const at = src.indexOf("'help-close'");
    const end = src.indexOf("'help-ground'", at);
    const block = at !== -1 && end > at ? src.slice(at, end) : '';
    if (!block) return false;
    const labelsAt = src.indexOf('const backLabels');
    if (labelsAt === -1) return false;
    const labels = src.slice(labelsAt, src.indexOf('};', labelsAt));
    const keys = [...labels.matchAll(/(\w+):\s*'/g)].map(m => m[1]);
    return keys.length > 0 && keys.every(k => new RegExp(`from === '${k}'`).test(block));
  })());
S('已完成的幕可重玩 / 直达（workReachable）',
  /function workReachable\(i\)[\s\S]{0,220}state\.sideCleared\.includes/.test(src) &&
  /const unlocked = workReachable\(i\)/.test(src) &&
  /if \(!workReachable\(i\)\) return;/.test(src) &&
  /if \(!workReachable\(wi\)\)/.test(src));
S('文档不显示拼装组合计数 / 打卡压力',
  !/本轮已换过几组题|已换过.{0,4}组/.test(roadmap) && !/本轮已换过几组题/.test(readme));

const viewAssigns = [...new Set([...src.matchAll(/session\.view\s*=\s*'([a-z]+)'/g)].map(m => m[1]))];
const viewBlock = src.slice(src.indexOf('const VIEW_CONFIG'), src.indexOf('function viewCfg'));
S('VIEW_CONFIG 覆盖所有 session.view 取值',
  viewAssigns.length > 0 && viewAssigns.every(v => new RegExp(`\\b${v}:\\s*\\{`).test(viewBlock)));
/* 三个知识库视图走同一入口，避免以后只改其中一份 */
S('词典 / 自助 / 慢变量共用 renderLibraryView',
  ['renderDictionary', 'renderSelfHelp', 'renderSlowVars'].every((fn) => {
    const at = src.indexOf(`function ${fn}`);
    return at !== -1 && src.slice(at, src.indexOf('}', at) + 1).includes('renderLibraryView(');
  }));
S('style.css 不再残留无引用的样式',
  !/\.progress-(track|fill)|\.cols-3|\.feedback \.tryit|\.map-tools|\.tool-btn|\.retreat-entry/.test(css));
S('style.css 的进度注释不再写死 13 站', !/13 站/.test(css));
/* 词典扩容后，数量不应再被 lint 钉死；主题与类型只认数据文件里的元数据。 */
S('词典数量不再写死 100 条上限', !/DICT\.length\s*!==\s*100/.test(lint));
S('词典主题与概念类型由 dictionaryMeta 驱动', lint.includes('MI.dictionaryMeta') && src.includes('MI.dictionaryMeta'));
S('词典有分区标题、类型筛选与关联跳转入口',
  /groupTitle\(/.test(src) && /'dict-kind'/.test(src) && /'dict-jump'/.test(src));
/* 初始化顺序：load() 调用的 migrate() 会用到 remapIds。
   若 const 声明晚于 `let state = load()`，启动时会落进 TDZ、异常被 catch 吞掉，
   表现就是「刷新后进度全丢」，而后续单测因为已经初始化过，反而测不出来。 */
const stateInitAt = src.indexOf('let state = load();');
const remapAt = src.indexOf('const remapIds');
S('存档迁移常量在 let state = load() 之前初始化', remapAt !== -1 && stateInitAt !== -1 && remapAt < stateInitAt);

/* ---------- 浏览器 ---------- */
const chrome = findChrome();
if (!chrome) {
  console.error('✗ 找不到 Chrome / Chromium。设置 CHROME_PATH 指向可执行文件后重试。');
  process.exit(1);
}
const appHtml = html.replace(
  '<script src="script.js"></script>',
  '<script src="script.js"></script>\n<script src="/tests/browser-tests.js"></script>'
);
if (!appHtml.includes('browser-tests.js')) {
  console.error('✗ 测试脚本注入失败：index.html 里没找到 script.js 的引用。');
  process.exit(1);
}
/* Chrome 无头在 macOS 上会把窗口宽度钳到 500px，`--window-size=390,900` 不生效。
   把应用放进一个固定 390×900 的 iframe：CSS 媒体查询与 window.innerWidth 都以 iframe
   的视口为准，这样「390px 用例」才真的跑在 390px，而不是名不副实。
   结果由 iframe 内的测试脚本写回父页面，供 --dump-dom 读取。 */
const harness = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>e2e</title></head>
<body style="margin:0">
<pre id="__e2e_result__" style="display:none">pending</pre>
<iframe id="app" src="/__app.html" title="app" style="display:block;width:390px;height:900px;border:0"></iframe>
</body></html>`;

const server = createStaticServer({ '/__app.html': appHtml, '/__harness.html': harness });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const profile = join(tmpdir(), `mood-island-e2e-${process.pid}`);

/* Chrome 的后台子进程会继承 stdout/stderr 管道，用 spawnSync 的 pipe 捕获时
   主进程退出后管道仍不关闭、会一直等到超时。改把输出重定向到临时文件。 */
const outPath = join(tmpdir(), `mood-island-e2e-${process.pid}.html`);
const errPath = join(tmpdir(), `mood-island-e2e-${process.pid}.log`);
const outFd = openSync(outPath, 'w');
const errFd = openSync(errPath, 'w');
/* HTTP 服务跑在同一个 Node 进程里，所以这里必须用异步 spawn：
   spawnSync 会阻塞事件循环，Chrome 的请求没人应答，页面永远加载不完。 */
const proc = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--user-data-dir=${profile}`,
  '--window-size=500,900',
  '--virtual-time-budget=5000',
  '--dump-dom',
  `http://127.0.0.1:${port}/__harness.html`
], { stdio: ['ignore', outFd, errFd] });
let chromeError = null;
await new Promise(resolve => {
  const timer = setTimeout(() => {
    chromeError = new Error('浏览器超时（45 秒）');
    try { proc.kill('SIGKILL'); } catch { /* noop */ }
    resolve();
  }, 45000);
  proc.on('error', e => { chromeError = e; clearTimeout(timer); resolve(); });
  proc.on('exit', () => { clearTimeout(timer); resolve(); });
});
closeSync(outFd); closeSync(errFd);
server.close();
const dom = readFileSync(outPath, 'utf8');
const chromeErr = (() => { try { return readFileSync(errPath, 'utf8'); } catch { return ''; } })();
try { unlinkSync(outPath); unlinkSync(errPath); } catch { /* 临时文件，忽略 */ }

/* 有的环境里 Chrome 输出 DOM 后退出很慢：只要拿到结果就按结果判定。 */
const match = dom.match(/<pre id="__e2e_result__"[^>]*>([\s\S]*?)<\/pre>/);
if (!match) {
  console.error('✗ 没拿到测试结果（页面可能报错、脚本没加载或浏览器超时）。');
  if (chromeError) console.error('  浏览器状态：', chromeError.message);
  console.error(chromeErr.slice(-1200));
  console.error('  DOM 长度：', dom.length);
  process.exit(1);
}
if (chromeError) console.warn('· 浏览器退出异常，但已拿到 DOM，按测试结果判定');
const decoded = match[1]
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
let result;
try { result = JSON.parse(decoded); }
catch (e) {
  console.error('✗ 测试结果解析失败：', e.message);
  console.error(decoded.slice(0, 500));
  process.exit(1);
}

const lines = [
  ...staticChecks.map(c => `${c.ok ? 'PASS' : 'FAIL'} · [源码] ${c.name}`),
  ...result.lines
];
const failed = lines.filter(l => l.startsWith('FAIL')).length;
if (verbose) lines.forEach(l => console.log('  ' + l));
else lines.filter(l => l.startsWith('FAIL')).forEach(l => console.log('  ✗ ' + l));
console.log(`回归 ${result.lines.length} 项 + 源码检查 ${staticChecks.length} 项：${lines.length - failed} PASS / ${failed} FAIL`);
process.exit(failed ? 1 : 0);
