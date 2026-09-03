---
tier: 1
---

# Proposal: tier1-facade-counts(门面计数对齐)

## Why

dev-flow-tiering 终审遗留两个门面计数漂移:根 README 写「9 capabilities」但 spec/ 实际 11 个目录;git-workflow-lifecycle 命令清单计 22 个命令,而门面与 CLAUDE.md 均计 24——差值为 knowledge 两命令(distilling-knowledge / recording-knowledge,定义在 knowledge-set capability,未列入命令清单)。数字不一致会让读者对单一真源失去信任。

## What Changes

- 根 `README.md:102` 与 `README_CN.md:102`:「9 capabilities / 9 个 capability」→「11 capabilities / 11 个 capability」(双语同步)
- `speccode/spec/git-workflow-lifecycle/spec.md`「命令清单」requirement:枚举补入 `distilling-knowledge`、`recording-knowledge`(置于 archiving 之后、finishing-worktree 之前,与命令表分组语义一致),计数 22→24,scenario 同步;补一句归属说明:两命令的行为契约在 knowledge-set capability 定义,此处仅登记清单身份
- 主规格改动经 syncing 合并(spec 侧唯一实质变更,非 delta 而是主规格直修——**注**:本次为轻档无 delta,spec 修正直接落主规格,syncing 对空 delta 幂等无操作,archiving 前 sync 状态评估按「无 delta 已同步」处理;命令清单修正本身随 PR 上 trunk)

## Capabilities

(无——空 delta:capability 语义无变更。git-workflow-lifecycle 的命令清单登记修正属既有 requirement 的枚举勘误,非语义 delta。)

## Impact

- 根 README ×2(一行文案);speccode/spec/git-workflow-lifecycle/spec.md(命令清单 requirement + scenario);CLAUDE.md 无需动(已是 24)
- 引擎 lib/bin/tests/hooks 零改动;无 BREAKING
