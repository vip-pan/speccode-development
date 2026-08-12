# 去掉 superpowers 痕迹 — 设计

日期:2026-08-12
分支:chore/remove-superpowers-traces
状态:待用户审阅

## 背景与目标

仓库中仍保留有 superpowers 时代的痕迹。本变更清理无意的 superpowers 残留,把 `docs/superpowers/` 的历史文档迁移进 `speccode/archive/` 对应变更目录,借机把 4 个平铺结构的老变更重整为 `propose/` 子目录结构(与现行约定一致),改写指向迁移文件的路径引用,最后删除 `docs/superpowers/`。同时清理 1 处活代码注释的品牌词。正面来源声明保留。

## 三条不变量(用户澄清)

1. **保守派** — 正面来源声明(README `vs superpowers` 对比、CLAUDE.md/插件 README「移植自 superpowers(v6.2.0)」)一律保留。
2. **迁移而非删除** — `docs/superpowers/` 的 15 个文档不直接删,而是迁移进 `speccode/archive/` 对应变更目录,并按类型归入 `brainstorm/` 或 `plan/`。
3. **归档结构统一** — 借迁移之机,把 4 个平铺结构的老变更重整为 `propose/` 子目录结构;`speccode/archive/` 的正文与陈述性提及不动,仅改写指向已迁移文件的路径引用。

## 第1段:范围与目标

**4 个平铺→propose/ 重整的目录**:
- `speccode/archive/2026-07-13-add-speccode-plugin/`
- `speccode/archive/2026-08-07-restructure-as-claude-code-plugin/`
- `speccode/archive/2026-08-09-plugin-release-process/`
- `speccode/archive/2026-08-09-speccode-v2-sdd-flow/`

(`speccode/archive/2026-08-10-self-host-speccode/` 已是 propose/ 结构,不重整。)

**重整动作**:把根下的 `design.md`/`proposal.md`/`specs/`/`tasks.md` 移入 `propose/`;删除 `.openspec.yaml`(OpenSpec 时代遗留,-speccode 已自托管)。

## 第2段:15 个文档的迁移映射

迁移规则:`specs-archived/*.md`(设计/脑暴文档)→ 对应变更目录的 `brainstorm/`;`plans-archived/*.md`(实现计划)→ 对应变更目录的 `plan/`。

| # | 源文件 (docs/superpowers/) | 类型 | 目标位置 (speccode/archive/...) |
|---|---|---|---|
| 1 | `plans-archived/2026-07-10-speccode-plugin.md` | plan | `2026-07-13-add-speccode-plugin/plan/` |
| 2 | `specs-archived/2026-07-14-restructure-as-claude-code-plugin-design.md` | brainstorm | `2026-08-07-restructure-as-claude-code-plugin/brainstorm/` |
| 3 | `plans-archived/2026-07-14-restructure-as-claude-code-plugin.md` | plan | `2026-08-07-restructure-as-claude-code-plugin/plan/` |
| 4 | `plans-archived/2026-08-07-speccode-v2-p1-topology.md` | plan | `2026-08-09-speccode-v2-sdd-flow/plan/` |
| 5 | `plans-archived/2026-08-08-speccode-v2-p2-init-config.md` | plan | `2026-08-09-speccode-v2-sdd-flow/plan/` |
| 6 | `plans-archived/2026-08-08-speccode-v2-p3-doc-lifecycle.md` | plan | `2026-08-09-speccode-v2-sdd-flow/plan/` |
| 7 | `plans-archived/2026-08-08-speccode-v2-p4-brainstorm-plans.md` | plan | `2026-08-09-speccode-v2-sdd-flow/plan/` |
| 8 | `plans-archived/2026-08-08-speccode-v2-p5-sdd-methodology.md` | plan | `2026-08-09-speccode-v2-sdd-flow/plan/` |
| 9 | `plans-archived/2026-08-08-speccode-v2-p6-hooks.md` | plan | `2026-08-09-speccode-v2-sdd-flow/plan/` |
| 10 | `plans-archived/2026-08-08-speccode-v2-p7-memory.md` | plan | `2026-08-09-speccode-v2-sdd-flow/plan/` |
| 11 | `plans-archived/2026-08-08-speccode-v2-p8-docs-sync-archive.md` | plan | `2026-08-09-speccode-v2-sdd-flow/plan/` |
| 12 | `specs-archived/2026-08-07-speccode-v2-sdd-flow-brainstorm.md` | brainstorm | `2026-08-09-speccode-v2-sdd-flow/brainstorm/` |
| 13 | `specs-archived/2026-08-09-plugin-release-process-brainstorm.md` | brainstorm | `2026-08-09-plugin-release-process/brainstorm/` |
| 14 | `plans-archived/2026-08-10-openspec-superpowers-to-speccode.md` | plan | `2026-08-10-self-host-speccode/plan/` |
| 15 | `specs-archived/2026-08-10-openspec-superpowers-to-speccode-design.md` | brainstorm | `2026-08-10-self-host-speccode/brainstorm/` |

