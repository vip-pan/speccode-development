# Tasks: knowledge-set

按依赖排序分组,组内可并行。

## 组 1:lib 纯函数 + 单测(TDD)

- [x] `lib/knowledge.mjs`:knowledgeRoot / listTopics / parsePromotedBlocks / replacePromotedBlocks / buildIndex / writeKnowledge(原子写复用 atomic.writeTextAtomic)
- [x] `tests/knowledge.test.mjs`:marker 解析、块替换字节级保留、buildIndex、listTopics 纯函数单测

## 组 2:CLI verbs + e2e

- [x] `bin/speccode.mjs` 新增 `read-knowledge`(--cwd,`--index` 或 `--topic <name>`)
- [x] `bin/speccode.mjs` 新增 `write-knowledge`(--cwd,`--rel <path>`,`--json-stdin`,mode: replace-promoted / append-hand / replace)
- [x] `tests/cli.test.mjs` 扩展:read-knowledge / write-knowledge e2e(真实临时仓库)

## 组 3:命令层

- [x] `commands/promote-knowledge.md`:读现状 → 读 spec/archive → 逐 topic 蒸馏 → 候选 diff → 闸门确认 → write-knowledge(replace-promoted)→ _index 更新 → 落盘即提交
- [x] `commands/memorize.md`:读现状 → 收集内容 → 草稿展示 → 闸门确认 → write-knowledge(append-hand/replace)→ _index 更新 → 落盘即提交

## 组 4:消费入口接入(9 命令)

- [x] exploring / proposing / brainstorming / writing-plans / executing-plans / subagent-driven-development / systematic-debugging / requesting-code-review / receiving-code-review 各加「知识库入口」段(统一模板:读索引 → 按需读 topic → 失败静默)

## 组 5:文档同步

- [x] 插件 README EN/CN + 根 README EN/CN:命令表 21→23、知识集能力描述(四版本结构一一对应)
- [x] 本仓库 CLAUDE.md:计数同步(12 lib→13、18 verb→20、21 命令→23)

## 组 6:全量验证

- [x] 全量测试 `node --test ./plugins/speccode/tests/*.test.mjs` 全绿
- [x] dogfood 走读:promote-knowledge / memorize 在本仓库实跑一次
