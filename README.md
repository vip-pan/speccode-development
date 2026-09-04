# speccode

**An end-to-end SDD (Spec-Driven Development) and automated development system built on Claude Code** — parallel multi-requirement development, in-repo spec document hosting, and a standardized PR flow, crystallized into a default path by the full `/speccode:*` command set. This repo dogfoods all of it: the spec master, every archived change, and the workflow skills that automate the repo's own development live in-repo.

[English](README.md) | [简体中文](README_CN.md)

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![platform: macOS/Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)]() [![version](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/vip-pan/speccode-development/main/plugins/speccode/.claude-plugin/plugin.json&query=$.version&label=version&color=blue)](https://github.com/vip-pan/speccode-development/releases) [![tests](https://github.com/vip-pan/speccode-development/actions/workflows/test.yml/badge.svg)](https://github.com/vip-pan/speccode-development/actions/workflows/test.yml) [![GitHub stars](https://img.shields.io/github/stars/vip-pan/speccode-development)]()

## Install

```bash
/plugin marketplace add vip-pan/speccode-development
/plugin install speccode@speccode-development
```

Requires [Node.js ≥ 24](#prerequisites) and `git`. After installation, commands appear under the `/speccode:` prefix, e.g. `/speccode:init`, `/speccode:status`, `/speccode:finishing-worktree`.

## Why speccode

- ✅ **Parallel multi-requirement development** — a two-layer topology: development branches (`<type>/<slug>` git worktrees) cut straight from trunk in one step; a reconciliation algorithm automatically assigns every worktree, so multiple requirements proceed in parallel without interfering with each other.
- ✅ **In-repo document hosting** — spec documents (`speccode/changes → spec/ → archive/`) are tracked on every branch and committed on save, riding the PR chain up to trunk.
- ✅ **Standardized workflow** — the full `/speccode:*` command set + lifecycle hooks (closed enumeration) + cross-session memory turn team conventions into executable primitives.
- ✅ **Self-hosting automated development** — this repo develops itself with speccode (dogfood): every change walks the full SDD chain, the spec master and archive live in-repo, and development-workflow skills automate the repo's own process. A working reference for an automated development system, not just a plugin to install.

## The Basic Workflow

1. **exploring** — clarify the requirement on trunk; the exit decides its shape (single / several independent / large).
2. **creating-worktree** — one step from trunk to a development branch in its own worktree, baseline tests green.
3. **proposing** — land proposal / design / specs / tasks documents; commits on save; the exit assigns a tier.
4. **applying** (tiny changes) or **writing-plans + subagent-driven-development / executing-plans** — implement.
5. **requesting-code-review** — dispatch a review subagent; process feedback technically.
6. **syncing → archiving** — merge the delta into the spec master, archive the change.
7. **finishing-worktree** — test gate, then PR → trunk. (Large requirements: squash into an opt-in integration branch, finale via finishing-feature.)

## See It in Action

```console
$ /speccode:init                      # probe remote/trunk/code intelligence, write .speccode/config.json
✓ config ready: trunk=main, remote=origin, pr_tool=gh
$ /speccode:creating-worktree
✓ feature/demo-api checked out in its own worktree, baseline tests all pass
$ /speccode:proposing
✓ proposal/design/specs/tasks committed on save
$ /speccode:applying                  # Tier 1: implement tasks.md item-by-item
✓ tasks implemented, ticked, and committed
$ /speccode:requesting-code-review
✓ review passed
$ /speccode:finishing-worktree
✓ test gate passed, PR opened → trunk
```

## Prerequisites

- **Node.js ≥ 24** — the engine runs on Node (pure ESM, zero third-party deps)
- `git`
- `gh` CLI (GitHub) or `glab` CLI (GitLab) — optional; when absent, `pr_tool` auto-degrades to `none` and commands print the equivalent command for you to run manually
- **Windows is not supported** — macOS / Linux only

## Quickstart (5-Minute Minimal Loop)

1. [Install](#install) the plugin.
2. Run `/speccode:init` in your project to initialize configuration.
3. Run `/speccode:creating-worktree` to cut your first development branch (a git worktree) and get baseline tests green.
4. Run `/speccode:status` to see the whole picture.

For the full path from requirement to PR, see [The Basic Workflow](#the-basic-workflow).

## Commands at a Glance

| Group | Commands |
|---|---|
| Lifecycle | `init` `exploring` `creating-feature` `creating-worktree` `finishing-worktree` `finishing-feature` `status` `reset` |
| Document flow | `proposing` `brainstorming` `writing-plans` `applying` `syncing` `archiving` |
| Knowledge | `distilling-knowledge` `recording-knowledge` |
| Methodology | `subagent-driven-development` `executing-plans` `dispatching-parallel-agents` `test-driven-development` `systematic-debugging` `requesting-code-review` `receiving-code-review` `verification-before-completion` |

See [plugin README §2 command table](./plugins/speccode/README.md) for each command's purpose and prerequisites.

The flow is tiered by requirement size: tiny changes can take Tier 1 (after proposing, `/speccode:applying` implements tasks.md item-by-item by hand), small-to-medium ones go `writing-plans` + SDD/`executing-plans`, and complex ones brainstorm first.

## Two-Layer Branch Topology

```
normal requirement (default):
origin/trunk ──┬── feature/a  (dev branch = git worktree) ── finishing-worktree: test gate → PR → trunk
               ├── feature/b  (parallel)                    ── ─┘
               └── ...
     speccode/ spec documents are tracked on every branch and ride the PR chain up to trunk

large requirement (opt-in):
origin/trunk ── integration branch ──┬── feature/s1 ── finishing-worktree: local squash
                                     └── feature/s2 ── ─┘
                                          finishing-feature: children all completed → single PR → trunk
```

See [plugin README §3](./plugins/speccode/README.md) for the full topology and key points.

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

## Philosophy

Test-driven · systematic over improvisation · reduce complexity · evidence over assertions · don't be overconfident (ask first when unsure)

## Documentation Map

| Document | Contents |
|---|---|
| [Plugin README](./plugins/speccode/README.md) | 24-command reference, three-layer topology, R1-R13 risks, 0.1 → 0.2 migration (plugin design document) |
| [CHANGELOG](./CHANGELOG.md) | Release history (Keep a Changelog, all in Chinese) |
| [CLAUDE.md](./CLAUDE.md) | Development documentation: three-layer engine architecture, testing conventions, speccode workflow |
| `support/` | Dev-workflow skill (true source) and helper scripts — `speccode-workflow` installed to `.claude/skills/` via `support/install-skills.sh` for Claude Code lazy-loading |
| `speccode/spec/` · `speccode/archive/` | SDD spec master (11 capabilities) and archived change records — the system's own living documentation |

## Contributing

This repo is dogfooded by speccode itself — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow. Spec changes go through the `speccode/changes/` workflow, so contributing means walking the same workflow (exploring → creating-worktree → proposing → implementation → review → syncing → archiving → finishing-worktree). PRs to speccode, written with speccode, are welcome.

After cloning, run `bash support/install-skills.sh` to install this repo's development-workflow skill into `.claude/skills/` (keeps the `speccode-workflow` skill — the double-layer native chain, dogfood conventions, and release discipline — available to Claude Code sessions in this repo).

## License

MIT, see [LICENSE](./LICENSE).
