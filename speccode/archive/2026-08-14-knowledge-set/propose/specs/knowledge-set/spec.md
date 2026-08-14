## Purpose

知识集层:tracked、可检索、按主题组织的项目知识库,落 `speccode/knowledge/`(与 spec/changes/archive 平级)。由晋升命令(从 spec/archive 蒸馏 promoted 段)与直写命令(memorize 写 hand-written 段)写入,均经人工闸门;SDD 认知型命令入口读 `_index.md` 索引并按需读 topic 文件,失败静默兜底。

## ADDED Requirements

### Requirement: 知识集目录结构

speccode MUST 支持 tracked 知识集目录 `speccode/knowledge/`,包含 `_index.md` 检索索引与按主题组织的 topic 文件(初始清单:business/domain.md、business/workflows.md、business/lineage.md、development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md),topic 清单可演进。

#### Scenario: 新项目无知识集

- WHEN 项目尚无 `speccode/knowledge/` 目录
- THEN 消费入口静默跳过;promote-knowledge 或 memorize 首次运行时创建骨架(目录 + `_index.md` + 初始 topic 空文件)

#### Scenario: 索引缺失但 topic 文件存在

- WHEN `_index.md` 缺失但 topic 文件存在
- THEN promote-knowledge 或 memorize 运行时用 buildIndex 重建 `_index.md`

### Requirement: 来源标记

知识文件 MUST 支持段落级来源标记:以 `<!-- promoted-from: <source> -->` 开始、`<!-- /promoted -->` 结束的蒸馏块,块外内容为 hand-written。晋升只重写 promoted 块,hand-written 内容字节级保留。

#### Scenario: 晋升保留手写内容

- WHEN 某 topic 文件同时含 promoted 块与 hand-written 段
- THEN 晋升重蒸后 hand-written 段与原内容逐字节一致

#### Scenario: 标记格式损坏

- WHEN promoted 块 marker 解析失败(格式损坏)
- THEN 报错退出并提示人工检查,不静默、不猜测

### Requirement: 晋升命令

`/speccode:promote-knowledge` MUST 从 `speccode/spec/` 与 `speccode/archive/` 全量重蒸各 topic 的 promoted 块,产出候选 diff 展示给用户,经用户确认后才写 tracked 层(人工闸门);蒸馏结果与现状无差异时幂等跳过写。

#### Scenario: 晋升无变化

- WHEN 蒸馏结果与现状无差异
- THEN 跳过写入并报告「无变化」

#### Scenario: 来源已消失

- WHEN promoted 块 source 指向的 archive 已不存在
- THEN 该块标记为 stale,在闸门内展示给用户处置(删除块或改 source)

### Requirement: 直写命令

`/speccode:memorize` MUST 允许用户或 agent 直接写任意主题的 hand-written 知识:先展示草稿(写入位置 + 内容),经用户确认后经 write-knowledge verb 原子写落盘。

#### Scenario: 直写新知识

- WHEN 用户提供新知识内容并确认草稿
- THEN 内容写入对应 topic 文件的 hand-written 段,并更新 `_index.md`(新 topic 或摘要变化时)

### Requirement: 消费入口

SDD 认知型命令(exploring / proposing / brainstorming / writing-plans / executing-plans / subagent-driven-development / systematic-debugging / requesting-code-review / receiving-code-review)入口 MUST 读 `_index.md` 索引并按需读相关 topic 文件;`knowledge/` 不存在或读取失败时静默跳过,绝不阻断主流程。

#### Scenario: 知识集缺失不阻断

- WHEN 项目无 `knowledge/` 目录或读取失败
- THEN 命令正常继续,不输出错误、不中断
