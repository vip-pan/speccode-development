# Design: askuserquestion-cr-sanitizer

## Context

- 现状：AskUserQuestion 的参数由模型直接生成，GLM 推理服务在 tool_use 参数发射路径上随机注入 CR（实证见 proposal.md），Claude Code 原样渲染导致乱码。插件无任何机制能在工具执行前改写工具输入。
- 约束：Claude Code 的 PreToolUse hook 支持 `updatedInput` 字段（标准决策模型事件），可在工具执行前替换 tool_input；插件可通过自带 `hooks/hooks.json` 声明 hook，随插件启用生效，不触碰目标项目 settings（与 R4「插件不污染项目文件」同源）。本机 Claude Code 2.1.258。
- 提醒：插件 hook 只保护启用本插件的会话；且 prompt 叮嘱「别写 \r」无效——CR 是发射层噪声，不是模型有意书写。

## Goals

- AskUserQuestion 在 speccode 会话中渲染前剥离参数内全部 CR
- 清洗逻辑为 lib 纯函数（可单测、可复用），hook 壳足够薄
- 对无 CR 的常规调用零开销（无输出、静默放行）

## Non-Goals

- 不清洗 CR 以外的控制字符（第一版最小修复）
- 不处理模型 text 输出、其他工具的参数清洗（无实证污染）
- 不涉及 GLM 服务端修复（建议另行反馈 AIGW）
- 不改动任何命令 markdown 或既有生命周期 hook（hook-event-integration）语义

## Decisions

1. **载体：插件自带 `hooks/hooks.json`（而非 /speccode:init 写入项目 settings）**。被否备选：init 时往目标项目 `.claude/settings.json` 写 PreToolUse hook——被否因污染项目文件、卸载插件后残留、与「运行时数据插件不写入项目」的边界纪律冲突。
2. **逻辑下沉 `lib/sanitize.mjs`，hook 壳只做 stdin/stdout 编排**。符合「确定性逻辑绝不写进命令 markdown/壳层」分层纪律；单测打在纯函数上，不依赖真实 Claude Code。
3. **第一版只剥离 U+000D**。被否备选：清洗所有控制字符——被否因无实证必要性，扩大打击面有误伤风险（Karpathy 简单性优先）；后续有实证再扩。
4. **fail-open：hook 自身任何异常（stdin 非法、清洗抛错、超时）一律 exit 0 放行原输入**。清洗是增强而非门禁，hook 故障绝不能挡住用户交互；与 run-hook「永不阻断」语义同源。
5. **实现前置 spike：验证 `updatedInput` 确切 JSON 结构与 matcher 写法**。文档示例只展示了 permissionDecision 分支；spike 用最小 hook 实测（注入 CR 的 AskUserQuestion 调用 → 观察清洗是否生效）。spike 不过 → 降级方案：hook 输出 `permissionDecision: deny` + reason 提示重发（体验差，仅兜底）。
6. **归为新独立能力 tool-input-sanitization**（用户已确认），不挂进 hook-event-integration——两者机制不同族（config.hooks 生命周期事件 vs Claude Code 设置级 PreToolUse）。

## Risks

| 风险 | 缓解 |
|---|---|
| `updatedInput` 结构/行为与预期不符或本机版本不支持 | 决策 5 的 spike 先行；不过则走 deny 降级或放弃本变更 |
| hook 增加 AskUserQuestion 调用延迟 | 纯 Node 同步几行逻辑，毫秒级；无 CR 时零输出 |
| 清洗误删合法 CR | question/header/label 语义上为单行文本，CR 无合法用途；且 hook 仅作用于 AskUserQuestion |
| 未来 Claude Code 变更 hook 协议 | fail-open 保证最坏情况退化为「不清洗」，回到现状 |

## Open Questions

- `updatedInput` 是否必须整体替换 tool_input（含未改动字段）还是支持部分合并——spike 确认。
