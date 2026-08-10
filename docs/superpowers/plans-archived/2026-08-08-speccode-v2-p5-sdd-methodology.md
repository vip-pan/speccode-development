# speccode v2 · P5 执行方法论命令 + SDD 引擎 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 SDD 引擎(`lib/sdd.mjs` + 3 verb:工作区/task 抽取/审查包,node 重实现 superpowers 三个 bash 脚本)与 8 个执行方法论命令(SDD、executing-plans、dispatching-parallel-agents、TDD、systematic-debugging、两个 code-review、verification-before-completion),并移植 10 个 references 伴侣文件。

**Architecture:** 对应 OpenSpec change `speccode-v2-sdd-flow` 的 P5 阶段。移植源:`/Users/game-netease/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills/`。**hooks(onTaskCompleted/onCodeReviewRequested/onCodeReviewCompleted)与 memory 接线不在本阶段**(P6/P7 统一),命令文件不得引用 run-hook/read-memory/write-memory。引擎不变量:sdd 工作区用 `git rev-parse --show-toplevel`(当前 worktree 根,**有意**区别于 state/config 的主仓定位,见 design D7)。

**Tech Stack:** Node ≥ 24,纯 ESM,零依赖,node:test,tmprepo 真实临时仓。

## Global Constraints

- 测试命令 MUST 用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`。
- `lib/sdd.mjs` 三个脚本逻辑为 superpowers bash 的 node 移植:task-brief 的 awk fence 感知语义(`Task 1` MUST NOT 误配 `Task 10`;fence 内标题忽略;fence 行保留在任务体内)、sdd-workspace 的 slug 派生校验、review-package 的 rev 校验 + range 命名。**不**写 `.gitignore`(`.speccode/` 整体 untracked 是 speccode 既有约定,与 superpowers 不同——见 design D7)。
- 命令 prose 全程中文;frontmatter 恰好四字段;**tuned prose 保真**(Iron Law、Red Flags、Common Rationalizations、fix loop 5 轮熔断、Model Selection 等表格/清单的结构语义不弱化)。
- 交叉引用统一 `/speccode:X` 形式;references 引用用 `${CLAUDE_PLUGIN_ROOT}/references/<file>`;MUST NOT 残留 `superpowers:` 或 `.superpowers/` 引用。
- 本阶段命令 MUST NOT 引用 run-hook/read-memory/write-memory。
- requesting-code-review 原文 HEAD~1 取 BASE 的示例 MUST 改写为「调用方记录的 BASE」(spec「review-package 禁止相对引用」)。
- 写 verb 契约不变(stdin JSON + --json-stdin);未知 verb → {ok:false} exit 1;sdd 三个 verb 的缺参/坏 rev/找不到任务 MUST 返回 {ok:false}(可经 main catch)。
- 提交信息遵守仓库惯例。

## File Structure

- Create `plugins/speccode/lib/sdd.mjs`、`plugins/speccode/tests/sdd.test.mjs`
- Modify `plugins/speccode/bin/speccode.mjs`、`plugins/speccode/tests/cli.test.mjs`
- Create `plugins/speccode/commands/` 8 个:subagent-driven-development / executing-plans / dispatching-parallel-agents / test-driven-development / systematic-debugging / requesting-code-review / receiving-code-review / verification-before-completion
- Create `plugins/speccode/references/` 10 个伴侣文件(逐字拷贝 + 1 处中性化)
- Modify `openspec/changes/speccode-v2-sdd-flow/tasks.md`(P5 勾选,验收任务内)

---

### Task 1: lib/sdd.mjs(三脚本 node 移植)

**Files:**
- Create: `plugins/speccode/lib/sdd.mjs`
- Test: `plugins/speccode/tests/sdd.test.mjs`

**Interfaces:**
- Produces:
  - `worktreeRoot(cwd) -> string`(`git rev-parse --show-toplevel`,经 lib/git.mjs 的 `git()`)
  - `sddWorkspace(planFile, cwd) -> <worktreeRoot>/.speccode/sdd/<slug>`(mkdir -p;slug = plan basename 去 .md,空/`.`/`..` 抛错;planFile 不存在抛错)
  - `extractTaskBrief(planText, n) -> string | null`(纯函数)
  - `taskBrief(planFile, n, cwd, outFile?) -> outPath`(抽取失败抛错;默认 outFile 在 workspace)
  - `reviewPackage(planFile, base, head, cwd, outFile?) -> outPath`(坏 rev 抛错;默认按 range 命名)
- Consumes: `lib/git.mjs` 的 `git(args, {cwd})`(抛出式)、`lib/atomic.mjs` 不需要(工件非 JSON)。

- [ ] **Step 1: 写失败测试** — 新建 `plugins/speccode/tests/sdd.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';
import {
  worktreeRoot, sddWorkspace, extractTaskBrief, taskBrief, reviewPackage,
} from '../lib/sdd.mjs';

