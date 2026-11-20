# 开发手册 · 心情闯关岛

> 面向改代码 / 改内容的人。这里放具体操作步骤，**[README.md](../README.md) 只留现状与契约**（规模表、加载顺序、命令表、设计红线、存档迁移），本页不重复现状数字，只讲「怎么做」。
> 应用本身**纯前端 · 零依赖 · 零构建 · 不联网**：不需要 Node、不需要安装依赖、不需要打包；Node.js 18+ 只用于内容自检、本地静态服务和浏览器回归。
> 分工：现状与数据契约见 [README.md](../README.md) §2 / §3；已发生的事实见 [CHANGELOG.md](../CHANGELOG.md)；未来计划与发布门槛见 [ROADMAP.md](../ROADMAP.md)；历史审核与验收记录见 [docs/archive/](archive/)。

---

## 1. 两种打开方式

| 方式 | 操作 | 适用场景 |
| --- | --- | --- |
| 直接打开 | 双击 `index.html` | 日常使用。`file://` 下完整可玩，已实测 |
| 本地服务 | `npm run serve` → `http://localhost:5173` | 手机同网段预览；service worker 需要 http |

- `npm run serve -- 8080`（或 `node scripts/serve.mjs 8080`）可指定端口。
- **`file://` 双击**：内容、玩法、导出、导入、`#/level/x` 直达全部可用；service worker 只在 `http(s)` 下注册，`file://` 下直接跳过，不报错也不白屏。
- **本地静态服务**：额外获得「安装到主屏 / 离线打开」。`sw.js` 预缓存全部静态资源，缓存名带 `VERSION`；新版本 `VERSION` 变化会让旧缓存在 `activate` 阶段被清掉，页面导航走网络优先、失败才用缓存。应用本身仍然零远程请求。
- **为什么不用 ES module**：`content/*.js` 与 `js/*.js` 都用经典 `<script>` 顺序加载，是为了让 `file://` 双击也能跑（ES module 在 `file://` 下会被 CORS 拦住）。

---

## 2. 加载顺序契约（改文件前先读）

内容文件是纯数据、逻辑文件用经典脚本顺序加载，**顺序敏感**。顺序错了或文件缺失，`js/boot.js` 启动时会显示「内容没加载出来」的可读提示，不会白屏。

**单一来源，三处必须同步**：

| 文件 | 职责 |
| --- | --- |
| `scripts/js-files.mjs` | 逻辑脚本清单，加载顺序的**单一来源** |
| `index.html` | 按清单顺序写 `<script src="…">`（当前 26 个脚本） |
| `sw.js` | `ASSETS` 预缓存清单，与 `index.html` 一致 |

新增 / 改名**逻辑文件**时同步以上三处；新增**内容文件**时还要把文件名加进 `scripts/lint-content.mjs` 顶部的 `FILES` 数组，并在 `index.html` 按依赖顺序插入 `<script>`。九块逻辑脚本共用同一个全局词法作用域（`let/const` 跨脚本可见，不挂 `window`），因此**同一顶层名字只能声明一次**；`npm run check` 会把九块拼起来再解析一次，专门拦跨文件重复声明。

**完整加载顺序（`index.html` 实际 26 项，以 `npm run doctor` 的输出为准）**：

- 内容（17）：`bands → glossary → levels-kid → levels-kid-island4 → levels-adult → bank-kid-1-3 → bank-kid-island4 → bank-adult-1-3 → bank-adult-island4 → bank-compose → levels-adult-work → library → meditate → dictionary → selfhelp → slowvars → help`
- 逻辑（9）：`js/core → js/util → js/shell → js/views-main → js/views-library → js/views-level → js/ui → js/actions → js/boot`（`boot.js` 必须最后）

> `content/glossary.js`（L0 概念层）排在 `bands.js` 之后、`levels-kid.js` 之前，容易被漏写。`npm run doctor` 会校验这份契约，改动后以它的输出为准。

---

## 3. 加内容

