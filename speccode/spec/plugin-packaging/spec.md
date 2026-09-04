# plugin-packaging Specification

## Purpose

speccode 作为 Claude Code 插件的打包结构契约——marketplace 仓 + plugin 子目录布局、plugin.json/marketplace.json 字段、命令通过 `bin/` PATH 裸调引擎的引用方式、插件源码与运行时数据 `.speccode/` 的边界、安装与命名空间机制。

## Requirements

### Requirement: Marketplace 仓库结构

speccode 的开发库仓库 SHALL 作为 Claude Code marketplace 仓：仓库根 MUST 含 `.claude-plugin/marketplace.json`，其 `name` 字段为 `speccode-development`，`plugins` 数组 MUST 包含一个条目指向 `./plugins/speccode` 作为 speccode 插件的 source。

#### Scenario: marketplace.json 字段齐全
- **WHEN** 读取仓库根 `.claude-plugin/marketplace.json`
- **THEN** 其 `name` 为 `speccode-development`，`owner` 含 `name`，`plugins[0].name` 为 `speccode`，`plugins[0].source` 为 `./plugins/speccode`

#### Scenario: marketplace 可被本地添加
- **WHEN** 执行 `/plugin marketplace add <仓库根绝对路径>`
- **THEN** Claude Code 成功注册名为 `speccode-development` 的 marketplace，且能枚举出 speccode 插件

### Requirement: 插件根目录布局

speccode 插件根 SHALL 位于仓库的 `plugins/speccode/`，并 MUST 含 `.claude-plugin/plugin.json`（manifest）、`skills/`（skill markdown，`<name>/SKILL.md` 目录式布局）、`bin/speccode.mjs`（CLI 引擎入口）、`lib/`（引擎纯逻辑模块）、`tests/`（单测）。插件根 MUST NOT 把组件放在 `.claude-plugin/` 目录内部，MUST NOT 存在遗留的 `commands/` 目录。

#### Scenario: 插件根目录树
- **WHEN** 列出 `plugins/speccode/` 内容
- **THEN** 存在 `.claude-plugin/plugin.json`、`skills/`、`bin/speccode.mjs`、`lib/`、`tests/`、`README.md`，且 `.claude-plugin/` 下只有 `plugin.json` 一个文件，且不存在 `commands/` 目录

#### Scenario: skill 目录式布局

- **WHEN** 列出 `plugins/speccode/skills/` 内容
- **THEN** 每个 skill 为一个目录，目录内含 `SKILL.md`（如 `skills/exploring/SKILL.md`），不存在扁平 `.md` 文件形态

#### Scenario: 引擎源码随插件搬移后内部 import 不变
- **WHEN** 检查 `plugins/speccode/bin/speccode.mjs` 与 `plugins/speccode/lib/*.mjs` 的 import 语句
- **THEN** 全部为 `node:` 内置模块或 `./`、`../lib/` 相对路径，无对 `.claude/speccode/` 旧路径的引用

### Requirement: plugin.json 元数据

`plugins/speccode/.claude-plugin/plugin.json` SHALL 声明 `name: "speccode"`(提供 `/speccode:` 命名空间)、`version`(MUST 为合法语义化版本,且与根 `CHANGELOG.md` 最新版本小节一致——规格 MUST NOT 把 version 钉死为字面量,否则每次发版必然制造规格漂移)、`description`、`author`(含 `name`)、`license`,并 SHOULD 声明 `homepage`、`repository`、`keywords`(含 `"sdd"`、`"tdd"`、`"hooks"`、`"memory"` 等)。

#### Scenario: plugin.json 必填与推荐字段
- **WHEN** 读取 `plugins/speccode/.claude-plugin/plugin.json`
- **THEN** `name` 为 `speccode`;`version` 匹配 `^\d+\.\d+\.\d+$` 且与 `CHANGELOG.md` 最新版本小节的版本号一致;存在 `description`、`author.name`、`license`;`homepage` 与 `repository` 指向 `speccode-development` 仓库

#### Scenario: 版本号控制更新
- **WHEN** 用户已安装某版本且仓库将 `version` 提升为新版本(如 BREAKING 升级 0.1.0 → 0.2.0)
- **THEN** 用户侧 MUST 触发更新检测;未 bump version 的调试 commit MUST NOT 触发更新

### Requirement: 命令通过 bin/ PATH 裸调引擎

