## MODIFIED Requirements

### Requirement: memory 文件位置与命名

每个 feature 的记忆文件 SHALL 为**主仓** `.speccode/memory/<type>__<slug>.md`,文件名 MUST 复用 state 文件的 `<type>__<slug>` 双下划线规则;MUST 保持 untracked(与 `.speccode/` 其他运行时数据一致);主仓定位使同一 feature 的多个 worktree 共享同一份 memory。trunk 级例外:`.speccode/memory/_exploring.md`(exploring 尚无 feature 归属时的跨会话承接)与 `.speccode/memory/_knowledge.md`(knowledge 命令的 trunk 级维护摘要)——二者均为无斜杠 trunk 键,文件名直通(不经 `branchToStateName` 转换)。

#### Scenario: 命名复用双下划线规则

- WHEN feature 分支为 `feature/payment-api`
- THEN 记忆文件 MUST 为 `.speccode/memory/feature__payment-api.md`

#### Scenario: 多 worktree 共享一份 memory

- WHEN 同一 feature 的 worktree-a 与 worktree-b 分别执行命令写 memory
- THEN 二者 MUST 读写主仓的同一个记忆文件(而非各自 worktree 内的副本)

#### Scenario: memory 不被 git 跟踪

- WHEN 记忆文件已写入
- THEN 其 MUST 处于 untracked 状态,不进入任何分支的 git 历史与 PR

#### Scenario: _exploring.md 例外

- WHEN exploring 结束且探索结论无既有 feature 可归属
- THEN 结论摘要 MUST 写入主仓 `.speccode/memory/_exploring.md`,供后续 creating-feature 跨会话承接

#### Scenario: _knowledge.md 例外

- WHEN knowledge 命令(distilling/recording)从 trunk 完成维护并创建 PR
- THEN 维护摘要 MUST 追加到主仓 `.speccode/memory/_knowledge.md`,MUST NOT 写 feature 级 memory

### Requirement: read-memory / write-memory verb

引擎 SHALL 暴露 `read-memory --branch <F>`(文件不存在时返回 `{memory: null}`)与 `write-memory --branch <F> --json-stdin`(stdin payload 为 `{mode: "replace" | "append", content: "..."}`)两个 verb。branch 校验 MUST 接受 trunk 级无斜杠保留键 `_exploring` 与 `_knowledge`(二者免 `validateBranch` 的 `<type>/<slug>` 校验);其余 branch MUST 经 `validateBranch` 校验,非法时返回 `{ok:false, error}`。

#### Scenario: 文件缺失返回 null

- WHEN 对无记忆文件的 feature 执行 read-memory
- THEN 返回 MUST 为 `{ok: true, memory: null}`,不报错

#### Scenario: append 模式追加

- WHEN 以 `{mode: "append", content: "..."}` 执行 write-memory
- THEN 内容 MUST 追加到既有文件末尾,既有内容完整保留

#### Scenario: _knowledge 保留键被接受

- WHEN 以 `--branch _knowledge` 执行 write-memory 或 read-memory
- THEN 校验通过,读写 `.speccode/memory/_knowledge.md`,不报 invalid branch
