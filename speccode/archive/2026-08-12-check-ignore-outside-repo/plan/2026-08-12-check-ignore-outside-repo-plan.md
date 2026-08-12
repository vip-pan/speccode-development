# creating-worktree worktree_dir gitignore 校验修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 worktree 目录在仓库外时 `/speccode:creating-worktree` 的 gitignore 校验误报(`git check-ignore` exit 128 被误读为「未忽略」)。

**Architecture:** `lib/detect.mjs` 新增 `isPathInside`(纯路径 containment,resolve 归一 + 分隔符)与 `worktreeDirIgnoreState`(三分支:仓库外不碰 git);扩展 `resolve-worktree-dir` verb 返回 `ignore`;命令层只按 `ignore` 分支。仓库外路径永不进入 `git check-ignore`,从根上消除 fatal/exit 128。

**Tech Stack:** Node ≥ 24 纯 ESM、`node:test`、tmprepo 真实 git 仓库、零第三方依赖。

## Global Constraints

- Node ≥ 24,纯 ESM,零第三方依赖(仅 `node:` 内置模块)
- 确定性逻辑下沉 lib(`detect.mjs`);命令层(`creating-worktree.md`)只做分支,不重复实现
- 仓库外路径 MUST NOT 进入 `git check-ignore`(消除 fatal 噪音与 exit 128 误读)
- 涉及 git 的测试用 tmprepo `makeRepo()` / `commitFile()` 建真实临时仓库,`rmSync` 清理
- 全量测试必须用 glob:`node --test ./plugins/speccode/tests/*.test.mjs`(裸跑目录在 Node v24 报 MODULE_NOT_FOUND)
- 提交消息末尾带 `Co-Authored-By: Claude <noreply@anthropic.com>`
- 每个任务只动本任务 Files 列出的文件

---

### Task 1: `isPathInside` 纯函数

**Files:**
- Modify: `plugins/speccode/lib/detect.mjs:1`(import 行加 `resolve, sep`)
- Test: `plugins/speccode/tests/detect.test.mjs:3-5`(import 加 `isPathInside`)

**Interfaces:**
- Consumes: 无
- Produces: `isPathInside(root: string, target: string) => boolean` — target 相对/绝对均可,一律 `resolve(root, target)` 相对 root 归一

- [ ] **Step 1: 写失败测试**(在 detect.test.mjs 末尾追加)

```js
test('isPathInside: inside / outside / relative / sibling-prefix / root-self', () => {
  assert.equal(isPathInside('/repo', '/repo/a/b'), true);
  assert.equal(isPathInside('/repo', '/other'), false);
  assert.equal(isPathInside('/repo', 'a/b'), true);         // 相对 target 按 root 解析
  assert.equal(isPathInside('/repo', '/repo-evil'), false); // 兄弟前缀陷阱
  assert.equal(isPathInside('/repo', '/repo'), true);       // root 自身
});
```

