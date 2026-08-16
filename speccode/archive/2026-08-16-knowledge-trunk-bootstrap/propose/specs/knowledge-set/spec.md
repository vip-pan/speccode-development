## ADDED Requirements

### Requirement: 知识维护分支与直通 PR

distilling-knowledge 与 recording-knowledge MUST 从 trunk 运行(trunk 为唯一入口):MUST NOT 在 `worktree-` 前缀分支,或 `feature/`/`bugfix/`/`refactor/` 功能分支,或**不匹配 `chore/knowledge-` 的** `chore/` 功能分支上执行,违反时 MUST 提示用户切回 trunk 后退出。`chore/knowledge-*` 维护分支是本命令自身 bootstrap 出的分支,MUST 放行(续跑,见下)。

从 trunk 运行时,命令 MUST 经 AskUserQuestion 确认一个 `chore/knowledge-*` 维护分支名(默认:distilling 用 `chore/knowledge-distill`,recording 用 `chore/knowledge-<topic>`),随后 `git checkout -b <分支>` 并 `push -u`。该流程 MUST NOT 创建 speccode feature state、MUST NOT 运行 reconcile、MUST NOT 开 git worktree。若 HEAD 已在 `chore/knowledge-*` 分支(续跑)→ MUST 跳过 bootstrap 直接进入执行。若 trunk 上已存在未完成(未合入 `config.trunk`)的 `chore/knowledge-*` 分支 → MUST 经 AskUserQuestion 询问「续跑(切到既有分支)/新建」。任何续跑路径 MUST 先经 `feature-progress` 确认该分支未被登记为 speccode feature state;已登记(名字恰好撞上 `chore/knowledge-*` 的功能分支)→ MUST 拒绝并提示回 trunk 另建维护分支。

落盘 commit 后 MUST 直接经 `prtool.createPrArgs` 创建 PR(base=`config.trunk`,head=维护分支);创建前 MUST 先查该维护分支上是否已有 open PR,已有则 MUST 跳过创建、直接复用并报告既有 PR url。`pr_tool` 为 none 时 MUST 打印等效命令(如 `gh pr create --base <trunk> --head <分支> --title ...`)并中止,且 MUST NOT 创建 speccode state 或经 finishing-feature。该 PR 流程 MUST NOT 阻塞等待合并、MUST NOT 调用 finishing-feature 或 finishing-worktree。

维护摘要(topic 变化/新增/无变化 + PR url)MUST 在 PR 创建(或 `pr_tool=none` 打印等效命令)之后追加到 trunk 级 `.speccode/memory/_knowledge.md`(见 session-memory「memory 文件位置与命名」),内容 MUST 含 PR url(或等效命令),MUST NOT 写 feature 级 memory。

#### Scenario: trunk 首次 bootstrap

- WHEN 用户在 trunk 运行 distilling-knowledge,无未完成 chore/knowledge-* 分支
- THEN 命令经 AskUserQuestion 确认分支名(默认 chore/knowledge-distill),git checkout -b + push,无 state/reconcile/worktree,随后进入蒸馏执行

#### Scenario: 续跑既有分支

- WHEN HEAD 已在 chore/knowledge-* 分支
- THEN 经 feature-progress 确认无 feature state 后跳过 bootstrap,直接进入执行,不重复创建分支
- AND feature-progress 返回 ok:true(该分支是已登记功能分支)时拒绝执行并提示回 trunk 另建维护分支

#### Scenario: 检测到未完成分支询问续跑

- WHEN 在 trunk 运行,已存在未完成的 chore/knowledge-* 分支
- THEN AskUserQuestion 询问续跑(切既有)/新建;续跑则 checkout 既有分支,新建则另起分支名

#### Scenario: 在 worktree/feature 分支运行被拒

- WHEN HEAD 为 worktree-* 或功能分支(feature/bugfix/refactor,或不匹配 `chore/knowledge-` 的 chore/ 功能分支)
- THEN 提示切回 trunk 并退出,不执行任何写入
- AND HEAD 为 `chore/knowledge-*` 且该分支未被登记为 feature state 时不受本条拒绝(视为维护分支续跑)

#### Scenario: pr_tool=none 打印等效命令

- WHEN config.pr_tool 为 none
- THEN 落盘 commit 后打印完整等效 PR 命令与分支名并中止 PR 创建,不创建 state、不调 finishing-feature
- AND 仍把维护摘要(含该等效命令与分支名)追加到 _knowledge memory 后报告

#### Scenario: 维护摘要写 _knowledge memory

- WHEN 落盘并创建(或复用)PR 后
- THEN 含 PR url 的维护摘要追加到 .speccode/memory/_knowledge.md,不写 feature memory
