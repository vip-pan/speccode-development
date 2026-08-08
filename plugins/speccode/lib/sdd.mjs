import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { git } from './git.mjs';

// SDD execution artifacts (task briefs, reports, review packages, ledgers).
// Workspace root = CURRENT worktree root (`--show-toplevel`), deliberately NOT
// the main-repo root used for state/config: artifacts belong to the execution
// environment and are cleaned up by `git worktree remove`. See design D7.
export function worktreeRoot(cwd) {
  return git(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim();
}

export function sddWorkspace(planFile, cwd) {
  if (!existsSync(planFile)) throw new Error(`no such plan file: ${planFile}`);
  const slug = basename(planFile, '.md');
  if (!slug || slug === '.' || slug === '..') {
    throw new Error(`cannot derive a workspace name from: ${planFile}`);
  }
  const sddRoot = join(worktreeRoot(cwd), '.speccode', 'sdd');
  const dir = join(sddRoot, slug);
  mkdirSync(dir, { recursive: true });
  // Self-ignore the whole sdd root (plugin-owned file, the user's .gitignore is
  // never touched): keeps workspaces out of `git status` and safe from
  // `git clean -fd` (no -x). Idempotent — skip the write when content matches.
  const gitignore = join(sddRoot, '.gitignore');
  if (!existsSync(gitignore) || readFileSync(gitignore, 'utf8') !== '*\n') {
    writeFileSync(gitignore, '*\n');
  }
  return dir;
}

// Port of the superpowers task-brief awk: fence lines toggle state; task
// headings only count outside fences; "Task N" must be followed by a non-digit
// or EOL so Task 1 never matches Task 10. Fence lines inside a task are kept.
export function extractTaskBrief(planText, n) {
  const lines = String(planText).split('\n');
  let inFence = false;
  let inTask = false;
  const out = [];
  const heading = /^#+[ \t]+Task[ \t]+(\d+)/;
  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence;
      if (inTask) out.push(line);
      continue;
    }
    if (!inFence) {
      const m = line.match(heading);
      if (m) inTask = Number(m[1]) === n;
    }
    if (inTask) out.push(line);
  }
  return out.length ? out.join('\n') : null;
}

export function taskBrief(planFile, n, cwd, outFile) {
  const brief = extractTaskBrief(readFileSync(planFile, 'utf8'), n);
  if (brief === null) throw new Error(`task ${n} not found in ${planFile}`);
  const out = outFile ?? join(sddWorkspace(planFile, cwd), `task-${n}-brief.md`);
  writeFileSync(out, brief + '\n');
  return out;
}

export function reviewPackage(planFile, base, head, cwd, outFile) {
  if (!existsSync(planFile)) throw new Error(`no such plan file: ${planFile}`);
  git(['rev-parse', '--verify', '--quiet', base], { cwd });
  git(['rev-parse', '--verify', '--quiet', head], { cwd });
  const short = (r) => git(['rev-parse', '--short', r], { cwd }).stdout.trim();
  const range = `${base}..${head}`;
  const commits = git(['log', '--oneline', range], { cwd }).stdout;
  const stat = git(['diff', '--stat', range], { cwd }).stdout;
  const diff = git(['diff', '-U10', range], { cwd }).stdout;
  const out = outFile
    ?? join(sddWorkspace(planFile, cwd), `review-${short(base)}..${short(head)}.diff`);
  const body = `# Review package: ${range}\n\n## Commits\n${commits}\n## Files changed\n${stat}\n## Diff\n${diff}`;
  writeFileSync(out, body);
  return out;
}
