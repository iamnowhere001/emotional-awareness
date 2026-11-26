#!/usr/bin/env node
/* 极保守的压缩器：只删注释、行首缩进与多余空白，不改标识符、不动换行。
   node scripts/minify.mjs 可单独跑一次，打印各文件的压缩前后体积。

   为什么不追求「真正的」压缩：本项目零依赖，也没有构建链。手写一个会改标识符、
   会做 ASI 技巧的压缩器，一旦出问题就是线上静默坏掉、本地测试全绿。
   所以这里只做两件不可能改变语义的事：
     1. 整行注释、行首缩进、空行——这些一定不是代码；
     2. 不含引号的行里，行尾 // 注释与连续空格——有引号就整行不动，宁可少省几个字节。
   跨行的模板字符串整行原样保留：那里的缩进是内容，不是排版。
   JS 与 CSS 都按这个口径走，产出由 scripts/build.mjs 写进 dist/。 */

/* JS：逐行处理，跨行模板字符串与块注释用行级状态机跟踪。 */
export function minifyJs(src) {
  const out = [];
  let inBlock = false;
  let inTemplate = false;
  for (const raw of src.split('\n')) {
    const ticks = (raw.match(/(?<!\\)`/g) || []).length;
    const startedInTemplate = inTemplate;
    if (ticks % 2 === 1) inTemplate = !inTemplate;
    /* 行首或行尾落在模板字符串里：整行原样保留（缩进属于内容）。 */
    if (startedInTemplate || inTemplate) { out.push(raw); continue; }

    if (inBlock) {
      if (raw.includes('*/')) inBlock = false;
      continue;
    }
    const line = raw.trimStart();
    if (!line.trim()) continue;
    if (line.startsWith('//')) continue;
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    /* 有引号的行只去缩进：分不清 // 是在字符串里还是注释里，就不动它。
       行尾注释必须带前导空白才算——`/^#\//` 这种正则里的 `//` 没有空格，
       按 `\s*` 去匹配会把正则从中间切断（实测把 shell.js 的地址同步整段改坏）。 */
    if (/['"`]/.test(line)) { out.push(line.trimEnd()); continue; }
    const noTail = line.replace(/[ \t]+\/\/.*$/, '');
    out.push(noTail.replace(/[ \t]{2,}/g, ' ').trimEnd());
  }
  return out.join('\n');
}

/* CSS：注释删掉、空白压成一个，只在大括号与分号附近再收一次。
   不碰字符串（content: "✓" 这类），也不猜哪里可以不留空格——
   calc() 的加号两边必须有空格，少一个就整条声明失效，省那几个字节不值。 */
export function minifyCss(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const trimSpace = () => { if (out.endsWith(' ')) out = out.slice(0, -1); };
  while (i < n) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && src[j] !== ch) { if (src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (/\s/.test(ch)) {
      while (i < n && /\s/.test(src[i])) i++;
      if (out && !out.endsWith(' ')) out += ' ';
      continue;
    }
    if ('{};'.includes(ch)) {
      trimSpace();
      out += ch;
      i++;
      while (i < n && /\s/.test(src[i])) i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out.trim();
}