所有内容都是 `content/*.js` 里的纯数据，挂到 `window.MI`，零逻辑、不联网。改完数据文件一律跑一次 `npm run lint`（见 §4）。

### 3.1 加一组变体（最常见）

在对应 `bank-*.js` 里往**已有的**该关数组末尾 `push` 一条，带上档位标记 `b`；儿童 / 亲子轨还要带 `tier`（`1` 基础 / `2` 多想一步）：

```js
/* 注意是 push，不要用 Object.assign 覆盖整个键——那会把已有变体清掉 */
(MI.bankKid['4-2'] ||= []).push({
  b: ['a6', 'all'], tier: 1,
  scenario: '……', question: '现在大概到哪一档？',
  rungs: [{ label: '一档', body: '……', move: '……' }]
});
```

`b` 省略表示该组对所有档可用；`pickVariant()` 按当前档过滤，6-12 岁合并档再按当前深度层过滤（深度只存在 `session.depth` 里，不落盘）。**只有新关卡第一次建键**才用 `Object.assign(MI.bankKid, { 'x-y': [...] })`。

### 3.2 加一站

1. 在 `levels-*.js`（或新建的 `levels-*-islandN.js`）里加关卡对象，**必须插在终章之前**；照 `levels-kid-island4.js` 的 IIFE + `splice` 写法最省事；
2. 在对应题库文件里加同名键，每档至少 2 组变体；儿童轨还要保证 `tier: 1` 至少 2 组、`tier: 2` 至少 1 组（lint 会校验）；
3. 如果带新词卡，在 `library.js` 的 `CODEX` 补释义和例子；再到 `content/glossary.js` 把该站 id 挂到对应概念的 `stations`（结果卡据此取「为什么可能有用」，漏挂 lint 会提示）。

关卡对象字段：`id / island / num / name / type / kind / card / skill / goal / tip / hint / tryIt / adult`。终章固定 `island: 0` 且 `type: 'finale'`，**必须排在数组最后**，位置错了 lint 直接报错。

### 3.3 加一座岛

照 `levels-kid-island4.js` + `bank-kid-island4.js` 的写法：关卡文件用 IIFE 把新站 `splice` 到终章之前，题库文件用 `Object.assign` 合并；在 `MI.kid.islands`（或 `MI.adult.islands`）加一条岛屿描述；最后在 `index.html` 按依赖顺序插入两行 `<script>`。**别忘了把新文件名加进 `scripts/lint-content.mjs` 顶部的 `FILES` 数组**，否则自检读不到它，同时同步 `sw.js` 的 `ASSETS`。

### 3.4 加一种题型

需要动四处：`js/views-level.js` 的 `RENDERERS`（渲染）与 `makePlay`（初始化 play 状态）、`js/actions.js` 的 `ACTIONS`（交互处理）、`style.css`；以及 `lint-content.mjs` 的 `TYPES` / `NEED`。参考 `ladder` 这个题型，它是最小实现。

### 3.5 加 / 改词典词条

数据在 `content/dictionary.js`：`MI.dictionary` 是词条数组，`MI.dictionaryMeta` 定义分组与概念类型。每条字段：

```js
{
  t: '依恋', e: 'Attachment', c: '发展与人格', k: 'core',
  s: '一句话释义（卡片正面）',
  d: '展开解释，写清边界与争议',
  m: '常见误解（可选）',
  r: ['气质', '亲密关系中的依恋']   // 可选：关联词条，渲染成「接着看」
}
```

