// plugins/speccode/lib/knowledge.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { writeTextAtomic } from './atomic.mjs';
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

const PROMOTED_START = /^<!-- promoted-from:\s*(.+?)\s*-->$/;
const PROMOTED_END = '<!-- /promoted -->';

// Extract promoted blocks as [{source, body}]. Malformed markers throw —
// corrupted knowledge files need a human, never silent repair (design D5).
export function parsePromotedBlocks(text) {
  const blocks = [];
  const lines = String(text).split('\n');
  let open = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = PROMOTED_START.exec(line);
    if (m) {
      if (open) throw new Error('knowledge: nested promoted marker');
      open = { source: m[1].trim(), start: i };
    } else if (line.trim() === PROMOTED_END) {
      if (!open) throw new Error('knowledge: closing promoted marker without opening');
      blocks.push({ source: open.source, body: lines.slice(open.start + 1, i).join('\n') });
      open = null;
    }
    i += 1;
  }
  if (open) throw new Error('knowledge: unclosed promoted marker');
  return blocks;
}

// Full rebuild of promoted blocks (design D2): every existing promoted block
// is replaced by the new block with the same source, or dropped when its
// source is gone; new sources are appended at the end (preceded by a blank
// line). Everything outside markers passes through untouched, so hand-written
// content is preserved byte-for-byte (split/join is lossless).
//
// `blocks` is validated up front: a duplicate `source` would silently drop
// one gate-confirmed block (whichever the write path or the append loop
// happens to keep), and a `body` containing a marker string would produce a
// file that parsePromotedBlocks then rejects as corrupt — both convert a
// silent wrong write into an explicit pre-write error (design D5).
export function replacePromotedBlocks(text, blocks) {
  const seen = new Set();
  for (const b of blocks) {
    if (seen.has(b.source)) throw new Error(`knowledge: duplicate promoted source: ${b.source}`);
    seen.add(b.source);
    const body = String(b.body ?? '');
    if (body.includes('<!--') || body.includes('-->')) {
      throw new Error('knowledge: body contains marker string');
    }
  }
  const lines = text === '' ? [] : String(text).split('\n');
  const out = [];
  const emitted = new Set();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = PROMOTED_START.exec(line);
    if (m) {
      const source = m[1].trim();
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== PROMOTED_END) {
        if (PROMOTED_START.exec(lines[j])) throw new Error('knowledge: nested promoted marker');
        j += 1;
      }
      if (j >= lines.length) throw new Error('knowledge: unclosed promoted marker');
      const block = blocks.find((b) => b.source === source);
      if (block) {
        out.push(`<!-- promoted-from: ${source} -->`, String(block.body ?? ''), PROMOTED_END);
        emitted.add(source);
      }
      i = j + 1;
      continue;
    }
    if (line.trim() === PROMOTED_END) {
      throw new Error('knowledge: closing promoted marker without opening');
    }
    out.push(line);
    i += 1;
  }
  for (const b of blocks) {
    if (emitted.has(b.source)) continue;
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
    out.push(`<!-- promoted-from: ${b.source} -->`, String(b.body ?? ''), PROMOTED_END);
  }
  // Mirror buildIndex's trailing newline, but only when the join doesn't
  // already end with one (source already ending in `\n` round-trips through
  // split/join as a trailing '' element — adding another would double it).
  const joined = out.join('\n');
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
