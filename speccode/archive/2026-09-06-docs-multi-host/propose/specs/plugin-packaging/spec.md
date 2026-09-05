# plugin-packaging Delta

## MODIFIED Requirements

### Requirement: 文档三层分离

仓库 SHALL 维护三层文档,职责如下:

- 根 `README.md`(英文,`marketplace 用户门面`)与根 `README_CN.md`(简体中文,结构一致):两版 SHALL 各含——一句话定位(多宿主口径:Claude Code 主宿主 + 五宿主适配,成熟度如实分级)+ badges(含 license、平台、stars;含**动态版本徽章**:经 shields.io `dynamic/json` 从 raw `.claude-plugin/plugin.json` 读取 `$.version`,MUST NOT 硬编码版本字面量;含 **CI 状态徽章**链接 `.github/workflows/test.yml`)+ 痛点(Why)+ 体验 demo + Quickstart 最小闭环(Claude Code 主链路 + **多宿主安装指引段**:指向 `references/host-mapping/README.md` 的宿主/入口/验证状态表与 `scripts/install-shim.sh`)+ 命令速览 + 双层分支拓扑图 + 对比定位(含多宿主安装口径行)+ 理念 + 文档地图(含 host-mapping 条目)+ 贡献方式 + License 节;marketplace 描述与插件列表 MUST 保留;两版 SHALL 在文档前部互相提供语言切换链接;中文版为英文版的全量翻译,结构一一对应。
- `docs/DESIGN.md`(英文)与 `docs/DESIGN_CN.md`(简体中文,`插件设计文档`):两版 SHALL 含 24 命令表 / 双层分支拓扑图 / R1-R13 风险 / 迁移对照表 / **多宿主安装入口表**(见 host-adapters);两版节号编号 SHALL 一致(§1-14);两版 SHALL 在 §1 之后含 **Table of Contents**(锚点列表,覆盖 §1-14);两版 SHALL 在文档前部声明「用户门面见根 README」指针且指向**对应语言**的根 README;依赖要求 SHALL 前置到文档前部;两版 SHALL 在文档前部互相提供语言切换链接;§1 定位句 SHALL 采用与根 README 一致的多宿主口径。
- `AGENTS.md`(开发文档,真源):SHALL 说明根 README 与 `docs/DESIGN.md` 的分工(含中英文映射);SHALL 含发布纪律指针(plugin.json version bump 必须同步 CHANGELOG.md);SHALL 含「多语言维护」说明——两版文档 SHALL 结构对齐(段/节为锚),任何内容改动 MUST 同步全部语言版本;SHALL NOT 硬编码测试用例数量。
- `CLAUDE.md`(Claude Code 专属薄壳):SHALL 仅含对 `AGENTS.md` 的引入(`@AGENTS.md`)与 Claude Code 专属补充;SHALL NOT 复制 `AGENTS.md` 正文(防双头漂移)。

#### Scenario: 文档文件各司其职
- **WHEN** 检查仓库根 README.md、README_CN.md、docs/DESIGN.md、docs/DESIGN_CN.md、AGENTS.md、CLAUDE.md
- **THEN** 根两版含 marketplace 描述与插件列表;设计文档两版含 24 命令表与三层拓扑图;AGENTS.md 含引擎三层架构与测试命令;CLAUDE.md 为薄壳且无对 `plugins/speccode/` 旧路径的引用

#### Scenario: 根 README 两版门面要素齐全且结构一致
- **WHEN** 检查仓库根 README.md 与 README_CN.md
- **THEN** 两版段落一一对应(中文版为英文版全量翻译),版本徽章为 shields.io `dynamic/json` 形态(从 raw `.claude-plugin/plugin.json` 读 `$.version`),MUST NOT 出现硬编码版本号字面量

#### Scenario: 门面多宿主定位诚实分级
- **WHEN** 检查根 README.md 与 README_CN.md 的定位句、Quickstart 多宿主指引段与对比定位行
- **THEN** 定位句呈现「Claude Code 主宿主 + 五宿主适配」口径;多宿主指引指向 `references/host-mapping/README.md` 的宿主/入口/验证状态表与 shim 安装;验证状态表述与该表一致(Claude Code 已验证、五宿主待真机验证),MUST NOT 把待验证宿主表述为已验证

#### Scenario: 设计文档两版指针与 ToC
- **WHEN** 检查 docs/DESIGN.md 与 docs/DESIGN_CN.md
- **THEN** 两版文档前部存在指向对应语言根 README 的门面指针;节号编号一致(§1-14);含 Table of Contents(§1-14 锚点列表);§1 定位句与根 README 口径一致

#### Scenario: AGENTS.md 承载开发文档且 CLAUDE.md 为薄壳
- **WHEN** 检查 AGENTS.md 与 CLAUDE.md
- **THEN** AGENTS.md 含发布纪律指针与多语言维护说明、不硬编码用例数量;CLAUDE.md 含 `@AGENTS.md` 引入且不复制 AGENTS.md 正文

#### Scenario: 设计文档与 v2 一致
- **WHEN** 检查 `docs/DESIGN.md` 与 `docs/DESIGN_CN.md`
- **THEN** 两版命令表 MUST 为 24 个命令,拓扑图 MUST 为双层分支拓扑(trunk → `<type>/<slug>` 开发分支即 worktree,大需求 opt-in 集成分支),且 MUST 含 0.1→0.2 迁移对照表,不存在 display / `-complete` 分支的现行行为描述