function headSha(repo) {
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
}

const PLAN = [
  '# Plan', '',
  '### Task 1: Alpha', 'body-1', '```js', '// ### Task 99 inside fence', '```', 'more-1', '',
  '### Task 10: Beta', 'body-10', '',
  '### Task 2: Gamma', 'body-2', 'still-2', '',
].join('\n');

test('extractTaskBrief extracts exactly task N (1 ≠ 10), keeps fenced lines', () => {
  const brief = extractTaskBrief(PLAN, 1);
  assert.ok(brief.includes('body-1'));
  assert.ok(brief.includes('### Task 99 inside fence')); // fence 内行保留在任务体
  assert.ok(brief.includes('more-1'));
  assert.ok(!brief.includes('body-10'));
  assert.ok(!brief.includes('body-2'));
});

test('extractTaskBrief matches multi-digit tasks and misses fenced headings', () => {
  const b10 = extractTaskBrief(PLAN, 10);
  assert.ok(b10.includes('body-10'));
  assert.ok(!b10.includes('body-1'));
  assert.equal(extractTaskBrief(PLAN, 99), null); // 只在 fence 内出现 → 不匹配
  assert.equal(extractTaskBrief(PLAN, 7), null);
});

test('sddWorkspace derives slug dir under worktree root and rejects bad input', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, '# x');
  const dir = sddWorkspace(plan, repo);
  assert.equal(dir, join(worktreeRoot(repo), '.speccode', 'sdd', 'plan'));
  assert.ok(existsSync(dir));
  assert.throws(() => sddWorkspace(join(repo, 'nope.md'), repo));
  rmSync(repo, { recursive: true, force: true });
});

test('taskBrief writes the brief into the workspace by default', () => {
  const repo = makeRepo();
  const plan = join(repo, 'my-plan.md');
  writeFileSync(plan, PLAN);
  const out = taskBrief(plan, 2, repo);
  assert.equal(out, join(worktreeRoot(repo), '.speccode', 'sdd', 'my-plan', 'task-2-brief.md'));
  assert.ok(readFileSync(out, 'utf8').includes('body-2'));
  assert.throws(() => taskBrief(plan, 5, repo));
  rmSync(repo, { recursive: true, force: true });
});

test('reviewPackage writes commits + stat + -U10 diff named by range', () => {
  const repo = makeRepo();
  commitFile(repo, 'a.txt', 'a', 'c1');
  const base = headSha(repo);
  commitFile(repo, 'b.txt', 'b', 'c2');
  const head = headSha(repo);
  const plan = join(repo, 'p.md');
  writeFileSync(plan, PLAN);
  const out = reviewPackage(plan, base, head, repo);
  const short = (s) => s.slice(0, 7);
  assert.ok(out.includes(`review-${short(base)}..${short(head)}.diff`));
  const content = readFileSync(out, 'utf8');
  assert.ok(content.includes('## Commits'));
  assert.ok(content.includes('## Diff'));
  assert.ok(content.includes('b.txt'));
  assert.throws(() => reviewPackage(plan, 'deadbeef', head, repo));
  rmSync(repo, { recursive: true, force: true });
});
```

注意:`commitFile()` 不返回 commit hash(已核实 `tests/helpers/tmprepo.mjs`),测试用上面的 `headSha()` 辅助函数取 hash。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test plugins/speccode/tests/sdd.test.mjs`
Expected: FAIL(Cannot find module '../lib/sdd.mjs')

- [ ] **Step 3: 实现** — 新建 `plugins/speccode/lib/sdd.mjs`:

