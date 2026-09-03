import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync, realpathSync, writeFileSync, readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { makeRepo, commitFile } from './helpers/tmprepo.mjs';
import { writeJsonAtomic } from '../lib/atomic.mjs';
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

test('reconcile treats unregistered worktrees under config worktree_dir as orphans', () => {
  const repo = realpathSync(makeRepo());
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 2, worktree_dir: wtdir }), encoding: 'utf8' });
  // unregistered (no state entry): half-created worktrees are reconcile's own problem
  const add = spawnSync('git', ['worktree', 'add', join(wtdir, 'stray'), '-b', 'feature/stray'],
    { cwd: repo, encoding: 'utf8' });
  assert.equal(add.status, 0, add.stderr);

  const { code, json } = runCli(repo, 'reconcile', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.deepEqual(json.conflicts, []);
  assert.ok(json.orphans.length === 1 && json.orphans[0].includes('stray'),
    `expected the stray worktree as orphan, got ${JSON.stringify(json.orphans)}`);
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile ignores legacy config worktree_prefix', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, '.speccode', 'state', 'features'), { recursive: true });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 1, worktree_prefix: '' }), encoding: 'utf8' });
  // v3 reconcile ignores the legacy worktree_prefix field entirely; HEAD on a
  // non-worktree branch must not be bogusly self-registered as its own worktree.
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

test('detect-code-intel-tools returns a tools array', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'detect-code-intel-tools', '--cwd', repo);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.ok(Array.isArray(json.tools));
  for (const t of json.tools) {
    assert.ok(t.id);
    assert.equal(typeof t.available.value, 'boolean');
    assert.equal(typeof t.integrated.value, 'boolean');
  }
  rmSync(repo, { recursive: true, force: true });
});

test('detect-code-intel-tools from a subdirectory resolves against the main repo root', () => {
  const repo = makeRepo();
  const subdir = join(repo, 'sub', 'dir');
  mkdirSync(subdir, { recursive: true });

  const first = runCli(subdir, 'detect-code-intel-tools', '--cwd', subdir);
  assert.equal(first.code, 0);
  assert.ok(first.json.ok);
  assert.ok(Array.isArray(first.json.tools));

  // .mcp.json lives at the repo ROOT; running from a subdir must still see it
  writeFileSync(join(repo, '.mcp.json'), JSON.stringify({ mcpServers: { codegraph: {} } }));
  const second = runCli(subdir, 'detect-code-intel-tools', '--cwd', subdir);
  assert.equal(second.code, 0);
  assert.ok(second.json.ok);
  assert.ok(second.json.tools.some((t) => t.id === 'codegraph'
    && t.available.value === true
    && t.integrated.value === true
    && t.integrated.evidence === '.mcp.json:codegraph'),
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

test('sdd-workspace requires --plan', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'sdd-workspace', '--cwd', repo);
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('sdd-workspace rejects a bare --plan flag', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'sdd-workspace', '--cwd', repo, '--plan');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  assert.ok(json.error.includes('--plan'));
  rmSync(repo, { recursive: true, force: true });
});

test('task-brief rejects a bare --task flag (never silently task 1)', () => {
  const repo = makeRepo();
  const plan = join(repo, 'p.md');
  writeFileSync(plan, '### Task 1: A\nbody-1\n');
  const { code, json } = runCli(repo, 'task-brief', '--cwd', repo, '--plan', plan, '--task');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  assert.ok(json.error.includes('--task'));
  rmSync(repo, { recursive: true, force: true });
});

test('task-brief extracts a task into the workspace', () => {
  const repo = makeRepo();
  const plan = join(repo, 'p.md');
  writeFileSync(plan, '### Task 1: A\nbody-1\n\n### Task 10: B\nbody-10\n');
  const { code, json } = runCli(repo, 'task-brief', '--cwd', repo, '--plan', plan, '--task', '1');
  assert.equal(code, 0);
  assert.ok(json.ok);
  const content = readFileSync(json.path, 'utf8');
  assert.ok(content.includes('body-1'));
  assert.ok(!content.includes('body-10'));
  rmSync(repo, { recursive: true, force: true });
});

test('review-package writes a range-named diff file', () => {
  const repo = makeRepo();
  const plan = join(repo, 'p.md');
  writeFileSync(plan, '# p');
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  spawnSync('git', ['checkout', '-b', 'side'], { cwd: repo });
  writeFileSync(join(repo, 'x.txt'), 'x');
  spawnSync('git', ['add', '.'], { cwd: repo });
  spawnSync('git', ['commit', '-m', 'x'], { cwd: repo });
  const tip = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  const { code, json } = runCli(repo, 'review-package', '--cwd', repo,
    '--plan', plan, '--base', head, '--head', tip);
  assert.equal(code, 0);
  assert.ok(json.ok);
  assert.ok(json.path.includes('review-'));
  assert.ok(readFileSync(json.path, 'utf8').includes('x.txt'));
  rmSync(repo, { recursive: true, force: true });
});

test('sdd-workspace inside a linked worktree resolves to the worktree root', () => {
  const repo = realpathSync(makeRepo());
  const wtPath = join(repo, '.claude', 'worktrees', 'wt-sdd');
  mkdirSync(join(repo, '.claude', 'worktrees'), { recursive: true });
  const add = spawnSync('git', ['worktree', 'add', wtPath, '-b', 'worktree-sdd', 'HEAD'],
    { cwd: repo, encoding: 'utf8' });
  assert.equal(add.status, 0, add.stderr);
  const plan = join(wtPath, 'p.md');
  writeFileSync(plan, '# p');
  const { code, json } = runCli(wtPath, 'sdd-workspace', '--cwd', wtPath, '--plan', plan);
  assert.equal(code, 0);
  // realpath 归一:macOS 上 tmpdir 是 /var→/private/var 符号链接
  assert.equal(realpathSync(json.dir), join(realpathSync(wtPath), '.speccode', 'sdd', 'p'));
  spawnSync('git', ['worktree', 'remove', wtPath, '--force'], { cwd: repo, encoding: 'utf8' });
  rmSync(repo, { recursive: true, force: true });
});

test('run-hook without config no-ops and exits 0', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'run-hook', '--cwd', repo, '--event', 'onSynced'],
    { cwd: repo, input: '{"command":"syncing"}', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, true);
  assert.equal(json.hook.ran, false);
  assert.equal(json.hook.ok, true);
  rmSync(repo, { recursive: true, force: true });
});

