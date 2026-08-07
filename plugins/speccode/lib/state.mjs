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
  if (po && typeof po === 'object' && LEGACY_COMMAND_NAMES[po.command]) {
    return { ...state, pending_operation: { ...po, command: LEGACY_COMMAND_NAMES[po.command] } };
  }
  return state;
}

export function featuresDir(speccodeDir) {
  return join(speccodeDir, 'state', 'features');
}

export function stateFilePath(speccodeDir, branch) {
  return join(featuresDir(speccodeDir), `${branchToStateName(branch)}.json`);
}

export function readState(speccodeDir, branch) {
  return normalizeState(readJson(stateFilePath(speccodeDir, branch)));
}

export function writeState(speccodeDir, branch, state) {
  writeJsonAtomic(stateFilePath(speccodeDir, branch), state);
}

export function deleteState(speccodeDir, branch) {
  const p = stateFilePath(speccodeDir, branch);
  if (existsSync(p)) rmSync(p);
}

export function listActiveFeatures(speccodeDir) {
  const dir = featuresDir(speccodeDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => normalizeState(readJson(join(dir, f))))
    .filter((s) => s !== null);
}
