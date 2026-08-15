import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdirSync, realpathSync, writeFileSync, readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
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
    assert.ok(t.id);
    assert.equal(typeof t.available.value, 'boolean');
    assert.equal(typeof t.integrated.value, 'boolean');
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
  writeFileSync(p, 'hand A\n<!-- promoted-from: old/ -->\nold body\n<!-- /promoted -->\nhand B\n');
  const { code, json } = runCliStdin(repo, 'write-knowledge', '--cwd', repo, '--rel', 'development/pitfalls.md', '--json-stdin',
    JSON.stringify({ mode: 'replace-distilled', blocks: [{ source: 'old/', body: 'new body' }] }));
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(readFileSync(p, 'utf8'), 'hand A\n<!-- distilled-from: old/ -->\nnew body\n<!-- /distilled -->\nhand B\n');
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
