# Design: type-inference-source

## Context

2026-08-11 探索(结论经用户确认,已承接进本 feature memory):creating-feature 在 trunk 运行的时刻,`speccode/changes/` 从不存在——信号源时序错位。真正存在于该时刻的信号是命令参数与 `_exploring.md`(exploring 的 trunk 级记忆)。勘探确认:扫描逻辑仅存于命令 prose(无 lib、无测试钉住);`_exploring` 哨兵有引擎支持;session-memory 的承接-清空契约不受影响;第二轮 design.md 已把本改进推迟到「另起 change」,本 change 兑现之。

## Goals

- type 推断在所依赖信号真实存在的前提下生效
- 推断来源顺序进入主规格,未来漂移有契约可守
- 推断永不静默生效(用户确认护栏)

## Non-Goals

- 不动 lib/ 引擎与测试(134 用例保持绿)
- 不动 session-memory 规格(承接-清空契约未变,推断仅多一次提前读)
- 不发版(随后续 0.2.2 评估)
- 不顺带改其他 Minor 候选(orphan 虚警、memory 换行等)

## Decisions

- **方案 D(用户选定)**:判定顺序 = 参数直给 > `_exploring` 推断 > 裸询问;删除 changes/ 扫描。被否备选:A 只换源到 _exploring(args 直给仍多问一次);B 只吃 args(exploring 成果闲置);C 删推断永远询问(丢探索衔接便利)
- **确认形式(用户选定)**:AskUserQuestion 预置推荐项。被否备选:展示推断问"对吗"(多一轮自由文本)
- **规格钉桩**:「功能分支命名规则」正文加推断顺序 + 禁扫 changes/ 句;scenario 增「_exploring 推断需确认」「无信号时直接询问」两条,「合法分支名」scenario 的 WHEN 措辞对齐(推断→确定并确认)
- **复用注记**:「创建」第 4 步注明推断阶段已读 _exploring 可复用,避免读者困惑于两次读取

## Risks

- 启发式误判(探索文本含"修复"却非 bugfix)→ 护栏:推荐项预置 + 用户确认,不静默
- `_exploring` 残留上一话题 → 同一护栏覆盖;承接后清空,残留窗口限一个 feature
- 命令步骤重编号(3→4)→ 勘探确认无其他文件引用这些步号

## Open Questions

无。
