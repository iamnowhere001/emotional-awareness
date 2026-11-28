# ADR-0002 不使用 ES module

- 状态：Accepted（2026-11-26）
- 日期：2026-11-26

## 上下文

所有 `content/*.js` 与 `js/*.js` 以经典 `<script defer>` 顺序加载，共用同一个全局词法作用域，不挂 `window`、不 import。产品红线要求 `file://` 双击 `index.html` 必须完整可玩，而 ES module 在 `file://` 下会被 CORS 拦住。

## 决定

不引入 ES module，也不引入任何打包器。新增逻辑文件继续进 `scripts/js-files.mjs` → `index.html` → `sw.js` 的 `ASSETS` 三处清单。

## 后果

放弃的：`import/export` 的静态分析、模块级作用域隔离、无 tree-shaking、无按需加载。
换到的：`file://` 下零配置可玩（家长不会为了玩一个小游戏开本地服务器）；改完刷新即见。
代价的兜底：`npm run check` 把十四块拼起来再解析一次，拦跨文件重复顶层声明；`doctor` 锁住三处清单与顺序，并对 `js/` 目录做反查。

## 复核条件

只有「产品决定放弃 `file://`、改为必须安装 PWA」时才重开。仅凭「ES module 更现代 / 能 tree-shaking」不足以重开——本项目零构建，没有可被 tree-shake 的体积。
