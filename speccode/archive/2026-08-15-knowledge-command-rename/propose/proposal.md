# Proposal: knowledge-command-rename

## Why

知识集两条写入命令的命名与系统其余部分断裂:`memorize` 名指 memory 实写 knowledge(与 session-memory 能力正面撞名),`promote-knowledge` 以落盘 marker 类型命名而非操作本质(蒸馏 + 全量重建 + 日落);两命令构词法不对称(裸动词 vs 动宾),在 23 命令的动名词约定中是孤例。verb/lib/spec 三层(read/write-knowledge、knowledge.mjs、knowledge-set)词对词对称,唯命令层断裂,用户见名不知义、易与其他功能混淆。

## What Changes

- **BREAKING(命令面)**:`/speccode:memorize` → `/speccode:recording-knowledge`(记录/直写);`/speccode:promote-knowledge` → `/speccode:distilling-knowledge`(蒸馏)。删除旧命令文件,不留跳转 stub。
- **BREAKING(数据格式写侧)**:蒸馏块 marker 写侧迁新——`<!-- distilled-from: <source> -->` … `<!-- /distilled -->`;读侧永久双格式兼容旧 `<!-- promoted-from: -->`/`<!-- /promoted -->`,存量文件无需迁移(首次蒸馏经全量重建自动重写为新格式)。
- **内部契约硬切**:verb mode `replace-promoted` → `replace-distilled`;lib 函数 `parsePromotedBlocks`/`replacePromotedBlocks` → `parseDistilledBlocks`/`replaceDistilledBlocks`。`append-hand` 与 hand-written 术语不变。
- 术语:promoted 块 → 蒸馏块(distilled blocks);命令内提交信息模板同步(`docs(knowledge): record <topic>` / `distill knowledge set`)。
- 顺手修复 plugin-packaging「命令命名空间」枚举漂移:21 → 23 并收录两个新命令名(knowledge-set 落地时 memorize/promote-knowledge 未入列的存量漂移一并修复)。
- 4 个 README(根/插件 × EN/CN)命令表与知识段 prose 同步;`speccode/spec/knowledge-set/spec.md` Purpose editorial 修正;CHANGELOG 记 breaking。

## Capabilities

- **knowledge-set**(modified)— 命令名、marker 格式与双格式解析、块术语。
- **plugin-packaging**(modified)— 命令命名空间枚举 21 → 23。

## Impact

- 代码:`plugins/speccode/commands/`(删 2 增 2)、`plugins/speccode/lib/knowledge.mjs`、`plugins/speccode/bin/speccode.mjs`、`plugins/speccode/tests/knowledge.test.mjs`、`plugins/speccode/tests/cli.test.mjs`。
- 文档:`README.md`、`README_CN.md`、`plugins/speccode/README.md`、`plugins/speccode/README_CN.md`、`CHANGELOG.md`、`speccode/spec/knowledge-set/spec.md`(Purpose)。
- 存量数据:含旧 marker 的 knowledge 文件照常解析;重写随首次 `distilling-knowledge` 全量重建自然发生,hand-written 段字节级保留。
- 不变:23 命令总数、verb 名(read/write-knowledge)、`.speccode/memory/` 体系、知识集行为语义(闸门/日落/幂等)、archive/ 冻结历史。
