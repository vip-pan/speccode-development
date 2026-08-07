# Tasks: speccode-v2-sdd-flow

> 分期按依赖与风险排序。每个阶段交付后可独立评审。测试命令一律用 glob 形式:`node --test ./plugins/speccode/tests/*.test.mjs`。

## P1 拓扑收敛与改名(核心风险先行)

- [x] 1.1 删除命令文件:`commands/display-merge-trunk.md`、`display-rebase-trunk.md`、`display-reset-to-trunk.md`
- [x] 1.2 删除 `lib/docstrip.mjs`、`lib/waitmerge.mjs`、`tests/docstrip.test.mjs`、`tests/waitmerge.test.mjs`
- [x] 1.3 命令改名(新文件 + 删旧文件):`start.md`→`creating-feature.md`、`develop-start.md`→`creating-worktree.md`、`develop-complete.md`→`finishing-worktree.md`、`finish.md`→`finishing-feature.md`;命令正文内 name/交叉引用同步更新
- [x] 1.4 `finishing-feature.md` 简化为单 PR 流:删路径 A/B 分支、-complete 创建、`git rm --cached` 剥离、未跟踪文档警告;保留门禁对账、阻塞等待、`pending_operation`(command=`finishing-feature`, phase=`waiting_trunk_pr`)、`--resume`、delete-state、切回 trunk;prose 增加「检测到 `waiting_display_pr` 报错并打印手动收尾指引」
- [x] 1.5 `creating-feature.md`:initial 恒为 trunk,删 display 优先逻辑
- [x] 1.6 `state.mjs`:新增 `normalizeState()`(`LEGACY_COMMAND_NAMES = {'develop-complete':'finishing-worktree','finish':'finishing-feature'}` 映射 `pending_operation.command`;`waiting_display_pr` 原样保留),`readState` 与 `listActiveFeatures` 共同调用
- [x] 1.7 `bin/speccode.mjs`:reconcile verb 的 prefix 改为 `loadConfig(sc)?.worktree_prefix ?? 'worktree-'`(**兜底必须保留**);新增 `query-pr` verb(--number,pr_tool=none/无 config 返回 `{ok:false}`);写 verb(write-config/write-state)缺 `--json-stdin` 时返回 `{ok:false}`
- [x] 1.7a `lib/prtool.mjs` 扩展 CONFLICTING:查询参数加 mergeable/冲突字段(gh: `gh pr view --json state,mergedAt,mergeCommit,mergeable`;glab 对应标记),`parsePrState`/`queryPrState` 产出五态 `{MERGED, OPEN, CLOSED, CONFLICTING, UNKNOWN}`,查询调用透传 cwd;`prtool.test.mjs` 补冲突映射用例
- [x] 1.8 **finishing-worktree.md 融合改写**(承接 D12 与 git-workflow-lifecycle 两条 ADDED requirement,改名不产生新行为,必须显式改写):①任何合并路径前跑全量测试,失败即停不呈现菜单;②菜单恰好四项「PR + 等待合并」「PR + 不等待」「本地 squash」「保留 worktree」;③丢弃不进菜单,显式要求时先展示分支名/commit 列表/worktree 路径,逐字输入 `discard` 才执行;④清理走「前缀 + (worktree_dir 下 或 state 登记)」判据;⑤本地 squash 合并后复跑全量测试,失败即停;⑥PR 等待改为 query-pr 轮询(30s/30min),CONFLICTING 立即报错,TIMEOUT 写 `pending_operation{command:"finishing-worktree", phase:"waiting_worktree_pr"}`
- [x] 1.9 测试更新:`state.test.mjs` 补 listActiveFeatures 规范化用例;`cli.test.mjs` 补 query-pr(含 CONFLICTING、无 config)与 --json-stdin 必填用例,**保留两个 no-config reconcile 测试不动**;`config.test.mjs` 删除 `DEFAULT_UNTRACKED` import 与对应专项测试
- [x] 1.9 交叉引用改名盘点:`status.md`、`reset.md`、README 之外的保留命令中全部旧命令名引用改为新名
- [x] 1.10 P1 验收:全量测试绿;`git grep -n "display" plugins/speccode/lib plugins/speccode/bin` 零命中

