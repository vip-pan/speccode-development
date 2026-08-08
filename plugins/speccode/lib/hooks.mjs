import { spawnSync } from 'node:child_process';
import { nowIso } from './timestamp.mjs';

// Config-driven lifecycle hooks. Failure semantics are warn-only: a hook must
// never break the invoking command. runHook never throws; the CLI's run-hook
// verb folds every outcome into the hook field and always exits 0.
export const HOOK_EVENTS = [
  'onExplored', 'onFeatureCreated', 'onWorktreeCreated', 'onProposed',
  'onBrainstormed', 'onPlanned', 'onTaskCompleted', 'onCodeReviewRequested',
  'onCodeReviewCompleted', 'onWorktreeFinished', 'onFeatureFinished',
  'onPrOpened', 'onSynced', 'onArchived',
];

// ctx carries what only the caller can know: repoRoot (bin resolves it via
// --git-common-dir) and cwd. Event context fields (command, feature_branch,
// worktree_branch, pr_number, task) come from the caller via `fields`. The
// engine's four envelope fields spread last: they are authoritative and a
// caller fragment can never override them.
export function buildHookPayload(event, fields, ctx) {
  return {
    ...fields,
    event,
    timestamp: nowIso(),
    repo_root: ctx.repoRoot,
    cwd: ctx.cwd,
  };
}

export function runHook(config, event, payload, opts = {}) {
  try {
    if (!HOOK_EVENTS.includes(event)) {
      return { ran: false, ok: true, warning: `unknown hook event: ${event}` };
    }
    const cmd = config?.hooks?.[event];
    if (!cmd) return { ran: false, ok: true };
    const timeoutMs = opts.timeoutMs ?? 30000;
    // opts.spawnCwd (bin passes the main repo root) wins; payload.cwd is an
    // informational envelope field, not an exec directive.
    const spawnCwd = opts.spawnCwd ?? payload?.cwd ?? undefined;
    const spawn = opts.spawn ?? ((command, input) => {
      const r = spawnSync('sh', ['-c', command], {
        input, encoding: 'utf8', timeout: timeoutMs, cwd: spawnCwd,
      });
      return { code: r.status, signal: r.signal, error: r.error, stderr: r.stderr };
    });
    const r = spawn(cmd, JSON.stringify(payload));
    if (r.error || r.code === null || r.code === undefined) {
      return { ran: true, ok: false, error: String(r.error?.message || `terminated by ${r.signal}`) };
    }
    if (r.code !== 0) {
      const detail = String(r.stderr || '').slice(0, 500) || `exit code ${r.code}`;
      return { ran: true, ok: false, exitCode: r.code, error: detail };
    }
    return { ran: true, ok: true };
  } catch (err) {
    return { ran: true, ok: false, error: String(err?.message || err) };
  }
}
