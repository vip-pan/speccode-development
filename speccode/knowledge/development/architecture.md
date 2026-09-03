<!-- distilled-from: cap/git-workflow-lifecycle -->
**双层分支拓扑(现行)**:普通需求 trunk → `<type>/<slug>` worktree 分支直达,收发两步(creating-worktree 建 + finishing-worktree 收,PR squash → trunk);大需求 opt-in 集成分支(同 `<type>/<slug>` 命名、无 worktree)+ 父实体 state(kind:"integration"),子分支从集成当前 head 切出、merge_target 写集成分支名、收尾本地 squash 汇入,终局 finishing-feature 一次 PR(children 全 completed 门禁)。演进:v0.1 四层(display/双 PR/amend)→ v2 三层 → v3 双层,中间层机制已全删;失去「trunk 无文档」物理隔离换单 PR 无 amend,trunk 携带 speccode/ 文档为默认语义,体积由 syncing+archiving 控制。

**children 仅身份**:父实体 `children` 只登记 {slug},状态唯一真源是各子分支 state,门禁与 status 渲染实时派生(有 slug 无子 state = 计划未开工,渲染 pending);任何命令 MUST NOT 写父实体 children。**依赖 = 切点即依赖**:并行兄弟同 head 切,串行后序在前序合入集成后再切,零依赖机制,串并行由人依状态板决策。**trunk 保护 squash**:合并 trunk 只经 PR(squash);插件职责收缩为 repo-merge-config 探测 + 非 squash-only 警告(不阻断);pr_tool=none 打印等效命令,否决插件代合并。

**对账算法(reconcile)是核心安全保证**:每个涉及 worktree 的命令(creating-worktree/finishing-worktree/finishing-feature/status)入口都跑,扫 `git worktree list` ↔ state(v3 `state/branches/` + v2 遗留 `state/features/` 双格式原样)。管辖 = 路径识别:路径位于 `config.worktree_dir` 之下 ∪ state 登记,与分支名/ancestry/worktree_overrides 无关(用户手工分支零误伤)。orphan 三判定 = 登记非 completed 但 git 缺失 / worktree_dir 下未登记 worktree / merge_target 指向分支不存在;completed 豁免(git 侧清理是正常终态,state 供核算);conflicts 恒 [](形状兼容)。带 --advance-pr 时查 PR 状态把 pr_open → completed(MERGED)/回退 in_progress(CLOSED)。

**worktree 状态枚举** `pending | in_progress | pr_open | completed`(pr_open 必含 pr_number);**pending_operation 挂起态与 --resume 续跑**:PR 等待(30s 轮询、30min 超时)超时或中断后把 {command, phase, pr_number, updated_at} 写分支 state,按 phase 续跑不重复已完成阶段,成功完成即清除。**finishing-worktree 门禁与菜单**:合并路径前跑全量测试(失败即停不呈现菜单),菜单按 merge_target 路由——集成分支目标 → 本地 squash 自动路径(合并 + 复测);trunk 目标 → 恰好三项 PR+等待/PR+不等待/保留;丢弃仅显式要求且逐字输入 discard。**收尾路由硬约束**:有落地文档 → syncing → archiving → finishing-worktree(顺序是硬约束,finishing-worktree 会移除 worktree);无 → 直接 finishing-worktree;C 门 warn-only 安全网。**type/slug 推断**:参数直给 → list-memory 列 topic 供选 → AskUserQuestion;推断结果 MUST NOT 静默生效。(出自 archive/2026-07-13-add-speccode-plugin、2026-08-09-speccode-v2-sdd-flow、2026-08-11-orphan-false-alarm、2026-08-11-type-inference-source、2026-08-12-finish-routing-sync-archive、2026-09-03-remove-feature-layer 等)
<!-- /distilled -->

<!-- distilled-from: cap/speccode-config-management -->
**静态配置与动态状态分离、按分支拆分状态文件**:config.json 只在 init 改、变更频率低;state 在每次开发命令改、频率高,读写特性不同分开降低冲突。多 active 分支并行时各写各的 state 文件,无锁可写;写异常退出只影响那一个分支的 state,不影响其他分支。(出自 archive/2026-07-13-add-speccode-plugin)
<!-- /distilled -->

