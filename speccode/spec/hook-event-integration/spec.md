# hook-event-integration Specification

## Purpose

配置驱动的生命周期事件钩子:`.speccode/config.json` 的 hooks 字段、14 个固定事件枚举、stdin 单行 JSON 载荷、warn-only 失败语义、run-hook verb 与各命令接线节点,为 IM 通知等外部集成与 SDD 自动化提供挂点。

## Requirements

### Requirement: hooks 配置字段

`.speccode/config.json` SHALL 支持可选 `hooks` 对象,结构为「事件名 → shell 命令字符串」;字段缺失或为空对象 MUST 视为「全部事件无 hook」。`/speccode:init` MUST 询问用户是否配置 hooks(逐项:事件名 + 命令),未配置时 MUST NOT 静默写入该字段。

#### Scenario: 字段缺失视为无 hook
- **WHEN** config.json 不含 `hooks` 字段
- **THEN** 任何事件触发 MUST 为成功 no-op,不报错

#### Scenario: 配置事件被映射执行
- **WHEN** config.json 含 `"hooks": { "onFeatureCreated": "cat >> /tmp/hook.log" }`
- **THEN** onFeatureCreated 事件触发时 MUST 执行该 shell 命令

#### Scenario: init 询问而非静默写入
- **WHEN** 用户执行 init 且未表达配置 hooks 的意愿
- **THEN** 命令 MUST 询问是否配置;用户跳过时 MUST NOT 写入 `hooks` 字段

### Requirement: 事件名固定枚举

引擎 SHALL 定义固定事件枚举:`{onExplored, onFeatureCreated, onWorktreeCreated, onProposed, onBrainstormed, onPlanned, onTaskCompleted, onCodeReviewRequested, onCodeReviewCompleted, onWorktreeFinished, onFeatureFinished, onPrOpened, onSynced, onArchived}`。调用未配置的事件 MUST 为成功 no-op;调用枚举外事件名 MUST 返回成功并带 `warning` 字段(防拼写错误静默失效)。

#### Scenario: 未配置事件 no-op
- **WHEN** 触发枚举内事件但 config.hooks 未配置该事件
- **THEN** 结果 MUST 为 `{ran: false, ok: true}`,无任何进程被启动

#### Scenario: 枚举外事件名警告
- **WHEN** 以 `onFeatureCreatedd`(拼写错误)调用 run-hook
- **THEN** 结果 MUST 为成功且含 `warning` 字段提示该事件名不在枚举中

### Requirement: 事件载荷

hook 进程 SHALL 经 stdin 收到单行 JSON,至少含 `event`、`timestamp`(ISO 8601 UTC)、`repo_root`、`cwd`、`command` 五个字段,并按事件可得性含 `feature_branch`、`worktree_branch`、`pr_number`、`task`。分工:引擎 MUST 只补 envelope 四字段(`event`/`timestamp`/`repo_root`/`cwd`);`command` 与事件上下文字段 MUST 由调用方(命令层)在 payload 片段中传入。run-hook 的 stdin 读取 MUST 容忍空输入(视为 `{}`),不阻塞等待。

#### Scenario: 载荷为单行 JSON
- **WHEN** 任一 hook 被触发
- **THEN** 其 stdin MUST 为恰好一行的合法 JSON,含 event/timestamp/repo_root/cwd/command 五字段

#### Scenario: 按可得性附带上下文字段
- **WHEN** onWorktreeFinished 触发且当前 feature 与 worktree 已知、PR 已创建
- **THEN** 载荷 MUST 含 feature_branch、worktree_branch、pr_number

#### Scenario: 空 stdin 片段容忍
- **WHEN** 命令层未向 run-hook 的 stdin 写入任何内容
- **THEN** run-hook MUST 以空对象 `{}` 为片段继续执行,不阻塞、不报错

### Requirement: hook shell 执行语义

hook 命令 MUST 经 `sh -c` 执行,工作目录 MUST 为目标项目根,默认超时 30 秒;payload MUST 序列化为单行 JSON(含特殊字符时正确转义)写入 hook 进程 stdin。

#### Scenario: 含空格的 hook 命令
- **WHEN** 配置 `"onProposed": "python3 /opt/notify me.py"`(含空格)
- **THEN** MUST 经 `sh -c` 按 shell 语义执行,不做 argv 拆分

#### Scenario: 执行工作目录
- **WHEN** hook 进程启动
- **THEN** 其 cwd MUST 为目标项目根目录(与 `--cwd` 解析一致)

### Requirement: 失败不阻断

hook 进程非零退出、超时(默认 30 秒)或命令不可执行时,主命令 MUST 继续执行并打印警告(含事件名与错误摘要);hook MUST NOT 改变主命令的退出码。`run-hook` verb 自身 MUST 永远以 exit 0 结束:其 handler MUST 整体 try/catch 兜底、永不返回 `ok:false`。

#### Scenario: hook 非零退出
- **WHEN** 配置的 hook 命令以退出码 1 结束
- **THEN** 主命令 MUST 继续执行,输出含事件名与退出码的警告,主命令退出码不受其影响

#### Scenario: hook 超时
- **WHEN** hook 命令执行超过 30 秒
- **THEN** MUST 终止该 hook 进程并按失败警告处理,主命令继续

#### Scenario: run-hook verb 永远 exit 0
- **WHEN** 以任意事件(含枚举外、hook 失败、hook 超时)调用 `run-hook` verb
- **THEN** 进程退出码 MUST 为 0,失败信息体现在输出 JSON 的 `hook.ok=false` 字段

### Requirement: run-hook verb 与调用节点

引擎 SHALL 暴露 `run-hook --event <name>` verb(事件载荷片段经 stdin 传入,引擎补齐 envelope 字段)。各命令 MUST 在对应生命周期节点调用:exploring→onExplored、creating-feature→onFeatureCreated、creating-worktree→onWorktreeCreated、proposing→onProposed、brainstorming→onBrainstormed、writing-plans→onPlanned、applying 每条 tasks.md 条目完成→onTaskCompleted、SDD/executing-plans 每个 task 完成→onTaskCompleted、requesting-code-review→onCodeReviewRequested、receiving-code-review→onCodeReviewCompleted、finishing-worktree→onWorktreeFinished(PR 创建后另触发 onPrOpened)、finishing-feature→onFeatureFinished(及 onPrOpened)、syncing→onSynced、archiving→onArchived。

#### Scenario: 命令在节点触发对应事件
- **WHEN** creating-feature 成功创建功能分支并登记 state
- **THEN** 命令 MUST 以 event=onFeatureCreated 调用 run-hook

#### Scenario: PR 创建后触发 onPrOpened
- **WHEN** finishing-worktree 或 finishing-feature 成功创建 PR
- **THEN** 命令 MUST 以 event=onPrOpened、载荷含 pr_number 调用 run-hook

#### Scenario: SDD 每个 task 完成触发 onTaskCompleted
- **WHEN** subagent-driven-development 或 executing-plans 中一个 task 完成
- **THEN** 命令 MUST 以 event=onTaskCompleted、载荷含 task 编号调用 run-hook

#### Scenario: applying 每条完成触发 onTaskCompleted
- **WHEN** applying 完成并勾选 tasks.md 的一条条目
- **THEN** 命令 MUST 以 event=onTaskCompleted、载荷含条目序号调用 run-hook
