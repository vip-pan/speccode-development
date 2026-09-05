# Kimi Code 宿主映射

> 安装与工具映射来自探索期对 obra/superpowers Kimi 适配的实测调研(plugin.json `skillInstructions` 已内嵌同款映射)。

## 安装

1. Kimi Code:`/plugins install https://github.com/vip-pan/speccode`(待验证:仓库直装命令以 Kimi Code 官方文档为准)。
2. 安装引擎 shim:

   ```bash
   bash scripts/install-shim.sh
   ```

3. 验证:`speccode plugin-root --cwd .` 输出本插件根绝对路径。

## 工具映射

| speccode 语义 | Kimi Code 落地 |
|---|---|
| 向用户提问(一次一问、给选项) | `AskUserQuestion` 工具(不可用或 auto 模式时回落文本) |
| 派发子代理(implementer / reviewer / explorer) | `Agent` 工具(按宿主子代理类型;依赖子代理的 skill 自带降级路由) |
| 引擎调用 `speccode <verb> --cwd .` | PATH shim;缺 shim 时 `node <plugin-root>/bin/speccode.mjs <verb> --cwd .` |
| 插件内文件引用 | `speccode plugin-root --cwd .` 解析 |

## 宿主注意

- `skillInstructions`(见 `.kimi-plugin/plugin.json`)是运行时注入的映射摘要,与本文件保持一致;改动映射 MUST 两处同步。
- Kimi Code 原生支持 SKILL.md(Agent Skills 标准),skills 直接懒加载,无需兼容层。
- 文件/搜索/网络工具用宿主实际暴露名调用。
