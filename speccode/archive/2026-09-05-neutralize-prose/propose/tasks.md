# Tasks: neutralize-prose

依赖顺序分组;全部在 neutralize-prose worktree 内执行。组 1 为 TDD 红灯(先写守卫测试确认失败),组 2-7 逐项转绿。

## 1. 守卫测试先行(先红后绿)

- [x] `tests/cli.test.mjs` 新增宿主中立守卫测试:对 `skills/` 全量检索 `AskUserQuestion|CLAUDE_PLUGIN_ROOT|general-purpose|subagent_type|TodoWrite` 与 `speccode\.mjs` 调用形态,MUST 零命中(此时为红)
- [x] `tests/cli.test.mjs` 新增 `bin/speccode` wrapper 测试:可执行位 + `speccode <verb> --cwd .` 与 `node bin/speccode.mjs <verb> --cwd .` 输出一致(此时为红)
- [x] `tests/cli.test.mjs` 新增 `plugin-root` verb 测试:输出 `{ok:true,root:<绝对路径>}` 且该目录含 `bin/speccode.mjs`(此时为红)

## 2. 引擎与 wrapper(转绿 2/3)

- [x] 新建 `bin/speccode` wrapper(可执行位,转调同目录 `bin/speccode.mjs`,兼容 stdin 管道)
- [x] `bin/speccode.mjs` VERBS 表新增只读 verb `plugin-root`(以 `import.meta.url` 上溯两级定位插件根,输出 `{ok:true,root}`;不动 lib)

## 3. 机械重命名(speccode.mjs → speccode,共 101 处)

- [x] `skills/*/SKILL.md` ×94 处:`speccode.mjs <verb>` → `speccode <verb>`(含 heredoc/管道写法)
- [x] `references/re-review-prompt.md`、`references/task-reviewer-prompt.md` ×3 处:review-package / task-brief 调用形态同步
- [x] `AGENTS.md` ×4 处:verb 示例改 `speccode <verb>`;「手动调试」指引**保留** `node bin/speccode.mjs` 直调形态(规格保留项)

## 4. ${CLAUDE_PLUGIN_ROOT} → 引擎自定位(×14,5 文件)

- [x] `skills/test-driven-development/SKILL.md` ×1、`skills/systematic-debugging/SKILL.md` ×4、`skills/brainstorming/SKILL.md` ×1、`skills/requesting-code-review/SKILL.md` ×2、`skills/subagent-driven-development/SKILL.md` ×6:插件内文件引用改 `$(speccode plugin-root --cwd .)/references/...` 形态

## 5. 提问流程中性化(×11 文件)

- [x] `archiving` `creating-worktree` `distilling-knowledge` `executing-plans` `exploring` `finishing-worktree` `init` `proposing` `recording-knowledge` `reset` `subagent-driven-development`:AskUserQuestion 硬编码 → 「向用户提问(一次一问、给 2-4 个具体选项)」语义;不写宿主条件分支

## 6. 子代理派发中性化与依赖声明

- [x] `dispatching-parallel-agents` ×3 处示例、`requesting-code-review` ×1 处:`general-purpose` → 「派发子代理」语义
- [x] `subagent-driven-development`、`dispatching-parallel-agents`、`requesting-code-review` 三 skill 正文显式声明子代理依赖 + 降级路由(无子代理宿主 → executing-plans / 串行)

## 7. 周边一致性

- [x] `plugin.json` description 去「Claude Code 专属」措辞(flatten-repo 复审遗留)
- [x] `support/install-skills.sh` 增加 `--dest <dir>` 参数(缺省 `.claude/skills` 不变),AGENTS.md 对应表述同步

## 8. 验证

- [x] 全量测试 `node --test ./tests/*.test.mjs` 全绿(组 1 守卫转绿,既有 279 项不破;282 pass / 0 fail)
- [x] 宿主中立守卫手动复扫:`skills/` 与 `references/` 检索宿主 token 与 `speccode.mjs` 调用形态零命中(复扫发现 references 残留 13 处:模板 `Subagent (general-purpose):` ×4 与 visual-companion.md `${CLAUDE_PLUGIN_ROOT}` ×8,随本条修复)
- [x] shim 冒烟:PATH 环境下直接执行 `speccode plugin-root --cwd .` 与 `speccode read-config --cwd .`(stdin 管道写法同测通过)
- [x] 复审修复(code review With fixes,3 Important + 4 Minor 已修):①bin/speccode 符号链接解析(PATH shim 可 symlink 至 wrapper,含测试);②守卫测试扩展至 references/*.md(spec 场景射程,13 处漏检类别固化);③CLAUDE.md 薄壳调用形态同步;④install-skills.sh `--dest` 缺参干净报错 + 支持 `--dest=<dir>`;⑤三处语法润色(distilling/proposing/archiving);⑥wrapper 测试补 stdin 管道写 verb 锁定。知识集 standards.md「裸调约定」条目过时但位于 distilled 区(禁手改)——留待本变更 syncing 更新主规格后,由下次 distilling 自动刷新(主规格已含新形态)
