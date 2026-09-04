import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJsonAtomic } from '../lib/atomic.mjs';
import {
  WORKTREE_STATUS, branchesDir, featuresDir, readState, writeState, deleteState, listActiveFeatures, normalizeState, migrateStateV2toV3,
} from '../lib/state.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'speccode-state-')); }

test('WORKTREE_STATUS enum values', () => {
  assert.deepEqual(WORKTREE_STATUS, {
    PENDING: 'pending', IN_PROGRESS: 'in_progress',
    PR_OPEN: 'pr_open', COMPLETED: 'completed',
  });
});

test('branchesDir points at state/branches and featuresDir at state/features', () => {
  assert.equal(branchesDir('/x/.speccode'), '/x/.speccode/state/branches');
  assert.equal(featuresDir('/x/.speccode'), '/x/.speccode/state/features');
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
  assert.equal(existsSync(join(branchesDir(dir), 'feature__payment.json')), false);
  assert.equal(existsSync(join(featuresDir(dir), 'feature__payment.json')), false);
  rmSync(dir, { recursive: true, force: true });
});

test('normalizeState maps legacy pending_operation.command (finish)', () => {
  const s = normalizeState({
    feature_branch: 'feature/p',
    pending_operation: { command: 'finish', phase: 'waiting_trunk_pr', pr_number: 7 },
  });
  assert.equal(s.pending_operation.command, 'finishing-feature');
  assert.equal(s.pending_operation.phase, 'waiting_trunk_pr');
});

test('normalizeState maps develop-complete and keeps waiting_display_pr phase untouched', () => {
  const s = normalizeState({
    feature_branch: 'feature/p',
    pending_operation: { command: 'develop-complete', phase: 'waiting_display_pr', pr_number: 3 },
  });
  assert.equal(s.pending_operation.command, 'finishing-worktree');
  assert.equal(s.pending_operation.phase, 'waiting_display_pr');
});

test('normalizeState passes through states without pending_operation or with new names', () => {
  const plain = { feature_branch: 'feature/p', worktrees: {} };
  assert.deepEqual(normalizeState(plain), plain);
  const fresh = { feature_branch: 'feature/p', pending_operation: { command: 'finishing-feature', phase: 'waiting_trunk_pr' } };
  assert.deepEqual(normalizeState(fresh), fresh);
  assert.equal(normalizeState(null), null);
});

test('normalizeState does not match inherited Object.prototype keys (toString)', () => {
  const s = normalizeState({
    feature_branch: 'feature/p',
    pending_operation: { command: 'toString', phase: 'waiting_trunk_pr' },
  });
  assert.equal(s.pending_operation.command, 'toString');
  assert.equal(s.pending_operation.phase, 'waiting_trunk_pr');
});

test('readState normalizes legacy pending_operation.command', () => {
  const dir = tmp();
  writeState(dir, 'feature/p', {
    feature_branch: 'feature/p',
    pending_operation: { command: 'finish', phase: 'waiting_trunk_pr', pr_number: 7 },
  });
  assert.equal(readState(dir, 'feature/p').pending_operation.command, 'finishing-feature');
  rmSync(dir, { recursive: true, force: true });
});

test('listActiveFeatures normalizes legacy pending_operation.command', () => {
  const dir = tmp();
  writeState(dir, 'feature/p', {
    feature_branch: 'feature/p',
    pending_operation: { command: 'develop-complete', phase: 'waiting_worktree_pr', pr_number: 9 },
  });
  const [s] = listActiveFeatures(dir);
  assert.equal(s.pending_operation.command, 'finishing-worktree');
  rmSync(dir, { recursive: true, force: true });
});

// ---- v3 dual-format ----

test('writeState defaults to state/branches, readState round-trips v3 schema', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  writeState(sc, 'feature/payment', {
    branch: 'feature/payment', type: 'feature', worktree: '/wt/payment',
    status: 'in_progress', created_at: '2026-09-02T00:00:00.000Z', initial_branch: 'main',
  });
  assert.equal(existsSync(join(sc, 'state', 'branches', 'feature__payment.json')), true);
  assert.equal(readState(sc, 'feature/payment').branch, 'feature/payment');
  rmSync(root, { recursive: true, force: true });
});

test('writeState preserves a pre-existing v2 file in place (format follows file)', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  const v2path = join(sc, 'state', 'features', 'feature__legacy.json');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(v2path, {
    feature_branch: 'feature/legacy', created_at: '2026-09-01T00:00:00.000Z',
    initial_branch: 'main', status: 'in_progress',
    worktrees: { 'worktree-legacy': { status: 'in_progress' } },
  });
  writeState(sc, 'feature/legacy', readState(sc, 'feature/legacy'));
  assert.equal(existsSync(join(sc, 'state', 'branches', 'feature__legacy.json')), false);
  assert.equal(readState(sc, 'feature/legacy').feature_branch, 'feature/legacy');
  rmSync(root, { recursive: true, force: true });
});

