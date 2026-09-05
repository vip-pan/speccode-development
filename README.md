# speccode

An end-to-end SDD (Spec-Driven Development) and automated development system for coding-agent CLIs — Claude Code as the primary, dogfooded host, with adapters for Codex, Kimi Code, ZCode, OpenCode, and Pi (per-host install status in [references/host-mapping/README.md](./references/host-mapping/README.md)) — not just a plugin, but a complete methodology: parallel multi-requirement development, in-repo spec document hosting, a standardized PR flow, and a self-hosting toolchain that dogfoods the whole workflow. The `speccode` plugin (24 `/speccode:*` commands) is the runtime that crystallizes the SDD methodology (explore / document / plan / subagent execution / review) into the default path; this repo also hosts the spec master (`speccode/spec/`), the archive of every change, and the development-workflow skills that automate the repo's own development.

[English](README.md) | [简体中文](README_CN.md)

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![platform: macOS/Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)]() [![version](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/vip-pan/speccode/main/.claude-plugin/plugin.json&query=$.version&label=version&color=blue)](https://github.com/vip-pan/speccode/releases) [![tests](https://github.com/vip-pan/speccode/actions/workflows/test.yml/badge.svg)](https://github.com/vip-pan/speccode/actions/workflows/test.yml) [![GitHub stars](https://img.shields.io/github/stars/vip-pan/speccode)]()

## Why speccode

- ✅ **Parallel multi-requirement development** — a two-layer topology: normal requirements cut a `<type>/<slug>` dev branch (git worktree) straight from trunk, large requirements opt in to an integration branch; a reconciliation algorithm automatically assigns every worktree, so multiple features and worktrees proceed in parallel without interfering with each other.
- ✅ **In-repo document hosting** — spec documents (`speccode/changes → spec/ → archive/`) are tracked on every branch and committed on save, riding the PR chain up to trunk.
- ✅ **Standardized workflow** — 24 commands + hooks (14 lifecycle events) + cross-session memory turn team conventions into executable primitives.
- ✅ **Self-hosting automated development** — this repo develops itself with speccode (dogfood): every change walks the full SDD chain, the spec master and archive live in-repo, and development-workflow skills automate the repo's own process. A working reference for an automated development system, not just a plugin to install.

## See It in Action

```console
$ /speccode:init                      # probe remote/trunk/code intelligence tooling, write .speccode/config.json
✓ config ready: trunk=main, remote=origin, pr_tool=gh
$ /speccode:creating-feature chore/payment-api
✓ feature branch created and pushed, state registered
$ /speccode:creating-worktree
✓ worktree checked out, baseline tests all pass
$ /speccode:proposing
✓ proposal/design/specs/tasks committed on save
$ /speccode:finishing-worktree
✓ test gate passed, changes merged back into feature
$ /speccode:finishing-feature
✓ single PR merged to trunk, back on main
```

## Prerequisites

- **Node.js ≥ 24** — the engine runs on Node (pure ESM, zero third-party deps)
- `git`
- `gh` CLI (GitHub) or `glab` CLI (GitLab) — optional; when absent, `pr_tool` auto-degrades to `none` and commands print the equivalent command for you to run manually

## Quickstart (5-Minute Minimal Loop)

1. Install the plugin:

   ```bash
   /plugin marketplace add vip-pan/speccode
   /plugin install speccode@speccode
   ```

2. Run `/speccode:init` to initialize configuration.
3. Use `/speccode:creating-feature` to create your first feature branch, then `/speccode:creating-worktree` to check out a development worktree.
4. Run `/speccode:status` to see the whole picture.

After installation, commands appear under the `/speccode:` prefix, e.g. `/speccode:init`, `/speccode:status`, `/speccode:finishing-feature`.

**Other coding agents?** speccode ships thin adapters for Codex, Kimi Code, ZCode, OpenCode, and Pi — see [references/host-mapping/README.md](./references/host-mapping/README.md) for each host's install entry, tool mapping, and verification status. Non-Claude-Code hosts also need the engine shim on PATH: `bash scripts/install-shim.sh`.

## 24 Commands at a Glance

| Group | Commands |
|---|---|
| Lifecycle | `init` `exploring` `creating-feature` `creating-worktree` `finishing-worktree` `finishing-feature` `status` `reset` |
| Document flow | `proposing` `brainstorming` `writing-plans` `applying` `syncing` `archiving` |
| Knowledge | `distilling-knowledge` `recording-knowledge` |
| Methodology | `subagent-driven-development` `executing-plans` `dispatching-parallel-agents` `test-driven-development` `systematic-debugging` `requesting-code-review` `receiving-code-review` `verification-before-completion` |

See [design doc §2 command table](./docs/DESIGN.md) for each command's purpose and prerequisites.

The flow is tiered by requirement size: tiny changes can take Tier 1 (after proposing, `/speccode:applying` implements tasks.md item-by-item by hand), small-to-medium ones go `writing-plans` + SDD/`executing-plans`, and complex ones brainstorm first.

## Two-Layer Branch Topology

```
origin/trunk ── <type>/<slug> dev branch (git worktree) ──┬── worktree-a (parallel work)
                                                          └── worktree-b (parallel work)
large requirements (opt-in): trunk ── integration branch ── child dev branches
spec documents are tracked on all branches and ride the PR chain up to trunk
```

See [design doc §3](./docs/DESIGN.md) for the full topology and key points.

## How We Compare

| Capability | speccode | [superpowers](https://github.com/obra/superpowers) | [spec-kit](https://github.com/github/spec-kit) | ad-hoc |
|---|---|---|---|---|
| Two-layer branch topology (dev branches as worktrees) + reconciliation | ✅ | — | — | — |
| In-repo spec document hosting (tracked on all branches) | ✅ | — | partial | — |
| Multi-host install (6 coding agents) | ✅ (CC verified; others per-host status in host-mapping) | ✅ | ✅ (cross-agent CLI) | — |
| SDD methodology (explore / document / plan / execute / review) | ✅ (self-contained port) | ✅ (source) | — | — |
| Lifecycle hooks + cross-session memory | ✅ | — | — | — |
| Standardized PR/MR flow | ✅ | — | — | — |

Where ad-hoc conventions leave "where do docs go / which branch to cut / who opens the PR" to human memory, speccode turns all three into a default path.

## Philosophy

Test-driven · systematic over improvisation · reduce complexity · evidence over assertions · don't be overconfident (ask first when unsure)

## Documentation Map

| Document | Contents |
|---|---|
| [Design Doc](./docs/DESIGN.md) | 24-command reference, two-layer topology, R1-R13 risks, 0.1 → 0.2 migration (plugin design document) |
| [CHANGELOG](./CHANGELOG.md) | Release history (Keep a Changelog, all in Chinese) |
| [Host mapping](./references/host-mapping/README.md) | Per-host install entries, tool mapping and verification status for the six supported coding agents |
| [AGENTS.md](./AGENTS.md) | Development documentation (source of truth; `CLAUDE.md` is a thin Claude Code shell): three-layer engine architecture, testing conventions, speccode workflow |
| `support/` | Dev-workflow skill (true source) and helper scripts — `speccode-workflow` installed to `.claude/skills/` via `support/install-skills.sh` for Claude Code lazy-loading |
| `speccode/spec/` · `speccode/archive/` | SDD spec master (capability-keyed current-state snapshot included) and archived change records — the system's own living documentation |

## Contributing

This repo is dogfooded by speccode itself — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow. Spec changes go through the `speccode/changes/` workflow, so contributing means walking the same workflow (exploring → creating-worktree → proposing → implementation → review → syncing → archiving → finishing-worktree). PRs to speccode, written with speccode, are welcome.

After cloning, run `bash support/install-skills.sh` to install this repo's development-workflow skill into `.claude/skills/` (keeps the `speccode-workflow` skill — the double-layer native chain, dogfood conventions, and release discipline — available to Claude Code sessions in this repo).

## License

MIT, see [LICENSE](./LICENSE).
