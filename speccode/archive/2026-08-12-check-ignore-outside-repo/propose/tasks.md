# Tasks: creating-worktree worktree_dir gitignore 校验修复

## 依赖组 1:lib 逻辑(无依赖)

- [ ] `lib/detect.mjs` 新增 `isPathInside(root, target)`:resolve 归一 + 前缀比较 + 尾部分隔符,防兄弟前缀误判;相对 target 经 `resolve(root, target)` 归一
- [ ] `lib/detect.mjs` 新增 `worktreeDirIgnoreState(repoRootDir, dir)`:仓库外 → `{scope:'outside'}` 不调 git;仓库内 → `git check-ignore -q dir`(cwd=repoRootDir, allowFail)→ `{scope:'inside', ignored: code===0}`

## 依赖组 2:verb 透传(依赖组 1)

- [ ] `bin/speccode.mjs` 扩展 `resolve-worktree-dir` verb:返回 `{ok, dir, source, ignore: worktreeDirIgnoreState(repoRoot(cwd), dir)}`

## 依赖组 3:命令层分支(依赖组 2)

- [ ] `commands/creating-worktree.md` 第 2 步删除裸 `git check-ignore -q <dir>`;按 `ignore` 字段三分支:outside → 静默 / inside && !ignored → 警告+询问 / inside && ignored → 静默

## 依赖组 4:测试(依赖组 1/2)

- [ ] `tests/detect.test.mjs`:isPathInside 的 inside / outside / 相对 / 兄弟前缀陷阱 + worktreeDirIgnoreState 仓库外用例(不触 git)
- [ ] `tests/cli.test.mjs`:resolve-worktree-dir 回归——config worktree_dir 指向 tmprepo 外临时目录 → `ignore.scope==='outside'` 且无 fatal;指向 tmprepo 内 → `ignore.scope==='inside'`
- [ ] 全量测试绿:`node --test ./plugins/speccode/tests/*.test.mjs`(137 基线 + 新增)

## 依赖组 5:文档核对(无依赖)

- [ ] README EN/CN 核对 check-ignore 措辞(`plugins/speccode/README.md:30/:195` 与 `README_CN.md:30`);若改动 MUST 双语同步
