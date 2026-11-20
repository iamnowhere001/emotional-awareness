# 心情闯关岛

> 一起认出心里的天气。按年龄分级的情绪启蒙小游戏：**纯前端 · 零依赖 · 不联网 · 不打分 · 不采集心情文本**。
>
> 当前版本 **1.1.0**（2026-11-20：补岛 5 + 拆分超限逻辑文件；1.0.0 发布证据见 [docs/release-1.0.0.md](docs/release-1.0.0.md)）｜后续安排见 [ROADMAP.md](ROADMAP.md)

这不是心理测评，也不能代替专业帮助。它做的事只有一件：把模糊的感觉看得更清楚一点，再带走一个用得上的小工具。

---

## 1. 快速开始

| 方式 | 操作 | 适用场景 |
| --- | --- | --- |
| 直接打开 | 双击 `index.html` | 日常使用。`file://` 下完整可玩，已实测 |
| 本地服务 | `npm run serve` → `http://localhost:5173` | 手机同网段预览；`Service Worker` 与「安装到主屏」需要 http(s) |

`npm run serve -- 8080`（或 `node scripts/serve.mjs 8080`）可指定端口。**应用本身不需要 Node、不需要构建、不需要安装依赖**；Node.js 18+ 只用于内容自检、本地静态服务和浏览器回归。

首次进入先选年龄段，之后从设置里可随时更换；换档保留进度、词卡和本领，不会覆盖用户手动调过的字号与朗读偏好。

---

## 2. 内容规模（当前实测）

| 项目 | 数量 |
| --- | --- |
| 年龄档 | **4 档**：`a3` 3-6 岁 / `a6` 6-12 岁（合并档，带基础 / 多想一步两层）/ `all` 亲子全年龄 / `adult` 成年。旧档 `a9` 由 `BAND_REMAP` 落到 `a6`，存档不丢 |
| 关卡轨 | 2 条：儿童与亲子共用 `kid`；成年独立 `adult` |
| 岛屿 | 每轨 5 座（儿童：察觉湾 / 调节林 / 联结港 / 安放角 / 回望角；成年：觉察滩 / 调节林 / 联结港 / 安放角 / 回望角） |
| 站点 | 每轨 **21 站 = 20 关 + 终章**（5 岛）|
| 玩法 | 13 种互动题型 + 终章，共 14 个 `type`；静修间另有 `sit` 引导 |
| 题库变体 | 儿童 **111 组**，成年 **41 组**，合计 152 组；每档每关至少 2 组。儿童池按 `tier: 1 / 2` 分两层，6-12 岁合并档每关可抽 **3～5 组**（原每关 2 组） |
| 内容库 | 概念层 20 条（站点 / 工具卡 / 词典 / 慢变量共用同一概念 id）· 词卡释义 35 条（按 20 个概念成组，其中多组是两轨双名）· 聊卡 10 · 微行动 8 · 装饰 6 · 漂流瓶 16 · 静修练习 10 · **冥想练习 10（5 族 × 2 档 / 6 场景 / 8 句 if-then）** · **心理学词典 162 条（4 大组 / 11 主题 / 45 个概念簇 / 4 类概念，每条带关联词条）** · **自助工具 31 张 + 认知扭曲 10 条速查** · **慢变量 6 个（方向层）+ 日常五件套 5 件（早起 / 冥想 / 阅读 / 写作 / 运动，各带最小剂量、再降一级、断了怎么接回）+ 练习 20 张（按 6 变量归属，数量不等）+ 时间预算 3 档 + 尺度 3 个 + 陷阱 12 个** · **急救入口 3 个短动作（约 1 分钟 / 20 秒 / 30 秒）+ 4 条本地求助信息** |

两条轨的关卡 `id` 前缀不同（儿童 `1-1…5-4 / finale`，成年 `A1-1…A5-4 / A-finale`），进度天然隔离，`clearedInTrack()` 各算各的；成年档不显示也不发放贝壳。**词卡也按轨记录**（`state.cards = { kid, adult }`）：两轨同名的 5 张卡（觉察 / 身体信号 / 强度 / 火气分级 / 边界）在各自图鉴里独立解锁，不会因为玩过儿童档就点亮成年图鉴；另有若干组概念两轨叫法不同（如 情绪粒度 / 命名）。图鉴在渲染层按 20 个概念合并成组并标出另一种叫法，**存档键值仍是原来的卡名，schema 不变**。

### 题型与数据字段

