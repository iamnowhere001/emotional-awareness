# 心情闯关岛

> 一起认出心里的天气。按年龄分级的情绪启蒙小游戏：**纯前端 · 零依赖 · 不联网 · 不打分 · 不采集心情文本**。
>
> 当前版本 **1.2.1**（2026-11-26：1.2.0 审查后的收口修复——通关完成态、终章落进度、路由播报与标题、首次选档文案）。逐版本事实见 [CHANGELOG.md](CHANGELOG.md)，后续安排见 [ROADMAP.md](ROADMAP.md)，1.0.0 发布证据见 [docs/release-1.0.0.md](docs/release-1.0.0.md)。

这不是心理测评，也不能代替专业帮助。它只做一件事：把模糊的感觉看得更清楚一点，再带走一个用得上的小工具。

---

## 0. 文档地图

| 你要做什么 | 先读 |
| --- | --- |
| 用 AI 代理改这个仓库 | [AGENTS.md](AGENTS.md)：硬约束、必跑命令、同步清单 |
| 改代码 / 加内容 / 排错 | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)：操作步骤与命令细节 |
| 查术语到底指什么 | [GLOSSARY.md](GLOSSARY.md)：开发术语索引；不抄数量 |
| 查现状、数据契约与红线 | 本文件 §2、§4、§6 |
| 查某个决定为什么这样定 | [docs/adr/](docs/adr/)；动加载方式读 0002，动存档读 0004 |
| 查未来计划与明确不做的事 | [ROADMAP.md](ROADMAP.md) §1、§2 |
| 查已发生的事实 | [CHANGELOG.md](CHANGELOG.md)；发版证据见 `docs/release-*.md` |
| 查代理的工作边界与分诊 | [docs/agents/](docs/agents/) |

`docs/archive/`、`docs/*.html` 是历史快照，不是当前规格；不要回头修数字。

---

## 1. 快速开始

| 方式 | 操作 | 说明 |
| --- | --- | --- |
| 直接打开 | 双击 `index.html` | `file://` 下完整可玩，已实测；日常使用与 `file://` 冒烟用这条 |
| 本地服务 | `npm run serve` → `http://localhost:5173` | 手机同网段预览；Service Worker 与「安装到主屏」需要 http(s)。`npm run serve -- 8080` 可换端口 |

应用本身不需要 Node、不需要构建、不需要安装依赖。Node.js 18+ 只用于内容自检、本地静态服务和浏览器回归。首次进入先选年龄段，之后可在设置里更换；换档保留进度、词卡和本领，不覆盖用户手动调过的字号与朗读偏好。

---

## 2. 现状与内容契约

### 2.1 规模

| 项目 | 数量 |
| --- | --- |
| 年龄档 | **4 档**：`a3` 3-6 岁 / `a6` 6-12 岁（合并档，带基础 / 多想一步两层）/ `all` 亲子全年龄 / `adult` 成年。旧档 `a9` 由 `BAND_REMAP` 落到 `a6`，存档不丢 |
| 关卡轨 | 2 条：儿童与亲子共用 `kid`；成年独立 `adult` |
| 岛屿 | 每轨 5 座（儿童：察觉湾 / 调节林 / 联结港 / 安放角 / 回望角；成年：觉察滩 / 调节林 / 联结港 / 安放角 / 回望角） |
| 站点 | 每轨 **21 站 = 20 关 + 终章**（5 岛）|
| 玩法 | 13 种互动题型 + 终章，共 14 个 `type`；静修间另有 `sit` 引导 |
| 题库变体 | 儿童 **106 组**，成年 **42 组**，合计 148 组；每档每关至少 2 组。儿童池按 `tier: 1 / 2` 分两层，6-12 岁合并档每关可抽 **3～5 组**。`4-3` / `A4-3` 两关不写题库，由 `content/bank-compose.js` 按「场景 × 想法 × 问法」现拼，不计入这些数字 |
| 内容库 | 概念层 20 条（站点 / 工具卡 / 词典 / 慢变量共用同一概念 id）· 词卡释义 35 条（按 20 个概念成组，其中多组是两轨双名）· 聊卡 10 · 微行动 8 · 装饰 6 · 漂流瓶 16 · 静修练习 10 · 冥想练习 10（5 族 × 2 档 / 6 场景 / 8 句 if-then）· 心理学词典 162 条（4 大组 / 11 主题 / 45 个概念簇 / 4 类词条，每条带关联词条）· 自助工具 31 张 + 认知扭曲 10 条速查 · 慢变量 6 个（方向层）+ 日常五件套 5 件 + 练习 20 张 + 时间预算 3 档 + 尺度 3 个 + 陷阱 12 个 · 急救入口 3 个短动作 + 4 条本地求助信息 |