- **数量不设上限**：0.8.2 起取消「固定 100 条」，`npm run lint` 只保留一条「少于 100 条即报错」的防误删下限；浏览器用例一律读 `DICTIONARY.length`，加词条不必改测试里的数字。
- `c`（主题）与 `k`（概念类型）**只认 `MI.dictionaryMeta`**：`groups[].cats` 展开即合法主题，`kinds[].id` 是合法类型。当前 4 大组 / 11 主题 / 4 类型（`core` 入门核心 / `frontier` 当代议题 / `method` 方法与证据 / `myth` 容易误读）。`myth` 判据是「现象或工具本身被证据削弱、或效果被明显夸大」，写进数据文件头注释。**新增主题或类型只改数据文件**。
- **顺序即阅读路径**：`groups[]` 顺序是大组顺序，`MI.dictionary` 数组顺序就是卡片顺序，同主题词条必须连续；`catMeta[主题].lead` 是导语，`clusters[].start` 只声明该簇第一条。
- 必填 `t / e / c / k / s / d`，`t` 不重复；`r` 若给出必须是真实词条名、不能指向自己、不能重复。
- 改完跑 `npm run lint`（校验字段、主题、类型、关联引用、去重、每个主题 / 类型都有词条、文案长度、导语与概念簇起点）。写内容优先用可重复的研究结论，对效应量与争议保守表述，不写诊断、疗效或个体化建议。

### 3.6 加 / 改自助工具卡

数据在 `content/selfhelp.js`，挂 `MI.selfhelp`，三块：

- `states`：当下状态卡，固定 **5 种**，字段 `id / name / sub / lead / moves[{t,d}] / avoid`，每种至少 3 个可做动作；
- `tools`：工具卡，固定 **31 张**，字段 `t / e / c / when / how[] / note`，`c` 必须是既有分类之一（心力恢复 / 认知自助 / 行为与身体 / 关系与支持 / 自助边界），`how` 至少 2 步；卡头统一显示「自助练习，不是治疗」，并在 `content/glossary.js` 的 `tools` 反链里标出所属概念；
- `distortions`：认知扭曲速查，固定 **10 条**，字段 `t / d / eg`，只是速查表，不再单独占一张工具卡。

**边界说明只有一份**：统一放在 `content/glossary.js` 的 `MI.safety`，词典 / 自助工具箱 / 慢变量 / 静修间共用，本文件不再写 `safety`。改完跑 `npm run lint`（检查数量、分类、字段、名称去重与结构）。只做科普与一般性练习，危机情况明确指向当地急救与专业支持。

> `content/glossary.js` 是 L0 概念层，固定 **16 个概念**，字段 `id / kid / adult / line / mechanism / dose{time,steps,stop} / dict / tools / slowvars / stations`。站点 / 工具卡 / 词典 / 慢变量都通过反链挂到同一个 id，`js/core.js` 启动时建反向索引；`MI.safety` 是唯一的边界说明。加概念时同步 `CODEX` 里的两个卡名，并在 lint 校验下跑 `npm run lint`。

### 3.7 加 / 改慢变量

数据在 `content/slowvars.js`，挂 `MI.slowvars`，**分两层**：`vars` 方向层（为什么值得养）、`daily` 日常层（今天做多少）。

- `vars`：固定 **6 个**，字段 `id / name / sub / lead / why / misuse / move{t,d} / check`；`id` 用小写字母 / 数字 / 连字符，是练习卡与日常共同的关联键；
- `daily`：日常五件套，固定 **5 件**，字段 `id / name / e / sub / dose{min,std} / when / why / cut / broken / v / link{kind,id}`。`dose.min` 是「今天也能做完」的量，`cut`（再降一级）与 `broken`（断了怎么接回）**必填**；`v` 必须指向某个 `vars[].id`；
- `link`：**日常层不新增练习**，出口只有 `{kind:'card', id: 练习卡标题}`（页内卡）与 `{kind:'md', id: 静修间练习 id}`（直接进 `content/meditate.js` 引导）两种。加新出口要同时改 `js/views-library.js` 的 `svDailyLink()` 与 lint；
- `practices`：练习卡，固定 **20 张**，字段 `t / e / v / when / how[] / note`，可选 `md`。**`v` 必须是某个 `vars[].id`**：选中变量时按 `v` 自动筛到相关卡片，每个变量至少 1 张，`how` 至少 2 步；
- `budget` 时间预算固定 **3 档**（`t / d / picks[]`，`picks` 至少 2 项且必须是 `practices[].t`）、`horizons` 时间尺度固定 **3 个**（`t / d / asks[] / cards[]`）、`traps` 快变量陷阱固定 **12 条**（`t / d / eg`，名称不得与 10 条认知扭曲重复）。

