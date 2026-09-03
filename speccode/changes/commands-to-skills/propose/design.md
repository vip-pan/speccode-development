# design:commands/ → skills/ 全迁移

## Context

- 0.5.1(PR #48)删除了 24 个命令 frontmatter 的非标 `name`,修复 VS Code 菜单显示 `/speccode:SpecCode: X` 且选中报 Unknown command 的问题;但 `category`/`tags` 仍是非标遗留,commands/ 平面 `.md` 布局是官方不再主推的面。
- 官方对新插件建议「Use skills/ for new plugins」;skill 专有字段(`paths`、`when_to_use`、`context` 等)只在 skills/ 布局下可用。
- 本机参照:superpowers 插件纯 `skills/<name>/SKILL.md` 布局正常工作(其 frontmatter 保留 `name` + `description`)。
- 命令正文对 `references/` 的引用全部为 `${CLAUDE_PLUGIN_ROOT}/references/...` 绝对引用(5 个命令文件),引擎/tests/bin 零引用 commands/ ——迁移纯结构+文档,零逻辑波及。

## Goals

- 24 个命令迁移为 `skills/<name>/SKILL.md`,调用名 `/speccode:<name>` 完全不变
- frontmatter 收敛为只含官方字段 `description`,结构性消灭「非标字段被客户端捡用」整类问题
- git 历史尽量保留(git mv)
- 0.6.0 minor 发布,CHANGELOG 同提交

## Non-Goals

- 不改任何命令正文语义/流程指令(除 syncing.md 内部 grep 清单路径 1 处)
- 不动引擎 lib/、bin/、tests/(零引用已复核)
- 不引入 `paths`/`when_to_use`/`context` 等 skill 专有字段(留作后续演进)
- 不做 README×4 改动(无 commands/ 路径引用,「24 commands」概念性表述语义不变)

## Decisions

- **D1 目录式布局 `skills/<name>/SKILL.md`**(拒绝扁平 `skills/<name>.md`):官方 skill 布局为目录式,调用名 = 目录名;扁平仅是 commands 形态。
- **D2 frontmatter 只留 `description`,省略 `name`**(拒绝保留 name):superpowers 保留 name 亦工作,但 name 正是 0.5.1 歧义的根源;省略则回落目录名为官方明文行为,整类 name 歧义结构性消灭。`category`/`tags` 直接删,不迁移到任何替代字段——分类语义已含于 description,少一个字段少一分漂移面。
- **D3 接受模型自动调用,不设 `disable-model-invocation`**(用户 2026-09-04 确认):commands 仅用户显式调用,skills 还可被模型按 description 自动触发;24 个命令的 description 本就写明触发时机,自动调用是回归 skill 主流形态的增益(如 test-driven-development 在写代码时自动加载),用户显式调用语义不变。拒绝理由(被否):保持纯用户驱动语义的收益不足以抵消与主流形态的分叉。
- **D4 `git mv` + frontmatter 重写同一提交**:diff 小,git rename 检测应能识别(相似度阈值);即便个别文件识别失败也只是历史可读性差异,非功能风险。
- **D5 迁移一次性全量完成**(拒绝分批/双目录过渡期):24 个命令是一个整体面,双目录过渡期会制造「两个真源」状态;0.6.0 单版本切换干净。

## Risks

- **R1 VS Code 等客户端对 skills 的菜单呈现与 commands 不一致** → 缓解:superpowers 同布局本机正常;发版后本机验证任务兜底(菜单应仍显示 24 项 `/speccode:<name>` 形态)。
- **R2 自动调用在非预期场景触发工作流命令**(如探索型命令被过早拉起)→ 缓解:description 中文措辞精准描述触发时机;观察期后可对个别 skill 单文件补 `disable-model-invocation`,不必回滚整体。
- **R3 rename 检测失败致部分文件历史断链** → 缓解:git mv + 最小 diff;内容无损,`git log --follow` 在多数情况下仍可追索。

## Open Questions

(无——model-invocation 处置已定,见 D3)