```js
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { git } from './git.mjs';

// SDD execution artifacts (task briefs, reports, review packages, ledgers).
// Workspace root = CURRENT worktree root (`--show-toplevel`), deliberately NOT
// the main-repo root used for state/config: artifacts belong to the execution
// environment and are cleaned up by `git worktree remove`. See design D7.
export function worktreeRoot(cwd) {
  return git(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim();
}

export function sddWorkspace(planFile, cwd) {
  if (!existsSync(planFile)) throw new Error(`no such plan file: ${planFile}`);
  const slug = basename(planFile, '.md');
  if (!slug || slug === '.' || slug === '..') {
    throw new Error(`cannot derive a workspace name from: ${planFile}`);
  }
  const dir = join(worktreeRoot(cwd), '.speccode', 'sdd', slug);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Port of the superpowers task-brief awk: fence lines toggle state; task
// headings only count outside fences; "Task N" must be followed by a non-digit
// or EOL so Task 1 never matches Task 10. Fence lines inside a task are kept.
export function extractTaskBrief(planText, n) {
  const lines = String(planText).split('\n');
  let inFence = false;
  let inTask = false;
  const out = [];
  const heading = /^#+[ \t]+Task[ \t]+(\d+)/;
  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence;
      if (inTask) out.push(line);
      continue;
    }
    if (!inFence) {
      const m = line.match(heading);
      if (m) inTask = Number(m[1]) === n;
    }
    if (inTask) out.push(line);
  }
  return out.length ? out.join('\n') : null;
}

export function taskBrief(planFile, n, cwd, outFile) {
  const brief = extractTaskBrief(readFileSync(planFile, 'utf8'), n);
  if (brief === null) throw new Error(`task ${n} not found in ${planFile}`);
  const out = outFile ?? join(sddWorkspace(planFile, cwd), `task-${n}-brief.md`);
  writeFileSync(out, brief + '\n');
  return out;
}

export function reviewPackage(planFile, base, head, cwd, outFile) {
  if (!existsSync(planFile)) throw new Error(`no such plan file: ${planFile}`);
  git(['rev-parse', '--verify', '--quiet', base], { cwd });
  git(['rev-parse', '--verify', '--quiet', head], { cwd });
  const short = (r) => git(['rev-parse', '--short', r], { cwd }).stdout.trim();
  const range = `${base}..${head}`;
  const commits = git(['log', '--oneline', range], { cwd }).stdout;
  const stat = git(['diff', '--stat', range], { cwd }).stdout;
  const diff = git(['diff', '-U10', range], { cwd }).stdout;
  const out = outFile
    ?? join(sddWorkspace(planFile, cwd), `review-${short(base)}..${short(head)}.diff`);
  const body = `# Review package: ${range}\n\n## Commits\n${commits}\n## Files changed\n${stat}\n## Diff\n${diff}`;
  writeFileSync(out, body);
  return out;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test plugins/speccode/tests/sdd.test.mjs`
Expected: PASS(5 个测试)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/lib/sdd.mjs plugins/speccode/tests/sdd.test.mjs
git commit -m "feat(sdd): port sdd-workspace/task-brief/review-package to lib with tests"
```

### Task 2: bin 新增 sdd-workspace / task-brief / review-package verb

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`
- Test: `plugins/speccode/tests/cli.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `sddWorkspace` / `taskBrief` / `reviewPackage`。
- Produces: 三个 verb;SDD 命令(Task 3)的 prose 依赖其输出形态。

- [ ] **Step 1: 写失败测试** — 追加到 `plugins/speccode/tests/cli.test.mjs`:

