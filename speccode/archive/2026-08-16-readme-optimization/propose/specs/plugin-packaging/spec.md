# plugin-packaging delta: README 更新与优化

## MODIFIED Requirements

### Requirement: 文档三层分离

仓库 SHALL 维护三层文档,职责如下:

- 根 `README.md`(英文,`marketplace 用户门面`)与根 `README_CN.md`(简体中文,结构一致):两版 SHALL 各含——一句话定位 + badges(含 license、平台、stars;含**动态版本徽章**:经 shields.io `dynamic/json` 从 raw `plugins/speccode/.claude-plugin/plugin.json` 读取 `$.version`,MUST NOT 硬编码版本字面量;含 **CI 状态徽章**链接 `.github/workflows/test.yml`)+ 痛点(Why,可表为 ✅ 可扫读清单)+ 体验 demo + Quickstart 最小闭环(**前置 Prerequisites 一行**:Node ≥ 24 + 可选 gh/glab)+ 命令速览 + 三层分支拓扑图 + 对比定位(可表为**特性矩阵**:行=能力,列=speccode/superpowers/spec-kit/手工约定)+ 理念 + 文档地图 + 贡献方式(可指向根 `CONTRIBUTING.md`)+ License 节;marketplace 描述与插件列表 MUST 保留;两版 SHALL 在文档前部互相提供语言切换链接;中文版为英文版的全量翻译,结构(段)一一对应。
- `plugins/speccode/README.md`(英文)与 `plugins/speccode/README_CN.md`(简体中文,`插件设计文档`):两版 SHALL 含 23 命令表 / 三层分支拓扑图 / R1-R13 风险 / 0.1→0.2 迁移对照表;两版节号编号 SHALL 一致(§1-14);两版 SHALL 在 §1 之后含 **Table of Contents**(锚点列表,覆盖 §1-14);两版 SHALL 在文档前部声明「用户门面见根 README」指针且指向**对应语言**的根 README;依赖要求(git / gh / glab / Node ≥ 24)SHALL 前置到文档前部;两版 SHALL 在文档前部互相提供语言切换链接。
- `CLAUDE.md`(开发文档):SHALL 说明根 README 与插件 README 的分工(含中英文四文件映射);SHALL 含发布纪律指针(plugin.json version bump 必须同步 CHANGELOG.md);SHALL 含「多语言维护」说明——两版文档 SHALL 结构对齐(段/节为锚),任何内容改动 MUST 同步全部语言版本;SHALL NOT 硬编码测试用例数量。

#### Scenario: 四 README 文件各司其职
- **WHEN** 检查仓库根 README.md、README_CN.md、plugins/speccode/README.md、plugins/speccode/README_CN.md、CLAUDE.md
- **THEN** 根两版含 marketplace 描述与插件列表;插件两版含 23 命令表与三层拓扑图;CLAUDE.md 含引擎三层架构与测试命令,且无对 `.claude/speccode/` 旧路径的引用

#### Scenario: 根 README 两版门面要素齐全且结构一致
- **WHEN** 检查仓库根 README.md 与 README_CN.md
- **THEN** 两版均含:一句话定位标语、badges(含动态版本徽章与 CI 状态徽章)、痛点 Why 段、体验 demo、Quickstart 最小闭环(前置 Prerequisites)、命令速览、三层分支拓扑图、对比定位、理念、文档地图、贡献方式、License 节;两版段落一一对应(中文版为英文版全量翻译)

#### Scenario: 插件 README 两版门面指针、依赖前置与 ToC
- **WHEN** 检查 plugins/speccode/README.md 与 plugins/speccode/README_CN.md
- **THEN** 两版文档前部(前 5 行内)存在指向**对应语言**根 README 的门面指针;依赖要求出现在文档前部而非末尾章节;两版节号编号一致(§1-14);两版含 Table of Contents(§1-14 锚点列表)

#### Scenario: 动态版本徽章不硬编码
- **WHEN** 检索根 README.md 与 README_CN.md 的徽章段
- **THEN** 版本徽章为 shields.io `dynamic/json` 形态(从 raw plugin.json 读 `$.version`),MUST NOT 出现硬编码版本号字面量(如 `0.2.5`)

#### Scenario: CLAUDE.md 分工、纪律与多语言维护
- **WHEN** 检查 CLAUDE.md
- **THEN** 含四 README 文件分工说明、发布纪律指针(version bump 同步 CHANGELOG)、多语言维护说明(结构对齐为锚、改动同步全部语言版本);测试约定不硬编码用例数量

