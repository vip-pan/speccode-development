## ADDED Requirements

### Requirement: 分支拓扑三层结构

speccode SHALL 管理 trunk / feature / worktree 三层分支,各层职责如下:
- trunk: 主干分支(默认 `origin/master`),`speccode/` 文档在其上保持 tracked
- feature/bugfix/refactor/chore/\<slug\>: 功能分支,MUST 从 trunk 切出
- worktree-\<suffix\>: 开发分支(以 `worktree-` 为硬前缀),从 feature 切出,通过 `git worktree add` 创建

MUST NOT 存在 display 层分支与 `<feature>-complete` 临时分支。

#### Scenario: 从 trunk 切 feature
- **WHEN** 用户执行 `/speccode:creating-feature`
- **THEN** 新创建的 feature 分支 MUST 基于 trunk 分支 HEAD

#### Scenario: 无 display 与 -complete 分支
- **WHEN** 检查 speccode 全流程创建的分支
- **THEN** MUST NOT 出现 display 分支或任何 `<feature>-complete` 分支

### Requirement: finishing-feature 单 PR 流程

`/speccode:finishing-feature` MUST 创建并阻塞等待唯一 PR(feature→trunk);合并后 MUST 删除 feature state、切回 trunk、保留 feature 分支;全程 MUST NOT 创建 `-complete` 分支、MUST NOT 执行任何文档剥离操作。

#### Scenario: 单 PR 到 trunk
- **WHEN** 用户执行 `/speccode:finishing-feature` 且对账通过
- **THEN** 命令 MUST 创建以 trunk 为 base、feature 为 head 的唯一 PR 并阻塞等待合并

#### Scenario: 合并后的分支归宿
- **WHEN** trunk PR 合并完成
- **THEN** feature state 文件 MUST 被删除,HEAD MUST 切回 trunk,feature 分支 MUST 保留(不被 speccode 删除)

#### Scenario: 超时挂起
- **WHEN** trunk PR 在超时内未合并
- **THEN** 命令 MUST 把 `pending_operation{command: "finishing-feature", phase: "waiting_trunk_pr", pr_number}` 写入 feature state 并中止,供 `--resume` 续跑

#### Scenario: 全程无 -complete 分支
- **WHEN** finishing-feature 完整执行
- **THEN** MUST NOT 创建 `<feature>-complete` 分支,MUST NOT 执行 `git rm --cached` 文档剥离

### Requirement: finishing-worktree 测试验证与选项菜单

`/speccode:finishing-worktree` 在执行任何合并路径前 MUST 运行全量测试,测试失败 MUST 停止且不呈现合并选项;测试通过后呈现的选项菜单 MUST 恰好为四项:「PR + 等待合并」「PR + 不等待」「本地 squash」「保留 worktree」。丢弃路径 MUST NOT 出现在菜单中,仅当用户显式要求丢弃时进入,且 MUST 先展示分支名、完整 commit 列表与 worktree 路径,再要求用户逐字输入 `discard` 确认。本地 squash 路径在合并完成后 MUST 对合并结果复跑全量测试,失败 MUST 停止(此时未推送,现场可恢复)。

#### Scenario: 测试失败即停
- **WHEN** 全量测试存在失败
- **THEN** 命令 MUST 展示失败并停止,不呈现合并选项

#### Scenario: 菜单四项
- **WHEN** 测试通过
- **THEN** 菜单 MUST 恰好含「PR + 等待合并」「PR + 不等待」「本地 squash」「保留 worktree」四个选项

#### Scenario: 丢弃需逐字确认
- **WHEN** 用户显式要求丢弃该 worktree 成果
- **THEN** 命令 MUST 展示分支名、commit 列表与 worktree 路径,且仅在用户逐字输入 `discard` 后才执行删除

#### Scenario: 本地合并后复测
- **WHEN** 用户选择「本地 squash」且合并提交完成
- **THEN** 命令 MUST 对合并后的 feature 分支复跑全量测试;失败 MUST 停止并保留 worktree 与分支现场

#### Scenario: 保留后状态不变
- **WHEN** 用户选择「保留 worktree」
- **THEN** 该 worktree 的 state MUST 保持原状态(不新增状态值),status 命令按既有枚举正常展示

