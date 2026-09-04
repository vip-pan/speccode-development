# 任务清单

## 迁移与重写

- [ ] 1. `git mv scripts/install-skills.sh support/install-skills.sh`;`git mv skills/speccode-workflow support/speccode-workflow`
- [ ] 2. 重写 `support/speccode-workflow/SKILL.md`(按 design.md 蓝图:frontmatter 去 `name:`、去版本化标题「原生链路(双层拓扑)」、链路修 5 错位、新增知识集节、发布节补 tag/Release + syncing 顺序 + 轻档=Tier 1)
- [ ] 3. 改 `support/install-skills.sh`:SRC=`$REPO_ROOT/support`;安装判据「含 SKILL.md 的目录才装」;头部注释路径同步

## 引用同步

- [ ] 4. `CLAUDE.md`(真源路径、install 路径、「support/ 有改动后重跑」、v2 字样)
- [ ] 5. `README.md`(Documentation Map 表行 `skills/`→`support/`、贡献段链路表述、install 命令路径、v2 字样)
- [ ] 6. `README_CN.md`(同 5 触点,与 README.md 逐段对齐,双语同步)
- [ ] 7. `CONTRIBUTING.md`(setup 步骤 2 路径 + v2 字样;Making a change 六步改 0.6.0 双层链路,见 design.md「CONTRIBUTING『Making a change』新链路」)

## 收尾校验

- [ ] 8. 重跑 `bash support/install-skills.sh` 并 `--check` 通过(修复本机 `.claude/skills/` 副本漂移)
- [ ] 9. 全仓 grep 校验:活文档零残留——`scripts/install-skills`、`skills/speccode-workflow`、`v2 原生链路` / `v2 native chain`(豁免:CHANGELOG、`speccode/archive/`、`.ua/`、`.claude/`)
