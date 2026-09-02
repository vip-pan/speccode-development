# Tasks: remove-feature-layer

## 组1:lib/state.mjs — v3 schema 与迁移(TDD,先红后绿)

- [x] `tests/state.test.mjs`:`state/branches/` 目录与新 schema 用例——writeState 落 `state/branches/<type>__<slug>.json`;readState 读 v3(普通分支含 branch/worktree/merge_target,父实体含 kind/children 仅 {slug});双格式运行——v2 遗留文件(`state/features/` + `feature_branch` + `worktrees{}`)按 v2 语义原样读写(normalizeState 按目录与字段形态识别格式,legacy command 规范化保留),`worktree_overrides` 被忽略;先红
- [x] `lib/state.mjs`:实现 v3(`listActiveFeatures`/`readState`/`writeState`/`deleteState` 改 `state/branches/`;normalizeState 增 v2→v3 兼容读取:双目录探测、字段映射、worktrees 条目提升;写入恒 v3);迁移函数 `migrateStateV2toV3(speccodeDir)`(逐文件转换移目录,供 init 调用,含空目录清理)
- [x] 全量 `node --test ./plugins/speccode/tests/*.test.mjs` 绿(state 相关既有用例重构为 v3 场景)

## 组2:lib/reconcile.mjs — C 路径识别重写(依赖组1)

- [x] `tests/reconcile.test.mjs` 重构:路径识别用例(worktree_dir 下未登记 → orphan;state 登记非 completed 但 git 缺失 → orphan;completed 豁免;merge_target 分支缺失 → orphan;worktree_dir 外宿主 worktree 不可见);父实体用例(裸分支由 state 识别;children 登记 slug 无子 state → 渲染 pending,不报 orphan);删除 ancestry/overrides/conflicts 既有用例;pr_open 推进/回退用例保留改造;先红
- [x] `lib/reconcile.mjs`:重写(opts 去 prefix,增 worktreeDir;`isPathInside` 判管辖;1:1 对账;pr_open 推进逻辑保留;children 不参与对账写——仅状态派生)
- [x] `bin/speccode.mjs`:reconcile verb 调用点改传 `worktree_dir`(去 prefix);全量绿

## 组3:lib/prtool.mjs — squash 设置探测(独立,可并行)

- [x] `tests/prtool.test.mjs`(DI 注入 runner,不打真实 API):`repoMergeConfig(tool, cwd)` 解析 `gh api repos/:owner/:repo` 的 `allow_squash_merge/allow_merge_commit/allow_rebase_merge`;`isSquashOnly()` 判定;gh 失败 → `null`(warn-only 语义);先红
- [x] `lib/prtool.mjs` 实现两个函数;`bin/speccode.mjs` 新 verb `repo-merge-config --cwd .`(透传);全量绿

## 组4:命令 prose — 收发四命令重写(依赖组1/2/3)

- [x] `commands/creating-worktree.md`:分支命名改 `<type>/<slug>`(去 worktree- 前缀校验);基点判定(无父实体 → 从 config.trunk 切;父实体存在 → 从集成 head 切并打印确认);slug=topic 承接(rename-memory,复用既有三分支契约);登记父实体 children(有父时)与写 `merge_target`;其余(setup/基线/引导)保留
- [x] `commands/creating-feature.md`:重写为大需求 opt-in——建集成分支(trunk HEAD)+ 父实体 state(kind/children 空清单)+ 承接父 topic + onFeatureCreated 钩子;打印「大需求模式,子分支经 creating-worktree 切出」
- [x] `commands/finishing-worktree.md`:merge_target 路由(非 trunk → 本地 squash 自动路径 + 复测 + 子 state 置 completed【父实体 children 仅身份不写】+ 收尾切到集成 fetch&pull;trunk → 三项菜单「PR+等待/PR+不等待/保留」);建 PR 前 `repo-merge-config` 探测警告;丢弃路径保留;清理来源限定去 prefix
- [x] `commands/finishing-feature.md`:重写为父实体终局——门禁(children 全 completed + 对账 orphans)→ PR squash → 阻塞等待/`--resume`(waiting_trunk_pr)→ 删父实体 state → 集成分支保留 → 切回 trunk + fetch&pull;钩子保留

## 组5:命令 prose — 守卫与渲染更新(依赖组4,可并行组4后半)

- [x] `commands/exploring.md`:前置加「先 fetch&pull(warn-only)+ HEAD 非 trunk 警告不阻断」;出口加需求形态确认(三岔:单普通 / 多个独立普通 / 大需求——上线原子性信号建议 + 用户确认,大需求落档父 slug + 子清单并引导 creating-feature)
- [x] `commands/status.md`:`state/branches/` 渲染 + 父实体 children 树
- [x] `commands/syncing.md` / `commands/archiving.md` / `commands/brainstorming.md` / `commands/dispatching-parallel-agents.md`:trunk 防护改「HEAD 必须为非 trunk 的 `<type>/<slug>` 分支」
- [x] `commands/reset.md`:清理来源限定去 prefix;「无 active feature」改「无 active 分支」;config 字段清单去 worktree_prefix
- [x] `commands/init.md`:config v3 字段集(去 worktree_prefix);检测 `state/features/` 提供一次性迁移(询问确认 + reconcile 验证);squash-only 探测提示(可选,经 repo-merge-config)
- [x] 全仓 grep 清点:`worktree_prefix` 与 `worktree-` 触点归零(archive/、CHANGELOG 历史小节、.ua/ 除外)

## 组6:文档核对(依赖组5)

- [x] `plugins/speccode/README.md` / `README_CN.md`:拓扑图(三层→双层+opt-in 集成)、命令表语义(creating-feature/finishing-feature 标注 opt-in)、worktree 前缀表述移除;中英结构一一对应
- [x] `CLAUDE.md`:三层分支拓扑描述改双层;worktree 前缀表述移除;不硬编码版本/测试数/命令数
- [x] `CHANGELOG.md` 不改(发版时);确认 BREAKING 条目素材在归档 proposal 中可引用

## 收尾验证

- [x] 全量测试绿:`node --test ./plugins/speccode/tests/*.test.mjs`(glob 形式)
- [x] 手动冒烟(tmp 仓库):v2 state 迁移 → creating-worktree(`<type>/<slug>` 命名)→ reconcile 路径识别 → repo-merge-config 输出 → finishing-worktree 路由提示
- [x] 规格核对:各 delta 的 MODIFIED requirement 标题与主规格逐字一致(git-workflow-lifecycle 11 条 / speccode-config-management 4 条 / session-memory 1 条;REMOVED/ADDED 不参与逐字核对)
