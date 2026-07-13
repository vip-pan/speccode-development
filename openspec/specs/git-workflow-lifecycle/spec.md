## Purpose

speccode 的端到端 git 工作流:trunk / display / feature / worktree 四层分支拓扑,10 个 `/speccode:*` slash 命令的行为契约,阻塞等 PR 合并、finish 收尾、状态报告、worktree 前缀与功能分支命名规则。

## Requirements

### Requirement: 分支拓扑四层结构
speccode SHALL 管理 trunk / display / feature / worktree 四层分支,各层职责如下:
- trunk: 主干分支(默认 `origin/master`),不带 spec 文档
- display: 标的分支(= 主干 + spec 文档 tracked),可选,作为 feature 开发的初始分支
- feature/bugfix/refactor/chore/<slug>: 功能分支,从 initial 分支(优先 display,否则 trunk)切出
- worktree-<suffix>: 开发分支(以 `worktree-` 为硬前缀),从 feature 切出,通过 `git worktree add` 创建

#### Scenario: 从 display 切 feature
- **WHEN** `display.enabled = true` 且用户执行 `/speccode:start`
- **THEN** 新创建的 feature 分支 MUST 基于当前 display 分支 HEAD

#### Scenario: 无 display 时从 trunk 切 feature
- **WHEN** `display.enabled = false` 且用户执行 `/speccode:start`
- **THEN** 新创建的 feature 分支 MUST 基于 trunk 分支 HEAD

### Requirement: 命令清单
speccode SHALL 暴露以下 10 个 slash 命令:`init`、`start`、`develop-start`、`develop-complete`、`finish`、`status`、`display-merge-trunk`、`display-rebase-trunk`、`display-reset-to-trunk`、`reset`。

#### Scenario: 命令全部可用
- **WHEN** speccode 已正确初始化(`.speccode/config.json` 存在)
- **THEN** 用户 MUST 能通过 `/speccode:<name>` 形式调用上述全部 10 个命令

### Requirement: 阻塞等 PR 合并
`/speccode:develop-complete` 与 `/speccode:finish` 在创建 PR/MR 后 MUST 支持阻塞等待合并,默认超时 30 分钟。

#### Scenario: PR 正常合并
- **WHEN** 用户选择"PR + 阻塞等合并"模式且 PR 状态变为 MERGED
- **THEN** 命令 MUST 继续执行后续清理与 state 更新步骤

#### Scenario: PR 超时未合并
- **WHEN** 用户选择"PR + 阻塞等合并"模式且 30 分钟内未合并
- **THEN** 命令 MUST 中止,保留 PR 链接,并提示用户稍后执行 `/speccode:<cmd> --resume`

#### Scenario: PR 被关闭或冲突
- **WHEN** PR 状态为 CLOSED 或 CONFLICTING
- **THEN** 命令 MUST 立即报错退出,不执行后续 squash 或 state 更新

### Requirement: finish 完成后的分支归宿
`/speccode:finish` 成功完成后 MUST 将 HEAD 切回 display 分支(若存在)或 trunk 分支,删除 `<feature>-complete` 临时分支(本地 + 远端),并保留 feature 分支。

#### Scenario: 有 display 时切回 display
- **WHEN** `display.enabled = true` 且 finish 流程全部完成
- **THEN** HEAD MUST 处于 display 分支

#### Scenario: 无 display 时切回 trunk
- **WHEN** `display.enabled = false` 且 finish 流程全部完成
- **THEN** HEAD MUST 处于 trunk 分支(不能停留在 `<feature>-complete` 分支)

#### Scenario: 回收 -complete 临时分支
- **WHEN** trunk PR 合并完成
- **THEN** `<feature>-complete` 分支 MUST 被删除(本地与远端),因其为 speccode 创建的临时分支

#### Scenario: 保留 feature 分支
- **WHEN** finish 全部完成
- **THEN** feature 分支 MUST 仍存在(不被 speccode 删除),作为历史与无 display 模式下的文档留存点

### Requirement: finish 阻塞门禁
`/speccode:finish` 开头 MUST 先跑对账,再检查当前 feature 的所有 worktree 状态;存在任何 `pending` / `in_progress` / `pr_open` 状态的 worktree 时 MUST 阻止 finish。

#### Scenario: 存在未完成 worktree
- **WHEN** feature 下某 worktree 状态为 `in_progress`
- **THEN** finish MUST 阻止并提示用户先完成该 worktree

