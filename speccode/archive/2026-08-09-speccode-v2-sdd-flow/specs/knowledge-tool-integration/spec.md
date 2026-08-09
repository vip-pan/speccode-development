## Purpose

代码知识库工具的探测、登记与 advisory 咨询:init 通过插件目录 / MCP 配置 / CLI 二进制 / 项目配置目录四类启发式探测 understand-anything、CodeGraph、Graphify、CodeMap、LightRAG 等工具并登记入 config,供需求探索与脑暴减少代码索引的 token 消耗;以及 worktree 基础目录的配置化。

## ADDED Requirements

### Requirement: 知识工具探测启发式

`/speccode:init` SHALL 通过四类探测识别代码知识库工具:(a) 已安装 Claude Code 插件目录(`~/.claude/plugins/` 下匹配);(b) 项目/用户级 MCP 配置(`.mcp.json` 等的 `mcpServers` key);(c) CLI 二进制(`command -v`);(d) 项目配置目录(如 `.codegraph/`)。内置探测表 MUST 至少覆盖 understand-anything、CodeGraph、Graphify、CodeMap、LightRAG。

#### Scenario: 插件目录命中
- **WHEN** `~/.claude/plugins/` 下存在 understand-anything 插件
- **THEN** 探测结果 MUST 含 `{id: "understand-anything", kind: "plugin", evidence: <插件注册表键, 如 understand-anything@understand-anything>}`

#### Scenario: CLI 命中
- **WHEN** `command -v codegraph` 退出码为 0
- **THEN** 探测结果 MUST 含 codegraph 条目,kind 为 `cli`

#### Scenario: 项目配置目录命中
- **WHEN** 项目根存在 `.lightrag/` 目录
- **THEN** 探测结果 MUST 含 lightrag 条目,kind 为 `project-dir`

### Requirement: detect-knowledge-tools verb

引擎 SHALL 暴露 `detect-knowledge-tools` verb,输出 `{tools: [{id, kind, evidence}]}`;探测涉及的 fs/spawn/readJson 依赖 MUST 全部支持依赖注入,保证单测不触碰真实环境。

#### Scenario: 依赖注入可测
- **WHEN** 单测以注入的 exists/commandV/readJson 替身调用探测函数
- **THEN** 探测 MUST 完全基于注入替身输出结果,不访问真实文件系统与进程

#### Scenario: 输出结构
- **WHEN** 执行 `detect-knowledge-tools --cwd .`
- **THEN** 输出 MUST 为 `{ok: true, tools: [...]}`,每个工具条目含 id/kind/evidence 三字段

### Requirement: knowledge_tools 配置字段

探测结果 SHALL 经用户逐项确认后写入 config 的 `knowledge_tools` 数组;init 幂等流程 MUST 支持该字段的 `[旧值]→[新值]` diff 展示与逐字段确认。

#### Scenario: 逐项确认写入
- **WHEN** init 探测到 3 个知识工具
- **THEN** 命令 MUST 逐项展示探测证据并询问是否登记,仅被确认的项写入 config

#### Scenario: 幂等 diff
- **WHEN** 二次 init 时 knowledge_tools 从 `[codegraph]` 变为 `[codegraph, lightrag]`
- **THEN** 命令 MUST 显示该字段 diff 并经用户确认后才写入

### Requirement: 命令咨询行为

exploring / proposing / brainstorming MUST 读取 config 的 `knowledge_tools` 列表:相应工具在会话中可用时 MUST 优先用其理解代码库,不可用时 MUST 回退到 Grep/Glob/Read;工具缺失或不可用 MUST NOT 导致命令报错。

#### Scenario: 可用时优先咨询
- **WHEN** knowledge_tools 含 understand-anything 且其知识图谱能力在会话中可用
- **THEN** exploring/proposing/brainstorming 在参考代码时 MUST 优先使用该工具

#### Scenario: 不可用时静默回退
- **WHEN** knowledge_tools 含某工具但其能力在当前会话不可用
- **THEN** 命令 MUST 回退到 Grep/Glob/Read 完成探索,不产生错误

### Requirement: worktree 基础目录配置

config SHALL 支持 `worktree_dir` 字段(默认 `.claude/worktrees`);init MUST 询问并写入;creating-worktree MUST 经 `resolve-worktree-dir` verb 解析,该 verb 输出 `{dir, source}` 且 `source` MUST ∈ `{config, default}`:`config` 表示键存在,`default` 表示键缺失并返回默认目录——此时 creating-worktree MUST 重新询问用户并经 `write-config` 写回后再继续。创建 worktree 前 MUST 对 worktree_dir 做 `git check-ignore` warn-only 校验(发现被 git 跟踪时警告,防止 worktree 元数据进入 git)。

#### Scenario: 默认值
- **WHEN** init 时用户未自定义 worktree 目录
- **THEN** `worktree_dir` MUST 写为 `.claude/worktrees`

#### Scenario: source=config 直接使用
- **WHEN** config.json 含 `worktree_dir`
- **THEN** `resolve-worktree-dir` MUST 返回该值且 `source` 为 `config`,creating-worktree 直接使用

#### Scenario: source=default 重问写回
- **WHEN** config.json 中 `worktree_dir` 键缺失(含被用户手动删除),执行 creating-worktree
- **THEN** `resolve-worktree-dir` MUST 返回 `{dir: ".claude/worktrees", source: "default"}`,命令 MUST 重新询问 worktree 目录,经 write-config 写回 config 后继续创建流程

#### Scenario: worktree 目录被 git 跟踪时警告
- **WHEN** `git check-ignore` 显示 worktree_dir 未被忽略(即会被 git 跟踪)
- **THEN** creating-worktree MUST 打印警告并建议将其加入 .gitignore,由用户决定是否继续
