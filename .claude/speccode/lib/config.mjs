import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './atomic.mjs';
import { nowIso } from './timestamp.mjs';

export const DEFAULT_UNTRACKED = [
  '.claude', '.agent', '.opencode', '.speccode', 'CLAUDE.md', 'AGENTS.md',
];

export function configPath(speccodeDir) {
  return join(speccodeDir, 'config.json');
}

export function loadConfig(speccodeDir) {
  return readJson(configPath(speccodeDir));
}

export function saveConfig(speccodeDir, config) {
  writeJsonAtomic(configPath(speccodeDir), config);
}

export function backupConfig(speccodeDir) {
  const p = configPath(speccodeDir);
  if (!existsSync(p)) return null;
  const stamp = nowIso().replace(/:/g, '-');
  const dest = `${p}.bak.${stamp}`;
  copyFileSync(p, dest);
  return dest;
}

export function diffFields(oldCfg, newCfg) {
  const keys = new Set([...Object.keys(oldCfg || {}), ...Object.keys(newCfg || {})]);
  const out = [];
  for (const key of keys) {
    const o = (oldCfg || {})[key];
    const n = (newCfg || {})[key];
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      out.push({ key, old: o, new: n });
    }
  }
  return out;
}
