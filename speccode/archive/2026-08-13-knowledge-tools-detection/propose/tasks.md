# Tasks: knowledge_tools 检测两维度化

## 1. 引擎层 detect.mjs

- [x] 把 `detectKnowledgeTools` 从单维度短路改为两维度独立探测:每个工具返回 `{id, machine: {available, evidence}, project: {integrated, evidence}}`
- [x] 实现维度归类:plugin / cli / 用户级 mcp → machine;项目 .mcp.json / `projects[cwd].mcpServers` / 项目 dir → project
- [x] 保留 `KNOWLEDGE_TOOL_DETECTORS` 五工具覆盖,补齐各工具的 project 级 dir 映射

## 2. verb 与命令

- [x] `detect-knowledge-tools` verb 输出改为两维度结构(保持 `{ok, tools}` 外层)
- [x] `/speccode:init`(init.md):登记判据改为 available ∧ integrated;available-only(可用但未集成)展示为「本机可用但项目未集成」且不登记;幂等 diff 标记 available-only 既有项为「建议移除」

## 3. 测试

- [x] 更新 detect 单测:覆盖「本机命中但项目未集成」「项目 dir 命中」「项目 .mcp.json 命中」「两维度都满足」「machine-only 不登记」等 scenario
- [x] 更新 cli.test.mjs 的 detect-knowledge-tools 端到端用例(依赖注入)

## 4. 文档

- [x] 经 `/speccode:syncing` 把本 delta 合并进 `speccode/spec/knowledge-tool-integration/spec.md`
- [x] 经 `/speccode:archiving` 归档本变更
