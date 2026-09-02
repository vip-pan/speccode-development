<!-- distilled-from: archive/2026-07-13-add-speccode-plugin/ -->
**Node ≥ 24，纯 ESM，零第三方依赖（仅 node: 内置模块）**。引擎代码用 .mjs（import/export），不引入任何第三方依赖。测试用 node:test 对真实临时 git 仓库运行（tests/helpers/tmprepo.mjs 的 makeRepo/commitFile）。PR/等待类逻辑通过依赖注入（注入 queryPr/sleep）做快速单测，不依赖真实 gh/glab 或真实等待。

**测试命令必须用 glob 形式**：`node --test ./plugins/speccode/tests/*.test.mjs`。裸 `node --test plugins/speccode/tests/` 在 Node v24 会报 MODULE_NOT_FOUND，禁止用。单文件 `node --test plugins/speccode/tests/reconcile.test.mjs`；按名字过滤 `node --test --test-name-pattern="advances pr_open" plugins/speccode/tests/reconcile.test.mjs`。无 lint/build 步骤。

**.speccode/（运行时数据）vs 插件源码边界**：plugins/speccode/（引擎源码 + 命令 + references）是插件源码，在本仓库被 git 跟踪。speccode 运行时在目标项目产生的 .speccode/（config + state/features/ + memory/ + sdd/ + backup/）是运行时数据，设计上保持 untracked、插件不往项目 .gitignore 加条目（靠命令维护）。memory/ 与 sdd/ 由插件自写目录内 .gitignore（内容 `*`）自忽略。两者不可混淆。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-07-restructure-as-claude-code-plugin/ -->
**Claude Code 插件机制结构要求**：插件根放 .claude-plugin/plugin.json，组件（commands/skills/bin/...）在插件根而非 .claude-plugin/ 内；marketplace 仓根放 .claude-plugin/marketplace.json；bin/ 内容在插件启用期间被加入 Bash 工具 PATH；命令命名空间由 plugin.json 的 name 提供；${CLAUDE_PLUGIN_ROOT} 可引用插件安装目录但每次更新会变（ephemeral），不可存状态。

**marketplace 仓 + 插件子目录布局**：仓库根 = marketplace（.claude-plugin/marketplace.json，name speccode-development），插件 = plugins/speccode/ 子目录，marketplace.json 的 source: "./plugins/speccode" 指向它。Claude Code 没有 /plugin install <local-path> 直接装法——本地持久安装必须走 marketplace（/plugin marketplace add <path> + /plugin install speccode@name），git 远端同理。子目录布局为未来加第二个插件留扩展位。

**运行时数据保持目标项目根，引擎零改动**：speccodeDirOf(cwd) = join(repoRoot(cwd), '.speccode') 逻辑不动。引擎按目标项目 repoRoot 算，与插件装在哪无关——dogfood 时落本仓库根，别人装了在别的仓库跑就落那个仓库根。改成 ${CLAUDE_PLUGIN_DATA} 会把多项目状态混到全局目录，破坏按 feature 维度隔离、多项目独立语义。本仓库 dogfood 产生的 .speccode/ 用 .gitignore 忽略。

**三层命名统一**：根目录 = marketplace name = GitHub 仓库名 = speccode-development；插件 name 保持 speccode。三层统一让 /plugin marketplace add <owner>/speccode-development 的 repo 名与 marketplace name 对得上。git 跟踪文件内容而非目录名，mv 不破坏 git 历史。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-09-speccode-v2-sdd-flow/ -->
**config v2 字段集**：version:2、initialized_at、trunk、remote、pr_tool、worktree_prefix、worktree_dir、knowledge_tools；hooks 为可选字段（缺失=无 hook）。v1 三字段（display/spec_tools/untracked_permanent）MUST NOT 出现在 version:2 的 config 中。v1→v2 迁移时若用户接受升级则三字段 MUST 被移除，不存在混合态；若拒绝则整体保持 v1。

