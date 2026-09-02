# session-memory Delta

## MODIFIED Requirements

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
