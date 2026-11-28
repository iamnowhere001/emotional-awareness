# 1.0.0 发布记录

> 本次验收按 1.0.0 当时的六条门槛与发布清单执行；当前发版动作见 [docs/DEVELOPMENT.md](DEVELOPMENT.md) §5。本页只记录**这一次发版的事实与证据**，不复述版本史（见 [CHANGELOG.md](../CHANGELOG.md)），也不写未来计划（见 [ROADMAP.md](../ROADMAP.md)）。
> 判定口径：仓库内能自动判定的交给 `npm run verify`；仓库外的事实（真机安装、拨测）在此留痕，带日期与设备。

---

## 0. 结论

六条门槛全部满足，`1.0.0` 于 **2026-11-20** 发布，tag `v1.0.0` 指向发版提交。

## 1. 验收环境

| 项 | 值 |
| --- | --- |
| 设备 / 系统 | MacBook Air（Apple Silicon）· macOS 27.2.1（26B131） |
| 浏览器 | Chrome 157.0.8103.80（headless=new，CDP 1.3 驱动，真实 viewport 模拟） |
| Node | v22.22.2 |
| 本地服务 | `npm run serve`（端口 5173）与验收专用 5198 / 5199 |
| 视口 | 360×900 / 390×900 / 414×900（CDP `Emulation.setDeviceMetricsOverride`，非 iframe 间接测量） |
| 截图目录 | `docs/acceptance-1.0.0/v100-*.png`（17 张，本轮生成） |

## 2. 六条门槛

### 条件 1 · `verify` 全绿 + 真 390px 视口 + lint 0 错误 —— **满足**

```
npm run check     语法检查通过：9 个逻辑脚本，跨文件无重复顶层声明
npm run lint      内容自检通过（0 错误 / 0 条提示）
npm run doctor    22 PASS / 0 FAIL
npm run test:e2e  回归 162 项（注册 162 / 执行 162）+ 源码检查 78 项：240 PASS / 0 FAIL
```

回归仍跑在固定 390×900 的 iframe 里（`scripts/regression.mjs`），另在本次验收用 CDP 真视口复核了 360 / 390 / 414 三档。

### 条件 2 · 三种入口各走通一条主线 —— **满足**

| 入口 | 主线（选档 a6 → 首页开始 → 1-1 天气 → 完成 → 回地图） | 结果 | 截图 |
| --- | --- | --- | --- |
| `file://` 双击 | `file:///…/index.html` | 13/13 检查通过：`cleared ['1-1']`、`cards ['觉察']`、`shells 2`、`#/map`；且**未注入 CSP**（本地协议红线成立） | `v100-file-walk.png` |
| http 本地服务 | `http://127.0.0.1:5198/index.html` | 13/13 通过，同上；**CSP meta 已注入** | `v100-http-walk.png` |
| PWA（SW 控制态） | 同上，`navigator.serviceWorker.controller` 为 `sw.js` | 16/16 通过：`ready` 已激活、缓存名 `mood-island-1.0.0`、预缓存 **32** 条、主线同上 | `v100-pwa-controlled.png` |

**PWA 主屏实际安装**：2026-11-20 由谢衣在本机 Chrome（157.0.8103.80 / macOS 27.2.1）完成。入口为 `http://localhost:5173/index.html`，SW 接管后从浏览器安装入口装到主屏；安装后能从启动台 / 聚焦以独立窗口打开，可继续玩。至此三种入口（`file://` / http / PWA 主屏）各有一次实测记录。

可安装性证据（自动取得，2026-11-20）：

| 检查 | 结果 |
| --- | --- |
| `Page.getAppManifest` | `http://127.0.0.1:5199/manifest.webmanifest`，`errors: []` |
| `Page.getInstallabilityErrors` | `installabilityErrors: []` |
| manifest 语义 | `display: standalone`、`start_url: ./index.html`、图标 3 个（含 maskable） |
| Service Worker | `ready` 已激活，scope `http://127.0.0.1:5199/` |

**断网重载**：停掉 5198 服务后再导航同一地址，页面仍渲染（`#stage` 2363 字符、`controller` 为真、标题正确），截图 `v100-pwa-offline.png`。

### 条件 3 · 旧档迁移与导出闭环 —— **满足**

由 `npm run test:e2e` 覆盖，逐条可重跑：

- `mood-island-v2 / v3 / v4` 三份旧档各走一次 `migrate()`，进度与词卡不丢（`scripts/regression.mjs` 的迁移夹具 + `tests/browser-tests.js` 的旧档断言）。
- 「导出 → 清空 → 导入」端到端：同一份 `exportPayload()` 走完一圈后逐字段（`version / band / cleared / awarded / cards / skills / shells / decor / seen / sideCleared / settings`）与整份 JSON 比对，并断言写回 `STORAGE_KEY`。
- `SCHEMA_VERSION` 仍为 5，`mood-island-v5` 键未动；本轮新增断言「`levelIndex` 不落盘、不进导出」。

### 条件 4 · 危机文案真人复核 —— **满足**

