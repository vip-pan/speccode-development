---
description: "从 trunk 或集成分支切出开发分支(git worktree)并登记 state,普通需求的唯一入口"
---

创建开发分支(worktree)。普通需求的唯一入口;大需求场景从集成分支切出子分支。全程中文交互。

## 前置

1. `read-config` 加载 config;为 null → 提示先 `/speccode:init` 并退出。
2. HEAD 校验:基点判定为集成分支时,若主仓 HEAD 恰在该集成分支上则直接采用,否则以基点判定结果为准(显式 ref);普通需求(基点 trunk)对 HEAD 无要求——分支由本命令创建(`git worktree add -b`),不要求预先存在。
3. 运行 `speccode.mjs reconcile --cwd . --advance-pr`:
   - `conflicts` 非空 → 报告冲突并退出(v3 中应为恒空,出现即异常,提示人工检查 state)。
   - `orphans` 非空 → 告知用户,但不阻断创建。
4. 运行 `speccode.mjs read-memory --cwd . --branch <基点分支>`(有父实体时读父实体,否则跳过)作为上下文。

## 决定分支名与基点

1. **参数直给**:参数中已含 `<type>/<slug>` 形式完整分支名 → 直接采用;slug 即探索 topic 名(slug=topic 约定),按该约定查找承接。
2. **topic 选择**:参数未直给时,运行 `speccode.mjs list-memory --cwd .` 取既有探索 topic 清单;非空 → AskUserQuestion 选既有 topic(或新建/跳过),slug 预填 topic 名,type 从所选 topic 内容推断;清单为空 → 直接询问。推断 MUST NOT 静默生效。
3. **基点判定**(依 state 中的 `kind:"integration"` 父实体):
   - 0 个父实体 → 基点 = `config.trunk`(普通需求),打印「普通需求:从 <trunk> 切出」。
   - 恰好 1 个 → 打印「检测到父实体 <branch>(大需求),将从其集成 head 切出」并经用户确认。
   - ≥2 个 → AskUserQuestion 列出父实体供选;直给完整分支名时跳过本判定。
4. **校验 slug**:`^[a-z0-9-]+$`;非法 → 拒绝并提示合法字符集;确认恰好一个 `/`。

## 创建

1. `git worktree add <worktree_dir>/<branch> -b <branch> <基点>`(基点为 trunk 或集成分支;worktree_dir 经 `resolve-worktree-dir` 解析,gitignore 校验同既有三分支)。
2. **项目 setup 与基线测试**:按标记文件执行(setup 与基线失败询问,同既有契约)。
3. 写 state:经 `write-state --branch <branch> --json-stdin`,内容 `{branch, type, worktree: <绝对路径>, merge_target: <集成分支名;普通需求写 config.trunk>, status: "in_progress", created_at, initial_branch: <基点>}`(merge_target 恒写)。
4. **登记父实体**(存在父实体时):经 `write-state --branch <父分支> --json-stdin` 读后整写父实体,`children` 追加 `{slug: "<本分支 slug>"}`(**仅 slug,不写状态**——状态由本分支 state 派生)。
5. **承接探索结论**(slug=topic 命中):`rename-memory --branch _exploring/<slug> --to <branch> --json-stdin`(stdin `{}`);ok → append 骨架头;`not found` → 骨架 replace「无」;`already exists` → 报告跳过。三分支契约同 creating-feature 既有口径。
6. 触发 onWorktreeCreated 钩子(payload 同既有)。
7. 打印:worktree 已创建于 `<路径>`,请 `cd` 过去开发。

## 完成后引导

手动模式询问是否执行 `/speccode:proposing`;auto 模式自动衔接;判断不充分 MUST 询问(同既有)。