test('run-hook warns on unknown event and exits 0', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'run-hook', '--cwd', repo, '--event', 'onX'],
    { cwd: repo, input: '', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, true);
  assert.ok(json.hook.warning.includes('onX'));
  rmSync(repo, { recursive: true, force: true });
});

test('run-hook executes configured hook with envelope payload', () => {
  const repo = makeRepo();
  const log = join(repo, 'hook.log');
  const cfg = JSON.stringify({ version: 2, hooks: { onSynced: `cat >> ${log}` } });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: cfg, encoding: 'utf8' });
  const r = spawnSync('node', [BIN, 'run-hook', '--cwd', repo, '--event', 'onSynced'],
    { cwd: repo, input: '{"command":"syncing","feature_branch":"feature/x"}', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.deepEqual(json.hook, { ran: true, ok: true });
  const line = JSON.parse(readFileSync(log, 'utf8').trim());
  assert.equal(line.event, 'onSynced');
  assert.equal(line.command, 'syncing');
  assert.equal(line.feature_branch, 'feature/x');
  assert.equal(line.repo_root, realpathSync(repo));
  assert.ok(!Number.isNaN(Date.parse(line.timestamp)));
  rmSync(repo, { recursive: true, force: true });
});

test('run-hook reports hook failure in JSON and still exits 0', () => {
  const repo = makeRepo();
  const cfg = JSON.stringify({ version: 2, hooks: { onArchived: 'exit 3' } });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: cfg, encoding: 'utf8' });
  const r = spawnSync('node', [BIN, 'run-hook', '--cwd', repo, '--event', 'onArchived'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, true);
  assert.equal(json.hook.ran, true);
  assert.equal(json.hook.ok, false);
  assert.equal(json.hook.exitCode, 3);
  rmSync(repo, { recursive: true, force: true });
});

// spawn with stdin written only after a delay: spawnSync cannot express this.
function runCliDelayedStdin(cwd, args, input, delayMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('node', [BIN, ...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
    setTimeout(() => {
      child.stdin.write(input);
      child.stdin.end();
    }, delayMs);
  });
}

test('run-hook survives a delayed stdin producer (no EAGAIN race)', async () => {
  const repo = makeRepo();
  const log = join(repo, 'hook.log');
  const cfg = JSON.stringify({ version: 2, hooks: { onSynced: `cat >> ${log}` } });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: cfg, encoding: 'utf8' });
  // The producer needs ~300ms to start writing; merely touching process.stdin
  // in the CLI would flip fd 0 to non-blocking and readFileSync(0) would throw
  // EAGAIN before the fragment arrives, silently dropping it.
  const r = await runCliDelayedStdin(repo,
    ['run-hook', '--cwd', repo, '--event', 'onSynced'],
    '{"command":"syncing"}', 300);
  assert.equal(r.code, 0, r.stderr);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, true);
  assert.deepEqual(json.hook, { ran: true, ok: true });
  const line = JSON.parse(readFileSync(log, 'utf8').trim());
  assert.equal(line.command, 'syncing');
  rmSync(repo, { recursive: true, force: true });
});

