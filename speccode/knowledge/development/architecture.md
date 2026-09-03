<!-- distilled-from: archive/2026-07-13-add-speccode-plugin/ -->
**历史:分支拓扑的演进起点**:speccode v0.1 定义 trunk / display / feature / worktree 四层分支(display 与 feature 上 spec 文档 tracked、trunk 上 untracked 是 v0.1 的核心机制,也是事故源:finish 双 PR 串行阻塞、`git rm --cached` + amend、display-reset 四步走);v2 删除 display 与 `<feature>-complete`,四层收敛为 trunk/feature/worktree 三层;v3 再删 feature 中间层收敛为双层(现行拓扑,演进细节见 2026-08-09 与 2026-09-03 两块)。

**引擎/CLI/命令三层分层架构**:所有确定性逻辑(config/state 读写、原子写、对账、PR 轮询)实现为 `lib/*.mjs` 下经单测的 Node.js ESM 模块;`bin/speccode.mjs` 把 lib 暴露为输出单行 JSON 的 CLI 子命令(verb);命令 markdown 仅负责交互层(提问/确认/调 verb/解析 JSON/报告),不重复实现逻辑。确定性逻辑绝不写进命令 markdown,一律下沉到 lib。

**对账算法(reconcile)是核心安全保证**:每个涉及 worktree 的命令(creating-worktree/finishing-worktree/finishing-feature/status)入口都跑对账,扫 `git worktree list --porcelain` ↔ state(v3 `state/branches/` + v2 遗留 `state/features/` 双格式原样)。管辖判定 = 路径识别(v3:路径位于 `config.worktree_dir` 之下;v2 的 worktree_overrides 显式覆盖与 ancestry 判定已随 v3 退役)。带 `--advance-pr` 时查 PR 状态把 pr_open → completed。

**worktree 状态枚举**:`pending | in_progress | pr_open | completed`。pr_open 表示已创建 PR/MR 但尚未合并,此时条目 MUST 含 pr_number。对账遇到 pr_open 的 worktree 查询 PR:MERGED → 推进 completed + completed_at;CLOSED → 回退 in_progress;OPEN → 保持。

**pending_operation 挂起态与 --resume 续跑**:长阻塞操作(PR 等待,30s 轮询、30min 超时)超时或中断后,把挂起状态写入对应分支 state 文件的 `pending_operation` 字段(结构 `{command, phase, pr_number, updated_at}`)。挂起态按分支维度隔离,--resume 从该字段按 phase 续跑,不重复已完成阶段。成功完成后 pending_operation 被清除(或随 state 文件删除)。

**静态配置与动态状态分离、按分支拆分状态文件**:config.json 只在 init 改、变更频率低;state 在每次开发命令改、频率高,两者读写特性不同分开降低冲突。多 active 分支并行时各写各的 state 文件,无锁可写;写异常退出只影响那一个分支的 state,不影响其他分支。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-09-speccode-v2-sdd-flow/ -->
**v2 三层拓扑收敛(v3 已再收敛为双层)**:删除 display 分支与 `<feature>-complete` 临时分支,四层收敛为 trunk/feature/worktree 三层。finishing-feature 简化为「单 PR → trunk」(阻塞等合并),不再双 PR 串行、不再 amend 改写、不再强推。Trade-off:失去「trunk 无文档」的物理隔离,换取单 PR 无 amend;trunk 携带 speccode/ 文档被接受为默认语义,其体积由 syncing 合并 + archiving 移动控制。(v3 起 feature 中间层退役为 opt-in 集成分支,见 2026-09-03 块。)

**docstrip 机制整体退休**:文档(speccode/ 目录)在包括 trunk 在内所有分支一律 git tracked;`git rm --cached` 剥离、amend 折叠、display-reset 四步走全部删除;lib/docstrip.mjs + tests 物理删除。残余正面语义(文档永远 tracked)并入 sdd-document-lifecycle 的「文档全分支 tracked」requirement。该 capability 全部 6 条 requirement 都锚定在被删机制上,改写后只剩一句不如移除。