<!-- distilled-from: cap/sdd-document-lifecycle -->
**文档全分支 tracked**:speccode/ 目录(含 spec/、changes/、archive/)在包括 trunk 在内所有分支一律 git tracked;MUST NOT 执行 `git rm --cached` 类剥离/untrack/amend 折叠操作(docstrip 机制已整体删除)。

**SDD 工作区定位与主仓定位的有意差异**:主仓根(state/config/memory 所在)统一用 `git rev-parse --path-format=absolute --git-common-dir` + dirname(linked worktree 内运行也能解析主仓 .speccode/);唯独 SDD 工作区(.speccode/sdd/<plan>/)归属当前 worktree 根,用 `git rev-parse --show-toplevel`——SDD 工件(brief/report/diff/ledger)随 `git worktree remove` 一并清理。两处定位方式不同是刻意的,不可统一。

**syncing 源契约**:delta 源 = `speccode/changes/<slug>/propose/` 四类文档;brainstorm 结论经两条路径进入——(a) brainstorming 完成时回写 propose/(默认权威路径);(b) syncing 检测 brainstorm/ 存在时先吸收未回写残余(兜底)。幂等判定按 requirement 标题存在性(ADDED 已存在即更新、MODIFIED 部分应用、REMOVED 删块、RENAMED 改标题);主 spec 既有 Purpose 不被 delta 覆盖。**capability 目录 RENAME 机制**:delta 顶部 HTML 注释元数据(rename-from)+ syncing 读取后 `git mv` 旧目录到新目录(目标已存在则跳过幂等),补 capability 级 RENAME 缺口(否则只有 requirement 级 RENAMED,旧目录空壳残留)。

**plan 执行进度勾选架构**:ledger(progress.md)是崩溃恢复唯一权威,plan checkbox 仅作完成态的派生视图、不参与恢复判断(避免双源不一致窗口);勾选经 tick-task verb(复用 extractTaskBrief 的 fence 状态机)下沉,勾选 commit 落审查通过之后、不进入 review-package 的 base..head diff;task 级粒度(无 step 级事件锚点)。(出自 archive/2026-08-09-speccode-v2-sdd-flow、2026-08-16-code-intel-rename、2026-08-16-plan-progress-tick)
<!-- /distilled -->

<!-- distilled-from: cap/session-memory -->
**memory 位置:主仓 `.speccode/memory/<type>__<slug>.md`,untracked**。备选(tracked in speccode/changes/)被否:会把会话笔记带进功能 PR、跨 worktree 合并冲突、泄漏进 trunk 历史。untracked + 主仓定位使同 feature 多 worktree 共享一份 memory(跨会话连续性核心诉求),与 state 哲学一致。

**探索记忆按 topic 分文件**:键 `_exploring/<topic>`,落盘 `.speccode/memory/_exploring__<topic>.md`(复用 branchToStateName 编码,扁平命名否决目录分层);**承接桥 = 原子 rename**:rename-memory 同目录 renameSync,slug=topic 命名约定承接(否决独立 --topic 参数——与 slug 构成双源歧义);目标已存在拒绝并报告,不覆盖不合并;承接非强制,未承接 topic 原地保留由 reset 兜底。

**memory 原子写按模式精确化**:replace 模式临时文件+rename;append 模式单次 O_APPEND 追加写(跨 worktree 并发追加互不覆盖),MUST NOT 读-改-写。两模式策略不同是刻意的,别统一。**append 条目边界规则**:既有内容非空且不以换行结尾、且追加内容不以换行开头时,边界插入恰好一个换行(同一次追加写的一部分);其余情况原样追加。**边界责任归属**:条目分隔由引擎保证,调用方传纯内容——把分隔责任下放给全部命令文档靠纪律维护是结构性陷阱,已被打破过一次。(出自 archive/2026-08-09-speccode-v2-sdd-flow、2026-08-11-memory-append-newline、2026-09-02-exploring-topic-split)
<!-- /distilled -->

