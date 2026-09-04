# Design: flatten-repo

## Context

现布局:仓库 = marketplace 仓(`.claude-plugin/marketplace.json` 指向 `./plugins/speccode`)+ 插件本体嵌套一层。探索阶段(见父实体记忆 `feature/multi-host-support`)确认:Kimi/ZCode/Pi 系宿主以 git URL 直装,要求插件 root = repo root;superpowers(obra,v6.3.0,11 宿主)的实证形态是仓库根即插件根,`.claude-plugin/` 内 plugin.json 与 marketplace.json 并存,仓库根同时承载 docs/tests 等开发资料(git 直装多带文件为可接受成本)。

约束:git 跟踪内容而非目录名,`git mv` 保历史;主规格「文档三层分离」的四文件分工契约必须维持;「不打包本仓自用工具」契约在插件根=仓库根后需语义重构而非删除;Node ≥ 24 纯 ESM 零依赖,无 build 步骤可借力。

## Goals

- 仓库根 = 插件根 = marketplace 仓(单仓三合一),`git mv` 迁移不破历史
- 三层统一名改为 `speccode`;AGENTS.md 升真源、CLAUDE.md 薄壳化
- 全量测试在新布局下全绿;全仓 `plugins/speccode` 活路径引用清零(CHANGELOG 历史条目与归档文档除外)

## Non-Goals

- 不改引擎逻辑与 verb 清单;不改 24 个 skill 的正文内容(中性化是 `neutralize-prose` 的职责)
- 不做任何 per-host adapter 与安装脚本(是 `host-adapters` 的职责)
- 不改 `.speccode/` 运行时数据契约与 `worktree_dir` 缺省(是 `host-detection` 的职责)
- 不 bump `plugin.json` version、不改 CHANGELOG 已发布条目(发版时统一处理)
- 不动 dogfood 工作流(`support/install-skills.sh` 多宿主化归 `neutralize-prose`)

## Decisions

1. **扁平化单仓,而非拆仓或 subtree 发布管道**——探索期三案对比:拆仓使 dogfood 文化整体搬家;subtree split 发布 hash 与主仓 tag 永久错位、安装文档终身解释绕行;superpowers 11 宿主实证单仓可行,且 dogfood(speccode 用 speccode 开发 speccode)是本项目核心文化,扁平化是唯一不断裂的方案。
2. **设计文档落 `docs/DESIGN.md` + `docs/DESIGN_CN.md`**(用户选定)——与根门面 README 撞名不可合并(四文件分工是主规格契约);docs/ 目录使 root 只留门面 + 代码;命名延续 `_CN` 后缀惯例。被否:根目录 DESIGN.md(root 挤入四个 README 系文件);合并进根 README(破坏契约 + 重写两版结构)。
3. **AGENTS.md 为开发文档真源,CLAUDE.md 为薄壳**(用户选定)——AGENTS.md 是跨宿主行业收敛方向(Codex 等原生读取),真源放通用侧、方言侧做壳,未来新增宿主零成本;CLAUDE.md 仅含 `@AGENTS.md` 引入 + Claude 专属补充,禁止复制正文防双头漂移。
4. **「不打包」语义重构为「打包边界 = plugin.json 声明的组件」**——插件根=仓库根后,root 下必然混入 support/、speccode/(dogfood)、docs/、.github/ 等;superpowers 同款先例证明惰性文件无害。契约改为:这些内容 SHALL NOT 被声明进插件组件,自用工具 SHALL NOT 出现在 skills/bin/hooks/references 打包目录内。被否:维持「插件目录不含自用文件」字面语义(与单仓三合一矛盾,无解)。
5. **迁移顺序:设计文档先移 docs/,插件其余内容后移根**——避免 git mv 时 README 撞名覆盖根 README。

## Risks

| 风险 | 缓解 |
|---|---|
| 遗漏活路径引用(`plugins/speccode`)导致文档/CI/脚本指向不存在路径 | 收尾 grep 全仓清零(排除 CHANGELOG 历史与 `speccode/archive/`);全量测试 + 从非 root cwd 跑 cli 测试回归 cwd 解耦 |
| marketplace 老用户升级断链 | GitHub rename 自动重定向,老 `marketplace add` URL 与老 remote 均保活;发布说明注明新 URL |
| git mv 撞名覆盖根 README | 迁移顺序决策 5:设计文档先走 docs/ |
| dogfood 目录 `speccode/` 与插件名同根混淆 | 接受(superpowers 先例);design/tasks 文档中明示其惰性身份,不进打包声明 |
| CI 徽章 raw URL 失效 | 路径修复任务单列;spec scenario 校验徽章 URL 指向 `.claude-plugin/plugin.json` |

## Open Questions

无——仓名、设计文档落点、AGENTS.md 方向均已经用户确认。
