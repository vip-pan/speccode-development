---
tier: 1
---

# Proposal: spec-count-23(plugin-packaging 陈旧计数清理)

## Why

PR #43 的 review 发现 plugin-packaging spec 有 5 处「23」陈旧计数(applying 加入后未同步),其中 :143 是规范性 scenario——「两版命令表 MUST 为 23 个新命令」当前已被真实的 24 行 README 命令表违反,活的主规格与门面互相矛盾。pitfalls 知识(「版本漂移」条)早已预言此类碰撞,处置即去数字化。

## What Changes

- `speccode/spec/plugin-packaging/spec.md` 5 处:
  - `:87` 命令命名空间正文「23 个 slash 命令」→「全部 slash 命令」(去数字化,免每次加命令再破)
  - `:91` scenario 枚举补 `applying`(writing-plans 之后),「23 个命令」→「24 个命令」
  - `:118`、`:123`、`:143`「23 命令表」→「24 命令表」(指 README 命令表行数,事实计数)
- `speccode/knowledge/development/architecture.md:38` 与 `pitfalls.md:47`:「21 个命令文档」→「24 个命令文档」(知识集刷新,同一变更内完成,避免再开 chore)

## Capabilities

(无——空 delta:plugin-packaging 计数勘误属既有 requirement 的枚举/计数修正,无语义变更。)

## Impact

- speccode/spec/plugin-packaging/spec.md(5 处一行改)+ knowledge ×2(各一处)
- 引擎零改动;无 BREAKING
