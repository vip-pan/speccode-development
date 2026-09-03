# knowledge-set delta: knowledge-compact

## MODIFIED Requirements

### Requirement: 来源标记

知识文件 MUST 支持段落级来源标记:以 `<!-- distilled-from: cap/<slug> -->` 开始、`<!-- /distilled -->` 结束的蒸馏块,块外内容为 hand-written。`<slug>` 为能力键,MUST 匹配 `^[a-z0-9-]+$`;同一文件内能力键 MUST 唯一,写入侧检测到重复 MUST 报错拒绝(不得静默丢块)。块的出处(archive 归档包名 / spec capability 目录名)MUST 以纯文本记录在块 body 内,不参与身份与解析。

蒸馏块身份 = 能力键,写入语义为 upsert:同能力键的新块覆盖旧块,能力的演进以覆盖表达、不累积;知识退役即删,MUST NOT 留墓碑块(历史叙事归 archive/ 与 CHANGELOG)。

布局规范:hand-written 段在前、蒸馏块在后。replace-distilled 与 replace-hand 写入 MUST 输出该规范布局——存量文件首次写入时归位(hand-written 字节级保留、仅位置重排),此后幂等。蒸馏写入路径 MUST 仅重写蒸馏块,hand-written 内容字节级保留。

读侧 MUST 同时解析现行格式与旧格式 `<!-- promoted-from: <source> -->` … `<!-- /promoted -->`,以及 distilled-from 值为旧来源值(`archive/<名>/`、`spec/<名>/`)的存量块,三者视为同一蒸馏块列表,按出现顺序统一解析;写侧 MUST 只接受能力键格式(存量旧 source 块的迁移见「蒸馏命令」)。marker 解析失败 MUST 报错退出并提示人工检查,不静默、不猜测。

#### Scenario: 蒸馏保留手写内容

- WHEN 某 topic 文件同时含蒸馏块与 hand-written 段
- THEN 蒸馏重蒸后 hand-written 段与原内容逐字节一致(位置按布局规范归位)

#### Scenario: 旧格式 marker 兼容

- WHEN topic 文件含旧格式 `<!-- promoted-from: <source> -->` … `<!-- /promoted -->` 蒸馏块,或 distilled-from 值为 `archive/<名>/` 的存量块
- THEN 读侧正常解析为蒸馏块(与手写段区分不变);经闸门映射后以能力键格式重写

#### Scenario: 标记格式损坏

- WHEN 蒸馏块 marker 解析失败(格式损坏)
- THEN 报错退出并提示人工检查,不静默、不猜测

#### Scenario: 能力键校验拒写

- WHEN 写入蒸馏块的 source 不匹配 `cap/<slug>` 格式,或同一文件内出现重复能力键
- THEN 写入前报错拒绝,不产生部分写入

#### Scenario: 首跑归位布局

- WHEN 存量 topic 文件的 hand-written 段位于蒸馏块之后,经 replace-distilled 或 replace-hand 写入
- THEN hand-written 段内容字节级不变、移至文件头部,蒸馏块依序随后;再次写入布局不变(幂等)

### Requirement: 蒸馏命令

`/speccode:distilling-knowledge` MUST 从 `speccode/spec/` 全量读、从 `speccode/archive/` **增量读**(只读尚未消费的归档包,纯读成本控制)以重蒸各 topic 的蒸馏块,产出候选 diff 展示给用户,经用户确认后才写 tracked 层(人工闸门);蒸馏结果与现状无差异时幂等跳过写。

**新鲜度审查(每次运行)**:distilling MUST 对全部蒸馏目标 topic 的全部既有蒸馏块做新鲜度审查,真值锚 = `speccode/spec/` 主规格;审查结论(块内容仍真 / 过时应改写 / 被取代应删除或合并)由 distiller 提议、闸门确认。删除或合并既有块 MUST 附理由。闸门 diff MUST 只展示变化块(新增 / 改写 / 删除),无变化块不进入展示。carry-forward、stale-by-source、superseded-by-package 机制退役:块的存废 MUST NOT 由「source 归档包是否仍在盘上 / 是否被新归档包取代 / 是否已消费」决定;同能力键重蒸产出新内容即 upsert 覆盖。

