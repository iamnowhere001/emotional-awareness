#!/usr/bin/env node
/* 一致性自检：node scripts/check-consistency.mjs（npm run doctor）
   零依赖、纯 Node、不启动浏览器。把「靠人工同步」的几组数字收成断言：
     版本六处 / index.html meta 规模数字 / 文档写死的测试规模 /
     index.html 脚本清单（集合与顺序）/ sw.js 预缓存覆盖 / README 加载顺序契约 /
     文档写死的岛数 / 站数 / 变体数 / 概念数 / 词卡数 = 内容实测值。
   任一 FAIL → exit 1。与 regression.mjs 里的版本断言并存，互不改动。 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JS_FILES } from './js-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log(`  PASS · ${name}${detail ? '：' + detail : ''}`); }
  else { fail++; console.log(`  FAIL · ${name}${detail ? '：' + detail : ''}`); }
};

console.log('一致性自检（不依赖 Chrome）');

/* ---------- 1. 版本六处一致 ---------- */
console.log('\n[版本六处一致]');
const pkgVersion = JSON.parse(read('package.json')).version;
const coreVersion = (read('js/core.js').slice(0, 200).match(/\bv(\d+\.\d+\.\d+)\b/) || [])[1];
const swVersion = (read('sw.js').match(/const VERSION = '([^']+)'/) || [])[1];
const readmeMd = read('README.md');
const roadmapMd = read('ROADMAP.md');
const changelogMd = read('CHANGELOG.md');
const docVersion = (md) => (md.match(/当前版本 \*\*(\d+\.\d+\.\d+)\*\*/) || [])[1];
const versions = [
  ['package.json', pkgVersion],
  ['js/core.js 头注释', coreVersion],
  ['sw.js VERSION', swVersion],
  ['README「当前版本」', docVersion(readmeMd)],
  ['ROADMAP「当前版本」', docVersion(roadmapMd)],
  ['CHANGELOG 顶部条目', (changelogMd.match(/^## \[(\d+\.\d+\.\d+)\]/m) || [])[1]]
];
versions.forEach(([name, v]) => check(name, v === pkgVersion, v || '未解析到'));
check('六处取值完全相同', versions.every(([, v]) => v === pkgVersion), pkgVersion);

/* ---------- 2. index.html meta description 的规模数字 ---------- */
console.log('\n[index.html meta 规模数字]');
/* 按加载顺序跑一遍 content/*.js：它们只往 window.MI 挂数据，顺序敏感
   （bands / levels-kid / levels-kid-island4 必须排在其余之前，否则 MI.kid.levels
   未定义会报错）。直接复用 lint-content.mjs 的 FILES 清单，不另写一份顺序。 */
const lintSrc = read('scripts/lint-content.mjs');
const lintFiles = [...((lintSrc.match(/const FILES = \[([\s\S]*?)\]/) || [])[1] || '')
  .matchAll(/'([^']+)'/g)].map(m => m[1]);
const ctx = {};
ctx.window = ctx;                       // 让「全局对象就是 window」，和浏览器一致
vm.createContext(ctx);
let vmError = null;
for (const name of lintFiles) {
  try {
    vm.runInContext(read(`content/${name}.js`), ctx, { filename: `content/${name}.js` });
  } catch (e) {
    if (!vmError) vmError = `content/${name}.js：${e.message}`;
  }
}
const MI = ctx.window.MI || ctx.MI || {};
const bandCount = Array.isArray(MI.bands) ? MI.bands.length : -1;
const dictCount = Array.isArray(MI.dictionary) ? MI.dictionary.length : -1;
check('content/*.js 按加载顺序全部可执行', !vmError && lintFiles.length > 0,
  vmError || `${lintFiles.length} 个文件 → MI.bands ${bandCount} / MI.dictionary ${dictCount}`);

const html = read('index.html');
const desc = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || '';
const cnNum = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const toNum = (s) => (/^\d+$/.test(s) ? Number(s) : (cnNum[s] || NaN));
const bandHit = desc.match(/(\d+|[一二三四五六七八九十])\s*档/);
const dictHit = desc.match(/(\d+)\s*条心理学词典/);
check('meta 年龄档数 = MI.bands.length',
  !!bandHit && toNum(bandHit[1]) === bandCount,
  `文档「${bandHit ? bandHit[0] : '未写'}」/ 实测 ${bandCount}`);
check('meta 心理学词典条数 = MI.dictionary.length',
  !!dictHit && Number(dictHit[1]) === dictCount,
  `文档「${dictHit ? dictHit[0] : '未写'}」/ 实测 ${dictCount}`);

/* ---------- 3. 文档写死的测试规模数字 ---------- */
console.log('\n[文档规模数字与实测一致]');
/* 只数行首的 test( 注册调用：宽松的 \btest\( 会把断言里的 `.test(...)` 和注释也算进去，
   与 regression.mjs 实际注册的用例数对不上（本轮实测 155 vs 152）。 */
const browserCount = (read('tests/browser-tests.js').match(/^\s*test\s*\(/gm) || []).length;
const sourceCount = (read('scripts/regression.mjs').match(/\bS\s*\(/g) || []).length;
check('实测规模：浏览器用例 / 源码检查', browserCount > 0 && sourceCount > 0,
  `test( ${browserCount} · S( ${sourceCount}`);
/* 只校验「当前口径」：README / ROADMAP 是现状文档，全文校验；
   CHANGELOG 的历史版本章节记录的是当时的 PASS 数（史实），不参与，
   只取「前言 + 顶部当前版本章节」，即第二个 ## [ 之前。
   文档改成「见 npm run doctor 输出」即不写死数字，正则不命中，天然通过。 */
const clHeads = [...changelogMd.matchAll(/^## \[/gm)].map(m => m.index);
const clCurrent = clHeads.length > 1 ? changelogMd.slice(0, clHeads[1]) : changelogMd;
const docs = [
  ['README.md', readmeMd],
  ['ROADMAP.md', roadmapMd],
  ['CHANGELOG.md（当前版本章节）', clCurrent]
];
const rules = [
  { re: /(\d+)\s*项浏览器/g, expect: browserCount, label: '项浏览器' },
  { re: /(\d+)\s*项源码检查/g, expect: sourceCount, label: '项源码检查' },
  { re: /(\d+)\s*PASS/g, expect: browserCount + sourceCount, label: 'PASS' }
];
docs.forEach(([file, text]) => {
  const bad = [], seen = [];
  rules.forEach(({ re, expect, label }) => {
    for (const m of text.matchAll(re)) {
      const n = Number(m[1]);
      seen.push(`${label}=${n}`);
      if (n !== expect) bad.push(`${label}「${n}」应为 ${expect}`);
    }
  });
  check(`${file} 写死的规模数字`, bad.length === 0,
    bad.length ? bad.join('；') : (seen.length ? `${seen.join(' ')} 均一致` : '未写死数字（以 doctor 输出为准）'));
});

/* ---------- 3b. 文档写死的内容规模 = 内容实测值 ---------- */
console.log('\n[内容规模数字与实测一致]');
/* 1.1.0 收尾把 README 正文改成 5 岛 / 111+41，但同一份 README 的岛屿行
   还留着「4 座」，源码注释停在 16 概念 / 16 站 / 17 站——doctor 当时只查
   测试规模，没查内容规模，所以漂移漏网。这里对每份现状文档「全文」扫同一个
   正则的「所有命中」：任一命中与实测不符即 FAIL，专治新旧值并存；
   若文档改成不写死数字，正则不命中，天然通过（同上节口径）。 */
const bankCount = o => Object.values(o || {}).reduce((s, a) => s + a.length, 0);
const measured = {
  islands: MI.kid && MI.kid.islands ? MI.kid.islands.length : NaN,
  levels: MI.kid && MI.kid.levels ? MI.kid.levels.length : NaN,
  bankKid: bankCount(MI.bankKid),
  bankAdult: bankCount(MI.bankAdult),
  glossary: Array.isArray(MI.glossary) ? MI.glossary.length : NaN,
  codex: MI.library && MI.library.CODEX ? Object.keys(MI.library.CODEX).length : NaN
};
check('内容实测规模可解析', Object.values(measured).every(n => Number.isFinite(n) && n > 0),
  JSON.stringify(measured));

const devMd = read('docs/DEVELOPMENT.md');
const kidLevelsSrc = read('content/levels-kid.js');
const glossarySrc = read('content/glossary.js');
const adultWorkSrc = read('content/levels-adult-work.js');
/* 全文扫描：hits 为空 = 文档没写死这项数字，放行；否则每个命中都必须等于实测。 */
const docNum = (label, text, re, expected) => {
  const hits = [...text.matchAll(re)].map(m => Number(m[1])).filter(Number.isFinite);
  const bad = hits.filter(n => n !== expected);
  check(label, bad.length === 0,
    bad.length ? `命中 ${hits.join('/')}，应为 ${expected}`
      : hits.length ? `${hits.length} 处均为 ${expected}` : '未写死（以实测为准）');
};

/* 岛数 */
docNum('README 岛屿数 = 实测', readmeMd, /每轨 (\d+) 座/g, measured.islands);
docNum('README 站点行括注岛数 = 实测', readmeMd, /（(\d+) 岛）/g, measured.islands);
docNum('README 边界表岛数 = 实测', readmeMd, /每轨 (\d+) 岛 \d+ 站/g, measured.islands);
docNum('index.html meta 岛数 = 实测', html, /(\d+) 座岛/g, measured.islands);
/* 站点数 */
docNum('README 站点数 = 实测', readmeMd, /每轨 \*\*(\d+) 站/g, measured.levels);
docNum('README 正关数 = 站点数-1', readmeMd, /(\d+) 关 \+ 终章/g, measured.levels - 1);
docNum('README 边界表站点数 = 实测', readmeMd, /每轨 \d+ 岛 (\d+) 站/g, measured.levels);
docNum('index.html meta 站点数 = 实测', html, /座岛 (\d+) 站/g, measured.levels);
docNum('levels-kid.js 头注释正关数', kidLevelsSrc, /正文 (\d+) 关/g, measured.levels - 1);
docNum('levels-kid.js 头注释站点数', kidLevelsSrc, /终章 = (\d+) 站/g, measured.levels);
docNum('levels-adult-work.js 头注释站点数', adultWorkSrc, /不计入 (\d+) 站/g, measured.levels);
docNum('DEVELOPMENT 工作间站点数', devMd, /不计入 (\d+) 站/g, measured.levels);
/* 变体数 */
docNum('README 儿童变体数 = 实测', readmeMd, /儿童 \*\*(\d+) 组\*\*/g, measured.bankKid);
docNum('README 成年变体数 = 实测', readmeMd, /成年 \*\*(\d+) 组\*\*/g, measured.bankAdult);
docNum('README 变体合计 = 实测', readmeMd, /合计 (\d+) 组/g, measured.bankKid + measured.bankAdult);
docNum('README 边界表儿童变体数', readmeMd, /儿童变体 (\d+) 组/g, measured.bankKid);
docNum('README 边界表成年变体数', readmeMd, /儿童变体 \d+ 组 \+ 成年 (\d+) 组/g, measured.bankAdult);
/* 概念与词卡 */
docNum('README 概念层条数 = 实测', readmeMd, /概念层 (\d+) 条/g, measured.glossary);
docNum('README 词卡释义条数 = 实测', readmeMd, /词卡释义 (\d+) 条/g, measured.codex);
docNum('glossary.js 头注释概念数', glossarySrc, /概念层 · (\d+) 个概念/g, measured.glossary);
docNum('DEVELOPMENT 概念数', devMd, /固定 \*\*(\d+) 个概念\*\*/g, measured.glossary);
/* 源码注释也会漂：1.1.0 把内容扩到 20 概念 / 21 站，core.js 的注释一直停在 16 / 17，
   因为 doctor 只扫文档、不扫 js/。这里用最宽的口径扫 core.js ——
   只要出现「N 个概念」或「N 站」，N 就必须等于实测（F14）。 */
const coreSrc = read('js/core.js');
docNum('core.js 注释概念数 = 实测', coreSrc, /(\d+) 个概念/g, measured.glossary);
docNum('core.js 注释站点数 = 实测', coreSrc, /(\d+) 站/g, measured.levels);
/* 状态描述（同类漂移，非数字） */
check('README 不再声称儿童档文案「未改」',
  !/儿童档个别术语偏超龄、丧失意象待改写 \| 已在 0\.13\.0 审核中记录，未改/.test(readmeMd));

/* ---------- 4. index.html 脚本清单（集合与顺序）+ sw.js 预缓存 ---------- */
console.log('\n[脚本清单与预缓存]');
/* 容忍 src 之外的合法属性（如 defer）：逐标签匹配后单独取 src，
   保持「顺序敏感」的校验语义不变。 */
const htmlScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(tag => /\bsrc="([^"]+)"/.exec(tag[0]))
  .filter(m => !!m)
  .map(m => m[1]);
const diskContent = readdirSync(join(root, 'content'))
  .filter(f => f.endsWith('.js')).sort().map(f => `content/${f}`);
const lintContent = lintFiles.map(n => `content/${n}.js`);
const htmlContent = htmlScripts.filter(s => s.startsWith('content/'));
const htmlJs = htmlScripts.filter(s => s.startsWith('js/'));
check('lint-content.mjs 的 FILES = content/ 目录实际文件（集合）',
  sameSet(diskContent, lintContent), `${diskContent.length} 个 .js`);
check('index.html 内容脚本 = content/ 目录实际文件（集合）',
  sameSet(diskContent, htmlContent), `${htmlContent.length} 条`);
check('index.html 内容脚本顺序 = lint-content.mjs 的 FILES 顺序',
  htmlContent.join('|') === lintContent.join('|'));
check('index.html 逻辑脚本顺序 = JS_FILES',
  htmlJs.join('|') === JS_FILES.join('|'), `${htmlJs.length} 条`);
check('index.html 全部脚本 = 内容脚本 + 逻辑脚本（顺序与集合）',
  htmlScripts.join('|') === [...lintContent, ...JS_FILES].join('|'), `${htmlScripts.length} 条`);
check('index.html 引用的脚本文件都在磁盘上',
  htmlScripts.every(s => existsSync(join(root, s))));
const swSrc = read('sw.js');
const assets = (swSrc.match(/const ASSETS = \[([\s\S]*?)\]/) || [])[1] || '';
const cached = [...assets.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
check('sw.js ASSETS 覆盖 index.html 的全部脚本文件',
  htmlScripts.every(s => cached.includes(s)),
  `${htmlScripts.filter(s => cached.includes(s)).length}/${htmlScripts.length}`);

/* ---------- 5. README 加载顺序契约字符串 ---------- */
console.log('\n[README 加载顺序契约]');
/* README §3.1 曾把加载顺序写成一行「bands → … → js/boot」。若还在，
   必须与 index.html 实际顺序逐项一致；若改写为「见 index.html」之类
   不再写死，则天然通过。 */
const contract = readmeMd.split('\n')
  .find(l => l.includes('→') && /\bbands\b/.test(l) && l.trim().startsWith('`'));
if (!contract) {
  check('README 加载顺序契约', true, '未写死契约字符串（以 index.html 为准）');
} else {
  const items = contract.replace(/`/g, '').split('→').map(s => s.trim()).filter(Boolean)
    .map((s) => {
      const clean = s.replace(/\.js$/, '');
      return clean.includes('/') ? `${clean}.js` : `content/${clean}.js`;
    });
  const same = items.join('|') === htmlScripts.join('|');
  check('README 加载顺序契约 = index.html 实际顺序', same,
    same ? `${items.length} 项一致` : `契约 ${items.length} 项 / 实际 ${htmlScripts.length} 项`);
}

console.log(`\n结果：${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
console.log('一致性自检通过。');
