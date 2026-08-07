## 1. 建插件目录骨架

- [x] 1.1 创建 `plugins/speccode/` 及子目录：`.claude-plugin/`、`commands/`、`bin/`、`lib/`、`tests/helpers/`
- [x] 1.2 写 `plugins/speccode/.claude-plugin/plugin.json`：name `speccode`、version `0.1.0`、description、author{name}、license `MIT`、homepage、repository、keywords（homepage/repository 初次写入用占位 `https://github.com/<owner>/speccode-development`，owner 待 GitHub 改名后确定；task 8.4 回填校准）
- [x] 1.3 写根 `.claude-plugin/marketplace.json`：name `speccode-development`、owner{name}、plugins[{name `speccode`, source `./plugins/speccode`}]

## 2. 搬移源码（git mv 保留历史）

- [x] 2.1 `git mv .claude/commands/speccode/*.md` → `plugins/speccode/commands/`（10 个命令）
- [x] 2.2 `git mv .claude/speccode/bin/speccode.mjs` → `plugins/speccode/bin/speccode.mjs`
- [x] 2.3 `git mv .claude/speccode/lib/*.mjs` → `plugins/speccode/lib/`（10 个模块）
- [x] 2.4 `git mv .claude/speccode/README.md` → `plugins/speccode/README.md`
- [x] 2.5 `git mv tests/*.test.mjs` 与 `tests/helpers/` → `plugins/speccode/tests/`（含 helpers/tmprepo.mjs）
- [x] 2.6 删除搬空后的 `.claude/commands/speccode/`、`.claude/speccode/`、根 `tests/` 空目录
- [x] 2.7 确认 `plugins/speccode/bin/speccode.mjs` 仍具 `+x` 位与 `#!/usr/bin/env node` shebang（git mv 保留权限；若丢失则 `chmod +x`）

## 3. 改命令正文为裸调（方案 B）

- [x] 3.1 全局替换 `plugins/speccode/commands/*.md` 中 `node .claude/speccode/bin/speccode.mjs` → `speccode.mjs`（~17 处，含 `reconcile`/`read-config`/`write-config`/`write-state`/`delete-state`/`backup-config`/`feature-progress`/`resolve-speccode-dir`/`detect-remote` 各 verb 调用）
- [x] 3.2 确认 2 处 stdin 管道写法（init 的 write-config、start 的 write-state）改为 `echo '<json>' | speccode.mjs <verb> --cwd . --json-stdin` 形态
- [x] 3.3 grep 复查 `plugins/speccode/commands/` 无残留 `node .claude/speccode` 或 `${CLAUDE_PLUGIN_ROOT}` 引用

## 4. 改测试路径（解耦 cwd）

- [x] 4.1 `plugins/speccode/tests/cli.test.mjs`：BIN 定位从 `join(process.cwd(), '.claude/speccode/bin/speccode.mjs')` 改为 `join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'speccode.mjs')`，并 import `fileURLToPath`/`dirname`
- [x] 4.2 `cli.test.mjs` 的 `parseArgs` import 从 `../.claude/speccode/bin/speccode.mjs` 改为 `../bin/speccode.mjs`
- [x] 4.3 其余 10 个测试文件 import 路径 `../.claude/speccode/lib/*.mjs` → `../lib/*.mjs`（atomic/config/docstrip/git/prtool/reconcile/slug/state/waitmerge/timestamp 对应文件）
- [x] 4.4 grep 复查 `plugins/speccode/tests/` 无残留 `../.claude/speccode` 或 `process.cwd()` 定位插件文件的引用

## 5. 文档三层分离

