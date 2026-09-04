import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

function run(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

export function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'speccode-repo-'));
  run(dir, 'init', '-b', 'master');
  run(dir, 'config', 'user.email', 'test@local');
  run(dir, 'config', 'user.name', 'test');
  writeFileSync(join(dir, 'README.md'), '# test\n');
  run(dir, 'add', '.');
  run(dir, 'commit', '-m', 'init');
  return dir;
}

export function commitFile(repo, relpath, content, msg) {
  const full = join(repo, relpath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  run(repo, 'add', '.');
  run(repo, 'commit', '-m', msg);
}
