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

speccode 插件根 SHALL 位于仓库的 `plugins/speccode/`，并 MUST 含 `.claude-plugin/plugin.json`（manifest）、`commands/`（slash 命令 markdown）、`bin/speccode.mjs`（CLI 引擎入口）、`lib/`（引擎纯逻辑模块）、`tests/`（单测）。插件根 MUST NOT 把组件放在 `.claude-plugin/` 目录内部。

#### Scenario: 插件根目录树
- **WHEN** 列出 `plugins/speccode/` 内容
- **THEN** 存在 `.claude-plugin/plugin.json`、`commands/`、`bin/speccode.mjs`、`lib/`、`tests/`、`README.md`，且 `.claude-plugin/` 下只有 `plugin.json` 一个文件

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
- **WHEN** 检查 `plugins/speccode/commands/*.md`
- **THEN** 引擎调用写作 `speccode.mjs <verb> --cwd .`，不存在 `node .claude/speccode/bin/speccode.mjs` 或 `node ${CLAUDE_PLUGIN_ROOT}` 形态的引用

#### Scenario: stdin 管道写法兼容
- **WHEN** 命令需写入 config/state
- **THEN** 写作 `echo '<json>' | speccode.mjs <verb> --cwd . --json-stdin`，shebang 负责以 node 执行，管道数据正常进入 stdin

#### Scenario: speccode.mjs 可执行性
- **WHEN** 检查 `plugins/speccode/bin/speccode.mjs` 文件权限与首行
- **THEN** 首行为 `#!/usr/bin/env node`，文件具备可执行位（`+x`）

### Requirement: 插件源码与运行时数据边界

插件源码（`plugins/speccode/`、`.claude-plugin/`、`commands/`、`bin/`、`lib/`）SHALL 被 git 跟踪。speccode 在目标项目产生的运行时数据 `.speccode/`（config + state）SHALL 落在目标项目仓库根（由引擎 `repoRoot` + `speccodeDirOf` 定位），与插件安装位置解耦；引擎 SHALL NOT 把状态写入 `${CLAUDE_PLUGIN_ROOT}` 或 `${CLAUDE_PLUGIN_DATA}`。

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

speccode 的 21 个 slash 命令 SHALL 通过 `plugin.json` 的 `name: "speccode"` 自动获得 `/speccode:` 前缀命名空间,命令 markdown 位于 `plugins/speccode/commands/`(扁平 `.md`),SHALL NOT 通过 `commands/speccode/` 子目录前缀实现命名空间。

#### Scenario: 安装后命令命名空间
- **WHEN** 用户安装 speccode 插件后列出可用命令
- **THEN** 21 个命令以 `/speccode:` 前缀形式出现:`init`、`exploring`、`creating-feature`、`creating-worktree`、`proposing`、`brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`receiving-code-review`、`verification-before-completion`、`syncing`、`archiving`、`finishing-worktree`、`finishing-feature`、`status`、`reset`

#### Scenario: 旧命令名不再出现
- **WHEN** 用户安装 0.2.x 后列出可用命令
- **THEN** `/speccode:start`、`/speccode:develop-start`、`/speccode:develop-complete`、`/speccode:finish`、`/speccode:display-merge-trunk`、`/speccode:display-rebase-trunk`、`/speccode:display-reset-to-trunk` MUST NOT 出现

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

仓库 SHALL 维护根目录 `CHANGELOG.md`(全中文条目,Keep a Changelog 骨架:`Added`/`Changed`/`Fixed`/`Removed` 分组、语义化版本小节、版本间比较链接)。任何 bump `plugins/speccode/.claude-plugin/plugin.json` `version` 的提交 MUST 在同一提交(或同一 PR)中同步更新 `CHANGELOG.md` 对应版本小节;未完成 CHANGELOG 更新的 version bump MUST NOT 合入 trunk。每次发版 MUST 在主干打 `v<version>` 形式的 git tag 并创建对应 GitHub Release,release notes SHOULD 摘自 `CHANGELOG.md` 该版本小节。GitHub Release 是给人看的发布标记,插件更新检测实际由 marketplace git 拉取 + `plugin.json` version 比对触发(见「plugin.json 元数据」),Release 本身 MUST NOT 被当作更新机制的一部分。

#### Scenario: version bump 与 CHANGELOG 同步
- **WHEN** 一个提交将 `plugin.json` 的 `version` 从 `x.y.z` 提升到新版本
- **THEN** 同一提交(或同一 PR)中根 `CHANGELOG.md` 存在以 `## [<新版本>] - <YYYY-MM-DD>` 开头的小节,且条目为中文、按 Keep a Changelog 分组

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
