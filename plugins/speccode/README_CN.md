# speccode

[English](README.md) | [简体中文](README_CN.md)

> 用户门面(安装 / Quickstart / 对比定位)见根 README_CN.md;本文档是插件设计文档。

## 1. speccode 是什么

speccode 是一个 Claude Code 流程编排插件,用 23 个 `/speccode:*` slash 命令把「多需求并行开发 + spec 文档托管 + PR/MR 流程标准化」这些原本靠人工约定的环节固化为可执行原语。

**适用场景**:在同一仓库内**并行开发多个需求**的小团队或个人开发者——当你需要同时跑几个 feature、每个 feature 下再拆多个 worktree 并行施工,又不想在「文档放哪」「该从哪个分支切」「PR 谁来开」这些问题上反复纠结时,speccode 提供了一条端到端的默认路径。

**0.2 起**,speccode 内置了完整的 SDD 方法论(探索 → 文档 → 计划 → 子代理执行 → 评审 → 收尾)与 hooks / memory 能力;分支拓扑从四层精简为**三层**(trunk / feature / worktree)。方法论部分移植自 superpowers(v6.2.0)并自包含在插件内,目标项目**零外部依赖**。

## 依赖与前置要求(适用于全文档)

- `git`(核心:worktree / merge / rebase 等全部操作基于 git)
- `gh` CLI(GitHub remote)或 `glab` CLI(GitLab remote)——用于创建/查询 PR/MR;未安装时 `pr_tool` 自动降级为 `none`,命令会打印等效命令供用户手动执行,不会因缺少 CLI 而失败
- Node.js **≥ 24**(引擎运行在 Node 之上;纯 ESM、零第三方依赖)

## 目录