蒸馏目标 MUST 为:初始骨架 6 个 development topic ∪ `development/` 下用户自建 topic;蒸馏内容 MUST 限于 SDD 开发过程知识(架构、准则、环境、对接、坑与评审共识、安全)。变更元数据不属于蒸馏对象:归档包内文档的 frontmatter 字段(如 proposal.md 的 `tier:`)MUST NOT 单独成块,MUST NOT 混入正文蒸馏块,SHALL 仅作为理解变更体量与权重的参考上下文。蒸馏目标之外既存的 topic 文件,其蒸馏块 MUST 在闸门内逐块建议移除(日落),经用户确认后删除;其 hand-written 段 MUST 字节级保留,绝不自动修改。

**存量迁移(零工具)**:旧 source 值(`archive/<名>/`、`spec/<名>/`)的既有蒸馏块解析照常进入候选;首次运行时 distiller MUST 为每个旧块提议能力键映射(优先对齐既有 spec capability 目录名,无对应者用稳定 kebab 主题词),闸门逐块确认后以能力键格式重写;MUST NOT 提供专用迁移脚本。

蒸馏成功落盘后 MUST 把本次读过的归档包(含读了无产出的)追记进 `consumed_archives`(去重)。`_distilled.meta.json` 缺失时 MUST 做一次性全量读 archive,并用全部现有归档包种子 `consumed_archives` 创建该 sidecar;删除 sidecar 重跑仍是强制全量重读的官方逃生口,不另设 `--full` flag。

#### Scenario: 蒸馏无变化

- WHEN 新鲜度审查与重蒸结果与现状无差异
- THEN 跳过写入并报告「无变化」

#### Scenario: 增量只读未消费包

- WHEN `consumed_archives` 含包 A,归档目录新增包 B
- THEN 本次蒸馏只读包 B,包 A 整包跳过(读成本控制);包 A 既有蒸馏块仍进入新鲜度审查,不被误删、不因跳过读取而免审

#### Scenario: 首次增量引导

- WHEN `_distilled.meta.json` 不存在
- THEN 本次蒸馏做一次性全量读 archive,落盘后用全部现有归档包种子 `consumed_archives` 创建该 sidecar

#### Scenario: 删 sidecar 强制全量重读

- WHEN 用户删除 `_distilled.meta.json` 再跑 distilling-knowledge
- THEN 全部归档包变未消费 → 全量重读 + 重种子;既有块的新鲜度审查与存量映射照常进行(重蒸本就每次全量)

#### Scenario: 退役知识删除附理由

- WHEN 新鲜度审查判定某既有块内容过时或被取代
- THEN 闸门展示删除/改写建议并附理由(面向知识真值,不区分来源包存废),用户确认后处置;不留墓碑块

#### Scenario: frontmatter 元数据不蒸馏

- WHEN 蒸馏读取的归档包 proposal.md 含 frontmatter `tier:` 字段
- THEN 该字段 MUST NOT 成为独立蒸馏块,MUST NOT 混入正文蒸馏块;仅可作为 distiller 理解变更体量的参考上下文

#### Scenario: 日落移除范围外 topic 的蒸馏块

- WHEN 存量项目存在蒸馏目标外的 topic 文件(如 business/domain.md)且含蒸馏块
- THEN 蒸馏闸门 MUST 展示「建议移除(该 topic 不在蒸馏目标内;若属业务知识,建议归外部 RAG)」选项;用户确认后块删除,同文件 hand-written 段与原内容逐字节一致;用户拒绝则块保留

#### Scenario: 首次重蒸迁移旧 marker

- WHEN 存量 topic 文件的蒸馏块使用旧格式 `promoted-from`/`/promoted` marker 或旧 source 值
- THEN 经闸门确认写入后,全部蒸馏块以能力键格式重写,hand-written 段与原内容逐字节一致

#### Scenario: 存量块映射能力键

- WHEN 首次新规则运行,既有蒸馏块 source 为 `archive/<名>/` 或 `spec/<名>/`
- THEN distiller 为每块提议能力键(优先对齐既有 spec capability 目录名),闸门逐块确认(提供「全部确认」);未经映射的旧 source 块无法经写侧校验直写

### Requirement: 蒸馏消费追踪