## P2 init 增强与 config v2

- [ ] 2.1 `lib/detect.mjs`:`KNOWLEDGE_TOOL_DETECTORS` 探测表(understand-anything/codegraph/graphify/codemap/lightrag;plugin-dir/mcp/cli/project-dir 四类 probe);`detectKnowledgeTools(cwd, opts)` 全依赖注入;`resolveWorktreeDir(config)`
- [ ] 2.2 bin 新增 verb:`detect-knowledge-tools`、`resolve-worktree-dir`(输出 `{dir, source:'config'|'default'|'missing'}`)
- [ ] 2.3 `config.mjs`:删除 `DEFAULT_UNTRACKED`(grep 确认无其他引用)
- [ ] 2.4 `init.md` 重写:删 display/spec_tools/untracked_permanent 询问;增 worktree_dir 询问(默认 `.claude/worktrees`)、知识工具探测 + 逐项确认登记、hooks 可选询问;组装 config v2(`version: 2`);幂等 diff 支持三个新字段
- [ ] 2.5 `reset.md`:字段清理增 hooks/knowledge_tools/worktree_dir;增询问清理 `.speccode/memory/` 与 `.speccode/sdd/`(**按目录整体粒度**,不提供按 feature 挑选,前提仍是无 active feature);worktree 清理走来源限定(前缀 + (worktree_dir 下 或 state 登记))
- [ ] 2.6 `creating-worktree.md` 增强:worktree 目录经 resolve-worktree-dir 解析(source=default 时重问并 write-config 写回);创建前 `git check-ignore` warn-only 校验;创建后项目 setup(标记探测:package.json→npm install / Cargo.toml→cargo build / requirements.txt→pip install / pyproject.toml→poetry install / go.mod→go mod download);**setup 后跑基线测试,失败时报告并询问「继续还是调查」**;完成后引导 `/speccode:proposing`(auto 模式自动衔接,判断不充分默认询问)
- [ ] 2.7 `tests/detect.test.mjs`:每类 probe 正反例(全注入);resolveWorktreeDir 三态
- [ ] 2.8 P2 验收:全量测试绿

## P3 文档生命周期命令(exploring / proposing / syncing / archiving)

- [ ] 3.1 `commands/exploring.md`:移植 opsx:explore 的 stance prose(好奇/开放线程/可视化/grounded/不实现);删 openspec CLI 段;加知识库咨询段(读 config.knowledge_tools,可用优先、缺失回退 Grep/Read、不报错);不产任何文档(memory 不算文档产物);结束引导 creating-feature + creating-worktree(auto 自动、不确定默认询问);出口按归属写 memory(归属既有 feature→append 该 feature memory;无归属→写 `_exploring.md`);触发 onExplored
- [ ] 3.2 `commands/proposing.md`:改造 opsx:propose;产物固定四类 → `speccode/changes/<slug>/propose/{proposal.md,design.md,specs/<cap>/spec.md,tasks.md}`;slug = feature 分支 slug 段;**检测到 `changes/<slug>/` 已存在且未归档时询问(续写补充/先 archiving 再重建/取消)**;复杂度评估 → 复杂度高建议 brainstorming;知识库咨询段(同 exploring);落盘即 git add + commit;入口 read-memory、出口 write-memory;触发 onProposed
- [ ] 3.3 `commands/syncing.md`:改造 opsx:sync;delta 源 = propose/ 四类文档(刻意不采用 artifactPaths 单源语义,见 design D11);brainstorm/ 存在先吸收未回写残余;合并进 `speccode/spec/<capability>/spec.md`(ADDED/MODIFIED/REMOVED/RENAMED 语义);幂等;落盘即 commit;触发 onSynced
- [ ] 3.4 `commands/archiving.md`:改造 opsx:archive;任务完成检查、sync 评估提示(先建议 syncing);`mv` 到 `speccode/archive/YYYY-MM-DD-<slug>`(日期不叠加、已存在报错);落盘即 commit;触发 onArchived
- [ ] 3.5 P3 验收:scratch 仓手动走查 proposing → syncing(两遍验幂等)→ archiving(日期前缀、commit)

