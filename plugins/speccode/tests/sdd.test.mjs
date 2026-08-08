import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
