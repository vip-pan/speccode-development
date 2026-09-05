---
tier: 1
---
# Proposal: neutralize-prose(命令 prose 宿主中立化 + 引擎 shim)

## Why

24 个 skill 的 prose 深度耦合 Claude Code 专属概念(11 处 AskUserQuestion、2 处 `general-purpose` 子代理类型、14 处 `${CLAUDE_PLUGIN_ROOT}` 路径引用、全部 94 处 `speccode.mjs` 裸调依赖插件 bin/ 进 PATH),任何其他宿主无法原样执行;这是大需求 multi-host-support 六宿主适配的公共地基(host-adapters 的边际成本全压在 prose 中立上)。

## What Changes

- **BREAKING**: 命令正文引擎调用形态从 `speccode.mjs <verb> --cwd .` 改为 **`speccode <verb> --cwd .`**(skills ×94、references ×3、AGENTS.md ×4);`bin/speccode.mjs` 保留为手动调试直调形态
- 新增 `bin/speccode` 可执行 wrapper(shebang + exec node speccode.mjs),经插件 bin/ PATH 或各宿主 shim 均可用
- 新增引擎 verb **`plugin-root`**:输出插件根绝对路径(引擎自定位),skills 引用插件内文件改走该 verb,替换全部 `${CLAUDE_PLUGIN_ROOT}` ×14(5 个 skill)
- 11 个 skill 的提问流程中性化:AskUserQuestion 硬编码 → 「向用户提问(一次一问、给选项)」语义(宿主绑定由 host-adapters 的映射承载,不进命令正文)
- 2 个 skill 的子代理类型中性化:`general-purpose` → 「派发子代理」语义;子代理依赖型 skill(subagent-driven-development、dispatching-parallel-agents、requesting-code-review)显式声明依赖与串行降级路由
- `plugin.json` description 去「Claude Code 专属」措辞(flatten-repo 复审遗留项)
- `support/install-skills.sh` 参数化 `--dest`(默认 `.claude/skills` 不变),多宿主目标目录由 host-adapters 填充

## Capabilities

- `plugin-packaging`(MODIFIED:命令通过 bin/ PATH 裸调引擎、命令正文手写路径与引擎一致)
- `host-neutral-prose`(新增 capability,ADDED:宿主中立纪律、子代理依赖声明、引擎自定位插件根)

## Impact

- **受影响代码**:bin/speccode.mjs(+wrapper +1 verb)、24 skills、references 两个 prompt 模板、AGENTS.md、plugin.json、support/install-skills.sh、tests(cli.test.mjs 新增守卫测试)
- **不受影响**:引擎 lib 逻辑、verb 语义、`.speccode/` 契约、CLI verb 清单语义(仅 +1 读 verb);cli.test 既有内容断言均为语义级(tick-task/code_intel_tools/RENAME),不受调用形态影响
- **行为兼容**:Claude Code 上行为不变(提问仍可用 AskUserQuestion——模型按可用工具自选,hooks sanitize 照常);`speccode.mjs` 直调保持可用