**SDD 工作区定位与主仓定位的有意差异**:主仓根(state/config/memory 所在)统一用 `git rev-parse --path-format=absolute --git-common-dir` + dirname(让 linked worktree 内运行的命令也能解析到主仓的 .speccode/);唯独 SDD 工作区(.speccode/sdd/<plan>/)归属当前 worktree 根,用 `git rev-parse --show-toplevel`——这样 SDD 工件(brief/report/diff/ledger)随 `git worktree remove` 一并清理。两处定位方式不同是刻意的,不可统一。

**hooks 设计:warn-only + 固定枚举 + 永远 exit 0**。14 个固定事件(onExplored/onFeatureCreated/...)。payload 分工:引擎只补 envelope 四字段(event/timestamp/repo_root/cwd,权威、片段不可覆盖);command 与事件上下文字段(feature_branch/worktree_branch/pr_number/task)由调用方在 stdin 片段传入。未配置事件 → no-op;枚举外事件名 → 返回带 warning 的成功(防拼写静默失效)。hook 失败不改变主命令退出码,run-hook verb 是唯一永远 exit 0 的 verb。

**memory 位置:主仓 .speccode/memory/<type>__<slug>.md,untracked**。备选(speccode/changes/<slug>/memory.md tracked)被否:会把会话笔记带进功能 PR、跨 worktree 产生合并冲突、泄漏进 trunk 历史。untracked + 主仓定位使同 feature 多 worktree 共享一份 memory(跨会话连续性的核心诉求),与 state 哲学一致。命名复用 branchToStateName 双下划线规则。

**syncing 源契约刻意偏离 opsx 单源语义**:delta 源 = speccode/changes/<slug>/propose/ 四类文档;brainstorm 结论经两条路径进入——(a) brainstorming 命令完成时回写 propose/(默认权威路径);(b) syncing 检测到 brainstorm/ 存在时先吸收其未回写残余(兜底)。双重路径不是冗余:(a) 是常态,(b) 处理用户跳过/中断回写。幂等判定按 requirement 标题存在性合并(ADDED 已存在即更新、MODIFIED 部分应用、REMOVED 删块、RENAMED 改标题)。

**finishing-worktree 测试门禁与选项菜单**:任何合并路径前跑全量测试,失败即停不呈现菜单(A green run only proves the tree it ran on)。v3 菜单按 `merge_target` 路由:目标为集成分支 → 本地 squash 自动路径(合并 + 复测,不问 PR);目标为 trunk → 菜单恰好三项:PR+等待 / PR+不等待 / 保留(v2 的「本地 squash」菜单项对 trunk 死亡)。丢弃不进菜单,仅显式要求时进入且须逐字输入 `discard`。

**命令衔接链(SDD 文档生命周期,双层版)**:exploring(形态确认)→ creating-worktree → proposing → [brainstorming] → writing-plans → 执行(subagent-driven-development 或 executing-plans,内含 TDD/debugging/review/verification)→ (syncing → archiving) → finishing-worktree;大需求 opt-in 时两端加 creating-feature(建集成分支 + 父实体)与 finishing-feature(children 全 completed 门禁 → 单 PR → trunk)。writing-plans 终态二选一(SDD 或 executing-plans);SDD 整支审查走 requesting-code-review;debugging 联动 TDD + verification-before-completion。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-memory-append-newline/ -->
**memory 原子写按模式精确化**:`replace` 模式 MUST 临时文件+rename(异常退出不留半写);`append` 模式 MUST 单次 O_APPEND 追加写(跨 worktree 并发追加互不覆盖),MUST NOT 读-改-写。两模式原子写策略不同是刻意的,别"统一"。

**append 条目边界规则**:既有内容非空且不以换行结尾、且追加内容不以换行开头时,在边界插入恰好一个换行(作为同一次追加写的一部分);其余情况原样追加,不做更多规范化。分隔判定需先读现有内容,读-写之间理论上可被并发追加穿插——代价至多一条粘连行(装饰性),绝不丢数据;O_APPEND 不丢写 invariant 保持。

