# proposal: README 更新与优化

## Why

speccode 的 4 个 README(根 EN/zh、插件 EN/zh)经核对事实准确(23 命令对 `commands/`、9 capability 对 `speccode/spec/`、14 hooks、版本 0.2.5 对 `.claude-plugin/plugin.json`)、与 CLAUDE.md 多语言维护纪律合规。但缺少成熟 GitHub 项目 README 的常见"成熟度信号":长文档无目录、徽章薄且无版本/CI、根 Quickstart 缺前置依赖、对比为散文而非矩阵、无 CONTRIBUTING/.github 社区文件。本次在不改变 speccode 任何运行时行为的前提下,补齐这些信号,并修正一处 spec stale(21→23)。

## What Changes

### 🟢 低风险抛光
- 插件 README(EN/zh)§1 后插入 Table of Contents(275 行 14 段,当前无目录)。
- 根 README(EN/zh)Quickstart 段前置 Prerequisites 一行(Node ≥ 24 + 可选 gh/glab)。
- 修正 `Quickstart(…)` → `Quickstart (…)`(`(` 前缺空格,根 EN/zh 两版均存在)。

### 🟡 结构增强
- 徽章段加**动态版本徽章**:shields.io `dynamic/json` 从 raw `plugins/speccode/.claude-plugin/plugin.json` 读取 `$.version`,不硬编码(合规「文档版本信息不漂移」)。
- 根 README「Why speccode」/「为什么用 speccode」由散文 bullet 改为 ✅ 可扫读清单(EN/zh 同步)。
- 根 README「How We Compare」/「和谁比」由 3 条散文改为特性矩阵(行=能力,列=speccode/superpowers/spec-kit/手工约定)。
- 新增 `CONTRIBUTING.md`(根)+ `.github/ISSUE_TEMPLATE/` + `.github/pull_request_template.md`。

### 🔴 基础设施与 i18n
- 新增 `.github/workflows/test.yml`:最小 `node --test ./plugins/speccode/tests/*.test.mjs` GitHub Action(**测试 ≠ build**,不破坏 CLAUDE.md「无 lint/build 步骤」);根 README 徽章段加 CI 状态徽章链接该 workflow。
- `CHANGELOG.md` 每版本小节顶部加**英文 highlights 块**(一句话摘要,中文条目仍为主体):面向 EN README 读者,非全量双语翻译(控成本)。
- **录制演示**:本次跳过(asciinema/GIF 需真实终端录制,无法自动生成);留作后续手动录制。

### 附带修正(spec 一致性)
- 修正 `plugin-packaging` 主规格「文档三层分离」requirement 中 "21 命令" stale → 23(README 实际已是 23 Commands,spec 落后于 0.2.4 的 21→23 演进)。

## Capabilities

- `plugin-packaging`(MODIFIED + ADDED):
  - MODIFIED「文档三层分离」:ToC / 前置 Prerequisites / 动态版本徽章 / ✅ 清单 / 对比矩阵 / CONTRIBUTING 指针 + 修正 21→23;
  - MODIFIED「版本发布纪律」:CHANGELOG 每版本小节顶部加英文 highlights 块;
  - ADDED「持续集成测试」:`.github/workflows/test.yml` test-only + CI 徽章;
  - ADDED「社区贡献文件」:`CONTRIBUTING.md` + `.github/` Issue/PR 模板。

## Impact

- 文档:`README.md`、`README_CN.md`、`plugins/speccode/README.md`、`plugins/speccode/README_CN.md`、`CHANGELOG.md`、新增 `CONTRIBUTING.md`。
- 基础设施:新增 `.github/workflows/test.yml`、`.github/ISSUE_TEMPLATE/`、`.github/pull_request_template.md`。
- 规格:经 syncing 合并 `speccode/changes/readme-optimization/propose/specs/plugin-packaging/spec.md` delta 到主规格 `speccode/spec/plugin-packaging/spec.md`。
- 运行时行为:无变化(不改 `lib/`/`commands/`/`bin/`)。
- 测试:无新增/修改测试用例;CI workflow 跑既有 228 测试。
