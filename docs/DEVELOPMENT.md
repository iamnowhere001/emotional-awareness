# 开发手册 · mood-island

> 这里只放「怎么做」：打开方式、文件同步、加内容、自检与发版。现状与数据契约见 [README.md](../README.md)，已发生的事实见 [CHANGELOG.md](../CHANGELOG.md)，未来与不做什么见 [ROADMAP.md](../ROADMAP.md)。
> 应用纯前端、零依赖、零构建、不联网；Node.js 18+ 只用于自检、本地服务和回归。给代理的硬约束见 [AGENTS.md](../AGENTS.md)，术语见 [GLOSSARY.md](../GLOSSARY.md)，决定理由见 [docs/adr/](adr/)。

---

## 1. 本地运行

| 方式 | 操作 | 用途 |
| --- | --- | --- |
| 直接打开 | 双击 `index.html` | 日常使用与 `file://` 冒烟；内容、玩法、导出、导入、直达链接都可用 |
| 本地服务 | `npm run serve` → `http://localhost:5173` | 手机同网段预览；额外获得安装到主屏与离线打开 |

`npm run serve -- 8080` 可换端口。Service Worker 只在 http(s) 注册，`file://` 下直接跳过，不报错也不白屏；预缓存名带 `VERSION`，新版本会清掉旧缓存。应用仍无远程请求，报文只来自同源本地文件。用经典 `<script>` 而非 ES module 的原因见 ADR 0002。

---

## 2. 加载顺序与文件同步

顺序错了或文件缺失，`js/boot.js` 会显示「内容没加载出来」的可读提示，不会白屏。完整顺序写死在 [README.md](../README.md) §2.4 并由 `npm run doctor` 逐项校验；本节只讲改文件时要同步哪里。

| 权威 | 管什么 |
| --- | --- |
| `index.html` | 运行时加载顺序（当前 35 个脚本：内容 21 + 逻辑 14） |
| `scripts/js-files.mjs` | 逻辑脚本清单与顺序 |
| `scripts/lint-content.mjs` 顶部 `FILES` | 内容脚本清单与顺序 |
| `sw.js` 的 `ASSETS` | 预缓存清单，必须覆盖 `index.html` 的全部脚本 |

| 你新增 / 改名的是 | 必须同步 |
| --- | --- |
| `js/*.js` 逻辑文件 | `scripts/js-files.mjs`、`index.html`、`sw.js` |
| `content/*.js` 内容文件 | `scripts/lint-content.mjs` 的 `FILES`、`index.html`、`sw.js`；按依赖插入，别只追加到末尾 |
| 任何新交互 | `tests/browser-tests.js` 补用例 |
| 存档新字段 | `js/core.js` 的 `migrate()` 白名单、`SCHEMA_VERSION`、旧档实测 |

`content/glossary.js`（L0 概念层）排在 `bands.js` 之后、`levels-kid.js` 之前，最容易漏。十四块逻辑脚本共用同一全局词法作用域（`let/const` 跨脚本可见，不挂 `window`），同一顶层名字只能声明一次；`npm run check` 会拼接解析来拦重复声明。

> `scripts/regression.mjs` 有 4 处源码断言用 `indexOf('function …')` 切片定位（急救视图、`pickComposed`、冥想练习视图、`VIEW_CONFIG`）。改这几个函数名或搬出原文件时，必须同批改断言；行为本身已有浏览器用例覆盖。

---

## 3. 加内容

内容都是 `content/*.js` 里的纯数据，挂 `window.MI`，零逻辑、不联网。每次改完数据跑 `npm run lint`；新增文件先按 §2 同步清单。

### 3.1 加一组变体

在对应 `bank-*.js` 的**已有**关卡数组末尾 `push`，带档位标记 `b`；儿童 / 亲子轨还要带 `tier`（`1` 基础 / `2` 多想一步）：

```js
/* 注意是 push，不要用 Object.assign 覆盖整个键——那会把已有变体清掉 */
(MI.bankKid['4-2'] ||= []).push({
  b: ['a6', 'all'], tier: 1,
  scenario: '……', question: '现在大概到哪一档？',
  rungs: [{ label: '一档', body: '……', move: '……' }]
});
```

