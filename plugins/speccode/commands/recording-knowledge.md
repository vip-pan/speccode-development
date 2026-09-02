---
name: "SpecCode: Recording Knowledge"
description: "把知识直接记录进知识集:经人工闸门写入 speccode/knowledge/ 的 hand-written 段"
category: Workflow
tags: [speccode, workflow, knowledge]
---

把用户/agent 提供的知识直接记录进 `speccode/knowledge/`(hand-written 段),经人工闸门落盘。全程中文交互。**应在 trunk 分支上运行**(`git rev-parse --abbrev-ref HEAD` 校验等于 `config.trunk`)。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. **trunk 入口校验**:`git rev-parse --abbrev-ref HEAD` MUST 等于 `config.trunk`,或为 `chore/knowledge-*` 维护分支(续跑,见 §3)。HEAD 为非 trunk 的 `<type>/<slug>` 开发分支,或**不匹配 `chore/knowledge-` 的** `chore/` 分支 → 退出并提示「请在 trunk 上运行本命令(knowledge 维护从 trunk 跑,不经开发分支)」。
3. **bootstrap 维护分支**:
   - 若 HEAD 已是 `chore/knowledge-*` 分支(续跑)→ 先跑下面的**登记校验**;通过则跳过本步,直接进入 §4。
   - 否则(在 trunk)检测本地**未完成**的 `chore/knowledge-*` 分支:`git branch --list 'chore/knowledge-*' --no-merged <config.trunk> || true`(`--no-merged` 排除已合入 trunk 的历史维护分支;`|| true` 保证无命中的非零退出码不被当作失败;输出逐行去掉前导 `*`/空格才是分支名)。有命中 → AskUserQuestion 询问「续跑(checkout 既有)/新建」;续跑 → 对选中分支先跑**登记校验**,通过后 `git checkout <既有分支>` 并进入 §4。
   - **登记校验**(上面两条续跑路径 MUST 各跑一次):`speccode.mjs feature-progress --cwd . --branch <该分支>`——返回 `{"ok":false,"error":"no state for <分支>"}`(无 state,注意此时 verb 退出码为 1,属预期——判据以 JSON 的 `ok` 字段为准,不要当成命令失败)说明是纯维护分支 → 放行;返回 `ok:true`(带 `total`/`completed`)说明该分支是**已登记的功能分支**(名字恰好撞上 `chore/knowledge-` 前缀)→ 退出并提示「这是已登记的功能分支(<分支>),knowledge 维护请回 trunk 新建 chore/knowledge-* 分支」,不做任何写入。
   - 无命中 → AskUserQuestion 确认新分支名(默认 `chore/knowledge-<topic>`;topic 取自待记录内容的主题,无主题则 `chore/knowledge-record`);slug 须匹配 `^[a-z0-9-]+$`,组合为 `chore/knowledge-<slug>`。
   - `git checkout -b chore/knowledge-<slug>` + `git push -u origin chore/knowledge-<slug>`。
   - **不创建 speccode state、不运行 reconcile、不开 git worktree。**
4. 运行 `speccode.mjs read-knowledge --cwd .`(无 flag)获取现状(topic 清单 + 索引)。
5. `speccode/knowledge/` 不存在 → 创建骨架(同 distilling-knowledge 的 6 development topic 空文件 + `_index.md`,经 write-knowledge 创建,绝不手写)。

## 收集内容

向用户询问(选择题优先):
- 主题:映射到现有 topic(如「开发准则」→ development/standards.md);无合适 topic → 询问是否新建 topic 文件(落在 `development/` 下,文件名小写连字符,`.md` 结尾,如 `development/ops.md`——distilling-knowledge 的蒸馏目标只含 development/ 下自建 topic,根级文件无法分组且会被日落)。
- 内容:用户/agent 给出的知识文本。

## 闸门

1. **适配判断**:先对内容做归类陈述——属于 SDD 过程知识(开发守则、架构、环境、对接、坑与评审共识、安全等)→ 建议落入的 topic;属于业务知识(领域术语、业务流程、业务历史等)→ 陈述「更像业务知识,建议进外部 RAG 而非知识集」。归类是建议不是硬拦:用户坚持写入时,允许其指定既有 topic 或新建 topic(新建落在 `development/` 下,文件名小写连字符,`.md` 结尾)。pitfalls 语义含评审中反复出现的问题模式与团队评审共识,不单列 review topic。
2. 展示草稿(写入位置 + 内容 + 归类陈述)→ AskUserQuestion 确认:
   - 确认 → `write-knowledge --rel <topic路径> --json-stdin`(mode=append-hand,content=内容)原子写(追加为 hand-written 段,不带 marker);
   - 坚持写入(被建议进 RAG 时)→ 按用户指定的 topic 写入;
   - 修改 → 按反馈调整后重展示。

## 落盘

1. `_index.md` 需更新时(新 topic、摘要变化、或索引缺失)→ 组装 entries(实扫现有 topic 文件(跳过内容为空的 topic 文件),按顶层目录名分组为 sections,不硬编码固定 section 清单),经 `write-knowledge --rel _index.md --json-stdin`(mode=index,entries=...)写入。
2. MUST 立即提交:
   ```bash
   git add speccode/knowledge/
   git commit -m "docs(knowledge): record <topic>"
   ```
3. **直通 PR**:先 `git push origin <维护分支>`(把 item 2 的提交推到远端,PR 创建前置;镜像 finishing-feature §2)。创建前 MUST **查重**——查该维护分支上是否已有 open PR(`pr_tool=github`:`gh pr list --head <维护分支> --state open --json url --jq '.[0].url'`;`pr_tool=gitlab`:`glab mr list --source-branch <维护分支> --state opened`);**已有 open PR → 跳过创建**,直接复用既有 PR url(续跑场景常见,重复 create 会报错)。无 open PR 才用 `pr_tool` 创建 PR(参数同 `createPrArgs`,base=`config.trunk`,head=当前 `chore/knowledge-*` 维护分支,title=`docs(knowledge): record <topic>`,body=记录摘要)。`pr_tool=none` → 打印等效命令、跳过查重与创建(仅中止 PR 创建,item 4/5 照常执行),且 MUST NOT 创建 state 或经 finishing-feature。**不阻塞等待合并、不调用 finishing-feature/finishing-worktree。**
4. **memory(trunk 级)**:PR 创建/复用(或 `pr_tool=none` 打印等效命令)**之后**,经 `speccode.mjs write-memory --cwd . --branch _knowledge --json-stdin`(mode=append)追加本次记录摘要(写入位置 + topic)**+ PR url**(`pr_tool=none` 时记等效命令与维护分支名):
   ```bash
   speccode.mjs write-memory --cwd . --branch _knowledge --json-stdin <<'EOF'
   {"mode":"append","content":"<摘要 + PR url>"}
   EOF
   ```
   顺序不可调换:摘要必须含 PR url,所以只能在 PR 之后写。`.speccode/memory/` 自忽略,在 item 2 的 `git add speccode/knowledge/` 之后写不会影响提交内容。
5. 报告:写入位置 + PR url(或等效命令)。

## 约束

- 只写 hand-written 段(不写 marker);写蒸馏块是 distilling-knowledge 的职责。
- 内容不得包含 `<!--` 或 `-->` 字符串。
