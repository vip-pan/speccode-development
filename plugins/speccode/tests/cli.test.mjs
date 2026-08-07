import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';
import { parseArgs } from '../bin/speccode.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'bin', 'speccode.mjs');

function runCli(cwd, ...args) {
  const r = spawnSync('node', [BIN, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, json: JSON.parse(r.stdout.trim()) };
}

test('parseArgs handles --k v, --k=v, and bool flags', () => {
  const { verb, flags } = parseArgs(['reconcile', '--cwd', '/x', '--json=1', '--force']);
  assert.equal(verb, 'reconcile');
  assert.equal(flags.cwd, '/x');
  assert.equal(flags.json, '1');
  assert.equal(flags.force, true);
});

test('resolve-speccode-dir returns <gitroot>/.speccode', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'resolve-speccode-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.ok(json.speccodeDir.endsWith('/.speccode'));
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile verb on empty repo returns ok with empty arrays', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, '.speccode', 'state', 'features'), { recursive: true });
  const { code, json } = runCli(repo, 'reconcile', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.deepEqual(json.orphans, []);
  assert.deepEqual(json.conflicts, []);
  rmSync(repo, { recursive: true, force: true });
});

test('unknown verb returns ok:false and exit 1', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'bogus-verb', '--cwd', repo);
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('write-config reads stdin and persists atomically', () => {
  const repo = makeRepo();
  const cfg = JSON.stringify({ version: 1, trunk: 'master' });
  const w = spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: cfg, encoding: 'utf8' });
  assert.equal(w.status, 0);
  assert.ok(JSON.parse(w.stdout.trim()).ok);
  const r = runCli(repo, 'read-config', '--cwd', repo);
  assert.equal(r.json.config.trunk, 'master');
  rmSync(repo, { recursive: true, force: true });
});

test('write-state then feature-progress reflects it', () => {
  const repo = makeRepo();
  const state = JSON.stringify({
    feature_branch: 'feature/demo', status: 'in_progress',
    worktrees: { 'worktree-demo': { status: 'completed', completed_at: '2026-07-10T00:00:00.000Z' } },
  });
  const w = spawnSync('node',
    [BIN, 'write-state', '--cwd', repo, '--branch', 'feature/demo', '--json-stdin'],
    { cwd: repo, input: state, encoding: 'utf8' });
  assert.equal(w.status, 0);
  const r = runCli(repo, 'feature-progress', '--cwd', repo, '--branch', 'feature/demo');
  assert.equal(r.json.total, 1);
  assert.equal(r.json.completed, 1);
  rmSync(repo, { recursive: true, force: true });
});

test('resolve-speccode-dir inside a linked worktree resolves to the main repo .speccode', () => {
  const repo = realpathSync(makeRepo());
  const wtPath = join(repo, '.claude', 'worktrees', 'wt-probe');
  mkdirSync(join(repo, '.claude', 'worktrees'), { recursive: true });
  const add = spawnSync('git',
    ['worktree', 'add', wtPath, '-b', 'worktree-probe', 'HEAD'],
    { cwd: repo, encoding: 'utf8' });
  assert.equal(add.status, 0, add.stderr);

  const { code, json } = runCli(wtPath, 'resolve-speccode-dir', '--cwd', wtPath);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.equal(json.speccodeDir, join(repo, '.speccode'));

  spawnSync('git', ['worktree', 'remove', wtPath, '--force'], { cwd: repo, encoding: 'utf8' });
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile without --advance-pr leaves pr_open worktree untouched', () => {
  const repo = makeRepo();
  const cfg = JSON.stringify({ version: 1, pr_tool: 'gh' });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: cfg, encoding: 'utf8' });
  const state = JSON.stringify({
    feature_branch: 'feature/p', status: 'in_progress',
    worktrees: { 'worktree-p': { status: 'pr_open', pr_number: 42 } },
  });
  spawnSync('node', [BIN, 'write-state', '--cwd', repo, '--branch', 'feature/p', '--json-stdin'],
    { cwd: repo, input: state, encoding: 'utf8' });

  const { code, json } = runCli(repo, 'reconcile', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.deepEqual(json.advanced, []);
  const after = runCli(repo, 'feature-progress', '--cwd', repo, '--branch', 'feature/p');
  assert.equal(after.json.worktrees['worktree-p'].status, 'pr_open');
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile with --advance-pr but pr_tool=none does not crash and does not advance', () => {
  const repo = makeRepo();
  const cfg = JSON.stringify({ version: 1, pr_tool: 'none' });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: cfg, encoding: 'utf8' });
  const state = JSON.stringify({
    feature_branch: 'feature/p', status: 'in_progress',
    worktrees: { 'worktree-p': { status: 'pr_open', pr_number: 42 } },
  });
  spawnSync('node', [BIN, 'write-state', '--cwd', repo, '--branch', 'feature/p', '--json-stdin'],
    { cwd: repo, input: state, encoding: 'utf8' });

  const { code, json } = runCli(repo, 'reconcile', '--cwd', repo, '--advance-pr');
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.deepEqual(json.advanced, []);
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile with --advance-pr and no config at all does not crash', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'reconcile', '--cwd', repo, '--advance-pr');
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.deepEqual(json.advanced, []);
  rmSync(repo, { recursive: true, force: true });
});

