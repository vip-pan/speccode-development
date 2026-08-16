# README 更新与优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use /speccode:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 4 个 README 的成熟度信号(ToC / 前置依赖 / 动态版本徽章 / CI 徽章 / ✅ 清单 / 对比矩阵 / CONTRIBUTING / .github 模板)+ 最小 CI + CHANGELOG 英文 highlights,不改任何运行时逻辑。

**Architecture:** 纯文档与基础设施改动。每任务先 EN 后 zh 镜像(结构 1:1);版本信息走单一数据源(动态徽章读 manifest,不硬编码);CI test-only(测试 ≠ build)。

**Tech Stack:** Markdown README(x4)、GitHub Actions YAML、Keep a Changelog。

## Global Constraints

- **双语同步**:根 README.md(EN)/ README_CN.md(zh)、插件 README.md(EN)/ README_CN.md(zh)结构 1:1,每项改动同步两语言版本。
- **不硬编码版本号**:README MUST NOT 出现 `0.2.x` 字面量;版本经 shields `dynamic/json` 读 raw `plugins/speccode/.claude-plugin/plugin.json` 的 `$.version`(单一数据源)。
- **不硬编码测试数量**:README 不写测试用例数字。
- **测试 ≠ build**:CI workflow 仅 `node --test`,MUST NOT 引入 lint/build。
- **glob 形式跑测试**:`node --test ./plugins/speccode/tests/*.test.mjs`(避 Node v24 `MODULE_NOT_FOUND`)。
- 仓库:`vip-pan/speccode-development`,trunk=`main`,worktree 分支=`worktree-readme-optimization`,feature=`chore/readme-optimization`。

---

### Task 1: 插件 README 加 Table of Contents(EN + zh)

**Files:**
- Modify: `plugins/speccode/README.md`(§1「Dependencies & Prerequisites」段之后插入 ToC)
- Modify: `plugins/speccode/README_CN.md`(对应位置插入 zh ToC,结构 1:1)

**确切新内容(EN,插在 §1 Dependencies 段后、§2 之前):**

```markdown
## Table of Contents

1. [What is speccode](#1-what-is-speccode)
2. [23-Command Quick Reference](#2-23-command-quick-reference)
3. [Three-Layer Branch Topology](#3-three-layer-branch-topology)
4. [Development Workflow](#4-development-workflow)
5. [Documentation Layout](#5-documentation-layout)
6. [The `.speccode/` Directory Structure](#6-the-speccode-directory-structure)
7. [Hooks](#7-hooks)
8. [Memory](#8-memory)
9. [Code Intelligence Tools](#9-code-intelligence-tools)
10. [Risks & Mitigations (R1–R13)](#10-risks--mitigations-r1r13)
11. [Migrating from 0.1](#11-migrating-from-01)
12. [Philosophy](#12-philosophy)
13. [Open Issues](#13-open-issues)
14. [⚠ Important Warning](#14--important-warning)
```

**确切新内容(zh,对应位置,标题用 zh 版现标题):**

```markdown
## 目录

1. [speccode 是什么](#1-speccode-是什么)
2. [23 命令速查](#2-23-命令速查)
3. [三层分支拓扑](#3-三层分支拓扑)
4. [开发工作流](#4-开发工作流)
5. [文档布局](#5-文档布局)
6. [`.speccode/` 目录结构](#6-speccode-目录结构)
7. [Hooks](#7-hooks)
8. [Memory](#8-memory)
9. [代码智能工具](#9-代码智能工具)
10. [风险与缓解(R1–R13)](#10-风险与缓解r1r13)
11. [从 0.1 迁移](#11-从-01-迁移)
12. [理念](#12-理念)
13. [开放问题](#13-开放问题)
14. [⚠ 重要警告](#14--重要警告)
```

> zh 锚点以 zh README 实际标题生成的 GitHub 锚点为准;执行时逐条对照现标题校验锚点正确。

