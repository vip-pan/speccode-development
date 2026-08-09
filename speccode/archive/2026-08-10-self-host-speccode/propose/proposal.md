# Proposal: self-host-speccode

## Why

本仓目前用 OpenSpec(opsx 命令 + openspec skills + openspec/ 目录)与 superpowers(脑暴强制节 + docs/superpowers/)管理自身开发;speccode v0.2.0 已把二者能力自包含收编(21 命令 + speccode/ delta 模型),继续依赖外部工具违背「目标项目零外部依赖」的设计定位,也无法 dogfood。

## What Changes

- `openspec/specs/` 8 个 capability 主规格原样迁入 `speccode/spec/`;`openspec/changes/archive/` 4 个归档迁入 `speccode/archive/`;删除 `openspec/` 目录与 config.yaml
- plugin-packaging 主规格 2 条 requirement 经 delta 修正:「文档三层分离」「不打包本仓自用工具」(去除 OpenSpec 作为现行工具的描述)
- CLAUDE.md:「OpenSpec 工作流」节改为「speccode 工作流」,删除「Brainstorm 文档落地(强制)」节,引言路径更新
- 根 README.md、plugin.json keywords、creating-feature.md type 推断扫描路径清除 openspec/superpowers 现行引用
- 初始化 `.speccode/config.json`(untracked),本仓后续开发全部由 speccode 自托管
- 无 BREAKING(插件对外行为不变;creating-feature.md 扫描路径修正属 v2 命令文档的内部修正)

## Capabilities

- modified: `plugin-packaging`

## Impact

- 代码:`plugins/speccode/commands/creating-feature.md`、`plugins/speccode/.claude-plugin/plugin.json`(文档/元数据级,无 lib 逻辑改动)
- 文档:`CLAUDE.md`、`README.md`、`speccode/spec/`(迁入)、`speccode/archive/`(迁入)
- 仓库结构:删除 `openspec/`;本地 untracked 清理 `.claude/commands/opsx/`、`.claude/skills/openspec-*`(合并后进行)
