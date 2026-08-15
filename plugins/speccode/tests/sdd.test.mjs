import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';
import {
  worktreeRoot, sddWorkspace, extractTaskBrief, taskBrief, reviewPackage, tickTask,
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
  assert.ok(!b10.includes('### Task 1: Alpha')); // body-1 substring would collide with body-10
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

test('sddWorkspace self-ignores .speccode/sdd via a `*` .gitignore, idempotently', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, '# x');
  sddWorkspace(plan, repo);
  const gitignore = join(worktreeRoot(repo), '.speccode', 'sdd', '.gitignore');
  assert.ok(existsSync(gitignore));
  assert.equal(readFileSync(gitignore, 'utf8'), '*\n');
  // second call must not throw (and content stays correct)
  sddWorkspace(plan, repo);
  assert.equal(readFileSync(gitignore, 'utf8'), '*\n');
  rmSync(repo, { recursive: true, force: true });
});

test('sddWorkspace rejects plan paths whose basename is a dot segment', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, 'sub'), { recursive: true });
  // `join()` would normalize `..`/`.` away — build the raw strings instead.
  // basename(`${repo}/sub/..`) === '..' even though the path itself resolves
  // to `repo` (which exists), so the slug guard is what rejects it.
  assert.throws(() => sddWorkspace(`${repo}/sub/..`, repo), /cannot derive a workspace name/);
  assert.throws(() => sddWorkspace(`${repo}/sub/.`, repo), /cannot derive a workspace name/);
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
  const inoBefore = statSync(plan).ino;
  const r = tickTask(plan, 1);
  assert.deepEqual(r.ticked, []);
  assert.equal(r.already.length, 2);
  // A no-op run must not rewrite the file: writeTextAtomic renames a temp file
  // over the target, so an unchanged inode proves no write happened.
  assert.equal(statSync(plan).ino, inoBefore);
  rmSync(repo, { recursive: true, force: true });
});

// 外层 4 反引号块内含未缩进的 ```bash 内层 fence(奇数个),朴素 toggle 会在块内
// 把状态翻回「fence 外」,块内素材被误勾、块后的 Task 标题被当 fence 内文本忽略。
const NESTED_PLAN = [
  '# Plan', '',
  '### Task 1: Alpha', '',
  '- [ ] **Step 1: 引用一段文档**', '',
  '````markdown',
  '- [ ] fenced-outer',
  '```bash',
  'echo hi',
  '```',
  '- [ ] fenced-after-inner',
  '### Task 9: heading inside fence',
  '````', '',
  '- [ ] **Step 2: 块之后**', '',
  '### Task 2: Beta', '',
  '- [ ] **Step 1: gamma**', '',
  '## 收尾', '',
  '- [ ] 尾部章节条目', '',
].join('\n');

test('tickTask keeps nested/longer fences closed (no ticks inside a ````block)', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, NESTED_PLAN);
  const r = tickTask(plan, 1);
  assert.equal(r.ticked.length, 2); // 仅 Step 1 / Step 2,块内三行不算
  const after = readFileSync(plan, 'utf8');
  assert.ok(after.includes('- [x] **Step 1: 引用一段文档**'));
  assert.ok(after.includes('- [x] **Step 2: 块之后**'));
  assert.ok(after.includes('- [ ] fenced-outer'));        // 外层块首行
  assert.ok(after.includes('- [ ] fenced-after-inner'));  // 内层 fence 之后仍在块内
  assert.ok(after.includes('- [ ] **Step 1: gamma**'));   // Task 2 不动
  rmSync(repo, { recursive: true, force: true });
});

test('tickTask ignores `### Task N` headings that live inside a fence', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, NESTED_PLAN);
  assert.throws(() => tickTask(plan, 9), /task 9 not found/);
  assert.equal(readFileSync(plan, 'utf8'), NESTED_PLAN); // 报错路径不改文件
  rmSync(repo, { recursive: true, force: true });
});

test('tickTask stops a task section at the next same-or-higher heading', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, NESTED_PLAN);
  const r = tickTask(plan, 2);
  assert.deepEqual(r.ticked, ['- [ ] **Step 1: gamma**']); // 不吃 `## 收尾` 章节
  assert.ok(readFileSync(plan, 'utf8').includes('- [ ] 尾部章节条目'));
  rmSync(repo, { recursive: true, force: true });
});

test('extractTaskBrief and tickTask share one scan (nested fence, section end)', () => {
  const brief = extractTaskBrief(NESTED_PLAN, 1);
  assert.ok(brief.includes('- [ ] fenced-outer'));
  assert.ok(brief.includes('### Task 9: heading inside fence')); // fence 内行保留在任务体
  assert.ok(brief.includes('- [ ] **Step 2: 块之后**'));
  assert.ok(!brief.includes('gamma'));
  assert.equal(extractTaskBrief(NESTED_PLAN, 9), null); // fence 内标题不是任务
  const b2 = extractTaskBrief(NESTED_PLAN, 2);
  assert.ok(b2.includes('gamma'));
  assert.ok(!b2.includes('尾部章节条目')); // 区段止于 `## 收尾`
});

test('tickTask throws when task N is absent', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, TICK_PLAN);
  assert.throws(() => tickTask(plan, 99), /task 99 not found/);
  rmSync(repo, { recursive: true, force: true });
});
