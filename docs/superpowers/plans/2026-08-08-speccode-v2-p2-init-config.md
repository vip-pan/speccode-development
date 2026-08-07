# speccode v2 · P2 init 增强与 config v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 config v2(删 display/spec_tools/untracked_permanent,增 worktree_dir/knowledge_tools/hooks,version 2)、知识工具探测引擎(detect.mjs + 2 verb)、init 幂等重写、creating-worktree 增强(worktree_dir 配置化 + check-ignore 校验 + 项目 setup + 基线测试 + proposing 引导)、reset 字段更新,并捎带 P1 终审的 park 项(finishing-worktree 清理段 push 行补 `-C`)。

**Architecture:** 对应 OpenSpec change `speccode-v2-sdd-flow` 的 P2 阶段(`openspec/changes/speccode-v2-sdd-flow/tasks.md`)。新增 `lib/detect.mjs` 承载全部探测逻辑(环境访问全注入可测),bin 暴露 `detect-knowledge-tools` / `resolve-worktree-dir` 两个读 verb;命令层(init/creating-worktree/reset)为 prose 改写。spec 锚点:knowledge-tool-integration(5 条)、speccode-config-management「config.json 字段集」v2、git-workflow-lifecycle「creating-worktree 项目 setup 与基线测试」「worktree 清理来源限定」。

**Tech Stack:** Node ≥ 24,纯 ESM,零第三方依赖,node:test,tmprepo 真实临时仓。

**前置事实(本机已核实,探测代码以其为形):**
- 插件注册表:`~/.claude/plugins/installed_plugins.json` → `{version, plugins: {"<name>@<marketplace>": [{installPath, version, ...}]}}`;键大小写不敏感子串匹配(如 `understand-anything@understand-anything` 命中 match `understand-anything`)。
- MCP 配置两处:项目 `<cwd>/.mcp.json` 与用户 `~/.claude.json`,均取 `mcpServers` 的 key 做子串匹配。
- tasks.md 2.3(删 DEFAULT_UNTRACKED)**已在 P1 完成**,本计划 Task 7 验收时直接勾选,不重做。

## Global Constraints

- 测试命令 MUST 用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`。
- `lib/detect.mjs` 的所有环境访问(fs 读、`command -v`、homeDir)MUST 经 opts 注入,单测 MUST NOT 触碰真实机器。
- `resolve-worktree-dir` 输出 MUST 为 `{ok:true, dir, source}`,`source ∈ {'config','default'}` 两态(无 'missing' —— spec 已修订为两态)。
- config v2 字段集(逐字,见 spec「config.json 字段集」):`version:2`、`initialized_at`、`trunk`、`remote`、`pr_tool`、`worktree_prefix`、`worktree_dir`、`knowledge_tools`;`hooks` 为可选字段(缺失=无 hook)。v1 三字段(display/spec_tools/untracked_permanent)MUST NOT 出现在 version:2 的 config 中。
- 命令 prose 全程中文;frontmatter 四字段;写 config 一律 `write-config --json-stdin`;命令正文裸调 `speccode.mjs <verb> --cwd .`。
- 知识工具探测结果 MUST 经用户逐项确认才写入 config(D16 不确定先询问);hooks 未配置时 MUST NOT 写入该字段。
- creating-worktree 的 check-ignore 校验与基线测试失败处理都是 warn/询问,永不硬阻断(除用户明确选择中止)。
- 提交信息遵守仓库惯例(`feat:`/`refactor:`/`docs:`/`fix:`/`test:`)。

## File Structure

- Create `plugins/speccode/lib/detect.mjs` — KNOWLEDGE_TOOL_DETECTORS、detectKnowledgeTools、resolveWorktreeDir
- Create `plugins/speccode/tests/detect.test.mjs`
- Modify `plugins/speccode/bin/speccode.mjs` — 2 个新 verb(import detect.mjs)
- Modify `plugins/speccode/tests/cli.test.mjs` — 2 个新 verb 的 e2e
- Rewrite `plugins/speccode/commands/init.md` — config v2 全新/幂等双流程
- Modify `plugins/speccode/commands/creating-worktree.md` — worktree_dir/setup/基线/引导
- Modify `plugins/speccode/commands/reset.md` — v2 字段清理 + memory/sdd 目录清理 + 来源限定
- Modify `plugins/speccode/commands/finishing-worktree.md` — 清理段 push 行补 `-C`(P1 park 项)
- Modify `openspec/changes/speccode-v2-sdd-flow/tasks.md` — P2 勾选(验收任务内)

---

### Task 1: lib/detect.mjs(知识工具探测 + worktree_dir 解析)

**Files:**
- Create: `plugins/speccode/lib/detect.mjs`
- Test: `plugins/speccode/tests/detect.test.mjs`

**Interfaces:**
- Produces:
  - `KNOWLEDGE_TOOL_DETECTORS: [{id, match, bin, dir}]`(5 项)
  - `detectKnowledgeTools(cwd, opts?) -> [{id, kind, evidence}]`;`opts = { homeDir?, readJson?(path)->obj|null, commandV?(bin)->bool, exists?(path)->bool }`;`kind ∈ {'plugin','mcp','cli','project-dir'}`,命中优先级按此顺序,每个 id 至多一条
  - `resolveWorktreeDir(config) -> { dir, source: 'config'|'default' }`
- Consumes: 无(Task 2 的 bin verb 与 init.md 的 prose 依赖这两个签名)。

- [ ] **Step 1: 写失败测试** — 新建 `plugins/speccode/tests/detect.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWLEDGE_TOOL_DETECTORS, detectKnowledgeTools, resolveWorktreeDir,
} from '../lib/detect.mjs';

