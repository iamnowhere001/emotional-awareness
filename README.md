# 心情闯关岛

> 一起认出心里的天气。按年龄分级的情绪启蒙小游戏：**纯前端 · 零依赖 · 不联网 · 不打分 · 不采集心情文本**。
>
> 当前版本 **6.1.0**（见 [CHANGELOG.md](CHANGELOG.md)）｜后续安排见 [ROADMAP.md](ROADMAP.md)

这不是心理测评，也不能代替专业帮助。它做的事只有一件：把模糊的感觉看得更清楚一点，再带走一个用得上的小工具。

---

## 1. 快速开始

| 方式 | 操作 | 适用场景 |
| --- | --- | --- |
| 直接打开 | 双击 `index.html` | 日常使用。`file://` 下完整可玩，已实测 |
| 本地服务 | `npm run serve` → `http://localhost:5173` | 手机同网段预览；以后加 service worker 需要 http |

`npm run serve -- 8080`（或 `node scripts/serve.mjs 8080`）可指定端口。**应用本身不需要 Node、不需要构建、不需要安装依赖**；Node.js 18+ 只用于内容自检、本地静态服务和浏览器回归。

首次进入先选年龄段，之后从设置里可随时更换；换档保留进度、词卡和本领，不会覆盖用户手动调过的字号与朗读偏好。

---

## 2. 内容规模（v6.1.0 实测）

| 项目 | 数量 |
| --- | --- |
| 年龄档 | 5 档：`a3` 3-6 岁 / `a6` 6-9 岁 / `a9` 9-12 岁 / `all` 亲子全年龄 / `adult` 成年 |
| 关卡轨 | 2 条：儿童与亲子共用 `kid`；成年独立 `adult` |
| 岛屿 | 每轨 4 座（儿童：察觉湾 / 调节林 / 联结港 / 安放角；成年：觉察滩 / 调节林 / 联结港 / 安放角） |
| 站点 | 每轨 **17 站 = 16 关 + 终章** |
| 玩法 | 13 种互动题型 + 终章，共 14 个 `type` |
| 题库变体 | 儿童 **91 组**，成年 **32 组**，合计 123 组；每档每关至少 2 组 |
| 内容库 | 词卡释义 27 条 · 金句 6 · 聊卡 10 · 微行动 8 · 装饰 6 · 漂流瓶 16 · 静修练习 10 |

两条轨的关卡 `id` 前缀不同（儿童 `1-1…4-4 / finale`，成年 `A1-1…A4-4 / A-finale`），进度天然隔离，`clearedInTrack()` 各算各的；成年档不显示也不发放贝壳。

### 题型与数据字段

| `type` | 做什么 | 变体必填字段 |
| --- | --- | --- |
| `weather` | 随手挑一个今天的天气，不选也能走 | `items` |
| `clue` | 翻线索卡，合起来猜感觉 | `scenario, clues, options, answer, why` |
| `slider` | 拖刻度看感受的分量 | `scenario, question, replies` |
| `match` | 近义感受配对 | `pairs, words` |
| `breath` | 呼气长一点的慢呼吸 | `rounds, note` |
| `reframe` | 换一个更贴近事实的镜头 | `thought, options, answer, why` |
| `chain` | 把感受—想法—行为—需要串起来 | `scenario, tags, cards` |
| `sort` | 把卡片分进几个筐 | `baskets, cards` |
| `perspective` | 同一件事，不同人怎么看 | `scenario, roles` |
| `order` | 给事情排个顺序 | `scenario, steps` |
| `compose` | 拼一句既说出自己、又不指责对方的话 | `scenario, rows` |
| `memory` | 记忆翻牌 | `pairs` |
| `ladder` | 火气/强度分档，选哪档都算完成并给一个动作 | `scenario, question, rungs` |
| `finale` | 终章（儿童版布置小岛；成年版四段收束） | — |

