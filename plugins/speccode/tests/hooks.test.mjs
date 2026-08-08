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

test('buildHookPayload envelope fields are authoritative over caller fields', () => {
  const p = buildHookPayload('onProposed',
    { event: 'onArchived', timestamp: 'bogus', repo_root: '/fake', cwd: '/fake', command: 'proposing' },
    { repoRoot: '/repo', cwd: '/repo/wt' });
  assert.equal(p.event, 'onProposed');
  assert.equal(p.repo_root, '/repo');
  assert.equal(p.cwd, '/repo/wt');
  assert.notEqual(p.timestamp, 'bogus');
  assert.equal(p.command, 'proposing');
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

test('runHook falls back to exit code in error when stderr is empty', () => {
  const spawn = () => ({ code: 3, stderr: '' });
  const r = runHook({ hooks: { onArchived: 'exit 3' } }, 'onArchived', {}, { spawn });
  assert.equal(r.ran, true);
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 3);
  assert.equal(r.error, 'exit code 3');
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
