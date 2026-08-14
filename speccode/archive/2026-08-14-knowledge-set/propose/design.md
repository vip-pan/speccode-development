# Design: knowledge-set

## Context

speccode 现有 spec/(tracked,「系统应该是什么」)与 memory/(untracked 暂态)两层,缺第三层「我们知道了什么」。exploring 结论(见 feature 记忆)已定总体方向;本设计精化四个未定点(范围、晋升机制、直写形态、接入面)并定稿,完整设计见 `../brainstorm/2026-08-14-knowledge-set-design.md`。

## Goals

- tracked 的 `speccode/knowledge/` 层:9 个初始 topic 文件 + `_index.md` 检索索引。
- `/speccode:promote-knowledge`:从 spec/archive 全量重蒸 promoted 段,经人工闸门落盘。
- `/speccode:memorize`:人/agent 直接写 hand-written 知识,经人工闸门落盘。
- 9 个认知型命令入口:读索引 → 按需读 topic,失败静默兜底。

## Non-Goals

- T1 recall verb、T2 语义检索(演进路线,不在本 feature)。
- hook 事件扩展(14 个事件名不动)。
- memory 机制改动(迁 feature 是单独一条线)。
- Roadmap 入知识集。
- knowledge/ 反向写 spec/。

## Decisions

### D1 范围 = T0 完整闭环

**选定 A**:knowledge/ 层 + 晋升命令 + 直写命令 + SDD 入口接入。
**被否**:B(A + T1 recall verb);C(更瘦,直写与接入留后续——直写是核心决策,砍掉则不闭环)。

### D2 晋升 = 全量重建 + 来源标记

**选定 A**:promoted 段每次从 spec/archive 全量重蒸重写(幂等、无游标、无合并腐烂);hand-written 段保留不动。
**被否**:B(增量合并 + git 派生游标——复杂度高、合并腐烂风险,知识集小、晋升低频,全量代价可忽略);C(纯全量重建——与直写冲突)。
**推论**:exploring 决策 7(增量游标 = git 派生)被吸收废弃。

### D3 直写 = 独立 memorize 命令

**选定 A**:新建 `/speccode:memorize`,职责单一,走「草稿 → 用户确认 → 原子写」闸门。
**被否**:B(复用晋升命令入口——触发时机、输入、闸门展示都不同);C(无命令直写——绕过闸门)。

### D4 接入面 = 认知型命令全接

**选定 A**:exploring / proposing / brainstorming / writing-plans / executing-plans / subagent-driven-development / systematic-debugging / requesting-code-review / receiving-code-review 共 9 个。
**被否**:B(仅核心 3 个——面太窄);C(全部 21 个——流程管理型命令不需要知识)。

### D5 来源标记 = 段落级 marker

**选定 B**:`<!-- promoted-from: <source> -->` … `<!-- /promoted -->` 围住蒸馏块;文件默认 hand-written,晋升只重写块内,块外字节级保留。
**被否**:A(文件头 frontmatter——YAML 解析违背零依赖、单文件混两种来源不行);C(分文件——同主题知识被劈两处)。

### D6 蒸馏是 LLM 判断,lib 只做确定性部分

lib/knowledge.mjs 只承担 marker 解析、块替换、索引生成、原子写;蒸馏由命令层(prose)做。

### D7 闸门 = 会话内确认(MVP)

候选先展示、用户确认才写 tracked 层(防蒸馏失真 + 防不该进 PR 的内容);落盘草稿区作为可选演进,本 feature 不做。

## Risks

| 风险 | 缓解 |
|---|---|
| 蒸馏失真 | 闸门:候选 diff 经人确认才落盘 |
| 晋升覆盖手写内容 | 来源标记:只重写 promoted 块,块外字节级保留(测试覆盖) |
| 知识集膨胀、_index 失修 | 命令出口更新 _index;promote/memorize 时重建校验 |
| 入口 prose 重复 9 处漂移 | 接入段统一模板,集中在入口小节 |
| marker 被手编破坏 | parsePromotedBlocks 单测钉死格式;解析失败显式报错 |

## Open Questions

- 无。
