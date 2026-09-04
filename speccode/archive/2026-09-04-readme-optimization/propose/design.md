# Design: readme-optimization

## Context

根 README(EN/CN)与插件 README(EN/CN)的多语言维护纪律(结构一一对应、锁步同步)与计数不漂移纪律已由 plugin-packaging 主规格固化。现状:插件 README §1-14 已随 v3 更新(双层拓扑、opt-in 标注),但根 README 仍停在 v2 词汇(「三层拓扑」4+ 处、Quickstart/demo 教 opt-in 路径),且主规格「文档三层分离」的场景钉着 v2 表述(「拓扑图 MUST 为 trunk/feature/worktree 三层」「两版命令表 MUST 为 24 个命令」)——规格与门面互相锁死在过时状态。旧轮(2026-08-16,PR #31)遗留 Open Question:「spec『命令总数不硬编码』vs 门面写死计数」未解。

参照物(2026-09-04 抓取 README 主页核对):spec-kit(场景先行 + 编号步骤 + 安装位于前 1/4)、superpowers(The Basic Workflow 编号步骤段)、BMAD(一句话开场 + 安装极早 + Why 粗体清单)、aider(logo + tagline)。

## Goals

- 门面四文件事实正确:与 v3 双层拓扑、普通需求默认路径一致。
- 门面结构对齐优秀 README 惯例:安装前置、编号工作流段、安全警告前置、Windows 限制可见。
- 根治门面计数漂移:命令数 / capability 数零字面量。
- 主规格「文档三层分离」与实现同步回到双层现实。

## Non-Goals

- 不做 logo / demo GIF / 视频(内容制作,另立任务)。
- 不动 CLAUDE.md 计数(24 命令 / 14 lib 模块——开发文档,与实扫一致即可,不在门面瘦身范围)。
- 不动插件 README §1-14 结构与 §3 双层拓扑(已是现行)。
- 不改「命令命名空间」「skill frontmatter 契约」等其他 requirement 的计数场景(插件行为契约,非门面表达)。
- 不新增 capability、不动其他 10 个主规格。

## Decisions

- **D1 — 计数彻底去字面量,解决旧 Open Question**:根 README 与插件 README 的命令数(24)与 capability 数(11)字面量全部移除,以「全套 /speccode:* 命令」「the full /speccode:* command set」表述;spec 场景「两版命令表 MUST 为 24 个命令」改为「与 `plugins/speccode/skills/` 实扫一致」。被否备选:仅标题去数、正文保留 1-2 处——与「文档版本信息不漂移」的「涉及数量 MUST NOT 写死字面量」字面冲突,保留即留漂移面,不取。
- **D2 — Install 独立成节前置(BMAD 式)**:badges 之后立即给两行 `/plugin` 命令;Quickstart 保留但去掉安装步骤(改为引用 Install 节),聚焦「5 分钟最小闭环」。被否备选:仅把安装提前到 Quickstart 第 1 步(spec-kit 式)——仍需滚到 40% 页面处,不取。
- **D3 — demo 与 Basic Workflow 都演普通需求路径**:大多数用户的第一晚是普通需求(`creating-worktree` 直达);大需求 opt-in 路径由双层拓扑图承担展示。Basic Workflow 用 superpowers 式编号步骤(7 步,每步 = 命令名 + 一句话人话),置于 Why 之后、demo 之前。被否备选:demo 保持大需求路径以展示全功能——首屏误导成本 > 展示收益,不取。
- **D4 — git clean 警告前置 = 精简节 + 指针,不迁移**:根 README 新增「⚠ Before You Run git clean」节(3-4 行:风险 + dry-run 建议 + 指向插件 README §14);插件 README §14 详文原样保留。被否备选:整段迁入门面——插件 README §14 是权威详文,迁移制造两份全文,不取。
- **D5 — BMAD 列基于其 README 主页保守标注**(2026-09-04 抓取核对):双层拓扑+对账 —;文档仓内托管 部分(项目内生成 docs,但非全分支 tracked 规格主档);Claude Code 原生插件 —(npx 安装器形态);SDD 方法论 ✅(自有体系);hooks+memory —;PR 流程 —。标注依据与日期记于本设计;若后续需要更深核对(源码级),另立任务。
- **D6 — spec delta 仅 MODIFIED「文档三层分离」**:拓扑措辞双层化(含场景改名「用户文档与 v2 一致」→「用户文档与现行拓扑与计数契约一致」)、门面元素列表更新(Install 节 / Basic Workflow 段 / Windows 行 / 安全警告节 / 特性矩阵加 BMAD 列)、计数契约改实扫一致。不新增 requirement、不新增 capability。
- **D7 — 理念段位置保持不动**:superpowers / spec-kit 把哲学放末尾,但移动段落会扩大 spec 元素列表变更面而收益有限;仅更新其前后段落内容,顺序不动。

## Risks

- **双语漂移** → 根/插件 README 每段改动 EN/CN 锁步;tasks.md 设独立「双语对齐核对」任务(段一一对齐 + 全量 grep 校验)。
- **BMAD 列 claim 失准** → 保守标注(—/部分优先)+ D5 依据留痕;后续发现失准属 docs 修正,成本低。
- **spec scenario 改名影响 syncing 匹配** → delta 的 MODIFIED 匹配锚是 requirement 名(「文档三层分离」逐字一致),scenario 名可自由改;主规格同名 scenario 由 syncing 整体替换,无残留匹配问题。
- **去 24 后表达力下降** → 「全套 /speccode:* 命令」+ 插件 README 链接承载完整清单;说服力由对比矩阵与 Why 清单承担。

## Open Questions

(无——定层建议见 proposal 生成后的确认环节)
