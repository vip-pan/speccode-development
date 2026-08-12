# readme-english Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全量双语化根 README 与插件 README:英文版成为默认门面(README.md),中文版改名 README_CN.md,互链矩阵 4 组链接无死链,多语言维护纪律写入 CLAUDE.md 与 spec。

**Architecture:** 文件重命名(`git mv` 保留历史)→ 英文全量翻译(结构一一对应:根 README 12 段、插件 README §1-14)→ 互链矩阵(语言切换链接 + 跨层同语言引用)→ CLAUDE.md 增补(四文件分工 + 多语言维护说明)→ 全量验证回归。无引擎代码改动。

**Tech Stack:** 无(纯文档)。验证工具:git / grep / node --test(仅回归)。

## Global Constraints

- 根 README 段落结构 12 段,EN/CN 一一对应;CN 版既有中文内容不变(仅加语言切换链接)
- 插件 README 节号编号 §1-14,EN/CN 逐节一致;无编号「依赖与前置要求」块在 §1 之后
- 专名保留原文:`/speccode:` 命令名、worktree/trunk/feature/spec/state/memory/hooks/ledger、R1-R13、§ 引用、`git worktree add` 等命令
- 两语言版本均不得含版本号字面量(`0.x.y`)与测试数量字面量;版本信息以 CHANGELOG 链接呈现
- 互链矩阵 4 组:根 EN↔CN(前 5 行内)、插件 EN↔CN(前 5 行内)、根→插件同语言、插件门面指针→同语言根 README
- badges 两版都留(license/平台/星标,无版本号)
- 所有重命名用 `git mv`(保留历史),不用复制新建
- 全量测试 137/137 回归(引擎未动,验证性)

---

### Task 1: 根 README 改名并给中文版加语言切换链接

**Files:**
- Rename: `README.md` → `README_CN.md`(git mv)
- Modify: `README_CN.md`(标题后加 toggle)

