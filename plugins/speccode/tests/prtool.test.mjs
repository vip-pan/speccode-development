import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPrToolFromUrl, createPrArgs, queryPrArgs, parsePrState, queryPrState,
} from '../lib/prtool.mjs';

test('detectPrToolFromUrl maps hosts', () => {
  assert.equal(detectPrToolFromUrl('git@github.com:foo/bar.git'), 'gh');
  assert.equal(detectPrToolFromUrl('https://gitlab.com/foo/bar.git'), 'glab');
  assert.equal(detectPrToolFromUrl('git@bitbucket.org:foo/bar.git'), 'none');
});

test('createPrArgs for gh', () => {
  const args = createPrArgs('gh', { base: 'display', head: 'feature/x', title: 'T', body: 'B' });
  assert.deepEqual(args, [
    'pr', 'create', '--base', 'display', '--head', 'feature/x', '--title', 'T', '--body', 'B',
  ]);
});

test('createPrArgs for glab', () => {
  const args = createPrArgs('glab', { base: 'display', head: 'worktree-x', title: 'T', body: 'B' });
  assert.deepEqual(args, [
    'mr', 'create', '--target-branch', 'display', '--source-branch', 'worktree-x',
    '--title', 'T', '--description', 'B',
  ]);
});

test('queryPrArgs for gh and glab', () => {
  assert.deepEqual(queryPrArgs('gh', 'feature/x'),
    ['pr', 'view', 'feature/x', '--json', 'state,mergedAt,mergeCommit']);
  assert.deepEqual(queryPrArgs('glab', 'feature/x'),
    ['mr', 'view', 'feature/x', '--output', 'json']);
});

test('parsePrState gh', () => {
  assert.equal(parsePrState('gh', '{"state":"MERGED","mergedAt":"2026-07-10T00:00:00Z"}'), 'MERGED');
  assert.equal(parsePrState('gh', '{"state":"OPEN","mergedAt":null}'), 'OPEN');
  assert.equal(parsePrState('gh', '{"state":"CLOSED","mergedAt":null}'), 'CLOSED');
});

test('parsePrState glab', () => {
  assert.equal(parsePrState('glab', '{"state":"merged"}'), 'MERGED');
  assert.equal(parsePrState('glab', '{"state":"opened"}'), 'OPEN');
  assert.equal(parsePrState('glab', '{"state":"closed"}'), 'CLOSED');
});

test('parsePrState unknown on garbage', () => {
  assert.equal(parsePrState('gh', 'not json'), 'UNKNOWN');
});

test('queryPrState returns MERGED via injected run for gh', () => {
  const run = (cmd, args) => {
    assert.equal(cmd, 'gh');
    assert.deepEqual(args, ['pr', 'view', 'feature/x', '--json', 'state,mergedAt,mergeCommit']);
    return { code: 0, stdout: '{"state":"MERGED","mergedAt":"2026-07-10T00:00:00Z"}' };
  };
  assert.equal(queryPrState('gh', 'feature/x', { run }), 'MERGED');
});

test('queryPrState returns UNKNOWN when run reports non-zero code', () => {
  const run = () => ({ code: 1, stdout: '' });
  assert.equal(queryPrState('gh', 'feature/x', { run }), 'UNKNOWN');
});

test('queryPrState returns OPEN via injected run for glab', () => {
  const run = (cmd, args) => {
    assert.equal(cmd, 'glab');
    assert.deepEqual(args, ['mr', 'view', 'worktree-y', '--output', 'json']);
    return { code: 0, stdout: '{"state":"opened"}' };
  };
  assert.equal(queryPrState('glab', 'worktree-y', { run }), 'OPEN');
});
