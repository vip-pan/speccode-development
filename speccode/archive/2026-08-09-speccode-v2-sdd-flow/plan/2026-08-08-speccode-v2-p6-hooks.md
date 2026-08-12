# speccode v2 · P6 hooks 事件点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地配置驱动的生命周期 hooks:`lib/hooks.mjs`(14 固定事件、payload 构建、warn-only 执行)+ `run-hook` verb(唯一永远 exit 0 的 verb)+ 15 个命令文件的 14 个事件点统一接线。

**Architecture:** 对应 OpenSpec change `speccode-v2-sdd-flow` 的 P6 阶段;spec 锚点 `hook-event-integration`(6 条 requirement)。引擎侧全 TDD;命令接线为 prose 增加固定形态的事件触发行。

**Tech Stack:** Node ≥ 24,纯 ESM,零依赖,node:test,tmprepo。

## Global Constraints

- 测试命令 MUST 用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`。
- **run-hook 是唯一永远 exit 0 的 verb**:handler 整体 try/catch 兜底、永不返回 `ok:false`(失败体现在输出 JSON 的 `hook.ok`/`hook.warning`)。
- 14 个固定事件(逐字,顺序无关):`onExplored, onFeatureCreated, onWorktreeCreated, onProposed, onBrainstormed, onPlanned, onTaskCompleted, onCodeReviewRequested, onCodeReviewCompleted, onWorktreeFinished, onFeatureFinished, onPrOpened, onSynced, onArchived`。
- payload 分工:引擎只补 envelope 四字段(`event/timestamp/repo_root/cwd`,权威、片段不可覆盖);`command` 与事件上下文字段(feature_branch/worktree_branch/pr_number/task)由调用方在 stdin 片段传入。stdin 为空按 `{}` 处理;读取失败或非法 JSON 降级为 `{}` 并在 hook 字段附 `warning`(TTY 经 `isatty(0)` 判定跳过读取——绝不触碰 `process.stdin`,否则 fd 0 被置非阻塞、慢生产者场景 readFileSync(0) 抛 EAGAIN 静默丢片段)。
- hook 执行:`sh -c <cmd>`,cwd=目标项目根(spawnCwd=主仓根,由 bin 经 `repoRoot` 解析传入;payload.cwd 为 `--cwd` 的绝对路径,仅作 envelope 信息字段),默认 30s 超时;非零退出/超时/不可执行 → `{ran:true, ok:false, ...}`,主命令继续。
- 未配置事件 → `{ran:false, ok:true}`;枚举外事件名 → `{ran:false, ok:true, warning}`。
- lib/hooks.mjs 的 spawn 必须可注入;单测 MUST NOT 依赖真实 shell 行为(cli 层可用 `cat >> <tmpfile>` 这类无害 stub 做端到端)。
- 命令 prose 全程中文;事件触发行的形态全插件统一(见 Task 3 模板)。
- 提交信息遵守仓库惯例。

## File Structure

- Create `plugins/speccode/lib/hooks.mjs`、`plugins/speccode/tests/hooks.test.mjs`
- Modify `plugins/speccode/bin/speccode.mjs`(run-hook verb)、`plugins/speccode/tests/cli.test.mjs`
- Modify 15 个命令文件(统一接线,见 Task 3 映射表)
- Modify `openspec/changes/speccode-v2-sdd-flow/tasks.md`(P6 勾选,验收任务内)

---

### Task 1: lib/hooks.mjs

**Files:**
- Create: `plugins/speccode/lib/hooks.mjs`
- Test: `plugins/speccode/tests/hooks.test.mjs`

**Interfaces:**
- Produces:
  - `HOOK_EVENTS: string[]`(14 个,顺序固定如上)
  - `buildHookPayload(event, fields, ctx) -> object`;`ctx = { repoRoot, cwd }`(bin 侧用 git-common-dir 解析 repoRoot 传入,lib 不重复实现)
  - `runHook(config, event, payload, opts?) -> {ran, ok, warning?, exitCode?, error?}`;`opts = { spawn?(command, inputLine) -> {code, signal?, error?, stdout?, stderr?}, timeoutMs? = 30000 }`
- Consumes: `lib/timestamp.mjs` 的 `nowIso()`。

- [ ] **Step 1: 写失败测试** — 新建 `plugins/speccode/tests/hooks.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOOK_EVENTS, buildHookPayload, runHook } from '../lib/hooks.mjs';