test('query-pr requires --number', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'query-pr', '--cwd', repo);
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('query-pr returns ok:false when config missing', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'query-pr', '--cwd', repo, '--number', '42');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('query-pr returns ok:false when pr_tool is none', () => {
  const repo = makeRepo();
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 1, pr_tool: 'none' }), encoding: 'utf8' });
  const { code, json } = runCli(repo, 'query-pr', '--cwd', repo, '--number', '42');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('write-config without --json-stdin returns ok:false and exit 1', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'write-config', '--cwd', repo],
    { cwd: repo, input: JSON.stringify({ version: 1 }), encoding: 'utf8' });
  assert.equal(r.status, 1);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, false);
  assert.ok(json.error.includes('--json-stdin'));
  rmSync(repo, { recursive: true, force: true });
});

test('write-state without --json-stdin returns ok:false and exit 1', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'write-state', '--cwd', repo, '--branch', 'feature/x'],
    { cwd: repo, input: JSON.stringify({}), encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout.trim()).ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile uses config worktree_prefix when present', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, '.speccode', 'state', 'features'), { recursive: true });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 1, worktree_prefix: 'wt-' }), encoding: 'utf8' });
  // real branches: feature/p with a commit, then wt-p on top of it
  const co1 = spawnSync('git', ['checkout', '-b', 'feature/p'], { cwd: repo, encoding: 'utf8' });
  assert.equal(co1.status, 0, co1.stderr);
  commitFile(repo, 'p.txt', 'p\n', 'feature p commit');
  const state = JSON.stringify({ feature_branch: 'feature/p', status: 'in_progress', worktrees: {} });
  spawnSync('node', [BIN, 'write-state', '--cwd', repo, '--branch', 'feature/p', '--json-stdin'],
    { cwd: repo, input: state, encoding: 'utf8' });
  const co2 = spawnSync('git', ['checkout', '-b', 'wt-p'], { cwd: repo, encoding: 'utf8' });
  assert.equal(co2.status, 0, co2.stderr);
  commitFile(repo, 'wt.txt', 'wt\n', 'wt-p commit');

  const { code, json } = runCli(repo, 'reconcile', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.deepEqual(json.conflicts, []);
  assert.deepEqual(json.orphans, []);
  // wt-p only matches prefix 'wt-'; with the default 'worktree-' it would be ignored
  const after = runCli(repo, 'feature-progress', '--cwd', repo, '--branch', 'feature/p');
  assert.equal(after.json.worktrees['wt-p'].status, 'in_progress');
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile treats empty-string worktree_prefix as the default prefix', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, '.speccode', 'state', 'features'), { recursive: true });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 1, worktree_prefix: '' }), encoding: 'utf8' });
  // HEAD on a non-worktree branch: with prefix '' every branch matches startsWith(''),
  // so feature/p would be bogusly self-registered as its own worktree; the default
  // 'worktree-' fallback must filter it out instead.
  const co = spawnSync('git', ['checkout', '-b', 'feature/p'], { cwd: repo, encoding: 'utf8' });
  assert.equal(co.status, 0, co.stderr);
  commitFile(repo, 'p.txt', 'p\n', 'feature p commit');
  const state = JSON.stringify({ feature_branch: 'feature/p', status: 'in_progress', worktrees: {} });
  spawnSync('node', [BIN, 'write-state', '--cwd', repo, '--branch', 'feature/p', '--json-stdin'],
    { cwd: repo, input: state, encoding: 'utf8' });

  const { code, json } = runCli(repo, 'reconcile', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.deepEqual(json.orphans, []);
  assert.deepEqual(json.conflicts, []);
  const after = runCli(repo, 'feature-progress', '--cwd', repo, '--branch', 'feature/p');
  assert.deepEqual(after.json.worktrees, {});
  rmSync(repo, { recursive: true, force: true });
});

test('detect-knowledge-tools returns a tools array', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'detect-knowledge-tools', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.ok(Array.isArray(json.tools));
  for (const t of json.tools) {
    assert.ok(t.id && t.kind && t.evidence);
    assert.ok(['plugin', 'mcp', 'cli', 'project-dir'].includes(t.kind));
  }
  rmSync(repo, { recursive: true, force: true });
});

test('detect-knowledge-tools from a subdirectory resolves against the main repo root', () => {
  const repo = makeRepo();
  const subdir = join(repo, 'sub', 'dir');
  mkdirSync(subdir, { recursive: true });

  const first = runCli(subdir, 'detect-knowledge-tools', '--cwd', subdir);
  assert.equal(first.code, 0);
  assert.ok(first.json.ok);
  assert.ok(Array.isArray(first.json.tools));

  // .mcp.json lives at the repo ROOT; running from a subdir must still see it
  writeFileSync(join(repo, '.mcp.json'), JSON.stringify({ mcpServers: { codegraph: {} } }));
  const second = runCli(subdir, 'detect-knowledge-tools', '--cwd', subdir);
  assert.equal(second.code, 0);
  assert.ok(second.json.ok);
  assert.ok(second.json.tools.some((t) => t.id === 'codegraph'
    && t.kind === 'mcp' && t.evidence === '.mcp.json:codegraph'),
  `expected codegraph mcp hit, got ${JSON.stringify(second.json.tools)}`);
  rmSync(repo, { recursive: true, force: true });
});

test('resolve-worktree-dir returns default when config lacks the key', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'resolve-worktree-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual({ dir: json.dir, source: json.source },
    { dir: '.claude/worktrees', source: 'default' });
  rmSync(repo, { recursive: true, force: true });
});

test('resolve-worktree-dir returns config value when present', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 2, worktree_dir: '.wt' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  const { code, json } = runCli(repo, 'resolve-worktree-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual({ dir: json.dir, source: json.source }, { dir: '.wt', source: 'config' });
  rmSync(repo, { recursive: true, force: true });
});