| `type` | 做什么 | 变体必填字段 |
| --- | --- | --- |
| `weather` | 随手挑一个今天的天气，不选也能走 | `items` |
| `clue` | 翻线索卡，合起来猜感觉 | `scenario, clues, options, answer, why` |
| `slider` | 拖刻度看感受的分量 | `scenario, question, replies` |
| `match` | 近义感受配对 | `pairs, words` |
| `breath` | 慢呼吸；`mode: 'space'` 时是三段各一分钟的呼吸空间，不引导吸呼节奏 | `rounds, note`（空间模式加 `mode: 'space'`） |
| `reframe` | 换一个更贴近事实的镜头 | `thought, options, answer, why` |
| `chain` | 把感受—想法—行为—需要串起来 | `scenario, tags, cards` |
| `sort` | 把卡片分进几个筐 | `baskets, cards` |
| `perspective` | 同一件事，不同人怎么看 | `scenario, roles` |
| `order` | 给事情排个顺序 | `scenario, steps` |
| `compose` | 拼一句既说出自己、又不指责对方的话 | `scenario, rows` |
| `memory` | 记忆翻牌 | `pairs` |
| `ladder` | 火气/强度分档，选哪档都算完成并给一个动作 | `scenario, question, rungs` |
| `finale` | 终章（儿童版布置小岛；成年版四段收束） | — |

除主线外还有：**急救入口（顶栏常驻 + 首页卡片 + 地图「随时可用」组，冷启动 1 次点击进入；给 3 个短动作（约 1 分钟 / 20 秒 / 30 秒）：先落地 / 给感受一个词 / 找一个人，其中「先落地」是 5-4-3-2-1 的急诊版（先落地、做几次呼吸、说出眼前看到的 3 样东西；完整五步在自助工具箱），全部在本页完成，不记录选择、不落盘；成人 / 亲子档附 12356、12355 等本地求助信息，儿童档只引导「找一个大人」）**、词卡图鉴、本领清单、漂流瓶（16 题，可换一题且不连续重复）、静修间（成年档支线，**2.0：5 个练习族 × 2 档 + 6 个场景筛选 + 10 条情境练习**；新练习按步引导、可选呼吸圆、不显示剩余秒数、不记录次数 / 天数 / 时长；旧 10 条按「现在很烦 / 现在很累 / 睡不着 / 心里空」四组折叠保留，不计时不打卡）、心理学词典（162 条，按 4 个大组 / 11 个主题分区，组与主题都有一句导语、长主题再切概念簇，页顶另有 5 步起步路径；可叠加「主题 × 概念类型 × 搜索」三维筛选，卡片底部可跳到关联词条，跨主题会标出目标主题；不计进度、不落盘）、自助工具箱（5 种当下状态 + 31 张工具卡 + 10 条认知扭曲速查，选择式与阅读式，不填心情文字、不记录选择）、慢变量（两层：6 个长期底盘管方向，5 件日常五件套管今天——早起 / 冥想 / 阅读 / 写作 / 运动，每件给最小剂量、再降一级与断点处理，出口一律落到已有练习卡或静修间引导；另 20 张按变量归属的练习卡、3 档按可用时间挑的预算、3 个时间尺度、12 个快变量陷阱，选变量自动收拢相关练习，只读不打卡、不记天数）、终章、显示与数据设置。

---

## 3. 项目结构