除主线外还有：词卡图鉴、本领清单、漂流瓶（16 题，可换一题且不连续重复）、静修间（成年档支线，10 个练习按「现在很烦 / 现在很累 / 睡不着 / 心里空」四组排列，不计时不打卡）、终章、显示与数据设置。

---

## 3. 项目结构

```
.
├── index.html                    # 容器 + 内容文件加载顺序（顺序敏感）
├── style.css                     # 浅色主题、字号/动效/高对比、3-6 档大按钮
├── script.js                     # 全部逻辑：状态 / 渲染器 / 动作分发 / 事件 / 存档迁移
├── content/                      # 纯数据，零逻辑，挂到 window.MI
│   ├── bands.js                  # 5 个年龄段
│   ├── levels-kid.js             # 儿童/亲子主线（岛 1-3 + 终章）
│   ├── levels-kid-island4.js     # 岛 4 四站，插在终章之前
│   ├── levels-adult.js           # 成年独立关卡表
│   ├── bank-kid-1-3.js           # 儿童题库（岛 1-3）
│   ├── bank-kid-island4.js       # 儿童题库（岛 4）
│   ├── bank-adult-1-3.js         # 成年题库（岛 1-3）
│   ├── bank-adult-island4.js     # 成年题库（岛 4）
│   └── library.js                # 词卡释义/金句/聊卡/微行动/装饰/漂流瓶/静修间
├── scripts/
│   ├── lint-content.mjs          # 内容自检（用 vm 按加载顺序执行 content/*.js）
│   ├── regression.mjs            # 无头 Chrome 浏览器回归（注入测试页，不改源文件）
│   └── serve.mjs                 # 零依赖静态服务，导出 createStaticServer() 供回归复用
├── tests/
│   └── browser-tests.js          # 37 项浏览器用例，由 regression.mjs 注入
├── package.json                  # check / lint / serve / test:e2e / verify
├── .gitignore
├── README.md  CHANGELOG.md  ROADMAP.md
```

**为什么不用 ES module**：`content/*.js` 用经典 `<script>` 顺序加载，是为了让双击 `index.html` 的 `file://` 场景也能跑（ES module 在 `file://` 下会被 CORS 拦住）。`index.html` 里的顺序是契约：

`bands → levels-kid → levels-kid-island4 → levels-adult → bank-kid-1-3 → bank-kid-island4 → bank-adult-1-3 → bank-adult-island4 → library → script.js`

顺序错了或文件缺失，`script.js` 启动时会显示「内容没加载出来」的可读提示，不会白屏。

---

## 4. 怎么加内容

### 4.1 加一组变体（最常见）

在对应的 `bank-*.js` 里往**已有的**该关数组末尾追加一条，并带上档位标记 `b`：

```js
/* 注意是 push，不要用 Object.assign 覆盖整个键——那会把已有变体清掉 */
(MI.bankKid['4-2'] ||= []).push({
  b: ['a6', 'a9', 'all'],
  scenario: '……', question: '现在大概到哪一档？',
  rungs: [{ label: '一档', body: '……', move: '……' }]
});
```

`b` 省略表示该组对所有档可用；`pickVariant()` 按当前档过滤，且避免连续两次抽到同一组。新关卡第一次建键时才用 `Object.assign(MI.bankKid, { 'x-y': [...] })`。

### 4.2 加一站

1. 在 `levels-*.js`（或新建的 `levels-*-islandN.js`）里加一条关卡对象，**必须插在终章之前**；照 `levels-kid-island4.js` 的 IIFE + `splice` 写法最省事；
2. 在对应题库文件里加同名键，每档至少 2 组变体；
3. 如果这一站带新词卡，在 `library.js` 的 `CODEX` 里补释义和例子。

关卡对象字段：`id / island / num / name / type / kind / card / skill / goal / tip / hint / tryIt / adult`。终章固定 `island: 0` 且 `type: 'finale'`，**必须排在数组最后**；位置错了 lint 会直接报错。

### 4.3 加一座岛

