// plugins/speccode/tests/knowledge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, realpathSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { knowledgeRoot, assertSafeRel, listTopics, parseDistilledBlocks, replaceDistilledBlocks, buildIndex, writeKnowledge } from '../lib/knowledge.mjs';
import { makeRepo } from './helpers/tmprepo.mjs';

test('knowledgeRoot resolves to <worktree-root>/speccode/knowledge', () => {
  const repo = makeRepo();
  // git rev-parse --show-toplevel realpaths; realpathSync(repo) keeps both
  // sides identical on macOS (/var -> /private/var symlink in tmpdir()).
  assert.equal(knowledgeRoot(repo), join(realpathSync(repo), 'speccode', 'knowledge'));
  rmSync(repo, { recursive: true, force: true });
});

test('assertSafeRel accepts simple relative paths', () => {
  assert.deepEqual(assertSafeRel('business/domain.md'), { ok: true, rel: 'business/domain.md' });
  assert.deepEqual(assertSafeRel('_index.md'), { ok: true, rel: '_index.md' });
});

test('assertSafeRel rejects traversal, absolute and backslash paths', () => {
  for (const bad of ['../x.md', 'a/../b.md', '/abs.md', 'a//b.md', './x.md', 'a\\b.md', '']) {
    assert.equal(assertSafeRel(bad).ok, false, JSON.stringify(bad));
  }
});

test('assertSafeRel rejects non-string input (valueless --rel parses to boolean true)', () => {
  assert.deepEqual(assertSafeRel(true), { ok: false, error: 'rel must be a string' });
  assert.equal(assertSafeRel(undefined).ok, false);
});

test('listTopics walks .md files recursively, excludes _index.md and non-md files', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'business'), { recursive: true });
  mkdirSync(join(root, 'development'), { recursive: true });
  writeFileSync(join(root, '_index.md'), '# 知识索引\n');
  writeFileSync(join(root, 'business', 'domain.md'), '# d\n');
  writeFileSync(join(root, 'development', 'pitfalls.md'), '# p\n');
  writeFileSync(join(root, 'notes.txt'), 'nope');
  const { files, index } = listTopics(root);
  assert.deepEqual(files, ['business/domain.md', 'development/pitfalls.md']);
  assert.equal(index, '# 知识索引\n');
  rmSync(repo, { recursive: true, force: true });
});

test('listTopics sorts globally ascending even when a file and dir collide (a.md vs a/)', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(join(root, 'a'), { recursive: true });
  writeFileSync(join(root, 'a.md'), '# a\n');
  writeFileSync(join(root, 'a', 'x.md'), '# x\n');
  const { files } = listTopics(root);
  assert.deepEqual(files, ['a.md', 'a/x.md']);
  rmSync(repo, { recursive: true, force: true });
});

test('listTopics on missing root returns empty files and null index', () => {
  const repo = makeRepo();
  const { files, index } = listTopics(join(repo, 'speccode', 'knowledge'));
  assert.deepEqual(files, []);
  assert.equal(index, null);
  rmSync(repo, { recursive: true, force: true });
});

test('parseDistilledBlocks extracts source and body', () => {
  const text = [
    '# topic',
    '<!-- distilled-from: archive/a/ -->',
    'body line 1',
    'body line 2',
    '<!-- /distilled -->',
    'hand written',
  ].join('\n');
  assert.deepEqual(parseDistilledBlocks(text), [
    { source: 'archive/a/', body: 'body line 1\nbody line 2' },
  ]);
});

test('parseDistilledBlocks throws on unclosed marker', () => {
  assert.throws(() => parseDistilledBlocks('<!-- distilled-from: x -->\nno end'));
});

test('parseDistilledBlocks throws on close without open', () => {
  assert.throws(() => parseDistilledBlocks('<!-- /distilled -->'));
});

test('replaceDistilledBlocks keeps hand-written lines byte-identical', () => {
  const text = 'hand A\n<!-- distilled-from: old/ -->\nold body\n<!-- /distilled -->\nhand B';
  const out = replaceDistilledBlocks(text, [{ source: 'old/', body: 'new body' }]);
  assert.equal(out, 'hand A\n<!-- distilled-from: old/ -->\nnew body\n<!-- /distilled -->\nhand B\n');
});

test('replaceDistilledBlocks drops distilled blocks whose source is gone and appends new sources', () => {
  const text = 'keep\n<!-- distilled-from: gone/ -->\nold\n<!-- /distilled -->\ntail';
  const out = replaceDistilledBlocks(text, [{ source: 'fresh/', body: 'new' }]);
  assert.equal(out, 'keep\ntail\n\n<!-- distilled-from: fresh/ -->\nnew\n<!-- /distilled -->\n');
});

test('replaceDistilledBlocks appends blocks to empty text without leading newline, but with trailing newline', () => {
  const out = replaceDistilledBlocks('', [{ source: 'x/', body: 'b' }]);
  assert.equal(out, '<!-- distilled-from: x/ -->\nb\n<!-- /distilled -->\n');
});

test('replaceDistilledBlocks does not double up trailing newline when source already ends with one', () => {
  const text = 'hand A\n<!-- distilled-from: old/ -->\nold body\n<!-- /distilled -->\nhand B\n';
  const out = replaceDistilledBlocks(text, [{ source: 'old/', body: 'new body' }]);
  assert.equal(out, 'hand A\n<!-- distilled-from: old/ -->\nnew body\n<!-- /distilled -->\nhand B\n');
});

