# speccode

## 1. speccode 是什么

speccode 是一个 Claude Code 流程编排插件,用一套固定的 `/speccode:*` slash 命令把"分支策略 + spec 文档归属 + PR/MR 流程 + worktree 状态"这些原本靠人工约定的环节固化为可执行原语。

**适用场景**:在同一仓库内**并行开发多个需求**的小团队或个人开发者——当你需要同时跑几个 feature、每个 feature 下再拆多个 worktree 并行施工,又不想在"文档要不要跟踪""该用哪个分支切""PR 谁来开"这些问题上反复纠结时,speccode 提供了一条端到端的默认路径。

## 2. 10 个命令快速参考表

| 命令 | 作用 | 前置(运行分支) |
|---|---|---|
| `/speccode:init` | 初始化/更新 speccode 开发环境:探测远端、主干、标的分支(display)、spec 工具,写 `.speccode/config.json` | 任意分支(首次通常在 trunk) |
| `/speccode:start` | 从初始分支(display 优先,否则 trunk)切出功能分支并推送,登记 state | display(若启用)或 trunk |
| `/speccode:develop-start` | 从功能分支切出 worktree 开发分支(`git worktree`),登记 state | feature / bugfix / refactor / chore 分支 |
| `/speccode:develop-complete` | 把 worktree 成果合并回功能分支(PR 等待 / PR 不等待 / 本地 squash),更新 state | worktree-* 分支 |
| `/speccode:finish` | 收尾整个功能:PR→display(等合并)→ 剥离文档 → PR→trunk(等合并)→ 回收 `-complete` → 切回 display | 功能分支 |
| `/speccode:status` | 只读总览:所有 active feature 的 worktree 进度、`pending_operation`、config 摘要 | 任意分支 |
| `/speccode:display-merge-trunk` | 把主干代码 merge 到标的分支 display | display 分支 |
| `/speccode:display-rebase-trunk` | 把标的分支 display 变基到主干 | display 分支 |
| `/speccode:display-reset-to-trunk` | 把 display 硬重置到主干,四步走保护 spec 文档不丢 | display 分支 |
| `/speccode:reset` | 重置 speccode 开发环境:清 state 与 worktree,按字段询问是否清理 config(拒绝有 active feature 时执行) | 任意分支,且不能有 active feature |

## 3. 分支拓扑图

speccode 管理 trunk / display / feature / worktree 四层结构,外加 finish 阶段产生的临时 `<feature>-complete` 分支:

```
origin/<trunk> (主干,无 spec 文档,untracked)
   │
   │  /speccode:init 首次建立 display(可选)
   ▼
<display>  (= 主干 + spec 文档 tracked,可选的"标的分支")
   │
   │  /speccode:start (从 display 优先,否则从 trunk 切)
   ▼
feature/<slug>  (功能分支,spec 文档统一 tracked)
   │
   │  /speccode:develop-start (可反复切多个并行 worktree)
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
worktree-a     worktree-b     worktree-c
   │              │              │
   └── develop-complete (PR 或本地 squash) 合并回 feature ──┘
   │
   │  /speccode:finish
   ▼
<feature>-complete  (临时分支:基于 display 合并后的 commit 创建,
                      剥离 spec 文档并 amend 折叠,PR→trunk 后即回收删除)
   │
   ▼
origin/<trunk>  (功能最终落地,-complete 分支删除,feature 分支保留作历史)
```

要点:
- **trunk**:主干分支(默认 `master`),spec 文档 untracked。
- **display**:标的分支(=主干 + spec 文档 tracked),可选;作为 feature 的初始切出点。
- **feature/bugfix/refactor/chore/\<slug\>**:功能分支,从 initial 分支(display 优先,否则 trunk)切出;spec 文档最终统一为 tracked。
- **worktree-\<suffix\>**:开发分支,硬前缀 `worktree-`,从 feature 切出,通过 `git worktree add` 创建,多个可并行。
- **`<feature>-complete`**:speccode 内部产物,只在 finish 阶段短暂存在,trunk PR 合并后自动回收(本地 + 远端),不是用户分支。

## 4. `.speccode/` 目录结构

```
.speccode/
├── config.json                       # 静态配置,只在 init / reset 改
├── state/features/<type>__<slug>.json  # 动态状态,按 feature 维度隔离
└── backup/                           # display-reset-to-trunk 的本地安全区
```

- **`config.json`**:全局静态配置,包含 `trunk`、`remote`、`display`、`pr_tool`、`spec_tools`、`untracked_permanent`、`worktree_prefix` 等字段。只在 `/speccode:init`(首次或二次幂等)与 `/speccode:reset` 写入,变更频率低。写入前 MUST 先生成 `config.json.bak.<timestamp>` 备份。
- **`state/features/`**:每个 active feature 一个独立文件(`<type>__<slug>.json`,双下划线分隔 type 与 slug),记录该 feature 的 worktree 进度(`pending | in_progress | pr_open | completed`)与挂起的 `pending_operation`(供 `--resume` 续跑)。多 feature 并行时各写各的文件,无需加锁;单个文件写坏也不影响其他 feature。
- **`backup/`**:`display-reset-to-trunk` 在硬重置前把 spec 文档目录复制到这里(如 `backup/display-reset-<timestamp>/`),作为"即使 untrack 之后又被意外删除"场景的最后一层兜底。整个 reset 流程完成后会询问用户是否清理该次备份;`reset` 命令本身不主动清理历史备份。

所有对 `config.json` 与 `state/features/*.json` 的写入均采用"写临时文件 + `mv` 覆盖"的原子策略,避免进程被中断导致半写状态。

