## 手写踩坑

1. 测试中比对 git 解析出的路径时,先用 realpathSync 归一:macOS 上 git rev-parse --show-toplevel 会把 /var 解析为 /private/var,而 os.tmpdir() 不解析符号链接,两边直接相等断言必挂。
2. 写 verb 的 --json-stdin 是布尔 flag(parseArgs 置 true),payload 必须从 stdin 读(JSON.parse(readStdin())),绝不能 JSON.parse(jsonStdin)。

<!-- distilled-from: archive/2026-07-13-add-speccode-plugin/ -->
**归属判定与 display/amend 时代的坑(已随机制退役)**:v0.1-v2 的 ancestor 归属判定在 cherry-pick 跨 feature、worktree 改名等边缘 case 误判,`worktree_overrides` 曾为此给用户显式修正能力,同一 worktree 同时是多个 feature 的祖先时对账报错退出——v3 改路径识别(路径 ∪ state 登记)把整类启发式归属问题根治;display-reset「备份 + untrack commit + reset --hard + retrack commit」四步走与 amend 折叠剥离的坑随 display 层与 `-complete` 分支删除而消亡。教训保留:识别要用无歧义锚点(路径/state 登记),不要从分支名或 ancestry 推断。

**.speccode/ 不在 .gitignore,`git clean -fdx` 会丢配置**:R4 设计决策——插件与 git 原生机制解耦,不在 .gitignore 中加入任何 speccode 路径。后果:`git clean -fdx` 会摧毁 config/state。文档化警告,不在命令层面强制保护。v2 后 memory/ 与 sdd/ 自写目录内 .gitignore(内容 `*`)自忽略,`git clean -fd` 不伤两者,但 `git clean -fdx` 仍会摧毁 config/state。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-07-restructure-as-claude-code-plugin/ -->
**测试搬到 plugins/speccode/tests/ 后旧测试命令失效**：`node --test ./tests/*.test.mjs` 旧命令失效，CLAUDE.md 测试命令必须同步更新为 `node --test ./plugins/speccode/tests/*.test.mjs`。git mv 搬移后命令正文与测试 import 仍是旧路径——Task 4 修好后恢复，搬移结束时测试预期会失败（import 路径断），这是正常的。

**settings.local.json 重写可能误删有用 permission**：只删指向旧 speccode.mjs 绝对路径的条目，保留 Bash(node *)、Bash(git *)、Bash(gh *) 等通配条目；重写前审查现有清单。Bash(node *) 已覆盖 speccode.mjs 裸调（PATH 解析后由 node 执行）与手动 node plugins/... 调试。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-09-speccode-v2-sdd-flow/ -->
**REMOVED-all delta 后主 spec 空壳过不了校验**：sync 后主 spec 会剩 Purpose + 空 Requirements，过不了 `requirements.min(1)` 校验；程序化 openspec archive 的预写校验（validateSpecContent）会直接硬中止。因此：(a) sync 移除 6 条 requirement 后必须 `git rm -r openspec/specs/spec-docs-tracking-control/` 删除目录；(b) 本 change 的 sync/archive 必须走 /opsx:sync + /opsx:archive agent 流，不能用裸 openspec archive。

**state legacy 规范化必须在 readState 与 listActiveFeatures 双路径调用**：normalizeState() 只下沉 readState 会有洞：reconcile 走 listActiveFeatures（直接 readJson），其输出的 pending_operation.command 仍是旧名，--resume 按新名匹配在主路径失效。waiting_display_pr 的「不可续跑 + 手动收尾指引」写进命令 prose（命令层检测 phase 报错），不进引擎（readState 契约是返回 JSON|null，抛错会击穿 feature-progress 与 listActiveFeatures）。

**命令改名硬切换无别名**：commands-only 插件做别名 = 维护两份相同 markdown。旧命令文件物理删除，新旧文件名零碰撞。迁移成本由三件事覆盖：plugin.json 升 0.2.0（BREAKING 语义）、README 迁移对照表、state legacy 规范化。v0.1 遗留 display 分支与 waiting_display_pr 挂起态需按指引手动收尾（finishing-feature 检测到该 phase 报错并打印手动收尾指引）。

