---
tier: 1
---
# Proposal: host-detection(引擎宿主探测 + config.host + 中性缺省)

## Why

多宿主支持的引擎侧地基缺失:宿主身份无处记录(命令层无从按宿主查表)、code_intel 探测读 `~/.claude/` 专属路径(其他宿主上必然落空)、`worktree_dir` 缺省 `.claude/worktrees` 带宿主色彩——三个点都是 host-adapters 依赖的确定性输入。

## What Changes

- 新增引擎只读 verb **`detect-host`** + `lib/detect.mjs` 的 `detectHost()`:分层启发(env 标记 → 指令文件 → 宿主配置目录)+ `--host` 显式覆盖;取值枚举 `claude-code | codex | zcode | opencode | pi | kimi-code | generic`(未知/未记录 = generic 语义);全部注入式可测
- **config v3 新增可选字段 `host`**(kebab-case,缺失视为未记录):由 init 探测并**经用户确认**写入;`read-config` 自然吐出(命令层查表入口)
- **code_intel 探测按宿主分流**:`detect-code-intel-tools` 读取 `config.host` 传入探测;非 claude-code 宿主跳过 `~/.claude/plugins/installed_plugins.json` 与 `~/.claude.json` 两类探测;bin 探测与项目目录探测宿主无关恒开;各宿主 MCP 配置解析归 host-adapters
- **BREAKING(仅新增项目)**:`worktree_dir` 缺省 `.claude/worktrees` → **`.speccode/worktrees`**;`DEFAULT_WORKTREE_DIR` 单源常量(detect.mjs 导出),`reconcile.mjs` 的重复硬编码改为引用——存量 config 不受影响
- `skills/init` prose:新增宿主探测询问步骤(探测结果 + 用户确认),config 组装字段表加 `host`

## Capabilities

- `host-detection`(新增 capability:宿主身份探测、code_intel 按宿主分流)
- `speccode-config-management`(MODIFIED:config.json 字段集、对账算法)

## Impact

- **受影响代码**:`lib/detect.mjs`(+detectHost +常量)、`lib/reconcile.mjs`(fallback 引用常量,行为随缺省变)、`bin/speccode.mjs`(+1 读 verb,+1 verb 传参)、`skills/init/SKILL.md`、`AGENTS.md`(对账不变量中的缺省值表述)、`tests/`
- **不受影响**:存量项目的 config(已有 worktree_dir 值原样生效)、verb 既有语义、24 skills 其余部分、`.speccode/` 其他契约
- **用户可见变化**:新项目 init 后 worktree 落 `.speccode/worktrees`;config 多一个 `host` 字段
