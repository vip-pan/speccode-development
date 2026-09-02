# askuserquestion-cr-sanitizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 插件自带 PreToolUse hook，在 AskUserQuestion 执行前剥离 tool_input 中 GLM 注入的 CR（U+000D），消除中文提问乱码。

**Architecture:** 清洗逻辑为 `lib/sanitize.mjs` 纯函数（深递归剥 CR、无 CR 快路径），hook 壳 `hooks/sanitize-ask.mjs` 只做 stdin/stdout 编排（fail-open），`hooks/hooks.json` 声明插件级 hook（`${CLAUDE_PLUGIN_ROOT}` 引用）。Task 1 是 spike 门禁：先真机验证 `updatedInput` 确实被 Claude Code 采纳，不过则停下交用户决策。

**Tech Stack:** Node ≥ 24 纯 ESM、`node:` 内置模块、`node:test` + `node:assert/strict`、`spawnSync` 子进程测试、Claude Code hooks 协议（PreToolUse / `updatedInput`）。

## Global Constraints

- Node ≥ 24，纯 ESM，仅 `node:` 内置模块 import
- 确定性逻辑 MUST 下沉 `lib/`，hook 壳 MUST NOT 内联清洗实现
- 清洗范围仅 U+000D（`\r`）；不清洗其他控制字符
- fail-open：hook 任何异常（stdin 非法、清洗抛错、载荷缺字段）MUST exit 0 且无输出，放行原输入，绝不阻断 AskUserQuestion
- 全量测试命令必须用 glob：`node --test ./plugins/speccode/tests/*.test.mjs`（裸目录形式在 Node v24 会 MODULE_NOT_FOUND）
- 测试风格：`node:test` + `node:assert/strict`；子进程测试用 `spawnSync('node', [...])`
- 代码注释英文（跟既有 lib 一致）；文档中文；README 改动 MUST 双语同步（README.md=EN / README_CN.md=zh）
- 不改任何 `commands/*.md`；不 bump `plugin.json` version；CHANGELOG 只写 `[Unreleased]` 小节
- 工作目录：本计划在 worktree `/Users/game-netease/orca/workspaces/speccode-development/worktree-askuserquestion-cr-sanitizer` 内执行（下文 `$WT` 即此路径）；主仓指 `$WT` 的上游主仓库路径

---

### Task 1: Spike——真机验证 PreToolUse `updatedInput`（门禁）

**Files:**
- Create: `/tmp/spike-sanitize.mjs`（临时，验证后删除）
- Modify: 主仓 `.claude/settings.local.json`（临时插入一段 hook 配置，验证后还原）

**Interfaces:**
- Consumes: 无（独立探路）
- Produces: 结论「`hookSpecificOutput.updatedInput` 是否被 Claude Code 2.1.258 采纳」+ `/tmp/spike-hook-payload.json` 里记录的真实 hook 载荷结构。Task 3 的输出 JSON 结构以本结论为准

> **注意：本任务 MUST 在主会话内联执行**（需要真实调用 AskUserQuestion 并让用户观察渲染），subagent 无法代劳。全计划只有本任务有此约束。

- [x] **Step 1: 写 spike 脚本**（哨兵改写法：若 `updatedInput` 被采纳，用户会看到哨兵问题文本，肉眼即可判定）

写入 `/tmp/spike-sanitize.mjs`：

```js
// Spike: verify PreToolUse updatedInput is honored by Claude Code.
// Logs the raw payload, then rewrites the question to a sentinel.
import { readFileSync, writeFileSync } from 'node:fs';
try {
  const raw = readFileSync(0, 'utf8');
  const payload = JSON.parse(raw);
  writeFileSync('/tmp/spike-hook-payload.json', JSON.stringify(payload, null, 2));
  if (payload?.tool_name === 'AskUserQuestion') {
    const cleaned = JSON.parse(JSON.stringify(payload.tool_input));
    cleaned.questions = [{
      question: 'SPIKE-OK: updatedInput 已被采纳(本问题为哨兵文本,直接选任意项)',
      header: 'Spike',
      options: [{ label: '看到了', description: 'updatedInput 生效' }],
      multiSelect: false,
    }];
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: cleaned,
      },
    }));
  }
} catch {
  // fail-open
}
```

- [x] **Step 2: 临时注册 hook**——编辑主仓 `.claude/settings.local.json`，在既有 `"hooks"` 对象内插入（与既有 `SessionStart` 键并列，其余内容不动）：

```json
"PreToolUse": [
  {
    "matcher": "AskUserQuestion",
    "hooks": [
      { "type": "command", "command": "node /tmp/spike-sanitize.mjs" }
    ]
  }
]
```

