# Proposal: knowledge_tools 检测改为「本机可用 + 项目集成」双重验证

## Why

`/speccode:init` 当前探测 knowledge_tools 时,把「本机装了插件 / 有 CLI 二进制 / 用户级 MCP」这类**本机级**证据直接当作「本项目已集成」,导致 config 登记了实际在本项目里并未集成的工具(本仓库即是一例:`understand-anything`、`codemap` 两者在本项目都无 `.ua/`、`.codemaker/` 等集成痕迹)。登记了这些工具后,exploring / proposing / brainstorming 会优先「咨询」它们,实则在本项目里根本没用。

## What Changes

- 探测结果从「单维度命中」改为「可用(available)+ 集成(integrated)」两维度,各自记录证据。
- 登记判据收紧为**两维度都满足**(available ∧ integrated)才写入 config 的 `knowledge_tools`。
- `detect-knowledge-tools` verb 输出改为带两维度的结构。
- `/speccode:init` 幂等流程:对 config 中已登记、但当前判定为「仅本机级(项目未集成)」的工具,在 diff 中标记并提示移除(经用户确认)。

## Capabilities

- knowledge-tool-integration

## Impact

- `plugins/speccode/lib/detect.mjs`(探测逻辑两维度化)
- `plugins/speccode/commands/init.md`(登记判据与幂等 diff)
- `plugins/speccode/tests/`(detect 相关单测、cli 端到端用例)
- `speccode/spec/knowledge-tool-integration/spec.md`(经 syncing 更新)
