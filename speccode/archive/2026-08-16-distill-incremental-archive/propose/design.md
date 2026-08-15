# Design: distill-incremental-archive

## Context

distilling-knowledge 现读 `speccode/spec/`(全量)+ `speccode/archive/`(全量)。`archive/` 是 archiving 阶段把 `changes/<slug>/` 整包(proposal/design/tasks/brainstorm/delta-spec)搬入的产物,**不可变**。syncing 只把 delta 的 requirements 合并进 `spec/`,rationale 类文档(design/brainstorm)不进 spec,只存于 archive——故 archive 是过程知识(准则/坑/决策)的富矿,不能移出蒸馏范围;但已蒸馏过的包重读无新信号。

`replaceDistilledBlocks` 是全量重建:候选列表里没有的 source,其块会被删除。

## Goals

- archive 读取成本从 O(归档包总数)降至 O(未消费包数)。
- 不丢任何 rationale;不破坏既有 knowledge 集 / 旧 `promoted-from` marker / 幂等跳过 / stale / 日落语义。
- 不改 `replaceDistilledBlocks` 重建语义。

## Non-Goals

- 不改 source marker 格式(`distilled-from` / `archive/<slug>/` 命名空间不变)。
- 不改 `spec/` 全量读。
- 不改 recording-knowledge。
- 不做跨 worktree 的消费集运行时共享(knowledge/ tracked,随 PR 共享即可)。

## Decisions

- **D1 消费追踪 = sidecar `_distilled.meta.json`**:`{consumed_archives:[]}`,atomic 写(复用 `writeJsonAtomic`)。否决「时间戳截止」(难支持选择性重读、同日多包排序坑);否决「复用 distilled 块 source 反查」(读过无产出的包永被重读)。
- **D2 跳过粒度 = 整包**:已消费包整包跳过(含 design/brainstorm),其块 carry forward。理由:归档包不可变 → 重蒸产出相同 → 无信息损失,且成本削减最大。否决「只跳 delta-spec」(rationale 是 bulk,削减小,且未命中"已蒸教训在 knowledge 里"这点)。
- **D3 carry-forward 规避误删(crux 解法)**:distiller 把已消费包的既有蒸馏块(取自 `read-knowledge --blocks`)**原样**放入候选列表;`replaceDistilledBlocks` 见其 source 在列表 → 保留,不误删。stale 源(source 包已删)不在列表 → 删除(既有语义覆盖)。故**不改 lib 重建语义**,只改命令层候选构造 + sidecar 追踪。这是把"全量重建"与"增量读"调和的关键。
- **D4 首次引导**:sidecar 缺失 → 一次性全量读 + 用全部现有归档包种子 `consumed_archives`。成本一次性。本仓库 archive/ 空,引导即空操作。**[终审更正 2026-08-15]** 本仓库 `speccode/archive/` 实有 22 个归档包(探索期 `find -maxdepth 2 -type f` 被嵌套 propose/brainstorm 子目录结构误导,误判为空);首次 dogfood 引导实为 22-bundle 全量读,非空操作。
- **D6 全量重建逃生口 = 删 sidecar(不实现 --full)**:不提供 `--full` flag。官方逃生口 = 删 `speccode/knowledge/_distilled.meta.json` 后重跑——全部归档包变未消费 → 全量重读 → 全部既有块重蒸(非 carry-forward)+ 重种子,等价于 `--full`。复用首次引导机制,YAGNI 不增命令/verb/flag 表面。
- **D7 stale vs superseded 闸门区分**:闸门 MUST 区分两种"块被移除":stale(source 包已删,自动标)vs superseded(包仍在但知识被新包取代,distiller 在候选列表省略/更新,闸门标「superseded by <新包名>」,用户确认)。无需改 lib——distiller 通过候选列表构造即可达成;stale 检测仍按包是否存在独立判断。

## Risks

- **R1 sidecar 与 knowledge/ 落盘不一致**(蒸馏写了块但 sidecar 未更新 → 下轮重读已蒸包):缓解——sidecar 更新与蒸馏落盘在同一命令事务内,失败则整体报告并提示重跑。
- **R2 人工删归档包后 `consumed_archives` 残留旧条目**:缓解——未消费集 = 实扫 archive 目录 ∖ consumed;残留条目指向不存在的包,不影响判定(无副作用);可定期清理。
- **R3 旧块被新包取代**(已解,见 D7):闸门区分 stale(包已删,自动标)vs superseded(包还在、知识被取代,distiller 提议、用户确认);distiller 在候选列表省略/更新被取代块即可,无需改 lib。

## Open Questions

(均已解:D5 → D6;R3 → D7。)

## 约束(来自 `knowledge/development/pitfalls.md`,本次实现 MUST 遵)

- **C1 realpath 归一**:`knowledgeRoot` 经 `git rev-parse --show-toplevel`,macOS 把 `/var` 解析为 `/private/var`。凡做路径**相等比较**处 MUST 先 `realpathSync` 归一;本变更若仅按归档目录名(字符串)比对则不触发。
- **C2 --json-stdin 布尔**:`write-knowledge`(及新增 consumed_archives 写路径)`--json-stdin` 是布尔 flag,payload MUST `JSON.parse(readStdin())`,绝不 `JSON.parse(jsonStdin)`。新增 verb/flag 照此模式。
