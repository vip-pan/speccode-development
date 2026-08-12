# plugin-release-process 脑暴记录

- **日期**:2026-08-09
- **参与者**:用户 + Claude(explore 模式)
- **落地 change**:`openspec/changes/plugin-release-process/`

## 背景

speccode v2 全量完成、plugin.json 已 bump 0.2.0 并推送 GitHub 后,发布侧一片空白:无 CHANGELOG、无 git tag、无 GitHub Release、无升级指引,也没有纪律约束「bump version 必须同步记录变更」。本次脑暴围绕三个议题展开:① CHANGELOG 记什么/放哪/什么格式;② 用户如何从 0.1 升到 0.2(升级路径文档);③ GitHub Release 的形态及与 marketplace 更新机制的关系。

## 方法

explore 模式下先核查现状事实(plugin.json version、marketplace.json 对齐情况、无 CHANGELOG/Release、README 已有「从 0.1 迁移」对照表、`plugin-packaging` spec 已有「版本号控制更新」契约),再对每个议题列出关键分叉点与倾向,最后以四个澄清问题收口。

## 发现与决策

1. **CHANGELOG 语言与格式**:全中文 + Keep a Changelog 骨架(Added/Changed/Fixed/Removed 分组、semver 比较链接)。位置在**仓库根** `CHANGELOG.md`(本仓是「marketplace 仓 + 单插件」结构,根目录更符合惯例);根 README 与 `plugins/speccode/README.md` 各加一行链接。回填 0.1.0(2026-07-14,首个可用版)与 0.2.0(2026-08-09,v2 全量)两节,内容从归档 openspec change 与 git log 提炼。
2. **Release 起点**:只发 v0.2.0,不补 0.1.0 历史 tag(CHANGELOG 中 0.1.0 链接指向 0.1.0 版 commit `99797ad`,避免 404)。
3. **发布纪律**:把「bump `plugin.json` version 的提交 MUST 同步更新根 `CHANGELOG.md`;发版 MUST 打 `v<version>` tag 并建 GitHub Release」作为一条新 requirement(「版本发布纪律」)写进 `plugin-packaging` spec,走一个小 change(即本 change),防止长期漂移。同时明确「Release 是给人看的标记,更新检测实际走 marketplace git 拉取 + version 比对,Release 不触发任何自动更新」。
4. **升级指引载体**:放 `plugins/speccode/README.md` 已有「从 0.1 迁移」节的扩充版(用户侧动作链 + 5 条注意事项),不开独立 UPGRADE.md——现在只有 0.1→0.2 一次迁移,YAGNI;等第二次 BREAKING 出现再考虑独立文档。

## 处置结果

- 按「一个小 change」执行:`openspec/changes/plugin-release-process/`(proposal + plugin-packaging delta + tasks)。
- 文档落地:根 `CHANGELOG.md`(回填 0.1.0/0.2.0)、根 `README.md` 与插件 README 加链接、插件 README 第 11 节扩充为完整升级指引。
- 发版:`git tag v0.2.0` + `gh release create`(notes 摘自 CHANGELOG 0.2.0 节),经用户确认后执行。
