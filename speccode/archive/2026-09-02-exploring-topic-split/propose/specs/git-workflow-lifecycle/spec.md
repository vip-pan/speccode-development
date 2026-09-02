# git-workflow-lifecycle Delta

## MODIFIED Requirements

### Requirement: 功能分支命名规则

功能分支名 MUST 形如 `<type>/<slug>`,恰好一个 `/`;`type` MUST ∈ `{feature, bugfix, refactor, chore}`;`slug` MUST 只含 `[a-z0-9-]`。`/speccode:creating-feature` MUST 校验该规则,非法则拒绝并提示用户。type/slug 的确定 MUST 按以下顺序:命令参数直给(合法则直接采用,slug 即探索 topic 名,按 slug=topic 约定查找 `_exploring/<slug>`)→ `list-memory` 列出既有 `_exploring` topic 供用户选择(选定 topic 的记忆文件内容作为 type 推断来源,slug 预填 topic 名)→ AskUserQuestion 询问;推断结果 MUST NOT 静默生效,MUST 以预置推荐项形式经用户确认。MUST NOT 以扫描 `speccode/changes/` 作为推断来源(该目录仅存在于 worktree 分支,trunk 上永不命中);MUST NOT 将未与 slug 匹配的探索 topic 内容混入推断或骨架。

#### Scenario: 合法分支名
- **WHEN** 用户提供 slug `payment-api`,type 经上述顺序确定并经用户确认为 feature
- **THEN** 分支名 MUST 为 `feature/payment-api`,对应 state 文件 `feature__payment-api.json`

#### Scenario: 非法 slug 被拒绝
- **WHEN** 用户提供的 slug 含大写字母、下划线、空格或额外的 `/`
- **THEN** `/speccode:creating-feature` MUST 拒绝创建并提示合法字符集 `[a-z0-9-]`

#### Scenario: topic 推断需确认
- **WHEN** 命令参数未直给分支名,且 `list-memory` 返回非空 topic 清单,用户选定 topic `_exploring/payment-rework`
- **THEN** 命令 MUST 以该 topic 记忆文件内容推断 type 并预置为 AskUserQuestion 推荐项(slug 预填 `payment-rework`),且 MUST 在用户确认后才创建分支

#### Scenario: slug=topic 命中承接
- **WHEN** 命令参数直给 `feature/payment-rework`,且 `_exploring/payment-rework` 存在记忆文件
- **THEN** 命令 MUST 以该文件为 type 推断来源(推断仍经确认),并在创建完成后经 rename-memory 承接为该 feature 的记忆文件

#### Scenario: 无信号时直接询问
- **WHEN** 命令参数未直给分支名,且 `list-memory` 返回空清单
- **THEN** 命令 MUST 直接以 AskUserQuestion 询问 type 与 slug,不扫描 `speccode/changes/`
