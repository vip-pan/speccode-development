import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWLEDGE_TOOL_DETECTORS, detectKnowledgeTools, resolveWorktreeDir,
  isPathInside, worktreeDirIgnoreState,
} from '../lib/detect.mjs';

test('KNOWLEDGE_TOOL_DETECTORS covers the five required tools', () => {
  const ids = KNOWLEDGE_TOOL_DETECTORS.map((t) => t.id);
  assert.deepEqual(ids, ['understand-anything', 'codegraph', 'graphify', 'codemap', 'lightrag']);
});

test('detects a Claude Code plugin via installed_plugins.json key', () => {
  const readJson = (p) => (p.endsWith('installed_plugins.json')
    ? { version: 2, plugins: { 'understand-anything@understand-anything': [{ version: '2.9.4' }] } }
    : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  assert.deepEqual(tools, [
    { id: 'understand-anything', kind: 'plugin', evidence: 'understand-anything@understand-anything' },
  ]);
});

test('detects an MCP server from project .mcp.json and user .claude.json', () => {
  const readJson = (p) => {
    if (p.endsWith('/repo/.mcp.json')) return { mcpServers: { CodeGraph: {} } };
    if (p.endsWith('/home/u/.claude.json')) return { mcpServers: { 'lightrag-server': {} } };
    return null;
  };
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  assert.deepEqual(tools, [
    { id: 'codegraph', kind: 'mcp', evidence: '.mcp.json:CodeGraph' },
    { id: 'lightrag', kind: 'mcp', evidence: '~/.claude.json:lightrag-server' },
  ]);
});

test('detects a local-scope MCP server from ~/.claude.json projects[cwd].mcpServers', () => {
  const readJson = (p) => (p.endsWith('/home/u/.claude.json')
    ? { projects: { '/repo': { mcpServers: { graphify: {} } } } }
    : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  assert.deepEqual(tools, [
    { id: 'graphify', kind: 'mcp', evidence: '~/.claude.json[projects]:graphify' },
  ]);
});

test('detects a CLI binary via command -v', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null,
    commandV: (bin) => bin === 'graphify', exists: () => false,
  });
  assert.deepEqual(tools, [{ id: 'graphify', kind: 'cli', evidence: 'graphify' }]);
});

test('understand-anything has no cli probe (generic `understand` binary must not false-positive)', () => {
  // understand-anything's old bin name `understand` collides with unrelated
  // binaries, so it must not carry a cli probe — only plugin/mcp/dir probes.
  assert.equal(
    KNOWLEDGE_TOOL_DETECTORS.find((t) => t.id === 'understand-anything').bin,
    undefined,
  );
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => true, exists: () => false,
  });
  assert.ok(!tools.some((t) => t.id === 'understand-anything'),
    'understand-anything must not be detected via a generic `understand` binary');
  // the other tools keep their cli probes
  assert.ok(tools.some((t) => t.id === 'graphify' && t.kind === 'cli'));
});

test('detects a project config directory', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false,
    exists: (p) => p === '/repo/.codemaker/codemap',
  });
  assert.deepEqual(tools, [{ id: 'codemap', kind: 'project-dir', evidence: '.codemaker/codemap' }]);
});

test('plugin wins over cli for the same tool (precedence), and no hits returns []', () => {
  const readJson = (p) => (p.endsWith('installed_plugins.json')
    ? { version: 2, plugins: { 'codegraph@foo': [{}] } } : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: (bin) => bin === 'codegraph', exists: () => false,
  });
  assert.deepEqual(tools, [{ id: 'codegraph', kind: 'plugin', evidence: 'codegraph@foo' }]);
  const none = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false, exists: () => false,
  });
  assert.deepEqual(none, []);
});

test('mcp wins over cli for the same tool (precedence)', () => {
  const readJson = (p) => (p.endsWith('/repo/.mcp.json') ? { mcpServers: { codemap: {} } } : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: (bin) => bin === 'codemap', exists: () => false,
  });
  assert.deepEqual(tools, [{ id: 'codemap', kind: 'mcp', evidence: '.mcp.json:codemap' }]);
});

test('cli wins over project-dir for the same tool (precedence)', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null,
    commandV: (bin) => bin === 'lightrag', exists: (p) => p === '/repo/.lightrag',
  });
  assert.deepEqual(tools, [{ id: 'lightrag', kind: 'cli', evidence: 'lightrag' }]);
});

test('resolveWorktreeDir three states', () => {
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '.wt' }), { dir: '.wt', source: 'config' });
  assert.deepEqual(resolveWorktreeDir({}), { dir: '.claude/worktrees', source: 'default' });
  assert.deepEqual(resolveWorktreeDir(null), { dir: '.claude/worktrees', source: 'default' });
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '  ' }), { dir: '.claude/worktrees', source: 'default' });
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
