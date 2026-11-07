/* 逻辑脚本语法检查：逐个解析，再把九块拼接起来解析一次。
   经典脚本共用一个全局词法作用域，跨文件重复顶层声明（比如两个文件都写 const state）
   在浏览器里会让整页 SyntaxError 白屏，单文件 node --check 抓不到；
   拼接解析就是给这类错误设的闸。 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JS_FILES } from './js-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

for (const file of JS_FILES) {
  try {
    new vm.Script(readFileSync(join(root, file), 'utf8'), { filename: file });
  } catch (e) {
    errors.push(`✗ ${file}：${e.message}`);
  }
}

try {
  const all = JS_FILES.map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
  new vm.Script(all, { filename: 'js/*.js（拼接）' });
} catch (e) {
  errors.push(`✗ 跨文件拼接：${e.message}`);
}

if (errors.length) {
  errors.forEach((e) => console.error(e));
  process.exit(1);
}
console.log(`语法检查通过：${JS_FILES.length} 个逻辑脚本，跨文件无重复顶层声明。`);
