# Design: host-detection

## Context

现状三块:`detect.mjs` 的探测器全部注入式(homeDir/readJson/commandV/exists,单测不触真机);`config.mjs` 无 schema 校验(字段纪律由 init 命令 + spec 字段集承载,加字段零代码障碍);worktree_dir 缺省在 `detect.mjs:87` 与 `reconcile.mjs:13` **双硬编码**(且 spec「config.json 字段集」「对账算法」两处表述)。父实体锁定决策:宿主探测写 config、命令层查表;code_intel 的 ~/.claude 路径保留为 Claude 分支;worktree_dir 缺省中性化。

## Goals

- 宿主身份成为 config 的一等字段,探测启发 + 用户确认双保险,全部注入式可测
- code_intel 探测在非 Claude 宿主上不再空转读 ~/.claude
- worktree_dir 缺省宿主中立且单源(测试锁死两处一致)

## Non-Goals

- 不做 per-host `capabilities` 字段与映射文档(host-adapters 承载,本变更只做身份记录)
- 不解析各宿主 MCP 配置格式(codex config.toml 等——零依赖下解析 toml 超范围,归 host-adapters)
- 不迁移存量 config(已有 worktree_dir 原样生效)
- 不改 24 skills 其余命令的 prose(它们通过 read-config 查表,天然受益)

## Decisions

1. **宿主身份 = config.host + detect-host verb(分层启发 + 显式覆盖 + 用户确认)**——启发(env 标记 → cwd 指令文件/配置目录)是 best-effort;init 将探测结果**经用户确认**写入(推断 MUST NOT 静默生效,与全命令族纪律一致)。被否:纯启发静默写入(误判无审计点);硬依赖 session env(各宿主标记不全,未知宿主直接失效)。
2. **取值枚举 kebab-case 固定七值**:`claude-code | codex | zcode | opencode | pi | kimi-code | generic`;未知宿主/未记录一律 generic 语义(全宿主无关探测路径),新增宿主 = 扩枚举 + adapter,不改引擎。被否:自由字符串(config 失去查表确定性)。
3. **code_intel 分流以 config.host 为准**:`claude-code`(及未记录)走现行为全量探测;其余宿主跳过 `~/.claude/plugins/installed_plugins.json` 与 `~/.claude.json`(pluginHit/anyMcp/projectMcp 的 userMcp 部分),保留 `.mcp.json`(格式通用)、bin 探测、项目目录探测——后两者本就宿主无关。evidence 字符串保留来源前缀(可审计)。被否:为每宿主各写一套 MCP 解析(归 host-adapters;且探测目标只是「工具是否可用/集成」,bin+目录已覆盖主要信号)。
4. **worktree_dir 缺省 `.speccode/worktrees` + 单源常量**——工作树是运行时数据,归 `.speccode/` 运行时域语义自洽(与 memory/sdd 同域);`DEFAULT_WORKTREE_DIR` 由 detect.mjs 导出、reconcile.mjs 引用,消灭双硬编码。被否:保持 `.claude/worktrees`(宿主色彩,其他宿主上费解);init 逐项目询问缺省(增加 init 摩擦,缺省就该有意见)。存量 config 不动;新项目的 ignore 三分支校验照常引导。
5. **全部探测逻辑注入式 + TDD 红灯先行**——detectHost 的 env 读取、文件探测均经 opts 注入;缺省常量一致性用测试锁死(resolveWorktreeDir 与 reconcile fallback 同源)。

## Risks

| 风险 | 缓解 |
|---|---|
| 启发误判宿主(如 AGENTS.md 在多宿主通用) | init 用户确认兜底;generic 兜底语义永不误伤;`--host` 显式覆盖可纠正 |
| 缺省变更令新项目 worktree 位置与旧文档/习惯不符 | 发布说明标注;AGENTS.md/知识集同步;存量项目零影响 |
| reconcile/detect 缺省漂移回归 | DEFAULT_WORKTREE_DIR 单源 + 一致性测试(红灯先行) |
| host 字段被手写成非法值 | init 单写点 + 枚举校验(detect-host 输出即合法值域);写 verb 层不加硬校验(与既有字段纪律一致) |

## Open Questions

无——缺省值取 `.speccode/worktrees` 为建议项,定层确认时一并经用户确认。
