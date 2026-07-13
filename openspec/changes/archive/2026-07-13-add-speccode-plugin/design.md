## Context

speccode 是 Claude Code 的一个流程编排插件,目标用户是"在同一仓库内并行开发多个需求"的小团队或个人开发者。当前痛点:

1. **分支策略靠人工约定**:每个开发者各自决定从哪切、怎么合,容易出现"feature 直接合到 master 漏过 review"、"display 分支历史混乱"等问题
2. **spec 工具的文档归属无规可循**:OpenSpec 的 `openspec/` 目录、Superpowers 的 `docs/superpowers/` 目录,既不属于纯业务代码,又需要随开发流转,放在哪、什么时候跟踪、什么时候剥离,全是隐式约定
3. **PR/MR 流程不统一**:有人用 `gh`,有人用 `glab`,有人本地 `git merge --squash`,没法形成可复盘的合并历史
4. **多 worktree 并行开发的状态容易丢**:`git worktree` 本身不维护"哪些 worktree 属于哪个 feature"的关系,靠开发者记忆

本仓库当前状态:刚完成 `git init`,已有 `.claude/commands/opsx/` 和 `.claude/skills/openspec-*/` 等流程命令与 skill 集合,但 speccode 尚未存在,OpenSpec 规范已就位(proposal 阶段已有一次 archive 流程示例可参考)。

## Goals / Non-Goals

**Goals:**

- 暴露 10 个 `/speccode:*` slash 命令,覆盖 init → start → develop-start → develop-complete → finish 的完整工作流,`status` 状态总览,以及 display 与 trunk 的三种同步方式
- 把"spec 文档在 display / feature 跟踪、在 trunk 不跟踪"这条约定固化为可执行原语,杜绝误删与误推
- 自动探测 GitHub / GitLab remote,选用 `gh` / `glab` CLI,无可用 CLI 时降级为"打印等效命令"
- 在所有涉及 worktree 的命令(`develop-start` / `develop-complete` / `finish` / `status`)入口引入"config ↔ git"对账算法,容忍用户手动操作 git 后的状态漂移,并自动推进 `pr_open` 的 worktree
- 写入策略采用"临时文件 + mv 覆盖",避免异常退出导致半写半旧
- 长阻塞操作(等 PR 合并)超时或中断时,把挂起状态写入 feature 的 `pending_operation` 字段,`--resume` 从该字段恢复

**Non-Goals:**

- 不实现远程代码托管平台的具体 API 集成(用 `gh` / `glab` CLI 即可,不需要自己调 GitHub/GitLab REST API)
- 不实现 CI/CD 集成(用户接入 CI 是项目级配置,不归 speccode 管)
- 不实现 git 本身的 hook(`commit-msg` / `pre-push` 等)—— speccode 是命令式插件,不修改用户 git config
- 不在 `.gitignore` 中加入任何 speccode 路径(决策 1:插件与 git 原生机制解耦,所有跟踪管理走显式命令)
- 不实现跨仓库的协调(单仓多开发者通过 PR/MR 协调,不需要 speccode 介入)
- 不实现自动 commit message 模板生成(用户自己写 commit message,speccode 只在 squash 时聚合)

## Decisions

### D1 — 10 个命令拆分为"配置 / 启动 / 开发 / 收尾 / 总览 / display 同步 / 核弹"七个职责组

**为何这样拆:** 比起把所有操作塞进一两个命令(如 `speccode start-all`、`speccode ship`),按职责分组后,每个命令的输入输出更确定,AI 模型的实现复杂度更低,也更容易让用户记忆。`status` 作为纯只读的总览命令,是并行开发场景的仪表盘。

**备选方案:** 单命令 `speccode ship` 一次跑完全部流程——否决,因 finish 涉及"等 PR 合并"等长阻塞,单命令无法表达"分阶段恢复"的语义。

### D2 — 静态配置与动态状态分离,按 feature 维度拆分状态文件

**为何这样拆:**
- `config.json` 只在 init 改,变更高频低;state 在每次 develop-* 改,变更高频高。两者读写特性不同,分开降低冲突概率。
- 多个 active feature 并行时,各写各的文件,无锁可写。
- 写异常退出时,只有那个 feature 的 state 文件可能损坏,不影响其他 feature。

**结构:**
```
.speccode/
├── config.json                # 静态(只在 init/reset 改)
├── state/features/<f>.json    # 动态,按 feature 维度隔离
└── backup/                    # display-reset 的本地安全区
```

**备选方案 A:** 单 config.json 包含 sessions 数组——否决,并发写同一文件即使无锁也容易覆盖,不符合"写异常退出后由对账兜底"的目标。

