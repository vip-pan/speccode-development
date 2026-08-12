## MODIFIED Requirements

### Requirement: worktree 基础目录配置

config SHALL 支持 `worktree_dir` 字段(默认 `.claude/worktrees`);init MUST 询问并写入;creating-worktree MUST 经 `resolve-worktree-dir` verb 解析,该 verb 输出 `{dir, source}` 且 `source` MUST ∈ `{config, default}`:`config` 表示键存在,`default` 表示键缺失并返回默认目录——此时 creating-worktree MUST 重新询问用户并经 `write-config` 写回后再继续。该 verb MUST 另输出 `ignore` 字段,表示对 worktree_dir 的 gitignore 校验结果,且校验判定 MUST 三分支:
- worktree_dir 在仓库根之外 → `ignore.scope` MUST 为 `"outside"`,creating-worktree MUST 静默继续(仓库外目录永不可能被 git 跟踪);
- worktree_dir 在仓库根之内且未被忽略 → `ignore.scope` MUST 为 `"inside"` 且 `ignore.ignored` MUST 为 `false`,creating-worktree MUST 警告并建议加入 `.gitignore` 后询问用户是否继续;
- worktree_dir 在仓库根之内且已被忽略 → `ignore.scope` MUST 为 `"inside"` 且 `ignore.ignored` MUST 为 `true`,creating-worktree MUST 静默继续。

判定「仓库外」时 MUST NOT 调用 `git check-ignore`(其对外部路径 fatal+exit 128)。

#### Scenario: 默认值
- **WHEN** init 时用户未自定义 worktree 目录
- **THEN** `worktree_dir` MUST 写为 `.claude/worktrees`

#### Scenario: source=config 直接使用
- **WHEN** config.json 含 `worktree_dir`
- **THEN** `resolve-worktree-dir` MUST 返回该值且 `source` 为 `config`,creating-worktree 直接使用

#### Scenario: source=default 重问写回
- **WHEN** config.json 中 `worktree_dir` 键缺失(含被用户手动删除),执行 creating-worktree
- **THEN** `resolve-worktree-dir` MUST 返回 `{dir: ".claude/worktrees", source: "default"}`,命令 MUST 重新询问 worktree 目录,经 write-config 写回 config 后继续创建流程

#### Scenario: worktree_dir 在仓库外
- **WHEN** `worktree_dir` 配置为仓库根之外的路径
- **THEN** `ignore.scope` MUST 为 `"outside"`,creating-worktree MUST 静默继续,不警告不询问

#### Scenario: worktree_dir 在仓库内且未忽略
- **WHEN** `worktree_dir` 在仓库根之内且未被 `.gitignore`/`info/exclude` 忽略
- **THEN** `ignore` MUST 为 `{scope: "inside", ignored: false}`,creating-worktree MUST 警告并询问用户是否继续

#### Scenario: worktree_dir 在仓库内且已忽略
- **WHEN** `worktree_dir` 在仓库根之内且已被忽略(如默认 `.claude/worktrees`)
- **THEN** `ignore` MUST 为 `{scope: "inside", ignored: true}`,creating-worktree MUST 静默继续
