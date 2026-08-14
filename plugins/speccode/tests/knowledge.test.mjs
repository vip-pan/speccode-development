// plugins/speccode/tests/knowledge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, realpathSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { knowledgeRoot, assertSafeRel, listTopics, parsePromotedBlocks, replacePromotedBlocks, buildIndex, writeKnowledge } from '../lib/knowledge.mjs';
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

test('parsePromotedBlocks extracts source and body', () => {
  const text = [
    '# topic',
    '<!-- promoted-from: archive/a/ -->',
    'body line 1',
    'body line 2',
    '<!-- /promoted -->',
    'hand written',
  ].join('\n');
  assert.deepEqual(parsePromotedBlocks(text), [
    { source: 'archive/a/', body: 'body line 1\nbody line 2' },
  ]);
});

test('parsePromotedBlocks throws on unclosed marker', () => {
  assert.throws(() => parsePromotedBlocks('<!-- promoted-from: x -->\nno end'));
});

test('parsePromotedBlocks throws on close without open', () => {
  assert.throws(() => parsePromotedBlocks('<!-- /promoted -->'));
});

test('replacePromotedBlocks keeps hand-written lines byte-identical', () => {
  const text = 'hand A\n<!-- promoted-from: old/ -->\nold body\n<!-- /promoted -->\nhand B';
  const out = replacePromotedBlocks(text, [{ source: 'old/', body: 'new body' }]);
  assert.equal(out, 'hand A\n<!-- promoted-from: old/ -->\nnew body\n<!-- /promoted -->\nhand B\n');
});

test('replacePromotedBlocks drops promoted blocks whose source is gone and appends new sources', () => {
  const text = 'keep\n<!-- promoted-from: gone/ -->\nold\n<!-- /promoted -->\ntail';
  const out = replacePromotedBlocks(text, [{ source: 'fresh/', body: 'new' }]);
  assert.equal(out, 'keep\ntail\n\n<!-- promoted-from: fresh/ -->\nnew\n<!-- /promoted -->\n');
});

test('replacePromotedBlocks appends blocks to empty text without leading newline, but with trailing newline', () => {
  const out = replacePromotedBlocks('', [{ source: 'x/', body: 'b' }]);
  assert.equal(out, '<!-- promoted-from: x/ -->\nb\n<!-- /promoted -->\n');
});

test('replacePromotedBlocks does not double up trailing newline when source already ends with one', () => {
  const text = 'hand A\n<!-- promoted-from: old/ -->\nold body\n<!-- /promoted -->\nhand B\n';
  const out = replacePromotedBlocks(text, [{ source: 'old/', body: 'new body' }]);
  assert.equal(out, 'hand A\n<!-- promoted-from: old/ -->\nnew body\n<!-- /promoted -->\nhand B\n');
});

test('replacePromotedBlocks throws on malformed existing markers', () => {
  assert.throws(() => replacePromotedBlocks('a\n<!-- promoted-from: x -->\nno end', []));
  assert.throws(() => replacePromotedBlocks('a\n<!-- /promoted -->\n', []));
});

test('replacePromotedBlocks throws on nested promoted markers', () => {
  assert.throws(
    () => replacePromotedBlocks('<!-- promoted-from: a/ -->\n<!-- promoted-from: b/ -->\nbody\n<!-- /promoted -->', []),
    /knowledge: nested promoted marker/,
  );
});

test('replacePromotedBlocks throws on nested markers surrounded by content', () => {
  assert.throws(
    () => replacePromotedBlocks('a\n<!-- promoted-from: x/ -->\n<!-- promoted-from: y/ -->\nz\n<!-- /promoted -->\nb', []),
    /knowledge: nested promoted marker/,
  );
});

test('replacePromotedBlocks throws on duplicate source in blocks (existing block for that source present)', () => {
  const text = 'keep\n<!-- promoted-from: S -->\nold\n<!-- /promoted -->\ntail';
  assert.throws(
    () => replacePromotedBlocks(text, [{ source: 'S', body: 'b1' }, { source: 'S', body: 'b2' }]),
    /knowledge: duplicate promoted source: S/,
  );
});

test('replacePromotedBlocks throws on duplicate source in blocks (no existing block for that source)', () => {
  assert.throws(
    () => replacePromotedBlocks('hand-written only, no markers', [{ source: 'S', body: 'b1' }, { source: 'S', body: 'b2' }]),
    /knowledge: duplicate promoted source: S/,
  );
});

test('replacePromotedBlocks throws when a body contains a promoted marker string', () => {
  assert.throws(
    () => replacePromotedBlocks('', [{ source: 'x/', body: 'oops <!-- /promoted --> mid-body' }]),
    /knowledge: body contains marker string/,
  );
  assert.throws(
    () => replacePromotedBlocks('', [{ source: 'y/', body: 'oops <!-- promoted-from: z/ -->' }]),
    /knowledge: body contains marker string/,
  );
});

test('replacePromotedBlocks treats a missing body as an explicit empty string, not the literal "undefined"', () => {
  const out = replacePromotedBlocks('', [{ source: 'x/' }]);
  assert.equal(out, '<!-- promoted-from: x/ -->\n\n<!-- /promoted -->\n');
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
