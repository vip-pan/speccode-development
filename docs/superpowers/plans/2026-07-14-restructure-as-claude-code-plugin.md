# Restructure speccode as a Claude Code Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 speccode 从散落在 `.claude/` 下的源码重组成标准 Claude Code marketplace + plugin 结构，使其能通过 `/plugin marketplace add` + `/plugin install` 安装，命令自动获得 `/speccode:` 命名空间。

**Architecture:** 仓库根 = marketplace 仓（`.claude-plugin/marketplace.json`），插件源码收拢进 `plugins/speccode/` 子目录（`.claude-plugin/plugin.json` + `commands/` + `bin/` + `lib/` + `tests/`）。命令正文从 `node .claude/speccode/bin/speccode.mjs` 改为依赖 `bin/` 进 PATH 的裸调 `speccode.mjs`。引擎逻辑（9 lib + bin 内部）零改动——纯包络层重组。

**Tech Stack:** Node ≥ 24，纯 ESM，零第三方依赖（仅 `node:` 内置模块），`node:test` 测试框架，git，Claude Code 插件机制（v2.1.x）。

## Global Constraints

- 零第三方依赖：仅 `node:` 内置模块，无 `package.json`。
- Node ≥ 24，纯 ESM（`.mjs`）。
- 引擎逻辑零改动：`bin/speccode.mjs` 与 `lib/*.mjs` 内部 `import` 全为 `./` 或 `../lib/` 相对路径，随目录搬移后不改。
- `.speccode/` 运行时数据落目标项目根（引擎 `speccodeDirOf` 逻辑不动），与插件安装位置解耦。
- 插件 name `speccode`（提供 `/speccode:` 命名空间）；marketplace name `speccode-development`；根目录、GitHub 仓库名同为 `speccode-development`。
- `speccode.mjs` MUST 保持 `#!/usr/bin/env node` shebang 与 `+x` 可执行位（裸调依赖）。
- 测试用 `node --test ./plugins/speccode/tests/*.test.mjs`（glob 形式，非裸目录）。
- 双份文档保持同步：本 plan + OpenSpec artifact（`openspec/changes/restructure-as-claude-code-plugin/`）+ 设计 spec（`docs/superpowers/specs/2026-07-14-restructure-as-claude-code-plugin-design.md`）。

## 关于 TDD 的说明

本次改造是**机械搬移 + 配置/文档**，无新逻辑。因此没有"写失败测试 → 实现 → 通过"的 TDD 循环。测试套件（11 个文件）作为**回归保护网**：每个机械改动后跑全套确保引擎行为未变。每个 task 的验证标准是：
1. 现有测试仍全绿（`node --test ./plugins/speccode/tests/*.test.mjs`）。
2. `grep` 复查无残留旧路径引用。

任务 2（搬移后立即跑测试）是关键回归点——若搬移后测试断，说明有路径耦合没处理。

---

## File Structure

### 新建文件

| 路径 | 职责 |
|---|---|
| `.claude-plugin/marketplace.json` | marketplace 声明：name `speccode-development`，plugins 数组指向 `./plugins/speccode` |
| `plugins/speccode/.claude-plugin/plugin.json` | 插件 manifest：name `speccode`、version `0.1.0` + 元数据 |
| `plugins/speccode/`（整棵子树） | 插件根，承载搬移来的 commands/bin/lib/tests/README |
| `.gitignore` | 仓库根忽略 `.speccode/`、`.idea/` |
| `README.md`（根） | marketplace 索引：项目描述 + 插件列表 + 安装方式 |

### 搬移文件（git mv，保留历史）

| 旧路径 | 新路径 |
|---|---|
| `.claude/commands/speccode/*.md`（10） | `plugins/speccode/commands/*.md` |
| `.claude/speccode/bin/speccode.mjs` | `plugins/speccode/bin/speccode.mjs` |
| `.claude/speccode/lib/*.mjs`（10） | `plugins/speccode/lib/*.mjs` |
| `.claude/speccode/README.md` | `plugins/speccode/README.md` |
| `tests/*.test.mjs` + `tests/helpers/`（11） | `plugins/speccode/tests/*.test.mjs` + `plugins/speccode/tests/helpers/` |

### 修改文件

