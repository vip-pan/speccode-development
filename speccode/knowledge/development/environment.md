

<!-- distilled-from: cap/plugin-packaging -->
**Tech Stack(引擎)**:Node ≥ 24,纯 ESM,零第三方依赖(仅 node: 内置模块),无 package.json、无 lint/build 步骤。全量测试必须用 glob 形式 node --test ./plugins/speccode/tests/*.test.mjs(裸 node --test plugins/speccode/tests/ 在 Node v24 报 MODULE_NOT_FOUND);单文件与 --test-name-pattern 过滤可用。涉及 git 的测试用 tests/helpers/tmprepo.mjs 的 makeRepo()/commitFile() 建真实临时 git 仓库,rmSync 递归清理,不依赖 mock git;PR/等待类逻辑通过依赖注入(注入 run/queryPr/spawn)做单测,不依赖真实 gh/glab 或真实等待;CLI verb 用 spawnSync('node',[BIN,...]) 端到端测(写 verb 用 input 传 stdin),BIN 用 import.meta.url 定位与 cwd 无关。

**Claude Code 插件机制结构**:插件根放 .claude-plugin/plugin.json,组件(commands/bin 等)在插件根而非 .claude-plugin/ 内;marketplace 仓根放 .claude-plugin/marketplace.json;bin/ 在插件启用期间被加入 Bash 工具 PATH;命令命名空间由 plugin.json 的 name 提供;${CLAUDE_PLUGIN_ROOT} 可引用安装目录但每次更新会变(ephemeral),不可存状态。本地持久安装必须走 marketplace(/plugin marketplace add + install),无本地路径直装法。**三层命名统一**:根目录 = marketplace name = GitHub 仓库名 = speccode-development(插件 name 保持 speccode);git 跟踪内容而非目录名,mv 不破坏历史。**.speccode/(运行时数据)vs 插件源码边界**:plugins/speccode/ 是被跟踪的插件源码;运行时 .speccode/(config + state + memory/ + sdd/ + backup/)保持 untracked、插件不往项目 .gitignore 加条目(靠命令维护);memory/ 与 sdd/ 由插件自写目录内 .gitignore(内容 *)自忽略。引擎按目标项目 repoRoot 算(speccodeDirOf),与插件装在哪无关;改用 ${CLAUDE_PLUGIN_DATA} 会把多项目状态混到全局,破坏按 feature 隔离。**CI**:.github/workflows/test.yml 为 test-only(push + pull_request 触发,glob 形式命令,不引入 lint/build——测试不等于 build)。(出自 archive/2026-07-13-add-speccode-plugin、2026-08-07-restructure-as-claude-code-plugin、2026-08-12-check-ignore-outside-repo、2026-08-12-readme-docs-overhaul、2026-08-13-knowledge-tools-detection、2026-08-14-knowledge-set、2026-08-15-knowledge-set-refocus、2026-08-16-code-intel-rename、2026-08-16-distill-incremental-archive、2026-08-16-knowledge-trunk-bootstrap、2026-08-16-plan-progress-tick、2026-08-16-readme-optimization 等)
<!-- /distilled -->

<!-- distilled-from: cap/speccode-config-management -->
**config 字段集(v3)**:version:3、initialized_at、trunk、remote、pr_tool、worktree_dir、code_intel_tools;hooks 可选(缺失 = 无 hook)。v1 三字段(display/spec_tools/untracked_permanent)与 v2 的 worktree_prefix MUST NOT 出现在 version:3 中;v2 读兼容,init 升级按字段 diff 移除(接受升级则移除死字段,拒绝则整体保持旧版,不存在混合态)。state 统一 `state/branches/<type>__<slug>.json`(v2 遗留 state/features/ 双格式原样运行,格式跟随既有文件);v3 普通分支 schema {branch, type, worktree, merge_target(恒写), status, created_at, initial_branch}(迁移产物 worktree 允许 null),父实体 {branch, kind:"integration", children:[{slug}], status, created_at, initial_branch} 无 worktree 字段;状态枚举不变。

**worktree_dir 配置化**:默认 .claude/worktrees;resolve-worktree-dir verb 输出 {dir, source, ignore},source ∈ {config, default}(default = 键缺失含被手删,命令层重问并 write-config 写回);ignore 三分支见 code-intel 块。**仓库根定位**:`git rev-parse --path-format=absolute --git-common-dir` + dirname(不是 --show-toplevel),让 linked worktree 内运行的命令也能解析到主仓 .speccode/。(出自 archive/2026-08-09-speccode-v2-sdd-flow、2026-08-12-check-ignore-outside-repo、2026-09-03-remove-feature-layer、2026-08-16-knowledge-trunk-bootstrap)
<!-- /distilled -->

<!-- distilled-from: cap/sdd-document-lifecycle -->
**speccode 文档目录布局(目标项目)**:speccode/changes/<slug>/{propose,brainstorm,plan}/(活跃变更)、speccode/spec/(syncing 合并后的主规格)、speccode/archive/<YYYY-MM-DD>-<slug>/(归档)。刻意不与 openspec 默认目录同名:目标项目若已用 openspec 可并存不冲突。slug = 所属 feature 分支的 slug 段;同 feature 多轮开发每轮重建 changes/(前一轮已 archiving 移走,不冲突)。**主规格格式与 OpenSpec 逐字兼容**:# <capability> Specification / ## Purpose / ## Requirements,requirement 含 SHALL/MUST + Scenario;openspec/specs/ 可原样 git mv 播种进 speccode/spec/ 保历史,内容修正走 delta 流程(propose→sync)使每处内容有 delta 出处。**tracked/untracked 边界**:plan 文档(speccode/changes/<slug>/plan/*.md)是 tracked 设计文档随 PR 上 trunk;ledger(.speccode/sdd/<plan>/progress.md)是 untracked 草稿,恢复用。(出自 archive/2026-08-09-speccode-v2-sdd-flow、2026-08-10-self-host-speccode、2026-08-16-plan-progress-tick)
<!-- /distilled -->

<!-- distilled-from: cap/code-intel-tool-integration -->
**代码智能工具探测器表**:understand-anything(.ua/.understand-anything)、CodeGraph(.codegraph)、Graphify(.graphify)、CodeMap(.codemaker/codeindex 或 .codemaker/codemap——codemap 自身 .gitignore 含 .codemaker/codeindex/,两个候选目录都认)、GitNexus(.gitnexus,由 gitnexus analyze 生成并自加 .gitignore;MCP server 名同为 gitnexus,走 projectMcp 探针;bin 名 gitnexus 独特不误命中)。LightRAG 是通用文档 RAG(非代码、非图谱)属分类噪声,已移出。四类探测启发式:(a) ~/.claude/plugins/installed_plugins.json 命中;(b) command -v <bin> 退出码 0;(c) 任意 MCP 配置(项目 .mcp.json 或用户 ~/.claude.json);(d) 项目配置目录存在(每个工具多候选,first-existing wins)。探测涉及的 fs/spawn/readJson 依赖全部支持依赖注入,单测不触碰真实环境。(出自 archive/2026-08-15-gitnexus-detector、2026-08-13-knowledge-tools-detection、2026-08-16-code-intel-rename)
<!-- /distilled -->

<!-- distilled-from: cap/documentation-facade -->
**visual companion server 取页流程**:需先带 ?key= 取 cookie、再携 cookie 请求等待页;直接 curl ?key= 只会得到 bootstrap 跳转页——冒烟测试须按此流程,否则断言落空。**文档与 CI 基础设施**:CONTRIBUTING.md 与 .github/ Issue/PR 模板;插件 README(14 段)加 ToC,根 README 短不加;版本徽章与 CI 徽章并列于根 README 徽章段。(出自 archive/2026-08-11-visual-companion-cleanup、2026-08-16-readme-optimization)
<!-- /distilled -->

<!-- distilled-from: cap/tool-input-sanitization -->
**插件 hooks 层环境**:plugins/speccode/hooks/ 下 hooks.json(注册)+ sanitize-ask.mjs(壳);测试新增 sanitize(纯函数)与 sanitize-hook(spawnSync 子进程测 fail-open 与输出契约)两文件。开发期真机验证方式:临时在目标项目 .claude/settings.local.json 注册 PreToolUse hook——中途注册即生效无需重启会话,验证后删除该块恢复现场。(出自 archive/2026-09-02-askuserquestion-cr-sanitizer)
<!-- /distilled -->
