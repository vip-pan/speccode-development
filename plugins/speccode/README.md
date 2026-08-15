# speccode

[English](README.md) | [简体中文](README_CN.md)

> User-facing docs (installation / Quickstart / comparison & positioning) live in the root README.md; this document is the plugin design document.

## 1. What is speccode

speccode is a Claude Code workflow orchestration plugin that turns the practices previously held together by manual convention — parallel development of multiple requirements, spec document hosting, and a standardized PR/MR flow — into executable primitives exposed as 23 `/speccode:*` slash commands.

**Who it's for**: small teams or solo developers running **multiple requirements in parallel inside the same repo** — when you need to run several features at once, split each feature into multiple worktrees for parallel work, and don't want to keep second-guessing "where do the docs go", "which branch do I branch from", "who opens the PR" — speccode offers an end-to-end default path.

**Since 0.2**, speccode ships with the complete SDD methodology (explore → document → plan → subagent execution → review → finish) plus hooks / memory capabilities; the branch topology has been reduced from four layers to **three** (trunk / feature / worktree). The methodology is ported from superpowers (v6.2.0) and self-contained inside the plugin, so target projects have **zero external dependencies**.

## Dependencies & Prerequisites (applies to the whole document)

- `git` (the core: worktree / merge / rebase and every other operation is built on git)
- `gh` CLI (GitHub remote) or `glab` CLI (GitLab remote) — used to create/query PRs/MRs; when not installed, `pr_tool` automatically degrades to `none`, and commands print the equivalent command for you to run manually instead of failing
- Node.js **≥ 24** (the engine runs on Node; pure ESM, zero third-party dependencies)

## 2. 23-Command Quick Reference

Lifecycle:

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:init` | Initialize/update: probe the remote, trunk, and knowledge-base tools; configure the worktree directory and hooks; write `.speccode/config.json` (config 0.2) | Any branch (first run usually on trunk) |
| `/speccode:exploring` | Explore a requirement (produces no documents; conclusions live in the session context; knowledge-base tools preferred) | trunk |
| `/speccode:creating-feature` | Cut a feature branch from trunk and push it; register state; create the memory skeleton | trunk |
| `/speccode:creating-worktree` | Cut a worktree from the feature branch (worktree_dir configurable, check-ignore validation, project setup, baseline tests) | feature/bugfix/refactor/chore branch |
| `/speccode:finishing-worktree` | Merge worktree results back into the feature branch (test gate; wait for PR / don't wait for PR / local squash / keep; discarding requires the literal word `discard`) | worktree-* branch |
| `/speccode:finishing-feature` | Wrap up the whole feature: single PR → trunk (block until merged) → delete state → switch back to trunk | feature branch |
| `/speccode:status` | Read-only overview: worktree progress of every active feature, pending_operation, config summary | Any branch |
| `/speccode:reset` | Reset the environment: clear state and worktrees, ask field-by-field whether to clear config, ask whether to clear memory//sdd//brainstorm/ (refuses to run when active features exist) | Any branch, and must have no active features |

Documentation flow (every step commits on save):

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:proposing` | Land the four document types (proposal/design/specs/tasks) into `speccode/changes/<slug>/propose/`; the complexity assessment recommends brainstorming | worktree-* branch |
| `/speccode:brainstorming` | Socratic design refinement; designs land in `brainstorm/` and are written back into propose/ to keep them consistent | worktree-* branch |
| `/speccode:writing-plans` | Detailed implementation plan (brainstorm/ first, propose/ as fallback), lands in `plan/` | worktree-* branch |
| `/speccode:syncing` | Merge incremental changes into the `speccode/spec/` main spec (absorbs leftover brainstorm material; idempotent) | worktree-* branch |
| `/speccode:archiving` | Archive: move changes/<slug>/ into `speccode/archive/<YYYY-MM-DD>-<slug>/` | worktree-* branch |

