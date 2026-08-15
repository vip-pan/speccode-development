# knowledge-set-refocus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 知识集收窄为 SDD 过程知识策展层:骨架 9→6(退役 business/*),memorize 加适配闸门,promote 加通用日落,索引改实扫分组,README 中英同步。

**Architecture:** 纯命令层 + 文档改动。引擎 lib(`knowledge.mjs`)与 9 个消费命令零改动——`listTopics` 扫目录实查、`buildIndex` 接受任意 sections,topic 收窄天然兼容。测试文件中的 `business/domain.md` 仅为合法 fixture 路径,无需改动。

**Tech Stack:** Markdown 命令文件(Claude Code slash 命令)、Node ≥24 `node --test`。

## Global Constraints

- 命令层绝不手写 `knowledge/` 文件,一律经 `write-knowledge` verb(mode=replace / append-hand / replace-promoted / index)。
- promoted 块内容不得包含 `<!--` 或 `-->` 字符串;hand-written 段字节级保留,绝不自动修改。
- 蒸馏目标 = 6 个骨架 topic ∪ `development/` 下用户自建 topic;蒸馏内容限于 SDD 过程知识。
- 插件 README 中英两版(README.md=EN / README_CN.md=zh)结构一一对应,任何改动 MUST 同步两版;两版均不得硬编码版本号与测试数量。
- 提交信息规范:`docs(...)` 前缀;落盘即提交。
- 全量测试命令:`node --test ./plugins/speccode/tests/*.test.mjs`(必须 glob 形式,裸目录在 Node v24 报 MODULE_NOT_FOUND)。

---

### Task 1: memorize.md —— 骨架 9→6 + 适配闸门 + 实扫索引

**Files:**
- Modify: `plugins/speccode/commands/memorize.md`(前置 step 6、闸门 section、落盘 step 1)

**Interfaces:**
- Consumes: spec delta `specs/knowledge-set/spec.md` 的「直写命令」Requirement(3 个 Scenario)
- Produces: memorize 闸门措辞锚点「更像业务知识,建议进外部 RAG 而非知识集」(Task 3 README 描述与其一致)

- [x] **Step 1: 改前置 step 6(骨架收窄)**

精确替换(整段):