**备选方案 B:** 写时锁(flock)——否决,AI 进程异常退出可能遗留锁文件,反而更难处理。

### D3 — 文档剥离走"git rm --cached + amend"二步走(在 -complete 分支上)

**为何这样:**
- `git rm -r --cached` 不删本地文件,只取消跟踪——满足"本地文件保留"需求
- `git commit --amend` 把"untrack 文档"这一步折叠进最近的功能 commit,trunk 上看到的是"单一语义功能 commit",不是"功能+剥离"两次 commit
- 在 `<feature>-complete` 临时分支上做,不改写 feature 分支历史(display PR 仍基于原 feature 提交)

**已知风险:** amend 改写 -complete 分支的 commit hash,触发 PR review 工具的 force-push 警告——可接受,因为这是"交付前最后一次整理",跟"开发者自己 squash 前几个 WIP commit"性质相同。

**备选方案:** 不 amend,新增独立的"剥离文档" commit——否决,trunk 上两次 commit 语义不清晰,且对 `git blame` 不友好。

### D4 — display-reset 走"备份 + untrack commit + reset --hard + retrack commit"四步走

**为何不直接 reset:** 文档目录在 display 是 tracked,`git reset --hard origin/trunk` 会**连同 tracked 文档一起删掉**——这是用户无法接受的(可能丢失几个月生成的 spec 历史)。untrack 之后,reset 不影响本地文件,然后再 retrack 恢复分支特性。

**为何需要 backup:** 即使做了 untrack,极端情况(用户在 reset 之间手动 `rm -rf`)仍可能丢——本地安全区作为最后一层兜底。

**备选方案 A:** 用 `cp -r` 临时备份到 /tmp,reset 后再 cp 回来——否决,/tmp 不可靠(可能被系统清理),放 `.speccode/backup/` 更可控。

**备选方案 B:** 用 `git restore` 路径选择——否决,`git reset --hard` 不支持路径限定。

### D5 — 对账算法用 ancestor 关系 + worktree_overrides 显式覆盖

**为何 ancestor 判定:** worktree 分支从 feature 切出,默认是 feature 的后代,`git merge-base --is-ancestor` 是天然的归属判定;不需要 speccode 在创建 worktree 时显式登记"父 feature"。

**为何需要 override:** 边缘 case(cherry-pick 跨 feature、worktree 改名)会让 ancestor 判定不准;`worktree_overrides` 字段给用户显式修正能力。

**边缘 case:** 同一 W 同时是多个 feature 的祖先——对账报错退出,让用户手选(不自动决断,避免误关联)。

### D6 — PR/MR 用 `gh` / `glab` CLI 探测,init 时一次性写入 config

**为何 init 时探测:** 命令运行时再探测(每次都 `command -v gh`)有性能开销且结果不可控;一次探测写入 config,后续命令直接读,确定性更高。

**降级策略:** pr_tool=none 时 finish / develop-complete 不实际创建 PR,而是打印等效命令让用户手动执行,避免功能硬性要求外部 CLI。

### D7 — finish 完成后 HEAD 切回 display(trunk),不删 feature 分支

**为何切回 display:** 用户大概率会继续开下一个 feature,留在已交付的 feature 分支是反直觉的。

**为何不删 feature 分支:** "speccode 不主动删 git 分支"是核心原则之一(与决策 D2 "插件与 git 解耦" 一致);feature 分支作为历史保留,用户需要时自行 `git branch -D` 或 `git push origin :<branch>`。

### D8 — reset 拒绝有 active_features 的情况,不接受 --force

**为何不强制:** 强制绕过会导致 worktree 残留、state 损坏,且无法保证对账算法能在下次 develop-* 时恢复。强约束是产品决策:有未完成功能时,正确路径是 finish,不是 reset。

### D9 — 写文件用"临时文件 + mv 覆盖"原子策略

**为何不用单次 write:** 单次 write 中途异常(进程被 kill、磁盘满)会留下半写文件;`mv` 是 POSIX 原子操作,只有写完才会被看到。

**残余风险:** mv 之前的 `cp` 阶段崩了,临时文件留下,但 config.json 还是旧的——这是可接受的"上一次正确状态",比"半写状态"好得多。

### D10 — 全部命令通过 `.claude/commands/speccode/` markdown 文件定义

**为何用 markdown 文件:** Claude Code 的 slash command 原生支持 markdown frontmatter 格式,无需额外打包;`opsx` 命名空间已经验证该模式可行(参考 `.claude/commands/opsx/*.md`)。

**命令文件结构:**
```
.claude/commands/speccode/
├── init.md
├── start.md
├── develop-start.md
├── develop-complete.md
├── finish.md
├── status.md
├── display-merge-trunk.md
├── display-rebase-trunk.md
├── display-reset-to-trunk.md
└── reset.md
```