<!-- distilled-from: cap/hook-event-integration -->
**hooks 设计:warn-only + 固定枚举 + 永远 exit 0**。14 个固定事件(onExplored/onFeatureCreated/onWorktreeCreated/onProposed/onBrainstormed/onPlanned/onTaskCompleted/onCodeReviewRequested/onCodeReviewCompleted/onWorktreeFinished/onFeatureFinished/onPrOpened/onSynced/onArchived;applying 每条 tasks.md 条目完成复用 onTaskCompleted)。payload 分工:引擎只补 envelope 四字段(event/timestamp/repo_root/cwd,spread 在最后、片段不可覆盖权威字段);command 与事件上下文字段(feature_branch/worktree_branch/pr_number/task)由调用方在 stdin 片段传入。未配置事件 → no-op;枚举外事件名 → 返回带 warning 的成功(防拼写静默失效)。hook 失败不改变主命令退出码,run-hook verb 是唯一永远 exit 0 的 verb(所有错误折叠进 hook 字段)。(出自 archive/2026-08-09-speccode-v2-sdd-flow)
<!-- /distilled -->

<!-- distilled-from: cap/plugin-packaging -->
**引擎/CLI/命令三层分层架构**:所有确定性逻辑(config/state 读写、原子写、对账、PR 查询)实现为 `lib/*.mjs` 下经单测的 Node.js ESM 模块;`bin/speccode.mjs` 把 lib 暴露为输出单行 JSON 的 CLI verb;命令 markdown 仅负责交互层(提问/确认/调 verb/解析 JSON/报告),不重复实现逻辑。确定性逻辑绝不写进命令 markdown,一律下沉到 lib。

**版本断言不变量化**:plugin.json 的 version 规格约束 = 合法语义化版本 + 与 CHANGELOG.md 最新版本小节一致,MUST NOT 钉死字面量(否则每次发版必然制造规格漂移)。

**visual companion 渲染防御**:渲染层不盲信元数据——homepage 渲染前 MUST 经 http/https scheme 校验,非法/非字符串/空串统一回退兜底常量;门禁放 readSpeccodeManifest(读取时消毒)而非使用点,未来新增使用点无需各自记得。references 自包含:渲染产物 MUST NOT 引用第三方品牌标识、MUST NOT 运行时请求第三方远程资源;版本号、仓库链接等元数据 MUST 读自 plugin.json,不硬编码(兜底常量除外)。死代码清零:删除元素后失去作用对象的 CSS 属性(gap、translateY)须一并清理。(出自 archive/2026-07-13-add-speccode-plugin、2026-08-11-release-0-2-2、2026-08-11-visual-companion-cleanup;visual companion 防御类按 plugin-packaging「references 自包含与品牌中立」requirement 归属,brief 默认归 documentation-facade 可改判)
<!-- /distilled -->

<!-- distilled-from: cap/code-intel-tool-integration -->
**代码智能工具探测:available / integrated 两维度独立探测,不短路**。available = 插件命中(~/.claude/plugins/installed_plugins.json)∨ CLI 命中(command -v)∨ 任意 MCP 配置(项目 .mcp.json 或用户 ~/.claude.json);integrated = 项目 .mcp.json ∨ ~/.claude.json[projects][cwd].mcpServers ∨ 项目配置目录(understand-anything 为 .ua/.understand-anything、codegraph 为 .codegraph、graphify 为 .graphify、codemap 为 .codemaker/codeindex 或 .codemaker/codemap、gitnexus 为 .gitnexus;lightrag 已移出——通用文档 RAG 非代码非图谱,属分类噪声)。登记判据 = available ∧ integrated 双 true;MCP 类「项目 .mcp.json 配置」同时即两轴,避免 MCP-only 工具被误杀。verb 输出形状 {tools:[{id, available:{value,evidence}, integrated:{value,evidence}}]},按工具聚合贴近 init 逐项确认交互。

