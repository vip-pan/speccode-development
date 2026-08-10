# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这个仓库是什么

speccode 是一个 **Claude Code 流程编排插件**,用 21 个 `/speccode:*` slash 命令固化「多需求并行开发 + spec 文档托管 + PR/MR 流程标准化 + SDD 方法论(探索/文档/计划/子代理执行/评审)+ hooks/memory」工作流。它管理 trunk / feature / worktree 三层分支拓扑;spec 文档(`speccode/`)在所有分支 tracked,随 PR 链路上 trunk。SDD 方法论命令自包含移植自 superpowers(v6.2.0),目标项目零外部依赖。

完整设计文档见 `plugins/speccode/README.md`(定位、21 命令表、三层分支拓扑图、风险 R1-R13)。规格主档在 `speccode/spec/`(8 个 capability),归档在 `speccode/archive/`。

## 常用命令

Node ≥ 24,纯 ESM,**零第三方依赖**(仅 `node:` 内置模块,无 `package.json`)。

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

## 架构:三层,必须理解的分工

代码分三层(外加 `references/` 辅助层),改动前先定位属于哪一层——**确定性逻辑绝不写进命令 markdown,一律下沉到 lib**:

1. **引擎 lib**(`plugins/speccode/lib/*.mjs`)—— 12 个经单测的纯逻辑模块(atomic / config / detect / git / hooks / memory / prtool / reconcile / sdd / slug / state / timestamp)。所有 git 操作、JSON 读写、对账、hooks/memory、SDD 工件都在这里。改逻辑改这里,并配套改 `tests/`。
2. **CLI 枢纽**(`plugins/speccode/bin/speccode.mjs`)—— 把 lib 暴露为输出 JSON 的 18 个 verb。读 verb 直接返回;**写 verb 必须走 `--json-stdin`**(`echo '<json>' | node ... write-state --json-stdin`),从 stdin 读 JSON 而不从 argv 读,避免超长/转义。未知 verb 或抛错 → `{ok:false,error}` + exit 1。
3. **命令交互层**(`plugins/speccode/commands/*.md`)—— 21 个 slash 命令的 prose 指令,只负责提问/确认/调用 CLI verb/解析 JSON/报告。**不重复实现逻辑**,纯 git 动作(如 `git worktree add`)可直接写,其余走 verb。
4. **references 层**(`plugins/speccode/references/`)—— 命令可引用的辅助文档(评审提示 / 调试与防御方法 / 测试要点等),与命令 markdown 分离、不承载交互逻辑,随插件源码跟踪。

### 关键不变量(跨文件才能看清)

- **原子写**:所有 `.speccode/config.json` 和 `state/features/*.json` 写入必须走 `atomic.writeJsonAtomic`(临时文件 `${path}.${pid}.tmp` + `renameSync`)。命令层通过 `write-config` / `write-state` verb 间接调用,**绝不手写 JSON 文件**。

- **仓库根定位**:`bin/speccode.mjs` 用 `git rev-parse --path-format=absolute --git-common-dir` + `dirname` 定位仓库根(**不是** `--show-toplevel`)。这是为了让 `finishing-worktree` 等从 linked worktree 内运行的命令也能解析到主仓的 `.speccode/`。改这里要保持主仓与 worktree 两种 cwd 都正确。

- **`.speccode/`(运行时数据)vs 插件源码**:`plugins/speccode/`(引擎源码 + 命令 + references)是**插件源码**,在本仓库被 git 跟踪。而 speccode **运行时**在目标项目产生的 `.speccode/`(config + `state/features/` + `memory/` + `sdd/` + `backup/`)是运行时数据,设计上保持 untracked、插件不往项目 `.gitignore` 加条目(靠命令维护,见 README R4);其中 `memory/` 与 `sdd/` 由插件自写目录内 `.gitignore`(内容 `*`)自忽略。这两者别混淆。

- **裸调与手动调试**:命令正文裸调 `speccode.mjs`(依赖插件 `bin/` 进 PATH,仅 Claude Code 启用本插件时生效);手动终端调试用 `node plugins/speccode/bin/speccode.mjs <verb> --cwd .`。