test('KNOWLEDGE_TOOL_DETECTORS covers the five required tools', () => {
  const ids = KNOWLEDGE_TOOL_DETECTORS.map((t) => t.id);
  assert.deepEqual(ids, ['understand-anything', 'codegraph', 'graphify', 'codemap', 'lightrag']);
});

test('detects a Claude Code plugin via installed_plugins.json key', () => {
  const readJson = (p) => (p.endsWith('installed_plugins.json')
    ? { version: 2, plugins: { 'understand-anything@understand-anything': [{ version: '2.9.4' }] } }
    : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  assert.deepEqual(tools, [
    { id: 'understand-anything', kind: 'plugin', evidence: 'understand-anything@understand-anything' },
  ]);
});

test('detects an MCP server from project .mcp.json and user .claude.json', () => {
  const readJson = (p) => {
    if (p.endsWith('/repo/.mcp.json')) return { mcpServers: { CodeGraph: {} } };
    if (p.endsWith('/home/u/.claude.json')) return { mcpServers: { 'lightrag-server': {} } };
    return null;
  };
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  assert.deepEqual(tools, [
    { id: 'codegraph', kind: 'mcp', evidence: '.mcp.json:CodeGraph' },
    { id: 'lightrag', kind: 'mcp', evidence: '~/.claude.json:lightrag-server' },
  ]);
});

test('detects a CLI binary via command -v', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null,
    commandV: (bin) => bin === 'graphify', exists: () => false,
  });
  assert.deepEqual(tools, [{ id: 'graphify', kind: 'cli', evidence: 'graphify' }]);
});

test('detects a project config directory', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false,
    exists: (p) => p === '/repo/.codemap',
  });
  assert.deepEqual(tools, [{ id: 'codemap', kind: 'project-dir', evidence: '.codemap' }]);
});

test('plugin wins over cli for the same tool (precedence), and no hits returns []', () => {
  const readJson = (p) => (p.endsWith('installed_plugins.json')
    ? { version: 2, plugins: { 'codegraph@foo': [{}] } } : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => true, exists: () => true,
  });
  assert.deepEqual(tools, [{ id: 'codegraph', kind: 'plugin', evidence: 'codegraph@foo' }]);
  const none = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false, exists: () => false,
  });
  assert.deepEqual(none, []);
});

test('resolveWorktreeDir three states', () => {
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '.wt' }), { dir: '.wt', source: 'config' });
  assert.deepEqual(resolveWorktreeDir({}), { dir: '.claude/worktrees', source: 'default' });
  assert.deepEqual(resolveWorktreeDir(null), { dir: '.claude/worktrees', source: 'default' });
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '  ' }), { dir: '.claude/worktrees', source: 'default' });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: FAIL( Cannot find module '../lib/detect.mjs')

- [ ] **Step 3: 实现** — 新建 `plugins/speccode/lib/detect.mjs`:

```js
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Knowledge-base tool detection for /speccode:init. Every environment access
// (fs read, command -v, homeDir) is injectable via opts so unit tests never
// touch the real machine.
export const KNOWLEDGE_TOOL_DETECTORS = [
  { id: 'understand-anything', match: 'understand-anything', bin: 'understand', dir: '.understand' },
  { id: 'codegraph', match: 'codegraph', bin: 'codegraph', dir: '.codegraph' },
  { id: 'graphify', match: 'graphify', bin: 'graphify', dir: '.graphify' },
  { id: 'codemap', match: 'codemap', bin: 'codemap', dir: '.codemap' },
  { id: 'lightrag', match: 'lightrag', bin: 'lightrag', dir: '.lightrag' },
];

function defaultReadJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

export function detectKnowledgeTools(cwd, opts = {}) {
  const homeDir = opts.homeDir ?? homedir();
  const readJson = opts.readJson ?? defaultReadJson;
  const commandV = opts.commandV
    ?? ((bin) => spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).status === 0);
  const exists = opts.exists ?? ((p) => existsSync(p));

  const pluginsJson = readJson(join(homeDir, '.claude', 'plugins', 'installed_plugins.json'));
  const pluginKeys = Object.keys(pluginsJson?.plugins ?? {});
  const projectMcp = readJson(join(cwd, '.mcp.json'));
  const userMcp = readJson(join(homeDir, '.claude.json'));
  const mcpKeys = [
    ...Object.keys(projectMcp?.mcpServers ?? {}).map((k) => `.mcp.json:${k}`),
    ...Object.keys(userMcp?.mcpServers ?? {}).map((k) => `~/.claude.json:${k}`),
  ];

  const found = [];
  for (const t of KNOWLEDGE_TOOL_DETECTORS) {
    const needle = t.match.toLowerCase();
    const pluginHit = pluginKeys.find((k) => k.toLowerCase().includes(needle));
    if (pluginHit) { found.push({ id: t.id, kind: 'plugin', evidence: pluginHit }); continue; }
    const mcpHit = mcpKeys.find((k) => k.toLowerCase().includes(needle));
    if (mcpHit) { found.push({ id: t.id, kind: 'mcp', evidence: mcpHit }); continue; }
    if (commandV(t.bin)) { found.push({ id: t.id, kind: 'cli', evidence: t.bin }); continue; }
    if (exists(join(cwd, t.dir))) found.push({ id: t.id, kind: 'project-dir', evidence: t.dir });
  }
  return found;
}

export function resolveWorktreeDir(config) {
  const dir = config && typeof config.worktree_dir === 'string' ? config.worktree_dir.trim() : '';
  if (dir) return { dir, source: 'config' };
  return { dir: '.claude/worktrees', source: 'default' };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: PASS(7 个测试)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/lib/detect.mjs plugins/speccode/tests/detect.test.mjs
git commit -m "feat(detect): knowledge-tool detectors and resolveWorktreeDir with full DI"
```

### Task 2: bin 新增 detect-knowledge-tools / resolve-worktree-dir verb

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`
- Test: `plugins/speccode/tests/cli.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `detectKnowledgeTools(cwd)` / `resolveWorktreeDir(config)`。
- Produces: verb `detect-knowledge-tools --cwd .` → `{ok:true, tools:[...]}`;verb `resolve-worktree-dir --cwd .` → `{ok:true, dir, source}`。init.md(Task 3)与 creating-worktree.md(Task 4)的 prose 依赖。

- [ ] **Step 1: 写失败测试** — 追加到 `plugins/speccode/tests/cli.test.mjs`:

