# knowledge-set Specification

## Purpose

知识集层:tracked、可检索、按主题组织的项目知识库,落 `speccode/knowledge/`(与 spec/changes/archive 平级)。由蒸馏命令(distilling-knowledge,从 spec/archive 蒸馏 distilled 段)与记录命令(recording-knowledge 写 hand-written 段)写入,均经人工闸门;SDD 认知型命令入口读 `_index.md` 索引并按需读 topic 文件,失败静默兜底。

## Requirements

### Requirement: 知识集目录结构

speccode MUST 支持 tracked 知识集目录 `speccode/knowledge/`,包含 `_index.md` 检索索引与按主题组织的 topic 文件(初始骨架:development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md),topic 清单可演进(用户可经 recording-knowledge 在 `development/` 下新建 topic)。知识集 MUST 只策展 SDD 开发过程知识;业务知识 MUST NOT 进入初始骨架,由外部 RAG 系统维护。

`_index.md` MUST 由实扫现有 topic 文件(跳过内容为空的 topic 文件)按顶层目录名分组生成,不得硬编码固定 section 清单。

#### Scenario: 新项目无知识集

- WHEN 项目尚无 `speccode/knowledge/` 目录
- THEN 消费入口静默跳过;distilling-knowledge 或 recording-knowledge 首次运行时创建骨架(目录 + `_index.md` + 6 个初始 development topic 空文件),MUST NOT 创建 business/ 目录

#### Scenario: 索引缺失但 topic 文件存在

- WHEN `_index.md` 缺失但 topic 文件存在
- THEN distilling-knowledge 或 recording-knowledge 运行时用 buildIndex 重建 `_index.md`,sections 按实扫结果的顶层目录名分组

#### Scenario: 存量 business topic 自然消失

