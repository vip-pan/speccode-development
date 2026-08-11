import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  // branchToStateName('_exploring') 会产生 '_exploring__undefined'——无斜杠键直通
  const name = branch.includes('/') ? branchToStateName(branch) : branch;
  return join(memoryDir(speccodeDir), `${name}.md`);
}

export function readMemory(speccodeDir, branch) {
  const p = memoryPath(speccodeDir, branch);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function writeMemory(speccodeDir, branch, content, mode) {
  const dir = memoryDir(speccodeDir);
  mkdirSync(dir, { recursive: true });
  // Self-ignore the memory dir (plugin-owned file, the user's .gitignore is
  // never touched — same shape as lib/sdd.mjs sddWorkspace): keeps memory
  // files out of `git status` and safe from `git clean -fd` (no -x).
  // Idempotent — skip the write when content matches.
  const gitignore = join(dir, '.gitignore');
  if (!existsSync(gitignore) || readFileSync(gitignore, 'utf8') !== '*\n') {
    writeFileSync(gitignore, '*\n');
  }
  const p = memoryPath(speccodeDir, branch);
  if (mode === 'append') {
    // Single O_APPEND write (appendFileSync opens with O_APPEND): a concurrent
    // cross-worktree append cannot clobber what we already wrote, unlike the
    // old read-modify-write path. On a missing file this creates it after the
    // mkdir above.
    // 条目边界兜底:既有内容非空且无尾换行、新内容无头换行时,补恰好一个 \n,
    // 与内容合并为同一次 O_APPEND 写。判定读与追加写之间理论上可被并发追加
    // 穿插,代价至多是一条粘连行(装饰性),绝不丢数据。
    const existing = existsSync(p) ? readFileSync(p, 'utf8') : '';
    const sep = existing && !existing.endsWith('\n') && !content.startsWith('\n') ? '\n' : '';
    appendFileSync(p, sep + content);
  } else {
    writeTextAtomic(p, content);
  }
  return p;
}