### Requirement: worktree 清理来源限定

`/speccode:finishing-worktree` 与 `/speccode:reset` 清理 worktree 时 MUST 仅处理「分支带配置前缀(worktree_prefix)且(路径位于 `resolve-worktree-dir` 解析结果之下 或 在 state 中有登记)」的 worktree;不满足条件的 worktree MUST 原样保留给宿主环境。「state 登记」析取项 MUST 覆盖 worktree_dir 配置变更前创建的旧目录自建 worktree。

#### Scenario: 配置目录内的 worktree 被清理
- **WHEN** worktree 路径位于 worktree_dir 之下且分支以 `worktree-` 开头
- **THEN** 清理流程 MUST 执行 `git worktree remove` + `git worktree prune`

#### Scenario: 外部 worktree 原样保留
- **WHEN** worktree 路径不在 worktree_dir 之下、未在任何 state 中登记(由宿主环境创建)
- **THEN** 清理流程 MUST NOT 触碰该 worktree

#### Scenario: worktree_dir 变更后旧目录自建 worktree 不泄漏
- **WHEN** worktree_dir 已从 A 改为 B,旧目录 A 下仍存在 state 中登记的 worktree
- **THEN** 清理流程 MUST 正常处理该 worktree(凭 state 登记命中),不因其不在新目录 B 之下而泄漏

### Requirement: creating-worktree 项目 setup 与基线测试

`/speccode:creating-worktree` 创建 worktree 后 MUST 按标记文件执行项目 setup(`package.json`→npm install、`Cargo.toml`→cargo build、`requirements.txt`→pip install、`pyproject.toml`→poetry install、`go.mod`→go mod download),随后 MUST 运行基线测试;基线测试失败时 MUST 报告并询问用户继续还是调查。

#### Scenario: 按标记文件 setup
- **WHEN** 新 worktree 根存在 `package.json`
- **THEN** 命令 MUST 执行 `npm install` 后再进入基线测试

#### Scenario: 基线测试失败询问
- **WHEN** 基线测试存在失败
- **THEN** 命令 MUST 展示失败摘要并询问「继续开发还是先行调查」,不擅自继续

### Requirement: creating-worktree 后续引导

`/speccode:creating-worktree` 成功创建 worktree 后 MUST 引导用户进入 `/speccode:proposing` 落地文档;auto 模式(按 Claude Code / Codex 等工具的会话执行模式判断)下 MUST 自动衔接;判断依据不充分时 MUST 默认询问。

#### Scenario: 手动模式询问
- **WHEN** worktree 创建成功且当前非 auto 模式
- **THEN** 命令 MUST 询问用户是否执行 `/speccode:proposing`

#### Scenario: auto 模式自动衔接
- **WHEN** worktree 创建成功且当前处于 auto 模式
- **THEN** 命令 MUST 自动衔接执行 `/speccode:proposing`

## MODIFIED Requirements

### Requirement: 命令清单