- WHEN 存量项目的 business/*(或任何蒸馏目标外 topic)的蒸馏块经日落闸门移除,且文件无 hand-written 内容残留(文件为空)
- THEN 下次重建 `_index.md` 时该空 topic 文件 MUST 不被收录(实扫跳过空文件),条目自然消失;文件本身留在盘上,由用户自行处置

### Requirement: 来源标记

知识文件 MUST 支持段落级来源标记:以 `<!-- distilled-from: <source> -->` 开始、`<!-- /distilled -->` 结束的蒸馏块,块外内容为 hand-written。蒸馏只重写蒸馏块,hand-written 内容字节级保留。

写侧 MUST 只产出新格式 marker;读侧 MUST 同时解析新格式与旧格式 `<!-- promoted-from: <source> -->` … `<!-- /promoted -->`,两者视为同一蒸馏块列表;同一文件新旧格式混排时 MUST 按出现顺序统一解析。

#### Scenario: 蒸馏保留手写内容

- WHEN 某 topic 文件同时含蒸馏块与 hand-written 段
- THEN 蒸馏重蒸后 hand-written 段与原内容逐字节一致

#### Scenario: 旧格式 marker 兼容

- WHEN topic 文件含旧格式 `<!-- promoted-from: <source> -->` … `<!-- /promoted -->` 蒸馏块
- THEN 读侧正常解析为蒸馏块(与手写段区分不变);下次蒸馏写入时该块以新格式重写

#### Scenario: 标记格式损坏

- WHEN 蒸馏块 marker 解析失败(格式损坏)
- THEN 报错退出并提示人工检查,不静默、不猜测

### Requirement: 蒸馏命令

`/speccode:distilling-knowledge` MUST 从 `speccode/spec/` 全量读、从 `speccode/archive/` **增量读**(只读尚未消费的归档包)以重蒸各 topic 的蒸馏块,产出候选 diff 展示给用户,经用户确认后才写 tracked 层(人工闸门);蒸馏结果与现状无差异时幂等跳过写。

archive 的"已消费"判定 MUST 基于 `speccode/knowledge/_distilled.meta.json` 的 `consumed_archives` 列表(见"蒸馏消费追踪" requirement);不在该列表的归档包为未消费,须读;已在列表的为已消费,整包跳过(含 propose/design/brainstorm 等子文档)。已消费包的既有蒸馏块 MUST 原样 carry forward 进入候选列表(不重蒸)——因归档包不可变,重蒸仅会产出相同内容,故无信息损失。对所有既有块 MUST 做 source 存在性检查:source 指向的 archive 包已删除 → 标 **stale**;source 包仍在但其知识被新归档包取代 → distiller 在候选列表省略该旧块(→ 删除)或更新其 body,闸门标注 **superseded**(<取代包名>),用户确认。两种"块被移除"语义 MUST 在闸门区分标注,stale 为自动检测、superseded 为 distiller 提议。

蒸馏目标 MUST 为:初始骨架 6 个 development topic ∪ `development/` 下用户自建 topic;蒸馏内容 MUST 限于 SDD 开发过程知识(架构、准则、环境、对接、坑与评审共识、安全)。变更元数据不属于蒸馏对象:归档包内文档的 frontmatter 字段(如 proposal.md 的 `tier:`)MUST NOT 单独成块,MUST NOT 混入正文蒸馏块,SHALL 仅作为理解变更体量与权重的参考上下文。蒸馏目标之外既存的 topic 文件,其蒸馏块 MUST 在闸门内逐块建议移除(日落),经用户确认后删除;其 hand-written 段 MUST 字节级保留,绝不自动修改。

蒸馏成功落盘后 MUST 把本次读过的归档包(含读了无产出的)追记进 `consumed_archives`(去重)。`_distilled.meta.json` 缺失时 MUST 做一次性全量读 archive,并用全部现有归档包种子 `consumed_archives` 创建该 sidecar;此机制同时作为强制全量重蒸的官方逃生口(蒸馏判据变更后删 sidecar 再跑即全量重读+全块重蒸+重种子),不另设 `--full` flag。

#### Scenario: 蒸馏无变化

- WHEN 蒸馏结果与现状无差异(已消费包 carry forward + 未消费包无新信号)
- THEN 跳过写入并报告「无变化」

#### Scenario: 增量只读未消费包

- WHEN `consumed_archives` 含包 A,归档目录新增包 B
- THEN 本次蒸馏只读包 B,包 A 整包跳过;包 A 的既有蒸馏块原样 carry forward 进候选列表,不被重蒸、不被误删

#### Scenario: 首次增量引导

- WHEN `_distilled.meta.json` 不存在
- THEN 本次蒸馏做一次性全量读 archive,落盘后用全部现有归档包种子 `consumed_archives` 创建该 sidecar

#### Scenario: 删 sidecar 强制全量重蒸

- WHEN 蒸馏判据变更(如 topic 结构调整)后,用户删除 `_distilled.meta.json` 再跑 distilling-knowledge
- THEN 全部归档包变未消费 → 全量重读 → 全部既有块重蒸(非 carry-forward)+ 重种子;此为官方全量重建逃生口,不另设 --full flag

#### Scenario: 旧块被新包取代

- WHEN 既有蒸馏块 source 指向的 archive 包仍在盘上,但新归档包的知识取代了该块
- THEN distiller 在候选列表省略该旧块(→ 删除)或更新其 body,闸门标注「superseded by <新包名>」,与 stale(包已删)区分;用户确认后处置

#### Scenario: 来源已消失

- WHEN 蒸馏块 source 指向的 archive 已不存在
- THEN 该块标记为 stale,在闸门内展示给用户处置(删除块或改 source)

#### Scenario: frontmatter 元数据不蒸馏

- WHEN 蒸馏读取的归档包 proposal.md 含 frontmatter `tier:` 字段
- THEN 该字段 MUST NOT 成为独立蒸馏块,MUST NOT 混入正文蒸馏块;仅可作为 distiller 理解变更体量的参考上下文

#### Scenario: 日落移除范围外 topic 的蒸馏块

- WHEN 存量项目存在蒸馏目标外的 topic 文件(如 business/domain.md)且含蒸馏块
- THEN 蒸馏闸门 MUST 展示「建议移除(该 topic 不在蒸馏目标内;若属业务知识,建议归外部 RAG)」选项;用户确认后块删除,同文件 hand-written 段与原内容逐字节一致;用户拒绝则块保留

#### Scenario: 首次重蒸迁移旧 marker

- WHEN 存量 topic 文件的蒸馏块使用旧格式 `promoted-from`/`/promoted` marker
- THEN 经闸门确认写入后,全部蒸馏块以新格式 `distilled-from`/`/distilled` 重写,hand-written 段与原内容逐字节一致

### Requirement: 蒸馏消费追踪

speccode MUST 维护 `speccode/knowledge/_distilled.meta.json`(knowledge/ 内 tracked sidecar,与 topic 文件平级),记录蒸馏已消费的归档包,供 distilling-knowledge 增量读判定。结构:`{"consumed_archives": ["<归档目录名>", ...]}`(数组、去重、顺序无关)。该文件 MUST 经 atomic 写入(临时文件 + rename,与 config/state 同策,复用 `atomic.writeJsonAtomic`);MUST NOT 手写。

distilling-knowledge 计算未消费集 = `speccode/archive/` 下实扫的全部归档目录 ∖ `consumed_archives`。该文件缺失时视为 `consumed_archives` 为空集(触发首次全量读引导)。该文件 JSON 损坏时 MUST 报错退出提示人工检查,不静默、不猜测(与蒸馏 marker 损坏同原则)。

read-consumed-archives verb 返回 `{consumed, unconsumed, present, bootstrap}`;`present` 为盘上归档包名列表,供 stale 判定:既有蒸馏块 source(strip `archive/<名>/` → 裸名)不在 `present` 即 stale(source 包已删)。

#### Scenario: 增量判定

- WHEN `consumed_archives` = [A],`speccode/archive/` 下有 [A, B, C]
- THEN 未消费集 = [B, C],本次蒸馏只读 B、C;A 整包跳过

#### Scenario: sidecar 原子写

- WHEN 蒸馏落盘后追记本次读过的归档包进 `consumed_archives`
- THEN 经临时文件 + rename 原子覆盖,中途崩溃不留下半写文件;写入值为旧集 ∪ 新集去重

#### Scenario: sidecar 缺失

- WHEN `_distilled.meta.json` 不存在
- THEN 视为 `consumed_archives` 为空集,触发首次全量读 + 种子创建

#### Scenario: sidecar 损坏

- WHEN `_distilled.meta.json` 存在但 JSON 解析失败
- THEN 报错退出并提示人工检查,不静默修复、不视为空集

### Requirement: 记录命令

`/speccode:recording-knowledge` MUST 允许用户或 agent 直接写主题的 hand-written 知识。写入前 MUST 先经适配闸门:对内容做归类陈述(属于 SDD 过程知识 → 建议落入的 topic;属于业务知识 → 建议进外部 RAG 而非知识集),并展示草稿(写入位置 + 内容),经用户确认后才经 write-knowledge verb 原子写落盘。用户在被建议进 RAG 后仍坚持写入时,MUST 允许其指定既有 topic 或新建 topic(新建落在 `development/` 下,文件名小写连字符,`.md` 结尾),不得硬拦。

评审中反复出现的问题模式与团队评审共识 SHOULD 记入 development/pitfalls.md(坑与评审共识),不单列 review topic。

#### Scenario: 记录过程知识

- WHEN 用户提供的过程知识内容并确认草稿
- THEN 内容写入对应 topic 文件的 hand-written 段,并更新 `_index.md`(新 topic、摘要变化或索引缺失时)

#### Scenario: 业务知识经闸门建议后坚持写入

- WHEN 内容被闸门判定为业务知识并建议进 RAG,用户仍坚持写入并指定 topic
- THEN 内容 MUST 写入用户指定的 topic(不存在则在 `development/` 下新建),闸门陈述不阻断写入

### Requirement: 消费入口

SDD 认知型命令(exploring / proposing / brainstorming / writing-plans / executing-plans / subagent-driven-development / systematic-debugging / requesting-code-review / receiving-code-review)入口 MUST 读 `_index.md` 索引并按需读相关 topic 文件;`knowledge/` 不存在或读取失败时静默跳过,绝不阻断主流程。

#### Scenario: 知识集缺失不阻断

- WHEN 项目无 `knowledge/` 目录或读取失败
- THEN 命令正常继续,不输出错误、不中断

### Requirement: 知识维护分支与直通 PR

distilling-knowledge 与 recording-knowledge MUST 运行于 state 登记的 `chore/knowledge-*` 开发分支的 worktree 中(与其他开发分支同一入口与收尾,无特权形态)。MUST NOT 在其他任何分支(含 trunk、`feature/`/`bugfix/`/`refactor/` 分支、不匹配 `chore/knowledge-` 的 `chore/` 分支)的 worktree 或主工作区执行知识写入,违反时 MUST 提示并退出。

在 trunk 上运行时,命令 MUST 先经 state 查询识别未完成(status ∈ {pending, in_progress, pr_open})的 `chore/knowledge-*` 分支:恰有候选时 MUST 经 AskUserQuestion 询问「续跑(cd 到该分支 worktree)/ 新建」;无候选时 MUST 经 AskUserQuestion 确认 slug(默认:distilling 用 `knowledge-distill`,recording 用 `knowledge-<内容主题>`,无主题用 `knowledge-record`),随后引导执行 `/speccode:creating-worktree` 以 type=`chore` 创建 worktree 分支并登记 state,再继续本命令。「未完成」判定 MUST 基于 state 查询,MUST NOT 依赖 git merge 判定(如 `git branch --no-merged`——在 squash-only 合并下对已合并分支永真)。

落盘 commit 后 MUST 经 `/speccode:finishing-worktree` 收尾(测试门禁、PR 路由、squash-only 探测、切回 merge_target),MUST NOT 内置独立的 PR 创建/查重/等待逻辑。PR 等待策略由 finishing-worktree 既有菜单决定,命令 SHOULD 建议知识维护选「PR 不等待」。

维护摘要(topic 变化/新增/无变化 + PR url)MUST 在收尾输出 PR url(或 `pr_tool=none` 等效命令)之后追加到 trunk 级 `.speccode/memory/_knowledge.md`(见 session-memory「memory 文件位置与命名」),内容 MUST 含 PR url(或等效命令),MUST NOT 写 feature 级 memory。

#### Scenario: trunk 首次运行引导建分支

- WHEN 用户在 trunk 运行 distilling-knowledge,且 state 中无未完成 chore/knowledge-* 分支
- THEN 命令经 AskUserQuestion 确认 slug(默认 knowledge-distill),引导执行 creating-worktree 以 type=chore 创建 worktree 分支并登记 state,随后在新 worktree 中继续蒸馏

#### Scenario: 续跑未完成分支

- WHEN state 中存在 status 为 pending/in_progress/pr_open 的 chore/knowledge-* 分支
- THEN AskUserQuestion 询问续跑(cd 到该分支 worktree)或新建;判定基于 state 查询而非 git merge 判定

#### Scenario: squash 合并后不再误报未完成

- WHEN 某历史 chore/knowledge-* 分支已经 finishing-worktree 收尾且 state 已推进/删除,但 git branch --no-merged 因 squash 合并仍列出该分支
- THEN 命令 MUST NOT 将其视为未完成分支(state 是唯一判定来源),不发起续跑询问

#### Scenario: 在其他分支运行被拒

- WHEN HEAD 为 feature/bugfix/refactor 分支、不匹配 chore/knowledge- 的 chore/ 分支,或其 worktree
- THEN 提示回 trunk(由 trunk 引导建分支)或回自己的 chore/knowledge-* worktree,退出且不执行任何写入

#### Scenario: 收尾统一走 finishing-worktree

- WHEN 蒸馏/记录落盘 commit 完成
- THEN 命令引导执行 finishing-worktree 完成测试门禁、PR 创建与 merge_target 切回,不运行命令内置 PR 逻辑

#### Scenario: pr_tool=none

- WHEN config.pr_tool 为 none
- THEN finishing-worktree 既有降级路径打印等效命令,维护摘要(含等效命令与分支名)仍追加到 _knowledge memory

#### Scenario: 维护摘要写 _knowledge memory

- WHEN 收尾完成并获得 PR url(或等效命令)后
- THEN 含 PR url 的维护摘要追加到 .speccode/memory/_knowledge.md,不写 feature memory
