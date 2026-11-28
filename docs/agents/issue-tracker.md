# Issue tracker · mood-island

这个仓库**没有** issue tracker，也不建议引入（GitHub Issues 会让「文件状态」与「一笔提交一版」脱钩）。

## 工作单元 = 一个发版号

一个发版号 = 一笔 `release:` 提交 + 一个注释 tag + `CHANGELOG.md` 一个 `## [X.Y.Z]` 条目。三者一一对应（ROADMAP §1 第 6 条「一个版本一个快照」）。

## 三个动作

| 动作 | 落在哪 |
| --- | --- |
| **开一个「issue」** | 在 `ROADMAP.md` §2 候选池加一行：事项 / 价值 / 成本 S-M-L / 依赖 / 目标版本。成本 ≤ S 的直接做，不进表 |
| **关一个「issue」** | 在 CHANGELOG 那一版的「取舍」段写明「这次故意没做什么、为什么」。取舍段是唯一承载「否决理由」的地方 |
| **查状态** | `git log --oneline`｜`git tag -l`｜`git show v1.1.0` |

## 禁止

- 新建 `TODO.md`（会与 ROADMAP 形成双源）。
- 在 commit message 里写长讨论（讨论属于 CHANGELOG 的「取舍」段）。
- 给单个事项开分支长期挂着（本仓库是单线 trunk，靠 revert 而不是靠分支回滚）。

## 交接时看什么

只有两样：`ROADMAP.md` §2 的未完成行 + `git status`。
