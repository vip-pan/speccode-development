import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPrToolFromUrl, createPrArgs, queryPrArgs, parsePrState,
} from '../.claude/speccode/lib/prtool.mjs';

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
