# Delta: plugin-packaging

## MODIFIED Requirements

### Requirement: 文档三层分离

仓库 SHALL 维护三层文档,职责如下:

- 根 `README.md`(英文,`marketplace 用户门面`)与根 `README_CN.md`(简体中文,结构一致):两版 SHALL 各含——一句话定位 + badges(含 license、平台、stars;含**动态版本徽章**:经 shields.io `dynamic/json` 从 raw `plugins/speccode/.claude-plugin/plugin.json` 读取 `$.version`,MUST NOT 硬编码版本字面量;含 **CI 状态徽章**链接 `.github/workflows/test.yml`)+ **安装节(Install)**(badges 之后立即给出 marketplace add + plugin install 两步命令)+ 痛点(Why,可表为 ✅ 可扫读清单,拓扑表述为双层)+ **基础工作流段(The Basic Workflow)**(编号步骤,每步 = 命令名 + 一句话说明,演普通需求默认路径)+ 体验 demo(**普通需求路径**)+ Quickstart 最小闭环(**前置 Prerequisites 一行**:Node ≥ 24 + 可选 gh/glab,并 MUST 含 **Windows 不支持**一行)+ 命令速览(标题与正文 MUST NOT 写死命令总数字面量,以「全套 /speccode:* 命令」表述)+ **双层分支拓扑图** + 对比定位(可表为**特性矩阵**:行=能力,列=speccode/superpowers/spec-kit/BMAD/手工约定)+ 理念 + 文档地图 + **安全警告节**(git clean 对 `.speccode/` 的风险:精简说明 + dry-run 建议 + 指向插件 README §14 详文)+ 贡献方式(可指向根 `CONTRIBUTING.md`,流程链演普通需求链路)+ License 节;marketplace 描述与插件列表 MUST 保留;两版 SHALL 在文档前部互相提供语言切换链接;中文版为英文版的全量翻译,结构(段)一一对应。
- `plugins/speccode/README.md`(英文)与 `plugins/speccode/README_CN.md`(简体中文,`插件设计文档`):两版 SHALL 含全套命令表(与 `plugins/speccode/skills/` 实扫一致,MUST NOT 写死命令总数字面量)/ 双层分支拓扑图 / R1-R13 风险 / 0.1→0.2 迁移对照表;两版节号编号 SHALL 一致(§1-14);两版 SHALL 在 §1 之后含 **Table of Contents**(锚点列表,覆盖 §1-14);两版 SHALL 在文档前部声明「用户门面见根 README」指针且指向**对应语言**的根 README;依赖要求(git / gh / glab / Node ≥ 24)SHALL 前置到文档前部;两版 SHALL 在文档前部互相提供语言切换链接。
- `CLAUDE.md`(开发文档):SHALL 说明根 README 与插件 README 的分工(含中英文四文件映射);SHALL 含发布纪律指针(plugin.json version bump 必须同步 CHANGELOG.md);SHALL 含「多语言维护」说明——两版文档 SHALL 结构对齐(段/节为锚),任何内容改动 MUST 同步全部语言版本;SHALL NOT 硬编码测试用例数量。

#### Scenario: 四 README 文件各司其职

- **WHEN** 检查仓库根 README.md、README_CN.md、plugins/speccode/README.md、plugins/speccode/README_CN.md、CLAUDE.md
- **THEN** 根两版含 marketplace 描述与插件列表;插件两版含全套命令表与双层拓扑图;CLAUDE.md 含引擎三层架构与测试命令,且无对 `.claude/speccode/` 旧路径的引用

#### Scenario: 根 README 两版门面要素齐全且结构一致

- **WHEN** 检查仓库根 README.md 与 README_CN.md
- **THEN** 两版均含:一句话定位标语、badges(含动态版本徽章与 CI 状态徽章)、安装节(两步 `/plugin` 命令)、痛点 Why 段、基础工作流段(编号步骤、普通需求路径)、体验 demo(普通需求路径)、Quickstart 最小闭环(前置 Prerequisites 含 Windows 不支持行)、命令速览(无计数硬编码)、双层分支拓扑图、对比定位(特性矩阵含 BMAD 列)、理念、文档地图、安全警告节(git clean 风险)、贡献方式、License 节;两版段落一一对应(中文版为英文版全量翻译)

#### Scenario: 插件 README 两版门面指针、依赖前置与 ToC

- **WHEN** 检查 plugins/speccode/README.md 与 plugins/speccode/README_CN.md
- **THEN** 两版文档前部(前 5 行内)存在指向**对应语言**根 README 的门面指针;依赖要求出现在文档前部而非末尾章节;两版节号编号一致(§1-14);两版含 Table of Contents(§1-14 锚点列表)

#### Scenario: 动态版本徽章不硬编码

- **WHEN** 检索根 README.md 与 README_CN.md 的徽章段
- **THEN** 版本徽章为 shields.io `dynamic/json` 形态(从 raw plugin.json 读 `$.version`),MUST NOT 出现硬编码版本号字面量(如 `0.2.5`)

#### Scenario: CLAUDE.md 分工、纪律与多语言维护

- **WHEN** 检查 CLAUDE.md
- **THEN** 含四 README 文件分工说明、发布纪律指针(version bump 同步 CHANGELOG)、多语言维护说明(结构对齐为锚、改动同步全部语言版本);测试约定不硬编码用例数量

#### Scenario: 用户文档与现行拓扑与计数契约一致

- **WHEN** 检查 `plugins/speccode/README.md` 与 `plugins/speccode/README_CN.md`
- **THEN** 两版命令表 MUST 与 `plugins/speccode/skills/` 实扫一致且不写死总数字面量,拓扑图 MUST 为双层(trunk ↔ 开发分支直达,集成分支为大需求 opt-in 聚合层),且 MUST 含 0.1→0.2 迁移对照表,不存在 display / `-complete` 分支的现行行为描述

#### Scenario: 门面计数零字面量

- **WHEN** 检索仓库根 README.md、README_CN.md 与插件 README.md、README_CN.md 的标题与正文中的命令总数、capability 总数字面量(如「24 个命令」「24 commands」「11 capabilities」)
- **THEN** 均不存在;计数类信息以「全套 /speccode:* 命令」等表述或指向 `plugins/speccode/skills/`、CHANGELOG 的链接承载

#### Scenario: 安全警告节存在且指向详文

- **WHEN** 检查根 README.md 与 README_CN.md
- **THEN** 两版均含 git clean 风险的安全警告节(含 `git clean -n` dry-run 建议),并含指向对应语言插件 README §14 的链接;插件 README §14 详文保留不被删除
