import { spawnSync } from 'node:child_process';

export function git(args, opts = {}) {
  const { cwd, allowFail = false } = opts;
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  const result = { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  if (!allowFail && result.code !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${result.code}): ${result.stderr}`);
  }
  return result;
}

export function currentBranch(cwd) {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).stdout.trim();
}

export function branchExists(branch, cwd) {
  return git(['rev-parse', '--verify', '--quiet', branch], { cwd, allowFail: true }).code === 0;
}

export function isAncestor(ancestor, descendant, cwd) {
  return git(['merge-base', '--is-ancestor', ancestor, descendant], { cwd, allowFail: true }).code === 0;
}

export function worktreeList(cwd) {
  const out = git(['worktree', 'list', '--porcelain'], { cwd }).stdout;
  const entries = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (cur) entries.push(cur);
      cur = { path: line.slice('worktree '.length), branch: null };
    } else if (line.startsWith('branch ') && cur) {
      cur.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
    }
  }
  if (cur) entries.push(cur);
  return entries;
}
