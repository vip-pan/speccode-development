# remove-feature-layer 设计精化(brainstorm)

> 2026-09-02 · 输入:`propose/`(D1-D10)与本会话探索结论(10 条)· 产出:3 项缺口裁决 + 1 条新增结论(D11),全部回写 propose/

## 0. 本次脑暴的定位

propose 阶段设计已锁定大方向;本次以新鲜眼光压测 propose 的 spec delta,找出 3 个真缺口逐一裁决,并补上探索中一句带过的「体量识别」机制(第 11 条结论)。四个裁决全部经用户确认。

## 1. 缺口裁决

### 裁决 1:children 状态 = 派生,不是存储

propose 原写法 `children: [{slug, status, completed_at?}]` 且由 finishing-worktree(子路径)写父实体——存在读-改-写竞态(两个子 worktree 并行收尾互踩父 state,writeJsonAtomic 防单写损坏、防不了互踩,v2 memory O_APPEND 改造的同款教训)与双真源漂移。

**裁决(乙)**:children 只存 `{slug}`(纯身份登记);**子 state 是状态的唯一真源**,status 渲染时实时读取聚合(本地小文件,代价可忽略)。子收尾只写自己的 state,永不碰父实体 → 竞态与漂移连根消失;reconcile 的 children↔子 state 交叉校验 requirement 整体消掉,仅保留「children 登记了 slug 但无对应子 state = 计划未开工(正常,渲染为 pending)」。

### 裁决 2:v2→v3 迁移 = 双格式运行 + 仅 init 显式迁移

propose 原写法「v2 worktrees 条目提升为独立分支视角输出」做不到也不该做:v2 条目名 `worktree-xxx` 无 `<type>/<slug>`,提升后连 state 文件名都产不出。

**裁决(乙)**:**双格式运行**——`state/features/` 旧文件按 v2 语义原样读写(既有行为不变,旧命令继续可用;normalizeState 仅按目录识别新旧格式),v3 命令只碰 v3 文件;迁移**仅发生在 init**:检测 `state/features/` → 展示迁移预览 → 用户确认 → 逐文件转换移入 `state/branches/` → reconcile 验证;拒绝则保持 v2 照常跑。不做静默自动迁移(不静默挪用户数据)。

### 裁决 3:多父实体并存 + 消歧交互

两个大需求可同时 in-flight(A 的子分支没收尾时开 B),creating-worktree 的隐式基点判定会歧义。

**裁决(乙)**:不限单父。creating-worktree 基点判定:**0 个父实体 → 从 trunk 切(普通路径);恰好 1 个 → 打印「检测到父实体 X,从其集成 head 切」并经用户确认;≥2 个 → AskUserQuestion 列父实体供选,直给完整分支名可跳过判定**。与 type 推断「直给 → list → 询问」的既有顺序同构。creating-feature 不加单父限制。

## 2. 新增结论 D11:需求形态确认(三岔)

「exploring 识别体量」的落地机制——判定的**本质是上线原子性,不是体量**:

- **决定性信号**:「要么整体上线要么全不上线」的交付约束;辅助信号:工作天然分解为多个子需求且共享同一次上线、子需求间依赖/共享基础设施、并行开发意图。
- **反例信号**:各部分可独立上线 → **不是大需求**,拆成多个独立普通需求(各自 PR),不建集成。
- **三岔出口**(探索结论 → 出口形态确认):单普通需求(引导 creating-worktree)/ 多个独立普通需求(逐个走普通流程)/ 大需求(引导 creating-feature,topic 内记录父 slug + 子需求清单)。
- **机制 = 三同款护栏**:agent 从探索内容找信号形成建议(不机械判定,无可靠量化指标)→ MUST 经用户确认绝不静默生效 → 结论落档 topic(承接后随 rename 进父实体 memory,成为创建命令的执行依据)。
- 时机在**探索出口**(信号藏在探索内容里,开头问是空对空);误判兜底天然存在:误走 creating-feature 只是多条聚合分支无破坏性,漏判可随时手动补建。

## 3. 分段设计定稿(已经用户分段确认)

### 段 1 拓扑与命名
双层拓扑:trunk + `<type>/<slug>` 开发分支(worktree,建在 worktree_dir 下)。集成分支 opt-in,同命名规、无 worktree。`worktree-` 前缀与 `config.worktree_prefix` 退役(config 2→3),分支身份由「路径识别 + state 登记」接管。命令 23 个全保留,creating-feature/finishing-feature 转 opt-in;承接桥宿主:子需求 = creating-worktree,父 topic = creating-feature。

### 段 2 state 与迁移
`state/branches/<type>__<slug>.json` 统一抽象。普通分支 `{branch, type, worktree, merge_target(缺省 trunk), status, created_at, initial_branch}`;父实体 `{branch, kind:"integration", children:[{slug}], status, created_at, initial_branch}`(children 派生,见裁决 1)。双格式运行 + init 显式迁移(裁决 2)。状态枚举 `{pending, in_progress, pr_open, completed}` 不变。

