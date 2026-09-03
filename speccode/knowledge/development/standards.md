<!-- distilled-from: cap/speccode-config-management -->
**原子写**:所有 .speccode/config.json 和 state(v3 `state/branches/*.json`,v2 遗留 `state/features/*.json` 同策)写入必须走 atomic.writeJsonAtomic(临时文件 `${path}.${pid}.tmp` + renameSync 覆盖);命令层经 write-config/write-state verb 间接调用,绝不手写 JSON。临时文件 PID 后缀防并发碰撞;rename 之前崩溃留临时文件但主文件仍是旧的(「上一次正确状态」远好于半写)。

**写 verb 必须 --json-stdin**:write-config/write-state/write-memory 从 stdin 读 JSON 而非 argv,避免超长/转义;缺 flag 必返 {ok:false, error} + exit 1。--json-stdin 是布尔 flag(parseArgs 置 true),payload MUST JSON.parse(readStdin()),绝不 JSON.parse(jsonStdin)——重蹈会解析失败。所有时间字段 ISO 8601 UTC,new Date().toISOString(),MUST 能被 Date.parse() 解析。

**init 字段级幂等**:二次 init 按字段逐个询问 [旧值]→[新值] diff 而非整体覆盖;值未变跳过;state/ 目录二次 init 不被读改删;写前 MUST 备份 config.json.bak.<timestamp>。(出自 archive/2026-07-13-add-speccode-plugin、2026-08-09-speccode-v2-sdd-flow、2026-08-16-distill-incremental-archive)
<!-- /distilled -->

<!-- distilled-from: cap/git-workflow-lifecycle -->
**命名规则**:功能分支 `<type>/<slug>`,type ∈ {feature, bugfix, refactor, chore},slug 匹配 /^[a-z0-9-]+$/;开发分支(worktree)与集成分支同规。state 文件名 `<type>__<slug>.json`(双下划线——slug 不含下划线故 __ 无歧义;文件名只需唯一 + 可读,不需可逆,内容已有全名字段)。**身份锚点(前缀退役)**:v2 的 worktree- 硬前缀与 config.worktree_prefix 已随 v3 退役,身份锚点 = 路径位于 worktree_dir 之下 ∪ state 登记,而非分支名前缀——用户手工分支零误伤。

**reset 拒绝有 active 分支,不接受 --force**:任何 state 文件存在即拒绝;有未完成分支时正确路径是先收尾(finishing-worktree/finishing-feature),不是 reset。**speccode 不主动删 git 分支**:与「插件与 git 解耦」一致;分支合并后保留作历史(收尾只删父实体 state)。

**推断永不静默生效**:预置推荐项 + 用户确认护栏,启发式误判由护栏覆盖;复用注记——命令步骤两次读同一文件时在后一处加注记说明复用。**手动/auto 模式约定**:手动模式 MUST 用 AskUserQuestion 询问;auto 模式自动衔接;判断依据不充分时 MUST 默认询问(D16 不确定先询问:误判为自动代价可控且留痕,误判为询问仅多一次打断)。**状态派生不存储(单写者原则)**:children 仅身份登记,任何命令 MUST NOT 写父实体 children 状态——并行写互踩的竞态在结构上消灭,而非用锁管理。**迁移不静默**:v2→v3 双格式运行(旧文件按旧语义原样读写,不做内存翻译),迁移仅 init 显式(预览→确认→转换→reconcile 验证),拒绝则保持旧版照常跑——绝不静默挪用户数据。**守卫用形态判断**:trunk 防护 = 「非 trunk 的 `<type>/<slug>` 分支」形态判断即可,不要求 state 命中。**BREAKING 迁移窗口**:选 trunk 干净时做,在途数据建议先收尾再升级。(出自 archive/2026-07-13-add-speccode-plugin、2026-08-11-type-inference-source、2026-08-12-finish-routing-sync-archive、2026-09-03-remove-feature-layer)
<!-- /distilled -->

<!-- distilled-from: cap/plugin-packaging -->
**裸调约定**:命令正文写 `speccode.mjs <verb> --cwd .`,依赖插件 bin/ 在启用期间被加入 Bash 工具 PATH;speccode.mjs MUST 具 #!/usr/bin/env node shebang 与 +x。已知限制:PATH 仅插件启用时生效,手动终端调试用全路径 node plugins/speccode/bin/speccode.mjs。process.argv[1].endsWith('speccode.mjs') 守卫在裸调下安全。