**边界责任归属**:条目分隔由引擎保证,调用方传纯内容,不依赖每个调用点自觉。把分隔责任下放给每个命令文档靠纪律维护是结构性陷阱,已被打破过一次。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-orphan-false-alarm/ -->
**reconcile orphan 判定按状态区分**:"state 有登记但 git 缺失"的 worktree,仅当 status ≠ completed 才计 orphan。completed + git 缺失是设计的正常终态(finishing-worktree 的 PR 合并与本地 squash 两路径完成后均删 worktree+分支),state 保留 completed 记录供进度核算直至 finishing-feature 删 state。

**orphan 语义应在引擎层修正,不在命令层补丁**:orphan 定义本身错了,下游 finishing-feature/status 命令层各自过滤是治标——多个消费面仍会虚警。修正放 reconcile.mjs 规则 3。

**state 侧 orphan 判定此前无契约**,只有 git 侧"非标准前缀"条款;两者语义不合,state 侧规则需单独入主规格。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-type-inference-source/ -->
**信号源时序错位是死代码根因**:creating-feature 的 type 推断扫描 `speccode/changes/`,但该目录在 trunk(creating-feature 运行时刻)永不存在——proposing 在 worktree 才创建、archiving 合并前移走。扫描逻辑从未生效,是 v0.1 扫 openspec/changes/ 时代的遗留漂移。

**推断来源顺序**:命令参数直给(合法则直接采用)→ `_exploring.md` 记忆非空时从探索结论推断 → AskUserQuestion 询问。推断结果 MUST NOT 静默生效,以预置推荐项形式经用户确认。MUST NOT 以扫描 `speccode/changes/` 作为推断来源。

**主规格只约束命名格式不够**:必须把推断来源顺序钉进契约,否则此类漂移无契约可守。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-visual-companion-cleanup/ -->
**渲染层不盲信元数据**:visual companion 的 homepage 在渲染前 MUST 通过 http/https scheme 校验,非法值回退兜底常量。门禁放在 readSpeccodeManifest(读取时消毒)而非 brandMarkup 使用点——消毒时机早,未来新增使用点无需各自记得。

**references 自包含**:渲染产物 MUST NOT 引用第三方品牌标识,MUST NOT 运行时请求第三方远程资源;版本号、仓库链接等元数据 MUST 读自 plugin.json,MUST NOT 硬编码(兜底常量除外)。

**死代码清零**:删除 logo 后失去作用对象的 CSS 属性(gap、translateY)须一并清理,样式表只含有效规则。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-check-ignore-outside-repo/ -->
**gitignore 校验三分支化**:worktree_dir 在仓库根之外 → `{scope:'outside'}` 静默继续(仓库外目录永不可能被 git 跟踪);仓库内未忽略 → `{scope:'inside', ignored:false}` 警告+询问;仓库内已忽略 → `{scope:'inside', ignored:true}` 静默。

**三分支对象而非两态 boolean**:显式区分三态,outside 分支根本不调用 git,从根上消除 fatal 噪音与 exit 128 误读;两态方案仍需命令层对 inside 再跑 check-ignore,保留误读风险。

**containment 判定用纯路径**:path.resolve 归一 + 前缀比较 + 尾部分隔符(防 /repo vs /repo-evil 兄弟前缀误判),与 git 解耦、可单测。不依赖 `git check-ignore` exit 128 反推(128 还覆盖其他 fatal 如非 git 仓库,反推不可靠)。

**确定性逻辑下沉 lib**:isPathInside / worktreeDirIgnoreState 在 detect.mjs,命令层只按 verb 返回的 ignore 字段分支。扩展既有 verb 返回新字段(向后兼容)优于新增独立 verb(避免二次往返)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-finish-routing-sync-archive/ -->
**开发完成收尾路由硬约束**:有落地文档(`speccode/changes/<slug>/` 存在)→ syncing → archiving → finishing-worktree;无 → 直接 finishing-worktree。顺序是硬约束:syncing/archiving 的守卫要求当前为非 trunk 的 `<type>/<slug>` 分支,而 finishing-worktree 会 `git worktree remove` 移除 worktree,故 sync/archive 只能在 finishing-worktree 之前执行。

**条件化路由基于目录是否存在**:而非一律走 syncing/archiving——后者在无需求目录时报错退出,"暂不落地文档"路径必须直接 finish。