**判断点说明**:
- **#1 的目录归属**:`2026-07-10-speccode-plugin.md`(初版实现计划,头部已标 DEPRECATED)归到 `2026-07-13-add-speccode-plugin/`——这是初版插件添加变更,主题对应。
- **#4~#11 的 v2-p1~p8** 全归 `2026-08-09-speccode-v2-sdd-flow/`:archive 里只有这一个 v2 目录,8 个分阶段计划是其实现细节,归此最合理。

迁移后 `docs/superpowers/` 删除(含 `plans-archived/`、`specs-archived/` 两个空子目录),`docs/` 空目录自然消失。

## 第3段:引用改写

`speccode/archive/` 里有 11 处提到 `docs/superpowers/`,分两类,处理方式不同。

### A 类 — 指向具体迁移文件的路径引用(5 处,改写为新位置)

| 文件:行 | 原引用 | 改写为 |
|---|---|---|
| `2026-08-07-restructure-as-claude-code-plugin/design.md:99` | `docs/superpowers/specs/2026-07-14-restructure-as-claude-code-plugin-design.md` | `brainstorm/2026-07-14-restructure-as-claude-code-plugin-design.md`(同目录相对) |
| `2026-08-07-restructure-as-claude-code-plugin/tasks.md:36` | `docs/superpowers/plans/2026-07-10-speccode-plugin.md` | `../2026-07-13-add-speccode-plugin/plan/2026-07-10-speccode-plugin.md`(跨目录相对) |
| `2026-08-09-plugin-release-process/proposal.md:26` | `docs/superpowers/specs/2026-08-09-plugin-release-process-brainstorm.md` | `brainstorm/2026-08-09-plugin-release-process-brainstorm.md`(同目录相对) |
| `2026-08-09-plugin-release-process/tasks.md:8` | `docs/superpowers/specs/2026-08-09-plugin-release-process-brainstorm.md` | `brainstorm/2026-08-09-plugin-release-process-brainstorm.md`(同目录相对) |
| `2026-08-10-self-host-speccode/propose/design.md:5` | `docs/superpowers/specs/2026-08-10-openspec-superpowers-to-speccode-design.md` | `brainstorm/2026-08-10-openspec-superpowers-to-speccode-design.md`(同目录相对) |

> 注:A 类改写发生在重整后的位置。平铺→propose/ 重整后,上述路径中的文件位置会变化,实施时以重整后的实际路径为准,相对引用指向同目录或跨目录的迁移文件。

### B 类 — 陈述性提及,非路径引用(6 处,不改)

这些是"当时用 superpowers 工具,其文档目录是 `docs/superpowers/`"的历史叙事,改了反而失真。它们不是悬空引用——描述的是 superpowers 工具的客观属性,与 docs/superpowers/ 目录是否存在无关。

