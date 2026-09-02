# Proposal: askuserquestion-cr-sanitizer

## Why

GLM 系模型（glm-5.3-flash / glm-5.3）生成 AskUserQuestion 工具参数时会随机在中英/ASCII 边界注入 CR（`\r`）字符，导致 speccode 命令（creating-feature / creating-worktree 等）向用户提问时终端显示乱码。transcript 实证：AskUserQuestion 参数 29/259 次含 CR，其他工具与模型 text 输出零污染；插件源码/markdown/hooks 均无辜。

## What Changes

- 新增 `lib/sanitize.mjs`：递归剥离 JSON 值中所有字符串内 CR 字符的纯函数，配套单测
- 新增插件自带 hook 壳 `hooks/sanitize-ask.mjs` + `hooks/hooks.json`：PreToolUse hook 匹配 AskUserQuestion，清洗 tool_input 中 CR 后经 `updatedInput` 回传；无 CR 时零输出静默放行；任何异常 fail-open（放行原输入）
- 修复效果：AskUserQuestion 渲染前 CR 已被剥离，中文询问不再乱码

不改动任何既有命令 markdown、引擎 verb 或 `hook-event-integration` 能力。

## Capabilities

- **tool-input-sanitization**（新增）：插件自带的 Claude Code PreToolUse 工具输入清洗 hook

## Impact

- 受影响代码：`plugins/speccode/lib/`（+1 模块）、`plugins/speccode/hooks/`（新增目录）、`plugins/speccode/tests/`（+1 测试文件）
- 启用 speccode 插件的会话即刻生效（hooks.json 随插件加载），目标项目零污染（不写项目 settings）
- 边界：只保护启用本插件的会话；根治需 GLM 服务端清洗 tool_use 参数（另行反馈，不在本变更范围）
