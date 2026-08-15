# Proposal: 探测器列表移出 LightRAG、新增 GitNexus

## Why

`KNOWLEDGE_TOOL_DETECTORS` 现有 5 个知识库工具中,LightRAG 是通用文档 RAG(非代码、非图谱),与其余四个「代码知识图谱」工具(codemap / understand-anything / CodeGraph / Graphify)不同类,是分类噪声。GitNexus 是零服务端的代码知识图谱引擎(tree-sitter 解析 → KuzuDB 图库 + MCP),与现有探测器同类,应纳入探测表。

## What Changes

- 探测表移出 `lightrag` 条目(`{id:'lightrag', bin:'lightrag', dirs:['.lightrag']}`)。
- 新增 `gitnexus` 条目:`{id:'gitnexus', match:'gitnexus', bin:'gitnexus', dirs:['.gitnexus']}`。
- 更新测试 `tests/detect.test.mjs`:lightrag 探测测试 → gitnexus 探测测试。
- 更新 `README.md` / `README_CN.md` §9 的「五类工具」列表(中英同步)。
- 不触碰现有 config 的 `knowledge_tools` 值(下次 `/speccode:init` 重新探测才生效)。

## Capabilities

- `knowledge-tool-integration`

## Impact

- `plugins/speccode/lib/detect.mjs`(KNOWLEDGE_TOOL_DETECTORS 表)
- `plugins/speccode/tests/detect.test.mjs`(探测测试)
- `plugins/speccode/README.md` / `plugins/speccode/README_CN.md` §9(工具清单文档)