test('run-hook from a subdirectory runs the hook at the main repo root', () => {
  const repo = realpathSync(makeRepo());
  const subdir = join(repo, 'sub', 'dir');
  mkdirSync(subdir, { recursive: true });
  const log = join(repo, 'hook.log');
  const cfg = JSON.stringify({ version: 2, hooks: { onSynced: `pwd >> ${log}` } });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: cfg, encoding: 'utf8' });
  const r = spawnSync('node', [BIN, 'run-hook', '--cwd', '.', '--event', 'onSynced'],
    { cwd: subdir, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout.trim());
  assert.deepEqual(json.hook, { ran: true, ok: true });
  const logged = readFileSync(log, 'utf8').trim();
  assert.equal(realpathSync(logged), realpathSync(repo));
  rmSync(repo, { recursive: true, force: true });
});

test('run-hook with invalid JSON stdin still exits 0 and surfaces a warning', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'run-hook', '--cwd', repo, '--event', 'onSynced'],
    { cwd: repo, input: '{not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, true);
  assert.equal(json.hook.ran, false);
  assert.equal(json.hook.ok, true);
  assert.ok(json.hook.warning.includes('stdin fragment ignored'));
  rmSync(repo, { recursive: true, force: true });
});

test('read-memory returns null when absent', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/x');
  assert.equal(code, 0);
  assert.deepEqual(json, { ok: true, memory: null });
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory then read-memory round-trips (append mode)', () => {
  const repo = makeRepo();
  const w1 = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'append', content: 'line1\n' }), encoding: 'utf8' });
  assert.equal(w1.status, 0);
  const w2 = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'append', content: 'line2\n' }), encoding: 'utf8' });
  assert.equal(w2.status, 0);
  const r = runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/x');
  assert.equal(r.json.memory, 'line1\nline2\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory without --json-stdin returns ok:false', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout.trim()).ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory rejects invalid mode', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'upsert', content: 'x' }), encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout.trim()).ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('read-memory inside a linked worktree resolves to the main repo memory', () => {
  const repo = realpathSync(makeRepo());
  spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'shared\n' }), encoding: 'utf8' });
  const wtPath = join(repo, '.claude', 'worktrees', 'wt-mem');
  mkdirSync(join(repo, '.claude', 'worktrees'), { recursive: true });
  const add = spawnSync('git', ['worktree', 'add', wtPath, '-b', 'worktree-mem', 'HEAD'],
    { cwd: repo, encoding: 'utf8' });
  assert.equal(add.status, 0, add.stderr);
  const r = runCli(wtPath, 'read-memory', '--cwd', wtPath, '--branch', 'feature/x');
  assert.equal(r.json.memory, 'shared\n');
  spawnSync('git', ['worktree', 'remove', wtPath, '--force'], { cwd: repo, encoding: 'utf8' });
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory rejects an invalid branch name', () => {
  const repo = makeRepo();
  const r = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'worktree-typo', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'append', content: 'x\n' }), encoding: 'utf8' });
  assert.equal(r.status, 1);
  const json = JSON.parse(r.stdout.trim());
  assert.equal(json.ok, false);
  assert.ok(json.error.includes('invalid branch'));
  rmSync(repo, { recursive: true, force: true });
});

test('read-memory rejects an invalid branch name', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'worktree-typo');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory accepts the _exploring sentinel branch', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', '_exploring', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'explored\n' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  assert.ok(JSON.parse(w.stdout.trim()).ok);
  const r = runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_exploring');
  assert.equal(r.json.memory, 'explored\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory accepts the _knowledge sentinel branch', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', '_knowledge', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'distilled\n' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  assert.ok(JSON.parse(w.stdout.trim()).ok);
  const r = runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_knowledge');
  assert.equal(r.json.memory, 'distilled\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory accepts an _exploring topic branch', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', '_exploring/payment-rework', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'append', content: 'topic notes\n' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  const r = runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_exploring/payment-rework');
  assert.equal(r.json.memory, 'topic notes\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory rejects an invalid _exploring topic', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', '_exploring/Bad_Topic', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'x' }), encoding: 'utf8' });
  assert.equal(w.status, 1);
  assert.ok(JSON.parse(w.stdout.trim()).error.includes('invalid branch'));
  rmSync(repo, { recursive: true, force: true });
});

test('list-memory lists only _exploring topics', () => {
  const repo = makeRepo();
  for (const branch of ['_exploring/b-p1', '_exploring/a', 'feature/c']) {
    const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', branch, '--json-stdin'],
      { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'x\n' }), encoding: 'utf8' });
    assert.equal(w.status, 0);
  }
  const r = runCli(repo, 'list-memory', '--cwd', repo);
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.json.topics, ['_exploring/a', '_exploring/b-p1']);
  rmSync(repo, { recursive: true, force: true });
});