注意：hooks 配置在会话启动时快照，改动后可能需要重启会话或在 `/hooks` 菜单确认后生效；若调用后 `/tmp/spike-hook-payload.json` 未生成，先按此排查。

- [x] **Step 3: 真机调用**——主会话调用一次 AskUserQuestion（question 原文随意），用户确认弹出的是否为哨兵文本。

- [x] **Step 4: 记录结论**——哨兵出现 → 结论「updatedInput 生效」，读 `/tmp/spike-hook-payload.json` 把真实载荷字段列表记入本 plan 下方「Spike 结论」段；哨兵未出现（用户看到原始问题）→ 结论「不生效」，**停止后续任务**，向用户报告二选一：改用 deny+reason 降级方案（体验差）或放弃本变更。

- [x] **Step 5: 清理现场**——从主仓 `.claude/settings.local.json` 删除 Step 2 插入的 `PreToolUse` 块；`rm /tmp/spike-sanitize.mjs`（保留 `/tmp/spike-hook-payload.json` 供 Task 3 参考）。

### Task 2: `lib/sanitize.mjs` 纯函数（TDD）

**Files:**
- Create: `$WT/plugins/speccode/lib/sanitize.mjs`
- Test: `$WT/plugins/speccode/tests/sanitize.test.mjs`

**Interfaces:**
- Consumes: 无
- Produces: `stripCR(value)`——输入任意 JSON 值，返回剥离所有字符串内 U+000D 后的值；无 CR 时返回原引用（快路径），有 CR 时返回新容器。Task 3 的 hook 壳 import 它

- [x] **Step 1: 写失败测试** `$WT/plugins/speccode/tests/sanitize.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripCR } from '../lib/sanitize.mjs';

test('stripCR removes CR in a top-level string', () => {
  assert.equal(stripCR('分支名\r用哪个\r?'), '分支名用哪个?');
});

test('stripCR recurses nested objects and arrays', () => {
  const input = {
    questions: [
      { question: 'a\rb\r\rc?', options: [{ label: 'x\r', description: 'ok' }] },
    ],
  };
  assert.equal(stripCR(input).questions[0].question, 'abrc?');
  assert.equal(stripCR(input).questions[0].options[0].label, 'x');
});

test('stripCR leaves non-string values untouched', () => {
  const input = { n: 3, b: false, nil: null, arr: [1, true] };
  assert.deepEqual(stripCR(input), input);
});

test('stripCR handles CR at start, end, and in runs', () => {
  assert.equal(stripCR('\r\rlead'), 'lead');
  assert.equal(stripCR('tail\r'), 'tail');
  assert.equal(stripCR('mid\r\r\rdle'), 'middle');
});

test('stripCR returns the same reference when no CR present', () => {
  const input = { q: 'no cr here', opts: [{ label: 'a' }] };
  assert.equal(stripCR(input), input);
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test $WT/plugins/speccode/tests/sanitize.test.mjs`
Expected: FAIL（`Cannot find module .../lib/sanitize.mjs`）

- [x] **Step 3: 写最小实现** `$WT/plugins/speccode/lib/sanitize.mjs`：

```js
// Strip U+000D (CR) from every string in a JSON value, recursively.
// Fast path: an input containing no CR is returned by reference.
export function stripCR(value) {
  if (typeof value === 'string') {
    return value.includes('\r') ? value.replaceAll('\r', '') : value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const r = stripCR(v);
      if (r !== v) changed = true;
      return r;
    });
    return changed ? out : value;
  }
  if (value !== null && typeof value === 'object') {
    let changed = false;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const r = stripCR(v);
      if (r !== v) changed = true;
      out[k] = r;
    }
    return changed ? out : value;
  }
  return value;
}
```

- [x] **Step 4: 运行确认通过**

Run: `node --test $WT/plugins/speccode/tests/sanitize.test.mjs`
Expected: PASS（5 tests）

- [x] **Step 5: 提交**

```bash
cd $WT
git add plugins/speccode/lib/sanitize.mjs plugins/speccode/tests/sanitize.test.mjs
git commit -m "feat(lib): add stripCR sanitizer for tool input CR injection"
```

### Task 3: hook 壳 + `hooks.json`（TDD via spawnSync）

**Files:**
- Create: `$WT/plugins/speccode/hooks/sanitize-ask.mjs`
- Create: `$WT/plugins/speccode/hooks/hooks.json`
- Test: `$WT/plugins/speccode/tests/sanitize-hook.test.mjs`

**Interfaces:**
- Consumes: `stripCR(value)`（Task 2）；Task 1 记录的 hook 载荷结构（stdin JSON 含 `tool_name`、`tool_input`）
- Produces: 可执行 hook `hooks/sanitize-ask.mjs`——stdin 收 PreToolUse 载荷，stdout 输出 `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":<清洗后>}}`（仅当目标工具且确有 CR）；`hooks/hooks.json` 注册 matcher `AskUserQuestion`