| 路径 | 改动 |
|---|---|
| `plugins/speccode/commands/*.md`（8 个有引擎调用的） | `node .claude/speccode/bin/speccode.mjs` → `speccode.mjs`（共 10 处） |
| `plugins/speccode/tests/cli.test.mjs` | BIN 定位改 `import.meta.url`；import 改 `../bin/` |
| `plugins/speccode/tests/*.test.mjs`（10 个） | import 路径 `../.claude/speccode/lib/*` → `../lib/*` |
| `CLAUDE.md` | 重写为开发视角，路径全更新 |
| `.claude/settings.local.json` | 重写，删旧绝对路径 permission |
| `docs/superpowers/plans/2026-07-10-speccode-plugin.md` | 文件头加 DEPRECATED 说明 |

### 保留不动

`openspec/`、`docs/`（除标注废弃的旧 plan）、`.claude/commands/opsx/`（9）、`.claude/skills/openspec-*/`（9）。

---

## Task 1: 建插件目录骨架与 manifest

**Files:**
- Create: `plugins/speccode/.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `plugins/speccode/commands/`、`plugins/speccode/bin/`、`plugins/speccode/lib/`、`plugins/speccode/tests/helpers/`（空目录占位）

**Interfaces:**
- Produces: `plugin.json`（name `speccode`，后续 task 不再改字段结构，仅 task 8.4 回填 URL）、`marketplace.json`（source 指向 `./plugins/speccode`，后续不动）

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p plugins/speccode/.claude-plugin plugins/speccode/commands plugins/speccode/bin plugins/speccode/lib plugins/speccode/tests/helpers .claude-plugin
```

- [ ] **Step 2: 写 plugin.json**

文件 `plugins/speccode/.claude-plugin/plugin.json`：

```json
{
  "name": "speccode",
  "version": "0.1.0",
  "description": "多需求并行开发 + spec 文档托管 + PR/MR 流程标准化的 Claude Code 流程编排插件",
  "author": { "name": "speccode" },
  "license": "MIT",
  "homepage": "https://github.com/<owner>/speccode-development",
  "repository": "https://github.com/<owner>/speccode-development",
  "keywords": ["workflow", "git", "worktree", "pr", "openspec"]
}
```

> `<owner>` 为占位，task 8.4 在 GitHub 改名后回填实际 owner。

- [ ] **Step 3: 写 marketplace.json**

文件 `.claude-plugin/marketplace.json`：

```json
{
  "name": "speccode-development",
  "owner": { "name": "speccode" },
  "plugins": [
    {
      "name": "speccode",
      "source": "./plugins/speccode",
      "description": "多需求并行开发 + spec 文档托管 + PR/MR 流程标准化"
    }
  ]
}
```

- [ ] **Step 4: 校验 JSON 合法**

```bash
node -e "JSON.parse(require('fs').readFileSync('plugins/speccode/.claude-plugin/plugin.json','utf8')); JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); console.log('JSON OK')"
```

