# code-intel-tool-integration Specification

## Purpose

代码智能工具(代码索引 + 代码知识图谱 MCP 工具)的探测、登记与 advisory 咨询:init 通过插件目录 / MCP 配置 / CLI 二进制 / 项目配置目录四类启发式探测 understand-anything、CodeGraph、Graphify、CodeMap、GitNexus 等工具并登记入 config(`code_intel_tools`),供需求探索与脑暴减少代码索引的 token 消耗;以及 worktree 基础目录的配置化。

## Requirements

### Requirement: 代码智能工具探测启发式

`/speccode:init` SHALL 通过四类探测识别代码智能工具,并把每个工具的探测结果区分为**可用(available)**与**集成(integrated)**两个维度:

- available(可用):(a) `~/.claude/plugins/installed_plugins.json` 命中;(b) `command -v <bin>` 退出码为 0;(c) 任意 MCP 配置命中(项目 `.mcp.json` 或用户 `~/.claude.json` 的 `mcpServers`)。
- integrated(集成):(a) 项目 `.mcp.json` 的 `mcpServers` key 命中;(b) `~/.claude.json` 的 `projects[<cwd>].mcpServers` key 命中;(c) 项目配置目录存在(每个工具可探测多个候选目录,first-existing wins):understand-anything 为 `.ua` / `.understand-anything`,codegraph 为 `.codegraph`,graphify 为 `.graphify`,codemap 为 `.codemaker/codeindex` / `.codemaker/codemap`,gitnexus 为 `.gitnexus`。

内置探测表 MUST 至少覆盖 understand-anything、CodeGraph、Graphify、CodeMap、GitNexus。

#### Scenario: 插件目录命中
- **WHEN** `~/.claude/plugins/installed_plugins.json` 存在 understand-anything 插件,但项目内不存在 `.ua/`(或 `.understand-anything/`)且无项目级 MCP 配置
- **THEN** 探测结果 MUST 含 `{id: "understand-anything", available: {value: true, evidence: <插件注册表键>}, integrated: {value: false, evidence: null}}`

#### Scenario: CLI 命中
- **WHEN** `command -v codegraph` 退出码为 0
- **THEN** 探测结果 MUST 含 codegraph 条目,`available.value` MUST 为 `true`

#### Scenario: 项目配置目录命中
- **WHEN** 项目根存在 `.codemaker/codemap/` 目录
- **THEN** 探测结果 MUST 标记 codemap `integrated = true`,evidence 为该目录

#### Scenario: gitnexus 项目目录命中
- **WHEN** 项目根存在 `.gitnexus/` 目录
- **THEN** 探测结果 MUST 标记 gitnexus `integrated = true`,evidence 为 `.gitnexus`

#### Scenario: 项目级 MCP 命中
- **WHEN** 项目 `.mcp.json` 的 `mcpServers` 含某工具 key
- **THEN** 探测结果 MUST 标记该工具 `integrated = true` 且 `available = true`,evidence 为该 MCP key

#### Scenario: lightrag 不再探测
- **WHEN** 执行 `detect-code-intel-tools`
- **THEN** 探测结果 MUST NOT 含 `id` 为 `lightrag` 的条目

### Requirement: detect-code-intel-tools verb

引擎 SHALL 暴露 `detect-code-intel-tools` verb,输出每个工具的两个维度 `{tools: [{id, available: {value, evidence?}, integrated: {value, evidence?}}]}`;探测涉及的 fs/spawn/readJson 依赖 MUST 全部支持依赖注入,保证单测不触碰真实环境。

#### Scenario: 依赖注入可测
- **WHEN** 单测以注入的 exists/commandV/readJson 替身调用探测函数
- **THEN** 探测 MUST 完全基于注入替身输出结果,不访问真实文件系统与进程

#### Scenario: 输出结构
- **WHEN** 执行 `detect-code-intel-tools --cwd .`
- **THEN** 输出 MUST 为 `{ok: true, tools: [...]}`,每个工具条目 MUST 含 `id`、`available.value`、`integrated.value`

### Requirement: code_intel_tools 配置字段

探测结果 SHALL 经用户逐项确认后写入 config 的 `code_intel_tools` 数组;**仅当某工具 `available` 与 `integrated` 同时为 true 时,该工具才可被登记**;available-only(可用但未集成)的工具 MUST NOT 写入 config。init 幂等流程 MUST 支持该字段的 `[旧值]→[新值]` diff 展示与逐字段确认;对 config 中已登记、但当前判定为 available-only 的工具,MUST 在 diff 中标记并提示移除(经用户确认)。

#### Scenario: 逐项确认写入
- **WHEN** init 探测到 3 个代码智能工具
- **THEN** 命令 MUST 逐项展示探测证据并询问是否登记,仅被确认的项写入 config

