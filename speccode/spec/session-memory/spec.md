# session-memory Specification

## Purpose

feature 级跨会话记忆:主仓 `.speccode/memory/` 下按 feature 维度隔离的记忆文件,原子写保障,read-memory / write-memory verb 契约,各命令的读写时机,以及超大会话的主动发现与书写指引,支撑跨会话/多会话共享同一需求的上下文。

## Requirements

### Requirement: memory 文件位置与命名

每个 feature 的记忆文件 SHALL 为**主仓** `.speccode/memory/<type>__<slug>.md`,文件名 MUST 复用 state 文件的 `<type>__<slug>` 双下划线规则;MUST 保持 untracked(与 `.speccode/` 其他运行时数据一致);主仓定位使同一 feature 的多个 worktree 共享同一份 memory。trunk 级例外:探索记忆按 topic 分文件,键形式 `_exploring/<topic>`,文件名经 `branchToStateName` 编码为 `.speccode/memory/_exploring__<topic>.md`(`topic` MUST 匹配 `[a-z0-9-]`);`.speccode/memory/_knowledge.md`(knowledge 命令的 trunk 级维护摘要)保持无斜杠键直通。无斜杠遗留键 `_exploring`(对应 `.speccode/memory/_exploring.md`)MUST 保持读兼容,新写入 MUST NOT 再使用。分期需求的各期探索 SHALL 使用共同 topic 前缀约定(如 `<主题>-p1`、`<主题>-p2`);跨期进度与设计结论 MUST 以 state、git history 与 spec 主规格为真源,MUST NOT 记入 memory。

#### Scenario: 命名复用双下划线规则
- **WHEN** feature 分支为 `feature/payment-api`
- **THEN** 记忆文件 MUST 为 `.speccode/memory/feature__payment-api.md`

#### Scenario: 多 worktree 共享一份 memory
- **WHEN** 同一 feature 的 worktree-a 与 worktree-b 分别执行命令写 memory
- **THEN** 二者 MUST 读写主仓的同一个记忆文件(而非各自 worktree 内的副本)

#### Scenario: memory 不被 git 跟踪
- **WHEN** 记忆文件已写入
- **THEN** 其 MUST 处于 untracked 状态,不进入任何分支的 git 历史与 PR

#### Scenario: 探索记忆按 topic 分文件
- **WHEN** exploring 对 topic `payment-rework` 的探索结论无既有 feature 可归属
- **THEN** 结论摘要 MUST 写入主仓 `.speccode/memory/_exploring__payment-rework.md`,MUST NOT 写入其他 topic 的文件

#### Scenario: 分期使用共同前缀
- **WHEN** 大需求 `mkt-req` 分三期探索,每期各自探索结论无 feature 归属
- **THEN** 三期结论 MUST 分别位于 `_exploring__mkt-req-p1.md`、`_exploring__mkt-req-p2.md`、`_exploring__mkt-req-p3.md`(命名约定),各期承接时互不携带他期内容

#### Scenario: 遗留 _exploring.md 读兼容
- **WHEN** 对 `--branch _exploring` 执行 read-memory 且 `.speccode/memory/_exploring.md` 存在
- **THEN** MUST 返回其内容,不报错;write-memory 对该键 MUST 仍可执行(兼容存量),但命令 prose MUST NOT 再向其写入新探索结论

#### Scenario: _knowledge.md 例外
- **WHEN** knowledge 命令(distilling/recording)从 trunk 完成维护并创建 PR
- **THEN** 维护摘要 MUST 追加到主仓 `.speccode/memory/_knowledge.md`,MUST NOT 写 feature 级 memory

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

引擎 SHALL 暴露 `read-memory --branch <F>`(文件不存在时返回 `{memory: null}`)与 `write-memory --branch <F> --json-stdin`(stdin payload 为 `{mode: "replace" | "append", content: "..."}`)两个 verb。branch 校验 MUST 收口为 lib 函数 `validateMemoryBranch`:接受保留键 `_exploring`(遗留读兼容)与 `_knowledge`、topic 键 `_exploring/<topic>`(topic MUST 经 `validateSlug` 校验)、以及经 `validateBranch` 校验的功能分支;非法时返回 `{ok:false, error}`。

引擎 SHALL 另暴露 `list-memory --cwd .` verb(返回既有 `_exploring` topic 键清单,无 topic 时为空数组)与 `rename-memory --branch <from> --to <to> --json-stdin` verb(将 `<from>` 的记忆文件原子 rename 为 `<to>` 的记忆文件名)。rename-memory MUST:两侧 branch 均经 `validateMemoryBranch` 校验;源文件不存在时返回 `{ok:false, error}`;目标记忆文件已存在时 MUST 拒绝并返回错误(MUST NOT 覆盖、MUST NOT 合并);rename MUST 为同目录原子操作。

#### Scenario: 文件缺失返回 null
- **WHEN** 对无记忆文件的 feature 执行 read-memory
- **THEN** 返回 MUST 为 `{ok: true, memory: null}`,不报错

#### Scenario: append 模式追加
- **WHEN** 以 `{mode: "append", content: "..."}` 执行 write-memory
- **THEN** 内容 MUST 追加到既有文件末尾,既有内容完整保留

#### Scenario: replace 模式覆盖
- **WHEN** 以 `{mode: "replace", content: "..."}` 执行 write-memory
- **THEN** 文件内容 MUST 被整体替换为新内容

#### Scenario: topic 键被接受
- **WHEN** 以 `--branch _exploring/payment-rework` 执行 write-memory 或 read-memory
- **THEN** 校验通过,读写 `.speccode/memory/_exploring__payment-rework.md`,不报 invalid branch