Knowledge:

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:distilling-knowledge` | Distill the `speccode/knowledge/` topic files from `spec/` (full) + `archive/` (**incremental**: only unconsumed archive bundles, tracked via `knowledge/_distilled.meta.json`; consumed bundles skipped and their blocks carried forward, no re-distill); stale (bundle deleted) vs superseded (replaced by a newer bundle) gate distinction; SDD process knowledge only, out-of-scope topics sunset via the gate; delete the sidecar to force a full re-distill (no `--full` flag); human gate before write; commits on save | worktree-* branch |
| `/speccode:recording-knowledge` | Record knowledge directly into hand-written sections (fit check: process knowledge stays, business knowledge is pointed to external RAG; draft → human gate → atomic write); commits on save | worktree-* branch |

Methodology:

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:subagent-driven-development` | Dispatch a fresh subagent per task + double review + final review of the whole team; ledger recovery | worktree-* branch |
| `/speccode:executing-plans` | Execute the plan in batches within this session, with human checkpoints | worktree-* branch |
| `/speccode:dispatching-parallel-agents` | Concurrent subagent workflow (independent failure domains) | worktree-* branch |
| `/speccode:test-driven-development` | RED-GREEN-REFACTOR loop (with iron rules and an anti-pattern table) | worktree-* branch |
| `/speccode:systematic-debugging` | 4-stage root-cause process + defense in depth + conditional-wait techniques | worktree-* branch |
| `/speccode:requesting-code-review` | Dispatch a review subagent (spec compliance + code quality) | worktree-* branch |
| `/speccode:receiving-code-review` | Handle review feedback technically (no performative agreement) | worktree-* branch |
| `/speccode:verification-before-completion` | Evidence before assertion: verification must run before declaring anything done | worktree-* branch |

## 3. Three-Layer Branch Topology

```
origin/<trunk> (trunk; spec documents tracked)
   │
   │  /speccode:creating-feature
   ▼
feature/<slug>  (feature branch; one requirement can split into multiple rounds / multiple worktrees)
   │
   │  /speccode:creating-worktree (multiple can run in parallel)
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
worktree-a     worktree-b     worktree-c
   │  The documentation flow (proposing→brainstorming→writing-plans→…→syncing→archiving) happens on this layer
   └── /speccode:finishing-worktree (test gate + PR / local squash) merges back into feature ──┘
   │
   │  /speccode:finishing-feature (single PR → trunk, blocks until merged)
   ▼
origin/<trunk>  (feature lands; the feature branch stays as history)
```

Key points:

- **trunk**: the trunk branch (default `master`), spec documents tracked.
- **feature/bugfix/refactor/chore/<slug>**: feature branches, cut from trunk; one requirement can split into multiple rounds and multiple worktrees.
- **worktree-<suffix>**: development branches with a hard `worktree-` prefix (configurable), cut from feature via `git worktree add`; multiple can run in parallel.
- **The topology has only three layers**: v0.1's milestone branch layer and temporary wrap-up branches have been removed (see Section 11); `speccode/` documents are tracked on every branch and ride the PR chain up to trunk.

## 4. Development Workflow

The 12-step default path from requirement to archive:

1. `/speccode:exploring` — explore the requirement on trunk; conclusions stay in the session context (writes the `_exploring` memory).
2. `/speccode:creating-feature` — cut the feature branch from trunk; register state; create the memory skeleton.
3. `/speccode:creating-worktree` — cut a worktree from feature; run baseline tests.
4. `/speccode:proposing` — land the four document types: proposal/design/specs/tasks.
5. (For complex ones) `/speccode:brainstorming` — refine the design and write it back into propose/.
6. `/speccode:writing-plans` — produce the detailed implementation plan.
7. `/speccode:subagent-driven-development` or `/speccode:executing-plans` — execute the plan (methodology commands such as `/speccode:dispatching-parallel-agents`, `/speccode:systematic-debugging`, `/speccode:verification-before-completion`, `/speccode:test-driven-development` are invoked as needed along the way).
8. `/speccode:requesting-code-review` — dispatch a review subagent; process feedback with `/speccode:receiving-code-review`.
9. `/speccode:syncing` — merge the delta into the main spec.
10. `/speccode:archiving` — archive changes/<slug>/.
11. `/speccode:finishing-worktree` — merge worktree results back into feature.
12. `/speccode:finishing-feature` — single PR → trunk, block until merged, delete state, switch back to trunk.

## 5. Documentation Layout

speccode's spec documents live in the repo's `speccode/` directory, **tracked on every branch**, and ride the PR chain up to trunk:

