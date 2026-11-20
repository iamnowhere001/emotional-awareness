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
import { JS_FILES } from './js-files.mjs';

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
/* 逻辑已按职责拆成 js/*.js，仍是经典脚本顺序加载、共用一个全局词法作用域；
   源码断言按清单拼接后再搜片段，等价于当年的单个 script.js。 */
const src = JS_FILES.map(f => readFileSync(join(root, f), 'utf8')).join('\n');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
const roadmap = readFileSync(join(root, 'ROADMAP.md'), 'utf8');
const css = readFileSync(join(root, 'style.css'), 'utf8');
const lint = readFileSync(join(root, 'scripts/lint-content.mjs'), 'utf8');
/* 用例数锁：只数行首的 test( 注册调用，口径与 scripts/check-consistency.mjs 一致。
   宽松的 \btest\( 会把断言里的 .test(...) 与注释算进去（实测 154 vs 153）。 */
const browserTestsSrc = readFileSync(join(root, 'tests/browser-tests.js'), 'utf8');
const registeredTests = (browserTestsSrc.match(/^[ \t]*test\s*\(/gm) || []).length;
const contentFiles = [
  'bands', 'levels-kid', 'levels-kid-island4', 'levels-adult',
  'bank-kid-1-3', 'bank-kid-island4', 'bank-adult-1-3', 'bank-adult-island4',
  'bank-compose', 'levels-adult-work', 'library', 'meditate', 'dictionary', 'selfhelp', 'slowvars', 'help'
];
const headerVersion = (src.slice(0, 200).match(/\bv(\d+\.\d+\.\d+)\b/) || [])[1];
/* 发版号与存档 schema 是两套编号：1.0.0 进位不得带走 storage key。 */
S('js/core.js 头注释 / package.json 一致且符合 semver',
  headerVersion === pkg.version && /^\d+\.\d+\.\d+$/.test(pkg.version) &&
  /const SCHEMA_VERSION = \d+;/.test(src) && /const STORAGE_KEY = 'mood-island-v5';/.test(src));
const clVersions = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map(m => m[1]);
S('README / CHANGELOG / ROADMAP 版本口径一致且历史编号已重排',
  readme.includes(`当前版本 **${pkg.version}**`) &&
  roadmap.includes(`当前版本 **${pkg.version}**`) &&
  changelog.includes(`## [${pkg.version}]`) &&
  clVersions.length >= 10 && clVersions.every(v => /^\d+\.\d+\.\d+$/.test(v)) &&
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
/* 0.12.0 起逻辑拆成 js/*.js；content 全部排在第一个逻辑脚本之前。 */
const firstJs = html.indexOf(`src="${JS_FILES[0]}"`);
S('逻辑脚本全部在 content 之后加载', firstJs > html.lastIndexOf('content/library.js'));
S('心理学词典在 library 之后、逻辑脚本之前', html.indexOf('content/dictionary.js') > html.indexOf('content/library.js') && html.indexOf('content/dictionary.js') < firstJs);
S('冥想数据在 library 之后、dictionary 之前', html.indexOf('content/meditate.js') > html.indexOf('content/library.js') && html.indexOf('content/meditate.js') < html.indexOf('content/dictionary.js'));
S('自助工具箱在 dictionary 之后、逻辑脚本之前', html.indexOf('content/selfhelp.js') > html.indexOf('content/dictionary.js') && html.indexOf('content/selfhelp.js') < firstJs);
S('慢变量在 selfhelp 之后、逻辑脚本之前', html.indexOf('content/slowvars.js') > html.indexOf('content/selfhelp.js') && html.indexOf('content/slowvars.js') < firstJs);
S('急救入口文案在 slowvars 之后、逻辑脚本之前', html.indexOf('content/help.js') > html.indexOf('content/slowvars.js') && html.indexOf('content/help.js') < firstJs);
S('拼装数据在题库之后、逻辑脚本之前', html.indexOf('content/bank-compose.js') > html.indexOf('content/bank-adult-island4.js') && html.indexOf('content/bank-compose.js') < firstJs);
S('工作间数据在拼装数据之后、逻辑脚本之前', html.indexOf('content/levels-adult-work.js') > html.indexOf('content/bank-compose.js') && html.indexOf('content/levels-adult-work.js') < firstJs);
/* 拆分的结构契约：清单一致性比单个文件的内容更容易腐化，所以逐条锁住。 */
S('index.html 按清单顺序引入全部逻辑脚本', (() => {
  const at = JS_FILES.map(f => html.indexOf(`src="${f}"`));
  return at.every((v, i) => v > 0 && (i === 0 || v > at[i - 1])) && !html.includes('src="script.js"');
})());
S('逻辑脚本文件都在磁盘上', JS_FILES.every(f => existsSync(join(root, f))));
S('逻辑脚本之间没有重复的顶层声明', (() => {
  const decls = JS_FILES.flatMap(f => [...readFileSync(join(root, f), 'utf8')
    .matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
  return decls.length > 100 && new Set(decls).size === decls.length;
})());
const swManifest = readFileSync(join(root, 'sw.js'), 'utf8');
S('sw.js 预缓存清单与逻辑脚本清单一致', (() => {
  const block = (swManifest.match(/const ASSETS = \[([\s\S]*?)\]/) || [])[1] || '';
  const cached = [...block.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
  return JS_FILES.every(f => cached.includes(f)) && !cached.includes('script.js');
})());
const syntaxChecker = readFileSync(join(root, 'scripts/check-syntax.mjs'), 'utf8');
S('package.json 的 check 走清单化的语法检查', pkg.scripts.check === 'node scripts/check-syntax.mjs' && /JS_FILES/.test(syntaxChecker));
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
S('http(s) 换屏入栈、popstate 接住系统返回；file:// 仍 replaceState 并可回落',
  /history\.pushState/.test(src) && /history\.replaceState/.test(src) &&
  /location\.hash = want/.test(src) && /addEventListener\('popstate'/.test(src));
/* 1.0.0 体验收口：以下断言锁住实测过的四处断点，防止改回去。 */
S('页内目录锚点只滚动本页、不改写 hash',
  /closest\('a\[href\^="#"\]'\)/.test(src) && /e\.preventDefault\(\)/.test(src));
S('顶栏吸顶，弹窗内另有急救出口',
  /position: sticky; top: 0/.test(css) && /data-action="modal-help"/.test(src));
S('朗读题干兜底读 .lead，空内容不 cancel 正在播的语音',
  /\.scenario p, #stage \.lead/.test(src) && /if \(!list\.length\) return;/.test(src));
S('整屏渲染统一归零滚动',
  /function resetViewScroll/.test(src) && (src.match(/resetViewScroll\(\)/g) || []).length >= 6);
S('低龄档结果卡把机制说明折进「给大人看」',
  /lightResult/.test(src) && /result-more/.test(src) && /concept-start-folded/.test(src));
S('折叠内容显式 display:none，不靠 details 原生占位',
  /\.result-more > \.result-more-rows \{ display: none; \}/.test(css) &&
  /concept-start-folded:not\(\[open\]\)/.test(css));
S('深色跟随系统偏好，只切变量不写存档',
  /applyColorScheme/.test(src) && /prefers-color-scheme: dark/.test(src) &&
  /:root\[data-theme="dark"\]/.test(css) && /color-scheme" content="light dark"/.test(html));
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
/* 0.15.0：冥想练习完全不记录历史，也不收集输入 / 联网 */
const mdSrc = readFileSync(join(root, 'content/meditate.js'), 'utf8');
const mdData = mdSrc.replace(/\/\*[\s\S]*?\*\//g, '');
S('冥想数据不含输入 / 网络 / 存档调用',
  !/<input|<textarea|fetch\s*\(|XMLHttpRequest|localStorage/.test(mdData));
S('冥想练习视图不写存档，只改 session / play', (() => {
  const at = src.indexOf('function renderMeditatePractice');
  const end = src.indexOf('/* js/views-level.js', at);
  const block = at !== -1 && end > at ? src.slice(at, end) : '';
  return block.length > 0 && !/save\s*\(|localStorage|state\.(cleared|cards|skills|shells|sideCleared)/.test(block);
})());

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

/* ---------- 档位合并 / 深度层 / 学习闭环 ---------- */
const bandsSrc = readFileSync(join(root, 'content/bands.js'), 'utf8');
const glossarySrc = readFileSync(join(root, 'content/glossary.js'), 'utf8');
const kidBankSrc = ['bank-kid-1-3', 'bank-kid-island4', 'bank-compose']
  .map(f => readFileSync(join(root, `content/${f}.js`), 'utf8')).join('\n');
S('年龄档压到 4 档，6-12 岁合并档带 tiers',
  (bandsSrc.match(/"id":\s*"/g) || []).length === 4 &&
  /"name": "6-12 岁"/.test(bandsSrc) && /"tiers": true/.test(bandsSrc));
S('题库不再写死 a9，深度改由 tier 标记',
  !/['"]a9['"]/.test(kidBankSrc) && /tier/.test(kidBankSrc) && /v\.tier/.test(lint));
S('旧档 a9 由 BAND_REMAP 落到 a6，老字号 1.06 仍合法',
  /const BAND_REMAP = \{ 'a9': 'a6' \}/.test(src) && /remapBand\(s\.band\)/.test(src) &&
  /1\.06/.test(src) && /SCALE_VALUES/.test(src));
S('按深度层抽题，结果卡详细度绑当前题而不是绑年龄',
  /band\(\)\.tiers/.test(src) && /\(v\.tier \|\| 1\) === depth/.test(src) &&
  /lightResult = band\(\)\.id === 'a3' \|\| \(band\(\)\.tiers/.test(src));
S('概念层 20 条各有承接句与实践卡，且只写一份',
  (glossarySrc.match(/bridge:/g) || []).length === 20 &&
  (glossarySrc.match(/practice:/g) || []).length === 20 &&
  /function bridgeLine/.test(src) && /cDone\.practice/.test(src));
S('实践卡与双人对照只在内存，不进存档',
  /session\.pocket = \{/.test(src) && /session\.duo = \{/.test(src) &&
  /session\.pocket = null/.test(src) &&
  !/localStorage[^\n]*\b(pocket|duo)\b/.test(src) &&
  !/state\.settings\.[a-zA-Z]*\s*=.*\b(pocket|duo)\b/.test(src));
S('首站天气主按钮不再禁用',
  !/id="weather-go" disabled/.test(src) && /就这样出发/.test(src));
S('两个人的选择不判对错、不触发通关',
  /function paintDuo/.test(src) && /d\.first === d\.second/.test(src) &&
  /'duo-open'/.test(src) && !/completeLevel\([^\n]*duo/.test(src));
S('新增样式类都在视图里有对应渲染',
  ['level-bridge', 'level-depth', 'practice-card', 'duo-panel', 'weather-hint']
    .every(c => css.includes('.' + c) && src.includes(c)));

/* ---------- 1.0.0 收尾：健壮性改动必须留在代码里 ---------- */
/* defer 是「首屏不被 26 个脚本串行阻塞」的前提，也是保序契约的一部分。 */
S('index.html 全部脚本都用 defer 且 boot.js 仍是最后一个',
  (() => {
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)];
    return tags.length >= 26 && tags.every(m => /\bdefer\b/.test(m[0])) &&
      tags[tags.length - 1][1] === 'js/boot.js';
  })());
/* CSP 只在 http(s) 注入：file:// 双击是核心红线，不能被静态 meta 误伤。 */
S('CSP 只在 http(s) 下注入且策略不含 unsafe-eval / 内联脚本',
  /location\.protocol === 'http:'/.test(html) &&
  /Content-Security-Policy/.test(html) &&
  /script-src 'self'/.test(html) && /object-src 'none'/.test(html) &&
  !/unsafe-eval/.test(html) && !/script-src[^;]*'unsafe-inline'/.test(html));
/* 运行时游标一旦回到 state 就会重新落盘、导出后丢失。 */
S('运行时游标 levelIndex 只存在于 session，不写 state',
  /session\.levelIndex/.test(src) && !/state\.levelIndex/.test(src) &&
  /session\s*=\s*\{[\s\S]{0,200}levelIndex: 0/.test(src));
S('渲染期异常有全局兜底且给出两个出口',
  /window\.addEventListener\('error'/.test(src) &&
  /window\.addEventListener\('unhandledrejection'/.test(src) &&
  /function showFatalError/.test(src) &&
  /data-action="reload-app"/.test(src) && /data-action="fatal-dismiss"/.test(src) &&
  /ACTIONS\['fatal-dismiss'\]/.test(src));
S('跨标签页存档冲突有提示且只提示一次',
  /window\.addEventListener\('storage'/.test(src) &&
  /storageNotified/.test(src) && /另一个标签页更新了进度/.test(src));
/* 静默失败是这一轮的主要病根：SW 注册与预缓存失败都必须留痕。 */
S('SW 注册与预缓存失败都留控制台痕迹',
  /预缓存未完成/.test(swSrc) && /Service Worker 注册失败/.test(src) &&
  /SW 更新检查失败/.test(src));
S('安装入口按能力降级：有事件给按钮，没事件给手动路径',
  /beforeinstallprompt/.test(src) && /'install-app'/.test(src) && /装到主屏/.test(src) &&
  /添加到主屏/.test(src));
/* 结构债务护栏：1.1.0 把 views-library.js / actions.js 拆到 700 行以下后，
   任一块再触线就应再拆，而不是默默膨胀。逐文件数行，不含空行口径，取物理行数。 */
S('逻辑脚本均无超 700 行的结构债务',
  JS_FILES.every(f => readFileSync(join(root, f), 'utf8').split('\n').length <= 700));

/* 发布门槛的条件 6 要求留痕：1.0.0 必须有对应的发布记录。 */
S('1.0.0 发布记录已留痕', pkg.version !== '1.0.0' || existsSync(join(root, 'docs/release-1.0.0.md')));

/* ---------- 浏览器 ---------- */
const chrome = findChrome();
if (!chrome) {
  /* 无 Chrome 时不能让 70 项源码检查白跑：先把源码结论逐项给出来再退出。
     浏览器部分未运行，退出码仍为 1，CI 能感知「测不全」；
     只看源码结论时也可以单独跑 npm run doctor。 */
  const lines = staticChecks.map(c => `${c.ok ? 'PASS' : 'FAIL'} · [源码] ${c.name}`);
  const failed = lines.filter(l => l.startsWith('FAIL')).length;
  if (verbose) lines.forEach(l => console.log('  ' + l));
  else lines.filter(l => l.startsWith('FAIL')).forEach(l => console.log('  ✗ ' + l));
  console.log(`源码检查 ${staticChecks.length} 项（未运行浏览器）：${lines.length - failed} PASS / ${failed} FAIL`);
  console.error('✗ 找不到 Chrome / Chromium。设置 CHROME_PATH 指向可执行文件后重试。');
  process.exit(1);
}
/* index.html 的脚本统一用 defer 保序。注入的测试脚本也必须 defer，
   才能排在 boot.js 之后执行（否则非 defer 脚本会在解析期抢先运行，
   那时应用脚本尚未求值，测试会引用到未定义的 MI / ACTIONS / state）。 */
const appHtml = (() => {
  const re = /(<script\s+defer\s+src="js\/boot\.js"><\/script>)/;
  if (re.test(html)) return html.replace(re, '$1\n<script defer src="/tests/browser-tests.js"></script>');
  /* 兼容未加 defer 的历史 index.html，避免此处成为脆弱的硬编码单点 */
  if (html.includes('<script src="js/boot.js"></script>')) {
    return html.replace('<script src="js/boot.js"></script>', '<script src="js/boot.js"></script>\n<script src="/tests/browser-tests.js"></script>');
  }
  return html;
})();
if (!appHtml.includes('browser-tests.js')) {
  console.error('✗ 测试脚本注入失败：index.html 里没找到 js/boot.js 的引用。');
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
/* 用例数锁：注入页里若有裸 return 或异常，后面的 test() 不会注册，
   而 verdict 只统计已注册用例的 ok —— PASS 数会被静默压低却仍报「0 FAIL」。 */
const executedTests = result.lines.length;
if (executedTests !== registeredTests) {
  console.error(`✗ 用例数锁：静态注册 ${registeredTests} 条，实际执行 ${executedTests} 条。测试代码可能提前 return 或抛错，本次 PASS 数不可信。`);
  process.exit(1);
}
const failed = lines.filter(l => l.startsWith('FAIL')).length;
if (verbose) lines.forEach(l => console.log('  ' + l));
else lines.filter(l => l.startsWith('FAIL')).forEach(l => console.log('  ✗ ' + l));
console.log(`回归 ${executedTests} 项（注册 ${registeredTests} / 执行 ${executedTests}）+ 源码检查 ${staticChecks.length} 项：${lines.length - failed} PASS / ${failed} FAIL`);
process.exit(failed ? 1 : 0);