命令正文 SHALL 通过裸调 `speccode.mjs <verb> --cwd .` 引擎（依赖插件 `bin/` 在启用期间被加入 Bash 工具 PATH），而非写死 `node <绝对或相对路径>/speccode.mjs`。`speccode.mjs` MUST 具备 `#!/usr/bin/env node` shebang 与可执行位。stdin 管道写法（`echo '<json>' | speccode.mjs <verb> --json-stdin`）MUST 保持兼容。

#### Scenario: 命令正文裸调形态
- **WHEN** 检查 `plugins/speccode/skills/*/SKILL.md`
- **THEN** 引擎调用写作 `speccode.mjs <verb> --cwd .`，不存在 `node .claude/speccode/bin/speccode.mjs` 或 `node ${CLAUDE_PLUGIN_ROOT}` 形态的引用

#### Scenario: stdin 管道写法兼容
- **WHEN** 命令需写入 config/state
- **THEN** 写作 `echo '<json>' | speccode.mjs <verb> --cwd . --json-stdin`，shebang 负责以 node 执行，管道数据正常进入 stdin

#### Scenario: speccode.mjs 可执行性
- **WHEN** 检查 `plugins/speccode/bin/speccode.mjs` 文件权限与首行
- **THEN** 首行为 `#!/usr/bin/env node`，文件具备可执行位（`+x`）

### Requirement: 插件源码与运行时数据边界

插件源码（`plugins/speccode/`、`.claude-plugin/`、`skills/`、`bin/`、`lib/`）SHALL 被 git 跟踪。speccode 在目标项目产生的运行时数据 `.speccode/`（config + state）SHALL 落在目标项目仓库根（由引擎 `repoRoot` + `speccodeDirOf` 定位），与插件安装位置解耦；引擎 SHALL NOT 把状态写入 `${CLAUDE_PLUGIN_ROOT}` 或 `${CLAUDE_PLUGIN_DATA}`。

#### Scenario: 运行时数据落目标项目根
- **WHEN** 在任意目标项目执行 speccode 命令
- **THEN** `.speccode/config.json` 与 `state/features/*.json` 写入该目标项目的仓库根，与 speccode 插件装在何处无关

#### Scenario: 插件源码不混入运行时数据
- **WHEN** 检查 `plugins/speccode/` 目录
- **THEN** 不含 `.speccode/`、`config.json`、`state/` 等运行时数据；这些只出现在目标项目根

### Requirement: 命令正文手写路径与引擎一致

命令正文里手写的 `.speccode/` 相对路径(`reset` 的 `rm -rf .speccode/state/`、`reset` 询问清理的 `.speccode/memory/` 与 `.speccode/sdd/` 等)SHALL 以 `--cwd` 指向的项目根为基准,与引擎 `speccodeDirOf(cwd)` 解析的目录一致。这保证裸调方案下命令正文的手写路径与引擎写入路径落在同一 `.speccode/` 目录。

#### Scenario: 手写路径与引擎写入路径一致
- **WHEN** 命令正文执行 `rm -rf .speccode/state/`(reset)或引用 `.speccode/memory/`、`.speccode/sdd/`(reset 清理询问、SDD 工作区),且 `--cwd .` 指向目标项目根
- **THEN** 这些手写路径解析到的目录与 `speccode.mjs resolve-speccode-dir --cwd .` 返回的 `speccodeDir` 相同(均为 `<repoRoot>/.speccode`),不会因裸调方式改变基准

#### Scenario: 不出现已删除机制的用例
- **WHEN** 检查本 requirement 的正文与 Scenario
- **THEN** MUST NOT 以 display-reset-to-trunk 命令、`untracked_permanent` 字段或 `.speccode/backup/` 等 v2 已删除的机制作为用例

### Requirement: 命令命名空间

speccode 的全部 slash 命令 SHALL 通过 `plugin.json` 的 `name: "speccode"` 自动获得 `/speccode:` 前缀命名空间,skill markdown 位于 `plugins/speccode/skills/<name>/SKILL.md`(一 skill 一目录,调用名 = 目录名),SHALL NOT 通过 `commands/speccode/` 或 `skills/speccode/` 子目录前缀实现命名空间。

