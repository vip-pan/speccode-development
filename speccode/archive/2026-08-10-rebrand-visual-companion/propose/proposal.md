# Proposal: rebrand-visual-companion

## Why

`references/visual-companion-scripts/`(移植自 superpowers 的脑暴可视化伴侣)仍带原品牌残留:页脚渲染 "Superpowers vunknown"(版本探路深度错误,读不到 manifest)、加载 primeradiant.com 远程 logo、页面标题 "Superpowers Brainstorming"——插件用户可见,违背「自包含 + 零外部依赖」定位。另:CLAUDE.md 手维的 requirement 计数(74)与实际(75)已漂移。

## What Changes

- `server.cjs`:版本探测改为读 `plugins/speccode/.claude-plugin/plugin.json`(修正上溯深度);品牌条改纯文本 `speccode v<version>` + 链接读 plugin.json `homepage`;删除远程 logo 常量与 `<img>`;远程资源消失后遥测关停开关失去作用对象,`TELEMETRY_DISABLE_ENV_VARS` / `SUPERPOWERS_TELEMETRY_DISABLED` / `isTruthyEnv` 整块移除
- `frame-template.html`:标题改 `speccode Brainstorming`
- `CLAUDE.md`:L9 去掉手维 requirement 计数(根治漂移)
- `plugin-packaging` delta:ADDED「references 自包含与品牌中立」requirement(防回归)
- 无 BREAKING(视觉与文档级变更;server.cjs 的协议/端口/token/生命周期行为不变)

## Capabilities

- modified: `plugin-packaging`

## Impact

- 代码:`plugins/speccode/references/visual-companion-scripts/server.cjs`、`frame-template.html`
- 文档:`CLAUDE.md`、`speccode/spec/plugin-packaging/spec.md`(经 syncing 合并)
- 运行时:visual companion 页面不再发起任何第三方远程请求