这些数字由 `npm run doctor` 对照内容实测；改内容后以 doctor 输出为准，不要只改文档。

### 2.2 轨道、分支与内容模块

- `kid` 轨（`a3` / `a6` / `all`）与 `adult` 轨的关卡表、题库、进度、词卡各自独立。关卡 id 前缀分别是 `1-1…5-4 / finale` 与 `A1-1…A5-4 / A-finale`；成年档不显示也不发放贝壳。`a6` 的 `tier` 深度只存 `session.depth`，不落盘，且只对 `a6` 生效。
- `cards` 按轨记录（`state.cards = { kid, adult }`），两轨同名卡独立解锁；图鉴在渲染层按 20 个概念合并成组并标出另一种叫法，存档键值与 schema 不变。`skills` / `shells` 目前共用，靠「两轨没有同名本领」的约定成立。
- 支线：成年「工作间」4 幕（`W-1…W-4`）不计入主线站点，不加贝壳 / 词卡 / 本领，也不参与终章解锁。

| 模块 | 入口与边界 |
| --- | --- |
| 急救入口 | 底栏常驻「很难受 / 有点难受」，任何一屏 1 次点击进入；3 个短动作（约 1 分钟 / 20 秒 / 30 秒）。成人 / 亲子档附本地求助信息，儿童档只引导「找一个大人」。选择不记录、不落盘 |
| 词卡图鉴 / 本领清单 | 收录主线解锁结果；词卡按轨，本领当前共用一份数组 |
| 漂流瓶 | 16 题，可换一题且不连续重复；选哪项都给同一句回应 |
| 静修间 | 成年档支线；新练习按步引导、可选呼吸圆、不显示剩余秒数，不记录次数 / 天数 / 时长；旧 10 条按四组折叠保留 |
| 心理学词典 | 162 条，4 大组 / 11 主题 / 45 概念簇 / 4 类型；支持「主题 × 词条类型 × 搜索」三维筛选与关联词条跳转。筛选只存内存，重开清空，不计进度、不落盘 |
| 自助工具箱 | 5 种当下状态 + 31 张工具卡 + 10 条认知扭曲速查；选择式与阅读式，不收自由文本、不记录选择 |
| 慢变量 | 6 个长期方向 + 5 件日常五件套 + 20 张练习卡 + 3 档时间预算 / 3 个时间尺度 / 12 个快变量陷阱；只读、不打卡、不记天数 |
| 显示与数据设置 | 字号三档、减少动画、高对比、朗读偏好、导出 / 导入、清空进度 |

### 2.3 题型与字段

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
| `ladder` | 火气 / 强度分档，选哪档都算完成并给一个动作 | `scenario, question, rungs` |
| `finale` | 终章（儿童版布置小岛；成年版四段收束） | — |

### 2.4 文件结构与加载顺序

```text
index.html          运行时脚本顺序；35 个脚本 = content 21 + js 14
style.css           主题、字号、动效、高对比、3-6 档大按钮
content/*.js        纯数据，挂 window.MI；顺序敏感
js/*.js             经典脚本，共用同一个全局词法作用域；boot.js 最后加载
scripts/            零依赖自检、静态服务与构建脚本
tests/browser-tests.js  浏览器回归用例
docs/               开发手册、ADR、代理工作约定与历史记录
dist/               构建产物，不手改
```

