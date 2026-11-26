#!/usr/bin/env node
/* 构建期压缩：node scripts/build.mjs → dist/
   仓库本身不做任何构建：根目录就是可直接双击打开的应用，源码保持可读。
   dist/ 只是「上线用的一份拷贝」——同样的路径、同样的清单，只有 JS / CSS 被压过，
   所以 dist/index.html 与根目录的 index.html 逐字节相同，sw.js 的预缓存清单也照旧成立。

   为什么不是打包器：本项目零依赖，也没有引入 npm 包的打算。
   scripts/minify.mjs 只删注释与缩进，不改标识符、不动换行，
   产出是否等价由 `npm run test:e2e:dist` 用同一套 167 条浏览器用例在 dist/ 上跑一遍来证明。
   没跑过那一步之前，别把 dist/ 当成可信产物。 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JS_FILES } from './js-files.mjs';
import { minifyJs, minifyCss } from './minify.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const kb = (n) => (n / 1024).toFixed(1);

/* 原样拷贝的文件：路径与内容都不动，避免和 sw.js 的预缓存清单 / manifest 对不上。 */
const COPY = ['index.html', 'manifest.webmanifest', 'sw.js'];
const COPY_DIRS = ['icons', 'content'];

/* 只删自己产出的目录；路径写死，不接受参数。 */
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

let rawTotal = 0, minTotal = 0;
const rows = [];

for (const f of COPY) {
  const body = readFileSync(join(root, f));
  writeFileSync(join(out, f), body);
  rawTotal += body.length; minTotal += body.length;
  rows.push([f, body.length, body.length]);
}
for (const d of COPY_DIRS) {
  for (const abs of walk(join(root, d))) {
    const rel = relative(root, abs);
    const dest = join(out, rel);
    mkdirSync(dirname(dest), { recursive: true });
    const body = readFileSync(abs);
    writeFileSync(dest, body);
    rawTotal += body.length; minTotal += body.length;
    rows.push([rel, body.length, body.length]);
  }
}

for (const f of JS_FILES) {
  const src = readFileSync(join(root, f), 'utf8');
  const min = minifyJs(src);
  /* 压完必须还能被解析：这一条挡住「压缩器把正则从中间切断」这类事故。 */
  new vm.Script(min, { filename: f });
  const dest = join(out, f);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, min);
  rawTotal += Buffer.byteLength(src); minTotal += Buffer.byteLength(min);
  rows.push([f, Buffer.byteLength(src), Buffer.byteLength(min)]);
}

const cssSrc = readFileSync(join(root, 'style.css'), 'utf8');
const cssMin = minifyCss(cssSrc);
writeFileSync(join(out, 'style.css'), cssMin);
rawTotal += Buffer.byteLength(cssSrc); minTotal += Buffer.byteLength(cssMin);
rows.push(['style.css', Buffer.byteLength(cssSrc), Buffer.byteLength(cssMin)]);

rows.filter(r => r[2] < r[1]).forEach(([f, a, b]) => {
  console.log(`  ${f.padEnd(28)} ${kb(a).padStart(7)} KB → ${kb(b).padStart(7)} KB  (-${((1 - b / a) * 100).toFixed(0)}%)`);
});
console.log(`\n共 ${rows.length} 个文件：${kb(rawTotal)} KB → ${kb(minTotal)} KB（-${((1 - minTotal / rawTotal) * 100).toFixed(1)}%）`);
console.log(`产出目录：${relative(root, out)}/　（上线用这份；根目录仍是可直接双击的源码）`);
