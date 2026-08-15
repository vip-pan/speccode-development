# Tasks: knowledge-command-rename

## 1. 引擎层(lib + CLI)

- [ ] `plugins/speccode/lib/knowledge.mjs`:marker 常量改双格式——新增 `DISTILLED_START`(`/^<!-- distilled-from:\s*(.+?)\s*-->$/`)与 `DISTILLED_END`(`<!-- /distilled -->`),保留旧 `promoted-from`/`/promoted` 作为 legacy 解析;解析时新旧混排按出现顺序统一进块列表;写侧只产新格式。函数改名:`parsePromotedBlocks` → `parseDistilledBlocks`、`replacePromotedBlocks` → `replaceDistilledBlocks`
- [ ] `plugins/speccode/bin/speccode.mjs`:import 同步改名;`write-knowledge` mode `replace-promoted` → `replace-distilled`(含缺 blocks 的错误提示文案)
- [ ] `plugins/speccode/tests/knowledge.test.mjs`:新格式写/读断言;旧格式兼容解析用例;新旧混排按序解析用例;写侧不产旧格式断言;hand-written 段字节保留回归
- [ ] `plugins/speccode/tests/cli.test.mjs`:mode 名更新(`replace-distilled` 正常与缺 blocks 报错两条)
- [ ] 全量测试 `node --test ./plugins/speccode/tests/*.test.mjs` 绿

## 2. 命令层

- [ ] 删除 `plugins/speccode/commands/memorize.md`、`plugins/speccode/commands/promote-knowledge.md`
- [ ] 新增 `plugins/speccode/commands/recording-knowledge.md`(基于 memorize.md 改写):frontmatter `name: "SpecCode: Recording Knowledge"` 与 description;正文命令名改 recording-knowledge;互引改 distilling-knowledge;提交信息模板 `docs(knowledge): record <topic>`;「约束」段措辞同步(写 promoted 块 → 蒸馏块是 distilling-knowledge 的职责)
- [ ] 新增 `plugins/speccode/commands/distilling-knowledge.md`(基于 promote-knowledge.md 改写):frontmatter `name: "SpecCode: Distilling Knowledge"` 与 description;正文 promoted 块 → 蒸馏块术语;`--blocks` 读现状块语义不变;写 mode 改 `replace-distilled`;提交信息模板 `docs(knowledge): distill knowledge set`;骨架创建/日落/幂等/stale 行为不变

## 3. 文档层

- [ ] `plugins/speccode/README.md` + `plugins/speccode/README_CN.md`:知识家族命令表两行(distilling-knowledge / recording-knowledge);目录树注释 `knowledge/` 行;commit-on-save 命令清单;「promoted vs. hand-written 分层」prose 段改「distilled vs. hand-written」并更新 marker 字样
- [ ] 根 `README.md` + `README_CN.md`:能力一览表知识行(`promote-knowledge memorize` → `distilling-knowledge recording-knowledge`)
- [ ] `CHANGELOG.md`:新增 Unreleased/下一版本小节,Changed 记 BREAKING(命令改名、marker 写格式迁移与读侧兼容、verb mode 改名),含迁移说明「存量文件无需手动迁移,首次 distilling-knowledge 全量重建自动重写旧 marker」
- [ ] `speccode/spec/knowledge-set/spec.md` Purpose editorial 修正(syncing 不动既有 Purpose,需手改):「晋升命令(从 spec/archive 蒸馏 promoted 段)与直写命令(memorize 写 hand-written 段)」→「蒸馏命令(distilling-knowledge,从 spec/archive 蒸馏 distilled 段)与记录命令(recording-knowledge 写 hand-written 段)」

## 4. 校验

- [ ] 全仓 grep `memorize|promote|promoted`:仅允许命中 `speccode/archive/`、`.ua/`、`CHANGELOG.md` 历史小节
- [ ] 全量测试复跑绿
- [ ] 双语 README 对照检查(根 12 段 / 插件 §1-14 结构一一对应)
- [ ] dogfood 自验:在本仓 `speccode/knowledge/` 上跑一次 distilling-knowledge 流程(干跑至闸门展示),确认存量旧 marker 块被正确解析并展示
