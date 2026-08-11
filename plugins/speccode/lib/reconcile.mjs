import { listActiveFeatures, writeState, WORKTREE_STATUS } from './state.mjs';
import { worktreeList, isAncestor } from './git.mjs';
import { nowIso } from './timestamp.mjs';

export function reconcile(speccodeDir, opts = {}) {
  const { prefix = 'worktree-', cwd, queryPr } = opts;
  const features = listActiveFeatures(speccodeDir);
  const dirty = new Set();

  // git 中所有 prefix worktree 分支
  const gitWorktreeBranches = worktreeList(cwd)
    .map((w) => w.branch)
    .filter((b) => b && b.startsWith(prefix));
  const gitSet = new Set(gitWorktreeBranches);

  const orphans = [];
  const conflicts = [];
  const advanced = [];

  // 3. state 登记但 git 缺失 → orphan(completed 为设计的正常终态:finishing-worktree 成功后清理 git 侧,不计)
  for (const st of features) {
    for (const [wt, info] of Object.entries(st.worktrees || {})) {
      if (!gitSet.has(wt) && info && info.status !== WORKTREE_STATUS.COMPLETED) orphans.push(wt);
    }
  }

  // 4. git 有但未登记 → override / ancestry 归属
  const registered = new Set(
    features.flatMap((st) => Object.keys(st.worktrees || {})),
  );
  for (const wt of gitWorktreeBranches) {
    if (registered.has(wt)) continue;

    const overrideOwner = features.find(
      (st) => st.worktree_overrides && st.worktree_overrides[wt],
    );
    if (overrideOwner) {
      overrideOwner.worktrees[wt] = { status: WORKTREE_STATUS.IN_PROGRESS };
      dirty.add(overrideOwner.feature_branch);
      registered.add(wt);
      continue;
    }

    const owners = features.filter((st) => isAncestor(st.feature_branch, wt, cwd));
    if (owners.length === 1) {
      owners[0].worktrees[wt] = { status: WORKTREE_STATUS.IN_PROGRESS };
      dirty.add(owners[0].feature_branch);
      registered.add(wt);
    } else if (owners.length >= 2) {
      conflicts.push({ worktree: wt, features: owners.map((o) => o.feature_branch) });
    } else {
      orphans.push(wt);
    }
  }

  // 5. pr_open 推进
  if (typeof queryPr === 'function') {
    for (const st of features) {
      for (const [wt, entry] of Object.entries(st.worktrees || {})) {
        if (entry.status === WORKTREE_STATUS.PR_OPEN && entry.pr_number != null) {
          const s = queryPr(entry.pr_number);
          if (s === 'MERGED') {
            entry.status = WORKTREE_STATUS.COMPLETED;
            entry.completed_at = nowIso();
            advanced.push({ worktree: wt, from: 'pr_open', to: 'completed' });
            dirty.add(st.feature_branch);
          } else if (s === 'CLOSED') {
            entry.status = WORKTREE_STATUS.IN_PROGRESS;
            advanced.push({ worktree: wt, from: 'pr_open', to: 'in_progress' });
            dirty.add(st.feature_branch);
          }
        }
      }
    }
  }

  // 6. 写回被修改的 state
  for (const st of features) {
    if (dirty.has(st.feature_branch)) writeState(speccodeDir, st.feature_branch, st);
  }

  return { features, orphans, conflicts, advanced };
}
