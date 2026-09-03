# Changelog

本文件记录 speccode 插件的所有重要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

纪律:bump `plugin.json` version 的提交必须同步更新本文件对应版本小节(见 `speccode/spec/plugin-packaging/spec.md`「版本发布纪律」)。

> **English highlights**: each version section below carries a one-line English summary at its top (`> EN: …`) for readers arriving from the English README. The Chinese entries remain the authoritative body.

## [Unreleased]

## [0.5.0] - 2026-09-03

> EN: The knowledge set becomes a capability-keyed current-state snapshot — distilled blocks keyed by `cap/<slug>`, upserted and freshness-audited against the specs each run (carry-forward/stale/superseded retire; hand-written sections become gate-driven tidyable via `replace-hand`) — plus a three-tier dev flow (Tier 1/2/3) with the new `applying` command.

### BREAKING

- **知识集能力键制(写入侧)**:蒸馏块 marker 从 `distilled-from: <source>` 改为 `distilled-from: cap/<slug>`(slug 匹配 `^[a-z0-9-]+$`,文件内唯一),块的出处(archive 包名 / spec capability)以纯文本记在 body 内;同能力键 upsert,演进以覆盖表达、退役即删不留墓碑。写侧(`write-knowledge` 的 `replace-distilled`)只接受能力键格式:存量旧 source 块(`archive/<名>/`、`spec/<名>/`)读侧照常解析,升级后首次 `/speccode:distilling-knowledge` 运行经人工闸门映射为能力键(零工具迁移,无需预处理);未经映射的旧 source 块写入被引擎校验拒绝。
- **`append-hand` 模式退役**:`write-knowledge` 的 `append-hand` 被新 `replace-hand` 模式(手写区整写:新内容 + 整理后既有手写段一次写入,蒸馏块字节级保留)吸收,调用该模式现返回 `unknown mode: append-hand` + exit 1。插件命令层已全部切换,受影响面为裸调该 verb 的外部脚本。
- **规范布局归位**:任何 `replace-distilled` / `replace-hand` 写入都把文件归位为「手写段在前、蒸馏块在后」(手写内容逐行字节保留、仅位置重排,尾部空行折叠)——升级后首次知识集写入会产生一次性布局重排 diff,之后幂等。

### Added

- **开发流程三层分级(Tier 1/2/3)+ `applying` 命令**(第 24 个命令):proposing 定层写入 proposal.md frontmatter `tier:` 字段;Tier 1(极小)→ `/speccode:applying` 按 tasks.md 勾选清单逐条手动实现(勾选回填 + 簿记 commit);Tier 2(中小型,默认)→ writing-plans → SDD/executing-plans;Tier 3(大型/仍有不明确)→ 先 brainstorming 再 writing-plans。轻档:空 delta(specs/ 为空,如版本发布)专属 Tier 1,design.md 可省。review 无条件化:三条执行路径的完成点都必经 requesting-code-review。

### Changed

- **知识集三机制退役 → 新鲜度审查**:carry-forward、stale-by-source、superseded-by-package 退役,块存废改由每次 distilling 运行的新鲜度审查决定(真值锚 = `speccode/spec/` 主规格;删除/合并必须附理由经人工闸门;闸门 diff 只展示变化块);`consumed_archives` sidecar 降级为纯读成本控制,删除 sidecar 重跑仍是强制全量重读的官方逃生口。
- **recording-knowledge 手写段可维护**:字节冻结解除 → 闸门驱动可改,每次运行整理本次写入 topic 的手写段(合并重复、删除过时附理由;权威 = 在场用户,不以 spec 为真值)。
- 本仓 dogfood:知识集经首次闸门迁移 110 块 → 49 块(能力键化 + 同文件同键合并)。
- 门面与 spec 计数对齐:根 README 9→11 capabilities、命令清单 22→24、plugin-packaging spec 去数字化。

## [0.4.0] - 2026-09-03

> EN: Knowledge maintenance joins the unified entry — distilling/recording now run on state-registered `chore/knowledge-*` worktree branches and finish via finishing-worktree, killing the squash-only false-"unfinished" bug.

### BREAKING