## P4 brainstorming + writing-plans

- [ ] 4.1 `commands/brainstorming.md`:superpowers brainstorming 近逐字移植(HARD-GATE、一次一问、2-3 方案带推荐、分段呈现逐段确认、inline self-review 四查、用户 review gate);设计文档写 `speccode/changes/<slug>/brainstorm/YYYY-MM-DD-<topic>-design.md`;**回写 propose/ 受影响文档**;知识库咨询段(同 exploring);落盘即 commit;终态引导 `/speccode:writing-plans`;触发 onBrainstormed
- [ ] 4.2 visual companion 完整移植:`references/visual-companion.md` + `references/visual-companion-scripts/`(server.cjs、start-server.sh、stop-server.sh、helper.js、frame-template.html 拷贝);**脚本与文档内 `.superpowers/brainstorm/` 路径硬编码重映射为 `.speccode/brainstorm/`(untracked,与运行时数据哲学一致),visual-companion.md 内 `.superpowers` 引用与 gitignore 提醒同步改写**;brainstorming.md 保留 just-in-time offer 流程,启动命令路径改为 `${CLAUDE_PLUGIN_ROOT}/references/visual-companion-scripts/`
- [ ] 4.3 `commands/writing-plans.md`:superpowers writing-plans 近逐字移植(plan header 模板含 Global Constraints、Task 结构、No Placeholders、inline Self-Review、Execution Handoff 二选一);输入优先 `brainstorm/`、回退 `propose/`;计划写 `speccode/changes/<slug>/plan/YYYY-MM-DD-<feature>-plan.md`;落盘即 commit;REQUIRED 下一步 = `/speccode:subagent-driven-development` 或 `/speccode:executing-plans`;触发 onPlanned
- [ ] 4.4 删除 legacy:不移植 spec-document-reviewer-prompt.md 与 plan-document-reviewer-prompt.md(现行 superpowers 已改 inline self-review)
- [ ] 4.5 P4 验收:scratch 仓走查 brainstorming(回写 propose)+ writing-plans(brainstorm 优先)

## P5 执行方法论命令(8 个)+ SDD 引擎