```js
test('detect-knowledge-tools returns a tools array', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'detect-knowledge-tools', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.ok(Array.isArray(json.tools));
  for (const t of json.tools) {
    assert.ok(t.id && t.kind && t.evidence);
    assert.ok(['plugin', 'mcp', 'cli', 'project-dir'].includes(t.kind));
  }
  rmSync(repo, { recursive: true, force: true });
});

test('resolve-worktree-dir returns default when config lacks the key', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'resolve-worktree-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual({ dir: json.dir, source: json.source },
    { dir: '.claude/worktrees', source: 'default' });
  rmSync(repo, { recursive: true, force: true });
});

test('resolve-worktree-dir returns config value when present', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 2, worktree_dir: '.wt' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  const { code, json } = runCli(repo, 'resolve-worktree-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual({ dir: json.dir, source: json.source }, { dir: '.wt', source: 'config' });
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test --test-name-pattern="detect-knowledge-tools|resolve-worktree-dir" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL(`unknown verb: detect-knowledge-tools`)

- [ ] **Step 3: 实现** — `plugins/speccode/bin/speccode.mjs`:

(a) import 行加:

```js
import { detectKnowledgeTools, resolveWorktreeDir } from '../lib/detect.mjs';
```

(b) VERBS 中 `feature-progress` 之后加:

```js
  'detect-knowledge-tools': ({ cwd }) => ({ ok: true, tools: detectKnowledgeTools(cwd) }),

  'resolve-worktree-dir': ({ cwd }) => {
    const cfg = loadConfig(speccodeDirOf(cwd));
    return { ok: true, ...resolveWorktreeDir(cfg) };
  },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS(全部;71 个测试)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(cli): add detect-knowledge-tools and resolve-worktree-dir verbs"
```

### Task 3: init.md 重写(config v2)

**Files:**
- Modify: `plugins/speccode/commands/init.md`(整文件重写)

**Interfaces:**
- Consumes: Task 2 的两个 verb、`detect-remote`、`backup-config`、`write-config --json-stdin`。Produces: config v2 字段集(见 Global Constraints 逐字清单);幂等 diff 语义(v1→v2 混合态规则:拒绝全部修改则整体保持 v1)。

- [ ] **Step 1: 整文件替换为以下内容**:

````markdown
---
name: "SpecCode: Init"
description: "初始化/更新 speccode 开发环境:探测远端、主干、知识库工具,配置 worktree 目录与 hooks,写 .speccode/config.json(config v2)"
category: Workflow
tags: [speccode, workflow, init]
---

初始化或更新 speccode 配置。全程用中文与用户交互。

## 前置

运行 `speccode.mjs resolve-speccode-dir --cwd .` 获取 `speccodeDir`。
运行 `speccode.mjs read-config --cwd .` 判断是否已初始化:
- `config` 为 null → 全新 init(走"全新流程")
- `config` 非 null → 二次 init(走"幂等流程")

## 全新流程

1. **探测远端与 pr_tool**:运行 `speccode.mjs detect-remote --cwd .`,得到 `prToolGuess` 与 `installed`。
   - 若 `installed=false` 且 `prToolGuess≠none`:告知用户"探测到应使用 <tool>,但未检测到该 CLI",询问是否降级为 `none`。
   - 用 AskUserQuestion 确认最终 `pr_tool`(gh / glab / none)。
2. **探测主干分支**:运行 `git symbolic-ref refs/remotes/origin/HEAD`(失败则回退询问);默认填 `trunk`,请用户确认。
3. **确认 worktree_prefix**:默认 `worktree-`,请用户确认(一般直接采用默认)。
4. **询问 worktree_dir**:worktree 存放的基础目录,默认 `.claude/worktrees`,请用户确认或自定义(相对项目根的路径)。
5. **探测知识库工具**:运行 `speccode.mjs detect-knowledge-tools --cwd .`。
   - 对返回的每个 `{id, kind, evidence}`,用 AskUserQuestion 逐项展示("探测到 <id>(<kind>: <evidence>),是否登记?")并询问是否登记进 `knowledge_tools`。
   - 仅被用户确认的项写入;一个都未确认则写 `"knowledge_tools": []`。
6. **询问 hooks(可选)**:告知用户可在 SDD 各节点挂 shell 命令(如 IM 通知),事件名固定 14 个:onExplored / onFeatureCreated / onWorktreeCreated / onProposed / onBrainstormed / onPlanned / onTaskCompleted / onCodeReviewRequested / onCodeReviewCompleted / onWorktreeFinished / onFeatureFinished / onPrOpened / onSynced / onArchived。
   - 用户选择配置 → 逐项询问「事件名 + shell 命令」,组装为 `hooks` 对象。
   - 用户跳过 → **不写入 `hooks` 字段**(缺失即无 hook)。
7. **组装 config v2** 并通过 `echo '<json>' | speccode.mjs write-config --cwd . --json-stdin` 写入:
   - `version: 2`、`initialized_at`(ISO 8601 UTC)、`trunk`、`remote`、`pr_tool`、`worktree_prefix`、`worktree_dir`、`knowledge_tools`;`hooks` 仅在用户配置时存在。
   - **不得**包含 `display` / `spec_tools` / `untracked_permanent`。
8. 打印 config 摘要 + 下一步指引(`/speccode:exploring` 探索需求,或直接 `/speccode:creating-feature`)。

## 幂等流程(二次 init)

1. 备份现有 config(`backup-config` verb → `config.json.bak.<timestamp>`)。
2. 重新走全新流程的探测,得到"新值候选"。
3. 用 `diffFields` 逐字段比较旧/新:
   - 值未变 → 跳过。
   - 值变化 → 用 AskUserQuestion 展示 `[旧值] → [新值]`,询问"保持 / 改用新值 / 清除"。
4. **v1 → v2 迁移**:若旧 config `version` 为 1(或无 version):
   - `display` / `spec_tools` / `untracked_permanent` 三字段标记为「移除」列入 diff;
   - 若用户接受升级(`version: 2`),三字段 MUST 被移除,不存在混合态;
   - 若用户拒绝对 config 的任何修改 → 保持 v1 原样,整体不写入。
5. `state/` 目录 MUST 不动(不读、不改、不删)。
6. 用 `write-config --json-stdin` 写回,打印摘要。

## 约束
- 全程不修改 `.gitignore`,不删除任何本地文件。
- 写 config 一律通过 `write-config --json-stdin` verb(内部原子写),不由 AI 手写文件。
- 探测类结果(知识工具、pr_tool 猜测)一律经用户确认后才落盘——不确定就先询问,不猜测。
````

- [ ] **Step 2: 验证**

Run: `git grep -n "display\|spec_tools\|untracked_permanent" plugins/speccode/commands/init.md`
Expected: 仅幂等流程「v1 → v2 迁移」段的移除说明三处命中,全新流程与 config 组装段零命中

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/init.md
git commit -m "feat(commands): rewrite init for config v2 with knowledge-tool detection and hooks"
```

