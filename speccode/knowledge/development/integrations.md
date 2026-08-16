<!-- distilled-from: archive/2026-07-13-add-speccode-plugin/ -->
**gh/glab CLI 探测与封装**：init 时通过 `git remote get-url origin` 探测远端类型（URL 含 github.com → gh；含 gitlab → glab；其他 → none），一次性写入 config。命令运行时不再探测（避免性能开销与不可控结果）。pr_tool=none 时 finish/develop-complete 不实际创建 PR，而是打印等效命令让用户手动执行，避免功能硬性要求外部 CLI。

**wait_for_pr_merge 共享原语**：每 30 秒轮询一次 PR/MR 状态，默认 30 分钟超时（约 60 次查询），避免触发平台 API rate limit。gh 查询 `gh pr view <head> --json state,mergedAt,mergeCommit`；glab 查询 `glab mr view <head> --output json`。解析为统一状态 MERGED/OPEN/CLOSED/CONFLICTING/UNKNOWN。--resume 续跑用同一间隔。超时写 pending_operation 供续跑。

**PR base 同步**：develop-complete 在创建 PR/MR 前必须先 `git push origin <feature>`，保证 base 分支在远端为最新，避免多 worktree 串行时 base 过期导致 diff 混入他人成果。feature 远端分叉（non-fast-forward）时中止并提示用户处理，不强推 feature。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-09-speccode-v2-sdd-flow/ -->
**query-pr 单次查询 verb 取代阻塞等待**：删除 waitmerge.mjs（阻塞 30 分钟与 Claude Code Bash 超时模型不兼容，这是它从未被接线的根因）。改为暴露单次 `query-pr --number <N> --cwd .`，返回五态 {MERGED, OPEN, CLOSED, CONFLICTING, UNKNOWN}。30s/30min 轮询循环留在命令 prose。引擎 MUST NOT 提供阻塞式等待 verb。CONFLICTING 真正实现：gh 查询参数加 mergeable 字段（mergeable==CONFLICTING → CONFLICTING）；glab 用 has_conflicts 映射。

**hooks 事件枚举（14 个固定事件）**：onExplored, onFeatureCreated, onWorktreeCreated, onProposed, onBrainstormed, onPlanned, onTaskCompleted, onCodeReviewRequested, onCodeReviewCompleted, onWorktreeFinished, onFeatureFinished, onPrOpened, onSynced, onArchived。hook 进程经 stdin 收单行 JSON payload。hook 命令经 `sh -c <cmd>` 执行，cwd=目标项目根，默认 30s 超时。payload 序列化为单行 JSON（含特殊字符时正确转义）。

**hooks payload 分工与 stdin 读取约束**：引擎只补 envelope 四字段（event/timestamp/repo_root/cwd）；command 与事件上下文字段由调用方在 payload 片段传入。payload 片段允许为空（视为 {}），run-hook 的 stdin 读取 MUST 容忍空输入，不阻塞等待。stdin 读取用 `isatty(0)` 判定（TTY 时跳过），绝不触碰 process.stdin（否则 fd 0 被置非阻塞、慢生产者场景 readFileSync(0) 抛 EAGAIN 静默丢片段）。

**知识库工具探测四类启发式**：(a) 已安装 Claude Code 插件目录（~/.claude/plugins/installed_plugins.json 键大小写不敏感子串匹配）；(b) 项目/用户级 MCP 配置（.mcp.json 与 ~/.claude.json 的 mcpServers key）；(c) CLI 二进制（command -v）；(d) 项目配置目录（如 .codegraph/）。内置探测表覆盖 understand-anything/codegraph/graphify/codemap/lightrag。detectKnowledgeTools(cwd, opts) 的 fs/spawn/readJson 全部依赖注入，保证单测不碰真实环境。命中优先级 plugin > mcp > cli > project-dir，每个 id 至多一条。

**知识工具咨询为 advisory 配置驱动**：commands-only 插件无法程序化调用另一插件的 slash command 或 agent（无跨插件调用机制）。现实机制：init 探测 → config.knowledge_tools 落盘 → exploring/proposing/brainstorming 的命令 prose 按列表生成「若本会话中其 MCP server/agent 可用则优先，否则回退 Grep/Glob/Read」指引。探测只产生 advisory 提示，永不报错。探测结果 MUST 经用户逐项确认才写入 config。

**SDD 三脚本以 node lib + verb 重实现（不搬 bash）**：sdd-workspace/task-brief/review-package 是 SDD 的承重件（工件以文件交接纪律所系）。以 lib/sdd.mjs 重实现而非搬 bash 的理由：(1) 引擎不变量「确定性逻辑下沉 lib 并配单测」；(2) task-brief 的 awk fence 解析正是需要单测的逻辑（Task 1 不得误配 Task 10）；(3) Node≥24 已是硬依赖，bash+awk 降低可移植性。task-brief 纯函数 extractTaskBrief，fence 感知（fence 内标题忽略、fence 行保留在任务体）。

