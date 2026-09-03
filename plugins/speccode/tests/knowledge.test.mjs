// plugins/speccode/tests/knowledge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, realpathSync, rmSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { knowledgeRoot, assertSafeRel, listTopics, parseDistilledBlocks, replaceDistilledBlocks, buildIndex, writeKnowledge, distilledMetaPath, readConsumedArchives, writeConsumedArchives, addConsumedArchives, archiveRoot, listArchiveBundles, unconsumedArchives } from '../lib/knowledge.mjs';
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
  const text = 'hand A\n<!-- distilled-from: cap/old -->\nold body\n<!-- /distilled -->\nhand B';
  const out = replaceDistilledBlocks(text, [{ source: 'cap/old', body: 'new body' }]);
  assert.equal(out, 'hand A\n<!-- distilled-from: cap/old -->\nnew body\n<!-- /distilled -->\nhand B\n');
});

test('replaceDistilledBlocks drops distilled blocks whose source is gone and appends new sources', () => {
  const text = 'keep\n<!-- distilled-from: gone/ -->\nold\n<!-- /distilled -->\ntail';
  const out = replaceDistilledBlocks(text, [{ source: 'cap/fresh', body: 'new' }]);
  assert.equal(out, 'keep\ntail\n\n<!-- distilled-from: cap/fresh -->\nnew\n<!-- /distilled -->\n');
});

test('replaceDistilledBlocks appends blocks to empty text without leading newline, but with trailing newline', () => {
  const out = replaceDistilledBlocks('', [{ source: 'cap/x', body: 'b' }]);
  assert.equal(out, '<!-- distilled-from: cap/x -->\nb\n<!-- /distilled -->\n');
});

test('replaceDistilledBlocks does not double up trailing newline when source already ends with one', () => {
  const text = 'hand A\n<!-- distilled-from: cap/old -->\nold body\n<!-- /distilled -->\nhand B\n';
  const out = replaceDistilledBlocks(text, [{ source: 'cap/old', body: 'new body' }]);
  assert.equal(out, 'hand A\n<!-- distilled-from: cap/old -->\nnew body\n<!-- /distilled -->\nhand B\n');
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
    () => replaceDistilledBlocks(text, [{ source: 'cap/x', body: 'b1' }, { source: 'cap/x', body: 'b2' }]),
    /knowledge: duplicate distilled source: cap\/x/,
  );
});

test('replaceDistilledBlocks throws on duplicate source in blocks (no existing block for that source)', () => {
  assert.throws(
    () => replaceDistilledBlocks('hand-written only, no markers', [{ source: 'cap/x', body: 'b1' }, { source: 'cap/x', body: 'b2' }]),
    /knowledge: duplicate distilled source: cap\/x/,
  );
});

test('replaceDistilledBlocks throws when a body contains a distilled marker string', () => {
  assert.throws(
    () => replaceDistilledBlocks('', [{ source: 'cap/x', body: 'oops <!-- /distilled --> mid-body' }]),
    /knowledge: body contains marker string/,
  );
  assert.throws(
    () => replaceDistilledBlocks('', [{ source: 'cap/y', body: 'oops <!-- distilled-from: z/ -->' }]),
    /knowledge: body contains marker string/,
  );
});

test('replaceDistilledBlocks treats a missing body as an explicit empty string, not the literal "undefined"', () => {
  const out = replaceDistilledBlocks('', [{ source: 'cap/x' }]);
  assert.equal(out, '<!-- distilled-from: cap/x -->\n\n<!-- /distilled -->\n');
});

test('replaceDistilledBlocks rejects non-cap-key sources on the write side', () => {
  for (const bad of ['old/', 'archive/2026-08-14-knowledge-set/', 'spec/knowledge-set/', 'x', 'cap/Knowledge-Set', 'cap/a_b', 'cap/a b', 'cap/', 'cap//a', '']) {
    assert.throws(
      () => replaceDistilledBlocks('hand\n', [{ source: bad, body: 'b' }]),
      /capability key/,
      JSON.stringify(bad),
    );
  }
});

test('replaceDistilledBlocks accepts cap/<kebab-slug> sources', () => {
  const out = replaceDistilledBlocks('', [{ source: 'cap/knowledge-set', body: 'b' }]);
  assert.equal(out, '<!-- distilled-from: cap/knowledge-set -->\nb\n<!-- /distilled -->\n');
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
  const text = 'hand A\n<!-- promoted-from: cap/old -->\nold body\n<!-- /promoted -->\nhand B\n';
  const out = replaceDistilledBlocks(text, [{ source: 'cap/old', body: 'new body' }]);
  assert.equal(out, 'hand A\n<!-- distilled-from: cap/old -->\nnew body\n<!-- /distilled -->\nhand B\n');
});

test('replaceDistilledBlocks drops legacy blocks whose source is gone', () => {
  const text = 'keep\n<!-- promoted-from: gone/ -->\nold\n<!-- /promoted -->\ntail';
  const out = replaceDistilledBlocks(text, []);
  assert.equal(out, 'keep\ntail\n');
});

test('distilledMetaPath points at <root>/_distilled.meta.json', () => {
  assert.equal(distilledMetaPath('/x/knowledge'), '/x/knowledge/_distilled.meta.json');
});

test('readConsumedArchives returns [] when sidecar missing', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  assert.deepEqual(readConsumedArchives(root), []);
  rmSync(repo, { recursive: true, force: true });
});

test('readConsumedArchives returns the consumed_archives list', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  writeFileSync(distilledMetaPath(root), JSON.stringify({ consumed_archives: ['2026-08-10-foo', '2026-08-11-bar'] }));
  assert.deepEqual(readConsumedArchives(root), ['2026-08-10-foo', '2026-08-11-bar']);
  rmSync(repo, { recursive: true, force: true });
});

