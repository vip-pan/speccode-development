---
tier: 2
---

# Proposal: readme-optimization

## Why

根 README(EN/CN)落后 v3 双层拓扑现实(82589e5 remove feature layer 只更新了插件 README):门面仍在教 v2 的「三层拓扑」与 opt-in 路径,新用户照 Quickstart 会走错入口;且主规格 plugin-packaging「文档三层分离」自身钉着 v2 词汇(三层拓扑图、24 命令表),是门面过时的上游根因。同时对照 spec-kit / superpowers / BMAD / aider 四参照物,门面缺少优秀 README 的标配结构(安装前置、编号工作流段、安全警告前置)。

## What Changes

- **P0 事实修正(根 README EN/CN)**:①「三层拓扑」措辞 → 双层(Why 第 1 条 / 拓扑节标题与 ASCII 图 / 文档地图描述);②「看它干活」demo 与 Quickstart 第 3 步改演普通需求路径(`creating-worktree` 直达,`creating-feature` 仅作 opt-in 标注);③demo 输出文案去掉 v2 语言(「merged back into feature」);④贡献段流程链改普通链路(exploring → creating-worktree → … → finishing-worktree)。
- **P1 结构优化(根 README EN/CN)**:hero 压缩为一句话定位 + 短段(替换 90 词长段);badges 后新增 **Install 节**(两行 `/plugin` 命令前置,BMAD 式);新增 **The Basic Workflow 编号步骤段**(superpowers 式,普通需求 7 步);Prerequisites 增补 **Windows 不支持**一行;demo 输出改普通需求路径。
- **P2 增强(根 README EN/CN + 插件 README EN/CN + spec)**:新增 **⚠ 安全警告节**(`git clean` 对 `.speccode/` 的风险,精简版前置、指向插件 README §14 详文);**命令计数去字面量**(标题去数、正文去「24」/「11」,以「全套」表述或链接承载——顺带解决旧轮遗留 Open Question「计数不硬编码 vs 写死」);对比矩阵**新增 BMAD 列**(基于其 README 主页保守标注);插件 README §2 标题去数 + 知识两命令行瘦身;spec delta 同步(MODIFIED「文档三层分离」)。

无 BREAKING 变更;不涉 lib / bin / tests / skills。

## Capabilities

- **MODIFIED: plugin-packaging**(「文档三层分离」requirement:门面元素列表更新、拓扑措辞双层化、计数契约改为与实扫一致、特性矩阵加 BMAD 列、安全警告节入元素清单)

## Impact

- **受影响文件**:根 `README.md` / `README_CN.md`、`plugins/speccode/README.md` / `README_CN.md`、`speccode/spec/plugin-packaging/spec.md`(经 syncing,本需求只产 delta)。
- **不受影响**:lib / bin / tests / skills / hooks / CI;测试套件仅作回归保护(基线 279/279)。
- **联动**:门面计数去字面量后,「文档版本信息不漂移」requirement 由实现直接合规;CLAUDE.md 的计数(24 命令 / 14 lib 模块)不在本次范围(开发文档,须与实扫一致即可)。