```
.
├── index.html                    # 容器 + 内容文件加载顺序（顺序敏感）
├── style.css                     # 浅色主题、字号/动效/高对比、3-6 档大按钮
├── js/                           # 全部逻辑，经典脚本顺序加载，共用同一个全局词法作用域
│   ├── core.js                   # 常量 / 内容别名 / 派生白名单 / 轨道辅助 / 顶层状态 / 存档 load·migrate·save
│   ├── util.js                   # 转义与洗牌 / 拼装选道 / 微型渲染件 / 设置应用
│   ├── shell.js                  # 视图配置表 / 顶栏与进度 / hash 路由 / 反馈 / 解锁链 / 朗读
│   ├── views-main.js             # 选年龄段 / 首页 / 急救 / 地图 / 工作间 / 静修列表
│   ├── views-dictionary.js       # 知识库公共骨架 + 心理学词典
│   ├── views-selfhelp.js         # 自助工具箱视图
│   ├── views-slowvars.js         # 慢变量视图
│   ├── views-retreat.js          # 静修间练习与 sit 引导
│   ├── views-level.js            # RENDERERS / makePlay / renderLevel / 子渲染 / 通关结果卡
│   ├── ui.js                     # 弹窗 / 导出导入 / 设置 / 词卡图鉴 / 本领 / 漂流瓶
│   ├── actions-level.js          # ACTIONS 主表：关卡 / 导航 / 急救 / 朗读 / 各题型
│   ├── actions-library.js        # 追加：词典 / 自助 / 慢变量 / 静修间动作
│   ├── actions-data.js           # 追加：选档 / 重开 / 安装 / 导出导入 / 设置 / 清空
│   └── boot.js                   # 事件委托 / 离线注册 / 按 hash 进首屏（必须最后加载）
├── manifest.webmanifest          # PWA 清单：名称、起始页、图标（只在 http(s) 下被浏览器读取）
├── sw.js                         # service worker：按版本号预缓存静态资源，不含任何用户数据
├── icons/                        # 192 / 512 / maskable-512 PNG + 源 SVG
├── content/                      # 纯数据，零逻辑，挂到 window.MI
│   ├── bands.js                  # 4 个年龄档
│   ├── levels-kid.js             # 儿童/亲子主线（岛 1-3 + 终章）
│   ├── levels-kid-island4.js     # 岛 4 四站，插在终章之前
│   ├── levels-kid-island5.js     # 岛 5 四站（羞耻/比较/孤单/求助），插在终章之前
│   ├── levels-adult.js           # 成年独立关卡表
│   ├── levels-adult-island5.js   # 成年岛 5 四站（A5-1…A5-4）
│   ├── bank-kid-1-3.js           # 儿童题库（岛 1-3）
│   ├── bank-kid-island4.js       # 儿童题库（岛 4）
│   ├── bank-kid-island5.js       # 儿童题库（岛 5）
│   ├── bank-adult-1-3.js         # 成年题库（岛 1-3）
│   ├── bank-adult-island4.js     # 成年题库（岛 4）
│   ├── bank-adult-island5.js     # 成年题库（岛 5）
│   ├── bank-compose.js           # 拼装试点：4-3 / A4-3 的场景 × 想法 × 问法槽位
│   ├── levels-adult-work.js      # 成年「工作间」支线：4 幕 + 每幕 2 组手写变体
│   ├── glossary.js               # 概念层：20 个概念 + 站点/工具/词典/慢变量反链 + 共用边界说明
│   ├── library.js                # 词卡释义/聊卡/微行动/装饰/漂流瓶/静修间
│   ├── meditate.js               # 静修间 2.0：5 族 / 10 条 sit 引导 / 6 场景 / 8 句 if-then（纯数据）
│   ├── dictionary.js             # 心理学词典 162 条 + dictionaryMeta（纯数据，4 组 / 11 主题 / 45 个概念簇 / 4 类型）
│   ├── selfhelp.js               # 自助工具箱：5 状态 / 31 工具卡 / 10 条认知扭曲（纯数据）
│   ├── slowvars.js               # 慢变量：6 变量 + 5 件日常 + 20 练习（v 指向变量 id）+ 3 档时间预算 + 3 尺度 + 12 陷阱（纯数据）
│   └── help.js                   # 急救入口：3 个 1 分钟动作 / 儿童档说明 / 本地求助信息（纯数据）
├── scripts/
│   ├── lint-content.mjs          # 内容自检（用 vm 按加载顺序执行 content/*.js）
│   ├── js-files.mjs              # 逻辑脚本清单（加载顺序的单一来源）
│   ├── check-syntax.mjs          # 逐个 + 拼接解析 js/*.js，抓跨文件重复顶层声明
│   ├── regression.mjs            # 无头 Chrome 浏览器回归（注入测试页，不改源文件）
│   └── serve.mjs                 # 零依赖静态服务，导出 createStaticServer() 供回归复用
├── tests/
│   └── browser-tests.js          # 浏览器回归用例（数量以 npm run doctor 输出为准），由 regression.mjs 注入 390×900 iframe
├── docs/
│   ├── DEVELOPMENT.md            # 开发手册：打开方式 / 加内容 / 发版流程 / 红线速查
│   ├── release-1.0.0.md          # 1.0.0 发布记录：六条门槛证据 + §5.3 清单
│   ├── crisis-review-1.0.0.md    # 危机号码与服务范围复核记录
│   └── archive/                  # 历史审核与验收快照（含 audit-0.19.0.html）
├── package.json                  # check / lint / doctor / serve / test:e2e / verify
├── .gitignore
├── README.md  CHANGELOG.md  ROADMAP.md
```

### 3.1 两种打开方式

