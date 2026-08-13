# Design: knowledge_tools 检测两维度模型(脑暴精化)

> 2026-08-13,承接 `propose/design.md`,精化「可用 / 集成」两维度的归类规则。

## 背景

proposing 阶段已定「登记 = 本机可用 ∧ 项目集成」的严格双重验证。脑暴阶段发现该判据在 **MCP 类工具**上有一个分类缺陷:仅出现在项目 `.mcp.json`、无独立插件 / CLI 的工具,会被「本机可用」维度误杀——它的 `available` 为 false,尽管项目已配置、完全可用。

## 根因

对 plugin / CLI 类工具,「本机装了」与「本项目用了」是两回事(装了 ≠ 用了),必须分开判。但对 MCP 类工具,「项目 `.mcp.json` 配置了」**同时**就是「可用」和「集成」——两个维度塌缩。现有 `detect.mjs` 其实早已把 `.mcp.json`(项目)与 `~/.claude.json`(用户)分开探测,只是未把「项目级 MCP」显式标为「集成」。

## 最终归类规则

- **可用 available** = 插件命中(`installed_plugins.json`)∨ CLI 命中(`command -v`)∨ 任意 MCP 配置(项目 `.mcp.json` 或用户 `~/.claude.json`)。
- **集成 integrated** = 项目 `.mcp.json` ∨ `~/.claude.json[projects][cwd]` ∨ 项目 dir(`.ua` / `.codegraph` / `.graphify` / `.codemaker/codemap` / `.lightrag`)。
- **注册 = available ∧ integrated**。

## 行为表

| 场景 | available | integrated | 注册 |
|---|---|---|---|
| 插件装了、项目无 `.ua/` | ✅ | ❌ | ❌ |
| CLI 有、项目无索引 | ✅ | ❌ | ❌ |
| 项目有 `.ua/` 且插件在 | ✅ | ✅ | ✅ |
| 仅项目 `.mcp.json` | ✅ | ✅ | ✅ |
| 仅用户 `~/.claude.json` | ✅ | ❌ | ❌ |
| 项目有索引但工具已卸 | ❌ | ✅ | ❌(保守告警) |

## 后续小项

- verb 输出形状:`{tools: [{id, available: {value, evidence?}, integrated: {value, evidence?}}]}`(破坏性变更,消费方仅 init.md + 测试)。
- dir 标记核验:codemap 现有标记 `.codemaker/codemap`,但 codemap 自身 `.gitignore` 含 `.codemaker/codeindex/`;实现时核验真索引目录,必要时两者都认。