```js
test('sdd-workspace requires --plan', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'sdd-workspace', '--cwd', repo);
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('task-brief extracts a task into the workspace', () => {
  const repo = makeRepo();
  const plan = join(repo, 'p.md');
  writeFileSync(plan, '### Task 1: A\nbody-1\n\n### Task 10: B\nbody-10\n');
  const { code, json } = runCli(repo, 'task-brief', '--cwd', repo, '--plan', plan, '--task', '1');
  assert.equal(code, 0);
  assert.ok(json.ok);
  const content = readFileSync(json.path, 'utf8');
  assert.ok(content.includes('body-1'));
  assert.ok(!content.includes('body-10'));
  rmSync(repo, { recursive: true, force: true });
});

test('review-package writes a range-named diff file', () => {
  const repo = makeRepo();
  const plan = join(repo, 'p.md');
  writeFileSync(plan, '# p');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  spawnSync('git', ['checkout', '-b', 'side'], { cwd: repo });
  writeFileSync(join(repo, 'x.txt'), 'x');
  spawnSync('git', ['add', '.'], { cwd: repo });
  spawnSync('git', ['commit', '-m', 'x'], { cwd: repo });
  const tip = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  const { code, json } = runCli(repo, 'review-package', '--cwd', repo,
    '--plan', plan, '--base', head, '--head', tip);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.ok(json.path.includes('review-'));
  assert.ok(readFileSync(json.path, 'utf8').includes('x.txt'));
  rmSync(repo, { recursive: true, force: true });
});

test('sdd-workspace inside a linked worktree resolves to the worktree root', () => {
  const repo = realpathSync(makeRepo());
  const wtPath = join(repo, '.claude', 'worktrees', 'wt-sdd');
  mkdirSync(join(repo, '.claude', 'worktrees'), { recursive: true });
  const add = spawnSync('git', ['worktree', 'add', wtPath, '-b', 'worktree-sdd', 'HEAD'],
    { cwd: repo, encoding: 'utf8' });
  assert.equal(add.status, 0, add.stderr);
  const plan = join(wtPath, 'p.md');
  writeFileSync(plan, '# p');
  const { code, json } = runCli(wtPath, 'sdd-workspace', '--cwd', wtPath, '--plan', plan);
  assert.equal(code, 0);
  // realpath 归一:macOS 上 tmpdir 是 /var→/private/var 符号链接
  assert.equal(realpathSync(json.dir), join(realpathSync(wtPath), '.speccode', 'sdd', 'p'));
  spawnSync('git', ['worktree', 'remove', wtPath, '--force'], { cwd: repo, encoding: 'utf8' });
  rmSync(repo, { recursive: true, force: true });
});
```

(`readFileSync`/`writeFileSync`/`mkdirSync`/`realpathSync`/`join` 在 cli.test.mjs 头部已有或需补进 import 行——按现有 import 补齐。)

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test --test-name-pattern="sdd-workspace|task-brief|review-package" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL(unknown verb)

- [ ] **Step 3: 实现** — `plugins/speccode/bin/speccode.mjs`:

(a) import 行加:

```js
import { sddWorkspace, taskBrief, reviewPackage } from '../lib/sdd.mjs';
```

(b) VERBS 中 `resolve-worktree-dir` 之后加:

```js
  'sdd-workspace': ({ cwd, plan }) => {
    if (!plan) return { ok: false, error: 'sdd-workspace requires --plan <path>' };
    return { ok: true, dir: sddWorkspace(plan, cwd) };
  },

  'task-brief': ({ cwd, plan, task, out }) => {
    if (!plan || !task) return { ok: false, error: 'task-brief requires --plan <path> --task <N>' };
    const path = taskBrief(plan, Number(task), cwd, out === true ? undefined : out);
    return { ok: true, path };
  },

  'review-package': ({ cwd, plan, base, head, out }) => {
    if (!plan || !base || !head) {
      return { ok: false, error: 'review-package requires --plan <path> --base <sha> --head <sha>' };
    }
    const path = reviewPackage(plan, base, head, cwd, out === true ? undefined : out);
    return { ok: true, path };
  },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(82 + 5 sdd + 4 cli = 91,以实际为准)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(cli): add sdd-workspace, task-brief, review-package verbs"
```

### Task 3: subagent-driven-development.md(SD 全量移植)

**Files:**
- Create: `plugins/speccode/commands/subagent-driven-development.md`

**Interfaces:**
- Consumes: Task 2 的三个 verb、`${CLAUDE_PLUGIN_ROOT}/references/{implementer-prompt,task-reviewer-prompt,re-review-prompt,code-reviewer}.md`(Task 6 落地,计划内前向引用)。Produces: spec 锚点「SDD 工作区」「SDD 工件生成 verb」「命令衔接链」(SDD→requesting-code-review、Finish→finishing-worktree)。

