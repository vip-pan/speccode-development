import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CODE_INTEL_TOOL_DETECTORS, detectCodeIntelTools, resolveWorktreeDir,
  isPathInside, worktreeDirIgnoreState, detectHost, DEFAULT_WORKTREE_DIR,
} from '../lib/detect.mjs';

test('CODE_INTEL_TOOL_DETECTORS covers the five required tools', () => {
  const ids = CODE_INTEL_TOOL_DETECTORS.map((t) => t.id);
  assert.deepEqual(ids, ['understand-anything', 'codegraph', 'graphify', 'codemap', 'gitnexus']);
});

test('plugin hit short-circuits commandV probe for tools with a bin', () => {
  const readJson = (p) => (p.endsWith('installed_plugins.json')
    ? { version: 2, plugins: { 'codegraph@codegraph': [{ version: '1.0.0' }] } }
    : null);
  const probedBins = [];
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson,
    commandV: (bin) => { probedBins.push(bin); return true; },
    exists: () => false,
  });
  const cg = tools.find((t) => t.id === 'codegraph');
  assert.deepEqual(cg.available, { value: true, evidence: 'codegraph@codegraph' });
  assert.ok(!probedBins.includes('codegraph'),
    'commandV must not be invoked for codegraph once its pluginHit already exists');
});

test('plugin installed but no project integration → available-only', () => {
  const readJson = (p) => (p.endsWith('installed_plugins.json')
    ? { version: 2, plugins: { 'understand-anything@understand-anything': [{ version: '2.9.4' }] } }
    : null);
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  const ua = tools.find((t) => t.id === 'understand-anything');
  assert.deepEqual(ua.available, { value: true, evidence: 'understand-anything@understand-anything' });
  assert.deepEqual(ua.integrated, { value: false, evidence: null });
});

test('project .mcp.json → both available and integrated', () => {
  const readJson = (p) => (p.endsWith('/repo/.mcp.json') ? { mcpServers: { CodeGraph: {} } } : null);
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  const cg = tools.find((t) => t.id === 'codegraph');
  assert.equal(cg.available.value, true);
  assert.deepEqual(cg.integrated, { value: true, evidence: '.mcp.json:CodeGraph' });
});

test('user ~/.claude.json mcp → available-only (not integrated)', () => {
  const readJson = (p) => (p.endsWith('/home/u/.claude.json') ? { mcpServers: { 'gitnexus-mcp': {} } } : null);
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  const gn = tools.find((t) => t.id === 'gitnexus');
  assert.equal(gn.available.value, true);
  assert.equal(gn.integrated.value, false);
});

test('projects[cwd].mcpServers → both available and integrated', () => {
  const readJson = (p) => (p.endsWith('/home/u/.claude.json')
    ? { projects: { '/repo': { mcpServers: { graphify: {} } } } } : null);
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  const gf = tools.find((t) => t.id === 'graphify');
  assert.equal(gf.available.value, true);
  assert.deepEqual(gf.integrated, { value: true, evidence: '~/.claude.json[projects]:graphify' });
});

test('project dir → integrated only (legacy .codemaker/codemap, real .codemaker/codeindex absent)', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false,
    exists: (p) => p === '/repo/.codemaker/codemap',
  });
  const cm = tools.find((t) => t.id === 'codemap');
  assert.deepEqual(cm.available, { value: false, evidence: null });
  assert.deepEqual(cm.integrated, { value: true, evidence: '.codemaker/codemap' });
});

test('.codemaker/codeindex present → codemap integrated (real project index dir)', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false,
    exists: (p) => p === '/repo/.codemaker/codeindex',
  });
  const cm = tools.find((t) => t.id === 'codemap');
  assert.deepEqual(cm.integrated, { value: true, evidence: '.codemaker/codeindex' });
});

test('.codemaker/codeindex wins over .codemaker/codemap when both present (first-existing wins)', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false,
    exists: (p) => p === '/repo/.codemaker/codeindex' || p === '/repo/.codemaker/codemap',
  });
  const cm = tools.find((t) => t.id === 'codemap');
  assert.deepEqual(cm.integrated, { value: true, evidence: '.codemaker/codeindex' });
});

test('.gitnexus dir present → gitnexus integrated', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false,
    exists: (p) => p === '/repo/.gitnexus',
  });
  const gn = tools.find((t) => t.id === 'gitnexus');
  assert.deepEqual(gn.available, { value: false, evidence: null });
  assert.deepEqual(gn.integrated, { value: true, evidence: '.gitnexus' });
});

test('gitnexus cli → available-only', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: () => null,
    commandV: (bin) => bin === 'gitnexus', exists: () => false,
  });
  const gn = tools.find((t) => t.id === 'gitnexus');
  assert.equal(gn.available.value, true);
  assert.equal(gn.integrated.value, false);
});

test('.understand-anything (legacy dir) present → understand-anything integrated', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false,
    exists: (p) => p === '/repo/.understand-anything',
  });
  const ua = tools.find((t) => t.id === 'understand-anything');
  assert.deepEqual(ua.integrated, { value: true, evidence: '.understand-anything' });
});

test('cli → available-only', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: () => null,
    commandV: (bin) => bin === 'graphify', exists: () => false,
  });
  const gf = tools.find((t) => t.id === 'graphify');
  assert.equal(gf.available.value, true);
  assert.equal(gf.integrated.value, false);
});