test('rename-memory adopts an exploring topic into a feature memory', () => {
  const repo = makeRepo();
  spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', '_exploring/payment-rework', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content: 'conclusions\n' }), encoding: 'utf8' });
  const r = spawnSync('node', [BIN, 'rename-memory', '--cwd', repo, '--branch', '_exploring/payment-rework',
    '--to', 'feature/payment-rework', '--json-stdin'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.ok(JSON.parse(r.stdout.trim()).ok);
  assert.equal(runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/payment-rework').json.memory, 'conclusions\n');
  assert.equal(runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_exploring/payment-rework').json.memory, null);
  rmSync(repo, { recursive: true, force: true });
});

test('rename-memory refuses when the target already exists', () => {
  const repo = makeRepo();
  const write = (branch, content) => spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', branch, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'replace', content }), encoding: 'utf8' });
  write('_exploring/a', 'exploring\n');
  write('feature/b', 'existing\n');
  const r = spawnSync('node', [BIN, 'rename-memory', '--cwd', repo, '--branch', '_exploring/a', '--to', 'feature/b', '--json-stdin'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.ok(JSON.parse(r.stdout.trim()).error.includes('already exists'));
  assert.equal(runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_exploring/a').json.memory, 'exploring\n');
  assert.equal(runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/b').json.memory, 'existing\n');
  rmSync(repo, { recursive: true, force: true });
});

test('read-memory accepts the _knowledge sentinel branch (returns null when absent)', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'read-memory', '--cwd', repo, '--branch', '_knowledge');
  assert.equal(code, 0);
  assert.deepEqual(json, { ok: true, memory: null });
  rmSync(repo, { recursive: true, force: true });
});

// Form anchor for the command prose: multi-line JSON with \n escapes arrives via
// stdin exactly like a quoted heredoc (echo '<json>' would mangle it under zsh).
test('write-memory round-trips multi-line content byte-for-byte via stdin (heredoc form)', () => {
  const repo = makeRepo();
  const content = '# 摘要\n- 决策: 用 heredoc 传 JSON\n- 进度: task 3 done\n';
  const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: `${JSON.stringify({ mode: 'replace', content })}\n`, encoding: 'utf8' });
  assert.equal(w.status, 0);
  assert.ok(JSON.parse(w.stdout.trim()).ok);
  const r = runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/x');
  assert.equal(r.json.memory, content);
  rmSync(repo, { recursive: true, force: true });
});

test('write-memory round-trips content containing single quotes', () => {
  const repo = makeRepo();
  const content = "user's decision: don't split the repo\n";
  const w = spawnSync('node', [BIN, 'write-memory', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ mode: 'append', content }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  assert.ok(JSON.parse(w.stdout.trim()).ok);
  const r = runCli(repo, 'read-memory', '--cwd', repo, '--branch', 'feature/x');
  assert.equal(r.json.memory, content);
  rmSync(repo, { recursive: true, force: true });
});

test('resolve-worktree-dir: 仓库外 worktree_dir → ignore.scope outside(无 fatal)', () => {
  const repo = makeRepo();
  const outside = mkdtempSync(join(tmpdir(), 'speccode-outside-'));
  const w = spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 2, worktree_dir: outside }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  const { code, json } = runCli(repo, 'resolve-worktree-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.dir, outside);
  assert.deepEqual(json.ignore, { scope: 'outside' });
  rmSync(outside, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

test('resolve-worktree-dir: 仓库内未忽略 → ignore inside+ignored:false', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 2, worktree_dir: '.wt' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  const { code, json } = runCli(repo, 'resolve-worktree-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual(json.ignore, { scope: 'inside', ignored: false });
  rmSync(repo, { recursive: true, force: true });
});

test('resolve-worktree-dir: 仓库内已忽略 → ignore inside+ignored:true', () => {
  const repo = makeRepo();
  commitFile(repo, '.gitignore', '.wt/\n', 'ignore .wt');
  const w = spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 2, worktree_dir: '.wt' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  const { code, json } = runCli(repo, 'resolve-worktree-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual(json.ignore, { scope: 'inside', ignored: true });
  rmSync(repo, { recursive: true, force: true });
});

test('read-knowledge --index returns content and exists flag', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'business'), { recursive: true });
  writeFileSync(join(root, '_index.md'), '# 知识索引\n');
  writeFileSync(join(root, 'business', 'domain.md'), '# 领域知识\n');
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo, '--index');
  assert.equal(code, 0);
  assert.equal(json.exists, true);
  assert.equal(json.content, '# 知识索引\n');
  rmSync(repo, { recursive: true, force: true });
});

test('read-knowledge --topic resolves by basename', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'business'), { recursive: true });
  writeFileSync(join(root, 'business', 'domain.md'), '# 领域知识\n');
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo, '--topic', 'domain');
  assert.equal(code, 0);
  assert.equal(json.exists, true);
  assert.equal(json.path, 'business/domain.md');
  assert.equal(json.content, '# 领域知识\n');
  rmSync(repo, { recursive: true, force: true });
});

test('read-knowledge on project without knowledge dir returns exists false, exit 0', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo, '--index');
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.exists, false);
  assert.equal(json.content, null);
  rmSync(repo, { recursive: true, force: true });
});

test('read-knowledge without flags lists files and index', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'business'), { recursive: true });
  writeFileSync(join(root, 'business', 'domain.md'), '# 领域知识\n');
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual(json.files, ['business/domain.md']);
  assert.equal(json.index, null);
  rmSync(repo, { recursive: true, force: true });
});