- [ ] 5.1 `lib/sdd.mjs`:`sddWorkspace(planFile, cwd)`(show-toplevel 定位、slug 派生校验、mkdir -p)、`extractTaskBrief(planText, n)`(纯函数,fence 感知,Task 1≠Task 10)、`taskBrief(...)`、`reviewPackage(planFile, base, head, ...)`(verify revs、commits+stat+-U10、range 命名)
- [ ] 5.2 bin 新增 verb:`sdd-workspace`、`task-brief`、`review-package`
- [ ] 5.3 `tests/sdd.test.mjs`:extractTaskBrief 纯函数用例(fence 内标题、Task 1/10)、workspace 派生、review-package 用 tmprepo 真实 commit;`cli.test.mjs` 补 linked worktree 内 sdd-workspace 定位用例(**注意 macOS 上 `os.tmpdir()` 与 `git rev-parse --show-toplevel` 的 realpath 差异,断言前对路径做 realpath 归一**)
- [ ] 5.4 `commands/subagent-driven-development.md`:superpowers SDD 503 行全量移植(ledger 首行格式、工件文件交接纪律、两阶段审查合并为一次 dispatch 双 verdict、fix loop 5 轮熔断、Model Selection 节、Common Rationalizations 表);三脚本调用改 verb;工作区 `.speccode/sdd/<plan>/`;final review 走 `/speccode:requesting-code-review`;Finish 引导 `/speccode:finishing-worktree`;每 task 完成触发 onTaskCompleted;内部交叉引用(superpowers:X 形式)一并改写
- [ ] 5.5 `commands/executing-plans.md`:近逐字移植;isolated workspace 段改「已在 speccode worktree 中」(引用 creating-worktree);收尾引导 finishing-worktree;每 task 完成触发 onTaskCompleted
- [ ] 5.6 `commands/dispatching-parallel-agents.md`、`test-driven-development.md`、`systematic-debugging.md`、`requesting-code-review.md`、`receiving-code-review.md`、`verification-before-completion.md`:近逐字移植(Red Flags / Rationalizations / Iron Law 表保留);交叉引用改 `/speccode:X` 形式;requesting/receiving-code-review 分别触发 onCodeReviewRequested/onCodeReviewCompleted;**requesting-code-review 原文中 HEAD~1 取 BASE 的示例必须改写为「调用方记录的 BASE」(与 spec「review-package 禁止相对引用」规则一致)**
- [ ] 5.6a 交叉引用改写规则适用于全部移植命令(4.1 brainstorming、4.3 writing-plans、5.4 SDD、5.5 executing-plans 同样检查内文 `superpowers:` 引用,不允许残留)
- [ ] 5.7 `plugins/speccode/references/` 伴侣文件:implementer-prompt.md、task-reviewer-prompt.md、re-review-prompt.md、code-reviewer.md、root-cause-tracing.md、defense-in-depth.md、condition-based-waiting.md、**condition-based-waiting-example.ts**(被 condition-based-waiting.md 引用)、writing-good-tests.md、**find-polluter.sh**(被 root-cause-tracing.md 引用)(原样拷贝,命令内以 `${CLAUDE_PLUGIN_ROOT}/references/<file>` 引用)
- [ ] 5.8 不移植:test-pressure-\* / test-academic / CREATION-LOG(eval fixtures)、using-superpowers、writing-skills、spec/plan-document-reviewer-prompt.md(legacy,现行已改 inline self-review)
- [ ] 5.9 P5 验收:全量测试绿;scratch 仓 SDD 单 task 走查(task-brief 抽取、review-package range 命名、ledger 续跑)

## P6 hooks

- [ ] 6.1 `lib/hooks.mjs`:`HOOK_EVENTS`(14 事件)、`buildHookPayload(event, fields, cwd)`(补 timestamp/repo_root/cwd/command)、`runHook(config, event, payload, opts)`(spawn/timeoutMs=30000 可注入;未配置→`{ran:false,ok:true}`;枚举外→warning;失败→`{ran:true,ok:false,...}`;**整体 try/catch 兜底**)
- [ ] 6.2 bin 新增 `run-hook` verb(--event,payload 片段 stdin 传入;**永远 exit 0**)
- [ ] 6.3 `tests/hooks.test.mjs`:未配置 no-op / 枚举外 warning / 非零退出 / 超时 / spawn 异常吞掉
- [ ] 6.4 各命令统一接线 14 个事件点,逐命令点名:exploring→onExplored;creating-feature→onFeatureCreated;creating-worktree→onWorktreeCreated;proposing→onProposed;brainstorming→onBrainstormed;writing-plans→onPlanned;subagent-driven-development 与 executing-plans 每 task 完成→onTaskCompleted;requesting-code-review→onCodeReviewRequested;receiving-code-review→onCodeReviewCompleted;finishing-worktree→onWorktreeFinished(PR 创建后另触发 onPrOpened);finishing-feature→onFeatureFinished(及 onPrOpened);syncing→onSynced;archiving→onArchived
- [ ] 6.5 P6 验收:全量测试绿;scratch 仓 hook stub(`cat >> /tmp/hook.log`)验 stdin JSON

## P7 memory

