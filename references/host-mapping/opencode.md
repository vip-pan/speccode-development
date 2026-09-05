# OpenCode 宿主映射

> 待验证:OpenCode 的 plugin 机制为 JS 插件体系,skills 注册方式随版本演进;以下以探索期实测信息为准。

## 安装

1. 在项目或全局 `opencode.json` 的 `plugin` 数组加入本仓库(见 [`.opencode/INSTALL.md`](../../.opencode/INSTALL.md);待验证:git 插件引用格式)。
2. 安装引擎 shim:

   ```bash
   bash scripts/install-shim.sh
   ```

3. 验证:`speccode plugin-root --cwd .` 输出本插件根绝对路径。

## 工具映射

| speccode 语义 | OpenCode 落地 |
|---|---|
| 向用户提问(一次一问、给选项) | 结构化提问工具(待验证:是否有 AskUserQuestion 等价物);否则文本提问 |
| 派发子代理 | OpenCode 的 agent 体系(待验证:subagent 模式与调用名);无子代理时走 skill 声明的降级路由 |
| 引擎调用 `speccode <verb> --cwd .` | PATH shim;缺 shim 时 `node <plugin-root>/bin/speccode.mjs <verb> --cwd .` |
| 插件内文件引用 | `speccode plugin-root --cwd .` 解析 |

## 宿主注意

- OpenCode 插件是 JS 模块(非纯 manifest),speccode 的 skills 注册依赖宿主的 skills 发现机制(**待验证**);若需 JS glue,参考 `.pi/extensions/speccode.ts` 的骨架思路另写 opencode 侧(保持待验证标注)。
- 仓库根的 `opencode.json`(codemap MCP 配置)是 speccode 仓库**开发者本地**的配置(已被 .gitignore,不在安装产物里),与用户侧安装无关,勿混淆。
