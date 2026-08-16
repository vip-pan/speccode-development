# 知识索引

## 开发方向
- 架构 → development/architecture.md:三层分支拓扑、引擎/CLI/命令分层、对账算法、worktree 状态机与 hooks/syncing/knowledge 架构决策
- 准则 → development/standards.md:原子写、--json-stdin、命名规则、裸调、版本发布纪律、TDD、多语言维护、marker 纪律
- 环境 → development/environment.md:Node≥24 纯 ESM、marketplace 布局、config v2 字段、worktree_dir、探测依赖注入、tmprepo
- 对接 → development/integrations.md:gh/glab 封装、query-pr、git check-ignore 三态、代码智能工具四类探测、PR 工具集成
- 坑 → development/pitfalls.md:orphan 虚警、信号源时序、兄弟前缀、版本漂移、fence 误勾、stale vs superseded 等踩坑教训
- 安全 → development/security.md:worktree 清理来源限定、pr_tool=none 降级、hooks warn-only 威胁模型、路径遍历防护