权威分工：`index.html` 是运行时顺序；`scripts/js-files.mjs` 是逻辑脚本清单；`scripts/lint-content.mjs` 的 `FILES` 是内容脚本清单；`sw.js` 的 `ASSETS` 必须与三者对齐。新增文件与改名的同步清单见 [AGENTS.md](AGENTS.md) 与 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) §2。

不用 ES module 是为了让 `file://` 双击可用（见 ADR 0002）。以下是当前写死的顺序契约，`npm run doctor` 会逐项比对：

`bands → glossary → levels-kid → levels-kid-island4 → levels-kid-island5 → levels-adult → levels-adult-island5 → bank-kid-1-3 → bank-kid-island4 → bank-kid-island5 → bank-adult-1-3 → bank-adult-island4 → bank-adult-island5 → bank-compose → levels-adult-work → library → meditate → dictionary → selfhelp → slowvars → help → js/core → js/util → js/shell → js/views-main → js/views-dictionary → js/views-selfhelp → js/views-slowvars → js/views-retreat → js/views-level → js/ui → js/actions-level → js/actions-library → js/actions-data → js/boot`

顺序错了或文件缺失，`js/boot.js` 会显示「内容没加载出来」的可读提示，不会白屏。十四块逻辑脚本共用同一全局词法作用域，同一顶层名字只能声明一次；`npm run check` 会拼接解析来拦重复声明。

---

## 3. 怎么改

完整步骤见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) §3，按章节只读你要改的那一节。

| 想做什么 | 主要文件 | 手册章节 |
| --- | --- | --- |
| 加一组变体 | `content/bank-*.js` | §3.1 |
| 加一站 / 一座岛 | `content/levels-*.js` + 题库 | §3.2 / §3.3 |
| 加一种题型 | `js/views-level.js`、`js/actions-level.js`、`style.css`、`scripts/lint-content.mjs` | §3.4 |
| 加 / 改词典词条 | `content/dictionary.js` | §3.5 |
| 加 / 改自助工具卡 | `content/selfhelp.js` | §3.6 |
| 加 / 改慢变量 | `content/slowvars.js` | §3.7 |
| 改急救入口文案 | `content/help.js` | §3.8 |
| 加 / 改冥想练习 | `content/meditate.js` | §3.9 |
| 拼装试点 / 工作间 | `content/bank-compose.js`、`content/levels-adult-work.js` | §3.10 |

改完至少跑 `npm run lint`；涉及脚本清单、文档或交互时跑 `npm run verify`。发版动作见手册 §5。

---

## 4. 存档与迁移

| 项 | 值 |
| --- | --- |
| 当前键 | `mood-island-v5` |
| 旧键 | `mood-island-v4`（0.10.0 及更早）、`mood-island-v3`（0.7.0 及更早）、`mood-island-v2`；正常升级时旧键保留以便回退，「清空本机进度」会一起删除 |
| 坏档留底 | `mood-island-v5-corrupt`：四个键都解析不出来时留原始字符串、原键名与时间戳，首屏提示一次；留底后删坏键，避免重复报错 |
| schema | `SCHEMA_VERSION = 5`；发版号与存档号是两套编号 |
| 字段 | `version, band, cleared, awarded, cards{kid[],adult[]}, skills, shells, decor, seen{关id:[组合键]}, sideCleared[], settings{scale, motion, speak, speakTouched, autoSpeak, contrast}` |
| id 改名 | `ID_REMAP = { '3-5': 'finale' }`，旧终章进度不丢 |
| 档位改名 | `BAND_REMAP = { 'a9': 'a6' }`；`SCALE_VALUES` 保留老档可能设过的 `1.06` |

`load()` → `readRaw()`（v5 优先，依次回退 v4 / v3 / v2）→ `migrate()`。新增落盘字段必须在 `migrate()` 补白名单式默认值，并更新 `SCHEMA_VERSION` 与旧档实测；只改 `DEFAULT_STATE` 会静默重置老进度。理由和边界见 ADR 0004。

迁移要点：

