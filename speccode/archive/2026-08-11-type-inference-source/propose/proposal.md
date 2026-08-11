# Proposal: type-inference-source

## Why

`creating-feature` 的 type 推断扫描 `speccode/changes/`,但该目录在 trunk 永不存在(proposing 在 worktree 才创建、archiving 合并前移走)——扫描是死代码(v0.1 扫 openspec/changes/ 时代的遗留漂移),推断从未生效过一次。主规格只约束命名格式、未钉推断来源,使此类漂移无契约可守。

## What Changes

- `creating-feature.md`「决定分支名」重写:type/slug 判定顺序 = ① 命令参数直给 `<type>/<slug>`(校验即用)→ ② `_exploring.md` 非空则推断 type → ③ 裸 AskUserQuestion;删除 changes/ 扫描;推断结果预置为推荐项、经用户确认才生效(不静默)
- 「创建」第 4 步加复用注记(推断阶段已读 _exploring 的复用结果)
- spec delta:git-workflow-lifecycle「功能分支命名规则」MODIFIED——推断来源顺序与「禁止扫描 changes/」钉进契约,新增 2 个 scenario
- 无 BREAKING(命令行为向更有用方向修正;无参数/返回值变化)

## Capabilities

- modified: `git-workflow-lifecycle`

## Impact

- 代码:`plugins/speccode/commands/creating-feature.md`(命令 prose;lib 引擎不动)
- 文档:`speccode/spec/git-workflow-lifecycle/spec.md`(经 syncing 合并)
- 行为:用户跑过 `/speccode:exploring` 后建分支,type 推断首次真正生效;命令参数直给分支名时少一次提问
