---
name: "SpecCode: Display Merge Trunk"
description: "把主干代码 merge 到标的分支 display"
category: Workflow
tags: [speccode, workflow, display]
---

同步主干到 display。全程中文。

1. `read-config`;`display.enabled=false` → 提示"当前无标的分支"并退出。
2. HEAD 必须在 display;否则提示 `git checkout <display>`。
3. `git fetch origin`。
4. 若存在 active feature(`reconcile` 的 features 非空)→ 提示"有未完成 feature,merge 可能冲突",询问是否继续。
5. `git merge --no-ff origin/<trunk>`;冲突 → 报错,提示用户手动解决。
6. 成功 → `git push origin <display>`。
7. 打印:display 已同步主干。