- `2026-07-13-add-speccode-plugin/design.md:6` — "Superpowers 的 `docs/superpowers/` 目录"(描述工具默认路径)
- `2026-07-13-add-speccode-plugin/design.md:206` — "superpowers 默认 `docs/superpowers/`"(同上)
- `2026-07-13-add-speccode-plugin/specs/spec-docs-tracking-control/spec.md:84` — "默认 `docs/superpowers/`"(spec 场景描述)
- `2026-07-13-add-speccode-plugin/tasks.md:24` — "实现 openspec/changes/ 与 docs/superpowers/ 扫描"(历史任务记录)
- `2026-08-10-self-host-speccode/propose/proposal.md:5` — "superpowers(脑暴强制节 + docs/superpowers/)"(历史叙事)
- `2026-08-10-self-host-speccode/propose/design.md:15` — "不改写任何历史:…docs/superpowers/…"(self-host 变更的设计决策,保留原样)

### 与 self-host-speccode 设计决策的张力

`2026-08-10-self-host-speccode/propose/design.md:15` 明确写"不改写任何历史:CHANGELOG、docs/superpowers/、迁入的归档内容、移植出处注释"。本变更恰好动了 docs/superpowers/。这条不改(B 类),但它记录的"承诺"现在被时移势易地超越:当时保留是 self-host 转换的过渡决策(D2「docs/superpowers 保留为历史」),现在迁移进 archive 是最终归宿——文档未丢,只是从游离的 `docs/` 挪进 `speccode/archive/` 的正式归档结构。本设计不掩饰这层关系。

## 第4段:活文档/活代码的附带清理与验证

### A. README:85 删行(中英同步)

删 `docs/superpowers/` 后,`docs/` 不复存在。README:85(中英两版)的"`docs/` 为早期(superpowers 时代)历史计划归档"失去所指,直接删行。它是 `## Documentation Map` 表格后的独立补充句,删除不影响表格与其他段落。

- `README.md:85` — 删 `` `docs/` is an archive of historical plans from the early (superpowers-era) days. ``
- `README_CN.md:85` — 删 `` `docs/` 为早期(superpowers 时代)历史计划归档。 ``

### B. sdd.mjs:32 注释品牌词替换

```diff
- // Port of the superpowers task-brief awk: fence lines toggle state; task
+ // Port of the speccode task-brief awk: fence lines toggle state; task
```

保留算法来源说明,品牌词 `superpowers` → `speccode`(归属归到自身)。

### C. 保留不动的来源声明

- `README.md:69` / `README_CN.md:69` — `vs superpowers` 对比(保守派保留)
- `CLAUDE.md:7` — "移植自 superpowers(v6.2.0)"(保留)
- `plugins/speccode/README.md:13` / `README_CN.md:13` — "ported from superpowers (v6.2.0)"(保留)
- `speccode/spec/plugin-packaging/spec.md:182` — 反污名化守卫(检索词含 superpowers,是安全守卫,不动)
- `CHANGELOG.md` — 历史日志,不动

### D. 验证

1. `node --test ./plugins/speccode/tests/*.test.mjs` — 改 sdd.mjs 注释后跑全量测试(注释改动预期零影响,但按纪律验证)。
2. 引用完整性自检:迁移+改写后,`grep -rn "docs/superpowers" .` 应只剩 B 类陈述性提及(6 处,全在 archive 内),无 A 类悬空路径。
3. README 中英两版结构对应(CLAUDE.md 多语言纪律)。

### E. 不变量复核

- ✅ 不动 `speccode/spec/`(活规格主档)
- ✅ `speccode/archive/` 只做:结构重整(平铺→propose/)、迁入文档、改写 A 类路径引用;B 类陈述性提及与归档正文不动
- ✅ 不动 `CHANGELOG.md`
- ✅ 正面来源声明全保留
- ✅ 删 `docs/superpowers/` + `docs/` 空目录自然消失

## 实施顺序(供 writing-plans 参考)

1. 迁移 15 个文档到目标位置(先创建 `brainstorm/`/`plan/` 子目录)。
2. 重整 4 个平铺老变更为 `propose/` 结构,删除 `.openspec.yaml`。
3. 改写 5 处 A 类路径引用(以重整后的实际路径为准)。
4. 删除 `docs/superpowers/`(含两个空子目录),确认 `docs/` 空目录消失。
5. 删 README:85(中英两版)。
6. 改 sdd.mjs:32 注释。
7. 跑全量测试 + 引用完整性自检。
