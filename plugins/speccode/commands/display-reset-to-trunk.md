---
name: "SpecCode: Display Reset To Trunk"
description: "把 display 硬重置到主干,四步走保护 spec 文档不丢"
category: Workflow
tags: [speccode, workflow, display, reset]
---

把 display 硬重置到主干,同时保护 spec 文档。全程中文。

1. `read-config`;`display.enabled=false` → 提示无标的分支并退出。
2. HEAD 必须在 display。
3. **警告**:会丢弃 display 上所有未合入主干的 commit,询问确认。

## 四步走(保护文档不丢)

设 `dirs = enabledDocDirs(config)` 中工作区实际存在的目录。

1. **备份**:把 `dirs` 复制到 `.speccode/backup/display-reset-<timestamp>/`(用 `backupDocs`)。
2. **第一阶段 commit(untrack)**:`git rm -r --cached <dir>`(逐个 tracked 的)+ `git commit -m "chore: untrack spec docs (pre-trunk-reset)"`。
3. **硬重置**:`git fetch origin` + `git reset --hard origin/<trunk>`(此时工作区文档因已 untrack 而保留)。
4. **第二阶段 commit(retrack)**:`git add <dir>` + `git commit -m "chore: re-track spec docs on display"`。

## 收尾

5. `git push -f origin <display>`(执行前二次确认)。
6. 询问是否清理 `.speccode/backup/display-reset-<timestamp>/`。
7. 打印:display 已重置到主干,文档跟踪已恢复。
