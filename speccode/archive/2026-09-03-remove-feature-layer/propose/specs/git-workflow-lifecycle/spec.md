# git-workflow-lifecycle Delta

## MODIFIED Requirements

### Requirement: 命令清单

speccode SHALL 暴露以下 21 个 slash 命令:`init`、`exploring`、`creating-feature`、`creating-worktree`、`proposing`、`brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`receiving-code-review`、`verification-before-completion`、`syncing`、`archiving`、`finishing-worktree`、`finishing-feature`、`status`、`reset`。其中 `creating-feature` 与 `finishing-feature` SHALL 为大需求 opt-in 命令(创建/收尾集成分支),普通需求路径 SHALL 只经 `creating-worktree` 与 `finishing-worktree`。

#### Scenario: 命令全部可用
- **WHEN** speccode 已正确初始化(`.speccode/config.json` 存在)
- **THEN** 用户 MUST 能通过 `/speccode:<name>` 形式调用上述全部 21 个命令

#### Scenario: 旧命令不复存在
- **WHEN** 检查命令清单
- **THEN** `start`、`develop-start`、`develop-complete`、`finish`、`display-merge-trunk`、`display-rebase-trunk`、`display-reset-to-trunk` MUST NOT 出现在可用命令中

### Requirement: 阻塞等 PR 合并

`/speccode:finishing-worktree`(trunk 目标)与 `/speccode:finishing-feature` 在创建 PR/MR 后 MUST 支持阻塞等待合并,默认超时 30 分钟。轮询 MUST 以引擎 `query-pr` 单次查询 verb 为基础在命令层实现(每 30 秒一次),引擎 MUST NOT 提供阻塞式等待 verb。`query-pr` 状态含 CONFLICTING,冲突 MUST 立即报错而非等到超时。PR 合并动作完成(MERGED)后,命令 MUST 切换到目标分支(trunk 或 merge_target 指定的集成分支)并 `fetch & pull` 最新代码,以标志本轮合并收尾。

#### Scenario: PR 正常合并
- **WHEN** 用户选择「PR + 等待合并」模式且 PR 状态变为 MERGED
- **THEN** 命令 MUST 继续执行后续清理与 state 更新步骤

#### Scenario: PR 超时未合并
- **WHEN** 用户选择「PR + 等待合并」模式且 30 分钟内未合并
- **THEN** 命令 MUST 中止,保留 PR 链接,并提示用户稍后执行 `/speccode:<cmd> --resume`

#### Scenario: PR 被关闭或冲突
- **WHEN** PR 状态为 CLOSED 或 CONFLICTING
- **THEN** 命令 MUST 立即报错退出,不执行后续 squash 或 state 更新

#### Scenario: 合并后切换目标分支
- **WHEN** PR 合并(MERGED)完成且清理与 state 更新结束
- **THEN** 命令 MUST 切换到目标分支并 `fetch & pull`,失败时 MUST 仅警告不阻断

### Requirement: finish 阻塞门禁

`/speccode:finishing-feature` 开头 MUST 先跑对账,再检查本父实体 state 的 `children` 清单;存在任何 `pending` / `in_progress` / `pr_open` 状态的子分支时 MUST 阻止执行;对账 orphans 中若有本父实体的残留 worktree MUST 提示先清理。

#### Scenario: 存在未完成子分支
- **WHEN** 父实体 children 中某子分支状态为 `in_progress`
- **THEN** finishing-feature MUST 阻止并提示用户先完成该子分支(经 finishing-worktree)

#### Scenario: 存在 pr_open 子分支
- **WHEN** 父实体 children 中某子分支状态为 `pr_open`
- **THEN** finishing-feature MUST 阻止并提示「该子分支的 PR #N 还未合并」

#### Scenario: 对账发现残留 worktree
- **WHEN** 对账发现子 worktree 在 git 中残留
- **THEN** finishing-feature MUST 提示用户检测到残留 worktree,先清理后再执行

### Requirement: 状态报告输出

`/speccode:finishing-worktree` 每次执行后 MUST 打印所属分支(父实体)的进度报告,无论是否全部完成;大需求场景报告 MUST 反映父实体 `children` 清单中各子分支状态。

#### Scenario: 部分完成
- **WHEN** 父实体下 3 个子分支完成了 1 个
- **THEN** 报告 MUST 形如 `feature/mkt-req 1/3 done`,并列出每个子分支的 status

#### Scenario: 全部完成时仍打印
- **WHEN** 父实体下所有子分支都已 completed
- **THEN** 命令 MUST 打印报告,并建议用户执行 `/speccode:finishing-feature`

### Requirement: 功能分支命名规则

分支名(worktree 分支与集成分支同规)MUST 形如 `<type>/<slug>`,恰好一个 `/`;`type` MUST ∈ `{feature, bugfix, refactor, chore}`;`slug` MUST 只含 `[a-z0-9-]`。`/speccode:creating-worktree` 与 `/speccode:creating-feature` MUST 校验该规则,非法则拒绝并提示用户。type/slug 的确定 MUST 按以下顺序:命令参数直给(合法则直接采用,slug 即探索 topic 名,按 slug=topic 约定查找 `_exploring/<slug>`)→ `list-memory` 列出既有 `_exploring` topic 供用户选择(选定 topic 的记忆文件内容作为 type 推断来源,slug 预填 topic 名)→ AskUserQuestion 询问;推断结果 MUST NOT 静默生效,MUST 以预置推荐项形式经用户确认。MUST NOT 以扫描 `speccode/changes/` 作为推断来源(该目录仅存在于开发分支,trunk 上永不命中);MUST NOT 将未与 slug 匹配的探索 topic 内容混入推断或骨架。探索结论的承接(rename-memory 原子迁移)宿主 MUST 为 `creating-worktree`(普通子需求)与 `creating-feature`(大需求父 topic)。

#### Scenario: 合法 worktree 分支名
- **WHEN** 用户提供 slug `payment-api`,type 经上述顺序确定并经用户确认为 feature
- **THEN** worktree 分支名 MUST 为 `feature/payment-api`,对应 state 文件 `feature__payment-api.json`

#### Scenario: 非法 slug 被拒绝
- **WHEN** 用户提供的 slug 含大写字母、下划线、空格或额外的 `/`
- **THEN** `/speccode:creating-worktree` MUST 拒绝创建并提示合法字符集 `[a-z0-9-]`

#### Scenario: topic 承接宿主为 creating-worktree
- **WHEN** 命令参数直给 `feature/payment-rework`,且 `_exploring/payment-rework` 存在记忆文件
- **THEN** `/speccode:creating-worktree` MUST 以该文件为 type 推断来源(推断仍经确认),并在创建完成后经 rename-memory 承接为该分支的记忆文件

#### Scenario: 大需求父分支命名
- **WHEN** 大需求 `marketing-requirements-manage` 经 creating-feature 创建集成分支
- **THEN** 分支名 MUST 为 `feature/marketing-requirements-manage`,子分支(如 `feature/marketing-requirements-list`)MUST 从集成分支当前 head 切出

#### Scenario: 无信号时直接询问
- **WHEN** 命令参数未直给分支名,且 `list-memory` 返回空清单
- **THEN** 命令 MUST 直接以 AskUserQuestion 询问 type 与 slug,不扫描 `speccode/changes/`

### Requirement: status 状态总览命令
`/speccode:status` MUST 为纯只读命令(除对账自愈外无副作用),开头跑对账,汇总 `state/branches/` 下所有 active 分支:普通分支的 worktree 进度与 `pending_operation` 挂起状态、父实体的 `children` 状态树,以及当前 config 摘要。

#### Scenario: 多分支总览
- **WHEN** 存在普通分支与父实体各若干
- **THEN** `/speccode:status` MUST 列出每个普通分支的状态与 `pending_operation`(若有),并以树状渲染父实体的 children 清单(各子分支 status)

#### Scenario: 无 active 分支
- **WHEN** `.speccode/state/branches/` 为空
- **THEN** `/speccode:status` MUST 提示「当前无 active 分支」并显示 config 摘要

#### Scenario: status 触发 pr_open 推进
- **WHEN** 某分支为 `pr_open` 且其 PR 已 MERGED
- **THEN** `/speccode:status` 的对账 MUST 把该分支推进为 `completed` 并清理

### Requirement: finishing-feature 单 PR 流程

`/speccode:finishing-feature` MUST 先经 finish 阻塞门禁(children 全 completed),随后创建并阻塞等待唯一 PR(集成分支→trunk);合并后 MUST 删除父实体 state、切回 trunk 并 `fetch & pull`、保留集成分支与子分支作历史;全程 MUST NOT 创建 `-complete` 分支、MUST NOT 执行任何文档剥离操作。

#### Scenario: 单 PR 到 trunk
- **WHEN** 用户执行 `/speccode:finishing-feature` 且门禁与对账通过
- **THEN** 命令 MUST 创建以 trunk 为 base、集成分支为 head 的唯一 PR 并阻塞等待合并

#### Scenario: 合并后的分支归宿
- **WHEN** trunk PR 合并完成
- **THEN** 父实体 state 文件 MUST 被删除,HEAD MUST 切回 trunk 并 `fetch & pull`,集成分支与子分支 MUST 保留(不被 speccode 删除)

#### Scenario: 超时挂起
- **WHEN** trunk PR 在超时内未合并
- **THEN** 命令 MUST 把 `pending_operation{command: "finishing-feature", phase: "waiting_trunk_pr", pr_number}` 写入父实体 state 并中止,供 `--resume` 续跑

#### Scenario: 全程无 -complete 分支
- **WHEN** finishing-feature 完整执行
- **THEN** MUST NOT 创建 `<branch>-complete` 分支,MUST NOT 执行 `git rm --cached` 文档剥离

### Requirement: finishing-worktree 测试验证与选项菜单

`/speccode:finishing-worktree` 在执行任何合并路径前 MUST 运行全量测试,测试失败 MUST 停止且不呈现合并选项。合并路径 MUST 按 state 的 `merge_target` 路由:`merge_target` 为非 trunk 分支(集成分支)时 MUST 走本地 squash 路径(合并到该集成分支、复跑全量测试、本分支 state 置 `completed`——父实体 children 仅身份登记 MUST NOT 被写、收尾切到该分支 `fetch & pull`),MUST NOT 呈现 PR 菜单;`merge_target` 缺省(trunk)时菜单 MUST 恰好为三项:「PR + 等待合并」「PR + 不等待」「保留 worktree」。丢弃路径 MUST NOT 出现在菜单中,仅当用户显式要求丢弃时进入,且 MUST 先展示分支名、完整 commit 列表与 worktree 路径,再要求用户逐字输入 `discard` 确认。本地 squash 路径在合并完成后 MUST 对合并结果复跑全量测试,失败 MUST 停止(此时未推送,现场可恢复)。

#### Scenario: 测试失败即停
- **WHEN** 全量测试存在失败
- **THEN** 命令 MUST 展示失败并停止,不呈现合并选项

#### Scenario: trunk 目标菜单三项
- **WHEN** state 的 `merge_target` 缺省(trunk)且测试通过
- **THEN** 菜单 MUST 恰好含「PR + 等待合并」「PR + 不等待」「保留 worktree」三个选项,MUST NOT 含「本地 squash」

#### Scenario: 集成目标自动路由
- **WHEN** state 的 `merge_target` 为集成分支且测试通过
- **THEN** 命令 MUST 直接执行本地 squash 合并到集成分支并复测,MUST NOT 询问 PR 模式;合并完成后本分支 state MUST 置 `completed`(父实体 children 仅身份登记,MUST NOT 被写)

#### Scenario: 丢弃需逐字确认
- **WHEN** 用户显式要求丢弃该 worktree 成果
- **THEN** 命令 MUST 展示分支名、commit 列表与 worktree 路径,且仅在用户逐字输入 `discard` 后才执行删除

#### Scenario: 本地合并后复测
- **WHEN** 本地 squash 合并提交完成
- **THEN** 命令 MUST 对合并后的集成分支复跑全量测试;失败 MUST 停止并保留 worktree 与分支现场

#### Scenario: 保留后状态不变
- **WHEN** 用户选择「保留 worktree」
- **THEN** 该分支的 state MUST 保持原状态(不新增状态值),status 命令按既有枚举正常展示

### Requirement: worktree 清理来源限定

`/speccode:finishing-worktree` 与 `/speccode:reset` 清理 worktree 时 MUST 仅处理「路径位于 `resolve-worktree-dir` 解析结果之下 或 在 state 中有登记」的 worktree,分支名前缀 MUST NOT 作为清理判定条件;不满足条件的 worktree MUST 原样保留给宿主环境。「state 登记」析取项 MUST 覆盖 worktree_dir 配置变更前创建的旧目录自建 worktree。

#### Scenario: 配置目录内的 worktree 被清理
- **WHEN** worktree 路径位于 worktree_dir 之下(无论分支名形态)
- **THEN** 清理流程 MUST 执行 `git worktree remove` + `git worktree prune`

#### Scenario: 外部 worktree 原样保留
- **WHEN** worktree 路径不在 worktree_dir 之下、未在任何 state 中登记(由宿主环境创建)
- **THEN** 清理流程 MUST NOT 触碰该 worktree

#### Scenario: worktree_dir 变更后旧目录自建 worktree 不泄漏
- **WHEN** worktree_dir 已从 A 改为 B,旧目录 A 下仍存在 state 中登记的 worktree
- **THEN** 清理流程 MUST 正常处理该 worktree(凭 state 登记命中),不因其不在新目录 B 之下而泄漏

### Requirement: 对账 orphan 判定

对账算法(reconcile)SHALL 以路径识别管辖对象:`git worktree list` 中路径位于 `config.worktree_dir` 之下的 worktree 为 speccode 管辖,分支名形态 MUST NOT 参与识别;父实体(无 worktree 的集成分支)MUST 由 state 侧识别。orphan 判定 MUST 覆盖:①state 登记的非 `completed` 分支在 git 中缺失(worktree 或分支消失);②worktree_dir 下存在任何 state 未登记的 worktree;③state 的 `merge_target` 指向的分支不存在。status 为 `completed` 的条目 MUST NOT 计为 orphan——合并完成后 git 侧被清理是设计的正常终态,state 保留 completed 记录供进度核算,直至 finishing-feature 删除父实体 state。

#### Scenario: 未完成且 git 缺失计 orphan
- **WHEN** state 登记某分支为 `in_progress`,而其 worktree 与分支在 git 中均已不存在
- **THEN** 对账 MUST 把该分支计入 orphans

#### Scenario: completed 且 git 已清理不计 orphan
- **WHEN** state 登记某分支为 `completed`,且其 git 侧 worktree 与分支已被 finishing-worktree 清理
- **THEN** 对账 MUST NOT 把该分支计入 orphans

#### Scenario: 未登记的目录内 worktree 计 orphan
- **WHEN** `git worktree list` 中某 worktree 路径位于 worktree_dir 之下,但任何 state 均未登记
- **THEN** 对账 MUST 把该 worktree 计入 orphans(半截创建的发现能力)

#### Scenario: merge_target 分支缺失计 orphan
- **WHEN** 某分支 state 的 `merge_target` 指向的集成分支在 git 中不存在
- **THEN** 对账 MUST 把该分支计入 orphans 并报告

### Requirement: 开发完成收尾路由

`/speccode:subagent-driven-development` 与 `/speccode:executing-plans` 完成开发后 MUST 依据是否存在落地文档(`speccode/changes/<slug>/` 是否存在)路由收尾:
- 存在落地文档 → MUST 引导用户先执行 `/speccode:syncing` 合并规格,再 `/speccode:archiving` 归档,最后 `/speccode:finishing-worktree`;该顺序为硬约束——syncing/archiving 的 trunk 防护要求当前处于非 trunk 的开发分支,而 finishing-worktree 会移除 worktree,故 sync/archive 只能在 finishing-worktree 之前执行;
- 不存在落地文档 → MUST 直接引导 `/speccode:finishing-worktree`,不引导 syncing/archiving。

路由引导 MUST 遵循手动/auto 模式约定:手动模式 MUST 用 AskUserQuestion 询问;auto 模式 MUST 自动衔接执行 `/speccode:syncing`;判断依据不充分时 MUST 默认询问。

#### Scenario: 有落地文档的完整收尾
- **WHEN** 开发完成且 `speccode/changes/<slug>/` 存在
- **THEN** 命令 MUST 引导用户依次执行 `/speccode:syncing` → `/speccode:archiving` → `/speccode:finishing-worktree`

#### Scenario: 无落地文档直接收尾
- **WHEN** 开发完成且 `speccode/changes/<slug>/` 不存在
- **THEN** 命令 MUST 直接引导 `/speccode:finishing-worktree`,不引导 syncing/archiving

#### Scenario: auto 模式自动衔接
- **WHEN** 开发完成、落地文档存在且当前处于 auto 模式
- **THEN** 命令 MUST 自动衔接执行 `/speccode:syncing`

## REMOVED Requirements

### Requirement: worktree 前缀硬约定

** removal reason**:worktree 分支改用 `<type>/<slug>` 功能命名,身份识别由对账的路径识别与 state 登记接管,分支名前缀不再承担任何职责;`config.worktree_prefix` 随之退役(见 speccode-config-management delta)。

### Requirement: 分支拓扑三层结构

** removal reason**:feature 中间层退役,普通需求 trunk → worktree 分支直达;大需求的聚合点由「分支拓扑双层结构」(ADDED)中的 opt-in 集成分支承担。

## ADDED Requirements

### Requirement: 分支拓扑双层结构

speccode SHALL 管理双层分支拓扑:trunk 主干(默认 `config.trunk`,`speccode/` 文档在其上保持 tracked)与 `<type>/<slug>` 开发分支(worktree 分支,经 `git worktree add` 创建于 worktree_dir 之下)。大需求场景 SHALL opt-in 增加一条集成分支(同为 `<type>/<slug>` 命名,无 worktree,见「大需求父实体与集成分支」)。MUST NOT 存在 display 层分支与 `<branch>-complete` 临时分支。

#### Scenario: 普通需求直达 trunk
- **WHEN** 用户对普通需求执行 creating-worktree 与 finishing-worktree(PR 合并)
- **THEN** 全程 MUST NOT 创建集成分支,worktree 分支 MUST 基于 trunk HEAD

#### Scenario: 无 display 与 -complete 分支
- **WHEN** 检查 speccode 全流程创建的分支
- **THEN** MUST NOT 出现 display 分支或任何 `<branch>-complete` 分支

### Requirement: 大需求父实体与集成分支

`/speccode:creating-feature` 为大需求 opt-in 命令:MUST 创建 `<type>/<slug>` 集成分支(基于 trunk HEAD,无 worktree)与父实体 state(`kind: "integration"`),并把探索结论(slug=topic 命中)经 rename-memory 承接为该分支的记忆文件。子分支 MUST 经 `/speccode:creating-worktree` 从集成分支当前 head 切出,创建时 MUST 在父实体 `children` 清单登记 `{slug}`(纯身份,状态不存于父实体——唯一真源为各子分支 state,渲染与门禁实时派生)并把子分支 state 的 `merge_target` 写为集成分支名。creating-worktree 的父实体判定 MUST 消歧:0 个父实体 → 从 trunk 切(普通路径);恰好 1 个 → 打印检测结果并经用户确认;≥2 个 → AskUserQuestion 列父实体供选,直给完整分支名可跳过判定。子分支间的并行/串行 MUST NOT 引入依赖机制:并行兄弟从同一 head 切出,串行后序在先序合入集成后再切(切点即依赖);父实体 children 状态板 MUST 经 `/speccode:status` 聚合渲染(身份来自 children、状态派生自子 state),串并行由用户依状态板决策。

#### Scenario: 创建父实体
- **WHEN** 用户对大需求执行 creating-feature 并确认分支名 `feature/mkt-req`
- **THEN** 集成分支 MUST 基于 trunk HEAD 创建,父实体 state MUST 含 `kind: "integration"` 与空 `children` 清单,且 MUST NOT 创建 worktree

#### Scenario: 子分支登记与路由
- **WHEN** 用户在父实体场景下经 creating-worktree 创建子分支 `feature/mkt-req-list`
- **THEN** 子分支 MUST 从集成分支当前 head 切出,其 state `merge_target` MUST 为 `feature/mkt-req`,父实体 `children` MUST 新增 `{slug: "mkt-req-list"}`(不存状态)

#### Scenario: 状态派生渲染
- **WHEN** `/speccode:status` 渲染父实体 children 状态板
- **THEN** 各子分支的 status MUST 实时读取对应子分支 state 聚合;children 登记了 slug 但无对应子 state 时 MUST 渲染为 `pending`(计划未开工)

#### Scenario: 多父实体消歧
- **WHEN** state 中存在 ≥2 个 `kind: "integration"` 父实体,用户执行 creating-worktree 且未直给分支名
- **THEN** 命令 MUST 以 AskUserQuestion 列出父实体供选择;直给完整分支名时 MUST 跳过该判定

#### Scenario: 串行依赖由切点编码
- **WHEN** 子分支 p1 已本地 squash 合并进集成分支,用户随后创建 p3(依赖 p1)
- **THEN** p3 MUST 从集成分支当前 head 切出(含 p1 内容),系统 MUST NOT 要求任何依赖声明

### Requirement: trunk 保护 squash 合并

所有合并到 trunk 的变更 MUST 且 ONLY 能以 PR/MR(squash)形式进行;`finishing-worktree`(trunk 目标)与 `finishing-feature` MUST NOT 提供本地直接合并到 trunk 的路径。`pr_tool` 非 `none` 时,init 与 finishing-worktree 创建 PR 前 MUST 经工具 API 探测仓库 merge 设置(`allow_squash_merge` / `allow_merge_commit` / `allow_rebase_merge`);非 squash-only 时 MUST 打印警告并给出设置指引,警告 MUST NOT 阻断。`pr_tool: "none"` 时 MUST 打印等效 PR 创建命令并中止(沿用既有降级)。

#### Scenario: 非 squash-only 警告
- **WHEN** 探测到仓库 `allow_merge_commit: true`(存在非 squash 合并通道)
- **THEN** 命令 MUST 打印警告建议启用 squash-only,并继续建 PR(警告不阻断)

#### Scenario: squash-only 通过
- **WHEN** 探测到仓库仅允许 squash 合并
- **THEN** 命令 MUST 静默继续,不打印警告

#### Scenario: 子到集成不走 PR
- **WHEN** 子分支经 finishing-worktree 合并到集成分支
- **THEN** MUST 为本地 squash,MUST NOT 创建 PR

### Requirement: exploring 前置校验与形态确认

`/speccode:exploring` MUST 声明在 trunk 分支执行:HEAD 非 trunk 时 MUST 打印警告并提示切回,警告 MUST NOT 硬阻断(用户可能有意在分支上查看)。执行开始前 MUST 先 `fetch & pull` 保证 trunk 不落后远端;fetch 失败(如离线)MUST 仅警告不阻断。探索出口 MUST 做需求形态确认(三岔):agent 从探索内容找信号——决定性信号为「要么整体上线要么全不上线」的交付约束,反例信号为各部分可独立上线——形成建议:单普通需求 / 多个独立普通需求 / 大需求(集成,记录父 slug 与子需求清单);建议 MUST 经用户确认,MUST NOT 静默生效;确认结果 MUST 落档探索 topic,大需求场景 MUST 引导 `/speccode:creating-feature`。

#### Scenario: 非 trunk 警告不阻断
- **WHEN** 用户在非 trunk 分支上执行 exploring
- **THEN** 命令 MUST 打印警告提示切回 trunk,并继续探索流程

#### Scenario: fetch 失败不阻断
- **WHEN** 执行 `fetch & pull` 时网络不可达
- **THEN** 命令 MUST 打印警告并继续,MUST NOT 报错退出

#### Scenario: 形态确认三岔
- **WHEN** 探索结束,agent 依交付约束信号判定为大需求(整体上线)并经用户确认
- **THEN** 命令 MUST 把父 slug 与子需求清单写入探索 topic 并引导 `/speccode:creating-feature`;判定为可独立交付的多个部分时 MUST 引导逐个走普通流程,MUST NOT 建集成分支