边界说明统一读 `content/glossary.js` 的 `MI.safety`。改完跑 `npm run lint`（数量、`v` 关联、每个变量都有卡、`daily.link` 两种出口、`budget.picks` 与 `cards` 交叉引用、重名、旧字段 `c` 残留、去重与字段完整性）。不要把慢变量做成 KPI 或打卡系统：日常层给的是**最小剂量**，做不完标准版不算失败，断了不补、不累计天数。

### 3.8 改急救入口文案

数据在 `content/help.js`，挂 `MI.help`：

- `actions`：固定 **3 个**，`id` 分别是 `ground`（先落地，`steps` 至少 3 步）、`name`（给感受一个词，`words` 6–8 个、`after` 必须含 `{word}` 占位符）、`reach`（找一个人，`say` / `sayKid` / `kidLead` 都要有）；
- `kid`：儿童档说明，只引导「找一个大人」，**不得出现热线号码**；
- `numbers`：成人 / 亲子档的本地求助信息，`items` 必须含 `12356` 与 `12355`，`note` 必须写清「不承诺效果 / 不能代替专业帮助」。

改完跑 `npm run lint`（检查动作数量、字段、号码与免责口径，并禁止文案出现网络调用或链接）。急救页的完成状态与选中的词只在内存，**不写 localStorage、不进存档**；`session.helpFrom` 记录进入前那一屏，返回按钮与 Esc 都回到那里。增加动作或改交互时同步补 `tests/browser-tests.js`。

### 3.9 加 / 改冥想练习

数据在 `content/meditate.js`，挂 `MI.meditate`：

- `families`：固定 **5 个**，字段 `id / name / sub / concept / mechanism / notFor`；`concept` 必须是 `glossary.js` 已有概念，只作「接着读」锚点；
- `scenes`：固定 **6 个**，字段 `id / name`；
- `practices`：固定 **10 条 = 5 族 × 2 档**，字段 `id / family / dose / name / sub / minutes / intro / scenes[] / steps[] / close`；`dose` 只能是 1 或 3，每族各一条；`steps` 3–5 步、每步 ≤ 40 字；每个场景至少 2 条短版；
- `intents`：固定 **8 句** if-then，字段 `t / family / scene`；`t` 必须含「如果…就…」，`family / scene` 指向真实族与场景（或 `all`）。

改完跑 `npm run lint`（族数 / 剂量 / 步骤长度 / 场景引用 / 概念锚点 / `notFor` / if-then 句式）。练习页不写 `localStorage`，不新增 schema 字段，不显示次数、连续天数、时长或完成度。

### 3.10 拼装试点与工作间支线

**拼装试点**只在 `4-3`（儿童 / 亲子）与 `A4-3`（成年）两关做通，数据在 `content/bank-compose.js`：`asks` 是两种问法，`scenes` 把想法按情境分组，`thoughts` 每条自带 3–4 个镜头、恰好 1 个 `ok`。物化后仍是现有 `reframe` 契约（只多一个可选 `question`），组合键是 `scene:thought:ask`，展开成 12 组。选道是纯函数，**不碰 `Math.random`**：同一份 `seen` 与种子必得同一组合；`seen` 落盘但不在界面显示，每关最多 8 条，超出丢最旧，`restart-all` 不清 `seen`。调试点：`pickVariant('4-3', { forceKey: 's1:t1:a1' })` 可强制复现，DOM 上 `[data-variant]` 能读到组合键。

**工作间**是成年轨专题支线，数据在 `content/levels-adult-work.js`：四幕线性解锁（09:00 会前 / 11:00 汇报被否 / 15:00 冲突 / 19:30 下班反刍），走完 `A3-4` 开放第一幕，时间线视图是 `#/work`。它不计入 17 站，不加贝壳 / 词卡 / 本领，也不参与终章解锁；完成只写 `state.sideCleared`，儿童 / 亲子轨看不到入口。每幕 2 组手写变体，题型分别是 `clue / reframe / compose / chain`。