test('replaceDistilledBlocks throws on malformed existing markers', () => {
  assert.throws(() => replaceDistilledBlocks('a\n<!-- distilled-from: x -->\nno end', []));
  assert.throws(() => replaceDistilledBlocks('a\n<!-- /distilled -->\n', []));
});

test('replaceDistilledBlocks throws on nested distilled markers', () => {
  assert.throws(
    () => replaceDistilledBlocks('<!-- distilled-from: a/ -->\n<!-- distilled-from: b/ -->\nbody\n<!-- /distilled -->', []),
    /knowledge: nested distilled marker/,
  );
});

test('replaceDistilledBlocks throws on nested markers surrounded by content', () => {
  assert.throws(
    () => replaceDistilledBlocks('a\n<!-- distilled-from: x/ -->\n<!-- distilled-from: y/ -->\nz\n<!-- /distilled -->\nb', []),
    /knowledge: nested distilled marker/,
  );
});

test('replaceDistilledBlocks throws on duplicate source in blocks (existing block for that source present)', () => {
  const text = 'keep\n<!-- distilled-from: S -->\nold\n<!-- /distilled -->\ntail';
  assert.throws(
    () => replaceDistilledBlocks(text, [{ source: 'S', body: 'b1' }, { source: 'S', body: 'b2' }]),
    /knowledge: duplicate distilled source: S/,
  );
});

test('replaceDistilledBlocks throws on duplicate source in blocks (no existing block for that source)', () => {
  assert.throws(
    () => replaceDistilledBlocks('hand-written only, no markers', [{ source: 'S', body: 'b1' }, { source: 'S', body: 'b2' }]),
    /knowledge: duplicate distilled source: S/,
  );
});

test('replaceDistilledBlocks throws when a body contains a distilled marker string', () => {
  assert.throws(
    () => replaceDistilledBlocks('', [{ source: 'x/', body: 'oops <!-- /distilled --> mid-body' }]),
    /knowledge: body contains marker string/,
  );
  assert.throws(
    () => replaceDistilledBlocks('', [{ source: 'y/', body: 'oops <!-- distilled-from: z/ -->' }]),
    /knowledge: body contains marker string/,
  );
});

test('replaceDistilledBlocks treats a missing body as an explicit empty string, not the literal "undefined"', () => {
  const out = replaceDistilledBlocks('', [{ source: 'x/' }]);
  assert.equal(out, '<!-- distilled-from: x/ -->\n\n<!-- /distilled -->\n');
});

test('buildIndex renders sections with topic lines', () => {
  const out = buildIndex([
    {
      section: '业务方向',
      items: [{ title: '领域知识', file: 'business/domain.md', summary: '术语与领域模型' }],
    },
  ]);
  assert.equal(out, '# 知识索引\n\n## 业务方向\n- 领域知识 → business/domain.md:术语与领域模型\n');
});

test('writeKnowledge writes atomically and creates parent dirs', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  const p = writeKnowledge(root, 'business/domain.md', '# 领域知识\n');
  assert.equal(p, join(root, 'business', 'domain.md'));
  assert.equal(readFileSync(p, 'utf8'), '# 领域知识\n');
  assert.ok(!existsSync(`${p}.${process.pid}.tmp`));
  rmSync(repo, { recursive: true, force: true });
});

test('parseDistilledBlocks parses legacy promoted markers', () => {
  const text = 'hand\n<!-- promoted-from: archive/a/ -->\nbody\n<!-- /promoted -->\n';
  assert.deepEqual(parseDistilledBlocks(text), [{ source: 'archive/a/', body: 'body' }]);
});

test('parseDistilledBlocks parses mixed current and legacy markers in order', () => {
  const text = [
    '<!-- distilled-from: spec/x/ -->',
    'new body',
    '<!-- /distilled -->',
    'middle hand',
    '<!-- promoted-from: archive/y/ -->',
    'old body',
    '<!-- /promoted -->',
  ].join('\n');
  assert.deepEqual(parseDistilledBlocks(text), [
    { source: 'spec/x/', body: 'new body' },
    { source: 'archive/y/', body: 'old body' },
  ]);
});

test('parseDistilledBlocks throws on mismatched opening/closing marker formats', () => {
  assert.throws(
    () => parseDistilledBlocks('<!-- distilled-from: x/ -->\nbody\n<!-- /promoted -->'),
    /knowledge: mismatched distilled marker/,
  );
  assert.throws(
    () => parseDistilledBlocks('<!-- promoted-from: x/ -->\nbody\n<!-- /distilled -->'),
    /knowledge: mismatched distilled marker/,
  );
});

test('replaceDistilledBlocks rewrites legacy markers to the current format, preserving hand-written bytes', () => {
  const text = 'hand A\n<!-- promoted-from: old/ -->\nold body\n<!-- /promoted -->\nhand B\n';
  const out = replaceDistilledBlocks(text, [{ source: 'old/', body: 'new body' }]);
  assert.equal(out, 'hand A\n<!-- distilled-from: old/ -->\nnew body\n<!-- /distilled -->\nhand B\n');
});

test('replaceDistilledBlocks drops legacy blocks whose source is gone', () => {
  const text = 'keep\n<!-- promoted-from: gone/ -->\nold\n<!-- /promoted -->\ntail';
  const out = replaceDistilledBlocks(text, []);
  assert.equal(out, 'keep\ntail\n');
});
