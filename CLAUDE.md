# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这个仓库是什么

speccode 是一个 **Claude Code 流程编排插件**,用一组 `/speccode:*` slash 命令固化「多需求并行开发 + spec 文档托管 + PR/MR 流程标准化 + SDD 方法论(探索/文档/计划/子代理执行/评审)+ hooks/memory」工作流。它管理**双层分支拓扑**:普通需求从 trunk 直接切 `<type>/<slug>` 开发分支(git worktree,一步直达),大需求 opt-in 集成分支 + 父实体;spec 文档(`speccode/`)在所有分支 tracked,随 PR 链路上 trunk。SDD 方法论命令自包含移植自 superpowers(v6.2.0),目标项目零外部依赖。

完整设计文档见 `plugins/speccode/README.md`(定位、命令快速参考表、双层分支拓扑图、风险 R1-R13)。规格主档在 `speccode/spec/`(capability 目录以该目录现状为准),归档在 `speccode/archive/`。

文档分工:根 `README.md`(英文)/ `README_CN.md`(中文)是 marketplace 用户门面,`plugins/speccode/README.md`(英文)/ `plugins/speccode/README_CN.md`(中文)是插件设计文档,本文件是开发文档(不翻译)。本仓库同时是 Claude Code marketplace 仓(`.claude-plugin/marketplace.json` 声明,托管 speccode 插件)。

**多语言维护**:根 README 与插件 README 各有中英两版(README.md=EN,README_CN.md=zh),两版结构一一对应(根 12 段 / 插件 §1-14),任何内容改动 MUST 同步全部语言版本;两版均不得硬编码版本号与测试数量(以 CHANGELOG 链接为单一数据源)。

## 常用命令

Node ≥ 24,无 `package.json`(纯 ESM、零第三方依赖——仅 `node:` 内置模块,由源码 import 可见,不在此重复)。

```bash
# 全量测试 —— 必须用 glob 形式
node --test ./plugins/speccode/tests/*.test.mjs
#   ⚠️ 裸 `node --test plugins/speccode/tests/` 在 Node v24 会报 MODULE_NOT_FOUND,不要用

# 单个测试文件
node --test plugins/speccode/tests/reconcile.test.mjs

# 单个测试用例(按名字过滤)
node --test --test-name-pattern="advances pr_open" plugins/speccode/tests/reconcile.test.mjs

# 手动驱动引擎(CLI verb,输出单行 JSON)
node plugins/speccode/bin/speccode.mjs <verb> --cwd . [--flags]
```

无 lint / build 步骤。

本仓库自身的开发工作流(原生链路、dogfood 约定、发布纪律)以 skill 形式维护:真源在 `support/speccode-workflow/SKILL.md`(进 git),经 `bash support/install-skills.sh` 安装到 `.claude/skills/`(本机,供 Claude Code 懒加载)。首次 clone 或 support/ 有改动后重跑该脚本同步。

## 架构:双层分支拓扑 + 代码三层分工,必须理解的分工

speccode 编排的分支拓扑是**双层**:普通需求从 trunk 直接切 `<type>/<slug>` 开发分支(git worktree,一步直达),大需求 opt-in 走集成分支 + 父实体(子分支从集成 head 切出,终局一次 PR 上 trunk)。开发流程由 proposing 定层(Tier 1/2/3)路由后续链路(Tier 1 → applying 手动实现 / Tier 2 → writing-plans + SDD / Tier 3 → 先 brainstorming 再 writing-plans),tier 字段落 proposal.md frontmatter。代码分三层(外加 `references/` 辅助层),改动前先定位属于哪一层——**确定性逻辑绝不写进命令 markdown,一律下沉到 lib**:

1. **引擎 lib**(`plugins/speccode/lib/*.mjs`)—— 14 个经单测的纯逻辑模块(atomic / config / detect / git / hooks / knowledge / memory / prtool / reconcile / sanitize / sdd / slug / state / timestamp)。所有 git 操作、JSON 读写、对账、hooks/memory、SDD 工件都在这里。改逻辑改这里,并配套改 `tests/`。
2. **CLI 枢纽**(`plugins/speccode/bin/speccode.mjs`)—— 把 lib 暴露为输出 JSON 的一组 verb(清单以该文件的 `VERBS` 表为准)。读 verb 直接返回;**写 verb 必须走 `--json-stdin`**(`echo '<json>' | node ... write-state --json-stdin`),从 stdin 读 JSON 而不从 argv 读,避免超长/转义。未知 verb 或抛错 → `{ok:false,error}` + exit 1。
3. **命令交互层**(`plugins/speccode/skills/<name>/SKILL.md`,一 skill 一目录)—— 24 个 slash 命令的 prose 指令,只负责提问/确认/调用 CLI verb/解析 JSON/报告。**不重复实现逻辑**,纯 git 动作(如 `git worktree add`)可直接写,其余走 verb。其中 `applying` 是 Tier 1(极小需求)的手动执行入口:按 tasks.md 逐条实现、勾选回填 + 簿记 commit,完成后必经 code review。
4. **references 层**(`plugins/speccode/references/`)—— 命令可引用的辅助文档(评审提示 / 调试与防御方法 / 测试要点等),与命令 markdown 分离、不承载交互逻辑,随插件源码跟踪。

