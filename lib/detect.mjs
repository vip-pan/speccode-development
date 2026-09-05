import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { git } from './git.mjs';

// Code-intel tool detection for /speccode:init. Every environment access
// (fs read, command -v, homeDir) is injectable via opts so unit tests never
// touch the real machine.
export const CODE_INTEL_TOOL_DETECTORS = [
  // no `bin` for understand-anything: the generic name `understand` would
  // false-positive on unrelated binaries, so it only gets plugin/mcp/dir probes.
  // dirs: 探测目录候选列表,按序 probe,第一个命中的目录即证据(first-existing wins)。
  { id: 'understand-anything', match: 'understand-anything', dirs: ['.ua', '.understand-anything'] },
  { id: 'codegraph', match: 'codegraph', bin: 'codegraph', dirs: ['.codegraph'] },
  { id: 'graphify', match: 'graphify', bin: 'graphify', dirs: ['.graphify'] },
  // codemap 真实项目索引目录是 .codemaker/codeindex/(其 skill 自述"初始化 .codemaker/codeindex/"),
  // .codemaker/codemap 是历史/home-install 路径,两者都探测,索引目录优先。
  { id: 'codemap', match: 'codemap', bin: 'codemap', dirs: ['.codemaker/codeindex', '.codemaker/codemap'] },
  { id: 'gitnexus', match: 'gitnexus', bin: 'gitnexus', dirs: ['.gitnexus'] },
];

function defaultReadJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

export function detectCodeIntelTools(cwd, opts = {}) {
  const homeDir = opts.homeDir ?? homedir();
  const readJson = opts.readJson ?? defaultReadJson;
  const commandV = opts.commandV
    ?? ((bin) => spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).status === 0);
  const exists = opts.exists ?? ((p) => existsSync(p));

  // Host-aware gating (host-detection change): the ~/.claude probes only make
  // sense for Claude Code. Any explicitly recorded non-claude-code host skips
  // them; an absent `host` keeps the legacy full-probe behavior byte-identical.
  const claudeProbes = !opts.host || opts.host === 'claude-code';
  const pluginsJson = claudeProbes
    ? readJson(join(homeDir, '.claude', 'plugins', 'installed_plugins.json'))
    : null;
  const pluginKeys = Object.keys(pluginsJson?.plugins ?? {});
  const projectMcp = readJson(join(cwd, '.mcp.json'));
  const userMcp = claudeProbes ? readJson(join(homeDir, '.claude.json')) : null;

  // available 维度:任意 MCP 配置(项目 .mcp.json / 用户 mcpServers / projects[cwd])也算「可用」
  const anyMcpKeys = [
    ...Object.keys(projectMcp?.mcpServers ?? {}).map((k) => `.mcp.json:${k}`),
    ...Object.keys(userMcp?.mcpServers ?? {}).map((k) => `~/.claude.json:${k}`),
    ...Object.keys(userMcp?.projects?.[cwd]?.mcpServers ?? {}).map((k) => `~/.claude.json[projects]:${k}`),
  ];
  // integrated 维度:项目级 MCP(项目 .mcp.json 或 projects[cwd]),不含用户全局 mcpServers
  // 注:userMcp?.projects?.[cwd] 以主仓根(CLI 传入的 repoRoot(cwd))为 key;若用户在
  // linked worktree 内跑 `claude mcp add`,该 key 会落在 worktree 路径下,不会命中这里
  // (与主仓根不一致),从而漏判为未集成。历史遗留,目前影响面可接受,未处理。
  const projectMcpKeys = [
    ...Object.keys(projectMcp?.mcpServers ?? {}).map((k) => `.mcp.json:${k}`),
    ...Object.keys(userMcp?.projects?.[cwd]?.mcpServers ?? {}).map((k) => `~/.claude.json[projects]:${k}`),
  ];

  const tools = [];
  for (const t of CODE_INTEL_TOOL_DETECTORS) {
    const needle = t.match.toLowerCase();

    const pluginHit = pluginKeys.find((k) => k.toLowerCase().includes(needle));
    // pluginHit 已在下方 available 三元里排在 cliHit 之前,插件命中时无需再 spawn 一次 command -v。
    const cliHit = (!pluginHit && t.bin && commandV(t.bin)) ? t.bin : null;
    const anyMcpHit = anyMcpKeys.find((k) => k.toLowerCase().includes(needle));
    const projectMcpHit = projectMcpKeys.find((k) => k.toLowerCase().includes(needle));
    const dirHit = (t.dirs ?? []).find((d) => exists(join(cwd, d))) ?? null;

    const available = pluginHit
      ? { value: true, evidence: pluginHit }
      : cliHit
        ? { value: true, evidence: cliHit }
        : anyMcpHit
          ? { value: true, evidence: anyMcpHit }
          : { value: false, evidence: null };

    const integrated = projectMcpHit
      ? { value: true, evidence: projectMcpHit }
      : dirHit
        ? { value: true, evidence: dirHit }
        : { value: false, evidence: null };

    tools.push({ id: t.id, available, integrated });
  }
  return tools;
}

