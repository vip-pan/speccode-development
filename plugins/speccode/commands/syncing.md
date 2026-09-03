---
description: "把 changes/<slug>/ 的 delta specs 智能合并进 speccode/spec/ 主规格(brainstorm 优先吸收),幂等,落盘即提交"
category: Workflow
tags: [speccode, workflow, sync, specs]
---

把本次变更的增量规格合并进主规格。这是 **agent 驱动的智能合并**——你直接读 delta 并编辑主规格(允许部分更新,如只加一个 scenario)。全程中文交互。**应在开发分支(`<type>/<slug>`、非 trunk)上运行**。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须为非 trunk 的 `<type>/<slug>` 形态分支;否则退出并提示「请在开发分支上运行本命令」(防止直提 trunk)。
3. 确定 slug:从当前 worktree 所属 feature 分支取 slug 段(可用 `speccode.mjs reconcile --cwd .` 的 features 判定归属);`speccode/changes/<slug>/` 不存在 → 报错"未找到需求目录,请先 /speccode:proposing",退出。
4. **读记忆**:运行 `speccode.mjs read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考,再继续。

**长会话主动记忆(只读变体)**:本命令只读 memory(前置第 4 条),自身 MUST NOT 执行 write-memory。若长会话记忆的触发判据在本命令期间命中(①一个开发阶段完成且距上次记录已隔多个阶段;②会话上下文显著增长、接近 compact 风险;③compact 恢复后继续工作的首个阶段完成时),MUST 提示用户:「记忆判据已命中,将在下一个写命令(proposing/brainstorming/writing-plans/执行类)出口记录关键决策/进度/待办摘要」,而不在本命令内写入。

## delta 源契约

- delta 源 = `speccode/changes/<slug>/propose/` 下的文档:`specs/<capability>/spec.md` 是必须源;proposal.md / design.md / tasks.md 用于理解意图。
- **brainstorm 残余吸收**:若 `speccode/changes/<slug>/brainstorm/` 存在,先读其中的设计文档,与 propose/ 文档对照:brainstorm 结论中**未回写**到 propose/ 的变更,先补入你对 delta 的理解(以 brainstorm 为更新的权威),再执行合并;已全部回写则直接进入合并。
- `propose/` 存在但 `propose/specs/` 为空或不存在 → 报告"无 delta 可同步"并停止,不从其他工件臆测。
- `propose/` 不存在(纯 brainstorming 路径)时:若 `brainstorm/` 存在,以 brainstorm/ 文档提炼 delta 进行合并;若两者都不存在,报告无 delta 并停止。

## capability RENAME 处理

合并前扫描每个 delta 文件的**顶部**——「顶部」严格指该文件的**首个非空行**,只检查这一行,MUST NOT 扫描全文(否则正文中对元数据格式的引用会被误命中)。若首个非空行是 HTML 注释元数据 `<!-- speccode:rename-from: <旧capability名> -->`,则本 delta 表示 capability 目录由 `<旧>` 改名为 `<新>`(`<新>` = 该 delta 所在的目录名)。

**冲突护栏(先查后做)**:同一 slug 的 `propose/specs/` 内 MUST NOT 同时存在 `rename-from` 指向的旧名 capability 目录(即 `propose/specs/<旧>/`)。检测到二者并存 → **报错退出**,提示用户先删除该旧名 delta 目录后重跑(`rename-from` 元数据已完整表达「旧目录消失」的语义,旧名 delta 冗余且与改名冲突);MUST NOT 猜测两者的处理顺序,MUST NOT 自行删除任一方。

护栏通过后,按 `speccode/spec/` 下旧/新目录的存在情况分支处理:

- **旧目录存在 + 新目录不存在** → `git mv speccode/spec/<旧>/ speccode/spec/<新>/`,再把 delta 按下方合并语义常规合并进新目录(ADDED/MODIFIED/REMOVED/RENAMED)。旧目录随 `git mv` 消失,无空壳。
- **新目录已存在**(重复 syncing / 此前已改名)→ 跳过 `git mv`,直接把 delta 合并进新目录;合并幂等,重跑无 diff。若此时旧目录竟仍存在,MUST 报告给用户并请其确认如何处置,MUST NOT 自动删除。
- **旧目录与新目录都不存在**(旧名主规格从未建过)→ 跳过 `git mv`,对 `<新>` 走下方「新建主规格」路径,不报错。

**改名后交叉引用检查**:MUST 全仓 grep 旧 capability 名(至少覆盖 `speccode/spec/`、`plugins/speccode/commands/`、README 与 CLAUDE.md),确认无遗留引用。若其他 capability 的主规格引用了旧名,该引用 MUST 由一份独立的 MODIFIED delta 修正后再经本命令合并,MUST NOT 在 syncing 中顺手直改未被 delta 覆盖的主规格内容。

## 合并语义(对每个 capability delta)

读 delta 文件与对应主规格 `speccode/spec/<capability>/spec.md`(可能尚不存在),然后:

- **ADDED Requirements**:主规格没有 → 追加;已存在 → 更新为 delta 内容(视为隐式 MODIFIED)。
- **MODIFIED Requirements**:按名称(逐字)定位主规格中的 requirement,应用部分更新——可以只加 scenario、改 scenario、改正文;delta 未提及的既有内容 MUST 保留。
- **REMOVED Requirements**:从主规格删除整个 requirement 块。
- **RENAMED Requirements**:按 FROM 名称定位,改名为 TO。
- **`## Purpose`**:主规格已有 Purpose → 主规格的权威,不动;新建主规格 → 逐字复制 delta 的 `## Purpose` 正文(没有则写一句简短占位并提示用户补充)。
- **新建主规格**:capability 目录不存在 → 创建 `speccode/spec/<capability>/spec.md`,结构为 `# <capability> Specification` / `## Purpose` / `## Requirements`(MUST NOT 出现 ADDED/MODIFIED/REMOVED/RENAMED 操作头)。