```
speccode/
├── changes/<slug>/          # in-progress requirement documents
│   ├── propose/             # proposal.md / design.md / specs/ / tasks.md (produced by proposing)
│   ├── brainstorm/          # design refinement documents (produced by brainstorming)
│   └── plan/                # implementation plan (produced by writing-plans)
├── spec/<capability>/       # main spec (where syncing merges deltas)
├── archive/<YYYY-MM-DD>-<slug>/   # archive (archiving moves the whole directory, never deletes)
└── knowledge/               # curated knowledge set (produced by distilling-knowledge / recording-knowledge)
    ├── _index.md            # retrieval index: topic title + file + one-line summary, regenerated on demand
    ├── _distilled.meta.json # distill-consumption sidecar: consumed archive bundles (incremental read tracking)
    └── development/         # architecture.md / standards.md / environment.md / integrations.md / pitfalls.md / security.md
```

Conventions:

- **Commit on save**: proposing / brainstorming / writing-plans / syncing / archiving / distilling-knowledge / recording-knowledge each commit immediately after producing their documents, so document history and code history stay on the same branch, moving together.
- **Multi-round rebuilds of the same feature don't collide**: once changes/<slug>/ is archived the directory is freed, and the same slug can start a new round via proposing again; when rebuilding without archiving first, proposing asks "continue / archive first / cancel".
- **Knowledge set: distilled vs. hand-written split**: each topic file under `knowledge/` can mix two kinds of content. `distilling-knowledge` distills `spec/` (full read) and `archive/` (**incrementally** — only unconsumed bundles, tracked in `knowledge/_distilled.meta.json`; consumed bundles are skipped and their existing blocks carried forward unchanged, since archive bundles are immutable) into **distilled blocks**, wrapped in `<!-- distilled-from: <source> --> ... <!-- /distilled -->` markers, and fully rebuilds each topic's distilled blocks on every run (a block whose source has disappeared is marked stale; one whose knowledge is superseded by a newer bundle is marked superseded — both surfaced in the gate; deleting `_distilled.meta.json` forces a full re-distill as the official escape hatch, no `--full` flag); `recording-knowledge` appends free-form **hand-written** prose outside those markers. The rebuild is byte-preserving for everything outside the markers, so hand-written content survives every distilled-block rebuild untouched. The set curates SDD process knowledge only (`development/*`; pitfalls also covers recurring review findings and team review consensus). Business knowledge is left to external RAG systems: `recording-knowledge` runs a fit check before writing (a recommendation, not a hard block), and `distilling-knowledge` sunsets distilled blocks of out-of-scope topics through the same human gate while preserving hand-written content byte-for-byte. Legacy `promoted-from`/`/promoted` markers are still parsed on read; existing files are rewritten to the new format on their first distill.

> Plugin-side helper resources: `plugins/speccode/references/` contains visual-companion (the visual companion for brainstorming, see `references/visual-companion.md`), review prompts, and debugging methodology; all tracked with the plugin source.

## 6. The `.speccode/` Directory Structure

```
.speccode/
├── config.json                          # static config (config 0.2), written wholesale by init / reset; creating-worktree can write back worktree_dir
├── config.json.bak.<timestamp>          # explicit backup before init-idempotent / reset flows rewrite config (backup-config verb)
├── state/features/<type>__<slug>.json   # dynamic state, isolated per feature
├── memory/                              # feature-level memory + _exploring.md (self-ignored via .gitignore)
└── sdd/                                 # SDD execution artifacts: task briefs / review packages / ledger (self-ignored via .gitignore)
```

- **`config.json`**: the global static config; the config 0.2 field set: `version` (=2), `initialized_at`, `trunk`, `remote`, `pr_tool`, `worktree_prefix`, `worktree_dir`, `knowledge_tools`; `hooks` only exists when the user configured it. Wholesale writes happen only in `/speccode:init` (fresh or idempotent) and `/speccode:reset`; additionally, `/speccode:creating-worktree` asks for a directory when config lacks `worktree_dir`, then writes the field back into config via `write-config` (read current config → add field → write back wholesale). **Backups are not an automatic behavior of `write-config`**: `config.json.bak.<timestamp>` is produced by the init-idempotent flow and the reset flow explicitly calling `backup-config` before rewriting; creating-worktree's single-field write-back creates no backup.
- **`state/features/`**: one file per active feature (`<type>__<slug>.json`, double underscore separating type and slug), recording worktree progress (`pending | in_progress | pr_open | completed`) and any suspended `pending_operation` (for `--resume`). Multiple features each write their own files in parallel, no locks needed.
- **`memory/`**: feature-level session memory (see Section 8); the plugin writes its own `.gitignore` (content `*`) so it stays invisible to `git status` and is spared by `git clean -fd`.
- **`sdd/`**: SDD execution artifacts, belonging to the **current worktree root** (not the main repo root), cleaned up together with `git worktree remove`; self-ignored as well.
- Every write to `config.json` and `state/features/*.json` uses the atomic "write a temp file + rename over" strategy to avoid half-written states when a process is interrupted; memory text writes use the same strategy.

