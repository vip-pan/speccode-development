# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这个仓库是什么

speccode 是一个 **Claude Code 流程编排插件**,用 10 个 `/speccode:*` slash 命令固化「多需求并行开发 + spec 文档托管 + PR/MR 流程标准化」工作流。它管理 trunk / display / feature / worktree 四层分支拓扑,以及 OpenSpec/Superpowers 文档目录「在 display/feature 跟踪、在 trunk 不跟踪」的语义。

完整设计文档见 `plugins/speccode/README.md`(定位、10 命令表、分支拓扑图、风险 R1-R10)。规格已归档在 `openspec/specs/`(4 个 capability,35 requirements)与 `openspec/changes/archive/2026-07-13-add-speccode-plugin/`。

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

代码分三层,改动前先定位属于哪一层——**确定性逻辑绝不写进命令 markdown,一律下沉到 lib**:

1. **引擎 lib**(`plugins/speccode/lib/*.mjs`)—— 9 个经单测的纯逻辑模块。所有 git 操作、JSON 读写、对账、文档剥离都在这里。改逻辑改这里,并配套改 `tests/`。
2. **CLI 枢纽**(`plugins/speccode/bin/speccode.mjs`)—— 把 lib 暴露为输出 JSON 的 verb。读 verb 直接返回;**写 verb 从 stdin 读 JSON**(`echo '<json>' | node ... write-state --json-stdin`),不从 argv 读,避免超长/转义。未知 verb 或抛错 → `{ok:false,error}` + exit 1。
3. **命令交互层**(`plugins/speccode/commands/*.md`)—— 10 个 slash 命令的 prose 指令,只负责提问/确认/调用 CLI verb/解析 JSON/报告。**不重复实现逻辑**,纯 git 动作(如 `git rm -r --cached`)可直接写,其余走 verb。

### 关键不变量(跨文件才能看清)

- **原子写**:所有 `.speccode/config.json` 和 `state/features/*.json` 写入必须走 `atomic.writeJsonAtomic`(临时文件 `${path}.${pid}.tmp` + `renameSync`)。命令层通过 `write-config` / `write-state` verb 间接调用,**绝不手写 JSON 文件**。

- **仓库根定位**:`bin/speccode.mjs` 用 `git rev-parse --path-format=absolute --git-common-dir` + `dirname` 定位仓库根(**不是** `--show-toplevel`)。这是为了让 `develop-complete` 等从 linked worktree 内运行的命令也能解析到主仓的 `.speccode/`。改这里要保持主仓与 worktree 两种 cwd 都正确。

- **`.speccode/`(运行时数据)vs 插件源码**:`plugins/speccode/`(引擎源码 + 命令)是**插件源码**,在本仓库被 git 跟踪。而 speccode **运行时**在目标项目产生的 `.speccode/`(config + `state/features/` + `backup/`)是运行时数据,设计上保持 untracked、不加 `.gitignore`(靠命令维护,见 README R4)。这两者别混淆。

- **裸调与手动调试**:命令正文裸调 `speccode.mjs`(依赖插件 `bin/` 进 PATH,仅 Claude Code 启用本插件时生效);手动终端调试用 `node plugins/speccode/bin/speccode.mjs <verb> --cwd .`。

- **对账算法**(`reconcile.mjs`)是核心:每个涉及 worktree 的命令(develop-start / develop-complete / finish / status)入口都跑它,扫 `git worktree list` ↔ `state/features/`,用 ancestry(`git merge-base --is-ancestor`)+ `worktree_overrides` 归属;同一 worktree 匹配 ≥2 feature 时记 `conflicts` 报错退出(**绝不随意归属**,这是安全保证);带 `--advance-pr` 时查 PR 状态把 `pr_open` → `completed`。

- **worktree 状态枚举**:`pending | in_progress | pr_open | completed`(定义在 `state.mjs` 的 `WORKTREE_STATUS`,reconcile/CLI/命令三处用法必须一致)。

- **命名规则**:功能分支 `<type>/<slug>`,`type ∈ {feature,bugfix,refactor,chore}`,`slug` 匹配 `/^[a-z0-9-]+$/`;state 文件名用 `<type>__<slug>.json`(双下划线分隔,防撞名)。worktree 分支硬前缀 `worktree-`。逻辑在 `slug.mjs`。

- **finish 双 PR 顺序**:有 display 时必须先 PR→display 合并,再基于其 merge commit 建 `<feature>-complete`、剥离文档 `git rm --cached` + `commit --amend`,再 PR→trunk;两个 PR 都阻塞等合并,超时把挂起态写进 feature state 的 `pending_operation`,`--resume` 续跑。

## 测试约定

- 涉及 git 的测试用 `plugins/speccode/tests/helpers/tmprepo.mjs` 的 `makeRepo()` / `commitFile()` 建**真实临时 git 仓库**,用完清理。
- PR/等待类逻辑(`prtool` / `waitmerge` / reconcile 的 pr_open 推进)通过**依赖注入**(注入 `run` / `query` / `sleep` / `queryPr`)做单测,不依赖真实 `gh`/`glab` 或真实等待。
- 每个 lib 模块对应一个 `plugins/speccode/tests/<module>.test.mjs`;CLI verb 在 `plugins/speccode/tests/cli.test.mjs` 用 `spawnSync('node', [BIN, ...])` 端到端测(写 verb 用 `input` 传 stdin),`BIN` 已用 `import.meta.url` 定位,与 cwd 无关。

## OpenSpec 工作流

本仓库自身用 OpenSpec 管理变更(`openspec/`)。规格改动走 change 流程:`/opsx:propose` → 实现 → `/opsx:sync`(delta specs 同步到 `openspec/specs/`)→ `/opsx:archive`。`openspec validate <spec> --strict` 校验;`openspec list` 看 active changes。

## Brainstorm 文档落地(强制)

每次执行 brainstorming(脑暴/查漏补缺/设计精化)后,**无论是否已存在 openspec 文档**,MUST 把脑暴结论落地为独立文档:`docs/superpowers/specs/YYYY-MM-DD-<topic>-brainstorm.md`(含背景、方法、发现/决策、处置结果),并提交 git。openspec 工件是规格契约,brainstorm 文档是思考过程记录,二者不可互相替代。
