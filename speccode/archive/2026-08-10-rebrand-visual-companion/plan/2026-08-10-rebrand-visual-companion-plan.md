# rebrand-visual-companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清除 references/visual-companion 的 superpowers 品牌残留与版本探路错误,修正 CLAUDE.md requirement 计数漂移,全程可机械验证。

**Architecture:** 3 个文件精确编辑(server.cjs 品牌/manifest/遥测块改写,frame-template.html 标题+死 CSS,CLAUDE.md 去计数),配一个冒烟脚本做红-绿验证;spec 防回归由 propose/ delta 承载(syncing 合并,不在本计划)。

**Tech Stack:** Node CJS 脚本 / bash 冒烟 / git

**输入文档:** `speccode/changes/rebrand-visual-companion/propose/`(proposal.md、design.md、specs/plugin-packaging/spec.md、tasks.md)

## Global Constraints

- 全程中文提交信息;改动只发生在 worktree 分支 `worktree-rebrand-visual-companion`。
- `module.exports` 对外接口(computeAcceptKey / encodeFrame / decodeFrame / browserLauncherForPlatform / OPCODES / MAX_FRAME_PAYLOAD_BYTES)MUST NOT 变化。
- 品牌条最终形态(用户已确认):纯文本 `speccode v<version>` + 链接读 plugin.json `homepage`;无 `<img>`、无第三方远程资源、无 `SUPERPOWERS_*` 符号残留。
- 遥测开关块整块移除(远程资源已消失,开关无作用对象):`TELEMETRY_DISABLE_ENV_VARS`、`SUPERPOWERS_TELEMETRY_DISABLED`、`isTruthyEnv`。
- 本仓测试边界:lib/CLI 有单测,references/ 无单测;本计划的测试 = 冒烟脚本 + 机械化 grep + 既有 134 全量。
- 全量测试:`node --test ./plugins/speccode/tests/*.test.mjs`,预期 134 pass / 0 fail。

---

### Task 1: server.cjs 品牌与 manifest 改写

**Files:**
- Modify: `plugins/speccode/references/visual-companion-scripts/server.cjs`(L105-112 常量块、L171 死 CSS、L208-225 版本函数、L227-232 isTruthyEnv、L242-252 brandMarkup)
- Test: `/tmp/smoke-brand.sh`(一次性冒烟,红-绿循环用)

**Interfaces:**
- Consumes: 无(首个任务)
- Produces: `readSpeccodeManifest()` → `{version: string, homepage: string}`;模块级常量 `SPECCODE_VERSION: string`、`SPECCODE_REPO_URL: string`;`brandMarkup()` 输出 `<div class="brand"><a href="{homepage}"><span class="brand-copy">speccode v{version}</span></a></div>`(Task 3 的冒烟断言依赖此形态)

- [ ] **Step 1: 写冒烟脚本(红的前置)**

写 `/tmp/smoke-brand.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
TMP=$(mktemp -d)
LOG="$TMP/server.log"
BRAINSTORM_DIR="$TMP/brainstorm" node plugins/speccode/references/visual-companion-scripts/server.cjs >"$LOG" 2>&1 &
SRV=$!
cleanup() { kill "$SRV" 2>/dev/null || true; rm -rf "$TMP"; }
trap cleanup EXIT
for i in $(seq 1 50); do grep -q server-started "$LOG" 2>/dev/null && break; sleep 0.1; done
URL=$(python3 -c "import json;print(json.loads(open('$LOG').readline())['url'])")
HTML=$(curl -fsS "$URL")
ok=1
printf '%s' "$HTML" | grep -q 'speccode v0.2.0' && echo "PASS footer: speccode v0.2.0" || { echo "FAIL footer: expected 'speccode v0.2.0'"; ok=0; }
printf '%s' "$HTML" | grep -qiE 'superpowers|primeradiant|obra' && { echo "FAIL: third-party branding in page"; ok=0; } || echo "PASS: no third-party branding"
printf '%s' "$HTML" | grep -q 'class="brand-logo"' && { echo "FAIL: remote logo <img> present"; ok=0; } || echo "PASS: no remote logo"
printf '%s' "$HTML" | grep -q 'https://github.com/vip-pan/speccode-development' && echo "PASS: footer link = plugin.json homepage" || { echo "FAIL: homepage link missing"; ok=0; }
[ $ok -eq 1 ] && echo SMOKE-PASS || { echo SMOKE-FAIL; exit 1; }
```