function runCliStdin(repo, ...args) {
  const input = args.pop();
  const r = spawnSync('node', [BIN, ...args], { cwd: repo, encoding: 'utf8', input });
  return { code: r.status, json: JSON.parse(r.stdout.trim()) };
}

test('write-knowledge replace writes atomically via stdin JSON', () => {
  const repo = makeRepo();
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'business/domain.md', '--json-stdin',
    JSON.stringify({ mode: 'replace', content: '# 领域知识\n' }));
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.path, 'business/domain.md');
  assert.equal(readFileSync(join(repo, 'speccode', 'knowledge', 'business', 'domain.md'), 'utf8'), '# 领域知识\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge append-hand appends hand-written section', () => {
  const repo = makeRepo();
  const p = join(repo, 'speccode', 'knowledge', 'development', 'pitfalls.md');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, '# 坑\n');
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'append-hand', content: '## 手写\n新坑一条\n' }));
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(readFileSync(p, 'utf8'), '# 坑\n## 手写\n新坑一条\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge replace-distilled migrates legacy markers and rebuilds only distilled blocks', () => {
  const repo = makeRepo();
  const p = join(repo, 'speccode', 'knowledge', 'development', 'pitfalls.md');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, 'hand A\n<!-- promoted-from: cap/old -->\nold body\n<!-- /promoted -->\nhand B\n');
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'replace-distilled', blocks: [{ source: 'cap/old', body: 'new body' }] }));
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(readFileSync(p, 'utf8'), 'hand A\nhand B\n\n<!-- distilled-from: cap/old -->\nnew body\n<!-- /distilled -->\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge replace-hand replaces hand region, keeps distilled blocks', () => {
  const repo = makeRepo();
  const p = join(repo, 'speccode', 'knowledge', 'development', 'pitfalls.md');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, 'hand A\n<!-- distilled-from: cap/x -->\nbody\n<!-- /distilled -->\nhand B\n');
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'replace-hand', content: '## 手写\n整理后内容\n' }));
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(readFileSync(p, 'utf8'), '## 手写\n整理后内容\n\n<!-- distilled-from: cap/x -->\nbody\n<!-- /distilled -->\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge replace-hand rejects missing content', () => {
  const repo = makeRepo();
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'replace-hand' }));
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  assert.match(json.error, /replace-hand requires content/);
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge rejects unsafe rel with exit 1', () => {
  const repo = makeRepo();
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', '../evil.md', '--json-stdin',
    JSON.stringify({ mode: 'replace', content: 'x' }));
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge requires --json-stdin', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'write-knowledge', '--cwd', repo, '--rel', 'a.md');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('read-knowledge --topic --blocks parses legacy promoted markers', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'development'), { recursive: true });
  writeFileSync(join(root, 'development', 'pitfalls.md'), 'hand\n<!-- promoted-from: archive/a/ -->\nbody\n<!-- /promoted -->\n');
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo, '--topic', 'pitfalls', '--blocks');
  assert.equal(code, 0);
  assert.equal(json.exists, true);
  assert.deepEqual(json.blocks, [{ source: 'archive/a/', body: 'body' }]);
  rmSync(repo, { recursive: true, force: true });
});

test('read-knowledge --topic --blocks parses current distilled markers', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'development'), { recursive: true });
  writeFileSync(join(root, 'development', 'pitfalls.md'), 'hand\n<!-- distilled-from: archive/a/ -->\nbody\n<!-- /distilled -->\n');
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo, '--topic', 'pitfalls', '--blocks');
  assert.equal(code, 0);
  assert.equal(json.exists, true);
  assert.deepEqual(json.blocks, [{ source: 'archive/a/', body: 'body' }]);
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge mode index renders and writes _index.md', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-knowledge', '--cwd', repo, '--rel', '_index.md', '--json-stdin'],
    { cwd: repo, encoding: 'utf8', input: JSON.stringify({ mode: 'index', entries: [{ section: '业务方向', items: [{ title: '领域知识', file: 'business/domain.md', summary: '术语' }] }] }) });
  assert.equal(w.status, 0);
  assert.equal(JSON.parse(w.stdout.trim()).ok, true);
  assert.equal(readFileSync(join(repo, 'speccode', 'knowledge', '_index.md'), 'utf8'), '# 知识索引\n\n## 业务方向\n- 领域知识 → business/domain.md:术语\n');
  rmSync(repo, { recursive: true, force: true });
});

test('write-knowledge --rel with no value returns a clean error and writes no junk file', () => {
  const repo = makeRepo();
  // `--rel` as the trailing flag with nothing after it parses to boolean
  // `true` (parseArgs), not a missing value; `!rel` doesn't catch that.
  const { code, json } = runCli(repo, 'write-knowledge', '--cwd', repo, '--json-stdin', '--rel');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  assert.ok(!existsSync(join(repo, 'speccode', 'knowledge', 'true')));
  rmSync(repo, { recursive: true, force: true });
});