- **双击 `index.html`（`file://`）**：内容、玩法、导出、导入、`#/level/x` 直达全部可用；service worker 只在 `http(s)` 下注册，`file://` 下直接跳过，不报错也不白屏。
- **本地静态服务（`npm run serve`，`http://localhost:5173`）**：额外获得「安装到主屏 / 离线打开」。`sw.js` 预缓存全部静态资源，缓存名带 `VERSION`；新版本发布时 `VERSION` 变化会让旧缓存在 `activate` 阶段被清掉，页面导航走网络优先、失败才用缓存，避免旧版卡住不更新。应用本身仍然零远程请求：报文只来自同源的本地文件。

**为什么不用 ES module**：`content/*.js` 与 `js/*.js` 都用经典 `<script>` 顺序加载，是为了让双击 `index.html` 的 `file://` 场景也能跑（ES module 在 `file://` 下会被 CORS 拦住）。`index.html` 里的顺序是契约：

`bands → glossary → levels-kid → levels-kid-island4 → levels-kid-island5 → levels-adult → levels-adult-island5 → bank-kid-1-3 → bank-kid-island4 → bank-kid-island5 → bank-adult-1-3 → bank-adult-island4 → bank-adult-island5 → bank-compose → levels-adult-work → library → meditate → dictionary → selfhelp → slowvars → help → js/core → js/util → js/shell → js/views-main → js/views-dictionary → js/views-selfhelp → js/views-slowvars → js/views-retreat → js/views-level → js/ui → js/actions-level → js/actions-library → js/actions-data → js/boot`

> 这份顺序契约的单一来源是 `scripts/js-files.mjs`（逻辑脚本清单）+ `index.html` + `sw.js` 三处同步，实际顺序**以 `npm run doctor` 的输出为准**；新增内容文件还要同步 `scripts/lint-content.mjs` 的 `FILES`。详见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) §2。

顺序错了或文件缺失，`js/boot.js` 启动时会显示「内容没加载出来」的可读提示，不会白屏。十四块逻辑脚本共用同一个全局词法作用域（`let/const` 跨脚本可见，不挂 `window`），因此**同一顶层名字只能声明一次**；`npm run check` 会把十四块拼起来再解析一次，专门拦跨文件重复声明。

---

## 4. 怎么加内容（速览）

内容改动的字段、加载顺序、改完要跑什么，统一写在 **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**；这里只留一张索引。所有内容都是 `content/*.js` 里的纯数据、经典 `<script>` 顺序加载，新增文件记得同步 `index.html` 的加载顺序与 `scripts/lint-content.mjs` 的 `FILES`（三处同步见手册 §2）。

| 想做什么 | 数据文件 | 手册章节 |
| --- | --- | --- |
| 加一组变体 | `content/bank-*.js` | §3.1 |
| 加一站 / 一座岛 | `content/levels-*.js` + 题库 | §3.2 / §3.3 |
| 加一种题型 | `js/views-level.js` + `js/actions.js` + `style.css` | §3.4 |
| 加 / 改词典词条 | `content/dictionary.js` | §3.5 |
| 加 / 改自助工具卡 | `content/selfhelp.js` | §3.6 |
| 加 / 改慢变量 | `content/slowvars.js` | §3.7 |
| 改急救入口文案 | `content/help.js` | §3.8 |
| 加 / 改冥想练习 | `content/meditate.js` | §3.9 |
| 拼装试点 / 工作间 | `content/bank-compose.js`、`content/levels-adult-work.js` | §3.10 |

**改完必跑 `npm run verify`**（= check + lint + doctor + test:e2e，逐项说明见手册 §4）；内容改完至少 `npm run lint`，加载顺序与版本口径以 `npm run doctor` 的输出为准。发一个版本的完整动作见手册 §5，设计红线见本文 §7 与手册 §6。

---

## 5. 存档与迁移

| 项 | 值 |
| --- | --- |
| 当前键 | `mood-island-v5` |
| 旧键 | `mood-island-v4`（0.10.0 及更早）、`mood-island-v3`（0.7.0 及更早）、`mood-island-v2`（读到后自动迁移；正常升级时**旧键保留**以便回退，「清空本机进度」会连旧键一起删除） |
| schema 版本 | `SCHEMA_VERSION = 5` |
| 字段 | `version, band, cleared, awarded, cards{kid[],adult[]}, skills, shells, decor, seen{关id:[组合键]}, sideCleared[], settings{scale, motion, speak, speakTouched, autoSpeak, contrast}` |
| id 改名 | `ID_REMAP = { '3-5': 'finale' }`，旧终章进度不会丢 |
| 档位改名 | `BAND_REMAP = { 'a9': 'a6' }`，6-9 与 9-12 合并后旧档 / 旧导出 JSON 里的 `a9` 落到 `a6`；其余字段一字不动，`SCALE_VALUES` 显式保留老档可能设过的 `1.06` |

