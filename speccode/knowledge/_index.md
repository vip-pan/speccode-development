# 知识索引

## 开发方向
- 架构 → development/architecture.md:双层分支拓扑(v3)与 children 状态派生、对账路径识别、pending_operation 续跑、引擎/CLI/命令三层分层、SDD 工作区定位差异、memory 双模式原子写、hooks warn-only、能力键制知识集快照、Tier 1/2/3 分级链路、两个 hook 家族
- 准则 → development/standards.md:原子写与写 verb --json-stdin、分支命名与身份锚点、统一入口准则、版本发布纪律与 CHANGELOG、多语言维护与计数不硬编码、落盘即 commit 与 tick 纪律、能力键 marker 与四模式(replace/replace-hand/replace-distilled/index)、TDD 与 prose 改动边界
- 环境 → development/environment.md:Node≥24 纯 ESM 零第三方依赖、测试基建(glob 形式/tmprepo/依赖注入/spawnSync BIN)、Claude Code 插件与 marketplace 布局、config v3 字段集与 state/branches 双格式、speccode 文档目录布局与主规格 OpenSpec 兼容、代码智能探测器表
- 对接 → development/integrations.md:pr_tool 探测与 query-pr 五态轮询、repo-merge-config squash 探测、hooks 载荷分工与 run-hook 永远 exit 0、代码智能两维探测与 check-ignore 三态、SDD 工件 verb、memory 数据模型、PreToolUse updatedInput 机制
- 坑 → development/pitfalls.md:启发式归属脆弱(路径识别根治)、信号源时序错位、版本与计数漂移、fence 误勾与 Task 前缀误配、children 竞态、GLM tool_use CR 注入实证、校验锚点须与规定产出对账、spec 残留旧表述矛盾;手写踩坑两条(realpath 归一/--json-stdin 布尔)
- 安全 → development/security.md:worktree 清理来源限定(路径 ∪ state 登记)、discard 逐字确认、pr_tool=none 降级、hooks warn-only 威胁模型与 envelope 权威、memory untracked 防泄漏、路径遍历防护与知识维护分支纪律、homepage scheme 门禁、清洗 hook fail-open 威胁模型
