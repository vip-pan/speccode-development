# 去掉 superpowers 痕迹 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `docs/superpowers/` 的 15 个历史文档迁移进 `speccode/archive/` 对应变更目录,借机重整 4 个平铺老变更为 `propose/` 结构,改写指向迁移文件的路径引用,删除 `docs/superpowers/`,并清理 1 处活代码注释品牌词与 2 处 README 失效描述。

**Architecture:** 纯文件移动 + 文本编辑,无代码逻辑改动。先迁移文档落位,再重整老变更结构,再改写引用(以重整后路径为准),最后删除源目录与附带清理。每任务以 grep/测试套件独立验证。

**Tech Stack:** git(移动用 `git mv` 保留历史)、Node `--test` 测试套件、grep 引用自检。

## Global Constraints

- 本仓库 Node ≥ 24,纯 ESM,零第三方依赖,无 package.json;测试用 `node --test ./plugins/speccode/tests/*.test.mjs`(必须 glob 形式)。
- 多语言纪律:根 README.md(EN)与 README_CN.md(zh)结构一一对应,改动 MUST 同步两版。
- 正面来源声明一律保留:README:69 / README_CN:69 的 `vs superpowers` 对比、CLAUDE.md:7「移植自 superpowers(v6.2.0)」、plugins/speccode/README*.md:13「ported from superpowers (v6.2.0)」、speccode/spec/plugin-packaging/spec.md:182 反污名化守卫、CHANGELOG.md——这些不动。
- `speccode/spec/`(活规格主档)不动。
- `speccode/archive/` 的归档正文与 B 类陈述性提及不动(6 处,见设计第3段);仅改写 5 处 A 类路径引用。
- 文件移动用 `git mv` 保留 rename 历史;目录创建用 `mkdir -p`。
- 所有命令在 worktree 目录 `/Users/game-netease/orca/workspaces/speccode-development/worktree-remove-superpowers-traces` 内执行(下文 `<WT>` 代指该路径)。
- 提交信息按 conventional commits:`docs(speccode): ...` 或 `chore(speccode): ...`。

---

### Task 1: 迁移 15 个文档到 archive 对应目录

**Files:**
- Move: `docs/superpowers/plans-archived/*.md` → `speccode/archive/<变更>/plan/`(11 个 plan 文件)
- Move: `docs/superpowers/specs-archived/*.md` → `speccode/archive/<变更>/brainstorm/`(4 个 spec 文件)
- Create: `speccode/archive/<变更>/plan/` 与 `brainstorm/` 子目录(按需)

**Interfaces:**
- Consumes: 无
- Produces: 15 个文档落位到 archive,`docs/superpowers/` 暂时保留(本任务不删,Task 4 删)

**映射表(逐文件,源 → 目标):**

