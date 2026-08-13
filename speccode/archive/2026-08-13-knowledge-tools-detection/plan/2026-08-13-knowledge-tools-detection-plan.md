# knowledge_tools 检测两维度化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `detectKnowledgeTools` 从「单维度短路」改为「可用 available / 集成 integrated」两维度独立探测,登记判据收紧为 available ∧ integrated。

**Architecture:** `detect.mjs` 内每个工具同时评估 available(插件 ∨ CLI ∨ 任意 MCP)与 integrated(项目 MCP ∨ 项目 dir)两轴;`detect-knowledge-tools` verb 是纯透传,无需改动;`init.md` 只改登记判据与幂等补救的 prose。

**Tech Stack:** Node ≥ 24,纯 ESM,零第三方依赖(仅 `node:` 内置)。测试用 `node --test ./plugins/speccode/tests/*.test.mjs`。

## Global Constraints

- 纯 `node:` 内置模块,不新增依赖。
- 两维度字段名固定:`available.value`(bool)/ `available.evidence`(string|null),`integrated.value` / `integrated.evidence`。
- verb 输出外层保持 `{ok: true, tools: [...]}`,只改 tool 条目结构。
- 登记判据:**available ∧ integrated** 都 true 才可登记;available-only(可用但未集成)MUST NOT 登记。
- 幂等补救:**绝不静默删除** config 中已登记项,移除必须「提示 + 用户确认」。
- 落盘即提交;单测用 `node --test plugins/speccode/tests/detect.test.mjs` 按名过滤跑。

---

### Task 1: detect.mjs 两维度化 + detect.test.mjs 重写

**Files:**
- Modify: `plugins/speccode/lib/detect.mjs`(仅 `detectKnowledgeTools`)
- Test: `plugins/speccode/tests/detect.test.mjs`(重写检测类用例)

**Interfaces:**
- Consumes: `KNOWLEDGE_TOOL_DETECTORS`(五工具表,不变)、注入的 `readJson` / `commandV` / `exists`。
- Produces: `detectKnowledgeTools(cwd, opts) => Array<{ id, available: {value: boolean, evidence: string|null}, integrated: {value: boolean, evidence: string|null} }>`——每工具一个条目,五工具各一项,无命中时 `value` 全为 false。

- [ ] **Step 1: 写失败测试(重写 detect.test.mjs 检测类用例)**

保留 `KNOWLEDGE_TOOL_DETECTORS covers the five required tools`、`understand-anything has no cli probe`、`resolveWorktreeDir`、`isPathInside`、`worktreeDirIgnoreState` 这些用例不变;把其余检测类用例改为断言新形状。核心新断言:

