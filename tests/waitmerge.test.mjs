import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForPrMerge } from '../.claude/speccode/lib/waitmerge.mjs';

const noSleep = () => Promise.resolve();

test('returns MERGED as soon as query reports merged', async () => {
  let calls = 0;
  const query = async () => { calls += 1; return calls >= 2 ? 'MERGED' : 'OPEN'; };
  const r = await waitForPrMerge({ query, sleep: noSleep, intervalMs: 1, timeoutMs: 1000 });
  assert.equal(r.outcome, 'MERGED');
  assert.equal(r.polls, 2);
});

test('returns CLOSED immediately', async () => {
  const r = await waitForPrMerge({ query: async () => 'CLOSED', sleep: noSleep, intervalMs: 1, timeoutMs: 1000 });
  assert.equal(r.outcome, 'CLOSED');
});

test('returns CONFLICTING immediately', async () => {
  const r = await waitForPrMerge({ query: async () => 'CONFLICTING', sleep: noSleep, intervalMs: 1, timeoutMs: 1000 });
  assert.equal(r.outcome, 'CONFLICTING');
});

test('times out when never merges', async () => {
  // timeoutMs smaller than intervalMs => times out after first sleep
  const r = await waitForPrMerge({ query: async () => 'OPEN', sleep: noSleep, intervalMs: 100, timeoutMs: 50 });
  assert.equal(r.outcome, 'TIMEOUT');
});