- **知识维护迁入统一入口**:distilling-knowledge / recording-knowledge 不再从 trunk 裸 bootstrap `chore/knowledge-*` 维护分支(0.2.5 的 trunk 直通机制移除);改为运行于 state 登记的 `chore/knowledge-*` worktree 分支(trunk 上运行时由命令引导经 `/speccode:creating-worktree` 以 type=`chore` 创建),收尾经 `/speccode:finishing-worktree`(测试门禁 + 按 `merge_target` 的 PR 路由 + squash 探测 + 切回 merge_target)取代内置非阻塞直通 PR。升级时在途的旧裸维护分支无 state 登记,新版不识别、不可续跑——用新 slug 建分支后 cherry-pick 在途提交。知识维护现需过测试门禁(纯 docs 变更即绿)。
- 引导创建时防护大需求父实体劫持:creating-worktree 检测到父实体并提议集成基点时,知识命令 MUST 坚持基点 trunk(知识维护不挂在任何大需求下)。

### Fixed

- **squash-only 合并下的「未完成」误判**:`git branch --no-merged` 对 squash 合并过的分支永真,导致已收尾的维护分支被永远视为未完成、每次运行弹续跑询问且 PR 查重无法命中;「未完成」判定改为 state 查询(status ∈ {pending, in_progress, pr_open}),squash 合并后 state 已推进/删除,误报消失。

### Changed

- knowledge-set 主规格「知识维护分支与直通 PR」requirement 重写(7 scenarios,含 squash 误报回归锚点),经 syncing 合入;README ×2(中英)同步两命令运行位置描述。

## [0.3.0] - 2026-09-03

> EN: Two-layer branch topology (v3) — the default feature layer is removed: dev branches cut straight from trunk, integration branches become opt-in for large requirements.

### BREAKING

- **双层分支拓扑(v3,feature 层移除)**:普通需求从 trunk 直接切 `<type>/<slug>` 开发分支(git worktree,一步直达;`worktree-` 统一前缀退役);`creating-feature` / `finishing-feature` 语义改为「集成分支 + 父实体 state」的创建与收尾,仅大需求(多阶段、all-or-nothing 上线)opt-in 使用,子分支从集成当前 head 切出、终局一次 PR squash 上 trunk(children 全 completed 门禁)。
- **config v2 → v3**:`worktree_prefix` 字段退役,升级经 `/speccode:init` 字段 diff 逐项确认(接受 → 移除遗留字段;拒绝 → 整体保持 v2 原样,不存在混合态)。
- **state 目录改名 `state/features/` → `state/branches/`**:v3 schema 为 `{branch, type, worktree, merge_target(恒写), status, created_at, initial_branch}`,父实体为 `{branch, kind:"integration", children:[{slug}], …}`;v2 遗留文件双格式原样读写、不强制迁移,init 提供一次性显式迁移(`migrate-state` + reconcile 验证)。
- **合并模式四项收敛为三项**(PR+等待 / PR+不等待 / 保留):「本地 squash」模式对 trunk 目标移除——子→集成本地 squash 成为该合并形态的唯一路径;合并动作保持人点合并,`repo-merge-config` 探测非 squash-only 设置时警告 + 指路(否决插件代合并)。

### Added

- **探索记忆 per-topic 化**:新增 `list-memory` / `rename-memory` verb 与 lib `validateMemoryBranch` / `listMemory` / `renameMemory`;exploring 以 topic 列表退出(新写入落 `_exploring/<topic>`,单文件 `_exploring` 遗留读兼容),creating-feature 经原子 rename 承接探索记忆(替代旧 merge+clear)。
- **exploring 出口三岔确认**:探索结束时确认需求形态——单普通需求 / 多个独立普通需求 / 大需求(集成);agent 信号建议 + 用户确认,大需求形态与子需求清单落档 topic。
- `migrate-state` verb:`state/features/` → `state/branches/` 一次性显式迁移(逐文件 v2→v3 转换;`worktrees` 多于一条的文件跳过并提示先按 v2 收尾)。
- `repo-merge-config` verb:经 `gh`/`glab` 探测仓库合并设置(squash-only 判定),init 与 finishing-worktree 建 PR 前调用。

### Changed