**run-hook 是唯一永远 exit 0 的 verb**：handler 整体 try/catch 兜底、永不返回 ok:false——否则 bin main() 的 catch 会在最不该失败的时刻（hook 挂点）exit 1。所有错误（未传 --event、stdin 片段解析失败、hook 本身超时/非零退出）折叠进 hook 字段（{ran, ok, warning?, exitCode?, error?}），恒返 {ok:true, hook:{...}}。这是 warn-only 语义的成立条件。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-12-check-ignore-outside-repo/ -->
**git check-ignore 退出码三态**:0 = 被忽略、1 = 仓库内未忽略、128 = 路径在仓库外(`fatal: is outside repository`)。128 还覆盖其他 fatal(如非 git 仓库),反推不可靠。命令只区分 0/非 0 会把 128 误判为"未忽略"。

**check-ignore 对目录的查询须带尾斜杠**:裸路径即使被 dir 模式(.wt/)忽略也会返回 exit 1;`<dir>/` 明确按目录判定。

**verb 返回 ignore 字段数据模型**:`{ok, dir, source, ignore}`,其中 ignore = `{scope:'outside'}` | `{scope:'inside', ignored: boolean}`,向后兼容新增字段。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-13-knowledge-tools-detection/ -->
知识工具四类探测来源映射:
- 插件注册表:`~/.claude/plugins/installed_plugins.json` 的 plugins key
- CLI:`command -v <bin>` 退出码 0
- 项目级 MCP:项目 `.mcp.json` 的 mcpServers key
- 用户级 MCP:`~/.claude.json` 的 mcpServers(全局)或 `projects[<cwd>].mcpServers`(项目作用域)
- 项目配置目录:每个工具有固定候选目录(first-existing wins)

codemap 真索引目录核验:codemap 自身 .gitignore 含 `.codemaker/codeindex/`,探测器需同时认 `.codemaker/codeindex` 与 `.codemaker/codemap`。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-15-gitnexus-detector/ -->
GitNexus 探测签名:`{id:'gitnexus', match:'gitnexus', bin:'gitnexus', dirs:['.gitnexus']}`。bin 名 `gitnexus` 独特不误命中;`.gitnexus/` 目录由 `gitnexus analyze` 生成并自加 .gitignore;MCP server 名同为 `gitnexus`(`npx gitnexus setup` 写入项目 .mcp.json),走 projectMcp 探针。GitNexus 是零服务端代码知识图谱引擎(tree-sitter 解析 → KuzuDB 图库 + MCP)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-code-intel-rename/ -->
代码智能工具(原 knowledge_tools)的集成模型:available 与 integrated 两维度。available = 工具在环境中存在(插件目录/CLI/MCP 配置命中任一);integrated = 工具在当前项目集成(项目级 MCP `.mcp.json` 的 mcpServers key 命中,或用户级 `~/.claude.json` 的 `projects[<cwd>].mcpServers` key 命中,或项目配置目录存在)。内置探测表覆盖 understand-anything、CodeGraph、Graphify、CodeMap、GitNexus;lightrag 不再探测。命令咨询行为:exploring/proposing/brainstorming MUST 读取 config 的 `code_intel_tools` 列表,相应工具在会话中可用时 MUST 优先用其理解代码库,不可用时 MUST 回退到 Grep/Glob/Read;工具缺失或不可用 MUST NOT 导致命令报错(静默回退)。worktree 基础目录配置:config 支持 `worktree_dir` 字段(默认 `.claude/worktrees`);`resolve-worktree-dir` verb 输出 `{dir, source, ignore}`,source ∈ {config, default};ignore 三分支判定(仓库外/仓库内未忽略/仓库内已忽略)。
<!-- /distilled -->

<!-- distilled-from: archive/2026-08-16-knowledge-trunk-bootstrap/ -->
PR 工具集成:`pr_tool` ∈ {gh, glab, none}。命令层 shell out `gh`/`glab` 创建 PR,经 `prtool.createPrArgs` 拼参数(base, head, title, body)。`pr_tool=none`→打印等效命令(如 `gh pr create --base <trunk> --head <分支> --title ...`)并中止,分支已 commit。PR 创建前先查该维护分支上是否已有 open PR,已有则跳过创建、复用并报告既有 PR url。memory 数据模型:feature 级 memory 为 `.speccode/memory/<type>__<slug>.md`(双下划线规则,复用 state 文件命名);trunk 级例外 `.speccode/memory/_exploring.md` 与 `.speccode/memory/_knowledge.md`(无斜杠 trunk 键直通)。memory 保持 untracked(与 `.speccode/` 其他运行时数据一致);主仓定位使同一 feature 的多个 worktree 共享同一份 memory。
<!-- /distilled -->
