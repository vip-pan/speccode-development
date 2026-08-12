## 1. 命令骨架与共享原语

- [x] 1.1 创建 `.claude/commands/speccode/` 目录,准备 10 个命令的 markdown 文件占位
- [x] 1.2 实现 `wait_for_pr_merge(pr_tool, head, base, interval=30s, timeout=1800)` 共享原语(gh / glab 两条查询路径,每 30 秒轮询,统一返回 MERGED / CLOSED / CONFLICTING / TIMEOUT 状态)
- [x] 1.3 实现"写临时文件 + `mv` 覆盖"的原子写入工具,作为所有 .speccode 配置与 state 文件的统一写入方式
- [x] 1.4 实现 ISO 8601 UTC 时间戳工具(`new Date().toISOString()`),作为所有 `initialized_at` / `created_at` / `completed_at` / `pending_operation.updated_at` 的来源
- [x] 1.5 定义 state 文件 schema(worktree 状态枚举 `pending|in_progress|pr_open|completed`、`pr_number`、`worktree_overrides`、`pending_operation`)并实现读写辅助

## 2. /speccode:init

- [x] 2.1 实现 git remote URL 探测(github.com → gh, gitlab → glab,其他 → none)
- [x] 2.2 实现 pr_tool 安装校验(`command -v gh` / `command -v glab`),未安装则降级 none
- [x] 2.3 实现主干分支探测(`git symbolic-ref refs/remotes/origin/HEAD`),带用户确认
- [x] 2.4 实现 display 分支的"询问-创建-拉取-关联 origin"四态流程
- [x] 2.5 实现 spec_tools 询问(多选 openspec / superpowers,每项问 doc_dir)
- [x] 2.6 实现 untracked_permanent 列表询问(默认 .claude .agent .opencode .speccode CLAUDE.md AGENTS.md)
- [x] 2.7 实现首次 init 流程(创建 `.speccode/` 与 `config.json`)
- [x] 2.8 实现二次 init 的字段级幂等(逐字段 diff 询问,备份 + 临时文件 + mv 写入)
- [x] 2.9 在 init 完成后打印 config 摘要与下一步指引

## 3. /speccode:start

- [x] 3.1 实现 initial 分支校验(display 存在则必须在 display,否则必须在 trunk)
- [x] 3.2 实现 openspec/changes/ 与 docs/superpowers/ 扫描,推断 type(slug)规则 feature/bugfix/refactor/chore
- [x] 3.3 实现 slug 用户询问(扫描不到时回退),校验 slug 合法字符集 `[a-z0-9-]` 与"恰好一个 `/`",非法则拒绝
- [x] 3.4 实现"本地已存在 / 远端已存在 / 全新"三态处理
- [x] 3.5 实现 `git checkout -b` + `git push -u origin` 推送
- [x] 3.6 实现 state/features/<type>__<slug>.json 写入(feature_branch、created_at、initial_branch、status=in_progress、worktrees: {})

## 4. /speccode:develop-start

- [x] 4.1 实现 HEAD feature 分支校验
- [x] 4.2 实现对账算法入口(读取 `git worktree list --porcelain` 与 `state/features/*.json`)
- [x] 4.3 实现对账的 ancestor 判定(`git merge-base --is-ancestor`)
- [x] 4.4 实现对账的 worktree_overrides 显式覆盖
- [x] 4.5 实现对账的孤儿检测与错误退出(无法补齐的不一致)
- [x] 4.6 实现 worktree 名默认规则(worktree- + feature 后半段)与用户确认,校验 `worktree-` 前缀
- [x] 4.7 实现 `git worktree add <path> -b <branch> <feature>`
- [x] 4.8 更新 state 文件(worktrees 新增 status=in_progress)

## 5. /speccode:develop-complete

- [x] 5.1 实现 HEAD worktree 分支校验(必须以 `worktree-` 开头)
- [x] 5.2 复用对账算法(与 develop-start 同一段实现),含 pr_open 推进
- [x] 5.3 实现合并方式询问(1 轮三选一:PR+等待、PR+不等待、本地 squash)
- [x] 5.4 实现开 PR 前 `git push origin <feature>` 同步 base;non-fast-forward 时中止提示
- [x] 5.5 实现 PR 推送与创建路径(`git push -u origin <W>` + pr_tool 创建 PR)
- [x] 5.6 实现本地 squash merge 路径(`git merge --squash` + `git commit` + `git worktree remove <wt_path> --force` + `git branch -D <W>`)
- [x] 5.7 实现路径 1(等待):wait_for_pr_merge 调用与超时/关闭/冲突错误处理
- [x] 5.8 实现路径 2(不等待):worktree 置 `pr_open` 并记 `pr_number`,不清理、不阻塞
- [x] 5.9 实现 PR 合并后的清理(worktree remove <wt_path> --force + branch -D + 询问是否删远端)
- [x] 5.10 更新 state 文件(worktree.status=completed, completed_at)
- [x] 5.11 打印状态报告(进度 X/Y done + 全部完成时建议 finish)
- [x] 5.12 实现 --resume(检测 feature state 的 `pending_operation` 并续跑)

## 6. /speccode:finish