**版本发布纪律**:bump plugin.json version 的提交 MUST 同一提交(或同一 PR)同步更新根 CHANGELOG.md 对应版本小节;未完成的 version bump MUST NOT 合入 trunk。发版 MUST 打 `v<version>` tag 并建 GitHub Release(notes 摘自 CHANGELOG);Release 是给人看的标记,更新检测实际走 marketplace git 拉取 + plugin.json version 比对,Release 不触发自动更新。**CHANGELOG 格式**:中文条目为主体 + Keep a Changelog 骨架(Added/Changed/Fixed/Removed + semver 比较链接),版本小节顶部加一句英文 highlights(控成本);CHANGELOG 是版本号与测试数量的单一数据源。**patch vs minor 判据**:全部为修复与小变更、无新能力、无 BREAKING 不发 minor/major(不夸大变更面);Fixed 对应修复项,Changed 收录清理与规格演进,对照 squash commit 逐一核对防漏。**syncing 顺序**:先 bump+CHANGELOG 再 sync,使「version 与 CHANGELOG 最新小节一致」合并后立即为真。**BREAKING 需在 CHANGELOG 显式标注**(含升级路径)。

**命令 markdown 规范**:全程中文交互;frontmatter 仅 description(name/category/tags 已于 0.5.1 移除——官方文档明文 commands/*.md 忽略 name,调用名=文件名,VS Code 扩展会把 name 误用为菜单条目致 Unknown command);未知 verb 或抛错 → {ok:false, error} + exit 1。(出自 archive/2026-07-13-add-speccode-plugin、2026-08-07-restructure-as-claude-code-plugin、2026-08-09-plugin-release-process、2026-08-09-speccode-v2-sdd-flow、2026-08-10-release-0-2-1、2026-08-11-release-0-2-2;0.5.1 由 vscode-slash-command-name 变更修正,归档 archive/2026-09-04-vscode-slash-command-name)
<!-- /distilled -->

<!-- distilled-from: cap/documentation-facade -->
**多语言维护纪律**:双语文档结构 MUST 一一对应(根 README 12 段骨架 / 插件 README §1-14 节号),任何内容改动 MUST 同步全部语言版本;结构对齐(段/节为锚)是双语漂移的防线。翻译以中文版节号清单为纲;专名保留原文(/speccode: 命令名、worktree/trunk/feature/spec 等术语不意译);英文版无残留中文段落(代码块与 toggle 文本除外)。

**文档版本信息不漂移纪律**:仓库文档 SHALL NOT 硬编码随时间漂移的信息——插件版本号、测试用例数量、命令总数;需要引用时以链接指向 CHANGELOG.md 或读自 plugin.json(单一数据源);涉及数量 MUST NOT 写死字面量。手维计数漂移的根治 = 去掉计数本身(改数字是治标,每次规格变动仍需手动同步)。badges 版本用 shields dynamic/json 从 raw plugin.json 读 $.version,绝不硬编码;shields 静态 version badge 需手工同步,重新引入漂移——demo 中基线测试写「全通过」不写具体数目。**互链矩阵 4 组链接钉死**(根 EN↔CN、插件 EN↔CN、根→插件同语言、插件门面指针→同语言根 README):散落各文档靠自觉会漏改,必须进 spec;文件重命名用 git mv 保留历史。**门面计数对齐**:门面与 CLAUDE.md 的 capability 数/命令数必须与实扫一致(计数漂移会让读者对单一真源失去信任;修正经 syncing MODIFIED,不绕过规格流程)。(出自 archive/2026-08-07-restructure-as-claude-code-plugin、2026-08-12-readme-docs-overhaul、2026-08-12-readme-english、2026-08-16-readme-optimization;门面对齐教训出自本次增量归档包 2026-09-03-tier1-facade-counts)
<!-- /distilled -->

<!-- distilled-from: cap/sdd-document-lifecycle -->
**落盘即 commit 节奏**:proposing/brainstorming/writing-plans/syncing/archiving 的文档变更 MUST git add + git commit;syncing/archiving 在非 trunk 的 `<type>/<slug>` 分支上运行,绝不直提 trunk,文档随既有 PR 链路上 trunk。幂等短路(git status --porcelain 无输出)跳过提交,不创建空 commit。

**归档结构统一约定**:archive 下变更目录用 propose/(proposal.md/design.md/specs/tasks.md)+ plan/ + brainstorm/ 三子目录平级(plan/brainstorm 不进 propose/);平铺老结构应借机重整。**引用改写分两类**:A 类(指向具体迁移文件的悬空路径)MUST 改写为新位置;B 类(陈述性提及,历史叙事)不改——改了反而失真;判据 = 是否为悬空路径。**文件移动用 git mv 保留 rename 历史**;提交信息按 conventional commits:docs(speccode): / chore(speccode): / feat|fix|refactor 前缀。

**plan 勾选纪律**:勾选逻辑经引擎 verb 下沉,命令层 MUST NOT 用 sed/awk 在 prose 内直接改 plan(铁律:确定性逻辑绝不写进命令 markdown);verb 输出 ticked 非空时随同簿记点 commit,为空(幂等重跑)时 MUST 跳过 commit,不硬跑 git commit 让「nothing to commit」以非零退出误报失败;勾选 commit 落在审查通过之后,不进入 review-package 的 base..head diff;ledger 是崩溃恢复唯一权威,checkbox 仅派生视图。checkbox 匹配 ^(\s*)- \[ \](.+)$ 替换为 $1- [x]$2,保留前导缩进,只进不退。**禁止占位符自检**:所有 step 含可执行代码/命令/断言,无 TBD/TODO。(出自 archive/2026-08-09-speccode-v2-sdd-flow、2026-08-13-remove-superpowers-traces、2026-08-16-plan-progress-tick、2026-08-16-code-intel-rename)
<!-- /distilled -->

<!-- distilled-from: cap/session-memory -->
**memory 走 writeTextAtomic**:memory/*.md 文本写入与 config/state 同策(临时文件 + renameSync 覆盖);写前必读(read-before-write),在现有内容上增量,不做整文件无脑覆盖;append 模式是读-改-写经 writeTextAtomic(与 O_APPEND 原子写策略的差异见架构块,两模式刻意不同)。

**校验收口 lib**:read/write-memory 的 branch 校验收口为 lib 纯函数 validateMemoryBranch(保留键 _knowledge、_exploring 遗留读兼容、_exploring/<topic> 经 validateSlug、回退 validateBranch),可单测——确定性逻辑下沉铁律的又一实例。memory 文件命名复用 state 的 type__slug 双下划线规则;主仓定位使同 feature 多 worktree 共享一份。**trunk 级**:知识维护摘要 MUST 含 PR url(或等效命令),MUST NOT 写 feature 级 memory。**承接零歧义**:slug=topic 命名约定(否决独立 --topic 参数——与 slug 构成双源歧义);rename 目标已存在拒绝并报告,不覆盖不合并(重复创建时骨架应增量维护,而非静默吞掉既有 memory)。**既有测试语义随契约演进**:契约变化时旧用例重构为新契约用例,不是回归而是契约演进。(出自 archive/2026-08-09-speccode-v2-sdd-flow、2026-08-16-knowledge-trunk-bootstrap、2026-09-02-exploring-topic-split)
<!-- /distilled -->

<!-- distilled-from: cap/development-flow-tiering -->
**TDD 纪律**:先写失败用例,运行确认失败(node --test --test-name-pattern 过滤单用例),写最小实现,运行确认通过,提交;测试边界不冗余(既有用例已覆盖的场景不重复写)。新行为先有用例锚定(仿既有用例构造,再改实现,既有用例保持通过)。

**prose 改动不涉测试**:纯命令 markdown 改动不涉逻辑时不需新增测试,全量基线作回归保护;spec delta 由 syncing 合并验证。**依赖组化任务分解**:lib 逻辑(无依赖)→ verb 透传 → 命令层分支 → 测试 → 文档核对,每个任务只动本任务 Files 列出的文件。**全量测试命令必须用 glob 形式**:node --test ./plugins/speccode/tests/*.test.mjs(裸 node --test plugins/speccode/tests/ 在 Node v24 报 MODULE_NOT_FOUND;详见 environment 块)。

**分级判据(现行)**:极小变更(proposing 产物已完全覆盖需求)走 Tier 1 轻档——空 delta(design.md 可省、specs/ 为空)专属 Tier 1,applying 按 tasks.md 逐条手动实现;机械改动时 TDD 循环不适用,测试套件作回归保护网;不走 plan 的出口是正式命令(applying),不再是内联直做的无名出口。(出自 archive/2026-08-10-release-0-2-1、2026-08-11-memory-append-newline、2026-08-11-orphan-false-alarm、2026-08-11-type-inference-source、2026-08-12-check-ignore-outside-repo、2026-08-12-finish-routing-sync-archive、2026-08-16-code-intel-rename;分级判据按现行 development-flow-tiering 契约改写)
<!-- /distilled -->

<!-- distilled-from: cap/knowledge-set -->
**marker 纪律**:写侧只产新格式(distilled-from 开标记 + /distilled 闭标记),读侧永久双格式兼容旧 promoted-from;新旧混排按出现顺序统一进块列表。replaceDistilledBlocks 写入前主动校验:同文件重复能力键抛错(防静默丢闸门确认块)、body 含开注释序列或闭注释序列字符串抛错(防产出后续解析拒绝的文件)——把「静默错误写入」转成「显式 pre-write 错误」。marker 解析失败(格式损坏)报错退出提示人工检查,不静默、不猜测。

**写 verb 纪律**:命令层绝不手写 speccode/knowledge/ 或 JSON 文件,一律经 write-knowledge verb(现行四模式:replace / replace-hand / replace-distilled / index;append-hand 已退役);--json-stdin 从 stdin 读 JSON 避免超长/转义;knowledge/ 写入走 writeTextAtomic。sidecar 纪律:consumed_archives 存归档目录裸名(无 archive/ 前缀无尾斜杠),与能力键两套表示勿混;sidecar 更新与蒸馏落盘在同一命令事务内,失败整体报告并提示重跑;人工删归档包后残留旧条目指向不存在的包,不影响判定(无副作用)。

**改名触点清单化**:tasks 列全触点(lib/bin/tests/commands/README×4/CHANGELOG/spec Purpose),收尾全仓 grep 校验禁区(旧名仅允许命中 archive/、CHANGELOG 历史小节);主规格 Purpose 含旧名需单独 editorial 手改(syncing 不动既有 Purpose)。一次性迁移脚本坑:全量重蒸重建语义使其不必要,且多一个要永久维护的命令。

**闸门哲学**:distilling/recording 的候选 diff 经人工确认才落盘;判定为业务知识时给出「建议进 RAG」陈述,用户坚持则允许指定/新建 topic 写入,不硬拦(硬拒绝会在灰色地带误伤)。蒸馏目标 = 骨架 6 development topic ∪ development/ 下用户自建 topic;pitfalls 语义扩展为「踩坑 + 评审共识」,不单列 review topic。**命令间复用手段**:prose 引用既有命令(如知识命令引用 creating-worktree/finishing-worktree),既不内联复刻机制段(第三套实现)也不下沉 lib(命令编排属交互层);被否选项与理由记 design.md Decisions 段。(出自 archive/2026-08-14-knowledge-set、2026-08-15-knowledge-command-rename、2026-08-15-knowledge-set-refocus、2026-08-16-distill-incremental-archive、2026-09-03-knowledge-unified-entry;mode 清单与 marker 语义按本需求 delta 改写)
<!-- /distilled -->

<!-- distilled-from: cap/code-intel-tool-integration -->
**幂等补救纪律**:re-init 对 config 中已登记、但当前判定为 available-only(未集成)的项,在 diff 中标记「建议移除」并提示,经用户确认后才移除——绝不静默删除 config 已登记项;探测结果经用户逐项确认才落盘。**跨层命名一致性**:code_intel_tools(config 字段)/ detectCodeIntelTools(函数)/ CODE_INTEL_TOOL_DETECTORS(常量)/ detect-code-intel-tools(verb)/ code-intel-tool-integration(capability 目录)一致;不兼容历史不 bump config version、loadConfig 不回退旧字段,用户重新 init(避免静默兼容掩盖问题)。**兄弟前缀陷阱专项单测**:isPathInside 的 /repo vs /repo-evil 必须有专项用例。(出自 archive/2026-08-13-knowledge-tools-detection、2026-08-16-code-intel-rename、2026-08-12-check-ignore-outside-repo)
<!-- /distilled -->

<!-- distilled-from: cap/tool-input-sanitization -->
**清洗类 hook 工程准则**:fail-open——hook 任何异常(stdin 非法、载荷缺字段、清洗抛错)一律 exit 0 且无输出,放行原输入;清洗是增强不是门禁,绝不阻断用户交互。清洗范围最小化,第一版只清 U+000D 不扩控制字符;stripCR 无 CR 时返回原引用,hook 壳用引用比较(cleaned !== tool_input)判变化,无变化零输出,避免无谓 updatedInput 与 schema 校验开销。(出自 archive/2026-09-02-askuserquestion-cr-sanitizer)
<!-- /distilled -->
