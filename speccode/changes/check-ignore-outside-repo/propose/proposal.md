# Proposal: creating-worktree worktree_dir gitignore 校验修复

## Why

`/speccode:creating-worktree` 的 gitignore 校验裸跑 `git check-ignore -q <dir>`;当 `worktree_dir` 配置为仓库外绝对路径时,git 返回 fatal(exit 128),被命令误判为「未被 .gitignore 忽略」,对合法配置产生误报警告、打断流程,并把 `fatal:` 噪音漏到终端。本仓库 config 的 `worktree_dir` 正是仓库外路径,每次 creating-worktree 都命中。

## What Changes

- `lib/detect.mjs` 新增纯函数 `isPathInside(root, target)`(resolve 归一 + 前缀 + 分隔符,防 `/repo` vs `/repo-evil` 兄弟前缀误判)与 `worktreeDirIgnoreState(repoRootDir, dir)`:
  - `dir` 在仓库外 → `{ scope: 'outside' }`(不调用 git,杜绝 fatal 噪音)
  - `dir` 在仓库内 → `git check-ignore -q` → `{ scope: 'inside', ignored }`
- `bin/speccode.mjs` 扩展 `resolve-worktree-dir` verb,返回 `{ ok, dir, source, ignore }`(新增字段,向后兼容)。
- `commands/creating-worktree.md` 第 2 步删除裸 `git check-ignore -q <dir>`,改为按 verb 返回的 `ignore` 字段三分支:outside → 静默;inside && !ignored → 警告 + 询问;inside && ignored → 静默。
- 测试:`detect.test.mjs` 增 `isPathInside` 纯函数用例(含兄弟前缀陷阱)与 `worktreeDirIgnoreState` 仓库外用例;`cli.test.mjs` 增回归用例(config `worktree_dir` 指向 tmprepo 外 → `ignore.scope === 'outside'`,无 fatal)。
- README EN/CN 核对 check-ignore 措辞(大概率零改动;若动 MUST 双语同步)。

## Capabilities

- `git-workflow-lifecycle`(ADDED requirement)

## Impact

- 代码:`lib/detect.mjs`、`bin/speccode.mjs`、`commands/creating-worktree.md`、`tests/detect.test.mjs`、`tests/cli.test.mjs`
- 用户:仓库外 `worktree_dir` 配置不再误报;校验语义三态化(仓库外静默 / 仓库内未忽略警告 / 仓库内已忽略静默)。
- 无 BREAKING(verb 仅增字段,命令 prose 分支逻辑内聚)。
