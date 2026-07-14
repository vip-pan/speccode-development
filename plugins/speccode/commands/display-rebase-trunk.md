---
name: "SpecCode: Display Rebase Trunk"
description: "把标的分支 display 变基到主干"
category: Workflow
tags: [speccode, workflow, display]
---

把 display 变基到主干。全程中文。

1. `read-config`;`display.enabled=false` → 提示无标的分支并退出。
2. HEAD 必须在 display。
3. **警告**:rebase 会改写 display 历史,询问确认。
4. `git fetch origin` + `git rebase origin/<trunk>`。
5. 冲突 → 检测 `git status` unmerged,提示用户解决后 `git rebase --continue`(或 `git rebase --abort`)。
6. 完成 → `git push -f origin <display>`(需确认 force push)。
7. 打印:display 已变基到主干。
