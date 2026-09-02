<!-- distilled-from: archive/2026-07-13-add-speccode-plugin/ -->
**原子写**：所有 .speccode/config.json 和 state/features/*.json 写入必须走 `atomic.writeJsonAtomic`（临时文件 `${path}.${pid}.tmp` + `renameSync` 覆盖）。命令层通过 write-config / write-state verb 间接调用，绝不手写 JSON 文件。临时文件 PID 后缀防并发碰撞；mv 之前的 cp 阶段崩了留临时文件但 config.json 仍是旧的（可接受的「上一次正确状态」，比半写状态好得多）。

**写 verb 必须 --json-stdin**：write-config / write-state 从 stdin 读 JSON 而非从 argv 读，避免超长/转义问题。命令层用 `echo '<json>' | speccode.mjs write-state --cwd . --branch <b> --json-stdin` 形态。所有时间字段用 ISO 8601 UTC（`new Date().toISOString()`），MUST 能被 Date.parse() 解析。

**命名规则**：功能分支 `<type>/<slug>`，type ∈ {feature, bugfix, refactor, chore}，slug 匹配 `/^[a-z0-9-]+$/`。state 文件名 `<type>__<slug>.json`（双下划线分隔 type 与 slug）。双下划线因为 slug 不含下划线故 `__` 是无歧义分隔符，避免 `feature/pay-ment` 与假想的 `feature-pay/ment` 映射到同一文件名。文件名不需可逆（内容已有 feature_branch 全名字段），只需唯一 + 可读。

**worktree 分支硬前缀**：所有 speccode 管理的 worktree 分支 MUST 以 `worktree-` 开头（config.worktree_prefix，默认 "worktree-"）。develop-start 拒绝非法前缀；对账识别非标准 worktree 标为 orphan 不纳入任何 active feature。default 名 `worktree-` + feature slug 段。

**reset 拒绝有 active_features，不接受 --force**：任何 state 文件存在即拒绝执行。强制绕过会导致 worktree 残留、state 损坏，对账算法无法在下次恢复。有未完成功能时正确路径是 finishing-feature，不是 reset。

**speccode 不主动删 git 分支**：核心原则，与「插件与 git 解耦」一致。feature 分支作为历史保留；`<feature>-complete` 是 speccode 自己创建的临时分支，trunk PR 合并后由 speccode 删除（本地 + 远端），这不违反「不删用户分支」——D7 保护的是用户创建的 feature 分支。

**init 字段级幂等**：二次 init 时按字段逐个询问 `[旧值]→[新值]` diff，而非整体覆盖。值未变跳过；值变化展示 diff 询问保持/改用新值/清除，确认后才写入。state/ 目录在二次 init 时 MUST 不被读、改、删。写前 MUST 备份 config.json.bak.<timestamp>。

**命令 markdown 全程中文交互；frontmatter 四字段 name/description/category:Workflow/tags**。命令正文裸调 `speccode.mjs <verb> --cwd .`，stdin 管道用 `echo '<json>' | speccode.mjs <verb> --cwd . --json-stdin`。未知 verb 或抛错 → `{ok:false, error}` + exit 1。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-07-restructure-as-claude-code-plugin/ -->
**裸调约定（方案 B）**：命令正文从 `node .claude/speccode/bin/speccode.mjs` 改为 `speccode.mjs <verb> --cwd .`，依赖插件 `bin/` 在启用期间被加入 Bash 工具 PATH。speccode.mjs 必须具备 `#!/usr/bin/env node` shebang 与 +x 可执行位。已知限制：PATH 仅插件启用时生效，手动终端调试需用全路径 `node plugins/speccode/bin/speccode.mjs`。`process.argv[1].endsWith('speccode.mjs')` 守卫在裸调下安全（文件名固定带 .mjs）。

**测试用 import.meta.url + fileURLToPath 定位 BIN**，不用 process.cwd()。process.cwd() 依赖执行目录，从非仓库根跑或 IDE 单文件运行会断；import.meta.url 相对测试文件自身定位，从任意 cwd 跑都对。tests/helpers/tmprepo.mjs 的 cwd 是传入的临时仓库路径、不定位自身，零改动。

**三层文档分离**：根 README.md = marketplace 索引（项目描述 + 插件列表 + 安装方式）；plugins/speccode/README.md = 用户文档（命令表/拓扑图/风险）；CLAUDE.md = 开发文档（三层引擎架构、测试约定、marketplace 结构，路径全指向 plugins/speccode/）。修改文档时 MUST 同步更新所有语言版本（中英），不得硬编码版本号与测试数量（以 CHANGELOG 为单一数据源）。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-09-plugin-release-process/ -->
**版本发布纪律**：bump plugin.json version 的提交 MUST 在同一提交（或同一 PR）中同步更新根 CHANGELOG.md 对应版本小节（全中文 + Keep a Changelog 骨架：Added/Changed/Fixed/Removed 分组、semver 比较链接）。未完成 CHANGELOG 更新的 version bump MUST NOT 合入 trunk。发版 MUST 打 `v<version>` tag 并建 GitHub Release。GitHub Release 是给人看的标记，更新检测实际走 marketplace git 拉取 + plugin.json version 比对，Release 不触发自动更新。

**CHANGELOG 格式**：全中文 + Keep a Changelog 骨架。位置在仓库根（本仓是 marketplace 仓 + 单插件结构）。根 README 与插件 README 各加一行链接。Release notes 摘自 CHANGELOG 该版本小节。CHANGELOG 是版本号与测试数量的单一数据源，文档不得硬编码这些数字。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-09-speccode-v2-sdd-flow/ -->
**--json-stdin 显式化**：写 verb（write-config/write-state/write-memory）缺该 flag 时返回 `{ok:false, error}`。现状是文档写了但 bin 从不解析、无条件读 stdin；显式化让契约可测。缺 flag/缺 branch/非法 mode 都 MUST 返回 {ok:false} exit 1。

**落盘即 commit 节奏**：proposing/brainstorming/writing-plans/syncing/archiving 的文档变更 MUST 以 git add + git commit 提交。syncing/archiving 在 worktree-* 分支上运行，绝不直提 trunk，文档随 worktree→feature→trunk 的既有 PR 链路上 trunk。若 syncing 产生 git status --porcelain 无输出（幂等短路）则跳过提交，不创建空 commit。

**D16 不确定先询问原则**：全局行为准则。auto 模式判断不充分时默认询问；知识工具探测结果 init 逐项确认；hooks 配置 init 询问而非静默写入；exploring/proposing/brainstorming 提问一次一问。误判为自动代价可控（动作可逆且经 git/state 留痕）；误判为询问仅多一次打断。

**移植保真约束**：superpowers 方法论命令（brainstorming/writing-plans/TDD/debugging/review 等）移植时，Red Flags / Common Rationalizations / Iron Law / fix loop 5 轮熔断 / Model Selection 等表格是 eval 调校过的行为塑造内容，MUST 近逐字保留（可中文化，结构语义不弱化）。交叉引用统一改 `/speccode:X` 形式，不得残留 `superpowers:` 引用。

**memory 走 writeTextAtomic**：memory/*.md 文本写入与 config/state 同策（临时文件 + renameSync 覆盖，`atomic.writeTextAtomic`）。写前必读（read-before-write），在现有内容上增量，不做整文件无脑覆盖。append 模式是读-改-写经 writeTextAtomic。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-10-release-0-2-1/ -->
**patch vs minor 判据**：两轮变更全部为修复（探路错误、过时扫描路径）与小变更（品牌文案、keywords、文档），无新命令/verb/行为面 → 语义化版本归 patch（0.2.0→0.2.1）。minor 会夸大变更面、误导升级预期。无新能力、无 BREAKING 不发 minor/major。纯 release chore 不修改任何能力契约，syncing 以「无 delta 可同步」短路，archiving 记录 sync 状态为「无 delta」。

**跳过 writing-plans 的判据**：改动为 2 个文件的机械编辑且全文已在 tasks/设计锁定，writing-plans 无增量信息；执行内联完成，验证先行（verification-before-completion）。被否备选：走完整计划文档（纯仪式）。机械改动时 TDD 循环不适用，测试套件作为回归保护网。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-memory-append-newline/ -->
**TDD 红绿全程**:memory append 边界修复先写 2 个失败用例(缺边界补一个换行 / 边界已存在不重复补),`node --test --test-name-pattern=...` 确认红,再实现,再全量绿。「空文件 append 不补前置换行」由既有用例覆盖,不重复写——测试边界不冗余。

**既有漂移一并归位**:实现自 a45202a 已改为单次 O_APPEND,但条款仍写"append 模式的读-改-写"——发现 spec 与实现矛盾时本轮一并修正,不做"只改实现"。

**文档计数同步**:CLAUDE.md 测试计数随新增用例同步(135→137),保持文档诚实。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-orphan-false-alarm/ -->
**TDD 新行为先有用例锚定**:orphan 豁免先写「completed + git 缺失 → 不计 orphan」失败用例(仿既有 in_progress 用例构造,status 改 completed),再改 reconcile.mjs 规则 3,既有 in_progress orphan 用例保持通过。

**CLAUDE.md 计数顺手同步**(134→135),但手维计数防漂移改造另议,不在本范围。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-release-0-2-2/ -->
**发布纪律**:version bump 与 CHANGELOG 同 PR;主干打 tag + GitHub Release(notes 摘自 CHANGELOG 小节);合并后主干动作。patch 而非 minor:全部为修复与小变更、无新能力、无 BREAKING 时不夸大变更面。

**CHANGELOG 条目口径**:Fixed 对应修复项;Changed 收录清理与规格演进;对照 squash commit 逐一核对防漏条目。

**syncing 顺序**:先 bump+CHANGELOG 再 sync,使"version 与 CHANGELOG 最新小节一致"在合并后立即为真。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-type-inference-source/ -->
**命令 prose 改动不改 lib/测试**:type 推断顺序只改命令 markdown,134 用例保持绿——纯 prose 改动不涉逻辑时不需新增测试。

**推断永不静默生效**:预置推荐项 + 用户确认护栏,启发式误判(探索文本含"修复"却非 bugfix)由护栏覆盖。

**复用注记**:命令步骤中两次读同一文件(推断阶段读 _exploring、创建阶段复用)时,在后一处加注记说明复用,避免读者困惑。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-visual-companion-cleanup/ -->
**references 层无单测是既有边界**:验证走冒烟脚本 + 临时线束(/tmp 伪造目录结构 + 篡改 plugin.json,起服务取页,红/绿对照),不为此扩展单测边界。

**冒烟脚本版本断言改动态读取**:从 plugin.json 动态读取 version,修掉 0.2.0 硬编码的过时断言——与 readSpeccodeManifest 同路径,测试环境即真实环境。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-check-ignore-outside-repo/ -->
**依赖组化任务分解**:lib 逻辑(无依赖)→ verb 透传(依赖组1)→ 命令层分支(依赖组2)→ 测试(依赖组1/2)→ 文档核对(无依赖)。每个任务只动本任务 Files 列出的文件。

**兄弟前缀陷阱专项单测**:isPathInside 的 `/repo` vs `/repo-evil` 必须有专项用例。

**README 双语同步纪律**:EN/CN 核对措辞,若改动 MUST 双语同步;大概率零改动时只核对不修改。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-finish-routing-sync-archive/ -->
**prose 改动不涉测试**:收尾路由全部为命令 prose,全量 137 基线保持绿,无新增测试。spec delta 由 syncing 合并验证。

**手动/auto 模式约定**:手动模式 MUST 用 AskUserQuestion 询问;auto 模式 MUST 自动衔接执行;判断依据不充分时 MUST 默认询问而非自动衔接(与 creating-worktree 后续引导先例一致)。

**C 门 warn-only 不阻断不强制**:安全网而非强制,用户明确跳过时保留自主权。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-readme-docs-overhaul/ -->
文档版本信息不漂移纪律:仓库文档 SHALL NOT 硬编码随时间漂移的信息——插件版本号(plugin.json version)、测试用例数量、命令总数。需要引用版本时 MUST 以链接指向 CHANGELOG.md 或读自 plugin.json(单一数据源),涉及数量类信息 MUST NOT 写死字面量。

badges 不含版本号(shields 静态 version 需手工同步,重新引入漂移);demo 中基线测试写「全通过」,不写「137/137」。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-readme-english/ -->
多语言维护纪律:双语文版本文档结构 MUST 一一对应(根 README 12 段骨架 / 插件 README §1-14 节号),任何内容改动 MUST 同步全部语言版本。结构对齐(段/节为锚)是双语漂移的防线。

文件重命名用 `git mv` 保留历史,不复制新建。专名保留原文:`/speccode:` 命令名、worktree/trunk/feature/spec 等术语在英文版不做意译。

互链矩阵 4 组链接钉死:① 根 EN↔CN toggle ② 插件 EN↔CN toggle ③ 根→插件同语言 ④ 插件门面指针→同语言根 README。散落各文档靠自觉会漏改(上一 feature 教训),必须进 spec。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-13-knowledge-tools-detection/ -->
幂等补救纪律:re-init 对 config 中已登记、但当前判定为 available-only(未集成)的项,在 diff 中标记「建议移除」并提示,经用户确认后才移除——**绝不静默删除** config 中已登记项。探测结果经用户逐项确认后才落盘。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-13-remove-superpowers-traces/ -->
归档结构统一约定:archive 下变更目录用 `propose/`(proposal.md/design.md/specs/tasks.md)+ `plan/` + `brainstorm/` 三子目录结构(平级,plan/brainstorm 不进 propose/)。平铺结构的老变更应借机重整为 propose/ 结构。

引用改写分两类:A 类(指向具体迁移文件的路径引用)MUST 改写为新位置;B 类(陈述性提及,历史叙事)不改——改了反而失真。区分判据:是否为悬空路径(含 /specs/ 或 /plans/ 具体文件路径)。

文件移动用 `git mv` 保留 rename 历史。提交信息按 conventional commits:`docs(speccode): ...` / `chore(speccode): ...`。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-14-knowledge-set/ -->
命令层绝不手写 `speccode/knowledge/` 或 JSON 文件,一律经 verb;写 verb 强制 `--json-stdin`(从 stdin 读 JSON,避免超长/转义)。knowledge/ 写入走 `atomic.writeTextAtomic`(临时文件 + renameSync)。

marker 格式固定,promoted 块 body 不得包含 marker 字符串(开注释序列或闭注释序列)。marker 解析失败(格式损坏)报错退出并提示人工检查,不静默、不猜测。

蒸馏块 source 格式固定:archive 来源用 `archive/<归档目录名>/`,spec 来源用 `spec/<capability 目录名>/`。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-15-knowledge-command-rename/ -->
双格式 marker 纪律:写侧只产新格式 `distilled-from`/`/distilled`;读侧永久兼容旧 `promoted-from`/`/promoted`。replaceDistilledBlocks 写入时主动校验:重复 source 抛错(防静默丢失闸门确认块)、body 含 marker 字符串抛错(防产出后续解析拒绝的文件)——把「静默错误写入」转成「显式 pre-write 错误」。

改名触点清单化:tasks 列全触点(lib/bin/tests/commands/README×4/CHANGELOG/spec Purpose),收尾全仓 grep 校验禁区(旧名仅允许命中 archive/、.ua/、CHANGELOG 历史小节)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-15-knowledge-set-refocus/ -->
知识集骨架收窄为 6 个 development topic:architecture / standards / environment / integrations / pitfalls / security。business/* 退役是 BREAKING(新项目不再初始化 business topic)。promoted 块内容不得包含开注释序列或闭注释序列字符串;hand-written 段字节级保留,绝不自动修改。命令层绝不手写 `knowledge/` 文件,一律经 `write-knowledge` verb(mode=replace / append-hand / replace-promoted / index)。memorize 适配闸门不硬拦:判定为业务知识时给出「建议进 RAG」陈述,用户坚持则允许指定/新建 topic 写入——硬拒绝会在「架构 vs 业务」灰色地带误伤,与 promote 的「候选 diff → 人工确认」同一哲学。pitfalls 语义扩展:含评审中反复出现的问题模式与团队评审共识,不单列 review topic。多语言维护:插件 README 中英两版结构一一对应,任何改动 MUST 同步两版;两版均不得硬编码版本号与测试数量(以 CHANGELOG 链接为单一数据源)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-code-intel-rename/ -->
改名一致性约束:`code_intel_tools`(config 字段)/ `detectCodeIntelTools`(函数)/ `CODE_INTEL_TOOL_DETECTORS`(常量)/ `detect-code-intel-tools`(verb)/ `code-intel-tool-integration`(capability 目录)——跨层命名必须一致。不兼容历史:不 bump config version,`loadConfig` 不回退旧字段;用户改完重新 `/speccode:init` 重新探测写入。知识集 `knowledge` 不动(Non-Goal):knowledge-set capability / speccode/knowledge/ / knowledge.mjs / read-knowledge / write-knowledge / recording-knowledge / distilling-knowledge 保持不变。delta 元数据约定:capability RENAME 的 delta 顶部 HTML 注释 `(speccode:rename-from: 旧cap)`(HTML 注释不渲染、Markdown 工具忽略,syncing agent 读取)。syncing 幂等:重跑时新目录已存在,`git mv` 检测目标已存在则跳过,合并 delta 幂等(按 requirement 标题去重)。提交信息规范:`refactor(...)` / `docs(...)` / `feat(...)` 前缀;落盘即提交。全量测试命令必须用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`(裸 `node --test plugins/speccode/tests/` 在 Node v24 报 MODULE_NOT_FOUND)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-distill-incremental-archive/ -->
写 verb 的 `--json-stdin` 是布尔 flag(parseArgs 置 `true`),payload MUST `JSON.parse(readStdin())`,绝不 `JSON.parse(jsonStdin)`(C2,来自 knowledge/pitfalls.md——避免重蹈覆辙)。新增 verb/flag 照此模式。`consumed_archives` 存归档目录名(裸名,无 `archive/` 前缀无尾斜杠);source marker 用 `archive/<目录名>/`(带前缀带斜杠)——两套表示,勿混。旧 `promoted-from` marker 读侧永久兼容,写侧只产新 `distilled-from` 格式。原子写经 `writeJsonAtomic`(临时文件 `${path}.${pid}.tmp` + `rename`),绝不手写 JSON。sidecar 与 knowledge/ 落盘不一致风险:蒸馏写了块但 sidecar 未更新→下轮重读已蒸包;缓解——sidecar 更新与蒸馏落盘在同一命令事务内,失败则整体报告并提示重跑。人工删归档包后 `consumed_archives` 残留旧条目:未消费集 = 实扫 archive 目录 ∖ consumed;残留条目指向不存在的包,不影响判定(无副作用);可定期清理。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-knowledge-trunk-bootstrap/ -->
trunk 入口校验:`git rev-parse --abbrev-ref HEAD` MUST 等于 `config.trunk`,或为 `chore/knowledge-*` 维护分支(续跑)。HEAD 为 `worktree-` 前缀分支,或 `feature/`/`bugfix`/`refactor/` 功能分支,或不匹配 `chore/knowledge-` 的 `chore/` 功能分支→退出并提示回 trunk。bootstrap 前检测未完成 `chore/knowledge-*` 并优先建议续跑。任何续跑路径 MUST 先经 `feature-progress` 确认该分支未被登记为 speccode feature state;已登记(名字恰好撞上 `chore/knowledge-*` 的功能分支)→拒绝并提示回 trunk 另建维护分支。PR 创建前 MUST 先查该维护分支上是否已有 open PR,已有则跳过创建、复用并报告既有 PR url。`pr_tool=none`→打印等效命令并中止,且 MUST NOT 创建 speccode state 或经 finishing-feature。维护摘要 MUST 含 PR url(或等效命令),MUST NOT 写 feature 级 memory。trunk 级 memory 保留键 `_exploring` 与 `_knowledge` 免 `validateBranch` 的 `type/slug` 校验(无斜杠 trunk 键直通);其余 branch MUST 经 `validateBranch` 校验。memory 文件命名复用 state 文件的 `type__slug` 双下划线规则;主仓定位使同一 feature 的多个 worktree 共享同一份 memory。BREAKING 需在 CHANGELOG 标注。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-plan-progress-tick/ -->
勾选逻辑经引擎 verb 下沉,命令层 MUST NOT 用 sed/awk 在 prose 内直接改 plan(铁律:确定性逻辑绝不写进命令 markdown)。verb 输出 `ticked` 非空时命令 MUST 随同簿记点 commit;`ticked` 为空(幂等重跑,plan 未被改写)时 MUST 跳过 commit,MUST NOT 硬跑 `git commit` 让「nothing to commit」以非零退出误报失败。勾选 commit MUST 落在审查通过之后,不进入 `review-package` 的 base..head diff。ledger(`progress.md`)MUST 保持为崩溃恢复的唯一权威,plan checkbox 仅作完成态的派生视图,MUST NOT 参与恢复判断。checkbox 格式匹配 `^(\s*)- \[ \](.+)$`→替换为 `$1- [x]$2`,保留前导缩进;只勾 `[ ]`→`[x]`,不动其他状态(如 `[x]` 不回退)。幂等:已勾的不动,重跑安全。禁止占位符自检:所有 step 含可执行代码/命令/断言,无 TBD/TODO。测试用 tmprepo helpers 建真实临时 git 仓库。TDD:先写失败测试,运行确认失败,写最小实现,运行确认通过,提交。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-readme-optimization/ -->
README 成熟度信号与双语控成本准则:版本徽章用 shields dynamic/json 从 raw plugin.json 读 $.version,绝不硬编码;CHANGELOG 每版本小节顶部加一句英文 highlights(非全量双语翻译,控成本);CI 仅 test-only 不引 build/lint(测试 ≠ build,守「无 lint/build 步骤」纪律);双语改动按文件分组先 EN 后 zh 镜像;spec 数字 stale(21→23)经 syncing 的 MODIFIED 修正,不绕过规格流程。
<!-- /distilled -->

<!-- distilled-from: archive/2026-09-02-askuserquestion-cr-sanitizer/ -->
清洗类 hook 的工程准则:fail-open——hook 任何异常(stdin 非法、载荷缺字段、清洗抛错)一律 exit 0 且无输出,放行原输入,清洗是增强不是门禁,绝不阻断用户交互;清洗范围最小化,第一版只清 U+000D 不扩控制字符;stripCR 无 CR 时返回原引用,hook 壳用引用比较(cleaned !== tool_input)判变化,无变化零输出,避免无谓 updatedInput 与 schema 校验开销。
<!-- /distilled -->