`load()` → `readRaw()`（v5 优先，v5 损坏或不存在时依次回退 v4 / v3 / v2）→ `migrate()`。**以后加任何字段，都在 `migrate()` 里补一段白名单式默认值**，不要直接改 `DEFAULT_STATE` 就完事，否则老用户进度可能被静默重置。`migrate()` 还会逐项清掉无效数据：未知关卡 id、重复的 `cleared / awarded`、内容里已不存在的词卡与本领、越界或重复的 `decor` 下标、负数或小数的 `shells`、不在允许档位里的 `settings.scale`、不存在的拼装组合键、越界的支线 id；其余字段不受影响，所以旧档和现有 v5 档都不会被整体重置。

**v4 → v5 只加两个字段**：`seen`（拼装题已出现过的组合键，按关分桶，每关最多 8 条，超出丢最旧）与 `sideCleared`（成年「工作间」支线完成记录，白名单只认 `W-1…W-4`）。主线 `cleared / awarded / cards / skills / shells / decor` 的迁移路径一字未改；`sideCleared` 不计入 21 站、不加贝壳 / 词卡 / 本领，也不参与终章解锁。`seen` 不是可见进度，界面上不显示任何组合计数；`restart-all` 不清它，「清空本机进度」才删。

**v3 → v4 只改词卡语义**：旧档的 `cards` 是不分轨的数组，`migrateCards()` 按以下顺序推断归属——① 只在一轨出现的卡，直接归该轨；② 两轨同名的卡，对应关卡有通关 / 领贝壳记录就归该轨，两轨都有记录则两边都算真拿到；③ 对不上记录时，只玩过一轨就归那一轨；④ 两轨都玩过但仍无法判定，归**儿童档**（宁可少给成年档，也不把儿童卡虚增成成年卡）。`cleared / awarded` 不受影响。

**`skills` 暂不按轨拆分**：两轨现在没有同名本领，所以共用一份数组不会串档；回归会断言两轨本领名不重复。以后若要复用同一个本领名，必须先把 `skills` 拆成按轨结构并补迁移，否则会在另一轨提前点亮。词卡已经按轨拆分（`cards: { kid, adult }`），不受这个约束影响。

**回退**：正常升级时旧键从不被新代码覆盖，旧版本代码仍读 v4；升级后产生的新进度只写 v5，回退到旧代码会看不到升级后的新进度，但不会破坏旧档，也不会把词卡串档。用户点「清空本机进度」是明确的删除动作，会移除 v5 / v4 / v3 / v2，之后不能再靠旧键找回。

**不会保存**：开场选的天气、任何心情文本（应用不提供心情输入框；词典搜索框只做本地过滤）、心理学词典的主题 / 类型 / 搜索词（每次重新打开都会清空）、自助工具箱选中的状态与分类、慢变量选中的变量与分类（每次重新打开都会清空）、五件套点过哪一件（页面不记录，也不累计天数）、冥想练习的当前场景 / 剂量 / 带回句（只在本次打开期间）、练习次数、静修间做过几次。隐私 / 无痕模式下若 `localStorage` 不可写，页面会常驻一条说明、设置页同步提示，不会谎报「已保存」。

**已决取舍**：v0.6.0 之前成年档与儿童档共用 `1-1…3-4` 这些 id；双轨拆分后这些 id 归儿童轨，成年轨会显示为「未走过」。两套题本来就不同，**目前处于开放阶段，明确不做进度映射，也不再排期**。

### 5.1 导出 / 导入

设置页「备份与迁移」可以导出一个 JSON。载荷固定为：

```js
{
  app: 'mood-island',
  exportVersion: 1,          // 导出格式号，只在载荷形状变化时 +1，与 package 版本、SCHEMA_VERSION 无关
  exportedAt: '2026-11-07T…Z',
  state: { /* 上表的全部存档字段 */ }
}
```

文件名是 `mood-island-progress-YYYYMMDD-HHmm.json`（本机本地时间，分钟粒度）。导入按外部输入处理：依次检查 JSON 语法、`app` 标识、`exportVersion`（比当前新就拒绝并提示先更新游戏）、`state` 是否存在、`state.version` 是否超前、是否含有可识别进度；任何一项不过都给出具体原因，当前档不动。通过后先弹「导入前先看一眼」，把文件与当前设备的年龄段、两轨站数、词卡、本领、贝壳并排显示，用户确认才覆盖；覆盖前会走 `migrate()`，所以旧结构（如 v3 的不分轨词卡）也能导入。覆盖前的那一份只留在内存里，本次打开期间可撤销一次，不新增任何持久键。

