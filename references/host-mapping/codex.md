# Codex 宿主映射

> 待验证项以行内标注;其余内容来自探索期对 obra/superpowers Codex 适配的实测调研(spawn_agent / fork_turns / wait_agent 事件语义 / 模型 allowlist 为实测所得)。本 adapter 的 manifest 形态同样以 superpowers 的 Codex adapter 为范本(其安装链路未在本仓真机验证)。

## 安装

1. Codex CLI / Codex App:`/plugins` 搜索 `speccode` 安装,或按官方 plugin 安装流程指向本仓库(待验证:是否已进入官方 plugin 目录)。
2. 安装引擎 shim(让 `speccode <verb>` 进入 PATH):

   ```bash
   bash scripts/install-shim.sh
   ```

3. 验证:`speccode plugin-root --cwd .` 输出本插件根绝对路径。

## 工具映射

| speccode 语义 | Codex 落地 |
|---|---|
| 向用户提问(一次一问、给选项) | 文本提问(Codex 无结构化提问工具);保持一次一问与选项格式 |
| 派发子代理(implementer / reviewer / explorer) | multi_agent:`spawn_agent` / `wait_agent` / `followup_task`(待验证:`followup_task` 来自同源调研,未在本仓实测) |
| 引擎调用 `speccode <verb> --cwd .` | PATH shim(上步);缺 shim 时 `node <plugin-root>/bin/speccode.mjs <verb> --cwd .` |
| 插件内文件引用 | `speccode plugin-root --cwd .` 解析 |

## 宿主注意

- **子代理需开启 feature**:在 `~/.codex/config.toml` 加 `[features] multi_agent = true`(待验证:flag 名随 Codex 版本演进;以 `codex` 实际工具列表为准)。未开启时,依赖子代理的 skill 按其声明的降级路由串行执行。
- `spawn_agent` 建议 `fork_turns: "none"`(隔离上下文,而非全量复制会话)。
- `wait_agent` 是事件订阅不是轮询:有本地工作时不要空等;空闲等待用 5-10 分钟的有界时段。
- 模型名不要从文档/旧会话复制进 `spawn_agent`,先对照当前 preset 的 spawn allowlist。