**C 门 warn-only 安全网**:finishing-worktree 合并选项前 `test -d speccode/changes/<slug>/` 检查未归档变更,存在则 warn-only 提醒,不阻断。C 门实现用命令层朴素 fs 检查,与标记文件探测先例一致;为朴素 fs 检查扩展核心对账算法(reconcile 透出字段)属过度设计。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-release-0-2-2/ -->
**版本断言不变量化**:plugin.json 的 version 规格约束改为"合法语义化版本 + 与 CHANGELOG.md 最新版本小节一致",MUST NOT 把 version 钉死为字面量(否则每次发版必然制造规格漂移)。「版本号控制更新」scenario 的具体版本改为括号内示例性质;「旧命令名不再出现」WHEN 用 `0.2.x` 而非具体版本。规格钉版本字面量与"版本发布纪律"自身冲突。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-readme-docs-overhaul/ -->
三层文档架构分工(根 README = marketplace 用户门面 / 插件 README = 设计文档 / CLAUDE.md = 开发文档)与「门面速览 + 深链」模式:根 README 只放速览与链接,完整命令表与风险表保留在插件 README,两处互链,避免双份维护漂移。

根 README 用户门面 12 段骨架(自上而下):定位标语 → badges → 为什么(痛点) → 体验 demo(模拟 AI 会话代码块,非 GIF/视频) → Quickstart 最小闭环 → 命令速览 → 简化拓扑图 → 对比定位 → 理念 → 文档地图 → 贡献 → License。

CLAUDE.md 的第一读者是 agent,应写 agent 最常踩的坑(非 AI 贡献劝退书)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-13-knowledge-tools-detection/ -->
知识工具探测采用「可用 available / 集成 integrated」两维度独立探测模型,不短路。每个工具同时评估两轴并各自记录证据:
- available = 插件命中(installed_plugins.json)∨ CLI 命中(command -v)∨ 任意 MCP 配置(项目 .mcp.json 或用户 ~/.claude.json)
- integrated = 项目 .mcp.json ∨ ~/.claude.json[projects][cwd].mcpServers ∨ 项目配置目录(.ua/.codegraph/.graphify/.codemaker/codemap/.lightrag)

登记判据 = available ∧ integrated 双 true。MCP 类工具「项目 .mcp.json 配置」同时即「可用」与「集成」,两维度塌缩,故项目级 MCP 计入两轴,避免 MCP-only 工具被误杀。

verb 输出形状 `{tools:[{id, available:{value,evidence}, integrated:{value,evidence}}]}`,按工具聚合(非拆两数组),贴近 init「逐项确认」交互。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-14-knowledge-set/ -->
知识集层架构:tracked 的 `speccode/knowledge/`(与 spec/changes/archive 平级),按主题组织 topic 文件 + `_index.md` 检索入口。来源标记用段落级 marker `(开标记 promoted-from: <source>)` … `(闭标记 /promoted)` 围住蒸馏块,文件默认 hand-written,晋升只重写块内、块外字节级保留。

架构分工:蒸馏是 LLM 判断(只在命令层 prose 做);lib/knowledge.mjs 只承担 marker 解析、块替换、索引生成、原子写等文本确定性部分(遵守「确定性逻辑下沉 lib」不变量)。

晋升路径 = 全量重蒸重写(幂等、无游标、无合并腐烂),exploring 决策「增量游标 = git 派生」被吸收废弃——知识集规模小、晋升低频,全量代价可忽略。

knowledge 根解析用当前 worktree 根(`--show-toplevel`),刻意区别于主仓根(`--git-common-dir`):tracked 文件随 worktree 各有检出。两处定位方式不同是刻意的,不得「统一」。

消费入口静默兜底架构:9 个认知型命令(exploring/proposing/brainstorming/writing-plans/executing-plans/subagent-driven-development/systematic-debugging/requesting-code-review/receiving-code-review)入口读 `_index.md` 索引 → 按需读 topic → 失败静默跳过,绝不阻断主流程(T0 兜底,永不报错)。接入段文案统一模板,集中在入口小节,防 9 处 prose 漂移。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-15-knowledge-command-rename/ -->
命令命名应见名知义、术语栈同词根:命令名 ↔ 块术语 ↔ marker ↔ verb mode ↔ lib 函数一致。动名词构词对齐全部命令的主流约定(`creating-feature`/`finishing-feature`/`proposing`/`syncing`/`archiving`),避免裸动词与动宾混用构词。

