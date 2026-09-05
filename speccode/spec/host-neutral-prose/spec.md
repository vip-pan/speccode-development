# host-neutral-prose Specification

## Purpose

命令交互层(skills)的宿主中立契约——prose 禁止宿主专属工具标识,提问与子代理派发走宿主中立语义,依赖子代理的命令显式声明降级路由,插件内文件引用经引擎自定位解析。宿主与具体工具的绑定由各宿主 adapter(per-host manifest 映射或映射文档)承载,MUST NOT 回流进命令正文。

## Requirements

### Requirement: 命令正文宿主中立纪律

`skills/*/SKILL.md` 的正文 MUST NOT 引用宿主专属工具标识——包括但不限于 `AskUserQuestion`、`Task tool`、`subagent_type`、`general-purpose`、`TodoWrite`、`${CLAUDE_PLUGIN_ROOT}` 及宿主指令文件名(`CLAUDE.md`/`AGENTS.md`)。向用户提问 SHALL 以「向用户提问」语义表达(含一次一问、给出具体选项的强信号);子代理派发 SHALL 以「派发子代理」语义表达;宿主如何落实这些语义(结构化提问工具、子代理机制)由各宿主 adapter 承载。

#### Scenario: 宿主专属 token 零残留
- **WHEN** 对 `skills/` 全量检索 `AskUserQuestion|CLAUDE_PLUGIN_ROOT|general-purpose|subagent_type|TodoWrite`(大小写敏感)
- **THEN** 零匹配

#### Scenario: CC 提问行为不退化
- **WHEN** 在 Claude Code 上运行含提问环节的命令(如 exploring 的形态确认)
- **THEN** 模型按可用工具自选提问方式,结构化提问工具可用时优先使用,输入清洗 hooks 行为不变

### Requirement: 子代理依赖声明

依赖子代理派发的 skill(`subagent-driven-development`、`dispatching-parallel-agents`、`requesting-code-review`)SHALL 在正文显式声明该依赖,并给出无子代理宿主上的降级路由(串行执行 / `executing-plans` 链路);不依赖子代理的 skill MUST NOT 因宿主能力差异被阻塞。

#### Scenario: 依赖与降级路由成对出现
- **WHEN** 检查三个依赖型 skill 的正文
- **THEN** 各含子代理依赖声明与降级路由表述(如「宿主无子代理派发能力时,按 executing-plans 串行执行」)

### Requirement: 引擎自定位插件根

引擎 SHALL 提供 `plugin-root` 只读 verb,输出插件根绝对路径(以引擎自身文件位置为锚,与安装形态无关);skills 引用插件内文件(`references/` 模板与脚本)SHALL 经 `$(speccode plugin-root --cwd .)` 解析,MUST NOT 使用宿主专属变量。

#### Scenario: plugin-root 输出有效插件根
- **WHEN** 执行 `speccode plugin-root --cwd .`
- **THEN** 输出 `{"ok":true,"root":<绝对路径>}`,且该路径下存在 `bin/speccode.mjs`

#### Scenario: 插件内文件引用无宿主变量
- **WHEN** 检查 skills 与 references 中的插件内文件引用
- **THEN** 无 `${CLAUDE_PLUGIN_ROOT}` 形态;引用以 `$(speccode plugin-root --cwd .)/references/...` 形态表达