```js
test('plugin installed but no project integration → available-only', () => {
  const readJson = (p) => (p.endsWith('installed_plugins.json')
    ? { version: 2, plugins: { 'understand-anything@understand-anything': [{ version: '2.9.4' }] } }
    : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  const ua = tools.find((t) => t.id === 'understand-anything');
  assert.deepEqual(ua.available, { value: true, evidence: 'understand-anything@understand-anything' });
  assert.deepEqual(ua.integrated, { value: false, evidence: null });
});

test('project .mcp.json → both available and integrated', () => {
  const readJson = (p) => (p.endsWith('/repo/.mcp.json') ? { mcpServers: { CodeGraph: {} } } : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  const cg = tools.find((t) => t.id === 'codegraph');
  assert.equal(cg.available.value, true);
  assert.deepEqual(cg.integrated, { value: true, evidence: '.mcp.json:CodeGraph' });
});

test('user ~/.claude.json mcp → available-only (not integrated)', () => {
  const readJson = (p) => (p.endsWith('/home/u/.claude.json') ? { mcpServers: { 'lightrag-server': {} } } : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  const lr = tools.find((t) => t.id === 'lightrag');
  assert.equal(lr.available.value, true);
  assert.equal(lr.integrated.value, false);
});

test('projects[cwd].mcpServers → both available and integrated', () => {
  const readJson = (p) => (p.endsWith('/home/u/.claude.json')
    ? { projects: { '/repo': { mcpServers: { graphify: {} } } } } : null);
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson, commandV: () => false, exists: () => false,
  });
  const gf = tools.find((t) => t.id === 'graphify');
  assert.equal(gf.available.value, true);
  assert.deepEqual(gf.integrated, { value: true, evidence: '~/.claude.json[projects]:graphify' });
});

test('project dir → integrated only', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false,
    exists: (p) => p === '/repo/.codemaker/codemap',
  });
  const cm = tools.find((t) => t.id === 'codemap');
  assert.deepEqual(cm.available, { value: false, evidence: null });
  assert.deepEqual(cm.integrated, { value: true, evidence: '.codemaker/codemap' });
});

test('cli → available-only', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null,
    commandV: (bin) => bin === 'graphify', exists: () => false,
  });
  const gf = tools.find((t) => t.id === 'graphify');
  assert.equal(gf.available.value, true);
  assert.equal(gf.integrated.value, false);
});

test('no hits → all five tools have available=false and integrated=false', () => {
  const tools = detectKnowledgeTools('/repo', {
    homeDir: '/home/u', readJson: () => null, commandV: () => false, exists: () => false,
  });
  assert.equal(tools.length, 5);
  for (const t of tools) {
    assert.deepEqual(t.available, { value: false, evidence: null });
    assert.deepEqual(t.integrated, { value: false, evidence: null });
  }
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: FAIL(旧代码返回 `{id, kind, evidence}`,断言 `available` 时报 undefined)

- [ ] **Step 3: 写最小实现(重写 detectKnowledgeTools)**

```js
export function detectKnowledgeTools(cwd, opts = {}) {
  const homeDir = opts.homeDir ?? homedir();
  const readJson = opts.readJson ?? defaultReadJson;
  const commandV = opts.commandV
    ?? ((bin) => spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).status === 0);
  const exists = opts.exists ?? ((p) => existsSync(p));

  const pluginsJson = readJson(join(homeDir, '.claude', 'plugins', 'installed_plugins.json'));
  const pluginKeys = Object.keys(pluginsJson?.plugins ?? {});
  const projectMcp = readJson(join(cwd, '.mcp.json'));
  const userMcp = readJson(join(homeDir, '.claude.json'));

  // available 维度:任意 MCP 配置(项目 .mcp.json / 用户 mcpServers / projects[cwd])也算「可用」
  const anyMcpKeys = [
    ...Object.keys(projectMcp?.mcpServers ?? {}).map((k) => `.mcp.json:${k}`),
    ...Object.keys(userMcp?.mcpServers ?? {}).map((k) => `~/.claude.json:${k}`),
    ...Object.keys(userMcp?.projects?.[cwd]?.mcpServers ?? {}).map((k) => `~/.claude.json[projects]:${k}`),
  ];
  // integrated 维度:项目级 MCP(项目 .mcp.json 或 projects[cwd]),不含用户全局 mcpServers
  const projectMcpKeys = [
    ...Object.keys(projectMcp?.mcpServers ?? {}).map((k) => `.mcp.json:${k}`),
    ...Object.keys(userMcp?.projects?.[cwd]?.mcpServers ?? {}).map((k) => `~/.claude.json[projects]:${k}`),
  ];

  const tools = [];
  for (const t of KNOWLEDGE_TOOL_DETECTORS) {
    const needle = t.match.toLowerCase();

    const pluginHit = pluginKeys.find((k) => k.toLowerCase().includes(needle));
    const cliHit = t.bin && commandV(t.bin) ? t.bin : null;
    const anyMcpHit = anyMcpKeys.find((k) => k.toLowerCase().includes(needle));
    const projectMcpHit = projectMcpKeys.find((k) => k.toLowerCase().includes(needle));
    const dirHit = exists(join(cwd, t.dir)) ? t.dir : null;

    const available = pluginHit
      ? { value: true, evidence: pluginHit }
      : cliHit
        ? { value: true, evidence: cliHit }
        : anyMcpHit
          ? { value: true, evidence: anyMcpHit }
          : { value: false, evidence: null };

    const integrated = projectMcpHit
      ? { value: true, evidence: projectMcpHit }
      : dirHit
        ? { value: true, evidence: dirHit }
        : { value: false, evidence: null };

    tools.push({ id: t.id, available, integrated });
  }
  return tools;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test plugins/speccode/tests/detect.test.mjs`
Expected: PASS(全部检测类用例按新形状通过)

- [ ] **Step 5: 提交**

```bash
git add plugins/speccode/lib/detect.mjs plugins/speccode/tests/detect.test.mjs
git commit -m "feat: detect knowledge tools by available/integrated dimensions"
```

---

### Task 2: cli.test.mjs 更新 detect-knowledge-tools e2e 断言

**Files:**
- Modify: `plugins/speccode/tests/cli.test.mjs:248-280`

**Interfaces:**
- Consumes: Task 1 的新形状 `{id, available: {value, evidence}, integrated: {value, evidence}}`。

- [ ] **Step 1: 写失败断言(更新两处)**

把 `detect-knowledge-tools returns a tools array` 里的循环断言(原 254-257 行)改为:

```js
  for (const t of json.tools) {
    assert.ok(t.id);
    assert.equal(typeof t.available.value, 'boolean');
    assert.equal(typeof t.integrated.value, 'boolean');
  }