#### Scenario: 存在 pr_open worktree
- **WHEN** feature 下某 worktree 状态为 `pr_open`(PR 已开未合)
- **THEN** finish MUST 阻止并提示"worktree-x 的 PR #N 还未合并"

#### Scenario: 对账发现残留 worktree
- **WHEN** state 标某 worktree 为 `completed` 但对账发现 git 中该 worktree 仍存在
- **THEN** finish MUST 提示用户检测到残留 worktree,先清理后再 finish

### Requirement: finish 双 PR 顺序
在 `display.enabled = true` 时,`/speccode:finish` MUST 先创建并阻塞等待 PR→display 合并,再基于 display 的 merge commit 创建 `<feature>-complete`,剥离文档后创建并阻塞等待 PR→trunk 合并。

#### Scenario: display PR 先于 trunk PR
- **WHEN** finish 路径 A 执行
- **THEN** `<feature>-complete` 分支 MUST 基于 PR→display 合并后的 merge commit 创建,而非本地 feature HEAD

#### Scenario: 任一 PR 超时挂起
- **WHEN** PR→display 或 PR→trunk 在超时内未合并
- **THEN** finish MUST 把挂起状态写入 feature state 的 `pending_operation` 字段并中止,供 `/speccode:finish --resume` 续跑

### Requirement: 状态报告输出
`/speccode:develop-complete` 每次执行后 MUST 打印当前 feature 下的 worktree 进度报告,无论是否全部完成。

#### Scenario: 部分完成
- **WHEN** feature 下 3 个 worktree 完成了 1 个
- **THEN** 报告 MUST 形如 `feature/payment 1/3 done`,并列出每个 worktree 的 status

#### Scenario: 全部完成时仍打印
- **WHEN** feature 下所有 worktree 都已 completed
- **THEN** 命令 MUST 打印报告,并建议用户执行 `/speccode:finish`

### Requirement: worktree 前缀硬约定
所有由 speccode 管理的 worktree 分支 MUST 以 `worktree-` 为前缀,该前缀在 `config.json.worktree_prefix` 中可配置,但默认行为 SHALL 是硬性校验。

#### Scenario: develop-start 拒绝非法前缀
- **WHEN** 用户输入的 worktree 名不以 `worktree-` 开头
- **THEN** `/speccode:develop-start` MUST 拒绝并提示用户重新输入

#### Scenario: 对账识别非标准 worktree
- **WHEN** git 存在一个不以 `worktree-` 开头的 worktree 分支
- **THEN** 对账算法 MUST 标为 orphan,不纳入任何 active feature

### Requirement: 功能分支命名规则
功能分支名 MUST 形如 `<type>/<slug>`,恰好一个 `/`;`type` MUST ∈ `{feature, bugfix, refactor, chore}`;`slug` MUST 只含 `[a-z0-9-]`。`/speccode:start` MUST 校验该规则,非法则拒绝并提示用户。

#### Scenario: 合法分支名
- **WHEN** 用户提供 slug `payment-api`,type 推断为 feature
- **THEN** 分支名 MUST 为 `feature/payment-api`,对应 state 文件 `feature__payment-api.json`

#### Scenario: 非法 slug 被拒绝
- **WHEN** 用户提供的 slug 含大写字母、下划线、空格或额外的 `/`
- **THEN** `/speccode:start` MUST 拒绝创建并提示合法字符集 `[a-z0-9-]`

### Requirement: status 状态总览命令
`/speccode:status` MUST 为纯只读命令(除对账自愈外无副作用),开头跑对账,汇总所有 active feature 及其 worktree 进度、`pending_operation` 挂起状态,以及当前 config 摘要。

#### Scenario: 多 feature 总览
- **WHEN** 存在 2 个 active feature
- **THEN** `/speccode:status` MUST 列出每个 feature 的进度(如 `2/3 done`)、每个 worktree 的状态,以及各自的 `pending_operation`(若有)

#### Scenario: 无 active feature
- **WHEN** `.speccode/state/features/` 为空
- **THEN** `/speccode:status` MUST 提示"当前无 active feature"并显示 config 摘要

#### Scenario: status 触发 pr_open 推进
- **WHEN** 某 worktree 为 `pr_open` 且其 PR 已 MERGED
- **THEN** `/speccode:status` 的对账 MUST 把该 worktree 推进为 `completed` 并清理