test('read-knowledge --topic with no value returns a clean error, not a TypeError leak', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'read-knowledge', '--cwd', repo, '--topic');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  assert.ok(!/is not a function/.test(json.error || ''), `expected a clean error, got: ${json.error}`);
  rmSync(repo, { recursive: true, force: true });
});

test('read-consumed-archives reports consumed/unconsumed and bootstrap flag', () => {
  const repo = makeRepo();
  const kroot = join(repo, 'speccode', 'knowledge');
  const aroot = join(repo, 'speccode', 'archive');
  mkdirSync(kroot, { recursive: true });
  mkdirSync(join(aroot, '2026-08-10-foo'), { recursive: true });
  mkdirSync(join(aroot, '2026-08-11-bar'), { recursive: true });
  writeFileSync(join(kroot, '_distilled.meta.json'), JSON.stringify({ consumed_archives: ['2026-08-10-foo'] }));
  const { code, json } = runCli(repo, 'read-consumed-archives', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual(json.consumed, ['2026-08-10-foo']);
  assert.deepEqual(json.unconsumed, ['2026-08-11-bar']);
  // present = 盘上归档包全集(stale 判定的数据源:consumed 里指向已删包的条目
  // 不在 present 中 → 其 carry-forward 块判 stale)。
  assert.deepEqual(json.present, ['2026-08-10-foo', '2026-08-11-bar']);
  assert.equal(json.bootstrap, false);
  rmSync(repo, { recursive: true, force: true });
});

test('read-consumed-archives bootstrap when sidecar missing', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, 'speccode', 'archive', '2026-08-10-foo'), { recursive: true });
  const { code, json } = runCli(repo, 'read-consumed-archives', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual(json.consumed, []);
  assert.deepEqual(json.unconsumed, ['2026-08-10-foo']);
  assert.deepEqual(json.present, ['2026-08-10-foo']);
  assert.equal(json.bootstrap, true);
  rmSync(repo, { recursive: true, force: true });
});

test('write-consumed-archives reads stdin and merges atomically', () => {
  const repo = makeRepo();
  const kroot = join(repo, 'speccode', 'knowledge');
  mkdirSync(kroot, { recursive: true });
  writeFileSync(join(kroot, '_distilled.meta.json'), JSON.stringify({ consumed_archives: ['a'] }));
  const input = JSON.stringify({ add: ['b', 'a'] });
  const w = spawnSync('node', [BIN, 'write-consumed-archives', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input, encoding: 'utf8' });
  assert.equal(w.status, 0);
  const out = JSON.parse(w.stdout.trim());
  assert.ok(out.ok);
  assert.deepEqual(out.consumed, ['a', 'b']);
  const file = JSON.parse(readFileSync(join(kroot, '_distilled.meta.json'), 'utf8'));
  assert.deepEqual(file.consumed_archives, ['a', 'b']);
  rmSync(repo, { recursive: true, force: true });
});

test('write-consumed-archives without --json-stdin fails', () => {
  const repo = makeRepo();
  const { code, json } = runCli(repo, 'write-consumed-archives', '--cwd', repo);
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  rmSync(repo, { recursive: true, force: true });
});

test('tick-task verb ticks plan checkboxes and returns ticked/already', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, [
    '# P', '', '### Task 1: A', '', '- [ ] s1', '', '```js', '- [ ] fenced', '```', '',
    '- [ ] s2', '', '### Task 2: B', '', '- [ ] s3', '',
  ].join('\n'));
  const { code, json } = runCli(repo, 'tick-task', '--cwd', repo, '--plan', plan, '--task', '1');
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.task, 1);
  assert.equal(json.ticked.length, 2);
  const after = readFileSync(plan, 'utf8');
  assert.ok(after.includes('- [x] s1'));
  assert.ok(after.includes('- [ ] fenced'));
  assert.ok(after.includes('- [ ] s3'));
  rmSync(repo, { recursive: true, force: true });
});

test('tick-task verb errors when task N absent', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, '# P\n\n### Task 1: A\n\n- [ ] s1\n');
  const { code, json } = runCli(repo, 'tick-task', '--cwd', repo, '--plan', plan, '--task', '9');
  assert.equal(code, 1);
  assert.equal(json.ok, false);
  assert.match(json.error, /task 9 not found/);
  rmSync(repo, { recursive: true, force: true });
});

test('executing-plans.md documents the tick-task completion step', () => {
  const md = readFileSync(join(__dirname, '..', 'commands', 'executing-plans.md'), 'utf8');
  assert.ok(md.includes('tick-task'), 'executing-plans must reference tick-task verb');
  assert.ok(md.includes('docs(speccode): tick task'), 'executing-plans must commit the tick');
  // 幂等路径:ticked 为空时不能硬跑 git commit(nothing to commit → exit 1)
  assert.ok(/`ticked`[^\n]*为空[\s\S]{0,120}跳过 commit/.test(md), 'must skip the commit when ticked is empty');
});