### D11 — `--resume` 挂起状态写进 feature 的 state 文件(`pending_operation` 字段)

**为何这样:** 长阻塞操作(`wait_for_pr_merge`)超时或被用户 Ctrl+C 中断后,需要一个"从哪继续"的载体。把它写进对应 feature 的 `state/features/<type>__<slug>.json` 的 `pending_operation` 字段:
```json
"pending_operation": {
  "command": "finish",
  "phase": "waiting_display_pr" | "waiting_trunk_pr" | "waiting_worktree_pr",
  "pr_number": 42,
  "complete_branch": "feature/payment-complete",
  "updated_at": "2026-07-08T..."
}
```

**为何绑定 feature 维度:** 与 D2"状态按 feature 隔离"一致。挂起状态天然随 feature 走,`reset` 清 state、`finish` 成功后删 state 文件时一并清掉,不留垃圾。

**备选方案 A:** 独立 `state/pending/<feature>.json`——否决,多一个要对账的实体。

**备选方案 B:** 无状态,`--resume` 靠现场推导(查 `-complete` 分支是否存在、重查 PR)——否决,PR 编号丢失后无法定位,推导逻辑复杂。

### D12 — worktree 引入 `pr_open` 中间状态

**为何需要:** `develop-complete` 的"PR 但不等待"(路径 2)创建 PR 后立即返回,worktree 成果尚未合入 feature。此时既不能标 `completed`(说谎,PR 可能被拒),也不能停在 `in_progress`(丢失"PR 已开"信息)。引入 `pr_open`,并在 worktree 条目记 `pr_number`。

**状态枚举:** `pending | in_progress | pr_open | completed`。

**自动推进:** 对账(在 `develop-*` / `finish` / `status` 入口)遇到 `pr_open` 的 worktree,查询其 PR:MERGED → 推进 `completed` 并清理 worktree;仍 open → 保持;CLOSED → 回退 `in_progress` 并提示。

**finish 门禁:** finish 遇到任何 `pr_open` 或 `in_progress` / `pending` 的 worktree 都阻止,提示用户先完成。

### D13 — finish 两个 PR 都阻塞等合并;trunk PR 合并后回收 `-complete`

**为何两个都等:** finish 路径 A 的顺序是"PR→display 合并 → 基于 display 的 merge commit 建 `-complete` → 剥离 amend → PR→trunk 合并"。第一个 PR 必须先合并,`-complete` 才能基于 display 的最新 commit;第二个 PR 合并才算功能真正落到 trunk。任一超时 → 写 `pending_operation`(D11),`--resume` 续跑。

**为何回收 `-complete`:** `<feature>-complete` 是 speccode 自己创建的临时分支,不是用户分支。trunk PR 合并后它已无用,由 speccode 删除(本地 + 远端)。这不违反 D7"不删用户分支"原则——D7 保护的是用户创建的 feature 分支,`-complete` 是插件内部产物。

**feature 分支:** 仍不删(D7),作为历史 + 无 display 模式下文档的 git 留存点。

### D14 — slug 字符集与 state 文件名规则

**规则:** 功能分支名 MUST 形如 `<type>/<slug>`,恰好一个 `/`;`type ∈ {feature, bugfix, refactor, chore}`;`slug` 只允许 `[a-z0-9-]`。state 文件名用 `<type>__<slug>.json`(双下划线分隔 type 与 slug)。

**为何双下划线:** slug 不含下划线,故 `__` 是无歧义分隔符;避免 `feature/pay-ment` 与假想的 `feature-pay/ment` 映射到同一文件名而互相覆盖(这正是并行开发要避免的状态冲突)。

**为何文件名不需可逆:** 文件内容已有 `feature_branch` 全名字段,读取以内容为准;文件名只需唯一 + 可读。`start` 校验 slug 合法性,非法则拒绝并提示。

### D15 — 文档在 feature 分支上统一 tracked

**为何统一:** 无论 feature 从 display 切(继承 tracked)还是从 trunk 切(继承 untracked),都让 feature 分支上的 spec 文档最终为 tracked。这样:(a) finish 剥离逻辑对两种模式统一(总有东西可剥);(b) 无 display 模式下,文档随 feature 分支(D7 不删)在 git 中留存,不再"纯本地、一 clean 就丢"。

**谁负责 git add:** speccode 不主动替用户提交(尊重"插件不越权")。正常流程里用户/AI 在 worktree 里生成文档后会自然 commit,`develop-complete` squash 时文档进入 feature。finish 开头对账后**检查**:若工作区存在启用工具的文档目录却未 tracked → 警告用户"检测到未纳入 git 的 spec 文档,finish 后将不会留存,是否先提交?"。