test('listActiveFeatures returns v3 then v2 entries as-is (no translation)', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__old.json'), {
    feature_branch: 'feature/old', status: 'in_progress', worktrees: {},
  });
  writeState(sc, 'feature/new', { branch: 'feature/new', type: 'feature', worktree: null,
    status: 'pending', created_at: '2026-09-02T00:00:00.000Z', initial_branch: 'main' });
  const all = listActiveFeatures(sc);
  assert.equal(all.length, 2);
  assert.equal(all[0].branch, 'feature/new');
  assert.equal(all[1].feature_branch, 'feature/old');
  rmSync(root, { recursive: true, force: true });
});

test('migrateStateV2toV3 skips in-flight single-worktree features, still migrates completed ones', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__wip.json'), {
    feature_branch: 'feature/wip', created_at: '2026-09-01T00:00:00.000Z',
    initial_branch: 'main', status: 'in_progress',
    worktrees: { 'worktree-a': { status: 'in_progress' } },
  });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__donewt.json'), {
    feature_branch: 'feature/donewt', created_at: '2026-08-01T00:00:00.000Z',
    initial_branch: 'main', status: 'in_progress',
    worktrees: { 'worktree-a': { status: 'completed' } },
  });
  const res = migrateStateV2toV3(sc);
  assert.deepEqual(res.skipped, ['feature__wip.json']);
  assert.deepEqual(res.migrated, ['feature__donewt.json']);
  assert.equal(existsSync(join(sc, 'state', 'features', 'feature__wip.json')), true);
  assert.equal(existsSync(join(sc, 'state', 'features', 'feature__donewt.json')), false);
  assert.deepEqual(readState(sc, 'feature/donewt'), {
    branch: 'feature/donewt', type: 'feature', worktree: null,
    status: 'in_progress', created_at: '2026-08-01T00:00:00.000Z', initial_branch: 'main',
  });
  rmSync(root, { recursive: true, force: true });
});

test('migrateStateV2toV3 skips when the v3 target file already exists', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  const existing = {
    branch: 'feature/taken', type: 'feature', worktree: '/wt/taken',
    status: 'in_progress', created_at: '2026-09-02T00:00:00.000Z', initial_branch: 'main',
  };
  writeState(sc, 'feature/taken', existing);
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__taken.json'), {
    feature_branch: 'feature/taken', created_at: '2026-09-01T00:00:00.000Z',
    initial_branch: 'main', status: 'pending', worktrees: {},
  });
  const res = migrateStateV2toV3(sc);
  assert.deepEqual(res.migrated, []);
  assert.deepEqual(res.skipped, ['feature__taken.json']);
  assert.deepEqual(readState(sc, 'feature/taken'), existing);
  assert.equal(existsSync(join(sc, 'state', 'features', 'feature__taken.json')), true);
  rmSync(root, { recursive: true, force: true });
});

test('migrateStateV2toV3 converts clean features, skips multi-worktree and malformed', () => {
  const root = tmp();
  const sc = join(root, '.speccode');
  mkdirSync(join(sc, 'state', 'features'), { recursive: true });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__clean.json'), {
    feature_branch: 'feature/clean', created_at: '2026-09-01T00:00:00.000Z',
    initial_branch: 'main', status: 'pending', worktrees: {},
  });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__busy.json'), {
    feature_branch: 'feature/busy', created_at: '2026-09-01T00:00:00.000Z',
    initial_branch: 'main', status: 'in_progress',
    worktrees: { 'worktree-a': { status: 'in_progress' }, 'worktree-b': { status: 'completed' } },
  });
  writeJsonAtomic(join(sc, 'state', 'features', 'feature__bad.json'), { status: 'in_progress' });
  const res = migrateStateV2toV3(sc);
  assert.deepEqual(res.migrated, ['feature__clean.json']);
  assert.deepEqual(res.skipped.sort(), ['feature__bad.json', 'feature__busy.json']);
  const clean = readState(sc, 'feature/clean');
  assert.equal(clean.branch, 'feature/clean');
  assert.equal(clean.worktree, null);
  assert.equal(existsSync(join(sc, 'state', 'features', 'feature__clean.json')), false);
  assert.equal(existsSync(join(sc, 'state', 'features', 'feature__busy.json')), true);
  rmSync(root, { recursive: true, force: true });
});
