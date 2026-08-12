# 实现计划: readme-docs-overhaul

来源:brainstorm/2026-08-12-readme-claudemd-overhaul-design.md(D1-D7)+ propose/tasks.md。所有改动发生在 worktree `worktree-readme-docs` 上。

## 任务总览

| # | 任务 | 文件 | 依赖 |
|---|---|---|---|
| T1 | 根 README 重构(门面速览+深链) | `README.md` | 无 |
| T2 | LICENSE 文件新增(MIT) | `LICENSE` | 无 |
| T3 | 插件 README 三处调整 | `plugins/speccode/README.md` | 无 |
| T4 | CLAUDE.md 四处微创 | `CLAUDE.md` | 无 |
| T5 | 全量验证回归 | — | T1-T4 |

## T1 根 README 重构

**文件**: 仓库根 `README.md`(整文件重写)

**内容要点**(按设计文档骨架 12 段,自上而下):

1. 标题 `# speccode` + 一句话定位标语:多需求并行开发 + spec 文档托管 + PR 流程标准化 + SDD 方法论,21 个 `/speccode:*` 命令固化
2. badges 行:license(MIT shields)、平台(macOS/Linux)、GitHub 星标;**不含版本号**(D3)
3. 「为什么用 speccode」3 条痛点:多需求并行(worktree 拓扑+对账)/ 文档仓内托管(speccode/ 随 PR 上 trunk)/ 流程标准化(21 命令+hooks+memory)
4. 「看它干活」模拟会话 demo:`init→creating-feature→creating-worktree→proposing→finishing-worktree→finishing-feature`,每步一行命令+一行 ✓ 反馈;基线测试表述「全通过」,**不写用例数字**(D2)
5. 「Quickstart」5 分钟最小闭环:安装 2 条命令(marketplace add + install)→ `/speccode:init` → 首个 feature 四步
6. 「21 个命令速览」:生命周期/文档流/方法论三组一行式列表,互链 `plugins/speccode/README.md` §2 详表
7. 「三层分支拓扑」简化 ASCII:trunk → feature → worktree,完整版互链插件 README §3
8. 「和谁比」prose 三段:vs superpowers(上游,多了分支拓扑/spec 托管/hooks/memory/PR 标准化)/ vs spec-kit(CLI 工具链 vs Claude Code 原生插件,worktree 级并行独门)/ vs 手工约定
9. 「理念」5 条(测试驱动/系统化/降复杂度/证据优先/不自信先问)
10. 「文档地图」:根 README(门面)/ 插件 README(设计文档)/ CHANGELOG(发布记录)/ CLAUDE.md(开发);docs/ 一句带过(superpowers 时代历史归档)
11. 「贡献」:本仓库由 speccode 自托管开发,贡献即走同一条 workflow(dogfood 链路)
12. 「License」:MIT,链接 `LICENSE`

**验证**:
- `grep -n "0\.2\.[0-9]\|0\.1\.[0-9]" README.md` 无命中(版本信息以 CHANGELOG 链接呈现)
- README 中「命令速览」「拓扑图」段含指向 `plugins/speccode/README.md` 的相对链接
- 文件 ≤ 3KB

## T2 LICENSE 文件新增

**文件**: 仓库根 `LICENSE`(新建)

**内容**: MIT 许可证全文,版权行 `Copyright (c) 2026 speccode`(与 plugin.json `author.name` 对齐)

**验证**: `grep -c "MIT License" LICENSE` ≥ 1;`node -e "console.log(require('./plugins/speccode/.claude-plugin/plugin.json').license)"` 输出 `MIT`

## T3 插件 README 三处调整

**文件**: `plugins/speccode/README.md`

1. **门面指针**:标题下第一行(编号正文之前)加:`> 用户门面(安装/Quickstart/对比定位)见根 README;本文档是插件设计文档`
2. **依赖前置**:§1 之后插入无编号「依赖与前置要求」块(git / gh|glab 或降级 none / Node ≥ 24,内容取自原 §14);**删除原 §14 跨平台说明节**;全文检索「第 14 节」交叉引用(§13、§15 及引言处)逐一改指上方依赖块
3. **visual-companion 提及**:第 5 节文档目录处补一句:`references/ 内含 visual-companion(brainstorming 可视化伴侣,见 references/visual-companion.md)`

**验证**: 前 5 行含「见根 README」指针;`grep -n "第 14 节" plugins/speccode/README.md` 无命中;依赖要求出现在文档前部(1-15 行内);含「visual-companion」字样

## T4 CLAUDE.md 四处微创

**文件**: 仓库根 `CLAUDE.md`

1. 测试约定「全量 **137** 个用例」→「全量测试(数量以 tests/ 目录为准)」
2. 「这个仓库是什么」段末加一句:**两 README 分工**——根 README 是 marketplace 用户门面,`plugins/speccode/README.md` 是插件设计文档
3. 「常用命令」节后加发布纪律一行:bump plugin.json version 必须同步 CHANGELOG.md(详见 plugin-packaging spec「版本发布纪律」)
4. 开头或结构节补 marketplace 事实:`.claude-plugin/marketplace.json` 声明本仓库为 marketplace 仓

**验证**: `grep -n "137" CLAUDE.md` 无命中;含「两 README 分工」「发布纪律」「marketplace」字样

## T5 全量验证回归

**命令**:
```bash
cd /Users/game-netease/orca/workspaces/speccode-development
node --test ./plugins/speccode/tests/*.test.mjs   # 137/137 通过
```
(引擎未改动,预期全绿;文档改动不影响逻辑)

**验收清单**(对应 propose/tasks.md 验证节):
- [ ] 全量测试通过
- [ ] 根 README 无 0.2.x 硬编码;CLAUDE.md 无「137」字面量
- [ ] LICENSE 与 plugin.json license 一致
- [ ] 两 README 互链成立
- [ ] 插件 README 无「第 14 节」残留引用

## 衔接(本 feature 后续,不在本计划执行)

- `/speccode:syncing`:将 plugin-packaging delta(MODIFIED 文档三层分离 + ADDED×2)合并入 `speccode/spec/plugin-packaging/spec.md`
- `/speccode:archiving` → `/speccode:finishing-worktree` → `/speccode:finishing-feature`
