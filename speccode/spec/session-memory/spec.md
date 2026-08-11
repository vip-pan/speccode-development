# session-memory Specification

## Purpose

feature 级跨会话记忆:主仓 `.speccode/memory/` 下按 feature 维度隔离的记忆文件,原子写保障,read-memory / write-memory verb 契约,各命令的读写时机,以及超大会话的主动发现与书写指引,支撑跨会话/多会话共享同一需求的上下文。

## Requirements

### Requirement: memory 文件位置与命名

每个 feature 的记忆文件 SHALL 为**主仓** `.speccode/memory/<type>__<slug>.md`,文件名 MUST 复用 state 文件的 `<type>__<slug>` 双下划线规则;MUST 保持 untracked(与 `.speccode/` 其他运行时数据一致);主仓定位使同一 feature 的多个 worktree 共享同一份 memory。唯一例外:trunk 级 `.speccode/memory/_exploring.md`,用于 exploring 尚无 feature 归属时的跨会话承接。

#### Scenario: 命名复用双下划线规则
- **WHEN** feature 分支为 `feature/payment-api`
- **THEN** 记忆文件 MUST 为 `.speccode/memory/feature__payment-api.md`

#### Scenario: 多 worktree 共享一份 memory
- **WHEN** 同一 feature 的 worktree-a 与 worktree-b 分别执行命令写 memory
- **THEN** 二者 MUST 读写主仓的同一个记忆文件(而非各自 worktree 内的副本)

#### Scenario: memory 不被 git 跟踪
- **WHEN** 记忆文件已写入
- **THEN** 其 MUST 处于 untracked 状态,不进入任何分支的 git 历史与 PR

#### Scenario: _exploring.md 例外
- **WHEN** exploring 结束且探索结论无既有 feature 可归属
- **THEN** 结论摘要 MUST 写入主仓 `.speccode/memory/_exploring.md`,供后续 creating-feature 跨会话承接

### Requirement: memory 原子写

memory 写入按模式分两种原子策略:replace 模式 MUST 采用「写临时文件 + rename 覆盖」,任何异常退出 MUST NOT 产生半写状态;append 模式 MUST 为单次 O_APPEND 追加写(跨 worktree 并发追加互不覆盖),MUST NOT 使用读-改-写。append 模式 MUST 保证条目边界:既有内容非空且不以换行符结尾、且追加内容不以换行符开头时,MUST 在两者之间插入恰好一个换行符(作为同一次追加写的一部分);其余情况 MUST 原样追加,不多做规范化。

#### Scenario: replace 写入过程异常退出
- **WHEN** 进程在以 replace 模式写入 memory 文件时被 kill
- **THEN** memory 文件 MUST 保持写入前的完整旧内容,不留半写状态

#### Scenario: append 缺失边界补一个换行
- **WHEN** 文件既有内容为 `first`(无尾换行),以 append 模式追加 `- second`(无头换行)
- **THEN** 结果 MUST 为 `first\n- second`(边界插入恰好一个换行符)

#### Scenario: append 边界已存在不重复补
- **WHEN** 既有内容以换行符结尾,或追加内容以换行符开头
- **THEN** 引擎 MUST 原样追加,不插入额外换行

#### Scenario: append 空文件不补前置换行
- **WHEN** memory 文件不存在或为空,以 append 模式写入内容
- **THEN** 引擎 MUST 直接写入该内容,MUST NOT 在开头添加换行

### Requirement: read-memory / write-memory verb

引擎 SHALL 暴露 `read-memory --branch <F>`(文件不存在时返回 `{memory: null}`)与 `write-memory --branch <F> --json-stdin`(stdin payload 为 `{mode: "replace" | "append", content: "..."}`)两个 verb。

#### Scenario: 文件缺失返回 null
- **WHEN** 对无记忆文件的 feature 执行 read-memory
- **THEN** 返回 MUST 为 `{ok: true, memory: null}`,不报错

#### Scenario: append 模式追加
- **WHEN** 以 `{mode: "append", content: "..."}` 执行 write-memory
- **THEN** 内容 MUST 追加到既有文件末尾,既有内容完整保留

#### Scenario: replace 模式覆盖
- **WHEN** 以 `{mode: "replace", content: "..."}` 执行 write-memory
- **THEN** 文件内容 MUST 被整体替换为新内容

### Requirement: 命令读写时机

以下命令 MUST 在入口读取本 feature memory 恢复上下文、在出口写入经用户确认的决策/进度摘要:proposing、brainstorming、writing-plans、executing-plans、subagent-driven-development、finishing-worktree、finishing-feature、archiving。creating-feature MUST 在出口建立 memory 骨架,并读取 `_exploring.md`(若存在)把 exploring 结论迁入骨架后清空该文件。syncing MUST 入口读。status SHOULD 只读不写;reset 不写 memory 内容,但 MUST 在无 active feature 前提下询问用户是否整体清理 `.speccode/memory/` 目录(按目录粒度,不按 feature 粒度)。exploring 出口:结论归属既有 feature 时 append 到该 feature 的 memory;无归属时写入 `_exploring.md`。

#### Scenario: 入口读恢复上下文
- **WHEN** 用户在新会话中对既有 feature 执行 proposing
- **THEN** 命令 MUST 先 read-memory 并将 memory 内容作为既有上下文参考

#### Scenario: creating-feature 承接并迁移 _exploring.md
- **WHEN** creating-feature 完成分支创建且 `_exploring.md` 存在
- **THEN** 命令 MUST 把 exploring 结论迁入新 feature 的 memory 骨架,并清空 `_exploring.md`

#### Scenario: reset 按目录粒度清理
- **WHEN** 用户执行 reset 且无 active feature
- **THEN** 命令 MUST 询问是否整体清理 `.speccode/memory/`(以及 `.speccode/sdd/`),按目录整体处理,不提供按 feature 挑选

### Requirement: 超大会话主动发现与书写

各命令的 prose 指引 MUST 指示 agent 在长会话中主动执行 write-memory,而非仅依赖命令出入口的被动读写:当阶段完成、会话上下文显著增长、或 compact 恢复后继续工作时,agent MUST 主动把关键决策/进度/待办写入 memory,写入内容 MUST 经用户确认或遵循命令内置的既定判据。

#### Scenario: 阶段完成主动书写
- **WHEN** 长会话中某开发阶段(如一个 task 完成)结束且距上次 memory 写入已隔多个阶段
- **THEN** agent MUST 主动将阶段摘要写入 memory,不等待命令出口

#### Scenario: compact 恢复后补写
- **WHEN** 会话发生 compact 且 agent 从 memory 恢复上下文继续工作
- **THEN** agent MUST 在恢复后的首个阶段完成时更新 memory,保证下一次恢复所需信息完整
