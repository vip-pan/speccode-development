# sdd-document-lifecycle Delta

> 本 delta 只修正 `knowledge_tools` → `code_intel_tools` 的字段引用与「知识库工具」→「代码智能工具」的措辞,不改变任何行为契约。requirement 标题与正文与主规格逐字对齐后改名。

## MODIFIED Requirements

### Requirement: exploring 纯探索命令

`/speccode:exploring` SHALL 在 trunk 上运行,对需求进行学习/探索/提问澄清;MUST NOT 写任何文档文件(产出仅存在于会话上下文;「文档文件」指 `speccode/` 下的需求文档,`.speccode/memory/` 运行时记忆不在此列,按 session-memory 规则承接);项目中配置了代码智能工具(config.code_intel_tools)且其在会话中可用时 MUST 优先用其探索代码,不可用时 MUST 回退到 Grep/Glob/Read;完成后 MUST 引导用户衔接 `/speccode:creating-feature` 与 `/speccode:creating-worktree`(手动模式询问,auto 模式自动执行)。

#### Scenario: 代码智能工具优先与回退

> RENAMED from `知识库工具优先与回退`(同名替换主规格中旧的 `config.knowledge_tools` 版本,MUST NOT 与旧标题并存)。

- **WHEN** `config.code_intel_tools` 含 understand-anything 且其能力在会话中可用
- **THEN** 探索代码时 MUST 优先使用该工具;若不可用,MUST 回退到 Grep/Glob/Read 且不报错
