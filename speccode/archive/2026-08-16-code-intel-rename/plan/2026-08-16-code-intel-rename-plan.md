# code-intel-rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 代码索引/图谱工具命名从 `knowledge_tools` 改为 `code_intel_tools`,让 `knowledge` 词根回归 SDD 知识集;层 3 彻底改(含 capability 目录 RENAME,经扩展的 syncing 机制执行)。

**Architecture:** 机械改名跨 config/detect/bin/6 命令/README 中英/CLAUDE.md/tests + syncing 扩展(delta `rename-from` 元数据 + syncing.md RENAME 段,无 lib 改动)。spec capability 目录 RENAME 在 syncing 阶段执行(本功能 own 的机制)。

**Tech Stack:** 纯 ESM、零第三方依赖、Node ≥ 24。

## Global Constraints

- 零第三方依赖(仅 `node:` 内置)。
- 确定性逻辑下沉 lib;但 syncing 是 agent 驱动 prose(无 lib 合并函数),capability RENAME 的 git mv 由 agent 执行(prose 指示)—— 与 syncing 现状一致。
- **不兼容历史**:不 bump config version,`loadConfig` 不回退旧字段;改完用户重新 `/speccode:init`。
- **知识集 `knowledge` 不动**:`knowledge-set` capability / `speccode/knowledge/` / `knowledge.mjs` / `read-knowledge` / `write-knowledge` / `recording-knowledge` / `distilling-knowledge` 保持不变。
- detector 表内容不变(understand-anything / codegraph / graphify / codemap / gitnexus),只改字段名 / 函数名 / verb 名。
- syncing 扩展:delta 顶部 `<!-- speccode:rename-from: <旧cap> -->` 元数据 + syncing.md「capability RENAME 处理」段。

---

### Task 1: detect.mjs 常量/函数改名 + 单测

**Files:**
- Modify: `plugins/speccode/lib/detect.mjs`(`KNOWLEDGE_TOOL_DETECTORS` → `CODE_INTEL_TOOL_DETECTORS`;`detectKnowledgeTools` → `detectCodeIntelTools`)
- Test: `plugins/speccode/tests/detect.test.mjs`(import + 调用点改名)

**Interfaces:**
- Produces: `detectCodeIntelTools(cwd, opts)`(原 `detectKnowledgeTools`);`CODE_INTEL_TOOL_DETECTORS`(原 `KNOWLEDGE_TOOL_DETECTORS`)。

- [x] **Step 1: 写失败测试**

`tests/detect.test.mjs` 顶部 import 改 `detectCodeIntelTools` / `CODE_INTEL_TOOL_DETECTORS`;所有 `detectKnowledgeTools` / `KNOWLEDGE_TOOL_DETECTORS` 引用改名。

- [x] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: FAIL —— `detectCodeIntelTools is not a function`(未改名)。

- [x] **Step 3: 写最小实现**

`lib/detect.mjs`:`export const KNOWLEDGE_TOOL_DETECTORS` → `export const CODE_INTEL_TOOL_DETECTORS`;`export function detectKnowledgeTools` → `export function detectCodeIntelTools`(内部逻辑不动)。

- [x] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/detect.mjs plugins/speccode/tests/detect.test.mjs
git commit -m "refactor(detect): rename detectKnowledgeTools→detectCodeIntelTools"
```

### Task 2: bin verb + cli.test.mjs 端到端测改名

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`(VERBS key `detect-knowledge-tools` → `detect-code-intel-tools`;import 改 `detectCodeIntelTools`)
- Test: `plugins/speccode/tests/cli.test.mjs`(端到端测 verb 名改)

- [x] **Step 1: 写失败测试**

`tests/cli.test.mjs` 中 `detect-knowledge-tools` verb 调用改 `detect-code-intel-tools`。

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="detect-code-intel" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL —— `unknown verb: detect-code-intel-tools`。

- [x] **Step 3: 写最小实现**

`bin/speccode.mjs`:import 改 `detectCodeIntelTools`(Task 1);VERBS key `'detect-knowledge-tools'` → `'detect-code-intel-tools'`;handler 内部不动。

- [x] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/cli.test.mjs`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "refactor(cli): rename verb detect-knowledge-tools→detect-code-intel-tools"
```

### Task 3: config 字段名 + init.md + config 测试

**Files:**
- Modify: `plugins/speccode/commands/init.md`(写入字段名 `knowledge_tools` → `code_intel_tools`,2 处)
- Test: 若有 config 测试用 `knowledge_tools` 字段名,改名

**Interfaces:**
- config schema 字段 `code_intel_tools`(原 `knowledge_tools`);`loadConfig`/`saveConfig` 无逻辑改(字段名随 init 写入)。

- [x] **Step 1: 写失败测试**

若 `tests/` 有 config 测试断言 `knowledge_tools` 字段,改断言 `code_intel_tools`。若无 config 字段断言测试,加一条文档断言:`init.md` 含 `code_intel_tools`。

