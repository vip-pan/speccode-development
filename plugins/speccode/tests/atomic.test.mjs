import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJson, writeJsonAtomic, writeTextAtomic } from '../lib/atomic.mjs';
import { nowIso } from '../lib/timestamp.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'speccode-atomic-')); }

test('readJson returns null for missing file', () => {
  const dir = tmp();
  assert.equal(readJson(join(dir, 'nope.json')), null);
  rmSync(dir, { recursive: true, force: true });
});

test('writeJsonAtomic then readJson round-trips', () => {
  const dir = tmp();
  const p = join(dir, 'sub', 'a.json');
  writeJsonAtomic(p, { x: 1, y: 'hi' });
  assert.deepEqual(readJson(p), { x: 1, y: 'hi' });
  rmSync(dir, { recursive: true, force: true });
});

test('writeJsonAtomic leaves no .tmp file behind', () => {
  const dir = tmp();
  writeJsonAtomic(join(dir, 'a.json'), { ok: true });
  const leftover = readdirSync(dir).filter((f) => f.includes('.tmp'));
  assert.deepEqual(leftover, []);
  rmSync(dir, { recursive: true, force: true });
});

test('writeJsonAtomic overwrites existing content fully', () => {
  const dir = tmp();
  const p = join(dir, 'a.json');
  writeFileSync(p, '{"old":true,"stale":123}');
  writeJsonAtomic(p, { fresh: 1 });
  assert.deepEqual(readJson(p), { fresh: 1 });
  rmSync(dir, { recursive: true, force: true });
});

test('nowIso is parseable ISO 8601', () => {
  const s = nowIso();
  assert.ok(!Number.isNaN(Date.parse(s)));
  assert.match(s, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test('writeTextAtomic writes text atomically', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sc-atomic-'));
  const p = join(dir, 'm.md');
  writeTextAtomic(p, 'hello\n');
  assert.equal(readFileSync(p, 'utf8'), 'hello\n');
  writeTextAtomic(p, 'world\n');
  assert.equal(readFileSync(p, 'utf8'), 'world\n');
  // 无临时文件残留
  assert.deepEqual(readdirSync(dir), ['m.md']);
  rmSync(dir, { recursive: true, force: true });
});