- [ ] **Step 1: 写新文件** — 源文件 `/Users/game-netease/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills/subagent-driven-development/SKILL.md`(503 行)**全量中文化近逐字移植**为 `plugins/speccode/commands/subagent-driven-development.md`,frontmatter 替换为四字段(name `SpecCode: Subagent Driven Development`、description「为每个任务派发全新子代理实现 + 双重审查 + 整支终审;ledger 恢复;工作区 .speccode/sdd/<plan>/」、category Workflow、tags [speccode, workflow, sdd, subagent])。**逐字保留**:Why subagents、Core principle、Narration cap、Continuous execution、The Process 的 dot 图、Model Selection 全节、Common Rationalizations 全表、Example Workflow。**适配点(逐项执行,不得遗漏)**:

1. Setup 节:worktree 保障改为「已在 speccode worktree 中(`/speccode:creating-worktree` 创建);MUST NOT 在 main/master 上开始实现(未经用户明确同意)」;`scripts/sdd-workspace PLAN_FILE` → `speccode.mjs sdd-workspace --cwd . --plan <PLAN_FILE>`(输出 JSON 取 `dir`);`.superpowers/sdd/<plan-basename>/` → `.speccode/sdd/<plan-basename>/`(全部出现处);ledger 首行格式与「另一个 plan 的目录永远不是你的」等规则保留;删「self-ignoring .gitignore」相关说明(speccode 的 `.speccode/` 本就 untracked)。
2. Task Loop 节:`scripts/task-brief PLAN_FILE N` → `speccode.mjs task-brief --cwd . --plan <PLAN_FILE> --task <N>`(输出 JSON 取 `path`);`scripts/review-package PLAN_FILE BASE HEAD` → `speccode.mjs review-package --cwd . --plan <PLAN_FILE> --base <BASE> --head <HEAD>`;「never HEAD~1」规则保留。
3. 模板引用:`implementer-prompt.md` / `task-reviewer-prompt.md` / `re-review-prompt.md` → `${CLAUDE_PLUGIN_ROOT}/references/<同名文件>`;`../requesting-code-review/code-reviewer.md` → `${CLAUDE_PLUGIN_ROOT}/references/code-reviewer.md`。
4. 交叉引用:所有 `superpowers:using-git-worktrees` / `superpowers:finishing-a-development-branch` / `superpowers:requesting-code-review` → 对应 `/speccode:creating-worktree` / `/speccode:finishing-worktree` / `/speccode:requesting-code-review`。
5. Finish 节:删 workspace 的 `rm -rf` 保留;终态改「调用 `/speccode:finishing-worktree`」。
6. **onTaskCompleted 占位**:本阶段不接线(P6 统一),但 prose 保留一句「每个 task 完成时在 ledger 记完成行」(既有语义),不加任何 verb 调用。

- [ ] **Step 2: 验证**

Run: `git grep -n "superpowers:\|\.superpowers\|run-hook\|read-memory\|write-memory\|scripts/" plugins/speccode/commands/subagent-driven-development.md`
Expected: 零命中
Run: `git grep -c "sdd-workspace\|task-brief\|review-package\|speccode:finishing-worktree\|speccode:requesting-code-review" plugins/speccode/commands/subagent-driven-development.md`
Expected: ≥6

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/subagent-driven-development.md
git commit -m "feat(commands): add subagent-driven-development (full SDD port on engine verbs)"
```

### Task 4: executing-plans.md

**Files:**
- Create: `plugins/speccode/commands/executing-plans.md`

**Interfaces:**
- Consumes: plan 文件(speccode/changes/\<slug\>/plan/)。Produces: spec「命令衔接链」(executing-plans→finishing-worktree)。

- [ ] **Step 1: 写新文件** — 源文件 `.../skills/executing-plans/SKILL.md`(64 行)近逐字移植为 `plugins/speccode/commands/executing-plans.md`,frontmatter 四字段(name `SpecCode: Executing Plans`、description「在当前会话分批执行实现计划,带人工检查点;子代理可用时优先 subagent-driven-development」)。适配点:

1. 「若子代理可用,推荐 subagent-driven-development」→ `/speccode:subagent-driven-development`。
2. isolated workspace 段 → 「确认已在 speccode worktree 中(否则先 `/speccode:creating-worktree`);MUST NOT 在 main/master 上开始(未经用户明确同意)」。
3. 收尾 `finishing-a-development-branch` → `/speccode:finishing-worktree`。
4. 「When to Stop and Ask for Help」「When to Revisit Earlier Steps」等节全保留。

- [ ] **Step 2: 验证**

Run: `git grep -n "superpowers:\|\.superpowers\|run-hook" plugins/speccode/commands/executing-plans.md`
Expected: 零命中

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/executing-plans.md
git commit -m "feat(commands): add executing-plans (inline execution with checkpoints)"
```

