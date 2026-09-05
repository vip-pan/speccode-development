---
description: "把批准的设计转化为细粒度实现计划(每任务 2-5 分钟步,精确文件路径/完整代码/验证步骤),落 plan/ 并提交"
---

编写一份面向「零上下文工程师」的实现计划:他们需要的一切——每个任务动哪些文件、代码、测试、怎么验证——都写进去。拆成一口大小的任务。DRY、YAGNI、TDD、频繁提交。全程中文交互。

**开始时宣布:**"我在用 writing-plans 编写实现计划。"

## 前置

1. **trunk 防护**:`git rev-parse --abbrev-ref HEAD` 必须为非 trunk 的 `<type>/<slug>` 形态分支;否则退出并提示「请在开发分支上运行本命令」(防止直提 trunk)。(`read-config` 先跑,为 null → 提示先 `/speccode:init` 并退出)。
2. 运行 `speccode reconcile --cwd .` 找到所属功能分支 F,计算 slug。
3. **读输入文档(优先级固定)**:先读 `speccode/changes/<slug>/brainstorm/`(存在则以其为输入);不存在 → 回退读 `speccode/changes/<slug>/propose/`;两者都不存在 → 报错"未找到设计或需求文档,请先 `/speccode:proposing` 或 `/speccode:brainstorming`",退出。
4. **tier 门禁**:读 `speccode/changes/<slug>/propose/proposal.md` 的 frontmatter `tier:` 字段(缺失或非法 → 报错要求修复并退出):tier 为 3 时 `brainstorm/` 必须已存在,缺失 → 报错「Tier 3 必须先脑暴:请先 `/speccode:brainstorming`」并退出;tier 为 1 → 提示「本变更定层为 Tier 1,通常无需 plan;确认升档为有意行为?」,用户确认后继续;tier 字段由用户手动更新或重跑 proposing 定层,本命令 MUST NOT 修改该字段。
5. **读记忆**:运行 `speccode read-memory --cwd . --branch <F>`;返回非 null 时把 memory 内容作为既有上下文参考,再继续。

## 知识库入口

1. 运行 `speccode read-knowledge --cwd . --index` 读 `_index.md`(恒读,便宜);`exists:false` → 静默跳过本节。
2. 判断本任务相关主题 → `speccode read-knowledge --cwd . --topic <名称>` 读对应 topic 文件;`exists:false` → 静默跳过该主题。
3. 读取失败或目录不存在 → 静默跳过,绝不阻断主流程(T0 兜底,永不报错)。

## 范围检查

若设计覆盖多个独立子系统,应在脑暴阶段已拆成子项目。没拆的话,建议拆成多份计划——一个子系统一份。每份计划都应独立产出可工作、可测试的软件。

## 文件结构

先映射要创建/修改哪些文件、各自职责——分解决策在此锁定:
- 单元边界清晰、接口明确;一个文件一个职责
- 你对能整体装进上下文的代码推理最好;文件变大通常是做太多的信号
- 一起改的文件放在一起;按职责分,不按技术分层
- 既有代码库跟随现有模式;要改的文件已经太臃肿时,可以把拆分纳入计划

## 任务粒度

**一个任务 = 自带测试循环、值得一次独立评审的最小单元。** 任务边界:搭建/配置/脚手架/文档步骤折进需要它的任务;只有「评审者可以有理有据地否决任务 A 却通过任务 B」时才拆分。每个任务以可独立测试的交付物收尾。

**每步一个动作(2-5 分钟):**「写失败测试」是一步;「运行确认失败」是一步;「写最小实现」是一步;「运行确认通过」是一步;「提交」是一步。

## 计划文档头(每份计划 MUST 以此开头)

```markdown
# [特性名] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:subagent-driven-development
> (recommended) or /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [一句话目标]

**Architecture:** [2-3 句方法]

**Tech Stack:** [关键技术]

## Global Constraints
[项目级要求——版本下限、依赖限制、命名与文案规则、平台要求——每行一条,
精确值从设计文档逐字拷贝。每个任务的要求隐含包含本节。]

---
```

**Global Constraints 是下游的承重件**:执行时它会被逐字拷进每个任务评审者的派发提示,作为评审的注意力透镜。

## 任务结构

