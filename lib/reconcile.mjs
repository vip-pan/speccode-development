import { join } from 'node:path';
import { listActiveFeatures, writeState, WORKTREE_STATUS } from './state.mjs';
import { worktreeList, git } from './git.mjs';
import { isPathInside } from './detect.mjs';
import { nowIso } from './timestamp.mjs';

// v3 reconcile: managed worktrees are those whose path is inside
// config.worktree_dir — branch names, ancestry and overrides play no part
// (worktree ↔ branch state is 1:1). v2-era entries pass through untouched.
// children statuses are derived downstream; parents are never written here.
export function reconcile(speccodeDir, opts = {}) {
  const { cwd, worktreeDir, queryPr } = opts;
  const root = worktreeDir ?? join(cwd ?? process.cwd(), '.claude/worktrees');
  const all = listActiveFeatures(speccodeDir);
  const v3 = all.filter((b) => typeof b?.branch === 'string');
  const legacy = all.filter((b) => typeof b?.branch !== 'string');
  const dirty = new Set();

  const managed = worktreeList(cwd).filter((w) => w.path && isPathInside(root, w.path));
  const byBranch = new Map(v3.map((b) => [b.branch, b]));

  const orphans = [];
  const advanced = [];

  // 1) registered non-completed branches must exist in git (worktree or branch)
  for (const b of v3) {
    if (b.status === WORKTREE_STATUS.COMPLETED) continue;
    const present = managed.some((w) => w.branch === b.branch)
      || git(['rev-parse', '--verify', '--quiet', b.branch], { cwd, allowFail: true }).code === 0;
    // BRIEF DEVIATION: dropped `&& b.worktree` guard — the brief's own test
    // (worktree: null → orphan), design.md D2 ① and the Task 8 smoke all
    // require the orphan to fire without a recorded worktree path.
    if (!present) orphans.push(b.branch);
    // merge_target must exist unless it is trunk (trunk presence is git's own problem)
    if (b.merge_target
      && git(['rev-parse', '--verify', '--quiet', b.merge_target], { cwd, allowFail: true }).code !== 0) {
      orphans.push(b.branch);
    }
  }

  // 2) unregistered managed worktrees (half-created) are orphans
  for (const w of managed) {
    if (!byBranch.has(w.branch)) orphans.push(w.path);
  }

  // 3) pr_open advancement (v3 only)
  if (typeof queryPr === 'function') {
    for (const b of v3) {
      if (b.status === WORKTREE_STATUS.PR_OPEN && b.pr_number != null) {
        const s = queryPr(b.pr_number);
        if (s === 'MERGED') {
          b.status = WORKTREE_STATUS.COMPLETED;
          b.completed_at = nowIso();
          advanced.push({ branch: b.branch, from: 'pr_open', to: 'completed' });
          dirty.add(b.branch);
        } else if (s === 'CLOSED') {
          b.status = WORKTREE_STATUS.IN_PROGRESS;
          advanced.push({ branch: b.branch, from: 'pr_open', to: 'in_progress' });
          dirty.add(b.branch);
        }
      }
    }
  }

  for (const b of v3) {
    if (dirty.has(b.branch)) writeState(speccodeDir, b.branch, b);
  }

  return { features: [...v3, ...legacy], orphans, conflicts: [], advanced };
}
