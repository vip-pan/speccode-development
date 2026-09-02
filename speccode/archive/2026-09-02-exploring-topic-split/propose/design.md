# Design: exploring-topic-split

## Context

现状:`_exploring` 是 trunk 级单堆键(`lib/memory.mjs` 的 `TRUNK_MEMORY_KEYS = ['_exploring', '_knowledge']`),所有探索结论顺序 append 到 `.speccode/memory/_exploring.md`(单次 O_APPEND,不丢行但无归属);`creating-feature` 入口读整个文件推断 type,出口把全量内容 merge 进新 feature 的 memory 骨架后清空该文件。memory 文件从不随 feature 收尾删除(reset 按目录整体清理是唯一兜底)。

约束:探索发生在 trunk(尚无 feature 归属);memory 是 untracked 运行时数据;远期已确认 B 方向(去 feature 层、worktree 即功能单元),本设计 MUST 与其兼容——即探索期存储不得耦合 feature 层概念。

## Goals

- 交错探索互不污染:每个需求(或分期)的探索结论物理隔离在独立文件
- 承接零歧义:creating-feature 继承探索结论走原子 rename,无选择、无合并、无清空语义
- creating-feature 不新增参数:沿用既有 `<type>/<slug>` 直给通道

## Non-Goals

- 不做 `_exploring/<topic>/<phase>.md` 目录分层
- 不做 memory 内的进度/分期记账(跨期进度查 state + git history + spec/,单一真源)
- 不做流程分级(轻量修复 vs 完整 SDD 管线)
- 不为遗留 `_exploring.md` 提供代码级自动迁移(运行时 untracked 数据)
- `_knowledge` 键保持不变(knowledge 命令有闸门流程,单文件语义正确)
- B 方向(去 feature 层)本身不在本需求落地,仅要求兼容

## Decisions

### D1: 扁平命名约定(路线Ⅱ),否决目录分层与段落标记

`_exploring__<topic>.md` 单层文件。否决目录分层(`_exploring/<topic>/<phase>.md`):分层只在「写入/归属/生命周期各不相同」时有收益,而各 topic 文件生命周期完全同构(append → rename 消亡),聚合视图属展示层(status / 清单按前缀分组),不需要存储层分层;且分层迫使跨期总览结论再发明 overview 文件与新的读取耦合。否决单文件段落标记:重新引入「选择条目」逻辑——正是本需求要消灭的东西。

### D2: slug=topic 命名约定,否决新增 `--topic` 参数

`/speccode:creating-feature feature/<slug>` 的 slug 即 topic 名,查 `_exploring__<slug>.md` 命中则承接。否决独立 topic 参数:与 slug 构成双源,不一致时听谁的成为新歧义;slug≠topic 的场景(故意换分支名)应不承接(探索文件原地保留),这是确定性规则,不需要参数表达。承接非强制:探索了但未承接的 topic 文件原地保留,由 reset 兜底清理。

### D3: 承接桥 = 原子 rename,宿主 creating-feature;否决 merge+clear

`renameMemory('_exploring/<topic>', '<type>/<slug>')` 同目录 renameSync(原子,同一文件系统)。merge+clear 的存在理由是单堆文件不可分——文件按 topic 切开后,选择性问题在物理上消失。被否备选:copy(探索文件保留)——topic 文件随其线程生、随其线程死,保留会产生陈旧草稿与双真源。远期 B 方向落地时桥整体移至 creating-worktree(届时改名其为开发分支创建命令),本设计不阻塞。

### D4: `_exploring/<topic>` 编码复用 branchToStateName,校验收口进 lib

`memoryPath` 对含斜杠键走 `branchToStateName`(`_exploring/<topic>` → `_exploring__<topic>`),**零改动**。校验从 bin 的 `TRUNK_MEMORY_KEYS.includes(branch) || validateBranch(branch)` 替换为 lib 函数 `validateMemoryBranch(branch)`:接受 `_exploring`(遗留读兼容)、`_knowledge`、`_exploring/<topic>`(topic 经 `validateSlug`)、以及既有 `validateBranch` 分支。bin 内联白名单逻辑收口为 lib 纯函数,可单测。

### D5: 新增 `list-memory` / `rename-memory` verb,否决命令层直接 ls

命令层不碰文件系统细节是本仓分层铁律(确定性逻辑下沉 lib)。listMemory 扫 `memory/` 目录返回 `_exploring` 前缀的键清单(exploring 的 topic 选择与 creating-feature 的未直给流程共用);renameMemory 做校验 + rename。

### D6: rename 目标已存在 → 拒绝并报告,不覆盖不合并

与 reconcile「同一 worktree 匹配 ≥2 feature 时报错退出、绝不随意归属」同一安全哲学。重复创建 feature 时骨架应增量维护,而非静默吞掉既有 memory。

## Risks

- **topic 命名碎片化**(同一需求在不同 session 被起不同 topic 名,各持一半结论)→ append 前必列既有 topic 清单让用户选既有或新建;前缀约定(分期 `-p1/-p2`)进命令 prose
- **遗留 `_exploring.md` 与新机制并存造成困惑** → bare `_exploring` 键保留读兼容;CHANGELOG 注明手工迁移方式(mv 为任一 topic 文件或删除)
- **既有测试语义变化**(`cli.test.mjs` 的 `_exploring` sentinel 用例、`memory.test.mjs` 路径用例)→ 用例随新契约同步更新,不是回归而是契约演进
- **type 推断信号从「整堆」变「单 topic」**,小样本推断质量可能下降 → 既有护栏(推断 MUST 经用户确认,不静默生效)不变,风险已被覆盖

## Open Questions

无——方案分歧已在探索阶段收敛(交错问题 → topic 分文件 → 路线Ⅱ → rename 桥 → 不加参数)。
