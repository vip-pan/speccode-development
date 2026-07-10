#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git } from '../lib/git.mjs';
import { detectPrToolFromUrl, isInstalled } from '../lib/prtool.mjs';
import { reconcile } from '../lib/reconcile.mjs';
import { loadConfig, saveConfig, backupConfig } from '../lib/config.mjs';
import { readState, writeState, deleteState, WORKTREE_STATUS } from '../lib/state.mjs';

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

function gitRoot(cwd) {
  return git(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim();
}

function speccodeDirOf(cwd) {
  return join(gitRoot(cwd), '.speccode');
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

  reconcile: ({ cwd }) => {
    const sc = speccodeDirOf(cwd);
    const res = reconcile(sc, { prefix: 'worktree-', cwd });
    return { ok: true, orphans: res.orphans, conflicts: res.conflicts, advanced: res.advanced,
      features: res.features };
  },

  'read-config': ({ cwd }) => ({ ok: true, config: loadConfig(speccodeDirOf(cwd)) }),

  'write-config': ({ cwd }) => {
    const cfg = JSON.parse(readStdin());
    saveConfig(speccodeDirOf(cwd), cfg);
    return { ok: true };
  },

  'backup-config': ({ cwd }) => ({ ok: true, path: backupConfig(speccodeDirOf(cwd)) }),

  'write-state': ({ cwd, branch }) => {
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
