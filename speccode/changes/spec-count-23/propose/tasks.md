# Tasks: spec-count-23

- [ ] 1. plugin-packaging spec 5 处:`:87`「23 个 slash 命令」→「全部 slash 命令」;`:91` 枚举补 `applying` + 「23 个命令」→「24 个命令」;`:118`/`:123`/`:143`「23 命令表」→「24 命令表」
- [ ] 2. knowledge ×2:architecture.md:38 与 pitfalls.md:47「21 个命令文档」→「24 个命令文档」
- [ ] 3. 验证:`grep -n "23 个\|23 命令" speccode/spec/plugin-packaging/spec.md` 零命中;`grep -rn "21 个命令文档" speccode/knowledge/` 零命中;`:91` 枚举 24 项与 `ls plugins/speccode/commands/*.md | wc -l` = 24 一致;全量测试绿
- [ ] 4. 落盘提交:`chore: de-number and fix stale 23 counts in plugin-packaging spec + knowledge`