- [ ] **Step 2: 运行确认失败(红)**

Run: `bash /tmp/smoke-brand.sh`
Expected: SMOKE-FAIL —— 当前页脚渲染 `Superpowers vunknown` + 远程 logo,第 1/2/4 条断言失败。(注意:`cd "$(git rev-parse --show-toplevel)"` 在 worktree 内解析到 worktree 根,冒烟测的是 worktree 里的代码。)

- [ ] **Step 3: 实施 5 处编辑(Edit 工具,old_string 逐字取自当前文件)**

**编辑 A — L105-112 常量块:**

old:
```js
const SUPERPOWERS_VERSION = readSuperpowersVersion();
const SUPERPOWERS_BRAND_IMAGE_URL = 'https://primeradiant.com/brand/superpowers-visual-brainstorming-logo.png';
const TELEMETRY_DISABLE_ENV_VARS = [
  'SUPERPOWERS_DISABLE_TELEMETRY',
  'DISABLE_TELEMETRY',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'
];
const SUPERPOWERS_TELEMETRY_DISABLED = TELEMETRY_DISABLE_ENV_VARS.some(name => isTruthyEnv(process.env[name]));
```
new:
```js
const SPECCODE_MANIFEST = readSpeccodeManifest();
const SPECCODE_VERSION = SPECCODE_MANIFEST.version;
const SPECCODE_REPO_URL = SPECCODE_MANIFEST.homepage;
```

**编辑 B — waitingPage 死 CSS(L171,删整行):**

old(删除,连同换行):
```js
.brand-logo { display: block; height: 1em; width: auto; max-width: 180px; filter: invert(1); }
```

**编辑 C — L208-225 版本函数:**

old:
```js
function readSuperpowersVersion() {
  const root = path.join(__dirname, '../../..');
  const manifests = [
    path.join(root, 'package.json'),
    path.join(root, '.codex-plugin/plugin.json')
  ];

  for (const manifest of manifests) {
    try {
      const data = JSON.parse(fs.readFileSync(manifest, 'utf-8'));
      if (data.version) return String(data.version);
    } catch (e) {
      // Packaged Codex plugins omit package.json; try the next manifest.
    }
  }

  return 'unknown';
}
```
new:
```js
function readSpeccodeManifest() {
  const fallback = { version: 'unknown', homepage: 'https://github.com/vip-pan/speccode-development' };
  try {
    const manifest = path.join(__dirname, '..', '..', '.claude-plugin', 'plugin.json');
    const data = JSON.parse(fs.readFileSync(manifest, 'utf-8'));
    return {
      version: data.version ? String(data.version) : fallback.version,
      homepage: typeof data.homepage === 'string' && data.homepage ? data.homepage : fallback.homepage
    };
  } catch (e) {
    return fallback;
  }
}
```

**编辑 D — L227-232 isTruthyEnv 整块删除(含其后空行):**

old:
```js
function isTruthyEnv(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return !['0', 'false', 'no', 'off'].includes(normalized);
}

```
new:(空——整块删除)

**编辑 E — L242-252 brandMarkup:**

old:
```js
function brandMarkup() {
  const version = escapeHtmlText(SUPERPOWERS_VERSION);
  const text = SUPERPOWERS_TELEMETRY_DISABLED
    ? 'Prime Radiant Superpowers v' + version
    : 'Superpowers v' + version;
  const logo = SUPERPOWERS_TELEMETRY_DISABLED
    ? ''
    : '<img class="brand-logo" src="' + SUPERPOWERS_BRAND_IMAGE_URL + '?v=' + encodeURIComponent(SUPERPOWERS_VERSION) + '" alt="Prime Radiant" referrerpolicy="no-referrer" decoding="async">';

  return '<div class="brand"><a href="https://github.com/obra/superpowers">' + logo + '<span class="brand-copy">' + text + '</span></a></div>';
}
```
new:
```js
function brandMarkup() {
  const version = escapeHtmlText(SPECCODE_VERSION);
  const url = escapeHtmlText(SPECCODE_REPO_URL);
  return '<div class="brand"><a href="' + url + '"><span class="brand-copy">speccode v' + version + '</span></a></div>';
}
```

- [ ] **Step 4: 运行确认通过(绿)**

Run: `bash /tmp/smoke-brand.sh`
Expected: 四条 PASS + SMOKE-PASS。

- [ ] **Step 5: 语法与残留自检**

