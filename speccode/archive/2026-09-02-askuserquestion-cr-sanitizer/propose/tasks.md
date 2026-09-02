# Tasks: askuserquestion-cr-sanitizer

## Spike（先行，门禁）

- [x] 1. 验证 PreToolUse hook 对 AskUserQuestion 的 matcher 写法与 `updatedInput` 确切结构：临时在 `.claude/settings.local.json` 配最小 hook，调用一次含 CR 的 AskUserQuestion 观察清洗是否生效；记录可用结构。spike 不过 → 回到用户决策（deny 降级或放弃）

## 引擎层

- [x] 2. `lib/sanitize.mjs`：新增 `stripCR(value)` 纯函数——递归遍历 JSON 值，剥离所有字符串内的 U+000D；无 CR 输入走快路径返回原值
- [x] 3. `tests/sanitize.test.mjs`：覆盖嵌套对象/数组递归清洗、无 CR 深度相等快路径、仅字符串受影响（数字/结构原样）、CR 全位置（开头/中间/结尾/连续多个）

## Hook 层

- [x] 4. `hooks/sanitize-ask.mjs`：stdin 读 PreToolUse 载荷 → 仅当 `tool_name === "AskUserQuestion"` 时调 `stripCR(tool_input)` → 有变化输出 `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":<清洗后>}}`，无变化/非目标工具/任何异常均 exit 0 无输出（fail-open）
- [x] 5. `hooks/hooks.json`：声明该 hook，matcher 为 AskUserQuestion，命令经 `${CLAUDE_PLUGIN_ROOT}` 引用脚本

## 验证与收尾

- [x] 6. 全量测试 `node --test ./plugins/speccode/tests/*.test.mjs` 全绿
- [x] 7. 真机验证：启用插件后执行一次含 CR 的 AskUserQuestion，确认终端渲染无乱码（可复现样本见 feature memory）
- [x] 8. 更新插件 README 的 hooks 相关段落与 CHANGELOG（遵守版本/双语同步纪律），`/speccode:syncing` 前置就绪
