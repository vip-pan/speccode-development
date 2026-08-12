# plugin-packaging — delta (readme-docs-overhaul)

## MODIFIED Requirements

### Requirement: 文档三层分离

仓库 SHALL 维护三层文档,职责如下:

- 根 `README.md`:`marketplace 用户门面`——一句话定位 + badges + 痛点(Why)+ 体验 demo(模拟 AI 会话块或等价可感知形式)+ Quickstart 最小闭环(安装 → 首个命令)+ 21 命令速览 + 三层分支拓扑图 + 对比定位(vs superpowers/spec-kit 等)+ 理念 + 文档地图 + 贡献方式 + License 节;marketplace 描述与插件列表 MUST 保留。
- `plugins/speccode/README.md`:`插件设计文档`(21 命令表 / 三层分支拓扑图 / R1-R13 风险 / 0.1→0.2 迁移对照表)——SHALL 在文档前部声明「用户门面见根 README」指针;依赖要求(git / gh / glab / Node ≥ 24)SHALL 前置到文档前部,不得埋于末尾章节。
- `CLAUDE.md`:`开发文档`(三层引擎架构、测试约定、speccode 工作流、marketplace 结构)——SHALL 说明根 README 与插件 README 的分工;SHALL 含发布纪律指针(plugin.json version bump 必须同步 CHANGELOG.md);SHALL NOT 硬编码测试用例数量。

#### Scenario: 三层文档各司其职
- **WHEN** 检查仓库根 README.md、plugins/speccode/README.md、CLAUDE.md
- **THEN** 根 README 含 marketplace 描述与插件列表;插件 README 含 21 命令表与三层拓扑图;CLAUDE.md 含引擎三层架构与测试命令,且无对 `.claude/speccode/` 旧路径的引用

#### Scenario: 根 README 用户门面要素齐全
- **WHEN** 检查仓库根 README.md
- **THEN** 含:一句话定位标语、badges、痛点 Why 段、体验 demo(模拟会话代码块或其他可感知形式)、Quickstart 最小闭环、21 命令速览、三层分支拓扑图、对比定位、理念、文档地图、贡献方式、License 节

#### Scenario: 插件 README 门面指针与依赖前置
- **WHEN** 检查 plugins/speccode/README.md
- **THEN** 文档前部(前 5 行内)存在指向根 README 的门面指针;依赖要求(git / gh / glab / Node ≥ 24)出现在文档前部而非末尾章节

#### Scenario: CLAUDE.md 分工与纪律
- **WHEN** 检查 CLAUDE.md
- **THEN** 含两个 README 的分工说明与发布纪律指针(version bump 同步 CHANGELOG);测试约定不硬编码用例数量

#### Scenario: 用户文档与 v2 一致
- **WHEN** 检查 `plugins/speccode/README.md`
- **THEN** 命令表 MUST 为 21 个新命令,拓扑图 MUST 为 trunk/feature/worktree 三层,且 MUST 含 0.1→0.2 迁移对照表,不存在 display / `-complete` 分支的现行行为描述

## ADDED Requirements

### Requirement: 文档版本信息不漂移

仓库文档(根 README、CLAUDE.md 等)SHALL NOT 硬编码随时间漂移的信息——插件版本号(plugin.json `version`)、测试用例数量、命令总数等;需要引用版本时 MUST 以链接指向 CHANGELOG.md 或读自 plugin.json(单一数据源),涉及数量类信息 MUST NOT 写死字面量。

#### Scenario: 根 README 无硬编码版本
- **WHEN** 检索仓库根 README.md 中的 `0.2.x` / `0.1.x` 版本号字面量
- **THEN** 不存在;版本信息以链接(如指向 CHANGELOG.md)形式呈现

#### Scenario: CLAUDE.md 无用例数量字面量
- **WHEN** 检索 CLAUDE.md 中的测试数量字面量(如「137」)
- **THEN** 不存在;测试约定以命令与文件路径表达

### Requirement: 许可证文件

仓库根 SHALL 存在 `LICENSE` 文件,许可证文本 MUST 与 `plugins/speccode/.claude-plugin/plugin.json` 的 `license` 字段声明一致(当前为 MIT);根 README 的 License 节 MUST 链接该文件。

#### Scenario: LICENSE 存在且与声明一致
- **WHEN** 检查仓库根 LICENSE 文件与 plugin.json 的 `license` 字段
- **THEN** LICENSE 存在、内容为 MIT 许可证全文,plugin.json `license` 为 `MIT`

#### Scenario: 根 README 引用 LICENSE
- **WHEN** 检查根 README 的 License 节
- **THEN** 存在指向 `LICENSE` 文件的链接
