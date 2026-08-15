# sdd-document-lifecycle Delta

## ADDED Requirements

### Requirement: plan 执行进度勾选

`executing-plans` 与 `subagent-driven-development` SHALL 在每个 task 完成点(审查通过、ledger 写 complete 行之后)调用 `tick-task` verb 把 plan 文档(`speccode/changes/<slug>/plan/*.md`)中该 Task N 下所有 `- [ ]` step checkbox 勾选为 `- [x]`;勾选 MUST 经引擎 verb 下沉,命令层 MUST NOT 用 sed/awk 在 prose 内直接改 plan。verb 输出 `ticked` 非空时命令 MUST 随同簿记点 commit(`docs(speccode): tick task <N>`);`ticked` 为空(幂等重跑,plan 未被改写)时 MUST 跳过 commit,MUST NOT 硬跑 `git commit` 让 "nothing to commit" 以非零退出误报失败。勾选 commit MUST 落在审查通过之后,不进入 `review-package` 的 base..head diff;ledger(`progress.md`)MUST 保持为崩溃恢复的唯一权威,plan checkbox 仅作完成态的派生视图,MUST NOT 参与恢复判断。

#### Scenario: task 完成点勾选并 commit

- **WHEN** subagent-driven-development 某任务审查干净、ledger 写入 `Task <N>: complete` 行
- **THEN** 命令 MUST 调用 `tick-task --task <N>` 勾选 plan 中 Task N 的 step checkbox,并在 `ticked` 非空时 commit `docs(speccode): tick task <N>`

#### Scenario: 幂等重跑跳过 commit

- **WHEN** 恢复后对已勾选完的 Task N 重跑 `tick-task`,输出 `ticked` 为空、`already` 列出全部
- **THEN** 命令 MUST 跳过 `git commit`(无变化可提),MUST NOT 因 "nothing to commit" 的非零退出判定任务失败

#### Scenario: 勾选 commit 不污染审查 diff

- **WHEN** tick-task 的 commit 产生于审查通过之后
- **THEN** review-package 的 base..head diff MUST NOT 包含该勾选 commit(它在 head 之后)

#### Scenario: ledger 仍为恢复权威

- **WHEN** 控制器从崩溃恢复,读取进度
- **THEN** 恢复判断 MUST 仅依据 ledger(`progress.md`)的 complete 行,plan 的 `[x]` MUST NOT 作为恢复信号

## MODIFIED Requirements

### Requirement: SDD 工件生成 verb

引擎 SHALL 提供 `sdd-workspace` / `task-brief` / `review-package` / `tick-task` 四个 verb。`task-brief` MUST 按 `Task N` 标题做 fence 感知的精确抽取(`Task 1` MUST NOT 误配 `Task 10`,代码块内的标题文本 MUST 被忽略);`review-package` MUST 以调用方记录的 BASE(禁止 HEAD~1 等相对引用)生成 commit 列表 + `diff --stat` + `-U10` diff,写入按 range 命名的文件;`tick-task --plan <P> --task <N>` MUST 把 plan 中 Task N 区段内 fence 外的 `- [ ]` 勾选为 `- [x]`,经原子写落盘,输出 SHALL 含 `ticked`(本次真正勾选的 step 行)与 `already`(此前已是 `[x]` 的行),本次无勾选时 MUST NOT 改写 plan 文件,Task N 不存在时 MUST 返回 `{ok:false,error}` 且不修改 plan 文件。

`task-brief` 与 `tick-task` MUST 共用同一套 plan 区段扫描,保证抽取与勾选看到相同的区段:fence 按 CommonMark 长度规则闭合(开栏的 K 个反引号只能被 `>=` K 个反引号且其后无内容的行闭合),嵌套或加长 fence(如 ````markdown 块内含 ```bash)MUST NOT 在块内翻转 fence 状态;`Task N` 区段 MUST 止于下一个同级或更高级标题(下一个 `### Task M`,或 `## 禁止占位符自检` / `## 收尾` 等尾部章节),MUST NOT 蔓延到尾部非 Task 章节。

#### Scenario: task-brief 精确匹配
- **WHEN** plan 文件含 Task 1 与 Task 10,执行 `task-brief --task 1`
- **THEN** 输出 MUST 仅含 Task 1 的内容,不含 Task 10 的任何行

#### Scenario: fence 内标题忽略
- **WHEN** plan 文件中某代码块内出现 `### Task 99` 文本
- **THEN** task-brief MUST NOT 将其识别为任务标题,`tick-task --task 99` MUST 报 task 不存在且不修改 plan 文件

#### Scenario: 嵌套 fence 不翻转状态
- **WHEN** plan 文件中一个 ````markdown 块内含未缩进的 ```bash 内层 fence 与 `- [ ]` 文本
- **THEN** 内层 fence MUST NOT 闭合外层块——块内 `- [ ]` MUST NOT 被 tick-task 勾选,块后的 `### Task M` 标题 MUST 仍被识别为任务标题

#### Scenario: 任务区段止于同级或更高级标题
- **WHEN** plan 的最后一个 `### Task N` 之后跟着 `## 收尾` / `## Self-Review` 等尾部章节,章节内含 `- [ ]`
- **THEN** tick-task MUST NOT 勾选这些尾部章节的 checkbox,task-brief MUST NOT 把它们纳入该任务的 brief

#### Scenario: review-package 按 range 命名
- **WHEN** 执行 `review-package --base <B> --head <H>`
- **THEN** 输出文件 MUST 命名为 `review-<B前7位>..<H前7位>.diff`,内容含 commit 列表、`--stat` 与 `-U10` diff

#### Scenario: tick-task 勾选 Task N 且 fence 内不误勾
- **WHEN** 对含 fence 代码块的 plan 执行 `tick-task --task <N>`
- **THEN** 仅 Task N 区段内 fence 外的 `- [ ]` MUST 被改为 `- [x]`,fence 内的 `- [ ]` 与其他 Task 的 checkbox MUST 保持不变

#### Scenario: tick-task 幂等
- **WHEN** 对同一 Task N 重复执行 `tick-task`
- **THEN** 已 `[x]` 的 checkbox MUST 保持不变,输出 `ticked` 为空、`already` 列出全部已勾选项,plan 文件 MUST NOT 被改写(内容逐字节不变)
