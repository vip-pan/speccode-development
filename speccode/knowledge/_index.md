# 知识索引

## 开发方向
- 架构 → development/architecture.md:三层分支拓扑、引擎/CLI/命令分层、对账算法、worktree 状态机、hooks/syncing/knowledge 架构决策;插件自带 hooks 层为第二 hook 家族
- 准则 → development/standards.md:原子写、--json-stdin、命名规则、裸调、TDD、多语言维护、版本发布纪律、README 成熟度信号与双语控成本;清洗 hook 的 fail-open 与最小范围准则
- 环境 → development/environment.md:Node≥24 纯 ESM、marketplace 布局、config v2、worktree_dir、tmprepo、CI 与社区文件;插件 hooks/ 目录与清洗 hook 测试布局
- 对接 → development/integrations.md:gh/glab 封装、query-pr、git check-ignore 三态、代码智能工具探测、PR 工具集成;Claude Code PreToolUse updatedInput 机制
- 坑 → development/pitfalls.md:orphan 虚警、信号源时序、兄弟前缀、版本漂移、fence 误勾、stale vs superseded;GLM tool_use CR 注入诊断、updatedInput schema 校验、命令数字字面量矛盾
- 安全 → development/security.md:worktree 清理来源限定、pr_tool=none 降级、hooks warn-only 威胁模型、路径遍历防护;清洗 hook 的 fail-open 威胁模型
