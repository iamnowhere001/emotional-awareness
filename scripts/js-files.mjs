/* 逻辑脚本清单（顺序敏感）。
   index.html 的加载顺序、sw.js 的预缓存清单、check-syntax 与 regression.mjs
   的拼接读源码都以此为准；新增 / 改名逻辑文件只改这里，再同步 index.html 与 sw.js。 */
export const JS_FILES = [
  'js/core.js',
  'js/util.js',
  'js/shell.js',
  'js/views-main.js',
  'js/views-library.js',
  'js/views-level.js',
  'js/ui.js',
  'js/actions.js',
  'js/boot.js'
];
