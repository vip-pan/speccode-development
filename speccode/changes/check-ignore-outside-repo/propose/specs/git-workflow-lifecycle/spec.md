## ADDED Requirements

### Requirement: creating-worktree worktree_dir gitignore 校验

`/speccode:creating-worktree` 在创建 worktree 前 MUST 对 `resolve-worktree-dir` 解析出的目录做 gitignore 校验,并 MUST 依据目录与仓库根的位置关系三分支处理:
- 目录在仓库根之外 → MUST 静默继续(仓库外目录永不可能被 git 跟踪,警告无意义);
- 目录在仓库根之内且未被任何 ignore 规则忽略 → MUST 警告「worktree 目录未被 .gitignore 忽略」并询问用户是否继续;
- 目录在仓库根之内且已被忽略 → MUST 静默继续。

校验判定 MUST 由引擎(verb)完成,命令层 MUST 只依据 verb 返回的 `ignore` 字段分支;引擎判定「仓库外」时 MUST NOT 调用 `git check-ignore`(其对仓库外路径以 fatal 退出,exit 128)。

#### Scenario: worktree_dir 在仓库外
- **WHEN** `worktree_dir` 配置为仓库根之外的绝对路径
- **THEN** 命令 MUST 不警告、不询问,直接继续创建 worktree

#### Scenario: worktree_dir 在仓库内且未忽略
- **WHEN** `worktree_dir` 为仓库内路径且未被 `.gitignore`/`info/exclude` 忽略
- **THEN** 命令 MUST 警告「worktree 目录 <dir> 未被 .gitignore 忽略,worktree 元数据可能进入 git;建议先加入 .gitignore」并询问用户是否继续

#### Scenario: worktree_dir 在仓库内且已忽略
- **WHEN** `worktree_dir` 为仓库内路径且已被 ignore 规则忽略(如默认 `.claude/worktrees`)
- **THEN** 命令 MUST 静默继续,不警告不询问
