# Proposal: knowledge-set-refocus

## Why

knowledge-set 的 9-topic 骨架超出了 speccode 作为 SDD 工具的职责:业务知识(business/*)在 dogfood 中从建骨架起全空(9 topic 仅 pitfalls 有 4 行内容),业务方向应由完整 RAG 系统维护,speccode 只需保留读侧接入能力。知识集应收窄为「SDD 开发过程知识」的策展层。

## What Changes

- 骨架 9→6:初始 topic 只留 `development/{architecture, standards, environment, integrations, pitfalls, security}`,`business/*` 退役(**BREAKING**:新项目不再初始化 business topic)
- `promote-knowledge` 蒸馏范围收窄为过程知识,并引入**通用日落**:蒸馏目标 = 骨架 6 topic ∪ `development/` 下用户自建 topic;其余既有 topic 的 promoted 块在闸门内建议移除(hand-written 段字节级保留)
- `memorize` 增加**适配闸门**:写入前先做归类陈述(过程知识 → 落 topic / 业务知识 → 建议进 RAG);用户坚持写入时允许指定或新建 topic,不硬拦
- `_index.md` 由「实扫 topic 按顶层目录分组」生成,不再硬编码「业务方向/开发方向」两段式
- pitfalls 吸收 review 能力:评审中反复出现的问题模式与团队评审共识记入 pitfalls,不单列 review topic
- RAG 接入暂缓,仅记录为未来方向(成熟系统只读适配 / 自建 RAG 对话式登记,均兼容 knowledge_tools 模型)

## Capabilities

- 修改:`knowledge-set`

## Impact

- 命令层:`plugins/speccode/commands/memorize.md`、`plugins/speccode/commands/promote-knowledge.md`(骨架清单、蒸馏范围、闸门、索引分组)
- 规格:`speccode/spec/knowledge-set/spec.md`(经 syncing 合入)
- 测试:`plugins/speccode/tests/knowledge.test.mjs`、`plugins/speccode/tests/cli.test.mjs`(business/ 引用)
- 文档:`plugins/speccode/README.md` / `README_CN.md`(topic 清单与闸门描述,中英同步)
- 引擎 lib:零改动(listTopics/buildIndex 本就 topic 无关)
- 9 个 SDD 消费命令:零改动(读索引→按需读 topic,索引瘦则读瘦)