- [x] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/*.test.mjs` (相关)
Expected: FAIL(若改了断言)。

- [x] **Step 3: 写最小实现**

`commands/init.md`:第 31 行 `"knowledge_tools": []` → `"code_intel_tools": []`;第 36 行字段集 `knowledge_tools` → `code_intel_tools`。

- [x] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/*.test.mjs`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/commands/init.md plugins/speccode/tests/
git commit -m "refactor(config): rename field knowledge_tools→code_intel_tools"
```

### Task 4: 6 命令 prose 改名 + 文档断言

**Files:**
- Modify: `commands/exploring.md` / `proposing.md` / `brainstorming.md` / `distilling-knowledge.md` / `init.md`(已 Task 3 改字段)/ `reset.md`
- Test: `tests/cli.test.mjs` 加文档断言

- [x] **Step 1: 写失败测试**

`tests/cli.test.mjs` 加文档断言(每命令):`readFileSync(commands/<cmd>.md)` 含 `code_intel_tools` / `代码智能工具`,MUST NOT 含 `知识库工具咨询`(除历史引用)。

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="code_intel" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL。

- [x] **Step 3: 写最小实现**

6 命令 prose:"知识库工具咨询" → "代码智能工具咨询";`knowledge_tools` 字段引用 → `code_intel_tools`;`detect-knowledge-tools` verb 调用 → `detect-code-intel-tools`。具体:
- `exploring.md`:第 35-36 行"知识库工具咨询"段 + `knowledge_tools` → `code_intel_tools`
- `proposing.md`:第 16 行 + `knowledge_tools`
- `brainstorming.md`:第 23 行 + `knowledge_tools`
- `distilling-knowledge.md`:第 20 行 + `knowledge_tools`
- `reset.md`:第 18 行字段集
- `init.md`:第 25 行 verb 调用 `detect-knowledge-tools` → `detect-code-intel-tools`(字段名 Task 3 已改)

- [x] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/cli.test.mjs`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/commands/ plugins/speccode/tests/cli.test.mjs
git commit -m "docs(speccode): rename knowledge_tools→code_intel_tools in commands"
```

### Task 5: README 中英 + CLAUDE.md

**Files:**
- Modify: `plugins/speccode/README.md` / `README_CN.md`(字段集 + 探测描述,中英结构一一对应);`CLAUDE.md`(Codemap MCP 段措辞,若提及 knowledge_tools / 知识库工具)

- [x] **Step 1: 写失败测试**

`tests/cli.test.mjs` 加文档断言:README.md / README_CN.md 含 `code_intel_tools`,MUST NOT 含 `knowledge_tools`(字段名)。

- [x] **Step 2: 运行确认失败**

Expected: FAIL。

- [x] **Step 3: 写最小实现**

- `plugins/speccode/README.md`:第 148 行字段集 `knowledge_tools` → `code_intel_tools`;第 195 行 `knowledge_tools` → `code_intel_tools`。
- `plugins/speccode/README_CN.md`:第 148 / 195 行同改(中英一一对应)。
- `CLAUDE.md`:第 80 行 Codemap MCP 段,若提及 `knowledge_tools` / "知识库工具" → `code_intel_tools` / "代码智能工具"。

- [x] **Step 4: 运行确认通过**

Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md CLAUDE.md
git commit -m "docs: rename knowledge_tools→code_intel_tools in README/CLAUDE"
```

### Task 6: syncing.md 加 capability RENAME 段 + 文档断言

**Files:**
- Modify: `plugins/speccode/commands/syncing.md`(加「capability RENAME 处理」段)
- Test: `tests/cli.test.mjs` 文档断言

- [x] **Step 1: 写失败测试**

`tests/cli.test.mjs` 加:`readFileSync(commands/syncing.md)` 含 `capability RENAME` + `rename-from` 元数据约定。

- [x] **Step 2: 运行确认失败**

Expected: FAIL。

- [x] **Step 3: 写最小实现**

`commands/syncing.md` 在「合并语义」节前加「capability RENAME 处理」段:

```markdown
## capability RENAME 处理

合并前扫描每个 delta 文件顶部:若含 HTML 注释元数据

<!-- speccode:rename-from: <旧capability名> -->

则:(1) `git mv speccode/spec/<旧>/ speccode/spec/<新>/`(新目录已存在则跳过 mv,只合并 —— 幂等);(2) 继续常规合并 delta 到新目录(ADDED/MODIFIED/REMOVED/RENAMED)。旧目录随 `git mv` 消失,无空壳。重复 syncing:新目录已存在,`git mv` 跳过,合并幂等。
```

- [x] **Step 4: 运行确认通过**

Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/commands/syncing.md plugins/speccode/tests/cli.test.mjs
git commit -m "feat(syncing): support capability RENAME via rename-from metadata"
```

### Task 7: 全量验证 + 重新 init

**Files:** 无新增;验证既有套件 + 手动 verb。

- [x] **Step 1: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS(220 + 本功能新增文档断言)。

- [x] **Step 2: 手动 verb 验证**

Run:
```bash
node plugins/speccode/bin/speccode.mjs detect-code-intel-tools --cwd .   # verb 新名工作
node plugins/speccode/bin/speccode.mjs read-config --cwd . | grep code_intel_tools  # config 新字段(重新 init 后)
```
Expected: `detect-code-intel-tools` 输出 `{ok:true,tools:[...]}`;config 含 `code_intel_tools`(若已重新 init)。

- [x] **Step 3: 提交(若有残留)**

```bash
git status --porcelain || true
# 有残留则 git add -A && git commit -m "chore: rename verify"
```

## 禁止占位符自检

- 所有 step 含可执行代码/命令/断言,无 TBD/TODO。
- 改名一致:`code_intel_tools`(config 字段)/ `detectCodeIntelTools`(函数)/ `CODE_INTEL_TOOL_DETECTORS`(常量)/ `detect-code-intel-tools`(verb)/ `code-intel-tool-integration`(capability 目录)。
- 知识集 `knowledge` 不动(Non-Goals)。
- spec 目录 RENAME 在 syncing 阶段(收尾)执行,非本 plan Task。