- `migrate()` 会清掉无效关卡 id、重复的 `cleared / awarded`、已不存在的词卡 / 本领、越界或重复的 `decor`、负数或小数的 `shells`、非法 `settings.scale`、不存在的拼装组合键与越界支线 id；其余字段不动。
- v4 → v5 只加 `seen`（每关最多 8 条，超出丢最旧）与 `sideCleared`（只认 `W-1…W-4`）。主线字段迁移路径不变；`sideCleared` 不计入站点、不加奖励、不参与终章解锁。
- v3 → v4 只改词卡归属：先按只出现在一轨的卡归类；同名卡按通关 / 贝壳记录判轨；仍无法判定时，只玩过一轨就归该轨，两轨都玩过则归儿童档。`cleared / awarded` 不受影响。
- 正常升级不覆盖旧键；回退到旧代码看不到升级后的新进度，但不破坏旧档。「清空本机进度」会删除 v5 / v4 / v3 / v2 与坏档留底，之后不可找回。

不落盘：天气选择、任何心情文本（应用没有输入框）、词典主题 / 类型 / 搜索词、工具箱状态与分类、慢变量选择、五件套点过哪一张、静修次数、冥想场景 / 剂量 / 带回句。词典搜索只做本地过滤；隐私 / 无痕模式下 `localStorage` 不可写时常驻提示，不谎报「已保存」。

**已决不处理**：0.6.0 之前成年档与儿童档共用 `1-1…3-4` id，双轨拆分后这些 id 归儿童轨；不做进度映射，也不再排期。

### 4.1 导出 / 导入

设置页「备份与迁移」导出 JSON：

```js
{
  app: 'mood-island',
  exportVersion: 1,          // 导出格式号，与 package 版本、SCHEMA_VERSION 无关
  exportedAt: '2026-11-07T…Z',
  state: { /* 上表的全部存档字段 */ }
}
```

文件名 `mood-island-progress-YYYYMMDD-HHmm.json`。导入按外部输入处理：JSON 语法、`app`、`exportVersion`、`state`、`state.version`、可识别进度逐项检查；通过后先并排预览，用户确认才覆盖，覆盖前走 `migrate()`。被覆盖的那份只在内存里保留一次撤销机会，不新增持久键。

### 4.2 直达链接

`#/map`、`#/level/4-2`、`#/work`、`#/level/W-1`、`#/help`、`#/dict`、`#/selfhelp`、`#/slowvars`、`#/retreat`、`#/home`、`#/gate` 均刷新 / 收藏 / 分享不丢站。`http(s)` 用 `pushState` 入栈并映射浏览器与系统返回；`file://` 回落到 `replaceState + location.hash`。只认当前轨且已解锁的关卡 id，坏地址回落地图并改回合法值；`#/work` 与 `#/level/W-x` 仅成年轨可达。

---

## 5. 命令与上线

| 命令 | 作用 |
| --- | --- |
| `npm run check` | 逐个 + 拼接解析 `js/*.js`，拦跨文件重复顶层声明 |
| `npm run lint` | 内容自检：关卡、题库、题型、词典、工具箱、慢变量、静修、急救与红线词 |
| `npm run size` | 首屏体积预算：raw / gzip / brotli 各比一次 |
| `npm run doctor` | 文档与代码一致性自检；跨文档数字、版本六处、脚本清单都以它为准 |
| `npm run serve [端口]` | 本地静态服务，默认 5173；`npm run serve -- 8080` 换端口 |
| `npm run build` | 产出 `dist/`，只去注释与缩进，不改标识符或换行 |
| `npm run test:e2e` | 无头 Chrome 回归，跑在 390×900 iframe；需要 Chrome / Chromium，找不到时设 `CHROME_PATH` |
| `npm run test:e2e:dist` | 对 `dist/` 跑同一套用例，证明压缩后行为不变 |
| `npm run verify` | check + lint + size + doctor + test:e2e；提交前至少跑一次 |

逐项说明与排错见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) §4。上线时用同源静态托管并开启 Brotli 或 gzip；`dist/` 可再省约 10%。预算写在 `scripts/check-size.mjs`，要放宽必须在 CHANGELOG 写理由。

---

## 6. 设计红线

