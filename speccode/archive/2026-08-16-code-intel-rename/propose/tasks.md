# code-intel-rename Tasks

> 实现步骤清单。下游 `writing-plans` 会基于本清单与本目录 proposal/design + brainstorm 细化为带 step 代码的 plan。

## 引擎层

- [x] Task 1: `detect.mjs`:`KNOWLEDGE_TOOL_DETECTORS` → `CODE_INTEL_TOOL_DETECTORS`;`detectKnowledgeTools` → `detectCodeIntelTools`;更新单测 `detect.test.mjs`(常量名/函数名)
- [x] Task 2: `bin/speccode.mjs` verb `detect-knowledge-tools` → `detect-code-intel-tools`(VERBS key + import + dispatch);`cli.test.mjs` 端到端测改名

## config 层

- [x] Task 3: config 字段 `knowledge_tools` → `code_intel_tools`(`init.md` 写入字段名;config 相关测试改字段名);`loadConfig`/`saveConfig` 无逻辑改(字段名随 init 写入)

## 命令层

- [x] Task 4: 6 命令 prose 改名(`exploring` / `proposing` / `brainstorming` / `distilling-knowledge` / `init` / `reset`):"知识库工具咨询" → "代码智能工具咨询";`knowledge_tools` 字段引用 → `code_intel_tools`;`detect-knowledge-tools` verb 调用 → `detect-code-intel-tools`

## 文档层

- [x] Task 5: `README.md` / `README_CN.md`(中英):字段集 + 探测描述同步(`knowledge_tools` → `code_intel_tools`,中英两版结构一一对应)
- [x] Task 6: `CLAUDE.md` Codemap MCP 段措辞同步(若提及 knowledge_tools / 知识库工具)

## spec 层 + syncing 扩展

- [x] Task 7: `commands/syncing.md` 加「capability RENAME 处理」段(合并前扫描 delta 顶部 `<!-- speccode:rename-from: <旧> -->` 元数据 → `git mv speccode/spec/<旧>/ <新>/`(新目录已存在则跳过,幂等)→ 继续常规合并);`cli.test.mjs` 文档断言 syncing.md 提 capability RENAME + rename-from 元数据
- [x] Task 8: spec capability 目录 RENAME `speccode/spec/knowledge-tool-integration/` → `code-intel-tool-integration/`:经 syncing(本功能 own 的 RENAME 机制)执行 git mv + 合并 delta;主规格内 Purpose / requirement 名 / 字段 scenario 改名

## 验证

- [x] Task 9: 全量测试 `node --test ./plugins/speccode/tests/*.test.mjs` 全绿;手动 `detect-code-intel-tools` verb 验证;`read-config` 确认新字段名 `code_intel_tools`;syncing 幂等(重跑无 diff)