**Interfaces:**
- Consumes: 现根 `README.md`(中文门面,PR #12 版本,12 段骨架)
- Produces: `README_CN.md`(中文门面 + 顶部 toggle);为 Task 2 提供翻译对照原文

- [ ] **Step 1: git mv 改名**

```bash
cd <worktree>
git mv README.md README_CN.md
```

- [ ] **Step 2: 加语言切换链接**

在 `README_CN.md` 标题行(`# speccode`)之后、badges 之前插入:

```markdown
[English](README.md) | [简体中文](README_CN.md)
```

- [ ] **Step 3: 验证**

```bash
git mv 历史保留: git log --oneline --follow README_CN.md | head -1   # 应显示 PR #12 提交
前 5 行含 toggle: head -5 README_CN.md | grep "README.md"
```

Expected: 历史可追;toggle 在标题后。

- [ ] **Step 4: 提交**

```bash
git add README_CN.md
git commit -m "docs: rename root README to README_CN for bilingual split"
```

---

### Task 2: 新建英文根 README(12 段全量翻译)

**Files:**
- Create: `README.md`(英文门面)

**Interfaces:**
- Consumes: `README_CN.md`(Task 1,翻译原文);链接目标 `plugins/speccode/README.md`(Task 4 创建,先写链接即可)
- Produces: 根英文门面,作为根中文版的翻译对照锚

- [ ] **Step 1: 逐段翻译**

按下列 12 段映射逐段全量翻译(段序、段数一一对应,不增删):

| # | README_CN.md(中文) | README.md(英文) |
|---|---|---|
| 0 | 标题 + 一句话定位 + badges(3 枚) | `# speccode` + 英文定位 + 同 3 枚 badges |
| 0.5 | 语言切换链接(README.md) | 语言切换链接(README_CN.md)——前 5 行内 |
| 1 | ## 为什么用 speccode | ## Why speccode(3 条痛点逐条翻译) |
| 2 | ## 看它干活 | ## See It in Action(模拟会话代码块,`/speccode:` 命令与 ✓ 行保留,注释翻译) |
| 3 | ## Quickstart(5 分钟最小闭环) | ## Quickstart(5-Minute Minimal Loop) |
| 4 | ## 21 个命令速览 | ## 21 Commands at a Glance(三组表格,命令名原文) |
| 5 | ## 三层分支拓扑 | ## Three-Layer Branch Topology(ASCII 图保留) |
| 6 | ## 和谁比 | ## How We Compare(三小节 prose 翻译) |
| 7 | ## 理念 | ## Philosophy(5 条翻译) |
| 8 | ## 文档地图 | ## Documentation Map(表格;**插件 README 链接指向 `./plugins/speccode/README.md` 英文版**) |
| 9 | ## 贡献 | ## Contributing(dogfood 链路翻译) |
| 10 | ## License | ## License(链接 `./LICENSE`) |

约束:专名保留原文(Global Constraints);`docs/` 一句说明保留;不出现版本字面量。

- [ ] **Step 2: 验证结构对齐**

```bash
grep -c "^## " README.md README_CN.md        # 两版 ## 标题数一致
grep -nE "0\.[0-9]+\.[0-9]+" README.md        # 无版本字面量,Expected: 无输出
ls plugins/speccode/README.md                 # 链接目标(Task 4 将创建;先确认路径正确)
```

- [ ] **Step 3: 提交**

```bash
git add README.md
git commit -m "docs: add English root README (full translation)"
```

---

### Task 3: 插件 README 改名 + 中文版 toggle + 门面指针改指

**Files:**
- Rename: `plugins/speccode/README.md` → `plugins/speccode/README_CN.md`(git mv)
- Modify: `plugins/speccode/README_CN.md`(toggle + 门面指针改指)

**Interfaces:**
- Consumes: 现 `plugins/speccode/README.md`(中文设计文档,§1-14)
- Produces: `plugins/speccode/README_CN.md`;为 Task 4 提供翻译原文

- [ ] **Step 1: git mv 改名**

```bash
git mv plugins/speccode/README.md plugins/speccode/README_CN.md
```

- [ ] **Step 2: 加 toggle + 改门面指针**

在 `README_CN.md` 标题行之后插入:

```markdown
[English](README.md) | [简体中文](README_CN.md)
```

门面指针改指(原「用户门面…见根 README」):

```markdown
> 用户门面(安装 / Quickstart / 对比定位)见根 README_CN.md;本文档是插件设计文档。
```

- [ ] **Step 3: 验证**

```bash
head -5 plugins/speccode/README_CN.md | grep "README.md"        # toggle 在
head -8 plugins/speccode/README_CN.md | grep "README_CN.md"    # 指针指向中文根
```

- [ ] **Step 4: 提交**

```bash
git add plugins/speccode/README_CN.md
git commit -m "docs: rename plugin README to README_CN for bilingual split"
```

---

### Task 4: 新建英文插件 README(§1-14 全量翻译)

**Files:**
- Create: `plugins/speccode/README.md`(英文设计文档)

**Interfaces:**
- Consumes: `plugins/speccode/README_CN.md`(Task 3,翻译原文);根 `README.md`(Task 2,门面指针目标)
- Produces: 英文设计文档;根两版 README 的「命令速览/拓扑图」链接目标

- [ ] **Step 1: 逐节翻译**

按下列节号映射逐节全量翻译(节号、节序一一对应;§1-14 编号与中文版完全一致):

| 节 | README_CN.md(中文) | README.md(英文) |
|---|---|---|
| 顶部 | 语言切换链接 + 门面指针(见根 README_CN.md) | 语言切换链接 + 门面指针(**见根 README.md**) |
| §1 | ## 1. speccode 是什么 | ## 1. What is speccode |
| 无编号 | ## 依赖与前置要求(适用于全文档) | ## Dependencies & Prerequisites(applies to the whole document) |
| §2 | ## 2. 21 个命令快速参考表 | ## 2. 21-Command Quick Reference(3 张表,命令名原文) |
| §3 | ## 3. 三层分支拓扑图 | ## 3. Three-Layer Branch Topology |
| §4 | ## 4. 开发流程 | ## 4. Development Workflow(12 步) |
| §5 | ## 5. 文档目录 | ## 5. Documentation Layout(含 visual-companion 一句) |
| §6 | ## 6. `.speccode/` 目录结构 | ## 6. The `.speccode/` Directory Structure |
| §7 | ## 7. hooks | ## 7. Hooks(14 事件枚举原文) |
| §8 | ## 8. memory | ## 8. Memory |
| §9 | ## 9. 知识库工具 | ## 9. Knowledge Base Tools |
| §10 | ## 10. 风险与缓解(R1–R13) | ## 10. Risks & Mitigations (R1–R13) |
| §11 | ## 11. 从 0.1 迁移 | ## 11. Migrating from 0.1 |
| §12 | ## 12. 理念 | ## 12. Philosophy |
| §13 | ## 13. 未解决问题 | ## 13. Open Issues |
| §14 | ## 14. ⚠ 重要警告 | ## 14. ⚠ Important Warning |

约束:专名保留原文;R1-R13 风险编号与缓解内容逐条翻译;§ 交叉引用(如「见第 14 节的重要警告」)翻译时保持节号一致;不出现版本字面量。

- [ ] **Step 2: 验证节号对齐**

```bash
grep "^## " plugins/speccode/README.md | wc -l        # 15 个(14 节 + 无编号依赖块)
grep -c "^## " plugins/speccode/README.md plugins/speccode/README_CN.md   # 两版一致
grep -nE "0\.[0-9]+\.[0-9]+" plugins/speccode/README.md   # 无版本字面量
head -8 plugins/speccode/README.md | grep "README.md"     # 指针指向英文根
```

- [ ] **Step 3: 提交**

```bash
git add plugins/speccode/README.md
git commit -m "docs: add English plugin README (full translation)"
```

---

### Task 5: CLAUDE.md 增补(四文件分工 + 多语言维护)

**Files:**
- Modify: `CLAUDE.md`(「这个仓库是什么」段的文档分工段)

**Interfaces:**
- Consumes: 无前序产物(独立)
- Produces: 维护纪律文本;被 spec「文档三层分离」Scenario 覆盖

- [ ] **Step 1: 更新文档分工段**

现有段落:

```markdown
文档分工:根 `README.md` 是 marketplace 用户门面(安装 / Quickstart / 对比定位),`plugins/speccode/README.md` 是插件设计文档,本文件是开发文档。本仓库同时是 Claude Code marketplace 仓(`.claude-plugin/marketplace.json` 声明,托管 speccode 插件)。
```

改为:

```markdown
文档分工:根 `README.md`(英文)/ `README_CN.md`(中文)是 marketplace 用户门面,`plugins/speccode/README.md`(英文)/ `plugins/speccode/README_CN.md`(中文)是插件设计文档,本文件是开发文档(不翻译)。本仓库同时是 Claude Code marketplace 仓(`.claude-plugin/marketplace.json` 声明,托管 speccode 插件)。
```

- [ ] **Step 2: 新增「多语言维护」说明**

紧随分工段之后新增:

```markdown
**多语言维护**:根 README 与插件 README 各有中英两版(README.md=EN,README_CN.md=zh),两版结构一一对应(根 12 段 / 插件 §1-14),任何内容改动 MUST 同步全部语言版本;两版均不得硬编码版本号与测试数量(以 CHANGELOG 链接为单一数据源)。
```

- [ ] **Step 3: 验证**

```bash
grep -n "多语言维护" CLAUDE.md          # 存在
grep -c "README_CN" CLAUDE.md           # ≥ 4(四文件映射)
grep -n "137" CLAUDE.md; echo $?        # 无 137,Expected: exit 1
```

- [ ] **Step 4: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md 多语言维护说明与四文件分工"
```

---

### Task 6: 全量验证回归

**Files:**
- Verify: 全仓库互链矩阵 + 结构一致性 + 测试

**Interfaces:**
- Consumes: Task 1-5 全部产物

- [ ] **Step 1: 互链矩阵 4 组逐链验证**

```bash
# ① 根 EN↔CN toggle
grep -l "README_CN.md" README.md && grep -l "README.md" README_CN.md
# ② 插件 EN↔CN toggle
grep -l "README_CN.md" plugins/speccode/README.md && grep -l "README.md" plugins/speccode/README_CN.md
# ③ 根→插件同语言:根 README.md 引 plugins/speccode/README.md;README_CN.md 引 plugins/speccode/README_CN.md
grep "plugins/speccode/README" README.md README_CN.md
# ④ 插件指针→同语言根:plugins/speccode/README.md 含"README.md";README_CN.md 含"README_CN.md"
grep -h "见根 README" plugins/speccode/README.md plugins/speccode/README_CN.md
```

Expected: 4 组全部命中且语言对应正确;4 个链接目标文件均存在。

- [ ] **Step 2: 结构一致性与防漂移**

```bash
grep -c "^## " README.md README_CN.md                      # 根两版一致
grep -c "^## " plugins/speccode/README.md plugins/speccode/README_CN.md   # 插件两版一致
grep -rnE "0\.[0-9]+\.[0-9]+" README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md   # 无版本字面量
grep -n "137" CLAUDE.md; echo $?                            # exit 1
```

- [ ] **Step 3: 英文版无残留中文(白名单除外)**

```bash
grep -nP '[\x{4e00}-\x{9fff}]' README.md plugins/speccode/README.md
```

Expected: 仅命中白名单行——toggle 文本「简体中文」与专名/代码块(若有)。命中白名单外的行 → 修复后再提交。

- [ ] **Step 4: 全量测试回归**

```bash
cd <worktree>
node --test ./plugins/speccode/tests/*.test.mjs
```

Expected: 137/137 pass。

- [ ] **Step 5: 提交(若 Step 3 有修复)**

```bash
git add -A
git commit -m "docs: fix bilingual consistency issues"
```

---

## 计划自查(inline)

1. **规格覆盖**:spec delta 四条要求(文档三层分离双文件/不漂移扩展/双语互链/CLAUDE 多语言维护)→ Task 1-6 全覆盖:双文件改名与翻译=T1-4,互链矩阵=T1-4+6,CLAUDE 多语言维护=T5,不漂移=T2/4/6 验证。✅
2. **占位符扫描**:无 TBD/TODO;翻译内容由结构映射 + 逐节标题对照约束,非占位。✅
3. **类型一致性**:文件名/路径跨任务一致(README.md=EN、README_CN.md=zh 全局唯一语义);节号 §1-14 在 Task 3/4/6 一致。✅