### Task 5: 六个行为方法论命令(移植)

**Files:**
- Create: `plugins/speccode/commands/dispatching-parallel-agents.md`
- Create: `plugins/speccode/commands/test-driven-development.md`
- Create: `plugins/speccode/commands/systematic-debugging.md`
- Create: `plugins/speccode/commands/requesting-code-review.md`
- Create: `plugins/speccode/commands/receiving-code-review.md`
- Create: `plugins/speccode/commands/verification-before-completion.md`

**Interfaces:**
- Consumes: `${CLAUDE_PLUGIN_ROOT}/references/` 伴侣文件(Task 6)。Produces: spec「命令衔接链」(debugging→TDD/verification;SDD→requesting-code-review)与方法论行为契约(prose 级)。

- [ ] **Step 1: 六个文件分别近逐字中文化移植**,源与适配点(每个文件通用:frontmatter 四字段,name 形如 `SpecCode: Test Driven Development`;全部 Red Flags/Rationalizations/Iron Law 表逐字保留;MUST NOT 引用 run-hook/read-memory/write-memory):

| 命令 | 源(均在 superpowers/6.2.0/skills/ 下) | 适配点 |
|---|---|---|
| dispatching-parallel-agents | `dispatching-parallel-agents/SKILL.md` (167) | 交叉引用无;决策树 dot 图保留;加「前置:worktree-\* 分支」一节 |
| test-driven-development | `test-driven-development/SKILL.md` (320) | Iron Law/12 行 Rationalizations 全保;`writing-good-tests.md` 引用 → `${CLAUDE_PLUGIN_ROOT}/references/writing-good-tests.md`;`superpowers:systematic-debugging` → `/speccode:systematic-debugging` |
| systematic-debugging | `systematic-debugging/SKILL.md` (283) | 四阶段/3+ 失败问架构全保;`root-cause-tracing.md`、`defense-in-depth.md`、`condition-based-waiting.md` 引用 → `${CLAUDE_PLUGIN_ROOT}/references/<同名>`;`find-polluter.sh` → `${CLAUDE_PLUGIN_ROOT}/references/find-polluter.sh`;`superpowers:test-driven-development` / `superpowers:verification-before-completion` → 对应 `/speccode:` 形式;**不移植** test-pressure-\*/test-academic/CREATION-LOG(eval fixtures) |
| requesting-code-review | `requesting-code-review/SKILL.md` (95) | `code-reviewer.md` → `${CLAUDE_PLUGIN_ROOT}/references/code-reviewer.md`;**HEAD~1 取 BASE 的示例 MUST 改写为「调用方记录的 BASE」**;最终整支审查与 SDD 的关系保留 |
| receiving-code-review | `receiving-code-review/SKILL.md` (205) | 近逐字;Forbidden Responses(禁止感谢话术)、6 步模式全保 |
| verification-before-completion | `verification-before-completion/SKILL.md` (120) | Iron Law/Gate Function/Common Failures 表全保;交叉引用无 |

- [ ] **Step 2: 验证**

Run: `git grep -ln "superpowers:\|\.superpowers\|run-hook\|read-memory\|write-memory" plugins/speccode/commands/`
Expected: 无输出(全命令目录零残留)
Run: `git grep -c "HEAD~1" plugins/speccode/commands/requesting-code-review.md`
Expected: 0(相对引用示例已改写)

- [ ] **Step 3: Commit**(可单 commit 或每文件一个,任选其一并保持一致)

```bash
git add plugins/speccode/commands/
git commit -m "feat(commands): add six methodology commands (TDD, debugging, reviews, verification, parallel agents)"
```

### Task 6: references/ 十个伴侣文件

**Files:**
- Create: `plugins/speccode/references/` 下 10 个文件(见下)

**Interfaces:**
- Consumes: superpowers 源目录。Produces: Task 3/5 命令引用的全部伴侣文件。

- [ ] **Step 1: 逐字拷贝**(源均在 `/Users/game-netease/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills/`):