### 5.2 直达链接

地址形如 `#/map`、`#/level/4-2`、`#/work`、`#/level/W-1`、`#/help`、`#/dict`、`#/selfhelp`、`#/slowvars`、`#/retreat`、`#/home`、`#/gate`，刷新、收藏、分享都不会丢站。`http(s)` 下每次换屏用 `history.pushState` 入栈，`boot.js` 的 `popstate` 把浏览器后退 / Android 物理返回键 / iOS 侧滑映射回上一屏（弹窗打开时先收掉遮罩）；首次写入与坏地址纠正仍用 `replaceState`，不凭空多一条历史。`file://` 下 `pushState` 常被拒，保持原来的 `replaceState` + `location.hash` 回落，双击打开的行为一字不变。页内目录锚点（`#dict-group-x`、`#sv-practices` 等）在点击委托里被拦下，只滚动本页分区，不进 hash 路由。只认当前轨的关卡 id：未知地址、另一条轨的站、尚未解锁的站都回落地图（无档时回选档页），并把地址改回合法值，不留在坏链接上。`#/work` 与 `#/level/W-x` 只在成年轨可用；儿童 / 亲子轨视作不可达，未解锁的幕次回落到工作间时间线。

---

## 6. 命令

| 命令 | 作用 |
| --- | --- |
| `npm run check` | `node scripts/check-syntax.mjs`：逐个 + 拼接解析 `js/*.js`，顺带拦跨文件重复顶层声明 |
| `npm run lint` | 内容自检，不引依赖、不启浏览器 |
| `npm run doctor` | `node scripts/check-consistency.mjs`：跨文档与加载顺序一致性自检，以它的输出为准 |
| `npm run serve [端口]` | 本地静态服务，默认 5173；传参写 `npm run serve -- 8080` |
| `npm run test:e2e` | 无头 Chrome 回归（浏览器用例 + 源码检查，数量以 `npm run doctor` 输出为准；跑在真 390×900 iframe 里），约 1.5 秒 |
| `npm run verify` | check + lint + doctor + test:e2e，**每次提交前至少跑这个** |

`test:e2e` 需要本机 Chrome / Chromium（找不到时设 `CHROME_PATH`）；命令细节与排错见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) §4。

---

## 7. 设计红线（改动前先读）

1. **不打分、不排名、不比速度**：没有分数、正确率、倒计时、失败惩罚、红叉、连签、排行榜。答错给中性提示，连续两次未命中自动给 `hint`。
2. **不采集心情文本**：没有心情自由输入框，天气选择不落盘，不记练习次数。漂流瓶选哪一项都给同一句回应，没有对错。心理学词典的搜索框只在当前页面内过滤词条，不保存、不上传，也不接收心情文本；主题与类型筛选同样只在内存里，每次重新打开都会清空。自助工具箱与慢变量只提供阅读与选择，不收集自由文本，选中的状态、变量和分类只留在内存里，慢变量每次重新打开都会清空；慢变量的「日常五件套」不记次数、不记连续天数，也不保存你点开过哪一张卡。
3. **不联网**：没有 fetch/XHR、没有第三方脚本、字体、图标或 CDN；朗读调用设备自带语音能力。PWA 的 service worker 只缓存同源静态文件，不发起任何远程请求，也不上报任何数据。
4. **不宣称疗效**：不是心理测评、不是诊断、不能代替专业帮助；页脚与静修间双重免责，呼吸/正念练习可睁眼、随时停止。「睡不着」组不承诺助眠，只说「不把睡着当任务」。
5. **不制造回来的压力**：不打卡、不连续登录奖励、进度不会掉；静修间按场景与练习族排列，不是打卡系统，也不记录次数 / 连续天数 / 时长；练习可随时停，停了不算失败。
6. **正确答案不能恒在第一项**：`clue / reframe / defuse / compose` 渲染前洗牌，判对错读 `data-orig` 的原始下标。

新增内容若碰到这些边界，先改设计再写代码。`lint-content.mjs` 会扫红线词，但最终仍需要人工判断语境。

---

## 8. 键盘与无障碍

