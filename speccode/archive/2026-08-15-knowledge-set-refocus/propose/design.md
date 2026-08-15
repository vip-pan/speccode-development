# Design: knowledge-set-refocus

## Context

speccode 的知识架构已有两条车道:**写侧** knowledge-set(tracked、`speccode/knowledge/`、promote/memorize 双入口、人工闸门)与**读侧** knowledge-tool-integration(codemap/understand-anything 等外部工具探测登记、advisory 咨询、静默回退)。本次收口是把这条已存在的分界沿「业务 vs 开发过程」轴磨利:knowledge-set 退回到「SDD 过程知识策展者」,业务知识交由外部 RAG(未来经读侧车道接入)。

关键事实:lib 层本就 topic 无关——`listTopics` 扫目录实查、`buildIndex` 接受任意 sections;9-topic 骨架与两段式索引只硬编码在 memorize/promote-knowledge 两个命令 markdown 与 spec 中。dogfood 证据:本仓 `speccode/knowledge/` 9 个 topic 中 business/* 与 5 个 development 文件全空,仅 pitfalls 有内容。

## Goals

- 骨架收窄为 6 个 development topic,知识集只策展 SDD 过程知识
- 存量项目的 business/*(及任何不在蒸馏目标的 topic)经既有闸门机制日落,零迁移代码
- memorize 写入前增加适配判断,保持「agent 提议、人裁决」哲学

## Non-Goals

- RAG 系统的接入实现(仅记录方向:成熟系统只读适配 / 自建 RAG 对话式配置登记;兼容 knowledge_tools「登记→咨询→静默回退」模型,是未来加法)
- 引擎 lib 的任何改动
- 9 个 SDD 消费命令的改动
- 删除任何存量项目的 hand-written 内容

## Decisions

1. **business/* 退场用「收窄骨架 + 闸门日落」**(A1+日落),而非保留指针(A2)或纯软退役(A3)。A2 在 RAG 未落地前是空指向;A3 边界长期模糊;闸门日落复用 promote 已有的「展示→人工裁决」交互,hand-written 段字节保留不变量不被破坏。
2. **日落规则通用化**:蒸馏目标 = 骨架 6 topic ∪ `development/` 下用户自建 topic,其余既有 topic 的 promoted 块一律在闸门内建议移除;而非仅对 business/* 特设。后者把「business」字样留在命令里,未来 topic 再收窄时规则失效。
3. **memorize 适配闸门不硬拦**:判定为业务知识时给出「建议进 RAG」陈述,用户坚持则允许指定/新建 topic 写入(复用现有新建 topic 机制)。硬拒绝会在「架构 vs 业务」灰色地带误伤;与 promote 的「候选 diff → 人工确认」同一哲学。
4. **review 并入 pitfalls**,不单列 topic:dogfood 证明宽骨架闲置率高,pitfalls 语义扩展为「踩坑 + 评审反复问题模式与团队评审共识」,减少 memorize 时的分类纠结。
5. **索引实扫分组**:`_index.md` sections 由 listTopics 实扫结果按顶层目录名分组生成,不再硬编码「业务方向/开发方向」。lib 零改动;旧项目 business 文件被闸门清空后索引条目自然消失,索引永远反映真实盘面。

## Risks

- **存量项目 business 内容被误删** → promoted 块移除必须经闸门人工确认;hand-written 段字节级保留,绝不自动动。
- **命令 markdown 与 spec 描述漂移** → 本 change 同步更新两处命令 + spec delta,经 syncing 合入主规格。
- ~~测试硬编码 9-topic 骨架~~(已证伪:实测两测试文件中 business/ 仅为合法 fixture,lib topic 无关,零改动;全量测试 183/183 绿兜底)。

## Open Questions

- RAG 接入的具体形态(已知系统适配清单、自建 RAG 的 config  schema)——待未来单独立项。