- [x] 6.1 实现 HEAD feature 分支校验
- [x] 6.2 finish 开头跑对账(复用对账算法),再检查 worktree 状态
- [x] 6.3 实现"未完成 worktree 阻止 finish"检查(存在 pending/in_progress/pr_open 均阻止;对账发现残留 worktree 也阻止)
- [x] 6.4 实现"未跟踪 spec 文档"检查与警告(工作区有启用工具的 doc_dir 却未 tracked → 警告,不主动提交)
- [x] 6.5 实现 display 存在性判断与 target_pr_branch 选择
- [x] 6.6 路径 A 第一阶段:推送 feature 到 origin + pr_tool 创建 PR→display + wait_for_pr_merge(阻塞)
- [x] 6.7 路径 A 第二阶段:`git checkout -b <feature>-complete <display 上的 merge_commit>`
- [x] 6.8 实现文档剥离原语 `git rm -r --cached <doc_dir>`(遍历 spec_tools.enabled)
- [x] 6.9 实现 `git commit --amend --no-edit` 折叠剥离动作
- [x] 6.10 实现 `git push -f origin <feature>-complete`
- [x] 6.11 路径 A 第三阶段:pr_tool 创建 PR→trunk + wait_for_pr_merge(阻塞)
- [x] 6.12 路径 B(无 display):从 6.7 开始,target=trunk
- [x] 6.13 trunk PR 合并后回收 `<feature>-complete`(本地 `git branch -D` + 远端 `git push origin :<feature>-complete`)
- [x] 6.14 完成后清理:rm state/features/<type>__<slug>.json + git checkout display/trunk(feature 分支保留)
- [x] 6.15 实现 --resume(检测 feature state 的 `pending_operation`,按 phase 续跑;超时时写入 pending_operation)
- [x] 6.16 实现 pr_tool=none 降级(打印等效 PR 命令并中止)

## 7. /speccode:display-merge-trunk

- [x] 7.1 实现 HEAD display 校验
- [x] 7.2 实现"有 active feature 时提示"警告
- [x] 7.3 实现 `git merge --no-ff origin/<trunk>` 与冲突报错
- [x] 7.4 实现 `git push origin display`

## 8. /speccode:display-rebase-trunk

- [x] 8.1 实现 HEAD display 校验与重写历史警告
- [x] 8.2 实现 `git rebase origin/<trunk>`
- [x] 8.3 实现冲突时的 AI 协助(检测 `git status` 中的 unmerged,提示用户解决后 `git rebase --continue`)
- [x] 8.4 实现 `git push -f origin display`

## 9. /speccode:display-reset-to-trunk

- [x] 9.1 实现 HEAD display 校验与"会丢弃 commit"警告
- [x] 9.2 实现文档备份到 `.speccode/backup/display-reset-<timestamp>/`
- [x] 9.3 第一阶段 commit:`git rm -r --cached <doc_dir>` + `git commit -m "chore: untrack spec docs (pre-trunk-reset)"`
- [x] 9.4 实现 `git reset --hard origin/<trunk>`
- [x] 9.5 第二阶段 commit:`git add <doc_dir>` + `git commit -m "chore: re-track spec docs on display"`
- [x] 9.6 实现 `git push -f origin display` 前的二次确认
- [x] 9.7 实现 .speccode/backup/ 清理询问

## 10. /speccode:reset

- [x] 10.1 实现 active_features 检测(任何 state 文件存在则报错)
- [x] 10.2 实现逐字段询问清理(trunk / display / pr_tool / spec_tools.* / untracked_permanent / remote)
- [x] 10.3 实现 config.json.bak.<timestamp> 备份
- [x] 10.4 实现 worktree 清理(过滤 worktree- 前缀 + `git worktree remove --force` + `git branch -D`)
- [x] 10.5 实现 `rm -rf .speccode/state/`
- [x] 10.6 实现 config 写回(临时文件 + mv,只保留用户确认保留的字段)
- [x] 10.7 提示重新 init 或继续使用

## 11. /speccode:status

- [x] 11.1 实现 status 开头跑对账(纯只读,除对账自愈外无副作用)
- [x] 11.2 汇总所有 active feature 及其 worktree 进度(X/Y done + 每个 worktree 状态)
- [x] 11.3 显示每个 feature 的 `pending_operation` 挂起状态(哪个操作卡住、等哪个 PR)
- [x] 11.4 显示当前 config 摘要(trunk / display / pr_tool)
- [x] 11.5 无 active feature 时提示"当前无 active feature"并只显示 config 摘要

## 12. 共享能力与文档

- [x] 12.1 在 10 个命令文件中统一引用 wait_for_pr_merge、原子写入、对账算法、文档剥离原语(避免重复实现)
- [x] 12.2 为每个命令文件编写 frontmatter(name / description / category)对齐 opsx 命名空间风格
- [x] 12.3 编写 README.md,说明 speccode 适用场景、10 个命令的快速参考、未解决问题(OQ2 / OQ4)与跨平台限制
- [x] 12.4 在 README 中标注 R1-R10 风险与缓解措施,作为用户决策参考

## 13. 验收与文档归档

- [x] 13.1 在本地空仓库跑通完整流程:init → start → develop-start → develop-complete → finish(无 display 路径)
- [x] 13.2 跑通 display 路径的 finish(PR→display、wait_for_pr_merge、-complete、PR→trunk、回收 -complete)
- [x] 13.3 跑通 display-reset-to-trunk 的四步走,验证文档未丢失
- [x] 13.4 跑通 reset(先确保无 active feature,再执行)
- [x] 13.5 验证二次 init 不破坏 state
- [x] 13.6 验证对账算法在 worktree 改名 / cherry-pick / pr_open 推进等场景下的表现
- [x] 13.7 验证 develop-complete 路径 2(pr_open)→ 后续对账推进 completed 的闭环
- [x] 13.8 验证 finish --resume 从 pending_operation 续跑(模拟 PR 超时)
- [x] 13.9 验证 slug 非法字符被 start 拒绝、双下划线文件名不撞名
- [x] 13.10 验证 /speccode:status 在多 active feature 下的输出
- [x] 13.11 验证 R1-R10 风险在文档中均有对应说明
- [x] 13.12 用 `openspec verify add-speccode-plugin` 跑一次 verify,通过后 archive