| 源 (docs/superpowers/) | 目标 (speccode/archive/...) |
|---|---|
| `plans-archived/2026-07-10-speccode-plugin.md` | `2026-07-13-add-speccode-plugin/plan/2026-07-10-speccode-plugin.md` |
| `plans-archived/2026-07-14-restructure-as-claude-code-plugin.md` | `2026-08-07-restructure-as-claude-code-plugin/plan/2026-07-14-restructure-as-claude-code-plugin.md` |
| `plans-archived/2026-08-07-speccode-v2-p1-topology.md` | `2026-08-09-speccode-v2-sdd-flow/plan/2026-08-07-speccode-v2-p1-topology.md` |
| `plans-archived/2026-08-08-speccode-v2-p2-init-config.md` | `2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p2-init-config.md` |
| `plans-archived/2026-08-08-speccode-v2-p3-doc-lifecycle.md` | `2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p3-doc-lifecycle.md` |
| `plans-archived/2026-08-08-speccode-v2-p4-brainstorm-plans.md` | `2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p4-brainstorm-plans.md` |
| `plans-archived/2026-08-08-speccode-v2-p5-sdd-methodology.md` | `2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p5-sdd-methodology.md` |
| `plans-archived/2026-08-08-speccode-v2-p6-hooks.md` | `2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p6-hooks.md` |
| `plans-archived/2026-08-08-speccode-v2-p7-memory.md` | `2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p7-memory.md` |
| `plans-archived/2026-08-08-speccode-v2-p8-docs-sync-archive.md` | `2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p8-docs-sync-archive.md` |
| `plans-archived/2026-08-10-openspec-superpowers-to-speccode.md` | `2026-08-10-self-host-speccode/plan/2026-08-10-openspec-superpowers-to-speccode.md` |
| `specs-archived/2026-07-14-restructure-as-claude-code-plugin-design.md` | `2026-08-07-restructure-as-claude-code-plugin/brainstorm/2026-07-14-restructure-as-claude-code-plugin-design.md` |
| `specs-archived/2026-08-07-speccode-v2-sdd-flow-brainstorm.md` | `2026-08-09-speccode-v2-sdd-flow/brainstorm/2026-08-07-speccode-v2-sdd-flow-brainstorm.md` |
| `specs-archived/2026-08-09-plugin-release-process-brainstorm.md` | `2026-08-09-plugin-release-process/brainstorm/2026-08-09-plugin-release-process-brainstorm.md` |
| `specs-archived/2026-08-10-openspec-superpowers-to-speccode-design.md` | `2026-08-10-self-host-speccode/brainstorm/2026-08-10-openspec-superpowers-to-speccode-design.md` |

- [ ] **Step 1: 创建目标子目录**

```bash
cd <WT>
mkdir -p speccode/archive/2026-07-13-add-speccode-plugin/plan \
         speccode/archive/2026-08-07-restructure-as-claude-code-plugin/plan \
         speccode/archive/2026-08-07-restructure-as-claude-code-plugin/brainstorm \
         speccode/archive/2026-08-09-speccode-v2-sdd-flow/plan \
         speccode/archive/2026-08-09-speccode-v2-sdd-flow/brainstorm \
         speccode/archive/2026-08-09-plugin-release-process/brainstorm \
         speccode/archive/2026-08-10-self-host-speccode/plan \
         speccode/archive/2026-08-10-self-host-speccode/brainstorm
```

- [ ] **Step 2: 用 git mv 迁移 11 个 plan 文件**

```bash
cd <WT>
git mv docs/superpowers/plans-archived/2026-07-10-speccode-plugin.md speccode/archive/2026-07-13-add-speccode-plugin/plan/2026-07-10-speccode-plugin.md
git mv docs/superpowers/plans-archived/2026-07-14-restructure-as-claude-code-plugin.md speccode/archive/2026-08-07-restructure-as-claude-code-plugin/plan/2026-07-14-restructure-as-claude-code-plugin.md
git mv docs/superpowers/plans-archived/2026-08-07-speccode-v2-p1-topology.md speccode/archive/2026-08-09-speccode-v2-sdd-flow/plan/2026-08-07-speccode-v2-p1-topology.md
git mv docs/superpowers/plans-archived/2026-08-08-speccode-v2-p2-init-config.md speccode/archive/2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p2-init-config.md
git mv docs/superpowers/plans-archived/2026-08-08-speccode-v2-p3-doc-lifecycle.md speccode/archive/2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p3-doc-lifecycle.md
git mv docs/superpowers/plans-archived/2026-08-08-speccode-v2-p4-brainstorm-plans.md speccode/archive/2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p4-brainstorm-plans.md
git mv docs/superpowers/plans-archived/2026-08-08-speccode-v2-p5-sdd-methodology.md speccode/archive/2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p5-sdd-methodology.md
git mv docs/superpowers/plans-archived/2026-08-08-speccode-v2-p6-hooks.md speccode/archive/2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p6-hooks.md
git mv docs/superpowers/plans-archived/2026-08-08-speccode-v2-p7-memory.md speccode/archive/2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p7-memory.md
git mv docs/superpowers/plans-archived/2026-08-08-speccode-v2-p8-docs-sync-archive.md speccode/archive/2026-08-09-speccode-v2-sdd-flow/plan/2026-08-08-speccode-v2-p8-docs-sync-archive.md
git mv docs/superpowers/plans-archived/2026-08-10-openspec-superpowers-to-speccode.md speccode/archive/2026-08-10-self-host-speccode/plan/2026-08-10-openspec-superpowers-to-speccode.md
```

