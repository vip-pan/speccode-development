---
tier: 1
---
# Proposal: docs-multi-host(README 双语定位改写 + 多宿主门面)

## Why

四个子需求落地后,产品已是六宿主流程编排插件,但用户门面(根 README 双语、marketplace 描述、设计文档定位句)仍以「Claude Code 专属」措辞呈现——潜在的非 CC 用户无法从门面发现五宿主适配,大需求的最后一块拼图。

## What Changes

- 根 `README.md` / `README_CN.md` 定位改写:一句话定位去「built on Claude Code」单宿主措辞 → 「Claude Code 主宿主 + 五宿主适配」;Quickstart 增加多宿主安装指引段(指向 `references/host-mapping/README.md` + shim);How We Compare 对比行改为多宿主口径;文档地图补 host-mapping 条目
- `.claude-plugin/marketplace.json` description 多宿主定位展开(列宿主清单)
- `docs/DESIGN.md` / `docs/DESIGN_CN.md` §1 定位句同步双语
- CHANGELOG **不在本变更改动**(发布纪律:version bump 时同步);BREAKING 提示义务(新项目 worktree 缺省 `.speccode/worktrees`)记录于父实体记忆与 finishing-feature 后的发版指引
- 契约红线:双语结构对齐(根 11 段 / 设计文档 §1-14)、版本与数量零硬编码、四文件分工不变

## Capabilities

- `plugin-packaging`(MODIFIED:文档三层分离——根 README 与设计文档职责清单新增多宿主定位与安装入口指引)

## Impact

- **受影响**:README.md、README_CN.md、.claude-plugin/marketplace.json、docs/DESIGN.md、docs/DESIGN_CN.md——纯文档变更
- **不受影响**:引擎、24 skills、adapter 与 shim(host-adapters 交付)、测试基线(299)
- **用户可见**:门面从 CC 专属变为六宿主;非 CC 用户获得清晰安装路径