- **reconcile 重写为纯路径识别**:路径位于 `config.worktree_dir` 之下的 worktree 即管辖对象,与分支名无关;ancestry / `worktree_overrides` / conflicts 归属逻辑删除(worktree↔state 1:1)。
- **children 仅身份、状态派生**:父实体 `children` 只登记 `{slug}`,任何命令 MUST NOT 写父实体状态;门禁与 status 渲染实时从子分支 state 派生(单写者原则)。
- **依赖 = 切点即依赖**:子分支一律从集成当前 head 切出,无依赖图/阻塞机制。
- `init`:幂等流程新增 v1/v2→v3 迁移 diff、state 迁移步骤与 squash-only 探测;trunk 防护从「`worktree-` 前缀」改为「非 trunk 的 `<type>/<slug>` 形态判断」(syncing / archiving / brainstorming / dispatching-parallel-agents 等 8 处同改)。
- **exploring 前置**:MUST 在 trunk 执行(不符仅警告不阻断),启动先 `fetch & pull`。
- 收尾惯例:合并动作完成后切换到目标分支(trunk 或集成分支)并 `fetch & pull`。

## [0.2.6] - 2026-09-02

> EN: New bundled PreToolUse sanitizer hook strips GLM-injected CRs from AskUserQuestion tool input, ending garbled Chinese question rendering.

### Added

- **AskUserQuestion CR 清洗 hook**:插件自带 PreToolUse hook(`hooks/hooks.json` + `lib/sanitize.mjs`),在工具执行前剥离 AskUserQuestion 参数内全部 CR(U+000D),消除 GLM 系模型 tool_use 参数注入 CR 导致的提问乱码;清洗为 lib 纯函数(可单测),hook 壳 fail-open(任何异常 exit 0 放行原输入),启用插件即生效,目标项目零污染。

## [0.2.5] - 2026-08-16

> EN: Knowledge commands (distilling/recording) now run from trunk — bootstrap a chore/knowledge-* maintenance branch + direct PR to trunk, no longer bound to feature/worktree state.

### BREAKING
- `distilling-knowledge` / `recording-knowledge`:改为从 trunk 运行(不再要求 worktree 分支);trunk 上 bootstrap `chore/knowledge-*` 维护分支 + 直通 PR 回 trunk,不再绑 feature/worktree state;维护摘要改写 trunk 级 `.speccode/memory/_knowledge.md`。在 worktree/feature 分支运行会被拒(提示回 trunk)。

## [0.2.4] - 2026-08-16

> EN: Code-intel rename (knowledge_tools → code_intel_tools); plan task checkboxes via tick-task; distilling-knowledge reads archive incrementally (consumed_archives sidecar).

### Added

- **plan 进度勾选**:新增 `tick-task --plan <P> --task <N>` verb 与引擎函数 `sdd.tickTask(planFile, n)`——把 plan 文档中 Task N 区段内 fence 外的 `- [ ]` step checkbox 勾选为 `- [x]`,`atomic.writeTextAtomic` 原子落盘,输出 `ticked`(本次勾选行)/ `already`(此前已勾选行);幂等(本次无勾选则不改写文件),Task N 不存在时 `{ok:false,error}` + exit 1 且不动 plan。
- `sdd`:导出 `scanPlan(lines)`——plan 区段扫描的单一真源(每行标注 `{inFence, taskNo}`),由 `extractTaskBrief` 与 `tickTask` 共用,保证抽取与勾选看到同一套区段。
- **code-intel-rename(代码智能工具命名调整)**:`config` 字段 `knowledge_tools` → `code_intel_tools`;`detect.mjs` 导出 `detectCodeIntelTools` / `CODE_INTEL_TOOL_DETECTORS`(原 `detectKnowledgeTools` / `KNOWLEDGE_TOOL_DETECTORS`);CLI verb `detect-knowledge-tools` → `detect-code-intel-tools`。`knowledge` 词根回归 SDD 知识集(`knowledge-set` / `recording-knowledge` / `distilling-knowledge` / `read-knowledge` 不变)。
- `syncing`:新增「capability RENAME 处理」段——delta 顶部 `<!-- speccode:rename-from: <旧cap> -->` 元数据 → `git mv speccode/spec/<旧>/ <新>/`(新目录已存在则跳过,幂等;旧新都不存在走新建主规格路径)→ 继续常规合并;旧目录随 mv 消失无空壳。含 capability 并存护栏、顶部范围(首个非空行)、旧目录不存在分支、交叉引用提示。

### Changed