test('HOOK_EVENTS has exactly the 14 fixed events', () => {
  assert.equal(HOOK_EVENTS.length, 14);
  assert.ok(HOOK_EVENTS.includes('onTaskCompleted'));
  assert.ok(HOOK_EVENTS.includes('onSynced'));
  assert.ok(HOOK_EVENTS.includes('onArchived'));
});

test('buildHookPayload fills the envelope and merges caller fields', () => {
  const p = buildHookPayload('onProposed', { command: 'proposing', feature_branch: 'feature/x' },
    { repoRoot: '/repo', cwd: '/repo/wt' });
  assert.equal(p.event, 'onProposed');
  assert.equal(p.repo_root, '/repo');
  assert.equal(p.cwd, '/repo/wt');
  assert.equal(p.command, 'proposing');
  assert.equal(p.feature_branch, 'feature/x');
  assert.ok(!Number.isNaN(Date.parse(p.timestamp)));
});

test('runHook no-ops when event not configured', () => {
  assert.deepEqual(runHook({}, 'onProposed', {}), { ran: false, ok: true });
  assert.deepEqual(runHook({ hooks: {} }, 'onProposed', {}), { ran: false, ok: true });
});

test('runHook warns on unknown event name (typo guard)', () => {
  const r = runHook({ hooks: { onProposed: 'x' } }, 'onProposedd', {});
  assert.equal(r.ran, false);
  assert.equal(r.ok, true);
  assert.ok(r.warning.includes('onProposedd'));
});

test('runHook executes configured command via sh -c with JSON on stdin', () => {
  const calls = [];
  const spawn = (command, input) => { calls.push({ command, input }); return { code: 0 }; };
  const r = runHook({ hooks: { onSynced: 'cat >> /tmp/h.log' } }, 'onSynced',
    { event: 'onSynced', cwd: '/repo' }, { spawn });
  assert.deepEqual(r, { ran: true, ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'cat >> /tmp/h.log');
  assert.deepEqual(JSON.parse(calls[0].input), { event: 'onSynced', cwd: '/repo' });
});

test('runHook reports non-zero exit without throwing', () => {
  const spawn = () => ({ code: 1, stderr: 'boom' });
  const r = runHook({ hooks: { onArchived: 'false' } }, 'onArchived', {}, { spawn });
  assert.equal(r.ran, true);
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 1);
});

test('runHook reports spawn error/timeout without throwing', () => {
  const spawn = () => ({ code: null, signal: 'SIGTERM', error: new Error('spawn ETIMEDOUT') });
  const r = runHook({ hooks: { onPlanned: 'sleep 60' } }, 'onPlanned', {}, { spawn });
  assert.equal(r.ran, true);
  assert.equal(r.ok, false);
  assert.ok(r.error.includes('ETIMEDOUT'));
});