#### Scenario: 用户文档与 v2 一致
- **WHEN** 检查 `plugins/speccode/README.md` 与 `plugins/speccode/README_CN.md`
- **THEN** 两版命令表 MUST 为 23 个新命令,拓扑图 MUST 为 trunk/feature/worktree 三层,且 MUST 含 0.1→0.2 迁移对照表,不存在 display / `-complete` 分支的现行行为描述

### Requirement: 版本发布纪律

仓库 SHALL 维护根目录 `CHANGELOG.md`(中文条目为主体,Keep a Changelog 骨架:`Added`/`Changed`/`Fixed`/`Removed` 分组、语义化版本小节、版本间比较链接);每个版本小节顶部 SHOULD 含**英文 highlights 块**(一句话摘要该版本核心变更,面向英文 README 读者),中文条目仍为主体。任何 bump `plugins/speccode/.claude-plugin/plugin.json` `version` 的提交 MUST 在同一提交(或同一 PR)中同步更新 `CHANGELOG.md` 对应版本小节;未完成 CHANGELOG 更新的 version bump MUST NOT 合入 trunk。每次发版 MUST 在主干打 `v<version>` 形式的 git tag 并创建对应 GitHub Release,release notes SHOULD 摘自 `CHANGELOG.md` 该版本小节。GitHub Release 是给人看的发布标记,插件更新检测实际由 marketplace git 拉取 + `plugin.json` version 比对触发(见「plugin.json 元数据」),Release 本身 MUST NOT 被当作更新机制的一部分。

#### Scenario: version bump 与 CHANGELOG 同步
- **WHEN** 一个提交将 `plugin.json` 的 `version` 从 `x.y.z` 提升到新版本
- **THEN** 同一提交(或同一 PR)中根 `CHANGELOG.md` 存在以 `## [<新版本>] - <YYYY-MM-DD>` 开头的小节,且条目为中文、按 Keep a Changelog 分组,顶部含英文 highlights 块

#### Scenario: 发版形态
- **WHEN** 维护者发布版本 `x.y.z`
- **THEN** 主干上存在 `vx.y.z` 标签,且 GitHub 上存在同名 Release,其 notes 与 `CHANGELOG.md` 该版本小节一致或为其摘录

#### Scenario: Release 不替代更新检测
- **WHEN** 审计插件更新机制的文档与 spec
- **THEN** 更新触发条件仅表述为「marketplace 仓库 git 拉取后 `plugin.json` version 变化」,任何文档 MUST NOT 声称 GitHub Release/tag 会触发用户侧自动更新

## ADDED Requirements

### Requirement: 持续集成测试

仓库 SHALL 含 `.github/workflows/test.yml`,在 `push` 与 `pull_request` 事件触发时运行 `node --test ./plugins/speccode/tests/*.test.mjs`(glob 形式,避免 Node v24 `MODULE_NOT_FOUND`),MUST NOT 引入 lint 或 build 步骤(测试 ≠ build,不破坏 CLAUDE.md「无 lint/build 步骤」纪律)。根 README(EN/zh)badges 段 SHALL 含指向该 workflow 的 CI 状态徽章。

#### Scenario: CI workflow 存在且仅跑测试
- **WHEN** 检查 `.github/workflows/test.yml`
- **THEN** 触发为 `push` 与 `pull_request`;步骤为 `node --test ./plugins/speccode/tests/*.test.mjs`;不含 lint/build 步骤

#### Scenario: 根 README 含 CI 徽章
- **WHEN** 检查根 README.md 与 README_CN.md badges 段
- **THEN** 含指向 `workflows/test.yml` 的 GitHub Actions 状态徽章

### Requirement: 社区贡献文件

仓库根 SHALL 含 `CONTRIBUTING.md`(说明 dogfood 贡献流程:exploring → creating-feature → … → finishing-feature,以及 clone 后 `bash scripts/install-skills.sh` 安装开发 skill);`.github/` SHALL 含 Issue 模板(`.github/ISSUE_TEMPLATE/`)与 `pull_request_template.md`。根 README 的贡献段 SHALL 链接 `CONTRIBUTING.md`。

#### Scenario: 社区文件存在
- **WHEN** 检查仓库根与 `.github/`
- **THEN** 根含 `CONTRIBUTING.md`;`.github/` 含 Issue 模板目录与 `pull_request_template.md`

#### Scenario: 根 README 贡献段指向 CONTRIBUTING
- **WHEN** 检查根 README.md 与 README_CN.md 贡献段
- **THEN** 含指向 `CONTRIBUTING.md` 的链接