- [ ] 7.1 `lib/atomic.mjs`:新增 `writeTextAtomic(path, text)`(tmp+rename 同构)
- [ ] 7.2 `lib/memory.mjs`:memoryDir/memoryPath(branchToStateName 复用)/readMemory(null 缺失)/writeMemory(replace|append,走 writeTextAtomic)
- [ ] 7.3 bin 新增 verb:`read-memory`、`write-memory`(--json-stdin,`{mode, content}`)
- [ ] 7.4 `tests/memory.test.mjs`:replace/append/缺失→null/原子性
- [ ] 7.5 命令接入(入口读/出口写清单见 session-memory spec「命令读写时机」);creating-feature 出口建 memory 骨架,**读取 `_exploring.md`(若存在)迁入结论后清空该文件**;exploring 出口按归属写 memory(无归属写 `_exploring.md`)
- [ ] 7.6 各命令 prose 写入「超大会话主动发现」触发判据(阶段完成/上下文显著增长/compact 恢复后主动 write-memory,内容经用户确认或按既定判据)
- [ ] 7.7 P7 验收:全量测试绿;`/clear` 后新会话语境下由 executing-plans 入口读 memory 恢复

## P8 文档与校验

- [ ] 8.1 `plugins/speccode/README.md` 全量重写:三层拓扑图、21 命令表(生命周期/文档流/方法论三组)、文档目录 + hooks + memory + 知识工具节、R1–R13(R1/R7/R10 删除;新增 R11 hook 失败 warn-only / R12 memory last-writer-wins / R13 trunk 文档体积)、「从 0.1 迁移」对照表、**理念节完整收录五条(测试驱动 / 系统化优于临时发挥 / 降低复杂度 / 证据优于断言 / 不要过度自信-不确定先询问)**、移植基线 superpowers v6.2.0 记录
- [ ] 8.2 `CLAUDE.md` 更新:lib 13 模块清单、21 命令、references/、新不变量(run-hook 永远 exit 0、memory 走 writeTextAtomic、SDD 工作区 show-toplevel 与主仓定位差异、写 verb 必须 --json-stdin)、删 finish 双 PR 不变量改单 PR
- [ ] 8.3 `plugin.json`:version 0.1.0→0.2.0,keywords 增 `"sdd"`、`"tdd"`、`"hooks"`、`"memory"`,description 更新
- [ ] 8.4 前提确认(已满足):`restructure-as-claude-code-plugin` 已归档,`openspec/specs/plugin-packaging/spec.md` 主 spec 已落地,v2 delta 的 4 条 MODIFIED 直接作用于主 spec
- [ ] 8.5 `/opsx:sync speccode-v2-sdd-flow`(agent 流):合并全部 delta;含 plugin-packaging 四条 MODIFIED(命令命名空间 / plugin.json 元数据 / 文档三层分离 / 命令正文手写路径与引擎一致)
- [ ] 8.6 `git rm -r openspec/specs/spec-docs-tracking-control/`(REMOVED-all 后空壳主 spec 过不了校验,必须删目录)
- [ ] 8.7 校验:`openspec validate speccode-v2-sdd-flow --strict`;剩余 6 个主 spec 逐一 `--strict`;断言 spec-docs-tracking-control 目录不存在
- [ ] 8.8 回归断言:`git grep -n "display" plugins/speccode/lib plugins/speccode/bin` 零命中;`git grep -n "docstrip\|waitForPrMerge" plugins/speccode` 零命中;`git grep -rn "develop-complete\|develop-start" plugins/speccode/commands plugins/speccode/README.md` 零命中(迁移对照表除外)
- [ ] 8.9 全量测试绿 + dogfood 全流程走查(见计划/设计验证节:init→exploring→creating-feature→creating-worktree→proposing→brainstorming→writing-plans→SDD 单 task→**requesting-code-review**→syncing→archiving→finishing-worktree→finishing-feature→status/reset;中途 /clear 验 memory 恢复与 `_exploring.md` 承接)
- [ ] 8.10 `/opsx:archive speccode-v2-sdd-flow`(agent 流,**不用裸 openspec archive**)
