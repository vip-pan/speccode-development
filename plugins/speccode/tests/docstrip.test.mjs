import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';
import {
  enabledDocDirs, existingTrackedDirs, existingWorkingDirs, stripDocs, retrackDocs, backupDocs,
} from '../lib/docstrip.mjs';

function tracked(repo, path) {
  const r = spawnSync('git', ['ls-files', path], { cwd: repo, encoding: 'utf8' });
  return r.stdout.trim().length > 0;
}

test('enabledDocDirs picks enabled tools only', () => {
  const cfg = { spec_tools: {
    openspec: { enabled: true, doc_dir: 'openspec' },
    superpowers: { enabled: false, doc_dir: 'docs/superpowers' },
  } };
  assert.deepEqual(enabledDocDirs(cfg), ['openspec']);
});

test('stripDocs untracks but keeps working file', () => {
  const repo = makeRepo();
  commitFile(repo, 'openspec/spec.md', '# spec', 'add spec');
  assert.ok(tracked(repo, 'openspec'));
  stripDocs(['openspec'], repo);
  assert.ok(!tracked(repo, 'openspec'));
  assert.ok(existsSync(join(repo, 'openspec', 'spec.md'))); // file preserved
  rmSync(repo, { recursive: true, force: true });
});

test('existingTrackedDirs / existingWorkingDirs filter correctly', () => {
  const repo = makeRepo();
  commitFile(repo, 'openspec/spec.md', '# spec', 'add spec');
  assert.deepEqual(existingTrackedDirs(['openspec', 'docs/superpowers'], repo), ['openspec']);
  assert.deepEqual(existingWorkingDirs(['openspec', 'docs/superpowers'], repo), ['openspec']);
  rmSync(repo, { recursive: true, force: true });
});

test('backupDocs copies working dirs into backup dir', () => {
  const repo = makeRepo();
  commitFile(repo, 'openspec/spec.md', '# spec', 'add spec');
  const backup = mkdtempSync(join(tmpdir(), 'sc-bak-'));
  const done = backupDocs(['openspec'], repo, backup);
  assert.deepEqual(done, ['openspec']);
  assert.ok(existsSync(join(backup, 'openspec', 'spec.md')));
  rmSync(repo, { recursive: true, force: true });
  rmSync(backup, { recursive: true, force: true });
});

test('retrackDocs re-adds after untrack', () => {
  const repo = makeRepo();
  commitFile(repo, 'openspec/spec.md', '# spec', 'add spec');
  stripDocs(['openspec'], repo);
  assert.ok(!tracked(repo, 'openspec'));
  retrackDocs(['openspec'], repo);
  // staged now — ls-files shows it
  assert.ok(tracked(repo, 'openspec'));
  rmSync(repo, { recursive: true, force: true });
});
