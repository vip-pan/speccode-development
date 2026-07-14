import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_UNTRACKED, configPath, loadConfig, saveConfig, backupConfig, diffFields,
} from '../.claude/speccode/lib/config.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'sc-cfg-')); }

test('DEFAULT_UNTRACKED lists the permanent set', () => {
  assert.deepEqual(DEFAULT_UNTRACKED,
    ['.claude', '.agent', '.opencode', '.speccode', 'CLAUDE.md', 'AGENTS.md']);
});

test('save then load round-trips', () => {
  const dir = tmp();
  const cfg = { version: 1, trunk: 'master', remote: 'origin' };
  saveConfig(dir, cfg);
  assert.deepEqual(loadConfig(dir), cfg);
  rmSync(dir, { recursive: true, force: true });
});

test('loadConfig null when absent', () => {
  const dir = tmp();
  assert.equal(loadConfig(dir), null);
  rmSync(dir, { recursive: true, force: true });
});

test('backupConfig creates a .bak file and returns null when no config', () => {
  const dir = tmp();
  assert.equal(backupConfig(dir), null);
  saveConfig(dir, { version: 1 });
  const p = backupConfig(dir);
  assert.ok(p && existsSync(p));
  assert.ok(readdirSync(dir).some((f) => f.startsWith('config.json.bak.')));
  rmSync(dir, { recursive: true, force: true });
});

test('diffFields reports changed/added/removed top-level keys', () => {
  const d = diffFields(
    { trunk: 'master', pr_tool: 'gh', remote: 'origin' },
    { trunk: 'main', pr_tool: 'gh', display: { enabled: true } },
  );
  const byKey = Object.fromEntries(d.map((x) => [x.key, x]));
  assert.deepEqual(byKey.trunk, { key: 'trunk', old: 'master', new: 'main' });
  assert.ok('remote' in byKey && byKey.remote.new === undefined);
  assert.ok('display' in byKey && byKey.display.old === undefined);
  assert.ok(!('pr_tool' in byKey)); // unchanged omitted
});
