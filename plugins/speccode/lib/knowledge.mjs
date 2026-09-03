// plugins/speccode/lib/knowledge.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { writeTextAtomic, writeJsonAtomic } from './atomic.mjs';
import { git } from './git.mjs';

// Tracked, curated knowledge set: <repo>/speccode/knowledge/ (peer of
// speccode/spec/ + changes/ + archive/ — tracked, ships with PRs, team-shared).
// Root = CURRENT worktree root (`--show-toplevel`), deliberately NOT the
// main-repo root used for .speccode/ runtime state: each worktree has its own
// checkout of tracked files (same deliberate split as lib/sdd.mjs worktreeRoot).
export function knowledgeRoot(cwd) {
  const top = git(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim();
  return join(top, 'speccode', 'knowledge');
}

// Guard for write-knowledge --rel: simple forward-slash relative paths only.
export function assertSafeRel(rel) {
  if (typeof rel !== 'string') return { ok: false, error: 'rel must be a string' };
  const s = String(rel);
  if (s.includes('\\') || s.startsWith('/') || s.includes('\0')) {
    return { ok: false, error: 'rel must be a simple forward-slash relative path' };
  }
  const parts = s.split('/');
  if (parts.some((seg) => seg === '' || seg === '.' || seg === '..')) {
    return { ok: false, error: 'rel must not contain empty, . or .. segments' };
  }
  return { ok: true, rel: s };
}

// Recursively list knowledge topic files (rel paths, .md only, `_index.md`
// excluded) plus the current index content (null when missing).
export function listTopics(root) {
  const files = [];
  const walk = (dir, rel) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(p).isDirectory()) walk(p, r);
      else if (name.endsWith('.md')) files.push(r);
    }
  };
  walk(root, '');
  const indexPath = join(root, '_index.md');
  return {
    files: files.filter((f) => f !== '_index.md').sort(),
    index: existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null,
  };
}

const DISTILLED_START = /^<!-- distilled-from:\s*(.+?)\s*-->$/;
const DISTILLED_END = '<!-- /distilled -->';
// Legacy pre-rename format ("promoted" era): parsed on read forever, never
// written. Existing knowledge files migrate to the current format on their
// next full rebuild (replaceDistilledBlocks rewrites every block it keeps).
const LEGACY_PROMOTED_START = /^<!-- promoted-from:\s*(.+?)\s*-->$/;
const LEGACY_PROMOTED_END = '<!-- /promoted -->';
// Write-side block identity (design D1): a distilled block's source is a
// capability key. The read side still accepts legacy provenance strings so
// existing files parse until their gated first-run migration.
const CAP_SOURCE_RE = /^cap\/[a-z0-9-]+$/;

// Extract distilled blocks as [{source, body}]. Both the current
// (distilled-from//distilled) and legacy (promoted-from//promoted) marker
// formats are recognized, in order of appearance; a block's closing marker
// must match its opening format. Malformed markers throw — corrupted
// knowledge files need a human, never silent repair (design D5).
// Source values may be legacy provenance strings (archive/<name>/,
// spec/<name>/) pending first-run capability-key migration — the write side
// rejects them until mapped.
export function parseDistilledBlocks(text) {
  const blocks = [];
  const lines = String(text).split('\n');
  let open = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isNew = DISTILLED_START.exec(line);
    const m = isNew || LEGACY_PROMOTED_START.exec(line);
    if (m) {
      if (open) throw new Error('knowledge: nested distilled marker');
      open = { source: m[1].trim(), start: i, end: isNew ? DISTILLED_END : LEGACY_PROMOTED_END };
    } else if (line.trim() === DISTILLED_END || line.trim() === LEGACY_PROMOTED_END) {
      if (!open) throw new Error('knowledge: closing distilled marker without opening');
      if (line.trim() !== open.end) throw new Error('knowledge: mismatched distilled marker');
      blocks.push({ source: open.source, body: lines.slice(open.start + 1, i).join('\n') });
      open = null;
    }
    i += 1;
  }
  if (open) throw new Error('knowledge: unclosed distilled marker');
  return blocks;
}

// Full rebuild of distilled blocks (design D2): every existing block —
// current or legacy format — is replaced by the new block with the same
// source, or dropped when its source is gone; kept and new blocks are always
// written in the CURRENT format, so a legacy-marked file migrates on its
// first rebuild. New sources are appended at the end (preceded by a blank
// line). Everything outside markers passes through untouched, so hand-written
// content is preserved byte-for-byte (split/join is lossless).
//
// `blocks` is validated up front: a duplicate `source` would silently drop
// one gate-confirmed block (whichever the write path or the append loop
// happens to keep), and a `body` containing a marker string would produce a
// file that parseDistilledBlocks then rejects as corrupt — both convert a
// silent wrong write into an explicit pre-write error (design D5).
export function replaceDistilledBlocks(text, blocks) {
  const seen = new Set();
  for (const b of blocks) {
    if (typeof b.source !== 'string' || !CAP_SOURCE_RE.test(b.source)) {
      throw new Error(`knowledge: distilled source must be a capability key (cap/<slug>): ${b.source}`);
    }
    if (seen.has(b.source)) throw new Error(`knowledge: duplicate distilled source: ${b.source}`);
    seen.add(b.source);
    const body = String(b.body ?? '');
    if (body.includes('<!--') || body.includes('-->')) {
      throw new Error('knowledge: body contains marker string');
    }
  }
  const lines = text === '' ? [] : String(text).split('\n');
  const hand = [];
  const blockOut = [];
  const emitted = new Set();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isNew = DISTILLED_START.exec(line);
    const m = isNew || LEGACY_PROMOTED_START.exec(line);
    if (m) {
      const source = m[1].trim();
      const end = isNew ? DISTILLED_END : LEGACY_PROMOTED_END;
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== end) {
        if (DISTILLED_START.exec(lines[j]) || LEGACY_PROMOTED_START.exec(lines[j])) {
          throw new Error('knowledge: nested distilled marker');
        }
        j += 1;
      }
      if (j >= lines.length) throw new Error('knowledge: unclosed distilled marker');
      const block = blocks.find((b) => b.source === source);
      if (block) {
        blockOut.push(`<!-- distilled-from: ${source} -->\n${String(block.body ?? '')}\n${DISTILLED_END}`);
        emitted.add(source);
      }
      i = j + 1;
      continue;
    }
    if (line.trim() === DISTILLED_END || line.trim() === LEGACY_PROMOTED_END) {
      throw new Error('knowledge: closing distilled marker without opening');
    }
    hand.push(line);
    i += 1;
  }
  for (const b of blocks) {
    if (emitted.has(b.source)) continue;
    blockOut.push(`<!-- distilled-from: ${b.source} -->\n${String(b.body ?? '')}\n${DISTILLED_END}`);
  }
  // Canonical layout: hand-written section first, then distilled blocks, one
  // blank line between adjacent sections. Hand lines only MOVE (each line's
  // bytes survive); trailing blank lines collapse into the section
  // separators so a second run is byte-identical (idempotent).
  const handText = hand.join('\n').replace(/\n+$/, '');
  const sections = hand.length > 0 ? [handText, ...blockOut] : blockOut;
  const joined = sections.join('\n\n');
  return joined === '' || joined.endsWith('\n') ? joined : `${joined}\n`;
}

