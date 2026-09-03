# commands-to-skills 全迁移(0.6.0)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 24 个 `plugins/speccode/commands/<name>.md` 迁移为官方主推的 `plugins/speccode/skills/<name>/SKILL.md` 布局,frontmatter 收敛为只含 `description`,发版 0.6.0。

**Architecture:** 纯文档/结构迁移,零引擎代码改动(lib/bin/tests 已复核零引用)。任务序列 = ①git mv + frontmatter 收敛(同一提交,保 rename 检测)→ ②命令正文内部引用 → ③CLAUDE.md → ④知识集快照修正 → ⑤全仓验证清扫 → ⑥CHANGELOG + plugin.json 发版。每个任务的「测试」是精确的 grep/ls/全量测试基线命令(TDD 红绿循环不适用于无代码的 prose/结构变更)。

**Tech Stack:** git(mv/rename)、BSD sed(macOS `sed -i ''`)、node --test(glob 形式)。

## Global Constraints

- Node ≥ 24;本仓库无 `package.json`,纯 ESM、零第三方依赖——不引入任何新依赖。
- 本变更零引擎代码改动:`plugins/speccode/lib/`、`bin/`、`tests/` MUST NOT 被触碰;全量测试基线 MUST 保持全绿。
- 全量测试命令必须用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`(裸目录形式在 Node v24 报 MODULE_NOT_FOUND)。
- 调用名不变:24 个命令迁移后仍以 `/speccode:<name>` 调用(`<name>` = skills/ 下目录名 = 原 commands/ 下文件名)。
- frontmatter 契约:每个 SKILL.md 只含 `description` 一个字段;无 `name`/`category`/`tags`。
- 不设 `disable-model-invocation`(用户已确认接受模型自动调用,见 design.md D3)。
- 版本发布纪律:bump `plugin.json` version 的提交必须同一提交同步 `CHANGELOG.md` 对应版本小节(含英文 highlights 块 `> EN: …`)。
- README×4(根 README.md / README_CN.md + 插件两版)零改动(已复核无 commands/ 路径引用);若执行中发现引用,停下来报告而不是顺手改。
- 本变更不触碰 `.speccode/` 运行时数据与 `speccode/spec/`(主规格由 syncing 合并,不直改)。
- 文档不硬编码测试用例数量(以 tests/ 目录为准)。

---

### Task 1: 24 个命令 git mv 到 skills/ 布局 + frontmatter 收敛(同一提交)

**Files:**
- Move: `plugins/speccode/commands/<name>.md`(24 个,逐一列出见 Step 1 通配)→ `plugins/speccode/skills/<name>/SKILL.md`
- Modify(移动中顺带):每个 SKILL.md frontmatter 删 `category:` 与 `tags:` 两行

**Interfaces:**
- Consumes: 无(首任务)
- Produces: `plugins/speccode/skills/<name>/SKILL.md` × 24,frontmatter 只含 `description`;`plugins/speccode/commands/` 目录消失。后续所有任务以 skills/ 路径为真源。

- [ ] **Step 1: 建目录并 git mv 24 个文件(保 rename 历史)**

在 worktree 根执行:

```bash
cd plugins/speccode
for f in commands/*.md; do
  name=$(basename "$f" .md)
  mkdir -p "skills/$name"
  git mv "$f" "skills/$name/SKILL.md"
done
```

mv 后 `git status` 应显示 24 条 `renamed:` 记录。

- [ ] **Step 2: frontmatter 删 category/tags(仅这两类行)**

```bash
sed -i '' '/^category: /d;/^tags: /d' plugins/speccode/skills/*/SKILL.md
```

(已核对:category/tags 行全部位于各文件 frontmatter 第 3-4 行,正文无以 `category: ` / `tags: ` 开头的行,sed 行首锚定安全。)

- [ ] **Step 3: 验证结构与 frontmatter**

```bash
find plugins/speccode/skills -name SKILL.md | wc -l
test ! -d plugins/speccode/commands && echo "commands/ 已移除"
grep -rn '^category:\|^tags:\|^name:' plugins/speccode/skills/ ; echo "frontmatter 残留检查 exit=$?"
grep -l '^description:' plugins/speccode/skills/*/SKILL.md | wc -l
head -4 plugins/speccode/skills/exploring/SKILL.md
```

Expected: 第一条输出 `24`;`commands/ 已移除`;grep 残留检查无输出;description 计数 `24`;exploring 头 4 行为 `---` + description + `---`。

- [ ] **Step 4: 运行全量测试(基线不变)**

```bash
node --test ./plugins/speccode/tests/*.test.mjs 2>&1 | tail -3
```

Expected: `fail 0`(引擎零波及确认)。

- [ ] **Step 5: 提交(mv 与 frontmatter 收敛同一提交,design D4)**

```bash
git add -A plugins/speccode
git commit -m "refactor: migrate commands/ to skills/<name>/SKILL.md layout"
```

### Task 2: syncing 命令正文内部引用更新

**Files:**
- Modify: `plugins/speccode/skills/syncing/SKILL.md`(「改名后交叉引用检查」段,全仓 grep 清单)

**Interfaces:**
- Consumes: Task 1 的 skills/ 布局(文件已位于 `skills/syncing/SKILL.md`)
- Produces: 命令正文的 grep 清单覆盖 `plugins/speccode/skills/`

- [ ] **Step 1: 修改交叉引用检查清单中的路径**

把该段的:

```
MUST 全仓 grep 旧 capability 名(至少覆盖 `speccode/spec/`、`plugins/speccode/commands/`、README 与 CLAUDE.md)
```

改为:

```
MUST 全仓 grep 旧 capability 名(至少覆盖 `speccode/spec/`、`plugins/speccode/skills/`、README 与 CLAUDE.md)
```

- [ ] **Step 2: 验证无其他 commands/ 残留于命令正文**

```bash
grep -rn 'commands/' plugins/speccode/skills/
```

Expected: 无输出。

- [ ] **Step 3: 提交**

```bash
git add plugins/speccode/skills/syncing/SKILL.md
git commit -m "docs(skills): update syncing grep checklist to skills/ path"
```

### Task 3: CLAUDE.md 命令交互层路径更新

**Files:**
- Modify: `CLAUDE.md`(「代码三层分工」第 3 层条目)

**Interfaces:**
- Consumes: Task 1 的 skills/ 布局
- Produces: 开发文档与插件实际布局一致

- [ ] **Step 1: 更新命令交互层条目**

把:

```
3. **命令交互层**(`plugins/speccode/commands/*.md`)—— 24 个 slash 命令的 prose 指令,只负责提问/确认/调用 CLI verb/解析 JSON/报告。
```

改为:

```
3. **命令交互层**(`plugins/speccode/skills/<name>/SKILL.md`,一 skill 一目录)—— 24 个 slash 命令的 prose 指令,只负责提问/确认/调用 CLI verb/解析 JSON/报告。
```

(该条目其余文字「**不重复实现逻辑**,纯 git 动作…」原样保留;条目内后文如有 `applying` 描述不动。)

- [ ] **Step 2: 验证 CLAUDE.md 无 commands/ 残留**

```bash
grep -n 'commands/' CLAUDE.md
```

Expected: 无输出。

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE): point command layer at skills/ layout"
```

### Task 4: 知识集快照修正(standards.md + environment.md)

**Files:**
- Modify: `speccode/knowledge/development/standards.md`(「命令 markdown 规范」行)
- Modify: `speccode/knowledge/development/environment.md`(「Claude Code 插件机制结构」行)

**Interfaces:**
- Consumes: Task 1-3 的新布局事实
- Produces: 知识集现行快照与本变更一致(现行快照被本变更证伪,随变更改——0.5.1 同型先例)

- [ ] **Step 1: 改 standards.md「命令 markdown 规范」行**

把该行(以「**命令 markdown 规范**:全程中文交互;frontmatter 为 description + 非标遗留 category/tags」开头)整行替换为:

```
**命令 markdown 规范**:全程中文交互;0.6.0 起旧命令目录已全量迁移为 skills/ 布局(命令位于 plugins/speccode/skills/<name>/SKILL.md,一 skill 一目录,调用名 = 目录名,与迁移前的 /speccode:<name> 形态完全一致),frontmatter 只含 description(name/category/tags 全部移除——name 致 VS Code 菜单歧义已于 0.5.1 删,category/tags 非标遗留随 0.6.0 skills 迁移一并清理;description 兼作模型自动调用的匹配面,不设 disable-model-invocation);未知 verb 或抛错 → {ok:false, error} + exit 1。
```

行尾「(出自 …)」出处括号整段保留原文,并在末尾追加:`;0.6.0 由 commands-to-skills 变更修正`(0.5.1 同型先例的追加方式)。注意:替换文本 MUST NOT 含字面 `commands/`(Task 5 的全仓清扫禁区要求)。

- [ ] **Step 2: 改 environment.md「组件(commands/bin 等)」措辞**

把:

```
组件(commands/bin 等)在插件根而非 .claude-plugin/ 内
```

改为:

```
组件(skills/bin 等)在插件根而非 .claude-plugin/ 内
```

- [ ] **Step 3: 验证知识集无字面 commands/ 残留**

```bash
grep -rn 'commands/' speccode/knowledge/
```

Expected: 无输出。

- [ ] **Step 4: 提交**

```bash
git add speccode/knowledge/development/standards.md speccode/knowledge/development/environment.md
git commit -m "docs(knowledge): sync command-layer snapshot to skills/ layout"
```

### Task 5: 全仓验证清扫 + 全量测试

**Files:**
- 无新增改动(本任务是验证门;发现残留 → 回对应任务修复后重跑)

**Interfaces:**
- Consumes: Task 1-4 的全部产出
- Produces: 「全仓无 commands/ 路径残留」的验证证据(供 code review 与 finishing-worktree 引用)

- [ ] **Step 1: 全仓 grep commands/ 清扫**

```bash
grep -rn 'commands/' --include='*.md' --include='*.mjs' --include='*.json' --include='*.sh' --include='*.yml' \
  CLAUDE.md README.md README_CN.md CONTRIBUTING.md plugins/ scripts/ speccode/ .github/ .claude-plugin/ \
  | grep -v 'speccode/archive/\|speccode/changes/\|speccode/knowledge/_index.md'
```

Expected: 无输出(README×4 重验防漂移;CONTRIBUTING.md 若含 commands/ 路径,停下报告)。另验 CHANGELOG 历史小节合法残留:

```bash
grep -n 'commands/' CHANGELOG.md
```

Expected: 仅命中 `[0.5.1]` 及更早历史小节(`[0.6.0]` 新小节按 Task 6 措辞书写,不视为残留)。

- [ ] **Step 2: 全量测试**

```bash
node --test ./plugins/speccode/tests/*.test.mjs 2>&1 | tail -3
```

Expected: `fail 0`。

- [ ] **Step 3: 结构终验**

```bash
ls plugins/speccode/                      # bin hooks lib references skills tests README.md README_CN.md .claude-plugin(无 commands)
find plugins/speccode/skills -name SKILL.md | wc -l   # 24
```

(无独立提交;验证通过即本任务完成,发现残留则修复随对应任务的提交走。)

### Task 6: 发版 0.6.0(CHANGELOG + plugin.json 同一提交)

**Files:**
- Modify: `CHANGELOG.md`(新增 `[0.6.0]` 小节 + 底部比较链接)
- Modify: `plugins/speccode/.claude-plugin/plugin.json`(`version`)

**Interfaces:**
- Consumes: Task 1-5 的全部产出(发版描述事实来源)
- Produces: version `0.6.0` 与 CHANGELOG `[0.6.0]` 小节同提交(版本发布纪律)

- [ ] **Step 1: CHANGELOG 新增 [0.6.0] 小节**

在 `## [Unreleased]` 之后、`## [0.5.1]` 之前插入(日期用执行当日):

```markdown
## [0.6.0] - <YYYY-MM-DD>

> EN: Migrate all 24 slash commands to the officially recommended `skills/` layout (`skills/<name>/SKILL.md`) — invocation names unchanged (`/speccode:<name>`), frontmatter trimmed to `description` only (nonstandard `category`/`tags` removed, following the 0.5.1 `name` removal), and skills now participate in model auto-invocation per their descriptions.

### Changed

- **命令布局迁移旧命令目录 → skills/(全部 24 个)**:命令 markdown 迁至 `plugins/speccode/skills/<name>/SKILL.md`(一 skill 一目录,调用名 = 目录名,`/speccode:<name>` 调用形态与迁移前完全一致);frontmatter 收敛为只含 `description`——非标 `category`/`tags` 随 `name` 之后一并移除,frontmatter 不再有非官方字段。skills 是官方对新插件的主推面,该迁移消灭「非标字段被 IDE 客户端捡用」整类问题(0.5.1 的 VS Code 菜单 name 歧义即此类显例),并解锁 `paths`/`when_to_use`/`context` 等 skill 专有字段的后续演进空间。
- **语义增益:命令可被模型自动调用**:迁移前命令仅用户显式调用;skills 布局下 Claude 可按各 skill 的 description 触发时机自动调用(如实现功能时自动加载 test-driven-development),用户显式调用语义不变。
- 命令正文对 `references/` 的引用全部为 `${CLAUDE_PLUGIN_ROOT}/references/...` 绝对路径,迁移零波及;引擎与测试零改动,测试基线不变。
```

- [ ] **Step 2: 底部比较链接**

在链接表 `[0.5.1]:` 行的上一行插入:

```markdown
[0.6.0]: https://github.com/vip-pan/speccode-development/compare/v0.5.1...v0.6.0
```

- [ ] **Step 3: plugin.json bump**

`plugins/speccode/.claude-plugin/plugin.json` 中 `"version": "0.5.1"` → `"version": "0.6.0"`。

- [ ] **Step 4: 验证同提交一致性**

```bash
grep -n '"version"' plugins/speccode/.claude-plugin/plugin.json   # 0.6.0
grep -n '## \[0.6.0\]' CHANGELOG.md                              # 小节存在
```

- [ ] **Step 5: 提交(同一提交)**

```bash
git add CHANGELOG.md plugins/speccode/.claude-plugin/plugin.json
git commit -m "chore: release 0.6.0 (commands to skills migration)"
```

---

## 收尾链路(本计划范围外,按 SDD 链继续)

实现任务全勾后依次:`/speccode:requesting-code-review`(BASE = 本分支首提交前)→ `/speccode:syncing`(delta 合并进 `speccode/spec/plugin-packaging/spec.md` 主规格)→ `/speccode:archiving` → `/speccode:finishing-worktree`(测试门禁 + PR → trunk)→ 合并后 tag `v0.6.0` + GitHub Release(notes 摘自 CHANGELOG)→ 本机 `/plugin marketplace update` 后验证 VS Code 菜单 24 项 `/speccode:<name>` 形态 + 会话 skills 列表出现 `speccode:*`(顺带闭环 0.5.1 菜单回落验证)。