`b` 省略表示所有档可用。`pickVariant()` 按当前档过滤，`a6` 再按 `session.depth` 过滤；深度不落盘。只有新关卡第一次建键才用 `Object.assign(MI.bankKid, { 'x-y': [...] })`。

### 3.2 加一站

1. 在对应 `levels-*.js` 中加关卡对象，必须插在终章之前；照 `levels-kid-island4.js` 的 IIFE + `splice` 写法最省事。
2. 在题库文件加同名键，每档至少 2 组；儿童轨另需 `tier: 1` 至少 2 组、`tier: 2` 至少 1 组。
3. 带新词卡时，在 `library.js` 的 `CODEX` 补释义与例子；再到 `content/glossary.js` 把该站 id 挂到对应概念的 `stations`。
4. 跑 `npm run lint`。

关卡字段：`id / island / num / name / type / kind / card / skill / goal / tip / hint / tryIt / adult`。终章固定 `island: 0`、`type: 'finale'`，且必须排在数组最后。

### 3.3 加一座岛

照 `levels-kid-island4.js` + `bank-kid-island4.js`：关卡文件用 IIFE 把新站 `splice` 到终章前，题库文件用 `Object.assign` 合并；在 `MI.kid.islands` 或 `MI.adult.islands` 加描述；按 §2 同步新文件的脚本清单、加载顺序与缓存清单。

### 3.4 加一种题型

动四处：`js/views-level.js` 的 `RENDERERS` 与 `makePlay`、`js/actions-level.js` 的 `ACTIONS` 主表、`style.css`、`scripts/lint-content.mjs` 的 `TYPES` / `NEED`。参考最小实现 `ladder`，并补浏览器用例。

### 3.5 加 / 改词典词条

数据在 `content/dictionary.js`：`MI.dictionary` 是词条数组，`MI.dictionaryMeta` 定义分组与类型。

```js
{
  t: '依恋', e: 'Attachment', c: '发展与人格', k: 'core',
  s: '一句话释义（卡片正面）',
  d: '展开解释，写清边界与争议',
  m: '常见误解（可选）',
  r: ['气质', '亲密关系中的依恋']   // 可选：关联词条
}
```

- 必填 `t / e / c / k / s / d`，`t` 不重复；`r` 若给出必须是真实词条名，不能指向自己或重复。
- `c` 与 `k` 只认 `MI.dictionaryMeta`：`groups[].cats` 是合法主题，`kinds[].id` 是合法类型（`core / frontier / method / myth`）。新增主题或类型只改数据文件。
- `groups[]` 顺序是大组顺序，`MI.dictionary` 数组顺序就是卡片顺序，同主题必须连续；`catMeta[主题].lead` 是导语，`clusters[].start` 只声明该簇第一条。
- 数量不设上限，但少于 100 条会被 lint 拦住；浏览器用例读 `DICTIONARY.length`，加词条不必改测试数字。
- 写可重复的研究结论，对效应量与争议保守表述；不写诊断、疗效或个体化建议。

### 3.6 加 / 改自助工具卡

数据在 `content/selfhelp.js`，挂 `MI.selfhelp`：

- `states`：固定 **5 种**，字段 `id / name / sub / lead / moves[{t,d}] / avoid`，每种至少 3 个动作；
- `tools`：固定 **31 张**，字段 `t / e / c / when / how[] / note`，`c` 必须是既有分类，`how` 至少 2 步；在 `content/glossary.js` 的 `tools` 反链里标出所属概念；
- `distortions`：固定 **10 条**，字段 `t / d / eg`，只是速查表。

边界说明只有一份：`content/glossary.js` 的 `MI.safety`，词典 / 工具箱 / 慢变量 / 静修间共用，本文件不写 `safety`。危机情况明确指向当地急救与专业支持。

> `content/glossary.js` 是 L0 概念层，固定 **20 个概念**，字段 `id / kid / adult / line / mechanism / dose{time,steps,stop} / dict / tools / slowvars / stations`。站点 / 工具 / 词典 / 慢变量都通过反链挂到同一 id，`js/core.js` 启动时建反向索引。加概念时同步 `CODEX` 的两个卡名。

### 3.7 加 / 改慢变量

数据在 `content/slowvars.js`，挂 `MI.slowvars`，分方向层与日常层：