```

把 `from a subdirectory` 用例里的 codegraph 命中断言(原 276-277 行)改为:

```js
  assert.ok(second.json.tools.some((t) => t.id === 'codegraph'
    && t.available.value === true
    && t.integrated.value === true
    && t.integrated.evidence === '.mcp.json:codegraph'),
  `expected codegraph mcp hit, got ${JSON.stringify(second.json.tools)}`);
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test --test-name-pattern="detect-knowledge-tools" plugins/speccode/tests/cli.test.mjs`
Expected: FAIL(旧断言 `t.kind` 在旧形状上已报错——本步在 Task 1 落地后跑,断言与旧形状不匹配)

- [ ] **Step 3: 确认通过**

Run: `node --test --test-name-pattern="detect-knowledge-tools" plugins/speccode/tests/cli.test.mjs`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add plugins/speccode/tests/cli.test.mjs
git commit -m "test: update detect-knowledge-tools e2e assertions for two-dimension shape"
```

---

### Task 3: init.md 登记判据与幂等补救

**Files:**
- Modify: `plugins/speccode/commands/init.md`(第 25-27 行探测段)

**Interfaces:**
- Consumes: Task 1 的新形状(逐项展示 `available` / `integrated`)。

- [ ] **Step 1: 改探测登记 prose**

把「探测知识库工具」段改为:

```markdown
5. **探测知识库工具**:运行 `speccode.mjs detect-knowledge-tools --cwd .`。
   - 对返回的每个 `{id, available: {value, evidence}, integrated: {value, evidence}}`:
     - 仅当 `available.value && integrated.value` 时才登记该工具,展示「探测到 <id>(可用: <available.evidence>, 已集成: <integrated.evidence>),是否登记?」经确认写入。
     - `available.value === true && integrated.value === false`(可用但项目未集成)→ 展示为「<id> 本机可用但本项目未集成」,MUST NOT 登记,不询问登记。
     - `integrated.value === true && available.value === false`(项目有集成痕迹但工具不可用)→ 展示告警,不登记。
   - 一个都未确认则写 `"knowledge_tools": []`。
```

幂等 diff 段(既有的「逐字段 diff」处)补充一条:

```markdown
   - 对 config 中已登记、但本次探测判定为 `integrated.value === false` 的工具,在 diff 中标记「建议移除」(本机可用但项目未集成),经用户确认后才移除——绝不静默删除。
```

- [ ] **Step 2: 自查**

通读 init.md,确认「探测类结果一律经用户确认后才落盘」这一既有约定仍成立;无 TBD/占位符。

- [ ] **Step 3: 提交**

```bash
git add plugins/speccode/commands/init.md
git commit -m "docs(speccode): init registers only available+integrated knowledge tools"
```

---

## 收尾(全部任务完成后)

```bash
node --test ./plugins/speccode/tests/*.test.mjs
```
Expected: 全量 PASS(原 142 例,新增/改写后仍全绿)。
