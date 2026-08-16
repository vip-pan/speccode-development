# Contributing to speccode

This repo is dogfooded by speccode itself — every change walks the full SDD chain. Contributing means walking the same workflow.

## Development setup

1. Clone the repo.
2. Run `bash scripts/install-skills.sh` to install the `speccode-workflow` skill into `.claude/skills/` (keeps the v2 native chain, dogfood conventions, and release discipline available to Claude Code sessions in this repo).
3. Node ≥ 24 is required to run the engine and tests.

## Making a change

Spec changes go through the `speccode/changes/` workflow:

1. `/speccode:exploring` — think on trunk; conclusions land in session memory.
2. `/speccode:creating-feature` — cut a `feature/` / `bugfix/` / `refactor/` / `chore/` branch from `main`.
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
