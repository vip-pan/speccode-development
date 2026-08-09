# Proposal: plugin-release-process

## Why

speccode 已到 0.2.0(`plugin.json` version 已 bump、main 已推送 GitHub),但发布侧一片空白:仓库无 CHANGELOG、无 git tag、无 GitHub Release、无升级指引,也无任何纪律保证下次 bump version 时同步记录变更。`plugin-packaging` spec 已确立「版本号控制更新检测」契约(只有 bump version 才触发用户侧更新),但「bump 时必须同步更新 CHANGELOG」没有 spec 锚点,长期必然漂移。

## What Changes

- **新增发布纪律 requirement(spec)** — `plugin-packaging` 增加「版本发布纪律」:bump `plugin.json` version 的提交 MUST 同步更新根 `CHANGELOG.md` 对应版本小节(全中文 + Keep a Changelog 骨架);发版 MUST 打 `v<version>` tag 并创建 GitHub Release。
- **落地根 `CHANGELOG.md`** — 全中文 + Keep a Changelog 骨架,回填 `0.1.0`(2026-07-14,首个可用版,10 命令四层拓扑)与 `0.2.0`(2026-08-09,v2 全量:三层拓扑收敛、21 命令、SDD 方法论、hooks/memory;含 BREAKING 标注)。
- **升级指引** — `plugins/speccode/README.md`「从 0.1 迁移」节扩充为完整升级指引(用户侧动作链 + 5 条迁移注意事项);根 `README.md` 与插件 README 各加一行 CHANGELOG 链接。
- **发 v0.2.0** — `git tag v0.2.0` + `gh release create`(notes 摘自 CHANGELOG);不补 0.1.0 历史 tag。

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `plugin-packaging`: 新增「版本发布纪律」requirement(CHANGELOG 同步 + tag/release 发版形态)。

## Impact

- **文档**:新建根 `CHANGELOG.md`;编辑根 `README.md`、`plugins/speccode/README.md`;新建 `docs/superpowers/specs/2026-08-09-plugin-release-process-brainstorm.md`(脑暴落地,CLAUDE.md 强制)。
- **specs**:`openspec/specs/plugin-packaging/spec.md` sync 后多一条 requirement(11 → 12)。
- **代码**:零改动(纯文档 + spec 变更);134 测试用例不受影响。
- **发布物**:`v0.2.0` tag + GitHub Release(执行前需用户确认)。
