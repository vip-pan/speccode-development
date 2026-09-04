---
tier: 1
---
# Proposal: flatten-repo(仓库扁平化单仓 + 仓名 speccode)

## Why

大需求 multi-host-support 的硬约束:Kimi Code / ZCode / Pi 等宿主走 git URL 直装,**插件 root 必须等于 repo root**;现插件嵌套在 `plugins/speccode/`,任何 per-host adapter 都无处挂载。同时开发文档存在 CLAUDE.md 单头维护问题,AGENTS.md(跨宿主标准)应升为真源。

## What Changes

- **BREAKING**: 插件根从 `plugins/speccode/` 扁平至仓库根(`.claude-plugin/marketplace.json` 的 source 改为 `"./"`,plugin.json 与 marketplace.json 同目录并存,superpowers 实证形态)
- **BREAKING**: 仓库三层统一名 `speccode-development` → `speccode`(marketplace name + GitHub 仓名 + 根目录语义;插件 name 保持 `speccode`;GitHub 自动重定向保老链路)
- 插件设计文档 `plugins/speccode/README.md` + `README_CN.md` → **`docs/DESIGN.md` + `docs/DESIGN_CN.md`**(与根门面 README 撞名,四文件分工契约不变、仅落点变化)
- **AGENTS.md 升为开发文档真源**(现 CLAUDE.md 内容迁入 + 根目录 codemap 注入块并入);**CLAUDE.md 降为薄壳**(`@AGENTS.md` 引入 + Claude 专属补充,不复制正文)
- 路径修复:`.github/workflows/test.yml` 测试 glob、根 README 版本徽章 raw URL、`plugin.json` homepage/repository、CONTRIBUTING、文档互链
- 引擎与命令行为**零变化**:bin 裸调、verb 清单、`.speccode/` 运行时定位、`server.cjs` manifest 上溯路径(扁平后恰好仍两级)均不动

## Capabilities

- `plugin-packaging`(MODIFIED:marketplace 仓库结构、插件根目录布局、plugin.json 元数据、命令裸调/源码边界/命名空间/frontmatter/测试路径的 scenario 路径、文档三层分离、仓库层重命名、不打包语义、版本发布纪律、references 元数据路径、文档版本信息、双语互链、持续集成测试、许可证声明路径)

## Impact

- **受影响代码**:零引擎改动(`lib/`、`bin/` 原样搬移,内部 import 全相对路径);唯一代码核验点是 `references/visual-companion-scripts/server.cjs` 的 manifest 上溯(已核:扁平后深度不变)
- **受影响系统**:GitHub 仓名(维护者手动 rename)、本地 remote URL、Claude marketplace 用户(`marketplace add` 新 URL;老 URL 经 GitHub 重定向仍可用)
- **不受影响**:`.speccode/` 运行时数据契约、24 个 skill 内容与调用名、`support/` 自用工作流、dogfood spec 文档(`speccode/`)
