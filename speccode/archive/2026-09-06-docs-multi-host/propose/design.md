# Design: docs-multi-host

## Context

四个子需求落地后的状态:root=插件根、24 skills 零宿主 token、`config.host` 探测、五宿主 adapter 与 `references/host-mapping/` 就绪。但门面仍是 CC 专属叙事:README 定位句「built on Claude Code」、Quickstart 仅 marketplace、对比表「Native Claude Code plugin」、DESIGN §1「a Claude Code workflow orchestration plugin」、marketplace description 无宿主信息。

约束:主规格「文档三层分离」锁四文件职责与双语结构对齐(根 11 段 / DESIGN §1-14);「文档版本信息不漂移」禁硬编码版本与数量;CHANGELOG 仅在 version bump 时同步(发布纪律)——本变更不 bump。

## Goals

- 门面从「CC 专属插件」转正为「六宿主流程编排插件」:定位句、安装指引、对比定位、文档地图四处叙事一致
- 双语零漂移(EN/CN 段落一一对应);不引入硬编码

## Non-Goals

- 不改 CHANGELOG(发版时按纪律同步,BREAKING 义务记录于父实体记忆)
- 不改 24 skills / adapter / 引擎(前三子需求交付)
- 不重写「See It in Action」示例(它是 CC 会话实录,保留并在多宿主段注明其余宿主安装路径即可)
- 不动 spec 主档(syncing 职责)

## Decisions

1. **定位句口径:Claude Code 主宿主 + 五宿主适配,而非「全宿主等价」**——诚实呈现成熟度差(CC 持续 dogfood,五宿主安装待真机验证,host-mapping README 的验证状态表是唯一真源);被否:平铺「支持六大宿主」(把待验证说成已验证,违背诚实边界)。
2. **多宿主安装指引以链接承载,不在 README 复述五份文档**——README Quickstart 加一小段 + 指向 `references/host-mapping/README.md`(宿主/入口/状态表)与 `scripts/install-shim.sh`;README 是门面不是手册,细节下沉。被否:README 内嵌五宿主完整步骤(门面膨胀,且与 host-mapping 文档双头维护)。
3. **对比定位行从「Native Claude Code plugin」改为「Multi-host install (6 coding agents)」**——横向对比对象(superpowers/spec-kit)恰是多宿主玩家,原行自我矮化;新口径如实(六入口存在,验证状态在映射文档)。被否:删除该行(丢关键差异信息)。
4. **CHANGELOG 义务外置**——「新项目 worktree 缺省 `.speccode/worktrees`」的 BREAKING 提示写入父实体记忆与提案 Impact,发版时由发布纪律承载;本分支零 CHANGELOG 改动。

## Risks

| 风险 | 缓解 |
|---|---|
| 双语改写后段落错位(违反结构对齐契约) | 每处编辑 EN/CN 成对执行;收尾验证 11 段一一对应 |
| 门面措辞把待验证宿主说成已验证 | 决策 1 的诚实口径 + 验证状态一律指向 host-mapping README |
| README 改写触发既有测试(cli.test 对 README 的措辞断言) | 全量测试回归;断言仅查 code_intel_tools/知识库残留与新缺省,与定位措辞无耦合 |

## Open Questions

无——叙事口径(诚实分级)与承载方式(链接下沉)均为文档内容决策。