```bash
SRC="/Users/game-netease/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills"
R=plugins/speccode/references
cp "$SRC/subagent-driven-development/implementer-prompt.md" "$SRC/subagent-driven-development/task-reviewer-prompt.md" "$SRC/subagent-driven-development/re-review-prompt.md" "$R/"
cp "$SRC/requesting-code-review/code-reviewer.md" "$R/"
cp "$SRC/systematic-debugging/root-cause-tracing.md" "$SRC/systematic-debugging/defense-in-depth.md" "$SRC/systematic-debugging/condition-based-waiting.md" "$SRC/systematic-debugging/condition-based-waiting-example.ts" "$R/"
cp "$SRC/test-driven-development/writing-good-tests.md" "$R/"
cp "$SRC/systematic-debugging/find-polluter.sh" "$R/"
chmod +x "$R/find-polluter.sh"
```

- [ ] **Step 2: 一处中性化** — `writing-good-tests.md:51` 的 `(superpowers:writing-skills)` 引用(writing-skills 未移植):该处改为「(技能写作规范)」或直接删除该括号引用。

- [ ] **Step 3: 验证**

```bash
git grep -rn "superpowers:\|\.superpowers" plugins/speccode/references/   # 期望零命中
diff -q "$SRC/requesting-code-review/code-reviewer.md" plugins/speccode/references/code-reviewer.md   # 期望 identical(抽样至少 3 个文件做 diff -q,除 writing-good-tests.md 外都应 identical)
ls plugins/speccode/references/ | wc -l   # 期望 12(10 新 + visual-companion.md + visual-companion-scripts/)
```

- [ ] **Step 4: Commit**

```bash
git add plugins/speccode/references/
git commit -m "feat(references): port SDD prompts, debugging techniques, review template, TDD guide"
```

### Task 7: P5 验收

**Files:**
- Modify: `openspec/changes/speccode-v2-sdd-flow/tasks.md`(勾选 P5)

- [ ] **Step 1: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(91 上下,以实际为准)

- [ ] **Step 2: 结构断言**

```bash
ls plugins/speccode/commands/ | wc -l      # 期望 21
git grep -ln "superpowers:\|\.superpowers" plugins/speccode/   # 期望无输出
node plugins/speccode/bin/speccode.mjs sdd-workspace --cwd . --plan docs/superpowers/plans/2026-08-08-speccode-v2-p5-sdd-methodology.md   # 期望 {ok:true, dir:...}
git grep -c "onTaskCompleted" plugins/speccode/commands/subagent-driven-development.md   # 期望 0(P6 接线)
```

- [ ] **Step 3: 勾选 tasks.md P5**

把 5.1–5.9 勾为 `- [x]`;5.4/5.5 行内「每 task 完成触发 onTaskCompleted」属 P6 接线,在 5.9 行尾注「(hooks/memory 接线在 P6/P7 统一完成)」。

- [ ] **Step 4: Commit**

```bash
git add openspec/changes/speccode-v2-sdd-flow/tasks.md
git commit -m "docs(openspec): check off P5 tasks of speccode-v2-sdd-flow"
```

---

## Self-Review 记录

- **Spec 覆盖**:sdd-document-lifecycle「SDD 工作区」(show-toplevel 定位、plan 隔离)→ T1/T2(linked worktree cli 用例);「SDD 工件生成 verb」(三 verb、Task 1≠10、fence 感知、range 命名)→ T1/T2;「命令衔接链」(SDD→requesting-code-review、debugging→TDD/verification、两执行命令→finishing-worktree)→ T3/T4/T5;tasks.md 5.1-5.9 全覆盖。
- **Placeholder 扫描**:引擎代码与测试完整;命令移植给精确源路径 + 逐项适配点(行为型 prose 的完整成稿由移植+终审保真度核对承接,这是本计划对 6 个行为命令与 SDD 长文采用的形态——逐字成稿嵌入会超过 2000 行,移植保真由 task 评审与终审对照源文件验证)。
- **类型一致性**:`sddWorkspace/taskBrief/reviewPackage` 签名在 T1 lib、T2 verb、T3 命令 prose 三处一致;verb 输出 `{ok,dir}` / `{ok,path}` 与 T3 的「取 dir」「取 path」一致。
- **既有兼容**:82 个既有测试不动;新增 sdd 5 + cli 4。