**gitignore 校验三分支化(worktree_dir)**:worktree_dir 在仓库根之外 → {scope:'outside'} 静默继续(仓库外永不可能被跟踪,根本不调 git);仓库内未忽略 → {scope:'inside', ignored:false} 警告+询问;仓库内已忽略 → {scope:'inside', ignored:true} 静默。显式三态对象优于两态 boolean;containment 判定用纯路径(path.resolve 归一 + 前缀比较 + 尾部分隔符,防 /repo vs /repo-evil 兄弟前缀误判),与 git 解耦、可单测,不依赖 check-ignore exit 128 反推(128 还覆盖其他 fatal,反推不可靠)。确定性逻辑下沉 lib(isPathInside/worktreeDirIgnoreState 在 detect.mjs),扩展既有 verb 返回新字段优于新增独立 verb。

**命名收口**:config 字段 `code_intel_tools` 与函数/常量/verb/capability 目录跨层一致(让 knowledge 词根回归知识集);改名跨引擎/CLI/命令/文档四层同步。(出自 archive/2026-08-13-knowledge-tools-detection、2026-08-12-check-ignore-outside-repo、2026-08-16-code-intel-rename;worktree_dir 三分支按「worktree 基础目录配置」requirement 的 spec 归属挂此 capability)
<!-- /distilled -->

<!-- distilled-from: cap/documentation-facade -->
**三层文档架构分工**:根 README = marketplace 用户门面 / 插件 README = 设计文档 / CLAUDE.md = 开发文档;「门面速览 + 深链」模式——根 README 只放速览与链接,完整命令表与风险表留插件 README,两处互链,避免双份维护漂移。**根 README 12 段骨架**(自上而下):定位标语 → badges → 为什么(痛点)→ 体验 demo(模拟 AI 会话代码块,非 GIF/视频)→ Quickstart 最小闭环 → 命令速览 → 简化拓扑图 → 对比定位 → 理念 → 文档地图 → 贡献 → License。**CLAUDE.md 的第一读者是 agent**:应写 agent 最常踩的坑,而非 AI 贡献劝退书。(出自 archive/2026-08-12-readme-docs-overhaul)
<!-- /distilled -->

<!-- distilled-from: cap/knowledge-set -->
**知识集层架构(能力键制,现行)**:tracked 的 `speccode/knowledge/`(与 spec/changes/archive 平级),按主题组织 topic 文件 + `_index.md` 实扫索引。**块身份 = 能力键**:蒸馏块 marker 值为 `cap/<slug>`(同文件唯一),写入 = upsert——同能力键新块覆盖旧块、不累积历史;知识退役即删,不留墓碑块(历史叙事归 archive/ 与 CHANGELOG);块的出处(归档包名/spec capability)以纯文本括注记在 body 内。stale/superseded/carry-forward 机制已退役:块存废一律由新鲜度审查提议(真值锚 = spec/ 主规格),不由来源包存废/是否消费决定。读侧永久兼容旧 promoted-from 开标记与旧 source 值,写侧只产能力键格式(存量块迁移必经闸门,写侧校验拒旧 source 是引擎级兜底)。蒸馏块 body 不得含 marker 字符串。

**增量读(纯读成本控制)**:archive 读取基于 sidecar `_distilled.meta.json` 的 consumed_archives 只读未消费包,已消费包整包跳过;sidecar 职责限读成本控制、不参与块存废;删 sidecar 重跑 = 强制全量重读 + 重种子的官方逃生口,不设 --full flag。knowledge 根解析用当前 worktree 根(--show-toplevel),刻意区别于主仓根(--git-common-dir):tracked 文件随 worktree 各有检出。

**统一入口(0.4.0)**:distilling/recording 运行于 state 登记的 `chore/knowledge-*` worktree 分支(与其他开发分支同一入口与收尾,无特权形态)——trunk 上运行时经 reconcile 筛未完成分支询问续跑,无候选引导 creating-worktree(type=chore,基点 MUST trunk);收尾经 finishing-worktree,命令层不内置 PR 逻辑。「未完成」判定 MUST 基于 state 查询(status ∈ {pending, in_progress, pr_open}),git merge 判定(git branch --no-merged)在 squash-only 合并下对已合并分支永真,禁止依赖。维护摘要含 PR url 写 trunk 级 `.speccode/memory/_knowledge.md`(跨 feature 产物无 feature 拥有者)。

