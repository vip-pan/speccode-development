# speccode

[English](DESIGN.md) | [简体中文](DESIGN_CN.md)

> User-facing docs (installation / Quickstart / comparison & positioning) live in the root [README.md](../README.md); this document is the plugin design document.

## 1. What is speccode

speccode is a workflow orchestration plugin for coding-agent CLIs — Claude Code as the primary, dogfooded host, with adapters for Codex, Kimi Code, ZCode, OpenCode, and Pi (per-host install status in Section 11's multi-host table) — that turns the practices previously held together by manual convention — parallel development of multiple requirements, spec document hosting, and a standardized PR/MR flow — into executable primitives exposed as `/speccode:*` slash commands.

**Who it's for**: small teams or solo developers running **multiple requirements in parallel inside the same repo** — when you need to run several requirements at once, split a large requirement into multiple child branches for parallel work, and don't want to keep second-guessing "where do the docs go", "which branch do I branch from", "who opens the PR" — speccode offers an end-to-end default path.

**Since 0.2**, speccode ships with the complete SDD methodology (explore → document → plan → subagent execution → review → finish) plus hooks / memory capabilities; the branch topology is **two-layered** — normal requirements go straight from trunk to a `<type>/<slug>` development branch (git worktree, one step), while large requirements opt in to an integration branch + parent entity (see Section 3). The methodology is ported from superpowers (v6.2.0) and self-contained inside the plugin, so target projects have **zero external dependencies**.

## Dependencies & Prerequisites (applies to the whole document)

- `git` (the core: worktree / merge / rebase and every other operation is built on git)
- `gh` CLI (GitHub remote) or `glab` CLI (GitLab remote) — used to create/query PRs/MRs; when not installed, `pr_tool` automatically degrades to `none`, and commands print the equivalent command for you to run manually instead of failing
- Node.js **≥ 24** (the engine runs on Node; pure ESM, zero third-party dependencies)

## Table of Contents

1. [What is speccode](#1-what-is-speccode)
2. [24-Command Quick Reference](#2-24-command-quick-reference)
3. [Two-Layer Branch Topology](#3-two-layer-branch-topology)
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
14. [⚠ Important Warning](#14-⚠-important-warning)

## 2. 24-Command Quick Reference

Lifecycle:

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:init` | Initialize/update: probe the remote, trunk, and code intelligence tools; configure the worktree directory and hooks; write `.speccode/config.json` (config v3) | Any branch (first run usually on trunk) |
| `/speccode:exploring` | Explore a requirement (produces no documents; conclusions live in the session context; code intelligence tools preferred; ends with the three-way requirement-shape confirmation) | trunk |
| `/speccode:creating-feature` | **Opt-in (large requirement)**: cut an integration branch from trunk and push it; register the parent-entity state; create the memory skeleton | trunk |
| `/speccode:creating-worktree` | Cut a development branch from trunk or from an integration branch (the only entry for normal requirements; worktree_dir configurable, check-ignore validation, project setup, baseline tests) | trunk (normal) or integration branch (parent scenario); HEAD unconstrained |
| `/speccode:finishing-worktree` | Finish a development branch and route the merge by `merge_target`: local squash + retest into the integration branch / PR to trunk (test gate; discarding requires the literal word `discard`) | a `<type>/<slug>` development branch |
| `/speccode:finishing-feature` | **Opt-in (large requirement)** finale: all children completed gate → integration branch → trunk single PR (blocks until merged) → delete the parent-entity state → switch back to trunk | integration branch |
| `/speccode:status` | Read-only overview: progress of every active branch, pending_operation, config summary (parent entities render child statuses derived in real time) | Any branch |
| `/speccode:reset` | Reset the environment: clear state and worktrees, ask field-by-field whether to clear config, ask whether to clear memory//sdd//brainstorm/ (refuses to run when any active branch exists) | Any branch, and must have no active branches |

Documentation flow (every step commits on save):

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:proposing` | Land the four document types (proposal/design/specs/tasks) into `speccode/changes/<slug>/propose/`; the exit assigns a tier (Tier 1/2/3) into the proposal.md frontmatter `tier:` field; light mode (empty specs delta) may omit design.md/specs/ | a `<type>/<slug>` development branch |
| `/speccode:brainstorming` | Socratic design refinement; designs land in `brainstorm/` and are written back into propose/ to keep them consistent | a `<type>/<slug>` development branch |
| `/speccode:writing-plans` | Detailed implementation plan (brainstorm/ first, propose/ as fallback), lands in `plan/` | a `<type>/<slug>` development branch |
| `/speccode:applying` | Manual executor for Tier-1 changes: implement tasks.md item-by-item (no plan), tick + bookkeeping commit, mandatory code review | a `<type>/<slug>` development branch |
| `/speccode:syncing` | Merge incremental changes into the `speccode/spec/` main spec (absorbs leftover brainstorm material; idempotent) | a `<type>/<slug>` development branch |
| `/speccode:archiving` | Archive: move changes/<slug>/ into `speccode/archive/<YYYY-MM-DD>-<slug>/` | a `<type>/<slug>` development branch |

Knowledge:

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:distilling-knowledge` | Distill the `speccode/knowledge/` topic files from `spec/` (full read — the freshness anchor) + `archive/` (**incremental**: only unconsumed archive bundles, tracked via `knowledge/_distilled.meta.json`, pure read-cost control); every existing block is freshness-audited against the current specs on each run; blocks are keyed by capability (`<!-- distilled-from: cap/<slug> -->`, one per capability per file, upsert — later knowledge overrides earlier; retired knowledge is deleted with a reason via the gate, no tombstones); legacy-source blocks are mapped to capability keys through the gate on first run; SDD process knowledge only, out-of-scope topics sunset via the gate; delete the sidecar to force a full archive re-read (no `--full` flag); human gate before write; commits on save | chore/knowledge-* worktree branch (unified creating-worktree entry, finishing-worktree finish) |
| `/speccode:recording-knowledge` | Record knowledge directly into hand-written sections (fit check: process knowledge stays, business knowledge is pointed to external RAG; draft → human gate → atomic write via `replace-hand`, distilled blocks preserved byte-for-byte; also tidies the topic's existing hand-written section each run — merge/delete with reasons, authority is the present user); commits on save | chore/knowledge-* worktree branch (unified entry/finish) |

Methodology:

| Command | Purpose | Prerequisite (branch to run on) |
|---|---|---|
| `/speccode:subagent-driven-development` | Dispatch a fresh subagent per task + double review + final review of the whole team; ledger recovery | a `<type>/<slug>` development branch |
| `/speccode:executing-plans` | Execute the plan in batches within this session, with human checkpoints | a `<type>/<slug>` development branch |
| `/speccode:dispatching-parallel-agents` | Concurrent subagent workflow (independent failure domains) | a `<type>/<slug>` development branch |
| `/speccode:test-driven-development` | RED-GREEN-REFACTOR loop (with iron rules and an anti-pattern table) | a `<type>/<slug>` development branch |
| `/speccode:systematic-debugging` | 4-stage root-cause process + defense in depth + conditional-wait techniques | a `<type>/<slug>` development branch |
| `/speccode:requesting-code-review` | Dispatch a review subagent (spec compliance + code quality) | a `<type>/<slug>` development branch |
| `/speccode:receiving-code-review` | Handle review feedback technically (no performative agreement) | a `<type>/<slug>` development branch |
| `/speccode:verification-before-completion` | Evidence before assertion: verification must run before declaring anything done | a `<type>/<slug>` development branch |

## 3. Two-Layer Branch Topology

```
origin/<trunk> (trunk; spec documents tracked)
   │
   │  /speccode:creating-worktree (normal requirement, one step; base = trunk, several can run in parallel)
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
feature/a       feature/b      feature/c   ← development branches <type>/<slug> (no worktree- prefix)
   │  The documentation flow (proposing→brainstorming→writing-plans→applying→…→syncing→archiving) happens on this layer
   └── /speccode:finishing-worktree (merge_target=trunk: test gate + PR) merges back into trunk ──┘
   │
   ▼
origin/<trunk>  (normal requirement lands; the development branch stays as history)

- - - - - Large-requirement opt-in path (only when exploring's exit shape confirmation says "large") - - - - -
   │
   │  /speccode:creating-feature (cut an integration branch from trunk, register the parent-entity state)
   ▼
feature/big-rework  (integration branch; parent entity kind:integration, children register slugs only)
   │
   │  /speccode:creating-worktree (base = integration head; parallel or serial child branches)
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
feature/s1      feature/s2     feature/s3   (child branches; merge_target = the integration branch)
   │  The documentation flow as above, on each child branch
   └── /speccode:finishing-worktree (merge_target=integration: local squash + retest)──────────┘
   │
   ▼
feature/big-rework  (integration head advances; children statuses are derived from the child-branch states)
   │
   │  /speccode:finishing-feature (all-children-completed gate; single PR → trunk)
   ▼
origin/<trunk>  (the large requirement lands in one shot)
```

Key points:

- **trunk**: the trunk branch (default `master`), spec documents tracked.
- **`<type>/<slug>` development branches**: cut from trunk for normal requirements (via `git worktree add`; several can run in parallel), with no `worktree-` prefix; in the large-requirement scenario they are cut from the integration branch with `merge_target` pointing at it.
- **Integration branch (opt-in large requirement)**: created from trunk by `/speccode:creating-feature`, registered as a parent-entity state (`kind:"integration"`); `children` registers child slugs only (identity only), with statuses derived in real time from the child-branch states; the finale is a single PR to trunk via `/speccode:finishing-feature`.
- **The topology has only two layers**: normal requirements go trunk ↔ development branch directly; the integration branch is the opt-in aggregation layer for large requirements, never a mandatory default layer. `speccode/` documents are tracked on every branch and ride the PR chain up to trunk.

## 4. Development Workflow

The default path from requirement to delivery (normal requirements go directly; large requirements opt in to the integration branch):

1. `/speccode:exploring` — explore the requirement on trunk; conclusions stay in the session context (writes per-topic `_exploring/<topic>` memories); the exit runs the **requirement-shape confirmation** with three outcomes: a single normal requirement / several independent normal requirements / a large requirement (integration).
2. (Large-requirement opt-in only) `/speccode:creating-feature` — cut the integration branch from trunk and register the parent-entity state; normal requirements skip this step.
3. `/speccode:creating-worktree` — cut a development branch from trunk (normal) or from the integration branch (large requirement); run baseline tests.
4. `/speccode:proposing` — land the four document types: proposal/design/specs/tasks; the exit assigns the change a tier (Tier 1 tiny / Tier 2 small-to-medium / Tier 3 complex, written to the proposal.md frontmatter `tier:` field) that routes the follow-up chain; light mode (empty specs delta) may omit design.md/specs/.
5. (Tier 3) `/speccode:brainstorming` — refine the design and write it back into propose/.
6. (Tier 2/3) `/speccode:writing-plans` — produce the detailed implementation plan.
7. `/speccode:applying` (Tier 1: implement tasks.md item-by-item by hand) or `/speccode:subagent-driven-development` / `/speccode:executing-plans` — execute (methodology commands such as `/speccode:dispatching-parallel-agents`, `/speccode:systematic-debugging`, `/speccode:verification-before-completion`, `/speccode:test-driven-development` are invoked as needed along the way).
8. `/speccode:requesting-code-review` — dispatch a review subagent; process feedback with `/speccode:receiving-code-review`.
9. `/speccode:syncing` — merge the delta into the main spec.
10. `/speccode:archiving` — archive changes/<slug>/.
11. `/speccode:finishing-worktree` — route by `merge_target`: normal requirements open a PR → trunk; large-requirement child branches local-squash into the integration branch.
12. (Large-requirement opt-in only) `/speccode:finishing-feature` — once all children are completed, a single PR from the integration branch → trunk (blocks until merged), delete the parent-entity state, switch back to trunk; normal requirements have no such step.

## 5. Documentation Layout

speccode's spec documents live in the repo's `speccode/` directory, **tracked on every branch**, and ride the PR chain up to trunk:

```
speccode/
├── changes/<slug>/          # in-progress requirement documents
│   ├── propose/             # proposal.md / design.md / specs/ / tasks.md (produced by proposing; in light mode design.md/specs/ may be omitted)
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

- **Commit on save**: proposing / brainstorming / writing-plans / applying (per-item bookkeeping commits) / syncing / archiving / distilling-knowledge / recording-knowledge each commit immediately after producing their documents, so document history and code history stay on the same branch, moving together.
- **Multi-round rebuilds of the same feature don't collide**: once changes/<slug>/ is archived the directory is freed, and the same slug can start a new round via proposing again; when rebuilding without archiving first, proposing asks "continue / archive first / cancel".
- **Knowledge set: a current-state snapshot, keyed by capability**: each topic file under `knowledge/` mixes two kinds of content. `distilling-knowledge` distills `spec/` (full read — the freshness anchor) and `archive/` (**incrementally**, tracked in `knowledge/_distilled.meta.json` purely as read-cost control) into **distilled blocks** wrapped in `<!-- distilled-from: cap/<slug> --> ... <!-- /distilled -->` markers: the key is a capability slug, unique per file, upserted on every run — later knowledge overrides earlier, retired knowledge is deleted through the gate with a reason (no tombstones; history lives in `archive/` and the CHANGELOG), and every existing block is freshness-audited against the current specs on each run. `recording-knowledge` writes and tidies the free-form **hand-written** prose outside those markers (replace-hand mode: the whole hand region is rebuilt on each write while distilled blocks survive byte-for-byte; tidy actions — merge/delete — carry reasons and answer to the present user, not to the specs). Both writes emit the canonical layout: hand-written first, distilled blocks after. The set curates SDD process knowledge only (`development/*`; pitfalls also covers recurring review findings and team review consensus). Business knowledge is left to external RAG systems: `recording-knowledge` runs a fit check before writing (a recommendation, not a hard block), and `distilling-knowledge` sunsets distilled blocks of out-of-scope topics through the same human gate while preserving hand-written content byte-for-byte. Legacy `promoted-from`/`/promoted` markers and legacy provenance-valued sources are still parsed on read; existing files migrate to capability keys through the gate on their first distill.

> Plugin-side helper resources: `references/` contains visual-companion (the visual companion for brainstorming, see `references/visual-companion.md`), review prompts, and debugging methodology; all tracked with the plugin source.

## 6. The `.speccode/` Directory Structure

```
.speccode/
├── config.json                          # static config (config v3), written wholesale by init / reset; creating-worktree can write back worktree_dir
├── config.json.bak.<timestamp>          # explicit backup before init-idempotent / reset flows rewrite config (backup-config verb)
├── state/branches/<type>__<slug>.json   # dynamic state, isolated per branch (v2 legacy lives in state/features/, dual-format compatible)
├── memory/                              # feature-level memory + per-topic _exploring__<topic>.md / _knowledge.md (self-ignored via .gitignore)
└── sdd/                                 # SDD execution artifacts: task briefs / review packages / ledger (self-ignored via .gitignore)
```

- **`config.json`**: the global static config; the config v3 field set: `version` (=3), `initialized_at`, `trunk`, `remote`, `pr_tool`, `worktree_dir`, `code_intel_tools`; `host` (optional, confirmed by the user at init; absent = unrecorded, full probes) only exists when confirmed; `hooks` only exists when the user configured it (v2's `worktree_prefix` retired with the two-layer topology; idempotent init removes it via the field diff). Wholesale writes happen only in `/speccode:init` (fresh or idempotent) and `/speccode:reset`; additionally, `/speccode:creating-worktree` asks for a directory when config lacks `worktree_dir`, then writes the field back into config via `write-config` (read current config → add field → write back wholesale). **Backups are not an automatic behavior of `write-config`**: `config.json.bak.<timestamp>` is produced by the init-idempotent flow and the reset flow explicitly calling `backup-config` before rewriting; creating-worktree's single-field write-back creates no backup.
- **`state/branches/`**: one file per active branch (`<type>__<slug>.json`, double underscore separating type and slug), recording that branch's status (`pending | in_progress | pr_open | completed`) and any suspended `pending_operation` (for `--resume`); parent entities (`kind:"integration"`) additionally hold the children list (child slugs only, identity only) — child-branch statuses are derived in real time and never stored on the parent. v2-legacy `state/features/` files are read and written with v2 semantics as-is (dual-format compatibility; init can migrate them explicitly). Branches each write their own files in parallel, no locks needed.
- **`memory/`**: feature-level session memory (see Section 8); the plugin writes its own `.gitignore` (content `*`) so it stays invisible to `git status` and is spared by `git clean -fd`.
- **`sdd/`**: SDD execution artifacts, belonging to the **current worktree root** (not the main repo root), cleaned up together with `git worktree remove`; self-ignored as well.
- Every write to `config.json` and `state/branches/*.json` (v2-legacy `state/features/*.json` same policy) uses the atomic "write a temp file + rename over" strategy to avoid half-written states when a process is interrupted; memory text writes use the same strategy.

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

**Bundled tool-input sanitizer**: the plugin ships a PreToolUse hook (`hooks/hooks.json`)
that strips stray carriage returns (U+000D) from `AskUserQuestion` tool input before the
dialog renders — some model backends inject CRs into `tool_use` arguments, garbling
question text. Sanitization logic lives in `lib/sanitize.mjs` (pure function, unit-tested);
the hook shell is fail-open: any error passes the original input through untouched.

## 8. Memory

speccode maintains one cross-session memory per feature: `.speccode/memory/<type>__<slug>.md`.

- **Untracked, shared across worktrees**: the memory path resolves from the **main repo root**'s `.speccode/` (same as config/state), so multiple worktrees of the same feature read and write the same file; the directory is self-ignored by the plugin's own `.gitignore` and never pollutes `git status`.
- **Per-topic exploring memory and `_knowledge.md` are the trunk-level exceptions**: exploring happens on trunk and belongs to no feature, so its conclusions go into `memory/_exploring__<topic>.md` (one file per topic; phased requirements share a prefix like `<topic>-p1`); the adoption host for exploration conclusions is creating-worktree (normal requirements / child requirements — an atomic rename on a slug match) and creating-feature (the large requirement's parent topic). The knowledge commands run on `chore/knowledge-*` worktree branches via the standard creating-worktree entry and finishing-worktree finish; their maintenance summaries still go into `memory/_knowledge.md`.
- **Commands read on entry, write on exit**: SDD commands read this feature's memory at the start to restore context, and write conclusions / decisions / remaining tasks back on exit.
- **Proactive writing during long sessions — three triggers**: ① a stage completes (e.g. propose lands, the plan passes review); ② context has grown significantly (more key decisions accumulating); ③ after a compact / session restore — hit any one of these and write memory proactively, rather than waiting for a command exit.

## 9. Code Intelligence Tools

`/speccode:init` probes five code intelligence tools: **understand-anything / CodeGraph / Graphify / CodeMap / GitNexus**, covering four kinds of sources:

1. **Plugins**: `~/.claude/plugins/installed_plugins.json` (claude-code host / unrecorded host only)
2. **MCP**: project `.mcp.json`, `~/.claude.json` (including the project's local scope; claude-code host / unrecorded host only)
3. **CLI**: `command -v <bin>`
4. **Project directories**: e.g. `.ua/`, `.codegraph/`, etc.

Probe results distinguish two dimensions — **available** and **integrated**; only tools where both `available` and `integrated` are true are presented item by item via AskUserQuestion and, upon user confirmation, registered into the config's `code_intel_tools`; tools that are available but not integrated MUST NOT be registered; if none are confirmed, an empty array is written.

Usage convention: `/speccode:exploring`, `/speccode:proposing`, and `/speccode:brainstorming` consult the registered code intelligence tools first; when a tool is missing or a call fails, they **fall back to plain code reading and never error out** — code intelligence is an enhancement, not a dependency.

## 10. Risks & Mitigations (R1–R13)

> The numbering follows the original v0.1 risk table: R1 / R7 / R10 were retired together with the v0.1 four-layer topology (milestone branch layer + temporary wrap-up branches), see the Section 11 migration; the rest are kept and updated to the new command names.

- **R2 — ancestry checks can misjudge when cherry-picks cross features** → as of v3, reconciliation uses **path identification** (inside worktree_dir + state registration) and no longer performs ancestry checks, so this misjudgment surface is gone; the v2-era mitigation was the `worktree_overrides` field explicitly specifying worktree ownership as an "advanced-user fallback" — that field is now retired (read-compatible, ignored).
- **R3 — during init's field-by-field idempotent flow, the user may accidentally change fields like trunk** → Mitigation: every changed field MUST show the `[old value] → [new value]` diff when confirming, and is only written after the user chooses "use the new value".
- **R4 — `.speccode/` is not in `.gitignore`, so `git clean -fdx` can wipe the config** → Mitigation: explicitly warned about in the init prompt and in this README; no forced protection at the command level (consistent with the principle that "the plugin doesn't modify `.gitignore` or override the user's git mechanisms"). See Section 14's Important Warning.
- **R5 — the blocking wait for a PR merge times out after 30 minutes by default, which may not be enough for long PR reviews** → Mitigation: the timeout is a soft limit; the suspended state goes into `pending_operation` and `--resume` lets you continue later, so the command never deadlocks permanently.
- **R6 — the worktree directory is configurable, defaulting to `.speccode/worktrees`** → Mitigation: `.speccode/` is the untracked runtime-data domain, so git won't sweep it up as content to commit; init can override the default via the config `worktree_dir`, and `creating-worktree` runs a check-ignore validation before creating the directory.
- **R8 — cross-platform (Windows / macOS / Linux) path and command differences** → Mitigation: the implementation targets macOS / Linux first, and Windows support is out of scope; command implementations rely as much as possible on the cross-platform behavior of `git` / `gh` / `glab` itself rather than doing platform checks at the shell layer.
- **R9 — `pr_open` branches depend on reconciliation to advance** → Mitigation: `creating-worktree` / `finishing-worktree` / `finishing-feature` / `status` all run reconciliation on entry, so any one of them advances a merged `pr_open` branch to `completed`; if the user merges a PR and never runs another speccode command, the state won't update by itself — acceptable, since `status` is the explicit query entry point and can be triggered manually at any time.
- **R11 — hooks execute via `sh -c` with the current user's full permissions** → Mitigation and threat model: ① failure semantics are warn-only (30s timeout, `run-hook` always exits 0), so a hook cannot break the main flow; ② `config.hooks` is safe because `.speccode/` is **untracked by convention** — a hook command can never enter someone else's repo via clone / PR / merge, and the only way to write config is the local user's own `init`; ③ hook payload values are structurally constrained by `slug.mjs` (type is a closed enum, slug matches `/^[a-z0-9-]+$/`), and path-like fields are generated by the engine, containing no arbitrary user input.
- **R12 — concurrent memory writes are last-writer-wins** → multiple worktrees of the same feature share one memory file, and when two sessions "write on exit" at the same time, the later write overwrites the earlier one. Mitigation: read before write (read-before-write: increment on top of the existing content rather than replacing the whole file); confirm with the user before large overwriting rewrites.
- **R13 — trunk document churn** → spec documents are tracked on every branch, so multiple features landing in parallel keep changing `speccode/` on trunk and widen the merge-conflict surface. Mitigation: `syncing` only does **incremental, idempotent merges** (rerunning leaves no dirty changes); `archiving` **moves** whole directories rather than deleting, keeping review diffs clean and history traceable; documents ride the same PR as the code to trunk and are visible during review.

## 11. Migrating from 0.1

The complete change log for every version lives in [CHANGELOG.md](../CHANGELOG.md) at the repo root.

### Upgrade actions

For users, a plugin upgrade is a set of Claude Code commands, not a fresh clone:

```text
/plugin marketplace update speccode   # refreshes the marketplace cache (git pull)
→ a plugin.json version change triggers the update check
→ /plugin install speccode@speccode   # update the installation when prompted
```

Note: GitHub Releases / tags are just release markers for humans and **trigger no automatic update**; the update check is driven entirely by the `plugin.json` version comparison after the marketplace git pull.

### Multi-host install entries

Claude Code is the primary host; five more hosts install from this same repository (thin per-host adapters pointing at the shared `skills/`). Entries marked 待验证 have not been verified on real machines — see `references/host-mapping/README.md` for the overview table and per-host mapping docs.

| Host | Entry | Mapping | Status |
|---|---|---|---|
| Claude Code | marketplace | native | primary, dogfooded |
| Codex | `.codex-plugin/plugin.json` | `references/host-mapping/codex.md` | install unverified |
| Kimi Code | `.kimi-plugin/plugin.json` | manifest `skillInstructions` + mapping doc | install unverified |
| ZCode | `.zcode-plugin/plugin.json` | manifest `skillInstructions` + mapping doc | unverified (Kimi-shaped assumption) |
| OpenCode | `.opencode/INSTALL.md` | `references/host-mapping/opencode.md` | unverified |
| Pi | `.pi/extensions/speccode.ts` | `references/host-mapping/pi.md` | unverified (extension API assumed) |

Non-Claude-Code hosts also need the engine shim on PATH: `bash scripts/install-shim.sh`.

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

**What this means**: if you run `git clean -fdx` in this repo, `.speccode/config.json`, `state/` (`branches/` and legacy `features/`), `memory/`, and `sdd/` are all treated as "untracked/ignored files" and deleted along with them — you lose the current speccode config, the progress state of every active branch, and all session memory (corresponding to risk R4).

`git clean -fd` (without `-x`) is gentler: `memory/` and `sdd/` are judged ignored because of the plugin's self-written `.gitignore` (content `*`), so `-fd` spares both; but `config.json`, `state/`, and `config.json.bak.*` are still ordinary untracked files, and **`-fd` deletes them too**.

**Recommendations**:

- Before running any `git clean` variant, first confirm what `-x` and `-f` cover; if in doubt, dry-run with `git clean -n` first, or explicitly exclude the `.speccode/` path.
- If `config.json` really is lost, rerun `/speccode:init` to rebuild it; when the files under `state/` are lost, the progress information of the corresponding branches cannot be recovered and must be re-registered via reconciliation against the actual current git state; a lost `memory/` means session memory is unrecoverable — only the committed documents under `speccode/` can rebuild context.