- [x] 5.1 写根 `README.md`：marketplace 索引——项目描述（speccode 是什么）、插件列表（当前仅 speccode，留扩展位）、安装方式（`/plugin marketplace add <owner>/speccode-development` + `/plugin install speccode@speccode-development`）
- [x] 5.2 确认 `plugins/speccode/README.md`（2.4 搬来的）内容为用户文档：10 命令表 / 分支拓扑图 / R1-R10 风险，无需改动内容
- [x] 5.3 重写 `CLAUDE.md` 为开发视角：三层引擎架构（路径全部更新为 `plugins/speccode/{bin,lib}/`）、测试命令更新为 `node --test ./plugins/speccode/tests/*.test.mjs`、OpenSpec 工作流、marketplace 结构说明、手动调试用 `node plugins/speccode/bin/speccode.mjs` 的提示
- [x] 5.4 grep 复查 `CLAUDE.md` 与 `plugins/speccode/README.md` 无残留 `.claude/speccode/` 旧路径
- [x] 5.5 在 `docs/superpowers/plans/2026-07-10-speccode-plugin.md` 文件头加 DEPRECATED 说明：标注为历史实现计划、路径已过时、当前结构以 `openspec/changes/restructure-as-claude-code-plugin/` 与 `plugins/speccode/` 为准（不删除、不改正文）

## 6. 配置与清理

- [x] 6.1 写根 `.gitignore`：含 `.speccode/`、`.idea/`
- [x] 6.2 重写 `.claude/settings.local.json`：删除所有指向 `.../coding/.claude/speccode/bin/speccode.mjs` 的绝对路径 permission；保留 `Bash(node *)`、`Bash(git *)`、`Bash(gh *)`、`Bash(grep *)` 等通配条目
- [x] 6.3 确认 `.claude/commands/opsx/`(9) 与 `.claude/skills/openspec-*/`(9) 原地保留未动
- [x] 6.4 确认 `openspec/`、`docs/` 原地保留未动

## 7. 验证

- [x] 7.1 `node --test ./plugins/speccode/tests/*.test.mjs` 全绿
- [x] 7.2 `openspec validate restructure-as-claude-code-plugin --strict` 通过
- [x] 7.3 单测过滤验证：`node --test --test-name-pattern="advances pr_open" plugins/speccode/tests/reconcile.test.mjs`
- [x] 7.4 引擎手动驱动验证：`node plugins/speccode/bin/speccode.mjs resolve-speccode-dir --cwd .` 返回合法 JSON
- [x] 7.5 实测插件安装：`/plugin marketplace add <仓库根绝对路径>` + `/plugin install speccode@speccode-development` 成功
- [x] 7.6 实测命令命名空间：安装后 `/speccode:status` 可执行（或至少在命令列表出现）

## 8. 仓库层重命名（手动，需用户执行）

- [x] 8.1 【手动】本地根目录改名：`mv coding speccode-development`（在仓库上层目录执行，不影响 git 内容）
- [x] 8.2 【手动】GitHub 网页将仓库名改为 `speccode-development`
- [ ] 8.3 【手动】更新本地 remote：`git remote set-url origin <新 URL>`
- [x] 8.4 校准 `plugin.json` 的 homepage/repository 字段为新仓库 URL（回填 task 1.2 的占位 owner）
- [x] 8.5 校准根 README 的安装命令中 `<owner>/speccode-development` 为实际 owner

## 9. 归档准备

- [x] 9.1 所有自动化任务（1-7）完成且验证通过后，commit
- [x] 9.2 运行 `/opsx:sync` 把 `plugin-packaging` delta spec 同步到 `openspec/specs/`
- [x] 9.3 运行 `/opsx:archive` 归档本 change（仓库层重命名任务 8 可在归档后由用户择机执行）

## 10. 后续独立 change（记录，不在本 change 执行）

- [x] 10.1 【记录】hooks 自动 reconcile：develop-complete/finish 后用 Stop hook 跑 reconcile 自愈状态漂移；PostToolUse 匹配 git 操作后更新 state
- [x] 10.2 【记录】`--cwd` 默认值优化：bin 里 `--cwd` 默认 `process.cwd()`，省略命令正文的 `--cwd .`
- [x] 10.3 【记录】`commands/` → `skills/` 评估（当前判定不适合，保留结论）