- [x] **Step 1: EN 插入 ToC** — 在 `plugins/speccode/README.md` §1 Dependencies 段后插入上述 EN ToC。
- [x] **Step 2: zh 插入 ToC** — 在 `plugins/speccode/README_CN.md` 对应位置插入 zh ToC,逐条对照现标题校验锚点。
- [x] **Step 3: 验证** — GitHub 锚点规则:小写、空格→`-`、移除标点;两版 ToC 条目数=14 且与 §1-14 一一对应。
- [x] **Step 4: 提交** — `git add plugins/speccode/README.md plugins/speccode/README_CN.md && git commit -m "docs(readme): add ToC to plugin README (en/zh)"`

---

### Task 2: 根 README 前置 Prerequisites + Quickstart 空格修正(EN + zh)

**Files:**
- Modify: `README.md`(Quickstart 段前加 Prerequisites 段;`Quickstart(5-Minute Minimal Loop)` → `Quickstart (5-Minute Minimal Loop)`)
- Modify: `README_CN.md`(对应 zh)

**确切新内容(EN,插在 `## See It in Action` 段后、`## Quickstart` 之前):**

```markdown
## Prerequisites

- **Node.js ≥ 24** — the engine runs on Node (pure ESM, zero third-party deps)
- `git`
- `gh` CLI (GitHub) or `glab` CLI (GitLab) — optional; when absent, `pr_tool` auto-degrades to `none` and commands print the equivalent command for you to run manually
```

**确切新内容(zh):**

```markdown
## 前置依赖

- **Node.js ≥ 24** —— 引擎运行于 Node(纯 ESM、零第三方依赖)
- `git`
- `gh` CLI(GitHub)或 `glab` CLI(GitLab)—— 可选;未安装时 `pr_tool` 自动降级为 `none`,命令会打印等价命令供你手动执行
```

**空格修正:** `## Quickstart(5-Minute Minimal Loop)` → `## Quickstart (5-Minute Minimal Loop)`;zh `## Quickstart(5 分钟最小闭环)` → `## Quickstart (5 分钟最小闭环)`。

- [x] **Step 1: EN 加 Prerequisites + 修空格**
- [x] **Step 2: zh 加前置依赖 + 修空格**
- [x] **Step 3: 验证** — 两版 Quickstart 标题 `(` 前有空格;Prerequisites/前置依赖 段两版结构 1:1。
- [x] **Step 4: 提交** — `git add README.md README_CN.md && git commit -m "docs(readme): add prerequisites + fix quickstart spacing (en/zh)"`

---

### Task 3: 徽章段加动态版本徽章 + CI 状态徽章(EN + zh)

**Files:**
- Modify: `README.md`(badges 行,行 7)
- Modify: `README_CN.md`(badges 行,行 7)

**确切新内容(EN,替换原 badges 行为):**

```markdown
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![platform: macOS/Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)]() [![version](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/vip-pan/speccode-development/main/plugins/speccode/.claude-plugin/plugin.json&query=$.version&label=version&color=blue)](https://github.com/vip-pan/speccode-development/releases) [![tests](https://github.com/vip-pan/speccode-development/actions/workflows/test.yml/badge.svg)](https://github.com/vip-pan/speccode-development/actions/workflows/test.yml) [![GitHub stars](https://img.shields.io/github/stars/vip-pan/speccode-development)]()
```

> zh 版 `README_CN.md` badges 行用**同一组 URL**(徽章是 URL,语言无关),仅保持行位置一致。zh 版原 badges 行替换为同一行(徽章不翻译)。

- [x] **Step 1: EN 替换 badges 行** — 加入 `version`(dynamic/json)+ `tests`(Actions)两徽章。
- [x] **Step 2: zh 替换 badges 行** — 同一 URL 组。
- [x] **Step 3: 验证** — 检索 README 无 `0.2.5` 等版本字面量(version 徽章为 dynamic/json 形态);tests 徽章指向 `workflows/test.yml`(Task 7 产出)。
- [x] **Step 4: 提交** — `git add README.md README_CN.md && git commit -m "docs(readme): add dynamic version + CI badges (en/zh)"`

---

### Task 4: 「Why speccode」改 ✅ 可扫读清单(EN + zh)

