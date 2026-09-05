# 宿主映射文档总览

speccode 的多宿主支持:每个非 Claude Code 宿主一份三段式映射文档(安装 / 工具映射 / 宿主注意)。skill 正文宿主中立(host-neutral-prose 契约),不引用本目录;宿主绑定经各 adapter 的 manifest `skillInstructions` 内嵌摘要 + 本目录详细文档承载。

| 宿主 | adapter 入口 | 映射载体 | 验证状态 |
|---|---|---|---|
| Claude Code | `.claude-plugin/`(marketplace) | prose 原生(无需映射) | ✅ 主宿主,持续 dogfood |
| Codex | `.codex-plugin/plugin.json` | 本目录 codex.md | ⚠️ 安装命令待验证;multi_agent 机制来自实测调研 |
| Kimi Code | `.kimi-plugin/plugin.json` + `skillInstructions` | manifest 内嵌 + 本目录 kimi-code.md | ⚠️ 范本经 superpowers 实测;本仓装法待验证 |
| ZCode | `.zcode-plugin/plugin.json` + `skillInstructions` | manifest 内嵌 + 本目录 zcode.md | ❌ 待验证(按 Kimi 同款假设,用户确认) |
| OpenCode | `.opencode/INSTALL.md` | 本目录 opencode.md | ⚠️ 注入方式待验证 |
| Pi | `.pi/extensions/speccode.ts` | 本目录 pi.md | ❌ 待验证(扩展 API 假设) |

通用步骤(所有非 CC 宿主):

1. 按各宿主文档安装(插件根 = 本仓库根)。
2. `bash scripts/install-shim.sh` —— 把 `speccode` 引擎 shim 装进 PATH。
3. `speccode plugin-root --cwd .` 验证。
4. 在目标项目 `/speccode:init`(宿主身份会被探测并经你确认写入 `config.host`)。

待验证项核对完成后:MUST 移除对应「待验证」标注并把结论回写本表。