- [x] **Step 1: 写失败测试** `$WT/plugins/speccode/tests/sanitize-hook.test.mjs`：

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'sanitize-ask.mjs');

function runHook(payload) {
  return spawnSync('node', [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
}

test('sanitizes CR in AskUserQuestion input and emits updatedInput', () => {
  const r = runHook({
    tool_name: 'AskUserQuestion',
    tool_input: {
      questions: [{ question: '分支名\r用哪个\r?', header: '分支', options: [] }],
    },
  });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'allow');
  assert.equal(out.hookSpecificOutput.updatedInput.questions[0].question, '分支名用哪个?');
  assert.equal(out.hookSpecificOutput.updatedInput.questions[0].header, '分支');
});

test('no CR → silent pass-through with empty stdout', () => {
  const r = runHook({
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [{ question: '干净文本', options: [] }] },
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('non-target tool → empty stdout', () => {
  const r = runHook({ tool_name: 'Bash', tool_input: { command: 'echo hi\r' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('invalid stdin JSON → exit 0, empty stdout (fail-open)', () => {
  const r = runHook('not json at all');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('missing tool_input → exit 0, empty stdout (fail-open)', () => {
  const r = runHook({ tool_name: 'AskUserQuestion' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('closed stdin → exit 0, empty stdout (fail-open)', () => {
  const r = spawnSync('node', [HOOK], { input: '', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
```

- [x] **Step 2: 运行确认失败**

Run: `node --test $WT/plugins/speccode/tests/sanitize-hook.test.mjs`
Expected: FAIL（`Cannot find module .../hooks/sanitize-ask.mjs`）

- [x] **Step 3: 写 hook 壳** `$WT/plugins/speccode/hooks/sanitize-ask.mjs`：

```js
#!/usr/bin/env node
// PreToolUse hook: strip CR from AskUserQuestion tool_input before execution.
// Fail-open: any error exits 0 with no output so the original input passes through.
import { readFileSync } from 'node:fs';
import { stripCR } from '../lib/sanitize.mjs';

try {
  const payload = JSON.parse(readFileSync(0, 'utf8'));
  if (payload?.tool_name === 'AskUserQuestion' && payload.tool_input != null) {
    const cleaned = stripCR(payload.tool_input);
    if (cleaned !== payload.tool_input) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          updatedInput: cleaned,
        },
      }));
    }
  }
} catch {
  // fail-open
}
```

- [x] **Step 4: 写 hook 注册** `$WT/plugins/speccode/hooks/hooks.json`：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}\"/hooks/sanitize-ask.mjs"
          }
        ]
      }
    ]
  }
}
```

- [x] **Step 5: 运行确认通过**

Run: `node --test $WT/plugins/speccode/tests/sanitize-hook.test.mjs`
Expected: PASS（6 tests）

- [x] **Step 6: 提交**

```bash
cd $WT
git add plugins/speccode/hooks/ plugins/speccode/tests/sanitize-hook.test.mjs
git commit -m "feat(hooks): bundle PreToolUse CR sanitizer for AskUserQuestion"
```

### Task 4: 全量测试 + 文档（README 双语 + CHANGELOG）

**Files:**
- Modify: `$WT/plugins/speccode/README.md`（§7 Hooks 末尾、「Threat model」段之后追加一段）
- Modify: `$WT/plugins/speccode/README_CN.md`（对应中文段落）
- Modify: `$WT/CHANGELOG.md`（`## [Unreleased]` 下新增 `### Added` 小节）

**Interfaces:**
- Consumes: Task 3 的 `hooks/hooks.json` 行为（文档描述的对象）
- Produces: 用户可见文档；无代码接口

- [x] **Step 1: 全量测试**

Run: `cd $WT && node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全部 PASS（228 + 新增 11）

- [x] **Step 2: README.md**——在 §7 Hooks 末尾（「Threat model」段之后）追加：

```markdown
**Bundled tool-input sanitizer**: the plugin ships a PreToolUse hook (`hooks/hooks.json`)
that strips stray carriage returns (U+000D) from `AskUserQuestion` tool input before the
dialog renders — some model backends inject CRs into `tool_use` arguments, garbling
question text. Sanitization logic lives in `lib/sanitize.mjs` (pure function, unit-tested);
the hook shell is fail-open: any error passes the original input through untouched.
```

- [x] **Step 3: README_CN.md**——对应中文段落（与 Step 2 同位置同结构）：

```markdown
**内置工具输入清洗器**:插件自带 PreToolUse hook(`hooks/hooks.json`),在 AskUserQuestion
对话框渲染前剥离其 tool_input 中的游离 CR(U+000D)——部分模型后端会在 tool_use 参数里注入
CR 导致提问乱码。清洗逻辑位于 `lib/sanitize.mjs`(纯函数、有单测);hook 壳为 fail-open:
任何错误都原样放行输入,绝不阻断交互。
```

- [x] **Step 4: CHANGELOG.md**——`## [Unreleased]` 下插入：

```markdown
### Added

- **AskUserQuestion CR 清洗 hook**:插件自带 PreToolUse hook(`hooks/hooks.json` + `lib/sanitize.mjs`),在工具执行前剥离 AskUserQuestion 参数内全部 CR(U+000D),消除 GLM 系模型 tool_use 参数注入 CR 导致的提问乱码;清洗为 lib 纯函数(可单测),hook 壳 fail-open(任何异常 exit 0 放行原输入),启用插件即生效,目标项目零污染。
```

- [x] **Step 5: 提交**

```bash
cd $WT
git add plugins/speccode/README.md plugins/speccode/README_CN.md CHANGELOG.md
git commit -m "docs: document bundled AskUserQuestion CR sanitizer hook"
```

### Task 5: 真机端到端验证

**Files:**
- Modify: 主仓 `.claude/settings.local.json`（临时插入 hook 指向 worktree 内脚本，验证后还原）

**Interfaces:**
- Consumes: Task 3 的 `$WT/plugins/speccode/hooks/sanitize-ask.mjs`
- Produces: 端到端验证结论（乱码消除），写回 feature memory

> 开发中的插件源码尚未进入插件缓存（`~/.claude/plugins/cache/.../0.2.5` 是发布副本），故真机验证走临时注册而非 hooks.json 自动加载；合入发版后后者自然接管。

- [x] **Step 1: 临时注册**——主仓 `.claude/settings.local.json` 的 `"hooks"` 对象内插入（与 Task 1 Step 2 同位置同方式）：

```json
"PreToolUse": [
  {
    "matcher": "AskUserQuestion",
    "hooks": [
      { "type": "command", "command": "node /Users/game-netease/orca/workspaces/speccode-development/worktree-askuserquestion-cr-sanitizer/plugins/speccode/hooks/sanitize-ask.mjs" }
    ]
  }
]
```

- [x] **Step 2: 真机调用**——主会话调用一次 AskUserQuestion，question 原文内嵌真实 CR（复现样本：`分支名\r\r用哪个\r\r\r?`，CR 为真实 U+000D 字节）。

- [x] **Step 3: 判定**——问题文本渲染无乱码、CR 消失 → 验证通过；仍乱码 → 检查 hook 是否被触发（可在载荷里加日志排查），修完重跑。

- [x] **Step 4: 清理现场**——删除 Step 1 插入的 `PreToolUse` 块。

- [x] **Step 5: 写记忆**——把「端到端验证通过 + Spike 结论」追加到 feature memory（write-memory --branch bugfix/askuserquestion-cr-sanitizer）。

---

## Spike 结论

（Task 1 Step 4 执行后填写：`updatedInput` 是否生效、真实载荷字段列表、日期）

**结论：`hookSpecificOutput.updatedInput` 生效（2026-09-02，Claude Code 2.1.258）。**

- 证据：hook 返回的 `updatedInput`（options 仅 1 项，不满足 schema ≥2）被 Claude Code **schema 校验并拒绝整次调用**——若 `updatedInput` 被无视，原输入 schema 合法、调用会照常弹出。即 `updatedInput` 会替换工具输入并被完整校验。
- 中途注册 hook 无需重启会话即生效（`PreToolUse` matcher `AskUserQuestion` 命中）。
- 真实载荷字段（`/tmp/spike-hook-payload.json`）：`session_id, transcript_path, cwd, hook_event_name, permission_mode, prompt_id, tool_use_id, tool_name, tool_input, effort`——`tool_name` 与 `tool_input` 与预期一致。
- 现场复现：spike 第 3 次调用记录到 `tool_input.question = '刚才第二次弹窗\r(非本次\r)你看到的问题文本\r?'`（GLM CR 注入在本会话实时发生）。

## 计划自查记录

- **规格覆盖**:spec 三条 Requirement 全落位——PreToolUse 清洗 hook → Task 3(+Task 5 真机);lib 纯函数 → Task 2;fail-open → Task 3 测试 4-6;spike 决策(design 决策 5)→ Task 1;README/CHANGELOG(propose 任务 8)→ Task 4。无缺口。
- **占位符扫描**:无 TBD/TODO/「与任务 N 类似」;所有代码步骤均给全文。
- **类型一致性**:`stripCR` 签名在 Task 2 定义、Task 3 消费一致;hook 输出 JSON 键名(`hookSpecificOutput.updatedInput`)与 Task 1 spike 验证结构一致,若 spike 推翻则同步修订 Task 3。