test('no hits → all five tools have available=false and integrated=false', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false, exists: () => false,
  });
  assert.equal(tools.length, 5);
  for (const t of tools) {
    assert.deepEqual(t.available, { value: false, evidence: null });
    assert.deepEqual(t.integrated, { value: false, evidence: null });
  }
});

test('understand-anything has no cli probe (generic `understand` binary must not false-positive)', () => {
  // understand-anything's old bin name `understand` collides with unrelated
  // binaries, so it must not carry a cli probe — only plugin/mcp/dir probes.
  assert.equal(
    CODE_INTEL_TOOL_DETECTORS.find((t) => t.id === 'understand-anything').bin,
    undefined,
  );
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => true, exists: () => false,
  });
  const ua = tools.find((t) => t.id === 'understand-anything');
  assert.equal(ua.available.value, false,
    'understand-anything must not be detected via a generic `understand` binary');
  // the other tools keep their cli probes
  const gf = tools.find((t) => t.id === 'graphify');
  assert.equal(gf.available.value, true);
});

test('resolveWorktreeDir three states', () => {
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '.wt' }), { dir: '.wt', source: 'config' });
  assert.deepEqual(resolveWorktreeDir({}), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
  assert.deepEqual(resolveWorktreeDir(null), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '  ' }), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
});

test('isPathInside: inside / outside / relative / sibling-prefix / root-self', () => {
  assert.equal(isPathInside('/repo', '/repo/a/b'), true);
  assert.equal(isPathInside('/repo', '/other'), false);
  assert.equal(isPathInside('/repo', 'a/b'), true);         // 相对 target 按 root 解析
  assert.equal(isPathInside('/repo', '/repo-evil'), false); // 兄弟前缀陷阱
  assert.equal(isPathInside('/repo', '/repo'), true);       // root 自身
});

test('worktreeDirIgnoreState: 仓库外目录返回 outside 且不碰 git', () => {
  assert.deepEqual(worktreeDirIgnoreState('/repo', '/outside/dir'), { scope: 'outside' });
});

// ---- 宿主探测与分流(host-detection change)----

const CLAUDE_PROBE_HITS = {
  '/home/u/.claude/plugins/installed_plugins.json': { plugins: { 'codemap@x': [] } },
  '/home/u/.claude.json': { mcpServers: { 'codemap-mcp': {} } },
};
const readClaudeProbes = (p) => (CLAUDE_PROBE_HITS[p] ? structuredClone(CLAUDE_PROBE_HITS[p]) : null);

test('detectHost: env 标记命中 claude-code(带 evidence)', () => {
  const r = detectHost('/repo', { env: { CLAUDECODE: '1' }, exists: () => false });
  assert.equal(r.host, 'claude-code');
  assert.ok(r.evidence, 'env 命中必须带 evidence');
});

test('detectHost: cwd 配置目录分层命中(.claude / .codex)', () => {
  assert.equal(detectHost('/repo', { env: {}, exists: (p) => p === '/repo/.claude' }).host, 'claude-code');
  assert.equal(detectHost('/repo', { env: {}, exists: (p) => p === '/repo/.codex' }).host, 'codex');
});

test('detectHost: 无任何信号回退 generic 不报错', () => {
  const r = detectHost('/repo', { env: {}, exists: () => false });
  assert.equal(r.host, 'generic');
  assert.equal(r.source, 'fallback');
});

test('detectHost: 显式覆盖优先于启发并标注来源', () => {
  const r = detectHost('/repo', { env: { CLAUDECODE: '1' }, exists: () => false, host: 'zcode' });
  assert.equal(r.host, 'zcode');
  assert.equal(r.source, 'explicit');
});

test('detectHost: 显式覆盖非法枚举值必须报错', () => {
  assert.throws(() => detectHost('/repo', { env: {}, exists: () => false, host: 'cursor' }));
});

test('code_intel: 非 claude-code 宿主跳过 ~/.claude 探测', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: readClaudeProbes, commandV: () => false, exists: () => false,
    host: 'codex',
  });
  const cm = tools.find((t) => t.id === 'codemap');
  assert.equal(cm.available.value, false, '~/.claude 插件与 mcp 命中物不得在 codex 宿主下生效');
});

test('code_intel: claude-code 宿主保持现行为', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: readClaudeProbes, commandV: () => false, exists: () => false,
    host: 'claude-code',
  });
  const cm = tools.find((t) => t.id === 'codemap');
  assert.equal(cm.available.value, true);
});

test('code_intel: host 缺失(未记录)保持现行为', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: readClaudeProbes, commandV: () => false, exists: () => false,
  });
  const cm = tools.find((t) => t.id === 'codemap');
  assert.equal(cm.available.value, true);
});

test('code_intel: bin 探测宿主无关恒开(带来源前缀)', () => {
  const tools = detectCodeIntelTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: (b) => b === 'codegraph', exists: () => false,
    host: 'codex',
  });
  const cg = tools.find((t) => t.id === 'codegraph');
  assert.deepEqual(cg.available, { value: true, evidence: 'codegraph' });
});

test('worktree_dir 缺省中性且单源', () => {
  assert.equal(DEFAULT_WORKTREE_DIR, '.speccode/worktrees');
  assert.deepEqual(resolveWorktreeDir({}), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
  assert.deepEqual(resolveWorktreeDir(null), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '  ' }), { dir: DEFAULT_WORKTREE_DIR, source: 'default' });
});