// ---- host detection (multi-host support) ----
// Layered best-effort heuristics; init always confirms with the user before
// writing config.host (explicit override wins). Every environment access
// (env read, fs exists) is injectable via opts so unit tests never touch the
// real machine. Unknown hosts resolve to `generic` — the all-neutral probe
// path — and MUST NOT error.

export const HOST_IDS = ['claude-code', 'codex', 'zcode', 'opencode', 'pi', 'kimi-code', 'generic'];

// Only markers we are confident about; unknown hosts simply reach no marker
// and fall back to `generic` (user confirmation at init is the authority).
const HOST_ENV_MARKERS = {
  'claude-code': ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT'],
};

const HOST_DIR_MARKERS = {
  'claude-code': ['.claude'],
  'codex': ['.codex'],
  'zcode': ['.zcode'],
  'opencode': ['.opencode'],
  'pi': ['.pi'],
  'kimi-code': ['.kimi'],
};

// Instruction files are a weak signal (AGENTS.md is the cross-agent standard,
// so it maps to no single host); only CLAUDE.md is host-specific enough.
const HOST_FILE_MARKERS = {
  'claude-code': ['CLAUDE.md'],
};

export function detectHost(cwd, opts = {}) {
  const env = opts.env ?? process.env;
  const exists = opts.exists ?? ((p) => existsSync(p));
  if (opts.host !== undefined) {
    if (!HOST_IDS.includes(opts.host)) {
      throw new Error(`invalid host id: ${opts.host} (allowed: ${HOST_IDS.join(', ')})`);
    }
    return { host: opts.host, evidence: `--host ${opts.host}`, source: 'explicit' };
  }
  for (const id of HOST_IDS) {
    for (const marker of HOST_ENV_MARKERS[id] ?? []) {
      if (env[marker] !== undefined) {
        return { host: id, evidence: `env:${marker}`, source: 'env' };
      }
    }
  }
  for (const id of HOST_IDS) {
    for (const dir of HOST_DIR_MARKERS[id] ?? []) {
      if (exists(join(cwd, dir))) {
        return { host: id, evidence: dir, source: 'dir' };
      }
    }
  }
  for (const id of HOST_IDS) {
    for (const file of HOST_FILE_MARKERS[id] ?? []) {
      if (exists(join(cwd, file))) {
        return { host: id, evidence: file, source: 'file' };
      }
    }
  }
  return { host: 'generic', evidence: null, source: 'fallback' };
}

// Neutral default worktree root — single source of truth. reconcile.mjs
// imports this constant; the previous default carried host flavor and was
// duplicated across two libs.
export const DEFAULT_WORKTREE_DIR = '.speccode/worktrees';

export function resolveWorktreeDir(config) {
  const dir = config && typeof config.worktree_dir === 'string' ? config.worktree_dir.trim() : '';
  if (dir) return { dir, source: 'config' };
  return { dir: DEFAULT_WORKTREE_DIR, source: 'default' };
}

// 判定 target 是否位于 root 之内(含 root 自身)。target 相对/绝对均可,
// 一律 resolve(root, target) 归一;前缀补分隔符防 /repo vs /repo-evil 兄弟前缀误判。
export function isPathInside(root, target) {
  const base = resolve(root);
  const resolved = resolve(root, target);
  return resolved === base || resolved.startsWith(base + sep);
}

// creating-worktree 的 gitignore 校验:仓库外目录永不被 git 跟踪 → outside,
// 且不调用 git(其对外部路径 fatal+exit 128);仅仓库内分支跑 check-ignore。
// 查询带尾斜杠:check-ignore 对不存在的路径无法判断「目录」语义,裸路径
// 即使被 dir 模式(.wt/)忽略也会返回 exit 1;`<dir>/` 明确按目录判定。
export function worktreeDirIgnoreState(repoRootDir, dir) {
  if (!isPathInside(repoRootDir, dir)) return { scope: 'outside' };
  const r = git(['check-ignore', '-q', `${dir.replace(/[\\/]+$/, '')}/`], { cwd: repoRootDir, allowFail: true });
  return { scope: 'inside', ignored: r.code === 0 };
}