照 `levels-kid-island4.js` + `bank-kid-island4.js` 的写法：关卡文件用 IIFE 把新站 `splice` 到终章之前，题库文件用 `Object.assign` 合并；然后在 `MI.kid.islands`（或 `MI.adult.islands`）加一条岛屿描述，最后在 `index.html` 里按依赖顺序插入两行 `<script>`。**别忘了把新文件名加进 `scripts/lint-content.mjs` 顶部的 `FILES` 数组**，否则自检不会读到它。

### 4.4 加一种题型

需要动四处：`script.js` 的 `RENDERERS`（渲染）、`makePlay`（初始化 play 状态）、`ACTIONS`（交互处理）、`style.css`；以及 `lint-content.mjs` 的 `TYPES` / `NEED`。参考 `ladder` 这个题型，它是最小实现。

### 4.5 改完必跑

```bash
npm run verify      # = 语法检查 + 内容自检 + 37 项浏览器回归 + 4 项源码检查
```

内容自检覆盖：两轨关卡结构与岛屿对应、每档每关 ≥2 组、终章位置与唯一性、词卡/本领唯一且 `CODEX` 有释义、题库多余键、各题型内部一致性（`answer` 越界、`chain` 标签对应、`sort` 落筐、`compose` 每行恰 1 个 gentle、记忆牌去重、`ladder` 档位字段）、**静修练习的分组与字段、漂流瓶题量与去重**、文案长度、评分/诊断/疗效类红线词。当前结果：**0 错误，2 条无害提示**（「排名」「治疗」各 1 次，均在免责语境）。

浏览器回归用 `tests/browser-tests.js` 覆盖内容加载、旧档迁移、双轨切换、按岛解锁、洗牌、计时器回收、两套终章、弹窗焦点，以及 v6.1 新增的隐私提示与静修/漂流瓶行为；`npm run test:e2e -- --verbose` 可看逐项结果。

---

## 5. 存档与迁移

| 项 | 值 |
| --- | --- |
| 当前键 | `mood-island-v3` |
| 旧键 | `mood-island-v2`（读到后自动迁移，**旧键保留**以便回退） |
| schema 版本 | `SCHEMA_VERSION = 3` |
| 字段 | `version, band, cleared, awarded, cards, skills, shells, decor, settings{scale, motion, speak, speakTouched, autoSpeak, contrast}` |
| id 改名 | `ID_REMAP = { '3-5': 'finale' }`，旧终章进度不会丢 |

`load()` → `readRaw()`（新键优先、旧键兜底）→ `migrate()`。**以后加任何字段，都在 `migrate()` 里补一段白名单式默认值**，不要直接改 `DEFAULT_STATE` 就完事，否则老用户进度可能被静默重置。

**不会保存**：开场选的天气、任何心情文本（应用也不提供自由文本输入框）、练习次数、静修间做过几次。隐私 / 无痕模式下若 `localStorage` 不可写，页面会常驻一条说明、设置页同步提示，不会谎报「已保存」。

**已决取舍**：v6 之前成年档与儿童档共用 `1-1…3-4` 这些 id；双轨拆分后这些 id 归儿童轨，成年轨会显示为「未走过」。两套题本来就不同，**目前处于开放阶段，明确不做进度映射，也不再排期**。

---

## 6. 命令

| 命令 | 作用 |
| --- | --- |
| `npm run check` | `node --check script.js`，只查逻辑文件语法 |
| `npm run lint` | 内容自检，不引依赖、不启浏览器 |
| `npm run serve [端口]` | 本地静态服务，默认 5173；传参写 `npm run serve -- 8080` |
| `npm run test:e2e` | 无头 Chrome 回归（37 项用例 + 4 项源码检查），约 1.5 秒 |
| `npm run verify` | check + lint + test:e2e，**每次提交前至少跑这个** |

`test:e2e` 需要本机有 Chrome / Chromium；找不到时设置 `CHROME_PATH=/path/to/chrome`。测试页是在内存里注入用例生成的临时 HTML，**不会改动任何源文件**，也不写项目目录。

