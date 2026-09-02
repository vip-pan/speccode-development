# Proposal: knowledge-unified-entry

## Why

distilling-knowledge / recording-knowledge 仍跑在 0.2.5 遗留的特权维护机制上(trunk 裸 bootstrap `chore/knowledge-*` 分支:无 state、无 worktree、内置独立 bootstrap/续跑/查重/直通 PR),与 v3「普通需求直接 worktree 统一入口」宗旨冲突;且该机制自带三缺陷:squash-only 合并下 `git branch --no-merged` 对已合并分支永真(时间炸弹)、裸 checkout 切走主工作区、跑完不回 trunk;两条命令的机制段 ~80% 逐字重复。

## What Changes

- **入口统一**:两命令改为运行于 state 登记的 `chore/knowledge-*` 开发分支 worktree 中;trunk 上运行时引导复用 `/speccode:creating-worktree`(type=`chore`,slug=`knowledge-<topic>`)建 worktree + 登记 state;既有未完成的 knowledge 分支经 state 查询识别并支持续跑。
- **收尾统一**:落盘 commit 后复用 `/speccode:finishing-worktree` 收尾(测试门禁 + PR 路由 + squash-only 探测 + 切回 merge_target),删除命令内置的独立直通 PR / PR 查重 / 不回 trunk 逻辑。
- **续跑判定改 state 查询**:分支是否「未完成」由 state(status ∈ pending/in_progress/pr_open)决定,MUST NOT 依赖 git merge 判定(在 squash-only 下失效)。
- **删除特权条款**:「MUST NOT 创建 state / 不开 worktree / 不跑 reconcile / 不阻塞等待合并 / 不调 finishing-worktree」全部随机制翻转移除。
- **spec**:knowledge-set「知识维护分支与直通 PR」requirement MODIFIED(含 scenario 全量重写,顺带修正残留的 `worktree-` 前缀 v2 表述)。
- **文档**:README×2(中英)命令表中两命令的运行位置描述;CHANGELOG 发版时同步。

## Capabilities

- knowledge-set(修改)

## Impact

- **代码**:`plugins/speccode/commands/distilling-knowledge.md`、`recording-knowledge.md` 重写(纯 prose;lib 预期零改动,复用现有 verb 与 creating-worktree/finishing-worktree 既有流程)。
- **测试**:基线保持(266 用例绿;无 lib 行为变化,无新增测试)。
- **文档**:README ×2、CHANGELOG(发版时)。
- **行为**:用户可见流程变化——知识维护从「trunk 一键 + 不阻塞 PR」变为「标准 worktree 分支 + finishing-worktree 收尾」;`_knowledge` trunk 级 memory 摘要机制保留。
