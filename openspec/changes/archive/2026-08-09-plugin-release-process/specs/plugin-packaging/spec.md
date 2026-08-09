# Delta: plugin-packaging

## ADDED Requirements

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