old:
```
6. `speccode/knowledge/` 不存在 → 创建骨架:9 个初始 topic 空文件(business/domain.md、business/workflows.md、business/lineage.md、development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`。创建机制:对 9 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为业务方向/开发方向两个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。
```

new:
```
6. `speccode/knowledge/` 不存在 → 创建骨架:6 个初始 topic 空文件(development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`,不创建 business/ 目录(知识集只策展 SDD 过程知识,业务知识归外部 RAG)。创建机制:对 6 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为 development 一个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。
```

- [x] **Step 2: 改「闸门」section(加适配判断)**

精确替换(整个 section):

old:
```
## 闸门

展示草稿(写入位置 + 内容)→ AskUserQuestion 确认:
- 确认 → `write-knowledge --rel <topic路径> --json-stdin`(mode=append-hand,content=内容)原子写(追加为 hand-written 段,不带 marker);
- 修改 → 按反馈调整后重展示。
```

new:
```
## 闸门

1. **适配判断**:先对内容做归类陈述——属于 SDD 过程知识(开发守则、架构、环境、对接、坑与评审共识、安全等)→ 建议落入的 topic;属于业务知识(领域术语、业务流程、业务历史等)→ 陈述「更像业务知识,建议进外部 RAG 而非知识集」。归类是建议不是硬拦:用户坚持写入时,允许其指定既有 topic 或新建 topic(文件名小写连字符,`.md` 结尾)。pitfalls 语义含评审中反复出现的问题模式与团队评审共识,不单列 review topic。
2. 展示草稿(写入位置 + 内容 + 归类陈述)→ AskUserQuestion 确认:
   - 确认 → `write-knowledge --rel <topic路径> --json-stdin`(mode=append-hand,content=内容)原子写(追加为 hand-written 段,不带 marker);
   - 坚持写入(被建议进 RAG 时)→ 按用户指定的 topic 写入;
   - 修改 → 按反馈调整后重展示。
```

- [x] **Step 3: 改落盘 step 1(索引实扫分组)**

精确替换:

old:
```
1. `_index.md` 需更新时(新 topic、摘要变化、或索引缺失——read-knowledge 返回 index 为 null 但 topic 文件存在)→ 组装 entries(业务方向 section + 开发方向 section),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入新索引内容。
```

new:
```
1. `_index.md` 需更新时(新 topic、摘要变化、或索引缺失——read-knowledge 返回 index 为 null 但 topic 文件存在)→ 组装 entries(实扫现有 topic 文件,按顶层目录名分组为 sections,如 development;不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入新索引内容。
```

- [x] **Step 4: 自查**

Run: `grep -c 'business' plugins/speccode/commands/memorize.md`
Expected: `0`;并人工核对三处替换与 spec delta「直写命令」的 3 个 Scenario 一一对应。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/commands/memorize.md
git commit -m "docs(commands): memorize 骨架收窄 9→6 + 适配闸门 + 索引实扫分组"
```

---

### Task 2: promote-knowledge.md —— 骨架 9→6 + 蒸馏范围收窄 + 通用日落 + 实扫索引

**Files:**
- Modify: `plugins/speccode/commands/promote-knowledge.md`(前置 step 6、蒸馏 section、闸门 section、落盘 step 1)

**Interfaces:**
- Consumes: spec delta「知识集目录结构」与「晋升命令」Requirements(含「日落移除 business promoted 块」Scenario)
- Produces: 日落措辞锚点「建议移除(业务知识归外部 RAG)」(Task 3 README 描述与其一致)

- [x] **Step 1: 改前置 step 6(骨架收窄)**

精确替换(整段):

old:
```
6. `speccode/knowledge/` 不存在 → 本命令创建骨架:9 个初始 topic 空文件(business/domain.md、business/workflows.md、business/lineage.md、development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`。创建机制:对 9 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为业务方向/开发方向两个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。
```

new:
```
6. `speccode/knowledge/` 不存在 → 本命令创建骨架:6 个初始 topic 空文件(development/architecture.md、development/standards.md、development/environment.md、development/integrations.md、development/pitfalls.md、development/security.md)+ `_index.md`,不创建 business/ 目录(知识集只策展 SDD 过程知识,业务知识归外部 RAG)。创建机制:对 6 个文件逐个执行 `write-knowledge --rel <file> --json-stdin`(mode=replace,content 为空串)创建空文件,再执行 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries 为 development 一个空清单 section)创建索引——绝不 mkdir/touch/手写文件(命令层绝不手写 knowledge/,一律经 verb)。
```

- [x] **Step 2: 改蒸馏 step 2(范围收窄)**

精确替换:

old:
```
2. 从 spec/ 与 archive/ 提炼「该主题下值得长期记住的事实/准则/坑」,生成该 topic 的 promoted 块集合:
```

new:
```
2. 蒸馏目标 = 6 个骨架 development topic ∪ `development/` 下用户自建 topic;蒸馏内容限于 SDD 过程知识(架构、准则、环境、对接、坑与评审共识、安全)——spec/archive 中的业务知识(领域术语、业务流程、业务历史)不蒸馏。从 spec/ 与 archive/ 提炼「该主题下值得长期记住的事实/准则/坑」,生成每个目标 topic 的 promoted 块集合:
```

- [x] **Step 3: 蒸馏 section 插入日落步骤**

在原 step 3(「汇总候选…」)之前插入新 step 3,原 step 3 顺延为 step 4:

```
3. **通用日落**:蒸馏目标之外既存的 topic 文件(如存量 business/*),用 `read-knowledge --topic <topic名> --blocks` 取其现有 promoted 块,逐块标记为「建议移除(业务知识归外部 RAG / speccode 不再策展该主题)」,并入候选进入闸门;其 hand-written 段不进入候选、绝不自动修改。
```

- [x] **Step 4: 改闸门 section(接日落块)**

精确替换:

old:
```
用 AskUserQuestion 逐 topic 确认(提供「全部确认」选项):
- 确认 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-promoted,blocks=候选)原子写;
- 拒绝/修改 → 按用户反馈调整后重展示。
```

new:
```
用 AskUserQuestion 逐 topic 确认(提供「全部确认」选项):
- 确认 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-promoted,blocks=候选)原子写;
- 日落块确认移除 → 该 topic 经 `write-knowledge --rel <topic路径> --json-stdin`(mode=replace-promoted,blocks=[])写入(删除全部 promoted 块,hand-written 段字节保留);用户拒绝 → 块保留原样;
- 拒绝/修改 → 按用户反馈调整后重展示。
```

- [x] **Step 5: 改落盘 step 1(索引实扫分组)**

精确替换:

old:
```
1. 各 topic 写入完成后更新 `_index.md`:为每个 topic 文件生成一行摘要(标题 + 文件 + 一句话摘要),组装 entries(业务方向 section + 开发方向 section),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
```

new:
```
1. 各 topic 写入完成后更新 `_index.md`:为每个 topic 文件生成一行摘要(标题 + 文件 + 一句话摘要),组装 entries(实扫现有 topic 文件,按顶层目录名分组为 sections,如 development;不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
```

- [x] **Step 6: 自查**

Run: `grep -c 'business' plugins/speccode/commands/promote-knowledge.md`
Expected: `0`(日落步骤用「如存量 business/*」是示例措辞,若保留则 Expected `1`——允许,但不得再有骨架/section 含义的 business 引用);人工核对日落流程与 spec delta「日落移除 business promoted 块」Scenario 一致。

- [x] **Step 7: 提交**

```bash
git add plugins/speccode/commands/promote-knowledge.md
git commit -m "docs(commands): promote-knowledge 蒸馏收窄 + 通用日落 + 索引实扫分组"
```

---

### Task 3: 插件 README 中英同步

**Files:**
- Modify: `plugins/speccode/README.md`(命令表 2 行、目录树、约定段)
- Modify: `plugins/speccode/README_CN.md`(同构位置,中文)

**Interfaces:**
- Consumes: Task 1/2 的措辞锚点(适配闸门、日落)
- Produces: 无(终端任务)

- [x] **Step 1: 改目录树(两版同位置,line ~125)**

EN/CN 相同结构,精确替换:

old:
```
    ├── business/            # domain.md / workflows.md / lineage.md
    └── development/         # architecture.md / standards.md / environment.md / integrations.md / pitfalls.md / security.md
```

new:
```
    └── development/         # architecture.md / standards.md / environment.md / integrations.md / pitfalls.md / security.md
```

- [x] **Step 2: 改命令表(EN line 50-51 / CN 同位置)**

EN old:
```
| `/speccode:promote-knowledge` | Distill promoted sections of `speccode/knowledge/` from `spec/` + `archive/` (full rebuild with source markers); human gate before write; commits on save | worktree-* branch |
| `/speccode:memorize` | Write knowledge directly into hand-written sections (draft → human gate → atomic write); commits on save | worktree-* branch |
```

EN new:
```
| `/speccode:promote-knowledge` | Distill promoted sections of `speccode/knowledge/` from `spec/` + `archive/` (full rebuild with source markers; SDD process knowledge only, out-of-scope topics sunset via the gate); human gate before write; commits on save | worktree-* branch |
| `/speccode:memorize` | Write knowledge directly into hand-written sections (fit check: process knowledge stays, business knowledge is pointed to external RAG; draft → human gate → atomic write); commits on save | worktree-* branch |
```

CN old:
```
| `/speccode:promote-knowledge` | 从 spec/ + archive/ 蒸馏 knowledge/ 的 promoted 段(全量重建 + 来源标记),人工闸门后落盘,落盘即提交 | worktree-* 分支 |
| `/speccode:memorize` | 知识直接写入 hand-written 段(草稿 → 人工闸门 → 原子写),落盘即提交 | worktree-* 分支 |
```

CN new:
```
| `/speccode:promote-knowledge` | 从 spec/ + archive/ 蒸馏 knowledge/ 的 promoted 段(全量重建 + 来源标记;只蒸 SDD 过程知识,范围外 topic 经闸门日落),人工闸门后落盘,落盘即提交 | worktree-* 分支 |
| `/speccode:memorize` | 知识直接写入 hand-written 段(适配判断:过程知识收录,业务知识建议进外部 RAG;草稿 → 人工闸门 → 原子写),落盘即提交 | worktree-* 分支 |
```

- [x] **Step 3: 改知识集约定段(EN/CN line 133,段尾各追加一句)**

EN 段尾(`...survives every promoted-block rebuild untouched.` 之后)追加:

```
The set curates SDD process knowledge only (`development/*`; pitfalls also covers recurring review findings and team review consensus). Business knowledge is left to external RAG systems: `memorize` runs a fit check before writing (a recommendation, not a hard block), and `promote-knowledge` sunsets promoted blocks of out-of-scope topics through the same human gate while preserving hand-written content byte-for-byte.
```

CN 段尾(`...故手写内容在每次 promoted 块重建后原样存活。` 之后)追加:

```
知识集只策展 SDD 过程知识(`development/*`;pitfalls 兼收评审中反复出现的问题模式与团队评审共识)。业务知识交由外部 RAG 系统:`memorize` 写入前做适配判断(建议而非硬拦),`promote-knowledge` 对范围外 topic 的 promoted 块经同一人工闸门日落,hand-written 段逐字节保留。
```

- [x] **Step 4: 自查**

Run: `grep -c 'business/' plugins/speccode/README.md plugins/speccode/README_CN.md`
Expected: 两文件均为 `0`;两版改动位置一一对应(命令表、目录树、约定段各一处)。

- [x] **Step 5: 提交**

```bash
git add plugins/speccode/README.md plugins/speccode/README_CN.md
git commit -m "docs(readme): 知识集收窄为过程知识,中英同步"
```

---

### Task 4: 全量测试与规格覆盖自查

**Files:**
- 无改动(验证任务)

**Interfaces:**
- Consumes: Task 1-3 的全部产出
- Produces: 收尾结论(测试零改动验证)

- [x] **Step 1: 全量测试**

Run: `node --test ./plugins/speccode/tests/*.test.mjs`
Expected: 全绿(基线 183 pass / 0 fail)。测试文件中的 `business/domain.md` 是合法 fixture 路径(lib topic 无关),无需改动;若有 fail,停下来调查,不擅自改测试。

- [x] **Step 2: 残留扫描**

Run: `grep -rn 'business' plugins/speccode/commands/ plugins/speccode/README.md plugins/speccode/README_CN.md`
Expected: 无骨架/section 含义的 business 残留(promote-knowledge.md 日落示例「如存量 business/*」允许存在)。

- [x] **Step 3: 规格覆盖核对**

逐条对照 `speccode/changes/knowledge-set-refocus/propose/specs/knowledge-set/spec.md`:
- 「知识集目录结构」3 个 Scenario → Task 1/2 前置 step 6 + 落盘实扫索引 ✓
- 「晋升命令」3 个 Scenario → Task 2 蒸馏收窄 + 日落 + 闸门 ✓
- 「直写命令」2 个 Scenario → Task 1 适配闸门 ✓
列出任何无任务承接的条款并补任务;无缺口则继续。

- [x] **Step 4: 提交(仅当自查产生修正时)**

```bash
git add -A
git commit -m "docs(speccode): knowledge-set-refocus 自查修正"
```
