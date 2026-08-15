# Design Refinement: distill-incremental-archive(brainstorm D5/R3 精化)

> 本文为 brainstorming 阶段对 proposing 两个 Open Question 的精化结论,已回写至 `propose/design.md`、`propose/specs/knowledge-set/spec.md`、`propose/tasks.md`、`propose/proposal.md`。

## D5:全量重建逃生口 → 删 sidecar(不实现 --full)

**结论**:不实现 `--full` flag。官方逃生口 = 删除 `speccode/knowledge/_distilled.meta.json` 后重跑 distilling-knowledge。

**理由**:首次引导机制(sidecar 缺失 → 全量读 + 用全部现有归档包种子 consumed_archives)已**等价于** `--full`——删 sidecar 使全部归档包变"未消费" → 全部重读 → 全部既有块重蒸(非 carry-forward,因无"已消费"集)+ 重种子。功能完全等价,无需新增命令/verb/flag 表面(YAGNI)。

**适用场景**:蒸馏判据变更(如 topic 结构调整、蒸馏准则重写)后需重蒸所有包时,删 sidecar 再跑。

**写入 spec**:"蒸馏命令"加 scenario「删 sidecar 强制全量重蒸」;requirement 正文点明此为官方逃生口、不另设 `--full`。

## R3:旧块被新包取代 → 闸门区分 stale vs superseded

**结论**:闸门 MUST 区分两种"块被移除"语义:

- **stale**:蒸馏块 source 指向的 archive 包**已删除**(包不在盘上)→ 自动标 stale,处置不变(删块/改 source)。
- **superseded**:source 包**仍在盘上**,但其知识被新归档包取代 → distiller 在候选列表里**省略**该旧块(→ replaceDistilledBlocks 删除)或**更新**其 body,闸门标注「superseded by <新包名>」,用户确认。

**理由**:若 superseded 走 stale 语义会失真——bundle 还在却标"已消失"误导用户。区分后:stale 是自动检测(包没了),superseded 是 distiller 提议(知识被取代)、用户拍板。

**机制**:无需改 lib。distiller 通过候选列表构造(省略/更新被取代块)即可;replaceDistilledBlocks 的"source 不在列表 → 删"语义对 superseded 同样可达(包还在但 distiller 主动不放入列表)。stale 检测仍按"包是否存在"独立判断。

**写入 spec**:"蒸馏命令"加 scenario「旧块被新包取代」。

## 约束(来自 `knowledge/development/pitfalls.md`,本次实现 MUST 遵)

- **C1 realpath 归一**:`knowledgeRoot` 经 `git rev-parse --show-toplevel`,macOS 会把 `/var` 解析为 `/private/var`。凡做路径**相等比较**处 MUST 先 `realpathSync` 归一。本变更若在 `unconsumedArchives`/sidecar 路径比较中触及目录名(字符串)比对则不触发;若触及绝对路径相等比较则照办。
- **C2 --json-stdin 布尔**:`write-knowledge`(及新增的 consumed_archives 写路径)`--json-stdin` 是布尔 flag,payload MUST `JSON.parse(readStdin())`,**绝不** `JSON.parse(jsonStdin)`。新增 verb/flag 照此模式,避免重蹈覆辙。

## 回写 propose/ 清单

- `design.md`:D5/R3 从 Open Questions 升为 Decisions(D6 删 sidecar 逃生口、D7 stale/superseded 区分);Open Questions 清空;补 C1/C2 约束段。
- `specs/knowledge-set/spec.md`:蒸馏命令加「删 sidecar 强制全量重蒸」「旧块被新包取代」两 scenario;正文补 supersession 与逃生口语义。
- `tasks.md`:移除 D5 `--full` 条件项;加「闸门 superseded 标注」任务;加 C1/C2 实现注意。
- `proposal.md`:What Changes 补「闸门区分 stale/superseded」「逃生口=删 sidecar(不实现 --full)」。
