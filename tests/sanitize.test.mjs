import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripCR } from '../lib/sanitize.mjs';

test('stripCR removes CR in a top-level string', () => {
  assert.equal(stripCR('分支名\r用哪个\r?'), '分支名用哪个?');
});

test('stripCR recurses nested objects and arrays', () => {
  const input = {
    questions: [
      { question: 'a\rb\r\rc?', options: [{ label: 'x\r', description: 'ok' }] },
    ],
  };
  assert.equal(stripCR(input).questions[0].question, 'abc?');
  assert.equal(stripCR(input).questions[0].options[0].label, 'x');
});

test('stripCR leaves non-string values untouched', () => {
  const input = { n: 3, b: false, nil: null, arr: [1, true] };
  assert.deepEqual(stripCR(input), input);
});

test('stripCR handles CR at start, end, and in runs', () => {
  assert.equal(stripCR('\r\rlead'), 'lead');
  assert.equal(stripCR('tail\r'), 'tail');
  assert.equal(stripCR('mid\r\r\rdle'), 'middle');
});

test('stripCR returns the same reference when no CR present', () => {
  const input = { q: 'no cr here', opts: [{ label: 'a' }] };
  assert.equal(stripCR(input), input);
});