## 要求

- **幂等**:重复执行 MUST 得到相同结果(按 requirement 标题/段落去重;合并后再跑一遍 MUST 无 diff)。
- 合并过程中向用户展示你在改什么(每个 capability 一行:新增/修改/删除/改名了哪些 requirement)。
- 主规格保持 Main Spec 格式;MUST NOT 把 delta 文件原样拷进主规格。

## 落盘即提交(必须)

先做空变更短路(幂等保证):若 `git status --porcelain speccode/` 无输出,说明本次合并没有产生任何落盘变更 → 跳过提交并报告「无变更(幂等)」,不创建空 commit。有变更时再执行:

```bash
git add speccode/spec/ speccode/changes/<slug>/
git commit -m "docs(speccode): sync <slug> into main specs"
```

(add 后亦可用 `git diff --cached --quiet` 复验:为空同样跳过提交。`git add` 同时写两个路径,护栏末句的「回写落在 speccode/changes/<slug>/,一并提交」由此可达。)

真实产生 commit 后触发 onSynced 钩子(「无变更(幂等)」短路路径 MUST NOT 触发):

```bash
echo '{"command":"syncing","feature_branch":"<F>","worktree_branch":"<W>"}' | speccode.mjs run-hook --cwd . --event onSynced
```

输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。

## 输出摘要

合并完成后展示:更新了哪些 capability、各做了什么(新增/修改/删除/改名)、哪些新建主规格的 Purpose 是占位待补。

## 下一步引导

- 合并完成并提交后,引导用户执行 `/speccode:archiving` 归档本次变更。

## 护栏

- delta 源只来自 `speccode/changes/<slug>/`(propose 为主、brainstorm 残余吸收),不从会话记忆臆测。
- 主规格已有内容未被 delta 提及 MUST 原样保留。
- 有不清楚的地方先问用户,不猜测。
- syncing 的规格合并只动 `speccode/spec/`;brainstorm 残余吸收的回写落在 `speccode/changes/<slug>/`,一并提交;不归档(那是 archiving)。