**Files:**
- Modify: `README.md`(「Why speccode」段,行 9-14)
- Modify: `README_CN.md`(「为什么用 speccode」段)

**确切新内容(EN):**

```markdown
## Why speccode

- ✅ **Parallel multi-requirement development** — a three-layer trunk / feature / worktree topology; a reconciliation algorithm automatically assigns every worktree, so multiple features and worktrees proceed in parallel without interfering with each other.
- ✅ **In-repo document hosting** — spec documents (`speccode/changes → spec/ → archive/`) are tracked on every branch and committed on save, riding the PR chain up to trunk.
- ✅ **Standardized workflow** — 23 commands + hooks (14 lifecycle events) + cross-session memory turn team conventions into executable primitives.
- ✅ **Self-hosting automated development** — this repo develops itself with speccode (dogfood): every change walks the full SDD chain, the spec master and archive live in-repo, and development-workflow skills automate the repo's own process. A working reference for an automated development system, not just a plugin to install.
```

**确切新内容(zh):**

```markdown
## 为什么用 speccode

- ✅ **多需求并行** —— trunk / feature / worktree 三层拓扑,对账算法自动归属每个 worktree,多 feature、多 worktree 并行施工互不干扰。
- ✅ **文档仓内托管** —— spec 文档(`speccode/changes → spec/ → archive/`)所有分支 tracked、落盘即提交,随 PR 链路上 trunk。
- ✅ **流程标准化** —— 23 命令 + hooks(14 个生命周期事件)+ 跨会话 memory,团队约定变成可执行原语。
- ✅ **自托管自动化开发** —— 本仓库用 speccode 开发自身(dogfood):每次变更走完整 SDD 链路,规格主档与归档仓内托管,开发工作流 skills 自动化仓库自身流程。一个可运行的自动化开发体系样板,而不只是一个待安装的插件。
```

- [x] **Step 1: EN 改 ✅ 清单**
- [x] **Step 2: zh 改 ✅ 清单**(1:1)
- [x] **Step 3: 验证** — 两版 4 条 bullet 均以 `✅ ` 开头,内容一一对应。
- [x] **Step 4: 提交** — `git add README.md README_CN.md && git commit -m "docs(readme): scannable feature list with checkmarks (en/zh)"`

---

### Task 5: 「How We Compare」改特性矩阵(EN + zh)

**Files:**
- Modify: `README.md`(「How We Compare」段,行 69-73)
- Modify: `README_CN.md`(「和谁比」段)

**确切新内容(EN):**

```markdown
## How We Compare

| Capability | speccode | [superpowers](https://github.com/obra/superpowers) | [spec-kit](https://github.com/github/spec-kit) | ad-hoc |
|---|---|---|---|---|
| Three-layer branch topology + reconciliation | ✅ | — | — | — |
| In-repo spec document hosting (tracked on all branches) | ✅ | — | partial | — |
| Native Claude Code plugin | ✅ | ✅ | — (cross-agent CLI) | — |
| SDD methodology (explore / document / plan / execute / review) | ✅ (self-contained port) | ✅ (source) | — | — |
| Lifecycle hooks + cross-session memory | ✅ | — | — | — |
| Standardized PR/MR flow | ✅ | — | — | — |

Where ad-hoc conventions leave "where do docs go / which branch to cut / who opens the PR" to human memory, speccode turns all three into a default path.
```

**确切新内容(zh):**

```markdown
## 和谁比

| 能力 | speccode | [superpowers](https://github.com/obra/superpowers) | [spec-kit](https://github.com/github/spec-kit) | 手工约定 |
|---|---|---|---|---|
| 三层分支拓扑 + 对账 | ✅ | — | — | — |
| spec 文档仓内托管(全分支 tracked) | ✅ | — | 部分 | — |
| Claude Code 原生插件 | ✅ | ✅ | —(跨 agent CLI) | — |
| SDD 方法论(探索/文档/计划/执行/评审) | ✅(自包含移植) | ✅(来源) | — | — |
| 生命周期 hooks + 跨会话 memory | ✅ | — | — | — |
| PR/MR 流程标准化 | ✅ | — | — | — |

手工约定把「文档放哪 / 从哪个分支切 / PR 谁开」留给人脑,speccode 把三者固化为默认路径。
```