## 7. Hooks

The config's `hooks` field maps fixed lifecycle events to shell commands, triggered by commands via the `run-hook` verb at the corresponding node.

**14 fixed events** (closed enumeration; unknown event names are rejected):

`onExplored` / `onFeatureCreated` / `onWorktreeCreated` / `onProposed` / `onBrainstormed` / `onPlanned` / `onTaskCompleted` / `onCodeReviewRequested` / `onCodeReviewCompleted` / `onWorktreeFinished` / `onFeatureFinished` / `onPrOpened` / `onSynced` / `onArchived`

**payload**: the hook command reads a single line of JSON from **stdin**, with fields `event`, `timestamp` (ISO 8601 UTC), `repo_root`, `cwd`, `command`, plus `feature_branch` / `worktree_branch` / `pr_number` / `task` when available.

**Failure semantics: warn-only**. Each hook has a 30-second timeout; whether the hook is missing, times out, exits non-zero, or throws, `run-hook` always exits 0, with the error folded into the `hook` field of the returned JSON — **a hook can never interrupt the main command**.

**Usage example** (IM notification stub):

```json
"hooks": {
  "onPrOpened": "read -r p; curl -s -X POST https://im.example.com/notify -H 'Content-Type: application/json' -d \"$p\"",
  "onFeatureFinished": "read -r p; echo \"feature done: $p\" >> /tmp/speccode-hooks.log"
}
```

**Threat model**: hooks execute via `sh -c` with the full permissions of the current user; the security rationale is in R11.

## 8. Memory

speccode maintains one cross-session memory per feature: `.speccode/memory/<type>__<slug>.md`.

- **Untracked, shared across worktrees**: the memory path resolves from the **main repo root**'s `.speccode/` (same as config/state), so multiple worktrees of the same feature read and write the same file; the directory is self-ignored by the plugin's own `.gitignore` and never pollutes `git status`.
- **`_exploring.md` is the trunk-level exception**: exploring happens on trunk and belongs to no feature, so its conclusions go into `memory/_exploring.md`.
- **Commands read on entry, write on exit**: SDD commands read this feature's memory at the start to restore context, and write conclusions / decisions / remaining tasks back on exit.
- **Proactive writing during long sessions — three triggers**: ① a stage completes (e.g. propose lands, the plan passes review); ② context has grown significantly (more key decisions accumulating); ③ after a compact / session restore — hit any one of these and write memory proactively, rather than waiting for a command exit.

## 9. Knowledge Base Tools

`/speccode:init` probes five knowledge-base tools: **understand-anything / CodeGraph / Graphify / CodeMap / GitNexus**, covering four kinds of sources:

