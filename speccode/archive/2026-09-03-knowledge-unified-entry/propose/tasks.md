# Tasks: knowledge-unified-entry

## 任务 1:重写 distilling-knowledge.md 入口与收尾段

- [x] 1.1 前置 §2-3 重写:trunk 入口校验 → 「运行于 state 登记的 chore/knowledge-* worktree」;trunk 上运行 → state 查询未完成分支(续跑询问 / 引导 creating-worktree,type=chore,slug 默认 knowledge-distill);删除 bootstrap(裸 checkout -b / push -u / 登记校验 feature-progress / --no-merged 检测)整段
- [x] 1.2 落盘 §4 重写:删除直通 PR(查重/创建/pr_tool=none 内联处理)整段 → 改为「引导执行 /speccode:finishing-worktree 收尾(建议 PR 不等待)」;_knowledge memory 摘要改从 finishing-worktree 输出取 PR url(或等效命令)
- [x] 1.3 校验:命令中不残留「MUST NOT 创建 state / 不开 worktree / 不跑 reconcile / 不阻塞等待合并」等特权条款;不残留 git --no-merged 判定

验证:通读全文,`grep -n "no-merged\|不阻塞\|MUST NOT 创建" distilling-knowledge.md` 零命中

## 任务 2:重写 recording-knowledge.md 入口与收尾段

- [x] 2.1 同任务 1 的前置重写(slug 默认 knowledge-<内容主题>,无主题 knowledge-record)
- [x] 2.2 同任务 1 的落盘重写
- [x] 2.3 校验:同任务 1.3

验证:同任务 1.3 的 grep

## 任务 3:README ×2 同步

- [x] 3.1 README.md(EN)命令表/正文:两命令运行位置描述改为「在 chore/knowledge-* worktree 分支上运行,统一入口与收尾」
- [x] 3.2 README_CN.md 同步对应中文段(结构一一对应)
- [x] 3.3 核对:两版无版本号/测试数量硬编码,结构段号对齐

验证:双语 diff 对照 + grep 版本号/测试数零命中

## 任务 4:门禁与收尾

- [x] 4.1 全量测试:`node --test ./plugins/speccode/tests/*.test.mjs` 266 基线保持绿
- [x] 4.2 执行 `/speccode:syncing`(delta 合并进 speccode/spec/knowledge-set/)
- [x] 4.3 执行 `/speccode:archiving`
- [ ] 4.4 执行 `/speccode:finishing-worktree`(PR 路由,建议 PR 不等待)

验证:全量测试绿;syncing 幂等报告;PR 创建成功
