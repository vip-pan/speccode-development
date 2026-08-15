# plan-progress-tick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 plan 文档在执行过程中维护自身 checkbox 进度——在每个 task 完成点把该 Task N 下的 `- [ ]` 勾选为 `- [x]`,经引擎 verb 下沉,不改变审查/恢复语义。

**Architecture:** `sdd.mjs` 新增 `tickTask(planFile, n)`,复刻 `extractTaskBrief` 的 fence 状态机定位 Task N 范围,只勾范围内 fence 外的 `- [ ]`,`atomic.writeTextAtomic` 落盘,幂等。CLI 新增 `tick-task` verb。两条执行命令在完成点各加一段 prose 调用 + commit。

**Tech Stack:** 纯 ESM、零第三方依赖(仅 `node:` 内置)、Node ≥ 24。

## Global Constraints

- 零第三方依赖:仅 `node:` 内置模块(本功能不引入新依赖)。
- 确定性逻辑下沉 lib:勾选逻辑在 `sdd.mjs`,命令层只调 verb,绝不内联 `sed`/`awk`。
- 原子写:plan 文件写入走 `atomic.writeTextAtomic`(临时文件 + rename)。
- 复用 `extractTaskBrief` 的 fence 状态机语义:`Task 1` 不误配 `Task 10`;代码块(` ``` ` fence)内的 `- [ ]` 不被勾选。
- ledger(`progress.md`)保持崩溃恢复唯一权威;plan checkbox 仅作完成态派生视图,不参与恢复判断。

---

### Task 1: tickTask 引擎函数 + 单测

**Files:**
- Modify: `plugins/speccode/lib/sdd.mjs`(顶部 import 加 `writeTextAtomic`;新增 `tickTask`)
- Test: `plugins/speccode/tests/sdd.test.mjs`(import 加 `tickTask`;新增 3 个测试 + `TICK_PLAN` 常量)

**Interfaces:**
- Produces: `tickTask(planFile, n)` → `{ ticked: string[], already: string[] }`;副作用:把 plan 中 Task N 范围内 fence 外的 `- [ ]` 改为 `- [x]`(`writeTextAtomic` 落盘)。Task N 不存在时抛 `task <n> not found in <planFile>`。

- [x] **Step 1: 写失败测试**

在 `tests/sdd.test.mjs` 顶部 import 加 `tickTask`(从 `../lib/sdd.mjs`),并在文件末尾追加常量与三个测试:

```js
const TICK_PLAN = [
  '# Plan', '',
  '### Task 1: Alpha', '',
  '- [ ] **Step 1: do A**', '',
  '```js',
  '- [ ] fenced-not-a-checkbox',
  '```', '',
  '- [ ] **Step 2: do B**', '',
  '### Task 2: Beta', '',
  '- [ ] **Step 1: gamma**', '',
].join('\n');

test('tickTask ticks task N checkboxes and skips fenced lines', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, TICK_PLAN);
  const r = tickTask(plan, 1);
  assert.equal(r.ticked.length, 2);
  assert.equal(r.already.length, 0);
  const after = readFileSync(plan, 'utf8');
  assert.ok(after.includes('- [x] **Step 1: do A**'));
  assert.ok(after.includes('- [x] **Step 2: do B**'));
  assert.ok(after.includes('- [ ] fenced-not-a-checkbox')); // fence 内不动
  assert.ok(after.includes('- [ ] **Step 1: gamma**'));     // Task 2 不动
  rmSync(repo, { recursive: true, force: true });
});

test('tickTask is idempotent (already-checked reported, no rewrite noise)', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, TICK_PLAN);
  tickTask(plan, 1);
  const r = tickTask(plan, 1);
  assert.deepEqual(r.ticked, []);
  assert.equal(r.already.length, 2);
  rmSync(repo, { recursive: true, force: true });
});

test('tickTask throws when task N is absent', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, TICK_PLAN);
  assert.throws(() => tickTask(plan, 99), /task 99 not found/);
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="tickTask" plugins/speccode/tests/sdd.test.mjs`
Expected: FAIL —— `tickTask is not a function`(尚未导出/实现)。

- [x] **Step 3: 写最小实现**

在 `plugins/speccode/lib/sdd.mjs` 顶部 import 行加 `writeTextAtomic`:

```js
import { writeTextAtomic } from './atomic.mjs';
```

在 `reviewPackage` 之后追加 `tickTask`:

```js
// Tick all unchecked step checkboxes (- [ ]) under "Task N" to [x], fence-aware:
// reuses extractTaskBrief's state machine — fences toggle, task headings only
// count outside fences, "Task N" is followed by a non-digit/EOL so Task 1 ≠ 10.
// Already-checked lines are reported in `already` (idempotent). Atomic write.
export function tickTask(planFile, n) {
  if (!existsSync(planFile)) throw new Error(`no such plan file: ${planFile}`);
  const lines = readFileSync(planFile, 'utf8').split('\n');
  let inFence = false;
  let inTask = false;
  let found = false;
  const ticked = [];
  const already = [];
  const heading = /^#+[ \t]+Task[ \t]+(\d+)/;
  const unchecked = /^(\s*)- \[ \](.*)$/;
  const checked = /^(\s*)- \[[xX]\](.*)$/;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('```')) { inFence = !inFence; continue; }
    if (!inFence) {
      const m = line.match(heading);
      if (m) { inTask = Number(m[1]) === n; if (inTask) found = true; }
    }
    if (inTask) {
      const u = line.match(unchecked);
      if (u) { lines[i] = `${u[1]}- [x]${u[2]}`; ticked.push(line.trim()); continue; }
      const c = line.match(checked);
      if (c) already.push(line.trim());
    }
  }
  if (!found) throw new Error(`task ${n} not found in ${planFile}`);
  writeTextAtomic(planFile, lines.join('\n'));
  return { ticked, already };
}
```

- [x] **Step 4: 运行确认通过**

Run: `node --test --test-name-pattern="tickTask" plugins/speccode/tests/sdd.test.mjs`
Expected: PASS —— 3 个 tickTask 测试通过,既有测试不回归。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/lib/sdd.mjs plugins/speccode/tests/sdd.test.mjs
git commit -m "feat(sdd): tickTask ticks plan checkboxes fence-aware, idempotent"
```

