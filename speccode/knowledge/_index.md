# 知识索引

## 开发方向
- 架构 → development/architecture.md:双层分支拓扑(v3)、引擎/CLI/命令分层、reconcile 路径识别对账、worktree 状态机、children 状态派生、hooks/memory/知识集/SDD 工作区架构决策;插件自带 hooks 层为第二 hook 家族
- 准则 → development/standards.md:原子写、--json-stdin、分支命名与身份锚点(前缀退役)、TDD 红绿、多语言维护、版本发布纪律、children 单写者与迁移不静默、fail-open 清洗 hook 准则
- 环境 → development/environment.md:Node≥24 纯 ESM、Claude Code 插件布局、config v3 字段集与 state/branches 双格式、tmprepo 测试、CI 与社区文件、插件 hooks/ 测试布局
- 对接 → development/integrations.md:gh/glab 封装、query-pr 五态、repo-merge-config squash 探测、git check-ignore 三态、代码智能工具两维探测、PreToolUse updatedInput 机制
- 坑 → development/pitfalls.md:启发式归属脆弱(路径识别根治)、信号源时序、版本漂移、fence 误勾、stale vs superseded、children 竞态、GLM tool_use CR 注入、spec 残留 v2 表述矛盾
- 安全 → development/security.md:worktree 清理来源限定(路径 ∪ state 登记)、pr_tool=none 降级、hooks warn-only 威胁模型、路径遍历防护、清洗 hook fail-open 威胁模型