test('subagent-driven-development.md documents the tick-task completion step', () => {
  const md = readFileSync(join(__dirname, '..', 'commands', 'subagent-driven-development.md'), 'utf8');
  assert.ok(md.includes('tick-task'), 'subagent-driven-development must reference tick-task');
  assert.ok(md.includes('docs(speccode): tick task'), 'must commit the tick');
  // 时序约束:勾选须在审查通过后,不进 review-package diff
  assert.ok(/审查通过后|不.*review-package|review.*之外/.test(md), 'must state tick is post-review / outside review-package diff');
  // 幂等路径:ticked 为空时不能硬跑 git commit(nothing to commit → exit 1)
  assert.ok(/`ticked`[^\n]*为空[\s\S]{0,120}跳过 commit/.test(md), 'must skip the commit when ticked is empty');
});

test('init.md writes the code_intel_tools config field (renamed from knowledge_tools)', () => {
  const md = readFileSync(join(__dirname, '..', 'commands', 'init.md'), 'utf8');
  assert.ok(md.includes('"code_intel_tools": []'), 'init.md must write the empty code_intel_tools default with the new field name');
  assert.ok(md.includes('code_intel_tools'), 'init.md must document code_intel_tools in the config v2 field set');
  assert.ok(!md.includes('knowledge_tools'), 'init.md must not retain the old knowledge_tools field name');
});

test('init.md calls the renamed detect-code-intel-tools verb', () => {
  const md = readFileSync(join(__dirname, '..', 'commands', 'init.md'), 'utf8');
  assert.ok(md.includes('detect-code-intel-tools'), 'init.md must call detect-code-intel-tools');
  assert.ok(!md.includes('detect-knowledge-tools'), 'init.md must not retain the old detect-knowledge-tools verb call');
});

test('code_intel_tools 6 命令 prose: 每命令用 code_intel_tools/代码智能工具 措辞,不留 知识库工具咨询 措辞', () => {
  const files = ['exploring.md', 'proposing.md', 'brainstorming.md', 'distilling-knowledge.md', 'init.md', 'reset.md'];
  for (const f of files) {
    const md = readFileSync(join(__dirname, '..', 'commands', f), 'utf8');
    assert.ok(
      md.includes('code_intel_tools') || md.includes('代码智能工具'),
      `${f} 必须含 code_intel_tools 字段引用或"代码智能工具"措辞`
    );
    assert.ok(!md.includes('知识库工具咨询'), `${f} 不得残留"知识库工具咨询"措辞`);
  }
});

test('README.md / README_CN.md 字段集 + 探测描述用 code_intel_tools,不残留 knowledge_tools 字段名', () => {
  for (const f of ['README.md', 'README_CN.md']) {
    const md = readFileSync(join(__dirname, '..', f), 'utf8');
    assert.ok(md.includes('code_intel_tools'), `${f} 必须含 code_intel_tools`);
    assert.ok(!md.includes('knowledge_tools'), `${f} 不得残留 knowledge_tools 字段名`);
    // 措辞(非字段名):代码工具一律叫 code intelligence / 代码智能工具
    assert.ok(!md.includes('knowledge-base'), `${f} 不得残留 "knowledge-base" 措辞`);
    assert.ok(!md.includes('知识库工具'), `${f} 不得残留"知识库工具"措辞`);
  }
});

test('根 README.md / README_CN.md 用 code intelligence / 代码智能工具 措辞,不残留 knowledge-base / 知识库工具', () => {
  const repoRoot = join(__dirname, '..', '..', '..');
  const en = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  assert.ok(en.includes('code intelligence'), '根 README.md 必须含 "code intelligence" 措辞');
  assert.ok(!en.includes('knowledge-base'), '根 README.md 不得残留 "knowledge-base" 措辞');
  assert.ok(!en.includes('knowledge_tools'), '根 README.md 不得残留 knowledge_tools 字段名');

  const cn = readFileSync(join(repoRoot, 'README_CN.md'), 'utf8');
  assert.ok(cn.includes('代码智能工具'), '根 README_CN.md 必须含"代码智能工具"措辞');
  assert.ok(!cn.includes('知识库工具'), '根 README_CN.md 不得残留"知识库工具"措辞');
  assert.ok(!cn.includes('knowledge_tools'), '根 README_CN.md 不得残留 knowledge_tools 字段名');
});

test('tick-task verb is idempotent and leaves the plan byte-identical on re-run', () => {
  const repo = makeRepo();
  const plan = join(repo, 'plan.md');
  writeFileSync(plan, '# P\n\n### Task 1: A\n\n- [ ] s1\n\n## 收尾\n\n- [ ] tail\n');
  const first = runCli(repo, 'tick-task', '--cwd', repo, '--plan', plan, '--task', '1');
  assert.equal(first.json.ticked.length, 1);
  const afterFirst = readFileSync(plan, 'utf8');
  assert.ok(afterFirst.includes('- [ ] tail')); // 任务区段止于 `## 收尾`
  const { code, json } = runCli(repo, 'tick-task', '--cwd', repo, '--plan', plan, '--task', '1');
  assert.equal(code, 0);
  assert.deepEqual(json.ticked, []);
  assert.equal(json.already.length, 1);
  assert.equal(readFileSync(plan, 'utf8'), afterFirst);
  rmSync(repo, { recursive: true, force: true });
});