// Render the _index.md retrieval entry: grouped topic lines with one-line
// summaries. Deterministic — regenerate on demand (design: 索引失修时重建).
export function buildIndex(entries) {
  const lines = ['# 知识索引'];
  for (const { section, items } of entries) {
    lines.push('', `## ${section}`);
    for (const { title, file, summary } of items) {
      lines.push(`- ${title} → ${file}:${summary}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

// Atomic write of a knowledge file (rel must already be validated by
// assertSafeRel at the verb layer).
export function writeKnowledge(root, rel, content) {
  const p = join(root, rel);
  writeTextAtomic(p, content);
  return p;
}

// Path to the distill-consumption sidecar: <knowledge>/_distilled.meta.json.
// Tracks which archive bundles distilling-knowledge has already consumed, so
// subsequent runs read archive/ incrementally (only unconsumed bundles).
export function distilledMetaPath(root) {
  return join(root, '_distilled.meta.json');
}

// Read consumed_archives from the sidecar. Missing file → [] (triggers first-
// run bootstrap full read). Corrupt JSON / wrong shape → throw (no silent
// repair, same principle as malformed distilled markers — a corrupted meta
// needs a human).
export function readConsumedArchives(root) {
  const p = distilledMetaPath(root);
  if (!existsSync(p)) return [];
  let obj;
  try {
    obj = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    throw new Error('knowledge: _distilled.meta.json is corrupt (invalid JSON)');
  }
  if (!Array.isArray(obj?.consumed_archives)) {
    throw new Error('knowledge: _distilled.meta.json is corrupt (no consumed_archives array)');
  }
  return obj.consumed_archives.filter((s) => typeof s === 'string');
}

// Atomic write of the consumed_archives sidecar (dedup + sort; order is
// irrelevant but sorting keeps diffs stable). Mirrors config/state atomicity.
export function writeConsumedArchives(root, list) {
  const consumed = [...new Set(list.filter((s) => typeof s === 'string'))].sort();
  writeJsonAtomic(distilledMetaPath(root), { consumed_archives: consumed });
  return consumed;
}

// Merge bundles read this distilling run into the existing sidecar
// (read ∪ bundles), then atomically persist. Idempotent: re-adding
// already-consumed bundles is a no-op write (same set).
export function addConsumedArchives(root, bundles) {
  const merged = [...new Set([...readConsumedArchives(root), ...bundles.filter((s) => typeof s === 'string')])];
  return writeConsumedArchives(root, merged);
}

// Path to the worktree's speccode/archive/ (tracked, per-worktree, peer of
// speccode/knowledge/). Uses --show-toplevel deliberately — same worktree root
// resolution as knowledgeRoot (NOT the main-repo --git-common-dir used for
// .speccode/ runtime state). See CLAUDE.md "SDD 工作区 show-toplevel(有意差异)".
export function archiveRoot(cwd) {
  const top = git(['rev-parse', '--show-toplevel'], { cwd }).stdout.trim();
  return join(top, 'speccode', 'archive');
}

// On-disk archive bundle dir names (sorted). Consumed-archive tracking is
// pure read-cost control: it decides which bundles distilling reads this run,
// nothing else (block freshness is audited against spec/, not bundle
// existence). Returns [] when archive/ is absent (fresh project / no archived
// changes yet).
//
// readdirSync({withFileTypes:true}) reads each entry's type from the directory
// entry itself: non-directories (README.md, a dangling symlink) are skipped
// rather than probed, where a statSync(join(...)) follow would throw ENOENT on
// a dangling symlink and take the whole distill run down.
export function listArchiveBundles(archiveRootPath) {
  if (!existsSync(archiveRootPath)) return [];
  return readdirSync(archiveRootPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort();
}

// Archive bundles not yet consumed = on-disk bundle names − consumed set.
// Compares by directory NAME (string), not absolute path, so the macOS
// /var→/private/var realpath issue (C1) does not bite here. Returns [] when
// archive/ is absent (fresh project / no archived changes yet).
export function unconsumedArchives(archiveRootPath, consumed) {
  const consumedSet = new Set(consumed);
  return listArchiveBundles(archiveRootPath).filter((name) => !consumedSet.has(name));
}