- [ ] **Step 3: 用 git mv 迁移 4 个 spec(brainstorm)文件**

```bash
cd <WT>
git mv docs/superpowers/specs-archived/2026-07-14-restructure-as-claude-code-plugin-design.md speccode/archive/2026-08-07-restructure-as-claude-code-plugin/brainstorm/2026-07-14-restructure-as-claude-code-plugin-design.md
git mv docs/superpowers/specs-archived/2026-08-07-speccode-v2-sdd-flow-brainstorm.md speccode/archive/2026-08-09-speccode-v2-sdd-flow/brainstorm/2026-08-07-speccode-v2-sdd-flow-brainstorm.md
git mv docs/superpowers/specs-archived/2026-08-09-plugin-release-process-brainstorm.md speccode/archive/2026-08-09-plugin-release-process/brainstorm/2026-08-09-plugin-release-process-brainstorm.md
git mv docs/superpowers/specs-archived/2026-08-10-openspec-superpowers-to-speccode-design.md speccode/archive/2026-08-10-self-host-speccode/brainstorm/2026-08-10-openspec-superpowers-to-speccode-design.md
```

- [ ] **Step 4: 验证 15 个文件已落位**

```bash
cd <WT>
find speccode/archive -path "*/plan/*.md" -o -path "*/brainstorm/*.md" | grep -E "2026-07-10-speccode-plugin|2026-07-14-restructure|2026-08-07-speccode-v2-p|2026-08-08-speccode-v2-p|2026-08-10-openspec|2026-08-07-speccode-v2-sdd-flow-brainstorm|2026-08-09-plugin-release-process-brainstorm" | wc -l
```
Expected: `15`

- [ ] **Step 5: 提交**

```bash
cd <WT>
git add -A speccode/archive/ docs/superpowers/
git commit -m "chore(speccode): migrate docs/superpowers into speccode/archive"
```

---

### Task 2: 重整 4 个平铺老变更为 propose/ 结构

**Files:**
- Move: `speccode/archive/2026-07-13-add-speccode-plugin/{design.md,proposal.md,specs/,tasks.md}` → `.../propose/`
- Move: `speccode/archive/2026-08-07-restructure-as-claude-code-plugin/{design.md,proposal.md,specs/,tasks.md}` → `.../propose/`
- Move: `speccode/archive/2026-08-09-plugin-release-process/{proposal.md,specs/,tasks.md}` → `.../propose/`(注意:此变更无 design.md)
- Move: `speccode/archive/2026-08-09-speccode-v2-sdd-flow/{design.md,proposal.md,specs/,tasks.md}` → `.../propose/`
- Delete: 4 个 `.openspec.yaml`
- Preserve: Task 1 刚迁入的 `plan/`、`brainstorm/` 子目录保持在变更根下(不进 propose/,与 2026-08-10-self-host-speccode 结构一致——该变更的 propose/ 与 plan/ 也是平级)

**Interfaces:**
- Consumes: Task 1 的迁移产物(plan/、brainstorm/ 已在变更根下)
- Produces: 4 个老变更统一为 propose/ 结构,与现行约定一致

**结构对照(以 2026-08-10-self-host-speccode 为准):**
```
speccode/archive/<变更>/
├── propose/        ← design.md, proposal.md, specs/, tasks.md
├── plan/           ← 实现计划(Task 1 迁入,平级不进 propose/)
└── brainstorm/     ← 脑暴文档(Task 1 迁入,平级不进 propose/)
```

