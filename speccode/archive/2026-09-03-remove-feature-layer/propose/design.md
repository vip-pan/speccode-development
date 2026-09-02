# Design: remove-feature-layer

## Context

v2 拓扑为 trunk / feature / worktree 三层:每需求必经 creating-feature 与 finishing-feature,worktree 分支带 `worktree-` 硬前缀,reconcile 以「分支名前缀 + ancestry 归属」把 worktree 关联到 feature。实战结论:普通需求两步收发是浪费;但大需求(多阶段并行/串行、all-or-nothing 上线)需要聚合分支承载全部阶段后一次 PR。当前 trunk 干净(a3c2550,PR #35 刚交付),是 BREAKING 迁移的最佳窗口。

## Goals

- 普通需求路径砍半:creating-worktree 一步开分支,finishing-worktree 一步收尾(PR squash → trunk)
- 大需求保留聚合能力:集成分支 + 父实体,子阶段本地 squash 汇入,终局一次 PR
- 识别可靠:worktree 身份与分支名解耦(路径识别),用户手工分支零误伤
- 依赖零机制:切点即依赖,串并行由人依状态板决策

## Non-Goals

- 不做插件代合并(`gh pr merge` 由插件执行)——平台 squash-only 设置 + 提示已覆盖,交互保持「人点合并」
- 不做子需求间依赖图/自动阻塞——切点时序已编码串行语义
- 不删任何命令——23 个全保留,两个改语义转 optional
- 不做 display 层回归、不复活 `<feature>-complete`
- CHANGELOG 与版本发布不在本轮(发版纪律另走)

## Decisions

### D1: worktree 分支直接使用 `<type>/<slug>` 命名,`worktree_prefix` 退役

`branchToStateName('<type>/<slug>')` 编码对 worktree 分支原样成立,state/memory 文件命名机制零改动。`worktree-` 前缀的真正职能(身份识别)由 D2 接管。config version 2→3,字段集移除 `worktree_prefix`;v2 config 读兼容,init 升级时按字段 diff 机制移除(既有 v1→v2 升级先例)。

### D2: reconcile 改 C 路径识别

speccode 管辖的 worktree = `git worktree list` 中路径位于 `config.worktree_dir` 之下的条目,与分支名无关。判定依据:所有 speccode worktree 都由 creating-worktree 建在 worktree_dir 下,路径天然无歧义(`isPathInside` 已有兄弟前缀防护先例)。orphan 语义:①state 登记非 completed 但 git 缺失;②worktree_dir 下存在未登记 worktree;③`merge_target` 指向的分支不存在。worktree_dir 之外的 worktree(宿主自建)一律不归 speccode 管。被否备选:分支名识别(与用户手工 `<type>/<slug>` 分支冲突、误报 orphan)、纯 state 识别(丢失「建了 worktree 没登记」的半截创建发现能力)。

### D3: state 统一为 `state/branches/`,schema v3

每个 state 描述一条分支。普通分支:`{ branch, type, worktree, merge_target(恒写:普通分支写 trunk,子分支写集成分支名), status, pending_operation?, created_at, initial_branch }`;父实体:`{ branch, kind: "integration", children: [{ slug }], status, ... }`(children 仅身份登记,状态派生,见 D4)。`worktrees:{}` 子对象随 1:1 消亡。兼容:双格式运行(旧文件按 v2 语义原样读写,init 显式迁移),`worktree_overrides` 字段被忽略。状态枚举 `{pending, in_progress, pr_open, completed}` 不变。

### D4: 父实体 = 集成分支的登记簿,状态派生

`creating-feature`(opt-in)建 `<type>/<slug>` 集成分支 + 父实体 state(`kind: "integration"`)。children 清单在建子 worktree 时登记**仅 `{slug}`(纯身份)**;**状态不存储于父实体**——唯一真源是各子分支 state,门禁与 status 渲染时实时派生聚合;子收尾只写自己的 state、永不写父实体,消除并行收尾的读-改-写竞态与双真源漂移(children 登记了 slug 但无子 state = 计划未开工,渲染 pending)。父实体是无 worktree 的裸分支,只能由 state 识别(收进 reconcile 的 state 侧扫描)。子 slug 语义化自由命名(如 `marketing-requirements-list`),身份锚点是 children 清单而非命名前缀——上一轮探索的 `-p1` 前缀约定作废。

### D5: 依赖 = 切点即依赖

子分支一律从集成当前 head 切:并行兄弟同起点;串行后序在先序合入后再切,天然包含前序代码。兄弟间冲突在子→集成合并时暴露并在集成分支上解决;trunk 只见终局一次 squash。无依赖数据结构,status 按父实体 children 渲染状态板。

### D6: 合并规则与路由

finishing-worktree 按 state 的 `merge_target` 路由:`merge_target` 为非 trunk 分支(集成分支)→ 本地 squash 合并过去 + 复测 + 更新父实体 children 状态 + 收尾切到该分支 fetch&pull;`merge_target` 缺省(trunk)→ 仅 PR 可达,菜单三项「PR+等待 / PR+不等待 / 保留」,丢弃仅显式进入。本地 squash 的既有安全件全部保留(复测失败停止、先离开被清理目录、来源限定)。finishing-feature:children 全 completed 硬门禁 → PR squash(integration→trunk)→ 等待/`--resume`(phase `waiting_trunk_pr` 复用)→ 删父实体 state → 集成分支保留作历史 → 切回 trunk + fetch&pull。

### D7: squash 强度 = 平台设置 + 插件探测(a)+(c)

GitHub PR 创建时无 merge-method 参数,真强制点在仓库设置(仅允许 squash)。插件职责收缩为探测与指路:新 lib 函数(prtool,DI 可测)经 `gh api repos/:owner/:repo` 读 `allow_squash_merge/allow_merge_commit/allow_rebase_merge`,init 与 finishing-worktree 建 PR 前调用,非 squash-only 时警告 + 给出设置路径;prose 约定兜底(覆盖无权限改设置的场景)。被否:插件代合并(交互剧变 + 审批流/工具差异三摊复杂度,且与「PR+不等待」模式矛盾)。

### D8: rename-memory 承接桥宿主移至 creating-worktree

探索结论的承接(slug=topic → rename-memory)从 creating-feature 移到 creating-worktree:普通需求由 creating-worktree 承接(命中 slug 即迁);大需求拆分决策记父 topic、creating-feature 建集成时承接父 topic,子需求各自探索走各自 topic 由 creating-worktree 承接。session-memory 的「命令读写时机」相应更新。

### D9: syncing/archiving 等 trunk 防护改形态判断

「HEAD 必须以 worktree- 开头」改为「HEAD 必须为非 trunk 的 `<type>/<slug>` 形态分支」(能对上 state 登记更佳,但形态判断已足够防直提 trunk)。涉及 syncing、archiving、brainstorming、dispatching-parallel-agents、finishing-worktree、reset 六处守卫。knowledge trunk bootstrap 的 `chore/knowledge-*` 例外不受影响。

### D10: exploring 前置校验为 warn-only

exploring MUST 声明在 trunk 执行;HEAD 非 trunk 时打印警告(提醒切回)但 MUST NOT 硬阻断(用户可能有意在分支上翻看);执行前 MUST 先 `fetch & pull` 保证起点不落后远端(fetch 失败 warn-only,不阻断——离线场景可用)。

### D11: 需求形态确认(三岔,exploring 出口)

判定的本质是**上线原子性,不是体量**。exploring 出口 MUST 做形态确认:agent 从探索内容找信号(决定性:「要么整体上线要么全不上线」的交付约束;辅助:子需求分解且共享上线、依赖/共享基础设施、并行意图;反例:各部分可独立上线 → 多个独立普通需求)形成三岔建议——单普通需求 / 多个独立普通需求 / 大需求(集成)——MUST 经用户确认绝不静默生效(与 type 推断同款护栏);确认的大需求形态与子需求清单落档探索 topic(承接后成为创建命令的执行依据)。时机在探索出口(信号藏在探索内容里);误判兜底天然存在(误走 creating-feature 无破坏性,漏判可手动补建)。

## Risks

- **BREAKING 迁移面大**(state 目录 + schema + config version + 两命令语义)→ v2 兼容读取兜底 + init 一次性迁移(备份先行)+ CHANGELOG BREAKING 标注;在途 feature 建议先收尾再升级
- **路径识别对 config.worktree_dir 变更敏感**(旧目录下已登记 worktree)→ 清理与对账的「state 登记」析取项保留(D2 orphan ③ 与清理来源限定均含 state 命中,沿用 v2 先例)
- **父实体 children 与子 state 双份状态**→ children.status 由 finishing-worktree(子路径)写、reconcile 对账校验(子 state 存在但 children 未登记 → 报告);漂移面比 v2 的 ancestry 归属小得多
- **8 处 trunk 防护改动遗漏**→ 收尾全仓 grep `worktree_prefix`/`worktree-` 清点(归档/CHANGELOG 历史小节除外)
- **测试面大**(reconcile/state 重写)→ 既有 tmprepo 用例重构为 v3 场景,TDD 红绿推进

## Open Questions

无——四个待定细节已在探索收口:creating-worktree 基点为隐式检测 HEAD + 打印确认(D5);集成分支纯分支无 worktree,主仓临时 checkout 做 squash(D6);探索 topic 按父/子 slug 分立(D8);finishing-feature 硬门禁(D6)。
