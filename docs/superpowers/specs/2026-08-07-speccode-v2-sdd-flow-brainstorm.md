# speccode-v2-sdd-flow 提案查漏补缺(Brainstorm 记录)

- 日期:2026-08-07
- 对象:`openspec/changes/speccode-v2-sdd-flow/`(proposal / design / tasks / 9 个 capability delta)
- 方法:六视角并行审查(需求覆盖 / spec 质量 / 引擎可实现性 / 文档间一致性 / 移植保真 / 边界场景)+ 对 critical/important 发现逐条对抗核实(默认怀疑,读源码反驳)
- 规模:29 个 agent;产出 50 条原始发现,23 条核实成立(0 条被驳),27 条 minor

## 用户决策(两条,均已落地)

1. **PR 冲突检测:真正实现 CONFLICTING。** v1 spec 承诺「PR 冲突立即报错」但 v1 实现里 CONFLICTING 是死分支(parsePrState 从未产出)。v2 把 prtool 查询扩展 mergeable/has_conflicts 映射,`query-pr` 状态五态化 `{MERGED, OPEN, CLOSED, CONFLICTING, UNKNOWN}`,轮询遇冲突立即报错。
2. **exploring 跨会话承接:允许 trunk 级 `_exploring.md`。** exploring 在 trunk 上运行、无 feature 归属时,结论写主仓 `.speccode/memory/_exploring.md`(untracked);creating-feature 出口读取迁入新 feature memory 骨架并清空该文件。这是 memory 命名规则的唯一非 feature 例外(session-memory spec 显式声明,design D18)。

## 核实成立发现的处置(23 条,按主题)

**tasks 覆盖缺口(补强完成任务)**
- finishing-worktree 融合改写无任务承接 → 新增 tasks 1.8(测试门禁/四菜单/typed-discard/清理判据/合并复测/query-pr 轮询)
- CONFLICTING 解析 → tasks 1.7a(prtool mergeable 映射 + 测试)
- 理念节仅列一条 → tasks 8.1 五条理念全列
- 14 个 hook 事件只点名 9 个 → tasks 6.4 逐命令点名
- dogfood 缺 code-review 节点 → tasks 8.9 补 requesting-code-review
- reset 清理粒度 → tasks 2.5 明确按目录整体粒度
- creating-worktree 基线测试、finishing-worktree 合并复测(移植自 using-git-worktrees Step 3 / finishing-a-development-branch)→ tasks 2.6 / 1.8

**spec 契约修正**
- CONFLICTING 状态来源:git-workflow 与 pr-tool-integration 两处 spec 对齐为五态
- hook payload 分工:引擎只补 envelope 四字段(event/timestamp/repo_root/cwd),`command` 由命令层传入;stdin 容忍空输入
- 新增「hook shell 执行语义」requirement(sh -c / cwd=项目根 / 30s 超时)
- `resolve-worktree-dir` 收敛两态 `config|default`(default 时命令层重问写回)
- worktree 清理判据改「前缀 +(worktree_dir 下 或 state 登记)」,覆盖 worktree_dir 变更后旧目录泄漏
- config v2:hooks 改列可选字段;补「拒绝升级则整体保持 v1,无混合态」scenario;新增「写 verb stdin 契约」requirement(--json-stdin 必填)
- archiving 补 tasks 完成检查(警告不硬阻断)+ 同日两轮归档恢复建议;proposing 补「目录已存在未归档」询问;syncing 补 Purpose 权威 scenario
- sdd-document-lifecycle 新增「命令衔接链」requirement(writing-plans 终态二选一 / SDD 整支审查走 requesting-code-review / debugging 联动 TDD+verification)
- finishing-worktree 补「本地合并后复测」「保留后状态不变」scenario;creating-worktree 新增「项目 setup 与基线测试」requirement

**移植保真**
- visual companion 脚本内 `.superpowers/brainstorm/` 硬编码重映射为 `.speccode/brainstorm/`(tasks 4.2)
- references 补 `find-polluter.sh`(被 root-cause-tracing.md 引用)与 `condition-based-waiting-example.ts`(被 condition-based-waiting.md 引用)(tasks 5.7/5.8)
- requesting-code-review 原文 HEAD~1 取 BASE 示例须改写为「调用方记录的 BASE」(tasks 5.6)
- 交叉引用改写规则覆盖全部移植命令(tasks 5.6a)

**plugin-packaging(第 4 条被证伪 requirement)**
- restructure change 已归档、主 spec 已落地;v2 delta 对其记 4 条 MODIFIED(增「命令正文手写路径与引擎一致」——清除 display-reset/untracked_permanent 用例);design D17 重写

**minor 27 条处置原则**:能随修订顺带解决的全部并入上述编辑(措辞统一、枚举注记、锚点补齐、realpath 测试注记等);少数判据类 scenario(auto 模式感知、上下文显著增长)保持 prose 级表述,属有意取舍。

## 修订后状态

- `openspec validate speccode-v2-sdd-flow --strict` 通过;无占位符;delta 共 67 个 requirement 块
- 提案已提交:commit `02f8e42`
- 实施计划分期:P1 已出完整计划 `docs/superpowers/plans/2026-08-07-speccode-v2-p1-topology.md`(11 个 Task,TDD 先行);P2–P8 各自另出计划(P2 init 增强、P3-P4 文档生命周期命令、P5 执行方法论+SDD 引擎、P6 hooks、P7 memory、P8 文档与 sync/archive)