### Task 2: tick-task CLI verb + 端到端测

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`(顶部 import 加 `tickTask`;VERBS 加 `tick-task`)
- Test: `plugins/speccode/tests/cli.test.mjs`(新增端到端测)

**Interfaces:**
- Consumes: `tickTask(planFile, n)`(Task 1 产出)
- Produces: `tick-task --plan <P> --task <N>` verb,输出 `{ ok, plan, task, ticked, already }`;Task N 不存在时 `{ ok:false, error }` + exit 1。

- [x] **Step 1: 写失败测试**

在 `tests/cli.test.mjs` 末尾追加:

```js
test('tick-task verb ticks plan checkboxes and returns ticked/already', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, [
    '# P', '', '### Task 1: A', '', '- [ ] s1', '', '```js', '- [ ] fenced', '```', '',
    '- [ ] s2', '', '### Task 2: B', '', '- [ ] s3', '',
  ].join('\n'));
  const { code, json } = runCli(repo, 'tick-task', '--cwd', repo, '--plan', plan, '--task', '1');
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.task, 1);
  assert.equal(json.ticked.length, 2);
  const after = readFileSync(plan, 'utf8');
  assert.ok(after.includes('- [x] s1'));
  assert.ok(after.includes('- [ ] fenced'));
  assert.ok(after.includes('- [ ] s3'));
  rmSync(repo, { recursive: true, force: true });
});

test('tick-task verb errors when task N absent', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, '# P\n\n### Task 1: A\n\n- [ ] s1\n');
  const { code, json } = runCli(repo, 'tick-task', '--cwd', repo, '--plan', plan, '--task', '9');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  assert.match(json.error, /task 9 not found/);
  rmSync(repo, { recursive: true, force: true });
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="tick-task verb" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL —— `unknown verb: tick-task`。

- [x] **Step 3: 写最小实现**

`bin/speccode.mjs` 顶部 import 行(第 11 行)改为:

```js
import { sddWorkspace, taskBrief, reviewPackage, tickTask } from '../lib/sdd.mjs';
```

在 VERBS 对象里 `review-package` 之后追加:

```js
  'tick-task': ({ cwd, plan, task }) => {
    if (!plan || plan === true || !task || task === true || !Number.isInteger(Number(task))) {
      return { ok: false, error: 'tick-task requires --plan <path> --task <N>' };
    }
    const n = Number(task);
    const { ticked, already } = tickTask(plan, n);
    return { ok: true, plan, task: n, ticked, already };
  },
```

- [x] **Step 4: 运行确认通过**

Run: `node --test --test-name-pattern="tick-task verb" plugins/speccode/tests/cli.test.mjs`
Expected: PASS —— 2 个端到端测试通过。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(cli): tick-task verb ticks plan checkboxes via engine"
```

### Task 3: executing-plans 加完成点勾选 prose

**Files:**
- Modify: `plugins/speccode/commands/executing-plans.md`(第 2 步末尾,`onTaskCompleted` 钩子段之后)
- Test: 无独立测试(命令 prose;回归由 Task 5 全量测试覆盖)

**Interfaces:**
- Consumes: `tick-task` verb(Task 2 产出)

- [x] **Step 1: 写失败测试**

命令层 prose 无单元测试;以"段是否存在"为门禁。在 `tests/cli.test.mjs` 末尾加文档断言:

```js
import { readFileSync } from 'node:fs'; // 若顶部已 import 则跳过

