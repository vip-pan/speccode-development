# ZCode 宿主映射

> **待验证总标注**:ZCode 的 manifest schema、安装命令、工具名均未经真机验证。本文件按用户确认的「Kimi Code 同款」假设编写,发布前 MUST 对照 ZCode 官方文档逐项核对(见 `.zcode-plugin/plugin.json` 的 `_note`)。

## 安装

1. ZCode:按 Kimi Code 同款假设,走插件安装命令指向本仓库(**待验证**:实际命令与 manifest 发现机制以官方文档为准)。
2. 安装引擎 shim:

   ```bash
   bash scripts/install-shim.sh
   ```

3. 验证:`speccode plugin-root --cwd .` 输出本插件根绝对路径。

## 工具映射

| speccode 语义 | ZCode 落地(待验证) |
|---|---|
| 向用户提问(一次一问、给选项) | 结构化提问工具(若有);否则文本提问,保持一次一问与选项格式 |
| 派发子代理 | ZCode 的 agent/子代理机制(**待验证** 工具名);无子代理机制时走 skill 声明的降级路由 |
| 引擎调用 `speccode <verb> --cwd .` | PATH shim;缺 shim 时 `node <plugin-root>/bin/speccode.mjs <verb> --cwd .` |
| 插件内文件引用 | `speccode plugin-root --cwd .` 解析 |

## 宿主注意

- `.zcode-plugin/plugin.json` 的 `skillInstructions` 与本文件同步维护;工具名核对后两处一起改。
- ZCode 为 GLM 自研、类 Kimi Code 形态(探索期调研结论);Kimi 的映射经验大概率直接适用,但**一切以真机验证为准**。
- 真机验证后:移除本文件与 manifest 的「待验证」标注,并把结论回写 host-detection 的宿主标记(若 ZCode 有可靠 env/config dir 标记)。
