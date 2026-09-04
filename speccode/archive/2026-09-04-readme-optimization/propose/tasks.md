# Tasks: readme-optimization

> 本清单已由 plan/2026-09-04-readme-optimization-plan.md 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。

实现域:`README.md` / `README_CN.md` / `plugins/speccode/README.md` / `plugins/speccode/README_CN.md`(全部在仓库根视角);规格合并留给 syncing。每条任务完成即核对 + 簿记 commit(EN/CN 同改的条目一次提交,防半双语状态)。

## 根 README(EN/CN 锁步,每条含两版)

- T1 hero 重排:一句话定位标语替换 90 词长段(2-3 句短段承接原意);badges 之后新增 `## Install` 节(marketplace add + plugin install 两步命令,自 Quickstart 移除安装步骤);intro 与正文的「24 /speccode:* commands」「24 个 /speccode:* 命令」计数去字面量。验证:两版前 10 行含语言切换 + badges + Install;`grep -n '24' README.md README_CN.md` 仅剩 badges URL 等非计数命中。
- T2 Why 段修正:第 1 条「three-layer trunk / feature / worktree topology」→ 双层拓扑表述(trunk ↔ 开发分支直达,集成 opt-in);第 3 条「24 commands + hooks (14 lifecycle events)」计数去字面量;两版同步。验证:`grep -in 'three-layer\|三层拓扑' README.md README_CN.md` 零命中(「代码三层分工」类非拓扑命中除外)。
- T3 新增 `## The Basic Workflow` 段(Why 之后):编号 7 步(exploring → creating-worktree → proposing → applying 或 writing-plans+SDD → requesting-code-review → syncing/archiving → finishing-worktree),每步命令名 + 一句话;两版同步。验证:两版段名与步数一致。
- T4 「看它干活」demo 改普通需求路径:`init → creating-worktree → proposing → applying` + `requesting-code-review` + `finishing-worktree(PR → trunk)`,删除 `creating-feature`/`finishing-feature` 与「merged back into feature」文案;两版同步。验证:`grep -n 'creating-feature\|finishing-feature\|merged back into feature' README.md README_CN.md` 在 demo 段零命中。
- T5 Prerequisites 增补:新增一行「Windows 不支持(macOS / Linux only)」;Quickstart 第 3 步改为「`/speccode:creating-worktree` 建首个开发分支」(删除 creating-feature 教程位);两版同步。验证:两版均含 Windows 行;Quickstart 无 creating-feature。
- T6 拓扑节双层化:标题「Three-Layer Branch Topology / 三层分支拓扑」→「Two-Layer Branch Topology / 双层分支拓扑」;ASCII 图重绘(trunk ↔ `<type>/<slug>` 开发分支即 worktree,大需求 opt-in 集成分支注记);两版同步。验证:标题与图无 feature 层挂 worktree 的 v2 形态。
- T7 对比矩阵加 BMAD 列(按 design.md D5 保守标注)并把第 1 行「Three-layer branch topology + reconciliation」改为双层表述;两版同步。验证:两版列头一致含 BMAD;行 1 无「three-layer」。
- T8 文档地图与贡献段修正:文档地图中插件 README 描述「three-layer topology / 三层拓扑」→「双层拓扑」、`(11 capabilities)` 计数去字面量;贡献段流程链改「exploring → creating-worktree → … → finishing-worktree」并标注大需求 opt-in;两版同步。验证:`grep -n '11 capabilit\|11 个 capability' README.md README_CN.md` 零命中。
- T9 新增 `## ⚠ Before You Run git clean / 执行 git clean 前必读` 安全警告节(文档地图之后):3-4 行风险说明 + `git clean -n` dry-run 建议 + 指向对应语言插件 README §14 链接;两版同步。验证:两版节名与链接互相对应(EN→README.md §14、CN→README_CN.md §14)。

## 插件 README(EN/CN 锁步)

- T10 §2 标题与正文去数:「24-Command Quick Reference / 24 个命令快速参考表」→「Command Quick Reference / 命令快速参考表」;§2 引言行(如有计数)同步;知识两命令(distilling-knowledge / recording-knowledge)行内文案瘦身(保留触发分支与闸门语义,删过程细节)。§14 详文原样保留。验证:两版节号 §1-14 不变;`grep -n '24 个\|24-Command\|24 commands' plugins/speccode/README.md plugins/speccode/README_CN.md` 零命中。

## 全局验证(不改内容,只核对)

- T11 双语对齐核对:根两版段一一对应、插件两版 §1-14 对应;互链矩阵 4 组链接(根 EN↔CN、插件 EN↔CN、根→插件同语言、插件→根同语言)逐组点检;新增安全警告节的两版链接目标存在。验证:逐链接 `test -e` 或锚点核对通过。
- T12 计数与 v2 措辞终扫:全量 grep 四文件——「three-layer / 三层拓扑 / 24 个命令 / 24 commands / 24-Command / 11 capabilit / merged back into feature」零命中(badges URL、CHANGELOG 历史链接等非门面计数命中逐条豁免并记录);基线测试 `node --test ./plugins/speccode/tests/*.test.mjs` 全绿。验证:终扫输出留痕于任务完成备注。