- **对账算法**(`reconcile.mjs`)是核心:每个涉及 worktree 的命令(creating-worktree / finishing-worktree / finishing-feature / status 等)入口都跑它,扫 `git worktree list` ↔ `state/features/`,用 ancestry(`git merge-base --is-ancestor`)+ `worktree_overrides` 归属;同一 worktree 匹配 ≥2 feature 时记 `conflicts` 报错退出(**绝不随意归属**,这是安全保证);带 `--advance-pr` 时查 PR 状态把 `pr_open` → `completed`。

- **worktree 状态枚举**:`pending | in_progress | pr_open | completed`(定义在 `state.mjs` 的 `WORKTREE_STATUS`,reconcile/CLI/命令三处用法必须一致)。

- **命名规则**:功能分支 `<type>/<slug>`,`type ∈ {feature,bugfix,refactor,chore}`,`slug` 匹配 `/^[a-z0-9-]+$/`;state 文件名用 `<type>__<slug>.json`(双下划线分隔,防撞名)。worktree 分支硬前缀 `worktree-`。逻辑在 `slug.mjs`。

- **finishing-feature 单 PR → trunk**:v0.1 的「先 PR→display 合并、再基于 merge commit 建 `<feature>-complete`、剥离文档 `git rm --cached` + `commit --amend`、再 PR→trunk」双 PR 流程与临时收尾分支已移除。v0.2 一个功能只开一个 PR 直通 trunk,阻塞等合并,超时把挂起态写进 feature state 的 `pending_operation`,`--resume` 续跑。

- **run-hook 永远 exit 0**:hook 失败是 warn-only,绝不能破坏调用它的命令。`run-hook` verb 把所有错误(未传 `--event`、stdin 片段解析失败、hook 本身超时/非零退出)折叠进 hook 字段,恒返 `{ok:true}`。

- **memory 走 writeTextAtomic**:`memory/*.md` 文本写入与 config/state 同策(临时文件 + rename 覆盖,`atomic.writeTextAtomic`);写前必读(read-before-write),在现有内容上增量,不做整文件无脑覆盖。

- **SDD 工作区 show-toplevel(有意差异)**:主仓根统一用 `--git-common-dir` 定位,**唯独** SDD 工作区(`.speccode/sdd/<plan>/`)归属**当前 worktree 根**,用 `git rev-parse --show-toplevel`(见 `sdd.mjs`)——这样 sdd/ 工件随 `git worktree remove` 一并清理。两处定位方式不同是刻意的,别"统一"。

- **写 verb 必须 `--json-stdin`**:write-config / write-state / write-memory 等写 verb 强制要求 `--json-stdin`,从 stdin 读 JSON;缺省直接 `{ok:false,error}`。命令层不许用 argv 传长 JSON。

## 测试约定

- 全量 **134 个用例**。涉及 git 的测试用 `plugins/speccode/tests/helpers/tmprepo.mjs` 的 `makeRepo()` / `commitFile()` 建**真实临时 git 仓库**,用完清理。
- PR/等待类逻辑(`prtool` / reconcile 的 pr_open 推进)通过**依赖注入**(注入 `run` / `queryPr` / `spawn`)做单测,不依赖真实 `gh`/`glab` 或真实等待。
- 每个 lib 模块对应一个 `plugins/speccode/tests/<module>.test.mjs`;CLI verb 在 `plugins/speccode/tests/cli.test.mjs` 用 `spawnSync('node', [BIN, ...])` 端到端测(写 verb 用 `input` 传 stdin),`BIN` 已用 `import.meta.url` 定位,与 cwd 无关。

## speccode 工作流

本仓库自身的开发由 speccode 自托管(dogfood),不依赖任何外部 spec/方法论工具。变更走 v2 原生链路:`/speccode:creating-feature` → `/speccode:creating-worktree` → `/speccode:proposing`(复杂需求先 `/speccode:brainstorming`)→ `/speccode:writing-plans` → 执行 → `/speccode:syncing`(delta 合并进 `speccode/spec/`)→ `/speccode:archiving` → `/speccode:finishing-worktree` → `/speccode:finishing-feature`(单 PR 直通 trunk)。规格主档在 `speccode/spec/`,归档在 `speccode/archive/`;脑暴文档由 brainstorming 原生落到 `speccode/changes/<slug>/brainstorm/`,落盘即提交。