- [ ] **Step 1: 重整 2026-07-13-add-speccode-plugin**

```bash
cd <WT>
D=speccode/archive/2026-07-13-add-speccode-plugin
mkdir -p "$D/propose"
git mv "$D/design.md" "$D/propose/design.md"
git mv "$D/proposal.md" "$D/propose/proposal.md"
git mv "$D/specs" "$D/propose/specs"
git mv "$D/tasks.md" "$D/propose/tasks.md"
git rm "$D/.openspec.yaml"
```

- [ ] **Step 2: 重整 2026-08-07-restructure-as-claude-code-plugin**

```bash
cd <WT>
D=speccode/archive/2026-08-07-restructure-as-claude-code-plugin
mkdir -p "$D/propose"
git mv "$D/design.md" "$D/propose/design.md"
git mv "$D/proposal.md" "$D/propose/proposal.md"
git mv "$D/specs" "$D/propose/specs"
git mv "$D/tasks.md" "$D/propose/tasks.md"
git rm "$D/.openspec.yaml"
```

- [ ] **Step 3: 重整 2026-08-09-plugin-release-process(无 design.md)**

```bash
cd <WT>
D=speccode/archive/2026-08-09-plugin-release-process
mkdir -p "$D/propose"
git mv "$D/proposal.md" "$D/propose/proposal.md"
git mv "$D/specs" "$D/propose/specs"
git mv "$D/tasks.md" "$D/propose/tasks.md"
git rm "$D/.openspec.yaml"
```

- [ ] **Step 4: 重整 2026-08-09-speccode-v2-sdd-flow**

```bash
cd <WT>
D=speccode/archive/2026-08-09-speccode-v2-sdd-flow
mkdir -p "$D/propose"
git mv "$D/design.md" "$D/propose/design.md"
git mv "$D/proposal.md" "$D/propose/proposal.md"
git mv "$D/specs" "$D/propose/specs"
git mv "$D/tasks.md" "$D/propose/tasks.md"
git rm "$D/.openspec.yaml"
```

- [ ] **Step 5: 验证 4 个目录结构与 .openspec.yaml 已删**

```bash
cd <WT>
# 4 个 propose/ 子目录各含应有文件
for D in 2026-07-13-add-speccode-plugin 2026-08-07-restructure-as-claude-code-plugin 2026-08-09-plugin-release-process 2026-08-09-speccode-v2-sdd-flow; do
  echo "### $D ###"
  find "speccode/archive/$D" -maxdepth 2 -type f | sort
done
# .openspec.yaml 应已全删
find speccode/archive -name ".openspec.yaml" | wc -l
```
Expected: 4 个目录各有 `propose/{proposal.md,specs/,tasks.md}`(前三个含 design.md,plugin-release-process 无);`.openspec.yaml` 计数为 `0`。

- [ ] **Step 6: 提交**

```bash
cd <WT>
git add -A speccode/archive/
git commit -m "chore(speccode): restructure 4 legacy archive dirs to propose/ layout"
```

---

### Task 3: 改写 5 处 A 类路径引用

**Files:**
- Modify: `speccode/archive/2026-08-07-restructure-as-claude-code-plugin/propose/design.md`(重整后路径,原 design.md:99)
- Modify: `speccode/archive/2026-08-07-restructure-as-claude-code-plugin/propose/tasks.md`(原 tasks.md:36)
- Modify: `speccode/archive/2026-08-09-plugin-release-process/propose/proposal.md`(原 proposal.md:26)
- Modify: `speccode/archive/2026-08-09-plugin-release-process/propose/tasks.md`(原 tasks.md:8)
- Modify: `speccode/archive/2026-08-10-self-host-speccode/propose/design.md`(原 design.md:5)

**Interfaces:**
- Consumes: Task 1(迁移落位)+ Task 2(重整后路径)的产物
- Produces: 5 处路径引用指向新位置,无 A 类悬空引用

