# design: README 更新与优化

## Context

speccode 的 README 经核对事实准确(23 命令对 `commands/`、9 capability 对 `speccode/spec/`、14 hooks、版本 0.2.5 对 `.claude-plugin/plugin.json`),与 CLAUDE.md 多语言维护纪律(EN/zh 双版本结构 1:1、不硬编码版本号/测试数量)合规。但与成熟 GitHub 项目 README 惯例(`fzf`/`next.js`/`astro-nvim`/`shadcn-ui`/`spec-kit`)对比,缺少若干"成熟度信号":长文档目录、版本/CI 徽章、前置依赖前置、特性矩阵、社区文件。本次补齐这些信号,不改任何运行时行为。

## Goals

- 提升 README 的首印象与可发现性(marketplace 门面)。
- 让英文 README 读者不被全中文 CHANGELOG 断路。
- 引入最小 CI(test-only)支撑测试徽章与回归门禁,不引入 build/lint。
- 保持 EN/zh 双版本结构 1:1、版本/数量信息单一数据源(CLAUDE.md / spec「不漂移」纪律)。

## Non-Goals

- 不重写 README 内容(只补结构/抛光)。
- 不改 `lib/`/`commands/`/`bin/` 任何运行时逻辑。
- 不做全量 CHANGELOG 双语翻译(只加英文 highlights 摘要块)。
- 不录制终端演示(asciinema/GIF,需真实录制,本次跳过)。
- 不解决 spec「命令总数不硬编码」vs「spec/README 写 23」的内在矛盾(留 Open Question,本次仅修正 21→23 stale)。

## Decisions

- **动态版本徽章选 shields `dynamic/json` 而非静态**:静态 "0.2.5" 违反「文档版本信息不漂移」(spec 行 203);`dynamic/json` 从 raw manifest URL 读 `$.version`,单一数据源合规。否决备选:静态 badge(硬编码违规)、GitHub Release badge(Release 不触发更新检测,语义不符)。
- **CHANGELOG 加英文 highlights 块而非全量双语**:全量双语翻译维护成本高且 CHANGELOG 迭代频繁;highlights 块(每版本一句英文摘要)成本低、覆盖 EN 读者核心需求。否决备选:全量双语(成本过高)、保持全中文(EN 读者断路)。
- **CI 仅 test-only,不引 build/lint**:CLAUDE.md「无 lint/build 步骤」纪律不破(测试 ≠ build);workflow 跑 `node --test ./plugins/speccode/tests/*.test.mjs`(glob 形式,避 Node v24 `MODULE_NOT_FOUND`)。否决备选:加 lint(违反纪律)、不加 CI(测试徽章成虚荣)。
- **ToC 用 markdown 锚点列表**:GitHub 自动生成锚点,显式 ToC 是成熟长 README 惯例(`next.js`/`astro`)。插件 README 275 行 14 段加 ToC;根 README 97 行不加(短)。
- **CONTRIBUTING 独立文件而非内联**:dogfood 仓库已在根 README 内联贡献要点,独立 `CONTRIBUTING.md` 是「PRs welcome」惯例,且 `.github/` 模板标准化 Issue/PR。

## Risks

- **双语同步成本 ×4**:每项改动须同步根 EN+zh、插件 EN+zh。缓解:`tasks.md` 按文件分组,每组先 EN 后 zh 镜像;CI 不校验双语(超 scope)。
- **CI 引入新基础架构**:首次加 GitHub Actions,可能触发权限/费用认知。缓解:最小 workflow、`pull_request` + `push` 触发、仅跑测试。
- **对比矩阵维护成本**:矩阵比散文难维护。缓解:行列固定(speccode/superpowers/spec-kit/手工),只补 cell。
- **spec 21→23 修正**:主规格「文档三层分离」行 117/118/139 写 21,与「命令命名空间」行 87 的 23 不一致。缓解:syncing 阶段 MODIFIED 修正(requirement 名逐字一致)。

## Open Questions

- spec「文档版本信息不漂移」(行 203)要求「命令总数 MUST NOT 写死字面量」,但「命令命名空间」(行 87)写「23 个 slash 命令」并逐字列 23 个命令名,README 亦写「23 Commands」。本次仅修正 21→23 stale,不解决「spec/README 是否应完全去掉命令数字」的内在矛盾——留后续单独 spec 演进。
- CI 徽章链接:指向 `workflows/test.yml` 的 shields GitHub Actions badge(标准做法),与动态版本徽章并列。