**worktree 清理 provenance 检查从 superpowers 字面量 .worktrees/ 重定向为来源限定判据**：否则默认配置下该守护静默失效（superpowers v6.2.0 修过同类 bug）。判据改为「分支带配置前缀 且（路径位于 resolve-worktree-dir 解析结果之下 或 在 state 中有登记）」。「state 登记」析取项覆盖 worktree_dir 配置变更后旧目录下自建 worktree 的泄漏场景。

**requesting-code-review 原文 HEAD~1 取 BASE 的示例必须改写为「调用方记录的 BASE」**：与 spec「review-package 禁止相对引用」规则一致。HEAD~1 在有新 commit 后会指向错误 base。review-package verb 接受 --base <sha> --head <sha>，range 命名为 review-<short base>..<short head>.diff。

**macOS 上 os.tmpdir() 与 git rev-parse --show-toplevel 的 realpath 差异**：cli.test.mjs 补 linked worktree 内 sdd-workspace 定位用例时，断言前对路径做 realpath 归一（macOS tmpdir 是 /var→/private/var 符号链接）。hook.log 的 repo_root 断言也用 realpathSync(repo)。

**finishing-worktree 清理段 push 行补 -C**：P1 终审 re-review 的 parked finding：清理段提供「cd <主仓根> 或全程 git -C <主仓根>」两种执行方式，但删远端行仍是裸 `git push origin :<worktree>`，与「不切换 cwd」方式自相矛盾——worktree remove 后 cwd 已不存在，裸 push 会 getcwd 失败。必须改为 `git -C <主仓根> push origin :<worktree>`。

**visual companion 脚本内 .superpowers/brainstorm/ 硬编码路径必须重映射**：移植 superpowers 脚本时，start-server.sh 的 SESSION_DIR/BRAINSTORM_PORT_FILE/BRAINSTORM_TOKEN_FILE 与 visual-companion.md 的多处 .superpowers/brainstorm/ 路径必须改为 .speccode/brainstorm/（目标项目 .speccode/ 按约定 untracked，无需 .gitignore 提醒）。遗漏会导致产物写到错误位置。

**brainstorming 检查清单提交顺序**：P4 终审修复波次发现「落盘即提交」与「批准后提交」顺序问题。HARD-GATE（呈现设计并获得用户批准之前，禁止调用任何实现类命令、写任何代码）必须在提交之前。检查清单第 10 项标签应为「批准后提交（落盘即 commit）」而非「落盘即提交」，因为 brainstorming 有用户审阅门在提交之前。

**syncing 护栏首句与双路径 add 对齐**：原护栏首句「syncing 只动 speccode/spec/ 并提交」与落盘段双路径 add（git add speccode/spec/ speccode/changes/<slug>/）自相矛盾。修正为「syncing 的规格合并只动 speccode/spec/；brainstorm 残余吸收的回写落在 speccode/changes/<slug>/，一并提交」。delta 源契约段补：propose/ 不存在（纯 brainstorming 路径）时若 brainstorm/ 存在以其文档提炼 delta 合并，若两者都不存在报告无 delta 并停止。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-10-rebrand-visual-companion/ -->
**visual companion 版本探路深度错误**：readSuperpowersVersion() 以 `__dirname/../../..` 上溯到 plugins/ 探 package.json 与 .codex-plugin/plugin.json，两者在本仓均不存在 → 恒返回 'unknown'，页脚渲染 "Superpowers vunknown"。修正：readSpeccodeManifest() 读 `path.join(__dirname, '..', '..', '.claude-plugin', 'plugin.json')`（脚本位于 plugins/speccode/references/visual-companion-scripts/，上溯两级即插件根），取 version 与 homepage。版本/链接必须读自 plugin.json 单一数据源，不可硬编码。

**CLAUDE.md 手维 requirement 计数漂移**：手写「74 requirements」与实际（75）漂移。根治：去掉手维计数（保留「8 个 capability」），每次规格变动不再需手动同步数字。被否备选：改成 76（每次规格变动仍需手动同步，治标不治本）。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-memory-append-newline/ -->
**条目分隔责任下放给调用方是结构性陷阱**:各命令文档的 heredoc 示例天然产生"前条无尾换行 + 新条无头换行"组合,靠每个调用点自觉加 \n 已被打破过一次。引擎兜底后命令文档不写换行约定也天然安全。