test('readConsumedArchives throws on corrupt JSON', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  writeFileSync(distilledMetaPath(root), '{ not json');
  assert.throws(() => readConsumedArchives(root), /corrupt/);
  rmSync(repo, { recursive: true, force: true });
});

test('readConsumedArchives throws when consumed_archives is not an array', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  writeFileSync(distilledMetaPath(root), JSON.stringify({ consumed_archives: 'oops' }));
  assert.throws(() => readConsumedArchives(root), /corrupt/);
  rmSync(repo, { recursive: true, force: true });
});

test('writeConsumedArchives atomically writes deduped sorted list', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  const out = writeConsumedArchives(root, ['2026-08-11-bar', '2026-08-10-foo', '2026-08-11-bar']);
  assert.deepEqual(out, ['2026-08-10-foo', '2026-08-11-bar']);
  const file = JSON.parse(readFileSync(distilledMetaPath(root), 'utf8'));
  assert.deepEqual(file, { consumed_archives: ['2026-08-10-foo', '2026-08-11-bar'] });
  assert.ok(!existsSync(`${distilledMetaPath(root)}.${process.pid}.tmp`));
  rmSync(repo, { recursive: true, force: true });
});

test('addConsumedArchives merges new bundles into existing sidecar', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  writeConsumedArchives(root, ['2026-08-10-foo']);
  const out = addConsumedArchives(root, ['2026-08-11-bar', '2026-08-10-foo']);
  assert.deepEqual(out, ['2026-08-10-foo', '2026-08-11-bar']);
  rmSync(repo, { recursive: true, force: true });
});

test('addConsumedArchives creates sidecar when missing (bootstrap seed)', () => {
  const repo = makeRepo();
  const root = join(repo, 'speccode', 'knowledge');
  mkdirSync(root, { recursive: true });
  const out = addConsumedArchives(root, ['2026-08-10-foo']);
  assert.deepEqual(out, ['2026-08-10-foo']);
  assert.ok(existsSync(distilledMetaPath(root)));
  rmSync(repo, { recursive: true, force: true });
});

test('archiveRoot resolves to <worktree-root>/speccode/archive', () => {
  const repo = makeRepo();
  assert.equal(archiveRoot(repo), join(realpathSync(repo), 'speccode', 'archive'));
  rmSync(repo, { recursive: true, force: true });
});

test('unconsumedArchives returns [] when archive/ absent', () => {
  const repo = makeRepo();
  assert.deepEqual(unconsumedArchives(join(repo, 'speccode', 'archive'), []), []);
  rmSync(repo, { recursive: true, force: true });
});

test('unconsumedArchives subtracts consumed dir names and ignores non-dir entries', () => {
  const repo = makeRepo();
  const arch = join(repo, 'speccode', 'archive');
  mkdirSync(join(arch, '2026-08-10-foo'), { recursive: true });
  mkdirSync(join(arch, '2026-08-11-bar'), { recursive: true });
  mkdirSync(join(arch, '2026-08-12-baz'), { recursive: true });
  writeFileSync(join(arch, 'README.md'), 'x'); // 非目录条目须忽略
  assert.deepEqual(unconsumedArchives(arch, ['2026-08-10-foo']), ['2026-08-11-bar', '2026-08-12-baz']);
  rmSync(repo, { recursive: true, force: true });
});

test('unconsumedArchives ignores consumed entries pointing at non-existent bundles (R2 stale harmless)', () => {
  const repo = makeRepo();
  const arch = join(repo, 'speccode', 'archive');
  mkdirSync(join(arch, '2026-08-10-foo'), { recursive: true });
  assert.deepEqual(unconsumedArchives(arch, ['ghost']), ['2026-08-10-foo']);
  rmSync(repo, { recursive: true, force: true });
});

test('listArchiveBundles returns sorted on-disk bundle dir names, ignoring non-dir entries', () => {
  const repo = makeRepo();
  const arch = join(repo, 'speccode', 'archive');
  mkdirSync(join(arch, '2026-08-12-baz'), { recursive: true });
  mkdirSync(join(arch, '2026-08-10-foo'), { recursive: true });
  mkdirSync(join(arch, '2026-08-11-bar'), { recursive: true });
  writeFileSync(join(arch, 'README.md'), 'x'); // 非目录条目须忽略
  assert.deepEqual(listArchiveBundles(arch), ['2026-08-10-foo', '2026-08-11-bar', '2026-08-12-baz']);
  rmSync(repo, { recursive: true, force: true });
});

test('listArchiveBundles returns [] when archive/ absent', () => {
  const repo = makeRepo();
  assert.deepEqual(listArchiveBundles(join(repo, 'speccode', 'archive')), []);
  rmSync(repo, { recursive: true, force: true });
});

// withFileTypes reads the dirent from the directory entry itself — a dangling
// symlink is reported as a symlink (not a directory) and skipped, where a
// statSync(target) probe would throw ENOENT and take the whole run down.
test('listArchiveBundles skips dangling symlinks instead of throwing', () => {
  const repo = makeRepo();
  const arch = join(repo, 'speccode', 'archive');
  mkdirSync(join(arch, '2026-08-10-foo'), { recursive: true });
  symlinkSync(join(repo, 'no-such-target'), join(arch, 'dangling'));
  assert.deepEqual(listArchiveBundles(arch), ['2026-08-10-foo']);
  assert.deepEqual(unconsumedArchives(arch, []), ['2026-08-10-foo']);
  rmSync(repo, { recursive: true, force: true });
});
