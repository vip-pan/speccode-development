# Tasks: flatten-repo

依赖顺序分组;全部在 flatten-repo worktree 内执行,每完成一组跑一次全量测试。

## 1. 迁移(git mv,保历史)

- [x] `mkdir docs` 并 `git mv plugins/speccode/README.md docs/DESIGN.md`、`git mv plugins/speccode/README_CN.md docs/DESIGN_CN.md`(先走设计文档,防 README 撞名覆盖根门面)
- [x] `git mv plugins/speccode/{bin,hooks,lib,references,skills,tests} .`(六个组件目录平移至仓库根)
- [x] `git mv plugins/speccode/.claude-plugin/plugin.json .claude-plugin/plugin.json`(与既有 marketplace.json 同目录并存)
- [x] 移除空目录 `plugins/speccode/`、`plugins/`

## 2. 配置与路径修复

- [x] `.claude-plugin/marketplace.json`:`name` → `speccode`;`plugins[0].source` → `"./"`;description 去「Claude Code 专属」措辞(多宿主定位展开归 docs-multi-host,此处最小改动)
- [x] `.claude-plugin/plugin.json`:`homepage`/`repository` 改指 `speccode` 仓库 URL
- [x] `.github/workflows/test.yml`:测试命令改 `node --test ./tests/*.test.mjs`
- [x] 根 `README.md` 与 `README_CN.md`:版本徽章 raw URL 改指 `.claude-plugin/plugin.json`;文档地图/贡献段中对设计文档与插件路径的引用改 `docs/DESIGN*`;互链矩阵语言对应保持(含 Quickstart marketplace add/install 与徽章链接的仓改名同步——spec 仓库层重命名要求写死旧名的活路径引用 MUST 更新)
- [x] 新建 `AGENTS.md`:迁入现 CLAUDE.md 正文(全部 `plugins/speccode/` 路径改写为根路径:测试 glob `./tests/*.test.mjs`、lib 清单、skills 层说明等),并入根目录 codemap 注入块
- [x] `CLAUDE.md` 改薄壳:`@AGENTS.md` 引入 + Claude Code 专属补充(若有),不复制正文(README 双版文档地图行同步改指 AGENTS.md)
- [x] `docs/DESIGN.md` 与 `docs/DESIGN_CN.md`:门面指针、跨层互链、正文内 `plugins/speccode/` 自引路径全部改写(含 CHANGELOG 相对链接 `../../`→`../` 与升级命令 marketplace 名更新)
- [x] `CONTRIBUTING.md` 路径核对(流程命令与 install-skills.sh 路径不变,仅插件路径引用:测试 glob 与 plugin.json 发布纪律路径)
- [x] 核验 `references/visual-companion-scripts/server.cjs` manifest 上溯路径(预期深度不变,跑一次冒烟确认页脚版本非 unknown)

## 3. 验证

- [x] 全仓 grep `plugins/speccode` 归零(白名单:CHANGELOG 历史条目、`speccode/archive/` 归档文档;执行中发现 7 处清单外活引用并随本条修复:tests/knowledge.test.mjs 与 lib/knowledge.mjs 头注释、skills/applying 与 skills/syncing 的 SKILL.md、support/speccode-workflow/SKILL.md、.github/pull_request_template.md、.github/ISSUE_TEMPLATE/bug_report.md;主规格与蒸馏知识集的残留留待 syncing/distilling,护栏禁止手改)
- [x] `node --test ./tests/*.test.mjs` 全绿(worktree 根执行;发现并修复 tests/cli.test.mjs 两处相对深度假设:`__dirname/..` 原指插件根读设计文档 → 改读 `docs/DESIGN*`,`__dirname/../../..` 原指仓库根 → 改 `__dirname/..`;修复后 279 pass / 0 fail 与基线一致)
- [x] 从非仓库根 cwd 执行 `node --test tests/cli.test.mjs`(cwd 解耦回归;/tmp 与 $HOME 两处 cwd 实测,cli 88 pass、reconcile 8 pass)
- [x] spec scenarios 自检:根目录树(`.claude-plugin/` 恰两文件、无 `plugins/`/`commands/`)、skills 目录式布局、shebang + 可执行位(实测全过;tests 15 文件)

## 4. 人工步骤(不在本 PR 内,合入后由维护者执行)

- [ ] GitHub 仓 rename:`vip-pan/speccode-development` → `vip-pan/speccode`(设置页操作,自动重定向保老链路)
- [ ] 本地 `git remote set-url origin`;发布说明注明新 `marketplace add` URL
- [ ] 发版时按发布纪律补 CHANGELOG 条目与本变更的版本 bump(bump 动作不在本 PR)
