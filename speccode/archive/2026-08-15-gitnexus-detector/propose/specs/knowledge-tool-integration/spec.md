# knowledge-tool-integration — Spec Delta

## MODIFIED Requirements

### Requirement: 知识工具探测启发式

`/speccode:init` SHALL 通过四类探测识别代码知识库工具,并把每个工具的探测结果区分为**可用(available)**与**集成(integrated)**两个维度:

- available(可用):(a) `~/.claude/plugins/installed_plugins.json` 命中;(b) `command -v <bin>` 退出码为 0;(c) 任意 MCP 配置命中(项目 `.mcp.json` 或用户 `~/.claude.json` 的 `mcpServers`)。
- integrated(集成):(a) 项目 `.mcp.json` 的 `mcpServers` key 命中;(b) `~/.claude.json` 的 `projects[<cwd>].mcpServers` key 命中;(c) 项目配置目录存在(每个工具可探测多个候选目录,first-existing wins):understand-anything 为 `.ua` / `.understand-anything`,codegraph 为 `.codegraph`,graphify 为 `.graphify`,codemap 为 `.codemaker/codeindex` / `.codemaker/codemap`,gitnexus 为 `.gitnexus`。

内置探测表 MUST 至少覆盖 understand-anything、CodeGraph、Graphify、CodeMap、GitNexus。

#### Scenario: 插件目录命中
- **WHEN** `~/.claude/plugins/installed_plugins.json` 存在 understand-anything 插件,但项目内不存在 `.ua/`(或 `.understand-anything/`)且无项目级 MCP 配置
- **THEN** 探测结果 MUST 含 `{id: "understand-anything", available: {value: true, evidence: <插件注册表键, 如 understand-anything@understand-anything>}, integrated: {value: false, evidence: null}}`

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
- **WHEN** 执行 `detect-knowledge-tools`
- **THEN** 探测结果 MUST NOT 含 `id` 为 `lightrag` 的条目
