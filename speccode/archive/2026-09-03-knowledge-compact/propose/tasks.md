# Tasks: knowledge-compact

## 1. spec delta

- [x] 1. `specs/knowledge-set/spec.md`:MODIFIED「来源标记」(能力键制 + upsert + 布局规范 + 写侧校验 + 首跑归位 scenario)、「蒸馏命令」(新鲜度审查替代 carry-forward/stale/superseded + 闸门 diff 纪律 + 存量能力键映射;保留 frontmatter 不蒸馏与日落条款)、「蒸馏消费追踪」(sidecar 降级纯读成本控制,去 stale 职责)、「记录命令」(手写段整理 + replace-hand;保留适配闸门)——名称与主规格逐字一致

## 2. 引擎 lib(`plugins/speccode/lib/knowledge.mjs`)

- [x] 2. 能力键校验:source MUST 匹配 `^cap/[a-z0-9-]+$` 且文件内唯一;replace-distilled 入参含非能力键 source 或重复键 → 写前报错(对齐既有 duplicate-source / marker-string 前置校验)
- [x] 3. `replaceDistilledBlocks` 布局归位:输出 = hand-written 区(全部非块内容按序、字节级保留)在前 + 蒸馏块(既有保序 + 新块尾部追加)在后;幂等
- [x] 4. 新增 `replaceHandBlocks`(与 replaceDistilledBlocks 对称):替换 hand-written 区为给定内容,蒸馏块字节级保留,输出同一规范布局
- [x] 5. 注释与语义更新:`listArchiveBundles` 的 stale-detection 注释改为纯读成本控制;`parseDistilledBlocks` 注释补「值可为旧来源值(存量待迁移)」

## 3. CLI 枢纽(`plugins/speccode/bin/speccode.mjs`)

- [x] 6. write-knowledge 新增 `mode=replace-hand`(必填 content;错误形状与既有 mode 校验一致)

## 4. 测试(`plugins/speccode/tests/`)

- [x] 7. knowledge.test.mjs:能力键格式/唯一性校验(拒旧 source 直写、拒重复键)、布局归位(块间手写内容前置 + 字节保留 + 幂等)、replaceHandBlocks(蒸馏块字节不变、空手写区、规范布局)
- [x] 8. cli.test.mjs:write-knowledge mode=replace-hand 端到端(spawnSync,stdin 传 JSON;含非法入参报错)

## 5. 命令层(`plugins/speccode/commands/`)

- [x] 9. 重写 `distilling-knowledge.md`:蒸馏段改新鲜度审查(真值锚 spec/ 全量;既有块逐块审查,不再 carry-forward);闸门段改「diff 只展示变化块、删除/合并附理由」,删 stale/superseded 标注;新增存量块能力键映射段(逐块提议 + 「全部确认」;能力键命名纪律:优先对齐 spec capability 目录名);落盘段补布局归位说明;删 sidecar 逃生口表述改为「强制全量重读」
- [x] 10. 改 `recording-knowledge.md`:新增「手写段整理」段(本次写入 topic;权威 = 在场用户,不读 spec;合并/删除附理由经闸门);写入方式改 mode=replace-hand(新内容 + 整理后既有手写段);其余段保持

## 6. 门面与自述文档

- [x] 11. README×4(根中英 + 插件中英):知识集定位段改「当前态快照 + 长青准则」、能力键身份、两命令新语义一句话(双语同步;不硬编码版本与数量)
- [x] 12. CLAUDE.md:无结构性改动(不涉及;若有措辞涉及知识机制则同步,无则跳过)
- [x] 13. CHANGELOG:发布时新增 Unreleased 小节(与 speccode-workflow 发布纪律一致)

## 7. dogfood 首跑与收尾

- [x] 14. dogfood:对本仓 `speccode/knowledge/` 用新规则跑一次 distilling-knowledge——存量块经闸门映射能力键、布局归位、首跑顺带退役「stale vs superseded」相关知识块;recording 对整理诉求显式验证一次 replace-hand
- [x] 15. 全量测试:`node --test ./plugins/speccode/tests/*.test.mjs` 全绿
- [x] 16. 结构化校验:MODIFIED requirement 名称与主规格逐字一致;每条 requirement 含 SHALL/MUST + 至少一个 Scenario;命令 prose 与 spec 口径一致(diff 纪律、整理权威、映射纪律三处)
- [x] 17. syncing 合并 delta 进主规格 → archiving 归档 → finishing-worktree(单 PR 上 trunk)
