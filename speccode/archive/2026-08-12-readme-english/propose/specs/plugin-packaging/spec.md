# plugin-packaging — delta (readme-english)

## MODIFIED Requirements

### Requirement: 文档三层分离

仓库 SHALL 维护三层文档,职责如下:

- 根 `README.md`(英文,`marketplace 用户门面`)与根 `README_CN.md`(简体中文,结构一致):两版 SHALL 各含——一句话定位 + badges + 痛点(Why)+ 体验 demo + Quickstart 最小闭环 + 21 命令速览 + 三层分支拓扑图 + 对比定位 + 理念 + 文档地图 + 贡献方式 + License 节;marketplace 描述与插件列表 MUST 保留;两版 SHALL 在文档前部互相提供语言切换链接;中文版为英文版的全量翻译,结构(段)一一对应。
- `plugins/speccode/README.md`(英文)与 `plugins/speccode/README_CN.md`(简体中文,`插件设计文档`):两版 SHALL 含 21 命令表 / 三层分支拓扑图 / R1-R13 风险 / 0.1→0.2 迁移对照表;两版节号编号 SHALL 一致(§1-14);两版 SHALL 在文档前部声明「用户门面见根 README」指针且指向**对应语言**的根 README;依赖要求(git / gh / glab / Node ≥ 24)SHALL 前置到文档前部;两版 SHALL 在文档前部互相提供语言切换链接。
- `CLAUDE.md`(开发文档):SHALL 说明根 README 与插件 README 的分工(含中英文四文件映射);SHALL 含发布纪律指针(plugin.json version bump 必须同步 CHANGELOG.md);SHALL 含「多语言维护」说明——两版文档 SHALL 结构对齐(段/节为锚),任何内容改动 MUST 同步全部语言版本;SHALL NOT 硬编码测试用例数量。

#### Scenario: 四 README 文件各司其职
- **WHEN** 检查仓库根 README.md、README_CN.md、plugins/speccode/README.md、plugins/speccode/README_CN.md、CLAUDE.md
- **THEN** 根两版含 marketplace 描述与插件列表;插件两版含 21 命令表与三层拓扑图;CLAUDE.md 含引擎三层架构与测试命令,且无对 `.claude/speccode/` 旧路径的引用

#### Scenario: 根 README 两版门面要素齐全且结构一致
- **WHEN** 检查仓库根 README.md 与 README_CN.md
- **THEN** 两版均含:一句话定位标语、badges、痛点 Why 段、体验 demo、Quickstart 最小闭环、21 命令速览、三层分支拓扑图、对比定位、理念、文档地图、贡献方式、License 节;两版段落一一对应(中文版为英文版全量翻译)

#### Scenario: 插件 README 两版门面指针与依赖前置
- **WHEN** 检查 plugins/speccode/README.md 与 plugins/speccode/README_CN.md
- **THEN** 两版文档前部(前 5 行内)存在指向**对应语言**根 README 的门面指针;依赖要求出现在文档前部而非末尾章节;两版节号编号一致(§1-14)

#### Scenario: CLAUDE.md 分工、纪律与多语言维护
- **WHEN** 检查 CLAUDE.md
- **THEN** 含四 README 文件分工说明、发布纪律指针(version bump 同步 CHANGELOG)、多语言维护说明(结构对齐为锚、改动同步全部语言版本);测试约定不硬编码用例数量

#### Scenario: 用户文档与 v2 一致
- **WHEN** 检查 `plugins/speccode/README.md` 与 `plugins/speccode/README_CN.md`
- **THEN** 两版命令表 MUST 为 21 个新命令,拓扑图 MUST 为 trunk/feature/worktree 三层,且 MUST 含 0.1→0.2 迁移对照表,不存在 display / `-complete` 分支的现行行为描述

### Requirement: 文档版本信息不漂移

仓库文档(根 README.md、根 README_CN.md、CLAUDE.md 等,含全部语言版本)SHALL NOT 硬编码随时间漂移的信息——插件版本号(plugin.json `version`)、测试用例数量、命令总数等;需要引用版本时 MUST 以链接指向 CHANGELOG.md 或读自 plugin.json(单一数据源),涉及数量类信息 MUST NOT 写死字面量。

#### Scenario: 根 README 两版均无硬编码版本
- **WHEN** 检索仓库根 README.md 与 README_CN.md 中的 `0.2.x` / `0.1.x` 版本号字面量
- **THEN** 两版均不存在;版本信息以链接(如指向 CHANGELOG.md)形式呈现

#### Scenario: CLAUDE.md 无用例数量字面量
- **WHEN** 检索 CLAUDE.md 中的测试数量字面量(如「137」)
- **THEN** 不存在;测试约定以命令与文件路径表达

## ADDED Requirements

### Requirement: 文档双语互链

仓库的双语文档 SHALL 通过语言切换链接与跨层引用构成无死链的互链矩阵:

- 根 `README.md`(EN)与根 `README_CN.md`(zh)SHALL 在文档前部(前 5 行内)互相提供语言切换链接;
- `plugins/speccode/README.md`(EN)与 `plugins/speccode/README_CN.md`(zh)SHALL 在文档前部(前 5 行内)互相提供语言切换链接;
- 根 README 对插件 README 的引用 SHALL 指向对应语言版本(EN 版 → `plugins/speccode/README.md`,zh 版 → `plugins/speccode/README_CN.md`);
- 插件 README 的门面指针 SHALL 指向对应语言的根 README(EN 版 → 根 `README.md`,zh 版 → 根 `README_CN.md`)。

#### Scenario: 根两版 toggle 互链
- **WHEN** 检查仓库根 README.md 与 README_CN.md 前 5 行
- **THEN** 两版各含指向另一语言版本的切换链接,且链接目标文件存在

#### Scenario: 插件两版 toggle 互链
- **WHEN** 检查 plugins/speccode/README.md 与 plugins/speccode/README_CN.md 前 5 行
- **THEN** 两版各含指向另一语言版本的切换链接,且链接目标文件存在

#### Scenario: 跨层引用语言对应
- **WHEN** 检查根 README 对插件 README 的引用,以及插件 README 对根 README 的门面指针
- **THEN** 英文版引用指向英文版、中文版引用指向中文版(根 EN→插件 EN、根 CN→插件 CN、插件 EN→根 EN、插件 CN→根 CN),无跨语言错链
