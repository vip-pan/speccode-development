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
  if (tool === 'gh') return ['pr', 'view', head, '--json', 'state,mergedAt,mergeCommit'];
  if (tool === 'glab') return ['mr', 'view', head, '--output', 'json'];
  throw new Error(`unsupported pr_tool: ${tool}`);
}

export function parsePrState(tool, jsonStdout) {
  let obj;
  try { obj = JSON.parse(jsonStdout); } catch { return 'UNKNOWN'; }
  const raw = String(obj.state ?? '').toUpperCase();
  if (tool === 'gh') {
    if (raw === 'MERGED') return 'MERGED';
    if (raw === 'OPEN') return 'OPEN';
    if (raw === 'CLOSED') return 'CLOSED';
    return 'UNKNOWN';
  }
  if (tool === 'glab') {
    if (raw === 'MERGED') return 'MERGED';
    if (raw === 'OPENED') return 'OPEN';
    if (raw === 'CLOSED') return 'CLOSED';
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}
