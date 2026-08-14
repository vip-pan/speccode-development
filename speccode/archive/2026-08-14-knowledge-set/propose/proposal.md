# Proposal: 知识集(knowledge-set)

## Why

speccode 有「系统应该是什么」(spec/)与「这个 feature 聊到哪」(memory/),但缺「我们知道了什么」——跨 feature 持久、可策展、被团队共享与版本化的领域知识与开发经验。本 feature 新增 tracked、可检索、按主题组织的知识集层:晋升命令从 spec/archive 蒸馏,直写命令供人/agent 直接写,SDD 认知型命令入口按需消费。

## What Changes

- 新增 tracked 层 `speccode/knowledge/`(与 spec/changes/archive 平级):`_index.md` 检索索引 + 9 个初始 topic 文件(业务方向:domain/workflows/lineage;开发方向:architecture/standards/environment/integrations/pitfalls/security)。
- 新增 `lib/knowledge.mjs` 纯函数:knowledgeRoot / listTopics / parsePromotedBlocks / replacePromotedBlocks / buildIndex / writeKnowledge。
- 新增 2 个 CLI verb:`read-knowledge`(读索引/读 topic)、`write-knowledge`(原子写,mode: replace-promoted / append-hand / replace,写走 `--json-stdin`)。
- 新增命令 `/speccode:promote-knowledge`:从 spec/archive 全量重蒸 promoted 段,经人工闸门落盘。
- 新增命令 `/speccode:memorize`:人/agent 直接写 hand-written 知识,经人工闸门落盘。
- 9 个认知型命令入口接入「知识库入口」段:读索引 → 按需读 topic → 失败静默兜底。
- 新增 `tests/knowledge.test.mjs`(lib 纯函数单测);扩展 `tests/cli.test.mjs`(2 个新 verb e2e)。
- 文档同步:根 README EN/CN + 插件 README EN/CN(命令表 21→23)、本仓库 CLAUDE.md 计数(12 lib→13、18 verb→20、21 命令→23)。

无 BREAKING 变更。设计定稿见 `../brainstorm/2026-08-14-knowledge-set-design.md`。

## Capabilities

- knowledge-set(新增 capability)

## Impact

- `plugins/speccode/lib/`(+1 模块 knowledge.mjs)、`plugins/speccode/bin/`(+2 verb)、`plugins/speccode/commands/`(+2 命令,9 命令入口修改)、`plugins/speccode/tests/`(+1 测试文件,cli.test.mjs 扩展)。
- `speccode/` 目录树:新增 `knowledge/` 子目录(运行时由命令创建骨架)。
- 文档:根 README 与插件 README 双语言版本、CLAUDE.md。
- 不影响:memory 机制、spec/syncing、14 个 hook 事件、config v2 结构。
