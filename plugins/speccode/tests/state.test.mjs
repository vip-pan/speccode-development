import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  WORKTREE_STATUS, stateFilePath, readState, writeState, deleteState, listActiveFeatures,
} from '../.claude/speccode/lib/state.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'speccode-state-')); }

test('WORKTREE_STATUS enum values', () => {
  assert.deepEqual(WORKTREE_STATUS, {
    PENDING: 'pending', IN_PROGRESS: 'in_progress',
    PR_OPEN: 'pr_open', COMPLETED: 'completed',
  });
});

test('stateFilePath maps branch to double-underscore filename', () => {
  const p = stateFilePath('/x/.speccode', 'feature/payment');
  assert.equal(p, '/x/.speccode/state/features/feature__payment.json');
});

test('readState returns null when absent', () => {
  const dir = tmp();
  assert.equal(readState(dir, 'feature/none'), null);
  rmSync(dir, { recursive: true, force: true });
});

test('writeState then readState round-trips', () => {
  const dir = tmp();
  const state = {
    feature_branch: 'feature/payment',
    created_at: '2026-07-10T00:00:00.000Z',
    initial_branch: 'display',
    status: 'in_progress',
    worktrees: { 'worktree-payment': { status: 'in_progress' } },
  };
  writeState(dir, 'feature/payment', state);
  assert.deepEqual(readState(dir, 'feature/payment'), state);
  rmSync(dir, { recursive: true, force: true });
});

test('listActiveFeatures empty dir returns []', () => {
  const dir = tmp();
  assert.deepEqual(listActiveFeatures(dir), []);
  rmSync(dir, { recursive: true, force: true });
});

test('listActiveFeatures returns all feature states', () => {
  const dir = tmp();
  writeState(dir, 'feature/payment', { feature_branch: 'feature/payment', worktrees: {} });
  writeState(dir, 'bugfix/login', { feature_branch: 'bugfix/login', worktrees: {} });
  const branches = listActiveFeatures(dir).map((s) => s.feature_branch).sort();
  assert.deepEqual(branches, ['bugfix/login', 'feature/payment']);
  rmSync(dir, { recursive: true, force: true });
});

test('deleteState removes the file', () => {
  const dir = tmp();
  writeState(dir, 'feature/payment', { feature_branch: 'feature/payment', worktrees: {} });
  deleteState(dir, 'feature/payment');
  assert.equal(existsSync(stateFilePath(dir, 'feature/payment')), false);
  rmSync(dir, { recursive: true, force: true });
});
