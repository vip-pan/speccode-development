#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { isatty } from 'node:tty';
import { git } from '../lib/git.mjs';
import { detectPrToolFromUrl, isInstalled, queryPrState } from '../lib/prtool.mjs';
import { reconcile } from '../lib/reconcile.mjs';
import { loadConfig, saveConfig, backupConfig } from '../lib/config.mjs';
import { readState, writeState, deleteState, WORKTREE_STATUS } from '../lib/state.mjs';
import { detectKnowledgeTools, resolveWorktreeDir } from '../lib/detect.mjs';
import { sddWorkspace, taskBrief, reviewPackage } from '../lib/sdd.mjs';
import { buildHookPayload, runHook } from '../lib/hooks.mjs';
import { readMemory, writeMemory } from '../lib/memory.mjs';

function readStdin() {
  return readFileSync(0, 'utf8');
}

export function parseArgs(argv) {
  const [verb, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const tok = rest[i];
    if (!tok.startsWith('--')) continue;
    const body = tok.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (i + 1 < rest.length && !rest[i + 1].startsWith('--')) {
      flags[body] = rest[i + 1];
      i += 1;
    } else {
      flags[body] = true;
    }
  }
  return { verb, flags };
}

// Resolve the *main* repo root even when cwd is inside a linked worktree.
// `--show-toplevel` would return the worktree's own directory; `--git-common-dir`
// always points at the main repo's `.git` (shared across all linked worktrees).
function repoRoot(cwd) {
  const commonDir = git(
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { cwd },
  ).stdout.trim();
  return dirname(commonDir);
}

function speccodeDirOf(cwd) {
  return join(repoRoot(cwd), '.speccode');
}

