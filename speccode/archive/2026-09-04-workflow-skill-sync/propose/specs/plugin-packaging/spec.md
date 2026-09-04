## MODIFIED Requirements

### Requirement: 社区贡献文件

仓库根 SHALL 含 `CONTRIBUTING.md`(说明 dogfood 贡献流程:exploring → creating-worktree → proposing → 实现(applying 或 writing-plans → executing-plans / subagent-driven-development)→ requesting-code-review → syncing → archiving → finishing-worktree,以及 clone 后 `bash support/install-skills.sh` 安装开发 skill);`.github/` SHALL 含 Issue 模板(`.github/ISSUE_TEMPLATE/`)与 `pull_request_template.md`。根 README 的贡献段 SHALL 链接 `CONTRIBUTING.md`。

#### Scenario: 社区文件存在
- **WHEN** 检查仓库根与 `.github/`
- **THEN** 根含 `CONTRIBUTING.md`;`.github/` 含 Issue 模板目录与 `pull_request_template.md`

#### Scenario: 根 README 贡献段指向 CONTRIBUTING
- **WHEN** 检查根 README.md 与 README_CN.md 贡献段
- **THEN** 含指向 `CONTRIBUTING.md` 的链接