**改写表(以重整后的实际路径为基准):**

| 文件(重整后) | 原引用 | 新引用 | 相对关系 |
|---|---|---|---|
| `2026-08-07-restructure-.../propose/design.md` | `docs/superpowers/specs/2026-07-14-restructure-as-claude-code-plugin-design.md` | `../brainstorm/2026-07-14-restructure-as-claude-code-plugin-design.md` | propose/ → 同变更的 brainstorm/ |
| `2026-08-07-restructure-.../propose/tasks.md` | `docs/superpowers/plans/2026-07-10-speccode-plugin.md` | `../../2026-07-13-add-speccode-plugin/plan/2026-07-10-speccode-plugin.md` | propose/ → 跨变更的 plan/ |
| `2026-08-09-plugin-release-process/propose/proposal.md` | `docs/superpowers/specs/2026-08-09-plugin-release-process-brainstorm.md` | `../brainstorm/2026-08-09-plugin-release-process-brainstorm.md` | propose/ → 同变更的 brainstorm/ |
| `2026-08-09-plugin-release-process/propose/tasks.md` | `docs/superpowers/specs/2026-08-09-plugin-release-process-brainstorm.md` | `../brainstorm/2026-08-09-plugin-release-process-brainstorm.md` | propose/ → 同变更的 brainstorm/ |
| `2026-08-10-self-host-speccode/propose/design.md` | `docs/superpowers/specs/2026-08-10-openspec-superpowers-to-speccode-design.md` | `../brainstorm/2026-08-10-openspec-superpowers-to-speccode-design.md` | propose/ → 同变更的 brainstorm/ |

> 相对路径说明:文件在 `propose/` 下,同变更的 `brainstorm/`/`plan/` 是其兄弟目录,故 `../brainstorm/...`;跨变更则 `../../<变更>/plan/...`。

- [ ] **Step 1: 改写 2026-08-07-restructure-as-claude-code-plugin/propose/design.md**

定位含 `docs/superpowers/specs/2026-07-14-restructure-as-claude-code-plugin-design.md` 的行,把该路径片段替换为 `../brainstorm/2026-07-14-restructure-as-claude-code-plugin-design.md`(保留行内其余文字不变)。

```bash
cd <WT>
F=speccode/archive/2026-08-07-restructure-as-claude-code-plugin/propose/design.md
grep -n "docs/superpowers/specs/2026-07-14-restructure-as-claude-code-plugin-design.md" "$F"
```
用 Edit 工具对该行做精确替换:`docs/superpowers/specs/2026-07-14-restructure-as-claude-code-plugin-design.md` → `../brainstorm/2026-07-14-restructure-as-claude-code-plugin-design.md`。

- [ ] **Step 2: 改写 2026-08-07-restructure-as-claude-code-plugin/propose/tasks.md**

```bash
cd <WT>
F=speccode/archive/2026-08-07-restructure-as-claude-code-plugin/propose/tasks.md
grep -n "docs/superpowers/plans/2026-07-10-speccode-plugin.md" "$F"
```
用 Edit 替换:`docs/superpowers/plans/2026-07-10-speccode-plugin.md` → `../../2026-07-13-add-speccode-plugin/plan/2026-07-10-speccode-plugin.md`。

- [ ] **Step 3: 改写 2026-08-09-plugin-release-process/propose/proposal.md**

```bash
cd <WT>
F=speccode/archive/2026-08-09-plugin-release-process/propose/proposal.md
grep -n "docs/superpowers/specs/2026-08-09-plugin-release-process-brainstorm.md" "$F"
```
用 Edit 替换:`docs/superpowers/specs/2026-08-09-plugin-release-process-brainstorm.md` → `../brainstorm/2026-08-09-plugin-release-process-brainstorm.md`。

- [ ] **Step 4: 改写 2026-08-09-plugin-release-process/propose/tasks.md**

