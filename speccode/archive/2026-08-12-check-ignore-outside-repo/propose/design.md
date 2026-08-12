# Design: creating-worktree worktree_dir gitignore 校验修复

## Context

- `commands/creating-worktree.md` 第 2 步对 `resolve-worktree-dir` 解析出的目录做 warn-only gitignore 校验:`git check-ignore -q <dir>`。
- git 退出码三态:0 = 被忽略、1 = 仓库内未忽略、128 = 路径在仓库外(`fatal: is outside repository`)。
- 命令只区分 0 / 非 0,把 128 误判为「未忽略」。
- 仓库外目录永不可能被 git 跟踪,「未忽略 → 会进入 git」对仓库外路径是范畴错误。
- 约束:`lib/detect.mjs` 的 `resolveWorktreeDir` 返回 `{dir, source}`,dir 可为 config 绝对路径或默认相对路径 `.claude/worktrees`。

## Goals

- 仓库外 `worktree_dir` 配置不产生误报警告,不打断流程,不泄漏 fatal 噪音。
- 仓库内未忽略目录的警告语义保持不变。
- 确定性判定逻辑下沉到 lib(CLAUDE.md 不变量),命令层只做分支。

## Non-Goals

- 不修改 `.gitignore` / `info/exclude` / 用户 git 机制(维持 R4「插件不往项目 .gitignore 加条目」)。
- 不改变默认路径 `.claude/worktrees` 的既有行为(已被主仓 `.git/info/exclude` 的 `**/.claude/worktrees/` 覆盖,exit 0,静默)。
- 不实现 `realpath` 符号链接解析(启发式 warn-only,`resolve` 足够)。

## Decisions

1. **三分支 `ignore` 对象而非两态 `inside_repo: boolean`**(否决:早期探索条目的 `inside_repo` 两态方案)。
   - 理由:三分支显式区分 outside / inside+ignored / inside+not-ignored;outside 分支根本不调用 git,从根上消除 fatal 噪音;两态方案仍需在命令层对 inside 再跑一次 check-ignore,保留误读风险。
2. **containment 判定用 `path.resolve` 归一 + 前缀比较 + 分隔符**(否决:依赖 `git check-ignore` 128 退出码反推)。
   - 理由:128 还覆盖其他 fatal(如非 git 仓库),反推不可靠;纯路径判定可单测、与 git 解耦。相对路径经 `resolve(root, target)` 一条线同时归一相对/绝对。
3. **扩展 `resolve-worktree-dir` verb 而非新增独立 verb**。
   - 理由:creating-worktree 已先调用该 verb,顺带返回 `ignore` 避免二次往返;新增字段向后兼容,现有调用方与测试不破。

## Risks

- 兄弟前缀误判(`/repo` vs `/repo-evil`)→ 前缀比较后补分隔符,并有专项单测。
- 相对 `worktree_dir` 解析基准含糊 → 一律以 repoRoot 为基准 `resolve`。
- README 双语漂移 → 措辞大概率不变;若变 MUST EN/CN 同步。

## Open Questions

- 无(方案已定,由两次 AskUserQuestion 确认)。