- [x] **Step 1: EN 改矩阵**
- [x] **Step 2: zh 改矩阵**(1:1)
- [x] **Step 3: 验证** — 两版 6 行 × 5 列;cell 内容一一对应。
- [x] **Step 4: 提交** — `git add README.md README_CN.md && git commit -m "docs(readme): comparison feature matrix (en/zh)"`

---

### Task 6: CHANGELOG 英文 highlights 块

**Files:**
- Modify: `CHANGELOG.md`(顶部加格式约定;为 0.2.5 / 0.2.4 / 0.2.3 小节顶部加英文 highlights)

**确切新内容(顶部格式约定,插在「纪律:…」行之后、`## [Unreleased]` 之前):**

```markdown
> **English highlights**: each version section below carries a one-line English summary at its top (`> EN: …`) for readers arriving from the English README. The Chinese entries remain the authoritative body.
```

**确切英文 highlights(插在对应版本小节 `## [x.y.z]` 行之后):**

- 0.2.5: `> EN: Knowledge commands (distilling/recording) now run from trunk — bootstrap a chore/knowledge-* maintenance branch + direct PR to trunk, no longer bound to feature/worktree state.`
- 0.2.4: `> EN: Code-intel rename (knowledge_tools → code_intel_tools); plan task checkboxes via tick-task; distilling-knowledge reads archive incrementally (consumed_archives sidecar).`
- 0.2.3: `> EN: Repositioned as an SDD + automated development system; worktree-dir gitignore fatal fix; unified finishing routing across four commands.`

- [x] **Step 1: 顶部加格式约定**
- [x] **Step 2: 0.2.5 / 0.2.4 / 0.2.3 小节加英文 highlights 行**
- [x] **Step 3: 验证** — 三小节顶部各有 `> EN:` 行;中文条目未删改。
- [x] **Step 4: 提交** — `git add CHANGELOG.md && git commit -m "docs(changelog): english highlights for 0.2.3-0.2.5"`

---

### Task 7: CI workflow(test-only)

**Files:**
- Create: `.github/workflows/test.yml`

**确切新内容:**

```yaml
name: tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Run engine tests
        run: node --test ./plugins/speccode/tests/*.test.mjs
```

- [x] **Step 1: 创建 `.github/workflows/test.yml`**(上述内容)
- [x] **Step 2: 本地验证命令** — 在 worktree 跑 `node --test ./plugins/speccode/tests/*.test.mjs`,确认 228 pass。
- [x] **Step 3: 验证** — YAML 合法;仅 `node --test`,无 lint/build;触发为 push(main)+ pull_request。
- [x] **Step 4: 提交** — `git add .github/workflows/test.yml && git commit -m "ci: add test-only workflow"`

---