- 选项左侧徽标是 **1 / 2 / 3…**，直接对应数字键。`1`–`9` 覆盖所有使用 `.opt` 的选择题（线索单选、换视角 `reframe`、终章金句、静修「第一反应」）以及漂流瓶弹窗里的选项；梯子的档位号也能按。天气、配对、滑杆、排序、拼句、记忆牌没有数字键，仍用 Tab / 点击。线索卡的「线索 N」编号与答案序号冲突，**数字键一律选答案**，翻线索卡用 Tab + Enter。
- `Esc` 关弹窗 / 回地图，`←` `→` 在已解锁的站之间切换（仅关卡视图）。地址栏的 `#/…` 只是当前屏的同步结果，不参与 Esc / 返回的判断。
- 心理学词典的卡片用原生 `details / summary`：Tab 可聚焦，Enter / 空格展开；搜索框可输入，分类按钮、类型按钮与「接着看」都是普通按钮，类型按钮带 `aria-pressed`，`Esc` 回地图。词典另有 3 项大组页内目录锚点，点关联词条跳转后焦点落到目标卡片的 `summary`；分区标题是 `<h3>`，筛空时随卡片一起隐藏。自助工具箱与慢变量同样用 `details / summary`，状态、变量与分类都是普通按钮，`Esc` 回地图。慢变量另有 4 项页内目录锚点；变量 / 状态面板带局部 `aria-live="polite"`，只切分类时不会重复播报说明。
- 静修间的场景按钮带 `aria-pressed`，步骤点只是装饰、不进朗读；练习页每次只显示一步，不用整页 `aria-live` 播报，避免打断用户自己的节奏。
- 弹窗的 `role="dialog"` 用 `aria-labelledby` 指向实际标题元素（没有标题才退回 `aria-label="对话框"`）；焦点进入弹窗、关闭后归还，Tab 焦点陷阱；`#overlay` 本身不再挂 `aria-live`，避免整个弹窗被重复播报。反馈区与记忆牌进度、贝壳数仍用局部 `aria-live="polite"`。
- 进度格只给当前这一站标 `aria-current="step"`；记忆牌按「未翻开 / 已翻开 / 已配对」给出 `aria-label`；词典、自助、慢变量的英文词条都标 `lang="en"`，避免中文语音引擎误读。
- 隐私写入失败提示带 `role="status"`。
- 字号三档、减少动画开关、高对比模式；`3-6 岁` 档自动放大按钮与点击目标。
- 进度格视觉是 9px 细条，但按钮盒撑到 30px（3-6 档 40px），保证触摸目标。
- **急救入口在所有屏都够得到**：顶栏吸顶常驻；弹窗遮罩会盖住顶栏，所以每个弹窗内另有一个「先缓一缓」直达出口。整屏重建统一回到页面顶部，但从急救返回已通关的关卡时保留结果卡位置。
- **结果卡按当前题的深度分级**：3-6 档、以及 6-12 岁档的基础层默认只见一句话、收集与下一步，机制 / 规格 / 生活迁移折进「给大人看」；切到「多想一步」或亲子 / 成年档保持完整六行。首站天气主按钮默认可用，不选也能一次点走。词典「按概念读」的 16 张卡默认收起，不再挤掉首屏。
- 跟随系统 `prefers-color-scheme` 切换深浅色，只换一层 CSS 变量，不新增设置项、不写存档、不联网；高对比模式优先级更高，两套覆盖不叠加。

---

## 9. 当前状态

原「已知问题」8 项已在 v0.7.0 / v0.8.0 收口，逐条处理结果见下表。各版本的技术细节与取舍一律放 [CHANGELOG.md](CHANGELOG.md)，本页不复述版本史。

| # | 原问题 | 处理结果 |
| --- | --- | --- |
| 1 | 隐私模式 `localStorage` 写入失败被静默吞掉 | `save()` 失败置 `storageWritable = false`，插入常驻 `.storage-warning`，设置页同步说明；回归有专项用例 |
| 2 | `js/core.js` 头注释写 v5、`package.json` 写 0.6.0 | 当时统一到 **0.7.0**；0.8.0 起改为源码级校验：`js/core.js` 头注释、README / CHANGELOG / ROADMAP 的当前版本都必须与 `package.json` 完全一致 |
| 3 | `index.html` 静态占位写死「已探索 0 / 13 关」 | 改为中性的「已走过 0 站」，运行时由 `updateTopbar()` 覆盖 |
| 4 | `isUnlocked()` 注释说「走完上一座岛」，实现只检查收尾站 | **保持行为**（岛内自由是刻意设计），注释与地图按钮文案改齐为「先把上一座岛走到头」 |
| 5 | 成年档 v0.6.0 之前的进度不迁移 | **已决不处理**：开放阶段不做映射，也不再排期（见 §5） |
| 6 | 静修仅 3 个练习、漂流瓶 8 题一次性 | 静修扩到 **10 个**并按 4 个当下状态分组；漂流瓶扩到 **16 题**、换题不重复；顺手修掉 `paintSpace` / `ground-pick` 两处写死的练习索引 |
| 7 | 回归测试脚手架散落在 `/tmp` | 固化为 `scripts/regression.mjs` + `tests/browser-tests.js`，`npm run verify` 一条命令跑完 |
| 8 | git 仓库无首次提交、全部 untracked | 已补 `.gitignore` 与基线提交 |

