import { existsSync, cpSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { git } from './git.mjs';

export function enabledDocDirs(config) {
  const tools = config.spec_tools || {};
  return Object.values(tools)
    .filter((t) => t && t.enabled && t.doc_dir)
    .map((t) => t.doc_dir);
}

export function existingTrackedDirs(dirs, cwd) {
  return dirs.filter((d) => git(['ls-files', d], { cwd, allowFail: true }).stdout.trim().length > 0);
}

export function existingWorkingDirs(dirs, cwd) {
  return dirs.filter((d) => existsSync(join(cwd ?? '.', d)));
}

export function stripDocs(dirs, cwd) {
  for (const d of existingTrackedDirs(dirs, cwd)) {
    git(['rm', '-r', '--cached', d], { cwd });
  }
}

export function retrackDocs(dirs, cwd) {
  for (const d of existingWorkingDirs(dirs, cwd)) {
    git(['add', d], { cwd });
  }
}

export function backupDocs(dirs, cwd, backupDir) {
  const done = [];
  for (const d of existingWorkingDirs(dirs, cwd)) {
    const src = join(cwd ?? '.', d);
    const dest = join(backupDir, d);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { recursive: true });
    done.push(d);
  }
  return done;
}