5. **插件自带 hooks 层**(`plugins/speccode/hooks/`)—— Claude Code settings hook(`hooks/hooks.json` 声明、经 `${CLAUDE_PLUGIN_ROOT}` 引用,如 PreToolUse 工具输入清洗)——与 `lib/hooks.mjs` 的 config 生命周期事件是两个家族,别混淆。

### 关键不变量(跨文件才能看清)

- **原子写**:所有 `.speccode/config.json` 和 `state/branches/*.json`(v3;v2 遗留 `state/features/*.json` 同策)写入必须走 `atomic.writeJsonAtomic`(临时文件 `${path}.${pid}.tmp` + `renameSync`)。命令层通过 `write-config` / `write-state` verb 间接调用,**绝不手写 JSON 文件**。

- **仓库根定位**:`bin/speccode.mjs` 用 `git rev-parse --path-format=absolute --git-common-dir` + `dirname` 定位仓库根(**不是** `--show-toplevel`)。这是为了让 `finishing-worktree` 等从 linked worktree 内运行的命令也能解析到主仓的 `.speccode/`。改这里要保持主仓与 worktree 两种 cwd 都正确。

- **`.speccode/`(运行时数据)vs 插件源码**:`plugins/speccode/`(引擎源码 + 命令 + references)是**插件源码**,在本仓库被 git 跟踪。而 speccode **运行时**在目标项目产生的 `.speccode/`(config + `state/branches/`(v2 遗留为 `state/features/`)+ `memory/` + `sdd/` + `backup/`)是运行时数据,设计上保持 untracked、插件不往项目 `.gitignore` 加条目(靠命令维护,见 README R4);其中 `memory/` 与 `sdd/` 由插件自写目录内 `.gitignore`(内容 `*`)自忽略。这两者别混淆。

- **裸调与手动调试**:命令正文裸调 `speccode.mjs`(依赖插件 `bin/` 进 PATH,仅 Claude Code 启用本插件时生效);手动终端调试用 `node plugins/speccode/bin/speccode.mjs <verb> --cwd .`。

- **对账算法**(`reconcile.mjs`)是核心:每个涉及 worktree 的命令(creating-worktree / finishing-worktree / finishing-feature / status 等)入口都跑它,扫 `git worktree list` ↔ `state/`(v3 `state/branches/` + v2 遗留 `state/features/` 双格式原样)。管辖识别 = **路径识别**:路径位于 `config.worktree_dir`(缺省 `.claude/worktrees`)之下的 worktree 才归 speccode 管,分支名 / ancestry / `worktree_overrides` 一概不参与(用户手工分支零误伤);orphan = 登记非 completed 的分支在 git 缺失 / worktree_dir 下存在未登记 worktree / `merge_target` 指向分支不存在;`conflicts` 恒 `[]`(输出形状保持兼容,出现即异常);带 `--advance-pr` 时查 PR 状态把 `pr_open` → `completed`(仅 v3 条目,v2 遗留原样跳过)。

- **分支状态枚举**:`pending | in_progress | pr_open | completed`(定义在 `state.mjs` 的 `WORKTREE_STATUS`,reconcile/CLI/命令三处用法必须一致;v3 一分支一 state,v2 遗留 `state/features/` 的 worktree 条目沿用同一枚举)。

- **worktree 管辖 = 路径识别 ∪ state 登记**:清理与对账只处理「路径位于 `config.worktree_dir` 之下」或「state 有登记」的 worktree,与分支名无关;宿主自建的 worktree 原样保留并说明。开发分支直接以 `<type>/<slug>` 命名,身份锚点是 state 登记而非分支名前缀。

- **children 仅身份,状态派生**:父实体(`kind:"integration"`)的 `children` 只登记 `{slug}`;**任何命令 MUST NOT 写父实体的 children 状态**——唯一真源是各子分支 state,门禁与 status 渲染实时派生(children 有 slug 无子 state = 计划未开工,渲染 pending);子收尾只写自己的 state、永不写父实体。

- **命名规则**:功能分支 `<type>/<slug>`,`type ∈ {feature,bugfix,refactor,chore}`,`slug` 匹配 `/^[a-z0-9-]+$/`;state 文件名用 `<type>__<slug>.json`(双下划线分隔,防撞名)。**该命名对开发分支(worktree)与集成分支同样适用**——worktree 分支不再带 `worktree-` 硬前缀(config 的 `worktree_prefix` 字段随之退役),集成分支由父实体 state(`kind:"integration"`)识别而非前缀。逻辑在 `slug.mjs`。

