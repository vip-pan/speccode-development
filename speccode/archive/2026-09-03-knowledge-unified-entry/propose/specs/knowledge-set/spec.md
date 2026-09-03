# knowledge-set Delta

## MODIFIED Requirements

### Requirement: 知识维护分支与直通 PR

distilling-knowledge 与 recording-knowledge MUST 运行于 state 登记的 `chore/knowledge-*` 开发分支的 worktree 中(与其他开发分支同一入口与收尾,无特权形态)。MUST NOT 在其他任何分支(含 trunk、`feature/`/`bugfix/`/`refactor/` 分支、不匹配 `chore/knowledge-` 的 `chore/` 分支)的 worktree 或主工作区执行知识写入,违反时 MUST 提示并退出。

在 trunk 上运行时,命令 MUST 先经 state 查询识别未完成(status ∈ {pending, in_progress, pr_open})的 `chore/knowledge-*` 分支:恰有候选时 MUST 经 AskUserQuestion 询问「续跑(cd 到该分支 worktree)/ 新建」;无候选时 MUST 经 AskUserQuestion 确认 slug(默认:distilling 用 `knowledge-distill`,recording 用 `knowledge-<内容主题>`,无主题用 `knowledge-record`),随后引导执行 `/speccode:creating-worktree` 以 type=`chore` 创建 worktree 分支并登记 state,再继续本命令。「未完成」判定 MUST 基于 state 查询,MUST NOT 依赖 git merge 判定(如 `git branch --no-merged`——在 squash-only 合并下对已合并分支永真)。

落盘 commit 后 MUST 经 `/speccode:finishing-worktree` 收尾(测试门禁、PR 路由、squash-only 探测、切回 merge_target),MUST NOT 内置独立的 PR 创建/查重/等待逻辑。PR 等待策略由 finishing-worktree 既有菜单决定,命令 SHOULD 建议知识维护选「PR 不等待」。

维护摘要(topic 变化/新增/无变化 + PR url)MUST 在收尾输出 PR url(或 `pr_tool=none` 等效命令)之后追加到 trunk 级 `.speccode/memory/_knowledge.md`(见 session-memory「memory 文件位置与命名」),内容 MUST 含 PR url(或等效命令),MUST NOT 写 feature 级 memory。

#### Scenario: trunk 首次运行引导建分支

- WHEN 用户在 trunk 运行 distilling-knowledge,且 state 中无未完成 chore/knowledge-* 分支
- THEN 命令经 AskUserQuestion 确认 slug(默认 knowledge-distill),引导执行 creating-worktree 以 type=chore 创建 worktree 分支并登记 state,随后在新 worktree 中继续蒸馏

#### Scenario: 续跑未完成分支

- WHEN state 中存在 status 为 pending/in_progress/pr_open 的 chore/knowledge-* 分支
- THEN AskUserQuestion 询问续跑(cd 到该分支 worktree)或新建;判定基于 state 查询而非 git merge 判定

#### Scenario: squash 合并后不再误报未完成

- WHEN 某历史 chore/knowledge-* 分支已经 finishing-worktree 收尾且 state 已推进/删除,但 git branch --no-merged 因 squash 合并仍列出该分支
- THEN 命令 MUST NOT 将其视为未完成分支(state 是唯一判定来源),不发起续跑询问

#### Scenario: 在其他分支运行被拒

- WHEN HEAD 为 feature/bugfix/refactor 分支、不匹配 chore/knowledge- 的 chore/ 分支,或其 worktree
- THEN 提示回 trunk(由 trunk 引导建分支)或回自己的 chore/knowledge-* worktree,退出且不执行任何写入

#### Scenario: 收尾统一走 finishing-worktree

- WHEN 蒸馏/记录落盘 commit 完成
- THEN 命令引导执行 finishing-worktree 完成测试门禁、PR 创建与 merge_target 切回,不运行命令内置 PR 逻辑

#### Scenario: pr_tool=none

- WHEN config.pr_tool 为 none
- THEN finishing-worktree 既有降级路径打印等效命令,维护摘要(含等效命令与分支名)仍追加到 _knowledge memory

#### Scenario: 维护摘要写 _knowledge memory

- WHEN 收尾完成并获得 PR url(或等效命令)后
- THEN 含 PR url 的维护摘要追加到 .speccode/memory/_knowledge.md,不写 feature memory
