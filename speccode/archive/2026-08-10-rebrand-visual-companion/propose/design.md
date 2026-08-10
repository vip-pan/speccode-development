# Design: rebrand-visual-companion

## Context

首轮 dogfood 的整支终审发现:`server.cjs` L105-112 / L208-225 / L242-252 与 `frame-template.html` L5 是 `references/` 内仅存的 superpowers 品牌残留(已对 references/ 全扩展名 cjs/html/js/md/sh/ts 扫描确认)。`readSuperpowersVersion()` 以 `__dirname/../../..` 上溯到 `plugins/` 探 `package.json` 与 `.codex-plugin/plugin.json`,两者在本仓均不存在 → 恒返回 `'unknown'`。所谓遥测环境变量在本文件中的真实作用仅是抑制远程品牌图加载,不存在任何遥测上报流量。本仓测试边界:lib 模块与 CLI verb 有单测,references/ 辅助资源无单测,验证靠机械化 grep 与冒烟脚本。

## Goals

- visual companion 用户可见界面不含任何第三方品牌与远程资源
- 版本号/仓库链接有单一数据源(plugin.json)
- 防回归:主规格显式要求 references 自包含与品牌中立

## Non-Goals

- 不改 visual companion 的 WebSocket 协议/端口/token/生命周期行为
- 不做 creating-feature 的 `_exploring` 推断改进(行为变更,另起 change)
- 不在本 change 发版(0.2.1 评估在合并后按发布纪律单独进行)

## Decisions

- **纯文本品牌条**(用户确认):`speccode v<version>` + `<a href>` 读 plugin.json `homepage`;删除 `SUPERPOWERS_BRAND_IMAGE_URL` 与 logo `<img>`——零远程资源。被否备选:内嵌 SVG(引入美术资产维护负担);完全去掉品牌条(失去版本可见性,排查用户报障少线索)
- **版本/链接单一数据源**:`readSpeccodeManifest()` 读 `path.join(__dirname, '..', '..', '.claude-plugin', 'plugin.json')`(脚本位于 `plugins/speccode/references/visual-companion-scripts/`,上溯两级即插件根),取 `version` 与 `homepage`;读取失败回退 `unknown` / 固定仓库 URL。被否备选:硬编码版本号(必漂移,正是本次事故根源之一)
- **遥测开关整块移除**:远程 logo 是唯一外部请求,删除后关停开关失去作用对象——`TELEMETRY_DISABLE_ENV_VARS`、`SUPERPOWERS_TELEMETRY_DISABLED`、`isTruthyEnv`(唯一调用点即开关块)一并删除。被否备选:更名 `SPECCODE_DISABLE_TELEMETRY` 保留开关(没有远程资源可关停,死开关);保留 SUPERPOWERS 别名(与「references 无第三方品牌残留」零匹配验证冲突,且 v0.2.0 品牌渲染从未正常工作,无行为依赖)
- **CLAUDE.md 去掉计数**(用户确认):保留「8 个 capability」,requirement 总数不再手维。被否备选:改成 76(每次规格变动仍需手动同步,治标不治本)
- **内部符号更名**:`SUPERPOWERS_VERSION`→`SPECCODE_VERSION`、`readSuperpowersVersion`→`readSpeccodeManifest`(遥测开关符号随整块移除,不做更名);`module.exports` 对外接口(computeAcceptKey/encodeFrame/decodeFrame/browserLauncherForPlatform 等)不动

## Risks

- plugin.json 位置/字段未来变化 → 版本回退 `'unknown'`:由新增 spec scenario 约束「页脚渲染真实版本号」,人工抽查;不新增单测(沿用 references 无单测的既有边界)
- 更名遗漏 → 实施后验证:`grep -rni "superpowers\|primeradiant\|obra" plugins/speccode/references/` 必须为空;再跑 server 冒烟断言页脚含 `speccode v0.2.0`

## Open Questions

无。