Expected: `JSON OK`

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "feat(plugin): add marketplace.json and plugin.json scaffolding"
```

---

## Task 2: git mv 搬移源码（保留历史）

**Files:**
- Move: `.claude/commands/speccode/*.md` → `plugins/speccode/commands/`（10 文件）
- Move: `.claude/speccode/bin/speccode.mjs` → `plugins/speccode/bin/speccode.mjs`
- Move: `.claude/speccode/lib/*.mjs` → `plugins/speccode/lib/`（10 文件）
- Move: `.claude/speccode/README.md` → `plugins/speccode/README.md`
- Move: `tests/*.test.mjs` + `tests/helpers/tmprepo.mjs` → `plugins/speccode/tests/` + `plugins/speccode/tests/helpers/`

**Interfaces:**
- Consumes: Task 1 的目录骨架。
- Produces: `plugins/speccode/{commands,bin,lib,tests}/` 填充完毕。此时命令正文与测试 import 仍是旧路径——Task 3/4 修复。本 task 结束时测试**预期会失败**（import 路径断），这是正常的，Task 4 修好后恢复。

- [ ] **Step 1: 搬移 commands**

```bash
git mv .claude/commands/speccode/develop-complete.md   plugins/speccode/commands/
git mv .claude/commands/speccode/develop-start.md      plugins/speccode/commands/
git mv .claude/commands/speccode/display-merge-trunk.md    plugins/speccode/commands/
git mv .claude/commands/speccode/display-rebase-trunk.md   plugins/speccode/commands/
git mv .claude/commands/speccode/display-reset-to-trunk.md plugins/speccode/commands/
git mv .claude/commands/speccode/finish.md             plugins/speccode/commands/
git mv .claude/commands/speccode/init.md               plugins/speccode/commands/
git mv .claude/commands/speccode/reset.md              plugins/speccode/commands/
git mv .claude/commands/speccode/start.md              plugins/speccode/commands/
git mv .claude/commands/speccode/status.md             plugins/speccode/commands/
```

- [ ] **Step 2: 搬移 bin + lib + README**

```bash
git mv .claude/speccode/bin/speccode.mjs plugins/speccode/bin/speccode.mjs
git mv .claude/speccode/lib/atomic.mjs     plugins/speccode/lib/
git mv .claude/speccode/lib/config.mjs     plugins/speccode/lib/
git mv .claude/speccode/lib/docstrip.mjs   plugins/speccode/lib/
git mv .claude/speccode/lib/git.mjs        plugins/speccode/lib/
git mv .claude/speccode/lib/prtool.mjs     plugins/speccode/lib/
git mv .claude/speccode/lib/reconcile.mjs  plugins/speccode/lib/
git mv .claude/speccode/lib/slug.mjs       plugins/speccode/lib/
git mv .claude/speccode/lib/state.mjs      plugins/speccode/lib/
git mv .claude/speccode/lib/timestamp.mjs  plugins/speccode/lib/
git mv .claude/speccode/lib/waitmerge.mjs  plugins/speccode/lib/
git mv .claude/speccode/README.md          plugins/speccode/README.md
```

- [ ] **Step 3: 搬移 tests**

```bash
git mv tests/atomic.test.mjs     plugins/speccode/tests/
git mv tests/cli.test.mjs        plugins/speccode/tests/
git mv tests/config.test.mjs     plugins/speccode/tests/
git mv tests/docstrip.test.mjs   plugins/speccode/tests/
git mv tests/git.test.mjs        plugins/speccode/tests/
git mv tests/prtool.test.mjs     plugins/speccode/tests/
git mv tests/reconcile.test.mjs  plugins/speccode/tests/
git mv tests/slug.test.mjs       plugins/speccode/tests/
git mv tests/state.test.mjs      plugins/speccode/tests/
git mv tests/waitmerge.test.mjs  plugins/speccode/tests/
git mv tests/helpers/tmprepo.mjs plugins/speccode/tests/helpers/
```

- [ ] **Step 4: 删除搬空目录**

```bash
rmdir .claude/commands/speccode .claude/speccode/bin .claude/speccode/lib .claude/speccode tests/helpers tests 2>/dev/null
git rm -r --cached .claude/commands/speccode .claude/speccode 2>/dev/null || true
```

- [ ] **Step 5: 确认 bin 权限与 shebang 保留**

```bash
ls -la plugins/speccode/bin/speccode.mjs | awk '{print $1}'
head -1 plugins/speccode/bin/speccode.mjs
```

Expected: 权限含 `x`（如 `-rwxr-xr-x`），首行 `#!/usr/bin/env node`。若权限丢失：`chmod +x plugins/speccode/bin/speccode.mjs`。

- [ ] **Step 6: 确认文件计数**

```bash
echo "commands: $(ls plugins/speccode/commands/*.md | wc -l)"
echo "lib: $(ls plugins/speccode/lib/*.mjs | wc -l)"
echo "tests: $(ls plugins/speccode/tests/*.test.mjs | wc -l)"
```

Expected: `commands: 10`、`lib: 10`、`tests: 10`（+ `helpers/tmprepo.mjs`）。

- [ ] **Step 7: 暂不跑测试（预期失败，Task 4 修好）**

跳过测试。直接 commit 搬移。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(plugin): git mv engine/commands/tests into plugins/speccode/"
```

---

## Task 3: 命令正文裸调化（方案 B）

**Files:**
- Modify: `plugins/speccode/commands/develop-complete.md`（1 处）
- Modify: `plugins/speccode/commands/develop-start.md`（1 处）
- Modify: `plugins/speccode/commands/finish.md`（2 处）
- Modify: `plugins/speccode/commands/init.md`（3 处，含 1 处 stdin 管道）
- Modify: `plugins/speccode/commands/reset.md`（1 处）
- Modify: `plugins/speccode/commands/start.md`（1 处，stdin 管道）
- Modify: `plugins/speccode/commands/status.md`（1 处）

**Interfaces:**
- Consumes: Task 2 搬移后的命令文件。
- Produces: 所有命令正文引擎调用统一为 `speccode.mjs <verb> --cwd .` 裸调形态。依赖插件 `bin/` 进 PATH（运行时由 Claude Code 保证）。

> `display-merge-trunk.md`、`display-rebase-trunk.md`、`display-reset-to-trunk.md` 无引擎调用，不改。

- [ ] **Step 1: 全局替换引擎调用前缀**

对所有 7 个含调用的文件，把 `node .claude/speccode/bin/speccode.mjs` 替换为 `speccode.mjs`：

```bash
# 先看将替换的全部位置（应输出 10 行）
grep -rn "node .claude/speccode/bin/speccode.mjs" plugins/speccode/commands/
```

Expected: 10 行，分布在 develop-complete(1)、develop-start(1)、finish(2)、init(3)、reset(1)、start(1)、status(1)。

- [ ] **Step 2: 逐文件替换**

用 sed 或编辑器对每个文件执行：`node .claude/speccode/bin/speccode.mjs` → `speccode.mjs`。

```bash
for f in plugins/speccode/commands/develop-complete.md plugins/speccode/commands/develop-start.md plugins/speccode/commands/finish.md plugins/speccode/commands/init.md plugins/speccode/commands/reset.md plugins/speccode/commands/start.md plugins/speccode/commands/status.md; do
  sed -i '' 's|node \.claude/speccode/bin/speccode\.mjs|speccode.mjs|g' "$f"
done
```

- [ ] **Step 3: 确认 stdin 管道写法仍正确**

```bash
grep -n "echo.*| speccode.mjs" plugins/speccode/commands/init.md plugins/speccode/commands/start.md
```

Expected: 2 行，形态为 `echo '<json>' | speccode.mjs <verb> --cwd . --json-stdin`（shebang 负责 `env node`，管道数据正常透传 stdin）。

- [ ] **Step 4: grep 复查无残留旧前缀**

```bash
grep -rn "node .claude/speccode/bin/speccode.mjs\|\.claude/speccode/bin\|\${CLAUDE_PLUGIN_ROOT}" plugins/speccode/commands/
```

Expected: 无输出（零残留）。

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/commands/
git commit -m "refactor(commands): invoke speccode.mjs via PATH bare call (scheme B)"
```

---

## Task 4: 测试路径解耦 cwd

**Files:**
- Modify: `plugins/speccode/tests/cli.test.mjs`（BIN 定位 + import）
- Modify: `plugins/speccode/tests/atomic.test.mjs`、`config.test.mjs`、`docstrip.test.mjs`、`git.test.mjs`、`prtool.test.mjs`、`reconcile.test.mjs`、`slug.test.mjs`、`state.test.mjs`、`waitmerge.test.mjs`（import 路径）

**Interfaces:**
- Consumes: Task 2 搬移后的测试文件。
- Produces: 测试从任意 cwd 执行均通过。BIN 定位用 `import.meta.url`（`tests/../bin/speccode.mjs`），lib import 用 `../lib/*.mjs`。

- [ ] **Step 1: 改 cli.test.mjs 的 import 头与 BIN 定位**

把 `plugins/speccode/tests/cli.test.mjs` 的前 9 行：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo } from './helpers/tmprepo.mjs';
import { parseArgs } from '../.claude/speccode/bin/speccode.mjs';

const BIN = join(process.cwd(), '.claude/speccode/bin/speccode.mjs');
```

改为：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makeRepo } from './helpers/tmprepo.mjs';
import { parseArgs } from '../bin/speccode.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'bin', 'speccode.mjs');
```

- [ ] **Step 2: 改其余 9 个测试文件的 lib import 路径**

对每个文件把 `../.claude/speccode/lib/` 替换为 `../lib/`：

```bash
for f in plugins/speccode/tests/atomic.test.mjs plugins/speccode/tests/config.test.mjs plugins/speccode/tests/docstrip.test.mjs plugins/speccode/tests/git.test.mjs plugins/speccode/tests/prtool.test.mjs plugins/speccode/tests/reconcile.test.mjs plugins/speccode/tests/slug.test.mjs plugins/speccode/tests/state.test.mjs plugins/speccode/tests/waitmerge.test.mjs; do
  sed -i '' 's|\.\./\.claude/speccode/lib/|../lib/|g' "$f"
done
```

> `atomic.test.mjs` 有两行 import（atomic + timestamp），sed 一次处理两行。

- [ ] **Step 3: grep 复查无残留旧路径**

```bash
grep -rn "\.\./\.claude/speccode\|process\.cwd().*speccode" plugins/speccode/tests/
```

Expected: 无输出。

- [ ] **Step 4: 跑全量测试（回归关键点）**

```bash
node --test ./plugins/speccode/tests/*.test.mjs
```

Expected: 全部 PASS（10 个文件，0 fail）。若 fail，检查是否漏改某个 import 路径。

- [ ] **Step 5: 从非仓库根目录跑测试，验证 cwd 解耦**

```bash
cd /tmp && node --test /Users/game-netease/workspaces/plugin/coding/plugins/speccode/tests/cli.test.mjs 2>&1 | tail -5
```

Expected: PASS（证明 BIN 定位不依赖 cwd）。

- [ ] **Step 6: Commit**

```bash
git add plugins/speccode/tests/
git commit -m "test: decouple test paths from cwd via import.meta.url"
```

---

## Task 5: 文档三层分离

**Files:**
- Create: `README.md`（根，marketplace 索引）
- Modify: `CLAUDE.md`（重写为开发视角）
- Keep: `plugins/speccode/README.md`（用户文档，Task 2 已搬来，内容不改）
- Modify: `docs/superpowers/plans/2026-07-10-speccode-plugin.md`（加 DEPRECATED 头）

**Interfaces:**
- Consumes: Task 1-4 的最终目录结构。
- Produces: 三层文档——根 README（marketplace 索引）/ 插件 README（用户文档）/ CLAUDE.md（开发文档）。

- [ ] **Step 1: 写根 README.md**

文件 `README.md`：

````markdown
# speccode-development

Claude Code marketplace：托管 speccode 及未来相关插件。

## 插件列表

| 插件 | 说明 | 版本 |
|---|---|---|
| [speccode](./plugins/speccode/) | 多需求并行开发 + spec 文档托管 + PR/MR 流程标准化的流程编排插件 | 0.1.0 |

## 安装

```bash
# 本地（开发/测试）
/plugin marketplace add /Users/<you>/workspaces/plugin/speccode-development
/plugin install speccode@speccode-development

# 远端（推到 GitHub 后）
/plugin marketplace add <owner>/speccode-development
/plugin install speccode@speccode-development
```

安装后命令以 `/speccode:` 前缀出现，如 `/speccode:init`、`/speccode:status`、`/speccode:finish`。

## 开发

见 [CLAUDE.md](./CLAUDE.md)（开发视角：引擎三层架构、测试约定、OpenSpec 工作流）与 [plugins/speccode/README.md](./plugins/speccode/README.md)（用户文档：10 命令表、分支拓扑、风险）。
````

- [ ] **Step 2: 重写 CLAUDE.md 为开发视角**

把现有 `CLAUDE.md` 中所有 `.claude/speccode/` 路径替换为 `plugins/speccode/`，测试命令改为 `node --test ./plugins/speccode/tests/*.test.mjs`，并补一句手动调试提示。具体改动点：

1. 「常用命令」节：`node --test ./tests/*.test.mjs` → `node --test ./plugins/speccode/tests/*.test.mjs`；单文件 `node --test tests/reconcile.test.mjs` → `node --test plugins/speccode/tests/reconcile.test.mjs`；过滤用例路径同步；手动驱动 `node .claude/speccode/bin/speccode.mjs` → `node plugins/speccode/bin/speccode.mjs`。
2. 「架构:三层」节：`.claude/speccode/lib/*.mjs` → `plugins/speccode/lib/*.mjs`；`.claude/speccode/bin/speccode.mjs` → `plugins/speccode/bin/speccode.mjs`；`.claude/commands/speccode/*.md` → `plugins/speccode/commands/*.md`。
3. 「关键不变量」节：所有 `.claude/speccode/` 引用更新；补一条「裸调与手动调试」：命令正文裸调 `speccode.mjs`（依赖插件 `bin/` 进 PATH，仅 Claude Code 启用时生效）；手动终端调试用 `node plugins/speccode/bin/speccode.mjs <verb> --cwd .`。
4. 「测试约定」节：`tests/helpers/tmprepo.mjs` → `plugins/speccode/tests/helpers/tmprepo.mjs`；`tests/<module>.test.mjs` → `plugins/speccode/tests/<module>.test.mjs`；`tests/cli.test.mjs` 路径同步，并注明 BIN 定位已用 `import.meta.url`。

> 逐条用编辑器替换，保留原有结构与措辞，仅改路径与新增「裸调与手动调试」段。

- [ ] **Step 3: 标注旧 plan 废弃**

在 `docs/superpowers/plans/2026-07-10-speccode-plugin.md` 文件**最顶部**（标题之前）插入：

```markdown
> **⚠️ DEPRECATED**（2026-07-14）：本文件是 speccode 初版实现的 superpowers plan，其中的路径（`.claude/speccode/`、`.claude/commands/speccode/`）已过时。当前结构以 `openspec/changes/restructure-as-claude-code-plugin/` 与 `plugins/speccode/` 为准。保留此文仅作历史记录。

```

- [ ] **Step 4: grep 复查文档无残留旧路径**

```bash
grep -rn "\.claude/speccode\|\.claude/commands/speccode" CLAUDE.md README.md
```

Expected: 无输出。

```bash
grep -rn "node --test ./tests/\|node --test tests/" CLAUDE.md
```

Expected: 无输出（测试命令已更新为 `./plugins/speccode/tests/`）。

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md docs/superpowers/plans/2026-07-10-speccode-plugin.md
git commit -m "docs: split into marketplace README / plugin README / dev CLAUDE.md; deprecate old plan"
```

---

## Task 6: 配置与清理

**Files:**
- Create: `.gitignore`
- Modify: `.claude/settings.local.json`（重写）

**Interfaces:**
- Consumes: Task 1-5 完成后的最终结构。
- Produces: `.gitignore` 忽略运行时数据与 IDE 文件；settings 只含通配 permission。

- [ ] **Step 1: 写 .gitignore**

文件 `.gitignore`：

```
# speccode 运行时数据（dogfood 产生，按 R4 设计保持 untracked）
.speccode/

# IDE
.idea/
```

- [ ] **Step 2: 重写 settings.local.json**

读取现有 `.claude/settings.local.json`，删除所有指向 `.../coding/.claude/speccode/bin/speccode.mjs` 的绝对路径 permission 条目，保留通配条目。重写后的 `.claude/settings.local.json`：

```json
{
  "permissions": {
    "allow": [
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git check-ignore *)",
      "Bash(git push *)",
      "Bash(git fetch *)",
      "Bash(node *)",
      "Bash(grep *)",
      "Bash(xargs -I{} cat {})",
      "Bash(gh auth *)",
      "Bash(gh pr *)",
      "Bash(cat)",
      "Bash(cd *)",
      "Bash(echo *)",
      "Bash(python3 *)"
    ]
  }
}
```

> 已删除：3 条指向旧 `coding/.claude/speccode/bin/speccode.mjs` 的绝对路径 grep/chmod permission、`chmod 600 ~/.ssh/config` 等 SSH 调试条目、`ssh -T`/`nc -z`/`curl` 网络探测条目（均为一次性调试遗留，非日常所需）。`Bash(node *)` 已覆盖 `speccode.mjs` 裸调（PATH 解析后由 node 执行）与手动 `node plugins/...` 调试。

- [ ] **Step 3: 确认 opsx/openspec skills 原地未动**

```bash
ls .claude/commands/opsx/*.md | wc -l
ls -d .claude/skills/openspec-* | wc -l
```

Expected: `9` 和 `9`。

- [ ] **Step 4: 确认 openspec/、docs/ 原地未动**

```bash
ls openspec/ docs/ >/dev/null && echo "保留"
```

Expected: `保留`。

- [ ] **Step 5: Commit**

```bash
git add .gitignore .claude/settings.local.json
git commit -m "chore: add .gitignore; rewrite settings.local.json without stale abs paths"
```

---

## Task 7: 全量验证

**Files:**
- 无修改，仅验证。

**Interfaces:**
- Consumes: Task 1-6 全部完成。

- [ ] **Step 1: 全量测试**

```bash
node --test ./plugins/speccode/tests/*.test.mjs 2>&1 | tail -15
```

Expected: 全 PASS，0 fail。

- [ ] **Step 2: OpenSpec 严格校验**

```bash
openspec validate restructure-as-claude-code-plugin --strict
```

Expected: `Change 'restructure-as-claude-code-plugin' is valid`。

- [ ] **Step 3: 单测过滤验证（回归抽样）**

```bash
node --test --test-name-pattern="advances pr_open" plugins/speccode/tests/reconcile.test.mjs 2>&1 | tail -5
```

Expected: PASS。

- [ ] **Step 4: 引擎手动驱动验证**

```bash
node plugins/speccode/bin/speccode.mjs resolve-speccode-dir --cwd .
```

Expected: 输出合法 JSON，如 `{"ok":true,"speccodeDir":"<repoRoot>/.speccode"}`。

- [ ] **Step 5: 未知 verb 报错验证**

```bash
node plugins/speccode/bin/speccode.mjs bogus-verb --cwd . ; echo "exit=$?"
```

Expected: 输出 `{"ok":false,"error":"unknown verb: bogus-verb"}`，`exit=1`。

- [ ] **Step 6: 全仓旧路径终检**

```bash
grep -rn "\.claude/speccode\|\.claude/commands/speccode" plugins/ CLAUDE.md README.md 2>/dev/null | grep -v "openspec/changes/archive\|docs/superpowers/plans/2026-07-10"
```

Expected: 无输出（archive 与 deprecated plan 里的旧路径是历史记录，允许保留）。

- [ ] **Step 7: Commit（如有未提交残片）**

```bash
git status --porcelain
```

Expected: 空输出（工作树干净）。若有残片则 `git add -A && git commit -m "chore: verification cleanup"`。

---

## Task 8: 实测插件安装（手动，需在 Claude Code 会话内执行）

**Files:**
- 无文件修改，仅安装验证。

> 此 task 需在 Claude Code 会话内用 `/plugin` 命令执行，无法自动化。若当前不在可交互会话，标注为手动待办。

- [ ] **Step 1: 添加本地 marketplace**

在 Claude Code 内执行：
```
/plugin marketplace add /Users/game-netease/workspaces/plugin/coding
```

Expected: 成功注册名为 `speccode-development` 的 marketplace。

- [ ] **Step 2: 安装 speccode 插件**

```
/plugin install speccode@speccode-development
```

Expected: 安装成功，插件出现在已启用列表。

- [ ] **Step 3: 验证命令命名空间**

在 Claude Code 内查看可用命令，确认 10 个 `/speccode:*` 命令出现：
`/speccode:init`、`/speccode:start`、`/speccode:develop-start`、`/speccode:develop-complete`、`/speccode:finish`、`/speccode:status`、`/speccode:reset`、`/speccode:display-merge-trunk`、`/speccode:display-rebase-trunk`、`/speccode:display-reset-to-trunk`。

- [ ] **Step 4: 验证裸调可执行**

在 Claude Code 内执行 `/speccode:status`（或任意只读命令）。

Expected: 命令正常运行，`speccode.mjs` 经 PATH 裸调成功执行（验证 `bin/` 进 PATH 机制 + shebang）。

---

## Task 9: 仓库层重命名（手动，需用户执行）

**Files:**
- Modify: `plugins/speccode/.claude-plugin/plugin.json`（回填 URL，task 8.4 of OpenSpec）
- 环境层：根目录改名、GitHub 改名、remote 更新

> 此 task 全部为手动操作，无法自动化。按顺序执行。

- [ ] **Step 1: 本地根目录改名**

在仓库**上层目录**执行（不在仓库内）：
```bash
cd /Users/game-netease/workspaces/plugin
mv coding speccode-development
cd speccode-development
```

验证：`git status` 与 `git log --oneline -3` 内容不变（git 跟踪内容不跟踪目录名）。

- [ ] **Step 2: GitHub 仓库改名**

在 GitHub 网页：Settings → Repository name → 改为 `speccode-development` → Rename。GitHub 自动保留旧名重定向。

- [ ] **Step 3: 更新本地 remote**

```bash
git remote set-url origin <新 URL>
git remote -v
```

Expected: remote 指向新仓库名。

- [ ] **Step 4: 回填 plugin.json 的 homepage/repository**

编辑 `plugins/speccode/.claude-plugin/plugin.json`，把 `<owner>` 占位替换为实际 GitHub owner：

```json
{
  "homepage": "https://github.com/<实际owner>/speccode-development",
  "repository": "https://github.com/<实际owner>/speccode-development",
}
```

- [ ] **Step 5: 校准根 README 安装命令**

编辑 `README.md`，把 `<owner>/speccode-development` 替换为实际 owner。

- [ ] **Step 6: Commit URL 校准**

```bash
git add plugins/speccode/.claude-plugin/plugin.json README.md
git commit -m "chore: calibrate plugin.json URLs and README after repo rename"
```

---

## Task 10: 归档与后续

**Files:**
- 无新文件，归档操作。

- [ ] **Step 1: 确认所有自动化任务（1-7）完成且验证通过**

```bash
git log --oneline | head -8
openspec status --change "restructure-as-claude-code-plugin"
```

Expected: 看到 task 1-7 的 commit；OpenSpec 4/4 artifact complete。

- [ ] **Step 2: 同步 delta spec 到主 specs**

```
/opsx:sync
```

Expected: `plugin-packaging` capability 的 delta spec 同步到 `openspec/specs/plugin-packaging/spec.md`。

- [ ] **Step 3: 归档 change**

```
/opsx:archive
```

> 仓库层重命名（Task 9）可在归档后由用户择机执行，不阻塞归档。

- [ ] **Step 4: 记录后续独立 change**

在归档的 change 或新文件中记录三个后续 change（本 plan 不执行）：
1. hooks 自动 reconcile（Stop hook 跑 reconcile 自愈状态漂移）。
2. `--cwd` 默认值优化（bin 默认 `process.cwd()`）。
3. `commands/` → `skills/` 评估（当前判定不适合，保留结论）。

---

## Self-Review

**1. Spec coverage**（对照 `specs/plugin-packaging/spec.md` 的 11 条 requirement）：

| Requirement | 覆盖 task |
|---|---|
| Marketplace 仓库结构 | Task 1（marketplace.json） |
| 插件根目录布局 | Task 1 + Task 2（搬移填充） |
| plugin.json 元数据 | Task 1（version 0.1.0 + 元数据） |
| 命令通过 bin/ PATH 裸调 | Task 3 |
| 插件源码与运行时数据边界 | Task 2（搬移）+ Global Constraints（引擎不动） |
| 命令命名空间 | Task 8 Step 3（实测验证） |
| 测试路径解耦 cwd | Task 4 |
| 文档三层分离 | Task 5 |
| 仓库层重命名 | Task 9 |
| 不打包本仓自用工具 | Task 6 Step 3（验证 opsx/openspec 留原位） |
| 命令正文手写路径与引擎一致（G3 修订） | Global Constraints + Task 7 Step 4（resolve-speccode-dir 验证基准一致） |

无遗漏。

**2. Placeholder scan**：`<owner>` 是刻意占位（Task 9 Step 4 回填），非 plan 缺陷。无 TBD/TODO/"implement later"。每个 code step 都有完整代码。

**3. Type consistency**：`speccode.mjs`（文件名）在所有 task 一致；`import.meta.url` + `fileURLToPath` + `dirname` 在 Task 4 Step 1 定义后无别处引用类型冲突；`plugin.json` 字段在 Task 1 定义、Task 9 仅改 homepage/repository 两字段，无结构漂移。

**4. 与 OpenSpec tasks.md 一致性**：本 plan 10 个 task 对应 OpenSpec tasks.md 的 10 组（1 骨架 / 2 搬移 / 3 裸调 / 4 测试 / 5 文档 / 6 配置清理 / 7 验证 / 8 安装实测 / 9 重命名 / 10 归档）。OpenSpec tasks.md 的 5.5（旧 plan 废弃）在本 plan Task 5 Step 3；G3 requirement 在 Global Constraints + Task 7 Step 4。两份文档对齐。