记录见 [crisis-review-1.0.0.md](crisis-review-1.0.0.md)：号码归属与服务范围核到 2026-11-20 的官方来源（12356 为国家卫健委设立的全国统一心理援助热线，多地 7×24；12355 为共青团青少年服务台，各地时段不一），文案补了设立主体但**不承诺全国 7×24**；儿童档仍只引导「找一个大人」，不含号码。复核人谢衣，2026-11-20。

### 条件 5 · 无 P0 / 无悬置项 / 文档与提交一致 —— **满足（按修订口径）**

- 2026-11-20 全维度审查 13 条发现：必须修复 3 条、建议优化 6 条、可选增强 3 条已全部落地；剩下 1 条（危机文案真人复核）转条件 4 的人工记录，不属工程遗留。审查报告归档 `docs/archive/audit-0.19.0.html`。
- 三份文档职责清晰：README = 现状与契约，CHANGELOG = 已发生的事实，ROADMAP = 未来计划；版本六处由 `npm run doctor` 锁定。
- 「一一对应」按当时的发版口径：历史例外 0.12.0（双提交）与 0.15.0 / 0.16.0（合并提交）已记录，不改写历史；1.0.0 为一笔发版提交。

### 条件 6 · §5.3 全项 + CHANGELOG + tag —— **满足**

见 §3 清单与 §5 tag。

## 3. §5.3 发布清单

| # | 项目 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1 | `npm run verify` | ✅ | check / lint 0 错误 0 提示 / doctor 22 PASS / e2e 240 PASS 0 FAIL |
| 2 | 360 / 390 / 414 无横向溢出 + 关键页截图 | ✅ | 12 组（3 档 × 地图 / 词典 / 关卡 / 结果）全部 `scrollWidth === innerWidth`；另加首页一张，共 17 张截图 |
| 3 | `file://` 双击冒烟 | ✅ | 见条件 2 表：13/13 通过 |
| 4 | 旧档 JSON 走 `migrate()` | ✅ | 见条件 3；`SCHEMA_VERSION` 仍 5，无字段变更 |
| 5 | 红线复核 | ✅ | `js/` + `content/` 全量扫描：`fetch(` 0、`XMLHttpRequest` 0、`WebSocket/EventSource/sendBeacon` 0、`http(s)://` 0；`index.html` 静态 `<input>/<textarea>` 0（词典搜索框运行时生成，仅本地过滤）；「排行榜 / 得分 / 正确率 / 打卡 / 连续登录 / 疗效」16 处命中**全部为否定语境**（如「不打卡」「没有每日签到」「值得分开放」） |
| 6 | CHANGELOG + 版本六处 + doctor | ✅ | 六处均为 1.0.0；CHANGELOG 六段齐全（含取舍）；doctor 22/22 |
| 7 | `sw.js` 字节变化、缓存名刷新、断网可进 | ✅ | `VERSION` → 1.0.0，缓存名 `mood-island-1.0.0`；`activate` 清旧缓存；停服重载通过（条件 2） |
| 8 | 恶意 JSON | ✅ | 导入走白名单 `migrate()` 与字段校验，非法 JSON 只报错不入库；用例覆盖坏档与坏编码 |
| 9 | git commit + tag 一一对应 | ✅ | 单笔发版提交 + 注释 tag `v1.0.0`（见 §5） |

## 4. 截图清单（本轮，`docs/acceptance-1.0.0/`）

| 文件 | 内容 |
| --- | --- |
| `v100-file-walk.png` / `v100-http-walk.png` | 两种入口走完主线后回到地图（390×900） |
| `v100-390-home.png` | 首页（390） |
| `v100-{360,390,414}-map.png` | 地图：无横向溢出，入口卡单列 |
| `v100-{360,390,414}-dict.png` | 词典：162 张卡，分区标题与目录正常 |
| `v100-{360,390,414}-level.png` | 首站天气关 |
| `v100-{360,390,414}-result.png` | 通关结果卡 |
| `v100-pwa-controlled.png` | SW 控制态下的地图 |
| `v100-pwa-offline.png` | 停服后重载：首页仍可用，进度（贝壳 2 / 1-17）保留 |

## 5. 发版提交与 tag

| 项 | 值 |
| --- | --- |
| 提交 | 见 `git log --oneline -1`（`release: 1.0.0 …`） |
| tag | `v1.0.0`（注释 tag，指向上述提交） |
| 核对方式 | `git tag -l`、`git show --stat v1.0.0`、`npm run doctor`（版本六处） |

## 6. 已知不做 / 已知边界（随版本发布）

- **岛 5** 与**儿童档超龄术语 / 丧失意象改写**：押后 1.1.0（内容轮，需单独审读）。
- **结构拆分**：`js/views-library.js`（788 行）、`js/actions.js`（749 行）已触 700 行条件，排在 1.1.0 的第一顺位，正式版前不动。
- **云同步 / 账号 / 打卡 / 提醒 / 多语言**：不做，也不排期（红线或收益不足）。
- **危机号码**：文案只承诺「号码 + 多地 7×24 + 以当地公布为准」，不承诺全国全天候；发布当日拨测一次 12356（人工），号码若调整只改 `content/help.js` 并追加复核记录。
