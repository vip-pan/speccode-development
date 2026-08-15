# knowledge-set Delta: knowledge-command-rename

(应用顺序:先应用 RENAMED,再应用下方 MODIFIED。)

## RENAMED Requirements

- FROM: `### Requirement: 晋升命令` TO: `### Requirement: 蒸馏命令`
- FROM: `### Requirement: 直写命令` TO: `### Requirement: 记录命令`

## MODIFIED Requirements

### Requirement: 知识集目录结构

speccode MUST 支持 tracked 知识集目录 `speccode/knowledge/`,包含 `_index.md` 检索索引与按主题组织的 topic 文件(初始骨架:development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md),topic 清单可演进(用户可经 recording-knowledge 在 `development/` 下新建 topic)。知识集 MUST 只策展 SDD 开发过程知识;业务知识 MUST NOT 进入初始骨架,由外部 RAG 系统维护。

`_index.md` MUST 由实扫现有 topic 文件(跳过内容为空的 topic 文件)按顶层目录名分组生成,不得硬编码固定 section 清单。

#### Scenario: 新项目无知识集

- WHEN 项目尚无 `speccode/knowledge/` 目录
- THEN 消费入口静默跳过;distilling-knowledge 或 recording-knowledge 首次运行时创建骨架(目录 + `_index.md` + 6 个初始 development topic 空文件),MUST NOT 创建 business/ 目录

#### Scenario: 索引缺失但 topic 文件存在

- WHEN `_index.md` 缺失但 topic 文件存在
- THEN distilling-knowledge 或 recording-knowledge 运行时用 buildIndex 重建 `_index.md`,sections 按实扫结果的顶层目录名分组

#### Scenario: 存量 business topic 自然消失

- WHEN 存量项目的 business/*(或任何蒸馏目标外 topic)的蒸馏块经日落闸门移除,且文件无 hand-written 内容残留(文件为空)
- THEN 下次重建 `_index.md` 时该空 topic 文件 MUST 不被收录(实扫跳过空文件),条目自然消失;文件本身留在盘上,由用户自行处置

### Requirement: 来源标记

知识文件 MUST 支持段落级来源标记:以 `<!-- distilled-from: <source> -->` 开始、`<!-- /distilled -->` 结束的蒸馏块,块外内容为 hand-written。蒸馏只重写蒸馏块,hand-written 内容字节级保留。

写侧 MUST 只产出新格式 marker;读侧 MUST 同时解析新格式与旧格式 `<!-- promoted-from: <source> -->` … `<!-- /promoted -->`,两者视为同一蒸馏块列表;同一文件新旧格式混排时 MUST 按出现顺序统一解析。

#### Scenario: 蒸馏保留手写内容

- WHEN 某 topic 文件同时含蒸馏块与 hand-written 段
- THEN 蒸馏重蒸后 hand-written 段与原内容逐字节一致

#### Scenario: 旧格式 marker 兼容

- WHEN topic 文件含旧格式 `<!-- promoted-from: <source> -->` … `<!-- /promoted -->` 蒸馏块
- THEN 读侧正常解析为蒸馏块(与手写段区分不变);下次蒸馏写入时该块以新格式重写

#### Scenario: 标记格式损坏

- WHEN 蒸馏块 marker 解析失败(格式损坏)
- THEN 报错退出并提示人工检查,不静默、不猜测

### Requirement: 蒸馏命令

`/speccode:distilling-knowledge` MUST 从 `speccode/spec/` 与 `speccode/archive/` 全量重蒸各 topic 的蒸馏块,产出候选 diff 展示给用户,经用户确认后才写 tracked 层(人工闸门);蒸馏结果与现状无差异时幂等跳过写。

蒸馏目标 MUST 为:初始骨架 6 个 development topic ∪ `development/` 下用户自建 topic;蒸馏内容 MUST 限于 SDD 开发过程知识(架构、准则、环境、对接、坑与评审共识、安全)。蒸馏目标之外既存的 topic 文件,其蒸馏块 MUST 在闸门内逐块建议移除(日落),经用户确认后删除;其 hand-written 段 MUST 字节级保留,绝不自动修改。

#### Scenario: 蒸馏无变化

- WHEN 蒸馏结果与现状无差异
- THEN 跳过写入并报告「无变化」

#### Scenario: 来源已消失

- WHEN 蒸馏块 source 指向的 archive 已不存在
- THEN 该块标记为 stale,在闸门内展示给用户处置(删除块或改 source)

#### Scenario: 日落移除范围外 topic 的蒸馏块

- WHEN 存量项目存在蒸馏目标外的 topic 文件(如 business/domain.md)且含蒸馏块
- THEN 蒸馏闸门 MUST 展示「建议移除(该 topic 不在蒸馏目标内;若属业务知识,建议归外部 RAG)」选项;用户确认后块删除,同文件 hand-written 段与原内容逐字节一致;用户拒绝则块保留

#### Scenario: 首次重蒸迁移旧 marker

- WHEN 存量 topic 文件的蒸馏块使用旧格式 `promoted-from`/`/promoted` marker
- THEN 经闸门确认写入后,全部蒸馏块以新格式 `distilled-from`/`/distilled` 重写,hand-written 段与原内容逐字节一致

### Requirement: 记录命令

`/speccode:recording-knowledge` MUST 允许用户或 agent 直接写主题的 hand-written 知识。写入前 MUST 先经适配闸门:对内容做归类陈述(属于 SDD 过程知识 → 建议落入的 topic;属于业务知识 → 建议进外部 RAG 而非知识集),并展示草稿(写入位置 + 内容),经用户确认后才经 write-knowledge verb 原子写落盘。用户在被建议进 RAG 后仍坚持写入时,MUST 允许其指定既有 topic 或新建 topic(新建落在 `development/` 下,文件名小写连字符,`.md` 结尾),不得硬拦。

评审中反复出现的问题模式与团队评审共识 SHOULD 记入 development/pitfalls.md(坑与评审共识),不单列 review topic。

#### Scenario: 记录过程知识

- WHEN 用户提供的过程知识内容并确认草稿
- THEN 内容写入对应 topic 文件的 hand-written 段,并更新 `_index.md`(新 topic、摘要变化或索引缺失时)

#### Scenario: 业务知识经闸门建议后坚持写入

- WHEN 内容被闸门判定为业务知识并建议进 RAG,用户仍坚持写入并指定 topic
- THEN 内容 MUST 写入用户指定的 topic(不存在则在 `development/` 下新建),闸门陈述不阻断写入