### Task 4: creating-worktree.md 增强(worktree_dir + setup + 基线 + 引导)

**Files:**
- Modify: `plugins/speccode/commands/creating-worktree.md`(「创建」段整体替换,并增两段)

**Interfaces:**
- Consumes: `resolve-worktree-dir`(Task 2)、`write-config --json-stdin`、既有 `reconcile --advance-pr` / `write-state`。Produces: spec「creating-worktree 项目 setup 与基线测试」「creating-worktree 后续引导」的行为契约;worktree_dir 缺失时的重问写回。

- [ ] **Step 1: 替换「创建」段并新增两段** — 将文件中「## 创建」整段替换为以下内容(前置与「决定 worktree 名」两段保持不变):

````markdown
## 创建

1. **解析 worktree 目录**:运行 `speccode.mjs resolve-worktree-dir --cwd .`。
   - `source="config"` → 用返回的 `dir`。
   - `source="default"`(config 缺少 worktree_dir 键,含被用户手动删除)→ 用 AskUserQuestion 询问 worktree 存放目录(默认 `.claude/worktrees`),然后经 `write-config --json-stdin` 把 `worktree_dir` 写回 config(读当前 config → 加字段 → 整体写回),再继续。
2. **gitignore 校验(warn-only)**:`git check-ignore -q <dir>`。
   - 未被忽略(退出码非 0,即该目录会被 git 跟踪)→ 警告"worktree 目录 <dir> 未被 .gitignore 忽略,worktree 元数据可能进入 git;建议先加入 .gitignore",询问用户是否继续。
   - 已被忽略 → 静默继续。
3. `git worktree add <dir>/<branch> -b <branch> <feature>`。
4. **项目 setup**:在 `<dir>/<branch>` 下按标记文件执行(存在多个时按序执行,均不存在则跳过并说明):
   - `package.json` → `npm install`
   - `Cargo.toml` → `cargo build`
   - `requirements.txt` → `pip install -r requirements.txt`
   - `pyproject.toml` → `poetry install`
   - `go.mod` → `go mod download`
