# Design: creating-worktree worktree_dir gitignore 校验修复(brainstorm 定稿)

> 2026-08-12 · feature: bugfix/check-ignore-outside-repo · 前置 proposing 四文档见 `propose/`

## 问题

`/speccode:creating-worktree` 第 2 步对 `resolve-worktree-dir` 解析出的目录做 warn-only gitignore 校验,裸跑 `git check-ignore -q <dir>`。git 退出码三态:0=被忽略、1=仓库内未忽略、128=路径在仓库外(`fatal: is outside repository`)。命令只区分 0/非 0,把 128 误判为「未忽略」→ 对仓库外 `worktree_dir`(本仓 config 即 `/Users/game-netease/orca/workspaces/speccode-development`)必然误报警告、打断流程,并把 `fatal:` 噪音漏到终端。

**定性**:仓库外目录永不可能被 git 跟踪,「未忽略 → 会进入 git」对仓库外路径是范畴错误。该检查只对仓库内 `worktree_dir` 有意义。

## 方案(已批准:方案 A 三分支)

在 `lib/detect.mjs` 增加两个函数,扩展 `resolve-worktree-dir` verb 返回 `ignore` 字段,命令层按三分支处理:

```
isPathInside(root, target)              → boolean(纯路径,resolve 归一 + 前缀 + 分隔符)
worktreeDirIgnoreState(repoRootDir, dir) →
  ├─ 仓库外  → { scope: 'outside' }               [不调用 git,fatal 噪音从根上消失]
  └─ 仓库内  → git check-ignore -q dir(allowFail) → { scope: 'inside', ignored: code===0 }

verb resolve-worktree-dir → { ok, dir, source, ignore }
命令层:outside → 静默 / inside && !ignored → 警告+询问 / inside && ignored → 静默
```

### 权衡(否决的备选)

- **两态 `inside_repo: boolean`**:形状更简,但 `inside_repo=true` 时命令层仍需自跑 check-ignore,保留 128 误读与 fatal 噪音风险。
- **只改 prose exit-code 映射**:改动最小,但 fatal 噪音仍泄漏、依赖 128 语义脆、无测试可加、违反「确定性逻辑下沉 lib」。

## 架构与组件

- **逻辑**:`lib/detect.mjs`(与 `resolveWorktreeDir` 同族)。`isPathInside` 用 `path.resolve(root, target)` 归一(相对 target 一条线同时归一),前缀比较补尾部分隔符防 `/repo` vs `/repo-evil`。`worktreeDirIgnoreState` 仅在 `isPathInside` 为真时调用 git。
- **verb**:`bin/speccode.mjs` `resolve-worktree-dir` 追加 `ignore: worktreeDirIgnoreState(repoRoot(cwd), dir)`;`repoRoot(cwd)` 复用既有 `--git-common-dir` + dirname 定位不变量。
- **命令层**:`commands/creating-worktree.md` 第 2 步删裸 `git check-ignore -q <dir>`,按 `.ignore` 字段三分支。仓库外 → 完全静默(已确认,无 info 提示)。

## 数据流

```
creating-worktree 命令
  → resolve-worktree-dir verb
      → worktreeDirIgnoreState(repoRoot(cwd), dir)
          ├─ 仓库外  → {scope:'outside'}              [不触碰 git]
          └─ 仓库内  → git check-ignore -q dir        [仅此分支发生 git 调用]
  → 命令按 ignore 分支决定 警告?/询问?/继续?
```

## 错误处理

- 仓库外路径**永不再**进入 `git check-ignore` → `fatal: is outside repository` 与 exit 128 不再产生(根因消除)。
- 仓库内分支 `git check-ignore` 其他非零退出 → `allowFail: true` + `code===0` 判 ignored,不抛错。

## 测试

- `detect.test.mjs`:`isPathInside` inside / outside / 相对 target / 兄弟前缀 `/repo-evil` 四 case;`worktreeDirIgnoreState` 仓库外不触 git。
- `cli.test.mjs` 回归:config `worktree_dir` 指向 tmprepo 外临时目录 → `ignore.scope==='outside'`;指向 tmprepo 内 → `scope==='inside'`。
- 全量 137+ 基线保持绿。

## 非目标

- 不改 `.gitignore` / `info/exclude` / 用户 git 机制(R4)。
- 不改变默认 `.claude/worktrees` 行为(已被 `info/exclude` 覆盖,exit 0,静默)。
- 不实现 `realpath` 符号链接解析(warn-only 启发式,`resolve` 足够)。