**架构分工与命名纪律**:蒸馏判断是 LLM 层(命令 prose),lib/knowledge.mjs 只承担 marker 解析、块替换、索引生成、原子写等确定性部分。命令层绝不手写 knowledge/ 文件,一律经 write-knowledge verb。命令名/块术语/marker/verb mode/lib 函数同词根一致,硬切改名不留别名;读侧双格式兼容使存量随全量重蒸自然迁移,无需迁移脚本。消费入口静默兜底:9 个认知型命令(exploring/proposing/brainstorming/writing-plans/executing-plans/subagent-driven-development/systematic-debugging/requesting-code-review/receiving-code-review)入口读 _index.md → 按需读 topic → 失败静默跳过绝不阻断(T0 兜底);接入段统一模板集中入口小节防 9 处 prose 漂移。(出自 archive/2026-08-14-knowledge-set、2026-08-15-knowledge-command-rename、2026-08-15-knowledge-set-refocus、2026-08-16-distill-incremental-archive、2026-08-16-knowledge-trunk-bootstrap、2026-09-03-knowledge-unified-entry;能力键制条目出自本需求 delta)
<!-- /distilled -->

<!-- distilled-from: cap/development-flow-tiering -->
**开发流程三层分级(现行)**:proposing 定层(Tier 1/2/3,建议 + 用户三岔确认,可改)写入 proposal.md frontmatter `tier:` 字段(单写者 = proposing 定层确认点;frontmatter 而非 state——state 是 untracked 运行时数据随收尾消亡,tier 必须随 archive 永久可读;tier 只路由门禁绝不豁免质量契约)。分层链路:Tier 1(极小)→ applying(Tier 1 专属手动执行入口,唯一准入 = tier 为 1 且无 plan;逐条实现 tasks.md 勾选清单 + 簿记 commit;tasks.md 勾选是文档编辑语义,不复用面向 plan 结构的 tick-task);Tier 2(中小型,大部分场景)→ writing-plans → SDD/executing-plans;Tier 3(大型或仍有不明确)→ brainstorming → writing-plans 硬门禁。轻档:空 delta(specs/ 为空,如版本发布 chore)专属 Tier 1,design.md 可省。勾选清单唯一性:任何时刻一份(Tier 1 = tasks.md;Tier 2/3 = plan,writing-plans 完成时把 tasks.md 降级为无勾选动作列表 + 接管标记)。review 无条件化:三条执行路径完成点全经 requesting-code-review,不存在绕过 review 的合并路径。回写义务泛化:brainstorming/writing-plans/applying 发现前序文档矛盾 MUST 回写(范围不含 frontmatter)。Tier 0 封禁:零文档直实现不允许(applying 前置检查 + finishing-worktree 门禁双防线)。

**命令衔接链(双层版)**:exploring(形态确认三岔:普通/多个独立/大需求)→ creating-worktree → proposing(定层)→ [Tier 3: brainstorming] → [Tier 2/3: writing-plans] → 执行(applying 或 SDD/executing-plans,内含 TDD/debugging/review/verification)→ (syncing → archiving) → finishing-worktree;大需求 opt-in 两端加 creating-feature 与 finishing-feature。writing-plans 终态二选一(SDD 或 executing-plans);SDD 整支审查走 requesting-code-review;debugging 联动 TDD + verification-before-completion。(出自 archive/2026-08-09-speccode-v2-sdd-flow 及 spec/development-flow-tiering;分级条目出自本次增量归档包 2026-09-03-dev-flow-tiering)
<!-- /distilled -->

<!-- distilled-from: cap/tool-input-sanitization -->
**第二 hook 家族**:插件自带 hooks/ 目录(hooks.json 顶层 hooks.PreToolUse 数组声明、matcher 匹配工具名、命令经 ${CLAUDE_PLUGIN_ROOT} 引用脚本)是 Claude Code settings hook;与 lib/hooks.mjs 的 config 生命周期事件(run-hook verb、warn-only、固定事件枚举)机制不同族,别混淆。清洗/加工类 hook 的确定性逻辑仍下沉 lib 纯函数,hook 壳只做 stdin/stdout 编排。CLAUDE.md 架构节已列为第 5 层。(出自 archive/2026-09-02-askuserquestion-cr-sanitizer)
<!-- /distilled -->
