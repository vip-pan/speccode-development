# Contributing to speccode

This repo is dogfooded by speccode itself — every change walks the full SDD chain. Contributing means walking the same workflow.

## Development setup

1. Clone the repo.
2. Run `bash support/install-skills.sh` to install the `speccode-workflow` skill into `.claude/skills/` (keeps the double-layer native chain, dogfood conventions, and release discipline available to Claude Code sessions in this repo).
3. Node ≥ 24 is required to run the engine and tests.

## Making a change

Spec changes go through the `speccode/changes/` workflow:

1. `/speccode:exploring` — think on trunk; conclusions land in session memory.
2. `/speccode:creating-worktree` — cut a `<type>/<slug>` worktree branch from `main` (the single entry for normal requirements).
3. `/speccode:proposing` — land the four proposal docs and set the tier (1/2/3).
4. Tier 1: `/speccode:applying`; Tier 2/3: `/speccode:writing-plans` → `/speccode:executing-plans` (or `subagent-driven-development`); Tier 3 adds `/speccode:brainstorming` before writing-plans.
5. `/speccode:requesting-code-review` → `/speccode:receiving-code-review`.
6. `/speccode:syncing` → `/speccode:archiving` → `/speccode:finishing-worktree` (single PR to `main`). Large requirements opt in via `/speccode:creating-feature` / `/speccode:finishing-feature` at both ends.

## Running tests

```bash
node --test ./plugins/speccode/tests/*.test.mjs   # glob form (avoid Node v24 MODULE_NOT_FOUND)
```

## Release discipline

Bumping `plugins/speccode/.claude-plugin/plugin.json` `version` MUST be in the same commit/PR as the matching `CHANGELOG.md` section. Tag `v<version>` on trunk and create a GitHub Release whose notes are excerpted from the CHANGELOG section.

PRs to speccode, written with speccode, are welcome.