### 段 3 收发命令与路由
- creating-worktree:基点判定(0/1/≥2 父,裁决 3)→ slug=topic 承接 → 登记 children(仅 slug)→ 写 merge_target;setup/基线/引导保留
- creating-feature:集成分支(trunk HEAD)+ 父实体 + 承接父 topic;不建 worktree
- finishing-worktree:merge_target 路由——非 trunk(子)→ 本地 squash 自动路径(复测 + 收尾切到集成 fetch&pull,不问 PR 菜单);trunk → 三项菜单(PR+等待 / PR+不等待 / 保留);丢弃仅显式;清理来源限定 =「路径在 worktree_dir 下 ∪ state 登记」
- finishing-feature:门禁(children 全 completed,派生读取)+ 对账 → PR squash → 阻塞等待/`--resume`(waiting_trunk_pr)→ 删父实体 state → 集成分支保留 → 切回 trunk + fetch&pull

### 段 4 探测与守卫
squash 保护:`repo-merge-config` verb(prtool,DI 可测,gh 失败返 null = warn-only),init 与 finishing-worktree 建 PR 前探测,非 squash-only 警告 + 指路,prose 兜底,否决插件代合并。守卫:syncing/archiving/brainstorming/dispatching 的 trunk 防护改「非 trunk 的 `<type>/<slug>` 分支」;exploring 前置 = trunk 警告(不阻断)+ fetch&pull(warn-only);knowledge bootstrap 的 `chore/knowledge-*` 例外不动。文档:README ×4 + CLAUDE.md 双层化;CHANGELOG 发版时标 BREAKING。

## 4. 两张流程图(定稿)

普通需求(默认路径,两步收发):

```
trunk ══► exploring(fetch&pull;形态确认:单普通)
        ► creating-worktree feature/payment(0 父 → trunk HEAD 切;rename-memory 承接 topic)
        ► state/branches/feature__payment.json {merge_target 缺省=trunk}
        ► proposing → writing-plans → SDD/执行 → syncing → archiving
        ► finishing-worktree(测试门禁 → 三项菜单 → PR squash → trunk)
        ► MERGED → 清理 → state=completed → 切回 trunk + fetch&pull
```

大需求(opt-in,集成聚合):

```
trunk ══► exploring(形态确认:大需求 → topic 记父 slug + 子清单)
        ► creating-feature feature/mkt-req(集成分支 + 父实体 + 承接父 topic)
        ► creating-worktree ×N(集成 head 切;children 登记 {slug};merge_target=集成)
             并行兄弟同 head;串行后序在前序合入后切(切点即依赖)
        ► finishing-worktree ×N(测试门禁 → 本地 squash → 集成 → 复测 → 切集成 fetch&pull;
             子 state=completed;父实体不被写)
        ► status 状态板(children 身份 + 子 state 派生状态,渲染 pending/in_progress/completed)
        ► finishing-feature(门禁:children 全 completed 派生读取)
        ► PR squash(集成→trunk)→ 删父实体 state → 切回 trunk + fetch&pull
```

## 5. 回写清单(propose/ 同步项)

| 文件 | 修改 |
|---|---|
| `propose/design.md` | D3 schema children 条目改 `{slug}`;D4 改派生语义;新增 D11 形态确认 |
| `propose/proposal.md` | What Changes 增「exploring 出口形态确认(三岔)」一条 |
| `propose/specs/git-workflow-lifecycle/spec.md` | 「大需求父实体与集成分支」:children 条目 `{slug}`、消歧场景、删交叉对账场景增派生说明;「finishing-worktree 测试验证与选项菜单」:集成自动路径改为「子 state 置 completed」(不写父实体);「exploring 前置校验」增形态确认场景 |
| `propose/specs/speccode-config-management/spec.md` | 「state/branches 文件隔离」children 条目 `{slug}`;「worktree 状态枚举」删「children 同步」;「state v2 兼容读取与迁移」改双格式语义 |
| `propose/tasks.md` | 组1 normalizeState 改双格式;组2 删交叉校验;组4 finishing-worktree 不写父实体;组5 exploring 增形态确认 |

## 6. 自查记录

1. 占位符:无 TBD/TODO;所有 step 有具体语义。
2. 内部一致性:裁决 1-3 与 D1-D11 无矛盾;children 派生后,「finish 阻塞门禁」「status 状态树」「finishing-feature 门禁」全部统一为派生读取口径;与 propose 回写后一致。
3. 范围:单一实现计划可承载(6 依赖组);不拆。
4. 歧义:「非 trunk 的 `<type>/<slug>` 分支」守卫——明确为形态判断即可,不要求 state 命中(直给分支名时可能先于 state 存在);「派生读取」明确为 status/门禁实时聚合子 state,不引入缓存。
