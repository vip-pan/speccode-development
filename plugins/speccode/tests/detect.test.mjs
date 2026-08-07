import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWLEDGE_TOOL_DETECTORS, detectKnowledgeTools, resolveWorktreeDir,
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

test('detects a CLI binary via command -v', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null,
    commandV: (bin) => bin === 'graphify', exists: () => false,
  });
  assert.deepEqual(tools, [{ id: 'graphify', kind: 'cli', evidence: 'graphify' }]);
});

test('detects a project config directory', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false,
    exists: (p) => p === '/repo/.codemap',
  });
  assert.deepEqual(tools, [{ id: 'codemap', kind: 'project-dir', evidence: '.codemap' }]);
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

test('resolveWorktreeDir three states', () => {
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '.wt' }), { dir: '.wt', source: 'config' });
  assert.deepEqual(resolveWorktreeDir({}), { dir: '.claude/worktrees', source: 'default' });
  assert.deepEqual(resolveWorktreeDir(null), { dir: '.claude/worktrees', source: 'default' });
  assert.deepEqual(resolveWorktreeDir({ worktree_dir: '  ' }), { dir: '.claude/worktrees', source: 'default' });
});