1. **不打分、不排名、不比速度**：没有分数、正确率、倒计时、失败惩罚、红叉、连签、排行榜。答错给中性提示，连续两次未命中自动给 `hint`。
2. **不采集心情文本**：没有心情自由输入框；天气选择、词典筛选、工具箱与慢变量的选择只留内存，重开清空；不记练习次数与连续天数。
3. **不联网**：没有 fetch / XHR、第三方脚本、字体、图标或 CDN；朗读调用设备自带语音能力。Service Worker 只缓存同源静态文件，不上传数据。
4. **不宣称疗效**：不是测评、不是诊断、不能代替专业帮助；页脚与静修间双重免责，呼吸 / 正念练习可睁眼、随时停止。「睡不着」组不承诺助眠。
5. **不制造回来的压力**：不打卡、不连续登录奖励、进度不会掉；练习可随时停，停了不算失败。
6. **正确答案不能恒在第一项**：`clue / reframe / defuse / compose` 渲染前洗牌，判对错读 `data-orig` 的原始下标。

碰到这些边界先改设计，不要改红线。`lint-content.mjs` 会扫红线词，最终仍需人工判断语境。

---

## 7. 键盘与无障碍

- 带数字徽标的选项可按 `1`–`9`；`Esc` 关弹窗 / 回地图，`←` `→` 在已解锁站点间切换。线索卡编号与答案序号冲突时，数字键一律选答案，翻卡用 Tab + Enter。
- 词典、工具箱、慢变量用原生 `details / summary`；筛选按钮带 `aria-pressed`，目录锚点与关联词条跳转会处理焦点。静修间每次只显示一步，不用整页 `aria-live` 打断节奏。
- 弹窗有标题关联、焦点进入与归还、Tab 焦点陷阱；反馈区与记忆牌进度用局部 `aria-live="polite"`，隐私写入失败用 `role="status"`。
- 字号三档、减少动画、高对比、跟随系统深浅色；`3-6` 档自动放大按钮与点击目标。触控目标基线 44×44，回归用例会在 320px 下扫描可点元素。
- 导航只有顶栏（品牌 + 档位 chip + 贝壳）与底栏（上岛 / 很难受 / 工具 / 我的）；窄屏顶栏固定两行，进度可缩成 `0/21` 但保留完整读屏文本。
- 急救入口底栏吸底常驻，弹窗内另有「先缓一缓」出口。结果卡按深度分级：基础层默认只给一句话、收集与下一步，机制等折进「给大人看」。
- 英文词条标 `lang="en"`，避免中文语音引擎误读；顶栏进度按岛分段并标 `aria-current="step"`。

---

## 8. 当前边界

| 边界 | 现状 | 判断 |
| --- | --- | --- |
| 内容规模 | 每轨 5 岛 21 站、词典 162 条、儿童变体 106 组 + 成年 42 组（另有拼装两关） | 岛 5 已于 1.1.0 补齐；后续不再盲目加岛 |
| 超龄术语与丧失意象 | 1.1.0 已改写 | 只改措辞；坏想法反例与「给大人看」字段按设计保留 |
| 无账号 / 云同步 / 打卡提醒 | 不做，也不排期 | 与「不联网 / 不采集 / 不制造压力」冲突；换设备用导出 JSON |
| 朗读依赖系统语音 | Web Speech API，无自建音频 | 零依赖与离线优先；不同设备音色不同 |
| 仅简体中文 | 不做多语言 | 文案以中文语感为准，翻译需重新审读语气 |
| 进度只在同一浏览器保留 | 清缓存 / 换浏览器需先导出 | 不联网的产品约束；导出 / 导入已覆盖全部字段 |

逐版本的技术取舍见 [CHANGELOG.md](CHANGELOG.md)；仍不排的候选见 [ROADMAP.md](ROADMAP.md) §2。

---

## 9. 相关文档

- 操作：[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)、[docs/agents/](docs/agents/)
- 决策：[docs/adr/](docs/adr/)、[ROADMAP.md](ROADMAP.md)
- 事实：[CHANGELOG.md](CHANGELOG.md)、[docs/release-1.0.0.md](docs/release-1.0.0.md)、[docs/crisis-review-1.0.0.md](docs/crisis-review-1.0.0.md)
- 历史快照（不是当前事实）：[docs/archive/](docs/archive/)
