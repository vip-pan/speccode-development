---
description: "完成开发分支并按 merge_target 路由合并(集成分支本地 squash / trunk 走 PR,测试门禁;支持 --resume)"
---

完成一个开发分支并按 `merge_target` 路由合并。全程中文交互。支持 `--resume`。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. HEAD 必须在功能分支(`<type>/<slug>`、非 trunk);否则退出。
3. `speccode reconcile --cwd . --advance-pr`;conflicts 非空 → 报告退出(v3 恒空,出现即异常);找到本分支 state,读取 `merge_target`(缺省语义 = trunk)。
4. 读记忆 `read-memory --branch <F>`。
5. `--resume`:state 的 `pending_operation.command="finishing-worktree"` 时按 phase 续跑。

- **变更文档存在性检查(Tier 0 防线)**:检查 `speccode/changes/<slug>/` 是否存在(本分支的变更文档);缺失 → 警告「本分支疑似未走文档链(vibe coding),成果将无法回溯」并向用户提问(给出选项)询问是否继续,用户确认才继续,警告不硬阻断。

## 全量测试门禁

按标记文件探测测试命令(既有探测表);均无 → 询问用户或明确跳过。worktree 内全量运行,失败 → 展示摘要并停止,不呈现合并选项。

## 未归档变更检查(warn-only)

`speccode/changes/<slug>/` 存在 → 警告「建议先 syncing + archiving」,不阻断。

## 路由(按 merge_target)

### merge_target 为集成分支(大需求子分支)——本地 squash 自动路径

1. 确认主仓 checkout 在 `merge_target`(`git -C <主仓根> rev-parse --abbrev-ref HEAD`);不是 → `git -C <主仓根> checkout <merge_target>`。
2. `git -C <主仓根> merge --squash <branch>`;commit(遵守规范)。
3. **复测**:在主仓的集成分支上复跑全量测试;失败 → 停止,保留现场,提示调查。
4. 子分支 state 置 `completed` + `completed_at`(经 write-state 读后整写;**父实体 MUST NOT 被写**——children 仅身份,状态派生)。
5. 收尾:主仓切到集成分支并 `fetch & pull`(失败仅警告)。
6. 「清理」(来源限定:路径在 worktree_dir 下 ∪ state 登记;先离开被清理目录;询问是否删远端;prune)。

### merge_target 缺省(trunk)——菜单恰好三项

1. 同步 base:`git push origin <config.trunk>`;non-fast-forward → 中止提示处理分叉。
2. 建 PR 前探测:运行 `speccode repo-merge-config --cwd .`;`squashOnly:false` → 打印警告「建议在仓库设置启用 squash-only 合并」+ 指路,不阻断;`config:null` → 静默(无法探测)。
3. `git push -u origin <branch>`;pr_tool 建 PR(base=trunk);`pr_tool=none` → 打印等效命令并中止。
4. onPrOpened 钩子(payload 带 pr_number)。
5. **PR+等待**:每 30s `query-pr`,超时 30min;MERGED → 清理 + state completed;CLOSED/CONFLICTING → 报错退出;UNKNOWN 连续 3 次中止;TIMEOUT → 写 `pending_operation{command:"finishing-worktree", phase:"waiting_worktree_pr", pr_number}` 提示 `--resume`。
6. **PR+不等待**:state 置 `pr_open` + pr_number,不清理不阻塞。
7. **保留 worktree**:不合并不清理,state 不动。
8. 任一合并完成路径(MERGED)后:切回 trunk 并 `fetch & pull`。

### 丢弃路径(仅显式要求)

展示分支名、完整 commit 列表、worktree 路径 → 用户逐字输入 `discard` → 清理 + 从 state 删除(`speccode delete-state --cwd . --branch <branch>`;父实体 children 不动——slug 保留供重开)。

## 清理(来源限定)

仅处理「路径位于 resolve-worktree-dir 解析结果之下 或 state 有登记」的 worktree;先离开被清理目录(`cd <主仓根>` 或全程 `git -C`);`worktree remove --force` + `branch -D` + 询问删远端 + `worktree prune`。不满足 → 原样保留并说明。

## 收尾

1. `feature-progress --branch <所属父分支或本分支>` 取进度。
2. onWorktreeFinished 钩子(有 PR 带 pr_number)。
3. 状态报告:`<分支> 进度 X/Y done`;大需求场景按父实体 children 派生渲染;建议后续(finishing-feature / finishing-worktree 下一子分支)。
4. 写记忆(经用户确认或内置判据)。
