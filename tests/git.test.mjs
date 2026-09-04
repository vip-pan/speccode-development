import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';
import {
  git, currentBranch, branchExists, isAncestor, worktreeList,
} from '../lib/git.mjs';

function g(repo, ...args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

test('currentBranch reads HEAD', () => {
  const repo = makeRepo();
  assert.equal(currentBranch(repo), 'master');
  rmSync(repo, { recursive: true, force: true });
});

test('branchExists true/false', () => {
  const repo = makeRepo();
  assert.ok(branchExists('master', repo));
  assert.ok(!branchExists('feature/nope', repo));
  rmSync(repo, { recursive: true, force: true });
});

test('isAncestor detects ancestry', () => {
  const repo = makeRepo();
  g(repo, 'checkout', '-b', 'feature/x');
  commitFile(repo, 'a.txt', 'a', 'add a');
  assert.ok(isAncestor('master', 'feature/x', repo));
  assert.ok(!isAncestor('feature/x', 'master', repo));
  rmSync(repo, { recursive: true, force: true });
});

test('worktreeList parses porcelain including linked worktrees', () => {
  const repo = makeRepo();
  g(repo, 'branch', 'feature/x');
  const wtPath = join(repo, '..', `wt-${Date.now()}`);
  g(repo, 'worktree', 'add', wtPath, 'feature/x');
  const list = worktreeList(repo);
  const branches = list.map((w) => w.branch).sort();
  assert.ok(branches.includes('master'));
  assert.ok(branches.includes('feature/x'));
  g(repo, 'worktree', 'remove', wtPath, '--force');
  rmSync(repo, { recursive: true, force: true });
});

test('git throws on failure by default, allowFail suppresses', () => {
  const repo = makeRepo();
  assert.throws(() => git(['rev-parse', '--verify', 'nope'], { cwd: repo }));
  const r = git(['rev-parse', '--verify', 'nope'], { cwd: repo, allowFail: true });
  assert.notEqual(r.code, 0);
  rmSync(repo, { recursive: true, force: true });
});