speccode MUST 维护 `speccode/knowledge/_distilled.meta.json`(knowledge/ 内 tracked sidecar,与 topic 文件平级),记录蒸馏已消费的归档包。其职责 MUST 限于读成本控制:distilling-knowledge 增量读判定(未消费集 = `speccode/archive/` 下实扫归档目录 ∖ `consumed_archives`);MUST NOT 承担蒸馏块存废判定职责(不用于 stale 检测)。结构:`{"consumed_archives": ["<归档目录名>", ...]}`(数组、去重、顺序无关)。该文件 MUST 经 atomic 写入(临时文件 + rename,复用 `atomic.writeJsonAtomic`);MUST NOT 手写。

该文件缺失时视为 `consumed_archives` 为空集(触发首次全量读引导)。该文件 JSON 损坏时 MUST 报错退出提示人工检查,不静默、不猜测(与蒸馏 marker 损坏同原则)。

read-consumed-archives verb 返回 `{consumed, unconsumed, present, bootstrap}`;`present` 为盘上归档包名列表,仅供报告与人工核对。

#### Scenario: 增量判定

- WHEN `consumed_archives` = [A],`speccode/archive/` 下有 [A, B, C]
- THEN 未消费集 = [B, C],本次蒸馏只读 B、C;A 整包跳过(既有块的新鲜度审查不受影响)

#### Scenario: sidecar 原子写

- WHEN 蒸馏落盘后追记本次读过的归档包进 `consumed_archives`
- THEN 经临时文件 + rename 原子覆盖,中途崩溃不留下半写文件;写入值为旧集 ∪ 新集去重

#### Scenario: sidecar 缺失

- WHEN `_distilled.meta.json` 不存在
- THEN 视为 `consumed_archives` 为空集,触发首次全量读 + 种子创建

#### Scenario: sidecar 损坏

- WHEN `_distilled.meta.json` 存在但 JSON 解析失败
- THEN 报错退出并提示人工检查,不静默修复、不视为空集

### Requirement: 记录命令

`/speccode:recording-knowledge` MUST 允许用户或 agent 直接写主题的 hand-written 知识。写入前 MUST 先经适配闸门:对内容做归类陈述(属于 SDD 过程知识 → 建议落入的 topic;属于业务知识 → 建议进外部 RAG 而非知识集),并展示草稿(写入位置 + 内容),经用户确认后才经 write-knowledge verb 原子写落盘。用户在被建议进 RAG 后仍坚持写入时,MUST 允许其指定既有 topic 或新建 topic(新建落在 `development/` 下,文件名小写连字符,`.md` 结尾),不得硬拦。

**手写段整理(每次运行)**:recording MUST 对本次写入 topic 的既有 hand-written 段做整理——合并重复、删除过时、收紧表述;整理的权威是在场用户,MUST NOT 以 `speccode/spec/` 为真值改写手写内容;删除或合并 MUST 附理由并经闸门确认。整理结果经 write-knowledge verb(mode=replace-hand,与 replace-distilled 对称:替换 hand-written 区、蒸馏块字节级保留)原子写落盘,写入 MUST 输出「手写段在前、蒸馏块在后」的规范布局。

评审中反复出现的问题模式与团队评审共识 SHOULD 记入 development/pitfalls.md(坑与评审共识),不单列 review topic。

#### Scenario: 记录过程知识

- WHEN 用户提供过程知识内容并确认草稿
- THEN 内容写入对应 topic 文件的 hand-written 段,并更新 `_index.md`(新 topic、摘要变化或索引缺失时)

#### Scenario: 业务知识经闸门建议后坚持写入

- WHEN 内容被闸门判定为业务知识并建议进 RAG,用户仍坚持写入并指定 topic
- THEN 内容 MUST 写入用户指定的 topic(不存在则在 `development/` 下新建),闸门陈述不阻断写入

#### Scenario: 手写段整理附理由

- WHEN recording 对本次写入 topic 的手写段提议合并或删除
- THEN 闸门逐项展示建议与理由,用户确认后经 replace-hand 落盘;用户拒绝则该项保持原样

#### Scenario: replace-hand 保留蒸馏块

- WHEN 手写段经 mode=replace-hand 写入
- THEN hand-written 区整体替换为闸门确认内容,同文件蒸馏块与原内容逐字节一致,布局为手写段在前