````markdown
### Task N: [组件名]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Interfaces:**
- Consumes: [本任务用到前序任务的什么——精确签名]
- Produces: [后续任务依赖什么——精确函数名、参数与返回类型;实现者只看得到自己的任务,这一块是他们了解相邻任务命名与类型的唯一途径]

- [ ] **Step 1: 写失败测试**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: 运行确认失败**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: 写最小实现**

```python
def function(input):
    return expected
```

- [ ] **Step 4: 运行确认通过**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

TDD 烙进步骤模板本身——每个任务都是「红-绿-提交」循环;步骤 2-5 分钟;`- [ ]` 复选框是执行时的跟踪机制。

## 禁止占位符

以下都是**计划失败**——绝不许写:
- "TBD"、"TODO"、"稍后实现"、"补充细节"
- "加适当的错误处理"、"加校验"、"处理边界情况"
- "为上述写测试"(不给真实测试代码)
- "与任务 N 类似"(重复写代码——任务可能被乱序阅读)
- 只描述做什么不展示怎么做的步骤(代码步骤必须有代码块)
- 引用任何任务都未定义的类型/函数/方法

## 计划自查(写完以新鲜眼光过一遍,inline 修复)

1. **规格覆盖**:扫设计文档每节——每条要求能指到具体任务吗?列出缺口并补任务。
2. **占位符扫描**:对照上表搜全文。修掉。
3. **类型一致性**:后文用的类型/方法签名/属性名与前文定义一致吗?(Task 3 的 `clearLayers()` 到 Task 7 变 `clearFullLayers()` 就是 bug。)

## 保存与提交(必须)

- 计划写到 `speccode/changes/<slug>/plan/YYYY-MM-DD-<feature>-plan.md`。
- **tasks.md 降级(勾选清单唯一性)**:计划落盘后 MUST 把 `propose/tasks.md` 降级为无勾选的动作列表(所有 `- [ ] `/`- [x] ` 前缀去掉)并在标题下加接管标记行:「> 本清单已由 plan/<计划文件名> 接管:实现进度以 plan 的 checkbox 为准,本文件不再勾选,仅作意图索引。」降级与计划同一簿记 commit 提交。降级后 tasks.md MUST NOT 再被任何命令勾选,archiving 完成度检查只数 plan/。
- **回写义务**:编写计划中发现前序文档(propose/ 或 brainstorm/)与本计划矛盾(方案错误、范围偏差、决策变更)→ MUST 回写受影响处使文档集一致,随本阶段 commit 落盘(范围不含 frontmatter 元数据)。
- 落盘即提交:`git add speccode/changes/<slug>/` + `git commit -m "docs(speccode): plan <slug>"`。
- commit 成功后触发 onPlanned 钩子:
  ```bash
  echo '{"command":"writing-plans","feature_branch":"<F>","worktree_branch":"<W>"}' | speccode run-hook --cwd . --event onPlanned
  ```
  输出 `hook.ok=false` 或含 `warning` 时打印警告(含事件名与错误摘要),MUST NOT 阻断主流程。
- **写记忆**:把本命令产出的决策/进度摘要(经用户确认或按本命令内置判据)追加到本 feature 的 memory。用 heredoc 经 stdin 传 JSON(不用 `echo '<json>'`:zsh 会把 `\n` 解释成字面换行,摘要含单引号也会破壳):
  ```bash
  speccode write-memory --cwd . --branch <F> --json-stdin <<'EOF'
  {"mode":"append","content":"<摘要>"}
  EOF
  ```

**长会话主动记忆**:在以下时机 MUST 主动执行 write-memory(append),不等命令出入口:①一个开发阶段/任务完成且距上次写入已隔多个阶段;②会话上下文显著增长(接近 compact 风险);③compact 恢复后继续工作的首个阶段完成时。写入内容 MUST 是关键决策/进度/待办的摘要,并经用户确认或遵循本命令内置判据。

## 执行交接

保存后提供二选一:

**"计划已完成并保存到 `<path>`。两种执行方式:**
**1. Subagent-Driven(推荐)** — 每个任务派发全新子代理,任务间双重审查,快速迭代
**2. Inline 执行** — 用 executing-plans 在本会话分批执行,带人工检查点
**选哪个?"**

- 选 1 → 调用 `/speccode:subagent-driven-development`
- 选 2 → 调用 `/speccode:executing-plans`