5. **基线测试**:在新 worktree 内运行项目测试命令(同 finishing-worktree 的探测:`package.json`→`npm test`、`Cargo.toml`→`cargo test`、`requirements.txt`/`pyproject.toml`→`pytest`、`go.mod`→`go test ./...`;均无 → 询问用户测试命令或明确跳过)。
   - 失败 → 展示失败摘要,询问「继续开发还是先行调查」,不擅自继续。
6. 更新 state:读当前 state(由 reconcile 返回或 read),把 `worktrees[<branch>] = { status: "in_progress" }` 后用 `write-state --branch <feature> --json-stdin` 原子写回。
7. 打印:worktree 已创建于 `<dir>/<branch>`,请 `cd` 过去开发。

## 完成后引导

- 手动模式:用 AskUserQuestion 询问是否执行 `/speccode:proposing` 把 exploring 结论落地为文档。
- **auto 模式**(当前会话处于 Claude Code 自动接受/bypass、Codex auto 等自主执行模式):自动衔接执行 `/speccode:proposing`。判断依据不充分时 MUST 默认询问而非自动衔接。
- 用户暂不落地文档 → 提示:开发完成后执行 `/speccode:finishing-worktree`。
````

- [ ] **Step 2: 验证**

Run: `git grep -n "claude/worktrees" plugins/speccode/commands/creating-worktree.md`
Expected: 仅出现在「默认值」与「source=default 询问」语境,不再有「固定 `.claude/worktrees/<branch>`」的硬编码创建语句
Run: `git grep -n "resolve-worktree-dir\|check-ignore\|基线" plugins/speccode/commands/creating-worktree.md`
Expected: 三段增强各有命中

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/creating-worktree.md
git commit -m "feat(commands): creating-worktree gains worktree_dir config, setup, baseline tests, proposing handoff"
```

### Task 5: reset.md 更新(v2 字段 + memory/sdd 清理 + 来源限定)

**Files:**
- Modify: `plugins/speccode/commands/reset.md`(「逐字段询问清理」「执行」两段替换)

**Interfaces:**
- Consumes: `resolve-worktree-dir`、`backup-config`、`write-config --json-stdin`。Produces: spec「worktree 清理来源限定」的 reset 侧;session-memory「reset 按目录粒度清理」。

- [ ] **Step 1: 替换两段** — 「## 逐字段询问清理」与「## 执行」整段替换为:

````markdown
## 逐字段询问清理

用 AskUserQuestion 逐个询问是否清理(是则清空该字段,否则保留):
- `trunk` / `remote` / `pr_tool` / `worktree_prefix` / `worktree_dir` / `knowledge_tools` / `hooks`(若存在)。
- 提示:清空 `trunk` 后 `/speccode:creating-feature` 将无法执行,需重编辑 config 或重新 init。
- 若 config 仍含 v1 遗留字段(`display` / `spec_tools` / `untracked_permanent`)→ 一并询问是否移除(建议移除,config v2 已不再使用)。

## 执行

1. 备份:运行 `speccode.mjs backup-config --cwd .`(config.json.bak.<timestamp>)。
2. 清理 worktree:`git worktree list --porcelain` 中,仅处理满足「分支名带 `worktree_prefix` 且(路径位于 `resolve-worktree-dir` 解析目录之下或曾在 state 中登记)」的 worktree → 逐个 `git worktree remove <path> --force` + `git branch -D <branch>`;其余(宿主环境自建)原样保留并说明。
3. 询问是否整体清理 `.speccode/memory/` 与 `.speccode/sdd/` 两个目录(按目录整体粒度,不提供按 feature 挑选;用户确认才 `rm -rf`)。
4. `rm -rf .speccode/state/`。
5. 用 `write-config --json-stdin` 写回 config(仅保留用户确认保留的字段)。
6. 打印:reset 完成,保留字段列表;可 `/speccode:init` 重建或直接 `/speccode:exploring`。
````

注意:reset 的前置不变——**任何 state 文件存在即拒绝执行**(memory/ 目录清理的前提同样是无 active feature)。

- [ ] **Step 2: 验证**

Run: `git grep -n "display\|spec_tools\|untracked_permanent\|speccode:start\|speccode:finish\b" plugins/speccode/commands/reset.md`
Expected: 仅「v1 遗留字段移除询问」一处命中(语境为移除建议)

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/reset.md
git commit -m "feat(commands): reset covers config v2 fields and memory/sdd cleanup with provenance guard"
```