- `vars`：固定 **6 个**，字段 `id / name / sub / lead / why / misuse / move{t,d} / check`；`id` 是练习卡与日常的共同关联键；
- `daily`：固定 **5 件**，字段 `id / name / e / sub / dose{min,std} / when / why / cut / broken / v / link{kind,id}`；`cut`（再降一级）与 `broken`（断了怎么接回）必填，`v` 必须指向某个 `vars[].id`；
- `link`：出口只有 `{kind:'card'}`（页内卡）与 `{kind:'md'}`（进 `content/meditate.js` 引导）两种；加新出口要同步 `js/views-slowvars.js` 的 `svDailyLink()` 与 lint；
- `practices`：固定 **20 张**，字段 `t / e / v / when / how[] / note`，可选 `md`；`v` 必须是真实变量 id，每个变量至少 1 张，`how` 至少 2 步；
- `budget` 固定 **3 档**，`horizons` 固定 **3 个**，`traps` 固定 **12 条**，名称不得与认知扭曲重复。

边界说明读 `MI.safety`。不要做成 KPI 或打卡系统：日常层给最小剂量，做不完标准版不算失败，断了不补、不累计天数。

### 3.8 改急救入口文案

数据在 `content/help.js`，挂 `MI.help`：

- `actions`：固定 **3 个**，`id` 为 `ground`（`steps` 至少 3 步）、`name`（`words` 6–8 个，`after` 含 `{word}`）、`reach`（`say / sayKid / kidLead` 都要有）；
- `kid`：只引导「找一个大人」，不得出现热线号码；
- `numbers`：成人 / 亲子档本地求助信息，`items` 必须含 `12356` 与 `12355`，`note` 写明不承诺效果、不能代替专业帮助。

完成状态与选中的词只在内存，不写 `localStorage`。增加动作或改交互时同步 `tests/browser-tests.js`。

### 3.9 加 / 改冥想练习

数据在 `content/meditate.js`，挂 `MI.meditate`：

- `families`：固定 **5 个**，字段 `id / name / sub / concept / mechanism / notFor`；`concept` 必须是 `glossary.js` 已有概念；
- `scenes`：固定 **6 个**，字段 `id / name`；
- `practices`：固定 **10 条 = 5 族 × 2 档**，字段 `id / family / dose / name / sub / minutes / intro / scenes[] / steps[] / close`；`dose` 为 1 或 3，`steps` 3–5 步且每步 ≤ 40 字，每个场景至少 2 条短版；
- `intents`：固定 **8 句** if-then，字段 `t / family / scene`；`t` 含「如果…就…」，`family / scene` 指向真实族与场景或 `all`。

不写 `localStorage`，不新增 schema 字段，不显示次数、连续天数、时长或完成度。

### 3.10 拼装试点与工作间支线

**拼装试点**只用于 `4-3`（儿童 / 亲子）与 `A4-3`（成年），数据在 `content/bank-compose.js`：`asks` 是两种问法，`scenes` 按情境分组想法，`thoughts` 每条带 3–4 个镜头、恰好 1 个 `ok`。物化后仍是 `reframe` 契约（多一个可选 `question`），组合键 `scene:thought:ask`。选道是纯函数，不碰 `Math.random`：同一 `seen` 与种子必得同一组合。`seen` 落盘但界面不显示，每关最多 8 条，`restart-all` 不清。

给这两关加题＝往 `thoughts` 加一条并挂到 `scenes[].thoughts`；不要往 `bank-*.js` 加，那会变成死数据。调试可用 `pickVariant('4-3', { forceKey: 's1:t1:a1' })`，DOM 上 `[data-variant]` 可读组合键。

**工作间**是成年轨专题支线，数据在 `content/levels-adult-work.js`：四幕线性解锁（09:00 会前 / 11:00 汇报被否 / 15:00 冲突 / 19:30 下班反刍），走完 `A3-4` 开放第一幕，入口 `#/work`。它不计入 21 站，不加贝壳 / 词卡 / 本领，也不参与终章解锁；完成只写 `state.sideCleared`，儿童 / 亲子轨看不到入口。每幕 2 组手写变体，题型分别是 `clue / reframe / compose / chain`。

---

## 4. 自检与排错

改完提交前至少跑：

