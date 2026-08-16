# code-intel-rename Proposal

## Why

config 字段 `knowledge_tools`(代码索引/图谱 MCP 工具:codemap / understand-anything / codegraph / graphify / gitnexus)占了 `knowledge` 词根,但本质是代码结构理解工具(code intelligence:索引 `search_code` + 图谱 `find_symbol` / `get_call_chain` / `get_type_hierarchy` / `get_dependencies` / `query_cypher`),不是知识库。真正的知识库是 SDD 知识集 `knowledge`(`speccode/knowledge/`、`knowledge.mjs`、`recording-knowledge` / `distilling-knowledge`、`read-knowledge` / `write-knowledge`、`knowledge-set` capability)。两者在命令 prose / CLAUDE.md 里都叫"知识..."混淆。改名让 `knowledge` 词根回归知识集。

## What Changes

- **config 字段**:`knowledge_tools` → `code_intel_tools`
- **`detect.mjs`**:`KNOWLEDGE_TOOL_DETECTORS` → `CODE_INTEL_TOOL_DETECTORS`;`detectKnowledgeTools` → `detectCodeIntelTools`(detector 表内容不变,只是常量/函数名)
- **`bin/speccode.mjs` verb**:`detect-knowledge-tools` → `detect-code-intel-tools`
- **命令 prose**(`exploring` / `proposing` / `brainstorming` / `distilling-knowledge` / `init` / `reset`):"知识库工具咨询" → "代码智能工具咨询";config 字段引用改
- **`README.md` / `README_CN.md`**(中英):字段集 + 探测描述同步
- **spec capability 目录 RENAME**:`speccode/spec/knowledge-tool-integration/` → `code-intel-tool-integration/`(Purpose / requirement 名 / 字段 scenario 全改)
- **`CLAUDE.md`**:Codemap MCP 段措辞同步
- **tests**:`detect.test.mjs` + config 测试改字段名 / 函数名 / verb

## Capabilities

- `code-intel-tool-integration`(从 `knowledge-tool-integration` RENAME;字段 `knowledge_tools`→`code_intel_tools`,verb `detect-knowledge-tools`→`detect-code-intel-tools`,Purpose / requirement 名 / 措辞改)
- `sdd-document-lifecycle`(MODIFIED:exploring requirement 中的 `config.knowledge_tools` 引用与「知识库工具」措辞随迁)
- `speccode-config-management`(MODIFIED:config 字段集中 `knowledge_tools` → `code_intel_tools`)
- (`knowledge-set` 不动 —— 知识集保留 `knowledge` 词根)

## Impact

- 代码:config schema + `detect.mjs` + `bin/speccode.mjs` + 6 命令 + README 中英 + CLAUDE.md + tests
- spec:`speccode/spec/knowledge-tool-integration/` → `code-intel-tool-integration/`(RENAME)
- **BREAKING**:config 字段改名,不兼容历史;用户改完重新 `/speccode:init` 重新探测写入