#### Scenario: 安装后命令命名空间
- **WHEN** 用户安装 speccode 插件后列出可用命令
- **THEN** 24 个命令以 `/speccode:` 前缀形式出现:`init`、`exploring`、`creating-feature`、`creating-worktree`、`proposing`、`brainstorming`、`writing-plans`、`applying`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`receiving-code-review`、`verification-before-completion`、`syncing`、`archiving`、`finishing-worktree`、`finishing-feature`、`status`、`reset`、`recording-knowledge`、`distilling-knowledge`

#### Scenario: 旧知识命令名不再出现
- **WHEN** 用户安装含本变更的版本后列出可用命令
- **THEN** `/speccode:memorize`、`/speccode:promote-knowledge` MUST NOT 出现

#### Scenario: 旧命令名不再出现
- **WHEN** 用户安装 0.2.x 后列出可用命令
- **THEN** `/speccode:start`、`/speccode:develop-start`、`/speccode:develop-complete`、`/speccode:finish`、`/speccode:display-merge-trunk`、`/speccode:display-rebase-trunk`、`/speccode:display-reset-to-trunk` MUST NOT 出现

### Requirement: skill frontmatter 契约

`plugins/speccode/skills/<name>/SKILL.md` 的 frontmatter SHALL 只含 `description`(中文,含触发时机语义,同时作为模型自动调用的匹配面);MUST NOT 含 `name`(调用名回落目录名)、`category`、`tags` 等非 commands 时代遗留或非标字段。skill SHALL 保持模型可自动调用(MUST NOT 设 `disable-model-invocation`),用户显式 `/speccode:<name>` 调用语义不变。

#### Scenario: frontmatter 只含 description

- **WHEN** 检查 24 个 `plugins/speccode/skills/<name>/SKILL.md` 的 frontmatter
- **THEN** 每个仅含 `description` 一个字段,无 `name`/`category`/`tags` 残留

#### Scenario: 调用名不变

- **WHEN** 用户显式输入 `/speccode:<name>`(如 `/speccode:exploring`)
- **THEN** 调用目录名为 `<name>` 的 skill,与迁移前 command 的调用名一致

#### Scenario: 模型自动调用可用

- **WHEN** Claude 会话中出现匹配某 skill description 触发时机的任务(如实现功能时匹配 test-driven-development)
- **THEN** 该 skill 可被模型自动调用,且用户显式调用路径不受影响

### Requirement: 测试路径解耦 cwd

`plugins/speccode/tests/` 下的测试 SHALL 通过 `import.meta.url` + `fileURLToPath` 定位 `bin/speccode.mjs` 与 `lib/*.mjs`，SHALL NOT 依赖 `process.cwd()` 定位插件内部文件。这保证测试从任意 cwd 执行均通过。

#### Scenario: cli 测试定位 BIN 不依赖 cwd
- **WHEN** 从非仓库根目录执行 `node --test plugins/speccode/tests/cli.test.mjs`
- **THEN** 测试通过，BIN 路径由 `import.meta.url` 解析为 `tests/../bin/speccode.mjs`，不依赖当前工作目录

#### Scenario: 测试 import 路径更新
- **WHEN** 检查 `plugins/speccode/tests/*.test.mjs` 的 import 语句
- **THEN** 引用 `../lib/*.mjs` 与 `../bin/speccode.mjs`，不存在 `../.claude/speccode/` 旧路径

### Requirement: 文档三层分离

仓库 SHALL 维护三层文档,职责如下:

- 根 `README.md`(英文,`marketplace 用户门面`)与根 `README_CN.md`(简体中文,结构一致):两版 SHALL 各含——一句话定位 + badges(含 license、平台、stars;含**动态版本徽章**:经 shields.io `dynamic/json` 从 raw `plugins/speccode/.claude-plugin/plugin.json` 读取 `$.version`,MUST NOT 硬编码版本字面量;含 **CI 状态徽章**链接 `.github/workflows/test.yml`)+ 痛点(Why,可表为 ✅ 可扫读清单)+ 体验 demo + Quickstart 最小闭环(**前置 Prerequisites 一行**:Node ≥ 24 + 可选 gh/glab)+ 命令速览 + 三层分支拓扑图 + 对比定位(可表为**特性矩阵**:行=能力,列=speccode/superpowers/spec-kit/手工约定)+ 理念 + 文档地图 + 贡献方式(可指向根 `CONTRIBUTING.md`)+ License 节;marketplace 描述与插件列表 MUST 保留;两版 SHALL 在文档前部互相提供语言切换链接;中文版为英文版的全量翻译,结构(段)一一对应。
- `plugins/speccode/README.md`(英文)与 `plugins/speccode/README_CN.md`(简体中文,`插件设计文档`):两版 SHALL 含 24 命令表 / 三层分支拓扑图 / R1-R13 风险 / 0.1→0.2 迁移对照表;两版节号编号 SHALL 一致(§1-14);两版 SHALL 在 §1 之后含 **Table of Contents**(锚点列表,覆盖 §1-14);两版 SHALL 在文档前部声明「用户门面见根 README」指针且指向**对应语言**的根 README;依赖要求(git / gh / glab / Node ≥ 24)SHALL 前置到文档前部;两版 SHALL 在文档前部互相提供语言切换链接。
- `CLAUDE.md`(开发文档):SHALL 说明根 README 与插件 README 的分工(含中英文四文件映射);SHALL 含发布纪律指针(plugin.json version bump 必须同步 CHANGELOG.md);SHALL 含「多语言维护」说明——两版文档 SHALL 结构对齐(段/节为锚),任何内容改动 MUST 同步全部语言版本;SHALL NOT 硬编码测试用例数量。

#### Scenario: 四 README 文件各司其职
- **WHEN** 检查仓库根 README.md、README_CN.md、plugins/speccode/README.md、plugins/speccode/README_CN.md、CLAUDE.md
- **THEN** 根两版含 marketplace 描述与插件列表;插件两版含 24 命令表与三层拓扑图;CLAUDE.md 含引擎三层架构与测试命令,且无对 `.claude/speccode/` 旧路径的引用

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
- **THEN** 两版命令表 MUST 为 24 个命令,拓扑图 MUST 为 trunk/feature/worktree 三层,且 MUST 含 0.1→0.2 迁移对照表,不存在 display / `-complete` 分支的现行行为描述

### Requirement: 仓库层重命名

仓库根目录 SHALL 从 `coding` 改名为 `speccode-development`，与 marketplace name、GitHub 仓库名三层统一。此重命名 SHALL NOT 改变 git 跟踪内容，SHALL NOT 影响插件对外行为；任何写死 `coding` 路径的外部引用（IDE 配置、shell 别名、CI）需由维护者同步更新。

#### Scenario: 三层命名统一
- **WHEN** 确认仓库根目录名、marketplace.json name、GitHub 仓库名
- **THEN** 三者均为 `speccode-development`（插件 name 仍为 `speccode`）

#### Scenario: 重命名不破坏 git
- **WHEN** 根目录从 `coding` 改名为 `speccode-development`
- **THEN** `git status` 与 `git log` 内容不变，git 跟踪的是文件内容而非目录名

### Requirement: 不打包本仓自用工具

本仓(speccode-development)的自用开发工具 SHALL 为 speccode 自身命令集——spec 变更走 `speccode/changes/` 工作流,SHALL NOT 依赖插件自身以外的 spec 管理工具;仓库 `.claude/` 下的任何本仓自用工具(命令、skills)SHALL NOT 打包进 speccode 插件目录。`.claude/settings.local.json` SHALL 只含通配 permission(`Bash(node *)` 已覆盖 `speccode.mjs` 裸调),不得出现指向旧 `.claude/speccode/bin/speccode.mjs` 绝对路径的条目。

#### Scenario: 自用工具不进插件
- **WHEN** 检查 `plugins/speccode/` 与仓库 `.claude/`
- **THEN** 插件目录不含任何本仓自用工具命令与 skills,两者内容无重叠

#### Scenario: settings 清理绝对路径 permission
- **WHEN** 读取 `.claude/settings.local.json`
- **THEN** 不存在指向 `.../coding/.claude/speccode/bin/speccode.mjs` 的绝对路径 permission 条目;保留 `Bash(node *)` 等通配条目

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

### Requirement: references 自包含与品牌中立

`plugins/speccode/references/` 下的辅助资源(脚本、模板、文档)SHALL 自包含:渲染产物 MUST NOT 引用第三方品牌标识(名称、logo、链接),MUST NOT 在运行时请求第三方远程资源(图片、脚本、样式);所需版本号、仓库链接等元数据 MUST 读自 `plugins/speccode/.claude-plugin/plugin.json`,MUST NOT 硬编码(读取失败时的兜底常量除外)或从不存在的路径探测;仓库链接在渲染前 MUST 通过 http/https scheme 校验,非法值 MUST 回退到兜底常量。

