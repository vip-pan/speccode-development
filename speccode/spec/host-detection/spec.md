# host-detection Specification

## Purpose

宿主身份的引擎侧探测与记录契约——detect-host 只读 verb 以分层启发识别当前宿主(显式覆盖优先、未知回退 generic、不报错),init 经用户确认后写入 `config.host`;code_intel 探测按宿主分流(非 claude-code 宿主跳过 ~/.claude 专属探测)。宿主身份是命令层查表的确定性输入,各宿主 adapter 的映射知识在其上承载。

## Requirements

### Requirement: 宿主身份探测

引擎 SHALL 提供 `detect-host` 只读 verb,以分层启发探测当前宿主:会话环境标记 → cwd 宿主指令文件/配置目录;verb SHALL 支持 `--host <id>` 显式覆盖(用户确认为准,优先级最高)。探测取值 MUST 为枚举 `claude-code | codex | zcode | opencode | pi | kimi-code | generic`;无法判定时返回 `generic`,MUST NOT 报错。init SHALL 将探测结果经用户确认后写入 `config.host`;探测所得宿主身份 MUST NOT 在未经用户确认时静默落盘。探测所涉环境读取(fs/spawn/env)MUST 全部支持依赖注入,单测不触真机。

#### Scenario: 分层启发命中 claude-code
- **WHEN** 注入环境中存在 Claude Code 会话标记或 cwd 含 `.claude/` 配置目录,且无更高优先级信号
- **THEN** `speccode detect-host --cwd .` 返回 `{"ok":true,"host":"claude-code",...}`,并含命中来源(evidence)字段

#### Scenario: 显式覆盖优先于启发
- **WHEN** 执行 `speccode detect-host --cwd . --host zcode`,无论启发结果为何
- **THEN** 返回 `host: "zcode"`,evidence 标注来源为显式指定

#### Scenario: 未知环境回退 generic
- **WHEN** 注入环境无任何宿主标记(无 env、无指令文件、无配置目录)
- **THEN** 返回 `host: "generic"`,exit 0,不报错

#### Scenario: init 经用户确认写入
- **WHEN** init 运行探测后用户确认宿主身份
- **THEN** `config.host` 写入该枚举值;用户改选时以用户选择为准

### Requirement: code_intel 探测按宿主分流

`detect-code-intel-tools` SHALL 读取 `config.host`(缺失视为未记录,与 `claude-code` 同走全量探测)并传入探测逻辑;当宿主为非 `claude-code` 值时,探测 MUST 跳过 `~/.claude/plugins/installed_plugins.json` 与 `~/.claude.json` 两类探测;项目 `.mcp.json`、`command -v` bin 探测与项目配置目录探测 SHALL 对所有宿主恒开。evidence 字符串 SHALL 保留来源前缀(`.mcp.json:`、`bin:`、目录路径等)以可审计。

#### Scenario: 非 Claude 宿主跳过 ~/.claude 探测
- **WHEN** `config.host` 为 `codex`(或任一非 claude-code 枚举值),注入的 homeDir 下存在 ~/.claude 探测命中物
- **THEN** 探测结果 MUST NOT 含来自 `~/.claude/plugins` 或 `~/.claude.json` 的 evidence

#### Scenario: claude-code 宿主行为不变
- **WHEN** `config.host` 为 `claude-code` 或缺失
- **THEN** 探测行为与分流前完全一致(全部探测器开启,既有测试全绿)

#### Scenario: bin 与项目目录探测恒开
- **WHEN** 任一宿主下,某工具的 bin 在 PATH 命中或项目配置目录存在
- **THEN** 该工具相应维度(available/integrated)为 true,evidence 带来源前缀
