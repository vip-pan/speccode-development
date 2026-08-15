# Design: 探测器列表 LightRAG → GitNexus

## Context

init 通过 `detectKnowledgeTools` 探测 5 类知识库工具(understand-anything / CodeGraph / Graphify / CodeMap / LightRAG),区分 available(可用)与 integrated(集成)两维度,仅双 true 才登记入 config 的 `knowledge_tools`。探测器表定义于 `lib/detect.mjs` 的 `KNOWLEDGE_TOOL_DETECTORS`。

## Goals

- 探测器表只保留「代码知识图谱」同类工具。
- 纳入 GitNexus,并给出正确的探测签名(bin / dirs)。

## Non-Goals

- 不改探测的 available/integrated 两维度模型。
- 不改 config 的 `knowledge_tools` 字段名(那是 config schema 破坏性变更,另评估)。
- 不改现有 config 的 `knowledge_tools` 值。

## Decisions

1. **移出 LightRAG**。理由:通用文档 RAG,非代码、非图谱,与其余四个工具不同类;GitHub 调研确认其定位是「任意文档的 RAG」,不是代码知识图谱。
2. **新增 gitnexus 条目** `{id:'gitnexus', match:'gitnexus', bin:'gitnexus', dirs:['.gitnexus']}`。理由:`bin` 名 `gitnexus` 独特,不会像 `understand` 那样误命中无关二进制;`dirs` 用 `.gitnexus/`(已查实 `gitnexus analyze` 生成该目录并自加 .gitignore);MCP server 名同为 `gitnexus`(`npx gitnexus setup` 写入),走 projectMcp 探针。
3. **被否备选**:保留 LightRAG(违背「代码知识图谱」归类);改字段名 `knowledge_tools` → `code_graph_tools`(属 config schema 破坏性变更,需 v2→v3 迁移,超出本改动范围)。

## Risks

- GitNexus 的 `.gitnexus/` 目录与 `gitnexus` bin 名基于 GitHub README/文档查实,本机未安装验证;实现时以 README 为准。
- 探测测试需同步更新,否则 `detect.test.mjs` 中 lightrag 用例会失败。

## Open Questions

- 无(探测签名已查实)。