#### Scenario: 非法 topic 被拒绝
- **WHEN** 以 `--branch _exploring/Bad_Topic` 执行 write-memory
- **THEN** MUST 返回 `{ok:false, error}`,不创建文件

#### Scenario: _knowledge 保留键被接受
- **WHEN** 以 `--branch _knowledge` 执行 write-memory 或 read-memory
- **THEN** 校验通过,读写 `.speccode/memory/_knowledge.md`,不报 invalid branch

#### Scenario: list-memory 列出 topic
- **WHEN** `.speccode/memory/` 下存在 `_exploring__a.md`、`_exploring__b-p1.md` 与 `feature__c.md`
- **THEN** `list-memory` MUST 返回 `_exploring/a` 与 `_exploring/b-p1`,MUST NOT 包含 feature 级文件

#### Scenario: rename 承接探索记忆
- **WHEN** 对 `--branch _exploring/payment-rework --to feature/payment-rework` 执行 rename-memory
- **THEN** `.speccode/memory/_exploring__payment-rework.md` MUST 被重命名为 `.speccode/memory/feature__payment-rework.md`,内容不变,源文件 MUST NOT 残留

#### Scenario: rename 目标已存在时拒绝
- **WHEN** 目标记忆文件 `.speccode/memory/feature__payment-rework.md` 已存在,执行 rename-memory
- **THEN** MUST 返回 `{ok:false, error}`,目标与源文件内容 MUST 均保持不变

#### Scenario: rename 源不存在时拒绝
- **WHEN** 源 topic 无记忆文件,执行 rename-memory
- **THEN** MUST 返回 `{ok:false, error}`,不创建任何文件

### Requirement: 命令读写时机

以下命令 MUST 在入口读取本分支 memory 恢复上下文、在出口写入经用户确认的决策/进度摘要:proposing、brainstorming、writing-plans、executing-plans、subagent-driven-development、finishing-worktree、finishing-feature、archiving。探索结论的承接 MUST 经 `rename-memory` 原子迁移,宿主 MUST 为 `creating-worktree`(普通需求与集成分支的子需求:slug=topic 命中即迁)与 `creating-feature`(大需求父 topic);分支名直给时按 slug=topic 约定查找 `_exploring/<slug>`,未直给时 MUST 经 `list-memory` 列出既有 topic 供用户选择(或新建/跳过),type 从所选 topic 文件内容推断且推断 MUST NOT 静默生效;`_exploring.md` 的 merge+clear 承接方式 MUST 废除。syncing MUST 入口读。status SHOULD 只读不写;reset 不写 memory 内容,但 MUST 在无 active 分支前提下询问用户是否整体清理 `.speccode/memory/` 目录(按目录粒度,不按分支粒度)。exploring 出口:MUST 先经 `list-memory` 列出既有 topic 供用户选既有或新建(防同名碎片化);结论归属既有分支时 append 到该分支的 memory;无归属时 append 到所选/新建的 `_exploring/<topic>`。

#### Scenario: 入口读恢复上下文
- **WHEN** 用户在新会话中对既有分支执行 proposing
- **THEN** 命令 MUST 先 read-memory 并将 memory 内容作为既有上下文参考

#### Scenario: creating-worktree 经 rename 承接
- **WHEN** creating-worktree 以直给分支名 `feature/payment-rework` 执行,且 `_exploring/payment-rework` 存在记忆文件
- **THEN** 命令 MUST 经 rename-memory 将其承接为该分支的记忆文件,MUST NOT 将其他 topic 的内容迁入骨架

#### Scenario: creating-feature 承接父 topic
- **WHEN** 大需求经 creating-feature 创建集成分支 `feature/mkt-req`,且 `_exploring/mkt-req` 存在记忆文件(拆分决策所在)
- **THEN** 命令 MUST 经 rename-memory 承接为父实体的记忆文件;子需求各自的探索 topic MUST 留待对应 creating-worktree 承接

#### Scenario: 无命中时骨架填无
- **WHEN** creating-worktree 执行时不存在与 slug 同名的 topic 键
- **THEN** memory 骨架的 exploring 结论段 MUST 填「无」,MUST NOT 扫描或迁移任何其他 topic 文件

#### Scenario: exploring 出口先列 topic
- **WHEN** exploring 结束且结论无既有分支归属
- **THEN** 命令 MUST 先 list-memory 展示既有 topic 清单,经用户选择既有 topic 或确认新建 topic 后,才 append 到对应 `_exploring/<topic>` 文件

#### Scenario: reset 按目录粒度清理
- **WHEN** 用户执行 reset 且无 active 分支
- **THEN** 命令 MUST 询问是否整体清理 `.speccode/memory/`(以及 `.speccode/sdd/`),按目录整体处理,不提供按分支挑选

### Requirement: 超大会话主动发现与书写

各命令的 prose 指引 MUST 指示 agent 在长会话中主动执行 write-memory,而非仅依赖命令出入口的被动读写:当阶段完成、会话上下文显著增长、或 compact 恢复后继续工作时,agent MUST 主动把关键决策/进度/待办写入 memory,写入内容 MUST 经用户确认或遵循命令内置的既定判据。

#### Scenario: 阶段完成主动书写
- **WHEN** 长会话中某开发阶段(如一个 task 完成)结束且距上次 memory 写入已隔多个阶段
- **THEN** agent MUST 主动将阶段摘要写入 memory,不等待命令出口

#### Scenario: compact 恢复后补写
- **WHEN** 会话发生 compact 且 agent 从 memory 恢复上下文继续工作
- **THEN** agent MUST 在恢复后的首个阶段完成时更新 memory,保证下一次恢复所需信息完整