## 5. 风险与缓解(R1-R10)

- **R1 — amend 折叠剥离 commit 改写 `-complete` 的 commit hash** → 缓解:`-complete` 是临时分支,只在 finish 阶段存在,改写它不影响任何 PR review 流程(display PR 仍基于 feature 原 commit)。
- **R2 — ancestor 判定在 cherry-pick 跨 feature 场景下会误判** → 缓解:`worktree_overrides` 字段显式覆盖,作为"高级用户兜底"。
- **R3 — init 逐字段幂等时用户可能误改 trunk/display 等字段** → 缓解:每个字段确认时 MUST 显示 `[旧值] → [新值]` diff,且只有用户选择"改用新值"后才写入。
- **R4 — `.speccode/` 不在 `.gitignore`,`git clean -fdx` 会丢配置** → 缓解:在 init 提示与本 README 中明确警告;不在命令层面强制保护(与"插件不改 `.gitignore`、不越权改写用户 git 机制"的原则一致)。见第 8 节的重要警告。
- **R5 — 阻塞等 PR 合并默认 30 分钟超时,长 PR review 可能不够** → 缓解:超时是软限制,`--resume` 允许用户后续续跑,不会永久卡死命令。
- **R6 — worktree 路径默认 `.claude/worktrees/<branch>`,嵌套在仓库目录内** → 缓解:`.claude/` 本身已是 untracked,git 不会误扫为待提交内容;`develop-start` 询问路径时允许覆盖默认值。
- **R7 — `.speccode/backup/` 不断增长** → 缓解:`display-reset-to-trunk` 完成后 MUST 询问用户是否清理本次备份;`reset` 不主动清理历史备份(用户可能想留"后悔药")。
- **R8 — 跨平台(Windows / macOS / Linux)路径与命令差异** → 缓解:本次实现以 macOS / Linux 为主,Windows 支持不在目标范围内;命令实现尽量依赖 `git` / `gh` / `glab` 自身的跨平台行为,不在 shell 层做平台判断。
- **R9 — `pr_open` 的 worktree 依赖对账推进** → 缓解:`develop-start` / `develop-complete` / `finish` / `status` 入口都会跑对账,任一命令执行都会把已合并的 `pr_open` worktree 推进为 `completed`;若用户合并 PR 后从不再跑任何 speccode 命令,状态不会自动更新——可接受,`status` 是显式查询入口,随时可手动触发。
- **R10 — finish 两个 PR(→display、→trunk)串行阻塞,总耗时可能较长** → 缓解:每个 PR 的超时(默认 30 分钟)由 `pending_operation` + `--resume` 兜底,不会永久卡住;两个 PR 必须串行是顺序正确性的必要代价(`<feature>-complete` 必须基于 display 合并后的 commit 创建,不能提前)。

## 6. 未解决问题

- **OQ2 — spec 工具 `doc_dir` 非默认路径不主动扫描**:openspec 默认 `openspec/`,superpowers 默认 `docs/superpowers/`,但用户的现有仓库可能已经使用 `docs/specs/` 等非默认路径存放文档。`/speccode:init` 目前只是"询问 doc_dir",不会主动扫描工作区常见目录并给出建议,存在漏配的可能。后续可以增强为"init 时扫描常见目录并提示",但不在当前范围内。
- **OQ4 — Windows 未支持**:当前实现只覆盖 macOS / Linux,不处理 Windows 路径分隔符、shell 差异等问题(见 R8)。是否需要在每个命令文件里重复标注"仅 macOS / Linux",还是只在本 README 统一说明——目前倾向于只在 README(本节 + 第 7 节)集中说明,不在每个命令 markdown 文件里重复。

## 7. 跨平台说明

- speccode 目前**仅支持 macOS / Linux**,不支持 Windows(见 R8、OQ4)。
- 依赖:
  - `git`(核心,worktree / merge / rebase / reset 等全部操作基于 git)
  - `gh` CLI(GitHub remote)或 `glab` CLI(GitLab remote)—— 用于创建/查询 PR/MR;未安装时 `pr_tool` 自动降级为 `none`,命令会打印等效命令供用户手动执行,不会因缺少 CLI 而失败。
  - Node.js **≥ 24**(`plugins/speccode/bin/speccode.mjs` 与 `lib/` 下的引擎代码运行在 Node 之上)

## 8. ⚠ 重要警告

`.speccode/` 目录在用户项目中**不会被 git 跟踪,也不会被加入 `.gitignore`**——这是插件的显式设计决策(D10 的延伸:speccode 与 git 原生机制解耦,所有跟踪管理都走显式命令,不代用户修改 `.gitignore`)。

**这意味着**:如果你在该仓库执行 `git clean -fdx`,`.speccode/config.json`、`state/features/*.json`、`backup/` 全部会被当作"未跟踪文件"一并删除,直接丢失当前的 speccode 配置与所有 active feature 的进度状态(对应风险 R4)。

**建议**:
- 执行 `git clean` 系列命令前,先确认 `-x`(清理 ignored/untracked 全部文件)是否真的需要包含 `.speccode/`;必要时用 `git clean -fd`(不带 `-x`)或显式排除路径。
- 定期关注 `.speccode/backup/` 下的备份,但不要把它当作唯一的恢复手段——它只覆盖 `display-reset-to-trunk` 场景的 spec 文档,不覆盖整个 `.speccode/` 目录。
- 如果确实丢失了 `config.json`,重新执行 `/speccode:init` 即可重建;`state/features/*.json` 丢失后对应 feature 的进度信息无法恢复,需要凭对账(`reconcile`)结合当前 git 实际状态重新登记。