- **单 PR 直通 trunk(按 merge_target 路由)**:v0.1 的「先 PR→display 合并、再基于 merge commit 建 `<feature>-complete`、剥离文档 `git rm --cached` + `commit --amend`、再 PR→trunk」双 PR 流程与临时收尾分支已移除。v3 起普通需求由 finishing-worktree 按 state 的 `merge_target`(缺省 trunk)直接 PR → trunk;大需求 opt-in 集成分支,子分支本地 squash 汇入,终局 finishing-feature 一次 PR(集成分支 → trunk,children 全 completed 门禁)。阻塞等合并,超时把挂起态写进分支 state 的 `pending_operation`,`--resume` 续跑。

- **run-hook 永远 exit 0**:hook 失败是 warn-only,绝不能破坏调用它的命令。`run-hook` verb 把所有错误(未传 `--event`、stdin 片段解析失败、hook 本身超时/非零退出)折叠进 hook 字段,恒返 `{ok:true}`。

- **memory 走 writeTextAtomic**:`memory/*.md` 文本写入与 config/state 同策(临时文件 + rename 覆盖,`atomic.writeTextAtomic`);写前必读(read-before-write),在现有内容上增量,不做整文件无脑覆盖。

- **SDD 工作区 show-toplevel(有意差异)**:主仓根统一用 `--git-common-dir` 定位,**唯独** SDD 工作区(`.speccode/sdd/<plan>/`)归属**当前 worktree 根**,用 `git rev-parse --show-toplevel`(见 `sdd.mjs`)——这样 sdd/ 工件随 `git worktree remove` 一并清理。两处定位方式不同是刻意的,别"统一"。

- **写 verb 必须 `--json-stdin`**:write-config / write-state / write-memory 等写 verb 强制要求 `--json-stdin`,从 stdin 读 JSON;缺省直接 `{ok:false,error}`。命令层不许用 argv 传长 JSON。

## 测试约定

- 全量测试(用例数量以 `tests/` 目录为准,对应关系可由 `ls tests/` 直接看到)。涉及 git 的测试用 `plugins/speccode/tests/helpers/tmprepo.mjs` 的 `makeRepo()` / `commitFile()` 建**真实临时 git 仓库**,用完清理。
- PR/等待类逻辑(`prtool` / reconcile 的 pr_open 推进)通过**依赖注入**(注入 `run` / `queryPr` / `spawn`)做单测,不依赖真实 `gh`/`glab` 或真实等待。
- CLI verb 在 `plugins/speccode/tests/cli.test.mjs` 用 `spawnSync('node', [BIN, ...])` 端到端测(写 verb 用 `input` 传 stdin),`BIN` 已用 `import.meta.url` 定位,与 cwd 无关。

<!-- codemap:start -->
## Codemap MCP

**[Important!!!] Whether in the parent agent or in a subagent, always use codemap MCP tools instead of Grep/Read tools. Only fall back to Grep/Read when codemap is unavailable.**

### Tools

| Tool | Use case |
|------|----------|
| `search_code` | Fuzzy keyword or concept search (FTS + vector). For exact name lookup, use find_symbol. |
| `find_symbol` | Exact/prefix/suffix name lookup. Use when you know the symbol name. |
| `get_symbol_detail` | Get a symbol's location, signature, docs, and body. |
| `get_call_chain` | Trace upstream callers and/or downstream callees. |
| `get_type_hierarchy` | Class/interface parent and child hierarchy. |
| `get_dependencies` | Find all symbols that reference a given symbol. |
| `get_graph_stats` | Graph statistics: file/symbol/edge counts. |
| `search_knowledge` | Business rules and architecture docs from codeindex. |
| `query_cypher` | Count/aggregate structural queries: "how many functions in X?", "which class has most methods?", duplicate names, cross-cutting analysis. |


**Name resolution:** Pass `symbol_name` — simple name (`parse_config`) or qualified (`ClassName.method`). No module prefix needed. `ClassName:method` (Lua) and `ClassName::method` (C++/Rust) forms resolve automatically. **Symbol ID:** `filepath:kind:scopedName` (e.g. `player.py:method:Player.attack`, `models.py:class:Outer.Inner`)

**Slash commands:** `/codemap-exploring`, `/codemap-debugging`, `/codemap-impact-analysis`

### Rules

- **After `get_symbol_detail`: edit immediately.** Do NOT re-Read the same file.
- **Use `search_code` first**, not broad `find_symbol` prefix queries.
- **Use batch queries:** `search_code({matches: ["A", "B"]})`, `find_symbol({symbol_name: ["X", "Y"]})`.
- **For obvious single-file bugs: skip codemap.** Error → Read → Edit.
- **Counting or aggregation questions** (how many, which has most, rank by): use `query_cypher`, NOT read/grep.
- **If a subagent is needed, use `general`, not `explore`** (`explore` does not support MCP and cannot call codemap tools).

<!-- codemap:end -->
