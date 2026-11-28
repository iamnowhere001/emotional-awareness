# GLOSSARY · 开发术语

**本文件不被任何脚本校验**——没有 lint，也没有 doctor 规则。写错了没人拦，所以「出处」列是唯一权威，本表只是索引。

这张表只收**反复出现、且已经漂移过**的词。产品内容里那些心理概念**不在这里**——那是 `content/glossary.js`（L0 概念层，给终端用户看的数据，由 `npm run lint` 校验）。两者同名是历史包袱，不要合并、不要互相引用。

## 0. 读这张表之前的四条规矩

1. **不要往表里抄数字。** 所有数量都由 `npm run doctor` 钉在 `README.md` 与若干源码头注释上。本表再抄一份，就是多一个会漂的地方。唯一保留的算式是「N 关 + 终章 = N+1 站」，因为那是「站」与「关」的唯一区别，删了两词就没定义。
2. **这里的措辞被正则钉死，不能当同义词换。** `scripts/check-consistency.mjs` 用 `/(\d+) 关 \+ 终章/`、`/不计入 (\d+) 站/`、`/(\d+) 个概念/` 一类正则把**具体措辞**匹配到实测值。换写法必须与正则同批改。
3. **`docNum` 现在默认 fail-closed。** 一处也匹配不上即 FAIL，除非该项登记进脚本里的 `DOCNUM_OPTIONAL`。所以「删内容 / 拆文件 / 改措辞」不再能悄悄减掉校验——但改完仍要逐行看 `npm run doctor` 的细节文本，不能只看 PASS 总数（PASS 数与校验覆盖面不是一回事）。
4. **历史快照不修。** `docs/archive/` 与 `docs/review-*.html` 里的数字是当时的记录，**不要回头去改它们**，那不是漂移，是史实。

## A. 空间结构

| 术语 | 定义 | 别叫（会错） | 出处 |
|---|---|---|---|
| ★ 岛 | 一轨的章节单元；普通站解锁**只认上一岛的收尾站**，不是上一岛全部走完；终章另需前面全部 cleared | 章节、章 | `js/shell.js` `isUnlocked()` |
| ★ 站 | 主线可玩单元 = 本轨全部关 + 1 个终章；数量见 `README.md` | 关 —— 但 `关卡表 / 关卡视图 / 关卡工具栏 / 关卡 id` 等**复合词保留，不做逐字替换** | `js/core.js` `LEVELS` |
| ★ 关 | 站里除终章外的那些；「N 关 + 终章 = N+1 站」是唯一换算 | 关卡、把「关」当全部 | 同上 |
| ★ 工作间 / 幕 | 成年轨支线，幕 id `W-1…W-4`；不计入站数、不发贝壳 / 词卡 / 本领、不参与终章解锁 | 支线关卡、第五章 | `js/core.js`（`WORK_IDS`）/ `js/shell.js` |
| ★ 轨 | `kid` / `adult` 两条互不干扰的进度线；**只有 `cleared` 与 `cards` 真按轨隔离** | 模式、模式轨 | `content/bands.js` 的 `track`；`js/core.js` `bandTrack()` |

## B. 档与内容单位

| 术语 | 定义 | 别叫（会错） | 出处 |
|---|---|---|---|
| ★ 档 | 用户选的年龄段：`kid` 轨 `a3 / a6 / all`，`adult` 轨 `adult` | **档位**（那是滑杆 / 梯子的格子，`js/views-level.js`） | `content/bands.js`；`js/core.js` `band()` |
| ★ 深度层 | `a6` 档内的 `tier: 1` 基础 / `tier: 2` 多想一步；**只对 a6 生效**（`a3` / `all` 不分层，写了 `tier` 也是惰性的），只存 `session.depth`、不落盘 | 难度、级别 | `js/util.js` `pickVariant` |

## C. 概念层与知识库

| 术语 | 定义 | 别叫（会错） | 出处 |
|---|---|---|---|
| ★ 概念 | L0 概念层的锚点，站点 / 工具卡 / 词典 / 慢变量共用同一 `id` | **概念类型**（旧名，已废弃）、概念簇（词典的分组）、词条（词典正文） | `content/glossary.js`；`js/core.js` |
| ★ 词条 / 词条类型 | 词典条目；类型是 `k` 字段的 `core / frontier / method / myth` | **概念类型**（旧名；曾长期残留在 lint 报错文案与一个测试名里） | `content/dictionary.js` 的 `dictionaryMeta.kinds` |

## D. 存档（这一组写错就丢用户进度）

