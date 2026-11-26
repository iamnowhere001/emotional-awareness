#!/usr/bin/env node
/* 首屏体积预算：node scripts/check-size.mjs
   把「浏览器打开首页真正要下载的那批文本资源」加总，raw / gzip / brotli 各算一遍。

   为什么要有预算：1.2.0 的弱网首开是 14.6 秒，39 个请求、解码 692KB。压缩能砍掉三分之二，
   但剩下的部分只要没人看着，就会随每次「加一条词条、加一个题型」慢慢涨回去。
   预算的作用是让这种增长必须显式过一次门槛，而不是等到用户对着白屏等十几秒才发现。

   口径：index.html 里引用的全部脚本与本地样式 / manifest，加上 index.html 本身。
   图标是 PNG，不进这个口径（压缩对它无效）。
   改预算就在下面的常量里改，并在 CHANGELOG 写清为什么。 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f));

/* 预算（KB）。当前实测 raw 691.7 / gzip 249.9 / br 208.4，各留约 8% 余量。 */
const BUDGET = { raw: 760, gzip: 275, br: 232 };

const html = readFileSync(join(root, 'index.html'), 'utf8');
const files = ['index.html', 'style.css', 'manifest.webmanifest'];
for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) files.push(m[1]);
for (const m of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)) {
  if (!/^https?:|^data:/.test(m[1])) files.push(m[1]);
}
const uniq = [...new Set(files)];

let raw = 0, gzip = 0, br = 0;
const missing = [];
for (const f of uniq) {
  let body;
  try { body = read(f); } catch { missing.push(f); continue; }
  raw += body.length;
  gzip += gzipSync(body, { level: 9 }).length;
  br += brotliCompressSync(body).length;
}

const kb = (n) => (n / 1024).toFixed(1);
console.log('首屏体积预算（文本资源）');
console.log(`  文件数 ${uniq.length}（index.html + 样式 + manifest + 全部脚本）`);
console.log(`  raw    ${kb(raw).padStart(7)} KB / 预算 ${BUDGET.raw} KB`);
console.log(`  gzip   ${kb(gzip).padStart(7)} KB / 预算 ${BUDGET.gzip} KB`);
console.log(`  brotli ${kb(br).padStart(7)} KB / 预算 ${BUDGET.br} KB`);

let fail = 0;
const over = (label, val, max) => {
  if (val / 1024 > max) { fail++; console.log(`  FAIL · ${label} ${kb(val)} KB 超出预算 ${max} KB`); }
};
if (missing.length) { fail++; console.log(`  FAIL · index.html 引用了不存在的文件：${missing.join(', ')}`); }
over('raw', raw, BUDGET.raw);
over('gzip', gzip, BUDGET.gzip);
over('brotli', br, BUDGET.br);

if (fail) {
  console.log(`\n结果：${fail} 项超预算。要么瘦身，要么在 scripts/check-size.mjs 里改预算并在 CHANGELOG 说明原因。`);
  process.exit(1);
}
console.log('\n结果：在预算内。');