```bash
cd <WT>
F=speccode/archive/2026-08-09-plugin-release-process/propose/tasks.md
grep -n "docs/superpowers/specs/2026-08-09-plugin-release-process-brainstorm.md" "$F"
```
用 Edit 替换:`docs/superpowers/specs/2026-08-09-plugin-release-process-brainstorm.md` → `../brainstorm/2026-08-09-plugin-release-process-brainstorm.md`。

- [ ] **Step 5: 改写 2026-08-10-self-host-speccode/propose/design.md**

```bash
cd <WT>
F=speccode/archive/2026-08-10-self-host-speccode/propose/design.md
grep -n "docs/superpowers/specs/2026-08-10-openspec-superpowers-to-speccode-design.md" "$F"
```
用 Edit 替换:`docs/superpowers/specs/2026-08-10-openspec-superpowers-to-speccode-design.md` → `../brainstorm/2026-08-10-openspec-superpowers-to-speccode-design.md`。

- [ ] **Step 6: 验证无 A 类悬空路径**

```bash
cd <WT>
# 残留的 docs/superpowers/ 引用应全部是 B 类陈述性提及(不含 /specs/ 或 /plans/ 的具体文件路径)
grep -rn "docs/superpowers/" speccode/archive/ | grep -E "docs/superpowers/(specs|plans)/"
```
Expected: 无输出(0 行)。

- [ ] **Step 7: 提交**

```bash
cd <WT>
git add -A speccode/archive/
git commit -m "docs(speccode): rewrite 5 path refs to migrated archive locations"
```

---

### Task 4: 删除 docs/superpowers/ 与 docs/ 空目录

**Files:**
- Delete: `docs/superpowers/`(15 文件已迁出,剩空 plans-archived/ 与 specs-archived/ 子目录)
- Delete: `docs/`(删 superpowers/ 后变空)

**Interfaces:**
- Consumes: Task 1(15 文件已迁走)
- Produces: `docs/` 不复存在

- [ ] **Step 1: 确认 docs/superpowers/ 已空(无文件)**

```bash
cd <WT>
find docs/superpowers -type f | wc -l
```
Expected: `0`

