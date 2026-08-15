# Tasks: knowledge-set-refocus

## 命令层

- [x] 1. 改 `plugins/speccode/commands/memorize.md`:骨架 9→6(删 business/* 三个文件与「业务方向」section);「收集内容」后增加适配闸门步骤(归类陈述:过程知识 → 建议 topic / 业务知识 → 建议进 RAG;坚持写入 → 指定或新建 topic,不硬拦);`_index.md` 组装改为实扫 topic 按顶层目录分组
- [x] 2. 改 `plugins/speccode/commands/promote-knowledge.md`:骨架 9→6;蒸馏范围收窄为「骨架 6 topic ∪ development/ 下用户自建 topic」且内容限于过程知识;增加通用日落(蒸馏目标外既存 topic 的 promoted 块闸门内逐块建议移除,hand-written 段保留);`_index.md` 组装改为实扫分组
- [x] 3. 两条命令中 pitfalls 的索引摘要描述更新为含评审共识(「踩过的坑、评审反复问题模式与已知限制」)

## 测试

- [x] 4. 测试零改动(已调查):knowledge.test.mjs / cli.test.mjs 中 business/ 仅为合法 fixture 路径,lib topic 无关,无骨架断言,无需修改

## 文档

- [x] 5. 同步 `plugins/speccode/README.md` 与 `README_CN.md`(中英):topic 清单 9→6、memorize 适配闸门、promote 日落机制、pitfalls 语义扩展

## 验证

- [x] 6. 全量测试 `node --test ./plugins/speccode/tests/*.test.mjs` 通过
