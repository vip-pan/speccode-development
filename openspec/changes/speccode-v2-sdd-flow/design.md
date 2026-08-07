# Design: speccode-v2-sdd-flow

## Context

见 proposal.md Why。技术现状中与设计方案直接相关的约束:

- 引擎(`plugins/speccode/lib/*.mjs` + `bin/speccode.mjs`)与 display/-complete **零耦合**——该概念 100% 集中在 commands/*.md、README.md、openspec/specs/ 文本层;config.mjs 仅把 `display` 当不透明 JSON 透传。拓扑收敛因此主要是文本层手术,引擎改动以新增为主。
- 引擎既有不变量(必须保持):原子写走 `atomic.writeJsonAtomic`;repoRoot 用 `git rev-parse --path-format=absolute --git-common-dir` + dirname(state/config 在主仓,linked worktree 内也能解析);写 verb 从 stdin 读 JSON;未知 verb/抛错 → `{ok:false}` + exit 1;每个 lib 模块配一个 `tests/<module>.test.mjs`;PR/等待类逻辑依赖注入做单测。
- 现存技术债(本 change 顺带处理):`waitmerge.mjs` 从未接线为 verb(阻塞 30 分钟与 Bash 超时模型不兼容);`--json-stdin` 在命令文档中出现但 bin 从不解析(无条件读 stdin);`docstrip.mjs`/`slug.mjs` 无 verb 暴露;config 无校验层,字段集只存在于 spec。
- superpowers v6.2.0 只发布 skills 不发布 commands——移植是「skill prose → 命令 markdown」的体裁转换,其 Red Flags / Common Rationalizations / Iron Law 等表格是 eval 调校过的行为塑造内容,须近逐字保留。
- 本仓有一个 active change `restructure-as-claude-code-plugin`(打包重构,代码已落地,sync/archive 未做),其 plugin-packaging delta 含三条将被 v2 证伪的 requirement(10 命令命名空间、version 0.1.0、10 命令表文档)。

## Goals / Non-Goals

**Goals:**

- 三层拓扑(trunk / feature / worktree)端到端走通,display/-complete/docstrip 彻底移除。
- 21 个命令覆盖完整 SDD 流:exploring → creating-feature → creating-worktree → proposing → [brainstorming] → writing-plans → 执行(SDD/executing-plans + TDD/debugging/review/verification)→ syncing → archiving → finishing-worktree → finishing-feature。
- speccode 自有文档流(目标项目 `speccode/` 目录)自包含,不依赖 openspec CLI、不依赖 superpowers 插件。
- hooks(配置驱动、warn-only)与 memory(feature 级、untracked、原子写)落地。
- 全部引擎新逻辑配套单测,62 个存量测试按清单删改后全绿。

**Non-Goals:**

- 不替用户收尾 active change `restructure-as-claude-code-plugin`(但 v2 的 sync 前提是其已 sync,见 D17)。
- 不做 hook strict/blocking 模式;不做 memory 团队共享导出;不做命令别名兼容;不保留 `spec_tools` 作 inert 登记簿。
- 不使用裸 `openspec archive` 归档本 change(见 D2 注记)。
- SDD task 级之外的更细粒度 hook(如 per-fix-round)不做。
- Windows 支持维持现状(macOS/Linux),不在本 change 扩展。

## Decisions

### D1 三层拓扑与 -complete 退休

feature 直接从 trunk 切出;finishing-feature 只创建并等待「feature → trunk」单 PR。**Trade-off**:失去「trunk 无文档」的物理隔离,换取单 PR、无 amend 改写、无强推;trunk 携带 `speccode/` 文档被接受为默认语义,其体积由 syncing 合并 + archiving 移动控制(见 D3)。**备选**(保留 trunk 不跟踪语义、在 finishing-feature 前临时提剥离 commit)被否:没有 -complete 载体后实现更绕,且与「降低复杂度」理念冲突。

### D2 docstrip 退休,`spec-docs-tracking-control` 整体移除(非改写)

该 capability 全部 6 条 requirement 都锚定在被删机制上(display 跟踪语义、finish 剥离、未跟踪检查、四步走、工具目录保护),改写后只剩一句「永远 tracked」——作为空壳 capability 保留不如移除,残余正面语义并入 `sdd-document-lifecycle` 的「文档全分支 tracked」requirement。`lib/docstrip.mjs` + `tests/docstrip.test.mjs` 物理删除。

**注记(OpenSpec 机制约束,已实测核实)**:REMOVED-all delta 写法本身合法(names-only 即可过 change 级校验),但 sync 后主 spec 会剩 Purpose + 空 Requirements,过不了 `requirements.min(1)` 校验;程序化 `openspec archive` 的预写校验(validateSpecContent)会直接硬中止。因此:(a) sync 移除 6 条 requirement 后必须 `git rm -r openspec/specs/spec-docs-tracking-control/` 删除目录;(b) 本 change 的 sync/archive **必须走 `/opsx:sync` + `/opsx:archive` agent 流**,不能用裸 `openspec archive`。

### D3 文档目录布局 `speccode/{changes,spec,archive}`

目标项目内:`speccode/changes/<slug>/{propose,brainstorm,plan}/` → `speccode/spec/` → `speccode/archive/<YYYY-MM-DD>-<slug>/`。刻意不与 openspec 默认目录(`openspec/`)同名:目标项目若已用 openspec 可并存不冲突;speccode 文档流由命令 prose 驱动(从 opsx 移植的 agent 流程),不调用 openspec CLI。`<slug>` 等于所属 feature 分支的 slug 段;同一 feature 多轮开发时,每轮重建 `changes/<slug>/`(前一轮已被 archiving 移走,不冲突)。**并行防护**:同一 feature 同一时刻只允许一个活跃 `changes/<slug>/`——proposing 检测到该目录已存在且未归档时 MUST 询问用户(续写补充 / 先 archiving 再重建 / 取消),防止两个并行 worktree 同时写同一目录。

### D4 命令改名硬切换,无别名

commands-only 插件做别名 = 维护两份相同 markdown。迁移成本由三件事覆盖:plugin.json 升 0.2.0(BREAKING 语义)、README 迁移对照表、state legacy 规范化(D13)。旧命令文件(start/develop-start/develop-complete/finish/display-\*×3)物理删除,新旧文件名零碰撞。

### D5 config v2 删除 `spec_tools` / `untracked_permanent`

二者唯一消费者是已退休的 docstrip/display 流程,随机制一并删除,避免死字段。目标项目若另用 openspec,其文档跟踪语义由用户自管,speccode 不代管。**备选**(保留为 inert 登记簿)被否:YAGNI。

### D6 verb 面扩展与收缩

新增 9 个 verb(全部遵守既有不变量):

| verb | 输入 | 输出 | 备注 |
|---|---|---|---|
| `run-hook` | `--event <name> --cwd .`,stdin 可选 JSON 片段 | `{ok:true, hook:{ran, ok, warning?, error?}}` | **永远 exit 0**(D8) |
| `read-memory` | `--branch <F>` | `{ok:true, memory: string\|null}` | 主仓定位 |
| `write-memory` | `--branch <F> --json-stdin` ← `{mode, content}` | `{ok:true, path}` | mode ∈ replace/append |
| `detect-knowledge-tools` | `--cwd .` | `{ok:true, tools:[{id,kind,evidence}]}` | 探测全注入可测 |
| `resolve-worktree-dir` | `--cwd .` | `{ok:true, dir, source:'config'\|'default'}` | default=键缺失,命令层重问写回 |
| `query-pr` | `--number <N> --cwd .` | `{ok:true, state}` | 五态含 CONFLICTING;pr_tool=none/无 config → `{ok:false}` |
| `sdd-workspace` | `--plan <path> --cwd .` | `{ok:true, dir}` | 当前 worktree 根定位(D7) |
| `task-brief` | `--plan <path> --task <N> [--out <p>]` | `{ok:true, path, lines}` | fence 感知抽取 |
| `review-package` | `--plan <path> --base <sha> --head <sha> [--out <p>]` | `{ok:true, path, commits, bytes}` | commits + stat + -U10 diff |

收缩与修正:

- **删除 `waitmerge.mjs`(+其测试)而非接成 verb**:阻塞 30 分钟的 CLI 调用与 Claude Code Bash 超时模型不兼容(这正是它从未被接线的根因);改为暴露单次 `query-pr`,30s/30min 轮询循环留在命令 prose。**`query-pr` 状态为五态 `{MERGED, OPEN, CLOSED, CONFLICTING, UNKNOWN}`**:v1 spec 承诺「PR 冲突立即报错」但 v1 实现中 CONFLICTING 是死分支(parsePrState 从未产出);v2 真正实现——`prtool.mjs` 的查询参数与解析扩展 mergeable/冲突字段映射(gh: `mergeable == "CONFLICTING"`;glab: 对应冲突标记),查询调用透传 cwd。
- **`--json-stdin` 显式化**:写 verb(write-config/write-state/write-memory)缺该 flag 时返回 `{ok:false}`。现状是「文档写了但从不解析、无条件读 stdin」;显式化让契约可测,且本 change 反正重写全部命令。
- **reconcile prefix 改读 config**:`const cfg = loadConfig(sc); const prefix = cfg?.worktree_prefix ?? 'worktree-'`——`?? 'worktree-'` 兜底**必须保留**,cli.test.mjs 有两个刻意无 config 的 reconcile 端到端测试编码「对账绝不能因缺配置崩溃」的安全网语义,不许按字面「改读 config」删掉兜底。
- reconcile 对账算法本体(ancestry 归属、worktree_overrides、conflicts 报错、pr_open 推进)不变。

### D7 SDD 三脚本以 node lib + verb 重实现(不搬 bash)

superpowers 的 `sdd-workspace` / `task-brief` / `review-package` 是 SDD 的承重件(「工件以文件交接」纪律所系)。以 `lib/sdd.mjs` 重实现而非搬 bash 的理由:(1) 引擎不变量「确定性逻辑下沉 lib 并配单测」;(2) task-brief 的 awk fence 解析正是需要单测的逻辑(`Task 1` 不得误配 `Task 10`);(3) Node≥24 已是硬依赖,bash+awk 降低可移植性。

**工作区定位用 `git rev-parse --show-toplevel`(当前 worktree 根),而非 bin 的主仓 repoRoot**——有意为之:SDD 工件(brief/report/diff/ledger)属于执行环境,随 `git worktree remove` 自动清理;且 Claude Code 拒绝 agent 写 `.git/`。这与 state/memory 的主仓定位差异在本节显式声明,防止后续维护者「统一」掉。`.speccode/` 整体 untracked 是既有约定,无需像 superpowers 那样自写 `.gitignore`。cli.test.mjs 补「linked worktree 内调用 sdd-workspace 解析到 worktree 根」用例。

### D8 hooks:warn-only + 固定枚举 + 永远 exit 0

- 固定 14 事件枚举(见 hook-event-integration spec):拼错事件名返回 `warning` 但算成功——防静默失效。
- payload:stdin 单行 JSON,`{event, timestamp(ISO 8601 UTC), repo_root, cwd, command, feature_branch?, worktree_branch?, pr_number?, task?}`。**分工:引擎只补 envelope 四字段(event/timestamp/repo_root/cwd);`command` 与事件上下文字段由调用方(命令层)在 payload 片段中传入**——引擎无法知道自己被哪个命令调用。payload 片段允许为空(视为 `{}`),run-hook 的 stdin 读取 MUST 容忍空输入,不阻塞等待。
- 失败语义:非零退出/超时(30s)/不可执行 → 主命令继续并打印警告;hook 不改变主命令退出码。通知类集成(IM 等)的正确默认就是不阻断;v2 不做 strict 模式。
- **实现约束**:`run-hook` handler 必须整体 try/catch 兜底、永不返回 `ok:false`——否则 bin main() 的 catch 会在最不该失败的时刻(hook 挂点)exit 1。这是「唯一永远 exit 0 的 verb」的成立条件,写进 spec requirement。

### D9 memory 位置:主仓 `.speccode/memory/<type>__<slug>.md`,untracked

**备选**(`speccode/changes/<slug>/memory.md` tracked)被否:会把会话笔记带进功能 PR、跨 worktree 产生合并冲突、泄漏进 trunk 历史。untracked + 主仓定位使同 feature 多 worktree 共享一份 memory(跨会话连续性的核心诉求),与 state 哲学一致;命名复用 `<type>__<slug>` 双下划线规则(branchToStateName)。atomic.mjs 增加 `writeTextAtomic`(与 writeJsonAtomic 同 tmp+rename 模式),append 的读-改-写也走它。

### D10 知识工具咨询为 advisory 配置驱动

commands-only 插件无法程序化调用另一插件的 slash command 或 agent(无跨插件调用机制)。现实机制:init 探测 → config.knowledge_tools 落盘 → exploring/proposing/brainstorming 的命令 prose 按列表生成「若本会话中其 MCP server/agent 可用则优先,否则回退 Grep/Glob/Read」指引。探测只产生 advisory 提示,永不报错。探测启发式四类:已安装插件目录(`~/.claude/plugins/` 匹配)、MCP 配置(项目 `.mcp.json` 与用户级配置的 mcpServers key)、CLI 二进制(`command -v`)、项目配置目录(如 `.codegraph/`);内置探测表覆盖 understand-anything/codegraph/graphify/codemap/lightrag。`detectKnowledgeTools(cwd, opts)` 的 fs/spawn/readJson 全部依赖注入,保证单测不碰真实环境。

### D11 syncing 源契约与幂等判定

opsx:sync 的硬约束是「delta 源仅来自 artifactPaths.specs.existingOutputPaths」单一源。speccode 的 syncing **刻意偏离**:delta 源 = `speccode/changes/<slug>/propose/` 四类文档;brainstorm 结论经两条路径进入——**(a) brainstorming 命令完成时回写 propose/(默认权威路径);(b) syncing 检测到 brainstorm/ 存在时先吸收其未回写残余(兜底)**。双重路径不是冗余:(a) 是常态,(b) 处理用户跳过/中断回写的场景。幂等判定与 opsx:sync 同构——按 requirement 标题存在性合并(ADDED 已存在即更新、MODIFIED 部分应用、REMOVED 删块、RENAMED 改标题),brainstorm 吸收按段落标题/指纹去重;支撑「syncing 跑两遍 diff 为空」的验证。

### D12 finishing-worktree 融合 finishing-a-development-branch

- 任何合并路径前跑全量测试,失败即停(「A green run only proves the tree it ran on」)。
- 菜单 = PR等待 / PR不等待 / 本地squash / 保留(前三项保留 v1 develop-complete 语义,第四项来自 superpowers);**丢弃不进菜单**,仅在用户显式要求时进入,且须逐字输入 `discard`(分支名+commit 列表+worktree 路径先展示)。
- worktree 清理 provenance 检查从 superpowers 的字面量 `.worktrees/`/`worktrees/` **重定向为「分支带配置前缀 且(路径位于 resolve-worktree-dir 解析结果之下 或 在 state 中有登记)」**——否则默认配置下该守护静默失效(superpowers v6.2.0 修过同类 bug);「state 登记」析取项覆盖 worktree_dir 配置变更后旧目录下自建 worktree 的泄漏场景。
- PR 等待轮询(30s/30min)基于 `query-pr` 单次查询 verb,留命令层 prose;TIMEOUT 写 `pending_operation{command:"finishing-worktree", phase:"waiting_worktree_pr"}`,`--resume` 续跑。
- **移植 using-git-worktrees Step 3 与 finishing-a-development-branch 的复测语义**(初稿遗漏,查漏补缺补齐):creating-worktree 在项目 setup 后 MUST 跑基线测试,失败时报告并询问继续还是调查;finishing-worktree 本地合并路径在合并完成后 MUST 对合并结果复跑全量测试,失败即停(未推送,可恢复)。

### D13 state legacy 规范化:normalizeState() 双路径调用

`lib/state.mjs` 新增 `normalizeState()`(`LEGACY_COMMAND_NAMES = {'develop-complete':'finishing-worktree','finish':'finishing-feature'}` 映射 `pending_operation.command`;`waiting_display_pr` 原样保留),由 `readState` 与 `listActiveFeatures` **共同**调用——只下沉 readState 会有洞:reconcile 走 listActiveFeatures(直接 readJson),其输出的 `pending_operation.command` 仍是旧名,`--resume` 按新名匹配在主路径失效。`waiting_display_pr` 的「不可续跑 + 手动收尾指引」写进 finishing-feature.md prose(命令层检测 phase 报错),不进引擎(readState 契约是返回 JSON|null,抛错会击穿 feature-progress 与 listActiveFeatures)。state.test.mjs 补 listActiveFeatures 路径的规范化用例。

### D14 syncing/archiving 在 worktree-\* 上运行且 git commit

opsx 原版 sync/archive 不碰 git;speccode 版增强为落盘即 commit(与 proposing/brainstorming/writing-plans 的「落盘即 commit」节奏统一)。二者在 worktree-\* 分支、finishing-worktree 之前运行,文档随 worktree→feature→trunk 的既有 PR 链路上 trunk,不产生直提 trunk 的 docs-only commit。**commit 落点**:syncing/archiving 的文档 commit 落在当前 worktree 分支;若该 worktree 处于 `pr_open`(PR 不等待路径),后续 push 时已开 PR 自动包含这些文档 commit,无需特殊处理。

### D15 auto 模式 = 按工具会话执行模式判断,不设 config 键

「auto 模式」指 Claude Code 的自动接受/bypass 权限模式、Codex 的 auto 模式等工具会话执行模式,由 agent 在命令 prose 指引下按当前会话可感知的执行模式信号判断;不新增 config 字段。**判断依据不充分时默认询问而非自动衔接**(D16 原则的具体化)。误判为自动的代价可控:所有自动衔接动作(建分支、建 worktree、落文档)均可逆且经 git/state 留痕;误判为询问仅多一次打断。

### D16 不确定先询问原则

全局行为准则,落点:auto 模式判断不充分时默认询问;知识工具探测结果 init 逐项确认;hooks 配置 init 询问而非静默写入;exploring/proposing/brainstorming 的提问环节保持「一次一问」;README 理念节完整收录五条理念(测试驱动 / 系统化优于临时发挥 / 降低复杂度 / 证据优于断言 / 不要过度自信-不确定先询问),本 D 为第五条的落点,前四条分别由 TDD 命令、文档生命周期命令、D1 拓扑收敛、verification-before-completion 命令承接。

### D18 exploring 结论的跨会话承接:trunk 级 `_exploring.md`

exploring 在 trunk 上运行、尚无 feature 可归属时,结论写入主仓 `.speccode/memory/_exploring.md`(untracked,与 feature memory 同机制);creating-feature 出口 MUST 读取 `_exploring.md`(若存在)把结论迁入新 feature 的 memory 骨架并清空该文件。这补上了「exploring 不写 feature memory」与「creating-feature 承接 exploring 结论」在跨会话场景的缺口;`_exploring.md` 是 memory 命名规则的唯一非 feature 例外,在 session-memory spec 中显式声明。

### D17 与 `restructure-as-claude-code-plugin` 的关系(前提已满足)

restructure change 已完成 sync 与归档,`plugin-packaging` 主 spec 已落地 `openspec/specs/`。其主 spec 中有 **4 条** requirement 将被 v2 证伪(审查 initially 只盘点出 3 条,查漏补缺补齐第 4 条):`plugin.json 元数据`(version 0.1.0→0.2.0)、`命令命名空间`(10→21 命令)、`文档三层分离`(10 命令表→21 命令表)、`命令正文手写路径与引擎一致`(正文与 Scenario 以已删除的 display-reset-to-trunk 与 untracked_permanent 为例)。v2 delta 对该 capability 记 **4 条 MODIFIED**(逐字标题),直接作用于已落地的主 spec。两 change 的撰写期 capability 集合本不相交,不存在并行 sync 冲突。

## Risks / Trade-offs

- [REMOVED-all 后主 spec 空壳过不了校验] → sync 后 `git rm -r` 删目录 + 全程走 /opsx agent 流(D2 注记);验证节断言目录不存在。
- [hook 失败被 warn-only 掩盖,用户以为通知已发] → warning 必含事件名与错误摘要;枚举外事件名返回 warning 字段防拼写静默失效。
- [memory 多 worktree 并发写 last-writer-wins] → 出口写入前必读入合并;append 模式默认;prose 要求写入内容经用户确认。
- [trunk 文档体积 churn] → syncing 合并主规格 + archiving 显式移动;README R13 记录。
- [命令改名打断 0.1 用户肌肉记忆与脚本] → 无别名是有意取舍;README 迁移对照表 + state legacy 规范化兜底(D4/D13)。
- [~62 条 requirement delta 超 CLI 10 条建议阈值] → 已实测 `openspec validate --strict`(走 validateChangeDeltaSpecs,无此检查)与程序化 archive(仅非阻断提示)均不受影响;记录在此避免评审者重复查证。
- [visual companion 完整移植增加维护面] → 用户明确选择;脚本原样拷贝入 `references/`,命令 prose 描述启动方式,不进引擎测试面。
- [superpowers 后续版本演进,speccode 拷贝漂移] → 用户接受手动双向同步;README 记录移植基线版本(v6.2.0)。

## Migration Plan

1. 插件升级 0.1.0 → 0.2.0(marketplace 更新)。
2. 目标项目重新 `/speccode:init`:幂等 diff 会显示 display/spec_tools/untracked_permanent 移除、hooks/knowledge_tools/worktree_dir 新增,逐项确认后落 config v2。
3. 存量 state 无需手工迁移:normalizeState 在读路径自动规范化旧 command 名(D13)。
4. 遗留 display 分支 / `waiting_display_pr` 挂起态 / 未合并的 `<feature>-complete` 分支:按 finishing-feature.md 的手动收尾指引处理(报错时打印)。
5. 旧命令肌肉记忆:README 迁移对照表(start→creating-feature 等四组 + 3 个下线命令)。
6. 回滚:插件降级回 0.1.0 即可(config v2 多出的字段对 0.1 引擎是不透明 JSON,无害;但 0.1 命令不读新字段)。

## Open Questions

- OQ1: hook 事件 payload 未来是否需要扩展自定义字段(如用户自定义 key)?v2 固定字段集,待真实集成场景出现再评估。
- OQ2: memory 是否未来增加「导出到 speccode/changes」以支持团队共享?见 D9,单独立 change 评估。