---

## 4. 改完必跑

```bash
npm run verify      # = check + lint + doctor + test:e2e
```

**每次提交前至少跑这一条**。逐项说明：

| 命令 | 脚本 | 查什么 |
| --- | --- | --- |
| `npm run check` | `node scripts/check-syntax.mjs` | 逐个 + 按 `scripts/js-files.mjs` 清单拼接解析 `js/*.js`，拦跨文件重复顶层声明 |
| `npm run lint` | `node scripts/lint-content.mjs` | 内容自检，不引依赖、不启浏览器。用 vm 按加载顺序执行 `content/*.js`，校验两轨关卡结构与岛屿对应、每档每关 ≥2 组、终章位置与唯一性、词卡 / 本领与 `CODEX`、各题型内部一致性（`answer` 越界、`chain` 标签、`sort` 落筐、`compose` 恰 1 个 gentle、记忆牌去重、`ladder` 档位）、拼装槽位、工作间四幕、静修 / 冥想练习分组与字段、词典 / 自助工具箱 / 慢变量的数量与字段、`v` 关联、`daily.link` 出口、`budget` 交叉引用、急救动作与号码、概念层 16 条反链真实性、文案长度、评分 / 诊断 / 疗效类红线词 |
| `npm run doctor` | `node scripts/check-consistency.mjs` | 跨文档与加载顺序一致性自检（版本六处、规模数字、加载顺序契约等）。**加载顺序与版本口径以它的输出为准**，有疑义先跑它 |
| `npm run test:e2e` | `node scripts/regression.mjs` | 无头 Chrome 浏览器回归（浏览器用例 + 源码检查，数量以 `npm run doctor` 输出为准；跑在真 390×900 iframe 里），约 1.5 秒。源码检查还会锁住「`index.html` 按清单顺序引入逻辑脚本、`sw.js` 预缓存清单一致、版本六处一致」等结构契约 |

- `test:e2e` 需要本机有 Chrome / Chromium；找不到时设置 `CHROME_PATH=/path/to/chrome`。测试页是在内存里注入用例生成的临时 HTML，**不会改动任何源文件**。`npm run test:e2e -- --verbose` 可看逐项结果。
- 加新交互在 `tests/browser-tests.js` 补用例；`verify` 全绿是每轮 DoD 的第一条（见 [ROADMAP.md](../ROADMAP.md) §5.2 / §5.3）。

---

## 5. 发一个版本

一次发版按 [ROADMAP.md](../ROADMAP.md) §4.3 / §5.3 的固定动作走，顺序如下：

1. **版本六处同步**（`package.json.version` 是唯一权威值，六处由 `scripts/regression.mjs` 源码断言锁定，缺一处 verify 就会红）：
   1. `package.json` 的 `version`
   2. `js/core.js` 首行头注释 `vX.Y.Z`
   3. `sw.js` 的 `const VERSION = 'X.Y.Z'`
   4. `README.md` 第 5 行「当前版本 **X.Y.Z**」
   5. `ROADMAP.md` 顶部「当前版本 **X.Y.Z**」及 §4.2 基线表
   6. `CHANGELOG.md` 顶部新增 `## [X.Y.Z]` 条目
   > 发版号与存档号是两套编号：`SCHEMA_VERSION`（当前 5）与 `mood-island-v5 / v4 / v3 / v2` 只在存档字段变化时 +1，**重排发版号不得跟着改**。
