import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { git } from './git.mjs';
import { writeTextAtomic } from './atomic.mjs';

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

// Single source of truth for reading a plan's structure: one pass over the
// lines, labelling each with `{ inFence, taskNo }`. Both extractTaskBrief and
// tickTask consume it, so a brief and a tick always see the same sections.
//
// Fences follow CommonMark: an opening run of K backticks is closed only by a
// run of >= K backticks with nothing after it. A naive toggle would flip state
// on the inner ```bash of a ````markdown block and leak code-block lines into
// the surrounding task (an odd number of inner fences inverts the parity for
// the whole rest of the file). Fence delimiter lines themselves count as
// in-fence but keep the surrounding taskNo, so a brief still quotes them.
//
// A task section spans from its `### Task N` heading to the next heading at the
// same or a higher level (the next `### Task M`, or a trailing `## 收尾` /
// `## Self-Review` chapter) — without that lower bound the last task would
// swallow every trailing chapter of the plan. Deeper headings stay inside.
// `Task 1` never matches `Task 10`: the digit run is captured whole and
// compared numerically.
export function scanPlan(lines) {
  const fenceRe = /^(`{3,})(.*)$/;
  const headingRe = /^(#+)[ \t]+(.*)$/;
  const taskRe = /^Task[ \t]+(\d+)/;
  const out = new Array(lines.length);
  let fenceLen = 0; // 0 = outside a fence; otherwise the open fence's length
  let taskNo = null;
  let taskLevel = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const f = line.match(fenceRe);
    if (f) {
      if (fenceLen === 0) fenceLen = f[1].length;
      else if (f[1].length >= fenceLen && f[2].trim() === '') fenceLen = 0;
      out[i] = { inFence: true, taskNo };
      continue;
    }
    if (fenceLen === 0) {
      const h = line.match(headingRe);
      if (h) {
        const level = h[1].length;
        const t = h[2].match(taskRe);
        if (t) { taskNo = Number(t[1]); taskLevel = level; }
        else if (taskNo !== null && level <= taskLevel) taskNo = null;
      }
    }
    out[i] = { inFence: fenceLen > 0, taskNo };
  }
  return out;
}

// Extract the `Task N` section of a plan (fence lines inside it are kept).
// Section boundaries and fence state come from scanPlan.
export function extractTaskBrief(planText, n) {
  const lines = String(planText).split('\n');
  const scan = scanPlan(lines);
  const out = lines.filter((_, i) => scan[i].taskNo === n);
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

// Tick every unchecked step checkbox (- [ ]) of "Task N" to [x]. Section
// bounds and fence state come from scanPlan (shared with extractTaskBrief), so
// checkboxes quoted inside code blocks — including inner fences of a nested
// ````markdown block — are never touched. Already-checked lines are reported
// in `already`; a run that ticks nothing rewrites nothing (idempotent, so a
// re-run leaves the working tree clean). Atomic write.
export function tickTask(planFile, n) {
  if (!existsSync(planFile)) throw new Error(`no such plan file: ${planFile}`);
  const lines = readFileSync(planFile, 'utf8').split('\n');
  const scan = scanPlan(lines);
  if (!scan.some((s) => s.taskNo === n)) {
    throw new Error(`task ${n} not found in ${planFile}`);
  }
  const ticked = [];
  const already = [];
  const unchecked = /^(\s*)- \[ \](.*)$/;
  const checked = /^(\s*)- \[[xX]\](.*)$/;
  for (let i = 0; i < lines.length; i += 1) {
    if (scan[i].taskNo !== n || scan[i].inFence) continue;
    const line = lines[i];
    const u = line.match(unchecked);
    if (u) { lines[i] = `${u[1]}- [x]${u[2]}`; ticked.push(line.trim()); continue; }
    if (checked.test(line)) already.push(line.trim());
  }
  if (ticked.length > 0) writeTextAtomic(planFile, lines.join('\n'));
  return { ticked, already };
}
