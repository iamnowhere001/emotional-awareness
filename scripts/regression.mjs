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
const contentFiles = [
  'bands', 'levels-kid', 'levels-kid-island4', 'levels-adult',
  'bank-kid-1-3', 'bank-kid-island4', 'bank-adult-1-3', 'bank-adult-island4', 'library', 'dictionary'
];
S('script.js 头注释版本为 v6', /心情闯关岛 v6/.test(src.slice(0, 200)));
S('index.html 进度占位不再写死 13 关', !/13 关/.test(html));
S('content/*.js 全部被 index.html 引入', contentFiles.every(n => html.includes(`content/${n}.js`)));
S('script.js 在所有 content 之后加载', html.lastIndexOf('script.js') > html.lastIndexOf('content/library.js'));
S('心理学词典在 library 之后、script.js 之前', html.indexOf('content/dictionary.js') > html.indexOf('content/library.js') && html.indexOf('content/dictionary.js') < html.indexOf('script.js'));

/* ---------- 浏览器 ---------- */
const chrome = findChrome();
if (!chrome) {
  console.error('✗ 找不到 Chrome / Chromium。设置 CHROME_PATH 指向可执行文件后重试。');
  process.exit(1);
}
const harness = html.replace(
  '<script src="script.js"></script>',
  '<script src="script.js"></script>\n<script src="/tests/browser-tests.js"></script>'
);
if (!harness.includes('browser-tests.js')) {
  console.error('✗ 测试脚本注入失败：index.html 里没找到 script.js 的引用。');
  process.exit(1);
}

const server = createStaticServer({ '/__harness.html': harness });
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
  '--window-size=390,900',
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