1. **Plugins**: `~/.claude/plugins/installed_plugins.json`
2. **MCP**: project `.mcp.json`, `~/.claude.json` (including the project's local scope)
3. **CLI**: `command -v <bin>`
4. **Project directories**: e.g. `.ua/`, `.codegraph/`, etc.

Probe results distinguish two dimensions — **available** and **integrated**; only tools where both `available` and `integrated` are true are presented item by item via AskUserQuestion and, upon user confirmation, registered into the config's `knowledge_tools`; tools that are available but not integrated MUST NOT be registered; if none are confirmed, an empty array is written.

Usage convention: `/speccode:exploring`, `/speccode:proposing`, and `/speccode:brainstorming` consult the registered knowledge-base tools first; when a tool is missing or a call fails, they **fall back to plain code reading and never error out** — the knowledge base is an enhancement, not a dependency.

## 10. Risks & Mitigations (R1–R13)

> The numbering follows the original v0.1 risk table: R1 / R7 / R10 were retired together with the v0.1 four-layer topology (milestone branch layer + temporary wrap-up branches), see the Section 11 migration; the rest are kept and updated to the new command names.

- **R2 — ancestry checks can misjudge when cherry-picks cross features** → Mitigation: the `worktree_overrides` field explicitly specifies worktree ownership as an "advanced-user fallback"; when a single worktree matches ≥2 features, reconciliation records `conflicts` and exits with an error, never assigning arbitrarily.
- **R3 — during init's field-by-field idempotent flow, the user may accidentally change fields like trunk** → Mitigation: every changed field MUST show the `[old value] → [new value]` diff when confirming, and is only written after the user chooses "use the new value".
- **R4 — `.speccode/` is not in `.gitignore`, so `git clean -fdx` can wipe the config** → Mitigation: explicitly warned about in the init prompt and in this README; no forced protection at the command level (consistent with the principle that "the plugin doesn't modify `.gitignore` or override the user's git mechanisms"). See Section 14's Important Warning.
- **R5 — the blocking wait for a PR merge times out after 30 minutes by default, which may not be enough for long PR reviews** → Mitigation: the timeout is a soft limit; the suspended state goes into `pending_operation` and `--resume` lets you continue later, so the command never deadlocks permanently.
- **R6 — the worktree directory is configurable, defaulting to `.claude/worktrees`** → Mitigation: `.claude/` itself is already untracked, so git won't sweep it up as content to commit; init can override the default via the config `worktree_dir`, and `creating-worktree` runs a check-ignore validation before creating the directory.
- **R8 — cross-platform (Windows / macOS / Linux) path and command differences** → Mitigation: the implementation targets macOS / Linux first, and Windows support is out of scope; command implementations rely as much as possible on the cross-platform behavior of `git` / `gh` / `glab` itself rather than doing platform checks at the shell layer.
- **R9 — `pr_open` worktrees depend on reconciliation to advance** → Mitigation: `creating-worktree` / `finishing-worktree` / `finishing-feature` / `status` all run reconciliation on entry, so any one of them advances a merged `pr_open` worktree to `completed`; if the user merges a PR and never runs another speccode command, the state won't update by itself — acceptable, since `status` is the explicit query entry point and can be triggered manually at any time.
- **R11 — hooks execute via `sh -c` with the current user's full permissions** → Mitigation and threat model: ① failure semantics are warn-only (30s timeout, `run-hook` always exits 0), so a hook cannot break the main flow; ② `config.hooks` is safe because `.speccode/` is **untracked by convention** — a hook command can never enter someone else's repo via clone / PR / merge, and the only way to write config is the local user's own `init`; ③ hook payload values are structurally constrained by `slug.mjs` (type is a closed enum, slug matches `/^[a-z0-9-]+$/`), and path-like fields are generated by the engine, containing no arbitrary user input.
- **R12 — concurrent memory writes are last-writer-wins** → multiple worktrees of the same feature share one memory file, and when two sessions "write on exit" at the same time, the later write overwrites the earlier one. Mitigation: read before write (read-before-write: increment on top of the existing content rather than replacing the whole file); confirm with the user before large overwriting rewrites.
- **R13 — trunk document churn** → spec documents are tracked on every branch, so multiple features landing in parallel keep changing `speccode/` on trunk and widen the merge-conflict surface. Mitigation: `syncing` only does **incremental, idempotent merges** (rerunning leaves no dirty changes); `archiving` **moves** whole directories rather than deleting, keeping review diffs clean and history traceable; documents ride the same PR as the code to trunk and are visible during review.

## 11. Migrating from 0.1

The complete change log for every version lives in [CHANGELOG.md](../../CHANGELOG.md) at the repo root.

### Upgrade actions

For users, a plugin upgrade is a set of Claude Code commands, not a fresh clone:

```text
/plugin marketplace update speccode-development   # refreshes the marketplace cache (git pull)
→ a plugin.json version change triggers the update check
→ /plugin install speccode@speccode-development   # update the installation when prompted
```

Note: GitHub Releases / tags are just release markers for humans and **trigger no automatic update**; the update check is driven entirely by the `plugin.json` version comparison after the marketplace git pull.

### Command mapping

| v0.1 | v0.2 |
|---|---|
| `/speccode:start` | `/speccode:creating-feature` |
| `/speccode:develop-start` | `/speccode:creating-worktree` |
| `/speccode:develop-complete` | `/speccode:finishing-worktree` |
| `/speccode:finish` | `/speccode:finishing-feature` |
| `/speccode:display-merge-trunk` | **retired** (display layer removed) |
| `/speccode:display-rebase-trunk` | **retired** |
| `/speccode:display-reset-to-trunk` | **retired** |

Migration steps:

1. **Re-init config to upgrade to 0.2**: simply run `/speccode:init`; the idempotent flow diffs field by field. The three old-config fields `display` / `spec_tools` / `untracked_permanent` (when `version` is 1 or missing) are marked "removed"; after accepting the upgrade, `version: 2` is written and no mixed state exists. The old values are explicitly backed up via `backup-config` as `config.json.bak.<timestamp>` before rewriting.
2. **Leftover display branches**: v0.2 no longer uses the display layer. Repos with no active features can delete their display branches outright; in v0.2 spec documents are tracked on every branch, so a dedicated "milestone branch" for hosting them is no longer needed.
3. **Leftover `waiting_display_pr` suspended states**: features whose v0.1 finish phase got stuck on a display PR have a `pending_operation` in state that v0.2 cannot resume automatically. Follow the manual guidance in the `/speccode:finishing-feature` command document: ① check whether the display PR at the time was merged; ② if merged, `git checkout <trunk> && git pull` and manually create the `<feature> → <trunk>` PR; ③ clear that feature's `pending_operation` with `write-state` and rerun `/speccode:finishing-feature`. If a v0.1 `<feature>-complete` temporary branch still lingers, delete it manually after confirming the trunk PR is merged.
4. **Muscle memory and scripts for old command names**: renames have no aliases; any script / document / habit referencing v0.1 command names must be updated per the table above. Old `pending_operation.command` values left in state (`develop-complete` / `finish`) are normalized to the new names automatically by the engine on the read path — **no manual handling needed**.
5. **`.speccode/memory/` and `.speccode/sdd/`**: these two directories didn't exist in the v0.1 era, so **no action is needed** on upgrade; each command creates them on demand (each directory self-ignores via its own `.gitignore`).

## 12. Philosophy

speccode's methodology commands inherit five working philosophies:

1. **Test-driven**
2. **Systematic over ad hoc**
3. **Reduce complexity**
4. **Evidence over assertion**
5. **Don't be overconfident (ask when unsure)**

## 13. Open Issues

- **Windows not supported**: the current implementation only covers macOS / Linux and does not handle Windows path separators, shell differences, etc. (see R8). Whether to repeat the "macOS / Linux only" note in every command file, or state it once in this README — the current leaning is to state it centrally only in the README (this section + the dependencies block at the top of the document) rather than repeating it in every command markdown file.

## 14. ⚠ Important Warning

The `.speccode/` directory is **not tracked by git and will not be added to `.gitignore`** in user projects — this is an explicit design decision of the plugin (speccode decouples from git's native mechanisms; all tracking management goes through explicit commands, and the plugin never edits `.gitignore` on the user's behalf).

**What this means**: if you run `git clean -fdx` in this repo, `.speccode/config.json`, `state/features/*.json`, `memory/`, and `sdd/` are all treated as "untracked/ignored files" and deleted along with them — you lose the current speccode config, the progress state of every active feature, and all session memory (corresponding to risk R4).

`git clean -fd` (without `-x`) is gentler: `memory/` and `sdd/` are judged ignored because of the plugin's self-written `.gitignore` (content `*`), so `-fd` spares both; but `config.json`, `state/`, and `config.json.bak.*` are still ordinary untracked files, and **`-fd` deletes them too**.

**Recommendations**:

- Before running any `git clean` variant, first confirm what `-x` and `-f` cover; if in doubt, dry-run with `git clean -n` first, or explicitly exclude the `.speccode/` path.
- If `config.json` really is lost, rerun `/speccode:init` to rebuild it; when `state/features/*.json` are lost, the progress information of the corresponding features cannot be recovered and must be re-registered via reconciliation against the actual current git state; a lost `memory/` means session memory is unrecoverable — only the committed documents under `speccode/` can rebuild context.