### Task 6: finishing-worktree.md 清理段 push 行补 `-C`(P1 终审 park 项)

**Files:**
- Modify: `plugins/speccode/commands/finishing-worktree.md`(清理段一行)

**Interfaces:**
- Consumes/Produces: 无(P1 终审 re-review 的 parked finding:清理段提供「`cd <主仓根>` 或全程 `git -C <主仓根>`」两种执行方式,但删远端行仍是裸 `git push origin :<worktree>`,与「不切换 cwd」方式自相矛盾——worktree remove 后 cwd 已不存在,裸 push 会 getcwd 失败)。

- [ ] **Step 1: 编辑** — 清理段中 `git push origin :<worktree>` 改为 `git -C <主仓根> push origin :<worktree>`(与前后行的 `-C` 形态一致)。

- [ ] **Step 2: 验证**

Run: `git grep -n "git push origin :" plugins/speccode/commands/finishing-worktree.md`
Expected: 零命中(全部 push 均为 `git -C` 形态)

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/finishing-worktree.md
git commit -m "fix(commands): finishing-worktree remote-delete uses git -C like sibling steps"
```

### Task 7: P2 验收

**Files:**
- Modify: `openspec/changes/speccode-v2-sdd-flow/tasks.md`(勾选 P2)

- [ ] **Step 1: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(预期 78 个:P1 的 68 + detect.test.mjs 7 + cli.test.mjs 3;以实际为准但 MUST 全绿)

- [ ] **Step 2: 回归断言**

```bash
git grep -n "display\|spec_tools\|untracked_permanent" plugins/speccode/commands/init.md plugins/speccode/commands/creating-worktree.md plugins/speccode/commands/reset.md
# 期望:仅 init.md 幂等迁移段与 reset.md 移除建议段的「移除」语境命中
node plugins/speccode/bin/speccode.mjs resolve-worktree-dir --cwd .   # 期望 {ok:true, dir:..., source:...}
node plugins/speccode/bin/speccode.mjs detect-knowledge-tools --cwd . # 期望 {ok:true, tools:[...]}
```

- [ ] **Step 3: 勾选 tasks.md P2**

把 `openspec/changes/speccode-v2-sdd-flow/tasks.md` 的 2.1–2.8 勾为 `- [x]`;其中 **2.3(删 DEFAULT_UNTRACKED)在 P1 已完成**,勾选并在行尾注「(P1 Task 4 已完成)」;2.2 行内的 `source:'config'|'default'|'missing'` 已随 spec 修订为两态,勾选时把行内表述改为 `'config'|'default'`。

- [ ] **Step 4: Commit**

```bash
git add openspec/changes/speccode-v2-sdd-flow/tasks.md
git commit -m "docs(openspec): check off P2 tasks of speccode-v2-sdd-flow"
```

---

## Self-Review 记录

- **Spec 覆盖**:knowledge-tool-integration 5 条 → Task 1/2(探测启发式、verb、依赖注入)+ Task 3(knowledge_tools 字段、逐项确认、幂等 diff)+ Task 4(worktree_dir 解析/重问、check-ignore);「config.json 字段集」v2 → Task 3;「creating-worktree 项目 setup 与基线测试」「后续引导」→ Task 4;「worktree 清理来源限定」reset 侧 + session-memory「reset 按目录粒度」→ Task 5;tasks.md 2.1-2.8 全覆盖(2.3 标注 P1 已完成);P1 park 项 → Task 6。
- **Placeholder 扫描**:无 TBD/TODO;detect.mjs 与全部测试为完整代码;三个命令文件的成稿段落完整给出(保持不变的段落明确标注「保持不变」)。
- **类型一致性**:`detectKnowledgeTools` 返回 `{id,kind,evidence}[]` 与 spec scenario、Task 2 cli 断言一致;`resolveWorktreeDir` 两态 `{dir, source}` 与 Task 2/4 一致;`kind` 四值 `'plugin','mcp','cli','project-dir'` 在 detect 测试、cli 断言、init prose 三处一致。
- **既有测试兼容**:P1 的 68 个测试不动;新增 detect.test.mjs(7)+ cli.test.mjs(+3),预期 78——以实际为准,MUST 全绿。两处数字以本行与 Task 7 Step 1 为准。
