import { spawnSync } from 'node:child_process';

export function detectPrToolFromUrl(url) {
  if (typeof url !== 'string') return 'none';
  if (url.includes('github.com')) return 'gh';
  if (url.includes('gitlab')) return 'glab';
  return 'none';
}

export function isInstalled(tool) {
  if (tool === 'none') return false;
  const r = spawnSync('sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' });
  return r.status === 0;
}

export function createPrArgs(tool, { base, head, title, body }) {
  if (tool === 'gh') {
    return ['pr', 'create', '--base', base, '--head', head, '--title', title, '--body', body];
  }
  if (tool === 'glab') {
    return ['mr', 'create', '--target-branch', base, '--source-branch', head,
      '--title', title, '--description', body];
  }
  throw new Error(`unsupported pr_tool: ${tool}`);
}

export function queryPrArgs(tool, head) {
  if (tool === 'gh') return ['pr', 'view', head, '--json', 'state,mergedAt,mergeCommit,mergeable'];
  if (tool === 'glab') return ['mr', 'view', head, '--output', 'json'];
  throw new Error(`unsupported pr_tool: ${tool}`);
}

export function parsePrState(tool, jsonStdout) {
  let obj;
  try { obj = JSON.parse(jsonStdout); } catch { return 'UNKNOWN'; }
  if (!obj || typeof obj !== 'object') return 'UNKNOWN';
  const raw = String(obj.state ?? '').toUpperCase();
  if (tool === 'gh') {
    if (raw === 'MERGED') return 'MERGED';
    if (raw === 'CLOSED') return 'CLOSED';
    if (raw === 'OPEN') {
      return String(obj.mergeable ?? '').toUpperCase() === 'CONFLICTING' ? 'CONFLICTING' : 'OPEN';
    }
    return 'UNKNOWN';
  }
  if (tool === 'glab') {
    if (raw === 'MERGED') return 'MERGED';
    if (raw === 'CLOSED') return 'CLOSED';
    if (raw === 'OPENED') {
      return obj.has_conflicts === true ? 'CONFLICTING' : 'OPEN';
    }
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}

// Actually invoke gh/glab to fetch current PR/MR state.
// `opts.run(cmd, args) -> { code, stdout }` can be injected for testing;
// defaults to a real spawnSync call. `opts.cwd` is passed through to that
// real spawnSync so gh/glab runs in the target repo (main root or worktree).
export function queryPrState(tool, ref, opts = {}) {
  const { run, cwd } = opts;
  const args = queryPrArgs(tool, ref);
  const exec = run || ((cmd, a) => {
    const r = spawnSync(cmd, a, { encoding: 'utf8', ...(cwd ? { cwd } : {}) });
    return { code: r.status ?? 1, stdout: r.stdout ?? '' };
  });
  const { code, stdout } = exec(tool, args);
  if (code !== 0) return 'UNKNOWN';
  return parsePrState(tool, stdout);
}