并把顶部 import 改为:
```js
import {
  KNOWLEDGE_TOOL_DETECTORS, detectKnowledgeTools, resolveWorktreeDir, isPathInside,
} from '../lib/detect.mjs';
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: FAIL — `isPathInside is not a function`

- [ ] **Step 3: 写最小实现**(detect.mjs)

改 import 行:
```js
import { join, resolve, sep } from 'node:path';
```

在 `resolveWorktreeDir` 之后追加:
```js
// 判定 target 是否位于 root 之内(含 root 自身)。target 相对/绝对均可,
// 一律 resolve(root, target) 归一;前缀补分隔符防 /repo vs /repo-evil 兄弟前缀误判。
export function isPathInside(root, target) {
  const normalized = resolve(root) + sep;
  return resolve(root, target).startsWith(normalized);
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/lib/detect.mjs plugins/speccode/tests/detect.test.mjs
git commit -m "feat(detect): add isPathInside containment helper" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: `worktreeDirIgnoreState` 三分支

**Files:**
- Modify: `plugins/speccode/lib/detect.mjs`(加 `import { git }` 与函数)
- Test: `plugins/speccode/tests/detect.test.mjs`(import 加 `worktreeDirIgnoreState`,追加测试)

**Interfaces:**
- Consumes: `isPathInside(root, target)`, `git(args, {cwd, allowFail})`(来自 `./git.mjs`)
- Produces: `worktreeDirIgnoreState(repoRootDir: string, dir: string) => {scope:'outside'} | {scope:'inside', ignored: boolean}`

- [ ] **Step 1: 写失败测试**(detect.test.mjs 末尾追加)

```js
test('worktreeDirIgnoreState: 仓库外目录返回 outside 且不碰 git', () => {
  assert.deepEqual(worktreeDirIgnoreState('/repo', '/outside/dir'), { scope: 'outside' });
});
```

顶部 import 追加 `worktreeDirIgnoreState`:
```js
import {
  KNOWLEDGE_TOOL_DETECTORS, detectKnowledgeTools, resolveWorktreeDir,
  isPathInside, worktreeDirIgnoreState,
} from '../lib/detect.mjs';
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: FAIL — `worktreeDirIgnoreState is not a function`

- [ ] **Step 3: 写最小实现**(detect.mjs)

顶部加 import:
```js
import { git } from './git.mjs';
```

在 `isPathInside` 之后追加:
```js
// creating-worktree 的 gitignore 校验:仓库外目录永不被 git 跟踪 → outside,
// 且不调用 git(其对外部路径 fatal+exit 128);仅仓库内分支跑 check-ignore。
// 查询带尾斜杠:check-ignore 对不存在的路径无法判断「目录」语义,裸路径
// 即使被 dir 模式(.wt/)忽略也会返回 exit 1;`<dir>/` 明确按目录判定。
export function worktreeDirIgnoreState(repoRootDir, dir) {
  if (!isPathInside(repoRootDir, dir)) return { scope: 'outside' };
  const r = git(['check-ignore', '-q', `${dir.replace(/\/+$/, '')}/`], { cwd: repoRootDir, allowFail: true });
  return { scope: 'inside', ignored: r.code === 0 };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/lib/detect.mjs plugins/speccode/tests/detect.test.mjs
git commit -m "feat(detect): add worktreeDirIgnoreState three-state check" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: 扩展 `resolve-worktree-dir` verb + cli 回归

**Files:**
- Modify: `plugins/speccode/bin/speccode.mjs:10`(import 行加 `worktreeDirIgnoreState`)与 `:119-122`(verb 体)
- Test: `plugins/speccode/tests/cli.test.mjs`(import 行加 `mkdtempSync`、`tmpdir`;末尾追加 3 条测试)

**Interfaces:**
- Consumes: `resolveWorktreeDir(cfg)`, `worktreeDirIgnoreState(repoRoot, dir)`, `repoRoot(cwd)`, `loadConfig`, `speccodeDirOf(cwd)`
- Produces: verb 返回 `{ok:true, dir, source, ignore}`(新增字段,向后兼容)

- [ ] **Step 1: 写失败测试**(cli.test.mjs)

改 import 行(node:fs 加 `mkdtempSync`,新增 node:os):
```js
import { rmSync, mkdirSync, realpathSync, writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
```

文件末尾追加 3 条测试:
```js
test('resolve-worktree-dir: 仓库外 worktree_dir → ignore.scope outside(无 fatal)', () => {
  const repo = makeRepo();
  const outside = mkdtempSync(join(tmpdir(), 'speccode-outside-'));
  const w = spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 2, worktree_dir: outside }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  const { code, json } = runCli(repo, 'resolve-worktree-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.dir, outside);
  assert.deepEqual(json.ignore, { scope: 'outside' });
  rmSync(outside, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

test('resolve-worktree-dir: 仓库内未忽略 → ignore inside+ignored:false', () => {
  const repo = makeRepo();
  const w = spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 2, worktree_dir: '.wt' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  const { code, json } = runCli(repo, 'resolve-worktree-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual(json.ignore, { scope: 'inside', ignored: false });
  rmSync(repo, { recursive: true, force: true });
});

test('resolve-worktree-dir: 仓库内已忽略 → ignore inside+ignored:true', () => {
  const repo = makeRepo();
  commitFile(repo, '.gitignore', '.wt/\n', 'ignore .wt');
  const w = spawnSync('node', [BIN, 'write-config', '--cwd', repo, '--json-stdin'],
    { cwd: repo, input: JSON.stringify({ version: 2, worktree_dir: '.wt' }), encoding: 'utf8' });
  assert.equal(w.status, 0);
  const { code, json } = runCli(repo, 'resolve-worktree-dir', '--cwd', repo);
  assert.equal(code, 0);
  assert.deepEqual(json.ignore, { scope: 'inside', ignored: true });
  rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="resolve-worktree-dir" plugins/speccode/tests/cli.test.mjs`
Expected: 既有 2 条(默认/配置值)仍 PASS;新增 3 条 FAIL(`json.ignore` 为 undefined,assert.deepEqual 不匹配)

- [ ] **Step 3: 写最小实现**(bin/speccode.mjs)

改 import 行:
```js
import { detectKnowledgeTools, resolveWorktreeDir, worktreeDirIgnoreState } from '../lib/detect.mjs';
```

改 verb 体(现 119-122 行):
```js
'resolve-worktree-dir': ({ cwd }) => {
  const cfg = loadConfig(speccodeDirOf(cwd));
  const { dir, source } = resolveWorktreeDir(cfg);
  return { ok: true, dir, source, ignore: worktreeDirIgnoreState(repoRoot(cwd), dir) };
},
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test --test-name-pattern="resolve-worktree-dir" plugins/speccode/tests/cli.test.mjs`
Expected: 5 条全 PASS

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/bin/speccode.mjs plugins/speccode/tests/cli.test.mjs
git commit -m "feat(cli): resolve-worktree-dir returns ignore state" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4: 命令层三分支

**Files:**
- Modify: `plugins/speccode/commands/creating-worktree.md:29-31`

**Interfaces:**
- Consumes: `resolve-worktree-dir` verb 返回的 `ignore` 字段(`{scope:'outside'}` / `{scope:'inside', ignored}`)
- Produces: 无(prose 分支逻辑)

- [ ] **Step 1: 修改命令 prose**

把 29-31 行:
```markdown
2. **gitignore 校验(warn-only)**:`git check-ignore -q <dir>`。
   - 未被忽略(退出码非 0,即该目录会被 git 跟踪)→ 警告"worktree 目录 <dir> 未被 .gitignore 忽略,worktree 元数据可能进入 git;建议先加入 .gitignore",询问用户是否继续。
   - 已被忽略 → 静默继续。
```
替换为:
```markdown
2. **gitignore 校验(warn-only)**:按 `resolve-worktree-dir` 返回的 `ignore` 字段三分支:
   - `ignore.scope === "outside"` → 仓库外目录,永不被 git 跟踪 → 静默继续。
   - `ignore.scope === "inside" && ignore.ignored === false` → 警告"worktree 目录 <dir> 未被 .gitignore 忽略,worktree 元数据可能进入 git;建议先加入 .gitignore",询问用户是否继续。
   - `ignore.scope === "inside" && ignore.ignored === true` → 已忽略 → 静默继续。
```

- [ ] **Step 2: 校验**

Run: `grep -n "check-ignore" plugins/speccode/commands/creating-worktree.md`
Expected: 无裸 `git check-ignore -q <dir>` 命令残留;仅出现 "gitignore 校验" 标题与分支说明

- [ ] **Step 3: 提交**

```bash
git add plugins/speccode/commands/creating-worktree.md
git commit -m "docs(speccode): creating-worktree three-branch gitignore check" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 5: README 核对 + 全量绿

**Files:**
- Verify: `plugins/speccode/README.md:30,:195` 与 `plugins/speccode/README_CN.md:30`(仅核对,措辞不变则不修改)

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 核对 README 措辞**

R6 表述「creating-worktree runs a check-ignore validation」在修复后依然成立(校验仍在,只是语义修正);命令表「check-ignore 校验」措辞不变 → 预期**零改动**。若措辞确需调整,必须 EN/CN 双语同步。

- [ ] **Step 2: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: PASS — 基线 137 + 新增 5(1 isPathInside + 1 worktreeDirIgnoreState + 3 cli 回归)= 142,0 fail

- [ ] **Step 3: 若有改动才提交**

仅当 Step 1 发现措辞需改时:
```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md
git commit -m "docs(speccode): check-ignore wording" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```
(预期无改动,此步跳过)