**worktree_dir 配置化**：config 增加 worktree_dir 字段（默认 .claude/worktrees）。resolve-worktree-dir verb 输出 {dir, source:'config'|'default'} 两态（无 'missing'）。source=default（config 缺少该键，含被用户手动删除）时命令层重问并 write-config 写回。creating-worktree 创建前 `git check-ignore -q <dir>` warn-only 校验（未被忽略则警告，不硬阻断）。

**speccode 文档目录布局（目标项目）**：speccode/changes/<slug>/{propose,brainstorm,plan}/（活跃变更）、speccode/spec/（syncing 合并后的主规格）、speccode/archive/<YYYY-MM-DD>-<slug>/（归档）。刻意不与 openspec 默认目录（openspec/）同名：目标项目若已用 openspec 可并存不冲突。slug = 所属 feature 分支的 slug 段。同 feature 多轮开发时每轮重建 changes/（前一轮已 archiving 移走，不冲突）。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-10-self-host-speccode/ -->
**speccode 主规格格式与 OpenSpec 逐字兼容**：`# <capability> Specification` / `## Purpose` / `## Requirements`，requirement 含 SHALL/MUST + Scenario。openspec/specs/ 可原样 git mv 播种进 speccode/spec/，保历史。内容修正走 delta 流程（propose→sync），使 speccode/spec/ 每处内容都有 delta 出处。.claude/ 与 .speccode/ 均已被 .gitignore 忽略——opsx/openspec 工具的清除是本地清理，不进 PR。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-check-ignore-outside-repo/ -->
**Node ≥ 24,纯 ESM,零第三方依赖**(仅 `node:` 内置模块)。全量测试必须用 glob 形式 `node --test ./plugins/speccode/tests/*.test.mjs`;裸跑目录 `node --test plugins/speccode/tests/` 在 Node v24 报 MODULE_NOT_FOUND。

**涉及 git 的测试用 tmprepo makeRepo()/commitFile() 建真实临时 git 仓库,rmSync 清理**;不依赖 mock git。