test('runHook swallows spawn throw and never returns ok:false at top level contract', () => {
  const spawn = () => { throw new Error('ENOENT'); };
  const r = runHook({ hooks: { onExplored: '/nonexistent' } }, 'onExplored', {}, { spawn });
  assert.equal(r.ran, true);
  assert.equal(r.ok, false);
  assert.ok(r.error.includes('ENOENT'));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test plugins/speccode/tests/hooks.test.mjs`
Expected: FAIL(Cannot find module '../lib/hooks.mjs')

- [ ] **Step 3: 实现** — 新建 `plugins/speccode/lib/hooks.mjs`:

```js
import { spawnSync } from 'node:child_process';
import { nowIso } from './timestamp.mjs';

// Config-driven lifecycle hooks. Failure semantics are warn-only: a hook must
// never break the invoking command. runHook never throws; the CLI's run-hook
// verb folds every outcome into the hook field and always exits 0.
export const HOOK_EVENTS = [
  'onExplored', 'onFeatureCreated', 'onWorktreeCreated', 'onProposed',
  'onBrainstormed', 'onPlanned', 'onTaskCompleted', 'onCodeReviewRequested',
  'onCodeReviewCompleted', 'onWorktreeFinished', 'onFeatureFinished',
  'onPrOpened', 'onSynced', 'onArchived',
];

// ctx carries what only the caller can know: repoRoot (bin resolves it via
// --git-common-dir) and cwd. Event context fields (command, feature_branch,
// worktree_branch, pr_number, task) come from the caller via `fields`. The
// engine's four envelope fields spread last: they are authoritative and a
// caller fragment can never override them.
export function buildHookPayload(event, fields, ctx) {
  return {
    ...fields,
    event,
    timestamp: nowIso(),
    repo_root: ctx.repoRoot,
    cwd: ctx.cwd,
  };
}

export function runHook(config, event, payload, opts = {}) {
  try {
    if (!HOOK_EVENTS.includes(event)) {
      return { ran: false, ok: true, warning: `unknown hook event: ${event}` };
    }
    const cmd = config?.hooks?.[event];
    if (!cmd) return { ran: false, ok: true };
    const timeoutMs = opts.timeoutMs ?? 30000;
    // opts.spawnCwd (bin passes the main repo root) wins; payload.cwd is an
    // informational envelope field, not an exec directive.
    const spawnCwd = opts.spawnCwd ?? payload?.cwd ?? undefined;
    const spawn = opts.spawn ?? ((command, input) => {
      const r = spawnSync('sh', ['-c', command], {
        input, encoding: 'utf8', timeout: timeoutMs, cwd: spawnCwd,
      });
      return { code: r.status, signal: r.signal, error: r.error, stderr: r.stderr };
    });
    const r = spawn(cmd, JSON.stringify(payload));
    if (r.error || r.code === null || r.code === undefined) {
      return { ran: true, ok: false, error: String(r.error?.message || `terminated by ${r.signal}`) };
    }
    if (r.code !== 0) {
      const detail = String(r.stderr || '').slice(0, 500) || `exit code ${r.code}`;
      return { ran: true, ok: false, exitCode: r.code, error: detail };
    }
    return { ran: true, ok: true };
  } catch (err) {
    return { ran: true, ok: false, error: String(err?.message || err) };
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test plugins/speccode/tests/hooks.test.mjs`
Expected: PASS(7 个测试)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/lib/hooks.mjs plugins/speccode/tests/hooks.test.mjs
git commit -m "feat(hooks): fixed 14-event hook runner with warn-only semantics"
```

### Task 2: bin 新增 run-hook verb

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs`
- Test: `plugins/speccode/tests/cli.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `buildHookPayload` / `runHook`;bin 既有 `repoRoot()`。
- Produces: verb `run-hook --event <name> --cwd .`(stdin 可选 JSON 片段)→ 永远 `{ok:true, hook:{...}}` exit 0。Task 3 的 15 个命令文件依赖。

- [ ] **Step 1: 写失败测试** — 追加到 `plugins/speccode/tests/cli.test.mjs`:

```js
test('run-hook without config no-ops and exits 0', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'run-hook', '--cwd', repo, '--event', 'onSynced'],
    { cwd: repo, input: '{"command":"syncing"}', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, true);
  assert.equal(json.hook.ran, false);
  assert.equal(json.hook.ok, true);
  rmSync(repo, { recursive: true, force: true });
});

test('run-hook warns on unknown event and exits 0', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'run-hook', '--cwd', repo, '--event', 'onX'],
    { cwd: repo, input: '', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, true);
  assert.ok(json.hook.warning.includes('onX'));
  rmSync(repo, { recursive: true, force: true });
});

test('run-hook executes configured hook with envelope payload', () => {
  const repo = makeRepo();
  const log = join(repo, 'hook.log');
  const cfg = JSON.stringify({ version: 2, hooks: { onSynced: `cat >> ${log}` } });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: cfg, encoding: 'utf8' });
  const r = spawnSync('node', [BIN, 'run-hook', '--cwd', repo, '--event', 'onSynced'],
    { cwd: repo, input: '{"command":"syncing","feature_branch":"feature/x"}', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.deepEqual(json.hook, { ran: true, ok: true });
  const line = JSON.parse(readFileSync(log, 'utf8').trim());
  assert.equal(line.event, 'onSynced');
  assert.equal(line.command, 'syncing');
  assert.equal(line.feature_branch, 'feature/x');
  assert.equal(line.repo_root, realpathSync(repo));
  assert.ok(!Number.isNaN(Date.parse(line.timestamp)));
  rmSync(repo, { recursive: true, force: true });
});

test('run-hook reports hook failure in JSON and still exits 0', () => {
  const repo = makeRepo();
  const cfg = JSON.stringify({ version: 2, hooks: { onArchived: 'exit 3' } });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: cfg, encoding: 'utf8' });
  const r = spawnSync('node', [BIN, 'run-hook', '--cwd', repo, '--event', 'onArchived'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, true);
  assert.equal(json.hook.ran, true);
  assert.equal(json.hook.ok, false);
  assert.equal(json.hook.exitCode, 3);
  rmSync(repo, { recursive: true, force: true });
});
```

注意:`line.repo_root` 断言用 `realpathSync(repo)`(macOS tmpdir 符号链接归一);若引擎返回未归一路径,以引擎实际行为为准调整断言方向(git `--git-common-dir --path-format=absolute` 在 tmpdir 下的输出形态)。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test --test-name-pattern="run-hook" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL(unknown verb)

- [ ] **Step 3: 实现** — `plugins/speccode/bin/speccode.mjs`:

(a) import 行加(`node:path` 的 import 同时补 `resolve`):

```js
import { isatty } from 'node:tty';
import { buildHookPayload, runHook } from '../lib/hooks.mjs';
```

(b) VERBS 末尾(`query-pr` 之后)加:

```js
  // The only verb that always exits 0: hook failures are warn-only and must
  // never break the invoking command. All errors collapse into the hook field.
  'run-hook': ({ cwd, event }) => {
    try {
      if (!event || event === true) {
        return { ok: true, hook: { ran: false, ok: true, warning: 'run-hook called without --event' } };
      }
      const cfg = loadConfig(speccodeDirOf(cwd));
      // isatty(0) is a side-effect-free syscall. Probing process.stdin.isTTY
      // instead would put fd 0 into non-blocking mode, and readFileSync(0)
      // could then throw EAGAIN before a slow producer fills the pipe,
      // silently dropping the fragment.
      let fragment = {};
      let stdinWarning;
      if (!isatty(0)) {
        try {
          const raw = readStdin();
          if (raw.trim()) fragment = JSON.parse(raw);
        } catch (err) {
          fragment = {};
          stdinWarning = `stdin fragment ignored: ${err?.message || err}`;
        }
      }
      const root = repoRoot(cwd);
      const payload = buildHookPayload(event, fragment, { repoRoot: root, cwd: resolve(cwd) });
      const hook = runHook(cfg, event, payload, { spawnCwd: root });
      if (stdinWarning) {
        hook.warning = hook.warning ? `${hook.warning}; ${stdinWarning}` : stdinWarning;
      }
      return { ok: true, hook };
    } catch (err) {
      return { ok: true, hook: { ran: false, ok: false, error: String(err?.message || err) } };
    }
  },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(95 + 7 hooks + 4 cli = 106,以实际为准)

- [ ] **Step 5: Commit**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(cli): add run-hook verb (always exit 0, warn-only)"
```

### Task 3: 15 个命令文件统一接线 14 事件点

**Files:**
- Modify: `plugins/speccode/commands/` 下 15 个文件(见映射表)

**Interfaces:**
- Consumes: Task 2 的 run-hook verb。Produces: hook-event-integration spec「run-hook verb 与调用节点」的全量接线。

- [ ] **Step 1: 统一接线形态** — 在每个命令的对应节点(收尾/完成后段落)插入如下形态的一行(中文注释可随上下文微调,调用形态不变):

```bash
echo '{"command":"<命令名>","feature_branch":"<F>","worktree_branch":"<W>"}' | speccode.mjs run-hook --cwd . --event <事件名>
```

规则:payload 片段里 `command` 必填,`feature_branch`/`worktree_branch`/`pr_number`/`task` 按可得性附带;紧随其后一句「输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程」。

**接线映射表**(文件 → 事件 → 插入位置):

| 文件 | 事件 | 插入位置 |
|---|---|---|
| exploring.md | onExplored | 「完成后的衔接」段开头(探索结束时) |
| creating-feature.md | onFeatureCreated | 「创建」段写 state 之后、打印之前 |
| creating-worktree.md | onWorktreeCreated | 「创建」段 state 写回之后 |
| proposing.md | onProposed | 「落盘即提交」段 commit 之后 |
| brainstorming.md | onBrainstormed | 「批准后提交」段 commit 之后 |
| writing-plans.md | onPlanned | 「保存与提交」段 commit 之后 |
| subagent-driven-development.md | onTaskCompleted | ledger 完成行规则处(每 task 完成时,payload 带 `"task": <N>`) |
| executing-plans.md | onTaskCompleted | 逐任务执行循环的完成点(payload 带 `"task": <N>`) |
| requesting-code-review.md | onCodeReviewRequested | 派发 reviewer 子代理处 |
| receiving-code-review.md | onCodeReviewCompleted | 反馈处理完成处 |
| finishing-worktree.md | onWorktreeFinished | 「收尾」段报告处 |
| finishing-worktree.md | onPrOpened | 路径 1/2 创建 PR 成功后(payload 带 `"pr_number": <N>`) |
| finishing-feature.md | onFeatureFinished | 「收尾」段 delete-state 之后 |
| finishing-feature.md | onPrOpened | 单 PR 创建成功后(带 pr_number) |
| syncing.md | onSynced | 「落盘即提交」段 commit 之后(含「无变更(幂等)」短路时不触发) |
| archiving.md | onArchived | 「落盘即提交」段 commit 之后 |

- [ ] **Step 2: 验证**

Run: `git grep -c "run-hook" plugins/speccode/commands/*.md | grep -v ":0" | wc -l`
Expected: 15(finishing-worktree/finishing-feature 各 2 处,其余 1 处)
Run: `git grep -n "run-hook" plugins/speccode/commands/ | grep -v "onExplored\|onFeatureCreated\|onWorktreeCreated\|onProposed\|onBrainstormed\|onPlanned\|onTaskCompleted\|onCodeReviewRequested\|onCodeReviewCompleted\|onWorktreeFinished\|onFeatureFinished\|onPrOpened\|onSynced\|onArchived"`
Expected: 零命中(无枚举外事件名)

- [ ] **Step 3: Commit**

```bash
git add plugins/speccode/commands/
git commit -m "feat(commands): wire 14 lifecycle hook events across 15 commands"
```

### Task 4: P6 验收

**Files:**
- Modify: `openspec/changes/speccode-v2-sdd-flow/tasks.md`(勾选 P6)

- [ ] **Step 1: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(约 106,以实际为准)

- [ ] **Step 2: 结构断言 + 冒烟**

```bash
git grep -c "run-hook" plugins/speccode/commands/ | grep -v ":0" | wc -l   # 15
# 冒烟:scratch 仓 config 写 hooks.onSynced='cat >> /tmp/hook.log',run-hook 后文件有单行 JSON
```

- [ ] **Step 3: 勾选 tasks.md P6**(6.1–6.5)

- [ ] **Step 4: Commit**

```bash
git add openspec/changes/speccode-v2-sdd-flow/tasks.md
git commit -m "docs(openspec): check off P6 tasks of speccode-v2-sdd-flow"
```

---

## Self-Review 记录

- **Spec 覆盖**:hook-event-integration 6 条 — hooks 配置字段(T2 no-config/未配置 no-op 测试)、事件名固定枚举(T1 HOOK_EVENTS 14 + 枚举外 warning)、事件载荷(T1 buildHookPayload 分工 + envelope 权威优先 + T2 envelope 端到端 + stdin 空容忍/非法 JSON warning)、hook shell 执行语义(F2:spawnCwd=主仓根,T2 子目录调用 pwd 端到端断言)、失败不阻断(T1 非零/超时/抛错 + T2 exit 0 四形态)、run-hook verb 与调用节点(T3 映射表 15 文件 14 事件)。
- **Placeholder 扫描**:引擎代码与测试完整;接线形态为统一模板 + 逐文件位置表。
- **一致性**:payload 字段名与 spec「事件载荷」逐字一致;run-hook exit 0 语义在 T1 lib(不抛)、T2 verb(整体 try/catch + 永远 ok:true)、T3 命令(不阻断)三层一致。
- **既有兼容**:95 个既有测试不动;新增 hooks 7 + cli 4。
