---
tier: 1
---
# Proposal: host-adapters(六宿主 adapter + 宿主映射文档 + bin shim)

## Why

前三个子需求已就绪(仓库根即插件根、prose 宿主中立、`config.host` 探测),六宿主适配只剩最后一层:每宿主一份薄 adapter(指向共享 skills/)+ 一份宿主映射文档(安装/工具映射/注意)+ 一个通用 PATH shim 安装脚本。这是让 speccode 在 Codex / Kimi Code / ZCode / OpenCode / Pi 上可安装可运行的收尾层。

## What Changes

- 新增 5 个宿主 adapter(仓库根,惰性不进打包声明):
  - `.codex-plugin/plugin.json`(Codex 插件 manifest,skills 指向 `./skills/`)
  - `.kimi-plugin/plugin.json`(+`skillInstructions` 工具映射,仿 superpowers 实测范本)
  - `.zcode-plugin/plugin.json`(**ZCode 按 Kimi 同款**,用户确认;未验证处标注「待验证」)
  - `.opencode/INSTALL.md`(opencode.json plugin 数组注入说明)
  - `.pi/extensions/speccode.ts`(Pi 扩展骨架,API 以官方文档为准,标注待验证)
- 新增 `references/host-mapping/` 五份宿主文档(codex / kimi-code / zcode / opencode / pi),每份三段:安装 / 工具映射 / 宿主注意(codex 含 multi_agent 子代理机制教学)
- 新增 `scripts/install-shim.sh`:symlink `bin/speccode` 到用户 PATH 目录(探测 `~/.local/bin` 优先,失败打印手动命令);wrapper 已符号链接安全(neutralize-prose 交付)
- `AGENTS.md` 仓库结构描述补 adapter 目录清单一句话
- 引擎与 24 skills **零变化**

## Capabilities

- `host-adapters`(新增 capability:adapter 清单与形态、宿主映射文档、bin shim 安装)

## Impact

- **受影响**:仓库根新增 5 个 adapter 目录与 `scripts/`(全部惰性,不进 plugin.json 打包声明,直装用户多带几个文件——superpowers 同款先例);`references/` 新增五份文档(进打包组件,随插件分发)
- **不受影响**:引擎、verb、24 skills、CC 安装链路(marketplace 零变化)、既有测试
- **用户可见**:非 CC 宿主从此有官方安装路径;CC 用户零感知
- **诚实边界**:各宿主 manifest schema / 安装命令 / Pi 扩展 API 未真机实测,全部显式标注「待验证」——真机 dogfood 与修正归后续迭代
