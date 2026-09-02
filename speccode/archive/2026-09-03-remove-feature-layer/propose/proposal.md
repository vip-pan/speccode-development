# Proposal: remove-feature-layer

## Why

普通需求走 feature 中间层(creating-feature → creating-worktree 两步、finishing 两步)经数轮实战验证为浪费——大多数需求不需要聚合分支;但大需求(多阶段、整体上线 all-or-nothing)仍需要一条聚合分支。v3 把 feature 层从「默认必经」改为「大需求 opt-in」,普通路径砍半,大需求能力保留。

## What Changes

- **拓扑双层化**:worktree 分支弃 `worktree-` 统一前缀,直接使用 `<type>/<slug>` 功能命名;普通需求 trunk → worktree 分支 → PR squash → trunk
- **大需求 opt-in**:`creating-feature` 语义改为「创建集成分支 + 父实体 state」(不建 worktree);`finishing-feature` 语义改为「children 全 completed 门禁 → PR squash → trunk → 清父实体」;两者仅大需求使用
- **state 目录改名**:`state/features/` → `state/branches/`,统一抽象「每个 state 描述一条分支」;schema 变更(`feature_branch`+`worktrees{}` → `branch`+`worktree`+`merge_target`;父实体 `kind:"integration"`+`children[]`);提供 v2 兼容读取与迁移
- **reconcile 重写为 C 路径识别**:`config.worktree_dir` 之下的 worktree = 管辖对象(与分支名无关);ancestry / `worktree_overrides` / conflicts 归属逻辑删除(worktree↔state 1:1);父实体(无 worktree 的裸分支)由 state 识别
- **合并规则**:子→集成 = 本地 squash(合并后复测保留);集成→trunk 与普通 worktree→trunk = 仅 PR squash;合并模式四项收敛为三项(PR+等待 / PR+不等待 / 保留),「本地 squash」模式对 trunk 死亡、转世为子→集成路径
- **trunk 保护探测**:init 与 finishing-worktree 建 PR 前经 `gh api` 探测仓库 merge 设置(`allow_squash_merge` 等),非 squash-only 时警告 + 指路(prose 约定兜底;否决插件代合并)
- **依赖 = 切点即依赖**:子分支一律从集成当前 head 切;无依赖机制,父实体 children 状态板 + status 聚合渲染
- **exploring 前置校验**:MUST 在 trunk 执行(不符仅警告不阻断)+ 先 `fetch & pull`
- **exploring 出口形态确认**(三岔):单普通需求 / 多个独立普通需求 / 大需求(集成)——本质为上线原子性判定,agent 信号建议 + 用户确认,大需求形态与子需求清单落档 topic
- **收尾惯例**:合并动作完成后切换到目标分支(trunk 或集成分支)并 `fetch & pull`
- **`config.worktree_prefix` 退役**:config version 2 → 3,字段移除;syncing/archiving/brainstorming/dispatching-parallel-agents 等 8 处 trunk 防护改「非 trunk 的 `<type>/<slug>` 分支」
- 主规格 delta:`git-workflow-lifecycle`(11 MODIFIED + 2 REMOVED + 4 ADDED)、`speccode-config-management`(4 MODIFIED + 2 REMOVED + 2 ADDED)、`session-memory`(1 MODIFIED),随 syncing 合并

## Capabilities

- git-workflow-lifecycle(修改)
- speccode-config-management(修改)
- session-memory(修改)

## Impact

- **代码**:`lib/state.mjs`(v3 schema + 目录 + 迁移)、`lib/reconcile.mjs`(路径识别重写)、`lib/prtool.mjs`(repo merge 设置探测)、`lib/detect.mjs`/`lib/slug.mjs`(prefix 校验退役)、`bin/speccode.mjs`(reconcile opts、新探测 verb、VERBS 表)
- **命令**:`creating-feature`、`creating-worktree`、`finishing-worktree`、`finishing-feature` 重写;`exploring`、`status`、`reset`、`init`、`syncing`、`archiving`、`brainstorming`、`dispatching-parallel-agents` 更新守卫/渲染;`rename-memory` 承接桥宿主移至 creating-worktree
- **测试**:`tests/reconcile.test.mjs`、`tests/state.test.mjs`、`tests/cli.test.mjs` 大改;新增 prtool 探测用例(DI,不打真实 API)
- **文档**:README ×4(拓扑图、命令表)、CLAUDE.md(三层描述改两层)、CHANGELOG(发版时,BREAKING 标注)
- **兼容**:state v2 兼容读取 + 迁移;config v2 读兼容(init 升级 v3);`worktree_overrides` 字段被忽略
- **规格**:`speccode/spec/` 三 capability 经 syncing 合并,不直接修改