### D16 — worktree 目录默认 `.claude/worktrees/<branch>`

**为何:** 与 superpowers 的 `using-git-worktrees` 习惯一致(用户机器上已有该结构),降低认知负担。`develop-start` 询问路径,允许用户覆盖默认值。虽然 worktree 嵌套在仓库目录内,但 `.claude/` 已是 untracked,不会被 git 误扫为待提交内容。

## Risks / Trade-offs

- **R1 — amend 折叠剥离 commit 改写 -complete commit hash** → 缓解: -complete 是临时分支,只在 finish 阶段存在,改写它不影响任何 PR review 流程(display PR 仍基于 feature 原 commit)。在 design 与命令文档中明确说明。
- **R2 — ancestor 判定在 cherry-pick 跨 feature 时误判** → 缓解:`worktree_overrides` 字段显式覆盖,文档化作为"高级用户兜底"。
- **R3 — init 逐字段幂等时用户误改字段** → 缓解:每个字段确认问题 MUST 显示 `[旧值]→[新值]` diff,且在用户选择"改用新值"前不写入。
- **R4 — `.speccode/` 不在 .gitignore,`git clean -fdx` 会丢配置** → 缓解:在 init 提示与 README 中明确警告;不在命令层面强制保护(决策 D10 的延伸)。后续若需要,可加 `state/reconcile_log.json` 记录"上次对账时的目录 mtime",对账时检测 mtime 变化并提示用户恢复——但这是后续增强,不在本次 change 范围。
- **R5 — 阻塞等 PR 合并默认 30 分钟超时,长 PR 可能不够** → 缓解:超时是软限制,`--resume` 允许用户后续续跑。在 spec 中已显式说明。
- **R6 — worktree 路径默认 `.claude/worktrees/<branch>`,嵌套在仓库目录内** → 缓解:`.claude/` 已是 untracked,git 不会误扫;`develop-start` 询问路径允许覆盖默认值。见 D16。
- **R7 — `.speccode/backup/` 不断增长** → 缓解:`display-reset-to-trunk` 完成后 MUST 询问用户是否清理,`reset` 不主动清理(用户可能想留后悔药)。
- **R8 — 跨平台(Windows / macOS / Linux)路径与命令差异** → 缓解:本次实现以 macOS / Linux 为主,Windows 支持不在 Goals 内;命令实现时尽量用 `git` / `gh` / `glab` 自身的跨平台行为,不在 shell 层做平台判断。
- **R9 — `pr_open` 的 worktree 依赖对账推进** → 缓解:`develop-*` / `finish` / `status` 入口都跑对账,任一命令都会把已合并的 `pr_open` 推进为 `completed`;若用户 PR 合并后从不再跑任何 speccode 命令,状态不会自动更新(可接受,`status` 是显式查询入口)。
- **R10 — finish 两个 PR 串行阻塞,总耗时可能较长** → 缓解:每个 PR 超时(默认 30 分钟)由 `pending_operation`(D11)+ `--resume` 兜底,不会永久卡住;两 PR 串行是顺序正确性的必要代价(`-complete` 必须基于 display 合并后的 commit)。

## Migration Plan

speccode 是新增插件,不存在迁移负担。`/speccode:init` 是入口,首次执行创建 `.speccode/` 目录与 `config.json`。如果仓库已存在 .speccode 目录,init 走"二次 init 流程",不破坏现有数据。

回滚:删除 `.claude/commands/speccode/` 与 `.speccode/` 即可,不影响仓库其他内容。

## Open Questions

- **OQ1(已定案):** worktree 路径默认 `.claude/worktrees/<branch>`(与 superpowers 习惯一致),`develop-start` 询问可覆盖。见 D16。
- **OQ2:** "spec 工具 doc_dir 默认值"的检查——openspec 默认 `openspec/`,superpowers 默认 `docs/superpowers/`,但用户的现有仓库可能用 `docs/specs/` 等非默认路径。init 时只问 doc_dir,不主动扫描,可能漏过现有目录。后续可加入"init 扫描常见目录并建议"作为增强。
- **OQ3(已定案):** `wait_for_pr_merge` 轮询间隔 30 秒,默认 30 分钟超时(≈60 次查询);`--resume` 续跑用同一间隔。超时软限制,`pending_operation` + `--resume` 兜底。
- **OQ4:** 跨平台 Windows 支持未在本次 change 范围,但 slash command 的 markdown 描述是否需要标注"仅 macOS / Linux"以免误用?倾向在 README 中标注,不在每个命令文件重复。
