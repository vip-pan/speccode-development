# tasks: README 更新与优化

> 按文件分组,每组先 EN 后 zh 镜像(结构 1:1)。运行时逻辑(`lib/`/`commands/`/`bin/`)不改。

## A. 插件 README 加 ToC(EN 先,zh 镜像)
- [ ] A1 插件 README.md(EN)§1 后插入 Table of Contents(§1-14 锚点列表)
- [ ] A2 插件 README_CN.md(zh)§1 后插入对应 ToC(结构与 EN 1:1)

## B. 根 README 结构增强(EN 先,zh 镜像)
- [ ] B1 根 README.md(EN)Quickstart 段前置 Prerequisites 一行(Node ≥ 24 + 可选 gh/glab)
- [ ] B2 根 README_CN.md(zh)对应 Prerequisites 一行
- [ ] B3 徽章段加动态版本徽章(shields `dynamic/json`,读 raw `plugins/speccode/.claude-plugin/plugin.json` 的 `$.version`)
- [ ] B4 徽章段加 CI 状态徽章(链接 `.github/workflows/test.yml`,见 E 组)— EN
- [ ] B5 徽章段 CI 状态徽章 — zh
- [ ] B6「Why speccode」改 ✅ 可扫读清单 — EN
- [ ] B7「为什么用 speccode」改 ✅ 清单 — zh(1:1)
- [ ] B8「How We Compare」改特性矩阵(行=能力,列=speccode/superpowers/spec-kit/ad-hoc)— EN
- [ ] B9「和谁比」改特性矩阵 — zh(1:1)

## C. CHANGELOG 英文 highlights 块
- [ ] C1 CHANGELOG.md 顶部加格式约定说明(每版本小节顶部一句英文摘要)
- [ ] C2 为既有 0.2.5 / 0.2.4 / 0.2.3 小节补英文 highlights(摘自该小节中文条目)

## D. 文档微修
- [ ] D1 修正 `Quickstart(5-Minute Minimal Loop)` → `Quickstart (5-Minute Minimal Loop)`(根 EN)
- [ ] D2 修正 `Quickstart(5 分钟最小闭环)` → `Quickstart (5 分钟最小闭环)`(根 zh)

## E. CI workflow
- [ ] E1 新增 `.github/workflows/test.yml`(`push` + `pull_request` 触发,`node --test ./plugins/speccode/tests/*.test.mjs`,无 lint/build)
- [ ] E2 本地验证该命令在 worktree 跑通(228 pass)

## F. 社区文件
- [ ] F1 新增 `CONTRIBUTING.md`(根,dogfood 流程 + `scripts/install-skills.sh` 指引)
- [ ] F2 新增 `.github/ISSUE_TEMPLATE/`(bug_report + feature_request 模板)
- [ ] F3 新增 `.github/pull_request_template.md`
- [ ] F4 根 README 贡献段加 `CONTRIBUTING.md` 链接(EN + zh)

## G. spec 一致性(syncing 阶段,executing 后由 syncing 命令合并)
- [ ] G1 syncing 合并 MODIFIED「文档三层分离」(ToC / 前置 Prerequisites / 动态徽章 / ✅ 清单 / 矩阵 / CONTRIBUTING + 21→23 修正)
- [ ] G2 syncing 合并 MODIFIED「版本发布纪律」(CHANGELOG 英文 highlights 块)
- [ ] G3 syncing 合并 ADDED「持续集成测试」「社区贡献文件」

## H. 验证(executing 收尾)
- [ ] H1 根/插件 README EN/zh 结构 1:1 自检(段/节对齐)
- [ ] H2 无硬编码版本号(检索 README 无 `0.2.x` 字面量;动态徽章 URL 例外)
- [ ] H3 基线测试仍 228 pass
- [ ] H4 CI workflow 语法自检(YAML 合法、glob 形式)
