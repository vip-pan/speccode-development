---
name: "SpecCode: Brainstorming"
description: "苏格拉底式设计精化:一次一问、多方案权衡、分段呈现确认;设计落 brainstorm/ 并回写 propose/,落盘即提交"
category: Workflow
tags: [speccode, workflow, brainstorm, design]
---

把想法通过自然协作对话打磨成完整设计。先理解项目现状,再一次一个问题地精化;理解清楚后分段呈现设计并获得用户批准。全程中文交互。

<HARD-GATE>
在呈现设计并获得用户批准之前,禁止调用任何实现类命令、写任何代码、搭建任何脚手架、或采取任何实现动作。对任何项目都一样,无论看起来多简单。
</HARD-GATE>

## 反模式:「这太简单了不需要设计」

每个项目都走这个流程——todo 列表、单函数工具、配置变更,全都是。「简单」项目最容易因未检验的假设浪费工作。设计可以很短(真正简单的项目几句话就够),但 MUST 呈现并获得批准。

## 前置

1. **分支校验**:`git rev-parse --abbrev-ref HEAD` 必须以 `config.worktree_prefix`(默认 `worktree-`)开头;否则退出(`read-config` 先跑,为 null → 提示先 `/speccode:init` 并退出)。
2. 运行 `speccode.mjs reconcile --cwd .`,用返回的 features 找到当前 worktree 所属的功能分支 F;找不到 → 报错退出。计算 slug = F 的 slug 段。
3. **读既有文档**:若 `speccode/changes/<slug>/propose/` 存在,读其中的 proposal/design/specs/tasks 作为脑暴起点;不存在 → 本命令将从零产出设计(简单场景可不经 proposing 直接使用本命令)。
4. **知识库工具咨询**:若 `knowledge_tools` 非空且其能力在会话中可用,参考代码时优先使用;不可用回退 Grep/Glob/Read,不报错。
5. **读记忆**:运行 `speccode.mjs read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考,再继续。

## 检查清单

你 MUST 为下列每一项创建任务并按序完成:

1. **探索项目上下文** — 文件、文档、近期 commit、propose/ 既有文档
2. **just-in-time 提供 visual companion** — 不是一开始就给。第一次遇到「展示比描述更清楚」的问题时才提供(独立消息);批准后才打开浏览器标签。若全程没有可视化问题,就从不提供。见文末 Visual Companion 节。
3. **澄清问题** — 一次一个,理解目的/约束/成功标准
4. **提出 2-3 个方案** — 带权衡分析和你的推荐
5. **呈现设计** — 分段、每段详略随复杂度,每段后确认
6. **写设计文档** — 落到 `speccode/changes/<slug>/brainstorm/YYYY-MM-DD-<topic>-design.md`
7. **回写 propose/** — 若 propose/ 存在,把结论性变更写回受影响文档,保持两处一致
8. **规格自查** — 占位符/内部一致性/范围/歧义四项 inline 检查(见下)
9. **用户审阅** — 请用户审阅写好的设计文档
10. **批准后提交(落盘即 commit)** — `git add speccode/changes/<slug>/` + `git commit -m "docs(speccode): brainstorm <slug>"`
11. **衔接实现计划** — 调用 `/speccode:writing-plans`

## 过程

**理解想法:**
- 先看项目当前状态(文件、文档、近期 commit)
- 先评估范围:若需求描述多个独立子系统(如"一个带聊天、文件存储、计费、分析的平台"),立即指出——先帮用户拆成子项目(各子项目各走一轮 文档→计划→实现),再对第一个子项目走正常设计流程
- 规模合适的项目:一次一个问题地精化;优先选择题,开放式也行;一个话题要深挖就拆成多个问题
- 聚焦理解:目的、约束、成功标准

**探索方案:**
- 提出 2-3 个不同方案,带权衡;对话式呈现,先给推荐和理由
- 无情地 YAGNI——从每个方案和设计中删掉不必要的特性

**呈现设计:**
- 理解够了就呈现设计;每段详略随复杂度(简单的几句话,微妙处 200-300 字);每段后问"这部分看起来对吗"
- 覆盖:架构、组件、数据流、错误处理、测试
- 哪里说不通就回去继续澄清

**为隔离与清晰而设计:**
- 把系统拆成更小单元:单一目的、接口明确、可独立理解与测试;每个单元能回答:做什么、怎么用、依赖什么
- 不读内部实现能否理解一个单元?改内部会不会破坏调用方?做不到就是边界要重修
- 文件变大通常是"做太多"的信号

**在既有代码库中工作:**
- 先探索现有结构,跟随既有模式
- 既有代码中影响本工作的问题(文件过大、边界不清、职责纠缠),把针对性改进纳入设计——像好开发者改善自己工作的代码那样
- 不做无关重构,聚焦服务当前目标

## 设计定稿后

**文档与回写:**
- 把验证过的设计写入 `speccode/changes/<slug>/brainstorm/YYYY-MM-DD-<topic>-design.md`
- **回写 propose/**:设计结论与 `propose/` 文档不一致之处(方案替换、范围调整、决策变更),MUST 同步修改 propose/ 下对应文档(proposal.md 的 What Changes、design.md 的 Decisions、specs delta、tasks.md 受影响处),保证两处不矛盾

**规格自查(写完后以新鲜眼光过一遍,inline 修复):**
1. **占位符扫描**:有没有 TBD、TODO、未完成小节、模糊要求?修掉。
2. **内部一致性**:各节互相矛盾吗?架构与特性描述一致吗?与 propose/ 文档一致吗(回写后)?
3. **范围检查**:聚焦到够一个实现计划吗,还是要再拆?
4. **歧义检查**:任何要求会有两种解读吗?有就选定一种写明确。

**用户审阅门:**
> "设计文档已写好,落在 `<path>`。请审阅,如需修改告诉我;批准后我会提交并衔接 writing-plans。"

等用户回复。有修改就改并重跑自查。批准后才继续。

**批准后提交:**
- `git add speccode/changes/<slug>/` + `git commit -m "docs(speccode): brainstorm <slug>"`
- commit 成功后触发 onBrainstormed 钩子:
  ```bash
  echo '{"command":"brainstorming","feature_branch":"<F>","worktree_branch":"<W>"}' | speccode.mjs run-hook --cwd . --event onBrainstormed
  ```
  输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。
- **写记忆**:把本命令产出的决策/进度摘要(经用户确认或按本命令内置判据)追加到本 feature 的 memory。用 heredoc 经 stdin 传 JSON(不用 `echo '<json>'`:zsh 会把 `\n` 解释成字面换行,摘要含单引号也会破壳):
  ```bash
  speccode.mjs write-memory --cwd . --branch <F> --json-stdin <<'EOF'
  {"mode":"append","content":"<摘要>"}
  EOF
  ```

**长会话主动记忆**:在以下时机 MUST 主动执行 write-memory(append),不等命令出入口:①一个开发阶段/任务完成且距上次写入已隔多个阶段;②会话上下文显著增长(接近 compact 风险);③compact 恢复后继续工作的首个阶段完成时。写入内容 MUST 是关键决策/进度/待办的摘要,并经用户确认或遵循本命令内置判据。

**衔接实现:**
- 调用 `/speccode:writing-plans` 创建详细实现计划。这是唯一终态——MUST NOT 直接开始实现。

## Visual Companion

一个浏览器伴侣,用于脑暴中展示 mockup、图表和可视化选项。它是工具,不是模式——接受它意味着可视化问题可以走浏览器,不代表每个问题都走浏览器。

**提供时机(just-in-time):** 不要一开始提供。等到某个问题 genuinely 展示比描述更清楚时(真实的 mockup/布局/图表问题,不只是 UI 话题),再用**一条独立消息**提供:
> "接下来的部分可能看比听更清楚——我可以在浏览器标签里做 mockup、图表和并排对比。这功能较新且可能耗 token。要开吗?"

**这条提供 MUST 是独立消息**,不含其他内容。等用户回复。接受 → 用 `--open` 启动(浏览器自动打开);拒绝 → 继续纯文本,用户不提就不再提供。

**逐问题决策:** 即使已接受,每个问题都要判断走浏览器还是终端。判据:**用户看比读更好理解吗?** mockup/线框/布局对比/架构图/并排视觉设计 → 浏览器;需求问题、概念选择、权衡列表、A/B/C/D 文字选项、范围决策 → 终端。UI 话题不自动等于可视化问题。

用户同意后,先读详细指南再操作:`${CLAUDE_PLUGIN_ROOT}/references/visual-companion.md`。启动命令:`bash ${CLAUDE_PLUGIN_ROOT}/references/visual-companion-scripts/start-server.sh --project-dir <项目根> --open`(产物持久化到 `.speccode/brainstorm/`)。