test('syncing.md documents capability RENAME handling via rename-from metadata', () => {
  const md = readFileSync(join(__dirname, '..', 'commands', 'syncing.md'), 'utf8');
  assert.ok(md.includes('capability RENAME'), 'syncing.md must document capability RENAME handling');
  assert.ok(md.includes('rename-from'), 'syncing.md must document the rename-from delta metadata convention');
  // 具体动作与幂等语义:必须给出 git mv 与重复 syncing 的幂等保证
  assert.ok(md.includes('git mv'), 'syncing.md must spell out the git mv rename action');
  assert.ok(/幂等/.test(md), 'syncing.md must state the RENAME/merge idempotency guarantee');
  // 「顶部」范围必须收敛到首个非空行,避免扫全文误命中正文引用
  assert.ok(md.includes('首个非空行'), 'syncing.md must scope "顶部" to the first non-empty line');
  // 冲突护栏:新旧名 delta 目录并存 MUST 报错,不猜测处理顺序
  assert.ok(/MUST NOT 同时存在[\s\S]{0,400}报错/.test(md),
    'syncing.md must forbid old+new capability delta dirs coexisting and error out');
  // 旧目录不存在的两个分支必须写明
  assert.ok(md.includes('新目录已存在'), 'syncing.md must cover the "new dir already exists → skip mv" branch');
  assert.ok(md.includes('都不存在'), 'syncing.md must cover the "neither dir exists → new main spec" branch');
  // 改名后交叉引用另出 delta
  assert.ok(/grep 旧 capability 名/.test(md), 'syncing.md must require a repo-wide grep for the old capability name');
});

test('write-state lands in state/branches and feature-progress reads it back', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-state', '--cwd', repo, '--branch', 'feature/x', '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ branch: 'feature/x', type: 'feature', worktree: null,
      status: 'pending', created_at: '2026-09-02T00:00:00.000Z', initial_branch: 'main' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  assert.ok(existsSync(join(repo, '.speccode', 'state', 'branches', 'feature__x.json')));
  const p = spawnSync('node', [BIN, 'feature-progress', '--cwd', repo, '--branch', 'feature/x'], { cwd: repo, encoding: 'utf8' });
  assert.equal(p.status, 0);
  assert.equal(JSON.parse(p.stdout.trim()).total, 1);
  rmSync(repo, { recursive: true, force: true });
});

test('migrate-state converts a v2 file end to end', () => {
  const repo = makeRepo();
  const v2 = join(repo, '.speccode', 'state', 'features');
  mkdirSync(v2, { recursive: true });
  writeJsonAtomic(join(v2, 'feature__old.json'), {
    feature_branch: 'feature/old', created_at: '2026-09-01T00:00:00.000Z',
    initial_branch: 'main', status: 'pending', worktrees: {},
  });
  const r = spawnSync('node', [BIN, 'migrate-state', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: '{}', encoding: 'utf8' });
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout.trim());
  assert.deepEqual(json.migrated, ['feature__old.json']);
  assert.ok(existsSync(join(repo, '.speccode', 'state', 'branches', 'feature__old.json')));
  rmSync(repo, { recursive: true, force: true });
});

test('reconcile resolves a relative config worktree_dir against the repo root, not process cwd', () => {
  const repo = realpathSync(makeRepo());
  const wtdir = join(repo, 'wts');
  mkdirSync(wtdir, { recursive: true });
  spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 2, worktree_dir: 'wts' }), encoding: 'utf8' });
  // unregistered (no state entry): half-created worktrees are reconcile's own problem
  const add = spawnSync('git', ['worktree', 'add', join(wtdir, 'stray'), '-b', 'feature/stray'],
    { cwd: repo, encoding: 'utf8' });
  assert.equal(add.status, 0, add.stderr);

  // Process cwd deliberately NOT the repo: the stray only counts as a managed
  // orphan if the relative worktree_dir resolves against the repo root (which
  // the verb derives from --cwd). Resolve-against-process-cwd would look for
  // <elsewhere>/wts and silently report zero orphans.
  const elsewhere = mkdtempSync(join(tmpdir(), 'speccode-probe-'));
  const r = spawnSync('node', [BIN, 'reconcile', '--cwd', repo], { cwd: elsewhere, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout.trim());
  assert.ok(json.ok);
  assert.ok(json.orphans.length === 1 && json.orphans[0].includes('stray'),
    `expected the stray worktree as orphan, got ${JSON.stringify(json.orphans)}`);
  rmSync(elsewhere, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});