const VERBS = {
  'resolve-speccode-dir': ({ cwd }) => ({ ok: true, speccodeDir: speccodeDirOf(cwd) }),

  'detect-remote': ({ cwd }) => {
    const remote = 'origin';
    const r = git(['remote', 'get-url', remote], { cwd, allowFail: true });
    const url = r.code === 0 ? r.stdout.trim() : '';
    const guess = detectPrToolFromUrl(url);
    return { ok: true, remote, url, prToolGuess: guess, installed: isInstalled(guess) };
  },

  reconcile: ({ cwd, 'advance-pr': advancePr }) => {
    const sc = speccodeDirOf(cwd);
    const cfg = loadConfig(sc);
    let queryPr;
    if (advancePr) {
      const tool = cfg && cfg.pr_tool;
      if (tool && tool !== 'none') {
        queryPr = (prNumber) => queryPrState(tool, String(prNumber), { cwd });
      }
    }
    const res = reconcile(sc, { prefix: cfg?.worktree_prefix || 'worktree-', cwd, queryPr });
    return { ok: true, orphans: res.orphans, conflicts: res.conflicts, advanced: res.advanced,
      features: res.features };
  },

  'read-config': ({ cwd }) => ({ ok: true, config: loadConfig(speccodeDirOf(cwd)) }),

  'write-config': ({ cwd, 'json-stdin': jsonStdin }) => {
    if (!jsonStdin) return { ok: false, error: 'write-config requires --json-stdin (pipe JSON via stdin)' };
    const cfg = JSON.parse(readStdin());
    saveConfig(speccodeDirOf(cwd), cfg);
    return { ok: true };
  },

  'backup-config': ({ cwd }) => ({ ok: true, path: backupConfig(speccodeDirOf(cwd)) }),

  'write-state': ({ cwd, branch, 'json-stdin': jsonStdin }) => {
    if (!jsonStdin) return { ok: false, error: 'write-state requires --json-stdin (pipe JSON via stdin)' };
    const st = JSON.parse(readStdin());
    writeState(speccodeDirOf(cwd), branch, st);
    return { ok: true };
  },

  'delete-state': ({ cwd, branch }) => {
    deleteState(speccodeDirOf(cwd), branch);
    return { ok: true };
  },

  'feature-progress': ({ cwd, branch }) => {
    const st = readState(speccodeDirOf(cwd), branch);
    if (!st) return { ok: false, error: `no state for ${branch}` };
    const wts = st.worktrees || {};
    const total = Object.keys(wts).length;
    const completed = Object.values(wts)
      .filter((w) => w.status === WORKTREE_STATUS.COMPLETED).length;
    return { ok: true, total, completed, worktrees: wts };
  },

  // Resolve against the main repo root (same --git-common-dir invariant as the
  // other verbs) so .mcp.json / project dirs are found from subdirs and
  // linked worktrees too.
  'detect-knowledge-tools': ({ cwd }) => ({ ok: true, tools: detectKnowledgeTools(repoRoot(cwd)) }),

  'resolve-worktree-dir': ({ cwd }) => {
    const cfg = loadConfig(speccodeDirOf(cwd));
    return { ok: true, ...resolveWorktreeDir(cfg) };
  },

  'sdd-workspace': ({ cwd, plan }) => {
    if (!plan || plan === true) return { ok: false, error: 'sdd-workspace requires --plan <path>' };
    return { ok: true, dir: sddWorkspace(plan, cwd) };
  },

  'task-brief': ({ cwd, plan, task, out }) => {
    // Bare `--task` parses as `true` and Number(true) === 1 — without the
    // explicit checks it would silently produce Task 1's brief.
    if (!plan || plan === true || !task || task === true || !Number.isInteger(Number(task))) {
      return { ok: false, error: 'task-brief requires --plan <path> --task <N>' };
    }
    const path = taskBrief(plan, Number(task), cwd, out === true ? undefined : out);
    return { ok: true, path };
  },

  'review-package': ({ cwd, plan, base, head, out }) => {
    if (!plan || plan === true || !base || base === true || !head || head === true) {
      return { ok: false, error: 'review-package requires --plan <path> --base <sha> --head <sha>' };
    }
    const path = reviewPackage(plan, base, head, cwd, out === true ? undefined : out);
    return { ok: true, path };
  },

  'query-pr': ({ cwd, number }) => {
    if (!number) return { ok: false, error: 'query-pr requires --number <N>' };
    const cfg = loadConfig(speccodeDirOf(cwd));
    if (!cfg) return { ok: false, error: 'no .speccode/config.json; run /speccode:init first' };
    const tool = cfg.pr_tool;
    if (!tool || tool === 'none') return { ok: false, error: 'pr_tool is none; cannot query PR state' };
    return { ok: true, state: queryPrState(tool, String(number), { cwd }) };
  },

  // The only verb that always exits 0: hook failures are warn-only and must
  // never break the invoking command. All errors collapse into the hook field.
  'run-hook': ({ cwd, event }) => {
    try {
      if (!event || event === true) {
        return { ok: true, hook: { ran: false, ok: true, warning: 'run-hook called without --event' } };
      }
      const cfg = loadConfig(speccodeDirOf(cwd));
      // isatty(0) is a side-effect-free syscall. Probing process.stdin.isTTY
      // instead would put fd 0 into non-blocking mode, and readFileSync(0)
      // could then throw EAGAIN before a slow producer fills the pipe,
      // silently dropping the fragment.
      let fragment = {};
      let stdinWarning;
      if (!isatty(0)) {
        try {
          const raw = readStdin();
          if (raw.trim()) fragment = JSON.parse(raw);
        } catch (err) {
          fragment = {};
          stdinWarning = `stdin fragment ignored: ${err?.message || err}`;
        }
      }
      const root = repoRoot(cwd);
      const payload = buildHookPayload(event, fragment, { repoRoot: root, cwd: resolve(cwd) });
      const hook = runHook(cfg, event, payload, { spawnCwd: root });
      if (stdinWarning) {
        hook.warning = hook.warning ? `${hook.warning}; ${stdinWarning}` : stdinWarning;
      }
      return { ok: true, hook };
    } catch (err) {
      return { ok: true, hook: { ran: false, ok: false, error: String(err?.message || err) } };
    }
  },

  'read-memory': ({ cwd, branch }) => {
    if (!branch || branch === true) return { ok: false, error: 'read-memory requires --branch <F>' };
    return { ok: true, memory: readMemory(speccodeDirOf(cwd), branch) };
  },

  'write-memory': ({ cwd, branch, 'json-stdin': jsonStdin }) => {
    if (!jsonStdin) return { ok: false, error: 'write-memory requires --json-stdin (pipe JSON via stdin)' };
    if (!branch || branch === true) return { ok: false, error: 'write-memory requires --branch <F>' };
    const { mode, content } = JSON.parse(readStdin());
    if (mode !== 'replace' && mode !== 'append') {
      return { ok: false, error: 'write-memory mode must be "replace" or "append"' };
    }
    if (typeof content !== 'string') return { ok: false, error: 'write-memory content must be a string' };
    const path = writeMemory(speccodeDirOf(cwd), branch, content, mode);
    return { ok: true, path };
  },
};

function main() {
  const { verb, flags } = parseArgs(process.argv.slice(2));
  const handler = VERBS[verb];
  if (!handler) {
    process.exitCode = 1;
    process.stdout.write(JSON.stringify({ ok: false, error: `unknown verb: ${verb}` }) + '\n');
    return;
  }
  try {
    const result = handler(flags);
    if (result.ok === false) process.exitCode = 1;
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (err) {
    process.exitCode = 1;
    process.stdout.write(JSON.stringify({ ok: false, error: String(err.message || err) }) + '\n');
  }
}

// only run main when invoked as a script, not when imported by tests
if (process.argv[1] && process.argv[1].endsWith('speccode.mjs')) main();
