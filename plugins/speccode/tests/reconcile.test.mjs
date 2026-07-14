import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';
import { writeState, readState } from '../lib/state.mjs';
import { reconcile } from '../lib/reconcile.mjs';

function g(repo, ...args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

test('auto-attaches unregistered worktree via ancestry', () => {
  const repo = makeRepo();
  const sc = mkdtempSync(join(tmpdir(), 'sc-'));
  g(repo, 'checkout', '-b', 'feature/payment');
  commitFile(repo, 'a.txt', 'a', 'a');
  g(repo, 'checkout', 'master');
  writeState(sc, 'feature/payment', {
    feature_branch: 'feature/payment', initial_branch: 'master',
    status: 'in_progress', worktrees: {},
  });
  const wt = join(repo, '..', `wt-p-${Date.now()}`);
  g(repo, 'worktree', 'add', wt, '-b', 'worktree-payment', 'feature/payment');
  const res = reconcile(sc, { prefix: 'worktree-', cwd: repo });
  const st = readState(sc, 'feature/payment');
  assert.equal(st.worktrees['worktree-payment'].status, 'in_progress');
  assert.equal(res.orphans.length, 0);
  g(repo, 'worktree', 'remove', wt, '--force');
  rmSync(repo, { recursive: true, force: true });
  rmSync(sc, { recursive: true, force: true });
});

test('marks orphan when state worktree absent in git', () => {
  const repo = makeRepo();
  const sc = mkdtempSync(join(tmpdir(), 'sc-'));
  writeState(sc, 'feature/x', {
    feature_branch: 'feature/x', initial_branch: 'master', status: 'in_progress',
    worktrees: { 'worktree-x': { status: 'in_progress' } },
  });
  const res = reconcile(sc, { prefix: 'worktree-', cwd: repo });
  assert.ok(res.orphans.includes('worktree-x'));
  rmSync(repo, { recursive: true, force: true });
  rmSync(sc, { recursive: true, force: true });
});

test('worktree_overrides wins over ancestry', () => {
  const repo = makeRepo();
  const sc = mkdtempSync(join(tmpdir(), 'sc-'));
  // both features share ancestry with the worktree branch (branched from master)
  g(repo, 'branch', 'feature/a');
  g(repo, 'branch', 'feature/b');
  writeState(sc, 'feature/a', {
    feature_branch: 'feature/a', status: 'in_progress', worktrees: {},
    worktree_overrides: { 'worktree-shared': 'feature/a' },
  });
  writeState(sc, 'feature/b', {
    feature_branch: 'feature/b', status: 'in_progress', worktrees: {},
  });
  const wt = join(repo, '..', `wt-s-${Date.now()}`);
  g(repo, 'worktree', 'add', wt, '-b', 'worktree-shared', 'master');
  const res = reconcile(sc, { prefix: 'worktree-', cwd: repo });
  assert.ok(readState(sc, 'feature/a').worktrees['worktree-shared']);
  assert.ok(!readState(sc, 'feature/b').worktrees['worktree-shared']);
  assert.equal(res.conflicts.length, 0);
  g(repo, 'worktree', 'remove', wt, '--force');
  rmSync(repo, { recursive: true, force: true });
  rmSync(sc, { recursive: true, force: true });
});

test('records conflicts when worktree branch is ancestor of >=2 features', () => {
  const repo = makeRepo();
  const sc = mkdtempSync(join(tmpdir(), 'sc-'));
  // both features share ancestry with the worktree branch (branched from master)
  g(repo, 'branch', 'feature/a');
  g(repo, 'branch', 'feature/b');
  writeState(sc, 'feature/a', {
    feature_branch: 'feature/a', status: 'in_progress', worktrees: {},
  });
  writeState(sc, 'feature/b', {
    feature_branch: 'feature/b', status: 'in_progress', worktrees: {},
  });
  const wt = join(repo, '..', `wt-c-${Date.now()}`);
  g(repo, 'worktree', 'add', wt, '-b', 'worktree-shared', 'master');
  const res = reconcile(sc, { prefix: 'worktree-', cwd: repo });
  assert.equal(res.conflicts.length, 1);
  assert.equal(res.conflicts[0].worktree, 'worktree-shared');
  assert.deepEqual(res.conflicts[0].features.slice().sort(), ['feature/a', 'feature/b']);
  assert.ok(!readState(sc, 'feature/a').worktrees['worktree-shared']);
  assert.ok(!readState(sc, 'feature/b').worktrees['worktree-shared']);
  g(repo, 'worktree', 'remove', wt, '--force');
  rmSync(repo, { recursive: true, force: true });
  rmSync(sc, { recursive: true, force: true });
});

test('advances pr_open to completed when queryPr returns MERGED', () => {
  const repo = makeRepo();
  const sc = mkdtempSync(join(tmpdir(), 'sc-'));
  writeState(sc, 'feature/p', {
    feature_branch: 'feature/p', status: 'in_progress',
    worktrees: { 'worktree-p': { status: 'pr_open', pr_number: 42 } },
  });
  const res = reconcile(sc, {
    prefix: 'worktree-', cwd: repo, queryPr: () => 'MERGED',
  });
  assert.equal(readState(sc, 'feature/p').worktrees['worktree-p'].status, 'completed');
  assert.equal(res.advanced[0].to, 'completed');
  rmSync(repo, { recursive: true, force: true });
  rmSync(sc, { recursive: true, force: true });
});