speccode SHALL 暴露以下 21 个 slash 命令:`init`、`exploring`、`creating-feature`、`creating-worktree`、`proposing`、`brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`receiving-code-review`、`verification-before-completion`、`syncing`、`archiving`、`finishing-worktree`、`finishing-feature`、`status`、`reset`。

#### Scenario: 命令全部可用
- **WHEN** speccode 已正确初始化(`.speccode/config.json` 存在)
- **THEN** 用户 MUST 能通过 `/speccode:<name>` 形式调用上述全部 21 个命令

#### Scenario: 旧命令不复存在
- **WHEN** 检查命令清单
- **THEN** `start`、`develop-start`、`develop-complete`、`finish`、`display-merge-trunk`、`display-rebase-trunk`、`display-reset-to-trunk` MUST NOT 出现在可用命令中

### Requirement: 阻塞等 PR 合并

`/speccode:finishing-worktree` 与 `/speccode:finishing-feature` 在创建 PR/MR 后 MUST 支持阻塞等待合并,默认超时 30 分钟。轮询 MUST 以引擎 `query-pr` 单次查询 verb 为基础在命令层实现(每 30 秒一次),引擎 MUST NOT 提供阻塞式等待 verb。`query-pr` 状态含 CONFLICTING,冲突 MUST 立即报错而非等到超时。

#### Scenario: PR 正常合并
- **WHEN** 用户选择「PR + 等待合并」模式且 PR 状态变为 MERGED
- **THEN** 命令 MUST 继续执行后续清理与 state 更新步骤

#### Scenario: PR 超时未合并
- **WHEN** 用户选择「PR + 等待合并」模式且 30 分钟内未合并
- **THEN** 命令 MUST 中止,保留 PR 链接,并提示用户稍后执行 `/speccode:<cmd> --resume`

#### Scenario: PR 被关闭或冲突
- **WHEN** PR 状态为 CLOSED 或 CONFLICTING
- **THEN** 命令 MUST 立即报错退出,不执行后续 squash 或 state 更新

### Requirement: finish 阻塞门禁

`/speccode:finishing-feature` 开头 MUST 先跑对账,再检查当前 feature 的所有 worktree 状态;存在任何 `pending` / `in_progress` / `pr_open` 状态的 worktree 时 MUST 阻止执行。

#### Scenario: 存在未完成 worktree
- **WHEN** feature 下某 worktree 状态为 `in_progress`
- **THEN** finishing-feature MUST 阻止并提示用户先完成该 worktree

#### Scenario: 存在 pr_open worktree
- **WHEN** feature 下某 worktree 状态为 `pr_open`(PR 已开未合)
- **THEN** finishing-feature MUST 阻止并提示「worktree-x 的 PR #N 还未合并」

#### Scenario: 对账发现残留 worktree
- **WHEN** state 标某 worktree 为 `completed` 但对账发现 git 中该 worktree 仍存在
- **THEN** finishing-feature MUST 提示用户检测到残留 worktree,先清理后再执行

### Requirement: 状态报告输出

`/speccode:finishing-worktree` 每次执行后 MUST 打印当前 feature 下的 worktree 进度报告,无论是否全部完成。

#### Scenario: 部分完成
- **WHEN** feature 下 3 个 worktree 完成了 1 个
- **THEN** 报告 MUST 形如 `feature/payment 1/3 done`,并列出每个 worktree 的 status

#### Scenario: 全部完成时仍打印
- **WHEN** feature 下所有 worktree 都已 completed
- **THEN** 命令 MUST 打印报告,并建议用户执行 `/speccode:finishing-feature`

### Requirement: worktree 前缀硬约定

所有由 speccode 管理的 worktree 分支 MUST 以 `worktree-` 为前缀,该前缀在 `config.json.worktree_prefix` 中可配置,但默认行为 SHALL 是硬性校验。

#### Scenario: creating-worktree 拒绝非法前缀
- **WHEN** 用户输入的 worktree 名不以 `worktree-` 开头
- **THEN** `/speccode:creating-worktree` MUST 拒绝并提示用户重新输入

#### Scenario: 对账识别非标准 worktree
- **WHEN** git 存在一个不以 `worktree-` 开头的 worktree 分支
- **THEN** 对账算法 MUST 标为 orphan,不纳入任何 active feature

### Requirement: 功能分支命名规则

功能分支名 MUST 形如 `<type>/<slug>`,恰好一个 `/`;`type` MUST ∈ `{feature, bugfix, refactor, chore}`;`slug` MUST 只含 `[a-z0-9-]`。`/speccode:creating-feature` MUST 校验该规则,非法则拒绝并提示用户。

#### Scenario: 合法分支名
- **WHEN** 用户提供 slug `payment-api`,type 推断为 feature
- **THEN** 分支名 MUST 为 `feature/payment-api`,对应 state 文件 `feature__payment-api.json`

#### Scenario: 非法 slug 被拒绝
- **WHEN** 用户提供的 slug 含大写字母、下划线、空格或额外的 `/`
- **THEN** `/speccode:creating-feature` MUST 拒绝创建并提示合法字符集 `[a-z0-9-]`

## REMOVED Requirements

### Requirement: 分支拓扑四层结构

### Requirement: finish 双 PR 顺序

### Requirement: finish 完成后的分支归宿
