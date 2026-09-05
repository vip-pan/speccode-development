# Design: host-adapters

## Context

superpowers(11 宿主)的实证形态:repo root 即插件 root,per-host adapter 是**薄 manifest**(一份 plugin.json 指回共享 skills/),内容零拷贝零生成;深度宿主机制(codex multi_agent 等)放 per-host 参考文档由 adapter 指向。本仓前三个子需求已就绪:root=插件根(flatten-repo)、prose 零宿主 token 且 shim 可 symlink(neutralize-prose)、`config.host` 可探测(host-detection)。宿主差异三类收敛完毕:提问/子代理走语义+映射,bin 走 PATH shim。

约束:零 build 纪律(不允许生成式 adapter);host-neutral-prose 契约(skills 正文不得内联宿主细节);打包边界 = plugin.json 声明(adapter 目录天然惰性);ZCode 未实测(用户确认按 Kimi 同款假设)。

## Goals

- 六宿主每家一份可安装入口;边际成本 = 一份 manifest + 一份映射文档
- 未验证信息显式标注,不冒充已验证
- 全部内容 declarative / 文档化,无引擎逻辑改动

## Non-Goals

- 不做各宿主真机实测与修正(dogfood 后续迭代,标注待验证)
- 不解析各宿主 MCP 配置格式(探测保持 host-detection 现状)
- 不改 README 定位与命令门面(docs-multi-host 职责)
- 不改 24 skills 正文与引擎

## Decisions

1. **adapter = 薄 manifest 指回共享 skills/**——superpowers 11 宿主实证的最小形态;`.kimi-plugin` 带 `skillInstructions` 内嵌运行时映射(实测范本存在),`.zcode-plugin` 按用户确认走 Kimi 同款。被否:每宿主内容拷贝(漂移源);build 生成各宿主格式(违零 build)。
2. **宿主映射文档集中 `references/host-mapping/<host>.md`(五份,CC 豁免)**——每份三段:安装 / 工具映射 / 宿主注意。skills 宿主中立不得内联宿主细节(host-neutral-prose),深度机制(codex multi_agent 子代理教学、opencode plugin 注入、pi 扩展)必须有处安放;文档供宿主上的 agent 与 adapter 指引按需读取。被否:全塞 manifest(运行时注入字段只适合短映射,长教学会撑爆);分散在各 adapter 目录(检索一致性差)。
3. **shim 安装 = 单脚本 `scripts/install-shim.sh`**——各宿主机制相同(往 PATH 放 `speccode`),无需每宿主一套;脚本探测 `~/.local/bin`(fallback 打印手动命令),symlink 到 wrapper(其符号链接解析已由测试锁定)。被否:放进 bin/(会被 CC 的 PATH 注入语义污染);每宿主文档各写安装命令(重复)。
4. **adapter 目录不进打包声明、不视为自用工具**——plugin-packaging「不打包本仓自用工具」的边界 = plugin.json 声明组件;adapter 是「给宿主的分发配置」,与 support/(自用)性质不同,惰性共存于仓库根(直装多带文件为 superpowers 实证的可接受成本)。无需改该 requirement。
5. **未验证纪律**——ZCode manifest schema、各宿主安装命令、Pi 扩展 API 全部在文档内显式标注「待验证」;detect-host 的各宿主标记仅核对不扩充(避免堆猜测,真机验证后补)。

## Risks

| 风险 | 缓解 |
|---|---|
| 宿主 manifest schema / 安装命令与实际不符 | 文档标注「待验证」;真机 dogfood 迭代修正;Kimi 范本经 superpowers 实测,风险最低 |
| shim 目标目录因人而已(~/.local/bin 不在 PATH) | 脚本探测 + 失败打印手动命令;host-mapping 文档给出各 shell 配置指引 |
| Pi 扩展 API 不明 | 提供最小骨架 + 待验证标注,不假装完整 |
| adapter 目录被误认为自用工具而清理 | design 决策 4 记录性质区分;AGENTS.md 仓库结构描述补一句 |

## Open Questions

无——ZCode 形态已由用户确认(按 Kimi 同款),其余均为文档内容决策。
