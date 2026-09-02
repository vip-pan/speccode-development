# tool-input-sanitization Specification (delta)

## Purpose

插件自带的 Claude Code PreToolUse 工具输入清洗 hook：在 AskUserQuestion 执行前剥离其参数字符串中的 CR 字符，消除 GLM 系模型 tool_use 参数发射路径注入 CR 导致的提问乱码。清洗逻辑下沉 lib 纯函数，hook 壳只做编排，fail-open 语义保证清洗绝不阻断用户交互。

## ADDED Requirements

### Requirement: PreToolUse 清洗 hook

speccode 插件 SHALL 自带 `hooks/hooks.json`，声明一个匹配 AskUserQuestion 的 PreToolUse hook；hook MUST 读取 stdin 载荷中的 `tool_input`，经 lib 清洗函数剥离所有字符串内的 CR（U+000D）后，若输入确有变化 MUST 输出含 `updatedInput`（清洗后完整 tool_input）的放行 JSON，无变化 MUST 零输出静默放行。

#### Scenario: 参数含 CR 时被清洗
- **WHEN** AskUserQuestion 被调用且其 tool_input 的某字符串含 CR
- **THEN** 该工具实际收到的 tool_input MUST 不含任何 CR，其余内容与原输入逐字一致

#### Scenario: 参数无 CR 时零开销放行
- **WHEN** AskUserQuestion 被调用且 tool_input 不含 CR
- **THEN** hook MUST 无输出放行，不改变工具输入

#### Scenario: 清洗不改变非目标字段
- **WHEN** tool_input 含嵌套对象、数组与数字字段
- **THEN** 仅字符串值内的 CR 被剥离，结构与非字符串值 MUST 原样保留

### Requirement: 清洗逻辑为 lib 纯函数

清洗逻辑 SHALL 位于 `plugins/speccode/lib/sanitize.mjs`，以纯函数形式递归遍历 JSON 值并剥离字符串内 CR；单测 MUST 覆盖嵌套结构、无 CR 快路径与含 CR 路径，hook 壳 MUST NOT 内联实现清洗逻辑。

#### Scenario: 嵌套结构递归清洗
- **WHEN** 输入为含嵌套对象与数组的 JSON 值且深层字符串含 CR
- **THEN** 清洗函数返回的值中任何字符串均不含 CR，且原值无 CR 时返回值与原值深度相等

#### Scenario: hook 壳不含清洗实现
- **WHEN** 审查 `plugins/speccode/hooks/` 下的 hook 脚本
- **THEN** CR 清洗逻辑 MUST 经 import 来自 `lib/sanitize.mjs`，脚本内无重复实现

### Requirement: 清洗 hook fail-open

hook 脚本在任何异常下（stdin 非法 JSON、清洗抛错、载荷缺字段、进程被打断）MUST 以 exit 0 结束且不输出阻断性决策，放行原始 tool_input；清洗 hook MUST NOT 因自身故障阻塞或拒绝用户的提问交互。

#### Scenario: stdin 非法 JSON
- **WHEN** hook 收到的 stdin 不是合法 JSON
- **THEN** hook MUST 以 exit 0 结束、无输出，AskUserQuestion 照常以原输入执行

#### Scenario: 清洗函数抛错
- **WHEN** 清洗过程中发生任何运行时错误
- **THEN** hook MUST 以 exit 0 结束、无输出，工具调用不被拒绝
