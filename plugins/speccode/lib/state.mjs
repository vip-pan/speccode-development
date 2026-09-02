import { readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './atomic.mjs';
import { branchToStateName } from './slug.mjs';

export const WORKTREE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PR_OPEN: 'pr_open',
  COMPLETED: 'completed',
};

const LEGACY_COMMAND_NAMES = {
  'develop-complete': 'finishing-worktree',
  finish: 'finishing-feature',
};

// Normalize legacy (v0.1) state shapes on read. waiting_display_pr is kept
// as-is: the command layer reports it as non-resumable (see finishing-feature.md).
export function normalizeState(state) {
  if (!state || typeof state !== 'object') return state;
  const po = state.pending_operation;
  if (po && typeof po === 'object' && Object.hasOwn(LEGACY_COMMAND_NAMES, po.command)) {
    return { ...state, pending_operation: { ...po, command: LEGACY_COMMAND_NAMES[po.command] } };
  }
  return state;
}

export function branchesDir(speccodeDir) {
  return join(speccodeDir, 'state', 'branches');
}

// v2 legacy location — kept for dual-format read/write compat only.
export function featuresDir(speccodeDir) {
  return join(speccodeDir, 'state', 'features');
}

function stateFilePathIn(dir, branch) {
  return join(dir, `${branchToStateName(branch)}.json`);
}

function readStateAt(dir, branch) {
  const raw = readJson(stateFilePathIn(dir, branch));
  return raw === null ? null : normalizeState(raw);
}

// Format follows the existing file: a v2-era file keeps v2 semantics in place
// (old flows keep working, no in-memory translation); new writes land in
// state/branches/ (v3).
export function readState(speccodeDir, branch) {
  return readStateAt(branchesDir(speccodeDir), branch)
    ?? readStateAt(featuresDir(speccodeDir), branch);
}

export function writeState(speccodeDir, branch, state) {
  const v2Path = stateFilePathIn(featuresDir(speccodeDir), branch);
  const target = existsSync(v2Path) ? v2Path : stateFilePathIn(branchesDir(speccodeDir), branch);
  writeJsonAtomic(target, state);
}

export function deleteState(speccodeDir, branch) {
  for (const dir of [branchesDir(speccodeDir), featuresDir(speccodeDir)]) {
    const p = stateFilePathIn(dir, branch);
    if (existsSync(p)) rmSync(p);
  }
}

function readDirStates(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => normalizeState(readJson(join(dir, f))))
    .filter((s) => s !== null);
}

// v3 entries first, then untouched v2 entries (dual-format, no translation).
export function listActiveFeatures(speccodeDir) {
  return [
    ...readDirStates(branchesDir(speccodeDir)),
    ...readDirStates(featuresDir(speccodeDir)),
  ];
}

// One-time v2→v3 conversion for init. v2 features that still map >1 branch or
// are in flight cannot convert 1:1 onto per-branch v3 state — multi-worktree
// files and single-worktree files whose sole worktree is not completed are
// skipped (reported) and left in place for manual finishing under the v2 flow
// before upgrading. A v3 target file that already exists is likewise skipped so
// migration never clobbers newer v3 state. Converted branches have
// worktree: null (the v2 file never stored the path).
export function migrateStateV2toV3(speccodeDir) {
  const dir = featuresDir(speccodeDir);
  if (!existsSync(dir)) return { migrated: [], skipped: [] };
  const migrated = [];
  const skipped = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const raw = readJson(join(dir, f));
    const branch = raw && typeof raw === 'object' ? raw.feature_branch : undefined;
    const worktrees = raw && typeof raw === 'object' ? Object.entries(raw.worktrees || {}) : [];
    const inFlight =
      worktrees.length > 1 ||
      (worktrees.length === 1 && worktrees[0][1]?.status !== 'completed');
    const targetExists =
      typeof branch === 'string' &&
      existsSync(stateFilePathIn(branchesDir(speccodeDir), branch));
    if (typeof branch !== 'string' || !branch.includes('/') || inFlight || targetExists) {
      skipped.push(f);
      continue;
    }
    const v3 = {
      branch,
      type: branch.split('/')[0],
      worktree: null,
      status: raw.status ?? 'pending',
      created_at: raw.created_at,
      initial_branch: raw.initial_branch,
    };
    if (raw.pending_operation !== undefined) v3.pending_operation = raw.pending_operation;
    writeJsonAtomic(stateFilePathIn(branchesDir(speccodeDir), branch), v3);
    rmSync(join(dir, f));
    migrated.push(f);
  }
  return { migrated, skipped };
}