test('executing-plans.md documents the tick-task completion step', () => {
  const md = readFileSync(join(__dirname, '..', 'commands', 'executing-plans.md'), 'utf8');
  assert.ok(md.includes('tick-task'), 'executing-plans must reference tick-task verb');
  assert.ok(md.includes('docs(speccode): tick task'), 'executing-plans must commit the tick');
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="executing-plans.md documents" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL —— 文档尚未引用 `tick-task`。

- [x] **Step 3: 写最小实现**

在 `commands/executing-plans.md` 第 2 步的 `onTaskCompleted` 钩子代码块之后,追加第 6 项:

````markdown
6. **同步勾选 plan 进度**:运行
   ```bash
   speccode.mjs tick-task --cwd . --plan <PLAN_FILE> --task <N>
   ```
   把 plan 中 Task N 的 step checkbox 勾选为 `[x]`(`ticked`/`already` 见 verb 输出,幂等);随后把勾选 diff 折进本簿记点提交:
   ```bash
   git add <PLAN_FILE> && git commit -m "docs(speccode): tick task <N>"
   ```
   plan 是 tracked 设计文档,进度随 PR 上 trunk;ledger 仍是崩溃恢复的唯一权威,checkbox 仅作完成态派生视图。`<PLAN_FILE>` 为本命令加载的 plan 路径(第 1 步)。
````

- [x] **Step 4: 运行确认通过**

Run: `node --test --test-name-pattern="executing-plans.md documents" plugins/speccode/tests/cli.test.mjs`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/commands/executing-plans.md plugins/speccode/tests/cli.test.mjs
git commit -m "docs(speccode): executing-plans ticks plan checkbox at task completion"
```

### Task 4: subagent-driven-development 加完成点勾选 prose

**Files:**
- Modify: `plugins/speccode/commands/subagent-driven-development.md`(第 5 步「完成任务」,`onTaskCompleted` 钩子段之后)
- Test: `plugins/speccode/tests/cli.test.mjs`(文档断言,同 Task 3 模式)

**Interfaces:**
- Consumes: `tick-task` verb

- [x] **Step 1: 写失败测试**

在 `tests/cli.test.mjs` 末尾追加:

```js
test('subagent-driven-development.md documents the tick-task completion step', () => {
  const md = readFileSync(join(__dirname, '..', 'commands', 'subagent-driven-development.md'), 'utf8');
  assert.ok(md.includes('tick-task'), 'subagent-driven-development must reference tick-task');
  assert.ok(md.includes('docs(speccode): tick task'), 'must commit the tick');
  // 时序约束:勾选须在审查通过后,不进 review-package diff
  assert.ok(/审查通过后|不.*review-package|review.*之外/.test(md), 'must state tick is post-review / outside review-package diff');
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="subagent-driven-development.md documents" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL。

- [x] **Step 3: 写最小实现**

在 `commands/subagent-driven-development.md` 第 5 步「完成任务」的 `onTaskCompleted` 钩子代码块之后,追加:

````markdown
**勾选 plan 进度(与 ledger 同点)**:在写完 ledger `complete` 行、触发 `onTaskCompleted` 之后,运行
```bash
speccode.mjs tick-task --cwd . --plan <PLAN_FILE> --task <N>
git add <PLAN_FILE> && git commit -m "docs(speccode): tick task <N>"
```
把 plan 中 Task N 的 step checkbox 勾选为 `[x]`。**时序硬约束**:勾选 commit 须在审查干净之后——它在实现 commit(`head`)之后产生,故不在 `review-package` 的 `base..head` diff 内,不污染任务审查者看到的范围。ledger(`progress.md`)仍是崩溃恢复的唯一权威,plan checkbox 仅作完成态派生视图,不参与恢复判断。
````

- [x] **Step 4: 运行确认通过**

Run: `node --test --test-name-pattern="subagent-driven-development.md documents" plugins/speccode/tests/cli.test.mjs`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/commands/subagent-driven-development.md plugins/speccode/tests/cli.test.mjs
git commit -m "docs(speccode): subagent-driven ticks plan checkbox post-review"
```

### Task 5: 全量回归 + 验证

**Files:**
- 无新增;验证既有测试套件全绿。

**Interfaces:**
- Consumes: Task 1-4 全部产出

- [x] **Step 1: 运行全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS —— 全部测试通过(基线 208 + 本功能新增约 7 个)。

- [x] **Step 2: 手动驱动引擎确认 verb 端到端**

Run:
```bash
# 建临时 plan 验证
printf '# P\n\n### Task 1: A\n\n- [ ] s1\n' > /tmp/tick-demo.md
node plugins/speccode/bin/speccode.mjs tick-task --cwd . --plan /tmp/tick-demo.md --task 1
cat /tmp/tick-demo.md
rm /tmp/tick-demo.md
```
Expected: JSON `{ok:true,ticked:["- [ ] s1"],already:[]}`;文件内 `- [ ] s1` → `- [x] s1`。

- [x] **Step 3: 提交(若无未提交残留则跳过)**

```bash
git status --porcelain || true
# 若有残留:
# git add -A && git commit -m "chore(speccode): tick verify"
```

## 禁止占位符自检

- 所有 step 代码块均含可执行代码/命令,无 TBD/TODO。
- Task 1 的 `tickTask` 与 Task 2 的 verb 签名一致(`planFile, n` / `--plan --task`)。
- 测试断言覆盖 spec delta 的 6 个 scenario:勾选(fenced 不误勾)、幂等、Task N 不存在、commit 不污染 diff(由时序 prose 保证)、ledger 恢复权威(由 Global Constraints 声明)。