1. [speccode 是什么](#1-speccode-是什么)
2. [23 个命令快速参考表](#2-23-个命令快速参考表)
3. [三层分支拓扑图](#3-三层分支拓扑图)
4. [开发流程](#4-开发流程)
5. [文档目录](#5-文档目录)
6. [`.speccode/` 目录结构](#6-speccode-目录结构)
7. [hooks](#7-hooks)
8. [memory](#8-memory)
9. [代码智能工具](#9-代码智能工具)
10. [风险与缓解(R1–R13)](#10-风险与缓解r1r13)
11. [从 0.1 迁移](#11-从-01-迁移)
12. [理念](#12-理念)
13. [未解决问题](#13-未解决问题)
14. [⚠ 重要警告](#14-⚠-重要警告)

## 2. 23 个命令快速参考表

生命周期:

| 命令 | 作用 | 前置(运行分支) |
|---|---|---|
| `/speccode:init` | 初始化/更新:探测远端、主干、代码智能工具,配置 worktree 目录与 hooks,写 `.speccode/config.json`(config 0.2) | 任意分支(首次通常在 trunk) |
| `/speccode:exploring` | 探索需求(不产文档,结论在会话上下文;代码智能工具优先) | trunk |
| `/speccode:creating-feature` | 从 trunk 切出功能分支并推送,登记 state,建 memory 骨架 | trunk |
| `/speccode:creating-worktree` | 从功能分支切出 worktree(worktree_dir 可配置、check-ignore 校验、项目 setup、基线测试) | feature/bugfix/refactor/chore 分支 |
| `/speccode:finishing-worktree` | 合并 worktree 成果回功能分支(测试门禁;PR 等待/PR 不等待/本地 squash/保留;丢弃需逐字 discard) | worktree-* 分支 |
| `/speccode:finishing-feature` | 收尾整个功能:单 PR → trunk(阻塞等合并)→ 删 state → 切回 trunk | 功能分支 |
| `/speccode:status` | 只读总览:所有 active feature 的 worktree 进度、pending_operation、config 摘要 | 任意分支 |
| `/speccode:reset` | 重置环境:清 state 与 worktree,按字段询问清理 config,询问清理 memory//sdd//brainstorm/(拒绝有 active feature 时执行) | 任意分支,且不能有 active feature |

文档流(均落盘即提交):

| 命令 | 作用 | 前置(运行分支) |
|---|---|---|
| `/speccode:proposing` | 落地 proposal/design/specs/tasks 四类文档到 `speccode/changes/<slug>/propose/`;复杂度评估建议 brainstorming | worktree-* 分支 |
| `/speccode:brainstorming` | 苏格拉底式设计精化,设计落 `brainstorm/` 并回写 propose/ 保持一致 | worktree-* 分支 |
| `/speccode:writing-plans` | 详细实现计划(brainstorm/ 优先,propose/ 兜底),落 `plan/` | worktree-* 分支 |
| `/speccode:syncing` | 增量变更合并进 `speccode/spec/` 主规格(brainstorm 残余吸收,幂等) | worktree-* 分支 |
| `/speccode:archiving` | 归档:changes/<slug>/ 移入 `speccode/archive/<YYYY-MM-DD>-<slug>/` | worktree-* 分支 |

知识:

| 命令 | 作用 | 前置(运行分支) |
|---|---|---|
| `/speccode:distilling-knowledge` | 从 spec/(全量)+ archive/(**增量**:只读未消费归档包,经 `knowledge/_distilled.meta.json` 追踪;已消费包整包跳过、其蒸馏块原样 carry forward 不重蒸)蒸馏 knowledge/ 各 topic 的 distilled 段;闸门区分 stale(包已删)与 superseded(被新包取代);只蒸 SDD 过程知识,范围外 topic 经闸门日落;删 sidecar 即强制全量重蒸(不设 `--full`);人工闸门后落盘,落盘即提交 | trunk 分支 |
| `/speccode:recording-knowledge` | 知识直接记录进 hand-written 段(适配判断:过程知识收录,业务知识建议进外部 RAG;草稿 → 人工闸门 → 原子写),落盘即提交 | trunk 分支 |

方法论:

| 命令 | 作用 | 前置(运行分支) |
|---|---|---|
| `/speccode:subagent-driven-development` | 每任务派发全新子代理 + 双重审查 + 整支终审;ledger 恢复 | worktree-* 分支 |
| `/speccode:executing-plans` | 本会话分批执行计划,带人工检查点 | worktree-* 分支 |
| `/speccode:dispatching-parallel-agents` | 并发子代理工作流(独立失败域) | worktree-* 分支 |
| `/speccode:test-driven-development` | RED-GREEN-REFACTOR 循环(含铁律与反模式表) | worktree-* 分支 |
| `/speccode:systematic-debugging` | 4 阶段根因过程 + 防御纵深 + 条件等待技巧 | worktree-* 分支 |
| `/speccode:requesting-code-review` | 派发审查子代理(规格合规 + 代码质量) | worktree-* 分支 |
| `/speccode:receiving-code-review` | 技术化处理评审反馈(不表演式同意) | worktree-* 分支 |
| `/speccode:verification-before-completion` | 证据先于断言:宣布完成前必须跑验证 | worktree-* 分支 |

## 3. 三层分支拓扑图

```
origin/<trunk> (主干;spec 文档 tracked)
   │
   │  /speccode:creating-feature
   ▼
feature/<slug>  (功能分支;一个需求可拆多轮/多个 worktree)
   │
   │  /speccode:creating-worktree (可并行多个)
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
worktree-a     worktree-b     worktree-c
   │  文档流(proposing→brainstorming→writing-plans→…→syncing→archiving)在此层进行
   └── /speccode:finishing-worktree(测试门禁 + PR/本地 squash)合并回 feature ──┘
   │
   │  /speccode:finishing-feature(单 PR → trunk,阻塞等合并)
   ▼
origin/<trunk>  (功能落地,feature 分支保留作历史)
```

要点:

- **trunk**:主干分支(默认 `master`),spec 文档 tracked。
- **feature/bugfix/refactor/chore/\<slug\>**:功能分支,从 trunk 切出;一个需求可拆多轮、多个 worktree。
- **worktree-\<suffix\>**:开发分支,硬前缀 `worktree-`(可配置),从 feature 切出,通过 `git worktree add` 创建,多个可并行。
- **拓扑只有三层**:v0.1 的标的分支层与临时收尾分支已移除(见第 11 节);`speccode/` 文档在所有分支 tracked,随 PR 链路上 trunk。

## 4. 开发流程

从需求到归档的 12 步默认路径:

1. `/speccode:exploring` —— 在 trunk 上探索需求,结论留在会话上下文(写 `_exploring` memory)。
2. `/speccode:creating-feature` —— 从 trunk 切功能分支,登记 state,建 memory 骨架。
3. `/speccode:creating-worktree` —— 从 feature 切 worktree,跑基线测试。
4. `/speccode:proposing` —— 落地 proposal/design/specs/tasks 四类文档。
5. (复杂时)`/speccode:brainstorming` —— 设计精化并回写 propose/。
6. `/speccode:writing-plans` —— 产出详细实现计划。
7. `/speccode:subagent-driven-development` 或 `/speccode:executing-plans` —— 执行计划(过程内含 `/speccode:dispatching-parallel-agents`、`/speccode:systematic-debugging`、`/speccode:verification-before-completion`、`/speccode:test-driven-development` 等方法论命令按需调用)。
8. `/speccode:requesting-code-review` —— 派发审查子代理;反馈用 `/speccode:receiving-code-review` 处理。
9. `/speccode:syncing` —— delta 合并进主规格。
10. `/speccode:archiving` —— 归档 changes/<slug>/。
11. `/speccode:finishing-worktree` —— worktree 成果合并回 feature。
12. `/speccode:finishing-feature` —— 单 PR → trunk,阻塞等合并,删 state,切回 trunk。

## 5. 文档目录

speccode 的 spec 文档统一放在仓库的 `speccode/` 目录,**在所有分支 tracked**,随 PR 链路上 trunk:

```
speccode/
├── changes/<slug>/          # 进行中的需求文档
│   ├── propose/             # proposal.md / design.md / specs/ / tasks.md(proposing 产出)
│   ├── brainstorm/          # 设计精化文档(brainstorming 产出)
│   └── plan/                # 实现计划(writing-plans 产出)
├── spec/<capability>/       # 主规格(syncing 合并 delta 后的落地处)
├── archive/<YYYY-MM-DD>-<slug>/   # 归档(archiving 整体移动,不删除)
└── knowledge/               # 知识集(distilling-knowledge / recording-knowledge 产出)
    ├── _index.md            # 检索索引:标题 + 文件 + 一句话摘要,按需重建
    ├── _distilled.meta.json # 蒸馏消费 sidecar:已消费归档包(增量读追踪)
    └── development/         # architecture.md / standards.md / environment.md / integrations.md / pitfalls.md / security.md
```

约定:

- **落盘即 commit**:proposing / brainstorming / writing-plans / syncing / archiving / distilling-knowledge / recording-knowledge 每一步产出文档后立即提交,文档历史与代码历史同分支同行。
- **同 feature 多轮重建不冲突**:changes/<slug>/ 归档后目录释放,同一 slug 可再次 proposing 开新一轮;未归档重建时 proposing 会询问「续写 / 先归档 / 取消」。
- **知识集:distilled 与 hand-written 分层**:`knowledge/` 下每个 topic 文件可混合两类内容。`distilling-knowledge` 把 `spec/`(全量读)与 `archive/`(**增量**——只读未消费归档包,经 `_distilled.meta.json` 追踪;已消费包整包跳过、其蒸馏块原样 carry forward 不重蒸,因归档包不可变)蒸馏为**蒸馏块(distilled blocks)**,用 `<!-- distilled-from: <source> --> ... <!-- /distilled -->` 标记包裹,每个 topic 的蒸馏块每次运行全量重建(来源已消失的块标 stale;被新包取代的块标 superseded,二者均经闸门;删 `_distilled.meta.json` 强制全量重蒸作逃生口,不设 `--full`);`recording-knowledge` 则在这些标记之外追加自由格式的**手写(hand-written)**内容。重建对标记之外的一切内容逐字节保留,故手写内容在每次蒸馏块重建后原样存活。知识集只策展 SDD 过程知识(`development/*`;pitfalls 兼收评审中反复出现的问题模式与团队评审共识)。业务知识交由外部 RAG 系统:`recording-knowledge` 写入前做适配判断(建议而非硬拦),`distilling-knowledge` 对范围外 topic 的蒸馏块经同一人工闸门日落,hand-written 段逐字节保留。读侧兼容旧 `promoted-from`/`/promoted` marker,存量文件随首次蒸馏自动重写为新格式。

> 插件侧辅助资源:`plugins/speccode/references/` 内含 visual-companion(brainstorming 的可视化伴侣,见 `references/visual-companion.md`)、评审提示与调试方法论等,随插件源码跟踪。

## 6. `.speccode/` 目录结构

```
.speccode/
├── config.json                          # 静态配置(config 0.2),init / reset 整体写入;creating-worktree 可回写 worktree_dir
├── config.json.bak.<timestamp>          # init 幂等 / reset 流程改写 config 前的显式备份(backup-config verb)
├── state/features/<type>__<slug>.json   # 动态状态,按 feature 维度隔离
├── memory/                              # feature 级记忆 + _exploring.md / _knowledge.md(自忽略 .gitignore)
└── sdd/                                 # SDD 执行工件:task brief / review 包 / ledger(自忽略 .gitignore)
```

- **`config.json`**:全局静态配置,config 0.2 字段集:`version`(=2)、`initialized_at`、`trunk`、`remote`、`pr_tool`、`worktree_prefix`、`worktree_dir`、`code_intel_tools`;`hooks` 仅在用户配置时存在。整体写入只发生在 `/speccode:init`(全新或幂等)与 `/speccode:reset`;此外 `/speccode:creating-worktree` 在 config 缺少 `worktree_dir` 时会询问存放目录,并经 `write-config` 把该字段回写进 config(读当前 config → 加字段 → 整体写回)。**备份不是 `write-config` 的自动行为**:`config.json.bak.<timestamp>` 由 init 幂等流程与 reset 流程在改写前显式调用 `backup-config` 生成,creating-worktree 的单字段回写不产生备份。
- **`state/features/`**:每个 active feature 一个独立文件(`<type>__<slug>.json`,双下划线分隔 type 与 slug),记录 worktree 进度(`pending | in_progress | pr_open | completed`)与挂起的 `pending_operation`(供 `--resume` 续跑)。多 feature 并行各写各的文件,无需加锁。
- **`memory/`**:feature 级会话记忆(见第 8 节),插件自写 `.gitignore`(内容 `*`)使其对 `git status` 隐身、免于 `git clean -fd`。
- **`sdd/`**:SDD 执行工件,归属**当前 worktree 根**(而非主仓根),随 `git worktree remove` 一并清理;同样自忽略。
- 所有对 `config.json` 与 `state/features/*.json` 的写入均采用「写临时文件 + rename 覆盖」的原子策略,避免进程中断导致半写状态;memory 文本写入同策。

## 7. hooks

config 的 `hooks` 字段把固定的生命周期事件映射到 shell 命令,在对应节点由命令经 `run-hook` verb 触发。

**14 个固定事件**(枚举封闭,未知事件名会被拒绝):

`onExplored` / `onFeatureCreated` / `onWorktreeCreated` / `onProposed` / `onBrainstormed` / `onPlanned` / `onTaskCompleted` / `onCodeReviewRequested` / `onCodeReviewCompleted` / `onWorktreeFinished` / `onFeatureFinished` / `onPrOpened` / `onSynced` / `onArchived`

**payload**:hook 命令从 **stdin 读单行 JSON**,字段为 `event`、`timestamp`(ISO 8601 UTC)、`repo_root`、`cwd`、`command`,以及按可得性附加的 `feature_branch` / `worktree_branch` / `pr_number` / `task`。

**失败语义:warn-only**。单个 hook 30 秒超时;无论 hook 不存在、超时、非零退出还是抛错,`run-hook` 永远 exit 0,错误折叠进返回 JSON 的 `hook` 字段——**hook 永远不能打断主命令**。

**用途示例**(IM 通知 stub):

```json
"hooks": {
  "onPrOpened": "read -r p; curl -s -X POST https://im.example.com/notify -H 'Content-Type: application/json' -d \"$p\"",
  "onFeatureFinished": "read -r p; echo \"feature done: $p\" >> /tmp/speccode-hooks.log"
}
```

**威胁模型**:hook 以 `sh -c` 在当前用户的完整权限下执行,其安全性论证见 R11。

**内置工具输入清洗器**:插件自带 PreToolUse hook(`hooks/hooks.json`),在 AskUserQuestion
对话框渲染前剥离其 tool_input 中的游离 CR(U+000D)——部分模型后端会在 tool_use 参数里注入
CR 导致提问乱码。清洗逻辑位于 `lib/sanitize.mjs`(纯函数、有单测);hook 壳为 fail-open:
任何错误都原样放行输入,绝不阻断交互。

## 8. memory

speccode 为每个 feature 维护一份跨会话记忆:`.speccode/memory/<type>__<slug>.md`。

- **untracked,多 worktree 共享**:memory 路径解析自**主仓根**的 `.speccode/`(与 config/state 一致),同一 feature 的多个 worktree 读写同一份文件;目录由插件自写 `.gitignore` 自忽略,不污染 `git status`。
- **`_exploring.md` 与 `_knowledge.md` 是 trunk 级例外**:exploring 在 trunk 上进行、不属于任何 feature,其结论写入 `memory/_exploring.md`;knowledge 系列命令同样从 trunk 跑,其维护摘要写入 `memory/_knowledge.md`。
- **命令入口读、出口写**:SDD 各命令开始时读本 feature 的 memory 恢复上下文,结束时把结论/决定/待办写回。
- **长会话主动书写三判据**:① 一个阶段完成(如 propose 落盘、计划评审通过);② 上下文显著增长(关键决策增多);③ 经历 compact / 会话恢复后——命中任一即应主动写 memory,而不是等命令出口。

## 9. 代码智能工具

`/speccode:init` 探测五类代码智能工具:**understand-anything / CodeGraph / Graphify / CodeMap / GitNexus**,覆盖四类来源:

1. **插件**:`~/.claude/plugins/installed_plugins.json`
2. **MCP**:项目 `.mcp.json`、`~/.claude.json`(含项目 local scope)
3. **CLI**:`command -v <bin>`
4. **项目目录**:如 `.ua/`、`.codegraph/` 等

探测结果区分「可用 available」与「集成 integrated」两个维度;仅 `available` 与 `integrated` 都为 true 的工具才逐项用 AskUserQuestion 展示,经用户确认后登记进 config 的 `code_intel_tools`;可用但未集成的工具 MUST NOT 登记;一个都未确认则写空数组。

使用约定:`/speccode:exploring`、`/speccode:proposing`、`/speccode:brainstorming` 优先咨询已登记的代码智能工具;工具缺失或调用失败时**回退到常规代码阅读,永不报错**——代码智能工具是增强,不是依赖。

## 10. 风险与缓解(R1–R13)

> 编号沿用 v0.1 原始风险表:R1 / R7 / R10 随 v0.1 四层拓扑(标的分支层 + 临时收尾分支)一并废止,见第 11 节迁移;其余保留并更新到新命令名。

- **R2 — ancestor 判定在 cherry-pick 跨 feature 场景下会误判** → 缓解:`worktree_overrides` 字段显式指定 worktree 归属,作为「高级用户兜底」;同一 worktree 匹配 ≥2 feature 时对账记 `conflicts` 报错退出,绝不随意归属。
- **R3 — init 逐字段幂等时用户可能误改 trunk 等字段** → 缓解:每个变化字段确认时 MUST 显示 `[旧值] → [新值]` diff,只有用户选择「改用新值」后才写入。
- **R4 — `.speccode/` 不在 `.gitignore`,`git clean -fdx` 会丢配置** → 缓解:在 init 提示与本 README 中明确警告;不在命令层面强制保护(与「插件不改 `.gitignore`、不越权改写用户 git 机制」的原则一致)。见第 14 节的重要警告。
- **R5 — 阻塞等 PR 合并默认 30 分钟超时,长 PR review 可能不够** → 缓解:超时是软限制,挂起态写入 `pending_operation`,`--resume` 允许后续续跑,不会永久卡死命令。
- **R6 — worktree 目录可配置,默认 `.claude/worktrees`** → 缓解:`.claude/` 本身已是 untracked,git 不会误扫为待提交内容;init 时可通过 config `worktree_dir` 覆盖默认值,`creating-worktree` 建目录前做 check-ignore 校验。
- **R8 — 跨平台(Windows / macOS / Linux)路径与命令差异** → 缓解:实现以 macOS / Linux 为主,Windows 支持不在目标范围内;命令实现尽量依赖 `git` / `gh` / `glab` 自身的跨平台行为,不在 shell 层做平台判断。
- **R9 — `pr_open` 的 worktree 依赖对账推进** → 缓解:`creating-worktree` / `finishing-worktree` / `finishing-feature` / `status` 入口都会跑对账,任一命令执行都会把已合并的 `pr_open` worktree 推进为 `completed`;若用户合并 PR 后从不再跑任何 speccode 命令,状态不会自动更新——可接受,`status` 是显式查询入口,随时可手动触发。
- **R11 — hooks 以 `sh -c` 在当前用户完整权限下执行** → 缓解与威胁模型:① 失败语义 warn-only(30s 超时、`run-hook` 永远 exit 0),hook 不能破坏主流程;② `config.hooks` 之所以安全,是因为 `.speccode/` **按约定 untracked**——hook 命令不可能经由 clone / PR / merge 进入他人仓库,能写 config 的只有本机用户自己跑的 `init`;③ hook payload 的取值由 `slug.mjs` 结构性约束(type 是封闭枚举、slug 匹配 `/^[a-z0-9-]+$/`),路径类字段由引擎生成,不含任意用户输入。
- **R12 — memory 并发写 last-writer-wins** → 同一 feature 的多个 worktree 共享一份 memory 文件,两个会话同时「出口写」时后写覆盖先写。缓解:写前必读(read-before-write,在现有内容上做增量而非整文件替换);涉及大段覆盖性重写前向用户确认。
- **R13 — trunk 文档 churn** → spec 文档在所有分支 tracked,多 feature 并行落地会让 trunk 的 `speccode/` 目录频繁变更,增加合并冲突面。缓解:`syncing` 只做**增量合并且幂等**(重跑无脏变更);`archiving` 是目录整体**移动**而非删除,review diff 干净、历史可追溯;文档与代码同 PR 上 trunk,review 时可见。

## 11. 从 0.1 迁移

各版本完整变更记录见仓库根目录 [CHANGELOG.md](../../CHANGELOG.md)。

### 升级动作

插件升级对用户来说是一组 Claude Code 命令,不是重新克隆:

```text
/plugin marketplace update speccode-development   # 刷新 marketplace 缓存(git 拉取)
→ 检测到 plugin.json version 变化触发更新检测
→ /plugin install speccode@speccode-development   # 按提示更新安装
```

注意:GitHub Release / tag 只是给人看的发布标记,**不触发**任何自动更新;更新检测完全由 marketplace git 拉取后的 `plugin.json` version 比对驱动。

### 命令对照表

| v0.1 | v0.2 |
|---|---|
| `/speccode:start` | `/speccode:creating-feature` |
| `/speccode:develop-start` | `/speccode:creating-worktree` |
| `/speccode:develop-complete` | `/speccode:finishing-worktree` |
| `/speccode:finish` | `/speccode:finishing-feature` |
| `/speccode:display-merge-trunk` | **下线**(display 层移除) |
| `/speccode:display-rebase-trunk` | **下线** |
| `/speccode:display-reset-to-trunk` | **下线** |

迁移步骤:

1. **config 重新 init 升 0.2**:直接运行 `/speccode:init`,幂等流程会逐字段 diff;旧 config(`version` 为 1 或缺失)的 `display` / `spec_tools` / `untracked_permanent` 三字段会标记为「移除」,接受升级后写入 `version: 2`,不存在混合态。改写前的旧值经 `backup-config` 显式备份为 `config.json.bak.<timestamp>`。
2. **遗留 display 分支**:v0.2 不再使用 display 层。已无 active feature 的仓库可直接删除 display 分支;spec 文档在 v0.2 全分支 tracked,不再需要专门的「标的分支」托管。
3. **遗留 `waiting_display_pr` 挂起态**:v0.1 finish 阶段卡在 display PR 的 feature,其 state 的 `pending_operation` 无法被 v0.2 自动续跑。按 `/speccode:finishing-feature` 命令文档中的手动指引处理:① 检查当时的 display PR 是否已合并;② 已合并则 `git checkout <trunk> && git pull`,手动创建 `<feature> → <trunk>` 的 PR;③ 用 `write-state` 清除该 feature 的 `pending_operation` 后重新执行 `/speccode:finishing-feature`。v0.1 的 `<feature>-complete` 临时分支若仍残留,确认 trunk PR 已合并后手动删除即可。
4. **旧命令名的肌肉记忆与脚本**:改名无别名,任何引用 v0.1 命令名的脚本/文档/习惯都要按上表改。state 中遗留 `pending_operation.command` 的旧值(`develop-complete` / `finish`)由引擎在读路径自动规范化为新名,**无需手动处理**。
5. **`.speccode/memory/` 与 `.speccode/sdd/`**:v0.1 时代没有这两个目录,升级时**无需任何操作**;它们由各命令按需自建(目录内自带 `.gitignore` 自忽略)。

## 12. 理念

speccode 的方法论命令继承五条工作理念:

1. **测试驱动**
2. **系统化优于临时发挥**
3. **降低复杂度**
4. **证据优于断言**
5. **不要过度自信(不确定先询问)**

## 13. 未解决问题

- **Windows 未支持**:当前实现只覆盖 macOS / Linux,不处理 Windows 路径分隔符、shell 差异等问题(见 R8)。是否需要在每个命令文件里重复标注「仅 macOS / Linux」,还是只在本 README 统一说明——目前倾向于只在 README(本节 + 文首依赖块)集中说明,不在每个命令 markdown 文件里重复。

## 14. ⚠ 重要警告

`.speccode/` 目录在用户项目中**不会被 git 跟踪,也不会被加入 `.gitignore`**——这是插件的显式设计决策(speccode 与 git 原生机制解耦,所有跟踪管理都走显式命令,不代用户修改 `.gitignore`)。

**这意味着**:如果你在该仓库执行 `git clean -fdx`,`.speccode/config.json`、`state/features/*.json`、`memory/`、`sdd/` 全部会被当作「未跟踪/被忽略文件」一并删除,直接丢失当前的 speccode 配置、所有 active feature 的进度状态与全部会话记忆(对应风险 R4)。

`git clean -fd`(不带 `-x`)稍微温和:`memory/` 与 `sdd/` 因插件自写的 `.gitignore`(内容 `*`)而被判定为 ignored,`-fd` 不伤两者;但 `config.json`、`state/`、`config.json.bak.*` 仍是普通 untracked 文件,**`-fd` 一样会删除**。

**建议**:

- 执行 `git clean` 系列命令前,先确认 `-x` 与 `-f` 的作用范围;必要时用 `git clean -n` 先 dry-run,或显式排除 `.speccode/` 路径。
- 如果确实丢失了 `config.json`,重新执行 `/speccode:init` 即可重建;`state/features/*.json` 丢失后对应 feature 的进度信息无法恢复,需要凭对账(reconcile)结合当前 git 实际状态重新登记;`memory/` 丢失则会话记忆不可恢复,只能靠 `speccode/` 下的已提交文档重建上下文。
