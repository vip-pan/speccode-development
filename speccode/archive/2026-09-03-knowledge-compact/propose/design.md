# Design: knowledge-compact(知识集快照化改造)

## Context

现行机制(`speccode/spec/knowledge-set/spec.md`,基线含 #42 frontmatter 不蒸馏条款):

- 蒸馏块身份 = source(`archive/<归档目录名>/` 或 `spec/<capability 目录名>/`),marker `<!-- distilled-from: <source> -->` … `<!-- /distilled -->`;读侧永久兼容旧 `promoted-from` 格式。
- distilling 全量读 spec/、增量读 archive/(sidecar `consumed_archives` 判定);已消费包的既有块**原样 carry-forward**;source 包已删 → **stale**(自动检测,数据源 = sidecar `present`);source 包仍在但知识被新包取代 → **superseded**(distiller 提议)。
- 手写段(块外内容)字节冻结:任何命令绝不修改;write-knowledge verb 四模式 replace / append-hand / replace-distilled / index;replaceDistilledBlocks 保持块外内容原位、新块 append 尾部。
- 约束不变量:确定性逻辑下沉 lib(knowledge.mjs 纯文本操作)、marker 损坏报错不猜测、原子写、命令层只做 prose 交互、`_index.md` 实扫重建。

痛点:三个特设机制都在回答「来源怎么了」而非「知识还对吗」——归档包是不可变历史,以它为身份使知识集变成台账;sidecar 同时承担读成本控制与 stale 判定双职责;手写段只增不改,重复与过时累积。

## Goals

- 知识集回归「当前态快照 + 长青准则」:块身份与归档包生命周期解耦。
- 每次蒸馏运行都对既有知识做新鲜度审查(真值锚 = spec/ 主规格)。
- 手写段经闸门可维护(合并、删除、收紧)。

## Non-Goals

- 不改 topic 骨架(6 development topic)、`_index.md` 生成、消费入口(9 命令静默兜底)。
- 不改知识维护分支纪律(chore/knowledge-* worktree、finishing-worktree 收尾)。
- 不做存量迁移工具/脚本(迁移 = 首次新规则运行经闸门)。
- 不动 memory / SDD 家族的任何机制。

## Decisions

### D1 能力键制身份(否决备选:保留来源键 + 修 stale 判定)

marker 值改为 `cap/<slug>`(slug `^[a-z0-9-]+$`,文件内唯一),写入 = 按能力键 upsert,同能力演进覆盖、不累积。出处(archive 包名 / spec capability)降级为块 body 内纯文本。否决「保留来源键修 stale 判定」:治标——机制仍随归档量膨胀;否决 git 派生游标(历史上已被废弃:全量重蒸语义刻意无游标)。

写侧强制:replace-distilled 入参 blocks 的 source MUST 匹配能力键格式且文件内唯一——旧 source 块未经闸门映射无法直写,这是「迁移必经闸门」的引擎级兜底(对齐既有 duplicate-source / marker-string 前置校验先例)。

### D2 真值锚 = spec/ 主规格;archive 增量读降级为纯读成本控制

新鲜度审查的对象是「知识内容是否仍真」,唯一权威是当前态 spec/;archive 是历史增量,新鲜度不依赖重读历史。sidecar `consumed_archives` 保留(增量读成本控制),`present` 字段保留在 verb 输出形状中(向后兼容)但不再参与块存废判定。

### D3 三机制退役:stale-by-source、superseded-by-package、carry-forward

块存废统一改由新鲜度审查提议(重写 / 删除 / 合并,均附理由经闸门)。supersession 语义被 upsert 天然吸收:同能力键重蒸产出新内容即覆盖。删除理由面向「知识过时/被取代」,不再区分「来源包消失」。

### D4 replace-hand 与手写段整理(权威 = 在场用户)

lib 新增 `replaceHandBlocks`(与 replaceDistilledBlocks 对称):替换 hand-written 区、蒸馏块字节级保留。recording 每次运行对本次写入 topic 的手写段做整理(合并重复、删除过时、收紧表述),删除/合并 MUST 附理由经闸门。整理不读 spec/ 作真值——手写知识的权威是在场用户(与蒸馏的真值锚刻意不同)。

### D5 布局规范 + 每次写入输出规范布局(首跑归位)

规范布局:hand-written 段在前、蒸馏块在后。replace-distilled / replace-hand 每次写入都输出该布局:非块内容(手写段,含原分布于块间的)按序前置、字节级保留仅位置重排;蒸馏块依序随后。存量文件首次写入归位,之后幂等。

### D6 存量迁移零工具

旧 source 值块解析照常(parseDistilledBlocks 不变——marker 语法未变,仅值语义变化);首次 distilling 运行时 distiller 为每个旧块提议能力键(优先对齐既有 spec capability 目录名),闸门逐块确认(提供「全部确认」)。无专用迁移脚本。

### D7 退役即删,不留墓碑

知识过时/被取代即删除,不写「此知识已退役」墓碑块;历史叙事归 archive/ 与 CHANGELOG。预期首轮运行会顺带退役「stale vs superseded」知识块本身(其描述的机制不复存在)。

## Risks

- **R1 迁移闸门一次性负担**(本仓 ~20 存量块)→ distiller 预映射 + 闸门「全部确认」选项;单块成本 = 读 body 判定所属能力。
- **R2 能力键命名漂移**(slug 随意命名使后续 upsert 对不上)→ 命名纪律:SHOULD 对齐 `speccode/spec/` 下既有 capability 目录名;无对应 capability 用稳定 kebab 主题词;命名纪律写入命令 prose。
- **R3 与在途 chore/spec-count-23 同文件改动**(其改块 body 去数字化,本需求改块身份与布局)→ 机制无冲突;合入顺序上后到方 rebase,冲突限文本层。
- **R4 首跑归位产生大 diff**(布局重排)→ 一次性、幂等;闸门 diff 纪律(只展示变化块)降低后续噪音。

## Open Questions

无(探索结论 + 主干复核已覆盖全部关键决策)。