marker 迁移策略:写侧只产新格式,读侧永久双格式兼容旧格式,存量文件随首次全量重建自然迁移,无需专门迁移脚本。双格式解析时新旧混排按出现顺序统一进块列表,同一文件 start/end 格式必须匹配。

verb mode 与 lib 函数硬切改名不留别名,避免双词表长期并存(消费者只有命令文件 + 测试,单提交同步两侧)。旧命令文件删除不留跳转 stub(pre-1.0 dogfood 阶段,CHANGELOG 记 breaking 即可)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-15-knowledge-set-refocus/ -->
知识集与外部 RAG 的职责分界:knowledge-set(写侧,tracked、`speccode/knowledge/`、promote/memorize 双入口、人工闸门)只策展 SDD 过程知识;业务知识交由外部 RAG(未来经读侧 knowledge-tool-integration 车道接入)。读侧车道(codemap/understand-anything 探测登记、advisory 咨询、静默回退)与写侧车道沿「业务 vs 开发过程」轴磨利分界。lib 层本就 topic 无关——`listTopics` 扫目录实查、`buildIndex` 接受任意 sections;骨架 topic 清单与两段式索引只硬编码在命令 markdown 与 spec 中,收窄骨架天然兼容 lib。索引 `_index.md` 由实扫现有 topic 文件按顶层目录名分组生成,不硬编码固定 section 清单——旧项目空 topic 被闸门清空后索引条目自然消失,索引永远反映真实盘面。business/* 退场用「收窄骨架 + 闸门日落」(A1+日落),而非保留指针(A2)或纯软退役(A3):A2 在 RAG 未落地前是空指向;A3 边界长期模糊;闸门日落复用 promote 已有的「展示→人工裁决」交互。日落规则通用化:蒸馏目标 = 骨架 6 topic ∪ `development/` 下用户自建 topic,其余既有 topic 的 promoted 块一律在闸门内建议移除,不特设 business 规则。review 并入 pitfalls,不单列 topic:宽骨架闲置率高,pitfalls 语义扩展为「踩坑 + 评审反复问题模式与团队评审共识」。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-code-intel-rename/ -->
命名收口原则:config 字段 `knowledge_tools` 改为 `code_intel_tools`,让 `knowledge` 词根回归知识集(knowledge-set / recording-knowledge / distilling-knowledge / read-knowledge / write-knowledge)。`knowledge_tools` 本质是代码结构理解工具(code intelligence:索引 `search_code` + 图谱 `find_symbol`/`get_call_chain`/`get_type_hierarchy`/`get_dependencies`/`query_cypher`),不是知识库。改名跨四层同步:引擎层(detect.mjs 常量/函数名)、CLI 层(bin verb)、命令层(6 命令 prose)、文档层(README 中英 + CLAUDE.md)。spec 层 capability 目录 RENAME 是层 3 彻底性的要求。capability 目录 RENAME 机制扩展:syncing 是 agent 驱动 prose(无 lib 合并函数),delta 顶部加 HTML 注释元数据 `(rename-from: 旧cap)`,syncing.md 加「capability RENAME 处理」段(合并前扫描元数据 → `git mv` 旧目录到新目录,新目录已存在则跳过幂等 → 继续常规合并)。否决空壳残留(REMOVED 旧 requirement 后剩空壳需手动 rm)、syncing 阶段手动 mv(不可复现)、implementing 阶段直接 mv(违反「主规格改动走 syncing」约定)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-distill-incremental-archive/ -->
增量蒸馏架构:archive 读取从全量改为增量,只读「尚未消费」的归档包(基于 `_distilled.meta.json` 的 `consumed_archives`)。已消费包整包跳过(含 propose/design/brainstorm),其既有蒸馏块原样 carry forward 进候选列表(不重蒸)——归档包不可变,重蒸仅会产出相同内容,无信息损失。carry-forward 是把「全量重建」与「增量读」调和的关键:distiller 把已消费包的既有块(取自 `read-knowledge --blocks` 现状侧)原样放入候选列表;`replaceDistilledBlocks` 见其 source 在列表→保留,不误删;stale 源(source 包已删)不在列表→删除(既有语义覆盖)。故不改 lib 重建语义,只改命令层候选构造 + sidecar 追踪。消费追踪 = sidecar `_distilled.meta.json`(`{consumed_archives:[]}`),atomic 写入(复用 `writeJsonAtomic`)。否决「时间戳截止」(难支持选择性重读、同日多包排序坑)与「复用 distilled 块 source 反查」(读过无产出的包永被重读)。全量重建逃生口 = 删 sidecar 再跑(等价 `--full`,复用首次引导机制),不实现 `--full` flag——YAGNI 不增命令/verb/flag 表面。stale vs superseded 闸门区分:stale(source 包已删,自动标)vs superseded(包仍在但知识被新包取代,distiller 在候选列表省略/更新,闸门标「superseded by 新包名」,用户确认)。无需改 lib——distiller 通过候选列表构造即可达成。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-knowledge-trunk-bootstrap/ -->
knowledge 命令 memory trunk 级机制:维护摘要写 `.speccode/memory/_knowledge.md`(trunk 级保留键),不绑任何 feature——distilling 跨所有 feature 产物,没有任何 feature「拥有」一次跨 feature 蒸馏。trunk 级保留键 `_knowledge` 与探索 topic 键 `_exploring/<topic>` 校验收口为 lib `validateMemoryBranch`(单堆 `_exploring` 遗留读兼容)。lite 而非 heavy:knowledge≠feature,`/speccode:status` 不跟踪 knowledge PR(docs,非 feature)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-plan-progress-tick/ -->
plan 执行进度勾选架构:plan 文档(`speccode/changes/<slug>/plan/*.md`)是 tracked 设计文档,随 PR 上 trunk;每个 Task N 下含多个 `- [ ]` step checkbox。引入 plan checkbox 勾选补 tracked 层的高层进度可视化,不取代 ledger。勾选粒度 = task 级(plan checkbox 是 step 级,但所有现有进度机制 todo/ledger/onTaskCompleted payload 是 task 级;无 step 级事件锚点,step 级收益不抵复杂度)。主从关系:ledger(`progress.md`)是崩溃恢复唯一权威,plan checkbox 仅作完成态的派生视图,不参与恢复判断——避免「勾了 [x] 但 ledger 未写就崩溃」的双源不一致窗口。勾选 commit 须在审查通过后(完成点),永远在 review-package 的 base..head diff 之外,不污染任务审查者 diff。commit 策略:单独立 commit 折进现有簿记点(写 ledger complete 行 + onTaskCompleted),commit message 统一 `docs(speccode): tick task N`。谁改:控制器改(勾选 checkbox 是进度簿记,与写 ledger 同类同点,不违反「控制器不亲自改文件」铁律——该铁律针对代码实现会跳过审查、污染上下文)。勾选逻辑经引擎 verb 下沉(`tickTask` 复用 `extractTaskBrief` 的 fence 状态机),命令层纯 prose 调用——该逻辑 prose 写不了,必须下沉 lib。
<!-- /distilled -->

<!-- distilled-from: archive/2026-09-02-askuserquestion-cr-sanitizer/ -->
第二 hook 家族:插件自带 hooks/ 目录(hooks.json 顶层 hooks.PreToolUse 数组声明、matcher 匹配工具名、命令经 ${CLAUDE_PLUGIN_ROOT} 引用脚本)是 Claude Code settings hook;与 lib/hooks.mjs 的 config 生命周期事件(run-hook verb、warn-only、固定事件枚举)机制不同族,别混淆。清洗/加工类 hook 的确定性逻辑仍下沉 lib 纯函数,hook 壳只做 stdin/stdout 编排。CLAUDE.md 架构节已列为第 5 层。
<!-- /distilled -->

<!-- distilled-from: archive/2026-09-03-remove-feature-layer/ -->
**双层分支拓扑(v3)**:feature 中间层退役——普通需求 trunk → `<type>/<slug>` worktree 分支直达(worktree 建于 `config.worktree_dir` 之下,`worktree-` 硬前缀与 `config.worktree_prefix` 退役,config 2→3),收发两步:creating-worktree 开、finishing-worktree 收(PR squash → trunk)。大需求 opt-in 集成分支(同 `<type>/<slug>` 命名、无 worktree)+ 父实体 state(`kind:"integration"`);子分支从集成当前 head 切出,`merge_target` 写集成分支名,收尾走本地 squash 汇入集成,终局 finishing-feature 一次 PR(children 全 completed 硬门禁,派生读取)。**children 仅身份**:父实体 `children` 只登记 `{slug}`,状态唯一真源是各子分支 state,门禁与 status 渲染实时派生(有 slug 无子 state = 计划未开工,渲染 pending);任何命令 MUST NOT 写父实体。**reconcile C 路径识别**:管辖 = worktree 路径位于 `config.worktree_dir` 之下,与分支名/ancestry/`worktree_overrides` 无关(用户手工分支零误伤);orphan 三判定 = 登记非 completed 但 git 缺失 / worktree_dir 下未登记 worktree / `merge_target` 指向分支不存在;completed 豁免;`conflicts` 恒 `[]`(形状兼容)。**依赖 = 切点即依赖**:并行兄弟同 head,串行后序在前序合入后再切,零依赖机制,串并行由人依状态板决策。**squash 强制 = 平台设置 + 探测指路**:插件职责收缩为 `repo-merge-config` 探测 + 警告,否决插件代合并。
<!-- /distilled -->

<!-- distilled-from: archive/2026-09-02-exploring-topic-split/ -->
**探索记忆按 topic 分文件**:`_exploring` 单堆文件在多需求交错探索时结论无归属,产生错误归属与静默丢失。改为键形式 `_exploring/<topic>`,落盘 `.speccode/memory/_exploring__<topic>.md`(复用 `branchToStateName` 编码,`memoryPath` 零改动);扁平命名,否决目录分层(各 topic 文件生命周期同构:append → rename 消亡,聚合视图属展示层)。**承接桥 = 原子 rename**:`renameMemory('_exploring/<topic>', '<type>/<slug>')` 同目录 renameSync;slug=topic 命名约定承接(否决独立 `--topic` 参数——与 slug 构成双源歧义);目标已存在拒绝并报告,不覆盖不合并(与 reconcile「绝不随意归属」同哲学);承接非强制,未承接 topic 原地保留由 reset 兜底。**校验收口 lib**:read/write-memory 的 branch 校验收口为 `validateMemoryBranch`(保留键 `_knowledge`、`_exploring` 遗留读兼容、`_exploring/<topic>` topic 经 validateSlug、回退 validateBranch);新增 `list-memory`/`rename-memory` verb,命令层不碰文件系统细节。
<!-- /distilled -->

<!-- distilled-from: archive/2026-09-03-knowledge-unified-entry/ -->
knowledge 命令统一入口架构(0.4.0,取代 0.2.5 trunk-bootstrap):distilling/recording 运行于 state 登记的 `chore/knowledge-*` worktree 分支——trunk 上运行时经 reconcile `features` 筛选未完成分支询问续跑,无候选则引导 `/speccode:creating-worktree` 以 type=chore 创建(基点 MUST `config.trunk`,防护大需求父实体劫持集成基点);收尾经 `/speccode:finishing-worktree`(测试门禁 + PR 路由 + squash 探测 + 切回 merge_target),命令层不再内置 PR 创建/查重。「未完成」判定 MUST 基于 state 查询,git merge 判定(如 `git branch --no-merged`)在 squash-only 合并下对已合并分支永真,禁止依赖。未完成判定语义:分支「未完成」= reconcile 输出 `features` 中该分支存在且 `status ∈ {pending, in_progress, pr_open}`;`completed` 或无登记即完成/不存在。state 是唯一判定来源——squash 合并后 finishing-worktree 已推进/删除 state。
<!-- /distilled -->