#### Scenario: references 无第三方品牌残留
- **WHEN** 对 `plugins/speccode/references/` 全量文本检索 `superpowers|primeradiant|github.com/obra`(大小写不敏感)
- **THEN** 无任何匹配

#### Scenario: 版本与链接读自 plugin.json
- **WHEN** 检查 `visual-companion-scripts/server.cjs` 的元数据读取逻辑
- **THEN** 其 manifest 路径解析为 `plugins/speccode/.claude-plugin/plugin.json`(相对脚本文件上溯两级),且页脚品牌条不含 `<img>` 远程图片引用

#### Scenario: visual companion 页脚渲染真实版本
- **WHEN** 启动 visual-companion server 并请求其等待页(需先带 ?key= 取 cookie、再携 cookie 请求;直接 curl ?key= 只会得到 bootstrap 跳转页)
- **THEN** 页脚含 `speccode v` + 当前 plugin.json 的 version 值(非 `unknown`),链接指向 plugin.json 的 homepage,页面 HTML 不含任何第三方远程资源 URL

#### Scenario: homepage 非 http(s) 回退
- **WHEN** plugin.json 的 `homepage` 为非 http/https scheme(如 `javascript:...`)、非字符串或缺失
- **THEN** visual companion 页脚链接 MUST 回退到兜底默认仓库 URL,MUST NOT 渲染该非法值

### Requirement: 文档版本信息不漂移

仓库文档(根 README.md、根 README_CN.md、CLAUDE.md 等,含全部语言版本)SHALL NOT 硬编码随时间漂移的信息——插件版本号(plugin.json `version`)、测试用例数量、命令总数等;需要引用版本时 MUST 以链接指向 CHANGELOG.md 或读自 plugin.json(单一数据源),涉及数量类信息 MUST NOT 写死字面量。

#### Scenario: 根 README 两版均无硬编码版本
- **WHEN** 检索仓库根 README.md 与 README_CN.md 中的 `0.2.x` / `0.1.x` 版本号字面量
- **THEN** 两版均不存在;版本信息以链接(如指向 CHANGELOG.md)形式呈现

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

### Requirement: 持续集成测试

仓库 SHALL 含 `.github/workflows/test.yml`,在 `push` 与 `pull_request` 事件触发时运行 `node --test ./plugins/speccode/tests/*.test.mjs`(glob 形式,避免 Node v24 `MODULE_NOT_FOUND`),MUST NOT 引入 lint 或 build 步骤(测试 ≠ build,不破坏 CLAUDE.md「无 lint/build 步骤」纪律)。根 README(EN/zh)badges 段 SHALL 含指向该 workflow 的 CI 状态徽章。

#### Scenario: CI workflow 存在且仅跑测试
- **WHEN** 检查 `.github/workflows/test.yml`
- **THEN** 触发为 `push` 与 `pull_request`;步骤为 `node --test ./plugins/speccode/tests/*.test.mjs`;不含 lint/build 步骤

#### Scenario: 根 README 含 CI 徽章
- **WHEN** 检查根 README.md 与 README_CN.md badges 段
- **THEN** 含指向 `workflows/test.yml` 的 GitHub Actions 状态徽章

### Requirement: 社区贡献文件

仓库根 SHALL 含 `CONTRIBUTING.md`(说明 dogfood 贡献流程:exploring → creating-worktree → proposing → 实现(applying 或 writing-plans → executing-plans / subagent-driven-development)→ requesting-code-review → syncing → archiving → finishing-worktree,以及 clone 后 `bash support/install-skills.sh` 安装开发 skill);`.github/` SHALL 含 Issue 模板(`.github/ISSUE_TEMPLATE/`)与 `pull_request_template.md`。根 README 的贡献段 SHALL 链接 `CONTRIBUTING.md`。

#### Scenario: 社区文件存在
- **WHEN** 检查仓库根与 `.github/`
- **THEN** 根含 `CONTRIBUTING.md`;`.github/` 含 Issue 模板目录与 `pull_request_template.md`

#### Scenario: 根 README 贡献段指向 CONTRIBUTING
- **WHEN** 检查根 README.md 与 README_CN.md 贡献段
- **THEN** 含指向 `CONTRIBUTING.md` 的链接