**仓库根定位**:`git rev-parse --path-format=absolute --git-common-dir` + dirname(不是 --show-toplevel),让 linked worktree 内运行的命令也能解析到主仓 .speccode/。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-11-visual-companion-cleanup/ -->
**visual-companion server 取页流程**:需先带 ?key= 取 cookie、再携 cookie 请求等待页;直接 curl ?key= 只会得到 bootstrap 跳转页。冒烟测试须按此流程,否则断言落空。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-readme-docs-overhaul/ -->
Node ≥ 24,纯 ESM,零第三方依赖(仅 `node:` 内置模块)。无 package.json、无 lint/build 步骤。全量测试必须用 glob 形式 `node --test ./plugins/speccode/tests/*.test.mjs`(裸 `node --test plugins/speccode/tests/` 在 Node v24 报 MODULE_NOT_FOUND)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-13-knowledge-tools-detection/ -->
知识工具探测的依赖注入:探测涉及的 fs/spawn/readJson 依赖 MUST 全部支持依赖注入(readJson / commandV / exists),保证单测不触碰真实环境。CLI verb e2e 用 `spawnSync('node', [BIN, ...])`,写 verb 用 `input` 传 stdin;BIN 用 `import.meta.url` 定位,与 cwd 无关。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-14-knowledge-set/ -->
git 相关单测用 `tests/helpers/tmprepo.mjs` 的 `makeRepo()` / `commitFile()` 建真实临时 git 仓库,用完 `rmSync(repo, {recursive:true, force:true})` 清理。PR/等待类逻辑通过依赖注入(注入 run/queryPr/spawn)做单测,不依赖真实 gh/glab 或真实等待。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-15-gitnexus-detector/ -->
知识工具探测器表(`KNOWLEDGE_TOOL_DETECTORS`)覆盖代码知识图谱工具:understand-anything(.ua/.understand-anything)、CodeGraph(.codegraph)、Graphify(.graphify)、CodeMap(.codemaker/codeindex 或 .codemaker/codemap)、GitNexus(.gitnexus)。LightRAG 是通用文档 RAG(非代码、非图谱)属分类噪声,移出。bin 名独特的工具(如 gitnexus)不会像 `understand` 那样误命中无关二进制。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-15-knowledge-set-refocus/ -->
Tech Stack:Markdown 命令文件(Claude Code slash 命令)、Node ≥24 `node --test`。纯命令层 + 文档改动;引擎 lib(knowledge.mjs)与 9 个消费命令零改动。测试文件中的 business/domain.md 仅为合法 fixture 路径(lib topic 无关),无需改动。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-code-intel-rename/ -->
Tech Stack:纯 ESM、零第三方依赖(仅 `node:` 内置模块)、Node ≥ 24。无 package.json。代码智能工具探测四类启发式:(a) `~/.claude/plugins/installed_plugins.json` 命中;(b) `command -v <bin>` 退出码为 0;(c) 任意 MCP 配置命中(项目 `.mcp.json` 或用户 `~/.claude.json` 的 `mcpServers`);(d) 项目配置目录存在(每个工具可探测多个候选目录,first-existing wins):understand-anything 为 `.ua`/`.understand-anything`,codegraph 为 `.codegraph`,graphify 为 `.graphify`,codemap 为 `.codemaker/codeindex`/`.codemaker/codemap`,gitnexus 为 `.gitnexus`。探测结果区分 available(可用)与 integrated(集成)两个维度;仅当某工具 available 与 integrated 同时为 true 时才可被登记;available-only 的工具 MUST NOT 写入 config。init 幂等流程支持 `[旧值]→[新值]` diff 展示与逐字段确认。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-distill-incremental-archive/ -->
Tech Stack:Node ≥24,纯 ESM,零三方依赖,`node:test` + `node:assert/strict`,真实临时 git 仓库(`tests/helpers/tmprepo.mjs` 的 `makeRepo()`)。PR/等待类逻辑通过依赖注入做单测(注入 run/queryPr/spawn),不依赖真实 gh/glab 或真实等待。CLI verb 用 `spawnSync('node',[BIN,...])` 端到端测(写 verb 用 input 传 stdin),BIN 用 `import.meta.url` 定位,与 cwd 无关。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-knowledge-trunk-bootstrap/ -->
Tech Stack:Node ≥ 24,纯 ESM、零第三方依赖(仅 `node:` 内置);无 `package.json`;测试用 `node --test`;命令层 markdown 指令 + CLI verb。仓库根定位:主仓根用 `--git-common-dir`;memory/ 为 trunk 级共享(主仓 `.speccode/memory/`)。PR 创建镜像 finishing-feature §2:命令层 shell out `gh`/`glab`,经 `prtool.createPrArgs` 拼参数;不引入新 verb。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-plan-progress-tick/ -->
Tech Stack:纯 ESM、零第三方依赖(仅 `node:` 内置)、Node ≥ 24。plan 文档(`speccode/changes/<slug>/plan/*.md`)是 tracked 设计文档,随 PR 上 trunk;ledger(`.speccode/sdd/<plan>/progress.md`)是 untracked 草稿,恢复用。原子写经 `atomic.writeTextAtomic`(临时文件 + rename)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-readme-optimization/ -->
文档与 CI 基础设施:根/.github/workflows/test.yml 为 test-only GitHub Action(命令 node --test ./plugins/speccode/tests/*.test.mjs,glob 形式避 Node v24 MODULE_NOT_FOUND,pull_request+push 触发);新增 CONTRIBUTING.md 与 .github/ Issue/PR 模板;插件 README(275 行 14 段)加 ToC,根 README 短不加;版本徽章与 CI 徽章并列于根 README 徽章段。
<!-- /distilled -->

<!-- distilled-from: archive/2026-09-02-askuserquestion-cr-sanitizer/ -->
插件 hooks 层环境:plugins/speccode/hooks/ 下 hooks.json(注册)+ sanitize-ask.mjs(壳);测试新增 sanitize(纯函数)与 sanitize-hook(spawnSync 子进程测 fail-open 与输出契约)两文件;开发期真机验证方式:临时在目标项目 .claude/settings.local.json 注册 PreToolUse hook——中途注册即生效无需重启会话,验证后删除该块恢复现场。
<!-- /distilled -->