- [ ] **Step 2: 删除 docs/superpowers/ 与 docs/**

```bash
cd <WT>
git rm -r docs/superpowers
# docs/ 现在为空目录,git 不跟踪空目录,但若 docs/ 曾被跟踪则需显式处理
rmdir docs 2>/dev/null || true
```

- [ ] **Step 3: 验证 docs/ 已消失**

```bash
cd <WT>
test -d docs && echo "FAIL: docs/ still exists" || echo "PASS: docs/ removed"
```
Expected: `PASS: docs/ removed`

- [ ] **Step 4: 提交**

```bash
cd <WT>
git add -A
git commit -m "chore(speccode): remove docs/superpowers/ (migrated to speccode/archive/)"
```

---

### Task 5: 删 README:85(中英两版)

**Files:**
- Modify: `README.md`(删第 85 行 `` `docs/` is an archive of historical plans from the early (superpowers-era) days. ``)
- Modify: `README_CN.md`(删第 85 行 `` `docs/` 为早期(superpowers 时代)历史计划归档。 ``)

**Interfaces:**
- Consumes: Task 4(docs/ 已删,该行失去所指)
- Produces: README 文档地图段无悬空描述

- [ ] **Step 1: 删 README.md:85**

用 Edit 删除该行(含其前后空行处理:该行是表格后独立补充句,删该行及其前导空行,保持段落结构)。

```bash
cd <WT>
grep -n 'docs/` is an archive of historical plans' README.md
```
用 Edit 将:
```
\n`docs/` is an archive of historical plans from the early (superpowers-era) days.\n
```
替换为空(即删除该行与一个空行,使 `## Documentation Map` 表格直接接 `## Contributing`)。

- [ ] **Step 2: 删 README_CN.md:85**

```bash
cd <WT>
grep -n 'docs/` 为早期' README_CN.md
```
用 Edit 做对应中文行的删除(结构与英文版完全对应)。

- [ ] **Step 3: 验证中英两版结构对应**

```bash
cd <WT>
# 两版均不再含 docs/ 归档描述
grep -n 'docs/` is an archive\|docs/` 为早期' README.md README_CN.md
```
Expected: 无输出。

- [ ] **Step 4: 提交**

```bash
cd <WT>
git add README.md README_CN.md
git commit -m "docs(speccode): drop stale docs/ archive line from READMEs"
```

---

### Task 6: 改 sdd.mjs:32 注释品牌词

**Files:**
- Modify: `plugins/speccode/lib/sdd.mjs:32`

**Interfaces:**
- Consumes: 无
- Produces: 注释品牌词 superpowers → speccode

- [ ] **Step 1: 改注释**

用 Edit 替换 `plugins/speccode/lib/sdd.mjs` 第 32 行:
```diff
- // Port of the superpowers task-brief awk: fence lines toggle state; task
+ // Port of the speccode task-brief awk: fence lines toggle state; task
```

- [ ] **Step 2: 运行全量测试**

```bash
cd <WT>
node --test ./plugins/speccode/tests/*.test.mjs 2>&1 | tail -8
```
Expected: `pass 142` / `fail 0`(注释改动预期零影响,但按纪律验证)。

- [ ] **Step 3: 提交**

```bash
cd <WT>
git add plugins/speccode/lib/sdd.mjs
git commit -m "chore(speccode): rebrand sdd.mjs comment superpowers->speccode"
```

---

### Task 7: 全局验证

**Files:** 无(纯验证)

**Interfaces:**
- Consumes: Task 1-6 全部产物
- Produces: 验证报告

- [ ] **Step 1: 引用完整性自检**

```bash
cd <WT>
echo "=== 残留 docs/superpowers/ 引用(应全为 B 类陈述性提及,约 6 处,全在 speccode/archive/) ==="
grep -rn "docs/superpowers" . --include="*.md" --include="*.mjs" 2>/dev/null | grep -v "/.git/"
echo "=== A 类悬空路径(应为 0) ==="
grep -rn "docs/superpowers/" . --include="*.md" --include="*.mjs" 2>/dev/null | grep -E "docs/superpowers/(specs|plans)/" | grep -v "/.git/"
```
Expected: A 类悬空路径 0 行;残留的 docs/superpowers 引用均为 B 类(陈述性提及,不含 /specs/ 或 /plans/ 具体路径)。

- [ ] **Step 2: 确认正面来源声明保留**

```bash
cd <WT>
echo "=== 应保留的来源声明 ==="
grep -n "vs \[superpowers\]" README.md README_CN.md
grep -n "移植自 superpowers" CLAUDE.md
grep -n "ported from superpowers" plugins/speccode/README.md plugins/speccode/README_CN.md
grep -n "superpowers|primeradiant|github.com/obra" speccode/spec/plugin-packaging/spec.md
```
Expected: 各处均有输出(来源声明未被误删)。

- [ ] **Step 3: 全量测试最终确认**

```bash
cd <WT>
node --test ./plugins/speccode/tests/*.test.mjs 2>&1 | tail -8
```
Expected: `pass 142` / `fail 0`。

- [ ] **Step 4: 确认 docs/ 已消失、speccode/spec/ 与 CHANGELOG 未动**

```bash
cd <WT>
test -d docs && echo "FAIL" || echo "PASS: docs/ gone"
git diff main -- speccode/spec/ CHANGELOG.md | wc -l
```
Expected: `PASS: docs/ gone`;spec/ 与 CHANGELOG 的 diff 行数为 `0`(未动)。

> 注:Task 7 不单独提交(纯验证)。若 Step 1 发现 A 类悬空路径,回到 Task 3 修复;若 Step 2 发现来源声明被误删,回到对应任务修复;若 Step 3 测试失败,回到 Task 6 排查。
