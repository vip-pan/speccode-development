# Tasks: rebrand-visual-companion

- [x] 1. `server.cjs` 改写:`readSpeccodeManifest()` 读 `../../.claude-plugin/plugin.json`(上溯两级)取 version/homepage;`brandMarkup()` 改纯文本 `speccode v<version>` + homepage 链接;删除 `SUPERPOWERS_BRAND_IMAGE_URL` 与 logo `<img>`;遥测开关块(`TELEMETRY_DISABLE_ENV_VARS` / `SUPERPOWERS_TELEMETRY_DISABLED` / `isTruthyEnv`)整块移除;waitingPage 的 `.brand-logo` 死 CSS 清理
- [x] 2. `frame-template.html` 标题改 `speccode Brainstorming`,清理两处 `.brand-logo` 死 CSS
- [x] 3. `CLAUDE.md` L9 去掉 requirement 计数(保留「8 个 capability」)
- [x] 4. 验证:`grep -rni "superpowers\|primeradiant\|obra" plugins/speccode/references/` 为空;server 冒烟(起服务 → 带 key 请求等待页 → 断言含 `speccode v0.2.0`、不含远程 URL);全量 `node --test ./plugins/speccode/tests/*.test.mjs` 134 绿
- [x] 5. syncing 合并 delta(plugin-packaging 12 → 13 条)+ 勾选本文件 + archiving
- [ ] 6. finishing-worktree + finishing-feature,PR 合入 main
