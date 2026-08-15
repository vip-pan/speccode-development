# Proposal: distill-incremental-archive

## Why

每次 `/speccode:distilling-knowledge` 全量读 `speccode/spec/` + 全量读 `speccode/archive/`。`archive/` 随 archiving 单调增长,重读成本 O(N) 上升;而归档包不可变,已蒸馏过的包重蒸只能产出相同内容(无新信号),存活 requirements 已在 spec/、已蒸教训已在 knowledge/。成本随项目膨胀,新信号递减。

## What Changes

- distilling-knowledge 的 archive 读取从**全量**改为**增量**:只读"尚未消费"的归档包(判定基于 `speccode/knowledge/_distilled.meta.json` 的 `consumed_archives`)。
- 已消费包**整包跳过**(含 propose/design/brainstorm 等子文档),其既有蒸馏块**原样 carry forward** 进候选列表(不重蒸)。
- 新增 sidecar `_distilled.meta.json`(`{consumed_archives:[]}`)追踪已消费归档包,atomic 写入(复用 writeJsonAtomic)。
- 首次增量运行(sidecar 缺失)做一次性全量读 + 用全部现有归档包种子 `consumed_archives`。
- `spec/` 仍全量读(小、累积、当前事实,便宜且必要)。
- 闸门 diff、日落、幂等跳过语义不变;stale 处置细化:区分 stale(source 包已删,自动标)vs superseded(包还在但被新包取代,distiller 提议、用户确认)。
- 全量重建逃生口 = 删 `_distilled.meta.json` 再跑(等价 `--full`,复用首次引导机制);不实现 `--full` flag。
- BREAKING:无。既有 knowledge 集、旧 `promoted-from` marker 格式、replaceDistilledBlocks 全量重建语义均不变;误删风险靠命令层 carry-forward 规避,非 lib 语义改动。

## Capabilities

- `knowledge-set`(MODIFY:蒸馏命令改增量读;ADD:蒸馏消费追踪)

## Impact

- `plugins/speccode/commands/distilling-knowledge.md` — 命令 prose:前置读 sidecar 算未消费集;archive 增量读 + carry-forward;落盘后登记 consumed_archives;首次引导。
- `plugins/speccode/lib/knowledge.mjs` — 新增 sidecar 读写 helper(`distilledMetaPath` / `readConsumedArchives` / `writeConsumedArchives` / `unconsumedArchives`)。
- `plugins/speccode/bin/speccode.mjs` — read-knowledge 暴露 consumed/unconsumed(或新 verb);write-knowledge/新 verb 落盘 consumed_archives 增量。
- `plugins/speccode/lib/atomic.mjs` — 复用 `writeJsonAtomic`,无改。
- `plugins/speccode/tests/` — 新增:未消费集计算、sidecar 原子写、carry-forward 不误删、首次引导。
- `speccode/spec/knowledge-set/spec.md` — syncing 阶段合并本 delta。
