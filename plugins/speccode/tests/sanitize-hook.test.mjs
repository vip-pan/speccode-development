import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'sanitize-ask.mjs');

function runHook(payload) {
  return spawnSync('node', [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
}

test('sanitizes CR in AskUserQuestion input and emits updatedInput', () => {
  const r = runHook({
    tool_name: 'AskUserQuestion',
    tool_input: {
      questions: [{ question: '分支名\r用哪个\r?', header: '分支', options: [] }],
    },
  });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'allow');
  assert.equal(out.hookSpecificOutput.updatedInput.questions[0].question, '分支名用哪个?');
  assert.equal(out.hookSpecificOutput.updatedInput.questions[0].header, '分支');
});

test('no CR → silent pass-through with empty stdout', () => {
  const r = runHook({
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [{ question: '干净文本', options: [] }] },
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('non-target tool → empty stdout', () => {
  const r = runHook({ tool_name: 'Bash', tool_input: { command: 'echo hi\r' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('invalid stdin JSON → exit 0, empty stdout (fail-open)', () => {
  const r = runHook('not json at all');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('missing tool_input → exit 0, empty stdout (fail-open)', () => {
  const r = runHook({ tool_name: 'AskUserQuestion' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('closed stdin → exit 0, empty stdout (fail-open)', () => {
  const r = spawnSync('node', [HOOK], { input: '', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
