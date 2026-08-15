# Tasks: distill-incremental-archive

## lib: 消费追踪 helper(`plugins/speccode/lib/knowledge.mjs`)

- [x] 新增 `distilledMetaPath(root)` 返回 `join(root, '_distilled.meta.json')`。
- [x] 新增 `readConsumedArchives(root)`:文件缺失 → 返 `[]`;JSON 解析失败 → 抛错(不静默,同 marker 损坏原则);成功 → 返 `consumed_archives` 数组。
- [x] 新增 `writeConsumedArchives(root, list)`:经 `writeJsonAtomic` 原子写 `{consumed_archives: [...new Set(list)].sort()}`。
- [x] 新增 `unconsumedArchives(archiveRoot, consumed)`:实扫 archive 一级目录 ∖ consumed,返未消费归档目录名数组。
- [x] 配套单测 `tests/knowledge.test.mjs`(或新增 `knowledge-meta.test.mjs`):未消费集计算、sidecar 原子写、缺失返 `[]`、损坏抛错、去重。

## bin: verb 暴露(`plugins/speccode/bin/speccode.mjs`)

- [x] `read-knowledge` 加 `--distill-sources` flag(或新增独立 verb `read-distill-sources`),返回 `{consumed, unconsumed, spec_caps}` 供命令层判定读哪些 archive 包 + 哪些 spec capability。
- [x] 落盘 consumed_archives:write-knowledge 加 `mode=meta`(blocks 字段不用,读旧 consumed ∪ 本批读过包)或新增 `write-distill-meta` verb;二者择一,经 `--json-stdin` 传本批读过包列表。
- [x] 配套 `tests/cli.test.mjs`:verb 端到端(读 verb 返回结构、写 verb 落盘 + 原子性)。

## 命令 prose:`plugins/speccode/commands/distilling-knowledge.md`

- [x] 前置加:读 sidecar 算未消费集(经新 verb/flag);sidecar 缺失 → 标记本次为首次引导(全量读)。
- [x] 蒸馏段:archive 改"只读未消费包";已消费包的既有块取自 `read-knowledge --blocks` 原样 carry forward 进候选(不重蒸);未消费包 + spec 重新蒸馏;对既有块做 source 存在性检查(stale 处置不变)。
- [x] 落盘段:蒸馏成功后把本批读过的归档包(含读了无产出)追记进 consumed_archives(经 verb 原子写);首次引导时用全部现有归档包种子。
- [x] 闸门 / stale / 日落 / 幂等跳过语义文字复核,确认无回归。
- [x] D5 已定:不实现 --full;逃生口 = 删 sidecar(语义已在 spec「删 sidecar 强制全量重蒸」scenario),命令 prose 点明即可,无代码任务。
- [x] D7/R3 已定:闸门区分 stale(包已删,自动标)vs superseded(包还在、被新包取代,distiller 省略/更新,标「superseded by <新包名>」,用户确认);命令 prose 补标注逻辑,spec 已加 scenario。
- [x] C1:若 unconsumedArchives/sidecar 触及绝对路径相等比较,先 realpathSync 归一(macOS /var→/private/var);仅按目录名比对则免。
- [x] C2:新增 consumed_archives 写路径的 --json-stdin 是布尔 flag,payload 从 stdin readStdin() 读,不 JSON.parse(flag 值)。

## spec delta

- [x] `speccode/changes/distill-incremental-archive/propose/specs/knowledge-set/spec.md`:MODIFIED 蒸馏命令 + ADDED 蒸馏消费追踪(本文件)。

## 验证

- [x] 全量测试 `node --test ./plugins/speccode/tests/*.test.mjs` 绿(本仓库基线 189 pass)。
- [x] 手动刺探:造 2 个归档包 + 跑 distilling 两次,第二次仅读新包(可加调试日志验证),sidecar 正确更新;删除一归档包后跑,对应块标 stale。
- [x] 首次引导:删 sidecar 后跑,确认全量读 + 种子创建。