#### Scenario: 幂等 diff
- **WHEN** 二次 init 时 code_intel_tools 从 `[codegraph]` 变为 `[codegraph, gitnexus]`
- **THEN** 命令 MUST 显示该字段 diff 并经用户确认后才写入

#### Scenario: available-only 不登记
- **WHEN** 探测到某工具 `available = true` 但 `integrated = false`
- **THEN** 命令 MUST 展示该工具为「可用但项目未集成」,且 MUST NOT 将其写入 config

#### Scenario: 两维度满足才登记
- **WHEN** 探测到某工具 `available = true` 且 `integrated = true`
- **THEN** 命令 MUST 经用户确认后才可将其写入 config

#### Scenario: 幂等补救 available-only 既有项
- **WHEN** 二次 init 时 config 已有某工具,但其当前判定为 `integrated = false`
- **THEN** 命令 MUST 在 diff 中标记该工具为「建议移除」,经用户确认后移除

### Requirement: 命令咨询行为

exploring / proposing / brainstorming MUST 读取 config 的 `code_intel_tools` 列表:相应工具在会话中可用时 MUST 优先用其理解代码库,不可用时 MUST 回退到 Grep/Glob/Read;工具缺失或不可用 MUST NOT 导致命令报错。

#### Scenario: 可用时优先咨询
- **WHEN** code_intel_tools 含 understand-anything 且其知识图谱能力在会话中可用
- **THEN** exploring/proposing/brainstorming 在参考代码时 MUST 优先使用该工具

#### Scenario: 不可用时静默回退
- **WHEN** code_intel_tools 含某工具但其能力在当前会话不可用
- **THEN** 命令 MUST 回退到 Grep/Glob/Read 完成探索,不产生错误

### Requirement: worktree 基础目录配置

config SHALL 支持 `worktree_dir` 字段(默认 `.claude/worktrees`);init MUST 询问并写入;creating-worktree MUST 经 `resolve-worktree-dir` verb 解析,该 verb 输出 `{dir, source}` 且 `source` MUST ∈ `{config, default}`:`config` 表示键存在,`default` 表示键缺失并返回默认目录——此时 creating-worktree MUST 重新询问用户并经 `write-config` 写回后再继续。该 verb MUST 另输出 `ignore` 字段,表示对 worktree_dir 的 gitignore 校验结果,且校验判定 MUST 三分支:
- worktree_dir 在仓库根之外 → `ignore.scope` MUST 为 `"outside"`,creating-worktree MUST 静默继续;
- worktree_dir 在仓库根之内且未被忽略 → `ignore.scope` MUST 为 `"inside"` 且 `ignore.ignored` MUST 为 `false`,creating-worktree MUST 警告并建议加入 `.gitignore` 后询问用户是否继续;
- worktree_dir 在仓库根之内且已被忽略 → `ignore.scope` MUST 为 `"inside"` 且 `ignore.ignored` MUST 为 `true`,creating-worktree MUST 静默继续。

判定「仓库外」时 MUST NOT 调用 `git check-ignore`。

#### Scenario: 默认值
- **WHEN** init 时用户未自定义 worktree 目录
- **THEN** `worktree_dir` MUST 写为 `.claude/worktrees`

#### Scenario: source=config 直接使用
- **WHEN** config.json 含 `worktree_dir`
- **THEN** `resolve-worktree-dir` MUST 返回该值且 `source` 为 `config`,creating-worktree 直接使用

#### Scenario: source=default 重问写回
- **WHEN** config.json 中 `worktree_dir` 键缺失,执行 creating-worktree
- **THEN** `resolve-worktree-dir` MUST 返回 `{dir: ".claude/worktrees", source: "default"}`,命令 MUST 重新询问 worktree 目录,经 write-config 写回 config 后继续创建流程

#### Scenario: worktree_dir 在仓库外
- **WHEN** `worktree_dir` 配置为仓库根之外的路径
- **THEN** `ignore.scope` MUST 为 `"outside"`,creating-worktree MUST 静默继续

#### Scenario: worktree_dir 在仓库内且未忽略
- **WHEN** `worktree_dir` 在仓库根之内且未被 `.gitignore`/`info/exclude` 忽略
- **THEN** `ignore` MUST 为 `{scope: "inside", ignored: false}`,creating-worktree MUST 警告并询问用户是否继续

#### Scenario: worktree_dir 在仓库内且已忽略
- **WHEN** `worktree_dir` 在仓库根之内且已被忽略
- **THEN** `ignore` MUST 为 `{scope: "inside", ignored: true}`,creating-worktree MUST 静默继续
