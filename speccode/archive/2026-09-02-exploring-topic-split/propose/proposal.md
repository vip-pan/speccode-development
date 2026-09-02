# Proposal: exploring-topic-split

## Why

`_exploring.md` 是单堆文件:多个需求交错探索时(如跨 session 的大需求探索中穿插小需求探索),结论顺序堆叠、无归属标记,creating-feature 承接时全量迁移+清空,导致错误归属(小需求 memory 混入大需求结论、type 推断被污染)与结论静默丢失(被吞进错误 feature 后清空,且 memory 为 untracked 运行时数据,无恢复手段)。

## What Changes

- 探索记忆按 topic 分文件:键形式 `_exploring/<topic>`,落盘 `.speccode/memory/_exploring__<topic>.md`(复用 `branchToStateName` 编码,`memoryPath` 零改动);扁平命名,不做目录分层
- read-memory / write-memory 的 branch 校验放宽:新增接受 `_exploring/<topic>`(topic 经 `validateSlug`),收口为 lib 函数 `validateMemoryBranch`
- 新增 `list-memory` verb + lib `listMemory`:列出既有 `_exploring` topic 键(防同名碎片化的选择交互与 creating-feature 未直给流程共用)
- 新增 `rename-memory` verb + lib `renameMemory`:原子 rename 承接(`_exploring__<topic>.md` → `<type>__<slug>.md`),目标已存在时拒绝并报告,不覆盖不合并
- `exploring.md` 出口:append 前列既有 topic 清单,用户选既有或新建;无归属时写入 `_exploring/<topic>` 而非单堆 `_exploring`
- `creating-feature.md`:不加新参数,slug=topic 命名约定承接;type 推断来源从单文件 `_exploring.md` 改为所选 topic 文件;迁移由「读全量 merge 进骨架 + 清空」改为原子 rename;清空步骤删除
- 遗留 `_exploring.md` 无代码级兼容路径(运行时 untracked 数据),CHANGELOG 注明手工处理方式
- 主规格 delta:`session-memory`(3 条 MODIFIED)与 `git-workflow-lifecycle`(1 条 MODIFIED),随 syncing 合并

## Capabilities

- session-memory(修改)
- git-workflow-lifecycle(修改)

## Impact

- **代码**:`plugins/speccode/lib/memory.mjs`(validateMemoryBranch / listMemory / renameMemory)、`plugins/speccode/bin/speccode.mjs`(read/write-memory 校验替换 + 2 个新 verb)
- **命令**:`plugins/speccode/commands/exploring.md`、`plugins/speccode/commands/creating-feature.md`
- **测试**:`plugins/speccode/tests/memory.test.mjs`、`plugins/speccode/tests/cli.test.mjs`(既有 `_exploring` 用例语义扩展 + 新增用例)
- **文档**:`plugins/speccode/README.md` / `README_CN.md`(memory 目录结构与 trunk 级例外说明,中英同步);CHANGELOG 在发版时更新
- **运行时数据**:用户仓遗留 `_exploring.md` 需手工处理(CHANGELOG 说明);本仓自身已清空,无残留
- **规格**:`speccode/spec/session-memory/spec.md`、`speccode/spec/git-workflow-lifecycle/spec.md`(经 syncing,不直接修改)
