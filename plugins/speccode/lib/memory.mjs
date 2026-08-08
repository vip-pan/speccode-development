import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeTextAtomic } from './atomic.mjs';
import { branchToStateName } from './slug.mjs';

// Per-feature session memory: <main repo>/.speccode/memory/<type>__<slug>.md.
// Untracked by convention like the rest of .speccode/; resolved from the main
// repo root so multiple worktrees of one feature share a single memory file.
// `_exploring` is the one non-feature key (trunk-level exploring conclusions).
export function memoryDir(speccodeDir) {
  return join(speccodeDir, 'memory');
}

export function memoryPath(speccodeDir, branch) {
  const name = branch.includes('/') ? branchToStateName(branch) : branch;
  return join(memoryDir(speccodeDir), `${name}.md`);
}

export function readMemory(speccodeDir, branch) {
  const p = memoryPath(speccodeDir, branch);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function writeMemory(speccodeDir, branch, content, mode) {
  mkdirSync(memoryDir(speccodeDir), { recursive: true });
  const p = memoryPath(speccodeDir, branch);
  const next = mode === 'append' && existsSync(p)
    ? readFileSync(p, 'utf8') + content
    : content;
  writeTextAtomic(p, next);
  return p;
}