| 术语 | 定义 | 别叫（会错） | 出处 |
|---|---|---|---|
| ★ 存档 / 旧键 | 当前键 `mood-island-v5`，`SCHEMA_VERSION = 5`；旧键迁移后**保留**以便回退 | 数据库、配置、缓存 | `js/core.js` 头部 |
| ★ cleared / awarded | `cleared` ＝走过；`awarded` ＝已发过贝壳。**「从头再来」只清 `cleared`**，所以重来一遍贝壳不重发 | 「进度」（两者混称） | `js/core.js`；`js/actions-data.js` |
| ★ cards / skills / shells | `cards` 按轨隔离；`skills` 与 `shells` **不**按轨，靠「两轨没有同名本领」的约定撑着（回归有断言） | 「进度全部按轨隔离」 | `js/core.js` `cardsInTrack()` |
| ★ seen | 拼装题已出现过的组合键，按关分桶、每关有上限；界面不显示，`restart-all` 不清 | 进度、打卡记录 | `js/core.js` `migrateSeen` |
| ★ sideCleared | 工作间完成记录，白名单只认 `W-1…W-4` | cleared | `js/core.js` |

## E. 内容体系

| 术语 | 定义 | 别叫（会错） | 出处 |
|---|---|---|---|
| ★ 静修间 | **一个视图**，坑里挂着两套数据：`MI.library.RETREAT`（旧）与 `MI.meditate.practices`（族 × 剂量，新） | 静修练习、情境练习、冥想练习、五类练习、引导练习（全是别名） | `content/library.js` / `content/meditate.js` |

## F. 工程

| 术语 | 定义 | 别叫（会错） | 出处 |
|---|---|---|---|
| ★ 零构建 / 经典脚本 | 无打包器、无 npm 依赖、无 TS、非 ES module；`<script defer>` 顺序加载，逻辑块共用同一个全局词法作用域 | 「没构建所以随便写」（正相反：顶层名字只能声明一次） | `index.html`；`docs/adr/0002` |
| ★ 四处同步 | 新增逻辑文件同步 3 处、内容文件同步 4 处 | 「只改 index.html 就行」 | `AGENTS.md` 同步清单 |

## G. 其他常见词（还没疤，只留索引）

| 术语 | 一句话 | 出处 |
|---|---|---|
| 终章 | `type: 'finale'` 且 `island: 0`，必须排在 `levels` 数组最后（位置被 lint 硬锁，猜错当场报错） | `content/levels-kid.js` |
| 变体 / 组 | 变体＝题库里一个题目对象；「一组」＝同一关一个键下的一簇 | `content/bank-*.js`；`js/util.js` `pickVariant` |
| 题型 | `type` 字段的取值，每个对应一个 `RENDERERS` 渲染器 | `js/views-level.js` |
| 拼装关 | 用 `scene:thought:ask` 组合键现拼出 `reframe` 的那几关（儿童 `4-3` / 成年 `A4-3`） | `js/util.js` `pickComposed` |
| 词卡 | 图鉴里的卡，按轨记录 `state.cards = { kid, adult }`；两轨同名卡独立解锁 | `content/library.js` 的 `CODEX` |
| 工具卡 / 练习卡 | 工具卡＝自助工具箱的卡；练习卡＝慢变量的 `practices` | `content/selfhelp.js` / `content/slowvars.js` |
| 坏档留底 | 四个键都解析失败时，把原始字符串 + 原键名 + 时间戳另存 | `js/core.js` |
| 慢变量 / 日常五件套 | 慢变量＝方向层；五件套＝今天做多少，各带最小剂量 / 再降一级 / 断了怎么接回 | `content/slowvars.js` |
| if-then | 静修 `intents` 里的「如果…就…」句 | `content/meditate.js` |
| 一致自检 / doctor | `npm run doctor`，文档与代码的一致性守卫 | `scripts/check-consistency.mjs` |

**分级标准**：★ = 混淆已在仓库里实际发生过，或不写就会导致一次可命名的具体错误操作。G 组是「还没疤但值得先画线」，只留索引不展开。被 lint / doctor 硬锁住的词可以降级——猜错会当场报错，反而最安全。

---

## 与 `content/glossary.js` 的界限

| | `GLOSSARY.md`（本文件） | `content/glossary.js` |
|---|---|---|
| 读者 | 代理与开发者 | 游戏运行时 / 终端用户 |
| 内容 | 开发术语（站、轨、tier、schema…） | 心理概念（觉察、身体信号…） |
| 加载 | 不加载 | `index.html` 加载，挂 `window.MI` |
| 改错的后果 | 文档漂移，无人拦 | `npm run lint` / `doctor` 报错 |
| 引用方向 | **不引用**那些概念 | 被站点 / 工具卡 / 词典 / 慢变量反链 |

一句话：**`content/glossary.js` 是产品数据，`GLOSSARY.md` 是开发者的词典。同名是历史包袱，不要合并。**
