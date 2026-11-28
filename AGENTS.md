# AGENTS.md · mood-island

给改这个仓库的 AI 代理。只写「不看就会做错」的事；现状数字不在这里，在指针目标里。

按年龄分级的情绪启蒙小游戏。**纯前端 · 零构建 · 零依赖 · 不联网 · 不打分 · 不采心情文本**；`file://` 双击 `index.html` 必须完整可玩——这是产品红线，不是技术偏好。

## 改完必跑

```bash
npm run verify     # check + lint + size + doctor + test:e2e，提交前必跑
```

只改文档就跑 `npm run doctor`（文档与代码的一致性守卫）。判据是**细节文本**而非 PASS 总数：出现「未命中」「未写死」即说明有校验被绕开了。

## 加文件时的同步清单（最容易漏的一步）

| 你新增的是 | 必须同步改 | 漏了会怎样 |
| --- | --- | --- |
| `js/*.js` 逻辑文件 | `scripts/js-files.mjs` + `index.html` + `sw.js` 的 `ASSETS` | doctor FAIL（三处都有反查） |
| `content/*.js` 内容文件 | `index.html` 顺序 + `scripts/lint-content.mjs` 的 `FILES` + `sw.js` 的 `ASSETS` | doctor FAIL，lint 读不到 |
| 任何新交互 | `tests/browser-tests.js` 补用例 | 行为无护栏 |
| 存档新字段 | `js/core.js` 的 `migrate()` 白名单 + `SCHEMA_VERSION` + 旧档实测 | 老进度被静默重置 |

逻辑清单的单一来源是 `scripts/js-files.mjs`，运行时加载顺序的单一来源是 `index.html`；内容清单在 `scripts/lint-content.mjs` 的 `FILES`，缓存清单在 `sw.js` 的 `ASSETS`。

## 顺序错了是 TypeError，不是「随机错乱」

1. `levels-*-island4/5.js` 用 `findIndex(type === 'finale')` + `splice` 插站，必须排在定义 `MI.kid` / `MI.adult` 的 `levels-kid.js` / `levels-adult.js` 之后。
2. `bank-*-island4/5.js` 用裸 `Object.assign(MI.bankKid, …)`（无 `||=` 兜底），必须排在 `bank-kid-1-3.js` 之后。
3. `content/glossary.js`（L0 概念层）排在 `bands.js` 之后、`levels-kid.js` 之前。
4. `js/core.js` 的 `ID_REMAP` / `BAND_REMAP` / 坏档留底状态必须在 `let state = load()` 之前声明；挪到后面落进 TDZ，症状是后续脚本全报 `state is not defined`。
5. 十四块逻辑脚本共用同一个全局词法作用域，同一顶层名字只能声明一次；`check-syntax.mjs` 拼起来再解析一次来拦。

## 两条轨各自独立

`kid` 轨（`a3` / `a6` / `all`）与 `adult` 轨的关卡表、题库、进度、词卡全部分开，复用儿童壳＝破坏红线。`a6` 档内再分 `tier: 1` 基础 / `tier: 2` 多想一步，深度只存在 `session.depth`，不落盘，且**只对 `a6` 生效**。

## 红线（碰到就停下来改设计，不要改红线）

① 不打分 / 不排名 / 不比速度，没有分数、正确率、倒计时、连击、排行榜。② 不采集心情文本，不收自由文本，天气选择与筛选状态都不落盘。③ 不联网，无 fetch / XHR / 第三方脚本 / 字体 / CDN。④ 不宣称疗效，不是测评也不是诊断，危机内容只指路到专业帮助。⑤ 不制造回来的压力，不打卡、不连续天数、进度不掉。⑥ 正确答案不能恒在第一项：`clue / reframe / defuse / compose` 渲染前洗牌，判对错读 `data-orig`。

## 禁止操作

- 不引入构建工具、打包器、npm 依赖、TS、框架、CDN、ES module。
- 不手改 `dist/`（构建产物）与 `docs/archive/`（历史快照，不是当前事实）。
- 不把 `content/*.js` 写成带逻辑的代码：纯数据，只挂 `window.MI`。
- 不为让测试变绿而放宽体积预算或断言；要放宽必须在 `CHANGELOG.md` 写理由。

## 上下文指针（按需取用，不要一次全读）

- **要加内容**（变体 / 站 / 岛 / 题型 / 词典 / 工具箱 / 慢变量 / 静修）→ `docs/DEVELOPMENT.md` §3，每类一节，只读你那节。
- **要弄清「这个词指什么」** → `GLOSSARY.md`。站/关、概念/词条类型、岛/轨/档 都在那里，不要猜。
- **要知道某项决定的理由，或想推翻它** → `docs/adr/`。动加载方式先读 0002，动存档先读 0004。
- **要查当前规模、题型字段表、加载顺序契约、存档字段** → `README.md`。
- **要知道某个功能为什么不做** → `ROADMAP.md` §2「不排的东西」与 §6，不要重新提议。
- **代理工作边界与分诊** → `docs/agents/`：单上下文、无 issue tracker 的工作单元、改动分诊标签。
- **`docs/` 下的 `.html` 与 `docs/archive/`** → 历史审查报告与历史快照，不是当前事实，别当规格读。