### Task 8: 社区贡献文件(CONTRIBUTING + .github 模板 + README 链接)

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/pull_request_template.md`
- Modify: `README.md` / `README_CN.md`(贡献段加 CONTRIBUTING 链接)

**确切新内容(`CONTRIBUTING.md`):**

````markdown
# Contributing to speccode

This repo is dogfooded by speccode itself — every change walks the full SDD chain. Contributing means walking the same workflow.

## Development setup

1. Clone the repo.
2. Run `bash scripts/install-skills.sh` to install the `speccode-workflow` skill into `.claude/skills/` (keeps the v2 native chain, dogfood conventions, and release discipline available to Claude Code sessions in this repo).
3. Node ≥ 24 is required to run the engine and tests.

## Making a change

Spec changes go through the `speccode/changes/` workflow:

1. `/speccode:exploring` — think on trunk; conclusions land in session memory.
2. `/speccode:creating-feature` — cut a `feature/` `bugfix/` `refactor/` `chore/` branch from `main`.
3. `/speccode:creating-worktree` — cut a worktree, run baseline tests.
4. `/speccode:proposing` → `/speccode:writing-plans` → `/speccode:executing-plans` (or `subagent-driven-development`).
5. `/speccode:requesting-code-review` → `/speccode:receiving-code-review`.
6. `/speccode:syncing` → `/speccode:archiving` → `/speccode:finishing-worktree` → `/speccode:finishing-feature` (single PR to `main`).

## Running tests

```bash
node --test ./plugins/speccode/tests/*.test.mjs   # glob form (avoid Node v24 MODULE_NOT_FOUND)
```

## Release discipline

Bumping `plugins/speccode/.claude-plugin/plugin.json` `version` MUST be in the same commit/PR as the matching `CHANGELOG.md` section. Tag `v<version>` on trunk and create a GitHub Release whose notes are excerpted from the CHANGELOG section.

PRs to speccode, written with speccode, are welcome.
````

**确切新内容(`.github/pull_request_template.md`):**

```markdown
## Summary

<!-- What does this change do? One paragraph. -->

## Spec trace

<!-- Which speccode/changes/<slug>/ documents this? Link the proposal/design/specs delta. -->

## Checklist

- [ ] Tests pass: `node --test ./plugins/speccode/tests/*.test.mjs`
- [ ] If docs changed: EN/zh versions kept in sync (1:1 structure)
- [ ] No hardcoded version numbers / test counts in READMEs
- [ ] CHANGELOG updated if `plugin.json` version bumped
```

**确切新内容(`.github/ISSUE_TEMPLATE/bug_report.md`):**

```markdown
---
name: Bug report
about: Something in speccode behaves wrong
---

## What happened
<!-- Observed behavior -->

## What I expected
<!-- Expected behavior -->

## Repro
- speccode version: (run `node plugins/speccode/bin/speccode.mjs read-config --cwd .` or check `.claude-plugin/plugin.json`)
- OS:
- Steps:
```

**确切新内容(`.github/ISSUE_TEMPLATE/feature_request.md`):**

```markdown
---
name: Feature request
about: Propose a new capability or change
---

## Motivation
<!-- Why? What problem? -->

## Proposal
<!-- What change? Which capability (see speccode/spec/)? -->
```

**README 贡献段加链接(EN):** 「Contributing」段首句改为 `This repo is dogfooded by speccode itself — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow. Spec changes go through the `speccode/changes/` workflow...`(其余保留)。

**zh:** 「贡献」段首句改为 `本仓库由 speccode 自托管开发——完整流程见 [CONTRIBUTING.md](./CONTRIBUTING.md)。spec 变更走 `speccode/changes/` 工作流...`(其余保留)。

- [x] **Step 1: 创建 CONTRIBUTING.md**
- [x] **Step 2: 创建 .github/pull_request_template.md**
- [x] **Step 3: 创建 .github/ISSUE_TEMPLATE/bug_report.md + feature_request.md**
- [x] **Step 4: README(EN/zh)贡献段加 CONTRIBUTING 链接**
- [x] **Step 5: 提交** — `git add CONTRIBUTING.md .github/ README.md README_CN.md && git commit -m "docs: add CONTRIBUTING + issue/PR templates"`

---

### Task 9: 全局验证

**Files:** 只读校验,不改文件。

- [x] **Step 1: 双语结构 1:1** — 根 README(EN/zh)段数一致;插件 README(EN/zh)§1-14 一致 + ToC 条目一致。
- [x] **Step 2: 无硬编码版本** — `grep -nE '0\.[12]\.[0-9]' README.md README_CN.md plugins/speccode/README.md plugins/speccode/README_CN.md` 无命中(version 徽章 URL 中的 `main` 路径除外,非版本字面量)。
- [x] **Step 3: 基线测试** — `node --test ./plugins/speccode/tests/*.test.mjs` 仍 228 pass(README 优化不动逻辑,应不变)。
- [x] **Step 4: CI YAML 语法** — `node -e "require('fs').readFileSync('.github/workflows/test.yml','utf8')"` 存在且可读(glob 形式命令)。
- [x] **Step 5: 收尾提交(若有未提交校验修正)** — 否则跳过。
