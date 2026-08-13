# knowledge-tool-integration — Delta

## MODIFIED Requirements

### Requirement: 知识工具探测启发式

`/speccode:init` SHALL 通过四类探测识别代码知识库工具,并把每个工具的探测结果区分为**可用(available)**与**集成(integrated)**两个维度:

- available(可用):(a) `~/.claude/plugins/installed_plugins.json` 命中;(b) `command -v <bin>` 退出码为 0;(c) 任意 MCP 配置命中(项目 `.mcp.json` 或用户 `~/.claude.json` 的 `mcpServers`)。
- integrated(集成):(a) 项目 `.mcp.json` 的 `mcpServers` key 命中;(b) `~/.claude.json` 的 `projects[<cwd>].mcpServers` key 命中;(c) 项目配置目录存在(每个工具可探测多个候选目录,first-existing wins):understand-anything 为 `.ua` / `.understand-anything`,codegraph 为 `.codegraph`,graphify 为 `.graphify`,codemap 为 `.codemaker/codeindex` / `.codemaker/codemap`,lightrag 为 `.lightrag`。

内置探测表 MUST 至少覆盖 understand-anything、CodeGraph、Graphify、CodeMap、LightRAG。

#### Scenario: 插件目录命中
- **WHEN** `~/.claude/plugins/installed_plugins.json` 存在 understand-anything 插件,但项目内不存在 `.ua/`(或 `.understand-anything/`)且无项目级 MCP 配置
- **THEN** 探测结果 MUST 含 `{id: "understand-anything", available: {value: true, evidence: <插件注册表键, 如 understand-anything@understand-anything>}, integrated: {value: false, evidence: null}}`

#### Scenario: CLI 命中
- **WHEN** `command -v codegraph` 退出码为 0
- **THEN** 探测结果 MUST 含 codegraph 条目,`available.value` MUST 为 `true`

#### Scenario: 项目配置目录命中
- **WHEN** 项目根存在 `.codemaker/codemap/` 目录
- **THEN** 探测结果 MUST 标记 codemap `integrated = true`,evidence 为该目录

#### Scenario: 项目级 MCP 命中
- **WHEN** 项目 `.mcp.json` 的 `mcpServers` 含某工具 key
- **THEN** 探测结果 MUST 标记该工具 `integrated = true` 且 `available = true`,evidence 为该 MCP key

### Requirement: detect-knowledge-tools verb

引擎 SHALL 暴露 `detect-knowledge-tools` verb,输出每个工具的两个维度:`{tools: [{id, available: {value, evidence?}, integrated: {value, evidence?}}]}`;探测涉及的 fs/spawn/readJson 依赖 MUST 全部支持依赖注入,保证单测不触碰真实环境。

#### Scenario: 输出结构

> RENAMED from `输出两维度结构`(同名替换主规格中旧的三字段 id/kind/evidence 版本)。

- **WHEN** 执行 `detect-knowledge-tools --cwd .`
- **THEN** 输出 MUST 为 `{ok: true, tools: [...]}`,每个工具条目 MUST 含 `id`、`available.value`、`integrated.value`(不再有 `kind` 字段)

### Requirement: knowledge_tools 配置字段

探测结果 SHALL 经用户逐项确认后写入 config 的 `knowledge_tools` 数组;**仅当某工具 `available` 与 `integrated` 同时为 true 时,该工具才可被登记**;available-only(可用但未集成)的工具 MUST NOT 写入 config。init 幂等流程 MUST 支持该字段的 `[旧值]→[新值]` diff 展示与逐字段确认;对 config 中已登记、但当前判定为 available-only 的工具,MUST 在 diff 中标记并提示移除(经用户确认)。

#### Scenario: available-only 不登记
- **WHEN** 探测到某工具 `available = true` 但 `integrated = false`
- **THEN** 命令 MUST 展示该工具为「可用但项目未集成」,且 MUST NOT 将其写入 config

#### Scenario: 两维度满足才登记
- **WHEN** 探测到某工具 `available = true` 且 `integrated = true`
- **THEN** 命令 MUST 经用户确认后才可将其写入 config

#### Scenario: 幂等补救 available-only 既有项
- **WHEN** 二次 init 时 config 已有某工具,但其当前判定为 `integrated = false`
- **THEN** 命令 MUST 在 diff 中标记该工具为「建议移除」,经用户确认后移除
