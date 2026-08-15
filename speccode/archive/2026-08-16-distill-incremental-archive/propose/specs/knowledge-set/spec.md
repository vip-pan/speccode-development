## MODIFIED Requirements

### Requirement: 蒸馏命令

`/speccode:distilling-knowledge` MUST 从 `speccode/spec/` 全量读、从 `speccode/archive/` **增量读**(只读尚未消费的归档包)以重蒸各 topic 的蒸馏块,产出候选 diff 展示给用户,经用户确认后才写 tracked 层(人工闸门);蒸馏结果与现状无差异时幂等跳过写。

archive 的"已消费"判定 MUST 基于 `speccode/knowledge/_distilled.meta.json` 的 `consumed_archives` 列表(见"蒸馏消费追踪" requirement);不在该列表的归档包为未消费,须读;已在列表的为已消费,整包跳过(含 propose/design/brainstorm 等子文档)。已消费包的既有蒸馏块 MUST 原样 carry forward 进入候选列表(不重蒸)——因归档包不可变,重蒸仅会产出相同内容,故无信息损失。对所有既有块 MUST 做 source 存在性检查:source 指向的 archive 包已删除 → 标 **stale**;source 包仍在但其知识被新归档包取代 → distiller 在候选列表省略该旧块(→ 删除)或更新其 body,闸门标注 **superseded**(<取代包名>),用户确认。两种"块被移除"语义 MUST 在闸门区分标注,stale 为自动检测、superseded 为 distiller 提议。

蒸馏目标 MUST 为:初始骨架 6 个 development topic ∪ `development/` 下用户自建 topic;蒸馏内容 MUST 限于 SDD 开发过程知识(架构、准则、环境、对接、坑与评审共识、安全)。蒸馏目标之外既存的 topic 文件,其蒸馏块 MUST 在闸门内逐块建议移除(日落),经用户确认后删除;其 hand-written 段 MUST 字节级保留,绝不自动修改。

蒸馏成功落盘后 MUST 把本次读过的归档包(含读了无产出的)追记进 `consumed_archives`(去重)。`_distilled.meta.json` 缺失时 MUST 做一次性全量读 archive,并用全部现有归档包种子 `consumed_archives` 创建该 sidecar;此机制同时作为强制全量重蒸的官方逃生口(蒸馏判据变更后删 sidecar 再跑即全量重读+全块重蒸+重种子),不另设 `--full` flag。

#### Scenario: 蒸馏无变化

- WHEN 蒸馏结果与现状无差异(已消费包 carry forward + 未消费包无新信号)
- THEN 跳过写入并报告「无变化」

#### Scenario: 增量只读未消费包

- WHEN `consumed_archives` 含包 A,归档目录新增包 B
- THEN 本次蒸馏只读包 B,包 A 整包跳过;包 A 的既有蒸馏块原样 carry forward 进候选列表,不被重蒸、不被误删

#### Scenario: 首次增量引导

- WHEN `_distilled.meta.json` 不存在
- THEN 本次蒸馏做一次性全量读 archive,落盘后用全部现有归档包种子 `consumed_archives` 创建该 sidecar

#### Scenario: 删 sidecar 强制全量重蒸

- WHEN 蒸馏判据变更(如 topic 结构调整)后,用户删除 `_distilled.meta.json` 再跑 distilling-knowledge
- THEN 全部归档包变未消费 → 全量重读 → 全部既有块重蒸(非 carry-forward)+ 重种子;此为官方全量重建逃生口,不另设 --full flag

#### Scenario: 旧块被新包取代

- WHEN 既有蒸馏块 source 指向的 archive 包仍在盘上,但新归档包的知识取代了该块
- THEN distiller 在候选列表省略该旧块(→ 删除)或更新其 body,闸门标注「superseded by <新包名>」,与 stale(包已删)区分;用户确认后处置

#### Scenario: 来源已消失

- WHEN 蒸馏块 source 指向的 archive 已不存在
- THEN 该块标记为 stale,在闸门内展示给用户处置(删除块或改 source)

#### Scenario: 日落移除范围外 topic 的蒸馏块

- WHEN 存量项目存在蒸馏目标外的 topic 文件(如 business/domain.md)且含蒸馏块
- THEN 蒸馏闸门 MUST 展示「建议移除(该 topic 不在蒸馏目标内;若属业务知识,建议归外部 RAG)」选项;用户确认后块删除,同文件 hand-written 段与原内容逐字节一致;用户拒绝则块保留

#### Scenario: 首次重蒸迁移旧 marker

- WHEN 存量 topic 文件的蒸馏块使用旧格式 `promoted-from`/`/promoted` marker
- THEN 经闸门确认写入后,全部蒸馏块以新格式 `distilled-from`/`/distilled` 重写,hand-written 段与原内容逐字节一致

## ADDED Requirements

### Requirement: 蒸馏消费追踪

speccode MUST 维护 `speccode/knowledge/_distilled.meta.json`(knowledge/ 内 tracked sidecar,与 topic 文件平级),记录蒸馏已消费的归档包,供 distilling-knowledge 增量读判定。结构:`{"consumed_archives": ["<归档目录名>", ...]}`(数组、去重、顺序无关)。该文件 MUST 经 atomic 写入(临时文件 + rename,与 config/state 同策,复用 `atomic.writeJsonAtomic`);MUST NOT 手写。

distilling-knowledge 计算未消费集 = `speccode/archive/` 下实扫的全部归档目录 ∖ `consumed_archives`。该文件缺失时视为 `consumed_archives` 为空集(触发首次全量读引导)。该文件 JSON 损坏时 MUST 报错退出提示人工检查,不静默、不猜测(与蒸馏 marker 损坏同原则)。

#### Scenario: 增量判定

- WHEN `consumed_archives` = [A],`speccode/archive/` 下有 [A, B, C]
- THEN 未消费集 = [B, C],本次蒸馏只读 B、C;A 整包跳过

#### Scenario: sidecar 原子写

- WHEN 蒸馏落盘后追记本次读过的归档包进 `consumed_archives`
- THEN 经临时文件 + rename 原子覆盖,中途崩溃不留下半写文件;写入值为旧集 ∪ 新集去重

#### Scenario: sidecar 缺失

- WHEN `_distilled.meta.json` 不存在
- THEN 视为 `consumed_archives` 为空集,触发首次全量读 + 种子创建

#### Scenario: sidecar 损坏

- WHEN `_distilled.meta.json` 存在但 JSON 解析失败
- THEN 报错退出并提示人工检查,不静默修复、不视为空集
