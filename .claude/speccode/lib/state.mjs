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

export function featuresDir(speccodeDir) {
  return join(speccodeDir, 'state', 'features');
}

export function stateFilePath(speccodeDir, branch) {
  return join(featuresDir(speccodeDir), `${branchToStateName(branch)}.json`);
}

export function readState(speccodeDir, branch) {
  return readJson(stateFilePath(speccodeDir, branch));
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
    .map((f) => readJson(join(dir, f)))
    .filter((s) => s !== null);
}