```bash
npm run verify      # = check + lint + size + doctor + test:e2e
```

各命令的作用见 [README.md](../README.md) §5。这里只补排错细节：

- `npm run doctor` 是文档与代码的一致性守卫。逐行看细节文本：出现「未命中」「未写死」说明有校验被绕开；不要只看 PASS 总数。修改 `SCALE_EXEMPT` / `DOCNUM_OPTIONAL` 是判断性决定，不是格式调整。
- `npm run test:e2e` 需要本机 Chrome / Chromium；找不到时设 `CHROME_PATH=/path/to/chrome`。`npm run test:e2e -- --verbose` 看逐项结果；测试页在内存注入，不改源文件。
- 改 `minify.mjs` 或内容后跑 `npm run test:e2e:dist`，证明压缩后行为不变。
- 体积预算写在 `scripts/check-size.mjs`；超了先瘦身，确需放宽必须在 CHANGELOG 说明理由。
- 加新交互在 `tests/browser-tests.js` 补用例；verify 全绿是每轮 DoD 第一条。

---

## 5. 发一个版本

`package.json.version` 是唯一权威值；以下动作由 doctor 与 regression 的结构断言共同锁定。

1. **版本六处同步**
   1. `package.json` 的 `version`
   2. `js/core.js` 首行头注释 `vX.Y.Z`
   3. `sw.js` 的 `const VERSION = 'X.Y.Z'`
   4. `README.md` 顶部「当前版本 **X.Y.Z**」
   5. `ROADMAP.md` 顶部「当前版本 **X.Y.Z**」
   6. `CHANGELOG.md` 顶部新增 `## [X.Y.Z]`

   发版号与存档号是两套编号：`SCHEMA_VERSION` 与 `mood-island-v5 / v4 / v3 / v2` 只在存档字段变化时 +1。

2. **跑检查**：`npm run verify` 与 `npm run doctor` 全绿，逐项看 doctor 细节；确认规模表、结构图与脚本清单同步。
3. **CHANGELOG 写六段**：新增 / 变更 / 修复 / 工程 / 验证 / 取舍。取舍段写清「这次故意没做什么、为什么」；不再解释编号占位。
4. **补人工验收**：窄屏 360 / 390 / 414px 无横向溢出、`file://` 双击冒烟、v2 / v3 / v4 旧档走 `migrate()`、红线复核；有导入功能时验证恶意 JSON。
5. **确认缓存刷新**：`VERSION` 改了 → 缓存名 `mood-island-${VERSION}` 变化 → `install` 预缓存新清单、`activate` 清旧缓存；断网重载能进且资源是新版。
6. **提交与 tag**：每个发版号对应一笔 `release:` 提交，随后打注释 tag（`git tag -a vX.Y.Z -m "release: X.Y.Z …"`），确认版本号 / 提交 / tag 一一对应。

历史例外（0.12.0 / 0.15.0 / 0.16.0）已留在 CHANGELOG，不改写历史，也不在本页复制理由。

---

## 6. 红线

完整六条见 [README.md](../README.md) §6，AGENTS 里有一行速记。最容易踩的两条：

- 不收自由文本；天气、筛选、冥想与慢变量的选择都不落盘，不记次数 / 天数。
- `clue / reframe / defuse / compose` 渲染前洗牌，判对错读 `data-orig`，正确答案不能恒在第一项。

碰到边界先改设计；`lint-content.mjs` 会扫红线词，但最终仍需人工判断语境。

---

## 7. 文档索引

| 文档 | 放什么 |
| --- | --- |
| [README.md](../README.md) | 现状、数据契约、命令、红线、无障碍 |
| [CHANGELOG.md](../CHANGELOG.md) | 已发生的事实与取舍 |
| [ROADMAP.md](../ROADMAP.md) | 未来、原则、候选池与不做什么 |
| [AGENTS.md](../AGENTS.md) | 代理不看就会做错的事 |
| [GLOSSARY.md](../GLOSSARY.md) | 开发术语索引 |
| [docs/adr/](adr/) | 不可逆决定的理由与复核条件 |
| [docs/agents/](agents/) | 单上下文边界、无 issue tracker 的工作单元、分诊标签 |
| [docs/archive/](archive/) | 历史审核与验收快照，不是当前事实 |
