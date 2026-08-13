# Design: knowledge_tools 检测的两维度模型

## Context

现状(`detect.mjs`):`KNOWLEDGE_TOOL_DETECTORS` 五个工具,按 plugin → mcp → cli → dir 顺序**短路**探测,首个命中即返回 `{id, kind, evidence}`。问题:`plugin`(`installed_plugins.json`)、`cli`(`command -v`)、`mcp` 的 `~/.claude.json` 用户级都是**本机级**证据,只有 `dir`(项目 `.ua/` 等)与 `mcp` 的项目 `.mcp.json` 是**项目级**。短路顺序让本机级命中提前返回,项目级证据被跳过,造成「本机有 = 项目已集成」的误判。

## Goals

- 探测明确区分「可用 available」与「集成 integrated」两个维度。
- 登记 config 仅当两维度都满足。
- 幂等 re-init 能识别并提示移除「可用但未集成」的既有登记。

## Non-Goals

- 不改 `knowledge_tools` 的**咨询行为**(命令仍优先用已登记且可用的工具,缺失回退 Grep/Read)——本设计只收紧**登记**的门禁。
- 不新增外部依赖;仍纯 `node:` 内置 + 依赖注入可测。
- 不动 worktree 目录配置(resolve-worktree-dir)那部分。

## Decisions

1. **两维度独立探测,不短路**——每个工具同时评估 available 与 integrated 两轴,各自记录证据。理由:现状单维度短路正是 bug 根源。
   - 被否备选:保留短路、仅把 dir 探针提前。被否理由:仍无法表达「可用但未集成」这一需向用户明示的状态。

2. **维度归类规则**:
   - **可用 available** = 插件命中(`installed_plugins.json`)∨ CLI 命中(`command -v`)∨ 任意 MCP 配置(项目 `.mcp.json` 或用户 `~/.claude.json`)。
   - **集成 integrated** = 项目 `.mcp.json` ∨ `~/.claude.json[projects][cwd]` ∨ 项目配置目录(`.ua` / `.codegraph` / `.graphify` / `.codemaker/codemap` / `.lightrag`)。
   - 关键洞察:plugin/CLI 的「本机装了」与「本项目用了」是两回事,必须分开;但 MCP 的「项目 `.mcp.json` 配置了」**同时**就是「可用」和「集成」,故 MCP 配置(任意级)计入「可用」、项目级 MCP 计入「集成」,避免 MCP-only 工具被误杀。
   - 被否备选:把 `command -v` 也算「集成」。被否理由:CLI 二进制是本机属性,不代表本项目已为它生成索引。

3. **登记判据 = available ∧ integrated**。被否备选:仅 integrated 判据。被否理由:用户明确要「双重验证」;项目有 `.ua` 但插件已卸载属于异常态,保守不登记更安全。

4. **verb 输出形状**:`detect-knowledge-tools` 返回 `{tools: [{id, available: {value, evidence?}, integrated: {value, evidence?}}]}`。
   - 被否备选:拆成两个数组。被否理由:按工具聚合更贴近 init「逐项确认」的交互。

5. **幂等补救**:re-init 对 config 已登记、但判定为 available-only(未集成)的项,按既有「[旧值]→[新值]」diff 展示并提示移除,绝不静默删除。

## Risks

- **检测误伤**:某工具真实集成但项目级证据形态不在内置表(如未来新工具)→ 被判未集成。缓解:`KNOWLEDGE_TOOL_DETECTORS` 可扩展;登记前逐项经 AskUserQuestion 人工确认,人可手动改判。
- **幂等重跑清掉用户手写项**:用户手动在 config 加了非标准工具 → re-init 判 available-only 提示移除。缓解:移除是「提示 + 用户确认」,绝不静默删除。

## Open Questions

- dir 标记核验:codemap 现有标记 `.codemaker/codemap`,但 codemap 自身 `.gitignore` 含 `.codemaker/codeindex/`;实现时核验真索引目录,必要时两者都认。