**P2 评估后不做（不是遗漏）**：

| 事项 | 结论 | 原因 |
| --- | --- | --- |
| 词典 `data-search` 改索引 | 不做 | 162 条时全量字符串索引不到 100KB，过滤只读 `dataset.search`，实机无感；等条目超过 500 再换成 Map 索引 |
| 合并 `levels-kid*.js` / `bank-kid*.js` | 不做 | 会同时改动 `index.html` 加载顺序、`lint-content.mjs` 的 `FILES`、`regression.mjs` 的顺序断言、岛 4 的 `splice` 插入逻辑与题库 `Object.assign`，收益只是少 2 个文件 |
| 拆分 `script.js` 为 state / views / actions | 0.12.0 已交付 | 0.11.1 审查确认触发 §1.1 的行数条件（2914 行 > 2500）后，0.12.0 按 9 个连续切片搬进 `js/`：`core → util → shell → views-main → views-library → views-level → ui → actions → boot`。仍是经典脚本顺序加载、共用全局词法作用域，测试与主脚本的隐式依赖原样保留；加载顺序、重复声明、`sw.js` 预缓存清单都由结构断言锁住 |

**已交付 / 未排期**：0.9.0–0.19.0 各版本的交付要点（急救入口、PWA 与导出导入、变体拼装与工作间、`script.js` 拆九块、内容审核与概念层、静修间 2.0、年龄档 5→4、词典证据校准、慢变量两层化、工程收口等）与逐条技术细节一律见 [CHANGELOG.md](CHANGELOG.md)，本页不复述版本史；未排期的取舍与后续计划见 [ROADMAP.md](ROADMAP.md)。

### 9.1 1.0.0 已知边界（是取舍，不是缺陷）

| 边界 | 现状 | 为什么这样定 |
| --- | --- | --- |
| 内容仍可扩但有边界 | 每轨 5 岛 21 站、词典 162 条、儿童变体 111 组 + 成年 41 组 | 岛 5 已于 1.1.0 补齐（羞耻内疚 / 比较嫉妒 / 孤独归属 / 身体照料与求助）；单轨 5 轮重复率仍低，后续不再盲目加岛 |
| 儿童档超龄术语与丧失意象 | 已在 1.1.0 改写完成 | 只改措辞、不加内容；要被否定的坏想法选项与给大人看的 adult 字段按设计保留 |
| 无账号、无云同步、无打卡提醒 | 不做，也不排期 | 与「不联网 / 不采集 / 不制造压力」三条红线冲突；换设备用导出 JSON |
| 朗读依赖系统语音 | 用 Web Speech API，无自建音频 | 零依赖与离线优先；不同设备音色不同，长文已做单段合并与保活 |
| 仅简体中文 | 无多语言 | 文案以中文语感为准，翻译需重新审读语气，不属工程任务 |
| 旧进度只在同一浏览器保留 | 清缓存 / 换浏览器需先导出 | 不联网的产品约束；导出 / 导入已做全字段闭环 |

---

## 10. 相关文档

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — 开发手册：两种打开方式、加内容、改完必跑、发版流程、设计红线速查、加载顺序契约
- [CHANGELOG.md](CHANGELOG.md) — 逐版本变更与迁移记录（六段式）
- [ROADMAP.md](ROADMAP.md) — 1.0.0 之后的迭代计划、版本与归档规范、发布清单、1.1.0 规划
- [docs/archive/content-review-0.13.0.md](docs/archive/content-review-0.13.0.md) — 内容审核记录（0.13.0 → 0.17.0）历史归档（非当前事实）
- [docs/archive/acceptance-1.0.0-review.md](docs/archive/acceptance-1.0.0-review.md) — 1.0.0 门槛盘点与 2026-11-08 验收记录（历史快照）
- [docs/release-1.0.0.md](docs/release-1.0.0.md) — 1.0.0 发布记录：六条门槛的逐条证据、§5.3 发布清单、验收环境与已知不做
- [docs/crisis-review-1.0.0.md](docs/crisis-review-1.0.0.md) — 危机求助号码与服务范围的复核记录（条件 4）
- [docs/archive/audit-0.19.0.html](docs/archive/audit-0.19.0.html) — 2026-11-20 全维度代码审查报告（13 条发现与修复状态）