**spec 与实现漂移**:条款仍写"append 模式的读-改-写"而实现早已改为单次 O_APPEND——此类漂移在勘探时一并核实归位。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-orphan-false-alarm/ -->
**四个各自正确的决策拼出虚警**:reconcile 规则3不区分状态 + completed 的 git 侧清理是正常终态 + state 保留 completed 记录供核算 + finishing-feature 前置对账 = 每次 squash 后对已清理 worktree 报 orphan。单个决策都对,组合产生 false alarm。

**误豁免真异常的风险**:completed 条目 git 侧若因异常丢失而非流程清理会被误豁免。兜底:completed 只在 finishing-worktree 成功后写入,手动删 worktree 的异常场景由 state 仍在轨的事实兜底(finishing-feature 收尾 delete-state 清理)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-type-inference-source/ -->
**信号源时序错位**:命令在 trunk 运行时扫描的目录在 trunk 永不存在(proposing 在 worktree 才创建、archiving 合并前移走)。扫描是死代码,从未生效。主规格只约束命名格式、未钉推断来源时,此类漂移无契约可守。

**`_exploring` 残留上一话题**:护栏(预置推荐项 + 用户确认)覆盖;承接后清空,残留窗口限一个 feature。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-visual-companion-cleanup/ -->
**escapeHtmlText 防住属性逃逸但防不住 javascript: scheme**:同信任边界内非漏洞,属纵深防御缺口——仍应做成正式防御(读取时校验 /^https?:\/\//)。

**删除元素后遗留失去作用对象的 CSS**:logo `<img>` 删除后,gap(图标-文字间距)与 translateY(对齐 logo 基线的光学微调)失去作用对象,误导后来者。删元素时一并清陪葬 CSS。

**合法 homepage 误杀面**:只放行 http/https 对当前值(https GitHub URL)与可预见值无误杀面。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-check-ignore-outside-repo/ -->
**仓库外 worktree_dir 误报**:本仓 config 的 worktree_dir 是仓库外绝对路径,每次 creating-worktree 都命中 fatal。git 对外部路径 fatal+exit 128,被命令误判为"未被忽略"。

**兄弟前缀误判**:`/repo` vs `/repo-evil` 纯前缀比较会误判为 inside——必须补尾部分隔符。

**相对 worktree_dir 解析基准含糊**:一律以 repoRoot 为基准 resolve,不用 cwd。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-finish-routing-sync-archive/ -->
**dev-completion 直跳 finishing-worktree 把 sync/archive 逼进死路**:syncing/archiving 的 trunk 防护要求 worktree-* 分支,finishing-worktree 会移除 worktree——sync/archive 只能在 finishing-worktree 之前执行。中间命令链已接对(syncing 引导 archiving、archiving 引导 finishing-worktree),缺口仅在 dev-completion 命令的直跳。

**无文档路径误走 syncing/archiving**:二者在无需求目录时报错退出,"暂不落地文档"路径必须直接 finishing-worktree。

**多 worktree 场景**:某 worktree 已 sync/archive、另一 worktree 仍在开发 → C 门对未归档的 feature 警告。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-release-0-2-2/ -->
**规格钉版本字面量 = 每次发版必然过时**:`version: "0.2.0"` 钉成字面量,0.2.1 发布后已漂移。与"版本发布纪律"自身冲突。scenario 的具体版本举例也会过时,改示例性质或用 `0.2.x` 范围。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-readme-docs-overhaul/ -->
文档硬编码漂移坑:根 README 硬编码版本 0.2.0 与 plugin.json 0.2.2 漂移;CLAUDE.md 硬编码「137 个用例」随测试增减失真。shields.io 静态 version badge 需手工同步,重新引入漂移——badges 不含版本号。

交叉引用漏改坑:插件 README 删除 §14 跨平台说明节后,全文检索「第 14 节」交叉引用(§13、§15 及引言处)MUST 逐一改指新依赖块,否则悬空引用。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-readme-english/ -->
双语漂移坑:两语言版本随时间偏离 → 缓解:结构对齐(12 段骨架)为锚 + CLAUDE.md 维护纪律 + spec 扩展不漂移。互链死链坑:改名后既有链接失效(如插件 README 门面指针原指根 README)→ 缓解:互链矩阵进 spec;实现后逐链验证。翻译节号错位坑:插件 README 英文版节号 MUST 与中文版一致(§1-14),翻译以中文版节号清单为纲。

英文版无残留中文段落坑:代码块与专名(toggle 文本「简体中文」)除外,其他命中需修复。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-13-knowledge-tools-detection/ -->
知识工具探测的「本机有 = 项目已集成」误判:plugin/CLI 的「本机装了」与「本项目用了」是两回事,单维度短路探测(plugin→mcp→cli→dir 首个命中即返回)让本机级命中提前返回,项目级证据被跳过,造成误登记。登记了未集成工具后,exploring/proposing/brainstorming 会优先「咨询」它们,实则在本项目里根本没用。

CLI 二进制是本机属性,不代表本项目已为它生成索引——`command -v` 不能算「集成」。但项目有索引目录但工具已卸载属异常态,保守不登记更安全。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-14-knowledge-set/ -->
蒸馏失真坑:LLM 从 spec/archive 提炼走样 → 缓解:闸门(候选 diff 经人确认才落盘)。晋升重蒸覆盖手写内容坑 → 缓解:来源标记只重写 promoted 块,块外字节级保留(测试覆盖)。marker 被手编破坏坑 → parsePromotedBlocks 单测钉死格式,解析失败显式报错不静默修复。

知识集内容膨胀、_index 失修坑 → 命令出口更新 _index;promote/memorize 时重建校验。命令入口 prose 重复 9 处漂移坑 → 接入段统一模板,集中在入口小节。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-13-remove-superpowers-traces/ -->
与既有设计决策的张力:`2026-08-10-self-host-speccode` 设计明确写「不改写任何历史:…docs/superpowers/…」,后续迁移恰好动了 docs/superpowers/。处理方式:不掩饰这层关系——当时保留是过渡决策,现在迁移进 archive 是最终归宿,文档未丢只是从游离 docs/ 挪进正式归档结构。B 类陈述性提及不改(描述 superpowers 工具客观属性,与目录是否存在无关)。

删 docs/ 后 README:85 失去所指,需同步删行(中英两版)。sdd.mjs 注释品牌词替换保留算法来源说明。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-15-knowledge-command-rename/ -->
改名漏触点坑:prose、提交信息模板、索引描述等易遗漏 → tasks 列全触点清单 + 收尾全仓 grep 校验禁区。主规格 Purpose 含旧命令名坑:syncing 不动既有 Purpose(主规格权威),需 tasks 单列 editorial 手改 `speccode/spec/knowledge-set/spec.md` 的 Purpose 段。

marker 不动导致术语永久漂移坑(命令说 distill、文件写 promoted):marker 随迁。一次性迁移脚本坑:蒸馏全量重建语义使其不必要,且多一个要永久维护的命令——靠全量重建自然迁移,双解析只为三类存量兜底(从未重蒸的文件、日落读现状块、stale 检测)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-15-knowledge-set-refocus/ -->
宽骨架闲置率高:dogfood 证据——本仓 speccode/knowledge/ 9 个 topic 中 business/* 与 5 个 development 文件全空,仅 pitfalls 有内容。宽骨架(9 topic)导致 memorize 时分类纠结。存量项目 business 内容被误删风险:promoted 块移除必须经闸门人工确认;hand-written 段字节级保留,绝不自动动。命令 markdown 与 spec 描述漂移风险:同一 change 必须同步更新两处命令 + spec delta,经 syncing 合入主规格。测试硬编码 9-topic 骨架的担忧被证伪:实测两测试文件中 business/ 仅为合法 fixture 路径,lib topic 无关,零改动;全量测试 183/183 绿兜底。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-code-intel-rename/ -->
BREAKING config:既有 config.json `knowledge_tools` 失效,不兼容历史。缓解:改完重新 init;dogfood + 早期用户,可接受。`loadConfig` 不回退旧字段,避免静默兼容掩盖问题。capability 目录 RENAME 机制 gap:speccode spec delta/syncing 体系只有 requirement 级 RENAMED(FROM:/TO:),无 capability 级 RENAME/删除。capability 目录只支持「新建」(主规格无→syncing 创建),没有 RENAME/删除。故 `knowledge-tool-integration → code-intel-tool-integration` 无法通过 delta 干净表达:propose 用新名→syncing 新建新 capability;旧目录只能 REMOVED requirements,空壳残留。解决方案:扩展 syncing 轻量版(delta `rename-from` 元数据 + syncing.md RENAME 段)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-distill-incremental-archive/ -->
**C1 realpath 归一(关键坑)**:`knowledgeRoot` 经 `git rev-parse --show-toplevel`,macOS 会把 `/var` 解析为 `/private/var`。凡做路径**相等比较**处 MUST 先 `realpathSync` 归一。本变更若在 `unconsumedArchives`/sidecar 路径比较中仅触及目录名(字符串)比对则不触发;若触及绝对路径相等比较则照办。**C2 --json-stdin 布尔(关键坑)**:`write-knowledge`(及新增 consumed_archives 写路径)`--json-stdin` 是布尔 flag,payload MUST `JSON.parse(readStdin())`,绝不 `JSON.parse(jsonStdin)`——重蹈覆辙会解析失败。sidecar 与 knowledge/ 落盘不一致:蒸馏写了块但 sidecar 未更新→下轮重读已蒸包;缓解——sidecar 更新与蒸馏落盘在同一命令事务内。superseded 走 stale 语义会失真:bundle 还在却标「已消失」误导用户;必须区分 stale(包已删,自动检测)vs superseded(包还在、知识被取代,distiller 提议、用户拍板)。首次引导误判:探索期 `find -maxdepth 2 -type f` 被嵌套 propose/brainstorm 子目录结构误导,误判本仓库 archive/ 为空;实有 22 个归档包,首次 dogfood 引导实为 22-bundle 全量读,非空操作。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-knowledge-trunk-bootstrap/ -->
命令层 prose 行为(入口引导/收尾衔接)无单元测试:均为 agent+shell 层,无 verb 可注入,刻意不伪造测试(多次终审确认,仓库一致边界)。行为 BREAKING(0.2.5 与 0.4.0 两次)均需 CHANGELOG 显式标注升级路径(0.4.0:在途旧裸分支无 state 不可续跑,新 slug + cherry-pick 恢复)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-plan-progress-tick/ -->
plan checkbox 从不被回写:writing-plans 在 plan 文档用 `- [ ]` checkbox 声明「执行时的跟踪机制」,但 executing-plans 与 subagent-driven-development 在执行时只更新会话 todo(易失)与 untracked ledger,plan 文档始终停留在「全未完成」的僵尸状态。fence 误勾风险:若不复用 fence 状态机会把代码块里 `- [ ]` 误勾;缓解——复用 `extractTaskBrief` 的 fence 状态机 + 单测覆盖 fence 内代码行。`Task 1` 误配 `Task 10`:标题匹配必须用数字边界(`Task N` 后跟非数字/EOL),否则 `Task 1` 会匹配到 `Task 10` 的前缀。嵌套 fence 不翻转状态:4反引号 markdown 块内含 3反引号 bash 内层 fence 时,内层 fence MUST NOT 闭合外层块;CommonMark 长度规则:开栏的 K 个反引号只能被 ≥ K 个反引号且其后无内容的行闭合。任务区段蔓延:Task N 区段 MUST 止于下一个同级或更高级标题(下一个 `### Task M`,或 `## 收尾`/`## Self-Review` 等尾部章节),MUST NOT 蔓延到尾部非 Task 章节。双源不一致:plan `[x]` 与 ledger 不一致;缓解——ledger 为唯一恢复权威,checkbox 不入恢复;勾选顺序为「先 ledger 后 tick」。幂等:崩溃恢复重跑同一 task;只改 `[ ]`→`[x]`,已勾不动,重跑安全。commit 噪音:每个 task 多一个 tick commit;缓解——折进现有簿记点,commit message 统一;这些 commit 在 PR diff 里是进度可视化,reviewer 能看到推进轨迹,非纯噪音。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-readme-optimization/ -->
遗留的 spec 内在矛盾:「命令命名空间」requirement 逐字列举全部命令名,与「文档版本信息不漂移」的『命令总数 MUST NOT 写死字面量』纪律相互抵触;readme-optimization 仅修正 21→23 stale,矛盾本身留待后续单独 spec 演进,新增命令时两个 requirement 会再撞。
<!-- /distilled -->

<!-- distilled-from: archive/2026-09-02-askuserquestion-cr-sanitizer/ -->
GLM 系模型后端在 tool_use 参数发射路径随机注入 CR(U+000D):实证 29/259 次 AskUserQuestion 参数含 CR,散布于中英/ASCII 边界(
 至 



 个数不定),其他工具参数与模型 text 输出零污染——诊断法:扫描 transcript JSONL 里 AskUserQuestion tool_use 的 input。坑:updatedInput 改写输入会被 schema 校验(如 options 数组最少 2 项),构造替换输入必须合法,否则整次工具调用报错而非静默忽略。
<!-- /distilled -->

<!-- distilled-from: archive/2026-09-03-remove-feature-layer/ -->
**children 状态存储的读-改-写竞态**:propose 原设计 `children:[{slug,status}]` 由 finishing-worktree(子路径)写父实体——两个子 worktree 并行收尾互踩父 state;`writeJsonAtomic` 防单写损坏、防不了互踩(memory O_APPEND 改造的同款教训)。裁决:children 仅存 `{slug}`,子 state 是状态唯一真源,渲染/门禁实时派生,子收尾永不碰父实体——竞态与双真源漂移连根消失。**v2→v3 迁移不能靠条目提升**:v2 worktrees 条目名 `worktree-xxx` 无 `<type>/<slug>`,提升为独立分支视角后连 state 文件名都产不出;迁移 = 双格式运行 + 仅 init 显式迁移(多 worktree/在途/畸形/目标已存在跳过并报告),绝不静默挪用户数据。**多父实体基点歧义**:两个大需求可同时 in-flight,creating-worktree 隐式基点判定会歧义;裁决 = 不限单父,0 父→trunk 切、1 父→打印确认、≥2 父→AskUserQuestion 供选(直给完整分支名可跳过)。**spec 残留 v2 表述的内在矛盾**:remove-feature-layer 的 delta 只覆盖 git-workflow-lifecycle/speccode-config-management/session-memory 三 capability,sdd-document-lifecycle(proposing/syncing/archiving scenario 仍写 `worktree-*` 分支)与 plugin-packaging(三层拓扑图、「用户文档与 v2 一致」scenario)未同步,与双层表述形成 spec 内在矛盾——选 delta 能力面时需全仓 grep 检查跨 capability 概念触点,与「命令数字字面量矛盾」同款坑。
<!-- /distilled -->

<!-- distilled-from: archive/2026-09-02-exploring-topic-split/ -->
**探索 topic 命名碎片化**:同一需求在不同 session 被起不同 topic 名,各持一半结论;缓解 = exploring 出口 append 前必经 `list-memory` 列既有 topic 选既有或新建,分期用共同前缀约定(`<主题>-p1/-p2`)。**type 推断信号变小**:单堆文件切成单 topic 后,推断信号从「整堆」变「单 topic 文件」,小样本推断质量可能下降;既有护栏(推断 MUST 经用户确认,不静默生效)覆盖。
<!-- /distilled -->

<!-- distilled-from: archive/2026-09-03-knowledge-unified-entry/ -->
绕过统一入口的特权机制积累缺陷债(2026-09-03):0.2.5 知识维护特权机制存活两版暴露三缺陷——①squash-only 下 `git branch --no-merged` 对已合并分支永真(已收尾分支永远被弹「续跑」且 PR 查重不命中)②裸 checkout 切走主工作区 ③跑完不回 trunk;两命令机制段 ~80% 逐字重复。教训:机制例外不是免费的,每份独立实现 = 缺陷面 + 重复税;统一入口 + state 判定一次性消灭全部三个。校验锚点必须与规定产出对账:plan 的 grep 校验期望三连自相矛盾——Step 4 模式(`no-merged\|不阻塞\|…`)命中自己规定的新文本(禁令条款必须点名被禁物 `git branch --no-merged`;建议句含「不阻塞日常开发」);`grep -c` 期望「两文件 0 命中」过宽,命中预存的 trunk 定义行。教训:写「零命中」校验前先对规定的产出文本跑一遍模式;禁令文本引用被禁词是合法命中,判定须用只含真实违规特征的严格审计模式;「0 命中」期望要限定作用域(如命令表单元格)而非全文件。
<!-- /distilled -->
