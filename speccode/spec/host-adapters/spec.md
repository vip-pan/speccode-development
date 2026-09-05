# host-adapters Specification

## Purpose

多宿主分发的适配层契约——每个非 Claude Code 宿主一份薄 adapter(仅声明指向共享 `skills/` 的引用与宿主差异映射,零内容拷贝),宿主映射文档集中承载深度宿主机制(安装/工具绑定/注意),PATH shim 安装器让 `speccode <verb>` 在任何宿主可用。未经验证的宿主信息 MUST 显式标注「待验证」,不冒充已验证。

## Requirements

### Requirement: 六宿主 adapter 清单与形态

仓库 SHALL 为六宿主各提供一份安装入口:Claude Code 走既有 `.claude-plugin/`(marketplace);Codex 为 `.codex-plugin/plugin.json`;Kimi Code 为 `.kimi-plugin/plugin.json`(含 `skillInstructions` 工具映射);ZCode 为 `.zcode-plugin/plugin.json`(**按 Kimi 同款形态**,未实测项标注「待验证」);OpenCode 为 `.opencode/INSTALL.md`;Pi 为 `.pi/` 下扩展骨架与安装说明。每个 adapter SHALL 仅声明指向共享 `skills/` 的引用与宿主差异映射,SHALL NOT 拷贝任何 skill 正文内容(单源纪律);adapter 目录 SHALL NOT 被声明进 plugin.json 打包组件。凡未经真机验证的 manifest schema、安装命令或宿主 API,相关文档 MUST 显式标注「待验证」。

#### Scenario: 六宿主入口齐备
- **WHEN** 检查仓库根
- **THEN** 存在 `.codex-plugin/plugin.json`、`.kimi-plugin/plugin.json`、`.zcode-plugin/plugin.json`、`.opencode/INSTALL.md`、`.pi/` 安装入口,且 `.claude-plugin/plugin.json` 既有形态不变

#### Scenario: manifest 合法且单源
- **WHEN** 解析三个 plugin.json 与 `.pi` 扩展骨架
- **THEN** 均为合法 JSON/TS,`skills` 字段指向 `./skills/`(或等效共享引用),正文无任何 skill 内容拷贝

#### Scenario: ZCode 待验证显式标注
- **WHEN** 检查 `.zcode-plugin/` 相关文档与 manifest
- **THEN** 含「待验证」标注(标明 schema/安装命令未经真机验证,以官方文档为准)

### Requirement: 宿主映射文档

`references/host-mapping/` SHALL 为五个非 Claude Code 宿主各提供一份文档(`<host>.md`:codex、kimi-code、zcode、opencode、pi),每份 SHALL 含三段:安装方式、工具映射(提问/子代理/任务清单等语义到宿主工具的绑定)、宿主特有注意(如 Codex 的 multi_agent 子代理机制);skill 正文 MUST NOT 引用这些文档(host-neutral-prose 契约——由 adapter 与宿主上的 agent 按需读取)。

#### Scenario: 五份映射文档结构齐备
- **WHEN** 检查 `references/host-mapping/`
- **THEN** 存在 codex.md、kimi-code.md、zcode.md、opencode.md、pi.md,各含安装/工具映射/宿主注意三段

#### Scenario: skills 不内联宿主细节
- **WHEN** 检索 `skills/*/SKILL.md`
- **THEN** 无对 `references/host-mapping/` 的引用(宿主绑定经 manifest skillInstructions 或宿主 agent 按需读取映射文档)

### Requirement: bin shim 安装

`scripts/install-shim.sh` SHALL 以 symlink 方式把 `bin/speccode` 安装进用户 PATH 目录(探测 `~/.local/bin` 优先;失败时打印等效手动命令而非静默失败);五个非 CC 宿主的安装文档 SHALL 包含 shim 步骤;`bin/speccode` wrapper SHALL 保持符号链接安全(符号链接 shim 必须可用)。

#### Scenario: shim 安装后 PATH 可用
- **WHEN** 在临时 PATH 目录执行 `scripts/install-shim.sh`(注入目标目录),随后以该目录在 PATH 中调用 `speccode <verb>`
- **THEN** 调用成功且输出与 `node bin/speccode.mjs <verb>` 一致

#### Scenario: 无可写目录时不静默失败
- **WHEN** 脚本无法写入任何候选 PATH 目录
- **THEN** 打印等效手动命令(symlink 命令原文)并以非零退出
