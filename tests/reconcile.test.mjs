import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo } from './helpers/tmprepo.mjs';
import { writeState, readState } from '../lib/state.mjs';
import { writeJsonAtomic } from '../lib/atomic.mjs';
import { reconcile } from '../lib/reconcile.mjs';

// ---- v3 path identification ----

function writeV3Branch(sc, branch, extra = {}) {
  writeState(sc, branch, {
    branch, type: branch.split('/')[0], worktree: null,
    status: 'in_progress', created_at: '2026-09-02T00:00:00.000Z', initial_branch: 'main',
    ...extra,
  });
}

function addWorktree(repo, dir, branch) {
  const r = spawnSync('git', ['worktree', 'add', dir, '-b', branch], { cwd: repo, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return dir;
}

test('v3 reconcile: managed = worktree under worktreeDir, branch name irrelevant', () => {
  // realpathSync: git worktree list prints real paths; on macOS /var is a
  // symlink to /private/var (same normalization as cli.test.mjs makeRepo use)
  const repo = realpathSync(makeRepo());
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  writeV3Branch(sc, 'feature/payment');
  addWorktree(repo, join(wtdir, 'feature__payment'), 'feature/payment');
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.deepEqual(res.orphans, []);
  assert.deepEqual(res.conflicts, []);
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: worktree outside worktreeDir is invisible (host-owned)', () => {
  const repo = realpathSync(makeRepo());
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  writeV3Branch(sc, 'feature/payment');
  addWorktree(repo, join(repo, 'outside-wt'), 'feature/payment'); // 在 wtdir 之外
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.deepEqual(res.orphans, []);
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: unregistered worktree under worktreeDir is an orphan', () => {
  const repo = realpathSync(makeRepo());
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  addWorktree(repo, join(wtdir, 'stray'), 'feature/stray');
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.ok(res.orphans.length === 1 && res.orphans[0].includes('stray'));
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: unregistered worktree outside worktreeDir is not an orphan', () => {
  // Anchors the isPathInside filter itself: the worktree is unregistered AND
  // outside worktreeDir, so loop 2 (unregistered managed worktrees) must never
  // see it. Remove the path filter and this stray would be reported as an orphan.
  const repo = realpathSync(makeRepo());
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  addWorktree(repo, join(repo, 'outside-stray'), 'feature/outside-stray');
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.ok(!res.orphans.some((o) => o.includes('outside-stray')), JSON.stringify(res.orphans));
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: non-completed branch missing from git is an orphan; completed exempt', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  writeV3Branch(sc, 'feature/gone');
  writeV3Branch(sc, 'feature/done', { status: 'completed', completed_at: '2026-09-02T00:00:00.000Z' });
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.deepEqual(res.orphans, ['feature/gone']);
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: merge_target pointing to a missing branch is an orphan', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  writeV3Branch(sc, 'feature/child', { merge_target: 'feature/no-such-integration' });
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir });
  assert.ok(res.orphans.includes('feature/child'));
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: v2 entries pass through untouched', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__old.json'), {
    feature_branch: 'feature/old', status: 'in_progress', worktrees: {},
  });
  const res = reconcile(sc, { cwd: repo, worktreeDir: join(repo, 'wts') });
  const old = res.features.find((f) => f.feature_branch === 'feature/old');
  assert.ok(old);
  assert.deepEqual(old.worktrees, {});
  rmSync(repo, { recursive: true, force: true });
});

test('v3 reconcile: pr_open advances to completed via queryPr (unchanged semantics)', () => {
  const repo = makeRepo();
  const sc = join(repo, '.speccode');
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  writeV3Branch(sc, 'feature/pr', { status: 'pr_open', pr_number: 7 });
  const res = reconcile(sc, { cwd: repo, worktreeDir: wtdir, queryPr: () => 'MERGED' });
  assert.deepEqual(res.advanced, [{ branch: 'feature/pr', from: 'pr_open', to: 'completed' }]);
  assert.equal(readState(sc, 'feature/pr').status, 'completed');
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile: 不传 worktreeDir 时按中性缺省根解析(与 detect 单源)', () => {
  // realpathSync: git worktree list prints real paths; on macOS /var is a
  // symlink to /private/var — same discipline as the tests above.
  const repo = realpathSync(makeRepo());
  const sc = join(repo, '.speccode');
  mkdirSync(join(sc, 'state', 'branches'), { recursive: true });
  mkdirSync(join(repo, '.speccode', 'worktrees'), { recursive: true });
  const add = spawnSync('git', ['worktree', 'add', join(repo, '.speccode/worktrees/stray'), '-b', 'feature/stray'],
    { cwd: repo, encoding: 'utf8' });
  assert.equal(add.status, 0, add.stderr);
  // 不传 worktreeDir → 走 DEFAULT_WORKTREE_DIR 缺省(与 detect.mjs 单源)
  const res = reconcile(sc, { cwd: repo });
  assert.ok(res.orphans.some((o) => o.includes('stray')), 'stray 必须经缺省根识别为 orphan');
  rmSync(repo, { recursive: true, force: true });
});