- `executing-plans` / `subagent-driven-development`:在每个 task 完成点(标记 completed / ledger 写 `complete` 行、`onTaskCompleted` 之后)调用 `tick-task` 勾选 plan checkbox,`ticked` 非空时 commit `docs(speccode): tick task <N>`、为空时跳过 commit(幂等重跑无变化可提,避免 "nothing to commit" 非零退出被误判为失败)。勾选 commit 落在审查之后,不进 `review-package` 的 base..head diff;ledger 仍是崩溃恢复的唯一权威,checkbox 仅作完成态派生视图。
- `sdd` plan 扫描按 CommonMark 收紧 fence 与区段边界:开栏的 K 个反引号只能被 `>=` K 个反引号且其后无内容的行闭合(嵌套/加长 fence,如 ````markdown 块内含 ```bash,不再在块内翻转状态导致块内素材被当正文);`Task N` 区段止于下一个同级或更高级标题(不再吞掉 `## 收尾` / `## Self-Review` 等尾部章节)。影响 `task-brief` 与 `tick-task` 两者。
- **BREAKING(命令改名)**:知识集两条写入命令更名并对齐动名词构词——`/speccode:memorize` → `/speccode:recording-knowledge`(记录/直写 hand-written 段),`/speccode:promote-knowledge` → `/speccode:distilling-knowledge`(从 spec/ + archive/ 全量蒸馏)。旧命令文件删除,不留跳转 stub。
- **BREAKING(marker 写侧格式)**:蒸馏块 marker 写侧改为 `<!-- distilled-from: <source> --> … <!-- /distilled -->`;读侧永久兼容旧 `<!-- promoted-from: -->`/`<!-- /promoted -->`。存量 knowledge 文件无需手动迁移——首次运行 distilling-knowledge 经全量重建自动重写为新格式,hand-written 段逐字节保留。
- **BREAKING(内部契约)**:`write-knowledge` verb 的 mode `replace-promoted` → `replace-distilled`;lib 导出 `parsePromotedBlocks`/`replacePromotedBlocks` → `parseDistilledBlocks`/`replaceDistilledBlocks`。
- **distilling-knowledge 增量读 archive**:archive/ 读取从全量改为增量——只读"尚未消费"的归档包(经新增 sidecar `speccode/knowledge/_distilled.meta.json` 的 `consumed_archives` 追踪);已消费包整包跳过、其蒸馏块原样 carry forward(归档包不可变,无信息损失)。新增 `read-consumed-archives`/`write-consumed-archives` 两 verb 与 lib helper(`distilledMetaPath`/`readConsumedArchives`/`writeConsumedArchives`/`addConsumedArchives`/`archiveRoot`/`unconsumedArchives`/`listArchiveBundles`)。首次运行(sidecar 缺失)一次性全量读+种子;删 sidecar 即强制全量重蒸作官方逃生口(不设 `--full`)。闸门区分 stale(归档包已删)与 superseded(被新包取代)。非 BREAKING:既有 knowledge 集/旧 marker 格式/`replaceDistilledBlocks` 重建语义不变。
- 6 命令(`exploring`/`proposing`/`brainstorming`/`distilling-knowledge`/`init`/`reset`)prose:「知识库工具咨询」→「代码智能工具咨询」;`knowledge_tools` 字段引用 → `code_intel_tools`;`detect-knowledge-tools` verb 调用 → `detect-code-intel-tools`。`README.md`/`README_CN.md`(中英)字段集 + §9 标题 + 探测描述 + 命令表同步;根 `README.md`/`README_CN.md` quickstart 同步;`CLAUDE.md` Codemap MCP 段无 `knowledge_tools` 措辞,未动。
- **BREAKING(字段 + capability RENAME)**:`config.knowledge_tools` → `config.code_intel_tools`(不兼容,用户重新 `/speccode:init`);spec capability 目录 `speccode/spec/knowledge-tool-integration/` → `code-intel-tool-integration/`(经 syncing `rename-from` 机制执行);`sdd-document-lifecycle`(exploring requirement)与 `speccode-config-management`(字段集)MODIFIED 同步 `knowledge_tools`→`code_intel_tools`。

### 内部规格演进

- `knowledge-set`:晋升命令 → 蒸馏命令、直写命令 → 记录命令(RENAMED),来源标记改「写侧新格式 + 读侧双格式」;`plugin-packaging`:命令命名空间枚举 21 → 23(补录知识两条命令)。
- `knowledge-set`:蒸馏命令 archive 读取改增量(sidecar `_distilled.meta.json` 追踪 `consumed_archives`、已消费包块 carry-forward、stale/superseded 闸门区分);新增「蒸馏消费追踪」requirement。
- `sdd-document-lifecycle`:新增「plan 执行进度勾选」requirement(完成点勾选 + `ticked` 空则跳过 commit + 勾选不进审查 diff + ledger 恢复权威);「SDD 工件生成 verb」由三 verb 改为四 verb(补 `tick-task` 契约),并钉入 `task-brief`/`tick-task` 共用区段扫描、CommonMark fence 长度闭合、任务区段止于同级或更高级标题(MODIFIED)。
- `code-intel-tool-integration`(RENAMED from `knowledge-tool-integration`):字段 `knowledge_tools`→`code_intel_tools`、verb `detect-knowledge-tools`→`detect-code-intel-tools`、Purpose/requirement 名/措辞改;新增 syncing「capability RENAME 处理」requirement(delta `rename-from` 元数据 + git mv + 幂等 + 并存护栏 + 交叉引用)。
- `sdd-document-lifecycle`:MODIFIED exploring requirement(`config.knowledge_tools`→`config.code_intel_tools` 措辞随迁)。
- `speccode-config-management`:MODIFIED config 字段集(`knowledge_tools`→`code_intel_tools`)。

## [0.2.3] - 2026-08-13

> EN: Repositioned as an SDD + automated development system; worktree-dir gitignore fatal fix; unified finishing routing across four commands.

0.2.2 之后六轮收尾的 patch 发布:仓库外 worktree 目录的 gitignore 校验 fatal 修复、开发完成收尾路由统一、speccode 定位重写为「SDD + 自动化开发系统」并新增 workflow skill、归档结构去 superpowers/openspec 残留。

### Fixed

- `creating-worktree`:`worktree_dir` 指向仓库外目录时,原裸调 `git check-ignore -q <dir>` 会 `fatal` + exit 128;改用 `detect.worktreeDirIgnoreState` 三态判定——仓库外目录(`scope: outside`)静默放行、不调 git,仅仓库内分支才跑 `check-ignore`(且查询带尾斜杠以正确判定目录语义,避免 `.wt/` 模式误判)。

### Added

- `detect`:导出 `isPathInside`(路径归属判定,前缀补分隔符防 `/repo` vs `/repo-evil` 兄弟前缀误判)、`worktreeDirIgnoreState`(三态 gitignore 判定,返回 `{scope, ignored?}`)。
- CLI:`resolve-worktree-dir` verb 返回新增 `ignore` 字段(`{scope: outside | inside, ignored?: boolean}`)。

### Changed

- 收尾路由统一:`executing-plans` / `subagent-driven-development` / `creating-worktree` / `finishing-worktree` 四命令统一「`speccode/changes/<slug>/` 存在 → `syncing` → `archiving` → `finishing-worktree`,否则直接 `finishing-worktree`」收尾路由(顺序硬约束:syncing/archiving 需在 `worktree-*` 分支上运行,finishing-worktree 会移除 worktree);`finishing-worktree` 新增「未归档变更检查」warn-only(存在未归档文档时打印建议、不阻断)。
- 仓库定位重写:根 `README.md` / `README_CN.md` / `CLAUDE.md` 将 speccode 重定位为「SDD + 自动化开发系统」;新增 `skills/speccode-workflow` skill 与 `scripts/install-skills.sh` 安装脚本(本机懒加载)。
- 归档结构:移除 superpowers/openspec 残留标记(`.openspec.yaml`),归档目录统一 `propose/` 子布局。
- 双语 README 门面重构与英文 README 补全。

### 内部规格演进

- `git-workflow-lifecycle`:钉入收尾路由与对账 orphan 判定;`knowledge-tool-integration`:worktree_dir 三态 ignore 判定 delta 归位;worktree squash 演进。

## [0.2.2] - 2026-08-11

四轮 dogfood 修复:creating-feature 推断来源、reconcile orphan 虚警、memory append 边界、visual-companion scheme 门禁与死 CSS;规格层版本断言改为不随发版漂移的不变量。

### Fixed

- `creating-feature`:type 推断原扫描在 trunk 永不命中的 `speccode/changes/`(v0.1 遗留漂移);推断顺序改为「命令参数直给 > `_exploring` 记忆推断 > 询问」,推断结果预置推荐项经用户确认,不静默生效。
- `reconcile`:已完成(completed)且 git 侧已清理的 worktree 登记项不再计为 orphan——消除 squash/PR 合并后 finishing-feature 门禁对已完成 worktree 的虚警。
- `memory`:append 模式在条目边界缺失时(前条无尾换行且新条无头换行)自动补恰好一个换行符,随同一次 O_APPEND 写落盘;不再产生粘连行。
- `visual-companion`:plugin.json `homepage` 渲染前校验 http/https scheme,非法值(如 `javascript:...`)回退默认仓库 URL。

### Changed

- `visual-companion`:删除 logo 移除后失效的 4 处 CSS 属性(`.brand a` 的 `gap`、`.brand-copy` 的 `translateY`)。
- 规格演进:「memory 原子写」按模式精确化(replace=临时文件+rename;append=单次 O_APPEND,归位既有实现漂移);git-workflow-lifecycle 新增「对账 orphan 判定」、钉入 type 推断来源顺序;「plugin.json 元数据」版本断言改为「与 CHANGELOG 最新小节一致」不变量,不再钉字面量。

## [0.2.1] - 2026-08-10

自托管转换与 visual companion 品牌修正:本仓开发流程整体切换为 speccode 自托管(dogfood),规格主档迁入 `speccode/`;修复 visual-companion 的品牌残留与版本探路错误。

### Fixed

- `visual-companion` 页脚恒渲染 "Superpowers vunknown":版本探路上溯深度错误(探测 `plugins/` 下不存在的 manifest),改为读 `plugins/speccode/.claude-plugin/plugin.json`(版本与 homepage 单一数据源)。
- `creating-feature` 的 type 推断扫描 v0.1 遗留路径 `openspec/changes/`,改为 `speccode/changes/`。

### Changed

- `visual-companion` 品牌条 speccode 化:纯文本 `speccode v<version>` + 链接读 plugin.json `homepage`;移除第三方远程 logo 与遥测关停死开关(远程资源消失后开关失去作用对象),页面不再发起任何第三方远程请求;frame 标题改 `speccode Brainstorming`。
- `plugin.json` keywords 移除 `openspec`。
- 仓库自托管转换:规格主档与归档迁入 `speccode/spec/`、`speccode/archive/`(openspec/ 移除);CLAUDE.md/README 工作流节更新为 v2 原生链路;plugin-packaging 规格新增「references 自包含与品牌中立」requirement(12 → 13 条)。

## [0.2.0] - 2026-08-09

v2 全量迭代:四层拓扑收敛为三层、SDD 方法论与文档生命周期命令自包含内置、新增 hooks 与 memory 机制。含多项 BREAKING 变更,0.1 用户请按 `plugins/speccode/README.md`「从 0.1 迁移」节升级。

### ⚠ BREAKING

- **三层拓扑收敛**:删除 display 分支与 `<feature>-complete` 临时分支;`display-merge-trunk` / `display-rebase-trunk` / `display-reset-to-trunk` 三个命令下线;`finishing-feature` 简化为单 PR 直通 trunk。
- **docstrip 机制退休**:spec 文档(目标项目 `speccode/` 目录)在包括 trunk 在内的所有分支一律 git tracked;`git rm --cached` 剥离、`commit --amend` 折叠、display-reset 四步走全部移除。
- **4 个命令改名,无别名**:`start`→`creating-feature`、`develop-start`→`creating-worktree`、`develop-complete`→`finishing-worktree`、`finish`→`finishing-feature`。
- **config v2**:删除 `display`、`spec_tools`、`untracked_permanent` 字段;新增 `hooks`、`knowledge_tools`、`worktree_dir`;`version` 升 2,需重新 `/speccode:init` 升级。

### Added

- 新增 14 个命令(总数 10 → 21):文档生命周期 6 个(`exploring` / `proposing` / `brainstorming` / `writing-plans` / `syncing` / `archiving`)+ 执行方法论 8 个(`executing-plans` / `subagent-driven-development` / `dispatching-parallel-agents` / `test-driven-development` / `systematic-debugging` / `requesting-code-review` / `receiving-code-review` / `verification-before-completion`)。superpowers 能力自包含移植,目标项目零外部依赖。
- 目标项目 SDD 文档布局:`speccode/changes/<slug>/{propose,brainstorm,plan}/`、`speccode/spec/`、`speccode/archive/<YYYY-MM-DD>-<slug>/`;所有文档命令「落盘即 commit」。
- hooks(配置驱动事件点):14 个固定生命周期事件,hook 进程经 stdin 收单行 JSON,warn-only 失败语义(30s 超时,`run-hook` 永远 exit 0)。
- memory(feature 级跨会话记忆):主仓 `.speccode/memory/<type>__<slug>.md`,原子写;命令入口读/出口写,内置「超大会话主动书写」判据。
- `init` 探测代码知识库工具(understand-anything / CodeGraph / Graphify / CodeMap / LightRAG)并逐项确认登记;新增 `worktree_dir` 询问与写回。
- `creating-worktree` 融合 using-git-worktrees:worktree 目录可配置、`git check-ignore` 校验、新项目依赖 setup、基线测试、完成后引导 `proposing`。
- `finishing-worktree` 融合 finishing-a-development-branch:合并前跑全量测试、四选菜单(PR 等待 / PR 不等待 / 本地 squash / 保留)、丢弃需逐字输入 `discard`。
- 引擎新增 9 个 verb:`run-hook` / `read-memory` / `write-memory` / `detect-knowledge-tools` / `resolve-worktree-dir` / `query-pr` / `sdd-workspace` / `task-brief` / `review-package`;PR 状态查询支持 CONFLICTING 五态。

### Changed

- PR 等待从阻塞式 `wait_for_pr_merge` 改为 `query-pr` 单次查询 + 命令层轮询(30s / 30min,超时写 `pending_operation` 供 `--resume` 续跑)。
- 写 verb 强制 `--json-stdin`(从 stdin 读 JSON,缺 flag 返回 `{ok:false}`)。
- `reconcile` 的 worktree 前缀改读 `config.worktree_prefix`(带 `'worktree-'` 兜底)。
- `plugin.json` keywords 扩充(`sdd` / `tdd` / `hooks` / `memory` 等)。

### Removed

- 删除 `lib/docstrip.mjs`、`lib/waitmerge.mjs` 及对应测试。
- 移除 `spec-docs-tracking-control` capability(其「文档永远 tracked」语义并入 `sdd-document-lifecycle`)。

## [0.1.0] - 2026-07-14

首个可用版本:多需求并行开发 + spec 文档托管 + PR/MR 流程标准化的 10 命令工作流。

### Added

- 10 个 `/speccode:*` slash 命令:`init`、`start`、`develop-start`、`develop-complete`、`finish`、`status`、`display-merge-trunk`、`display-rebase-trunk`、`display-reset-to-trunk`、`reset`。
- trunk / display / feature / worktree 四层分支拓扑;spec 文档在 display 与 feature 分支 tracked、在 trunk 不跟踪。
- `.speccode/` 配置目录:`config.json` 静态全局配置、`state/features/<type>__<slug>.json` 按 feature 状态文件、`backup/` 本地文档备份区。
- 对账算法:涉及 worktree 的命令入口扫描 `git worktree list` ↔ `state/features/`,自动补齐/标记不一致,并把 `pr_open` 推进为 `completed`。
- `wait_for_pr_merge` 共享原语:30s 轮询 PR/MR,30min 超时;超时/中断写 `pending_operation` 供 `--resume` 续跑。
- 「文档剥离四步走」与 finish 阶段 `commit --amend` 折叠:保证 trunk 上功能提交为单一语义 commit,display reset 不误删文档。
- GitHub / GitLab remote 探测,自动选择 `gh` / `glab` CLI,无 CLI 时降级为打印等效命令。

[Unreleased]: https://github.com/vip-pan/speccode-development/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/vip-pan/speccode-development/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/vip-pan/speccode-development/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/vip-pan/speccode-development/compare/v0.2.6...v0.3.0
[0.2.6]: https://github.com/vip-pan/speccode-development/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/vip-pan/speccode-development/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/vip-pan/speccode-development/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/vip-pan/speccode-development/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/vip-pan/speccode-development/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/vip-pan/speccode-development/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/vip-pan/speccode-development/compare/99797ad...v0.2.0
[0.1.0]: https://github.com/vip-pan/speccode-development/commit/99797ad