```bash
node -c plugins/speccode/references/visual-companion-scripts/server.cjs 2>/dev/null || node --check plugins/speccode/references/visual-companion-scripts/server.cjs
grep -ni "superpowers\|primeradiant\|obra\|isTruthyEnv\|brand-logo" plugins/speccode/references/visual-companion-scripts/server.cjs   # 预期空
```

- [ ] **Step 6: 提交**

```bash
git add plugins/speccode/references/visual-companion-scripts/server.cjs
git commit -m "fix(references): visual-companion 品牌改写为 speccode——版本/链接读 plugin.json,移除远程 logo 与遥测死开关"
```

### Task 2: frame-template.html 与 CLAUDE.md 文案清扫

**Files:**
- Modify: `plugins/speccode/references/visual-companion-scripts/frame-template.html`(L5 标题、L69-72 死 CSS)
- Modify: `CLAUDE.md`(L9 去计数)

**Interfaces:**
- Consumes: Task 1 已删除 logo `<img>` 生成逻辑(死 CSS 的清理对象因此成立)
- Produces: references/ 品牌 grep 零匹配(Task 3 验证)

- [ ] **Step 1: frame-template.html 标题**

old:`  <title>Superpowers Brainstorming</title>`
new:`  <title>speccode Brainstorming</title>`

- [ ] **Step 2: frame-template.html 死 CSS(L69-72,四行整删,含空媒体查询块)**

old:
```
    .brand-logo { display: block; height: 1em; width: auto; max-width: 180px; flex-shrink: 0; filter: invert(1); }
    @media (prefers-color-scheme: dark) {
      .brand-logo { filter: none; }
    }
```
new:(空——四行删除,保留前后行不动)

- [ ] **Step 3: CLAUDE.md L9 去计数**

old:`规格主档在 \`speccode/spec/\`(8 个 capability,74 requirements),归档在 \`speccode/archive/\`。`
new:`规格主档在 \`speccode/spec/\`(8 个 capability),归档在 \`speccode/archive/\`。`

- [ ] **Step 4: 验证**

```bash
grep -rni "superpowers\|primeradiant\|obra\|brand-logo" plugins/speccode/references/   # 预期空
grep -n "74 requirements\|75 requirements" CLAUDE.md                                    # 预期空
grep -n "speccode/spec/" CLAUDE.md                                                      # 预期 L7/L9 两处存在且语义完整
```

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/references/visual-companion-scripts/frame-template.html CLAUDE.md
git commit -m "docs: frame 标题改 speccode Brainstorming;CLAUDE.md 去掉手维 requirement 计数"
```

### Task 3: 整体验证(无新提交)

**Files:**
- 无改动;验证 Task 1-2 的提交树

**Interfaces:**
- Consumes: Task 1-2 全部产出
- Produces: propose/tasks.md 第 1-4 项可勾选的证据

- [ ] **Step 1: references 品牌零匹配**

```bash
grep -rni "superpowers\|primeradiant\|obra" plugins/speccode/references/ && echo "FAIL: 仍有残留" || echo "PASS: references 品牌零匹配"
```

- [ ] **Step 2: 冒烟复跑(确认两任务叠加后仍绿)**

Run: `bash /tmp/smoke-brand.sh`
Expected: 四条 PASS + SMOKE-PASS(页脚 `speccode v0.2.0`、链接 homepage、无品牌残留、无远程 logo)。

- [ ] **Step 3: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 134 pass / 0 fail。

- [ ] **Step 4: 勾选 tasks.md 1-4 并提交**

```bash
git add speccode/changes/rebrand-visual-companion/propose/tasks.md
git commit -m "docs(speccode): tick rebrand-visual-companion 实施任务完成"
```

## 计划自查记录

- **规格覆盖**:proposal What Changes 四条 → Task 1(server.cjs)、Task 2(frame/CLAUDE.md)、Task 3(验证);specs delta 由 /speccode:syncing 承载(tasks.md 第 5 项),不在本计划任务内,符合「文档是 delta 不是主规格」护栏。
- **占位符扫描**:无;所有编辑含逐字 old/new,冒烟脚本全文给出。
- **类型一致**:`readSpeccodeManifest()` 返回 `{version, homepage}`,`SPECCODE_VERSION`/`SPECCODE_REPO_URL` 在 Task 1 Step 3 定义、Step 4 冒烟断言其渲染形态;`module.exports` 不含任何被更名符号,既有 134 测试不受影响。