---

## 7. 设计红线（改动前先读）

1. **不打分、不排名、不比速度**：没有分数、正确率、倒计时、失败惩罚、红叉、连签、排行榜。答错给中性提示，连续两次未命中自动给 `hint`。
2. **不采集心情文本**：没有自由输入框，天气选择不落盘，不记练习次数。漂流瓶选哪一项都给同一句回应，没有对错。
3. **不联网**：没有 fetch/XHR、没有第三方脚本、字体、图标或 CDN；朗读调用设备自带语音能力。
4. **不宣称疗效**：不是心理测评、不是诊断、不能代替专业帮助；页脚与静修间双重免责，呼吸/正念练习可睁眼、随时停止。「睡不着」组不承诺助眠，只说「不把睡着当任务」。
5. **不制造回来的压力**：不打卡、不连续登录奖励、进度不会掉；静修间只是排列成四组，不是筛选器，也不要求先描述感受。
6. **正确答案不能恒在第一项**：`clue / reframe / defuse / compose` 渲染前洗牌，判对错读 `data-orig` 的原始下标。

新增内容若碰到这些边界，先改设计再写代码。`lint-content.mjs` 会扫红线词，但最终仍需要人工判断语境。

---

## 8. 键盘与无障碍

- `1`–`9` 选当前页选项，`Esc` 关弹窗 / 回地图，`←` `→` 在已解锁的站之间切换。
- 弹窗有 `aria-label`、焦点进入与归还、Tab 焦点陷阱；反馈区 `aria-live`；隐私写入失败提示带 `role="status"`。
- 字号三档、减少动画开关、高对比模式；`3-6 岁` 档自动放大按钮与点击目标。
- 进度格视觉是 9px 细条，但按钮盒撑到 30px（3-6 档 40px），保证触摸目标。

---

## 9. 当前状态（原「已知问题」8 项已在 v6.1.0 处理）

| # | 原问题 | 处理结果 |
| --- | --- | --- |
| 1 | 隐私模式 `localStorage` 写入失败被静默吞掉 | `save()` 失败置 `storageWritable = false`，插入常驻 `.storage-warning`，设置页同步说明；回归有专项用例 |
| 2 | `script.js` 头注释写 v5、`package.json` 写 6.0.0 | 统一到 **6.1.0**，并加了一条源码级断言防止再次漂移 |
| 3 | `index.html` 静态占位写死「已探索 0 / 13 关」 | 改为中性的「已走过 0 站」，运行时由 `updateTopbar()` 覆盖 |
| 4 | `isUnlocked()` 注释说「走完上一座岛」，实现只检查收尾站 | **保持行为**（岛内自由是刻意设计），注释与地图按钮文案改齐为「先把上一座岛走到头」 |
| 5 | 成年档 v6 之前的进度不迁移 | **已决不处理**：开放阶段不做映射，也不再排期（见 §5） |
| 6 | 静修仅 3 个练习、漂流瓶 8 题一次性 | 静修扩到 **10 个**并按 4 个当下状态分组；漂流瓶扩到 **16 题**、换题不重复；顺手修掉 `paintSpace` / `ground-pick` 两处写死的练习索引 |
| 7 | 回归测试脚手架散落在 `/tmp` | 固化为 `scripts/regression.mjs` + `tests/browser-tests.js`，`npm run verify` 一条命令跑完 |
| 8 | git 仓库无首次提交、全部 untracked | 已补 `.gitignore` 与基线提交 |

**仍未做的不是缺陷，是排期**：常驻「现在很难受」入口与求助兜底、PWA、导出/导入进度、hash 路由、复玩拼装与岛 5 —— 见 [ROADMAP.md](ROADMAP.md)。

---

## 10. 相关文档

- [CHANGELOG.md](CHANGELOG.md) — 逐版本变更与迁移记录
- [ROADMAP.md](ROADMAP.md) — v6.2 → v7.0 迭代计划、优先级、验收标准与发布清单
