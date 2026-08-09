import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Knowledge-base tool detection for /speccode:init. Every environment access
// (fs read, command -v, homeDir) is injectable via opts so unit tests never
// touch the real machine.
export const KNOWLEDGE_TOOL_DETECTORS = [
  // no `bin` for understand-anything: the generic name `understand` would
  // false-positive on unrelated binaries, so it only gets plugin/mcp/dir probes.
  { id: 'understand-anything', match: 'understand-anything', dir: '.ua' },
  { id: 'codegraph', match: 'codegraph', bin: 'codegraph', dir: '.codegraph' },
  { id: 'graphify', match: 'graphify', bin: 'graphify', dir: '.graphify' },
  { id: 'codemap', match: 'codemap', bin: 'codemap', dir: '.codemaker/codemap' },
  { id: 'lightrag', match: 'lightrag', bin: 'lightrag', dir: '.lightrag' },
];

function defaultReadJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

export function detectKnowledgeTools(cwd, opts = {}) {
  const homeDir = opts.homeDir ?? homedir();
  const readJson = opts.readJson ?? defaultReadJson;
  const commandV = opts.commandV
    ?? ((bin) => spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).status === 0);
  const exists = opts.exists ?? ((p) => existsSync(p));

  const pluginsJson = readJson(join(homeDir, '.claude', 'plugins', 'installed_plugins.json'));
  const pluginKeys = Object.keys(pluginsJson?.plugins ?? {});
  const projectMcp = readJson(join(cwd, '.mcp.json'));
  const userMcp = readJson(join(homeDir, '.claude.json'));
  const mcpKeys = [
    ...Object.keys(projectMcp?.mcpServers ?? {}).map((k) => `.mcp.json:${k}`),
    ...Object.keys(userMcp?.mcpServers ?? {}).map((k) => `~/.claude.json:${k}`),
    // `claude mcp add` local scope lands under projects["<repo abs path>"].mcpServers
    ...Object.keys(userMcp?.projects?.[cwd]?.mcpServers ?? {})
      .map((k) => `~/.claude.json[projects]:${k}`),
  ];

  const found = [];
  for (const t of KNOWLEDGE_TOOL_DETECTORS) {
    const needle = t.match.toLowerCase();
    const pluginHit = pluginKeys.find((k) => k.toLowerCase().includes(needle));
    if (pluginHit) { found.push({ id: t.id, kind: 'plugin', evidence: pluginHit }); continue; }
    const mcpHit = mcpKeys.find((k) => k.toLowerCase().includes(needle));
    if (mcpHit) { found.push({ id: t.id, kind: 'mcp', evidence: mcpHit }); continue; }
    if (t.bin && commandV(t.bin)) { found.push({ id: t.id, kind: 'cli', evidence: t.bin }); continue; }
    if (exists(join(cwd, t.dir))) found.push({ id: t.id, kind: 'project-dir', evidence: t.dir });
  }
  return found;
}

export function resolveWorktreeDir(config) {
  const dir = config && typeof config.worktree_dir === 'string' ? config.worktree_dir.trim() : '';
  if (dir) return { dir, source: 'config' };
  return { dir: '.claude/worktrees', source: 'default' };
}