2. **跑 `npm run verify` 与 `npm run doctor`**：确认六处一致、规模表与结构图同步、加载顺序契约无偏差，以 doctor 输出为准。再按 §5.3 补窄屏 360 / 390 / 414px 无横向溢出、`file://` 双击冒烟、旧档 JSON 走 `migrate()`、红线复核。
3. **CHANGELOG 写六段**：「新增 / 变更 / 修复 / 工程 / 验证 / 取舍」，取舍段写清「这次故意没做什么、为什么」；**不再解释编号占位**（§4.3）。
4. **确认 `sw.js` 字节与缓存名变化**（§5.3 第 7 项）：`VERSION` 改了 → 缓存名 `mood-island-${VERSION}` 随之变化 → `install` 预缓存新清单、`activate` 清掉所有旧缓存。有 SW 时额外验证缓存更新（临时副本 A→B 只改 `VERSION`，切到 B 后 reload 只剩新缓存）；有导入功能时额外验证恶意 JSON。
5. **一笔提交 + 一个 tag**：每个发版号对应一个 git commit，没有提交就不算发版；自 0.17.0 起恢复「一版一笔提交」（§4.3 记录了 0.12.0 / 0.15.0 / 0.16.0 的历史例外）。提交后打注释 tag（`git tag -a vX.Y.Z -m "release: X.Y.Z …"`），确认版本号、提交、tag 三者一一对应（§5.3 第 9 项）。`v1.0.0` 是第一个正式 tag。

内容文件新增后同步 `index.html` 加载顺序、`lint-content.mjs` 的 `FILES`、README 结构与规模表；新增交互在 `tests/browser-tests.js` 补用例；逻辑文件新增或改名同步 `scripts/js-files.mjs`、`index.html`、`sw.js` 三处。文档职责：README = 现状与契约，CHANGELOG = 已发生的事实，ROADMAP = 未来计划，三者不互相复述。

---

## 6. 设计红线速查（改动前先读）

完整版见 [README.md](../README.md) §7，六条速记：

1. **不打分、不排名、不比速度**：无分数、正确率、倒计时、失败惩罚、红叉、连签、排行榜；答错给中性提示，连续两次未命中自动给 `hint`。
2. **不采集心情文本**：无心情自由输入框，天气选择不落盘，词典搜索 / 工具箱与慢变量的选择只留在内存、每次重新打开清空，日常五件套不记次数与天数。
3. **不联网**：无 fetch/XHR、无第三方脚本 / 字体 / 图标 / CDN；朗读调用设备自带能力，SW 只缓存同源静态文件。
4. **不宣称疗效**：不是心理测评、不是诊断、不能代替专业帮助；页脚与静修间双重免责，呼吸 / 正念练习可睁眼、随时停止。
5. **不制造回来的压力**：不打卡、不连续登录奖励、进度不会掉；静修间按场景与练习族排列，不记录次数 / 天数 / 时长，练习可随时停。
6. **正确答案不能恒在第一项**：`clue / reframe / defuse / compose` 渲染前洗牌，判对错读 `data-orig` 的原始下标。

新增内容若碰到这些边界，先改设计再写代码。`lint-content.mjs` 会扫红线词，但最终仍需要人工判断语境（README §7）。

---

## 7. 相关文档

- [README.md](../README.md) — 现状、内容规模、加载顺序、命令表、存档迁移、设计红线、无障碍、相关文档
- [CHANGELOG.md](../CHANGELOG.md) — 逐版本变更与迁移记录（六段式）
- [ROADMAP.md](../ROADMAP.md) — 未来计划、版本与归档规范 §4、批次节奏与发布清单 §5、1.1.0 规划
- [release-1.0.0.md](release-1.0.0.md) — 1.0.0 发布记录：六条门槛证据与 §5.3 清单
- [crisis-review-1.0.0.md](crisis-review-1.0.0.md) — 危机号码与服务范围复核记录
- [archive/content-review-0.13.0.md](archive/content-review-0.13.0.md) — 内容审核记录（0.13.0 → 0.17.0）历史归档，**不是当前事实**
- [archive/acceptance-1.0.0-review.md](archive/acceptance-1.0.0-review.md) — 1.0.0 门槛盘点与 2026-11-08 验收记录，历史快照
- [archive/audit-0.19.0.html](archive/audit-0.19.0.html) — 2026-11-20 全维度代码审查报告（13 条发现与修复状态）
