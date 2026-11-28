# 分诊标签 · mood-island

五个标签，贴合仓库真实状态流（候选池 → 排期 → 批次 → verify → 一笔提交）。

| 标签 | 什么时候打 | 必跑 | 出口 |
| --- | --- | --- | --- |
| `red-line-conflict` | 需求与六条红线冲突 | 不跑，先判 | 写进 `ROADMAP.md` §2「不排的东西」或 §6，终止 |
| `content` | 只动 `content/*.js` | `npm run lint` + `doctor` | 一发版号一批 |
| `structure` | 动 `js/` 拆分或任何文件清单 | `npm run verify` | 纯搬运提交，行为一字不改 |
| `schema` | 动存档字段 / 关卡 id / 档位 id | `verify` + 旧档 JSON 实测 `migrate()` | 必须 bump `SCHEMA_VERSION` + 补迁移分支 |
| `docs-drift` | 只改文档里的数字或术语 | `npm run doctor` | 单独提交，不与行为改动混 |

## 规则

- 前四个选一作**主标签**；`red-line-conflict` 可叠加，但**一旦打上就终止**。
- `structure` 与 `schema` **不得同批**（否则出问题无法二分）。

## `docs-drift` 的额外纪律（重要）

**这个仓库里没有「只是改个措辞」的操作。** `scripts/check-consistency.mjs` 的 `docNum()` 用正则把「一段具体措辞 + 一个数字」钉到实测值；把「N 关 + 终章」换成别的写法，那条断言就失去了靶子。

- 改完必须**逐行看 `npm run doctor` 的细节文本**：出现「未命中」或「未写死」就是覆盖被减掉的信号。
- 只看 PASS 总数**没用**——`docNum` 已改成 fail-closed，但 `SCALE_EXEMPT` 里的显式豁免仍然记 PASS，这是设计如此。
- 动 `SCALE_EXEMPT` 或 `DOCNUM_OPTIONAL` 是**判断性决定**，不是格式调整：要么补回数字，要么在提交信息里写清豁免理由。
